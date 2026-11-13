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
const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre'
const PLAZO = new RegExp(String.raw`\b\d+\s*(semanas?|meses|d[ií]as)\b|\bsemanas? \d|\b\d{1,2} de (${MESES})\b|\b(${MESES})( de)? 20\d\d\b|\bfechas? (estimad|de entrega|l[ií]mite)`, 'i')
// El plan habla del proceso (etapas, tareas del cliente, lo que falta), no del producto.
const PROCESO = /^(plan|roadmap|este es el plan|aclaraci[oó]n|termina|arranca|arrancamos|cerramos|despu[eé]s|luego|lo [uú]nico|aprovechamos|partiendo|consolidar|el producto est[aá])\b|(capacitad|capacitaci[oó]n|entregad|credencial|cuentas que|datos de ejemplo|esperando|\btu\b|\bvos\b)|\b(tareas? del cliente|depende de vos|lo que falta|lo que queda|el riesgo|etapa \d|semana a semana|cada semana|cada hito|avances navegables|handover|discovery|fechas?)\b/i

const oracionesDe = (t) => t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"(])/).map((o) => o.trim()).filter(Boolean)

function nombresDe(persona) {
  return fold(clip(persona, 120)).split(/[^a-z]+/).filter((w) => w.length >= 3)
}

/** Oraciones de `texto` que se pueden mostrar: sin plata, plazos, contactos ni el nombre de la persona. */
export function textoMostrable(texto, persona, max = 900, { proceso = false } = {}) {
  const limpio = clip(texto, 4000)
  if (!limpio) return ''
  const nombres = nombresDe(persona)
  const ok = oracionesDe(limpio).filter((o) => {
    if (!o || PLATA.test(o) || PLAZO.test(o) || CONTACTO.test(o)) return false
    if (proceso && PROCESO.test(o)) return false
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

const TIENDA_HOST = { play: /^play\.google\.com$/, apple: /^(apps|itunes)\.apple\.com$/ }

/** Link público a la ficha de la tienda: sólo el host de esa tienda. */
export function urlTienda(v, cual) {
  const u = urlMostrable(v)
  if (!u || !TIENDA_HOST[cual]) return null
  const h = new URL(u)
  if (!TIENDA_HOST[cual].test(h.host)) return null
  if (cual === 'play' && !/^\/store\/apps\/details/.test(h.pathname)) return null
  return u
}

function tiendasUrlDe(p, propio) {
  const s = p && p.stores && typeof p.stores === 'object' && !Array.isArray(p.stores) ? p.stores : {}
  const pr = propio && propio.tiendasUrl && typeof propio.tiendasUrl === 'object' ? propio.tiendasUrl : {}
  const out = {}
  for (const k of ['play', 'apple']) {
    const u = urlTienda(pr[k], k) || urlTienda(s[k] && s[k].url, k)
    if (u) out[k] = u
  }
  return out
}

const STACK_VACIO = /^(por definir|tbd|-|n\/a)$/i

/**
 * @param p       proyecto (data + id)
 * @param cliente fila del cliente (data + id) o {}
 * @param stage   etapa vigente (`journeyEntry(...).stage`)
 * @param pct     avance 0-100 o null
 * @param extra   { plan, desarrollador }: el plan del proyecto (su `lead` es la última fuente de
 *                texto) y el nombre del dev asignado, que va aparte en `interno`.
 */
export function portafolioDe(p, cliente, stage, pct, extra = {}) {
  const estado = estadoPortafolio(stage)
  if (!estado) return { mostrable: false }

  const persona = cliente && cliente.name
  const onb = cliente && cliente.onboarding && typeof cliente.onboarding === 'object' ? cliente.onboarding : {}
  // `data.portafolio` es la descripción redactada para un prospecto; igual pasa por el filtro.
  const propio = p.portafolio && typeof p.portafolio === 'object' && !Array.isArray(p.portafolio) ? p.portafolio : {}
  const plan = extra.plan && typeof extra.plan === 'object' ? extra.plan : {}
  const resumenPropio = textoMostrable(propio.resumen, persona, 900) || textoMostrable(p.kickoff, persona, 900)
  // El lead del plan es para el cliente y habla del proceso: sirve de resumen, no de "qué es".
  const resumen = resumenPropio || textoMostrable(plan.lead, persona, 900, { proceso: true })
  const objetivo = textoMostrable(propio.queEs, persona, 240) || textoMostrable(onb.goals, persona, 240)
  const negocio = textoMostrable(propio.negocio, persona, 240) || textoMostrable(onb.businessDescription, persona, 240)
  const queEs = objetivo ? primeraOracion(objetivo, 180) : resumenPropio ? primeraOracion(resumenPropio, 180) : ''

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
  const stack0 = clip(p.stack, 160)
  const stack = stack0 && !STACK_VACIO.test(stack0) ? stack0 : textoMostrable(propio.stack, '', 160)
  const up = upsellState(p)

  return {
    mostrable: true,
    estado: estado.key,
    estadoLabel: estado.label,
    queEs: queEs || null,
    negocio: negocio || null,
    resumen: resumen || null,
    stack: stack || null,
    avance: estado.key === 'desarrollo' && typeof pct === 'number' ? Math.max(0, Math.min(100, Math.round(pct))) : null,
    desde: inicios.length ? inicios.reduce((a, b) => (a < b ? a : b)) : null,
    ultimoCambio: cambios.length ? cambios.reduce((a, b) => (a > b ? a : b)) : null,
    demoUrl: demo,
    appUrl: app,
    fase2: stage === 'fase2' || vendida(up.fase2),
    nuevoSistema: stage === 'nuevo' || vendida(up.nuevo),
    plan: stage === 'plan' || stage === 'anual' || vendida(up.plan),
    tiendas: tiendasDe(p),
    tiendasUrl: tiendasUrlDe(p, propio),
    // Interno: Speed Funnels sólo lo devuelve a quien ve lo interno (Manuel), nunca a un closer.
    interno: { desarrollador: clip(extra.desarrollador, 60) || null },
  }
}
