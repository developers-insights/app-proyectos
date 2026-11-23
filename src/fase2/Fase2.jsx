import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { fmtDay } from '../lib/stores.js'
import { esSoloLectura } from '../lib/soloLectura.js'
import { normalizeOpportunity } from '../lib/oportunidades.js'
import {
  vistaFase2, nuevaNota, nuevaCall, marcarBorrada, vincularItem, itemAOportunidad, hayParecida,
  resolverLink, puedeVerFase2, puedeEditarFase2, llamadaTrabada, MIN_TEXTO_PEGADO, MAX_NOTA, MAX_TEXTO_CALL,
} from '../lib/fase2.js'

/*
 * "Fase 2" del proyecto (spec 2026-11-23): notas libres y calls de Fathom analizadas por la IA, y un
 * plan "Cómo llevarlo a Fase 2". La pantalla crea la entrada (así aparece al instante y no se pierde
 * lo escrito) y después le pide a la función `fase2` que baje y analice la call. Las notas se
 * escriben sin red; todo lo que usa la IA necesita la app en línea.
 */

const CSS = `
.f2-sec{margin:0 0 26px}
.f2-go{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:11px;border:0;cursor:pointer;
  font-size:13px;font-weight:650;color:var(--accent-contrast);background:var(--accent);
  transition:transform .16s var(--e),filter .2s var(--e)}
.f2-go:hover{filter:brightness(1.07)}
.f2-go:active{transform:scale(.97)}
.f2-go:disabled{opacity:.55;cursor:default;transform:none;filter:none}
.f2-again{display:inline-flex;align-items:center;gap:6px;height:30px;white-space:nowrap;padding:0 11px;border-radius:9px;border:0;cursor:pointer;
  font-size:12.5px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:color .2s var(--e),box-shadow .2s var(--e),transform .16s var(--e)}
.f2-again:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--accent-line)}
.f2-again:active{transform:scale(.97)}
.f2-again:disabled{opacity:.5;cursor:default}
.f2-again[aria-busy="true"] svg{animation:f2-spin 1s linear infinite}
@keyframes f2-spin{to{transform:rotate(360deg)}}
.f2-empty{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 18px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.f2-empty .tx{flex:1 1 280px;min-width:0}
.f2-empty b{display:block;font-size:14px;letter-spacing:-.01em}
.f2-empty p{margin:4px 0 0;font-size:12.5px;line-height:1.5;color:var(--text-dim)}
.f2-err{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:12.5px;color:var(--text);background:var(--card);box-shadow:inset 0 0 0 1px var(--red)}
.f2-err svg{color:var(--red);flex:none}
.f2-think{display:flex;align-items:center;gap:9px;margin:0 0 12px;font-size:12.5px;color:var(--text-dim)}
.f2-think i{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:f2-pulse 1.2s var(--e) infinite}
@keyframes f2-pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
.f2-more{margin-top:4px;background:none;border:0;padding:6px 0;color:var(--text-dim);font-size:12.5px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.f2-more:hover{color:var(--text)}
.f2-more svg{transition:transform .25s var(--e)}
.f2-more[aria-expanded="true"] svg{transform:rotate(90deg)}
.f2-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.f2-think i,.f2-again[aria-busy="true"] svg{animation:none}}
.f2-sum,.f2-say{padding:12px 14px;border-radius:12px;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.f2-say{box-shadow:inset 3px 0 0 var(--accent),inset 0 0 0 1px var(--border)}
.f2-sum p:last-child,.f2-say p:last-child{margin:0;font-size:13.5px;line-height:1.65;color:var(--text);max-width:80ch}
.f2-grp{--gc:var(--accent);min-width:0}
.f2-sh{display:flex;align-items:center;gap:8px;margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)}
.f2-sh i{width:8px;height:8px;border-radius:50%;background:var(--gc);flex:none}
.f2-sh span{display:inline-grid;place-items:center;min-width:20px;height:18px;padding:0 6px;border-radius:999px;font-size:11px;letter-spacing:0;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.f2-rows{margin:0;padding:0;list-style:none}
.f2-row{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:11px 0;border-top:1px solid var(--border)}
.f2-row:first-child{border-top:0}
.f2-row .tx{flex:1;min-width:0}
.f2-row .t{margin:0;font-size:13.5px;line-height:1.5;font-weight:550;color:var(--text);overflow-wrap:anywhere}
.f2-row .s{margin:3px 0 0;font-size:12.5px;line-height:1.5;color:var(--text-dim);overflow-wrap:anywhere}
.f2-row .q{margin:7px 0 0;padding:1px 0 1px 10px;border-left:2px solid var(--gc);font-size:12.5px;line-height:1.5;font-style:italic;color:var(--text-dim);overflow-wrap:anywhere}
.f2-row .q::before{content:'\\201C'}
.f2-row .q::after{content:'\\201D'}
.f2-ya{display:inline-flex;align-items:center;gap:5px;flex:none;padding-top:6px;font-size:12px;font-weight:600;color:var(--green)}
.f2-mas{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;padding-top:4px}
.f2-when{margin:0;font-size:13px;line-height:1.55;color:var(--text-dim)}
.f2-when b{color:var(--text)}
.f2-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px}
.f2-bar .input{flex:1 1 260px;min-width:0;height:38px}
.f2-lead{margin:0 0 12px;font-size:12.5px;color:var(--text-dim);line-height:1.5;max-width:68ch}
.f2-box{display:flex;flex-direction:column;gap:10px;margin:0 0 14px;padding:14px 15px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.f2-box textarea{width:100%;min-height:120px;resize:vertical}
.f2-box .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.f2-box .row small{margin-right:auto;font-size:11.5px;color:var(--text-faint)}
.f2-plan{--oc:var(--violet);position:relative;display:flex;flex-direction:column;gap:18px;margin:0 0 16px;padding:16px 17px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);overflow:hidden}
.f2-plan::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:var(--oc);opacity:.85}
.f2-plan h3{margin:0;font-size:15px;letter-spacing:-.018em;color:var(--text)}
.f2-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--text-faint)}
.f2-meta .sp{margin-left:auto}
.f2-k{margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint)}
.f2-stale{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 11px;border-radius:11px;font-size:12.5px;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--yellow)}
.f2-stale > span{flex:1 1 180px;min-width:0}
.f2-call{display:flex;flex-direction:column;gap:18px;padding:15px 16px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);min-width:0}
.f2-call h3{margin:0;font-size:14.5px;letter-spacing:-.015em;overflow-wrap:anywhere}
.f2-tag{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:650;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.f2-tag.err{box-shadow:inset 0 0 0 1px var(--red)}
.f2-tag.ok{box-shadow:inset 0 0 0 1px var(--green)}
.f2-feed{display:flex;flex-direction:column;gap:12px}
.f2-nota{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.f2-nota p{margin:0;flex:1;min-width:0;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.f2-nota small{display:block;margin-bottom:3px;font-size:11.5px;color:var(--text-faint)}
.f2-link{background:none;border:0;padding:0;color:var(--accent);font:inherit;font-size:12.5px;font-weight:650;cursor:pointer}
.f2-link:disabled{opacity:.5;cursor:default}
.f2-raw{margin:0;max-height:260px;overflow:auto;padding:10px 12px;border-radius:12px;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);font-size:12px;line-height:1.5;white-space:pre-wrap;color:var(--text-dim)}
@media (max-width:760px){.f2-row{flex-direction:column;gap:8px}.f2-bar .f2-go{width:100%;justify-content:center;height:44px}}
`

