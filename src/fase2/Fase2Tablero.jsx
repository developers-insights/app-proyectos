import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import ProyectoAvatar from '../ui/ProyectoAvatar.jsx'
import { fmtDay } from '../lib/stores.js'
import { esSoloLectura } from '../lib/soloLectura.js'
import {
  puedeVerFase2, puedeEditarFase2, nuevoTablero, proyectosDelTablero, idTablero, nuevaCall, marcarBorrada,
  vistaTablero, sugerenciasFathom, linksPegados, totalesPropuesta, propuestaComoTexto, usd, llamadaTrabada,
} from '../lib/fase2.js'

/*
 * Tablero "Fase 2" del menú (2026-11-28). Para Nacho: elige proyectos, les carga las calls de Fathom y
 * la IA arma una propuesta corta (lo que hablaron, qué venderle y cuánto) para la próxima llamada.
 * Las calls son las mismas filas que la sección Fase 2 del detalle del proyecto; la propuesta y el
 * tablero son dos tipos más de project_fase2 (docs/migrations/2026-11-28-fase2-tablero.sql).
 */

const CSS = `
.f2t{--t:var(--violet);--t-soft:var(--violet-soft);--t-line:var(--violet-line);position:relative;min-height:100%;
  padding:30px clamp(16px,3vw,40px) 72px;
  background:radial-gradient(900px 480px at 82% -6%,var(--t-soft),transparent 70%),radial-gradient(640px 420px at -6% 104%,color-mix(in srgb,var(--t) 6%,transparent),transparent 70%)}
.f2t-in{max-width:1160px;margin:0 auto}
.f2t-d{font-family:'Bricolage Grotesque',Inter,system-ui,sans-serif;letter-spacing:-.02em}
.f2t-top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 18px}
.f2t-top h1{font-size:clamp(28px,3.2vw,40px);font-weight:800;line-height:1}
.f2t-k{display:inline-flex;align-items:center;gap:8px;margin:0 0 10px;font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--t)}
.f2t-k i{width:7px;height:7px;border-radius:50%;background:var(--t)}

.f2t-rail{position:relative;overflow-x:auto;scrollbar-width:none;margin:0 -8px;padding:8px}
.f2t-rail::-webkit-scrollbar{display:none}
.f2t-cards{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(178px,214px);gap:10px;justify-content:start}
.f2t-pill{position:absolute;z-index:0;top:0;left:0;border-radius:18px;background:color-mix(in srgb,var(--t) 11%,var(--bg-elevated));
  box-shadow:inset 0 0 0 1.5px var(--t),0 1px 2px rgba(0,0,0,.06),0 14px 30px -18px rgba(0,0,0,.4);
  transition:transform .6s var(--e),width .6s var(--e),height .6s var(--e),opacity .3s}
.f2t-card{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr;gap:4px 11px;align-items:center;text-align:left;
  min-height:76px;padding:14px 15px;border-radius:18px;color:var(--text);transition:transform .45s var(--e)}
.f2t-card::after{content:'';position:absolute;inset:0;border-radius:18px;box-shadow:inset 0 0 0 1px var(--border);pointer-events:none}
.f2t-card:hover{transform:translateY(-2px)}
.f2t-card:active{transform:translateY(0) scale(.985)}
.f2t-card:focus-visible{outline:2px solid var(--t);outline-offset:3px}
.f2t-card .av{grid-row:span 2;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;font-size:12.5px;font-weight:700;color:var(--text);background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.f2t-card b{font-size:14.5px;font-weight:650;letter-spacing:-.015em;line-height:1.2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.f2t-card span.s{font-size:12px;color:var(--text-dim);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px}
.f2t-card[aria-selected="false"] b{color:var(--text-dim)}
.f2t-card[aria-selected="true"]::after{opacity:0}
.f2t-card[aria-selected="true"] .av{box-shadow:inset 0 0 0 1px var(--t-line)}
.f2t-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--text-faint)}
.f2t-dot.on{background:var(--t);animation:f2t-p 1.3s var(--e) infinite}
.f2t-dot.ok{background:var(--green)}
@keyframes f2t-p{0%,100%{opacity:.35}50%{opacity:1}}
.f2t-add{position:relative;z-index:1;display:flex;align-items:center;gap:11px;min-height:76px;padding:14px 16px;border-radius:18px;
  border:2px dashed color-mix(in srgb,var(--t) 50%,transparent);color:var(--text-dim);font-size:13.5px;font-weight:600;text-align:left;
  background:color-mix(in srgb,var(--t) 4%,transparent);transition:border-color .25s,color .25s,background .25s,transform .45s var(--e)}
.f2t-add:hover{border-color:var(--t);color:var(--text);background:color-mix(in srgb,var(--t) 9%,transparent);transform:translateY(-2px)}
.f2t-add:active{transform:scale(.985)}
.f2t-add:focus-visible{outline:2px solid var(--t);outline-offset:3px}
.f2t-add .plus{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;border:2px dashed color-mix(in srgb,var(--t) 50%,transparent);color:var(--t);flex:none}
.f2t-bar{height:2px;margin:14px 0 0;border-radius:2px;background:var(--border);overflow:hidden}
.f2t-bar i{display:block;height:100%;background:var(--t);transform-origin:left;transition:transform .7s var(--e)}

.f2t-empty{display:grid;place-items:center;text-align:center;min-height:52vh;padding:40px 16px}
.f2t-empty .big{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(440px,100%);padding:46px 28px;border-radius:24px;
  border:2px dashed color-mix(in srgb,var(--t) 50%,transparent);background:color-mix(in srgb,var(--t) 5%,transparent);color:var(--text);transition:transform .45s var(--e),border-color .25s,background .25s}
.f2t-empty .big:hover{transform:translateY(-3px);border-color:var(--t);background:color-mix(in srgb,var(--t) 9%,transparent)}
.f2t-empty .big:active{transform:scale(.985)}
.f2t-empty .big:focus-visible{outline:2px solid var(--t);outline-offset:4px}
.f2t-empty .big .plus{display:grid;place-items:center;width:54px;height:54px;border-radius:17px;border:2px dashed color-mix(in srgb,var(--t) 50%,transparent);color:var(--t)}
.f2t-empty .big b{font-size:19px;font-weight:700}
.f2t-empty .big span{font-size:13px;color:var(--text-dim)}

.f2t-stage{margin-top:28px}
.f2t-panel{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:clamp(22px,3vw,44px);align-items:start}
.f2t-panel > *{min-width:0}
.f2t-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 8px;font-size:12.5px;color:var(--text-dim)}
.f2t-h .open{display:inline-flex;align-items:center;gap:5px;color:var(--text-dim);font-size:12.5px;font-weight:600}
.f2t-h .open:hover{color:var(--text)}
.f2t-name{font-size:clamp(34px,5vw,60px);font-weight:800;line-height:.98;margin:0 0 24px;overflow-wrap:anywhere}

.f2t-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 18px;border-radius:13px;
  font-size:13.5px;font-weight:650;color:#160d2b;background:var(--t);transition:transform .16s var(--e),filter .2s}
.f2t-go:hover{filter:brightness(1.08)}
.f2t-go:active{transform:scale(.97)}
.f2t-go:disabled{opacity:.5;cursor:default;transform:none;filter:none}
.f2t-go:focus-visible,.f2t-sec:focus-visible,.f2t-x:focus-visible,.f2t-row:focus-visible{outline:2px solid var(--t);outline-offset:2px}
.f2t-sec{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 13px;border-radius:11px;white-space:nowrap;
  font-size:12.5px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:color .2s,box-shadow .2s,transform .16s var(--e)}
.f2t-sec:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--t-line)}
.f2t-sec:active{transform:scale(.97)}
.f2t-sec:disabled{opacity:.5;cursor:default}
.f2t-x{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;color:var(--text-faint);flex:none;transition:color .2s,background .2s}
.f2t-x:hover{color:var(--text);background:var(--bg-elevated)}

.f2t-box{border-radius:20px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);padding:20px 22px}
.f2t-lbl{margin:0 0 12px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:var(--text-faint);display:flex;align-items:center;gap:8px}
.f2t-lbl .n{margin-left:auto;letter-spacing:0;text-transform:none}
.f2t-said{margin:0;padding:0;list-style:none;display:grid;gap:10px}
.f2t-said li{display:grid;grid-template-columns:14px 1fr;gap:10px;font-size:14.5px;line-height:1.5;color:var(--text-dim)}
.f2t-said li::before{content:'';width:8px;height:8px;margin-top:8px;border-radius:3px;background:var(--t)}
.f2t-sell{display:grid;border-top:1px solid var(--border)}
.f2t-row{display:grid;grid-template-columns:1fr auto;gap:4px 18px;align-items:center;padding:15px 4px;border-bottom:1px solid var(--border);text-align:left;color:var(--text);border-radius:0;transition:padding .35s var(--e),background .25s}
.f2t-row:hover{padding-left:10px;background:linear-gradient(90deg,color-mix(in srgb,var(--t) 7%,transparent),transparent 70%)}
.f2t-row b{font-size:16.5px;font-weight:650;letter-spacing:-.015em;line-height:1.3}
.f2t-row .p{font-family:'Bricolage Grotesque',Inter,sans-serif;font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.f2t-row .p small{display:block;font-family:Inter,sans-serif;font-size:11px;font-weight:500;color:var(--text-faint)}
.f2t-row .w{grid-column:1/-1;font-size:13px;line-height:1.45;color:var(--text-dim);max-width:62ch}
.f2t-total{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:18px}
.f2t-total .big{font-family:'Bricolage Grotesque',Inter,sans-serif;font-weight:800;font-size:clamp(34px,4.4vw,50px);line-height:1;color:var(--t);font-variant-numeric:tabular-nums}
.f2t-total .big small{font-size:.42em;font-weight:700;color:var(--text-dim);margin-left:6px}
.f2t-total .mes{margin-top:6px;font-size:15px;font-weight:600;color:var(--text-dim);font-variant-numeric:tabular-nums}
.f2t-total .lb{font-size:12.5px;color:var(--text-dim);margin-bottom:6px}
.f2t-acts{display:flex;gap:8px;flex-wrap:wrap}
.f2t-next{margin-top:22px;padding:13px 16px;border-radius:14px;font-size:13.5px;line-height:1.5;color:var(--text);background:color-mix(in srgb,var(--t) 8%,transparent);box-shadow:inset 3px 0 0 var(--t)}
.f2t-next b{font-weight:650}
.f2t-warn{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 18px;padding:10px 12px 10px 14px;border-radius:13px;font-size:13px;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--t-line)}
.f2t-warn > span{flex:1 1 200px;min-width:0}
.f2t-warn.err{box-shadow:inset 0 0 0 1px var(--red)}
.f2t-warn svg{flex:none;color:var(--t)}
.f2t-warn.err svg{color:var(--red)}
.f2t-start{display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:26px 24px;border-radius:20px;border:2px dashed color-mix(in srgb,var(--t) 50%,transparent);background:color-mix(in srgb,var(--t) 4%,transparent)}
.f2t-start b{font-size:18px;font-weight:700;letter-spacing:-.015em}
.f2t-start p{margin:0;font-size:13.5px;line-height:1.5;color:var(--text-dim);max-width:46ch}

.f2t-think{display:grid;gap:12px}
.f2t-think .st{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--text)}
.f2t-sk{height:14px;border-radius:7px;background:linear-gradient(90deg,var(--bg-elevated) 0%,color-mix(in srgb,var(--t) 14%,var(--bg-elevated)) 50%,var(--bg-elevated) 100%);background-size:220% 100%;animation:f2t-sh 1.6s linear infinite}
@keyframes f2t-sh{to{background-position:-220% 0}}

.f2t-side{display:grid;gap:14px}
.f2t-calls{display:grid}
.f2t-call{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--border)}
.f2t-call:first-child{border-top:0;padding-top:2px}
.f2t-call .tx{min-width:0}
.f2t-call b{display:block;font-size:13.5px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.f2t-call small{display:block;font-size:12px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.f2t-call small.err{color:var(--red);white-space:normal}
.f2t-sug{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--border)}
.f2t-sug:first-of-type{border-top:0}
.f2t-sug .ic{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:var(--t);background:var(--t-soft)}
.f2t-sug b{display:block;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.f2t-sug small{display:block;font-size:11.5px;color:var(--text-dim)}
.f2t-quit{justify-self:start;font-size:12.5px;color:var(--text-faint);padding:6px 2px}
.f2t-quit:hover{color:var(--red)}

.f2t-velo{position:fixed;inset:0;z-index:80;background:rgba(8,10,16,.34);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.f2t-dr{position:fixed;z-index:81;top:0;right:0;bottom:0;width:min(470px,100%);display:flex;flex-direction:column;background:var(--bg);
  box-shadow:-1px 0 0 var(--border),-30px 0 80px -30px rgba(0,0,0,.5);padding-bottom:env(safe-area-inset-bottom,0px)}
.f2t-dr .f2t-dt0{height:4px;background:var(--t);flex:none}
.f2t-dr .f2t-dh{flex:none;display:flex;align-items:flex-start;gap:12px;padding:24px 24px 6px}
.f2t-dr .f2t-dh h3{flex:1;font-size:25px;font-weight:800;line-height:1.1}
.f2t-dr .f2t-db{flex:1;min-height:0;overflow-y:auto;padding:14px 24px 28px;display:grid;gap:16px;align-content:start}
.f2t-dr .f2t-df{flex:none;display:flex;gap:8px;justify-content:flex-end;padding:14px 24px;box-shadow:0 -1px 0 var(--border)}
.f2t-dr textarea,.f2t-dr input[type="search"],.f2t-dr input.num{width:100%;border-radius:12px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);border:0;padding:12px 14px;font-size:14px;line-height:1.5;color:var(--text);outline:none;transition:box-shadow .2s}
.f2t-dr textarea{min-height:120px;resize:vertical;font-family:'JetBrains Mono',monospace;font-size:12.5px}
.f2t-dr textarea:focus,.f2t-dr input:focus{box-shadow:inset 0 0 0 1.5px var(--t)}
.f2t-dr .hint{margin:-8px 0 0;font-size:12px;color:var(--text-dim)}
.f2t-dr .hint.err{color:var(--red)}
.f2t-pick{display:grid}
.f2t-pick button{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:11px 8px;margin:0 -8px;border-radius:12px;text-align:left;color:var(--text);transition:background .2s}
.f2t-pick button:hover,.f2t-pick button:focus-visible{background:var(--card);outline:none}
.f2t-pick .av{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;font-size:12px;font-weight:700;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.f2t-pick b{display:block;font-size:14px;font-weight:600}
.f2t-pick small{display:block;font-size:12px;color:var(--text-dim)}
.f2t-pick .chip{font-size:11px;font-weight:600;color:var(--t);padding:3px 8px;border-radius:999px;background:var(--t-soft);white-space:nowrap}
.f2t-chk{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:10px 8px;margin:0 -8px;border-radius:12px;cursor:pointer;transition:background .2s}
.f2t-chk:hover{background:var(--card)}
.f2t-chk input{width:18px;height:18px;accent-color:var(--violet)}
.f2t-chk b{display:block;font-size:13.5px;font-weight:600}
.f2t-chk small{display:block;font-size:12px;color:var(--text-dim)}
.f2t-dt .pr{font-family:'Bricolage Grotesque',Inter,sans-serif;font-weight:800;font-size:54px;line-height:1;color:var(--t);font-variant-numeric:tabular-nums}
.f2t-dt p{margin:0;font-size:14.5px;line-height:1.55;color:var(--text-dim)}
.f2t-dt blockquote{margin:0;padding:2px 0 2px 12px;border-left:2px solid var(--t);font-size:14px;line-height:1.5;font-style:italic;color:var(--text)}
.f2t-dt ul{margin:0;padding:0;list-style:none;border-top:1px solid var(--border)}
.f2t-dt li{display:grid;grid-template-columns:12px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;line-height:1.45}
.f2t-dt li::before{content:'';width:7px;height:7px;margin-top:7px;border-radius:2px;background:var(--t)}
.f2t-dt .meta{display:flex;gap:8px;flex-wrap:wrap}
.f2t-dt .meta span{font-size:12px;font-weight:600;color:var(--text-dim);padding:4px 10px;border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.f2t-priceed{display:flex;gap:8px;align-items:center}
.f2t-priceed label{font-size:12.5px;color:var(--text-dim);white-space:nowrap}

.f2t-toast{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));z-index:90;display:flex;align-items:center;gap:14px;padding:11px 12px 11px 16px;border-radius:14px;
  font-size:13.5px;color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border),0 18px 40px -16px rgba(0,0,0,.45);max-width:calc(100vw - 32px)}
.f2t-toast button{font-weight:700;color:var(--t);padding:4px 6px;border-radius:8px}
.f2t-toast button:hover{background:var(--t-soft)}
.f2t-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

@media (max-width:900px){.f2t-panel{grid-template-columns:1fr}.f2t{padding-top:22px}}
@media (max-width:640px){
  .f2t-cards{grid-auto-columns:172px}
  .f2t-dr{top:auto;left:0;width:100%;max-height:88vh;border-radius:22px 22px 0 0;box-shadow:0 -1px 0 var(--border),0 -30px 80px -30px rgba(0,0,0,.5)}
  .f2t-dr .f2t-dt0{display:none}
  .f2t-dr::before{content:'';width:42px;height:5px;border-radius:3px;background:var(--border-strong);margin:10px auto 0;flex:none}
  .f2t-box{padding:16px}
  .f2t-row .p{font-size:17px}
  .f2t-go{height:46px}
}
@media (prefers-reduced-motion:reduce){.f2t *{transition:none!important;animation:none!important}}
`

