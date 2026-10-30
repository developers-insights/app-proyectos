import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, Panel, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, useStore, applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { JOURNEY_LANES, canvasLayout, mergePositions, capLane, orderForSearch, standbyNote, CANVAS } from '../lib/journey.js'
import { Point, plural } from './parts.jsx'
import { I2 } from '../ui/icons2.jsx'

const HEAD_MID = 5 + (CANVAS.head - 10) / 2

const CSS = `
.jr-cv{position:relative;height:clamp(560px,calc(100dvh - 232px),900px);border-radius:20px;overflow:hidden;isolation:isolate;
  background:var(--card);background:light-dark(color-mix(in srgb,var(--card) 70%,var(--bg)),color-mix(in srgb,var(--bg) 70%,var(--card)));
  box-shadow:inset 0 0 0 1px var(--border)}
.jr-cv::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(60% 55% at 18% 0%,var(--wash-a),transparent 70%),radial-gradient(50% 60% at 100% 100%,var(--wash-b),transparent 70%)}
.jr-cv .react-flow{background:transparent;z-index:1}
.jr-cv .react-flow__background pattern circle{fill:var(--border-strong)}
.jr-cv .react-flow__pane{cursor:grab}
.jr-cv .react-flow__pane.dragging{cursor:grabbing}
.jr-cv .react-flow__node{border-radius:16px}
.jr-cv .react-flow__node:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.jr-cv .react-flow__node.selected .jr-ln-node{box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--lc) 55%,transparent),var(--shadow)}
.jr-cv .react-flow__handle{width:9px;height:9px;min-width:0;min-height:0;border:0;border-radius:50%;background:var(--card);
  box-shadow:inset 0 0 0 2px var(--lc),0 0 0 3px var(--card);pointer-events:none}
.jr-cv .react-flow__handle-left{left:-4px}
.jr-cv .react-flow__handle-right{right:-4px}
.jr-cv .react-flow__handle-top{top:-4px}
.jr-cv .react-flow__handle-bottom{bottom:-4px}
.jr-cv .react-flow__edge-path{stroke:var(--border-strong);stroke-width:1.5;fill:none;transition:opacity .24s var(--e)}
.jr-cv .react-flow__edge.jr-e-f2 .react-flow__edge-path{stroke:var(--violet);stroke-width:2;stroke-linecap:round;stroke-dasharray:0 7;
  animation:jrDash 1.4s linear infinite}
.jr-cv .react-flow__edge[data-dim="1"] .react-flow__edge-path{opacity:.3}
@keyframes jrDash{to{stroke-dashoffset:-14}}

.jr-ln-node{--lc:var(--accent);width:${CANVAS.nodeW}px;padding:5px;border-radius:16px;
  background:color-mix(in srgb,var(--lc) 6%,var(--card));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lc) 16%,var(--border)),var(--shadow);
  transition:opacity .24s var(--e),box-shadow .24s var(--e)}
.react-flow__node.dragging .jr-ln-node{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lc) 30%,var(--border-strong)),var(--shadow-lift)}
.jr-ln-node[data-dim="1"]{opacity:.38}
.jr-ln-core{border-radius:12px;overflow:hidden;background:var(--card);background:light-dark(var(--bg),color-mix(in srgb,var(--card) 55%,var(--card-hover)));
  box-shadow:0 0 0 1px var(--border)}
.jr-lh{display:flex;align-items:center;gap:10px;height:${CANVAS.head - 10}px;padding:0 12px 0 14px;cursor:grab;user-select:none;
  border-bottom:1px solid var(--border);background:linear-gradient(180deg,color-mix(in srgb,var(--lc) 9%,transparent),transparent)}
.react-flow__node.dragging .jr-lh{cursor:grabbing}
.jr-lh .dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--lc);box-shadow:0 0 0 3px color-mix(in srgb,var(--lc) 18%,transparent)}
.jr-lh .lb{flex:1;min-width:0;font-size:13px;font-weight:650;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jr-lh .ct{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:12px;font-weight:600;color:var(--text-dim);
  height:22px;min-width:24px;padding:0 7px;display:inline-grid;place-items:center;border-radius:7px;background:var(--track)}
.jr-lh .ct small{font-size:10.5px;color:var(--text-faint);font-weight:500}
.jr-lh .grip{display:grid;grid-template-columns:repeat(2,3px);gap:2px;opacity:.5}
.jr-lh .grip i{width:3px;height:3px;border-radius:50%;background:var(--text-faint)}
.jr-lbody{padding:5px;cursor:default}
.jr-lrows[data-scroll="1"]{max-height:${CANVAS.row * 5 + CANVAS.why * 2}px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.jr-lbody .jr-pt{min-height:${CANVAS.row - 2}px}
.jr-lbody .jr-pt[data-active="1"]{background:color-mix(in srgb,var(--lc) 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lc) 35%,transparent)}
.jr-lbody .jr-pt[data-dim="1"]{opacity:.32}
.jr-ln-node[data-drop="1"]{background:color-mix(in srgb,var(--lc) 14%,var(--card));
  box-shadow:inset 0 0 0 2px var(--lc),0 0 0 5px color-mix(in srgb,var(--lc) 16%,transparent),var(--shadow-lift)}
.jr-lbody .jr-pt[data-dragging="1"]{opacity:.3}
html.jr-dragging,html.jr-dragging *{cursor:grabbing !important;user-select:none}
.jr-ghost{position:fixed;left:0;top:0;z-index:90;pointer-events:none;transform-origin:0 0;border-radius:12px;
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border-strong),var(--shadow-lift)}
.jr-ghost .jr-pt{background:transparent}
.jr-why2{display:block;margin:-4px 0 2px;padding:0 8px 0 41px;font-size:11px;line-height:${CANVAS.why - 4}px;color:var(--text-dim);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jr-why2::before{content:"Motivo: ";color:var(--text-faint)}
.jr-lbody .jr-empty{margin:0;min-height:${CANVAS.empty - 10}px}

.jr-f2e{position:absolute;pointer-events:all;display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px 0 12px;border-radius:999px;white-space:nowrap;
  font-size:12px;font-weight:600;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--violet-line),var(--shadow);
  transition:box-shadow .2s var(--e)}
.jr-f2e b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:13px;color:var(--violet)}
.jr-f2e:hover{box-shadow:inset 0 0 0 1.5px var(--violet),var(--shadow)}
.jr-f2e:focus-visible{outline:2px solid var(--violet);outline-offset:2px}
.jr-f2e svg{color:var(--text-faint);transition:transform .2s var(--e)}
.jr-f2e:hover svg{transform:translateX(2px)}

.jr-tools{display:flex;gap:6px;margin:12px !important}
.jr-tg{display:flex;align-items:center;gap:2px;padding:3px;border-radius:12px;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border),var(--shadow)}
.jr-tb{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:32px;height:32px;padding:0 9px;border-radius:9px;font-size:12px;font-weight:600;color:var(--text-dim);
  transition:color .18s var(--e),background .18s var(--e)}
.jr-tb:hover:not(:disabled){color:var(--text);background:var(--card-hover)}
.jr-tb:active:not(:disabled){transform:scale(.96)}
.jr-tb:disabled{opacity:.4;cursor:default}
.jr-tb:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.jr-zoom{min-width:48px;font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11.5px}
.jr-cv .react-flow__minimap{margin:12px;border-radius:12px;overflow:hidden;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border),var(--shadow)}
.jr-cv .react-flow__minimap-mask{fill:light-dark(rgba(0,0,0,.05),rgba(0,0,0,.45))}
.jr-cv .react-flow__minimap-node{stroke:none}
${JOURNEY_LANES.map((l) => `.jr-cv .react-flow__minimap-node.mm-${l.key}{fill:color-mix(in srgb,var(${l.colorVar}) 55%,transparent)}`).join('\n')}
.jr-cv .react-flow__attribution{margin:0 0 6px;padding:1px 6px;border-radius:6px;background:transparent;font-size:9.5px;opacity:.55}
.jr-cv .react-flow__attribution a{color:var(--text-faint)}
.jr-hint{margin:14px 16px !important;font-size:11.5px;color:var(--text-faint);pointer-events:none}
.jr-nores{display:flex;align-items:center;gap:10px;margin:12px !important;padding:0 14px;height:38px;border-radius:12px;font-size:12.5px;color:var(--text-dim);
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border),var(--shadow)}
@media (max-width:1100px){.jr-cv .react-flow__minimap,.jr-hint{display:none}}
@media (prefers-reduced-motion: reduce){
  .jr-cv .react-flow__edge.jr-e-f2 .react-flow__edge-path{animation:none}
  .jr-ln-node,.jr-tb,.jr-f2e,.jr-f2e svg{transition:none}
  .jr-tb:active:not(:disabled){transform:none}
}
`

