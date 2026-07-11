/**
 * planTemplate.js — `buildPlanHTML(plan)` → el documento HTML que ve el cliente.
 *
 * JS PURO. Cero React, cero JSX, cero imports de node_modules.
 * Se ejecuta con `node` directamente: eso es lo que hace posible verificarlo sin test runner.
 *
 * Portado línea por línea de `rdx-plan-cliente/index.html` (640 líneas).
 * Referencia del contrato: plan/docs/MASTER_PLAN.md §5.
 *
 * ── Los dos contextos de escape (R3 / D-E) ───────────────────────────────────
 *   1. sanitizePlan(plan)  → una copia con TODOS los strings del usuario pasados
 *                            por escapeHtml() UNA sola vez.
 *   2. El HTML server-side interpola esos strings ya escapados.
 *   3. El bloque <script> serializa ESE MISMO plan escapado con jsonForScript().
 *   4. El JS embebido hace innerHTML → el browser des-escapa una vez → se ve literal.
 *
 *   NUNCA escapeHtml dentro de <script>. NUNCA jsonForScript fuera de <script>.
 *
 * ── Endurecimiento (D-D) ─────────────────────────────────────────────────────
 *   Esta página se le manda a un cliente que paga. Todo color, todo href y todo
 *   enum que venga del usuario se valida ANTES de entrar al CSS o al HTML.
 */

import {
  PHASE_ICONS,
  SCHEMA_ICONS,
  UI_ICONS,
  BRAND_SPARK_ICON,
  DOWNLOAD_ICON,
  WEEK_TYPES,
  DELIVER_KINDS,
  NEUTRAL_HITO,
  hitoForWeek,
  daysForWeek,
  COLOR_RE,
  HREF_RE,
} from './planModel.js'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes del template (chrome, no datos: nunca pasan por escapeHtml)
// ─────────────────────────────────────────────────────────────────────────────

/** Flecha izquierda del botón "Anterior". index.html:462 */
const ARROW_LEFT_ICON = '<svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'

/** Flecha derecha del botón "Siguiente". index.html:464 */
const ARROW_RIGHT_ICON = '<svg class="ic" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'

/** El dorado del gate. Constante, INDEPENDIENTE de los hitos (R4/D-C). */
const GATE_COLOR = '#f0b94d'

/** Si el plan no tiene ningún hito con color válido, el acento cae acá. */
const ACCENT_FALLBACK = '#3ddc97'

/** Color de las semanas huérfanas (T6). */
const NEUTRAL_COLOR = NEUTRAL_HITO.color

/** Ids de custom property que romperían el object literal del <script>. */
const RESERVED_SAFE_IDS = new Set(['__proto__', 'constructor', 'prototype', '_neutral'])

const hasOwn = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k)

// ─────────────────────────────────────────────────────────────────────────────
// Escapes — los dos, y cada uno en su contexto (R3 / D-E)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Para texto que se interpola en HTML. Las comillas hacen falta: van en atributos.
 * Se aplica UNA vez, en sanitizePlan(). Nunca dos.
 */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Para el bloque de datos que va DENTRO de <script>. NO uses escapeHtml acá.
 * `<` mata `</script>` y `<!--`. U+2028/U+2029 son saltos de línea para el
 * parser de JS pero no para JSON.stringify.
 */
