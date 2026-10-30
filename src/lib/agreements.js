/*
 * Ramas de acuerdo del Recorrido (call del 30/10): Partners (marketing + proyecto a
 * cambio de un porcentaje) y Plan anual de marketing (marketing + mantenimiento por
 * un año). Ninguna cobra los US$97 del plan mensual, así que no tocan el lifecycle.
 * Todo vive en el JSON del proyecto (`partner`, `annual`): sin migración.
 */

import { toDate, daysBetween } from './lifecycle.js'

export const PARTNER_NOTE_MAX = 280

const iso = (v) => {
  const d = toDate(v)
  return d && d.getFullYear() >= 2000 ? d.toISOString() : null
}

export function normalizePartner(project) {
  const raw = project && project.partner && typeof project.partner === 'object' ? project.partner : {}
  const n = Number(raw.pct)
  return {
    pct: raw.pct != null && raw.pct !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : null,
    note: typeof raw.note === 'string' ? raw.note.replace(/\s+/g, ' ').trim().slice(0, PARTNER_NOTE_MAX) : '',
  }
}

export function setPartner(project, input) {
  return { partner: normalizePartner({ partner: { ...normalizePartner(project), ...input } }) }
}

export function partnerLine(project) {
  const { pct, note } = normalizePartner(project)
  if (pct == null && !note) return 'Falta anotar el acuerdo'
  return pct == null ? note : `${String(pct).replace('.', ',')} % del proyecto`
}

/* Arranca el día que entra a la rama, salvo que alguien cargue otra fecha. */
export function annualStart(project) {
  const raw = project && project.annual && typeof project.annual === 'object' ? project.annual : {}
  return iso(raw.startAt) || iso(project && project.stageAt)
}

export function annualEnd(startAt) {
  const d = toDate(startAt)
  if (!d) return null
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate(), 12).toISOString()
}

export function annualInfo(project, now = new Date()) {
  const startAt = annualStart(project)
  const endAt = annualEnd(startAt)
  if (!startAt) return { startAt: null, endAt: null, days: null, remaining: null, total: null }
  return {
    startAt, endAt,
    days: Math.max(0, daysBetween(startAt, now)),
    remaining: daysBetween(now, endAt),
    total: daysBetween(startAt, endAt),
  }
}

export function setAnnualStart(project, startAt) {
  const v = iso(startAt)
  return v ? { annual: { ...(project && project.annual && typeof project.annual === 'object' ? project.annual : {}), startAt: v } } : {}
}
