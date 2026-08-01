// src/emails/maintenanceNotice.js
//
// Generador puro del mail de aviso de cobro de mantenimiento (Insights OS).
// No envía nada: devuelve { subject, preheader, html, text } para
// previsualizar en la app. El proveedor de envío se conecta después.

const BRAND = {
  orange: '#F97316',
  paper: '#F8F8F6',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  inkSecondary: '#5C5A55',
  hairline: '#E7E5E1',
};

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const DEFAULT_INCLUDES = [
  'Hosting y monitoreo del sistema',
  'Soporte prioritario y corrección de errores',
  'Actualizaciones de seguridad',
  'Un reporte mensual de uso',
];

/**
 * Escapa un valor para insertarlo de forma segura dentro de HTML
 * (texto de nodo o valor de atributo entre comillas dobles).
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

/**
 * URL lista para un `href`, o `null` si no es navegable.
 *
 * escapeHtml() alcanza para que el valor no se escape del atributo, pero NO valida
 * el esquema: un `javascript:` sobreviviría intacto. Acá solo pasan http/https.
 * @param {unknown} url
 * @returns {string|null}
 */
function safeHref(url) {
  const raw = String(url ?? '').trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  return escapeHtml(raw);
}

/** "martes 12 de agosto" — sin dependencia de Intl/ICU del entorno. */
function formatLongDate(date) {
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${weekday} ${day} de ${month}`;
}

/** "12 de agosto" */
function formatShortDate(date) {
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${day} de ${month}`;
}

/** "USD 250" · "USD 1.234,50" — separador de miles es-AR + moneda explícita. */
function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  const hasDecimals = !Number.isInteger(n);
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `${currency} ${formatted}`;
}

/**
 * Construye el mail de aviso de renovación de mantenimiento.
 * Función pura: no envía nada, solo devuelve el contenido.
 *
 * @param {object} params
 * @param {string} params.clientName
 * @param {string} [params.companyName]
 * @param {string} params.projectName
 * @param {number} params.amount
 * @param {string} params.currency
 * @param {Date} params.dueDate
 * @param {string[]} [params.includes]
 * @param {string|null} [params.projectUrl]
 * @param {string} params.replyTo
 * @returns {{ subject: string, preheader: string, html: string, text: string }}
 */
export function buildMaintenanceNotice({
  clientName,
  companyName,
  projectName,
  amount,
  currency,
  dueDate,
  includes,
  projectUrl,
  replyTo,
}) {
  const items =
    Array.isArray(includes) && includes.length > 0 ? includes : DEFAULT_INCLUDES;
  const longDate = formatLongDate(dueDate);
  const shortDate = formatShortDate(dueDate);
  const amountLabel = formatAmount(amount, currency);

  const subject = `Tu mantenimiento de ${projectName} se renueva el ${shortDate}`;
  const preheader = 'Te avisamos con una semana de anticipación.';

  const html = renderHtml({
    subject,
    preheader,
    clientName,
    companyName,
    projectName,
    longDate,
    amountLabel,
    items,
    projectUrl,
    replyTo,
  });

  const text = renderText({
    clientName,
    projectName,
    longDate,
    amountLabel,
    items,
    projectUrl,
    replyTo,
  });

  return { subject, preheader, html, text };
}

