// ============================================================================
// MVP sync — Supabase Edge Function (Deno)
// Trae los repos del org de GitHub de ventas (insightsapps-mvp) y las demos de
// Render, y los deja como filas en `mvps`. Corre por pg_cron cada 15 min y desde
// el botón "Buscar nuevos" de la vista MVPs.
// Secrets: GITHUB_TOKEN_MVP, RENDER_API_KEY, MVP_CRON_KEY (+ los de Supabase).
// La escritura va por la RPC mvp_apply_sync: mergea solo los campos automáticos y
// nunca pisa lo que el equipo cargó a mano (projectId, notas, demo manual).
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ORG = Deno.env.get('MVP_GITHUB_ORG') || 'insightsapps-mvp'
const LEGACY_OWNER = 'developers-insights'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })

// Tiene que coincidir con mvpMatchScore() de src/lib/mvps.js.
const STOP = new Set(['demo', 'mvp', 'app', 'apps', 'insights', 'preview', 'navegable', 'previsualizacion', 'web', 'plataforma',
  'sistema', 'para', 'del', 'los', 'las', 'the', 'and', 'for', 'con', 'una', 'que', 'por', 'powered'])
const tokens = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length >= 3 && !STOP.has(t))
const hit = (t: string, pool: string[]) => pool.some((m) => m === t || (t.length >= 4 && m.length >= 4 && (m.startsWith(t) || t.startsWith(m))))
function matchScore(mvp: any, project: any, company: string) {
  if (project.githubRepo && mvp.fullName && String(project.githubRepo).toLowerCase() === mvp.fullName.toLowerCase()) return 1
  const pool = tokens(`${mvp.repo} ${mvp.title} ${mvp.description}`)
  const pt = tokens(project.name)
  if (!pt.length || !pool.length) return 0
  const p = pt.filter((t) => hit(t, pool)).length / pt.length
  const ct = tokens(company)
  const c = ct.length && ct.some((t) => hit(t, pool)) ? 1 : 0
  return Math.min(1, p * 0.85 + c * 0.15 + (p === 1 ? 0.15 : 0))
}

const prettyTitle = (repo: string) => repo
  .replace(/[-_](mvp|demo|app)([-_].*)?$/i, '').replace(/^(mvp|demo)[-_]/i, '')
  .split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || repo

async function gh(path: string, token: string, accept = 'application/vnd.github+json') {
  return fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept, 'User-Agent': 'insights-mvp-sync', 'X-GitHub-Api-Version': '2022-11-28' },
  })
}

async function listRepos(path: string, token: string) {
  const out: any[] = []
  for (let page = 1; page <= 10; page++) {
    const r = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, token)
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`)
    const items = await r.json()
    out.push(...items)
    if (items.length < 100) break
  }
  return out
}

async function renderServices(key: string) {
  const out: any[] = []
  let cursor = ''
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`https://api.render.com/v1/services?limit=100${cursor ? `&cursor=${cursor}` : ''}`, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } })
    if (!r.ok) break
    const items = await r.json()
    out.push(...items.map((x: any) => x.service))
    if (items.length < 100) break
    cursor = items[items.length - 1].cursor
  }
  return out
}

