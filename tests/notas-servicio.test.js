import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createServiceNote, editServiceNote, pinServiceNote, deleteServiceNote, restoreServiceNote, notesOfProject,
  normalizeServiceNote, noteFromRow, noteToRow, mergeIncoming, noteMatches, notesIndex, typeCounts,
  noteSnippet, matchSnippet, noteWhen,
} from '../src/lib/serviceNotes.js'
import { buildBridgeSnapshots } from '../src/lib/bridge.js'

const NOW = new Date(2026, 9, 26, 15, 0)
const at = (d, h = 10) => new Date(2026, 9, d, h, 0)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('una nota nueva nace con uuid, proyecto, autor y fecha; lo vacío no nace', () => {
  const n = createServiceNote({ type: 'onboarding', text: '  Muy abierto  ', answers: { porQueAhora: 'Perdió un contrato', basura: 'x' } }, { projectId: 'p1', by: 'u3', now: at(24) })
  assert.match(n.id, UUID)
  assert.equal(n.projectId, 'p1')
  assert.equal(n.text, 'Muy abierto')
  assert.deepEqual(n.answers, { porQueAhora: 'Perdió un contrato' })
  assert.equal(n.by, 'u3')
  assert.equal(n.at, at(24).toISOString())
  assert.equal(n.pinned, false)
  assert.equal(createServiceNote({ text: '   ', answers: { freno: ' ' } }, { projectId: 'p1' }), null)
  assert.equal(createServiceNote({ text: 'sin proyecto' }, {}), null)
})

test('editar conserva creación, proyecto y autor, y marca quién editó', () => {
  const n = createServiceNote({ text: 'antes' }, { projectId: 'p1', by: 'u1', now: at(20) })
  const e = editServiceNote(n, { text: 'después', type: 'idea', projectId: 'otro', by: 'intruso' }, 'u2', at(22))
  assert.equal(e.text, 'después')
  assert.equal(e.type, 'idea')
  assert.equal(e.projectId, 'p1')
  assert.equal(e.by, 'u1')
  assert.equal(e.at, at(20).toISOString())
  assert.equal(e.updatedAt, at(22).toISOString())
  assert.equal(e.editedBy, 'u2')
  assert.equal(editServiceNote(e, { text: '', answers: {} }, 'u2', NOW), e)
})

test('lo fijado va arriba y lo borrado no aparece hasta que se deshace', () => {
  const vieja = createServiceNote({ text: 'vieja' }, { projectId: 'p1', now: at(10) })
  const nueva = createServiceNote({ text: 'nueva' }, { projectId: 'p1', now: at(20) })
  const otra = createServiceNote({ text: 'de otro proyecto' }, { projectId: 'p2', now: at(21) })
  let list = [vieja, nueva, otra]
  assert.deepEqual(notesOfProject(list, 'p1').map((n) => n.text), ['nueva', 'vieja'])
  list = list.map((n) => (n.id === vieja.id ? pinServiceNote(n, true, NOW) : n))
  assert.deepEqual(notesOfProject(list, 'p1').map((n) => n.text), ['vieja', 'nueva'])
  list = list.map((n) => (n.id === nueva.id ? deleteServiceNote(n, NOW) : n))
  assert.deepEqual(notesOfProject(list, 'p1').map((n) => n.text), ['vieja'])
  list = list.map((n) => (n.id === nueva.id ? restoreServiceNote(n, NOW) : n))
  assert.equal(notesOfProject(list, 'p1').length, 2)
})

test('la fila de la base y la nota van y vuelven sin perder nada', () => {
  const n = pinServiceNote(createServiceNote({ type: 'consumo', text: 'Midudev', answers: { referentes: 'Platzi' } }, { projectId: 'p9', by: 'u3', now: at(5) }), true, at(6))
  const row = noteToRow(n)
  assert.deepEqual(Object.keys(row).sort(), ['answers', 'author_id', 'body', 'deleted_at', 'edited_by', 'id', 'noted_at', 'pinned', 'project_id', 'type', 'updated_at'])
  assert.deepEqual(noteFromRow(row), n)
  assert.equal(noteFromRow({ id: 'x', project_id: 'p', type: 'raro', body: 'ok', answers: null }).type, 'general')
  assert.equal(noteFromRow({ id: 'x', body: '' }), null)
  assert.equal(noteFromRow(null), null)
})

test('lo que llega de la base no pisa una edición local más nueva', () => {
  const local = editServiceNote(createServiceNote({ text: 'uno' }, { projectId: 'p1', now: at(1) }), { text: 'local' }, 'u1', at(3))
  const viejo = { ...local, text: 'servidor viejo', updatedAt: at(2).toISOString() }
  const nuevo = { ...local, text: 'servidor nuevo', updatedAt: at(4).toISOString() }
  assert.equal(mergeIncoming([local], viejo)[0].text, 'local')
  assert.equal(mergeIncoming([local], nuevo)[0].text, 'servidor nuevo')
  assert.equal(mergeIncoming([], nuevo).length, 1)
})

