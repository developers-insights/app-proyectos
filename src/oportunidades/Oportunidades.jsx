import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { fmtDay } from '../lib/stores.js'
import { esSoloLectura } from '../lib/soloLectura.js'
import { vistaOportunidades, categoriaMeta, marcarDescartada, deshacerDescarte, normalizeOpportunity } from '../lib/oportunidades.js'

/*
 * "Oportunidades" del proyecto (call del 13/11): la IA lee el proyecto y propone qué más
 * ofrecerle al cliente. "La ofrecí" la deja en el tablero de Upsell de Speed Funnels, que
 * es donde se sigue. Se genera sólo cuando alguien la pide y queda guardada con su fecha.
 *
 * Lo que dispara la edge function (generar, ofrecer) se refleja al instante con un estado
 * local que gana mientras la fila de la base no tenga un updatedAt más nuevo.
 */

const CSS = `
.op-sec{margin:0 0 26px}
.op-sec .pd-h .op-meta{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-faint)}
.op-lead{margin:-4px 0 12px;font-size:12.5px;color:var(--text-dim);line-height:1.5;max-width:68ch}
.op-empty{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 18px;border-radius:16px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--border)}
.op-empty .tx{flex:1 1 280px;min-width:0}
.op-empty b{display:block;font-size:14px;letter-spacing:-.01em}
.op-empty p{margin:4px 0 0;font-size:12.5px;line-height:1.5;color:var(--text-dim)}
.op-go{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:11px;border:0;cursor:pointer;
  font-size:13px;font-weight:650;color:var(--accent-contrast);background:var(--accent);
  transition:transform .16s var(--e),filter .2s var(--e)}
.op-go:hover{filter:brightness(1.07)}
.op-go:active{transform:scale(.97)}
.op-go:disabled{opacity:.55;cursor:default;transform:none;filter:none}
.op-again{display:inline-flex;align-items:center;gap:6px;height:30px;white-space:nowrap;padding:0 11px;border-radius:9px;border:0;cursor:pointer;
  font-size:12.5px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:color .2s var(--e),box-shadow .2s var(--e),transform .16s var(--e)}
.op-again:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--accent-line)}
.op-again:active{transform:scale(.97)}
.op-again:disabled{opacity:.5;cursor:default}
.op-again svg{transition:transform .5s var(--e)}
.op-again[aria-busy="true"] svg{animation:op-spin 1s linear infinite}
@keyframes op-spin{to{transform:rotate(360deg)}}
.op-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.op-card{--oc:var(--accent);position:relative;display:flex;flex-direction:column;gap:10px;padding:15px 16px 14px;border-radius:16px;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border);overflow:hidden;min-width:0}
.op-card::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:var(--oc);opacity:.85}
.op-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.op-cat{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:650;
  letter-spacing:.01em;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.op-cat i{width:6px;height:6px;border-radius:50%;background:var(--oc)}
.op-amt{margin-left:auto;font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:12px;font-weight:600;color:var(--text)}
.op-amt.none{font-family:inherit;font-weight:500;color:var(--text-faint)}
.op-card h3{margin:0;font-size:15px;line-height:1.3;letter-spacing:-.018em;overflow-wrap:anywhere}
.op-why{margin:0;font-size:13px;line-height:1.55;color:var(--text-dim)}
.op-sig{margin:0;display:flex;gap:7px;font-size:12px;line-height:1.45;color:var(--text-faint)}
.op-sig svg{flex:none;margin-top:2px}
.op-say{position:relative;margin:2px 0 0;padding:10px 38px 10px 12px;border-radius:12px;background:var(--bg-elevated);
  box-shadow:inset 0 0 0 1px var(--border);font-size:13px;line-height:1.5;color:var(--text)}
.op-say small{display:block;margin-bottom:3px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint)}
.op-copy{position:absolute;right:6px;top:6px;display:grid;place-items:center;width:28px;height:28px;border-radius:8px;border:0;cursor:pointer;
  color:var(--text-faint);background:transparent;transition:color .2s var(--e),background .2s var(--e)}
.op-copy:hover{color:var(--text);background:var(--card-hover)}
.op-act{display:flex;gap:8px;margin-top:auto;padding-top:4px}
.op-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;border-radius:10px;border:0;cursor:pointer;
  font-size:13px;font-weight:650;transition:transform .16s var(--e),box-shadow .2s var(--e),background .2s var(--e),color .2s var(--e)}
.op-btn:active{transform:scale(.97)}
.op-btn.yes{color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border-strong)}
.op-btn.yes:hover{box-shadow:inset 0 0 0 1px var(--green)}
.op-btn.no{flex:0 0 auto;padding:0 14px;color:var(--text-dim);background:transparent;box-shadow:inset 0 0 0 1px var(--border)}
.op-btn.no:hover{color:var(--text)}
.op-st{display:flex;align-items:flex-start;gap:8px;padding:9px 11px;border-radius:11px;font-size:12.5px;line-height:1.45;
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);color:var(--text-dim)}
.op-st svg{flex:none;margin-top:1px}
.op-st.ok svg{color:var(--green)}
.op-st.warn svg{color:var(--yellow)}
.op-st.err svg{color:var(--red)}
.op-st b{color:var(--text);font-weight:650}
.op-st .lnk{background:none;border:0;padding:0;margin-left:2px;color:var(--accent);font:inherit;font-weight:650;cursor:pointer}
.op-pick{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.op-pick select{flex:1 1 200px;min-width:0;height:34px}
.op-skel{display:flex;flex-direction:column;gap:10px;padding:15px 16px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.op-skel .skel{height:12px}
.op-think{display:flex;align-items:center;gap:9px;margin:0 0 12px;font-size:12.5px;color:var(--text-dim)}
.op-think i{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:op-pulse 1.2s var(--e) infinite}
@keyframes op-pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
.op-err{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:12.5px;
  color:var(--text);background:var(--card);box-shadow:inset 0 0 0 1px var(--red)}
.op-err svg{color:var(--red);flex:none}
.op-more{margin-top:12px;background:none;border:0;padding:6px 0;color:var(--text-dim);font-size:12.5px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.op-more:hover{color:var(--text)}
.op-more svg{transition:transform .25s var(--e)}
.op-more[aria-expanded="true"] svg{transform:rotate(90deg)}
.op-seen{margin:8px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.op-seen li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 12px;border-radius:12px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);font-size:13px}
.op-seen li .t{flex:1 1 220px;min-width:0;overflow-wrap:anywhere}
.op-seen li .t small{display:block;margin-top:2px;font-size:11.5px;color:var(--text-faint)}
.op-seen li.off .t > span{color:var(--text-faint);text-decoration:line-through;text-decoration-color:var(--border-strong)}
.op-sec.compact .op-grid{grid-template-columns:1fr}
.op-sec.compact .op-card{padding:13px 13px 12px}
.op-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.op-think i,.op-again[aria-busy="true"] svg{animation:none}}
@media (max-width:640px){
  .op-grid{grid-template-columns:1fr}
  .op-btn{height:44px}
  .op-go{width:100%;justify-content:center;height:44px}
  .op-sec .pd-h .op-meta{margin-left:0;width:100%}
}
`

