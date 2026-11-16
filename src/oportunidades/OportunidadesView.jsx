import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { esSoloLectura } from '../lib/soloLectura.js'
import { stageMeta } from '../lib/stages.js'
import { CATEGORIAS, categoriaMeta, tableroOportunidades, filtrarFilas, ESTADOS_FILA } from '../lib/oportunidades.js'
import { OportunidadesSection } from './Oportunidades.jsx'
import ProyectoAvatar from '../ui/ProyectoAvatar.jsx'

/*
 * Sección "Oportunidades": el mismo motor que ya vive en el detalle del proyecto, pero
 * en una sola pantalla y por cliente — para contestar "a quién le podemos ofrecer algo
 * y qué" sin abrir 30 proyectos. La columna de la izquierda ordena por plata sobre la
 * mesa; la derecha es la sección de siempre (OportunidadesSection, embedded).
 *
 * "Buscar en los que faltan" es la única puerta a gastar en la IA: va de a un proyecto,
 * muestra en qué anda y se puede cortar. Nunca arranca solo.
 */

const COLOR = {
  fase_2: '--violet', plan_mensual: '--green', marketing: '--blue', ciberseguridad: '--red',
  nuevo_sistema: '--pink', mejora: '--accent', otro: '--text-dim',
}

const CSS = `
.ov{--rail:336px}
.ov-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:20px}
.ov-hero h1{font-size:32px;line-height:1.05;letter-spacing:-.03em;margin:0}
.ov-hero .lead{margin-top:8px;font-size:13.5px;line-height:1.55;color:var(--text-dim);max-width:52ch}
.ov-run{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:0}
.ov-cta{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 17px;border-radius:12px;border:0;cursor:pointer;
  font-size:13.5px;font-weight:650;color:var(--accent-contrast);background:var(--accent);white-space:nowrap;
  transition:transform .18s var(--e),filter .2s var(--e)}
.ov-cta:hover{filter:brightness(1.07)}
.ov-cta:active{transform:scale(.975)}
.ov-cta:disabled{opacity:.5;cursor:default;transform:none;filter:none}
.ov-ask{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;padding:11px 13px;border-radius:13px;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border);font-size:12.5px;line-height:1.5;color:var(--text-dim);max-width:46ch}
.ov-ask b{color:var(--text);font-weight:650}
.ov-run-st{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--text-dim)}
.ov-run-st i{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:ov-pulse 1.2s var(--e) infinite;flex:none}
@keyframes ov-pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}

.ov-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:10px;margin-bottom:18px}
.ov-kpi{position:relative;padding:13px 15px 14px;border-radius:15px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);overflow:hidden}
.ov-kpi::before{content:'';position:absolute;inset:0 auto 0 0;width:2px;background:var(--kc,var(--accent));opacity:.9}
.ov-kpi .k{display:block;font-size:10.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--text-faint)}
.ov-kpi .v{display:block;margin-top:6px;font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;
  font-size:23px;font-weight:600;letter-spacing:-.02em;color:var(--text);line-height:1}
.ov-kpi .h{display:block;margin-top:5px;font-size:11.5px;color:var(--text-faint);line-height:1.4}

.ov-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;max-width:100%}
.ov-bar .pj-seg{max-width:100%;overflow-x:auto;scrollbar-width:none}
.ov-bar .pj-seg::-webkit-scrollbar{display:none}
.ov-bar .pj-seg > button{flex:none}
.ov-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.ov-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;border:0;cursor:pointer;
  font-size:12px;font-weight:600;color:var(--text-dim);background:var(--card);box-shadow:inset 0 0 0 1px var(--border);
  transition:color .2s var(--e),box-shadow .2s var(--e),background .2s var(--e)}
.ov-chip i{width:6px;height:6px;border-radius:50%;background:var(--cc,var(--accent))}
.ov-chip:hover{color:var(--text)}
.ov-chip[data-on="1"]{color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--accent-line)}
.ov-chip .n{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-faint)}

.ov-split{display:grid;grid-template-columns:var(--rail) minmax(0,1fr);gap:18px;align-items:start;min-width:0}
.ov-rail{display:flex;flex-direction:column;gap:7px;min-width:0;position:sticky;top:0;max-height:calc(100vh - 60px);overflow:auto;padding:1px 2px 20px 1px;
  scrollbar-width:thin}
.ov-rail-h{display:flex;align-items:baseline;gap:8px;padding:0 2px 2px;font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--text-faint)}
.ov-row{position:relative;display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:11px 12px;border-radius:14px;border:0;
  cursor:pointer;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);
  transition:background .18s var(--e),box-shadow .18s var(--e),transform .18s var(--e)}
.ov-row:hover{background:var(--card-hover)}
.ov-row:active{transform:scale(.995)}
.ov-row[data-on="1"]{background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--accent-line)}
.ov-row[data-on="1"] .ov-ini{color:var(--accent-contrast);background:var(--accent);box-shadow:none}
.ov-row .rail{position:absolute;left:0;top:11px;bottom:11px;width:2px;border-radius:2px;background:var(--accent)}
.ov-ini{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;font-size:12px;font-weight:700;
  letter-spacing:.02em;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:background .18s var(--e),color .18s var(--e)}
.ov-tx{flex:1;min-width:0}
.ov-tx b{display:block;font-size:13.5px;font-weight:620;letter-spacing:-.012em;color:var(--text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ov-tx span{display:block;margin-top:2px;font-size:11.5px;color:var(--text-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ov-meta{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.ov-n{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:700;
  font-family:'JetBrains Mono',monospace;color:var(--accent-contrast);background:var(--accent)}
.ov-n.off{font-family:inherit;font-weight:600;color:var(--text-faint);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.ov-usd{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-dim)}

.ov-main{min-width:0;border-radius:20px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);padding:20px 22px 22px}
.ov-main-h{display:flex;align-items:flex-start;gap:13px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:16px;
  box-shadow:inset 0 -1px 0 var(--border)}
.ov-main-h .tx{flex:1 1 240px;min-width:0}
.ov-main-h h2{margin:0;font-size:21px;line-height:1.2;letter-spacing:-.025em;overflow-wrap:anywhere}
.ov-main-h .sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:12.5px;color:var(--text-faint)}
.ov-stage{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:650;
  color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.ov-stage i{width:6px;height:6px;border-radius:50%;background:var(--sc,var(--accent))}
.ov-open{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:10px;border:0;cursor:pointer;
  font-size:12.5px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:color .2s var(--e),box-shadow .2s var(--e),transform .16s var(--e)}
.ov-open:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--accent-line)}
.ov-open:active{transform:scale(.97)}
.ov-back{display:none}

.ov-none{display:flex;flex-direction:column;align-items:center;gap:10px;padding:44px 24px;text-align:center}
.ov-none .ic{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;color:var(--text-faint);
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.ov-none b{font-size:15.5px;letter-spacing:-.015em}
.ov-none p{margin:0;font-size:13px;line-height:1.55;color:var(--text-faint);max-width:40ch}

@media (prefers-reduced-motion:reduce){.ov-run-st i{animation:none}}
@media (max-width:1100px){.ov{--rail:286px}}
@media (max-width:900px){
  .ov-split{grid-template-columns:1fr}
  .ov-rail{position:static;max-height:none;overflow:visible;padding-bottom:0}
  .ov-split[data-detail="1"] .ov-rail{display:none}
  .ov-split[data-detail="0"] .ov-main{display:none}
  .ov-main{padding:16px 15px 18px;border-radius:16px}
  .ov-back{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 9px;border-radius:10px;border:0;cursor:pointer;
    font-size:12.5px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
    margin-bottom:12px}
  .ov-hero h1{font-size:26px}
  .ov-bar .pj-search{flex:1 1 180px;width:auto;max-width:none}
  .ov-run{align-items:stretch;width:100%}
  .ov-cta{width:100%;justify-content:center;height:46px}
  .ov-ask{max-width:none}
}
`

