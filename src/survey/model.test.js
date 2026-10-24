import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUESTIONS, BLOCKS, COPY } from './questions.js'
import {
  visibleQuestions, canAdvance, pruneAnswers, toggleMulti, aggregate, npsScore, surveyStatus,
  minutesLeft, totalMinutes, firstUnanswered, inviteMessage, OTHER,
} from './model.js'

const ID = /^[a-z][a-z0-9_]{0,39}$/

test('ids válidos para la RPC y sin repetir', () => {
  const ids = QUESTIONS.map((q) => q.id)
  assert.equal(new Set(ids).size, ids.length)
  ids.forEach((id) => { assert.match(id, ID); assert.match(`${id}_otro`, ID) })
  QUESTIONS.forEach((q) => {
    assert.ok(BLOCKS.some((b) => b.id === q.block), q.id)
    assert.ok(q.es.q && q.en.q, q.id)
    ;(q.options || []).forEach((op) => { assert.notEqual(op.id, OTHER); assert.ok(op.es && op.en) })
    if (q.type === 'multi') assert.ok(q.max <= 12)
  })
})

test('ronda las 20 preguntas y entra en 5 a 7 minutos', () => {
  assert.ok(QUESTIONS.length >= 18 && QUESTIONS.length <= 22)
  const m = totalMinutes()
  assert.ok(m >= 5 && m <= 7, `minutos: ${m}`)
  assert.equal(minutesLeft(QUESTIONS.length - 1), 1)
})

test('textos en los dos idiomas', () => {
  assert.deepEqual(Object.keys(COPY.es).sort(), Object.keys(COPY.en).sort())
})

test('el tipo de videos sólo aparece si miró YouTube', () => {
  assert.ok(!visibleQuestions({ youtube: 'no' }).some((q) => q.id === 'youtube_tipo'))
  assert.ok(visibleQuestions({ youtube: 'muchos' }).some((q) => q.id === 'youtube_tipo'))
})

test('pruneAnswers saca respuestas de preguntas ocultas y vacías', () => {
  const out = pruneAnswers({ youtube: 'no', youtube_tipo: ['casos'], anuncio: '   ', redes: [], basura: 'x', canal: 'otro', canal_otro: 'Un podcast' })
  assert.deepEqual(out, { youtube: 'no', canal: 'otro', canal_otro: 'Un podcast' })
})

test('"Otra" sin escribir no deja avanzar; las opcionales sí', () => {
  const canal = QUESTIONS.find((q) => q.id === 'canal')
  assert.equal(canAdvance(canal, {}), false)
  assert.equal(canAdvance(canal, { canal: OTHER }), false)
  assert.equal(canAdvance(canal, { canal: OTHER, canal_otro: 'Radio' }), true)
  assert.equal(canAdvance(canal, { canal: 'google' }), true)
  assert.equal(canAdvance(QUESTIONS.find((q) => q.id === 'anuncio'), {}), true)
  const nps = QUESTIONS.find((q) => q.id === 'nps')
  assert.equal(canAdvance(nps, { nps: 0 }), true)
})

test('toggleMulti respeta el máximo', () => {
  assert.deepEqual(toggleMulti(['a', 'b'], 'c', 2), { value: ['a', 'b'], blocked: true })
  assert.deepEqual(toggleMulti(['a', 'b'], 'a', 2), { value: ['b'], blocked: false })
  assert.deepEqual(toggleMulti(undefined, 'a', 2), { value: ['a'], blocked: false })
})

test('firstUnanswered retoma en la primera obligatoria sin contestar', () => {
  assert.equal(firstUnanswered({}), 0)
  assert.equal(firstUnanswered({ interes: 'redes', primera_busqueda: 'google' }), 2)
})

test('NPS', () => {
  assert.equal(npsScore([]), null)
  assert.equal(npsScore([10, 9, 8, 3]), 25)
})

test('aggregate cuenta opciones, junta "otra" y textos', () => {
  const rows = [
    { label: 'Ana', answers: { canal: 'google', razon: ['precio', 'llamada'], nps: 10, amigo: 'Porque cumplen' } },
    { label: 'Beto', answers: { canal: OTHER, canal_otro: 'Radio', razon: ['precio'], nps: 6 } },
    { label: 'Caro', answers: {} },
  ]
  const agg = Object.fromEntries(aggregate(rows).map((a) => [a.id, a]))
  assert.equal(agg.canal.n, 2)
  assert.deepEqual(agg.canal.others, [{ label: 'Beto', text: 'Radio' }])
  assert.equal(agg.razon.options[0].id, 'precio')
  assert.equal(agg.razon.options[0].count, 2)
  assert.equal(agg.razon.options[0].pct, 1)
  assert.equal(agg.nps.avg, 8)
  assert.equal(agg.nps.nps, 0)
  assert.deepEqual(agg.amigo.texts, [{ label: 'Ana', text: 'Porque cumplen' }])
})

test('estado de cada encuesta', () => {
  assert.equal(surveyStatus(null), 'none')
  assert.equal(surveyStatus({}), 'sent')
  assert.equal(surveyStatus({ opened_at: 'x' }), 'opened')
  assert.equal(surveyStatus({ opened_at: 'x', answered: 3 }), 'progress')
  assert.equal(surveyStatus({ completed_at: 'x', answered: 3 }), 'done')
})

test('mensaje para mandar por privado', () => {
  assert.match(inviteMessage({ lang: 'es', contact: 'Esther Urbano', link: 'L' }), /^¡Hola Esther!.*L$/)
  assert.match(inviteMessage({ lang: 'en', contact: '', link: 'L' }), /^Hi! .*L$/)
})
