import test from 'node:test'
import assert from 'node:assert/strict'
import { esAdminClarity, setClarity, clarityOn, claritySinEfecto, instanciaDe, INSTANCIA_MANUEL } from '../src/lib/clarity.js'

test('sólo el mail de Manuel (sin importar mayúsculas ni espacios)', () => {
  assert.equal(esAdminClarity('manuelnavarro@insightsapps.tech'), true)
  assert.equal(esAdminClarity('  ManuelNavarro@InsightsApps.tech '), true)
  assert.equal(esAdminClarity('nacho@insightsapps.tech'), false)
  assert.equal(esAdminClarity(''), false)
  assert.equal(esAdminClarity(undefined), false)
})

test('setClarity devuelve bool y sello ISO', () => {
  const r = setClarity(1, new Date('2026-11-02T10:00:00Z'))
  assert.deepEqual(r, { clarity: true, clarityAt: '2026-11-02T10:00:00.000Z' })
  assert.equal(setClarity(false).clarity, false)
})

test('clarityOn exige true booleano', () => {
  assert.equal(clarityOn({ clarity: true }), true)
  assert.equal(clarityOn({ clarity: 'true' }), false)
  assert.equal(clarityOn({}), false)
})

test('etapas donde prender no entra', () => {
  for (const s of ['pausado', 'Finalizado', 'cancelado']) assert.equal(claritySinEfecto({ stage: s }), true)
  assert.equal(claritySinEfecto({ stage: 'desarrollo' }), false)
})

test('instanciaDe cae al bot salvo closer-manuel', () => {
  assert.equal(instanciaDe('closer-manuel'), INSTANCIA_MANUEL)
  assert.equal(instanciaDe(null), null)
  assert.equal(instanciaDe('otra'), null)
})
