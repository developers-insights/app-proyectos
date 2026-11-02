import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeUrl, mvpDemoUrl, normalizeMvp, isNewMvp, unseenMvpCount, esGenerado, generadorDe, capturaMovil } from './mvps.js'

const generado = (extra = {}) => ({
  id: 'mvp-insightsapps-mvp-mi-cupon-demo',
  origen: 'generador',
  fullName: 'insightsapps-mvp/mi-cupon-demo',
  generador: {
    closer: { nombre: 'Juan', email: 'juan@insightsapps.tech' },
    propuesta: { id: 'prop-1', slug: 'mi-cupon', url: 'https://example.com/propuestas/mi-cupon' },
    mvpId: 'mvp-1',
    panelUrl: 'https://example.com/panel/mvps/mvp-1',
  },
  evidencia: {
    movil: 'https://example.com/capturas/mi-cupon-375.png',
    escritorio: 'https://example.com/capturas/mi-cupon-1280.png',
    video: 'https://example.com/capturas/mi-cupon.mp4',
  },
  ...extra,
})

test('esGenerado: sólo origen === "generador"', () => {
  assert.equal(esGenerado(generado()), true)
  assert.equal(esGenerado({ origen: 'github' }), false)
  assert.equal(esGenerado({ origen: 'Generador' }), false)
  assert.equal(esGenerado({ source: 'generador' }), false)
  assert.equal(esGenerado({}), false)
  assert.equal(esGenerado(null), false)
  assert.equal(esGenerado(undefined), false)
})

test('generadorDe: closer y propuesta de un MVP generado, null en los demás', () => {
  assert.deepEqual(generadorDe(generado()), {
    closer: { nombre: 'Juan', email: 'juan@insightsapps.tech' },
    propuesta: { id: 'prop-1', slug: 'mi-cupon', url: 'https://example.com/propuestas/mi-cupon' },
    mvpId: 'mvp-1',
    panelUrl: 'https://example.com/panel/mvps/mvp-1',
  })
  assert.equal(generadorDe({ origen: 'github', generador: generado().generador }), null)
  assert.equal(generadorDe(null), null)
})

test('generadorDe: sin nombre usa lo anterior al @ del mail; sin nada, vacío', () => {
  const sinNombre = generadorDe(generado({ generador: { closer: { email: 'juan.perez@insightsapps.tech' } } }))
  assert.equal(sinNombre.closer.nombre, 'juan.perez')
  assert.equal(sinNombre.propuesta.url, '')
  const vacio = generadorDe({ origen: 'generador' })
  assert.deepEqual(vacio, { closer: { nombre: '', email: '' }, propuesta: { id: '', slug: '', url: '' }, mvpId: '', panelUrl: '' })
  assert.equal(generadorDe(generado({ generador: { closer: { nombre: '  Ana  ' } } })).closer.nombre, 'Ana')
})

test('generadorDe: lo mal formado no rompe y un link que no es http(s) no pasa', () => {
  for (const generador of ['texto', 7, [], [{ closer: { nombre: 'x' } }], { closer: 'Juan', propuesta: ['x'] }]) {
    assert.deepEqual(generadorDe({ origen: 'generador', generador }).closer, { nombre: '', email: '' })
  }
  const g = generadorDe(generado({ generador: {
    closer: { nombre: 'Juan' },
    propuesta: { id: 12, url: 'javascript:alert(1)' },
    panelUrl: 'data:text/html,<script>alert(1)</script>',
  } }))
  assert.equal(g.propuesta.url, '')
  assert.equal(g.propuesta.id, '12')
  assert.equal(g.panelUrl, '')
})

test('capturaMovil: el link de la captura en celular, o nada', () => {
  assert.equal(capturaMovil(generado()), 'https://example.com/capturas/mi-cupon-375.png')
  assert.equal(capturaMovil(generado({ evidencia: { movil: '  https://example.com/a.png  ' } })), 'https://example.com/a.png')
  assert.equal(capturaMovil(generado({ evidencia: { escritorio: 'https://example.com/e.png' } })), '')
  assert.equal(capturaMovil(generado({ evidencia: undefined })), '')
  assert.equal(capturaMovil(generado({ evidencia: 'https://example.com/a.png' })), '')
  assert.equal(capturaMovil(generado({ evidencia: { movil: { url: 'https://example.com/a.png' } } })), '')
  assert.equal(capturaMovil(null), '')
})

