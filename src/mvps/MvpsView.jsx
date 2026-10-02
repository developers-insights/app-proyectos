import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, Modal, Field, stagger, rise } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { mvpDemoUrl, isNewMvp, suggestProjectsForMvp, suggestMvpsForProject } from '../lib/mvps.js'

const MVP_CSS = `
.mv-list{display:flex;flex-direction:column;gap:8px}
.mv-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px 18px;align-items:center;padding:14px 16px;
  border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);
  transition:box-shadow .24s var(--e),background .24s var(--e)}
.mv-row:hover{box-shadow:inset 0 0 0 1px var(--border-strong)}
.mv-row[data-off="1"]{opacity:.55}
.mv-hd{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.mv-tt{font-weight:650;font-size:15px;letter-spacing:-.02em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-new{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:999px;
  color:var(--accent);background:var(--accent-soft)}
.mv-ds{margin-top:4px;font-size:12.5px;line-height:1.5;color:var(--text-dim);display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden;max-width:760px}
.mv-mt{margin-top:7px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--text-faint)}
.mv-mt a{display:inline-flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;color:var(--text-dim)}
.mv-mt a:hover{color:var(--text)}
.mv-act{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.mv-demo{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;height:34px;padding:0 13px;border-radius:10px;font-size:13px;font-weight:600;
  color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:box-shadow .2s var(--e),transform .2s var(--e)}
.mv-demo:hover{box-shadow:inset 0 0 0 1px var(--accent-line)}
.mv-demo:active{transform:scale(.97)}
.mv-demo[data-off="1"]{color:var(--text-faint);background:transparent}
.mv-pj{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 6px 0 12px;border-radius:10px;font-size:13px;font-weight:600;
  max-width:260px;color:var(--text);background:color-mix(in srgb,var(--green) 10%,transparent);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 35%,transparent)}
.mv-pj .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.mv-pj .nm:hover{text-decoration:underline}
.mv-pj button{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;color:var(--text-faint);flex:none}
.mv-pj button:hover{color:var(--red);background:var(--red-soft)}
.mv-link{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;height:34px;padding:0 13px;border-radius:10px;font-size:13px;font-weight:600;
  color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line);transition:transform .2s var(--e)}
.mv-link:active{transform:scale(.97)}
.mv-auto{font-size:10.5px;color:var(--text-faint);font-weight:600}
.mv-pick{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:10px;font-size:13.5px}
.mv-pick:hover{background:var(--card-hover)}
.mv-pick .sc{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--green);flex:none}
.mv-pick .sub{font-size:11.5px;color:var(--text-faint)}
.mv-sync{font-size:12px;color:var(--text-faint)}
@media (max-width:720px){
  .mv-view{padding:20px 16px 48px !important}
  .mv-view .pj-seg{max-width:100%;overflow-x:auto;scrollbar-width:none}
  .mv-view .pj-seg::-webkit-scrollbar{display:none}
  .mv-view .pj-bar .pj-search{max-width:none;flex-basis:100%}
  .mv-row{grid-template-columns:1fr}
  .mv-act{justify-content:flex-start}
  .mv-act .mv-demo,.mv-act .mv-link{flex:1;justify-content:center}
}
`

const NO_DEMO = {
  'no-publicada': { label: 'No publicada', hint: 'El repo está listo para Render pero la demo nunca se subió (o la borraron). Si la publicaron en otro lado, cargá el link.' },
  'sin-config': { label: 'Sin deploy', hint: 'El repo no tiene configuración de deploy ni link en el README. Si la demo existe, cargá el link.' },
  default: { label: 'Sin demo · cargar', hint: 'No encontramos la demo publicada: cargá el link a mano.' },
}

const ago = (iso) => {
  if (!iso) return ''
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  const m = Math.floor(d / 30)
  return m < 12 ? `hace ${m} ${m === 1 ? 'mes' : 'meses'}` : `hace ${Math.floor(m / 12)} año${m >= 24 ? 's' : ''}`
}

