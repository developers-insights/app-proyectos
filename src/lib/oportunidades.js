/*
 * Oportunidades por proyecto (call del 13/11): una IA lee el proyecto y propone qué más
 * se le puede ofrecer a ese cliente. Lo que alguien ofrece de verdad viaja al tablero de
 * Upsell de Speed Funnels, que es la única fuente de lo ofrecido.
 *
 * Puro y con `now` inyectable: lo usan la edge function `oportunidades`, la sección del
 * detalle del proyecto y los tests (tests/oportunidades.test.js).
 *
 * Al modelo no viajan mails, teléfonos, contraseñas, bóveda ni credenciales: con nombre,
 * empresa y lo que se construyó alcanza para pensar qué ofrecer.
 */

import { stageMeta, projectStage } from './stages.js'
import { journeyEntry, laneMeta, upsellState, upsellStatusMeta, offerLabel } from './journey.js'
import { normalizeLifecycle } from './lifecycle.js'
import { projectProgress } from './progress.js'
import { storesSummary } from './stores.js'
import { noteType } from './serviceNotes.js'
import { openCloserNotes } from './closerNotes.js'

export const MAX_OPORTUNIDADES = 5
export const MODELO = 'claude-opus-5-5'

export const CATEGORIAS = [
  { key: 'fase_2', label: 'Fase 2', tipo: 'fase_2' },
  { key: 'plan_mensual', label: 'Plan mensual', tipo: 'mantenimiento' },
  { key: 'marketing', label: 'Marketing', tipo: 'marketing' },
  { key: 'ciberseguridad', label: 'Ciberseguridad', tipo: 'otro' },
  { key: 'nuevo_sistema', label: 'Nuevo sistema', tipo: 'otro' },
  { key: 'mejora', label: 'Mejora', tipo: 'otro' },
  { key: 'otro', label: 'Otra idea', tipo: 'otro' },
]
const CATEGORIA_KEYS = CATEGORIAS.map((c) => c.key)
export const categoriaMeta = (k) => CATEGORIAS.find((c) => c.key === k) || CATEGORIAS[CATEGORIAS.length - 1]
export const tipoDeCategoria = (k) => categoriaMeta(k).tipo

const ESTADOS = ['nueva', 'ofrecida', 'descartada']

const clip = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const usd = (n) => 'USD ' + Math.round(Number(n)).toLocaleString('es-AR')
const num = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : null)
const dia = (v) => {
  const d = v ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null
}

export const ESQUEMA_RESPUESTA = {
  type: 'object',
  additionalProperties: false,
  required: ['oportunidades'],
  properties: {
    oportunidades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'por_que', 'senal', 'categoria', 'monto_usd', 'cobro', 'frase'],
        properties: {
          titulo: { type: 'string', description: 'Qué se ofrece, en pocas palabras (hasta 70 caracteres).' },
          por_que: { type: 'string', description: 'Por qué a este cliente y ahora, en una o dos oraciones.' },
          senal: { type: 'string', description: 'El dato concreto del proyecto que la dispara.' },
          categoria: { type: 'string', enum: CATEGORIA_KEYS },
          monto_usd: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Estimado en dólares, o null si no hay base para estimarlo.' },
          cobro: { type: 'string', enum: ['unico', 'mensual'] },
          frase: { type: 'string', description: 'La primera frase para abrir la charla con el cliente.' },
        },
      },
    },
  },
}

export const SISTEMA = `Sos parte del equipo de Insights, una agencia que construye apps y sistemas a medida para dueños de negocio (muchos en Estados Unidos y Latinoamérica). Te pasamos todo lo que sabemos de un proyecto de un cliente que ya nos compró y tenés que proponer entre 3 y 5 oportunidades concretas para seguir trabajando con él.

Cómo pensarlas:
- La pregunta no es qué le podemos vender, sino cómo lo podemos ayudar a que le vaya mejor con lo que construimos. Una buena oportunidad resuelve algo que el cliente ya tiene en la cabeza o que el proyecto deja a la vista.
- Cada una sale de un dato del proyecto: algo que falta en el roadmap, una tarea pendiente, una nota de una call, un riesgo, lo que dijo en el onboarding, la etapa en la que está. Nombrá ese dato en "senal". Si no hay un dato que la sostenga, no la propongas.
- Lo que solemos ofrecer: Fase 2 (un desarrollo nuevo sobre lo que ya tiene), plan mensual de mantenimiento y soporte, marketing (un plan de 6 meses para conseguirle usuarios o clientes), ciberseguridad, un sistema nuevo para otra empresa o área del cliente, y mejoras puntuales. Una idea que no entre en esas también vale si tiene sentido.
- No repitas lo que ya se le ofreció ni lo que el equipo descartó: está en la sección "Ya ofrecido o descartado".
- Sé específico: "Panel de métricas para los comercios de Mi cupón" sirve; "Mejoras generales" no.
- monto_usd: un estimado en dólares sólo si el proyecto da una base (lo que ya pagó, el monto de mantenimiento, el tamaño de lo que falta). Si no, null. Para algo mensual, el monto es por mes y cobro es "mensual".
- frase: cómo la abriría Juan o Nacho por WhatsApp. Castellano rioplatense, cálido, corto, sin signos de apertura (nada de ¿ ni ¡), sin sonar a vendedor y sin prometer plazos ni precios.
- Escribí todo en español de Argentina, claro y sin tecnicismos innecesarios.`

