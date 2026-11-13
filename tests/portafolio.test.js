import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portafolioDe, textoMostrable, estadoPortafolio, urlMostrable } from '../src/lib/portafolio.js'
import { buildBridgeSnapshots } from '../src/lib/bridge.js'

const NOW = new Date(2026, 10, 12, 15, 0)

const KICKOFF_AUTOMOTRIZ =
  'Plataforma integral de emergencias automotrices para conectar clientes con técnicos en campo. ' +
  'Marco controla asignaciones, pagos y métricas. Incluye tracking GPS en tiempo real y apps iOS + Android. ' +
  'Estructura de pago 50/25/25 sobre USD 8.000. Plazo: 4–5 semanas. Soporte post-lanzamiento: 30 días.'

test('el resumen deja afuera plata, plazos, contactos y el nombre de la persona', () => {
  const t = textoMostrable(KICKOFF_AUTOMOTRIZ, 'Marco Antonio')
  assert.equal(t, 'Plataforma integral de emergencias automotrices para conectar clientes con técnicos en campo. Incluye tracking GPS en tiempo real y apps iOS + Android.')
  assert.equal(textoMostrable('Escribile a leo@irowing.app o al +54 11 5555 0106. App de remo.', 'Leo'), 'App de remo.')
  assert.equal(textoMostrable('Cobra US$5k de seña. Panel de turnos.', ''), 'Panel de turnos.')
})

test('el resumen no parte siglas ni nombres con punto y deja lo que es del producto', () => {
  const t = textoMostrable('Marketplace de limpieza en EE.UU. con asociados. Front en Next.js y cálculo de comisiones por nivel. El cliente recibe un presupuesto automático.', 'José Anaya')
  assert.equal(t, 'Marketplace de limpieza en EE.UU. con asociados. Front en Next.js y cálculo de comisiones por nivel. El cliente recibe un presupuesto automático.')
})

test('el estado que ve el prospecto no usa la jerga interna y lo cancelado no se muestra', () => {
  assert.deepEqual(estadoPortafolio('free'), { key: 'produccion', label: 'En producción' })
  assert.deepEqual(estadoPortafolio('fase2'), { key: 'desarrollo', label: 'En desarrollo' })
  assert.equal(estadoPortafolio('cancelado'), null)
  assert.deepEqual(portafolioDe({ id: 'x' }, {}, 'cancelado', null), { mostrable: false })
})

test('sólo viajan links http(s) y un dominio pelado se completa', () => {
  assert.equal(urlMostrable('veocompro.com'), 'https://veocompro.com/')
  assert.equal(urlMostrable('https://app.davischamber.com'), 'https://app.davischamber.com/')
  assert.equal(urlMostrable('javascript:alert(1)'), null)
  assert.equal(urlMostrable('https://user:pass@x.com'), null)
  assert.equal(urlMostrable('pendiente'), null)
  assert.equal(urlMostrable(''), null)
})

test('la ficha del portafolio trae lo mostrable y nada interno', () => {
  const p = {
    id: 'p9',
    name: 'APP Automotriz',
    stage: 'free',
    kickoff: KICKOFF_AUTOMOTRIZ,
    stack: 'Next.js · Supabase',
    createdAt: '2026-07-01T17:15:10.420Z',
    lastDeployDate: '2026-06-09',
    lastProgressAt: '2026-10-08T16:36:38.530Z',
    testingUrl: 'https://app.kintsugi.com/',
    productionUrl: 'https://app.kintsugi.com',
    lifecycle: { phase: 2, startedAt: '2026-07-01T17:15:10.420Z' },
    stores: { play: { status: 'publicada', publishedAt: '2026-10-20T23:55:38.777Z' }, apple: { status: 'tramite' } },
    upsell: { entries: [{ id: 'u1', offer: 'fase2', status: 'acepta', at: '2026-11-01T10:00:00Z', note: 'Paga 5k el 15' }] },
    scopeNotes: [{ text: 'Cliente fácil, no entiende del tema' }],
    avances: [{ date: '2026-07-29T15:00:00.000Z', text: 'Faltan las cuentas de Apple' }],
    sharePassword: 'secreto',
    totalAmount: 8000,
    paidAmount: 4000,
  }
  const c = { name: 'Marco', company: 'Kintsugi Roadside', email: 'marco@k.com', phone: '+1 305', onboarding: { goals: 'Plataforma estilo Uber para emergencias con tracking GPS. Presupuesto aprobado USD 8.000.', businessDescription: 'Servicio de emergencias automotrices.', approvedBudget: 8000, notes: 'nota privada' } }
  const f = portafolioDe(p, c, 'free', 100)
  assert.equal(f.mostrable, true)
  assert.equal(f.estado, 'produccion')
  assert.equal(f.queEs, 'Plataforma estilo Uber para emergencias con tracking GPS.')
  assert.equal(f.negocio, 'Servicio de emergencias automotrices.')
  assert.equal(f.avance, null)
  assert.equal(f.desde, '2026-06-09T12:00:00.000Z')
  assert.equal(f.ultimoCambio, '2026-10-20T23:55:38.777Z')
  assert.equal(f.appUrl, 'https://app.kintsugi.com/')
  assert.equal(f.demoUrl, null)
  assert.equal(f.fase2, true)
  assert.equal(f.plan, false)
  assert.deepEqual(f.tiendas, { play: 'publicada', apple: 'tramite' })
  const json = JSON.stringify(f)
  for (const prohibido of ['8.000', '8000', '4000', 'secreto', 'marco@k.com', 'Marco', 'fácil', 'Faltan las cuentas', 'Paga 5k', 'nota privada']) {
    assert.ok(!json.includes(prohibido), `se coló "${prohibido}"`)
  }
})

