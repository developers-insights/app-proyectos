/*
 * Geometría de la oficina isométrica de la pestaña INSIGHTS. Puro: sin React.
 *
 * Mundo en baldosas (x hacia la derecha-abajo, y hacia la izquierda-abajo, z hacia
 * arriba) proyectado a píxeles con la isometría clásica 2:1. El que mira está del
 * lado +x+y, así que las paredes visibles de una sala son las de y = oy y x = ox.
 */

import { JOURNEY_LANES } from '../lib/journey.js'

export const U = 30
export const ROOM = 7
export const GAP = 2
export const WALL = 2.4

const C = Math.cos(Math.PI / 6)

export const iso = (x, y, z = 0) => ({ X: (x - y) * U * C, Y: (x + y) * U * 0.5 - z * U })
export const pts = (...ps) => ps.map((p) => `${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(' ')

/*
 * Fila de arriba: el camino principal. Fila de abajo: las ramas, cada una debajo
 * del tramo del que sale (Fase 2 sale del MVP; anual y partners, de la prueba y
 * del plan). Stand-by queda en la punta, aparte del flujo.
 */
export const ROOMS = [
  { lane: 'onboarding', gx: 0, gy: 0 },
  { lane: 'mvp', gx: 1, gy: 0 },
  { lane: 'prueba', gx: 2, gy: 0 },
  { lane: 'plan', gx: 3, gy: 0 },
  { lane: 'standby', gx: 0, gy: 1 },
  { lane: 'fase2', gx: 1, gy: 1 },
  { lane: 'anual', gx: 2, gy: 1 },
  { lane: 'partner', gx: 3, gy: 1 },
].map((r) => ({ ...r, ox: r.gx * (ROOM + GAP), oy: r.gy * (ROOM + GAP), meta: JOURNEY_LANES.find((l) => l.key === r.lane) }))

export const roomOf = (lane) => ROOMS.find((r) => r.lane === lane) || null

export const LINKS = [
  ['onboarding', 'mvp'], ['mvp', 'prueba'], ['prueba', 'plan'],
  ['mvp', 'fase2'], ['prueba', 'anual'], ['plan', 'partner'], ['fase2', 'standby'],
]

/* Camino que recorrió un proyecto hasta su tramo, para la ficha. */
export const LANE_PATH = {
  onboarding: ['onboarding'],
  mvp: ['onboarding', 'mvp'],
  prueba: ['onboarding', 'mvp', 'prueba'],
  plan: ['onboarding', 'mvp', 'prueba', 'plan'],
  fase2: ['onboarding', 'mvp', 'fase2'],
  anual: ['onboarding', 'mvp', 'prueba', 'anual'],
  partner: ['onboarding', 'mvp', 'prueba', 'partner'],
  standby: ['onboarding', 'mvp', 'standby'],
}

/* Pasillo entre dos salas: un tramo de piso de 1,4 baldosas de ancho. */
export function corridor(a, b) {
  const A = roomOf(a)
  const B = roomOf(b)
  const w = 0.7
  if (A.gy === B.gy) {
    const [L, R] = A.gx < B.gx ? [A, B] : [B, A]
    const y = L.oy + ROOM / 2
    const x0 = L.ox + ROOM
    const x1 = R.ox
    return {
      floor: pts(iso(x0, y - w), iso(x1, y - w), iso(x1, y + w), iso(x0, y + w)),
      from: A.gx < B.gx ? iso(x0, y) : iso(x1, y),
      to: A.gx < B.gx ? iso(x1, y) : iso(x0, y),
    }
  }
  const x = A.ox + ROOM / 2
  const y0 = A.oy + ROOM
  const y1 = B.oy
  return { floor: pts(iso(x - w, y0), iso(x + w, y0), iso(x + w, y1), iso(x - w, y1)), from: iso(x, y0), to: iso(x, y1) }
}

/* Caja isométrica: tapa y las dos caras que se ven. */
export function isoBox(x, y, z, w, d, h) {
  return {
    top: pts(iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)),
    right: pts(iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)),
    front: pts(iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)),
  }
}

/*
 * Lugares donde se paran los proyectos dentro de una sala: 4 × 3, adelante de los
 * escritorios. Con más de 12 se muestran 11 y el lugar 12 es el "+N".
 */
export const SLOTS_PER_ROOM = 12
export function slotPos(room, i) {
  const c = i % 4
  const r = Math.floor(i / 4)
  const x = room.ox + 1.25 + c * 1.5
  const y = room.oy + 2.75 + r * 1.45
  return { ...iso(x, y), depth: x + y }
}

export function sceneBounds() {
  const pad = { x: 24, top: 46, bottom: 26 }
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
  for (const r of ROOMS) {
    for (const p of [iso(r.ox, r.oy, WALL), iso(r.ox + ROOM, r.oy, WALL), iso(r.ox, r.oy + ROOM, WALL), iso(r.ox + ROOM, r.oy + ROOM)]) {
      minX = Math.min(minX, p.X); maxX = Math.max(maxX, p.X); minY = Math.min(minY, p.Y); maxY = Math.max(maxY, p.Y)
    }
  }
  return { dx: -minX + pad.x, dy: -minY + pad.top, w: maxX - minX + pad.x * 2, h: maxY - minY + pad.top + pad.bottom }
}

/* Sala bajo un punto del piso (z = 0) en píxeles de la escena: la isometría al revés. */
export function roomAt(X, Y, pad = 0.35) {
  const a = X / (U * C)
  const b = (2 * Y) / U
  const x = (a + b) / 2
  const y = (b - a) / 2
  return ROOMS.find((r) => x >= r.ox - pad && x <= r.ox + ROOM + pad && y >= r.oy - pad && y <= r.oy + ROOM + pad) || null
}
