import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })

const APP_URL = 'https://proyectos.insightsapps.tech'
const FROM = 'insights. <accesos@speedfunnels.app>'
const COOLDOWN_MS = 60_000

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function emailHtml(first: string, link: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f5f9;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b1220">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e3e8f0;padding:32px">
<tr><td style="font-size:20px;font-weight:700;letter-spacing:-.03em">insights<span style="color:#0A63E8">.</span></td></tr>
<tr><td style="padding-top:24px;font-size:20px;font-weight:700">Hola ${esc(first)}, elegí tu nueva contraseña</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#46526a">Nos pediste recuperar el acceso al portal de proyectos. Tocá el botón y escribí la contraseña que quieras.</td></tr>
<tr><td style="padding-top:24px"><a href="${link}" style="display:inline-block;background:#0A63E8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Cambiar mi contraseña</a></td></tr>
<tr><td style="padding-top:20px;font-size:13.5px;line-height:1.6;color:#46526a">El link sirve una sola vez y vence en una hora.</td></tr>
</table>
<div style="font-size:12px;color:#8b95a8;padding-top:16px">Si no lo pediste, ignorá este mail: tu contraseña sigue siendo la misma.</div>
</td></tr></table></body></html>`
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => String(u.email || '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

// Responde siempre { ok: true } exista o no la cuenta: si no, sirve para averiguar qué emails están registrados.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json().catch(() => ({}))
    const email = String(b.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const user = await findUserByEmail(admin, email)
    if (!user) return json({ ok: true })
    const last = user.recovery_sent_at ? new Date(user.recovery_sent_at).getTime() : 0
    if (Date.now() - last < COOLDOWN_MS) return json({ ok: true })

    const { data: gen, error: gErr } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    if (gErr || !gen?.properties?.hashed_token) return json({ error: gErr?.message || 'no_link' })
    // Link propio con el token hasheado en vez del action_link de Supabase: el token se canjea
    // recién cuando la persona guarda la contraseña, así un escáner de mails que abre el link no lo quema.
    const link = `${APP_URL}/?recuperar=${encodeURIComponent(gen.properties.hashed_token)}`

    const { data: rows } = await admin.from('team_members').select('data').is('deleted_at', null)
    const member = (rows || []).map((r) => r.data || {}).find((m) => String(m.email || '').toLowerCase() === email)
    const first = String(member?.name || user.user_metadata?.name || '').trim().split(/\s+/)[0] || email.split('@')[0]

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: 'Recuperá tu contraseña de insights.',
        html: emailHtml(first, link),
        text: `Hola ${first}, nos pediste recuperar el acceso al portal de proyectos de insights.\n\nEntrá a este link para elegir tu nueva contraseña (sirve una vez y vence en una hora):\n${link}\n\nSi no lo pediste, ignorá este mail.`,
      }),
    })
    if (!r.ok) return json({ error: 'email_failed' })
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message })
  }
})
