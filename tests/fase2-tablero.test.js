import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  nuevoTablero, proyectosDelTablero, normalizarEntradaStore, normalizarEntrada, marcarBorrada, normalizarPropuesta,
  totalesPropuesta, propuestaComoTexto, vistaTablero, sugerenciasFathom, linksPegados, datosDeShare,
  textoDeTranscripcionCopiada, textoDeCallsParaPropuesta, propuestaDeIA, idPropuesta, vistaFase2, lineasFase2,
} from '../src/lib/fase2.js'

const now = new Date('2026-11-28T15:00:00Z')

test('el tablero guarda proyectos en orden y los saca con deletedAt', () => {
  const a = nuevoTablero({ projectId: 'p1', now: new Date('2026-11-28T10:00:00Z') })
  const b = nuevoTablero({ projectId: 'p2', now: new Date('2026-11-28T09:00:00Z') })
  assert.equal(a.id, 'tablero-p1')
  assert.deepEqual(proyectosDelTablero([a, b]), ['p2', 'p1'])
  assert.deepEqual(proyectosDelTablero([marcarBorrada(a, now), b]), ['p2'])
  assert.equal(normalizarEntradaStore(a).kind, 'tablero')
})

test('las filas nuevas no ensucian la sección Fase 2 del detalle', () => {
  const items = [nuevoTablero({ projectId: 'p1', now }), { id: idPropuesta('p1'), projectId: 'p1', kind: 'propuesta', estado: 'armando' }]
  const v = vistaFase2(items, 'p1')
  assert.equal(v.entradas.length, 0)
  assert.equal(v.plan, null)
  assert.deepEqual(lineasFase2(items), [])
})

test('una propuesta sobrevive al store sin perder lo editado', () => {
  const p = normalizarEntrada({
    id: 'propuesta-p1', projectId: 'p1', kind: 'propuesta', estado: 'lista',
    loQueHablaron: ['Quiere cobrar con tarjeta'],
    queVender: [{ id: 'x1', titulo: 'Cobro con tarjeta', precioUsd: 1499.6, cobro: 'unico', editado: true, incluye: ['Stripe', 'Recibos'] }, { titulo: '' }],
  })
  assert.equal(p.kind, 'propuesta')
  assert.equal(p.queVender.length, 1)
  assert.equal(p.queVender[0].precioUsd, 1500)
  assert.equal(p.queVender[0].editado, true)
  assert.deepEqual(normalizarEntradaStore(p).queVender, p.queVender)
})

test('totales y texto para pegar ignoran lo quitado', () => {
  const p = normalizarPropuesta({
    estado: 'lista',
    loQueHablaron: ['Pierde turnos por WhatsApp'],
    queVender: [
      { id: 'a', titulo: 'Agenda online', precioUsd: 2000 },
      { id: 'b', titulo: 'Soporte', precioUsd: 400, cobro: 'mensual' },
      { id: 'c', titulo: 'Otra', precioUsd: 900, quitado: true },
      { id: 'd', titulo: 'Sin precio' },
    ],
  })
  const t = totalesPropuesta(p)
  assert.equal(t.unico, 2000)
  assert.equal(t.mensual, 400)
  assert.equal(t.items, 3)
  assert.equal(t.sinPrecio, 1)
  const txt = propuestaComoTexto(p, 'Mi cupón')
  assert.match(txt, /Fase 2 · Mi cupón/)
  assert.match(txt, /Agenda online: USD 2\.000/)
  assert.match(txt, /USD 400 por mes/)
  assert.doesNotMatch(txt, /Otra/)
})

test('vistaTablero: propuesta desactualizada cuando entra una call nueva con texto', () => {
  const c1 = { id: 'c1', projectId: 'p1', kind: 'call', at: '2026-11-20T10:00:00Z', estado: 'lista', texto: 'hola', link: 'https://fathom.video/share/aaa' }
  const c2 = { id: 'c2', projectId: 'p1', kind: 'call', at: '2026-11-27T10:00:00Z', estado: 'bajando', texto: '', link: 'https://fathom.video/share/bbb', updatedAt: '2026-11-28T14:59:00Z' }
  const prop = { id: 'propuesta-p1', projectId: 'p1', kind: 'propuesta', estado: 'lista', basadoEn: ['c1'], queVender: [{ titulo: 'X' }] }
  let v = vistaTablero([c2, c1, prop], 'p1', now)
  assert.deepEqual(v.calls.map((c) => c.id), ['c1', 'c2'])
  assert.equal(v.bajando.length, 1)
  assert.equal(v.desactualizada, false)
  v = vistaTablero([{ ...c2, texto: 'chau', estado: 'analizando' }, c1, prop], 'p1', now)
  assert.equal(v.desactualizada, true)
})

test('vistaTablero: una propuesta en "armando" sin novedades hace rato queda trabada', () => {
  const prop = { id: 'propuesta-p1', projectId: 'p1', kind: 'propuesta', estado: 'armando', updatedAt: '2026-11-28T14:00:00Z' }
  const v = vistaTablero([prop], 'p1', now)
  assert.equal(v.armando, false)
  assert.equal(v.trabada, true)
})

