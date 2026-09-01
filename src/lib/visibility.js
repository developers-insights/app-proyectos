/**
 * visibility.js — qué proyectos ve cada miembro del equipo.
 *
 * JS PURO: cero React.
 *
 * Regla de negocio: un dev entra a Proyectos y ve SOLO los suyos (donde figura
 * como dev asignado), con un switch "Ver todos los proyectos" apagado por
 * defecto. Cualquier otro rol (pm, fundador, o rol vacío) ve todo y ni siquiera
 * ve el switch. No es seguridad — es foco: el dev no necesita el ruido de los
 * 20 proyectos de la agencia para trabajar en el suyo.
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

/** ¿Mostrarle el switch "Ver todos los proyectos"? Solo a los devs internos (no colaboradores). */
export function canSeeAllToggle(me) {
  return isDev(me) && !isCollab(me)
}

/**
 * Proyectos visibles para `me`.
 * Un dev con el switch apagado ve solo aquellos donde `assignments.dev.userId`
 * es él. Todos los demás casos ven la lista completa (se devuelve tal cual, sin
 * copiar, para no romper las comparaciones por identidad de los useMemo).
 */
export function visibleProjects(projects, me, showAll) {
  const list = Array.isArray(projects) ? projects : []
  // Colaborador: SOLO sus proyectos asignados, sin importar el switch.
  if (isCollab(me)) { const ids = collabProjectIds(me); return list.filter((p) => p && ids.includes(p.id)) }
  if (showAll || !me || !me.id || !isDev(me)) return list
  return list.filter((p) => {
    const dev = p && p.assignments && p.assignments.dev
    return !!dev && dev.userId === me.id
  })
}