test('datos mal formados no rompen y el tipo desconocido es General', () => {
  const n = normalizeServiceNote({ text: 'ok', type: 'raro', at: 'basura', pinned: 'si' })
  assert.equal(n.type, 'general')
  assert.equal(n.pinned, false)
  assert.equal(n.at, null)
  assert.equal(normalizeServiceNote({ answers: ['a'] }), null)
  assert.equal(normalizeServiceNote('x'), null)
})

test('la búsqueda ignora tildes y mayúsculas y mira las respuestas guiadas', () => {
  const n = normalizeServiceNote({ id: 'a', type: 'onboarding', text: 'Llamada larga', answers: { consume: 'Sigue a Midudev en YouTube' } })
  assert.ok(noteMatches(n, 'youtube midu'))
  assert.ok(noteMatches(n, 'LLAMADA'))
  assert.ok(noteMatches(n, 'qué contenido'))
  assert.ok(!noteMatches(n, 'instagram'))
  assert.equal(noteSnippet(normalizeServiceNote({ answers: { futuro: 'Fase 2 en enero' } })), 'Fase 2 en enero')
})

test('el resumen de una coincidencia sale del campo donde está la palabra', () => {
  const n = normalizeServiceNote({ text: 'Muy abierto en la call', answers: { consume: 'Mira a Midudev todos los días' } })
  assert.equal(matchSnippet(n, 'midudev'), 'Mira a Midudev todos los días')
  assert.equal(matchSnippet(n, ''), 'Muy abierto en la call')
  const largo = normalizeServiceNote({ text: `${'relleno '.repeat(40)}la palabra clave está acá ${'cola '.repeat(30)}` })
  const s = matchSnippet(largo, 'clave', 60)
  assert.ok(s.startsWith('…') && s.includes('clave') && s.length <= 62)
})

test('el índice ordena por la última nota y filtra por nombre, texto y tipo', () => {
  const clients = [{ id: 'c1', name: 'Leonardo', company: 'iRowing' }]
  const projects = [{ id: 'p1', name: 'iRowing App', clientId: 'c1' }, { id: 'p2', name: 'Kintsugi' }, { id: 'p3', name: 'Sin notas' }]
  const notes = [
    createServiceNote({ type: 'call', text: 'Pidió exportar a Excel' }, { projectId: 'p1', now: at(10) }),
    createServiceNote({ type: 'motivo', text: 'Lo movió perder un contrato' }, { projectId: 'p2', now: at(20) }),
    deleteServiceNote(createServiceNote({ type: 'idea', text: 'borrada' }, { projectId: 'p3', now: at(25) }), NOW),
    createServiceNote({ type: 'idea', text: 'de un proyecto fuera de la lista' }, { projectId: 'p99', now: at(26) }),
  ]
  assert.deepEqual(notesIndex(projects, clients, notes).map((r) => r.project.id), ['p2', 'p1', 'p3'])
  assert.deepEqual(notesIndex(projects, clients, notes, { query: 'leonardo' }).map((r) => r.project.id), ['p1'])
  const byText = notesIndex(projects, clients, notes, { query: 'excel' })
  assert.equal(byText.length, 1)
  assert.equal(byText[0].shown.length, 1)
  assert.deepEqual(notesIndex(projects, clients, notes, { type: 'motivo' }).map((r) => r.project.id), ['p2'])
  const ids = new Set(projects.map((p) => p.id))
  assert.equal(typeCounts(notes, ids).all, 2)
  assert.equal(typeCounts(notes, ids).call, 1)
  assert.equal(typeCounts(notes).all, 3)
})

test('la fecha se lee como persona', () => {
  assert.equal(noteWhen(new Date(2026, 9, 26, 9, 5).toISOString(), NOW), 'hoy 09:05')
  assert.equal(noteWhen(new Date(2026, 9, 25, 18, 0).toISOString(), NOW), 'ayer 18:00')
  assert.equal(noteWhen(new Date(2026, 9, 3).toISOString(), NOW), '3 oct')
  assert.equal(noteWhen(new Date(2025, 0, 3).toISOString(), NOW), '3 ene 2025')
})

test('el proyecto ya no lleva las notas y el puente no las conoce', () => {
  const p = { id: 'p1', name: 'X', clientId: 'c1', kind: 'cliente', serviceNotes: [{ text: 'SECRETO-DEL-ONBOARDING' }] }
  const snap = buildBridgeSnapshots({ projects: [p], clients: [{ id: 'c1', name: 'Ana' }] }, NOW)
  assert.ok(!JSON.stringify(snap).includes('SECRETO-DEL-ONBOARDING'))
})
