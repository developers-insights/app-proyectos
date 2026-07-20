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
import { uid, I, AppCtx, useApp, Modal, Field, stagger, rise } from './ui.jsx'
import {
  taskText, taskDone, weekProgress, planProgress,
  toggleTaskDone, setWeekAllDone, sprintForWeek, hitoForWeek,
} from './plan/planModel.js'
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

/* --- responsive / mobile --- */
@media (max-width: 760px){
  .app-shell{ background-image:none }
  .view{ padding:18px 14px 48px !important }
  .tbl{ overflow-x:auto !important }
  .tbl > table{ min-width:600px }
  .hide-mobile{ display:none !important }
}
`

/* ============================================================================
   3 · UTILITIES
============================================================================ */
const NOW = new Date()   // fecha real de hoy (antes estaba fija en el demo y rompía los cálculos)
const daysAgo = (iso) => {
  if (!iso) return null
  return Math.max(0, Math.round((NOW - new Date(iso)) / 86400000))
}
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const money = (n) => '$' + (n ?? 0).toLocaleString('en-US')
const pctColor = (p) => (p < 40 ? 'var(--red)' : p <= 70 ? 'var(--accent)' : 'var(--green)')
/* color de la barra de avance en las cards: verde ≥70, ámbar ≥40, naranja >0, gris en 0 */
const cardPctColor = (p) => (p >= 70 ? 'var(--green)' : p >= 40 ? 'var(--yellow)' : p > 0 ? 'var(--accent)' : 'var(--text-faint)')
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
/* detecta viewport de celular (para menú hamburguesa, grid 1 por fila, etc.) */
function useIsMobile(bp = 760) {
  const q = `(max-width:${bp}px)`
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on)
    window.addEventListener('resize', on)
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); window.removeEventListener('resize', on) }
  }, [bp])
  return m
}

/* identidad visual del proyecto: iniciales (ignorando conectores) + color propio derivado del proyecto */
const PROJECT_HUES = ['#6366F1', '#14B8A6', '#22C55E', '#F59E0B', '#0EA5E9', '#A855F7', '#EC4899', '#F43F5E', '#FB923C', '#84CC16', '#3B82F6', '#8B5CF6']
const hexA = (hex, a) => { const h = (hex || '').replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})` }
const projectInitials = (name) => {
  const stop = ['de', 'la', 'el', 'y', 'del', 'the', '&', 'los', 'las']
  const words = (name || '').split(/[\s/·-]+/).filter((w) => w && !stop.includes(w.toLowerCase()))
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return ((words[0] || name || '?').replace(/[^a-z0-9]/gi, '').slice(0, 2) || '?').toUpperCase()
}
const projectHue = (p) => { const s = (p && (p.id || p.name)) || ''; let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PROJECT_HUES[h % PROJECT_HUES.length] }

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
- **Durante la semana:** puede haber screenshots, actualizaciones o dudas. Este tiempo lo usamos principalmente para desarrollar, no para meetings. Todo está documentado en el app de sprints.
- **Sprints en app:** le compartimos un enlace por WhatsApp donde ve todos los sprints en tiempo real. Todo en un mismo lugar, visual y simple.
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
[ ] Cliente entiende la cadencia de avances (viernes + sprints)
[ ] Se capturó la respuesta de motivación (para marketing)
[ ] Se compartió el enlace de WhatsApp
[ ] El cliente tiene el enlace de sprints (si aplica)

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
  // ensure assignments + tags exist, normalize sprint statuses, add description/comments, drop devUrl
  const stripRemoved = (as) => {
    const r = { pm: as?.pm || null, dev: as?.dev || null }
    if (r.pm && REMOVED_MEMBER_IDS.includes(r.pm.userId)) r.pm = null
    if (r.dev && REMOVED_MEMBER_IDS.includes(r.dev.userId)) r.dev = null
    return r
  }
  state.projects = state.projects.map((p) => {
    const { devUrl, ...rest } = p   // devUrl eliminado del modelo
    return {
      ...rest,
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
      sprints: (rest.sprints || []).map((s) => ({
        ...s,
        status: normSprint(s.status),
        description: s.description || '',
        comments: s.comments || [],
        assigneeIds: s.assigneeIds || [],
      })),
    }
  })
  // import de una sola vez: sprints de "Real Deal Exchange AI" (reemplaza los actuales)
  const RDE = [
    ['Investigación de extracción de datos', 1, 'en proceso', '2026-07-10'],
    ['Modelo de datos y backlog', 2, 'pendiente', '2026-07-17'],
    ['Validación de lógica y plan técnico', 3, 'pendiente', '2026-07-24'],
    ['Infraestructura base (Hito 1)', 4, 'pendiente', '2026-07-31'],
    ['Importación y enriquecimiento', 5, 'pendiente', '2026-08-07'],
    ['SMS outbound y WhatsApp inbound', 6, 'pendiente', '2026-08-14'],
    ['Revisión formal de Hito 1', 7, 'pendiente', '2026-08-21'],
    ['Agente de pre-ofertas (Hito 2)', 8, 'pendiente', '2026-08-28'],
    ['Review Panel, Marketplace y Meta', 9, 'pendiente', '2026-09-04'],
    ['Revisión formal de Hito 2', 10, 'pendiente', '2026-09-11'],
    ['Producción y white-label (Hito 3)', 11, 'pendiente', '2026-09-18'],
    ['Handover completo (Hito 3)', 12, 'pendiente', '2026-09-25'],
  ]
  const rde = state.projects.find((p) => p.id === 'p8' || p.name === 'Real Deal Exchange AI')
  if (rde && !rde._sprintsImportRDE1) {
    rde.sprints = RDE.map(([name, week, status, d]) => ({ id: 'rde-s' + week, name, status, week, estimatedDate: new Date(d + 'T12:00:00').toISOString(), actualDate: null, assigneeIds: ['u3'], description: '', comments: [] }))
    rde._sprintsImportRDE1 = true
  }
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

