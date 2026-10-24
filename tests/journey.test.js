import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  journeyLane, journeyEntry, journeyBoard, offerCandidates, normalizeThresholds,
  normalizeUpsell, upsellState, addUpsellEntry, removeUpsellEntry, setUpsellObjections, upsellLine,
} from '../src/lib/journey.js'
import { applyStage, projectStage, stageIsRegression } from '../src/lib/stages.js'
import { normalizeLifecycle, phaseInfo, billingNotice } from '../src/lib/lifecycle.js'

const NOW = new Date(2026, 9, 24, 15, 0)
const daysAgo = (n) => new Date(2026, 9, 24 - n, 10, 0).toISOString()
const ctx = (total = 10, pct = 50) => ({ planTotal: () => total, pct: () => pct })

test('el tramo sale de la etapa y del plan', () => {
  assert.equal(journeyLane({ stage: 'desarrollo' }, ctx(0)), 'onboarding')
  assert.equal(journeyLane({ stage: 'desarrollo', progress: 40 }, ctx(0)), 'mvp')
  assert.equal(journeyLane({ stage: 'desarrollo' }, ctx(12)), 'mvp')
  assert.equal(journeyLane({ stage: 'desarrollo' }, {}), 'mvp')
  assert.equal(journeyLane({ stage: 'free' }), 'prueba')
  assert.equal(journeyLane({ stage: 'kaizen' }), 'plan')
  assert.equal(journeyLane({ stage: 'fase2' }), 'fase2')
  assert.equal(journeyLane({ stage: 'pausado' }), 'standby')
  assert.equal(journeyLane({ stage: 'finalizado' }), 'standby')
  assert.equal(journeyLane({ stage: 'cancelado' }), null)
  assert.equal(journeyLane({ lifecycle: { phase: 3 } }), 'plan')
})

test('días en desarrollo y alertas de 90 y 120', () => {
  const p = (n) => ({ id: 'a', stage: 'desarrollo', lifecycle: { phase: 1, startedAt: daysAgo(n) } })
  assert.equal(journeyEntry(p(40), ctx(), NOW).days, 40)
  assert.deepEqual(journeyEntry(p(40), ctx(), NOW).alerts, [])
  assert.equal(journeyEntry(p(100), ctx(), NOW).alerts[0].level, 'warn')
  const late = journeyEntry(p(386), ctx(), NOW)
  assert.equal(late.alerts[0].level, 'crit')
  assert.match(late.alerts[0].text, /386 días en desarrollo/)
})

test('plan al 100% todavía en desarrollo avisa', () => {
  const e = journeyEntry({ id: 'x', stage: 'desarrollo', lifecycle: { startedAt: daysAgo(115) } }, ctx(20, 100), NOW)
  assert.deepEqual(e.alerts.map((a) => a.key).sort(), ['dev', 'done'])
})

test('prueba vencida es crítica y cuenta hacia atrás', () => {
  const e = journeyEntry({ id: 'p', stage: 'free', lifecycle: { phase: 2, startedAt: daysAgo(200), phase2At: daysAgo(34) } }, ctx(), NOW)
  assert.equal(e.remaining, -4)
  assert.equal(e.alerts[0].key, 'trial')
})

test('tiendas en trámite: aviso pasado el umbral, rojo al doble', () => {
  const base = { id: 's', stage: 'desarrollo', lifecycle: { startedAt: daysAgo(10) } }
  const at = (n) => ({ ...base, stores: { play: { status: 'tramite', startedAt: daysAgo(n) } } })
  assert.equal(journeyEntry(at(10), ctx(), NOW).alerts.length, 0)
  assert.equal(journeyEntry(at(18), ctx(), NOW).alerts[0].level, 'warn')
  assert.equal(journeyEntry(at(31), ctx(), NOW).alerts[0].level, 'crit')
  assert.equal(journeyEntry(at(18), ctx(), NOW, { storesMaxDays: 20 }).alerts.length, 0)
})