const ARIA = {
  'node.a11yDescription.default': 'Tramo del recorrido. Enter o espacio lo selecciona y las flechas lo mueven. Escape cancela.',
  'node.a11yDescription.keyboardDisabled': 'Tramo del recorrido.',
  'node.a11yDescription.ariaLiveMessage': ({ x, y }) => `Tramo movido. Nueva posición: ${x}, ${y}`,
  'edge.a11yDescription.default': 'Conexión entre tramos.',
  'controls.ariaLabel': 'Controles del lienzo',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Ajustar a la pantalla',
  'controls.interactive.ariaLabel': 'Bloquear el lienzo',
  'minimap.ariaLabel': 'Mapa en miniatura del recorrido',
  'handle.ariaLabel': 'Conector',
}

const Grip = () => <span className="grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>

const LaneNode = memo(function LaneNode({ data }) {
  const { lane, items, matches, activeId, clientOf, onOpen, targetTop, sourceTop, drag } = data
  const [expanded, setExpanded] = useState(false)
  const ordered = useMemo(() => orderForSearch(items, matches), [items, matches])
  const { visible, hidden, collapsible } = capLane(ordered, expanded)
  const nMatch = matches ? items.filter((it) => matches.has(it.project.id)).length : null
  const rowsId = `jr-cv-rows-${lane.key}`
  const branch = !!lane.branch
  return (
    <section className="jr-ln-node" data-lane={lane.key} style={{ '--lc': `var(${lane.colorVar})` }} data-dim={matches && !nMatch ? '1' : undefined}
      aria-label={`${lane.label}: ${plural(items.length, 'proyecto', 'proyectos')}`}>
      {lane.key !== 'onboarding' && lane.key !== 'standby' && <Handle type="target" position={Position.Left} id="l" isConnectable={false} style={{ top: HEAD_MID }} />}
      {lane.key === 'standby' && <Handle type="target" position={Position.Top} id="in" isConnectable={false} />}
      {!branch && <Handle type="source" position={Position.Right} id="r" isConnectable={false} style={{ top: HEAD_MID }} />}
      {lane.key === 'prueba' && <Handle type="source" position={Position.Bottom} id="b" isConnectable={false} />}
      {sourceTop && <Handle type="source" position={Position.Top} id="t" isConnectable={false} style={{ left: '62%' }} />}
      {targetTop && <Handle type="target" position={Position.Top} id="t" isConnectable={false} style={{ left: '32%' }} />}
      <div className="jr-ln-core">
        <header className="jr-lh jr-drag" title="Arrastrá desde acá para mover este tramo">
          <span className="dot" aria-hidden="true" />
          <span className="lb">{lane.label}</span>
          <span className="ct" aria-hidden="true">{nMatch != null ? <span>{nMatch}<small> / {items.length}</small></span> : items.length}</span>
          <Grip />
        </header>
        <div className="jr-lbody nodrag nopan">
          <div className={`jr-lrows${expanded ? ' nowheel' : ''}`} id={rowsId} data-scroll={expanded ? '1' : undefined}>
          {items.length === 0
            ? <div className="jr-empty">Nadie en este tramo</div>
            : visible.map((it) => {
              const note = lane.key === 'standby' ? standbyNote(it.project) : ''
              return (
                <React.Fragment key={it.project.id}>
                  <Point item={it} client={clientOf(it.project.clientId)} onOpen={onOpen}
                    active={activeId === it.project.id} dim={matches ? !matches.has(it.project.id) : false} drag={drag && drag(it, lane.key)} />
                  {note && <span className="jr-why2" title={note}>{note}</span>}
                </React.Fragment>
              )
            })}
          </div>
          {(hidden > 0 || collapsible) && (
            <button type="button" className="jr-more" aria-expanded={expanded} aria-controls={rowsId}
              aria-label={expanded ? `Ver menos en ${lane.label}` : `Ver ${plural(hidden, 'proyecto más', 'proyectos más')} en ${lane.label}`}
              onClick={() => setExpanded((x) => !x)}>
              {expanded ? 'Ver menos' : `Ver ${hidden} más`}
              <I2.chevD width={13} height={13} />
            </button>
          )}
        </div>
      </div>
    </section>
  )
})

