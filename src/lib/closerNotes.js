/*
 * Notas para el closer (pedido de Juan, call del 23/10): lo que Nacho aterriza
 * durante el servicio y el closer que le cobra a ese cliente tiene que saber ya.
 * Viven en el JSON del proyecto, como `upsell`: sin migración. Speed Funnels las
 * lee por `sf-puente` y le avisa al closer de la venta. Una nota resuelta deja
 * de viajar; nunca se borra, para que quede el historial.
 */

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const iso = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d.toISOString()
}

export const CLOSER_NOTE_MAX = 600

function normalizeNote(n) {
  if (!n || typeof n !== 'object') return null
  const text = str(n.text, CLOSER_NOTE_MAX)
  if (!text) return null
  return {
    id: typeof n.id === 'string' && n.id ? n.id : null,
    text,
    at: iso(n.at),
    by: typeof n.by === 'string' && n.by ? n.by : null,
    resolvedAt: iso(n.resolvedAt),
    resolvedBy: typeof n.resolvedBy === 'string' && n.resolvedBy ? n.resolvedBy : null,
  }
}

const byDateDesc = (a, b) => (b.at || '').localeCompare(a.at || '')

export function normalizeCloserNotes(project) {
  const raw = project && Array.isArray(project.closerNotes) ? project.closerNotes : []
  return raw.map(normalizeNote).filter(Boolean)
    .map((n, i) => (n.id ? n : { ...n, id: `legacy-${i}` }))
    .sort(byDateDesc)
}

export const openCloserNotes = (project) => normalizeCloserNotes(project).filter((n) => !n.resolvedAt)

const newId = () => `cn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export function addCloserNote(project, input, now = new Date()) {
  const notes = normalizeCloserNotes(project)
  const n = normalizeNote({ ...input, at: now.toISOString() })
  if (!n) return { closerNotes: notes }
  return { closerNotes: [{ ...n, id: newId(), resolvedAt: null, resolvedBy: null }, ...notes] }
}

export function resolveCloserNote(project, id, by = null, now = new Date()) {
  return {
    closerNotes: normalizeCloserNotes(project).map((n) =>
      n.id === id && !n.resolvedAt ? { ...n, resolvedAt: now.toISOString(), resolvedBy: by } : n),
  }
}

export function reopenCloserNote(project, id) {
  return {
    closerNotes: normalizeCloserNotes(project).map((n) =>
      n.id === id ? { ...n, resolvedAt: null, resolvedBy: null } : n),
  }
}
