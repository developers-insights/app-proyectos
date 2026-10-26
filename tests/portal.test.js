import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portalView, portalProject } from '../src/lib/portal.js'

const fila = {
  id: 'p1',
  name: 'Cámara de Comercio',
  stage: 'desarrollo',
  lifecycle: { phase: 1, phase2At: null, phase3At: null },
  progress: 40,
  company: 'Davis',
  plan: {
    weeks: [
      { n: 2, title: 'Pagos', tasks: [{ text: 'Stripe', done: true }, { text: 'Recibos', done: false }] },
      { n: 1, title: 'Base', tasks: ['Tarea vieja en texto', { text: 'Login', done: 1 }] },
    ],
  },
}

test('arma la vista con las semanas ordenadas, el texto de cada tarea y el avance del plan', () => {
  const v = portalView(fila)
  assert.equal(v.name, 'Cámara de Comercio')
  assert.equal(v.company, 'Davis')
  assert.equal(v.stage, 'desarrollo')
  assert.deepEqual(v.weeks.map((w) => w.n), [1, 2])
  assert.deepEqual(v.weeks[0].tasks, [{ text: 'Tarea vieja en texto', done: false }, { text: 'Login', done: true }])
  assert.equal(v.weeks[0].done, 1)
  assert.equal(v.pct, 50)
})

test('sin plan cae al % legacy y la etapa sale de la fase del ciclo de vida', () => {
  const v = portalView({ id: 'p2', name: 'X', lifecycle: { phase: null, phase3At: '2026-09-01T00:00:00Z' }, progress: 60, plan: null })
  assert.equal(v.stage, 'plan')
  assert.equal(v.pct, 100)
  const w = portalView({ id: 'p3', name: 'Y', progress: 60, plan: null })
  assert.equal(w.stage, 'desarrollo')
  assert.equal(w.pct, 60)
  assert.deepEqual(w.weeks, [])
})

test('no deja pasar campos que no son de la vista aunque la fila los traiga', () => {
  const v = portalView({ ...fila, closerNotes: [{ text: 'interna' }], sharePassword: 'x', totalAmount: 5000, plan: { weeks: [{ n: 1, tasks: [{ text: 'a', done: false, riesgo: 'alto', responsable: 'cliente' }] }] } })
  const txt = JSON.stringify(v)
  for (const k of ['closerNotes', 'sharePassword', 'totalAmount', 'riesgo', 'responsable', 'interna']) assert.equal(txt.includes(k), false, k)
})

test('tolera basura y elige el proyecto asignado', () => {
  assert.equal(portalView(null), null)
  assert.equal(portalView({ name: 'sin id' }), null)
  assert.deepEqual(portalView({ id: 'p', plan: { weeks: 'x' } }).weeks, [])
  assert.equal(portalProject([fila, { id: 'p9', name: 'Otro' }], 'p9').name, 'Otro')
  assert.equal(portalProject([fila], 'no-esta').id, 'p1')
  assert.equal(portalProject(null, 'p1'), null)
})
