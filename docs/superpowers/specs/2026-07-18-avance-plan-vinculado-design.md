# Avance del plan vinculado a sprints — Spec / Contrato

**Fecha:** 2026-07-18 · **Estado:** aprobado por Manuel · **Autor:** Claude (orquestador)

Este documento es el **contrato único**. Tres agentes trabajan en paralelo sobre archivos
disjuntos. Cada uno implementa SU parte respetando exactamente las firmas y reglas de acá.
No cambiar firmas sin avisar al orquestador.

---

## 0. Objetivo

En el **detalle de proyecto** (`ProjectDetail`, `src/InsightsApp.jsx`), agregar una sección
**"Avance del plan"**: un acordeón con **todas las semanas** del plan asociado
(`project.planId → plans[]`). Se expande una semana → se ven sus tareas → click en una tarea
la **tacha** (`done`). El **% de avance** sube. El **cliente ve el tachado + barra de %** en el
link público (`planes-insights.vercel.app/{slug}`), en vivo (el sitio ya recarga por Realtime).

Vínculo **bidireccional** semana↔sprint (aprobado):
- Marcar un **sprint "terminado"** ⇒ **todas** las tareas de esa semana quedan `done`.
- Sacar el sprint de "terminado" ⇒ **todas** las tareas de esa semana vuelven a `done:false`.
- Tachar **todas** las tareas de una semana ⇒ el sprint de esa semana pasa a **"terminado"**.
- Destachar cualquier tarea de una semana completa ⇒ el sprint vuelve a **"en proceso"**.

**Cero cambios de schema Supabase.** El estado `done` viaja dentro de `data` jsonb (tabla
`plans`, espejada a `published_plans`).

---

## 1. Contrato de datos — la tarea de semana

Hoy `week.tasks` es `string[]`. Pasa a objetos, con **retrocompatibilidad total** (en disco
puede seguir habiendo strings de planes viejos; se normalizan al vuelo / al primer uso):

```ts
type Task = { id: string; text: string; done: boolean }
type TaskLike = string | Task          // lo que puede venir en week.tasks
// week.tasks: TaskLike[]
```

Reglas:
- **Lectura (render):** NUNCA generar ids en render. Usar helpers `taskText`/`taskDone` que
  aceptan `TaskLike`.
- **Escritura (toggle / editor / migración):** normalizar a `Task` con `uid()` para el id.
- `newPlan()` / `emptyWeek()` siguen creando `tasks: []`. Cuando el editor agrega una tarea,
  crea un `Task` (`{ id: uid(), text: '', done: false }`), no un string.

---

## 2. Contrato de helpers — `src/plan/planModel.js`  (dueño: **Agente A**)

Agregar y exportar (consumidos por Agentes B y C; **firmas exactas**):

```js
// ── Lectura defensiva (safe en render, no generan ids) ──
export function taskText(t) { return typeof t === 'string' ? t : (t && t.text) || '' }
export function taskDone(t) { return typeof t === 'string' ? false : !!(t && t.done) }

// ── Normalización para escritura (genera id si falta) ──
export function normalizeTask(t) {
  if (t && typeof t === 'object') return { id: t.id || uid(), text: t.text || '', done: !!t.done }
  return { id: uid(), text: String(t == null ? '' : t), done: false }
}
export function normalizeTasks(tasks) { return (Array.isArray(tasks) ? tasks : []).map(normalizeTask) }

// ── Progreso ── pct entero 0..100 (0 si total===0)
export function weekProgress(week) {
  const ts = Array.isArray(week && week.tasks) ? week.tasks : []
  const total = ts.length
  const done = ts.filter(taskDone).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}
export function planProgress(plan) {
  const weeks = Array.isArray(plan && plan.weeks) ? plan.weeks : []
  let done = 0, total = 0
  for (const w of weeks) { const p = weekProgress(w); done += p.done; total += p.total }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

// ── Mutaciones inmutables de una semana (devuelven NUEVA week con tasks normalizadas) ──
// Toggle por índice (el acordeón usa el índice del render como referencia estable del click).
export function toggleTaskDone(week, index) {
  const tasks = normalizeTasks(week && week.tasks)
  if (index < 0 || index >= tasks.length) return { ...week, tasks }
  tasks[index] = { ...tasks[index], done: !tasks[index].done }
  return { ...week, tasks }
}
export function setWeekAllDone(week, done) {
  const tasks = normalizeTasks(week && week.tasks).map((t) => ({ ...t, done: !!done }))
  return { ...week, tasks }
}

// ── Mapeo semana↔sprint (puro; sprints = project.sprints) ──
// Aparea por número de semana: sprint.week, o su posición (i+1) como fallback. Primer match.
export function sprintForWeek(sprints, n) {
  const arr = Array.isArray(sprints) ? sprints : []
  return arr.find((s, i) => (s.week || (i + 1)) === n) || null
}
```