async function llamarFase2(supabase, body) {
  if (!supabase) return { error: 'Sin conexión con la base: esto anda con la app en línea.', servidor: false }
  const { data, error } = await supabase.functions.invoke('fase2', { body })
  if (!error) return { data }
  let msg = 'No pudimos hablar con el servidor. Probá de nuevo.'
  let entrada = null
  let servidor = false
  try {
    const b = await error.context.json()
    servidor = true
    if (b && b.error) msg = b.error
    if (b && b.entrada) entrada = b.entrada
  } catch { /* sin cuerpo: no llegó a la función */ }
  return { error: msg, entrada, servidor }
}

const ESTADO_TXT = { bajando: 'Bajando la call de Fathom…', analizando: 'Analizando la call…' }
const TIPO_SENAL = { presupuesto: 'Presupuesto', urgencia: 'Urgencia', decisor: 'Quién decide', fecha: 'Fecha', otra: 'Otra señal' }

/* Una lista de filas: el texto, debajo lo que dijo el cliente (si hay) y, a la derecha, la acción. */
function Filas({ filas }) {
  return (
    <ul className="f2-rows">
      {filas.map((f, i) => (
        <li key={i} className="f2-row">
          <div className="tx">
            <p className="t">{f.texto}</p>
            {f.sub && <p className="s">{f.sub}</p>}
            {f.cita && <blockquote className="q">{f.cita}</blockquote>}
          </div>
          {f.accion || null}
        </li>
      ))}
    </ul>
  )
}

