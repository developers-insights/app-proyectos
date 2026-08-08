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

---

# 2026-08-01 · Rework de diseño + ciclo de vida de proyectos

Sesión larga con 6 agentes en serie/paralelo sobre `src/InsightsApp.jsx` (6953 → 7664 líneas)
y 5 módulos nuevos. `npm run build` verde en cada corte.

## Decisiones de producto (tomadas por Manuel en esta sesión)
- **El % de avance sale del plan**, contando TODAS las tareas (equipo + cliente). El sistema
  viejo de sprints (`project.sprints`) se **eliminó entero** (−764 líneas).
- **Tres fases de ciclo de vida** por proyecto: 1 Desarrollo (contador de días ascendente,
  arranca en el onboarding) · 2 Prueba + marketing gratis (30 días, cuenta regresiva) ·
  3 Mantenimiento (cobro mensual, aviso 7 días antes). **El cambio de fase es manual**; el
  sistema solo sugiere (plan al 100% → fase 2; prueba cumplida → fase 3) y nunca mueve nada solo.
- **Visibilidad por rol**: `role === 'dev'` ve solo los proyectos donde es el dev asignado, con
  switch "ver todos" apagado por defecto. `pm` / `fundador` / sin rol ven todo. NO es un control
  de seguridad (todos están autenticados y pueden leer todo): es comodidad de la interfaz.
- **Card**: anillo de progreso circular (verde), contador de días + fase, último avance, estado
  arriba a la derecha. Sin tags, sin iniciales, sin email, sin engranaje. Toda la card abre el detalle.
- Iconos: set duotono propio (`src/ui/icons2.jsx`, 65). Se descartó generarlos con Gemini (raster,
  no heredan color del tema) y se descartó Phosphor (9 de los necesarios no existían ahí).
- Logo: **sin cambios**, se mantiene el cuadrado naranja con la "I".

## Archivos nuevos
- `src/lib/lifecycle.js` — fases, contadores, `suggestedTransition`, `billingNotice` (aviso 7 días
  antes, uno por ciclo mensual, anti-duplicado contra `lastNoticeSentAt`).
- `src/lib/progress.js` — `projectProgress` / `progressBreakdown` desde el plan.
- `src/lib/visibility.js` — filtro por rol.
- `src/ui/icons2.jsx` — 65 iconos duotono (drop-in de `I`).
- `src/emails/maintenanceNotice.js` + `preview.html` — mail de aviso de cobro (tablas + CSS inline,
  bulletproof VML, escape de valores y `safeHref`). **El envío NO existe todavía**: se copia a mano.
- `docs/migrations/2026-08-01-lifecycle.sql` — **APLICADA** (backfill `lifecycle` en los 14 proyectos
  + normalización de roles por email).
- `docs/migrations/2026-08-01-drop-sprints.sql` — **NO aplicada**. Vacía `data->'sprints'` con backup
  previo. Los sprints siguen en la base, inertes.

## Edge Function
`project-share` reescrita: el payload del cliente sale del plan (`kpis` + `plan.weeks`), no de sprints.
**Deployada y verificada en vivo** (Chamber OS: 62%, 29/47 tareas, 17 semanas; contraseña mala → 401).
Del plan solo viaja lo público: sin `detalle` operativo, sin bloqueos, sin notas internas.
⚠️ Deploy por API: usar **multipart** `POST /v1/projects/{ref}/functions/deploy?slug=…`.
El `PATCH …/functions/{slug}` con `{"body": …}` sube el código VACÍO y deja la function en BOOT_ERROR.

## Bugs encontrados por la revisión y corregidos (con evidencia)
1. `EditProjectModal` hacía reemplazo total al guardar → pisaba `lifecycle` (fase y aviso de cobro),
   `activity`, `avances`, `clientTasks` si el proyecto cambiaba mientras el modal estaba abierto.
   Ahora mergea sobre el proyecto vivo con whitelist de campos del formulario.
2. `suggestedTransition` leía el `progress` legacy de proyectos sin plan → sugería empezar a facturar
   mostrando "Tareas del plan: 0". Ahora exige un plan con tareas reales.