function useMvpActions() {
  const { mvpStore, logActivity, data } = useApp()
  const now = () => new Date().toISOString()
  const projectName = (id) => (data.projects.find((p) => p.id === id) || {}).name || 'un proyecto'
  return {
    link: (m, projectId) => {
      mvpStore.patch(m.id, (x) => ({ ...x, projectId, linkedBy: 'manual', linkedAt: now(), updatedAt: now() }))
      if (logActivity) logActivity({ type: 'mvp-link', text: `vinculó el MVP ${m.title} a ${projectName(projectId)}` })
    },
    unlink: (m) => mvpStore.patch(m.id, (x) => ({ ...x, projectId: '', linkedBy: '', linkedAt: '', autoLinkOff: true, updatedAt: now() })),
    setStatus: (m, status) => mvpStore.patch(m.id, (x) => ({ ...x, status, updatedAt: now() })),
    save: (m, fields) => mvpStore.patch(m.id, (x) => ({ ...x, ...fields, updatedAt: now() })),
  }
}

function LinkProjectModal({ mvp, onClose, onPick }) {
  const { data } = useApp()
  const [q, setQ] = useState('')
  const sugg = useMemo(() => suggestProjectsForMvp(mvp, data.projects, data.clients), [mvp, data.projects, data.clients])
  const company = (id) => (data.clients.find((c) => c.id === id) || {}).company || ''
  const query = q.trim().toLowerCase()
  const all = data.projects
    .filter((p) => !query || `${p.name} ${company(p.clientId)}`.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <Modal open onClose={onClose} title="Vincular a un proyecto" sub={mvp.title} width={480}>
      {sugg.length > 0 && !query && (
        <div style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 6 }}>Parecidos por nombre</div>
          {sugg.map(({ project: p, score }) => (
            <button key={p.id} className="mv-pick" onClick={() => onPick(p.id)}>
              <I2.folder width={15} height={15} style={{ color: 'var(--text-faint)', flex: 'none' }} />
              <span style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{p.name}</div>{company(p.clientId) && <div className="sub">{company(p.clientId)}</div>}</span>
              <span className="sc">{Math.round(score * 100)}%</span>
            </button>
          ))}
        </div>
      )}
      <label className="pj-search" style={{ width: '100%', maxWidth: 'none', marginBottom: 8 }}>
        <I2.search width={15} height={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proyecto o cliente…" aria-label="Buscar proyecto" />
      </label>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {all.map((p) => (
          <button key={p.id} className="mv-pick" onClick={() => onPick(p.id)}>
            <span style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{p.name}</div>{company(p.clientId) && <div className="sub">{company(p.clientId)}</div>}</span>
          </button>
        ))}
        {all.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--text-faint)' }}>Ningún proyecto coincide.</div>}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
        ¿El proyecto todavía no existe? Dejalo sin vincular: cuando se cree, se asocia solo si el nombre coincide, o lo vinculás desde el proyecto.
      </div>
    </Modal>
  )
}

