import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conWeb, vaALaWeb } from './portafolio.js'

test('apagar la web deja web=false y conserva lo que escriben los scripts', () => {
  const pf = { queEs: 'x', en: { queEs: 'y' } }
  const out = conWeb(pf, false)
  assert.deepEqual(out, { queEs: 'x', en: { queEs: 'y' }, web: false })
  assert.equal(vaALaWeb('produccion', out), false)
  assert.equal(pf.web, undefined)
})

test('prender la web saca el flag y no deja un objeto vacío', () => {
  assert.equal(conWeb({ web: false }, true), undefined)
  assert.deepEqual(conWeb({ web: false, resumen: 'r' }, true), { resumen: 'r' })
  assert.equal(vaALaWeb('entregado', conWeb({ web: false }, true)), true)
  assert.equal(conWeb(undefined, true), undefined)
})
