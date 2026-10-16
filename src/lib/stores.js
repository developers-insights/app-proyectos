/*
 * Despliegue en tiendas (Google Play / App Store). Corre EN PARALELO a la etapa:
 * el trámite de cuentas, ficha y revisión arranca antes de que el desarrollo
 * termine, así que vive en `project.stores` y nunca toca `stage` ni `lifecycle`
 * (de ahí sale el cobro). Va dentro del JSON del proyecto: no hay migración.
 * "Sin empezar" no se guarda; que falte la clave es el estado.
 */

import { daysBetween } from './lifecycle.js'

export const STORE_LIST = [
  { key: 'play', label: 'Google Play' },
  { key: 'apple', label: 'App Store' },
]

export const STORE_STATES = [
  { key: 'none', label: 'Sin empezar' },
  { key: 'tramite', label: 'En trámite' },
  { key: 'publicada', label: 'Publicada' },
]

export const STORE_FILTERS = [
  { key: 'all', label: 'Todas', short: 'Todas' },
  { key: 'tramite', label: 'Desplegando en tiendas', short: 'Desplegando' },
  { key: 'publicada', label: 'Publicadas en tiendas', short: 'Publicadas' },
]

export const isStoresFilter = (v) => v === 'tramite' || v === 'publicada'
export const storesFilterLabel = (key, short = false) => {
  const f = STORE_FILTERS.find((x) => x.key === key) || STORE_FILTERS[0]
  return short ? f.short : f.label
}
export const storeLabel = (key) => (STORE_LIST.find((s) => s.key === key) || { label: key }).label

const validIso = (v) => typeof v === 'string' && v !== '' && !Number.isNaN(new Date(v).getTime())
const storesOf = (project) => {
  const v = project && project.stores
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

export function storeEntry(project, key) {
  const raw = storesOf(project)[key]
  const status = raw && (raw.status === 'tramite' || raw.status === 'publicada') ? raw.status : 'none'
  if (status === 'none') return { status, startedAt: null, publishedAt: null }
  return {
    status,
    startedAt: validIso(raw.startedAt) ? raw.startedAt : null,
    publishedAt: status === 'publicada' && validIso(raw.publishedAt) ? raw.publishedAt : null,
  }
}

// Publicar conserva startedAt (queda cuánto tardó) y volver de Publicada a En
// trámite lo deja como estaba: un click equivocado no pierde datos. Solo
// "Sin empezar" borra las fechas, porque es el reinicio explícito.
export function applyStoreStatus(project, key, status, now = new Date()) {
  const current = storesOf(project)
  const prev = storeEntry(project, key)
  const stamp = now.toISOString()
  if (status === 'tramite') {
    return { stores: { ...current, [key]: { status, startedAt: prev.startedAt || stamp, publishedAt: null } } }
  }
  if (status === 'publicada') {
    return { stores: { ...current, [key]: { status, startedAt: prev.startedAt, publishedAt: stamp } } }
  }
  const { [key]: _gone, ...rest } = current
  return { stores: rest }
}

// Al tipear un <input type="date"> el año pasa por 0002, 0020, 0202…: sin este piso
// cada paso intermedio se guardaría como si fuera la fecha elegida.
const plausibleDay = (iso, now) => validIso(iso) && new Date(iso).getFullYear() >= 2000 && daysBetween(iso, now) >= 0

export function applyStoreDate(project, key, iso, now = new Date()) {
  const current = storesOf(project)
  const prev = storeEntry(project, key)
  if (prev.status === 'none' || !plausibleDay(iso, now)) return { stores: current }
  const field = prev.status === 'publicada' ? 'publishedAt' : 'startedAt'
  return { stores: { ...current, [key]: { ...prev, [field]: iso } } }
}

const pad = (n) => String(n).padStart(2, '0')

export function toDateInput(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Mediodía local: a medianoche UTC el día cambiaría según el huso de quien mira.
export function fromDateInput(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return null
  const d = new Date(`${v}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fmtDay(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''
  return `${d.getDate()} ${MES[d.getMonth()]}${year}`
}

export const agoText = (days) => (days == null ? '' : days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} d`)

export function storesSummary(project, now = new Date()) {
  const items = STORE_LIST.map((s) => {
    const e = storeEntry(project, s.key)
    const at = e.status === 'publicada' ? e.publishedAt : e.startedAt
    const days = at ? Math.max(0, daysBetween(at, now)) : null
    return { key: s.key, label: s.label, status: e.status, startedAt: e.startedAt, publishedAt: e.publishedAt, at, days }
  })
  const active = items.filter((i) => i.status !== 'none')
  const deploying = active.filter((i) => i.status === 'tramite')
  const published = active.filter((i) => i.status === 'publicada')
  // En trámite gana sobre Publicada: es lo que pide seguimiento.
  const phase = deploying.length ? 'tramite' : published.length ? 'publicada' : 'none'
  return { items, active, deploying, published, any: active.length > 0, phase }
}

export function storeStatusText(item, now = new Date()) {
  if (item.status === 'tramite') {
    return item.startedAt ? `en trámite desde el ${fmtDay(item.startedAt, now)} (${agoText(item.days)})` : 'en trámite'
  }
  if (item.status === 'publicada') {
    return item.publishedAt ? `publicada el ${fmtDay(item.publishedAt, now)}` : 'publicada'
  }
  return 'sin empezar'
}

export function storeShortLine(item, now = new Date()) {
  if (item.status === 'tramite') return item.startedAt ? `En trámite · ${agoText(item.days)}` : 'En trámite'
  if (item.status === 'publicada') return item.publishedAt ? `Publicada · ${fmtDay(item.publishedAt, now)}` : 'Publicada'
  return 'Sin empezar'
}

export function storesTitle(summary, now = new Date()) {
  if (!summary.any) return ''
  const head = summary.phase === 'tramite' ? 'Desplegando en tiendas' : 'Publicada en tiendas'
  return `${head} — ${summary.active.map((i) => `${i.label}: ${storeStatusText(i, now)}`).join(' · ')}`
}

export function storesLine(project, prefix = '', now = new Date()) {
  const s = storesSummary(project, now)
  return s.any ? `${prefix}${s.active.map((i) => `${i.label} ${storeStatusText(i, now)}`).join(' · ')}` : ''
}

export function storeCell(item, now = new Date()) {
  if (item.status === 'tramite') {
    return item.startedAt ? `En trámite desde ${fmtDay(item.startedAt, now)} (${agoText(item.days)})` : 'En trámite'
  }
  if (item.status === 'publicada') {
    if (!item.publishedAt) return 'Publicada'
    const took = item.startedAt ? daysBetween(item.startedAt, item.publishedAt) : null
    return `Publicada el ${fmtDay(item.publishedAt, now)}${took != null && took >= 0 ? ` (tardó ${took} d)` : ''}`
  }
  return '—'
}

export function storeActivityText(projectName, key, status) {
  const store = storeLabel(key)
  if (status === 'tramite') return `empezó el trámite de ${projectName} en ${store}`
  if (status === 'publicada') return `marcó ${projectName} como publicada en ${store}`
  return `sacó el trámite de ${store} de ${projectName}`
}

export function matchesStoresFilter(project, filter) {
  if (!isStoresFilter(filter)) return true
  const s = storesSummary(project)
  return filter === 'tramite' ? s.deploying.length > 0 : s.published.length > 0
}
