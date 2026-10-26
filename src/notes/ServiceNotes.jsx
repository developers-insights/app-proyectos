import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { projectStage } from '../lib/stages.js'
import {
  SERVICE_NOTE_TYPES, ONBOARDING_PROMPTS, SERVICE_NOTE_MAX, SERVICE_ANSWER_MAX, noteType, serviceNotesOf,
  addServiceNote, updateServiceNote, setServiceNotePinned, deleteServiceNote, restoreServiceNote,
  newServiceNoteId, notesIndex, typeCounts, noteSnippet, matchSnippet, noteWhen, noteMatches, answeredCount,
} from '../lib/serviceNotes.js'

const CSS = `
.sn-view{padding:28px 34px 72px;max-width:1240px}
@media(max-width:720px){.sn-view{padding:20px 16px 56px}}
.sn-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.sn-head p{margin:8px 0 0;font-size:13.5px;color:var(--text-dim);max-width:560px;line-height:1.55}
.sn-total{font-size:12.5px;color:var(--text-faint)}
.sn-total b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;color:var(--text);font-weight:600}

.sn-bar{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.sn-search{position:relative;max-width:560px}
.sn-search > svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--text-faint);pointer-events:none}
.sn-search .input{padding:11px 74px 11px 38px;border-radius:12px;font-size:14px;min-height:44px}
@media(max-width:720px){.sn-search .input{padding-right:44px;font-size:16px}.sn-ta,.sn-q textarea{font-size:16px}}
.sn-search input::-webkit-search-cancel-button{-webkit-appearance:none;display:none}
.sn-search .tail{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:6px}
.sn-x{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--text-faint);transition:background-color .16s,color .16s}
.sn-x:hover{background:var(--card-hover);color:var(--text)}
.sn-chips{display:flex;flex-wrap:wrap;gap:6px}
.sn-chip{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:600;
  color:var(--text-dim);background:transparent;box-shadow:inset 0 0 0 1px var(--border);transition:background-color .18s,color .18s,box-shadow .18s}
.sn-chip:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--border-strong)}
.sn-chip[aria-pressed="true"]{color:var(--text);background:var(--card-hover);box-shadow:inset 0 0 0 1px var(--border-strong)}
.sn-chip .n{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-faint)}
.sn-chip .d{width:7px;height:7px;border-radius:50%;background:var(--sn-c)}

[data-t="violet"]{--sn-c:var(--violet);--sn-s:var(--violet-soft)}
[data-t="accent"]{--sn-c:var(--accent);--sn-s:var(--accent-soft)}
[data-t="yellow"]{--sn-c:var(--yellow);--sn-s:var(--yellow-soft)}
[data-t="green"]{--sn-c:var(--green);--sn-s:var(--green-soft)}
[data-t="blue"]{--sn-c:var(--blue);--sn-s:var(--blue-soft)}
[data-t="neutral"]{--sn-c:var(--text-dim);--sn-s:var(--track)}

.sn-grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:22px;align-items:start}
@media(max-width:900px){.sn-grid{grid-template-columns:minmax(0,1fr)}}
.sn-aside{position:sticky;top:12px;max-height:calc(100vh - 120px);overflow-y:auto;padding:6px;border-radius:18px;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
@media(max-width:900px){.sn-aside{position:static;max-height:none;overflow:visible}}
.sn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.sn-proj{position:relative;width:100%;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;
  padding:11px 12px 11px 14px;border-radius:13px;transition:background-color .18s;min-height:44px}
.sn-proj:hover{background:var(--card-hover)}
.sn-proj[aria-current="true"]{background:var(--bg)}
.sn-proj[aria-current="true"]::before{content:'';position:absolute;left:4px;top:12px;bottom:12px;width:2px;border-radius:2px;background:var(--accent)}
:root .sn-proj[aria-current="true"]{box-shadow:inset 0 0 0 1px var(--border-strong)}
.sn-proj .nm{font-size:14px;font-weight:650;letter-spacing:-.015em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sn-proj .ct{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-faint);align-self:center}
.sn-proj .ct[data-has="1"]{color:var(--text-dim)}
.sn-proj .cl{grid-column:1 / -1;font-size:12px;color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sn-proj .sn{grid-column:1 / -1;font-size:12.5px;color:var(--text-dim);line-height:1.45;margin-top:4px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sn-proj .sn i{font-style:normal;color:var(--text-faint)}
.sn-sep{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text-faint);padding:14px 14px 6px}

.sn-main{min-width:0}
.sn-thead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.sn-thead h2{font-size:22px;letter-spacing:-.03em;line-height:1.15}
.sn-thead .cl{margin-top:4px;font-size:13px;color:var(--text-dim)}
.sn-tact{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sn-sync{font-size:12px;color:var(--text-faint);display:inline-flex;align-items:center;gap:6px}
.sn-sync::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--green)}
.sn-sync[data-s="saving"]::before{background:var(--yellow)}
.sn-sync[data-s="offline"]::before{background:var(--red)}
.sn-back{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 4px;margin:-6px 0 8px;font-size:13px;font-weight:600;color:var(--text-dim)}
.sn-back:hover{color:var(--text)}

.sn-comp{border-radius:18px;padding:5px;background:var(--track);box-shadow:inset 0 0 0 1px var(--border)}
.sn-comp-in{border-radius:14px;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border),0 1px 0 rgba(255,255,255,.03) inset;padding:12px 14px 10px}
.sn-comp:focus-within{box-shadow:inset 0 0 0 1px var(--accent-line)}
.sn-ta:focus-visible{outline:none}
.sn-types{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.sn-type{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;
  color:var(--text-dim);transition:background-color .18s,color .18s,box-shadow .18s}
.sn-type::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--sn-c);opacity:.7}
.sn-type:hover{color:var(--text);background:var(--card-hover)}
.sn-type[aria-checked="true"]{color:var(--text);background:var(--sn-s);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sn-c) 38%,transparent)}
.sn-type[aria-checked="true"]::before{opacity:1}
.sn-ta{width:100%;border:0;outline:none;background:transparent;resize:none;font-size:14.5px;line-height:1.6;color:var(--text);
  padding:6px 2px;min-height:48px;overflow:hidden}
.sn-ta::placeholder{color:var(--text-faint)}
.sn-guide{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;padding:10px 2px 6px;margin-top:4px;border-top:1px solid var(--border)}
@media(max-width:720px){.sn-guide{grid-template-columns:minmax(0,1fr)}}
.sn-q label{display:block;font-size:12px;font-weight:650;color:var(--text);margin-bottom:4px;letter-spacing:-.005em}
.sn-q label small{display:block;font-weight:500;color:var(--text-faint);font-size:11.5px;margin-top:1px}
.sn-q textarea{width:100%;border-radius:10px;border:1px solid var(--border);background:var(--bg);padding:8px 10px;font-size:13.5px;line-height:1.5;
  resize:none;overflow:hidden;min-height:38px;outline:none;transition:border-color .16s}
.sn-q textarea:focus{border-color:var(--accent-line)}
.sn-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}
.sn-hint{font-size:11.5px;color:var(--text-faint);display:inline-flex;align-items:center;gap:5px}
.sn-link{font-size:12.5px;font-weight:600;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 4px}
.sn-link:hover{color:var(--text)}
.sn-save{margin-left:auto;display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 6px 0 14px;border-radius:999px;font-size:13px;font-weight:650;
  background:var(--accent);color:var(--accent-contrast);transition:transform .16s cubic-bezier(.22,1,.36,1),opacity .16s}
.sn-save i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.14);transition:transform .2s cubic-bezier(.22,1,.36,1)}
.sn-save:active{transform:scale(.97)}
.sn-save:disabled{opacity:.4;cursor:not-allowed}
@media (hover:hover) and (pointer:fine){.sn-save:not(:disabled):hover i{transform:translateX(2px)}}
.sn-cancel{height:36px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:600;color:var(--text-dim)}
.sn-cancel:hover{color:var(--text);background:var(--card-hover)}
@media(max-width:720px){.sn-save,.sn-cancel{height:44px}.sn-hint.kb{display:none}}

.sn-notes > .sn-grp{margin:12px 2px -2px}
.sn-comp + .sn-notes,.sn-off + .sn-notes{margin-top:8px}
.sn-grp{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text-faint);margin:22px 2px 8px;display:flex;align-items:center;gap:8px}
.sn-grp button{letter-spacing:0;text-transform:none;font-size:12px;font-weight:600;color:var(--accent);margin-left:auto}
.sn-notes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.sn-card{position:relative;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);padding:13px 14px 14px 16px;transition:box-shadow .2s}
.sn-card:hover{box-shadow:inset 0 0 0 1px var(--border-strong)}
.sn-card[data-pin="1"]{background:linear-gradient(180deg,var(--sn-s),transparent 70%),var(--card)}
.sn-ch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:30px}
.sn-tag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:650;color:var(--sn-c)}
.sn-tag::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--sn-c)}
.sn-meta{font-size:12px;color:var(--text-faint)}
.sn-acts{margin-left:auto;display:flex;align-items:center;gap:2px}
.sn-ib{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:var(--text-faint);transition:background-color .16s,color .16s}
.sn-ib:hover{background:var(--card-hover);color:var(--text)}
.sn-ib[aria-pressed="true"]{color:var(--sn-c)}
.sn-ib.del:hover{color:var(--red)}
@media(max-width:720px){.sn-ib{width:40px;height:40px}}
.sn-body{margin-top:6px;font-size:14px;line-height:1.62;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text)}
.sn-body.clamp{display:-webkit-box;-webkit-line-clamp:9;-webkit-box-orient:vertical;overflow:hidden}
.sn-more{margin-top:6px;font-size:12.5px;font-weight:600;color:var(--text-dim);min-height:32px}
.sn-more:hover{color:var(--text)}
.sn-ans{margin:10px 0 0;display:grid;gap:10px}
.sn-ans div{padding-left:12px;border-left:2px solid var(--border)}
.sn-ans dt{font-size:11.5px;font-weight:650;color:var(--text-dim);margin-bottom:2px}
.sn-ans dd{margin:0;font-size:13.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.sn-view mark,.sn-block mark{background:var(--yellow-soft);color:inherit;border-radius:3px;padding:0 1px;box-shadow:0 0 0 1px var(--yellow-line)}

.sn-empty{padding:34px 22px;border-radius:18px;text-align:center;box-shadow:inset 0 0 0 1px var(--border);
  background:radial-gradient(420px 160px at 50% 0%,var(--wash-a),transparent 70%),var(--card)}
.sn-empty h3{font-size:16px;letter-spacing:-.02em;margin-bottom:6px}
.sn-empty p{margin:0 auto;max-width:420px;font-size:13.5px;color:var(--text-dim);line-height:1.55}
.sn-empty .btn{margin-top:14px}
.sn-empty.sm{padding:22px 16px;margin-top:12px}
.sn-pick{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:16px}
.sn-pick span{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim);padding:4px 10px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--border)}
.sn-pick span::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--sn-c)}
.sn-off{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;margin-bottom:12px;font-size:13px;color:var(--text);
  background:var(--red-soft);box-shadow:inset 0 0 0 1px var(--border)}

.sn-toast{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:12px;
  padding:8px 8px 8px 16px;border-radius:999px;background:var(--text);color:var(--bg);font-size:13.5px;font-weight:550;
  box-shadow:0 18px 40px -18px rgba(0,0,0,.55);max-width:calc(100vw - 32px)}
.sn-toast button{height:34px;padding:0 14px;border-radius:999px;font-weight:700;font-size:13px;background:var(--bg);color:var(--text)}

.sn-block{margin:0 0 26px}
.sn-block .sn-comp{margin-bottom:12px}
.sn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`

