/* ============================================================================
   INSIGHTS SOFTWARE — PROJECT OS
   Single-file React SPA · Dark/Light · GitHub + Fathom + Anthropic integrations
   Aesthetic: minimal-industrial · editorial type · deep black + orange #F97316
   ----------------------------------------------------------------------------
   Stack: React 18 + framer-motion. Self-contained: styles injected at runtime,
   state persisted to localStorage. Fonts: Bricolage Grotesque / DM Sans.
============================================================================ */
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@supabase/supabase-js'
import OnboardingLanding from './Onboarding'
import OnboardingV2 from './OnboardingV2'
import { uid, AppCtx, useApp, Modal, Field, stagger, rise } from './ui.jsx'
import { I2 } from './ui/icons2.jsx'
import {
  PHASES, phaseInfo, phaseMeta, normalizeLifecycle, advancePhase,
  suggestedTransition, billingNotice, markNoticeSent,
} from './lib/lifecycle.js'
import { buildMaintenanceNotice } from './emails/maintenanceNotice.js'
import { isDev, canSeeAllToggle, visibleProjects } from './lib/visibility.js'
import {
  taskText, taskDone, weekProgress,
  toggleTaskDone, hitoForWeek,
  taskEstado, setTaskEstado, normalizeTask as normalizePlanTask, normalizeTasks, planBoardSummary,
  taskResponsable, planPendingCliente,
  TASK_ESTADOS, TASK_ESTADO_CHOICES, RIESGOS, EVIDENCIA_TIPOS, RESPONSABLES,
} from './plan/planModel.js'
import { projectProgress, progressBreakdown, progressColorVar } from './lib/progress.js'
import PlannerView from './plan/PlannerView.jsx'
import BotView from './bot/BotView.jsx'

/* ============================================================================
   0 · SUPABASE (cloud persistence + auth) — optional, enabled via env vars
   VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY (set locally in .env and in Render)
============================================================================ */
// Podés configurarlo por variables de entorno (Render) O hardcodearlo acá abajo.
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yzmtzyuncekspgtsetwk.supabase.co'
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '' // ← pegá acá tu publishable key (sb_publishable_…) y el login funciona sin tocar Render
const supabase = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null
const cloudEnabled = !!supabase
/* versión de la app — bumpeá esto en cada release para que se vea en el botón "Actualizar" */
const APP_VERSION = '1.1.0'

/* ============================================================================
   1 · THEME TOKENS + GLOBAL STYLE INJECTION
============================================================================ */
const THEMES = {
  dark: {
    '--bg': '#0A0A0A',
    '--bg-elevated': '#0E0E0E',
    '--card': '#111111',
    '--card-hover': '#161616',
    '--border': '#1F1F1F',
    '--border-strong': '#2A2A2A',
    '--text': '#FAFAFA',
    '--text-dim': '#A1A1A1',
    '--text-faint': '#6B6B6B',
    '--accent': '#F97316',
    '--accent-soft': 'rgba(249,115,22,0.14)',
    '--accent-line': 'rgba(249,115,22,0.32)',
    '--green': '#34D399',
    '--green-soft': 'rgba(52,211,153,0.14)',
    '--red': '#F87171',
    '--red-soft': 'rgba(248,113,113,0.14)',
    '--yellow': '#FBBF24',
    '--yellow-soft': 'rgba(251,191,36,0.14)',
    '--blue': '#60A5FA',
    '--blue-soft': 'rgba(96,165,250,0.14)',
    '--shadow': '0 1px 0 rgba(255,255,255,0.03), 0 18px 40px -20px rgba(0,0,0,0.8)',
    '--shadow-lift': '0 1px 0 rgba(255,255,255,0.05), 0 30px 56px -26px rgba(0,0,0,0.95)',
    '--track': 'rgba(255,255,255,0.055)',
    '--grid': 'rgba(255,255,255,0.025)',
  },
  light: {
    '--bg': '#F8F8F6',
    '--bg-elevated': '#FFFFFF',
    '--card': '#FFFFFF',
    '--card-hover': '#FCFBF9',
    '--border': '#E7E5E1',
    '--border-strong': '#D6D3CD',
    '--text': '#0A0A0A',
    '--text-dim': '#5C5A55',
    '--text-faint': '#9B9892',
    '--accent': '#EA6A00',
    '--accent-soft': 'rgba(234,106,0,0.10)',
    '--accent-line': 'rgba(234,106,0,0.28)',
    '--green': '#0E9F6E',
    '--green-soft': 'rgba(14,159,110,0.10)',
    '--red': '#DC2626',
    '--red-soft': 'rgba(220,38,38,0.08)',
    '--yellow': '#B45309',
    '--yellow-soft': 'rgba(180,83,9,0.10)',
    '--blue': '#2563EB',
    '--blue-soft': 'rgba(37,99,235,0.10)',
    '--shadow': '0 1px 2px rgba(16,15,12,0.04), 0 12px 30px -18px rgba(16,15,12,0.18)',
    '--shadow-lift': '0 2px 4px rgba(16,15,12,0.05), 0 24px 46px -20px rgba(16,15,12,0.28)',
    '--track': 'rgba(10,10,10,0.075)',
    '--grid': 'rgba(10,10,10,0.022)',
  },
}

const GLOBAL_CSS = `
*,*::before,*::after{box-sizing:border-box}
html,body,#root{height:100%;margin:0}
body{
  font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  background:var(--bg);color:var(--text);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  transition:background .35s ease,color .35s ease;
}
::selection{background:var(--accent-soft);color:var(--text)}
h1,h2,h3,h4{font-family:'Bricolage Grotesque',serif;margin:0;letter-spacing:-0.02em;font-weight:600}
.mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
input,textarea,select{font-family:inherit;color:inherit}
a{color:inherit;text-decoration:none}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:6px;border:2px solid var(--bg)}
::-webkit-scrollbar-thumb:hover{background:var(--text-faint)}

.app-shell{display:flex;height:100vh;overflow:hidden;
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:46px 46px;}
.surface{background:var(--card);border:1px solid var(--border);border-radius:16px}
.surface-hover{transition:background .18s,border-color .18s,transform .18s}
.surface-hover:hover{background:var(--card-hover);border-color:var(--border-strong)}
.tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;
  padding:3px 9px;border-radius:999px;letter-spacing:.02em;line-height:1.4;border:1px solid transparent}
.btn{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;
  padding:8px 13px;border-radius:10px;border:1px solid var(--border);background:var(--bg-elevated);
  color:var(--text);transition:all .16s;white-space:nowrap}
.btn:hover{border-color:var(--accent-line);background:var(--card-hover)}
.btn-accent{background:var(--accent);color:#fff;border-color:var(--accent)}
.btn-accent:hover{filter:brightness(1.08);background:var(--accent)}
.btn-ghost{background:transparent;border-color:transparent}
.btn-ghost:hover{background:var(--card-hover);border-color:var(--border)}
.btn-sm{padding:5px 9px;font-size:12px;border-radius:8px}
.input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);
  background:var(--bg-elevated);font-size:14px;transition:border-color .16s;outline:none}
.input:focus{border-color:var(--accent-line)}
.label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)}
.divider{height:1px;background:var(--border);border:none;margin:0}
.kbd{font-family:'JetBrains Mono',monospace;font-size:11px;padding:1px 6px;border-radius:5px;
  border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim)}
.scroll-y{overflow-y:auto}
.click{cursor:pointer}
table{border-collapse:collapse;width:100%}
.row-hover:hover{background:var(--card-hover)}
.fade-edge{-webkit-mask-image:linear-gradient(to bottom,transparent,#000 12px,#000 calc(100% - 12px),transparent)}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
.skel{background:linear-gradient(90deg,var(--card) 25%,var(--card-hover) 50%,var(--card) 75%);
  background-size:800px 100%;animation:shimmer 1.4s infinite linear;border-radius:8px}

/* ============================================================================
   PANEL PROYECTOS — rediseño 2026-08
   Una sola curva de movimiento (--e) para toda la vista: si todo se mueve con
   el mismo ritmo, la interfaz se lee como una pieza y no como diez componentes.
   Solo se animan transform / opacity / color: nada que dispare layout.
============================================================================ */
:root{ --e:cubic-bezier(.32,.72,0,1) }

/* foco visible en TODO lo interactivo — antes no existía y no se podía navegar con teclado */
button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible,
textarea:focus-visible,[role="button"]:focus-visible,[role="switch"]:focus-visible,[tabindex]:focus-visible{
  outline:2px solid var(--accent);outline-offset:2px;border-radius:10px}

/* --- header: buscador, segmentados, selects, CTA --- */
.pj-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}
.pj-search{display:flex;align-items:center;gap:9px;width:290px;max-width:52vw;height:38px;padding:0 13px;
  border-radius:999px;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:box-shadow .3s var(--e),background .3s var(--e)}
.pj-search:focus-within{box-shadow:inset 0 0 0 1px var(--accent-line),0 0 0 3px var(--accent-soft)}
.pj-search input{flex:1;min-width:0;border:none;background:transparent;font-size:13.5px;color:var(--text);outline:none}
.pj-search input::placeholder{color:var(--text-faint)}

.pj-seg{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:var(--bg-elevated);
  box-shadow:inset 0 0 0 1px var(--border)}
.pj-seg > button{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:9px;
  font-size:13px;font-weight:600;color:var(--text-faint);white-space:nowrap;
  transition:color .26s var(--e),background .26s var(--e),box-shadow .26s var(--e)}
.pj-seg > button:hover{color:var(--text-dim)}
.pj-seg > button[aria-selected="true"],.pj-seg > button[aria-pressed="true"]{
  color:var(--text);background:var(--card);box-shadow:inset 0 0 0 1px var(--border),0 1px 2px rgba(0,0,0,.10)}
.pj-seg .n{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-faint)}
.pj-seg > button[aria-selected="true"] .n{color:var(--accent)}

.pj-selw{position:relative;display:inline-flex}
.pj-selw > svg{position:absolute;right:9px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text-faint)}
.pj-sel{appearance:none;-webkit-appearance:none;height:32px;padding:0 27px 0 11px;border-radius:9px;border:none;
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);max-width:210px;
  font-size:12.5px;font-weight:600;color:var(--text-dim);cursor:pointer;outline:none;
  transition:box-shadow .26s var(--e),color .26s var(--e),background .26s var(--e)}
.pj-sel:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--border-strong)}
.pj-sel[data-on="1"]{color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line)}
.pj-sel option{background:var(--bg-elevated);color:var(--text)}

.pj-cta{display:inline-flex;align-items:center;gap:10px;height:40px;padding:0 5px 0 16px;border-radius:999px;
  background:var(--accent);color:#fff;font-size:13.5px;font-weight:700;letter-spacing:-.012em;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14);transition:transform .3s var(--e),box-shadow .3s var(--e),filter .3s var(--e)}
.pj-cta:hover{transform:translateY(-1px);filter:brightness(1.035);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 8px 18px -12px rgba(0,0,0,.4)}
.pj-cta:active{transform:translateY(0) scale(.98)}
.pj-cta i{display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:rgba(255,255,255,.18);
  transition:background .3s var(--e)}
.pj-cta:hover i{background:rgba(255,255,255,.26)}

.pj-switch{display:inline-flex;align-items:center;gap:9px;font-size:12.5px;font-weight:600;color:var(--text-dim);
  padding:4px 10px 4px 4px;border-radius:999px;transition:color .26s var(--e),background .26s var(--e)}
.pj-switch:hover{color:var(--text);background:var(--card-hover)}
.pj-switch .tr{position:relative;width:34px;height:20px;border-radius:999px;flex:none;background:var(--bg-elevated);
  box-shadow:inset 0 0 0 1px var(--border);transition:background .32s var(--e),box-shadow .32s var(--e)}
.pj-switch .tr::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;
  background:var(--text-faint);transition:transform .36s var(--e),background .36s var(--e)}
.pj-switch[aria-checked="true"]{color:var(--text)}
.pj-switch[aria-checked="true"] .tr{background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line)}
.pj-switch[aria-checked="true"] .tr::after{transform:translateX(14px);background:var(--accent)}

/* --- la card --- */
.pj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,268px),1fr));gap:16px}
.pj-card{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;
  padding:11px 14px 12px;border-radius:18px;background:var(--card);cursor:pointer;
  box-shadow:inset 0 0 0 1px var(--border),var(--shadow);
  transition:transform .38s var(--e),background .38s var(--e),box-shadow .38s var(--e)}
.pj-card:hover{background:var(--card-hover);transform:translateY(-3px);
  box-shadow:inset 0 0 0 1px var(--border-strong),var(--shadow-lift)}
.pj-card:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.pj-card .nm{font-size:15.5px;font-weight:650;letter-spacing:-.022em;line-height:1.22;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.pj-card .cl{margin-top:4px;font-size:12px;color:var(--text-dim);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}

.pj-ring{position:relative;flex:none;line-height:0}
.pj-ring .in{position:absolute;inset:0;display:grid;place-items:center}
.pj-ring .pct{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;
  font-size:27px;font-weight:600;letter-spacing:-.045em;line-height:1}
@keyframes pjDraw{from{stroke-dashoffset:var(--ring-c)}}
.pj-ringfill{animation:pjDraw 1.05s var(--e) both}

.pj-status{display:inline-flex;align-items:center;gap:6px;padding:3px 7px 3px 6px;border-radius:999px;
  font-size:11px;font-weight:600;color:var(--text-dim);letter-spacing:.005em;
  transition:color .26s var(--e),background .26s var(--e)}
.pj-status:hover{color:var(--text);background:var(--card-hover)}
.pj-status .cv{opacity:0;transition:opacity .26s var(--e)}
.pj-status:hover .cv,.pj-status:focus-visible .cv{opacity:1}
.pj-dot{position:relative;width:6px;height:6px;border-radius:50%;flex:none}
.pj-dot::after{content:"";position:absolute;inset:-5px;border-radius:50%;background:inherit;opacity:.26}
.pj-dot.live::after{animation:pjBreathe 3s var(--e) infinite}
/* latido: más amplitud que antes (.5→1 / .30 op) para que se note que está vivo,
   pero sigue siendo una onda que se desvanece, no un parpadeo. */
@keyframes pjBreathe{0%,100%{transform:scale(.42);opacity:.55}55%{transform:scale(1.32);opacity:0}}

.pj-line{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;
  margin-top:11px;padding-top:9px;border-top:1px solid var(--border);font-size:11.5px;color:var(--text-dim)}
.pj-line b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;
  font-size:13.5px;font-weight:600;letter-spacing:-.02em}
.pj-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
  margin-top:10px;padding-top:9px;border-top:1px solid var(--border)}
.pj-ib{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;color:var(--text-faint);
  transition:color .24s var(--e),background .24s var(--e),transform .24s var(--e),box-shadow .24s var(--e)}
.pj-ib:hover{color:var(--text);background:var(--card-hover);box-shadow:inset 0 0 0 1px var(--border)}
.pj-ib:active{transform:scale(.93)}
.pj-ib.scope{color:var(--accent)}
.pj-ib.wa:hover{color:#25D366}
.pj-ib.off{opacity:.4}

.pj-empty{display:flex;flex-direction:column;align-items:center;gap:4px;padding:52px 24px;border-radius:18px;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.pj-empty .ic{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;margin-bottom:10px;
  color:var(--text-faint);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.pj-skel{height:246px;border-radius:18px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);
  position:relative;overflow:hidden}
.pj-skel::after{content:"";position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,var(--card-hover),transparent);
  background-size:600px 100%;animation:shimmer 1.5s infinite linear}

@media (prefers-reduced-motion: reduce){
  .pj-card,.pj-card:hover{transform:none}
  .pj-ringfill{animation:none}
  .pj-dot::after{animation:none;opacity:.18}
  .pj-skel::after{animation:none}
  .pj-cta:hover i{transform:none}
}

/* --- responsive / mobile --- */
@media (max-width: 760px){
  .app-shell{ background-image:none }
  .view{ padding:18px 14px 48px !important }
  .tbl{ overflow-x:auto !important }
  .tbl > table{ min-width:600px }
  .hide-mobile{ display:none !important }
  .pj-search{ width:100%; max-width:none; height:42px }
  .pj-ib{ width:40px; height:40px }
  .pj-seg > button{ height:38px }
  .pj-sel{ height:38px; max-width:none }
  .pj-cta{ height:44px }
}

/* ============================================================================
   DETALLE DE PROYECTO — rediseño 2026-08
   Dos decisiones mandan acá:
   1) UNA sola superficie (.pd-panel). Antes convivían .surface, cajas con
      borde y cajas con sombra: el marco competía con el dato.
   2) Los nueve botones iguales se parten en dos grupos con peso distinto:
      enlaces que SALEN de la app (.pd-lnk, con la flechita adentro de su
      propio círculo) y paneles internos que abren un modal (.pd-btn, tipo
      chip). Un enlace sin URL no se disfraza de enlace: se ve hueco y punteado
      y lo que hace es invitar a cargarlo.
   Mismo ritmo de movimiento que el listado (--e), solo transform/opacity.
============================================================================ */
.pd-shell{display:flex;height:100%;overflow:hidden}
.pd-main{flex:1 1 auto;min-width:0;overflow-y:auto;padding:20px 30px 64px}
.pd-back{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px 0 8px;border-radius:999px;
  font-size:12.5px;font-weight:600;color:var(--text-dim);
  transition:color .26s var(--e),background .26s var(--e),transform .26s var(--e)}
.pd-back:hover{color:var(--text);background:var(--card-hover)}
.pd-back:active{transform:translateX(-2px)}

.pd-panel{background:var(--card);border-radius:16px;box-shadow:inset 0 0 0 1px var(--border)}
.pd-panel.lift{box-shadow:inset 0 0 0 1px var(--border),var(--shadow)}
.pd-sec{margin-bottom:22px}
.pd-h{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.pd-h h2{font-size:16.5px;letter-spacing:-.024em}
.pd-h .sub{font-size:12.5px;color:var(--text-dim);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-eyebrow{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text-dim);
  white-space:nowrap}

.pd-title{font-family:'Bricolage Grotesque',serif;font-weight:600;font-size:clamp(23px,2.5vw,30px);
  line-height:1.08;letter-spacing:-.032em;min-width:0;overflow-wrap:anywhere}
.pd-meta{font-size:13.5px;color:var(--text-dim);margin-top:7px}
.pd-meta i{font-style:normal;color:var(--text-faint);padding:0 7px}

/* --- consola de acciones --- */
.pd-console{display:grid;grid-template-columns:66px 1fr;align-items:center;gap:11px 14px;padding:12px 14px}
.pd-row{display:flex;gap:7px;flex-wrap:wrap;min-width:0}
.pd-rule{grid-column:1/-1;height:1px;background:var(--border);margin:1px 0}

.pd-lnk{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 5px 0 11px;border-radius:10px;
  font-size:12.5px;font-weight:600;color:var(--text);background:var(--bg-elevated);
  box-shadow:inset 0 0 0 1px var(--border);
  transition:color .26s var(--e),background .26s var(--e),box-shadow .26s var(--e),transform .26s var(--e)}
.pd-lnk .go{display:grid;place-items:center;width:21px;height:21px;border-radius:7px;flex:none;color:var(--text-faint);
  background:var(--card-hover);transition:transform .32s var(--e),color .32s var(--e),background .32s var(--e)}
.pd-lnk:hover{color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line)}
.pd-lnk:hover .go{color:var(--accent);background:transparent;transform:translate(1.5px,-1.5px)}
.pd-lnk:active{transform:scale(.98)}
.pd-lnk.empty{color:var(--text-faint);background:transparent;
  box-shadow:inset 0 0 0 1px transparent;outline:1px dashed var(--border-strong);outline-offset:-1px;padding:0 11px}
.pd-lnk.empty:hover{color:var(--accent);background:var(--accent-soft);outline-color:var(--accent-line)}

.pd-btn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 11px;border-radius:10px;
  font-size:12.5px;font-weight:600;color:var(--text-dim);background:transparent;
  box-shadow:inset 0 0 0 1px var(--border);
  transition:color .26s var(--e),background .26s var(--e),box-shadow .26s var(--e),transform .26s var(--e)}
.pd-btn:hover{color:var(--text);background:var(--card-hover);box-shadow:inset 0 0 0 1px var(--border-strong)}
.pd-btn:active{transform:scale(.98)}
.pd-btn .n{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:10.5px;font-weight:700;
  padding:1.5px 6px;border-radius:999px;background:var(--bg-elevated);color:var(--text-faint);
  box-shadow:inset 0 0 0 1px var(--border)}
/* "Este panel tiene algo cargado" se dice con el relleno, no tiñendo el texto:
   naranja sobre blanco a 12.5px no llega al contraste mínimo. */
.pd-btn[data-tone="accent"]{color:var(--text);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line)}
.pd-btn[data-tone="accent"] .n{color:var(--accent);background:var(--card);box-shadow:none}
.pd-btn[data-tone="accent"] svg{color:var(--accent)}
.pd-dotmark{width:6px;height:6px;border-radius:50%;flex:none;margin-left:1px}

.pd-cta{display:inline-flex;align-items:center;gap:9px;height:34px;padding:0 5px 0 14px;border-radius:999px;
  background:var(--accent);color:#fff;font-size:13px;font-weight:700;letter-spacing:-.012em;flex:none;
  box-shadow:0 9px 20px -12px var(--accent);transition:transform .3s var(--e),filter .3s var(--e)}
.pd-cta:hover{filter:brightness(1.08)}
.pd-cta:active{transform:scale(.98)}
.pd-cta i{display:grid;place-items:center;width:26px;height:26px;border-radius:999px;flex:none;
  background:rgba(255,255,255,.20);transition:transform .34s var(--e),background .34s var(--e)}
.pd-cta:hover i{transform:translateX(2px) scale(1.05);background:rgba(255,255,255,.30)}
.pd-cta.quiet{background:var(--bg-elevated);color:var(--text);box-shadow:inset 0 0 0 1px var(--border)}
.pd-cta.quiet i{background:var(--card-hover);color:var(--text-faint)}
.pd-cta.quiet:hover{filter:none;color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-line)}

/* --- tira de stats: un solo bloque, celdas separadas por pelo --- */
.pd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));gap:1px;padding:1px;
  background:var(--border);border-radius:16px;overflow:hidden}
.pd-stat{display:flex;flex-direction:column;gap:6px;padding:13px 14px 14px;text-align:left;background:var(--card);
  transition:background .26s var(--e)}
.pd-stat:hover{background:var(--card-hover)}
.pd-stat .k{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pd-stat .v{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;
  font-size:23px;font-weight:600;letter-spacing:-.045em;line-height:1}
.pd-stat .s{font-size:11px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* --- stepper del ciclo de vida --- */
.pd-phases{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.pd-ph{display:flex;flex-direction:column;gap:4px;text-align:left;padding:0;background:none;border-radius:10px;
  transition:opacity .26s var(--e)}
.pd-ph .bar{position:relative;height:4px;border-radius:999px;background:var(--track);margin-bottom:10px;overflow:hidden}
.pd-ph .bar > span{position:absolute;inset:0;border-radius:999px;transform-origin:left center;
  transition:transform .7s var(--e)}
.pd-ph .nm{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:650;letter-spacing:-.014em;
  transition:color .24s var(--e)}
.pd-ph .dt{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-dim)}
.pd-ph .ct{font-size:11.5px;font-weight:600}
.pd-ph:not(:disabled){cursor:pointer}
.pd-ph:not(:disabled):hover .nm{color:var(--accent)}
.pd-ph:disabled{cursor:default}

.pd-note{display:flex;align-items:flex-start;gap:11px;padding:12px 13px;border-radius:13px;
  font-size:12.5px;line-height:1.55;color:var(--text-dim)}
.pd-note .ic{display:grid;place-items:center;width:26px;height:26px;border-radius:9px;flex:none}
.pd-note b{color:var(--text);font-weight:650}

.pd-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:1px;padding:1px;
  background:var(--border);border-radius:13px;overflow:hidden}
.pd-mini > div,.pd-mini > button{display:flex;flex-direction:column;gap:4px;padding:10px 12px;text-align:left;
  background:var(--bg-elevated)}
.pd-mini .k{font-size:10px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--text-dim)}
.pd-mini .v{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:15px;font-weight:600;
  letter-spacing:-.02em}
.pd-mini button:hover .v{color:var(--accent)}

/* --- listas del detalle (tareas equipo / cliente) --- */
.pd-list{display:flex;flex-direction:column;gap:1px;padding:1px;background:var(--border);border-radius:14px;overflow:hidden}
.pd-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--card);
  transition:background .24s var(--e)}
.pd-item:hover{background:var(--card-hover)}
.pd-hollow{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:15px 16px;border-radius:14px;
  outline:1px dashed var(--border-strong);outline-offset:-1px;font-size:12.5px;color:var(--text-faint);line-height:1.5}

/* --- rail derecho: registro de actividad --- */
.pd-rail{flex:0 0 34%;min-width:312px;max-width:440px;border-left:1px solid var(--border);
  background:var(--bg-elevated);display:flex;flex-direction:column;height:100%;min-height:0}
.pd-rail-list{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:9px}
.pd-entry{position:relative;padding:11px 12px 11px 15px;border-radius:13px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--border);transition:background .24s var(--e)}
.pd-entry:hover{background:var(--card-hover)}
.pd-entry::before{content:"";position:absolute;left:5px;top:12px;bottom:12px;width:2.5px;border-radius:999px;
  background:var(--green)}
.pd-entry.priv::before{background:var(--accent)}
.pd-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;padding:36px 22px}
.pd-empty .ic{display:grid;place-items:center;width:46px;height:46px;border-radius:15px;margin-bottom:9px;
  color:var(--text-faint);background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.pd-empty .t{font-size:13.5px;font-weight:650;color:var(--text-dim)}
.pd-empty .d{font-size:12.5px;color:var(--text-dim);line-height:1.55;max-width:30ch}

@media (prefers-reduced-motion: reduce){
  .pd-lnk,.pd-btn,.pd-cta,.pd-back,.pd-ph .bar > span{transition:none}
  .pd-lnk:hover .go,.pd-cta:hover i,.pd-lnk:active,.pd-btn:active,.pd-cta:active,.pd-back:active{transform:none}
}

@media (max-width:1080px){
  .pd-shell{flex-direction:column;overflow-y:auto}
  .pd-main{flex:0 0 auto;overflow:visible;padding:18px 20px 24px}
  .pd-rail{flex:0 0 auto;width:100%;max-width:none;min-width:0;height:auto;
    border-left:none;border-top:1px solid var(--border)}
  .pd-rail-list{overflow:visible;min-height:0}
}
@media (max-width:640px){
  .pd-main{padding:14px 13px 22px}
  .pd-console{grid-template-columns:1fr;gap:7px}
  .pd-console .pd-eyebrow{margin-top:2px}
  .pd-phases{grid-template-columns:1fr;gap:14px}
  .pd-lnk,.pd-btn{height:42px}
  .pd-cta{height:44px}
  .pd-cta i{width:32px;height:32px}
}

/* ============================================================================
   SHELL (sidebar + barra superior) + BARRA DE FILTROS — rediseño 2026-08
   Mismo dialecto que el listado y el detalle: superficies con anillo
   (inset box-shadow) en vez de border, una sola curva (--e), y movimiento
   restringido a transform/opacity. Nada de un tercer lenguaje visual.
============================================================================ */

/* --- barra de control del panel Proyectos: todo en una fila --- */
.pj-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px}
/* el buscador es el elástico de la fila: absorbe el espacio libre y se achica
   cuando aparecen chips, así el resto de los controles no salta de línea */
.pj-bar .pj-search{flex:1 1 170px;width:auto;min-width:148px;max-width:300px}
.pj-bar .pj-seg,.pj-bar .pj-switch,.pj-bar .pj-cta{flex:none}

/* segmentado de estado con indicador deslizante (framer-motion layoutId) */
.pj-tabs{position:relative;display:inline-flex;gap:2px;padding:3px;border-radius:12px;flex:none;
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.pj-tabs > button{position:relative;display:inline-flex;align-items:center;height:32px;padding:0 9px;
  border-radius:9px;font-size:12.5px;font-weight:600;color:var(--text-faint);white-space:nowrap;
  transition:color .26s var(--e)}
.pj-tabs > button:hover{color:var(--text-dim)}
.pj-tabs > button[aria-selected="true"]{color:var(--text)}
.pj-tabs .glide{position:absolute;inset:0;border-radius:9px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--border),0 1px 2px rgba(0,0,0,.10)}
.pj-tabs .lb{position:relative;display:inline-flex;align-items:center;gap:7px}
.pj-tabs .n{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;
  color:var(--text-faint);transition:color .26s var(--e)}
.pj-tabs > button[aria-selected="true"] .n{color:var(--accent)}

/* disparador del panel de filtros + chips de lo que está aplicado */
.pj-filt{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 13px;border-radius:999px;flex:none;
  font-size:13px;font-weight:600;color:var(--text-dim);background:var(--bg-elevated);
  box-shadow:inset 0 0 0 1px var(--border);
  transition:color .26s var(--e),background .26s var(--e),box-shadow .26s var(--e)}
.pj-filt:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--border-strong)}
.pj-filt[data-on="1"]{color:var(--text);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-line)}
.pj-filt[data-on="1"] > svg:first-child{color:var(--accent)}
.pj-filt .n{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:10.5px;font-weight:700;
  min-width:17px;height:17px;padding:0 5px;border-radius:999px;display:grid;place-items:center;
  background:var(--accent);color:#fff}
.pj-filt .cd{transition:transform .3s var(--e)}
.pj-filt[aria-expanded="true"] .cd{transform:rotate(180deg)}

.pj-chips{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.pj-chip{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 4px 0 10px;border-radius:999px;
  font-size:12px;font-weight:600;color:var(--text);background:var(--card);max-width:230px;
  box-shadow:inset 0 0 0 1px var(--border)}
.pj-chip .k{color:var(--text-dim);font-weight:600;flex:none}
.pj-chip .v{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.pj-chip > button{display:grid;place-items:center;width:21px;height:21px;border-radius:999px;flex:none;
  color:var(--text-faint);transition:color .22s var(--e),background .22s var(--e),transform .22s var(--e)}
.pj-chip > button:hover{color:var(--red);background:var(--red-soft)}
.pj-chip > button:active{transform:scale(.9)}
.pj-clear{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:999px;flex:none;
  font-size:12px;font-weight:600;color:var(--text-faint);
  transition:color .22s var(--e),background .22s var(--e)}
.pj-clear:hover{color:var(--text);background:var(--card-hover)}

/* panel de filtros */
.pj-popwrap{position:relative;display:inline-flex;flex:none}
.pj-pop{position:absolute;top:calc(100% + 9px);left:0;z-index:120;width:min(520px,calc(100vw - 28px));
  padding:15px;border-radius:18px;background:var(--card);transform-origin:top left;
  box-shadow:inset 0 0 0 1px var(--border),var(--shadow-lift)}
.pj-pop .gr{display:grid;grid-template-columns:1fr 1fr;gap:11px 12px}
.pj-pop .fld{display:flex;flex-direction:column;gap:5px;min-width:0}
.pj-pop .fld > label{font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--text-dim)}
.pj-pop .ft{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}
.pj-pop .ft .hint{font-size:11.5px;color:var(--text-dim)}
.pj-sel.blk{width:100%;max-width:none;height:36px;font-size:13px;color:var(--text)}

/* --- sidebar --- */
.sb{flex:none;display:flex;flex-direction:column;overflow:hidden;
  border-right:1px solid var(--border);background:var(--bg-elevated)}
.sb-brand{display:flex;align-items:center;gap:11px;height:64px;padding:0 16px;flex:none}
.sb-mark{width:32px;height:32px;border-radius:9px;flex:none;display:grid;place-items:center;
  background:var(--accent);color:#fff;font-family:'Bricolage Grotesque',serif;font-weight:800;font-size:17px;
  box-shadow:0 8px 18px -10px var(--accent)}
.sb-wm{min-width:0;overflow:hidden}
.sb-wm b{display:block;font-family:'Bricolage Grotesque',serif;font-weight:700;font-size:15px;line-height:1.05;
  letter-spacing:-.02em}
.sb-wm span{display:block;font-size:9.5px;font-weight:600;letter-spacing:.15em;color:var(--text-faint);margin-top:2px}
.sb-pin{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;flex:none;margin-left:auto;
  color:var(--text-faint);transition:color .24s var(--e),background .24s var(--e)}
.sb-pin:hover{color:var(--text);background:var(--card-hover)}
.sb-pin[data-on="1"]{color:var(--accent);background:var(--accent-soft)}

.sb-nav{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:10px 9px;
  display:flex;flex-direction:column;gap:2px}
.sb-cap{padding:13px 12px 5px;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--text-dim);white-space:nowrap}
.sb-i{position:relative;display:flex;align-items:center;gap:12px;width:100%;height:38px;padding:0 11px;
  border-radius:10px;font-size:13.5px;font-weight:600;color:var(--text-dim);white-space:nowrap;text-align:left;
  transition:color .26s var(--e),background .26s var(--e),box-shadow .26s var(--e)}
.sb-i > svg{flex:none}
.sb-i:hover{color:var(--text);background:var(--card-hover)}
.sb-i[data-on="1"]{color:var(--text);font-weight:700;background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.sb-i[data-on="1"] > svg:first-of-type{color:var(--accent)}
.sb-i .rail{position:absolute;left:-9px;top:9px;bottom:9px;width:3px;border-radius:0 999px 999px 0;
  background:var(--accent)}
.sb-i.mini{justify-content:center;padding:0;gap:0}
.sb-i.mini .rail{left:-9px}
.sb-i .lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.sb-i .cd{flex:none;opacity:.5;transition:transform .28s var(--e)}
.sb-i[aria-expanded="true"] .cd{transform:rotate(90deg)}
.sb-sub{display:flex;flex-direction:column;gap:2px;padding:3px 0 2px 11px;margin-left:20px;
  border-left:1px solid var(--border)}
.sb-sub.mini{margin-left:0;padding-left:0;border-left:none}
.sb-i.sm{height:32px;font-size:13px}

.sb-foot{flex:none;padding:9px;border-top:1px solid var(--border)}
.sb-u{display:flex;align-items:center;gap:10px;width:100%;padding:6px;border-radius:13px;text-align:left;
  transition:background .26s var(--e),box-shadow .26s var(--e)}
.sb-u:hover{background:var(--card-hover);box-shadow:inset 0 0 0 1px var(--border)}
.sb-u .tx{min-width:0;flex:1;overflow:hidden}
.sb-u .nm{font-size:13px;font-weight:650;letter-spacing:-.012em;color:var(--text);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-u .rl{font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.sb-u > svg:last-child{flex:none;color:var(--text-faint);opacity:.6}

/* --- barra superior --- */
.hd{height:64px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:0 20px;background:var(--bg-elevated);border-bottom:1px solid var(--border)}
.hd-crumb{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px;color:var(--text-dim)}
.hd-crumb .rt{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:-.01em;
  transition:color .24s var(--e)}
.hd-crumb .rt:hover{color:var(--text-dim)}
.hd-crumb strong{color:var(--text);font-size:14px;font-weight:650;letter-spacing:-.016em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hd-right{display:flex;align-items:center;gap:8px;flex:none}
/* dos grupos: lo que informa del SISTEMA (sync, versión) y lo que es del USUARIO */
.hd-grp{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:999px;
  background:var(--bg);box-shadow:inset 0 0 0 1px var(--border)}
.hd-sys{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 11px;border-radius:999px;
  font-size:12px;color:var(--text-dim);white-space:nowrap}
.hd-sys .dot{width:6px;height:6px;border-radius:50%;flex:none}
.hd-ver{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:999px;
  font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;font-weight:600;
  color:var(--text-dim);transition:color .24s var(--e),background .24s var(--e)}
.hd-ver:hover{color:var(--text);background:var(--card-hover)}
.hd-ver[data-new="1"]{padding:0 12px;font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:700;
  color:#fff;background:var(--accent);box-shadow:0 8px 18px -11px var(--accent)}
.hd-ver[data-new="1"]:hover{filter:brightness(1.08);color:#fff;background:var(--accent)}
.hd-ib{position:relative;display:grid;place-items:center;width:32px;height:32px;border-radius:999px;flex:none;
  color:var(--text-dim);
  transition:color .24s var(--e),background .24s var(--e),transform .24s var(--e)}
.hd-ib:hover{color:var(--text);background:var(--card-hover)}
.hd-ib:active{transform:scale(.92)}
.hd-ib.danger:hover{color:var(--red);background:var(--red-soft)}
/* el toggle de tema no puede saltar al cambiar de icono: la caja es fija y el
   sol/luna rota dentro de ella */
.hd-theme > span{display:grid;place-items:center;width:16px;height:16px}
.hd-lbl{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:999px;
  font-size:12.5px;font-weight:600;color:var(--text-dim);
  transition:color .24s var(--e),background .24s var(--e)}
.hd-lbl:hover{color:var(--text);background:var(--card-hover)}
.hd-badge{position:absolute;top:1px;right:1px;min-width:15px;height:15px;padding:0 3px;border-radius:999px;
  display:grid;place-items:center;font-size:9.5px;font-weight:700;color:#fff;
  box-shadow:0 0 0 2px var(--bg-elevated)}

@media (prefers-reduced-motion: reduce){
  .sb-i,.sb-u,.hd-ib,.hd-ver,.pj-filt,.pj-chip > button,.pj-tabs > button{transition:none}
  .hd-ib:active,.pj-chip > button:active{transform:none}
  .sb-i .cd,.pj-filt .cd{transition:none}
}

@media (max-width: 980px){
  .pj-bar .sp{display:none}
  .pj-search{width:200px}
}
@media (max-width: 760px){
  .pj-bar{gap:8px}
  /* los cuatro estados siguen siendo un segmentado, pero desplazable: en 375px
     no entran los cuatro y partirlos en dos líneas rompe la metáfora */
  .pj-tabs{width:100%;overflow-x:auto;scrollbar-width:none}
  .pj-tabs::-webkit-scrollbar{display:none}
  .pj-tabs > button{flex:1 0 auto;justify-content:center;height:38px}
  .pj-popwrap{flex:1 1 140px}
  .pj-filt{width:100%;height:42px;justify-content:center}
  .pj-bar .pj-search{flex:1 1 100%;max-width:none;height:42px}
  .pj-bar .pj-switch{flex:1 0 auto;min-height:42px}
  .pj-bar .pj-cta{flex:1 0 auto;justify-content:center}
  .pj-pop{left:auto;right:0;transform-origin:top right}
  .pj-pop .gr{grid-template-columns:1fr}
  .pj-sel.blk{height:42px}
  .hd{padding:0 12px}
  .hd-grp.sys{display:none}
  .hd-lbl span{display:none}
  .hd-lbl{padding:0;width:32px;justify-content:center}
}
`

/* ============================================================================
   3 · UTILITIES
============================================================================ */
/* Ahora, evaluado en CADA llamada. Antes era `const NOW = new Date()` a nivel de
   módulo: en una pestaña abierta toda la noche quedaba congelado en el momento de
   la carga, "Último avance" nunca envejecía y el umbral de 7 días no disparaba. */
const NOW = () => new Date()
const daysAgo = (iso) => {
  if (!iso) return null
  return Math.max(0, Math.round((NOW() - new Date(iso)) / 86400000))
}
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
/* Moneda explícita: los clientes son de EE.UU. y de Argentina, y "$250" es
   ambiguo. Mismo formato que el mail de aviso de cobro (maintenanceNotice.js). */
const money = (n) => 'USD ' + Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
/* progressColorVar() devuelve el NOMBRE de la variable ('--green'), no el var(…).
   Un solo helper de color de avance: antes convivía `pctColor` con los mismos cortes. */
const progressColor = (p) => `var(${progressColorVar(p)})`
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
/* detecta viewport de celular (para menú hamburguesa, grid 1 por fila, etc.).
   Usa outerWidth (tamaño físico de la ventana) en vez de innerWidth/matchMedia:
   el zoom del navegador reduce el ancho CSS sin achicar la ventana, y no
   queremos que hacer zoom colapse el sidebar a modo mobile. */
function useIsMobile(bp = 760) {
  const physicalWidth = () =>
    typeof window === 'undefined' ? 0 : window.outerWidth || window.innerWidth
  const [m, setM] = useState(() => typeof window !== 'undefined' && physicalWidth() <= bp)
  useEffect(() => {
    const on = () => setM(physicalWidth() <= bp)
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [bp])
  return m
}

const hexA = (hex, a) => { const h = (hex || '').replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})` }

/* ============================================================================
   4 · SEED DATA — 5 proyectos reales de Insights Software
============================================================================ */
function seedClients() {
  return [
    { id: 'c1', name: 'Amberlee Bauman', company: 'Davis Chamber of Commerce', email: 'amberlee@davischamber.com', phone: '+1 530 756 5160', onboarding: { businessDescription: 'Cámara de comercio regional que nuclea +650 negocios del condado de Yolo, California.', goals: 'Centralizar la gestión de miembros, eventos y cobros en una sola plataforma (Chamber OS).', existingTech: 'WordPress legacy + GrowthZone CRM + Mailchimp', approvedBudget: 38000, notes: 'Decisión por comité, requiere demo mensual al board.' } },
    { id: 'c2', name: 'Miguel Hidalgo', company: 'Alianzas Sabias / Vida Sabia', email: 'miguel@vidasabia.mx', phone: '+52 55 8421 0099', onboarding: { businessDescription: 'Red de afiliados de productos de bienestar y suplementos en LatAm.', goals: 'Plataforma de afiliados con tracking de comisiones multinivel y pagos automáticos.', existingTech: 'Shopify + planillas + Stripe', approvedBudget: 52000, notes: 'Escala rápido, prioriza time-to-market sobre prolijidad inicial.' } },
    { id: 'c3', name: 'Gregorio Neumayer', company: 'Green Roofing', email: 'greg@greenroofing.de', phone: '+49 30 9024 5512', onboarding: { businessDescription: 'Empresa de techos verdes y sostenibles en Berlín.', goals: 'Configurador 3D interactivo para que clientes diseñen su techo y reciban presupuesto.', existingTech: 'Sitio estático + Three.js POC interno', approvedBudget: 41000, notes: 'Muy detallista con el render; pidió WebGL performante en mobile.' } },
    { id: 'c4', name: 'Nelson Rodriguez', company: 'HiddenWire Security Group', email: 'nelson@hiddenwire.io', phone: '+1 305 720 1188', onboarding: { businessDescription: 'Integrador de seguridad física y cableado estructurado para corporativos.', goals: 'Portal de clientes con tickets, monitoreo de instalaciones y reportes SLA.', existingTech: 'Zoho Desk + Excel', approvedBudget: 47000, notes: 'Necesita roles granulares y auditoría (compliance).' } },
    { id: 'c5', name: 'Juan Pablo Obando', company: 'Shockwave Tennis Academy', email: 'jp@shockwavetennis.com', phone: '+57 310 555 8842', onboarding: { businessDescription: 'Academia de tenis de alto rendimiento con sedes en Bogotá y Medellín.', goals: 'Plataforma de reservas de canchas, gestión de alumnos, pagos y seguimiento de progreso.', existingTech: 'Calendly + WhatsApp + efectivo', approvedBudget: 44000, notes: 'Quiere app para coaches y panel para padres.' } },
    { id: 'c6', name: 'Leonardo', company: 'iRowing', email: 'leonardo@irowing.app', phone: '+54 11 5555 0106', onboarding: { businessDescription: 'Ex remero de la selección argentina (15+ años). Coach de remo indoor con máquinas Concept2.', goals: 'App de análisis de rendimiento con datos de la API Concept2 y visualización motivacional tipo bolsa.', existingTech: 'Google Sheets manual', approvedBudget: 0, notes: 'Foco motivacional para gente común que empieza a remar.' } },
    { id: 'c7', name: 'Mariano Sabbadin', company: 'Real Deal Exchange AI', email: 'mariano@realdealexchange.ai', phone: '+1 470 555 0107', onboarding: { businessDescription: 'Ecosistema PropTech de oportunidades inmobiliarias en EE.UU. (creative finance, Subject-To, Seller Finance).', goals: 'CRM + agentes IA + marketplace multi-tenant para captura, scoring y comunicaciones.', existingTech: 'Planillas + APIs externas de data inmobiliaria', approvedBudget: 15000, notes: 'Contacto clave: Jossueth Irigoyen. Escalable a Georgia, Texas y otros estados.' } },
    { id: 'c8', name: 'José Anaya', company: 'MCS Cleaning Marketplace', email: 'jose@mcscleaning.com', phone: '+1 305 555 0108', onboarding: { businessDescription: 'Marketplace de servicios de limpieza del hogar en EE.UU. con trabajadores independientes ("asociados").', goals: 'Plataforma para cotizar/contratar online, gestión de asociados por zona y control de comisiones.', existingTech: 'Operación manual', approvedBudget: 0, notes: 'Lleva 15 años con la idea. Cobro automático Stripe con split de comisión.' } },
    { id: 'c9', name: 'Marco', company: 'Kintsugi Roadside', email: 'marco@kintsugiroadside.com', phone: '+1 786 555 0109', onboarding: { businessDescription: 'Servicio de emergencias automotrices que conecta clientes con técnicos en campo.', goals: 'Plataforma estilo Uber para emergencias: solicitud, asignación, tracking GPS, cobro Zelle.', existingTech: 'Sin sistema centralizado', approvedBudget: 8000, notes: 'Incluye landing premium, apps cliente/técnico, panel admin y B2B/flotas.' } },
    { id: 'c10', name: 'Agustín', company: 'MMD Jewelry', email: 'agustin@mmdjewelry.com', phone: '+54 11 5555 0110', onboarding: { businessDescription: 'Joyería con ~50 piezas para vender internacionalmente, hoy gestionadas en Excel.', goals: 'Sitio e-commerce headless de diseño editorial (Next.js) conectado a Shopify.', existingTech: 'Excel', approvedBudget: 0, notes: 'Estética tipo Concio Studio. Paleta: blanco roto, dorado arena, rosa palo, vino suave, verde salvia.' } },
  ]
}

/* team members — rol NO fijo (se define por proyecto en assignments) */
/* miembros dados de baja (se eliminan del equipo aunque estén guardados en la data) */
const REMOVED_MEMBER_IDS = ['u4']   // Nicolas Arditi
/* email de login (Supabase) por miembro — para auto-vincular al iniciar sesión sin duplicar */
const SEED_EMAILS = { u1: 'federicog@insightsapps.tech', u2: 'lisandropiva@insightsapps.tech', u3: 'manuelnavarro@insightsapps.tech', u5: 'juanp@insightsapps.tech', u7: 'nachocachaza@insightsapps.tech' }
/* rango de cada miembro: 'pm' | 'dev' | '' (vacío = Otro, ej. CEO o Closer) — determina en qué filtro de Proyectos aparece */
const SEED_ROLES = { u1: '', u2: 'dev', u3: 'dev', u5: '', u6: 'dev', u7: 'pm' }
const TEAM_ROLES = [{ key: '', label: 'Otro' }, { key: 'pm', label: 'PM' }, { key: 'dev', label: 'Dev' }]
function seedTeam() {
  return [
    { id: 'u1', name: 'Federico Garbarino', email: SEED_EMAILS.u1, color: '#F97316', initials: 'FG', role: SEED_ROLES.u1 },
    { id: 'u2', name: 'Lisandro', email: SEED_EMAILS.u2, color: '#6366F1', initials: 'L', role: SEED_ROLES.u2 },
    { id: 'u3', name: 'Manuel Navarro', email: SEED_EMAILS.u3, color: '#10B981', initials: 'MN', role: SEED_ROLES.u3 },
    { id: 'u5', name: 'Juan Pamies', email: SEED_EMAILS.u5, color: '#38BDF8', initials: 'JP', role: SEED_ROLES.u5 },
    { id: 'u6', name: 'Valentin Toledo', color: '#A855F7', initials: 'VT', role: SEED_ROLES.u6 },
    { id: 'u7', name: 'Nacho Cachaza', email: SEED_EMAILS.u7, color: '#F43F5E', initials: 'NC', role: SEED_ROLES.u7 },
  ]
}
/* default demo assignments for the original 5 projects (rol por proyecto) */
const DEMO_ASSIGN = {
  p1: { pm: { userId: 'u1', roleLabel: 'Project Manager' }, dev: { userId: 'u3', roleLabel: 'Developer' } },
  p2: { pm: { userId: 'u2', roleLabel: 'Project Manager' }, dev: { userId: 'u6', roleLabel: 'Developer' } },
  p3: { pm: { userId: 'u1', roleLabel: 'Project Manager' }, dev: { userId: 'u5', roleLabel: 'Developer' } },
  p4: { pm: { userId: 'u6', roleLabel: 'Project Manager' }, dev: { userId: 'u3', roleLabel: 'Developer' } },
  p5: { pm: { userId: 'u1', roleLabel: 'Project Manager' }, dev: { userId: 'u1', roleLabel: 'Lead Dev' } },
}
const TAG_NEW = () => ({ id: uid(), text: 'New', color: '#22C55E' })
const TAG_NEXT = () => ({ id: uid(), text: 'Next', color: '#3B82F6' })

function seedProjects() {
  return [
    {
      id: 'p1', clientId: 'c1', name: 'Chamber OS', status: 'active',
      productionUrl: 'https://app.davischamber.com', devUrl: 'https://dev.chamberos.insights.dev',
      githubRepo: 'insights-software/chamber-os', stack: 'Next.js',
      kickoff: 'Chamber OS reemplaza el stack legacy de la Davis Chamber of Commerce (WordPress + GrowthZone) por una plataforma unificada de gestión de membresías, eventos, facturación y comunicaciones. Fase 1: directorio de miembros + portal de auto-gestión. Fase 2: eventos y ticketing. Fase 3: billing recurrente y reportes para el board.',
      paidAmount: 11400, totalAmount: 38000, progress: 28,
      lastDeployDate: '2026-06-03',
      pendingAgency: [
        { id: uid(), title: 'Migrar 650 registros de GrowthZone', priority: 'alta', description: 'Script de import + dedupe de la base legacy.' },
        { id: uid(), title: 'Optimizar búsqueda del directorio', priority: 'media', description: 'Indexar con Postgres full-text search.' },
      ],
      pendingClient: [
        { id: uid(), title: 'Aprobar copy del portal público', priority: 'alta', description: 'El board debe firmar los textos legales.' },
        { id: uid(), title: 'Entregar accesos a Stripe', priority: 'media', description: 'Necesitamos las API keys de la cuenta de la cámara.' },
      ],
      risks: [
        { id: uid(), description: 'La migración de datos legacy tiene inconsistencias de formato', severity: 'alta' },
        { id: uid(), description: 'Aprobaciones por comité ralentizan los sign-off', severity: 'media' },
      ],
      chats: [],
    },
    {
      id: 'p2', clientId: 'c2', name: 'Plataforma de Afiliados', status: 'active',
      productionUrl: 'https://app.alianzassabias.com', devUrl: 'https://staging.alianzassabias.com',
      githubRepo: 'insights-software/alianzas-afiliados', stack: 'Remix + Stripe Connect',
      kickoff: 'Plataforma de afiliados multinivel para Alianzas Sabias (Vida Sabia). Tracking de referidos en árbol, cálculo de comisiones por nivel, payouts automáticos vía Stripe Connect y panel para cada afiliado con su downline, ventas y comisiones acumuladas.',
      paidAmount: 33800, totalAmount: 52000, progress: 65,
      lastDeployDate: '2026-06-09',
      pendingAgency: [
        { id: uid(), title: 'Cerrar conciliación de payouts', priority: 'alta', description: 'Edge case con comisiones de devoluciones parciales.' },
      ],
      pendingClient: [
        { id: uid(), title: 'Definir reglas de niveles (4 vs 5)', priority: 'alta', description: 'Pendiente decisión comercial sobre profundidad del árbol.' },
        { id: uid(), title: 'Validar términos legales de payouts', priority: 'media', description: 'Revisión con su abogado en México.' },
      ],
      risks: [
        { id: uid(), description: 'Compliance de pagos cross-border (MX/US)', severity: 'alta' },
        { id: uid(), description: 'Escalabilidad del árbol con +10k afiliados', severity: 'media' },
      ],
      chats: [],
    },
    {
      id: 'p3', clientId: 'c3', name: 'Green Roofing 3D', status: 'active',
      productionUrl: 'https://neumayer-3d.vercel.app', devUrl: 'https://dev-neumayer-3d.vercel.app',
      githubRepo: 'insights-software/green-roofing-3d', stack: 'React + Three.js',
      kickoff: 'Configurador 3D para Green Roofing: el cliente final diseña su techo verde en el navegador (dimensiones, tipo de vegetación, drenaje, accesos) con render WebGL en tiempo real, y recibe un presupuesto automático + PDF técnico. Foco en performance mobile y fidelidad visual del render.',
      paidAmount: 17220, totalAmount: 41000, progress: 42,
      lastDeployDate: '2026-05-28',
      pendingAgency: [
        { id: uid(), title: 'Optimizar draw calls en mobile', priority: 'alta', description: 'Instancing de la vegetación para mantener 60fps.' },
        { id: uid(), title: 'LOD para texturas pesadas', priority: 'media', description: 'Cargar texturas progresivas según zoom.' },
      ],
      pendingClient: [
        { id: uid(), title: 'Entregar catálogo de precios 2026', priority: 'alta', description: 'Tabla de costos por m² y tipo de vegetación.' },
      ],
      risks: [
        { id: uid(), description: 'Performance WebGL en gama baja de Android', severity: 'alta' },
        { id: uid(), description: 'Modelos 3D pesados aún sin optimizar', severity: 'media' },
      ],
      chats: [],
    },
    {
      id: 'p4', clientId: 'c4', name: 'HiddenWire Client Portal', status: 'active',
      productionUrl: 'https://hiddenware.onrender.com', devUrl: 'https://dev-hiddenware.onrender.com',
      githubRepo: 'insights-software/hiddenwire-portal', stack: 'Django + React',
      kickoff: 'Portal de clientes para HiddenWire Security Group: gestión de tickets de soporte, monitoreo de instalaciones de seguridad, reportes de SLA y auditoría. Roles granulares (cliente, técnico, admin, auditor) y trazabilidad completa para compliance.',
      paidAmount: 25850, totalAmount: 47000, progress: 55,
      lastDeployDate: '2026-05-30',
      pendingAgency: [
        { id: uid(), title: 'Cerrar notificaciones por email', priority: 'media', description: 'Templates + cola de envío con reintentos.' },
        { id: uid(), title: 'Integrar feed de dispositivos IoT', priority: 'alta', description: 'Webhook desde el sistema de monitoreo físico.' },
      ],
      pendingClient: [
        { id: uid(), title: 'Acceso al API de monitoreo', priority: 'alta', description: 'Credenciales del sistema de cámaras/sensores.' },
        { id: uid(), title: 'Definir matriz de SLA', priority: 'media', description: 'Tiempos de respuesta por tipo de cliente.' },
      ],
      risks: [
        { id: uid(), description: 'Requisitos de compliance aún no formalizados', severity: 'media' },
        { id: uid(), description: 'Dependencia de API externa de monitoreo', severity: 'alta' },
      ],
      chats: [],
    },
    {
      id: 'p5', clientId: 'c5', name: 'Shockwave Tennis Academy', status: 'active',
      productionUrl: 'https://shockwave-tennis.onrender.com', devUrl: 'https://dev-shockwave.onrender.com',
      githubRepo: 'insights-software/shockwave-tennis', stack: 'React + Node + Postgres',
      kickoff: 'Plataforma integral para Shockwave Tennis Academy: reservas de canchas, gestión de alumnos y coaches, cobros (mensualidades y clases sueltas), y seguimiento de progreso deportivo. Incluye app para coaches y panel para padres con el avance de cada alumno.',
      paidAmount: 28600, totalAmount: 44000, progress: 65,
      lastDeployDate: '2026-06-10',
      pendingAgency: [
        { id: uid(), title: 'Terminar flujo de clases sueltas', priority: 'alta', description: 'Pago drop-in con confirmación instantánea.' },
        { id: uid(), title: 'Recordatorios automáticos de cobro', priority: 'media', description: 'Cron + WhatsApp/email para mensualidades vencidas.' },
      ],
      pendingClient: [
        { id: uid(), title: 'Definir métricas de evaluación', priority: 'alta', description: 'Qué se mide por alumno (saque, derecha, etc.).' },
        { id: uid(), title: 'Logos y branding de sedes', priority: 'baja', description: 'Assets de Bogotá y Medellín.' },
      ],
      risks: [
        { id: uid(), description: 'Adopción de la app por parte de coaches', severity: 'media' },
        { id: uid(), description: 'Cobros en efectivo legacy difíciles de migrar', severity: 'baja' },
      ],
      chats: [],
    },
    {
      id: 'p6', clientId: 'c6', name: 'iRowing', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: 'insights-software/irowing', stack: 'React Native · Node.js · OAuth 2.0 Concept2',
      kickoff: 'App de análisis de rendimiento para atletas de remo indoor con máquinas Concept2. El cliente es Leonardo, ex remero de la selección argentina con 15+ años entrenando, que hoy gestiona todo en Google Sheets manualmente. La app descarga los datos de cada remada vía OAuth 2.0 a la API de Concept2, los analiza y los presenta con visualización tipo bolsa de valores (verde/rojo según mejora o baja). Foco motivacional para gente común que empieza a remar. Incluye app móvil para el atleta + dashboard web admin para Leonardo como coach. Soporte post-lanzamiento: 30 días.',
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: '2026-06-09',
      tags: [TAG_NEW()],
      pendingAgency: [{ id: uid(), title: 'Registrar app developer en Concept2', priority: 'alta', description: 'Credenciales OAuth 2.0 para el entorno de producción.' }],
      pendingClient: [{ id: uid(), title: 'Definir precio total del proyecto', priority: 'alta', description: 'Cerrar alcance y presupuesto con Leonardo.' }, { id: uid(), title: 'Exportar histórico de Google Sheets', priority: 'media', description: 'Para migrar datos iniciales de atletas.' }],
      risks: [{ id: uid(), description: 'Rate limits / disponibilidad de la API Concept2', severity: 'media' }],
      chats: [],
    },
    {
      id: 'p7', clientId: 'c8', name: 'MCS Cleaning Marketplace', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: 'insights-software/mcs-cleaning', stack: 'React Native · Node.js · Stripe · Geolocalización',
      kickoff: 'App marketplace de servicios de limpieza del hogar para conectar clientes con trabajadores independientes ("asociados") en EE.UU. José lleva 15 años con esta idea y hoy opera de forma manual. La plataforma permite cotizar/contratar servicios online, los asociados gestionan trabajos en su zona y José controla comisiones y métricas. Incluye calculadora de precios dinámica por tipo de servicio y cobro automático con Stripe (split de comisión). Soporte post-lanzamiento: 30 días.',
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: '2026-06-08',
      tags: [TAG_NEW()],
      pendingAgency: [{ id: uid(), title: 'Cuenta Stripe Connect', priority: 'alta', description: 'Para split de comisión entre plataforma y asociados.' }],
      pendingClient: [{ id: uid(), title: 'Definir precio total del proyecto', priority: 'alta', description: 'Cerrar alcance y presupuesto con José.' }, { id: uid(), title: 'Tabla de precios por servicio', priority: 'media', description: 'Insumo para la calculadora dinámica.' }],
      risks: [{ id: uid(), description: 'Compliance de pagos a contratistas en EE.UU.', severity: 'media' }],
      chats: [],
    },
    {
      id: 'p8', clientId: 'c7', name: 'Real Deal Exchange AI', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: 'insights-software/real-deal-exchange', stack: 'Next.js · TypeScript · Supabase/PostgreSQL · Twilio · Vercel',
      kickoff: 'Ecosistema PropTech para captura, procesamiento, scoring, CRM, comunicaciones y marketplace de oportunidades inmobiliarias en EE.UU. Contacto clave: Jossueth Irigoyen (creative finance, Subject-To, Seller Finance). Importa ~3.000–3.500 registros cada 10–15 días, los enriquece vía APIs, los puntúa con lógica de scoring propia, genera propuestas preliminares con agentes IA y un Human Review Gate. CRM interno con trazabilidad completa y arquitectura multi-tenant lista para escalar a Georgia, Texas y otros estados. Estructura de pago 40/30/30 sobre USD 15.000 + soporte USD 5.000 (3 meses). Plazo: 90 días.',
      paidAmount: 0, totalAmount: 15000, progress: 0, lastDeployDate: '2026-06-07',
      tags: [TAG_NEW()],
      pendingAgency: [{ id: uid(), title: 'Definir lógica de scoring', priority: 'alta', description: 'Reglas de puntuación de oportunidades con Jossueth.' }],
      pendingClient: [{ id: uid(), title: 'Accesos a APIs de enriquecimiento', priority: 'alta', description: 'Credenciales de las fuentes de data inmobiliaria.' }, { id: uid(), title: 'Cuenta Twilio', priority: 'media', description: 'Para SMS/WhatsApp de comunicaciones.' }],
      risks: [{ id: uid(), description: 'Volumen de importación (3k–3.5k cada 10–15 días) y costo de APIs', severity: 'alta' }, { id: uid(), description: 'Complejidad multi-tenant para escalar a otros estados', severity: 'media' }],
      chats: [],
    },
    {
      id: 'p9', clientId: 'c9', name: 'Kintsugi Roadside', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: 'insights-software/kintsugi-roadside', stack: 'Next.js · Node.js · Supabase · GPS nativo · Zelle · Vercel',
      kickoff: 'Plataforma integral de emergencias automotrices para conectar clientes con técnicos en campo. Reemplaza una operación sin sistema centralizado. Los clientes solicitan emergencias desde la app, los técnicos reciben y gestionan órdenes como Uber, y Marco controla asignaciones, pagos y métricas. Incluye tracking GPS en tiempo real, asignación manual, cierre de orden con firma digital y fotos antes/después, landing web premium, apps iOS + Android para clientes y técnicos, panel admin, panel cliente B2B/flotas, panel técnico, integración Zelle e IA conversacional. Estructura de pago 50/25/25 sobre USD 8.000. Plazo: 4–5 semanas.',
      paidAmount: 0, totalAmount: 8000, progress: 0, lastDeployDate: '2026-06-09',
      tags: [TAG_NEW()],
      pendingAgency: [{ id: uid(), title: 'Definir flujo de asignación manual', priority: 'media', description: 'Reglas de despacho de técnicos por zona.' }],
      pendingClient: [{ id: uid(), title: 'Datos de cuenta Zelle', priority: 'alta', description: 'Para configurar el cobro a clientes.' }, { id: uid(), title: 'Listado de técnicos iniciales', priority: 'media', description: 'Para onboarding del panel técnico.' }],
      risks: [{ id: uid(), description: 'Precisión del GPS nativo en campo', severity: 'media' }],
      chats: [],
    },
    {
      id: 'p10', clientId: 'c10', name: 'MMD Jewelry', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: 'insights-software/mmd-jewelry', stack: 'Next.js · GSAP · Shopify Storefront API · Tidio',
      kickoff: 'Sitio web e-commerce de joyería con frontend personalizado de diseño editorial conectado a Shopify como backend. Replica una estética tipo Concio Studio: apertura cinematográfica con video, navegación minimalista, about inline, galería con scroll horizontal, tienda con grid infinito y filtros por tipo de joya. La clienta tiene ~50 joyas para vender internacionalmente y hoy maneja todo en Excel. Paleta: blanco roto, dorado arena, rosa palo, vino suave, verde salvia. Plazo: 2–3 semanas.',
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: '2026-06-10',
      tags: [TAG_NEW()],
      pendingAgency: [{ id: uid(), title: 'Definir grilla de galería y transiciones', priority: 'media', description: 'Choreography GSAP de la home y galería.' }],
      pendingClient: [{ id: uid(), title: 'Nombre oficial de marca, dominio y cuenta Shopify', priority: 'alta', description: 'Datos base para arrancar el setup.' }, { id: uid(), title: 'Fotos de productos y logo/firma', priority: 'alta', description: 'Assets de las ~50 joyas + branding.' }, { id: uid(), title: 'Plataforma de chat y moneda principal', priority: 'media', description: 'Confirmar Tidio/WhatsApp y moneda de venta.' }],
      risks: [{ id: uid(), description: 'Definiciones de marca pendientes pueden frenar el arranque', severity: 'media' }],
      chats: [],
    },
    {
      id: 'p11', clientId: 'c4', name: 'HiddenWare App', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: '', stack: 'Por definir',
      kickoff: 'Proyecto planificado para el próximo mes — aún no iniciado. Tenerlo en cuenta para el arranque del próximo ciclo de cartera.',
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: null,
      tags: [TAG_NEXT()],
      pendingAgency: [], pendingClient: [], risks: [], chats: [],
    },
  ].map((p) => ({ ...p, assignments: p.assignments || DEMO_ASSIGN[p.id] || { pm: null, dev: null }, tags: p.tags || [] }))
}

function seedCalls() {
  return [
    { id: uid(), clientId: 'c5', projectId: 'p5', advisor: 'Federico Garbarino', date: '2026-06-09', summary: 'Revisión del flujo de pagos. JP confirmó que las mensualidades funcionan bien pero quiere que las clases sueltas permitan pago en el momento desde la app del coach.', fathomUrl: 'https://fathom.video/share/shockwave-0609', transcript: '[00:00] Fede: Hola JP, gracias por el tiempo. Quería repasar el módulo de pagos.\n[00:14] JP: Buenísimo. Las mensualidades ya las estamos usando con 30 alumnos y va perfecto.\n[01:02] Fede: Excelente. Lo que falta cerrar son las clases sueltas.\n[01:20] JP: Sí, eso es clave. El coach a veces toma un alumno nuevo en el momento y necesita cobrarle ahí mismo.\n[02:45] Fede: Lo dejamos para este sprint. ¿Algo de las métricas de progreso?\n[03:10] JP: Lo definimos la semana que viene con los coaches.' },
    { id: uid(), clientId: 'c2', projectId: 'p2', advisor: 'Federico Garbarino', date: '2026-06-05', summary: 'Miguel pide acelerar payouts automáticos antes del cierre de mes. Discutimos el edge case de comisiones sobre devoluciones parciales.', fathomUrl: 'https://fathom.video/share/alianzas-0605', transcript: '[00:00] Miguel: Necesito que los payouts salgan automáticos antes de fin de mes, los afiliados están preguntando.\n[00:30] Fede: Está casi listo, el tema es qué pasa con una comisión cuando hay una devolución parcial.\n[01:15] Miguel: Buena pregunta. Si devuelven la mitad, la comisión se ajusta a la mitad.\n[02:00] Fede: Perfecto, lo implemento así. Te muestro en staging el jueves.' },
    { id: uid(), clientId: 'c1', projectId: 'p1', advisor: 'Lucía Méndez', date: '2026-05-30', summary: 'Onboarding del board de la Chamber. Amberlee transmitió que el comité necesita aprobar los textos legales del portal público antes del lanzamiento.', fathomUrl: 'https://fathom.video/share/chamber-0530', transcript: '[00:00] Amberlee: The board loved the directory demo.\n[00:25] Lucía: Great! We need sign-off on the public profile copy.\n[01:10] Amberlee: I will bring it to the committee next week.\n[02:30] Lucía: We also need the Stripe keys to start on billing.' },
    { id: uid(), clientId: 'c4', projectId: 'p4', advisor: 'Federico Garbarino', date: '2026-05-26', summary: 'Nelson necesita que el portal se integre con su sistema de monitoreo físico. Falta que entregue las credenciales del API.', fathomUrl: 'https://fathom.video/share/hiddenwire-0526', transcript: '[00:00] Nelson: The portal looks solid. My team needs the live device monitoring tab.\n[00:40] Fede: We are ready, we just need API access to your monitoring system.\n[01:30] Nelson: I will get you the credentials this week.\n[02:10] Fede: Perfect, once we have those we wire up the alerts.' },
    { id: uid(), clientId: 'c3', projectId: 'p3', advisor: 'Lucía Méndez', date: '2026-05-22', summary: 'Gregorio revisó el configurador 3D en su celular y reportó caídas de FPS. Acordamos optimizar antes de avanzar con pricing.', fathomUrl: 'https://fathom.video/share/greenroofing-0522', transcript: '[00:00] Gregorio: The 3D looks beautiful on desktop but my phone struggles.\n[00:35] Lucía: We will optimize draw calls with instancing.\n[01:20] Gregorio: Good. Also I will send the 2026 pricing catalog.\n[02:05] Lucía: Perfect, we need that for the budget engine.' },
  ]
}

function seedTasks() {
  return [
    { id: uid(), name: 'Preparar demo para el board de Chamber', assigneeId: 'u1', priority: 'urgente', status: 'en proceso', notes: 'Mostrar el directorio de miembros y el flujo de búsqueda. Tener datos cargados de ejemplo.', comments: [] },
    { id: uid(), name: 'Optimizar render 3D en mobile (Green Roofing)', assigneeId: 'u3', priority: 'normal', status: 'pendiente', notes: 'Usar instancing para la vegetación. Objetivo 60fps en gama media de Android.', comments: [] },
    { id: uid(), name: 'Cerrar pago drop-in de clases sueltas (Shockwave)', assigneeId: 'u5', priority: 'bajo', status: 'pendiente', notes: '', comments: [] },
  ]
}

/* SOPs (procesos documentados) — categorías tipo carpeta + procesos.
   Para agregar un SOP desde el código: sumá una entrada acá (id único) y migrate lo mergea. */
const SOP_ONBOARDING_CALL = `# Proceso de kick off
### Llamada inicial con cliente post-pago

## Descripción general
**Duración:** 20 a 30 minutos
**Objetivo:** validar que el cliente entiende exactamente qué se va a hacer, confirmar el alcance del proyecto, identificar dudas y solicitudes extras, y establecer la cadencia de comunicación y avances.
**Participantes:** Cliente + Nacho (Dev Lead) + quien lleva la relación

---

## Paso a paso detallado

### Paso 1 · Bienvenida & rapport (1-2 min)
- Saludar de forma cálida y genuina
- "Hola [Nombre], ¿cómo estás? ¿Todo bien?"
- Presentarse brevemente si no se conocen

### Paso 2 · Preguntar sobre motivación (2-3 min)
Preguntas clave:
- "¿Qué fue lo que te llevó a decidir trabajar con nosotros?"
- "¿Por qué decidiste hacer esta app ahora?"
- "¿Qué es lo que esperás lograr con esto?"

**IMPORTANTE:** esta información es oro para marketing. Anotar la respuesta exacta del cliente porque después la usamos en anuncios y testimonios.

### Paso 3 · Explicar el propósito de la llamada (30-45 seg)
"La idea de esta llamada es bien simple: en unos 20-30 minutos vamos a repasar exactamente qué vamos a hacer, verificar que estemos en el camino correcto, aclarar cualquier duda que tengas, y presentarte cómo vamos a comunicarnos durante el proyecto. Lo más importante es que confirmes que todo está OK para comenzar con el pie derecho."

### Paso 4 · Scope review — screen share (10-15 min)
**Responsable:** Nacho (Dev Lead)

Qué mostrar y explicar:
- Documento o presentación del proyecto
- Cada módulo que se va a desarrollar (explicar brevemente qué hace)
- Semanas de entrega (indicar cuándo termina cada fase)
- Stack tecnológico (si es relevante para el cliente)

Al final de la explicación: "¿Está todo OK? ¿Es exactamente lo que esperabas?"
**✓ ESPERAR CONFIRMACIÓN DEL CLIENTE — esto es crítico.**

### Paso 5 · Capturar dudas y solicitudes extras (3-5 min)
"¿Hay algo que no haya quedado claro o que querés que cambiemos?"

Cómo proceder:
- **Dudas:** responder directamente en la llamada si es simple. Si requiere análisis, anotar para responder después.
- **Solicitudes extras:** no agregarlas al alcance. Anotar y decir: "Bueno, eso es un extra que requiere trabajo adicional. Lo vamos a presupuestar por separado y lo charlás con nosotros si querés incluirlo."

### Paso 6 · Explicar cadencia de comunicación (2-3 min)
Decirle exactamente cómo se va a comunicar el equipo:
- **Avances viernes:** todos los viernes mandamos un resumen de qué hicimos esa semana. Según el día que entró al proyecto, el primer avance lo recibe el viernes de esa semana (si fue martes/miércoles/jueves) o el viernes siguiente (si fue lunes).
- **Durante la semana:** puede haber screenshots, actualizaciones o dudas. Este tiempo lo usamos principalmente para desarrollar, no para meetings. Todo queda documentado en el plan del proyecto.
- **Plan online:** le compartimos un enlace por WhatsApp donde ve el plan semana a semana y el avance en tiempo real. Todo en un mismo lugar, visual y simple.
- **WhatsApp:** es nuestro canal rápido si hay algo urgente.

### Paso 7 · Próximos pasos & cierre (30 seg - 1 min)
"Listo, empezamos a laburar. Te vamos a estar mandando actualizaciones, y cualquier duda nos contactás por WhatsApp. Nos vemos en el primer avance."

---

## Consideraciones especiales

### Proyectos que requieren investigación inicial
Ejemplo: Real Deal Exchange AI (necesita investigar qué API usar, cómo extraer datos, cómo estructurar la BD).
- "Vamos a comenzar con una fase de investigación en paralelo al desarrollo del frontend. Esto nos permite conocer exactamente qué datos vamos a necesitar y cómo los vamos a representar."
- Ser honesto sobre el timeline: la investigación toma tiempo, pero simultáneamente avanzamos en la UI.

### Proyectos directos (sin investigación inicial)
- "Empezamos de una vez. Todo está claro, así que vamos directo al desarrollo."

### Documentación durante la llamada
- Tener una hoja abierta para anotar: dudas, extras, decisiones clave.
- Esto después se documenta en el ticket/proyecto en InsightsOps.

---

## Checklist durante la llamada
[ ] Cliente confirma que el scope está OK
[ ] Se anotaron todas las dudas
[ ] Se identificaron solicitudes extras (y se aclaró que van por separado)
[ ] Cliente entiende la cadencia de avances (viernes + plan online)
[ ] Se capturó la respuesta de motivación (para marketing)
[ ] Se compartió el enlace de WhatsApp
[ ] El cliente tiene el enlace del plan (si aplica)

---

## Después de la llamada (tareas post-kick off)
- **Dentro de 24h:** mandar mail resumen con puntos clave (scope confirmado, timeline, enlaces).
- Responder cualquier duda que requería investigación.
- Si hay extras: mandar propuesta separada de precio.
- Actualizar ticket/proyecto en InsightsOps con decisiones y cambios.
- Comenzar desarrollo (o investigación, según el proyecto).

---

## Notas finales
La clave de esta llamada es la **confirmación**. No es una charla de ventas, es una charla de alineación. El cliente debe irse seguro de que sabemos exactamente qué va a recibir.

**Tono:** cálido pero profesional. Directo y claro (nada de jargon técnico innecesario). Escuchar más que hablar.

No prometas más de lo que está en el presupuesto. Los extras son exactamente eso: extras. Esto protege tanto al cliente como a nosotros.`

function seedSops() {
  return {
    categories: [
      { id: 'sopc-onboarding', name: 'Onboarding', parentId: null, createdAt: '2026-07-09T12:00:00.000Z' },
    ],
    processes: [
      { id: 'sop-onboarding-call', categoryId: 'sopc-onboarding', title: 'Llamada de onboarding', description: 'Proceso de kick off — llamada inicial con el cliente post-pago para confirmar alcance y cadencia.', content: SOP_ONBOARDING_CALL, links: [], images: [], createdAt: '2026-07-09T12:00:00.000Z', updatedAt: '2026-07-09T12:00:00.000Z' },
    ],
  }
}

/* ============================================================================
   5 · PERSISTED STATE HOOK
============================================================================ */
const STORE_KEY = 'insights_os_v1'
/* merge seeds into persisted state without wiping user edits */
function migrate(state) {
  if (!state.team || !state.team.length) state.team = seedTeam()
  // add any new team members that aren't present yet (by id) — ej: Nacho Cachaza (u7)
  const uIds = new Set(state.team.map((u) => u.id))
  seedTeam().forEach((u) => { if (!uIds.has(u.id)) state.team.push(u) })
  // baja forzada de miembros dados de baja (ej: Nicolas Arditi = u4)
  state.team = state.team.filter((u) => !REMOVED_MEMBER_IDS.includes(u.id))
  // backfill del email de login en miembros que no lo tienen (auto-vincula sin duplicar)
  state.team = state.team.map((u) => (!u.email && SEED_EMAILS[u.id]) ? { ...u, email: SEED_EMAILS[u.id] } : u)
  // backfill del rango (PM/Dev/Otro) — solo la primera vez que aparece cada miembro, no pisa ediciones manuales futuras
  state.team = state.team.map((u) => (u.role === undefined) ? { ...u, role: SEED_ROLES[u.id] ?? '' } : u)
  if (!state.clients) state.clients = seedClients()
  if (!state.projects) state.projects = seedProjects()
  if (!state.calls) state.calls = seedCalls()
  state.calls = state.calls.map((c) => ({ ...c, priority: c.priority || 'normal', type: c.type || 'soporte', summary: c.summary || '', transcript: c.transcript || '' }))
  if (!state.assistantChats) state.assistantChats = []
  // Las tareas ya NO viven dentro de app_state (documento monolítico,
  // último-en-escribir-gana). Ahora cada tarea es su propia fila en la tabla
  // `tasks` (ver useTasks). Las sacamos del blob para que ninguna pestaña con
  // estado viejo pueda pisarlas ni borrarlas al guardar app_state.
  if (state.tasks) delete state.tasks
  if (!state.activity) state.activity = []
  // actividad sin autor (actorId vacío o de un miembro que ya no está) → atribuir a Nacho Cachaza
  const _nacho = state.team.find((u) => /nacho/i.test(u.name || '') || String(u.email || '').toLowerCase() === 'nachocachaza@insightsapps.tech')
  if (_nacho) {
    const _teamIds = new Set(state.team.map((u) => u.id))
    state.activity = state.activity.map((a) => (!a.actorId || !_teamIds.has(a.actorId)) ? { ...a, actorId: _nacho.id } : a)
  }
  // SOPs (procesos documentados) — mergea semillas nuevas por id sin pisar ediciones del usuario
  if (!state.sops || Array.isArray(state.sops)) state.sops = { categories: [], processes: [] }
  if (!state.sops.categories) state.sops.categories = []
  if (!state.sops.processes) state.sops.processes = []
  const seededSops = seedSops()
  const sopcIds = new Set(state.sops.categories.map((c) => c.id))
  seededSops.categories.forEach((c) => { if (!sopcIds.has(c.id)) state.sops.categories.push(c) })
  const soppIds = new Set(state.sops.processes.map((p) => p.id))
  seededSops.processes.forEach((p) => { if (!soppIds.has(p.id)) state.sops.processes.push(p) })
  state.sops.processes = state.sops.processes.map((p) => ({ ...p, links: p.links || [], images: p.images || [] }))
  // Los planes ya NO viven dentro de app_state (que se guarda como documento
  // único y último-en-escribir-gana). Ahora cada plan es su propia fila en la
  // tabla `plans` (ver usePlans). Acá los sacamos del blob para que ninguna
  // pestaña con estado viejo pueda pisarlos o borrarlos al guardar app_state.
  if (state.plans) delete state.plans
  // add new clients/projects that aren't present yet (by id)
  const cIds = new Set(state.clients.map((c) => c.id))
  seedClients().forEach((c) => { if (!cIds.has(c.id)) state.clients.push(c) })
  const pIds = new Set(state.projects.map((p) => p.id))
  seedProjects().forEach((p) => { if (!pIds.has(p.id)) state.projects.push(p) })
  // ensure assignments + tags exist, drop devUrl y los sprints legacy
  const stripRemoved = (as) => {
    const r = { pm: as?.pm || null, dev: as?.dev || null }
    if (r.pm && REMOVED_MEMBER_IDS.includes(r.pm.userId)) r.pm = null
    if (r.dev && REMOVED_MEMBER_IDS.includes(r.dev.userId)) r.dev = null
    return r
  }
  state.projects = state.projects.map((p) => {
    // devUrl y sprints eliminados del modelo (el avance sale del plan asociado)
    const { devUrl, sprints, _sprintsImportRDE1, ...rest } = p
    return {
      ...rest,
      kind: rest.kind || 'cliente',   // clasificación: cliente (default) | interno (de Insights)
      assignments: stripRemoved(rest.assignments || DEMO_ASSIGN[rest.id] || { pm: null, dev: null }),
      tags: rest.tags || [],
      priority: rest.priority || 'normal',
      createdAt: rest.createdAt || new Date().toISOString(),
      avances: rest.avances || [],
      comms: rest.comms || [],
      scopeFiles: rest.scopeFiles || [],
      salesLinks: rest.salesLinks || [],
      scopeNotes: rest.scopeNotes || [],
      risks: rest.risks || [],
      pendingAgency: rest.pendingAgency || [],
      pendingClient: rest.pendingClient || [],
      chats: rest.chats || [],
      activity: rest.activity || [],
      driveUrl: rest.driveUrl || '',
      clientTasks: rest.clientTasks || [],
      planId: rest.planId ?? null,
    }
  })
  return state
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch (e) { /* ignore */ }
  return migrate({ team: seedTeam(), clients: seedClients(), projects: seedProjects(), calls: seedCalls() })
}
const CLOUD_ROW = 'main'   // single shared document
/* data hook: localStorage cache (instant/offline) + Supabase cloud sync (shared) */
function useAppData() {
  const [data, setData] = useState(loadState)
  const [sync, setSync] = useState(cloudEnabled ? 'loading' : 'local') // loading|saving|saved|error|local
  const lastSaved = useRef(null)     // last JSON we know is in the cloud (avoid echo loops)
  const loaded = useRef(!cloudEnabled)
  const timer = useRef(null)

  // initial cloud load + realtime subscription
  useEffect(() => {
    if (!cloudEnabled) return
    let alive = true
    ;(async () => {
      try {
        const { data: row, error } = await supabase.from('app_state').select('data').eq('id', CLOUD_ROW).maybeSingle()
        if (!alive) return
        if (error) throw error
        if (row && row.data) {
          const merged = migrate(row.data)
          lastSaved.current = JSON.stringify(merged)
          setData(merged)
        } else {
          // first run: seed the cloud with the current (local) state
          const seed = loadState()
          await supabase.from('app_state').upsert({ id: CLOUD_ROW, data: seed })
          lastSaved.current = JSON.stringify(seed)
          setData(seed)
        }
        setSync('saved')
      } catch (e) {
        if (alive) setSync('error')
      } finally {
        loaded.current = true
      }
    })()
    const channel = supabase
      .channel('app_state_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${CLOUD_ROW}` }, (payload) => {
        const incoming = payload.new && payload.new.data
        if (!incoming) return
        const js = JSON.stringify(incoming)
        if (js === lastSaved.current) return     // our own write echoed back
        lastSaved.current = js
        setData(migrate(incoming))
      })
      .subscribe()
    return () => { alive = false; supabase.removeChannel(channel) }
  }, [])

  // persist: localStorage always + cloud (debounced) when something actually changed
  useEffect(() => {
    // Defensa en profundidad: las tareas viven en su propia tabla (ver useTasks)
    // y NUNCA deben volver a persistirse dentro del documento monolítico. Aunque
    // migrate() ya las saca al cargar, las stripeamos también al guardar para que
    // ningún camino (código viejo, eco de otra pestaña) pueda reintroducirlas.
    const clean = ('tasks' in data) ? (() => { const c = { ...data }; delete c.tasks; return c })() : data
    try { localStorage.setItem(STORE_KEY, JSON.stringify(clean)) } catch (e) { /* quota */ }
    if (!cloudEnabled || !loaded.current) return
    const js = JSON.stringify(clean)
    if (js === lastSaved.current) return
    setSync('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from('app_state').upsert({ id: CLOUD_ROW, data: clean, updated_at: new Date().toISOString() })
        if (error) throw error
        lastSaved.current = js
        setSync('saved')
      } catch (e) { setSync('error') }
    }, 700)
    return () => clearTimeout(timer.current)
  }, [data])

  return [data, setData, sync]
}

/* ============================================================================
   6b · PLANS STORE — cada plan es una fila en la tabla `plans` de Supabase.
   Ya NO viven dentro de app_state (documento monolítico, último-gana). Esto
   blinda contra el bug histórico: una pestaña con estado viejo ya no puede
   pisar ni borrar todos los planes, porque cada escritura toca una sola fila.
   - Carga inicial (rows activas) + realtime por tabla.
   - patch: optimista + upsert debounced de esa fila (500ms).
   - delete: soft-delete (tombstone) — una edición vieja no puede resucitarlo.
   - merge realtime: solo aplica lo entrante si es más nuevo (ignora el eco
     de nuestra propia escritura y writes con updatedAt más viejo).
============================================================================ */
const PLAN_SAVE_DEBOUNCE = 500
const PLAN_PUBLISH_DEBOUNCE = 700   // sync a published_plans (el link público) tras marcar avance

/**
 * Sube (o pisa) el plan en published_plans — la tabla que lee el sitio público de
 * planes en Vercel. Gemela de upsertPublished() de PlannerView.jsx, pero acá vive en
 * el store para que marcar avance desde el PROYECTO (no solo editar en el planner)
 * también refresque el link del cliente. Requiere sesión (RLS) → usa el cliente
 * supabase autenticado del módulo. Idempotente: upsert por slug.
 */
async function upsertPublishedPlan(plan) {
  if (!supabase) return { error: { message: 'No estás conectado a la base (modo local).' } }
  return supabase
    .from('published_plans')
    .upsert({ slug: plan.slug, data: plan, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
}

function usePlans() {
  const [plans, setPlansState] = useState([])
  const [ready, setReady] = useState(!cloudEnabled)
  const plansRef = useRef([])
  const timers = useRef(new Map())    // id -> timeout del guardado debounced
  const pending = useRef(new Map())   // id -> última versión aún NO confirmada en el server
  // Auto-sync al link público (published_plans). Centralizado en el store para que
  // marcar avance desde el proyecto refresque el link, no solo editar en el planner.
  const [publishSync, setPublishSync] = useState({})   // { [id]: 'saving'|'saved'|'error' }
  const pubTimers = useRef(new Map())   // id -> timeout del sync a published_plans
  const pubLatest = useRef(new Map())   // id -> última versión del plan a sincronizar

  // Fuente de verdad = plansRef (siempre fresca, sin closures viejos). Cada
  // mutación recalcula desde el ref y empuja al estado de React.
  const applyLocal = (fn) => {
    const next = fn(plansRef.current)
    plansRef.current = next
    setPlansState(next)
  }

  // Escritura real de una fila. Al confirmar, saca el pendiente si sigue siendo
  // esta misma versión (si el usuario editó más, queda un pendiente nuevo).
  const writePlan = async (plan) => {
    if (!cloudEnabled) return
    try {
      await supabase.from('plans').upsert(
        { id: plan.id, data: plan, updated_at: plan.updatedAt || new Date().toISOString() },
        { onConflict: 'id' },
      )
      const still = pending.current.get(plan.id)
      if (still && still.updatedAt === plan.updatedAt) pending.current.delete(plan.id)
    } catch (e) { /* queda pendiente; se reintenta en la próxima edición o en flush() */ }
  }

  // Vacía a disco todo lo que quedó en debounce. Se llama al ocultar/cerrar la
  // pestaña, para no perder la última edición dentro de la ventana de debounce.
  const flush = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    pending.current.forEach((plan) => { writePlan(plan) })
    // También vaciar el sync al link que haya quedado en debounce (avance sin perder).
    pubTimers.current.forEach((t, id) => { clearTimeout(t); const p = pubLatest.current.get(id); if (p) upsertPublishedPlan(p) })
    pubTimers.current.clear()
  }

  // Carga la lista desde el server sin pisar ediciones locales aún sin sincronizar.
  const loadPlans = async () => {
    if (!cloudEnabled) return
    const { data: rows, error } = await supabase
      .from('plans').select('data').is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) return
    applyLocal(() => {
      const server = (rows || []).map((r) => r.data)
      if (pending.current.size === 0) return server
      const byId = new Map(server.map((p) => [p.id, p]))
      pending.current.forEach((local, id) => {
        const s = byId.get(id)
        if (!s || (local.updatedAt || '') >= (s.updatedAt || '')) byId.set(id, local)
      })
      return [...byId.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    })
  }

  useEffect(() => {
    if (!cloudEnabled) return
    let alive = true
    ;(async () => { try { await loadPlans() } finally { if (alive) setReady(true) } })()

    let subscribedOnce = false
    const channel = supabase
      .channel('plans_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, (payload) => {
        const row = payload.new
        if (payload.eventType === 'DELETE') {
          const goneId = payload.old && payload.old.id
          applyLocal((cur) => cur.filter((p) => p.id !== goneId)); return
        }
        if (!row) return
        if (row.deleted_at) { applyLocal((cur) => cur.filter((p) => p.id !== row.id)); return }
        const incoming = row.data
        if (!incoming || !incoming.id) return
        applyLocal((cur) => {
          const idx = cur.findIndex((p) => p.id === incoming.id)
          if (idx === -1) return [incoming, ...cur]
          const localT = cur[idx].updatedAt || ''
          const remoteT = incoming.updatedAt || ''
          if (remoteT <= localT) return cur   // nuestro eco o una versión más vieja → ignorar
          const nx = [...cur]; nx[idx] = incoming; return nx
        })
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // Reconexión del realtime: pudimos habernos perdido eventos → resync.
        if (subscribedOnce) loadPlans()
        subscribedOnce = true
      })

    return () => { alive = false; flush(); supabase.removeChannel(channel) }
  }, [])

  // Al ocultar/cerrar la pestaña, no esperar el debounce: guardar ya.
  useEffect(() => {
    if (!cloudEnabled) return
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide) }
  }, [])

  const scheduleSave = (plan) => {
    if (!cloudEnabled) return
    pending.current.set(plan.id, plan)
    const t = timers.current
    clearTimeout(t.get(plan.id))
    t.set(plan.id, setTimeout(() => { t.delete(plan.id); writePlan(plan) }, PLAN_SAVE_DEBOUNCE))
  }

  // ── Sync al link público (published_plans) ────────────────────────────────
  // Sube la última versión del plan. Si mientras subíamos llegó una edición más
  // nueva, no marcamos 'saved' (la deja el run siguiente). Idempotente (upsert por slug).
  const runPublishSync = async (id) => {
    const plan = pubLatest.current.get(id)
    if (!plan) return
    setPublishSync((m) => ({ ...m, [id]: 'saving' }))
    const { error } = await upsertPublishedPlan(plan)
    if (error) { setPublishSync((m) => ({ ...m, [id]: 'error' })); return }
    const latest = pubLatest.current.get(id)
    if (latest && latest.updatedAt !== plan.updatedAt) return   // hay una versión más nueva en camino
    setPublishSync((m) => ({ ...m, [id]: 'saved' }))
  }

  // Programa el sync al link (debounce ~700ms por id). Solo planes publicados con slug.
  const schedulePublishSync = (plan) => {
    if (!cloudEnabled || !plan || !plan.published || !plan.slug) return
    pubLatest.current.set(plan.id, plan)
    setPublishSync((m) => (m[plan.id] === 'saving' ? m : { ...m, [plan.id]: 'saving' }))
    const t = pubTimers.current
    clearTimeout(t.get(plan.id))
    t.set(plan.id, setTimeout(() => { t.delete(plan.id); runPublishSync(plan.id) }, PLAN_PUBLISH_DEBOUNCE))
  }

  // Reintento manual (chip del editor). Sube ya la última versión conocida del plan.
  const retryPublish = (id) => {
    if (!pubLatest.current.get(id)) {
      const p = plansRef.current.find((x) => x.id === id)
      if (p) pubLatest.current.set(id, p)
    }
    clearTimeout(pubTimers.current.get(id)); pubTimers.current.delete(id)
    runPublishSync(id)
  }

  // Crear: escritura inmediata (sin debounce) para que exista en el server ya.
  // Si falla (ej. sin red), queda como pendiente y se reintenta.
  const createPlan = async (plan) => {
    applyLocal((cur) => [plan, ...cur])
    if (!cloudEnabled) return { error: null }
    const { error } = await supabase.from('plans').insert(
      { id: plan.id, data: plan, updated_at: plan.updatedAt || new Date().toISOString() },
    )
    if (error) scheduleSave(plan)
    return { error }
  }

  // Editar: patch por id, optimista + guardado debounced de esa sola fila.
  const patchPlan = (id, fn) => {
    let saved = null
    applyLocal((cur) => cur.map((p) => {
      if (p.id !== id) return p
      saved = { ...fn(p), updatedAt: new Date().toISOString() }
      return saved
    }))
    // Guardado a la tabla `plans` (siempre) + sync al link público (si está publicado).
    if (saved) { scheduleSave(saved); schedulePublishSync(saved) }
    return saved
  }

  // Borrar: soft-delete (tombstone). El upsert de edición no toca deleted_at,
  // así que una pestaña vieja editando no puede resucitar un plan borrado.
  const deletePlan = async (id) => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id)
    pending.current.delete(id)   // que un flush no reescriba un plan recién borrado
    clearTimeout(pubTimers.current.get(id)); pubTimers.current.delete(id)   // ni re-suba su link
    pubLatest.current.delete(id)
    applyLocal((cur) => cur.filter((p) => p.id !== id))
    if (!cloudEnabled) return { error: null }
    const { error } = await supabase.from('plans').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    return { error }
  }

  return { plans, plansReady: ready, createPlan, patchPlan, deletePlan, publishSync, retryPublish }
}

/* ============================================================================
   6c · TASKS STORE — cada tarea es una fila en la tabla `tasks` de Supabase.
   Mismo blindaje que `plans` (6b): las tareas ya NO viven dentro de app_state
   (documento monolítico, último-en-escribir-gana), así una pestaña con estado
   viejo NO puede pisar ni borrar las tareas que otro subió y ella nunca vio.
   Cada mutación toca UNA fila; realtime por tabla + soft-delete + merge por
   updatedAt. No importa si otra pestaña quedó abierta con estado viejo.
============================================================================ */
const TASK_SAVE_DEBOUNCE = 500

// Normaliza una tarea (server/seed/realtime): default de prioridad y baja de
// asignados que ya no están en el equipo. Espeja lo que hacía migrate() cuando
// las tareas vivían en el blob.
function normalizeTask(t) {
  return {
    ...t,
    priority: t.priority || 'normal',
    assigneeId: REMOVED_MEMBER_IDS.includes(t.assigneeId) ? '' : (t.assigneeId || ''),
    comments: t.comments || [],
  }
}

function useTasks() {
  const [tasks, setTasksState] = useState(() => (cloudEnabled ? [] : seedTasks().map(normalizeTask)))
  const [ready, setReady] = useState(!cloudEnabled)
  const tasksRef = useRef(tasks)
  const timers = useRef(new Map())    // id -> timeout del guardado debounced
  const pending = useRef(new Map())   // id -> última versión aún NO confirmada en el server

  // Fuente de verdad = tasksRef (siempre fresca, sin closures viejos).
  const applyLocal = (fn) => {
    const next = fn(tasksRef.current)
    tasksRef.current = next
    setTasksState(next)
  }

  // Escritura real de una fila. Al confirmar, saca el pendiente si sigue siendo
  // esta misma versión (si el usuario editó más, queda un pendiente nuevo).
  const writeTask = async (task) => {
    if (!cloudEnabled) return
    try {
      await supabase.from('tasks').upsert(
        { id: task.id, data: task, updated_at: task.updatedAt || new Date().toISOString() },
        { onConflict: 'id' },
      )
      const still = pending.current.get(task.id)
      if (still && still.updatedAt === task.updatedAt) pending.current.delete(task.id)
    } catch (e) { /* queda pendiente; se reintenta en la próxima edición o en flush() */ }
  }

  // Vacía a disco lo que quedó en debounce. Se llama al ocultar/cerrar la
  // pestaña para no perder la última edición dentro de la ventana de debounce.
  const flush = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    pending.current.forEach((task) => { writeTask(task) })
  }

  // Carga la lista del server sin pisar ediciones locales aún sin sincronizar.
  const loadTasks = async () => {
    if (!cloudEnabled) return
    const { data: rows, error } = await supabase
      .from('tasks').select('data').is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) return
    applyLocal(() => {
      const server = (rows || []).map((r) => normalizeTask(r.data))
      if (pending.current.size === 0) return server
      const byId = new Map(server.map((t) => [t.id, t]))
      pending.current.forEach((local, id) => {
        const s = byId.get(id)
        if (!s || (local.updatedAt || '') >= (s.updatedAt || '')) byId.set(id, local)
      })
      return [...byId.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    })
  }

  useEffect(() => {
    if (!cloudEnabled) return
    let alive = true
    ;(async () => { try { await loadTasks() } finally { if (alive) setReady(true) } })()

    let subscribedOnce = false
    const channel = supabase
      .channel('tasks_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        const row = payload.new
        if (payload.eventType === 'DELETE') {
          const goneId = payload.old && payload.old.id
          applyLocal((cur) => cur.filter((t) => t.id !== goneId)); return
        }
        if (!row) return
        if (row.deleted_at) { applyLocal((cur) => cur.filter((t) => t.id !== row.id)); return }
        const incoming = row.data
        if (!incoming || !incoming.id) return
        applyLocal((cur) => {
          const idx = cur.findIndex((t) => t.id === incoming.id)
          const norm = normalizeTask(incoming)
          if (idx === -1) return [norm, ...cur]
          const localT = cur[idx].updatedAt || ''
          const remoteT = incoming.updatedAt || ''
          if (remoteT <= localT) return cur   // nuestro eco o una versión más vieja → ignorar
          const nx = [...cur]; nx[idx] = norm; return nx
        })
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // Reconexión del realtime: pudimos habernos perdido eventos → resync.
        if (subscribedOnce) loadTasks()
        subscribedOnce = true
      })

    return () => { alive = false; flush(); supabase.removeChannel(channel) }
  }, [])

  // Al ocultar/cerrar la pestaña, no esperar el debounce: guardar ya.
  useEffect(() => {
    if (!cloudEnabled) return
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide) }
  }, [])

  const scheduleSave = (task) => {
    if (!cloudEnabled) return
    pending.current.set(task.id, task)
    const t = timers.current
    clearTimeout(t.get(task.id))
    t.set(task.id, setTimeout(() => { t.delete(task.id); writeTask(task) }, TASK_SAVE_DEBOUNCE))
  }

  // Crear: escritura inmediata (sin debounce) para que exista en el server ya.
  // Si falla (ej. sin red), queda pendiente y se reintenta.
  const createTask = async (task) => {
    const t = { ...normalizeTask(task), updatedAt: new Date().toISOString() }
    applyLocal((cur) => [t, ...cur])
    if (!cloudEnabled) return { error: null }
    const { error } = await supabase.from('tasks').insert({ id: t.id, data: t, updated_at: t.updatedAt })
    if (error) scheduleSave(t)
    return { error }
  }

  // Editar: patch por id, optimista + guardado debounced de esa sola fila.
  const patchTask = (id, fn) => {
    let saved = null
    applyLocal((cur) => cur.map((t) => {
      if (t.id !== id) return t
      saved = { ...fn(t), updatedAt: new Date().toISOString() }
      return saved
    }))
    if (saved) scheduleSave(saved)
    return saved
  }

  // Borrar: soft-delete (tombstone). El upsert de una edición vieja no toca
  // deleted_at, así que una pestaña vieja no puede resucitar una tarea borrada.
  const deleteTask = async (id) => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id)
    pending.current.delete(id)   // que un flush no reescriba una tarea recién borrada
    applyLocal((cur) => cur.filter((t) => t.id !== id))
    if (!cloudEnabled) return { error: null }
    const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    return { error }
  }

  return { tasks, tasksReady: ready, createTask, patchTask, deleteTask }
}

/* ============================================================================
   6d · ROW-COLLECTION STORE — factory genérica anti-clobber.
   Generaliza usePlans (6b) y useTasks (6c): cada ítem es su propia fila en su
   tabla de Supabase (id text pk, data jsonb, updated_at, deleted_at). Ninguna
   pestaña con estado viejo puede pisar ni borrar lo que otro subió, porque cada
   escritura toca UNA fila y el merge de realtime solo acepta lo más nuevo (por
   updatedAt). Incluye: cache local (carga instantánea/offline), realtime por
   tabla, RESYNC al reconectar el socket (lo que a app_state le faltaba) y flush
   al ocultar/cerrar la pestaña (no perder el debounce).
   opts: { table, normalize, seed, cacheKey, loadLimit }
============================================================================ */
const ROW_SAVE_DEBOUNCE = 500

function useRowCollection({ table, normalize = (x) => x, seed = () => [], cacheKey, loadLimit = 0 }) {
  const readCache = () => {
    if (!cacheKey) return null
    try { const raw = localStorage.getItem(cacheKey); if (raw) return JSON.parse(raw) } catch (e) { /* ignore */ }
    return null
  }
  const [items, setItemsState] = useState(() => {
    const cached = readCache()
    if (cached) return cached.map(normalize)
    return cloudEnabled ? [] : seed().map(normalize)
  })
  const [ready, setReady] = useState(!cloudEnabled)
  const [saving, setSaving] = useState(false)
  const itemsRef = useRef(items)
  const timers = useRef(new Map())    // id -> timeout del guardado debounced
  const pending = useRef(new Map())   // id -> última versión aún NO confirmada en el server
  const deletedIds = useRef(new Set())   // ids con tombstone conocido → el borrado gana, nunca se resucita

  const writeCache = (list) => { if (cacheKey) { try { localStorage.setItem(cacheKey, JSON.stringify(list)) } catch (e) { /* quota */ } } }
  const syncSaving = () => setSaving(pending.current.size > 0)

  // Fuente de verdad = itemsRef (siempre fresca, sin closures viejos). Cada
  // mutación recalcula desde el ref, empuja al estado de React y cachea a disco.
  const applyLocal = (fn) => {
    const next = fn(itemsRef.current)
    itemsRef.current = next
    setItemsState(next)
    writeCache(next)
  }

  // Escritura real de una fila. Al confirmar, saca el pendiente si sigue siendo
  // esta misma versión (si el usuario editó más, queda un pendiente nuevo).
  const writeRow = async (item) => {
    if (!cloudEnabled) return
    try {
      await supabase.from(table).upsert(
        { id: item.id, data: item, updated_at: item.updatedAt || new Date().toISOString() },
        { onConflict: 'id' },
      )
      const still = pending.current.get(item.id)
      if (still && still.updatedAt === item.updatedAt) { pending.current.delete(item.id); syncSaving() }
    } catch (e) { /* queda pendiente; se reintenta en la próxima edición o en flush() */ }
  }

  // Vacía a disco todo lo que quedó en debounce. Se llama al ocultar/cerrar la
  // pestaña, para no perder la última edición dentro de la ventana de debounce.
  const flush = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    pending.current.forEach((item) => { writeRow(item) })
  }

  // Carga la lista del server sin pisar ediciones locales aún sin sincronizar.
  const loadRows = async () => {
    if (!cloudEnabled) return
    let q = supabase.from(table).select('data').is('deleted_at', null).order('updated_at', { ascending: false })
    if (loadLimit) q = q.limit(loadLimit)
    const { data: rows, error } = await q
    if (error) return
    // Si hay ediciones locales sin sincronizar, chequeá cuáles de esas filas fueron
    // borradas (tombstone) en otra pestaña, para NO resucitarlas al mergear el pending.
    if (pending.current.size > 0) {
      const ids = [...pending.current.keys()]
      const { data: tomb } = await supabase.from(table).select('id').in('id', ids).not('deleted_at', 'is', null)
      ;(tomb || []).forEach((r) => deletedIds.current.add(r.id))
    }
    applyLocal(() => {
      const server = (rows || []).map((r) => normalize(r.data)).filter((x) => x && x.id)
      if (pending.current.size === 0) return server
      const byId = new Map(server.map((x) => [x.id, x]))
      pending.current.forEach((local, id) => {
        if (deletedIds.current.has(id)) return   // borrado remoto → no resucitar el pending
        const s = byId.get(id)
        if (!s || (local.updatedAt || '') >= (s.updatedAt || '')) byId.set(id, local)
      })
      return [...byId.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    })
  }

  useEffect(() => {
    if (!cloudEnabled) return
    let alive = true
    ;(async () => { try { await loadRows() } finally { if (alive) setReady(true) } })()

    let subscribedOnce = false
    const channel = supabase
      .channel(table + '_all')
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const goneId = payload.old && payload.old.id
          if (goneId) deletedIds.current.add(goneId)
          applyLocal((cur) => cur.filter((x) => x.id !== goneId)); return
        }
        const row = payload.new
        if (!row) return
        if (row.deleted_at) { deletedIds.current.add(row.id); applyLocal((cur) => cur.filter((x) => x.id !== row.id)); return }
        const incoming = row.data
        if (!incoming || !incoming.id) return
        if (deletedIds.current.has(incoming.id)) return   // ya borrado → no resucitar por un eco viejo/fuera de orden
        applyLocal((cur) => {
          const idx = cur.findIndex((x) => x.id === incoming.id)
          const norm = normalize(incoming)
          if (idx === -1) return [norm, ...cur]
          const localT = cur[idx].updatedAt || ''
          const remoteT = incoming.updatedAt || ''
          if (remoteT <= localT) return cur   // nuestro eco o una versión más vieja → ignorar
          const nx = [...cur]; nx[idx] = norm; return nx
        })
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // Reconexión del realtime: pudimos habernos perdido eventos → resync.
        if (subscribedOnce) loadRows()
        subscribedOnce = true
      })

    return () => { alive = false; flush(); supabase.removeChannel(channel) }
  }, [])

  // Al ocultar/cerrar la pestaña, no esperar el debounce: guardar ya.
  useEffect(() => {
    if (!cloudEnabled) return
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide) }
  }, [])

  const scheduleSave = (item) => {
    if (!cloudEnabled) return
    pending.current.set(item.id, item); syncSaving()
    const t = timers.current
    clearTimeout(t.get(item.id))
    t.set(item.id, setTimeout(() => { t.delete(item.id); writeRow(item) }, ROW_SAVE_DEBOUNCE))
  }

  // Crear: escritura inmediata (sin debounce) para que exista en el server ya.
  // Si falla (ej. sin red), queda pendiente y se reintenta.
  const create = async (item) => {
    const it = { ...normalize(item), updatedAt: item.updatedAt || new Date().toISOString() }
    applyLocal((cur) => [it, ...cur.filter((x) => x.id !== it.id)])
    if (!cloudEnabled) return { error: null, item: it }
    const { error } = await supabase.from(table).insert({ id: it.id, data: it, updated_at: it.updatedAt })
    if (error) scheduleSave(it)
    return { error, item: it }
  }

  // Editar: patch por id, optimista + guardado debounced de esa sola fila.
  const patch = (id, fn) => {
    let saved = null
    applyLocal((cur) => cur.map((x) => {
      if (x.id !== id) return x
      saved = normalize({ ...fn(x), updatedAt: new Date().toISOString() })
      return saved
    }))
    if (saved) scheduleSave(saved)
    return saved
  }

  // Upsert por id (patch si existe, crea si no) — para los helpers "saveX".
  const upsert = (item) => (itemsRef.current.some((x) => x.id === item.id) ? patch(item.id, () => item) : create(item))

  // Borrar: soft-delete (tombstone). El upsert de una edición vieja no toca
  // deleted_at, así que una pestaña vieja no puede resucitar lo borrado.
  const remove = async (id) => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id)
    pending.current.delete(id); syncSaving()
    deletedIds.current.add(id)   // tombstone local → ningún eco ni resync lo resucita
    applyLocal((cur) => cur.filter((x) => x.id !== id))
    if (!cloudEnabled) return { error: null }
    const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
    return { error }
  }

  return { items, ready, saving, create, patch, upsert, remove }
}

/* Normalizadores por colección — espejan lo que hacía migrate() cuando estas
   colecciones vivían dentro del blob app_state. Idempotentes. */
const stripRemovedAssign = (as) => {
  const r = { pm: as?.pm || null, dev: as?.dev || null }
  if (r.pm && REMOVED_MEMBER_IDS.includes(r.pm.userId)) r.pm = null
  if (r.dev && REMOVED_MEMBER_IDS.includes(r.dev.userId)) r.dev = null
  return r
}
function normalizeProject(p) {
  // devUrl y sprints eliminados del modelo (igual que migrate)
  const { devUrl, sprints, _sprintsImportRDE1, ...rest } = p
  return {
    ...rest,
    assignments: stripRemovedAssign(rest.assignments || DEMO_ASSIGN[rest.id] || { pm: null, dev: null }),
    tags: rest.tags || [],
    priority: rest.priority || 'normal',
    createdAt: rest.createdAt || new Date().toISOString(),
    // marca de "último avance" automática: se actualiza al tachar una tarea del
    // plan asociado (no depende del log manual de `avances`).
    lastProgressAt: rest.lastProgressAt || null,
    avances: rest.avances || [],
    comms: rest.comms || [],
    scopeFiles: rest.scopeFiles || [],
    salesLinks: rest.salesLinks || [],
    scopeNotes: rest.scopeNotes || [],
    risks: rest.risks || [],
    pendingAgency: rest.pendingAgency || [],
    pendingClient: rest.pendingClient || [],
    chats: rest.chats || [],
    activity: rest.activity || [],
    driveUrl: rest.driveUrl || '',
    clientTasks: rest.clientTasks || [],
    planId: rest.planId ?? null,
  }
}
const normalizeClient = (c) => c
function normalizeTeamMember(u) {
  let m = u
  if (!m.email && SEED_EMAILS[m.id]) m = { ...m, email: SEED_EMAILS[m.id] }
  if (m.role === undefined) m = { ...m, role: SEED_ROLES[m.id] ?? '' }
  return m
}
const normalizeCall = (c) => ({ ...c, priority: c.priority || 'normal', type: c.type || 'soporte', summary: c.summary || '', transcript: c.transcript || '' })
const normalizeSopProcess = (p) => ({ ...p, links: p.links || [], images: p.images || [] })
const normalizeSopCategory = (c) => c
const normalizeActivity = (a) => a
const normalizeChat = (c) => c

/* ============================================================================
   7 · GITHUB INTEGRATION HOOK
============================================================================ */
function useGithubCommit(repo) {
  const [state, setState] = useState({ loading: !!repo, data: null, error: null })
  useEffect(() => {
    if (!repo) { setState({ loading: false, data: null, error: 'sin repo' }); return }
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    const token = localStorage.getItem('gh_token')
    fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'repo no encontrado' : `HTTP ${r.status}`)
        return r.json()
      })
      .then((arr) => {
        if (!alive) return
        const c = arr[0]
        setState({
          loading: false, error: null,
          data: {
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split('\n')[0],
            author: c.commit.author.name,
            date: c.commit.author.date,
          },
        })
      })
      .catch((e) => { if (alive) setState({ loading: false, data: null, error: e.message }) })
    return () => { alive = false }
  }, [repo])
  return state
}

/* ============================================================================
   8 · ANTHROPIC CHAT
============================================================================ */
const CHAT_MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
async function anthropicChat({ system, messages }) {
  // tu propia key (Ajustes) tiene prioridad; si no, la global de Render (env var)
  const key = localStorage.getItem('anthropic_key') || import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key) throw new Error('NO_KEY')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 1200,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`API ${res.status}: ${t.slice(0, 160)}`)
  }
  const json = await res.json()
  return json.content?.map((b) => b.text).join('') || '(respuesta vacía)'
}

/* ============================================================================
   9 · SMALL UI PRIMITIVES
============================================================================ */
function Badge({ children, tone = 'neutral' }) {
  const map = {
    neutral: { color: 'var(--text-dim)', bg: 'var(--bg-elevated)', bd: 'var(--border)' },
    accent: { color: 'var(--accent)', bg: 'var(--accent-soft)', bd: 'var(--accent-line)' },
    green: { color: 'var(--green)', bg: 'var(--green-soft)', bd: 'transparent' },
    red: { color: 'var(--red)', bg: 'var(--red-soft)', bd: 'transparent' },
    yellow: { color: 'var(--yellow)', bg: 'var(--yellow-soft)', bd: 'transparent' },
    blue: { color: 'var(--blue)', bg: 'var(--blue-soft)', bd: 'transparent' },
  }
  const s = map[tone] || map.neutral
  return <span className="tag" style={{ color: s.color, background: s.bg, borderColor: s.bd }}>{children}</span>
}
const prioTone = (p) => (p === 'alta' ? 'red' : p === 'media' ? 'yellow' : 'neutral')
const sevTone = (s) => (s === 'alta' ? 'red' : s === 'media' ? 'yellow' : 'neutral')

/* project status (activo / pausado / entregado) */
const PROJECT_STATUS = [
  /* "Activo" en verde: el naranja es el color de marca y de acción, no un estado. */
  { key: 'active', label: 'Activo', tone: 'green', dot: 'var(--green)' },
  { key: 'pending', label: 'Pendiente', tone: 'blue', dot: 'var(--blue)' },
  { key: 'paused', label: 'Pausado', tone: 'yellow', dot: 'var(--yellow)' },
  { key: 'delivered', label: 'Entregado', tone: 'green', dot: 'var(--green)' },
]
const projStatusMeta = (s) => PROJECT_STATUS.find((x) => x.key === s) || PROJECT_STATUS[0]

/* prioridad de proyecto: banderita roja (alta) / amarilla (normal) / celeste (baja) */
const PROJECT_PRIORITY = [
  { key: 'alta', label: 'Alta', color: 'var(--red)', rank: 3 },
  { key: 'normal', label: 'Normal', color: 'var(--yellow)', rank: 2 },
  { key: 'baja', label: 'Baja', color: 'var(--blue)', rank: 1 },
]
const projPrioMeta = (p) => PROJECT_PRIORITY.find((x) => x.key === p) || PROJECT_PRIORITY[1]

/* tipos de call: onboarding · soporte · entrega */
const CALL_TYPES = [
  { key: 'onboarding', label: 'Onboarding', color: '#38BDF8' },
  { key: 'soporte', label: 'Soporte', color: '#9CA3AF' },
  { key: 'entrega', label: 'Entrega', color: '#22C55E' },
  { key: 'team', label: 'Team', color: '#A855F7' },
]
const callTypeMeta = (t) => CALL_TYPES.find((x) => x.key === t) || CALL_TYPES[1]

/* estados de tarea (sección Tareas) */
const TASK_STATUS = [
  { key: 'pendiente', label: 'Pendiente', tone: 'neutral', dot: 'var(--text-faint)' },
  { key: 'en proceso', label: 'En proceso', tone: 'accent', dot: 'var(--accent)' },
  { key: 'terminado', label: 'Terminado', tone: 'green', dot: 'var(--green)' },
]
const taskStatusMeta = (s) => TASK_STATUS.find((x) => x.key === s) || TASK_STATUS[0]

/* prioridad de tarea: banderita roja / amarilla / blanca */
const TASK_PRIORITY = [
  { key: 'urgente', label: 'Urgente', color: 'var(--red)' },
  { key: 'alta', label: 'Alta', color: '#F97316' },
  { key: 'normal', label: 'Normal', color: 'var(--yellow)' },
  { key: 'bajo', label: 'Bajo', color: 'var(--text)' },
]
const taskPrioMeta = (p) => TASK_PRIORITY.find((x) => x.key === p) || TASK_PRIORITY.find((x) => x.key === 'normal')
/* y-m-d local (para comparar fecha de entrega con hoy/mañana sin líos de zona horaria) */
const localYMD = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
/* origen de la tarea: cliente (ligada a un proyecto) o interna de Insights */
const taskScope = (t) => t.scope || (t.projectId ? 'cliente' : 'interno')

/* tiempo relativo para el centro de notificaciones */
const fmtRelative = (iso) => {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'recién'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 172800) return 'ayer'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

/* días hábiles (lun-vie) transcurridos desde una fecha hasta hoy */
function businessDaysSince(iso) {
  if (!iso) return null
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (d >= today) return 0
  let count = 0
  const cur = new Date(d)
  while (cur < today) { cur.setDate(cur.getDate() + 1); const wd = cur.getDay(); if (wd !== 0 && wd !== 6) count++ }
  return count
}
/* convierte el value de un <input type=date> (YYYY-MM-DD) a ISO en hora local (mediodía) */
const dateInputISO = (v) => (v ? new Date(v + 'T12:00:00').toISOString() : new Date().toISOString())
/* ISO más reciente de una lista, comparando por tiempo real (no orden lexical:
   los timestamptz de Postgres terminan en "+00:00" y los de toISOString en "Z"). */
function latestISO(...isos) {
  let best = null, bestT = -Infinity
  for (const iso of isos) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (Number.isFinite(t) && t > bestT) { bestT = t; best = iso }
  }
  return best
}
/* estado de seguimiento de avance/comunicación de un proyecto (primer registro vs días sin).
   - 'avance' toma el más reciente entre el log manual y `lastProgressAt` (tachar una
     tarea del plan cuenta como avance, sin cargar nada a mano).
   - 'comm' toma el más reciente entre el log manual y `botCommAt` (último mensaje del
     equipo en el grupo de WhatsApp, que reporta el bot). */
function trackInfo(project, kind, botCommAt) {
  const manual = (kind === 'avance' ? project.avances : project.comms)?.[0]?.date || null
  const auto = kind === 'avance' ? (project.lastProgressAt || null) : (botCommAt || null)
  const latest = latestISO(manual, auto)
  // proyecto entregado: ya no se hace seguimiento — nunca marca en rojo (no más avisos de avance)
  if (project.status === 'delivered') return { first: !latest, days: latest ? businessDaysSince(latest) : null, overdue: false, delivered: true }
  if (latest) {
    const days = businessDaysSince(latest)
    const threshold = kind === 'avance' ? 5 : 3
    return { first: false, days, overdue: days != null && days > threshold }
  }
  const days = businessDaysSince(project.createdAt)
  const threshold = kind === 'avance' ? 7 : 3
  return { first: true, days, overdue: days != null && days > threshold }
}

/* imagen (captura) a data URL redimensionada para no inflar el documento */
function fileToImageDataURL(file, maxW = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject; img.src = reader.result
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}

/* fecha estimada de ingreso de proyecto pendiente: chip con color por proximidad */
const parseLocalDate = (iso) => { if (!iso) return null; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
const daysUntil = (iso) => { const dt = parseLocalDate(iso); if (!dt) return null; const t = NOW(); return Math.ceil((dt - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000) }
const fmtShortDate = (iso) => {
  const dt = parseLocalDate(iso)
  if (!dt) return ''
  return dt.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(/,/g, '')   // "lun 3 jul"
}
const pendingDateColor = (iso) => {
  const d = daysUntil(iso)
  if (d == null) return 'var(--text-faint)'
  if (d <= 5) return 'var(--red)'
  if (d <= 15) return 'var(--yellow)'
  return 'var(--green)'
}
function PendingDateChip({ date, style }) {
  if (!date) return null
  const col = pendingDateColor(date)
  return (
    <span className="tag" title="Ingreso estimado del proyecto" style={{ color: col, background: 'transparent', borderColor: col, fontWeight: 700, ...style }}>
      <I2.calendar width={12} height={12} /> {fmtShortDate(date)}
    </span>
  )
}

/* hilo de comentarios reutilizable: muestra avatar + nombre del autor, registra actividad */
/* ---- @menciones: helpers + textarea con autocompletado de miembros ---- */
const escapeRegex = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/* devuelve los ids de miembros que quedan mencionados como "@Nombre" en el texto */
function extractMentions(text, team) {
  const t = text || ''
  return (team || []).filter((u) => u.name && new RegExp('@' + escapeRegex(u.name) + '(?![\\p{L}\\p{N}])', 'iu').test(t)).map((u) => u.id)
}
/* dispara una notificación (entrada de actividad tipo mention) a cada mencionado, menos a uno mismo */
function notifyMentions({ text, team, subject, logActivity, selfId }) {
  const ids = extractMentions(text, team).filter((id) => id !== selfId)
  ids.forEach((id) => logActivity && logActivity({ type: 'mention', text: subject, targetId: id }))
  return ids
}
/* renderiza texto resaltando las @menciones que matchean con un miembro real */
function MentionText({ text, style }) {
  const { data } = useApp()
  const team = data.team || []
  const names = team.filter((u) => u.name).map((u) => escapeRegex(u.name)).sort((a, b) => b.length - a.length)
  if (!text) return null
  if (!names.length) return <span style={style}>{text}</span>
  const re = new RegExp('(@(?:' + names.join('|') + ')(?![\\p{L}\\p{N}]))', 'u')
  const parts = text.split(re)
  return <span style={style}>{parts.map((p, i) => (p && p[0] === '@' && re.test(p)
    ? <span key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>{p}</span>
    : <span key={i}>{p}</span>))}</span>
}
/* textarea que muestra un menú de miembros al tipear "@" para etiquetarlos */
function MentionTextarea({ value, onChange, rows = 2, placeholder, onEnter, style, className = 'input', taRef }) {
  const { data } = useApp()
  const team = data.team || []
  const localRef = useRef(null)
  const ref = taRef || localRef
  const [menu, setMenu] = useState(null)   // { q, start, top, left } | null
  const [hi, setHi] = useState(0)
  const matches = menu ? team.filter((u) => u.name && u.name.toLowerCase().includes(menu.q.toLowerCase())).slice(0, 6) : []

  const scan = (el) => {
    const pos = el.selectionStart
    const m = el.value.slice(0, pos).match(/(?:^|\s)@([\p{L}\p{N}]*)$/u)
    if (m) { const r = el.getBoundingClientRect(); setMenu({ q: m[1], start: pos - m[1].length - 1, top: r.bottom + 4, left: r.left }); setHi(0) }
    else setMenu(null)
  }
  const change = (e) => { onChange(e.target.value); scan(e.target) }
  const pick = (u) => {
    const el = ref.current; if (!el) return
    const pos = el.selectionStart
    const before = value.slice(0, menu.start), after = value.slice(pos), insert = '@' + u.name + ' '
    onChange(before + insert + after); setMenu(null)
    requestAnimationFrame(() => { const c = (before + insert).length; el.focus(); el.setSelectionRange(c, c) })
  }
  const key = (e) => {
    if (menu && matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => (i + 1) % matches.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => (i - 1 + matches.length) % matches.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[hi]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMenu(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && onEnter) { e.preventDefault(); onEnter() }
  }
  return (
    <>
      <textarea ref={ref} className={className} rows={rows} value={value} onChange={change} onKeyDown={key}
        onBlur={() => setTimeout(() => setMenu(null), 150)} onScroll={() => setMenu(null)} placeholder={placeholder} style={style} />
      {menu && matches.length > 0 && createPortal(
        <div className="surface" onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menu.top, left: menu.left, zIndex: 300, width: 244, padding: 5, boxShadow: 'var(--shadow)', maxHeight: 250, overflowY: 'auto' }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', padding: '4px 8px 6px' }}>Etiquetar a…</div>
          {matches.map((u, i) => (
            <div key={u.id} onMouseDown={(e) => { e.preventDefault(); pick(u) }} onMouseEnter={() => setHi(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', background: i === hi ? 'var(--bg-elevated)' : 'transparent' }}>
              <Avatar user={u} size={24} ring="var(--card)" />
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
            </div>
          ))}
        </div>, document.body)}
    </>
  )
}

function CommentThread({ comments, onAdd, onDelete, subject, label = 'Comentarios' }) {
  const { data, logActivity } = useApp()
  const [text, setText] = useState('')
  const team = data.team || []
  const myId = typeof localStorage !== 'undefined' ? localStorage.getItem('my_team_id') : ''
  const userOf = (id) => team.find((u) => u.id === id)
  const list = comments || []
  const submit = () => {
    const t = text.trim(); if (!t) return
    onAdd({ id: uid(), text: t, date: new Date().toISOString(), authorId: myId || '' })
    if (subject && logActivity) logActivity({ type: 'comment', text: `comentó en ${subject}` })
    if (subject) notifyMentions({ text: t, team, subject: `en ${subject}`, logActivity, selfId: myId })
    setText('')
  }
  return (
    <div>
      <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><I2.comment width={14} height={14} /> {label} ({list.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Sin comentarios todavía.</div>}
        {list.map((c) => {
          const u = userOf(c.authorId)
          return (
            <div key={c.id} className="surface" style={{ padding: 11, background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {u ? <Avatar user={u} size={22} ring="var(--bg-elevated)" /> : <Avatar empty size={22} ring="var(--bg-elevated)" />}
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{u ? u.name : 'Alguien'}</span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginLeft: 'auto' }}>{fmtDate(c.date)}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => onDelete(c.id)} style={{ padding: 3, color: 'var(--text-faint)' }}><I2.x width={12} height={12} /></button>
              </div>
              <MentionText text={c.text} style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', display: 'block' }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <MentionTextarea value={text} onChange={setText} onEnter={submit} placeholder="Dejá un comentario… @ para etiquetar · Enter envía" style={{ resize: 'none' }} />
        <button className="btn btn-accent" onClick={submit} style={{ alignSelf: 'stretch' }}><I2.send width={15} height={15} /></button>
      </div>
    </div>
  )
}

/* clickable status badge with a dropdown (activo/pausado/entregado).
   `compact` = variante de la card de proyecto: sin pastilla, solo el punto (que
   late si el proyecto está activo) + la etiqueta. El chevron aparece en hover
   para que se note que es un menú sin ensuciar la card en reposo. */
function StatusMenu({ status, onChange, compact = false }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const meta = projStatusMeta(status)
  const menuW = 150, menuH = PROJECT_STATUS.length * 38 + 12
  const toggle = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const down = r.bottom + menuH <= window.innerHeight
      setPos({ left: Math.max(8, r.right - menuW), top: down ? r.bottom + 4 : Math.max(8, r.top - menuH - 4) })
    }
    setOpen((v) => !v)
  }
  return (
    <span style={{ display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      {compact ? (
        <button ref={btnRef} onClick={toggle} className="pj-status" title="Cambiar estado" aria-haspopup="menu" aria-expanded={open}>
          <span className={`pj-dot${status === 'active' ? ' live' : ''}`} style={{ background: meta.dot }} />
          {meta.label}
          <I2.chevD className="cv" width={10} height={10} style={{ color: 'var(--text-faint)' }} />
        </button>
      ) : (
      <button ref={btnRef} onClick={toggle} title="Cambiar estado">
        <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text)', background: 'var(--bg-elevated)', borderColor: 'var(--border)', cursor: 'pointer' }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: meta.dot, flexShrink: 0 }} />
          {meta.label}<I2.chevD width={11} height={11} style={{ marginLeft: 1, color: 'var(--text-faint)' }} />
        </span>
      </button>
      )}
      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 201, padding: 5, minWidth: menuW, boxShadow: 'var(--shadow)' }}>
            {PROJECT_STATUS.map((o) => (
              <button key={o.key} className="row-hover" onClick={(e) => { e.stopPropagation(); onChange(o.key); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: o.key === status ? 'var(--accent)' : 'var(--text)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: o.dot, flexShrink: 0 }} />{o.label}
                {o.key === status && <I2.check width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </span>
  )
}

/* banderita de prioridad de proyecto (roja/amarilla/celeste) con dropdown */
function PriorityMenu({ value, onChange, size = 16 }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const meta = projPrioMeta(value)
  const menuH = PROJECT_PRIORITY.length * 38 + 12
  const toggle = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const down = r.bottom + menuH <= window.innerHeight
      setPos({ left: Math.max(8, r.right - 150), top: down ? r.bottom + 4 : Math.max(8, r.top - menuH - 4) })
    }
    setOpen((v) => !v)
  }
  return (
    <span style={{ display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} onClick={toggle} title={`Prioridad: ${meta.label}`} style={{ display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 8 }} className="row-hover">
        <I2.flag width={size} height={size} style={{ color: meta.color }} />
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 201, padding: 5, minWidth: 150, boxShadow: 'var(--shadow)' }}>
            <div className="label" style={{ padding: '4px 9px 6px' }}>Prioridad</div>
            {PROJECT_PRIORITY.map((o) => (
              <button key={o.key} className="row-hover" onClick={(e) => { e.stopPropagation(); onChange(o.key); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: o.key === value ? 'var(--accent)' : 'var(--text)' }}>
                <I2.flag width={15} height={15} style={{ color: o.color, flexShrink: 0 }} />{o.label}
                {o.key === value && <I2.check width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </span>
  )
}

/* Testing + WhatsApp links on a card, with an inline pencil editor */
function CardLinks({ project, onSave }) {
  const [editing, setEditing] = useState(false)
  const [t, setT] = useState('')
  const [w, setW] = useState('')
  const testing = project.testingUrl || project.productionUrl || ''
  const wa = project.whatsappUrl || ''
  const openEdit = (e) => { e.stopPropagation(); setT(project.testingUrl || project.productionUrl || ''); setW(project.whatsappUrl || ''); setEditing(true) }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
      <a href={testing || undefined} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); if (!testing) e.preventDefault() }}
        className="btn btn-sm" title="Abrir testing / deploy" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', opacity: testing ? 1 : 0.45 }}><I2.ext width={14} height={14} /></a>
      <a href={wa || undefined} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); if (!wa) e.preventDefault() }}
        className="btn btn-sm" style={{ justifyContent: 'center', color: wa ? 'var(--green)' : undefined, opacity: wa ? 1 : 0.45 }}><I2.whatsapp width={14} height={14} /> WhatsApp</a>
      <button className="btn btn-sm" onClick={openEdit} title="Editar links" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center' }}><I2.pencil width={14} height={14} /></button>
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar links del proyecto" sub={project.name} width={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Testing / Deploy URL (Render, Vercel…)"><input className="input" value={t} onChange={(e) => setT(e.target.value)} placeholder="https://mi-app.onrender.com" /></Field>
          <Field label="Grupo de WhatsApp"><input className="input" value={w} onChange={(e) => setW(e.target.value)} placeholder="https://chat.whatsapp.com/..." /></Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => { onSave({ testingUrl: t, whatsappUrl: w }); setEditing(false) }}><I2.check width={15} height={15} /> Guardar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* editor de la tarjeta del proyecto: links (testing/whatsapp) + qué accesos mostrar en la card */
function CardConfigModal({ open, project, onClose, onSave }) {
  const [t, setT] = useState('')
  const [w, setW] = useState('')
  const [show, setShow] = useState({ scope: true, testing: true, whatsapp: true })
  useEffect(() => {
    if (open && project) {
      setT(project.testingUrl || project.productionUrl || '')
      setW(project.whatsappUrl || '')
      setShow({ scope: true, testing: true, whatsapp: true, ...(project.cardActions || {}) })
    }
  }, [open, project && project.id])
  if (!project) return <Modal open={open} onClose={onClose} title="Tarjeta" />
  const Toggle = ({ k, label, sub, Ico }) => (
    <button onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))} className="row-hover"
      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 11, border: '1px solid var(--border)', background: show[k] ? 'var(--accent-soft)' : 'var(--bg-elevated)', width: '100%', textAlign: 'left' }}>
      <Ico width={17} height={17} style={{ color: show[k] ? 'var(--accent)' : 'var(--text-faint)', flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>{sub && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-faint)' }}>{sub}</span>}</span>
      <span style={{ width: 38, height: 22, borderRadius: 99, background: show[k] ? 'var(--accent)' : 'var(--border-strong)', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: show[k] ? 18 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  )
  return (
    <Modal open={open} onClose={onClose} title="Editar tarjeta" sub={project.name} width={470}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Testing / Deploy URL (Render, Vercel…)"><input className="input" value={t} onChange={(e) => setT(e.target.value)} placeholder="https://mi-app.onrender.com" /></Field>
        <Field label="Grupo de WhatsApp"><input className="input" value={w} onChange={(e) => setW(e.target.value)} placeholder="https://chat.whatsapp.com/..." /></Field>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Accesos visibles en la tarjeta</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Toggle k="scope" label="Alcance" sub="PDFs, contexto, calls y notas" Ico={I2.pdf} />
            <Toggle k="testing" label="Testing / deploy" sub="Abre la URL de la app" Ico={I2.gear} />
            <Toggle k="whatsapp" label="WhatsApp" sub="Grupo del cliente" Ico={I2.whatsapp} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => { onSave({ testingUrl: t, whatsappUrl: w, cardActions: show }); onClose() }}><I2.check width={15} height={15} /> Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

/* inline "add task" input reutilizable (tareas del equipo y del cliente) */
function AddTaskInput({ onAdd }) {
  const [v, setV] = useState('')
  const submit = () => { const t = v.trim(); if (!t) return; onAdd(t); setV('') }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input className="input" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} placeholder="Agregar tarea…" style={{ padding: '7px 10px', fontSize: 13 }} />
      <button className="btn btn-sm" onClick={submit}><I2.plus width={13} height={13} /> Agregar</button>
    </div>
  )
}

/* full project editor (meta · URLs · financials) */
/* Errores de los campos de mantenimiento, EXPLICADOS. Un input rojo mudo no dice
   por qué el 31 no sirve; el texto sí. Devuelve {} cuando está todo bien. */
function maintenanceErrors(lc) {
  const e = {}
  const raw = lc || {}

  const amt = raw.maintenanceAmount
  if (amt !== null && amt !== undefined && String(amt).trim() !== '') {
    const n = Number(amt)
    if (!Number.isFinite(n)) e.maintenanceAmount = 'Escribí solo el número, sin símbolos ni texto. Por ejemplo: 250'
    else if (n < 0) e.maintenanceAmount = 'El monto no puede ser negativo. Si todavía no se cobra, dejalo vacío.'
  }

  const day = raw.billingDay
  if (day !== null && day !== undefined && String(day).trim() !== '') {
    const n = Number(day)
    if (!Number.isInteger(n)) e.billingDay = 'Tiene que ser un día entero del mes. Por ejemplo: 10'
    else if (n < 1 || n > 28) e.billingDay = 'Elegí un día del 1 al 28: del 29 en adelante no existe en febrero y el cobro se saltearía el mes.'
  }

  const t = Number(raw.trialDays)
  if (!Number.isFinite(t) || !Number.isInteger(t)) e.trialDays = 'Escribí la cantidad de días en número entero. Por ejemplo: 30'
  else if (t < 1) e.trialDays = 'La prueba tiene que durar al menos 1 día.'
  else if (t > 365) e.trialDays = 'Como mucho 365 días. Si va a durar más que un año, ya es mantenimiento.'

  return e
}

/* Ayuda o error debajo de un campo. El error lleva icono y role="alert" para que
   el lector de pantalla lo anuncie sin que el usuario tenga que volver al campo. */
function FieldNote({ error, hint }) {
  if (!error && !hint) return null
  return (
    <span role={error ? 'alert' : undefined}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5, lineHeight: 1.45, marginTop: -1, color: error ? 'var(--red)' : 'var(--text-faint)' }}>
      {error && <I2.alert width={13} height={13} style={{ flex: 'none', marginTop: 1 }} />}
      <span>{error || hint}</span>
    </span>
  )
}

/* Campos que EditProjectModal edita de verdad. El commit del modal escribe SOLO
   estos sobre el proyecto vivo (ver saveProject): el modal snapshotea al abrir y
   nunca resincroniza, así que todo lo que no esté acá —lifecycle.phase, sellos de
   fase, lastNoticeSentAt, activity, avances, comms, clientTasks, chats…— tiene que
   releerse del proyecto actual o guardar pisa el estado que decide cuándo se cobra. */
const PROJECT_FORM_FIELDS = [
  'name', 'stack', 'status', 'priority', 'kind', 'clientId', 'githubRepo',
  'productionUrl', 'testingUrl', 'whatsappUrl', 'driveUrl',
  'totalAmount', 'paidAmount', 'expectedStartDate', 'kickoff',
]
/* Del lifecycle, el formulario solo toca los datos del cobro. La fase y sus
   fechas se mueven desde el detalle con confirmación. */
const PROJECT_FORM_LIFECYCLE_FIELDS = ['maintenanceAmount', 'billingDay', 'trialDays']

function EditProjectModal({ open, project, clients = [], onClose, onSave, onDelete }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    if (open && project) {
      const copy = JSON.parse(JSON.stringify(project))
      copy.lifecycle = normalizeLifecycle(project)   // el proyecto viejo puede no tenerlo
      setD(copy)
    }
  }, [open, project && project.id])
  const set = (k, v) => setD((s) => ({ ...s, [k]: v }))
  const setLc = (k, v) => setD((s) => ({ ...s, lifecycle: { ...(s.lifecycle || {}), [k]: v } }))
  const errs = d ? maintenanceErrors(d.lifecycle) : {}
  const invalid = Object.keys(errs).length > 0
  // Guardar normaliza: los inputs guardan texto y la base espera números.
  const commit = () => { if (invalid) return; onSave({ ...d, lifecycle: normalizeLifecycle(d) }); onClose() }
  return (
    <Modal open={open} onClose={onClose} title="Editar proyecto" sub={d ? d.name : ''} width={780}>
      {d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nombre"><input className="input" value={d.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Stack"><input className="input" value={d.stack || ''} onChange={(e) => set('stack', e.target.value)} /></Field>
            <Field label="Estado">
              <select className="input" value={d.status} onChange={(e) => set('status', e.target.value)}>
                {PROJECT_STATUS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select className="input" value={d.priority || 'normal'} onChange={(e) => set('priority', e.target.value)}>
                {PROJECT_PRIORITY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Tipo de proyecto">
              <select className="input" value={d.kind || 'cliente'} onChange={(e) => { const k = e.target.value; setD((s) => ({ ...s, kind: k, ...(k === 'interno' ? { clientId: '' } : {}) })) }}>
                <option value="cliente">De un cliente</option>
                <option value="interno">Interno (Insights)</option>
              </select>
            </Field>
            <Field label="Cliente">
              {(d.kind || 'cliente') === 'interno'
                ? <input className="input" value="Interno · Insights" disabled style={{ opacity: 0.7 }} />
                : <select className="input" value={d.clientId || ''} onChange={(e) => set('clientId', e.target.value)}>
                    <option value="">— Sin cliente —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>}
            </Field>
            <Field label="GitHub repo (org/repo)"><input className="input mono" value={d.githubRepo || ''} onChange={(e) => set('githubRepo', e.target.value)} /></Field>
            <Field label="URL Producción"><input className="input" value={d.productionUrl || ''} onChange={(e) => set('productionUrl', e.target.value)} /></Field>
            <Field label="Testing / Deploy URL"><input className="input" value={d.testingUrl || ''} onChange={(e) => set('testingUrl', e.target.value)} /></Field>
            <Field label="Grupo de WhatsApp"><input className="input" value={d.whatsappUrl || ''} onChange={(e) => set('whatsappUrl', e.target.value)} /></Field>
            <Field label="Carpeta de Drive (compartida con el cliente)"><input className="input" value={d.driveUrl || ''} onChange={(e) => set('driveUrl', e.target.value)} placeholder="https://drive.google.com/…" /></Field>
            <Field label="Contrato total (USD)"><input className="input mono" type="number" value={d.totalAmount} onChange={(e) => set('totalAmount', Number(e.target.value))} /></Field>
            <Field label="Cobrado / pagado (USD)"><input className="input mono" type="number" value={d.paidAmount} onChange={(e) => set('paidAmount', Number(e.target.value))} /></Field>
            <Field label="Ingreso estimado (si está pendiente)"><input className="input mono" type="date" value={(d.expectedStartDate || '').slice(0, 10)} onChange={(e) => set('expectedStartDate', e.target.value)} /></Field>
          </div>
          <Field label="Kick-off"><textarea className="input" rows={3} value={d.kickoff || ''} onChange={(e) => set('kickoff', e.target.value)} /></Field>

          {/* CICLO DE VIDA — lo único editable a mano. La fase se mueve desde el
              detalle con confirmación, porque sella una fecha que después factura. */}
          <div className="pd-panel" style={{ padding: '14px 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <I2.phase3 width={15} height={15} style={{ color: 'var(--blue)' }} />
              <strong style={{ fontSize: 13.5 }}>Prueba y mantenimiento</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.55, marginBottom: 13 }}>
              Los datos del cobro. La fase del proyecto se cambia desde el detalle, con confirmación.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
              <Field label="Monto mensual (USD)">
                <input className="input mono" inputMode="decimal" placeholder="Todavía sin definir"
                  aria-invalid={!!errs.maintenanceAmount}
                  value={d.lifecycle?.maintenanceAmount ?? ''}
                  onChange={(e) => setLc('maintenanceAmount', e.target.value === '' ? null : e.target.value)}
                  style={errs.maintenanceAmount ? { borderColor: 'var(--red)' } : undefined} />
                <FieldNote error={errs.maintenanceAmount} hint="Lo que se le cobra al cliente cada mes." />
              </Field>
              <Field label="Día de cobro">
                <input className="input mono" inputMode="numeric" placeholder="Ej: 10"
                  aria-invalid={!!errs.billingDay}
                  value={d.lifecycle?.billingDay ?? ''}
                  onChange={(e) => setLc('billingDay', e.target.value === '' ? null : e.target.value)}
                  style={errs.billingDay ? { borderColor: 'var(--red)' } : undefined} />
                <FieldNote error={errs.billingDay} hint="Del 1 al 28, para que exista en todos los meses." />
              </Field>
              <Field label="Días de prueba gratis">
                <input className="input mono" inputMode="numeric"
                  aria-invalid={!!errs.trialDays}
                  value={d.lifecycle?.trialDays ?? ''}
                  onChange={(e) => setLc('trialDays', e.target.value === '' ? '' : e.target.value)}
                  style={errs.trialDays ? { borderColor: 'var(--red)' } : undefined} />
                <FieldNote error={errs.trialDays} hint="Cuánto dura la fase 2 antes de empezar a cobrar." />
              </Field>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            {onDelete ? <button className="btn" onClick={() => { if (window.confirm(`¿Eliminar el proyecto "${d.name}"? Se borra su registro y sus datos. No se puede deshacer.`)) { onDelete(d.id); onClose() } }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I2.trash width={15} height={15} /> Eliminar proyecto</button> : <span />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {invalid && <span style={{ fontSize: 11.5, color: 'var(--red)' }}>Revisá los campos marcados para poder guardar.</span>}
              <button className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn btn-accent" onClick={commit} disabled={invalid}
                style={invalid ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}><I2.check width={15} height={15} /> Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
function Progress({ value, height = 8, showLabel = false, color }) {
  const c = color || progressColor(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
      <div style={{ flex: 1, height, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${clamp(value, 0, 100)}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: c, borderRadius: 999 }} />
      </div>
      {showLabel && <span className="mono" style={{ fontSize: 12, color: c, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>{value}%</span>}
    </div>
  )
}

/* ============================================================================
   9b · TEAM AVATARS + ASSIGNMENT  ·  TAGS
============================================================================ */
const TAG_COLORS = [
  { key: 'verde', hex: '#22C55E' }, { key: 'azul', hex: '#3B82F6' }, { key: 'naranja', hex: '#F97316' },
  { key: 'rojo', hex: '#EF4444' }, { key: 'gris', hex: '#6B7280' }, { key: 'violeta', hex: '#8B5CF6' },
]

/* resize/crop an image file to a small square JPEG data URL (keeps the JSON doc light) */
function fileToAvatarDataURL(file, max = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2, sy = (img.height - side) / 2
        const out = Math.min(side, max)
        const canvas = document.createElement('canvas')
        canvas.width = out; canvas.height = out
        canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, out, out)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function Avatar({ user, size = 28, ring = 'var(--card)', title, onClick, badge, empty }) {
  const common = { width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: Math.round(size * 0.4), flexShrink: 0, position: 'relative', cursor: onClick ? 'pointer' : 'default', lineHeight: 1, padding: 0, overflow: 'hidden' }
  const Tag = onClick ? 'button' : 'div'   // avoid <button> nested inside <button>
  if (empty || !user) {
    return (
      <Tag title={title || 'Asignar'} onClick={onClick} style={{ ...common, background: 'var(--bg-elevated)', border: `2px dashed var(--border-strong)`, color: 'var(--text-faint)' }}>
        <I2.plus width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} />
      </Tag>
    )
  }
  const bg = user.photo ? `center / cover no-repeat url(${user.photo})` : user.color
  return (
    <Tag title={title} onClick={onClick} style={{ ...common, background: bg, border: `2px solid ${ring}`, color: '#fff' }}>
      {!user.photo && user.initials}
      {badge}
    </Tag>
  )
}

/* dropdown to assign a user to a slot (pm/dev) — shows ALL users, role label editable.
   Se renderiza en un portal (position:fixed) para que quede por encima de las cards y no se superponga. */
function AssignMenu({ slot, assignment, team, onChange, onClose, pos }) {
  const [q, setQ] = useState('')
  const dft = slot === 'pm' ? 'Project Manager' : 'Developer'
  const [label, setLabel] = useState(assignment?.roleLabel || dft)
  const filtered = team.filter((u) => u.name.toLowerCase().includes(q.toLowerCase().trim()))
  const pick = (userId) => { onChange({ userId, roleLabel: (label || dft).trim() }); onClose() }
  return createPortal(
    <>
      <div onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
      <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 301, width: 248, padding: 10, boxShadow: 'var(--shadow)' }}>
        <div className="label" style={{ marginBottom: 8 }}>Asignar {slot === 'pm' ? 'PM' : 'Dev'}</div>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rol (ej: Lead Dev, Tech Lead…)" style={{ padding: '7px 9px', fontSize: 12.5, marginBottom: 7 }} />
        <div style={{ position: 'relative', marginBottom: 7 }}>
          <I2.search width={13} height={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-faint)' }} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona…" style={{ padding: '7px 9px 7px 28px', fontSize: 12.5 }} autoFocus />
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map((u) => (
            <button key={u.id} className="row-hover" onClick={() => pick(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 7px', borderRadius: 8, width: '100%', textAlign: 'left' }}>
              <Avatar user={u} size={24} ring="var(--card)" />
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{u.name}</span>
              {assignment?.userId === u.id && <I2.check width={14} height={14} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
          {filtered.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', padding: '6px 7px' }}>Sin resultados</div>}
        </div>
        {assignment && (
          <button className="btn btn-sm btn-ghost" onClick={() => { onChange(null); onClose() }} style={{ marginTop: 8, color: 'var(--red)', width: '100%', justifyContent: 'center' }}>
            <I2.x width={13} height={13} /> Quitar asignación
          </button>
        )}
      </div>
    </>,
    document.body
  )
}

/* overlapping PM + Dev avatars (GitHub-style). Same user in both slots → single avatar + PM·DEV badge */
function TeamAvatars({ assignments, team, onChange, size = 28, ring = 'var(--card)' }) {
  const [menu, setMenu] = useState(null)      // 'pm' | 'dev' | null
  const [dual, setDual] = useState(false)     // mini chooser when same user fills both slots
  const [anchor, setAnchor] = useState(null)  // rect del avatar clickeado, para posicionar el portal
  const a = assignments || { pm: null, dev: null }
  const userById = (id) => team.find((u) => u.id === id)
  const pmU = a.pm ? userById(a.pm.userId) : null
  const devU = a.dev ? userById(a.dev.userId) : null
  const same = a.pm && a.dev && a.pm.userId === a.dev.userId
  const setSlot = (slot, val) => onChange({ ...a, [slot]: val })
  // ubica el menú (fixed) debajo del avatar, o arriba si no entra; clamp al viewport
  const place = (h, w = 248) => {
    if (!anchor) return { left: 8, top: 8 }
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - w - 8)
    const down = anchor.bottom + h <= window.innerHeight
    return { left, top: down ? anchor.bottom + 6 : Math.max(8, anchor.top - h - 6) }
  }
  const capture = (e) => { const r = e.currentTarget.getBoundingClientRect(); setAnchor({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }) }
  const openSlot = (slot, e) => { e.stopPropagation(); if (menu === slot) { setMenu(null); return } capture(e); setDual(false); setMenu(slot) }
  const openDual = (e) => { e.stopPropagation(); if (dual) { setDual(false); return } capture(e); setMenu(null); setDual(true) }
  const dbadge = (
    <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', fontSize: 7.5, fontWeight: 800, letterSpacing: '.02em', padding: '1px 4px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: '1.5px solid ' + ring, whiteSpace: 'nowrap', lineHeight: 1.3 }}>PM·DEV</span>
  )
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {same ? (
          <span style={{ position: 'relative' }}>
            <Avatar user={pmU} size={size} ring={ring} title={`${a.pm.roleLabel} + ${a.dev.roleLabel}: ${pmU?.name}`} onClick={openDual} badge={dbadge} />
          </span>
        ) : (
          <>
            <span style={{ position: 'relative', zIndex: 2 }}>
              <Avatar user={pmU} size={size} ring={ring} empty={!pmU} title={pmU ? `${a.pm.roleLabel}: ${pmU.name}` : 'Asignar PM'} onClick={(e) => openSlot('pm', e)} />
            </span>
            <span style={{ position: 'relative', zIndex: 1, marginLeft: Math.round(size * 0.28) }}>
              <Avatar user={devU} size={size} ring={ring} empty={!devU} title={devU ? `${a.dev.roleLabel}: ${devU.name}` : 'Asignar Dev'} onClick={(e) => openSlot('dev', e)} />
            </span>
          </>
        )}
      </div>

      {/* mini chooser para el caso mismo-usuario (portal, por encima de todo) */}
      {dual && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setDual(false) }} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', ...place(100, 200), zIndex: 301, padding: 6, minWidth: 180, boxShadow: 'var(--shadow)' }}>
            {['pm', 'dev'].map((slot) => (
              <button key={slot} className="row-hover" onClick={() => { setDual(false); setMenu(slot) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 30 }}>{slot.toUpperCase()}</span>
                <span style={{ color: 'var(--text-dim)' }}>{a[slot].roleLabel}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {menu && (
        <AssignMenu slot={menu} assignment={a[menu]} team={team} onChange={(val) => setSlot(menu, val)} onClose={() => setMenu(null)} pos={place(360)} />
      )}
    </div>
  )
}

/* editable project tags: hover ✕ to remove, + to add, click to edit (text + color) */
function ProjectTags({ tags, onChange, size = 'sm' }) {
  const list = tags || []
  const [editId, setEditId] = useState(null)   // tag id being edited, or 'new'
  const [hoverId, setHoverId] = useState(null)
  const [text, setText] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0].hex)

  const startNew = () => { setText(''); setColor(TAG_COLORS[0].hex); setEditId('new') }
  const startEdit = (t) => { setText(t.text); setColor(t.color); setEditId(t.id) }
  const close = () => setEditId(null)
  const save = () => {
    const v = text.trim()
    if (!v) return close()
    if (editId === 'new') onChange([...list, { id: uid(), text: v, color }])
    else onChange(list.map((t) => (t.id === editId ? { ...t, text: v, color } : t)))
    close()
  }
  const remove = (id) => onChange(list.filter((t) => t.id !== id))

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      {list.map((t) => (
        <span key={t.id} onMouseEnter={() => setHoverId(t.id)} onMouseLeave={() => setHoverId(null)}
          onClick={() => startEdit(t)} title="Editar etiqueta"
          className="tag" style={{ cursor: 'pointer', color: t.color, background: t.color + '22', borderColor: t.color + '55', paddingRight: hoverId === t.id ? 4 : 9 }}>
          {t.text}
          {hoverId === t.id && (
            <span onClick={(e) => { e.stopPropagation(); remove(t.id) }} title="Eliminar" style={{ display: 'inline-flex', marginLeft: 1 }}>
              <I2.x width={11} height={11} />
            </span>
          )}
        </span>
      ))}
      <button onClick={startNew} title="Agregar etiqueta" className="tag" style={{ cursor: 'pointer', color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderColor: 'var(--border)', padding: '3px 6px' }}>
        <I2.plus width={11} height={11} />
      </button>

      {editId && (
        <>
          <div onClick={(e) => { e.stopPropagation(); close() }} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '120%', left: 0, zIndex: 70, padding: 12, width: 230, boxShadow: 'var(--shadow)' }}>
            <div className="label" style={{ marginBottom: 7 }}>{editId === 'new' ? 'Nueva etiqueta' : 'Editar etiqueta'}</div>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }} placeholder="Texto" autoFocus style={{ padding: '7px 9px', fontSize: 13, marginBottom: 9 }} />
            <div style={{ display: 'flex', gap: 7, marginBottom: 11 }}>
              {TAG_COLORS.map((c) => (
                <button key={c.key} title={c.key} onClick={() => setColor(c.hex)} style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, border: color === c.hex ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={close}>Cancelar</button>
              <button className="btn btn-sm btn-accent" onClick={save}><I2.check width={13} height={13} /> Guardar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ============================================================================
   10 · GITHUB COMMIT CHIP
============================================================================ */
function CommitChip({ repo, compact }) {
  const { loading, data, error } = useGithubCommit(repo)
  if (loading) return <span className="skel" style={{ display: 'inline-block', width: compact ? 90 : 150, height: 14 }} />
  if (error) return <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{repo ? `git: ${error}` : 'sin repo'}</span>
  const d = daysAgo(data.date)
  const stale = d > 7
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-dim)', minWidth: 0 }}>
      <I2.github width={13} height={13} style={{ flexShrink: 0 }} />
      <span className="mono" style={{ color: 'var(--text)' }}>{data.sha}</span>
      {!compact && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{data.message}</span>}
      <span className="tag" style={{ color: stale ? 'var(--red)' : 'var(--green)', background: stale ? 'var(--red-soft)' : 'var(--green-soft)', padding: '1px 7px', fontSize: 10 }}>
        {d === 0 ? 'hoy' : `${d}d`}{stale && ' ⚠'}
      </span>
    </span>
  )
}

/* alta de un proyecto nuevo: cliente + WhatsApp + testing (opcional). El plan se asocia luego dentro de la tarjeta. */
function NewProjectModal({ open, clients, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('cliente')
  const [clientId, setClientId] = useState('')
  const [wa, setWa] = useState('')
  const [testing, setTesting] = useState('')
  useEffect(() => { if (open) { setName(''); setKind('cliente'); setClientId((clients[0] && clients[0].id) || ''); setWa(''); setTesting('') } }, [open])
  const canCreate = name.trim() && (kind === 'interno' || clientId)
  const create = () => { if (!canCreate) return; onCreate({ name: name.trim(), kind, clientId, whatsappUrl: wa.trim(), testingUrl: testing.trim() }) }
  const kindBtn = (k, label, Icon) => (
    <button type="button" onClick={() => setKind(k)} className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', background: kind === k ? 'var(--accent-soft)' : 'transparent', color: kind === k ? 'var(--accent)' : 'var(--text-dim)', borderColor: kind === k ? 'var(--accent-line)' : 'var(--border)' }}>{Icon}{label}</button>
  )
  return (
    <Modal open={open} onClose={onClose} title="Nuevo proyecto" sub="Creá la tarjeta; después le asociás el plan adentro" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nombre del proyecto"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Chamber OS" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }} /></Field>
        <Field label="Tipo de proyecto">
          <div style={{ display: 'flex', gap: 8 }}>
            {kindBtn('cliente', 'De un cliente', <I2.users width={14} height={14} />)}
            {kindBtn('interno', 'Interno (Insights)', <span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: 12, marginRight: 2 }}>I</span>)}
          </div>
        </Field>
        {kind === 'cliente' ? (
          <Field label="Cliente">
            <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.length === 0 && <option value="">— No hay clientes cargados —</option>}
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>Proyecto <strong>interno de Insights</strong> (sin cliente). Ej: “20 carruseles de Instagram para la cuenta de Fede”.</div>
        )}
        <Field label="Grupo de WhatsApp"><input className="input" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://chat.whatsapp.com/…" /></Field>
        <Field label="Testing / Deploy URL (opcional)"><input className="input" value={testing} onChange={(e) => setTesting(e.target.value)} placeholder="https://mi-app.onrender.com" /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={create} disabled={!canCreate}><I2.plus width={15} height={15} /> Crear proyecto</button>
        </div>
      </div>
    </Modal>
  )
}

/* ============================================================================
   12 · PROJECTS LIST
============================================================================ */

/* Anillo de avance. El color sale de la FASE, no del porcentaje: el % ya lo dice
   el número del medio, y teñirlo también por porcentaje haría que dos proyectos
   en la misma fase se vean como cosas distintas.
   El trazo se dibuja con una keyframe que arranca en `--ring-c` (circunferencia
   entera) y termina en el dashoffset real del elemento — así no hace falta ni un
   rAF ni un estado extra, y `prefers-reduced-motion` la apaga de una línea. */
function ProgressRing({ pct, colorVar = '--accent', size = 104, stroke = 7 }) {
  const r = (size - stroke) / 2 - 1
  const c = 2 * Math.PI * r
  const value = clamp(Math.round(pct || 0), 0, 100)
  const off = c * (1 - value / 100)
  return (
    <div className="pj-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          className="pj-ringfill" cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`var(${colorVar})`} strokeWidth={stroke} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ '--ring-c': c, strokeDasharray: c, strokeDashoffset: off }}
        />
      </svg>
      <span className="in">
        <span className="pct" style={{ color: value === 0 ? 'var(--text-faint)' : 'var(--text)' }}>{value}%</span>
      </span>
    </div>
  )
}

/* "avance hace 2 d". Sale de project.lastProgressAt, que se actualiza sola al
   tildar tareas del plan. Pasada una semana sin movimiento se tiñe de ámbar:
   es el único dato de la card que puede pedir atención. */
function lastAdvanceInfo(project) {
  const d = daysAgo(project?.lastProgressAt)
  if (d == null) return { text: 'sin avances', stale: false, none: true }
  if (d === 0) return { text: 'hoy', stale: false }
  if (d === 1) return { text: 'ayer', stale: false }
  return { text: `hace ${d} d`, stale: d > 7 }
}

/* Texto del contador de fase: "62 días · desarrollo". El número grande va con el
   color de la fase para que lea junto al anillo. */
function phaseCounter(info) {
  const label = (info.label || '').toLowerCase()
  if (info.phase === 1) return { n: info.days == null ? null : info.days + 1, unit: 'días', label }
  if (info.phase === 2) {
    if (info.expired) return { n: null, unit: 'prueba vencida', label: '' }
    return { n: info.countdown, unit: 'días de prueba', label: '' }
  }
  // Fase 3 sin día de cobro cargado: no hay número que mostrar, y "días · cobro"
  // suelto no dice nada. Se pide el dato que falta.
  if (info.countdown == null) return { n: null, unit: 'definir día de cobro', label: '' }
  return { n: info.countdown, unit: info.countdown === 1 ? 'día · cobro' : 'días · cobro', label: '' }
}

function ProjectCard({ project: p, client, team, pct, onOpen, onStatus, onAssign, onScope, onLinks, onPending }) {
  const info = phaseInfo(p)
  const adv = lastAdvanceInfo(p)
  const counter = phaseCounter(info)
  const show = { scope: true, testing: true, whatsapp: true, ...(p.cardActions || {}) }
  const testingUrl = p.testingUrl || p.productionUrl || ''
  const waUrl = p.whatsappUrl || ''
  const stop = (e) => e.stopPropagation()
  // La card entera abre el detalle; con teclado es un botón más (Enter / Espacio).
  const onKey = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
  }
  return (
    <motion.div
      variants={rise} className="pj-card" role="button" tabIndex={0}
      onClick={onOpen} onKeyDown={onKey}
      aria-label={`Abrir ${p.name}`}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', minHeight: 24 }}>
        <StatusMenu compact status={p.status} onChange={onStatus} />
      </div>

      {/* el anillo mide avance, no fase: va siempre en verde. La fase se lee en el
          texto de abajo ("32 días · desarrollo"), donde sí lleva su color. */}
      <ProgressRing pct={pct} colorVar="--green" />

      <div style={{ marginTop: 12, width: '100%' }}>
        <div className="nm" title={p.name}>{p.name}</div>
      </div>

      {p.status === 'pending' && (
        <div style={{ marginTop: 9 }} onClick={(e) => { stop(e); onPending() }}>
          {p.expectedStartDate
            ? <PendingDateChip date={p.expectedStartDate} style={{ cursor: 'pointer' }} />
            : <span className="tag click" style={{ color: 'var(--blue)', background: 'transparent', borderColor: 'var(--blue)' }}><I2.calendar width={12} height={12} /> Definir ingreso</span>}
        </div>
      )}

      <div className="pj-line">
        <span title={info.countdownLabel} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
          {counter.n != null && <b style={{ color: `var(${info.colorVar})` }}>{counter.n}</b>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {counter.unit}{counter.label ? ` · ${counter.label}` : ''}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flex: 'none' }}>
          {!adv.none && 'avance'}
          <b style={{ fontSize: 11.5, color: adv.stale ? 'var(--yellow)' : 'var(--text-dim)' }}>{adv.text}</b>
        </span>
      </div>

      <div className="pj-foot">
        <TeamAvatars assignments={p.assignments} team={team} onChange={onAssign} size={22} ring="var(--card)" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={stop}>
          {show.scope && (
            <button className="pj-ib scope" title="Alcance · PDFs, contexto, notas" onClick={(e) => { stop(e); onScope() }}>
              <I2.pdf width={16} height={16} />
            </button>
          )}
          {show.testing && (
            testingUrl
              ? <a className="pj-ib" href={testingUrl} target="_blank" rel="noreferrer" title="Testing / deploy" onClick={stop}><I2.ext width={15} height={15} /></a>
              : <button className="pj-ib off" title="Sin link de testing — clic para cargarlo" onClick={(e) => { stop(e); onLinks() }}><I2.ext width={15} height={15} /></button>
          )}
          {show.whatsapp && (
            waUrl
              ? <a className="pj-ib wa" href={waUrl} target="_blank" rel="noreferrer" title="Grupo de WhatsApp" onClick={stop}><I2.whatsapp width={15} height={15} /></a>
              : <button className="pj-ib wa off" title="Sin grupo de WhatsApp — clic para cargarlo" onClick={(e) => { stop(e); onLinks() }}><I2.whatsapp width={15} height={15} /></button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* <select> nativo (accesible, teclado intacto) con el chevron dibujado aparte y
   la pastilla encendida en naranja cuando el filtro está aplicado.
   `block` = variante para el panel de filtros: ocupa el ancho de su columna y
   lleva su propia etiqueta arriba, así que no repite el título adentro. */
function FilterSelect({ value, onChange, active, title, block = false, children }) {
  const id = useMemo(() => 'flt-' + Math.random().toString(36).slice(2, 8), [])
  const sel = (
    <span className="pj-selw" style={block ? { width: '100%' } : undefined}>
      <select id={id} className={`pj-sel${block ? ' blk' : ''}`} data-on={active ? '1' : '0'} title={title}
        aria-label={block ? undefined : title} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <I2.chevD width={13} height={13} />
    </span>
  )
  if (!block) return sel
  return <div className="fld"><label htmlFor={id}>{title}</label>{sel}</div>
}

/* Panel de filtros: un solo disparador en la barra en lugar de seis <select>
   sueltos comiéndose una franja entera. Adentro siguen siendo <select> nativos
   —mismas opciones, mismo teclado, misma sincronización con la URL—; lo que
   cambia es que solo aparecen cuando los pedís, y lo que queda a la vista son
   los filtros efectivamente aplicados, cada uno descartable de a uno.
   Teclado: abre/cierra con Enter o Espacio, atrapa el foco mientras está
   abierto, cierra con Escape (devolviendo el foco al botón) y con clic afuera. */
function FilterPanel({ count, onClear, children }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)

  const close = useCallback((refocus) => {
    setOpen(false)
    if (refocus && btnRef.current) btnRef.current.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const focusables = () => [...(popRef.current?.querySelectorAll('select,button,a[href],input') || [])]
      .filter((el) => !el.disabled && el.offsetParent !== null)
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return }
      if (e.key !== 'Tab') return
      const f = focusables()
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      const el = document.activeElement
      /* el propio contenedor cuenta como "antes del primero": si no, un shift+Tab
         desde el panel recién abierto se escapaba del foco atrapado. */
      const atStart = el === first || el === popRef.current || !popRef.current.contains(el)
      const atEnd = el === last || el === popRef.current || !popRef.current.contains(el)
      if (e.shiftKey && atStart) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && atEnd && el !== popRef.current) { e.preventDefault(); first.focus() }
      else if (!e.shiftKey && el === popRef.current) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    const t = setTimeout(() => { if (popRef.current) popRef.current.focus() }, 30)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      clearTimeout(t)
    }
  }, [open, close])

  return (
    <span className="pj-popwrap" ref={wrapRef}>
      <button ref={btnRef} className="pj-filt" data-on={count > 0 ? '1' : '0'}
        aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Filtros · ${count} filtro${count > 1 ? 's' : ''} aplicado${count > 1 ? 's' : ''}` : 'Filtros · ninguno aplicado'}>
        <I2.filter width={15} height={15} />
        <span aria-hidden="true">Filtros</span>
        <I2.chevD className="cd" width={13} height={13} style={{ opacity: .55 }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={popRef} className="pj-pop" role="dialog" aria-modal="false" aria-label="Filtros de proyectos" tabIndex={-1}
            initial={{ opacity: 0, scale: .97, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97, y: -6 }}
            transition={{ duration: .2, ease: [.32, .72, 0, 1] }}
            style={{ outline: 'none' }}
          >
            <div className="gr">{children}</div>
            <div className="ft">
              <span className="hint">{count > 0 ? `${count} filtro${count > 1 ? 's' : ''} aplicado${count > 1 ? 's' : ''}` : 'Sin filtros aplicados'}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="pj-clear" onClick={onClear} disabled={count === 0}
                  style={count === 0 ? { opacity: .4, cursor: 'default' } : undefined}>
                  <I2.x width={13} height={13} /> Limpiar todo
                </button>
                <button className="pj-clear" onClick={() => close(true)} style={{ color: 'var(--text)' }}>Listo</button>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

function Projects({ onOpenProject }) {
  const { data, myId, logActivity, projectStore, clientStore, botComms, plans, plansReady } = useApp()
  // Los planes llegan DESPUÉS que los proyectos. Si solo esperáramos projectStore,
  // cada card pintaría el % legacy y saltaría al real un instante después.
  const loading = (projectStore ? projectStore.ready === false : false) || plansReady === false
  // Quién soy: el switch "ver todos" solo existe para devs, y apagado ven solo
  // los proyectos donde figuran como dev asignado.
  const me = useMemo(() => (data.team || []).find((u) => u.id === myId) || null, [data.team, myId])
  const showAllToggle = canSeeAllToggle(me)
  const [showAll, setShowAll] = useState(() => {
    try { return localStorage.getItem('pj_show_all') === '1' } catch { return false }
  })
  useEffect(() => { try { localStorage.setItem('pj_show_all', showAll ? '1' : '0') } catch {} }, [showAll])
  // Índice planId → plan, armado una sola vez: el avance de cada tarjeta sale del
  // plan asociado y no queremos un find() por proyecto dentro del map.
  const planById = useMemo(() => {
    const m = new Map()
    for (const pl of (plans || [])) m.set(pl.id, pl)
    return m
  }, [plans])
  const planOf = (p) => (p.planId ? planById.get(p.planId) || null : null)
  const [newOpen, setNewOpen] = useState(false)
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const [tab, setTab] = useState(qp.get('tab') || 'active')
  const [view, setView] = useState('cards')
  const [clientFilter, setClientFilter] = useState(qp.get('client') || 'all')
  const [pmFilter, setPmFilter] = useState(qp.get('pm') || 'all')
  const [devFilter, setDevFilter] = useState(qp.get('dev') || 'all')
  const [tagFilter, setTagFilter] = useState(qp.get('tag') || 'all')
  const [prioFilter, setPrioFilter] = useState(qp.get('prio') || 'all')   // all | sort | alta | normal | baja
  const [kindFilter, setKindFilter] = useState(qp.get('kind') || 'all')   // all | cliente | interno
  const [search, setSearch] = useState('')             // búsqueda en vivo (client-side): nombre, cliente, PM/Dev
  const [pendingFor, setPendingFor] = useState(null)   // id del proyecto al que se le pide fecha de ingreso
  const [logModal, setLogModal] = useState(null)       // { projectId, kind } | null
  const [scopeFor, setScopeFor] = useState(null)       // id del proyecto para abrir Alcance (acceso directo)
  const [cardCfgFor, setCardCfgFor] = useState(null)   // id del proyecto para editar la tarjeta (links + qué mostrar)
  const clientOf = (id) => data.clients.find((c) => c.id === id)
  const userOf = (id) => data.team.find((u) => u.id === id)
  const updateProject = (id, fields) => projectStore.patch(id, (p) => ({ ...p, ...fields }))
  const patchProject = (id, fn) => projectStore.patch(id, fn)
  const updateClient = (id, fields) => clientStore.patch(id, (c) => ({ ...c, ...fields }))
  const setStatus = (id, status) => { updateProject(id, { status }); if (status === 'pending') setPendingFor(id) }
  const createProject = ({ name, clientId, kind, whatsappUrl, testingUrl }) => {
    const id = uid()
    const proj = {
      id, name, clientId: kind === 'interno' ? '' : clientId, kind: kind || 'cliente', status: 'active', priority: 'normal',
      assignments: { pm: null, dev: null }, tags: [],
      avances: [], comms: [], scopeFiles: [], salesLinks: [], scopeNotes: [],
      risks: [], pendingAgency: [], pendingClient: [], chats: [],
      createdAt: new Date().toISOString(),
      testingUrl: testingUrl || '', whatsappUrl: whatsappUrl || '', productionUrl: '',
      totalAmount: 0, paidAmount: 0, lastDeployDate: null, githubRepo: '', kickoff: '', stack: '',
      cardActions: { scope: true, testing: true, whatsapp: true },
    }
    projectStore.create(proj)
    if (logActivity) logActivity({ type: 'project-add', text: `creó el proyecto "${name}"` })
    setNewOpen(false)
    onOpenProject(id)   // abre la tarjeta nueva para asociarle el plan
  }

  // keep filters URL-friendly
  useEffect(() => {
    const p = new URLSearchParams()
    if (tab !== 'active') p.set('tab', tab)
    if (clientFilter !== 'all') p.set('client', clientFilter)
    if (pmFilter !== 'all') p.set('pm', pmFilter)
    if (devFilter !== 'all') p.set('dev', devFilter)
    if (tagFilter !== 'all') p.set('tag', tagFilter)
    if (prioFilter !== 'all') p.set('prio', prioFilter)
    if (kindFilter !== 'all') p.set('kind', kindFilter)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [tab, clientFilter, pmFilter, devFilter, tagFilter, prioFilter, kindFilter])

  // Universo visible ANTES de filtrar: un dev con el switch apagado no ve el
  // resto de la agencia, y por lo tanto los contadores de las pestañas tampoco
  // pueden contarlo — el número tiene que coincidir con lo que hay en pantalla.
  const universe = useMemo(() => visibleProjects(data.projects, me, showAll || !showAllToggle), [data.projects, me, showAll, showAllToggle])
  const hiddenCount = showAllToggle && !showAll ? data.projects.length - universe.length : 0
  const allTags = [...new Set(universe.flatMap((p) => (p.tags || []).map((t) => t.text)))]
  const filtersActive = clientFilter !== 'all' || pmFilter !== 'all' || devFilter !== 'all' || tagFilter !== 'all' || prioFilter !== 'all' || kindFilter !== 'all'
  const clearFilters = () => { setClientFilter('all'); setPmFilter('all'); setDevFilter('all'); setTagFilter('all'); setPrioFilter('all'); setKindFilter('all') }
  /* Lo aplicado se ve como chips: el usuario no tiene que abrir el panel para
     saber qué está filtrando, y saca uno sin tocar los otros. */
  const chips = []
  if (kindFilter !== 'all') chips.push({ id: 'kind', k: 'Tipo', v: kindFilter === 'interno' ? 'Internos' : 'De clientes', off: () => setKindFilter('all') })
  if (clientFilter !== 'all') chips.push({ id: 'client', k: 'Cliente', v: clientOf(clientFilter)?.company || '—', off: () => setClientFilter('all') })
  if (pmFilter !== 'all') chips.push({ id: 'pm', k: 'PM', v: userOf(pmFilter)?.name || '—', off: () => setPmFilter('all') })
  if (devFilter !== 'all') chips.push({ id: 'dev', k: 'Dev', v: userOf(devFilter)?.name || '—', off: () => setDevFilter('all') })
  if (tagFilter !== 'all') chips.push({ id: 'tag', k: 'Etiqueta', v: tagFilter, off: () => setTagFilter('all') })
  if (prioFilter !== 'all') chips.push({ id: 'prio', k: 'Prioridad', v: prioFilter === 'sort' ? 'Prioritarios primero' : prioFilter.charAt(0).toUpperCase() + prioFilter.slice(1), off: () => setPrioFilter('all') })
  const matchesFilters = (p) =>
    (kindFilter === 'all' || (p.kind || 'cliente') === kindFilter) &&
    (clientFilter === 'all' || p.clientId === clientFilter) &&
    (pmFilter === 'all' || p.assignments?.pm?.userId === pmFilter) &&
    (devFilter === 'all' || p.assignments?.dev?.userId === devFilter) &&
    (tagFilter === 'all' || (p.tags || []).some((t) => t.text === tagFilter)) &&
    (prioFilter === 'all' || prioFilter === 'sort' || (p.priority || 'normal') === prioFilter)
  const q = search.trim().toLowerCase()
  const matchesSearch = (p) => {
    if (!q) return true
    const pmU = p.assignments?.pm ? userOf(p.assignments.pm.userId) : null
    const devU = p.assignments?.dev ? userOf(p.assignments.dev.userId) : null
    const hay = [p.name, clientOf(p.clientId)?.company, pmU?.name, devU?.name].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  }
  const keep = (p) => matchesFilters(p) && matchesSearch(p)
  const countFor = (status) => universe.filter((p) => p.status === status && keep(p)).length
  let list = universe.filter((p) => p.status === tab && keep(p))
  if (prioFilter === 'sort') list = [...list].sort((a, b) => projPrioMeta(b.priority).rank - projPrioMeta(a.priority).rank)
  const TABS = [['active', 'Activos'], ['pending', 'Pendiente'], ['paused', 'Pausados'], ['delivered', 'Entregados']]
  const tabLabel = (TABS.find(([k]) => k === tab) || TABS[0])[1].toLowerCase()

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div className="pj-head" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 6 }}>Cartera</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Proyectos</h1>
        </div>
      </div>

      {/* Una sola fila de control: estado, filtros, lo que está aplicado, búsqueda
          y la acción principal. Antes eran tres franjas apiladas. */}
      <div className="pj-bar" style={{ marginBottom: 20 }}>
        <div className="pj-tabs" role="tablist" aria-label="Estado del proyecto">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {tab === k && (
                <motion.span layoutId="pjTabGlide" className="glide"
                  transition={{ type: 'spring', stiffness: 520, damping: 44 }} />
              )}
              <span className="lb">{l}<span className="n">{countFor(k)}</span></span>
            </button>
          ))}
        </div>

        <FilterPanel count={chips.length} onClear={clearFilters}>
          <FilterSelect block title="Tipo" value={kindFilter} onChange={setKindFilter} active={kindFilter !== 'all'}>
            <option value="all">Todos</option>
            <option value="cliente">De clientes</option>
            <option value="interno">Internos (Insights)</option>
          </FilterSelect>
          <FilterSelect block title="Cliente" value={clientFilter} onChange={setClientFilter} active={clientFilter !== 'all'}>
            <option value="all">Todos los clientes</option>
            {data.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </FilterSelect>
          <FilterSelect block title="Project Manager" value={pmFilter} onChange={setPmFilter} active={pmFilter !== 'all'}>
            <option value="all">Cualquier PM</option>
            {data.team.filter((u) => u.role === 'pm').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </FilterSelect>
          <FilterSelect block title="Developer" value={devFilter} onChange={setDevFilter} active={devFilter !== 'all'}>
            <option value="all">Cualquier dev</option>
            {data.team.filter((u) => u.role === 'dev').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </FilterSelect>
          <FilterSelect block title="Etiqueta" value={tagFilter} onChange={setTagFilter} active={tagFilter !== 'all'}>
            <option value="all">Todas</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
          <FilterSelect block title="Prioridad" value={prioFilter} onChange={setPrioFilter} active={prioFilter !== 'all'}>
            <option value="all">Todas</option>
            <option value="sort">Más prioritario primero</option>
            <option value="alta">Alta</option>
            <option value="normal">Normal</option>
            <option value="baja">Baja</option>
          </FilterSelect>
        </FilterPanel>

        {chips.length > 0 && (
          <div className="pj-chips">
            {chips.map((c) => (
              <span key={c.id} className="pj-chip">
                <span className="k">{c.k}</span>
                <span className="v" title={c.v}>{c.v}</span>
                <button onClick={c.off} aria-label={`Quitar filtro ${c.k}: ${c.v}`} title="Quitar este filtro">
                  <I2.x width={12} height={12} />
                </button>
              </span>
            ))}
            {chips.length > 1 && (
              <button className="pj-clear" onClick={clearFilters}>Limpiar todo</button>
            )}
          </div>
        )}

        <label className="pj-search">
          <I2.search width={15} height={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar proyecto" placeholder="Buscar proyecto, cliente o miembro…" />
          {search && <button onClick={() => setSearch('')} title="Limpiar búsqueda" style={{ display: 'flex', padding: 2, color: 'var(--text-faint)' }}><I2.x width={14} height={14} /></button>}
        </label>

        <div className="pj-seg" role="group" aria-label="Modo de vista">
          <button onClick={() => setView('cards')} title="Tarjetas" aria-pressed={view === 'cards'} style={{ padding: '0 10px' }}><I2.cards width={15} height={15} /></button>
          <button onClick={() => setView('table')} title="Tabla" aria-pressed={view === 'table'} style={{ padding: '0 10px' }}><I2.table width={15} height={15} /></button>
        </div>

        {showAllToggle && (
          <button
            className="pj-switch" role="switch" aria-checked={showAll} onClick={() => setShowAll((v) => !v)}
            aria-label="Ver los proyectos de todo el equipo"
            title={showAll ? 'Volver a ver solo tus proyectos' : `Mostrar también los ${hiddenCount} proyectos del resto del equipo`}
          >
            <span className="tr" />
            <I2.eyeAll width={14} height={14} />
            <span aria-hidden="true">Ver equipo</span>
          </button>
        )}

        <button className="pj-cta" onClick={() => setNewOpen(true)} title="Nuevo proyecto">
          Nuevo proyecto
          <i><I2.plus width={15} height={15} /></i>
        </button>
      </div>

      {loading && (
        <div className="pj-grid" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="pj-skel" />)}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="pj-empty">
          <span className="ic"><I2.circleDash width={22} height={22} /></span>
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 600, fontSize: 16, letterSpacing: '-.02em' }}>
            {q ? 'Nada coincide con la búsqueda' : filtersActive ? 'Ningún proyecto pasa estos filtros' : `No hay proyectos ${tabLabel}`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', maxWidth: 380, lineHeight: 1.5 }}>
            {q
              ? <>Probá con otro nombre, o revisá si el proyecto está en otra pestaña.</>
              : filtersActive
                ? <>Sacá alguno de los filtros de arriba para ver más.</>
                : showAllToggle && !showAll && hiddenCount > 0
                  ? <>Hay {hiddenCount} proyectos asignados a otras personas. Prendé «Ver todos los proyectos» para verlos.</>
                  : <>Cuando crees uno va a aparecer acá con su avance y su fase.</>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {q && <button className="btn btn-sm" onClick={() => setSearch('')}>Limpiar búsqueda</button>}
            {filtersActive && <button className="btn btn-sm" onClick={clearFilters}>Quitar filtros</button>}
            {!q && !filtersActive && <button className="pj-cta" onClick={() => setNewOpen(true)} style={{ height: 36 }}>Nuevo proyecto<i><I2.plus width={14} height={14} /></i></button>}
          </div>
        </div>
      )}

      {loading ? null : view === 'cards' ? (
        <motion.div className="pj-grid" variants={stagger} initial="hidden" animate="show">
          {list.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              client={clientOf(p.clientId)}
              team={data.team}
              pct={projectProgress(p, planOf(p))}
              onOpen={() => onOpenProject(p.id)}
              onStatus={(s) => setStatus(p.id, s)}
              onAssign={(assignments) => updateProject(p.id, { assignments })}
              onScope={() => setScopeFor(p.id)}
              onLinks={() => setCardCfgFor(p.id)}
              onPending={() => setPendingFor(p.id)}
            />
          ))}
        </motion.div>
      ) : (
        <div className="surface tbl" style={{ overflow: 'hidden' }}>
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Proyecto', 'Cliente', 'Equipo', 'Estado', 'Avance', 'Últ. comunicación', 'Últ. avance'].map((h) =><th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const cl = clientOf(p.clientId)
                const trackCell = (kind, firstLabel) => {
                  const t = trackInfo(p, kind, kind === 'comm' ? (botComms || {})[p.id] : undefined)
                  const bad = t.overdue
                  const val = t.first ? firstLabel : (t.days === 0 ? 'hoy' : `${t.days}d háb.`)
                  return (
                    <td style={{ padding: '13px 16px' }}>
                      <button onClick={(e) => { e.stopPropagation(); setLogModal({ projectId: p.id, kind }) }} title="Ver / registrar" className="mono row-hover"
                        style={{ fontSize: 12.5, fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 7px', borderRadius: 7, whiteSpace: 'nowrap', color: bad ? 'var(--red)' : t.first ? 'var(--text-faint)' : 'var(--text)' }}>
                        {val}{bad ? ' ⚠' : ''}
                      </button>
                    </td>
                  )
                }
                return (
                  <tr key={p.id} className="row-hover click" onClick={() => onOpenProject(p.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '13px 16px', color: p.kind === 'interno' ? 'var(--accent)' : 'var(--text-dim)' }}>{p.kind === 'interno' ? 'Interno · Insights' : cl?.company}</td>
                    <td style={{ padding: '13px 16px' }}><TeamAvatars assignments={p.assignments} team={data.team} onChange={(assignments) => updateProject(p.id, { assignments })} size={26} ring="var(--card)" /></td>
                    <td style={{ padding: '13px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PriorityMenu value={p.priority} onChange={(v) => updateProject(p.id, { priority: v })} /><StatusMenu status={p.status} onChange={(s) => setStatus(p.id, s)} />{p.status === 'pending' && p.expectedStartDate && <PendingDateChip date={p.expectedStartDate} />}</div></td>
                    <td style={{ padding: '13px 16px', minWidth: 160 }}><Progress value={projectProgress(p, planOf(p))} showLabel /></td>
                    {trackCell('comm', 'Sin primer mensaje')}
                    {trackCell('avance', 'Sin primer avance')}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PendingDatePrompt open={!!pendingFor} project={data.projects.find((p) => p.id === pendingFor)} onClose={() => setPendingFor(null)} onSave={(d) => { updateProject(pendingFor, { expectedStartDate: d }); setPendingFor(null) }} />
      <ProjectLogModal open={!!logModal} kind={logModal?.kind} project={data.projects.find((p) => p.id === logModal?.projectId)} onClose={() => setLogModal(null)} patch={(fn) => patchProject(logModal.projectId, fn)} />
      <ScopeModal open={!!scopeFor} project={data.projects.find((p) => p.id === scopeFor)} onClose={() => setScopeFor(null)} patch={(fn) => patchProject(scopeFor, fn)} />
      <CardConfigModal open={!!cardCfgFor} project={data.projects.find((p) => p.id === cardCfgFor)} onClose={() => setCardCfgFor(null)} onSave={(f) => updateProject(cardCfgFor, f)} />
      <NewProjectModal open={newOpen} clients={data.clients} onClose={() => setNewOpen(false)} onCreate={createProject} />
    </div>
  )
}

/* popup de fecha estimada de ingreso para proyectos pendientes */
function PendingDatePrompt({ open, project, onClose, onSave }) {
  const [date, setDate] = useState('')
  useEffect(() => { if (open) setDate(project?.expectedStartDate ? project.expectedStartDate.slice(0, 10) : '') }, [open, project && project.id])
  return (
    <Modal open={open} onClose={onClose} title="Proyecto pendiente de ingreso" sub={project?.name} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>¿Para cuándo está previsto el ingreso de este proyecto? Lo vas a ver en la tarjeta con un color según qué tan cerca esté.</div>
        <Field label="Fecha estimada de ingreso"><input className="input mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-faint)' }}>
            Vista previa: <PendingDateChip date={date} />
            <span>{(() => { const d = daysUntil(date); return d == null ? '' : d < 0 ? `(hace ${-d}d)` : d === 0 ? '(hoy)' : `(en ${d}d)` })()}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          {date ? <button className="btn" onClick={() => { setDate(''); onSave('') }} style={{ color: 'var(--text-dim)' }}>Quitar fecha</button> : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => onSave(date)}><I2.check width={15} height={15} /> Guardar</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* registro de Último avance / Última comunicación: entradas con texto + capturas + días hábiles */
/* selector de persona (para corregir/asignar quién registró algo) */
function PersonPicker({ value, team, onChange, size = 22, placeholder = 'Alguien' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const u = team.find((x) => x.id === value)
  const toggle = (e) => { e.stopPropagation(); if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ left: Math.min(Math.max(8, r.left), window.innerWidth - 228), top: r.bottom + 6 }) } setOpen((v) => !v) }
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <button ref={btnRef} onClick={toggle} className="row-hover" title="Cambiar quién lo registró" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '2px 6px', borderRadius: 8 }}>
        {u ? <Avatar user={u} size={size} ring="var(--bg-elevated)" /> : <Avatar empty size={size} ring="var(--bg-elevated)" />}
        <span style={{ fontSize: 12.5, fontWeight: 600, color: u ? 'var(--text)' : 'var(--text-faint)' }}>{u ? u.name : placeholder}</span>
        <I2.chevD width={11} height={11} style={{ color: 'var(--text-faint)' }} />
      </button>
      {open && pos && createPortal(<>
        <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
        <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 301, width: 220, padding: 6, boxShadow: 'var(--shadow)', maxHeight: 280, overflowY: 'auto' }}>
          <div className="label" style={{ padding: '4px 8px 6px' }}>Quién lo registró</div>
          {team.map((x) => (
            <button key={x.id} className="row-hover" onClick={() => { onChange(x.id); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 8 }}>
              <Avatar user={x} size={22} ring="var(--card)" /><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{x.name}</span>{value === x.id && <I2.check width={14} height={14} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      </>, document.body)}
    </span>
  )
}

/* una entrada del historial de avance/comunicación: autor editable + reacciones + respuestas */
const LOG_EMOJIS = ['👍', '❤️', '😂', '🎉', '✅']
function LogEntry({ entry, team, myId, projectName, onUpdate, onDelete, logActivity }) {
  const [picker, setPicker] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const userOf = (id) => team.find((u) => u.id === id)
  const reactions = entry.reactions || {}
  const me = myId || 'anon'
  const notify = (verb) => { if (entry.authorId && entry.authorId !== myId && logActivity) logActivity({ type: 'reply', text: `${verb} tu registro en ${projectName}`, targetId: entry.authorId }) }
  const react = (em) => {
    const next = { ...reactions }
    const arr = next[em] || []
    const has = arr.includes(me)
    next[em] = has ? arr.filter((x) => x !== me) : [...arr, me]
    if (!next[em].length) delete next[em]
    onUpdate(entry.id, { reactions: next })
    if (!has) notify('reaccionó a')
  }
  const addReply = () => { const t = replyText.trim(); if (!t) return; onUpdate(entry.id, { replies: [...(entry.replies || []), { id: uid(), authorId: myId || '', text: t, date: new Date().toISOString() }] }); setReplyText(''); setReplyOpen(false); notify('respondió') }
  return (
    <div className="surface" style={{ padding: 11, background: 'var(--bg-elevated)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <PersonPicker value={entry.authorId} team={team} onChange={(id) => onUpdate(entry.id, { authorId: id })} />
        <input type="date" className="input mono" title="Editar fecha del registro" value={(entry.date || '').slice(0, 10)} onChange={(e) => onUpdate(entry.id, { date: dateInputISO(e.target.value) })} style={{ width: 'auto', padding: '4px 7px', fontSize: 11, marginLeft: 'auto' }} />
        <button className="btn btn-sm btn-ghost" onClick={() => onDelete(entry.id)} style={{ padding: 3, color: 'var(--text-faint)' }}><I2.x width={12} height={12} /></button>
      </div>
      {entry.text && <MentionText text={entry.text} style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', display: 'block' }} />}
      {(entry.shots || []).length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{entry.shots.map((s, i) => <a key={i} href={s} target="_blank" rel="noreferrer"><img src={s} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} /></a>)}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.entries(reactions).map(([em, arr]) => arr.length > 0 && (
          <button key={em} onClick={() => react(em)} title={arr.map((id) => userOf(id)?.name || 'alguien').join(', ')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer', border: '1px solid ' + (arr.includes(me) ? 'var(--accent-line)' : 'var(--border)'), background: arr.includes(me) ? 'var(--accent-soft)' : 'var(--card)' }}>
            <span>{em}</span><span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{arr.length}</span>
          </button>
        ))}
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button onClick={() => setPicker((v) => !v)} title="Reaccionar" className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: 15, lineHeight: 1 }}>🙂</button>
          {picker && <div className="surface" style={{ position: 'absolute', bottom: '118%', left: 0, zIndex: 5, display: 'flex', gap: 2, padding: 5, boxShadow: 'var(--shadow)' }}>
            {LOG_EMOJIS.map((em) => <button key={em} onClick={() => { react(em); setPicker(false) }} className="row-hover" style={{ fontSize: 18, padding: '3px 5px', borderRadius: 7 }}>{em}</button>)}
          </div>}
        </span>
        <button onClick={() => setReplyOpen((v) => !v)} className="btn btn-sm btn-ghost" style={{ padding: '3px 8px', fontSize: 12, color: 'var(--text-dim)' }}><I2.comment width={12} height={12} /> Responder{(entry.replies || []).length ? ` (${entry.replies.length})` : ''}</button>
      </div>

      {(entry.replies || []).length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {entry.replies.map((r) => { const ru = userOf(r.authorId); return (
            <div key={r.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {ru ? <Avatar user={ru} size={16} ring="var(--bg-elevated)" /> : <Avatar empty size={16} ring="var(--bg-elevated)" />}
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{ru ? ru.name : 'Alguien'}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{fmtDate(r.date)}</span>
                <button onClick={() => onUpdate(entry.id, { replies: entry.replies.filter((x) => x.id !== r.id) })} title="Eliminar respuesta" style={{ marginLeft: 'auto', color: 'var(--text-faint)', display: 'flex', background: 'transparent' }}><I2.x width={11} height={11} /></button>
              </div>
              <MentionText text={r.text} style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.45, display: 'block' }} />
            </div>
          )})}
        </div>
      )}
      {replyOpen && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="input" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReply() } }} placeholder="Responder…" autoFocus style={{ padding: '7px 10px', fontSize: 13 }} />
          <button className="btn btn-sm btn-accent" onClick={addReply}><I2.send width={14} height={14} /></button>
        </div>
      )}
    </div>
  )
}

function ProjectLogModal({ open, kind, project, onClose, patch }) {
  const { data, logActivity, botComms } = useApp()
  const [text, setText] = useState('')
  const [shots, setShots] = useState([])
  const [busy, setBusy] = useState(false)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const fileRef = useRef(null)
  if (!project) return <Modal open={open} onClose={onClose} title="Registro" />
  const clientName = data.clients.find((c) => c.id === project.clientId)?.company || 'el cliente'
  const cfg = kind === 'comm'
    ? { field: 'comms', title: 'Última comunicación', icon: I2.phone, accent: 'var(--blue)', placeholder: 'Ej: hablé con el cliente por WhatsApp, pidió un cambio en…', actText: `registró comunicación con ${clientName}`, unit: 'comunicación', firstLabel: 'Sin primer mensaje', firstMax: 3 }
    : { field: 'avances', title: 'Último avance', icon: I2.folder, accent: 'var(--green)', placeholder: 'Ej: le mandé la v2 con el módulo de pagos para revisar…', actText: `registró un avance en ${project.name}`, unit: 'avance', firstLabel: 'Sin primer avance', firstMax: 7 }
  const entries = project[cfg.field] || []
  const myId = typeof localStorage !== 'undefined' ? localStorage.getItem('my_team_id') : ''
  const userOf = (id) => (data.team || []).find((u) => u.id === id)
  const track = trackInfo(project, kind === 'comm' ? 'comm' : 'avance', kind === 'comm' ? (botComms || {})[project.id] : undefined)
  const overdue = track.overdue

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])]; if (!files.length) return
    setBusy(true)
    for (const f of files) { if (!f.type.startsWith('image/')) continue; try { const url = await fileToImageDataURL(f); setShots((s) => [...s, url]) } catch (err) { /* ignore */ } }
    setBusy(false); e.target.value = ''
  }
  const addEntry = () => {
    const t = text.trim(); if (!t && shots.length === 0) return
    patch((p) => ({ ...p, [cfg.field]: [{ id: uid(), text: t, shots, date: dateInputISO(entryDate), authorId: myId || '' }, ...(p[cfg.field] || [])].sort((a, b) => new Date(b.date) - new Date(a.date)) }))
    if (logActivity) logActivity({ type: kind === 'comm' ? 'comm' : 'avance', text: cfg.actText })
    notifyMentions({ text: t, team: data.team || [], subject: `en un${kind === 'comm' ? 'a comunicación' : ' avance'} de ${project.name}`, logActivity, selfId: myId })
    setText(''); setShots([]); setEntryDate(new Date().toISOString().slice(0, 10))
  }
  const updateEntry = (id, fields) => patch((p) => ({ ...p, [cfg.field]: (p[cfg.field] || []).map((x) => x.id === id ? { ...x, ...fields } : x).sort((a, b) => new Date(b.date) - new Date(a.date)) }))
  const delEntry = (id) => patch((p) => ({ ...p, [cfg.field]: (p[cfg.field] || []).filter((x) => x.id !== id) }))

  return (
    <Modal open={open} onClose={onClose} title={cfg.title} sub={project.name} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="surface" style={{ padding: 14, background: overdue ? 'var(--red-soft)' : 'var(--bg-elevated)', borderColor: overdue ? 'var(--red)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <cfg.icon width={18} height={18} style={{ color: overdue ? 'var(--red)' : cfg.accent }} />
            {track.first
              ? <div style={{ fontSize: 14 }}><strong style={{ color: overdue ? 'var(--red)' : 'var(--text)' }}>{cfg.firstLabel}</strong> <span style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>· máx {cfg.firstMax} días hábiles{track.days != null ? ` (van ${track.days})` : ''}</span></div>
              : <div style={{ fontSize: 14 }}>Último{kind === 'comm' ? 'a' : ''} {cfg.unit}: <strong style={{ color: overdue ? 'var(--red)' : 'var(--text)' }}>{track.days === 0 ? 'hoy' : `hace ${track.days} ${track.days === 1 ? 'día hábil' : 'días hábiles'}`}</strong></div>}
            {overdue && <span className="tag" style={{ marginLeft: 'auto', color: 'var(--red)', background: 'transparent', borderColor: 'var(--red)' }}><I2.alert width={12} height={12} /> {track.first ? 'Mandar primer ' + cfg.unit : 'Reportarse con el cliente'}</span>}
          </div>
        </div>

        {/* nueva entrada */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 7 }}>
            <span className="label">Nuevo registro de {cfg.unit}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-faint)' }}>Fecha:
              <input type="date" className="input mono" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }} />
            </label>
          </div>
          <MentionTextarea rows={3} value={text} onChange={setText} placeholder={cfg.placeholder + ' · @ para etiquetar'} style={{ resize: 'none' }} />
          {shots.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {shots.map((s, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={s} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <button onClick={() => setShots((arr) => arr.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 99, background: 'var(--red)', color: '#fff', display: 'grid', placeItems: 'center' }}><I2.x width={11} height={11} /></button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><I2.paperclip width={14} height={14} /> {busy ? 'Procesando…' : 'Adjuntar capturas'}</button>
            <button className="btn btn-sm btn-accent" onClick={addEntry} style={{ marginLeft: 'auto' }}><I2.check width={14} height={14} /> Registrar {cfg.unit}</button>
          </div>
        </div>

        {/* historial */}
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Historial ({entries.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Sin registros todavía.</div>}
            {entries.map((en) => (
              <LogEntry key={en.id} entry={en} team={data.team || []} myId={myId} projectName={project.name} onUpdate={updateEntry} onDelete={delEntry} logActivity={logActivity} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* pop-up de inicio para el PM: estado de seguimiento de sus proyectos */
function PmStartupAlert({ open, projects, clients, onClose, onOpenProject }) {
  const { botComms } = useApp()
  const clientOf = (id) => clients.find((c) => c.id === id)
  const rows = projects.map((p) => ({ p, av: trackInfo(p, 'avance'), comm: trackInfo(p, 'comm', (botComms || {})[p.id]) }))
    .sort((a, b) => (b.comm.overdue || b.av.overdue ? 1 : 0) - (a.comm.overdue || a.av.overdue ? 1 : 0))
  return (
    <Modal open={open} onClose={onClose} title="Seguimiento de tus clientes" sub="Como PM, tené al día la comunicación y los avances" width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>Recordatorio: si pasaron más de <strong style={{ color: 'var(--text-dim)' }}>3 días hábiles</strong> sin comunicarte, más de <strong style={{ color: 'var(--text-dim)' }}>5 días hábiles</strong> sin un avance (o <strong style={{ color: 'var(--text-dim)' }}>7</strong> sin el primer avance), escribile al cliente para reportar cómo va el proyecto.</div>
        {rows.map(({ p, av, comm }) => {
          const commBad = comm.overdue, avBad = av.overdue
          const fmtD = (t, firstLabel) => t.first ? firstLabel : t.days === 0 ? 'hoy' : `hace ${t.days}d háb.`
          return (
            <div key={p.id} className="surface" style={{ padding: 13, background: commBad || avBad ? 'var(--red-soft)' : 'var(--bg-elevated)', borderColor: commBad || avBad ? 'var(--red)' : 'var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onClick={() => { onClose(); onOpenProject(p.id) }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{clientOf(p.clientId)?.company}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12 }}>
                  <span style={{ color: commBad ? 'var(--red)' : 'var(--text-dim)' }}><I2.phone width={11} height={11} /> Comunicación: <strong>{fmtD(comm, 'sin primer mensaje')}</strong></span>
                  <span style={{ color: avBad ? 'var(--red)' : 'var(--text-dim)' }}><I2.folder width={11} height={11} /> Avance: <strong>{fmtD(av, 'sin primer avance')}</strong></span>
                </div>
              </div>
              <a href={p.whatsappUrl || undefined} target="_blank" rel="noreferrer" onClick={(e) => { if (!p.whatsappUrl) e.preventDefault() }}
                className="btn btn-sm" title={p.whatsappUrl ? 'Abrir grupo de WhatsApp' : 'Sin link de WhatsApp cargado'} style={{ color: p.whatsappUrl ? 'var(--green)' : 'var(--text-faint)', opacity: p.whatsappUrl ? 1 : 0.5, flexShrink: 0 }}><I2.whatsapp width={15} height={15} /> WhatsApp</a>
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-accent" onClick={onClose}><I2.check width={15} height={15} /> Entendido</button>
        </div>
      </div>
    </Modal>
  )
}

/* añadir un link (nombre + url) — reutilizable para docs y llamadas de venta */
function LinkAdder({ onAdd, cta = 'Agregar link' }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const submit = () => { const u = url.trim(); if (!u) return; onAdd({ id: uid(), kind: 'link', name: name.trim() || u, url: u, date: NOW().toISOString() }); setName(''); setUrl('') }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" style={{ flex: '1 1 110px', padding: '7px 10px', fontSize: 13 }} />
      <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} placeholder="https://…" style={{ flex: '2 1 200px', padding: '7px 10px', fontSize: 13 }} />
      <button className="btn btn-sm" onClick={submit}><I2.plus width={13} height={13} /> {cta}</button>
    </div>
  )
}

/* CUENTAS del proyecto: checklist de accesos que hacen falta (Supabase, GitHub, Vercel…) */
const ACCOUNT_PRESETS = [
  { label: 'Supabase', color: '#3ecf8e' },
  { label: 'GitHub', color: '#a3adba' },
  { label: 'Vercel', color: '#cbd3dd' },
  { label: 'App Store', color: '#0a84ff' },
  { label: 'Play Store', color: '#00c853' },
  { label: 'Twilio', color: '#f22f46' },
  { label: 'Meta / WhatsApp Business', color: '#25D366' },
  { label: 'Stripe (gateway de pago)', color: '#635BFF' },
  { label: 'Dominio propio', color: '#2DD4BF' },
]

/* PDF prolijo del checklist de cuentas — mismo estilo visual que el resto de la
   app (banda oscura + acento). jsPDF se carga on-demand (import dinámico), igual
   que el export del planificador. Refleja el estado ACTUAL de `project.accounts`,
   así que re-exportar después de tildar cosas siempre da un PDF al día. */
function makeAccountsPdfDoc(project, accounts, JsPDF) {
  var doc = new JsPDF({ unit: 'pt', format: 'a4', compress: true })
  var PW = doc.internal.pageSize.getWidth()
  var PH = doc.internal.pageSize.getHeight()
  var M = 56
  var FOOT_Y = PH - 40

  function clean(s) {
    var t = String(s === null || s === undefined ? '' : s)
    t = t.replace(/[✓✔]/g, 'OK').replace(/[—–]/g, '-').replace(/·/g, '-').replace(/…/g, '...')
    t = t.replace(/[""]/g, '"').replace(/['']/g, "'").replace(/[\uD800-\uDFFF]/g, '')
    t = t.replace(/[^\t\n\r\x20-\xFF]/g, '').replace(/[ \t]+/g, ' ')
    return t.trim()
  }
  var INK = [24, 24, 27], DIM = [110, 110, 116], FAINT = [150, 150, 156]
  var STRUCT = [31, 41, 55], GREEN = [15, 157, 107], LINE = [228, 228, 231]
  function font(style, size, rgb) { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(rgb[0], rgb[1], rgb[2]) }

  // Header
  doc.setFillColor(STRUCT[0], STRUCT[1], STRUCT[2]); doc.rect(0, 0, PW, 58, 'F')
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]); doc.rect(0, 58, PW, 3, 'F')
  font('bold', 15, [255, 255, 255]); doc.text('Cuentas y accesos del proyecto', M, 27)
  font('normal', 10.5, [199, 205, 214]); doc.text(clean(project.name || ''), M, 44)

  var y = 96
  var total = accounts.length
  var doneCount = accounts.filter(function (a) { return a.done }).length
  font('bold', 11, INK); doc.text(clean(doneCount + ' de ' + total + ' cuentas listas'), M, y)
  y += 26

  font('bold', 8.5, FAINT); doc.text('CUENTA', M, y); doc.text('ESTADO', PW - M - 70, y, { align: 'left' })
  y += 8; doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(M, y, PW - M, y); y += 18

  accounts.forEach(function (a) {
    if (y > PH - 90) { doc.addPage(); y = 56 }
    font('normal', 10.5, INK); doc.text(clean(a.label || ''), M, y)
    var st = a.done
    font('bold', 9.5, st ? GREEN : DIM)
    doc.text(st ? 'CREADA' : 'FALTA', PW - M - 70, y, { align: 'left' })
    y += 8; doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(M, y, PW - M, y); y += 16
  })

  if (total === 0) { font('normal', 10.5, FAINT); doc.text('Todavia no se cargaron cuentas para este proyecto.', M, y) }

  var dd = new Date()
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  font('normal', 8.5, FAINT)
  doc.text('Generado el ' + dd.getDate() + ' de ' + MES[dd.getMonth()] + ' de ' + dd.getFullYear() + '.', M, FOOT_Y)
  doc.text('Insights Software', PW - M, FOOT_Y, { align: 'right' })
  return doc
}
async function exportAccountsPdf(project, accounts) {
  var mod = await import('jspdf')
  var JsPDF = mod.jsPDF || mod.default
  var slug = (project.name || 'proyecto').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  makeAccountsPdfDoc(project, accounts, JsPDF).save('cuentas-' + slug + '.pdf')
}
function AccountsModal({ open, project, onClose, patch }) {
  const [draft, setDraft] = useState('')
  if (!project) return <Modal open={open} onClose={onClose} title="Cuentas" />
  const accounts = project.accounts || []
  const has = (label) => accounts.some((a) => (a.label || '').trim().toLowerCase() === label.trim().toLowerCase())
  const add = (label) => {
    const name = (label || '').trim()
    if (!name || has(name)) return
    patch((p) => ({ ...p, accounts: [...(p.accounts || []), { id: uid(), label: name, done: false }] }))
  }
  const toggle = (id) => patch((p) => ({ ...p, accounts: (p.accounts || []).map((a) => (a.id === id ? { ...a, done: !a.done } : a)) }))
  const remove = (id) => patch((p) => ({ ...p, accounts: (p.accounts || []).filter((a) => a.id !== id) }))
  const addCustom = () => { add(draft); setDraft('') }
  const pending = ACCOUNT_PRESETS.filter((pr) => !has(pr.label))
  const doneCount = accounts.filter((a) => a.done).length

  return (
    <Modal open={open} onClose={onClose} title="Cuentas del proyecto" sub={project.name} width={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Cuentas y accesos que hacen falta para arrancar. Sumá las que vayas a necesitar y marcá las que el cliente ya tenga creadas.
        </div>

        {/* Lista de cuentas cargadas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {accounts.length === 0 && <div className="surface" style={{ padding: 14, color: 'var(--text-faint)', fontSize: 13 }}>Todavía no agregaste cuentas. Sumá las que vas a necesitar con los botones de abajo.</div>}
          {accounts.map((a) => (
            <div key={a.id} className="surface surface-hover click" onClick={() => toggle(a.id)} title={a.done ? 'Marcar como no creada' : 'Marcar como creada'} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (a.done ? 'var(--green)' : 'var(--border-strong)'), background: a.done ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{a.done && <I2.check width={13} height={13} style={{ color: '#fff' }} />}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-faint)' : 'var(--text)' }}>{a.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: a.done ? 'var(--green)' : 'var(--text-faint)' }}>{a.done ? 'Creada' : 'Falta'}</span>
              <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); remove(a.id) }} title="Quitar" style={{ padding: 4, color: 'var(--text-faint)' }}><I2.x width={13} height={13} /></button>
            </div>
          ))}
        </div>

        {/* Agregado rápido de presets */}
        {pending.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Agregar rápido</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {pending.map((pr) => (
                <button key={pr.label} className="btn btn-sm" onClick={() => add(pr.label)}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: pr.color, display: 'inline-block', flexShrink: 0 }} /> {pr.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cuenta personalizada */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} placeholder="Otra cuenta (ej. Stripe, Cloudflare…)" style={{ flex: 1 }} />
          <button className="btn btn-accent" onClick={addCustom} disabled={!draft.trim()}><I2.plus width={15} height={15} /> Agregar</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{accounts.length ? `${doneCount}/${accounts.length} creadas` : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => exportAccountsPdf(project, accounts)} disabled={!accounts.length} title="Descarga un PDF prolijo con el estado actual, para compartir con el cliente">
              <I2.pdf width={14} height={14} /> Exportar PDF
            </button>
            <button className="btn btn-accent" onClick={onClose}><I2.check width={15} height={15} /> Listo</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ============================================================================
   BAÚL DE DATOS DEL CLIENTE — credenciales y accesos sensibles por proyecto.
   Cada item: etiqueta + tipo + usuario/mail + contraseña + URL + notas.
   Copiar al portapapeles y mostrar/ocultar por campo. Persiste per-fila en el
   proyecto (campo `vault`). Solo lo ve el equipo (nunca sale en el link público).
============================================================================ */
const VAULT_TYPES = [
  { key: 'email', label: 'Correo', Ico: I2.mail, color: '#38BDF8' },
  { key: 'domain', label: 'Dominio', Ico: I2.globe, color: '#2DD4BF' },
  { key: 'payments', label: 'Pagos', Ico: I2.card, color: '#22C55E' },
  { key: 'social', label: 'Redes', Ico: I2.at, color: '#EC4899' },
  { key: 'other', label: 'Otro', Ico: I2.key, color: '#9CA3AF' },
]
const vaultMeta = (k) => VAULT_TYPES.find((t) => t.key === k) || VAULT_TYPES[VAULT_TYPES.length - 1]
const VAULT_PRESETS = [
  { label: 'Gmail / Correo', type: 'email' },
  { label: 'Dominio', type: 'domain' },
  { label: 'Stripe / Mercado Pago', type: 'payments' },
  { label: 'Instagram', type: 'social' },
]
const emptyVaultItem = (type = 'other', label = '') => ({ id: uid(), type, label, username: '', password: '', url: '', notes: '' })
const genPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?'
  let s = ''
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

/* Botón de copiar con micro-feedback (✓ verde durante ~1s) */
function CopyBtn({ value, title = 'Copiar' }) {
  const [ok, setOk] = useState(false)
  if (!value) return null
  const copy = async (e) => {
    e.stopPropagation()
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(value)
      else { const ta = document.createElement('textarea'); ta.value = value; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
      setOk(true); setTimeout(() => setOk(false), 1100)
    } catch { /* ignore */ }
  }
  return (
    <button className="btn btn-sm btn-ghost" onClick={copy} title={ok ? 'Copiado' : title} style={{ padding: 5, color: ok ? 'var(--green)' : 'var(--text-faint)', flexShrink: 0 }}>
      {ok ? <I2.check width={13} height={13} /> : <I2.copy width={13} height={13} />}
    </button>
  )
}

/* Fila de un campo del item: icono + valor (mono) + ocultar (si es secreto) + copiar */
function VaultRow({ Ico, value, mono = true, secret = false, isLink = false }) {
  const [show, setShow] = useState(false)
  if (!value) return null
  const masked = secret && !show
  const display = masked ? '•'.repeat(Math.min(Math.max(value.length, 6), 14)) : value
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <Ico width={13.5} height={13.5} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      {isLink && !masked
        ? <a href={value} target="_blank" rel="noreferrer" className={mono ? 'mono' : ''} style={{ flex: 1, fontSize: 12.5, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</a>
        : <span className={mono ? 'mono' : ''} style={{ flex: 1, fontSize: 12.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: masked ? 2 : 0 }}>{display}</span>}
      {secret && <button className="btn btn-sm btn-ghost" onClick={() => setShow((s) => !s)} title={show ? 'Ocultar' : 'Mostrar'} style={{ padding: 5, color: 'var(--text-faint)', flexShrink: 0 }}>{show ? <I2.eyeOff width={13} height={13} /> : <I2.eye width={13} height={13} />}</button>}
      <CopyBtn value={value} />
    </div>
  )
}

function VaultModal({ open, project, onClose, patch }) {
  const [editing, setEditing] = useState(null)  // null | item (nuevo o en edición)
  const [pwShow, setPwShow] = useState(false)
  if (!project) return <Modal open={open} onClose={onClose} title="Datos del cliente" />
  const items = project.vault || []

  const startNew = (preset) => { setPwShow(false); setEditing(preset ? emptyVaultItem(preset.type, preset.label) : emptyVaultItem()) }
  const startEdit = (it) => { setPwShow(false); setEditing({ ...it }) }
  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const save = () => {
    const it = editing
    const clean = { ...it, label: (it.label || '').trim() || vaultMeta(it.type).label }
    patch((p) => {
      const cur = p.vault || []
      const exists = cur.some((x) => x.id === clean.id)
      return { ...p, vault: exists ? cur.map((x) => (x.id === clean.id ? clean : x)) : [...cur, clean] }
    })
    setEditing(null)
  }
  const remove = (id) => { if (window.confirm('¿Eliminar este dato? No se puede deshacer.')) patch((p) => ({ ...p, vault: (p.vault || []).filter((x) => x.id !== id) })) }
  const canSave = editing && ((editing.label || '').trim() || editing.username || editing.password || editing.url || editing.notes)

  return (
    <Modal open={open} onClose={onClose} title="Datos del cliente" sub={project.name} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.55, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
          <I2.lock width={15} height={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>Guardá acá los accesos y datos del cliente: correos, contraseñas, dominios, hosting, pagos… Solo lo ve el equipo — nunca aparece en el link público.</span>
        </div>

        {editing ? (
          /* ---- FORM de alta / edición ---- */
          <div className="surface" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--card)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {VAULT_TYPES.map((t) => {
                const on = editing.type === t.key
                return (
                  <button key={t.key} onClick={() => setEditing((e) => ({ ...e, type: t.key, ...(t.key === 'email' ? { password: '' } : {}) }))} className="tag" style={{ cursor: 'pointer', color: on ? '#fff' : t.color, background: on ? t.color : t.color + '1f', borderColor: 'transparent', fontWeight: 600 }}>
                    <t.Ico width={12} height={12} /> {t.label}
                  </button>
                )
              })}
            </div>
            <Field label="Etiqueta"><input className="input" value={editing.label} onChange={(e) => set('label', e.target.value)} placeholder={vaultMeta(editing.type).label + ' del cliente'} autoFocus /></Field>
            {editing.type === 'email' ? (
              /* Correo: solo anotar el mail, sin contraseña */
              <Field label="Correo"><input className="input mono" value={editing.username} onChange={(e) => set('username', e.target.value)} placeholder="cliente@…" autoComplete="off" style={{ fontSize: 13 }} /></Field>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Usuario / correo"><input className="input mono" value={editing.username} onChange={(e) => set('username', e.target.value)} placeholder="usuario@…" autoComplete="off" style={{ fontSize: 13 }} /></Field>
                <Field label="Contraseña">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="input mono" type={pwShow ? 'text' : 'password'} value={editing.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" autoComplete="new-password" style={{ flex: 1, fontSize: 13 }} />
                    <button className="btn btn-sm" onClick={() => setPwShow((s) => !s)} title={pwShow ? 'Ocultar' : 'Mostrar'} style={{ padding: '0 9px' }}>{pwShow ? <I2.eyeOff width={14} height={14} /> : <I2.eye width={14} height={14} />}</button>
                    <button className="btn btn-sm" onClick={() => { set('password', genPassword()); setPwShow(true) }} title="Generar contraseña segura" style={{ padding: '0 9px' }}><I2.spark width={14} height={14} /></button>
                  </div>
                </Field>
              </div>
            )}
            <Field label="URL / enlace (opcional)"><input className="input mono" value={editing.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" autoComplete="off" style={{ fontSize: 13 }} /></Field>
            <Field label="Notas (opcional)"><textarea className="input" rows={2} value={editing.notes} onChange={(e) => set('notes', e.target.value)} placeholder="2FA, PIN, datos de recuperación, etc." style={{ resize: 'none' }} /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-accent" onClick={save} disabled={!canSave}><I2.check width={15} height={15} /> Guardar dato</button>
            </div>
          </div>
        ) : (
          <>
            {/* ---- LISTA de datos guardados ---- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.length === 0 && (
                <div className="surface" style={{ padding: '22px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <I2.lock width={22} height={22} style={{ color: 'var(--text-faint)', opacity: 0.7 }} />
                  Todavía no guardaste ningún dato. Sumá el primero con los accesos rápidos o el botón de abajo.
                </div>
              )}
              {items.map((it) => { const m = vaultMeta(it.type); return (
                <div key={it.id} className="surface surface-hover" style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid ${m.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderBottom: (it.username || it.password || it.url || it.notes) ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: m.color + '22', color: m.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}><m.Ico width={15} height={15} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{m.label}</div>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => startEdit(it)} title="Editar" style={{ padding: 5, color: 'var(--text-faint)' }}><I2.pencil width={14} height={14} /></button>
                    <button className="btn btn-sm btn-ghost" onClick={() => remove(it.id)} title="Eliminar" style={{ padding: 5, color: 'var(--text-faint)' }}><I2.trash width={14} height={14} /></button>
                  </div>
                  {(it.username || it.password || it.url || it.notes) && (
                    <div style={{ padding: '7px 13px 10px' }}>
                      <VaultRow Ico={I2.user} value={it.username} />
                      <VaultRow Ico={I2.lock} value={it.password} secret />
                      <VaultRow Ico={I2.link} value={it.url} isLink mono={false} />
                      {it.notes && <div style={{ display: 'flex', gap: 8, padding: '5px 0' }}><I2.comment width={13.5} height={13.5} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 2 }} /><span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{it.notes}</span></div>}
                    </div>
                  )}
                </div>
              )})}
            </div>

            {/* ---- Accesos rápidos ---- */}
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Agregar rápido</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {VAULT_PRESETS.map((pr) => { const m = vaultMeta(pr.type); return (
                  <button key={pr.label} className="btn btn-sm" onClick={() => startNew(pr)}>
                    <m.Ico width={13} height={13} style={{ color: m.color }} /> {pr.label}
                  </button>
                )})}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{items.length ? `${items.length} dato${items.length === 1 ? '' : 's'} guardado${items.length === 1 ? '' : 's'}` : ''}</span>
              <button className="btn btn-accent" onClick={() => startNew(null)}><I2.plus width={15} height={15} /> Agregar dato</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/* ALCANCE del proyecto: archivos/PDFs + links + llamadas de venta + notas */
function ScopeModal({ open, project, onClose, patch }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  if (!project) return <Modal open={open} onClose={onClose} title="Alcance" />
  const files = project.scopeFiles || []
  const sales = project.salesLinks || []
  const addFile = (item) => patch((p) => ({ ...p, scopeFiles: [item, ...(p.scopeFiles || [])] }))
  const delFile = (id) => patch((p) => ({ ...p, scopeFiles: (p.scopeFiles || []).filter((x) => x.id !== id) }))
  const addSale = (item) => patch((p) => ({ ...p, salesLinks: [item, ...(p.salesLinks || [])] }))
  const delSale = (id) => patch((p) => ({ ...p, salesLinks: (p.salesLinks || []).filter((x) => x.id !== id) }))
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    if (f.size > 1.6 * 1024 * 1024) { alert('El archivo supera 1.6 MB. Para archivos grandes, mejor agregalo como link (Google Drive, Dropbox, etc.).'); e.target.value = ''; return }
    setBusy(true)
    const reader = new FileReader()
    reader.onload = () => { addFile({ id: uid(), kind: 'file', name: f.name, data: reader.result, ext: (f.name.split('.').pop() || '').toLowerCase(), size: f.size, date: NOW().toISOString() }); setBusy(false) }
    reader.onerror = () => setBusy(false)
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const ResourceRow = ({ it, onDelete }) => (
    <div className="surface" style={{ padding: '9px 11px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: it.kind === 'file' ? 'var(--red)' : 'var(--accent)', flexShrink: 0 }}>{it.kind === 'file' ? <I2.pdf width={17} height={17} /> : <I2.link width={16} height={16} />}</span>
      <a href={it.kind === 'file' ? it.data : it.url} target="_blank" rel="noreferrer" download={it.kind === 'file' ? it.name : undefined} style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</a>
      <a href={it.kind === 'file' ? it.data : it.url} target="_blank" rel="noreferrer" download={it.kind === 'file' ? it.name : undefined} title={it.kind === 'file' ? 'Descargar' : 'Abrir'} className="btn btn-sm btn-ghost" style={{ padding: 6, color: 'var(--text-dim)' }}>{it.kind === 'file' ? <I2.download width={15} height={15} /> : <I2.ext width={15} height={15} />}</a>
      <button onClick={() => onDelete(it.id)} title="Eliminar" className="btn btn-sm btn-ghost" style={{ padding: 6, color: 'var(--text-faint)' }}><I2.x width={14} height={14} /></button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title="Alcance del proyecto" sub={project.name} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Documentos / archivos */}
        <div>
          <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><I2.pdf width={14} height={14} /> Documentos del alcance ({files.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {files.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Subí los PDFs/archivos del alcance o pegá un link.</div>}
            {files.map((it) => <ResourceRow key={it.id} it={it} onDelete={delFile} />)}
          </div>
          <input ref={fileRef} type="file" onChange={onFile} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><I2.paperclip width={14} height={14} /> {busy ? 'Subiendo…' : 'Subir archivo / PDF'}</button>
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>hasta 1.6 MB — más grande, usá link</span>
          </div>
          <LinkAdder onAdd={addFile} cta="Agregar link" />
        </div>

        <hr className="divider" />

        {/* Llamadas de venta Fathom */}
        <div>
          <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><I2.phone width={14} height={14} /> Llamadas de venta (Fathom) ({sales.length})</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Pegá el link de la call de venta para que el equipo vea qué se le vendió al cliente.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {sales.map((it) => <ResourceRow key={it.id} it={it} onDelete={delSale} />)}
          </div>
          <LinkAdder onAdd={addSale} cta="Agregar call de venta" />
        </div>

        <hr className="divider" />

        {/* Notas y comentarios */}
        <CommentThread comments={project.scopeNotes} label="Notas y comentarios" subject={`el alcance de ${project.name}`}
          onAdd={(c) => patch((p) => ({ ...p, scopeNotes: [...(p.scopeNotes || []), c] }))}
          onDelete={(id) => patch((p) => ({ ...p, scopeNotes: (p.scopeNotes || []).filter((x) => x.id !== id) }))} />
      </div>
    </Modal>
  )
}

/* ============================================================================
   13 · CLIENTS
============================================================================ */
function Clients() {
  const { data, clientStore } = useApp()
  const [edit, setEdit] = useState(null)       // client being viewed/edited
  const [creating, setCreating] = useState(false)
  const projectsOf = (id) => data.projects.filter((p) => p.clientId === id && p.status === 'active').length

  const blank = { id: '', name: '', company: '', email: '', phone: '', onboardDate: NOW().toISOString(), onboarding: { businessDescription: '', goals: '', existingTech: '', approvedBudget: 0, notes: '' } }

  const saveClient = (c) => {
    if (c.id && clientStore.items.some((x) => x.id === c.id)) clientStore.patch(c.id, () => c)
    else clientStore.create({ ...c, id: uid() })
    setEdit(null); setCreating(false)
  }

  const deleteClient = (id) => {
    clientStore.remove(id)
    setEdit(null)
  }

  const Form = ({ initial, onSave, onCancel, onDelete }) => {
    const [f, setF] = useState(JSON.parse(JSON.stringify(initial)))
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
    const setO = (k, v) => setF((s) => ({ ...s, onboarding: { ...s.onboarding, [k]: v } }))
    const activeProjs = projectsOf(f.id)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Empresa"><input className="input" value={f.company} onChange={(e) => set('company', e.target.value)} /></Field>
          <Field label="Email"><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Teléfono"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        </div>
        <Field label="Descripción del negocio"><textarea className="input" rows={3} value={f.onboarding.businessDescription} onChange={(e) => setO('businessDescription', e.target.value)} /></Field>
        <Field label="Objetivos"><textarea className="input" rows={2} value={f.onboarding.goals} onChange={(e) => setO('goals', e.target.value)} /></Field>
        <Field label="Observaciones"><textarea className="input" rows={2} value={f.onboarding.notes} onChange={(e) => setO('notes', e.target.value)} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {onDelete && f.id ? <button className="btn" onClick={() => { if (window.confirm(`¿Eliminar el cliente "${f.name || f.company}"?${activeProjs ? ` Tiene ${activeProjs} proyecto(s) activo(s); esos proyectos no se borran.` : ''} No se puede deshacer.`)) onDelete(f.id) }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I2.trash width={15} height={15} /> Eliminar cliente</button> : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onCancel}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => onSave(f)}><I2.check width={15} height={15} /> Guardar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Cuentas</div><h1 style={{ fontSize: 32 }}>Clientes</h1></div>
        <button className="btn btn-accent" onClick={() => setCreating(true)}><I2.plus width={15} height={15} /> Agregar cliente</button>
      </div>
      <div className="surface tbl" style={{ overflow: 'hidden' }}>
        <table>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Cliente', 'Empresa', 'Email', 'Proyectos activos', 'Onboarding'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {data.clients.map((c) => (
              <tr key={c.id} className="row-hover click" onClick={() => setEdit(c)} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '13px 16px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>{c.name[0]}</div>
                    {c.name}
                  </div>
                </td>
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{c.company}</td>
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }} className="mono">{c.email}</td>
                <td style={{ padding: '13px 16px' }}><Badge tone="accent">{projectsOf(c.id)}</Badge></td>
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{fmtDate(c.onboardDate || NOW().toISOString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name} sub={`${edit?.company} · respuestas de onboarding`}>
        {edit && <Form initial={edit} onSave={saveClient} onCancel={() => setEdit(null)} onDelete={deleteClient} />}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo cliente" sub="Formulario de onboarding">
        {creating && <Form initial={blank} onSave={saveClient} onCancel={() => setCreating(false)} />}
      </Modal>
    </div>
  )
}

/* ============================================================================
   13b · SOP · PROCESOS DOCUMENTADOS (carpetas estilo Windows + buscador)
============================================================================ */
/* --- markdown mínimo: #/##/### títulos, **negrita**, [txt](url), - listas, [ ] checklist, --- --- */
function sopInline(text, kp) {
  const nodes = []; const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:[^)]+)\))/g
  let last = 0, m, i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) nodes.push(<strong key={kp + 'b' + i}>{m[2]}</strong>)
    else nodes.push(<a key={kp + 'a' + i} href={m[5]} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>{m[4]}</a>)
    last = m.index + m[0].length; i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
function SopMarkdown({ text }) {
  const lines = (text || '').split('\n'); const out = []; let i = 0
  const H = { color: 'var(--text)', fontFamily: 'Bricolage Grotesque' }
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) { i++; continue }
    if (t === '---') { out.push(<hr key={'h' + i} className="divider" style={{ margin: '18px 0' }} />); i++; continue }
    if (t.startsWith('### ')) { out.push(<h4 key={'t' + i} style={{ ...H, fontSize: 15, marginTop: 18, marginBottom: 6 }}>{sopInline(t.slice(4), 't' + i)}</h4>); i++; continue }
    if (t.startsWith('## ')) { out.push(<h3 key={'t' + i} style={{ ...H, fontSize: 18, marginTop: 24, marginBottom: 8 }}>{sopInline(t.slice(3), 't' + i)}</h3>); i++; continue }
    if (t.startsWith('# ')) { out.push(<h2 key={'t' + i} style={{ ...H, fontSize: 23, marginTop: 8, marginBottom: 10 }}>{sopInline(t.slice(2), 't' + i)}</h2>); i++; continue }
    if (/^\[[ xX]\]/.test(t)) {
      const items = []
      while (i < lines.length && /^\[[ xX]\]/.test(lines[i].trim())) { const l = lines[i].trim(); items.push({ checked: /^\[[xX]\]/.test(l), text: l.replace(/^\[[ xX]\]\s?/, '') }); i++ }
      out.push(<div key={'c' + i} style={{ display: 'flex', flexDirection: 'column', gap: 7, margin: '10px 0' }}>{items.map((it, k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 14.5, color: 'var(--text-dim)' }}>
          <span style={{ flexShrink: 0, width: 17, height: 17, marginTop: 1, borderRadius: 5, border: '1.5px solid var(--border-strong, var(--border))', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>{it.checked ? <I2.check width={12} height={12} /> : null}</span>
          <span>{sopInline(it.text, 'c' + i + k)}</span>
        </div>))}</div>)
      continue
    }
    if (t.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) { items.push(lines[i].trim().slice(2)); i++ }
      out.push(<ul key={'u' + i} style={{ margin: '8px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 5 }}>{items.map((it, k) => <li key={k} style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-dim)' }}>{sopInline(it, 'u' + i + k)}</li>)}</ul>)
      continue
    }
    out.push(<p key={'p' + i} style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-dim)', margin: '8px 0' }}>{sopInline(t, 'p' + i)}</p>); i++
  }
  return <div>{out}</div>
}
function sopEmbedSrc(url) {
  let m = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/); if (m) return 'https://www.loom.com/embed/' + m[1]
  m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/); if (m) return 'https://www.youtube.com/embed/' + m[1]
  m = url.match(/vimeo\.com\/(\d+)/); if (m) return 'https://player.vimeo.com/video/' + m[1]
  return null
}
function SopLink({ link }) {
  const src = sopEmbedSrc(link.url || '')
  if (src) return (
    <div style={{ marginBottom: 12 }}>
      {link.label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>{link.label}</div>}
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <iframe src={src} frameBorder="0" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} title={link.label || 'embed'} />
      </div>
    </div>
  )
  return (
    <a href={link.url} target="_blank" rel="noreferrer" className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 8, color: 'var(--text)', textDecoration: 'none' }}>
      <I2.link width={16} height={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{link.label || link.url}</div><div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</div></div>
      <I2.ext width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--text-faint)', flexShrink: 0 }} />
    </a>
  )
}

function Sops() {
  const { data, sopCatStore, sopProcStore } = useApp()
  const sops = data.sops || { categories: [], processes: [] }
  const cats = sops.categories || []
  const procs = sops.processes || []
  const [folder, setFolder] = useState(null)   // categoryId actual (null = raíz)
  const [viewMode, setViewMode] = useState('folders')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)    // proceso abierto (lectura)
  const [editProc, setEditProc] = useState(null) // objeto proceso (nuevo o existente) en edición
  const [catModal, setCatModal] = useState(null) // {id?,name,parentId} en edición

  const childrenCats = (pid) => cats.filter((c) => (c.parentId || null) === pid)
  const procsIn = (cid) => procs.filter((p) => (p.categoryId || null) === cid)
  const catById = (id) => cats.find((c) => c.id === id)
  const pathOf = (cid) => { const out = []; let c = catById(cid); while (c) { out.unshift(c); c = c.parentId ? catById(c.parentId) : null }; return out }

  const query = q.trim().toLowerCase()
  const searching = query.length > 0
  const searchResults = searching ? procs.filter((p) => (p.title + ' ' + (p.description || '') + ' ' + (p.content || '')).toLowerCase().includes(query)) : []

  // mutaciones
  const saveProcess = (p) => {
    const now = new Date().toISOString()
    const exists = p.id && sopProcStore.items.some((x) => x.id === p.id)
    if (exists) sopProcStore.patch(p.id, (x) => ({ ...x, ...p, updatedAt: now }))
    else sopProcStore.create({ ...p, id: p.id || ('sop-' + uid()), createdAt: now, updatedAt: now })
  }
  const deleteProcess = (id) => sopProcStore.remove(id)
  const saveCategory = (c) => {
    const exists = c.id && sopCatStore.items.some((x) => x.id === c.id)
    if (exists) sopCatStore.patch(c.id, (x) => ({ ...x, name: c.name, parentId: c.parentId }))
    else sopCatStore.create({ id: 'sopc-' + uid(), name: c.name, parentId: c.parentId || null, createdAt: new Date().toISOString() })
  }
  const deleteCategory = (id) => {
    const cat = sopCatStore.items.find((x) => x.id === id); const parent = cat ? (cat.parentId || null) : null
    // reparent: las subcarpetas suben al abuelo y los procesos van al padre; recién ahí se borra
    sopCatStore.items.filter((x) => x.parentId === id).forEach((x) => sopCatStore.patch(x.id, (y) => ({ ...y, parentId: parent })))
    sopProcStore.items.filter((x) => x.categoryId === id).forEach((x) => sopProcStore.patch(x.id, (y) => ({ ...y, categoryId: parent })))
    sopCatStore.remove(id)
  }

  const openProc = procs.find((p) => p.id === openId)
  const subFolders = childrenCats(folder)
  const folderProcs = procsIn(folder)
  const crumbs = folder ? pathOf(folder) : []

  const FolderCard = ({ c }) => (
    <div className="surface-hover click" onClick={() => setFolder(c.id)} style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}><I2.folder width={20} height={20} /></div>
      <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div><div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{childrenCats(c.id).length + procsIn(c.id).length} elemento(s)</div></div>
      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-sm btn-ghost" title="Renombrar" onClick={() => setCatModal({ id: c.id, name: c.name, parentId: c.parentId || null })} style={{ padding: 5 }}><I2.pencil width={14} height={14} /></button>
        <button className="btn btn-sm btn-ghost" title="Eliminar carpeta" onClick={() => { if (window.confirm(`¿Eliminar la carpeta "${c.name}"? Su contenido se mueve a la carpeta superior.`)) deleteCategory(c.id) }} style={{ padding: 5, color: 'var(--red)' }}><I2.trash width={14} height={14} /></button>
      </div>
    </div>
  )
  const ProcCard = ({ p }) => (
    <div className="surface-hover click" onClick={() => setOpenId(p.id)} style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--card-hover)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text-dim)', flexShrink: 0 }}><I2.doc width={19} height={19} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{p.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Actualizado {fmtDate(p.updatedAt || p.createdAt)}</span>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm btn-ghost" title="Editar" onClick={() => setEditProc(p)} style={{ padding: 5 }}><I2.pencil width={14} height={14} /></button>
          <button className="btn btn-sm btn-ghost" title="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar el proceso "${p.title}"?`)) deleteProcess(p.id) }} style={{ padding: 5, color: 'var(--red)' }}><I2.trash width={14} height={14} /></button>
        </div>
      </div>
    </div>
  )

  const tableRows = searching ? searchResults.map((p) => ({ kind: 'proc', p })) : [...subFolders.map((c) => ({ kind: 'cat', c })), ...folderProcs.map((p) => ({ kind: 'proc', p }))]

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Segmento de procesos</div><h1 style={{ fontSize: 32 }}>SOP · Procesos</h1><div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 4 }}>Documentá cómo se hacen las cosas. Carpetas por área, procesos adentro.</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setCatModal({ name: '', parentId: folder })}><I2.folder width={15} height={15} /> Nueva carpeta</button>
          <button className="btn btn-accent" onClick={() => setEditProc({ id: '', title: '', description: '', categoryId: folder, content: '', links: [], images: [] })}><I2.plus width={15} height={15} /> Nuevo proceso</button>
        </div>
      </div>

      {/* toolbar: buscador + toggle vista */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 460 }}>
          <I2.search width={15} height={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar procesos…" style={{ paddingLeft: 34 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button className="btn btn-sm btn-ghost" title="Carpetas" onClick={() => setViewMode('folders')} style={{ background: viewMode === 'folders' ? 'var(--card-hover)' : 'transparent', color: viewMode === 'folders' ? 'var(--accent)' : 'var(--text-dim)' }}><I2.cards width={15} height={15} /></button>
          <button className="btn btn-sm btn-ghost" title="Tabla" onClick={() => setViewMode('table')} style={{ background: viewMode === 'table' ? 'var(--card-hover)' : 'transparent', color: viewMode === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I2.table width={15} height={15} /></button>
        </div>
      </div>

      {/* breadcrumb */}
      {!searching && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16, fontSize: 13.5 }}>
          <button className="row-hover" onClick={() => setFolder(null)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 8, color: folder ? 'var(--text-dim)' : 'var(--text)', fontWeight: 600 }}><I2.folder width={14} height={14} /> Inicio</button>
          {crumbs.map((c) => (<React.Fragment key={c.id}><I2.chevR width={13} height={13} style={{ color: 'var(--text-faint)' }} /><button className="row-hover" onClick={() => setFolder(c.id)} style={{ padding: '4px 8px', borderRadius: 8, color: c.id === folder ? 'var(--text)' : 'var(--text-dim)', fontWeight: 600 }}>{c.name}</button></React.Fragment>))}
        </div>
      )}
      {searching && <div style={{ marginBottom: 16, fontSize: 13.5, color: 'var(--text-dim)' }}>{searchResults.length} resultado(s) para «{q}»</div>}

      {/* contenido */}
      {(searching ? searchResults.length === 0 : subFolders.length === 0 && folderProcs.length === 0) ? (
        <div className="surface" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)' }}>
          <I2.doc width={30} height={30} style={{ opacity: .5 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>{searching ? 'No se encontraron procesos.' : 'Esta carpeta está vacía. Creá una carpeta o un proceso nuevo.'}</div>
        </div>
      ) : viewMode === 'folders' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {!searching && subFolders.map((c) => <FolderCard key={c.id} c={c} />)}
          {(searching ? searchResults : folderProcs).map((p) => <ProcCard key={p.id} p={p} />)}
        </div>
      ) : (
        <div className="surface tbl" style={{ overflow: 'hidden' }}>
          <table>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Nombre', 'Tipo', 'Categoría', 'Actualizado', ''].map((h, k) => <th key={k} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {tableRows.map((r, k) => r.kind === 'cat' ? (
                <tr key={'c' + r.c.id} className="row-hover click" onClick={() => setFolder(r.c.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><I2.folder width={16} height={16} style={{ color: 'var(--accent)' }} />{r.c.name}</div></td>
                  <td style={{ padding: '12px 16px' }}><Badge tone="accent">Carpeta</Badge></td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-faint)' }}>—</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-faint)' }}>—</td>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}><div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}><button className="btn btn-sm btn-ghost" onClick={() => setCatModal({ id: r.c.id, name: r.c.name, parentId: r.c.parentId || null })} style={{ padding: 5 }}><I2.pencil width={14} height={14} /></button><button className="btn btn-sm btn-ghost" onClick={() => { if (window.confirm(`¿Eliminar la carpeta "${r.c.name}"?`)) deleteCategory(r.c.id) }} style={{ padding: 5, color: 'var(--red)' }}><I2.trash width={14} height={14} /></button></div></td>
                </tr>
              ) : (
                <tr key={'p' + r.p.id} className="row-hover click" onClick={() => setOpenId(r.p.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><I2.doc width={16} height={16} style={{ color: 'var(--text-dim)' }} />{r.p.title}</div></td>
                  <td style={{ padding: '12px 16px' }}><Badge>Proceso</Badge></td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-dim)' }}>{catById(r.p.categoryId)?.name || 'Sin categoría'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-dim)' }}>{fmtDate(r.p.updatedAt || r.p.createdAt)}</td>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}><div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}><button className="btn btn-sm btn-ghost" onClick={() => setEditProc(r.p)} style={{ padding: 5 }}><I2.pencil width={14} height={14} /></button><button className="btn btn-sm btn-ghost" onClick={() => { if (window.confirm(`¿Eliminar el proceso "${r.p.title}"?`)) deleteProcess(r.p.id) }} style={{ padding: 5, color: 'var(--red)' }}><I2.trash width={14} height={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* lectura de proceso */}
      <Modal open={!!openProc} onClose={() => setOpenId(null)} title={openProc?.title} sub={openProc ? (catById(openProc.categoryId)?.name || 'Sin categoría') + ' · actualizado ' + fmtDate(openProc.updatedAt || openProc.createdAt) : ''} width={840}>
        {openProc && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
              <button className="btn" onClick={() => { setEditProc(openProc); setOpenId(null) }}><I2.pencil width={14} height={14} /> Editar</button>
            </div>
            {openProc.description && <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>{openProc.description}</p>}
            {(openProc.images || []).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, margin: '14px 0' }}>
                {openProc.images.map((im) => <a key={im.id} href={im.src} target="_blank" rel="noreferrer"><img src={im.src} alt={im.name || ''} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }} /></a>)}
              </div>
            )}
            {(openProc.links || []).length > 0 && <div style={{ margin: '14px 0' }}>{openProc.links.map((l) => <SopLink key={l.id} link={l} />)}</div>}
            <SopMarkdown text={openProc.content} />
          </div>
        )}
      </Modal>

      {editProc && <SopEditor proc={editProc} cats={cats} onClose={() => setEditProc(null)} onSave={(p, newCatName) => {
        let cid = p.categoryId
        if (newCatName && newCatName.trim()) { cid = 'sopc-' + uid(); sopCatStore.create({ id: cid, name: newCatName.trim(), parentId: null, createdAt: new Date().toISOString() }) }
        saveProcess({ ...p, categoryId: cid }); setEditProc(null)
      }} />}

      {catModal && <SopCatModal cat={catModal} cats={cats} onClose={() => setCatModal(null)} onSave={(c) => { saveCategory(c); setCatModal(null) }} />}
    </div>
  )
}

function SopEditor({ proc, cats, onClose, onSave }) {
  const [f, setF] = useState(() => JSON.parse(JSON.stringify({ ...proc, links: proc.links || [], images: proc.images || [] })))
  const [newCat, setNewCat] = useState('')
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const depth = (id) => { let d = 0, c = cats.find((x) => x.id === id); while (c && c.parentId) { d++; c = cats.find((x) => x.id === c.parentId) } return d }
  const addLink = () => set('links', [...f.links, { id: uid(), label: '', url: '' }])
  const setLink = (id, k, v) => set('links', f.links.map((l) => l.id === id ? { ...l, [k]: v } : l))
  const rmLink = (id) => set('links', f.links.filter((l) => l.id !== id))
  const onFiles = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => { const r = new FileReader(); r.onload = () => setF((s) => ({ ...s, images: [...s.images, { id: uid(), name: file.name, src: r.result }] })); r.readAsDataURL(file) })
    e.target.value = ''
  }
  const addImgUrl = () => { const u = window.prompt('Pegá la URL de la imagen'); if (u && u.trim()) setF((s) => ({ ...s, images: [...s.images, { id: uid(), name: '', src: u.trim() }] })) }
  const rmImg = (id) => set('images', f.images.filter((im) => im.id !== id))
  const canSave = f.title.trim().length > 0

  return (
    <Modal open onClose={onClose} title={proc.id ? 'Editar proceso' : 'Nuevo proceso'} sub="Documentá el proceso: texto, links embebidos e imágenes" width={780}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Título"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej: Llamada de onboarding" autoFocus /></Field>
        <Field label="Descripción breve"><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Una línea que resuma de qué trata" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Carpeta / categoría">
            <select className="input" value={f.categoryId || ''} onChange={(e) => set('categoryId', e.target.value || null)}>
              <option value="">— Sin categoría —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{' '.repeat(depth(c.id) * 3)}{c.name}</option>)}
            </select>
          </Field>
          <Field label="…o crear carpeta nueva"><input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nombre de la carpeta nueva" /></Field>
        </div>
        <Field label="Contenido">
          <textarea className="input mono" rows={14} value={f.content} onChange={(e) => set('content', e.target.value)} placeholder={'# Título\n## Sección\n- item de lista\n[ ] checklist\n**negrita** y [enlace](https://…)'} style={{ lineHeight: 1.55, fontSize: 13 }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>Formato: <span className="mono"># ## ###</span> títulos · <span className="mono">- </span>listas · <span className="mono">[ ]</span> checklist · <span className="mono">**negrita**</span> · <span className="mono">[texto](url)</span> · <span className="mono">---</span> separador</div>
        </Field>

        {/* links */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><span className="label">Links / embeds</span><button className="btn btn-sm" onClick={addLink}><I2.plus width={13} height={13} /> Agregar link</button></div>
          {f.links.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Loom, YouTube o Vimeo se muestran embebidos; el resto como tarjeta.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{f.links.map((l) => (
              <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" value={l.label} onChange={(e) => setLink(l.id, 'label', e.target.value)} placeholder="Etiqueta" style={{ maxWidth: 180 }} />
                <input className="input mono" value={l.url} onChange={(e) => setLink(l.id, 'url', e.target.value)} placeholder="https://…" style={{ fontSize: 12.5 }} />
                <button className="btn btn-sm btn-ghost" onClick={() => rmLink(l.id)} style={{ padding: 6, color: 'var(--red)' }}><I2.trash width={14} height={14} /></button>
              </div>))}</div>
          )}
        </div>

        {/* imágenes */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="label">Imágenes</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}><I2.paperclip width={13} height={13} /> Subir<input type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} /></label>
              <button className="btn btn-sm" onClick={addImgUrl}><I2.link width={13} height={13} /> Por URL</button>
            </div>
          </div>
          {f.images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
              {f.images.map((im) => (
                <div key={im.id} style={{ position: 'relative' }}>
                  <img src={im.src} alt={im.name || ''} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                  <button className="btn btn-sm" onClick={() => rmImg(im.id)} style={{ position: 'absolute', top: 4, right: 4, padding: 4, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none' }}><I2.x width={12} height={12} /></button>
                </div>))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => onSave(f, newCat)} disabled={!canSave}><I2.check width={15} height={15} /> Guardar proceso</button>
        </div>
      </div>
    </Modal>
  )
}

function SopCatModal({ cat, cats, onClose, onSave }) {
  const [name, setName] = useState(cat.name || '')
  const [parentId, setParentId] = useState(cat.parentId || '')
  const depth = (id) => { let d = 0, c = cats.find((x) => x.id === id); while (c && c.parentId) { d++; c = cats.find((x) => x.id === c.parentId) } return d }
  const options = cats.filter((c) => c.id !== cat.id) // no puede ser su propio padre
  return (
    <Modal open onClose={onClose} title={cat.id ? 'Renombrar carpeta' : 'Nueva carpeta'} sub="Las carpetas organizan tus procesos, estilo Windows" width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nombre"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Onboarding" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave({ ...cat, name: name.trim(), parentId: parentId || null }) }} /></Field>
        <Field label="Dentro de (carpeta superior)">
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Nivel principal —</option>
            {options.map((c) => <option key={c.id} value={c.id}>{' '.repeat(depth(c.id) * 3)}{c.name}</option>)}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => onSave({ ...cat, name: name.trim(), parentId: parentId || null })} disabled={!name.trim()}><I2.check width={15} height={15} /> Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

/* ============================================================================
   14 · CALLS (+ Fathom sync)
============================================================================ */
/* editor de llamada: alta/edición/borrado, selectores encadenados, prioridad */
function CallEditor({ open, call, isNew, onClose, onSave, onDelete }) {
  const { data } = useApp()
  const [f, setF] = useState(null)
  useEffect(() => {
    if (!open) return
    setF(call ? { ...call } : { id: uid(), advisor: data.team[0]?.name || '', clientId: data.clients[0]?.id || '', projectId: '', date: NOW().toISOString().slice(0, 10), type: 'onboarding', priority: 'normal', summary: '', transcript: '', fathomUrl: '' })
  }, [open, call && call.id])
  if (!f) return <Modal open={open} onClose={onClose} title="Llamada" />
  const set = (k, v) => setF((s) => {
    const n = { ...s, [k]: v }
    if (k === 'clientId') { const projs = data.projects.filter((p) => p.clientId === v); if (!projs.some((p) => p.id === n.projectId)) n.projectId = projs[0]?.id || '' }
    return n
  })
  const projOptions = data.projects.filter((p) => p.clientId === f.clientId)
  const advisors = [...new Set([...data.team.map((u) => u.name), f.advisor].filter(Boolean))]
  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Nueva llamada' : 'Editar llamada'} sub={data.clients.find((c) => c.id === f.clientId)?.company} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Asesor">
            <select className="input" value={f.advisor} onChange={(e) => set('advisor', e.target.value)}>
              {advisors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input className="input mono" type="date" value={(f.date || '').slice(0, 10)} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Cliente">
            <select className="input" value={f.clientId} onChange={(e) => set('clientId', e.target.value)}>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Proyecto">
            <select className="input" value={f.projectId} onChange={(e) => set('projectId', e.target.value)}>
              <option value="">— Sin proyecto —</option>
              {projOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo de call">
            <select className="input" value={f.type || 'soporte'} onChange={(e) => set('type', e.target.value)}>
              {CALL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select className="input" value={f.priority || 'normal'} onChange={(e) => set('priority', e.target.value)}>
              <option value="normal">Normal</option>
              <option value="alta">Prioridad (cliente urgente / enojado)</option>
            </select>
          </Field>
          <Field label="Link de Fathom (opcional)"><input className="input mono" value={f.fathomUrl || ''} onChange={(e) => set('fathomUrl', e.target.value)} placeholder="https://fathom.video/..." /></Field>
        </div>
        <Field label="Resumen"><textarea className="input" rows={3} value={f.summary || ''} onChange={(e) => set('summary', e.target.value)} placeholder="Resumen de la llamada…" /></Field>
        <Field label="Transcript completo"><textarea className="input mono" rows={8} value={f.transcript || ''} onChange={(e) => set('transcript', e.target.value)} placeholder="Pegá acá el transcript completo…" style={{ fontSize: 12.5, lineHeight: 1.6 }} /></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          {!isNew ? <button className="btn" onClick={() => { onDelete(f.id); onClose() }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I2.trash width={15} height={15} /> Eliminar</button> : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => { onSave(f); onClose() }}><I2.check width={15} height={15} /> Guardar</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* administrador de cuentas de Fathom (los tokens viven en Supabase, no en el navegador) */
function FathomAccountsModal({ open, onClose, accounts, onReload }) {
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const add = async () => {
    if (!apiKey.trim()) { setErr('Pegá la API key de Fathom.'); return }
    if (!cloudEnabled) { setErr('Necesitás Supabase configurado.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: res, error } = await supabase.functions.invoke('fathom-sync', { body: { action: 'add_account', label: label.trim(), email: email.trim(), apiKey: apiKey.trim() } })
      if (error) throw error
      if (res?.error) throw new Error(res.error)
      setLabel(''); setEmail(''); setApiKey(''); onReload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const remove = async (id) => {
    if (!cloudEnabled) return
    await supabase.functions.invoke('fathom-sync', { body: { action: 'remove_account', id } })
    onReload()
  }
  return (
    <Modal open={open} onClose={onClose} title="Cuentas de Fathom" sub="Los tokens se guardan en Supabase (backend), nunca en el navegador" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(accounts || []).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Sin cuentas todavía. Agregá una abajo (una por cada correo de la empresa: vendedor, asesores, socios…).</div>}
          {(accounts || []).map((a) => (
            <div key={a.id} className="surface" style={{ padding: '10px 12px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{a.email || '—'} · {a.last_synced ? `sync ${fmtRelative(a.last_synced)}` : 'sin sincronizar'}</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => remove(a.id)} title="Quitar cuenta" style={{ padding: 6, color: 'var(--text-faint)' }}><I2.trash width={14} height={14} /></button>
            </div>
          ))}
        </div>
        <hr className="divider" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Nombre / etiqueta"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Federico (ventas)" /></Field>
          <Field label="Email (opcional)"><input className="input mono" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="federicog@insightsapps.tech" /></Field>
        </div>
        <Field label="API key de Fathom (Fathom → Settings → API)"><input className="input mono" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="fathom_…" /></Field>
        {err && <div style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-soft)', padding: '8px 10px', borderRadius: 8 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-accent" onClick={add} disabled={busy}><I2.plus width={15} height={15} /> {busy ? 'Guardando…' : 'Agregar cuenta'}</button>
        </div>
      </div>
    </Modal>
  )
}

function Calls() {
  const { data, logActivity, callStore } = useApp()
  const [editing, setEditing] = useState(null)   // {call, isNew} | null
  const [fathomOpen, setFathomOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [fathomCalls, setFathomCalls] = useState([])
  const [accounts, setAccounts] = useState([])
  const [typeFilter, setTypeFilter] = useState('all')
  const [asesorFilter, setAsesorFilter] = useState('all')
  const clientOf = (id) => data.clients.find((c) => c.id === id)
  const projOf = (id) => data.projects.find((p) => p.id === id)

  const saveCall = (call) => {
    const isNew = !data.calls.some((c) => c.id === call.id)
    callStore.upsert(call)
    if (isNew && logActivity) logActivity({ type: 'call-add', text: `agregó una llamada con ${clientOf(call.clientId)?.company || 'un cliente'}` })
  }
  const deleteCall = (id) => callStore.remove(id)
  const patchManual = (id, fields) => callStore.patch(id, (c) => ({ ...c, ...fields }))

  const loadFathomCalls = async () => { if (!cloudEnabled) return; const { data: rows } = await supabase.from('fathom_calls').select('*').order('call_date', { ascending: false }); if (rows) setFathomCalls(rows) }
  const loadAccounts = async () => { if (!cloudEnabled) return; try { const { data: res } = await supabase.functions.invoke('fathom-sync', { body: { action: 'list_accounts' } }); if (res?.accounts) setAccounts(res.accounts) } catch (e) { /* fn no desplegada */ } }
  const traerCalls = async () => {
    if (!cloudEnabled) { setSyncMsg({ error: 'Necesitás Supabase configurado (login).' }); return }
    setSyncing(true); setSyncMsg(null)
    try {
      const { data: res, error } = await supabase.functions.invoke('fathom-sync', { body: { action: 'sync' } })
      if (error) throw error
      if (res?.error) throw new Error(res.error)
      setSyncMsg({ ok: true, imported: res.imported || 0, errors: res.errors || [] })
      await loadFathomCalls(); await loadAccounts()
    } catch (e) { setSyncMsg({ error: e.message || 'No se pudo traer (¿está desplegada la función fathom-sync?)' }) } finally { setSyncing(false) }
  }
  const patchFathom = async (id, fields) => { setFathomCalls((fc) => fc.map((r) => r.id === id ? { ...r, ...fields } : r)); if (cloudEnabled) await supabase.from('fathom_calls').update(fields).eq('id', id) }

  useEffect(() => {
    loadFathomCalls(); loadAccounts()
    if (!cloudEnabled) return
    const ch = supabase.channel('fathom_calls_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'fathom_calls' }, () => loadFathomCalls()).subscribe()
    const iv = setInterval(() => { traerCalls() }, 5 * 60 * 1000)   // refresco automático cada 5 min
    return () => { supabase.removeChannel(ch); clearInterval(iv) }
  }, [])

  // unificar calls de Fathom + manuales
  const unified = [
    ...fathomCalls.map((r) => ({ id: r.id, source: 'fathom', name: r.title, asesor: r.asesor, type: r.type, clientId: r.client_id, projectId: r.project_id, date: r.call_date, url: r.share_url, testimonial: r.testimonial, upsell: r.upsell })),
    ...data.calls.map((c) => ({ id: c.id, source: 'manual', name: c.summary ? c.summary.slice(0, 70) : 'Llamada', asesor: c.advisor, type: c.type, clientId: c.clientId, projectId: c.projectId, date: c.date, url: c.fathomUrl, testimonial: c.testimonial, upsell: c.upsell, raw: c })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))
  const asesores = [...new Set(unified.map((u) => u.asesor).filter(Boolean))]
  const filtered = unified.filter((u) => (typeFilter === 'all' || u.type === typeFilter) && (asesorFilter === 'all' || u.asesor === asesorFilter))

  const setClient = (row, clientId) => { const projs = data.projects.filter((p) => p.clientId === clientId); const projectId = projs.some((p) => p.id === row.projectId) ? row.projectId : (projs[0]?.id || ''); row.source === 'fathom' ? patchFathom(row.id, { client_id: clientId, project_id: projectId }) : patchManual(row.id, { clientId, projectId }) }
  const setProject = (row, projectId) => row.source === 'fathom' ? patchFathom(row.id, { project_id: projectId }) : patchManual(row.id, { projectId })
  const toggleFlag = (row, key) => { const next = row[key] === true ? false : true; if (row.source === 'fathom') patchFathom(row.id, { [key]: next }); else patchManual(row.id, { [key]: next }) }

  const Flag = ({ on, label, row }) => (
    <button onClick={(e) => { e.stopPropagation(); toggleFlag(row, label === 'Testimonio' ? 'testimonial' : 'upsell') }} title={label}
      className="tag" style={{ cursor: 'pointer', color: on ? 'var(--green)' : 'var(--text-faint)', background: on ? 'var(--green-soft)' : 'var(--bg-elevated)', borderColor: on ? 'transparent' : 'var(--border)' }}>
      {on ? <I2.check width={11} height={11} /> : <I2.x width={11} height={11} />} {label}
    </button>
  )

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Soporte & seguimiento</div><h1 style={{ fontSize: 32 }}>Calls</h1></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-accent" onClick={traerCalls} disabled={syncing}><I2.refresh width={15} height={15} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} /> {syncing ? 'Trayendo…' : 'Traer calls'}</button>
          <button className="btn" onClick={() => setFathomOpen(true)}><I2.phone width={15} height={15} /> Cuentas Fathom {accounts.length ? `(${accounts.length})` : ''}</button>
          <button className="btn" onClick={() => setEditing({ call: null, isNew: true })}><I2.plus width={15} height={15} /> Agregar manual</button>
        </div>
      </div>

      {syncMsg && (
        <div className="surface" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, borderColor: syncMsg.error ? 'var(--red)' : 'var(--accent-line)', background: syncMsg.error ? 'var(--red-soft)' : 'var(--bg-elevated)' }}>
          <span style={{ fontSize: 13, color: syncMsg.error ? 'var(--red)' : 'var(--text-dim)', flex: 1 }}>{syncMsg.error ? syncMsg.error : `Se trajeron/actualizaron ${syncMsg.imported} calls de Fathom.${(syncMsg.errors || []).length ? ' Errores: ' + syncMsg.errors.join('; ') : ''}`}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSyncMsg(null)}><I2.x width={13} height={13} /></button>
        </div>
      )}

      {/* filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">Tipo: todos</option>
          {CALL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={asesorFilter} onChange={(e) => setAsesorFilter(e.target.value)}>
          <option value="all">Asesor: todos</option>
          {asesores.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {(typeFilter !== 'all' || asesorFilter !== 'all') && <button className="btn btn-sm btn-ghost" onClick={() => { setTypeFilter('all'); setAsesorFilter('all') }} style={{ color: 'var(--text-dim)' }}><I2.x width={13} height={13} /> Limpiar</button>}
      </div>

      {filtered.length === 0 && <div className="surface" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Sin llamadas. Cargá una cuenta de Fathom y tocá “Traer calls”, o agregá una manual.</div>}

      {filtered.length > 0 && (
        <div className="surface tbl" style={{ overflow: 'hidden' }}>
          <table>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Asesor', 'Nombre', 'Tipo', 'Cliente', 'Proyecto', 'Fecha', 'Fathom', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((u) => {
                const m = callTypeMeta(u.type)
                const projOpts = data.projects.filter((p) => p.clientId === u.clientId)
                return (
                  <tr key={u.source + u.id} className="row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{u.asesor || '—'}</td>
                    <td style={{ padding: '12px 16px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: u.source === 'manual' ? 'pointer' : 'default' }} onClick={() => u.source === 'manual' && setEditing({ call: u.raw, isNew: false })}>
                      {u.name || '—'}
                      {u.type === 'entrega' && <div style={{ display: 'flex', gap: 5, marginTop: 5 }}><Flag on={u.testimonial === true} label="Testimonio" row={u} /><Flag on={u.upsell === true} label="Upsell" row={u} /></div>}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><span className="tag" style={{ color: m.color, background: m.color + '1f', borderColor: m.color + '55' }}>{m.label}</span></td>
                    <td style={{ padding: '8px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <select className="input" value={u.clientId || ''} onChange={(e) => setClient(u, e.target.value)} style={{ width: 'auto', maxWidth: 150, padding: '5px 8px', fontSize: 12.5 }}>
                        <option value="">— Cliente —</option>
                        {data.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <select className="input" value={u.projectId || ''} onChange={(e) => setProject(u, e.target.value)} style={{ width: 'auto', maxWidth: 150, padding: '5px 8px', fontSize: 12.5 }} disabled={!u.clientId}>
                        <option value="">— Proyecto —</option>
                        {projOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }} className="mono">{fmtDate(u.date)}</td>
                    <td style={{ padding: '12px 16px', width: 50 }}>{u.url ? <a href={u.url} target="_blank" rel="noreferrer" title="Ver transcript/resumen en Fathom" style={{ color: 'var(--accent)' }}><I2.link width={16} height={16} /></a> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                    <td style={{ padding: '12px 16px 12px 0', width: 40 }}>{u.source === 'manual' && <button className="btn btn-sm btn-ghost" title="Eliminar" onClick={() => { if (window.confirm('¿Eliminar esta llamada?')) deleteCall(u.id) }} style={{ padding: 6, color: 'var(--text-faint)' }}><I2.x width={14} height={14} /></button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CallEditor open={!!editing} call={editing?.call} isNew={editing?.isNew} onClose={() => setEditing(null)} onSave={saveCall} onDelete={deleteCall} />
      <FathomAccountsModal open={fathomOpen} onClose={() => setFathomOpen(false)} accounts={accounts} onReload={loadAccounts} />
    </div>
  )
}

/* ============================================================================
   15 · PROJECT DETAIL — KPI grid · kickoff · avance del plan · tareas · registro
============================================================================ */
/* configurar el link público del proyecto para el cliente (solo lectura, con contraseña) */
function ShareModal({ open, project, onClose, patch }) {
  const [copied, setCopied] = useState(false)
  const enabled = !!project.shareEnabled
  const link = project.shareId ? `${window.location.origin}${window.location.pathname}?share=${project.shareId}` : ''
  const enable = () => patch((p) => ({ ...p, shareEnabled: true, shareId: p.shareId || (uid() + uid()), sharePassword: p.sharePassword || '' }))
  const copy = () => { try { navigator.clipboard.writeText(link) } catch (e) { /* ignore */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <Modal open={open} onClose={onClose} title="Compartir con el cliente" sub={project.name} width={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.6, background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
          El cliente entra con la contraseña y ve una página de <strong>solo lectura</strong> en tiempo real: dashboard, avance, tareas y el registro (calls, looms y notas <strong>públicas</strong>). Las notas privadas y lo interno no se muestran.
        </div>
        {!enabled ? (
          <button className="btn btn-accent" onClick={enable} style={{ justifyContent: 'center' }}><I2.eye width={15} height={15} /> Activar link para el cliente</button>
        ) : (
          <>
            <Field label="Contraseña de acceso (dásela al cliente)">
              <input className="input" value={project.sharePassword || ''} onChange={(e) => patch((p) => ({ ...p, sharePassword: e.target.value }))} placeholder="ej: real1234" autoFocus />
            </Field>
            <Field label="Link público">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input mono" readOnly value={link} style={{ fontSize: 12 }} onFocus={(e) => e.target.select()} />
                <button className="btn btn-sm" onClick={copy} style={{ flexShrink: 0 }}>{copied ? <I2.check width={14} height={14} /> : <I2.link width={14} height={14} />} {copied ? 'Copiado' : 'Copiar'}</button>
              </div>
            </Field>
            {!(project.sharePassword || '').trim() && <div style={{ fontSize: 12, color: 'var(--yellow)' }}>⚠ Poné una contraseña — sin ella el cliente no puede entrar.</div>}
            <a href={link} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ justifyContent: 'center' }}><I2.ext width={14} height={14} /> Previsualizar como cliente</a>
            <button className="btn btn-sm btn-ghost" onClick={() => patch((p) => ({ ...p, shareEnabled: false }))} style={{ color: 'var(--red)', justifyContent: 'center' }}><I2.eyeOff width={14} height={14} /> Desactivar el link</button>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-accent" onClick={onClose}><I2.check width={15} height={15} /> Listo</button></div>
      </div>
    </Modal>
  )
}

/* ============================================================================
   15b · AVANCE DEL PLAN — acordeón de semanas con tachado de tareas
   El equipo tacha tareas semana a semana; el % sube y el cliente lo ve en su link
   público en vivo (patchPlan → sync a published_plans en el store). Es la ÚNICA
   fuente del avance del proyecto: no hay otro tablero por detrás.
============================================================================ */

/* Checkbox custom con check animado (spring). Naranja/verde según el tema de la app. */
/* ── Notas del cliente ────────────────────────────────────────────────────────
   Notas que cualquiera deja desde el link público del plan (tabla plan_notes).
   Lectura pública; marcar leída / borrar exige estar logueado (RLS). Realtime:
   aparecen solas cuando el cliente escribe. Se agrupan por semana (week=null →
   nota general del plan). */
function useClientNotes(slug) {
  const [notes, setNotes] = useState([])
  useEffect(() => {
    if (!supabase || !slug) { setNotes([]); return }
    let alive = true
    const load = async () => {
      const { data, error } = await supabase
        .from('plan_notes')
        .select('id,week,author,body,read,created_at')
        .eq('slug', slug).is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (alive && !error) setNotes(data || [])
    }
    load()
    const ch = supabase
      .channel('pn-app-' + slug)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_notes', filter: 'slug=eq.' + slug }, load)
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [slug])

  const markRead = async (id, read = true) => {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, read } : n)))
    if (supabase) await supabase.from('plan_notes').update({ read }).eq('id', id)
  }
  const remove = async (id) => {
    setNotes((ns) => ns.filter((n) => n.id !== id))
    // RPC (SECURITY DEFINER) en vez de update directo: no depende de una policy
    // RLS de UPDATE en plan_notes, así el borrado no falla en silencio.
    if (supabase) await supabase.rpc('delete_plan_note', { p_id: id })
  }
  return { notes, markRead, remove }
}

/* Una nota del cliente: autor, fecha, cuerpo, y acciones (leída / borrar). */
function NoteCard({ note, onRead, onDelete }) {
  const date = note.created_at
    ? new Date(note.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
  return (
    <div style={{
      border: '1px solid ' + (note.read ? 'var(--border)' : 'var(--accent-line, var(--accent))'),
      borderRadius: 10, padding: '10px 12px', background: note.read ? 'var(--card)' : 'var(--accent-soft)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        {!note.read && <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)', flexShrink: 0 }} />}
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{note.author || 'Anónimo'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{date}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-ghost" style={{ padding: '3px 8px', fontSize: 11.5 }}
            onClick={() => onRead(note.id, !note.read)} title={note.read ? 'Marcar como no leída' : 'Marcar como leída'}>
            {note.read ? 'No leída' : 'Leída'}
          </button>
          <button className="btn btn-sm btn-ghost" style={{ padding: '3px 8px', fontSize: 11.5, color: 'var(--red)' }}
            onClick={() => { if (window.confirm('¿Borrar esta nota del cliente?')) onDelete(note.id) }} title="Borrar nota">
            Borrar
          </button>
        </span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.body}</div>
    </div>
  )
}

function PlanTaskCheck({ done }) {
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
      border: '1.5px solid ' + (done ? 'var(--green)' : 'var(--border-strong)'),
      background: done ? 'var(--green)' : 'transparent',
      display: 'grid', placeItems: 'center',
      transition: 'background .2s ease, border-color .2s ease',
    }}>
      <motion.span initial={false} animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }} style={{ display: 'grid', placeItems: 'center' }}>
        <I2.check width={13} height={13} style={{ color: '#0A0A0A' }} />
      </motion.span>
    </span>
  )
}

/* Chips operativos compactos por tarea (tablero RDEX): estado, riesgo alto,
   candado si está bloqueada y cantidad de evidencias. Sólo muestra lo informativo
   — "pendiente" y "terminada" ya se leen por el check y el tachado — para no
   ensuciar la fila. */
// Reddish suave para tareas 100% Insights (no chillón — versión apagada del rojo de la UI).
const INSIGHTS_ONLY_COLOR = '#e0897c'

function TaskChips({ task, clientName }) {
  const est = taskEstado(task)
  const em = TASK_ESTADOS[est]
  const showEstado = est === 'curso' || est === 'bloqueada'
  const riskHigh = task && task.riesgo === 'alto' && est !== 'terminada'
  const evCount = (task && Array.isArray(task.evidencia) && task.evidencia.length) || 0
  // Responsable: siempre se muestra, así se distingue de un vistazo qué hace cada
  // parte. El nombre real del cliente lo pone la UI (multi-tenant).
  const resp = taskResponsable(task)
  const cliente = (clientName && String(clientName).trim()) || 'Cliente'
  const respLabel = resp === 'ambos' ? `Insights + ${cliente}` : resp === 'cliente' ? cliente : 'Insights'
  const respColor = resp === 'insights' ? INSIGHTS_ONLY_COLOR : (RESPONSABLES[resp] && RESPONSABLES[resp].color)
  if (!showEstado && !riskHigh && !evCount && !respColor) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {respColor && (
        <span className="tag" title={`Lo hace: ${respLabel}`} style={{ color: respColor, background: hexA(respColor, 0.14), borderColor: hexA(respColor, 0.34), display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <I2.user width={10} height={10} /> {respLabel}
        </span>
      )}
      {showEstado && em && (
        <span className="tag" style={{ color: em.color, background: hexA(em.color, 0.14), borderColor: hexA(em.color, 0.28) }}>
          {est === 'bloqueada' && <I2.lock width={10} height={10} />}
          {em.label}
        </span>
      )}
      {riskHigh && <span title="Riesgo alto" style={{ width: 8, height: 8, borderRadius: 999, background: RIESGOS.alto.color, flexShrink: 0 }} />}
      {evCount > 0 && (
        <span className="tag hide-mobile" title={`${evCount} evidencia${evCount === 1 ? '' : 's'}`} style={{ color: 'var(--text-dim)', background: 'var(--bg-elevated)' }}>
          <I2.paperclip width={10} height={10} /> {evCount}
        </span>
      )}
    </span>
  )
}

/* Una semana del acordeón: cabecera colapsable + lista de tareas al expandir. */
function PlanWeekRow({ plan, week, onToggleTask, onOpenDetail, notes = [], onReadNote, onDeleteNote }) {
  const [open, setOpen] = useState(false)
  const prog = weekProgress(week)
  const complete = prog.total > 0 && prog.pct === 100
  const hito = hitoForWeek(plan, week.n)
  const tasks = Array.isArray(week.tasks) ? week.tasks : []
  const unread = notes.filter((n) => !n.read).length
  return (
    <div style={{
      border: '1px solid ' + (complete ? 'var(--green-soft)' : 'var(--border)'),
      borderRadius: 12, marginBottom: 8, overflow: 'hidden',
      background: complete ? 'var(--green-soft)' : 'var(--card)',
      transition: 'background .3s ease, border-color .3s ease',
    }}>
      <button onClick={() => setOpen((o) => !o)} className="row-hover" style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '11px 14px', cursor: 'pointer',
      }}>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ display: 'grid', placeItems: 'center', color: complete ? 'var(--green)' : 'var(--text-faint)', flexShrink: 0 }}>
          <I2.chevR width={16} height={16} />
        </motion.span>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: complete ? 'var(--green)' : 'var(--text-dim)', minWidth: 52, letterSpacing: '.03em' }}>
          SEM {String(week.n).padStart(2, '0')}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {week.title || <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>Sin título</span>}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: hito.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hito.label}{hito.title ? ` · ${hito.title}` : ''}
            </span>
          </span>
        </span>
        {notes.length > 0 && (
          <span className="tag" title={`${notes.length} nota${notes.length === 1 ? '' : 's'} del cliente${unread ? ` · ${unread} sin leer` : ''}`}
            style={{ color: unread ? 'var(--accent)' : 'var(--text-dim)', background: unread ? 'var(--accent-soft)' : 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <I2.comment width={11} height={11} /> {notes.length}{unread ? ` · ${unread}` : ''}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <span style={{ width: 74, height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <motion.span initial={false} animate={{ width: `${prog.pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'block', height: '100%', background: complete ? 'var(--green)' : 'var(--accent)', borderRadius: 999 }} />
          </span>
          <span className="mono" style={{ fontSize: 11.5, color: complete ? 'var(--green)' : 'var(--text-dim)', minWidth: 32, textAlign: 'right' }}>
            {prog.done}/{prog.total}
          </span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '5px 8px 9px', borderTop: '1px solid var(--border)' }}>
              {tasks.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--text-faint)', padding: '10px 12px' }}>Esta semana no tiene tareas cargadas.</div>
              )}
              {tasks.map((t, i) => {
                const done = taskDone(t)
                const text = taskText(t)
                const tid = t && typeof t === 'object' ? t.id : null
                return (
                  <div key={tid || i} className="row-hover" style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 8px', borderRadius: 10,
                  }}>
                    <button onClick={() => onToggleTask(week.n, i)} style={{
                      display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, textAlign: 'left', padding: '4px 4px', cursor: 'pointer', background: 'transparent',
                    }}>
                      <PlanTaskCheck done={done} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                          <span style={{ fontSize: 13.5, lineHeight: 1.45, color: done ? 'var(--text-faint)' : 'var(--text)', transition: 'color .25s ease' }}>
                            {text || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Tarea sin texto</span>}
                          </span>
                          <motion.span initial={false} animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            style={{ position: 'absolute', left: 0, right: 0, top: '52%', height: 1.5, background: 'var(--text-faint)', transformOrigin: 'left', borderRadius: 2, pointerEvents: 'none' }} />
                        </span>
                      </span>
                    </button>
                    <TaskChips task={t} clientName={plan.clientName} />
                    <button className="btn btn-sm btn-ghost" onClick={() => onOpenDetail && onOpenDetail(week.n, i, t)}
                      title="Seguimiento operativo de la tarea" style={{ padding: '4px 7px', color: 'var(--text-faint)', flexShrink: 0 }}>
                      <I2.gear width={14} height={14} />
                    </button>
                  </div>
                )
              })}
              {notes.length > 0 && (
                <div style={{ marginTop: 8, padding: '10px 12px 4px', borderTop: '1px dashed var(--border)' }}>
                  <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <I2.comment width={13} height={13} /> Notas del cliente ({notes.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {notes.map((n) => (
                      <NoteCard key={n.id} note={n} onRead={onReadNote} onDelete={onDeleteNote} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* Etiquetas cortas del estado para el control segmentado del detalle (el label
   largo "Terminada por Insights" no entra en un botón chico). */
const ESTADO_SEG = { pendiente: 'Pendiente', curso: 'En curso', bloqueada: 'Bloqueada', terminada: 'Terminada' }

/* Editor de seguimiento operativo de UNA tarea (tablero vivo pedido por RDEX).
   Edita en vivo TODOS los campos del modelo: estado, avance, responsables, riesgo,
   impacto, bloqueo, criterio de aceptación y evidencia. Cada cambio persiste solo
   vía onEdit → patchPlan (misma fila del plan, sync al link público). La aceptación
   formal de RDEX es de sólo lectura acá: se revoca, no se fija (la fija el cliente
   desde el link público). */
function PlanTaskDetailModal({ open, onClose, task, weekN, team = [], clientName, onEdit }) {
  // La evidencia se edita en estado local para que una fila recién agregada (vacía)
  // sobreviva en pantalla: normalizeTask descarta las evidencias vacías del plan
  // guardado, pero acá la seguimos mostrando hasta que el usuario la complete.
  const [evRows, setEvRows] = useState([])
  const tid = task && task.id
  useEffect(() => {
    setEvRows(task && Array.isArray(task.evidencia) ? task.evidencia.map((e) => ({ ...e })) : [])
  }, [tid])

  const edit = (fields) => onEdit((t) => ({ ...t, ...fields }))
  const changeEstado = (v) => onEdit((t) => setTaskEstado(t, v))
  // Elegir Insights limpia el campo (default implícito); cliente/ambos lo persisten.
  const changeResponsable = (v) => onEdit((t) => ({ ...t, responsable: v === 'insights' ? undefined : v }))
  const editBloqueo = (fields) => onEdit((t) => ({ ...t, bloqueo: { ...(t.bloqueo || {}), ...fields } }))
  const writeEv = (rows) => { setEvRows(rows); onEdit((t) => ({ ...t, evidencia: rows })) }
  const addEv = () => writeEv([...evRows, { tipo: 'doc', label: '', url: '' }])
  const setEv = (i, f) => writeEv(evRows.map((e, j) => (j === i ? { ...e, ...f } : e)))
  const delEv = (i) => writeEv(evRows.filter((_, j) => j !== i))

  const teamEstado = task ? taskEstado(task) : 'pendiente'
  const resp = task ? taskResponsable(task) : 'insights'   // quién ejecuta (default Insights)
  const cliente = (clientName && String(clientName).trim()) || 'Cliente'
  const RESP_LABELS = { insights: RESPONSABLES.insights.label, cliente, ambos: RESPONSABLES.ambos.label }
  const bl = (task && task.bloqueo) || {}
  const listId = tid ? `team-names-${tid}` : 'team-names-none'
  const dateVal = (v) => (v ? String(v).slice(0, 10) : '')

  return (
    <Modal open={open && !!task} onClose={onClose} title={(task && task.text) || 'Tarea'}
      sub={weekN ? `Semana ${weekN} · Seguimiento operativo` : 'Seguimiento operativo'} width={680}>
      {task && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <datalist id={listId}>{team.map((u) => <option key={u.id} value={u.name} />)}</datalist>

          {/* Estado (segmentado) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="label">Estado</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TASK_ESTADO_CHOICES.map((k) => {
                const m = TASK_ESTADOS[k]
                const on = teamEstado === k
                return (
                  <button key={k} className="btn btn-sm" onClick={() => changeEstado(k)}
                    style={on ? { color: m.color, background: hexA(m.color, 0.16), borderColor: hexA(m.color, 0.5), fontWeight: 700 } : undefined}>
                    {k === 'bloqueada' && <I2.lock width={12} height={12} />}
                    {k === 'terminada' && <I2.check width={13} height={13} />}
                    {ESTADO_SEG[k]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Avance % + fecha pronosticada */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Avance (%)">
              <input className="input mono" type="number" min="0" max="100" value={task.avance ?? ''}
                onChange={(e) => edit({ avance: e.target.value === '' ? undefined : clamp(Math.round(Number(e.target.value)), 0, 100) })} placeholder="0" />
            </Field>
            <Field label="Fecha pronosticada">
              <input className="input mono" type="date" value={dateVal(task.fecha)} onChange={(e) => edit({ fecha: e.target.value })} />
            </Field>
          </div>
          <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ width: `${clamp(Number(task.avance) || (task.done ? 100 : 0), 0, 100)}%`, height: '100%', background: task.done ? 'var(--green)' : 'var(--accent)', borderRadius: 999, transition: 'width .3s ease' }} />
          </div>

          {/* Módulo + riesgo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Módulo / componente"><input className="input" value={task.modulo || ''} onChange={(e) => edit({ modulo: e.target.value })} placeholder="Ej: Auth, Dashboard…" /></Field>
            <Field label="Riesgo">
              <select className="input" value={task.riesgo || ''} onChange={(e) => edit({ riesgo: e.target.value })}>
                {Object.entries(RIESGOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Lo único de este panel que ve el cliente en su link: la explicación
              en criollo de qué se hace en esta tarea. El resto es interno. */}
          <Field label="En qué consiste (lo ve el cliente)"><textarea className="input" rows={3} value={task.detalle || ''} onChange={(e) => edit({ detalle: e.target.value })} placeholder="Explicado simple, sin tecnicismos: qué se hace acá y para qué sirve." style={{ resize: 'vertical' }} /></Field>

          <Field label="Criterio de aceptación"><textarea className="input" rows={2} value={task.criterio || ''} onChange={(e) => edit({ criterio: e.target.value })} placeholder="Qué tiene que cumplir para darse por aceptada." style={{ resize: 'vertical' }} /></Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Trabajo anterior"><textarea className="input" rows={2} value={task.prev || ''} onChange={(e) => edit({ prev: e.target.value })} placeholder="Lo que ya estaba hecho." style={{ resize: 'vertical' }} /></Field>
            <Field label="Trabajo actual"><textarea className="input" rows={2} value={task.hoy || ''} onChange={(e) => edit({ hoy: e.target.value })} placeholder="Lo que se está haciendo ahora." style={{ resize: 'vertical' }} /></Field>
          </div>

          <Field label="Impacto"><input className="input" value={task.impacto || ''} onChange={(e) => edit({ impacto: e.target.value })} placeholder="A qué afecta si se atrasa o falla." /></Field>

          {/* ¿Quién la hace? — responsable de ejecución (Insights / cliente / ambos) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="label">¿Quién la hace?</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['insights', 'cliente', 'ambos'].map((k) => {
                const m = RESPONSABLES[k]
                const on = resp === k
                return (
                  <button key={k} className="btn btn-sm" onClick={() => changeResponsable(k)}
                    style={on ? { color: m.color, background: hexA(m.color, 0.16), borderColor: hexA(m.color, 0.5), fontWeight: 700 } : undefined}>
                    <I2.user width={12} height={12} /> {RESP_LABELS[k]}
                  </button>
                )
              })}
            </div>
            {resp !== 'insights' && (
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                Se resalta en el roadmap para que se vea que {resp === 'ambos' ? `la comparten Insights y ${cliente}` : `depende de ${cliente}`}.
              </span>
            )}
          </div>

          {/* Responsables */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="label">Responsables</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Desarrollador"><input className="input" list={listId} value={task.dev || ''} onChange={(e) => edit({ dev: e.target.value })} placeholder="Quién lo construye" /></Field>
              <Field label="Revisor"><input className="input" list={listId} value={task.rev || ''} onChange={(e) => edit({ rev: e.target.value })} placeholder="Quién lo revisa" /></Field>
              <Field label="Dueño funcional"><input className="input" list={listId} value={task.dueno || ''} onChange={(e) => edit({ dueno: e.target.value })} placeholder="Dueño del alcance" /></Field>
              <Field label="Aceptador (RDEX)"><input className="input" value={task.acept || ''} onChange={(e) => edit({ acept: e.target.value })} placeholder="Quién acepta del lado del cliente" /></Field>
            </div>
          </div>

          {/* Bloqueo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 14px', borderRadius: 12, border: '1px solid ' + hexA(TASK_ESTADOS.bloqueada.color, 0.28), background: hexA(TASK_ESTADOS.bloqueada.color, 0.06) }}>
            <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 7, color: TASK_ESTADOS.bloqueada.color }}><I2.lock width={12} height={12} /> Bloqueo</span>
            <Field label="Detalle del bloqueo"><textarea className="input" rows={2} value={bl.detalle || ''} onChange={(e) => editBloqueo({ detalle: e.target.value })} placeholder="Qué lo traba." style={{ resize: 'vertical' }} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Bloqueada desde"><input className="input mono" type="date" value={dateVal(bl.desde)} onChange={(e) => editBloqueo({ desde: e.target.value })} /></Field>
              <Field label="Fecha límite"><input className="input mono" type="date" value={dateVal(bl.limite)} onChange={(e) => editBloqueo({ limite: e.target.value })} /></Field>
              <Field label="Quién lo resuelve"><input className="input" list={listId} value={bl.quien || ''} onChange={(e) => editBloqueo({ quien: e.target.value })} placeholder="Responsable de destrabar" /></Field>
              <Field label="Decisión requerida"><input className="input" value={bl.decision || ''} onChange={(e) => editBloqueo({ decision: e.target.value })} placeholder="Qué decisión falta" /></Field>
            </div>
          </div>

          {/* Evidencia */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><I2.paperclip width={12} height={12} /> Evidencia</span>
              <button className="btn btn-sm" onClick={addEv}><I2.plus width={13} height={13} /> Agregar</button>
            </div>
            {evRows.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Sin evidencia cargada. Sumá links a código, PRs, staging, videos o documentos.</div>}
            {evRows.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input" value={e.tipo || 'doc'} onChange={(ev) => setEv(i, { tipo: ev.target.value })} style={{ width: 'auto', flexShrink: 0, padding: '8px 10px', fontSize: 13 }}>
                  {Object.entries(EVIDENCIA_TIPOS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <input className="input" value={e.label || ''} onChange={(ev) => setEv(i, { label: ev.target.value })} placeholder="Etiqueta" style={{ flex: '1 1 30%', minWidth: 0, padding: '8px 10px', fontSize: 13 }} />
                <input className="input mono" value={e.url || ''} onChange={(ev) => setEv(i, { url: ev.target.value })} placeholder="https://…" style={{ flex: '1 1 45%', minWidth: 0, padding: '8px 10px', fontSize: 12.5 }} />
                <button className="btn btn-sm btn-ghost" onClick={() => delEv(i)} title="Quitar" style={{ padding: 5, color: 'var(--text-faint)', flexShrink: 0 }}><I2.x width={13} height={13} /></button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 2 }}>
            <button className="btn btn-accent" onClick={onClose}><I2.check width={15} height={15} /> Listo</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* Sección "Avance del plan": tablero vivo (% + chips) + acordeón de TODAS las
   semanas del plan asociado. Tachar tareas o editar su estado marca "último avance"
   del proyecto, que es lo que alimenta el indicador de las tarjetas. */
function PlanProgress({ linkedPlan, patchPlan, onAssociate, markProgress }) {
  const { data } = useApp()
  const team = (data && data.team) || []
  // Notas del cliente dejadas desde el link público (se agrupan por semana abajo).
  const { notes: clientNotes, markRead, remove: removeNote } = useClientNotes(linkedPlan?.slug)
  const [detail, setDetail] = useState(null)   // { weekN, taskId } del detalle operativo abierto

  if (!linkedPlan) {
    return (
      <section className="pd-sec">
        <div className="pd-h"><h2>Avance del plan</h2><span className="sub">todavía sin plan asociado</span></div>
        <div className="pd-panel lift" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 13, flex: 'none', background: 'var(--bg-elevated)', boxShadow: 'inset 0 0 0 1px var(--border)', color: 'var(--text-faint)' }}>
            <I2.calendar width={19} height={19} />
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 5 }}>Asociá un plan para trackear el avance</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Vinculá un plan del Planificador y vas a poder tachar tareas semana a semana. El cliente ve el avance en vivo en su link público.
            </div>
          </div>
          <button className="pd-cta" onClick={onAssociate} style={{ flex: 'none' }}>Asociar un plan <i><I2.arrowRight width={13} height={13} /></i></button>
        </div>
      </section>
    )
  }

  const weeks = [...(linkedPlan.weeks || [])].sort((a, b) => (a.n || 0) - (b.n || 0))
  const summary = planBoardSummary(linkedPlan)
  const allDone = summary.total > 0 && summary.pctInsights === 100
  const clientLabel = (linkedPlan.clientName && String(linkedPlan.clientName).trim()) || 'el cliente'
  // Lo que todavía depende del cliente (responsable cliente/ambos, sin terminar).
  const CLIENTE_COLOR = RESPONSABLES.cliente.color
  const pendingCliente = planPendingCliente(linkedPlan).filter((p) => !p.done)
  // Tarea con el detalle operativo abierto (se relee del plan en vivo, así el modal
  // refleja lo que se va guardando).
  const detailWeek = detail ? weeks.find((w) => w.n === detail.weekN) : null
  const detailTask = detailWeek ? (detailWeek.tasks || []).find((t) => t && t.id === detail.taskId) : null

  // Agrupa las notas del cliente por semana (week=null → nota general del plan).
  const notesByWeek = {}
  const generalNotes = []
  for (const n of clientNotes) {
    if (n.week == null) generalNotes.push(n)
    else (notesByWeek[n.week] = notesByWeek[n.week] || []).push(n)
  }
  const totalUnread = clientNotes.filter((n) => !n.read).length

  // Tachar/destachar una tarea → guarda el plan (síncrono) y marca "último avance".
  const onToggleTask = (weekN, taskIndex) => {
    const updated = patchPlan(linkedPlan.id, (p) => ({
      ...p,
      weeks: (p.weeks || []).map((w) => (w.n === weekN ? toggleTaskDone(w, taskIndex) : w)),
    }))
    if (!updated) return
    if (markProgress) markProgress()   // tachar una tarea del plan = "último avance" hoy
  }

  // Edita UNA tarea (por id) dentro de su semana, normalizando el resultado. Si el
  // cambio toca `done` (ej: Estado→Terminada) marca "último avance", igual que el
  // check. El resto de los campos operativos (responsables, riesgo, evidencia…) no.
  const editTask = (weekN, taskId, mutate) => {
    let before = null
    const updated = patchPlan(linkedPlan.id, (p) => ({
      ...p,
      weeks: (p.weeks || []).map((w) => {
        if (w.n !== weekN) return w
        return {
          ...w,
          tasks: (w.tasks || []).map((t) => {
            if (!(t && t.id === taskId)) return t
            before = normalizePlanTask(t)
            return normalizePlanTask(mutate(before))
          }),
        }
      }),
    }))
    if (!updated || !before) return
    const w = (updated.weeks || []).find((x) => x.n === weekN)
    const after = w && (w.tasks || []).find((t) => t && t.id === taskId)
    if (after && !!before.done !== !!after.done) {
      if (markProgress) markProgress()
    }
  }

  // Abre el detalle operativo de una tarea. Si la tarea es legacy (string sin id),
  // primero normaliza esa semana para asignarle ids (igual que hace el primer toggle)
  // y recién ahí abre el modal apuntando por id estable.
  const openTaskDetail = (weekN, taskIndex, task) => {
    let id = task && typeof task === 'object' ? task.id : null
    if (!id) {
      const updated = patchPlan(linkedPlan.id, (p) => ({
        ...p,
        weeks: (p.weeks || []).map((w) => (w.n === weekN ? { ...w, tasks: normalizeTasks(w.tasks) } : w)),
      }))
      const w = updated && (updated.weeks || []).find((x) => x.n === weekN)
      id = w && w.tasks[taskIndex] && w.tasks[taskIndex].id
    }
    if (id) setDetail({ weekN, taskId: id })
  }

  return (
    <section className="pd-sec">
      <div className="pd-h">
        <h2>Avance del plan</h2>
        <span className="sub">{linkedPlan.title || 'Plan'}</span>
        {totalUnread > 0 && (
          <span className="tag" title={`${totalUnread} nota${totalUnread === 1 ? '' : 's'} del cliente sin leer`}
            style={{ color: 'var(--accent)', background: 'var(--accent-soft)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <I2.comment width={11} height={11} /> {totalUnread} sin leer
          </span>
        )}
      </div>

      {/* TABLERO DE AVANCE — % terminado + chips de control. Una tarea está
          terminada o no: sin paso de aceptación del cliente de por medio. */}
      <div className="pd-panel lift" style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 13 }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Tablero de avance</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: allDone ? 'var(--green)' : 'var(--accent)', letterSpacing: '-0.02em' }}>{summary.pctInsights}%</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, marginTop: 3 }}>Terminado</span>
          </div>
        </div>
        <div style={{ position: 'relative', height: 12, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}
          title={`${summary.done}/${summary.total} terminadas`}>
          <motion.div initial={false} animate={{ width: `${summary.pctInsights}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, background: allDone ? 'var(--green)' : 'linear-gradient(90deg, var(--accent), #FB923C)', borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{summary.done}/{summary.total} tareas</span>
          {summary.curso > 0 && (
            <span className="tag" style={{ color: TASK_ESTADOS.curso.color, background: hexA(TASK_ESTADOS.curso.color, 0.14), borderColor: hexA(TASK_ESTADOS.curso.color, 0.28) }}>{summary.curso} en curso</span>
          )}
          {summary.pendiente > 0 && (
            <span className="tag" style={{ color: 'var(--text-dim)', background: 'var(--bg-elevated)' }}>{summary.pendiente} pendiente{summary.pendiente === 1 ? '' : 's'}</span>
          )}
          {summary.bloqueada > 0 && (
            <span className="tag" style={{ color: 'var(--red)', background: 'var(--red-soft)', borderColor: hexA(TASK_ESTADOS.bloqueada.color, 0.4) }}><I2.lock width={11} height={11} /> {summary.bloqueada} bloqueada{summary.bloqueada === 1 ? '' : 's'}</span>
          )}
          {summary.riesgoAlto > 0 && (
            <span className="tag" style={{ color: 'var(--yellow)', background: 'var(--yellow-soft)' }}><I2.alert width={11} height={11} /> {summary.riesgoAlto} riesgo alto</span>
          )}
          {summary.nextFecha && (
            <span className="tag" style={{ color: 'var(--text-dim)', background: 'var(--bg-elevated)' }}><I2.calendar width={11} height={11} /> Próx. fecha: {fmtDate(summary.nextFecha)}</span>
          )}
        </div>
      </div>

      {/* LO QUE NECESITAMOS DEL CLIENTE — todo lo que depende de su lado y frena el avance. */}
      {pendingCliente.length > 0 && (
        <div style={{ padding: '15px 17px', marginBottom: 14, borderRadius: 16, background: hexA(CLIENTE_COLOR, 0.07), boxShadow: `inset 0 0 0 1px ${hexA(CLIENTE_COLOR, 0.3)}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: hexA(CLIENTE_COLOR, 0.18), display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <I2.user width={15} height={15} style={{ color: CLIENTE_COLOR }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: CLIENTE_COLOR }}>Lo que necesitamos de {clientLabel}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{pendingCliente.length} tarea{pendingCliente.length === 1 ? '' : 's'} pendiente{pendingCliente.length === 1 ? '' : 's'} de su lado</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {pendingCliente.map((p, i) => (
              <div key={`${p.week}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: CLIENTE_COLOR, flexShrink: 0, minWidth: 62 }}>Semana {p.week}</span>
                <span style={{ color: 'var(--text)', lineHeight: 1.45 }}>
                  {p.text || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Tarea sin texto</span>}
                  {p.responsable === 'ambos' && <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}> · junto con Insights</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        {weeks.length === 0 && (
          <div className="pd-hollow">
            <strong style={{ color: 'var(--text-dim)', fontSize: 13 }}>El plan todavía no tiene semanas</strong>
            Cargalas desde el Planificador y el avance empieza a contar acá.
          </div>
        )}
        {weeks.map((w) => (
          <PlanWeekRow key={w.n} plan={linkedPlan} week={w} onToggleTask={onToggleTask}
            onOpenDetail={openTaskDetail}
            notes={notesByWeek[w.n] || []} onReadNote={markRead} onDeleteNote={removeNote} />
        ))}
      </div>

      <PlanTaskDetailModal open={!!detailTask} onClose={() => setDetail(null)} task={detailTask} weekN={detail?.weekN} team={team}
        clientName={linkedPlan.clientName}
        onEdit={(mutate) => { if (detailTask) editTask(detail.weekN, detailTask.id, mutate) }} />

      {generalNotes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <I2.comment width={14} height={14} /> Notas generales del cliente ({generalNotes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {generalNotes.map((n) => (
              <NoteCard key={n.id} note={n} onRead={markRead} onDelete={removeNote} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ============================================================================
   15b · CICLO DE VIDA DEL PROYECTO — fases 1·2·3 + cobro de mantenimiento
   El cambio de fase SIEMPRE lo confirma una persona: sella una fecha que
   después factura. El sistema sugiere, no ejecuta.
============================================================================ */
const PHASE_ICON = { 1: I2.phase1, 2: I2.phase2, 3: I2.phase3 }

function PhaseConfirmModal({ open, to, project, onClose, onConfirm }) {
  const target = to || 1
  const meta = phaseMeta(target)
  const lc = normalizeLifecycle(project)
  const back = target < lc.phase
  const today = fmtDate(new Date().toISOString())
  return (
    <Modal open={open} onClose={onClose} width={480}
      title={back ? `Volver a ${meta.label}` : `Pasar a ${meta.label}`} sub={project?.name}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="pd-note" style={{ background: back ? 'var(--yellow-soft)' : 'var(--accent-soft)' }}>
          <span className="ic" style={{ background: 'var(--card)', color: back ? 'var(--yellow)' : 'var(--accent)' }}>
            {back ? <I2.alert width={15} height={15} /> : <I2.check width={15} height={15} />}
          </span>
          <div>
            {back
              ? <>Volver atrás <b>borra las fechas de las fases siguientes</b>. Si el proyecto ya estaba en mantenimiento, deja de contar el cobro.</>
              : <>Se va a guardar <b>hoy, {today}</b>, como el día en que arranca {meta.label.toLowerCase()}. De esa fecha sale el contador{target === 3 ? ' y el aviso de cobro' : ''}.</>}
          </div>
        </div>
        {target === 3 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Si todavía no cargaste el día de cobro, se toma el de hoy (hasta el 28). Después lo cambiás en Editar proyecto.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => onConfirm(target)} autoFocus>
            <I2.check width={15} height={15} /> {back ? 'Volver a ' : 'Pasar a '}{meta.label}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* Previsualización REAL del mail de aviso (el mismo HTML que se manda).
   No hay envío todavía y el copy no lo disimula: se copia y se manda a mano. */
function MaintenanceMailModal({ open, onClose, project, client, dueAt, amount, replyTo, sentAt, onMarkSent, onUndo }) {
  const [copied, setCopied] = useState('')
  const [copyErr, setCopyErr] = useState('')
  const dueKey = dueAt ? dueAt.getTime() : 0
  const mail = useMemo(() => {
    if (!open || !dueAt) return null
    try {
      return buildMaintenanceNotice({
        clientName: (client && (client.name || client.company)) || 'Hola',
        companyName: (client && client.company) || '',
        projectName: project.name,
        amount: amount == null ? 0 : Number(amount),
        currency: 'USD',
        dueDate: dueAt,
        projectUrl: project.productionUrl || null,
        replyTo: replyTo || '',
      })
    } catch (e) { return null }
  }, [open, dueKey, project.name, project.productionUrl, amount, replyTo, client])

  // Copiar NO sella el aviso: sellarlo lo hace el botón "Marcar como enviado", y
  // nada más. Copiar el HTML para mirarlo no es haberlo mandado, y sellar de más
  // hace desaparecer el recordatorio de ese ciclo sin que salga un solo mail.
  // Y si el portapapeles falla (contexto inseguro, permiso denegado) se ve: antes
  // el botón no hacía nada y el usuario creía tener el texto copiado.
  const copy = async (what, value) => {
    try { await navigator.clipboard.writeText(value) }
    catch (e) { setCopyErr('No se pudo copiar (el navegador bloquea el portapapeles fuera de HTTPS). Seleccioná el texto a mano y copialo con Ctrl+C.'); return }
    setCopyErr('')
    setCopied(what); setTimeout(() => setCopied((c) => (c === what ? '' : c)), 2400)
  }

  return (
    <Modal open={open} onClose={onClose} width={640} title="Aviso de cobro" sub={project.name}>
      {!mail ? (
        <div className="pd-hollow">
          <strong style={{ color: 'var(--text-dim)', fontSize: 13 }}>Todavía no se puede armar el mail</strong>
          Falta el día de cobro del proyecto. Cargalo en Editar proyecto y el aviso se arma solo.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div className="pd-note" style={{ background: 'var(--bg-elevated)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
            <span className="ic" style={{ background: 'var(--card)', color: 'var(--text-faint)' }}><I2.mail width={15} height={15} /></span>
            <div>
              El envío es a mano: <b>Insights OS todavía no manda mails</b>. Copiá el contenido y mandalo desde tu correo.
              {sentAt && <> Ya quedó anotado que este mes avisaste (<span className="mono">{fmtDate(sentAt)}</span>).</>}
            </div>
          </div>

          <div className="pd-panel" style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="pd-eyebrow" style={{ marginBottom: 4 }}>Asunto</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>{mail.subject}</div>
            </div>
            <button className="pd-btn" onClick={() => copy('subject', mail.subject)} style={{ flex: 'none' }}>
              <I2.copy width={13} height={13} /> {copied === 'subject' ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <div style={{ padding: 1, background: 'var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <iframe title="Previsualización del mail" srcDoc={mail.html} sandbox=""
              style={{ display: 'block', width: '100%', height: 'min(48vh, 400px)', border: 'none', borderRadius: 13, background: '#FFFFFF' }} />
          </div>

          {copyErr && (
            <div role="alert" style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-soft)', padding: '8px 10px', borderRadius: 8, lineHeight: 1.5 }}>
              {copyErr}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <button className="pd-btn" onClick={() => copy('text', mail.text)}>
              <I2.copy width={13} height={13} /> {copied === 'text' ? 'Copiado' : 'Copiar el texto'}
            </button>
            <button className="pd-btn" onClick={() => copy('html', mail.html)}>
              <I2.copy width={13} height={13} /> {copied === 'html' ? 'Copiado' : 'Copiar el HTML'}
            </button>
            <span style={{ flex: 1 }} />
            {sentAt
              ? <button className="pd-btn" onClick={onUndo}><I2.refresh width={13} height={13} /> Deshacer el aviso</button>
              : <button className="pd-cta" onClick={() => { if (onMarkSent) onMarkSent() }}>
                  Marcar como enviado <i><I2.check width={13} height={13} /></i>
                </button>}
          </div>
        </div>
      )}
    </Modal>
  )
}

function LifecyclePanel({ project, client, planProgress, patch, onEdit, logActivity, replyTo }) {
  const [confirmTo, setConfirmTo] = useState(null)
  const [mailOpen, setMailOpen] = useState(false)
  // Si cambia el proyecto, ningún modal puede quedar abierto encima de otro:
  // el aviso de cobro de un proyecto sobre la fase 1 de otro no significa nada.
  useEffect(() => { setMailOpen(false); setConfirmTo(null) }, [project.id])
  const lc = normalizeLifecycle(project)
  const info = phaseInfo(project)
  // Se le pasa el desglose entero ({ pct, total }), no el %: sin plan con tareas
  // reales no hay sugerencia de pasar a la prueba (ver suggestedTransition).
  const sug = suggestedTransition(project, planProgress)
  const notice = billingNotice(project)
  const next = lc.phase < 3 ? lc.phase + 1 : null
  const stampOf = (n) => (n === 1 ? lc.startedAt : n === 2 ? lc.phase2At : lc.phase3At)
  const clientLabel = (client && (client.name || client.company)) || 'el cliente'
  // Aviso vigente = ya se mandó el de este ciclo (billingNotice lo descarta solo).
  const sentThisCycle = !!lc.lastNoticeSentAt && !notice.shouldNotify && notice.daysUntil != null && notice.daysUntil <= 7

  const apply = (to) => {
    patch((p) => ({ ...p, lifecycle: advancePhase(p, to) }))
    if (logActivity) logActivity({ type: 'phase', text: `pasó ${project.name} a ${phaseMeta(to).label}` })
    setConfirmTo(null)
  }
  const markSent = () => patch((p) => ({ ...p, lifecycle: markNoticeSent(p) }))
  const undoSent = () => patch((p) => ({ ...p, lifecycle: { ...normalizeLifecycle(p), lastNoticeSentAt: null } }))

  return (
    <section className="pd-sec">
      <div className="pd-h">
        <h2>Ciclo de vida</h2>
        <span className="sub">Desarrollo → prueba gratis → mantenimiento</span>
        <span style={{ flex: 1 }} />
        {next && (
          <button className="pd-cta quiet" onClick={() => setConfirmTo(next)}>
            Pasar a {phaseMeta(next).label} <i><I2.arrowRight width={13} height={13} /></i>
          </button>
        )}
      </div>

      <div className="pd-panel lift" style={{ padding: '16px 18px 18px' }}>
        <div className="pd-phases">
          {PHASES.map((ph) => {
            const done = ph.phase < lc.phase
            const cur = ph.phase === lc.phase
            const Ico = PHASE_ICON[ph.phase]
            const col = `var(${ph.colorVar})`
            const stamp = stampOf(ph.phase)
            return (
              <button key={ph.phase} type="button" className="pd-ph" disabled={cur}
                aria-current={cur ? 'step' : undefined}
                onClick={() => setConfirmTo(ph.phase)}
                title={cur ? 'Fase actual' : done ? `Volver a ${ph.label}` : `Pasar a ${ph.label}`}>
                <span className="bar">
                  <span style={{ background: col, opacity: done ? 0.4 : 1, transform: `scaleX(${done || cur ? 1 : 0})` }} />
                </span>
                <span className="nm" style={{ color: cur ? 'var(--text)' : 'var(--text-dim)' }}>
                  <Ico width={14} height={14} style={{ color: done || cur ? col : 'var(--text-faint)', flex: 'none' }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ph.label}</span>
                  {done && <I2.check width={12} height={12} style={{ color: 'var(--green)', flex: 'none' }} />}
                </span>
                <span className="dt">{stamp ? fmtDate(stamp) : 'sin fecha'}</span>
                <span className="ct" style={{ color: cur ? 'var(--text)' : 'var(--text-dim)' }}>
                  {cur ? info.countdownLabel : done ? 'Cumplida' : 'Pendiente'}
                </span>
              </button>
            )
          })}
        </div>

        {sug && (
          <div className="pd-note" style={{ background: 'var(--accent-soft)', marginTop: 16 }}>
            <span className="ic" style={{ background: 'var(--card)', color: 'var(--accent)' }}><I2.sparkle width={15} height={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>Parece que toca cambiar de fase.</b> {sug.reason} Nada se mueve hasta que lo confirmes.
            </div>
            <button className="pd-cta" style={{ flex: 'none' }} onClick={() => setConfirmTo(sug.to)}>
              Pasar a {phaseMeta(sug.to).label} <i><I2.arrowRight width={13} height={13} /></i>
            </button>
          </div>
        )}

        {lc.phase === 3 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="pd-mini">
              {lc.maintenanceAmount != null
                ? <div><span className="k">Mantenimiento</span><span className="v">{money(lc.maintenanceAmount)}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-faint)' }}> /mes</span></span></div>
                : <button type="button" onClick={onEdit} title="Cargar el monto"><span className="k">Mantenimiento</span><span className="v" style={{ color: 'var(--text-faint)' }}>Definir</span></button>}
              {lc.billingDay
                ? <div><span className="k">Día de cobro</span><span className="v">{lc.billingDay} de cada mes</span></div>
                : <button type="button" onClick={onEdit} title="Cargar el día de cobro"><span className="k">Día de cobro</span><span className="v" style={{ color: 'var(--text-faint)' }}>Definir</span></button>}
              <div>
                <span className="k">Próximo cobro</span>
                <span className="v" style={{ color: notice.dueAt ? 'var(--blue)' : 'var(--text-faint)' }}>{notice.dueAt ? fmtDate(notice.dueAt) : '—'}</span>
              </div>
            </div>

            {notice.shouldNotify ? (
              <div className="pd-note" style={{ background: 'var(--yellow-soft)' }}>
                <span className="ic" style={{ background: 'var(--card)', color: 'var(--yellow)' }}><I2.bell width={15} height={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>Falta avisarle el cobro a {clientLabel}.</b>{' '}
                  {notice.daysUntil === 0 ? 'Se cobra hoy' : `Se cobra en ${notice.daysUntil} ${notice.daysUntil === 1 ? 'día' : 'días'}`} ({fmtDate(notice.dueAt)}).
                  El mail ya está escrito, pero se manda a mano.
                </div>
                <button className="pd-cta" style={{ flex: 'none' }} onClick={() => setMailOpen(true)}>
                  Ver el mail <i><I2.mail width={13} height={13} /></i>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-faint)' }}>
                <span style={{ flex: 1, minWidth: 160, lineHeight: 1.5 }}>
                  {sentThisCycle
                    ? <>Ya avisaste este cobro el <span className="mono">{fmtDate(lc.lastNoticeSentAt)}</span>.</>
                    : notice.dueAt
                      ? <>Cuando falten 7 días para el cobro te avisamos acá para mandar el mail.</>
                      : <>Cargá el día de cobro para que aparezca el aviso.</>}
                </span>
                <button className="pd-btn" onClick={() => setMailOpen(true)} disabled={!notice.dueAt}
                  style={!notice.dueAt ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
                  <I2.mail width={13} height={13} /> Ver el mail
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <PhaseConfirmModal open={confirmTo != null} to={confirmTo} project={project}
        onClose={() => setConfirmTo(null)} onConfirm={apply} />
      <MaintenanceMailModal open={mailOpen} onClose={() => setMailOpen(false)} project={project} client={client}
        dueAt={notice.dueAt} amount={lc.maintenanceAmount} replyTo={replyTo}
        sentAt={sentThisCycle ? lc.lastNoticeSentAt : null} onMarkSent={markSent} onUndo={undoSent} />
    </section>
  )
}

/* Chip de enlace externo. Sin URL no se disfraza de enlace: se ve hueco,
   punteado, dice qué falta y su click lleva a cargarlo. Nada de botones muertos. */
function ExtLink({ Ico, label, url, empty = 'sin cargar', onEmpty, tone }) {
  if (!url) {
    return (
      <button type="button" className="pd-lnk empty" onClick={onEmpty} title={`Cargar el enlace de ${label}`}>
        <Ico width={14} height={14} />{label}
        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>· {empty}</span>
        <I2.plus width={12} height={12} />
      </button>
    )
  }
  return (
    <a className="pd-lnk" href={url} target="_blank" rel="noreferrer" title={`Abrir ${label} en otra pestaña`}
      style={tone ? { color: tone } : undefined}>
      <Ico width={14} height={14} />{label}
      <span className="go"><I2.ext width={12} height={12} /></span>
    </a>
  )
}

/* Botón de panel interno (abre un modal). Lleva su contador cuando hay algo
   cargado, para no tener que abrirlo solo para ver si está vacío.
   El relleno de color se reserva para lo que PIDE algo (cuentas incompletas):
   si todos los chips gritan, ninguno se escucha. */
function PanelBtn({ Ico, label, onClick, count, tone, dot, title }) {
  return (
    <button type="button" className="pd-btn" onClick={onClick} title={title || label} data-tone={tone || undefined}>
      <Ico width={14} height={14} />{label}
      {dot ? <span className="pd-dotmark" style={{ background: dot }} /> : null}
      {count ? <span className="n">{count}</span> : null}
    </button>
  )
}

function ProjectDetail({ projectId, onBack }) {
  const { data, myId, logActivity, plans, patchPlan, createTask, patchTask, projectStore } = useApp()
  const project = data.projects.find((p) => p.id === projectId)
  const client = data.clients.find((c) => c.id === project?.clientId)
  const [kpiModal, setKpiModal] = useState(null)
  const [kickoffOpen, setKickoffOpen] = useState(true)
  const [editKickoff, setEditKickoff] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [driveOpen, setDriveOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)

  if (!project) return null
  const patch = (fn) => projectStore.patch(projectId, fn)
  // Plan asociado (D10: el enlace vive SOLO en plan.publishedUrl; el proyecto solo guarda planId)
  const linkedPlan = (plans || []).find((pl) => pl.id === project.planId) || null
  const associatePlan = (id) => {
    patch((p) => ({ ...p, planId: id || null }))
    if (logActivity) logActivity(id
      ? { type: 'plan-link', text: `asoció un plan a ${project.name}` }
      : { type: 'plan-unlink', text: `desasoció el plan de ${project.name}` })
  }
  const setPlanUrl = (url) => { if (project.planId) patchPlan(project.planId, (pl) => ({ ...pl, publishedUrl: url })) }
  // Guardar el modal MERGEA sobre el proyecto vivo, no lo reemplaza: el draft es un
  // snapshot del momento en que se abrió el modal y mientras tanto el proyecto pudo
  // cambiar por otro lado (otra pestaña, realtime, pasar de fase, marcar el aviso de
  // cobro como enviado). Escribir el snapshot entero hacía retroceder lifecycle.phase,
  // reponía lastNoticeSentAt en null y borraba activity/avances/clientTasks nuevos.
  const saveProject = (draft) => patch((p) => {
    const out = { ...p }
    for (const k of PROJECT_FORM_FIELDS) out[k] = draft[k]
    const live = normalizeLifecycle(p)          // fase y sellos: del proyecto ACTUAL
    const edited = normalizeLifecycle(draft)    // datos del cobro: del formulario
    const lifecycle = { ...live }
    for (const k of PROJECT_FORM_LIFECYCLE_FIELDS) lifecycle[k] = edited[k]
    out.lifecycle = lifecycle
    return out
  })
  // tareas del equipo (vienen de la sección Tareas, filtradas por proyecto) y tareas/dependencias del cliente
  const userOf = (id) => (data.team || []).find((u) => u.id === id)
  const teamTasks = (data.tasks || []).filter((t) => t.projectId === projectId)
  const clientTasks = project.clientTasks || []
  const addTeamTask = (name) => createTask({ id: uid(), name, projectId, scope: 'cliente', assigneeId: project.assignments?.dev?.userId || '', priority: 'normal', status: 'pendiente', notes: '', comments: [] })
  const setTeamStatus = (id, status) => patchTask(id, (t) => ({ ...t, status }))
  const addClientTask = (text) => patch((p) => ({ ...p, clientTasks: [...(p.clientTasks || []), { id: uid(), text, done: false, date: new Date().toISOString() }] }))
  const toggleClient = (id) => patch((p) => ({ ...p, clientTasks: (p.clientTasks || []).map((c) => (c.id === id ? { ...c, done: !c.done } : c)) }))
  const delClient = (id) => patch((p) => ({ ...p, clientTasks: (p.clientTasks || []).filter((c) => c.id !== id) }))

  // Avance del proyecto = TODAS las tareas del plan asociado (equipo + cliente).
  const prog = progressBreakdown(project, linkedPlan)
  const planWeeks = linkedPlan ? [...(linkedPlan.weeks || [])].sort((a, b) => (a.n || 0) - (b.n || 0)) : []
  // Sin plan asociado no hay detalle que abrir: las tarjetas llevan a asociar uno.
  const openKpi = () => (linkedPlan ? setKpiModal('plan') : setPlanOpen(true))
  const kpiSub = linkedPlan ? 'ver detalle' : 'asociar un plan'

  // Enlaces externos: el "Plan público" y "Progreso" solo existen si el plan
  // está publicado. Su estado vacío ya lo cubre el panel "Plan", así que no se
  // muestran huecos duplicados.
  const testingUrl = project.testingUrl || project.productionUrl || ''
  const planUrl = (linkedPlan && linkedPlan.publishedUrl) || ''
  let planDashUrl = ''
  if (planUrl) { try { const u = new URL(planUrl); planDashUrl = `${u.origin}/dashboard${u.pathname}` } catch (e) { planDashUrl = '' } }
  const scopeN = (project.scopeFiles?.length || 0) + (project.salesLinks?.length || 0)
  const accounts = project.accounts || []
  const accDone = accounts.filter((a) => a.done).length
  const vaultN = (project.vault || []).length
  const adv = lastAdvanceInfo(project)
  const me = (data.team || []).find((u) => u.id === myId)

  return (
    <div className="pd-shell">
      {/* ── COLUMNA PRINCIPAL ────────────────────────────────────────────── */}
      <div className="pd-main scroll-y">
        <button className="pd-back" onClick={onBack}>
          <I2.chevR width={14} height={14} style={{ transform: 'scaleX(-1)' }} /> Proyectos
        </button>

        {/* IDENTIDAD — nombre, quién es el cliente, estado y la única acción
            destacada del encabezado. */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="pd-title">{project.name}</h1>
              <PriorityMenu value={project.priority} onChange={(v) => patch((p) => ({ ...p, priority: v }))} size={18} />
            </div>
            <div className="pd-meta">
              {project.kind === 'interno' ? '◆ Interno · Insights' : (client?.company || 'Sin cliente')}
              {client?.name && <><i>·</i>{client.name}</>}
              {project.stack && <><i>·</i>{project.stack}</>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <StatusMenu status={project.status} onChange={(s) => { patch((p) => ({ ...p, status: s })); if (s === 'pending') setPendingPrompt(true) }} />
            {project.status === 'pending' && (project.expectedStartDate
              ? <span onClick={() => setPendingPrompt(true)} style={{ cursor: 'pointer' }}><PendingDateChip date={project.expectedStartDate} /></span>
              : <button className="tag click" onClick={() => setPendingPrompt(true)} style={{ color: 'var(--blue)', background: 'transparent', borderColor: 'var(--blue)' }}><I2.calendar width={12} height={12} /> Definir ingreso</button>)}
            <button className="pd-cta" onClick={() => setEditOpen(true)}>
              Editar proyecto <i><I2.pencil width={13} height={13} /></i>
            </button>
          </div>
        </div>

        {/* EQUIPO + ETIQUETAS */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pd-eyebrow">Equipo</span>
            <TeamAvatars assignments={project.assignments} team={data.team} onChange={(assignments) => patch((p) => ({ ...p, assignments }))} size={30} ring="var(--bg)" />
          </div>
          <span className="hide-mobile" style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span className="pd-eyebrow">Etiquetas</span>
            <ProjectTags tags={project.tags} onChange={(tags) => patch((p) => ({ ...p, tags }))} />
          </div>
        </div>

        {/* CONSOLA DE ACCIONES — dos grupos, no nueve botones iguales:
            arriba lo que SALE de la app, abajo lo que abre un panel acá adentro. */}
        <div className="pd-panel pd-console" style={{ marginTop: 18 }}>
          <span className="pd-eyebrow">Enlaces</span>
          <div className="pd-row">
            <ExtLink Ico={I2.ext} label="Testing" url={testingUrl} onEmpty={() => setEditOpen(true)} />
            <ExtLink Ico={I2.rocket} label="Producción" url={project.productionUrl} onEmpty={() => setEditOpen(true)} />
            <ExtLink Ico={I2.folder} label="Drive" url={project.driveUrl} onEmpty={() => setDriveOpen(true)} />
            {planUrl && <ExtLink Ico={I2.calendar} label="Plan público" url={planUrl} />}
            {planDashUrl && <ExtLink Ico={I2.gantt} label="Progreso" url={planDashUrl} />}
          </div>

          <div className="pd-rule" />

          <span className="pd-eyebrow">Paneles</span>
          <div className="pd-row">
            <PanelBtn Ico={I2.pdf} label="Alcance" count={scopeN}
              onClick={() => setScopeOpen(true)} title="Propuesta, alcance firmado y links de venta" />
            <PanelBtn Ico={I2.key} label="Cuentas" count={accounts.length ? `${accDone}/${accounts.length}` : 0}
              tone={accounts.length && accDone < accounts.length ? 'accent' : undefined}
              onClick={() => setAccountsOpen(true)}
              title={accounts.length ? `${accDone} de ${accounts.length} cuentas listas` : 'Cuentas y accesos que necesita el proyecto (Supabase, GitHub, Vercel…)'} />
            <PanelBtn Ico={I2.lock} label="Datos" count={vaultN}
              onClick={() => setVaultOpen(true)} title="Datos y credenciales del cliente (correos, contraseñas, dominios, hosting…)" />
            <PanelBtn Ico={I2.eye} label="Compartir" dot={project.shareEnabled ? 'var(--green)' : undefined}
              onClick={() => setShareOpen(true)}
              title={project.shareEnabled ? 'El cliente tiene acceso a la vista compartida' : 'Compartir la vista con el cliente (link + contraseña)'} />
            <PanelBtn Ico={I2.calendar} label="Plan"
              onClick={() => setPlanOpen(true)} title={linkedPlan ? 'Plan asociado — cambiar o publicar' : 'Asociar un plan de ejecución'} />
          </div>
        </div>

        {/* TIRA DE STATS — las 4 métricas del plan + el último avance, que en el
            detalle sí se usa (abre el registro de avance). Un solo bloque:
            antes eran cuatro cajas sueltas compitiendo con su propio marco. */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="pd-stats" style={{ marginTop: 18, marginBottom: 26 }}>
          <motion.button variants={rise} className="pd-stat" onClick={openKpi}>
            <span className="k">Tareas del plan</span><span className="v">{prog.total}</span><span className="s">{kpiSub}</span>
          </motion.button>
          <motion.button variants={rise} className="pd-stat" onClick={openKpi}>
            <span className="k">Terminadas</span><span className="v" style={{ color: 'var(--green)' }}>{prog.done}</span><span className="s">{kpiSub}</span>
          </motion.button>
          <motion.button variants={rise} className="pd-stat" onClick={openKpi}>
            <span className="k">Pendientes del cliente</span><span className="v" style={{ color: RESPONSABLES.cliente.color }}>{prog.pendingCliente}</span><span className="s">{kpiSub}</span>
          </motion.button>
          <motion.button variants={rise} className="pd-stat" onClick={openKpi}>
            <span className="k">% Avance</span><span className="v" style={{ color: progressColor(prog.pct) }}>{prog.pct}%</span><span className="s">{kpiSub}</span>
          </motion.button>
          <motion.button variants={rise} className="pd-stat" onClick={openKpi} title="Última vez que se tocó una tarea del plan">
            <span className="k">Último avance</span>
            <span className="v" style={{ fontSize: 17, color: adv.none ? 'var(--text-faint)' : adv.stale ? 'var(--yellow)' : 'var(--text)' }}>{adv.text}</span>
            <span className="s">{adv.stale ? 'hace más de una semana' : kpiSub}</span>
          </motion.button>
        </motion.div>

        {/* CICLO DE VIDA — en qué fase está y cómo se mueve */}
        <LifecyclePanel project={project} client={client} planProgress={prog} patch={patch}
          onEdit={() => setEditOpen(true)} logActivity={logActivity} replyTo={me?.email || ''} />

        {/* AVANCE DEL PLAN — acordeón de semanas, tachado + % en vivo para el
            cliente. Tachar una tarea marca "último avance" del proyecto. */}
        <PlanProgress linkedPlan={linkedPlan} patchPlan={patchPlan} onAssociate={() => setPlanOpen(true)} markProgress={() => patch((p) => ({ ...p, lastProgressAt: new Date().toISOString() }))} />

        {/* TAREAS DEL EQUIPO (sincronizadas con Tareas) + DEL CLIENTE (dependencias) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginBottom: 26 }}>
          <section>
            <div className="pd-h">
              <h2>Tareas del equipo</h2>
              <span className="sub">sincronizadas con la sección Tareas</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {teamTasks.length === 0
                ? <div className="pd-hollow">
                    <strong style={{ color: 'var(--text-dim)', fontSize: 13 }}>Todavía no hay tareas del equipo</strong>
                    Agregá una acá abajo, o asignale este proyecto a una tarea desde la sección Tareas.
                  </div>
                : <div className="pd-list">
                    {teamTasks.map((t) => (
                      <div key={t.id} className="pd-item">
                        {t.assigneeId ? <Avatar user={userOf(t.assigneeId)} size={22} ring="var(--card)" /> : <Avatar empty size={22} ring="var(--card)" />}
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, textDecoration: t.status === 'terminado' ? 'line-through' : 'none', color: t.status === 'terminado' ? 'var(--text-faint)' : 'var(--text)' }}>{t.name}</span>
                        <select className="input" aria-label={`Estado de ${t.name}`} value={t.status || 'pendiente'} onChange={(e) => setTeamStatus(t.id, e.target.value)} style={{ width: 'auto', flex: 'none', padding: '5px 8px', fontSize: 12 }}>{TASK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
                      </div>
                    ))}
                  </div>}
              <AddTaskInput onAdd={addTeamTask} />
            </div>
          </section>
          <section>
            <div className="pd-h">
              <h2>Tareas del cliente</h2>
              <span className="sub">dependencias que frenan el avance</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {clientTasks.length === 0
                ? <div className="pd-hollow">
                    <strong style={{ color: 'var(--text-dim)', fontSize: 13 }}>No dependemos de nada del cliente</strong>
                    Anotá acá lo que tenga que mandar o aprobar para que no se pierda en el chat.
                  </div>
                : <div className="pd-list">
                    {clientTasks.map((c) => (
                      <div key={c.id} className="pd-item">
                        <button onClick={() => toggleClient(c.id)} aria-pressed={!!c.done} title={c.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
                          style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: '1.5px solid ' + (c.done ? 'var(--green)' : 'var(--border-strong)'), background: c.done ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center' }}>
                          {c.done && <I2.check width={13} height={13} style={{ color: '#fff' }} />}
                        </button>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.4, textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text-faint)' : 'var(--text)' }}>{c.text}</span>
                        <button className="btn btn-sm btn-ghost" onClick={() => delClient(c.id)} title="Eliminar" style={{ padding: 4, flex: 'none', color: 'var(--text-faint)' }}><I2.x width={13} height={13} /></button>
                      </div>
                    ))}
                  </div>}
              <AddTaskInput onAdd={addClientTask} />
            </div>
          </section>
        </div>
      </div>

      {/* ── RAIL DERECHO — REGISTRO DE ACTIVIDAD (calls · notas · looms) ──── */}
      <ActivityRegistry project={project} patch={patch} />

      {/* KPI MODAL — el detalle de las 4 tarjetas: las tareas del plan, por semana */}
      <Modal open={kpiModal === 'plan'} onClose={() => setKpiModal(null)} title="Avance del plan" sub={linkedPlan?.title || ''} width={640}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Progress value={prog.pct} showLabel height={12} color={progressColor(prog.pct)} />
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {prog.done}/{prog.total} tareas · equipo {prog.equipoDone}/{prog.equipoTotal} · cliente {prog.clienteDone}/{prog.clienteTotal}
          </div>
          {planWeeks.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>El plan todavía no tiene semanas cargadas.</div>}
          {planWeeks.map((w) => {
            const wp = weekProgress(w)
            const tasks = Array.isArray(w.tasks) ? w.tasks : []
            return (
              <div key={w.n}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>SEM {String(w.n).padStart(2, '0')}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title || 'Sin título'}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{wp.done}/{wp.total}</span>
                </div>
                {tasks.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', paddingLeft: 2 }}>Sin tareas.</div>}
                {tasks.map((t, i) => {
                  const done = taskDone(t)
                  return (
                    <div key={(t && t.id) || i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0 4px 2px', fontSize: 13.5 }}>
                      <span style={{ color: done ? 'var(--green)' : 'var(--text-faint)', flexShrink: 0 }}>{done ? '✓' : '·'}</span>
                      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.45, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-faint)' : 'var(--text)' }}>
                        {taskText(t) || <span style={{ fontStyle: 'italic', color: 'var(--text-faint)' }}>Tarea sin texto</span>}
                      </span>
                      {taskResponsable(t) === 'cliente' && <span className="tag" style={{ color: RESPONSABLES.cliente.color, background: hexA(RESPONSABLES.cliente.color, 0.14), flexShrink: 0 }}>cliente</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </Modal>

      <EditProjectModal open={editOpen} project={project} clients={data.clients} onClose={() => setEditOpen(false)} onSave={saveProject} onDelete={(id) => { projectStore.remove(id); onBack() }} />
      <PendingDatePrompt open={pendingPrompt} project={project} onClose={() => setPendingPrompt(false)} onSave={(d) => { patch((p) => ({ ...p, expectedStartDate: d })); setPendingPrompt(false) }} />
      <ScopeModal open={scopeOpen} project={project} onClose={() => setScopeOpen(false)} patch={patch} />
      <AccountsModal open={accountsOpen} project={project} onClose={() => setAccountsOpen(false)} patch={patch} />
      <VaultModal open={vaultOpen} project={project} onClose={() => setVaultOpen(false)} patch={patch} />
      <Modal open={driveOpen} onClose={() => setDriveOpen(false)} title="Drive del proyecto" sub={project.name} width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Enlace de Google Drive (compartido con el cliente)">
            <input className="input" value={project.driveUrl || ''} onChange={(e) => patch((p) => ({ ...p, driveUrl: e.target.value }))} placeholder="https://drive.google.com/…" autoFocus />
          </Field>
          {project.driveUrl && <a href={project.driveUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{ justifyContent: 'center' }}><I2.ext width={14} height={14} /> Abrir Drive</a>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-accent" onClick={() => setDriveOpen(false)}><I2.check width={15} height={15} /> Listo</button></div>
        </div>
      </Modal>
      <ShareModal open={shareOpen} project={project} onClose={() => setShareOpen(false)} patch={patch} />
      <Modal open={planOpen} onClose={() => setPlanOpen(false)} title="Plan del proyecto" sub={project.name} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {project.planId && !linkedPlan && (
            <div className="surface" style={{ padding: 12, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, borderLeft: '3px solid var(--yellow)' }}>
              El plan que estaba asociado ya no existe. Elegí otro abajo o quitá la referencia.
              <div style={{ marginTop: 10 }}><button className="btn btn-sm" onClick={() => associatePlan(null)}>Quitar referencia</button></div>
            </div>
          )}
          <Field label="Plan asociado">
            <select className="input" value={linkedPlan ? linkedPlan.id : ''} onChange={(e) => associatePlan(e.target.value || null)}>
              <option value="">— Sin plan —</option>
              {(plans || []).map((pl) => <option key={pl.id} value={pl.id}>{pl.title || 'Plan sin título'}{pl.clientName ? ` · ${pl.clientName}` : ''}</option>)}
            </select>
          </Field>
          {linkedPlan ? (
            <>
              {linkedPlan.publishedUrl && (
                <Field label="Enlace publicado">
                  <input className="input" value={linkedPlan.publishedUrl} onChange={(e) => setPlanUrl(e.target.value)} />
                </Field>
              )}
              {linkedPlan.publishedUrl
                ? <a href={linkedPlan.publishedUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{ justifyContent: 'center' }}><I2.ext width={14} height={14} /> Abrir plan</a>
                : <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>Este plan todavía no está publicado. Tocá "Publicar" en el Planificador — el enlace va a aparecer acá solo, no hace falta pegarlo a mano.</div>}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>Asociá un plan del Planificador para abrirlo desde acá. Publicalo con el botón "Publicar" del Planificador y el enlace va a quedar vinculado automáticamente.</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-accent" onClick={() => setPlanOpen(false)}><I2.check width={15} height={15} /> Listo</button></div>
        </div>
      </Modal>
    </div>
  )
}

/* ============================================================================
   16 · REGISTRO DE ACTIVIDAD DEL PROYECTO (calls · notas · looms)
============================================================================ */
const ACTIVITY_TYPES = [
  { key: 'llamada', label: 'Llamada', color: '#38BDF8', icon: I2.phone },
  { key: 'nota', label: 'Nota', color: '#F59E0B', icon: I2.comment },
  { key: 'loom', label: 'Loom', color: '#A855F7', icon: I2.ext },
]
const actTypeMeta = (t) => ACTIVITY_TYPES.find((x) => x.key === t) || ACTIVITY_TYPES[0]

function ActivityRegistry({ project, patch }) {
  const { data } = useApp()
  const team = data.team || []
  const myId = typeof localStorage !== 'undefined' ? localStorage.getItem('my_team_id') : ''
  const userOf = (id) => team.find((u) => u.id === id)
  const [type, setType] = useState('nota')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [priv, setPriv] = useState(false)   // nota privada (solo equipo) vs pública (la ve el cliente)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const manual = project.activity || []
  // calls de la sección Calls asignadas a este proyecto → integradas automáticamente
  const projectCalls = (data.calls || []).filter((c) => c.projectId === project.id).map((c) => ({
    id: 'call-' + c.id, fromCalls: true, type: 'llamada', date: c.date, authorId: '', authorName: c.advisor, note: c.summary || '', link: c.fathomUrl || '',
  }))
  const entries = [...manual, ...projectCalls].sort((a, b) => new Date(b.date) - new Date(a.date))

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])]; if (!files.length) return
    setBusy(true)
    for (const f of files) { if (!f.type.startsWith('image/')) continue; try { const url = await fileToImageDataURL(f); setPhotos((s) => [...s, url]) } catch (err) { /* ignore */ } }
    setBusy(false); e.target.value = ''
  }
  const add = () => {
    if (type === 'nota' ? (!note.trim() && photos.length === 0) : !link.trim()) return
    const entry = { id: uid(), type, date: dateInputISO(date), authorId: myId || '', link: type === 'nota' ? '' : link.trim(), note: note.trim(), photos: type === 'nota' ? photos : [], visibility: type === 'nota' && priv ? 'private' : 'public' }
    patch((p) => ({ ...p, activity: [entry, ...(p.activity || [])] }))
    setLink(''); setNote(''); setPhotos([]); setPriv(false); setDate(new Date().toISOString().slice(0, 10))
  }
  const del = (id) => patch((p) => ({ ...p, activity: (p.activity || []).filter((x) => x.id !== id) }))

  const ready = type === 'nota' ? (!!note.trim() || photos.length > 0) : !!link.trim()
  const publicCount = entries.filter((e) => e.type !== 'nota' || e.visibility !== 'private').length

  return (
    <div className="pd-rail">
      <div style={{ padding: '16px 16px 13px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 9, flex: 'none', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <I2.pulse width={15} height={15} />
          </span>
          <strong style={{ fontSize: 14.5, letterSpacing: '-0.015em' }}>Registro de actividad</strong>
          {entries.length > 0 && <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>{entries.length}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 5, lineHeight: 1.5 }}>
          Calls, notas y looms del proyecto.{entries.length > 0 && <> El cliente ve {publicCount} de {entries.length}.</>}
        </div>
      </div>

      {/* COMPOSITOR — el formulario y el historial son dos cosas distintas y se
          ven distintas: el compositor va sobre el fondo elevado, cada entrada
          es una tarjeta. */}
      <div style={{ padding: 13, borderBottom: '1px solid var(--border)' }}>
        <div className="pj-seg" role="tablist" aria-label="Tipo de registro" style={{ width: '100%', marginBottom: 10 }}>
          {ACTIVITY_TYPES.map((t) => (
            <button key={t.key} role="tab" aria-selected={type === t.key} onClick={() => setType(t.key)}
              style={{ flex: 1, justifyContent: 'center', color: type === t.key ? t.color : undefined }}>
              <t.icon width={13} height={13} /> {t.label}
            </button>
          ))}
        </div>

        {type === 'nota' ? (
          <>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nota"
              placeholder="Qué pasó, qué se definió, qué hay que recordar…" style={{ resize: 'none', fontSize: 13.5 }} />
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {photos.map((s, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={s} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)' }} />
                    <button onClick={() => setPhotos((a) => a.filter((_, j) => j !== i))} title="Quitar la foto"
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 99, background: 'var(--red)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                      <I2.x width={10} height={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <input className="input mono" value={link} onChange={(e) => setLink(e.target.value)} type="url" aria-label="Enlace"
            placeholder={type === 'loom' ? 'https://loom.com/share/…' : 'https://fathom.video/…'} style={{ fontSize: 12.5 }} />
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />

        {type === 'nota' && (
          <div className="pj-seg" role="group" aria-label="Quién ve esta nota" style={{ width: '100%', marginTop: 8 }}>
            <button aria-pressed={!priv} onClick={() => setPriv(false)} style={{ flex: 1, justifyContent: 'center', color: !priv ? 'var(--green)' : undefined }}>
              <I2.eye width={12} height={12} /> La ve el cliente
            </button>
            <button aria-pressed={priv} onClick={() => setPriv(true)} style={{ flex: 1, justifyContent: 'center', color: priv ? 'var(--accent)' : undefined }}>
              <I2.eyeOff width={12} height={12} /> Solo el equipo
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input type="date" className="input mono" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha del registro"
            style={{ width: 'auto', padding: '6px 8px', fontSize: 12 }} />
          {type === 'nota' && (
            <button className="pd-btn" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()} title="Adjuntar una foto"
              style={{ padding: '0 9px', ...(busy ? { opacity: 0.5, cursor: 'progress' } : null) }}>
              <I2.paperclip width={14} height={14} />{busy ? ' Subiendo…' : ''}
            </button>
          )}
          <button className="pd-cta" onClick={add} disabled={!ready} style={{ marginLeft: 'auto', ...(ready ? null : { opacity: 0.42, cursor: 'not-allowed' }) }}>
            Registrar <i><I2.check width={13} height={13} /></i>
          </button>
        </div>
      </div>

      {/* HISTORIAL — la barrita de la izquierda dice de un vistazo quién lo ve:
          verde = el cliente, naranja = solo el equipo. */}
      <div className="pd-rail-list scroll-y">
        {entries.length === 0 ? (
          <div className="pd-empty">
            <span className="ic"><I2.comment width={21} height={21} /></span>
            <span className="t">Todavía no hay nada anotado</span>
            <span className="d">Cada call, nota o loom que dejes acá queda con fecha y autor. Las notas públicas también las ve el cliente en su link.</span>
          </div>
        ) : entries.map((en) => {
          const m = actTypeMeta(en.type)
          const u = userOf(en.authorId)
          const isPriv = en.type === 'nota' && en.visibility === 'private'
          const hasBody = !!(en.note || (en.photos || []).length || en.link)
          return (
            <div key={en.id} className={`pd-entry${isPriv ? ' priv' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: hasBody ? 8 : 0 }}>
                <span className="tag" style={{ color: m.color, background: m.color + '1f', borderColor: 'transparent' }}><m.icon width={11} height={11} /> {m.label}</span>
                {isPriv
                  ? <span className="tag" title="El cliente no la ve" style={{ color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'transparent' }}><I2.eyeOff width={11} height={11} /> Solo el equipo</span>
                  : <span className="tag" title="El cliente la ve en su link" style={{ color: 'var(--green)', background: 'var(--green-soft)', borderColor: 'transparent' }}><I2.eye width={11} height={11} /> Cliente</span>}
                {en.fromCalls && <span className="tag" style={{ color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>desde Calls</span>}
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginLeft: 'auto', flex: 'none' }}>{fmtDate(en.date)}</span>
                {!en.fromCalls && <button className="btn btn-sm btn-ghost" onClick={() => del(en.id)} title="Eliminar el registro" style={{ padding: 3, flex: 'none', color: 'var(--text-faint)' }}><I2.x width={12} height={12} /></button>}
              </div>
              {en.note && <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>{en.note}</div>}
              {(en.photos || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{en.photos.map((s, i) => <a key={i} href={s} target="_blank" rel="noreferrer"><img src={s} alt="Adjunto" style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)' }} /></a>)}</div>}
              {en.link && <a href={en.link} target="_blank" rel="noreferrer" className="pd-lnk" style={{ marginTop: 9 }}><I2.ext width={13} height={13} /> Abrir {en.type === 'loom' ? 'el Loom' : 'la call'}<span className="go"><I2.arrowRight width={12} height={12} /></span></a>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 11, color: 'var(--text-faint)' }}>
                {u ? <Avatar user={u} size={18} ring="var(--card)" /> : null}<span>{u ? u.name : (en.authorName || 'Alguien')}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================================
   16b · PROJECT AI CHAT (deprecado — el asistente ahora vive en el menú)
============================================================================ */
/* Resumen compacto del plan para los prompts de IA: una línea por semana con su
   título, el avance (terminadas/total) y las tareas, marcando las terminadas. */
function planPromptText(plan, indent = '  ') {
  if (!plan) return `${indent}(sin plan asociado)`
  const weeks = [...(plan.weeks || [])].sort((a, b) => (a.n || 0) - (b.n || 0))
  if (!weeks.length) return `${indent}(el plan no tiene semanas cargadas)`
  return weeks.map((w) => {
    const prg = weekProgress(w)
    const tasks = (Array.isArray(w.tasks) ? w.tasks : [])
      .map((t) => `${taskText(t)}${taskDone(t) ? ' ✓' : ''}${taskResponsable(t) === 'cliente' ? ' (cliente)' : ''}`)
      .filter((x) => x.trim())
      .join(' · ')
    return `${indent}- Sem ${w.n} · ${w.title || 'sin título'} [${prg.done}/${prg.total}]${tasks ? `: ${tasks}` : ''}`
  }).join('\n')
}

function buildSystemPrompt(project, client, plan) {
  const prog = progressBreakdown(project, plan)
  const pa = project.pendingAgency.map((p) => `  - [${p.priority}] ${p.title}: ${p.description}`).join('\n') || '  (ninguno)'
  const pc = project.pendingClient.map((p) => `  - [${p.priority}] ${p.title}: ${p.description}`).join('\n') || '  (ninguno)'
  return `Sos el asistente IA del proyecto "${project.name}" de Insights Software para el cliente ${client?.company} (${client?.name}).

KICK-OFF:
${project.kickoff}

STACK: ${project.stack}
AVANCE: ${prog.pct}% · ${prog.done}/${prog.total} tareas del plan (equipo ${prog.equipoDone}/${prog.equipoTotal} · cliente ${prog.clienteDone}/${prog.clienteTotal})

PLAN (${plan?.title || 'sin plan'}) — semanas y tareas:
${planPromptText(plan)}

PENDIENTE AGENCIA:
${pa}

PENDIENTE CLIENTE:
${pc}

RIESGOS: ${project.risks.map((r) => `${r.description} (${r.severity})`).join('; ')}

INSTRUCCIONES:
- Recordá SIEMPRE los ítems pendientes del proyecto (agencia y cliente).
- Podés leer transcripciones pegadas para resumirlas.
- Cuando el usuario pegue una transcripción de una call, resumila, extraé los action items y los pendientes del cliente.
- Respondé en español, conciso y accionable. Usá viñetas cuando ayude.`
}

function ProjectChat({ project, client, patch }) {
  const { plans } = useApp()
  const linkedPlan = (plans || []).find((pl) => pl.id === project.planId) || null
  const [activeChatId, setActiveChatId] = useState(project.chats[0]?.id || null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef(null)
  const activeChat = project.chats.find((c) => c.id === activeChatId)

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [activeChat?.messages.length, sending])

  const newChat = () => {
    const id = uid()
    patch((p) => ({ ...p, chats: [{ id, date: NOW().toISOString(), title: 'Nueva conversación', messages: [] }, ...p.chats] }))
    setActiveChatId(id); setShowHistory(false)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    let chatId = activeChatId
    if (!chatId) { chatId = uid(); patch((p) => ({ ...p, chats: [{ id: chatId, date: NOW().toISOString(), title: 'Nueva conversación', messages: [] }, ...p.chats] })); setActiveChatId(chatId) }
    const userMsg = { role: 'user', content: text, timestamp: Date.now() }
    patch((p) => ({ ...p, chats: p.chats.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? (text.length > 38 ? text.slice(0, 38) + '…' : text) : c.title } : c) }))
    setInput(''); setSending(true); setError(null)

    const history = [...(project.chats.find((c) => c.id === chatId)?.messages || []), userMsg]
    try {
      const reply = await anthropicChat({ system: buildSystemPrompt(project, client, linkedPlan), messages: history })
      patch((p) => ({ ...p, chats: p.chats.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, { role: 'assistant', content: reply, timestamp: Date.now() }] } : c) }))
    } catch (e) {
      if (e.message === 'NO_KEY') setError('Configurá tu Anthropic API key en ⚙ Ajustes para usar el chat.')
      else setError(e.message)
    } finally { setSending(false) }
  }

  return (
    <div style={{ flex: '0 0 360px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', minWidth: 320 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><I2.spark width={17} height={17} style={{ color: 'var(--accent)' }} /><strong style={{ fontFamily: 'Bricolage Grotesque', fontSize: 15 }}>Asistente del proyecto</strong></div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowHistory((v) => !v)} title="Historial"><I2.clock width={15} height={15} /></button>
          <button className="btn btn-sm btn-ghost" onClick={newChat} title="Nuevo chat"><I2.plus width={15} height={15} /></button>
        </div>
      </div>

      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: 10, maxHeight: 220, overflowY: 'auto' }}>
              {project.chats.length === 0 && <div style={{ padding: 10, color: 'var(--text-faint)', fontSize: 13 }}>Sin conversaciones aún.</div>}
              {project.chats.map((c) => (
                <button key={c.id} onClick={() => { setActiveChatId(c.id); setShowHistory(false) }} className="row-hover" style={{ width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 9, background: c.id === activeChatId ? 'var(--card-hover)' : 'transparent', marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{fmtDate(c.date)} · {c.messages.length} msgs</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="scroll-y" style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(!activeChat || activeChat.messages.length === 0) && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-faint)', maxWidth: 260 }}>
            <I2.spark width={28} height={28} style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>Preguntá sobre <strong>{project.name}</strong> o pegá una transcripción de call para que la resuma y extraiga action items.</div>
          </div>
        )}
        {activeChat?.messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
            <div style={{ padding: '10px 13px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--card)', color: m.role === 'user' ? '#fff' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)' }}>{m.content}</div>
          </motion.div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '10px 13px' }}>
          {[0, 1, 2].map((i) => <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--text-faint)' }} />)}
        </div>}
      </div>

      {error && <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--red)', background: 'var(--red-soft)' }}>{error}</div>}

      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <textarea className="input" rows={2} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Pegá una transcripción, preguntá sobre el proyecto…" style={{ resize: 'none', paddingRight: 44 }} />
          <button onClick={send} disabled={sending || !input.trim()} className="btn-accent" style={{ position: 'absolute', right: 8, bottom: 8, width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', opacity: input.trim() ? 1 : 0.5 }}><I2.send width={15} height={15} /></button>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 6, textAlign: 'center' }} className="mono">{CHAT_MODEL} · Enter envía · Shift+Enter salto</div>
      </div>
    </div>
  )
}

/* ============================================================================
   16b · IA ASSISTANT — chat global sobre todos los proyectos y reuniones
============================================================================ */
function buildGlobalSystemPrompt(data, plans) {
  const clientName = (id) => data.clients.find((c) => c.id === id)?.company || '—'
  const planById = new Map((plans || []).map((pl) => [pl.id, pl]))
  const projects = (data.projects || []).map((p) => {
    const plan = p.planId ? planById.get(p.planId) || null : null
    const prog = progressBreakdown(p, plan)
    const pa = (p.pendingAgency || []).map((x) => `${x.title} [${x.priority}]`).join('; ') || 'ninguno'
    const pc = (p.pendingClient || []).map((x) => `${x.title} [${x.priority}]`).join('; ') || 'ninguno'
    const risks = (p.risks || []).map((r) => `${r.description} (${r.severity})`).join('; ') || 'ninguno'
    return `### ${p.name} — ${clientName(p.clientId)} · estado ${projStatusMeta(p.status).label} · avance ${prog.pct}% (${prog.done}/${prog.total} tareas, cliente ${prog.clienteDone}/${prog.clienteTotal})
Stack: ${p.stack || '—'}
Kick-off: ${p.kickoff || '—'}
Plan (${plan?.title || 'sin plan asociado'}):
${planPromptText(plan, '    ')}
Pendiente agencia: ${pa}
Pendiente cliente: ${pc}
Riesgos: ${risks}`
  }).join('\n\n')
  const calls = (data.calls || []).map((c) => `- [${fmtDate(c.date)}] ${clientName(c.clientId)} · asesor ${c.advisor}
  Resumen: ${c.summary}
  Transcript: ${c.transcript || '(sin transcript)'}`).join('\n\n') || '(sin reuniones cargadas)'
  const team = (data.team || []).map((u) => u.name).join(', ')
  return `Sos el asistente IA de Insights Software, una agencia de desarrollo de software. Tenés acceso COMPLETO a todos los proyectos, sus planes (semanas y tareas), pendientes, riesgos y a las reuniones (calls) con transcripciones. Respondé SIEMPRE en español, de forma concisa, clara y accionable. Usá viñetas y datos concretos (estados, %, fechas). Si te preguntan por avances, basate en las tareas del plan (las marcadas con ✓ están terminadas) y el % de avance. Las tareas marcadas "(cliente)" dependen del cliente, no del equipo. Si te preguntan por reuniones, usá los resúmenes y transcripts. Si falta información, decilo explícitamente.

EQUIPO: ${team || '—'}

=== PROYECTOS (${(data.projects || []).length}) ===
${projects || '(sin proyectos)'}

=== REUNIONES / CALLS (${(data.calls || []).length}) ===
${calls}`
}

const ASSISTANT_SUGGESTIONS = [
  '¿Cómo viene el avance general de todos los proyectos?',
  '¿Qué proyectos están más atrasados o con riesgos altos?',
  'Resumime lo más importante de las últimas reuniones',
  '¿Qué pendientes de cliente están bloqueando avances?',
]

function AssistantView() {
  const { data, chatStore, plans } = useApp()
  const chats = data.assistantChats || []
  const [activeId, setActiveId] = useState(chats[0]?.id || null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const active = chats.find((c) => c.id === activeId)

  // Las conversaciones se guardan por fila (chatStore): create + patch por id.
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [active?.messages.length, sending])

  const newChat = () => { const id = uid(); chatStore.create({ id, date: NOW().toISOString(), title: 'Nueva conversación', messages: [] }); setActiveId(id) }

  const sendText = async (text) => {
    text = (text || '').trim()
    if (!text || sending) return
    let chatId = activeId
    if (!chatId) { chatId = uid(); chatStore.create({ id: chatId, date: NOW().toISOString(), title: 'Nueva conversación', messages: [] }); setActiveId(chatId) }
    const prev = (chatStore.items.find((c) => c.id === chatId)?.messages) || []
    const userMsg = { role: 'user', content: text, timestamp: Date.now() }
    chatStore.patch(chatId, (c) => ({ ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? (text.length > 42 ? text.slice(0, 42) + '…' : text) : c.title }))
    setInput(''); setSending(true); setError(null)
    try {
      const reply = await anthropicChat({ system: buildGlobalSystemPrompt(data, plans), messages: [...prev, userMsg] })
      chatStore.patch(chatId, (c) => ({ ...c, messages: [...c.messages, { role: 'assistant', content: reply, timestamp: Date.now() }] }))
    } catch (e) {
      if (e.message === 'NO_KEY') setError('Configurá tu Anthropic API key en ⚙ Ajustes para usar el asistente.')
      else setError(e.message)
    } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* conversations */}
      <div style={{ width: 250, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)' }}>
        <div style={{ padding: 14 }}>
          <button className="btn btn-accent" onClick={newChat} style={{ width: '100%', justifyContent: 'center' }}><I2.plus width={15} height={15} /> Nueva conversación</button>
        </div>
        <div className="scroll-y" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
          {chats.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', padding: 10 }}>Sin conversaciones aún.</div>}
          {chats.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)} className="row-hover" style={{ width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 9, background: c.id === activeId ? 'var(--card-hover)' : 'transparent', marginBottom: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{fmtDate(c.date)} · {c.messages.length} msgs</div>
            </button>
          ))}
        </div>
      </div>

      {/* chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div ref={scrollRef} className="scroll-y" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {(!active || active.messages.length === 0) && (
              <div style={{ marginTop: '8vh', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', margin: '0 auto 16px' }}><I2.spark width={26} height={26} /></div>
                <h1 style={{ fontSize: 26, marginBottom: 8 }}>Asistente IA de Insights</h1>
                <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>Preguntá sobre el avance de los proyectos, sus planes, los pendientes<br />y lo que se habló en las reuniones.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 560, margin: '0 auto' }}>
                  {ASSISTANT_SUGGESTIONS.map((s) => (
                    <button key={s} className="surface surface-hover click" onClick={() => sendText(s)} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {active?.messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: m.role === 'user' ? 'var(--border-strong)' : 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Bricolage Grotesque' }}>{m.role === 'user' ? 'Vos' : <I2.spark width={15} height={15} />}</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', paddingTop: 3, color: m.role === 'user' ? 'var(--text)' : 'var(--text-dim)' }}>{m.content}</div>
              </motion.div>
            ))}
            {sending && <div style={{ display: 'flex', gap: 4, paddingLeft: 40 }}>{[0, 1, 2].map((i) => <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--text-faint)' }} />)}</div>}
          </div>
        </div>
        {error && <div style={{ padding: '8px 24px', fontSize: 12.5, color: 'var(--red)', background: 'var(--red-soft)', maxWidth: 760, margin: '0 auto', width: '100%' }}>{error}</div>}
        <div style={{ padding: '14px 24px 20px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
            <textarea className="input" rows={2} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input) } }}
              placeholder="Preguntá sobre los proyectos, avances, reuniones…" style={{ resize: 'none', paddingRight: 48 }} />
            <button onClick={() => sendText(input)} disabled={sending || !input.trim()} className="btn-accent" style={{ position: 'absolute', right: 8, bottom: 8, width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', opacity: input.trim() ? 1 : 0.5 }}><I2.send width={15} height={15} /></button>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 8, textAlign: 'center' }} className="mono">{CHAT_MODEL} · lee proyectos + reuniones · Enter envía</div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   16c · TAREAS — tabla / kanban, simple: asignado · tarea · entrega · notas · comentarios
============================================================================ */
/* fecha límite: chip que al clickear abre el calendario nativo (fondo negro/blanco según el tema vía color-scheme) */
function DueDate({ value, onChange }) {
  const ref = useRef(null)
  const iso = value ? value.slice(0, 10) : ''
  const today = new Date()
  const tstr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const overdue = iso && iso < tstr
  const openCal = (e) => { e.stopPropagation(); const el = ref.current; if (!el) return; try { el.showPicker() } catch (err) { el.focus() } }
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={openCal} className="tag" title={iso ? 'Cambiar fecha límite' : 'Poner fecha límite'}
        style={{ cursor: 'pointer', background: 'var(--bg-elevated)', borderColor: overdue ? 'var(--red)' : 'var(--border)', color: iso ? (overdue ? 'var(--red)' : 'var(--text)') : 'var(--text-faint)' }}>
        <I2.calendar width={13} height={13} />{iso ? fmtDate(value) : 'Fecha límite'}{overdue ? ' ⚠' : ''}
      </button>
      {iso && <button onClick={(e) => { e.stopPropagation(); onChange('') }} title="Quitar fecha" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 3, color: 'var(--text-faint)', background: 'transparent' }}><I2.x width={12} height={12} /></button>}
      <input ref={ref} type="date" value={iso} onChange={(e) => onChange(e.target.value ? dateInputISO(e.target.value) : '')}
        style={{ position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
    </span>
  )
}

function TaskDetailModal({ open, task, team, projects, onClose, onPatch, onDelete }) {
  if (!task) return <Modal open={open} onClose={onClose} title="Tarea" />
  return (
    <Modal open={open} onClose={onClose} title={task.name || 'Tarea'} sub="Tarea" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Tarea"><input className="input" value={task.name} onChange={(e) => onPatch({ name: e.target.value })} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          <Field label="Asignado">
            <select className="input" value={task.assigneeId || ''} onChange={(e) => onPatch({ assigneeId: e.target.value })}>
              <option value="">— Sin asignar —</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select className="input" value={task.priority || 'normal'} onChange={(e) => onPatch({ priority: e.target.value })}>
              {TASK_PRIORITY.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select className="input" value={task.status || 'pendiente'} onChange={(e) => onPatch({ status: e.target.value })}>
              {TASK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Fecha límite">
            <input className="input mono" type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ''} onChange={(e) => onPatch({ dueDate: e.target.value ? dateInputISO(e.target.value) : '' })} />
          </Field>
        </div>
        <Field label="¿De qué es esta tarea?">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm" onClick={() => onPatch({ scope: 'cliente' })} style={{ flex: '1 1 140px', justifyContent: 'center', background: taskScope(task) === 'cliente' ? 'var(--accent-soft)' : 'transparent', color: taskScope(task) === 'cliente' ? 'var(--accent)' : 'var(--text-dim)', borderColor: taskScope(task) === 'cliente' ? 'var(--accent-line)' : 'var(--border)' }}><I2.folder width={14} height={14} /> Proyecto de cliente</button>
            <button type="button" className="btn btn-sm" onClick={() => onPatch({ scope: 'interno', projectId: '' })} style={{ flex: '1 1 140px', justifyContent: 'center', background: taskScope(task) === 'interno' ? 'var(--accent-soft)' : 'transparent', color: taskScope(task) === 'interno' ? 'var(--accent)' : 'var(--text-dim)', borderColor: taskScope(task) === 'interno' ? 'var(--accent-line)' : 'var(--border)' }}><span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: 12 }}>I</span> Interno (Insights)</button>
          </div>
        </Field>
        {taskScope(task) === 'cliente' && (
          <Field label="Proyecto del cliente">
            <select className="input" value={task.projectId || ''} onChange={(e) => onPatch({ projectId: e.target.value, scope: 'cliente' })}>
              <option value="">— Elegí el proyecto —</option>
              {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notas / info para hacer la tarea mejor"><textarea className="input" rows={4} value={task.notes || ''} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Contexto, links, detalles…" /></Field>

        <CommentThread comments={task.comments} subject={`la tarea "${task.name}"`}
          onAdd={(c) => onPatch({ comments: [...(task.comments || []), c] })}
          onDelete={(id) => onPatch({ comments: (task.comments || []).filter((x) => x.id !== id) })} />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn" onClick={() => { onDelete(task.id); onClose() }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I2.trash width={15} height={15} /> Eliminar tarea</button>
          <button className="btn btn-accent" onClick={onClose}><I2.check width={15} height={15} /> Listo</button>
        </div>
      </div>
    </Modal>
  )
}

function TasksView() {
  const { data, createTask, patchTask, deleteTask, logActivity } = useApp()
  const [view, setView] = useState('table')
  const [openId, setOpenId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const tasks = data.tasks || []
  const team = data.team || []
  const userOf = (id) => team.find((u) => u.id === id)
  // Mutaciones por fila contra la tabla `tasks` (nunca setData → nunca vuelven al
  // blob monolítico). createTask/patchTask/deleteTask vienen del store useTasks.
  const addTask = () => { const id = uid(); createTask({ id, name: 'Nueva tarea', assigneeId: '', priority: 'normal', status: 'pendiente', scope: 'interno', projectId: '', notes: '', comments: [] }); setOpenId(id); logActivity && logActivity({ type: 'task-add', text: 'creó una tarea' }) }
  const updateTask = (id, fields) => {
    const prev = tasks.find((t) => t.id === id)
    patchTask(id, (t) => ({ ...t, ...fields }))
    if (fields.status === 'terminado' && prev && prev.status !== 'terminado' && logActivity) logActivity({ type: 'task-done', text: `terminó la tarea "${prev.name}"` })
  }
  const delTask = (id) => deleteTask(id)
  const openTask = tasks.find((t) => t.id === openId)

  const PrioFlag = ({ p, withLabel }) => {
    const m = taskPrioMeta(p)
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: m.color, fontSize: 13, fontWeight: 600 }} title={`Prioridad: ${m.label}`}><I2.flag width={15} height={15} />{withLabel && m.label}</span>
  }
  const Assignee = ({ id, size = 26 }) => {
    const u = userOf(id)
    return u ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar user={u} size={size} ring="var(--card)" /><span style={{ fontSize: 13.5, fontWeight: 600 }}>{u.name}</span></span>
      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)' }}><Avatar empty size={size} ring="var(--card)" /><span style={{ fontSize: 13 }}>Sin asignar</span></span>
  }
  const projName = (id) => (data.projects || []).find((p) => p.id === id)?.name
  const ScopeTag = ({ t }) => {
    if (taskScope(t) === 'cliente') {
      const n = projName(t.projectId)
      return <span className="tag" style={{ color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', fontSize: 10.5 }}>{n || 'Cliente · sin proyecto'}</span>
    }
    return <span className="tag" style={{ color: 'var(--text-dim)', background: 'var(--bg-elevated)', borderColor: 'var(--border)', fontSize: 10.5 }}>Interno</span>
  }

  // filtros: estado (terminadas archivadas por defecto), entrega (hoy/mañana), persona
  const [filters, setFilters] = useState({ estado: 'activas', entrega: 'todas', asignado: 'todos' })
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }))
  const today = localYMD(new Date())
  const tomorrow = localYMD(new Date(Date.now() + 86400000))
  const matchEntrega = (t) => {
    if (filters.entrega === 'todas') return true
    if (filters.entrega === 'sinfecha') return !t.dueDate
    if (!t.dueDate) return false
    const y = localYMD(t.dueDate)
    if (filters.entrega === 'hoy') return y === today
    if (filters.entrega === 'manana') return y === tomorrow
    if (filters.entrega === 'hoymanana') return y === today || y === tomorrow
    if (filters.entrega === 'vencidas') return y < today && t.status !== 'terminado'
    return true
  }
  const matchAsignado = (t) => filters.asignado === 'todos' ? true : (t.assigneeId || '') === filters.asignado
  const matchEstado = (t) => filters.estado === 'todas' ? true : filters.estado === 'terminadas' ? t.status === 'terminado' : t.status !== 'terminado'
  const doneCount = tasks.filter((t) => t.status === 'terminado').length
  const tableTasks = tasks.filter((t) => matchEstado(t) && matchEntrega(t) && matchAsignado(t))  // tabla: aplica los 3
  const boardTasks = tasks.filter((t) => matchEntrega(t) && matchAsignado(t))                     // kanban: las columnas son el estado
  const selStyle = { width: 'auto', padding: '8px 10px', fontSize: 13 }

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Equipo</div><h1 style={{ fontSize: 32 }}>Tareas</h1></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="surface" style={{ display: 'flex', padding: 3, borderRadius: 10 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('table')} title="Tabla" style={{ background: view === 'table' ? 'var(--card-hover)' : 'transparent', color: view === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I2.table width={15} height={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('kanban')} title="Kanban" style={{ background: view === 'kanban' ? 'var(--card-hover)' : 'transparent', color: view === 'kanban' ? 'var(--accent)' : 'var(--text-dim)' }}><I2.kanban width={15} height={15} /></button>
          </div>
          <button className="btn btn-accent" onClick={addTask}><I2.plus width={15} height={15} /> Agregar tarea</button>
        </div>
      </div>

      {/* barra de filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <select className="input" value={filters.estado} onChange={(e) => setF('estado', e.target.value)} style={selStyle}>
          <option value="activas">Estado: activas</option>
          <option value="terminadas">Terminadas{doneCount ? ` (${doneCount})` : ''}</option>
          <option value="todas">Todas</option>
        </select>
        <select className="input" value={filters.entrega} onChange={(e) => setF('entrega', e.target.value)} style={selStyle}>
          <option value="todas">Entrega: todas</option>
          <option value="hoy">Para hoy</option>
          <option value="manana">Para mañana</option>
          <option value="hoymanana">Hoy y mañana</option>
          <option value="vencidas">Vencidas</option>
          <option value="sinfecha">Sin fecha</option>
        </select>
        <select className="input" value={filters.asignado} onChange={(e) => setF('asignado', e.target.value)} style={selStyle}>
          <option value="todos">Asignado: todos</option>
          <option value="">Sin asignar</option>
          {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {(filters.estado !== 'activas' || filters.entrega !== 'todas' || filters.asignado !== 'todos') && (
          <button className="btn btn-sm btn-ghost" onClick={() => setFilters({ estado: 'activas', entrega: 'todas', asignado: 'todos' })} style={{ color: 'var(--text-dim)' }}>Limpiar</button>
        )}
        <span style={{ fontSize: 12.5, color: 'var(--text-faint)', marginLeft: 'auto' }}>{view === 'table' ? tableTasks.length : boardTasks.length} tarea(s)</span>
      </div>

      {tasks.length === 0 && <div className="surface" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Sin tareas. Agregá la primera con “Agregar tarea”.</div>}

      {tasks.length > 0 && view === 'table' && (
        tableTasks.length === 0 ? <div className="surface" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No hay tareas con esos filtros.{filters.estado === 'activas' && doneCount > 0 ? ` Hay ${doneCount} terminada(s) — elegí “Terminadas” para verlas.` : ''}</div> :
        <div className="surface tbl" style={{ overflow: 'hidden' }}>
          <table>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Asignado', 'Tarea', 'Origen', 'Prioridad', 'Entrega', 'Estado', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {tableTasks.map((t) => {
                const inProc = t.status === 'en proceso'
                return (
                <tr key={t.id} className="row-hover click" onClick={() => setOpenId(t.id)} style={{ borderBottom: '1px solid var(--border)', opacity: t.status === 'terminado' ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><Assignee id={t.assigneeId} /></td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, textDecoration: t.status === 'terminado' ? 'line-through' : 'none' }}>{t.name}{(t.comments || []).length > 0 && <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text-faint)' }}><I2.comment width={11} height={11} />{t.comments.length}</span>}</td>
                  <td style={{ padding: '12px 16px' }}><ScopeTag t={t} /></td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><PrioFlag p={t.priority} withLabel /></td>
                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}><DueDate value={t.dueDate} onChange={(v) => updateTask(t.id, { dueDate: v })} /></td>
                  <td style={{ padding: '8px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <select className="input" value={t.status} onChange={(e) => updateTask(t.id, { status: e.target.value })} style={{ width: 'auto', padding: '6px 8px', fontSize: 13, background: inProc ? 'var(--accent-soft)' : 'var(--bg-elevated)', borderColor: inProc ? 'var(--accent-line)' : 'var(--border)', color: inProc ? 'var(--accent)' : 'inherit', fontWeight: inProc ? 700 : 500 }}>
                      {TASK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px 12px 0', width: 44 }}><button className="btn btn-sm btn-ghost" title="Eliminar" onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar esta tarea?')) delTask(t.id) }} style={{ padding: 6, color: 'var(--text-faint)' }}><I2.x width={15} height={15} /></button></td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {tasks.length > 0 && view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
          {TASK_STATUS.map((col) => {
            const colTasks = boardTasks.filter((t) => (t.status || 'pendiente') === col.key)
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key) }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; if (id) updateTask(id, { status: col.key }); setDragId(null); setOverCol(null) }}
                className="surface" style={{ padding: 10, background: overCol === col.key ? 'var(--card-hover)' : 'var(--bg-elevated)', minHeight: 140, borderColor: overCol === col.key ? 'var(--accent-line)' : 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '0 2px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: col.dot }} />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{col.label}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>{colTasks.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colTasks.map((t) => (
                    <div key={t.id} draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id) }}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onClick={() => setOpenId(t.id)}
                      className="surface click" style={{ padding: 11, background: 'var(--card)', cursor: 'grab', opacity: dragId === t.id ? 0.5 : 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{t.name}</div>
                      <div style={{ marginBottom: 8 }}><ScopeTag t={t} /></div>
                      <div style={{ marginBottom: 8 }}><DueDate value={t.dueDate} onChange={(v) => updateTask(t.id, { dueDate: v })} /></div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        {t.assigneeId ? <Avatar user={userOf(t.assigneeId)} size={24} ring="var(--card)" /> : <Avatar empty size={24} ring="var(--card)" />}
                        <PrioFlag p={t.priority} />
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '6px 2px' }}>—</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <TaskDetailModal open={!!openTask} task={openTask} team={team} projects={data.projects} onClose={() => setOpenId(null)} onPatch={(fields) => updateTask(openId, fields)} onDelete={delTask} />
    </div>
  )
}

/* ============================================================================
   17 · SIDEBAR + USER PROFILE
============================================================================ */
/* floating profile avatar (bottom-right): solo foto + a quién representa */
/* paleta y iniciales automáticas para nuevos miembros */
const AVATAR_COLORS = ['#F97316', '#6366F1', '#10B981', '#EC4899', '#38BDF8', '#A855F7', '#F59E0B', '#14B8A6', '#EF4444', '#8B5CF6', '#0EA5E9', '#22C55E']
const autoInitials = (name) => ((name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()) || '?'

/* gestor del equipo: agregar / editar / quitar miembros que aparecen en asignaciones y @menciones */
function TeamManager({ open, onClose }) {
  const { data, teamStore } = useApp()
  const team = data.team || []
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const add = () => {
    const n = name.trim(); if (!n) return
    const m = { id: uid(), name: n, email: email.trim(), initials: autoInitials(n), color: AVATAR_COLORS[team.length % AVATAR_COLORS.length], role }
    teamStore.create(m)
    setName(''); setEmail(''); setRole('')
  }
  const update = (id, fields) => teamStore.patch(id, (u) => ({ ...u, ...fields }))
  const remove = (id) => { if (window.confirm('¿Quitar a esta persona del equipo? Sus asignaciones quedarán sin nadie (no se borran proyectos ni tareas).')) teamStore.remove(id) }
  return (
    <Modal open={open} onClose={onClose} title="Equipo" sub="Miembros que aparecen en asignaciones, comentarios y @menciones" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {team.map((u) => (
            <div key={u.id} className="surface" style={{ padding: '9px 11px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar user={u} size={30} ring="var(--bg-elevated)" />
              <input className="input" value={u.name} onChange={(e) => update(u.id, { name: e.target.value, initials: autoInitials(e.target.value) })} placeholder="Nombre" style={{ flex: '1 1 130px', padding: '6px 9px', fontSize: 13 }} />
              <input className="input mono" value={u.email || ''} onChange={(e) => update(u.id, { email: e.target.value })} placeholder="email@insightsapps.tech" style={{ flex: '1 1 160px', padding: '6px 9px', fontSize: 12.5 }} />
              <select className="input" value={u.role || ''} onChange={(e) => update(u.id, { role: e.target.value })} title="Rango (define en qué filtro de Proyectos aparece)" style={{ flex: '0 0 88px', padding: '6px 9px', fontSize: 12.5 }}>
                {TEAM_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              <button className="btn btn-sm btn-ghost" onClick={() => remove(u.id)} title="Quitar del equipo" style={{ padding: 6, color: 'var(--text-faint)' }}><I2.trash width={14} height={14} /></button>
            </div>
          ))}
        </div>
        <hr className="divider" />
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Agregar miembro</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" style={{ flex: '1 1 130px' }} />
            <input className="input mono" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="email (para auto-login)" style={{ flex: '1 1 160px' }} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)} title="Rango" style={{ flex: '0 0 88px' }}>
              {TEAM_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <button className="btn btn-accent" onClick={add}><I2.plus width={15} height={15} /> Agregar</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 9 }}>
            El <strong>email</strong> tiene que coincidir con el usuario de Supabase para que la persona se reconozca sola al iniciar sesión. Agregar un miembro acá <strong>no</strong> crea su login: eso se hace aparte en Supabase → Authentication.
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* Mi perfil. El disparador ya no es un botón flotante tapando la esquina: vive
   en el pie del sidebar, junto al nombre, que es donde se busca. */
function UserProfile({ session, myId, setMyId, onLogout, open, onClose }) {
  const { data, teamStore } = useApp()
  const setOpen = (v) => { if (!v && onClose) onClose() }
  const [teamOpen, setTeamOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const team = data.team || []
  const me = team.find((u) => u.id === myId)
  const updateMember = (id, fields) => teamStore.patch(id, (u) => ({ ...u, ...fields }))
  const onPick = async (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f || !me) return
    setBusy(true)
    try { const url = await fileToAvatarDataURL(f); updateMember(me.id, { photo: url }) } catch (err) { /* ignore */ }
    setBusy(false)
    e.target.value = ''
  }
  const email = session?.user?.email || ''
  const Placeholder = ({ size, icon = 22 }) => <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg-elevated)', border: '2px dashed var(--border-strong)', color: 'var(--text-faint)' }}><I2.users width={icon} height={icon} /></div>

  return (
    <>
      <Modal open={open} onClose={() => setOpen(false)} title="Mi perfil" sub={email || undefined} width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center' }}>
          {me ? <Avatar user={me} size={96} ring="var(--card)" /> : <Placeholder size={96} />}
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-accent" disabled={!me || busy} onClick={() => fileRef.current && fileRef.current.click()}><I2.pencil width={14} height={14} /> {busy ? 'Procesando…' : me && me.photo ? 'Cambiar foto' : 'Subir foto'}</button>
            {me && me.photo && <button className="btn btn-ghost" onClick={() => updateMember(me.id, { photo: '' })} style={{ color: 'var(--text-dim)' }}><I2.x width={14} height={14} /> Quitar</button>}
          </div>

          <div style={{ width: '100%', textAlign: 'left' }}>
            <Field label="¿Quién sos?">
              <select className="input" value={myId || ''} onChange={(e) => setMyId(e.target.value)} aria-label="Elegí quién sos dentro del equipo">
                <option value="">— Elegí tu nombre —</option>
                {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 7 }}>{me ? 'Con esto sabemos qué proyectos son tuyos y a quién atribuir cada avance. Tu foto se ve en el menú y en las tarjetas donde estés asignado.' : 'Elegí tu nombre para ver tus proyectos y poder subir tu foto.'}</div>
            <button className="btn" onClick={() => { setOpen(false); setTeamOpen(true) }} style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}><I2.users width={15} height={15} /> Gestionar equipo</button>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            {cloudEnabled && onLogout ? <button className="btn" onClick={onLogout} style={{ color: 'var(--red)' }}><I2.ext width={14} height={14} /> Cerrar sesión</button> : <span />}
            <button className="btn btn-accent" onClick={() => setOpen(false)}><I2.check width={15} height={15} /> Listo</button>
          </div>
        </div>
      </Modal>
      <TeamManager open={teamOpen} onClose={() => setTeamOpen(false)} />
    </>
  )
}

function Sidebar({ route, setRoute, collapsed, setCollapsed, mobile, open, onClose, email, onProfile }) {
  const { data, myId } = useApp()
  const me = (data.team || []).find((u) => u.id === myId) || null
  const items = [
    { key: 'projects', label: 'Projects', icon: I2.folder },
    { key: 'tasks', label: 'Tareas', icon: I2.tasks },
    { key: 'clients', label: 'Clients', icon: I2.users },
    { key: 'calls', label: 'Calls', icon: I2.phone },
    { key: 'sops', label: 'SOP', icon: I2.doc },
  ]
  const tools = [
    { key: 'planner', label: 'Planificador', icon: I2.calendar },
    { key: 'bot', label: 'Bot', icon: I2.whatsapp },
    { key: 'editor', label: 'Editor', icon: I2.film },
    { key: 'carousel', label: 'Carrusel', icon: I2.layers, external: true, href: 'https://carrusel-generator-production.up.railway.app/dashboard/carousels?cg_token=bik8zveoSvtBR2CgPA5I_p9YFoPmyZyn' },
  ]
  const toolsActive = tools.some((t) => route.view === t.key)
  const [hovered, setHovered] = useState(false)
  const mini = !mobile && collapsed && !hovered   // icon-only por defecto; el hover lo expande temporalmente
  const go = (key) => { setRoute({ view: key }); if (mobile && onClose) onClose() }

  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsCloseTimer = useRef(null)
  useEffect(() => () => clearTimeout(toolsCloseTimer.current), [])
  const openTools = () => { clearTimeout(toolsCloseTimer.current); setToolsOpen(true) }
  const scheduleCloseTools = () => {
    clearTimeout(toolsCloseTimer.current)
    toolsCloseTimer.current = setTimeout(() => setToolsOpen(false), 220)
  }
  const toggleTools = () => setToolsOpen((v) => !v)
  const goTool = (t) => {
    setToolsOpen(false)
    if (t.external) { window.open(t.href, '_blank', 'noopener,noreferrer'); return }
    go(t.key)
  }

  const cls = () => `sb-i${mini ? ' mini' : ''}`
  const Cap = () => <div style={{ height: 1, background: 'var(--border)', margin: '10px 6px 6px' }} />

  const inner = (
    <>
      <div className="sb-brand">
        <div className="sb-mark" aria-hidden="true">I</div>
        {!mini && <div className="sb-wm"><b>Insights</b><span>SOFTWARE · OS</span></div>}
        {mobile
          ? <button onClick={onClose} className="sb-pin" title="Cerrar menú" aria-label="Cerrar menú"><I2.x width={16} height={16} /></button>
          : !mini && (
            /* Reemplaza al viejo botón "Colapsar" del pie: acá se fija o se suelta
               el sidebar, en el mismo lugar donde ya estás mirando la marca. */
            <button className="sb-pin" data-on={collapsed ? '0' : '1'} onClick={() => setCollapsed(!collapsed)}
              aria-pressed={!collapsed}
              title={collapsed ? 'Fijar el menú abierto' : 'Soltar: vuelve a modo compacto y se abre al pasar el mouse'}
              aria-label={collapsed ? 'Fijar el menú abierto' : 'Soltar el menú: modo compacto'}>
              <I2.panelLeft width={16} height={16} style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }} />
            </button>
          )}
      </div>
      <hr className="divider" />

      <nav className="sb-nav" aria-label="Navegación principal">
        {items.map((it) => {
          const active = route.view === it.key || (route.view === 'project' && it.key === 'projects')
          return (
            <button key={it.key} onClick={() => go(it.key)} title={mini ? it.label : undefined}
              className={cls()} data-on={active ? '1' : '0'} aria-current={active ? 'page' : undefined}>
              {active && <span className="rail" aria-hidden="true" />}
              <it.icon width={18} height={18} />
              {!mini && <span className="lbl">{it.label}</span>}
            </button>
          )
        })}

        <Cap>Herramientas</Cap>

        {/* Tools — grupo que se despliega (hover en desktop, tap en mobile) */}
        <div
          onMouseEnter={!mobile ? openTools : undefined}
          onMouseLeave={!mobile ? scheduleCloseTools : undefined}
        >
          <button onClick={toggleTools} title={mini ? 'Tools' : undefined}
            className={cls()} data-on={toolsActive ? '1' : '0'} aria-expanded={toolsOpen}>
            {toolsActive && <span className="rail" aria-hidden="true" />}
            <I2.grid width={18} height={18} />
            {!mini && <span className="lbl">Tools</span>}
            {!mini && <I2.chevR className="cd" width={13} height={13} />}
          </button>

          <AnimatePresence initial={false}>
            {toolsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: .26, ease: [.32, .72, 0, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div className={`sb-sub${mini ? ' mini' : ''}`}>
                  {tools.map((t, idx) => {
                    const active = route.view === t.key
                    return (
                      <motion.button
                        key={t.key}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.035, duration: .2, ease: [.32, .72, 0, 1] }}
                        onClick={() => goTool(t)}
                        title={mini ? t.label : undefined}
                        className={`${cls()} sm`} data-on={active ? '1' : '0'}
                        aria-current={active ? 'page' : undefined}
                      >
                        <t.icon width={16} height={16} />
                        {!mini && <span className="lbl">{t.label}</span>}
                        {!mini && t.external && <I2.ext width={11} height={11} style={{ opacity: .5, flexShrink: 0 }} />}
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      <div className="sb-foot">
        <button className="sb-u" onClick={() => { if (onProfile) onProfile(); if (mobile && onClose) onClose() }}
          title={mini ? (me ? me.name : 'Tu perfil') : undefined}
          aria-label={me ? `Tu perfil · ${me.name}` : 'Elegí quién sos'}
          style={mini ? { justifyContent: 'center' } : undefined}>
          {me
            ? <Avatar user={me} size={30} ring="var(--bg-elevated)" />
            : <span style={{ width: 30, height: 30, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--card)', boxShadow: 'inset 0 0 0 1.5px var(--border-strong)', color: 'var(--text-faint)' }}><I2.user width={15} height={15} /></span>}
          {!mini && (
            <>
              <span className="tx">
                <span className="nm">{me ? me.name : 'Elegí quién sos'}</span>
              </span>
              <I2.gear width={14} height={14} />
            </>
          )}
        </button>
      </div>
    </>
  )

  if (mobile) {
    return createPortal(
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 150, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .25s ease' }} />
        <aside className="sb" style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 250, zIndex: 151, boxShadow: 'var(--shadow-lift)', transform: open ? 'translateX(0)' : 'translateX(-280px)', transition: 'transform .28s cubic-bezier(.32,.72,0,1)' }}>
          {inner}
        </aside>
      </>,
      document.body
    )
  }
  return (
    // display:contents = el wrapper no genera caja propia (el aside sigue siendo
    // hijo flex directo de .app-shell); agrupa aside + zona-anticipo bajo un solo
    // onMouseLeave para que pasar de una a otra no dispare un cierre a mitad de camino.
    <div style={{ display: 'contents' }} onMouseLeave={() => setHovered(false)}>
      {collapsed && !hovered && (
        <div onMouseEnter={() => setHovered(true)}
          style={{ position: 'fixed', top: 0, bottom: 0, left: 64, width: 8, zIndex: 55 }} />
      )}
      {/* onFocus/onBlur además del hover: tabulando, el sidebar colapsado se quedaba
          icon-only y no se leía a dónde llevaba cada ítem. onBlur solo colapsa cuando
          el foco sale del aside entero (no al saltar de un ítem al siguiente). */}
      <motion.aside className="sb" onMouseEnter={() => setHovered(true)}
        onFocus={() => setHovered(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false) }}
        animate={{ width: mini ? 64 : 236 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
        {inner}
      </motion.aside>
    </div>
  )
}

/* ============================================================================
   EDITOR DE VIDEO — INSIGHTS Editor embebido (export estático servido en /editor)
   Subís/arrastrás un video y lo devuelve sin tiempos muertos + subtítulos con IA,
   editables (mover, agrandar, restyle) y con encuadre/barras negras. 100% en el
   navegador; se sirve same-origin desde public/editor así que no necesita backend.
============================================================================ */
function EditorView() {
  const src = `${import.meta.env.BASE_URL}editor/index.html`
  return (
    <div style={{ height: '100%', width: '100%', background: '#0b0b12' }}>
      <iframe
        src={src}
        title="Editor de video"
        allow="clipboard-write; fullscreen; webgpu"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </div>
  )
}

/* ============================================================================
   18 · HEADER + SETTINGS
============================================================================ */
function SyncBadge({ sync }) {
  const map = {
    loading: { c: 'var(--text-faint)', t: 'Cargando…' },
    saving: { c: 'var(--yellow)', t: 'Guardando…' },
    saved: { c: 'var(--green)', t: 'Sincronizado' },
    error: { c: 'var(--red)', t: 'Error de sync' },
    local: { c: 'var(--text-faint)', t: 'Solo local' },
  }
  const s = map[sync] || map.local
  return (
    <span className="hd-sys" role="status" aria-live="polite"
      title={cloudEnabled ? 'Estado de sincronización con Supabase' : 'Sin Supabase configurado — guardando solo en este navegador'}>
      <span className="dot" style={{ background: s.c, animation: sync === 'saving' || sync === 'loading' ? 'pulse 1s infinite' : 'none' }} />
      {s.t}
    </span>
  )
}
/* centro de notificaciones: log de actividad (quién hizo qué) */
function NotificationCenter() {
  const { data } = useApp()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [lastSeen, setLastSeen] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('activity_seen') || '' : ''))
  const btnRef = useRef(null)
  const activity = data.activity || []
  const team = data.team || []
  const myId = typeof localStorage !== 'undefined' ? localStorage.getItem('my_team_id') : ''
  const userOf = (id) => team.find((u) => u.id === id)
  const unread = activity.filter((a) => a.date > lastSeen).length
  const mentionsForMe = activity.filter((a) => a.targetId === myId && a.date > lastSeen).length
  const ICONS = { 'call-add': I2.phone, 'task-add': I2.tasks, 'task-done': I2.check, 'project-add': I2.folder, 'plan-link': I2.calendar, 'plan-unlink': I2.calendar, comment: I2.comment, avance: I2.folder, comm: I2.phone, mention: I2.at, reply: I2.comment, react: I2.comment }
  const toggle = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
      const now = new Date().toISOString(); localStorage.setItem('activity_seen', now); setLastSeen(now)
    }
    setOpen((v) => !v)
  }
  return (
    <span style={{ display: 'inline-block', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} className="hd-ib" onClick={toggle} title="Notificaciones" aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread > 0 ? `Notificaciones · ${unread} sin leer${mentionsForMe > 0 ? `, ${mentionsForMe} para vos` : ''}` : 'Notificaciones · nada nuevo'}>
        <I2.bell width={16} height={16} />
        {unread > 0 && <span className="hd-badge" aria-hidden="true" title={mentionsForMe > 0 ? `${mentionsForMe} mención${mentionsForMe > 1 ? 'es' : ''} para vos` : undefined} style={{ background: mentionsForMe > 0 ? 'var(--accent)' : 'var(--red)' }}>{mentionsForMe > 0 ? '@' : (unread > 9 ? '9+' : unread)}</span>}
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 201, width: 340, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <I2.bell width={15} height={15} style={{ color: 'var(--accent)' }} /><strong style={{ fontSize: 14 }}>Actividad</strong>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>{activity.length}</span>
            </div>
            <div className="scroll-y" style={{ overflowY: 'auto', padding: 8 }}>
              {activity.length === 0 && <div style={{ padding: 18, textAlign: 'center', fontSize: 13, color: 'var(--text-faint)' }}>Sin actividad todavía.</div>}
              {activity.map((a) => {
                const u = userOf(a.actorId); const Ico = ICONS[a.type] || I2.spark
                const mine = !!a.targetId && a.targetId === myId
                const body = a.type === 'mention'
                  ? (mine ? <span style={{ color: 'var(--text-dim)' }}>te mencionó {a.text}</span>
                          : <span style={{ color: 'var(--text-dim)' }}>mencionó a <strong style={{ color: 'var(--text)' }}>{userOf(a.targetId)?.name || 'alguien'}</strong> {a.text}</span>)
                  : <span style={{ color: 'var(--text-dim)' }}>{a.text}</span>
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 8px', borderRadius: 9, background: mine ? 'var(--accent-soft, var(--bg-elevated))' : 'transparent', border: mine ? '1px solid var(--accent-line)' : '1px solid transparent' }} className="row-hover">
                    {u ? <Avatar user={u} size={28} ring="var(--card)" badge={a.type === 'mention' ? <span style={{ position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: 99, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', border: '1.5px solid var(--card)' }}><I2.at width={9} height={9} /></span> : null} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-faint)', flexShrink: 0 }}><Ico width={14} height={14} /></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.45 }}><strong>{u ? u.name : 'Alguien'}</strong> {body}{mine && <span className="tag" style={{ marginLeft: 6, color: 'var(--accent)', background: 'transparent', borderColor: 'var(--accent-line)', fontSize: 10 }}>para vos</span>}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>{fmtRelative(a.date)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </span>
  )
}

/* detecta si el server tiene un bundle nuevo (deploy nuevo) comparando el hash del index-*.js */
function useAppUpdate() {
  const [ready, setReady] = useState(false)
  const current = useRef(null)
  useEffect(() => {
    const src = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src') || '').find((s) => /assets\/index-[\w-]+\.js/.test(s))
    current.current = src ? src.split('/').pop() : null
    if (!current.current) return   // dev / sin bundle hasheado → no chequea
    let alive = true
    const check = async () => {
      try {
        const html = await fetch('/index.html?ts=' + Date.now(), { cache: 'no-store' }).then((r) => r.text())
        const m = html.match(/assets\/index-[\w-]+\.js/)
        if (alive && m && m[0].split('/').pop() !== current.current) setReady(true)
      } catch (e) { /* ignore */ }
    }
    const iv = setInterval(check, 60000)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    return () => { alive = false; clearInterval(iv); window.removeEventListener('focus', onFocus) }
  }, [])
  return ready
}
/* recarga limpiando caché (y service workers si hubiera) — como un F5 forzado */
async function hardRefresh() {
  try { if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))) } } catch (e) { /* ignore */ }
  try { if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())) } } catch (e) { /* ignore */ }
  window.location.reload()
}
/* Chip de versión y botón de actualizar son la MISMA pieza en dos estados: en
   reposo dice qué versión estás corriendo, y cuando hay deploy nuevo se enciende
   y te invita a recargar. Ancho estable para que la barra no se reacomode. */
function UpdateButton() {
  const ready = useAppUpdate()
  const [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); await hardRefresh() }
  return (
    <button className="hd-ver" data-new={ready ? '1' : '0'} onClick={go} disabled={busy}
      aria-label={ready ? `Actualizar a la versión nueva (estás en la ${APP_VERSION})` : `Versión ${APP_VERSION} · recargar y limpiar caché`}
      title={ready ? `Hay una versión nueva. Tocá para actualizar (recarga + limpia caché). Actual: v${APP_VERSION}` : `App v${APP_VERSION} · recargar y limpiar caché (F5 forzado)`}>
      <I2.refresh width={14} height={14} style={busy ? { animation: 'spin 1s linear infinite' } : {}} />
      <span aria-hidden="true">{ready ? 'Actualizar' : `v${APP_VERSION}`}</span>
    </button>
  )
}

/* Barra superior. Antes convivían cuatro tratamientos de botón distintos en 300px
   de ancho. Ahora hay dos grupos con peso propio y una sola forma de botón:
   · SISTEMA (izq. del bloque derecho): estado de sync + versión. Informan, no son tuyos.
   · USUARIO: notificaciones, ajustes, tema y salir. Todos icon-buttons de 32px. */
function Header({ theme, setTheme, onSettings, route, sync, onLogout, mobile, onMenu }) {
  const crumb = { overview: 'Overview', projects: 'Projects', tasks: 'Tareas', clients: 'Clients', calls: 'Calls', sops: 'SOP · Procesos', planner: 'Planificador', assistant: 'IA Assistant', editor: 'Editor de video', bot: 'Bot', carousel: 'Carrusel', project: 'Projects / Detalle' }[route.view] || 'Insights OS'
  const dark = theme === 'dark'
  return (
    <header className="hd">
      <div className="hd-crumb">
        {mobile && <button onClick={onMenu} className="hd-ib" title="Menú" aria-label="Abrir menú"><I2.menu width={18} height={18} /></button>}
        <span className="rt hide-mobile">insights-os</span>
        <I2.chevR width={13} height={13} className="hide-mobile" style={{ flex: 'none', opacity: .6 }} />
        <strong>{crumb}</strong>
      </div>

      <div className="hd-right">
        <span className="hd-grp sys hide-mobile">
          <SyncBadge sync={sync} />
          <UpdateButton />
        </span>

        <span className="hd-grp">
          <NotificationCenter />
          <button className="hd-lbl" onClick={onSettings} title="Ajustes & API keys" aria-label="Ajustes e integraciones">
            <I2.gear width={16} height={16} /><span>Ajustes</span>
          </button>
          <button className="hd-ib hd-theme" onClick={() => setTheme(dark ? 'light' : 'dark')}
            title={dark ? 'Pasar a tema claro' : 'Pasar a tema oscuro'}
            aria-label={dark ? 'Pasar a tema claro' : 'Pasar a tema oscuro'}>
            <span>
              <motion.span key={theme} initial={{ opacity: 0, rotate: -70, scale: .7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }}
                transition={{ duration: .3, ease: [.32, .72, 0, 1] }} style={{ display: 'grid', placeItems: 'center' }}>
                {dark ? <I2.sun width={16} height={16} /> : <I2.moon width={16} height={16} />}
              </motion.span>
            </span>
          </button>
          {cloudEnabled && onLogout && (
            <button className="hd-ib danger" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
              <I2.ext width={16} height={16} />
            </button>
          )}
        </span>
      </div>
    </header>
  )
}

function Settings({ open, onClose, onManageTeam }) {
  const [keys, setKeys] = useState({ anthropic_key: '', gh_token: '', fathom_token: '' })
  useEffect(() => { if (open) setKeys({ anthropic_key: localStorage.getItem('anthropic_key') || '', gh_token: localStorage.getItem('gh_token') || '', fathom_token: localStorage.getItem('fathom_token') || '' }) }, [open])
  const save = () => { Object.entries(keys).forEach(([k, v]) => v ? localStorage.setItem(k, v) : localStorage.removeItem(k)); onClose() }
  return (
    <Modal open={open} onClose={onClose} title="Ajustes & integraciones" sub="Las claves se guardan solo en tu navegador (localStorage)" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Sistema · usuarios de la plataforma</div>
          <div className="surface" style={{ padding: 14, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}><I2.users width={19} height={19} /></div>
            <div style={{ flex: 1, minWidth: 160 }}><div style={{ fontWeight: 700, fontSize: 14 }}>Equipo y accesos</div><div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>Agregá o quitá personas que aparecen en asignaciones, comentarios y @menciones.</div></div>
            <button className="btn btn-accent" onClick={() => onManageTeam && onManageTeam()}><I2.plus width={15} height={15} /> Gestionar usuarios</button>
          </div>
        </div>
        <hr className="divider" />
        <Field label="Anthropic API key (chat IA · claude-sonnet-4)"><input className="input mono" type="password" placeholder="sk-ant-…" value={keys.anthropic_key} onChange={(e) => setKeys((s) => ({ ...s, anthropic_key: e.target.value }))} /></Field>
        <Field label="GitHub token (opcional · sube el rate limit)"><input className="input mono" type="password" placeholder="ghp_… / github_pat_…" value={keys.gh_token} onChange={(e) => setKeys((s) => ({ ...s, gh_token: e.target.value }))} /></Field>
        <Field label="Fathom token (sync de calls)"><input className="input mono" type="password" placeholder="fathom_…" value={keys.fathom_token} onChange={(e) => setKeys((s) => ({ ...s, fathom_token: e.target.value }))} /></Field>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
          El chat usa la Anthropic API directo desde el browser (<span className="mono">anthropic-dangerous-direct-browser-access</span>). GitHub usa la API pública. El MCP de Fathom puede requerir un proxy por CORS — si falla, se muestran calls de ejemplo para asignar.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={save}><I2.check width={15} height={15} /> Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

/* ============================================================================
   19 · ROOT APP
============================================================================ */
/* login screen (Supabase Auth) */
function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const submit = async (e) => {
    e?.preventDefault()
    if (!email || !pw) return
    setBusy(true); setErr(null); setMsg(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: pw })
        if (error) throw error
        if (!data.session) setMsg('Cuenta creada. Si Supabase pide confirmación, revisá tu email para activarla.')
      }
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="surface" style={{ width: '100%', maxWidth: 380, padding: 28, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent)', display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque', fontWeight: 800, color: '#fff', fontSize: 18 }}>I</div>
          <div><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 17, lineHeight: 1 }}>Insights · Project OS</div><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{mode === 'signin' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}</div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Email"><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@insights.software" /></Field>
          <Field label="Contraseña">
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPw ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw((v) => !v)} title={showPw ? 'Ocultar contraseña' : 'Ver contraseña'}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: 6, display: 'flex', color: 'var(--text-faint)', background: 'transparent' }}>
                {showPw ? <I2.eyeOff width={17} height={17} /> : <I2.eye width={17} height={17} />}
              </button>
            </div>
          </Field>
          {err && <div style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-soft)', padding: '8px 10px', borderRadius: 8 }}>{err}</div>}
          {msg && <div style={{ fontSize: 12.5, color: 'var(--green)', background: 'var(--green-soft)', padding: '8px 10px', borderRadius: 8 }}>{msg}</div>}
          <button type="submit" className="btn btn-accent" disabled={busy} style={{ justifyContent: 'center', padding: 11 }}>{busy ? 'Un momento…' : mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null); setMsg(null) }} style={{ justifyContent: 'center', fontSize: 12.5, color: 'var(--text-dim)' }}>
            {mode === 'signin' ? '¿No tenés cuenta? Crear una' : '¿Ya tenés cuenta? Iniciar sesión'}
          </button>
        </div>
      </motion.form>
    </div>
  )
}

function CenterScreen({ children }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: 14 }}>{children}</div>
}

/* Mapa proyecto → último mensaje del EQUIPO en su grupo de WhatsApp (lo escribe el
   bot en wa_groups.last_team_msg_at). Alimenta el "Último mensaje" de las cards sin
   que nadie lo cargue a mano. Refresca cada 5' y al volver a la pestaña. */
function useBotComms() {
  const [map, setMap] = useState({})
  useEffect(() => {
    if (!cloudEnabled) return
    let alive = true
    const load = async () => {
      const { data, error } = await supabase.from('wa_groups').select('project_id,last_team_msg_at')
      if (!alive || error || !data) return
      const m = {}
      for (const g of data) {
        if (!g.project_id || !g.last_team_msg_at) continue
        // un proyecto puede tener varios grupos: quedate con el mensaje más reciente
        const cur = m[g.project_id]
        if (!cur || new Date(g.last_team_msg_at) > new Date(cur)) m[g.project_id] = g.last_team_msg_at
      }
      setMap(m)
    }
    load()
    const iv = setInterval(load, 5 * 60 * 1000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return map
}

/* the authenticated app */
function AppShell({ session, onLogout }) {
  const planStore = usePlans()   // { plans, plansReady, createPlan, patchPlan, deletePlan, publishSync, retryPublish }
  const taskStore = useTasks()   // { tasks, tasksReady, createTask, patchTask, deleteTask }
  // Cada colección compartida es ahora su propia tabla por-fila (patrón anti-clobber
  // de usePlans/useTasks, generalizado en useRowCollection 6d). Ya NO hay documento
  // monolítico app_state: una pestaña con estado viejo no puede pisar lo de otro.
  const projectStore = useRowCollection({ table: 'projects', normalize: normalizeProject, seed: seedProjects, cacheKey: 'rc_projects_v1' })
  const clientStore = useRowCollection({ table: 'clients', normalize: normalizeClient, seed: seedClients, cacheKey: 'rc_clients_v1' })
  const teamStore = useRowCollection({ table: 'team_members', normalize: normalizeTeamMember, seed: seedTeam, cacheKey: 'rc_team_v1' })
  const callStore = useRowCollection({ table: 'calls', normalize: normalizeCall, seed: seedCalls, cacheKey: 'rc_calls_v1' })
  const activityStore = useRowCollection({ table: 'activity', normalize: normalizeActivity, seed: () => [], cacheKey: 'rc_activity_v1', loadLimit: 300 })
  const sopCatStore = useRowCollection({ table: 'sops_categories', normalize: normalizeSopCategory, seed: () => seedSops().categories, cacheKey: 'rc_sopcat_v1' })
  const sopProcStore = useRowCollection({ table: 'sops_processes', normalize: normalizeSopProcess, seed: () => seedSops().processes, cacheKey: 'rc_sopproc_v1' })
  const chatStore = useRowCollection({ table: 'assistant_chats', normalize: normalizeChat, seed: () => [], cacheKey: 'rc_chats_v1' })

  // Vista de solo lectura con la forma histórica de `data` — para que TODOS los
  // reads `data.projects`/`data.team`/… sigan funcionando sin tocarlos. Toda
  // MUTACIÓN va por las acciones de cada store (nunca por setData).
  const sops = useMemo(() => ({ categories: sopCatStore.items, processes: sopProcStore.items }), [sopCatStore.items, sopProcStore.items])
  const dataView = useMemo(() => ({
    team: teamStore.items.filter((u) => !REMOVED_MEMBER_IDS.includes(u.id)),
    clients: clientStore.items,
    projects: projectStore.items,
    calls: callStore.items,
    activity: activityStore.items,
    assistantChats: chatStore.items,
    sops,
    tasks: taskStore.tasks,
  }), [teamStore.items, clientStore.items, projectStore.items, callStore.items, activityStore.items, chatStore.items, sops, taskStore.tasks])
  const collectionStores = { projectStore, clientStore, teamStore, callStore, activityStore, sopCatStore, sopProcStore, chatStore }
  const botComms = useBotComms()   // proyecto → último mensaje del equipo en WhatsApp (del bot)

  // Badge de sync: agregado del estado de todas las tablas.
  const allStores = [projectStore, clientStore, teamStore, callStore, activityStore, sopCatStore, sopProcStore, chatStore]
  const anyLoading = !planStore.plansReady || !taskStore.tasksReady || allStores.some((s) => !s.ready)
  const anySaving = allStores.some((s) => s.saving)
  const sync = !cloudEnabled ? 'local' : anyLoading ? 'loading' : anySaving ? 'saving' : 'saved'
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [route, setRoute] = useState({ view: 'projects' })
  const [collapsed, setCollapsed] = useState(true)
  const [settings, setSettings] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [myId, setMyId] = useState(() => localStorage.getItem('my_team_id') || '')
  const isMobile = useIsMobile()
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => { if (!isMobile) setNavOpen(false) }, [isMobile])

  useEffect(() => {
    const vars = THEMES[theme]
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // remember "who am I"; auto-vincular / auto-alta del usuario logueado en el equipo
  useEffect(() => { if (myId) localStorage.setItem('my_team_id', myId) }, [myId])
  useEffect(() => {
    if (!session?.user?.email) return
    // BLINDAJE #1 (causa raíz del duplicado sin foto): NUNCA actuar con el equipo
    // a medio cargar. Si la lista todavía no llegó desde Supabase (ready=false),
    // `items` está vacío y el paso 3 daría de alta un miembro NUEVO — un clon con
    // tu email pero sin foto — al no "ver" tu registro real. Esperamos a ready.
    // (En modo local ready es true desde el arranque, así que no bloquea nada.)
    if (!teamStore.ready) return
    const email = session.user.email.toLowerCase()
    const team = teamStore.items
    // 1) ya hay miembro(s) con ese email → vincular al MEJOR, no al primero. Si
    //    alguna vez quedó un duplicado, preferimos el que tiene foto y, a igualdad,
    //    el de id más "canónico" (seed 'u3' < uid()/'auto-…'). Así un clon viejo
    //    nunca vuelve a ganarte el perfil aunque siga existiendo en la tabla.
    const matches = team.filter((u) => u.email && u.email.toLowerCase() === email)
    if (matches.length) {
      const best = matches.slice().sort((a, b) =>
        (b.photo ? 1 : 0) - (a.photo ? 1 : 0) ||               // con foto primero
        String(a.id).length - String(b.id).length ||           // id corto (seed) antes que uid largo
        String(a.id).localeCompare(String(b.id))
      )[0]
      if (myId !== best.id) setMyId(best.id)
      return
    }
    // 2) ya elegiste tu nombre ("Sos:") pero ese miembro no tiene email → completárselo (evita duplicar)
    if (myId) {
      const mine = team.find((u) => u.id === myId)
      if (mine && !mine.email) teamStore.patch(myId, (u) => ({ ...u, email: session.user.email }))
      return
    }
    // 3) nadie coincide → dar de alta al usuario en el equipo desde su sesión de Supabase.
    //    BLINDAJE #2: id DETERMINÍSTICO derivado del email (no uid() aleatorio). Si
    //    dos pestañas/dispositivos dan de alta "al mismo" usuario nuevo a la vez,
    //    upsertean la MISMA fila en lugar de crear dos. `upsert` crea si no existe.
    const meta = session.user.user_metadata || {}
    const name = meta.name || meta.full_name || session.user.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const nid = 'auto-' + email.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    teamStore.upsert({ id: nid, name, email: session.user.email, initials: autoInitials(name), color: AVATAR_COLORS[team.length % AVATAR_COLORS.length] })
    setMyId(nid)
  }, [session, teamStore.items, teamStore.ready, myId])

  const openProject = (id) => setRoute({ view: 'project', projectId: id })
  const logActivity = (entry) => {
    const nacho = teamStore.items.find((u) => /nacho/i.test(u.name || '') || String(u.email || '').toLowerCase() === 'nachocachaza@insightsapps.tech')
    const actorId = localStorage.getItem('my_team_id') || (nacho ? nacho.id : '')
    activityStore.create({ id: uid(), date: new Date().toISOString(), actorId, ...entry })
  }

  // pop-up de inicio para el PM con el estado de seguimiento de sus proyectos
  const [pmAlertSeen, setPmAlertSeen] = useState(false)
  const pmProjects = projectStore.items.filter((p) => myId && p.assignments?.pm?.userId === myId && p.status === 'active')

  // El editor de video vive en un iframe cuyo estado (clips, cortes, subtítulos,
  // transcripción Whisper) existe solo en la memoria de ese documento: desmontarlo
  // al cambiar de pestaña lo recarga y pierde todo. Una vez abierto, queda montado
  // fuera del switch de vistas y se oculta con display:none. El ref evita pagar la
  // carga del bundle del editor si el usuario nunca abre esa pestaña.
  const editorEverOpenedRef = useRef(route.view === 'editor')
  if (route.view === 'editor') editorEverOpenedRef.current = true

  return (
    <AppCtx.Provider value={{ data: dataView, myId, logActivity, supabase, botComms, ...planStore, ...taskStore, ...collectionStores }}>
      <div className="app-shell">
        <Sidebar route={route} setRoute={setRoute} collapsed={collapsed} setCollapsed={setCollapsed} mobile={isMobile} open={navOpen} onClose={() => setNavOpen(false)} email={session?.user?.email} onProfile={() => setProfileOpen(true)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Header theme={theme} setTheme={setTheme} onSettings={() => setSettings(true)} route={route} sync={sync} onLogout={onLogout} mobile={isMobile} onMenu={() => setNavOpen(true)} />
          <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <motion.div key={route.view + (route.projectId || '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
              style={{ height: '100%', overflow: route.view === 'project' || route.view === 'assistant' || route.view === 'planner' || route.view === 'editor' || route.view === 'bot' ? 'hidden' : 'auto' }}>
              {route.view === 'projects' && <Projects onOpenProject={openProject} />}
              {route.view === 'tasks' && <TasksView />}
              {route.view === 'clients' && <Clients />}
              {route.view === 'calls' && <Calls />}
              {route.view === 'sops' && <Sops />}
              {route.view === 'assistant' && <AssistantView />}
              {route.view === 'planner' && <PlannerView />}
              {route.view === 'bot' && <BotView />}
              {route.view === 'project' && <ProjectDetail projectId={route.projectId} onBack={() => setRoute({ view: 'projects' })} />}
            </motion.div>
            {/* el iframe del editor NO se desmonta al navegar: solo se oculta (ver editorEverOpenedRef) */}
            {editorEverOpenedRef.current && (
              <div style={{ position: 'absolute', inset: 0, display: route.view === 'editor' ? 'block' : 'none' }}>
                <EditorView />
              </div>
            )}
          </main>
        </div>
        <Settings open={settings} onClose={() => setSettings(false)} onManageTeam={() => { setSettings(false); setTeamOpen(true) }} />
        <TeamManager open={teamOpen} onClose={() => setTeamOpen(false)} />
        <UserProfile session={session} myId={myId} setMyId={setMyId} onLogout={onLogout} open={profileOpen} onClose={() => setProfileOpen(false)} />
        <PmStartupAlert open={!pmAlertSeen && pmProjects.length > 0} projects={pmProjects} clients={clientStore.items} onClose={() => setPmAlertSeen(true)} onOpenProject={openProject} />
      </div>
    </AppCtx.Provider>
  )
}

/* ============================================================================
   20 · VISTA PÚBLICA DEL CLIENTE (solo lectura, con contraseña · via Edge Function)
============================================================================ */
function ClientView({ shareId }) {
  const [pw, setPw] = useState('')
  const [payload, setPayload] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const savedPw = useRef('')

  useEffect(() => { const vars = THEMES.dark; Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v)); document.documentElement.style.colorScheme = 'dark' }, [])

  const load = async (password) => {
    if (!cloudEnabled) { setErr('El link necesita conexión con el servidor.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: res, error } = await supabase.functions.invoke('project-share', { body: { shareId, password } })
      if (error) throw error
      if (res && res.error) throw new Error(res.error)
      savedPw.current = password; setPayload(res)
    } catch (e) { setErr(e.message || 'No se pudo acceder'); setPayload(null) } finally { setBusy(false) }
  }
  useEffect(() => { if (!payload) return; const iv = setInterval(() => load(savedPw.current), 45000); return () => clearInterval(iv) }, [payload])

  if (!payload) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
        <form onSubmit={(e) => { e.preventDefault(); load(pw) }} className="surface" style={{ width: '100%', maxWidth: 380, padding: 28, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent)', display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque', fontWeight: 800, color: '#fff', fontSize: 18 }}>I</div>
            <div><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>Seguimiento del proyecto</div><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Ingresá la contraseña para ver el avance</div></div>
          </div>
          <Field label="Contraseña"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoFocus /></Field>
          {err && <div style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-soft)', padding: '8px 10px', borderRadius: 8, marginTop: 10 }}>{err}</div>}
          <button type="submit" className="btn btn-accent" disabled={busy} style={{ justifyContent: 'center', padding: 11, width: '100%', marginTop: 12 }}>{busy ? 'Verificando…' : 'Ver el proyecto'}</button>
        </form>
      </div>
    )
  }

  const p = payload
  const stat = (label, value, color) => <div className="surface" style={{ padding: '14px 16px', flex: 1, minWidth: 130 }}><div className="label" style={{ marginBottom: 6 }}>{label}</div><div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Bricolage Grotesque', color: color || 'var(--text)' }}>{value}</div></div>
  const actMeta = (t) => ACTIVITY_TYPES.find((x) => x.key === t) || ACTIVITY_TYPES[0]
  // El payload lo arma la Edge Function `project-share` (supabase/functions/project-share),
  // que ya manda el plan y sus KPIs. Igual se contempla el payload sin avance —un
  // proyecto sin plan asociado—: en ese caso no mostramos ni tarjetas ni tabla vacía,
  // se salta la sección entera.
  const kpis = p.kpis && Number(p.kpis.total) > 0 ? p.kpis : null
  const planWeeks = [...(Array.isArray(p.plan?.weeks) ? p.plan.weeks : [])].sort((a, b) => (a.n || 0) - (b.n || 0))
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '30px 22px 70px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque', fontWeight: 800, color: '#fff', fontSize: 15 }}>I</div>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>Seguimiento en tiempo real · solo lectura</span>
        </div>
        <h1 style={{ fontSize: 30 }}>{p.name}</h1>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 22 }}>{p.client}{p.stack ? ` · ${p.stack}` : ''}</div>

        {kpis && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            {stat('Tareas totales', kpis.total)}
            {stat('Terminadas', kpis.done, 'var(--green)')}
            {stat('En curso', kpis.inProc, 'var(--accent)')}
            {stat('% Avance', (kpis.progress || 0) + '%', progressColor(kpis.progress || 0))}
          </div>
        )}

        {planWeeks.length > 0 && (
          <>
            <h2 style={{ fontSize: 19, marginBottom: 12 }}>Avance por semana</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {planWeeks.map((w) => {
                const wp = weekProgress(w)
                const complete = wp.total > 0 && wp.done === wp.total
                const tasks = Array.isArray(w.tasks) ? w.tasks : []
                return (
                  <div key={w.n} className="surface" style={{ padding: '13px 15px', borderColor: complete ? 'var(--green-soft)' : 'var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: tasks.length ? 8 : 0 }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: complete ? 'var(--green)' : 'var(--text-dim)' }}>SEM {String(w.n).padStart(2, '0')}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{w.title || 'Sin título'}</span>
                      <span className="mono" style={{ fontSize: 11.5, color: complete ? 'var(--green)' : 'var(--text-faint)' }}>{wp.done}/{wp.total}</span>
                    </div>
                    {tasks.map((t, i) => {
                      const done = taskDone(t)
                      return (
                        <div key={(t && t.id) || i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', fontSize: 13.5 }}>
                          <span style={{ color: done ? 'var(--green)' : 'var(--text-faint)', flexShrink: 0 }}>{done ? '✓' : '·'}</span>
                          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.45, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-faint)' : 'var(--text)' }}>{taskText(t)}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 17, marginBottom: 10 }}>Tareas del equipo</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(p.teamTasks || []).length === 0 && <div className="surface" style={{ padding: 13, color: 'var(--text-faint)', fontSize: 13 }}>—</div>}
              {(p.teamTasks || []).map((t, i) => <div key={i} className="surface" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}><span style={{ flex: 1, textDecoration: t.status === 'terminado' ? 'line-through' : 'none', color: t.status === 'terminado' ? 'var(--text-faint)' : 'var(--text)' }}>{t.name}</span><span className="tag" style={{ color: 'var(--text-dim)', background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>{t.status}</span></div>)}
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 17, marginBottom: 10 }}>Tareas del cliente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(p.clientTasks || []).length === 0 && <div className="surface" style={{ padding: 13, color: 'var(--text-faint)', fontSize: 13 }}>—</div>}
              {(p.clientTasks || []).map((c, i) => <div key={i} className="surface" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5 }}><span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid ' + (c.done ? 'var(--green)' : 'var(--border-strong)'), background: c.done ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{c.done && <I2.check width={12} height={12} style={{ color: '#fff' }} />}</span><span style={{ textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text-faint)' : 'var(--text)' }}>{c.text}</span></div>)}
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Registro de actividad</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(p.activity || []).length === 0 && <div className="surface" style={{ padding: 14, color: 'var(--text-faint)', fontSize: 13 }}>Sin actividad todavía.</div>}
          {(p.activity || []).map((en, i) => { const m = actMeta(en.type); return (
            <div key={i} className="surface" style={{ padding: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span className="tag" style={{ color: m.color, background: m.color + '1f', borderColor: 'transparent' }}><m.icon width={11} height={11} /> {m.label}</span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginLeft: 'auto' }}>{fmtDate(en.date)}</span>
              </div>
              {en.note && <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>{en.note}</div>}
              {(en.photos || []).length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{en.photos.map((s, j) => <a key={j} href={s} target="_blank" rel="noreferrer"><img src={s} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} /></a>)}</div>}
              {en.link && <a href={en.link} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ marginTop: 8, color: m.color }}><I2.ext width={13} height={13} /> Abrir {en.type === 'loom' ? 'Loom' : 'call'}</a>}
              {en.author && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>{en.author}</div>}
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}

export default function InsightsApp() {
  const [session, setSession] = useState(cloudEnabled ? undefined : null) // undefined=loading
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const shareId = params.get('share')
  const onbStep = params.get('onb')
  const onbxStep = params.get('onbx')

  // inject global css once
  useEffect(() => {
    if (document.getElementById('insights-css')) return
    const el = document.createElement('style')
    el.id = 'insights-css'
    el.textContent = GLOBAL_CSS + '\n@keyframes spin{to{transform:rotate(360deg)}}\n@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}'
    document.head.appendChild(el)
  }, [])

  // apply a default theme to <html> on the auth screens too
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'dark'
    const vars = THEMES[theme]
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
    document.documentElement.style.colorScheme = theme
  }, [])

  // auth session (only when cloud configured)
  useEffect(() => {
    if (!cloudEnabled) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (onbxStep) return <OnboardingV2 supabase={supabase} cloudEnabled={cloudEnabled} />
  if (onbStep) return <OnboardingLanding step={onbStep} supabase={supabase} cloudEnabled={cloudEnabled} />
  if (shareId) return <ClientView shareId={shareId} />
  if (cloudEnabled && session === undefined) return <CenterScreen>Cargando…</CenterScreen>
  if (cloudEnabled && !session) return <Login />
  return <AppShell session={session} onLogout={cloudEnabled ? () => supabase.auth.signOut() : null} />
}