const unrow = (r) => (r && typeof r === 'object' && r.data && typeof r.data === 'object' ? { ...r.data, id: r.id } : r)

function seccion(titulo, lineas) {
  const ls = lineas.filter(Boolean)
  return ls.length ? `## ${titulo}\n${ls.join('\n')}` : ''
}

const TOPE_CONTEXTO = 36000

export function armarContexto({ project, client, plan, tasks = [], notes = [], previas = [], now = new Date() } = {}) {
  const p = unrow(project) || {}
  const c = unrow(client) || {}
  const pl = unrow(plan) || null
  const lc = normalizeLifecycle(p)
  const stage = projectStage(p)
  const pct = pl ? projectProgress(p, pl) : null
  const entry = journeyEntry(p, { planTotal: () => 0, pct: () => pct }, now)
  const stores = storesSummary(p, now)
  const up = upsellState(p)
  const stack = [
    ...(Array.isArray(p.stack) ? p.stack : typeof p.stack === 'string' ? [p.stack] : []),
    p.portafolio && p.portafolio.stack,
  ].map((s) => clip(s, 80)).filter(Boolean)
  const cuentas = (Array.isArray(p.accounts) ? p.accounts : []).map((a) => clip(a && a.label, 40)).filter(Boolean)

  const partes = [
    seccion('Proyecto', [
      `Nombre: ${clip(p.name, 120) || 'sin nombre'}`,
      (c.name || c.company) && `Cliente: ${[clip(c.name, 80), clip(c.company, 80)].filter(Boolean).join(' · ')}`,
      `Etapa: ${stageMeta(stage).label} (${stageMeta(stage).hint})`,
      entry.lane && `Tramo del recorrido: ${laneMeta(entry.lane).label}${entry.days != null ? `, hace ${entry.days} días` : ''}`,
      lc.startedAt && `Arrancó: ${dia(lc.startedAt)}`,
      pct != null && `Avance del plan: ${Math.round(pct)}%`,
      p.productionUrl && 'Ya tiene una versión en producción.',
      stores.any && `Tiendas: ${stores.active.map((s) => `${s.label} ${s.status === 'publicada' ? 'publicada' : 'en trámite'}`).join(', ')}`,
      stack.length && `Tecnología e integraciones: ${[...new Set(stack)].join(', ')}`,
      cuentas.length && `Cuentas y servicios del proyecto: ${cuentas.join(', ')}`,
    ]),
    seccion('Plata', [
      num(p.totalAmount) && `Desarrollo vendido: ${usd(p.totalAmount)}${num(p.paidAmount) ? `, pagado ${usd(p.paidAmount)}` : ''}`,
      num(lc.maintenanceAmount) && `Mantenimiento mensual cargado: ${usd(lc.maintenanceAmount)}`,
    ]),
    seccion('Qué es', [
      clip(p.portafolio && p.portafolio.queEs, 400),
      clip(p.portafolio && p.portafolio.resumen, 800),
      clip(p.kickoff, 1500),
    ]),
    seccion('Roadmap', pl ? [
      clip(pl.lead, 800),
      ...(Array.isArray(pl.hitos) ? pl.hitos : []).slice(0, 8).map((h) => h && `- Etapa: ${clip(h.title, 100)}${h.description ? ` · ${clip(h.description, 240)}` : ''}`),
      ...(Array.isArray(pl.weeks) ? pl.weeks : []).slice(0, 30).map((w) => {
        if (!w) return null
        const ts = Array.isArray(w.tasks) ? w.tasks : []
        const hechas = ts.filter((t) => t && t.done).length
        const faltan = ts.filter((t) => t && !t.done).map((t) => clip(typeof t === 'string' ? t : t.text, 140)).filter(Boolean)
        return `- Semana ${w.n}: ${clip(w.title, 100)} (${hechas}/${ts.length} hechas)${faltan.length ? ` · falta: ${faltan.slice(0, 8).join('; ')}` : ''}`
      }),
    ] : []),
    seccion('Tareas pendientes del equipo', tasks.map(unrow)
      .filter((t) => t && t.status !== 'terminado' && t.status !== 'done')
      .slice(0, 25).map((t) => `- ${clip(t.name, 160)}${t.notes ? ` · ${clip(t.notes, 200)}` : ''}`)),
    seccion('Pendiente del cliente', [
      ...(Array.isArray(p.pendingClient) ? p.pendingClient : []),
      ...(Array.isArray(p.clientTasks) ? p.clientTasks : []),
    ].slice(0, 15).map((t) => t && `- ${clip(t.title || t.text || t.name, 140)}${t.description ? ` · ${clip(t.description, 200)}` : ''}`)),
    seccion('Riesgos', (Array.isArray(p.risks) ? p.risks : []).slice(0, 10).map((r) => r && `- ${clip(r.description, 240)}`)),
    seccion('Últimos avances y comunicaciones', [...(Array.isArray(p.avances) ? p.avances : []), ...(Array.isArray(p.comms) ? p.comms : [])]
      .filter((a) => a && a.text)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 8).map((a) => `- ${dia(a.date) || ''} ${clip(a.text, 500)}`.trim())),
    seccion('Notas internas del alcance', (Array.isArray(p.scopeNotes) ? p.scopeNotes : []).slice(-10).map((n) => n && `- ${clip(n.text, 400)}`)),
    seccion('Notas del servicio (onboarding y calls)', notes
      .filter((n) => n && n.body)
      .sort((a, b) => String(b.notedAt || '').localeCompare(String(a.notedAt || '')))
      .slice(0, 15).map((n) => `- ${noteType(n.type).label}: ${clip(n.body, 1200)}`)),
    seccion('Para el closer', openCloserNotes(p).slice(0, 6).map((n) => `- ${clip(n.text, 300)}`)),
    seccion('Ya ofrecido o descartado', [
      ...['plan', 'fase2', 'nuevo', 'marketing'].map((k) => up[k] && `- ${offerLabel(k)}: ${upsellStatusMeta(up[k].status).label}${up[k].note ? ` (${clip(up[k].note, 200)})` : ''}`),
      up.objections && `- Objeciones que dio: ${clip(up.objections, 400)}`,
      ...previas.filter((o) => o && o.titulo).slice(0, 20).map((o) => `- ${clip(o.titulo, 120)}: ${o.estado === 'descartada' ? 'el equipo dijo que no va' : o.estado === 'nueva' ? 'ya está en la propuesta' : 'ya se le ofreció'}`),
    ]),
  ].filter(Boolean)

  const texto = partes.join('\n\n')
  return texto.length > TOPE_CONTEXTO ? texto.slice(0, TOPE_CONTEXTO) : texto
}

