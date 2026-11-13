import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  armarContexto, leerRespuestaIA, pedidoUpsell, vistaOportunidades, normalizeOpportunity,
  marcarDescartada, deshacerDescarte, tipoDeCategoria, ESQUEMA_RESPUESTA, MAX_OPORTUNIDADES,
} from '../src/lib/oportunidades.js'

const NOW = new Date(2026, 10, 13, 15, 0)
const daysAgo = (n) => new Date(2026, 10, 13 - n, 10, 0).toISOString()

const base = () => ({
  project: {
    id: 'p1', name: 'Mi cupón', clientId: 'c1', planId: 'pl1', stage: 'free',
    lifecycle: { phase: 2, startedAt: daysAgo(60), phase2At: daysAgo(10), trialDays: 30, maintenanceAmount: 1000 },
    totalAmount: 9000, paidAmount: 6000, sharePassword: 'secreta-123', vault: { x: 'clave' },
    portafolio: { queEs: 'Plataforma de cupones con QR', stack: 'Mercado Pago', resumen: 'Web y app' },
    stack: ['', 'Next.js', ''],
    kickoff: 'Arrancamos con la web para comercios',
    scopeNotes: [{ id: 's1', text: 'Quieren sumar una segunda marca el año que viene', date: daysAgo(5) }],
    accounts: [{ id: 'a1', label: 'Supabase', done: true }, { id: 'a2', label: 'Vercel', done: false }],
    stores: { play: { status: 'tramite', startedAt: daysAgo(4) } },
    pendingClient: [{ id: 'k1', title: 'Cuenta de Apple', description: 'Falta pagar la cuenta de desarrollador' }],
    avances: [{ id: 'av1', date: daysAgo(2), text: 'Cobros con Mercado Pago andando' }],
    risks: [{ id: 'r1', severity: 'alta', description: 'Depende de la aprobación de Apple' }],
    upsell: { entries: [{ id: 'u1', offer: 'plan', status: 'ofrecido', at: daysAgo(3), by: 'u7', note: 'Le gustó' }], objections: 'Quiere esperar al lanzamiento' },
    closerNotes: [{ id: 'n1', text: 'Paga la cuota el lunes', at: daysAgo(1) }],
  },
  client: { id: 'c1', name: 'Elizabeth', company: 'Mi cupón Arg', email: 'eli@micupon.com', phone: '+54 11 5555 0101' },
  plan: {
    id: 'pl1', lead: 'Roadmap de 8 semanas',
    hitos: [{ title: 'App de compradores', description: 'iPhone y Android' }],
    weeks: [
      { n: 1, title: 'Base', tasks: [{ text: 'Paneles', done: true }] },
      { n: 2, title: 'App', tasks: [{ text: 'Mis cupones con QR', done: false }, { text: 'Reseñas', done: false }] },
    ],
  },
  tasks: [
    { id: 't1', name: 'Conectar push', status: 'pendiente', projectId: 'p1' },
    { id: 't2', name: 'Hecha', status: 'terminado', projectId: 'p1' },
  ],
  notes: [{ type: 'onboarding', body: 'Compró porque la competencia ya tiene app', notedAt: daysAgo(30) }],
  previas: [
    { titulo: 'Plan de marketing de 6 meses', estado: 'descartada' },
    { titulo: 'Fase 2 con panel de métricas', estado: 'ofrecida' },
  ],
  now: NOW,
})

test('el contexto trae lo que hace falta para pensar qué ofrecer', () => {
  const c = armarContexto(base())
  for (const dato of ['Mi cupón', 'Mi cupón Arg', 'Plataforma de cupones con QR', 'Next.js', 'Mercado Pago',
    'Mis cupones con QR', 'Conectar push', 'Cuenta de Apple', 'segunda marca', 'Compró porque la competencia',
    'Quiere esperar al lanzamiento', 'Supabase', 'USD 9.000', 'USD 1.000', 'Google Play']) {
    assert.ok(c.includes(dato), `falta "${dato}"`)
  }
  assert.ok(c.includes('Plan de marketing de 6 meses'), 'lo descartado tiene que estar para no repetirlo')
  assert.ok(!c.includes('Hecha'), 'una tarea terminada no es pendiente')
})

test('el contexto no lleva contraseñas, bóveda ni datos de contacto del cliente', () => {
  const c = armarContexto(base())
  for (const x of ['secreta-123', 'clave', 'eli@micupon.com', '5555 0101']) assert.ok(!c.includes(x), `se filtró "${x}"`)
})

test('un proyecto casi vacío arma igual un contexto sin romper', () => {
  const c = armarContexto({ project: { id: 'p2', name: 'Nuevo' }, now: NOW })
  assert.ok(c.includes('Nuevo'))
  assert.ok(c.length < 2000)
})

test('un texto largo se corta: el contexto tiene tope', () => {
  const b = base()
  b.notes = Array.from({ length: 80 }, (_, i) => ({ type: 'call', body: 'x'.repeat(3000) + i, notedAt: daysAgo(i) }))
  assert.ok(armarContexto(b).length < 40000)
})

test('la categoría decide el tipo del tablero de Upsell', () => {
  assert.equal(tipoDeCategoria('fase_2'), 'fase_2')
  assert.equal(tipoDeCategoria('plan_mensual'), 'mantenimiento')
  assert.equal(tipoDeCategoria('marketing'), 'marketing')
  for (const k of ['ciberseguridad', 'nuevo_sistema', 'mejora', 'otro', 'cualquiera']) assert.equal(tipoDeCategoria(k), 'otro')
})

