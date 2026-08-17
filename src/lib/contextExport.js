/**
 * contextExport.js — arma un snapshot en Markdown de TODA la operación de la
 * agencia a partir del estado en vivo de la app (proyectos, clientes, equipo,
 * planes, actividad). Pensado para cargarlo en el "segundo cerebro" (carpeta RAW)
 * y tomar mejores decisiones.
 *
 * JS PURO: cero React. Recibe `now` inyectable para poder testear.
 */

import { normalizeLifecycle, phaseInfo, daysBetween } from './lifecycle.js'
import { projectStage, stageMeta, PROJECT_STAGES, isPaidStage } from './stages.js'
import { projectProgress } from './progress.js'

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0)
const money = (n) => 'US$ ' + num(n).toLocaleString('en-US')
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)
const planForProject = (p, plans) => (p && p.planId ? (plans || []).find((pl) => pl.id === p.planId) || null : null)
const fmtDate = (v) => {
  const d = v ? new Date(v) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}
const distinctClients = (list) => new Set(list.map((p) => p.clientId).filter(Boolean)).size

/** Todas las métricas crudas (para reusar o testear sin el texto). */
export function computeContext({ projects = [], clients = [], team = [], activity = [], plans = [], now = new Date() }) {
  const clientOf = (id) => clients.find((c) => c.id === id)
  const memberOf = (id) => team.find((u) => u.id === id)

  const byStage = {}
  PROJECT_STAGES.forEach((s) => { byStage[s.key] = [] })
  projects.forEach((p) => { const st = projectStage(p); (byStage[st] = byStage[st] || []).push(p) })

  const pctOf = (p) => projectProgress(p, planForProject(p, plans))

  // avance promedio de los que están EN DESARROLLO
  const dev = byStage.desarrollo || []
  const avgDev = avg(dev.map(pctOf))
  const avgAll = avg(projects.map(pctOf))

  // tiempo de entrega: días de startedAt → phase2At (el desarrollo terminó y pasó a mantenimiento)
  const deliveries = []
  projects.forEach((p) => {
    const lc = normalizeLifecycle(p)
    if (lc.startedAt && lc.phase2At) { const d = daysBetween(lc.startedAt, lc.phase2At); if (d != null && d >= 0) deliveries.push(d) }
  })
  const avgDelivery = avg(deliveries)

  // free maintenance (prueba gratis): cuánto falta para que termine
  const free = (byStage.free || []).map((p) => {
    const info = phaseInfo(p, now)
    return { name: p.name, client: clientOf(p.clientId)?.company || '—', remaining: info.remaining, expired: info.expired, trialDays: info.trialDays }
  })

  // planes pagos → MRR (si el monto mensual está cargado)
  const paidList = [...(byStage.starter || []), ...(byStage.kaizen || []), ...(byStage.scale || [])]
  const mrr = paidList.reduce((s, p) => s + num(normalizeLifecycle(p).maintenanceAmount), 0)

  // financiero
  const totalContract = projects.reduce((s, p) => s + num(p.totalAmount), 0)
  const totalPaid = projects.reduce((s, p) => s + num(p.paidAmount), 0)

  // desde cuándo (primer proyecto / primera actividad)
  const startTs = projects.map((p) => normalizeLifecycle(p).startedAt).filter(Boolean).map((d) => new Date(d).getTime())
  const actTs = (activity || []).map((a) => new Date(a.date).getTime()).filter((t) => Number.isFinite(t))
  const all = [...startTs, ...actTs].filter((t) => Number.isFinite(t))
  const since = all.length ? new Date(Math.min(...all)) : null
  const sinceDays = since ? daysBetween(since, now) : null

  return {
    now, byStage, clientOf, memberOf, pctOf,
    totals: { projects: projects.length, clients: clients.length, team: team.length },
    avgDev, avgAll, avgDelivery, free, mrr, paidCount: paidList.length,
    totalContract, totalPaid, pending: totalContract - totalPaid,
    since, sinceDays,
    distinctInStage: (key) => distinctClients(byStage[key] || []),
  }
}

