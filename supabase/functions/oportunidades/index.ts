// ============================================================================
// oportunidades — Supabase Edge Function (Deno)
// La sección "Oportunidades" del detalle del proyecto (call del 13/11).
//
// POST {accion:"generar", proyecto}            → Claude lee el proyecto y propone de 3 a 5
//   oportunidades; reemplaza las que nadie tocó (oportunidades_reemplazar).
// POST {accion:"ofrecer", id, finClientId?}    → "La ofrecí": la deja `ofrecido` en el tablero
//   de Upsell de Speed Funnels (if-proyectos, con el secreto del puente) y guarda el resultado
//   en la fila (oportunidad_aplicar). Sin cliente de Finanzas devuelve los candidatos.
//
// Sólo el equipo con acceso completo: is_team() con el JWT de quien llama. Un lector (Mati,
// Axel) ve las oportunidades por RLS pero acá recibe 403.
//
// La lógica pura vive en src/lib/oportunidades.js: se despliega desde la raíz del repo
//   supabase functions deploy oportunidades --project-ref yzmtzyuncekspgtsetwk --use-api --no-verify-jwt
// y hay que redesplegarla si cambian oportunidades.js, journey.js, stages.js, lifecycle.js,
// progress.js, stores.js, serviceNotes.js o closerNotes.js.
//
// Secrets: ANTHROPIC_API_KEY (principal) y ANTHROPIC_API_KEY_RESPALDO (otra cuenta). 400 de
// saldo, 401, 403 y 429 pasan a la de respaldo; 5xx y red no.
// ============================================================================
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  armarContexto, leerRespuestaIA, pedidoUpsell, normalizeOpportunity,
  ESQUEMA_RESPUESTA, SISTEMA, MODELO,
} from '../../../src/lib/oportunidades.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } })

const URL_BASE = Deno.env.get('SUPABASE_URL')!
const db = createClient(URL_BASE, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/
const ESPERA_MS = 30_000

type Yo = { id: string | null; nombre: string }

async function quienLlama(req: Request): Promise<Yo | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const comoEl = createClient(URL_BASE, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const [{ data: user }, { data: esEquipo, error }] = await Promise.all([comoEl.auth.getUser(token), comoEl.rpc('is_team')])
  if (error || esEquipo !== true || !user?.user?.email) return null
  const email = user.user.email.toLowerCase()
  const { data: filas } = await db.from('team_members').select('id, data').is('deleted_at', null).eq('data->>email', email).limit(1)
  const m = filas && filas[0]
  return { id: m?.id ?? null, nombre: String(m?.data?.name || email.split('@')[0]).slice(0, 80) }
}

function errorDeCuenta(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false
  if (e.status === 401 || e.status === 403 || e.status === 429) return true
  return e.status === 400 && /credit|billing/i.test(e.message)
}

async function pensar(contexto: string) {
  const keys = [Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('ANTHROPIC_API_KEY_RESPALDO')].filter((k): k is string => !!k)
  if (!keys.length) throw new Error('sin_key')
  let ultimo: unknown = null
  for (const apiKey of keys) {
    const client = new Anthropic({ apiKey, timeout: 140_000, maxRetries: 1 })
    try {
      const pedido = {
        model: MODELO,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: ESQUEMA_RESPUESTA } },
        system: SISTEMA,
        messages: [{ role: 'user', content: `Este es el proyecto:\n\n${contexto}\n\nProponé las oportunidades.` }],
      }
      // `as never`: el SDK fijado no tipa todavía fallbacks: "default".
      const msg = await client.beta.messages.stream(pedido as never).finalMessage()
      if (msg.stop_reason === 'refusal') throw new Error('rechazo')
      if (msg.stop_reason === 'max_tokens') throw new Error('cortada')
      const texto = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
      return { datos: JSON.parse(texto), modelo: msg.model }
    } catch (e) {
      ultimo = e
      if (!errorDeCuenta(e)) break
      console.warn('[oportunidades] la key no anduvo, pruebo la de respaldo:', (e as Error).message)
    }
  }
  throw ultimo
}

