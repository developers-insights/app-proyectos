import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  journeyBoard, upsellBadges, fase2Offered, capLane, LANE_CAP, standbyNote, setStandbyNote, STANDBY_NOTE_MAX,
} from '../src/lib/journey.js'

const NOW = new Date(2026, 9, 26, 15, 0)
const daysAgo = (n) => new Date(2026, 9, 26 - n, 10, 0).toISOString()
const ctx = { planTotal: () => 10, pct: () => 95 }
const up = (...entries) => ({ entries: entries.map((e, i) => ({ id: `e${i}`, at: daysAgo(i + 1), ...e })) })

test('la marca de la card: ofrecida, aceptada o nada', () => {
  assert.deepEqual(upsellBadges({}, 'mvp'), [])
  const f2 = upsellBadges({ upsell: up({ offer: 'fase2', status: 'ofrecido' }) }, 'mvp')
  assert.deepEqual(f2.map((b) => b.label), ['F2 ofrecida'])
  assert.deepEqual(upsellBadges({ upsell: up({ offer: 'plan', status: 'paga' }) }, 'prueba').map((b) => b.label), ['Plan aceptado'])
  assert.deepEqual(upsellBadges({ upsell: up({ offer: 'fase2', status: 'no_quiere' }) }, 'mvp'), [])
  assert.deepEqual(upsellBadges({ upsell: up({ offer: 'fase2', status: 'ofrecido' }) }, 'fase2'), [])
  const both = upsellBadges({ upsell: up({ offer: 'plan', status: 'ofrecido' }, { offer: 'fase2', status: 'acepta' }) }, 'prueba')
  assert.deepEqual(both.map((b) => b.label), ['F2 aceptada', 'Plan ofrecido'])
})

test('la marca usa el último estado de cada oferta', () => {
  const p = { upsell: { entries: [
    { id: 'a', offer: 'fase2', status: 'ofrecido', at: daysAgo(10) },
    { id: 'b', offer: 'fase2', status: 'no_quiere', at: daysAgo(2) },
  ] } }
  assert.deepEqual(upsellBadges(p, 'mvp'), [])
})

test('quiénes tienen la Fase 2 ofrecida fuera del tramo Fase 2', () => {
  const projects = [
    { id: 'cl', name: 'Comunidad Latina', stage: 'desarrollo', lifecycle: { startedAt: daysAgo(60) }, upsell: up({ offer: 'fase2', status: 'ofrecido' }) },
    { id: 'pr', name: 'Prueba', stage: 'free', lifecycle: { phase: 2, phase2At: daysAgo(10) }, upsell: { entries: [{ id: 'x', offer: 'fase2', status: 'ofrecido', at: daysAgo(5) }] } },
    { id: 'ya', name: 'Ya en F2', stage: 'fase2', upsell: up({ offer: 'fase2', status: 'ofrecido' }) },
    { id: 'no', name: 'No quiere', stage: 'desarrollo', upsell: up({ offer: 'fase2', status: 'no_quiere' }) },
    { id: 'pl', name: 'Sólo plan', stage: 'desarrollo', upsell: up({ offer: 'plan', status: 'ofrecido' }) },
    { id: 'in', name: 'Interno', kind: 'interno', stage: 'desarrollo', upsell: up({ offer: 'fase2', status: 'ofrecido' }) },
    { id: 'ca', name: 'Cancelado', stage: 'cancelado', upsell: up({ offer: 'fase2', status: 'ofrecido' }) },
  ]
  const list = fase2Offered(journeyBoard(projects, ctx, NOW))
  assert.deepEqual(list.map((x) => x.project.id), ['cl', 'pr'])
  assert.deepEqual(list.map((x) => x.lane), ['mvp', 'prueba'])
  assert.deepEqual(fase2Offered(journeyBoard([], ctx, NOW)), [])
  assert.deepEqual(fase2Offered(null), [])
})

test('tope por columna', () => {
  const items = (n) => Array.from({ length: n }, (_, i) => i)
  assert.equal(LANE_CAP, 5)
  assert.deepEqual(capLane(items(3), false), { visible: [0, 1, 2], hidden: 0, collapsible: false })
  assert.equal(capLane(items(6), false).hidden, 0)
  const nine = capLane(items(9), false)
  assert.deepEqual(nine.visible, [0, 1, 2, 3, 4])
  assert.equal(nine.hidden, 4)
  assert.deepEqual(capLane(items(9), true), { visible: items(9), hidden: 0, collapsible: true })
  assert.deepEqual(capLane(null, false), { visible: [], hidden: 0, collapsible: false })
})

test('motivo del stand-by: limpio y con tope', () => {
  assert.equal(standbyNote({}), '')
  assert.equal(standbyNote({ standbyNote: 42 }), '')
  assert.equal(standbyNote({ standbyNote: '  espera   fondos \n del socio ' }), 'espera fondos del socio')
  assert.deepEqual(setStandbyNote({}, '  sin respuesta  '), { standbyNote: 'sin respuesta' })
  assert.equal(setStandbyNote({}, 'x'.repeat(500)).standbyNote.length, STANDBY_NOTE_MAX)
  assert.deepEqual(setStandbyNote({}, null), { standbyNote: '' })
})
