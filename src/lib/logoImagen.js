import { LADO_LOGO, LOGO_BUCKET, FIRMA_DIAS, analizarPixeles, encuadre, fondoPara, rutaLogo, firmaVigente, esDataUrl } from './logos.js'

export const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
export const PESO_MAX = 5 * 1024 * 1024

/* ---------- URLs firmadas: una sola llamada por tanda, cacheadas por navegador ---------- */

const CLAVE = 'ip.logos.firmas.v1'
const firmas = new Map()
const oyentes = new Map()
const enCola = new Set()
let tanda = null

try {
  const raw = JSON.parse(localStorage.getItem(CLAVE) || '{}')
  for (const [k, v] of Object.entries(raw)) if (firmaVigente(v)) firmas.set(k, v)
} catch { /* sin localStorage: se firma de nuevo */ }

const guardar = () => {
  try { localStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(firmas))) } catch { /* cuota */ }
}
const avisar = (ruta) => (oyentes.get(ruta) || new Set()).forEach((fn) => fn())

export function urlFirmada(ruta) {
  if (!ruta) return null
  if (esDataUrl(ruta)) return ruta
  const e = firmas.get(ruta)
  return e && e.vence > Date.now() ? e.url : null
}

export function escucharFirma(ruta, fn) {
  if (!oyentes.has(ruta)) oyentes.set(ruta, new Set())
  oyentes.get(ruta).add(fn)
  return () => oyentes.get(ruta)?.delete(fn)
}

export function primarFirma(ruta, url, vence = Date.now() + FIRMA_DIAS * 864e5) {
  firmas.set(ruta, { url, vence }); guardar(); avisar(ruta)
}

/** Las rutas que se piden en el mismo tick salen en un único createSignedUrls. */
export function pedirFirma(supabase, ruta) {
  const e = firmas.get(ruta)
  if (!supabase || !ruta || esDataUrl(ruta) || firmaVigente(e) || e?.falla) return
  enCola.add(ruta)
  if (tanda) return
  tanda = setTimeout(async () => {
    const rutas = [...enCola]; enCola.clear(); tanda = null
    try {
      const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrls(rutas, FIRMA_DIAS * 86400)
      if (error || !data) throw error || new Error('sin datos')
      const vence = Date.now() + FIRMA_DIAS * 864e5
      for (const d of data) {
        if (d.signedUrl) firmas.set(d.path, { url: d.signedUrl, vence })
        else firmas.set(d.path, { url: null, vence: 0, falla: true })
      }
      guardar()
      rutas.forEach(avisar)
    } catch {
      rutas.forEach((r) => { firmas.set(r, { url: null, vence: 0, falla: true }); avisar(r) })
    }
  }, 0)
}

export const firmaFallida = (ruta) => !!firmas.get(ruta)?.falla

/* ---------- del archivo elegido al webp cuadrado que se guarda ---------- */

const cargarImagen = (src) => new Promise((ok, mal) => {
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => ok(img)
  img.onerror = () => mal(new Error('No pudimos leer esa imagen.'))
  img.src = src
})

const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * El SVG se dibuja como <img>: así el navegador no corre scripts ni carga nada externo, y
 * lo que se guarda es un raster. Nunca se sube el archivo original.
 */
export async function procesarLogo(file) {
  if (!file) throw new Error('No elegiste ningún archivo.')
  if (!TIPOS_LOGO.includes(file.type)) throw new Error('Tiene que ser PNG, JPG, SVG o WebP.')
  if (file.size > PESO_MAX) throw new Error('La imagen pesa más de 5 MB.')
  const src = URL.createObjectURL(file)
  try {
    const img = await cargarImagen(src)
    let w = img.naturalWidth || 0
    let h = img.naturalHeight || 0
    if (!w || !h) { w = 512; h = 512 }
    const k = Math.min(1, 1024 / Math.max(w, h))
    const W = Math.max(1, Math.round(w * k))
    const H = Math.max(1, Math.round(h * k))
    const base = lienzo(W, H)
    const bx = base.getContext('2d', { willReadFrequently: true })
    bx.drawImage(img, 0, 0, W, H)
    const an = analizarPixeles(bx.getImageData(0, 0, W, H).data, W, H)
    const r = encuadre({ w: W, h: H, opaco: an.opaco, caja: an.caja })
    const out = lienzo(LADO_LOGO, LADO_LOGO)
    const ox = out.getContext('2d')
    ox.fillStyle = fondoPara(an)
    ox.fillRect(0, 0, LADO_LOGO, LADO_LOGO)
    ox.imageSmoothingQuality = 'high'
    ox.drawImage(base, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh)
    const blob = await new Promise((ok) => out.toBlob(ok, 'image/webp', 0.9))
    if (!blob || blob.type !== 'image/webp') throw new Error('Este navegador no pudo preparar la imagen.')
    const hash = hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
    return { blob, hash, dataUrl: out.toDataURL('image/webp', 0.9) }
  } finally {
    URL.revokeObjectURL(src)
  }
}

/** Sube el webp (ruta por contenido: repetir no duplica) y deja su URL firmada en cache. */
export async function subirLogo(supabase, projectId, { blob, hash, dataUrl }) {
  if (!supabase) return dataUrl
  const ruta = rutaLogo(projectId, hash)
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(ruta, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (error && !/exist|duplicate/i.test(error.message || '') && error.statusCode !== '409') throw new Error('No se pudo subir el logo. Probá de nuevo.')
  const { data } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(ruta, FIRMA_DIAS * 86400)
  if (data?.signedUrl) primarFirma(ruta, data.signedUrl)
  return ruta
}