const COLOR = {
  fase_2: '--violet', plan_mensual: '--green', marketing: '--blue', ciberseguridad: '--red',
  nuevo_sistema: '--pink', mejora: '--accent', otro: '--text-dim',
}

const VIA = { venta: 'por la venta', mail: 'por el mail', proyecto: 'por el nombre del proyecto', nombre: 'por el nombre', manual: 'elegido a mano' }

const montoTexto = (o) => {
  if (!o.montoUsd) return null
  const n = 'USD ' + Math.round(o.montoUsd).toLocaleString('es-AR')
  return o.cobro === 'mensual' ? `${n} por mes` : n
}

async function llamar(supabase, body) {
  if (!supabase) return { error: 'Sin conexión con la base: esto anda con la app en línea.' }
  const { data, error } = await supabase.functions.invoke('oportunidades', { body })
  if (!error) return { data }
  let msg = 'No pudimos hablar con el servidor. Probá de nuevo.'
  try { const b = await error.context.json(); if (b && b.error) msg = b.error } catch { /* sin cuerpo */ }
  return { error: msg }
}

function Skeleton() {
  return (
    <div className="op-grid" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="op-skel">
          <div className="skel" style={{ width: 90, height: 20, borderRadius: 999 }} />
          <div className="skel" style={{ width: '82%', height: 15 }} />
          <div className="skel" style={{ width: '100%' }} />
          <div className="skel" style={{ width: '64%' }} />
          <div className="skel" style={{ width: '100%', height: 52, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  )
}

function EstadoTablero({ op, puede, onElegir, onReintentar, candidatos, who }) {
  const [elegido, setElegido] = useState('')
  const sf = op.sf || {}
  const quien = op.ofrecidaPor ? who(op.ofrecidaPor) : null
  const cuando = op.ofrecidaAt ? fmtDay(op.ofrecidaAt) : ''
  const base = `Ofrecida${quien ? ` por ${quien}` : ''}${cuando ? ` el ${cuando}` : ''}`
  if (sf.estado === 'pendiente') {
    return <div className="op-st" role="status"><I2.refresh width={14} height={14} /><span>{base}. Anotándola en el tablero de Upsell…</span></div>
  }
  if (sf.estado === 'ok') {
    return (
      <div className="op-st ok"><I2.check width={14} height={14} />
        <span>{base}. Está en el tablero de Upsell{sf.cliente ? <> con <b>{sf.cliente}</b></> : ''}{sf.via && VIA[sf.via] ? ` (${VIA[sf.via]})` : ''}.</span>
      </div>
    )
  }
  if (sf.estado === 'sin_cliente') {
    return (
      <div className="op-st warn"><I2.alert width={14} height={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {base}. Para que entre al tablero de Upsell falta decir quién es este cliente en Finanzas.
          {puede && !candidatos && <button type="button" className="lnk" onClick={onElegir}>Elegir el cliente</button>}
          {puede && candidatos && (
            <div className="op-pick">
              <label className="op-sr" htmlFor={`op-c-${op.id}`}>Cliente en Finanzas</label>
              <select id={`op-c-${op.id}`} className="input" value={elegido} onChange={(e) => setElegido(e.target.value)}>
                <option value="">Elegí el cliente…</option>
                {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button type="button" className="op-again" disabled={!elegido} onClick={() => onReintentar(Number(elegido))}>Guardar</button>
            </div>
          )}
        </div>
      </div>
    )
  }
  if (sf.estado === 'error') {
    return (
      <div className="op-st err"><I2.alert width={14} height={14} />
        <span>{base}, pero no llegó al tablero de Upsell: {sf.error || 'algo falló'}{puede && <> <button type="button" className="lnk" onClick={() => onReintentar(null)}>Reintentar</button></>}</span>
      </div>
    )
  }
  return <div className="op-st ok"><I2.check width={14} height={14} /><span>{base}.</span></div>
}

function Tarjeta({ op, puede, onOfrecer, onDescartar, onElegir, candidatos, who, reduce }) {
  const cat = categoriaMeta(op.categoria)
  const [copiado, setCopiado] = useState(false)
  const monto = montoTexto(op)
  const copiar = async () => {
    try { await navigator.clipboard.writeText(op.frase); setCopiado(true); setTimeout(() => setCopiado(false), 1600) } catch { /* sin permiso */ }
  }
  return (
    <motion.article className="op-card" style={{ '--oc': `var(${COLOR[op.categoria] || '--accent'})` }} layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: .97 }}
      transition={{ duration: .32, ease: [.22, 1, .36, 1] }}>
      <div className="op-top">
        <span className="op-cat"><i aria-hidden="true" />{cat.label}</span>
        <span className={`op-amt${monto ? '' : ' none'}`}>{monto || 'sin estimado'}</span>
      </div>
      <h3>{op.titulo}</h3>
      {op.porQue && <p className="op-why">{op.porQue}</p>}
      {op.senal && <p className="op-sig"><I2.flag width={12} height={12} aria-hidden="true" /><span>{op.senal}</span></p>}
      {op.frase && (
        <blockquote className="op-say">
          <small>Para abrir la charla</small>
          {op.frase}
          <button type="button" className="op-copy" onClick={copiar} aria-label={copiado ? 'Frase copiada' : 'Copiar la frase'} title={copiado ? 'Copiada' : 'Copiar'}>
            {copiado ? <I2.check width={14} height={14} /> : <I2.copy width={14} height={14} />}
          </button>
        </blockquote>
      )}
      {op.estado === 'ofrecida'
        ? <EstadoTablero op={op} puede={puede} candidatos={candidatos} who={who} onElegir={onElegir} onReintentar={(fc) => onOfrecer(op, fc)} />
        : puede && (
          <div className="op-act">
            <button type="button" className="op-btn yes" onClick={() => onOfrecer(op, null)}><I2.check width={14} height={14} /> La ofrecí</button>
            <button type="button" className="op-btn no" onClick={() => onDescartar(op)}>No va</button>
          </div>
        )}
    </motion.article>
  )
}

export function OportunidadesSection({ project, compact = false }) {
  const { data, myId, supabase, opportunityStore } = useApp()
  const reduce = useReducedMotion()
  const id = useId()
  const me = (data.team || []).find((u) => u.id === myId)
  const puede = !!supabase && !esSoloLectura() && (!me || me.access === 'full')
  const who = (uid) => (data.team || []).find((u) => u.id === uid)?.name || 'alguien del equipo'

  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState('')
  const [recien, setRecien] = useState(null)
  const [local, setLocal] = useState({})
  const [candidatos, setCandidatos] = useState({})
  const [verVistas, setVerVistas] = useState(false)
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])
  useEffect(() => { setRecien(null); setLocal({}); setCandidatos({}); setError(''); setVerVistas(false) }, [project.id])

  const items = useMemo(() => {
    const byId = new Map((opportunityStore?.items || []).map((o) => [o.id, o]))
    if (recien && recien.projectId === project.id) {
      for (const o of byId.values()) if (o.projectId === project.id && o.estado === 'nueva' && !recien.ids.has(o.id)) byId.delete(o.id)
      for (const o of recien.filas) if (!byId.has(o.id)) byId.set(o.id, o)
    }
    for (const [k, v] of Object.entries(local)) {
      const s = byId.get(k)
      if (!s || (v.updatedAt || '') >= (s.updatedAt || '')) byId.set(k, normalizeOpportunity(v))
    }
    return [...byId.values()]
  }, [opportunityStore?.items, recien, local, project.id])
  const v = vistaOportunidades(items, project.id)
  const hay = v.nuevas.length > 0 || v.vistas.length > 0

  const generar = async () => {
    if (!puede || pensando) return
    setPensando(true); setError('')
    const r = await llamar(supabase, { accion: 'generar', proyecto: project.id })
    if (!vivo.current) return
    setPensando(false)
    if (r.error) { setError(r.error); return }
    const filas = (r.data?.oportunidades || []).map(normalizeOpportunity)
    setRecien({ projectId: project.id, filas, ids: new Set(filas.map((f) => f.id)) })
  }

  const ofrecer = async (op, finClientId) => {
    if (!puede) return
    const ahora = new Date().toISOString()
    setLocal((m) => ({ ...m, [op.id]: { ...op, estado: 'ofrecida', ofrecidaAt: op.ofrecidaAt || ahora, ofrecidaPor: op.ofrecidaPor || myId || null, sf: { estado: 'pendiente' }, updatedAt: '9999' } }))
    const r = await llamar(supabase, { accion: 'ofrecer', id: op.id, ...(finClientId ? { finClientId } : {}) })
    if (!vivo.current) return
    if (r.error) {
      setLocal((m) => ({ ...m, [op.id]: { ...op, estado: 'ofrecida', ofrecidaAt: op.ofrecidaAt || ahora, ofrecidaPor: op.ofrecidaPor || myId || null, sf: { estado: 'error', error: r.error }, updatedAt: '9999' } }))
      return
    }
    if (r.data?.candidatos) setCandidatos((m) => ({ ...m, [op.id]: r.data.candidatos }))
    else setCandidatos((m) => { const n = { ...m }; delete n[op.id]; return n })
    setLocal((m) => ({ ...m, [op.id]: r.data?.oportunidad ? { ...r.data.oportunidad, id: op.id } : m[op.id] }))
  }

  const elegirCliente = (op) => ofrecer(op, null)

  const descartar = (op) => {
    if (!puede || !opportunityStore) return
    opportunityStore.patch(op.id, (x) => marcarDescartada(x, myId || null))
  }
  const deshacer = (op) => {
    if (!puede || !opportunityStore) return
    opportunityStore.patch(op.id, (x) => deshacerDescarte(x))
  }

  const generadaPor = v.nuevas[0]?.generadaPor
  return (
    <section className={`op-sec${compact ? ' compact' : ''}`} aria-labelledby={`${id}-t`} aria-busy={pensando}>
      <style>{CSS}</style>
      {!compact && (
        <div className="pd-h">
          <h2 id={`${id}-t`}>Oportunidades</h2>
          <span className="sub">qué más podemos hacer por este cliente</span>
          {hay && (
            <span className="op-meta">
              {v.generadaAt && <span>Pensadas el {fmtDay(v.generadaAt)}{generadaPor ? ` por ${who(generadaPor)}` : ''}</span>}
              {puede && (
                <button type="button" className="op-again" onClick={generar} disabled={pensando} aria-busy={pensando}>
                  <I2.refresh width={13} height={13} /> {pensando ? 'Pensando…' : 'Volver a pensar'}
                </button>
              )}
            </span>
          )}
        </div>
      )}
      {compact && <span id={`${id}-t`} className="op-sr">Oportunidades</span>}

      {error && (
        <div className="op-err" role="alert">
          <I2.alert width={15} height={15} /><span style={{ flex: 1, minWidth: 0 }}>{error}</span>
          {puede && <button type="button" className="op-again" onClick={generar} disabled={pensando}>Probar de nuevo</button>}
        </div>
      )}

      {pensando && (
        <>
          <p className="op-think" role="status"><i aria-hidden="true" />Leyendo el plan, las notas y las tareas de {project.name}. Tarda alrededor de medio minuto.</p>
          {!v.nuevas.length && <Skeleton />}
        </>
      )}

      {!hay && !pensando && (
        <div className="op-empty">
          <div className="tx">
            <b>{puede ? 'Todavía no buscamos oportunidades para este proyecto' : 'Todavía nadie buscó oportunidades para este proyecto'}</b>
            <p>La IA lee el roadmap, las notas del servicio, las tareas pendientes y lo que ya pagó, y propone de 3 a 5 cosas concretas para ofrecerle.</p>
          </div>
          {puede && <button type="button" className="op-go" onClick={generar}><I2.sparkle width={15} height={15} /> Buscar oportunidades</button>}
        </div>
      )}

      {compact && hay && puede && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button type="button" className="op-again" onClick={generar} disabled={pensando} aria-busy={pensando}>
            <I2.refresh width={13} height={13} /> {pensando ? 'Pensando…' : 'Volver a pensar'}
          </button>
        </div>
      )}

      {v.nuevas.length > 0 && (
        <div className="op-grid" style={pensando ? { opacity: .5, transition: 'opacity .3s' } : undefined}>
          <AnimatePresence initial={false} mode="popLayout">
            {v.nuevas.map((op) => (
              <Tarjeta key={op.id} op={op} puede={puede} who={who} reduce={reduce} candidatos={candidatos[op.id]}
                onOfrecer={ofrecer} onDescartar={descartar} onElegir={() => elegirCliente(op)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {hay && !v.nuevas.length && !pensando && (
        <p className="op-lead">Ya decidieron todas las que había. {puede ? 'Si cambió algo del proyecto, pedile que vuelva a pensar.' : ''}</p>
      )}

      {v.vistas.length > 0 && (
        <>
          <button type="button" className="op-more" aria-expanded={verVistas} onClick={() => setVerVistas((x) => !x)}>
            <I2.chevR width={12} height={12} /> {verVistas ? 'Ocultar las ya vistas' : `Ya vistas (${v.vistas.length})`}
          </button>
          {verVistas && (
            <ul className="op-seen">
              {v.vistas.map((op) => op.estado === 'ofrecida'
                ? (
                  <li key={op.id} style={{ display: 'block' }}>
                    <div className="t" style={{ marginBottom: 8 }}><span>{op.titulo}</span><small>{categoriaMeta(op.categoria).label}{montoTexto(op) ? ` · ${montoTexto(op)}` : ''}</small></div>
                    <EstadoTablero op={op} puede={puede} candidatos={candidatos[op.id]} who={who} onElegir={() => elegirCliente(op)} onReintentar={(fc) => ofrecer(op, fc)} />
                  </li>
                )
                : (
                  <li key={op.id} className="off">
                    <div className="t"><span>{op.titulo}</span><small>No va{op.descartadaPor ? `, dijo ${who(op.descartadaPor)}` : ''}{op.descartadaAt ? ` el ${fmtDay(op.descartadaAt)}` : ''}</small></div>
                    {puede && <button type="button" className="op-again" onClick={() => deshacer(op)}>Deshacer</button>}
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