test('capturaMovil: un link que no es http(s) no pasa, y sin origen generador no hay captura', () => {
  for (const movil of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', 'file:///C:/x.png', '//example.com/a.png', 'a.png', '']) {
    assert.equal(capturaMovil(generado({ evidencia: { movil } })), '')
  }
  assert.equal(capturaMovil({ origen: 'github', evidencia: { movil: 'https://example.com/a.png' } }), '')
})

test('normalizeMvp conserva origen, generador y evidencia tal cual', () => {
  const fila = generado({ title: 'Mi Cupón', projectId: 'p1' })
  const n = normalizeMvp(fila)
  assert.equal(n.origen, 'generador')
  assert.deepEqual(n.generador, fila.generador)
  assert.deepEqual(n.evidencia, fila.evidencia)
  assert.equal(n.projectId, 'p1')
  assert.equal(normalizeMvp(n).generador.propuesta.slug, 'mi-cupon')
})

test('normalizeMvp no inventa origen, generador ni evidencia en una fila de GitHub', () => {
  const n = normalizeMvp({ id: 'mvp-x', source: 'github', repo: 'x-demo' })
  assert.equal('origen' in n, false)
  assert.equal('generador' in n, false)
  assert.equal('evidencia' in n, false)
  assert.equal(n.title, 'x-demo')
  assert.equal(n.status, 'activo')
})

test('editar desde la vista (notas, vínculo, estado) no borra lo que empujó el generador', () => {
  const patch = (x, fn) => normalizeMvp({ ...fn(x), updatedAt: '2026-11-02T15:00:00.000Z' })
  let fila = normalizeMvp(generado())
  fila = patch(fila, (x) => ({ ...x, notes: 'llamar el lunes' }))
  fila = patch(fila, (x) => ({ ...x, projectId: 'p1', linkedBy: 'manual', linkedAt: '2026-11-02T15:00:00.000Z' }))
  fila = patch(fila, (x) => ({ ...x, status: 'descartado' }))
  assert.equal(fila.origen, 'generador')
  assert.equal(generadorDe(fila).closer.nombre, 'Juan')
  assert.equal(capturaMovil(fila), 'https://example.com/capturas/mi-cupon-375.png')
  assert.equal(fila.evidencia.video, 'https://example.com/capturas/mi-cupon.mp4')
})

test('safeUrl: sólo http y https', () => {
  assert.equal(safeUrl(' https://example.com/a?b=1 '), 'https://example.com/a?b=1')
  assert.equal(safeUrl('http://example.com'), 'http://example.com/')
  for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'ftp://example.com', 'file:///C:/x.txt', '/ruta', 'example.com', '', null, undefined, {}, []]) {
    assert.equal(safeUrl(u), '')
  }
})

test('mvpDemoUrl: la demo cargada a mano gana a la detectada, y una insegura se salta', () => {
  assert.equal(mvpDemoUrl({ demoUrl: 'https://example.com/d', demoUrlManual: 'https://example.com/m' }), 'https://example.com/m')
  assert.equal(mvpDemoUrl({ demoUrl: 'https://example.com/d', demoUrlManual: 'javascript:alert(1)' }), 'https://example.com/d')
  assert.equal(mvpDemoUrl({ demoUrl: 'javascript:alert(1)' }), '')
  assert.equal(mvpDemoUrl(null), '')
})

test('una fila recién generada cuenta como nueva y sin ver (fechas ISO con milisegundos y Z)', () => {
  const t = new Date()
  const fila = normalizeMvp(generado({ createdAt: t.toISOString(), repoCreatedAt: t.toISOString(), status: 'activo' }))
  assert.equal(isNewMvp(fila), true)
  assert.equal(unseenMvpCount([fila], new Date(t.getTime() - 60000).toISOString()), 1)
  assert.equal(unseenMvpCount([fila], t.toISOString()), 0)
  assert.equal(unseenMvpCount([fila], new Date(t.getTime() + 60000).toISOString()), 0)
  assert.equal(unseenMvpCount([{ ...fila, projectId: 'p1' }], new Date(t.getTime() - 60000).toISOString()), 0)
})
