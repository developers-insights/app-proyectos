// ============================================================================
// Fathom sync — Supabase Edge Function (Deno)
// Deploy:  supabase functions deploy fathom-sync
// Necesita secrets:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los pone Supabase solo)
// El token de Fathom vive en la tabla fathom_accounts (server-side), nunca en el navegador.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TEAM_DOMAIN = 'insightsapps.tech'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

// --- clasificador de tipo de call a partir de título + resumen ---
function classify(meeting: any) {
  const invitees: any[] = meeting.calendar_invitees || []
  const recordedBy = meeting.recorded_by || {}
  const emails = [recordedBy.email, ...invitees.map((i) => i.email)].filter(Boolean).map((e: string) => e.toLowerCase())
  const isTeam = emails.length > 0 && emails.every((e: string) => e.endsWith('@' + TEAM_DOMAIN))
  const text = (
    (meeting.default_summary?.markdown_formatted || '') + ' ' +
    (meeting.title || meeting.meeting_title || '')
  ).toLowerCase()
  const has = (arr: string[]) => arr.some((k) => text.includes(k))
  if (isTeam) return { type: 'team', isTeam: true, testimonial: null, upsell: null }
  let type = 'soporte'
  if (has(['entrega', 'delivery', 'handover', 'entregar el servicio', 'entregable final', 'cierre del proyecto', 'final del proyecto', 'entrega final']))
    type = 'entrega'
  else if (has(['onboarding', 'bienvenida', 'kick-off', 'kickoff', 'kick off', 'arranque', 'welcome', 'inicio del proyecto', 'primera reunión', 'primera reunion']))
    type = 'onboarding'
  else if (has(['revisión', 'revision', 'review', 'dudas', 'soporte', 'cambios', 'feedback', 'bug', 'avance', 'seguimiento']))
    type = 'soporte'
  const testimonial = type === 'entrega' ? has(['testimonio', 'testimonial', 'reseña', 'resena', 'video testimonio', 'grabar testimonio', 'review del cliente']) : null
  const upsell = type === 'entrega' ? has(['mantenimiento', 'upsell', 'plan de mantenimiento', 'soporte mensual', 'retainer', 'servicio adicional', 'escalar']) : null
  return { type, isTeam: false, testimonial, upsell }
}

// --- match best-effort de cliente/proyecto por el título de la reunión ---
function matchClientProject(meeting: any, clients: any[], projects: any[]) {
  const title = (meeting.title || meeting.meeting_title || '').toLowerCase()
  const domains = (meeting.calendar_invitees || [])
    .filter((i: any) => i.is_external)
    .map((i: any) => (i.email_domain || '').toLowerCase())
  let client = clients.find((c) => c.company && title.includes(c.company.toLowerCase()))
  if (!client) client = clients.find((c) => c.email && domains.includes((c.email.split('@')[1] || '').toLowerCase()))
  const project = projects.find((p) => p.name && title.includes(p.name.toLowerCase()) && (!client || p.clientId === client.id))
    || (client ? projects.find((p) => p.clientId === client.id) : null)
  return { clientId: client?.id || null, projectId: project?.id || null }
}

async function fetchMeetings(apiKey: string, createdAfter: string) {
  const out: any[] = []
  let cursor: string | null = null
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://api.fathom.ai/external/v1/meetings')
    url.searchParams.set('include_summary', 'true')
    if (createdAfter) url.searchParams.set('created_after', createdAfter)
    if (cursor) url.searchParams.set('cursor', cursor)
    const r = await fetch(url.toString(), { headers: { 'X-Api-Key': apiKey } })
    if (!r.ok) throw new Error(`Fathom ${r.status}: ${(await r.text()).slice(0, 160)}`)
    const data = await r.json()
    const items = data.items || data.meetings || data.data || []
    out.push(...items)
    cursor = data.next_cursor || data.cursor || null
    if (!cursor || items.length === 0) break
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...args } = await req.json().catch(() => ({}))

    if (action === 'add_account') {
      const { label, email, apiKey } = args
      if (!apiKey) return json({ error: 'Falta la API key' }, 400)
      const { error } = await supa.from('fathom_accounts').insert({ label: label || email || 'Cuenta Fathom', email: email || null, api_key: apiKey })
      if (error) throw error
      return json({ ok: true })
    }

    if (action === 'list_accounts') {
      const { data, error } = await supa.from('fathom_accounts').select('id, label, email, last_synced, created_at').order('created_at')
      if (error) throw error
      return json({ accounts: data })
    }

    if (action === 'remove_account') {
      const { error } = await supa.from('fathom_accounts').delete().eq('id', args.id)
      if (error) throw error
      return json({ ok: true })
    }

    if (action === 'sync') {
      // clientes/proyectos para matchear — desde las tablas por-fila (app_state retirado)
      let clients: any[] = [], projects: any[] = []
      const [{ data: cliRows }, { data: projRows }] = await Promise.all([
        supa.from('clients').select('data').is('deleted_at', null),
        supa.from('projects').select('data').is('deleted_at', null),
      ])
      clients = (cliRows || []).map((r: any) => r.data).filter(Boolean)
      projects = (projRows || []).map((r: any) => r.data).filter(Boolean)

      const { data: accounts, error: accErr } = await supa.from('fathom_accounts').select('*')
      if (accErr) throw accErr
      if (!accounts?.length) return json({ ok: true, imported: 0, note: 'No hay cuentas de Fathom cargadas.' })

      let imported = 0
      const errors: string[] = []
      for (const acc of accounts) {
        try {
          const since = acc.last_synced || new Date(Date.now() - 120 * 86400000).toISOString()
          const meetings = await fetchMeetings(acc.api_key, since)
          for (const m of meetings) {
            const rid = String(m.recording_id ?? m.id ?? m.share_url ?? crypto.randomUUID())
            const c = classify(m)
            const cp = matchClientProject(m, clients, projects)
            const externals = (m.calendar_invitees || []).filter((i: any) => i.is_external).map((i: any) => ({ name: i.name, email: i.email, domain: i.email_domain }))
            const row = {
              id: rid,
              account_id: acc.id,
              title: m.title || m.meeting_title || 'Reunión',
              asesor: m.recorded_by?.name || acc.label,
              asesor_email: m.recorded_by?.email || acc.email || null,
              type: c.type,
              is_team: c.isTeam,
              external_participants: externals,
              call_date: m.recording_start_time || m.scheduled_start_time || m.created_at || new Date().toISOString(),
              share_url: m.share_url || m.url || null,
              testimonial: c.testimonial,
              upsell: c.upsell,
              synced_at: new Date().toISOString(),
            }
            // upsert sin pisar la asignación manual de cliente/proyecto ni los flags editados
            const { data: existing } = await supa.from('fathom_calls').select('client_id, project_id, testimonial, upsell').eq('id', rid).maybeSingle()
            const merged = existing
              ? { ...row, client_id: existing.client_id, project_id: existing.project_id, testimonial: existing.testimonial ?? row.testimonial, upsell: existing.upsell ?? row.upsell }
              : { ...row, client_id: cp.clientId, project_id: cp.projectId }
            const { error: upErr } = await supa.from('fathom_calls').upsert(merged)
            if (!upErr) imported++
          }
          await supa.from('fathom_accounts').update({ last_synced: new Date().toISOString() }).eq('id', acc.id)
        } catch (e) {
          errors.push(`${acc.label}: ${(e as Error).message}`)
        }
      }
      return json({ ok: true, imported, errors })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
