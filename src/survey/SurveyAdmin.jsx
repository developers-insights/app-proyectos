import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp, Modal } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { projectStage } from '../lib/stages.js'
import { BLOCKS } from './questions.js'
import { aggregate, surveyStatus, surveyLink, inviteMessage, isAnswered, otherKey, OTHER, visibleQuestions, npsScore } from './model.js'

/* client_surveys no está en la publicación de realtime: se lee al entrar, al volver a la
   pestaña y con el botón. La copia en localStorage es sólo para pintar al instante. */
const CACHE = 'rc_client_surveys_v1'
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || '[]') } catch (e) { return [] } }
const writeCache = (rows) => { try { localStorage.setItem(CACHE, JSON.stringify(rows)) } catch (e) { /* lleno */ } }

function newToken() {
  const b = new Uint8Array(18)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_')
}

const STATUS = {
  none: { label: 'Sin link', tone: 'mute' },
  sent: { label: 'Sin abrir', tone: 'mute' },
  opened: { label: 'La abrió', tone: 'yellow' },
  progress: { label: 'A medias', tone: 'yellow' },
  done: { label: 'Completa', tone: 'green' },
}
const ORDER = { progress: 0, opened: 1, sent: 2, none: 3, done: 4 }

const CSS = `
.sq-view{padding:28px 34px 60px;max-width:1180px}
@media(max-width:720px){.sq-view{padding:20px 16px 48px}}
.sq-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.sq-head p{margin:8px 0 0;font-size:13.5px;color:var(--text-dim);max-width:560px;line-height:1.55}
.sq-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}
@media(max-width:720px){.sq-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
.sq-stat{padding:14px 16px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.sq-stat .v{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:24px;font-weight:600;letter-spacing:-.03em}
.sq-stat .v small{font-size:13px;color:var(--text-faint);font-weight:500;margin-left:4px}
.sq-stat .k{margin-top:2px;font-size:12px;color:var(--text-dim)}
.sq-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);margin-bottom:14px}
.sq-tab{height:32px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:600;color:var(--text-dim);transition:background .2s,color .2s}
.sq-tab[aria-selected="true"]{background:var(--card-hover);color:var(--text);box-shadow:inset 0 0 0 1px var(--border-strong)}
.sq-list{display:flex;flex-direction:column;gap:8px}
.sq-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 18px;align-items:center;padding:14px 16px;border-radius:16px;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border);transition:box-shadow .2s}
.sq-row:hover{box-shadow:inset 0 0 0 1px var(--border-strong)}
@media(max-width:720px){.sq-row{grid-template-columns:1fr}}
.sq-nm{font-weight:650;font-size:15px;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sq-sub{margin-top:3px;font-size:12.5px;color:var(--text-dim);display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.sq-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:650;
  color:var(--text-dim);box-shadow:inset 0 0 0 1px var(--border-strong)}
.sq-pill::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.8}
.sq-pill[data-t="green"]{color:var(--green);box-shadow:inset 0 0 0 1px var(--green-line);background:var(--green-soft)}
.sq-pill[data-t="yellow"]{color:var(--yellow);box-shadow:inset 0 0 0 1px var(--yellow-line);background:var(--yellow-soft)}
.sq-act{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap}
@media(max-width:720px){.sq-act{justify-content:flex-start}}
.sq-lang{display:inline-flex;padding:3px;border-radius:9px;box-shadow:inset 0 0 0 1px var(--border)}
.sq-lang button{height:26px;padding:0 9px;border-radius:7px;font-size:11.5px;font-weight:700;color:var(--text-faint)}
.sq-lang button[aria-pressed="true"]{background:var(--card-hover);color:var(--text)}
.sq-empty{padding:40px 16px;text-align:center;color:var(--text-dim);font-size:13.5px}
.sq-blk{margin:26px 0 10px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)}
.sq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px}
@media(max-width:720px){.sq-grid{grid-template-columns:1fr}}
.sq-card{padding:16px 18px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);min-width:0}
.sq-card h3{font-size:14.5px;line-height:1.35;letter-spacing:-.015em;font-weight:650}
.sq-card .n{margin-top:4px;font-size:12px;color:var(--text-faint)}
.sq-bars{display:flex;flex-direction:column;gap:9px;margin-top:14px}
.sq-bar{display:grid;grid-template-columns:minmax(0,1fr) 64px;gap:4px 10px;align-items:center;font-size:12.5px}
.sq-bar .l{color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sq-bar .c{text-align:right;font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--text-dim)}
.sq-bar .t{grid-column:1/-1;height:6px;border-radius:99px;background:var(--track);overflow:hidden}
.sq-bar .t i{display:block;height:100%;border-radius:inherit;background:var(--accent)}
.sq-bar[data-top="1"] .l{color:var(--text)}
.sq-hist{display:flex;align-items:flex-end;gap:4px;height:64px;margin-top:14px}
.sq-hist div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
.sq-hist i{width:100%;border-radius:4px 4px 2px 2px;background:var(--accent);min-height:2px;opacity:.9}
.sq-hist span{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-faint)}
.sq-big{display:flex;align-items:baseline;gap:8px;margin-top:10px}
.sq-big b{font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:600;letter-spacing:-.03em}
.sq-big span{font-size:12px;color:var(--text-dim)}
.sq-texts{display:flex;flex-direction:column;gap:8px;margin-top:12px;max-height:320px;overflow:auto}
.sq-quote{padding:10px 12px;border-radius:12px;background:var(--bg-elevated);font-size:13px;line-height:1.5;color:var(--text)}
.sq-quote cite{display:block;margin-top:4px;font-style:normal;font-size:11.5px;color:var(--text-faint)}
.sq-ans{display:flex;flex-direction:column;gap:16px}
.sq-ans dt{font-size:12.5px;color:var(--text-dim);line-height:1.45}
.sq-ans dd{margin:5px 0 0;font-size:14px;line-height:1.5;white-space:pre-wrap}
.sq-ans dd[data-empty="1"]{color:var(--text-faint)}
`

