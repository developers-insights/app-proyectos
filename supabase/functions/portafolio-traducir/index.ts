// Pasa al inglés lo que el portafolio muestra de cada proyecto (portafolio_en).
// Lo despierta pg_cron una vez por día con el mismo secreto que catalogo-web
// (lo lee de catalogo_web_config al correr, nunca queda escrito en cron.job).
// Sin esto un proyecto nuevo en producción salía en español a los leads de
// EE. UU. hasta que alguien corriera scripts/portafolio-traducir.mjs a mano.
//
// Secrets: ANTHROPIC_API_KEY y ANTHROPIC_API_KEY_RESPALDO (las mismas de oportunidades).
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildBridgeSnapshots } from '../../../src/lib/bridge.js'
import {
  MODELO_TRADUCCION, SISTEMA_TRADUCCION, ESQUEMA_TRADUCCION, mensajeTraduccion,
  pendientesDeTraducir, limpiarTraduccion,
} from '../../../src/lib/traduccion.js'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

async function config(): Promise<Record<string, string>> {
  const { data } = await db.from('catalogo_web_config').select('key, value').in('key', ['url', 'secret'])
  return Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, String(r.value ?? '')]))
}

async function mismo(a: string | null, b: string): Promise<boolean> {
  if (!a || !b) return false
  const enc = new TextEncoder()
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const ua = new Uint8Array(x), ub = new Uint8Array(y)
  let diff = 0
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i]
  return diff === 0
}

const errorDeCuenta = (e: unknown) =>
  e instanceof Anthropic.APIError &&
  (e.status === 401 || e.status === 403 || e.status === 429 || (e.status === 400 && /credit|billing/i.test(e.message)))

async function traducir(es: Record<string, string | null>) {
  const keys = [Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('ANTHROPIC_API_KEY_RESPALDO')].filter((k): k is string => !!k)
  if (!keys.length) throw new Error('sin_key')
  let ultimo: unknown = null
  for (const apiKey of keys) {
    const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 })
    try {
      const pedido = {
        model: MODELO_TRADUCCION,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SISTEMA_TRADUCCION,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_TRADUCCION } },
        messages: [{ role: 'user', content: mensajeTraduccion(es) }],
      }
      // `as never`: el SDK fijado no tipa todavía fallbacks: "default".
      const msg = await client.beta.messages.create(pedido as never)
      if (msg.stop_reason === 'refusal') throw new Error('rechazo')
      const texto = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
      return limpiarTraduccion(es, JSON.parse(texto))
    } catch (e) {
      ultimo = e
      if (!errorDeCuenta(e)) break
      console.warn('[portafolio-traducir] la key no anduvo, pruebo la de respaldo:', (e as Error).message)
    }
  }
  throw ultimo
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  const cfg = await config()
  if (!(await mismo(req.headers.get('x-catalogo-secret'), cfg.secret ?? ''))) return json({ error: 'unauthorized' }, 401)
  const seco = new URL(req.url).searchParams.get('seco') === '1'

  const [projects, clients, plans, traducciones] = await Promise.all([
    db.from('projects').select('id,data,deleted_at').is('deleted_at', null),
    db.from('clients').select('id,data,deleted_at').is('deleted_at', null),
    db.from('plans').select('id,data,deleted_at').is('deleted_at', null),
    db.from('portafolio_en').select('project_id,data'),
  ])
  const fallo = [projects, clients, plans, traducciones].find((r) => r.error)
  if (fallo) {
    console.error('[portafolio-traducir] no pude leer:', fallo.error!.message)
    return json({ error: 'no pude leer la base' }, 500)
  }

  const fotos = buildBridgeSnapshots({ projects: projects.data, clients: clients.data, plans: plans.data }, new Date())
  const pendientes = pendientesDeTraducir(fotos, traducciones.data)
  if (seco || !pendientes.length) return json({ proyectos: fotos.length, pendientes: pendientes.map((x) => x.f.name) })

  const filas: { project_id: string; data: Record<string, unknown>; updated_at: string }[] = []
  const fallas: string[] = []
  for (let i = 0; i < pendientes.length; i += 4) {
    const tanda = pendientes.slice(i, i + 4)
    const hechas = await Promise.allSettled(tanda.map((x) => traducir(x.es)))
    hechas.forEach((h, k) => {
      const { f, fuente } = tanda[k]
      if (h.status === 'fulfilled') {
        filas.push({ project_id: f.id, data: { fuente, modelo: MODELO_TRADUCCION, ...h.value }, updated_at: new Date().toISOString() })
      } else {
        fallas.push(f.name)
        console.warn('[portafolio-traducir]', f.name, '-', h.reason instanceof Error ? h.reason.message : String(h.reason))
      }
    })
  }

  if (filas.length) {
    const { error } = await db.from('portafolio_en').upsert(filas, { onConflict: 'project_id' })
    if (error) {
      console.error('[portafolio-traducir] no pude guardar:', error.message)
      return json({ error: 'no pude guardar' }, 500)
    }
    if (cfg.url && cfg.secret) {
      await fetch(cfg.url, { method: 'POST', headers: { 'x-catalogo-secret': cfg.secret }, signal: AbortSignal.timeout(30_000) })
        .catch((e) => console.warn('[portafolio-traducir] aviso a la web:', (e as Error).message))
    }
  }
  if (fallas.length) console.error(`[portafolio-traducir] ${fallas.length} no se tradujeron: ${fallas.join(', ')}`)
  return json({ proyectos: fotos.length, traducidos: filas.length, fallaron: fallas })
})
