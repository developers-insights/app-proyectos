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
  createContext,
  useContext,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
    '--shadow': '0 1px 0 rgba(255,255,255,0.03), 0 18px 40px -20px rgba(0,0,0,0.8)',
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
    '--shadow': '0 1px 2px rgba(16,15,12,0.04), 0 12px 30px -18px rgba(16,15,12,0.18)',
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
`

/* ============================================================================
   2 · ICONS (inline, currentColor)
============================================================================ */
const I = {
  grid: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  folder: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  users: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 20a5.3 5.3 0 0 0-3-4.8"/></svg>,
  phone: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 5c0-1 .8-2 2-2h1.6a1 1 0 0 1 1 .8l.8 3a1 1 0 0 1-.3 1l-1.4 1.3a13 13 0 0 0 5.2 5.2l1.3-1.4a1 1 0 0 1 1-.3l3 .8a1 1 0 0 1 .8 1V19c0 1.2-1 2-2 2A16 16 0 0 1 4 5z"/></svg>,
  sun: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>,
  moon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>,
  chevR: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="m9 6 6 6-6 6"/></svg>,
  chevD: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  ext: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>,
  github: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>,
  rocket: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M5 15c-1.5 1-2 5-2 5s4-.5 5-2c.6-.9.5-2.1-.3-2.8A2 2 0 0 0 5 15z"/><path d="M9 13a14 14 0 0 1 8-9c3 0 3 0 3 3a14 14 0 0 1-9 8z"/><circle cx="15" cy="9" r="1.4"/><path d="M9 13l-2-2M11 15l2 2"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>,
  send: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>,
  spark: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M18 18l-2.5-2.5M18 6l-2.5 2.5M6 18l2.5-2.5"/><circle cx="12" cy="12" r="2.4"/></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>,
  link: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M10 14a4 4 0 0 0 5.6 0l2.8-2.8a4 4 0 0 0-5.6-5.6L11 7"/><path d="M14 10a4 4 0 0 0-5.6 0L5.6 12.8a4 4 0 0 0 5.6 5.6L13 17"/></svg>,
  alert: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...p}><path d="M5 13l4 4L19 7"/></svg>,
  panelLeft: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>,
  table: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/></svg>,
  cards: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
  refresh: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>,
  doc: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 13h6M9 17h6M9 9h2"/></svg>,
}

/* ============================================================================
   3 · UTILITIES
============================================================================ */
const uid = () => Math.random().toString(36).slice(2, 10)
const NOW = new Date('2026-06-11T12:00:00')
const daysAgo = (iso) => {
  if (!iso) return null
  return Math.max(0, Math.round((NOW - new Date(iso)) / 86400000))
}
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const money = (n) => '$' + (n ?? 0).toLocaleString('en-US')
const pctColor = (p) => (p < 40 ? 'var(--red)' : p <= 70 ? 'var(--accent)' : 'var(--green)')
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

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
  ]
}

const mods = (arr) => arr.map((m) => ({ id: uid(), ...m }))

function seedProjects() {
  return [
    {
      id: 'p1', clientId: 'c1', name: 'Chamber OS', status: 'active',
      productionUrl: 'https://app.davischamber.com', devUrl: 'https://dev.chamberos.insights.dev',
      githubRepo: 'insights-software/chamber-os', stack: 'Next.js',
      kickoff: 'Chamber OS reemplaza el stack legacy de la Davis Chamber of Commerce (WordPress + GrowthZone) por una plataforma unificada de gestión de membresías, eventos, facturación y comunicaciones. Fase 1: directorio de miembros + portal de auto-gestión. Fase 2: eventos y ticketing. Fase 3: billing recurrente y reportes para el board.',
      totalModules: 12, deliveredModules: 3, partialModules: 1, pendingModules: 8,
      paidAmount: 11400, totalAmount: 38000, progress: 28,
      lastDeployDate: '2026-06-03',
      sprints: [
        { id: uid(), name: 'Fundaciones & Auth', status: 'completado', estimatedDate: '2026-04-15', actualDate: '2026-04-18', modules: mods([{ name: 'Setup Next.js + CI', status: 'completado' }, { name: 'Auth + roles (admin/member)', status: 'completado' }, { name: 'Design system', status: 'completado' }]) },
        { id: uid(), name: 'Directorio de Miembros', status: 'en progreso', estimatedDate: '2026-06-20', actualDate: null, modules: mods([{ name: 'CRUD miembros', status: 'completado' }, { name: 'Búsqueda + filtros', status: 'en progreso' }, { name: 'Perfil público', status: 'pendiente' }]) },
        { id: uid(), name: 'Eventos & Ticketing', status: 'pendiente', estimatedDate: '2026-07-18', actualDate: null, modules: mods([{ name: 'Calendario de eventos', status: 'pendiente' }, { name: 'Venta de tickets (Stripe)', status: 'pendiente' }, { name: 'Check-in QR', status: 'pendiente' }]) },
        { id: uid(), name: 'Billing & Board Reports', status: 'pendiente', estimatedDate: '2026-08-22', actualDate: null, modules: mods([{ name: 'Membresías recurrentes', status: 'pendiente' }, { name: 'Dashboard del board', status: 'pendiente' }, { name: 'Export contable', status: 'pendiente' }]) },
      ],
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
      totalModules: 14, deliveredModules: 7, partialModules: 2, pendingModules: 5,
      paidAmount: 33800, totalAmount: 52000, progress: 65,
      lastDeployDate: '2026-06-09',
      sprints: [
        { id: uid(), name: 'Core Afiliados', status: 'completado', estimatedDate: '2026-03-10', actualDate: '2026-03-12', modules: mods([{ name: 'Registro + KYC', status: 'completado' }, { name: 'Árbol de referidos', status: 'completado' }, { name: 'Links de afiliado', status: 'completado' }]) },
        { id: uid(), name: 'Comisiones', status: 'completado', estimatedDate: '2026-04-20', actualDate: '2026-04-25', modules: mods([{ name: 'Motor de comisiones multinivel', status: 'completado' }, { name: 'Dashboard de afiliado', status: 'completado' }, { name: 'Reportes de venta', status: 'completado' }, { name: 'Integración Shopify', status: 'completado' }]) },
        { id: uid(), name: 'Payouts', status: 'en progreso', estimatedDate: '2026-06-28', actualDate: null, modules: mods([{ name: 'Stripe Connect onboarding', status: 'completado' }, { name: 'Payouts automáticos', status: 'en progreso' }, { name: 'Historial de retiros', status: 'en progreso' }]) },
        { id: uid(), name: 'Gamificación & Rankings', status: 'pendiente', estimatedDate: '2026-07-30', actualDate: null, modules: mods([{ name: 'Leaderboard mensual', status: 'pendiente' }, { name: 'Badges & niveles', status: 'pendiente' }, { name: 'Notificaciones push', status: 'pendiente' }]) },
      ],
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
      totalModules: 10, deliveredModules: 4, partialModules: 1, pendingModules: 5,
      paidAmount: 17220, totalAmount: 41000, progress: 42,
      lastDeployDate: '2026-05-28',
      sprints: [
        { id: uid(), name: 'Engine 3D', status: 'completado', estimatedDate: '2026-04-05', actualDate: '2026-04-11', modules: mods([{ name: 'Escena Three.js base', status: 'completado' }, { name: 'Controles de cámara', status: 'completado' }, { name: 'Iluminación PBR', status: 'completado' }]) },
        { id: uid(), name: 'Configurador', status: 'en progreso', estimatedDate: '2026-06-18', actualDate: null, modules: mods([{ name: 'Panel de dimensiones', status: 'completado' }, { name: 'Selector de vegetación', status: 'en progreso' }, { name: 'Sistema de drenaje', status: 'pendiente' }]) },
        { id: uid(), name: 'Presupuesto & PDF', status: 'pendiente', estimatedDate: '2026-07-15', actualDate: null, modules: mods([{ name: 'Motor de pricing', status: 'pendiente' }, { name: 'Export PDF técnico', status: 'pendiente' }, { name: 'Lead capture + CRM', status: 'pendiente' }]) },
      ],
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
      totalModules: 11, deliveredModules: 5, partialModules: 2, pendingModules: 4,
      paidAmount: 25850, totalAmount: 47000, progress: 55,
      lastDeployDate: '2026-05-30',
      sprints: [
        { id: uid(), name: 'Auth & Roles', status: 'completado', estimatedDate: '2026-03-22', actualDate: '2026-03-26', modules: mods([{ name: 'RBAC granular', status: 'completado' }, { name: 'Audit log', status: 'completado' }, { name: 'SSO empresarial', status: 'completado' }]) },
        { id: uid(), name: 'Ticketing', status: 'completado', estimatedDate: '2026-05-02', actualDate: '2026-05-08', modules: mods([{ name: 'CRUD tickets', status: 'completado' }, { name: 'SLA timers', status: 'completado' }, { name: 'Notificaciones email', status: 'en progreso' }]) },
        { id: uid(), name: 'Monitoreo de Instalaciones', status: 'en progreso', estimatedDate: '2026-06-25', actualDate: null, modules: mods([{ name: 'Mapa de sitios', status: 'en progreso' }, { name: 'Estado de dispositivos', status: 'pendiente' }, { name: 'Alertas en vivo', status: 'pendiente' }]) },
        { id: uid(), name: 'Reportes SLA', status: 'pendiente', estimatedDate: '2026-07-28', actualDate: null, modules: mods([{ name: 'Dashboard SLA', status: 'pendiente' }, { name: 'Export PDF/CSV', status: 'pendiente' }]) },
      ],
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
      totalModules: 13, deliveredModules: 7, partialModules: 2, pendingModules: 4,
      paidAmount: 28600, totalAmount: 44000, progress: 65,
      lastDeployDate: '2026-06-10',
      sprints: [
        { id: uid(), name: 'Reservas & Canchas', status: 'completado', estimatedDate: '2026-03-15', actualDate: '2026-03-19', modules: mods([{ name: 'Calendario de canchas', status: 'completado' }, { name: 'Motor de reservas', status: 'completado' }, { name: 'Reglas de disponibilidad', status: 'completado' }]) },
        { id: uid(), name: 'Alumnos & Coaches', status: 'completado', estimatedDate: '2026-04-26', actualDate: '2026-04-30', modules: mods([{ name: 'Perfiles de alumno', status: 'completado' }, { name: 'Asignación de coaches', status: 'completado' }, { name: 'Grupos & niveles', status: 'completado' }, { name: 'App de coach', status: 'completado' }]) },
        { id: uid(), name: 'Pagos', status: 'en progreso', estimatedDate: '2026-06-22', actualDate: null, modules: mods([{ name: 'Mensualidades recurrentes', status: 'completado' }, { name: 'Clases sueltas', status: 'en progreso' }, { name: 'Recordatorios de cobro', status: 'en progreso' }]) },
        { id: uid(), name: 'Progreso Deportivo', status: 'pendiente', estimatedDate: '2026-07-24', actualDate: null, modules: mods([{ name: 'Métricas de evaluación', status: 'pendiente' }, { name: 'Panel para padres', status: 'pendiente' }, { name: 'Reportes de progreso', status: 'pendiente' }]) },
      ],
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
  ]
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

/* ============================================================================
   5 · PERSISTED STATE HOOK
============================================================================ */
const STORE_KEY = 'insights_os_v1'
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return { clients: seedClients(), projects: seedProjects(), calls: seedCalls() }
}
function usePersisted() {
  const [data, setData] = useState(loadState)
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)) } catch (e) { /* quota */ }
  }, [data])
  return [data, setData]
}

/* ============================================================================
   6 · APP CONTEXT
============================================================================ */
const AppCtx = createContext(null)
const useApp = () => useContext(AppCtx)

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
async function anthropicChat({ system, messages }) {
  const key = localStorage.getItem('anthropic_key')
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
      model: 'claude-sonnet-4-20250514',
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
  }
  const s = map[tone] || map.neutral
  return <span className="tag" style={{ color: s.color, background: s.bg, borderColor: s.bd }}>{children}</span>
}
const statusTone = (s) => (s === 'completado' || s === 'delivered' ? 'green' : s === 'en progreso' || s === 'active' ? 'accent' : 'neutral')
const prioTone = (p) => (p === 'alta' ? 'red' : p === 'media' ? 'yellow' : 'neutral')
const sevTone = (s) => (s === 'alta' ? 'red' : s === 'media' ? 'yellow' : 'neutral')

function Progress({ value, height = 8, showLabel = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
      <div style={{ flex: 1, height, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${clamp(value, 0, 100)}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: pctColor(value), borderRadius: 999 }} />
      </div>
      {showLabel && <span className="mono" style={{ fontSize: 12, color: pctColor(value), fontWeight: 600, minWidth: 36, textAlign: 'right' }}>{value}%</span>}
    </div>
  )
}

function Modal({ open, onClose, title, sub, children, width = 720 }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 20px 40px' }}>
          <motion.div initial={{ y: 18, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="surface" style={{ width: '100%', maxWidth: width, maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: 19 }}>{title}</h3>
                {sub && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>{sub}</div>}
              </div>
              <button className="btn-ghost btn btn-sm" onClick={onClose} style={{ padding: 6 }}><I.x width={16} height={16} /></button>
            </div>
            <div className="scroll-y" style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } }
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }

/* continúa en parte 2 ... */

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
      <I.github width={13} height={13} style={{ flexShrink: 0 }} />
      <span className="mono" style={{ color: 'var(--text)' }}>{data.sha}</span>
      {!compact && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{data.message}</span>}
      <span className="tag" style={{ color: stale ? 'var(--red)' : 'var(--green)', background: stale ? 'var(--red-soft)' : 'var(--green-soft)', padding: '1px 7px', fontSize: 10 }}>
        {d === 0 ? 'hoy' : `${d}d`}{stale && ' ⚠'}
      </span>
    </span>
  )
}

/* ============================================================================
   11 · OVERVIEW
============================================================================ */
function Overview({ onOpenProject }) {
  const { data } = useApp()
  const active = data.projects.filter((p) => p.status === 'active')
  const clientOf = (id) => data.clients.find((c) => c.id === id)
  const lastCall = [...data.calls].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  const lastDeployProj = [...data.projects].sort((a, b) => new Date(b.lastDeployDate) - new Date(a.lastDeployDate))[0]
  const totalBilled = data.projects.reduce((s, p) => s + p.paidAmount, 0)
  const totalContract = data.projects.reduce((s, p) => s + p.totalAmount, 0)
  const avgProgress = Math.round(active.reduce((s, p) => s + p.progress, 0) / (active.length || 1))

  return (
    <div style={{ padding: '28px 34px 60px' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Insights Software · Project OS</div>
          <h1 style={{ fontSize: 34, lineHeight: 1.02 }}>Overview</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[['Proyectos activos', active.length], ['Avance promedio', avgProgress + '%'], ['Facturado', money(totalBilled)], ['Cartera total', money(totalContract)]].map(([k, v]) => (
            <div key={k} className="surface" style={{ padding: '12px 16px', minWidth: 128 }}>
              <div className="label">{k}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 16, marginBottom: 36 }}>
        {active.map((p) => {
          const cl = clientOf(p.clientId)
          const dd = daysAgo(p.lastDeployDate)
          return (
            <motion.div key={p.id} variants={rise} onClick={() => onOpenProject(p.id)}
              whileHover={{ y: -3 }} className="surface surface-hover click"
              style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                  {cl?.company?.[0] || '?'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl?.company} · {cl?.name}</div>
                </div>
                <Badge tone={statusTone(p.status)}>{p.status === 'active' ? 'Activo' : 'Entregado'}</Badge>
              </div>
              <Progress value={p.progress} showLabel />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <CommitChip repo={p.githubRepo} compact />
                <span style={{ fontSize: 11, color: dd > 7 ? 'var(--red)' : 'var(--text-faint)' }} className="mono">deploy {dd}d</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={p.productionUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }}><I.rocket width={13} height={13} /> Producción</a>
                <a href={p.devUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }}><I.ext width={13} height={13} /> Dev env</a>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      <h2 style={{ fontSize: 20, marginBottom: 14 }}>Actividad reciente</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <div className="surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--accent)' }}><I.phone width={15} height={15} /><span className="label" style={{ color: 'var(--accent)' }}>Última call registrada</span></div>
          {lastCall ? (<>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{clientOf(lastCall.clientId)?.company} · {fmtDate(lastCall.date)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>{lastCall.summary}</div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>Asesor: {lastCall.advisor}</div>
          </>) : <div style={{ color: 'var(--text-faint)' }}>Sin calls</div>}
        </div>
        <div className="surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--green)' }}><I.rocket width={15} height={15} /><span className="label" style={{ color: 'var(--green)' }}>Último deploy</span></div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{lastDeployProj.name} · {fmtDate(lastDeployProj.lastDeployDate)}</div>
          <CommitChip repo={lastDeployProj.githubRepo} />
          <div style={{ marginTop: 10 }}><a href={lastDeployProj.productionUrl} target="_blank" rel="noreferrer" className="btn btn-sm"><I.ext width={13} height={13} /> Ver en producción</a></div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   12 · PROJECTS LIST
============================================================================ */
function Projects({ onOpenProject }) {
  const { data } = useApp()
  const [tab, setTab] = useState('active')
  const [view, setView] = useState('cards')
  const [clientFilter, setClientFilter] = useState('all')
  const clientOf = (id) => data.clients.find((c) => c.id === id)
  let list = data.projects.filter((p) => p.status === tab)
  if (clientFilter !== 'all') list = list.filter((p) => p.clientId === clientFilter)

  return (
    <div style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Cartera</div>
          <h1 style={{ fontSize: 32 }}>Proyectos</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" style={{ width: 'auto', padding: '8px 10px' }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="all">Todos los clientes</option>
            {data.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
          <div className="surface" style={{ display: 'flex', padding: 3, borderRadius: 10 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('cards')} style={{ background: view === 'cards' ? 'var(--card-hover)' : 'transparent', color: view === 'cards' ? 'var(--accent)' : 'var(--text-dim)' }}><I.cards width={15} height={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('table')} style={{ background: view === 'table' ? 'var(--card-hover)' : 'transparent', color: view === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I.table width={15} height={15} /></button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {[['active', 'Activos'], ['delivered', 'Entregados']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '10px 16px', fontWeight: 600, fontSize: 14, color: tab === k ? 'var(--text)' : 'var(--text-faint)', borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
            {l} <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>{data.projects.filter((p) => p.status === k).length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 && <div className="surface" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Sin proyectos en esta vista.</div>}

      {view === 'cards' ? (
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
          {list.map((p) => {
            const cl = clientOf(p.clientId)
            const dd = daysAgo(p.lastDeployDate)
            const currentSprint = p.sprints.find((s) => s.status === 'en progreso')
            return (
              <motion.div key={p.id} variants={rise} whileHover={{ y: -3 }} onClick={() => onOpenProject(p.id)} className="surface surface-hover click" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{cl?.company}</div>
                  </div>
                  <Badge tone={statusTone(p.status)}>{p.status === 'active' ? 'Activo' : 'Entregado'}</Badge>
                </div>
                <div style={{ marginBottom: 14 }}><Progress value={p.progress} showLabel /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="surface" style={{ padding: '8px 11px', background: 'var(--bg-elevated)' }}>
                    <div className="label">Sprint actual</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSprint?.name || '—'}</div>
                  </div>
                  <div className="surface" style={{ padding: '8px 11px', background: 'var(--bg-elevated)' }}>
                    <div className="label">Días sin deploy</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: dd > 7 ? 'var(--red)' : 'var(--text)' }}>{dd}d {dd > 7 && '⚠'}</div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      ) : (
        <div className="surface" style={{ overflow: 'hidden' }}>
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Proyecto', 'Cliente', 'Avance', 'Sprint actual', 'Deploy', 'Cobrado'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const cl = clientOf(p.clientId)
                const dd = daysAgo(p.lastDeployDate)
                const cs = p.sprints.find((s) => s.status === 'en progreso')
                return (
                  <tr key={p.id} className="row-hover click" onClick={() => onOpenProject(p.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{cl?.company}</td>
                    <td style={{ padding: '13px 16px', minWidth: 160 }}><Progress value={p.progress} showLabel /></td>
                    <td style={{ padding: '13px 16px', color: 'var(--text-dim)', fontSize: 13 }}>{cs?.name || '—'}</td>
                    <td style={{ padding: '13px 16px' }} className="mono"><span style={{ color: dd > 7 ? 'var(--red)' : 'var(--text-dim)' }}>{dd}d</span></td>
                    <td style={{ padding: '13px 16px' }} className="mono">{money(p.paidAmount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   13 · CLIENTS
============================================================================ */
function Clients() {
  const { data, setData } = useApp()
  const [edit, setEdit] = useState(null)       // client being viewed/edited
  const [creating, setCreating] = useState(false)
  const projectsOf = (id) => data.projects.filter((p) => p.clientId === id && p.status === 'active').length

  const blank = { id: '', name: '', company: '', email: '', phone: '', onboardDate: NOW.toISOString(), onboarding: { businessDescription: '', goals: '', existingTech: '', approvedBudget: 0, notes: '' } }

  const saveClient = (c) => {
    setData((d) => {
      const exists = d.clients.some((x) => x.id === c.id)
      return { ...d, clients: exists ? d.clients.map((x) => (x.id === c.id ? c : x)) : [...d.clients, { ...c, id: uid() }] }
    })
    setEdit(null); setCreating(false)
  }

  const Form = ({ initial, onSave, onCancel }) => {
    const [f, setF] = useState(JSON.parse(JSON.stringify(initial)))
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
    const setO = (k, v) => setF((s) => ({ ...s, onboarding: { ...s.onboarding, [k]: v } }))
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Tecnologías existentes"><input className="input" value={f.onboarding.existingTech} onChange={(e) => setO('existingTech', e.target.value)} /></Field>
          <Field label="Presupuesto aprobado (USD)"><input className="input mono" type="number" value={f.onboarding.approvedBudget} onChange={(e) => setO('approvedBudget', Number(e.target.value))} /></Field>
        </div>
        <Field label="Observaciones"><textarea className="input" rows={2} value={f.onboarding.notes} onChange={(e) => setO('notes', e.target.value)} /></Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => onSave(f)}><I.check width={15} height={15} /> Guardar</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Cuentas</div><h1 style={{ fontSize: 32 }}>Clientes</h1></div>
        <button className="btn btn-accent" onClick={() => setCreating(true)}><I.plus width={15} height={15} /> Agregar cliente</button>
      </div>
      <div className="surface" style={{ overflow: 'hidden' }}>
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
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{fmtDate(c.onboardDate || NOW.toISOString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name} sub={`${edit?.company} · respuestas de onboarding`}>
        {edit && <Form initial={edit} onSave={saveClient} onCancel={() => setEdit(null)} />}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo cliente" sub="Formulario de onboarding">
        {creating && <Form initial={blank} onSave={saveClient} onCancel={() => setCreating(false)} />}
      </Modal>
    </div>
  )
}
function Field({ label, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="label">{label}</span>{children}</div>
}

/* ============================================================================
   14 · CALLS (+ Fathom sync)
============================================================================ */
function Calls() {
  const { data, setData } = useApp()
  const [open, setOpen] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const clientOf = (id) => data.clients.find((c) => c.id === id)
  const projOf = (id) => data.projects.find((p) => p.id === id)

  // Fathom MCP sync — intenta el endpoint real, cae a demo si CORS/no-token.
  const syncFathom = async () => {
    setSyncing(true); setSyncResult(null)
    const token = localStorage.getItem('fathom_token')
    try {
      const res = await fetch('https://api.fathom.ai/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_calls', arguments: { limit: 5 } } }),
      })
      if (!res.ok) throw new Error('http ' + res.status)
      const json = await res.json()
      setSyncResult({ ok: true, raw: json })
    } catch (e) {
      // Fallback demo (CORS/MCP no accesible desde browser sin proxy)
      setSyncResult({
        ok: false, error: e.message,
        demo: [
          { advisor: 'Federico Garbarino', date: '2026-06-10', title: 'Shockwave · seguimiento pagos', clientGuess: 'c5', projectGuess: 'p5', summary: 'JP confirmó pago drop-in funcionando en staging. Falta recordatorio de cobro.', transcript: '[00:00] JP: El pago en el momento ya funciona...\n[01:10] Fede: Cerramos recordatorios esta semana.' },
          { advisor: 'Lucía Méndez', date: '2026-06-08', title: 'Green Roofing · performance', clientGuess: 'c3', projectGuess: 'p3', summary: 'Gregorio aprobó la optimización mobile, FPS estable. Avanzamos con pricing.', transcript: '[00:00] Gregorio: Now it runs smooth on my phone...\n[00:50] Lucía: Great, sending the budget engine next.' },
        ],
      })
    } finally { setSyncing(false) }
  }

  const importCall = (d) => {
    setData((prev) => ({ ...prev, calls: [{ id: uid(), clientId: d.clientGuess || prev.clients[0].id, projectId: d.projectGuess || prev.projects[0].id, advisor: d.advisor, date: d.date, summary: d.summary, fathomUrl: 'https://fathom.video/share/' + uid(), transcript: d.transcript }, ...prev.calls] }))
  }

  return (
    <div style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Soporte & seguimiento</div><h1 style={{ fontSize: 32 }}>Calls</h1></div>
        <button className="btn btn-accent" onClick={syncFathom} disabled={syncing}>
          <I.refresh width={15} height={15} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} /> {syncing ? 'Sincronizando…' : 'Sync Fathom'}
        </button>
      </div>

      {syncResult && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="surface" style={{ padding: 16, marginBottom: 18, borderColor: 'var(--accent-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>{syncResult.ok ? 'Fathom respondió ✓' : 'Calls importadas desde Fathom (demo)'}</strong>
            <button className="btn btn-sm btn-ghost" onClick={() => setSyncResult(null)}><I.x width={14} height={14} /></button>
          </div>
          {!syncResult.ok && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>El MCP <span className="mono">api.fathom.ai/mcp</span> no es accesible directo desde el browser ({syncResult.error}). Mostrando últimas calls de ejemplo para asignar:</div>}
          {(syncResult.demo || []).map((d, i) => (
            <div key={i} className="surface" style={{ padding: 12, marginBottom: 8, background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{d.advisor} · {fmtDate(d.date)} · {clientOf(d.clientGuess)?.company}</div>
              </div>
              <button className="btn btn-sm btn-accent" onClick={() => { importCall(d); setSyncResult((r) => ({ ...r, demo: r.demo.filter((_, j) => j !== i) })) }}><I.plus width={13} height={13} /> Asignar</button>
            </div>
          ))}
        </motion.div>
      )}

      <div className="surface" style={{ overflow: 'hidden' }}>
        <table>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Asesor', 'Cliente', 'Proyecto', 'Fecha', 'Resumen', 'Fathom'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[...data.calls].sort((a, b) => new Date(b.date) - new Date(a.date)).map((c) => (
              <tr key={c.id} className="row-hover click" onClick={() => setOpen(c)} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '13px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.advisor}</td>
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{clientOf(c.clientId)?.company}</td>
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{projOf(c.projectId)?.name}</td>
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }} className="mono">{fmtDate(c.date)}</td>
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.summary}</td>
                <td style={{ padding: '13px 16px' }}><a href={c.fathomUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent)' }}><I.link width={16} height={16} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${clientOf(open.clientId)?.company}` : ''} sub={open ? `${open.advisor} · ${fmtDate(open.date)} · ${projOf(open.projectId)?.name}` : ''}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <a href={open.fathomUrl} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}><I.link width={14} height={14} /> Abrir en Fathom</a>
            <div><div className="label" style={{ marginBottom: 8 }}>Resumen</div><div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-dim)' }}>{open.summary}</div></div>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Transcript completo</div>
              <pre className="mono surface" style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-dim)', padding: 16, background: 'var(--bg-elevated)', whiteSpace: 'pre-wrap', margin: 0 }}>{open.transcript}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================================
   15 · PROJECT DETAIL — KPI grid · kickoff · sprints · pending · risks · chat
