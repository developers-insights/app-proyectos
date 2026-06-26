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
import { createClient } from '@supabase/supabase-js'

/* ============================================================================
   0 · SUPABASE (cloud persistence + auth) — optional, enabled via env vars
   VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY (set locally in .env and in Render)
============================================================================ */
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null
const cloudEnabled = !!supabase

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
  pencil: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>,
  whatsapp: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3a9 9 0 0 0-7.7 13.7L3 21l4.5-1.2A9 9 0 1 0 12 3z"/><path d="M8.6 8.4c-.2.2-.4.6-.4 1.1 0 .6.2 1.4 1.1 2.6.9 1.2 2.3 2.2 3.4 2.5.9.3 1.6.1 1.9-.4.2-.3.2-.7.1-.9l-.3-.7c-.1-.2-.4-.3-.6-.2l-.9.3-1.6-1.6.3-.9c.1-.2 0-.5-.2-.6l-.7-.3c-.2-.1-.6-.1-.9.1z"/></svg>,
  pause: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>,
  trash: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>,
  grip: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>,
  calendar: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>,
  comment: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/></svg>,
  kanban: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="4" width="5" height="16" rx="1.3"/><rect x="9.5" y="4" width="5" height="11" rx="1.3"/><rect x="16" y="4" width="5" height="14" rx="1.3"/></svg>,
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
    { id: 'c6', name: 'Leonardo', company: 'iRowing', email: 'leonardo@irowing.app', phone: '+54 11 5555 0106', onboarding: { businessDescription: 'Ex remero de la selección argentina (15+ años). Coach de remo indoor con máquinas Concept2.', goals: 'App de análisis de rendimiento con datos de la API Concept2 y visualización motivacional tipo bolsa.', existingTech: 'Google Sheets manual', approvedBudget: 0, notes: 'Foco motivacional para gente común que empieza a remar.' } },
    { id: 'c7', name: 'Mariano Sabbadin', company: 'Real Deal Exchange AI', email: 'mariano@realdealexchange.ai', phone: '+1 470 555 0107', onboarding: { businessDescription: 'Ecosistema PropTech de oportunidades inmobiliarias en EE.UU. (creative finance, Subject-To, Seller Finance).', goals: 'CRM + agentes IA + marketplace multi-tenant para captura, scoring y comunicaciones.', existingTech: 'Planillas + APIs externas de data inmobiliaria', approvedBudget: 15000, notes: 'Contacto clave: Jossueth Irigoyen. Escalable a Georgia, Texas y otros estados.' } },
    { id: 'c8', name: 'José Anaya', company: 'MCS Cleaning Marketplace', email: 'jose@mcscleaning.com', phone: '+1 305 555 0108', onboarding: { businessDescription: 'Marketplace de servicios de limpieza del hogar en EE.UU. con trabajadores independientes ("asociados").', goals: 'Plataforma para cotizar/contratar online, gestión de asociados por zona y control de comisiones.', existingTech: 'Operación manual', approvedBudget: 0, notes: 'Lleva 15 años con la idea. Cobro automático Stripe con split de comisión.' } },
    { id: 'c9', name: 'Marco', company: 'Kintsugi Roadside', email: 'marco@kintsugiroadside.com', phone: '+1 786 555 0109', onboarding: { businessDescription: 'Servicio de emergencias automotrices que conecta clientes con técnicos en campo.', goals: 'Plataforma estilo Uber para emergencias: solicitud, asignación, tracking GPS, cobro Zelle.', existingTech: 'Sin sistema centralizado', approvedBudget: 8000, notes: 'Incluye landing premium, apps cliente/técnico, panel admin y B2B/flotas.' } },
    { id: 'c10', name: 'Agustín', company: 'MMD Jewelry', email: 'agustin@mmdjewelry.com', phone: '+54 11 5555 0110', onboarding: { businessDescription: 'Joyería con ~50 piezas para vender internacionalmente, hoy gestionadas en Excel.', goals: 'Sitio e-commerce headless de diseño editorial (Next.js) conectado a Shopify.', existingTech: 'Excel', approvedBudget: 0, notes: 'Estética tipo Concio Studio. Paleta: blanco roto, dorado arena, rosa palo, vino suave, verde salvia.' } },
  ]
}