function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd }) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} />
}

function F2Edge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const lift = 72
  const top = Math.min(sourceY, targetY) - lift
  const path = `M${sourceX} ${sourceY} C${sourceX} ${top} ${targetX} ${top} ${targetX} ${targetY}`
  const lx = (sourceX + targetX) / 2
  const ly = 0.125 * sourceY + 0.75 * top + 0.125 * targetY
  return (
    <>
      <BaseEdge id={id} path={path} />
      <EdgeLabelRenderer>
        <button type="button" className="jr-f2e nodrag nopan" style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}
          onClick={(e) => data.onOpen(e.currentTarget)} aria-haspopup="dialog"
          aria-label={`${plural(data.count, 'proyecto', 'proyectos')} con la Fase 2 ofrecida. Ver la lista`}>
          <b>{data.count}</b> con Fase 2 ofrecida
          <I2.arrowRight width={13} height={13} />
        </button>
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = { lane: LaneNode }
const edgeTypes = { flow: FlowEdge, f2: F2Edge }
const FIT = { padding: { top: '76px', right: '28px', bottom: '56px', left: '28px' }, maxZoom: 1 }
const EDGES = [['onboarding', 'mvp'], ['mvp', 'prueba'], ['prueba', 'fase2'], ['prueba', 'plan'], ['prueba', 'anual'], ['prueba', 'partner'], ['prueba', 'standby']]

