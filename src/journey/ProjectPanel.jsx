import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import {
  laneMeta, upsellState, upsellStatusMeta, offerLabel, standbyNote, STANDBY_NOTE_MAX, alertLevel,
} from '../lib/journey.js'
import { normalizeLifecycle, daysBetween } from '../lib/lifecycle.js'
import { openCloserNotes } from '../lib/closerNotes.js'
import { fmtDay } from '../lib/stores.js'
import { ClientMark, dayCell, daysText, plural } from './parts.jsx'

const CSS = `
.jp{position:fixed;z-index:70;top:14px;right:14px;bottom:14px;width:min(408px,calc(100vw - 28px));display:flex;flex-direction:column;
  padding:5px;border-radius:22px;background:color-mix(in srgb,var(--bg-elevated) 70%,var(--border));
  box-shadow:inset 0 0 0 1px var(--border-strong),var(--shadow-lift)}
.jp-core{flex:1;min-height:0;display:flex;flex-direction:column;border-radius:17px;overflow:hidden;background:var(--bg-elevated);box-shadow:0 0 0 1px var(--border)}
.jp-h{--lc:var(--accent);position:relative;display:flex;align-items:flex-start;gap:12px;padding:18px 16px 16px 18px;border-bottom:1px solid var(--border);
  background:linear-gradient(180deg,color-mix(in srgb,var(--lc) 10%,transparent),transparent 90%)}
.jp-h .tx{flex:1;min-width:0}
.jp-h h2{font-size:18px;line-height:1.2;letter-spacing:-.025em;outline:none;overflow-wrap:anywhere}
.jp-h .cl{margin-top:3px;font-size:12.5px;color:var(--text-dim)}
.jp-x{flex:none;display:grid;place-items:center;width:34px;height:34px;margin:-4px -4px 0 0;border-radius:10px;color:var(--text-faint);transition:color .18s var(--e),background .18s var(--e)}
.jp-x:hover{color:var(--text);background:var(--card-hover)}
.jp-x:focus-visible,.jp-back:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.jp-back{display:inline-flex;align-items:center;gap:5px;height:26px;margin:-6px 0 8px -6px;padding:0 8px;border-radius:8px;font-size:12px;font-weight:600;color:var(--text-dim)}
.jp-back:hover{color:var(--text);background:var(--card-hover)}
.jp-back svg{transform:rotate(180deg)}
.jp-b{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px 18px 18px}
.jp-sec{padding:14px 0;border-top:1px solid var(--border)}
.jp-sec:first-child{border-top:none}
.jp-k{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)}
.jp-k span{text-transform:none;letter-spacing:0;font-weight:500}
.jp-stat{display:flex;align-items:center;gap:14px}
.jp-stat .big{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:34px;font-weight:600;letter-spacing:-.05em;line-height:1}
.jp-stat .big[data-lv="crit"]{color:var(--red)}
.jp-stat .big[data-lv="warn"]{color:var(--yellow)}
.jp-stat .cap{font-size:12.5px;color:var(--text-dim);line-height:1.4}
.jp-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--text);
  background:color-mix(in srgb,var(--lc) 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lc) 34%,transparent)}
.jp-pill i{width:6px;height:6px;border-radius:50%;background:var(--lc)}
.jp-bar{margin-top:12px}
.jp-bar .row{display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim);margin-bottom:6px}
.jp-bar .row b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;color:var(--text);font-weight:600}
.jp-bar .tr{height:6px;border-radius:6px;background:var(--track);overflow:hidden}
.jp-bar .tr i{display:block;height:100%;border-radius:6px;background:var(--lc);transform-origin:left center;animation:jpGrow .7s var(--e) both}
@keyframes jpGrow{from{transform:scaleX(0)}}
.jp-al{display:flex;flex-direction:column;gap:6px}
.jp-al div{display:flex;gap:9px;align-items:flex-start;padding:9px 11px;border-radius:11px;font-size:13px;line-height:1.45;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.jp-al i{width:7px;height:7px;border-radius:50%;margin-top:6px;flex:none}
.jp-dl{display:grid;grid-template-columns:auto 1fr;gap:7px 16px;margin:0;font-size:13px}
.jp-dl dt{color:var(--text-dim)}
.jp-dl dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.jp-dl dd small{color:var(--text-faint);font-size:11.5px}
.jp-up{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.jp-up > div{padding:10px 11px;border-radius:12px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.jp-up .t{font-size:11.5px;color:var(--text-faint)}
.jp-up .v{margin-top:5px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:650}
.jp-up .v i{width:7px;height:7px;border-radius:50%}
.jp-up .m{margin-top:3px;font-size:11.5px;color:var(--text-faint)}
.jp-q{margin-top:9px;font-size:12.5px;color:var(--text-dim);line-height:1.5}
.jp-q q{quotes:"“" "”";color:var(--text)}
.jp-act{display:inline-flex;align-items:center;gap:6px;height:32px;margin-top:10px;padding:0 11px;border-radius:10px;font-size:12.5px;font-weight:600;
  color:var(--text);background:var(--card);box-shadow:inset 0 0 0 1px var(--border);transition:box-shadow .2s var(--e),transform .16s var(--e)}
.jp-act:hover{box-shadow:inset 0 0 0 1px var(--accent-line)}
.jp-act:active{transform:scale(.97)}
.jp-act:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.jp-why textarea{width:100%;min-height:62px;padding:9px 11px;border-radius:11px;border:1px solid var(--border-strong);background:var(--card);color:var(--text);
  font-size:13px;line-height:1.45;resize:vertical}
.jp-why textarea:focus{outline:2px solid var(--yellow);outline-offset:0}
.jp-why .hint{display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:var(--text-faint)}
.jp-cn{display:flex;flex-direction:column;gap:7px;margin:0;padding:0;list-style:none}
.jp-cn li{position:relative;padding:9px 11px 9px 14px;border-radius:11px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border);overflow:hidden}
.jp-cn li::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--yellow)}
.jp-cn small{display:block;margin-top:3px;font-size:11.5px;color:var(--text-faint);white-space:normal}
.jp-f{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--border);background:color-mix(in srgb,var(--card) 50%,transparent)}
.jp-open{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;border-radius:12px;font-size:13px;font-weight:600;color:var(--text);
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border-strong);transition:box-shadow .2s var(--e),transform .16s var(--e)}
.jp-open:hover{box-shadow:inset 0 0 0 1px var(--accent-line)}
.jp-open:active{transform:scale(.98)}
.jp-open:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.jp-li{display:flex;flex-direction:column}
.jp-li button{display:flex;align-items:center;gap:10px;padding:9px 8px;margin:0 -8px;border-radius:11px;text-align:left;transition:background .18s var(--e)}
.jp-li button:hover{background:var(--card-hover)}
.jp-li button:focus-visible{outline:2px solid var(--violet);outline-offset:-2px}
.jp-li .tx{flex:1;min-width:0}
.jp-li .nm{font-size:13.5px;font-weight:600;letter-spacing:-.012em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jp-li .mt{margin-top:2px;font-size:11.5px;color:var(--text-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jp-li svg{color:var(--text-faint);flex:none}
.jp-none{font-size:12.5px;color:var(--text-faint);line-height:1.5}
@media (max-width:640px){
  .jp{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(86dvh,720px)}
  .jp-open{height:44px}
}
@media (prefers-reduced-motion: reduce){.jp-bar .tr i{animation:none}.jp-act:active,.jp-open:active{transform:none}}
`

