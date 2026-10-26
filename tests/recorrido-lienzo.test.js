import { test } from 'node:test'
import assert from 'node:assert/strict'
import { journeyBoard, canvasLayout, mergePositions, laneNodeHeight, orderForSearch, CANVAS, JOURNEY_LANES } from '../src/lib/journey.js'

const NOW = new Date(2026, 9, 26, 15, 0)
const daysAgo = (n) => new Date(2026, 9, 26 - n, 10, 0).toISOString()
const ctx = { planTotal: () => 10, pct: () => 40 }

const many = (n, stage, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `${stage}-${i}`, name: `${stage} ${i}`, stage, lifecycle: { startedAt: daysAgo(10 + i) }, stageAt: daysAgo(3), ...extra }))

const rect = (pos, k, board) => ({ x: pos[k].x, y: pos[k].y, w: CANVAS.nodeW, h: laneNodeHeight(board.lanes[k], k) })
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

test('el orden automático no encima tramos, aunque haya muchos proyectos', () => {
  const projects = [...many(40, 'desarrollo'), ...many(8, 'pausado', { standbyNote: 'espera presupuesto' }), ...many(7, 'fase2')]
  const board = journeyBoard(projects, ctx, NOW)
  const pos = canvasLayout(board)
  const keys = JOURNEY_LANES.map((l) => l.key)
  assert.deepEqual(Object.keys(pos).sort(), [...keys].sort())
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      assert.equal(overlap(rect(pos, keys[i], board), rect(pos, keys[j], board)), false, `${keys[i]} pisa ${keys[j]}`)
    }
  }
  assert.ok(pos.onboarding.x < pos.mvp.x && pos.mvp.x < pos.prueba.x && pos.prueba.x < pos.plan.x)
  assert.ok(pos.fase2.y < pos.plan.y && pos.fase2.x === pos.plan.x)
  assert.ok(pos.standby.x === pos.prueba.x && pos.standby.y > pos.prueba.y)
})

test('un tramo largo no crece sin tope', () => {
  const board = journeyBoard(many(40, 'desarrollo'), ctx, NOW)
  assert.ok(laneNodeHeight(board.lanes.mvp, 'mvp') < CANVAS.head + 7 * CANVAS.row + CANVAS.more + CANVAS.pad * 2)
  assert.ok(laneNodeHeight([], 'plan') > CANVAS.head)
})

test('posiciones guardadas: valen las sanas, el resto vuelve al automático', () => {
  const auto = { mvp: { x: 0, y: 0 }, plan: { x: 400, y: 10 }, fase2: { x: 400, y: -200 } }
  const out = mergePositions(auto, { mvp: { x: 120.4, y: -33 }, plan: { x: 'a', y: 2 }, viejo: { x: 1, y: 1 }, fase2: { x: 1e9, y: 0 } })
  assert.deepEqual(out, { mvp: { x: 120, y: -33 }, plan: { x: 400, y: 10 }, fase2: { x: 400, y: -200 } })
  assert.deepEqual(mergePositions(auto, null), auto)
  assert.deepEqual(mergePositions(auto, []), auto)
})

test('al buscar, lo que coincide queda primero en su tramo', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ project: { id } }))
  assert.deepEqual(orderForSearch(items, new Set(['c', 'a'])).map((x) => x.project.id), ['a', 'c', 'b', 'd'])
  assert.equal(orderForSearch(items, null), items)
})
