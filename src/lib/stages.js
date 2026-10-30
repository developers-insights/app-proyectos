/**
 * stages.js — ETAPA COMERCIAL de un proyecto (Insights OS).
 *
 * JS PURO: cero React. Es el único eje por el que se clasifican los proyectos
 * desde 2026-08 (antes había un `status` activo/pendiente/pausado/entregado que
 * convivía con el ciclo de vida y decía la mitad de la historia cada uno).
 *
 *   Onboarding  → vendido pero el desarrollo todavía no arrancó: el contador no corre
 *   Desarrollo  → se está construyendo (el MVP que vendió el closer)
 *   Fase 2      → venta nueva de ticket alto sobre el mismo cliente: otro desarrollo
 *   Free Maint. → mantenimiento sin cargo (la prueba gratis)
 *   Plan mensual → mantenimiento pago (un solo plan, US$97)
 *
 * La etapa NO reemplaza al lifecycle: lo MANDA. Cada etapa mapea a una fase del
 * ciclo de vida (1 · 2 · 3) y moverla sella las mismas fechas de siempre, así que
 * el cobro recurrente, el aviso de los 7 días y el mail siguen funcionando igual
 * sin que nadie tenga que tocar un stepper aparte.
 */

import { normalizeLifecycle, advancePhase } from './lifecycle.js'
import { annualStart } from './agreements.js'

/**
 * `phase` es la fase del lifecycle que le corresponde; `colorVar` el NOMBRE de la
 * CSS var (sin `var(...)`) para que la UI arme `var(${colorVar})` a gusto.
 * `group` parte el menú: lo que está en obra vs lo que ya se mantiene.
 */
export const PROJECT_STAGES = [
  // Onboarding: el contador de días del desarrollo NO corre (lo pidió Manuel el
  // 27/10: contaba días de proyectos que todavía no habían arrancado). Entrar acá
  // lo pone en cero y pasar a Desarrollo lo arranca desde ese momento.
  { key: 'onboarding', label: 'Onboarding',  group: 'obra',          phase: 1, colorVar: '--text-dim', hint: 'Todavía no arrancó el desarrollo', waiting: true },
  { key: 'desarrollo', label: 'Desarrollo',  group: 'obra',          phase: 1, colorVar: '--accent', hint: 'Se está construyendo' },
  { key: 'fase2',      label: 'Fase 2',      group: 'obra',          phase: 1, colorVar: '--violet', hint: 'Venta nueva sobre el mismo cliente' },
  { key: 'free',       label: 'Free Maint.', group: 'mantenimiento', phase: 2, colorVar: '--blue',   hint: 'Mantenimiento sin cargo' },
  { key: 'plan',       label: 'Plan mensual', group: 'mantenimiento', phase: 3, colorVar: '--green',  hint: 'US$97 por mes' },
  // Ramas de acuerdo (call del 30/10): no cobran el plan mensual, así que no tocan el
  // ciclo de vida ni el cobro. A diferencia de los terminales, el proyecto sigue vivo.
  { key: 'anual',      label: 'Plan anual',  group: 'acuerdo', phase: 9, colorVar: '--green',  hint: 'Marketing y mantenimiento por un año', agreement: true },
  { key: 'partner',    label: 'Partner',     group: 'acuerdo', phase: 9, colorVar: '--accent', hint: 'Marketing y proyecto a cambio de un porcentaje', agreement: true },
  // Estados TERMINALES (no tocan el ciclo de vida ni el cobro): el desarrollo ya no
  // corre. `terminal:true` los saca de los recordatorios y del contador de fase.
  { key: 'finalizado', label: 'Finalizado',  group: 'cerrado', phase: 9, colorVar: '--green',      hint: 'Desarrollo terminado, sin mantenimiento vendido', terminal: true, offerMaintenance: true },
  { key: 'pausado',    label: 'Pausado',     group: 'cerrado', phase: 9, colorVar: '--yellow',     hint: 'Pausado por el cliente', terminal: true },
  { key: 'cancelado',  label: 'Cancelado',   group: 'cerrado', phase: 9, colorVar: '--red',        hint: 'Cancelado por el cliente o por nosotros', terminal: true },
]

export const STAGE_GROUPS = [
  { key: 'obra',          label: 'En obra' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'acuerdo',       label: 'Acuerdos' },
  { key: 'cerrado',       label: 'Cerrados' },
]

