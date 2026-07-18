/**
 * planModel.js — modelo de datos, constantes, iconos y helpers del Generador de Planes.
 *
 * JS PURO. Cero React, cero JSX, cero imports de node_modules.
 * Debe poder ejecutarse con `node` directamente: eso es lo que hace posible
 * verificarlo sin test runner.
 *
 * Referencia del modelo: plan/docs/MASTER_PLAN.md §4.
 * Referencia visual (de donde salen los SVG): rdx-plan-cliente/index.html.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes (§4 del spec, textual)
// ─────────────────────────────────────────────────────────────────────────────

export const HITO_COLORS = {
  discovery: '#c2c8d2', green: '#3ddc97', purple: '#a896f7',
  gold:      '#f0b94d', blue:  '#6db3f2', rose:   '#f2789f',
}

/**
 * Paleta y orden de íconos de las etapas del editor simple.
 * El usuario NO elige color ni ícono: se asignan por índice desde acá (D-simple).
 */
export const STAGE_COLORS = [
  HITO_COLORS.discovery, HITO_COLORS.green, HITO_COLORS.purple,
  HITO_COLORS.gold, HITO_COLORS.blue, HITO_COLORS.rose,
]
export const STAGE_ICON_ORDER = ['search', 'database', 'chip', 'rocket']

export const NEUTRAL_HITO = {              // fallback para semanas huérfanas (T6)
  id: '_neutral', label: '—', title: '', color: '#8a8a8a',
  daysLabel: '', icon: 'search', isMilestone: false,
}

export const WEEK_TYPES = {
  info:   { label: 'Avance semanal',         icon: 'live',   cls: '' },
  doc:    { label: 'Entregable documental',  icon: 'doc',    cls: '' },
  gate:   { label: 'Gate de anticipo',       icon: 'gate',   cls: 't-gate' },
  formal: { label: 'Entrega formal de hito', icon: 'formal', cls: 't-formal' },
}

export const DELIVER_KINDS = {
  doc: 'Entregable', live: 'Demo en vivo · Loom',
  gate: 'Gate de anticipo', formal: 'Aceptación formal',
}

/** Un plan con estos slugs pisaría archivos del sitio estático (T8). */
export const SLUG_BLOCKLIST = ['index', 'robots', 'vercel', '404', 'favicon']

/** El slug es la ruta pública: minúsculas, guiones, sin bordes raros. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/

/**
 * Único formato de color aceptado en cualquier lugar que termine en CSS (D-D).
 *
 * Hex CSS válido = exactamente 3, 4, 6 u 8 dígitos. `#12345` y `#1234567` son hex
 * puro (no inyectan nada) pero el parser CSS los DESCARTA en silencio: el chip, el
 * tick y el deliver salen transparentes en una página que ve un cliente. Los
 * rechazamos acá para que validatePlan los muestre como error, en vez de romper
 * el color sin avisar.
 */
