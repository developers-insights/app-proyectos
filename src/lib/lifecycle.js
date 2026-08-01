/**
 * lifecycle.js — ciclo de vida comercial de un proyecto (Insights OS).
 *
 * JS PURO: cero React, cero imports. Se puede correr con `node` directamente.
 *
 * Un proyecto pasa por tres fases, y el cambio de fase SIEMPRE lo hace una
 * persona con un botón. El sistema solo *sugiere* cuándo corresponde
 * (suggestedTransition): nada acá cambia la fase solo, porque el pase a
 * mantenimiento implica empezar a cobrar y eso no se automatiza a ciegas.
 *
 *   1 · Desarrollo            → arranca con el onboarding del cliente. Días que SUBEN.
 *   2 · Prueba + marketing    → 30 días (configurable). Días que BAJAN.
 *   3 · Mantenimiento         → cobro mensual recurrente. Días hasta el próximo cobro.
 *
 * Forma del modelo (vive dentro del jsonb del proyecto, en project.lifecycle):
 *   {
 *     phase: 1 | 2 | 3,
 *     startedAt: ISO,                    // arranque de fase 1
 *     phase2At: ISO | null,
 *     phase3At: ISO | null,
 *     trialDays: 30,
 *     maintenanceAmount: number | null,  // USD por mes
 *     billingDay: number | null,         // día del mes del cobro (1-28)
 *     lastNoticeSentAt: ISO | null,      // último aviso de cobro enviado
 *   }
 *
 * Todas las funciones son PURAS y reciben `now` inyectable: sin eso no se puede
 * testear un contador de días sin viajar en el tiempo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadatos de cada fase. `colorVar` es el NOMBRE de la CSS var (sin `var(...)`)
 * para que la UI arme `var(${colorVar})` o `var(${colorVar}-soft)` a gusto.
 */
export const PHASES = [
  { phase: 1, key: 'desarrollo',    label: 'Desarrollo',      colorVar: '--accent' },
  { phase: 2, key: 'prueba',        label: 'Prueba gratis',   colorVar: '--green'  },
  { phase: 3, key: 'mantenimiento', label: 'Mantenimiento',   colorVar: '--blue'   },
]

/** Metadatos de una fase por número. Cualquier cosa rara cae en fase 1. */
export function phaseMeta(phase) {
  return PHASES.find((p) => p.phase === phase) || PHASES[0]
}

export const DEFAULT_TRIAL_DAYS = 30

/** Días de anticipación del aviso de cobro (fase 3). */
export const BILLING_NOTICE_DAYS = 7

// ─────────────────────────────────────────────────────────────────────────────
// Fechas
//
// Toda la aritmética de días se hace sobre fechas normalizadas a medianoche
// LOCAL. Restar dos ISO crudos y dividir por 86.400.000 da off-by-one apenas
// cambia la hora del día o entra un cambio de horario de verano: "hace 1 día"
// pasaría a "hace 0" según a qué hora se abra la app. Normalizar primero y
// redondear el cociente elimina las dos fuentes de error.
// ─────────────────────────────────────────────────────────────────────────────

const MS_DAY = 86400000

