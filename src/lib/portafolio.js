/*
 * Lo que un closer le puede mostrar a un prospecto en una call (Juan, call del
 * 12/11): qué es la app, de qué negocio, desde cuándo, en qué estado, cuándo
 * fue el último cambio y dónde verla. Viaja dentro de la foto de `sf-puente`
 * como `portafolio` y Speed Funnels lo muestra en /panel/portafolio.
 *
 * Todo lo que sale de acá lo puede ver un prospecto: nada de montos, plazos,
 * contactos, notas internas (scopeNotes, avances) ni el nombre de la persona
 * del cliente. El texto libre (kickoff, onboarding) se filtra por oración.
 *
 * Puro: lo corre la edge function y lo corren los tests.
 */

import { upsellState } from './journey.js'

const clip = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

const iso = (v) => {
  if (typeof v !== 'string' || v === '') return null
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00Z` : v)
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d.toISOString()
}

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const PLATA = /(US?\$|U\$S|\bUSD\b|\bARS\b|\bEUR\b|€|\$\s?\d|\d\s?(k|mil)?\s?(usd|d[oó]lares|pesos|euros)\b|\bplazos?\s*(:|de entrega|estimado)|soporte post|estructura de pago|\d+\s?%\s?(de )?(adelanto|anticipo)|\d+\/\d+\/\d+ sobre)/i
const CONTACTO = /[^\s@]+@[^\s@]+\.[a-z]{2,}|\+?\d[\d\s().-]{7,}\d/i

const oracionesDe = (t) => t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"(])/).map((o) => o.trim()).filter(Boolean)

function nombresDe(persona) {
  return fold(clip(persona, 120)).split(/[^a-z]+/).filter((w) => w.length >= 3)
}

/** Oraciones de `texto` que se pueden mostrar: sin plata, contactos ni el nombre de la persona. */
export function textoMostrable(texto, persona, max = 900) {
  const limpio = clip(texto, 4000)
  if (!limpio) return ''
  const nombres = nombresDe(persona)
  const ok = oracionesDe(limpio).filter((o) => {
    if (!o || PLATA.test(o) || CONTACTO.test(o)) return false
    const palabras = new Set(fold(o).split(/[^a-z]+/))
    return !nombres.some((n) => palabras.has(n))
  })
  let out = ''
  for (const o of ok) {
    const sig = out ? `${out} ${o}` : o
    if (sig.length > max) break
    out = sig
  }
  return out
}

function primeraOracion(texto, max) {
  const o = oracionesDe(texto)[0] || ''
  return o.length > max ? `${o.slice(0, max - 1).trimEnd()}…` : o
}

/**
 * Estado que se le cuenta a un prospecto. `null` = no se muestra (cancelado).
 * Las etiquetas internas ("Free Maint.", "Plan mensual") no salen de acá.
 */
export function estadoPortafolio(stage) {
  switch (stage) {
    case 'onboarding': return { key: 'arrancando', label: 'Arrancando' }
    case 'desarrollo':
    case 'fase2':
    case 'nuevo': return { key: 'desarrollo', label: 'En desarrollo' }
    case 'free':
    case 'plan':
    case 'anual':
    case 'partner': return { key: 'produccion', label: 'En producción' }
    case 'finalizado': return { key: 'entregado', label: 'Entregado' }
    case 'pausado': return { key: 'pausado', label: 'En pausa' }
    default: return null
  }
}

export function urlMostrable(v) {
  const raw = clip(v, 300)
  if (!raw) return null
  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(raw) ? `https://${raw}` : null
  if (!conEsquema) return null
  try {
    const u = new URL(conEsquema)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.username || u.password) return null
    return u.toString()
  } catch {
    return null
  }
}

const sinBarra = (u) => (u ? u.replace(/\/+$/, '').toLowerCase() : u)

const vendida = (e) => !!e && (e.status === 'acepta' || e.status === 'paga')

function tiendasDe(p) {
  const s = p && p.stores && typeof p.stores === 'object' && !Array.isArray(p.stores) ? p.stores : {}
  const out = {}
  for (const k of ['play', 'apple']) {
    const st = s[k] && s[k].status
    if (st === 'publicada' || st === 'tramite') out[k] = st
  }
  return out
}

function fechasDe(lista, campo) {
  return (Array.isArray(lista) ? lista : []).map((x) => x && iso(x[campo])).filter(Boolean)
}

const STACK_VACIO = /^(por definir|tbd|-|n\/a)$/i

/**
 * @param p       proyecto (data + id)
 * @param cliente fila del cliente (data + id) o {}
 * @param stage   etapa vigente (`journeyEntry(...).stage`)
 * @param pct     avance 0-100 o null
 */
export function portafolioDe(p, cliente, stage, pct) {
  const estado = estadoPortafolio(stage)
  if (!estado) return { mostrable: false }

  const persona = cliente && cliente.name
  const onb = cliente && cliente.onboarding && typeof cliente.onboarding === 'object' ? cliente.onboarding : {}
  const resumen = textoMostrable(p.kickoff, persona, 900)
  const objetivo = textoMostrable(onb.goals, persona, 240)
  const negocio = textoMostrable(onb.businessDescription, persona, 240)
  const queEs = objetivo ? primeraOracion(objetivo, 180) : resumen ? primeraOracion(resumen, 180) : ''

  const lc = p.lifecycle && typeof p.lifecycle === 'object' ? p.lifecycle : {}
  const inicios = [iso(p.createdAt), iso(lc.startedAt), iso(p.lastDeployDate), ...fechasDe(p.avances, 'date')].filter(Boolean)
  const stores = p.stores && typeof p.stores === 'object' && !Array.isArray(p.stores) ? p.stores : {}
  const cambios = [
    iso(p.lastProgressAt),
    iso(p.lastDeployDate),
    ...fechasDe(p.avances, 'date'),
    ...Object.values(stores).map((s) => s && iso(s.publishedAt)).filter(Boolean),
  ].filter(Boolean)

  const app = urlMostrable(p.productionUrl)
  const demo0 = urlMostrable(p.testingUrl)
  const demo = demo0 && sinBarra(demo0) !== sinBarra(app) ? demo0 : null
  const stack = clip(p.stack, 120)
  const up = upsellState(p)

  return {
    mostrable: true,
    estado: estado.key,
    estadoLabel: estado.label,
    queEs: queEs || null,
    negocio: negocio || null,
    resumen: resumen || null,
    stack: stack && !STACK_VACIO.test(stack) ? stack : null,
    avance: estado.key === 'desarrollo' && typeof pct === 'number' ? Math.max(0, Math.min(100, Math.round(pct))) : null,
    desde: inicios.length ? inicios.reduce((a, b) => (a < b ? a : b)) : null,
    ultimoCambio: cambios.length ? cambios.reduce((a, b) => (a > b ? a : b)) : null,
    demoUrl: demo,
    appUrl: app,
    fase2: stage === 'fase2' || vendida(up.fase2),
    nuevoSistema: stage === 'nuevo' || vendida(up.nuevo),
    plan: stage === 'plan' || stage === 'anual' || vendida(up.plan),
    tiendas: tiendasDe(p),
  }
}