test('en desarrollo viaja el avance y sin kickoff ni objetivos no se inventa nada', () => {
  const f = portafolioDe({ id: 'n', name: 'Komos', createdAt: '2026-10-28T15:36:25.434Z', stack: 'Por definir' }, { name: 'María' }, 'desarrollo', 42.4)
  assert.equal(f.avance, 42)
  assert.equal(f.queEs, null)
  assert.equal(f.resumen, null)
  assert.equal(f.stack, null)
  assert.equal(f.ultimoCambio, null)
  assert.equal(f.desde, '2026-10-28T15:36:25.434Z')
})

test('la foto del puente lleva el bloque portafolio', () => {
  const out = buildBridgeSnapshots({
    projects: [
      { id: 'p1', data: { name: 'Chamber OS', clientId: 'c1', stage: 'free', kickoff: 'Plataforma de membresías para una cámara de comercio.', productionUrl: 'https://app.davischamber.com' } },
      { id: 'p2', data: { name: 'Cancelado', stage: 'cancelado' } },
    ],
    clients: [{ id: 'c1', data: { name: 'Amberlee Bauman', company: 'Davis Chamber of Commerce' } }],
  }, NOW)
  assert.equal(out[0].portafolio.estadoLabel, 'En producción')
  assert.equal(out[0].portafolio.queEs, 'Plataforma de membresías para una cámara de comercio.')
  assert.equal(out[0].portafolio.appUrl, 'https://app.davischamber.com/')
  assert.deepEqual(out[1].portafolio, { mostrable: false })
})

test('los plazos se caen como la plata', () => {
  assert.equal(textoMostrable('App de reservas. Se entrega en 6 semanas. Lanzamos el 18 de diciembre.', ''), 'App de reservas.')
  assert.equal(textoMostrable('Panel de turnos. Cerramos con 30 días de soporte.', ''), 'Panel de turnos.')
})

test('la descripción propia manda sobre lo derivado y pasa igual por el filtro', () => {
  const p = {
    id: 'k', name: 'Komos', kickoff: 'Kickoff viejo.',
    portafolio: { queEs: 'App de vida nocturna con mapa y check-in por QR.', negocio: 'Guía de salidas.', resumen: 'Descubrir lugares por música. La paga USD 5.000.', stack: 'Supabase · Google Places', tiendasUrl: { apple: 'https://apps.apple.com/us/app/komos/id1', play: 'https://evil.com/x' } },
  }
  const f = portafolioDe(p, { name: 'María', onboarding: { goals: 'Otra cosa.' } }, 'desarrollo', 10)
  assert.equal(f.queEs, 'App de vida nocturna con mapa y check-in por QR.')
  assert.equal(f.negocio, 'Guía de salidas.')
  assert.equal(f.resumen, 'Descubrir lugares por música.')
  assert.equal(f.stack, 'Supabase · Google Places')
  assert.deepEqual(f.tiendasUrl, { apple: 'https://apps.apple.com/us/app/komos/id1' })
})

test('sin nada propio, el lead del plan da el resumen sin hablar del proceso', () => {
  const plan = { lead: 'Plan de 8 semanas para el CRM. Reúne WhatsApp e Instagram en un inbox con pipeline de ventas. Lo que falta depende de vos. Las fechas son estimadas.' }
  const f = portafolioDe({ id: 'g', name: 'Go Group' }, {}, 'desarrollo', null, { plan })
  assert.equal(f.resumen, 'Reúne WhatsApp e Instagram en un inbox con pipeline de ventas.')
  assert.equal(f.queEs, null, 'el plan no da el qué es')
})

test('el desarrollador viaja aparte en interno', () => {
  const out = buildBridgeSnapshots({
    projects: [{ id: 'p1', data: { name: 'Chamber OS', stage: 'free', assignments: { dev: { userId: 'u2' } } } }],
    team: [{ id: 'u2', data: { name: 'Lisandro' } }],
  }, NOW)
  assert.deepEqual(out[0].portafolio.interno, { desarrollador: 'Lisandro' })
  assert.equal(JSON.stringify({ ...out[0].portafolio, interno: undefined }).includes('Lisandro'), false)
})
