/*
 * Recorrido del cliente (pedido de Fede, call del 23/10): en qué tramo está cada
 * cliente, cuántos días lleva ahí, qué alerta pide atención y a quién conviene
 * ofrecerle el plan mensual o la Fase 2.
 *
 * Todo sale de datos que ya existen (etapa, lifecycle, tiendas, plan) más
 * `project.upsell`, que vive en el JSON del proyecto como `stores`: sin migración.
 * Puro y con `now` inyectable, como lifecycle.js.
 */

import { normalizeLifecycle, phaseInfo, daysBetween, toDate } from './lifecycle.js'
import { projectStage, stageMeta } from './stages.js'
import { storesSummary } from './stores.js'

export const JOURNEY_LANES = [
  { key: 'onboarding', label: 'Onboarding', colorVar: '--text-dim' },
  { key: 'mvp', label: 'MVP', colorVar: '--accent' },
  { key: 'prueba', label: '30 días gratis', colorVar: '--blue' },
  { key: 'plan', label: 'Plan mensual', colorVar: '--green', branch: true },
  { key: 'fase2', label: 'Fase 2', colorVar: '--violet', branch: true },
  { key: 'standby', label: 'Stand-by', colorVar: '--yellow', branch: true },
]

export const laneMeta = (key) => JOURNEY_LANES.find((l) => l.key === key) || JOURNEY_LANES[1]

export const DEFAULT_THRESHOLDS = {
  mvpWarnDays: 90,
  devMaxDays: 120,
  storesMaxDays: 15,
  standbyMaxDays: 30,
  offerLeadDays: 7,
  offerPct: 85,
}

export const THRESHOLD_FIELDS = [
  { key: 'mvpWarnDays', label: 'MVP largo', unit: 'días', hint: 'Aviso amarillo: el MVP debería durar de 1 a 3 meses' },
  { key: 'devMaxDays', label: 'Desarrollo demorado', unit: 'días', hint: 'Alerta roja: más de 4 meses en desarrollo' },
  { key: 'storesMaxDays', label: 'Trámite en tiendas', unit: 'días', hint: 'Google Play o App Store en trámite' },
  { key: 'standbyMaxDays', label: 'Stand-by', unit: 'días', hint: 'Pausado o terminado sin plan' },
  { key: 'offerLeadDays', label: 'Ofrecer antes del fin de la prueba', unit: 'días', hint: 'Cuándo entra a "Para ofrecer"' },
]

export function normalizeThresholds(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const [k, def] of Object.entries(DEFAULT_THRESHOLDS)) {
    const n = Math.round(Number(r[k]))
    out[k] = Number.isFinite(n) && n > 0 ? Math.min(3650, n) : def
  }
  return out
}

const isClientProject = (p) => !!p && (p.kind || 'cliente') !== 'interno'

const legacyProgress = (p) => {
  const n = Number(p && p.progress)
  return Number.isFinite(n) ? n : 0
}

function readCtx(ctx, project) {
  const c = ctx || {}
  const total = typeof c.planTotal === 'function' ? c.planTotal(project) : undefined
  const pct = typeof c.pct === 'function' ? c.pct(project) : undefined
  return {
    planTotal: Number.isFinite(Number(total)) ? Number(total) : undefined,
    pct: Number.isFinite(Number(pct)) ? Number(pct) : undefined,
  }
}

/*
 * Onboarding = Desarrollo sin ninguna tarea de plan y sin avance heredado. Si el
 * total del plan no se conoce (planes cargando), se asume MVP: mover a alguien
 * de tramo por un dato que todavía no llegó sería peor que no distinguirlo.
 */
