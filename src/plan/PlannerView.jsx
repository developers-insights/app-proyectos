/**
 * PlannerView.jsx — el Generador de Planes dentro de la app (F4 + F5).
 *
 * Dos vistas:
 *   1. Lista de planes (tabla, como TasksView).
 *   2. Editor de dos paneles: izquierda con acordeones (Portada · Hitos · Semanas),
 *      derecha con toolbar + preview en vivo (<iframe> con memo + debounce).
 *
 * Convención de la app: clases utilitarias de GLOBAL_CSS + style inline con var(--token).
 * La estética RDX vive SOLO dentro del <iframe> (el iframe la aísla del tema naranja).
 *
 * Contrato: plan/docs/MASTER_PLAN.md §6, §8 (F4/F5) y las decisiones D-A..D-E.
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { uid, I, useApp, Modal, Field } from '../ui.jsx'
import {
  newPlan, slugify, isSlugAllowed, SLUG_RE, SLUG_BLOCKLIST,
  resyncWeeks, weeksToLose, clampWeekCount, MAX_WEEKS,
  normalizeStages, hitoForWeek, validatePlan,
  COLOR_RE,
} from './planModel.js'
import { buildPlanHTML } from './planTemplate.js'
import rdxReference from './rdx.reference.json'

/* Sitio público de planes (Next.js en Vercel). Cada plan vive en /{slug} y lee
   su contenido de la tabla published_plans en Supabase, en tiempo real. */
const PLAN_SITE_BASE = 'https://planes-web-mu.vercel.app'

/**
 * Sube (o pisa) el plan en published_plans. La escritura requiere estar logueado
 * (RLS), así que usa el mismo cliente supabase autenticado de la app. Devuelve el
 * { error } de Supabase (o un error propio si no hay sesión de nube).
 */