`uid` ya existe y se exporta en `planModel.js`. Estos helpers deben **replicarse idénticos**
en `planes-web/lib/planModel.js` (Agente A también).

---

## 3. Render del `done` + % — `src/plan/planTemplate.js` y `planes-web/lib/planTemplate.js` (dueño: **Agente A**)

Los dos `planTemplate.js` son gemelos (port línea por línea). Aplicar los **mismos cambios** en
ambos. Puntos de referencia (números de `planes-web/lib/planTemplate.js`; en app-proyectos son
análogos — ubicarlos por nombre):

1. **`sanitizePlan()`** (~L119-210, mapeo de weeks ~L149-163): hoy hace
   `tasks: arr(w.tasks).map(e)` → **aplana a strings y pierde el `done`**. Cambiar a preservar
   objeto, escapando el texto:
   ```js
   tasks: arr(w.tasks).map((t) => {
     const isObj = t && typeof t === 'object'
     return { text: e(isObj ? t.text : t), done: isObj ? !!t.done : false }
   }),
   ```
   (`e` = escapeHtml). Mantener retrocompat con strings.

2. **`weeksData`** que se serializa a `WEEKS` (~L1071-1079): pasar `tasks` como
   `[{text, done}]` (ya vienen así de sanitizePlan).

3. **`buildHTML(w)`** client-side (~L586-599): cada tarea es hoy
   `'<div class="task"><span class="tick">'+ICONS.tick+'</span><span>'+x+'</span></div>'`.
   Cambiar a leer `{text, done}` y agregar la clase `done`:
   ```js
   const tasks = w.tasks.map((x) => {
     const done = x && typeof x === 'object' ? x.done : false
     const txt  = x && typeof x === 'object' ? x.text : x
     return '<div class="task'+(done?' done':'')+'"><span class="tick">'+(done?ICONS.check:ICONS.tick)+'</span><span>'+txt+'</span></div>'
   }).join('')
   ```
   (si no hay `ICONS.check`, reusar `ICONS.tick`; lo visual del tachado lo da el CSS).

4. **`printAll`** (~L638-644): mismo criterio en el `<li>` (clase `done` + texto).

5. **`buildCSS()`**: agregar
   ```css
   .task.done span{ text-decoration: line-through; opacity:.5 }
   .task.done .tick{ opacity:.6 }
   ```
   y estilos de la **barra de progreso** (ver punto 6).

6. **% de avance en el HTML público**: en la cabecera de la sección de semanas (o del hero),
   inyectar una barra global. Server-side ya se puede calcular con `planProgress(plan)` al
   construir el HTML (no depende del `<script>`). Barra sobria acorde al tema del plan
   (usar el color de acento del plan). Diseño: barra fina + `NN% · X/Y tareas`. Mantener el
   estilo existente del template (no romper la estética RDX).

