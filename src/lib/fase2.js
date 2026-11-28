/*
 * Sección "Fase 2" del proyecto (spec 2026-11-23-fathom-resumen-fase2-design.md): notas libres y calls
 * de Fathom analizadas por la IA, más un plan "Cómo llevarlo a Fase 2".
 *
 * Puro, sin navegador ni red y con `now` inyectable: lo usan la sección del detalle del proyecto, la
 * edge function `fase2` y los tests (tests/fase2.test.js). Sólo importa visibility.js (puro): oportunidades.js importa
 * de acá. Si cambia este archivo hay que redesplegar las funciones `fase2` y `oportunidades`.
 *
 * Al modelo no viajan mails, teléfonos, links con token, claves ni contraseñas (limpiarTexto).
 */

import { isDev } from './visibility.js'

/*
 * Quién puede ver y quién puede editar la Fase 2 (tiene lo que se habló con los clientes: plata,
 * objeciones, presupuestos). Ven los de acceso completo y los de lectura; editan sólo los de acceso
 * completo; un developer queda afuera AUNQUE tenga acceso completo. Es el mismo criterio que
 * pm_puede_ver_fase2() y pm_puede_editar_fase2() en la base (docs/migrations/2026-11-23-fase2.sql):
 * la pantalla sólo esconde la sección, el que protege los datos es la base.
 */
export const puedeVerFase2 = (m) => !!m && (m.access === 'full' || m.access === 'read') && !isDev(m)
export const puedeEditarFase2 = (m) => !!m && m.access === 'full' && !isDev(m)

export const MAX_NOTA = 8000
export const MAX_TEXTO_CALL = 120000
export const MIN_TEXTO_PEGADO = 200
export const MAX_ITEMS = 8
export const ESTADOS_CALL = ['pendiente', 'bajando', 'analizando', 'lista', 'error']

const clip = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const txt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const iso = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d.toISOString()
}
const idOk = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(s)
const idStr = (v) => (idOk(v) ? v : null)
const idLoose = (v) => (typeof v === 'string' && v ? v.slice(0, 80) : null)
const dia = (v) => { const t = iso(v); return t ? t.slice(0, 10) : null }

export const idNuevo = () => (globalThis.crypto && globalThis.crypto.randomUUID
  ? globalThis.crypto.randomUUID()
  : Math.random().toString(36).slice(2, 10) + Date.now().toString(36))

/* ─────────────────────────── Link de Fathom ─────────────────────────── */

export function resolverLink(raw) {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return { ok: false, error: 'Pegá el link de la call de Fathom.' }
  if (s.length > 500) return { ok: false, error: 'Ese link es demasiado largo.' }
  let u
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`) } catch { return { ok: false, error: 'Ese link no se entiende.' } }
  const host = u.hostname.toLowerCase()
  if (host !== 'fathom.video' && !host.endsWith('.fathom.video')) return { ok: false, error: 'Tiene que ser un link de fathom.video.' }
  const partes = u.pathname.split('/').filter(Boolean)
  const tipo = partes[0]
  if ((tipo !== 'share' && tipo !== 'calls') || partes.length < 2) {
    return { ok: false, error: 'No parece el link de una call (fathom.video/share/… o fathom.video/calls/…).' }
  }
  return { ok: true, url: `https://fathom.video/${partes.join('/')}`, tipo, clave: partes[partes.length - 1] }
}

const ultimoTramo = (u) => {
  try { const p = new URL(u).pathname.split('/').filter(Boolean); return p[p.length - 1] || '' } catch { return '' }
}

export function mismaCall(link, m) {
  if (!link || link.ok !== true || !m || typeof m !== 'object') return false
  if (ultimoTramo(m.share_url) === link.clave || ultimoTramo(m.url) === link.clave) return true
  return link.tipo === 'calls' && String(m.recording_id ?? m.id ?? '') === link.clave
}

/* ───────────────────── Limpieza antes de ir a la IA ───────────────────── */

export function limpiarTexto(texto) {
  return String(texto ?? '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[mail]')
    .replace(/https?:\/\/\S*[?&](?:token|key|secret|sig|signature|access_token|password)=\S*/gi, '[link]')
    .replace(/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{16,}\b/g, '[clave]')
    .replace(/\b(contraseña|password|clave|pass)\s*[:=]\s*\S+/gi, '$1: [oculto]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[tel]' : m))
}

/* ───────────────── Texto de una reunión de la API de Fathom ───────────────── */

export function textoDeReunion(m, { max = MAX_TEXTO_CALL } = {}) {
  const x = m && typeof m === 'object' ? m : {}
  const resumen = x.default_summary && typeof x.default_summary.markdown_formatted === 'string'
    ? x.default_summary.markdown_formatted.trim()
    : ''
  let trans = ''
  if (Array.isArray(x.transcript)) {
    trans = x.transcript.map((l) => {
      const t = l && typeof l.text === 'string' ? l.text.trim() : ''
      if (!t) return ''
      const quien = (l.speaker && (l.speaker.display_name || l.speaker.name)) || ''
      return `${l.timestamp ? `[${l.timestamp}] ` : ''}${quien ? `${quien}: ` : ''}${t}`
    }).filter(Boolean).join('\n')
  } else if (typeof x.transcript === 'string') {
    trans = x.transcript.trim()
  }
  const texto = [resumen && `# Resumen de Fathom\n${resumen}`, trans && `# Transcripción\n${trans}`].filter(Boolean).join('\n\n')
  return { texto: texto.slice(0, max), recortado: texto.length > max, tieneTranscripcion: !!trans }
}