async function upsertPublished(supabase, plan) {
  if (!supabase) return { error: { message: 'No estás conectado a la base (modo local). Entrá con tu cuenta para publicar.' } }
  return supabase
    .from('published_plans')
    .upsert({ slug: plan.slug, data: plan, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
}

/* ============================================================================
   CSS propio del planner (SOLO layout de dos paneles + responsive).
   Todo lo demás va inline con var(--token), como el resto de la app.
============================================================================ */
const PLANNER_CSS = `
.pe-wrap{display:flex;height:100%;overflow:hidden}
.pe-left{flex:1 1 46%;min-width:0;overflow-y:auto;padding:20px 22px 90px;border-right:1px solid var(--border)}
.pe-right{flex:1 1 54%;min-width:0;display:flex;flex-direction:column;padding:14px 16px;gap:10px;background:var(--bg-elevated)}
.pe-frame{flex:1;min-height:0;position:relative}
.pe-acc{border:1px solid var(--border);border-radius:12px;background:var(--card);margin-bottom:12px;overflow:hidden}
.pe-acc-head{display:flex;align-items:center;gap:10px;width:100%;padding:13px 15px;text-align:left;background:transparent}
.pe-acc-head:hover{background:var(--card-hover)}
.pe-acc-body{padding:4px 15px 18px;border-top:1px solid var(--border)}
.pe-grp-label{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-faint);margin:18px 0 9px}
.pe-card{border:1px solid var(--border);border-radius:11px;background:var(--bg-elevated);padding:12px;margin-bottom:10px}
.pe-swatch{width:22px;height:22px;border-radius:6px;cursor:pointer;padding:0}
.pe-mini{padding:5px 8px;font-size:12px;border-radius:8px}
@media(max-width:980px){
  .pe-wrap{flex-direction:column;overflow-y:auto}
  .pe-left{flex:none;border-right:none;border-bottom:1px solid var(--border);overflow:visible}
  .pe-right{flex:none}
  .pe-frame{height:72vh}
}
`
function usePlannerCss() {
  useEffect(() => {
    if (document.getElementById('planner-css')) return
    const el = document.createElement('style')
    el.id = 'planner-css'
    el.textContent = PLANNER_CSS
    document.head.appendChild(el)
  }, [])
}

/* ============================================================================
   Helpers de presentación / edición
============================================================================ */
/** Mueve el elemento i en la dirección dir (-1 arriba, +1 abajo). Devuelve un array nuevo. */
const moveItem = (arr, i, dir) => {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const c = [...arr]
  ;[c[i], c[j]] = [c[j], c[i]]
  return c
}

/** Entero desde un <input>, dejando pasar el vacío para poder borrar el campo. */
const numOr = (v, prev) => (v === '' ? '' : (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : prev))

const deepClone = (o) => JSON.parse(JSON.stringify(o))

/**
 * Un slug válido, único entre los planes y fuera del blocklist.
 * Sanea el deseado (slugify si hace falta) y le agrega -2, -3… hasta que entra.
 */
function makeUniqueSlug(desired, plans, selfId = null) {
  let base = SLUG_RE.test(String(desired)) && !SLUG_BLOCKLIST.includes(String(desired))
    ? String(desired)
    : slugify(desired)
  if (!base) base = 'plan'
  let s = base
  let i = 1
  while (!isSlugAllowed(s, plans, selfId) && i < 9999) {
    i += 1
    s = `${base}-${i}`
  }
  return s
}

/** Huecos / solapes / rangos fuera del plan — para el aviso en vivo en la sección Hitos. */
function rangeIssues(plan) {
  const total = (plan.weeks || []).length
  const owner = new Array(total + 1).fill(null)
  const overlaps = new Set()
  const out = []
  ;(plan.hitos || []).forEach((h) => {
    if (!h) return
    const from = Number(h.weekFrom)
    const to = Number(h.weekTo)
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || from < 1 || to > total) {
      if (total > 0) out.push(h.label || 'hito')
      return
    }
    for (let n = from; n <= to; n++) {
      if (owner[n] == null) owner[n] = h.label || 'hito'
      else overlaps.add(n)
    }
  })
  const gaps = []
  for (let n = 1; n <= total; n++) if (owner[n] == null) gaps.push(n)
  return { gaps, overlaps: [...overlaps], out }
}

/* ============================================================================
   Componentes de módulo (definidos afuera del render → no pierden foco).
============================================================================ */

/** Acordeón con estado propio. Los hijos NO se montan mientras está cerrado. */
function Acc({ title, sub, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="pe-acc">
      <button type="button" className="pe-acc-head" onClick={() => setOpen((v) => !v)}>
        {open ? <I.chevD width={16} height={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} /> : <I.chevR width={16} height={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</span>
        {sub && <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 'auto' }}>{sub}</span>}
      </button>
      {open && <div className="pe-acc-body">{children}</div>}
    </div>
  )
}

/** Filas de "subir / bajar / quitar" reutilizables. */
function RowTools({ i, len, onUp, onDown, onRemove, removeTitle = 'Quitar' }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button type="button" className="btn btn-ghost pe-mini" title="Subir" disabled={i === 0} onClick={onUp} style={{ padding: 5, opacity: i === 0 ? 0.35 : 1 }}><I.chevD width={14} height={14} style={{ transform: 'rotate(180deg)' }} /></button>
      <button type="button" className="btn btn-ghost pe-mini" title="Bajar" disabled={i === len - 1} onClick={onDown} style={{ padding: 5, opacity: i === len - 1 ? 0.35 : 1 }}><I.chevD width={14} height={14} /></button>
      <button type="button" className="btn btn-ghost pe-mini" title={removeTitle} onClick={onRemove} style={{ padding: 5, color: 'var(--text-faint)' }}><I.trash width={14} height={14} /></button>
    </div>
  )
}

/**
 * Tarjeta de una etapa (liviana). El usuario solo elige NOMBRE y "termina en la
 * semana X" (más una descripción opcional). El rango, el color y el ícono los
 * deriva normalizeStages() cada vez que algo cambia, así que editar una etapa
 * reescribe TODAS de forma consistente (los rangos siguen encadenados sin solapes).
 */