const MotionLi = motion.li

function PinIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" fill={props['data-on'] ? 'currentColor' : 'none'} />
      <path d="M12 13v7" />
    </svg>
  )
}

const draftKey = (pid) => `sn_draft_${pid}`
const readDraft = (pid) => { try { const v = JSON.parse(localStorage.getItem(draftKey(pid)) || 'null'); return v && typeof v === 'object' ? v : null } catch (e) { return null } }
const writeDraft = (pid, d) => { try { if (d) localStorage.setItem(draftKey(pid), JSON.stringify(d)); else localStorage.removeItem(draftKey(pid)) } catch (e) { /* sin storage no hay borrador */ } }

const typing = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

function autoGrow(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
}

const foldChar = (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function Highlight({ text, query }) {
  const words = useMemo(() => [...new Set(String(query || '').split(/\s+/).map((w) => [...w].map(foldChar).join('')).filter((w) => w.length > 1))], [query])
  if (!words.length || !text) return text || null
  const chars = [...text]
  const folded = chars.map(foldChar)
  const hay = folded.join('')
  const starts = []
  let pos = 0
  for (const f of folded) { starts.push(pos); pos += f.length }
  const on = new Array(chars.length).fill(false)
  for (const w of words) {
    let i = hay.indexOf(w)
    while (i !== -1) {
      for (let k = 0; k < chars.length; k++) if (starts[k] >= i && starts[k] < i + w.length) on[k] = true
      i = hay.indexOf(w, i + w.length)
    }
  }
  const out = []
  let buf = ''
  let cur = on[0]
  chars.forEach((c, k) => {
    if (on[k] !== cur) { out.push(cur ? <mark key={k}>{buf}</mark> : buf); buf = ''; cur = on[k] }
    buf += c
  })
  out.push(cur ? <mark key="end">{buf}</mark> : buf)
  return <>{out}</>
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}

function useUndoToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const reduce = useReducedMotion()
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = useCallback((text, onUndo) => {
    clearTimeout(timer.current)
    setToast({ text, onUndo, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 7000)
  }, [])
  const el = typeof document === 'undefined' ? null : createPortal(
    <div aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.key} className="sn-toast" style={{ x: '-50%' }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: .14 } }}
            transition={{ duration: .26, ease: [.22, 1, .36, 1] }}>
            <span>{toast.text}</span>
            <button type="button" onClick={() => { clearTimeout(timer.current); toast.onUndo(); setToast(null) }}>Deshacer</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
  return [show, el]
}