test('stand-by sin fecha no inventa días', () => {
  const e = journeyEntry({ id: 'z', stage: 'pausado' }, ctx(), NOW)
  assert.equal(e.days, null)
  assert.equal(e.alerts.length, 0)
  assert.equal(journeyEntry({ id: 'z', stage: 'pausado', stageAt: daysAgo(45) }, ctx(), NOW).alerts[0].key, 'standby')
})

test('umbrales basura vuelven al default', () => {
  const t = normalizeThresholds({ devMaxDays: 'abc', mvpWarnDays: -3, storesMaxDays: 20 })
  assert.equal(t.devMaxDays, 120)
  assert.equal(t.mvpWarnDays, 90)
  assert.equal(t.storesMaxDays, 20)
})

test('Fase 2: rama real, cuenta desde su arranque y no rompe el cobro', () => {
  const paying = { id: 'g', stage: 'starter', lifecycle: { phase: 3, startedAt: daysAgo(300), phase2At: daysAgo(120), phase3At: daysAgo(90), billingDay: 5 } }
  assert.equal(stageIsRegression(paying, 'fase2'), true)
  const moved = { ...paying, ...applyStage(paying, 'fase2', new Date(daysAgo(10))) }
  assert.equal(projectStage(moved), 'fase2')
  const lc = normalizeLifecycle(moved)
  assert.equal(lc.phase, 1)
  assert.equal(lc.startedAt, paying.lifecycle.startedAt)
  assert.equal(lc.phase3At, null)
  assert.equal(billingNotice(moved, NOW).shouldNotify, false)
  assert.equal(phaseInfo(moved, NOW).days, 10)
  assert.equal(journeyEntry(moved, ctx(), NOW).days, 10)

  const again = { ...moved, ...applyStage(moved, 'fase2', NOW) }
  assert.equal(normalizeLifecycle(again).devAt, lc.devAt)
  assert.equal(again.stageAt, moved.stageAt)

  const toPlan = { ...moved, ...applyStage(moved, 'kaizen', NOW) }
  assert.equal(normalizeLifecycle(toPlan).phase, 3)
  assert.ok(normalizeLifecycle(toPlan).phase3At)
})

test('volver a Desarrollo desde Fase 2 cuenta desde el onboarding original', () => {
  const f2 = { id: 'g', stage: 'fase2', lifecycle: { phase: 1, startedAt: daysAgo(300), devAt: daysAgo(10) } }
  const back = { ...f2, ...applyStage(f2, 'desarrollo', NOW) }
  assert.equal(normalizeLifecycle(back).devAt, null)
  assert.equal(phaseInfo(back, NOW).days, 300)
})

test('los terminales sellan stageAt y no tocan el lifecycle', () => {
  const p = { id: 'q', stage: 'free', lifecycle: { phase: 2, phase2At: daysAgo(5) } }
  const out = applyStage(p, 'pausado', NOW)
  assert.equal(out.lifecycle, undefined)
  assert.equal(out.stageAt, NOW.toISOString())
})

test('datos viejos sin devAt ni stageAt siguen funcionando', () => {
  assert.equal(normalizeLifecycle({ lifecycle: { phase: 1, startedAt: daysAgo(5), devAt: 'basura' } }).devAt, null)
  assert.equal(phaseInfo({ lifecycle: { phase: 1, startedAt: daysAgo(5) } }, NOW).days, 5)
})

test('upsell tolera datos mal formados', () => {
  assert.deepEqual(normalizeUpsell({}), { entries: [], objections: '' })
  assert.deepEqual(normalizeUpsell({ upsell: [] }), { entries: [], objections: '' })
  const u = normalizeUpsell({ upsell: { objections: 42, entries: [null, { offer: 'otra' }, { offer: 'plan', status: 'raro', at: 'nope' }] } })
  assert.equal(u.entries.length, 1)
  assert.equal(u.entries[0].status, 'ofrecido')
  assert.equal(u.entries[0].at, null)
  assert.equal(u.objections, '')
})

