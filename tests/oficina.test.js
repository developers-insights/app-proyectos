import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROOMS, ROOM, MIN_GAP, LINKS, iso, unIso, layoutRooms, freeSpot, route, roomAt, sceneBounds, fitView, clampView, zoomAt, slotPos } from '../src/insights/iso.js'
import { JOURNEY_LANES, journeyLane, journeyEntry, laneDropStage, upsellBadges, upsellState } from '../src/lib/journey.js'
import { applyStage, stageIsRegression, projectStage } from '../src/lib/stages.js'

const clash = (a, b) => Math.abs(a.ox - b.ox) < ROOM + MIN_GAP && Math.abs(a.oy - b.oy) < ROOM + MIN_GAP

test('hay una sala por tramo y ninguna pisa a otra', () => {
  assert.deepEqual(ROOMS.map((r) => r.lane).sort(), JOURNEY_LANES.map((l) => l.key).sort())
  for (const a of ROOMS) for (const b of ROOMS) if (a !== b) assert.equal(clash(a, b), false, `${a.lane} pisa ${b.lane}`)
})

test('unIso deshace iso', () => {
  const p = iso(12.5, -3)
  const w = unIso(p.X, p.Y)
  assert.ok(Math.abs(w.x - 12.5) < 1e-9 && Math.abs(w.y + 3) < 1e-9)
})

test('una sala guardada se respeta y un valor roto vuelve a su lugar', () => {
  const out = layoutRooms({ mvp: { ox: 40.4, oy: -9 }, plan: { ox: 'a', oy: 2 }, viejo: { ox: 1, oy: 1 }, fase2: { ox: 1e9, oy: 0 } })
  const by = Object.fromEntries(out.map((r) => [r.lane, r]))
  assert.equal(out.length, ROOMS.length)
  assert.deepEqual([by.mvp.ox, by.mvp.oy], [40, -9])
  assert.deepEqual([by.plan.ox, by.plan.oy], [ROOMS.find((r) => r.lane === 'plan').ox, ROOMS.find((r) => r.lane === 'plan').oy])
  assert.deepEqual([by.fase2.ox, by.fase2.oy], [ROOMS.find((r) => r.lane === 'fase2').ox, ROOMS.find((r) => r.lane === 'fase2').oy])
  assert.deepEqual(layoutRooms(null).map((r) => [r.ox, r.oy]), ROOMS.map((r) => [r.ox, r.oy]))
  assert.deepEqual(layoutRooms([]).map((r) => [r.ox, r.oy]), ROOMS.map((r) => [r.ox, r.oy]))
})

test('una sala que no se movió cede el lugar a la que se guardó encima', () => {
  const nuevo = ROOMS.find((r) => r.lane === 'nuevo')
  const out = layoutRooms({ mvp: { ox: nuevo.ox + 2, oy: nuevo.oy } })
  for (const a of out) for (const b of out) if (a !== b) assert.equal(clash(a, b), false, `${a.lane} pisa ${b.lane}`)
})

test('freeSpot devuelve el lugar pedido si está libre y el más cercano si no', () => {
  assert.deepEqual(freeSpot(ROOMS, 'mvp', 60, 60), { ox: 60, oy: 60 })
  const onb = ROOMS.find((r) => r.lane === 'onboarding')
  const s = freeSpot(ROOMS, 'mvp', onb.ox + 1, onb.oy + 1)
  assert.equal(ROOMS.filter((r) => r.lane !== 'mvp').some((r) => clash(r, s)), false)
  assert.ok(Math.hypot(s.ox - onb.ox, s.oy - onb.oy) < ROOM * 2)
})

test('el pasillo es recto si las salas se enfrentan y dobla una vez si no', () => {
  const a = { ox: 0, oy: 0 }
  assert.deepEqual(route(a, { ox: 9, oy: 0 }), [{ x: 7, y: 3.5 }, { x: 9, y: 3.5 }])
  assert.deepEqual(route({ ox: 9, oy: 0 }, a), [{ x: 9, y: 3.5 }, { x: 7, y: 3.5 }])
  assert.deepEqual(route(a, { ox: 0, oy: 9 }), [{ x: 3.5, y: 7 }, { x: 3.5, y: 9 }])
  assert.equal(route(a, { ox: 3, oy: 12 }).length, 2)
  const l = route(a, { ox: 20, oy: 20 })
  assert.equal(l.length, 3)
  assert.ok(l[0].y === l[1].y && l[1].x === l[2].x)
  for (const [x, y] of LINKS) assert.ok(ROOMS.some((r) => r.lane === x) && ROOMS.some((r) => r.lane === y))
})

