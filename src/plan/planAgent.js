/**
 * planAgent.js — el cerebro del "Agente" del Generador de Planes.
 *
 * Alguien pega texto libre (en criollo, desordenado, como sale de una llamada) y/o
 * carga los datos que la app ya tiene de un proyecto, y de acá sale un plan de
 * ejecución completo: etapas + semanas + tareas + entregables, listo para
 * guardarse en el modelo real y publicarse como página del cliente.
 *
 * JS PURO. Cero React, cero JSX, cero dependencias nuevas. Igual que planModel.js,
 * se tiene que poder importar con `node` a secas — por eso toda lectura de
 * `import.meta.env` y de `localStorage` pasa por un guard (ver envVar/getApiKey).
 *
 * El flujo tiene TRES fases, y son tres a propósito:
 *
 *   1. runBrief   → el agente lee el contexto y devuelve QUÉ ENTENDIÓ.
 *                   El equipo lo corrige ANTES de que se genere una sola semana.
 *                   Es la fase que evita el plan lindo pero equivocado.
 *   2. runPlan    → recién ahí genera el plan. Emite drafts parciales a medida
 *                   que cierra cada etapa/semana (de ahí la animación de "las
 *                   semanas van apareciendo").
 *   3. runRefine  → "sacale la semana 7", "hacelo de 10 semanas", "más detalle en
 *                   el módulo de pagos". Devuelve el plan entero de nuevo.
 *
 * Fronteras que este módulo NO cruza:
 *   · El agente NUNCA elige colores ni íconos: eso lo deriva normalizeStages().
 *   · El agente NUNCA arma el objeto plan final: eso lo hace planFromDraft(),
 *     que reusa newPlan/emptyWeek/normalizeTasks para que el resultado sea
 *     indistinguible de un plan hecho a mano en el editor.
 *   · El agente NUNCA inventa datos. Lo que no está en el contexto va a
 *     "supuestos" o "preguntas" del brief, no adentro del plan.
 *
 * El formato intermedio se llama Draft y es DELIBERADAMENTE chico:
 *
 *   {
 *     title, subtitle, clientName, lead, metaLine,
 *     stages: [{ title, description, weekTo }],
 *     weeks:  [{ n, title, type, tasks: [{ text, detalle, responsable?, criterio? }],
 *                deliver: { kind, text } }]
 *   }
 *
 * Todo lo derivable (colores, rangos, labels, ids, secciones, footer) lo calcula
 * planFromDraft. Cuanto menos tiene que escribir el modelo, menos se equivoca y
 * más rápido llega el primer token a la pantalla.
 */

import { stageMeta, projectStage } from '../lib/stages.js'
import {
  newPlan,
  normalizeStages,
  normalizeTasks,
  emptyWeek,
  slugify,
  suggestStats,
  clampWeekCount,
  MAX_WEEKS,
  WEEK_TYPES,
  DELIVER_KINDS,
  SLUG_RE,
} from './planModel.js'

// ─────────────────────────────────────────────────────────────────────────────
// Modelos y entorno
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los dos modelos que ofrece la UI. 'fast' es el default de todos los días;
 * 'max' es para cuando el contexto es largo o el plan es caro de equivocar.
 * Contrato congelado con la UI: no renombrar las claves.
 */
export const AGENT_MODELS = { fast: 'claude-sonnet-5', max: 'claude-opus-5' }

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** Tope de contexto que le mandamos al modelo. Arriba de esto se recorta con aviso. */
const MAX_CONTEXT_CHARS = 120000

/**
 * Lectura de variables de entorno a prueba de `node`.
 *
 * Vite reemplaza `import.meta.env` por un objeto literal en build time, así que
 * en el browser esto devuelve los valores reales. Corriendo el archivo con node
 * pelado, `import.meta.env` es undefined y sin este guard el módulo ni se
 * importa — y este archivo se verifica con node (no hay test runner).
 */