/* team members — rol NO fijo (se define por proyecto en assignments) */
function seedTeam() {
  return [
    { id: 'u1', name: 'Federico Garbarino', color: '#F97316', initials: 'FG' },
    { id: 'u2', name: 'Lisandro', color: '#6366F1', initials: 'L' },
    { id: 'u3', name: 'Manuel Navarro', color: '#10B981', initials: 'MN' },
    { id: 'u4', name: 'Nicolas Arditi', color: '#EC4899', initials: 'NA' },
    { id: 'u5', name: 'Juan Pamies', color: '#38BDF8', initials: 'JP' },
    { id: 'u6', name: 'Valentin Toledo', color: '#A855F7', initials: 'VT' },
  ]
}
/* default demo assignments for the original 5 projects (rol por proyecto) */
const DEMO_ASSIGN = {
  p1: { pm: { userId: 'u1', roleLabel: 'Project Manager' }, dev: { userId: 'u3', roleLabel: 'Developer' } },
  p2: { pm: { userId: 'u2', roleLabel: 'Project Manager' }, dev: { userId: 'u4', roleLabel: 'Developer' } },
  p3: { pm: { userId: 'u1', roleLabel: 'Project Manager' }, dev: { userId: 'u5', roleLabel: 'Developer' } },
  p4: { pm: { userId: 'u4', roleLabel: 'Project Manager' }, dev: { userId: 'u3', roleLabel: 'Developer' } },
  p5: { pm: { userId: 'u1', roleLabel: 'Project Manager' }, dev: { userId: 'u1', roleLabel: 'Lead Dev' } },
}
const TAG_NEW = () => ({ id: uid(), text: 'New', color: '#22C55E' })
const TAG_NEXT = () => ({ id: uid(), text: 'Next', color: '#3B82F6' })

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
    {
      id: 'p6', clientId: 'c6', name: 'iRowing', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: 'insights-software/irowing', stack: 'React Native · Node.js · OAuth 2.0 Concept2',
      kickoff: 'App de análisis de rendimiento para atletas de remo indoor con máquinas Concept2. El cliente es Leonardo, ex remero de la selección argentina con 15+ años entrenando, que hoy gestiona todo en Google Sheets manualmente. La app descarga los datos de cada remada vía OAuth 2.0 a la API de Concept2, los analiza y los presenta con visualización tipo bolsa de valores (verde/rojo según mejora o baja). Foco motivacional para gente común que empieza a remar. Incluye app móvil para el atleta + dashboard web admin para Leonardo como coach. Soporte post-lanzamiento: 30 días.',
      totalModules: 0, deliveredModules: 0, partialModules: 0, pendingModules: 0,
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: '2026-06-09',
      tags: [TAG_NEW()],
      sprints: [
        { id: uid(), name: 'S1 · Onboarding & OAuth Concept2', status: 'pendiente', estimatedDate: '2026-06-18', actualDate: null, modules: mods([{ name: 'Onboarding', status: 'pendiente' }, { name: 'Setup', status: 'pendiente' }, { name: 'OAuth 2.0 Concept2', status: 'pendiente' }]) },
        { id: uid(), name: 'S2 · MVP Logbook + gráficos', status: 'pendiente', estimatedDate: '2026-06-25', actualDate: null, modules: mods([{ name: 'Logbook sincronizado', status: 'pendiente' }, { name: 'Primeros gráficos', status: 'pendiente' }, { name: 'Revisión formal', status: 'pendiente' }]) },
        { id: uid(), name: 'S3 · Visualización stock market', status: 'pendiente', estimatedDate: '2026-07-02', actualDate: null, modules: mods([{ name: 'Visualización tipo bolsa', status: 'pendiente' }, { name: 'Comparativos semana a semana', status: 'pendiente' }]) },
        { id: uid(), name: 'S4 · Notificaciones & insights', status: 'pendiente', estimatedDate: '2026-07-09', actualDate: null, modules: mods([{ name: 'Push notifications', status: 'pendiente' }, { name: 'Motor de insights automáticos', status: 'pendiente' }]) },
        { id: uid(), name: 'S5 · Dashboard admin coach', status: 'pendiente', estimatedDate: '2026-07-16', actualDate: null, modules: mods([{ name: 'Gestión de atletas', status: 'pendiente' }, { name: 'Importación masiva Excel/CSV/Sheets', status: 'pendiente' }]) },
        { id: uid(), name: 'S6 · Lanzamiento & entrega', status: 'pendiente', estimatedDate: '2026-07-23', actualDate: null, modules: mods([{ name: 'Rankings mundiales Concept2', status: 'pendiente' }, { name: 'QA', status: 'pendiente' }, { name: 'Publicación App Store + Google Play', status: 'pendiente' }, { name: 'Entrega código fuente', status: 'pendiente' }]) },
      ],
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
      totalModules: 0, deliveredModules: 0, partialModules: 0, pendingModules: 0,
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: '2026-06-08',
      tags: [TAG_NEW()],
      sprints: [
        { id: uid(), name: 'S1 · Setup · Auth · Roles', status: 'pendiente', estimatedDate: '2026-06-18', actualDate: null, modules: mods([{ name: 'Arquitectura', status: 'pendiente' }, { name: 'Auth', status: 'pendiente' }, { name: 'Roles', status: 'pendiente' }]) },
        { id: uid(), name: 'S2 · Calculadora & catálogo', status: 'pendiente', estimatedDate: '2026-06-25', actualDate: null, modules: mods([{ name: 'Calculadora de precios dinámica', status: 'pendiente' }, { name: 'Catálogo de servicios', status: 'pendiente' }, { name: 'Revisión formal', status: 'pendiente' }]) },
        { id: uid(), name: 'S3 · Solicitud & matching', status: 'pendiente', estimatedDate: '2026-07-02', actualDate: null, modules: mods([{ name: 'Flujo de solicitud', status: 'pendiente' }, { name: 'Geolocalización', status: 'pendiente' }, { name: 'Matching con asociados', status: 'pendiente' }]) },
        { id: uid(), name: 'S4 · Stripe & chat', status: 'pendiente', estimatedDate: '2026-07-09', actualDate: null, modules: mods([{ name: 'Integración Stripe', status: 'pendiente' }, { name: 'Split de comisión', status: 'pendiente' }, { name: 'Chat cliente-asociado', status: 'pendiente' }]) },
        { id: uid(), name: 'S5 · Dashboard admin', status: 'pendiente', estimatedDate: '2026-07-16', actualDate: null, modules: mods([{ name: 'Dashboard admin', status: 'pendiente' }, { name: 'Métricas', status: 'pendiente' }, { name: 'Reportes', status: 'pendiente' }, { name: 'Sistema de ratings', status: 'pendiente' }]) },
        { id: uid(), name: 'S6 · IA & lanzamiento', status: 'pendiente', estimatedDate: '2026-07-23', actualDate: null, modules: mods([{ name: 'Asistente IA', status: 'pendiente' }, { name: 'Notificaciones push', status: 'pendiente' }, { name: 'QA', status: 'pendiente' }, { name: 'Publicación App Store + Google Play', status: 'pendiente' }]) },
      ],
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
      totalModules: 0, deliveredModules: 0, partialModules: 0, pendingModules: 0,
      paidAmount: 0, totalAmount: 15000, progress: 0, lastDeployDate: '2026-06-07',
      tags: [TAG_NEW()],
      sprints: [
        { id: uid(), name: 'S1 · Discovery & documentación', status: 'pendiente', estimatedDate: '2026-06-26', actualDate: null, modules: mods([{ name: 'Auditoría', status: 'pendiente' }, { name: 'Backlog', status: 'pendiente' }, { name: 'Documentación funcional', status: 'pendiente' }]) },
        { id: uid(), name: 'S2 · Infraestructura base (Milestone 1)', status: 'pendiente', estimatedDate: '2026-07-11', actualDate: null, modules: mods([{ name: 'DB multi-tenant', status: 'pendiente' }, { name: 'RLS (Row Level Security)', status: 'pendiente' }, { name: 'Repositorio', status: 'pendiente' }]) },
        { id: uid(), name: 'S3 · CRM & scoring (Milestone 2 · USD 4.500)', status: 'pendiente', estimatedDate: '2026-08-10', actualDate: null, modules: mods([{ name: 'CRM', status: 'pendiente' }, { name: 'Enriquecimiento', status: 'pendiente' }, { name: 'Scoring', status: 'pendiente' }, { name: 'Twilio/WhatsApp', status: 'pendiente' }]) },
        { id: uid(), name: 'S4 · Marketplace & handover (Milestone 3 · USD 4.500)', status: 'pendiente', estimatedDate: '2026-09-09', actualDate: null, modules: mods([{ name: 'Marketplace pasivo', status: 'pendiente' }, { name: 'Panel admin', status: 'pendiente' }, { name: 'Documentación', status: 'pendiente' }, { name: 'Handover', status: 'pendiente' }]) },
      ],
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
      totalModules: 0, deliveredModules: 0, partialModules: 0, pendingModules: 0,
      paidAmount: 0, totalAmount: 8000, progress: 0, lastDeployDate: '2026-06-09',
      tags: [TAG_NEW()],
      sprints: [
        { id: uid(), name: 'S1 · Onboarding & arquitectura', status: 'pendiente', estimatedDate: '2026-06-18', actualDate: null, modules: mods([{ name: 'Relevamiento', status: 'pendiente' }, { name: 'Arquitectura', status: 'pendiente' }]) },
        { id: uid(), name: 'S2 · Landing · Auth · Panel admin', status: 'pendiente', estimatedDate: '2026-06-25', actualDate: null, modules: mods([{ name: 'Landing premium', status: 'pendiente' }, { name: 'Auth', status: 'pendiente' }, { name: 'Panel administrador', status: 'pendiente' }, { name: 'Gestión de órdenes', status: 'pendiente' }, { name: 'Revisión formal', status: 'pendiente' }]) },
        { id: uid(), name: 'S3 · Apps · GPS · Zelle', status: 'pendiente', estimatedDate: '2026-07-06', actualDate: null, modules: mods([{ name: 'App iOS/Android', status: 'pendiente' }, { name: 'Panel cliente', status: 'pendiente' }, { name: 'Panel técnico', status: 'pendiente' }, { name: 'GPS en tiempo real', status: 'pendiente' }, { name: 'Integración Zelle', status: 'pendiente' }]) },
        { id: uid(), name: 'S4 · IA · Reportes · Lanzamiento', status: 'pendiente', estimatedDate: '2026-07-13', actualDate: null, modules: mods([{ name: 'Chat IA', status: 'pendiente' }, { name: 'Dashboard operativo', status: 'pendiente' }, { name: 'Reportes', status: 'pendiente' }, { name: 'QA', status: 'pendiente' }, { name: 'Publicación', status: 'pendiente' }]) },
      ],
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
      totalModules: 0, deliveredModules: 0, partialModules: 0, pendingModules: 0,
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: '2026-06-10',
      tags: [TAG_NEW()],
      sprints: [
        { id: uid(), name: 'S1 · Marca & setup Shopify', status: 'pendiente', estimatedDate: '2026-06-18', actualDate: null, modules: mods([{ name: 'Definición de marca', status: 'pendiente' }, { name: 'Setup Shopify', status: 'pendiente' }, { name: 'Arquitectura', status: 'pendiente' }]) },
        { id: uid(), name: 'S2 · Frontend & GSAP', status: 'pendiente', estimatedDate: '2026-06-25', actualDate: null, modules: mods([{ name: 'Home', status: 'pendiente' }, { name: 'About inline', status: 'pendiente' }, { name: 'Galería scroll horizontal', status: 'pendiente' }, { name: 'Animaciones GSAP', status: 'pendiente' }]) },
        { id: uid(), name: 'S3 · Tienda headless', status: 'pendiente', estimatedDate: '2026-07-02', actualDate: null, modules: mods([{ name: 'Integración Shopify API', status: 'pendiente' }, { name: 'Grid infinito + filtros', status: 'pendiente' }, { name: 'Página de producto', status: 'pendiente' }]) },
        { id: uid(), name: 'S4 · Contacto · QA · Deploy', status: 'pendiente', estimatedDate: '2026-07-09', actualDate: null, modules: mods([{ name: 'Contacto', status: 'pendiente' }, { name: 'Chat widget', status: 'pendiente' }, { name: 'QA', status: 'pendiente' }, { name: 'Deploy & entrega', status: 'pendiente' }]) },
      ],
      pendingAgency: [{ id: uid(), title: 'Definir grilla de galería y transiciones', priority: 'media', description: 'Choreography GSAP de la home y galería.' }],
      pendingClient: [{ id: uid(), title: 'Nombre oficial de marca, dominio y cuenta Shopify', priority: 'alta', description: 'Datos base para arrancar el setup.' }, { id: uid(), title: 'Fotos de productos y logo/firma', priority: 'alta', description: 'Assets de las ~50 joyas + branding.' }, { id: uid(), title: 'Plataforma de chat y moneda principal', priority: 'media', description: 'Confirmar Tidio/WhatsApp y moneda de venta.' }],
      risks: [{ id: uid(), description: 'Definiciones de marca pendientes pueden frenar el arranque', severity: 'media' }],
      chats: [],
    },
    {
      id: 'p11', clientId: 'c4', name: 'HiddenWare App', status: 'active',
      productionUrl: '', devUrl: '', testingUrl: '', whatsappUrl: '',
      githubRepo: '', stack: 'Por definir',
      kickoff: 'Proyecto planificado para el próximo mes — aún no iniciado. Tenerlo en cuenta para el arranque del siguiente sprint de cartera.',
      totalModules: 0, deliveredModules: 0, partialModules: 0, pendingModules: 0,
      paidAmount: 0, totalAmount: 0, progress: 0, lastDeployDate: null,
      tags: [TAG_NEXT()],
      sprints: [],
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

/* ============================================================================
   5 · PERSISTED STATE HOOK
============================================================================ */
const STORE_KEY = 'insights_os_v1'
/* merge seeds into persisted state without wiping user edits */
function migrate(state) {
  if (!state.team || !state.team.length) state.team = seedTeam()
  // add any new team members that aren't present yet (by id)
  const uIds = new Set(state.team.map((u) => u.id))
  seedTeam().forEach((u) => { if (!uIds.has(u.id)) state.team.push(u) })
  if (!state.clients) state.clients = seedClients()
  if (!state.projects) state.projects = seedProjects()
  if (!state.calls) state.calls = seedCalls()
  // add new clients/projects that aren't present yet (by id)
  const cIds = new Set(state.clients.map((c) => c.id))
  seedClients().forEach((c) => { if (!cIds.has(c.id)) state.clients.push(c) })
  const pIds = new Set(state.projects.map((p) => p.id))
  seedProjects().forEach((p) => { if (!pIds.has(p.id)) state.projects.push(p) })
  // ensure assignments + tags exist, normalize sprint statuses, add description/comments
  state.projects = state.projects.map((p) => ({
    ...p,
    assignments: p.assignments || DEMO_ASSIGN[p.id] || { pm: null, dev: null },
    tags: p.tags || [],
    sprints: (p.sprints || []).map((s) => ({
      ...s,
      status: normSprint(s.status),
      description: s.description || '',
      comments: s.comments || [],
    })),
  }))
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
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)) } catch (e) { /* quota */ }
    if (!cloudEnabled || !loaded.current) return
    const js = JSON.stringify(data)
    if (js === lastSaved.current) return
    setSync('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from('app_state').upsert({ id: CLOUD_ROW, data, updated_at: new Date().toISOString() })
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
    blue: { color: 'var(--blue)', bg: 'var(--blue-soft)', bd: 'transparent' },
  }
  const s = map[tone] || map.neutral
  return <span className="tag" style={{ color: s.color, background: s.bg, borderColor: s.bd }}>{children}</span>
}
const statusTone = (s) => (s === 'completado' || s === 'delivered' ? 'green' : s === 'en progreso' || s === 'active' ? 'accent' : 'neutral')
const prioTone = (p) => (p === 'alta' ? 'red' : p === 'media' ? 'yellow' : 'neutral')
const sevTone = (s) => (s === 'alta' ? 'red' : s === 'media' ? 'yellow' : 'neutral')

