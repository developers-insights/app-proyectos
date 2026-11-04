import { useEffect, useLayoutEffect, useRef } from 'react'
import { useMotionValue, useTransform } from 'framer-motion'
import { clampView, fitView, zoomAt } from './iso.js'

const ZOOM_MIN = 0.2
const ZOOM_MAX = 2.2
const FIT_MAX = 1.18

/*
 * Cámara de la oficina: pan, rueda y pinch sobre motion values, sin pasar por React.
 * Un render de InsightsView rearma todas las salas y fichas: en cada wheel se notaría.
 *
 * Todo salto (rueda, botones, Ajustar) interpola k, x e y con el mismo factor: como
 * `zoomAt` deja las tres sobre la misma recta, el punto bajo el cursor no se corre
 * en ningún cuadro de la animación.
 */
export function useViewport(stageRef, boundsRef, reduce, onTouch) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const k = useMotionValue(1)
  const pct = useTransform(k, (v) => `${Math.round(v * 100)}%`)
  const touchFn = useRef(onTouch)
  touchFn.current = onTouch
  const reduceRef = useRef(reduce)
  reduceRef.current = reduce

  const api = useRef(null)
  if (!api.current) {
    const touches = new Map()
    let raf = 0
    let last = 0
    let target = null
    let touched = false
    const size = () => ({ w: stageRef.current?.clientWidth || 1, h: stageRef.current?.clientHeight || 1 })
    const read = () => ({ k: k.get(), x: x.get(), y: y.get() })
    const write = (v) => { k.set(v.k); x.set(v.x); y.set(v.y) }
    const stop = () => { cancelAnimationFrame(raf); raf = 0; target = null }
    const clamp = (v) => { const { w, h } = size(); return clampView(v, boundsRef.current, w, h) }
    const step = (t) => {
      const a = 1 - Math.exp(-Math.min(48, t - last) / 62)
      last = t
      const c = read()
      const n = { k: c.k + (target.k - c.k) * a, x: c.x + (target.x - c.x) * a, y: c.y + (target.y - c.y) * a }
      if (Math.abs(n.k - target.k) < 0.0008 && Math.abs(n.x - target.x) < 0.3 && Math.abs(n.y - target.y) < 0.3) { write(target); stop(); return }
      write(n)
      raf = requestAnimationFrame(step)
    }
    const goTo = (v, instant) => {
      const to = clamp(v)
      if (instant || reduceRef.current) { stop(); write(to); return }
      target = to
      if (!raf) { last = performance.now() - 16; raf = requestAnimationFrame(step) }
    }
    const hit = () => { touched = true; touchFn.current?.() }

    api.current = {
      x, y, k, pct,
      fit(bounds, instant) {
        const { w, h } = size()
        goTo(fitView(bounds || boundsRef.current, w, h, { max: FIT_MAX, min: ZOOM_MIN }), instant)
      },
      refit() { touched = false; api.current.fit() },
      resized() { if (!touched) api.current.fit(null, true) },
      zoom(f, px, py) {
        const { w, h } = size()
        const base = target || read()
        const nk = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, base.k * f))
        hit()
        goTo(zoomAt(base, nk, px ?? w / 2, py ?? h / 2))
      },
      zoomTo(nk) { const { w, h } = size(); hit(); goTo(zoomAt(target || read(), nk, w / 2, h / 2)) },
      center(cx, cy) {
        const r = stageRef.current.getBoundingClientRect()
        const c = read()
        goTo({ ...c, x: c.x + r.left + r.width / 2 - cx, y: c.y + r.top + r.height / 2 - cy })
      },
      /* Lleva la cámara cuando un arrastre toca el borde. Devuelve si se movió. */
      edgePan(cx, cy) {
        const el = stageRef.current
        if (!el) return false
        const r = el.getBoundingClientRect()
        const edge = 70
        const vx = cx < r.left + edge ? cx - (r.left + edge) : cx > r.right - edge ? cx - (r.right - edge) : 0
        const vy = cy < r.top + edge ? cy - (r.top + edge) : cy > r.bottom - edge ? cy - (r.bottom - edge) : 0
        if (!vx && !vy) return false
        stop()
        x.set(x.get() - Math.max(-18, Math.min(18, vx * 0.3)))
        y.set(y.get() - Math.max(-18, Math.min(18, vy * 0.3)))
        return true
      },
      touchCount: () => touches.size,
      track(e) { if (e.pointerType === 'touch') touches.set(e.pointerId, { x: e.clientX, y: e.clientY }) },
      untrack(e) { touches.delete(e.pointerId) },
      trackMove(e) { if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY }) },

      /* Pasado el borde, la escena sigue al dedo con resistencia y vuelve al soltar. */
      panFrom(id, cx, cy, onEnd) {
        stop()
        hit()
        const el = stageRef.current
        let s = { cx, cy, ...read() }
        let moved = false
        let pinch = null
        const finish = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          window.removeEventListener('pointercancel', up)
          document.documentElement.classList.remove('io-dragging')
          const c = read()
          const to = clamp(c)
          if (Math.abs(to.x - c.x) > 0.5 || Math.abs(to.y - c.y) > 0.5) goTo(to)
          onEnd?.(moved)
        }
        const move = (ev) => {
          if (touches.size >= 2) {
            const [a, b] = [...touches.values()]
            const d = Math.hypot(a.x - b.x, a.y - b.y) || 1
            const r = el.getBoundingClientRect()
            const mx = (a.x + b.x) / 2 - r.left
            const my = (a.y + b.y) / 2 - r.top
            if (!pinch) pinch = { d, ...read(), mx, my }
            const nk = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinch.k * (d / pinch.d)))
            const v = zoomAt(pinch, nk, pinch.mx, pinch.my)
            moved = true
            write({ k: nk, x: v.x + mx - pinch.mx, y: v.y + my - pinch.my })
            return
          }
          if (pinch) { pinch = null; s = { cx: ev.clientX, cy: ev.clientY, ...read() } }
          if (ev.pointerId !== id && touches.size === 0) return
          const dx = ev.clientX - s.cx
          const dy = ev.clientY - s.cy
          if (!moved && Math.hypot(dx, dy) < 3) return
          if (!moved) { moved = true; document.documentElement.classList.add('io-dragging') }
          const free = { k: s.k, x: s.x + dx, y: s.y + dy }
          const c = clamp(free)
          write({ k: s.k, x: c.x + (free.x - c.x) * 0.3, y: c.y + (free.y - c.y) * 0.3 })
        }
        const up = (ev) => {
          if (ev.pointerType === 'touch' ? touches.size === 0 : ev.pointerId === id) finish()
        }
        window.addEventListener('pointermove', move, { passive: false })
        window.addEventListener('pointerup', up)
        window.addEventListener('pointercancel', up)
      },
    }
  }

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const v = api.current
    v.fit(null, true)
    const ro = new ResizeObserver(() => v.resized())
    ro.observe(el)
    return () => ro.disconnect()
  }, [stageRef])

  /* Listeners nativos: React registra wheel como pasivo y no dejaría frenar el scroll de la página. */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const v = api.current
    const wheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const line = e.deltaMode === 1 ? 33 : 1
      const d = e.deltaY * line
      // Dos dedos en el trackpad con corrimiento lateral: mueve. Pinch (ctrlKey) y rueda: zoom.
      if (e.deltaX && !e.ctrlKey) {
        const c = { k: k.get(), x: x.get() - e.deltaX * line, y: y.get() - d }
        const { clientWidth: w, clientHeight: h } = el
        const to = clampView(c, boundsRef.current, w, h)
        x.set(to.x); y.set(to.y)
        return
      }
      v.zoom(Math.exp(-d * (e.ctrlKey ? 0.009 : 0.0016)), e.clientX - r.left, e.clientY - r.top)
    }
    const track = (e) => v.track(e)
    const untrack = (e) => v.untrack(e)
    const trackMove = (e) => v.trackMove(e)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', track, true)
    window.addEventListener('pointermove', trackMove, true)
    window.addEventListener('pointerup', untrack, true)
    window.addEventListener('pointercancel', untrack, true)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', track, true)
      window.removeEventListener('pointermove', trackMove, true)
      window.removeEventListener('pointerup', untrack, true)
      window.removeEventListener('pointercancel', untrack, true)
    }
  }, [stageRef, boundsRef, k, x, y])

  return api.current
}