const LC = {
  startedAt: 'Arrancó',
  devAt: 'Desarrollo actual desde',
  phase2At: 'Prueba gratis desde',
  phase3At: 'Plan mensual desde',
}

function KeyDates({ project, entry, now }) {
  const lc = normalizeLifecycle(project)
  const rows = []
  for (const [k, label] of Object.entries(LC)) if (lc[k]) rows.push([label, lc[k]])
  if (entry.lane === 'prueba' && lc.phase2At && lc.trialDays) {
    const end = new Date(new Date(lc.phase2At).getTime() + lc.trialDays * 864e5).toISOString()
    rows.push([entry.remaining != null && entry.remaining < 0 ? 'La prueba venció' : 'Termina la prueba', end])
  }
  if (entry.lane === 'standby' && project.stageAt) rows.push(['En stand-by desde', project.stageAt])
  if (!rows.length) return <div className="jp-none">Todavía no tiene fechas cargadas.</div>
  return (
    <dl className="jp-dl">
      {rows.map(([label, iso]) => {
        const d = daysBetween(iso, now)
        return (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{fmtDay(iso)}{d != null && d > 0 && <small> · hace {d} d</small>}</dd>
          </React.Fragment>
        )
      })}
    </dl>
  )
}

function StandbyEditor({ project, onSave }) {
  const note = standbyNote(project)
  const [v, setV] = useState(note)
  const [saved, setSaved] = useState(false)
  useEffect(() => { setV(note); setSaved(false) }, [project.id])
  const commit = () => {
    if (v.trim() === note) return
    onSave(project.id, v)
    setSaved(true)
  }
  return (
    <label className="jp-why" style={{ display: 'block' }}>
      <textarea value={v} maxLength={STANDBY_NOTE_MAX} rows={2} placeholder="Ej.: espera presupuesto para seguir"
        aria-label={`Por qué ${project.name} está en stand-by`}
        onChange={(e) => { setV(e.target.value); setSaved(false) }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === 'Escape' && v !== note) { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setV(note) }
        }} />
      <span className="hint"><span aria-live="polite">{saved ? 'Guardado' : 'Enter o salir del campo guarda'}</span><span>{v.length}/{STANDBY_NOTE_MAX}</span></span>
    </label>
  )
}

