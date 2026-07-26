/**
 * AgentStudio.jsx — la sección "Agente" del generador de planes.
 *
 * Pantalla completa, dos columnas:
 *   IZQUIERDA · el contexto — lo que el usuario le da al agente (texto libre,
 *              un proyecto existente troceado en grupos, archivos y ajustes).
 *   DERECHA   · la corrida — Lectura (brief) → Plan (se arma en vivo) → Revisión
 *              (preview real + detalle + refinamiento por chat).
 *
 * Convención de la app: clases utilitarias de GLOBAL_CSS + style inline con
 * var(--token). El CSS propio (solo hover/press/keyframes) vive en STUDIO_CSS.
 *
 * Contrato con planAgent.js (congelado, lo implementa otro módulo).
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { I, uid, stagger, rise } from '../ui.jsx'
import {
  AGENT_MODELS, hasApiKey, projectContextGroups, buildContextText,
  runBrief, runPlan, runRefine, planFromDraft, draftSummary,
} from './planAgent.js'
import { buildPlanHTML } from './planTemplate.js'

/* ============================================================================
   CSS propio — SOLO lo que inline no puede: hover, press y keyframes.
============================================================================ */
const STUDIO_CSS = `
.as-wrap{display:flex;flex:1;min-height:0}
.as-left{flex:0 0 46%;max-width:620px;min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--border)}
.as-right{flex:1 1 54%;min-width:0;display:flex;flex-direction:column;background:var(--bg-elevated)}
.as-scroll{flex:1;min-height:0;overflow-y:auto}
.as-card{border:1px solid var(--border);border-radius:12px;background:var(--card);transition:border-color .16s,background .16s,box-shadow .16s}
.as-tap{transition:transform .12s ease,border-color .16s,background .16s}
.as-tap:hover{border-color:var(--border-strong);background:var(--card-hover)}
.as-tap:active{transform:scale(.988)}
.as-pick:hover{background:var(--card-hover)}
.as-on:hover{border-color:var(--accent)}
.as-drop{border:1.5px dashed var(--border-strong);border-radius:12px;transition:border-color .16s,background .16s}
.as-drop:hover{border-color:var(--accent-line);background:var(--accent-soft)}
.as-drop-on{border-color:var(--accent);background:var(--accent-soft)}
.as-seg{display:inline-flex;padding:3px;gap:3px;border:1px solid var(--border);border-radius:999px;background:var(--bg-elevated)}
.as-seg-b{padding:5px 12px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--text-dim);transition:background .16s,color .16s}
.as-seg-b:hover{color:var(--text)}
.as-seg-on{background:var(--card);color:var(--text);box-shadow:var(--shadow)}
.as-x:hover{background:var(--card-hover)}
.as-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid var(--border);background:var(--bg-elevated);font-size:12px;transition:border-color .16s,background .16s}
.as-chip:hover{border-color:var(--accent-line);background:var(--accent-soft)}
.as-big{width:100%;justify-content:center;padding:12px 18px;font-size:14.5px;border-radius:12px}
.as-big:disabled{opacity:.45;cursor:not-allowed}
.as-cbx{position:absolute;width:1px;height:1px;opacity:0;margin:0;pointer-events:none}
.as-cbx:focus-visible + .as-box{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
@keyframes as-breathe{0%,100%{opacity:.3;transform:scale(.82)}50%{opacity:1;transform:scale(1)}}
.as-dot{animation:as-breathe 1.15s ease-in-out infinite}
@keyframes as-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}
.as-beam{position:relative;overflow:hidden}
.as-beam::after{content:'';position:absolute;top:0;bottom:0;left:0;width:32%;background:linear-gradient(90deg,transparent,var(--accent-line),transparent);animation:as-sweep 1.6s linear infinite}
@keyframes as-turn{to{transform:rotate(360deg)}}
.as-turn{animation:as-turn 2.6s linear infinite}
@media (prefers-reduced-motion: reduce){
  .as-dot,.as-beam::after,.as-turn{animation:none}
}
@media(max-width:980px){
  .as-wrap{flex-direction:column}
  .as-left{flex:1 1 auto;max-width:none;border-right:none}
  .as-right{flex:1 1 auto}
}
`
function useStudioCss() {
  useEffect(() => {
    if (document.getElementById('agent-studio-css')) return
    const el = document.createElement('style')
    el.id = 'agent-studio-css'
    el.textContent = STUDIO_CSS
    document.head.appendChild(el)
  }, [])
}

/* ============================================================================
   Constantes y helpers de presentación
============================================================================ */
const MAX_FILE = 400 * 1024
const OK_EXT = ['.txt', '.md', '.json', '.csv']
const CTX_SOFT_CAP = 60000     // solo para pintar la barra del medidor
const MIN_CTX = 24             // mínimo de contexto para habilitar el botón
const REVIEW_KEY = 'agent_review_brief'

const PHASES = [
  { id: 'brief', label: 'Lectura' },
  { id: 'plan', label: 'Plan' },
  { id: 'review', label: 'Revisión' },
]
const PHASE_IX = { idle: -1, brief: 0, plan: 1, review: 2 }

const WEEK_TYPES = {
  info: { label: 'Avance semanal', color: 'var(--text-faint)' },
  doc: { label: 'Entregable documental', color: 'var(--blue)' },
  gate: { label: 'Gate de anticipo', color: 'var(--yellow)' },
  formal: { label: 'Entrega formal de hito', color: 'var(--green)' },
}
const STAGE_COLORS = ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--yellow)', 'var(--red)']

const EJEMPLOS_REFINE = [
  'Hacelo de 8 semanas',
  'Agregá una etapa de QA antes del cierre',
  'Más detalle en los entregables',
  'Menos tareas por semana, que respire',
]

/** "2,4k caracteres" — es-AR usa coma decimal. */
const fmtChars = (n) => {
  const v = Math.max(0, Math.trunc(Number(n) || 0))
  if (v < 1000) return `${v} caracteres`
  return `${(v / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}k caracteres`
}

