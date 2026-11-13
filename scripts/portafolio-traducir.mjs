// Traduce al inglés lo que el portafolio muestra de cada proyecto (queEs, negocio,
// resumen) y lo guarda en `portafolio_en`. Desde diciembre hay leads de EE.UU. y el
// closer comparte el portafolio en inglés (call del 13/11).
//
// Traduce sólo lo que falta o quedó viejo: cada fila guarda la huella del español
// que se tradujo (huellaPortafolio). Correrlo dos veces seguidas no gasta nada.
//
//   envkit run -g --only SUPABASE_ACCESS_TOKEN,API_KEY_ANTHROPIC_CUENTA_SECUNDARIA -- bash -c 'ANTHROPIC_API_KEY=$API_KEY_ANTHROPIC_CUENTA_SECUNDARIA node scripts/portafolio-traducir.mjs' [--seco] [--forzar]
//
// --seco   muestra qué traduciría, sin llamar a Claude ni escribir.
// --forzar vuelve a traducir todo.
//
// Lee y escribe por la API de administración de Supabase (el PAT de la cuenta).
// Speed Funnels lo recibe en la próxima reconciliación del puente (15 min) y la web
// en su próxima revalidación; al final se le avisa a la web para que no espere.
import Anthropic from '@anthropic-ai/sdk'
import { buildBridgeSnapshots } from '../src/lib/bridge.js'
import { huellaPortafolio } from '../src/lib/portafolio.js'

const REF = 'yzmtzyuncekspgtsetwk'
const MODELO = 'claude-opus-5-5'
const SECO = process.argv.includes('--seco')
const FORZAR = process.argv.includes('--forzar')

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('falta SUPABASE_ACCESS_TOKEN')

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

const [projects, clients, plans, traducciones] = await Promise.all([
  sql('select id, data, deleted_at from public.projects where deleted_at is null'),
  sql('select id, data, deleted_at from public.clients where deleted_at is null'),
  sql('select id, data, deleted_at from public.plans where deleted_at is null'),
  sql('select project_id, data from public.portafolio_en'),
])

const fotos = buildBridgeSnapshots({ projects, clients, plans }, new Date())
const vigente = new Map(traducciones.map((t) => [t.project_id, t.data && t.data.fuente]))

const pendientes = fotos
  .map((f) => ({ f, es: { queEs: f.portafolio.queEs ?? null, negocio: f.portafolio.negocio ?? null, resumen: f.portafolio.resumen ?? null } }))
  .filter(({ f, es }) => f.portafolio.mostrable && (es.queEs || es.negocio || es.resumen))
  .map((x) => ({ ...x, fuente: huellaPortafolio(x.es) }))
  .filter((x) => FORZAR || vigente.get(x.f.id) !== x.fuente)

console.log(`${fotos.length} proyectos, ${pendientes.length} para traducir${SECO ? ' (seco)' : ''}`)
if (SECO) {
  for (const { f } of pendientes) console.log(' ·', f.name)
  process.exit(0)
}
if (!pendientes.length) process.exit(0)

const SISTEMA = `You translate short product descriptions from Argentine Spanish into natural US English.
They describe software Insights built for a client and are shown to US prospects during a sales call, on a portfolio screen.
Rules:
- Keep the meaning exactly. Do not add features, numbers, claims or adjectives that are not in the Spanish.
- Keep product names, company names and technology names as they are (Next.js, Supabase, Stripe, GPS...).
- Plain, confident, concrete English. No marketing fluff, no em dashes.
- If a Spanish field is null, return null for it.`

const CAMPO = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const ESQUEMA = {
  type: 'object',
  properties: { queEs: CAMPO, negocio: CAMPO, resumen: CAMPO },
  required: ['queEs', 'negocio', 'resumen'],
  additionalProperties: false,
}

const client = new Anthropic()

async function traducir(es) {
  const r = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SISTEMA,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [{
      role: 'user',
      content: `queEs (one line: what the product is):\n${es.queEs ?? 'null'}\n\nnegocio (the client's business):\n${es.negocio ?? 'null'}\n\nresumen (what we built):\n${es.resumen ?? 'null'}`,
    }],
  })
  if (r.stop_reason === 'refusal') throw new Error('Claude no lo tradujo (refusal)')
  const texto = r.content.find((b) => b.type === 'text')
  if (!texto) throw new Error(`sin texto (stop_reason ${r.stop_reason})`)
  const out = JSON.parse(texto.text)
  const limpio = (k) => (es[k] && typeof out[k] === 'string' && out[k].trim() ? out[k].trim() : null)
  return { queEs: limpio('queEs'), negocio: limpio('negocio'), resumen: limpio('resumen') }
}

const filas = []
const fallas = []
for (let i = 0; i < pendientes.length; i += 4) {
  const tanda = pendientes.slice(i, i + 4)
  const hechas = await Promise.allSettled(tanda.map((x) => traducir(x.es)))
  hechas.forEach((h, k) => {
    const { f, fuente } = tanda[k]
    if (h.status === 'fulfilled') {
      filas.push({ project_id: f.id, data: { fuente, modelo: MODELO, ...h.value } })
      console.log(' ✓', f.name)
    } else {
      fallas.push(f.name)
      console.warn(' ✗', f.name, '-', h.reason instanceof Error ? h.reason.message : String(h.reason))
    }
  })
}

if (filas.length) {
  const json = JSON.stringify(filas)
  if (json.includes('$tr$')) throw new Error('el texto trae el delimitador del literal')
  await sql(`insert into public.portafolio_en (project_id, data, updated_at)
    select x.project_id, x.data, now() from jsonb_to_recordset($tr$${json}$tr$::jsonb) as x(project_id text, data jsonb)
    on conflict (project_id) do update set data = excluded.data, updated_at = now()`)
}

const cfg = await sql(`select key, value from public.catalogo_web_config where key in ('url', 'secret')`)
const url = cfg.find((c) => c.key === 'url')?.value
const secret = cfg.find((c) => c.key === 'secret')?.value
if (url && secret && filas.length) {
  const res = await fetch(url, { method: 'POST', headers: { 'x-catalogo-secret': secret }, signal: AbortSignal.timeout(30_000) }).catch((e) => e)
  console.log('aviso a la web:', res instanceof Error ? res.message : res.status)
}

console.log(`${filas.length} guardadas${fallas.length ? `, ${fallas.length} fallaron: ${fallas.join(', ')}` : ''}`)
if (fallas.length) process.exit(1)
