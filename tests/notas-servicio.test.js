import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  serviceNotesOf, addServiceNote, updateServiceNote, setServiceNotePinned, deleteServiceNote, restoreServiceNote,
  normalizeServiceNote, noteMatches, notesIndex, typeCounts, noteSnippet, noteWhen,
} from '../src/lib/serviceNotes.js'
import { buildBridgeSnapshots } from '../src/lib/bridge.js'

const NOW = new Date(2026, 9, 26, 15, 0)
const at = (d, h = 10) => new Date(2026, 9, d, h, 0)

test('una nota nueva queda primera, con autor y fecha, y lo vacío no entra', () => {
  let p = { id: 'p1' }
  p = { ...p, ...addServiceNote(p, { type: 'call', text: '  Quiere sumar pagos  ', by: 'u3' }, at(20)) }
  p = { ...p, ...addServiceNote(p, { type: 'onboarding', answers: { porQueAhora: 'Se le cayó un cliente grande', basura: 'x' }, by: 'u3' }, at(24)) }
  const ns = serviceNotesOf(p)
  assert.equal(ns.length, 2)
  assert.equal(ns[0].type, 'onboarding')
  assert.deepEqual(ns[0].answers, { porQueAhora: 'Se le cayó un cliente grande' })
  assert.equal(ns[1].text, 'Quiere sumar pagos')
  assert.equal(ns[1].by, 'u3')
  assert.equal(addServiceNote(p, { text: '   ', answers: { freno: ' ' } }, NOW).serviceNotes.length, 2)
})

test('el id que manda el que escribe se respeta, para no duplicar en un reintento', () => {
  let p = {}
  p = { ...p, ...addServiceNote(p, { id: 'sn-a', text: 'uno' }, NOW) }
  p = { ...p, ...addServiceNote(p, { id: 'sn-a', text: 'uno bis' }, NOW) }
  assert.equal(serviceNotesOf(p).length, 1)
  assert.equal(serviceNotesOf(p)[0].text, 'uno bis')
})

test('editar conserva la fecha de creación y marca quién editó', () => {
  let p = { ...addServiceNote({}, { id: 'n1', text: 'antes', by: 'u1' }, at(20)) }
  p = { ...p, ...updateServiceNote(p, 'n1', { text: 'después', type: 'idea' }, 'u2', at(22)) }
  const [n] = serviceNotesOf(p)
  assert.equal(n.text, 'después')
  assert.equal(n.type, 'idea')
  assert.equal(n.at, at(20).toISOString())
  assert.equal(n.updatedAt, at(22).toISOString())
  assert.equal(n.editedBy, 'u2')
  const vacia = updateServiceNote(p, 'n1', { text: '' }, 'u2', NOW)
  assert.equal(serviceNotesOf(vacia)[0].text, 'después')
})

test('lo fijado va arriba aunque sea más viejo', () => {
  let p = {}
  p = { ...p, ...addServiceNote(p, { id: 'vieja', text: 'vieja' }, at(10)) }
  p = { ...p, ...addServiceNote(p, { id: 'nueva', text: 'nueva' }, at(20)) }
  p = { ...p, ...setServiceNotePinned(p, 'vieja', true, NOW) }
  assert.deepEqual(serviceNotesOf(p).map((n) => n.id), ['vieja', 'nueva'])
})

test('borrar es suave, deshacer la devuelve y a los 30 días se suelta', () => {
  let p = { ...addServiceNote({}, { id: 'n1', text: 'hola' }, at(1)) }
  p = { ...p, ...deleteServiceNote(p, 'n1', at(2)) }
  assert.equal(serviceNotesOf(p).length, 0)
  assert.equal(p.serviceNotes.length, 1)
  const back = { ...p, ...restoreServiceNote(p, 'n1', at(2)) }
  assert.equal(serviceNotesOf(back).length, 1)
  const later = addServiceNote(p, { text: 'otra' }, new Date(2026, 11, 1))
  assert.equal(later.serviceNotes.length, 1)
  assert.equal(later.serviceNotes[0].text, 'otra')
})

