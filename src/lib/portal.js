// El cliente del portal no puede leer projects/clients/plans (traen notas internas,
// contraseñas y montos): portal_projects() (docs/migrations/2026-10-26-portal-sin-internos.sql)
// le da sólo { id, name, stage, lifecycle:{phase,phase2At,phase3At}, progress, company,
// plan:{weeks:[{n,title,tasks:[{text,done}]}]} | null }. Sumar un campo acá exige sumarlo allá.

import { projectProgress } from './progress.js'
import { projectStage } from './stages.js'

export const PORTAL_CACHE_KEY = 'rc_portal_v1'

// Caché de lo que el portal leyó con las políticas viejas (filas enteras): se borra al entrar.
export const PORTAL_STALE_CACHE_KEYS = ['rc_projects_v1', 'rc_clients_v1']

const texto = (v) => (typeof v === 'string' ? v : '')

function tareas(list) {
  return (Array.isArray(list) ? list : [])
    .map((t) => (typeof t === 'string' ? { text: t, done: false } : t && typeof t === 'object' ? { text: texto(t.text), done: !!t.done } : null))
    .filter(Boolean)
}

function semanas(plan) {
  const weeks = plan && Array.isArray(plan.weeks) ? plan.weeks : []
  return weeks
    .filter((w) => w && typeof w === 'object')
    .map((w) => ({ n: Number(w.n) || 0, title: texto(w.title), tasks: tareas(w.tasks) }))
    .sort((a, b) => a.n - b.n)
}

/** Fila de portal_projects() → lo que pinta MemberPortal. Nunca tira. */
export function portalView(row) {
  if (!row || typeof row !== 'object' || !row.id) return null
  const project = { stage: row.stage, lifecycle: row.lifecycle && typeof row.lifecycle === 'object' ? row.lifecycle : undefined, progress: row.progress }
  const weeks = row.plan ? semanas(row.plan) : []
  const plan = row.plan ? { weeks } : null
  return {
    id: String(row.id),
    name: texto(row.name),
    company: texto(row.company),
    stage: projectStage(project),
    pct: projectProgress(project, plan),
    weeks: weeks.map((w) => ({ ...w, done: w.tasks.filter((t) => t.done).length })),
  }
}

/** Proyecto que muestra el portal: el asignado si vino, si no el primero. */
export function portalProject(rows, assignedProjectId) {
  const list = (Array.isArray(rows) ? rows : []).map(portalView).filter(Boolean)
  return list.find((p) => p.id === assignedProjectId) || list[0] || null
}
