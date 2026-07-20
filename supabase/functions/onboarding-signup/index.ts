// ============================================================================
// Onboarding público — Supabase Edge Function (Deno)
// Deploy:  supabase functions deploy onboarding-signup   (o desde el dashboard)
// Recibe el formulario de la landing y crea un cliente nuevo + un proyecto nuevo
// (PM = Nacho, Dev = el que tenga menos proyectos, tag "Nuevo proyecto").
//
// PERSISTENCIA POR-FILA (anti-clobber): escribe UNA fila en cada tabla
// (clients / projects / activity). Ya NO hace read-modify-write del documento
// monolítico app_state, así que dos onboardings simultáneos (o un onboarding
// mientras el equipo edita) no se pisan nunca.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const rid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json().catch(() => ({}))
    const projectName = String(b.projectName || '').trim()
    const company = String(b.company || '').trim()
    if (!projectName) return json({ error: 'Falta el nombre del proyecto.' }, 400)

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Equipo + proyectos actuales para calcular PM/Dev — desde las tablas por-fila.
    const [{ data: teamRows }, { data: projRows }] = await Promise.all([
      supa.from('team_members').select('data').is('deleted_at', null),
      supa.from('projects').select('data').is('deleted_at', null),
    ])
    const team: any[] = (teamRows || []).map((r: any) => r.data).filter(Boolean)
    const projects: any[] = (projRows || []).map((r: any) => r.data).filter(Boolean)

    // PM = Nacho
    const nacho = team.find((u) => /nacho/i.test(u.name || '') || String(u.email || '').toLowerCase() === 'nachocachaza@insightsapps.tech')
    // Dev = el que menos proyectos tenga asignados como dev (excluye a Nacho)
    const counts: Record<string, number> = {}
    team.forEach((u) => { counts[u.id] = 0 })
    projects.forEach((p) => { const d = p.assignments?.dev?.userId; if (d != null && counts[d] != null) counts[d]++ })
    const candidates = team.filter((u) => !nacho || u.id !== nacho.id)
    candidates.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))
    const dev = candidates[0] || null

    const now = new Date().toISOString()
    const clientId = 'c-' + rid()
    const client = {
      id: clientId, name: String(b.name || '').trim(), company, email: String(b.email || '').trim(), phone: String(b.phone || '').trim(), address: String(b.address || '').trim(),
      onboarding: { businessDescription: String(b.businessDescription || '').trim(), goals: String(b.goals || '').trim(), existingTech: '', approvedBudget: 0, notes: b.address ? ('Dirección: ' + b.address) : '' },
      updatedAt: now,
    }
    const projId = 'p-' + rid()
    const project = {
      id: projId, clientId, name: projectName, status: 'active', priority: 'normal',
      assignments: { pm: nacho ? { userId: nacho.id, roleLabel: 'Project Manager' } : null, dev: dev ? { userId: dev.id, roleLabel: 'Developer' } : null },
      tags: [{ id: rid(), text: 'Nuevo proyecto', color: '#22C55E' }],
      sprints: [], avances: [], comms: [], scopeFiles: [], salesLinks: [], scopeNotes: [], risks: [], pendingAgency: [], pendingClient: [], chats: [], activity: [], clientTasks: [],
      createdAt: now, updatedAt: now,
      testingUrl: '', whatsappUrl: '', productionUrl: '', driveUrl: '', totalAmount: 0, paidAmount: 0, lastDeployDate: null, githubRepo: '', kickoff: String(b.businessDescription || '').trim(), stack: '',
      cardActions: { scope: true, testing: true, whatsapp: true },
    }
    const act = { id: rid(), date: now, actorId: nacho?.id || '', type: 'project-add', text: `entró un proyecto nuevo por onboarding: "${projectName}" (${company || 'cliente'})`, updatedAt: now }

    // Una fila por entidad — inserts independientes, sin pisar nada.
    const { error: cErr } = await supa.from('clients').insert({ id: clientId, data: client, updated_at: now })
    if (cErr) throw cErr
    const { error: pErr } = await supa.from('projects').insert({ id: projId, data: project, updated_at: now })
    if (pErr) throw pErr
    await supa.from('activity').insert({ id: act.id, data: act, updated_at: now })   // best-effort (no bloquea el alta)

    return json({ ok: true, projectName, pm: nacho?.name || null, dev: dev?.name || null })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