/* ─────────────────────────── Normalizadores ─────────────────────────── */

const TIPOS_SENAL = ['presupuesto', 'urgencia', 'decisor', 'fecha', 'otra']

const itemsCT = (arr, conOportunidad) => (Array.isArray(arr) ? arr : [])
  .map((i) => {
    if (!i || typeof i !== 'object') return null
    const texto = clip(i.texto, 240)
    if (!texto) return null
    const out = { texto, cita: clip(i.cita, 280) }
    if (conOportunidad) out.oportunidadId = idStr(i.oportunidadId)
    return out
  })
  .filter(Boolean)
  .slice(0, MAX_ITEMS)

const LISTAS = ['cargar', 'mejorar', 'implementar', 'objeciones', 'senales', 'pendientes']

export function normalizarAnalisis(a, { now = new Date(), modelo = null } = {}) {
  if (!a || typeof a !== 'object') return null
  const out = {
    version: 1,
    generadaAt: iso(a.generadaAt) || iso(now),
    modelo: clip(a.modelo, 80) || modelo,
    resumen: clip(a.resumen, 900),
    cargar: itemsCT(a.cargar, false),
    mejorar: itemsCT(a.mejorar, true),
    implementar: itemsCT(a.implementar, true),
    objeciones: itemsCT(a.objeciones, false),
    senales: (Array.isArray(a.senales) ? a.senales : [])
      .map((s) => {
        if (!s || typeof s !== 'object') return null
        const texto = clip(s.texto, 240)
        if (!texto) return null
        return { tipo: TIPOS_SENAL.includes(s.tipo) ? s.tipo : 'otra', texto, cita: clip(s.cita, 280) }
      })
      .filter(Boolean)
      .slice(0, MAX_ITEMS),
    pendientes: (Array.isArray(a.pendientes) ? a.pendientes : [])
      .map((p) => {
        if (!p || typeof p !== 'object') return null
        const texto = clip(p.texto, 240)
        return texto ? { texto, quien: clip(p.quien, 80) || null } : null
      })
      .filter(Boolean)
      .slice(0, MAX_ITEMS),
  }
  return !out.resumen && !LISTAS.some((k) => out[k].length) ? null : out
}

const lista = (arr, max, f) => (Array.isArray(arr) ? arr : []).map(f).filter(Boolean).slice(0, max)

export function normalizarPlan(p, { projectId = null, basadoEn = null, now = new Date(), modelo = null } = {}) {
  if (!p || typeof p !== 'object') return null
  const proyecto = projectId || idStr(p.projectId)
  const base = Array.isArray(basadoEn) ? basadoEn : Array.isArray(p.basadoEn) ? p.basadoEn : []
  const out = {
    id: proyecto ? `plan-${proyecto}` : idStr(p.id),
    projectId: proyecto,
    generadoAt: iso(p.generadoAt) || iso(now),
    modelo: clip(p.modelo, 80) || modelo,
    basadoEn: base.filter(idOk).slice(0, 200),
    porQueAhora: clip(p.porQueAhora, 700),
    queOfrecerPrimero: lista(p.queOfrecerPrimero, 5, (i) => (i && typeof i === 'object' && clip(i.titulo, 120)
      ? { titulo: clip(i.titulo, 120), razon: clip(i.razon, 400), oportunidadId: idStr(i.oportunidadId) }
      : null)),
    comoAbrirLaCharla: clip(p.comoAbrirLaCharla, 500),
    objecionesEsperadas: lista(p.objecionesEsperadas, 6, (i) => (i && typeof i === 'object' && clip(i.objecion, 200)
      ? { objecion: clip(i.objecion, 200), respuesta: clip(i.respuesta, 400) }
      : null)),
    antesDeOfrecer: lista(p.antesDeOfrecer, 8, (s) => clip(s, 240) || null),
    momento: clip(p.momento, 300),
    riesgos: lista(p.riesgos, 6, (s) => clip(s, 240) || null),
  }
  return out.porQueAhora || out.queOfrecerPrimero.length ? out : null
}

export function normalizarEntrada(e, { now = new Date() } = {}) {
  if (!e || typeof e !== 'object') return null
  const kind = ['nota', 'call', 'plan', 'tablero', 'propuesta'].includes(e.kind) ? e.kind : null
  if (!kind) return null
  const at = iso(e.at)
  const base = {
    id: idStr(e.id), projectId: idStr(e.projectId), kind, at, by: idLoose(e.by),
    updatedAt: iso(e.updatedAt) || at, deletedAt: iso(e.deletedAt),
  }
  if (kind === 'tablero') return base.projectId ? base : null
  if (kind === 'propuesta') return base.projectId ? { ...base, ...normalizarPropuesta(e), id: base.id, projectId: base.projectId, kind } : null
  if (kind === 'nota') {
    const text = txt(e.text, MAX_NOTA)
    return text ? { ...base, text } : null
  }
  if (kind === 'call') {
    return {
      ...base,
      link: clip(e.link, 500),
      fathomId: idLoose(e.fathomId),
      titulo: clip(e.titulo, 160) || null,
      origen: e.origen === 'texto' ? 'texto' : 'fathom',
      texto: txt(e.texto, MAX_TEXTO_CALL),
      estado: ESTADOS_CALL.includes(e.estado) ? e.estado : 'pendiente',
      error: clip(e.error, 300) || null,
      analisis: normalizarAnalisis(e.analisis, { now }),
    }
  }
  const plan = normalizarPlan(e, { projectId: base.projectId, now })
  return plan ? { ...base, ...plan, kind: 'plan' } : null
}

