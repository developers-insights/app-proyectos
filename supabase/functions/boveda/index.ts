// ============================================================================
// boveda — Supabase Edge Function (Deno)
// Baúl de datos del cliente por proyecto. Los valores NO viven en esta base: la bóveda es la de
// Clarity (cb_vault_items, cifrada con una clave que sólo tiene el server de Clarity). Esta función
// verifica que quien pide es del equipo y le pasa el pedido a https://claritybusiness.app/api/boveda
// con CLARITY_PUENTE_SECRET. Lo que se carga acá aparece en la pestaña Bóveda de Clarity y al revés.
//
// POST { accion, proyecto?: '<id del proyecto>', personal?: true, item?, link?, items?, destinos?, pisar?, ...campos }
//   accion: listar | ver | guardar | borrar | ver_todos | pedir | link | revocar
//           destinatarios | compartir | descompartir (sólo personal y sólo entre admins)
//   personal: Mis claves de quien llama (las ve sólo esa persona, acá y en Clarity). La identidad es su mail.
// ============================================================================
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Siempre 200 con `error` adentro: functions.invoke no deja leer el cuerpo de un != 2xx.
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } })

const CLARITY = 'https://claritybusiness.app/api/boveda'
const ACCIONES = new Set(['listar', 'ver', 'guardar', 'borrar', 'ver_todos', 'pedir', 'link', 'revocar', 'destinatarios', 'compartir', 'descompartir'])
const COMPARTIR = new Set(['destinatarios', 'compartir', 'descompartir'])
const CAMPOS = ['tipo', 'nombre', 'etiqueta', 'categoria', 'uso', 'valor', 'usuario', 'clave', 'url', 'notas'] as const
// Manuel, Fede, Juan y Nacho, por id y mail. El mail va fijo acá y no se lee de team_members: cualquier
// miembro full puede editar la fila de otro (is_team), y con eso se haría pasar por Fede y recibiría lo suyo.
const ADMINS: Record<string, string> = {
  u3: 'manuelnavarro@insightsapps.tech',
  u1: 'federicog@insightsapps.tech',
  u5: 'juanp@insightsapps.tech',
  u7: 'nachocachaza@insightsapps.tech',
}

type Miembro = { id?: string; name?: string; email?: string; status?: string; access?: string }
type Item = { id: string; nombre: string; etiqueta?: string | null; tipo: string; categoria?: string; uso?: string; estado: string; cargado_at?: string }