function StageCard({ plan, index, set, totalWeeks }) {
  const stages = plan.hitos || []
  const h = stages[index]
  const color = COLOR_RE.test(String(h.color)) ? h.color : 'var(--text-faint)'
  // Forma "cruda" que come normalizeStages: conserva lo que el usuario decide,
  // descarta lo derivado (weekFrom/label/color/icon se recalculan solos).
  const raw = () => stages.map((s) => ({ id: s.id, title: s.title, description: s.description, weekTo: s.weekTo }))
  const apply = (list) => set((p) => ({ ...p, hitos: normalizeStages(list) }))
  const up = (fields) => apply(raw().map((s, i) => (i === index ? { ...s, ...fields } : s)))

  // "Termina en la semana": input local, se aplica al salir del campo (Enter/blur).
  // Así se puede borrar y retipear sin que normalizeStages lo pise a cada tecla.
  const [toStr, setToStr] = useState(String(h.weekTo ?? ''))
  useEffect(() => { setToStr(String(h.weekTo ?? '')) }, [h.weekTo])
  const applyTo = () => {
    if (toStr.trim() === '') { setToStr(String(h.weekTo ?? '')); return }
    up({ weekTo: toStr })
  }
  return (
    <div className="pe-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 4, background: color, flexShrink: 0 }} />
        <strong style={{ fontSize: 13.5 }}>{h.title || h.label}</strong>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-faint)' }}>{h.weeksLabel}</span>
        <RowTools i={index} len={stages.length} onUp={() => apply(moveItem(raw(), index, -1))} onDown={() => apply(moveItem(raw(), index, 1))} onRemove={() => apply(raw().filter((_, i) => i !== index))} removeTitle="Quitar etapa" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 10 }}>
        <Field label="Nombre de la etapa"><input className="input" value={h.title ?? ''} onChange={(e) => up({ title: e.target.value })} placeholder="Ej: Fundaciones" /></Field>
        <Field label="Termina en la semana"><input className="input" type="number" min="1" max={totalWeeks || undefined} value={toStr} onChange={(e) => setToStr(e.target.value)} onBlur={applyTo} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} /></Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Descripción (opcional)"><textarea className="input" rows={2} value={h.description ?? ''} onChange={(e) => up({ description: e.target.value })} style={{ resize: 'vertical' }} placeholder="Qué se logra en esta etapa." /></Field>
      </div>
    </div>
  )
}