function envVar(name) {
  let env = null
  try { env = import.meta.env } catch (_) { env = null }
  if (!env || typeof env !== 'object') return ''
  const v = env[name]
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * La clave de Anthropic del usuario. Misma convención que el chat de la app
 * (src/InsightsApp.jsx): la clave propia cargada en ⚙ Ajustes tiene prioridad
 * sobre la global del deploy. Devuelve null si no hay ninguna.
 */
export function getApiKey() {
  let k = ''
  try {
    if (typeof localStorage !== 'undefined' && localStorage) k = localStorage.getItem('anthropic_key') || ''
  } catch (_) { k = '' }              // Safari en modo privado tira al leer localStorage
  if (!k) k = envVar('VITE_ANTHROPIC_API_KEY')
  k = String(k || '').trim()
  return k || null
}

/** ¿Se puede usar el agente sin pedirle nada al usuario? */
export function hasApiKey() { return !!getApiKey() }

/**
 * Fallback: la Edge Function `plan-agent` de Supabase, que proxea a Anthropic con
 * la clave del servidor. Sirve para que un miembro del equipo sin clave propia
 * igual pueda generar planes.
 *
 * OJO: puede no estar deployada todavía. Si falla, el error tiene que decir con
 * todas las letras que hay que cargar la clave en ⚙ Ajustes — un 404 crudo acá
 * parece un bug del agente y no lo es.
 */
function edgeUrl() {
  const base = envVar('VITE_SUPABASE_URL')
  if (!base) return ''
  return base.replace(/\/+$/, '') + '/functions/v1/plan-agent'
}

/** Un error de cancelación que la UI pueda distinguir por `err.name`. */
function abortError() {
  try { return new DOMException('Generación cancelada', 'AbortError') } catch (_) { /* node viejo */ }
  const e = new Error('Generación cancelada')
  e.name = 'AbortError'
  return e
}

// ─────────────────────────────────────────────────────────────────────────────
// streamClaude — el único lugar que habla con la API
//
// Streaming SSE a mano (no hay SDK en el bundle). Dos cosas que parecen detalle
// y no lo son:
//   · un chunk del reader puede cortar una línea al medio → hay que bufferear
//     hasta el \n y recién ahí parsear;
//   · el `signal` tiene que cortar TAMBIÉN mientras leemos, no solo durante el
//     fetch inicial: una generación de 2 minutos se cancela casi siempre en el
//     medio del stream.
// ─────────────────────────────────────────────────────────────────────────────

async function streamClaude({ model, system, messages, maxTokens, signal, onText }) {
  const key = getApiKey()
  const viaEdge = !key
  const url = viaEdge ? edgeUrl() : ANTHROPIC_URL
  // Sin clave propia y sin Supabase configurado no hay por dónde: la app ya
  // trata 'NO_KEY' como caso especial y abre Ajustes.
  if (viaEdge && !url) throw new Error('NO_KEY')
  if (signal && signal.aborted) throw abortError()

  const headers = viaEdge
    ? {
        'content-type': 'application/json',
        apikey: envVar('VITE_SUPABASE_ANON_KEY'),
        authorization: 'Bearer ' + envVar('VITE_SUPABASE_ANON_KEY'),
      }
    : {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 8000,
      system,
      stream: true,
      messages: (Array.isArray(messages) ? messages : []).map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch (_) { body = '' }
    if (viaEdge) {
      throw new Error(
        `API ${res.status}: el agente compartido no está disponible. Cargá tu clave de Anthropic en ⚙ Ajustes. ${body.slice(0, 120)}`
      )
    }
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    throw new Error('El navegador no soporta respuestas en streaming. Probá con Chrome o Edge actualizado.')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''      // línea a medio llegar
  let full = ''     // texto acumulado del modelo

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (signal && signal.aborted) throw abortError()
      buf += decoder.decode(value, { stream: true })

      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (!line.startsWith('data:')) continue          // 'event:' y líneas en blanco no aportan
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue

        let evt = null
        try { evt = JSON.parse(payload) } catch (_) { continue }   // chunk raro: seguimos, no rompemos
        if (!evt || typeof evt !== 'object') continue

        if (evt.type === 'content_block_delta' && evt.delta && typeof evt.delta.text === 'string') {
          full += evt.delta.text
          if (onText) onText(full, evt.delta.text)
        } else if (evt.type === 'error') {
          const msg = (evt.error && (evt.error.message || evt.error.type)) || 'error desconocido'
          throw new Error(`API: ${msg}`)
        }
      }
    }
  } finally {
    // Cortar el body sí o sí: si el usuario cancela, la conexión tiene que morir.
    try { reader.cancel() } catch (_) { /* ya estaba cerrada */ }
  }

  if (signal && signal.aborted) throw abortError()
  return full
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseo del JSON que llega a pedazos
//
// El modelo devuelve UN objeto JSON. Mientras llega no es JSON válido (le falta
// el cierre), así que no se puede JSON.parse hasta el final. Pero la gracia de la
// pantalla es ver aparecer las semanas: para eso extraemos los elementos de
// "stages" y "weeks" que YA cerraron, contando llaves.
//
// Contar llaves suena frágil y lo es si se hace mal: una tarea que diga
// "config {json} del cliente" rompe el conteo si no se respetan los strings y
// los escapes. Por eso el scanner tiene estado (inStr/esc) y nunca cuenta llaves
// adentro de un literal de texto.
// ─────────────────────────────────────────────────────────────────────────────

/** Posición del `[` que abre el array de la clave `key`, o -1. */
function findKeyArray(text, key) {
  const k = '"' + key + '"'
  let idx = text.indexOf(k)
  while (idx >= 0) {
    let j = idx + k.length
    while (j < text.length && ' \t\r\n:'.indexOf(text[j]) >= 0) j++
    if (text[j] === '[') return j
    idx = text.indexOf(k, idx + k.length)   // era la clave adentro de un string: seguimos buscando
  }
  return -1
}

