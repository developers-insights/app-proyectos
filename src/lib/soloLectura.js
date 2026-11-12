/**
 * soloLectura.js — acceso 'read' (Mati, Axel): ven todo como el equipo pero no escriben.
 *
 * JS puro. La base ya lo garantiza (RLS: leen con pm_puede_ver(), escriben sólo con
 * is_team()); esto es la experiencia: frenar el cambio antes del optimista, para que
 * la pantalla no muestre algo que después no se guarda, y avisar con el cartel.
 *
 * Dos puertas, mismo flag:
 * - los stores (useRowCollection, usePlans, useTasks) preguntan `bloqueado()` antes de tocar el estado local;
 * - `fetchConCandado` envuelve el fetch del cliente de Supabase y corta toda escritura a
 *   /rest/v1 (tablas) y /storage/v1 que se escape por otro lado.
 *
 * El cartel sale sólo si hubo un click o una tecla hace instantes: la app hace escrituras
 * solas al cargar (normalizaciones, sellos) y esas se cortan en silencio.
 */

let activo = false
let ultimoGesto = 0
const oyentes = new Set()
const VENTANA_GESTO_MS = 1500

export function setSoloLectura(v) { activo = !!v }
export function esSoloLectura() { return activo }

export function marcarGesto(t = Date.now()) { ultimoGesto = t }
export function huboGesto(t = Date.now()) { return t - ultimoGesto <= VENTANA_GESTO_MS }

export function onAvisoSoloLectura(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function avisarSoloLectura({ forzar = false } = {}) {
  if (!forzar && !huboGesto()) return
  oyentes.forEach((fn) => { try { fn() } catch { /* un oyente roto no frena al resto */ } })
}

/** true si hay que frenar la escritura (y avisa si la pidió la persona). */
export function bloqueado() {
  if (!activo) return false
  avisarSoloLectura()
  return true
}

export const ERROR_SOLO_LECTURA = Object.freeze({ code: 'solo_lectura', message: 'Tenés acceso de lectura: no podés hacer cambios.' })

const ESCRIBE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** ¿Este request escribe datos? Las RPC y las edge functions quedan afuera: las validan la base y cada función. */
export function esEscritura(url, method) {
  const m = String(method || 'GET').toUpperCase()
  if (!ESCRIBE.has(m)) return false
  const u = String(url || '')
  if (u.includes('/rest/v1/rpc/')) return false
  return u.includes('/rest/v1/') || u.includes('/storage/v1/object')
}

export function fetchConCandado(base = (...a) => fetch(...a)) {
  return (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url
    const method = init.method || (typeof input === 'object' && input?.method) || 'GET'
    if (activo && esEscritura(url, method)) {
      avisarSoloLectura()
      return Promise.resolve(new Response(JSON.stringify({ ...ERROR_SOLO_LECTURA, details: null, hint: null }), {
        status: 403, headers: { 'content-type': 'application/json' },
      }))
    }
    return base(input, init)
  }
}

if (typeof window !== 'undefined') {
  const marca = () => marcarGesto()
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'drop', 'change']) window.addEventListener(ev, marca, true)
}