function optionLabel(q, id) {
  if (id === OTHER) return 'Otra'
  return (q.options || []).find((o) => o.id === id)?.es || id
}

function answerText(q, answers) {
  if (!isAnswered(q, answers)) return null
  const v = answers[q.id]
  const other = answers[otherKey(q)]
  if (q.type === 'text') return v.trim()
  if (q.type === 'scale') return `${v} de ${q.max}`
  const picks = Array.isArray(v) ? v : [v]
  return picks.map((p) => (p === OTHER && other ? `Otra: ${other}` : optionLabel(q, p))).join(' · ')
}

function AnswersModal({ row, title, onClose }) {
  const answers = row?.answers || {}
  return (
    <Modal open={!!row} onClose={onClose} title={title} sub={row ? `${STATUS[surveyStatus(row)].label} · ${row.lang === 'en' ? 'en inglés' : 'en español'}` : ''} width={620}>
      {row && (
        <dl className="sq-ans">
          {visibleQuestions(answers).map((q) => {
            const txt = answerText(q, answers)
            return (
              <div key={q.id}>
                <dt>{q.es.q}</dt>
                <dd data-empty={txt ? '0' : '1'}>{txt || 'Sin responder'}</dd>
              </div>
            )
          })}
        </dl>
      )}
    </Modal>
  )
}

function Summary({ rows, labelOf }) {
  const agg = useMemo(() => aggregate(rows.map((r) => ({ answers: r.answers || {}, label: labelOf(r.project_id) }))), [rows, labelOf])
  if (!rows.length) return <div className="sq-empty">Todavía no respondió nadie. Cuando alguien conteste, acá aparece el resumen de cada pregunta.</div>
  return BLOCKS.map((b) => (
    <section key={b.id}>
      <h2 className="sq-blk">{b.es}</h2>
      <div className="sq-grid">
        {agg.filter((a) => a.block === b.id).map((a) => (
          <article key={a.id} className="sq-card">
            <h3>{a.q}</h3>
            <div className="n">{a.n === 1 ? '1 respuesta' : `${a.n} respuestas`}{a.max && a.type === 'multi' ? ` · hasta ${a.max} por persona` : ''}</div>
            {a.options && (
              <div className="sq-bars">
                {a.options.filter((o) => o.count > 0 || a.n === 0).map((o, i) => (
                  <div key={o.id} className="sq-bar" data-top={i === 0 && o.count > 0 ? '1' : '0'}>
                    <span className="l" title={o.label}>{o.label}</span>
                    <span className="c">{o.count} · {Math.round(o.pct * 100)}%</span>
                    <span className="t"><i style={{ width: `${o.pct * 100}%` }} /></span>
                  </div>
                ))}
              </div>
            )}
            {a.others?.length > 0 && (
              <div className="sq-texts">{a.others.map((t, i) => <div key={i} className="sq-quote">“{t.text}”<cite>{t.label}</cite></div>)}</div>
            )}
            {a.dist && (
              <>
                <div className="sq-big">
                  <b>{a.id === 'nps' ? (a.nps ?? '–') : a.avg != null ? a.avg.toFixed(1) : '–'}</b>
                  <span>{a.id === 'nps' ? 'NPS (de −100 a 100)' : `promedio de ${a.dist[a.dist.length - 1].value}`}</span>
                </div>
                <div className="sq-hist" aria-hidden="true">
                  {a.dist.map((d) => {
                    const top = Math.max(1, ...a.dist.map((x) => x.count))
                    return <div key={d.value}><i style={{ height: `${(d.count / top) * 100}%` }} title={`${d.count}`} /><span>{d.value}</span></div>
                  })}
                </div>
              </>
            )}
            {a.texts && (a.texts.length
              ? <div className="sq-texts">{a.texts.map((t, i) => <div key={i} className="sq-quote">“{t.text}”<cite>{t.label}</cite></div>)}</div>
              : <div className="n" style={{ marginTop: 12 }}>Nadie escribió todavía.</div>)}
          </article>
        ))}
      </div>
    </section>
  ))
}