export function journeyLane(project, ctx) {
  const stage = projectStage(project)
  if (stage === 'cancelado') return null
  if (stage === 'pausado' || stage === 'finalizado') return 'standby'
  if (stage === 'fase2') return 'fase2'
  if (stage === 'free') return 'prueba'
  if (stageMeta(stage).phase === 3) return 'plan'
  const { planTotal } = readCtx(ctx, project)
  if (planTotal === 0 && legacyProgress(project) <= 0) return 'onboarding'
  return 'mvp'
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export function journeyEntry(project, ctx, now = new Date(), thresholds) {
  const t = normalizeThresholds(thresholds)
  const lane = journeyLane(project, ctx)
  const stage = projectStage(project)
  const lc = normalizeLifecycle(project)
  const { pct } = readCtx(ctx, project)
  const base = { projectId: project && project.id, lane, stage, pct: pct ?? null, days: null, since: null, remaining: null, limit: null, alerts: [] }
  if (!lane) return base

  const since = (v) => (toDate(v) ? toDate(v).toISOString() : null)
  const elapsed = (v) => {
    const d = daysBetween(v, now)
    return d == null ? null : Math.max(0, d)
  }
  let entry = base

  if (lane === 'onboarding' || lane === 'mvp' || lane === 'fase2') {
    const anchor = lane === 'fase2' ? (lc.devAt || project.stageAt || lc.startedAt) : (lc.devAt || lc.startedAt)
    entry = { ...base, since: since(anchor), days: elapsed(anchor), limit: t.devMaxDays }
  } else if (lane === 'prueba') {
    const info = phaseInfo(project, now)
    entry = { ...base, since: since(lc.phase2At || lc.startedAt), days: info.days, remaining: info.remaining, limit: lc.trialDays }
  } else if (lane === 'plan') {
    entry = { ...base, since: since(lc.phase3At), days: elapsed(lc.phase3At) }
  } else if (lane === 'standby') {
    entry = { ...base, since: since(project.stageAt), days: elapsed(project.stageAt), limit: t.standbyMaxDays }
  }

  return { ...entry, alerts: journeyAlerts(project, entry, now, t) }
}

function journeyAlerts(project, entry, now, t) {
  const out = []
  const { lane, days, remaining, pct } = entry
  const inDev = lane === 'mvp' || lane === 'onboarding' || lane === 'fase2'
  const what = lane === 'fase2' ? 'Fase 2' : 'desarrollo'

  if (inDev && days != null) {
    if (days > t.devMaxDays) {
      out.push({ key: 'dev', level: 'crit', text: `${plural(days, 'día', 'días')} en ${what}: pasó los ${t.devMaxDays}`, short: `Pasó los ${t.devMaxDays} días` })
    } else if (days > t.mvpWarnDays) {
      out.push({ key: 'dev', level: 'warn', text: `${plural(days, 'día', 'días')} en ${what}: pasó los ${t.mvpWarnDays}`, short: `Pasó los ${t.mvpWarnDays} días` })
    }
  }
  if (lane === 'mvp' && pct != null && pct >= 100) {
    out.push({ key: 'done', level: 'warn', text: 'El plan está al 100%: falta pasarlo a los 30 días gratis', short: 'Plan al 100%: pasar a la prueba' })
  }
  if (lane === 'prueba' && remaining != null && remaining < 0) {
    out.push({ key: 'trial', level: 'crit', text: `La prueba venció hace ${plural(-remaining, 'día', 'días')} y no tiene plan`, short: 'Prueba vencida' })
  }
  if (lane === 'standby' && days != null && days > t.standbyMaxDays) {
    out.push({ key: 'standby', level: 'warn', text: `${plural(days, 'día', 'días')} en stand-by`, short: `Más de ${t.standbyMaxDays} días parado` })
  }
  for (const s of storesSummary(project, now).deploying) {
    if (s.days != null && s.days > t.storesMaxDays) {
      out.push({ key: `store-${s.key}`, level: s.days > t.storesMaxDays * 2 ? 'crit' : 'warn', text: `${s.label} en trámite hace ${plural(s.days, 'día', 'días')}`, short: `${s.label}: ${s.days} d en trámite` })
    }
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'crit' ? -1 : 1))
}

export const alertLevel = (alerts) => (alerts.some((a) => a.level === 'crit') ? 'crit' : alerts.length ? 'warn' : null)

/* ─── Notas de upsell ─────────────────────────────────────────────────────── */

export const UPSELL_OFFERS = [
  { key: 'plan', label: 'Plan mensual' },
  { key: 'fase2', label: 'Fase 2' },
]

export const UPSELL_STATUS = [
  { key: 'ofrecido', label: 'Ofrecido', colorVar: '--accent' },
  { key: 'acepta', label: 'Acepta', colorVar: '--green' },
  { key: 'paga', label: 'Paga', colorVar: '--green' },
  { key: 'no_quiere', label: 'No quiere', colorVar: '--red' },
]

