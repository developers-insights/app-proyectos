/**
 * intake.js — el cuestionario de despliegue que el cliente completa desde su link.
 *
 * JS PURO: cero React, cero Supabase. Solo datos.
 *
 * POR QUÉ VIVE ACÁ Y NO EN LA BASE: las preguntas cambian mucho más seguido que
 * las respuestas, y cambiarlas tiene que ser un deploy del front y nada más —sin
 * migración, sin tocar la Edge Function—. La base guarda únicamente la respuesta,
 * indexada por `id`. Regla que se rompe sola si no se dice: **un `id` publicado no
 * se renombra nunca**; renombrarlo no rompe nada visible, simplemente deja la
 * respuesta vieja huérfana y la pregunta vuelve a aparecer sin contestar.
 *
 * TIPOS (`kind`):
 *   action    — no es una pregunta, es algo que el cliente tiene que ir a hacer.
 *               Se responde con "ya lo hice".
 *   confirm   — le mostramos un dato que ya tenemos y solo confirma o corrige.
 *   choice    — opciones; la marcada como `recommended` viene preseleccionada.
 *   text      — una línea.
 *   email     — una línea, validada como correo.
 *   emails    — lista de correos (los 12 testers). Trae su propio contador.
 *   longtext  — párrafo.
 *   fields    — varios datos cortos que solo tienen sentido juntos (nombre +
 *               dirección + teléfono de una misma empresa, por ejemplo).
 *
 * `owner: 'abogado'` marca lo que NO puede contestar el cliente solo. No lo
 * escondemos: verlo es parte de la respuesta, porque le avisa que tiene que
 * mover a alguien más y eso tarda.
 */

/** Un `id` publicado no se renombra. Ver el comentario de arriba. */
export const INTAKE_VERSION = 1

// ---------------------------------------------------------------------------
// iRowing
// ---------------------------------------------------------------------------