async function llamarFase2(supabase, body) {
  if (!supabase) return { error: 'Esto anda con la app en línea.' }
  const { data, error } = await supabase.functions.invoke('fase2', { body })
  if (!error) return { data }
  let msg = 'No pudimos hablar con el servidor. Probá de nuevo.'
  let entrada = null
  try { const b = await error.context.json(); if (b?.error) msg = b.error; if (b?.entrada) entrada = b.entrada } catch { /* sin cuerpo */ }
  return { error: msg, entrada }
}

const ease = [0.22, 1, 0.36, 1]

function Avatar({ project, className = 'av' }) {
  return <ProyectoAvatar project={project} texto={project?.name} className={className} />
}

function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const mostrar = useCallback((text, onUndo) => {
    clearTimeout(timer.current)
    setToast({ key: Date.now(), text, onUndo })
    timer.current = setTimeout(() => setToast(null), 7000)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const vista = createPortal(
    <div aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.key} className="f2t-toast" style={{ x: '-50%' }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
            transition={{ duration: 0.28, ease }}>
            <span>{toast.text}</span>
            {toast.onUndo && <button type="button" onClick={() => { clearTimeout(timer.current); toast.onUndo(); setToast(null) }}>Deshacer</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
  return [mostrar, vista]
}

function Cajon({ open, titulo, kicker, onClose, children, pie }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const prev = document.activeElement
    const t = setTimeout(() => (ref.current?.querySelector('[data-auto]') || ref.current?.querySelector('input, textarea, button'))?.focus({ preventScroll: true }), 80)
    const k = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll('button:not(:disabled),input,textarea,a[href]')]
        if (!f.length) return
        const a = f[0]
        const z = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', k)
    return () => { clearTimeout(t); document.removeEventListener('keydown', k); prev?.focus?.({ preventScroll: true }) }
  }, [open, onClose])
  const movil = typeof window !== 'undefined' && window.matchMedia('(max-width:640px)').matches
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="f2t" style={{ position: 'fixed', inset: 0, zIndex: 80, padding: 0, minHeight: 0, background: 'none', pointerEvents: 'none' }}>
          <motion.div className="f2t-velo" style={{ pointerEvents: 'auto' }} onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.35 }} />
          <motion.aside ref={ref} role="dialog" aria-modal="true" aria-label={titulo} className="f2t-dr" style={{ pointerEvents: 'auto' }}
            initial={movil ? { y: '104%' } : { x: '104%' }} animate={movil ? { y: 0 } : { x: 0 }} exit={movil ? { y: '104%' } : { x: '104%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 36 }}>
            <div className="f2t-dt0" />
            <div className="f2t-dh">
              <div style={{ flex: 1, minWidth: 0 }}>
                {kicker && <p className="f2t-k" style={{ margin: '0 0 8px' }}><i />{kicker}</p>}
                <h3 className="f2t-d">{titulo}</h3>
              </div>
              <button type="button" className="f2t-x" onClick={onClose} aria-label="Cerrar"><I2.x width={16} height={16} /></button>
            </div>
            <div className="f2t-db">{children}</div>
            {pie && <div className="f2t-df">{pie}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ─────────────────────────── Elegir proyecto ─────────────────────────── */

function ElegirProyecto({ open, onClose, proyectos, clienteDe, onElegir, sugeridosDe }) {
  const [q, setQ] = useState('')
  useEffect(() => { if (open) setQ('') }, [open])
  const lista = useMemo(() => {
    const k = q.trim().toLowerCase()
    return proyectos
      .filter((p) => !k || `${p.name} ${clienteDe(p)}`.toLowerCase().includes(k))
      .map((p) => ({ p, sug: sugeridosDe(p) }))
      .sort((a, b) => (b.sug - a.sug) || String(a.p.name || '').localeCompare(String(b.p.name || '')))
  }, [proyectos, q, clienteDe, sugeridosDe])
  return (
    <Cajon open={open} onClose={onClose} titulo="Elegí un proyecto" kicker="Fase 2">
      <label className="f2t-sr" htmlFor="f2t-q">Buscar proyecto</label>
      <input id="f2t-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por proyecto o cliente" autoComplete="off" />
      <div className="f2t-pick" role="list">
        {lista.map(({ p, sug }) => (
          <button key={p.id} type="button" role="listitem" onClick={() => onElegir(p)}>
            <Avatar project={p} />
            <span style={{ minWidth: 0 }}><b>{p.name}</b>{clienteDe(p) && clienteDe(p) !== p.name && <small>{clienteDe(p)}</small>}</span>
            {sug > 0 ? <span className="chip">{sug} {sug === 1 ? 'call' : 'calls'}</span> : <span />}
          </button>
        ))}
        {!lista.length && <p className="hint">No hay proyectos con ese nombre.</p>}
      </div>
    </Cajon>
  )
}

/* ─────────────────────────── Cargar Fathom ─────────────────────────── */

function CargarFathom({ open, onClose, sugeridas, onCargar }) {
  const [texto, setTexto] = useState('')
  const [elegidas, setElegidas] = useState(() => new Set())
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    setTexto(''); setError(''); setElegidas(new Set(sugeridas.map((s) => s.clave)))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const pegados = linksPegados(texto)
  const total = pegados.ok.length + sugeridas.filter((s) => elegidas.has(s.clave) && !pegados.ok.some((p) => p.clave === s.clave)).length
  const cargar = () => {
    if (pegados.malos.length) { setError(`No es un link de Fathom: ${pegados.malos[0].slice(0, 60)}`); return }
    const urls = [...pegados.ok.map((p) => p.url), ...sugeridas.filter((s) => elegidas.has(s.clave)).map((s) => s.url)]
    if (!urls.length) { setError('Pegá al menos un link.'); return }
    onCargar([...new Set(urls)])
  }
  const alternar = (k) => setElegidas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  return (
    <Cajon open={open} onClose={onClose} titulo="Cargar calls de Fathom" kicker="Fase 2"
      pie={<>
        <button type="button" className="f2t-sec" onClick={onClose}>Cancelar</button>
        <button type="button" className="f2t-go" onClick={cargar} disabled={!total}>
          <I2.plus width={15} height={15} /> {total > 1 ? `Cargar ${total} calls` : 'Cargar call'}
        </button>
      </>}>
      <label className="f2t-sr" htmlFor="f2t-links">Links de Fathom</label>
      <textarea id="f2t-links" data-auto value={texto} onChange={(e) => { setTexto(e.target.value); setError('') }}
        placeholder={'https://fathom.video/share/…\nhttps://fathom.video/share/…'} spellCheck={false} />
      {error
        ? <p className="hint err" role="alert">{error}</p>
        : <p className="hint">Uno o varios, uno por línea.</p>}
      {sugeridas.length > 0 && (
        <div>
          <p className="f2t-lbl">Ya vinculadas a este proyecto <span className="n">{sugeridas.length}</span></p>
          {sugeridas.map((s) => (
            <label key={s.clave} className="f2t-chk">
              <input type="checkbox" checked={elegidas.has(s.clave)} onChange={() => alternar(s.clave)} />
              <span style={{ minWidth: 0 }}>
                <b>{s.titulo || 'Call de Fathom'}</b>
                <small>{s.at ? fmtDay(s.at) : 'Ya vinculada'}</small>
              </span>
            </label>
          ))}
        </div>
      )}
    </Cajon>
  )
}

/* ─────────────────────────── Detalle de un ítem ─────────────────────────── */

function DetalleItem({ item, onClose, puede, onPrecio, onQuitar }) {
  const [precio, setPrecio] = useState('')
  useEffect(() => { setPrecio(item?.precioUsd ? String(item.precioUsd) : '') }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = () => {
    const n = Math.round(Number(String(precio).replace(/[^\d]/g, '')))
    if (item && n !== (item.precioUsd || 0)) onPrecio(item, n > 0 ? n : null)
  }
  return (
    <Cajon open={!!item} onClose={() => { guardar(); onClose() }} titulo={item?.titulo || ''} kicker="Qué le podemos vender"
      pie={puede && item ? <button type="button" className="f2t-sec" onClick={() => onQuitar(item)}><I2.trash width={14} height={14} /> Sacar de la propuesta</button> : null}>
      {item && (
        <div className="f2t-dt" style={{ display: 'grid', gap: 18 }}>
          <div className="pr">{item.precioUsd ? usd(item.precioUsd) : 'Sin precio'}{item.cobro === 'mensual' && <span style={{ fontSize: 18, color: 'var(--text-dim)', marginLeft: 8 }}>por mes</span>}</div>
          {item.porQue && <p>{item.porQue}</p>}
          {item.cita && <blockquote>{item.cita}</blockquote>}
          {item.incluye.length > 0 && <ul>{item.incluye.map((s, i) => <li key={i}><span>{s}</span></li>)}</ul>}
          <div className="meta">
            {item.semanas && <span>{item.semanas} {item.semanas === 1 ? 'semana' : 'semanas'}</span>}
            <span>{item.cobro === 'mensual' ? 'Pago mensual' : 'Pago único'}</span>
            {item.editado && <span>Precio ajustado</span>}
          </div>
          {puede && (
            <div className="f2t-priceed">
              <label htmlFor="f2t-precio">Precio en USD</label>
              <input id="f2t-precio" className="num" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value)}
                onBlur={guardar} onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }} />
            </div>
          )}
        </div>
      )}
    </Cajon>
  )
}