/* Para el store por fila: `normalize` nunca puede devolver null. Lo que no se entiende queda como
 * una nota vacía, que las vistas descartan. */
export function normalizarEntradaStore(e) {
  return normalizarEntrada(e) || {
    id: idStr(e && e.id), projectId: idStr(e && e.projectId), kind: 'nota', text: '',
    at: iso(e && e.at), by: null, updatedAt: iso(e && e.updatedAt), deletedAt: iso(e && e.deletedAt),
  }
}

/* ───────────────────── Esquemas de respuesta de la IA ───────────────────── */

const ITEM_CT = {
  type: 'object',
  additionalProperties: false,
  required: ['texto', 'cita'],
  properties: {
    texto: { type: 'string', description: 'Qué es, en una oración concreta (hasta 240 caracteres).' },
    cita: { type: 'string', description: 'Frase corta del cliente que lo sostiene, en español. Vacía si no hay una clara.' },
  },
}

export const ESQUEMA_CALL = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen', 'cargar', 'mejorar', 'implementar', 'objeciones', 'senales', 'pendientes'],
  properties: {
    resumen: { type: 'string', description: 'La llamada en 3 a 5 oraciones, lo importante para el negocio.' },
    cargar: { type: 'array', items: ITEM_CT },
    mejorar: { type: 'array', items: ITEM_CT },
    implementar: { type: 'array', items: ITEM_CT },
    objeciones: { type: 'array', items: ITEM_CT },
    senales: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'texto', 'cita'],
        properties: {
          tipo: { type: 'string', enum: TIPOS_SENAL },
          texto: { type: 'string' },
          cita: { type: 'string' },
        },
      },
    },
    pendientes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['texto', 'quien'],
        properties: {
          texto: { type: 'string' },
          quien: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Quién se comprometió, o null.' },
        },
      },
    },
  },
}

export const ESQUEMA_PLAN = {
  type: 'object',
  additionalProperties: false,
  required: ['porQueAhora', 'queOfrecerPrimero', 'comoAbrirLaCharla', 'objecionesEsperadas', 'antesDeOfrecer', 'momento', 'riesgos'],
  properties: {
    porQueAhora: { type: 'string', description: 'Por qué este cliente está listo para una Fase 2 ahora, en 2 o 3 oraciones.' },
    queOfrecerPrimero: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'razon'],
        properties: {
          titulo: { type: 'string', description: 'Qué se ofrece, en pocas palabras (hasta 70 caracteres).' },
          razon: { type: 'string', description: 'Por qué va primero, apoyado en lo que dijo el cliente.' },
        },
      },
    },
    comoAbrirLaCharla: { type: 'string', description: 'Cómo abrir la conversación, en 2 o 3 oraciones, rioplatense y cálido.' },
    objecionesEsperadas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['objecion', 'respuesta'],
        properties: { objecion: { type: 'string' }, respuesta: { type: 'string' } },
      },
    },
    antesDeOfrecer: { type: 'array', items: { type: 'string' }, description: 'Qué falta saber o cargar antes de ofrecer.' },
    momento: { type: 'string', description: 'Cuándo conviene ofrecerlo y por qué.' },
    riesgos: { type: 'array', items: { type: 'string' } },
  },
}

/* ─────────────────────────────── Prompts ─────────────────────────────── */

export const SISTEMA_CALL = `Sos parte del equipo de Insights, una agencia que construye apps y sistemas a medida para dueños de negocio. Te pasamos una llamada con un cliente que ya nos compró (el resumen de Fathom y, si hay, la transcripción) y lo que sabemos de su proyecto. Tu trabajo es bajarla a tierra: qué se dijo y qué podemos hacer con eso para una Fase 2.

Cómo hacerlo:
- resumen: la llamada en 3 a 5 oraciones, lo que importa para el negocio.
- cargar: datos o contenido que el cliente tiene que darnos, o que falta cargar en el proyecto, para poder avanzar (textos, fotos, accesos, listados).
- mejorar: algo que ya existe en el producto y se puede pulir o ampliar según lo que dijo.
- implementar: cosas nuevas que pidió o que la charla deja a la vista, y que serían una Fase 2.
- objeciones: dudas, frenos o reparos que mostró (plata, tiempo, confianza, prioridad).
- senales: señales de compra (presupuesto, urgencia, quién decide, fechas). tipo es uno de: presupuesto, urgencia, decisor, fecha, otra.
- pendientes: compromisos que quedaron de la call, de ellos o nuestros. quien es el nombre o null.
- cita: una frase del cliente, corta, que sostiene el ítem. Si no hay una frase clara, dejala vacía. No inventes citas.
- Todo sale de lo que se dijo. Si algo no está en la llamada, no lo propongas. Si una lista no tiene nada, devolvela vacía.
- No repitas lo que el proyecto ya tiene hecho.
- Escribí en español de Argentina, claro y sin tecnicismos, aunque la llamada sea en inglés: las citas van traducidas.
- Ignorá los datos marcados como [mail], [tel], [link] o [clave].`