const readSaved = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
const writeSaved = (key, v) => { try { v ? localStorage.setItem(key, JSON.stringify(v)) : localStorage.removeItem(key) } catch { /* sin storage queda en memoria */ } }
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Tools({ onLayout, custom }) {
  const rf = useReactFlow()
  const zoom = useStore((s) => s.transform[2])
  const d = reduced() ? 0 : 260
  const pct = Math.round(zoom * 100)
  return (
    <>
      <Panel position="bottom-left" className="jr-tools">
        <div className="jr-tg" role="group" aria-label="Zoom">
          <button type="button" className="jr-tb" onClick={() => rf.zoomOut({ duration: d })} aria-label="Alejar" title="Alejar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" className="jr-tb jr-zoom" onClick={() => rf.zoomTo(1, { duration: d })} aria-label={`Zoom ${pct} %. Volver al 100 %`} title="Volver al 100 %">
            {pct}%
          </button>
          <button type="button" className="jr-tb" onClick={() => rf.zoomIn({ duration: d })} aria-label="Acercar" title="Acercar">
            <I2.plus width={14} height={14} />
          </button>
        </div>
      </Panel>
      <Panel position="top-right" className="jr-tools">
        <div className="jr-tg">
          <button type="button" className="jr-tb" onClick={() => rf.fitView({ ...FIT, duration: d ? 420 : 0 })} title="Que entre todo el recorrido en la pantalla">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /></svg>
            Ajustar
          </button>
          <button type="button" className="jr-tb" onClick={onLayout} disabled={!custom} title={custom ? 'Volver al orden automático' : 'Ya está en el orden automático'}>
            <I2.refresh width={14} height={14} />
            Ordenar
          </button>
        </div>
      </Panel>
    </>
  )
}

/*
 * Arrastre de una card a otro tramo con pointer events propios: el drag nativo de HTML
 * no anda bien sobre botones en Firefox y su imagen fantasma sale con el zoom del lienzo.
 * La posición y el tramo resaltado se tocan en el DOM, sin setState por movimiento:
 * cada render del Canvas rearma los nodos de React Flow.
 */
