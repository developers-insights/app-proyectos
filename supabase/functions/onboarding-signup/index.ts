// ============================================================================
// Onboarding público — Supabase Edge Function (Deno)
// Deploy:  supabase functions deploy onboarding-signup   (o desde el dashboard, Via Editor)
// Recibe el formulario de la landing y crea, en app_state, un cliente nuevo + un
// proyecto nuevo (PM = Nacho, Dev = el que tenga menos proyectos, tag "Nuevo proyecto").
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
    const { data: row, error: readErr } = await supa.from('app_state').select('data').eq('id', 'main').maybeSingle()
    if (readErr) throw readErr
    const st: any = row?.data
    if (!st) return json({ error: 'No se pudo cargar la base.' }, 500)

    const team: any[] = st.team || []
    const projects: any[] = st.projects || []
    const clients: any[] = st.clients || []

    // PM = Nacho
    const nacho = team.find((u) => /nacho/i.test(u.name || '') || String(u.email || '').toLowerCase() === 'nachocachaza@insightsapps.tech')
    // Dev = el que menos proyectos tenga asignados como dev (excluye a Nacho)
    const counts: Record<string, number> = {}
    team.forEach((u) => { counts[u.id] = 0 })
    projects.forEach((p) => { const d = p.assignments?.dev?.userId; if (d != null && counts[d] != null) counts[d]++ })
    const candidates = team.filter((u) => !nacho || u.id !== nacho.id)
    candidates.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))
    const dev = candidates[0] || null

    const clientId = 'c-' + rid()
    const client = {
      id: clientId, name: String(b.name || '').trim(), company, email: String(b.email || '').trim(), phone: String(b.phone || '').trim(), address: String(b.address || '').trim(),
      onboarding: { businessDescription: String(b.businessDescription || '').trim(), goals: String(b.goals || '').trim(), existingTech: '', approvedBudget: 0, notes: b.address ? ('Dirección: ' + b.address) : '' },
    }
    const projId = 'p-' + rid()
    const project = {
      id: projId, clientId, name: projectName, status: 'active', priority: 'normal',
      assignments: { pm: nacho ? { userId: nacho.id, roleLabel: 'Project Manager' } : null, dev: dev ? { userId: dev.id, roleLabel: 'Developer' } : null },
      tags: [{ id: rid(), text: 'Nuevo proyecto', color: '#22C55E' }],
      sprints: [], avances: [], comms: [], scopeFiles: [], salesLinks: [], scopeNotes: [], risks: [], pendingAgency: [], pendingClient: [], chats: [], activity: [], clientTasks: [],
      createdAt: new Date().toISOString(),
      testingUrl: '', whatsappUrl: '', productionUrl: '', driveUrl: '', totalAmount: 0, paidAmount: 0, lastDeployDate: null, githubRepo: '', kickoff: String(b.businessDescription || '').trim(), stack: '',
      cardActions: { scope: true, testing: true, whatsapp: true },
    }

    const next = {
      ...st,
      clients: [...clients, client],
      projects: [project, ...projects],
      activity: [{ id: rid(), date: new Date().toISOString(), actorId: nacho?.id || '', type: 'project-add', text: `entró un proyecto nuevo por onboarding: "${projectName}" (${company || 'cliente'})` }, ...(st.activity || [])].slice(0, 200),
    }
    const { error: upErr } = await supa.from('app_state').upsert({ id: 'main', data: next })
    if (upErr) throw upErr

    return json({ ok: true, projectName, pm: nacho?.name || null, dev: dev?.name || null })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
