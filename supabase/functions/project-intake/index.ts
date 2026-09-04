// ============================================================================
// Cuestionario de despliegue del cliente — Supabase Edge Function (Deno)
// Deploy:  supabase functions deploy project-intake
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los pone Supabase solo)
//
// Dos acciones, las dos detrás de la MISMA puerta que `project-share`:
// {shareId, password} tienen que coincidir con el proyecto, o no se responde nada.
//
//   { action: 'get' }                        -> { answers: { [questionId]: value } }
//   { action: 'save', questionId, value }    -> { ok: true, savedAt }
//
// Entra con service_role, o sea que salta RLS. Por eso la validación de la
// contraseña es lo primero que pasa y no hay ningún camino que la esquive: si
// alguien llama sin contraseña correcta, se va con 401 antes de tocar la tabla.
//
// verify_jwt = false, igual que project-share: la puerta es la contraseña del
// proyecto, validada acá adentro, no un JWT de Supabase.
//
// El texto de las preguntas NO vive acá: vive en src/lib/intake.js y lo renderiza
// el front. Acá solo entran y salen respuestas indexadas por `questionId`. Así,
// cambiar una pregunta es un deploy del front y nada más.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const rows = (r: any) => (r.data || []).map((x: any) => x.data).filter(Boolean)

// Techo de tamaño por respuesta. La lista de testers es la más grande que
// esperamos (unos 15 correos) y entra de sobra en 8 KB. Existe para que un POST
// no pueda escribir un blob arbitrario en la base.
const MAX_VALUE_BYTES = 8 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const { shareId, password, action } = body as Record<string, unknown>
    if (!shareId) return json({ error: 'Link inválido.' }, 400)

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // --- La puerta. Idéntica a la de project-share, a propósito: un solo link y
    // una sola contraseña para ver el avance y para contestar. -----------------
    const projectsRes = await supa.from('projects').select('data').is('deleted_at', null)
    const project: any = rows(projectsRes).find((p: any) => p.shareId === shareId)
    if (!project || !project.shareEnabled) return json({ error: 'Este link no está activo.' }, 404)
    if (!project.sharePassword || String(password || '') !== String(project.sharePassword)) {
      return json({ error: 'Contraseña incorrecta.' }, 401)
    }

    // --- Leer -----------------------------------------------------------------
    if (action === 'get' || !action) {
      const res = await supa
        .from('client_intake')
        .select('question_id, value, updated_at')
        .eq('project_id', project.id)
      if (res.error) throw res.error
      const answers: Record<string, unknown> = {}
      const savedAt: Record<string, string> = {}
      for (const row of res.data || []) {
        answers[row.question_id] = row.value
        savedAt[row.question_id] = row.updated_at
      }
      return json({ answers, savedAt })
    }

    // --- Guardar --------------------------------------------------------------
    if (action === 'save') {
      const questionId = String((body as any).questionId || '')
      if (!questionId || questionId.length > 120) return json({ error: 'Pregunta inválida.' }, 400)
      const value = (body as any).value
      if (JSON.stringify(value ?? null).length > MAX_VALUE_BYTES) {
        return json({ error: 'La respuesta es demasiado larga.' }, 413)
      }
      const now = new Date().toISOString()
      const res = await supa
        .from('client_intake')
        .upsert(
          { project_id: project.id, question_id: questionId, value: value ?? null, updated_at: now },
          { onConflict: 'project_id,question_id' },
        )
      if (res.error) throw res.error
      return json({ ok: true, savedAt: now })
    }

    return json({ error: 'Acción desconocida.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Error interno' }, 500)
  }
})