test('datos mal formados no rompen y el tipo desconocido es General', () => {
  const ns = serviceNotesOf({ serviceNotes: [null, 'x', { text: '' }, { text: 'ok', type: 'raro', at: 'basura', pinned: 'si' }] })
  assert.equal(ns.length, 1)
  assert.equal(ns[0].id, 'legacy-3')
  assert.equal(ns[0].type, 'general')
  assert.equal(ns[0].pinned, false)
  assert.equal(ns[0].at, null)
  assert.equal(serviceNotesOf({ serviceNotes: 'no' }).length, 0)
  assert.equal(normalizeServiceNote({ answers: ['a'] }), null)
})

test('la búsqueda ignora tildes y mayúsculas y mira las respuestas guiadas', () => {
  const n = normalizeServiceNote({ id: 'a', type: 'onboarding', text: 'Llamada larga', answers: { consume: 'Sigue a Midudev en YouTube' } })
  assert.ok(noteMatches(n, 'youtube midu'))
  assert.ok(noteMatches(n, 'LLAMADA'))
  assert.ok(noteMatches(n, 'qué contenido'))
  assert.ok(!noteMatches(n, 'instagram'))
  assert.equal(noteSnippet(normalizeServiceNote({ answers: { futuro: 'Fase 2 en enero' } })), 'Fase 2 en enero')
})

test('el índice ordena por la última nota y filtra por nombre, texto y tipo', () => {
  const clients = [{ id: 'c1', name: 'Leonardo', company: 'iRowing' }]
  const p1 = { id: 'p1', name: 'iRowing App', clientId: 'c1', ...addServiceNote({}, { type: 'call', text: 'Pidió exportar a Excel' }, at(10)) }
  const p2 = { id: 'p2', name: 'Kintsugi', ...addServiceNote({}, { type: 'motivo', text: 'Lo movió perder un contrato' }, at(20)) }
  const p3 = { id: 'p3', name: 'Sin notas' }
  const all = notesIndex([p1, p2, p3], clients)
  assert.deepEqual(all.map((r) => r.project.id), ['p2', 'p1', 'p3'])
  assert.deepEqual(notesIndex([p1, p2, p3], clients, { query: 'leonardo' }).map((r) => r.project.id), ['p1'])
  const byText = notesIndex([p1, p2, p3], clients, { query: 'excel' })
  assert.equal(byText.length, 1)
  assert.equal(byText[0].shown.length, 1)
  assert.deepEqual(notesIndex([p1, p2, p3], clients, { type: 'motivo' }).map((r) => r.project.id), ['p2'])
  assert.equal(typeCounts([p1, p2, p3]).all, 2)
  assert.equal(typeCounts([p1, p2, p3]).call, 1)
})

test('la fecha se lee como persona', () => {
  assert.equal(noteWhen(new Date(2026, 9, 26, 9, 5).toISOString(), NOW), 'hoy 09:05')
  assert.equal(noteWhen(new Date(2026, 9, 25, 18, 0).toISOString(), NOW), 'ayer 18:00')
  assert.equal(noteWhen(new Date(2026, 9, 3).toISOString(), NOW), '3 oct')
  assert.equal(noteWhen(new Date(2025, 0, 3).toISOString(), NOW), '3 ene 2025')
})

test('las notas del servicio no viajan a Speed Funnels', () => {
  const p = { id: 'p1', name: 'X', clientId: 'c1', kind: 'cliente', ...addServiceNote({}, { text: 'SECRETO-DEL-ONBOARDING' }, NOW) }
  const snap = buildBridgeSnapshots({ projects: [p], clients: [{ id: 'c1', name: 'Ana' }] }, NOW)
  assert.ok(!JSON.stringify(snap).includes('SECRETO-DEL-ONBOARDING'))
})

test('el resumen de una coincidencia sale del campo donde está la palabra', async () => {
  const { matchSnippet } = await import('../src/lib/serviceNotes.js')
  const n = normalizeServiceNote({ text: 'Muy abierto en la call', answers: { consume: 'Mira a Midudev todos los días' } })
  assert.equal(matchSnippet(n, 'midudev'), 'Mira a Midudev todos los días')
  assert.equal(matchSnippet(n, ''), 'Muy abierto en la call')
  const largo = normalizeServiceNote({ text: `${'relleno '.repeat(40)}la palabra clave está acá ${'cola '.repeat(30)}` })
  const s = matchSnippet(largo, 'clave', 60)
  assert.ok(s.startsWith('…') && s.includes('clave') && s.length <= 62)
})
