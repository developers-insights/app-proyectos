import { QUESTIONS, BLOCKS } from './questions.js'

export const OTHER = 'otro'

const SECONDS = { single: 11, multi: 16, scale: 8, text: 30 }

export const visibleQuestions = (answers = {}) => QUESTIONS.filter((q) => !q.showIf || q.showIf(answers))

export const otherKey = (q) => `${q.id}_otro`

export function isAnswered(q, answers = {}) {
  const v = answers[q.id]
  if (q.type === 'text') return typeof v === 'string' && v.trim().length > 0
  if (q.type === 'scale') return typeof v === 'number'
  if (q.type === 'multi') return Array.isArray(v) && v.length > 0
  return typeof v === 'string' && v.length > 0
}

/* "Otra" elegida sin escribir cuál cuenta como no respondida: si no, la respuesta no dice nada. */
export function canAdvance(q, answers = {}) {
  if (q.optional) return true
  if (!isAnswered(q, answers)) return false
  const v = answers[q.id]
  const pickedOther = q.type === 'multi' ? v.includes(OTHER) : v === OTHER
  if (pickedOther) return typeof answers[otherKey(q)] === 'string' && answers[otherKey(q)].trim().length > 0
  return true
}

/* Mientras no contestó si miró YouTube, la pregunta condicional cuenta: el índice no se
   corre porque esa condición siempre está antes de la pregunta que depende de ella. */
export function minutesLeft(fromIndex, answers = {}) {
  const rest = visibleQuestions({ youtube: 'algunos', ...answers }).slice(fromIndex)
  const s = rest.reduce((acc, q) => acc + (SECONDS[q.type] || 12), 0)
  return Math.max(1, Math.round(s / 60))
}

export const totalMinutes = () => minutesLeft(0)

/* Respuestas de preguntas que quedaron ocultas (ej.: contestó tipos de video y después
   volvió y puso que no miró YouTube) no se mandan: contaminan el resumen. */
export function pruneAnswers(answers = {}) {
  const keep = new Set()
  visibleQuestions(answers).forEach((q) => { keep.add(q.id); keep.add(otherKey(q)) })
  const out = {}
  Object.entries(answers).forEach(([k, v]) => {
    if (!keep.has(k)) return
    if (typeof v === 'string' && !v.trim()) return
    if (Array.isArray(v) && !v.length) return
    out[k] = typeof v === 'string' ? v.slice(0, 2000) : v
  })
  return out
}

export function firstUnanswered(answers = {}) {
  const qs = visibleQuestions(answers)
  const i = qs.findIndex((q) => !isAnswered(q, answers) && !q.optional)
  return i === -1 ? qs.length - 1 : i
}

export function toggleMulti(current, id, max) {
  const list = Array.isArray(current) ? current : []
  if (list.includes(id)) return { value: list.filter((x) => x !== id), blocked: false }
  if (max && list.length >= max) return { value: list, blocked: true }
  return { value: [...list, id], blocked: false }
}

export function blockProgress(index, answers = {}) {
  const qs = visibleQuestions(answers)
  const cur = qs[index]
  return BLOCKS.map((b) => {
    const inBlock = qs.filter((q) => q.block === b.id)
    const pos = inBlock.indexOf(cur)
    const before = qs.indexOf(inBlock[0]) > index
    if (pos === -1) return { id: b.id, fill: before ? 0 : 1 }
    return { id: b.id, fill: pos / inBlock.length }
  })
}

export function npsScore(values) {
  const n = values.length
  if (!n) return null
  const pro = values.filter((v) => v >= 9).length
  const det = values.filter((v) => v <= 6).length
  return Math.round(((pro - det) / n) * 100)
}

/* Resumen por pregunta para el equipo. `rows`: [{ answers, label }]. Sólo cuenta filas que
   contestaron esa pregunta, así el porcentaje no se diluye con encuestas a medias. */
export function aggregate(rows, lang = 'es') {
  return QUESTIONS.map((q) => {
    const base = { id: q.id, block: q.block, type: q.type, q: q[lang].q, max: q.max }
    const answered = rows.filter((r) => isAnswered(q, r.answers || {}))
    if (q.type === 'text') {
      return { ...base, n: answered.length, texts: answered.map((r) => ({ label: r.label, text: r.answers[q.id].trim() })) }
    }
    if (q.type === 'scale') {
      const values = answered.map((r) => r.answers[q.id])
      const dist = []
      for (let v = q.min; v <= q.max; v++) dist.push({ value: v, count: values.filter((x) => x === v).length })
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
      return { ...base, n: values.length, avg, dist, nps: q.id === 'nps' ? npsScore(values) : null, low: q[lang].low, high: q[lang].high }
    }
    const counts = new Map((q.options || []).map((op) => [op.id, 0]))
    if (q.other) counts.set(OTHER, 0)
    const others = []
    answered.forEach((r) => {
      const v = r.answers[q.id]
      const picks = Array.isArray(v) ? v : [v]
      picks.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1))
      const ot = r.answers[otherKey(q)]
      if (picks.includes(OTHER) && typeof ot === 'string' && ot.trim()) others.push({ label: r.label, text: ot.trim() })
    })
    const labelOf = (id) => {
      if (id === OTHER) return lang === 'en' ? 'Other' : 'Otra'
      const op = (q.options || []).find((x) => x.id === id)
      return op ? op[lang] : id
    }
    const options = [...counts.entries()]
      .map(([id, count]) => ({ id, label: labelOf(id), count, pct: answered.length ? count / answered.length : 0 }))
      .sort((a, b) => b.count - a.count)
    return { ...base, n: answered.length, options, others }
  })
}

export function surveyStatus(row) {
  if (!row) return 'none'
  if (row.completed_at) return 'done'
  if ((row.answered || 0) > 0) return 'progress'
  if (row.opened_at) return 'opened'
  return 'sent'
}

export const surveyLink = (origin, token) => `${origin}/?encuesta=${encodeURIComponent(token)}`

export function inviteMessage({ lang, contact, link }) {
  const name = (contact || '').trim().split(/\s+/)[0]
  if (lang === 'en') {
    return `Hi${name ? ` ${name}` : ''}! Quick favor: we put together a short survey (about 6 minutes, from your phone) to understand how you found us and what you care about. It really helps us. Here it is: ${link}`
  }
  return `¡Hola${name ? ` ${name}` : ''}! Te pido una mano: armamos una encuesta cortita (unos 6 minutos, desde el celu) para entender cómo llegaste a nosotros y qué te interesa. Nos sirve muchísimo. Acá va: ${link}`
}
