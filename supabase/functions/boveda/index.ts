// ============================================================================
// boveda — Supabase Edge Function (Deno)
// Baúl de datos del cliente por proyecto. Los valores NO viven en esta base: la bóveda es la de
// Clarity (cb_vault_items, cifrada con una clave que sólo tiene el server de Clarity). Esta función
// verifica que quien pide es del equipo y le pasa el pedido a https://claritybusiness.app/api/boveda
// con CLARITY_PUENTE_SECRET. Lo que se carga acá aparece en la pestaña Bóveda de Clarity y al revés.
//
// POST { accion: 'listar' | 'ver' | 'guardar' | 'borrar', proyecto: '<id del proyecto>', item?, ...campos }
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Siempre 200 con `error` adentro: functions.invoke no deja leer el cuerpo de un != 2xx.
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } })

const CLARITY = 'https://claritybusiness.app/api/boveda'
const ACCIONES = new Set(['listar', 'ver', 'guardar', 'borrar'])
const CAMPOS = ['tipo', 'nombre', 'etiqueta', 'categoria', 'uso', 'valor', 'usuario', 'clave', 'url', 'notas'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await admin.auth.getUser(token)
    const email = String(caller?.user?.email || '').toLowerCase()
    if (!email || !caller?.user?.email_confirmed_at) return json({ error: 'unauthorized' })
    // Misma regla que is_team(): aprobado y full. Un cliente del portal o un colaborador no ve el baúl.
    const { data: rows, error: tErr } = await admin.from('team_members').select('data').is('deleted_at', null)
    if (tErr) return json({ error: tErr.message })
    const yo = (rows || []).map((r) => r.data || {}).find((m) => String(m.email || '').toLowerCase() === email)
    if (!yo || yo.status !== 'approved' || yo.access !== 'full') return json({ error: 'forbidden' })

    const b = await req.json().catch(() => ({}))
    const accion = String(b.accion || '')
    const proyecto = String(b.proyecto || '')
    if (!ACCIONES.has(accion)) return json({ error: 'acción desconocida' })
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(proyecto)) return json({ error: 'falta el proyecto' })
    // Sólo proyectos vivos de esta app: la bóveda de Clarity confía en el id que llega acá.
    const { data: existe } = await admin.from('projects').select('id').eq('id', proyecto).is('deleted_at', null).maybeSingle()
    if (!existe) return json({ error: 'no existe el proyecto' })

    const cuerpo: Record<string, unknown> = { accion, fuente: proyecto, quien: email }
    if (b.item) cuerpo.item = String(b.item)
    for (const k of CAMPOS) if (b[k] !== undefined) cuerpo[k] = String(b[k])

    const secreto = Deno.env.get('CLARITY_PUENTE_SECRET') || ''
    if (!secreto) return json({ error: 'falta CLARITY_PUENTE_SECRET' })
    const r = await fetch(CLARITY, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-puente-secret': secreto },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await r.json().catch(() => ({ error: `Clarity respondió ${r.status}` }))
    return json(r.ok ? data : { error: data?.error || `Clarity respondió ${r.status}` })
  } catch (e) {
    return json({ error: String(e).slice(0, 200) })
  }
})