const usd = (n) => 'USD ' + Math.round(n).toLocaleString('es-AR')

function Kpi({ k, v, h, color }) {
  return (
    <div className="ov-kpi" style={{ '--kc': `var(${color})` }}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {h && <span className="h">{h}</span>}
    </div>
  )
}

function Fila({ f, on, onClick, reduce }) {
  const cat = f.ideas.length ? categoriaMeta(f.ideas[0].categoria) : null
  return (
    <motion.button type="button" className="ov-row" data-on={on ? '1' : '0'} onClick={onClick}
      aria-current={on ? 'true' : undefined}
      initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .26, ease: [.22, 1, .36, 1] }}>
      {on && <span className="rail" aria-hidden="true" />}
      <ProyectoAvatar project={f.project} texto={f.cliente} className="ov-ini" />
      <span className="ov-tx">
        <b>{f.cliente}</b>
        <span>{f.proyecto} · {f.etapa}{cat ? ` · ${cat.label}` : ''}</span>
      </span>
      <span className="ov-meta">
        {f.ideas.length > 0
          ? <span className="ov-n">{f.ideas.length}</span>
          : <span className="ov-n off">{f.estado === 'sin_explorar' ? 'sin ver' : 'al día'}</span>}
        {f.montoTop > 0 && <span className="ov-usd">{usd(f.montoTop)}</span>}
      </span>
    </motion.button>
  )
}