============================================================================ */
function KpiCard({ label, value, sub, tone, onClick }) {
  return (
    <motion.button variants={rise} onClick={onClick} whileHover={{ y: -2 }}
      className="surface surface-hover click" style={{ padding: 15, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="label">{label}</span>
      <span className="mono" style={{ fontSize: 24, fontWeight: 600, color: tone || 'var(--text)', lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{sub}</span>}
    </motion.button>
  )
}

function ProjectDetail({ projectId, onBack }) {
  const { data, setData } = useApp()
  const project = data.projects.find((p) => p.id === projectId)
  const client = data.clients.find((c) => c.id === project?.clientId)
  const gh = useGithubCommit(project?.githubRepo)
  const [kpiModal, setKpiModal] = useState(null)
  const [kickoffOpen, setKickoffOpen] = useState(true)
  const [editKickoff, setEditKickoff] = useState(false)
  const [expandedSprint, setExpandedSprint] = useState(null)

  if (!project) return null
  const patch = (fn) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === projectId ? fn(p) : p)) }))

  // Sprint-driven progress
  const sprintProgress = useMemo(() => {
    const total = project.sprints.length || 1
    const done = project.sprints.filter((s) => s.status === 'completado').length
    const inProg = project.sprints.filter((s) => s.status === 'en progreso').length * 0.5
    return Math.round(((done + inProg) / total) * 100)
  }, [project.sprints])

  const toggleSprint = (sid) => patch((p) => ({
    ...p,
    sprints: p.sprints.map((s) => s.id === sid ? { ...s, status: s.status === 'completado' ? 'pendiente' : 'completado', actualDate: s.status === 'completado' ? null : NOW.toISOString() } : s),
  }))

  const allModules = project.sprints.flatMap((s) => s.modules.map((m) => ({ ...m, sprint: s.name })))
  const kpiDetails = {
    scope: { title: 'Módulos en scope', rows: allModules.map((m) => [m.sprint, m.name, m.status]) },
    delivered: { title: 'Módulos entregados', rows: allModules.filter((m) => m.status === 'completado').map((m) => [m.sprint, m.name, m.status]) },
    partial: { title: 'Módulos parciales', rows: allModules.filter((m) => m.status === 'en progreso').map((m) => [m.sprint, m.name, m.status]) },
    pending: { title: 'Módulos pendientes', rows: allModules.filter((m) => m.status === 'pendiente').map((m) => [m.sprint, m.name, m.status]) },
    paid: { title: 'Desglose de pagos', rows: [['Contrato total', '', money(project.totalAmount)], ['Pagado', '', money(project.paidAmount)], ['Saldo por cobrar', '', money(project.totalAmount - project.paidAmount)]] },
    due: { title: 'Por cobrar', rows: [['Por cobrar', '', money(project.totalAmount - project.paidAmount)], ['% cobrado', '', Math.round((project.paidAmount / project.totalAmount) * 100) + '%']] },
  }

  const dd = daysAgo(project.lastDeployDate)
  const billedPct = Math.round((project.paidAmount / project.totalAmount) * 100)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* LEFT 70% */}
      <div className="scroll-y" style={{ flex: '1 1 70%', padding: '24px 30px 60px', overflowY: 'auto' }}>
        <button className="btn btn-sm btn-ghost" onClick={onBack} style={{ marginBottom: 16, transform: 'scaleX(-1)' }}><I.chevR width={15} height={15} /></button>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 30 }}>{project.name}</h1>
          <Badge tone={statusTone(project.status)}>{project.status === 'active' ? 'Activo' : 'Entregado'}</Badge>
        </div>
        <div style={{ color: 'var(--text-dim)', marginBottom: 16, fontSize: 14 }}>{client?.company} · {client?.name} · {project.stack}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
          <a href={project.productionUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-accent"><I.rocket width={14} height={14} /> Producción</a>
          <a href={project.devUrl} target="_blank" rel="noreferrer" className="btn btn-sm"><I.ext width={14} height={14} /> Dev env</a>
          <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noreferrer" className="btn btn-sm"><I.github width={14} height={14} /> GitHub repo</a>
          <div className="btn btn-sm" style={{ cursor: 'default', borderColor: 'var(--border)' }}><CommitChip repo={project.githubRepo} compact /></div>
        </div>

        {/* KPI GRID */}
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 30 }}>
          <KpiCard label="Módulos scope" value={project.totalModules} sub="ver desglose" onClick={() => setKpiModal('scope')} />
          <KpiCard label="Entregados" value={project.deliveredModules} tone="var(--green)" sub="ver desglose" onClick={() => setKpiModal('delivered')} />
          <KpiCard label="Parciales" value={project.partialModules} tone="var(--accent)" sub="ver desglose" onClick={() => setKpiModal('partial')} />
          <KpiCard label="Pendientes" value={project.pendingModules} tone="var(--text-dim)" sub="ver desglose" onClick={() => setKpiModal('pending')} />
          <KpiCard label="Pagado" value={money(project.paidAmount)} tone="var(--green)" sub={`${billedPct}% del total`} onClick={() => setKpiModal('paid')} />
          <KpiCard label="Por cobrar" value={money(project.totalAmount - project.paidAmount)} tone="var(--red)" sub="ver desglose" onClick={() => setKpiModal('due')} />
          <KpiCard label="Last deploy" value={`${dd}d`} tone={dd > 7 ? 'var(--red)' : 'var(--text)'} sub={fmtDate(project.lastDeployDate)} onClick={() => setKpiModal('deploy')} />
          <KpiCard label="Avance general" value={`${sprintProgress}%`} tone={pctColor(sprintProgress)} sub="por sprints" onClick={() => setKpiModal('progress')} />
        </motion.div>

        {/* KICK-OFF */}
        <div className="surface" style={{ marginBottom: 26, overflow: 'hidden' }}>
          <button onClick={() => setKickoffOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><I.spark width={17} height={17} style={{ color: 'var(--accent)' }} /><strong style={{ fontFamily: 'Bricolage Grotesque', fontSize: 16 }}>Kick-off del proyecto</strong></span>
            <I.chevD width={18} height={18} style={{ transform: kickoffOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--text-faint)' }} />
          </button>
          <AnimatePresence>
            {kickoffOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0 18px 18px' }}>
                  {editKickoff ? (
                    <>
                      <textarea className="input" rows={5} value={project.kickoff} onChange={(e) => patch((p) => ({ ...p, kickoff: e.target.value }))} />
                      <button className="btn btn-sm btn-accent" style={{ marginTop: 10 }} onClick={() => setEditKickoff(false)}><I.check width={13} height={13} /> Listo</button>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)', margin: '0 0 14px' }}>{project.kickoff}</p>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditKickoff(true)} style={{ marginBottom: 14 }}><I.doc width={13} height={13} /> Editar</button>
                    </>
                  )}
                  <div className="label" style={{ marginBottom: 8 }}>Avance por sprints</div>
                  <Progress value={sprintProgress} showLabel height={10} />
                  {/* Sprint timeline */}
                  <div style={{ display: 'flex', gap: 0, marginTop: 18, overflowX: 'auto', paddingBottom: 6 }}>
                    {project.sprints.map((s, i) => (
                      <div key={s.id} style={{ flex: 1, minWidth: 120, position: 'relative', paddingTop: 22 }}>
                        <div style={{ position: 'absolute', top: 8, left: 0, right: 0, height: 2, background: 'var(--border)' }} />
                        <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: 999, background: s.status === 'completado' ? 'var(--green)' : s.status === 'en progreso' ? 'var(--accent)' : 'var(--bg-elevated)', border: '2px solid var(--border-strong)' }} />
                        <div style={{ textAlign: 'center', padding: '0 6px' }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }} className="mono">{fmtDate(s.estimatedDate)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SPRINT TABLE */}
        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Sprints</h2>
        <div className="surface" style={{ overflow: 'hidden', marginBottom: 26 }}>
          <table>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['#', 'Nombre', 'Módulos', 'Estado', 'Estimada', 'Real', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {project.sprints.map((s, i) => (
                <React.Fragment key={s.id}>
                  <tr className="row-hover click" onClick={() => setExpandedSprint(expandedSprint === s.id ? null : s.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px' }} className="mono">{i + 1}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-dim)' }} className="mono">{s.modules.length}</td>
                    <td style={{ padding: '12px 14px' }}><Badge tone={statusTone(s.status)}>{s.status}</Badge></td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-dim)' }} className="mono">{fmtDate(s.estimatedDate)}</td>
                    <td style={{ padding: '12px 14px', color: s.actualDate ? 'var(--green)' : 'var(--text-faint)' }} className="mono">{s.actualDate ? fmtDate(s.actualDate) : '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); toggleSprint(s.id) }} title="Marcar completado" style={{ color: s.status === 'completado' ? 'var(--green)' : 'var(--text-faint)' }}><I.check width={15} height={15} /></button>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedSprint === s.id && (
                      <tr><td colSpan={7} style={{ padding: 0 }}>
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                          <div style={{ padding: '12px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {s.modules.map((m) => (
                              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span style={{ fontSize: 13.5 }}>{m.name}</span><Badge tone={statusTone(m.status)}>{m.status}</Badge>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </td></tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* PENDING ITEMS */}
        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Pendientes</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 26 }}>
          {[['Pendiente agencia', project.pendingAgency], ['Pendiente cliente', project.pendingClient]].map(([title, items]) => (
            <div key={title}>
              <div className="label" style={{ marginBottom: 10 }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.length === 0 && <div className="surface" style={{ padding: 14, color: 'var(--text-faint)', fontSize: 13 }}>Sin pendientes ✓</div>}
                {items.map((it) => (
                  <div key={it.id} className="surface" style={{ padding: 13, borderLeft: `3px solid ${it.priority === 'alta' ? 'var(--red)' : it.priority === 'media' ? 'var(--yellow)' : 'var(--border-strong)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <strong style={{ fontSize: 13.5 }}>{it.title}</strong><Badge tone={prioTone(it.priority)}>{it.priority}</Badge>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>{it.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RISKS */}
        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Riesgos activos</h2>
        <div className="surface" style={{ padding: 6 }}>
          {project.risks.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderBottom: '1px solid var(--border)' }}>
              <I.alert width={17} height={17} style={{ color: r.severity === 'alta' ? 'var(--red)' : r.severity === 'media' ? 'var(--yellow)' : 'var(--text-faint)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13.5 }}>{r.description}</span>
              <Badge tone={sevTone(r.severity)}>{r.severity}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT 30% — AI CHAT */}
      <ProjectChat project={project} client={client} patch={patch} />

      {/* KPI MODAL */}
      <Modal open={!!kpiModal} onClose={() => setKpiModal(null)} title={kpiModal === 'deploy' ? 'Last deploy' : kpiModal === 'progress' ? 'Avance por sprints' : kpiDetails[kpiModal]?.title} width={640}>
        {kpiModal === 'deploy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="surface" style={{ padding: 14, background: 'var(--bg-elevated)' }}>
              <div className="label">Último commit en {project.githubRepo}</div>
              {gh.data ? <div style={{ marginTop: 8 }}><div className="mono" style={{ fontWeight: 600 }}>{gh.data.sha} · {gh.data.author}</div><div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{gh.data.message}</div><div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>{fmtDate(gh.data.date)} · hace {daysAgo(gh.data.date)}d</div></div> : <div style={{ marginTop: 8, color: 'var(--text-faint)' }}>{gh.error || 'cargando…'}</div>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Last deploy registrado: <strong>{fmtDate(project.lastDeployDate)}</strong> (hace {dd} días). {dd > 7 && <span style={{ color: 'var(--red)' }}>⚠ Más de 7 días sin deploy.</span>}</div>
          </div>
        )}
        {kpiModal === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Progress value={sprintProgress} showLabel height={12} />
            {project.sprints.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>{s.name}</span><Badge tone={statusTone(s.status)}>{s.status}</Badge>
              </div>
            ))}
          </div>
        )}
        {kpiModal && kpiDetails[kpiModal] && (
          <table>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Origen', 'Detalle', 'Valor / estado'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>{kpiDetails[kpiModal].rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 10px', color: 'var(--text-faint)', fontSize: 13 }}>{r[0]}</td>
                <td style={{ padding: '9px 10px', fontSize: 13.5 }}>{r[1]}</td>
                <td style={{ padding: '9px 10px' }}>{['completado', 'en progreso', 'pendiente'].includes(r[2]) ? <Badge tone={statusTone(r[2])}>{r[2]}</Badge> : <span className="mono" style={{ fontSize: 13 }}>{r[2]}</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================================
   16 · PROJECT AI CHAT (Anthropic, project-scoped, persisted)
============================================================================ */
function buildSystemPrompt(project, client) {
  const sprintTxt = project.sprints.map((s) => `  - ${s.name} [${s.status}] módulos: ${s.modules.map((m) => `${m.name}(${m.status})`).join(', ')}`).join('\n')
  const pa = project.pendingAgency.map((p) => `  - [${p.priority}] ${p.title}: ${p.description}`).join('\n') || '  (ninguno)'
  const pc = project.pendingClient.map((p) => `  - [${p.priority}] ${p.title}: ${p.description}`).join('\n') || '  (ninguno)'
  return `Sos el asistente IA del proyecto "${project.name}" de Insights Software para el cliente ${client?.company} (${client?.name}).

KICK-OFF:
${project.kickoff}

STACK: ${project.stack}
AVANCE: ${project.progress}% · ${project.deliveredModules}/${project.totalModules} módulos entregados

SPRINTS:
${sprintTxt}

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
    patch((p) => ({ ...p, chats: [{ id, date: NOW.toISOString(), title: 'Nueva conversación', messages: [] }, ...p.chats] }))
    setActiveChatId(id); setShowHistory(false)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    let chatId = activeChatId
    if (!chatId) { chatId = uid(); patch((p) => ({ ...p, chats: [{ id: chatId, date: NOW.toISOString(), title: 'Nueva conversación', messages: [] }, ...p.chats] })); setActiveChatId(chatId) }
    const userMsg = { role: 'user', content: text, timestamp: Date.now() }
    patch((p) => ({ ...p, chats: p.chats.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? (text.length > 38 ? text.slice(0, 38) + '…' : text) : c.title } : c) }))
    setInput(''); setSending(true); setError(null)

    const history = [...(project.chats.find((c) => c.id === chatId)?.messages || []), userMsg]
    try {
      const reply = await anthropicChat({ system: buildSystemPrompt(project, client), messages: history })
      patch((p) => ({ ...p, chats: p.chats.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, { role: 'assistant', content: reply, timestamp: Date.now() }] } : c) }))
    } catch (e) {
      if (e.message === 'NO_KEY') setError('Configurá tu Anthropic API key en ⚙ Ajustes para usar el chat.')
      else setError(e.message)
    } finally { setSending(false) }
  }

  return (
    <div style={{ flex: '0 0 360px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', minWidth: 320 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><I.spark width={17} height={17} style={{ color: 'var(--accent)' }} /><strong style={{ fontFamily: 'Bricolage Grotesque', fontSize: 15 }}>Asistente del proyecto</strong></div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowHistory((v) => !v)} title="Historial"><I.clock width={15} height={15} /></button>
          <button className="btn btn-sm btn-ghost" onClick={newChat} title="Nuevo chat"><I.plus width={15} height={15} /></button>
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
            <I.spark width={28} height={28} style={{ color: 'var(--accent)', marginBottom: 12 }} />
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
          <button onClick={send} disabled={sending || !input.trim()} className="btn-accent" style={{ position: 'absolute', right: 8, bottom: 8, width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', opacity: input.trim() ? 1 : 0.5 }}><I.send width={15} height={15} /></button>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 6, textAlign: 'center' }} className="mono">claude-sonnet-4 · Enter envía · Shift+Enter salto</div>
      </div>
    </div>
  )
}

/* ============================================================================
   17 · SIDEBAR
============================================================================ */
function Sidebar({ route, setRoute, collapsed, setCollapsed }) {
  const items = [
    { key: 'overview', label: 'Overview', icon: I.grid },
    { key: 'projects', label: 'Projects', icon: I.folder },
    { key: 'clients', label: 'Clients', icon: I.users },
    { key: 'calls', label: 'Calls', icon: I.phone },
  ]
  return (
    <motion.aside animate={{ width: collapsed ? 64 : 232 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '18px 16px', height: 64 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: 'Bricolage Grotesque', fontWeight: 800, color: '#fff', fontSize: 17 }}>I</div>
        {!collapsed && <div style={{ minWidth: 0 }}><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Insights</div><div style={{ fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '.04em' }}>SOFTWARE · OS</div></div>}
      </div>
      <hr className="divider" />
      <nav style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {items.map((it) => {
          const active = route.view === it.key || (route.view === 'project' && it.key === 'projects')
          return (
            <button key={it.key} onClick={() => setRoute({ view: it.key })} title={collapsed ? it.label : ''}
              className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, color: active ? 'var(--accent)' : 'var(--text-dim)', background: active ? 'var(--accent-soft)' : 'transparent', fontWeight: 600, fontSize: 14, position: 'relative' }}>
              {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 9, background: 'var(--accent)' }} />}
              <it.icon width={18} height={18} style={{ flexShrink: 0 }} />
              {!collapsed && it.label}
            </button>
          )
        })}
      </nav>
      <hr className="divider" />
      <button onClick={() => setCollapsed((v) => !v)} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'var(--text-faint)', fontSize: 13 }}>
        <I.panelLeft width={17} height={17} style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }} />{!collapsed && 'Colapsar'}
      </button>
    </motion.aside>
  )
}

/* ============================================================================
   18 · HEADER + SETTINGS
============================================================================ */
function Header({ theme, setTheme, onSettings, route }) {
  const crumb = { overview: 'Overview', projects: 'Projects', clients: 'Clients', calls: 'Calls', project: 'Projects / Detalle' }[route.view]
  return (
    <header style={{ height: 64, flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'var(--bg-elevated)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 13 }}>
        <span className="mono" style={{ color: 'var(--text-faint)' }}>insights-os</span><I.chevR width={14} height={14} style={{ color: 'var(--text-faint)' }} /><strong style={{ color: 'var(--text)' }}>{crumb}</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-sm btn-ghost" onClick={onSettings} title="Ajustes & API keys">⚙ <span style={{ marginLeft: 2 }}>Ajustes</span></button>
        <button className="btn btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Cambiar tema" style={{ padding: 8 }}>
          {theme === 'dark' ? <I.sun width={16} height={16} /> : <I.moon width={16} height={16} />}
        </button>
      </div>
    </header>
  )
}

function Settings({ open, onClose }) {
  const [keys, setKeys] = useState({ anthropic_key: '', gh_token: '', fathom_token: '' })
  useEffect(() => { if (open) setKeys({ anthropic_key: localStorage.getItem('anthropic_key') || '', gh_token: localStorage.getItem('gh_token') || '', fathom_token: localStorage.getItem('fathom_token') || '' }) }, [open])
  const save = () => { Object.entries(keys).forEach(([k, v]) => v ? localStorage.setItem(k, v) : localStorage.removeItem(k)); onClose() }
  return (
    <Modal open={open} onClose={onClose} title="Ajustes & integraciones" sub="Las claves se guardan solo en tu navegador (localStorage)" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Anthropic API key (chat IA · claude-sonnet-4)"><input className="input mono" type="password" placeholder="sk-ant-…" value={keys.anthropic_key} onChange={(e) => setKeys((s) => ({ ...s, anthropic_key: e.target.value }))} /></Field>
        <Field label="GitHub token (opcional · sube el rate limit)"><input className="input mono" type="password" placeholder="ghp_… / github_pat_…" value={keys.gh_token} onChange={(e) => setKeys((s) => ({ ...s, gh_token: e.target.value }))} /></Field>
        <Field label="Fathom token (sync de calls)"><input className="input mono" type="password" placeholder="fathom_…" value={keys.fathom_token} onChange={(e) => setKeys((s) => ({ ...s, fathom_token: e.target.value }))} /></Field>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
          El chat usa la Anthropic API directo desde el browser (<span className="mono">anthropic-dangerous-direct-browser-access</span>). GitHub usa la API pública. El MCP de Fathom puede requerir un proxy por CORS — si falla, se muestran calls de ejemplo para asignar.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={save}><I.check width={15} height={15} /> Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

/* ============================================================================
   19 · ROOT APP
============================================================================ */
export default function InsightsApp() {
  const [data, setData] = usePersisted()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [route, setRoute] = useState({ view: 'overview' })
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState(false)

  // inject global css once
  useEffect(() => {
    if (document.getElementById('insights-css')) return
    const el = document.createElement('style')
    el.id = 'insights-css'
    el.textContent = GLOBAL_CSS + '\n@keyframes spin{to{transform:rotate(360deg)}}'
    document.head.appendChild(el)
  }, [])

  // apply theme vars
  useEffect(() => {
    const vars = THEMES[theme]
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const openProject = (id) => setRoute({ view: 'project', projectId: id })

  return (
    <AppCtx.Provider value={{ data, setData }}>
      <div className="app-shell">
        <Sidebar route={route} setRoute={setRoute} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Header theme={theme} setTheme={setTheme} onSettings={() => setSettings(true)} route={route} />
          <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div key={route.view + (route.projectId || '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                style={{ height: '100%', overflow: route.view === 'project' ? 'hidden' : 'auto' }}>
                {route.view === 'overview' && <Overview onOpenProject={openProject} />}
                {route.view === 'projects' && <Projects onOpenProject={openProject} />}
                {route.view === 'clients' && <Clients />}
                {route.view === 'calls' && <Calls />}
                {route.view === 'project' && <ProjectDetail projectId={route.projectId} onBack={() => setRoute({ view: 'projects' })} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <Settings open={settings} onClose={() => setSettings(false)} />
      </div>
    </AppCtx.Provider>
  )
}
