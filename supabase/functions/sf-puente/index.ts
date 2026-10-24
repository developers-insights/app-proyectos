// ============================================================================
// sf-puente — Supabase Edge Function (Deno)
// Lo que Speed Funnels lee de cada proyecto para avisarle al closer que le cobra
// a ese cliente: etapa y días del Recorrido, avance, próximo hito, upsell,
// candidato a oferta y notas para el closer. La foto la arma src/lib/bridge.js,
// la misma lógica que ve el equipo en la app (journey.js / progress.js).
//
// GET  /sf-puente            → todos los proyectos de cliente (reconciliación)
// POST /sf-puente {ids:[…]}  → sólo esos (lo pide Speed Funnels tras el aviso
//                               del trigger sf_puente_aviso)
//
// Puerta: header `x-puente-secret` == sf_puente_config.secret, en tiempo
// constante. Fail-closed: sin secreto cargado no entra nadie. verify_jwt off:
// quien llama es otra base, no un usuario.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildBridgeSnapshots } from '../../../src/lib/bridge.js'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

let cache: { value: string; at: number } | null = null
async function secret(): Promise<string> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value
  const { data, error } = await db.from('sf_puente_config').select('value').eq('key', 'secret').maybeSingle()
  if (error) {
    console.error('[sf-puente] no pude leer sf_puente_config:', error.message)
    return ''
  }
  cache = { value: typeof data?.value === 'string' ? data.value : '', at: Date.now() }
  return cache.value
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

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!(await mismo(req.headers.get('x-puente-secret'), await secret()))) return json({ error: 'unauthorized' }, 401)

  let ids: string[] | null = null
  if (req.method === 'POST') {
    const body = await req.json().catch(() => null)
    if (body && Array.isArray(body.ids)) ids = body.ids.filter((x: unknown) => typeof x === 'string' && ID_RE.test(x)).slice(0, 200)
  }

  let pq = db.from('projects').select('id,data,deleted_at')
  if (ids) pq = pq.in('id', ids.length ? ids : ['-'])
  const [projects, clients, plans, team] = await Promise.all([
    pq,
    db.from('clients').select('id,data,deleted_at').is('deleted_at', null),
    db.from('plans').select('id,data,deleted_at').is('deleted_at', null),
    db.from('team_members').select('id,data,deleted_at').is('deleted_at', null),
  ])
  const fallo = projects.error || clients.error || plans.error || team.error
  if (fallo) {
    console.error('[sf-puente] lectura:', fallo.message)
    return json({ error: 'no pude leer los proyectos' }, 500)
  }

  const fotos = buildBridgeSnapshots({
    projects: projects.data ?? [], clients: clients.data ?? [], plans: plans.data ?? [], team: team.data ?? [],
  }, new Date())
  const vivos = new Set(fotos.map((f) => f.id))
  const bajas = ids ? ids.filter((id) => !vivos.has(id)) : []
  return json({ generado: new Date().toISOString(), completo: !ids, proyectos: fotos, bajas })
})