test('roomAt encuentra la sala en su lugar nuevo', () => {
  const rooms = layoutRooms({ mvp: { ox: 50, oy: 50 } })
  const r = rooms.find((x) => x.lane === 'mvp')
  const p = slotPos(r, 0)
  assert.equal(roomAt(p.X, p.Y, rooms).lane, 'mvp')
  const q = iso(10, 3)
  assert.equal(roomAt(q.X, q.Y, rooms), null)
})

test('fitView mete toda la escena y clampView no la deja perderse', () => {
  const b = sceneBounds()
  const v = fitView(b, 1200, 600, { pad: 20, max: 1.18 })
  assert.ok(b.minX * v.k + v.x >= 19.9 && b.maxX * v.k + v.x <= 1180.1)
  assert.ok(b.minY * v.k + v.y >= 19.9 && b.maxY * v.k + v.y <= 580.1)
  const far = clampView({ k: 1, x: 99999, y: -99999 }, b, 1200, 600, 90)
  assert.equal(far.x, 1200 - 90 - b.minX)
  assert.equal(far.y, 90 - b.maxY)
})

test('zoomAt deja quieto el punto bajo el cursor', () => {
  const v = { k: 1, x: 100, y: 50 }
  const n = zoomAt(v, 1.6, 300, 200)
  assert.ok(Math.abs((300 - v.x) / v.k - (300 - n.x) / n.k) < 1e-9)
  assert.ok(Math.abs((200 - v.y) / v.k - (200 - n.y) / n.k) < 1e-9)
})

const NOW = new Date(2026, 10, 3, 12)
const paying = { id: 'a', stage: 'plan', lifecycle: { phase: 3, startedAt: '2026-01-01T10:00:00.000Z', phase2At: '2026-03-01T10:00:00.000Z', phase3At: '2026-04-01T10:00:00.000Z' } }

test('Nuevo sistema es un desarrollo nuevo: cuenta sus días desde que arrancó', () => {
  assert.equal(journeyLane({ stage: 'nuevo' }), 'nuevo')
  assert.equal(laneDropStage(paying, 'nuevo'), 'nuevo')
  assert.equal(stageIsRegression(paying, 'nuevo'), true)
  const moved = { ...paying, ...applyStage(paying, 'nuevo', new Date(2026, 9, 24, 12)) }
  assert.equal(projectStage(moved), 'nuevo')
  assert.equal(journeyEntry(moved, null, NOW).days, 10)
  const again = { ...moved, ...applyStage(moved, 'nuevo', NOW) }
  assert.equal(again.lifecycle.devAt, moved.lifecycle.devAt)
  assert.equal(laneDropStage(moved, 'nuevo'), null)
})

test('Nuevo sistema pasado de días avisa con su nombre', () => {
  const late = { stage: 'nuevo', lifecycle: { phase: 1, startedAt: '2026-01-01T10:00:00.000Z', devAt: '2026-01-01T10:00:00.000Z' } }
  const a = journeyEntry(late, null, NOW).alerts.find((x) => x.key === 'dev')
  assert.equal(a.level, 'crit')
  assert.match(a.text, /en Nuevo sistema/)
})

test('un sistema ofrecido se marca en el proyecto hasta que entra al tramo', () => {
  const upsell = { entries: [{ id: 'x', offer: 'nuevo', status: 'ofrecido', at: '2026-10-30T10:00:00.000Z' }] }
  assert.equal(upsellState({ upsell }).nuevo.status, 'ofrecido')
  assert.deepEqual(upsellBadges({ upsell }, 'plan').map((b) => b.label), ['Sistema ofrecido'])
  assert.deepEqual(upsellBadges({ upsell }, 'nuevo'), [])
})