/** ¿La etapa implica que el desarrollo ya terminó? (mantenimiento o finalizado → 100%). */
export const isDevelopmentDone = (key) => ['free', 'plan', 'finalizado', 'anual', 'partner'].includes(key)

/** Metadatos de una etapa por clave. Cualquier cosa rara cae en Desarrollo. */
export const stageMeta = (key) => PROJECT_STAGES.find((s) => s.key === normalizeStageKey(key)) || PROJECT_STAGES.find((s) => s.key === 'desarrollo')

/* Starter/Kaizen/Scale quedaron guardados en proyectos viejos: hoy son un único plan. */
const LEGACY_PLAN_KEYS = ['starter', 'kaizen', 'scale']
const normalizeStageKey = (key) => (LEGACY_PLAN_KEYS.includes(key) ? 'plan' : key)

/**
 * Etapa vigente de un proyecto, tenga o no el campo.
 *
 * Los proyectos anteriores a las etapas no tienen `stage`: se deriva de la fase
 * del ciclo de vida, que es el dato que sí venían llevando. Un proyecto en fase 3
 * (mantenimiento pago) es el Plan mensual.
 */
export function projectStage(project) {
  const raw = project && project.stage
  const key = normalizeStageKey(raw)
  if (key && PROJECT_STAGES.some((s) => s.key === key)) return key
  const phase = normalizeLifecycle(project).phase
  if (phase === 3) return 'plan'
  if (phase === 2) return 'free'
  return 'desarrollo'
}

/** ¿La etapa cobra? (el Plan mensual). */
export const isPaidStage = (key) => stageMeta(key).phase === 3

/**
 * Campos NUEVOS del proyecto al moverlo a `key`: `{ stage, lifecycle }`. No muta.
 *
 * Delega en advancePhase, que es quien sabe qué sellos poner y cuáles borrar.
 * Moverse a un plan con el proyecto ya en fase 3 NO reinicia nada: advancePhase
 * respeta el phase3At que ya estaba.
 */
export function applyStage(project, key, now = new Date()) {
  const meta = stageMeta(key)
  const current = projectStage(project)
  const stamp = now.toISOString()
  // stageAt es la única fecha que tienen los terminales: sin ella no hay "días en
  // stand-by". Moverse a la misma etapa no la reinicia.
  const stageAt = current === meta.key && validIso(project && project.stageAt) ? project.stageAt : stamp
  // Estados terminales (finalizado/pausado/cancelado): solo marcan la etapa; NO
  // tocan el ciclo de vida ni sellan fechas de cobro. El desarrollo dejó de correr.
  if (meta.terminal) return { stage: meta.key, stageAt }
  if (meta.agreement) {
    return { stage: meta.key, stageAt, ...(meta.key === 'anual' ? { annual: { ...(project && project.annual), startAt: annualStart({ annual: project && project.annual, stageAt }) } } : {}) }
  }
  const lifecycle = advancePhase(project, meta.phase, now)
  if (meta.key === 'fase2') {
    const prev = normalizeLifecycle(project).devAt
    return { stage: meta.key, stageAt, lifecycle: { ...lifecycle, devAt: current === 'fase2' && prev ? prev : stamp } }
  }
  if (meta.key === 'onboarding') return { stage: meta.key, stageAt, lifecycle: { ...lifecycle, startedAt: current === 'onboarding' ? lifecycle.startedAt : stamp, devAt: null } }
  // Salir de Onboarding es el arranque real del desarrollo: el contador nace acá.
  if (meta.key === 'desarrollo') return { stage: meta.key, stageAt, lifecycle: { ...lifecycle, ...(current === 'onboarding' ? { startedAt: stamp } : {}), devAt: null } }
  return { stage: meta.key, stageAt, lifecycle }
}

const validIso = (v) => typeof v === 'string' && v !== '' && !Number.isNaN(new Date(v).getTime())

/**
 * ¿Pasar a `key` borra fechas ya selladas? Sirve para pedir confirmación solo
 * cuando hace falta: volver de mantenimiento a desarrollo tira abajo el phase3At
 * del que sale la facturación, y eso no puede pasar de un click distraído.
 */
export function stageIsRegression(project, key) {
  const lc = normalizeLifecycle(project)
  return stageMeta(key).phase < lc.phase
}
