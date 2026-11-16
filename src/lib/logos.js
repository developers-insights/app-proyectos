/**
 * logos.js — el logo de cada proyecto (pedido de Manuel, 16/11).
 *
 * JS puro: lo usan el avatar (src/ui/ProyectoAvatar.jsx), la subida desde el detalle y el
 * script de relleno (scripts/logos-rellenar.mjs).
 *
 * `project.logo` es la ruta del archivo en el bucket privado `project-logos`
 * (`<projectId>/<hash>.webp`, por contenido: el mismo archivo da la misma ruta). Sin base
 * (modo local con datos semilla) puede ser un `data:image/...` que nunca sale del navegador.
 */

export const LOGO_BUCKET = 'project-logos'
export const LADO_LOGO = 192
export const MARGEN_LOGO = 0.12
export const FIRMA_DIAS = 30

const RUTA = /^[A-Za-z0-9_-]{1,80}\/[a-f0-9]{16,64}\.(webp|png|jpg)$/
const DATA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

export function logoDe(project) {
  const v = project && project.logo
  if (typeof v !== 'string' || !v) return null
  return RUTA.test(v) || DATA.test(v) ? v : null
}

export const esDataUrl = (logo) => typeof logo === 'string' && logo.startsWith('data:')

export function rutaLogo(projectId, hashHex) {
  const id = String(projectId || '')
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error('id de proyecto inválido para la ruta del logo')
  return `${id}/${String(hashHex).toLowerCase().slice(0, 16)}.webp`
}

export const iniciales = (s) => {
  const w = String(s || '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!w.length) return '·'
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase()
}

export const verLogo = ({ logo, url, fallo }) => !!(logo && url && !fallo)

/**
 * Cómo dibujar la imagen original en el lienzo cuadrado de LADO_LOGO.
 * Un ícono de app (opaco y casi cuadrado) va a sangre; todo lo demás se recorta a la caja
 * de lo que no es transparente y se centra con margen, sin deformarse.
 */
export function encuadre({ w, h, opaco, caja }) {
  const c = caja && caja.w > 0 && caja.h > 0 ? caja : { x: 0, y: 0, w, h }
  const ratio = c.w / c.h
  if (opaco && ratio > 0.92 && ratio < 1.08) {
    return { sx: c.x, sy: c.y, sw: c.w, sh: c.h, dx: 0, dy: 0, dw: LADO_LOGO, dh: LADO_LOGO }
  }
  const util = LADO_LOGO * (1 - MARGEN_LOGO * 2)
  const k = Math.min(util / c.w, util / c.h)
  const dw = c.w * k
  const dh = c.h * k
  return { sx: c.x, sy: c.y, sw: c.w, sh: c.h, dx: (LADO_LOGO - dw) / 2, dy: (LADO_LOGO - dh) / 2, dw, dh }
}

/** Fondo con el que se aplana: un logo de tinta clara pensado para fondo oscuro no desaparece. */
export function fondoPara({ opaco, luzTinta }) {
  if (!opaco && luzTinta > 0.82) return '#15171c'
  return '#ffffff'
}

/** Recorre los píxeles RGBA: si hay transparencia, la caja de lo visible y qué tan clara es la tinta. */
export function analizarPixeles(px, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1, transparentes = 0, luz = 0, n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = px[i + 3]
      if (a < 250) transparentes++
      if (a > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        luz += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
        n++
      }
    }
  }
  const opaco = transparentes / (w * h) < 0.01
  const caja = maxX < 0 ? { x: 0, y: 0, w, h } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  return { opaco, caja: opaco ? { x: 0, y: 0, w, h } : caja, luzTinta: n ? luz / n : 0 }
}

export const firmaVigente = (e, now = Date.now()) => !!(e && e.url && e.vence - now > 3 * 864e5)

/* ---------- elegir de dónde sacar el logo (script de relleno) ---------- */

const absoluta = (href, base) => { try { return new URL(href, base).href } catch { return null } }
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null
}
const ladoDe = (sizes) => String(sizes || '').split(/\s+/).reduce((m, s) => {
  const k = s.match(/^(\d+)x(\d+)$/i)
  return k ? Math.max(m, Math.min(+k[1], +k[2])) : m
}, 0)

export function iconosDelHtml(html, base) {
  const head = String(html || '')
  const iconos = []
  let manifest = null
  let og = null
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const rel = (attr(tag, 'rel') || '').toLowerCase().split(/\s+/)
    const href = attr(tag, 'href')
    if (!href) continue
    const url = absoluta(href, base)
    if (!url) continue
    if (rel.includes('manifest')) { manifest = manifest || url; continue }
    const tipo = (attr(tag, 'type') || '').toLowerCase()
    if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) {
      iconos.push({ url, origen: 'apple', lado: ladoDe(attr(tag, 'sizes')) || 180 })
    } else if (rel.includes('icon')) {
      const svg = tipo.includes('svg') || /\.svg(\?|$)/i.test(url)
      iconos.push({ url, origen: svg ? 'svg' : 'icon', lado: svg ? 0 : ladoDe(attr(tag, 'sizes')) })
    }
  }
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const p = (attr(tag, 'property') || attr(tag, 'name') || '').toLowerCase()
    if (p === 'og:image' && !og) og = absoluta(attr(tag, 'content') || '', base)
  }
  return { iconos, manifest, og }
}

export function iconosDelManifest(json, base) {
  return (json && Array.isArray(json.icons) ? json.icons : [])
    .map((i) => ({ url: absoluta(i.src, base), origen: 'manifest', lado: ladoDe(i.sizes) }))
    .filter((i) => i.url)
}

const POR_DEFECTO = /\/(vite|next|vercel|react|nuxt|svelte|turborepo|window|globe|file)\.svg(\?|$)/i
export function esIconoPorDefecto(url, { flutter = false } = {}) {
  const u = String(url || '')
  if (POR_DEFECTO.test(u)) return true
  if (flutter && /\/icons\/Icon-(maskable-)?(192|512)\.png(\?|$)/i.test(u)) return true
  return false
}

const PESO = { tienda: 100, apple: 80, manifest: 60, repo: 55, svg: 50, icon: 40 }
const LADO_MIN = 96

/** Ordena de mejor a peor y saca lo que no sirve (chico, de plantilla, og:image). */
export function elegirIcono(candidatos, opciones = {}) {
  return (candidatos || [])
    .filter((c) => c && c.url && PESO[c.origen] != null)
    .filter((c) => !esIconoPorDefecto(c.url, opciones))
    .filter((c) => c.origen === 'svg' || (c.lado || 0) >= LADO_MIN)
    .sort((a, b) => PESO[b.origen] - PESO[a.origen] || (b.lado || 0) - (a.lado || 0))
}