async function generar(proyecto: string, yo: Yo): Promise<Response> {
  const { data: p, error } = await db.from('projects').select('id, data').eq('id', proyecto).is('deleted_at', null).maybeSingle()
  if (error) return json({ error: 'No pude leer el proyecto.' }, 500)
  if (!p) return json({ error: 'No encontré el proyecto.' }, 404)

  const [cli, plan, tareas, notas, previas] = await Promise.all([
    p.data?.clientId ? db.from('clients').select('id, data').eq('id', p.data.clientId).is('deleted_at', null).maybeSingle() : Promise.resolve({ data: null }),
    p.data?.planId ? db.from('plans').select('id, data').eq('id', p.data.planId).is('deleted_at', null).maybeSingle() : Promise.resolve({ data: null }),
    db.from('tasks').select('id, data').is('deleted_at', null).eq('data->>projectId', proyecto).limit(200),
    db.from('project_service_notes').select('type, body, noted_at').eq('project_id', proyecto).is('deleted_at', null).order('noted_at', { ascending: false }).limit(30),
    db.from('project_opportunities').select('id, data').eq('project_id', proyecto).is('deleted_at', null),
  ])

  const filasPrevias = (previas.data ?? []).map((r) => normalizeOpportunity(r.data))
  const ultima = filasPrevias.reduce((m, o) => (o.generadaAt && o.generadaAt > m ? o.generadaAt : m), '')
  if (ultima && Date.now() - Date.parse(ultima) < ESPERA_MS) {
    return json({ error: 'Recién se pensaron oportunidades para este proyecto. Esperá unos segundos.' }, 429)
  }

  const contexto = armarContexto({
    project: p, client: cli.data, plan: plan.data, tasks: tareas.data ?? [],
    notes: (notas.data ?? []).map((n) => ({ type: n.type, body: n.body, notedAt: n.noted_at })),
    previas: filasPrevias.filter((o) => o.estado !== 'nueva'),
    now: new Date(),
  })

  let r
  try {
    r = await pensar(contexto)
  } catch (e) {
    const m = (e as Error)?.message || String(e)
    if (m === 'sin_key') {
      console.error('[oportunidades] falta ANTHROPIC_API_KEY')
      return json({ error: 'Falta configurar la IA. Avisale a Manuel.' }, 503)
    }
    if (m === 'rechazo') return json({ error: 'La IA no quiso responder con este proyecto. Probá de nuevo más tarde.' }, 502)
    console.error('[oportunidades] Claude falló:', m)
    return json({ error: 'La IA no respondió. Probá de nuevo en un rato.' }, 502)
  }

  const lote = crypto.randomUUID().slice(0, 8)
  const filas = leerRespuestaIA(r.datos, { projectId: proyecto, by: yo.id, lote, modelo: r.modelo, now: new Date(), nuevoId: () => crypto.randomUUID() })
  if (!filas.length) return json({ error: 'La IA no encontró nada concreto para proponer. Sumá notas del proyecto y probá de nuevo.' }, 422)

  const { error: e2 } = await db.rpc('oportunidades_reemplazar', { p_project: proyecto, p_filas: filas })
  if (e2) {
    console.error('[oportunidades] no pude guardar:', e2.message)
    return json({ error: 'No pude guardar las oportunidades.' }, 500)
  }
  return json({ ok: true, oportunidades: filas })
}

let cfg: { url: string; secret: string; at: number } | null = null
async function puente() {
  if (cfg && Date.now() - cfg.at < 60_000) return cfg
  const { data } = await db.from('sf_puente_config').select('key, value').in('key', ['url', 'secret'])
  const v = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
  cfg = { url: String(v.url || ''), secret: String(v.secret || ''), at: Date.now() }
  return cfg
}

async function ofrecer(id: string, finClientId: number | null, yo: Yo): Promise<Response> {
  const { data: fila } = await db.from('project_opportunities').select('id, data').eq('id', id).is('deleted_at', null).maybeSingle()
  if (!fila) return json({ error: 'Esa oportunidad ya no está.' }, 404)
  const op = normalizeOpportunity({ ...fila.data, id: fila.id })
  const ahora = new Date().toISOString()
  const marca = {
    estado: 'ofrecida',
    ofrecidaAt: op.ofrecidaAt || ahora,
    ofrecidaPor: op.ofrecidaPor || yo.id,
    descartadaAt: null,
    descartadaPor: null,
  }

  const { url, secret } = await puente()
  let sf: Record<string, unknown>
  let candidatos: unknown[] | undefined
  if (!url || !secret) {
    console.error('[oportunidades] falta url o secreto del puente')
    sf = { estado: 'error', error: 'Falta la conexión con Speed Funnels.', at: ahora }
  } else {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-puente-secret': secret },
        body: JSON.stringify({ accion: 'upsell', oportunidad: pedidoUpsell(op, yo.nombre, finClientId) }),
        signal: AbortSignal.timeout(20_000),
      })
      const b = await res.json().catch(() => ({}))
      if (res.ok && b.ok) {
        sf = { estado: 'ok', id: b.id, cliente: b.cliente ?? null, via: b.via ?? null, estadoTablero: b.estado ?? 'ofrecido', at: ahora }
      } else if (res.ok && b.motivo === 'sin_cliente') {
        sf = { estado: 'sin_cliente', at: ahora }
        candidatos = Array.isArray(b.candidatos) ? b.candidatos : []
      } else {
        console.error('[oportunidades] Speed Funnels contestó', res.status, JSON.stringify(b).slice(0, 200))
        sf = { estado: 'error', error: 'Speed Funnels no la pudo guardar.', at: ahora }
      }
    } catch (e) {
      console.error('[oportunidades] no pude hablar con Speed Funnels:', (e as Error).message)
      sf = { estado: 'error', error: 'Speed Funnels no respondió.', at: ahora }
    }
  }

  const { data: guardada, error } = await db.rpc('oportunidad_aplicar', { p_id: id, p_patch: { ...marca, sf } })
  if (error) {
    console.error('[oportunidades] no pude guardar el resultado:', error.message)
    return json({ error: 'No pude guardar que la ofreciste.' }, 500)
  }
  return json({ ok: sf.estado === 'ok', oportunidad: guardada, candidatos })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  try {
    const yo = await quienLlama(req)
    if (!yo) return json({ error: 'Sólo el equipo con acceso completo puede hacer esto.' }, 403)
    const b = await req.json().catch(() => ({}))
    if (b.accion === 'generar') {
      const proyecto = String(b.proyecto || '')
      if (!ID_RE.test(proyecto)) return json({ error: 'Falta el proyecto.' }, 400)
      return await generar(proyecto, yo)
    }
    if (b.accion === 'ofrecer') {
      const id = String(b.id || '')
      if (!ID_RE.test(id)) return json({ error: 'Falta la oportunidad.' }, 400)
      const fc = Number.isInteger(b.finClientId) && b.finClientId > 0 ? b.finClientId : null
      return await ofrecer(id, fc, yo)
    }
    return json({ error: 'Acción desconocida.' }, 400)
  } catch (e) {
    console.error('[oportunidades]', (e as Error).message)
    return json({ error: 'Algo falló. Probá de nuevo.' }, 500)
  }
})