/** Los elementos COMPLETOS (ya cerrados) del array `key`, como strings JSON. */
function completedArrayItems(text, key) {
  const out = []
  const at = findKeyArray(text, key)
  if (at < 0) return out
  let depth = 0
  let start = -1
  let inStr = false
  let esc = false
  for (let i = at + 1; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{' || c === '[') {
      if (depth === 0) start = i
      depth++
      continue
    }
    if (c === '}' || c === ']') {
      if (depth === 0) break                    // este ']' cierra el array: terminamos
      depth--
      if (depth === 0 && start >= 0) { out.push(text.slice(start, i + 1)); start = -1 }
    }
  }
  return out
}

/** El valor de un campo string YA cerrado (`"key": "…"`), o ''. */
function scalarField(text, key) {
  const re = new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"')
  const m = re.exec(text)
  if (!m) return ''
  try { return JSON.parse('"' + m[1] + '"') } catch (_) { return m[1] }
}

/**
 * Draft de mejor esfuerzo a partir de texto incompleto.
 * PROMESA DURA: no tira NUNCA. Esto corre en cada chunk del stream; si explota,
 * se cae una generación de dos minutos por un token mal puesto.
 */
function parsePartialDraft(text) {
  const empty = { title: '', subtitle: '', clientName: '', lead: '', metaLine: '', stages: [], weeks: [] }
  try {
    const t = String(text || '')
    if (!t) return empty
    const grab = (key) => completedArrayItems(t, key).map((chunk) => {
      try { return JSON.parse(chunk) } catch (_) { return null }
    }).filter(Boolean)
    return {
      title: scalarField(t, 'title'),
      subtitle: scalarField(t, 'subtitle'),
      clientName: scalarField(t, 'clientName'),
      lead: scalarField(t, 'lead'),
      metaLine: scalarField(t, 'metaLine'),
      stages: grab('stages'),
      weeks: grab('weeks'),
    }
  } catch (_) {
    return empty
  }
}

/** Saca los ``` de markdown que a veces envuelven la respuesta. */
function stripFences(s) {
  return String(s || '').replace(/```[a-z]*\s*/gi, '').replace(/```/g, '')
}

/** JSON.parse tolerante: destripa fences y se queda con el objeto más externo. */
function parseJsonLoose(text) {
  const t = stripFences(text)
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { return JSON.parse(t.slice(a, b + 1)) } catch (_) { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Saneado del Draft
// ─────────────────────────────────────────────────────────────────────────────

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/** Una semana del draft con type/kind válidos y coherentes entre sí. */
function coerceWeek(w, i) {
  const raw = w && typeof w === 'object' ? w : {}
  const type = Object.prototype.hasOwnProperty.call(WEEK_TYPES, raw.type) ? raw.type : 'info'
  const deliver = raw.deliver && typeof raw.deliver === 'object' ? raw.deliver : {}
  let kind = Object.prototype.hasOwnProperty.call(DELIVER_KINDS, deliver.kind) ? deliver.kind : ''
  // Un gate que dice "Entregable" o un cierre de hito que dice "Demo en vivo"
  // le mienten al cliente sobre lo que pasa esa semana: se fuerza el par.
  if (type === 'gate') kind = 'gate'
  else if (type === 'formal') kind = 'formal'
  else if (!kind) kind = type === 'doc' ? 'doc' : 'live'

  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).map((t) => {
    if (typeof t === 'string') return { text: t.trim() }
    if (!t || typeof t !== 'object') return null
    const out = { text: str(t.text) }
    if (t.responsable === 'cliente' || t.responsable === 'ambos') out.responsable = t.responsable
    if (str(t.detalle)) out.detalle = str(t.detalle)
    if (str(t.criterio)) out.criterio = str(t.criterio)
    if (str(t.modulo)) out.modulo = str(t.modulo)
    if (t.riesgo === 'bajo' || t.riesgo === 'medio' || t.riesgo === 'alto') out.riesgo = t.riesgo
    return out
  }).filter((t) => t && t.text)

  return {
    n: Number.isFinite(Number(raw.n)) ? Number(raw.n) : i + 1,
    title: str(raw.title),
    type,
    tasks,
    deliver: { kind, text: str(deliver.text) },
  }
}

/** Draft con todos los campos presentes y del tipo que corresponde. */
function coerceDraft(d) {
  const raw = d && typeof d === 'object' ? d : {}
  const stages = (Array.isArray(raw.stages) ? raw.stages : []).map((s) => {
    const o = s && typeof s === 'object' ? s : {}
    return {
      title: str(o.title),
      description: str(o.description),
      weekTo: Number.isFinite(Number(o.weekTo)) ? Math.max(1, Math.floor(Number(o.weekTo))) : null,
    }
  })
  return {
    title: str(raw.title),
    subtitle: str(raw.subtitle),
    clientName: str(raw.clientName),
    lead: str(raw.lead),
    metaLine: str(raw.metaLine),
    stages,
    weeks: (Array.isArray(raw.weeks) ? raw.weeks : []).map(coerceWeek),
  }
}

/**
 * Parseo final del stream. Primero el JSON completo; si el modelo se comió una
 * llave o metió una coma de más, caemos al último parcial que sí anduvo. Perder
 * la última semana es infinitamente mejor que perder el plan entero.
 */
function finalizeDraft(fullText, lastPartial) {
  const parsed = parseJsonLoose(fullText)
  if (parsed) return coerceDraft(parsed)
  return coerceDraft(lastPartial || parsePartialDraft(fullText))
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS
//
// Esta es la parte del archivo que define la calidad del producto. El plan es un
// documento COMERCIAL que ve el cliente en una URL pública: si el agente escribe
// como un ticket de Jira, el documento no sirve. Todo lo que sigue está escrito
// para el modelo, no para el equipo — pero es texto editable, no magia.
// ─────────────────────────────────────────────────────────────────────────────

/** Quiénes somos, para quién escribimos y qué está prohibido. Va en las 3 fases. */
export const AGENT_IDENTITY = `Sos el planificador senior de Insights Apps, una agencia de desarrollo de software de Argentina.
Tu trabajo es convertir información desordenada de un proyecto (notas sueltas, transcripciones de llamadas, sprints, pendientes) en un plan de ejecución semana a semana.

QUÉ ES ESTE DOCUMENTO
· Es comercial y lo lee el cliente en una página web con su nombre. No es un backlog interno ni un tablero de tickets.
· El cliente tiene que entender, sin ayuda de nadie, qué recibe, cuándo lo recibe y qué necesitamos de él.
· Es la base de la relación: lo que prometemos acá se cumple. Por eso no se promete de más.

CÓMO ESCRIBÍS
· Español rioplatense profesional (es-AR). Voseo natural cuando le hablás al cliente, sin exagerar y sin ponerte canchero.
· Claro y concreto. Nada de jerga técnica innecesaria: "Modelado de datos y migraciones en Supabase" está bien; "arquitectura event-driven desacoplada" no, salvo que el cliente ya hable así.
· Sin adjetivos de venta (revolucionario, de última generación, world class), sin emojis, sin signos de exclamación.
· Frases cortas. Cada tarea se entiende sola, sin leer las de al lado.

QUÉ NO HACÉS NUNCA
· Inventar. Ni tecnologías, ni integraciones, ni fechas, ni precios, ni nombres de personas que no estén en el contexto.
· Poner montos, honorarios, porcentajes de anticipo o condiciones de pago dentro del plan. Si hay un gate de pago, se nombra como instancia de aprobación, sin cifras.
· Prometer resultados de negocio ("vas a vender tres veces más", "vas a ahorrar 20 horas").
· Rellenar semanas con tareas de relleno para llegar a un número lindo.
Si algo no está en el contexto y hace falta para planificar, va como supuesto o como pregunta. Nunca adentro del plan como si fuera un hecho.`

/** Las reglas de forma del plan. Es lo que hace que el resultado sea publicable. */
export const PLAN_STRUCTURE_RULES = `REGLAS DE ESTRUCTURA

ETAPAS (stages)
· Entre 3 y 5 etapas. Cada una agrupa semanas consecutivas y CIERRA CON UNA ENTREGA. No existe la etapa que "sigue avanzando".
· "weekTo" es el número de la última semana de esa etapa. Van en orden creciente, sin huecos y sin solaparse: la etapa siguiente arranca en weekTo + 1, y la última etapa termina justo en la última semana del plan.
· "title": de 2 a 4 palabras, en el idioma del cliente y no en el nuestro. Ej: "Discovery y arquitectura", "Portal de miembros", "Lanzamiento y handover".
· "description": una o dos frases sobre qué queda funcionando cuando esa etapa termina.
· No elijas colores ni íconos. Esos campos no existen: los asigna el sistema.

SEMANAS (weeks)
· "n" numera desde 1, correlativo, sin saltos.
· La semana 1 es SIEMPRE de arranque y discovery: kickoff, accesos, definiciones, validación del alcance y setup. Nunca se arranca programando funcionalidad en la semana 1.
· "title": de 3 a 6 palabras con el foco real de la semana. Ej: "Modelo de datos y autenticación".
· "tasks": entre 3 y 5 tareas por semana. NUNCA más de 5. Concretas y verificables: mirando algo se tiene que poder decir "esto está hecho".
    Bien: "Modelado de datos y migraciones en Supabase" · "Alta y edición de miembros con validaciones" · "Deploy del entorno de staging".
    Mal: "trabajar en el backend" · "avanzar con el front" · "reuniones de equipo" · "varios".
· "type": exactamente uno de info, doc, gate, formal.
    info   = semana de avance normal, se muestra funcionando.
    doc    = la semana entrega un documento (arquitectura, modelo de datos, manual, guion de pruebas).
    gate   = hay una aprobación o una decisión del cliente que habilita seguir. Usalo donde el trabajo se frena si el cliente no responde.
    formal = cierre de etapa con aceptación formal. LA ÚLTIMA SEMANA DE CADA ETAPA ES SIEMPRE formal.
· "deliver": qué se lleva el cliente esa semana.
    "kind" tiene que ser coherente con "type": info va con live, doc con doc, gate con gate, formal con formal.
    "text": una frase concreta de qué recibe. Ej: "Entorno de staging navegable con el alta de miembros funcionando". Nunca "avances varios" ni "lo trabajado en la semana".

POCAS TAREAS, Y QUE IMPORTEN
· Menos es más. Una semana con 4 tareas que el cliente entiende vale más que una con 8 que lo abruman. Si dudás entre poner una tarea o no ponerla: no la pongas.
· Cada tarea tiene que contestar "¿esto para qué me sirve a mí?" desde donde está sentado el cliente. Si la respuesta es "para que el código quede prolijo", no va: eso es trabajo nuestro, no una promesa de entrega.
· Fusioná lo que es una sola cosa vista de afuera. "Modelo de datos", "migraciones" y "seeds" son una sola tarea para el cliente, no tres.
· No desagregues el trabajo interno: refactors, configuración de herramientas, tipados, linters, tests unitarios, convenciones y limpiezas NO son tareas del plan. Se dan por incluidas.
· Preferí la tarea que nombra el resultado visible ("El cliente reserva un turno y le llega el mail de confirmación") por sobre la que nombra la pieza técnica ("Endpoint de reservas + cola de mails").
· Sí van siempre, aunque sean pocas: lo que depende del cliente, las decisiones que traban el avance y las entregas que él va a ver.

DETALLE (tasks[].detalle)
· Obligatorio en TODAS las tareas, sin excepción — también en las que te parezcan obvias. En la página del cliente el desplegable de una tarea aparece SOLO si tiene detalle: una tarea sin detalle queda muda y rompe la lectura del documento.
· Es la explicación de la tarea en criollo, para alguien que no sabe nada de software ni del rubro: qué se hace puntualmente y para qué sirve. Es lo que el cliente lee al abrir el desplegable de esa tarea.
· 1 a 3 frases. Cero jerga técnica sin explicar, cero siglas sueltas. Si mencionás algo técnico (staging, base de datos, wireframe), explicalo en la misma frase con una analogía simple.
· No repitas el texto de la tarea con otras palabras: agregá contexto real. Ej. tarea "Deploy del entorno de staging" → detalle "Staging es una copia privada de la app, con su propio link, donde vas viendo el avance sin que nadie más pueda entrar."
· Si la tarea es del cliente ("responsable": "cliente" o "ambos"), el detalle explica qué tiene que hacer concretamente y por qué se lo pedimos, no solo qué es.

RESPONSABLE (tasks[].responsable)
· Por defecto la tarea es nuestra. En ese caso NO pongas el campo.
· Poné "responsable": "cliente" en todo lo que realmente depende de él: accesos y credenciales, contenidos y textos, fotos y assets, altas de cuentas (dominio, Stripe, tienda, casilla), decisiones de negocio, aprobaciones y firmas.
· Poné "responsable": "ambos" cuando hay que sentarse juntos: kickoff, revisión de hito, definición de alcance, pruebas de aceptación.
· Esto es una de las cosas más valiosas del documento: el cliente ve de un vistazo qué depende de él y deja de haber excusas cruzadas. No lo omitas por prolijidad, pero tampoco lo inventes.

CRITERIO DE ACEPTACIÓN (tasks[].criterio)
· Obligatorio en las tareas de la última semana de cada etapa, que son las que disparan la aceptación.
· Opcional en el resto: ponelo solo donde de verdad aclara algo.
· Es la condición observable que cierra la tarea. Ej: "El cliente crea un miembro, lo edita y lo ve publicado en el directorio". No repitas la tarea con otras palabras.`

/** El contrato de salida. Sin esto el modelo se manda un preámbulo y rompe el parser. */
const DRAFT_JSON_CONTRACT = `FORMATO DE SALIDA
Devolvés EXCLUSIVAMENTE un objeto JSON válido. Sin texto antes ni después, sin explicaciones, sin bloque de código markdown y sin comentarios dentro del JSON.

{
  "title": "nombre del plan tal como lo ve el cliente. Ej: Plan de ejecución",
  "subtitle": "remate corto que cierra el título grande, MÁXIMO 24 caracteres. Ej: semana a semana.",
  "clientName": "nombre corto del cliente o de su empresa. Cadena vacía si no está en el contexto.",
  "lead": "una o dos frases: de qué va el plan, cuántas semanas dura y dónde termina.",
  "metaLine": "línea corta de contexto. Ej: 12 semanas · 4 etapas · 3 hitos formales",
  "stages": [
    { "title": "…", "description": "…", "weekTo": 3 }
  ],
  "weeks": [
    {
      "n": 1,
      "title": "…",
      "type": "info",
      "tasks": [
        { "text": "…", "detalle": "…" },
        { "text": "…", "detalle": "…", "responsable": "cliente" },
        { "text": "…", "detalle": "…", "criterio": "…" }
      ],
      "deliver": { "kind": "live", "text": "…" }
    }
  ]
}

No agregues campos que no estén en ese esquema.`

export const PLAN_SYSTEM = `${AGENT_IDENTITY}

${PLAN_STRUCTURE_RULES}

${DRAFT_JSON_CONTRACT}`

export const BRIEF_SYSTEM = `${AGENT_IDENTITY}

Todavía NO escribís el plan. Esta es la fase de lectura: mostrás qué entendiste del proyecto para que el equipo lo confirme o lo corrija antes de que se genere una sola semana.

FORMATO DE SALIDA
Devolvés EXCLUSIVAMENTE un objeto JSON válido, sin texto alrededor y sin bloque de código markdown:

{
  "objetivo": "una o dos frases: qué se construye y para qué. En criollo, sin vender.",
  "alcance": ["de 4 a 8 bloques de trabajo concretos que SÍ están en el contexto"],
  "supuestos": ["lo que estás dando por hecho para poder planificar"],
  "riesgos": ["de 2 a 5 cosas que pueden atrasar o encarecer, cada una con su motivo"],
  "preguntas": ["de 3 a 6 preguntas que conviene responder antes de arrancar"],
  "semanasSugeridas": 12,
  "etapasSugeridas": ["de 3 a 5 nombres de etapa, en orden"]
}

REGLAS
· Todo lo que afirmes tiene que estar en el contexto. Lo que no esté y necesites, va a "supuestos" o a "preguntas".
· Si el contexto es flaco, decilo con la estructura: pocos ítems en "alcance", muchas "preguntas". No inventes para llenar.
· "semanasSugeridas" se justifica con el alcance que vos mismo listaste. Es un entero.
· Las preguntas son las que de verdad cambian el plan (integraciones, volúmenes, accesos, quién aprueba), no cortesías.`

export const REFINE_SYSTEM = `${AGENT_IDENTITY}

${PLAN_STRUCTURE_RULES}

Te paso un plan ya generado y UNA instrucción del equipo. Aplicás la instrucción y devolvés el plan COMPLETO otra vez.

· Tocá solo lo que la instrucción pide. Todo lo demás vuelve idéntico: mismos títulos, mismas tareas, mismo orden, mismas palabras.
· Si la instrucción cambia la cantidad de semanas, renumerá de 1 a N y reajustá los "weekTo" de las etapas para que sigan cubriendo todo el plan sin huecos ni solapes.
· Si la instrucción es ambigua, aplicá la interpretación más conservadora: la que menos cambia.
· No borres información que el equipo cargó a mano salvo que la instrucción lo pida explícitamente.

${DRAFT_JSON_CONTRACT}`

/** Duración: la pedida manda; si no hay, la elige el modelo y la justifica. */
function durationRule(weeks) {
  const n = Number(weeks)
  if (Number.isFinite(n) && n > 0) {
    return `DURACIÓN: el plan tiene EXACTAMENTE ${Math.floor(n)} semanas, numeradas de 1 a ${Math.floor(n)}. Ni una más ni una menos.`
  }
  return 'DURACIÓN: la elegís vos a partir del alcance real que leas en el contexto (lo habitual es entre 8 y 16 semanas). No estires el plan con semanas de relleno ni lo comprimas para que parezca más barato.'
}

/** Las preferencias que el equipo cargó en el panel, como texto para el modelo. */
function optionsBlock(options) {
  const o = options && typeof options === 'object' ? options : {}
  const lines = []
  if (str(o.clientName)) lines.push(`Cliente: ${str(o.clientName)}`)
  if (str(o.startDate)) lines.push(`Fecha de arranque: ${str(o.startDate)} (podés mencionar el mes de inicio y el de cierre en el lead; no pongas fechas exactas semana por semana)`)
  lines.push(durationRule(o.weeks))
  if (str(o.notes)) lines.push(`Indicaciones del equipo (mandan sobre todo lo demás): ${str(o.notes)}`)
  return lines.join('\n')
}

const modelId = (options) => {
  const o = options && typeof options === 'object' ? options : {}
  return AGENT_MODELS[o.model] || AGENT_MODELS.fast
}

// ─────────────────────────────────────────────────────────────────────────────
// Las tres corridas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fase 1 — lectura. Devuelve lo que el agente entendió, para confirmar o corregir.
 * `onDelta(textoAcumulado, delta)` en cada chunk: la UI puede mostrar el JSON
 * llegando o simplemente un indicador de actividad.
 * → { objetivo, alcance[], supuestos[], riesgos[], preguntas[], semanasSugeridas, etapasSugeridas[] }
 */
export async function runBrief({ contextText, options, signal, onDelta }) {
  const user = `CONTEXTO DEL PROYECTO
${str(contextText) || '(sin contexto: decilo en "preguntas" y no inventes nada)'}

PREFERENCIAS DEL EQUIPO
${optionsBlock(options)}

Leé todo y devolvé el JSON del brief.`

  const text = await streamClaude({
    model: modelId(options),
    system: BRIEF_SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 3000,
    signal,
    onText: (full, delta) => { if (onDelta) onDelta(full, delta) },
  })

  const raw = parseJsonLoose(text) || {}
  const list = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])
  const weeksAsked = Number(options && options.weeks)
  const sugeridas = Number(raw.semanasSugeridas)
  return {
    objetivo: str(raw.objetivo),
    alcance: list(raw.alcance),
    supuestos: list(raw.supuestos),
    riesgos: list(raw.riesgos),
    preguntas: list(raw.preguntas),
    // Si el equipo fijó la duración, esa gana: el brief no la puede contradecir.
    semanasSugeridas: Number.isFinite(weeksAsked) && weeksAsked > 0
      ? Math.floor(weeksAsked)
      : (Number.isFinite(sugeridas) && sugeridas > 0 ? Math.floor(sugeridas) : 12),
    etapasSugeridas: list(raw.etapasSugeridas),
  }
}

/** El brief confirmado, en texto, para que la fase 2 no tenga que releer todo. */
function briefBlock(brief) {
  if (!brief || typeof brief !== 'object') return ''
  const b = []
  const bullets = (label, arr) => {
    const l = Array.isArray(arr) ? arr.map(str).filter(Boolean) : []
    if (l.length) b.push(`${label}:\n${l.map((x) => '· ' + x).join('\n')}`)
  }
  if (str(brief.objetivo)) b.push(`Objetivo: ${str(brief.objetivo)}`)
  bullets('Alcance confirmado', brief.alcance)
  bullets('Supuestos', brief.supuestos)
  bullets('Riesgos', brief.riesgos)
  bullets('Preguntas abiertas (NO las respondas inventando: si algo depende de una de estas, dejá la tarea planteada de forma que no dependa del dato que falta)', brief.preguntas)
  bullets('Etapas sugeridas', brief.etapasSugeridas)
  const n = Number(brief.semanasSugeridas)
  if (Number.isFinite(n) && n > 0) b.push(`Semanas sugeridas: ${Math.floor(n)}`)
  return b.join('\n\n')
}

/**
 * Emisor de parciales con freno: solo avisa a la UI cuando de verdad cerró algo
 * nuevo. Sin esto se dispararía un re-render por cada token del stream.
 */
function partialEmitter(onPartial) {
  let seen = 0
  return (text) => {
    const draft = parsePartialDraft(text)
    const count = draft.stages.length + draft.weeks.length
    // seen arranca en 0 a propósito: mientras no cerró ni una etapa no hay nada
    // que dibujar y sería un render de un draft vacío.
    if (count === seen) return
    seen = count
    if (onPartial) {
      try { onPartial(coerceDraft(draft)) } catch (_) { /* un error de render no corta la generación */ }
    }
  }
}

/**
 * Fase 2 — el plan. `onPartial(draftParcial)` cada vez que se completa una etapa
 * o una semana: es lo que dibuja las semanas apareciendo de a una.
 * → Draft
 */
export async function runPlan({ contextText, brief, options, signal, onPartial }) {
  const bloqueBrief = briefBlock(brief)
  const user = `CONTEXTO DEL PROYECTO
${str(contextText) || '(sin contexto adicional)'}

${bloqueBrief ? `LO QUE ENTENDISTE, YA REVISADO POR EL EQUIPO (esto manda sobre el contexto crudo)\n${bloqueBrief}\n` : ''}
PREFERENCIAS DEL EQUIPO
${optionsBlock(options)}

Generá el plan completo en JSON.`

  let lastPartial = null
  const emit = partialEmitter((d) => { if (onPartial) onPartial(d) })

  const text = await streamClaude({
    model: modelId(options),
    system: PLAN_SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 16000,
    signal,
    onText: (full) => { lastPartial = parsePartialDraft(full); emit(full) },
  })

  return finalizeDraft(text, lastPartial)
}

/**
 * Fase 3 — refinar. Una instrucción en lenguaje natural sobre un draft existente.
 * Devuelve el plan entero de nuevo (no un parche): así el resultado pasa por el
 * mismo saneado que una generación desde cero.
 * → Draft
 */
export async function runRefine({ draft, instruction, contextText, options, signal, onPartial }) {
  const base = coerceDraft(draft)
  const user = `PLAN ACTUAL (JSON)
${JSON.stringify(base)}

INSTRUCCIÓN DEL EQUIPO
${str(instruction) || '(sin instrucción: devolvé el plan tal cual)'}

${str(contextText) ? `CONTEXTO DEL PROYECTO (por si necesitás un dato para aplicar la instrucción)\n${cut(str(contextText), 40000)}\n` : ''}
PREFERENCIAS DEL EQUIPO
${optionsBlock(options)}

Aplicá la instrucción y devolvé el plan completo en JSON.`

  let lastPartial = null
  const emit = partialEmitter((d) => { if (onPartial) onPartial(d) })

  const text = await streamClaude({
    model: modelId(options),
    system: REFINE_SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 16000,
    signal,
    onText: (full) => { lastPartial = parsePartialDraft(full); emit(full) },
  })

  return finalizeDraft(text, lastPartial)
}

// ─────────────────────────────────────────────────────────────────────────────
// planFromDraft — del Draft al plan real
//
// Acá es donde el output del modelo se convierte en algo que el editor, el
// template y validatePlan aceptan sin quejarse. Todo lo derivable se deriva de
// nuevo: el modelo no toca ni un color, ni un rango de hito, ni un id.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plan COMPLETO listo para guardar.
 * `base` es un plan existente (regenerar sobre uno que ya está publicado) o null.
 * Cuando hay base se preservan su identidad y su estado de publicación: el link
 * que el cliente ya tiene no puede cambiar porque alguien regeneró el contenido.
 */
export function planFromDraft(draft, base) {
  const d = coerceDraft(draft)
  const hasBase = !!(base && typeof base === 'object')
  const plan = hasBase ? { ...base } : newPlan()

  // Portada: lo que el draft trae pisa, lo que viene vacío conserva lo que había.
  if (d.title) plan.title = d.title
  if (d.subtitle) plan.subtitle = d.subtitle
  if (d.clientName) plan.clientName = d.clientName
  if (d.lead) plan.lead = d.lead
  if (d.metaLine) plan.metaLine = d.metaLine

  if (d.weeks.length) {
    // ── Semanas ──────────────────────────────────────────────────────────────
    // Renumeradas siempre desde 1: el "n" que mandó el modelo es una sugerencia,
    // no una verdad (si se salteó la 7, el plan quedaría con un hueco).
    const total = clampWeekCount(Math.min(d.weeks.length, MAX_WEEKS))
    const weeks = []
    for (let i = 0; i < total; i++) {
      const w = d.weeks[i]
      weeks.push({
        ...emptyWeek(i + 1),
        title: w.title,
        type: w.type,
        tasks: normalizeTasks(w.tasks),
        deliver: { kind: w.deliver.kind, text: w.deliver.text },
      })
    }
    plan.weeks = weeks

    // ── Etapas → hitos ───────────────────────────────────────────────────────
    // Se recorta el rango de cada etapa a las semanas que existen y la última se
    // estira hasta el final. Sin esto, un weekTo pasado de rosca deja semanas
    // huérfanas (grises en la página) o directamente rompe validatePlan.
    let from = 1
    const stages = []
    for (const s of d.stages) {
      if (from > total) break
      const asked = Number(s.weekTo)
      const to = Math.min(total, Math.max(from, Number.isFinite(asked) ? asked : from))
      stages.push({ title: s.title, description: s.description, weekTo: to })
      from = to + 1
    }
    if (!stages.length && total) stages.push({ title: 'Ejecución', description: '', weekTo: total })
    if (stages.length) stages[stages.length - 1].weekTo = total
    plan.hitos = normalizeStages(stages)

    // Números del hero y pie: se recalculan porque cambió la estructura. Si el
    // pie tenía un texto propio (alguien lo editó a mano), no se toca.
    plan.stats = suggestStats(plan)
    const footer = plan.footer && typeof plan.footer === 'object' ? plan.footer : {}
    const lines = Array.isArray(footer.lines) ? footer.lines : []
    if (!lines.length || /^Plan de ejecución · \d+ semanas$/.test(String(lines[0] || ''))) {
      plan.footer = {
        ...footer,
        lines: [`Plan de ejecución · ${total} semanas`, `Documento de presentación — ${new Date().getFullYear()}`],
      }
    }
  }

  if (hasBase) {
    // Identidad y publicación: intocables. El slug es la URL que el cliente ya
    // tiene guardada; el id es la fila en Supabase.
    plan.id = base.id
    plan.slug = base.slug
    plan.published = base.published
    plan.publishedUrl = base.publishedUrl
    plan.projectId = base.projectId
    plan.createdAt = base.createdAt
  } else if (!plan.slug) {
    // Sugerencia de dirección web para un plan nuevo. Es solo eso: la UI todavía
    // tiene que validar unicidad con isSlugAllowed antes de publicar.
    const guess = slugify(d.clientName || d.title || 'plan')
    if (SLUG_RE.test(guess)) plan.slug = guess
  }

  plan.updatedAt = new Date().toISOString()
  return plan
}

/** Los números que la UI muestra arriba del preview. → { stages, weeks, tasks, deliverables, clientTasks } */
export function draftSummary(draft) {
  const d = coerceDraft(draft)
  let tasks = 0
  let deliverables = 0
  let clientTasks = 0
  for (const w of d.weeks) {
    tasks += w.tasks.length
    if (w.deliver && w.deliver.text) deliverables++
    for (const t of w.tasks) if (t.responsable === 'cliente' || t.responsable === 'ambos') clientTasks++
  }
  return { stages: d.stages.length, weeks: d.weeks.length, tasks, deliverables, clientTasks }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto — de los datos de la app a texto que el modelo entienda
//
// Nada de volcar JSON crudo: el modelo lee mejor texto etiquetado y gasta menos
// tokens. Cada bloque se puede prender y apagar desde la UI, así que cada uno
// tiene que ser autosuficiente y traer su propio encabezado.
// ─────────────────────────────────────────────────────────────────────────────

/** Recorte con marca visible: el modelo tiene que saber que ahí falta texto. */
function cut(s, n) {
  const t = String(s || '')
  return t.length <= n ? t : t.slice(0, n) + ' […recortado]'
}

const lines = (arr) => arr.filter(Boolean).join('\n')

/**
 * Los bloques de contexto disponibles para un proyecto de la app.
 * ctx = { clients: [], calls: [], team: [] }
 * → [{ id, label, hint, chars, text }]
 * Solo devuelve bloques CON contenido real: un bloque vacío en la UI es una
 * casilla que el usuario tilda para no mandar nada.
 */
export function projectContextGroups(project, ctx) {
  const out = []
  if (!project || typeof project !== 'object') return out
  const c = ctx && typeof ctx === 'object' ? ctx : {}
  const clients = Array.isArray(c.clients) ? c.clients : []
  const calls = Array.isArray(c.calls) ? c.calls : []
  const team = Array.isArray(c.team) ? c.team : []
  const arr = (v) => (Array.isArray(v) ? v : [])

  const push = (id, label, hint, text) => {
    const t = String(text || '').trim()
    if (!t) return
    out.push({ id, label, hint, chars: t.length, text: t })
  }

  const client = clients.find((x) => x && x.id === project.clientId) || null
  const userName = (id) => {
    const u = team.find((x) => x && x.id === id)
    return u ? u.name : ''
  }

  // ── ficha ──────────────────────────────────────────────────────────────────
  const asg = project.assignments || {}
  const pm = userName(asg.pm && asg.pm.userId)
  const dev = userName(asg.dev && asg.dev.userId)
  const ficha = lines([
    `Proyecto: ${str(project.name)}`,
    client ? `Cliente: ${str(client.company) || str(client.name)}` : null,
    `Etapa: ${stageMeta(projectStage(project)).label}`,
    str(project.productionUrl) ? `Producción: ${str(project.productionUrl)}` : null,
    str(project.testingUrl) ? `Testing: ${str(project.testingUrl)}` : null,
    str(project.githubRepo) ? `Repo: ${str(project.githubRepo)}` : null,
    Number(project.progress) ? `Avance declarado: ${Number(project.progress)}%` : null,
    Number(project.totalModules)
      ? `Módulos: ${Number(project.deliveredModules) || 0} entregados de ${Number(project.totalModules)}`
      : null,
    pm || dev ? `Equipo asignado: ${[pm && 'PM ' + pm, dev && 'Dev ' + dev].filter(Boolean).join(' · ')}` : null,
    str(project.kickoff) ? `\nDescripción del proyecto:\n${cut(str(project.kickoff), 4000)}` : null,
  ])
  push('ficha', 'Ficha del proyecto', stageMeta(projectStage(project)).label, ficha)

  // ── sprints ────────────────────────────────────────────────────────────────
  const sprints = arr(project.sprints)
  if (sprints.length) {
    const body = sprints.map((s, i) => {
      const mods = arr(s.modules).map((m) => `${str(m.name)}${str(m.status) ? ` (${str(m.status)})` : ''}`).filter(Boolean)
      return lines([
        `${i + 1}. ${str(s.name) || 'Sprint sin nombre'} — ${str(s.status) || 'pendiente'}${str(s.estimatedDate) ? ` · estimado ${str(s.estimatedDate)}` : ''}`,
        str(s.description) ? `   ${cut(str(s.description), 400)}` : null,
        mods.length ? `   Módulos: ${mods.join(' · ')}` : null,
      ])
    }).join('\n')
    const done = sprints.filter((s) => s && (s.status === 'terminado' || s.status === 'completado')).length
    push('sprints', 'Sprints y módulos', `${sprints.length} sprints · ${done} terminados`,
      `Sprints ya planificados en la app (el plan nuevo tiene que ser coherente con esto):\n${body}`)
  }

  // ── pendientes ─────────────────────────────────────────────────────────────
  const pa = arr(project.pendingAgency)
  const pc = arr(project.pendingClient)
  const ct = arr(project.clientTasks)
  if (pa.length || pc.length || ct.length) {
    const fmt = (t) => `- [${str(t.priority) || 'normal'}] ${str(t.title)}${str(t.description) ? `: ${cut(str(t.description), 300)}` : ''}`
    const body = lines([
      pa.length ? `Pendientes de Insights:\n${pa.map(fmt).join('\n')}` : null,
      pc.length ? `\nPendientes del cliente:\n${pc.map(fmt).join('\n')}` : null,
      ct.length ? `\nDependencias del cliente ya registradas:\n${ct.map((t) => `- ${str(t.text)}${t.done ? ' (resuelta)' : ''}`).join('\n')}` : null,
    ])
    push('pendientes', 'Pendientes y dependencias', `${pa.length} nuestros · ${pc.length + ct.length} del cliente`, body)
  }

  // ── riesgos ────────────────────────────────────────────────────────────────
  const risks = arr(project.risks)
  if (risks.length) {
    push('riesgos', 'Riesgos', `${risks.length} registrados`,
      `Riesgos detectados por el equipo:\n${risks.map((r) => `- [${str(r.severity) || 'media'}] ${str(r.description)}`).join('\n')}`)
  }

  // ── avances ────────────────────────────────────────────────────────────────
  const avances = arr(project.avances).slice(0, 10)
  const comms = arr(project.comms).slice(0, 10)
  if (avances.length || comms.length) {
    const fmt = (e) => `- ${String(e.date || '').slice(0, 10)}: ${cut(str(e.text), 400)}`
    const body = lines([
      avances.length ? `Últimos avances registrados:\n${avances.map(fmt).join('\n')}` : null,
      comms.length ? `\nÚltimas comunicaciones con el cliente:\n${comms.map(fmt).join('\n')}` : null,
    ])
    push('avances', 'Avances y comunicaciones', `${avances.length + comms.length} entradas`, body)
  }

  // ── cliente ────────────────────────────────────────────────────────────────
  if (client) {
    const ob = client.onboarding && typeof client.onboarding === 'object' ? client.onboarding : {}
    const body = lines([
      `Contacto: ${str(client.name)}${str(client.company) ? ` (${str(client.company)})` : ''}`,
      str(ob.businessDescription) ? `Negocio: ${cut(str(ob.businessDescription), 1200)}` : null,
      str(ob.goals) ? `Objetivos que declaró: ${cut(str(ob.goals), 1200)}` : null,
      str(ob.existingTech) ? `Con qué trabaja hoy: ${cut(str(ob.existingTech), 600)}` : null,
      Number(ob.approvedBudget) ? `Presupuesto aprobado (dato interno, NO va en el plan): ${Number(ob.approvedBudget)}` : null,
      str(ob.notes) ? `Notas del onboarding: ${cut(str(ob.notes), 1200)}` : null,
    ])
    push('cliente', 'Ficha del cliente', str(client.company) || str(client.name), body)
  }

  // ── llamadas ───────────────────────────────────────────────────────────────
  // Las transcripciones son lo más caro del contexto y lo que más se repite: se
  // recortan fuerte y el bloque entero tiene tope. El resumen vale más que el
  // transcript completo, así que va primero y nunca se recorta.
  const mine = calls.filter((k) => k && (
    (project.id && k.projectId === project.id) ||
    (!k.projectId && project.clientId && k.clientId === project.clientId)
  ))
  if (mine.length) {
    let used = 0
    const blocks = []
    for (const k of mine) {
      if (used > 6000) { blocks.push('(hay más llamadas registradas, no entraron en el contexto)'); break }
      const head = `— Llamada ${String(k.date || '').slice(0, 10)}${str(k.advisor) ? ` · ${str(k.advisor)}` : ''}${str(k.type) ? ` · ${str(k.type)}` : ''}`
      const b = lines([
        head,
        str(k.summary) ? `Resumen: ${cut(str(k.summary), 900)}` : null,
        str(k.transcript) ? `Transcripción: ${cut(str(k.transcript), 1500)}` : null,
      ])
      used += b.length
      blocks.push(b)
    }
    push('llamadas', 'Llamadas con el cliente', `${mine.length} reuniones`,
      `Reuniones registradas con el cliente:\n${blocks.join('\n\n')}`)
  }

  // ── scope ──────────────────────────────────────────────────────────────────
  const files = arr(project.scopeFiles)
  const sales = arr(project.salesLinks)
  const notes = arr(project.scopeNotes)
  if (files.length || sales.length || notes.length) {
    const nameOf = (f) => `- ${str(f.name)}${str(f.kind) ? ` (${str(f.kind)})` : ''}`
    const body = lines([
      files.length ? `Documentos del alcance cargados (solo el nombre; el contenido no está disponible acá):\n${files.map(nameOf).join('\n')}` : null,
      sales.length ? `\nLlamadas de venta cargadas:\n${sales.map(nameOf).join('\n')}` : null,
      notes.length ? `\nNotas del alcance:\n${notes.map((n) => `- ${cut(str(typeof n === 'string' ? n : n && n.text), 500)}`).filter((x) => x.length > 2).join('\n')}` : null,
    ])
    push('scope', 'Alcance y documentos', `${files.length + sales.length} archivos · ${notes.length} notas`, body)
  }

  return out
}

/** Resumen compacto de un plan existente: para "tomá este plan de base". */
function planOutline(plan) {
  if (!plan || typeof plan !== 'object') return ''
  const hitos = Array.isArray(plan.hitos) ? plan.hitos : []
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : []
  const head = lines([
    str(plan.title) ? `Título: ${str(plan.title)}` : null,
    str(plan.clientName) ? `Cliente: ${str(plan.clientName)}` : null,
    str(plan.lead) ? `Lead: ${cut(str(plan.lead), 500)}` : null,
    hitos.length ? `\nEtapas:\n${hitos.map((h) => `- ${str(h.title) || str(h.label)} (semanas ${h.weekFrom}–${h.weekTo}): ${cut(str(h.description), 240)}`).join('\n')}` : null,
  ])
  const body = weeks.map((w) => {
    const ts = (Array.isArray(w.tasks) ? w.tasks : [])
      .map((t) => (typeof t === 'string' ? t : t && t.text))
      .filter(Boolean)
      .map((t) => `   · ${cut(t, 200)}`)
    return lines([
      `Semana ${w.n} — ${str(w.title)} [${str(w.type) || 'info'}]`,
      ts.join('\n') || null,
      w.deliver && str(w.deliver.text) ? `   Entrega: ${cut(str(w.deliver.text), 240)}` : null,
    ])
  }).join('\n')
  return lines([head, weeks.length ? `\nSemanas:\n${body}` : null])
}

/**
 * Junta todo en un solo string de contexto para el modelo.
 * { freeText, groups (los bloques YA seleccionados), files: [{name,text}], basePlan }
 * El orden importa: primero lo que escribió una persona a propósito, después los
 * datos de la app, y al final el plan viejo. Si algo se recorta por tamaño, que
 * sea lo de más abajo.
 */
export function buildContextText({ freeText, groups, files, basePlan } = {}) {
  const parts = []

  if (str(freeText)) parts.push(`=== LO QUE ESCRIBIÓ EL EQUIPO ===\n${str(freeText)}`)

  for (const g of (Array.isArray(groups) ? groups : [])) {
    if (!g) continue
    if (typeof g === 'string') { parts.push(g); continue }
    const text = str(g.text)
    if (!text) continue
    parts.push(`=== ${(str(g.label) || str(g.id) || 'CONTEXTO').toUpperCase()} ===\n${text}`)
  }

  for (const f of (Array.isArray(files) ? files : [])) {
    if (!f) continue
    const text = str(f.text)
    if (!text) continue
    parts.push(`=== ARCHIVO: ${str(f.name) || 'sin nombre'} ===\n${cut(text, 20000)}`)
  }

  if (basePlan) {
    const outline = planOutline(basePlan)
    if (outline) parts.push(`=== PLAN ACTUAL (tomalo de base, no lo reescribas de cero salvo que el contexto lo pida) ===\n${outline}`)
  }

  return cut(parts.join('\n\n'), MAX_CONTEXT_CHARS)
}
