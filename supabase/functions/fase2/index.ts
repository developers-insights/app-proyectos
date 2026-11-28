// ============================================================================
// fase2 — Supabase Edge Function (Deno)
// La sección "Fase 2" del detalle del proyecto (spec 2026-11-23).
//
// POST {accion:"analizar_call", proyecto, entrada} → la pantalla ya creó la entrada (kind "call").
//   Si es de Fathom y todavía no tiene texto, baja la call con las cuentas de fathom_accounts; después
//   la analiza con Claude y guarda el resultado en la fila (fase2_guardar_call). Contesta 202 enseguida y
//   sigue en segundo plano (EdgeRuntime.waitUntil): el resultado o el error queda en la fila.
// POST {accion:"armar_propuesta", proyecto}         → tablero Fase 2 del menú: lo que hablaron, qué
//   venderle y cuánto, con todas las calls del proyecto. 202 enseguida; queda en 'propuesta-<proyecto>'.
// Una call de share de una cuenta de Fathom que no tenemos se lee del link público (reunionPublica).
// POST {accion:"armar_plan", proyecto}              → Claude arma "Cómo llevarlo a Fase 2" con las
//   notas y los análisis del proyecto; lo guarda en la fila 'plan-<proyecto>' (fase2_guardar_plan).
//
// Sólo el equipo con acceso completo: is_team() con el JWT de quien llama. Un lector (Mati, Axel)
// ve la sección por RLS pero acá recibe 403. El token de Fathom nunca sale de acá y el texto de la
// call nunca viaja del navegador a la IA: se lee de la base y se limpia antes (limpiarTexto).
//
// La lógica pura vive en src/lib/fase2.js y src/lib/oportunidades.js. Se despliega desde la raíz:
//   supabase functions deploy fase2 --project-ref yzmtzyuncekspgtsetwk --use-api --no-verify-jwt --yes
// y hay que redesplegarla si cambian fase2.js, oportunidades.js, journey.js, stages.js, lifecycle.js,
// progress.js, stores.js, serviceNotes.js o closerNotes.js.
//
// Secrets: ANTHROPIC_API_KEY (principal) y ANTHROPIC_API_KEY_RESPALDO. 400 de saldo, 401, 403 y 429
// pasan a la de respaldo; 5xx y red no.
// ============================================================================
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  resolverLink, mismaCall, limpiarTexto, textoDeReunion, normalizarEntrada, normalizarAnalisis, normalizarPlan,
  entradasParaPlan, ESQUEMA_CALL, ESQUEMA_PLAN, SISTEMA_CALL, SISTEMA_PLAN,
  datosDeShare, textoDeTranscripcionCopiada, textoDeCallsParaPropuesta, propuestaDeIA, ESQUEMA_PROPUESTA, SISTEMA_PROPUESTA,
  MAX_ESPERA_CALL_MS,
} from '../../../src/lib/fase2.js'
import { armarContexto, normalizeOpportunity, quedaAlRepensar, MODELO } from '../../../src/lib/oportunidades.js'

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
const CLAVE_RE = /^[A-Za-z0-9_-]{1,120}$/
const ESPERA_PLAN_MS = 30_000
const DIA = 86_400_000

type Yo = { id: string | null; nombre: string }

async function quienLlama(req: Request): Promise<Yo | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const comoEl = createClient(URL_BASE, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const [{ data: user }, { data: esEquipo, error }] = await Promise.all([comoEl.auth.getUser(token), comoEl.rpc('pm_puede_editar_fase2')])
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

async function pensar(sistema: string, esquema: unknown, usuario: string, opc: { maxTokens?: number; timeoutMs?: number } = {}) {
  const keys = [Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('ANTHROPIC_API_KEY_RESPALDO')].filter((k): k is string => !!k)
  if (!keys.length) throw new Error('sin_key')
  let ultimo: unknown = null
  for (const apiKey of keys) {
    const client = new Anthropic({ apiKey, timeout: opc.timeoutMs ?? 120_000, maxRetries: 0 })
    try {
      const pedido = {
        model: MODELO,
        max_tokens: opc.maxTokens ?? 10000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema } },
        system: sistema,
        messages: [{ role: 'user', content: usuario }],
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
      console.warn('[fase2] la key no anduvo, pruebo la de respaldo:', (e as Error).message)
    }
  }
  throw ultimo
}