/* prioridad de proyecto: banderita roja (alta) / amarilla (normal) / celeste (baja) */
const PROJECT_PRIORITY = [
  { key: 'alta', label: 'Alta', color: 'var(--red)', rank: 3 },
  { key: 'normal', label: 'Normal', color: 'var(--yellow)', rank: 2 },
  { key: 'baja', label: 'Baja', color: 'var(--blue)', rank: 1 },
]
const projPrioMeta = (p) => PROJECT_PRIORITY.find((x) => x.key === p) || PROJECT_PRIORITY[1]

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
/* estado de seguimiento de avance/comunicación de un proyecto (primer registro vs días sin) */
function trackInfo(project, kind) {
  const entries = (kind === 'avance' ? project.avances : project.comms) || []
  if (entries.length) {
    const days = businessDaysSince(entries[0].date)
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
const daysUntil = (iso) => { const dt = parseLocalDate(iso); return dt ? Math.ceil((dt - new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())) / 86400000) : null }
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
      <I.calendar width={12} height={12} /> {fmtShortDate(date)}
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
      <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><I.comment width={14} height={14} /> {label} ({list.length})</div>
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
                <button className="btn btn-sm btn-ghost" onClick={() => onDelete(c.id)} style={{ padding: 3, color: 'var(--text-faint)' }}><I.x width={12} height={12} /></button>
              </div>
              <MentionText text={c.text} style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', display: 'block' }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <MentionTextarea value={text} onChange={setText} onEnter={submit} placeholder="Dejá un comentario… @ para etiquetar · Enter envía" style={{ resize: 'none' }} />
        <button className="btn btn-accent" onClick={submit} style={{ alignSelf: 'stretch' }}><I.send width={15} height={15} /></button>
      </div>
    </div>
  )
}

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
      <button ref={btnRef} onClick={toggle} title="Cambiar estado">
        <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text)', background: 'var(--bg-elevated)', borderColor: 'var(--border)', cursor: 'pointer' }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: meta.dot, flexShrink: 0 }} />
          {meta.label}<I.chevD width={11} height={11} style={{ marginLeft: 1, color: 'var(--text-faint)' }} />
        </span>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 201, padding: 5, minWidth: menuW, boxShadow: 'var(--shadow)' }}>
            {PROJECT_STATUS.map((o) => (
              <button key={o.key} className="row-hover" onClick={(e) => { e.stopPropagation(); onChange(o.key); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: o.key === status ? 'var(--accent)' : 'var(--text)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: o.dot, flexShrink: 0 }} />{o.label}
                {o.key === status && <I.check width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
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
        <I.flag width={size} height={size} style={{ color: meta.color }} />
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 201, padding: 5, minWidth: 150, boxShadow: 'var(--shadow)' }}>
            <div className="label" style={{ padding: '4px 9px 6px' }}>Prioridad</div>
            {PROJECT_PRIORITY.map((o) => (
              <button key={o.key} className="row-hover" onClick={(e) => { e.stopPropagation(); onChange(o.key); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: o.key === value ? 'var(--accent)' : 'var(--text)' }}>
                <I.flag width={15} height={15} style={{ color: o.color, flexShrink: 0 }} />{o.label}
                {o.key === value && <I.check width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
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
        className="btn btn-sm" title="Abrir testing / deploy" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', opacity: testing ? 1 : 0.45 }}><I.ext width={14} height={14} /></a>
      <a href={wa || undefined} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); if (!wa) e.preventDefault() }}
        className="btn btn-sm" style={{ justifyContent: 'center', color: wa ? 'var(--green)' : undefined, opacity: wa ? 1 : 0.45 }}><I.whatsapp width={14} height={14} /> WhatsApp</a>
      <button className="btn btn-sm" onClick={openEdit} title="Editar links" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center' }}><I.pencil width={14} height={14} /></button>
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
            <Toggle k="scope" label="Alcance" sub="PDFs, contexto, calls y notas" Ico={I.pdf} />
            <Toggle k="testing" label="Testing / deploy" sub="Abre la URL de la app" Ico={I.gear} />
            <Toggle k="whatsapp" label="WhatsApp" sub="Grupo del cliente" Ico={I.whatsapp} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => { onSave({ testingUrl: t, whatsappUrl: w, cardActions: show }); onClose() }}><I.check width={15} height={15} /> Guardar</button>
        </div>
      </div>
    </Modal>
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
function EditProjectModal({ open, project, onClose, onSave, onDelete }) {
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
            <Field label="Prioridad">
              <select className="input" value={d.priority || 'normal'} onChange={(e) => set('priority', e.target.value)}>
                {PROJECT_PRIORITY.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="GitHub repo (org/repo)"><input className="input mono" value={d.githubRepo || ''} onChange={(e) => set('githubRepo', e.target.value)} /></Field>
            <Field label="URL Producción"><input className="input" value={d.productionUrl || ''} onChange={(e) => set('productionUrl', e.target.value)} /></Field>
            <Field label="Testing / Deploy URL"><input className="input" value={d.testingUrl || ''} onChange={(e) => set('testingUrl', e.target.value)} /></Field>
            <Field label="Grupo de WhatsApp"><input className="input" value={d.whatsappUrl || ''} onChange={(e) => set('whatsappUrl', e.target.value)} /></Field>
            <Field label="Contrato total (USD)"><input className="input mono" type="number" value={d.totalAmount} onChange={(e) => set('totalAmount', Number(e.target.value))} /></Field>
            <Field label="Cobrado / pagado (USD)"><input className="input mono" type="number" value={d.paidAmount} onChange={(e) => set('paidAmount', Number(e.target.value))} /></Field>
            <Field label="Ingreso estimado (si está pendiente)"><input className="input mono" type="date" value={(d.expectedStartDate || '').slice(0, 10)} onChange={(e) => set('expectedStartDate', e.target.value)} /></Field>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            {onDelete ? <button className="btn" onClick={() => { if (window.confirm(`¿Eliminar el proyecto "${d.name}"? Se borran sus sprints, registro y datos. No se puede deshacer.`)) { onDelete(d.id); onClose() } }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I.trash width={15} height={15} /> Eliminar proyecto</button> : <span />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn btn-accent" onClick={() => { onSave(d); onClose() }}><I.check width={15} height={15} /> Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
function Progress({ value, height = 8, showLabel = false, color }) {
  const c = color || pctColor(value)
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
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const meta = sprintMeta(status)
  const tint = (tone) => ({ color: `var(--${tone === 'neutral' ? 'text-dim' : tone})`, bg: tone === 'neutral' ? 'var(--bg-elevated)' : `var(--${tone}-soft)`, bd: tone === 'accent' ? 'var(--accent-line)' : tone === 'neutral' ? 'var(--border)' : 'transparent' })
  const s = tint(meta.tone)
  const menuH = SPRINT_STATUS.length * 38 + 12
  const toggle = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const down = r.bottom + menuH <= window.innerHeight
      setPos({ left: r.left, top: down ? r.bottom + 4 : Math.max(8, r.top - menuH - 4) })
    }
    setOpen((v) => !v)
  }
  return (
    <span style={{ display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} onClick={toggle} title="Cambiar estado">
        <span className="tag" style={{ cursor: 'pointer', color: s.color, background: s.bg, borderColor: s.bd, minWidth: full ? 96 : 0, justifyContent: 'center' }}>
          {meta.label}<I.chevD width={11} height={11} style={{ marginLeft: 1 }} />
        </span>
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 201, padding: 5, minWidth: 150, boxShadow: 'var(--shadow)' }}>
            {SPRINT_STATUS.map((o) => (
              <button key={o.key} className="row-hover" onClick={(e) => { e.stopPropagation(); onChange(o.key); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: normSprint(status) === o.key ? 'var(--accent)' : 'var(--text)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: o.dot, flexShrink: 0 }} />{o.label}
                {normSprint(status) === o.key && <I.check width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </span>
  )
}

/* sprint detail card: estado · semana · asignados · fecha · descripción · comentarios */
function SprintDetailModal({ open, sprint, team, defaultId, onClose, onPatch }) {
  if (!sprint) return <Modal open={open} onClose={onClose} title="Sprint" />
  return (
    <Modal open={open} onClose={onClose} title={sprint.name} sub="Detalle del sprint" width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="label">Estado</span><SprintStatusBadge status={sprint.status} onChange={(v) => onPatch({ status: v })} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="label">Semana</span>
            <input type="number" min="1" className="input mono" value={sprint.week || 1} onChange={(e) => onPatch({ week: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 64, padding: '6px 8px', fontSize: 12.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="label">Fecha estimada</span>
            <input type="date" className="input mono" value={(sprint.estimatedDate || '').slice(0, 10)} onChange={(e) => onPatch({ estimatedDate: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ width: 'auto', padding: '6px 9px', fontSize: 12.5 }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="label">Asignados</span>
          <SprintAssignees ids={sprint.assigneeIds} team={team || []} defaultId={defaultId} onChange={(a) => onPatch({ assigneeIds: a })} size={28} />
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Por defecto el developer de la tarjeta; podés sumar más.</span>
        </div>
        <Field label="Nombre del sprint"><input className="input" value={sprint.name} onChange={(e) => onPatch({ name: e.target.value })} /></Field>
        <Field label="Explicación detallada"><textarea className="input" rows={4} value={sprint.description || ''} onChange={(e) => onPatch({ description: e.target.value })} placeholder="Describí el alcance, objetivos y notas del sprint…" /></Field>

        <CommentThread comments={sprint.comments} subject={`el sprint "${sprint.name}"`}
          onAdd={(c) => onPatch({ comments: [...(sprint.comments || []), c] })}
          onDelete={(id) => onPatch({ comments: (sprint.comments || []).filter((x) => x.id !== id) })} />
      </div>
    </Modal>
  )
}

/* sprint board: table (drag to reorder) or kanban (drag between status columns) */
/* avatares (solapados) de los developers asignados a un sprint; editable. Default = dev de la tarjeta */
function SprintAssignees({ ids, team, defaultId, onChange, size = 24 }) {
  const [menu, setMenu] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const list = (ids && ids.length) ? ids : (defaultId ? [defaultId] : [])
  const users = list.map((id) => team.find((u) => u.id === id)).filter(Boolean)
  const toggle = (e) => { e.stopPropagation(); if (!menu && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ left: Math.min(Math.max(8, r.left), window.innerWidth - 228), top: r.bottom + 6 }) } setMenu((v) => !v) }
  const toggleUser = (uid2) => { const next = list.includes(uid2) ? list.filter((x) => x !== uid2) : [...list, uid2]; onChange(next) }
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <button ref={btnRef} onClick={toggle} title="Asignar developers" className="row-hover" style={{ display: 'inline-flex', alignItems: 'center', padding: 2, borderRadius: 8 }}>
        {users.length === 0 ? <Avatar empty size={size} ring="var(--card)" /> : users.map((u, i) => (
          <span key={u.id} style={{ marginLeft: i === 0 ? 0 : -Math.round(size * 0.32), position: 'relative', zIndex: users.length - i }}><Avatar user={u} size={size} ring="var(--card)" title={u.name} /></span>
        ))}
      </button>
      {menu && pos && createPortal(<>
        <div onClick={(e) => { e.stopPropagation(); setMenu(false) }} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
        <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 301, width: 220, padding: 6, boxShadow: 'var(--shadow)', maxHeight: 280, overflowY: 'auto' }}>
          <div className="label" style={{ padding: '4px 8px 6px' }}>Developers del sprint</div>
          {team.map((u) => { const on = list.includes(u.id); return (
            <button key={u.id} className="row-hover" onClick={() => toggleUser(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 8 }}>
              <Avatar user={u} size={22} ring="var(--card)" /><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{u.name}</span>{on && <I.check width={14} height={14} style={{ color: 'var(--accent)' }} />}
            </button>
          )})}
        </div>
      </>, document.body)}
    </span>
  )
}

/* parsea texto pegado con el formato: "# -- Nombre -- Sem N -- Asignado -- Estado -- DD/MM/YYYY" */
function parseSprintImport(text, team) {
  const out = []
  const normStatus = (s) => { const x = (s || '').toLowerCase(); if (/proceso|progreso|curso|haciendo/.test(x)) return 'en proceso'; if (/termin|hecho|complet|listo|finaliz/.test(x)) return 'terminado'; if (/pausa|frenad|espera/.test(x)) return 'pausado'; return 'pendiente' }
  const findUser = (name) => { const n = (name || '').toLowerCase().trim(); if (!n) return null; return team.find((u) => u.name && (u.name.toLowerCase() === n || u.name.toLowerCase().includes(n) || n.includes(u.name.toLowerCase()))) || null }
  const parseDate = (d) => {
    const s = (d || '').trim()
    let m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/) // DD/MM/YYYY
    if (m) { let yy = m[3]; if (yy.length === 2) yy = '20' + yy; return new Date(`${yy}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}T12:00:00`).toISOString() }
    m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/) // YYYY-MM-DD
    if (m) return new Date(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}T12:00:00`).toISOString()
    return null
  }
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (/nombre/i.test(line) && /(semana|estado|estimad|asignad)/i.test(line)) continue // header
    let parts = line.split(/\s*--\s*|\t+|\s*\|\s*/).map((x) => x.trim()).filter((x) => x !== '')
    if (parts.length < 2) continue
    if (/^\d+$/.test(parts[0]) && parts.length > 2) parts = parts.slice(1) // saca el "#"
    const [name, weekRaw, assigneeRaw, statusRaw, dateRaw] = parts
    if (!name) continue
    const wm = String(weekRaw || '').match(/\d+/)
    const u = findUser(assigneeRaw)
    out.push({ name, week: wm ? Number(wm[0]) : null, assigneeName: (assigneeRaw || '').trim(), assigneeUser: u, assigneeIds: u ? [u.id] : [], status: normStatus(statusRaw), estimatedDate: parseDate(dateRaw), dateStr: (dateRaw || '').trim() })
  }
  return out
}

const IMPORT_EXAMPLE = `# -- Nombre -- Semana -- Asignado -- Estado -- Estimado
1 -- Investigación de datos -- Sem 1 -- Manuel Navarro -- En proceso -- 10/07/2026
2 -- Modelo de datos -- Sem 2 -- Manuel Navarro -- Pendiente -- 17/07/2026`

function ImportSprintsModal({ open, team, defaultDevId, hasSprints, onClose, onImport }) {
  const [text, setText] = useState('')
  const [replace, setReplace] = useState(true)
  useEffect(() => { if (open) { setText(''); setReplace(true) } }, [open])
  const parsed = parseSprintImport(text, team)
  const unmatched = parsed.filter((r) => r.assigneeName && !r.assigneeUser).map((r) => r.assigneeName)
  const create = () => {
    if (!parsed.length) return
    const list = parsed.map((r, i) => ({ id: uid(), name: r.name, status: r.status, week: r.week || (i + 1), estimatedDate: r.estimatedDate || NOW.toISOString(), actualDate: null, assigneeIds: r.assigneeIds.length ? r.assigneeIds : (defaultDevId ? [defaultDevId] : []), description: '', comments: [] }))
    onImport(list, replace)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Importar sprints" sub="Pegá la lista y revisá la vista previa antes de crear" width={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.6, background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
          Formato (una fila por sprint, columnas separadas por <span className="mono">--</span>):<br />
          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11.5 }}># -- Nombre -- Semana -- Asignado -- Estado -- DD/MM/YYYY</span>
        </div>
        <Field label="Pegá acá los sprints">
          <textarea className="input mono" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={IMPORT_EXAMPLE} style={{ resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 }} />
        </Field>

        <div>
          <div className="label" style={{ marginBottom: 8 }}>Vista previa ({parsed.length} sprint{parsed.length === 1 ? '' : 's'})</div>
          {parsed.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '8px 2px' }}>Pegá la lista arriba para ver cómo va a quedar.</div>
          ) : (
            <div className="surface" style={{ overflow: 'auto', maxHeight: 260 }}>
              <table>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['#', 'Nombre', 'Semana', 'Asignado', 'Estado', 'Estimada'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600, position: 'sticky', top: 0, background: 'var(--card)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {parsed.map((r, i) => { const m = sprintMeta(r.status); return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px' }} className="mono">{i + 1}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, fontSize: 13 }}>{r.name}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12.5, color: 'var(--text-dim)' }}>Sem {r.week || (i + 1)}</td>
                      <td style={{ padding: '9px 12px' }}>{r.assigneeUser ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar user={r.assigneeUser} size={20} ring="var(--card)" /><span style={{ fontSize: 12.5 }}>{r.assigneeUser.name}</span></span> : <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }} title="No coincide con ningún miembro — se usará el dev de la tarjeta">{r.assigneeName || '—'} {r.assigneeName ? '⚠' : ''}</span>}</td>
                      <td style={{ padding: '9px 12px' }}><span className="tag" style={{ color: `var(--${m.tone === 'neutral' ? 'text-dim' : m.tone === 'accent' ? 'accent' : m.tone})`, background: m.tone === 'neutral' ? 'var(--bg-elevated)' : `var(--${m.tone}-soft)`, borderColor: 'transparent' }}>{m.label}</span></td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: r.estimatedDate ? 'var(--text-dim)' : 'var(--red)' }} className="mono">{r.estimatedDate ? fmtDate(r.estimatedDate) : (r.dateStr ? 'fecha ?' : '—')}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
          {unmatched.length > 0 && <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 8 }}>⚠ No encontré a: {[...new Set(unmatched)].join(', ')}. A esos sprints se les va a asignar el developer de la tarjeta (podés cambiarlo después).</div>}
        </div>

        {hasSprints && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            <span>Reemplazar los sprints actuales <span style={{ color: 'var(--text-faint)' }}>(si lo destildás, se agregan a los existentes)</span></span>
          </label>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={create} disabled={!parsed.length}><I.check width={15} height={15} /> Crear {parsed.length || ''} sprint{parsed.length === 1 ? '' : 's'}</button>
        </div>
      </div>
    </Modal>
  )
}

function SprintBoard({ project, patch, onOpenSprint, linkedPlan, patchPlan }) {
  const { data, logActivity } = useApp()
  const [boardView, setBoardView] = useState('table')
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [weekFilter, setWeekFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('encurso')   // encurso (default, archiva terminados) | terminados | todos
  const [importOpen, setImportOpen] = useState(false)
  const sprints = project.sprints || []
  const team = data.team || []
  const devId = project.assignments?.dev?.userId || null
  const weekOf = (s, i) => s.week || (i + 1)
  const weeks = [...new Set(sprints.map((s, i) => weekOf(s, i)))].sort((a, b) => a - b)
  const setSprint = (sid, fields) => {
    const prev = sprints.find((s) => s.id === sid)
    patch((p) => ({ ...p, sprints: p.sprints.map((s) => s.id === sid ? { ...s, ...fields } : s) }))
    if (fields.status && normSprint(fields.status) === 'terminado' && prev && normSprint(prev.status) !== 'terminado' && logActivity) logActivity({ type: 'sprint-done', text: `terminó el sprint "${prev.name}" de ${project.name}` })
    // Sync sprint→plan: entrar/salir de "terminado" marca/desmarca toda la semana apareada.
    // Usa setWeekAllDone (no toggle) → idempotente, sin loop con el toggle de tareas.
    if (fields.status && linkedPlan && patchPlan) {
      const idx = sprints.findIndex((s) => s.id === sid)
      const weekN = (sprints[idx] && sprints[idx].week) || (idx + 1)
      const nextDone = normSprint(fields.status) === 'terminado'
      const prevDone = normSprint(prev && prev.status) === 'terminado'
      if (nextDone !== prevDone) {
        patchPlan(linkedPlan.id, (p) => ({ ...p, weeks: (p.weeks || []).map((w) => w.n === weekN ? setWeekAllDone(w, nextDone) : w) }))
      }
    }
  }
  const addSprint = () => { patch((p) => ({ ...p, sprints: [...p.sprints, { id: uid(), name: 'Nuevo sprint', status: 'pendiente', week: (p.sprints.length + 1), estimatedDate: NOW.toISOString(), actualDate: null, assigneeIds: devId ? [devId] : [], description: '', comments: [] }] })); logActivity && logActivity({ type: 'sprint-add', text: `agregó un sprint a ${project.name}` }) }

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
  const doneCount = sprints.filter((s) => normSprint(s.status) === 'terminado').length
  const statusOk = (s) => { const done = normSprint(s.status) === 'terminado'; return statusFilter === 'terminados' ? done : statusFilter === 'todos' ? true : !done }
  const rows = sprints.map((s, i) => ({ s, i, week: weekOf(s, i) })).filter((r) => (weekFilter === 'all' || r.week === weekFilter) && statusOk(r.s))
  const canDrag = weekFilter === 'all' && statusFilter !== 'terminados'

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 19 }}>Sprints</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto', padding: '7px 9px', fontSize: 12.5 }} title="Filtrar por estado">
            <option value="encurso">En curso</option>
            <option value="terminados">Terminados{doneCount ? ` (${doneCount})` : ''}</option>
            <option value="todos">Todos</option>
          </select>
          <select className="input" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={{ width: 'auto', padding: '7px 9px', fontSize: 12.5 }}>
            <option value="all">Todas las semanas</option>
            {weeks.map((w) => <option key={w} value={w}>Semana {w}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setImportOpen(true)} title="Importar sprints desde una lista"><I.download width={14} height={14} /> Importar</button>
          <div className="surface" style={{ display: 'flex', padding: 3, borderRadius: 10 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setBoardView('table')} title="Tabla" style={{ background: boardView === 'table' ? 'var(--card-hover)' : 'transparent', color: boardView === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I.table width={15} height={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => setBoardView('kanban')} title="Kanban" style={{ background: boardView === 'kanban' ? 'var(--card-hover)' : 'transparent', color: boardView === 'kanban' ? 'var(--accent)' : 'var(--text-dim)' }}><I.kanban width={15} height={15} /></button>
          </div>
        </div>
      </div>
      <ImportSprintsModal open={importOpen} team={team} defaultDevId={devId} hasSprints={sprints.length > 0} onClose={() => setImportOpen(false)}
        onImport={(list, replace) => { patch((p) => ({ ...p, sprints: replace ? list : [...(p.sprints || []), ...list] })); logActivity && logActivity({ type: 'sprint-add', text: `importó ${list.length} sprints a ${project.name}` }) }} />

      {boardView === 'table' ? (
        <>
          <div className="surface tbl" style={{ overflow: 'hidden' }}>
            <table>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['', '#', 'Nombre', 'Semana', 'Asignado', 'Estado', 'Estimada'].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map(({ s, i, week }) => {
                  const inProc = normSprint(s.status) === 'en proceso'
                  const done = normSprint(s.status) === 'terminado'
                  return (
                  <tr key={s.id} draggable={canDrag}
                    onDragStart={(e) => { if (!canDrag) return; e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setDragId(s.id) }}
                    onDragOver={(e) => { if (!canDrag) return; e.preventDefault(); setOverId(s.id) }}
                    onDragEnd={() => { setDragId(null); setOverId(null) }}
                    onDrop={(e) => { if (!canDrag) return; e.preventDefault(); reorder(e.dataTransfer.getData('text/plain') || dragId, s.id); setDragId(null); setOverId(null) }}
                    style={{ borderBottom: '1px solid var(--border)', borderLeft: inProc ? '3px solid var(--accent)' : '3px solid transparent', background: overId === s.id && dragId !== s.id ? 'var(--card-hover)' : dragId === s.id ? 'var(--bg-elevated)' : inProc ? 'var(--accent-soft)' : 'transparent', opacity: dragId === s.id ? 0.5 : done ? 0.5 : 1 }}>
                    <td style={{ padding: '12px 8px 12px 14px', width: 28, cursor: canDrag ? 'grab' : 'default', color: 'var(--text-faint)' }} title={canDrag ? 'Arrastrá para reordenar' : ''}><I.grip width={16} height={16} /></td>
                    <td style={{ padding: '12px 14px' }} className="mono">{i + 1}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button className="click" onClick={() => onOpenSprint(s.id)} title="Ver detalle" style={{ fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text)' }}>
                        {s.name}
                        {done && <span className="tag" style={{ color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>archivado</span>}
                        {(s.comments || []).length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text-faint)' }}><I.comment width={11} height={11} />{s.comments.length}</span>}
                      </button>
                    </td>
                    <td style={{ padding: '8px 14px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sem</span>
                        <input type="number" min="1" className="input mono" value={week} onChange={(e) => setSprint(s.id, { week: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 52, padding: '5px 6px', fontSize: 12.5 }} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}><SprintAssignees ids={s.assigneeIds} team={team} defaultId={devId} onChange={(a) => setSprint(s.id, { assigneeIds: a })} /></td>
                    <td style={{ padding: '12px 14px' }}><SprintStatusBadge status={s.status} onChange={(v) => setSprint(s.id, { status: v })} /></td>
                    <td style={{ padding: '8px 14px' }}>
                      <input type="date" className="input mono" value={(s.estimatedDate || '').slice(0, 10)} onChange={(e) => setSprint(s.id, { estimatedDate: e.target.value ? new Date(e.target.value).toISOString() : null })} onClick={(e) => e.stopPropagation()} style={{ width: 'auto', padding: '5px 8px', fontSize: 12, background: 'transparent', border: '1px solid transparent' }} onFocus={(e) => (e.target.style.borderColor = 'var(--border)')} onBlur={(e) => (e.target.style.borderColor = 'transparent')} />
                    </td>
                  </tr>
                )})}
                {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 18, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>{statusFilter === 'terminados' ? 'No hay sprints terminados todavía.' : 'Sin sprints para este filtro.'}</td></tr>}
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
                        <span>Semana {s.week || (sprints.indexOf(s) + 1)}</span>
                        <span>{fmtDate(s.estimatedDate)}</span>
                      </div>
                      <div style={{ marginTop: 7 }} onClick={(e) => e.stopPropagation()}><SprintAssignees ids={s.assigneeIds} team={team} defaultId={devId} onChange={(a) => setSprint(s.id, { assigneeIds: a })} size={22} /></div>
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

/* alta de un proyecto nuevo: cliente + WhatsApp + testing (opcional). Los sprints se cargan luego dentro de la tarjeta. */
function NewProjectModal({ open, clients, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [wa, setWa] = useState('')
  const [testing, setTesting] = useState('')
  useEffect(() => { if (open) { setName(''); setClientId((clients[0] && clients[0].id) || ''); setWa(''); setTesting('') } }, [open])
  const create = () => { const n = name.trim(); if (!n || !clientId) return; onCreate({ name: n, clientId, whatsappUrl: wa.trim(), testingUrl: testing.trim() }) }
  return (
    <Modal open={open} onClose={onClose} title="Nuevo proyecto" sub="Creá la tarjeta; después cargás los sprints adentro" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nombre del proyecto"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Chamber OS" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }} /></Field>
        <Field label="Cliente">
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.length === 0 && <option value="">— No hay clientes cargados —</option>}
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </Field>
        <Field label="Grupo de WhatsApp"><input className="input" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://chat.whatsapp.com/…" /></Field>
        <Field label="Testing / Deploy URL (opcional)"><input className="input" value={testing} onChange={(e) => setTesting(e.target.value)} placeholder="https://mi-app.onrender.com" /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={create} disabled={!name.trim() || !clientId}><I.plus width={15} height={15} /> Crear proyecto</button>
        </div>
      </div>
    </Modal>
  )
}

/* vista Gantt / semanal: proyectos (filas) × semanas (columnas), con los sprints ubicados por su fecha estimada */
function SprintGantt({ projects, clientOf, onOpen }) {
  const monday = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - day); return x }
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  const fmtWk = (mon) => { const sun = addD(mon, 6); const mm = mon.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''); const sm = sun.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''); return mm === sm ? `${mon.getDate()}–${sun.getDate()} ${sm}` : `${mon.getDate()} ${mm} – ${sun.getDate()} ${sm}` }
  const items = []
  projects.forEach((p) => (p.sprints || []).forEach((s) => { if (s.estimatedDate) items.push({ pid: p.id, s, mon: monday(s.estimatedDate) }) }))
  const todayMon = monday(new Date())
  let weeks = []
  if (items.length) {
    const minT = Math.min(...items.map((i) => i.mon.getTime()), todayMon.getTime())
    const maxT = Math.max(...items.map((i) => i.mon.getTime()), todayMon.getTime())
    let cur = new Date(minT), guard = 0
    while (cur.getTime() <= maxT && guard < 30) { weeks.push(new Date(cur)); cur = addD(cur, 7); guard++ }
  } else weeks = [todayMon]
  const cell = {}
  items.forEach(({ pid, s, mon }) => { const k = pid + '|' + mon.getTime(); (cell[k] = cell[k] || []).push(s) })
  const colW = 148
  const anyDated = items.length > 0
  return (
    <div className="surface tbl" style={{ overflowX: 'auto', padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `minmax(180px,200px) repeat(${weeks.length}, ${colW}px)`, minWidth: 'min-content' }}>
        <div style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--card)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '12px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>Proyecto</div>
        {weeks.map((w, i) => { const now = w.getTime() === todayMon.getTime(); return (
          <div key={'h' + i} style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '10px', fontSize: 11.5, fontWeight: 600, color: now ? 'var(--accent)' : 'var(--text-dim)', background: now ? 'var(--accent-soft)' : 'transparent', textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtWk(w)}{now ? ' · hoy' : ''}</div>
        )})}
        {projects.flatMap((p) => {
          const label = (
            <div key={p.id + '-l'} onClick={() => onOpen(p.id)} className="click row-hover" style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <div style={{ flex: 'none', width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: 11, background: hexA(projectHue(p), 0.16), color: projectHue(p) }}>{projectInitials(p.name)}</div>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientOf(p.clientId)?.company || ''}</div></div>
            </div>
          )
          const cells = weeks.map((w, ci) => {
            const sp = cell[p.id + '|' + w.getTime()] || []
            const now = w.getTime() === todayMon.getTime()
            return (
              <div key={p.id + '-' + ci} onClick={() => onOpen(p.id)} className="click" style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: 6, minHeight: 54, background: now ? 'var(--accent-soft)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sp.map((s) => { const m = sprintMeta(s.status); const tone = m.tone; return (
                  <span key={s.id} title={`${s.name} · ${m.label} · ${fmtDate(s.estimatedDate)}`} style={{ fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 6, background: tone === 'neutral' ? 'var(--bg-elevated)' : `var(--${tone}-soft)`, color: tone === 'neutral' ? 'var(--text-dim)' : `var(--${tone === 'accent' ? 'accent' : tone})`, border: `1px solid ${tone === 'accent' ? 'var(--accent-line)' : 'var(--border)'}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                )})}
              </div>
            )
          })
          return [label, ...cells]
        })}
      </div>
      {!anyDated && <div style={{ padding: 16, fontSize: 13, color: 'var(--text-faint)' }}>Todavía no hay sprints con fecha estimada. Entrá a cada proyecto y cargá la fecha de los sprints para verlos acá por semana.</div>}
    </div>
  )
}