3. El botón del mail se renderizaba fuera de la tarjeta (foster parenting de una `<table>` anidada).
4. Copiar el mail sellaba el aviso como enviado; ahora solo lo sella el botón explícito.
5. `const NOW = new Date()` a nivel de módulo congelaba "último avance" en pestañas de días.
6. `docs/migrations/…drop-sprints.sql` declaraba la PK como `uuid` (los ids son `text`) → abortaba entero.

## PENDIENTE
1. **Mirar la app con ojos humanos**: en este entorno el Browser pane no compone frames
   (`document.hidden === true`), así que todo se verificó midiendo el DOM. Nadie vio un píxel.
2. `git commit` + push a `origin` → GH Actions deploya a Render.
3. Correr `docs/migrations/2026-08-01-drop-sprints.sql` cuando la UI esté validada en producción.
4. Envío real del mail de mantenimiento (falta proveedor: Resend + dominio verificado + cron).
5. Valentín Toledo quedó sin rol (no tiene email cargado) → ve todos los proyectos.

---

# 2026-08-07 · La ETAPA reemplaza al estado; la consola pasa al encabezado

## Qué cambió
- **`project.stage`** (`src/lib/stages.js`) es el único eje de clasificación: Desarrollo · Free Maint. ·
  Starter · Kaizen · Scale. Reemplaza a `project.status` (activo/pendiente/pausado/entregado) y al
  stepper visual "Ciclo de vida" del detalle. La etapa **manda** sobre `lifecycle.phase`
  (desarrollo→1, free→2, planes pagos→3) vía `applyStage()` → `advancePhase()`, así que el cobro
  recurrente y su aviso siguen intactos. Los proyectos viejos derivan su etapa de la fase.
- **Retroceder de etapa borra fechas selladas** → confirmación obligatoria en los 3 puntos donde se
  cambia (card, tabla, detalle). Avanzar es directo. Entre planes pagos no se reinicia nada.
- **Encabezado del detalle**: las filas ENLACES y PANELES se volvieron dos desplegables. Los cuatro
  controles (Enlaces · Paneles · Etapa · Editar proyecto) son un cluster con jerarquía
  (`.pdh-*`, neutro → color de estado → CTA). Token nuevo `--violet` para Scale.
- **Se fue**: el stack de tecnologías de toda la UI, la fecha estimada de ingreso (existía solo para
  "pendiente") y el CSS muerto de la consola vieja y el stepper.

## Bugs que la revisión encontró y se corrigieron antes del deploy
1. Sin la sección de ciclo de vida, un proyecto en plan pago **sin monto** mandaba el mail diciendo
   "USD 0" (`Number(null) || 0`). Ahora el mail no se arma sin monto y hay una alerta que lo pide.
2. `trackInfo` perdió el corte de "entregado" → los proyectos en mantenimiento marcaban rojo para
   siempre. Ahora lo corta `isPaidStage()`, que además los saca del pop-up del PM.
3. "Proyectos activos" en Clientes contaba todos; se corrigió la etiqueta y el texto del borrado.
4. `planAgent.js` seguía leyendo `project.status`/`stack` → ahora manda la etapa.
5. `role="option"` usaba `aria-checked` en vez de `aria-selected`, y los encabezados de grupo colgaban
   sueltos del listbox.

## Verificado
Build verde. En el browser (harness temporal, dark + light, 1280 y 375 px): 5 pestañas con sus
contadores, los 3 menús con su posición y contenido, el cambio de etapa tiñendo el control, la
confirmación de retroceso sin aplicar el cambio, y los 3 estados del aviso de cobro (falta cargar /
falta avisar / ya avisado). Sin overflow horizontal; alturas táctiles 38-44 px en mobile.
Prod: bundle servido por Render contiene "Free Maint.", "Kaizen" y la alerta de cobro; "Ciclo de vida"
ya no aparece. Edge Function `onboarding-signup` redeployada (v2) creando proyectos con `stage`.

## PENDIENTE
- El workflow `Deploy a Render` sigue fallando con **401**: el secret `RENDER_API_KEY` está vencido o
  mal cargado en `developers-insights/app-proyectos`. El deploy igual sale por el autoDeploy propio de
  Render, pero el workflow no sirve de nada hasta arreglar el secret.
- Nadie miró la app con ojos humanos todavía (el Browser pane no compone frames; se midió el DOM).