7. **`makePlanPdfDoc`** (~L690-906, bloque autocontenido): al listar items (~L866-872),
   anteponer un check y, si `done`, marcar visualmente (ej. `[x]` vs `[ ]`, o texto con guion).
   Es autocontenido: leer `{text,done}` con guardas para strings. No romper el layout de medición.

**Importante:** el refresco en vivo **no requiere tocar Realtime** — el sitio hace
`location.reload()` y regenera el HTML desde `published_plans.data`. Con que el `done` viaje en
`data`, el cliente lo ve. Verificar que `sanitizePlan` NO borre el `done`.

---

## 4. Store de planes + centralización del sync al link — `src/InsightsApp.jsx` §6b (dueño: **Agente B**)

### 4a. Migración retrocompat (suave)
No hace falta migración masiva. El render usa `taskText`/`taskDone` (tolera strings). La primera
vez que se togglea una tarea, `toggleTaskDone`/`setWeekAllDone` normalizan esa semana a objetos
con ids estables y persisten. Suficiente. (Opcional: normalizar en `loadPlans`, pero **evitarlo**
para no disparar escrituras/reload masivos innecesarios.)

### 4b. Centralizar el auto-sync a `published_plans` en el store (arregla el gap)
Hoy el sync a `published_plans` vive SOLO en `PlanEditor` (useEffect). Marcar avance desde
`ProjectDetail` usa `patchPlan` pero NO sincroniza el link. Centralizar:

- Mover `upsertPublished(supabase, plan)` a un helper accesible por el store (o duplicar la
  función dentro del store; hoy vive en `PlannerView.jsx:33`).
- En `usePlans`: agregar un **sync debounced a `published_plans`** que se dispara cuando
  `patchPlan` produce un plan con `published === true`. Debounce ~700ms, por id.
- Exponer estado para el chip del editor: `publishSync` = `{ [planId]: 'idle'|'saving'|'saved'|'error' }`
  y una función `retryPublish(id)`.
- Firma nueva del store (retorno):
  ```js
  return { plans, plansReady, createPlan, patchPlan, deletePlan, publishSync, retryPublish }
  ```
- `deletePlan`: mantener el borrado de `published_plans` (hoy está en `PlannerView`; puede
  quedarse ahí o moverse — no romper el borrado del link).

**Coordinación con Agente C (editor):** el editor deja de manejar su propio `syncState`/useEffect
de sync y pasa a leer `publishSync[plan.id]` del store. El orquestador conecta esto en la fase
de integración si hace falta; B deja `publishSync`/`retryPublish` listos y funcionando.

**Cuidado:** no romper el flujo de `createPlan`/`publishPlan`/`deletePlan` existente ni el merge
realtime por `updatedAt`. El sync a `published_plans` es un efecto adicional, no reemplaza el
guardado a la tabla `plans`.

---

## 5. UI — Sección "Avance del plan" en `ProjectDetail` + sync sprint↔semana — `src/InsightsApp.jsx` (dueño: **Agente B**)

`ProjectDetail` (L3611) ya tiene: `plans`, `patchPlan`, `linkedPlan`
(`= plans.find(pl => pl.id === project.planId)`), `patch`, `patchSprint`, `project.sprints`.

### 5a. Componente `<PlanProgress project linkedPlan patchPlan patch />` (nuevo, en InsightsApp.jsx)
Renderizar en `ProjectDetail` **después de `<SprintBoard/>`** (después de L3697).

- Si `!linkedPlan`: card sobria "Asociá un plan para trackear el avance del cliente" + botón que
  abre el modal de plan existente (`setPlanOpen(true)`). No romper si el proyecto no tiene plan.
- Header: título "Avance del plan" + **barra de progreso global** (`planProgress(linkedPlan)`),
  con `NN%` y `X/Y tareas`. Botón para abrir el link (`linkedPlan.publishedUrl`) si existe.