const repoKey = (url: string) => {
  const m = String(url || '').match(/github\.com\/([^/]+)\/([^/.#?]+)/i)
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : ''
}

// Las demos del org nuevo se publican desde otra cuenta de Render que no vemos por
// API: el nombre del servicio sale del render.yaml del repo y se confirma pidiendo la
// URL. Render contesta 404 + `x-render-routing: no-server` cuando el servicio no existe.
async function guessRenderDemo(fullName: string, token: string) {
  const r = await gh(`/repos/${fullName}/contents/render.yaml`, token, 'application/vnd.github.raw')
  if (!r.ok) return ''
  const yaml = await r.text()
  const m = yaml.match(/^\s*-?\s*name:\s*["']?([a-z0-9-]+)["']?\s*$/im)
  if (!m) return ''
  const url = `https://${m[1]}.onrender.com`
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(12000) })
    await res.body?.cancel()
    if (res.headers.get('x-render-routing') === 'no-server' || res.status >= 400) return ''
    return url
  } catch { return '' }
}

async function authorized(req: Request, admin: ReturnType<typeof createClient>) {
  const cronKey = Deno.env.get('MVP_CRON_KEY')
  if (cronKey && req.headers.get('x-cron-key') === cronKey) return true
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return false
  const { data } = await admin.auth.getUser(jwt)
  const email = String(data?.user?.email || '').toLowerCase()
  if (!email) return false
  const { data: rows } = await admin.from('team_members').select('data').is('deleted_at', null)
  const me = (rows || []).map((r: any) => r.data).find((m: any) => String(m?.email || '').toLowerCase() === email)
  return !!me && me.status !== 'pending' && me.access !== 'project'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    if (!(await authorized(req, admin))) return json({ error: 'No autorizado' })
    const token = Deno.env.get('GITHUB_TOKEN_MVP')
    if (!token) return json({ error: 'Falta el secret GITHUB_TOKEN_MVP' })
    const renderKey = Deno.env.get('RENDER_API_KEY') || ''

    const isDemoName = (n: string) => /(^|-)(demo|mvp)(-|$)/i.test(n)
    const [orgList, legacyList, services, existingRes, projectsRes, clientsRes] = await Promise.all([
      listRepos(`/orgs/${ORG}/repos?type=all&sort=created`, token),
      listRepos('/user/repos?affiliation=owner&sort=created', token).catch(() => []),
      renderKey ? renderServices(renderKey) : Promise.resolve([]),
      admin.from('mvps').select('id,data,deleted_at'),
      admin.from('projects').select('data').is('deleted_at', null),
      admin.from('clients').select('data').is('deleted_at', null),
    ])
    const existing = new Map<string, any>((existingRes.data || []).map((r: any) => [r.id, r]))
    const projects = (projectsRes.data || []).map((r: any) => r.data).filter((p: any) => p?.id && p?.name)
    const companyOf = new Map<string, string>((clientsRes.data || []).map((r: any) => [r.data?.id, `${r.data?.company || ''} ${r.data?.name || ''}`]))

    const renderByRepo = new Map<string, any>()
    for (const s of services) { const k = repoKey(s.repo); if (k && !renderByRepo.has(k)) renderByRepo.set(k, s) }

    const repos = [...orgList, ...legacyList.filter((r: any) => r.owner?.login?.toLowerCase() === LEGACY_OWNER && isDemoName(r.name))]
    const seen = new Set(repos.map((r: any) => String(r.full_name).toLowerCase()))
    const auto: any[] = []
    for (const r of repos) {
      const fullName = r.full_name as string
      const svc = renderByRepo.get(fullName.toLowerCase())
      auto.push({
        id: `mvp-${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        source: 'github', owner: r.owner.login, repo: r.name, fullName,
        title: prettyTitle(r.name), description: r.description || '',
        repoUrl: r.html_url, private: !!r.private,
        repoCreatedAt: r.created_at, pushedAt: r.pushed_at,
        demoUrl: svc?.serviceDetails?.url || r.homepage || (r.has_pages ? `https://${r.owner.login.toLowerCase()}.github.io/${r.name}/` : ''),
        demoSource: svc ? 'render' : r.homepage ? 'homepage' : r.has_pages ? 'pages' : '',
        demoSuspended: svc ? svc.suspended === 'suspended' : false,
      })
    }
    // Demos en Render cuyo repo no vimos por GitHub (borrado o de otra cuenta).
    for (const s of services) {
      const k = repoKey(s.repo)
      if (!k.startsWith(LEGACY_OWNER + '/') || seen.has(k)) continue
      const name = k.split('/')[1]
      if (!isDemoName(name)) continue
      auto.push({
        id: `mvp-${k.replace(/[^a-z0-9]+/g, '-')}`,
        source: 'render', owner: LEGACY_OWNER, repo: name, fullName: `${LEGACY_OWNER}/${name}`,
        title: prettyTitle(name), description: '',
        repoUrl: `https://github.com/${LEGACY_OWNER}/${name}`, private: true,
        repoCreatedAt: s.createdAt, pushedAt: s.updatedAt,
        demoUrl: s.serviceDetails?.url || '', demoSource: 'render', demoSuspended: s.suspended === 'suspended',
      })
    }

    const toGuess = auto.filter((m) => {
      if (m.demoUrl) return false
      const prev = existing.get(m.id)?.data
      if (prev?.demoSource === 'guess' && prev?.demoUrl) { m.demoUrl = prev.demoUrl; m.demoSource = 'guess'; return false }
      return m.source === 'github'
    })
    for (let i = 0; i < toGuess.length; i += 6) {
      await Promise.all(toGuess.slice(i, i + 6).map(async (m) => {
        const url = await guessRenderDemo(m.fullName, token)
        if (url) { m.demoUrl = url; m.demoSource = 'guess' }
      }))
    }

    const linkedProjects = new Set<string>()
    for (const r of existing.values()) if (!r.deleted_at && r.data?.projectId) linkedProjects.add(r.data.projectId)

    // Auto-vínculo solo si la coincidencia es única en los dos sentidos: un proyecto con
    // dos demos parecidas (ej. goreach-mvp y goreach-studio-mvp) lo decide una persona.
    const eligible = auto.filter((m) => {
      const prev = existing.get(m.id)
      return !prev?.deleted_at && !prev?.data?.projectId && !prev?.data?.autoLinkOff && prev?.data?.status !== 'descartado'
    })
    const freeProjects = projects.filter((p: any) => !linkedProjects.has(p.id))
    const strong = new Map<string, any[]>()
    const perProject = new Map<string, number>()
    for (const m of eligible) {
      const hits = freeProjects.filter((p: any) => matchScore(m, p, companyOf.get(p.clientId) || '') >= 0.99)
      strong.set(m.id, hits)
      for (const p of hits) perProject.set(p.id, (perProject.get(p.id) || 0) + 1)
    }

    const AUTO_KEYS = ['source', 'owner', 'repo', 'fullName', 'title', 'description', 'repoUrl', 'private', 'repoCreatedAt', 'pushedAt', 'demoUrl', 'demoSource', 'demoSuspended']
    const now = new Date().toISOString()
    const changed: any[] = []
    let created = 0, linked = 0
    for (const m of auto) {
      const row = existing.get(m.id)
      if (row?.deleted_at) continue
      const prev = row?.data || null
      const out: any = { ...m }
      const hits = strong.get(m.id) || []
      if (hits.length === 1 && perProject.get(hits[0].id) === 1 && !linkedProjects.has(hits[0].id)) {
        out.projectId = hits[0].id; out.linkedBy = 'auto'; out.linkedAt = now
        linkedProjects.add(hits[0].id); linked++
      }
      const autoChanged = !prev || AUTO_KEYS.some((k) => JSON.stringify(prev[k] ?? null) !== JSON.stringify(m[k] ?? null))
      if (!autoChanged && !out.projectId) continue
      if (!prev) { out.createdAt = now; out.status = 'activo'; created++ }
      out.updatedAt = now
      changed.push(out)
    }

    if (changed.length) {
      const { error } = await admin.rpc('mvp_apply_sync', { p_rows: changed })
      if (error) throw new Error(error.message)
    }
    return json({ ok: true, total: auto.length, created, updated: changed.length - created, linked, syncedAt: now })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) })
  }
})