function useNoteActions(project) {
  const { projectStore, myId, logActivity } = useApp()
  const pid = project?.id
  const patch = useCallback((fn) => { if (pid) projectStore.patch(pid, fn) }, [pid, projectStore])
  return useMemo(() => ({
    add: (input) => {
      const id = newServiceNoteId()
      patch((p) => ({ ...p, ...addServiceNote(p, { ...input, id, by: myId || null }) }))
      if (logActivity && project) logActivity({ type: 'service_note', text: `anotó algo de ${project.name}` })
      return id
    },
    update: (id, changes) => patch((p) => ({ ...p, ...updateServiceNote(p, id, changes, myId || null) })),
    pin: (id, v) => patch((p) => ({ ...p, ...setServiceNotePinned(p, id, v) })),
    remove: (id) => patch((p) => ({ ...p, ...deleteServiceNote(p, id) })),
    restore: (id) => patch((p) => ({ ...p, ...restoreServiceNote(p, id) })),
  }), [patch, myId, logActivity, project])
}

function TypePicker({ value, onChange, label }) {
  const ref = useRef(null)
  const move = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return
    e.preventDefault()
    const i = SERVICE_NOTE_TYPES.findIndex((t) => t.key === value)
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
    const next = SERVICE_NOTE_TYPES[(i + d + SERVICE_NOTE_TYPES.length) % SERVICE_NOTE_TYPES.length]
    onChange(next.key)
    requestAnimationFrame(() => ref.current?.querySelector(`[data-k="${next.key}"]`)?.focus())
  }
  return (
    <div className="sn-types" role="radiogroup" aria-label={label} ref={ref} onKeyDown={move}>
      {SERVICE_NOTE_TYPES.map((t) => (
        <button key={t.key} type="button" role="radio" data-k={t.key} data-t={t.tone} className="sn-type"
          aria-checked={value === t.key} tabIndex={value === t.key ? 0 : -1} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Composer({ project, note = null, onSaved, onCancel, actions, inputRef, presetType, onPresetUsed }) {
  const editing = !!note
  const draft = useMemo(() => (editing ? null : readDraft(project.id)), [editing, project.id])
  const [type, setType] = useState(note?.type || draft?.type || 'general')
  const [text, setText] = useState(note?.text || draft?.text || '')
  const [answers, setAnswers] = useState(note?.answers || draft?.answers || {})
  const [guide, setGuide] = useState(() => (note ? answeredCount(note) > 0 : (draft?.type || '') === 'onboarding'))
  const taRef = useRef(null)
  const formRef = useRef(null)
  const uid = useId()

  useEffect(() => {
    if (!presetType) return
    setType(presetType.type)
    if (presetType.type === 'onboarding') setGuide(true)
    requestAnimationFrame(() => taRef.current?.focus())
    if (onPresetUsed) onPresetUsed()
  }, [presetType])

  const hasContent = text.trim() !== '' || Object.values(answers).some((v) => String(v || '').trim())

  useEffect(() => {
    if (editing) return
    const t = setTimeout(() => writeDraft(project.id, hasContent ? { type, text, answers } : null), 250)
    return () => clearTimeout(t)
  }, [editing, project.id, type, text, answers, hasContent])

  useLayoutEffect(() => { autoGrow(taRef.current) }, [text, guide])
  useLayoutEffect(() => {
    formRef.current?.querySelectorAll('.sn-q textarea').forEach(autoGrow)
  }, [answers, guide])

  const pickType = (k) => {
    setType(k)
    if (k === 'onboarding' && !editing && !answeredCount({ answers })) setGuide(true)
  }

  const reset = () => { setText(''); setAnswers({}); setGuide(false); writeDraft(project.id, null) }

  const save = () => {
    if (!hasContent) return
    const clean = guide || type === 'onboarding' ? answers : {}
    if (editing) {
      actions.update(note.id, { type, text, answers: clean })
      onSaved && onSaved(note.id)
      return
    }
    const id = actions.add({ type, text, answers: clean })
    reset()
    onSaved && onSaved(id)
    requestAnimationFrame(() => taRef.current?.focus())
  }

  const keys = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); return }
    if (e.key === 'Escape') {
      if (editing) { e.preventDefault(); onCancel && onCancel() } else e.currentTarget.blur()
    }
  }

  const answerKeys = (e, i) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const next = formRef.current?.querySelectorAll('.sn-q textarea')[i + 1]
      if (next) { e.preventDefault(); next.focus() }
      return
    }
    keys(e)
  }

  const setTa = (el) => { taRef.current = el; if (inputRef) inputRef.current = el }
  const showGuide = guide

  return (
    <div className="sn-comp" ref={formRef}>
      <div className="sn-comp-in">
        <TypePicker value={type} onChange={pickType} label={editing ? 'Tipo de nota' : 'Tipo de la nota nueva'} />
        <label htmlFor={`${uid}-t`} className="sn-sr">{editing ? 'Texto de la nota' : 'Nota nueva'}</label>
        <textarea id={`${uid}-t`} ref={setTa} className="sn-ta" rows={2} maxLength={SERVICE_NOTE_MAX} value={text}
          autoFocus={editing}
          onChange={(e) => setText(e.target.value)} onKeyDown={keys}
          placeholder={type === 'onboarding' ? 'Cómo fue el onboarding, qué te llamó la atención…' : type === 'call' ? '¿Qué salió de la call?' : 'Anotá lo que te contó…'} />
        {showGuide && (
          <div className="sn-guide">
            {ONBOARDING_PROMPTS.map((q, i) => (
              <div className="sn-q" key={q.key}>
                <label htmlFor={`${uid}-${q.key}`}>{q.label}<small>{q.hint}</small></label>
                <textarea id={`${uid}-${q.key}`} rows={1} maxLength={SERVICE_ANSWER_MAX} value={answers[q.key] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  onKeyDown={(e) => answerKeys(e, i)} />
              </div>
            ))}
          </div>
        )}
        <div className="sn-foot">
          <button type="button" className="sn-link" aria-expanded={showGuide} onClick={() => setGuide((v) => !v)}>
            <I2.tasks width={14} height={14} /> {showGuide ? 'Ocultar las preguntas' : 'Preguntas del onboarding'}
          </button>
          {!editing && draft && hasContent && <span className="sn-hint">Borrador recuperado</span>}
          <span className="sn-hint kb"><span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> guarda</span>
          {editing && <button type="button" className="sn-cancel" style={{ marginLeft: 'auto' }} onClick={onCancel}>Cancelar</button>}
          <button type="button" className="sn-save" disabled={!hasContent} onClick={save} style={editing ? { marginLeft: 0 } : undefined}>
            {editing ? 'Guardar cambios' : 'Guardar nota'} <i><I2.check width={13} height={13} /></i>
          </button>
        </div>
      </div>
    </div>
  )
}

