// Tiene que coincidir con matchScore() de supabase/functions/mvp-sync/index.ts:
// el server auto-vincula con score >= 0.99 y acá se usan los mismos números para sugerir.
const STOP = new Set(['demo', 'mvp', 'app', 'apps', 'insights', 'preview', 'navegable', 'previsualizacion', 'web', 'plataforma',
  'sistema', 'para', 'del', 'los', 'las', 'the', 'and', 'for', 'con', 'una', 'que', 'por', 'powered'])

const tokens = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length >= 3 && !STOP.has(t))
const hit = (t, pool) => pool.some((m) => m === t || (t.length >= 4 && m.length >= 4 && (m.startsWith(t) || t.startsWith(m))))

export function mvpMatchScore(mvp, project, company = '') {
  if (project.githubRepo && mvp.fullName && String(project.githubRepo).toLowerCase() === mvp.fullName.toLowerCase()) return 1
  const pool = tokens(`${mvp.repo} ${mvp.title} ${mvp.description}`)
  const pt = tokens(project.name)
  if (!pt.length || !pool.length) return 0
  const p = pt.filter((t) => hit(t, pool)).length / pt.length
  const ct = tokens(company)
  const c = ct.length && ct.some((t) => hit(t, pool)) ? 1 : 0
  return Math.min(1, p * 0.85 + c * 0.15 + (p === 1 ? 0.15 : 0))
}

export const normalizeMvp = (m) => ({
  ...m,
  title: m.title || m.repo || 'MVP',
  description: m.description || '',
  status: m.status || 'activo',
  projectId: m.projectId || '',
  notes: m.notes || '',
  demoUrlManual: m.demoUrlManual || '',
})

export const mvpDemoUrl = (m) => (m && (m.demoUrlManual || m.demoUrl)) || ''

export const isNewMvp = (m, days = 7) =>
  m.status !== 'descartado' && !m.projectId && !!m.repoCreatedAt &&
  Date.now() - new Date(m.repoCreatedAt).getTime() < days * 86400000

export function suggestProjectsForMvp(mvp, projects, clients, limit = 3) {
  const companyOf = (id) => { const c = clients.find((x) => x.id === id); return c ? `${c.company || ''} ${c.name || ''}` : '' }
  return projects
    .map((p) => ({ project: p, score: mvpMatchScore(mvp, p, companyOf(p.clientId)) }))
    .filter((x) => x.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function suggestMvpsForProject(project, mvps, clients, limit = 3) {
  const c = clients.find((x) => x.id === project.clientId)
  const company = c ? `${c.company || ''} ${c.name || ''}` : ''
  return mvps
    .filter((m) => !m.projectId && m.status !== 'descartado')
    .map((m) => ({ mvp: m, score: mvpMatchScore(m, project, company) }))
    .filter((x) => x.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
