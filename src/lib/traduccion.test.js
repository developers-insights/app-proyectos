import { test } from 'node:test'
import assert from 'node:assert/strict'
import { huellaPortafolio } from './portafolio.js'
import { pendientesDeTraducir, limpiarTraduccion } from './traduccion.js'

const foto = (id, pf) => ({ id, name: id, portafolio: { mostrable: true, ...pf } })

test('traduce sólo lo que falta o cambió', () => {
  const a = foto('a', { queEs: 'Una app' })
  const b = foto('b', { queEs: 'Otra app' })
  const c = foto('c', { queEs: 'Cambió' })
  const vacia = foto('d', {})
  const oculta = { id: 'e', portafolio: { mostrable: false, queEs: 'x' } }
  const trad = [
    { project_id: 'b', data: { fuente: huellaPortafolio({ queEs: 'Otra app', negocio: null, resumen: null }) } },
    { project_id: 'c', data: { fuente: 'vieja' } },
  ]
  assert.deepEqual(pendientesDeTraducir([a, b, c, vacia, oculta], trad).map((x) => x.f.id), ['a', 'c'])
  assert.deepEqual(pendientesDeTraducir([a, b], trad, true).map((x) => x.f.id), ['a', 'b'])
})

test('no inventa campos que no tienen español', () => {
  const es = { queEs: 'x', negocio: null, resumen: 'y' }
  assert.deepEqual(limpiarTraduccion(es, { queEs: ' An app ', negocio: 'invented', resumen: '' }), { queEs: 'An app', negocio: null, resumen: null })
})