export const COLOR_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/** Un href de navLink solo puede ser un ancla interna o un http(s) absoluto (D-D). */
export const HREF_RE = /^(#[^\s"'<>]+|https?:\/\/[^\s"'<>]+)$/

// ─────────────────────────────────────────────────────────────────────────────
// Registros de iconos (B5)
//
// OJO: el objeto ICONS del original SOLO tiene doc/live/gate/formal/tick/cal.
// Los iconos de fase y de esquema son SVG inline hardcodeados en el markup.
// Todos los strings de abajo están copiados TEXTUALMENTE de
// rdx-plan-cliente/index.html. No los "mejores": romperías la fidelidad visual.
// ─────────────────────────────────────────────────────────────────────────────

/** Iconos de las tarjetas de fase (`hito.icon`). Del markup de #fases. */
export const PHASE_ICONS = {
  search:   '<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  database: '<svg class="ic" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  chip:     '<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h6v6H9z"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
  rocket:   '<svg class="ic" viewBox="0 0 24 24"><path d="M5 16l-2 5 5-2M12 3c4 2 6 6 6 10 0 0-2 1-4 3-1-2-4-5-6-6 2-2 3-4 4-7z"/><circle cx="14" cy="9" r="1.4"/></svg>',
}

/** Iconos de las tarjetas del bento de #trabajo (`schemaCard.icon`). */
export const SCHEMA_ICONS = {
  video: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/><path d="M4 19h16"/></svg>',
  chat:  '<svg class="ic" viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 01-11.6 7.8L3 21l1.7-6.4A8.4 8.4 0 1121 11.5z"/></svg>',
  grid:  '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
}

/** El objeto ICONS del original, tal cual. Lo consume el JS embebido del template. */
export const UI_ICONS = {
  doc:    '<svg class="ic" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  live:   '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
  gate:   '<svg class="ic" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  formal: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
  tick:   '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12l4 4 10-11"/></svg>',
  cal:    '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
}

/** El `+` del logo, dentro de `.brand .spark`. */
export const BRAND_SPARK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v18M3 12h18" stroke-linecap="round"/></svg>'

/** La flecha del botón "Descargar PDF". */
export const DOWNLOAD_ICON =
  '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros
// ─────────────────────────────────────────────────────────────────────────────

/** Mismo generador de ids que el resto de la app (src/ui.jsx). No hay nanoid. */
export const uid = () => Math.random().toString(36).slice(2, 10)

/**
 * "Real Deal Exchange AI" → "real-deal-exchange-ai"
 * Saca diacríticos, baja a minúsculas, colapsa todo lo que no sea [a-z0-9] en un guión.
 * Nunca devuelve vacío: si no queda nada, devuelve 'plan'.
 */
export function slugify(title) {
  const out = String(title ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // combining marks: los acentos que dejo el NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return out || 'plan'
}

/**
 * ¿Se puede usar este slug? Único entre `plans` (ignorando el propio `selfId`),
 * fuera del blocklist, y con formato de ruta válido.
 */
export function isSlugAllowed(slug, plans = [], selfId = null) {
  const s = String(slug ?? '')
  if (!SLUG_RE.test(s)) return false
  if (SLUG_BLOCKLIST.includes(s)) return false
  return !(Array.isArray(plans) ? plans : []).some(
    (p) => p && p.id !== selfId && p.slug === s
  )
}

/**
 * El hito cuyo rango [weekFrom, weekTo] contiene la semana `n`.
 * Si hay solape, gana el primero. Si no hay ninguno, NEUTRAL_HITO. Nunca tira. (T6)
 */
export function hitoForWeek(plan, n) {
  const hitos = (plan && Array.isArray(plan.hitos)) ? plan.hitos : []
  const num = Number(n)
  for (const h of hitos) {
    if (!h) continue
    if (Number(h.weekFrom) <= num && num <= Number(h.weekTo)) return h
  }
  return NEUTRAL_HITO
}

/** El chip de días de una semana: override manual, o el del hito que la contiene. (D12) */
export function daysForWeek(plan, w) {
  if (!w) return ''
  return w.daysOverride ?? hitoForWeek(plan, w.n).daysLabel
}

/** Una semana en blanco, lista para llenar. */
export function emptyWeek(n) {
  return {
    n,
    title: '',
    type: 'info',
    tasks: [],
    deliver: { kind: 'doc', text: '' },
    daysOverride: null,
  }
}

/** ¿Esta semana tiene algo escrito? Sirve para avisar antes de truncar (T1). */
export function weekHasContent(w) {
  if (!w) return false
  const hasTitle = typeof w.title === 'string' && w.title.trim() !== ''
  const hasTasks = Array.isArray(w.tasks) && w.tasks.length > 0
  return hasTitle || hasTasks
}

// ─────────────────────────────────────────────────────────────────────────────
// Tareas de semana — avance del plan (tachado + % vinculado a sprints)
//
// `week.tasks` históricamente es `string[]`. Pasa a `{id,text,done}[]`, con
// retrocompatibilidad total: en disco puede seguir habiendo strings de planes
// viejos. Lectura (render) NUNCA genera ids — usa taskText/taskDone, que
// aceptan ambas formas. Escritura (toggle/editor/migración) SIEMPRE normaliza
// con normalizeTask/normalizeTasks, que sí generan id vía uid().
// ─────────────────────────────────────────────────────────────────────────────

/** Texto de una tarea, venga como string vieja o como Task. Nunca genera id. */
export function taskText(t) { return typeof t === 'string' ? t : (t && t.text) || '' }

/** ¿Está tachada? Un string viejo nunca lo está. Nunca genera id. */
export function taskDone(t) { return typeof t === 'string' ? false : !!(t && t.done) }

/** Normaliza una TaskLike a Task, generando id si falta (o si viene de un string viejo). */
export function normalizeTask(t) {
  if (t && typeof t === 'object') return { id: t.id || uid(), text: t.text || '', done: !!t.done }
  return { id: uid(), text: String(t == null ? '' : t), done: false }
}

/** normalizeTask aplicado a todo `week.tasks`. */
export function normalizeTasks(tasks) { return (Array.isArray(tasks) ? tasks : []).map(normalizeTask) }

/** Avance de una semana: cuántas tareas están done sobre el total. pct entero 0..100 (0 si total===0). */
export function weekProgress(week) {
  const ts = Array.isArray(week && week.tasks) ? week.tasks : []
  const total = ts.length
  const done = ts.filter(taskDone).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/** Avance de todo el plan: suma de weekProgress() de cada semana. */
export function planProgress(plan) {
  const weeks = Array.isArray(plan && plan.weeks) ? plan.weeks : []
  let done = 0, total = 0
  for (const w of weeks) { const p = weekProgress(w); done += p.done; total += p.total }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/**
 * Togglea el done de la tarea en `index` (índice del render, referencia estable
 * del click en el acordeón). Devuelve una NUEVA week con `tasks` normalizadas
 * (inmutable: no muta `week` ni sus tasks).
 */
export function toggleTaskDone(week, index) {
  const tasks = normalizeTasks(week && week.tasks)
  if (index < 0 || index >= tasks.length) return { ...week, tasks }
  tasks[index] = { ...tasks[index], done: !tasks[index].done }
  return { ...week, tasks }
}

/** Marca TODAS las tareas de una semana como done (o no-done). Misma inmutabilidad que toggleTaskDone. */
export function setWeekAllDone(week, done) {
  const tasks = normalizeTasks(week && week.tasks).map((t) => ({ ...t, done: !!done }))
  return { ...week, tasks }
}

/**
 * El sprint apareado con la semana `n`: por `sprint.week`, o por su posición
 * (i+1) como fallback. Primer match. Pura — `sprints` es `project.sprints`.
 */
export function sprintForWeek(sprints, n) {
  const arr = Array.isArray(sprints) ? sprints : []
  return arr.find((s, i) => (s.week || (i + 1)) === n) || null
}

/** Tope duro de semanas. Ningún plan real se acerca; existe para acotar el input. */
export const MAX_WEEKS = 200

/**
 * Normaliza el `count` que llega de un <input type="number">.
 * Ese input acepta notación exponencial: "1e400" llega como string y
 * `Math.floor(Number("1e400"))` es Infinity — un `for (i < Infinity)` cuelga la pestaña,
 * y "999999999" aloca mil millones de objetos. Todo lo raro cae a un entero en [0, MAX_WEEKS].
 */
export function clampWeekCount(count) {
  const n = Math.floor(Number(count))
  // +Infinity es "todas las que se pueda" → el tope. NaN y -Infinity → 0.
  if (!Number.isFinite(n)) return n === Infinity ? MAX_WEEKS : 0
  return Math.min(MAX_WEEKS, Math.max(0, n))
}

/**
 * Devuelve el array `weeks` ajustado a `count`.
 * Subir agrega semanas vacías; bajar TRUNCA. Siempre renumera `n = i + 1`.
 *
 * Es PURA: no pregunta nada, no usa confirm, y no comparte estructuras con `plan`.
 * Las semanas que sobreviven se clonan hasta `tasks` y `deliver`: si compartieran
 * esos objetos, un `tasks.push()` del editor mutaría el plan viejo (y el `useMemo`
 * de la preview, que compara por identidad, no se enteraría).
 * La confirmación (T1) la hace la UI ANTES de llamar acá, con lo que le devuelve
 * `weeksToLose()`.
 */
export function resyncWeeks(plan, count) {
  const current = (plan && Array.isArray(plan.weeks)) ? plan.weeks : []
  const target = clampWeekCount(count)
  const out = []
  for (let i = 0; i < target; i++) {
    const w = current[i]
    out.push(w
      ? {
          ...w,
          n: i + 1,
          tasks: Array.isArray(w.tasks) ? [...w.tasks] : [],
          deliver: { ...(w.deliver ?? {}) },
        }
      : emptyWeek(i + 1))
  }
  return out
}

/**
 * Qué se pierde si bajamos a `count` semanas. Insumo del window.confirm de la UI (T1).
 * Usa el MISMO clamp que resyncWeeks: si no, el confirm mentiría sobre lo que se pierde.
 * → { weeks: [...], count: number, withContent: number }
 */
export function weeksToLose(plan, count) {
  const current = (plan && Array.isArray(plan.weeks)) ? plan.weeks : []
  const target = clampWeekCount(count)
  const lost = current.slice(target)
  return {
    weeks: lost,
    count: lost.length,
    withContent: lost.filter(weekHasContent).length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeStages — las "etapas livianas" del editor simple → hitos completos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El editor simple deja al usuario elegir SOLO el nombre y "termina en la semana X"
 * de cada etapa. Todo lo demás se deriva acá y el resultado son hitos con la forma
 * completa que ya consumen el template y validatePlan (no hay que tocar nada más):
 *
 *   · el rango arranca donde terminó la etapa anterior (cascada) → nunca se solapan;
 *   · color e ícono salen de STAGE_COLORS / STAGE_ICON_ORDER por índice;
 *   · label ("Etapa N") y weeksLabel ("Semanas X–Y") se arman solos;
 *   · isMilestone queda en true (todas cuentan como hito formal).
 *
 * Es PURA: no muta la entrada ni comparte estructuras con ella.
 */
export function normalizeStages(stages) {
  const list = Array.isArray(stages) ? stages : []
  let from = 1
  return list.map((s, i) => {
    const askedTo = s && s.weekTo != null && s.weekTo !== '' ? clampWeekCount(s.weekTo) : from
    const to = Math.max(from, askedTo || from)
    const hito = {
      id: (s && s.id) || uid(),
      label: `Etapa ${i + 1}`,
      title: (s && typeof s.title === 'string') ? s.title : '',
      description: (s && typeof s.description === 'string') ? s.description : '',
      weeksLabel: from === to ? `Semana ${from}` : `Semanas ${from}–${to}`,
      daysLabel: '',
      color: STAGE_COLORS[i % STAGE_COLORS.length],
      icon: STAGE_ICON_ORDER[i % STAGE_ICON_ORDER.length],
      weekFrom: from,
      weekTo: to,
      isMilestone: true,
    }
    from = to + 1
    return hito
  })
}

/**
 * Sugerencia para el botón "recalcular" de las stats del hero.
 * NO es fuente de verdad (G7): el usuario puede escribir lo que quiera.
 * `n` siempre string, porque en el hero se renderiza tal cual.
 */
export function suggestStats(plan) {
  const weeks = (plan && Array.isArray(plan.weeks)) ? plan.weeks : []
  const hitos = (plan && Array.isArray(plan.hitos)) ? plan.hitos : []
  return [
    { n: String(weeks.length),                              k: 'semanas de recorrido' },
    { n: String(hitos.filter((h) => h && h.isMilestone).length), k: 'hitos formales' },
    { n: String(hitos.length),                              k: 'fases de trabajo' },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// validatePlan — ADVIERTE, NUNCA ROMPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Revisa el plan y devuelve una lista de avisos: [{ level: 'warn'|'error', msg }].
 * Nunca tira una excepción y nunca modifica el plan.
 * La UI los muestra como avisos NO bloqueantes.
 */
export function validatePlan(plan) {
  const out = []
  const warn = (msg) => out.push({ level: 'warn', msg })
  const error = (msg) => out.push({ level: 'error', msg })

  if (!plan || typeof plan !== 'object') {
    return [{ level: 'error', msg: 'El plan está vacío o no es un objeto.' }]
  }

  const weeks = Array.isArray(plan.weeks) ? plan.weeks : []
  const hitos = Array.isArray(plan.hitos) ? plan.hitos : []
  const total = weeks.length

  // ── Slug ───────────────────────────────────────────────────────────────────
  const slug = String(plan.slug ?? '')
  if (!slug) {
    warn('El plan todavía no tiene una dirección web (slug). Poné una antes de publicarlo.')
  } else if (SLUG_BLOCKLIST.includes(slug)) {
    error(`La dirección "${slug}" está reservada por el sitio. Elegí otra.`)
  } else if (!SLUG_RE.test(slug)) {
    error(`La dirección "${slug}" no es válida: solo minúsculas, números y guiones, entre 2 y 60 caracteres.`)
  }

  // ── Estructura mínima ──────────────────────────────────────────────────────
  if (total === 0) error('El plan no tiene ninguna semana.')
  if (hitos.length === 0) error('El plan no tiene ningún hito.')

  // ── Portada ────────────────────────────────────────────────────────────────
  const subtitle = String(plan.subtitle ?? '')
  if (subtitle.length > 30) {
    warn(`El subtítulo tiene ${subtitle.length} caracteres. Va dentro del título grande: arriba de 30 se ve mal.`)
  }
  if (!String(plan.title ?? '').trim()) warn('El plan no tiene título.')

  // ── Colores ────────────────────────────────────────────────────────────────
  const badColor = (c) => !COLOR_RE.test(String(c ?? ''))
  hitos.forEach((h, i) => {
    if (h && badColor(h.color)) {
      error(`El color del hito "${(h && h.label) || i + 1}" no es un hexadecimal válido (ej: #3ddc97).`)
    }
  })
  ;(Array.isArray(plan.stats) ? plan.stats : []).forEach((s, i) => {
    if (s && s.color != null && badColor(s.color)) {
      error(`El color de la tarjeta ${i + 1} del encabezado no es un hexadecimal válido.`)
    }
  })
  ;(Array.isArray(plan.schema) ? plan.schema : []).forEach((c, i) => {
    if (c && c.color != null && badColor(c.color)) {
      error(`El color de la tarjeta "${(c && c.title) || i + 1}" del esquema no es un hexadecimal válido.`)
    }
  })

  // ── Rangos de hitos: límites, huecos y solapes ─────────────────────────────
  const owner = new Array(total + 1).fill(null)   // 1-indexed
  hitos.forEach((h, i) => {
    if (!h) return
    const name = h.label || h.id || `#${i + 1}`
    const from = Number(h.weekFrom)
    const to = Number(h.weekTo)
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      error(`El hito "${name}" no tiene un rango de semanas válido.`)
      return
    }
    if (from > to) {
      error(`El hito "${name}" empieza en la semana ${from} y termina en la ${to}.`)
      return
    }
    if (total > 0 && (from < 1 || to > total)) {
      error(`El hito "${name}" cubre las semanas ${from}–${to}, fuera del plan (1–${total}).`)
    }
    for (let n = Math.max(1, from); n <= Math.min(total, to); n++) {
      if (owner[n] === null) owner[n] = name
      else error(`La semana ${n} está en dos hitos a la vez: "${owner[n]}" y "${name}".`)
    }
  })

  const huerfanas = []
  for (let n = 1; n <= total; n++) if (owner[n] === null) huerfanas.push(n)
  if (huerfanas.length) {
    warn(`Sin hito asignado: ${huerfanas.length === 1 ? 'la semana' : 'las semanas'} ${huerfanas.join(', ')}. Van a salir en gris.`)
  }

  // ── Semanas ────────────────────────────────────────────────────────────────
  weeks.forEach((w, i) => {
    const n = (w && w.n) || i + 1
    if (!w) { error(`La semana ${n} está vacía.`); return }
    if (!String(w.title ?? '').trim()) warn(`La semana ${n} no tiene título.`)
    if (!Array.isArray(w.tasks) || w.tasks.length === 0) warn(`La semana ${n} no tiene items.`)
    if (!Object.prototype.hasOwnProperty.call(WEEK_TYPES, w.type)) {
      error(`La semana ${n} tiene un tipo desconocido: "${w.type}".`)
    }
    const kind = w.deliver && w.deliver.kind
    if (!Object.prototype.hasOwnProperty.call(DELIVER_KINDS, kind)) {
      error(`La semana ${n} tiene un tipo de entregable desconocido: "${kind}".`)
    }
  })

  // ── Navegación ─────────────────────────────────────────────────────────────
  ;(Array.isArray(plan.navLinks) ? plan.navLinks : []).forEach((l, i) => {
    const href = String((l && l.href) ?? '')
    if (!HREF_RE.test(href)) {
      error(`El link "${(l && l.label) || i + 1}" del menú apunta a un destino no permitido.`)
    }
  })
  if (plan.showSchema === false && (Array.isArray(plan.navLinks) ? plan.navLinks : []).some((l) => l && l.href === '#trabajo')) {
    warn('El esquema de trabajo está oculto, pero el menú todavía lo linkea. Sacá ese link.')
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// newPlan — el punto de partida cuando alguien crea un plan nuevo
// ─────────────────────────────────────────────────────────────────────────────

const STAT_COLORS = [HITO_COLORS.discovery, HITO_COLORS.green, HITO_COLORS.purple, HITO_COLORS.gold]

/**
 * Plan nuevo con defaults sensatos: 4 fases (Discovery + 3 hitos formales),
 * 12 semanas vacías, y todo el copy de secciones precargado y editable.
 *
 * El copy de `sections.phases` dice "Cuatro fases, tres hitos" porque eso es
 * exactamente lo que este plan tiene el día que nace. Si el usuario cambia los
 * hitos, tiene que cambiarlo — por eso es un campo del modelo y no un hardcode (T5).
 *
 * `slug` arranca vacío: lo fija la UI al crear, y de ahí no se regenera solo (T8).
 */
export function newPlan() {
  const now = new Date().toISOString()

  // Cuatro etapas por defecto repartidas sobre 12 semanas. Nacen sin nombre: el
  // usuario se los pone desde el editor simple. El color, el ícono y el rango los
  // deriva normalizeStages — nada de esto se elige a mano (D-simple).
  const hitos = normalizeStages([
    { title: '', weekTo: 3 },
    { title: '', weekTo: 7 },
    { title: '', weekTo: 10 },
    { title: '', weekTo: 12 },
  ])

  const weeks = []
  for (let i = 1; i <= 12; i++) weeks.push(emptyWeek(i))

  return {
    id: uid(),
    slug: '',
    title: 'Plan de ejecución',
    subtitle: 'semana a semana.',
    heroEyebrow: 'Insights Apps · Plan de ejecución',
    lead: 'Plan de ejecución de 12 semanas — del discovery al handover en producción. Claridad total de entregables y revisiones formales, con avances navegables uno por uno.',
    metaLine: '',
    clientName: '',
    projectId: null,
    publishedUrl: '',

    // Se derivan del título / lead en el template si quedan vacíos (campos avanzados).
    docTitle: '',
    metaDescription: '',

    brand: { name: 'Insights', tagline: '' },

    stats: [],

    hitos,
    weeks,

    showSchema: true,
    schema: [
      {
        id: uid(),
        icon: 'video',
        title: 'Avance semanal en video',
        text: 'Cada viernes: un deploy navegable más un video corto recorriendo lo nuevo de la semana. Ves el avance, no solo lo leés.',
        tags: ['Loom', 'Vercel Preview', 'Viernes'],
        color: HITO_COLORS.green,
      },
      {
        id: uid(),
        icon: 'check',
        title: 'Revisión formal de hito',
        text: 'Al cerrar cada hito: reunión estructurada con criterios de aceptación definidos de antemano. Es la entrega que dispara la aprobación.',
        tags: ['Criterios de aceptación'],
        color: HITO_COLORS.gold,
      },
      {
        id: uid(),
        icon: 'chat',
        title: 'Canal directo siempre abierto',
        text: 'WhatsApp y correo para preguntas, dudas y decisiones rápidas durante toda la semana. No esperás al viernes para destrabar algo.',
        tags: ['WhatsApp', 'Asíncrono'],
        color: HITO_COLORS.purple,
      },
      {
        id: uid(),
        icon: 'grid',
        title: 'Tablero de avance visible',
        text: 'Estado de las tareas actualizado cada semana, accesible para vos y para tu equipo. Siempre sabés qué está hecho, qué sigue y qué espera input tuyo.',
        tags: ['Transparencia', 'Tiempo real'],
        color: HITO_COLORS.discovery,
      },
    ],

    sections: {
      schema: {
        eyebrow: 'Esquema de trabajo',
        title: 'Cómo trabajamos juntos',
        lead: 'Separamos la mecánica de comunicación del plan de ejecución. Cada semana hay un avance visible; cada hito, una revisión formal con criterios de aceptación.',
      },
      phases: {
        eyebrow: 'El recorrido',
        title: 'El plan, etapa por etapa',
        lead: 'El trabajo avanza por etapas. Cada semana deja un avance visible y cada etapa cierra con su entrega.',
      },
      weeks: {
        eyebrow: 'Detalle',
        title: 'Semana a semana',
        lead: 'Tocá cualquier semana para ver qué se hace y qué se entrega. Usá las flechas del teclado para recorrerlas.',
      },
    },

    navLinks: [
      { label: 'Esquema', href: '#trabajo' },
      { label: 'Fases',   href: '#fases' },
      { label: 'Semanas', href: '#semanas' },
    ],
    scrollCue: 'Desliza para recorrer el plan',

    footer: {
      big: 'Listo para empezar con claridad total desde el día uno.',
      brand: 'Insights Apps',
      lines: [
        'Plan de ejecución · 12 semanas',
        'Documento de presentación — ' + new Date().getFullYear(),
      ],
    },

    createdAt: now,
    updatedAt: now,
  }
}
