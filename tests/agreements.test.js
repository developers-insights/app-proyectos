import { test } from 'node:test'
import assert from 'node:assert/strict'
import { journeyLane, journeyEntry, journeyBoard, laneDropStage } from '../src/lib/journey.js'
import { projectStage, applyStage, stageIsRegression, isDevelopmentDone } from '../src/lib/stages.js'
import { annualInfo, annualEnd, normalizePartner, setPartner, partnerLine, setAnnualStart } from '../src/lib/agreements.js'
import { buildContextMarkdown } from '../src/lib/contextExport.js'

const NOW = new Date(2026, 9, 30, 15, 0)
const at = (y, m, d) => new Date(y, m, d, 12, 0).toISOString()
const ctx = { pct: () => 100 }

test('las dos ramas nuevas son tramos propios', () => {
  assert.equal(journeyLane({ stage: 'anual' }), 'anual')
  assert.equal(journeyLane({ stage: 'partner' }), 'partner')
  assert.equal(projectStage({ stage: 'anual' }), 'anual')
})

test('soltar un proyecto en una rama le cambia la etapa, sin tocar el cobro', () => {
  const plan = { id: 'a', stage: 'plan', lifecycle: { phase: 3, phase3At: at(2026, 5, 1), startedAt: at(2026, 0, 1) } }
  assert.equal(laneDropStage(plan, 'anual', ctx), 'anual')
  assert.equal(laneDropStage(plan, 'partner', ctx), 'partner')
  assert.equal(laneDropStage({ stage: 'anual' }, 'anual', ctx), null)
  assert.equal(stageIsRegression(plan, 'anual'), false)
  const moved = applyStage(plan, 'partner', NOW)
  assert.equal(moved.stage, 'partner')
  assert.equal(moved.lifecycle, undefined)
  assert.equal(isDevelopmentDone('anual'), true)
})

test('el plan anual arranca al entrar y conserva una fecha cargada', () => {
  const p = { id: 'x', stage: 'free' }
  const a = applyStage(p, 'anual', NOW)
  assert.equal(a.annual.startAt, NOW.toISOString())
  const manual = { ...p, annual: { startAt: at(2026, 2, 1) } }
  assert.equal(applyStage(manual, 'anual', NOW).annual.startAt, at(2026, 2, 1))
  assert.equal(applyStage({ ...manual, stage: 'anual', stageAt: NOW.toISOString() }, 'anual', NOW).annual.startAt, at(2026, 2, 1))
})

test('días que le quedan del año', () => {
  const p = { stage: 'anual', annual: { startAt: at(2026, 0, 30) } }
  const info = annualInfo(p, NOW)
  assert.equal(info.endAt, annualEnd(p.annual.startAt))
  assert.equal(info.days, 273)
  assert.equal(info.remaining, 92)
  assert.equal(info.total, 365)
  assert.equal(annualInfo({ stage: 'anual', stageAt: at(2026, 9, 30) }, NOW).remaining, 365)
  assert.equal(annualInfo({ stage: 'anual' }, NOW).remaining, null)
})

test('avisa cuando se acerca el vencimiento y cuando venció', () => {
  const left = (n) => journeyEntry({ id: 'z', stage: 'anual', annual: { startAt: at(2025, 9, 30 + n) } }, ctx, NOW)
  assert.deepEqual(left(200).alerts, [])
  assert.equal(left(61).alerts.length, 0)
  assert.equal(left(60).alerts[0].level, 'warn')
  assert.equal(left(16).alerts[0].level, 'warn')
  assert.equal(left(15).alerts[0].level, 'crit')
  assert.equal(left(0).alerts[0].text, 'El plan anual vence hoy')
  const late = left(-29)
  assert.equal(late.remaining, -29)
  assert.equal(late.alerts[0].level, 'crit')
  assert.match(late.alerts[0].text, /venció hace 29 días/)
})

test('partners: porcentaje y nota se normalizan', () => {
  assert.deepEqual(normalizePartner({}), { pct: null, note: '' })
  assert.deepEqual(normalizePartner({ partner: { pct: '12,5', note: 'x' } }).pct, null)
  assert.equal(normalizePartner({ partner: { pct: 12.55, note: '  a   b ' } }).pct, 12.6)
  assert.equal(normalizePartner({ partner: { pct: 140 } }).pct, null)
  assert.equal(normalizePartner({ partner: { pct: 0 } }).pct, 0)
  const p = { partner: { pct: 10, note: 'viejo' } }
  assert.deepEqual(setPartner(p, { pct: 15 }).partner, { pct: 15, note: 'viejo' })
  assert.equal(partnerLine({}), 'Falta anotar el acuerdo')
  assert.equal(partnerLine({ partner: { pct: 12.5 } }), '12,5 % del proyecto')
})

test('la fecha de arranque del plan anual se edita y una inválida no pisa nada', () => {
  assert.equal(setAnnualStart({ annual: { startAt: at(2026, 1, 1) } }, at(2026, 3, 1)).annual.startAt, at(2026, 3, 1))
  assert.deepEqual(setAnnualStart({}, 'nada'), {})
})

test('el tablero y el export cuentan las ramas nuevas', () => {
  const projects = [
    { id: '1', name: 'Marex', stage: 'anual', annual: { startAt: at(2026, 0, 30) } },
    { id: '2', name: 'Facu', stage: 'partner', partner: { pct: 15, note: 'ciberseguridad' } },
    { id: '3', name: 'Interno', kind: 'interno', stage: 'anual' },
  ]
  const board = journeyBoard(projects, ctx, NOW)
  assert.equal(board.lanes.anual.length, 1)
  assert.equal(board.lanes.partner.length, 1)
  assert.equal(board.total, 2)
  const md = buildContextMarkdown({ projects, clients: [], team: [], now: NOW })
  assert.match(md, /Plan anual de marketing/)
  assert.match(md, /\| Marex \|.*\| 92 \|/)
  assert.match(md, /\| Facu \|.*\| 15% \| ciberseguridad \|/)
})