function renderHtml({
  preheader,
  clientName,
  projectName,
  longDate,
  amountLabel,
  items,
  projectUrl,
  replyTo,
}) {
  const safeClientName = escapeHtml(clientName);
  const safeProjectName = escapeHtml(projectName);
  const safeAmount = escapeHtml(amountLabel);
  const safeLongDate = escapeHtml(longDate);
  const safePreheader = escapeHtml(preheader);
  const safeReplyTo = escapeHtml(replyTo);
  const safeUrl = safeHref(projectUrl);

  const listRows = items
    .map(
      (item) => `
              <tr>
                <td style="padding:0 0 10px 0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.ink};" valign="top">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="20" valign="top" style="padding-top:3px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="6" height="6" style="width:6px;height:6px;">
                          <tr><td bgcolor="${BRAND.orange}" style="background-color:${BRAND.orange};border-radius:3px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
                        </table>
                      </td>
                      <td style="font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.ink};">${escapeHtml(item)}</td>
                    </tr>
                  </table>
                </td>
              </tr>`
    )
    .join('');

  const button = safeUrl
    ? `
            <tr>
              <td align="center" style="padding:8px 0 4px 0;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="50%" strokecolor="${BRAND.orange}" fillcolor="${BRAND.orange}">
                <w:anchorlock/>
                <center style="color:#FFFFFF;font-family:${FONT_STACK};font-size:16px;font-weight:600;">Ver el tablero del proyecto</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${safeUrl}" target="_blank" style="background-color:${BRAND.orange};border-radius:999px;color:#FFFFFF;display:inline-block;font-family:${FONT_STACK};font-size:16px;font-weight:600;line-height:48px;text-align:center;text-decoration:none;width:280px;-webkit-text-size-adjust:none;mso-hide:all;">Ver el tablero del proyecto</a>
                <!--<![endif]-->
              </td>
            </tr>`
    : '';

  return `<!doctype html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(`Tu mantenimiento de ${projectName} se renueva el ${longDate}`)}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100% !important; background-color:${BRAND.paper}; }
  a { color:${BRAND.orange}; }

  /* Anti dark-mode: forzamos nuestra paleta clara aunque el cliente invierta colores */
  :root { color-scheme: light; supported-color-schemes: light; }
  @media (prefers-color-scheme: dark) {
    .ins-bg-paper { background-color:${BRAND.paper} !important; }
    .ins-bg-surface { background-color:${BRAND.surface} !important; }
    .ins-ink { color:${BRAND.ink} !important; }
    .ins-ink-secondary { color:${BRAND.inkSecondary} !important; }
    .ins-hairline { border-color:${BRAND.hairline} !important; }
  }
  [data-ogsc] .ins-bg-paper { background-color:${BRAND.paper} !important; }
  [data-ogsc] .ins-bg-surface { background-color:${BRAND.surface} !important; }
  [data-ogsc] .ins-ink { color:${BRAND.ink} !important; }
  [data-ogsc] .ins-ink-secondary { color:${BRAND.inkSecondary} !important; }

  @media screen and (max-width: 600px) {
    .ins-container { width:100% !important; max-width:100% !important; }
    .ins-pad { padding-left:24px !important; padding-right:24px !important; }
    .ins-hero { font-size:20px !important; line-height:27px !important; }
  }
</style>
</head>
<body class="ins-bg-paper" style="margin:0;padding:0;background-color:${BRAND.paper};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.paper};opacity:0;">
    ${safePreheader}
    ${'&#8203;&zwnj;&nbsp;'.repeat(40)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ins-bg-paper" style="background-color:${BRAND.paper};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="ins-container" style="width:600px;max-width:600px;">

          <!-- Logo -->
          <tr>
            <td class="ins-pad" style="padding:0 0 24px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="28" height="28" bgcolor="${BRAND.orange}" style="background-color:${BRAND.orange};border-radius:7px;width:28px;height:28px;text-align:center;" role="img" aria-label="Insights">
                    <span style="font-family:${FONT_STACK};font-size:16px;line-height:28px;font-weight:700;color:#FFFFFF;">I</span>
                  </td>
                  <td style="padding-left:10px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:${BRAND.ink};">Insights</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="ins-bg-surface" bgcolor="${BRAND.surface}" style="background-color:${BRAND.surface};border:1px solid ${BRAND.hairline};border-radius:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="ins-pad" style="padding:40px 40px 8px 40px;">
                    <p class="ins-hero ins-ink" style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:22px;line-height:29px;font-weight:700;color:${BRAND.ink};">Hola ${safeClientName},</p>
                    <p class="ins-ink-secondary" style="margin:0 0 28px 0;font-family:${FONT_STACK};font-size:16px;line-height:25px;color:${BRAND.inkSecondary};">El ${safeLongDate} se renueva el mantenimiento de <strong style="color:${BRAND.ink};">${safeProjectName}</strong> por <strong style="color:${BRAND.ink};">${safeAmount}</strong>. Te avisamos ahora para que no te tome de sorpresa.</p>
                  </td>
                </tr>
                <tr>
                  <td class="ins-pad" style="padding:0 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ins-hairline" style="border-top:1px solid ${BRAND.hairline};border-bottom:1px solid ${BRAND.hairline};">
                      <tr>
                        <td style="padding:24px 0;">
                          <p style="margin:0 0 14px 0;font-family:${FONT_STACK};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.orange};">Qué incluye</p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            ${listRows}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="ins-pad" style="padding:28px 40px 8px 40px;">
                    <p class="ins-ink-secondary" style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:25px;color:${BRAND.inkSecondary};">Si querés cambiar algo del plan o tenés una duda, respondé este mismo mail y lo vemos.</p>
                  </td>
                </tr>
                <!-- El botón ya es un <tr> completo y va SUELTO acá: envolverlo en su
                     propia <table> lo dejaba como hijo directo de otra <table>, entre
                     </tr> y <tr>. El parser lo sacaba por foster parenting y el botón
                     terminaba renderizado FUERA de la tarjeta. -->
                ${button}
                <tr>
                  <td class="ins-pad" style="padding:${safeUrl ? '20' : '4'}px 40px 40px 40px;">
                    <p class="ins-ink" style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:25px;color:${BRAND.ink};">Gracias por seguir confiando en nosotros.<br>El equipo de Insights</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px 0 24px;">
              <p class="ins-ink-secondary" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:${BRAND.inkSecondary};">Insights · Software a medida</p>
              <p class="ins-ink-secondary" style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:${BRAND.inkSecondary};">Recibís este mail porque tenés un proyecto activo con nosotros.</p>
              <p class="ins-ink-secondary" style="margin:10px 0 0 0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:${BRAND.inkSecondary};">
                <a href="mailto:${safeReplyTo}" style="color:${BRAND.inkSecondary};text-decoration:underline;">${safeReplyTo}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText({
  clientName,
  projectName,
  longDate,
  amountLabel,
  items,
  projectUrl,
  replyTo,
}) {
  const lines = [
    `Hola ${clientName},`,
    '',
    `El ${longDate} se renueva el mantenimiento de ${projectName} por ${amountLabel}. Te avisamos ahora para que no te tome de sorpresa.`,
    '',
    'Qué incluye:',
    ...items.map((item) => `- ${item}`),
    '',
    'Si querés cambiar algo del plan o tenés una duda, respondé este mismo mail y lo vemos.',
  ];

  if (projectUrl) {
    lines.push('', `Ver el tablero del proyecto: ${projectUrl}`);
  }

  lines.push(
    '',
    'Gracias por seguir confiando en nosotros.',
    'El equipo de Insights',
    '',
    '--',
    'Insights · Software a medida',
    'Recibís este mail porque tenés un proyecto activo con nosotros.',
    replyTo
  );

  return lines.join('\n');
}

export default buildMaintenanceNotice;