/** Mensaje para el usuario según cómo falló la IA. */
function errorIA(e: unknown): { msg: string; status: number } {
  const m = (e as Error)?.message || String(e)
  if (m === 'sin_key') { console.error('[fase2] falta ANTHROPIC_API_KEY'); return { msg: 'Falta configurar la IA. Avisale a Manuel.', status: 503 } }
  if (m === 'rechazo') return { msg: 'La IA no quiso responder con este contenido. Probá de nuevo más tarde.', status: 502 }
  console.error('[fase2] Claude falló:', m)
  return { msg: 'La IA no respondió. Probá de nuevo en un rato.', status: 502 }
}

/** El contexto del proyecto, igual que en `oportunidades`: proyecto, plan, tareas, notas y lo ya ofrecido. */
async function contextoDelProyecto(proyecto: string, fase2: unknown[]) {
  const { data: p } = await db.from('projects').select('id, data').eq('id', proyecto).is('deleted_at', null).maybeSingle()
  if (!p) return null
  const [cli, plan, tareas, notas, previas] = await Promise.all([
    p.data?.clientId ? db.from('clients').select('id, data').eq('id', p.data.clientId).is('deleted_at', null).maybeSingle() : Promise.resolve({ data: null }),
    p.data?.planId ? db.from('plans').select('id, data').eq('id', p.data.planId).is('deleted_at', null).maybeSingle() : Promise.resolve({ data: null }),
    db.from('tasks').select('id, data').is('deleted_at', null).eq('data->>projectId', proyecto).limit(200),
    db.from('project_service_notes').select('type, body, noted_at').eq('project_id', proyecto).is('deleted_at', null).order('noted_at', { ascending: false }).limit(30),
    db.from('project_opportunities').select('id, data').eq('project_id', proyecto).is('deleted_at', null),
  ])
  return armarContexto({
    project: p, client: cli.data, plan: plan.data, tasks: tareas.data ?? [],
    notes: (notas.data ?? []).map((n) => ({ type: n.type, body: n.body, notedAt: n.noted_at })),
    previas: (previas.data ?? []).map((r) => normalizeOpportunity(r.data)).filter(quedaAlRepensar),
    fase2,
    now: new Date(),
  })
}

/* ───────────────────────────── Fathom ───────────────────────────── */

async function reunionesDe(apiKey: string, desde: string, hasta: string | null) {
  const out: any[] = []
  let cursor: string | null = null
  for (let pagina = 0; pagina < 10; pagina++) {
    const url = new URL('https://api.fathom.ai/external/v1/meetings')
    url.searchParams.set('include_summary', 'true')
    url.searchParams.set('include_transcript', 'true')
    url.searchParams.set('created_after', desde)
    if (hasta) url.searchParams.set('created_before', hasta)
    if (cursor) url.searchParams.set('cursor', cursor)
    const r = await fetch(url.toString(), { headers: { 'X-Api-Key': apiKey }, signal: AbortSignal.timeout(60_000) })
    if (!r.ok) throw new Error(`Fathom ${r.status}`)
    const data = await r.json()
    const items = data.items || data.meetings || data.data || []
    out.push(...items)
    cursor = data.next_cursor || data.cursor || null
    if (!cursor || items.length === 0) break
  }
  return out
}

/** Busca la reunión del link en las cuentas de Fathom: primero la de la call ya sincronizada. */
async function buscarReunion(link: { ok: true; clave: string; tipo: string; url: string }) {
  if (!CLAVE_RE.test(link.clave)) return null
  const { data: conocida } = await db.from('fathom_calls').select('id, account_id, call_date, project_id').ilike('share_url', `%${link.clave}%`).limit(1).maybeSingle()
  const { data: cuentas } = await db.from('fathom_accounts').select('id, api_key')
  if (!cuentas?.length) return null
  const ordenadas = [...cuentas].sort((a, b) => Number(b.id === conocida?.account_id) - Number(a.id === conocida?.account_id))
  const fecha = conocida?.call_date ? Date.parse(conocida.call_date) : NaN
  const desde = Number.isFinite(fecha) ? new Date(fecha - 2 * DIA).toISOString() : new Date(Date.now() - 400 * DIA).toISOString()
  const hasta = Number.isFinite(fecha) ? new Date(fecha + 2 * DIA).toISOString() : null
  for (const c of ordenadas) {
    try {
      const m = (await reunionesDe(c.api_key, desde, hasta)).find((x) => mismaCall(link, x))
      if (m) return { meeting: m, fathomCallId: conocida?.id ?? null, yaTieneProyecto: !!conocida?.project_id }
    } catch (e) {
      console.warn('[fase2] una cuenta de Fathom no respondió:', (e as Error).message)
    }
  }
  return null
}