const fmtBytes = (n) => {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} KB`
  return `${(v / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Una corrida cancelada por el usuario no es un error. */
const isAbort = (e) => !!e && (e.name === 'AbortError' || /abort/i.test(String((e && e.message) || '')))

/** Ícono propio (ui.jsx no tiene "capas"): las etapas del plan. */
const IcLayers = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3 3 7.5l9 4.5 9-4.5z" /><path d="m3 12.5 9 4.5 9-4.5" /><path d="m3 17 9 4.5 9-4.5" />
  </svg>
)

/** La etapa a la que pertenece la semana n (la primera que llega hasta ahí). */
function stageIndexForWeek(stages, n) {
  const list = Array.isArray(stages) ? stages : []
  for (let i = 0; i < list.length; i++) {
    const to = Number(list[i] && list[i].weekTo)
    if (Number.isFinite(to) && n <= to) return i
  }
  return list.length ? list.length - 1 : -1
}

/* ============================================================================
   Piezas chicas (afuera del render principal → no pierden foco al tipear)
============================================================================ */

/** Selector de dos o tres estados, en píldora. Se usa para calidad, vistas y tabs. */
function Seg({ value, onChange, options, title }) {
  return (
    <div className="as-seg" title={title}>
      {options.map((o) => (
        <button key={o.id} type="button" title={o.title || (typeof o.label === 'string' ? o.label : undefined)}
          className={`as-seg-b${value === o.id ? ' as-seg-on' : ''}`}
          onClick={() => onChange(o.id)}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

/** Checkbox real (accesible con teclado) con la cajita dibujada a mano. */
function Check({ on, onChange, label, title }) {
  return (
    <label className="click" title={title} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-dim)' }}>
      <input className="as-cbx" type="checkbox" checked={on} onChange={onChange} />
      <span className="as-box" style={{ width: 15, height: 15, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff', transition: 'background .16s,border-color .16s,box-shadow .16s', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent)' : 'transparent' }}>
        {on && <I.check width={9} height={9} />}
      </span>
      {label}
    </label>
  )
}

/** Banner de error de la corrida (nunca window.alert). */
function ErrBanner({ msg, onDismiss }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, background: 'var(--red-soft)', border: '1px solid var(--red)' }}>
      <I.alert width={15} height={15} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--red)' }}>{msg}</div>
      <button type="button" className="btn btn-sm btn-ghost as-x" title="Cerrar el aviso" onClick={onDismiss} style={{ padding: 4, color: 'var(--red)', flexShrink: 0 }}><I.x width={13} height={13} /></button>
    </div>
  )
}

/** Estado tranquilo cuando falta la API key: explica, no reta. */
function KeyState({ onRecheck }) {
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}><I.key width={15} height={15} /></span>
        <strong style={{ fontSize: 14 }}>Falta la API key de Anthropic</strong>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-dim)' }}>
        El agente escribe el plan con Claude, así que necesita tu key. Cargala en <strong style={{ color: 'var(--text)' }}>⚙ Ajustes</strong> (arriba a la derecha de la app) y volvé acá — el contexto que armaste se mantiene.
      </div>
      <button type="button" className="btn btn-sm" onClick={onRecheck} title="Volver a chequear si la key ya está cargada" style={{ marginTop: 12 }}><I.refresh width={13} height={13} /> Ya la cargué</button>
    </div>
  )
}

/** Los tres pasos de la corrida. */
function Stepper({ phase, busy }) {
  const cur = PHASE_IX[phase] != null ? PHASE_IX[phase] : -1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {PHASES.map((p, i) => {
        const done = i < cur
        const active = i === cur
        const col = done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--text-faint)'
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: col, whiteSpace: 'nowrap' }}>
              <span style={{ width: 17, height: 17, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0, border: `1px solid ${col}`, background: active || done ? col : 'transparent', color: active || done ? 'var(--bg)' : col }}>
                {done ? <I.check width={10} height={10} /> : <span className="mono" style={{ fontSize: 9.5, fontWeight: 700 }}>{i + 1}</span>}
              </span>
              {p.label}
              {active && busy && <span className="as-dot" style={{ width: 5, height: 5, borderRadius: 99, background: col }} />}
            </span>
            {i < PHASES.length - 1 && <span style={{ width: 22, height: 1, background: i < cur ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />}
          </div>
        )
      })}
    </div>
  )
}

/**
 * El agente pensando. Además de los tres puntitos de la app, muestra el stream
 * crudo cayendo (en mono, con fade) — deja ver que algo está pasando de verdad.
 */
function Thinking({ label, text }) {
  const boxRef = useRef(null)
  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight }, [text])
  return (
    <div className="as-card" style={{ padding: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <I.spark className="as-turn" width={16} height={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        <span style={{ display: 'inline-flex', gap: 4, marginLeft: 2 }}>
          {[0, 1, 2].map((i) => <span key={i} className="as-dot" style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--text-faint)', animationDelay: `${i * 0.18}s` }} />)}
        </span>
      </div>
      <div className="as-beam" style={{ height: 2, borderRadius: 99, background: 'var(--border)', margin: '12px 0' }} />
      {text ? (
        <div ref={boxRef} className="mono fade-edge scroll-y" style={{ height: 96, overflowY: 'auto', fontSize: 10.5, lineHeight: 1.65, color: 'var(--text-faint)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text.slice(-1400)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[92, 74, 84].map((w, i) => <div key={i} className="skel" style={{ height: 9, width: `${w}%` }} />)}
        </div>
      )}
    </div>
  )
}

/** Lista con viñetas para las tarjetas del brief. */
function Bullets({ items, color }) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean)
  if (!list.length) return <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Nada para destacar.</div>
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {list.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)' }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: color || 'var(--text-faint)', flexShrink: 0, marginTop: 7 }} />
          <span style={{ minWidth: 0 }}>{String(t)}</span>
        </li>
      ))}
    </ul>
  )
}

/** El brief que devuelve la lectura, en tarjetas. */
function BriefCards({ brief, reduce }) {
  const etapas = Array.isArray(brief.etapasSugeridas) ? brief.etapasSugeridas.filter(Boolean) : []
  const cards = [
    { k: 'alcance', title: 'Alcance', items: brief.alcance, color: 'var(--accent)' },
    { k: 'supuestos', title: 'Supuestos', items: brief.supuestos, color: 'var(--blue)' },
    { k: 'riesgos', title: 'Riesgos', items: brief.riesgos, color: 'var(--red)' },
    { k: 'preguntas', title: 'Preguntas abiertas', items: brief.preguntas, color: 'var(--yellow)' },
  ]
  return (
    <motion.div variants={stagger} initial={reduce ? false : 'hidden'} animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <motion.div variants={rise} className="as-card" style={{ padding: '15px 17px', borderLeft: '3px solid var(--accent)' }}>
        <div className="label" style={{ marginBottom: 7 }}>Objetivo</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, fontWeight: 500 }}>{brief.objetivo || 'El agente no dejó claro el objetivo. Contale un poco más y volvé a generar.'}</div>
      </motion.div>

      <motion.div variants={rise} style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {brief.semanasSugeridas ? (
          <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-line)' }} title="Duración que propone el agente">
            <I.calendar width={12} height={12} />{brief.semanasSugeridas} semanas
          </span>
        ) : null}
        {etapas.map((e, i) => (
          <span key={i} className="tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)', borderColor: 'var(--border)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: STAGE_COLORS[i % STAGE_COLORS.length] }} />{String(e)}
          </span>
        ))}
      </motion.div>

      <motion.div variants={rise} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.k} className="as-card" style={{ padding: '13px 15px' }}>
            <div className="label" style={{ marginBottom: 9 }}>{c.title}</div>
            <Bullets items={c.items} color={c.color} />
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

