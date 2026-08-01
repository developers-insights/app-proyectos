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

/** ¿Mostrarle el switch "Ver todos los proyectos"? Solo a los devs. */
export function canSeeAllToggle(me) {
  return isDev(me)
}

/**
 * Proyectos visibles para `me`.
 * Un dev con el switch apagado ve solo aquellos donde `assignments.dev.userId`
 * es él. Todos los demás casos ven la lista completa (se devuelve tal cual, sin
 * copiar, para no romper las comparaciones por identidad de los useMemo).
 */
export function visibleProjects(projects, me, showAll) {
  const list = Array.isArray(projects) ? projects : []
  if (showAll || !me || !me.id || !isDev(me)) return list
  return list.filter((p) => {
    const dev = p && p.assignments && p.assignments.dev
    return !!dev && dev.userId === me.id
  })
}
