import React, { useRef, useState } from 'react'
import { useApp } from '../ui.jsx'
import {
  esAdminClarity, clarityOn, claritySinEfecto, setClarity, instanciaDe, INSTANCIA_BOT, INSTANCIA_MANUEL,
} from '../lib/clarity.js'
import { useGrupoClarity, guardarInstancia } from '../lib/clarityGrupo.js'

const CSS = `
.ck{margin-top:16px;display:flex;align-items:flex-start;gap:14px 28px;flex-wrap:wrap}
.ck-blk{display:flex;flex-direction:column;gap:7px;min-width:0}
.ck-row{display:flex;align-items:center;gap:11px}
.ck-sw{--w:42px;position:relative;flex:none;width:var(--w);height:24px;border-radius:999px;background:var(--track,var(--border-strong));
  box-shadow:inset 0 0 0 1px var(--border-strong);transition:background .22s var(--e),box-shadow .22s var(--e)}
.ck-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--text);
  box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .26s cubic-bezier(.32,.72,0,1),background .2s var(--e)}
.ck-sw[aria-checked="true"]{background:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-line,var(--accent))}
.ck-sw[aria-checked="true"]::after{transform:translateX(18px);background:#fff}
.ck-sw:active::after{width:21px}
.ck-sw[aria-checked="true"]:active::after{transform:translateX(15px)}
.ck-sw:focus-visible,.ck-seg button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ck-sw:disabled{opacity:.6;cursor:default}
.ck-t{font-size:13px;font-weight:600;letter-spacing:-.01em}
.ck-d{font-size:12px;line-height:1.45;color:var(--text-dim);max-width:340px}
.ck-d[data-tone="warn"]{color:var(--yellow)}
.ck-err{font-size:12px;line-height:1.45;color:var(--red)}
.ck-seg{display:inline-flex;padding:3px;gap:2px;border-radius:11px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.ck-seg button{min-height:30px;padding:0 12px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--text-dim);
  transition:color .18s var(--e),background .18s var(--e),transform .16s var(--e)}
.ck-seg button:hover:not(:disabled):not([aria-checked="true"]){color:var(--text)}
.ck-seg button:active:not(:disabled){transform:scale(.97)}
.ck-seg button[aria-checked="true"]{color:var(--text);background:var(--bg-elevated);box-shadow:0 0 0 1px var(--border-strong),0 1px 2px rgba(0,0,0,.18)}
.ck-seg button:disabled{opacity:.45;cursor:default}
.ck-seg-sk{display:inline-block;width:206px;height:36px;border-radius:11px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
@media (max-width:640px){
  .ck-sw{--w:48px;height:28px}
  .ck-sw::after{top:3px;left:3px;width:22px;height:22px}
  .ck-sw[aria-checked="true"]::after{transform:translateX(20px)}
  .ck-sw[aria-checked="true"]:active::after{transform:translateX(17px)}
  .ck-sw:active::after{width:25px}
  .ck-seg button{min-height:40px;padding:0 14px}
  .ck-blk{flex:1 1 100%}
  .ck-seg{align-self:stretch}.ck-seg button{flex:1}
}
@media (prefers-reduced-motion: reduce){.ck-sw,.ck-sw::after,.ck-seg button{transition:none}.ck-sw:active::after{width:18px}}
`

/* Sólo existe para el mail de Manuel: para el resto no se monta nada (ni los estilos). */
export default function ClarityControl({ project, patch }) {
  const { sessionEmail } = useApp()
  if (!esAdminClarity(sessionEmail)) return null
  return <ClarityBody project={project} patch={patch} />
}

function ClarityBody({ project, patch }) {
  const { supabase } = useApp()
  const on = clarityOn(project)
  const { grupo, listo } = useGrupoClarity(supabase, project.id, true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const liveRef = useRef(project)
  liveRef.current = project

  const toggle = async () => {
    if (busy || !supabase) return
    setErr('')
    setBusy(true)
    const antes = { clarity: liveRef.current.clarity, clarityAt: liveRef.current.clarityAt }
    const saved = patch((p) => ({ ...p, ...setClarity(!clarityOn(p)) }))
    // El guardado de la ficha va con debounce y no avisa si la base lo rechaza: acá se escribe ya y se confirma.
    const { data, error } = await supabase.from('projects')
      .update({ data: saved, updated_at: saved.updatedAt }).eq('id', project.id).select('id')
    if (error || !data || data.length === 0) {
      patch((p) => ({ ...p, clarity: antes.clarity, clarityAt: antes.clarityAt }))
      setErr('No se pudo guardar el cambio. Probá de nuevo en un rato.')
    }
    setBusy(false)
  }

  const [igBusy, setIgBusy] = useState(false)
  const setInst = async (v) => {
    if (igBusy || !grupo || instanciaDe(grupo.clarity_instancia) === v) return
    setErr('')
    setIgBusy(true)
    const ok = await guardarInstancia(supabase, project.id, v)
    if (!ok) setErr('No se pudo cambiar el número. Probá de nuevo.')
    setIgBusy(false)
  }

  const inst = instanciaDe(grupo?.clarity_instancia)
  const sinEfecto = !on && claritySinEfecto(project)
  const desc = on
    ? (claritySinEfecto(project) ? 'Está marcado, pero en esta etapa Clarity no lo toma.' : 'Está en Clarity. Espera tu OK en el panel para arrancar.')
    : sinEfecto ? 'En esta etapa Clarity no lo toma, aunque lo prendas.'
    : 'Prendelo para sumarlo a Clarity. Queda esperando tu OK en el panel.'

  return (
    <div className="ck">
      <style>{CSS}</style>
      <div className="ck-blk">
        <span className="pd-eyebrow">Clarity</span>
        <div className="ck-row">
          <button type="button" role="switch" aria-checked={on} aria-labelledby="ck-t" aria-describedby="ck-d" className="ck-sw"
            onClick={toggle} disabled={busy} />
          <span id="ck-t" className="ck-t">{on ? 'Prendido' : 'Apagado'}</span>
        </div>
        <span id="ck-d" className="ck-d" data-tone={on && claritySinEfecto(project) ? 'warn' : undefined}>{desc}</span>
      </div>
      <div className="ck-blk">
        <span className="pd-eyebrow" id="ck-cd">Contesta desde</span>
        {!listo && !grupo ? <span className="ck-seg-sk" aria-hidden="true" /> : (
          <div className="ck-seg" role="radiogroup" aria-labelledby="ck-cd">
            {[[INSTANCIA_BOT, 'Bot de Clarity'], [INSTANCIA_MANUEL, 'Mi número']].map(([v, label]) => (
              <button key={String(v)} type="button" role="radio" aria-checked={!!grupo && inst === v}
                disabled={!grupo || igBusy} onClick={() => setInst(v)}>{label}</button>
            ))}
          </div>
        )}
        {listo && !grupo && <span className="ck-d">Falta vincular el grupo de WhatsApp de este proyecto.</span>}
        {grupo && <span className="ck-d">{grupo.group_name || 'Grupo vinculado'}</span>}
      </div>
      {err && <div className="ck-err" role="alert" style={{ flex: '1 1 100%' }}>{err}</div>}
    </div>
  )
}