- **Acordeón: TODAS las semanas** (`linkedPlan.weeks`, ordenadas por `w.n`). Cada fila (colapsada):
  - `Semana N` + `w.title`
  - chip de la fase (`hitoForWeek(linkedPlan, w.n)` → color/label) — reusar helpers existentes
  - mini-barra + `x/y` (`weekProgress(w)`)
  - chip del **estado del sprint apareado** (`sprintForWeek(project.sprints, w.n)`), si existe
  - chevron animado
  - Estilo "semana completa": si `weekProgress(w).pct===100 && total>0`, acento verde suave.
- **Expandida:** lista de tareas. Cada tarea:
  - checkbox custom (cuadrado, check animado al marcar; usar `--accent`/`--green`)
  - texto con **tachado animado** cuando `done` (`text-decoration: line-through` + opacity, con
    transición suave)
  - toda la fila es clickeable (buena hit-area, cursor pointer, hover)
- **Interacción de marcado** (`onToggle(weekN, taskIndex)`):
  1. `patchPlan(linkedPlan.id, p => ({ ...p, weeks: p.weeks.map(w => w.n===weekN ? toggleTaskDone(w, taskIndex) : w) }))`
  2. Sync **plan→sprint** con el resultado:
     ```js
     const w = updatedPlan.weeks.find(w => w.n===weekN)
     const prog = weekProgress(w)
     const sp = sprintForWeek(project.sprints, weekN)
     if (sp) {
       const st = normSprint(sp.status)
       if (prog.total>0 && prog.done===prog.total && st!=='terminado') patchSprint(sp.id, { status:'terminado' })
       else if (prog.done<prog.total && st==='terminado') patchSprint(sp.id, { status:'en proceso' })
     }
     ```
     `patchSprint` acá es el **plano** (`patch(p=>...)`, L3639) — NO el `setSprint` con sync, para
     evitar re-disparar setWeekAllDone (la semana ya está en el estado correcto). Loguear
     `sprint-done` cuando corresponda (opcional, imitar `setSprint`).

`patchPlan` es síncrono y **devuelve el plan guardado** (`return saved`, L954) → usarlo para el
paso 2 sin releer del array.

### 5b. Sync **sprint→plan** en `SprintBoard` (L2007)
`SprintBoard` recibe `patch` del padre. Agregar props: **`linkedPlan`, `patchPlan`**. En
`setSprint(sid, fields)` (L2020), cuando `fields.status` cambia de/hacia `'terminado'`:
```js
if (fields.status && linkedPlan) {
  const idx = sprints.findIndex(s => s.id === sid)
  const weekN = sprints[idx]?.week || (idx + 1)
  const nextDone = normSprint(fields.status) === 'terminado'
  const prevDone = normSprint(prev?.status) === 'terminado'
  if (nextDone !== prevDone) {
    patchPlan(linkedPlan.id, p => ({ ...p, weeks: p.weeks.map(w => w.n===weekN ? setWeekAllDone(w, nextDone) : w) }))
  }
}
```
Pasar `linkedPlan`/`patchPlan` desde `ProjectDetail` a `<SprintBoard project patch linkedPlan patchPlan onOpenSprint>`.
`SprintDetailModal` (cambio de estado desde el modal): idem — `ProjectDetail` debe aplicar la misma
regla cuando el modal cambia `status` (envolver `patchSprint` de estado con el sync, o reusar la
función). Cubrir ambos caminos para consistencia.

**No loops:** toggle→`patchSprint` plano (no re-sincroniza semana). setSprint→`setWeekAllDone`
(no llama toggle). Ambas ramas son idempotentes.

### 5c. Diseño (obligatorio, no genérico)
Aplicar estética premium acorde a la app (dark, acento naranja `--accent`, verde `--green` para
completado). Checkbox custom con micro-animación, tachado con transición, barras con relleno
animado, chevron rotatorio, hover states, respetar tokens `var(--...)` existentes. Usar `motion`
(framer-motion, ya importado) para el colapso/expansión suave del acordeón. Mobile-friendly.

---

