/*
 * Notas del servicio (pedido de Nacho, call del 26/10): lo que le saca a cada
 * cliente en el onboarding y en las calls. Viven en `project.serviceNotes`, dentro
 * del JSON del proyecto, sin migración. Son internas: no viajan por `sf-puente`
 * (eso es `closerNotes`) y no se mezclan con ellas.
 */

export const SERVICE_NOTE_TYPES = [
  { key: 'onboarding', label: 'Onboarding', tone: 'violet' },
  { key: 'call', label: 'Call', tone: 'accent' },
  { key: 'motivo', label: 'Por qué compró', tone: 'yellow' },
  { key: 'consumo', label: 'Qué consume', tone: 'green' },
  { key: 'idea', label: 'Idea / pedido', tone: 'blue' },
  { key: 'general', label: 'General', tone: 'neutral' },
]

export const ONBOARDING_PROMPTS = [
  { key: 'porQueAhora', label: 'Por qué ahora y no antes', hint: 'Qué pasó que lo hizo agendar' },
  { key: 'freno', label: 'Qué lo frenaba antes', hint: 'Plata, tiempo, miedo, no saber por dónde empezar…' },
  { key: 'consume', label: 'Qué contenido consume', hint: 'YouTube, Instagram, podcasts. ¿Ya vibecodea?' },
  { key: 'referentes', label: 'Referentes de IA', hint: 'A quién sigue, a quién le cree' },
  { key: 'llegoIA', label: 'Cómo llegó a la IA', hint: 'Primer contacto, qué usa hoy' },
  { key: 'futuro', label: 'Qué espera a futuro', hint: 'Fase 2, mantenimiento, otras ideas' },
]

export const SERVICE_NOTE_MAX = 8000
export const SERVICE_ANSWER_MAX = 2000
const PURGE_AFTER_DAYS = 30

const TYPE_KEYS = new Set(SERVICE_NOTE_TYPES.map((t) => t.key))
const PROMPT_KEYS = ONBOARDING_PROMPTS.map((p) => p.key)

export const noteType = (key) => SERVICE_NOTE_TYPES.find((t) => t.key === key) || SERVICE_NOTE_TYPES[SERVICE_NOTE_TYPES.length - 1]

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const iso = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d.toISOString()
}

const idStr = (v) => (typeof v === 'string' && v ? v : null)

function cleanAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const k of PROMPT_KEYS) {
    const v = str(raw[k], SERVICE_ANSWER_MAX)
    if (v) out[k] = v
  }
  return out
}

export function noteHasContent(n) {
  return !!(n && (str(n.text, SERVICE_NOTE_MAX) || Object.keys(cleanAnswers(n.answers)).length))
}

export function normalizeServiceNote(n) {
  if (!n || typeof n !== 'object' || !noteHasContent(n)) return null
  const at = iso(n.at)
  return {
    id: idStr(n.id),
    type: TYPE_KEYS.has(n.type) ? n.type : 'general',
    text: str(n.text, SERVICE_NOTE_MAX),
    answers: cleanAnswers(n.answers),
    pinned: n.pinned === true,
    at,
    updatedAt: iso(n.updatedAt) || at,
    by: idStr(n.by),
    editedBy: idStr(n.editedBy),
    deletedAt: iso(n.deletedAt),
  }
}

const byPinThenDate = (a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.at || '').localeCompare(a.at || '')

function allNotes(project) {
  const raw = project && Array.isArray(project.serviceNotes) ? project.serviceNotes : []
  return raw.map((r, i) => {
    const n = normalizeServiceNote(r)
    return n && !n.id ? { ...n, id: `legacy-${i}` } : n
  }).filter(Boolean)
}

export function serviceNotesOf(project) {
  return allNotes(project).filter((n) => !n.deletedAt).sort(byPinThenDate)
}

// Lo borrado queda un mes por si alguien se arrepiente tarde; después se suelta
// para que el JSON del proyecto no crezca para siempre.
function prune(notes, now) {
  const limit = now.getTime() - PURGE_AFTER_DAYS * 86400000
  return notes.filter((n) => !n.deletedAt || new Date(n.deletedAt).getTime() > limit)
}

const write = (notes, now) => ({ serviceNotes: prune(notes, now) })

