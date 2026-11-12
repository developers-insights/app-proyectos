import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isExternalMember } from '../src/lib/visibility.js'

test('colaboradores y clientes del portal no gestionan el equipo; el equipo sí', () => {
  assert.equal(isExternalMember({ access: 'collab' }), true)
  assert.equal(isExternalMember({ access: 'project' }), true)
  assert.equal(isExternalMember({ access: 'full' }), false)
  assert.equal(isExternalMember(null), false)
})

test('lectura: ve todo, no es dev ni externo', async () => {
  const { isReader, visibleProjects } = await import('../src/lib/visibility.js')
  const me = { id: 'x', access: 'read', role: '' }
  assert.equal(isReader(me), true)
  assert.equal(isReader({ access: 'full' }), false)
  const ps = [{ id: 'a' }, { id: 'b' }]
  assert.equal(visibleProjects(ps, me), ps)
})