## 6. Editor del planner — `src/plan/PlannerView.jsx` (dueño: **Agente C**)

1. **`WeekCard` / `RowTools`** (edición de `tasks`): hoy tratan `tasks` como `string[]`
   (agregar/editar/borrar/reordenar). Adaptar para `Task = {id,text,done}`:
   - Agregar tarea: `{ id: uid(), text: '', done: false }` (importar `uid` de `planModel.js`).
   - Editar: modifica `.text` (el input lee/escribe `taskText`/`.text`).
   - Borrar/reordenar: por índice o id, igual que hoy.
   - **Retrocompat:** si una tarea existente es string, tratarla como texto (usar `taskText`).
     Idealmente, al primer edit de la semana, normalizar sus tasks a objetos (`normalizeTasks`).
   - **No** agregar UI de "done" en el editor (el marcado se hace desde el proyecto). El editor
     solo edita contenido. El `done` se preserva intacto al editar texto.
2. **Chip de sync a link:** reemplazar el `syncState` local + `useEffect` de sync (L268-293) por
   la lectura de `publishSync[plan.id]` y `retryPublish` que expone el store (`useApp()` /
   props). Coordinar con Agente B (sección 4b). Si el store todavía no expone `publishSync` al
   momento de integrar, dejar el chip leyendo la nueva fuente y el orquestador conecta.
3. **Preview:** `buildPlanHTML(plan, {preview:true})` ahora mostrará tachado/%. OK, no requiere
   cambios extra (el editor no marca done, pero el preview reflejará lo que haya).

---

## 7. Reparto y reglas anti-colisión

| Agente | Archivos (EXCLUSIVOS) | Modelo |
|---|---|---|
| **A** | `src/plan/planModel.js`, `src/plan/planTemplate.js`, `planes-web/lib/planModel.js`, `planes-web/lib/planTemplate.js` | Sonnet |
| **B** | `src/InsightsApp.jsx` | Opus (razonamiento alto) |
| **C** | `src/plan/PlannerView.jsx` | Sonnet |

- Ningún agente toca archivos de otro. Si necesitás algo de otro archivo, asumí el **contrato**
  de este spec (firmas sección 2).
- Todos los helpers nuevos se **importan desde `./planModel.js`** (B: `../plan/planModel.js`).
- No renombrar exports existentes. No cambiar el comportamiento del merge realtime ni del
  debounce de guardado.
- Al terminar: cada agente reporta qué exportó/cambió y cualquier suposición sobre el contrato.

---

## 8. Verificación E2E (orquestador, tras integrar)

1. `npm run dev` (Vite, localhost:5173) — abrir con `?pm=u7` (o el harness sin login si aplica).
2. Abrir proyecto **Real Deal Exchange AI** (tiene plan `rdx`, 12 semanas ↔ 12 sprints).
3. Sección "Avance del plan": expandir Semana 1, tachar tareas → ver tachado + % subir.
4. Tachar TODAS las de una semana → el sprint de esa semana pasa a "terminado" (y al revés).
5. Marcar un sprint "terminado" en la tabla → su semana queda completa en el acordeón.
6. Consola/red sin errores. Verificar guardado a `plans` (Network → supabase).
7. **Link público:** correr `planes-web` local (`npm run dev` en `C:\MisProyectos\INSIGHTS\planes-web`,
   tiene `.env.local`), abrir `/rdx`, marcar avance en la app y confirmar que el link recarga y
   muestra tachado + %. (Deploy a prod = `planes-web/deploy.ps1` con Vercel CLI — queda para Manuel.)
8. `npm run build` verde.

---

## 9. Decisiones registradas
- Vínculo: **semana↔sprint bidireccional + tareas sueltas** (Manuel, 2026-07-18).
- UI de marcado: **en el detalle del proyecto**.
- Vista cliente: **tareas tachadas + % de avance**.
- Sin cambios de schema Supabase (todo en `data` jsonb).