function useCardDrag(canMove, onMove) {
  const [ghost, setGhost] = useState(null)
  const ghostEl = useRef(null)
  const st = useRef(null)
  const fns = useRef({ canMove, onMove })
  fns.current = { canMove, onMove }

  const clearOver = () => document.querySelectorAll('.jr-ln-node[data-drop]').forEach((n) => n.removeAttribute('data-drop'))

  const start = useCallback((e, item, lane) => {
    if (e.button !== 0 || !e.isPrimary || !fns.current.onMove) return
    const el = e.currentTarget
    const s = { id: item.project.id, from: lane, x0: e.clientX, y0: e.clientY, on: false, over: null }
    st.current = s
    const place = (x, y) => `translate(${x - s.dx}px,${y - s.dy}px) scale(${s.k})`
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return
      if (!s.on) {
        if (Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0) < 6) return
        s.on = true
        const r = el.getBoundingClientRect()
        s.k = el.offsetWidth ? r.width / el.offsetWidth : 1
        s.dx = s.x0 - r.left
        s.dy = s.y0 - r.top
        el.setAttribute('data-dragging', '1')
        document.documentElement.classList.add('jr-dragging')
        setGhost({ item, lane, w: el.offsetWidth, t: place(ev.clientX, ev.clientY) })
      }
      if (ghostEl.current) ghostEl.current.style.transform = place(ev.clientX, ev.clientY)
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.jr-ln-node[data-lane]')
      const key = hit?.dataset.lane
      const ok = key && key !== s.from && fns.current.canMove(s.id, key) ? key : null
      if (ok !== s.over) {
        clearOver()
        if (ok) hit.setAttribute('data-drop', '1')
        s.over = ok
      }
    }
    const end = (commit) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', esc, true)
      if (!s.on) { st.current = null; return }
      el.removeAttribute('data-dragging')
      clearOver()
      document.documentElement.classList.remove('jr-dragging')
      setGhost(null)
      // El click que el navegador dispara después del pointerup no tiene que abrir el panel.
      setTimeout(() => { if (st.current === s) st.current = null }, 0)
      if (commit && s.over) fns.current.onMove(s.id, s.over)
    }
    const up = (ev) => { if (ev.pointerId === e.pointerId) end(true) }
    const cancel = (ev) => { if (ev.pointerId === e.pointerId) end(false) }
    const esc = (ev) => { if (ev.key === 'Escape' && s.on) { ev.preventDefault(); ev.stopPropagation(); end(false) } }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', esc, true)
  }, [])

  const onClickCapture = useCallback((e) => {
    if (st.current?.on) { e.preventDefault(); e.stopPropagation() }
  }, [])

  const bind = useCallback((item, lane) => ({ onPointerDown: (e) => start(e, item, lane), onClickCapture }), [start, onClickCapture])
  return { bind: onMove ? bind : null, ghost, ghostEl }
}