const IROWING = {
  projectName: 'iRowing',
  intro:
    'Ya está escrito todo lo que se puede escribir: los textos de la ficha, las capturas, ' +
    'la política de privacidad y el instalador firmado. Lo que falta son decisiones tuyas. ' +
    'Casi todas ya tienen una respuesta recomendada: si te parece bien, tocás y seguís.',
  sections: [
    {
      key: 'cuenta',
      title: 'Tu cuenta de Google Play',
      note: 'Esto es lo único urgente. Son diez minutos y sin esto no se puede avanzar con nada.',
    },
    { key: 'identidad', title: 'Quién publica la app' },
    { key: 'lanzamiento', title: 'Cómo sale a la calle' },
    { key: 'producto', title: 'Detalles de la app' },
  ],
  questions: [
    {
      id: 'irowing.verify_device',
      section: 'cuenta',
      kind: 'action',
      urgent: true,
      title: 'Verificá que tenés un celular Android',
      body:
        'Instalá la app **Google Play Console** desde la Play Store e iniciá sesión con ' +
        '`remoindoorenmendoza@gmail.com`. Con abrirla una vez alcanza.',
      why:
        'Google no nos deja ni crear la app hasta que la cuenta esté verificada. Es el único ' +
        'motivo por el que hoy está todo frenado.',
      hint:
        '**¿No tenés un Android?** No hace falta que sea tuyo. Pedile el teléfono prestado a ' +
        'cualquiera cinco minutos —un familiar, alguien del club, un empleado—, entrá con tu ' +
        'cuenta, tocá Verificar y cerrá sesión. La verificación queda en tu cuenta, no en ese ' +
        'teléfono. Lo que no podemos hacer nosotros es entrar en tu lugar: Google exige que sea ' +
        'el titular. Si no conseguís ninguno, decinos y lo resolvemos.',
      doneLabel: 'Ya lo hice',
    },
    {
      id: 'irowing.verify_phone',
      section: 'cuenta',
      kind: 'action',
      urgent: true,
      title: 'Verificá tu teléfono de contacto',
      body:
        'En la consola, entrá a **Cuenta de desarrollador → Datos de contacto** y verificá el ' +
        'número +1 415 724 6732. Te llega un código por SMS.',
      why:
        'Google aclara que este paso **solo lo puede hacer el titular de la cuenta**. Nosotros ' +
        'no lo podemos hacer por vos aunque tengamos acceso.',
      doneLabel: 'Ya lo hice',
    },
    {
      id: 'irowing.owner_confirm',
      section: 'identidad',
      kind: 'confirm',
      title: '¿Confirmás que la app sale a tu nombre?',
      body:
        'Estos datos los sacamos de tu propia cuenta de Google Play, así que ya son oficiales. ' +
        'Los mismos van a figurar en la política de privacidad como responsable de los datos.',
      prefill: [
        ['Titular', 'Leonardo Javier Pedrosa (persona física)'],
        ['Domicilio', '5014 Foothills Road, Lake Oswego, OR 97034'],
        ['País', 'Estados Unidos'],
        ['Sitio web', 'https://irowing.net/'],
      ],
      confirmLabel: 'Sí, son correctos',
      correctLabel: 'Hay algo para corregir',
      correctionPlaceholder: '¿Qué habría que cambiar?',
    },
    {
      id: 'irowing.address_public',
      section: 'identidad',
      kind: 'choice',
      title: 'Ese domicilio queda público. ¿Está bien?',
      why:
        'La política de privacidad tiene que mostrar la dirección del responsable, y hoy la que ' +
        'figura es la de tu casa. Cualquiera que instale la app la puede leer. No es un problema ' +
        'legal — es una decisión tuya, y preferimos que la tomes vos y no nosotros.',
      options: [
        { value: 'publicar', label: 'Publicalo, no me molesta', recommended: false },
        {
          value: 'comercial',
          label: 'Prefiero usar otra dirección',
          hint: 'Nos pasás una dirección postal comercial y usamos esa',
          recommended: true,
        },
        {
          value: 'empresa',
          label: 'Quiero armar una empresa (LLC) primero',
          hint: 'Suma tiempo: hay que constituirla y transferir la cuenta',
        },
      ],
      followUp: { when: 'comercial', kind: 'text', label: 'Dirección que usamos' },
    },
    {
      id: 'irowing.countries',
      section: 'lanzamiento',
      kind: 'choice',
      title: '¿En qué países se publica?',
      why:
        'Si la app queda disponible en Europa o el Reino Unido, la ley nos obliga a designar un ' +
        'representante legal con domicilio allá, con contrato y dirección publicada. Para apps ' +
        'que manejan datos de salud —frecuencia cardíaca, dolencias— no hay excepción. Se puede ' +
        'ampliar más adelante sin rehacer nada.',
      options: [
        {
          value: 'us_ar',
          label: 'Estados Unidos y Argentina',
          hint: 'Sin trámites extra. Se amplía cuando quieras',
          recommended: true,
        },
        { value: 'us', label: 'Solo Estados Unidos' },
        {
          value: 'global',
          label: 'Todo el mundo, Europa incluida',
          hint: 'Implica contratar un representante legal en la UE antes de publicar',
        },
      ],
    },
    {
      id: 'irowing.testers',
      section: 'lanzamiento',
      kind: 'emails',
      min: 12,
      suggested: 14,
      title: 'Los 12 testers',
      why:
        'Google exige que la app pase por una prueba cerrada con 12 personas distintas durante ' +
        '14 días seguidos antes de dejarnos publicarla. El reloj no arranca hasta tener las 12, ' +
        'y si el grupo baja de 12 vuelve a cero. Tu cuenta es personal, así que esto aplica sí o sí.',
      body:
        'Tienen que ser cuentas de **Gmail** reales, y cada persona va a instalar la app y usarla. ' +
        'Sirven remeros del club, familia, amigos — no hace falta que sean técnicos.',
      hint:
        'Cargá 14 o 15 en vez de 12: siempre hay alguien que se olvida de instalar. **Y si no ' +
        'llegás a 12, decinos: nosotros ponemos los que falten.** Google no exige que sean ' +
        'conocidos tuyos. Lo que sí exige es que usen la app de verdad, así que para iRowing lo ' +
        'ideal es gente con acceso a un remo Concept2 — si no, avisanos y lo pensamos juntos.',
      placeholder: 'nombre@gmail.com',
    },
    {
      id: 'irowing.support_email',
      section: 'lanzamiento',
      kind: 'email',
      title: 'Correo de soporte',
      why:
        'Google lo publica en la ficha, a la vista de cualquiera que instale la app. Tiene que ser ' +
        'una casilla que alguien lea de verdad: ahí llegan las consultas y los problemas.',
      hint: 'Puede ser tu correo personal. También puede ser uno nuevo redirigido al tuyo.',
      placeholder: 'soporte@irowing.net',
    },
    {
      id: 'irowing.ai_reports',
      section: 'producto',
      kind: 'choice',
      title: '¿Adónde llegan los reportes del coach con IA?',
      why:
        'La app tiene un chat con inteligencia artificial, y Google exige que exista una forma de ' +
        'reportar una respuesta ofensiva o inapropiada. El botón lo construimos nosotros: solo ' +
        'necesitamos saber a qué casilla mandamos esos reportes.',
      options: [
        { value: 'soporte', label: 'Al mismo correo de soporte', recommended: true },
        { value: 'otro', label: 'A otra dirección' },
      ],
      followUp: { when: 'otro', kind: 'email', label: 'Dirección para los reportes' },
    },
    {
      id: 'irowing.age_18',
      section: 'producto',
      kind: 'choice',
      title: 'La app se declara para mayores de 18. ¿Confirmás?',
      why:
        'Hoy pide confirmar la edad antes de habilitar el chat con IA y el tratamiento de datos ' +
        'de salud, y así está declarado en la política. Bajarlo a 16 obliga a rehacer la ' +
        'clasificación de contenido y a sumar controles parentales.',
      options: [
        { value: 'si', label: 'Sí, 18+', recommended: true },
        { value: 'menores', label: 'Espero que la usen menores de edad' },
      ],
    },
    {
      id: 'irowing.pricing',
      section: 'producto',
      kind: 'choice',
      title: '¿La app es gratis?',
      why:
        'Agregar suscripciones más adelante es simple. Sacarlas una vez publicadas, no. Y las ' +
        'compras dentro de la app disparan requisitos fiscales y de facturación en cada país.',
      options: [
        { value: 'gratis', label: 'Gratis, sin compras', recommended: true },
        { value: 'suscripcion', label: 'Con suscripción desde el día uno' },
        { value: 'pensar', label: 'Todavía lo estoy pensando' },
      ],
    },
    {
      id: 'irowing.concept2',
      section: 'producto',
      kind: 'choice',
      title: 'La conexión con el Logbook de Concept2',
      why:
        'Pediste que la app se sincronice con el Logbook. El código ya está escrito, pero hay que ' +
        'registrar iRowing como aplicación ante Concept2, y eso crea una cuenta de desarrollador allá.',
      options: [
        { value: 'mismo', label: 'A mi nombre, igual que la cuenta de Play', recommended: true },
        { value: 'otro', label: 'A otro nombre' },
        { value: 'despues', label: 'Dejémoslo para después de publicar' },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// MAREX
// ---------------------------------------------------------------------------

const MAREX = {
  projectName: 'MAREX',
  intro:
    'Los textos de las dos fichas, las respuestas de los formularios de Google y los borradores ' +
    'legales ya están escritos. Faltan datos de la empresa y algunas decisiones. Las que necesitan ' +
    'un abogado están marcadas: conviene mandárselas hoy, porque no se resuelven en 48 horas.',
  sections: [
    {
      key: 'cuenta',
      title: 'Tu cuenta de Google Play',
      note: 'Esto es lo único urgente. Son diez minutos y sin esto no se puede avanzar con nada.',
    },
    { key: 'empresa', title: 'Datos de la empresa' },
    { key: 'negocio', title: 'Decisiones del negocio' },
    { key: 'lanzamiento', title: 'Cómo salen a la calle' },
    { key: 'abogado', title: 'Lo que necesita un abogado', owner: 'abogado' },
  ],
  questions: [
    {
      id: 'marex.verify_device',
      section: 'cuenta',
      kind: 'action',
      urgent: true,
      title: 'Verificá que tenés un celular Android',
      body:
        'Instalá la app **Google Play Console** desde la Play Store e iniciá sesión con ' +
        '`admin@marexcleaningsolution.com`. Con abrirla una vez alcanza.',
      why: 'Google no nos deja ni crear las apps hasta que la cuenta esté verificada.',
      hint:
        '**¿No tenés un Android?** No hace falta que sea tuyo. Pedile el teléfono prestado a ' +
        'cualquiera cinco minutos, entrá con tu cuenta, tocá Verificar y cerrá sesión. La ' +
        'verificación queda en tu cuenta, no en ese teléfono. Lo que no podemos hacer nosotros ' +
        'es entrar en tu lugar: Google exige que sea el titular. Si no conseguís ninguno, ' +
        'decinos y lo resolvemos.',
      doneLabel: 'Ya lo hice',
    },
    {
      id: 'marex.verify_phone',
      section: 'cuenta',
      kind: 'action',
      urgent: true,
      title: 'Verificá tu teléfono de contacto',
      body:
        'En la consola, entrá a **Cuenta de desarrollador → Datos de contacto** y verificá el ' +
        'número. Te llega un código por SMS.',
      why:
        'Google aclara que este paso **solo lo puede hacer el titular de la cuenta**. Nosotros no ' +
        'lo podemos hacer por vos aunque tengamos acceso.',
      doneLabel: 'Ya lo hice',
    },
    {
      id: 'marex.entity',
      section: 'empresa',
      kind: 'choice',
      title: '¿MAREX está constituida como empresa?',
      why:
        'Hoy la cuenta de Google Play figura a nombre de **Jose Daniel Anaya**, persona física, ' +
        'con domicilio en 2660 Zion Church Rd, Concord, NC. Ese domicilio se publica en la política ' +
        'de privacidad. Si existe la empresa, conviene que todo salga a su nombre.',
      options: [
        { value: 'llc', label: 'Sí, es una LLC', recommended: true },
        { value: 'corp', label: 'Sí, es una corporation' },
        { value: 'persona', label: 'No, va a mi nombre personal' },
        { value: 'en_tramite', label: 'Está en trámite' },
      ],
    },
    {
      id: 'marex.entity_details',
      section: 'empresa',
      kind: 'fields',
      title: 'Los datos de la empresa, exactamente como figuran en la inscripción',
      why:
        'Van a un solo archivo nuestro y desde ahí se propagan solos a la política de privacidad, ' +
        'los términos, la política de cookies y los tres documentos de verificación de antecedentes, ' +
        'en inglés y en español a la vez. Es el paso que más marcadores pendientes cierra de una vez.',
      fields: [
        { key: 'legal_name', label: 'Razón social', placeholder: 'MAREX Home Services, LLC', required: true },
        { key: 'state', label: 'Estado de constitución', placeholder: 'North Carolina', required: true },
        { key: 'address', label: 'Domicilio registrado', placeholder: '2660 Zion Church Rd, Concord, NC 28025', required: true },
      ],
      note:
        'La ley antispam de Estados Unidos exige un domicilio postal real en cada email de ' +
        'marketing. Es el requisito que más se saltea y el más fácil de probar en contra.',
    },
    {
      id: 'marex.emails',
      section: 'empresa',
      kind: 'fields',
      title: 'Correos y página de contacto',
      why:
        'Tienen que ser casillas que alguien lea. La de avisos legales figura en la cláusula de ' +
        'arbitraje como la dirección donde un usuario puede desistir dentro de los 30 días: tiene ' +
        'que funcionar desde el primer día.',
      fields: [
        { key: 'support', label: 'Soporte general', placeholder: 'support@marexcleaningsolution.com', required: true },
        { key: 'privacy', label: 'Privacidad', placeholder: 'Puede ser el mismo que soporte' },
        { key: 'legal', label: 'Avisos legales', placeholder: 'Puede ser el mismo que soporte' },
        { key: 'support_url', label: 'Página de soporte', placeholder: 'https://marexcleaningsolution.com/support' },
      ],
    },
    {
      id: 'marex.developer_name',
      section: 'empresa',
      kind: 'choice',
      title: 'El nombre que ven los usuarios debajo de las apps',
      why:
        'Hoy Google muestra **«InsightsApps (Marex)»** — o sea, el nombre de la agencia que ' +
        'desarrolla, no el de tu marca. Se puede cambiar, solo necesitamos tu visto bueno.',
      options: [
        { value: 'marex', label: 'Cambiarlo a «MAREX»', recommended: true },
        { value: 'otro', label: 'Ponerle otro nombre' },
        { value: 'dejar', label: 'Dejarlo como está' },
      ],
      followUp: { when: 'otro', kind: 'text', label: '¿Qué nombre?' },
    },
    {
      id: 'marex.cra',
      section: 'negocio',
      kind: 'fields',
      title: 'La agencia de verificación de antecedentes',
      why:
        'Hoy el alta de profesionales de limpieza está **bloqueada a propósito** hasta tener estos ' +
        'datos. La ley federal exige que el teléfono de la agencia figure en la notificación que ' +
        'recibe un trabajador rechazado: dejar el alta abierta sin eso sería juntar consentimientos ' +
        'que no cumplen la ley.',
      fields: [
        { key: 'name', label: 'Nombre de la agencia', placeholder: 'Checkr, Inc.' },
        { key: 'address', label: 'Dirección' },
        { key: 'phone', label: 'Teléfono' },
        { key: 'website', label: 'Sitio web' },
      ],
      note: 'Si todavía no elegiste agencia, decilo igual — así dejamos de esperar un dato que no existe.',
      allowSkip: 'Todavía no la elegimos',
    },
    {
      id: 'marex.stripe',
      section: 'negocio',
      kind: 'choice',
      title: 'La clave de Stripe de producción',
      why:
        'La app está usando una clave de prueba: simula cobrar sin cobrar. El sistema **bloquea la ' +
        'compilación de producción** cuando la detecta, justamente para que eso no salga a la calle.',
      options: [
        { value: 'tengo', label: 'La tengo, se la paso a Manuel', recommended: true },
        { value: 'ayuda', label: 'Necesito ayuda para sacarla' },
        { value: 'sin_pagos', label: 'Lancemos sin cobros por ahora' },
      ],
      note: 'No la escribas acá. Mandásela a Manuel por un canal privado.',
    },
    {
      id: 'marex.geography',
      section: 'negocio',
      kind: 'text',
      title: '¿En qué ciudades o estados se lanza primero?',
      why:
        'Importa más de lo que parece: si los profesionales cuentan como contratistas independientes ' +
        'o como empleados se juzga estado por estado, y hay estados mucho más duros que otros. La ' +
        'revisión legal depende de esta respuesta.',
      placeholder: 'Concord y Charlotte, NC',
    },
    {
      id: 'marex.numbers',
      section: 'negocio',
      kind: 'fields',
      title: 'Los números del negocio',
      why: 'Aparecen en los Términos y en algunos textos de la ficha de la tienda.',
      fields: [
        { key: 'commission', label: 'Comisión de la plataforma', placeholder: '20%' },
        { key: 'dispute', label: 'Plazo para abrir una disputa', placeholder: '72 horas' },
        { key: 'guarantee', label: 'Garantía de satisfacción', placeholder: '24 horas' },
        { key: 'cancellation', label: 'Cancelación sin cargo, y cargo fuera de ese plazo', placeholder: '24 h antes; después, 25%' },
      ],
    },
    {
      id: 'marex.icons',
      section: 'lanzamiento',
      kind: 'choice',
      title: 'Los íconos de las dos apps',
      why:
        'MAREX Clean y MAREX Pro necesitan íconos distintos: si son iguales, Google los lee como app ' +
        'duplicada y rechaza. Preparamos una versión diferenciada invirtiendo los colores de la marca.',
      options: [
        { value: 'ok', label: 'Adelante con la propuesta', recommended: true },
        { value: 'ver', label: 'Quiero verlos antes de decidir' },
        { value: 'disenador', label: 'Los hace mi diseñador' },
      ],
    },
    {
      id: 'marex.testers',
      section: 'lanzamiento',
      kind: 'emails',
      min: 12,
      suggested: 14,
      title: 'Los 12 testers',
      why:
        'Google exige una prueba cerrada con 12 personas distintas durante 14 días seguidos antes ' +
        'de dejarnos publicar. Tu cuenta es personal, así que aplica sí o sí. Son dos apps, pero ' +
        'las mismas personas sirven para las dos: conviene arrancar los dos relojes el mismo día.',
      body: 'Tienen que ser cuentas de **Gmail** reales, y cada persona va a instalar la app y usarla.',
      hint:
        'Cargá 14 o 15 en vez de 12: si el grupo baja de 12, el contador vuelve a cero. **Y si ' +
        'no llegás a 12, decinos: nosotros ponemos los que falten.** Google no exige que sean ' +
        'conocidos tuyos, pero sí que usen la app de verdad.',
      placeholder: 'nombre@gmail.com',
    },
    {
      id: 'marex.counsel',
      section: 'abogado',
      owner: 'abogado',
      kind: 'choice',
      title: '¿Tenés un abogado con matrícula en Estados Unidos?',
      why:
        'MAREX verifica antecedentes, y la ley que regula eso paga los honorarios del abogado del ' +
        'demandante además de la indemnización. Eso es exactamente lo que hace que valga la pena ' +
        'demandar, y por eso estas seis decisiones no las podemos redactar nosotros.',
      body:
        'Lo que necesita decidir: **la clasificación de los trabajadores** (contratista o empleado), ' +
        '**el proveedor de arbitraje** y su reglamento, **el tope de responsabilidad**, ' +
        '**el plazo para disputar un informe de antecedentes**, **el agente DMCA** —y registrarlo ante ' +
        'la Oficina de Derechos de Autor, porque sin registro la protección no existe— y ' +
        '**los plazos de retención de datos**.',
      options: [
        { value: 'si', label: 'Sí, se lo mando hoy', recommended: true },
        { value: 'buscando', label: 'Todavía no tengo, necesito una recomendación' },
        { value: 'sin', label: 'Prefiero lanzar sin revisión legal' },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------

/** Cuestionarios por nombre de proyecto, tal cual figura en la app. */
const BY_PROJECT = {
  iRowing: IROWING,
  'MAREX Cleaning Marketplace': MAREX,
}

/** El cuestionario de un proyecto, o `null` si ese proyecto no tiene uno. */
export function intakeFor(projectName) {
  return BY_PROJECT[projectName] || null
}

/** ¿Está contestada? Un `false` explícito o un `0` cuentan como respuesta; `''` y `[]` no. */
export function isAnswered(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.values(value).some(isAnswered)
  return true
}

/**
 * Progreso del cuestionario. Las preguntas del abogado cuentan igual: esconderlas
 * del total daría un 100% que miente sobre lo que falta para publicar.
 */
export function intakeProgress(intake, answers) {
  const qs = (intake && intake.questions) || []
  const done = qs.filter((q) => isAnswered(answers && answers[q.id])).length
  return { done, total: qs.length, pct: qs.length ? Math.round((done / qs.length) * 100) : 0 }
}

/** Lo urgente que todavía no está hecho. Es lo que abre la vista. */
export function pendingUrgent(intake, answers) {
  return ((intake && intake.questions) || []).filter(
    (q) => q.urgent && !isAnswered(answers && answers[q.id]),
  )
}