function UpsellBox({ project, onAnotar }) {
  const { data } = useApp()
  const st = upsellState(project)
  const who = (id) => (data.team || []).find((u) => u.id === id)?.name
  const lastNote = st.entries.find((e) => e.note)
  const card = (k) => {
    const e = st[k]
    const m = e ? upsellStatusMeta(e.status) : null
    return (
      <div>
        <div className="t">{offerLabel(k)}</div>
        {e ? (
          <>
            <div className="v"><i style={{ background: `var(${m.colorVar})` }} aria-hidden="true" />{m.label}</div>
            <div className="m">{e.at ? fmtDay(e.at) : 'sin fecha'}{who(e.by) ? ` · ${who(e.by)}` : ''}{e.status === 'paga' && e.payDay ? ` · paga el ${fmtDay(e.payDay)}` : ''}</div>
          </>
        ) : <div className="v" style={{ fontWeight: 500, color: 'var(--text-faint)' }}>Sin ofrecer</div>}
      </div>
    )
  }
  return (
    <>
      <div className="jp-up">{card('plan')}{card('fase2')}</div>
      {lastNote && <div className="jp-q"><q>{lastNote.note}</q></div>}
      {st.objections && <div className="jp-q">Objeción del onboarding: <q>{st.objections}</q></div>}
      <button type="button" className="jp-act" onClick={() => onAnotar(project.id)}>
        <I2.pencil width={13} height={13} /> {st.entries.length ? 'Ver historial y anotar' : 'Anotar oferta'}
      </button>
    </>
  )
}

