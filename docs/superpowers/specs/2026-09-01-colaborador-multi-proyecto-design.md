# Colaborador: múltiples proyectos asignados

**Fecha:** 2026-09-01
**Estado:** Aprobado, listo para plan de implementación

## Problema

Un Colaborador (`access: 'collab'` — dev externo que usa la app completa pero
restringido) solo puede tener **un** proyecto asignado (`assignedProjectId`,
string). Nacho asignó a Thiago Gauna Rubio a un segundo proyecto (Evoria)
además de GoReach, y no puede: la UI de Usuarios solo deja cargar un proyecto
por Colaborador, y toda la lógica de visibilidad (`visibility.js`, `TasksView`)
asume un único id.

## Alcance

- **Solo Colaboradores.** Los Clientes (`access: 'project'`, portal de solo
  lectura `MemberPortal`) siguen viendo un único proyecto — no se tocan.
- El Planificador (`PlannerView.jsx`) no filtra proyectos por colaborador hoy
  (ve todos los planes sin restricción); queda **fuera de alcance**, no es
  parte de este cambio y ya sirve para ver el roadmap de cualquier proyecto
  asignado.

## Modelo de datos

Nuevo campo en el registro del `team_member`: `assignedProjectIds: string[]`.

El campo viejo `assignedProjectId` (string) **no se borra ni se migra en la
base**: queda como fallback de compatibilidad para colaboradores que todavía
no fueron re-guardados desde la UI nueva. Un helper centraliza la lectura:

```js
// src/lib/visibility.js
export function collabProjectIds(member) {
  if (!member) return []
  if (Array.isArray(member.assignedProjectIds) && member.assignedProjectIds.length) {
    return member.assignedProjectIds
  }
  return member.assignedProjectId ? [member.assignedProjectId] : []
}
```

Cualquier lugar que hoy lee `member.assignedProjectId` para un Colaborador debe
pasar a usar `collabProjectIds(member)`. La escritura (desde la UI de Usuarios)
va siempre al array nuevo; el string viejo queda congelado con lo que tenía
hasta que alguien edite esa fila.

## Cambios por archivo

### `src/lib/visibility.js`
- Export nuevo `collabProjectIds(member)` (arriba).
- `visibleProjects()`: la rama `isCollab(me)` pasa de
  `list.filter(p => p.id === me.assignedProjectId)` a
  `list.filter(p => collabProjectIds(me).includes(p.id))`.

### `src/InsightsApp.jsx` — Usuarios (`UsuariosView`)
La celda "Proyectos" de una fila con `access === 'collab'` deja de ser un
`<select>` único y pasa a:
- Chips de los proyectos ya asignados (nombre + botón "x" para sacarlo →
  `assignedProjectIds` sin ese id).
- Botón **"+ agregar proyecto"** que despliega un `<select>` con los proyectos
  que el colaborador todavía no tiene, para sumarlos (mismo patrón visual que
  `ProjectTags` / el picker de servicios en `AccountsModal`).

La fila con `access === 'project'` (Cliente) sigue exactamente igual: el
`<select>` único de siempre, sin cambios.

El botón "Ver proyecto" al final de la fila: para Cliente sigue igual: para
Colaborador, deja de mostrarse como botón único (ambiguo con varios proyectos)
— cada chip de proyecto en la celda es clickeable y abre ese proyecto
directamente (reemplaza la necesidad del botón aparte).

### `src/InsightsApp.jsx` — `TasksView`
- Filtro de tareas de un Colaborador: `t.projectId && collabProjectIds(me).includes(t.projectId)`
  en vez de comparar contra el id único.
- `addTask()`: si `collabProjectIds(me).length > 1`, la tarea se crea sin
  `projectId` y se abre directo en el editor con el selector de proyecto ya
  visible (ese selector ya existe en el editor de tarea para otros roles, se
  reutiliza tal cual). Si tiene 0 o 1 proyecto asignado, mantiene el
  comportamiento actual (auto-asignado, sin fricción).

## Fuera de alcance (explícito)

- `MemberPortal` / Clientes: sin cambios.
- `PlannerView.jsx`: sin cambios.
- Migración de datos en Supabase: no hace falta corrida de SQL — el fallback
  en `collabProjectIds` cubre a los colaboradores existentes (Thiago, Lautaro)
  sin tocar la base. La primera vez que Nacho edite la asignación de alguno
  desde la UI nueva, ese registro pasa a usar el array.

## Testing

- Build (`npm run build`) verde.
- En el browser local: Usuarios → fila de un Colaborador de prueba → agregar
  un segundo proyecto vía chips, sacar uno, confirmar que el `<select>` de
  Cliente sigue intacto.
- Verificar que `visibleProjects` devuelve ambos proyectos para un colaborador
  con dos ids en `assignedProjectIds`, y que uno con solo el campo viejo
  (`assignedProjectId`) sigue viendo el suyo (fallback).
- `TasksView`: colaborador con 2 proyectos ve tareas de ambos; al crear tarea
  nueva aparece el selector; colaborador con 1 proyecto sigue sin fricción.