export default function SurveyAdmin() {
  const { data, supabase, myId } = useApp()
  const [rows, setRows] = useState(readCache)
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('clientes')
  const [langFor, setLangFor] = useState({})
  const [copied, setCopied] = useState('')
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) { setLoaded(true); return }
    const { data: res, error } = await supabase.from('client_surveys').select('*')
    if (error) { setErr('No se pudieron leer las encuestas. Probá de nuevo en un rato.'); setLoaded(true); return }
    setErr('')
    setRows(res || [])
    writeCache(res || [])
    setLoaded(true)
  }, [supabase])

  useEffect(() => {
    load()
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const clientOf = useCallback((p) => (data.clients || []).find((c) => c.id === p?.clientId) || null, [data.clients])
  const projects = useMemo(() => (data.projects || []).filter((p) => projectStage(p) !== 'cancelado'), [data.projects])
  const byProject = useMemo(() => new Map(rows.map((r) => [r.project_id, r])), [rows])
  const labelOf = useCallback((pid) => {
    const p = (data.projects || []).find((x) => x.id === pid)
    const c = clientOf(p)
    return [c?.name, p?.name].filter(Boolean).join(' · ') || pid
  }, [data.projects, clientOf])

  const list = useMemo(() => projects
    .map((p) => ({ p, c: clientOf(p), row: byProject.get(p.id) || null }))
    .sort((a, b) => (ORDER[surveyStatus(a.row)] - ORDER[surveyStatus(b.row)]) || (a.p.name || '').localeCompare(b.p.name || '')),
  [projects, byProject, clientOf])

  const answeredRows = useMemo(() => rows.filter((r) => (r.answered || 0) > 0 || r.completed_at), [rows])
  const done = rows.filter((r) => r.completed_at).length
  const half = rows.filter((r) => !r.completed_at && (r.answered || 0) > 0).length
  const unopened = list.filter((x) => { const s = surveyStatus(x.row); return s === 'none' || s === 'sent' }).length
  const nps = npsScore(answeredRows.map((r) => r.answers?.nps).filter((v) => typeof v === 'number'))

  const flash = (key) => { setCopied(key); setTimeout(() => setCopied((k) => (k === key ? '' : k)), 1600) }
  const copy = async (text, key) => { try { await navigator.clipboard.writeText(text) } catch (e) { /* sin permiso */ } flash(key) }
  const linkOf = (row) => surveyLink(window.location.origin, row.token)

  const create = async (p, c) => {
    const lang = langFor[p.id] || 'es'
    const me = (data.team || []).find((u) => u.id === myId)
    const row = { project_id: p.id, token: newToken(), lang, answers: {}, answered: 0, created_by: me?.name || me?.email || null }
    setRows((prev) => [...prev, { ...row, created_at: new Date().toISOString() }])
    copy(inviteMessage({ lang, contact: c?.name, link: linkOf(row) }), `msg-${p.id}`)
    const { error } = await supabase.from('client_surveys').insert(row)
    if (error) {
      setRows((prev) => prev.filter((r) => r.token !== row.token))
      setErr('No se pudo crear el link. Probá de nuevo.')
      return
    }
    load()
  }

  return (
    <div className="view sq-view">
      <style>{CSS}</style>
      <div className="sq-head">
        <div style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 6 }}>Marketing</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Encuesta a clientes</h1>
          <p>Creá el link de cada cliente y mandáselo por privado: al crearlo ya queda copiado el mensaje listo para pegar. Acá ves quién la completó y el resumen de todas las respuestas.</p>
        </div>
        <button className="btn btn-sm" onClick={load}><I2.refresh width={14} height={14} /> Actualizar</button>
      </div>

      <div className="sq-stats">
        <div className="sq-stat"><div className="v">{done}<small>/ {list.length}</small></div><div className="k">Completas</div></div>
        <div className="sq-stat"><div className="v">{half}</div><div className="k">A medias</div></div>
        <div className="sq-stat"><div className="v">{unopened}</div><div className="k">Sin abrir o sin link</div></div>
        <div className="sq-stat"><div className="v">{nps ?? '–'}</div><div className="k">NPS</div></div>
      </div>

      {err && <div className="sq-sub" role="alert" style={{ color: 'var(--red)', marginBottom: 12 }}>{err}</div>}

      <div className="sq-tabs" role="tablist">
        <button className="sq-tab" role="tab" aria-selected={tab === 'clientes'} onClick={() => setTab('clientes')}>Por cliente</button>
        <button className="sq-tab" role="tab" aria-selected={tab === 'resumen'} onClick={() => setTab('resumen')}>Resumen {answeredRows.length ? `· ${answeredRows.length}` : ''}</button>
      </div>

      {tab === 'resumen' ? <Summary rows={answeredRows} labelOf={labelOf} /> : (
        <div className="sq-list">
          {!loaded && !rows.length && <div className="sq-empty">Cargando encuestas…</div>}
          {list.map(({ p, c, row }) => {
            const st = surveyStatus(row)
            const lang = row?.lang || langFor[p.id] || 'es'
            return (
              <div key={p.id} className="sq-row">
                <div style={{ minWidth: 0 }}>
                  <div className="sq-nm">{p.name}</div>
                  <div className="sq-sub">
                    <span className="sq-pill" data-t={STATUS[st].tone}>{STATUS[st].label}</span>
                    {c?.name && <span>{c.name}</span>}
                    {row && st !== 'done' && row.answered > 0 && <span>{row.answered} de {visibleQuestions(row.answers || {}).length} respondidas</span>}
                    {row && <span>{lang === 'en' ? 'Inglés' : 'Español'}</span>}
                  </div>
                </div>
                <div className="sq-act">
                  {!row ? (
                    <>
                      <div className="sq-lang" role="group" aria-label="Idioma de la encuesta">
                        {['es', 'en'].map((l) => (
                          <button key={l} aria-pressed={lang === l} onClick={() => setLangFor((m) => ({ ...m, [p.id]: l }))}>{l.toUpperCase()}</button>
                        ))}
                      </div>
                      <button className="btn btn-sm btn-accent" onClick={() => create(p, c)} disabled={!supabase}>
                        {copied === `msg-${p.id}` ? <><I2.check width={14} height={14} /> Mensaje copiado</> : <><I2.plus width={14} height={14} /> Crear link</>}
                      </button>
                    </>
                  ) : (
                    <>
                      {st !== 'done' && (
                        <button className="btn btn-sm btn-accent" onClick={() => copy(inviteMessage({ lang: row.lang, contact: c?.name, link: linkOf(row) }), `msg-${p.id}`)}>
                          {copied === `msg-${p.id}` ? <><I2.check width={14} height={14} /> Copiado</> : <><I2.whatsapp width={14} height={14} /> Copiar mensaje</>}
                        </button>
                      )}
                      <button className="btn btn-sm" onClick={() => copy(linkOf(row), `link-${p.id}`)} aria-label="Copiar link">
                        {copied === `link-${p.id}` ? <I2.check width={14} height={14} /> : <I2.link width={14} height={14} />} Link
                      </button>
                      {(row.answered > 0 || row.completed_at) && (
                        <button className="btn btn-sm" onClick={() => setViewing(row)}><I2.eye width={14} height={14} /> Respuestas</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {loaded && !list.length && <div className="sq-empty">No hay proyectos activos.</div>}
        </div>
      )}

      <AnswersModal row={viewing} title={viewing ? labelOf(viewing.project_id) : ''} onClose={() => setViewing(null)} />
    </div>
  )
}
