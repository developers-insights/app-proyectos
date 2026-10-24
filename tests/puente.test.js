import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCloserNotes, openCloserNotes, addCloserNote, resolveCloserNote, reopenCloserNote } from '../src/lib/closerNotes.js'
import { buildBridgeSnapshots } from '../src/lib/bridge.js'

const NOW = new Date(2026, 9, 24, 15, 0)
const daysAgo = (n) => new Date(2026, 9, 24 - n, 10, 0).toISOString()

test('una nota para el closer nace abierta y resuelta deja de estar abierta', () => {
  let p = { id: 'p1' }
  p = { ...p, ...addCloserNote(p, { text: '  Quiere pagar la cuota 3 en dos partes  ', by: 'u7' }, NOW) }
  assert.equal(p.closerNotes.length, 1)
  assert.equal(p.closerNotes[0].text, 'Quiere pagar la cuota 3 en dos partes')
  assert.equal(openCloserNotes(p).length, 1)
  const id = p.closerNotes[0].id
  p = { ...p, ...resolveCloserNote(p, id, 'u7', NOW) }
  assert.equal(openCloserNotes(p).length, 0)
  assert.equal(normalizeCloserNotes(p)[0].resolvedBy, 'u7')
  p = { ...p, ...reopenCloserNote(p, id) }
  assert.equal(openCloserNotes(p).length, 1)
})

test('lo mal formado no viaja y una nota vacía no se agrega', () => {
  const p = { closerNotes: [null, { text: '' }, { text: 'ok', at: 'basura' }, 'x'] }
  const ns = normalizeCloserNotes(p)
  assert.equal(ns.length, 1)
  assert.equal(ns[0].id, 'legacy-0')
  assert.equal(ns[0].at, null)
  assert.equal(addCloserNote({}, { text: '   ' }, NOW).closerNotes.length, 0)
  assert.equal(normalizeCloserNotes({ closerNotes: 'no' }).length, 0)
})

const rows = () => ({
  projects: [
    { id: 'p1', data: { name: 'iRowing', clientId: 'c1', planId: 'pl1', stage: 'free', lifecycle: { phase: 2, startedAt: daysAgo(80), phase2At: daysAgo(25), trialDays: 30 }, closerNotes: [{ id: 'n1', text: 'Avisar que el plan arranca el 1/11', at: daysAgo(1), by: 'u7' }, { id: 'n2', text: 'vieja', at: daysAgo(9), resolvedAt: daysAgo(2) }] } },
    { id: 'p2', data: { name: 'Interno', kind: 'interno' } },
    { id: 'p3', data: { name: 'Borrado' }, deleted_at: daysAgo(1) },
  ],
  clients: [{ id: 'c1', data: { name: 'Leonardo', company: 'iRowing', email: 'Leo@IRowing.app', phone: '+54 11 5555 0106', onboarding: { approvedBudget: 9000, notes: 'interno' } } }],
  plans: [{ id: 'pl1', data: { weeks: [{ n: 1, title: 'Base', tasks: [{ text: 'a', done: true }] }, { n: 2, title: 'Pagos', deliver: { text: 'Checkout andando' }, tasks: [{ text: 'b', done: false, fecha: '2026-10-30' }] }] } }],
  team: [{ id: 'u7', data: { name: 'Nacho' } }],
})

test('la foto trae lo que el closer necesita y nada interno', () => {
  const out = buildBridgeSnapshots(rows(), NOW)
  assert.deepEqual(out.map((s) => s.id), ['p1'])
  const s = out[0]
  assert.equal(s.client.email, 'leo@irowing.app')
  assert.equal(s.lane, 'prueba')
  assert.equal(s.stageLabel, 'Free Maint.')
  assert.equal(s.pct, 100)
  assert.equal(s.milestone.week, 2)
  assert.equal(s.milestone.deliver, 'Checkout andando')
  assert.equal(s.milestone.date, '2026-10-30')
  assert.equal(s.offer.kind, 'prueba')
  assert.deepEqual(s.offer.offers, ['plan', 'fase2'])
  assert.deepEqual(s.notes, [{ id: 'n1', text: 'Avisar que el plan arranca el 1/11', at: s.notes[0].at, by: 'Nacho' }])
  assert.equal(s.url, 'https://proyectos.insightsapps.tech/?proyecto=p1')
  const json = JSON.stringify(s)
  assert.ok(!json.includes('approvedBudget'))
  assert.ok(!json.includes('vieja'))
})

test('un proyecto sin plan ni cliente no rompe la foto', () => {
  const out = buildBridgeSnapshots({ projects: [{ id: 'x', data: { name: 'Solo' } }] }, NOW)
  assert.equal(out.length, 1)
  assert.equal(out[0].milestone, null)
  assert.equal(out[0].client.email, '')
  assert.deepEqual(out[0].notes, [])
})
