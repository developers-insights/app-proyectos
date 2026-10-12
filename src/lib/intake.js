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
 *
 * `simple` — una o dos frases que explican la pregunta sin ningún término
 * técnico, como se lo diría un amigo. Va colapsado detrás de un desplegable
 * ("¿No entendés del todo?") porque el cliente que ya entendió el `why` no
 * necesita leerlo dos veces; el que no entendió, sí. Toda pregunta lo tiene.
 */

/** Un `id` publicado no se renombra. Ver el comentario de arriba. */
export const INTAKE_VERSION = 2

// ---------------------------------------------------------------------------
// iRowing
// ---------------------------------------------------------------------------

const IROWING = {
  projectName: 'iRowing',
  intro:
    'Ya está escrito todo lo que se puede escribir: los textos de la ficha, las capturas, ' +
    'la política de privacidad y el instalador firmado. Lo que falta son decisiones tuyas. ' +
    'Están las de Android y también las del iPhone, que es el paso siguiente: contestás todo ' +
    'de una vez y después no frenamos. Casi todas ya tienen una respuesta recomendada: si te ' +
    'parece bien, tocás y seguís.',
  sections: [
    { key: 'identidad', title: 'Quién publica la app' },
    { key: 'lanzamiento', title: 'Cómo sale a la calle' },
    { key: 'producto', title: 'Detalles de la app' },
    {
      key: 'apple',
      title: 'La App Store del iPhone',
      note:
        'Esto es para la tienda de Apple, que es el paso siguiente. Contestalo ahora aunque ' +
        'todavía estemos con Android: es lo que hace que no frenemos al llegar ahí.',
    },
  ],
  questions: [
    {
      id: 'irowing.owner_confirm',
      section: 'identidad',
      kind: 'confirm',
      title: '¿Confirmás que la app sale a tu nombre?',
      body:
        'Estos datos los sacamos de tu propia cuenta de Google Play, así que ya son oficiales. ' +
        'Los mismos van a figurar en la política de privacidad como responsable de los datos.',
      simple:
        'Vamos a poner tu nombre y tu dirección en los papeles oficiales de la app. Solo ' +
        'necesitamos que confirmes que están bien escritos antes de que quede fijo.',
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
      simple:
        'Tu dirección de casa va a quedar visible para cualquiera que abra la política de ' +
        'privacidad. Elegís si te da igual, si preferís usar otra dirección, o si querés armar ' +
        'antes una empresa para que figure esa en vez de la tuya.',
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
        'que manejan datos de salud —frecuencia cardíaca, dolencias— no hay excepción. Y Apple ' +
        'suma lo suyo: para vender en la Unión Europea exige declararse comerciante y publicar ' +
        'tu teléfono, tu dirección y tu correo en la ficha, a la vista de cualquiera. Se puede ' +
        'ampliar más adelante sin rehacer nada.',
      simple:
        'Elegís en qué países se puede bajar la app. Cuantos más países —sobre todo en Europa—, ' +
        'más papeles hay que sumar antes de publicar.',
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
      simple:
        'Antes de que cualquiera pueda bajar la app, Google pide que 12 personas la prueben ' +
        'durante dos semanas seguidas. Nos pasás sus mails de Gmail y arrancamos ese conteo.',
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
      simple:
        'Es el mail que va a aparecer en la ficha de la app para que te escriban si tienen un ' +
        'problema. Tiene que ser uno que realmente revises.',
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
      simple:
        'Si a alguien no le gusta lo que le contestó el chat con IA, va a poder avisarlo con un ' +
        'botón. Elegís a qué mail nos llega ese aviso.',
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
      title: '¿A qué edad se puede usar la app?',
      why:
        'Hoy pide confirmar que sos mayor de 18 antes de habilitar el chat con IA y el ' +
        'tratamiento de datos de salud, y así está declarado en la política. Es una decisión ' +
        'de producto tuya: si querés abrirla a menores, la ajustamos.',
      simple:
        'Hoy la app pide confirmar que sos mayor de edad antes de usar el chat con IA. Nos decís ' +
        'si eso sigue así o si querés que también la usen menores.',
      options: [
        { value: 'si', label: '18+, como está hoy' },
        { value: 'menores', label: 'También la van a usar menores de edad' },
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
      simple:
        'Definís si la app se baja gratis o si va a cobrar algo desde el arranque. Sumar un ' +
        'cobro después es fácil; sacarlo una vez publicada, no.',
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
      simple:
        'Para que la app se conecte con el Logbook de tu remo, hay que anotarla ante Concept2 ' +
        'como aplicación oficial. Elegís a nombre de quién queda esa registración.',
      options: [
        { value: 'mismo', label: 'A mi nombre, igual que la cuenta de Play', recommended: true },
        { value: 'otro', label: 'A otro nombre' },
        { value: 'despues', label: 'Dejémoslo para después de publicar' },
      ],
    },
    {
      id: 'irowing.apple_holder',
      section: 'apple',
      kind: 'choice',
      title: '¿A nombre de quién va la cuenta de Apple?',
      why:
        'Igual que en Google, quien figure como titular es quien firma con Apple y quien ' +
        'aparece como responsable en la ficha. La diferencia es el trámite: si la cuenta va a ' +
        'nombre de una empresa, Apple pide un número D-U-N-S y la verificación tarda una o dos ' +
        'semanas más.',
      simple:
        'Necesitamos abrir una cuenta de desarrollador de Apple, igual que ya hiciste con Google. ' +
        'Elegís si va a tu nombre, al de una empresa, o si preferís que la abramos nosotros.',
      options: [
        {
          value: 'mismo',
          label: 'A mi nombre, igual que Google Play',
          hint: 'Es lo más rápido: la verificación suele salir en 24 o 48 horas',
          recommended: true,
        },
        { value: 'empresa', label: 'A nombre de una empresa', hint: 'Suma el trámite del D-U-N-S y una o dos semanas' },
        {
          value: 'insights',
          label: 'Que la ponga Insights a su nombre',
          hint: 'Salimos antes, pero la app queda alojada en nuestra cuenta y no en la tuya',
        },
      ],
    },
    {
      id: 'irowing.apple_device',
      section: 'apple',
      kind: 'choice',
      title: '¿Tenés a mano un iPhone o un iPad?',
      why:
        'Apple verifica la identidad del titular desde su app Apple Developer, que solo existe ' +
        'en iPhone y iPad: se escanea un documento y listo. Es el mismo tipo de paso que ya ' +
        'hiciste con el Android, y también lo tiene que hacer el titular en persona.',
      simple:
        'Apple pide verificar quién sos escaneando tu documento desde un iPhone o iPad. Sin uno ' +
        'de esos aparatos a mano, ese paso no se puede hacer.',
      body:
        'También hace falta que tu Apple ID tenga activada la verificación en dos pasos. Sin ' +
        'eso, Apple no deja ni empezar.',
      options: [
        { value: 'si', label: 'Sí, tengo uno', recommended: true },
        {
          value: 'prestado',
          label: 'No, pero consigo uno prestado',
          hint: 'Alcanza con cinco minutos: la verificación queda en tu cuenta, no en el teléfono',
        },
        { value: 'no', label: 'No consigo ninguno', hint: 'Decinos y lo encaramos por la web, que es más lento pero sale' },
      ],
    },
    {
      id: 'irowing.apple_fee',
      section: 'apple',
      kind: 'choice',
      title: 'Los US$99 por año de Apple',
      why:
        'Es una suscripción anual, no un pago único: el día que se deja de pagar, la app ' +
        'desaparece de la App Store. Google fueron US$25 una sola vez. Preferimos que lo sepas ' +
        'ahora y no cuando llegue la primera renovación.',
      simple:
        'A diferencia de Google, que cobra una sola vez, Apple cobra todos los años. Si algún ' +
        'año no se paga, la app se cae de la tienda.',
      options: [
        {
          value: 'cliente',
          label: 'Lo pago yo con mi tarjeta',
          hint: 'La cuenta queda tuya desde el día uno',
          recommended: true,
        },
        {
          value: 'ayuda',
          label: 'No tengo una tarjeta que sirva, necesito ayuda',
          hint: 'Lo vemos juntos — la carga la seguís poniendo vos, nunca la adelantamos nosotros',
        },
      ],
    },
    {
      id: 'irowing.support_url',
      section: 'apple',
      kind: 'choice',
      title: 'Apple pide una página de soporte, no le alcanza un correo',
      why:
        'Google se conforma con una casilla; Apple exige una dirección web pública donde ' +
        'alguien pueda pedir ayuda, y la abre durante la revisión. Si no existe o está caída, ' +
        'rechaza la app.',
      simple:
        'Apple no acepta solo un mail: pide una página web donde alguien pueda pedir ayuda. Nos ' +
        'decís si ya tenés una, si la vas a armar vos, o si preferís que hablemos de armarla nosotros.',
      options: [
        { value: 'tengo', label: 'Ya tengo una página de soporte' },
        { value: 'yo_agrego', label: 'No tengo, la agrego yo mismo a mi web' },
        {
          value: 'consultar',
          label: 'No tengo, ¿la pueden armar ustedes?',
          hint: 'Lo vemos aparte — no viene incluido en lo que ya cotizamos',
        },
      ],
      followUp: { when: 'tengo', kind: 'text', label: 'La dirección de esa página' },
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
    'legales ya están escritos. Faltan algunos datos y decisiones. Están también las del iPhone, ' +
    'que es el paso siguiente: contestás todo de una vez y después no frenamos.',
  sections: [
    { key: 'empresa', title: 'Datos de la empresa' },
    { key: 'negocio', title: 'Decisiones del negocio' },
    { key: 'lanzamiento', title: 'Cómo salen a la calle' },
    {
      key: 'apple',
      title: 'La App Store del iPhone',
      note:
        'Esto es para la tienda de Apple, que es el paso siguiente. Contestalo ahora aunque ' +
        'todavía estemos con Android: es lo que hace que no frenemos al llegar ahí.',
    },
  ],
  questions: [
    {
      id: 'marex.emails',
      section: 'empresa',
      kind: 'fields',
      title: 'Correos y página de contacto',
      why:
        'Tienen que ser casillas que alguien lea. La de avisos legales figura en la cláusula de ' +
        'arbitraje como la dirección donde un usuario puede desistir dentro de los 30 días: tiene ' +
        'que funcionar desde el primer día. Y la página de soporte no es opcional del lado de ' +
        'Apple: exige una dirección web pública donde se pueda pedir ayuda, y la abre durante la ' +
        'revisión. Si todavía no existe, decinos y lo charlamos aparte — no viene incluido en lo ' +
        'que ya cotizamos.',
      simple:
        'Son los mails que van a aparecer en distintos lugares de las apps y los documentos ' +
        'legales: soporte, privacidad y avisos legales. Mejor que sean casillas que realmente uses.',
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
      simple:
        'Hoy figura el nombre de nuestra agencia debajo del nombre de las apps en la tienda, en ' +
        'vez de MAREX. Confirmás si lo cambiamos a tu marca.',
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
      simple:
        'Antes de dejar que un profesional de limpieza se sume a la plataforma, hay que revisarle ' +
        'los antecedentes con una agencia especializada. Nos decís cuál van a usar.',
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
      id: 'marex.geography',
      section: 'negocio',
      kind: 'text',
      title: '¿En qué ciudades o estados se lanza primero?',
      why:
        'Importa más de lo que parece: si los profesionales cuentan como contratistas independientes ' +
        'o como empleados se juzga estado por estado, y hay estados mucho más duros que otros. La ' +
        'revisión legal depende de esta respuesta.',
      simple:
        'Nos interesa saber dónde arranca el servicio porque las leyes laborales cambian de un ' +
        'estado a otro, y eso afecta cómo se redactan los contratos.',
      placeholder: 'Concord y Charlotte, NC',
    },
    {
      id: 'marex.numbers',
      section: 'negocio',
      kind: 'fields',
      title: 'Los números del negocio',
      why: 'Aparecen en los Términos y en algunos textos de la ficha de la tienda.',
      simple:
        'Son las reglas de plata del negocio: cuánto se queda la plataforma, cuánto tiempo tiene ' +
        'alguien para reclamar, y qué pasa si cancelan a último momento. Van escritas en los Términos.',
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
      simple:
        'MAREX Clean y MAREX Pro necesitan verse distintas en la tienda, no solo por dentro. Te ' +
        'mostramos una propuesta de dos íconos parecidos pero diferenciables.',
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
      simple:
        'Antes de que cualquiera pueda bajar las apps, Google pide que 12 personas las prueben ' +
        'durante dos semanas seguidas. Sirven las mismas 12 personas para las dos apps.',
      body: 'Tienen que ser cuentas de **Gmail** reales, y cada persona va a instalar la app y usarla.',
      hint:
        'Cargá 14 o 15 en vez de 12: si el grupo baja de 12, el contador vuelve a cero. **Y si ' +
        'no llegás a 12, decinos: nosotros ponemos los que falten.** Google no exige que sean ' +
        'conocidos tuyos, pero sí que usen la app de verdad.',
      placeholder: 'nombre@gmail.com',
    },
    {
      id: 'marex.countries',
      section: 'lanzamiento',
      kind: 'choice',
      title: '¿En qué países se publican las apps?',
      why:
        'Las tiendas las ofrecen en todo el mundo por defecto, y eso no es gratis. Si quedan ' +
        'disponibles en la Unión Europea, Apple exige declararte comerciante y publicar tu ' +
        'teléfono, tu dirección y tu correo en la ficha; y la ley europea de datos pide designar ' +
        'un representante con domicilio allá. Para un servicio de limpieza que se presta en ' +
        'Carolina del Norte, no tiene sentido pagar eso.',
      simple:
        'Elegís en qué países se pueden bajar las apps. Si en algún momento entran a Europa, se ' +
        'suman trámites que hoy no hacen falta.',
      options: [
        {
          value: 'us',
          label: 'Solo Estados Unidos',
          hint: 'Sin trámites extra. Se amplía cuando quieras, sin rehacer nada',
          recommended: true,
        },
        { value: 'us_latam', label: 'Estados Unidos y algunos países de Latinoamérica' },
        { value: 'global', label: 'Todo el mundo, Europa incluida', hint: 'Implica el trámite europeo antes de publicar' },
      ],
    },
    {
      id: 'marex.apple_holder',
      section: 'apple',
      kind: 'choice',
      title: '¿A nombre de quién va la cuenta de Apple?',
      why:
        'Una sola cuenta de Apple alcanza para las dos apps. Quien figure como titular es quien ' +
        'firma con Apple y quien aparece como responsable en las fichas. Igual que en Google Play, ' +
        'va a nombre de una persona: la verificación suele salir en 24 o 48 horas.',
      simple:
        'Necesitamos abrir una cuenta de desarrollador de Apple para las dos apps. Decidís a ' +
        'nombre de quién queda.',
      options: [
        { value: 'persona', label: 'A mi nombre personal' },
        { value: 'otro', label: 'A otro nombre' },
      ],
      followUp: {
        persona: { label: 'Tu nombre completo, tal cual querés que figure' },
        otro: { label: '¿A nombre de quién?' },
      },
    },
    {
      id: 'marex.apple_device',
      section: 'apple',
      kind: 'choice',
      title: '¿Tenés a mano un iPhone o un iPad?',
      why:
        'Apple verifica la identidad del titular desde su app Apple Developer, que solo existe ' +
        'en iPhone y iPad: se escanea un documento y listo. Es el mismo tipo de paso que hiciste ' +
        'con el Android, y también lo tiene que hacer el titular en persona.',
      simple:
        'Apple pide verificar quién sos escaneando tu documento desde un iPhone o iPad. Sin uno ' +
        'de esos aparatos a mano, ese paso no se puede hacer.',
      body:
        'También hace falta que el Apple ID tenga activada la verificación en dos pasos. Sin eso, ' +
        'Apple no deja ni empezar.',
      options: [
        { value: 'si', label: 'Sí, tengo uno', recommended: true },
        {
          value: 'prestado',
          label: 'No, pero consigo uno prestado',
          hint: 'Alcanza con cinco minutos: la verificación queda en tu cuenta, no en el teléfono',
        },
        { value: 'no', label: 'No consigo ninguno', hint: 'Decinos y lo encaramos por la web, que es más lento pero sale' },
      ],
    },
    {
      id: 'marex.apple_fee',
      section: 'apple',
      kind: 'choice',
      title: 'Los US$99 por año de Apple',
      why:
        'Es una suscripción anual, no un pago único: el día que se deja de pagar, las apps ' +
        'desaparecen de la App Store. Google fueron US$25 una sola vez. Con una cuenta alcanza ' +
        'para MAREX Clean y MAREX Pro, así que el costo no se duplica.',
      simple:
        'A diferencia de Google, que cobra una sola vez, Apple cobra todos los años. Con una ' +
        'cuenta alcanza para las dos apps.',
      options: [
        {
          value: 'cliente',
          label: 'Lo pago yo con mi tarjeta',
          hint: 'La cuenta queda tuya desde el día uno',
          recommended: true,
        },
        {
          value: 'ayuda',
          label: 'No tengo una tarjeta que sirva, necesito ayuda',
          hint: 'Lo vemos juntos — la carga la seguís poniendo vos, nunca la adelantamos nosotros',
        },
      ],
    },
    {
      id: 'marex.public_phone',
      section: 'apple',
      kind: 'text',
      title: 'Un teléfono de contacto que pueda quedar público',
      why:
        'Google publica datos de contacto del desarrollador en la ficha, y si algún día las apps ' +
        'se publican en Europa, Apple obliga a mostrar teléfono, dirección y correo del ' +
        'responsable. Tenerlo ahora nos evita frenar justo al final.',
      simple:
        'Es un teléfono que va a poder quedar visible para cualquiera, así que mejor uno del ' +
        'negocio y no tu celular personal.',
      hint: 'Ideal el teléfono del negocio, no el personal: es el que va a ver cualquiera.',
      placeholder: '+1 704 000 0000',
    },
  ],
}

// ---------------------------------------------------------------------------
// Comunidad Latina
// ---------------------------------------------------------------------------

// Es una PWA en comunidadlatina.com, no una app de tienda: acá no hay testers ni
// cuentas de Google Play/Apple. Publicarla en tiendas se dejó fuera de alcance en
// la call del 27/7 ("cambio de producto, no una tarea"); no se pregunta para no
// prometer algo que no está cotizado.
const COMUNIDAD_LATINA = {
  projectName: 'Comunidad Latina',
  intro:
    'La plataforma ya está construida y funcionando en comunidadlatina.com. Para abrirla a ' +
    'gente real faltan cosas que no podemos hacer nosotros: cuentas a tu nombre, datos ' +
    'legales y algunas decisiones. Casi todas tienen una respuesta recomendada: si te parece ' +
    'bien, tocás y seguís.',
  sections: [
    { key: 'cuentas', title: 'Las cuentas a tu nombre' },
    { key: 'datos', title: 'Lo que queda a la vista' },
    { key: 'servicios', title: 'Lo que falta encender' },
    { key: 'lanzamiento', title: 'El día que abrimos' },
  ],
  questions: [
    {
      id: 'cl.accounts_email',
      section: 'cuentas',
      kind: 'email',
      title: 'El correo nuevo para todas las cuentas',
      why:
        'Nos pediste cuentas nuevas, sin mezclarlas con las que te abrió otro proveedor. Para ' +
        'eso conviene un único correo, tuyo, con el que se abren todas: la base de datos, el ' +
        'hosting, Stripe y los servicios chicos. Si mañana cambia el equipo que te trabaja, el ' +
        'acceso sigue siendo tuyo.',
      simple:
        'Es el mail con el que vamos a abrir todas las cuentas de la plataforma. Tiene que ser ' +
        'tuyo y nuevo, para que nada quede mezclado con otros proyectos.',
      hint:
        'Ideal uno del propio dominio, como admin@comunidadlatina.com. Activale la verificación ' +
        'en dos pasos: es la llave de todo.',
      placeholder: 'admin@comunidadlatina.com',
    },
    {
      id: 'cl.hosting',
      section: 'cuentas',
      kind: 'choice',
      title: 'La base de datos y el hosting, a tu nombre',
      why:
        'Hoy la plataforma vive en cuentas de Insights. Para que sea tuya hay que mudarla a dos ' +
        'cuentas a tu nombre: Supabase (la base de datos, desde US$25 por mes) y Vercel (el ' +
        'hosting, desde US$20 por mes). Los planes gratis no sirven: el de Supabase apaga el ' +
        'proyecto si pasa una semana sin uso, y el de Vercel prohíbe el uso comercial. La mudanza ' +
        'se hace sin cortar el servicio.',
      simple:
        'La plataforma tiene que vivir en cuentas tuyas y no en las nuestras. Son dos servicios ' +
        'que se pagan por mes con tu tarjeta.',
      options: [
        {
          value: 'yo',
          label: 'Abro las dos cuentas con mi tarjeta y los invito',
          hint: 'Te pasamos el paso a paso. Son unos 15 minutos',
          recommended: true,
        },
        { value: 'llamada', label: 'Prefiero hacerlo con ustedes en una llamada' },
        {
          value: 'ayuda',
          label: 'No tengo una tarjeta que sirva, necesito ayuda',
          hint: 'Lo vemos juntos — la tarjeta la seguís poniendo vos, nunca adelantamos nosotros',
        },
      ],
    },
    {
      id: 'cl.legal_entity',
      section: 'datos',
      kind: 'fields',
      title: '¿Quién es el responsable legal de la plataforma?',
      why:
        'La política de privacidad y los términos tienen que decir quién es el responsable de ' +
        'los datos y dónde se lo puede encontrar. Hoy no nombran a nadie. Stripe, además, pide ' +
        'exactamente estos mismos datos para abrir la cuenta de cobros.',
      simple:
        'Necesitamos saber a nombre de quién está la plataforma —una persona o una empresa— y ' +
        'su dirección, para ponerlo en los papeles legales.',
      fields: [
        { key: 'name', label: 'Nombre o razón social', placeholder: 'Comunidad Latina LLC', required: true },
        { key: 'address', label: 'Dirección postal', placeholder: 'Calle, ciudad, estado y código postal' },
        { key: 'legal_email', label: 'Correo para avisos legales', placeholder: 'Puede ser el mismo de soporte' },
      ],
      note: 'La dirección queda pública. Si no querés mostrar la de tu casa, usá una postal comercial.',
    },
    {
      id: 'cl.support_email',
      section: 'datos',
      kind: 'confirm',
      title: '¿Este es el correo de soporte?',
      body:
        'Es el que aparece en el botón de ayuda de la app y en las páginas legales. Ahí van a ' +
        'escribir los usuarios con problemas, así que tiene que leerlo alguien todos los días.',
      simple:
        'Es el mail al que te va a escribir la gente cuando algo no le anda. Confirmás que es ' +
        'el correcto o nos pasás otro.',
      prefill: [['Soporte', 'comunidadlatinallc@gmail.com']],
      confirmLabel: 'Sí, ese es',
      correctLabel: 'Quiero usar otro',
      correctionPlaceholder: '¿Qué correo usamos?',
    },
    {
      id: 'cl.domain',
      section: 'datos',
      kind: 'choice',
      title: '¿Quién maneja el dominio comunidadlatina.com?',
      why:
        'Hoy los correos de la plataforma —la bienvenida, recuperar la contraseña— salen desde ' +
        'un dominio nuestro, no del tuyo. Para que salgan de @comunidadlatina.com hay que sumarle ' +
        'unos registros al dominio. Y algo más importante: si el dominio vence sin renovarse, se ' +
        'cae todo. Tiene que estar a tu nombre y con renovación automática.',
      simple:
        'Necesitamos tocar una configuración del dominio para que los mails lleguen con tu ' +
        'nombre y no con el nuestro. Nos decís quién tiene la cuenta donde se compró.',
      options: [
        {
          value: 'yo',
          label: 'Lo manejo yo: pásenme los cambios y los cargo',
          hint: 'Son tres o cuatro líneas para copiar y pegar',
          recommended: true,
        },
        { value: 'acceso', label: 'Les doy acceso a la cuenta donde lo compré' },
        { value: 'otro', label: 'Lo compró otra persona' },
      ],
      followUp: { when: 'otro', kind: 'text', label: '¿Quién? Nombre y cómo contactarlo' },
    },
    {
      id: 'cl.stripe',
      section: 'servicios',
      kind: 'choice',
      title: 'La cuenta de Stripe para cobrar',
      why:
        'Las membresías, Impulsar y la verificación de identidad ya están construidas, pero hoy ' +
        'corren con claves de prueba: no entra un dólar. Stripe exige que la cuenta la abra el ' +
        'titular en persona, con los datos de la empresa, una cuenta bancaria de Estados Unidos ' +
        'y un documento. No cobra un fijo por mes: se queda un porcentaje de cada cobro.',
      simple:
        'Stripe es el que cobra con tarjeta y te deposita la plata. Hoy la plataforma cobra de ' +
        'mentira, para probar. Para cobrar de verdad, la cuenta la tenés que abrir vos.',
      options: [
        { value: 'abro', label: 'La abro yo y los invito como desarrolladores', recommended: true },
        { value: 'tengo', label: 'Ya tengo una cuenta de Stripe que quiero usar' },
        { value: 'despues', label: 'Abrimos sin cobrar y la sumo después' },
      ],
      followUp: { when: 'tengo', kind: 'email', label: 'El correo de esa cuenta' },
    },
    {
      id: 'cl.creator_money',
      section: 'servicios',
      kind: 'choice',
      title: 'El marketplace de creadores, ¿mueve plata real desde el día uno?',
      why:
        'Hoy funciona de punta a punta en modo demostración: el contrato pasa por todos sus ' +
        'pasos, pero no se mueve dinero. Para que el creador cobre de verdad, Stripe tiene que ' +
        'aprobar a la plataforma como intermediaria de pagos, y cada creador tiene que verificar ' +
        'su identidad y su cuenta bancaria. Es la parte con más responsabilidad: impuestos, ' +
        'reclamos y devoluciones pasan por vos.',
      simple:
        'Decidís si los creadores cobran de verdad desde el lanzamiento o si esa parte arranca ' +
        'más adelante, cuando la comunidad ya esté andando.',
      options: [
        {
          value: 'despues',
          label: 'No: primero la comunidad, la plata en una segunda etapa',
          hint: 'Se abre antes y con menos riesgo. Se activa sin rehacer nada',
          recommended: true,
        },
        {
          value: 'ya',
          label: 'Sí, desde el primer día',
          hint: 'Suma la aprobación de Stripe antes de abrir, que tarda',
        },
      ],
    },
    {
      id: 'cl.phone_signup',
      section: 'servicios',
      kind: 'choice',
      title: '¿El registro pide el teléfono obligatorio?',
      why:
        'Está en el contrato y nuestra parte está lista: el código por mensaje, el vencimiento, ' +
        'una cuenta por teléfono. Falta el proveedor de mensajes de texto (Twilio), que cobra cada ' +
        'envío y, en Estados Unidos, exige registrar la marca ante las compañías de teléfono antes ' +
        'de mandar el primero: lleva días o semanas. Y el teléfono es un dato sensible más para ' +
        'guardar, en una comunidad que cuida mucho su exposición.',
      simple:
        'Elegís si para registrarse alcanza con el mail o si también hay que validar el ' +
        'celular con un código. Lo segundo tiene un costo por mensaje y un trámite previo.',
      options: [
        {
          value: 'no',
          label: 'Arrancar solo con correo',
          hint: 'El teléfono se suma después sin rehacer nada',
          recommended: true,
        },
        {
          value: 'si',
          label: 'Teléfono obligatorio desde el primer día',
          hint: 'Abrís la cuenta de Twilio a tu nombre y hacemos el registro juntos',
        },
      ],
    },
    {
      id: 'cl.services',
      section: 'servicios',
      kind: 'choice',
      title: 'Los servicios de moderación, video y alertas',
      body:
        '**OpenAI** revisa los textos antes de publicarlos. **Google Vision** revisa las fotos: ' +
        'sin él, cada foto espera a que la apruebe una persona. **Anthropic** responde en el ' +
        'Asistente Comunitario. **Mux** procesa los videos largos. **Sentry** nos avisa cuando ' +
        'algo falla.',
      why:
        'Hoy varios están apagados o con claves de prueba, y la app lo disimula bien —pero ' +
        'funciona a medias. Cada uno pide una tarjeta, así que van a tu nombre. Todos cobran ' +
        'por uso: al arrancar, la mayoría son unos pocos dólares por mes.',
      simple:
        'Son cinco servicios chicos que hacen funcionar partes de la app: revisar lo que se ' +
        'publica, los videos y los avisos de errores. Hay que abrirlos a tu nombre.',
      options: [
        {
          value: 'llamada',
          label: 'Los abrimos juntos en una llamada',
          hint: 'Media hora: vos ponés la tarjeta, nosotros la configuración',
          recommended: true,
        },
        { value: 'yo', label: 'Los abro yo, pásenme el paso a paso' },
      ],
    },
    {
      id: 'cl.moderators',
      section: 'lanzamiento',
      kind: 'emails',
      min: 1,
      suggested: 2,
      title: '¿Quiénes moderan el contenido?',
      why:
        'Las fotos de los avisos, los reportes de usuarios y los registros de voluntarios los ' +
        'revisa una persona, desde el panel de moderación. Necesitamos los correos de quienes lo ' +
        'van a usar para darles el permiso.',
      simple:
        'Alguien tiene que revisar lo que la gente publica y denuncia. Nos pasás los mails de ' +
        'quienes se van a encargar de eso.',
      hint:
        'Puede ser solo vos al principio. Con dos personas, nada espera un fin de semana entero. ' +
        'Cada una tiene que crearse antes su cuenta en la app con ese mismo correo.',
      placeholder: 'nombre@correo.com',
    },
    {
      id: 'cl.demo_data',
      section: 'lanzamiento',
      kind: 'choice',
      title: '¿Qué hacemos con los datos de prueba?',
      why:
        'Hoy hay cuentas y avisos de ejemplo —María, Carlos, departamentos en Queens— que ' +
        'armamos para las demos. En una plataforma que promete avisos contrastados, que alguien ' +
        'quiera alquilar un departamento inventado es justo lo que no puede pasar.',
      simple:
        'Hay contenido inventado que usamos para mostrarte la app. Decidís si lo borramos antes ' +
        'de abrir o si dejamos algo de muestra.',
      options: [
        { value: 'borrar', label: 'Borrar todo lo de prueba antes de abrir', recommended: true },
        {
          value: 'dejar',
          label: 'Dejar algo de ejemplo para que no se vea vacía',
          hint: 'Lo marcamos bien visible como ejemplo, y nunca en vivienda',
        },
      ],
    },
    {
      id: 'cl.launch_date',
      section: 'lanzamiento',
      kind: 'text',
      title: '¿Tenés una fecha de lanzamiento en mente?',
      why:
        'Varias cosas de esta lista tardan días o semanas y no dependen de nosotros: la ' +
        'aprobación de Stripe, el registro de los mensajes de texto, la mudanza de las cuentas. ' +
        'Con la fecha ordenamos qué arranca primero.',
      simple: 'Nos decís para cuándo querés abrir, así organizamos los trámites que tardan.',
      placeholder: 'Por ejemplo: primera semana de noviembre',
    },
  ],
}

// ---------------------------------------------------------------------------

/** Cuestionarios por nombre de proyecto, tal cual figura en la app. */
const BY_PROJECT = {
  iRowing: IROWING,
  'MAREX Cleaning Marketplace': MAREX,
  'Comunidad Latina': COMUNIDAD_LATINA,
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