export const SISTEMA_PLAN = `Sos parte del equipo de Insights, una agencia que construye apps y sistemas a medida para dueños de negocio. Te pasamos todo lo que sabemos de un proyecto de un cliente que ya nos compró, incluyendo las calls y las notas de Fase 2 (sección "Fase 2: calls y notas con el cliente"). Tenés que armar el plan para llevar ese proyecto a una Fase 2 de la manera más efectiva.

Cómo pensarlo:
- porQueAhora: por qué este cliente está listo ahora, apoyado en datos concretos de las calls y del proyecto.
- queOfrecerPrimero: de 1 a 4 cosas, en orden. Cada una sale de algo que el cliente dijo o que el proyecto deja a la vista. Si no hay un dato que la sostenga, no la propongas. Solo mejoras para una Fase 2 de lo que ya construimos: nada de planes de mantenimiento, marketing, ciberseguridad ni sistemas nuevos.
- comoAbrirLaCharla: cómo abrir la conversación con él, rioplatense, cálido, corto, sin signos de apertura (nada de ¿ ni ¡), sin sonar a vendedor y sin prometer plazos ni precios.
- objecionesEsperadas: las que ya mostró o las que se ven venir, cada una con una respuesta honesta.
- antesDeOfrecer: lo que falta saber o cargar antes de ofrecer.
- momento: cuándo conviene ofrecerlo y por qué.
- riesgos: lo que puede hacer que se enfríe o se pierda.
- No repitas lo que ya se le ofreció ni lo que el equipo descartó: está en la sección "Ya ofrecido o descartado".
- Escribí todo en español de Argentina, claro y sin tecnicismos innecesarios.`

/* ───────────────────────────── Entradas nuevas ───────────────────────────── */

export function nuevaNota({ projectId, text, by = null, now = new Date(), nuevoId = idNuevo } = {}) {
  const at = iso(now)
  return { id: nuevoId(), projectId, kind: 'nota', text: txt(text, MAX_NOTA), at, by: idLoose(by), updatedAt: at, deletedAt: null }
}

export function nuevaCall({ projectId, link = '', texto = '', by = null, now = new Date(), nuevoId = idNuevo } = {}) {
  const at = iso(now)
  const pegada = txt(texto, MAX_TEXTO_CALL)
  return {
    id: nuevoId(), projectId, kind: 'call', at, by: idLoose(by), updatedAt: at, deletedAt: null,
    link: pegada ? '' : clip(link, 500), fathomId: null, titulo: null,
    origen: pegada ? 'texto' : 'fathom', texto: pegada,
    estado: pegada ? 'analizando' : 'bajando', error: null, analisis: null,
  }
}

export function marcarBorrada(e, now = new Date()) {
  const t = iso(now)
  return { ...e, deletedAt: t, updatedAt: t }
}

/* Deja anotado en el ítem qué oportunidad nació de él. No pisa un vínculo ya hecho. */
export function vincularItem(entrada, lista, indice, oportunidadId) {
  if (!entrada || !idOk(oportunidadId)) return entrada
  const poner = (arr) => (Array.isArray(arr)
    ? arr.map((it, i) => (i === indice && it && !it.oportunidadId ? { ...it, oportunidadId } : it))
    : arr)
  if (entrada.kind === 'call' && entrada.analisis && (lista === 'mejorar' || lista === 'implementar')) {
    return { ...entrada, analisis: { ...entrada.analisis, [lista]: poner(entrada.analisis[lista]) } }
  }
  if (entrada.kind === 'plan' && lista === 'queOfrecerPrimero') return { ...entrada, queOfrecerPrimero: poner(entrada.queOfrecerPrimero) }
  return entrada
}

/* ───────────────────────── Ítem → oportunidad ───────────────────────── */

const tituloDe = (s) => {
  const t = clip(s, 240)
  const corte = t.search(/[.;:]\s/)
  const p = corte > 20 ? t.slice(0, corte) : t
  return p.length > 90 ? `${p.slice(0, 87).trimEnd()}…` : p
}

/* Devuelve la oportunidad cruda: quien la guarda la pasa por normalizeOpportunity (el store ya lo hace). */
export function itemAOportunidad(item, { projectId, by = null, now = new Date(), nuevoId = idNuevo, frase = '' } = {}) {
  const x = item && typeof item === 'object' ? item : {}
  const at = iso(now)
  return {
    id: nuevoId(),
    projectId,
    titulo: tituloDe(x.titulo || x.texto),
    porQue: clip(x.razon || x.texto, 600),
    senal: clip(x.cita, 300) || 'Salió de lo que hablaron en las calls de Fase 2',
    frase: clip(frase, 400),
    categoria: 'mejora',
    montoUsd: null,
    cobro: 'unico',
    estado: 'nueva',
    orden: 0,
    lote: 'fase2',
    modelo: null,
    generadaAt: at,
    generadaPor: idLoose(by),
    createdAt: at,
    updatedAt: at,
  }
}

const llave = (s) => clip(s, 200).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