function EditMvpModal({ mvp, onClose, onSave }) {
  const [demo, setDemo] = useState(mvp.demoUrlManual || '')
  const [notes, setNotes] = useState(mvp.notes || '')
  return (
    <Modal open onClose={onClose} title="Editar MVP" sub={mvp.fullName} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={mvp.demoUrl ? `Link de la demo (detectado: ${mvp.demoUrl})` : 'Link de la demo'}>
          <input className="input mono" value={demo} onChange={(e) => setDemo(e.target.value)} placeholder={mvp.demoUrl || 'https://…'} style={{ fontSize: 13 }} />
        </Field>
        <Field label="Notas"><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Para quién es, quién la armó, qué falta…" style={{ resize: 'none' }} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => onSave({ demoUrlManual: demo.trim(), notes: notes.trim() })}><I2.check width={15} height={15} /> Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

function MvpRow({ m, project, onOpenProject, onLink, onUnlink, onEdit, onStatus }) {
  const demo = mvpDemoUrl(m)
  const off = m.status === 'descartado'
  return (
    <motion.div variants={rise} className="mv-row" data-off={off ? '1' : '0'}>
      <div style={{ minWidth: 0 }}>
        <div className="mv-hd">
          <span className="mv-tt" title={m.title}>{m.title}</span>
          {isNewMvp(m) && <span className="mv-new">Nuevo</span>}
          {m.demoSuspended && !m.demoUrlManual && <span className="tag" style={{ fontSize: 10.5, color: 'var(--yellow)', borderColor: 'var(--border)' }}
            title="La demo existe pero alguien la pausó en Render: el link abre una página de servicio suspendido hasta que la reactiven">Pausada en Render</span>}
        </div>
        {(m.description || m.notes) && <div className="mv-ds">{m.notes || m.description}</div>}
        <div className="mv-mt">
          <a href={m.repoUrl} target="_blank" rel="noreferrer" title="Abrir el repo en GitHub"><I2.github width={12} height={12} />{m.fullName}</a>
          <span>creado {ago(m.repoCreatedAt)}</span>
        </div>
      </div>
      <div className="mv-act">
        {demo
          ? <a className="mv-demo" href={demo} target="_blank" rel="noreferrer" title={demo}><I2.ext width={14} height={14} /> Ver demo</a>
          : <button className="mv-demo" data-off="1" onClick={onEdit} title={NO_DEMO[m.demoState]?.hint || NO_DEMO.default.hint}>{NO_DEMO[m.demoState]?.label || NO_DEMO.default.label}</button>}
        {project ? (
          <span className="mv-pj" title={m.linkedBy === 'auto' ? 'Vinculado solo por coincidencia de nombre' : 'Proyecto vinculado'}>
            <I2.folder width={14} height={14} style={{ flex: 'none', color: 'var(--green)' }} />
            <span className="nm" onClick={() => onOpenProject(project.id)}>{project.name}</span>
            {m.linkedBy === 'auto' && <span className="mv-auto">auto</span>}
            <button onClick={onUnlink} aria-label={`Desvincular de ${project.name}`} title="Desvincular"><I2.x width={12} height={12} /></button>
          </span>
        ) : !off && (
          <button className="mv-link" onClick={onLink}><I2.link width={14} height={14} /> Vincular</button>
        )}
        <button className="pj-ib" onClick={onEdit} title="Editar demo y notas" aria-label="Editar"><I2.pencil width={14} height={14} /></button>
        <button className="pj-ib" onClick={() => onStatus(off ? 'activo' : 'descartado')}
          title={off ? 'Volver a la lista' : 'Descartar (no se cerró, era una prueba…)'} aria-label={off ? 'Restaurar' : 'Descartar'}>
          {off ? <I2.refresh width={14} height={14} /> : <I2.trash width={14} height={14} />}
        </button>
      </div>
    </motion.div>
  )
}

const TABS = [
  { key: 'open', label: 'Sin vincular' },
  { key: 'linked', label: 'Vinculados' },
  { key: 'all', label: 'Todos' },
  { key: 'off', label: 'Descartados' },
]

export default function MvpsView({ onOpenProject }) {
  const { data, mvpStore, supabase } = useApp()
  const actions = useMvpActions()
  const mvps = data.mvps || []
  const [tab, setTab] = useState('open')
  const [q, setQ] = useState('')
  const [linkFor, setLinkFor] = useState(null)
  const [editFor, setEditFor] = useState(null)
  const [sync, setSync] = useState({ busy: false, msg: '' })
  const projectOf = (id) => (id ? data.projects.find((p) => p.id === id) || null : null)

  const inTab = (m) => {
    if (tab === 'off') return m.status === 'descartado'
    if (m.status === 'descartado') return false
    if (tab === 'open') return !m.projectId
    if (tab === 'linked') return !!m.projectId
    return true
  }
  const counts = useMemo(() => {
    const c = { open: 0, linked: 0, all: 0, off: 0 }
    for (const m of mvps) {
      if (m.status === 'descartado') { c.off++; continue }
      c.all++
      if (m.projectId) c.linked++; else c.open++
    }
    return c
  }, [mvps])
  const query = q.trim().toLowerCase()
  const list = mvps
    .filter(inTab)
    .filter((m) => !query || `${m.title} ${m.fullName} ${m.description} ${m.notes} ${projectOf(m.projectId)?.name || ''}`.toLowerCase().includes(query))
    .sort((a, b) => (b.repoCreatedAt || '').localeCompare(a.repoCreatedAt || ''))

  const runSync = async () => {
    setSync({ busy: true, msg: '' })
    try {
      const { data: res, error } = await supabase.functions.invoke('mvp-sync', { body: { action: 'sync' } })
      if (error || res?.error) throw new Error(res?.error || error.message)
      const bits = []
      if (res.created) bits.push(`${res.created} nuevo${res.created > 1 ? 's' : ''}`)
      if (res.linked) bits.push(`${res.linked} vinculado${res.linked > 1 ? 's' : ''} solo${res.linked > 1 ? 's' : ''}`)
      setSync({ busy: false, msg: bits.length ? bits.join(' · ') : 'Ya estaba todo al día' })
    } catch (e) {
      setSync({ busy: false, msg: 'No se pudo sincronizar. Probá de nuevo en un rato.' })
    }
  }

  const loading = mvpStore && mvpStore.ready === false && mvps.length === 0

  return (
    <div className="view mv-view" style={{ padding: '28px 34px 60px' }}>
      <style>{MVP_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 6 }}>Ventas</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>MVPs</h1>
          <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--text-dim)', maxWidth: 620, lineHeight: 1.55 }}>
            Cada demo que ventas sube a GitHub aparece acá sola, con su link. Vinculala al proyecto cuando el cliente cierra.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {sync.msg && <span className="mv-sync" role="status">{sync.msg}</span>}
          <button className="btn" onClick={runSync} disabled={sync.busy}>
            <I2.refresh width={14} height={14} style={sync.busy ? { animation: 'spin 1s linear infinite' } : undefined} />
            {sync.busy ? 'Buscando…' : 'Buscar nuevos'}
          </button>
        </div>
      </div>

      <div className="pj-bar">
        <div className="pj-seg" role="tablist" aria-label="Filtrar MVPs">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label} <span className="n">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <label className="pj-search">
          <I2.search width={15} height={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar MVP" placeholder="Buscar demo, repo o proyecto…" />
          {q && <button onClick={() => setQ('')} title="Limpiar búsqueda" style={{ display: 'flex', padding: 2, color: 'var(--text-faint)' }}><I2.x width={14} height={14} /></button>}
        </label>
      </div>

      {loading && <div className="mv-list" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="pj-skel" style={{ height: 92 }} />)}</div>}

      {!loading && list.length === 0 && (
        <div className="pj-empty">
          <span className="ic"><I2.rocket width={22} height={22} /></span>
          <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-.02em' }}>
            {query ? 'Nada coincide con la búsqueda' : tab === 'open' ? 'No hay demos sin vincular' : tab === 'off' ? 'No hay demos descartadas' : 'Todavía no hay demos'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', maxWidth: 380, lineHeight: 1.5, textAlign: 'center' }}>
            {query ? 'Probá con otro nombre o mirá en otra pestaña.' : 'Se revisa GitHub cada 15 minutos. Si acabás de subir una, tocá "Buscar nuevos".'}
          </div>
        </div>
      )}

      {!loading && list.length > 0 && (
        <motion.div className="mv-list" variants={stagger} initial="hidden" animate="show" key={tab}>
          {list.map((m) => (
            <MvpRow key={m.id} m={m} project={projectOf(m.projectId)} onOpenProject={onOpenProject}
              onLink={() => setLinkFor(m)} onUnlink={() => actions.unlink(m)} onEdit={() => setEditFor(m)}
              onStatus={(s) => actions.setStatus(m, s)} />
          ))}
        </motion.div>
      )}

      {linkFor && <LinkProjectModal mvp={linkFor} onClose={() => setLinkFor(null)} onPick={(pid) => { actions.link(linkFor, pid); setLinkFor(null) }} />}
      {editFor && <EditMvpModal mvp={editFor} onClose={() => setEditFor(null)} onSave={(f) => { actions.save(editFor, f); setEditFor(null) }} />}
    </div>
  )
}