function Grupo({ titulo, tono, cantidad, children }) {
  return (
    <section className="f2-grp" style={{ '--gc': `var(${tono})` }}>
      <h4 className="f2-sh"><i aria-hidden="true" />{titulo}<span>{cantidad}</span></h4>
      {children}
    </section>
  )
}

const YaEsOportunidad = () => <span className="f2-ya"><I2.check width={12} height={12} /> Ya es oportunidad</span>

function Items({ titulo, tono, items, onOportunidad, puede, lista, entrada }) {
  if (!items || !items.length) return null
  const filas = items.map((it, i) => ({
    texto: it.texto,
    cita: it.cita,
    accion: onOportunidad && (it.oportunidadId
      ? <YaEsOportunidad />
      : puede && <button type="button" className="f2-again" onClick={() => onOportunidad(entrada, lista, i)}>Pasar a oportunidad</button>),
  }))
  return <Grupo titulo={titulo} tono={tono} cantidad={items.length}><Filas filas={filas} /></Grupo>
}

function Llamada({ e, ahora, puede, puedeIA, onReintentar, onBorrar, onOportunidad }) {
  const [verTexto, setVerTexto] = useState(false)
  const a = e.analisis
  const trabada = llamadaTrabada(e, ahora)
  const enCurso = (e.estado === 'bajando' || e.estado === 'analizando') && !trabada
  const hayMas = !!a && (a.objeciones.length > 0 || a.senales.length > 0 || a.pendientes.length > 0)
  return (
    <article className="f2-call" aria-busy={enCurso}>
      <div className="f2-meta">
        <span className={`f2-tag${e.estado === 'error' ? ' err' : e.estado === 'lista' ? ' ok' : ''}`}>
          {e.estado === 'lista' ? 'Call analizada' : e.estado === 'error' ? 'No se pudo' : 'Call en proceso'}
        </span>
        {e.at && <span>{fmtDay(e.at)}</span>}
        {e.origen === 'texto' && <span>texto pegado</span>}
        {puede && <button type="button" className="f2-link sp" onClick={() => onBorrar(e)}>Borrar</button>}
      </div>
      {e.titulo && <h3>{e.titulo}</h3>}
      {enCurso && <p className="f2-lead" role="status">{ESTADO_TXT[e.estado]} Con una call larga puede tardar unos minutos: podés seguir con otra cosa.</p>}
      {trabada && (
        <div className="f2-stale" role="alert">
          <I2.alert width={14} height={14} /><span>Se está tardando demasiado y no hay novedades. Probablemente se cortó.</span>
          {puedeIA && <button type="button" className="f2-again" onClick={() => onReintentar(e)}>Probar de nuevo</button>}
        </div>
      )}
      {e.estado === 'error' && (
        <div className="f2-stale" role="alert">
          <I2.alert width={14} height={14} /><span>{e.error || 'Algo falló.'}</span>
          {puedeIA && <button type="button" className="f2-again" onClick={() => onReintentar(e)}>Probar de nuevo</button>}
        </div>
      )}
      {a && (
        <>
          {a.resumen && <div className="f2-sum"><p className="f2-k">Resumen</p><p>{a.resumen}</p></div>}
          <Items titulo="Implementar" tono="--accent" items={a.implementar} lista="implementar" entrada={e} puede={puede} onOportunidad={onOportunidad} />
          <Items titulo="Mejorar" tono="--violet" items={a.mejorar} lista="mejorar" entrada={e} puede={puede} onOportunidad={onOportunidad} />
          <Items titulo="Cargar" tono="--green" items={a.cargar} lista="cargar" entrada={e} puede={puede} />
          {hayMas && (
            <div className="f2-mas">
              <Items titulo="Objeciones" tono="--yellow" items={a.objeciones} lista="objeciones" entrada={e} puede={puede} />
              {a.senales.length > 0 && (
                <Grupo titulo="Señales de compra" tono="--blue" cantidad={a.senales.length}>
                  <Filas filas={a.senales.map((s) => ({ texto: s.texto, sub: TIPO_SENAL[s.tipo] || s.tipo, cita: s.cita }))} />
                </Grupo>
              )}
              {a.pendientes.length > 0 && (
                <Grupo titulo="Pendientes" tono="--text-dim" cantidad={a.pendientes.length}>
                  <Filas filas={a.pendientes.map((p) => ({ texto: p.texto, sub: p.quien }))} />
                </Grupo>
              )}
            </div>
          )}
        </>
      )}
      {e.texto && (
        <div>
          <button type="button" className="f2-more" aria-expanded={verTexto} onClick={() => setVerTexto((x) => !x)}>
            <I2.chevR width={12} height={12} /> {verTexto ? 'Ocultar el texto de la call' : 'Ver el texto de la call'}
          </button>
          {verTexto && <pre className="f2-raw">{e.texto}</pre>}
        </div>
      )}
      {puedeIA && a && e.estado === 'lista' && (
        <div><button type="button" className="f2-link" onClick={() => onReintentar(e)}>Analizar de nuevo</button></div>
      )}
    </article>
  )
}

