// Qué del portafolio falta pasar al inglés y cómo se le pide a Claude. Lo usan
// scripts/portafolio-traducir.mjs (a mano) y la edge function portafolio-traducir
// (todos los días por pg_cron): si cambia uno solo, los dos traducen distinto.
import { huellaPortafolio } from './portafolio.js'

export const MODELO_TRADUCCION = 'claude-opus-5-5'

export const SISTEMA_TRADUCCION = `You translate short product descriptions from Argentine Spanish into natural US English.
They describe software Insights built for a client and are shown to US prospects during a sales call, on a portfolio screen.
Rules:
- Keep the meaning exactly. Do not add features, numbers, claims or adjectives that are not in the Spanish.
- Keep product names, company names and technology names as they are (Next.js, Supabase, Stripe, GPS...).
- Plain, confident, concrete English. No marketing fluff, no em dashes.
- If a Spanish field is null, return null for it.`

const CAMPO = { anyOf: [{ type: 'string' }, { type: 'null' }] }
export const ESQUEMA_TRADUCCION = {
  type: 'object',
  properties: { queEs: CAMPO, negocio: CAMPO, resumen: CAMPO },
  required: ['queEs', 'negocio', 'resumen'],
  additionalProperties: false,
}

export const mensajeTraduccion = (es) =>
  `queEs (one line: what the product is):\n${es.queEs ?? 'null'}\n\nnegocio (the client's business):\n${es.negocio ?? 'null'}\n\nresumen (what we built):\n${es.resumen ?? 'null'}`

/** Las fotos mostrables con texto cuyo inglés falta o quedó de otro español. */
export function pendientesDeTraducir(fotos, traducciones, forzar = false) {
  const vigente = new Map((traducciones || []).map((t) => [t.project_id, t.data && t.data.fuente]))
  return (fotos || [])
    .map((f) => ({ f, es: { queEs: f.portafolio.queEs ?? null, negocio: f.portafolio.negocio ?? null, resumen: f.portafolio.resumen ?? null } }))
    .filter(({ f, es }) => f.portafolio.mostrable && (es.queEs || es.negocio || es.resumen))
    .map((x) => ({ ...x, fuente: huellaPortafolio(x.es) }))
    .filter((x) => forzar || vigente.get(x.f.id) !== x.fuente)
}

/** Lo que devolvió Claude, sólo en los campos que tienen español. */
export function limpiarTraduccion(es, out) {
  const limpio = (k) => (es[k] && out && typeof out[k] === 'string' && out[k].trim() ? out[k].trim() : null)
  return { queEs: limpio('queEs'), negocio: limpio('negocio'), resumen: limpio('resumen') }
}
