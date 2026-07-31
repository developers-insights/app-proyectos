// ============================================================================
// Configuración del EQUIPO del onboarding (editable a mano)
// ----------------------------------------------------------------------------
// PM fijo = Nacho Cachaza (siempre aparece).
// Desarrollador = dinámico: se elige de la lista DEVELOPERS según carga/demanda.
// Para tunear a quién se asigna:
//   · subí el `weight` de alguien para que reciba más proyectos,
//   · poné `active:false` para sacarlo de la rotación,
//   · agregá nuevas personas al array.
// Con la config inicial, assignDeveloper() devuelve "Lisandro Martinez".
// ============================================================================

export const PROJECT_MANAGER = { name: 'Nacho Cachaza', role: 'Project Manager' }

export const DEVELOPERS = [
  { id: 'lisandro', name: 'Lisandro Martinez', active: true, weight: 3 },
  { id: 'manuel', name: 'Manuel Navarro', active: true, weight: 1 },
  // { id: 'otro', name: 'Nombre Apellido', active: true, weight: 1 },
]

// Elige el desarrollador activo con MAYOR peso (determinístico y fácil de razonar).
// Ej: si querés que quede Manuel, poné su weight por encima del de Lisandro
// (o desactivá a Lisandro). Devuelve { name, role }.
export function assignDeveloper(devs = DEVELOPERS) {
  const active = (devs || []).filter((d) => d && d.active)
  if (!active.length) return { name: 'Lisandro Martinez', role: 'Desarrollador' }
  const best = active.reduce((a, b) => (Number(b.weight || 0) > Number(a.weight || 0) ? b : a))
  return { name: best.name, role: 'Desarrollador' }
}