test('el esquema de la respuesta es estricto y sin restricciones que la API no acepta', () => {
  const item = ESQUEMA_RESPUESTA.properties.oportunidades.items
  assert.equal(ESQUEMA_RESPUESTA.additionalProperties, false)
  assert.equal(item.additionalProperties, false)
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort())
  assert.ok(!JSON.stringify(ESQUEMA_RESPUESTA).match(/minItems|maxItems|minimum|maxLength/))
})

const respuesta = (n) => ({
  oportunidades: Array.from({ length: n }, (_, i) => ({
    titulo: `  Oportunidad ${i}  `, por_que: 'Porque sí', categoria: i === 0 ? 'plan_mensual' : 'nuevo_sistema',
    monto_usd: i === 1 ? -3 : 1000, cobro: i === 0 ? 'mensual' : 'unico', frase: 'Che, te cuento', senal: 'La app ya está en Play',
  })),
})

test('la respuesta de la IA se vuelve filas listas para guardar', () => {
  const ids = ['a', 'b', 'c']
  const rows = leerRespuestaIA(respuesta(3), { projectId: 'p1', by: 'u1', lote: 'L1', modelo: 'claude-opus-5-5', now: NOW, nuevoId: () => ids.shift() })
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c'])
  assert.equal(rows[0].titulo, 'Oportunidad 0')
  assert.equal(rows[0].tipo, 'mantenimiento')
  assert.equal(rows[0].cobro, 'mensual')
  assert.equal(rows[1].montoUsd, null)
  assert.equal(rows[2].estado, 'nueva')
  assert.equal(rows[2].orden, 2)
  assert.equal(rows[0].generadaAt, NOW.toISOString())
  assert.equal(rows[0].updatedAt, NOW.toISOString())
})

test('más de cinco se recortan y lo mal formado se descarta', () => {
  const r = respuesta(8)
  r.oportunidades.splice(1, 0, { titulo: '', por_que: 'x', categoria: 'otro' }, null, 'basura')
  const rows = leerRespuestaIA(r, { projectId: 'p1', now: NOW })
  assert.equal(rows.length, MAX_OPORTUNIDADES)
  assert.ok(rows.every((x) => x.titulo && x.projectId === 'p1'))
  assert.deepEqual(leerRespuestaIA({ nada: 1 }, { projectId: 'p1', now: NOW }), [])
  assert.deepEqual(leerRespuestaIA(null, { projectId: 'p1', now: NOW }), [])
})

test('"La ofrecí" arma lo que viaja al tablero de Upsell', () => {
  const [op] = leerRespuestaIA(respuesta(1), { projectId: 'p1', now: NOW, nuevoId: () => 'op1' })
  const p = pedidoUpsell(op, 'Nacho Cachaza')
  assert.deepEqual(p, {
    proyecto: 'p1', oportunidad_id: 'op1', tipo: 'mantenimiento', titulo: 'Oportunidad 0', monto_usd: 1000,
    nota: 'Porque sí\nSeñal: La app ya está en Play\nPor mes.\nLa propuso la IA de Proyectos.',
    proximo_paso: 'Abrir con: Che, te cuento', responsable: 'Nacho Cachaza',
  })
  assert.equal(pedidoUpsell(op, 'Nacho', 91).fin_client_id, 91)
})

test('la vista separa lo que falta decidir de lo ya visto', () => {
  const rows = [
    { id: 'a', projectId: 'p1', titulo: 'A', estado: 'nueva', orden: 1, generadaAt: daysAgo(1) },
    { id: 'b', projectId: 'p1', titulo: 'B', estado: 'nueva', orden: 0, generadaAt: daysAgo(1) },
    { id: 'c', projectId: 'p1', titulo: 'C', estado: 'ofrecida', ofrecidaAt: daysAgo(3), generadaAt: daysAgo(5) },
    { id: 'd', projectId: 'p1', titulo: 'D', estado: 'descartada', descartadaAt: daysAgo(2), generadaAt: daysAgo(5) },
    { id: 'e', projectId: 'otro', titulo: 'E', estado: 'nueva' },
  ]
  const v = vistaOportunidades(rows, 'p1')
  assert.deepEqual(v.nuevas.map((x) => x.id), ['b', 'a'])
  assert.deepEqual(v.vistas.map((x) => x.id), ['d', 'c'])
  assert.equal(v.generadaAt, daysAgo(1))
  assert.equal(vistaOportunidades([], 'p1').generadaAt, null)
})

test('"No va" se puede deshacer y una ofrecida no se descarta', () => {
  const op = normalizeOpportunity({ id: 'a', projectId: 'p1', titulo: 'A', estado: 'nueva' })
  const d = marcarDescartada(op, 'u1', NOW)
  assert.equal(d.estado, 'descartada')
  assert.equal(d.descartadaPor, 'u1')
  assert.equal(deshacerDescarte(d).estado, 'nueva')
  assert.equal(deshacerDescarte(d).descartadaAt, null)
  const ofrecida = { ...op, estado: 'ofrecida' }
  assert.equal(marcarDescartada(ofrecida, 'u1', NOW), ofrecida)
})

test('una fila vieja o rota se normaliza sin romper', () => {
  const o = normalizeOpportunity({ id: 'x', estado: 'rara', montoUsd: 'mil', categoria: 'zzz' })
  assert.equal(o.estado, 'nueva')
  assert.equal(o.montoUsd, null)
  assert.equal(o.categoria, 'otro')
  assert.equal(o.tipo, 'otro')
})