function Plan({ plan, desactualizado, puede, puedeIA, armando, onArmar, onOportunidad }) {
  const simples = (arr) => arr.map((t) => ({ texto: t }))
  return (
    <section className="f2-plan" aria-label="Cómo llevarlo a Fase 2">
      <div className="f2-meta">
        <h3>Cómo llevarlo a Fase 2</h3>
        <span className="sp">Armado el {fmtDay(plan.generadoAt)}</span>
        {puedeIA && (
          <button type="button" className="f2-again" onClick={onArmar} disabled={armando} aria-busy={armando}>
            <I2.refresh width={13} height={13} /> {armando ? 'Pensando…' : 'Rehacer plan'}
          </button>
        )}
      </div>
      {desactualizado && <div className="f2-stale"><I2.alert width={14} height={14} /><span>Hay calls o notas nuevas desde que se armó este plan.{puedeIA ? ' Conviene rehacerlo.' : ''}</span></div>}
      {plan.porQueAhora && <div className="f2-sum"><p className="f2-k">Por qué ahora</p><p>{plan.porQueAhora}</p></div>}
      {plan.queOfrecerPrimero.length > 0 && (
        <Grupo titulo="Qué ofrecer primero" tono="--accent" cantidad={plan.queOfrecerPrimero.length}>
          <Filas filas={plan.queOfrecerPrimero.map((it, i) => ({
            texto: it.titulo,
            sub: it.razon,
            accion: it.oportunidadId
              ? <YaEsOportunidad />
              : puede && <button type="button" className="f2-again" onClick={() => onOportunidad(plan, 'queOfrecerPrimero', i)}>Pasar a oportunidad</button>,
          }))}
          />
        </Grupo>
      )}
      {plan.comoAbrirLaCharla && <div className="f2-say"><p className="f2-k">Cómo abrir la charla</p><p>{plan.comoAbrirLaCharla}</p></div>}
      {(plan.objecionesEsperadas.length > 0 || plan.antesDeOfrecer.length > 0 || plan.riesgos.length > 0) && (
        <div className="f2-mas">
          {plan.objecionesEsperadas.length > 0 && (
            <Grupo titulo="Objeciones que esperamos" tono="--yellow" cantidad={plan.objecionesEsperadas.length}>
              <Filas filas={plan.objecionesEsperadas.map((o) => ({ texto: o.objecion, sub: o.respuesta }))} />
            </Grupo>
          )}
          {plan.antesDeOfrecer.length > 0 && (
            <Grupo titulo="Antes de ofrecer" tono="--green" cantidad={plan.antesDeOfrecer.length}><Filas filas={simples(plan.antesDeOfrecer)} /></Grupo>
          )}
          {plan.riesgos.length > 0 && (
            <Grupo titulo="Riesgos" tono="--red" cantidad={plan.riesgos.length}><Filas filas={simples(plan.riesgos)} /></Grupo>
          )}
        </div>
      )}
      {plan.momento && <p className="f2-when"><b>Cuándo:</b> {plan.momento}</p>}
    </section>
  )
}

