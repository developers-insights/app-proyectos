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

/* color estable por remitente (sutil, para el nombre en las burbujas) */
const SENDER_HUES = ['#60A5FA', '#34D399', '#A78BFA', '#F472B6', '#FBBF24', '#2DD4BF', '#FB923C', '#818CF8']
const senderColor = (jid) => { let h = 0; const s = jid || ''; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return SENDER_HUES[h % SENDER_HUES.length] }

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
    const thr = g.inactivity_threshold_days ?? 5
    return days > thr ? days : null
  }

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
        <div className="label" style={{ marginBottom: 6 }}>WhatsApp</div>
        <h1 style={{ fontSize: 32, marginBottom: 24 }}>Bot</h1>
        <div className="surface" style={{ padding: 48, textAlign: 'center', maxWidth: 520 }}>
          <I.whatsapp width={34} height={34} style={{ color: 'var(--text-faint)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>El bot necesita conexión a Supabase</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>Configurá las variables de entorno de Supabase para ver los grupos, las conversaciones y los avisos del bot.</div>
        </div>
      </div>
    )
  }

  const TABS = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'chats', label: 'Conversaciones' },
    { key: 'grupos', label: 'Grupos' },
    { key: 'avisos', label: 'Avisos' },
  ]

  const chatsFull = tab === 'chats'
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header + pestañas */}
      <div className="view" style={{ padding: isMobile ? '18px 14px 0' : '28px 34px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div><div className="label" style={{ marginBottom: 6 }}>WhatsApp</div><h1 style={{ fontSize: isMobile ? 26 : 32 }}>Bot</h1></div>
          <button className="btn btn-sm btn-ghost" onClick={loadAll} title="Refrescar datos" style={{ color: 'var(--text-dim)' }}><I.refresh width={14} height={14} /> Refrescar</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: chatsFull ? 0 : 4 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, border: '1px solid', borderColor: tab === t.key ? 'var(--accent-line)' : 'var(--border)', background: tab === t.key ? 'var(--accent-soft)' : 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text-dim)', transition: 'all .16s' }}>
              {t.label}
              {t.key === 'chats' && groups.filter((g) => overdueDays(g)).length > 0 && (
                <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 700, background: 'var(--red-soft)', color: 'var(--red)', borderRadius: 999, padding: '1px 6px' }}>{groups.filter((g) => overdueDays(g)).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* contenido */}
      <div style={{ flex: 1, minHeight: 0, overflow: chatsFull ? 'hidden' : 'auto' }}>
        {tab === 'resumen' && (
          <Resumen loading={loading} status={status} groups={groups} alerts={alerts} recent={recent} todayCount={todayCount}
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
            groupTitle={groupTitle} patchGroup={patchGroup} />
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
   1 · RESUMEN — pill de estado + stats + actividad reciente
============================================================================ */
function Resumen({ loading, status, groups, alerts, recent, todayCount, now, isMobile, groupOf, groupTitle, overdueDays, onOpenChat }) {
  /* estado del bot: verde = conectado y con latido fresco · ámbar = worker mudo · rojo = WA caído */
  const hb = status?.last_heartbeat_at ? new Date(status.last_heartbeat_at).getTime() : null
  const hbFresh = hb != null && now - hb < 12 * MIN
  const st = !hbFresh
    ? { tone: 'yellow', label: 'Worker sin señal', desc: 'El worker no manda latidos hace más de 12 minutos.' }
    : status?.connection_state !== 'open'
      ? { tone: 'red', label: 'WhatsApp desconectado', desc: 'El worker está vivo pero la sesión de WhatsApp no está abierta.' }
      : { tone: 'green', label: 'Bot operativo', desc: 'Conectado a WhatsApp y procesando mensajes.' }

  const activos = groups.filter((g) => g.active)
  const sinRespuesta = activos.filter((g) => overdueDays(g))
  const lastAlert = alerts[0]?.sent_at

  const stats = [
    { label: 'Mensajes hoy', value: todayCount == null ? '—' : todayCount, icon: I.comment, color: 'var(--text)' },
    { label: 'Grupos activos', value: activos.length, icon: I.whatsapp, color: 'var(--text)' },
    { label: 'Sin respuesta', value: sinRespuesta.length, icon: I.alert, color: sinRespuesta.length > 0 ? 'var(--red)' : 'var(--green)' },
    { label: 'Último aviso', value: lastAlert ? fmtRel(lastAlert, now) : 'nunca', icon: I.bell, color: 'var(--text)', small: true },
  ]

  return (
    <div className="view" style={{ padding: isMobile ? '18px 14px 48px' : '22px 34px 60px' }}>
      {/* hero de estado */}
      <motion.div variants={rise} initial="hidden" animate="show" className="surface"
        style={{ padding: isMobile ? '18px 16px' : '22px 26px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: `var(--${st.tone})` }} />
          {st.tone === 'green' && <span style={{ position: 'absolute', inset: -4, borderRadius: 99, background: 'var(--green-soft)', animation: 'pulse 2s infinite' }} />}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: isMobile ? 20 : 24, color: `var(--${st.tone})`, letterSpacing: '-0.02em' }}>{st.label}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>{st.desc}</div>
        </div>
        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Último latido {hb ? fmtRel(status.last_heartbeat_at, now) : '— nunca'}</div>
          {status?.worker_version && <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>worker {status.worker_version}</div>}
        </div>
      </motion.div>

      {/* stat cards */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 26 }}>
        {stats.map((s) => (
          <motion.div key={s.label} variants={rise} className="surface" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <s.icon width={14} height={14} style={{ color: 'var(--text-faint)' }} />
              <span className="label">{s.label}</span>
            </div>
            <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: s.small ? 17 : 27, color: s.color, lineHeight: 1.1 }}>{loading ? '…' : s.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* grupos vencidos (si hay) */}
      {sinRespuesta.length > 0 && (
        <div className="surface" style={{ padding: '14px 18px', marginBottom: 26, borderColor: 'var(--red-soft)', background: 'var(--red-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
            <I.alert width={15} height={15} />
            {sinRespuesta.length === 1 ? 'Hay un cliente esperando respuesta' : `Hay ${sinRespuesta.length} clientes esperando respuesta`}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {sinRespuesta.map((g) => (
              <button key={g.group_jid} className="btn btn-sm" onClick={() => onOpenChat(g.group_jid)}>
                {groupTitle(g)} <span style={{ color: 'var(--red)', fontWeight: 700 }}>{overdueDays(g)} días</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* actividad reciente */}
      <div className="label" style={{ marginBottom: 10 }}>Actividad reciente</div>
      <div className="surface" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: 22, fontSize: 13, color: 'var(--text-faint)' }}>Cargando…</div>}
        {!loading && recent.length === 0 && (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <I.comment width={26} height={26} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
            <div style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>Todavía no llegaron mensajes. Apenas alguien escriba en un grupo, lo vas a ver acá.</div>
          </div>
        )}
        {!loading && recent.slice(0, 8).map((m, i) => {
          const g = groupOf(m.group_jid)
          const mine = m.from_me || m.is_team
          return (
            <div key={m.id || i} className="row-hover click" onClick={() => onOpenChat(m.group_jid)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < Math.min(recent.length, 8) - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: mine ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: '1px solid var(--border)', color: mine ? 'var(--accent)' : 'var(--text-faint)' }}>
                <I.whatsapp width={15} height={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{groupTitle(g) !== '—' ? groupTitle(g) : m.group_jid}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{m.sender_name || 'alguien'}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                  {m.body || MEDIA_LABELS[m.message_type] || `[${m.message_type || 'mensaje'}]`}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtRel(m.wa_timestamp, now)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================================
   2 · CONVERSACIONES — lista de grupos + chat
============================================================================ */
function Conversaciones({ isMobile, groups, lastByGroup, groupTitle, overdueDays, selectedJid, chatMsgs, chatLoading, now, onSelect, onBack, supabase, urlCache, onOpenImage }) {
  /* grupos con actividad o activos, ordenados por último mensaje */
  const list = useMemo(() => {
    const rows = groups.filter((g) => g.active || lastByGroup.has(g.group_jid))
    return rows.sort((a, b) => {
      const ta = lastByGroup.get(a.group_jid)?.wa_timestamp || a.updated_at || ''
      const tb = lastByGroup.get(b.group_jid)?.wa_timestamp || b.updated_at || ''
      return tb.localeCompare(ta)
    })
  }, [groups, lastByGroup])

  const selected = groups.find((g) => g.group_jid === selectedJid)
  const showList = !isMobile || !selectedJid
  const showChat = !isMobile || !!selectedJid

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* columna izquierda: grupos */}
      {showList && (
        <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--border)', overflowY: 'auto', padding: '10px 8px' }}>
          {list.length === 0 && (
            <div style={{ padding: '40px 18px', textAlign: 'center' }}>
              <I.whatsapp width={26} height={26} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>Sin conversaciones todavía. Cuando el bot escuche un grupo, aparece acá.</div>
            </div>
          )}
          {list.map((g) => {
            const last = lastByGroup.get(g.group_jid)
            const over = overdueDays(g)
            const active = g.group_jid === selectedJid
            return (
              <div key={g.group_jid} className="row-hover click" onClick={() => onSelect(g.group_jid)}
                style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '11px 12px', borderRadius: 11, background: active ? 'var(--accent-soft)' : 'transparent', border: active ? '1px solid var(--accent-line)' : '1px solid transparent', marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: active ? 'var(--accent)' : 'var(--text)' }}>{groupTitle(g)}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{last ? fmtRel(last.wa_timestamp, now) : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {last ? `${(last.from_me || last.is_team) ? 'Equipo: ' : ''}${last.body || MEDIA_LABELS[last.message_type] || '[media]'}` : 'Sin mensajes recientes'}
                  </span>
                  {over && <span className="tag" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 10, flexShrink: 0 }}>{over} días</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* columna derecha: chat */}
      {showChat && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          {!selectedJid && (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
              <div style={{ textAlign: 'center' }}>
                <I.comment width={30} height={30} style={{ color: 'var(--text-faint)', marginBottom: 10 }} />
                <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>Elegí un grupo para ver la conversación</div>
              </div>
            </div>
          )}
          {selectedJid && (
            <ChatPane group={selected} title={groupTitle(selected)} msgs={chatMsgs} loading={chatLoading} isMobile={isMobile}
              onBack={onBack} supabase={supabase} urlCache={urlCache} onOpenImage={onOpenImage} />
          )}
        </div>
      )}
    </div>
  )
}

function ChatPane({ group, title, msgs, loading, isMobile, onBack, supabase, urlCache, onOpenImage }) {
  const scrollRef = useRef(null)
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length, loading])

  /* filas con separadores de día */
  const rows = useMemo(() => {
    const out = []
    let prevDay = null
    msgs.forEach((m) => {
      const k = dayKey(m.wa_timestamp || m.created_at)
      if (k !== prevDay) { out.push({ sep: dayLabel(m.wa_timestamp || m.created_at), key: 'sep-' + k }); prevDay = k }
      out.push({ m, key: m.id || m.wa_message_id })
    })
    return out
  }, [msgs])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', flexShrink: 0 }}>
        {isMobile && <button className="btn btn-sm btn-ghost" onClick={onBack} style={{ padding: 6 }}><I.chevR width={16} height={16} style={{ transform: 'rotate(180deg)' }} /></button>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {group?.group_name && group.group_name !== title && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.group_name}</div>}
        </div>
        {group?.active ? <span className="tag" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>Vigilado</span> : <span className="tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-faint)', borderColor: 'var(--border)' }}>Pausado</span>}
      </div>

      <div ref={scrollRef} className="scroll-y" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '14px 12px' : '18px 22px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-faint)' }}>Cargando mensajes…</div>}
        {!loading && msgs.length === 0 && <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-faint)' }}>Sin mensajes guardados en este grupo.</div>}
        {!loading && rows.map((r) => r.sep
          ? (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.sep}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )
          : <Burbuja key={r.key} m={r.m} supabase={supabase} urlCache={urlCache} onOpenImage={onOpenImage} />
        )}
      </div>
    </>
  )
}

function Burbuja({ m, supabase, urlCache, onOpenImage }) {
  const mine = m.from_me || m.is_team
  const isMediaType = !!MEDIA_LABELS[m.message_type]
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: 'min(78%, 460px)', padding: '8px 12px 6px', borderRadius: 13,
        borderBottomRightRadius: mine ? 4 : 13, borderBottomLeftRadius: mine ? 13 : 4,
        background: mine ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        border: mine ? '1px solid var(--accent-line)' : '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2, color: mine ? 'var(--accent)' : senderColor(m.sender_jid) }}>
          {mine ? (m.sender_name || 'Equipo') : (m.sender_name || 'Cliente')}
        </div>
        {(m.media_url || isMediaType) && <MediaBlock m={m} supabase={supabase} urlCache={urlCache} onOpenImage={onOpenImage} />}
        {m.body && <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>}
        {!m.body && !m.media_url && !isMediaType && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>[{m.message_type || 'mensaje'}]</div>}
        <div style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'right', marginTop: 3 }} className="mono">{fmtHora(m.wa_timestamp)}</div>
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
    return <img src={url} alt="" onClick={() => onOpenImage(url)} className="click"
      style={{ maxWidth: 280, width: '100%', borderRadius: 10, display: 'block', margin: '2px 0 5px', border: '1px solid var(--border)' }} />
  }
  if (t === 'video') return <video src={url} controls style={{ maxWidth: 280, width: '100%', borderRadius: 10, display: 'block', margin: '2px 0 5px' }} />
  if (t === 'audio' || t === 'ptt' || t === 'voice') return <audio src={url} controls style={{ maxWidth: 260, width: '100%', display: 'block', margin: '4px 0 6px' }} />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ margin: '2px 0 5px', display: 'inline-flex' }}>
      <I.download width={13} height={13} /> {MEDIA_LABELS[t] ? MEDIA_LABELS[t].replace(/^\S+\s/, '') : 'Descargar adjunto'}
    </a>
  )
}