async function clarity(cuerpo: Record<string, unknown>) {
  const secreto = Deno.env.get('CLARITY_PUENTE_SECRET') || ''
  if (!secreto) throw new Error('falta CLARITY_PUENTE_SECRET')
  const r = await fetch(CLARITY, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-puente-secret': secreto },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await r.json().catch(() => ({ error: `Clarity respondió ${r.status}` }))
  if (!r.ok || data?.error) throw new Error(data?.error || `Clarity respondió ${r.status}`)
  return data
}

const nombreCorto = (m: Miembro) => String(m.name || m.email || '').split(/\s+/)[0]
const personalDe = (m: Miembro) => ({ personal: true, quien: String(m.email).toLowerCase(), titulo: nombreCorto(m) })
const mensaje = (e: unknown) => String((e as Error)?.message || e).slice(0, 200)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await admin.auth.getUser(token)
    const email = String(caller?.user?.email || '').toLowerCase()
    if (!email || !caller?.user?.email_confirmed_at) return json({ error: 'unauthorized' })
    const { data: rows, error: tErr } = await admin.from('team_members').select('id, data').is('deleted_at', null)
    if (tErr) return json({ error: tErr.message })
    const equipo: Miembro[] = (rows || []).map((r) => ({ ...(r.data || {}), id: r.id }))
    const yo = equipo.find((m) => String(m.email || '').toLowerCase() === email)
    if (!yo || yo.status !== 'approved') return json({ error: 'forbidden' })

    const b = await req.json().catch(() => ({}))
    const accion = String(b.accion || '')
    if (!ACCIONES.has(accion)) return json({ error: 'acción desconocida' })
    const personal = b.personal === true

    if (COMPARTIR.has(accion)) {
      if (!personal) return json({ error: 'sólo se comparte desde Mis claves' })
      const soyAdmin = Object.values(ADMINS).includes(email)
      const otros: Miembro[] = Object.entries(ADMINS)
        .filter(([, mail]) => mail !== email)
        .map(([id, mail]) => {
          const fila = equipo.find((m) => m.id === id)
          return { id, email: mail, name: fila?.name || mail.split('@')[0], status: fila?.status }
        })
        .filter((m) => m.status === 'approved')
      if (accion === 'destinatarios') return json({ destinatarios: soyAdmin ? otros.map((m) => ({ id: m.id, nombre: m.name })) : [] })
      if (!soyAdmin) return json({ error: 'forbidden' })
      yo.email = email
      try { return json(await compartir(admin, accion, yo, otros, b)) } catch (e) { return json({ error: mensaje(e) }) }
    }

    let cuerpo: Record<string, unknown>
    if (personal) {
      // Lo propio lo tiene cualquiera del equipo aprobado, colaboradores incluidos; un cliente del portal no.
      if (yo.access === 'project') return json({ error: 'forbidden' })
      cuerpo = { accion, ...personalDe(yo) }
    } else {
      // Misma regla que is_team(): aprobado y full. Un colaborador no ve el baúl de un proyecto.
      if (yo.access !== 'full') return json({ error: 'forbidden' })
      const proyecto = String(b.proyecto || '')
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(proyecto)) return json({ error: 'falta el proyecto' })
      // Sólo proyectos vivos de esta app: la bóveda de Clarity confía en el id que llega acá.
      const { data: existe } = await admin.from('projects').select('id, data').eq('id', proyecto).is('deleted_at', null).maybeSingle()
      if (!existe) return json({ error: 'no existe el proyecto' })
      cuerpo = { accion, fuente: proyecto, quien: email, titulo: String(existe.data?.name || '').slice(0, 120) }
    }
    if (b.item) cuerpo.item = String(b.item)
    if (b.link) cuerpo.link = String(b.link)
    if (Array.isArray(b.items)) cuerpo.items = b.items.slice(0, 30).map((i: { nombre?: unknown; ayuda?: unknown; tipo?: unknown }) => ({ nombre: String(i?.nombre || ''), ayuda: String(i?.ayuda || ''), tipo: i?.tipo === 'imagen' ? 'imagen' : 'env' }))
    for (const k of CAMPOS) if (b[k] !== undefined) cuerpo[k] = String(b[k])

    let data
    try { data = await clarity(cuerpo) } catch (e) { return json({ error: mensaje(e) }) }
    if (personal && accion === 'listar') data = await conQuienCompartio(admin, equipo, email, data)
    return json(data)
  } catch (e) {
    return json({ error: String(e).slice(0, 200) })
  }
})

// Le suma `compartida_por` a lo que otro admin le pasó y nadie volvió a cargar después.
async function conQuienCompartio(admin: SupabaseClient, equipo: Miembro[], email: string, data: { items?: Item[] }) {
  if (!data?.items?.length) return data
  const { data: filas } = await admin.from('vault_shares').select('de_email, nombre, created_at').eq('para_email', email)
  if (!filas?.length) return data
  const items = data.items.map((it) => {
    const f = filas.filter((x) => x.nombre === it.nombre).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    // 2 min de margen: Clarity pone cargado_at un instante antes de que se registre acá.
    if (!f || (it.cargado_at && Date.parse(it.cargado_at) > Date.parse(f.created_at) + 120_000)) return it
    const de = equipo.find((m) => String(m.email || '').toLowerCase() === f.de_email)
    return { ...it, compartida_por: de ? nombreCorto(de) : f.de_email.split('@')[0] }
  })
  return { ...data, items }
}

