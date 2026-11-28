// Corre la propuesta de Fase 2 con la IA sobre las calls reales de un proyecto, sin pasar por la
// función (para probar el prompt). No escribe nada en la base.
//   envkit run -g --only SUPABASE_ACCESS_TOKEN,ANTHROPIC_API_KEY -- node scripts/fase2-propuesta-prueba.mjs <proyecto> [salida.json]
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { normalizarEntrada, textoDeCallsParaPropuesta, propuestaDeIA, ESQUEMA_PROPUESTA, SISTEMA_PROPUESTA } from '../src/lib/fase2.js'
import { armarContexto, MODELO } from '../src/lib/oportunidades.js'

const [proyecto, salida] = process.argv.slice(2)
if (!/^[A-Za-z0-9_-]{1,80}$/.test(proyecto || '')) { console.error('Falta el proyecto'); process.exit(1) }

async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/yzmtzyuncekspgtsetwk/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: sql }),
  })
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`)
  return r.json()
}

const [p] = await q(`select id, data from projects where id = '${proyecto}'`)
const filas = await q(`select id, data from project_fase2 where project_id = '${proyecto}' and deleted_at is null`)
const cli = p.data.clientId ? (await q(`select id, data from clients where id = '${p.data.clientId}'`))[0] : null
const calls = filas.map((f) => normalizarEntrada({ ...f.data, id: f.id })).filter((e) => e && e.kind === 'call' && e.texto && !e.deletedAt)
console.log(`${p.data.name}: ${calls.length} calls con texto`)
const contexto = armarContexto({ project: p, client: cli, now: new Date() })
const t0 = Date.now()
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 240_000, maxRetries: 0 })
const msg = await client.beta.messages.stream({
  model: MODELO, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
  output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_PROPUESTA } },
  system: SISTEMA_PROPUESTA,
  messages: [{ role: 'user', content: `Este es el proyecto:\n\n${contexto}\n\n---\n\nEstas son las llamadas con el cliente:\n\n${textoDeCallsParaPropuesta(calls)}\n\nArmá la propuesta de Fase 2.` }],
}).finalMessage()
const datos = JSON.parse(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''))
const prop = propuestaDeIA(datos, { basadoEn: calls.map((c) => c.id), modelo: msg.model })
console.log(`${Math.round((Date.now() - t0) / 1000)} s · ${msg.model} · ${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out`)
console.log(JSON.stringify(prop, null, 2))
if (salida) fs.writeFileSync(salida, JSON.stringify({ project: { id: p.id, name: p.data.name, clientId: p.data.clientId }, cliente: cli?.data?.company || cli?.data?.name || null, calls: calls.map((c) => ({ ...c, texto: c.texto.slice(0, 300) })), propuesta: prop }, null, 2))