const idAzar = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function normalizeOpportunity(o) {
  const x = o && typeof o === 'object' ? o : {}
  const categoria = CATEGORIA_KEYS.includes(x.categoria) ? x.categoria : 'otro'
  return {
    ...x,
    titulo: clip(x.titulo, 120),
    porQue: clip(x.porQue, 600),
    senal: clip(x.senal, 300),
    frase: clip(x.frase, 400),
    categoria,
    tipo: tipoDeCategoria(categoria),
    montoUsd: num(x.montoUsd),
    cobro: x.cobro === 'mensual' ? 'mensual' : 'unico',
    estado: ESTADOS.includes(x.estado) ? x.estado : 'nueva',
    orden: Number.isInteger(x.orden) ? x.orden : 0,
    ofrecidaAt: x.ofrecidaAt || null,
    ofrecidaPor: x.ofrecidaPor || null,
    descartadaAt: x.descartadaAt || null,
    descartadaPor: x.descartadaPor || null,
    enPropuesta: typeof x.enPropuesta === 'boolean' ? x.enPropuesta : null,
    propuestaAt: x.propuestaAt || null,
    propuestaPor: x.propuestaPor || null,
    sf: x.sf && typeof x.sf === 'object' ? x.sf : null,
  }
}

export function leerRespuestaIA(json, { projectId, by = null, lote = null, modelo = MODELO, now = new Date(), nuevoId = idAzar } = {}) {
  const lista = json && typeof json === 'object' && Array.isArray(json.oportunidades) ? json.oportunidades : []
  const at = now.toISOString()
  return lista
    .filter((o) => o && typeof o === 'object' && clip(o.titulo, 120) && clip(o.por_que, 600))
    .slice(0, MAX_OPORTUNIDADES)
    .map((o, i) => normalizeOpportunity({
      id: nuevoId(),
      projectId,
      titulo: o.titulo,
      porQue: o.por_que,
      senal: o.senal,
      categoria: o.categoria,
      montoUsd: typeof o.monto_usd === 'number' ? o.monto_usd : null,
      cobro: o.cobro,
      frase: o.frase,
      estado: 'nueva',
      orden: i,
      lote,
      modelo,
      generadaAt: at,
      generadaPor: by,
      createdAt: at,
      updatedAt: at,
    }))
}