/** Tarjeta de una semana (colapsable): título, items y un entregable opcional. */
function WeekCard({ plan, index, set }) {
  const [open, setOpen] = useState(false)
  const w = plan.weeks[index]
  const hito = hitoForWeek(plan, w.n)
  const chipColor = COLOR_RE.test(String(hito.color)) ? hito.color : 'var(--text-faint)'
  const up = (fields) => set((p) => ({ ...p, weeks: p.weeks.map((x, i) => (i === index ? { ...x, ...fields } : x)) }))
  const upTasks = (fn) => set((p) => ({ ...p, weeks: p.weeks.map((x, i) => (i === index ? { ...x, tasks: fn(Array.isArray(x.tasks) ? [...x.tasks] : []) } : x)) }))
  const deliver = w.deliver || { kind: 'doc', text: '' }
  return (
    <div className="pe-card" style={{ padding: 0 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 12px', background: 'transparent' }}>
        {open ? <I.chevD width={15} height={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} /> : <I.chevR width={15} height={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-faint)', flexShrink: 0 }}>S{w.n}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title || <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>Sin título</span>}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 11, fontWeight: 600, color: chipColor, border: `1px solid ${chipColor}`, borderRadius: 999, padding: '2px 9px' }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: chipColor }} />{hito.label || '—'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginTop: 10 }}>
            <Field label="Título de la semana"><input className="input" value={w.title ?? ''} onChange={(e) => up({ title: e.target.value })} placeholder="Qué se hace esta semana" /></Field>
          </div>

          <div className="pe-grp-label" style={{ margin: '14px 0 8px' }}>Items de la semana</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(w.tasks || []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Sin items. Agregá el primero abajo.</div>}
            {(w.tasks || []).map((t, j) => (
              <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="input" value={t} onChange={(e) => upTasks((ts) => { ts[j] = e.target.value; return ts })} style={{ flex: 1 }} placeholder="Una tarea concreta de la semana" />
                <RowTools i={j} len={(w.tasks || []).length} onUp={() => upTasks((ts) => moveItem(ts, j, -1))} onDown={() => upTasks((ts) => moveItem(ts, j, 1))} onRemove={() => upTasks((ts) => ts.filter((_, k) => k !== j))} removeTitle="Quitar item" />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-sm" onClick={() => upTasks((ts) => [...ts, ''])} style={{ marginTop: 8 }}><I.plus width={13} height={13} /> Agregar item</button>

          <div style={{ marginTop: 16 }}>
            <Field label="Entregable de la semana (opcional)"><input className="input" value={deliver.text ?? ''} onChange={(e) => up({ deliver: { kind: deliver.kind || 'doc', text: e.target.value } })} placeholder="Qué queda listo y visible al cierre de la semana." /></Field>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Descarga el plan como un PDF simple de texto: un clic, sin diálogo de impresión.
 * No captura el diseño de la preview — arma un documento limpio con el título, el
 * objetivo y, por cada semana, su título, los items y el entregable. jsPDF se carga
 * on-demand (import dinámico) así no pesa el bundle inicial de la app.
 */
async function downloadPlanPDF(plan) {
  const mod = await import('jspdf')
  const JsPDF = mod.jsPDF || mod.default
  const doc = new JsPDF({ unit: 'pt', format: 'a4' })
  const pageH = doc.internal.pageSize.getHeight()
  const M = 48
  const W = doc.internal.pageSize.getWidth() - M * 2
  let y = M

  // Las fuentes core de jsPDF (WinAnsi) no traen guiones tipográficos ni "…".
  const ascii = (s) => String(s ?? '').replace(/[—–]/g, '-').replace(/·/g, '-').replace(/…/g, '...').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  const room = (need) => { if (y + need > pageH - M) { doc.addPage(); y = M } }
  const block = (text, { size = 10.5, style = 'normal', color = 20, gap = 4, bullet = false } = {}) => {
    if (!text) return
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color)
    const lines = doc.splitTextToSize(ascii(text), W - (bullet ? 14 : 0))
    const lh = size * 1.35
    room(lines.length * lh)
    if (bullet) { doc.text('-', M, y); doc.text(lines, M + 14, y) }
    else doc.text(lines, M, y)
    y += lines.length * lh + gap
  }

  block(plan.title || 'Plan de ejecución', { size: 22, style: 'bold', color: 0, gap: 10 })
  if (plan.lead) block(plan.lead, { size: 10.5, color: 90, gap: 16 })

  let lastStage = null
  ;(plan.weeks || []).forEach((w) => {
    const h = hitoForWeek(plan, w.n)
    if (h && h.id !== lastStage && (h.title || h.label)) {
      lastStage = h.id
      y += 6
      block(`${h.title || h.label}${h.weeksLabel ? '  · ' + h.weeksLabel : ''}`.toUpperCase(), { size: 9, style: 'bold', color: 130, gap: 8 })
    }
    block(`Semana ${w.n}${w.title ? ' — ' + w.title : ''}`, { size: 12.5, style: 'bold', color: 0, gap: 6 })
    ;(w.tasks || []).forEach((t) => { if (t) block(t, { size: 10.5, color: 30, gap: 2, bullet: true }) })
    if (w.deliver && w.deliver.text) block('Entregable: ' + w.deliver.text, { size: 9.5, style: 'italic', color: 90, gap: 4 })
    y += 12
  })

  doc.save((plan.slug || 'plan') + '.pdf')
}

/* ============================================================================
   EDITOR — dos paneles
============================================================================ */
function PlanEditor({ plan, plans, projects, patchPlan, onExit, onPublish, syncPublished }) {
  const frameRef = useRef(null)
  const set = (fn) => patchPlan(plan.id, fn)

  // Auto-sync: una vez publicado, cada edición se sube sola a published_plans
  // (debounce 800ms). El sitio en Vercel escucha ese cambio y se refresca solo,
  // así que el cliente ve lo nuevo sin que nadie toque otro botón.
  const [syncState, setSyncState] = useState('idle') // idle · saving · saved · error
  const lastSyncRef = useRef(null)
  useEffect(() => {
    if (!plan.published) return
    const snap = JSON.stringify(plan)
    if (lastSyncRef.current === null) { lastSyncRef.current = snap; return } // al abrir un plan ya publicado no re-subimos
    if (snap === lastSyncRef.current) return
    setSyncState('saving')
    const t = setTimeout(async () => {
      const { error } = await syncPublished(plan)
      if (error) { setSyncState('error'); return }
      lastSyncRef.current = snap
      setSyncState('saved')
    }, 800)
    return () => clearTimeout(t)
  }, [plan, syncPublished])
  const retrySync = async () => {
    setSyncState('saving')
    const { error } = await syncPublished(plan)
    if (error) { setSyncState('error'); return }
    lastSyncRef.current = JSON.stringify(plan)
    setSyncState('saved')
  }

  // Preview: memo + debounce 300ms + key estable (G3 / T12).
  const html = useMemo(() => {
    try {
      return buildPlanHTML(plan, { preview: true })
    } catch (err) {
      return `<!doctype html><html><body style="font-family:system-ui;background:#111;color:#eee;padding:40px"><h2>No se pudo generar la vista previa</h2><pre style="white-space:pre-wrap;color:#f88">${String(err && err.message ? err.message : err)}</pre></body></html>`
    }
  }, [plan])
  const [debounced, setDebounced] = useState(html)
  useEffect(() => { const t = setTimeout(() => setDebounced(html), 300); return () => clearTimeout(t) }, [html])

  // Cantidad de semanas: input local, se aplica al salir del campo (evita borrar datos mientras se tipea).
  const [countStr, setCountStr] = useState(String((plan.weeks || []).length))
  useEffect(() => { setCountStr(String((plan.weeks || []).length)) }, [plan.weeks?.length])
  const applyCount = () => {
    if (countStr.trim() === '') { setCountStr(String((plan.weeks || []).length)); return }
    const n = clampWeekCount(countStr)
    const cur = (plan.weeks || []).length
    if (n === cur) return
    if (n < cur) {
      const loss = weeksToLose(plan, n)
      if (loss.withContent > 0) {
        const items = loss.weeks.reduce((s, w) => s + ((w.tasks || []).length), 0)
        const ok = window.confirm(
          `Vas a bajar de ${cur} a ${n} semana${n === 1 ? '' : 's'}.\n\n` +
          `Se eliminan ${loss.count} semana${loss.count === 1 ? '' : 's'}, ${loss.withContent} con contenido cargado` +
          (items ? ` (${items} item${items === 1 ? '' : 's'} en total)` : '') + '.\n\n' +
          `Esto no se puede deshacer. ¿Continuar?`,
        )
        if (!ok) { setCountStr(String(cur)); return }
      }
    }
    set((p) => ({ ...p, weeks: resyncWeeks(p, n) }))
  }

  const issues = validatePlan(plan)
  const ranges = rangeIssues(plan)
  const setField = (k, v) => set((p) => ({ ...p, [k]: v }))

  return (
    <div className="pe-wrap">
      {/* ---------- IZQUIERDA: acordeones ---------- */}
      <div className="pe-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-sm btn-ghost" onClick={onExit} title="Volver a la lista" style={{ transform: 'scaleX(-1)', padding: 7 }}><I.chevR width={16} height={16} /></button>
          <div style={{ minWidth: 0 }}>
            <div className="label">Editando plan</div>
            <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.title || 'Sin título'}</div>
          </div>
        </div>

        {/* ===== LO BÁSICO ===== */}
        <Acc title="Lo básico" sub="Cliente y objetivo" defaultOpen>
          <Field label="Nombre del cliente o proyecto"><input className="input" value={plan.title ?? ''} onChange={(e) => setField('title', e.target.value)} placeholder="Cleaning Marketplace" /></Field>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>Es el título grande del plan. También se usa en el menú y el pie.</div>
          <div style={{ marginTop: 12 }}><Field label="Objetivo del plan"><textarea className="input" rows={3} value={plan.lead ?? ''} onChange={(e) => setField('lead', e.target.value)} style={{ resize: 'vertical' }} placeholder="Del estado actual al despliegue en App Store y Play Store en 12 semanas." /></Field></div>
        </Acc>

        {/* ===== ETAPAS ===== */}
        <Acc title="Etapas" sub={`${(plan.hitos || []).length} · dan color y estructura`} defaultOpen>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 12, lineHeight: 1.5 }}>Agrupan las semanas en bloques de color. Solo ponés el nombre y hasta qué semana llega cada una; el color y el ícono se asignan solos.</div>
          {(ranges.gaps.length > 0 || ranges.out.length > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              {ranges.gaps.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--yellow)' }}>Sin etapa: semana{ranges.gaps.length > 1 ? 's' : ''} {ranges.gaps.join(', ')} (salen en gris). Extendé la última etapa hasta la semana {(plan.weeks || []).length}.</div>}
              {ranges.out.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>Una etapa termina fuera del plan. Bajá su “termina en la semana” o subí la cantidad de semanas.</div>}
            </div>
          ) : (plan.hitos || []).length > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><I.check width={14} height={14} /> Las etapas cubren todas las semanas.</div>
          )}
          {(plan.hitos || []).map((h, i) => <StageCard key={h.id || i} plan={plan} index={i} set={set} totalWeeks={(plan.weeks || []).length} />)}
          <button type="button" className="btn btn-sm" onClick={() => set((p) => ({ ...p, hitos: normalizeStages([...(p.hitos || []).map((s) => ({ id: s.id, title: s.title, description: s.description, weekTo: s.weekTo })), { title: '', weekTo: (p.weeks || []).length || 1 }]) }))}><I.plus width={13} height={13} /> Agregar etapa</button>
        </Acc>

        {/* ===== SEMANAS ===== */}
        <Acc title="Semanas" sub={`${(plan.weeks || []).length} semanas`} defaultOpen>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14 }}>
            <Field label="Cantidad de semanas">
              <input className="input" type="number" min="0" max={MAX_WEEKS} value={countStr} onChange={(e) => setCountStr(e.target.value)} onBlur={applyCount} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} style={{ width: 110 }} />
            </Field>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.5, paddingBottom: 3 }}>Escribí el número y salí del campo (o Enter). Si bajás y hay semanas cargadas, te avisa antes de borrar.</div>
          </div>
          {(plan.weeks || []).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>El plan no tiene semanas. Subí la cantidad para agregarlas.</div>}
          {(plan.weeks || []).map((w, i) => <WeekCard key={i} plan={plan} index={i} set={set} />)}
        </Acc>
      </div>

      {/* ---------- DERECHA: toolbar + preview ---------- */}
      <div className="pe-right">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {plan.published ? (() => {
            const err = syncState === 'error'
            const col = err ? 'var(--red)' : 'var(--green)'
            const label = syncState === 'saving' ? 'Guardando cambios…' : err ? 'No se pudo sincronizar' : 'Publicado · se actualiza solo'
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: col, border: `1px solid ${col}`, borderRadius: 999, padding: '5px 11px' }}>
                {syncState === 'saving' ? <I.refresh width={13} height={13} /> : <span style={{ width: 7, height: 7, borderRadius: 99, background: col }} />}
                {label}
                {err && <button className="btn btn-sm btn-ghost" onClick={retrySync} style={{ padding: '0 5px', color: 'var(--red)', fontWeight: 700 }}>reintentar</button>}
              </span>
            )
          })() : (
            <button className="btn btn-sm btn-accent" onClick={() => onPublish(plan)}><I.rocket width={14} height={14} /> Publicar</button>
          )}
          <button className="btn btn-sm" onClick={() => downloadPlanPDF(plan)}><I.pdf width={14} height={14} /> Descargar PDF</button>
          <button className="btn btn-sm btn-ghost" onClick={onExit}><I.chevR width={14} height={14} style={{ transform: 'scaleX(-1)' }} /> Volver a la lista</button>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
            <span className="mono" title="Ruta pública" style={{ color: 'var(--text)' }}>/{plan.slug || 'sin-slug'}</span>
            {plan.publishedUrl && <a href={plan.publishedUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Abrir la página publicada" style={{ padding: 5 }}><I.ext width={13} height={13} /></a>}
          </span>
        </div>

        {issues.length > 0 && (
          <div className="scroll-y" style={{ maxHeight: 108, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, padding: '9px 11px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }}>
            {issues.map((it, i) => (
              <div key={i} style={{ fontSize: 12, display: 'flex', gap: 7, alignItems: 'flex-start', color: it.level === 'error' ? 'var(--red)' : 'var(--text-dim)' }}>
                <I.alert width={13} height={13} style={{ flexShrink: 0, marginTop: 2 }} />{it.msg}
              </div>
            ))}
          </div>
        )}

        <div className="pe-frame">
          <iframe key="plan-preview" ref={frameRef} srcDoc={debounced} title="Vista previa del plan"
            style={{ width: '100%', height: '100%', border: '1px solid var(--border)', borderRadius: 12, background: '#060606' }} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   LISTA
============================================================================ */
function PlanList({ plans, projects, onEdit, onNew, onLoadExample, onPublish, onDelete }) {
  const projName = (id) => (projects.find((p) => p.id === id)?.name) || null
  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Entregables de cliente</div><h1 style={{ fontSize: 32 }}>Planificador</h1></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={onLoadExample}><I.doc width={15} height={15} /> Cargar plan de ejemplo (RDX)</button>
          <button className="btn btn-accent" onClick={onNew}><I.plus width={15} height={15} /> Nuevo plan</button>
        </div>
      </div>

      {plans.length === 0 && (
        <div className="surface" style={{ padding: 44, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Todavía no hay planes</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 18px' }}>
            Armá un plan de ejecución para mostrarle a un cliente: hitos, semanas y entregables, en una página lista para compartir. Empezá de cero o cargá el de ejemplo para ver cómo queda.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={onLoadExample}><I.doc width={15} height={15} /> Cargar ejemplo (RDX)</button>
            <button className="btn btn-accent" onClick={onNew}><I.plus width={15} height={15} /> Crear el primero</button>
          </div>
        </div>
      )}

      {plans.length > 0 && (
        <div className="surface tbl" style={{ overflow: 'hidden' }}>
          <table>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Título', 'Cliente', 'Semanas', 'Hitos', 'Dirección', 'Proyecto', 'Publicado', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {plans.map((p) => {
                const formal = (p.hitos || []).filter((h) => h && h.isMilestone).length
                return (
                  <tr key={p.id} className="row-hover click" onClick={() => onEdit(p.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.title || <span style={{ color: 'var(--text-faint)' }}>Sin título</span>}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-dim)' }}>{p.clientName || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }} className="mono">{(p.weeks || []).length}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }} className="mono" title={`${formal} formales`}>{(p.hitos || []).length}<span style={{ color: 'var(--text-faint)' }}> · {formal}f</span></td>
                    <td style={{ padding: '12px 16px', fontSize: 12.5 }} className="mono">/{p.slug || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-dim)' }}>{projName(p.projectId) || '—'}</td>
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      {p.publishedUrl
                        ? <a href={p.publishedUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title={p.publishedUrl} style={{ padding: 5, color: 'var(--accent)' }}><I.ext width={14} height={14} /></a>
                        : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px 10px 0', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-ghost" title="Editar" onClick={() => onEdit(p.id)} style={{ padding: 6 }}><I.pencil width={15} height={15} /></button>
                        {!p.published && <button className="btn btn-sm btn-ghost" title="Publicar" onClick={() => onPublish(p)} style={{ padding: 6, color: 'var(--accent)' }}><I.rocket width={15} height={15} /></button>}
                        <button className="btn btn-sm btn-ghost" title="Borrar" onClick={() => onDelete(p)} style={{ padding: 6, color: 'var(--text-faint)' }}><I.trash width={15} height={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   PLANNER VIEW — orquesta lista ↔ editor
============================================================================ */
export default function PlannerView() {
  usePlannerCss()
  const { data, setData, logActivity, supabase } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const plans = data.plans || []
  const projects = data.projects || []
  const setPlans = (fn) => setData((d) => ({ ...d, plans: fn(d.plans || []) }))
  const patchPlan = (id, fn) => setPlans((ps) => ps.map((p) => (p.id === id ? { ...fn(p), updatedAt: new Date().toISOString() } : p)))

  const createPlan = () => {
    const title = newTitle.trim()
    if (!title) return
    const p = newPlan()
    p.title = title
    p.docTitle = title
    p.slug = makeUniqueSlug(title, plans)
    setPlans((ps) => [p, ...ps])
    if (logActivity) logActivity({ type: 'plan-add', text: `creó el plan "${title}"` })
    setNewTitle(''); setNewOpen(false); setEditingId(p.id)
  }

  const loadExample = () => {
    const base = deepClone(rdxReference)
    delete base._comment
    const now = new Date().toISOString()
    base.id = uid()
    base.projectId = null
    base.publishedUrl = ''
    base.createdAt = now
    base.updatedAt = now
    base.slug = isSlugAllowed('rdx', plans) ? 'rdx' : makeUniqueSlug('rdx-copia', plans)
    setPlans((ps) => [base, ...ps])
    if (logActivity) logActivity({ type: 'plan-add', text: `cargó el plan de ejemplo "${base.title}"` })
    // Queda en la lista: el usuario lo abre cuando quiere (a diferencia de "Nuevo plan").
  }

  // Publicar (primera vez): sube el plan a published_plans y le guarda su dirección
  // pública. A partir de ahí, el editor lo mantiene sincronizado solo (auto-sync).
  const publishPlan = async (plan) => {
    const { error } = await upsertPublished(supabase, plan)
    if (error) { window.alert('No se pudo publicar el plan.\n\n' + error.message); return }
    patchPlan(plan.id, (p) => ({ ...p, published: true, publishedUrl: `${PLAN_SITE_BASE}/${p.slug}` }))
    if (logActivity) logActivity({ type: 'plan-publish', text: `publicó el plan "${plan.title}"` })
  }
  // Sync silencioso (lo llama el editor en cada cambio de un plan ya publicado).
  const syncPublished = (plan) => upsertPublished(supabase, plan)

  const deletePlan = async (plan) => {
    const ok = window.confirm(
      `Vas a borrar el plan "${plan.title}".\n\n` +
      (plan.published
        ? `Como está publicado, también se quita de su dirección pública (${plan.publishedUrl || `${PLAN_SITE_BASE}/${plan.slug}`}).\n\n`
        : '') +
      `Esto no se puede deshacer. ¿Borrar el plan?`,
    )
    if (!ok) return
    if (plan.published && supabase) {
      const { error } = await supabase.from('published_plans').delete().eq('slug', plan.slug)
      if (error) { window.alert('No se pudo quitar el plan del sitio, así que no borré nada.\n\n' + error.message); return }
    }
    setPlans((ps) => ps.filter((p) => p.id !== plan.id))
    if (editingId === plan.id) setEditingId(null)
    if (logActivity) logActivity({ type: 'plan-delete', text: `borró el plan "${plan.title}"` })
  }

  const editing = editingId ? plans.find((p) => p.id === editingId) : null

  if (editing) {
    return (
      <PlanEditor
        plan={editing}
        plans={plans}
        projects={projects}
        patchPlan={patchPlan}
        onExit={() => setEditingId(null)}
        onPublish={publishPlan}
        syncPublished={syncPublished}
      />
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <PlanList
        plans={plans}
        projects={projects}
        onEdit={(id) => setEditingId(id)}
        onNew={() => { setNewTitle(''); setNewOpen(true) }}
        onLoadExample={loadExample}
        onPublish={publishPlan}
        onDelete={deletePlan}
      />
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nuevo plan" sub="Ponele un título — el resto lo editás después" width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Título del plan">
            <input className="input" value={newTitle} autoFocus onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createPlan() } }} placeholder="Real Deal Exchange AI" />
          </Field>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
            Se va a publicar en <span className="mono" style={{ color: 'var(--text-dim)' }}>/{newTitle.trim() ? makeUniqueSlug(newTitle, plans) : '…'}</span>. Podés cambiar la dirección en la portada.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
            <button className="btn btn-accent" onClick={createPlan} disabled={!newTitle.trim()}><I.check width={15} height={15} /> Crear plan</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