function NoteCard({ note, project, actions, query, onDeleted, who }) {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const t = noteType(note.type)
  const long = note.text.length > 700 || note.text.split('\n').length > 9
  const edited = note.updatedAt && note.at && new Date(note.updatedAt) - new Date(note.at) > 60000
  const full = note.at ? new Date(note.at).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' }) : ''

  if (editing) {
    return <Composer project={project} note={note} actions={actions} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
  }
  return (
    <article className="sn-card" data-t={t.tone} data-pin={note.pinned ? '1' : '0'} aria-label={`${t.label}${note.at ? `, ${full}` : ''}`}>
      <div className="sn-ch">
        <span className="sn-tag">{t.label}</span>
        <span className="sn-meta" title={full}>
          {noteWhen(note.at) || 'Sin fecha'}{note.by ? ` · ${who(note.by)}` : ''}{edited ? ' · editada' : ''}
        </span>
        <div className="sn-acts">
          <button type="button" className="sn-ib" aria-pressed={note.pinned} onClick={() => actions.pin(note.id, !note.pinned)}
            aria-label={note.pinned ? 'Soltar la nota' : 'Fijar arriba'} title={note.pinned ? 'Soltar' : 'Fijar arriba'}>
            <PinIcon width={16} height={16} data-on={note.pinned ? 1 : undefined} />
          </button>
          <button type="button" className="sn-ib" onClick={() => setEditing(true)} aria-label="Editar la nota" title="Editar">
            <I2.pencil width={14} height={14} />
          </button>
          <button type="button" className="sn-ib del" onClick={() => onDeleted(note)} aria-label="Borrar la nota" title="Borrar">
            <I2.trash width={14} height={14} />
          </button>
        </div>
      </div>
      {note.text && (
        <div className={`sn-body${long && !open ? ' clamp' : ''}`} onDoubleClick={() => setEditing(true)}>
          <Highlight text={note.text} query={query} />
        </div>
      )}
      {long && <button type="button" className="sn-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Ver menos' : 'Ver todo'}</button>}
      {answeredCount(note) > 0 && (
        <dl className="sn-ans">
          {ONBOARDING_PROMPTS.filter((q) => note.answers[q.key]).map((q) => (
            <div key={q.key}><dt>{q.label}</dt><dd><Highlight text={note.answers[q.key]} query={query} /></dd></div>
          ))}
        </dl>
      )}
    </article>
  )
}

function NoteList({ notes, sections, project, actions, query, onDeleted, who }) {
  const reduce = useReducedMotion()
  const groups = sections || [{ key: 'all', label: null, notes }]
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: .1 } } }
  return (
    <ul className="sn-notes">
      <AnimatePresence initial={false}>
        {groups.flatMap((g) => [
          g.label ? (
            <MotionLi key={`h-${g.key}`} layout={reduce ? false : 'position'} className="sn-grp" {...fade} transition={{ duration: .2 }}>
              {g.label}{g.extra}
            </MotionLi>
          ) : null,
          ...g.notes.map((n) => (
          <MotionLi key={n.id} layout={reduce ? false : 'position'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: .12 } }}
            transition={{ duration: .24, ease: [.22, 1, .36, 1] }}>
            <NoteCard note={n} project={project} actions={actions} query={query} onDeleted={onDeleted} who={who} />
          </MotionLi>
          )),
        ].filter(Boolean))}
      </AnimatePresence>
    </ul>
  )
}