export function pedidoUpsell(op, responsable, finClientId = null) {
  const o = normalizeOpportunity(op)
  const nota = [
    o.porQue,
    o.senal && `Señal: ${o.senal}`,
    o.cobro === 'mensual' && 'Por mes.',
    'La propuso la IA de Proyectos.',
  ].filter(Boolean).join('\n')
  const out = {
    proyecto: o.projectId,
    oportunidad_id: o.id,
    tipo: o.tipo,
    titulo: o.titulo,
    monto_usd: o.montoUsd,
    nota,
    proximo_paso: o.frase ? `Abrir con: ${o.frase}` : null,
    responsable: clip(responsable, 80) || null,
  }
  if (Number.isInteger(finClientId) && finClientId > 0) out.fin_client_id = finClientId
  return out
}

export function vistaOportunidades(items, projectId) {
  const mias = (items || []).map(normalizeOpportunity).filter((o) => o.projectId === projectId)
  const nuevas = mias.filter((o) => o.estado === 'nueva')
    .sort((a, b) => (b.enPropuesta === true) - (a.enPropuesta === true) || a.orden - b.orden)
  const cuando = (o) => o.ofrecidaAt || o.descartadaAt || o.generadaAt || ''
  const vistas = mias.filter((o) => o.estado !== 'nueva').sort((a, b) => String(cuando(b)).localeCompare(String(cuando(a))))
  const generadaAt = mias.reduce((m, o) => (o.generadaAt && o.generadaAt > (m || '') ? o.generadaAt : m), null)
  return { nuevas, vistas, generadaAt }
}

export function marcarDescartada(op, by, now = new Date()) {
  if (!op || op.estado !== 'nueva') return op
  return { ...op, estado: 'descartada', descartadaAt: now.toISOString(), descartadaPor: by || null }
}

/* "Agregar a la propuesta" (Nacho, 17/11): las que quedan en sí sobreviven a "Volver a pensar";
 * oportunidades_reemplazar en la base aplica la misma regla que quedaAlRepensar. */
export function marcarPropuesta(op, si, by, now = new Date()) {
  if (!op || op.estado !== 'nueva') return op
  return { ...op, enPropuesta: !!si, propuestaAt: now.toISOString(), propuestaPor: by || null }
}

export const quedaAlRepensar = (o) => !!o && (o.estado !== 'nueva' || o.enPropuesta === true)