/**
 * Sin cuenta de Fathom: un link de share abre la call para cualquiera. Se lee la página y su
 * "copiar transcripción". Devuelve lo que necesita trabajarCall, o null si no se pudo.
 */
async function reunionPublica(link: { ok: true; clave: string; tipo: string; url: string }) {
  if (link.tipo !== 'share' || !CLAVE_RE.test(link.clave)) return null
  const headers = { 'user-agent': 'Mozilla/5.0 (Insights Fase 2)', accept: 'text/html' }
  const r = await fetch(`https://fathom.video/share/${link.clave}`, { headers, redirect: 'follow', signal: AbortSignal.timeout(30_000) })
  if (!r.ok) return null
  const d = datosDeShare(await r.text())
  if (!d?.copiarUrl) return null
  const t = await fetch(d.copiarUrl, { headers: { ...headers, accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
  if (!t.ok) return null
  const j = await t.json().catch(() => null)
  const texto = textoDeTranscripcionCopiada(j?.html)
  if (texto.length < 200) return null
  return { texto, titulo: d.titulo, at: d.at, fathomId: d.callId }
}

/* ───────────────────────────── Acciones ───────────────────────────── */

const guardarCall = async (id: string, patch: Record<string, unknown>) => {
  const { data, error } = await db.rpc('fase2_guardar_call', { p_id: id, p_patch: patch })
  if (error) console.error('[fase2] no pude guardar la call:', error.message)
  return data
}

/** La falla queda anotada en la fila y vuelve a la pantalla junto con ella. */
async function fallaCall(id: string, msg: string, status: number): Promise<Response> {
  const fila = await guardarCall(id, { estado: 'error', error: msg })
  return json({ error: msg, entrada: fila ?? null }, status)
}

// EdgeRuntime existe en Supabase: deja que el trabajo siga después de haber contestado.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined
// Supabase corta una función a los 400 s: el error se anota antes, para que la tarjeta nunca quede trabada.
const TOPE_SEGUNDO_PLANO_MS = 330_000

/**
 * El trabajo pesado de una call: baja el texto (si hace falta), lo analiza y anota en la fila el
 * resultado o el error. Corre en segundo plano y no devuelve nada: la pantalla lo ve por la fila
 * (realtime y consulta cada pocos segundos). Nunca tira: todo error queda anotado en la tarjeta.
 */
async function trabajarCall(proyecto: string, e: Record<string, any>): Promise<void> {
  const falla = async (msg: string) => { await guardarCall(e.id, { estado: 'error', error: msg }) }
  try {
    let texto: string = e.texto
    const parche: Record<string, unknown> = {}
    if (e.origen === 'fathom' && !texto) {
      const link = resolverLink(e.link)
      if (!link.ok) return await falla(link.error)
      const hallada = await buscarReunion(link)
      if (hallada) {
        const m = hallada.meeting
        const t = textoDeReunion(m)
        if (!t.texto) return await falla('La call no trae resumen ni transcripción todavía. Probá de nuevo en unos minutos.')
        texto = t.texto
        const cuando = m.recording_start_time || m.scheduled_start_time || m.created_at || null
        Object.assign(parche, {
          texto, titulo: String(m.title || m.meeting_title || '').slice(0, 160) || null,
          fathomId: String(m.recording_id ?? m.id ?? '') || null,
          ...(cuando ? { at: new Date(cuando).toISOString() } : {}),
        })
        if (hallada.fathomCallId && !hallada.yaTieneProyecto) {
          await db.from('fathom_calls').update({ project_id: proyecto }).eq('id', hallada.fathomCallId).is('project_id', null)
        }
      } else {
        const publica = await reunionPublica(link).catch((err) => { console.warn('[fase2] link público:', (err as Error).message); return null })
        if (!publica) return await falla('No pude abrir esa call. Fijate que sea el link de compartir de Fathom (fathom.video/share/…) o pegá el texto de la call.')
        texto = publica.texto
        Object.assign(parche, { texto, titulo: publica.titulo, fathomId: publica.fathomId, ...(publica.at ? { at: publica.at } : {}) })
      }
    }
    await guardarCall(e.id, { ...parche, estado: 'analizando', error: null })

    const contexto = await contextoDelProyecto(proyecto, [])
    if (contexto == null) return await falla('No encontré el proyecto.')

    let r
    try {
      r = await pensar(
        SISTEMA_CALL, ESQUEMA_CALL,
        `Este es el proyecto:\n\n${contexto}\n\n---\n\nEsta es la llamada con el cliente:\n\n${limpiarTexto(texto)}\n\nBajá la llamada a tierra.`,
        { maxTokens: 12000, timeoutMs: 150_000 },
      )
    } catch (err) {
      return await falla(errorIA(err).msg)
    }
    const analisis = normalizarAnalisis(r.datos, { now: new Date(), modelo: r.modelo })
    if (!analisis) return await falla('La IA no encontró nada concreto en esta llamada.')
    await guardarCall(e.id, { estado: 'lista', error: null, analisis })
  } catch (err) {
    console.error('[fase2] trabajarCall falló:', (err as Error)?.message || err)
    await falla('Algo falló al analizar la call. Probá de nuevo.')
  }
}

async function analizarCall(proyecto: string, entradaId: string): Promise<Response> {
  const { data: fila } = await db.from('project_fase2').select('id, data').eq('id', entradaId).eq('project_id', proyecto).is('deleted_at', null).maybeSingle()
  const e = fila ? normalizarEntrada({ ...fila.data, id: fila.id }) : null
  if (!e || e.kind !== 'call') return json({ error: 'No encontré esa call.' }, 404)
  // Lo que se puede revisar sin esperar se contesta ya.
  if (e.origen === 'fathom' && !e.texto) {
    const link = resolverLink(e.link)
    if (!link.ok) return await fallaCall(e.id, link.error, 400)
  }

  // Se contesta enseguida y el resto sigue en segundo plano: una call larga puede tardar más que el
  // límite de espera de una respuesta (~150 s) y la tarjeta quedaba trabada en "Analizando".
  let terminado = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const trabajo = trabajarCall(proyecto, e).finally(() => { terminado = true; if (timer) clearTimeout(timer) })
  const tope = new Promise<void>((resolve) => {
    timer = setTimeout(async () => {
      if (!terminado) await guardarCall(e.id, { estado: 'error', error: 'La call tardó demasiado en analizarse. Probá de nuevo.' })
      resolve()
    }, TOPE_SEGUNDO_PLANO_MS)
  })
  const todo = Promise.race([trabajo, tope])
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(todo)
  else await todo // sin EdgeRuntime (por ejemplo en local) se espera acá
  return json({ ok: true, enCurso: true }, 202)
}

async function armarPlan(proyecto: string): Promise<Response> {
  const { data: filas, error } = await db.from('project_fase2').select('id, data').eq('project_id', proyecto).is('deleted_at', null).limit(300)
  if (error) return json({ error: 'No pude leer la sección Fase 2.' }, 500)
  const entradas = (filas ?? []).map((f) => normalizarEntrada({ ...f.data, id: f.id })).filter(Boolean) as Array<Record<string, any>>
  const previo = entradas.find((x) => x.kind === 'plan')
  if (previo?.generadoAt && Date.now() - Date.parse(previo.generadoAt) < ESPERA_PLAN_MS) {
    return json({ error: 'Recién se armó el plan para este proyecto. Esperá unos segundos.' }, 429)
  }
  const base = entradas.filter((x) => x.kind !== 'plan')
  const elegibles = entradasParaPlan(base)
  if (!elegibles.length) return json({ error: 'Sumá una nota o analizá una call antes de armar el plan.' }, 422)

  const contexto = await contextoDelProyecto(proyecto, base)
  if (contexto == null) return json({ error: 'No encontré el proyecto.' }, 404)

  let r
  try {
    // Este camino contesta en la misma llamada: tiene que terminar antes del corte de ~150 s de Supabase.
    r = await pensar(SISTEMA_PLAN, ESQUEMA_PLAN, `Este es el proyecto:\n\n${contexto}\n\nArmá el plan para llevarlo a una Fase 2.`, { maxTokens: 8000, timeoutMs: 110_000 })
  } catch (err) {
    const f = errorIA(err)
    return json({ error: f.msg }, f.status)
  }
  const plan = normalizarPlan(r.datos, { projectId: proyecto, basadoEn: elegibles.map((x) => x.id), now: new Date(), modelo: r.modelo })
  if (!plan) return json({ error: 'La IA no encontró nada concreto para proponer. Sumá más notas o calls y probá de nuevo.' }, 422)
  const { data: guardado, error: e2 } = await db.rpc('fase2_guardar_plan', { p_project: proyecto, p_plan: plan })
  if (e2) {
    console.error('[fase2] no pude guardar el plan:', e2.message)
    return json({ error: 'No pude guardar el plan.' }, 500)
  }
  return json({ ok: true, plan: guardado })
}

const guardarPropuesta = async (proyecto: string, patch: Record<string, unknown>) => {
  const { data, error } = await db.rpc('fase2_guardar_propuesta', { p_project: proyecto, p_patch: patch })
  if (error) console.error('[fase2] no pude guardar la propuesta:', error.message)
  return data
}

/* La propuesta corta del tablero: lo que hablaron, qué venderle y cuánto. Lee las calls con texto del
 * proyecto, contesta enseguida y la arma en segundo plano (con varias calls tarda más que una respuesta). */
async function armarPropuesta(proyecto: string): Promise<Response> {
  const { data: filas, error } = await db.from('project_fase2').select('id, data').eq('project_id', proyecto).is('deleted_at', null).limit(300)
  if (error) return json({ error: 'No pude leer las calls.' }, 500)
  const entradas = (filas ?? []).map((f) => normalizarEntrada({ ...f.data, id: f.id })).filter(Boolean) as Array<Record<string, any>>
  const previa = entradas.find((x) => x.kind === 'propuesta')
  const t = Date.parse(previa?.updatedAt || '')
  if (previa?.estado === 'armando' && Number.isFinite(t) && Date.now() - t < MAX_ESPERA_CALL_MS) return json({ ok: true, enCurso: true }, 202)
  const calls = entradas.filter((x) => x.kind === 'call' && x.texto && !x.deletedAt)
  if (!calls.length) return json({ error: 'Cargá al menos una call de Fathom.' }, 422)
  const fila = await guardarPropuesta(proyecto, { estado: 'armando', error: null, pedidoAt: new Date().toISOString() })
  if (!fila) return json({ error: 'No pude guardar la propuesta.' }, 500)

  const trabajo = (async () => {
    try {
      const otras = entradas.filter((x) => x.kind === 'nota' || x.kind === 'plan')
      const contexto = await contextoDelProyecto(proyecto, otras)
      if (contexto == null) { await guardarPropuesta(proyecto, { estado: 'error', error: 'No encontré el proyecto.' }); return }
      let r
      try {
        r = await pensar(
          SISTEMA_PROPUESTA, ESQUEMA_PROPUESTA,
          `Este es el proyecto:\n\n${contexto}\n\n---\n\nEstas son las llamadas con el cliente:\n\n${textoDeCallsParaPropuesta(calls)}\n\nArmá la propuesta de Fase 2.`,
          { maxTokens: 8000, timeoutMs: 240_000 },
        )
      } catch (err) {
        await guardarPropuesta(proyecto, { estado: 'error', error: errorIA(err).msg })
        return
      }
      const p = propuestaDeIA(r.datos, { basadoEn: calls.map((c) => c.id), now: new Date(), modelo: r.modelo })
      if (!p) { await guardarPropuesta(proyecto, { estado: 'error', error: 'La IA no encontró nada concreto para vender en estas calls.' }); return }
      await guardarPropuesta(proyecto, p)
    } catch (err) {
      console.error('[fase2] armarPropuesta falló:', (err as Error)?.message || err)
      await guardarPropuesta(proyecto, { estado: 'error', error: 'Algo falló al armar la propuesta. Probá de nuevo.' })
    }
  })()
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(trabajo)
  else await trabajo
  return json({ ok: true, enCurso: true, propuesta: fila }, 202)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  try {
    const yo = await quienLlama(req)
    if (!yo) return json({ error: 'Sólo el equipo con acceso completo puede hacer esto.' }, 403)
    const b = await req.json().catch(() => ({}))
    const proyecto = String(b.proyecto || '')
    if (!ID_RE.test(proyecto)) return json({ error: 'Falta el proyecto.' }, 400)
    if (b.accion === 'analizar_call') {
      const entrada = String(b.entrada || '')
      if (!ID_RE.test(entrada)) return json({ error: 'Falta la call.' }, 400)
      return await analizarCall(proyecto, entrada)
    }
    if (b.accion === 'armar_plan') return await armarPlan(proyecto)
    if (b.accion === 'armar_propuesta') return await armarPropuesta(proyecto)
    return json({ error: 'Acción desconocida.' }, 400)
  } catch (e) {
    console.error('[fase2]', (e as Error).message)
    return json({ error: 'Algo falló. Probá de nuevo.' }, 500)
  }
})