/* project status (activo / pausado / entregado) */
const PROJECT_STATUS = [
  { key: 'active', label: 'Activo', tone: 'accent', dot: 'var(--accent)' },
  { key: 'pending', label: 'Pendiente', tone: 'blue', dot: 'var(--blue)' },
  { key: 'paused', label: 'Pausado', tone: 'yellow', dot: 'var(--yellow)' },
  { key: 'delivered', label: 'Entregado', tone: 'green', dot: 'var(--green)' },
]
const projStatusMeta = (s) => PROJECT_STATUS.find((x) => x.key === s) || PROJECT_STATUS[0]

/* sprint statuses: pendiente (default) · en proceso · pausado · terminado */
const SPRINT_STATUS = [
  { key: 'pendiente', label: 'Pendiente', tone: 'neutral', dot: 'var(--text-faint)' },
  { key: 'en proceso', label: 'En proceso', tone: 'accent', dot: 'var(--accent)' },
  { key: 'pausado', label: 'Pausado', tone: 'yellow', dot: 'var(--yellow)' },
  { key: 'terminado', label: 'Terminado', tone: 'green', dot: 'var(--green)' },
]
/* normalize legacy values (completado/en progreso) to the new vocabulary */
const normSprint = (s) => (s === 'completado' ? 'terminado' : s === 'en progreso' ? 'en proceso' : (s || 'pendiente'))
const sprintMeta = (s) => SPRINT_STATUS.find((x) => x.key === normSprint(s)) || SPRINT_STATUS[0]

/* progress derived live from sprints (keeps overview/detail in sync) */
function calcProgress(project) {
  const sprints = project.sprints || []
  if (!sprints.length) return project.progress ?? 0
  const done = sprints.filter((s) => normSprint(s.status) === 'terminado').length
  const inProg = sprints.filter((s) => normSprint(s.status) === 'en proceso').length * 0.5
  return Math.round(((done + inProg) / sprints.length) * 100)
}
/* module counts derived live from sprint tasks */
function moduleCounts(project) {
  const mods = (project.sprints || []).flatMap((s) => s.modules || [])
  return {
    total: mods.length,
    delivered: mods.filter((m) => m.status === 'completado').length,
    partial: mods.filter((m) => m.status === 'en progreso').length,
    pending: mods.filter((m) => m.status === 'pendiente').length,
  }
}
const MODULE_STATES = ['pendiente', 'en progreso', 'completado']
const nextModuleStatus = (s) => MODULE_STATES[(MODULE_STATES.indexOf(s) + 1) % MODULE_STATES.length]