export function projectMvps(project, mvps) {
  return (mvps || []).filter((m) => m.projectId === project.id && m.status !== 'descartado')
}

export function ProjectMvpModal({ open, project, onClose }) {
  const { data } = useApp()
  const actions = useMvpActions()
  const [q, setQ] = useState('')
  if (!open || !project) return null
  const mvps = data.mvps || []
  const linked = projectMvps(project, mvps)
  const sugg = suggestMvpsForProject(project, mvps, data.clients)
  const query = q.trim().toLowerCase()
  const pool = query
    ? mvps.filter((m) => !m.projectId && m.status !== 'descartado' && `${m.title} ${m.fullName} ${m.description}`.toLowerCase().includes(query)).slice(0, 30)
    : []
  const Pick = ({ m, score }) => (
    <button className="mv-pick" onClick={() => { actions.link(m, project.id); setQ('') }}>
      <I2.rocket width={15} height={15} style={{ color: 'var(--text-faint)', flex: 'none' }} />
      <span style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{m.title}</div><div className="sub">{m.fullName}</div></span>
      {score != null && <span className="sc">{Math.round(score * 100)}%</span>}
    </button>
  )
  return (
    <Modal open onClose={onClose} title="MVP / demo" sub={project.name} width={520}>
      <style>{MVP_CSS}</style>
      {linked.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {linked.map((m) => {
            const demo = mvpDemoUrl(m)
            return (
              <div key={m.id} className="surface" style={{ padding: 14, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mv-tt" style={{ flex: 1 }}>{m.title}</span>
                  {m.linkedBy === 'auto' && <span className="mv-auto">vinculado solo</span>}
                  <button className="pj-ib" onClick={() => actions.unlink(m)} title="Desvincular" aria-label="Desvincular"><I2.x width={14} height={14} /></button>
                </div>
                <div className="mv-mt" style={{ marginTop: 8 }}>
                  <a href={m.repoUrl} target="_blank" rel="noreferrer"><I2.github width={12} height={12} />{m.fullName}</a>
                  {demo ? <a href={demo} target="_blank" rel="noreferrer"><I2.ext width={12} height={12} />{demo.replace(/^https?:\/\//, '')}</a> : <span>sin link de demo</span>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5 }}>Este proyecto todavía no tiene la demo de ventas vinculada.</div>
      )}
      {sugg.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>Puede ser alguna de estas</div>
          {sugg.map(({ mvp, score }) => <Pick key={mvp.id} m={mvp} score={score} />)}
        </div>
      )}
      <label className="pj-search" style={{ width: '100%', maxWidth: 'none' }}>
        <I2.search width={15} height={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar otra demo por nombre o repo…" aria-label="Buscar demo" />
      </label>
      {query && (
        <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 6 }}>
          {pool.map((m) => <Pick key={m.id} m={m} />)}
          {pool.length === 0 && <div style={{ padding: 12, fontSize: 13, color: 'var(--text-faint)' }}>No hay demos sin vincular con ese nombre.</div>}
        </div>
      )}
    </Modal>
  )
}
