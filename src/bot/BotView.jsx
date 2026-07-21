/* ============================================================================
   BotView.jsx — sección "Bot" del OS: el bot de WhatsApp que vigila los grupos
   de clientes (Evolution API + worker en Render, datos en Supabase).

   4 pestañas: Resumen (estado + stats) · Conversaciones (chats en vivo) ·
   Grupos (mapeo grupo↔proyecto, activo, umbral) · Avisos (log de alertas).

   Convención de la app: clases utilitarias de GLOBAL_CSS + style inline con
   var(--token). Sin punto y coma, comillas simples, framer-motion.
   Data: wa_status / wa_groups / wa_messages / wa_alerts (SELECT authenticated,
   UPDATE de wa_groups habilitado por policy). Media en bucket privado wa-media
   → signed URLs cacheadas en memoria.
============================================================================ */
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { I, useApp, Modal, stagger, rise } from '../ui.jsx'

/* ----------------------------------------------------------------------------
   Helpers de tiempo (es-AR, relativo cuando es reciente)
---------------------------------------------------------------------------- */
const MIN = 60000
const HOUR = 3600000
const DAY = 86400000

const fmtRel = (iso, now = Date.now()) => {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = now - t
  if (diff < MIN) return 'recién'
  if (diff < HOUR) return `hace ${Math.floor(diff / MIN)} min`
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`
  const days = Math.floor(diff / DAY)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

const fmtHora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '')

/* "Hoy" / "Ayer" / "15 de julio" — para los separadores del chat */
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
const dayLabel = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(today.getTime() - DAY)
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, today)) return 'Hoy'
  if (same(d, yest)) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}

/* color estable por remitente / grupo (para avatares y nombres en burbujas) */
const SENDER_HUES = ['#60A5FA', '#34D399', '#A78BFA', '#F472B6', '#FBBF24', '#2DD4BF', '#FB923C', '#818CF8']
const senderColor = (jid) => { let h = 0; const s = jid || ''; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return SENDER_HUES[h % SENDER_HUES.length] }

const initialsOf = (s) => ((s || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()) || '?'

/* tipos de media sin archivo (mensajes viejos) → chip gris */
const MEDIA_LABELS = { image: '📷 Imagen', video: '🎬 Video', audio: '🎙️ Audio', ptt: '🎙️ Audio', voice: '🎙️ Audio', sticker: '✨ Sticker', document: '📄 Documento' }

/* mobile (mismo breakpoint que la app) */
function useIsMobile(bp = 760) {
  const q = `(max-width:${bp}px)`
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on)
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on) }
  }, [bp])
  return m
}

/* ----------------------------------------------------------------------------
   Estilos propios de la sección (hover/press/ping — lo que inline no puede)
---------------------------------------------------------------------------- */
const BOT_CSS = `
.bw-item{transition:background .16s,border-color .16s}
.bw-item:hover{background:var(--card-hover)}
.bw-press{transition:transform .16s cubic-bezier(.22,1,.36,1)}
.bw-press:active{transform:scale(.97)}
.bw-stat{transition:transform .28s cubic-bezier(.22,1,.36,1),border-color .2s,box-shadow .28s}
.bw-stat:hover{transform:translateY(-2px);border-color:var(--border-strong);box-shadow:var(--shadow)}
.bw-chip{transition:border-color .16s,background .16s,transform .18s cubic-bezier(.22,1,.36,1)}
.bw-chip:hover{border-color:var(--accent-line);transform:translateY(-1px)}
.bw-chip:active{transform:translateY(0) scale(.98)}
.bw-chatbg{background-image:radial-gradient(var(--grid) 1px,transparent 1px);background-size:18px 18px}
.bw-img{transition:transform .3s cubic-bezier(.22,1,.36,1),filter .3s}
.bw-img:hover{transform:scale(1.012);filter:brightness(1.05)}
.bw-scroll::-webkit-scrollbar{width:8px}
.bw-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px}
.bw-scroll::-webkit-scrollbar-thumb:hover{background:var(--border-strong)}
.bw-tbl tr:last-child td{border-bottom:none}
@keyframes bw-ping{0%{transform:scale(1);opacity:.65}80%,100%{transform:scale(2.4);opacity:0}}
`
const Css = () => <style>{BOT_CSS}</style>

/* ----------------------------------------------------------------------------
   Piezas chicas reutilizadas en toda la sección
---------------------------------------------------------------------------- */

/* avatar cuadrado-redondeado con tinte estable por jid */
function GAvatar({ name, jid, size = 38, radius, style }) {
  const c = senderColor(jid || name)
  return (
    <div style={{
      width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3), flexShrink: 0,
      display: 'grid', placeItems: 'center', background: c + '1C', border: '1px solid ' + c + '2E',
      color: c, fontSize: Math.round(size * 0.34), fontWeight: 700, letterSpacing: '.02em', userSelect: 'none', ...style,
    }}>{initialsOf(name)}</div>
  )
}

/* punto de estado, con anillo expansivo opcional */
const Dot = ({ tone, ping, size = 9 }) => (
  <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
    <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: `var(--${tone})` }} />
    {ping && <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: `var(--${tone})`, animation: 'bw-ping 2.4s cubic-bezier(0,0,.2,1) infinite' }} />}
  </span>
)

/* ícono grande dentro de un "bisel" — para empty states */
const EmptyIcon = ({ icon: Ico }) => (
  <div style={{ width: 62, height: 62, borderRadius: 19, background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
    <Ico width={24} height={24} style={{ color: 'var(--text-faint)' }} />
  </div>
)

const Skel = ({ h = 16, w = '100%', r = 12, style }) => <div className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />

/* ============================================================================
   VISTA PRINCIPAL
============================================================================ */
export default function BotView() {
  const { data, supabase } = useApp()
  const isMobile = useIsMobile()
  const projects = data.projects || []
  const clients = data.clients || []

  const [tab, setTab] = useState('resumen')
  const [status, setStatus] = useState(null)          // fila wa_status id='main'
  const [groups, setGroups] = useState([])            // wa_groups (todos)
  const [alerts, setAlerts] = useState([])            // wa_alerts últimos 50
  const [recent, setRecent] = useState([])            // últimos ~300 wa_messages (desc)
  const [todayCount, setTodayCount] = useState(null)  // count exacto de mensajes de hoy
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedJid, setSelectedJid] = useState(null)
  const [chatMsgs, setChatMsgs] = useState([])        // mensajes del grupo abierto (asc)
  const [chatLoading, setChatLoading] = useState(false)
  const [imageOpen, setImageOpen] = useState(null)    // url de imagen para el modal
  const [now, setNow] = useState(Date.now())          // tick p/ tiempos relativos + pill
  const selectedRef = useRef(null)
  const urlCache = useRef(new Map())                  // path → signed URL (1h)
  selectedRef.current = selectedJid

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(iv) }, [])

  /* ---- carga inicial (paralela) ---- */
  const loadAll = async () => {
    if (!supabase) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [st, gr, al, ms, cnt] = await Promise.all([
      supabase.from('wa_status').select('*').eq('id', 'main').maybeSingle(),
      supabase.from('wa_groups').select('*'),
      supabase.from('wa_alerts').select('*').order('sent_at', { ascending: false }).limit(50),
      supabase.from('wa_messages').select('*').order('wa_timestamp', { ascending: false }).limit(300),
      supabase.from('wa_messages').select('id', { count: 'exact', head: true }).gte('wa_timestamp', today.toISOString()),
    ])
    if (!st.error) setStatus(st.data || null)
    if (!gr.error) setGroups(gr.data || [])
    if (!al.error) setAlerts(al.data || [])
    if (!ms.error) setRecent(ms.data || [])
    if (!cnt.error) setTodayCount(cnt.count ?? null)
    setLoading(false)
  }
  const refresh = async () => { setRefreshing(true); try { await loadAll() } finally { setRefreshing(false) } }
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let alive = true
    ;(async () => { try { await loadAll() } catch (e) { if (alive) setLoading(false) } })()

    /* realtime: mensajes nuevos + heartbeat del worker */
    const channel = supabase
      .channel('wa-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_messages' }, (payload) => {
        const m = payload.new
        if (!m) return
        setRecent((rs) => [m, ...rs].slice(0, 300))
        setTodayCount((c) => (c == null ? c : c + 1))
        if (m.group_jid === selectedRef.current) setChatMsgs((cs) => (cs.some((x) => x.id === m.id) ? cs : [...cs, m]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wa_status' }, (payload) => {
        if (payload.new && payload.new.id === 'main') setStatus(payload.new)
      })
      /* grupo nuevo (el bot lo detecta apenas lo agregan, sin esperar un mensaje) */
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_groups' }, (payload) => {
        const g = payload.new
        if (!g) return
        setGroups((gs) => (gs.some((x) => x.group_jid === g.group_jid) ? gs : [...gs, g]))
      })
      /* mapeo/activo/umbral tocado por otro usuario, o el bot completó el auto-match */
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wa_groups' }, (payload) => {
        const g = payload.new
        if (!g) return
        setGroups((gs) => gs.map((x) => (x.group_jid === g.group_jid ? g : x)))
      })
      .subscribe()
    return () => { alive = false; supabase.removeChannel(channel) }
  }, [supabase])

  /* ---- helpers de dominio ---- */
  const projOf = (id) => projects.find((p) => p.id === id)
  const groupTitle = (g) => {
    if (!g) return '—'
    const p = g.project_id && projOf(g.project_id)
    if (p) return p.name
    if (g.group_name) return g.group_name
    const jid = (g.group_jid || '').replace(/@g\.us$/, '')
    return jid.length > 16 ? jid.slice(0, 16) + '…' : jid || '—'
  }
  /* días sin respuesta del equipo si superó el umbral (solo grupos activos) */
  const overdueDays = (g) => {
    if (!g || !g.active || !g.last_team_msg_at) return null
    const days = Math.floor((now - new Date(g.last_team_msg_at).getTime()) / DAY)
    const thr = g.inactivity_threshold_days ?? 3
    return days > thr ? days : null
  }

  /* estado del bot: verde = conectado y con latido fresco · ámbar = worker mudo · rojo = WA caído */
  const hb = status?.last_heartbeat_at ? new Date(status.last_heartbeat_at).getTime() : null
  const hbFresh = hb != null && now - hb < 12 * MIN
  const st = !hbFresh
    ? { tone: 'yellow', label: 'Worker sin señal', short: 'Sin señal', desc: 'El worker no manda latidos hace más de 12 minutos.' }
    : status?.connection_state !== 'open'
      ? { tone: 'red', label: 'WhatsApp desconectado', short: 'Desconectado', desc: 'El worker está vivo pero la sesión de WhatsApp no está abierta.' }
      : { tone: 'green', label: 'Bot operativo', short: 'Operativo', desc: 'Conectado a WhatsApp y procesando mensajes.' }

  /* último mensaje por grupo (del pool de recientes) */
  const lastByGroup = useMemo(() => {
    const map = new Map()
    recent.forEach((m) => { if (!map.has(m.group_jid)) map.set(m.group_jid, m) })
    return map
  }, [recent])

  /* update optimista de wa_groups (policy UPDATE authenticated) */
  const patchGroup = async (jid, fields) => {
    const prev = groups
    setGroups((gs) => gs.map((g) => (g.group_jid === jid ? { ...g, ...fields } : g)))
    const { error } = await supabase.from('wa_groups').update({ ...fields, updated_at: new Date().toISOString() }).eq('group_jid', jid)
    if (error) setGroups(prev)
  }

  /* abrir un grupo → cargar sus últimos 200 mensajes */
  const openGroup = async (jid) => {
    setSelectedJid(jid)
    setChatLoading(true)
    setChatMsgs([])
    const { data: ms, error } = await supabase
      .from('wa_messages').select('*').eq('group_jid', jid)
      .order('wa_timestamp', { ascending: false }).limit(200)
    if (!error) setChatMsgs((ms || []).slice().reverse())
    setChatLoading(false)
  }

  /* ---- sin Supabase: empty state ---- */
  if (!supabase) {
    return (
      <div className="view" style={{ padding: '28px 34px 60px', height: '100%', overflowY: 'auto' }}>
        <Css />
        <div className="label" style={{ marginBottom: 6 }}>WhatsApp</div>
        <h1 style={{ fontSize: 32, marginBottom: 24 }}>Bot</h1>
        <div className="surface" style={{ padding: 48, textAlign: 'center', maxWidth: 520 }}>
          <EmptyIcon icon={I.whatsapp} />
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>El bot necesita conexión a Supabase</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>Configurá las variables de entorno de Supabase para ver los grupos, las conversaciones y los avisos del bot.</div>
        </div>
      </div>
    )
  }

  const overdueCount = groups.filter((g) => overdueDays(g)).length
  const TABS = [
    { key: 'resumen', label: 'Resumen', short: 'Resumen', icon: I.grid },
    { key: 'chats', label: 'Conversaciones', short: 'Chats', icon: I.comment },
    { key: 'grupos', label: 'Grupos', short: 'Grupos', icon: I.users },
    { key: 'avisos', label: 'Avisos', short: 'Avisos', icon: I.bell },
  ]

  const chatsFull = tab === 'chats'
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Css />
      {/* header + pestañas */}
      <div className="view" style={{ padding: isMobile ? '18px 14px 0' : '28px 34px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>WhatsApp</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: isMobile ? 26 : 32 }}>Bot</h1>
              {!loading && (
                <span className="tag" style={{ background: `var(--${st.tone}-soft)`, color: `var(--${st.tone})`, borderColor: 'transparent', padding: '4px 11px' }}>
                  <Dot tone={st.tone} ping={st.tone === 'green'} size={7} /> {st.short}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-sm btn-ghost bw-press" onClick={refresh} title="Refrescar datos" style={{ color: 'var(--text-dim)' }}>
            <I.refresh width={14} height={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} /> Refrescar
          </button>
        </div>

        {/* segmented control con píldora deslizante */}
        <div style={{ display: 'inline-flex', gap: 2, padding: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 13, marginBottom: chatsFull ? 0 : 6, maxWidth: '100%', overflowX: 'auto' }}>
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className="bw-press"
                style={{ position: 'relative', padding: isMobile ? '7px 12px' : '7px 15px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-dim)', transition: 'color .2s', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {active && (
                  <motion.span layoutId="bw-tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: 9, background: 'var(--card)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow)' }} />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <t.icon width={14} height={14} style={{ color: active ? 'var(--accent)' : 'var(--text-faint)', transition: 'color .2s' }} />
                  {isMobile ? t.short : t.label}
                  {t.key === 'chats' && overdueCount > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--red-soft)', color: 'var(--red)', borderRadius: 999, padding: '1px 6px', lineHeight: 1.5 }}>{overdueCount}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* contenido */}
      <div style={{ flex: 1, minHeight: 0, overflow: chatsFull ? 'hidden' : 'auto' }}>
        {tab === 'resumen' && (
          <Resumen loading={loading} st={st} status={status} hb={hb} groups={groups} alerts={alerts} recent={recent} todayCount={todayCount}
            now={now} isMobile={isMobile} groupOf={(jid) => groups.find((g) => g.group_jid === jid)} groupTitle={groupTitle} overdueDays={overdueDays}
            onOpenChat={(jid) => { setTab('chats'); openGroup(jid) }} />
        )}
        {tab === 'chats' && (
          <Conversaciones isMobile={isMobile} groups={groups} lastByGroup={lastByGroup} groupTitle={groupTitle} overdueDays={overdueDays}
            selectedJid={selectedJid} chatMsgs={chatMsgs} chatLoading={chatLoading} now={now}
            onSelect={openGroup} onBack={() => setSelectedJid(null)} supabase={supabase} urlCache={urlCache} onOpenImage={setImageOpen} />
        )}
        {tab === 'grupos' && (
          <Grupos isMobile={isMobile} groups={groups} projects={projects} clients={clients} now={now} loading={loading}
            groupTitle={groupTitle} overdueDays={overdueDays} patchGroup={patchGroup} />
        )}
        {tab === 'avisos' && (
          <Avisos isMobile={isMobile} alerts={alerts} projects={projects} now={now} loading={loading} />
        )}
      </div>

      {/* modal de imagen grande */}
      <Modal open={!!imageOpen} onClose={() => setImageOpen(null)} title="Imagen" width={860}>
        {imageOpen && <img src={imageOpen} alt="" style={{ maxWidth: '100%', borderRadius: 12, display: 'block', margin: '0 auto' }} />}
      </Modal>
    </div>
  )
}

/* ============================================================================
   1 · RESUMEN — hero de estado + stats + actividad reciente
============================================================================ */
function Resumen({ loading, st, status, hb, groups, alerts, recent, todayCount, now, isMobile, groupOf, groupTitle, overdueDays, onOpenChat }) {
  const activos = groups.filter((g) => g.active)
  const sinRespuesta = activos.filter((g) => overdueDays(g))
  const lastAlert = alerts[0]?.sent_at

  const stats = [
    { label: 'Mensajes hoy', value: todayCount == null ? '—' : todayCount, icon: I.comment, tone: 'accent' },
    { label: 'Grupos activos', value: activos.length, icon: I.whatsapp, tone: 'green' },
    { label: 'Sin respuesta', value: sinRespuesta.length, icon: I.alert, tone: sinRespuesta.length > 0 ? 'red' : 'green', vc: sinRespuesta.length > 0 ? 'var(--red)' : undefined },
    { label: 'Último aviso', value: lastAlert ? fmtRel(lastAlert, now) : 'nunca', icon: I.bell, tone: 'blue', small: true },
  ]

  if (loading) {
    return (
      <div className="view" style={{ padding: isMobile ? '18px 14px 48px' : '22px 34px 60px' }}>
        <Skel h={92} r={16} style={{ marginBottom: 14 }} />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 26 }}>
          {[0, 1, 2, 3].map((i) => <Skel key={i} h={96} r={16} />)}
        </div>
        <Skel h={14} w={130} r={6} style={{ marginBottom: 12 }} />
        <Skel h={220} r={16} />
      </div>
    )
  }

  return (
    <div className="view" style={{ padding: isMobile ? '18px 14px 48px' : '22px 34px 60px' }}>
      {/* hero de estado con glow ambiental */}
      <motion.div variants={rise} initial="hidden" animate="show" className="surface"
        style={{ position: 'relative', overflow: 'hidden', padding: isMobile ? '20px 18px' : '24px 28px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <span style={{ position: 'absolute', top: -90, left: -70, width: 380, height: 260, background: `radial-gradient(closest-side, var(--${st.tone}-soft), transparent)`, filter: 'blur(28px)', pointerEvents: 'none' }} />
        <Dot tone={st.tone} ping={st.tone === 'green'} size={13} />
        <div style={{ flex: 1, minWidth: 210, position: 'relative' }}>
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: isMobile ? 20 : 24, color: `var(--${st.tone})`, letterSpacing: '-0.02em' }}>{st.label}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{st.desc}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: isMobile ? 'flex-start' : 'flex-end', position: 'relative' }}>
          <span className="tag" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
            <I.clock width={12} height={12} /> Último latido {hb ? fmtRel(status.last_heartbeat_at, now) : '— nunca'}
          </span>
          {status?.worker_version && <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>worker {status.worker_version}</span>}
        </div>
      </motion.div>

      {/* stat cards */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 26 }}>
        {stats.map((s) => (
          <motion.div key={s.label} variants={rise} className="surface bw-stat" style={{ padding: '15px 17px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
              <span style={{ width: 27, height: 27, borderRadius: 9, display: 'grid', placeItems: 'center', background: `var(--${s.tone}-soft)`, color: `var(--${s.tone})`, flexShrink: 0 }}>
                <s.icon width={14} height={14} />
              </span>
              <span className="label">{s.label}</span>
            </div>
            <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: s.small ? 18 : 30, color: s.vc || 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* grupos vencidos (si hay) */}
      {sinRespuesta.length > 0 && (
        <motion.div variants={rise} initial="hidden" animate="show" className="surface"
          style={{ position: 'relative', overflow: 'hidden', padding: '16px 18px', marginBottom: 26, borderColor: 'var(--red-soft)', background: 'var(--red-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 650, color: 'var(--red)' }}>
            <span style={{ width: 27, height: 27, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--red-soft)', flexShrink: 0 }}><I.alert width={15} height={15} /></span>
            {sinRespuesta.length === 1 ? 'Hay un cliente esperando respuesta' : `Hay ${sinRespuesta.length} clientes esperando respuesta`}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {sinRespuesta.map((g) => (
              <button key={g.group_jid} className="bw-chip" onClick={() => onOpenChat(g.group_jid)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 11, fontSize: 12.5, fontWeight: 600, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {groupTitle(g)} <span style={{ color: 'var(--red)', fontWeight: 700 }}>{overdueDays(g)} días</span>
                <I.chevR width={12} height={12} style={{ color: 'var(--text-faint)' }} />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* actividad reciente */}
      <div className="label" style={{ marginBottom: 10 }}>Actividad reciente</div>
      <motion.div variants={rise} initial="hidden" animate="show" className="surface" style={{ overflow: 'hidden' }}>
        {recent.length === 0 && (
          <div style={{ padding: 42, textAlign: 'center' }}>
            <EmptyIcon icon={I.comment} />
            <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Todavía no llegaron mensajes</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 380, margin: '0 auto', lineHeight: 1.55 }}>Apenas alguien escriba en un grupo vigilado, lo vas a ver acá en tiempo real.</div>
          </div>
        )}
        {recent.slice(0, 8).map((m, i) => {
          const g = groupOf(m.group_jid)
          const mine = m.from_me || m.is_team
          const title = groupTitle(g) !== '—' ? groupTitle(g) : m.group_jid
          return (
            <div key={m.id || i} className="bw-item click" onClick={() => onOpenChat(m.group_jid)}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 16px', borderBottom: i < Math.min(recent.length, 8) - 1 ? '1px solid var(--border)' : 'none' }}>
              <GAvatar name={title} jid={m.group_jid} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                  <span style={{ fontSize: 11.5, color: mine ? 'var(--accent)' : 'var(--text-faint)', whiteSpace: 'nowrap', fontWeight: mine ? 600 : 400 }}>{mine ? 'Equipo' : (m.sender_name || 'alguien')}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                  {m.body || MEDIA_LABELS[m.message_type] || `[${m.message_type || 'mensaje'}]`}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtRel(m.wa_timestamp, now)}</span>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}

/* ============================================================================
   2 · CONVERSACIONES — panel tipo messenger: lista + chat en un marco
============================================================================ */
function Conversaciones({ isMobile, groups, lastByGroup, groupTitle, overdueDays, selectedJid, chatMsgs, chatLoading, now, onSelect, onBack, supabase, urlCache, onOpenImage }) {
  const [q, setQ] = useState('')

  /* grupos con actividad o activos, ordenados por último mensaje */
  const list = useMemo(() => {
    const rows = groups.filter((g) => g.active || lastByGroup.has(g.group_jid))
    const filtered = q.trim()
      ? rows.filter((g) => (groupTitle(g) + ' ' + (g.group_name || '')).toLowerCase().includes(q.trim().toLowerCase()))
      : rows
    return filtered.sort((a, b) => {
      const ta = lastByGroup.get(a.group_jid)?.wa_timestamp || a.updated_at || ''
      const tb = lastByGroup.get(b.group_jid)?.wa_timestamp || b.updated_at || ''
      return tb.localeCompare(ta)
    })
  }, [groups, lastByGroup, q])

  const selected = groups.find((g) => g.group_jid === selectedJid)
  const showList = !isMobile || !selectedJid
  const showChat = !isMobile || !!selectedJid

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: isMobile ? '10px 0 0' : '14px 34px 26px' }}>
      {/* marco del panel — esto le da aire al chat en vez de quedar pegado al borde */}
      <div className="surface" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', borderRadius: isMobile ? 0 : 18, border: isMobile ? 'none' : '1px solid var(--border)', boxShadow: isMobile ? 'none' : 'var(--shadow)' }}>

        {/* columna izquierda: conversaciones */}
        {showList && (
          <div style={{ width: isMobile ? '100%' : 320, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--card)' }}>
            <div style={{ padding: '14px 14px 11px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="label">Conversaciones</span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{list.length}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 11px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <I.search width={13} height={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo…"
                  style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)' }} />
                {q && <button onClick={() => setQ('')} style={{ display: 'inline-flex', padding: 2, color: 'var(--text-faint)' }}><I.x width={12} height={12} /></button>}
              </label>
            </div>

            <div className="scroll-y bw-scroll" style={{ flex: 1, minHeight: 0, padding: '8px 8px 12px' }}>
              {list.length === 0 && (
                <div style={{ padding: '44px 18px', textAlign: 'center' }}>
                  <EmptyIcon icon={I.whatsapp} />
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>{q ? 'Ningún grupo coincide con la búsqueda.' : 'Sin conversaciones todavía. Cuando el bot escuche un grupo, aparece acá.'}</div>
                </div>
              )}
              {list.map((g) => {
                const last = lastByGroup.get(g.group_jid)
                const over = overdueDays(g)
                const active = g.group_jid === selectedJid
                const title = groupTitle(g)
                return (
                  <div key={g.group_jid} className="bw-item click" onClick={() => onSelect(g.group_jid)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 13, background: active ? 'var(--accent-soft)' : 'transparent', border: '1px solid', borderColor: active ? 'var(--accent-line)' : 'transparent', marginBottom: 2 }}>
                    <GAvatar name={title} jid={g.group_jid} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 650, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: active ? 'var(--accent)' : 'var(--text)' }}>{title}</span>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{last ? fmtRel(last.wa_timestamp, now) : ''}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {last ? `${(last.from_me || last.is_team) ? 'Equipo: ' : ''}${last.body || MEDIA_LABELS[last.message_type] || '[media]'}` : 'Sin mensajes recientes'}
                        </span>
                        {over && <span className="tag" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 9.5, padding: '1px 7px', flexShrink: 0 }}>{over} d</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* columna derecha: chat */}
        {showChat && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
            {!selectedJid ? (
              <div className="bw-chatbg" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
                <div style={{ textAlign: 'center' }}>
                  <EmptyIcon icon={I.comment} />
                  <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 16, marginBottom: 5 }}>Elegí una conversación</div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 300, lineHeight: 1.55 }}>Los mensajes de los grupos vigilados aparecen acá en tiempo real.</div>
                </div>
              </div>
            ) : (
              <motion.div key={selectedJid} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ChatPane group={selected} title={groupTitle(selected)} msgs={chatMsgs} loading={chatLoading} isMobile={isMobile}
                  onBack={onBack} supabase={supabase} urlCache={urlCache} onOpenImage={onOpenImage} />
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChatPane({ group, title, msgs, loading, isMobile, onBack, supabase, urlCache, onOpenImage }) {
  const scrollRef = useRef(null)
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length, loading])

  /* filas con separadores de día + agrupado de mensajes consecutivos del mismo remitente */
  const rows = useMemo(() => {
    const out = []
    let prevDay = null
    let prev = null
    msgs.forEach((m) => {
      const k = dayKey(m.wa_timestamp || m.created_at)
      if (k !== prevDay) { out.push({ sep: dayLabel(m.wa_timestamp || m.created_at), key: 'sep-' + k }); prevDay = k; prev = null }
      const mine = m.from_me || m.is_team
      const pmine = prev ? (prev.from_me || prev.is_team) : null
      const gap = prev ? new Date(m.wa_timestamp).getTime() - new Date(prev.wa_timestamp).getTime() : Infinity
      const first = !prev || pmine !== mine || prev.sender_jid !== m.sender_jid || gap > 7 * MIN
      out.push({ m, mine, first, key: m.id || m.wa_message_id })
      prev = m
    })
    return out
  }, [msgs])

  return (
    <>
      {/* header del chat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '11px 12px' : '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0 }}>
        {isMobile && (
          <button className="btn btn-sm btn-ghost bw-press" onClick={onBack} style={{ padding: 6 }}>
            <I.chevR width={16} height={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
        <GAvatar name={title} jid={group?.group_jid} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {group?.group_name && group.group_name !== title && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{group.group_name}</div>}
        </div>
        {!isMobile && !loading && msgs.length > 0 && <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{msgs.length} mensajes</span>}
        {group?.active
          ? <span className="tag" style={{ background: 'var(--green-soft)', color: 'var(--green)', gap: 6 }}><Dot tone="green" ping size={6} /> Vigilado</span>
          : <span className="tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-faint)', borderColor: 'var(--border)' }}>Pausado</span>}
      </div>

      {/* mensajes */}
      <div ref={scrollRef} className="scroll-y bw-scroll bw-chatbg fade-edge" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '16px 12px 18px' : '22px 28px 26px' }}>
          {loading && [230, 320, 180, 280, 210].map((w, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: i % 2 ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <Skel h={46} w={w} r={14} style={{ maxWidth: '70%' }} />
            </div>
          ))}
          {!loading && msgs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '46px 0' }}>
              <EmptyIcon icon={I.comment} />
              <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Sin mensajes guardados en este grupo.</div>
            </div>
          )}
          {!loading && rows.map((r) => r.sep
            ? (
              <div key={r.key} style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 14px' }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-faint)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 13px' }}>{r.sep}</span>
              </div>
            )
            : <Burbuja key={r.key} m={r.m} mine={r.mine} first={r.first} supabase={supabase} urlCache={urlCache} onOpenImage={onOpenImage} />
          )}
        </div>
      </div>

      {/* pie: el panel es solo lectura */}
      {!isMobile && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--card)', padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-faint)' }}>
          <I.eye width={13} height={13} /> El bot solo escucha este grupo — respondé desde WhatsApp.
        </div>
      )}
    </>
  )
}

function Burbuja({ m, mine, first, supabase, urlCache, onOpenImage }) {
  const isMediaType = !!MEDIA_LABELS[m.message_type]
  const hue = senderColor(m.sender_jid)
  return (
    <div style={{ display: 'flex', gap: 9, justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-start', marginTop: first ? 14 : 3 }}>
      {/* avatar del remitente (solo clientes, solo primer mensaje de la racha) */}
      {!mine && (first
        ? <GAvatar name={m.sender_name || '?'} jid={m.sender_jid} size={28} radius={10} style={{ marginTop: 2 }} />
        : <span style={{ width: 28, flexShrink: 0 }} />)}
      <div style={{
        maxWidth: 'min(78%, 480px)', padding: '8px 13px 6px',
        borderRadius: first ? (mine ? '16px 5px 16px 16px' : '5px 16px 16px 16px') : 16,
        background: mine ? 'var(--accent-soft)' : 'var(--card)',
        border: mine ? '1px solid var(--accent-line)' : '1px solid var(--border)',
      }}>
        {first && (
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, color: mine ? 'var(--accent)' : hue }}>
            {mine ? (m.sender_name || 'Equipo') : (m.sender_name || 'Cliente')}
          </div>
        )}
        {(m.media_url || isMediaType) && <MediaBlock m={m} supabase={supabase} urlCache={urlCache} onOpenImage={onOpenImage} />}
        {m.body && <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>}
        {!m.body && !m.media_url && !isMediaType && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>[{m.message_type || 'mensaje'}]</div>}
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', textAlign: 'right', marginTop: 3 }}>{fmtHora(m.wa_timestamp)}</div>
      </div>
    </div>
  )
}

/* media privada del bucket wa-media → signed URL cacheada 1 h */
function MediaBlock({ m, supabase, urlCache, onOpenImage }) {
  const path = m.media_url
  const [url, setUrl] = useState(() => (path && urlCache.current.get(path)) || null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!path || url) return
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase.storage.from('wa-media').createSignedUrl(path, 3600)
        if (error || !data?.signedUrl) throw error || new Error('sin url')
        urlCache.current.set(path, data.signedUrl)
        if (alive) setUrl(data.signedUrl)
      } catch (e) { if (alive) setFailed(true) }
    })()
    return () => { alive = false }
  }, [path])

  const chip = (label, dim) => (
    <span className="tag" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: dim ? 'var(--text-faint)' : 'var(--text-dim)', margin: '2px 0 4px' }}>{label}</span>
  )
  if (!path) return chip(MEDIA_LABELS[m.message_type] || '📎 Adjunto', true)
  if (failed) return chip('Media no disponible', true)
  if (!url) return chip('Cargando media…', true)

  const t = m.message_type
  if (t === 'image' || t === 'sticker') {
    return <img src={url} alt="" onClick={() => onOpenImage(url)} className="click bw-img"
      style={{ maxWidth: 300, width: '100%', borderRadius: 12, display: 'block', margin: '2px 0 6px', border: '1px solid var(--border)' }} />
  }
  if (t === 'video') return <video src={url} controls style={{ maxWidth: 300, width: '100%', borderRadius: 12, display: 'block', margin: '2px 0 6px' }} />
  if (t === 'audio' || t === 'ptt' || t === 'voice') return <audio src={url} controls style={{ maxWidth: 260, width: '100%', display: 'block', margin: '4px 0 6px' }} />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ margin: '2px 0 6px', display: 'inline-flex' }}>
      <I.download width={13} height={13} /> {MEDIA_LABELS[t] ? MEDIA_LABELS[t].replace(/^\S+\s/, '') : 'Descargar adjunto'}
    </a>
  )
}

/* ============================================================================
   3 · GRUPOS — mapeo grupo ↔ proyecto, activo, umbral
============================================================================ */
function Grupos({ isMobile, groups, projects, clients, now, loading, groupTitle, overdueDays, patchGroup }) {
  const sorted = useMemo(() => groups.slice().sort((a, b) => Number(b.active) - Number(a.active) || (a.group_name || a.group_jid || '').localeCompare(b.group_name || b.group_jid || '')), [groups])

  const assignProject = (g, projectId) => {
    const p = projects.find((x) => x.id === projectId)
    patchGroup(g.group_jid, { project_id: projectId || null, client_id: (p && p.clientId) || null })
  }
  const lastActivity = (g) => {
    const t = [g.last_team_msg_at, g.last_client_msg_at].filter(Boolean).sort().pop()
    return t ? fmtRel(t, now) : 'sin actividad'
  }

  const ProjectSelect = ({ g }) => (
    <select className="input" value={g.project_id || ''} onChange={(e) => assignProject(g, e.target.value)}
      style={{ padding: '7px 10px', fontSize: 13, width: isMobile ? '100%' : 210 }}>
      <option value="">— Sin proyecto —</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )
  const Toggle = ({ g }) => (
    <button onClick={() => patchGroup(g.group_jid, { active: !g.active })} className="bw-press" title={g.active ? 'Dejar de vigilar este grupo' : 'Empezar a vigilar este grupo'}
      style={{ width: 40, height: 23, borderRadius: 99, position: 'relative', flexShrink: 0, background: g.active ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .2s, box-shadow .25s', padding: 0, boxShadow: g.active ? '0 0 14px -4px var(--accent)' : 'none' }}>
      <span style={{ position: 'absolute', top: 3, left: g.active ? 20 : 3, width: 17, height: 17, borderRadius: 99, background: '#fff', transition: 'left .22s cubic-bezier(.22,1,.36,1)', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }} />
    </button>
  )
  const Umbral = ({ g }) => (
    <input type="number" min={1} max={60} className="input mono" value={g.inactivity_threshold_days ?? 3}
      onChange={(e) => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v) && v > 0) patchGroup(g.group_jid, { inactivity_threshold_days: v }) }}
      style={{ width: 64, padding: '6px 8px', fontSize: 13, textAlign: 'center' }} />
  )

  return (
    <div className="view" style={{ padding: isMobile ? '18px 14px 48px' : '22px 34px 60px' }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '10px 15px', border: '1px dashed var(--border-strong)', borderRadius: 12, marginBottom: 16, fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        <I.eye width={14} height={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <span>Activo = el bot procesa y vigila ese grupo. El umbral son los días sin respuesta del equipo antes de avisar.</span>
      </div>

      {loading && <Skel h={230} r={16} />}
      {!loading && sorted.length === 0 && (
        <div className="surface" style={{ padding: 46, textAlign: 'center' }}>
          <EmptyIcon icon={I.whatsapp} />
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 16, marginBottom: 5 }}>Todavía no hay grupos</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 400, margin: '0 auto', lineHeight: 1.55 }}>Cuando el bot entre a un grupo de WhatsApp, aparece acá para mapearlo a un proyecto.</div>
        </div>
      )}

      {!loading && sorted.length > 0 && (isMobile
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map((g) => (
              <div key={g.group_jid} className="surface" style={{ padding: 14, opacity: g.active ? 1 : 0.72 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                  <GAvatar name={g.group_name || groupTitle(g)} jid={g.group_jid} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group_name || groupTitle(g)}</div>
                    <div style={{ fontSize: 11.5, color: overdueDays(g) ? 'var(--red)' : 'var(--text-faint)', marginTop: 1 }}>{lastActivity(g)}</div>
                  </div>
                  <Toggle g={g} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><ProjectSelect g={g} /></div>
                  <Umbral g={g} />
                </div>
              </div>
            ))}
          </div>
        )
        : (
          <motion.div variants={rise} initial="hidden" animate="show" className="surface tbl" style={{ overflowX: 'auto' }}>
            <table className="bw-tbl">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {['Grupo', 'Proyecto', 'Activo', 'Umbral (días)', 'Última actividad'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-faint)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((g) => (
                  <tr key={g.group_jid} className="row-hover" style={{ borderBottom: '1px solid var(--border)', opacity: g.active ? 1 : 0.62, transition: 'opacity .2s' }}>
                    <td style={{ padding: '11px 16px', maxWidth: 280 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <GAvatar name={g.group_name || groupTitle(g)} jid={g.group_jid} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group_name || '(sin nombre)'}</div>
                          <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group_jid}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}><ProjectSelect g={g} /></td>
                    <td style={{ padding: '11px 16px' }}><Toggle g={g} /></td>
                    <td style={{ padding: '11px 16px' }}><Umbral g={g} /></td>
                    <td style={{ padding: '11px 16px', fontSize: 12.5, color: overdueDays(g) ? 'var(--red)' : 'var(--text-dim)', whiteSpace: 'nowrap', fontWeight: overdueDays(g) ? 600 : 400 }}>{lastActivity(g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ))}
    </div>
  )
}

/* ============================================================================
   4 · AVISOS — feed de wa_alerts
============================================================================ */
function Avisos({ isMobile, alerts, projects, now, loading }) {
  const projName = (id) => projects.find((p) => p.id === id)?.name
  const kindMeta = (k) => k === 'inactivity'
    ? { icon: I.clock, color: 'var(--yellow)', soft: 'var(--yellow-soft)', label: 'Inactividad' }
    : { icon: I.bell, color: 'var(--accent)', soft: 'var(--accent-soft)', label: k || 'Aviso' }

  return (
    <div className="view" style={{ padding: isMobile ? '18px 14px 48px' : '22px 34px 60px' }}>
      {loading && <Skel h={200} r={16} style={{ maxWidth: 760 }} />}
      {!loading && alerts.length === 0 && (
        <div className="surface" style={{ padding: 46, textAlign: 'center', maxWidth: 560 }}>
          <EmptyIcon icon={I.bell} />
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 16, marginBottom: 5 }}>Todavía no se enviaron avisos</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55, maxWidth: 420, margin: '0 auto' }}>El chequeo corre todos los días a las 9:00. Cuando un cliente quede sin respuesta más días que el umbral, el aviso llega al grupo de seguimiento y queda registrado acá.</div>
        </div>
      )}
      {!loading && alerts.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="surface" style={{ overflow: 'hidden', maxWidth: 760 }}>
          {alerts.map((a, i) => {
            const m = kindMeta(a.kind)
            const pn = projName(a.project_id)
            return (
              <motion.div key={a.id || i} variants={rise} className="bw-item"
                style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '13px 16px', borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: m.soft, color: m.color }}>
                  <m.icon width={16} height={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    {pn && <span style={{ fontSize: 13, fontWeight: 700 }}>{pn}</span>}
                    <span className="tag" style={{ background: m.soft, color: m.color, fontSize: 10 }}>{m.label}</span>
                    {a.days_overdue != null && <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{a.days_overdue} días sin respuesta</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4, wordBreak: 'break-word' }}>{a.message || 'Aviso enviado al grupo de seguimiento.'}</div>
                </div>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtRel(a.sent_at, now)}</span>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
