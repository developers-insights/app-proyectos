/*
 * Interruptor "Clarity" de la ficha del proyecto. Vive en el JSON del proyecto
 * (`clarity`, `clarityAt`) y en wa_groups.clarity_instancia. La UI sólo lo muestra
 * a este mail; el candado real son los triggers de docs/migrations/2026-11-02-clarity-candado.sql,
 * que comparan contra el MISMO mail: si cambia acá, cambia allá.
 */

export const CLARITY_ADMIN_EMAIL = 'manuelnavarro@insightsapps.tech'

/* null = el bot de Clarity (apex-bot); el otro valor es el WhatsApp personal de Manuel. */
export const INSTANCIA_BOT = null
export const INSTANCIA_MANUEL = 'closer-manuel'

/* Etapas en las que prenderlo no lo mete en Clarity (lo decide el trigger clarity_aviso_proyecto). */
const ETAPAS_FUERA = ['pausado', 'finalizado', 'cancelado']

export const esAdminClarity = (email) => String(email || '').trim().toLowerCase() === CLARITY_ADMIN_EMAIL

export const clarityOn = (project) => project?.clarity === true

export const claritySinEfecto = (project) => ETAPAS_FUERA.includes(String(project?.stage || '').toLowerCase())

/* Campos a mezclar sobre el proyecto. Apagar deja clarityAt: es la última vez que se tocó. */
export function setClarity(on, now = new Date()) {
  return { clarity: !!on, clarityAt: now.toISOString() }
}

export const instanciaDe = (v) => (v === INSTANCIA_MANUEL ? INSTANCIA_MANUEL : INSTANCIA_BOT)
