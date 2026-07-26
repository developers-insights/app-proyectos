// ============================================================================
// Agente IA — Supabase Edge Function (Deno)
// Deploy:  supabase functions deploy plan-agent
// Secrets: ANTHROPIC_API_KEY (la carga Manuel a mano — Supabase no la pone sola)
//
// Proxy de streaming hacia la API de Anthropic (Messages API) para que el
// equipo pueda usar la feature "Agente" sin que cada persona necesite su
// propia API key: la key vive acá, server-side, nunca en el navegador.
// Devuelve el stream SSE de Anthropic tal cual (sin bufferear ni re-codificar)
// para que el cliente lo lea en vivo con res.body.getReader().
//
// verify_jwt: esta función se deploya CON verificación de JWT activa (default
// de `supabase functions deploy`) — solo usuarios logueados de la app pueden
// invocarla, a diferencia de onboarding-signup / project-share que son públicas.
// ============================================================================

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const MAX_TOKENS_DEFAULT = 8000
const MAX_TOKENS_CAP = 32000
const MAX_MESSAGES_CHARS = 400_000 // ~400k caracteres, tope defensivo de tamaño de conversación

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json().catch(() => ({}))

    // Modelo: allowlist por prefijo, nunca pasar un id arbitrario a Anthropic.
    const model = String(b.model || '')
    if (!model.startsWith('claude-')) return json({ error: 'Modelo inválido: tiene que ser un modelo de Claude (claude-*).' }, 400)

    // Mensajes: requeridos, no vacíos, con un tope de tamaño total.
    const messages = Array.isArray(b.messages) ? b.messages : null
    if (!messages || messages.length === 0) return json({ error: 'Faltan los mensajes de la conversación.' }, 400)
    if (JSON.stringify(messages).length > MAX_MESSAGES_CHARS) return json({ error: 'La conversación es demasiado larga.' }, 400)

    const system = typeof b.system === 'string' ? b.system : ''

    // max_tokens: default si falta o es inválido, tope duro arriba.
    let maxTokens = Number(b.max_tokens)
    if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = MAX_TOKENS_DEFAULT
    if (maxTokens > MAX_TOKENS_CAP) maxTokens = MAX_TOKENS_CAP

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'Falta el secret ANTHROPIC_API_KEY en Supabase. Cargalo con: supabase secrets set ANTHROPIC_API_KEY=sk-ant-…' }, 500)

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, system, messages, max_tokens: maxTokens, stream: true }),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return json({ error: 'Anthropic ' + upstream.status + ': ' + text.slice(0, 300) }, upstream.status)
    }

    // Passthrough del stream SSE — no leer/bufferear upstream.body, el cliente
    // parsea los eventos content_block_delta por su cuenta.
    return new Response(upstream.body, {
      status: 200,
      headers: { ...cors, 'content-type': 'text/event-stream' },
    })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

// ----------------------------------------------------------------------------
// Deploy:
//
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy plan-agent
//
// Opcional: si esta función no está deployada, el Agente cae a la API key
// personal que cada usuario carga en ⚙ Ajustes — no bloquea la feature.
// ----------------------------------------------------------------------------
