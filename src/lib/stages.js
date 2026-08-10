/**
 * stages.js — ETAPA COMERCIAL de un proyecto (Insights OS).
 *
 * JS PURO: cero React. Es el único eje por el que se clasifican los proyectos
 * desde 2026-08 (antes había un `status` activo/pendiente/pausado/entregado que
 * convivía con el ciclo de vida y decía la mitad de la historia cada uno).
 *
 *   Desarrollo  → se está construyendo
 *   Free Maint. → mantenimiento sin cargo (la prueba gratis)
 *   Starter · Kaizen · Scale → planes de mantenimiento pagos
 *
 * La etapa NO reemplaza al lifecycle: lo MANDA. Cada etapa mapea a una fase del
 * ciclo de vida (1 · 2 · 3) y moverla sella las mismas fechas de siempre, así que
 * el cobro recurrente, el aviso de los 7 días y el mail siguen funcionando igual
 * sin que nadie tenga que tocar un stepper aparte.
 */

import { normalizeLifecycle, advancePhase } from './lifecycle.js'

/**
 * `phase` es la fase del lifecycle que le corresponde; `colorVar` el NOMBRE de la
 * CSS var (sin `var(...)`) para que la UI arme `var(${colorVar})` a gusto.
 * `group` parte el menú: lo que está en obra vs lo que ya se mantiene.
 */
export const PROJECT_STAGES = [
  { key: 'desarrollo', label: 'Desarrollo',  group: 'obra',          phase: 1, colorVar: '--accent', hint: 'Se está construyendo' },
  { key: 'free',       label: 'Free Maint.', group: 'mantenimiento', phase: 2, colorVar: '--blue',   hint: 'Mantenimiento sin cargo' },
  { key: 'starter',    label: 'Starter',     group: 'mantenimiento', phase: 3, colorVar: '--green',  hint: 'Plan mensual' },
  { key: 'kaizen',     label: 'Kaizen',      group: 'mantenimiento', phase: 3, colorVar: '--yellow', hint: 'Plan mensual' },
  { key: 'scale',      label: 'Scale',       group: 'mantenimiento', phase: 3, colorVar: '--violet', hint: 'Plan mensual' },
  // Estados TERMINALES (no tocan el ciclo de vida ni el cobro): el desarrollo ya no
  // corre. `terminal:true` los saca de los recordatorios y del contador de fase.
  { key: 'finalizado', label: 'Finalizado',  group: 'cerrado', phase: 9, colorVar: '--green',      hint: 'Desarrollo terminado, sin mantenimiento vendido', terminal: true, offerMaintenance: true },
  { key: 'pausado',    label: 'Pausado',     group: 'cerrado', phase: 9, colorVar: '--yellow',     hint: 'Pausado por el cliente', terminal: true },
  { key: 'cancelado',  label: 'Cancelado',   group: 'cerrado', phase: 9, colorVar: '--red',        hint: 'Cancelado por el cliente o por nosotros', terminal: true },
]

export const STAGE_GROUPS = [
  { key: 'obra',          label: 'En obra' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'cerrado',       label: 'Cerrados' },
]

/** ¿La etapa implica que el desarrollo ya terminó? (mantenimiento o finalizado → 100%). */
export const isDevelopmentDone = (key) => ['free', 'starter', 'kaizen', 'scale', 'finalizado'].includes(key)

/** Metadatos de una etapa por clave. Cualquier cosa rara cae en Desarrollo. */
export const stageMeta = (key) => PROJECT_STAGES.find((s) => s.key === key) || PROJECT_STAGES[0]

/**
 * Etapa vigente de un proyecto, tenga o no el campo.
 *
 * Los proyectos anteriores a las etapas no tienen `stage`: se deriva de la fase
 * del ciclo de vida, que es el dato que sí venían llevando. Un proyecto en fase 3
 * (mantenimiento pago) cae en Starter porque el plan concreto nunca se registró
 * en ningún lado — no hay de dónde adivinar si era Kaizen o Scale, y elegir el
 * escalón más bajo es lo único que no infla una facturación.
 */
export function projectStage(project) {
  const raw = project && project.stage
  if (raw && PROJECT_STAGES.some((s) => s.key === raw)) return raw
  const phase = normalizeLifecycle(project).phase
  if (phase === 3) return 'starter'
  if (phase === 2) return 'free'
  return 'desarrollo'
}

/** ¿La etapa cobra? (los tres planes pagos). */
export const isPaidStage = (key) => stageMeta(key).phase === 3

/**
 * Campos NUEVOS del proyecto al moverlo a `key`: `{ stage, lifecycle }`. No muta.
 *
 * Delega en advancePhase, que es quien sabe qué sellos poner y cuáles borrar.
 * Moverse entre planes pagos (Starter → Scale) NO reinicia nada: los tres son
 * fase 3 y advancePhase respeta el phase3At que ya estaba.
 */
export function applyStage(project, key, now = new Date()) {
  const meta = stageMeta(key)
  // Estados terminales (finalizado/pausado/cancelado): solo marcan la etapa; NO
  // tocan el ciclo de vida ni sellan fechas de cobro. El desarrollo dejó de correr.
  if (meta.terminal) return { stage: meta.key }
  return { stage: meta.key, lifecycle: advancePhase(project, meta.phase, now) }
}

/**
 * ¿Pasar a `key` borra fechas ya selladas? Sirve para pedir confirmación solo
 * cuando hace falta: volver de mantenimiento a desarrollo tira abajo el phase3At
 * del que sale la facturación, y eso no puede pasar de un click distraído.
 */
export function stageIsRegression(project, key) {
  const lc = normalizeLifecycle(project)
  return stageMeta(key).phase < lc.phase
}
