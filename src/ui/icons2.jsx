/* ============================================================================
   ICONS2 — set duotono "Insights OS"
   Dibujo propio (no @phosphor-icons/react), inspirado en el peso "duotone" de
   Phosphor Icons (MIT): trazo lineal 1.5 + una capa de relleno del mismo
   currentColor a opacity .18 sobre la masa principal de cada forma. Ver
   ICONS_META al final del archivo.

   Drop-in compatible con `I` de src/ui.jsx: mismas claves, misma firma
   `(p) => <svg ... {...p}/>`, color heredado vía currentColor.
============================================================================ */

const W = '1.5'

export const I2 = {
  /* ---------- layout / navegación ---------- */
  grid: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <g fill="currentColor" opacity=".18" stroke="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </g>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  panelLeft: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>
    </svg>
  ),
  table: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>
    </svg>
  ),
  cards: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <g fill="currentColor" opacity=".18" stroke="none">
        <rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/>
        <rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>
      </g>
      <rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/>
      <rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>
    </svg>
  ),
  kanban: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <g fill="currentColor" opacity=".18" stroke="none">
        <rect x="3" y="4" width="5" height="16" rx="1.3"/><rect x="9.5" y="4" width="5" height="11" rx="1.3"/><rect x="16" y="4" width="5" height="14" rx="1.3"/>
      </g>
      <rect x="3" y="4" width="5" height="16" rx="1.3"/><rect x="9.5" y="4" width="5" height="11" rx="1.3"/><rect x="16" y="4" width="5" height="14" rx="1.3"/>
    </svg>
  ),
  gantt: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <g fill="currentColor" opacity=".18" stroke="none">
        <rect x="3" y="5" width="10" height="4" rx="1.3"/><rect x="7" y="10.5" width="14" height="4" rx="1.3"/><rect x="3" y="16" width="8" height="4" rx="1.3"/>
      </g>
      <rect x="3" y="5" width="10" height="4" rx="1.3"/><rect x="7" y="10.5" width="14" height="4" rx="1.3"/><rect x="3" y="16" width="8" height="4" rx="1.3"/>
    </svg>
  ),
  menu: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 7h16M4 12h16M4 17h16"/>
    </svg>
  ),
  layers: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m12 2 9 5-9 5-9-5 9-5z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>
    </svg>
  ),

  /* ---------- entidades del producto ---------- */
  folder: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>
  ),
  users: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="8" r="3.2" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/>
      <path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 20a5.3 5.3 0 0 0-3-4.8"/>
    </svg>
  ),
  user: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="3.6" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>
    </svg>
  ),
  phone: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 5c0-1 .8-2 2-2h1.6a1 1 0 0 1 1 .8l.8 3a1 1 0 0 1-.3 1l-1.4 1.3a13 13 0 0 0 5.2 5.2l1.3-1.4a1 1 0 0 1 1-.3l3 .8a1 1 0 0 1 .8 1V19c0 1.2-1 2-2 2A16 16 0 0 1 4 5z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M4 5c0-1 .8-2 2-2h1.6a1 1 0 0 1 1 .8l.8 3a1 1 0 0 1-.3 1l-1.4 1.3a13 13 0 0 0 5.2 5.2l1.3-1.4a1 1 0 0 1 1-.3l3 .8a1 1 0 0 1 .8 1V19c0 1.2-1 2-2 2A16 16 0 0 1 4 5z"/>
    </svg>
  ),
  calendar: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>
    </svg>
  ),
  comment: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>
    </svg>
  ),
  bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
    </svg>
  ),
  at: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>
    </svg>
  ),
  mail: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>
    </svg>
  ),
  globe: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>
    </svg>
  ),
  database: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" fill="currentColor" opacity=".18" stroke="none"/>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3"/>
      <path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>
    </svg>
  ),
  server: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <g fill="currentColor" opacity=".18" stroke="none"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/></g>
      <rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>
      <circle cx="7" cy="7.5" r=".9" fill="currentColor" stroke="none"/><circle cx="7" cy="16.5" r=".9" fill="currentColor" stroke="none"/>
    </svg>
  ),
  card: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6 15h4"/>
    </svg>
  ),
  key: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="7.5" cy="15.5" r="4.5" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M17 6l3 3M14.5 8.5l2.5 2.5"/>
    </svg>
  ),
  lock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  ),

  /* ---------- acciones ---------- */
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 13l4 4L19 7"/></svg>,
  chevR: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 6 6 6-6 6"/></svg>,
  chevD: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  arrowRight: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 12h14M13 6l6 6-6 6"/></svg>,
  ext: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>,
  link: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 14a4 4 0 0 0 5.6 0l2.8-2.8a4 4 0 0 0-5.6-5.6L11 7"/><path d="M14 10a4 4 0 0 0-5.6 0L5.6 12.8a4 4 0 0 0 5.6 5.6L13 17"/></svg>,
  send: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 2l-7 20-4-9-9-4z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>
    </svg>
  ),
  search: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
    </svg>
  ),
  filter: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 5h16l-6 7v6l-4 2v-8z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M4 5h16l-6 7v6l-4 2v-8z"/>
    </svg>
  ),
  refresh: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>,
  pencil: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>
    </svg>
  ),
  trash: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6.5 7 17.5 7 16.6 20a1 1 0 0 1-1 1H8.4a1 1 0 0 1-1-1z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>
    </svg>
  ),
  pause: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <g fill="currentColor" opacity=".18" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></g>
      <rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>
    </svg>
  ),
  copy: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  download: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>,
  paperclip: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>,
  grip: (p) => <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>,
  eye: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  eyeOff: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17.9 17.9A10.7 10.7 0 0 1 12 19c-7 0-11-7-11-7a19 19 0 0 1 5.1-5.9m3.3-1.6A10.7 10.7 0 0 1 12 5c7 0 11 7 11 7a19 19 0 0 1-2.2 3.2M9.9 4.2 21 21"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>,
  eyeAll: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M1 10.5s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M1 10.5s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="11" cy="10.5" r="2.6"/>
      <circle cx="19" cy="19" r="1" fill="currentColor" stroke="none"/><circle cx="22" cy="19" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="22" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  gear: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),

  /* ---------- estado / feedback ---------- */
  clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>
    </svg>
  ),
  alert: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3 2 20h20L12 3z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/>
    </svg>
  ),
  flag: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 4h12l-2.4 3.5L17 11H5z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M5 21V4"/><path d="M5 4h12l-2.4 3.5L17 11H5z"/>
    </svg>
  ),
  tasks: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 6h2l1 1 2-2M4 12h2l1 1 2-2M4 18h2l1 1 2-2M13 6h7M13 12h7M13 18h7"/></svg>,
  spark: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M18 18l-2.5-2.5M18 6l-2.5 2.5M6 18l2.5-2.5"/><circle cx="12" cy="12" r="2.4"/>
    </svg>
  ),
  sparkle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3c0 4-1 7-4 9 3 2 4 5 4 9 0-4 1-7 4-9-3-2-4-5-4-9z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M12 3c0 4-1 7-4 9 3 2 4 5 4 9 0-4 1-7 4-9-3-2-4-5-4-9z"/>
    </svg>
  ),
  pulse: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="2" y="5" width="20" height="14" rx="3"/>
      <path d="M4.5 12h3l1.7-4.5L12 16l2-6 1.3 2.5h3.2"/>
    </svg>
  ),
  circleDash: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="9" strokeDasharray="4.2 4.2"/>
    </svg>
  ),
  phase1: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="9"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="inherit" stroke="none" fill="currentColor">1</text>
    </svg>
  ),
  phase2: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="9"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="inherit" stroke="none" fill="currentColor">2</text>
    </svg>
  ),
  phase3: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="9"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="inherit" stroke="none" fill="currentColor">3</text>
    </svg>
  ),

  rocket: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <g fill="currentColor" opacity=".18" stroke="none">
        <path d="M9 13a14 14 0 0 1 8-9c3 0 3 0 3 3a14 14 0 0 1-9 8z"/>
        <path d="M5 15c-1.5 1-2 5-2 5s4-.5 5-2c.6-.9.5-2.1-.3-2.8A2 2 0 0 0 5 15z"/>
      </g>
      <path d="M5 15c-1.5 1-2 5-2 5s4-.5 5-2c.6-.9.5-2.1-.3-2.8A2 2 0 0 0 5 15z"/>
      <path d="M9 13a14 14 0 0 1 8-9c3 0 3 0 3 3a14 14 0 0 1-9 8z"/>
      <circle cx="15" cy="9" r="1.4"/><path d="M9 13l-2-2M11 15l2 2"/>
    </svg>
  ),

  /* ---------- documentos / medios ---------- */
  doc: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 2h8l4 4v16H6z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 13h6M9 17h6M9 9h2"/>
    </svg>
  ),
  pdf: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>
      <rect x="7" y="13" width="8" height="5" rx="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  film: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" opacity=".18" stroke="none"/>
      <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>
    </svg>
  ),

  /* ---------- tema / visibilidad ---------- */
  sun: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity=".18" stroke="none"/>
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>
    </svg>
  ),
  moon: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" opacity=".18" stroke="none"/>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>
    </svg>
  ),

  /* ---------- marcas de terceros: forma oficial sólida, sin duotono ---------- */
  github: (p) => <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>,
  whatsapp: (p) => <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}><path d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2zm5.6 14.1c-.24.67-1.4 1.28-1.94 1.33-.5.05-1.03.24-3.5-.75-2.96-1.18-4.86-4.18-5-4.38-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.6-.37.8-.37h.57c.18 0 .43-.03.66.5.24.55.8 1.94.87 2.08.07.14.11.3.02.49-.09.19-.14.3-.27.46-.14.17-.29.37-.41.5-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.61-.07.16-.19.7-.82.89-1.1.19-.28.37-.23.62-.14.25.1 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.66-.17 1.33z"/></svg>,

  /* ---------- claves duplicadas de layout (mantener nombres del set original) ---------- */
}

/* ============================================================================
   ICONS_META
============================================================================ */
export const ICONS_META = {
  version: '1.0.0',
  style: 'duotone',
  // Dibujo propio inspirado en el peso "duotone" de Phosphor Icons (MIT,
  // phosphoricons.com) — no se usó el paquete @phosphor-icons/react; ver
  // src/ui/icons2-gallery.jsx / comentario de decisión en la entrega del agente.
  source: 'hand-drawn, phosphor-duotone-inspired (MIT reference: phosphoricons.com), grid 24x24, stroke 1.5, fill opacity .18',
}
