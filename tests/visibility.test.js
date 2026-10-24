import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isExternalMember } from '../src/lib/visibility.js'

test('colaboradores y clientes del portal no gestionan el equipo; el equipo sí', () => {
  assert.equal(isExternalMember({ access: 'collab' }), true)
  assert.equal(isExternalMember({ access: 'project' }), true)
  assert.equal(isExternalMember({ access: 'full' }), false)
  assert.equal(isExternalMember(null), false)
})