export function Fase2Section({ project, compact = false }) {
  const { data, myId, supabase, fase2Store, opportunityStore } = useApp()
  const id = useId()
  const me = (data.team || []).find((u) => u.id === myId)
  // Sólo personas autorizadas: un developer no la ve ni con acceso completo (la base lo exige igual).
  const puedeVer = !me || puedeVerFase2(me)
  const puede = !!fase2Store && !esSoloLectura() && (!me || puedeEditarFase2(me))
  const puedeIA = puede && !!supabase
  const who = (uid) => (data.team || []).find((u) => u.id === uid)?.name || 'alguien del equipo'

  const [link, setLink] = useState('')
  const [pegar, setPegar] = useState(false)
  const [pegado, setPegado] = useState('')
  const [notando, setNotando] = useState(false)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [armando, setArmando] = useState(false)
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])
  useEffect(() => { setLink(''); setPegar(false); setPegado(''); setNotando(false); setNota(''); setError('') }, [project.id])

  const v = useMemo(() => vistaFase2(fase2Store?.items || [], project.id), [fase2Store?.items, project.id])

  // Las calls en curso se resuelven en el servidor, en segundo plano: mientras haya alguna se mira su fila
  // cada pocos segundos (por si el realtime no llega) y anda el reloj que detecta las que se trabaron.
  const [ahora, setAhora] = useState(() => new Date())
  const idsEnCurso = v.entradas.filter((e) => e.kind === 'call' && (e.estado === 'bajando' || e.estado === 'analizando')).map((e) => e.id).join(',')
  useEffect(() => {
    if (!idsEnCurso) return undefined
    let activo = true
    const t = setInterval(async () => {
      setAhora(new Date())
      if (!supabase || !fase2Store?.mergeRemote) return
      const { data: filas } = await supabase.from('project_fase2').select('id, data').in('id', idsEnCurso.split(','))
      if (!activo) return
      for (const f of filas || []) if (f.data) fase2Store.mergeRemote({ ...f.data, id: f.id })
    }, 5000)
    return () => { activo = false; clearInterval(t) }
  }, [supabase, idsEnCurso])

  /* Le pide a la función que baje y analice una call ya creada. Ella contesta enseguida y sigue en
   * segundo plano: el resultado (o el error) llega por la fila, por el realtime y por la consulta de
   * abajo. Acá sólo se atiende un error de verdad al pedirlo (sin permiso, call inexistente, sin red). */
  const correr = async (entrada) => {
    const r = await llamarFase2(supabase, { accion: 'analizar_call', proyecto: project.id, entrada: entrada.id })
    if (!vivo.current || !r.error) return
    if (r.entrada) { fase2Store.mergeRemote(r.entrada); return } // la función ya anotó la falla en la fila
    fase2Store.patch(entrada.id, (x) => (x.estado === 'bajando' || x.estado === 'analizando' ? { ...x, estado: 'error', error: r.error } : x))
  }

  const crearYCorrer = async (entrada) => {
    const { error: err } = await fase2Store.create(entrada)
    if (err) { setError('No pude guardar la call. Probá de nuevo.'); return }
    await correr(entrada)
  }

  const traer = async () => {
    if (!puedeIA) return
    const r = resolverLink(link)
    if (!r.ok) { setError(r.error); return }
    setError(''); setLink('')
    await crearYCorrer(nuevaCall({ projectId: project.id, link: r.url, by: myId || null }))
  }

  const analizarPegado = async () => {
    if (!puedeIA) return
    if (pegado.trim().length < MIN_TEXTO_PEGADO) { setError(`Pegá el texto completo de la call (al menos ${MIN_TEXTO_PEGADO} caracteres).`); return }
    setError(''); setPegar(false)
    const texto = pegado; setPegado('')
    await crearYCorrer(nuevaCall({ projectId: project.id, texto, by: myId || null }))
  }

  const guardarNota = async () => {
    if (!puede || !nota.trim()) return
    setError('')
    const { error: err } = await fase2Store.create(nuevaNota({ projectId: project.id, text: nota, by: myId || null }))
    if (err) { setError('No pude guardar la nota. Probá de nuevo.'); return }
    setNota(''); setNotando(false)
  }

  const reintentar = async (entrada) => {
    if (!puedeIA) return
    fase2Store.patch(entrada.id, (x) => ({ ...x, estado: x.texto ? 'analizando' : 'bajando', error: null }))
    await correr(entrada)
  }

  const borrar = (entrada) => { if (puede) fase2Store.patch(entrada.id, (x) => marcarBorrada(x)) }

  const armarPlan = async () => {
    if (!puedeIA || armando) return
    setArmando(true); setError('')
    const r = await llamarFase2(supabase, { accion: 'armar_plan', proyecto: project.id })
    if (!vivo.current) return
    setArmando(false)
    if (r.error) { setError(r.error); return }
    if (r.data?.plan) fase2Store.mergeRemote(r.data.plan)
  }

  const aOportunidad = (entrada, lista, indice) => {
    if (!puede || !opportunityStore) return
    const item = entrada.kind === 'plan' ? entrada.queOfrecerPrimero[indice] : entrada.analisis?.[lista]?.[indice]
    if (!item || item.oportunidadId) return
    const mias = (opportunityStore.items || []).filter((o) => o.projectId === project.id && !o.deletedAt)
    const op = itemAOportunidad(item, { projectId: project.id, by: myId || null, frase: entrada.kind === 'plan' ? entrada.comoAbrirLaCharla : '' })
    if (hayParecida(op.titulo, mias)) { setError('Ya hay una oportunidad parecida a esta en el proyecto.'); return }
    setError('')
    opportunityStore.create(normalizeOpportunity(op))
    fase2Store.patch(entrada.id, (x) => vincularItem(x, lista, indice, op.id))
  }

  if (!puedeVer) return null
  const hay = v.entradas.length > 0 || !!v.plan
  return (
    <section className={`f2-sec${compact ? ' compact' : ''}`} aria-labelledby={`${id}-t`} aria-busy={armando}>
      <style>{CSS}</style>
      {!compact
        ? (
          <div className="pd-h">
            <h2 id={`${id}-t`}>Fase 2</h2>
            <span className="sub">calls y notas para llevar este proyecto a una Fase 2</span>
          </div>
        )
        : <span id={`${id}-t`} className="f2-sr">Fase 2</span>}

      {puede && (
        <div className="f2-bar">
          <label className="f2-sr" htmlFor={`${id}-link`}>Link de la call de Fathom</label>
          <input id={`${id}-link`} className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Pegá el link de la call de Fathom"
            onKeyDown={(e) => { if (e.key === 'Enter') traer() }} disabled={!puedeIA} />
          <button type="button" className="f2-go" onClick={traer} disabled={!puedeIA || !link.trim()}><I2.sparkle width={15} height={15} /> Traer call</button>
          <button type="button" className="f2-again" onClick={() => setNotando((x) => !x)} aria-expanded={notando}>Nueva nota</button>
          <button type="button" className="f2-again" onClick={() => setPegar((x) => !x)} aria-expanded={pegar} disabled={!puedeIA}>Pegar el texto</button>
        </div>
      )}
      {puede && !supabase && <p className="f2-lead">Traer y analizar calls anda con la app en línea. Las notas se pueden escribir igual.</p>}

      {notando && puede && (
        <div className="f2-box">
          <label className="f2-sr" htmlFor={`${id}-nota`}>Nota de Fase 2</label>
          <textarea id={`${id}-nota`} className="input" value={nota} maxLength={MAX_NOTA} onChange={(e) => setNota(e.target.value)} placeholder="Qué dijo, qué quiere, qué se podría hacer…" />
          <div className="row">
            <small>{nota.length.toLocaleString('es-AR')} / {MAX_NOTA.toLocaleString('es-AR')}</small>
            <button type="button" className="f2-again" onClick={() => { setNotando(false); setNota('') }}>Cancelar</button>
            <button type="button" className="f2-go" onClick={guardarNota} disabled={!nota.trim()}>Guardar nota</button>
          </div>
        </div>
      )}

      {pegar && puedeIA && (
        <div className="f2-box">
          <label className="f2-sr" htmlFor={`${id}-texto`}>Texto de la call</label>
          <textarea id={`${id}-texto`} className="input" value={pegado} maxLength={MAX_TEXTO_CALL} onChange={(e) => setPegado(e.target.value)} placeholder="Pegá acá el resumen o la transcripción de la call" />
          <div className="row">
            <small>{pegado.length.toLocaleString('es-AR')} caracteres · mínimo {MIN_TEXTO_PEGADO}</small>
            <button type="button" className="f2-again" onClick={() => { setPegar(false); setPegado('') }}>Cancelar</button>
            <button type="button" className="f2-go" onClick={analizarPegado} disabled={pegado.trim().length < MIN_TEXTO_PEGADO}>Analizar</button>
          </div>
        </div>
      )}

      {error && (
        <div className="f2-err" role="alert">
          <I2.alert width={15} height={15} /><span style={{ flex: 1, minWidth: 0 }}>{error}</span>
          <button type="button" className="f2-again" onClick={() => setError('')}>Cerrar</button>
        </div>
      )}

      {!hay && (
        <div className="f2-empty">
          <div className="tx">
            <b>{puede ? 'Todavía no hay nada de la Fase 2 de este proyecto' : 'Todavía nadie cargó nada de la Fase 2 de este proyecto'}</b>
            <p>Pegá el link de una call de Fathom o escribí una nota. La IA baja la llamada, saca lo que se puede cargar, mejorar e implementar, y arma el plan para ofrecer la Fase 2.</p>
          </div>
        </div>
      )}

      {v.plan && <Plan plan={v.plan} desactualizado={v.planDesactualizado} puede={puede} puedeIA={puedeIA} armando={armando} onArmar={armarPlan} onOportunidad={aOportunidad} />}

      {!v.plan && v.elegibles > 0 && puedeIA && (
        <div className="f2-box">
          <p className="f2-lead" style={{ margin: 0 }}>Hay {v.elegibles} {v.elegibles === 1 ? 'entrada lista' : 'entradas listas'} para armar el plan de cómo llevar este proyecto a una Fase 2.</p>
          <div className="row"><button type="button" className="f2-go" onClick={armarPlan} disabled={armando} aria-busy={armando}><I2.sparkle width={15} height={15} /> {armando ? 'Pensando…' : 'Armar el plan'}</button></div>
        </div>
      )}
      {armando && <p className="f2-think" role="status"><i aria-hidden="true" />Leyendo las calls, las notas y el proyecto. Tarda alrededor de medio minuto.</p>}

      {v.entradas.length > 0 && (
        <div className="f2-feed">
          {v.entradas.map((e) => (e.kind === 'call'
            ? <Llamada key={e.id} e={e} ahora={ahora} puede={puede} puedeIA={puedeIA} onReintentar={reintentar} onBorrar={borrar} onOportunidad={aOportunidad} />
            : (
              <article key={e.id} className="f2-nota">
                <p><small>Nota del {fmtDay(e.at)}{e.by ? ` · ${who(e.by)}` : ''}</small>{e.text}</p>
                {puede && <button type="button" className="f2-link" onClick={() => borrar(e)}>Borrar</button>}
              </article>
            )))}
        </div>
      )}
    </section>
  )
}