/* clickable status badge with a dropdown (activo/pausado/entregado) */
function StatusMenu({ status, onChange }) {
  const [open, setOpen] = useState(false)
  const meta = projStatusMeta(status)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} title="Cambiar estado">
        <span className="tag" style={{ color: `var(--${meta.tone === 'accent' ? 'accent' : meta.tone})`, background: `var(--${meta.tone === 'accent' ? 'accent-soft' : meta.tone + '-soft'})`, borderColor: meta.tone === 'accent' ? 'var(--accent-line)' : 'transparent', cursor: 'pointer' }}>
          {meta.label}<I.chevD width={11} height={11} style={{ marginLeft: 1 }} />
        </span>
      </button>
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div className="surface" style={{ position: 'absolute', top: '120%', right: 0, zIndex: 70, padding: 5, minWidth: 138, boxShadow: 'var(--shadow)' }}>
            {PROJECT_STATUS.map((o) => (
              <button key={o.key} className="row-hover" onClick={(e) => { e.stopPropagation(); onChange(o.key); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: o.key === status ? 'var(--accent)' : 'var(--text)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: o.dot, flexShrink: 0 }} />{o.label}
                {o.key === status && <I.check width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>
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
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
      <a href={testing || undefined} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); if (!testing) e.preventDefault() }}
        className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', opacity: testing ? 1 : 0.45 }}><I.ext width={13} height={13} /> Testing</a>
      <a href={wa || undefined} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); if (!wa) e.preventDefault() }}
        className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', color: wa ? 'var(--green)' : undefined, opacity: wa ? 1 : 0.45 }}><I.whatsapp width={14} height={14} /> WhatsApp</a>
      <button className="btn btn-sm btn-ghost" onClick={openEdit} title="Editar links" style={{ padding: 7 }}><I.pencil width={14} height={14} /></button>
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar links del proyecto" sub={project.name} width={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Testing / Deploy URL (Render, Vercel…)"><input className="input" value={t} onChange={(e) => setT(e.target.value)} placeholder="https://mi-app.onrender.com" /></Field>
          <Field label="Grupo de WhatsApp"><input className="input" value={w} onChange={(e) => setW(e.target.value)} placeholder="https://chat.whatsapp.com/..." /></Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => { onSave({ testingUrl: t, whatsappUrl: w }); setEditing(false) }}><I.check width={15} height={15} /> Guardar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* inline "add task" input used inside expanded sprints */
function AddTaskInput({ onAdd }) {
  const [v, setV] = useState('')
  const submit = () => { const t = v.trim(); if (!t) return; onAdd(t); setV('') }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input className="input" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} placeholder="Agregar tarea…" style={{ padding: '7px 10px', fontSize: 13 }} />
      <button className="btn btn-sm" onClick={submit}><I.plus width={13} height={13} /> Agregar</button>
    </div>
  )
}