export function hayParecida(titulo, previas = []) {
  const a = llave(titulo)
  if (!a) return false
  return (previas || []).some((o) => {
    const b = llave(o && o.titulo)
    return !!b && (a === b || (Math.min(a.length, b.length) >= 12 && (a.includes(b) || b.includes(a))))
  })
}

/* ─────────────────────────────── Vistas ─────────────────────────────── */

export const entradasParaPlan = (entradas) => (entradas || [])
  .filter((e) => e && !e.deletedAt && ((e.kind === 'nota' && e.text) || (e.kind === 'call' && e.analisis)))

const masNueva = (a, b) => String(b.at || b.updatedAt || '').localeCompare(String(a.at || a.updatedAt || ''))

export function vistaFase2(items, projectId) {
  const mias = (items || []).map(normalizarEntradaStore).filter((e) => e.projectId === projectId && !e.deletedAt)
  const plan = mias.find((e) => e.kind === 'plan') || null
  const entradas = mias.filter((e) => (e.kind === 'nota' && e.text) || e.kind === 'call').sort(masNueva)
  const elegibles = entradasParaPlan(mias)
  let planDesactualizado = false
  if (plan) {
    const ids = new Set(elegibles.map((e) => e.id))
    planDesactualizado = elegibles.some((e) => !plan.basadoEn.includes(e.id)
      || (e.kind === 'call' && String(e.analisis.generadaAt || '') > String(plan.generadoAt || '')))
      || plan.basadoEn.some((id) => !ids.has(id))
  }
  return { plan, entradas, elegibles: elegibles.length, planDesactualizado }
}

/* Las líneas que `armarContexto` agrega al pedido de oportunidades: el plan, las últimas calls ya
 * analizadas y las notas. Nunca la transcripción cruda. Con tope de caracteres. */
export function lineasFase2(items, { tope = 7000 } = {}) {
  const mias = (items || []).map(normalizarEntradaStore).filter((e) => !e.deletedAt)
  const plan = mias.find((e) => e.kind === 'plan')
  const calls = mias.filter((e) => e.kind === 'call' && e.analisis).sort(masNueva).slice(0, 6)
  const notas = mias.filter((e) => e.kind === 'nota' && e.text).sort(masNueva).slice(0, 8)
  const L = []
  if (plan) {
    L.push(`- Plan de Fase 2 (${dia(plan.generadoAt) || 's/f'}): ${plan.porQueAhora}`)
    if (plan.queOfrecerPrimero.length) L.push(`  Ofrecer primero: ${plan.queOfrecerPrimero.map((i) => i.titulo).join('; ')}`)
    if (plan.objecionesEsperadas.length) L.push(`  Objeciones esperadas: ${plan.objecionesEsperadas.map((i) => i.objecion).join('; ')}`)
  }
  const fila = (rotulo, arr, n) => {
    if (arr.length) L.push(`  ${rotulo}: ${arr.slice(0, n).map((i) => (i.cita ? `${i.texto} ("${i.cita}")` : i.texto)).join('; ')}`)
  }
  for (const c of calls) {
    const a = c.analisis
    L.push(`- Call del ${dia(c.at) || 's/f'}${c.titulo ? ` (${c.titulo})` : ''}: ${a.resumen}`)
    fila('Para implementar', a.implementar, 4)
    fila('Para mejorar', a.mejorar, 3)
    fila('Objeciones', a.objeciones, 3)
    fila('Señales', a.senales, 3)
  }
  for (const n of notas) L.push(`- Nota de Fase 2 (${dia(n.at) || 's/f'}): ${clip(n.text, 600)}`)
  const out = []
  let usado = 0
  for (const l of L) {
    if (usado + l.length + 1 > tope) break
    out.push(l)
    usado += l.length + 1
  }
  return out
}

/* ─────────────────────── Calls que se quedaron trabadas ─────────────────────── */

/* La función analiza en segundo plano y avisa del error a los ~5,5 minutos como mucho. Si pasó más que
 * esto sin que la fila se mueva (cada escritura de la función sube updatedAt), la call se trabó. */
export const MAX_ESPERA_CALL_MS = 6 * 60 * 1000

export function llamadaTrabada(e, now = new Date(), max = MAX_ESPERA_CALL_MS) {
  if (!e || e.kind !== 'call' || (e.estado !== 'bajando' && e.estado !== 'analizando')) return false
  const t = Date.parse(e.updatedAt || e.at || '')
  return Number.isFinite(t) && now.getTime() - t > max
}

/* ═════════════════════ Tablero "Fase 2" (menú, 2026-11-28) ═════════════════════
 * Nacho elige proyectos, les carga una o varias calls de Fathom y la IA arma una propuesta corta:
 * lo que hablaron, qué le podemos vender y cuánto sale. Reusa project_fase2 con dos tipos más:
 * 'tablero' (el proyecto está en el tablero; se saca con deletedAt) y 'propuesta' (una por proyecto).
 */

export const idTablero = (projectId) => `tablero-${projectId}`
export const idPropuesta = (projectId) => `propuesta-${projectId}`
export const ESTADOS_PROPUESTA = ['armando', 'lista', 'error']
export const MAX_ITEMS_PROPUESTA = 5