function useWho() {
  const { data, myId } = useApp()
  return useCallback((id) => {
    if (id && id === myId) return 'vos'
    return (data.team || []).find((u) => u.id === id)?.name?.split(' ')[0] || 'alguien del equipo'
  }, [data.team, myId])
}

function Thread({ project, client, query, type, onClearFilters, onOpenProject, composerRef, onBack }) {
  const { projectStore } = useApp()
  const actions = useNoteActions(project)
  const [toast, toastEl] = useUndoToast()
  const who = useWho()
  const online = useOnline()
  const [preset, setPreset] = useState(null)
  const all = serviceNotesOf(project)
  const filtered = all.filter((n) => (type === 'all' || n.type === type) && noteMatches(n, query))
  const filtering = filtered.length !== all.length
  const pinned = filtered.filter((n) => n.pinned)
  const rest = filtered.filter((n) => !n.pinned)
  const del = (n) => { actions.remove(n.id); toast('Borraste la nota', () => actions.restore(n.id)) }
  const sync = !online ? 'offline' : projectStore.saving ? 'saving' : 'saved'

  return (
    <section className="sn-main" aria-labelledby="sn-thread-title">
      {onBack && <button type="button" className="sn-back" onClick={onBack}><I2.chevR width={14} height={14} style={{ transform: 'scaleX(-1)' }} /> Todos los proyectos</button>}
      <div className="sn-thead">
        <div style={{ minWidth: 0 }}>
          <h2 id="sn-thread-title">{project.name}</h2>
          <div className="cl">{[client?.name, client?.company].filter(Boolean).join(' · ') || 'Sin cliente cargado'}</div>
        </div>
        <div className="sn-tact">
          <span className="sn-sync" data-s={sync} aria-live="polite">{sync === 'offline' ? 'Sin conexión' : sync === 'saving' ? 'Guardando…' : 'Guardado'}</span>
          {onOpenProject && <button type="button" className="btn btn-sm" onClick={() => onOpenProject(project.id)}>Abrir proyecto <I2.arrowRight width={12} height={12} /></button>}
        </div>
      </div>
      {!online && <div className="sn-off" role="status"><I2.alert width={15} height={15} /> Estás sin conexión. Lo que escribas queda en esta compu y se guarda cuando vuelva.</div>}
      <Composer key={project.id} project={project} actions={actions} inputRef={composerRef} presetType={preset} onPresetUsed={() => setPreset(null)} />
      {all.length === 0 ? (
        <div className="sn-empty sm">
          <h3>Todavía no hay notas de {client?.name || project.name}</h3>
          <p>Si estás por hacer el onboarding, empezá con las preguntas clave: por qué ahora, qué lo frenaba, qué consume y qué espera a futuro.</p>
          <button type="button" className="btn btn-sm" onClick={() => setPreset({ type: 'onboarding', at: Date.now() })}><I2.tasks width={14} height={14} /> Empezar el onboarding</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sn-empty sm">
          <h3>Ninguna nota de este proyecto coincide</h3>
          <p>Tiene {all.length} {all.length === 1 ? 'nota' : 'notas'}, pero ninguna con ese filtro.</p>
          <button type="button" className="btn btn-sm" onClick={onClearFilters}>Ver todas</button>
        </div>
      ) : (
        <>
          <NoteList project={project} actions={actions} query={query} onDeleted={del} who={who} sections={[
            ...(filtering ? [{ key: 'count', label: `Mostrando ${filtered.length} de ${all.length}`, extra: <button type="button" onClick={onClearFilters}>Ver todas</button>, notes: [] }] : []),
            ...(pinned.length ? [{ key: 'pin', label: 'Fijadas', notes: pinned }] : []),
            ...(rest.length ? [{ key: 'rest', label: pinned.length ? 'El resto' : filtering ? null : 'Más nuevas primero', notes: rest }] : []),
          ]} />
        </>
      )}
      {toastEl}
    </section>
  )
}

