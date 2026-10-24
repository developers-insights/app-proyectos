/*
 * Lo que viaja a Speed Funnels por `sf-puente`: una foto por proyecto de cliente
 * con lo que el closer necesita para cobrar y para ofrecer (etapa, tramo y días,
 * avance, próximo hito, upsell, candidato a oferta y notas para el closer) y lo
 * mínimo para emparejarlo con su venta (nombre, empresa, mail y teléfono del
 * cliente). Nada de credenciales, presupuestos ni notas internas.
 *
 * Puro y con `now` inyectable: lo corre la edge function y lo corren los tests.
 * Recibe las filas tal cual salen de las tablas por-fila (`{ id, data }`).
 */

import { journeyEntry, laneMeta, offerCandidates, upsellState, upsellStatusMeta, offerLabel } from './journey.js'
import { stageMeta } from './stages.js'
import { projectProgress } from './progress.js'
import { planBoardSummary, currentWeekNumber, hitoForWeek } from '../plan/planModel.js'
import { openCloserNotes } from './closerNotes.js'

export const APP_URL = 'https://proyectos.insightsapps.tech'

const unrow = (r) => (r && typeof r === 'object' ? { ...(r.data && typeof r.data === 'object' ? r.data : {}), id: r.id } : null)
const live = (r) => r && !r.deleted_at

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function nextMilestone(plan) {
  if (!plan) return null
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : []
  const n = currentWeekNumber(plan)
  const summary = planBoardSummary(plan)
  if (n == null && !summary.nextFecha) return null
  const w = weeks.find((x) => x && x.n === n) || null
  const h = n != null ? hitoForWeek(plan, n) : null
  const stageName = h && h.id !== '_neutral' ? clip(h.title || h.label, 80) : ''
  return {
    week: n,
    weeks: weeks.length,
    title: clip(w && w.title, 120) || null,
    stage: stageName || null,
    deliver: clip(w && w.deliver && w.deliver.text, 160) || null,
    date: summary.nextFecha || null,
  }
}

const upsellOut = (e) => (e ? {
  status: e.status,
  label: upsellStatusMeta(e.status).label,
  at: e.at,
  note: clip(e.note, 300) || null,
} : null)

export function buildBridgeSnapshots({ projects = [], clients = [], plans = [], team = [] } = {}, now = new Date(), opts = {}) {
  const appUrl = (opts.appUrl || APP_URL).replace(/\/+$/, '')
  const clientById = new Map(clients.filter(live).map(unrow).filter(Boolean).map((c) => [c.id, c]))
  const planById = new Map(plans.filter(live).map(unrow).filter(Boolean).map((p) => [p.id, p]))
  const nameOf = new Map(team.filter(live).map(unrow).filter(Boolean).map((u) => [u.id, clip(u.name, 60)]))

  const list = projects.filter(live).map(unrow).filter((p) => p && (p.kind || 'cliente') !== 'interno')
  const planOf = (p) => (p.planId ? planById.get(p.planId) || null : null)
  const ctx = {
    planTotal: (p) => planBoardSummary(planOf(p)).total,
    pct: (p) => projectProgress(p, planOf(p)),
  }
  const offers = new Map(offerCandidates(list, ctx, now, opts.thresholds).map((o) => [o.projectId, o]))

  return list.map((p) => {
    const c = clientById.get(p.clientId) || {}
    const entry = journeyEntry(p, ctx, now, opts.thresholds)
    const up = upsellState(p)
    const o = offers.get(p.id)
    const stage = stageMeta(entry.stage)
    return {
      id: p.id,
      name: clip(p.name, 120),
      client: {
        name: clip(c.name, 120),
        company: clip(c.company, 120),
        email: clip(c.email, 160).toLowerCase(),
        phone: clip(c.phone, 40),
      },
      stage: entry.stage,
      stageLabel: stage.label,
      lane: entry.lane,
      laneLabel: entry.lane ? laneMeta(entry.lane).label : null,
      days: entry.days,
      remaining: entry.remaining,
      limit: entry.limit,
      since: entry.since,
      pct: entry.pct == null ? null : Math.round(entry.pct),
      milestone: nextMilestone(planOf(p)),
      alerts: entry.alerts.map((a) => ({ level: a.level, text: a.text })),
      upsell: { plan: upsellOut(up.plan), fase2: upsellOut(up.fase2), objections: clip(up.objections, 600) || null },
      offer: o ? { kind: o.kind, reason: o.reason, offers: o.offers, offerLabels: o.offers.map(offerLabel), urgency: o.urgency, declined: o.declined } : null,
      notes: openCloserNotes(p).map((n) => ({ id: n.id, text: n.text, at: n.at, by: n.by ? nameOf.get(n.by) || null : null })),
      url: `${appUrl}/?proyecto=${encodeURIComponent(p.id)}`,
      updatedAt: p.updatedAt || null,
    }
  })
}