function Canvas({ board, matches, activeId, clientOf, onOpen, onOpenF2, f2Count, canMove, onMove, storageKey, searchKey }) {
  const rf = useReactFlow()
  const { bind: drag, ghost, ghostEl } = useCardDrag(canMove, onMove)
  const auto = useMemo(() => canvasLayout(board), [board])
  const [saved, setSaved] = useState(() => readSaved(storageKey))
  const positions = useMemo(() => mergePositions(auto, saved), [auto, saved])
  const wrap = useRef(null)
  const [hint, setHint] = useState(true)

  const dataFor = useCallback((lane) => ({
    lane, items: board.lanes[lane.key], matches, activeId, clientOf, onOpen, drag,
    sourceTop: lane.key === 'mvp' && f2Count > 0, targetTop: lane.key === 'fase2' && f2Count > 0,
  }), [board, matches, activeId, clientOf, onOpen, f2Count, drag])

  const [nodes, setNodes] = useState(() => JOURNEY_LANES.map((l) => ({
    id: l.key, type: 'lane', position: positions[l.key], dragHandle: '.jr-drag', data: dataFor(l),
  })))

  useEffect(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, position: n.dragging ? n.position : positions[n.id], data: dataFor(JOURNEY_LANES.find((l) => l.key === n.id)) })))
  }, [positions, dataFor])

  const onNodesChange = useCallback((changes) => {
    setNodes((ns) => applyNodeChanges(changes.filter((c) => c.type !== 'remove' && c.type !== 'add' && c.type !== 'replace'), ns))
  }, [])

  const onNodeDragStop = useCallback((_, node) => {
    setSaved((s) => {
      const next = { ...(s && typeof s === 'object' ? s : {}), [node.id]: { x: Math.round(node.position.x), y: Math.round(node.position.y) } }
      writeSaved(storageKey, next)
      return next
    })
  }, [storageKey])

  const relayout = () => {
    writeSaved(storageKey, null)
    setSaved(null)
    setTimeout(() => rf.fitView({ ...FIT, duration: reduced() ? 0 : 480 }), 30)
  }

  const edges = useMemo(() => {
    const has = (k) => board.lanes[k].some((it) => matches.has(it.project.id))
    const out = EDGES.map(([a, b]) => ({
      id: `${a}-${b}`, source: a, target: b, type: 'flow', markerEnd: 'url(#jr-arrow)',
      sourceHandle: b === 'standby' ? 'b' : 'r', targetHandle: b === 'standby' ? 'in' : 'l',
      focusable: false, selectable: false, domAttributes: { 'data-dim': matches && !has(a) && !has(b) ? '1' : undefined },
    }))
    if (f2Count > 0) {
      out.push({
        id: 'f2', source: 'mvp', target: 'fase2', sourceHandle: 't', targetHandle: 't', type: 'f2', className: 'jr-e-f2',
        focusable: false, selectable: false, zIndex: 1, data: { count: f2Count, onOpen: onOpenF2 },
      })
    }
    return out
  }, [f2Count, onOpenF2, matches, board])

  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => {
      const hit = matches ? JOURNEY_LANES.filter((l) => board.lanes[l.key].some((it) => matches.has(it.project.id))).map((l) => ({ id: l.key })) : []
      rf.fitView({ ...FIT, nodes: hit.length ? hit : undefined, duration: reduced() ? 0 : 420 })
    }, 280)
    return () => clearTimeout(t)
  }, [searchKey])

  /* Con Tab el navegador corre el scroll del contenedor del lienzo (overflow:hidden) para mostrar
     la fila enfocada y lo desalinea del viewport de React Flow: se vuelve a 0 y se mueve el viewport. */
  const onFocusCapture = (e) => {
    const root = wrap.current?.querySelector('.react-flow')
    if (!root || !root.contains(e.target)) return
    if (root.scrollTop || root.scrollLeft) { root.scrollTop = 0; root.scrollLeft = 0 }
    const box = root.getBoundingClientRect()
    const r = e.target.getBoundingClientRect()
    if (r.top < box.top + 8 || r.bottom > box.bottom - 8 || r.left < box.left + 8 || r.right > box.right - 8) {
      const p = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      rf.setCenter(p.x, p.y, { zoom: rf.getZoom(), duration: 0 })
    }
  }

  return (
    <div className="jr-cv" ref={wrap} onFocusCapture={onFocusCapture}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <marker id="jr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1.5 9 5 1 8.5z" style={{ fill: 'var(--border-strong)' }} />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop} onMoveStart={(e) => { if (e) setHint(false) }} onNodeDragStart={() => setHint(false)}
        fitView fitViewOptions={FIT} minZoom={0.3} maxZoom={1.75}
        nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null}
        selectionKeyCode={null} multiSelectionKeyCode={null} selectNodesOnDrag={false}
        zoomOnDoubleClick={false} snapToGrid snapGrid={[8, 8]}
        attributionPosition="bottom-center" ariaLabelConfig={ARIA}
        aria-label="Lienzo del recorrido de clientes"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} />
        <MiniMap pannable zoomable nodeBorderRadius={10} nodeClassName={(n) => `mm-${n.id}`} style={{ width: 132, height: 84 }} />
        <Tools onLayout={relayout} custom={!!saved && Object.keys(saved).length > 0} />
        {matches && matches.size === 0
          ? <Panel position="top-left" className="jr-nores" role="status">Nadie coincide con la búsqueda</Panel>
          : hint && <Panel position="top-left" className="jr-hint">Arrastrá el fondo para moverte, cada tramo desde su encabezado y cada cliente a otro tramo</Panel>}
      </ReactFlow>
      {ghost && createPortal(
        <div className="jr-ghost" ref={ghostEl} aria-hidden="true" style={{ width: ghost.w, transform: ghost.t, '--lc': `var(${JOURNEY_LANES.find((l) => l.key === ghost.lane).colorVar})` }}>
          <Point item={ghost.item} client={clientOf(ghost.item.project.clientId)} onOpen={() => {}} />
        </div>,
        document.body
      )}
    </div>
  )
}

export default function RecorridoCanvas(props) {
  return (
    <ReactFlowProvider>
      <style>{CSS}</style>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
