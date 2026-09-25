import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Siempre 200 con `error` adentro: functions.invoke no deja leer el cuerpo de un != 2xx.
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })

const APP_URL = 'https://proyectos.insightsapps.tech'
const FROM = 'insights. <accesos@speedfunnels.app>'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
function tempPassword(len = 10) {
  const all = UPPER + LOWER + DIGITS
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]
  const chars = [pick(UPPER), pick(DIGITS), pick(LOWER)]
  while (chars.length < len) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function emailHtml(first: string, email: string, password: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f5f9;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b1220">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e3e8f0;padding:32px">
<tr><td style="font-size:20px;font-weight:700;letter-spacing:-.03em">insights<span style="color:#0A63E8">.</span></td></tr>
<tr><td style="padding-top:24px;font-size:20px;font-weight:700">Hola ${esc(first)}, ya tenés tu acceso</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#46526a">Te sumamos al portal de proyectos de insights. Estos son tus datos para entrar:</td></tr>
<tr><td style="padding-top:20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;border:1px solid #e3e8f0;border-radius:12px;padding:16px 18px">
<tr><td style="font-size:12px;color:#7a869c;text-transform:uppercase;letter-spacing:.06em">Usuario</td></tr>
<tr><td style="font-size:15px;font-weight:600;padding:4px 0 14px;font-family:ui-monospace,Menlo,Consolas,monospace">${esc(email)}</td></tr>
<tr><td style="font-size:12px;color:#7a869c;text-transform:uppercase;letter-spacing:.06em">Contraseña temporal</td></tr>
<tr><td style="font-size:17px;font-weight:700;padding-top:4px;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em">${esc(password)}</td></tr>
</table></td></tr>
<tr><td style="padding-top:24px"><a href="${APP_URL}" style="display:inline-block;background:#0A63E8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Entrar al portal</a></td></tr>
<tr><td style="padding-top:20px;font-size:13.5px;line-height:1.6;color:#46526a">Apenas entres te vamos a pedir que elijas tu propia contraseña. Esta temporal deja de servir en ese momento.</td></tr>
</table>
<div style="font-size:12px;color:#8b95a8;padding-top:16px">Si no esperabas este mail, podés ignorarlo.</div>
</td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await admin.auth.getUser(token)
    const callerEmail = String(caller?.user?.email || '').toLowerCase()
    if (!callerEmail) return json({ error: 'unauthorized' })
    // Solo invita alguien del equipo interno: los registros públicos quedan en status
    // 'pending' o con access 'project' y no pueden dar de alta cuentas.
    const { data: rows, error: tErr } = await admin.from('team_members').select('data').is('deleted_at', null)
    if (tErr) return json({ error: tErr.message })
    const inviter = (rows || []).map((r) => r.data || {}).find((m) => String(m.email || '').toLowerCase() === callerEmail)
    if (!inviter || inviter.status === 'pending' || inviter.access === 'project') return json({ error: 'forbidden' })

    const b = await req.json().catch(() => ({}))
    const name = String(b.name || '').trim()
    const email = String(b.email || '').trim().toLowerCase()
    if (!name || !email) return json({ error: 'Faltan el nombre o el email.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'El email no tiene un formato válido.' })

    const password = tempPassword()
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, must_change_password: true },
    })
    if (cErr) {
      const m = String(cErr.message || '')
      if (/already|exists|registered/i.test(m)) return json({ error: 'already_registered' })
      return json({ error: m })
    }

    const first = name.split(/\s+/)[0] || name
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: callerEmail,
        subject: 'Tu acceso a insights.',
        html: emailHtml(first, email, password),
        text: `Hola ${first}, ya tenés tu acceso al portal de proyectos de insights.\n\nUsuario: ${email}\nContraseña temporal: ${password}\n\nEntrá en ${APP_URL}. Apenas entres te vamos a pedir que elijas tu propia contraseña.`,
      }),
    })
    if (!r.ok) {
      // La cuenta ya existe pero nadie conoce la contraseña: se borra para que reintentar funcione.
      if (created?.user) await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: 'email_failed', detail: await r.text() })
    }
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message })
  }
})