export function nuevoTablero({ projectId, by = null, now = new Date() } = {}) {
  const at = iso(now)
  return { id: idTablero(projectId), projectId, kind: 'tablero', at, by: idLoose(by), updatedAt: at, deletedAt: null }
}

/* Los proyectos del tablero, en el orden en que se sumaron. */
export function proyectosDelTablero(items) {
  return (items || []).map(normalizarEntradaStore)
    .filter((e) => e.kind === 'tablero' && !e.deletedAt && e.projectId)
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
    .map((e) => e.projectId)
}

const entero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null)
const hashId = (s) => `i${Math.abs([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`

export function normalizarPropuesta(p) {
  const x = p && typeof p === 'object' ? p : {}
  const items = lista(x.queVender, MAX_ITEMS_PROPUESTA, (i) => {
    if (!i || typeof i !== 'object' || !clip(i.titulo, 90)) return null
    const titulo = clip(i.titulo, 90)
    return {
      id: idStr(i.id) || hashId(titulo),
      titulo,
      porQue: clip(i.porQue, 300),
      cita: clip(i.cita, 280),
      incluye: lista(i.incluye, 5, (s) => clip(s, 160) || null),
      precioUsd: entero(i.precioUsd),
      cobro: i.cobro === 'mensual' ? 'mensual' : 'unico',
      semanas: entero(i.semanas),
      editado: i.editado === true,
      quitado: i.quitado === true,
    }
  })
  return {
    estado: ESTADOS_PROPUESTA.includes(x.estado) ? x.estado : (items.length ? 'lista' : 'armando'),
    error: clip(x.error, 300) || null,
    pedidoAt: iso(x.pedidoAt),
    generadoAt: iso(x.generadoAt),
    modelo: clip(x.modelo, 80) || null,
    basadoEn: (Array.isArray(x.basadoEn) ? x.basadoEn : []).filter(idOk).slice(0, 50),
    loQueHablaron: lista(x.loQueHablaron, 6, (s) => clip(s, 260) || null),
    queVender: items,
    siguientePaso: clip(x.siguientePaso, 320),
  }
}

/* Lo que se cotiza: los ítems no quitados, sumados por tipo de cobro. */
export function totalesPropuesta(p) {
  const its = (p && Array.isArray(p.queVender) ? p.queVender : []).filter((i) => !i.quitado)
  const sum = (f) => its.filter(f).reduce((s, i) => s + (i.precioUsd || 0), 0)
  return { unico: sum((i) => i.cobro !== 'mensual'), mensual: sum((i) => i.cobro === 'mensual'), items: its.length, sinPrecio: its.filter((i) => !i.precioUsd).length }
}

export const usd = (n) => `USD ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`

/* Texto listo para pegar (WhatsApp, un doc) con la propuesta. */
export function propuestaComoTexto(p, nombre = '') {
  if (!p) return ''
  const t = totalesPropuesta(p)
  const L = []
  if (nombre) L.push(`Fase 2 · ${nombre}`, '')
  if (p.loQueHablaron.length) L.push('Lo que hablamos:', ...p.loQueHablaron.map((s) => `- ${s}`), '')
  const its = p.queVender.filter((i) => !i.quitado)
  if (its.length) {
    L.push('Lo que proponemos:')
    for (const i of its) L.push(`- ${i.titulo}${i.precioUsd ? `: ${usd(i.precioUsd)}${i.cobro === 'mensual' ? ' por mes' : ''}` : ''}`)
    const partes = [t.unico && usd(t.unico), t.mensual && `${usd(t.mensual)} por mes`].filter(Boolean)
    if (partes.length) L.push('', `Total: ${partes.join(' + ')}`)
  }
  return L.join('\n').trim()
}

/* Las calls del proyecto (las del tablero y las de la sección del detalle son las mismas filas). */
export function vistaTablero(items, projectId, now = new Date()) {
  const mias = (items || []).map(normalizarEntradaStore).filter((e) => e.projectId === projectId && !e.deletedAt)
  const calls = mias.filter((e) => e.kind === 'call').sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
  const propuesta = mias.find((e) => e.kind === 'propuesta') || null
  const bajando = calls.filter((c) => (c.estado === 'bajando' || c.estado === 'analizando') && !c.texto && !llamadaTrabada(c, now))
  const conTexto = calls.filter((c) => !!c.texto)
  const desactualizada = !!propuesta && propuesta.estado === 'lista'
    && (conTexto.some((c) => !propuesta.basadoEn.includes(c.id)) || propuesta.basadoEn.some((id) => !conTexto.some((c) => c.id === id)))
  const t = Date.parse((propuesta && (propuesta.updatedAt || propuesta.pedidoAt)) || '')
  const armando = !!propuesta && propuesta.estado === 'armando' && !(Number.isFinite(t) && now.getTime() - t > MAX_ESPERA_CALL_MS)
  const trabada = !!propuesta && propuesta.estado === 'armando' && !armando
  return { calls, conTexto, bajando, propuesta, desactualizada, armando, trabada }
}

/* ─────────────────────── Links de Fathom que ya tenemos ─────────────────────── */

const LINK_FATHOM_RE = /https?:\/\/(?:www\.)?fathom\.video\/(?:share|calls)\/[A-Za-z0-9_/-]+/g

export function linksDeFathom(texto) {
  const out = []
  for (const m of String(texto ?? '').matchAll(LINK_FATHOM_RE)) {
    const r = resolverLink(m[0])
    if (r.ok && !out.includes(r.url)) out.push(r.url)
  }
  return out
}