/* ============================================================================
   3 · GRUPOS — mapeo grupo ↔ proyecto, activo, umbral
============================================================================ */
function Grupos({ isMobile, groups, projects, clients, now, loading, groupTitle, patchGroup }) {
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
      style={{ padding: '7px 10px', fontSize: 13, width: isMobile ? '100%' : 200 }}>
      <option value="">— Sin proyecto —</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )
  const Toggle = ({ g }) => (
    <button onClick={() => patchGroup(g.group_jid, { active: !g.active })} title={g.active ? 'Dejar de vigilar este grupo' : 'Empezar a vigilar este grupo'}
      style={{ width: 38, height: 22, borderRadius: 99, position: 'relative', flexShrink: 0, background: g.active ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .18s', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: g.active ? 19 : 3, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left .18s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  )
  const Umbral = ({ g }) => (
    <input type="number" min={1} max={60} className="input" value={g.inactivity_threshold_days ?? 5}
      onChange={(e) => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v) && v > 0) patchGroup(g.group_jid, { inactivity_threshold_days: v }) }}
      style={{ width: 62, padding: '6px 8px', fontSize: 13, textAlign: 'center' }} />
  )

  return (
    <div className="view" style={{ padding: isMobile ? '18px 14px 48px' : '22px 34px 60px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
        <I.eye width={13} height={13} /> Activo = el bot procesa y vigila ese grupo. El umbral son los días sin respuesta del equipo antes de avisar.
      </div>

      {loading && <div className="surface" style={{ padding: 26, fontSize: 13, color: 'var(--text-faint)' }}>Cargando grupos…</div>}
      {!loading && sorted.length === 0 && (
        <div className="surface" style={{ padding: 44, textAlign: 'center' }}>
          <I.whatsapp width={28} height={28} style={{ color: 'var(--text-faint)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Todavía no hay grupos</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Cuando el bot entre a un grupo de WhatsApp, aparece acá para mapearlo a un proyecto.</div>
        </div>
      )}

      {!loading && sorted.length > 0 && (isMobile
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map((g) => (
              <div key={g.group_jid} className="surface" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group_name || groupTitle(g)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{lastActivity(g)}</div>
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
          <div className="surface tbl" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Grupo', 'Proyecto', 'Activo', 'Umbral (días)', 'Última actividad'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((g) => (
                  <tr key={g.group_jid} className="row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group_name || '(sin nombre)'}</div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.group_jid}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}><ProjectSelect g={g} /></td>
                    <td style={{ padding: '10px 14px' }}><Toggle g={g} /></td>
                    <td style={{ padding: '10px 14px' }}><Umbral g={g} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{lastActivity(g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      {loading && <div className="surface" style={{ padding: 26, fontSize: 13, color: 'var(--text-faint)' }}>Cargando avisos…</div>}
      {!loading && alerts.length === 0 && (
        <div className="surface" style={{ padding: 44, textAlign: 'center', maxWidth: 560 }}>
          <I.bell width={28} height={28} style={{ color: 'var(--text-faint)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Todavía no se enviaron avisos</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>El chequeo corre todos los días a las 9:00. Cuando un cliente quede sin respuesta más días que el umbral, el aviso llega al grupo de seguimiento y queda registrado acá.</div>
        </div>
      )}
      {!loading && alerts.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="surface" style={{ overflow: 'hidden', maxWidth: 760 }}>
          {alerts.map((a, i) => {
            const m = kindMeta(a.kind)
            const pn = projName(a.project_id)
            return (
              <motion.div key={a.id || i} variants={rise} className="row-hover"
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 16px', borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: m.soft, color: m.color }}>
                  <m.icon width={15} height={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    {pn && <span style={{ fontSize: 13, fontWeight: 700 }}>{pn}</span>}
                    <span className="tag" style={{ background: m.soft, color: m.color, fontSize: 10 }}>{m.label}</span>
                    {a.days_overdue != null && <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{a.days_overdue} días sin respuesta</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 3, wordBreak: 'break-word' }}>{a.message || 'Aviso enviado al grupo de seguimiento.'}</div>
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