export function jsonForScript(v) {
  return String(JSON.stringify(v) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * Un color arbitrario dentro de una hoja de estilos es un vector de inyección
 * (`red;}body{display:none}`). Solo pasa hex válido de CSS. (D-D)
 */
export function safeColor(c, fallback = NEUTRAL_COLOR) {
  const s = String(c ?? '')
  return COLOR_RE.test(s) ? s : fallback
}

/** Solo '#ancla' o http(s)://. Bloquea `javascript:` en los navLinks. (D-D) */
export function safeHref(h) {
  const s = String(h ?? '')
  return HREF_RE.test(s) ? s : '#'
}

// ─────────────────────────────────────────────────────────────────────────────
// sanitizePlan — paso 1 de D-E
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copia del plan con todos los strings del usuario escapados exactamente una vez,
 * los enums validados y los colores filtrados. No muta el plan original.
 *
 * `id` e `icon` NO se escapan: no son texto, son identificadores. `id` se pasa
 * por `safeIdsFor()` (que ya restringe el charset) y `icon` se busca en un
 * registro con `hasOwnProperty` + fallback, así que nunca llega al documento.
 */
export function sanitizePlan(plan) {
  const p = plan && typeof plan === 'object' ? plan : {}
  const e = escapeHtml
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null) : [])
  const sections = p.sections && typeof p.sections === 'object' ? p.sections : {}
  const sec = (s) => ({
    eyebrow: e(s && s.eyebrow),
    title: e(s && s.title),
    lead: e(s && s.lead),
  })
  /** Un color opcional: si no es hex válido devolvemos '' y no emitimos el inline. */
  const optColor = (c) => (COLOR_RE.test(String(c ?? '')) ? String(c) : '')

  const brand = p.brand && typeof p.brand === 'object' ? p.brand : {}
  const footer = p.footer && typeof p.footer === 'object' ? p.footer : {}

  const hitos = arr(p.hitos).map((h) => ({
    id: String(h.id ?? ''),
    label: e(h.label),
    title: e(h.title),
    description: e(h.description),
    weeksLabel: e(h.weeksLabel),
    daysLabel: e(h.daysLabel),
    color: safeColor(h.color, NEUTRAL_COLOR),
    icon: String(h.icon ?? ''),
    weekFrom: Number(h.weekFrom),
    weekTo: Number(h.weekTo),
    isMilestone: h.isMilestone === true,
  }))

  const weeks = arr(p.weeks).map((w, i) => {
    const n = Number(w.n)
    const kind = w.deliver && w.deliver.kind
    return {
      n: Number.isFinite(n) ? n : i + 1,
      title: e(w.title),
      type: hasOwn(WEEK_TYPES, w.type) ? w.type : 'info',
      tasks: arr(w.tasks).map(e),
      deliver: {
        kind: hasOwn(DELIVER_KINDS, kind) ? kind : 'doc',
        text: e(w.deliver && w.deliver.text),
      },
      daysOverride: w.daysOverride == null ? null : e(w.daysOverride),
    }
  })

  const title = e(p.title)

  return {
    title,
    subtitle: e(p.subtitle),
    heroEyebrow: e(p.heroEyebrow),
    lead: e(p.lead),
    metaLine: e(p.metaLine),
    clientName: e(p.clientName),
    docTitle: p.docTitle ? e(p.docTitle) : '',
    metaDescription: e(p.metaDescription),
    scrollCue: e(p.scrollCue),

    brand: { name: e(brand.name), tagline: e(brand.tagline) },

    // `href` también se escapa: safeHref() valida el resultado, y un `&` en una
    // query string tiene que salir como `&amp;` dentro del atributo.
    navLinks: arr(p.navLinks).map((l) => ({ label: e(l.label), href: e(l.href) })),

    stats: arr(p.stats).map((s) => ({ n: e(s.n), k: e(s.k), color: optColor(s.color) })),

    sections: {
      schema: sec(sections.schema),
      phases: sec(sections.phases),
      weeks: sec(sections.weeks),
    },

    hitos,
    weeks,

    showSchema: p.showSchema !== false,
    schema: arr(p.schema).map((c) => ({
      icon: String(c.icon ?? ''),
      title: e(c.title),
      text: e(c.text),
      tags: arr(c.tags).map(e),
      color: optColor(c.color),
    })),

    footer: {
      big: e(footer.big),
      brand: e(footer.brand),
      lines: arr(footer.lines).map(e),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokens de color por hito (R4 / D-C)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un identificador CSS/JS seguro por hito, único dentro del documento.
 * `safeId = id.replace(/[^a-zA-Z0-9_-]/g,'-')`, con sufijo numérico si colisiona.
 * Los nombres reservados se renombran: `{"__proto__":…}` en un object literal
 * setea el prototipo en vez de una propiedad, y `_neutral` ya está tomado.
 */
function safeIdsFor(hitos) {
  const used = new Set(['_neutral'])
  return hitos.map((h, i) => {
    let base = String((h && h.id) ?? '').replace(/[^a-zA-Z0-9_-]/g, '-')
    if (!base || RESERVED_SAFE_IDS.has(base)) base = 'hito-' + (i + 1)
    let safe = base
    let k = i
    while (used.has(safe)) {
      k += 1
      safe = base + '-' + k
    }
    used.add(safe)
    return safe
  })
}

const phaseIcon = (k) => (hasOwn(PHASE_ICONS, k) ? PHASE_ICONS[k] : PHASE_ICONS.search)
const schemaIcon = (k) => (hasOwn(SCHEMA_ICONS, k) ? SCHEMA_ICONS[k] : SCHEMA_ICONS.video)

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

function buildCSS({ hitos, safeIds, accent, mesh, phaseCols, previewRule }) {
  const hitoTokens = safeIds.map((id, i) => `    --c-hito-${id}:${hitos[i].color};\n`).join('')
  // Al ocultar #trabajo entero, `.phases` nunca baja de 2 columnas en papel —
  // salvo que el plan tenga un solo hito.
  const printCols = Math.min(phaseCols, 2)
  const tabletCols = Math.min(phaseCols, 2)

  return `  :root{
    --bg:#060606;
    --ink:#f5f4f1;
    --ink-2:rgba(245,244,241,.58);
    --ink-3:rgba(245,244,241,.34);
    --line:rgba(245,244,241,.10);
    --line-2:rgba(245,244,241,.06);
    --glass:rgba(255,255,255,.025);
    --glass-2:rgba(255,255,255,.04);
${hitoTokens}    --c-hito-_neutral:${NEUTRAL_COLOR};
    --c-gate:${GATE_COLOR};
    --c-accent:${accent};
    --ease:cubic-bezier(.32,.72,0,1);
    --ease-2:cubic-bezier(.16,1,.3,1);
    --font-display:'Clash Display','Satoshi',system-ui,sans-serif;
    --font-body:'Satoshi',system-ui,-apple-system,sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
  body{
    background:var(--bg);color:var(--ink);font-family:var(--font-body);
    font-size:16px;line-height:1.6;letter-spacing:-.01em;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
    overflow-x:hidden;
  }
  ::selection{background:color-mix(in srgb,var(--c-accent) 25%,transparent);color:#fff}

  /* ambient mesh + grain */
  .mesh{position:fixed;inset:0;z-index:-2;pointer-events:none;
    background:
      radial-gradient(60% 50% at 18% 8%, color-mix(in srgb,${mesh[0]} 10%,transparent), transparent 60%),
      radial-gradient(55% 45% at 88% 22%, color-mix(in srgb,${mesh[1]} 10%,transparent), transparent 60%),
      radial-gradient(70% 60% at 50% 105%, color-mix(in srgb,${mesh[2]} 8%,transparent), transparent 60%);
  }
  .grain{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.035;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .wrap{max-width:1160px;margin:0 auto;padding:0 28px}
  svg{display:block}
  .ic{width:20px;height:20px;stroke:currentColor;stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round}

  /* eyebrow */
  .eyebrow{display:inline-flex;align-items:center;gap:8px;
    border:1px solid var(--line);border-radius:999px;padding:7px 14px;
    font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-2);
    background:var(--glass);backdrop-filter:blur(12px)}
  .eyebrow .dot{width:5px;height:5px;border-radius:50%;background:var(--c-accent);box-shadow:0 0 10px var(--c-accent)}

  h1,h2,h3{font-family:var(--font-display);font-weight:500;letter-spacing:-.02em;line-height:1.02}

  /* ---------- NAV ---------- */
  nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;justify-content:center;
    padding:18px;transition:transform .5s var(--ease)}
  .nav-pill{display:flex;align-items:center;gap:8px;width:min(960px,100%);
    background:rgba(12,12,12,.55);backdrop-filter:blur(20px) saturate(140%);
    border:1px solid var(--line);border-radius:999px;padding:10px 12px 10px 20px;
    box-shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 20px 50px -30px rgba(0,0,0,.9)}
  .brand{display:flex;align-items:center;gap:10px;font-family:var(--font-display);
    font-weight:600;font-size:15px;letter-spacing:-.01em;margin-right:auto}
  .brand .spark{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;
    background:linear-gradient(135deg,color-mix(in srgb,var(--c-accent) 90%,transparent),color-mix(in srgb,var(--c-accent) 35%,transparent));color:#04140d}
  .brand .spark svg{width:13px;height:13px;stroke-width:2}
  .brand small{color:var(--ink-3);font-family:var(--font-body);font-weight:400;font-size:12px;letter-spacing:0}
  .nav-links{display:flex;gap:4px}
  .nav-links a{color:var(--ink-2);text-decoration:none;font-size:13px;padding:8px 14px;border-radius:999px;
    transition:color .4s var(--ease),background .4s var(--ease)}
  .nav-links a:hover{color:var(--ink);background:var(--glass-2)}
  .btn{display:inline-flex;align-items:center;gap:10px;border:none;cursor:pointer;
    font-family:var(--font-body);font-weight:500;font-size:13px;color:#04140d;
    background:var(--ink);border-radius:999px;padding:9px 9px 9px 18px;
    transition:transform .5s var(--ease),background .4s var(--ease)}
  .btn:hover{transform:translateY(-1px)}
  .btn:active{transform:scale(.97)}
  .btn .iconwrap{width:26px;height:26px;border-radius:999px;background:rgba(4,20,13,.12);
    display:grid;place-items:center;transition:transform .5s var(--ease)}
  .btn:hover .iconwrap{transform:translate(2px,-1px) scale(1.05)}
  .btn .ic{width:15px;height:15px;stroke:#04140d}

  /* ---------- HERO ---------- */
  header.hero{min-height:100dvh;display:flex;flex-direction:column;justify-content:center;
    padding:140px 0 80px;position:relative}
  .hero h1{font-size:clamp(3rem,9vw,7.4rem);margin:26px 0 0;letter-spacing:-.035em}
  .hero h1 .l2{display:block;color:var(--ink-3)}
  .hero p.lead{max-width:560px;margin:30px 0 0;font-size:clamp(1.02rem,1.6vw,1.22rem);
    color:var(--ink-2);line-height:1.55}
  .hero .meta-line{margin-top:14px;color:var(--ink-3);font-size:14px}
  .stats{display:flex;flex-wrap:wrap;gap:14px;margin-top:48px}
  .stat{flex:1;min-width:140px;background:var(--glass);border:1px solid var(--line);
    border-radius:20px;padding:22px 24px;backdrop-filter:blur(10px);position:relative;overflow:hidden}
  .stat .n{font-family:var(--font-display);font-weight:600;font-size:2.4rem;letter-spacing:-.03em}
  .stat .k{color:var(--ink-3);font-size:12.5px;margin-top:4px;letter-spacing:.02em}
  .stat::after{content:"";position:absolute;left:24px;right:24px;top:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--accent,rgba(255,255,255,.4)),transparent);opacity:.5}
  .scroll-cue{margin-top:60px;display:inline-flex;align-items:center;gap:10px;color:var(--ink-3);font-size:12.5px;
    letter-spacing:.12em;text-transform:uppercase}
  .scroll-cue .bar{width:30px;height:1px;background:var(--ink-3);position:relative;overflow:hidden}
  .scroll-cue .bar::after{content:"";position:absolute;inset:0;background:var(--ink);
    transform:translateX(-100%);animation:slide 2.6s var(--ease) infinite}
  @keyframes slide{0%{transform:translateX(-100%)}50%{transform:translateX(100%)}100%{transform:translateX(100%)}}

  /* ---------- SECTION SHELL ---------- */
  section{padding:96px 0;position:relative}
  .sec-head{max-width:680px;margin-bottom:54px}
  .sec-head h2{font-size:clamp(2rem,4.4vw,3.3rem);margin-top:20px;letter-spacing:-.03em}
  .sec-head p{color:var(--ink-2);margin-top:18px;font-size:1.05rem;max-width:560px}

  /* ---------- COMMS BENTO ---------- */
  .bento{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
  .shell{background:var(--glass);border:1px solid var(--line);border-radius:26px;padding:7px}
  .core{background:rgba(255,255,255,.018);border:1px solid var(--line-2);border-radius:20px;
    padding:28px 30px;height:100%;box-shadow:inset 0 1px 1px rgba(255,255,255,.05)}
  .comm .core{display:flex;flex-direction:column;gap:14px;min-height:188px}
  .comm-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;
    background:var(--glass-2);border:1px solid var(--line);color:var(--c-accent)}
  .comm-ic .ic{width:22px;height:22px}
  .comm h3{font-size:1.32rem;font-weight:500;letter-spacing:-.02em}
  .comm .core p{color:var(--ink-2);font-size:.96rem;line-height:1.55}
  .tagrow{margin-top:auto;display:flex;gap:8px;flex-wrap:wrap}
  .tag{font-size:11.5px;color:var(--ink-2);border:1px solid var(--line);border-radius:999px;
    padding:5px 11px;letter-spacing:.02em}

  /* ---------- PHASES ---------- */
  .progress-track{display:flex;gap:6px;margin-bottom:30px}
  .progress-track .seg{height:6px;border-radius:999px;flex-grow:var(--w,1);background:var(--col);opacity:.85}
  .phases{display:grid;grid-template-columns:repeat(${phaseCols},1fr);gap:16px}
  .phase .core{min-height:230px;display:flex;flex-direction:column}
  .phase .pnum{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--col)}
  .phase h3{font-size:1.28rem;font-weight:500;margin:14px 0 6px;letter-spacing:-.02em}
  .phase .wk{color:var(--ink-3);font-size:12.5px;margin-bottom:14px}
  .phase .desc{color:var(--ink-2);font-size:.92rem;line-height:1.5;margin-top:auto}
  .phase .pic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;
    background:var(--glass-2);border:1px solid var(--line);color:var(--col);margin-bottom:18px}

  /* ---------- WEEK NAVIGATOR ---------- */
  .nav-rail{position:relative;margin-bottom:34px}
  .rail-line{position:absolute;left:0;right:0;top:19px;height:1px;background:var(--line)}
  .pills{position:relative;display:flex;justify-content:space-between;gap:6px;
    overflow-x:auto;scrollbar-width:none;padding:2px 0 8px}
  .pills::-webkit-scrollbar{display:none}
  .pill{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:9px;
    background:none;border:none;cursor:pointer;padding:0;min-width:54px;scroll-snap-align:center}
  .pill .node{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;
    font-family:var(--font-display);font-weight:600;font-size:15px;color:var(--ink-2);
    background:#0c0c0c;border:1px solid var(--line);
    transition:all .55s var(--ease)}
  .pill .lbl{font-size:10.5px;color:var(--ink-3);letter-spacing:.04em;transition:color .4s var(--ease);white-space:nowrap}
  .pill:hover .node{border-color:var(--col);color:var(--ink)}
  .pill.active .node{background:var(--col);color:#06120c;border-color:var(--col);
    box-shadow:0 0 0 5px color-mix(in srgb,var(--col) 16%,transparent),0 8px 24px -8px var(--col);
    transform:scale(1.06)}
  .pill.active .lbl{color:var(--ink)}

  .week-shell{padding:8px}
  .week-core{position:relative;background:rgba(255,255,255,.02);border:1px solid var(--line-2);
    border-radius:26px;padding:42px 46px;min-height:430px;overflow:hidden;
    box-shadow:inset 0 1px 1px rgba(255,255,255,.05)}
  .week-core::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--col);opacity:.9}
  .week-glow{position:absolute;top:-40%;right:-10%;width:55%;height:120%;
    background:radial-gradient(circle,color-mix(in srgb,var(--col) 22%,transparent),transparent 65%);
    opacity:.5;pointer-events:none;filter:blur(20px)}
  .swap{transition:opacity .42s var(--ease),transform .42s var(--ease),filter .42s var(--ease)}
  .swap.out{opacity:0;transform:translateY(14px);filter:blur(6px)}

  .week-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px}
  .phase-chip{display:inline-flex;align-items:center;gap:7px;font-size:12px;letter-spacing:.06em;
    text-transform:uppercase;color:var(--col);border:1px solid color-mix(in srgb,var(--col) 35%,transparent);
    background:color-mix(in srgb,var(--col) 12%,transparent);border-radius:999px;padding:5px 12px}
  .phase-chip .d{width:6px;height:6px;border-radius:50%;background:var(--col)}
  .days-chip{display:inline-flex;align-items:center;gap:7px;color:var(--ink-3);font-size:12.5px}
  .days-chip .ic{width:15px;height:15px}
  .type-chip{margin-left:auto;display:inline-flex;align-items:center;gap:8px;font-size:12px;
    color:var(--ink-2);border:1px solid var(--line);border-radius:999px;padding:6px 13px;background:var(--glass)}
  .type-chip .ic{width:15px;height:15px}
  .type-chip.t-formal{color:#06120c;background:var(--col);border-color:var(--col);font-weight:500}
  .type-chip.t-gate{color:var(--c-gate);border-color:color-mix(in srgb,var(--c-gate) 40%,transparent);
    background:color-mix(in srgb,var(--c-gate) 12%,transparent)}

  .week-core h3.wt{font-size:clamp(1.7rem,3.4vw,2.7rem);margin:18px 0 26px;letter-spacing:-.03em;max-width:680px}
  .week-core h3.wt .wn{color:var(--col)}
  .tasks{display:grid;gap:13px;max-width:680px}
  .task{display:flex;gap:14px;align-items:flex-start}
  .task .tick{flex:0 0 auto;width:22px;height:22px;border-radius:50%;margin-top:1px;
    border:1px solid color-mix(in srgb,var(--col) 45%,var(--line));display:grid;place-items:center;color:var(--col)}
  .task .tick .ic{width:12px;height:12px;stroke-width:2}
  .task span{color:var(--ink);font-size:1rem;line-height:1.5;opacity:.92}

  .deliver{margin-top:30px;display:flex;gap:16px;align-items:flex-start;
    background:color-mix(in srgb,var(--col) 9%,transparent);
    border:1px solid color-mix(in srgb,var(--col) 28%,transparent);border-radius:18px;padding:20px 22px;max-width:720px}
  .deliver .dic{flex:0 0 auto;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;
    background:color-mix(in srgb,var(--col) 16%,transparent);color:var(--col)}
  .deliver .dic .ic{width:20px;height:20px}
  .deliver .dk{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--col);margin-bottom:5px}
  .deliver .dt{color:var(--ink);font-size:.98rem;line-height:1.5}

  .week-controls{display:flex;align-items:center;gap:16px;margin-top:30px}
  .ctrl{display:inline-flex;align-items:center;gap:10px;background:var(--glass);border:1px solid var(--line);
    color:var(--ink);border-radius:999px;padding:11px 18px;cursor:pointer;font-family:var(--font-body);
    font-size:13.5px;font-weight:500;transition:transform .5s var(--ease),background .4s var(--ease),border-color .4s var(--ease)}
  .ctrl:hover{background:var(--glass-2);border-color:var(--line);transform:translateY(-1px)}
  .ctrl:active{transform:scale(.97)}
  .ctrl:disabled{opacity:.3;cursor:not-allowed;transform:none}
  .ctrl .ic{width:17px;height:17px}
  .ctrl.next{color:#06120c;background:var(--ink);border-color:var(--ink)}
  .counter{margin:0 auto;font-size:13px;color:var(--ink-3);font-variant-numeric:tabular-nums;letter-spacing:.04em}
  .counter b{color:var(--ink);font-family:var(--font-display);font-weight:600}

  /* ---------- FOOTER ---------- */
  footer{padding:72px 0 60px;border-top:1px solid var(--line);margin-top:40px}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;gap:30px;flex-wrap:wrap}
  .foot .big{font-family:var(--font-display);font-size:clamp(1.5rem,3.2vw,2.3rem);font-weight:500;letter-spacing:-.025em;max-width:540px;line-height:1.1}
  .foot .meta{color:var(--ink-3);font-size:13px;text-align:right;line-height:1.7}
  .foot .meta b{color:var(--ink-2);font-weight:500}

  /* ---------- REVEAL ---------- */
  .reveal{opacity:0;transform:translateY(34px);filter:blur(8px);
    transition:opacity .9s var(--ease-2),transform .9s var(--ease-2),filter .9s var(--ease-2)}
  .reveal.in{opacity:1;transform:none;filter:none}
  .reveal.d1{transition-delay:.08s}.reveal.d2{transition-delay:.16s}
  .reveal.d3{transition-delay:.24s}.reveal.d4{transition-delay:.32s}${previewRule}

  .print-only{display:none}

  /* ---------- RESPONSIVE ---------- */
  @media(max-width:900px){
    .nav-links{display:none}
    .bento{grid-template-columns:1fr}
    .phases{grid-template-columns:repeat(${tabletCols},1fr)}
  }
  @media(max-width:620px){
    .wrap{padding:0 18px}
    nav{padding:12px}
    .nav-pill{padding:9px 9px 9px 16px}
    .brand small{display:none}
    section{padding:70px 0}
    .week-core{padding:30px 22px;min-height:0}
    .phases{grid-template-columns:1fr}
    .stat{min-width:calc(50% - 7px)}
    .pills{justify-content:flex-start;scroll-snap-type:x mandatory}
    .type-chip{margin-left:0}
    .week-top{gap:10px}
    .deliver{flex-direction:column;gap:12px}
    .foot{flex-direction:column;align-items:flex-start}
    .foot .meta{text-align:left}
  }
  @media(prefers-reduced-motion:reduce){
    *{animation:none!important;transition-duration:.01ms!important}
    .reveal{opacity:1;transform:none;filter:none}
  }

  /* ---------- PRINT ---------- */
  /* "Resumen + semanas": portada, fases y las semanas expandidas.
     Fuera: el nav, el navegador interactivo y el esquema de trabajo ENTERO. */
  @media print{
    @page{margin:13mm 12mm}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    nav,.scroll-cue,.week-controls,.nav-rail,.mesh,.grain,.week-glow,.btn,.np,#trabajo{display:none!important}
    html,body{background:#fff!important;color:#111}
    .wrap{padding:0!important;max-width:none}
    .interactive-week{display:none!important}
    .print-only{display:block!important}
    /* reveal animations never run in headless print -> force everything visible */
    .reveal{opacity:1!important;transform:none!important;filter:none!important}
    section{padding:15px 0!important;break-inside:auto}
    .sec-head{break-inside:avoid;break-after:avoid}
    .sec-head{margin-bottom:15px}
    .hero{min-height:0!important;padding:4px 0 14px!important}
    .hero h1{font-size:2.5rem}
    .hero h1 .l2{color:#999!important}
    .hero p.lead{font-size:.92rem;margin-top:14px}
    .hero .stats{gap:8px;margin-top:20px}
    h1,h2,.sec-head h2{color:#111!important}
    .sec-head p,.hero p.lead,.hero .meta-line{color:#444!important}
    .eyebrow{color:#555!important;border-color:#d0d0d0!important;background:none!important}
    .eyebrow .dot{display:none}
    /* flatten double-bezel to one clean card; never split a card across pages */
    .shell{background:none!important;border:none!important;padding:0!important;border-radius:0!important;
      break-inside:avoid!important;page-break-inside:avoid!important}
    .core{background:#fafafa!important;border:1px solid #e5e5e5!important;color:#111!important;
      box-shadow:none!important;border-radius:12px!important;min-height:0!important}
    .phase h3,.stat .n{color:#111!important}
    .phase .desc,.phase .wk,.stat .k,.phase .pnum{color:#555!important}
    .stat{background:#fafafa!important;border:1px solid #e5e5e5!important;color:#111;
      break-inside:avoid!important;page-break-inside:avoid!important}
    .phases{grid-template-columns:repeat(${printCols},1fr)!important;gap:10px!important}
    .progress-track{break-inside:avoid}
    /* week cards (print-only list) */
    .print-only{margin-top:6px}
    .pweek{break-inside:avoid!important;page-break-inside:avoid!important;border:1px solid #ddd;
      border-radius:12px;padding:13px 17px;margin-bottom:9px;background:#fafafa}
    .pweek h3{color:#111;font-size:1.02rem;margin-bottom:6px;font-family:var(--font-display)}
    .pweek .pmeta{font-size:10.5px;color:#666;margin-bottom:8px;text-transform:uppercase;letter-spacing:.07em}
    .pweek ul{margin:0 0 0 16px;padding:0}
    .pweek li{color:#222;font-size:12px;margin:3px 0;line-height:1.45}
    .pweek .pdel{margin-top:8px;font-size:12px;color:#111;background:#eef0ee;border-radius:8px;padding:9px 11px}
    footer{break-inside:avoid;border-top:1px solid #ddd;padding:22px 0 0;margin-top:14px}
    .foot .big{color:#111!important;font-size:1.4rem}
    .foot .meta,.foot .meta b{color:#555!important}
  }`
}

// ─────────────────────────────────────────────────────────────────────────────
// <script> embebido — portado textual del original (index.html:483–638)
// ─────────────────────────────────────────────────────────────────────────────

function buildScript({ phasesObj, weeksData, hasWeeks, preview }) {
  const consts = `const PHASES=${jsonForScript(phasesObj)};
const ICONS=${jsonForScript(UI_ICONS)};
const DK=${jsonForScript(DELIVER_KINDS)};
const TYPE=${jsonForScript(WEEK_TYPES)};

const WEEKS=${jsonForScript(weeksData)};`

  // Sin semanas no existen #pills, #weekSwap ni #printAll: no emitimos nada de esto.
  const weeksBlock = !hasWeeks ? '' : `let active=0;
const pillsEl=document.getElementById('pills');
const swapEl=document.getElementById('weekSwap');
const shellEl=document.getElementById('weekShell');
const prevBtn=document.getElementById('prevBtn');
const nextBtn=document.getElementById('nextBtn');
const curN=document.getElementById('curN');

WEEKS.forEach((w,i)=>{
  const col=PHASES[w.phase].col;
  const b=document.createElement('button');
  b.type='button';
  b.className='pill';b.style.setProperty('--col',col);
  b.innerHTML='<span class="node">'+w.n+'</span><span class="lbl">'+PHASES[w.phase].label+'</span>';
  b.addEventListener('click',()=>go(i));
  pillsEl.appendChild(b);
});
const pillNodes=[...pillsEl.children];

function buildHTML(w){
  const t=TYPE[w.type];
  const tasks=w.tasks.map(x=>'<div class="task"><span class="tick">'+ICONS.tick+'</span><span>'+x+'</span></div>').join('');
  return ''+
   '<div class="week-top">'+
     '<span class="phase-chip"><span class="d"></span>'+PHASES[w.phase].label+'</span>'+
     '<span class="days-chip">'+ICONS.cal+w.days+'</span>'+
     '<span class="type-chip '+t.cls+'">'+ICONS[t.icon]+t.label+'</span>'+
   '</div>'+
   '<h3 class="wt"><span class="wn">Semana '+w.n+'</span> — '+w.title+'</h3>'+
   '<div class="tasks">'+tasks+'</div>'+
   '<div class="deliver">'+
     '<span class="dic">'+ICONS[w.deliver.kind]+'</span>'+
     '<div><div class="dk">'+DK[w.deliver.kind]+'</div><div class="dt">'+w.deliver.text+'</div></div>'+
   '</div>';
}

function go(i){
  if(i<0||i>=WEEKS.length||i===active) {syncControls();return;}
  active=i;
  const w=WEEKS[i];const col=PHASES[w.phase].col;
  swapEl.classList.add('out');
  setTimeout(()=>{
    shellEl.style.setProperty('--col',col);
    swapEl.innerHTML=buildHTML(w);
    swapEl.classList.remove('out');
  },200);
  syncControls();
}
function centerPill(idx,smooth){
  const p=pillNodes[idx];if(!p)return;
  const target=p.offsetLeft-(pillsEl.clientWidth/2)+(p.offsetWidth/2);
  pillsEl.scrollTo({left:Math.max(0,target),behavior:smooth?'smooth':'auto'});
}
function syncControls(){
  pillNodes.forEach((p,idx)=>p.classList.toggle('active',idx===active));
  curN.textContent=WEEKS[active].n;
  prevBtn.disabled=active===0;
  nextBtn.disabled=active===WEEKS.length-1;
  centerPill(active,true);
}
prevBtn.addEventListener('click',()=>go(active-1));
nextBtn.addEventListener('click',()=>go(active+1));
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight')go(active+1);
  if(e.key==='ArrowLeft')go(active-1);
});

// initial paint (no transition)
shellEl.style.setProperty('--col',PHASES[WEEKS[0].phase].col);
swapEl.innerHTML=buildHTML(WEEKS[0]);
syncControls();

// print version: all weeks expanded
document.getElementById('printAll').innerHTML=WEEKS.map(w=>{
  const li=w.tasks.map(t=>'<li>'+t+'</li>').join('');
  return '<div class="pweek"><h3>Semana '+w.n+' — '+w.title+'</h3>'+
    '<div class="pmeta">'+PHASES[w.phase].label+' · '+w.days+' · '+TYPE[w.type].label+'</div>'+
    '<ul>'+li+'</ul><div class="pdel"><b>'+DK[w.deliver.kind]+':</b> '+w.deliver.text+'</div></div>';
}).join('');`

  // En preview las .reveal ya están forzadas visibles por la regla .preview .reveal (D-A).
  const revealBlock = preview ? '' : `// scroll reveals
const io=new IntersectionObserver((es)=>{
  es.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});
},{threshold:.14,rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el));`

  const navBlock = `// nav hide on scroll down
let lastY=0;const navEl=document.getElementById('nav');
window.addEventListener('scroll',()=>{
  const y=window.scrollY;
  navEl.style.transform=(y>lastY&&y>320)?'translateY(-130%)':'translateY(0)';
  lastY=y;
},{passive:true});`

  return [consts, weeksBlock, revealBlock, navBlock].filter(Boolean).join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPlanHTML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El documento completo. Una sola función para preview, export y publicación (D5).
 *
 * @param {object} plan   Un Plan del modelo de MASTER_PLAN.md §4.
 * @param {{preview?:boolean}} opts
 *        `preview:true` hace EXACTAMENTE dos cosas (D-A): agrega class="preview"
 *        al <html> con su regla CSS, y saltea el IntersectionObserver. Nada más.
 * @returns {string} HTML autocontenido.
 */
export function buildPlanHTML(plan, opts = {}) {
  const preview = !!(opts && opts.preview === true)
  const sp = sanitizePlan(plan)

  const hitos = sp.hitos
  const weeks = sp.weeks
  const safeIds = safeIdsFor(hitos)

  // hito (por identidad) → safeId. hitoForWeek() devuelve un elemento de sp.hitos
  // o el NEUTRAL_HITO importado; con eso alcanza para resolver el token.
  const idOfHito = new Map()
  hitos.forEach((h, i) => idOfHito.set(h, safeIds[i]))
  const safeIdOf = (h) => (h === NEUTRAL_HITO ? '_neutral' : idOfHito.get(h) ?? '_neutral')
  const tokenOf = (h) => 'var(--c-hito-' + safeIdOf(h) + ')'

  // ── Colores derivados (R4 / D-C) ───────────────────────────────────────────
  const firstMilestone = hitos.find((h) => h.isMilestone)
  const accent = safeColor(
    (firstMilestone && firstMilestone.color) || (hitos[0] && hitos[0].color),
    ACCENT_FALLBACK,
  )
  // El mesh usa los 3 primeros hitos formales; después los demás; después el acento.
  const meshPool = [
    ...hitos.filter((h) => h.isMilestone).map((h) => h.color),
    ...hitos.filter((h) => !h.isMilestone).map((h) => h.color),
  ]
  const mesh = [0, 1, 2].map((i) => meshPool[i] || accent)

  const phaseCols = Math.max(1, Math.min(hitos.length, 4))

  const previewRule = preview
    ? '\n  .preview .reveal{opacity:1!important;transform:none!important;filter:none!important}'
    : ''

  const css = buildCSS({ hitos, safeIds, accent, mesh, phaseCols, previewRule })

  // ── <head> ─────────────────────────────────────────────────────────────────
  const favicon =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='" +
    encodeURIComponent(accent) +
    "'/%3E%3Cpath d='M16 8v16M8 16h16' stroke='%2304140d' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E"

  // ── <nav> ──────────────────────────────────────────────────────────────────
  // Los links se derivan de las secciones que existen: no se editan a mano.
  // Con el esquema oculto, "Esquema" no aparece (sería un ancla muerta).
  const navItems = [
    ...(sp.showSchema === false ? [] : [{ label: 'Esquema', href: '#trabajo' }]),
    { label: 'Fases', href: '#fases' },
    { label: 'Semanas', href: '#semanas' },
  ]
  const navLinks = navItems.map((l) => `      <a href="${l.href}">${l.label}</a>`).join('\n')

  // El tagline del nav reutiliza el nombre del cliente si no se especificó otro.
  const brandTagline = sp.brand.tagline || sp.clientName
  const brandSmall = brandTagline ? `&nbsp;<small>· ${brandTagline}</small>` : ''

  // ── Hero ───────────────────────────────────────────────────────────────────
  // Subtítulo y eyebrow tienen default fijo: rara vez cambian (campos avanzados).
  const heroEyebrow = sp.heroEyebrow || 'Insights Apps · Plan de ejecución'
  const subtitleHtml = `<span class="l2">${sp.subtitle || 'semana a semana.'}</span>`
  const leadHtml = sp.lead ? `\n    <p class="lead reveal in d2">${sp.lead}</p>` : ''
  const scrollCueHtml = sp.scrollCue
    ? `\n    <div class="scroll-cue reveal in d4"><span class="bar"></span> ${sp.scrollCue}</div>`
    : ''

  // ── #trabajo ───────────────────────────────────────────────────────────────
  const bentoHtml = sp.schema
    .map(
      (c, i) => `      <div class="comm shell reveal ${i % 2 === 0 ? 'd1' : 'd2'}"><div class="core">
        <div class="comm-ic"${c.color ? ` style="color:${c.color}"` : ''}>${schemaIcon(c.icon)}</div>
        <h3>${c.title}</h3>
        <p>${c.text}</p>
        <div class="tagrow">${c.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      </div></div>`,
    )
    .join('\n')

  const schemaSection = !sp.showSchema
    ? ''
    : `
<!-- ESQUEMA DE TRABAJO -->
<section id="trabajo">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="dot"></span> ${sp.sections.schema.eyebrow}</span>
      <h2>${sp.sections.schema.title}</h2>
      <p>${sp.sections.schema.lead}</p>
    </div>
    <div class="bento">
${bentoHtml}
    </div>
  </div>
</section>
`

  // ── #fases ─────────────────────────────────────────────────────────────────
  const segsHtml = hitos
    .map((h, i) => {
      const span = Number.isFinite(h.weekTo - h.weekFrom) ? Math.max(1, h.weekTo - h.weekFrom + 1) : 1
      return `      <div class="seg" style="--w:${span};--col:var(--c-hito-${safeIds[i]})"></div>`
    })
    .join('\n')

  // .reveal solo define delays hasta d4. Con 5+ hitos, capamos el sufijo.
  const phasesHtml = hitos
    .map(
      (h, i) => `      <div class="phase shell reveal d${Math.min(i + 1, 4)}" style="--col:var(--c-hito-${safeIds[i]})"><div class="core">
        <div class="pic">${phaseIcon(h.icon)}</div>
        <div class="pnum">${h.label}</div>
        <h3>${h.title}</h3>
        <div class="wk">${h.weeksLabel}</div>
        <div class="desc">${h.description}</div>
      </div></div>`,
    )
    .join('\n')

  // ── #semanas ───────────────────────────────────────────────────────────────
  const hasWeeks = weeks.length > 0
  const firstWeekToken = hasWeeks ? tokenOf(hitoForWeek(sp, weeks[0].n)) : ''

  const weekNavHtml = !hasWeeks
    ? ''
    : `
    <div class="interactive-week reveal">
      <div class="nav-rail">
        <div class="rail-line"></div>
        <div class="pills" id="pills"></div>
      </div>

      <div class="week-shell shell" id="weekShell" style="--col:${firstWeekToken}">
        <div class="week-core">
          <div class="week-glow"></div>
          <div class="swap" id="weekSwap"></div>
        </div>
      </div>

      <div class="week-controls">
        <button class="ctrl prev" type="button" id="prevBtn">${ARROW_LEFT_ICON} Anterior</button>
        <span class="counter">Semana <b id="curN">1</b> de ${weeks.length}</span>
        <button class="ctrl next" type="button" id="nextBtn">Siguiente ${ARROW_RIGHT_ICON}</button>
      </div>
    </div>

    <div class="print-only" id="printAll"></div>
`

  // ── <footer> ───────────────────────────────────────────────────────────────
  const fBrand = sp.footer.brand || 'Insights Apps'
  const fLines = (sp.footer.lines && sp.footer.lines.length) ? sp.footer.lines : [sp.clientName].filter(Boolean)
  let footMeta = `<b>${fBrand}</b>`
  if (fLines.length) footMeta += ` · ${fLines[0]}`
  footMeta += fLines
    .slice(1)
    .map((l) => `<br/>\n      ${l}`)
    .join('')

  // ── <script> ───────────────────────────────────────────────────────────────
  const phasesObj = {}
  hitos.forEach((h, i) => {
    phasesObj[safeIds[i]] = { label: h.label, col: 'var(--c-hito-' + safeIds[i] + ')' }
  })
  phasesObj._neutral = { label: NEUTRAL_HITO.label, col: 'var(--c-hito-_neutral)' }

  const weeksData = weeks.map((w) => ({
    n: w.n,
    phase: safeIdOf(hitoForWeek(sp, w.n)),
    days: daysForWeek(sp, w),
    title: w.title,
    type: w.type,
    tasks: w.tasks,
    deliver: { kind: w.deliver.kind, text: w.deliver.text },
  }))

  const script = buildScript({ phasesObj, weeksData, hasWeeks, preview })

  // ── El documento ───────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="es"${preview ? ' class="preview"' : ''}>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>${sp.docTitle || (sp.title ? sp.title + ' — Plan de ejecución' : 'Plan de ejecución')}</title>
<meta name="description" content="${sp.metaDescription || sp.lead || sp.title}" />
<link rel="icon" href="${favicon}" />
<link rel="preconnect" href="https://api.fontshare.com" crossorigin />
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@600,500,700,400&f[]=satoshi@400,500,700&display=swap" rel="stylesheet" />
<style>
${css}
</style>
</head>
<body>
<div class="mesh"></div>
<div class="grain"></div>

<nav id="nav">
  <div class="nav-pill">
    <div class="brand">
      <span class="spark">${BRAND_SPARK_ICON}</span>
      ${sp.brand.name}${brandSmall}
    </div>
    <div class="nav-links">
${navLinks}
    </div>
    <button class="btn" type="button" onclick="window.print()">
      Descargar PDF
      <span class="iconwrap">${DOWNLOAD_ICON}</span>
    </button>
  </div>
</nav>

<header class="hero">
  <div class="wrap">
    <span class="eyebrow reveal in"><span class="dot"></span> ${heroEyebrow}</span>
    <h1 class="reveal in d1">${sp.title}${subtitleHtml}</h1>${leadHtml}${scrollCueHtml}
  </div>
</header>
${schemaSection}
<!-- FASES -->
<section id="fases">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="dot"></span> ${sp.sections.phases.eyebrow}</span>
      <h2>${sp.sections.phases.title}</h2>
      <p>${sp.sections.phases.lead}</p>
    </div>
    <div class="progress-track reveal">
${segsHtml}
    </div>
    <div class="phases">
${phasesHtml}
    </div>
  </div>
</section>

<!-- SEMANA A SEMANA -->
<section id="semanas">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="dot"></span> ${sp.sections.weeks.eyebrow}</span>
      <h2>${sp.sections.weeks.title}</h2>
      <p class="np">${sp.sections.weeks.lead}</p>
    </div>
${weekNavHtml}  </div>
</section>

<footer>
  <div class="wrap foot">
    <div class="big">${sp.footer.big || 'Listo para empezar con claridad total desde el día uno.'}</div>
    <div class="meta">
      ${footMeta}
    </div>
  </div>
</footer>

<script>
${script}
</script>
</body>
</html>
`
}
