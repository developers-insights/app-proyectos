import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from 'framer-motion'
import { I2 } from './icons2.jsx'
import { onAvisoSoloLectura } from '../lib/soloLectura.js'

const DURA_MS = 5200

const CSS = `
.sl-aviso{position:fixed;z-index:120;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));width:min(440px,calc(100vw - 32px));
  display:flex;align-items:flex-start;gap:13px;padding:14px 12px 14px 14px;border-radius:18px;color:var(--text);
  background:color-mix(in srgb,var(--bg-elevated) 94%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  box-shadow:inset 0 0 0 1px var(--border-strong),0 22px 48px -18px rgba(0,0,0,.55)}
.sl-aviso .ic{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:12px;
  color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line)}
.sl-aviso .tx{flex:1;min-width:0;padding-top:1px}
.sl-aviso .tx b{display:block;font-size:13.5px;font-weight:700;letter-spacing:-.01em;margin-bottom:3px}
.sl-aviso .tx span{display:block;font-size:12.5px;line-height:1.45;color:var(--text-dim)}
.sl-aviso .x{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:10px;color:var(--text-faint);
  transition:color .18s var(--e),background .18s var(--e),transform .14s var(--e)}
.sl-aviso .x:hover{color:var(--text);background:var(--card-hover)}
.sl-aviso .x:active{transform:scale(.92)}
.sl-aviso .x:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.sl-aviso .bar{position:absolute;left:16px;right:16px;bottom:0;height:2px;border-radius:2px;overflow:hidden}
.sl-aviso .bar i{display:block;height:100%;background:var(--accent-line);transform-origin:left}
`

export default function SoloLecturaAviso() {
  const [n, setN] = useState(0)
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const lock = useAnimationControls()
  const timer = useRef(null)

  useEffect(() => onAvisoSoloLectura(() => setN((x) => x + 1)), [])

  useEffect(() => {
    if (!n) return undefined
    setOpen(true)
    if (!reduce) lock.start({ rotate: [0, -14, 11, -6, 0], transition: { duration: 0.42, ease: [0.32, 0.72, 0, 1] } })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), DURA_MS)
    return () => clearTimeout(timer.current)
  }, [n, reduce, lock])

  useEffect(() => {
    if (!open) return undefined
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  return createPortal(
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {open && (
          <motion.div key="sl" className="sl-aviso" role="status" aria-live="polite"
            initial={reduce ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: 20, scale: 0.96 }}
            animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 440, damping: 32 }}>
            <motion.span className="ic" animate={lock}><I2.lock width={17} height={17} /></motion.span>
            <span className="tx">
              <b>Tenés acceso de lectura</b>
              <span>Podés ver y recorrer todo, pero no cambiar datos. Si hace falta un cambio, pedíselo a alguien del equipo.</span>
            </span>
            <button type="button" className="x" onClick={() => setOpen(false)} aria-label="Cerrar aviso"><I2.x width={14} height={14} /></button>
            {!reduce && (
              <span className="bar" aria-hidden="true">
                <motion.i key={n} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: DURA_MS / 1000, ease: 'linear' }} />
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}
