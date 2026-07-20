// ============================================================================
// Vista pública del cliente — Supabase Edge Function (Deno)
// Deploy:  supabase functions deploy project-share
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los pone Supabase solo)
// Devuelve, dado {shareId, password}, SOLO la data pública de ese proyecto (lectura).
// La contraseña se valida server-side; nunca se expone el resto de los proyectos.
//
// Lee desde las tablas por-fila (projects / team_members / clients / calls / tasks),
// no del documento monolítico app_state (retirado). service_role → sin bloqueo de RLS.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const norm = (s: string) => (s === 'completado' ? 'terminado' : s === 'en progreso' ? 'en proceso' : (s || 'pendiente'))
const rows = (r: any) => (r.data || []).map((x: any) => x.data).filter(Boolean)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { shareId, password } = await req.json().catch(() => ({}))
    if (!shareId) return json({ error: 'Link inválido.' }, 400)

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Proyecto por shareId (tabla por-fila). Traemos los proyectos vivos y buscamos.
    const projectsRes = await supa.from('projects').select('data').is('deleted_at', null)
    const project: any = rows(projectsRes).find((p: any) => p.shareId === shareId)
    if (!project || !project.shareEnabled) return json({ error: 'Este link no está activo.' }, 404)
    if (!project.sharePassword || String(password || '') !== String(project.sharePassword)) return json({ error: 'Contraseña incorrecta.' }, 401)

    // Equipo, clientes y llamadas para enriquecer la vista.
    const [teamRes, clientsRes, callsRes, tasksRes] = await Promise.all([
      supa.from('team_members').select('data').is('deleted_at', null),
      supa.from('clients').select('data').is('deleted_at', null),
      supa.from('calls').select('data').is('deleted_at', null),
      supa.from('tasks').select('data').is('deleted_at', null),
    ])
    const team: any[] = rows(teamRes)
    const nameOf = (id: string) => (team.find((u) => u.id === id)?.name) || ''
    const clientName = rows(clientsRes).find((c: any) => c.id === project.clientId)?.company || ''

    const sprints: any[] = project.sprints || []
    const total = sprints.length
    const done = sprints.filter((s) => norm(s.status) === 'terminado').length
    const inProc = sprints.filter((s) => norm(s.status) === 'en proceso').length
    const progress = total ? Math.round(((done + inProc * 0.5) / total) * 100) : (project.progress || 0)
    const devId = project.assignments?.dev?.userId || null
    const outSprints = sprints.map((s) => ({
      id: s.id, name: s.name, week: s.week, status: norm(s.status), date: s.estimatedDate,
      assignees: ((s.assigneeIds && s.assigneeIds.length) ? s.assigneeIds : (devId ? [devId] : [])).map(nameOf).filter(Boolean),
    }))

    // registro: notas públicas + looms + llamadas (manuales asignadas al proyecto)
    const manual = (project.activity || [])
      .filter((a: any) => !(a.type === 'nota' && a.visibility === 'private'))
      .map((a: any) => ({ type: a.type, date: a.date, note: a.note || '', link: a.link || '', photos: a.photos || [], author: nameOf(a.authorId) }))
    const projCalls = rows(callsRes).filter((c: any) => c.projectId === project.id)
      .map((c: any) => ({ type: 'llamada', date: c.date, note: c.summary || '', link: c.fathomUrl || '', photos: [], author: c.advisor || '' }))
    const activity = [...manual, ...projCalls].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Tareas del equipo asignadas al proyecto (tabla por-fila `tasks`).
    const teamTasks = rows(tasksRes).filter((t: any) => t.projectId === project.id)
      .map((t: any) => ({ name: t.name, status: norm(t.status), assignee: nameOf(t.assigneeId) }))
    const clientTasks = (project.clientTasks || []).map((c: any) => ({ text: c.text, done: !!c.done }))

    return json({
      name: project.name, client: clientName, stack: project.stack || '',
      kpis: { total, done, inProc, progress },
      sprints: outSprints, activity, teamTasks, clientTasks,
    })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