test('upsell: el último registro de cada oferta es su estado', () => {
  let p = { id: 'd' }
  p = { ...p, ...addUpsellEntry(p, { offer: 'plan', status: 'ofrecido', at: daysAgo(10), by: 'u7' }, NOW) }
  p = { ...p, ...addUpsellEntry(p, { offer: 'plan', status: 'no_quiere', at: daysAgo(3), by: 'u7', note: 'Cree que la app está bien así' }, NOW) }
  p = { ...p, ...setUpsellObjections(p, 'Precio') }
  const s = upsellState(p)
  assert.equal(s.plan.status, 'no_quiere')
  assert.equal(s.fase2, null)
  assert.equal(s.objections, 'Precio')
  assert.equal(upsellLine(s.plan, NOW), 'Plan mensual: no quiere · hace 3 d')
  const removed = { ...p, ...removeUpsellEntry(p, s.plan.id) }
  assert.equal(upsellState(removed).plan.status, 'ofrecido')
  const paga = addUpsellEntry({}, { offer: 'plan', status: 'paga', payDay: daysAgo(-5) }, NOW)
  assert.ok(paga.upsell.entries[0].payDay)
  assert.equal(addUpsellEntry({}, { offer: 'plan', status: 'ofrecido', payDay: daysAgo(-5) }, NOW).upsell.entries[0].payDay, null)
})

test('para ofrecer: prueba por vencer, MVP al final y finalizados', () => {
  const projects = [
    { id: 'trial', name: 'Trial', stage: 'free', lifecycle: { phase: 2, phase2At: daysAgo(25) } },
    { id: 'early', name: 'Early', stage: 'free', lifecycle: { phase: 2, phase2At: daysAgo(5) } },
    { id: 'gone', name: 'Gone', stage: 'free', lifecycle: { phase: 2, phase2At: daysAgo(40) } },
    { id: 'mvp', name: 'Mvp', stage: 'desarrollo', lifecycle: { startedAt: daysAgo(30) } },
    { id: 'fin', name: 'Fin', stage: 'finalizado' },
    { id: 'int', name: 'Int', kind: 'interno', stage: 'finalizado' },
    { id: 'paid', name: 'Paid', stage: 'finalizado', upsell: { entries: [{ id: '1', offer: 'plan', status: 'paga', at: daysAgo(1) }] } },
    { id: 'no', name: 'No', stage: 'finalizado', upsell: { entries: [{ id: '2', offer: 'plan', status: 'no_quiere', at: daysAgo(1) }] } },
  ]
  const c = { planTotal: () => 10, pct: (p) => (p.id === 'mvp' ? 90 : 20) }
  const list = offerCandidates(projects, c, NOW)
  assert.deepEqual(list.map((x) => x.projectId), ['gone', 'trial', 'mvp', 'fin', 'no'])
  assert.equal(list.at(-1).declined, true)
  assert.match(list[1].reason, /quedan 5 días/)
})

test('el tablero agrupa, ordena por días y deja afuera internos y cancelados', () => {
  const b = journeyBoard([
    { id: 'a', name: 'A', stage: 'desarrollo', lifecycle: { startedAt: daysAgo(10) } },
    { id: 'b', name: 'B', stage: 'desarrollo', lifecycle: { startedAt: daysAgo(215) } },
    { id: 'c', name: 'C', stage: 'cancelado' },
    { id: 'd', name: 'D', kind: 'interno', stage: 'desarrollo' },
    null,
  ], ctx(), NOW)
  assert.deepEqual(b.lanes.mvp.map((x) => x.project.id), ['b', 'a'])
  assert.equal(b.out.length, 1)
  assert.equal(b.total, 2)
  assert.equal(b.alerts[0].projectId, 'b')
})
