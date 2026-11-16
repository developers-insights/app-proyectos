import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../ui.jsx'
import { I2 } from './icons2.jsx'
import ProyectoAvatar from './ProyectoAvatar.jsx'
import { logoDe } from '../lib/logos.js'
import { procesarLogo, subirLogo, TIPOS_LOGO } from '../lib/logoImagen.js'
import { esSoloLectura } from '../lib/soloLectura.js'

const DESHACER_MS = 6000

const CSS = `
.lg-wrap{position:relative;flex:none}
.lg-tile{position:relative;display:grid;place-items:center;width:56px;height:56px;border-radius:15px;border:0;padding:0;
  font-size:18px;font-weight:700;letter-spacing:.01em;color:var(--text);background:var(--bg-elevated);
  box-shadow:inset 0 0 0 1px var(--border);cursor:pointer;transition:box-shadow .16s var(--e,ease)}
.lg-tile[disabled]{cursor:default}
.lg-tile .pav-img{border-radius:15px}
.lg-tile .lg-ed{position:absolute;inset:0;display:grid;place-items:center;border-radius:15px;color:#fff;
  background:rgba(10,10,12,.5);opacity:0;transition:opacity .16s var(--e,ease)}
.lg-tile:not([disabled]):hover .lg-ed,.lg-tile:focus-visible .lg-ed{opacity:1}
.lg-tile:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.lg-tile[aria-busy="true"] .lg-ed{opacity:1}
.lg-spin{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:lgSpin .8s linear infinite}
@keyframes lgSpin{to{transform:rotate(360deg)}}
.lg-menu{position:absolute;left:0;top:64px;z-index:40;min-width:190px;padding:5px;border-radius:13px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--border),0 14px 34px -14px rgba(0,0,0,.45)}
.lg-menu button{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 10px;border:0;border-radius:9px;
  background:transparent;color:var(--text);font-size:13px;font-weight:550;text-align:left;cursor:pointer}
.lg-menu button:hover,.lg-menu button:focus-visible{background:var(--card-hover);outline:none}
.lg-menu button[data-tone="del"]{color:var(--red)}
.lg-menu .lg-hint{padding:6px 10px 4px;font-size:11px;color:var(--text-faint);line-height:1.4}
.lg-toast{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));z-index:90;display:flex;align-items:center;gap:12px;
  max-width:calc(100vw - 32px);padding:8px 8px 8px 16px;border-radius:999px;font-size:13px;color:var(--bg);background:var(--text);
  box-shadow:0 14px 34px -12px rgba(0,0,0,.5)}
.lg-toast span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lg-toast button{flex:none;height:34px;padding:0 14px;border:0;border-radius:999px;font-weight:700;font-size:13px;background:var(--bg);color:var(--text);cursor:pointer}
.lg-toast[data-err]{padding-right:16px}
@media (prefers-reduced-motion:reduce){.lg-spin{animation-duration:2.4s}}
`

/** El logo en el encabezado del detalle: subir, cambiar o sacar. Optimista; sacar se puede deshacer. */
export default function LogoEditable({ project, texto, patch }) {
  const { supabase } = useApp()
  const reduce = useReducedMotion()
  const puede = !esSoloLectura()
  const input = useRef(null)
  const wrap = useRef(null)
  const [menu, setMenu] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [oculto, setOculto] = useState(false)
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const pendiente = useRef(null)

  const actual = logoDe(project)
  const mostrado = oculto ? null : previa || actual

  useEffect(() => {
    if (!menu) return undefined
    const fuera = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setMenu(false) }
    const esc = (e) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc) }
  }, [menu])

  const aplicarPendiente = () => {
    clearTimeout(timer.current)
    const fn = pendiente.current
    pendiente.current = null
    if (fn) fn()
  }
  useEffect(() => () => aplicarPendiente(), [project.id])

  const avisar = (t) => {
    clearTimeout(timer.current)
    setToast({ ...t, key: Date.now() })
    timer.current = setTimeout(() => { setToast(null); aplicarPendiente() }, t.undo ? DESHACER_MS : 4500)
  }

  const elegir = () => { setMenu(false); input.current?.click() }

  const alElegir = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    aplicarPendiente()
    setOculto(false)
    setSubiendo(true)
    try {
      const listo = await procesarLogo(file)
      setPrevia(listo.dataUrl)
      const ruta = await subirLogo(supabase, project.id, listo)
      patch((p) => ({ ...p, logo: ruta }))
    } catch (err) {
      setPrevia(null)
      avisar({ text: err?.message || 'No se pudo cargar el logo.', err: true })
    } finally {
      setSubiendo(false)
    }
  }

  useEffect(() => { if (previa && !subiendo && actual) setPrevia(null) }, [actual, subiendo])

  const sacar = () => {
    setMenu(false)
    aplicarPendiente()
    setPrevia(null)
    setOculto(true)
    pendiente.current = () => { patch((p) => ({ ...p, logo: null })); setOculto(false) }
    avisar({ text: `Sacaste el logo de ${project.name}`, undo: true })
  }

  const deshacer = () => {
    clearTimeout(timer.current)
    pendiente.current = null
    setOculto(false)
    setToast(null)
  }

  const abrir = () => { if (!puede || subiendo) return; if (mostrado) setMenu((m) => !m); else elegir() }
  const label = !puede ? `Logo de ${project.name}` : mostrado ? `Cambiar o sacar el logo de ${project.name}` : `Subir el logo de ${project.name}`

  return (
    <div className="lg-wrap" ref={wrap}>
      <style>{CSS}</style>
      <button type="button" className="lg-tile" onClick={abrir} disabled={!puede} aria-label={label} title={puede ? label : undefined}
        aria-haspopup={mostrado && puede ? 'menu' : undefined} aria-expanded={mostrado && puede ? menu : undefined} aria-busy={subiendo}>
        <ProyectoAvatar logo={mostrado} texto={texto} className="lg-av" lazy={false}
          style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', borderRadius: 15 }} />
        {puede && (
          <span className="lg-ed" aria-hidden="true">
            {subiendo ? <span className="lg-spin" /> : mostrado ? <I2.pencil width={16} height={16} /> : <I2.plus width={18} height={18} />}
          </span>
        )}
      </button>
      <input ref={input} type="file" accept={TIPOS_LOGO.join(',')} hidden onChange={alElegir} />
      {menu && (
        <div className="lg-menu" role="menu">
          <button type="button" role="menuitem" onClick={elegir} autoFocus><I2.image width={15} height={15} /> Cambiar logo</button>
          <button type="button" role="menuitem" data-tone="del" onClick={sacar}><I2.trash width={15} height={15} /> Sacar logo</button>
          <div className="lg-hint">PNG, JPG, SVG o WebP. Se achica solo.</div>
        </div>
      )}
      {typeof document !== 'undefined' && createPortal(
        <div aria-live="polite">
          <AnimatePresence>
            {toast && (
              <motion.div key={toast.key} className="lg-toast" data-err={toast.err ? '' : undefined} style={{ x: '-50%' }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.14 } }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>
                <span>{toast.text}</span>
                {toast.undo && <button type="button" onClick={deshacer}>Deshacer</button>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </div>
  )
}