export const newServiceNoteId = () => `sn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export function addServiceNote(project, input, now = new Date()) {
  const notes = allNotes(project)
  const n = normalizeServiceNote({ ...input, at: now.toISOString(), updatedAt: now.toISOString(), deletedAt: null, editedBy: null })
  if (!n) return write(notes, now)
  const id = idStr(input && input.id) || newServiceNoteId()
  return write([{ ...n, id }, ...notes.filter((x) => x.id !== id)], now)
}

export function updateServiceNote(project, id, changes, by = null, now = new Date()) {
  const notes = allNotes(project)
  return write(notes.map((n) => {
    if (n.id !== id) return n
    const next = normalizeServiceNote({ ...n, ...changes, id: n.id, at: n.at })
    if (!next) return n
    return { ...next, updatedAt: now.toISOString(), editedBy: by }
  }), now)
}

export function setServiceNotePinned(project, id, pinned, now = new Date()) {
  return write(allNotes(project).map((n) => (n.id === id ? { ...n, pinned: !!pinned } : n)), now)
}

export function deleteServiceNote(project, id, now = new Date()) {
  return write(allNotes(project).map((n) => (n.id === id && !n.deletedAt ? { ...n, deletedAt: now.toISOString() } : n)), now)
}

export function restoreServiceNote(project, id, now = new Date()) {
  return write(allNotes(project).map((n) => (n.id === id ? { ...n, deletedAt: null } : n)), now)
}

export const foldText = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function noteSearchText(n) {
  const answers = ONBOARDING_PROMPTS.map((p) => (n.answers[p.key] ? `${p.label} ${n.answers[p.key]}` : '')).join(' ')
  return foldText(`${noteType(n.type).label} ${n.text} ${answers}`)
}

const terms = (query) => foldText(query).split(/\s+/).filter(Boolean)

export function noteMatches(n, query) {
  const t = terms(query)
  if (!t.length) return true
  const hay = noteSearchText(n)
  return t.every((w) => hay.includes(w))
}

export function noteSnippet(n, max = 140) {
  const first = n.text || ONBOARDING_PROMPTS.map((p) => n.answers[p.key]).find(Boolean) || ''
  const flat = first.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export function matchSnippet(n, query, max = 140) {
  const t = terms(query)
  if (!t.length) return noteSnippet(n, max)
  const fields = [n.text, ...ONBOARDING_PROMPTS.map((p) => n.answers[p.key])].filter(Boolean)
  const hit = fields.find((f) => t.some((w) => foldText(f).includes(w)))
  if (!hit) return noteSnippet(n, max)
  const flat = hit.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const at = Math.max(0, t.map((w) => foldText(flat).indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] - 30)
  const cut = flat.slice(at, at + max - 2).trim()
  return `${at > 0 ? '…' : ''}${cut}${at + max - 2 < flat.length ? '…' : ''}`
}

export const answeredCount = (n) => Object.keys(n.answers || {}).length

/*
 * Una fila por proyecto para la columna de la izquierda. Con búsqueda, entra el
 * proyecto si coincide su nombre o el del cliente (y entonces se ven todas sus
 * notas) o si alguna nota coincide (y se ven sólo esas).
 */
export function notesIndex(projects = [], clients = [], { query = '', type = 'all' } = {}) {
  const clientOf = new Map((clients || []).map((c) => [c.id, c]))
  const q = terms(query)
  const rows = []
  for (const project of projects || []) {
    if (!project || !project.id) continue
    const client = clientOf.get(project.clientId) || null
    const notes = serviceNotesOf(project)
    const typed = type === 'all' ? notes : notes.filter((n) => n.type === type)
    const nameHay = foldText(`${project.name || ''} ${client?.name || ''} ${client?.company || ''}`)
    const nameHit = q.length > 0 && q.every((w) => nameHay.includes(w))
    const shown = q.length === 0 || nameHit ? typed : typed.filter((n) => noteMatches(n, query))
    if (q.length > 0 && !nameHit && shown.length === 0) continue
    if (q.length === 0 && type !== 'all' && typed.length === 0) continue
    const last = notes.reduce((acc, n) => ((n.at || '') > (acc?.at || '') ? n : acc), null)
    rows.push({ project, client, notes, shown, count: notes.length, last, nameHit })
  }
  return rows.sort((a, b) =>
    (b.last?.at || '').localeCompare(a.last?.at || '') ||
    (a.project.name || '').localeCompare(b.project.name || '', 'es'))
}

export function typeCounts(projects = []) {
  const out = { all: 0 }
  for (const t of SERVICE_NOTE_TYPES) out[t.key] = 0
  for (const p of projects || []) {
    for (const n of serviceNotesOf(p)) { out.all += 1; out[n.type] += 1 }
  }
  return out
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pad = (n) => String(n).padStart(2, '0')

export function noteWhen(at, now = new Date()) {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86400000)
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (diff === 0) return `hoy ${hm}`
  if (diff === 1) return `ayer ${hm}`
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''
  return `${d.getDate()} ${MES[d.getMonth()]}${year}`
}