/* ============================================================================
   12 · PROJECTS LIST
============================================================================ */
function Projects({ onOpenProject }) {
  const { data, setData, logActivity } = useApp()
  const [newOpen, setNewOpen] = useState(false)
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const [tab, setTab] = useState(qp.get('tab') || 'active')
  const [view, setView] = useState('cards')
  const [clientFilter, setClientFilter] = useState(qp.get('client') || 'all')
  const [pmFilter, setPmFilter] = useState(qp.get('pm') || 'all')
  const [devFilter, setDevFilter] = useState(qp.get('dev') || 'all')
  const [tagFilter, setTagFilter] = useState(qp.get('tag') || 'all')
  const [prioFilter, setPrioFilter] = useState(qp.get('prio') || 'all')   // all | sort | alta | normal | baja
  const [search, setSearch] = useState('')             // búsqueda en vivo (client-side): nombre, cliente, PM/Dev
  const [pendingFor, setPendingFor] = useState(null)   // id del proyecto al que se le pide fecha de ingreso
  const [logModal, setLogModal] = useState(null)       // { projectId, kind } | null
  const [scopeFor, setScopeFor] = useState(null)       // id del proyecto para abrir Alcance (acceso directo)
  const [cardCfgFor, setCardCfgFor] = useState(null)   // id del proyecto para editar la tarjeta (links + qué mostrar)
  const clientOf = (id) => data.clients.find((c) => c.id === id)
  const userOf = (id) => data.team.find((u) => u.id === id)
  const updateProject = (id, fields) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...fields } : p)) }))
  const patchProject = (id, fn) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? fn(p) : p)) }))
  const setStatus = (id, status) => { updateProject(id, { status }); if (status === 'pending') setPendingFor(id) }
  const createProject = ({ name, clientId, whatsappUrl, testingUrl }) => {
    const id = uid()
    const proj = {
      id, name, clientId, status: 'active', priority: 'normal',
      assignments: { pm: null, dev: null }, tags: [], sprints: [],
      avances: [], comms: [], scopeFiles: [], salesLinks: [], scopeNotes: [],
      risks: [], pendingAgency: [], pendingClient: [], chats: [],
      createdAt: new Date().toISOString(),
      testingUrl: testingUrl || '', whatsappUrl: whatsappUrl || '', productionUrl: '',
      totalAmount: 0, paidAmount: 0, lastDeployDate: null, githubRepo: '', kickoff: '', stack: '',
      cardActions: { scope: true, testing: true, whatsapp: true },
    }
    setData((d) => ({ ...d, projects: [proj, ...d.projects] }))
    if (logActivity) logActivity({ type: 'project-add', text: `creó el proyecto "${name}"` })
    setNewOpen(false)
    onOpenProject(id)   // abre la tarjeta nueva para cargar los sprints
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
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [tab, clientFilter, pmFilter, devFilter, tagFilter, prioFilter])

  const allTags = [...new Set(data.projects.flatMap((p) => (p.tags || []).map((t) => t.text)))]
  const filtersActive = clientFilter !== 'all' || pmFilter !== 'all' || devFilter !== 'all' || tagFilter !== 'all' || prioFilter !== 'all'
  const clearFilters = () => { setClientFilter('all'); setPmFilter('all'); setDevFilter('all'); setTagFilter('all'); setPrioFilter('all') }
  const matchesFilters = (p) =>
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
  const countFor = (status) => data.projects.filter((p) => p.status === status && keep(p)).length
  let list = data.projects.filter((p) => p.status === tab && keep(p))
  if (prioFilter === 'sort') list = [...list].sort((a, b) => projPrioMeta(b.priority).rank - projPrioMeta(a.priority).rank)

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Cartera</div>
          <h1 style={{ fontSize: 32 }}>Proyectos</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 300, maxWidth: '52vw', height: 40, padding: '0 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <I.search width={15} height={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proyecto, cliente o miembro…"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 13.5, color: 'var(--text)', outline: 'none' }} />
            {search && <button onClick={() => setSearch('')} title="Limpiar búsqueda" style={{ display: 'flex', padding: 2, border: 'none', background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer' }}><I.x width={14} height={14} /></button>}
          </label>
          <div className="surface" style={{ display: 'flex', padding: 3, borderRadius: 10 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('cards')} title="Tarjetas" style={{ background: view === 'cards' ? 'var(--card-hover)' : 'transparent', color: view === 'cards' ? 'var(--accent)' : 'var(--text-dim)' }}><I.cards width={15} height={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('table')} title="Tabla" style={{ background: view === 'table' ? 'var(--card-hover)' : 'transparent', color: view === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I.table width={15} height={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('gantt')} title="Gantt / semanal" style={{ background: view === 'gantt' ? 'var(--card-hover)' : 'transparent', color: view === 'gantt' ? 'var(--accent)' : 'var(--text-dim)' }}><I.gantt width={15} height={15} /></button>
          </div>
          <button className="btn btn-accent" onClick={() => setNewOpen(true)} title="Nuevo proyecto" style={{ fontWeight: 800 }}><span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1, marginTop: -2 }}>+</span> Nuevo proyecto</button>
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
          {data.team.filter((u) => u.role === 'pm').map((u) => <option key={u.id} value={u.id}>PM: {u.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={devFilter} onChange={(e) => setDevFilter(e.target.value)}>
          <option value="all">Dev: todos</option>
          {data.team.filter((u) => u.role === 'dev').map((u) => <option key={u.id} value={u.id}>Dev: {u.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="all">Etiqueta: todas</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)}>
          <option value="all">Prioridad: todas</option>
          <option value="sort">▼ Más prioritario primero</option>
          <option value="alta">🚩 Alta</option>
          <option value="normal">🚩 Normal</option>
          <option value="baja">🚩 Baja</option>
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

      {list.length === 0 && <div className="surface" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>{q ? <>Sin proyectos que coincidan con «{search.trim()}».</> : 'Sin proyectos en esta vista.'}</div>}

      {view === 'cards' ? (
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))', gap: 16 }}>
          {list.map((p) => {
            const cl = clientOf(p.clientId)
            const dd = daysAgo(p.lastDeployDate)
            const currentSprint = p.sprints.find((s) => normSprint(s.status) === 'en proceso')
            const hue = projectHue(p)
            const pct = calcProgress(p)
            const show = { scope: true, testing: true, whatsapp: true, ...(p.cardActions || {}) }
            const testingUrl = p.testingUrl || p.productionUrl || ''
            const waUrl = p.whatsappUrl || ''
            const mini = (label, Icon, kind, firstLabel) => {
              const t = trackInfo(p, kind)
              const bad = t.overdue
              const val = t.first ? firstLabel : (t.days === 0 ? 'hoy' : `${t.days}d háb.`)
              return (
                <button onClick={(e) => { e.stopPropagation(); setLogModal({ projectId: p.id, kind }) }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', minWidth: 0 }}>
                  <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, letterSpacing: '.09em', fontWeight: 500, color: bad ? 'var(--red)' : 'var(--text-faint)' }}><Icon width={12} height={12} /> {label.toUpperCase()}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: bad ? 'var(--red)' : t.first ? 'var(--text-faint)' : 'var(--text)' }}>{val}{bad ? ' ⚠' : ''}</span>
                </button>
              )
            }
            return (
              <motion.div key={p.id} variants={rise} whileHover={{ y: -3 }} onClick={() => onOpenProject(p.id)} className="surface surface-hover click" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: 15, letterSpacing: '-.01em', background: hexA(hue, 0.16), color: hue }}>{projectInitials(p.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      <span style={{ flex: 'none', display: 'inline-flex' }}><PriorityMenu value={p.priority} onChange={(v) => updateProject(p.id, { priority: v })} size={14} /></span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{cl?.company}</div>
                  </div>
                  <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <StatusMenu status={p.status} onChange={(s) => setStatus(p.id, s)} />
                    <button className="btn btn-sm btn-ghost" title="Editar tarjeta (links y qué mostrar)" onClick={(e) => { e.stopPropagation(); setCardCfgFor(p.id) }} style={{ padding: 5, color: 'var(--text-faint)' }}><I.pencil width={14} height={14} /></button>
                  </div>
                </div>
                {p.status === 'pending' && (
                  <div onClick={(e) => { e.stopPropagation(); setPendingFor(p.id) }}>
                    {p.expectedStartDate
                      ? <PendingDateChip date={p.expectedStartDate} style={{ cursor: 'pointer' }} />
                      : <span className="tag click" style={{ color: 'var(--blue)', background: 'transparent', borderColor: 'var(--blue)' }}><I.calendar width={12} height={12} /> Definir ingreso</span>}
                  </div>
                )}
                <Progress value={pct} height={6} showLabel color={cardPctColor(pct)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {mini('Último mensaje', I.phone, 'comm', 'Sin primer mensaje')}
                  {mini('Último avance', I.folder, 'avance', 'Sin primer avance')}
                </div>
                <ProjectTags tags={p.tags} onChange={(tags) => updateProject(p.id, { tags })} />
                <div style={{ height: 1, background: 'var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <TeamAvatars assignments={p.assignments} team={data.team} onChange={(assignments) => updateProject(p.id, { assignments })} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    {show.scope && <button className="btn btn-sm" title="Alcance · PDFs, contexto, notas" onClick={(e) => { e.stopPropagation(); setScopeFor(p.id) }} style={{ width: 36, height: 34, padding: 0, justifyContent: 'center', color: 'var(--accent)', borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}><I.pdf width={17} height={17} /></button>}
                    {show.testing && <a href={testingUrl || undefined} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); if (!testingUrl) e.preventDefault() }} className="btn btn-sm" title="Testing / deploy" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', opacity: testingUrl ? 1 : 0.45 }}><I.gear width={15} height={15} /></a>}
                    {show.whatsapp && <a href={waUrl || undefined} target="_blank" rel="noreferrer" onClick={(e) => { e.stopPropagation(); if (!waUrl) e.preventDefault() }} className="btn btn-sm" title="Grupo de WhatsApp" style={{ justifyContent: 'center', color: waUrl ? 'var(--green)' : undefined, opacity: waUrl ? 1 : 0.45 }}><I.whatsapp width={14} height={14} /> WhatsApp</a>}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      ) : view === 'gantt' ? (
        <SprintGantt projects={list} clientOf={clientOf} onOpen={onOpenProject} />
      ) : (
        <div className="surface tbl" style={{ overflow: 'hidden' }}>
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Proyecto', 'Cliente', 'Equipo', 'Estado', 'Avance', 'Sprint actual', 'Últ. comunicación', 'Últ. avance'].map((h) =><th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const cl = clientOf(p.clientId)
                const cs = p.sprints.find((s) => normSprint(s.status) === 'en proceso')
                const trackCell = (kind, firstLabel) => {
                  const t = trackInfo(p, kind)
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
                    <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{cl?.company}</td>
                    <td style={{ padding: '13px 16px' }}><TeamAvatars assignments={p.assignments} team={data.team} onChange={(assignments) => updateProject(p.id, { assignments })} size={26} ring="var(--card)" /></td>
                    <td style={{ padding: '13px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PriorityMenu value={p.priority} onChange={(v) => updateProject(p.id, { priority: v })} /><StatusMenu status={p.status} onChange={(s) => setStatus(p.id, s)} />{p.status === 'pending' && p.expectedStartDate && <PendingDateChip date={p.expectedStartDate} />}</div></td>
                    <td style={{ padding: '13px 16px', minWidth: 160 }}><Progress value={calcProgress(p)} showLabel /></td>
                    <td style={{ padding: '13px 16px', color: 'var(--text-dim)', fontSize: 13 }}>{cs?.name || '—'}</td>
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
            <button className="btn btn-accent" onClick={() => onSave(date)}><I.check width={15} height={15} /> Guardar</button>
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
        <I.chevD width={11} height={11} style={{ color: 'var(--text-faint)' }} />
      </button>
      {open && pos && createPortal(<>
        <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
        <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 301, width: 220, padding: 6, boxShadow: 'var(--shadow)', maxHeight: 280, overflowY: 'auto' }}>
          <div className="label" style={{ padding: '4px 8px 6px' }}>Quién lo registró</div>
          {team.map((x) => (
            <button key={x.id} className="row-hover" onClick={() => { onChange(x.id); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 8 }}>
              <Avatar user={x} size={22} ring="var(--card)" /><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{x.name}</span>{value === x.id && <I.check width={14} height={14} style={{ color: 'var(--accent)' }} />}
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
        <button className="btn btn-sm btn-ghost" onClick={() => onDelete(entry.id)} style={{ padding: 3, color: 'var(--text-faint)' }}><I.x width={12} height={12} /></button>
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
        <button onClick={() => setReplyOpen((v) => !v)} className="btn btn-sm btn-ghost" style={{ padding: '3px 8px', fontSize: 12, color: 'var(--text-dim)' }}><I.comment width={12} height={12} /> Responder{(entry.replies || []).length ? ` (${entry.replies.length})` : ''}</button>
      </div>

      {(entry.replies || []).length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {entry.replies.map((r) => { const ru = userOf(r.authorId); return (
            <div key={r.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {ru ? <Avatar user={ru} size={16} ring="var(--bg-elevated)" /> : <Avatar empty size={16} ring="var(--bg-elevated)" />}
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{ru ? ru.name : 'Alguien'}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{fmtDate(r.date)}</span>
                <button onClick={() => onUpdate(entry.id, { replies: entry.replies.filter((x) => x.id !== r.id) })} title="Eliminar respuesta" style={{ marginLeft: 'auto', color: 'var(--text-faint)', display: 'flex', background: 'transparent' }}><I.x width={11} height={11} /></button>
              </div>
              <MentionText text={r.text} style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.45, display: 'block' }} />
            </div>
          )})}
        </div>
      )}
      {replyOpen && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="input" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReply() } }} placeholder="Responder…" autoFocus style={{ padding: '7px 10px', fontSize: 13 }} />
          <button className="btn btn-sm btn-accent" onClick={addReply}><I.send width={14} height={14} /></button>
        </div>
      )}
    </div>
  )
}

function ProjectLogModal({ open, kind, project, onClose, patch }) {
  const { data, logActivity } = useApp()
  const [text, setText] = useState('')
  const [shots, setShots] = useState([])
  const [busy, setBusy] = useState(false)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const fileRef = useRef(null)
  if (!project) return <Modal open={open} onClose={onClose} title="Registro" />
  const clientName = data.clients.find((c) => c.id === project.clientId)?.company || 'el cliente'
  const cfg = kind === 'comm'
    ? { field: 'comms', title: 'Última comunicación', icon: I.phone, accent: 'var(--blue)', placeholder: 'Ej: hablé con el cliente por WhatsApp, pidió un cambio en…', actText: `registró comunicación con ${clientName}`, unit: 'comunicación', firstLabel: 'Sin primer mensaje', firstMax: 3 }
    : { field: 'avances', title: 'Último avance', icon: I.folder, accent: 'var(--green)', placeholder: 'Ej: le mandé la v2 con el módulo de pagos para revisar…', actText: `registró un avance en ${project.name}`, unit: 'avance', firstLabel: 'Sin primer avance', firstMax: 7 }
  const entries = project[cfg.field] || []
  const myId = typeof localStorage !== 'undefined' ? localStorage.getItem('my_team_id') : ''
  const userOf = (id) => (data.team || []).find((u) => u.id === id)
  const track = trackInfo(project, kind === 'comm' ? 'comm' : 'avance')
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
            {overdue && <span className="tag" style={{ marginLeft: 'auto', color: 'var(--red)', background: 'transparent', borderColor: 'var(--red)' }}><I.alert width={12} height={12} /> {track.first ? 'Mandar primer ' + cfg.unit : 'Reportarse con el cliente'}</span>}
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
                  <button onClick={() => setShots((arr) => arr.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 99, background: 'var(--red)', color: '#fff', display: 'grid', placeItems: 'center' }}><I.x width={11} height={11} /></button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><I.paperclip width={14} height={14} /> {busy ? 'Procesando…' : 'Adjuntar capturas'}</button>
            <button className="btn btn-sm btn-accent" onClick={addEntry} style={{ marginLeft: 'auto' }}><I.check width={14} height={14} /> Registrar {cfg.unit}</button>
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
  const clientOf = (id) => clients.find((c) => c.id === id)
  const rows = projects.map((p) => ({ p, av: trackInfo(p, 'avance'), comm: trackInfo(p, 'comm') }))
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
                  <span style={{ color: commBad ? 'var(--red)' : 'var(--text-dim)' }}><I.phone width={11} height={11} /> Comunicación: <strong>{fmtD(comm, 'sin primer mensaje')}</strong></span>
                  <span style={{ color: avBad ? 'var(--red)' : 'var(--text-dim)' }}><I.folder width={11} height={11} /> Avance: <strong>{fmtD(av, 'sin primer avance')}</strong></span>
                </div>
              </div>
              <a href={p.whatsappUrl || undefined} target="_blank" rel="noreferrer" onClick={(e) => { if (!p.whatsappUrl) e.preventDefault() }}
                className="btn btn-sm" title={p.whatsappUrl ? 'Abrir grupo de WhatsApp' : 'Sin link de WhatsApp cargado'} style={{ color: p.whatsappUrl ? 'var(--green)' : 'var(--text-faint)', opacity: p.whatsappUrl ? 1 : 0.5, flexShrink: 0 }}><I.whatsapp width={15} height={15} /> WhatsApp</a>
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-accent" onClick={onClose}><I.check width={15} height={15} /> Entendido</button>
        </div>
      </div>
    </Modal>
  )
}

/* añadir un link (nombre + url) — reutilizable para docs y llamadas de venta */
function LinkAdder({ onAdd, cta = 'Agregar link' }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const submit = () => { const u = url.trim(); if (!u) return; onAdd({ id: uid(), kind: 'link', name: name.trim() || u, url: u, date: NOW.toISOString() }); setName(''); setUrl('') }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" style={{ flex: '1 1 110px', padding: '7px 10px', fontSize: 13 }} />
      <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} placeholder="https://…" style={{ flex: '2 1 200px', padding: '7px 10px', fontSize: 13 }} />
      <button className="btn btn-sm" onClick={submit}><I.plus width={13} height={13} /> {cta}</button>
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
]
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
            <div key={a.id} className="surface" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => toggle(a.id)} title={a.done ? 'Ya la tiene creada' : 'Marcar como creada'} style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (a.done ? 'var(--green)' : 'var(--border-strong)'), background: a.done ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer' }}>{a.done && <I.check width={13} height={13} style={{ color: '#fff' }} />}</button>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-faint)' : 'var(--text)' }}>{a.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: a.done ? 'var(--green)' : 'var(--text-faint)' }}>{a.done ? 'Creada' : 'Falta'}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => remove(a.id)} title="Quitar" style={{ padding: 4, color: 'var(--text-faint)' }}><I.x width={13} height={13} /></button>
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
          <button className="btn btn-accent" onClick={addCustom} disabled={!draft.trim()}><I.plus width={15} height={15} /> Agregar</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{accounts.length ? `${doneCount}/${accounts.length} creadas` : ''}</span>
          <button className="btn btn-accent" onClick={onClose}><I.check width={15} height={15} /> Listo</button>
        </div>
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
    reader.onload = () => { addFile({ id: uid(), kind: 'file', name: f.name, data: reader.result, ext: (f.name.split('.').pop() || '').toLowerCase(), size: f.size, date: NOW.toISOString() }); setBusy(false) }
    reader.onerror = () => setBusy(false)
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const ResourceRow = ({ it, onDelete }) => (
    <div className="surface" style={{ padding: '9px 11px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: it.kind === 'file' ? 'var(--red)' : 'var(--accent)', flexShrink: 0 }}>{it.kind === 'file' ? <I.pdf width={17} height={17} /> : <I.link width={16} height={16} />}</span>
      <a href={it.kind === 'file' ? it.data : it.url} target="_blank" rel="noreferrer" download={it.kind === 'file' ? it.name : undefined} style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</a>
      <a href={it.kind === 'file' ? it.data : it.url} target="_blank" rel="noreferrer" download={it.kind === 'file' ? it.name : undefined} title={it.kind === 'file' ? 'Descargar' : 'Abrir'} className="btn btn-sm btn-ghost" style={{ padding: 6, color: 'var(--text-dim)' }}>{it.kind === 'file' ? <I.download width={15} height={15} /> : <I.ext width={15} height={15} />}</a>
      <button onClick={() => onDelete(it.id)} title="Eliminar" className="btn btn-sm btn-ghost" style={{ padding: 6, color: 'var(--text-faint)' }}><I.x width={14} height={14} /></button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title="Alcance del proyecto" sub={project.name} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Documentos / archivos */}
        <div>
          <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><I.pdf width={14} height={14} /> Documentos del alcance ({files.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {files.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Subí los PDFs/archivos del alcance o pegá un link.</div>}
            {files.map((it) => <ResourceRow key={it.id} it={it} onDelete={delFile} />)}
          </div>
          <input ref={fileRef} type="file" onChange={onFile} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><I.paperclip width={14} height={14} /> {busy ? 'Subiendo…' : 'Subir archivo / PDF'}</button>
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>hasta 1.6 MB — más grande, usá link</span>
          </div>
          <LinkAdder onAdd={addFile} cta="Agregar link" />
        </div>

        <hr className="divider" />

        {/* Llamadas de venta Fathom */}
        <div>
          <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><I.phone width={14} height={14} /> Llamadas de venta (Fathom) ({sales.length})</div>
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

  const deleteClient = (id) => {
    setData((d) => ({ ...d, clients: d.clients.filter((x) => x.id !== id) }))
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
          {onDelete && f.id ? <button className="btn" onClick={() => { if (window.confirm(`¿Eliminar el cliente "${f.name || f.company}"?${activeProjs ? ` Tiene ${activeProjs} proyecto(s) activo(s); esos proyectos no se borran.` : ''} No se puede deshacer.`)) onDelete(f.id) }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I.trash width={15} height={15} /> Eliminar cliente</button> : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onCancel}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => onSave(f)}><I.check width={15} height={15} /> Guardar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Cuentas</div><h1 style={{ fontSize: 32 }}>Clientes</h1></div>
        <button className="btn btn-accent" onClick={() => setCreating(true)}><I.plus width={15} height={15} /> Agregar cliente</button>
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
                <td style={{ padding: '13px 16px', color: 'var(--text-dim)' }}>{fmtDate(c.onboardDate || NOW.toISOString())}</td>
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
          <span style={{ flexShrink: 0, width: 17, height: 17, marginTop: 1, borderRadius: 5, border: '1.5px solid var(--border-strong, var(--border))', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>{it.checked ? <I.check width={12} height={12} /> : null}</span>
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
      <I.link width={16} height={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{link.label || link.url}</div><div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</div></div>
      <I.ext width={14} height={14} style={{ marginLeft: 'auto', color: 'var(--text-faint)', flexShrink: 0 }} />
    </a>
  )
}

function Sops() {
  const { data, setData } = useApp()
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
  const saveProcess = (p) => setData((d) => {
    const list = d.sops.processes; const exists = list.some((x) => x.id === p.id)
    const now = new Date().toISOString()
    const next = exists ? list.map((x) => (x.id === p.id ? { ...p, updatedAt: now } : x)) : [...list, { ...p, id: p.id || ('sop-' + uid()), createdAt: now, updatedAt: now }]
    return { ...d, sops: { ...d.sops, processes: next } }
  })
  const deleteProcess = (id) => setData((d) => ({ ...d, sops: { ...d.sops, processes: d.sops.processes.filter((x) => x.id !== id) } }))
  const saveCategory = (c) => setData((d) => {
    const list = d.sops.categories; const exists = c.id && list.some((x) => x.id === c.id)
    const next = exists ? list.map((x) => (x.id === c.id ? { ...x, name: c.name, parentId: c.parentId } : x)) : [...list, { id: 'sopc-' + uid(), name: c.name, parentId: c.parentId || null, createdAt: new Date().toISOString() }]
    return { ...d, sops: { ...d.sops, categories: next } }
  })
  const deleteCategory = (id) => setData((d) => {
    const cat = d.sops.categories.find((x) => x.id === id); const parent = cat ? (cat.parentId || null) : null
    return { ...d, sops: {
      categories: d.sops.categories.filter((x) => x.id !== id).map((x) => x.parentId === id ? { ...x, parentId: parent } : x),
      processes: d.sops.processes.map((x) => x.categoryId === id ? { ...x, categoryId: parent } : x),
    } }
  })

  const openProc = procs.find((p) => p.id === openId)
  const subFolders = childrenCats(folder)
  const folderProcs = procsIn(folder)
  const crumbs = folder ? pathOf(folder) : []

  const FolderCard = ({ c }) => (
    <div className="surface-hover click" onClick={() => setFolder(c.id)} style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}><I.folder width={20} height={20} /></div>
      <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div><div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{childrenCats(c.id).length + procsIn(c.id).length} elemento(s)</div></div>
      <div className="sop-actions" style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-sm btn-ghost" title="Renombrar" onClick={() => setCatModal({ id: c.id, name: c.name, parentId: c.parentId || null })} style={{ padding: 5 }}><I.pencil width={14} height={14} /></button>
        <button className="btn btn-sm btn-ghost" title="Eliminar carpeta" onClick={() => { if (window.confirm(`¿Eliminar la carpeta "${c.name}"? Su contenido se mueve a la carpeta superior.`)) deleteCategory(c.id) }} style={{ padding: 5, color: 'var(--red)' }}><I.trash width={14} height={14} /></button>
      </div>
    </div>
  )
  const ProcCard = ({ p }) => (
    <div className="surface-hover click" onClick={() => setOpenId(p.id)} style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--card-hover)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text-dim)', flexShrink: 0 }}><I.doc width={19} height={19} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{p.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Actualizado {fmtDate(p.updatedAt || p.createdAt)}</span>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm btn-ghost" title="Editar" onClick={() => setEditProc(p)} style={{ padding: 5 }}><I.pencil width={14} height={14} /></button>
          <button className="btn btn-sm btn-ghost" title="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar el proceso "${p.title}"?`)) deleteProcess(p.id) }} style={{ padding: 5, color: 'var(--red)' }}><I.trash width={14} height={14} /></button>
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
          <button className="btn" onClick={() => setCatModal({ name: '', parentId: folder })}><I.folder width={15} height={15} /> Nueva carpeta</button>
          <button className="btn btn-accent" onClick={() => setEditProc({ id: '', title: '', description: '', categoryId: folder, content: '', links: [], images: [] })}><I.plus width={15} height={15} /> Nuevo proceso</button>
        </div>
      </div>

      {/* toolbar: buscador + toggle vista */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 460 }}>
          <I.search width={15} height={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar procesos…" style={{ paddingLeft: 34 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button className="btn btn-sm btn-ghost" title="Carpetas" onClick={() => setViewMode('folders')} style={{ background: viewMode === 'folders' ? 'var(--card-hover)' : 'transparent', color: viewMode === 'folders' ? 'var(--accent)' : 'var(--text-dim)' }}><I.cards width={15} height={15} /></button>
          <button className="btn btn-sm btn-ghost" title="Tabla" onClick={() => setViewMode('table')} style={{ background: viewMode === 'table' ? 'var(--card-hover)' : 'transparent', color: viewMode === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I.table width={15} height={15} /></button>
        </div>
      </div>

      {/* breadcrumb */}
      {!searching && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16, fontSize: 13.5 }}>
          <button className="row-hover" onClick={() => setFolder(null)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 8, color: folder ? 'var(--text-dim)' : 'var(--text)', fontWeight: 600 }}><I.folder width={14} height={14} /> Inicio</button>
          {crumbs.map((c) => (<React.Fragment key={c.id}><I.chevR width={13} height={13} style={{ color: 'var(--text-faint)' }} /><button className="row-hover" onClick={() => setFolder(c.id)} style={{ padding: '4px 8px', borderRadius: 8, color: c.id === folder ? 'var(--text)' : 'var(--text-dim)', fontWeight: 600 }}>{c.name}</button></React.Fragment>))}
        </div>
      )}
      {searching && <div style={{ marginBottom: 16, fontSize: 13.5, color: 'var(--text-dim)' }}>{searchResults.length} resultado(s) para «{q}»</div>}

      {/* contenido */}
      {(searching ? searchResults.length === 0 : subFolders.length === 0 && folderProcs.length === 0) ? (
        <div className="surface" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)' }}>
          <I.doc width={30} height={30} style={{ opacity: .5 }} />
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
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><I.folder width={16} height={16} style={{ color: 'var(--accent)' }} />{r.c.name}</div></td>
                  <td style={{ padding: '12px 16px' }}><Badge tone="accent">Carpeta</Badge></td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-faint)' }}>—</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-faint)' }}>—</td>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}><div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}><button className="btn btn-sm btn-ghost" onClick={() => setCatModal({ id: r.c.id, name: r.c.name, parentId: r.c.parentId || null })} style={{ padding: 5 }}><I.pencil width={14} height={14} /></button><button className="btn btn-sm btn-ghost" onClick={() => { if (window.confirm(`¿Eliminar la carpeta "${r.c.name}"?`)) deleteCategory(r.c.id) }} style={{ padding: 5, color: 'var(--red)' }}><I.trash width={14} height={14} /></button></div></td>
                </tr>
              ) : (
                <tr key={'p' + r.p.id} className="row-hover click" onClick={() => setOpenId(r.p.id)} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><I.doc width={16} height={16} style={{ color: 'var(--text-dim)' }} />{r.p.title}</div></td>
                  <td style={{ padding: '12px 16px' }}><Badge>Proceso</Badge></td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-dim)' }}>{catById(r.p.categoryId)?.name || 'Sin categoría'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-dim)' }}>{fmtDate(r.p.updatedAt || r.p.createdAt)}</td>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}><div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}><button className="btn btn-sm btn-ghost" onClick={() => setEditProc(r.p)} style={{ padding: 5 }}><I.pencil width={14} height={14} /></button><button className="btn btn-sm btn-ghost" onClick={() => { if (window.confirm(`¿Eliminar el proceso "${r.p.title}"?`)) deleteProcess(r.p.id) }} style={{ padding: 5, color: 'var(--red)' }}><I.trash width={14} height={14} /></button></div></td>
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
              <button className="btn" onClick={() => { setEditProc(openProc); setOpenId(null) }}><I.pencil width={14} height={14} /> Editar</button>
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
        if (newCatName && newCatName.trim()) { cid = 'sopc-' + uid(); setData((d) => ({ ...d, sops: { ...d.sops, categories: [...d.sops.categories, { id: cid, name: newCatName.trim(), parentId: null, createdAt: new Date().toISOString() }] } })) }
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><span className="label">Links / embeds</span><button className="btn btn-sm" onClick={addLink}><I.plus width={13} height={13} /> Agregar link</button></div>
          {f.links.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Loom, YouTube o Vimeo se muestran embebidos; el resto como tarjeta.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{f.links.map((l) => (
              <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" value={l.label} onChange={(e) => setLink(l.id, 'label', e.target.value)} placeholder="Etiqueta" style={{ maxWidth: 180 }} />
                <input className="input mono" value={l.url} onChange={(e) => setLink(l.id, 'url', e.target.value)} placeholder="https://…" style={{ fontSize: 12.5 }} />
                <button className="btn btn-sm btn-ghost" onClick={() => rmLink(l.id)} style={{ padding: 6, color: 'var(--red)' }}><I.trash width={14} height={14} /></button>
              </div>))}</div>
          )}
        </div>

        {/* imágenes */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="label">Imágenes</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}><I.paperclip width={13} height={13} /> Subir<input type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} /></label>
              <button className="btn btn-sm" onClick={addImgUrl}><I.link width={13} height={13} /> Por URL</button>
            </div>
          </div>
          {f.images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
              {f.images.map((im) => (
                <div key={im.id} style={{ position: 'relative' }}>
                  <img src={im.src} alt={im.name || ''} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                  <button className="btn btn-sm" onClick={() => rmImg(im.id)} style={{ position: 'absolute', top: 4, right: 4, padding: 4, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none' }}><I.x width={12} height={12} /></button>
                </div>))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={() => onSave(f, newCat)} disabled={!canSave}><I.check width={15} height={15} /> Guardar proceso</button>
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
          <button className="btn btn-accent" onClick={() => onSave({ ...cat, name: name.trim(), parentId: parentId || null })} disabled={!name.trim()}><I.check width={15} height={15} /> Guardar</button>
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
    setF(call ? { ...call } : { id: uid(), advisor: data.team[0]?.name || '', clientId: data.clients[0]?.id || '', projectId: '', date: NOW.toISOString().slice(0, 10), type: 'onboarding', priority: 'normal', summary: '', transcript: '', fathomUrl: '' })
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
          {!isNew ? <button className="btn" onClick={() => { onDelete(f.id); onClose() }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I.trash width={15} height={15} /> Eliminar</button> : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-accent" onClick={() => { onSave(f); onClose() }}><I.check width={15} height={15} /> Guardar</button>
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
              <button className="btn btn-sm btn-ghost" onClick={() => remove(a.id)} title="Quitar cuenta" style={{ padding: 6, color: 'var(--text-faint)' }}><I.trash width={14} height={14} /></button>
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
          <button className="btn btn-accent" onClick={add} disabled={busy}><I.plus width={15} height={15} /> {busy ? 'Guardando…' : 'Agregar cuenta'}</button>
        </div>
      </div>
    </Modal>
  )
}

function Calls() {
  const { data, setData, logActivity } = useApp()
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
    setData((d) => ({ ...d, calls: d.calls.some((c) => c.id === call.id) ? d.calls.map((c) => (c.id === call.id ? call : c)) : [call, ...d.calls] }))
    if (isNew && logActivity) logActivity({ type: 'call-add', text: `agregó una llamada con ${clientOf(call.clientId)?.company || 'un cliente'}` })
  }
  const deleteCall = (id) => setData((d) => ({ ...d, calls: d.calls.filter((c) => c.id !== id) }))
  const patchManual = (id, fields) => setData((d) => ({ ...d, calls: d.calls.map((c) => c.id === id ? { ...c, ...fields } : c) }))

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
      {on ? <I.check width={11} height={11} /> : <I.x width={11} height={11} />} {label}
    </button>
  )

  return (
    <div className="view" style={{ padding: '28px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div><div className="label" style={{ marginBottom: 6 }}>Soporte & seguimiento</div><h1 style={{ fontSize: 32 }}>Calls</h1></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-accent" onClick={traerCalls} disabled={syncing}><I.refresh width={15} height={15} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} /> {syncing ? 'Trayendo…' : 'Traer calls'}</button>
          <button className="btn" onClick={() => setFathomOpen(true)}><I.phone width={15} height={15} /> Cuentas Fathom {accounts.length ? `(${accounts.length})` : ''}</button>
          <button className="btn" onClick={() => setEditing({ call: null, isNew: true })}><I.plus width={15} height={15} /> Agregar manual</button>
        </div>
      </div>

      {syncMsg && (
        <div className="surface" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, borderColor: syncMsg.error ? 'var(--red)' : 'var(--accent-line)', background: syncMsg.error ? 'var(--red-soft)' : 'var(--bg-elevated)' }}>
          <span style={{ fontSize: 13, color: syncMsg.error ? 'var(--red)' : 'var(--text-dim)', flex: 1 }}>{syncMsg.error ? syncMsg.error : `Se trajeron/actualizaron ${syncMsg.imported} calls de Fathom.${(syncMsg.errors || []).length ? ' Errores: ' + syncMsg.errors.join('; ') : ''}`}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSyncMsg(null)}><I.x width={13} height={13} /></button>
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
        {(typeFilter !== 'all' || asesorFilter !== 'all') && <button className="btn btn-sm btn-ghost" onClick={() => { setTypeFilter('all'); setAsesorFilter('all') }} style={{ color: 'var(--text-dim)' }}><I.x width={13} height={13} /> Limpiar</button>}
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
                    <td style={{ padding: '12px 16px', width: 50 }}>{u.url ? <a href={u.url} target="_blank" rel="noreferrer" title="Ver transcript/resumen en Fathom" style={{ color: 'var(--accent)' }}><I.link width={16} height={16} /></a> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                    <td style={{ padding: '12px 16px 12px 0', width: 40 }}>{u.source === 'manual' && <button className="btn btn-sm btn-ghost" title="Eliminar" onClick={() => { if (window.confirm('¿Eliminar esta llamada?')) deleteCall(u.id) }} style={{ padding: 6, color: 'var(--text-faint)' }}><I.x width={14} height={14} /></button>}</td>
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
          El cliente entra con la contraseña y ve una página de <strong>solo lectura</strong> en tiempo real: dashboard, sprints por semana, tareas y el registro (calls, looms y notas <strong>públicas</strong>). Las notas privadas y lo interno no se muestran.
        </div>
        {!enabled ? (
          <button className="btn btn-accent" onClick={enable} style={{ justifyContent: 'center' }}><I.eye width={15} height={15} /> Activar link para el cliente</button>
        ) : (
          <>
            <Field label="Contraseña de acceso (dásela al cliente)">
              <input className="input" value={project.sharePassword || ''} onChange={(e) => patch((p) => ({ ...p, sharePassword: e.target.value }))} placeholder="ej: real1234" autoFocus />
            </Field>
            <Field label="Link público">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input mono" readOnly value={link} style={{ fontSize: 12 }} onFocus={(e) => e.target.select()} />
                <button className="btn btn-sm" onClick={copy} style={{ flexShrink: 0 }}>{copied ? <I.check width={14} height={14} /> : <I.link width={14} height={14} />} {copied ? 'Copiado' : 'Copiar'}</button>
              </div>
            </Field>
            {!(project.sharePassword || '').trim() && <div style={{ fontSize: 12, color: 'var(--yellow)' }}>⚠ Poné una contraseña — sin ella el cliente no puede entrar.</div>}
            <a href={link} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ justifyContent: 'center' }}><I.ext width={14} height={14} /> Previsualizar como cliente</a>
            <button className="btn btn-sm btn-ghost" onClick={() => patch((p) => ({ ...p, shareEnabled: false }))} style={{ color: 'var(--red)', justifyContent: 'center' }}><I.eyeOff width={14} height={14} /> Desactivar el link</button>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-accent" onClick={onClose}><I.check width={15} height={15} /> Listo</button></div>
      </div>
    </Modal>
  )
}

/* ============================================================================
   15b · AVANCE DEL PLAN — acordeón de semanas con tachado de tareas
   El equipo tacha tareas semana a semana; el % sube y el cliente lo ve en su link
   público en vivo (patchPlan → sync a published_plans en el store). Vínculo
   bidireccional semana↔sprint: completar una semana termina su sprint, y viceversa.
============================================================================ */

/* Checkbox custom con check animado (spring). Naranja/verde según el tema de la app. */
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
        <I.check width={13} height={13} style={{ color: '#0A0A0A' }} />
      </motion.span>
    </span>
  )
}

/* Una semana del acordeón: cabecera colapsable + lista de tareas al expandir. */
function PlanWeekRow({ plan, week, sprint, onToggleTask }) {
  const [open, setOpen] = useState(false)
  const prog = weekProgress(week)
  const complete = prog.total > 0 && prog.pct === 100
  const hito = hitoForWeek(plan, week.n)
  const tasks = Array.isArray(week.tasks) ? week.tasks : []
  const sMeta = sprint ? sprintMeta(sprint.status) : null
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
          <I.chevR width={16} height={16} />
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
        {sMeta && (
          <span className="tag hide-mobile" style={{
            color: sMeta.tone === 'neutral' ? 'var(--text-dim)' : `var(--${sMeta.tone})`,
            background: sMeta.tone === 'neutral' ? 'var(--bg-elevated)' : `var(--${sMeta.tone}-soft)`,
          }}>{sMeta.label}</span>
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
                return (
                  <button key={i} onClick={() => onToggleTask(week.n, i)} className="row-hover" style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
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
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* Sección "Avance del plan": barra global + acordeón de TODAS las semanas del plan
   asociado. Tachar tareas dispara el sync plan→sprint (idempotente, plano). */
function PlanProgress({ project, linkedPlan, patchPlan, patchSprint, onAssociate }) {
  const { logActivity } = useApp()

  if (!linkedPlan) {
    return (
      <section style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Avance del plan</h2>
        <div className="surface" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>Asociá un plan para trackear el avance del cliente</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Vinculá un plan del Planificador y vas a poder tachar tareas semana a semana. El cliente ve el avance en vivo en su link público.
            </div>
          </div>
          <button className="btn btn-accent" onClick={onAssociate}><I.calendar width={15} height={15} /> Asociar un plan</button>
        </div>
      </section>
    )
  }

  const weeks = [...(linkedPlan.weeks || [])].sort((a, b) => (a.n || 0) - (b.n || 0))
  const prog = planProgress(linkedPlan)
  const complete = prog.total > 0 && prog.pct === 100

  // Tachar/destachar una tarea → guarda el plan (síncrono) y sincroniza el sprint apareado.
  const onToggleTask = (weekN, taskIndex) => {
    const updated = patchPlan(linkedPlan.id, (p) => ({
      ...p,
      weeks: (p.weeks || []).map((w) => (w.n === weekN ? toggleTaskDone(w, taskIndex) : w)),
    }))
    if (!updated) return
    const w = (updated.weeks || []).find((x) => x.n === weekN)
    const prg = weekProgress(w)
    const sp = sprintForWeek(project.sprints, weekN)
    if (sp) {
      const st = normSprint(sp.status)
      if (prg.total > 0 && prg.done === prg.total && st !== 'terminado') {
        patchSprint(sp.id, { status: 'terminado' })
        if (logActivity) logActivity({ type: 'sprint-done', text: `terminó el sprint "${sp.name}" de ${project.name}` })
      } else if (prg.done < prg.total && st === 'terminado') {
        patchSprint(sp.id, { status: 'en proceso' })
      }
    }
  }

  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <h2 style={{ fontSize: 19 }}>Avance del plan</h2>
          <span style={{ fontSize: 12.5, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkedPlan.title || 'Plan'}</span>
        </div>
        {linkedPlan.publishedUrl && (
          <a href={linkedPlan.publishedUrl} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ color: 'var(--accent)' }}>
            <I.ext width={14} height={14} /> Ver link del cliente
          </a>
        )}
      </div>

      <div className="surface" style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Progreso general</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="mono" style={{ fontSize: 23, fontWeight: 700, color: complete ? 'var(--green)' : 'var(--accent)', letterSpacing: '-0.02em' }}>{prog.pct}%</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>{prog.done}/{prog.total} tareas</span>
          </span>
        </div>
        <div style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <motion.div initial={false} animate={{ width: `${prog.pct}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%', background: complete ? 'var(--green)' : 'linear-gradient(90deg, var(--accent), #FB923C)', borderRadius: 999 }} />
        </div>
      </div>

      <div>
        {weeks.length === 0 && (
          <div className="surface" style={{ padding: 16, color: 'var(--text-faint)', fontSize: 13 }}>Este plan todavía no tiene semanas.</div>
        )}
        {weeks.map((w) => (
          <PlanWeekRow key={w.n} plan={linkedPlan} week={w} sprint={sprintForWeek(project.sprints, w.n)} onToggleTask={onToggleTask} />
        ))}
      </div>
    </section>
  )
}

function ProjectDetail({ projectId, onBack }) {
  const { data, setData, logActivity, plans, patchPlan, createTask, patchTask } = useApp()
  const project = data.projects.find((p) => p.id === projectId)
  const client = data.clients.find((c) => c.id === project?.clientId)
  const gh = useGithubCommit(project?.githubRepo)
  const [kpiModal, setKpiModal] = useState(null)
  const [kickoffOpen, setKickoffOpen] = useState(true)
  const [editKickoff, setEditKickoff] = useState(false)
  const [openSprintId, setOpenSprintId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [driveOpen, setDriveOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)

  if (!project) return null
  const patch = (fn) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === projectId ? fn(p) : p)) }))
  // Plan asociado (D10: el enlace vive SOLO en plan.publishedUrl; el proyecto solo guarda planId)
  const linkedPlan = (plans || []).find((pl) => pl.id === project.planId) || null
  const associatePlan = (id) => {
    patch((p) => ({ ...p, planId: id || null }))
    if (logActivity) logActivity(id
      ? { type: 'plan-link', text: `asoció un plan a ${project.name}` }
      : { type: 'plan-unlink', text: `desasoció el plan de ${project.name}` })
  }
  const setPlanUrl = (url) => { if (project.planId) patchPlan(project.planId, (pl) => ({ ...pl, publishedUrl: url })) }
  const saveProject = (draft) => patch((p) => ({ ...draft, chats: p.chats }))
  const patchSprint = (sid, fields) => patch((p) => ({ ...p, sprints: p.sprints.map((s) => s.id === sid ? { ...s, ...fields } : s) }))
  // Igual que patchSprint pero, si el estado entra/sale de "terminado", sincroniza la
  // semana apareada del plan (mismo criterio que SprintBoard). Lo usa el modal de detalle.
  const patchSprintSynced = (sid, fields) => {
    const prev = project.sprints.find((s) => s.id === sid)
    patchSprint(sid, fields)
    if (fields.status && linkedPlan && patchPlan) {
      const idx = project.sprints.findIndex((s) => s.id === sid)
      const weekN = (project.sprints[idx] && project.sprints[idx].week) || (idx + 1)
      const nextDone = normSprint(fields.status) === 'terminado'
      const prevDone = normSprint(prev && prev.status) === 'terminado'
      if (nextDone !== prevDone) {
        patchPlan(linkedPlan.id, (p) => ({ ...p, weeks: (p.weeks || []).map((w) => w.n === weekN ? setWeekAllDone(w, nextDone) : w) }))
      }
    }
  }
  const openSprint = project.sprints.find((s) => s.id === openSprintId)
  // tareas del equipo (vienen de la sección Tareas, filtradas por proyecto) y tareas/dependencias del cliente
  const userOf = (id) => (data.team || []).find((u) => u.id === id)
  const teamTasks = (data.tasks || []).filter((t) => t.projectId === projectId)
  const clientTasks = project.clientTasks || []
  const addTeamTask = (name) => createTask({ id: uid(), name, projectId, scope: 'cliente', assigneeId: project.assignments?.dev?.userId || '', priority: 'normal', status: 'pendiente', notes: '', comments: [] })
  const setTeamStatus = (id, status) => patchTask(id, (t) => ({ ...t, status }))
  const addClientTask = (text) => patch((p) => ({ ...p, clientTasks: [...(p.clientTasks || []), { id: uid(), text, done: false, date: new Date().toISOString() }] }))
  const toggleClient = (id) => patch((p) => ({ ...p, clientTasks: (p.clientTasks || []).map((c) => (c.id === id ? { ...c, done: !c.done } : c)) }))
  const delClient = (id) => patch((p) => ({ ...p, clientTasks: (p.clientTasks || []).filter((c) => c.id !== id) }))

  const sprintProgress = calcProgress(project)
  const sprintsTotal = project.sprints.length
  const sprintsDone = project.sprints.filter((s) => normSprint(s.status) === 'terminado').length
  const sprintsProg = project.sprints.filter((s) => normSprint(s.status) === 'en proceso').length
  const kpiDetails = {}

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* LEFT 70% */}
      <div className="scroll-y" style={{ flex: '1 1 70%', padding: '24px 30px 60px', overflowY: 'auto' }}>
        <button className="btn btn-sm btn-ghost" onClick={onBack} style={{ marginBottom: 16, transform: 'scaleX(-1)' }}><I.chevR width={15} height={15} /></button>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 30 }}>{project.name}</h1>
          <PriorityMenu value={project.priority} onChange={(v) => patch((p) => ({ ...p, priority: v }))} size={18} />
          <StatusMenu status={project.status} onChange={(s) => { patch((p) => ({ ...p, status: s })); if (s === 'pending') setPendingPrompt(true) }} />
          {project.status === 'pending' && (project.expectedStartDate
            ? <span onClick={() => setPendingPrompt(true)} style={{ cursor: 'pointer' }}><PendingDateChip date={project.expectedStartDate} /></span>
            : <button className="tag click" onClick={() => setPendingPrompt(true)} style={{ color: 'var(--blue)', background: 'transparent', borderColor: 'var(--blue)' }}><I.calendar width={12} height={12} /> Definir ingreso</button>)}
          <button className="btn btn-sm" onClick={() => setEditOpen(true)} style={{ marginLeft: 'auto' }}><I.pencil width={14} height={14} /> Editar proyecto</button>
        </div>
        <div style={{ color: 'var(--text-dim)', marginBottom: 14, fontSize: 14 }}>{client?.company} · {client?.name} · {project.stack}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <TeamAvatars assignments={project.assignments} team={data.team} onChange={(assignments) => patch((p) => ({ ...p, assignments }))} size={32} ring="var(--bg)" />
          <ProjectTags tags={project.tags} onChange={(tags) => patch((p) => ({ ...p, tags }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
          <a href={project.testingUrl || project.productionUrl || undefined} target="_blank" rel="noreferrer" className="btn btn-sm btn-accent" onClick={(e) => { if (!(project.testingUrl || project.productionUrl)) e.preventDefault() }}><I.ext width={14} height={14} /> Testing</a>
          <a href={project.productionUrl || undefined} target="_blank" rel="noreferrer" className="btn btn-sm" onClick={(e) => { if (!project.productionUrl) e.preventDefault() }}><I.rocket width={14} height={14} /> Producción</a>
          <button className="btn btn-sm" onClick={() => setScopeOpen(true)}><I.pdf width={14} height={14} /> Alcance{(() => { const n = (project.scopeFiles?.length || 0) + (project.salesLinks?.length || 0); return n ? ` · ${n}` : '' })()}</button>
          <button className="btn btn-sm" onClick={() => setDriveOpen(true)} title="Carpeta de Drive compartida con el cliente" style={{ color: project.driveUrl ? 'var(--accent)' : undefined }}><I.folder width={14} height={14} /> Drive</button>
          {(() => { const acc = project.accounts || []; const done = acc.filter((a) => a.done).length; const col = acc.length ? (done === acc.length ? 'var(--green)' : 'var(--accent)') : undefined; return (
            <button className="btn btn-sm" onClick={() => setAccountsOpen(true)} title="Cuentas y accesos que necesita el proyecto (Supabase, GitHub, Vercel…)" style={{ color: col }}><I.key width={14} height={14} /> Cuentas{acc.length ? ` · ${done}/${acc.length}` : ''}</button>
          ) })()}
          <button className="btn btn-sm" onClick={() => setShareOpen(true)} title="Compartir vista con el cliente (link + contraseña)" style={{ color: project.shareEnabled ? 'var(--green)' : undefined }}><I.eye width={14} height={14} /> Compartir</button>
          {linkedPlan && linkedPlan.publishedUrl
            ? <a href={linkedPlan.publishedUrl} target="_blank" rel="noreferrer" className="btn btn-sm" title="Abrir el plan publicado" style={{ color: 'var(--accent)' }}><I.calendar width={14} height={14} /> Plan</a>
            : <button className="btn btn-sm" onClick={() => setPlanOpen(true)} title="Plan de ejecución del proyecto" style={{ color: linkedPlan ? 'var(--accent)' : undefined }}><I.calendar width={14} height={14} /> Plan</button>}
        </div>

        {/* KPI GRID — solo sprints */}
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 30 }}>
          <KpiCard label="Sprints totales" value={sprintsTotal} sub="ver detalle" onClick={() => setKpiModal('progress')} />
          <KpiCard label="Sprints terminados" value={sprintsDone} tone="var(--green)" sub="ver detalle" onClick={() => setKpiModal('progress')} />
          <KpiCard label="Sprints en proceso" value={sprintsProg} tone="var(--accent)" sub="ver detalle" onClick={() => setKpiModal('progress')} />
          <KpiCard label="% Avance" value={`${sprintProgress}%`} tone={pctColor(sprintProgress)} sub="por sprints" onClick={() => setKpiModal('progress')} />
        </motion.div>

        {/* SPRINTS — tabla (drag para reordenar) o kanban */}
        <SprintBoard project={project} patch={patch} onOpenSprint={(id) => setOpenSprintId(id)} linkedPlan={linkedPlan} patchPlan={patchPlan} />

        {/* AVANCE DEL PLAN — acordeón de semanas: tachado + % en vivo para el cliente */}
        <PlanProgress project={project} linkedPlan={linkedPlan} patchPlan={patchPlan} patchSprint={patchSprint} onAssociate={() => setPlanOpen(true)} />

        {/* TAREAS DEL EQUIPO (sincronizadas con Tareas) + DEL CLIENTE (dependencias) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 26 }}>
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Tareas del equipo <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-faint)' }}>· sincronizadas con la sección Tareas</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teamTasks.length === 0 && <div className="surface" style={{ padding: 14, color: 'var(--text-faint)', fontSize: 13 }}>Sin tareas del equipo. Agregá una acá o asignale este proyecto a una tarea en la sección Tareas.</div>}
              {teamTasks.map((t) => (
                <div key={t.id} className="surface" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {t.assigneeId ? <Avatar user={userOf(t.assigneeId)} size={22} ring="var(--card)" /> : <Avatar empty size={22} ring="var(--card)" />}
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, textDecoration: t.status === 'terminado' ? 'line-through' : 'none', color: t.status === 'terminado' ? 'var(--text-faint)' : 'var(--text)' }}>{t.name}</span>
                  <select className="input" value={t.status || 'pendiente'} onChange={(e) => setTeamStatus(t.id, e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}>{TASK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
                </div>
              ))}
              <AddTaskInput onAdd={addTeamTask} />
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Tareas del cliente <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-faint)' }}>· dependencias por hacer</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientTasks.length === 0 && <div className="surface" style={{ padding: 14, color: 'var(--text-faint)', fontSize: 13 }}>Sin dependencias del cliente.</div>}
              {clientTasks.map((c) => (
                <div key={c.id} className="surface" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => toggleClient(c.id)} title="Marcar" style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (c.done ? 'var(--green)' : 'var(--border-strong)'), background: c.done ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{c.done && <I.check width={13} height={13} style={{ color: '#fff' }} />}</button>
                  <span style={{ flex: 1, fontSize: 13.5, textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text-faint)' : 'var(--text)' }}>{c.text}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => delClient(c.id)} style={{ padding: 4, color: 'var(--text-faint)' }}><I.x width={13} height={13} /></button>
                </div>
              ))}
              <AddTaskInput onAdd={addClientTask} />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT 30% — REGISTRO DE ACTIVIDAD (calls · notas · looms) */}
      <ActivityRegistry project={project} patch={patch} />

      {/* KPI MODAL */}
      <Modal open={!!kpiModal} onClose={() => setKpiModal(null)} title="Avance por sprints" width={640}>
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

      <EditProjectModal open={editOpen} project={project} onClose={() => setEditOpen(false)} onSave={saveProject} onDelete={(id) => { setData((dd) => ({ ...dd, projects: dd.projects.filter((p) => p.id !== id) })); onBack() }} />
      <SprintDetailModal open={!!openSprint} sprint={openSprint} team={data.team} defaultId={project.assignments?.dev?.userId || null} onClose={() => setOpenSprintId(null)} onPatch={(fields) => patchSprintSynced(openSprintId, fields)} />
      <PendingDatePrompt open={pendingPrompt} project={project} onClose={() => setPendingPrompt(false)} onSave={(d) => { patch((p) => ({ ...p, expectedStartDate: d })); setPendingPrompt(false) }} />
      <ScopeModal open={scopeOpen} project={project} onClose={() => setScopeOpen(false)} patch={patch} />
      <AccountsModal open={accountsOpen} project={project} onClose={() => setAccountsOpen(false)} patch={patch} />
      <Modal open={driveOpen} onClose={() => setDriveOpen(false)} title="Drive del proyecto" sub={project.name} width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Enlace de Google Drive (compartido con el cliente)">
            <input className="input" value={project.driveUrl || ''} onChange={(e) => patch((p) => ({ ...p, driveUrl: e.target.value }))} placeholder="https://drive.google.com/…" autoFocus />
          </Field>
          {project.driveUrl && <a href={project.driveUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{ justifyContent: 'center' }}><I.ext width={14} height={14} /> Abrir Drive</a>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-accent" onClick={() => setDriveOpen(false)}><I.check width={15} height={15} /> Listo</button></div>
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
                ? <a href={linkedPlan.publishedUrl} target="_blank" rel="noreferrer" className="btn btn-accent" style={{ justifyContent: 'center' }}><I.ext width={14} height={14} /> Abrir plan</a>
                : <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>Este plan todavía no está publicado. Tocá "Publicar" en el Planificador — el enlace va a aparecer acá solo, no hace falta pegarlo a mano.</div>}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>Asociá un plan del Planificador para abrirlo desde acá. Publicalo con el botón "Publicar" del Planificador y el enlace va a quedar vinculado automáticamente.</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-accent" onClick={() => setPlanOpen(false)}><I.check width={15} height={15} /> Listo</button></div>
        </div>
      </Modal>
    </div>
  )
}

/* ============================================================================
   16 · REGISTRO DE ACTIVIDAD DEL PROYECTO (calls · notas · looms)
============================================================================ */
const ACTIVITY_TYPES = [
  { key: 'llamada', label: 'Llamada', color: '#38BDF8', icon: I.phone },
  { key: 'nota', label: 'Nota', color: '#F59E0B', icon: I.comment },
  { key: 'loom', label: 'Loom', color: '#A855F7', icon: I.ext },
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

  return (
    <div style={{ flex: '0 0 34%', minWidth: 300, maxWidth: 460, borderLeft: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}><I.phone width={16} height={16} style={{ color: 'var(--accent)' }} /><strong style={{ fontSize: 15 }}>Registro de actividad</strong></div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Calls, notas y looms del proyecto</div>
      </div>

      <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {ACTIVITY_TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)} className="tag" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', color: type === t.key ? '#fff' : t.color, background: type === t.key ? t.color : t.color + '1f', borderColor: 'transparent' }}><t.icon width={12} height={12} /> {t.label}</button>
          ))}
        </div>
        {type === 'nota' ? (
          <>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribí una nota importante…" style={{ resize: 'none' }} />
            {photos.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{photos.map((s, i) => <div key={i} style={{ position: 'relative' }}><img src={s} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 7, border: '1px solid var(--border)' }} /><button onClick={() => setPhotos((a) => a.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 17, height: 17, borderRadius: 99, background: 'var(--red)', color: '#fff', display: 'grid', placeItems: 'center' }}><I.x width={10} height={10} /></button></div>)}</div>}
          </>
        ) : (
          <input className="input mono" value={link} onChange={(e) => setLink(e.target.value)} placeholder={type === 'loom' ? 'https://loom.com/share/…' : 'https://fathom.video/… (link de la call)'} style={{ fontSize: 12.5 }} />
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
        {type === 'nota' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={() => setPriv(false)} className="tag" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', color: !priv ? 'var(--green)' : 'var(--text-faint)', background: !priv ? 'var(--green-soft)' : 'var(--bg-elevated)', borderColor: !priv ? 'transparent' : 'var(--border)' }}><I.eye width={12} height={12} /> Pública (cliente)</button>
            <button onClick={() => setPriv(true)} className="tag" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', color: priv ? 'var(--accent)' : 'var(--text-faint)', background: priv ? 'var(--accent-soft)' : 'var(--bg-elevated)', borderColor: priv ? 'transparent' : 'var(--border)' }}><I.eyeOff width={12} height={12} /> Privada (equipo)</button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input type="date" className="input mono" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto', padding: '6px 8px', fontSize: 12 }} />
          {type === 'nota' && <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()} title="Adjuntar foto" style={{ padding: '6px 9px' }}><I.paperclip width={14} height={14} /></button>}
          <button className="btn btn-sm btn-accent" onClick={add} style={{ marginLeft: 'auto' }}><I.check width={14} height={14} /> Registrar</button>
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-faint)' }}>Sin registros todavía. Dejá una call, nota o loom arriba.</div>}
        {entries.map((en) => { const m = actTypeMeta(en.type); const u = userOf(en.authorId); return (
          <div key={en.id} className="surface" style={{ padding: 11, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (en.note || (en.photos || []).length || en.link) ? 7 : 0 }}>
              <span className="tag" style={{ color: m.color, background: m.color + '1f', borderColor: 'transparent' }}><m.icon width={11} height={11} /> {m.label}</span>
              {en.type === 'nota' && en.visibility === 'private' && <span className="tag" title="Solo el equipo la ve" style={{ color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'transparent' }}><I.eyeOff width={11} height={11} /> Privada</span>}
              {en.fromCalls && <span className="tag" style={{ color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>desde Calls</span>}
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginLeft: 'auto' }}>{fmtDate(en.date)}</span>
              {!en.fromCalls && <button className="btn btn-sm btn-ghost" onClick={() => del(en.id)} style={{ padding: 3, color: 'var(--text-faint)' }}><I.x width={12} height={12} /></button>}
            </div>
            {en.note && <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>{en.note}</div>}
            {(en.photos || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>{en.photos.map((s, i) => <a key={i} href={s} target="_blank" rel="noreferrer"><img src={s} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 7, border: '1px solid var(--border)' }} /></a>)}</div>}
            {en.link && <a href={en.link} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ marginTop: 8, color: m.color }}><I.ext width={13} height={13} /> Abrir {en.type === 'loom' ? 'Loom' : 'call'}</a>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
              {u ? <Avatar user={u} size={18} ring="var(--card)" /> : null}<span>{u ? u.name : (en.authorName || 'Alguien')}</span>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}

/* ============================================================================
   16b · PROJECT AI CHAT (deprecado — el asistente ahora vive en el menú)
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
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 6, textAlign: 'center' }} className="mono">{CHAT_MODEL} · Enter envía · Shift+Enter salto</div>
      </div>
    </div>
  )
}

/* ============================================================================
   16b · IA ASSISTANT — chat global sobre todos los proyectos y reuniones
============================================================================ */
function buildGlobalSystemPrompt(data) {
  const clientName = (id) => data.clients.find((c) => c.id === id)?.company || '—'
  const projects = (data.projects || []).map((p) => {
    const sprints = (p.sprints || []).map((s) => `    · ${s.name} [${sprintMeta(s.status).label}] est. ${fmtDate(s.estimatedDate)}${s.description ? ` — ${s.description}` : ''}${(s.comments || []).length ? ` (comentarios: ${s.comments.map((c) => c.text).join(' | ')})` : ''}`).join('\n')
    const pa = (p.pendingAgency || []).map((x) => `${x.title} [${x.priority}]`).join('; ') || 'ninguno'
    const pc = (p.pendingClient || []).map((x) => `${x.title} [${x.priority}]`).join('; ') || 'ninguno'
    const risks = (p.risks || []).map((r) => `${r.description} (${r.severity})`).join('; ') || 'ninguno'
    return `### ${p.name} — ${clientName(p.clientId)} · estado ${projStatusMeta(p.status).label} · avance ${calcProgress(p)}%
Stack: ${p.stack || '—'}
Kick-off: ${p.kickoff || '—'}
Sprints:
${sprints || '    (sin sprints)'}
Pendiente agencia: ${pa}
Pendiente cliente: ${pc}
Riesgos: ${risks}`
  }).join('\n\n')
  const calls = (data.calls || []).map((c) => `- [${fmtDate(c.date)}] ${clientName(c.clientId)} · asesor ${c.advisor}
  Resumen: ${c.summary}
  Transcript: ${c.transcript || '(sin transcript)'}`).join('\n\n') || '(sin reuniones cargadas)'
  const team = (data.team || []).map((u) => u.name).join(', ')
  return `Sos el asistente IA de Insights Software, una agencia de desarrollo de software. Tenés acceso COMPLETO a todos los proyectos, sus sprints, pendientes, riesgos y a las reuniones (calls) con transcripciones. Respondé SIEMPRE en español, de forma concisa, clara y accionable. Usá viñetas y datos concretos (estados, %, fechas). Si te preguntan por avances, basate en los sprints (terminado/en proceso/pendiente) y el % de avance. Si te preguntan por reuniones, usá los resúmenes y transcripts. Si falta información, decilo explícitamente.

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
  const { data, setData } = useApp()
  const chats = data.assistantChats || []
  const [activeId, setActiveId] = useState(chats[0]?.id || null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const active = chats.find((c) => c.id === activeId)

  const setChats = (fn) => setData((d) => ({ ...d, assistantChats: fn(d.assistantChats || []) }))
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [active?.messages.length, sending])

  const newChat = () => { const id = uid(); setChats((cs) => [{ id, date: NOW.toISOString(), title: 'Nueva conversación', messages: [] }, ...cs]); setActiveId(id) }

  const sendText = async (text) => {
    text = (text || '').trim()
    if (!text || sending) return
    let chatId = activeId
    if (!chatId) { chatId = uid(); setChats((cs) => [{ id: chatId, date: NOW.toISOString(), title: 'Nueva conversación', messages: [] }, ...cs]); setActiveId(chatId) }
    const prev = (data.assistantChats || []).find((c) => c.id === chatId)?.messages || []
    const userMsg = { role: 'user', content: text, timestamp: Date.now() }
    setChats((cs) => cs.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? (text.length > 42 ? text.slice(0, 42) + '…' : text) : c.title } : c))
    setInput(''); setSending(true); setError(null)
    try {
      const reply = await anthropicChat({ system: buildGlobalSystemPrompt(data), messages: [...prev, userMsg] })
      setChats((cs) => cs.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, { role: 'assistant', content: reply, timestamp: Date.now() }] } : c))
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
          <button className="btn btn-accent" onClick={newChat} style={{ width: '100%', justifyContent: 'center' }}><I.plus width={15} height={15} /> Nueva conversación</button>
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
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'grid', placeItems: 'center', color: 'var(--accent)', margin: '0 auto 16px' }}><I.spark width={26} height={26} /></div>
                <h1 style={{ fontSize: 26, marginBottom: 8 }}>Asistente IA de Insights</h1>
                <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>Preguntá sobre el avance de los proyectos, los sprints, los pendientes<br />y lo que se habló en las reuniones.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 560, margin: '0 auto' }}>
                  {ASSISTANT_SUGGESTIONS.map((s) => (
                    <button key={s} className="surface surface-hover click" onClick={() => sendText(s)} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {active?.messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: m.role === 'user' ? 'var(--border-strong)' : 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Bricolage Grotesque' }}>{m.role === 'user' ? 'Vos' : <I.spark width={15} height={15} />}</div>
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
            <button onClick={() => sendText(input)} disabled={sending || !input.trim()} className="btn-accent" style={{ position: 'absolute', right: 8, bottom: 8, width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', opacity: input.trim() ? 1 : 0.5 }}><I.send width={15} height={15} /></button>
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
        <I.calendar width={13} height={13} />{iso ? fmtDate(value) : 'Fecha límite'}{overdue ? ' ⚠' : ''}
      </button>
      {iso && <button onClick={(e) => { e.stopPropagation(); onChange('') }} title="Quitar fecha" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 3, color: 'var(--text-faint)', background: 'transparent' }}><I.x width={12} height={12} /></button>}
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
            <button type="button" className="btn btn-sm" onClick={() => onPatch({ scope: 'cliente' })} style={{ flex: '1 1 140px', justifyContent: 'center', background: taskScope(task) === 'cliente' ? 'var(--accent-soft)' : 'transparent', color: taskScope(task) === 'cliente' ? 'var(--accent)' : 'var(--text-dim)', borderColor: taskScope(task) === 'cliente' ? 'var(--accent-line)' : 'var(--border)' }}><I.folder width={14} height={14} /> Proyecto de cliente</button>
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
          <button className="btn" onClick={() => { onDelete(task.id); onClose() }} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}><I.trash width={15} height={15} /> Eliminar tarea</button>
          <button className="btn btn-accent" onClick={onClose}><I.check width={15} height={15} /> Listo</button>
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
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: m.color, fontSize: 13, fontWeight: 600 }} title={`Prioridad: ${m.label}`}><I.flag width={15} height={15} />{withLabel && m.label}</span>
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
            <button className="btn btn-sm btn-ghost" onClick={() => setView('table')} title="Tabla" style={{ background: view === 'table' ? 'var(--card-hover)' : 'transparent', color: view === 'table' ? 'var(--accent)' : 'var(--text-dim)' }}><I.table width={15} height={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => setView('kanban')} title="Kanban" style={{ background: view === 'kanban' ? 'var(--card-hover)' : 'transparent', color: view === 'kanban' ? 'var(--accent)' : 'var(--text-dim)' }}><I.kanban width={15} height={15} /></button>
          </div>
          <button className="btn btn-accent" onClick={addTask}><I.plus width={15} height={15} /> Agregar tarea</button>
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
              {tableTasks.map((t) => (
                <tr key={t.id} className="row-hover click" onClick={() => setOpenId(t.id)} style={{ borderBottom: '1px solid var(--border)', opacity: t.status === 'terminado' ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><Assignee id={t.assigneeId} /></td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, textDecoration: t.status === 'terminado' ? 'line-through' : 'none' }}>{t.name}{(t.comments || []).length > 0 && <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text-faint)' }}><I.comment width={11} height={11} />{t.comments.length}</span>}</td>
                  <td style={{ padding: '12px 16px' }}><ScopeTag t={t} /></td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><PrioFlag p={t.priority} withLabel /></td>
                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}><DueDate value={t.dueDate} onChange={(v) => updateTask(t.id, { dueDate: v })} /></td>
                  <td style={{ padding: '8px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <select className="input" value={t.status} onChange={(e) => updateTask(t.id, { status: e.target.value })} style={{ width: 'auto', padding: '6px 8px', fontSize: 13 }}>
                      {TASK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px 12px 0', width: 44 }}><button className="btn btn-sm btn-ghost" title="Eliminar" onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar esta tarea?')) delTask(t.id) }} style={{ padding: 6, color: 'var(--text-faint)' }}><I.x width={15} height={15} /></button></td>
                </tr>
              ))}
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
  const { data, setData } = useApp()
  const team = data.team || []
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const add = () => {
    const n = name.trim(); if (!n) return
    const m = { id: uid(), name: n, email: email.trim(), initials: autoInitials(n), color: AVATAR_COLORS[team.length % AVATAR_COLORS.length], role }
    setData((d) => ({ ...d, team: [...(d.team || []), m] }))
    setName(''); setEmail(''); setRole('')
  }
  const update = (id, fields) => setData((d) => ({ ...d, team: d.team.map((u) => (u.id === id ? { ...u, ...fields } : u)) }))
  const remove = (id) => { if (window.confirm('¿Quitar a esta persona del equipo? Sus asignaciones quedarán sin nadie (no se borran proyectos ni tareas).')) setData((d) => ({ ...d, team: d.team.filter((u) => u.id !== id) })) }
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
              <button className="btn btn-sm btn-ghost" onClick={() => remove(u.id)} title="Quitar del equipo" style={{ padding: 6, color: 'var(--text-faint)' }}><I.trash width={14} height={14} /></button>
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
            <button className="btn btn-accent" onClick={add}><I.plus width={15} height={15} /> Agregar</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 9 }}>
            El <strong>email</strong> tiene que coincidir con el usuario de Supabase para que la persona se reconozca sola al iniciar sesión. Agregar un miembro acá <strong>no</strong> crea su login: eso se hace aparte en Supabase → Authentication.
          </div>
        </div>
      </div>
    </Modal>
  )
}

