# PROGRESS — app-proyectos

## 2026-07-20 · Fin del clobbing: migración del blob `app_state` a tablas por-fila

### Problema (causa raíz, verificada)
El estado compartido vivía en **un documento monolítico** (`app_state`, 1 fila JSONB de ~1.6 MB, dominado por `projects`). Cada cambio reescribía el blob entero (`upsert`) → **last-write-wins**. Además `app_state` **no estaba en la publicación de realtime** y **no tenía resync al reconectar**, así que las pestañas nunca veían los cambios ajenos y, al guardar, colapsaban la base a su versión vieja. Esto borraba trabajo de otros. `plans`/`tasks` ya se habían blindado antes (commit `d9a5c76`); faltaba el resto.

### Solución (patrón por-fila, generalizado)
`src/InsightsApp.jsx`:
- **`useRowCollection`** (sección 6d): factory genérica que generaliza `usePlans`/`useTasks`. Una fila por entidad (`id text pk, data jsonb, updated_at, deleted_at`), merge por `updatedAt`, soft-delete (tombstone), **resync al reconectar** el socket, flush en `pagehide`/`visibilitychange`, cache local (offline instantáneo), realtime por tabla.
- **8 colecciones migradas** a tablas propias: `projects, clients, team_members, calls, activity, sops_categories, sops_processes, assistant_chats`.
- **`dataView`** en `AppShell` ensambla la forma histórica de `data` (para no tocar los cientos de reads `data.*`). Toda MUTACIÓN pasa por acciones de store (`create/patch/upsert/remove`) — nunca por `setData`.
- `useAppData` (blob) quedó **sin llamadas** (código muerto inerte; se puede borrar en un pase de limpieza).

Supabase (proyecto `yzmtzyuncekspgtsetwk`):
- Tablas nuevas con RLS `authenticated` (idéntico a `plans`/`tasks`) + en la publicación `supabase_realtime` + índice parcial `where deleted_at is null`.
- Backup pristino del blob en `app_state_backup_pre_split` (el blob original queda intacto → rollback trivial).
- Datos migrados (idempotente): projects 12 · clients 13 · team_members 6 (excluye `u4`) · calls 1 · activity 109 (actor desconocido→Nacho) · sops_cat 1 · sops_proc 1 · assistant_chats 3.

`supabase/functions/*` (actualizadas para leer/escribir tablas por-fila; **NO están desplegadas** hoy — `list_edge_functions` vacío, comentario `/* fn no desplegada */`):
- `onboarding-signup` — inserta filas (clients/projects/activity) en vez de reescribir el blob (elimina otro vector de clobbing).
- `project-share` — lee projects/team/clients/calls de las tablas.
- `fathom-sync` — matchea contra clients/projects de las tablas.

### Verificado
- **Build**: `npm run build` verde (816 módulos).
- **Permanencia (DB, sentencias reales del store)**: pestaña vieja que guarda NO pisa lo de otro (B sobrevive) ✓; tombstone NO resucita por un edit viejo ✓.
- **Runtime (preview modo local)**: `AppShell` monta, 8 stores instancian, reads via `dataView`, crear proyecto → navegar a detalle, **cero errores de consola**.
- **Integridad de datos**: 0 proyectos sin `updatedAt`/`sprints`, 0 clientes sin `company`, 0 fuga de `u4`, p8 con sus 12 sprints.

### Auditoría adversarial (code-reviewer) + fixes aplicados
Invariantes anti-clobbing **confirmadas** (soft-delete de una vía, payload upsert siempre `{id,data,updated_at}`, guard por `updatedAt`, resync, flush, wiring de AppShell, rules of hooks). **Sin camino de pérdida permanente de datos.**
Fixes aplicados (robustez del borrado — transitorios/self-healing, pero corregidos):
- Set `deletedIds` en la factory: `loadRows` ya no resucita una edición pendiente de una fila borrada en otra pestaña; el eco fuera de orden no re-agrega algo recién borrado; `remove` marca el tombstone local.
- `dataView.team` filtra `REMOVED_MEMBER_IDS` (defensa en profundidad; `u4` ya excluido en la migración).
Diferidos (menores, anotados): badge de sync no refleja "saving" de plans/tasks (cosmético); sin gating de inputs mientras `!ready`; borrar el código muerto `useAppData` (inerte, 0 callers); `create` de la factory es más defensivo que `usePlans/useTasks` ante doble-click (pre-existente).

### PENDIENTE (deploy / cutover)
1. **Re-sync final** blob→tablas antes de deployar (captura ediciones hechas en la app vieja desde la migración): `ON CONFLICT (id) DO UPDATE`. (El blob es la verdad hasta el instante del cutover porque el código viejo lo escribe.)
2. **git push** a `origin` (developers-insights/app-proyectos) → GH Actions dispara deploy Render.
3. **El equipo debe refrescar** (hard reload) para pasar a la versión nueva. Durante la ventana de deploy, ediciones en la app vieja van al blob; el re-sync del paso 1 las cubre si se corre justo antes.
4. **Edge functions**: desplegar las 3 versiones nuevas cuando se usen. ⚠️ El cliente llama `project-share-` (con guión final) pero la carpeta es `project-share` — resolver el slug (renombrar deploy a `project-share-` o actualizar el cliente a `project-share`).

### Rollback
Redeployar el commit anterior (código viejo lee el blob, intacto). Backup adicional en `app_state_backup_pre_split`.
