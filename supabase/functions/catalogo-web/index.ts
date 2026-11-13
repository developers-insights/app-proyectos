// ============================================================================
// catalogo-web — Supabase Edge Function (Deno)
// Los proyectos terminados (producción, mantenimiento o entregados) que la web de
// Insights suma solos a su catálogo y a su total. La foto la arma
// src/lib/bridge.js y la recorta catalogoWeb() de src/lib/portafolio.js: es lo
// mismo que ya ve un prospecto en el portafolio, sin cliente, plata ni interno.
//
// GET /catalogo-web → { generado, proyectos: [...] }
//
// Puerta: header `x-catalogo-secret` == catalogo_web_config.secret, en tiempo
// constante (es el mismo secreto que la web tiene en CATALOGO_WEB_SECRET y que el
// trigger catalogo_web_aviso le manda a /api/catalogo/revalidar). Aunque lo que
// devuelve ya es público, cada llamada lee todos los proyectos: sin secreto no
// entra nadie. verify_jwt off: quien llama es el server de la web.
// Se despliega desde la raíz del repo, como sf-puente:
//   supabase functions deploy catalogo-web --project-ref yzmtzyuncekspgtsetwk --use-api --no-verify-jwt
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildBridgeSnapshots } from '../../../src/lib/bridge.js'
import { catalogoWeb, estadoPortafolio } from '../../../src/lib/portafolio.js'
import { projectStage } from '../../../src/lib/stages.js'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

let cacheSecreto: { value: string; at: number } | null = null
async function secreto(): Promise<string> {
  if (cacheSecreto && Date.now() - cacheSecreto.at < 60_000) return cacheSecreto.value
  const { data, error } = await db.from('catalogo_web_config').select('value').eq('key', 'secret').maybeSingle()
  if (error) {
    console.error('[catalogo-web] no pude leer catalogo_web_config:', error.message)
    return ''
  }
  cacheSecreto = { value: typeof data?.value === 'string' ? data.value : '', at: Date.now() }
  return cacheSecreto.value
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

const terminado = (data: Record<string, unknown> | undefined) => {
  const e = estadoPortafolio(projectStage(data ?? {}))
  return !!e && (e.key === 'produccion' || e.key === 'entregado')
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405)
  if (!(await mismo(req.headers.get('x-catalogo-secret'), await secreto()))) return json({ error: 'unauthorized' }, 401)

  const projects = await db.from('projects').select('id,data,deleted_at').is('deleted_at', null)
  if (projects.error) {
    console.error('[catalogo-web] projects:', projects.error.message)
    return json({ error: 'no pude leer los proyectos' }, 500)
  }
  // Sólo los terminados: los planes pesan cientos de KB y acá sólo hace falta el de esos.
  const filas = ((projects.data ?? []) as { id: string; data?: Record<string, unknown>; deleted_at: string | null }[])
    .filter((r) => terminado(r.data))
  const de = (k: string) => [...new Set(filas.map((r) => r.data?.[k]).filter((v): v is string => typeof v === 'string' && v !== ''))]
  const ids = filas.map((r) => r.id)
  const [clients, plans, traducciones] = await Promise.all([
    db.from('clients').select('id,data,deleted_at').is('deleted_at', null).in('id', de('clientId').length ? de('clientId') : ['-']),
    db.from('plans').select('id,data,deleted_at').is('deleted_at', null).in('id', de('planId').length ? de('planId') : ['-']),
    db.from('portafolio_en').select('project_id,data').in('project_id', ids.length ? ids : ['-']),
  ])
  const fallo = clients.error || plans.error
  if (fallo) {
    console.error('[catalogo-web] lectura:', fallo.message)
    return json({ error: 'no pude leer los proyectos' }, 500)
  }
  if (traducciones.error) console.warn('[catalogo-web] portafolio_en:', traducciones.error.message)

  const fotos = buildBridgeSnapshots({
    projects: filas,
    clients: clients.data ?? [],
    plans: plans.data ?? [],
    traducciones: traducciones.error ? [] : traducciones.data ?? [],
  }, new Date())
  return json({ generado: new Date().toISOString(), proyectos: catalogoWeb(fotos) })
})