/** Una semana del draft: número, etapa, tipo, tareas y entregable. */
function WeekRow({ w, stages, reduce }) {
  const si = stageIndexForWeek(stages, Number(w.n))
  const stage = si >= 0 ? stages[si] : null
  const col = si >= 0 ? STAGE_COLORS[si % STAGE_COLORS.length] : 'var(--text-faint)'
  const type = WEEK_TYPES[w.type] || WEEK_TYPES.info
  const tasks = Array.isArray(w.tasks) ? w.tasks : []
  const deliver = w.deliver && w.deliver.text ? w.deliver : null
  return (
    <motion.div variants={rise} initial={reduce ? false : 'hidden'} animate="show" className="as-card" style={{ padding: '12px 14px', borderLeft: `3px solid ${col}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: col, flexShrink: 0 }}>S{w.n}</span>
        <strong style={{ fontSize: 13.5, minWidth: 0 }}>{w.title || 'Sin título'}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: type.color, whiteSpace: 'nowrap' }} title={`Tipo de semana: ${type.label}`}>{type.label}</span>
      </div>
      {stage && stage.title ? <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>{stage.title}</div> : null}
      {tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }} title={t && t.criterio ? `Criterio: ${t.criterio}` : undefined}>
              <span style={{ width: 4, height: 4, borderRadius: 99, background: 'var(--text-faint)', flexShrink: 0, marginTop: 7 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-dim)', minWidth: 0, flex: 1 }}>{(t && t.text) || String(t || '')}</span>
              {t && t.responsable ? (
                <span className="tag" style={{ flexShrink: 0, fontSize: 10, padding: '1px 7px', background: 'var(--bg-elevated)', color: 'var(--text-faint)', borderColor: 'var(--border)' }}>{t.responsable}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {deliver && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
          <I.flag width={12} height={12} style={{ color: col, flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-dim)' }}>{deliver.text}</span>
        </div>
      )}
    </motion.div>
  )
}

/** El plan armándose (o el detalle en revisión): etapas + semanas. */
function PlanStream({ draft, reduce }) {
  const stages = (draft && Array.isArray(draft.stages) ? draft.stages : [])
  const weeks = (draft && Array.isArray(draft.weeks) ? draft.weeks : [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {draft && draft.title ? (
        <div className="as-card" style={{ padding: '13px 15px' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{draft.title}</div>
          {draft.subtitle ? <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>{draft.subtitle}</div> : null}
          {draft.lead ? <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.6 }}>{draft.lead}</div> : null}
        </div>
      ) : null}

      {stages.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {stages.map((s, i) => (
            <span key={i} className="tag" title={s.description || undefined}
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)', borderColor: 'var(--border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
              {s.title || `Etapa ${i + 1}`}
              <span className="mono" style={{ color: 'var(--text-faint)', fontWeight: 500 }}>→ S{s.weekTo}</span>
            </span>
          ))}
        </div>
      )}

      {weeks.map((w, i) => <WeekRow key={w.n != null ? w.n : i} w={w} stages={stages} reduce={reduce} />)}
    </div>
  )
}

/** Tira de números del draft terminado. */
function StatStrip({ sum }) {
  const cells = [
    { k: 'Etapas', v: sum.stages },
    { k: 'Semanas', v: sum.weeks },
    { k: 'Tareas', v: sum.tasks },
    { k: 'Entregables', v: sum.deliverables },
    { k: 'Del cliente', v: sum.clientTasks, title: 'Tareas cuyo responsable es el cliente' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(88px,1fr))', gap: 8 }}>
      {cells.map((c) => (
        <div key={c.k} className="as-card" title={c.title || undefined} style={{ padding: '10px 12px', background: 'var(--card)' }}>
          <div className="mono" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>{Number(c.v) || 0}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 3 }}>{c.k}</div>
        </div>
      ))}
    </div>
  )
}

/** Tarjeta de un grupo de contexto del proyecto (prendible / apagable). */
function GroupCard({ g, on, onToggle, reduce }) {
  return (
    <motion.button variants={rise} type="button" whileHover={reduce ? undefined : { y: -2 }} onClick={onToggle}
      title={on ? 'Sacar este bloque del contexto' : 'Sumar este bloque al contexto'}
      className={`as-card as-tap${on ? ' as-on' : ''}`}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%', padding: '11px 12px',
        borderColor: on ? 'var(--accent-line)' : 'var(--border)', background: on ? 'var(--accent-soft)' : 'var(--card)', opacity: on ? 1 : 0.62,
      }}>
      <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 1, display: 'grid', placeItems: 'center', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent)' : 'transparent', color: '#fff' }}>
        {on && <I.check width={10} height={10} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{g.label}</span>
        {g.hint ? <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2, lineHeight: 1.45 }}>{g.hint}</span> : null}
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', flexShrink: 0, marginTop: 2 }}>{fmtChars(g.chars)}</span>
    </motion.button>
  )
}

/** Bloque plegable con título (para Ajustes). */
function Fold({ title, sub, icon, open, onToggle, children }) {
  return (
    <div className="as-card" style={{ overflow: 'hidden' }}>
      <button type="button" className="as-pick" onClick={onToggle} title={open ? 'Ocultar' : 'Mostrar'}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '11px 13px', background: 'transparent' }}>
        {open ? <I.chevD width={15} height={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} /> : <I.chevR width={15} height={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
        {icon}
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
        {sub ? <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span> : null}
      </button>
      {open && <div style={{ padding: '4px 13px 14px', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  )
}

/** Título de sección de la columna izquierda. */
function SecTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '22px 0 10px' }}>
      <span className="label">{children}</span>
      {right ? <span style={{ marginLeft: 'auto' }}>{right}</span> : null}
    </div>
  )
}

/* ============================================================================
   AGENT STUDIO
============================================================================ */
export default function AgentStudio({ open, onClose, projects, clients, calls, team, basePlan, onCreate, onApply }) {
  useStudioCss()
  const reduce = useReducedMotion()

  /* ---- contexto ---- */
  const [freeText, setFreeText] = useState('')
  const [pickedId, setPickedId] = useState(null)
  const [groups, setGroups] = useState([])
  const [groupOn, setGroupOn] = useState({})
  const [projQuery, setProjQuery] = useState('')
  const [ctxErr, setCtxErr] = useState('')
  const [files, setFiles] = useState([])
  const [fileErr, setFileErr] = useState('')
  const [dragOn, setDragOn] = useState(false)
  const [foldOpen, setFoldOpen] = useState(false)
  const [opts, setOpts] = useState({ model: 'fast', weeks: '', clientName: '', startDate: '', notes: '' })

  /* ---- corrida ---- */
  const [phase, setPhase] = useState('idle')          // idle · brief · plan · review
  const [busy, setBusy] = useState(null)              // null · brief · plan · refine
  const [streamText, setStreamText] = useState('')
  const [brief, setBrief] = useState(null)
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState(null)
  const [noKey, setNoKey] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [history, setHistory] = useState([])
  const [instr, setInstr] = useState('')
  const [view, setView] = useState('preview')         // preview · detalle
  const [reviewFirst, setReviewFirst] = useState(() => {
    try { return window.localStorage.getItem(REVIEW_KEY) === '1' } catch (e) { return false }
  })

  /* ---- ui ---- */
  const [narrow, setNarrow] = useState(false)
  const [tab, setTab] = useState('ctx')               // solo en mobile: ctx · run
  const [keyTick, setKeyTick] = useState(0)

  const runRef = useRef({ ctrl: null, cancelled: false })
  const aliveRef = useRef(true)
  const taRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => () => { aliveRef.current = false }, [])

  /* -------------------------------------------------------------- contexto */
  const activeGroups = useMemo(() => groups.filter((g) => groupOn[g.id]), [groups, groupOn])

  const contextText = useMemo(() => {
    try {
      return buildContextText({ freeText, groups: activeGroups, files, basePlan }) || ''
    } catch (e) {
      return freeText || ''
    }
  }, [freeText, activeGroups, files, basePlan])

  const options = useMemo(() => {
    const w = String(opts.weeks).trim()
    const n = w === '' ? null : Math.trunc(Number(w))
    return {
      model: opts.model,
      weeks: Number.isFinite(n) && n > 0 ? n : null,
      clientName: opts.clientName.trim(),
      startDate: opts.startDate,
      notes: opts.notes.trim(),
    }
  }, [opts])

  const keyOk = useMemo(() => {
    try { return !!hasApiKey() } catch (e) { return false }
  }, [open, keyTick])

  const enoughCtx = contextText.trim().length >= MIN_CTX
  const canRun = keyOk && enoughCtx && !busy

  /* ------------------------------------------------------------- proyectos */
  const projList = useMemo(() => {
    const all = Array.isArray(projects) ? projects : []
    const q = projQuery.trim().toLowerCase()
    if (!q) return all
    return all.filter((p) => String(p.name || '').toLowerCase().includes(q))
  }, [projects, projQuery])

  const picked = useMemo(() => (Array.isArray(projects) ? projects.find((p) => p.id === pickedId) : null) || null, [projects, pickedId])

  const pickProject = (p) => {
    if (!p) return
    setCtxErr('')
    if (p.id === pickedId) { setPickedId(null); setGroups([]); setGroupOn({}); return }
    setPickedId(p.id)
    try {
      const gs = projectContextGroups(p, { clients, calls, team }) || []
      setGroups(gs)
      const on = {}
      gs.forEach((g) => { on[g.id] = true })
      setGroupOn(on)
    } catch (e) {
      setGroups([]); setGroupOn({})
      setCtxErr('No pude leer el contexto de ese proyecto. Probá con otro o contame vos de qué se trata.')
    }
    const c = (Array.isArray(clients) ? clients : []).find((x) => x.id === p.clientId)
    const name = (c && (c.company || c.name)) || ''
    if (name) setOpts((o) => (o.clientName ? o : { ...o, clientName: name }))
  }

  /* --------------------------------------------------------------- archivos */
  const addFiles = (list) => {
    const arr = Array.from(list || [])
    if (!arr.length) return
    setFileErr('')
    arr.forEach((f) => {
      const ext = String(f.name || '').toLowerCase().slice(String(f.name || '').lastIndexOf('.'))
      if (!OK_EXT.includes(ext)) {
        setFileErr(`«${f.name}» no se puede leer. Solo texto: .txt, .md, .json o .csv (los PDF no van).`)
        return
      }
      if (f.size > MAX_FILE) {
        setFileErr(`«${f.name}» pesa ${fmtBytes(f.size)} y el límite es 400 KB. Pegá la parte que importa en el cuadro de arriba.`)
        return
      }
      const r = new FileReader()
      r.onload = () => {
        if (!aliveRef.current) return
        setFiles((prev) => [...prev, { id: uid(), name: f.name, size: f.size, text: String(r.result || '') }])
      }
      r.onerror = () => { if (aliveRef.current) setFileErr(`No pude leer «${f.name}».`) }
      r.readAsText(f)
    })
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOn(false)
    addFiles(e.dataTransfer && e.dataTransfer.files)
  }

  /* ---------------------------------------------------------------- corrida */
  const stopRun = useCallback(() => {
    const r = runRef.current
    if (r.ctrl) { r.cancelled = true; r.ctrl.abort(); r.ctrl = null }
  }, [])

  /**
   * ¿Esta corrida sigue siendo LA corrida? Si el usuario cortó y arrancó otra,
   * la vieja termina igual (la promesa ya estaba en vuelo) — pero no tiene que
   * tocar ni el estado ni el AbortController de la nueva.
   */
  const owns = useCallback((run) => runRef.current === run && !run.cancelled && aliveRef.current, [])

  const cancel = useCallback(() => {
    stopRun()
    setBusy(null)
    setCancelled(true)
    setPhase((p) => (p === 'brief' && !brief ? 'idle' : p))
  }, [stopRun, brief])

  const resetRun = useCallback(() => {
    stopRun()
    setPhase('idle'); setBusy(null); setBrief(null); setDraft(null)
    setStreamText(''); setErr(null); setCancelled(false); setHistory([]); setInstr('')
  }, [stopRun])

  /** Fase 2: arma el plan. Se llama sola después de la lectura, o a mano. */
  const goPlan = useCallback(async (b, ctx) => {
    const run = runRef.current
    if (!run.ctrl) return
    setPhase('plan'); setBusy('plan'); setDraft(null); setStreamText('')
    try {
      const d = await runPlan({
        contextText: ctx, brief: b, options, signal: run.ctrl.signal,
        onPartial: (partial) => { if (owns(run)) setDraft(partial) },
      })
      if (!owns(run)) return
      run.ctrl = null
      setDraft(d); setPhase('review'); setView('preview'); setBusy(null)
    } catch (e) {
      if (!owns(run)) return
      run.ctrl = null
      setBusy(null)
      if (isAbort(e)) return
      if (String(e && e.message) === 'NO_KEY') { setNoKey(true); return }
      setErr(`No se pudo armar el plan. ${(e && e.message) || 'Probá de nuevo.'}`)
    }
  }, [options, owns])

  /** Fase 1: lectura del contexto. */
  const start = useCallback(async () => {
    if (!keyOk) { setNoKey(true); return }
    if (!enoughCtx || busy) return
    stopRun()
    const run = { ctrl: new AbortController(), cancelled: false }
    runRef.current = run
    const ctx = contextText
    setErr(null); setNoKey(false); setCancelled(false); setHistory([])
    setBrief(null); setDraft(null); setStreamText('')
    setPhase('brief'); setBusy('brief')
    if (narrow) setTab('run')
    try {
      const b = await runBrief({
        contextText: ctx, options, signal: run.ctrl.signal,
        onDelta: (t) => { if (owns(run)) setStreamText(String(t || '')) },
      })
      if (!owns(run)) return
      setBrief(b); setStreamText('')
      if (reviewFirst) { run.ctrl = null; setBusy(null); return }
      await goPlan(b, ctx)
    } catch (e) {
      if (!owns(run)) return
      run.ctrl = null
      setBusy(null)
      if (isAbort(e)) return
      if (String(e && e.message) === 'NO_KEY') { setNoKey(true); setPhase('idle'); return }
      setErr(`No se pudo leer el contexto. ${(e && e.message) || 'Probá de nuevo.'}`)
    }
  }, [keyOk, enoughCtx, busy, stopRun, owns, contextText, options, narrow, reviewFirst, goPlan])

  /** Continuar a mano cuando "Revisar antes de generar" está prendido. */
  const continueToPlan = useCallback(() => {
    if (!brief || busy) return
    stopRun()
    runRef.current = { ctrl: new AbortController(), cancelled: false }
    setCancelled(false); setErr(null)
    goPlan(brief, contextText)
  }, [brief, busy, stopRun, goPlan, contextText])

  /** Refinamiento por chat sobre el draft actual. */
  const refine = useCallback(async (text) => {
    const instruction = String(text || '').trim()
    if (!instruction || !draft || busy) return
    stopRun()
    const run = { ctrl: new AbortController(), cancelled: false }
    runRef.current = run
    setInstr(''); setErr(null); setCancelled(false)
    setHistory((h) => [...h, instruction])
    setBusy('refine')
    try {
      const d = await runRefine({
        draft, instruction, contextText, options, signal: run.ctrl.signal,
        onPartial: (partial) => { if (owns(run)) setDraft(partial) },
      })
      if (!owns(run)) return
      run.ctrl = null
      setDraft(d); setBusy(null)
    } catch (e) {
      if (!owns(run)) return
      run.ctrl = null
      setBusy(null)
      if (isAbort(e)) return
      if (String(e && e.message) === 'NO_KEY') { setNoKey(true); return }
      setErr(`No pude aplicar el cambio. ${(e && e.message) || 'Probá de nuevo.'}`)
    }
  }, [draft, busy, stopRun, owns, contextText, options])

  /* ------------------------------------------------------------- resultado */
  const summary = useMemo(() => {
    if (!draft) return null
    try { return draftSummary(draft) } catch (e) { return null }
  }, [draft])

  const wantPreview = phase === 'review' && view === 'preview' && !!draft

  const html = useMemo(() => {
    if (!wantPreview) return ''
    try {
      return buildPlanHTML(planFromDraft(draft, basePlan), { preview: true })
    } catch (e) {
      const msg = String((e && e.message) || e)
      return `<!doctype html><html><body style="font-family:system-ui;background:#0d0d0d;color:#eee;padding:40px"><h2 style="font-size:17px">No se pudo dibujar la vista previa</h2><pre style="white-space:pre-wrap;color:#f88;font-size:12px">${msg}</pre></body></html>`
    }
  }, [wantPreview, draft, basePlan])

  const [debHtml, setDebHtml] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { if (aliveRef.current) setDebHtml(html) }, 250)
    return () => clearTimeout(t)
  }, [html])

  const finish = () => {
    if (!draft) return
    let plan = null
    try {
      plan = planFromDraft(draft, basePlan)
    } catch (e) {
      setErr(`No pude convertir el borrador en un plan. ${(e && e.message) || ''}`)
      return
    }
    if (basePlan) {
      const n = (draft.weeks || []).length
      const ok = window.confirm(
        `Vas a reemplazar el contenido de "${basePlan.title || 'este plan'}" con el plan que generó el agente.\n\n` +
        `Se pisan la portada, las etapas y las semanas actuales por las ${n} semana${n === 1 ? '' : 's'} nuevas.\n\n` +
        `Esto no se puede deshacer. ¿Aplicar?`,
      )
      if (!ok) return
      if (typeof onApply === 'function') onApply(plan)
    } else if (typeof onCreate === 'function') {
      onCreate(plan)
    }
    resetRun()
  }

  /** Tirar el borrador. Avisa porque no se puede deshacer. */
  const discard = () => {
    if (draft && !window.confirm('Se tira el plan generado y volvés al inicio. El contexto que cargaste se mantiene.\n\n¿Descartar?')) return
    resetRun()
  }

  /* ------------------------------------------------------------ ciclo de vida */
  const tryClose = useCallback(() => {
    if (busy) {
      if (!window.confirm('El agente está trabajando ahora mismo. Si cerrás, se cancela la corrida.\n\n¿Cerrar igual?')) return
      stopRun()
    } else if (draft) {
      if (!window.confirm('Tenés un plan generado sin aplicar. Si cerrás, se pierde.\n\n¿Cerrar igual?')) return
    }
    resetRun()
    if (typeof onClose === 'function') onClose()
  }, [busy, draft, stopRun, resetRun, onClose])

  // Atajos: Escape cierra, Cmd/Ctrl+Enter genera. Con ref para no re-suscribir
  // el listener en cada render.
  const kbRef = useRef({})
  kbRef.current = { tryClose, start, canRun }
  useEffect(() => {
    if (!open) return undefined
    const h = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); kbRef.current.tryClose(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (kbRef.current.canRun) kbRef.current.start()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  // Cerrar (o desmontar) corta cualquier corrida en vuelo.
  useEffect(() => { if (!open) stopRun() }, [open, stopRun])
  useEffect(() => () => stopRun(), [stopRun])

  // Una sola columna abajo de 980px → las fases pasan a ser pestañas.
  useEffect(() => {
    if (!open) return undefined
    const mq = window.matchMedia('(max-width: 980px)')
    const on = () => setNarrow(mq.matches)
    on()
    if (mq.addEventListener) mq.addEventListener('change', on)
    else mq.addListener(on)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', on)
      else mq.removeListener(on)
    }
  }, [open])

  // Textarea que crece sola con el texto.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 420)}px`
  }, [freeText, open, tab, narrow])

  const toggleReviewFirst = () => {
    setReviewFirst((v) => {
      const next = !v
      try { window.localStorage.setItem(REVIEW_KEY, next ? '1' : '0') } catch (e) { /* sin localStorage, se pierde y listo */ }
      return next
    })
  }

  const ctxLen = contextText.trim().length
  const meterPct = Math.min(100, Math.round((ctxLen / CTX_SOFT_CAP) * 100))
  const showLeft = !narrow || tab === 'ctx'
  const showRight = !narrow || tab === 'run'

  /* ============================================================== RENDER */
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) tryClose() }}>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="surface"
            style={{
              position: 'absolute', inset: narrow ? 0 : 24, borderRadius: narrow ? 0 : 16,
              display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow)',
            }}>

            {/* ---------- BARRA SUPERIOR ---------- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span className="tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)', borderColor: 'var(--border)', maxWidth: 320, overflow: 'hidden' }}>
                <I.doc width={12} height={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {basePlan ? `Sobre "${basePlan.title || 'el plan abierto'}"` : 'Plan nuevo'}
                </span>
              </span>

              {narrow && (
                <div style={{ marginLeft: 'auto' }}>
                  <Seg value={tab} onChange={setTab} options={[
                    { id: 'ctx', label: 'Contexto', title: 'Lo que le das al agente' },
                    {
                      id: 'run',
                      title: 'Lo que hace el agente',
                      label: (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          Agente
                          {(busy || err) && <span className={busy ? 'as-dot' : undefined} style={{ width: 5, height: 5, borderRadius: 99, background: err ? 'var(--red)' : 'var(--accent)' }} />}
                        </span>
                      ),
                    },
                  ]} />
                </div>
              )}

              <button type="button" className="btn btn-sm btn-ghost as-x" title="Cerrar (Esc)" onClick={tryClose}
                style={{ marginLeft: narrow ? 0 : 'auto', padding: 6, flexShrink: 0 }}>
                <I.x width={16} height={16} />
              </button>
            </div>

            <div className="as-wrap">
              {/* ================================================================
                  IZQUIERDA · EL CONTEXTO
              ================================================================ */}
              {showLeft && (
                <div className="as-left">
                  <div className="as-scroll" style={{ padding: '20px 22px 26px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                        <I.spark width={19} height={19} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ fontSize: 20 }}>Agente</h2>
                        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 1 }}>Contame el proyecto y armo el plan</div>
                      </div>
                    </div>

                    {/* ---- texto libre ---- */}
                    <div style={{ marginTop: 16 }}>
                      <textarea
                        ref={taRef} className="input" value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        placeholder={'Ej: RDEX es un marketplace de compraventa de propiedades en Miami. Ya tienen la landing y el CRM andando; ahora quieren la app de agentes: login, carga de propiedades con fotos, matching con compradores y firma digital. Arrancamos el 4 de agosto, el cliente quiere ver algo funcionando antes de fin de mes y el presupuesto se libera por hitos.'}
                        style={{ minHeight: 180, resize: 'none', overflow: 'auto', fontSize: 14.5, lineHeight: 1.6, padding: '14px 15px', borderRadius: 14 }} />
                    </div>

                    {/* ---- proyecto existente ---- */}
                    <SecTitle right={picked ? (
                      <button type="button" className="btn btn-sm btn-ghost" title="Sacar el proyecto del contexto"
                        onClick={() => { setPickedId(null); setGroups([]); setGroupOn({}); setCtxErr('') }}
                        style={{ padding: '3px 7px', color: 'var(--text-faint)' }}>Quitar</button>
                    ) : null}>Cargar un proyecto</SecTitle>

                    {ctxErr && <div style={{ fontSize: 12.5, color: 'var(--red)', lineHeight: 1.5, marginBottom: 9 }}>{ctxErr}</div>}

                    {!picked && (
                      <>
                        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.55, marginBottom: 10 }}>
                          Elegí uno y el agente arranca con todo lo que la app ya sabe: ficha, sprints, pendientes, riesgos, llamadas y cliente.
                        </div>
                        {(Array.isArray(projects) ? projects.length : 0) > 6 && (
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <I.search width={14} height={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-faint)' }} />
                            <input className="input" value={projQuery} onChange={(e) => setProjQuery(e.target.value)}
                              placeholder="Buscar proyecto…" style={{ paddingLeft: 32 }} />
                          </div>
                        )}
                        <div className="scroll-y" style={{ maxHeight: 210, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elevated)' }}>
                          {projList.length === 0 && (
                            <div style={{ padding: '14px 13px', fontSize: 12.5, color: 'var(--text-faint)' }}>
                              {(Array.isArray(projects) ? projects.length : 0) === 0 ? 'Todavía no hay proyectos cargados en la app.' : 'Ningún proyecto coincide con esa búsqueda.'}
                            </div>
                          )}
                          {projList.map((p) => (
                            <button key={p.id} type="button" className="as-pick" onClick={() => pickProject(p)}
                              title={`Cargar el contexto de ${p.name || 'este proyecto'}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', borderBottom: '1px solid var(--border)' }}>
                              <I.folder width={14} height={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || 'Sin nombre'}</span>
                              <I.chevR width={13} height={13} style={{ marginLeft: 'auto', color: 'var(--text-faint)', flexShrink: 0 }} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {picked && (
                      <>
                        <div className="as-card" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', marginBottom: 10, borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}>
                          <I.folder width={15} height={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picked.name || 'Sin nombre'}</span>
                        </div>
                        {groups.length === 0 ? (
                          <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Este proyecto no tiene información cargada todavía. Contale vos de qué se trata.</div>
                        ) : (
                          <motion.div variants={stagger} initial={reduce ? false : 'hidden'} animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {groups.map((g) => (
                              <GroupCard key={g.id} g={g} reduce={reduce} on={!!groupOn[g.id]}
                                onToggle={() => setGroupOn((s) => ({ ...s, [g.id]: !s[g.id] }))} />
                            ))}
                          </motion.div>
                        )}
                      </>
                    )}

                    {/* ---- archivos ---- */}
                    <SecTitle>Archivos</SecTitle>
                    <div
                      className={`as-drop${dragOn ? ' as-drop-on' : ''} click`}
                      onDragOver={(e) => { e.preventDefault(); setDragOn(true) }}
                      onDragLeave={() => setDragOn(false)}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      title="Arrastrá archivos de texto o hacé clic para elegirlos"
                      style={{ padding: '18px 14px', textAlign: 'center' }}>
                      <I.paperclip width={17} height={17} style={{ color: 'var(--text-faint)' }} />
                      <div style={{ fontSize: 13, marginTop: 7, fontWeight: 600 }}>Arrastrá archivos acá o elegilos</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>Texto plano: .txt, .md, .json o .csv · hasta 400 KB. Los PDF no se leen — pegá el texto arriba.</div>
                      <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.json,.csv" style={{ display: 'none' }}
                        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                    </div>
                    {fileErr && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, lineHeight: 1.5 }}>{fileErr}</div>}
                    {files.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                        {files.map((f) => (
                          <span key={f.id} className="as-chip" title={`${f.name} · ${fmtBytes(f.size)}`}>
                            <I.doc width={12} height={12} style={{ color: 'var(--text-faint)' }} />
                            <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{fmtBytes(f.size)}</span>
                            <button type="button" title="Quitar el archivo" onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                              style={{ display: 'grid', placeItems: 'center', color: 'var(--text-faint)', padding: 0 }}><I.x width={11} height={11} /></button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ---- ajustes ---- */}
                    <SecTitle>Ajustes</SecTitle>
                    <Fold title="Duración, cliente y calidad" open={foldOpen} onToggle={() => setFoldOpen((v) => !v)}
                      icon={<I.gear width={14} height={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />}
                      sub={`${options.weeks ? `${options.weeks} sem` : 'auto'} · ${opts.model === 'max' ? 'máxima' : 'rápido'}`}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span className="label">Duración</span>
                          <input className="input" type="number" min="1" max="52" value={opts.weeks}
                            onChange={(e) => setOpts((o) => ({ ...o, weeks: e.target.value }))}
                            placeholder="Que lo decida el agente" title="Cantidad de semanas. Vacío = lo decide el agente" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span className="label">Nombre del cliente</span>
                          <input className="input" value={opts.clientName}
                            onChange={(e) => setOpts((o) => ({ ...o, clientName: e.target.value }))} placeholder="Real Deal Exchange" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span className="label">Fecha de inicio</span>
                          <input className="input" type="date" value={opts.startDate}
                            onChange={(e) => setOpts((o) => ({ ...o, startDate: e.target.value }))} />
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <span className="label">Calidad</span>
                        <div style={{ marginTop: 6 }}>
                          <Seg value={opts.model} onChange={(m) => setOpts((o) => ({ ...o, model: m }))}
                            options={[
                              { id: 'fast', label: 'Rápido', title: (AGENT_MODELS && AGENT_MODELS.fast) ? String(AGENT_MODELS.fast) : 'Modelo rápido' },
                              { id: 'max', label: 'Máxima calidad', title: (AGENT_MODELS && AGENT_MODELS.max) ? String(AGENT_MODELS.max) : 'Modelo de máxima calidad' },
                            ]} />
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 7, lineHeight: 1.5 }}>
                          Rápido tarda menos y alcanza para la mayoría. Máxima calidad piensa más y afina las tareas y los entregables.
                        </div>
                      </div>

                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span className="label">Notas para el agente</span>
                        <input className="input" value={opts.notes}
                          onChange={(e) => setOpts((o) => ({ ...o, notes: e.target.value }))}
                          placeholder="Ej: el cliente hace QA los viernes, evitá entregas ese día" />
                      </div>
                    </Fold>
                  </div>

                  {/* ---- pie: medidor + CTA ---- */}
                  <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '13px 22px 16px', background: 'var(--card)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ width: `${meterPct}%`, height: '100%', borderRadius: 99, background: 'var(--accent)', transition: 'width .3s ease' }} />
                      </div>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}
                        title="Todo lo que se le manda al agente: tu texto, los bloques del proyecto y los archivos">
                        ~{fmtChars(ctxLen)} de contexto
                      </span>
                    </div>

                    {noKey || !keyOk ? (
                      <KeyState onRecheck={() => { setKeyTick((t) => t + 1); setNoKey(false) }} />
                    ) : (
                      <>
                        <button type="button" className="btn btn-accent as-big" onClick={start} disabled={!canRun}
                          title={!enoughCtx ? 'Todavía no hay contexto suficiente' : busy ? 'El agente ya está trabajando' : 'Generar el plan (Cmd/Ctrl + Enter)'}>
                          <I.spark width={16} height={16} /> {busy ? 'El agente está trabajando…' : 'Generar plan'}
                        </button>
                        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
                          {enoughCtx
                            ? <>Atajo: <span className="kbd">Cmd/Ctrl</span> <span className="kbd">Enter</span></>
                            : 'Contame algo del proyecto o cargá uno para poder generar.'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ================================================================
                  DERECHA · LA CORRIDA
              ================================================================ */}
              {showRight && (
                <div className="as-right">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
                    <Stepper phase={phase} busy={busy} />
                    {busy && (
                      <button type="button" className="btn btn-sm" onClick={cancel} title="Cortar la corrida ahora"
                        style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>
                        <I.pause width={12} height={12} /> Cancelar
                      </button>
                    )}
                    {!busy && phase === 'plan' && draft && (
                      <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
                        {(draft.weeks || []).length} semanas
                      </span>
                    )}
                  </div>

                  <div className="as-scroll" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                    {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}

                    {cancelled && !busy && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', flexWrap: 'wrap' }}>
                        <I.pause width={13} height={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Cortaste la corrida.</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                          {draft && (draft.weeks || []).length > 0 && phase !== 'review' && (
                            <button type="button" className="btn btn-sm" title="Quedarse con lo que ya generó"
                              onClick={() => { setCancelled(false); setPhase('review'); setView('preview') }}>Seguir con esto</button>
                          )}
                          <button type="button" className="btn btn-sm" onClick={start} disabled={!canRun}><I.refresh width={12} height={12} /> Volver a generar</button>
                        </div>
                      </div>
                    )}

                    {/* ---------- IDLE ---------- */}
                    {phase === 'idle' && !busy && (
                      <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 380, padding: '30px 0' }}>
                        <span style={{ width: 46, height: 46, borderRadius: 15, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', margin: '0 auto 14px' }}>
                          <IcLayers width={22} height={22} />
                        </span>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 7 }}>Acá se arma el plan</div>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.65 }}>
                          Primero el agente lee todo lo que le diste y devuelve un brief. Después escribe las etapas, las semanas y los entregables, y los vas viendo aparecer. Al final lo revisás y lo aplicás.
                        </div>
                        <div style={{ marginTop: 18 }}>
                          <Check on={reviewFirst} onChange={toggleReviewFirst} label="Revisar antes de generar"
                            title="Frenar después de la lectura para revisar el brief antes de que escriba el plan" />
                        </div>
                      </div>
                    )}

                    {/* ---------- LECTURA ---------- */}
                    {phase === 'brief' && (
                      <>
                        {busy === 'brief' && <Thinking label="Leyendo el contexto" text={streamText} />}
                        {brief && (
                          <>
                            <BriefCards brief={brief} reduce={reduce} />
                            {!busy && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                                <button type="button" className="btn btn-accent" onClick={continueToPlan} title="Seguir con la escritura del plan">
                                  <I.chevR width={14} height={14} /> Generar el plan
                                </button>
                                <button type="button" className="btn" onClick={start} title="Volver a leer el contexto desde cero"><I.refresh width={13} height={13} /> Leer de nuevo</button>
                                <span style={{ marginLeft: 'auto' }}>
                                  <Check on={reviewFirst} onChange={toggleReviewFirst} label="Revisar antes de generar"
                                    title="Si lo apagás, la próxima vez pasa directo a escribir el plan" />
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* ---------- PLAN (se arma en vivo) ---------- */}
                    {phase === 'plan' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-line)' }}>
                            <span className={busy ? 'as-dot' : undefined} style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--accent)' }} />
                            {(draft && draft.weeks ? draft.weeks.length : 0)} semanas
                          </span>
                          <span className="tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)', borderColor: 'var(--border)' }}>
                            {(draft && draft.weeks ? draft.weeks.reduce((s, w) => s + ((w.tasks || []).length), 0) : 0)} tareas
                          </span>
                          {busy && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>escribiendo el plan…</span>}
                        </div>
                        {draft && (draft.weeks || []).length > 0
                          ? <PlanStream draft={draft} reduce={reduce} />
                          : busy
                            ? <Thinking label="Armando las etapas" text={streamText} />
                            : <div style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>El agente no llegó a escribir ninguna semana.</div>}
                      </>
                    )}

                    {/* ---------- REVISIÓN ---------- */}
                    {phase === 'review' && draft && (
                      <>
                        {summary && <StatStrip sum={summary} />}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <Seg value={view} onChange={setView}
                            options={[
                              { id: 'preview', label: 'Vista previa', title: 'Cómo se va a ver la página del cliente' },
                              { id: 'detalle', label: 'Detalle', title: 'Semana por semana, con tareas y entregables' },
                            ]} />
                          {busy === 'refine' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--accent)' }}>
                              <I.spark className="as-turn" width={13} height={13} /> aplicando el cambio…
                            </span>
                          )}
                        </div>

                        {view === 'preview' ? (
                          <div style={{ height: narrow ? '58vh' : 'min(62vh, 640px)', minHeight: 300 }}>
                            <iframe key="agent-preview" srcDoc={debHtml} title="Vista previa del plan generado"
                              style={{ width: '100%', height: '100%', border: '1px solid var(--border)', borderRadius: 12, background: '#060606' }} />
                          </div>
                        ) : (
                          <PlanStream draft={draft} reduce={reduce} />
                        )}
                      </>
                    )}
                  </div>

                  {/* ---- pie de revisión: refinamiento + acciones ---- */}
                  {phase === 'review' && draft && (
                    <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                      <div style={{ padding: '11px 18px' }}>
                        {history.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 }}>
                            {history.slice(-4).map((h, i) => (
                              <span key={i} className="tag" title={h} style={{ background: 'var(--card)', color: 'var(--text-faint)', borderColor: 'var(--border)', maxWidth: 260 }}>
                                <I.pencil width={10} height={10} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</span>
                              </span>
                            ))}
                            {history.length > 4 && <span className="tag" style={{ background: 'var(--card)', color: 'var(--text-faint)', borderColor: 'var(--border)' }}>+{history.length - 4}</span>}
                          </div>
                        )}
                        {history.length === 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 }}>
                            {EJEMPLOS_REFINE.map((e) => (
                              <button key={e} type="button" className="as-chip" title="Pedir este cambio" disabled={!!busy}
                                onClick={() => refine(e)} style={{ opacity: busy ? 0.5 : 1 }}>{e}</button>
                            ))}
                          </div>
                        )}
                        <div style={{ position: 'relative' }}>
                          <input className="input" value={instr} disabled={!!busy}
                            onChange={(e) => setInstr(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); refine(instr) } }}
                            placeholder="Pedile un cambio: «hacelo de 8 semanas», «agregá una etapa de QA»…"
                            style={{ paddingRight: 46 }} />
                          <button type="button" className="btn-accent" onClick={() => refine(instr)} disabled={!!busy || !instr.trim()}
                            title="Aplicar el cambio (Enter)"
                            style={{ position: 'absolute', right: 6, top: 5, width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', opacity: (!busy && instr.trim()) ? 1 : 0.45 }}>
                            <I.send width={14} height={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-accent" onClick={finish} disabled={!!busy}
                          title={basePlan ? 'Reemplazar el contenido del plan abierto' : 'Crear un plan nuevo con esto'}
                          style={{ opacity: busy ? 0.5 : 1 }}>
                          <I.check width={15} height={15} /> {basePlan ? 'Aplicar a este plan' : 'Crear el plan'}
                        </button>
                        <button type="button" className="btn" onClick={start} disabled={!canRun} title="Correr el agente otra vez desde el principio">
                          <I.refresh width={13} height={13} /> Volver a generar
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={discard} disabled={!!busy}
                          title="Tirar el borrador y volver al inicio" style={{ color: 'var(--text-faint)' }}>Descartar</button>
                        {basePlan && (
                          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.4, maxWidth: 280 }}>
                            Aplicar reemplaza el contenido actual del plan.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