/** Fecha válida a partir de un ISO / Date / timestamp. `null` si no se puede. */
export function toDate(value) {
  if (value == null || value === '') return null
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Medianoche local del día de `value`. `null` si la fecha es inválida. */
export function startOfDay(value) {
  const d = toDate(value)
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Días calendario enteros de `a` a `b` (positivo si `b` es posterior).
 * `null` si alguna fecha es inválida.
 */
export function daysBetween(a, b) {
  const from = startOfDay(a)
  const to = startOfDay(b)
  if (!from || !to) return null
  return Math.round((to.getTime() - from.getTime()) / MS_DAY)
}

/** Último día del mes (1-31) de un año/mes dados. `month` es 0-indexed. */
function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Fecha del cobro dentro de un mes concreto, recortando el día al último día
 * disponible: un billingDay 31 en febrero cobra el 28 (o 29), no se saltea el mes.
 */
function billingDateIn(year, month, day) {
  return new Date(year, month, Math.min(day, lastDayOfMonth(year, month)))
}

/** ISO de una fecha, tolerante. `null` si es inválida. */
function iso(value) {
  const d = toDate(value)
  return d ? d.toISOString() : null
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeLifecycle — retrocompatibilidad con los proyectos viejos
// ─────────────────────────────────────────────────────────────────────────────

function clampInt(n, min, max, fallback) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

/**
 * Lifecycle válido para CUALQUIER proyecto, tenga o no el campo.
 *
 * Idempotente y no destructiva: nunca pisa un dato existente con un default,
 * solo completa lo que falta o está corrupto. Un proyecto viejo (sin lifecycle)
 * queda en fase 1 arrancando en su `createdAt`, que es lo más cercano a la
 * verdad que tenemos antes de que existiera el onboarding.
 */
export function normalizeLifecycle(project) {
  const p = project && typeof project === 'object' ? project : {}
  const raw = p.lifecycle && typeof p.lifecycle === 'object' ? p.lifecycle : {}

  const startedAt = iso(raw.startedAt) || iso(p.createdAt) || null
  const phase2At = iso(raw.phase2At)
  const phase3At = iso(raw.phase3At)

  // La fase declarada manda, pero si es basura la inferimos de los sellos de
  // fecha: un proyecto con phase3At es mantenimiento aunque `phase` venga rota.
  //
  // Ojo con Number(null) === 0 y Number('') === 0: pasar eso por clampInt(1,3)
  // devolvía 1 y la inferencia de abajo NUNCA corría, así que una fila con
  // phase: null y phase3At sellado se leía como Desarrollo (y dejaba de cobrar).
  const declared = raw.phase == null || raw.phase === '' ? NaN : Math.round(Number(raw.phase))
  let phase = Number.isFinite(declared) && declared >= 1 ? Math.min(3, declared) : 0
  if (!phase) phase = phase3At ? 3 : phase2At ? 2 : 1

  // Ojo con Number(null) === 0: un monto ausente tiene que quedar en null, no
  // en 0, o la UI mostraría "US$ 0/mes" en proyectos que ni cobran todavía.
  const amount = raw.maintenanceAmount == null || raw.maintenanceAmount === '' ? NaN : Number(raw.maintenanceAmount)
  const billingDay = raw.billingDay == null || raw.billingDay === '' ? null : clampInt(raw.billingDay, 1, 28, null)

  // Un trialDays basura (0, negativo, texto) vuelve al default, no al mínimo:
  // "la prueba dura 1 día" sería una decisión de negocio inventada.
  const trial = Math.round(Number(raw.trialDays))
  const trialDays = Number.isFinite(trial) && trial > 0 ? Math.min(3650, trial) : DEFAULT_TRIAL_DAYS

  return {
    phase,
    startedAt,
    phase2At,
    phase3At,
    trialDays,
    maintenanceAmount: Number.isFinite(amount) && amount >= 0 ? amount : null,
    billingDay,
    lastNoticeSentAt: iso(raw.lastNoticeSentAt),
  }
}

/** Fecha desde la que se cuenta la fase actual (el sello de esa fase, con fallbacks). */
function phaseAnchor(lc) {
  if (lc.phase === 3) return lc.phase3At || lc.phase2At || lc.startedAt
  if (lc.phase === 2) return lc.phase2At || lc.startedAt
  return lc.startedAt
}

// ─────────────────────────────────────────────────────────────────────────────
// phaseInfo — lo único que consume la UI para pintar el chip de fase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * → {
 *     phase, key, label, colorVar,
 *     days,            // días transcurridos en la fase actual (null si no hay fecha)
 *     countdown,       // días que faltan (fase 2 y 3). Nunca negativo.
 *     remaining,       // idem pero SIN recortar: negativo = vencido (fase 2)
 *     countdownLabel,  // texto listo para mostrar
 *     isCountdown,     // ¿el contador va para abajo?
 *     expired,         // fase 2: se pasó de los trialDays
 *     dueAt,           // fase 3: Date del próximo cobro (null en 1 y 2)
 *     trialDays,
 *   }
 */
export function phaseInfo(project, now = new Date()) {
  const lc = normalizeLifecycle(project)
  const meta = phaseMeta(lc.phase)
  const base = {
    phase: lc.phase,
    key: meta.key,
    label: meta.label,
    colorVar: meta.colorVar,
    days: null,
    countdown: null,
    remaining: null,
    countdownLabel: '—',
    isCountdown: false,
    expired: false,
    dueAt: null,
    trialDays: lc.trialDays,
  }

  const elapsed = daysBetween(phaseAnchor(lc), now)

  // ── Fase 1 · Desarrollo: el contador SUBE desde el onboarding ───────────────
  if (lc.phase === 1) {
    if (elapsed == null) return { ...base, countdownLabel: 'Sin fecha de inicio' }
    const days = Math.max(0, elapsed)
    return {
      ...base,
      days,
      countdownLabel: days === 0 ? 'Arrancó hoy' : `Día ${days + 1}`,
    }
  }

  // ── Fase 2 · Prueba gratis: el contador BAJA ───────────────────────────────
  if (lc.phase === 2) {
    if (elapsed == null) return { ...base, isCountdown: true, countdownLabel: 'Sin fecha de inicio' }
    const days = Math.max(0, elapsed)
    const remaining = lc.trialDays - days
    const expired = remaining <= 0
    return {
      ...base,
      days,
      remaining,
      countdown: Math.max(0, remaining),
      isCountdown: true,
      expired,
      countdownLabel: expired
        ? (remaining === 0 ? 'Último día de prueba' : `Prueba vencida hace ${Math.abs(remaining)} ${Math.abs(remaining) === 1 ? 'día' : 'días'}`)
        : `Faltan ${remaining} ${remaining === 1 ? 'día' : 'días'}`,
    }
  }

  // ── Fase 3 · Mantenimiento: días hasta el próximo cobro ────────────────────
  const dueAt = nextBillingDate(project, now)
  const daysUntil = dueAt ? daysBetween(now, dueAt) : null
  return {
    ...base,
    days: elapsed == null ? null : Math.max(0, elapsed),
    remaining: daysUntil,
    countdown: daysUntil == null ? null : Math.max(0, daysUntil),
    isCountdown: true,
    dueAt,
    countdownLabel: daysUntil == null
      ? 'Sin día de cobro'
      : daysUntil === 0
        ? 'Cobra hoy'
        : `Cobra en ${daysUntil} ${daysUntil === 1 ? 'día' : 'días'}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// advancePhase — el botón de cambio de fase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle NUEVO al pasar el proyecto a la fase `to`. No muta nada.
 *
 * Sella la fecha de la fase a la que se entra. Volver atrás (3→2, 2→1) borra
 * los sellos de las fases posteriores: si no, un proyecto que volvió a
 * desarrollo seguiría arrastrando un phase3At viejo y billingNotice mandaría
 * avisos de cobro de un mantenimiento que no está corriendo.
 */
export function advancePhase(project, to, now = new Date()) {
  const lc = normalizeLifecycle(project)
  const target = clampInt(to, 1, 3, lc.phase)
  const stamp = iso(now) || new Date().toISOString()

  if (target === 1) {
    return { ...lc, phase: 1, phase2At: null, phase3At: null, lastNoticeSentAt: null }
  }
  if (target === 2) {
    return { ...lc, phase: 2, phase2At: lc.phase === 2 ? lc.phase2At : stamp, phase3At: null, lastNoticeSentAt: null }
  }

  // A mantenimiento: si nadie fijó el día de cobro, se toma el día en que
  // arrancó el mantenimiento (tope 28 para que exista en todos los meses).
  const start = startOfDay(stamp) || startOfDay(new Date())
  return {
    ...lc,
    phase: 3,
    phase3At: lc.phase === 3 ? lc.phase3At : stamp,
    billingDay: lc.billingDay ?? Math.min(28, start.getDate()),
  }
}

/**
 * ¿Corresponde cambiar de fase? Devuelve `null` o `{ to, reason }`.
 * Es SOLO una sugerencia para la UI: nadie cambia la fase por su cuenta.
 *
 * `planProgress` es el desglose del PLAN asociado: `{ pct, total }` (lo que
 * devuelve progressBreakdown). Se pide `total` y no solo el porcentaje a
 * propósito: sin plan, projectProgress() cae al `project.progress` legacy que
 * quedó de los sprints eliminados, y un proyecto viejo con 100% heredado y CERO
 * tareas terminaba sugiriendo "pasá a la prueba gratis" — es decir, empujando a
 * empezar a facturar por un plan que no existe. Sin tareas reales no se sugiere.
 */
export function suggestedTransition(project, planProgress, now = new Date()) {
  const lc = normalizeLifecycle(project)
  if (lc.phase === 1) {
    const p = planProgress && typeof planProgress === 'object' ? planProgress : null
    const total = p ? Math.round(Number(p.total)) : NaN
    if (!Number.isFinite(total) || total <= 0) return null
    const pct = Number(p.pct)
    if (Number.isFinite(pct) && pct >= 100) {
      return { to: 2, reason: 'El plan está completo al 100%. Podés pasar a la prueba gratis de 30 días.' }
    }
    return null
  }
  if (lc.phase === 2) {
    const info = phaseInfo(project, now)
    if (info.expired) {
      return { to: 3, reason: `Se cumplieron los ${lc.trialDays} días de prueba. Podés pasar a mantenimiento y empezar a cobrar.` }
    }
    return null
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Cobro recurrente (fase 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Próxima fecha de cobro (Date a medianoche local) o `null` si el proyecto no
 * está en mantenimiento o no hay de dónde inferir el día.
 *
 * "Próxima" incluye HOY: si hoy es el día de cobro, devuelve hoy (daysUntil 0).
 */
export function nextBillingDate(project, now = new Date()) {
  const lc = normalizeLifecycle(project)
  if (lc.phase !== 3) return null

  const anchor = startOfDay(lc.phase3At || lc.startedAt)
  const day = lc.billingDay ?? (anchor ? Math.min(28, anchor.getDate()) : null)
  if (!day) return null

  const today = startOfDay(now)
  if (!today) return null

  const thisMonth = billingDateIn(today.getFullYear(), today.getMonth(), day)
  if (thisMonth.getTime() >= today.getTime()) return thisMonth
  return billingDateIn(today.getFullYear(), today.getMonth() + 1, day)
}

/** El cobro anterior al de `dueAt` — marca el arranque del ciclo vigente. */
function previousBillingDate(dueAt, day) {
  return billingDateIn(dueAt.getFullYear(), dueAt.getMonth() - 1, day)
}

/**
 * Aviso de cobro: → { dueAt, daysUntil, shouldNotify }
 *
 * `shouldNotify` es true cuando faltan 7 días o menos y todavía no se mandó el
 * aviso de ESTE ciclo. El anti-duplicado compara `lastNoticeSentAt` contra el
 * cobro anterior: si el último aviso es posterior a ese cobro, ya avisamos por
 * el período vigente y no se manda de nuevo (aunque la app se abra 10 veces).
 */
export function billingNotice(project, now = new Date()) {
  const lc = normalizeLifecycle(project)
  const dueAt = nextBillingDate(project, now)
  if (!dueAt) return { dueAt: null, daysUntil: null, shouldNotify: false }

  const daysUntil = daysBetween(now, dueAt)
  if (daysUntil == null || daysUntil > BILLING_NOTICE_DAYS || daysUntil < 0) {
    return { dueAt, daysUntil, shouldNotify: false }
  }

  const day = lc.billingDay ?? dueAt.getDate()
  const cycleStart = previousBillingDate(dueAt, day)
  const sent = startOfDay(lc.lastNoticeSentAt)
  const alreadySent = !!sent && sent.getTime() > cycleStart.getTime()

  return { dueAt, daysUntil, shouldNotify: !alreadySent }
}

/** Lifecycle nuevo con el aviso de cobro marcado como enviado. No muta. */
export function markNoticeSent(project, now = new Date()) {
  const lc = normalizeLifecycle(project)
  return { ...lc, lastNoticeSentAt: iso(now) || new Date().toISOString() }
}