export function deshacerDescarte(op) {
  if (!op || op.estado !== 'descartada') return op
  return { ...op, estado: 'nueva', descartadaAt: null, descartadaPor: null }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * El tablero de la sección "Oportunidades": una fila por cliente con lo que se
 * le puede ofrecer. Puro, para que la vista sólo dibuje y los tests lo fijen.
 * ───────────────────────────────────────────────────────────────────────────── */

/* Un proyecto interno no es un cliente, y a un cancelado no se le ofrece nada. */
export const esVendible = (project) => {
  const p = unrow(project) || {}
  return p.kind !== 'interno' && projectStage(p) !== 'cancelado'
}

export const ESTADOS_FILA = [
  { key: 'para_ofrecer', label: 'Para ofrecer' },
  { key: 'sin_explorar', label: 'Sin explorar' },
  { key: 'al_dia', label: 'Ya decididas' },
]

const RANGO = { para_ofrecer: 0, sin_explorar: 1, al_dia: 2 }

export function filaOportunidades(project, items = [], client = null) {
  const p = unrow(project) || {}
  const c = unrow(client) || null
  const mias = (items || []).map(normalizeOpportunity).filter((o) => o.projectId === p.id)
  const ideas = mias.filter((o) => o.estado === 'nueva').sort((a, b) => a.orden - b.orden)
  const ofrecidas = mias.filter((o) => o.estado === 'ofrecida')
  const descartadas = mias.filter((o) => o.estado === 'descartada')
  const generadaAt = mias.reduce((m, o) => (o.generadaAt && o.generadaAt > (m || '') ? o.generadaAt : m), null)
  const montoUnico = ideas.filter((o) => o.cobro !== 'mensual').reduce((s, o) => s + (o.montoUsd || 0), 0)
  const montoMensual = ideas.filter((o) => o.cobro === 'mensual').reduce((s, o) => s + (o.montoUsd || 0), 0)
  const stage = projectStage(p)
  return {
    id: p.id,
    project: p,
    client: c,
    cliente: clip((c && (c.company || c.name)) || '', 80) || 'Sin cliente',
    proyecto: clip(p.name, 120) || 'Sin nombre',
    stage,
    etapa: stageMeta(stage).label,
    fase: stageMeta(stage).phase || 0,
    ideas,
    ofrecidas,
    descartadas,
    generadaAt,
    montoUnico,
    montoMensual,
    montoTop: ideas.reduce((m, o) => Math.max(m, o.montoUsd || 0), 0),
    categorias: [...new Set(ideas.map((o) => o.categoria))],
    estado: ideas.length ? 'para_ofrecer' : mias.length ? 'al_dia' : 'sin_explorar',
  }
}

/** Filas ordenadas (lo que hay para ofrecer primero, por plata) + totales de la cabecera. */
export function tableroOportunidades(items = [], projects = [], clients = []) {
  const byClient = new Map((clients || []).map((c) => { const x = unrow(c); return [x && x.id, x] }))
  const filas = (projects || [])
    .map(unrow)
    .filter((p) => p && p.id && esVendible(p))
    .map((p) => filaOportunidades(p, items, byClient.get(p.clientId) || null))
    .sort((a, b) => {
      if (RANGO[a.estado] !== RANGO[b.estado]) return RANGO[a.estado] - RANGO[b.estado]
      if (a.estado === 'para_ofrecer') {
        if (b.montoTop !== a.montoTop) return b.montoTop - a.montoTop
        if (b.ideas.length !== a.ideas.length) return b.ideas.length - a.ideas.length
      }
      if (a.estado === 'sin_explorar' && b.fase !== a.fase) return b.fase - a.fase
      if (a.estado === 'al_dia') {
        const d = String(b.generadaAt || '').localeCompare(String(a.generadaAt || ''))
        if (d) return d
      }
      return a.cliente.localeCompare(b.cliente, 'es')
    })
  const totales = filas.reduce((t, f) => ({
    proyectos: t.proyectos + 1,
    conIdeas: t.conIdeas + (f.ideas.length ? 1 : 0),
    sinExplorar: t.sinExplorar + (f.estado === 'sin_explorar' ? 1 : 0),
    ideas: t.ideas + f.ideas.length,
    ofrecidas: t.ofrecidas + f.ofrecidas.length,
    montoUnico: t.montoUnico + f.montoUnico,
    montoMensual: t.montoMensual + f.montoMensual,
  }), { proyectos: 0, conIdeas: 0, sinExplorar: 0, ideas: 0, ofrecidas: 0, montoUnico: 0, montoMensual: 0 })
  return { filas, totales }
}

/** Búsqueda por texto, pestaña y categoría. Una fila sin ideas no matchea una categoría. */
export function filtrarFilas(filas = [], { q = '', estado = 'todas', categoria = 'todas' } = {}) {
  const t = String(q || '').trim().toLowerCase()
  return filas.filter((f) => {
    if (estado !== 'todas' && f.estado !== estado) return false
    if (categoria !== 'todas' && !f.categorias.includes(categoria)) return false
    if (!t) return true
    const heno = [f.cliente, f.proyecto, f.etapa, ...f.ideas.map((o) => `${o.titulo} ${o.porQue} ${o.senal}`)].join(' ').toLowerCase()
    return heno.includes(t)
  })
}