/* full project editor (meta · URLs · financials · sprints) */
function EditProjectModal({ open, project, onClose, onSave }) {
  const [d, setD] = useState(null)
  useEffect(() => { if (open && project) setD(JSON.parse(JSON.stringify(project))) }, [open, project && project.id])
  const set = (k, v) => setD((s) => ({ ...s, [k]: v }))
  const setSprint = (sid, k, v) => setD((s) => ({ ...s, sprints: s.sprints.map((sp) => sp.id === sid ? { ...sp, [k]: v } : sp) }))
  const delSprint = (sid) => setD((s) => ({ ...s, sprints: s.sprints.filter((sp) => sp.id !== sid) }))
  const addSprint = () => setD((s) => ({ ...s, sprints: [...s.sprints, { id: uid(), name: 'Nuevo sprint', status: 'pendiente', estimatedDate: NOW.toISOString(), actualDate: null, modules: [] }] }))
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
            <Field label="GitHub repo (org/repo)"><input className="input mono" value={d.githubRepo || ''} onChange={(e) => set('githubRepo', e.target.value)} /></Field>
            <Field label="URL Producción"><input className="input" value={d.productionUrl || ''} onChange={(e) => set('productionUrl', e.target.value)} /></Field>
            <Field label="URL Dev env"><input className="input" value={d.devUrl || ''} onChange={(e) => set('devUrl', e.target.value)} /></Field>
            <Field label="Testing / Deploy URL"><input className="input" value={d.testingUrl || ''} onChange={(e) => set('testingUrl', e.target.value)} /></Field>
            <Field label="Grupo de WhatsApp"><input className="input" value={d.whatsappUrl || ''} onChange={(e) => set('whatsappUrl', e.target.value)} /></Field>
            <Field label="Contrato total (USD)"><input className="input mono" type="number" value={d.totalAmount} onChange={(e) => set('totalAmount', Number(e.target.value))} /></Field>
            <Field label="Cobrado / pagado (USD)"><input className="input mono" type="number" value={d.paidAmount} onChange={(e) => set('paidAmount', Number(e.target.value))} /></Field>
          </div>
          <Field label="Kick-off"><textarea className="input" rows={3} value={d.kickoff || ''} onChange={(e) => set('kickoff', e.target.value)} /></Field>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label">Sprints</span>
              <button className="btn btn-sm" onClick={addSprint}><I.plus width={13} height={13} /> Agregar sprint</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.sprints.map((sp) => (
                <div key={sp.id} className="surface" style={{ padding: 9, background: 'var(--bg-elevated)', display: 'grid', gridTemplateColumns: '1fr 130px 140px 34px', gap: 8, alignItems: 'center' }}>
                  <input className="input" value={sp.name} onChange={(e) => setSprint(sp.id, 'name', e.target.value)} style={{ padding: '7px 9px', fontSize: 13 }} />
                  <select className="input" value={normSprint(sp.status)} onChange={(e) => setSprint(sp.id, 'status', e.target.value)} style={{ padding: '7px 9px', fontSize: 13 }}>
                    {SPRINT_STATUS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <input className="input mono" type="date" value={(sp.estimatedDate || '').slice(0, 10)} onChange={(e) => setSprint(sp.id, 'estimatedDate', e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ padding: '7px 9px', fontSize: 12 }} />
                  <button className="btn btn-sm btn-ghost" onClick={() => delSprint(sp.id)} title="Eliminar sprint" style={{ color: 'var(--red)', padding: 7 }}><I.trash width={14} height={14} /></button>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>Las tareas de cada sprint se editan desde la tabla de Sprints (clic en un sprint para expandir y agregar/renombrar/cambiar estado).</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => { onSave(d); onClose() }}><I.check width={15} height={15} /> Guardar cambios</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
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
        <I.plus width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} />
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

/* dropdown to assign a user to a slot (pm/dev) — shows ALL users, role label editable */
function AssignMenu({ slot, assignment, team, onChange, onClose }) {
  const [q, setQ] = useState('')
  const dft = slot === 'pm' ? 'Project Manager' : 'Developer'
  const [label, setLabel] = useState(assignment?.roleLabel || dft)
  const filtered = team.filter((u) => u.name.toLowerCase().includes(q.toLowerCase().trim()))
  const pick = (userId) => { onChange({ userId, roleLabel: (label || dft).trim() }); onClose() }
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '120%', left: 0, zIndex: 70, width: 248, padding: 10, boxShadow: 'var(--shadow)' }}>
        <div className="label" style={{ marginBottom: 8 }}>Asignar {slot === 'pm' ? 'PM' : 'Dev'}</div>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rol (ej: Lead Dev, Tech Lead…)" style={{ padding: '7px 9px', fontSize: 12.5, marginBottom: 7 }} />
        <div style={{ position: 'relative', marginBottom: 7 }}>
          <I.search width={13} height={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-faint)' }} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona…" style={{ padding: '7px 9px 7px 28px', fontSize: 12.5 }} autoFocus />
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map((u) => (
            <button key={u.id} className="row-hover" onClick={() => pick(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 7px', borderRadius: 8, width: '100%', textAlign: 'left' }}>
              <Avatar user={u} size={24} ring="var(--card)" />
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{u.name}</span>
              {assignment?.userId === u.id && <I.check width={14} height={14} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
          {filtered.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', padding: '6px 7px' }}>Sin resultados</div>}
        </div>
        {assignment && (
          <button className="btn btn-sm btn-ghost" onClick={() => { onChange(null); onClose() }} style={{ marginTop: 8, color: 'var(--red)', width: '100%', justifyContent: 'center' }}>
            <I.x width={13} height={13} /> Quitar asignación
          </button>
        )}
      </div>
    </>
  )
}

/* overlapping PM + Dev avatars (GitHub-style). Same user in both slots → single avatar + PM·DEV badge */
function TeamAvatars({ assignments, team, onChange, size = 28, ring = 'var(--card)' }) {
  const [menu, setMenu] = useState(null)      // 'pm' | 'dev' | null
  const [dual, setDual] = useState(false)     // mini chooser when same user fills both slots
  const a = assignments || { pm: null, dev: null }
  const userById = (id) => team.find((u) => u.id === id)
  const pmU = a.pm ? userById(a.pm.userId) : null
  const devU = a.dev ? userById(a.dev.userId) : null
  const same = a.pm && a.dev && a.pm.userId === a.dev.userId
  const setSlot = (slot, val) => onChange({ ...a, [slot]: val })
  const dbadge = (
    <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', fontSize: 7.5, fontWeight: 800, letterSpacing: '.02em', padding: '1px 4px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: '1.5px solid ' + ring, whiteSpace: 'nowrap', lineHeight: 1.3 }}>PM·DEV</span>
  )
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {same ? (
          <span style={{ position: 'relative' }}>
            <Avatar user={pmU} size={size} ring={ring} title={`${a.pm.roleLabel} + ${a.dev.roleLabel}: ${pmU?.name}`} onClick={() => setDual((v) => !v)} badge={dbadge} />
          </span>
        ) : (
          <>
            <span style={{ position: 'relative', zIndex: 2 }}>
              <Avatar user={pmU} size={size} ring={ring} empty={!pmU} title={pmU ? `${a.pm.roleLabel}: ${pmU.name}` : 'Asignar PM'} onClick={() => { setMenu(menu === 'pm' ? null : 'pm') }} />
            </span>
            <span style={{ position: 'relative', zIndex: 1, marginLeft: -size * 0.32 }}>
              <Avatar user={devU} size={size} ring={ring} empty={!devU} title={devU ? `${a.dev.roleLabel}: ${devU.name}` : 'Asignar Dev'} onClick={() => { setMenu(menu === 'dev' ? null : 'dev') }} />
            </span>
          </>
        )}
      </div>

      {/* mini chooser for the same-user case */}
      {dual && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setDual(false) }} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '120%', left: 0, zIndex: 70, padding: 6, minWidth: 180, boxShadow: 'var(--shadow)' }}>
            {['pm', 'dev'].map((slot) => (
              <button key={slot} className="row-hover" onClick={() => { setDual(false); setMenu(slot) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 30 }}>{slot.toUpperCase()}</span>
                <span style={{ color: 'var(--text-dim)' }}>{a[slot].roleLabel}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {menu && (
        <AssignMenu slot={menu} assignment={a[menu]} team={team} onChange={(val) => setSlot(menu, val)} onClose={() => setMenu(null)} />
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
              <I.x width={11} height={11} />
            </span>
          )}
        </span>
      ))}
      <button onClick={startNew} title="Agregar etiqueta" className="tag" style={{ cursor: 'pointer', color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderColor: 'var(--border)', padding: '3px 6px' }}>
        <I.plus width={11} height={11} />
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
              <button className="btn btn-sm btn-accent" onClick={save}><I.check width={13} height={13} /> Guardar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ============================================================================
   9c · SPRINTS — status dropdown · detail modal · table/kanban board
============================================================================ */
/* clickable sprint-status badge with dropdown (pendiente/en proceso/pausado/terminado) */
function SprintStatusBadge({ status, onChange, full }) {
  const [open, setOpen] = useState(false)
  const meta = sprintMeta(status)
  const tint = (tone) => ({ color: `var(--${tone === 'neutral' ? 'text-dim' : tone})`, bg: tone === 'neutral' ? 'var(--bg-elevated)' : `var(--${tone}-soft)`, bd: tone === 'accent' ? 'var(--accent-line)' : tone === 'neutral' ? 'var(--border)' : 'transparent' })
  const s = tint(meta.tone)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} title="Cambiar estado">
        <span className="tag" style={{ cursor: 'pointer', color: s.color, background: s.bg, borderColor: s.bd, minWidth: full ? 96 : 0, justifyContent: 'center' }}>
          {meta.label}<I.chevD width={11} height={11} style={{ marginLeft: 1 }} />
        </span>
      </button>
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div className="surface" style={{ position: 'absolute', top: '120%', left: 0, zIndex: 70, padding: 5, minWidth: 150, boxShadow: 'var(--shadow)' }}>
            {SPRINT_STATUS.map((o) => (
              <button key={o.key} className="row-hover" onClick={(e) => { e.stopPropagation(); onChange(o.key); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: normSprint(status) === o.key ? 'var(--accent)' : 'var(--text)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: o.dot, flexShrink: 0 }} />{o.label}
                {normSprint(status) === o.key && <I.check width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}

/* sprint detail card: descripción + comentarios + tareas */
function SprintDetailModal({ open, sprint, onClose, onPatch }) {
  const [comment, setComment] = useState('')
  if (!sprint) return <Modal open={open} onClose={onClose} title="Sprint" />
  const addComment = () => { const t = comment.trim(); if (!t) return; onPatch({ comments: [...(sprint.comments || []), { id: uid(), text: t, date: NOW.toISOString() }] }); setComment('') }
  const delComment = (id) => onPatch({ comments: (sprint.comments || []).filter((c) => c.id !== id) })
  const setMod = (mid, fields) => onPatch({ modules: sprint.modules.map((m) => m.id === mid ? { ...m, ...fields } : m) })
  const addMod = (name) => onPatch({ modules: [...sprint.modules, { id: uid(), name, status: 'pendiente' }] })
  const delMod = (mid) => onPatch({ modules: sprint.modules.filter((m) => m.id !== mid) })
  return (
    <Modal open={open} onClose={onClose} title={sprint.name} sub="Detalle del sprint" width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="label">Estado</span><SprintStatusBadge status={sprint.status} onChange={(v) => onPatch({ status: v })} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="label">Fecha estimada</span>
            <input type="date" className="input mono" value={(sprint.estimatedDate || '').slice(0, 10)} onChange={(e) => onPatch({ estimatedDate: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ width: 'auto', padding: '6px 9px', fontSize: 12.5 }} />
          </div>
        </div>
        <Field label="Nombre del sprint"><input className="input" value={sprint.name} onChange={(e) => onPatch({ name: e.target.value })} /></Field>
        <Field label="Explicación detallada"><textarea className="input" rows={4} value={sprint.description || ''} onChange={(e) => onPatch({ description: e.target.value })} placeholder="Describí el alcance, objetivos y notas del sprint…" /></Field>

        <div>
          <div className="label" style={{ marginBottom: 8 }}>Tareas ({sprint.modules.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sprint.modules.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="input" value={m.name} onChange={(e) => setMod(m.id, { name: e.target.value })} style={{ flex: 1, padding: '6px 9px', fontSize: 13 }} />
                <button onClick={() => setMod(m.id, { status: nextModuleStatus(m.status) })} title="Cambiar estado" style={{ flexShrink: 0 }}>
                  <span className="tag" style={{ cursor: 'pointer', color: `var(--${statusTone(m.status) === 'green' ? 'green' : statusTone(m.status) === 'accent' ? 'accent' : 'text-dim'})`, background: statusTone(m.status) === 'green' ? 'var(--green-soft)' : statusTone(m.status) === 'accent' ? 'var(--accent-soft)' : 'var(--bg-elevated)', borderColor: statusTone(m.status) === 'accent' ? 'var(--accent-line)' : statusTone(m.status) === 'neutral' ? 'var(--border)' : 'transparent', minWidth: 96, justifyContent: 'center' }}>{m.status}</span>
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => delMod(m.id)} title="Eliminar tarea" style={{ padding: 6, color: 'var(--text-faint)', flexShrink: 0 }}><I.trash width={14} height={14} /></button>
              </div>
            ))}
            <AddTaskInput onAdd={addMod} />
          </div>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><I.comment width={14} height={14} /> Comentarios ({(sprint.comments || []).length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {(sprint.comments || []).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Sin comentarios todavía.</div>}
            {(sprint.comments || []).map((c) => (
              <div key={c.id} className="surface" style={{ padding: 11, background: 'var(--bg-elevated)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{fmtDate(c.date)}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => delComment(c.id)} style={{ padding: 4, color: 'var(--text-faint)' }}><I.x width={12} height={12} /></button>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }} placeholder="Dejá un comentario… (Enter envía)" style={{ resize: 'none' }} />
            <button className="btn btn-accent" onClick={addComment} style={{ alignSelf: 'stretch' }}><I.send width={15} height={15} /></button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* sprint board: table (drag to reorder) or kanban (drag between status columns) */
function SprintBoard({ project, patch, onOpenSprint }) {
  const [boardView, setBoardView] = useState('table')
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const sprints = project.sprints || []
  const setSprint = (sid, fields) => patch((p) => ({ ...p, sprints: p.sprints.map((s) => s.id === sid ? { ...s, ...fields } : s) }))
  const addSprint = () => patch((p) => ({ ...p, sprints: [...p.sprints, { id: uid(), name: 'Nuevo sprint', status: 'pendiente', estimatedDate: NOW.toISOString(), actualDate: null, modules: [], description: '', comments: [] }] }))

  const reorder = (fromId, toId) => {
    if (fromId === toId) return
    patch((p) => {
      const arr = [...p.sprints]
      const from = arr.findIndex((s) => s.id === fromId)
      const to = arr.findIndex((s) => s.id === toId)
      if (from < 0 || to < 0) return p
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      return { ...p, sprints: arr }
    })
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 19 }}>Sprints</h2>
        <div className="surface" style={{ display: 'flex', padding: 3, borderRadius: 10 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setBoardView('table')} title="Tabla" style={{ background: boardView === 'table' ? 'var(--card-hover)' : 'transparent', color: boardView === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I.table width={15} height={15} /></button>
          <button className="btn btn-sm btn-ghost" onClick={() => setBoardView('kanban')} title="Kanban" style={{ background: boardView === 'kanban' ? 'var(--card-hover)' : 'transparent', color: boardView === 'kanban' ? 'var(--accent)' : 'var(--text-dim)' }}><I.kanban width={15} height={15} /></button>
        </div>
      </div>

      {boardView === 'table' ? (
        <>
          <div className="surface" style={{ overflow: 'hidden' }}>
            <table>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['', '#', 'Nombre', 'Módulos', 'Estado', 'Estimada'].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {sprints.map((s, i) => (
                  <tr key={s.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setDragId(s.id) }}
                    onDragOver={(e) => { e.preventDefault(); setOverId(s.id) }}
                    onDragEnd={() => { setDragId(null); setOverId(null) }}
                    onDrop={(e) => { e.preventDefault(); reorder(e.dataTransfer.getData('text/plain') || dragId, s.id); setDragId(null); setOverId(null) }}
                    style={{ borderBottom: '1px solid var(--border)', background: overId === s.id && dragId !== s.id ? 'var(--card-hover)' : dragId === s.id ? 'var(--bg-elevated)' : 'transparent', opacity: dragId === s.id ? 0.5 : 1 }}>
                    <td style={{ padding: '12px 8px 12px 14px', width: 28, cursor: 'grab', color: 'var(--text-faint)' }} title="Arrastrá para reordenar"><I.grip width={16} height={16} /></td>
                    <td style={{ padding: '12px 14px' }} className="mono">{i + 1}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button className="click" onClick={() => onOpenSprint(s.id)} title="Ver detalle" style={{ fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text)' }}>
                        {s.name}{(s.comments || []).length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text-faint)' }}><I.comment width={11} height={11} />{s.comments.length}</span>}
                      </button>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-dim)' }} className="mono">{s.modules.length}</td>
                    <td style={{ padding: '12px 14px' }}><SprintStatusBadge status={s.status} onChange={(v) => setSprint(s.id, { status: v })} /></td>
                    <td style={{ padding: '8px 14px' }}>
                      <input type="date" className="input mono" value={(s.estimatedDate || '').slice(0, 10)} onChange={(e) => setSprint(s.id, { estimatedDate: e.target.value ? new Date(e.target.value).toISOString() : null })} onClick={(e) => e.stopPropagation()} style={{ width: 'auto', padding: '5px 8px', fontSize: 12, background: 'transparent', border: '1px solid transparent' }} onFocus={(e) => (e.target.style.borderColor = 'var(--border)')} onBlur={(e) => (e.target.style.borderColor = 'transparent')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-sm" onClick={addSprint} style={{ marginTop: 12 }}><I.plus width={13} height={13} /> Agregar sprint</button>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'start' }}>
          {SPRINT_STATUS.map((col) => {
            const colSprints = sprints.filter((s) => normSprint(s.status) === col.key)
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverId(col.key) }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; if (id) setSprint(id, { status: col.key }); setDragId(null); setOverId(null) }}
                className="surface" style={{ padding: 10, background: overId === col.key ? 'var(--card-hover)' : 'var(--bg-elevated)', minHeight: 120, borderColor: overId === col.key ? 'var(--accent-line)' : 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '0 2px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: col.dot }} />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.02em' }}>{col.label}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>{colSprints.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colSprints.map((s) => (
                    <div key={s.id} draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setDragId(s.id) }}
                      onDragEnd={() => { setDragId(null); setOverId(null) }}
                      onClick={() => onOpenSprint(s.id)}
                      className="surface click" style={{ padding: 11, background: 'var(--card)', cursor: 'grab', opacity: dragId === s.id ? 0.5 : 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{s.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)' }} className="mono">
                        <span>{s.modules.length} tareas</span>
                        <span>{fmtDate(s.estimatedDate)}</span>
                      </div>
                      {(s.comments || []).length > 0 && <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-faint)' }}><I.comment width={11} height={11} />{s.comments.length}</div>}
                    </div>
                  ))}
                  {colSprints.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '6px 2px' }}>—</div>}
                </div>
              </div>
            )
          })}
          <div style={{ gridColumn: '1 / -1' }}><button className="btn btn-sm" onClick={addSprint}><I.plus width={13} height={13} /> Agregar sprint</button></div>
        </div>
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
   12 · PROJECTS LIST
============================================================================ */
function Projects({ onOpenProject }) {
  const { data, setData } = useApp()
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const [tab, setTab] = useState(qp.get('tab') || 'active')
  const [view, setView] = useState('cards')
  const [clientFilter, setClientFilter] = useState(qp.get('client') || 'all')
  const [pmFilter, setPmFilter] = useState(qp.get('pm') || 'all')
  const [devFilter, setDevFilter] = useState(qp.get('dev') || 'all')
  const [tagFilter, setTagFilter] = useState(qp.get('tag') || 'all')
  const clientOf = (id) => data.clients.find((c) => c.id === id)
  const userOf = (id) => data.team.find((u) => u.id === id)
  const updateProject = (id, fields) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...fields } : p)) }))

  // keep filters URL-friendly
  useEffect(() => {
    const p = new URLSearchParams()
    if (tab !== 'active') p.set('tab', tab)
    if (clientFilter !== 'all') p.set('client', clientFilter)
    if (pmFilter !== 'all') p.set('pm', pmFilter)
    if (devFilter !== 'all') p.set('dev', devFilter)
    if (tagFilter !== 'all') p.set('tag', tagFilter)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [tab, clientFilter, pmFilter, devFilter, tagFilter])

  const allTags = [...new Set(data.projects.flatMap((p) => (p.tags || []).map((t) => t.text)))]
  const filtersActive = clientFilter !== 'all' || pmFilter !== 'all' || devFilter !== 'all' || tagFilter !== 'all'
  const clearFilters = () => { setClientFilter('all'); setPmFilter('all'); setDevFilter('all'); setTagFilter('all') }
  const matchesFilters = (p) =>
    (clientFilter === 'all' || p.clientId === clientFilter) &&
    (pmFilter === 'all' || p.assignments?.pm?.userId === pmFilter) &&
    (devFilter === 'all' || p.assignments?.dev?.userId === devFilter) &&
    (tagFilter === 'all' || (p.tags || []).some((t) => t.text === tagFilter))
  const countFor = (status) => data.projects.filter((p) => p.status === status && matchesFilters(p)).length
  const list = data.projects.filter((p) => p.status === tab && matchesFilters(p))

  return (
    <div style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Cartera</div>
          <h1 style={{ fontSize: 32 }}>Proyectos</h1>
        </div>
        <div className="surface" style={{ display: 'flex', padding: 3, borderRadius: 10 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setView('cards')} style={{ background: view === 'cards' ? 'var(--card-hover)' : 'transparent', color: view === 'cards' ? 'var(--accent)' : 'var(--text-dim)' }}><I.cards width={15} height={15} /></button>
          <button className="btn btn-sm btn-ghost" onClick={() => setView('table')} style={{ background: view === 'table' ? 'var(--card-hover)' : 'transparent', color: view === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I.table width={15} height={15} /></button>
        </div>
      </div>

      {/* filtros */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="all">Todos los clientes</option>
          {data.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}>
          <option value="all">PM: todos</option>
          {data.team.map((u) => <option key={u.id} value={u.id}>PM: {u.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={devFilter} onChange={(e) => setDevFilter(e.target.value)}>
          <option value="all">Dev: todos</option>
          {data.team.map((u) => <option key={u.id} value={u.id}>Dev: {u.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="all">Etiqueta: todas</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {filtersActive && <button className="btn btn-sm btn-ghost" onClick={clearFilters} style={{ color: 'var(--text-dim)' }}><I.x width={13} height={13} /> Limpiar</button>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {[['active', 'Activos'], ['pending', 'Pendiente'], ['paused', 'Pausados'], ['delivered', 'Entregados']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '10px 16px', fontWeight: 600, fontSize: 14, color: tab === k ? 'var(--text)' : 'var(--text-faint)', borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
            {l} <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>({countFor(k)})</span>
          </button>
        ))}
      </div>

      {list.length === 0 && <div className="surface" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Sin proyectos en esta vista.</div>}

      {view === 'cards' ? (
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
          {list.map((p) => {
            const cl = clientOf(p.clientId)
            const dd = daysAgo(p.lastDeployDate)
            const currentSprint = p.sprints.find((s) => normSprint(s.status) === 'en proceso')
            return (
              <motion.div key={p.id} variants={rise} whileHover={{ y: -3 }} onClick={() => onOpenProject(p.id)} className="surface surface-hover click" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{cl?.company}</div>
                  </div>
                  <StatusMenu status={p.status} onChange={(s) => updateProject(p.id, { status: s })} />
                </div>
                <div style={{ marginBottom: 14 }}><Progress value={calcProgress(p)} showLabel /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div className="surface" style={{ padding: '8px 11px', background: 'var(--bg-elevated)' }}>
                    <div className="label">Sprint actual</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSprint?.name || '—'}</div>
                  </div>
                  <div className="surface" style={{ padding: '8px 11px', background: 'var(--bg-elevated)' }}>
                    <div className="label">Días sin deploy</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: dd > 7 ? 'var(--red)' : 'var(--text)' }}>{dd == null ? '—' : `${dd}d`} {dd > 7 && '⚠'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <ProjectTags tags={p.tags} onChange={(tags) => updateProject(p.id, { tags })} />
                  <TeamAvatars assignments={p.assignments} team={data.team} onChange={(assignments) => updateProject(p.id, { assignments })} />
                </div>
                <CardLinks project={p} onSave={(f) => updateProject(p.id, f)} />
              </motion.div>
            )
          })}
        </motion.div>
      ) : (
        <div className="surface" style={{ overflow: 'hidden' }}>
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Proyecto', 'Cliente', 'Equipo', 'Estado', 'Avance', 'Sprint actual', 'Deploy', 'Cobrado'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const cl = clientOf(p.clientId)
                const dd = daysAgo(p.lastDeployDate)
                const cs = p.sprints.find((s) => normSprint(s.status) === 'en proceso')
                return (
                  <tr key={p.id} className="row-hover click" onClick={() => onOpenProject(p.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 16px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{cl?.company}</td>
                    <td style={{ padding: '13px 16px' }}><TeamAvatars assignments={p.assignments} team={data.team} onChange={(assignments) => updateProject(p.id, { assignments })} size={26} ring="var(--card)" /></td>
                    <td style={{ padding: '13px 16px' }}><StatusMenu status={p.status} onChange={(s) => updateProject(p.id, { status: s })} /></td>
                    <td style={{ padding: '13px 16px', minWidth: 160 }}><Progress value={calcProgress(p)} showLabel /></td>
                    <td style={{ padding: '13px 16px', color: 'var(--text-dim)', fontSize: 13 }}>{cs?.name || '—'}</td>
                    <td style={{ padding: '13px 16px' }} className="mono"><span style={{ color: dd > 7 ? 'var(--red)' : 'var(--text-dim)' }}>{dd == null ? '—' : `${dd}d`}</span></td>
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
  const [openSprintId, setOpenSprintId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  if (!project) return null
  const patch = (fn) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === projectId ? fn(p) : p)) }))
  const saveProject = (draft) => patch((p) => ({ ...draft, chats: p.chats }))
  const patchSprint = (sid, fields) => patch((p) => ({ ...p, sprints: p.sprints.map((s) => s.id === sid ? { ...s, ...fields } : s) }))
  const openSprint = project.sprints.find((s) => s.id === openSprintId)

  const sprintProgress = calcProgress(project)
  const counts = moduleCounts(project)

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
          <StatusMenu status={project.status} onChange={(s) => patch((p) => ({ ...p, status: s }))} />
          <button className="btn btn-sm" onClick={() => setEditOpen(true)} style={{ marginLeft: 'auto' }}><I.pencil width={14} height={14} /> Editar proyecto</button>
        </div>
        <div style={{ color: 'var(--text-dim)', marginBottom: 14, fontSize: 14 }}>{client?.company} · {client?.name} · {project.stack}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <TeamAvatars assignments={project.assignments} team={data.team} onChange={(assignments) => patch((p) => ({ ...p, assignments }))} size={32} ring="var(--bg)" />
          <ProjectTags tags={project.tags} onChange={(tags) => patch((p) => ({ ...p, tags }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
          <a href={project.testingUrl || project.productionUrl || undefined} target="_blank" rel="noreferrer" className="btn btn-sm btn-accent" onClick={(e) => { if (!(project.testingUrl || project.productionUrl)) e.preventDefault() }}><I.ext width={14} height={14} /> Testing</a>
          <a href={project.whatsappUrl || undefined} target="_blank" rel="noreferrer" className="btn btn-sm" onClick={(e) => { if (!project.whatsappUrl) e.preventDefault() }} style={{ color: project.whatsappUrl ? 'var(--green)' : undefined, opacity: project.whatsappUrl ? 1 : 0.55 }}><I.whatsapp width={15} height={15} /> WhatsApp</a>
          <a href={project.productionUrl || undefined} target="_blank" rel="noreferrer" className="btn btn-sm"><I.rocket width={14} height={14} /> Producción</a>
          <a href={project.devUrl || undefined} target="_blank" rel="noreferrer" className="btn btn-sm"><I.ext width={14} height={14} /> Dev env</a>
          <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noreferrer" className="btn btn-sm"><I.github width={14} height={14} /> GitHub repo</a>
          <div className="btn btn-sm" style={{ cursor: 'default', borderColor: 'var(--border)' }}><CommitChip repo={project.githubRepo} compact /></div>
        </div>

        {/* KPI GRID */}
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 30 }}>
          <KpiCard label="Módulos scope" value={counts.total} sub="ver desglose" onClick={() => setKpiModal('scope')} />
          <KpiCard label="Entregados" value={counts.delivered} tone="var(--green)" sub="ver desglose" onClick={() => setKpiModal('delivered')} />
          <KpiCard label="Parciales" value={counts.partial} tone="var(--accent)" sub="ver desglose" onClick={() => setKpiModal('partial')} />
          <KpiCard label="Pendientes" value={counts.pending} tone="var(--text-dim)" sub="ver desglose" onClick={() => setKpiModal('pending')} />
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
                        <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: 999, background: normSprint(s.status) === 'terminado' ? 'var(--green)' : normSprint(s.status) === 'en proceso' ? 'var(--accent)' : normSprint(s.status) === 'pausado' ? 'var(--yellow)' : 'var(--bg-elevated)', border: '2px solid var(--border-strong)' }} />
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

        {/* SPRINTS — tabla (drag para reordenar) o kanban */}
        <SprintBoard project={project} patch={patch} onOpenSprint={(id) => setOpenSprintId(id)} />

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
                <span style={{ fontSize: 14 }}>{s.name}</span><Badge tone={sprintMeta(s.status).tone}>{sprintMeta(s.status).label}</Badge>
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

      <EditProjectModal open={editOpen} project={project} onClose={() => setEditOpen(false)} onSave={saveProject} />
      <SprintDetailModal open={!!openSprint} sprint={openSprint} onClose={() => setOpenSprintId(null)} onPatch={(fields) => patchSprint(openSprintId, fields)} />
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
AVANCE: ${calcProgress(project)}% · ${moduleCounts(project).delivered}/${moduleCounts(project).total} módulos entregados

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
   17 · SIDEBAR + USER PROFILE
============================================================================ */
/* current-user profile chip (bottom of sidebar) + editor: name · email · foto */
function UserProfile({ collapsed, session, myId, setMyId, onLogout }) {
  const { data, setData } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const team = data.team || []
  const me = team.find((u) => u.id === myId)
  const updateMember = (id, fields) => setData((d) => ({ ...d, team: d.team.map((u) => (u.id === id ? { ...u, ...fields } : u)) }))
  const onPick = async (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f || !me) return
    setBusy(true)
    try { const url = await fileToAvatarDataURL(f); updateMember(me.id, { photo: url }) } catch (err) { /* ignore */ }
    setBusy(false)
    e.target.value = ''
  }
  const email = session?.user?.email || ''

  return (
    <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(true)} className="row-hover" title="Mi perfil"
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 8, borderRadius: 10, textAlign: 'left' }}>
        {me ? <Avatar user={me} size={collapsed ? 30 : 34} ring="var(--bg-elevated)" />
          : <div style={{ width: collapsed ? 30 : 34, height: collapsed ? 30 : 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg)', border: '2px dashed var(--border-strong)', color: 'var(--text-faint)' }}><I.users width={15} height={15} /></div>}
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me ? me.name : 'Configurar perfil'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email || (cloudEnabled ? '' : 'modo local')}</div>
          </div>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Mi perfil" sub={email || undefined} width={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {me ? <Avatar user={me} size={72} ring="var(--card)" /> : <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--bg-elevated)', border: '2px dashed var(--border-strong)', color: 'var(--text-faint)' }}><I.users width={24} height={24} /></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
              <button className="btn btn-sm" disabled={!me || busy} onClick={() => fileRef.current && fileRef.current.click()}><I.pencil width={13} height={13} /> {busy ? 'Procesando…' : 'Cambiar foto'}</button>
              {me && me.photo && <button className="btn btn-sm btn-ghost" onClick={() => updateMember(me.id, { photo: '' })} style={{ color: 'var(--text-dim)' }}><I.x width={13} height={13} /> Quitar foto</button>}
            </div>
          </div>

          <Field label="¿Quién sos? (te vincula a un miembro del equipo)">
            <select className="input" value={myId || ''} onChange={(e) => setMyId(e.target.value)}>
              <option value="">— Elegí tu nombre —</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          {me && <Field label="Nombre"><input className="input" value={me.name} onChange={(e) => updateMember(me.id, { name: e.target.value })} /></Field>}
          <Field label="Email">
            <input className="input mono" value={me ? (me.email || email) : email} placeholder="tu@email.com"
              onChange={(e) => me && updateMember(me.id, { email: e.target.value })} readOnly={!me} />
          </Field>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>Tu foto se muestra en las tarjetas de los proyectos donde estés asignado como PM o Dev.</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            {cloudEnabled && onLogout ? <button className="btn" onClick={onLogout} style={{ color: 'var(--red)' }}><I.ext width={14} height={14} /> Cerrar sesión</button> : <span />}
            <button className="btn btn-accent" onClick={() => setOpen(false)}><I.check width={15} height={15} /> Listo</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Sidebar({ route, setRoute, collapsed, setCollapsed, session, myId, setMyId, onLogout }) {
  const items = [
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
      <UserProfile collapsed={collapsed} session={session} myId={myId} setMyId={setMyId} onLogout={onLogout} />
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
    <span title={cloudEnabled ? 'Estado de sincronización con Supabase' : 'Sin Supabase configurado — guardando solo en este navegador'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)', padding: '0 4px' }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: s.c, animation: sync === 'saving' || sync === 'loading' ? 'pulse 1s infinite' : 'none' }} />
      {s.t}
    </span>
  )
}
function Header({ theme, setTheme, onSettings, route, sync, onLogout }) {
  const crumb = { overview: 'Overview', projects: 'Projects', clients: 'Clients', calls: 'Calls', project: 'Projects / Detalle' }[route.view]
  return (
    <header style={{ height: 64, flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'var(--bg-elevated)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 13 }}>
        <span className="mono" style={{ color: 'var(--text-faint)' }}>insights-os</span><I.chevR width={14} height={14} style={{ color: 'var(--text-faint)' }} /><strong style={{ color: 'var(--text)' }}>{crumb}</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SyncBadge sync={sync} />
        <button className="btn btn-sm btn-ghost" onClick={onSettings} title="Ajustes & API keys">⚙ <span style={{ marginLeft: 2 }}>Ajustes</span></button>
        <button className="btn btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Cambiar tema" style={{ padding: 8 }}>
          {theme === 'dark' ? <I.sun width={16} height={16} /> : <I.moon width={16} height={16} />}
        </button>
        {cloudEnabled && onLogout && <button className="btn btn-sm btn-ghost" onClick={onLogout} title="Cerrar sesión" style={{ padding: 8 }}><I.ext width={16} height={16} /></button>}
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
/* login screen (Supabase Auth) */
function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
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
          <Field label="Contraseña"><input className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" /></Field>
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

/* the authenticated app */
function AppShell({ session, onLogout }) {
  const [data, setData, sync] = useAppData()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [route, setRoute] = useState({ view: 'projects' })
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState(false)
  const [myId, setMyId] = useState(() => localStorage.getItem('my_team_id') || '')

  useEffect(() => {
    const vars = THEMES[theme]
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // remember "who am I"; auto-link by matching email the first time
  useEffect(() => { if (myId) localStorage.setItem('my_team_id', myId) }, [myId])
  useEffect(() => {
    if (myId || !session?.user?.email) return
    const m = (data.team || []).find((u) => u.email && u.email.toLowerCase() === session.user.email.toLowerCase())
    if (m) setMyId(m.id)
  }, [session, data.team, myId])

  const openProject = (id) => setRoute({ view: 'project', projectId: id })

  return (
    <AppCtx.Provider value={{ data, setData }}>
      <div className="app-shell">
        <Sidebar route={route} setRoute={setRoute} collapsed={collapsed} setCollapsed={setCollapsed} session={session} myId={myId} setMyId={setMyId} onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Header theme={theme} setTheme={setTheme} onSettings={() => setSettings(true)} route={route} sync={sync} onLogout={onLogout} />
          <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <motion.div key={route.view + (route.projectId || '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
              style={{ height: '100%', overflow: route.view === 'project' ? 'hidden' : 'auto' }}>
              {route.view === 'projects' && <Projects onOpenProject={openProject} />}
              {route.view === 'clients' && <Clients />}
              {route.view === 'calls' && <Calls />}
              {route.view === 'project' && <ProjectDetail projectId={route.projectId} onBack={() => setRoute({ view: 'projects' })} />}
            </motion.div>
          </main>
        </div>
        <Settings open={settings} onClose={() => setSettings(false)} />
      </div>
    </AppCtx.Provider>
  )
}

export default function InsightsApp() {
  const [session, setSession] = useState(cloudEnabled ? undefined : null) // undefined=loading

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

  if (cloudEnabled && session === undefined) return <CenterScreen>Cargando…</CenterScreen>
  if (cloudEnabled && !session) return <Login />
  return <AppShell session={session} onLogout={cloudEnabled ? () => supabase.auth.signOut() : null} />
}
