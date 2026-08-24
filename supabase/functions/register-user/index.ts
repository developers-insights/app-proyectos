// ============================================================================
// register-user — alta de usuario SIN pasar por el signup público de Supabase.
// Deploy:  Supabase Dashboard → Edge Functions → New function → "register-user"
//          (pegá este código). Igual que onboarding-signup: llamable sin sesión
//          (deploy con "Verify JWT" DESACTIVADO).
//
// Crea el usuario con la Admin API (email_confirm: true) → queda confirmado y NO
// se manda ningún email, así evita por completo el "email rate limit exceeded".
// Además deja creada la fila PENDIENTE en team_members (con service_role, sin
// depender de RLS), para que aparezca en la sección Usuarios lista para aprobar.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const AVATAR_COLORS = ['#F97316', '#6366F1', '#10B981', '#EC4899', '#38BDF8', '#A855F7', '#F59E0B', '#14B8A6', '#EF4444', '#8B5CF6', '#0EA5E9', '#22C55E']
const initialsOf = (n: string) => ((n || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()) || '?'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json().catch(() => ({}))
    const name = String(b.name || '').trim()
    const email = String(b.email || '').trim().toLowerCase()
    const password = String(b.password || '')
    if (!name || !email || !password) return json({ error: 'Faltan datos: nombre, email y contraseña.' }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'El email no tiene un formato válido.' }, 400)
    if (password.length < 6) return json({ error: 'La contraseña tiene que tener al menos 6 caracteres.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1) crear el usuario YA confirmado (no manda mail → no hay rate limit)
    const { error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name },
    })
    if (cErr) {
      const m = String(cErr.message || '')
      if (/already|exists|registered/i.test(m)) return json({ error: 'already_registered' }, 409)
      return json({ error: m }, 400)
    }

    // 2) dejar la fila PENDIENTE en team_members (para que se pueda aprobar)
    const id = 'auto-' + email.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const now = new Date().toISOString()
    const member = {
      id, name, email, initials: initialsOf(name),
      color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      role: '', status: 'pending', access: 'project', assignedProjectId: '',
      createdAt: now, lastSeenAt: now, usageMs: 0,
    }
    // upsert en el formato del store (fila = { id, data, updated_at })
    const { error: tErr } = await admin.from('team_members').upsert({ id, data: member, updated_at: now }, { onConflict: 'id' })
    if (tErr) { /* el usuario ya quedó creado; si esto falla, igual entra y se auto-crea al loguear */ }

    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