/** Snapshot en Markdown listo para pegar en RAW. */
export function buildContextMarkdown({ projects = [], clients = [], team = [], activity = [], plans = [], now = new Date() }) {
  const c = computeContext({ projects, clients, team, activity, plans, now })
  const L = []
  const stg = (k) => stageMeta(k).label
  const nStage = (k) => (c.byStage[k] || []).length

  L.push('# Insights Software — Contexto operativo (Proyectos App)')
  L.push('')
  L.push(`> Snapshot generado el **${fmtDate(now)}** desde la app de proyectos. Fuente de verdad para RAW (segundo cerebro).`)
  if (c.since) L.push(`> Datos desde **${fmtDate(c.since)}**${c.sinceDays != null ? ` (~${c.sinceDays} días operando en la app)` : ''}.`)
  L.push('')

  // 1 · Resumen ejecutivo
  L.push('## 1 · Resumen ejecutivo')
  L.push('')
  L.push(`- **Proyectos totales:** ${c.totals.projects}`)
  L.push(`- **Clientes totales:** ${c.totals.clients}`)
  L.push(`- **Equipo:** ${c.totals.team} personas`)
  L.push(`- **Avance promedio (en desarrollo):** ${c.avgDev == null ? '—' : c.avgDev + '%'}`)
  L.push(`- **Avance promedio (todos):** ${c.avgAll == null ? '—' : c.avgAll + '%'}`)
  L.push(`- **Tiempo promedio de entrega (desarrollo → mantenimiento):** ${c.avgDelivery == null ? 'sin datos aún' : `~${c.avgDelivery} días`}`)
  L.push(`- **Planes de mantenimiento pagos activos:** ${c.paidCount}${c.mrr ? ` · MRR ${money(c.mrr)}/mes` : ''}`)
  L.push(`- **Contratado (total):** ${money(c.totalContract)} · **Cobrado:** ${money(c.totalPaid)} · **Pendiente:** ${money(c.pending)}`)
  L.push('')

  // 2 · Distribución por etapa
  L.push('## 2 · Distribución por etapa')
  L.push('')
  L.push('| Etapa | Proyectos | Clientes |')
  L.push('| --- | --- | --- |')
  PROJECT_STAGES.forEach((s) => { L.push(`| ${s.label} | ${nStage(s.key)} | ${c.distinctInStage(s.key)} |`) })
  L.push('')
  L.push(`- **En desarrollo:** ${nStage('desarrollo')} proyecto(s) · ${c.distinctInStage('desarrollo')} cliente(s).`)
  L.push(`- **En mantenimiento gratuito (Free Maint.):** ${nStage('free')} proyecto(s).`)
  L.push(`- **En planes pagos:** Starter ${nStage('starter')} · Kaizen ${nStage('kaizen')} · Scale ${nStage('scale')}.`)
  L.push(`- **Cerrados:** Finalizado ${nStage('finalizado')} · Pausado ${nStage('pausado')} · Cancelado ${nStage('cancelado')}.`)
  L.push('')

  // 3 · Mantenimiento gratuito (cuánto falta para que termine)
  L.push('## 3 · Mantenimiento gratuito (prueba) — cuánto falta para que termine')
  L.push('')
  if (!c.free.length) {
    L.push('_No hay proyectos en mantenimiento gratuito ahora mismo._')
  } else {
    L.push('| Proyecto | Cliente | Días restantes | Estado |')
    L.push('| --- | --- | --- | --- |')
    c.free.forEach((f) => {
      const rem = f.remaining == null ? '—' : (f.expired ? `vencida hace ${Math.abs(f.remaining)}` : `${f.remaining}`)
      L.push(`| ${f.name} | ${f.client} | ${rem} | ${f.expired ? '⚠ vencida — pasar a plan pago' : 'en curso'} |`)
    })
  }
  L.push('')

  // 4 · Planes pagos (Starter / Kaizen / Scale)
  L.push('## 4 · Mantenimiento pago (Starter / Kaizen / Scale)')
  L.push('')
  const paid = [...(c.byStage.starter || []), ...(c.byStage.kaizen || []), ...(c.byStage.scale || [])]
  if (!paid.length) {
    L.push('_Todavía no hay clientes en planes de mantenimiento pagos._')
  } else {
    L.push('| Proyecto | Cliente | Plan | Monto/mes |')
    L.push('| --- | --- | --- | --- |')
    paid.forEach((p) => {
      const amt = num(normalizeLifecycle(p).maintenanceAmount)
      L.push(`| ${p.name} | ${c.clientOf(p.clientId)?.company || '—'} | ${stg(projectStage(p))} | ${amt ? money(amt) : '— (definir)'} |`)
    })
    if (c.mrr) L.push('')
    if (c.mrr) L.push(`**MRR total:** ${money(c.mrr)}/mes.`)
  }
  L.push('')

  // 5 · Cerrados
  L.push('## 5 · Proyectos cerrados')
  L.push('')
  const closed = [...(c.byStage.finalizado || []), ...(c.byStage.pausado || []), ...(c.byStage.cancelado || [])]
  if (!closed.length) {
    L.push('_Ninguno todavía._')
  } else {
    L.push('| Proyecto | Cliente | Estado |')
    L.push('| --- | --- | --- |')
    closed.forEach((p) => L.push(`| ${p.name} | ${c.clientOf(p.clientId)?.company || '—'} | ${stg(projectStage(p))}${projectStage(p) === 'finalizado' ? ' (ofrecer mantenimiento)' : ''} |`))
  }
  L.push('')

  // 6 · Detalle de todos los proyectos
  L.push('## 6 · Detalle de proyectos')
  L.push('')
  L.push('| Proyecto | Cliente | Etapa | Avance | PM | Dev | Contrato | Cobrado |')
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  projects.slice().sort((a, b) => c.pctOf(b) - c.pctOf(a)).forEach((p) => {
    const pm = p.assignments?.pm ? (c.memberOf(p.assignments.pm.userId)?.name || '—') : '—'
    const dv = p.assignments?.dev ? (c.memberOf(p.assignments.dev.userId)?.name || '—') : '—'
    L.push(`| ${p.name} | ${c.clientOf(p.clientId)?.company || (p.kind === 'interno' ? 'Interno · Insights' : '—')} | ${stg(projectStage(p))} | ${c.pctOf(p)}% | ${pm} | ${dv} | ${money(p.totalAmount)} | ${money(p.paidAmount)} |`)
  })
  L.push('')

  // 7 · Clientes
  L.push('## 7 · Clientes')
  L.push('')
  L.push('| Cliente | Empresa | Proyectos |')
  L.push('| --- | --- | --- |')
  clients.forEach((cl) => {
    const n = projects.filter((p) => p.clientId === cl.id).length
    L.push(`| ${cl.name || '—'} | ${cl.company || '—'} | ${n} |`)
  })
  L.push('')

  // 8 · Equipo
  L.push('## 8 · Equipo')
  L.push('')
  L.push('| Persona | Rol | Como PM | Como Dev |')
  L.push('| --- | --- | --- | --- |')
  team.forEach((u) => {
    const asPm = projects.filter((p) => p.assignments?.pm?.userId === u.id).length
    const asDev = projects.filter((p) => p.assignments?.dev?.userId === u.id).length
    const role = u.role === 'pm' ? 'PM' : u.role === 'dev' ? 'Dev' : (u.role || '—')
    L.push(`| ${u.name} | ${role} | ${asPm} | ${asDev} |`)
  })
  L.push('')

  L.push('---')
  L.push(`_Generado automáticamente por Proyectos App · Insights Software. Volvé a exportar cuando quieras para tener RAW al día._`)
  L.push('')
  return L.join('\n')
}