export const offerLabel = (k) => (UPSELL_OFFERS.find((o) => o.key === k) || UPSELL_OFFERS[0]).label
export const upsellStatusMeta = (k) => UPSELL_STATUS.find((s) => s.key === k) || UPSELL_STATUS[0]

const isoOrNull = (v) => {
  const d = toDate(v)
  return d && d.getFullYear() >= 2000 ? d.toISOString() : null
}
const str = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')

function normalizeEntry(e) {
  if (!e || typeof e !== 'object') return null
  if (!UPSELL_OFFERS.some((o) => o.key === e.offer)) return null
  const status = UPSELL_STATUS.some((s) => s.key === e.status) ? e.status : 'ofrecido'
  return {
    id: typeof e.id === 'string' && e.id ? e.id : null,
    offer: e.offer,
    status,
    at: isoOrNull(e.at),
    by: typeof e.by === 'string' && e.by ? e.by : null,
    payDay: status === 'paga' ? isoOrNull(e.payDay) : null,
    note: str(e.note),
  }
}

const byDateDesc = (a, b) => (b.at || '').localeCompare(a.at || '')

export function normalizeUpsell(project) {
  const raw = project && project.upsell && typeof project.upsell === 'object' && !Array.isArray(project.upsell) ? project.upsell : {}
  const list = Array.isArray(raw.entries) ? raw.entries : []
  const entries = list.map(normalizeEntry).filter(Boolean)
    .map((e, i) => (e.id ? e : { ...e, id: `legacy-${i}` }))
    .sort(byDateDesc)
  return { entries, objections: str(raw.objections, 4000) }
}

export function upsellState(project) {
  const u = normalizeUpsell(project)
  const latest = (k) => u.entries.find((e) => e.offer === k) || null
  return { plan: latest('plan'), fase2: latest('fase2'), objections: u.objections, entries: u.entries }
}