function ProjectBody({ item, clientOf, onAnotar, onSaveNote, now }) {
  const { data } = useApp()
  const { project: p, entry } = item
  const lm = entry.lane ? laneMeta(entry.lane) : null
  const cell = entry.lane ? dayCell(entry) : null
  const notes = openCloserNotes(p)
  const who = (id) => (data.team || []).find((u) => u.id === id)?.name || 'Alguien'
  const showPct = entry.pct != null && ['onboarding', 'mvp', 'fase2'].includes(entry.lane)
  return (
    <>
      {lm && (
        <section className="jp-sec" style={{ '--lc': `var(${lm.colorVar})` }}>
          <div className="jp-stat">
            <span className="big" data-lv={cell.lv || undefined}>{cell.n}</span>
            <span className="cap">
              <span className="jp-pill"><i aria-hidden="true" />{lm.label}</span>
              <div style={{ marginTop: 5 }}>{daysText(entry)}{entry.limit && entry.lane !== 'prueba' && entry.days != null ? ` · el umbral es ${entry.limit}` : ''}</div>
            </span>
          </div>
          {showPct && (
            <div className="jp-bar">
              <div className="row"><span>Avance del plan</span><b>{Math.round(entry.pct)}%</b></div>
              <div className="tr" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(entry.pct)} aria-label="Avance del plan">
                <i style={{ width: `${Math.max(2, Math.min(100, entry.pct))}%` }} />
              </div>
            </div>
          )}
        </section>
      )}
      {!lm && <section className="jp-sec"><div className="jp-none">Cancelado: está fuera del recorrido.</div></section>}

      {entry.alerts.length > 0 && (
        <section className="jp-sec">
          <div className="jp-k">Alertas <span>{entry.alerts.length}</span></div>
          <div className="jp-al">
            {entry.alerts.map((a) => (
              <div key={a.key}><i style={{ background: a.level === 'crit' ? 'var(--red)' : 'var(--yellow)' }} aria-hidden="true" />
                <span><span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{a.level === 'crit' ? 'Urgente: ' : 'Aviso: '}</span>{a.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {entry.lane === 'standby' && (
        <section className="jp-sec">
          <div className="jp-k">Motivo del stand-by</div>
          <StandbyEditor project={p} onSave={onSaveNote} />
        </section>
      )}

      <section className="jp-sec">
        <div className="jp-k">Upsell</div>
        <UpsellBox project={p} onAnotar={onAnotar} />
      </section>

      {notes.length > 0 && (
        <section className="jp-sec">
          <div className="jp-k">Para el closer <span>{plural(notes.length, 'abierta', 'abiertas')}</span></div>
          <ul className="jp-cn">
            {notes.map((n) => (
              <li key={n.id}>{n.text}<small>{who(n.by)}{n.at ? ` · ${fmtDay(n.at)}` : ''}</small></li>
            ))}
          </ul>
        </section>
      )}

      <section className="jp-sec">
        <div className="jp-k">Fechas</div>
        <KeyDates project={p} entry={entry} now={now} />
      </section>
    </>
  )
}

function F2Body({ items, clientOf, onPick, now }) {
  if (!items.length) return <div className="jp-none" style={{ paddingTop: 14 }}>Nadie tiene la Fase 2 ofrecida ahora.</div>
  return (
    <div className="jp-li" style={{ paddingTop: 8 }}>
      {items.map((x) => {
        const c = clientOf(x.project.clientId)
        const lm = laneMeta(x.lane)
        const d = x.entry.at ? daysBetween(x.entry.at, now) : null
        const when = d == null ? 'sin fecha' : d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`
        return (
          <button key={x.project.id} type="button" style={{ '--lc': `var(${lm.colorVar})` }} onClick={(e) => onPick(x.project.id, e.currentTarget)}
            aria-label={`${x.project.name}. Está en ${lm.label}. Fase 2 ofrecida ${when}. Ver detalle`}>
            <ClientMark text={c?.company || x.project.name} size={30} />
            <span className="tx">
              <div className="nm">{x.project.name}{c?.company && <span style={{ fontWeight: 500, color: 'var(--text-faint)' }}> · {c.company}</span>}</div>
              <div className="mt">{lm.label} · ofrecida {when}{x.entry.note ? ` · ${x.entry.note}` : ''}</div>
            </span>
            <I2.arrowRight width={14} height={14} />
          </button>
        )
      })}
    </div>
  )
}

/*
 * Panel lateral no modal: el lienzo sigue usable detrás, y otro clic en un proyecto
 * cambia el contenido sin cerrar. Esc cierra salvo que haya un modal encima.
 */
export default function ProjectPanel({ target, itemOf, clientOf, f2, onClose, onPick, onBackToF2, onOpenProject, onAnotar, onSaveNote, suspendEsc }) {
  const reduce = useReducedMotion()
  const head = useRef(null)
  const now = useRef(new Date()).current
  const item = target?.kind === 'project' ? itemOf(target.id) : null
  const open = !!target && (target.kind === 'f2' || !!item)
  const key = target ? (target.kind === 'f2' ? 'f2' : target.id) : null

  useEffect(() => { if (open) head.current?.focus({ preventScroll: true }) }, [key])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape' && !suspendEsc && !e.defaultPrevented) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, suspendEsc, onClose])

  const p = item?.project
  const c = p ? clientOf(p.clientId) : null
  const lm = item?.entry.lane ? laneMeta(item.entry.lane) : null
  const titleId = 'jp-title'
  return createPortal(
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {open && (
          <motion.aside className="jp" role="dialog" aria-modal="false" aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 20, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}>
            <div className="jp-core">
              {target.kind === 'f2' ? (
                <div className="jp-h" style={{ '--lc': 'var(--violet)' }}>
                  <div className="tx">
                    <h2 id={titleId} ref={head} tabIndex={-1}>Fase 2 ofrecida</h2>
                    <div className="cl">Siguen en otro tramo. Cuando acepten, pasalos a Fase 2.</div>
                  </div>
                  <button type="button" className="jp-x" onClick={onClose} aria-label="Cerrar el panel"><I2.x width={16} height={16} /></button>
                </div>
              ) : (
                <div className="jp-h" style={{ '--lc': lm ? `var(${lm.colorVar})` : 'var(--text-faint)' }}>
                  <ClientMark text={c?.company || p.name} level={alertLevel(item.entry.alerts)} size={38} />
                  <div className="tx">
                    {target.from === 'f2' && (
                      <button type="button" className="jp-back" onClick={onBackToF2}><I2.arrowRight width={12} height={12} />Fase 2 ofrecida</button>
                    )}
                    <h2 id={titleId} ref={head} tabIndex={-1}>{p.name}</h2>
                    <div className="cl">{c?.company || c?.name || 'Sin cliente asignado'}</div>
                  </div>
                  <button type="button" className="jp-x" onClick={onClose} aria-label="Cerrar el panel"><I2.x width={16} height={16} /></button>
                </div>
              )}
              <div className="jp-b">
                {target.kind === 'f2'
                  ? <F2Body items={f2} clientOf={clientOf} onPick={onPick} now={now} />
                  : <ProjectBody item={item} clientOf={clientOf} onAnotar={onAnotar} onSaveNote={onSaveNote} now={now} />}
              </div>
              {target.kind === 'project' && (
                <div className="jp-f">
                  <button type="button" className="jp-open" onClick={() => onOpenProject(p.id)}>
                    Abrir proyecto <I2.ext width={14} height={14} />
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
