import test from 'node:test'
import assert from 'node:assert/strict'
import { ROOMS, ROOM, iso, roomAt, slotPos } from './iso.js'

test('roomAt devuelve la sala del centro de cada piso', () => {
  for (const r of ROOMS) {
    const c = iso(r.ox + ROOM / 2, r.oy + ROOM / 2)
    assert.equal(roomAt(c.X, c.Y)?.lane, r.lane)
  }
})

test('roomAt reconoce todos los lugares de los proyectos', () => {
  for (const r of ROOMS) for (let i = 0; i < 12; i++) {
    const p = slotPos(r, i)
    assert.equal(roomAt(p.X, p.Y)?.lane, r.lane)
  }
})

test('roomAt da null fuera de las salas', () => {
  assert.equal(roomAt(-2000, -2000), null)
})
