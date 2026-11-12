import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setSoloLectura, bloqueado, esEscritura, fetchConCandado, onAvisoSoloLectura, marcarGesto } from '../src/lib/soloLectura.js'

test('esEscritura: tablas y storage sí, lecturas, rpc y funciones no', () => {
  assert.equal(esEscritura('https://x.supabase.co/rest/v1/projects?id=eq.1', 'PATCH'), true)
  assert.equal(esEscritura('https://x.supabase.co/rest/v1/projects', 'POST'), true)
  assert.equal(esEscritura('https://x.supabase.co/storage/v1/object/b/a.png', 'POST'), true)
  assert.equal(esEscritura('https://x.supabase.co/rest/v1/projects', 'GET'), false)
  assert.equal(esEscritura('https://x.supabase.co/rest/v1/rpc/portal_projects', 'POST'), false)
  assert.equal(esEscritura('https://x.supabase.co/functions/v1/boveda', 'POST'), false)
  assert.equal(esEscritura('https://x.supabase.co/auth/v1/token', 'POST'), false)
})

test('con lectura activa se frena y avisa sólo si hubo gesto', async () => {
  let avisos = 0
  const off = onAvisoSoloLectura(() => { avisos++ })
  setSoloLectura(false)
  assert.equal(bloqueado(), false)
  setSoloLectura(true)
  marcarGesto(0)
  assert.equal(bloqueado(), true)
  assert.equal(avisos, 0)
  marcarGesto()
  assert.equal(bloqueado(), true)
  assert.equal(avisos, 1)

  let pasó = 0
  const f = fetchConCandado(async () => { pasó++; return new Response('[]') })
  const r = await f('https://x.supabase.co/rest/v1/tasks', { method: 'POST' })
  assert.equal(r.status, 403)
  assert.equal(pasó, 0)
  await f('https://x.supabase.co/rest/v1/tasks', { method: 'GET' })
  assert.equal(pasó, 1)
  setSoloLectura(false)
  off()
})