function UserProfile({ session, myId, setMyId, onLogout, hidden }) {
  const { data, setData } = useApp()
  const [open, setOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
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
  const Placeholder = ({ size, icon = 22 }) => <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg-elevated)', border: '2px dashed var(--border-strong)', color: 'var(--text-faint)' }}><I.users width={icon} height={icon} /></div>

  return (
    <>
      {!hidden && (
        <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.06 }}
          onClick={() => setOpen(true)} title="Mi perfil"
          style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 50, padding: 0, borderRadius: '50%', boxShadow: 'var(--shadow)', background: 'var(--card)' }}>
          {me ? <Avatar user={me} size={48} ring="var(--bg)" /> : <Placeholder size={48} icon={18} />}
        </motion.button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Mi perfil" sub={email || undefined} width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center' }}>
          {me ? <Avatar user={me} size={96} ring="var(--card)" /> : <Placeholder size={96} />}
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-accent" disabled={!me || busy} onClick={() => fileRef.current && fileRef.current.click()}><I.pencil width={14} height={14} /> {busy ? 'Procesando…' : me && me.photo ? 'Cambiar foto' : 'Subir foto'}</button>
            {me && me.photo && <button className="btn btn-ghost" onClick={() => updateMember(me.id, { photo: '' })} style={{ color: 'var(--text-dim)' }}><I.x width={14} height={14} /> Quitar</button>}
          </div>

          <div style={{ width: '100%', textAlign: 'left' }}>
            <Field label="Sos:">
              <select className="input" value={myId || ''} onChange={(e) => setMyId(e.target.value)}>
                <option value="">— Elegí tu nombre —</option>
                {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 7 }}>{me ? 'Tu foto se ve abajo a la derecha y en las tarjetas donde estés asignado.' : 'Elegí tu nombre para poder subir tu foto.'}</div>
            <button className="btn" onClick={() => { setOpen(false); setTeamOpen(true) }} style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}><I.users width={15} height={15} /> Gestionar equipo</button>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            {cloudEnabled && onLogout ? <button className="btn" onClick={onLogout} style={{ color: 'var(--red)' }}><I.ext width={14} height={14} /> Cerrar sesión</button> : <span />}
            <button className="btn btn-accent" onClick={() => setOpen(false)}><I.check width={15} height={15} /> Listo</button>
          </div>
        </div>
      </Modal>
      <TeamManager open={teamOpen} onClose={() => setTeamOpen(false)} />
    </>
  )
}