const newId = () => `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export function addUpsellEntry(project, input, now = new Date()) {
  const u = normalizeUpsell(project)
  const e = normalizeEntry({ ...input, at: input && input.at ? input.at : now.toISOString() })
  if (!e) return { upsell: u }
  return { upsell: { ...u, entries: [{ ...e, id: e.id || newId() }, ...u.entries].sort(byDateDesc) } }
}

export function removeUpsellEntry(project, id) {
  const u = normalizeUpsell(project)
  return { upsell: { ...u, entries: u.entries.filter((e) => e.id !== id) } }
}

export function setUpsellObjections(project, text) {
  return { upsell: { ...normalizeUpsell(project), objections: str(text, 4000) } }
}

export function upsellLine(entry, now = new Date()) {
  if (!entry) return ''
  const status = upsellStatusMeta(entry.status).label.toLowerCase()
  const d = entry.at ? daysBetween(entry.at, now) : null
  const when = d == null ? '' : d <= 0 ? ' · hoy' : d === 1 ? ' · ayer' : ` · hace ${d} d`
  return `${offerLabel(entry.offer)}: ${status}${when}`
}

/* ─── Para ofrecer ────────────────────────────────────────────────────────── */

const CLOSED = new Set(['acepta', 'paga'])

/*
 * Candidatos a recibir la oferta del plan mensual o de la Fase 2. Es lo que va a
 * leer el puente con Speed Funnels para avisarle al closer: por eso devuelve datos
 * planos y no depende de React.
 *   prueba  → le quedan offerLeadDays o menos (o ya venció)
 *   mvp     → el plan pasó offerPct (un MVP trabado no está por terminar)
 *   sin_plan→ Finalizado: terminó el desarrollo sin mantenimiento vendido
 * Sale de la lista si ya aceptó o paga todo lo que se le ofrecería. Si dijo que
 * no, queda (con `declined`) al final: la objeción es justo lo que hay que leer.
 */
export function offerCandidates(projects, ctx, now = new Date(), thresholds) {
  const t = normalizeThresholds(thresholds)
  const out = []
  for (const p of Array.isArray(projects) ? projects : []) {
    if (!isClientProject(p)) continue
    const entry = journeyEntry(p, ctx, now, t)
    let kind = null, reason = '', offers = [], urgency = 0
    if (entry.lane === 'prueba' && entry.remaining != null && entry.remaining <= t.offerLeadDays) {
      kind = 'prueba'
      offers = ['plan', 'fase2']
      urgency = entry.remaining < 0 ? 3 : 2
      reason = entry.remaining < 0
        ? `La prueba venció hace ${plural(-entry.remaining, 'día', 'días')}`
        : entry.remaining === 0 ? 'Hoy es el último día de prueba' : `Le ${entry.remaining === 1 ? 'queda' : 'quedan'} ${plural(entry.remaining, 'día', 'días')} de prueba`
    } else if (entry.lane === 'mvp' && entry.pct != null && entry.pct >= t.offerPct) {
      kind = 'mvp'
      offers = ['plan', 'fase2']
      urgency = 1
      reason = `El MVP está al ${Math.round(entry.pct)}%`
    } else if (entry.stage === 'finalizado') {
      kind = 'sin_plan'
      offers = ['plan']
      urgency = 1
      reason = 'Terminó el desarrollo sin mantenimiento'
    }
    if (!kind) continue
    const up = upsellState(p)
    const open = offers.filter((k) => !(up[k] && CLOSED.has(up[k].status)))
    if (!open.length) continue
    const declined = open.every((k) => up[k] && up[k].status === 'no_quiere')
    out.push({
      projectId: p.id, name: p.name || '', clientId: p.clientId || null,
      kind, reason, offers: open, urgency, declined,
      lane: entry.lane, days: entry.days, remaining: entry.remaining,
      upsell: { plan: up.plan, fase2: up.fase2 }, objections: up.objections,
    })
  }
  return out.sort((a, b) =>
    (a.declined - b.declined) ||
    (b.urgency - a.urgency) ||
    ((a.remaining ?? 9999) - (b.remaining ?? 9999)) ||
    ((b.days ?? 0) - (a.days ?? 0)))
}

/* ─── Tablero completo ────────────────────────────────────────────────────── */

export function journeyBoard(projects, ctx, now = new Date(), thresholds) {
  const t = normalizeThresholds(thresholds)
  const lanes = Object.fromEntries(JOURNEY_LANES.map((l) => [l.key, []]))
  const out = []
  const alerts = []
  for (const p of Array.isArray(projects) ? projects : []) {
    if (!isClientProject(p)) continue
    const e = journeyEntry(p, ctx, now, t)
    if (!e.lane) { out.push({ project: p, entry: e }); continue }
    lanes[e.lane].push({ project: p, entry: e })
    for (const a of e.alerts) alerts.push({ ...a, projectId: p.id, project: p, lane: e.lane })
  }
  for (const k of Object.keys(lanes)) {
    lanes[k].sort((a, b) => ((b.entry.days ?? -1) - (a.entry.days ?? -1)) || String(a.project.name || '').localeCompare(String(b.project.name || '')))
  }
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'crit' ? -1 : 1))
  const total = Object.values(lanes).reduce((n, l) => n + l.length, 0)
  return { lanes, out, alerts, total, offers: offerCandidates(projects, ctx, now, t), thresholds: t }
}

/* ─── Marcas del mapa (call del 26/10) ────────────────────────────────────── */

/*
 * Lo que ya se le ofreció o aceptó a un proyecto que todavía está en otro tramo.
 * "No quiere" no lleva marca: ya figura en "Para ofrecer" con su objeción, y una
 * marca roja más por card ensucia el mapa. Si el proyecto ya está en el tramo de
 * esa oferta, la marca sobra.
 */
export function upsellBadges(project, lane) {
  const up = upsellState(project)
  const out = []
  for (const k of ['fase2', 'plan']) {
    const e = up[k]
    if (!e || lane === k) continue
    if (e.status === 'ofrecido') out.push({ offer: k, status: 'ofrecido', label: k === 'fase2' ? 'F2 ofrecida' : 'Plan ofrecido', entry: e })
    else if (CLOSED.has(e.status)) out.push({ offer: k, status: 'acepta', label: k === 'fase2' ? 'F2 aceptada' : 'Plan aceptado', entry: e })
  }
  return out
}

export function fase2Offered(board) {
  const out = []
  for (const l of JOURNEY_LANES) {
    if (l.key === 'fase2') continue
    for (const it of (board && board.lanes && board.lanes[l.key]) || []) {
      const e = upsellState(it.project).fase2
      if (e && e.status === 'ofrecido') out.push({ project: it.project, lane: l.key, entry: e })
    }
  }
  return out.sort((a, b) => byDateDesc(a.entry, b.entry) || String(a.project.name || '').localeCompare(String(b.project.name || '')))
}

export const LANE_CAP = 5

/* Con uno solo de más se muestra entero: el botón ocupa casi lo mismo que la card. */
export function capLane(items, expanded, cap = LANE_CAP) {
  const list = Array.isArray(items) ? items : []
  const long = list.length > cap + 1
  if (!long || expanded) return { visible: list, hidden: 0, collapsible: long }
  return { visible: list.slice(0, cap), hidden: list.length - cap, collapsible: false }
}

export const STANDBY_NOTE_MAX = 140

const cleanNote = (v) => str(v, 1000).replace(/\s+/g, ' ').trim().slice(0, STANDBY_NOTE_MAX)
export const standbyNote = (project) => cleanNote(project && project.standbyNote)
export const setStandbyNote = (project, text) => ({ standbyNote: cleanNote(text) })

export function laneAverage(items) {
  const ds = items.map((i) => i.entry.days).filter((d) => d != null)
  return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null
}

/* ─── Lienzo (Recorrido como esquema arrastrable) ─────────────────────────── */

export const CANVAS = { nodeW: 280, colGap: 76, rowGap: 48, head: 58, row: 46, why: 22, more: 40, empty: 50, pad: 10 }

/* Alto estimado de un tramo colapsado: sólo sirve para que el orden automático no
   encime nodos antes de que React Flow los mida. */
export function laneNodeHeight(items, laneKey, cap = LANE_CAP) {
  const list = Array.isArray(items) ? items : []
  const C = CANVAS
  if (!list.length) return C.head + C.empty + C.pad * 2
  const { visible, hidden } = capLane(list, false, cap)
  const whys = laneKey === 'standby' ? visible.filter((it) => standbyNote(it.project)).length : 0
  return C.head + visible.length * C.row + whys * C.why + (hidden > 0 ? C.more : 0) + C.pad * 2
}

/*
 * Izquierda a derecha como el recorrido real: Onboarding → MVP → 30 días → Fase 2
 * arriba y Plan mensual debajo. Stand-by cuelga debajo de 30 días (se sale del
 * camino) en vez de apilarse con los otros dos: así el lienzo queda más ancho que
 * alto y entra con un zoom legible en una notebook. Fase 2 a la altura del flujo
 * principal deja que la conexión punteada desde MVP pase por arriba de 30 días.
 */
export function canvasLayout(board) {
  const C = CANVAS
  const lanes = (board && board.lanes) || {}
  const h = (k) => laneNodeHeight(lanes[k], k)
  const col = (i) => i * (C.nodeW + C.colGap)
  return {
    onboarding: { x: col(0), y: 0 },
    mvp: { x: col(1), y: 0 },
    prueba: { x: col(2), y: 0 },
    fase2: { x: col(3), y: 0 },
    plan: { x: col(3), y: h('fase2') + C.rowGap },
    standby: { x: col(2), y: h('prueba') + C.rowGap },
  }
}

/* Posiciones guardadas sobre el orden automático: un tramo nuevo o un valor roto cae al automático. */
export function mergePositions(auto, saved) {
  const out = {}
  const s = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  for (const [k, p] of Object.entries(auto || {})) {
    const v = s[k]
    const ok = v && Number.isFinite(Number(v.x)) && Number.isFinite(Number(v.y)) && Math.abs(v.x) < 1e5 && Math.abs(v.y) < 1e5
    out[k] = ok ? { x: Math.round(Number(v.x)), y: Math.round(Number(v.y)) } : { ...p }
  }
  return out
}

/* Al buscar, lo que coincide sube dentro del tramo: así no queda escondido detrás de "Ver más". */
export function orderForSearch(items, matches) {
  const list = Array.isArray(items) ? items : []
  if (!matches) return list
  return [...list.filter((it) => matches.has(it.project.id)), ...list.filter((it) => !matches.has(it.project.id))]
}