function useIsNarrow(px = 900) {
  const q = `(max-width:${px}px)`
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return narrow
}

export function NotesView({ initialProjectId = null, onOpenProject }) {
  const { data, projectStore } = useApp()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [selected, setSelected] = useState(initialProjectId)
  const narrow = useIsNarrow()
  const searchRef = useRef(null)
  const composerRef = useRef(null)

  useEffect(() => { if (initialProjectId) setSelected(initialProjectId) }, [initialProjectId])

  const projects = useMemo(() => (data.projects || []).filter((p) =>
    p.kind !== 'interno' && (projectStage(p) !== 'cancelado' || serviceNotesOf(p).length > 0)), [data.projects])
  const rows = useMemo(() => notesIndex(projects, data.clients, { query, type }), [projects, data.clients, query, type])
  const counts = useMemo(() => typeCounts(projects), [projects])
  const withNotes = rows.filter((r) => r.count > 0)
  const without = rows.filter((r) => r.count === 0)
  const withCount = projects.filter((p) => serviceNotesOf(p).length > 0).length

  const current = projects.find((p) => p.id === selected) || null
  const effective = current || (!narrow && rows[0] ? rows[0].project : null)
  const client = effective ? (data.clients || []).find((c) => c.id === effective.clientId) : null
  const loading = !projectStore.ready && projects.length === 0

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(document.activeElement)) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === 'n' || e.key === 'N') { if (composerRef.current) { e.preventDefault(); composerRef.current.focus() } }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (id) => {
    setSelected(id)
    if (narrow) requestAnimationFrame(() => document.querySelector('.sn-main')?.scrollIntoView({ block: 'start' }))
  }
  const clearFilters = () => { setQuery(''); setType('all') }

  const renderRow = (r) => {
    const sel = effective && effective.id === r.project.id
    const match = query.trim() && !r.nameHit ? r.shown[0] : null
    const snip = match || r.last
    return (
      <li key={r.project.id}>
        <button type="button" className="sn-proj" aria-current={sel ? 'true' : undefined} onClick={() => pick(r.project.id)}>
          <span className="nm"><Highlight text={r.project.name} query={query} /></span>
          <span className="ct" data-has={r.count ? '1' : '0'} aria-label={`${r.count} ${r.count === 1 ? 'nota' : 'notas'}`}>
            {query.trim() && !r.nameHit ? `${r.shown.length}/${r.count}` : r.count}
          </span>
          {(r.client?.name || r.client?.company) && <span className="cl"><Highlight text={[r.client?.name, r.client?.company].filter(Boolean).join(' · ')} query={query} /></span>}
          {snip && <span className="sn"><i>{noteWhen(snip.at)} · </i><Highlight text={match ? matchSnippet(snip, query, 110) : noteSnippet(snip, 110)} query={query} /></span>}
        </button>
      </li>
    )
  }

  const showList = !narrow || !current
  const showThread = !narrow || !!current

  return (
    <div className="view sn-view">
      <style>{CSS}</style>
      <div className="sn-head">
        <div style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 6 }}>Servicio</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Notas</h1>
          <p>Lo que te cuenta cada cliente en el onboarding y en las calls, ordenado por proyecto. Lo usan ventas y contenido, así que anotá con sus palabras.</p>
        </div>
        <div className="sn-total"><b>{counts.all}</b> {counts.all === 1 ? 'nota' : 'notas'} en <b>{withCount}</b> {withCount === 1 ? 'proyecto' : 'proyectos'}</div>
      </div>

      <div className="sn-bar">
        <div className="sn-search">
          <I2.search width={15} height={15} />
          <label htmlFor="sn-q" className="sn-sr">Buscar en las notas</label>
          <input id="sn-q" ref={searchRef} className="input" type="search" autoComplete="off" value={query}
            placeholder="Buscar en notas, proyectos o clientes"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setQuery(''); return }
              if (e.key === 'Enter' && rows[0]) { e.preventDefault(); pick(rows[0].project.id) }
            }} />
          <span className="tail">
            {query
              ? <button type="button" className="sn-x" onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Borrar la búsqueda"><I2.x width={14} height={14} /></button>
              : <span className="kbd hide-mobile" aria-hidden="true">/</span>}
          </span>
        </div>
        <div className="sn-chips" role="group" aria-label="Filtrar por tipo">
          <button type="button" className="sn-chip" aria-pressed={type === 'all'} onClick={() => setType('all')}>Todas <span className="n">{counts.all}</span></button>
          {SERVICE_NOTE_TYPES.map((t) => (
            <button key={t.key} type="button" className="sn-chip" data-t={t.tone} aria-pressed={type === t.key}
              onClick={() => setType(type === t.key ? 'all' : t.key)}>
              <span className="d" aria-hidden="true" />{t.label} <span className="n">{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sn-grid">
        {showList && (
          <nav className="sn-aside" aria-label="Proyectos">
            {loading ? (
              <div aria-busy="true" aria-label="Cargando proyectos" style={{ display: 'grid', gap: 8, padding: 8 }}>
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 52 }} />)}
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: '26px 16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-dim)' }}>
                  {query.trim() ? <>Nada coincide con «{query.trim()}».</> : type !== 'all' ? <>Todavía no hay notas de {noteType(type).label}.</> : 'No hay proyectos de clientes.'}
                </p>
                {(query || type !== 'all') && <button type="button" className="btn btn-sm" style={{ marginTop: 12 }} onClick={clearFilters}>Limpiar filtros</button>}
              </div>
            ) : (
              <>
                <ul className="sn-list">{withNotes.map(renderRow)}</ul>
                {without.length > 0 && (
                  <>
                    {withNotes.length > 0 && <div className="sn-sep">Sin notas todavía</div>}
                    <ul className="sn-list">{without.map(renderRow)}</ul>
                  </>
                )}
              </>
            )}
          </nav>
        )}
        {showThread && (effective ? (
          <Thread key={effective.id} project={effective} client={client} query={query} type={type}
            onClearFilters={clearFilters} onOpenProject={onOpenProject} composerRef={composerRef}
            onBack={narrow ? () => setSelected(null) : null} />
        ) : !loading && (
          <div className="sn-empty">
            <h3>Elegí un proyecto</h3>
            <p>Cada nota lleva un tipo para encontrarla rápido después.</p>
            <div className="sn-pick">{SERVICE_NOTE_TYPES.map((t) => <span key={t.key} data-t={t.tone}>{t.label}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProjectNotesBlock({ project, onOpenAll }) {
  const actions = useNoteActions(project)
  const [toast, toastEl] = useUndoToast()
  const who = useWho()
  const all = serviceNotesOf(project)
  const top = all.slice(0, 3)
  const del = (n) => { actions.remove(n.id); toast('Borraste la nota', () => actions.restore(n.id)) }
  return (
    <section className="sn-block" aria-labelledby={`sn-b-${project.id}`}>
      <style>{CSS}</style>
      <div className="pd-h">
        <h2 id={`sn-b-${project.id}`}>Notas del servicio</h2>
        <span className="sub">lo que te cuenta el cliente en el onboarding y las calls</span>
        {onOpenAll && <button type="button" className="sn-link" style={{ marginLeft: 'auto' }} onClick={() => onOpenAll(project.id)}>
          {all.length > 3 ? `Ver las ${all.length} en Notas` : 'Abrir en Notas'} <I2.arrowRight width={12} height={12} />
        </button>}
      </div>
      <Composer key={project.id} project={project} actions={actions} />
      {top.length > 0 && <NoteList notes={top} project={project} actions={actions} query="" onDeleted={del} who={who} />}
      {toastEl}
    </section>
  )
}