test('sugerencias: junta links de las calls, de Fathom y del proyecto, sin repetir ni los ya cargados', () => {
  const project = {
    id: 'p1', clientId: 'c9',
    avances: [{ date: '2026-11-10', text: 'Kickoff con Miguel https://fathom.video/share/AAA111' }],
    comms: [{ text: 'otra vez https://fathom.video/share/AAA111?x=1' }],
  }
  const s = sugerenciasFathom({
    project,
    calls: [{ projectId: 'p1', url: 'https://fathom.video/share/BBB222', name: 'Entrega', date: '2026-11-20' }, { projectId: 'otro', url: 'https://fathom.video/share/ZZZ' }],
    fathomCalls: [{ client_id: 'c9', share_url: 'https://fathom.video/share/CCC333', title: 'Soporte', call_date: '2026-11-25' }],
    cargadas: [{ link: 'https://fathom.video/share/CCC333' }],
  })
  assert.deepEqual(s.map((x) => x.clave), ['BBB222', 'AAA111'])
  assert.equal(s[0].titulo, 'Entrega')
  assert.equal(s[1].at, '2026-11-10T00:00:00.000Z')
})

test('linksPegados separa los buenos de los malos y no repite', () => {
  const r = linksPegados('https://fathom.video/share/A1\nhttps://fathom.video/share/A1?t=2 , fathom.video/share/B2  google.com')
  assert.deepEqual(r.ok.map((x) => x.clave), ['A1', 'B2'])
  assert.deepEqual(r.malos, ['google.com'])
})

test('datosDeShare lee la página pública de Fathom y sólo acepta un link de fathom.video', () => {
  const props = { call: { id: 902611166, title: 'Meeting with Miguel', recording: { started_at: '2026-11-16T16:00:43Z' } }, copyTranscriptUrl: 'https://fathom.video/calls/902611166/copy_transcript?token=abc' }
  const html = `<div id="app" data-page="${JSON.stringify({ component: 'page-call-detail', props }).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div>`
  const d = datosDeShare(html)
  assert.equal(d.callId, '902611166')
  assert.equal(d.titulo, 'Meeting with Miguel')
  assert.equal(d.at, '2026-11-16T16:00:43.000Z')
  assert.equal(d.copiarUrl, 'https://fathom.video/calls/902611166/copy_transcript?token=abc')
  const malo = datosDeShare(html.replace('https://fathom.video/calls', 'https://evil.com/calls'))
  assert.equal(malo.copiarUrl, null)
  assert.equal(datosDeShare('<html>nada</html>'), null)
})

test('textoDeTranscripcionCopiada arma una línea por intervención', () => {
  const html = "<h1>Meeting - November 16</h1><br /><a href=''><b>VIEW RECORDING - 39 mins</b></a><br /><br /><p><a href='x'>@0:15</a> - <b>ignacio cachaza (insightsapps.tech)</b></p><p style='m'>Miguel, &iquest;me escuch&aacute;s?</p><br /><p><a href='x'>@1:02</a> - <b>Miguel</b></p><p>S&iacute; &amp; perfecto</p>"
  const t = textoDeTranscripcionCopiada(html)
  const lineas = t.split('\n')
  assert.equal(lineas[0], 'Meeting - November 16')
  assert.match(lineas[1], /^\[0:15\] ignacio cachaza: Miguel/)
  assert.match(lineas[2], /^\[1:02\] Miguel: S/)
})

test('textoDeCallsParaPropuesta limpia datos sensibles y va de la más vieja a la más nueva', () => {
  const t = textoDeCallsParaPropuesta([
    { at: '2026-11-27T10:00:00Z', titulo: 'Segunda', texto: 'mandame a juan@x.com' },
    { at: '2026-11-20T10:00:00Z', titulo: 'Primera', texto: 'hola' },
    { at: '2026-11-21T10:00:00Z', texto: '' },
  ])
  assert.ok(t.indexOf('Primera') < t.indexOf('Segunda'))
  assert.doesNotMatch(t, /juan@x\.com/)
  assert.match(t, /\[mail\]/)
})

test('propuestaDeIA arma una propuesta lista con ids propios', () => {
  let n = 0
  const p = propuestaDeIA({ loQueHablaron: ['a'], queVender: [{ titulo: 'Agenda', precioUsd: 2000, cobro: 'unico', incluye: ['x'], porQue: 'y', cita: '', semanas: 3 }], siguientePaso: 'mostrar' }, { basadoEn: ['c1'], now, modelo: 'm', nuevoId: () => `id-${++n}` })
  assert.equal(p.estado, 'lista')
  assert.equal(p.queVender[0].id, 'id-1')
  assert.deepEqual(p.basadoEn, ['c1'])
  assert.equal(propuestaDeIA({ loQueHablaron: [], queVender: [] }), null)
})