async function compartir(admin: SupabaseClient, accion: string, yo: Miembro, otros: Miembro[], b: Record<string, unknown>) {
  const ids = new Set((Array.isArray(b.destinos) ? b.destinos : []).map(String))
  const destinos = otros.filter((m) => ids.has(String(m.id)))
  if (!destinos.length) return { error: 'Elegí a quién se la compartís.' }
  const mio = personalDe(yo)
  const lista = await clarity({ accion: 'listar', ...mio })
  const it = ((lista.items || []) as Item[]).find((i) => i.id === String(b.item || ''))
  if (!it) return { error: 'Esa clave ya no está en tu bóveda.' }
  const de = mio.quien

  if (accion === 'descompartir') {
    // Sólo se borra la copia exacta que creó este compartir: si pisó una clave que el otro ya tenía, o si
    // el otro la volvió a cargar después, no se toca. Nunca se borra una clave propia del otro.
    const resultados = []
    for (const m of destinos) {
      const para = String(m.email).toLowerCase()
      const { data: reg } = await admin.from('vault_shares').select('copia_id, nueva, created_at').eq('para_email', para).eq('nombre', it.nombre).eq('de_email', de).maybeSingle()
      if (!reg?.copia_id || !reg.nueva) { resultados.push({ id: m.id, estado: 'no_compartida' }); continue }
      try {
        const suyo = await clarity({ accion: 'listar', ...personalDe(m) })
        const copia = ((suyo.items || []) as Item[]).find((i) => i.id === reg.copia_id)
        const tocada = copia?.cargado_at && Date.parse(copia.cargado_at) > Date.parse(reg.created_at) + 120_000
        if (tocada) { resultados.push({ id: m.id, estado: 'no_compartida' }); continue }
        if (copia) await clarity({ accion: 'borrar', ...personalDe(m), item: copia.id })
        await admin.from('vault_shares').delete().eq('para_email', para).eq('nombre', it.nombre).eq('de_email', de)
        resultados.push({ id: m.id, estado: 'quitada' })
      } catch (e) { resultados.push({ id: m.id, estado: 'error', error: mensaje(e) }) }
    }
    return { resultados }
  }

  if (it.estado !== 'cargado') return { error: 'Esa clave todavía no tiene valor.' }
  if (it.tipo === 'imagen') return { error: 'Las imágenes no se pueden compartir todavía.' }
  const { valor } = await clarity({ accion: 'ver', ...mio, item: it.id })
  const campos: Record<string, string> = { tipo: it.tipo, nombre: it.nombre, categoria: it.categoria || 'other' }
  if (it.uso) campos.uso = it.uso
  if (it.etiqueta) campos.etiqueta = it.etiqueta
  if (valor?.tipo === 'credencial') Object.assign(campos, { usuario: valor.usuario || '', clave: valor.clave || '', url: valor.url || '', notas: valor.notas || '' })
  else campos.valor = String(valor?.valor ?? '')

  const pisar = b.pisar === true
  const resultados = []
  for (const m of destinos) {
    const suyo = personalDe(m)
    try {
      const actual = await clarity({ accion: 'listar', ...suyo })
      const ya = ((actual.items || []) as Item[]).find((i) => i.nombre === it.nombre && i.estado === 'cargado')
      if (ya && !pisar) { resultados.push({ id: m.id, estado: 'ya_tiene' }); continue }
      const g = await clarity({ accion: 'guardar', ...suyo, ...campos })
      await admin.from('vault_shares').upsert({ de_email: de, para_email: suyo.quien, nombre: it.nombre, copia_id: String(g?.id || ''), nueva: !ya, created_at: new Date().toISOString() })
      resultados.push({ id: m.id, estado: ya ? 'reemplazada' : 'compartida' })
    } catch (e) { resultados.push({ id: m.id, estado: 'error', error: mensaje(e) }) }
  }
  return { nombre: it.nombre, resultados }
}
