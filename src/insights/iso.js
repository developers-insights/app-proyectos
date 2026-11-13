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
export const MIN_GAP = 1
export const WALL = 2.4

const C = Math.cos(Math.PI / 6)

/* Ancho en pantalla de un pasillo de 1,4 baldosas: es el trazo del polyline que lo dibuja. */
export const CORRIDOR = 1.4 * U * C

export const iso = (x, y, z = 0) => ({ X: (x - y) * U * C, Y: (x + y) * U * 0.5 - z * U })
export const pts = (...ps) => ps.map((p) => `${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(' ')

/* La isometría al revés, sobre el piso (z = 0). */
export function unIso(X, Y) {
  const a = X / (U * C)
  const b = (2 * Y) / U
  return { x: (a + b) / 2, y: (b - a) / 2 }
}

/*
 * Fila de arriba: el camino principal. Fila de abajo: las ramas, cada una debajo
 * del tramo del que sale (Fase 2 sale del MVP; anual y partners, de la prueba y
 * del plan). Stand-by queda en la punta, aparte del flujo. Nuevo sistema, debajo de
 * Fase 2: las dos son otra venta sobre un cliente que ya está.
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
  { lane: 'nuevo', gx: 1, gy: 2 },
].map((r) => ({ ...r, ox: r.gx * (ROOM + GAP), oy: r.gy * (ROOM + GAP), meta: JOURNEY_LANES.find((l) => l.key === r.lane) }))

export const LINKS = [
  ['onboarding', 'mvp'], ['mvp', 'prueba'], ['prueba', 'plan'],
  ['mvp', 'fase2'], ['prueba', 'anual'], ['plan', 'partner'], ['anual', 'partner'], ['fase2', 'standby'], ['fase2', 'nuevo'],
]

/* Camino que recorrió un proyecto hasta su tramo, para la ficha. */
export const LANE_PATH = {
  onboarding: ['onboarding'],
  mvp: ['onboarding', 'mvp'],
  prueba: ['onboarding', 'mvp', 'prueba'],
  plan: ['onboarding', 'mvp', 'prueba', 'plan'],
  fase2: ['onboarding', 'mvp', 'fase2'],
  nuevo: ['onboarding', 'mvp', 'nuevo'],
  anual: ['onboarding', 'mvp', 'prueba', 'anual'],
  partner: ['onboarding', 'mvp', 'prueba', 'partner'],
  standby: ['onboarding', 'mvp', 'standby'],
}

const LIMIT = 400

/*
 * El lugar libre más cercano a (ox, oy), en baldosas enteras. Deja MIN_GAP entre salas
 * para que siempre se vea el pasillo y para que `roomAt` nunca tenga dos candidatas.
 */
export function freeSpot(rooms, lane, ox, oy) {
  const others = rooms.filter((r) => r.lane !== lane)
  const reach = ROOM + MIN_GAP
  const free = (x, y) => !others.some((o) => Math.abs(x - o.ox) < reach && Math.abs(y - o.oy) < reach)
  const x0 = Math.round(ox)
  const y0 = Math.round(oy)
  for (let d = 0; d <= LIMIT; d++) {
    let best = null
    for (let i = -d; i <= d; i++) {
      for (const [x, y] of [[x0 + i, y0 - d], [x0 + i, y0 + d], [x0 - d, y0 + i], [x0 + d, y0 + i]]) {
        if (!free(x, y)) continue
        const h = Math.hypot(x - x0, y - y0)
        if (!best || h < best.h) best = { ox: x, oy: y, h }
      }
    }
    if (best) return { ox: best.ox, oy: best.oy }
  }
  return { ox: x0, oy: y0 }
}

/* Salas guardadas sobre el orden automático: un valor roto o una sala nueva cae a su lugar. */
export function layoutRooms(saved) {
  const s = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  const ok = (v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= LIMIT
  const placed = new Map()
  for (const r of ROOMS) {
    const v = s[r.lane]
    if (v && ok(v.ox) && ok(v.oy)) placed.set(r.lane, { ...r, ox: Math.round(Number(v.ox)), oy: Math.round(Number(v.oy)) })
  }
  for (const r of ROOMS) {
    if (!placed.has(r.lane)) placed.set(r.lane, { ...r, ...freeSpot([...placed.values()], r.lane, r.ox, r.oy) })
  }
  return ROOMS.map((r) => placed.get(r.lane))
}

/*
 * Eje de un pasillo entre dos salas, de borde a borde. Si se enfrentan es recto; si
 * no, sale por el costado y dobla una vez para entrar por el centro de la otra.
 */
export function route(A, B) {
  const band = (a, b) => {
    const lo = Math.max(a, b) + 1
    const hi = Math.min(a, b) + ROOM - 1
    return lo <= hi ? (lo + hi) / 2 : null
  }
  const by = band(A.oy, B.oy)
  if (by != null) {
    const f = A.ox < B.ox
    return [{ x: f ? A.ox + ROOM : A.ox, y: by }, { x: f ? B.ox : B.ox + ROOM, y: by }]
  }
  const bx = band(A.ox, B.ox)
  if (bx != null) {
    const f = A.oy < B.oy
    return [{ x: bx, y: f ? A.oy + ROOM : A.oy }, { x: bx, y: f ? B.oy : B.oy + ROOM }]
  }
  const m = ROOM / 2
  return [
    { x: B.ox > A.ox ? A.ox + ROOM : A.ox, y: A.oy + m },
    { x: B.ox + m, y: A.oy + m },
    { x: B.ox + m, y: B.oy > A.oy ? B.oy : B.oy + ROOM },
  ]
}

/*
 * `floor` se mete 0,7 baldosas debajo de cada sala: el corte del trazo es recto y no
 * sigue el ángulo del piso, así que la punta tiene que quedar tapada.
 */
export function corridor(A, B) {
  const r = route(A, B)
  const out = (p, q) => {
    const l = Math.hypot(p.x - q.x, p.y - q.y) || 1
    return { x: p.x + ((p.x - q.x) / l) * 0.7, y: p.y + ((p.y - q.y) / l) * 0.7 }
  }
  const n = r.length
  const line = [out(r[0], r[1]), ...r.slice(1, -1), out(r[n - 1], r[n - 2])]
  return { floor: pts(...line.map((p) => iso(p.x, p.y))), flow: pts(...r.map((p) => iso(p.x, p.y))) }
}

/* Piso de una sala, para marcar dónde va a caer al soltarla. */
export const footprint = (ox, oy) => pts(iso(ox, oy), iso(ox + ROOM, oy), iso(ox + ROOM, oy + ROOM), iso(ox, oy + ROOM))

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

export function sceneBounds(rooms = ROOMS) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
  for (const r of rooms) {
    for (const p of [iso(r.ox, r.oy, WALL), iso(r.ox + ROOM, r.oy, WALL), iso(r.ox, r.oy + ROOM, WALL), iso(r.ox + ROOM, r.oy + ROOM)]) {
      minX = Math.min(minX, p.X); maxX = Math.max(maxX, p.X); minY = Math.min(minY, p.Y); maxY = Math.max(maxY, p.Y)
    }
  }
  return { minX, maxX, minY, maxY }
}

/* Sala bajo un punto del piso (z = 0) en píxeles de la escena. */
export function roomAt(X, Y, rooms = ROOMS, pad = 0.35) {
  const { x, y } = unIso(X, Y)
  return rooms.find((r) => x >= r.ox - pad && x <= r.ox + ROOM + pad && y >= r.oy - pad && y <= r.oy + ROOM + pad) || null
}

/* ─── Cámara: { k, x, y }, un punto de la escena cae en pantalla en x + k·X ── */

export function fitView(b, w, h, { pad = 24, max = 1.18, min = 0.3 } = {}) {
  const k = Math.max(min, Math.min(max, (w - pad * 2) / (b.maxX - b.minX), (h - pad * 2) / (b.maxY - b.minY)))
  return { k, x: (w - (b.minX + b.maxX) * k) / 2, y: (h - (b.minY + b.maxY) * k) / 2 }
}

/* Siempre queda a la vista un borde de la escena: nadie se pierde en el vacío. */
export function clampView(v, b, w, h, keep = 90) {
  const lim = (p, lo, hi) => Math.max(lo, Math.min(hi, p))
  return { k: v.k, x: lim(v.x, keep - b.maxX * v.k, w - keep - b.minX * v.k), y: lim(v.y, keep - b.maxY * v.k, h - keep - b.minY * v.k) }
}

export const zoomAt = (v, k, px, py) => ({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k })
