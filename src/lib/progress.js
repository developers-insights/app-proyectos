/**
 * progress.js — el % de avance de un proyecto sale del PLAN, no de los sprints.
 *
 * JS PURO: cero React. Se apoya en planModel.js para no reimplementar el
 * criterio de "tarea terminada" ni el de "tarea del cliente":
 *
 *   · terminada  → taskEstado(t) === 'terminada'  (es decir, t.done)
 *   · del cliente → taskResponsable(t) !== 'insights'  ('cliente' y 'ambos')
 *
 * Se cuentan TODAS las tareas del plan, las del equipo y las del cliente: el
 * proyecto no está terminado si falta lo que depende del cliente, y esconderlo
 * del % daría un 100% mentiroso.
 *
 * El sistema viejo (project.sprints) NO se usa acá y se elimina en otra tarea.
 */

import { planBoardSummary, taskEstado, taskResponsable } from '../plan/planModel.js'

/** Entero 0..100, tolerante a basura. */
function clampPct(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, v))
}

/** Tareas de todas las semanas del plan, aplanadas. Nunca tira. */
function allTasks(plan) {
  const weeks = Array.isArray(plan && plan.weeks) ? plan.weeks : []
  const out = []
  for (const w of weeks) {
    const ts = Array.isArray(w && w.tasks) ? w.tasks : []
    for (const t of ts) out.push(t)
  }
  return out
}

/**
 * % de avance del proyecto (entero 0..100).
 *
 * Si el proyecto no tiene plan asociado o el plan no tiene ni una tarea, cae al
 * `project.progress` legacy: mostrar 0% en un proyecto viejo que venía al 60%
 * se lee como "no se hizo nada", que es peor que mostrar el número viejo.
 */
export function projectProgress(project, plan) {
  const summary = planBoardSummary(plan)
  if (!plan || summary.total === 0) return clampPct(project && project.progress)
  return clampPct(summary.pctInsights)
}

/**
 * Desglose para las tarjetas de stats del detalle del proyecto.
 * → { pct, done, total, equipoDone, equipoTotal, clienteDone, clienteTotal, pendingCliente }
 *
 * 'ambos' cuenta como cliente (mismo criterio que planPendingCliente): si
 * depende del cliente, es un bloqueo del cliente. Así equipoTotal + clienteTotal
 * siempre suma total, sin doble conteo.
 */
export function progressBreakdown(project, plan) {
  const summary = planBoardSummary(plan)
  let equipoDone = 0, equipoTotal = 0, clienteDone = 0, clienteTotal = 0

  for (const t of allTasks(plan)) {
    const done = taskEstado(t) === 'terminada'
    if (taskResponsable(t) === 'insights') {
      equipoTotal++
      if (done) equipoDone++
    } else {
      clienteTotal++
      if (done) clienteDone++
    }
  }

  return {
    pct: projectProgress(project, plan),
    done: summary.done,
    total: summary.total,
    equipoDone,
    equipoTotal,
    clienteDone,
    clienteTotal,
    pendingCliente: clienteTotal - clienteDone,
  }
}

/**
 * Color del anillo de progreso. ÚNICO helper de color por porcentaje de la app
 * (antes convivía con un `pctColor` de InsightsApp.jsx con los mismos cortes),
 * para que el detalle y las tarjetas no muestren dos colores distintos para el
 * mismo número.
 */
export function progressColorVar(pct) {
  const p = clampPct(pct)
  if (p < 40) return '--red'
  if (p <= 70) return '--accent'
  return '--green'
}
