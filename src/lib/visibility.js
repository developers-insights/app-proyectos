/**
 * visibility.js — qué proyectos ve cada miembro del equipo.
 *
 * JS PURO: cero React.
 *
 * Regla de negocio (2026-09-25, pedido de Manuel): un dev ve SOLO los proyectos
 * donde figura como dev asignado, sin switch para ver los del resto — se sacó a
 * propósito, no volver a agregarlo. Cualquier otro rol (pm, fundador, o rol
 * vacío) ve todo. Los proyectos se le asignan desde Usuarios.
 */

/** Rol normalizado: minúsculas, sin espacios de más. Acepta el miembro o el string suelto. */
function normRole(member) {
  const raw = member && typeof member === 'object' ? member.role : member
  return String(raw ?? '').trim().toLowerCase()
}

/**
 * El campo `role` es texto libre y viene cargado a mano: aceptamos las formas
 * que aparecen en la práctica en vez de exigir el string exacto 'dev'.
 */
const DEV_ROLES = new Set(['dev', 'devs', 'developer', 'desarrollador', 'desarrolladora', 'desarrollo'])

/** ¿Este miembro es developer? */
export function isDev(member) {
  return DEV_ROLES.has(normRole(member))
}

/**
 * Colaborador: usuario externo aprobado con acceso 'collab'. Usa la app real
 * (Proyectos, tareas, Planificador, detalle de proyecto con todas sus funciones)
 * pero SOLO ve los proyectos que tiene asignados (assignedProjectIds). Distinto
 * de 'project', que es el portal de solo lectura y sigue siendo un único
 * proyecto (assignedProjectId, sin tocar).
 */
export function isCollab(member) {
  return !!member && member.access === 'collab'
}

/**
 * Proyectos asignados a un Colaborador. `assignedProjectIds` (array) es la
 * fuente de verdad; si todavía no existe, cae al campo viejo `assignedProjectId`
 * (string, pre-multi-proyecto) para no romper a nadie que no fue re-guardado
 * desde la UI nueva.
 */
export function collabProjectIds(member) {
  if (!member) return []
  if (Array.isArray(member.assignedProjectIds) && member.assignedProjectIds.length) {
    return member.assignedProjectIds
  }
  return member.assignedProjectId ? [member.assignedProjectId] : []
}

/** Los no-devs reciben la lista tal cual, sin copiar: los useMemo comparan por identidad. */
export function visibleProjects(projects, me) {
  const list = Array.isArray(projects) ? projects : []
  if (isCollab(me)) { const ids = collabProjectIds(me); return list.filter((p) => p && ids.includes(p.id)) }
  if (!me || !me.id || !isDev(me)) return list
  return list.filter((p) => {
    const dev = p && p.assignments && p.assignments.dev
    return !!dev && dev.userId === me.id
  })
}