/* Links de Fathom dentro de los datos del proyecto (avances, notas, comunicaciones…), con el texto y
 * la fecha del objeto que los tiene, para mostrarlos con nombre. */
function linksEnObjeto(raiz) {
  const out = []
  const ver = (v, padre, prof) => {
    if (prof > 6 || v == null) return
    if (typeof v === 'string') {
      for (const url of linksDeFathom(v)) {
        const p = padre && typeof padre === 'object' && !Array.isArray(padre) ? padre : {}
        const rotulo = [p.title, p.titulo, p.name, p.label, p.text, p.body].find((s) => typeof s === 'string' && s.trim() && !s.includes('fathom.video'))
        out.push({ url, titulo: clip(rotulo, 80) || null, at: iso(p.date || p.at || p.notedAt || p.createdAt) })
      }
      return
    }
    if (Array.isArray(v)) { for (const x of v.slice(0, 400)) ver(x, padre, prof + 1); return }
    if (typeof v === 'object') for (const k of Object.keys(v)) ver(v[k], v, prof + 1)
  }
  ver(raiz, null, 0)
  return out
}

/* Las calls de Fathom ya vinculadas a este proyecto que todavía no se cargaron: de las calls de la
 * app, de las sincronizadas de Fathom y de los datos del proyecto. */
export function sugerenciasFathom({ project, calls = [], fathomCalls = [], cargadas = [] } = {}) {
  if (!project) return []
  const ya = new Set((cargadas || []).map((c) => { const r = resolverLink(c && c.link); return r.ok ? r.clave : null }).filter(Boolean))
  const out = new Map()
  const sumar = (url, titulo, at, origen) => {
    const r = resolverLink(url)
    if (!r.ok || ya.has(r.clave)) return
    const previa = out.get(r.clave)
    if (previa) { previa.titulo = previa.titulo || clip(titulo, 80) || null; previa.at = previa.at || iso(at); return }
    out.set(r.clave, { url: r.url, clave: r.clave, titulo: clip(titulo, 80) || null, at: iso(at), origen })
  }
  for (const c of calls || []) {
    if (!c || c.projectId !== project.id) continue
    for (const url of linksDeFathom(c.url || c.link || '')) sumar(url, c.name || c.title, c.date, 'calls')
  }
  for (const f of fathomCalls || []) {
    if (!f || (f.project_id !== project.id && !(project.clientId && f.client_id === project.clientId))) continue
    sumar(f.share_url, f.title, f.call_date, 'fathom')
  }
  for (const l of linksEnObjeto(project)) sumar(l.url, l.titulo, l.at, 'proyecto')
  return [...out.values()].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
}

/* Los links que alguien pegó (uno por línea, o separados por espacios o comas). */
export function linksPegados(texto) {
  const partes = String(texto ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
  const ok = []
  const malos = []
  for (const p of partes) {
    const r = resolverLink(p)
    if (r.ok) { if (!ok.some((x) => x.clave === r.clave)) ok.push(r) } else malos.push(p)
  }
  return { ok, malos }
}

/* ─────────────────── El link público de Fathom (sin cuenta) ───────────────────
 * fathom.video/share/<token> abre la call para cualquiera que tenga el link. La página trae en
 * `data-page` el id de la call y la URL de "copiar transcripción", que devuelve la transcripción en
 * HTML. Es lo que salva las calls de cuentas de Fathom que no están en fathom_accounts (las de Nacho:
 * el 28/11 la tabla estaba vacía y toda call fallaba con "No encontré esa call").
 */

const desHtml = (s) => String(s ?? '')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')

export function datosDeShare(html) {
  const m = String(html ?? '').match(/data-page="([^"]+)"/)
  if (!m) return null
  let j
  try { j = JSON.parse(desHtml(m[1])) } catch { return null }
  const p = j && j.props ? j.props : {}
  const c = p.call || {}
  let copiarUrl = null
  try { const u = new URL(String(p.copyTranscriptUrl || '')); if (u.protocol === 'https:' && u.hostname === 'fathom.video') copiarUrl = u.toString() } catch { /* sin link */ }
  return {
    callId: c.id != null ? String(c.id).slice(0, 40) : null,
    titulo: clip(c.title || c.topic, 160) || null,
    at: iso((c.recording && c.recording.started_at) || c.started_at),
    copiarUrl,
  }
}

/* El HTML de "copiar transcripción" → "[0:15] Nacho: Hola…", una línea por intervención. */
export function textoDeTranscripcionCopiada(html, { max = MAX_TEXTO_CALL } = {}) {
  const plano = String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  const lineas = desHtml(plano).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out = []
  let quien = ''
  let cuando = ''
  for (const l of lineas) {
    const cab = l.match(/^@(\d{1,2}(?::\d{2}){1,2})\s*-\s*(.+)$/)
    if (cab) { cuando = cab[1]; quien = cab[2].replace(/\s*\([^)]*\)\s*$/, '').trim(); continue }
    if (/^VIEW RECORDING/i.test(l)) continue
    out.push(quien ? `[${cuando}] ${quien}: ${l}` : l)
  }
  return out.join('\n').slice(0, max)
}

/* ─────────────────────────── La propuesta de la IA ─────────────────────────── */

