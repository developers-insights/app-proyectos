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

// La contraseña nueva vuelve a quien la generó, así que resetear a un fundador es tomar su
// cuenta: solo otro fundador puede. Tiene que coincidir con isFounder() de src/InsightsApp.jsx.
const FOUNDER_IDS = ['u1', 'u5']
const FOUNDER_EMAILS = ['federicog@insightsapps.tech', 'juanp@insightsapps.tech']
const isFounder = (m: Record<string, unknown> | undefined, email: string) =>
  !!m && (FOUNDER_IDS.includes(String(m.id)) || FOUNDER_EMAILS.includes(email))

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
<tr><td style="padding-top:24px;font-size:20px;font-weight:700">Hola ${esc(first)}, tenés una contraseña nueva</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#46526a">Te generamos una contraseña temporal para que vuelvas a entrar al portal de proyectos:</td></tr>
<tr><td style="padding-top:20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;border:1px solid #e3e8f0;border-radius:12px;padding:16px 18px">
<tr><td style="font-size:12px;color:#7a869c;text-transform:uppercase;letter-spacing:.06em">Usuario</td></tr>
<tr><td style="font-size:15px;font-weight:600;padding:4px 0 14px;font-family:ui-monospace,Menlo,Consolas,monospace">${esc(email)}</td></tr>
<tr><td style="font-size:12px;color:#7a869c;text-transform:uppercase;letter-spacing:.06em">Contraseña temporal</td></tr>
<tr><td style="font-size:17px;font-weight:700;padding-top:4px;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em">${esc(password)}</td></tr>
</table></td></tr>
<tr><td style="padding-top:24px"><a href="${APP_URL}" style="display:inline-block;background:#0A63E8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Entrar al portal</a></td></tr>
<tr><td style="padding-top:20px;font-size:13.5px;line-height:1.6;color:#46526a">Apenas entres te vamos a pedir que elijas tu propia contraseña. La anterior ya no sirve.</td></tr>
</table>
<div style="font-size:12px;color:#8b95a8;padding-top:16px">Si no lo pediste, avisale al equipo de insights.</div>
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: caller } = await admin.auth.getUser(token)
    const callerEmail = String(caller?.user?.email || '').toLowerCase()
    if (!callerEmail) return json({ error: 'unauthorized' })
    const { data: rows, error: tErr } = await admin.from('team_members').select('data').is('deleted_at', null)
    if (tErr) return json({ error: tErr.message })
    const members = (rows || []).map((r) => r.data || {})
    const resetter = members.find((m) => String(m.email || '').toLowerCase() === callerEmail)
    if (!resetter || resetter.status === 'pending' || resetter.access === 'project' || resetter.access === 'collab') return json({ error: 'forbidden' })

    const b = await req.json().catch(() => ({}))
    const email = String(b.email || '').trim().toLowerCase()
    if (!email) return json({ error: 'Falta el email.' })
    if (email === callerEmail) return json({ error: 'self' })

    const member = members.find((m) => String(m.email || '').toLowerCase() === email)
    if (isFounder(member, email) && !isFounder(resetter, callerEmail)) return json({ error: 'forbidden_founder' })

    const target = await findUserByEmail(admin, email)
    if (!target) return json({ error: 'no_account' })

    const password = tempPassword()
    const { error: uErr } = await admin.auth.admin.updateUserById(target.id, {
      password,
      user_metadata: { ...(target.user_metadata || {}), must_change_password: true },
    })
    if (uErr) return json({ error: uErr.message })

    const name = String(member?.name || target.user_metadata?.name || '').trim()
    const first = name.split(/\s+/)[0] || email.split('@')[0]
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: callerEmail,
        subject: 'Tu nueva contraseña de insights.',
        html: emailHtml(first, email, password),
        text: `Hola ${first}, te generamos una contraseña temporal para el portal de proyectos de insights.\n\nUsuario: ${email}\nContraseña temporal: ${password}\n\nEntrá en ${APP_URL}. Apenas entres te vamos a pedir que elijas tu propia contraseña.`,
      }),
    })
    // La contraseña ya cambió: se devuelve igual para que quien la generó se la pase por otro canal.
    return json({ ok: true, password, emailed: r.ok })
  } catch (e) {
    return json({ error: (e as Error).message })
  }
})