export default function OportunidadesView({ onOpenProject }) {
  const { data, supabase, opportunityStore } = useApp()
  const reduce = useReducedMotion()
  const puede = !!supabase && !esSoloLectura()

  const [estado, setEstado] = useState('todas')
  const [categoria, setCategoria] = useState('todas')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [detalle, setDetalle] = useState(false)     // en celular, la columna de la derecha
  const [confirmar, setConfirmar] = useState(false)
  const [corriendo, setCorriendo] = useState(null)  // { hechos, total, nombre }
  const cortar = useRef(false)
  const raiz = useRef(null)

  const { filas, totales } = useMemo(
    () => tableroOportunidades(opportunityStore?.items || [], data.projects || [], data.clients || []),
    [opportunityStore?.items, data.projects, data.clients],
  )
  const visibles = useMemo(() => filtrarFilas(filas, { q, estado, categoria }), [filas, q, estado, categoria])

  const porCategoria = useMemo(() => {
    const m = {}
    for (const f of filas) for (const c of f.categorias) m[c] = (m[c] || 0) + f.ideas.filter((o) => o.categoria === c).length
    return m
  }, [filas])
  const porEstado = useMemo(() => {
    const m = { todas: filas.length }
    for (const e of ESTADOS_FILA) m[e.key] = filas.filter((f) => f.estado === e.key).length
    return m
  }, [filas])

  // La fila elegida: la que tocaron, o la primera de la lista visible.
  const fila = useMemo(() => visibles.find((f) => f.id === sel) || visibles[0] || null, [visibles, sel])
  useEffect(() => { if (fila && fila.id !== sel) setSel(fila.id) }, [fila, sel])

  const faltan = useMemo(() => filas.filter((f) => f.estado === 'sin_explorar'), [filas])
  const cargando = opportunityStore && opportunityStore.ready === false && filas.length === 0

  const buscarEnLosQueFaltan = async () => {
    setConfirmar(false)
    cortar.current = false
    const lista = faltan
    for (let i = 0; i < lista.length; i++) {
      if (cortar.current) break
      setCorriendo({ hechos: i, total: lista.length, nombre: lista[i].proyecto })
      try { await supabase.functions.invoke('oportunidades', { body: { accion: 'generar', proyecto: lista[i].id } }) } catch { /* seguimos con el próximo */ }
    }
    setCorriendo(null)
  }

  /* En celular la derecha reemplaza a la lista: si la página quedó scrolleada,
     el detalle abre por la mitad. Subir al principio es parte de abrirlo. */
  const alPrincipio = () => {
    if (typeof window === 'undefined' || window.innerWidth > 900) return
    raiz.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }
  const elegir = (id) => { setSel(id); setDetalle(true); alPrincipio() }
  const volver = () => { setDetalle(false); alPrincipio() }

  return (
    <div className="view ov" ref={raiz} style={{ padding: '28px 34px 60px' }}>
      <style>{CSS}</style>

      <div className="ov-hero">
        <div style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 6 }}>Ventas</div>
          <h1>Oportunidades</h1>
          <div className="lead">
            Qué más le podemos ofrecer a cada cliente que ya nos compró. La IA lee el roadmap, las notas
            y lo que quedó pendiente de cada proyecto, y propone ideas concretas con la frase para abrir la charla.
          </div>
        </div>

        {puede && (
          <div className="ov-run">
            {corriendo
              ? (
                <>
                  <div className="ov-run-st" role="status">
                    <i aria-hidden="true" />
                    Pensando {corriendo.hechos + 1} de {corriendo.total} · {corriendo.nombre}
                  </div>
                  <button type="button" className="ov-open" onClick={() => { cortar.current = true }}>Cortar acá</button>
                </>
              )
              : confirmar
                ? (
                  <div className="ov-ask">
                    <span>Son <b>{faltan.length} consultas</b> a la IA, una por proyecto, y tarda alrededor de medio minuto cada una.</span>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="ov-cta" style={{ height: 34, padding: '0 13px', fontSize: 12.5 }} onClick={buscarEnLosQueFaltan}>Dale, buscá</button>
                      <button type="button" className="ov-open" onClick={() => setConfirmar(false)}>No</button>
                    </span>
                  </div>
                )
                : faltan.length > 0 && (
                  <button type="button" className="ov-cta" onClick={() => setConfirmar(true)}>
                    <I2.sparkle width={15} height={15} /> Buscar en los {faltan.length} que faltan
                  </button>
                )}
          </div>
        )}
      </div>

      <div className="ov-kpis">
        <Kpi k="Ideas para ofrecer" v={totales.ideas} h={`en ${totales.conIdeas} de ${totales.proyectos} clientes`} color="--accent" />
        <Kpi k="Si se venden todas" v={totales.montoUnico ? usd(totales.montoUnico) : '—'} h="estimado de la IA, de una vez" color="--green" />
        <Kpi k="Por mes" v={totales.montoMensual ? usd(totales.montoMensual) : '—'} h="planes y soporte recurrente" color="--blue" />
        <Kpi k="Sin explorar" v={totales.sinExplorar} h={totales.sinExplorar ? 'nadie les buscó nada todavía' : 'ya se miraron todos'} color="--violet" />
      </div>

      <div className="ov-bar">
        <div className="pj-seg" role="tablist" aria-label="Filtrar clientes">
          <button role="tab" aria-selected={estado === 'todas'} onClick={() => setEstado('todas')}>Todos <span className="n">{porEstado.todas}</span></button>
          {ESTADOS_FILA.map((e) => (
            <button key={e.key} role="tab" aria-selected={estado === e.key} onClick={() => setEstado(e.key)}>
              {e.label} <span className="n">{porEstado[e.key]}</span>
            </button>
          ))}
        </div>
        <label className="pj-search">
          <I2.search width={15} height={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente o idea" placeholder="Buscar cliente, proyecto o idea…" />
          {q && <button onClick={() => setQ('')} title="Limpiar búsqueda" style={{ display: 'flex', padding: 2, color: 'var(--text-faint)' }}><I2.x width={14} height={14} /></button>}
        </label>
      </div>

      {totales.ideas > 0 && (
        <div className="ov-chips" role="group" aria-label="Filtrar por tipo de oportunidad">
          <button type="button" className="ov-chip" data-on={categoria === 'todas' ? '1' : '0'} onClick={() => setCategoria('todas')}>
            Todo tipo <span className="n">{totales.ideas}</span>
          </button>
          {CATEGORIAS.filter((c) => porCategoria[c.key]).map((c) => (
            <button key={c.key} type="button" className="ov-chip" data-on={categoria === c.key ? '1' : '0'}
              style={{ '--cc': `var(${COLOR[c.key] || '--accent'})` }} onClick={() => setCategoria(categoria === c.key ? 'todas' : c.key)}>
              <i aria-hidden="true" />{c.label} <span className="n">{porCategoria[c.key]}</span>
            </button>
          ))}
        </div>
      )}

      {cargando && (
        <div className="ov-split" aria-hidden="true">
          <div className="ov-rail">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="pj-skel" style={{ height: 58, borderRadius: 14 }} />)}</div>
          <div className="pj-skel" style={{ height: 320, borderRadius: 20 }} />
        </div>
      )}

      {!cargando && visibles.length === 0 && (
        <div className="ov-none">
          <span className="ic"><I2.sparkle width={21} height={21} /></span>
          <b>{filas.length === 0 ? 'Todavía no hay clientes para mirar' : 'Nada coincide con el filtro'}</b>
          <p>
            {filas.length === 0
              ? 'Acá aparece cada cliente con proyecto vivo. Los internos y los cancelados quedan afuera.'
              : 'Probá con otro nombre, otro tipo de oportunidad o volvé a "Todos".'}
          </p>
        </div>
      )}

      {!cargando && visibles.length > 0 && (
        <div className="ov-split" data-detail={detalle ? '1' : '0'}>
          <div className="ov-rail" role="list">
            <div className="ov-rail-h">
              <span>{estado === 'todas' ? 'Clientes' : ESTADOS_FILA.find((e) => e.key === estado)?.label}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0 }}>{visibles.length}</span>
            </div>
            {visibles.map((f) => (
              <Fila key={f.id} f={f} on={fila && f.id === fila.id} reduce={reduce} onClick={() => elegir(f.id)} />
            ))}
          </div>

          <div className="ov-main">
            <button type="button" className="ov-back" onClick={volver}>
              <I2.chevR width={13} height={13} style={{ transform: 'scaleX(-1)' }} /> Clientes
            </button>
            {fila && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={fila.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: .24, ease: [.22, 1, .36, 1] }}>
                  <div className="ov-main-h">
                    <div className="tx">
                      <h2>{fila.cliente}</h2>
                      <div className="sub">
                        <span className="ov-stage" style={{ '--sc': `var(${stageMeta(fila.stage).colorVar})` }}><i aria-hidden="true" />{fila.etapa}</span>
                        <span>{fila.proyecto}</span>
                        {fila.ofrecidas.length > 0 && <span>· {fila.ofrecidas.length} ya ofrecida{fila.ofrecidas.length > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    {onOpenProject && (
                      <button type="button" className="ov-open" onClick={() => onOpenProject(fila.id)}>
                        Abrir el proyecto <I2.arrowRight width={13} height={13} />
                      </button>
                    )}
                  </div>
                  <OportunidadesSection project={fila.project} embedded />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
