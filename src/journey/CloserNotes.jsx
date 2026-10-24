import React, { useId, useState } from 'react'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { normalizeCloserNotes, addCloserNote, resolveCloserNote, reopenCloserNote, CLOSER_NOTE_MAX } from '../lib/closerNotes.js'
import { fmtDay } from '../lib/stores.js'

/*
 * "Para el closer" (pedido de Juan, call del 23/10): lo urgente que el closer que
 * le cobra a este cliente tiene que saber. Al guardarla le llega en Speed Funnels
 * (Cuotas y Mi día, más una notificación en el celular). Resolverla la saca de allá.
 */

const CSS = `
.cn-panel{position:relative;padding:14px 16px 14px 19px;margin:-14px 0 26px;border-radius:16px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--border);overflow:hidden}
.cn-panel::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--yellow)}
.cn-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.cn-head p{margin:0;font-size:12px;color:var(--text-faint);line-height:1.45}
.cn-list{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.cn-item{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:var(--bg-2, rgba(127,127,127,.06));
  box-shadow:inset 0 0 0 1px var(--border)}
.cn-item .tx{flex:1;min-width:0;font-size:13.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.cn-item .mt{display:block;margin-top:3px;font-size:11.5px;color:var(--text-faint);white-space:normal}
.cn-item.off .tx{color:var(--text-dim)}
.cn-form{margin-top:10px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
.cn-form textarea{flex:1 1 260px;min-height:44px;resize:vertical}
.cn-act{flex:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:10px;font-size:12.5px;font-weight:600;
  color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);border:0;cursor:pointer;transition:box-shadow .2s,transform .16s}
.cn-act:hover{box-shadow:inset 0 0 0 1px var(--accent-line)}
.cn-act:active{transform:scale(.96)}
.cn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cn-more{margin-top:8px;background:none;border:0;padding:6px 0;color:var(--text-dim);font-size:12px;cursor:pointer}
.cn-more:hover{color:var(--text)}
@media (max-width:640px){
  .cn-form .btn{width:100%;justify-content:center;min-height:44px}
  .cn-form textarea{min-height:72px}
  .cn-item{flex-wrap:wrap}
  .cn-item .tx{flex-basis:100%}
  .cn-item .cn-act{margin-left:auto;height:40px}
}
`

export function CloserNotesPanel({ project }) {
  const { data, myId, projectStore, logActivity } = useApp()
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(false)
  const id = useId()
  const notes = normalizeCloserNotes(project)
  const open = notes.filter((n) => !n.resolvedAt)
  const done = notes.filter((n) => n.resolvedAt)
  const who = (uid) => (data.team || []).find((u) => u.id === uid)?.name || 'Alguien'
  const patch = (fn) => projectStore.patch(project.id, fn)

  const submit = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    patch((p) => ({ ...p, ...addCloserNote(p, { text: t, by: myId || null }) }))
    if (logActivity) logActivity({ type: 'closer_note', text: `le dejó una nota al closer de ${project.name}` })
    setText('')
  }

  const Item = ({ n }) => (
    <li className={`cn-item${n.resolvedAt ? ' off' : ''}`}>
      <div className="tx">
        {n.text}
        <span className="mt">
          {n.by ? who(n.by) : 'Sin registrar quién'}{n.at ? ` · ${fmtDay(n.at)}` : ''}
          {n.resolvedAt && <> · resuelta{n.resolvedBy ? ` por ${who(n.resolvedBy)}` : ''} el {fmtDay(n.resolvedAt)}</>}
        </span>
      </div>
      {n.resolvedAt
        ? <button type="button" className="cn-act" onClick={() => patch((p) => ({ ...p, ...reopenCloserNote(p, n.id) }))}>Reabrir</button>
        : <button type="button" className="cn-act" onClick={() => patch((p) => ({ ...p, ...resolveCloserNote(p, n.id, myId || null) }))}><I2.check width={13} height={13} /> Resuelta</button>}
    </li>
  )

  return (
    <section className="cn-panel" aria-labelledby={`${id}-t`}>
      <style>{CSS}</style>
      <div className="cn-head">
        <span className="pd-eyebrow" id={`${id}-t`}>Para el closer</span>
        <p>Lo que escribas acá le llega al closer que le vendió a este cliente, en Speed Funnels y como notificación.</p>
      </div>
      {open.length > 0 && <ul className="cn-list">{open.map((n) => <Item key={n.id} n={n} />)}</ul>}
      <form className="cn-form" onSubmit={submit}>
        <label htmlFor={`${id}-n`} className="cn-sr">Nota para el closer</label>
        <textarea id={`${id}-n`} className="input" rows={1} maxLength={CLOSER_NOTE_MAX} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e) }}
          placeholder="Ej.: quiere pagar la próxima cuota en dos partes; el 5/11 entregamos el módulo de pagos" />
        <button type="submit" className="btn btn-accent" disabled={!text.trim()}><I2.send width={14} height={14} /> Avisar al closer</button>
      </form>
      {done.length > 0 && (
        <>
          <button type="button" className="cn-more" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            {showDone ? 'Ocultar resueltas' : `Ver resueltas (${done.length})`}
          </button>
          {showDone && <ul className="cn-list">{done.map((n) => <Item key={n.id} n={n} />)}</ul>}
        </>
      )}
    </section>
  )
}