export const MAX_TEXTO_CALL_PROPUESTA = 45000
export const MAX_TEXTO_PROPUESTA = 140000

export function textoDeCallsParaPropuesta(calls) {
  const L = []
  let usado = 0
  const orden = (calls || []).filter((x) => x && x.texto).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
  for (const c of orden) {
    const bloque = `### Call del ${dia(c.at) || 's/f'}${c.titulo ? ` · ${c.titulo}` : ''}\n${limpiarTexto(c.texto).slice(0, MAX_TEXTO_CALL_PROPUESTA)}`
    if (usado + bloque.length > MAX_TEXTO_PROPUESTA) break
    L.push(bloque)
    usado += bloque.length
  }
  return L.join('\n\n')
}

export const ESQUEMA_PROPUESTA = {
  type: 'object',
  additionalProperties: false,
  required: ['loQueHablaron', 'queVender', 'siguientePaso'],
  properties: {
    loQueHablaron: { type: 'array', items: { type: 'string' }, description: 'De 3 a 4 frases de hasta 16 palabras: lo importante que se habló.' },
    queVender: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'porQue', 'cita', 'incluye', 'precioUsd', 'cobro', 'semanas'],
        properties: {
          titulo: { type: 'string', description: 'Qué se le vende, en pocas palabras (hasta 60 caracteres).' },
          porQue: { type: 'string', description: 'Por qué lo necesita, en una oración, con lo que dijo.' },
          cita: { type: 'string', description: 'Frase corta del cliente que lo sostiene, traducida al español. Vacía si no hay.' },
          incluye: { type: 'array', items: { type: 'string' }, description: 'De 2 a 4 cosas concretas que incluye.' },
          precioUsd: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Lo que cobraríamos, en dólares.' },
          cobro: { type: 'string', enum: ['unico', 'mensual'] },
          semanas: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Cuántas semanas lleva hacerlo.' },
        },
      },
    },
    siguientePaso: { type: 'string', description: 'Qué hacer en la próxima llamada con el cliente, en una oración.' },
  },
}

export const SISTEMA_PROPUESTA = `Sos parte del equipo de Insights, una agencia que construye apps y sistemas a medida para dueños de negocio. Nacho, que vende, tuvo una o varias llamadas con un cliente y quiere saber qué le puede vender como Fase 2 y cuánto cobrarlo, para mostrárselo en la próxima llamada. Te pasamos lo que sabemos del proyecto y las llamadas (transcripción y, si hay, el resumen de Fathom).

Lo que devolvés es corto y concreto. Nacho no quiere un informe: quiere saber qué venderle.
- loQueHablaron: de 3 a 4 frases de hasta 16 palabras cada una, con lo importante que salió de las llamadas (qué le duele, qué quiere, qué decidió). Sin relleno ni detalles que no cambian la venta.
- queVender: de 1 a 4 cosas, de la más fuerte a la menos. Cada una sale de algo que el cliente dijo en las llamadas; si no hay un dato que la sostenga, no la propongas. Nada de marketing ni de ciberseguridad: solo lo que le podemos construir o mejorar. Un plan mensual de soporte solo si él lo pidió o lo dejó a la vista.
  - titulo: pocas palabras, que se entienda sin leer el resto ("Cobro con tarjeta dentro de la app").
  - porQue: una oración de hasta 20 palabras, con sus palabras.
  - cita: una frase suya que lo sostiene. No inventes citas: si no hay una clara, vacía.
  - incluye: de 2 a 4 cosas concretas que se entregan.
  - precioUsd: lo que cobraríamos. Tomá como base lo que el cliente ya pagó por el desarrollo (sección Plata) y el tamaño del trabajo. Referencias de lo que Insights viene cotizando: un ajuste chico USD 500 a 1.200, una función nueva USD 1.500 a 3.500, un módulo grande USD 3.500 a 8.000, una app aparte USD 15.000 o más, un plan mensual de soporte USD 400 a 600 por mes. Números redondos. Si dijo un presupuesto, respetalo.
  - cobro: "mensual" solo para algo que se paga todos los meses; si no, "unico".
  - semanas: cuánto lleva hacerlo, entero.
- siguientePaso: qué hacer en la próxima llamada, en una oración de hasta 25 palabras.
- No repitas lo que el proyecto ya tiene hecho ni lo que ya se le ofreció o el equipo descartó (sección "Ya ofrecido o descartado").
- Todo en español de Argentina, claro, sin tecnicismos, aunque las llamadas sean en inglés.
- Ignorá los datos marcados como [mail], [tel], [link] o [clave].`

/* Lo que devolvió la IA → los campos de una propuesta lista. Null si no trae nada. */
export function propuestaDeIA(datos, { basadoEn = [], now = new Date(), modelo = null, nuevoId = idNuevo } = {}) {
  const d = datos && typeof datos === 'object' ? datos : {}
  const p = normalizarPropuesta({
    ...d,
    estado: 'lista',
    queVender: (Array.isArray(d.queVender) ? d.queVender : []).map((i) => (i && typeof i === 'object' ? { ...i, id: String(nuevoId()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) } : i)),
    generadoAt: now,
    modelo,
    basadoEn,
  })
  return p.queVender.length || p.loQueHablaron.length ? { ...p, error: null } : null
}
