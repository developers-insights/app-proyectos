// Las cuentas que el cliente crea al arrancar un proyecto, y a quién le da acceso en cada una.
//
// Esto es el ESPEJO de la única lista de verdad, que vive en speed-funnels
// (`supabase/functions/_shared/cb-accesos.ts`): de ahí salen los mensajes que Clarity le manda al
// grupo del proyecto y el diagnóstico de los accesos. Los dos repos tienen que decir lo mismo; acá
// lo fija `tests/accesos.test.js`, y si cambia uno se cambia el otro en el mismo día.
//
// Por qué existe (4/11/2026): la página pedía dos cuentas (Supabase y GitHub) y el mensaje
// automático de Clarity pedía otra cosa (sólo developers-insights, sin nombrar Vercel). Elizabeth
// (Mi cupón) compartió sólo developers-insights porque era exactamente lo que le habíamos pedido.
// El texto no puede depender de que el video esté al día: el video se cambia en la tabla `videos`,
// esta lista no.

/** Los dos usuarios de GitHub que el cliente suma como colaboradores. `manu-180` va con guion. */
export const GITHUB_COLABORADORES = ['developers-insights', 'manu-180']

/** El mail de Insights al que invita en Supabase (default de `cb_settings.arranque.supabase_invitar`). */
export const MAIL_SUPABASE = 'manuelnavarro@insightsapps.tech'

/**
 * Las tres cuentas, en el orden en que se las pide. Vercel se crea desde el principio aunque se
 * configure recién cuando el código ya está en el GitHub del cliente: así nadie se traba a mitad
 * de camino esperando una cuenta que todavía no existe.
 */
export const CUENTAS = [
  {
    id: 'github',
    nombre: 'GitHub',
    para: 'Donde se guarda el código de tu proyecto.',
    compartir: `Cuando la tengas, sumanos como colaboradores: ${GITHUB_COLABORADORES.join(' y ')}.`,
    alta: 'https://github.com/signup',
    cta: 'Crear cuenta en GitHub',
  },
  {
    id: 'supabase',
    nombre: 'Supabase',
    para: 'Donde vive la base de datos de tu proyecto.',
    compartir: `Cuando la tengas, invitá a ${MAIL_SUPABASE}.`,
    alta: 'https://supabase.com/dashboard/sign-up',
    cta: 'Crear cuenta en Supabase',
  },
  {
    id: 'vercel',
    nombre: 'Vercel',
    para: 'Donde se publica tu proyecto en internet.',
    compartir: 'Con crearla alcanza: la conectamos cuando el código ya esté en tu GitHub.',
    alta: 'https://vercel.com/signup',
    cta: 'Crear cuenta en Vercel',
  },
]