/* ─────────────────────────── La propuesta ─────────────────────────── */

function Pensando({ texto }) {
  return (
    <div className="f2t-box f2t-think" role="status" aria-live="polite">
      <div className="st"><span className="f2t-dot on" />{texto}</div>
      <div className="f2t-sk" style={{ width: '92%' }} />
      <div className="f2t-sk" style={{ width: '78%' }} />
      <div className="f2t-sk" style={{ width: '64%' }} />
      <div style={{ height: 6 }} />
      <div className="f2t-sk" style={{ width: '100%', height: 46, borderRadius: 12 }} />
      <div className="f2t-sk" style={{ width: '100%', height: 46, borderRadius: 12 }} />
    </div>
  )
}

function Propuesta({ v, puede, puedeIA, onCargar, onArmar, onAbrir, onCopiar, sugeridas }) {
  const p = v.propuesta
  if (!v.calls.length) {
    return (
      <div className="f2t-start">
        <b>Cargá las calls con el cliente</b>
        <p>Con los links de Fathom te armamos lo que hablaron, qué le podemos vender y cuánto sale.</p>
        {puede && (
          <button type="button" className="f2t-go" onClick={onCargar} disabled={!puedeIA}>
            <I2.plus width={15} height={15} /> Cargar Fathom{sugeridas > 0 ? ` · ${sugeridas} ${sugeridas === 1 ? 'sugerida' : 'sugeridas'}` : ''}
          </button>
        )}
      </div>
    )
  }
  const bajandoTxt = v.bajando.length === 1 ? 'Bajando la call de Fathom…' : `Bajando ${v.bajando.length} calls de Fathom…`
  const falla = p && (p.estado === 'error' || v.trabada)
  // Con una propuesta ya armada, mientras se actualiza (o si falla al rehacerla) se sigue viendo la anterior.
  const tiene = !!p && p.queVender.length > 0
  if (!tiene && v.bajando.length) return <Pensando texto={bajandoTxt} />
  if (!tiene && v.armando) return <Pensando texto="Leyendo las calls y armando la propuesta…" />
  if (!tiene) {
    const err = falla
    return (
      <div className="f2t-start">
        {err
          ? <div className="f2t-warn err" role="alert" style={{ margin: 0, alignSelf: 'stretch' }}><I2.alert width={15} height={15} /><span>{v.trabada ? 'Se cortó mientras se armaba.' : p.error || 'Algo falló.'}</span></div>
          : <b>{v.conTexto.length ? 'Las calls están listas' : 'No se pudo leer ninguna call'}</b>}
        {puedeIA && v.conTexto.length > 0 && <button type="button" className="f2t-go" onClick={onArmar}><I2.sparkle width={15} height={15} /> Armar la propuesta</button>}
      </div>
    )
  }
  const t = totalesPropuesta(p)
  const its = p.queVender.filter((i) => !i.quitado)
  return (
    <div>
      {(v.armando || v.bajando.length > 0) && (
        <div className="f2t-warn" role="status"><span className="f2t-dot on" /><span>{v.armando ? 'Actualizando la propuesta con las calls nuevas…' : bajandoTxt}</span></div>
      )}
      {!v.armando && falla && (
        <div className="f2t-warn err" role="alert">
          <I2.alert width={15} height={15} /><span>{v.trabada ? 'Se cortó mientras se actualizaba.' : p.error || 'No se pudo actualizar.'}</span>
          {puedeIA && <button type="button" className="f2t-sec" onClick={onArmar}>Probar de nuevo</button>}
        </div>
      )}
      {!v.armando && !falla && !v.bajando.length && v.desactualizada && (
        <div className="f2t-warn">
          <I2.refresh width={15} height={15} /><span>Hay calls nuevas que esta propuesta todavía no tiene en cuenta.</span>
          {puedeIA && <button type="button" className="f2t-sec" onClick={onArmar}>Actualizar</button>}
        </div>
      )}
      <p className="f2t-lbl">Qué le podemos vender <span className="n">{its.length}</span></p>
      <div className="f2t-sell">
        {its.map((i) => (
          <button key={i.id} type="button" className="f2t-row" onClick={() => onAbrir(i.id)} aria-haspopup="dialog">
            <b>{i.titulo}</b>
            <span className="p">{i.precioUsd ? usd(i.precioUsd) : '—'}{i.cobro === 'mensual' && <small>por mes</small>}</span>
            {i.porQue && <span className="w">{i.porQue}</span>}
          </button>
        ))}
      </div>
      {its.length > 0 && (
        <div className="f2t-total">
          <div>
            <div className="lb">Total{t.sinPrecio ? ` · ${t.sinPrecio} sin precio` : ''}</div>
            <div className="big f2t-d">
              {t.unico > 0 ? usd(t.unico) : t.mensual > 0 ? <>{usd(t.mensual)}<small>por mes</small></> : '—'}
            </div>
            {t.unico > 0 && t.mensual > 0 && <div className="mes">+ {usd(t.mensual)} por mes</div>}
          </div>
          <div className="f2t-acts">
            <button type="button" className="f2t-sec" onClick={onCopiar}><I2.copy width={14} height={14} /> Copiar</button>
            {puedeIA && !v.desactualizada && <button type="button" className="f2t-sec" onClick={onArmar}><I2.refresh width={14} height={14} /> Rehacer</button>}
          </div>
        </div>
      )}
      {p.siguientePaso && <div className="f2t-next"><b>Próxima llamada:</b> {p.siguientePaso}</div>}
      {p.loQueHablaron.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <p className="f2t-lbl">Lo que hablaron</p>
          <ul className="f2t-said">{p.loQueHablaron.map((s, i) => <li key={i}><span>{s}</span></li>)}</ul>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── La vista ─────────────────────────── */

export default function Fase2Tablero({ onOpenProject }) {
  const { data, myId, supabase, fase2Store } = useApp()
  const reduce = useReducedMotion()
  const me = (data.team || []).find((u) => u.id === myId)
  const puedeVer = !me || puedeVerFase2(me)
  const puede = !!fase2Store && !esSoloLectura() && (!me || puedeEditarFase2(me))
  const puedeIA = puede && !!supabase
  const [toast, vistaToast] = useToast()

  const items = fase2Store?.items || []
  const ids = useMemo(() => proyectosDelTablero(items), [items])
  const porId = useMemo(() => new Map((data.projects || []).map((p) => [p.id, p])), [data.projects])
  const enTablero = useMemo(() => ids.map((id) => porId.get(id)).filter(Boolean), [ids, porId])
  const clienteDe = useCallback((p) => {
    const c = (data.clients || []).find((x) => x.id === p?.clientId)
    return c ? (c.company || c.name || '') : ''
  }, [data.clients])

  const [sel, setSel] = useState(() => { try { return localStorage.getItem('f2t_sel') } catch { return null } })
  const actual = enTablero.find((p) => p.id === sel) || enTablero[enTablero.length - 1] || null
  useEffect(() => { try { if (actual) localStorage.setItem('f2t_sel', actual.id) } catch { /* sin storage */ } }, [actual?.id])

  const [cajon, setCajon] = useState(null) // 'proyecto' | 'fathom' | { item }
  const [ahora, setAhora] = useState(() => new Date())
  const [fathomCalls, setFathomCalls] = useState([])

  useEffect(() => {
    if (!supabase || !actual) return undefined
    let vivo = true
    const filtro = actual.clientId ? `project_id.eq.${actual.id},client_id.eq.${actual.clientId}` : `project_id.eq.${actual.id}`
    supabase.from('fathom_calls').select('title, share_url, call_date, project_id, client_id').or(filtro).limit(40)
      .then(({ data: rows }) => { if (vivo) setFathomCalls(rows || []) })
    return () => { vivo = false }
  }, [supabase, actual?.id, actual?.clientId])

  const v = useMemo(() => (actual ? vistaTablero(items, actual.id, ahora) : null), [items, actual?.id, ahora])
  const sugeridas = useMemo(() => (actual ? sugerenciasFathom({ project: actual, calls: data.calls || [], fathomCalls, cargadas: v?.calls || [] }) : []), [actual, data.calls, fathomCalls, v?.calls])
  const sugeridosDe = useCallback((p) => sugerenciasFathom({ project: p, calls: data.calls || [], cargadas: vistaTablero(items, p.id).calls }).length, [data.calls, items])

  // Mientras se baja una call o se arma la propuesta se mira su fila cada pocos segundos, por si el
  // realtime no llega, y anda el reloj que detecta lo que se trabó.
  const vigilar = useMemo(() => {
    if (!v) return ''
    const enCurso = v.calls.filter((c) => (c.estado === 'bajando' || c.estado === 'analizando') && !llamadaTrabada(c, ahora)).map((c) => c.id)
    if (v.propuesta && v.propuesta.estado === 'armando') enCurso.push(v.propuesta.id)
    return enCurso.join(',')
  }, [v, ahora])
  useEffect(() => {
    if (!vigilar) return undefined
    let vivo = true
    const t = setInterval(async () => {
      setAhora(new Date())
      if (!supabase || !fase2Store?.mergeRemote) return
      const { data: filas } = await supabase.from('project_fase2').select('id, data').in('id', vigilar.split(','))
      if (!vivo) return
      for (const f of filas || []) if (f.data) fase2Store.mergeRemote({ ...f.data, id: f.id })
    }, 4000)
    return () => { vivo = false; clearInterval(t) }
  }, [supabase, vigilar]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Acciones ── */

  const sumarProyecto = (p) => {
    setCajon(null)
    setSel(p.id)
    const id = idTablero(p.id)
    if (items.some((x) => x.id === id)) fase2Store.patch(id, (x) => ({ ...x, deletedAt: null, at: new Date().toISOString() }))
    else fase2Store.create(nuevoTablero({ projectId: p.id, by: myId || null }))
  }

  const sacarProyecto = (p) => {
    const id = idTablero(p.id)
    fase2Store.patch(id, (x) => marcarBorrada(x))
    toast(`${p.name} salió del tablero`, () => { fase2Store.patch(id, (x) => ({ ...x, deletedAt: null })); setSel(p.id) })
  }

  const pendienteArmar = useRef(new Set())
  const armar = useCallback(async (pid) => {
    if (!puedeIA) return
    const prev = vistaTablero(fase2Store.items, pid).propuesta
    const r = await llamarFase2(supabase, { accion: 'armar_propuesta', proyecto: pid })
    if (r.error) { toast(r.error); return }
    if (r.data?.propuesta) fase2Store.mergeRemote(r.data.propuesta)
    if (prev && prev.estado === 'lista') respaldo.current.set(pid, prev)
  }, [puedeIA, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rehacer pisa la propuesta (precios ajustados incluidos): cuando llega la nueva se ofrece volver a la anterior.
  const respaldo = useRef(new Map())
  useEffect(() => {
    if (!actual || !v?.propuesta || v.propuesta.estado !== 'lista') return
    const prev = respaldo.current.get(actual.id)
    if (!prev || prev.generadoAt === v.propuesta.generadoAt) return
    respaldo.current.delete(actual.id)
    const pid = v.propuesta.id
    toast('Propuesta actualizada', () => fase2Store.patch(pid, (x) => ({ ...x, ...prev, id: x.id, projectId: x.projectId, kind: 'propuesta' })))
  }, [actual?.id, v?.propuesta?.generadoAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando se terminan de bajar las calls que se cargaron recién, la propuesta se arma sola.
  useEffect(() => {
    if (!actual || !v || !puedeIA) return
    const pid = actual.id
    const esperaba = pendienteArmar.current.has(pid)
    const nunca = !v.propuesta && v.conTexto.length > 0
    if (v.bajando.length || !v.conTexto.length || v.armando) return
    if (esperaba || nunca) {
      pendienteArmar.current.delete(pid)
      if (nunca || v.desactualizada || !v.propuesta) armar(pid)
    }
  }, [actual?.id, v?.bajando.length, v?.conTexto.length, v?.propuesta?.id, v?.desactualizada, v?.armando]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarCalls = async (urls) => {
    if (!actual || !puedeIA) return
    setCajon(null)
    const pid = actual.id
    pendienteArmar.current.add(pid)
    const nuevas = urls.map((url) => nuevaCall({ projectId: pid, link: url, by: myId || null }))
    await Promise.all(nuevas.map(async (e) => {
      const { error } = await fase2Store.create(e)
      if (error) { fase2Store.patch(e.id, (x) => ({ ...x, estado: 'error', error: 'No se pudo guardar. Probá de nuevo.' })); return }
      const r = await llamarFase2(supabase, { accion: 'analizar_call', proyecto: pid, entrada: e.id })
      if (!r.error) return
      if (r.entrada) fase2Store.mergeRemote(r.entrada)
      else fase2Store.patch(e.id, (x) => ({ ...x, estado: 'error', error: r.error }))
    }))
  }

  const reintentarCall = async (c) => {
    fase2Store.patch(c.id, (x) => ({ ...x, estado: x.texto ? 'analizando' : 'bajando', error: null }))
    pendienteArmar.current.add(c.projectId)
    const r = await llamarFase2(supabase, { accion: 'analizar_call', proyecto: c.projectId, entrada: c.id })
    if (r.error) { if (r.entrada) fase2Store.mergeRemote(r.entrada); else fase2Store.patch(c.id, (x) => ({ ...x, estado: 'error', error: r.error })) }
  }

  const sacarCall = (c) => {
    fase2Store.patch(c.id, (x) => marcarBorrada(x))
    toast('Call quitada', () => fase2Store.patch(c.id, (x) => ({ ...x, deletedAt: null })))
  }

  const cambiarItem = (item, fn) => {
    if (!v?.propuesta) return
    fase2Store.patch(v.propuesta.id, (x) => ({ ...x, queVender: x.queVender.map((i) => (i.id === item.id ? fn(i) : i)) }))
  }
  const cambiarPrecio = (item, precioUsd) => {
    const antes = item.precioUsd
    const antesEditado = item.editado
    cambiarItem(item, (i) => ({ ...i, precioUsd, editado: true }))
    toast(`Precio: ${precioUsd ? usd(precioUsd) : 'sin precio'}`, () => cambiarItem(item, (i) => ({ ...i, precioUsd: antes, editado: antesEditado })))
  }
  const quitarItem = (item) => {
    setCajon(null)
    cambiarItem(item, (i) => ({ ...i, quitado: true }))
    toast(`${item.titulo} salió de la propuesta`, () => cambiarItem(item, (i) => ({ ...i, quitado: false })))
  }

  const copiar = async () => {
    try { await navigator.clipboard.writeText(propuestaComoTexto(v.propuesta, actual?.name)); toast('Propuesta copiada') } catch { toast('No pude copiar. Probá de nuevo.') }
  }

  /* ── Rail: la píldora se desliza a la tarjeta elegida ── */
  const railRef = useRef(null)
  const cardRefs = useRef(new Map())
  const [pill, setPill] = useState(null)
  useLayoutEffect(() => {
    const medir = () => {
      const el = actual && cardRefs.current.get(actual.id)
      if (!el) { setPill(null); return }
      setPill({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
      const r = railRef.current
      if (r) r.scrollTo({ left: el.offsetLeft - r.clientWidth / 2 + el.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [actual?.id, enTablero.length, reduce])

  const teclas = (e) => {
    const i = enTablero.findIndex((p) => p.id === actual?.id)
    const ir = (j) => { const p = enTablero[j]; if (!p) return; e.preventDefault(); setSel(p.id); cardRefs.current.get(p.id)?.focus() }
    if (e.key === 'ArrowRight') ir(i + 1)
    if (e.key === 'ArrowLeft') ir(i - 1)
  }

  const disponibles = useMemo(() => (data.projects || [])
    .filter((p) => p && !p.deletedAt && p.kind !== 'interno' && !ids.includes(p.id)), [data.projects, ids])

  const dir = useRef(1)
  const prevIdx = useRef(-1)
  const idxActual = enTablero.findIndex((p) => p.id === actual?.id)
  if (idxActual !== prevIdx.current) { dir.current = idxActual >= prevIdx.current ? 1 : -1; prevIdx.current = idxActual }

  if (!puedeVer) {
    return <div className="f2t"><style>{CSS}</style><div className="f2t-in"><p style={{ color: 'var(--text-dim)' }}>Esta sección es sólo para el equipo comercial.</p></div></div>
  }

  const estadoCard = (p) => {
    const w = vistaTablero(items, p.id, ahora)
    if (w.bajando.length || w.armando) return { dot: 'on', txt: w.armando ? 'Armando propuesta' : 'Bajando calls' }
    if (w.propuesta?.estado === 'lista') {
      const t = totalesPropuesta(w.propuesta)
      return { dot: 'ok', txt: t.unico ? usd(t.unico) : t.mensual ? `${usd(t.mensual)}/mes` : 'Propuesta lista' }
    }
    if (w.calls.length) return { dot: '', txt: `${w.calls.length} ${w.calls.length === 1 ? 'call' : 'calls'}` }
    return { dot: '', txt: 'Sin calls' }
  }

  return (
    <div className="f2t">
      <style>{CSS}</style>
      <div className="f2t-in">
        <div className="f2t-top">
          <div>
            <p className="f2t-k"><i />Ventas</p>
            <h1 className="f2t-d">Fase 2</h1>
          </div>
        </div>

        {!enTablero.length ? (
          <div className="f2t-empty">
            <motion.button type="button" className="big" onClick={() => setCajon('proyecto')} disabled={!puede}
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease }}>
              <span className="plus"><I2.plus width={22} height={22} /></span>
              <b className="f2t-d">Sumá un proyecto</b>
              <span>Elegí un cliente para armarle su Fase 2</span>
            </motion.button>
          </div>
        ) : (
          <>
            <div className="f2t-rail" ref={railRef}>
              <div className="f2t-cards" role="tablist" aria-label="Proyectos en Fase 2" onKeyDown={teclas}>
                {pill && <div className="f2t-pill" aria-hidden="true" style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px,${pill.y}px)` }} />}
                {enTablero.map((p, i) => {
                  const on = p.id === actual?.id
                  const st = estadoCard(p)
                  return (
                    <motion.button key={p.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
                      ref={(el) => { if (el) cardRefs.current.set(p.id, el); else cardRefs.current.delete(p.id) }}
                      className="f2t-card" onClick={() => setSel(p.id)}
                      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: Math.min(i, 8) * 0.04 }}>
                      <Avatar project={p} />
                      <b>{p.name}</b>
                      <span className="s"><i className={`f2t-dot ${st.dot}`} />{st.txt}</span>
                    </motion.button>
                  )
                })}
                {puede && (
                  <button type="button" className="f2t-add" onClick={() => setCajon('proyecto')}>
                    <span className="plus"><I2.plus width={18} height={18} /></span>
                    Sumar proyecto
                  </button>
                )}
              </div>
            </div>
            <div className="f2t-bar" aria-hidden="true"><i style={{ transform: `scaleX(${(idxActual + 1) / Math.max(1, enTablero.length)})` }} /></div>

            <div className="f2t-stage">
              <AnimatePresence mode="wait" initial={false}>
                {actual && v && (
                  <motion.section key={actual.id} className="f2t-panel" role="tabpanel" aria-label={actual.name}
                    initial={reduce ? false : { opacity: 0, x: 28 * dir.current, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 * dir.current, filter: 'blur(5px)', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                    transition={{ duration: 0.55, ease }}>
                    <div>
                      <div className="f2t-h">
                        <span>{clienteDe(actual) || 'Sin cliente'}</span>
                        {onOpenProject && <button type="button" className="open" onClick={() => onOpenProject(actual.id)}>Abrir proyecto <I2.chevR width={12} height={12} /></button>}
                      </div>
                      <h2 className="f2t-name f2t-d">{actual.name}</h2>
                      <Propuesta v={v} puede={puede} puedeIA={puedeIA} sugeridas={sugeridas.length}
                        onCargar={() => setCajon('fathom')} onArmar={() => armar(actual.id)} onCopiar={copiar}
                        onAbrir={(itemId) => setCajon({ item: itemId })} />
                    </div>

                    <aside className="f2t-side">
                      {v.calls.length > 0 && <div className="f2t-box">
                        <p className="f2t-lbl">Calls de Fathom <span className="n">{v.calls.length || ''}</span></p>
                        {v.calls.length > 0 && (
                          <div className="f2t-calls">
                            {v.calls.map((c) => {
                              const trab = llamadaTrabada(c, ahora)
                              const err = c.estado === 'error' || (trab && !c.texto)
                              const cargando = !c.texto && !err
                              return (
                                <div key={c.id} className="f2t-call">
                                  <span className={`f2t-dot ${cargando ? 'on' : err ? '' : 'ok'}`} style={err ? { background: 'var(--red)' } : undefined} />
                                  <span className="tx">
                                    <b>{c.titulo || (cargando ? 'Bajando la call…' : 'Call de Fathom')}</b>
                                    {err
                                      ? <small className="err">{trab ? 'Se cortó.' : c.error}{puedeIA && <> <button type="button" className="f2t-quit" style={{ color: 'var(--violet)', padding: 0 }} onClick={() => reintentarCall(c)}>Probar de nuevo</button></>}</small>
                                      : <small>{c.at ? fmtDay(c.at) : ''}{cargando ? ' · bajando' : ''}</small>}
                                  </span>
                                  {puede && <button type="button" className="f2t-x" onClick={() => sacarCall(c)} aria-label={`Quitar ${c.titulo || 'la call'}`}><I2.x width={14} height={14} /></button>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {puede && (
                          <button type="button" className="f2t-sec" style={{ marginTop: 12, width: '100%' }} onClick={() => setCajon('fathom')} disabled={!puedeIA}>
                            <I2.plus width={14} height={14} /> Cargar Fathom
                          </button>
                        )}
                      </div>}

                      {puede && sugeridas.length > 0 && (
                        <div className="f2t-box">
                          <p className="f2t-lbl">Sugeridas <span className="n">{sugeridas.length}</span></p>
                          {sugeridas.slice(0, 4).map((s) => (
                            <div key={s.clave} className="f2t-sug">
                              <span className="ic"><I2.phone width={14} height={14} /></span>
                              <span style={{ minWidth: 0 }}><b>{s.titulo || 'Call de Fathom'}</b><small>{s.at ? fmtDay(s.at) : 'Ya vinculada al proyecto'}</small></span>
                              <button type="button" className="f2t-sec" style={{ height: 32 }} onClick={() => cargarCalls([s.url])} disabled={!puedeIA}>Sumar</button>
                            </div>
                          ))}
                          {sugeridas.length > 1 && (
                            <button type="button" className="f2t-sec" style={{ marginTop: 10, width: '100%' }} onClick={() => cargarCalls(sugeridas.map((s) => s.url))} disabled={!puedeIA}>
                              Sumar las {sugeridas.length}
                            </button>
                          )}
                        </div>
                      )}

                      {puede && <button type="button" className="f2t-quit" onClick={() => sacarProyecto(actual)}>Sacar del tablero</button>}
                    </aside>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      <ElegirProyecto open={cajon === 'proyecto'} onClose={() => setCajon(null)} proyectos={disponibles} clienteDe={clienteDe} onElegir={sumarProyecto} sugeridosDe={sugeridosDe} />
      <CargarFathom open={cajon === 'fathom'} onClose={() => setCajon(null)} sugeridas={sugeridas} onCargar={cargarCalls} />
      <DetalleItem item={cajon && cajon.item && v?.propuesta ? v.propuesta.queVender.find((i) => i.id === cajon.item) || null : null}
        onClose={() => setCajon(null)} puede={puede} onPrecio={cambiarPrecio} onQuitar={quitarItem} />
      {vistaToast}
    </div>
  )
}