function Sidebar({ route, setRoute, collapsed, setCollapsed, mobile, open, onClose, email }) {
  const items = [
    { key: 'projects', label: 'Projects', icon: I.folder },
    { key: 'tasks', label: 'Tareas', icon: I.tasks },
    { key: 'clients', label: 'Clients', icon: I.users },
    { key: 'calls', label: 'Calls', icon: I.phone },
    { key: 'sops', label: 'SOP', icon: I.doc },
    { key: 'planner', label: 'Planificador', icon: I.calendar },
    { key: 'assistant', label: 'IA Assistant', icon: I.spark },
    { key: 'bot', label: 'Bot', icon: I.whatsapp },
    { key: 'editor', label: 'Editor', icon: I.film },
  ]
  const mini = !mobile && collapsed          // solo colapsa en desktop
  const go = (key) => { setRoute({ view: key }); if (mobile && onClose) onClose() }
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '18px 16px', height: 64 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: 'Bricolage Grotesque', fontWeight: 800, color: '#fff', fontSize: 17 }}>I</div>
        {!mini && <div style={{ minWidth: 0 }}><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Insights</div><div style={{ fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '.04em' }}>SOFTWARE · OS</div></div>}
        {mobile && <button onClick={onClose} className="btn btn-sm btn-ghost" title="Cerrar" style={{ marginLeft: 'auto', padding: 6 }}><I.x width={16} height={16} /></button>}
      </div>
      <hr className="divider" />
      <nav style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {items.map((it) => {
          const active = route.view === it.key || (route.view === 'project' && it.key === 'projects')
          return (
            <button key={it.key} onClick={() => go(it.key)} title={mini ? it.label : ''}
              className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, color: active ? 'var(--accent)' : 'var(--text-dim)', background: active ? 'var(--accent-soft)' : 'transparent', fontWeight: 600, fontSize: 14, position: 'relative' }}>
              {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 9, background: 'var(--accent)' }} />}
              <it.icon width={18} height={18} style={{ flexShrink: 0 }} />
              {!mini && it.label}
            </button>
          )
        })}
      </nav>
      {!mobile && (
        <>
          <hr className="divider" />
          <button onClick={() => setCollapsed((v) => !v)} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'var(--text-faint)', fontSize: 13 }}>
            <I.panelLeft width={17} height={17} style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }} />{!collapsed && 'Colapsar'}
          </button>
        </>
      )}
    </>
  )

  if (mobile) {
    return createPortal(
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 150, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .25s ease' }} />
        <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 236, zIndex: 151, borderRight: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow)', transform: open ? 'translateX(0)' : 'translateX(-260px)', transition: 'transform .28s cubic-bezier(.16,1,.3,1)' }}>
          {inner}
        </aside>
      </>,
      document.body
    )
  }
  return (
    <motion.aside animate={{ width: collapsed ? 64 : 232 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {inner}
    </motion.aside>
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
    <span title={cloudEnabled ? 'Estado de sincronización con Supabase' : 'Sin Supabase configurado — guardando solo en este navegador'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)', padding: '0 4px' }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: s.c, animation: sync === 'saving' || sync === 'loading' ? 'pulse 1s infinite' : 'none' }} />
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
  const ICONS = { 'call-add': I.phone, 'sprint-add': I.rocket, 'sprint-done': I.check, 'task-add': I.tasks, 'task-done': I.check, 'project-add': I.folder, comment: I.comment, avance: I.folder, comm: I.phone, mention: I.at, reply: I.comment, react: I.comment }
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
      <button ref={btnRef} className="btn btn-sm" onClick={toggle} title="Notificaciones" style={{ padding: 8, position: 'relative' }}>
        <I.bell width={16} height={16} />
        {unread > 0 && <span title={mentionsForMe > 0 ? `${mentionsForMe} mención${mentionsForMe > 1 ? 'es' : ''} para vos` : undefined} style={{ position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 99, background: mentionsForMe > 0 ? 'var(--accent)' : 'var(--red)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'grid', placeItems: 'center', border: '1.5px solid var(--bg-elevated)' }}>{mentionsForMe > 0 ? '@' : (unread > 9 ? '9+' : unread)}</span>}
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div className="surface" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 201, width: 340, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <I.bell width={15} height={15} style={{ color: 'var(--accent)' }} /><strong style={{ fontSize: 14 }}>Actividad</strong>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>{activity.length}</span>
            </div>
            <div className="scroll-y" style={{ overflowY: 'auto', padding: 8 }}>
              {activity.length === 0 && <div style={{ padding: 18, textAlign: 'center', fontSize: 13, color: 'var(--text-faint)' }}>Sin actividad todavía.</div>}
              {activity.map((a) => {
                const u = userOf(a.actorId); const Ico = ICONS[a.type] || I.spark
                const mine = !!a.targetId && a.targetId === myId
                const body = a.type === 'mention'
                  ? (mine ? <span style={{ color: 'var(--text-dim)' }}>te mencionó {a.text}</span>
                          : <span style={{ color: 'var(--text-dim)' }}>mencionó a <strong style={{ color: 'var(--text)' }}>{userOf(a.targetId)?.name || 'alguien'}</strong> {a.text}</span>)
                  : <span style={{ color: 'var(--text-dim)' }}>{a.text}</span>
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 8px', borderRadius: 9, background: mine ? 'var(--accent-soft, var(--bg-elevated))' : 'transparent', border: mine ? '1px solid var(--accent-line)' : '1px solid transparent' }} className="row-hover">
                    {u ? <Avatar user={u} size={28} ring="var(--card)" badge={a.type === 'mention' ? <span style={{ position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: 99, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', border: '1.5px solid var(--card)' }}><I.at width={9} height={9} /></span> : null} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-faint)', flexShrink: 0 }}><Ico width={14} height={14} /></div>}
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
function UpdateButton({ mobile }) {
  const ready = useAppUpdate()
  const [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); await hardRefresh() }
  return (
    <button className="btn btn-sm" onClick={go} disabled={busy}
      title={ready ? `Hay una versión nueva. Tocá para actualizar (recarga + limpia caché). Actual: v${APP_VERSION}` : `App v${APP_VERSION} · recargar y limpiar caché (F5 forzado)`}
      style={ready ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 700 } : { padding: mobile ? 8 : undefined }}>
      <I.refresh width={15} height={15} style={busy ? { animation: 'spin 1s linear infinite' } : {}} />
      {ready ? <span>Actualizar</span> : <span className="hide-mobile mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>v{APP_VERSION}</span>}
    </button>
  )
}

function Header({ theme, setTheme, onSettings, route, sync, onLogout, mobile, onMenu }) {
  const crumb = { overview: 'Overview', projects: 'Projects', tasks: 'Tareas', clients: 'Clients', calls: 'Calls', sops: 'SOP · Procesos', planner: 'Planificador', assistant: 'IA Assistant', editor: 'Editor de video', project: 'Projects / Detalle' }[route.view]
  return (
    <header style={{ height: 64, flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mobile ? '0 12px' : '0 24px', background: 'var(--bg-elevated)', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 13, minWidth: 0 }}>
        {mobile && <button onClick={onMenu} className="btn btn-sm btn-ghost" title="Menú" style={{ padding: 7 }}><I.menu width={18} height={18} /></button>}
        <span className="mono hide-mobile" style={{ color: 'var(--text-faint)' }}>insights-os</span><I.chevR width={14} height={14} className="hide-mobile" style={{ color: 'var(--text-faint)' }} /><strong style={{ color: 'var(--text)' }}>{crumb}</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="hide-mobile"><SyncBadge sync={sync} /></span>
        <UpdateButton mobile={mobile} />
        <NotificationCenter />
        <button className="btn btn-sm btn-ghost" onClick={onSettings} title="Ajustes & API keys">⚙ <span className="hide-mobile" style={{ marginLeft: 2 }}>Ajustes</span></button>
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
                {showPw ? <I.eyeOff width={17} height={17} /> : <I.eye width={17} height={17} />}
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

/* the authenticated app */
function AppShell({ session, onLogout }) {
  const [data, setData, sync] = useAppData()
  const planStore = usePlans()   // { plans, plansReady, createPlan, patchPlan, deletePlan, publishSync, retryPublish }
  const taskStore = useTasks()   // { tasks, tasksReady, createTask, patchTask, deleteTask }
  // Las tareas ya no viven en `data` (app_state), pero muchos componentes leen
  // `data.tasks`. Se las inyectamos como vista de solo lectura; toda MUTACIÓN va
  // por createTask/patchTask/deleteTask (nunca por setData), así no vuelven al blob.
  const dataView = useMemo(() => ({ ...data, tasks: taskStore.tasks }), [data, taskStore.tasks])
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [route, setRoute] = useState({ view: 'projects' })
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState(false)
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
    const email = session.user.email
    const team = data.team || []
    // 1) ya hay un miembro con ese email → vincular
    const byEmail = team.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase())
    if (byEmail) { if (myId !== byEmail.id) setMyId(byEmail.id); return }
    // 2) ya elegiste tu nombre ("Sos:") pero ese miembro no tiene email → completárselo (evita duplicar)
    if (myId) {
      const mine = team.find((u) => u.id === myId)
      if (mine && !mine.email) setData((d) => ({ ...d, team: d.team.map((u) => (u.id === myId ? { ...u, email } : u)) }))
      return
    }
    // 3) nadie coincide → dar de alta al usuario en el equipo desde su sesión de Supabase
    const meta = session.user.user_metadata || {}
    const name = meta.name || meta.full_name || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const nid = uid()
    setData((d) => ({ ...d, team: [...(d.team || []), { id: nid, name, email, initials: autoInitials(name), color: AVATAR_COLORS[(d.team || []).length % AVATAR_COLORS.length] }] }))
    setMyId(nid)
  }, [session, data.team, myId])

  const openProject = (id) => setRoute({ view: 'project', projectId: id })
  const logActivity = (entry) => setData((d) => {
    const nacho = (d.team || []).find((u) => /nacho/i.test(u.name || '') || String(u.email || '').toLowerCase() === 'nachocachaza@insightsapps.tech')
    const actorId = localStorage.getItem('my_team_id') || (nacho ? nacho.id : '')
    return { ...d, activity: [{ id: uid(), date: new Date().toISOString(), actorId, ...entry }, ...(d.activity || [])].slice(0, 200) }
  })

  // pop-up de inicio para el PM con el estado de seguimiento de sus proyectos
  const [pmAlertSeen, setPmAlertSeen] = useState(false)
  const pmProjects = (data.projects || []).filter((p) => myId && p.assignments?.pm?.userId === myId && p.status === 'active')

  // El editor de video vive en un iframe cuyo estado (clips, cortes, subtítulos,
  // transcripción Whisper) existe solo en la memoria de ese documento: desmontarlo
  // al cambiar de pestaña lo recarga y pierde todo. Una vez abierto, queda montado
  // fuera del switch de vistas y se oculta con display:none. El ref evita pagar la
  // carga del bundle del editor si el usuario nunca abre esa pestaña.
  const editorEverOpenedRef = useRef(route.view === 'editor')
  if (route.view === 'editor') editorEverOpenedRef.current = true

  return (
    <AppCtx.Provider value={{ data: dataView, setData, logActivity, supabase, ...planStore, ...taskStore }}>
      <div className="app-shell">
        <Sidebar route={route} setRoute={setRoute} collapsed={collapsed} setCollapsed={setCollapsed} mobile={isMobile} open={navOpen} onClose={() => setNavOpen(false)} email={session?.user?.email} />
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
        <Settings open={settings} onClose={() => setSettings(false)} />
        <UserProfile session={session} myId={myId} setMyId={setMyId} onLogout={onLogout} hidden={route.view === 'project'} />
        <PmStartupAlert open={!pmAlertSeen && pmProjects.length > 0} projects={pmProjects} clients={data.clients} onClose={() => setPmAlertSeen(true)} onOpenProject={openProject} />
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
      const { data: res, error } = await supabase.functions.invoke('project-share-', { body: { shareId, password } })
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
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '30px 22px 70px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque', fontWeight: 800, color: '#fff', fontSize: 15 }}>I</div>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>Seguimiento en tiempo real · solo lectura</span>
        </div>
        <h1 style={{ fontSize: 30 }}>{p.name}</h1>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 22 }}>{p.client}{p.stack ? ` · ${p.stack}` : ''}</div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          {stat('Sprints totales', p.kpis.total)}
          {stat('Terminados', p.kpis.done, 'var(--green)')}
          {stat('En proceso', p.kpis.inProc, 'var(--accent)')}
          {stat('% Avance', p.kpis.progress + '%', pctColor(p.kpis.progress))}
        </div>

        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Sprints</h2>
        <div className="surface tbl" style={{ overflow: 'auto', marginBottom: 28 }}>
          <table>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['#', 'Nombre', 'Semana', 'Asignado', 'Estado', 'Estimada'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>
              {(p.sprints || []).map((s, i) => { const m = sprintMeta(s.status); const inProc = s.status === 'en proceso'; return (
                <tr key={s.id || i} style={{ borderBottom: '1px solid var(--border)', borderLeft: inProc ? '3px solid var(--accent)' : '3px solid transparent', background: inProc ? 'var(--accent-soft)' : 'transparent', opacity: s.status === 'terminado' ? 0.6 : 1 }}>
                  <td style={{ padding: '11px 14px' }} className="mono">{i + 1}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: 13.5 }}>{s.name}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>Sem {s.week || (i + 1)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>{(s.assignees || []).join(', ') || '—'}</td>
                  <td style={{ padding: '11px 14px' }}><span className="tag" style={{ color: `var(--${m.tone === 'neutral' ? 'text-dim' : m.tone === 'accent' ? 'accent' : m.tone})`, background: m.tone === 'neutral' ? 'var(--bg-elevated)' : `var(--${m.tone}-soft)`, borderColor: 'transparent' }}>{m.label}</span></td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-dim)' }} className="mono">{s.date ? fmtDate(s.date) : '—'}</td>
                </tr>
              )})}
              {(p.sprints || []).length === 0 && <tr><td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Sin sprints todavía.</td></tr>}
            </tbody>
          </table>
        </div>

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
              {(p.clientTasks || []).map((c, i) => <div key={i} className="surface" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5 }}><span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid ' + (c.done ? 'var(--green)' : 'var(--border-strong)'), background: c.done ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{c.done && <I.check width={12} height={12} style={{ color: '#fff' }} />}</span><span style={{ textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text-faint)' : 'var(--text)' }}>{c.text}</span></div>)}
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
              {en.link && <a href={en.link} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ marginTop: 8, color: m.color }}><I.ext width={13} height={13} /> Abrir {en.type === 'loom' ? 'Loom' : 'call'}</a>}
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

  if (onbStep) return <OnboardingLanding step={onbStep} supabase={supabase} cloudEnabled={cloudEnabled} />
  if (shareId) return <ClientView shareId={shareId} />
  if (cloudEnabled && session === undefined) return <CenterScreen>Cargando…</CenterScreen>
  if (cloudEnabled && !session) return <Login />
  return <AppShell session={session} onLogout={cloudEnabled ? () => supabase.auth.signOut() : null} />
}
