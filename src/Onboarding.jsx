import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ============================================================================
   ONBOARDING · 3 landings públicas (estilo editorial Insights + animaciones Apple)
   ?onb=inicio  → bienvenida + wizard de alta (crea cliente + proyecto)
   ?onb=presentacion → video + calendario para agendar la call
   ?onb=gracias → gracias + qué preparar (Supabase + GitHub)
============================================================================ */
const C = { bg: '#FBFAF7', ink: '#241F1B', dim: '#6B635B', faint: '#A79E94', accent: '#E8742B', accentHi: '#C85A18', line: 'rgba(0,0,0,0.10)', line2: 'rgba(0,0,0,0.05)', card: '#FFFFFF', red: '#D93838', ok: '#1E9E5A' }

const ONB_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..700&family=Schibsted+Grotesk:wght@400..800&family=JetBrains+Mono:wght@400;500;700&display=swap');
.onb, .onb *{box-sizing:border-box}
.onb{font-family:'Schibsted Grotesk',system-ui,-apple-system,sans-serif;color:${C.ink};background:${C.bg};min-height:100vh;position:relative;overflow-x:hidden}
.onb::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.045;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.onb-serif{font-family:'Newsreader',Georgia,serif;font-weight:500;letter-spacing:-.01em}
.onb-mono{font-family:'JetBrains Mono',monospace}
.onb-wrap{position:relative;z-index:1;max-width:640px;margin:0 auto;padding:0 22px}
.onb-input{width:100%;padding:13px 15px;border-radius:12px;border:1px solid ${C.line};background:${C.card};font-size:16px;font-family:inherit;color:${C.ink};outline:none;transition:border-color .16s, box-shadow .16s}
.onb-input:focus{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accent}22}
.onb-input::placeholder{color:${C.faint}}
textarea.onb-input{resize:vertical;min-height:80px;line-height:1.5}
.onb-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:14px 28px;border-radius:99px;border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:16px;background:${C.accent};color:#fff;transition:transform .14s, filter .14s;box-shadow:0 6px 20px ${C.accent}44}
.onb-btn:hover{filter:brightness(1.06)}
.onb-btn:active{transform:scale(.98)}
.onb-btn:disabled{opacity:.5;cursor:default;box-shadow:none}
.onb-btn-ghost{background:transparent;color:${C.dim};border:1px solid ${C.line};box-shadow:none}
.onb-kicker{font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:.15em;text-transform:uppercase;color:${C.accentHi}}
.onb-label{font-size:13px;font-weight:600;color:${C.dim};margin-bottom:6px;display:block}
.onb-card{background:${C.card};border:1px solid ${C.line};border-radius:18px;box-shadow:0 1px 2px rgba(0,0,0,.03),0 10px 34px rgba(0,0,0,.05)}
`

const ease = [0.16, 1, 0.3, 1]
function useInjectCss() {
  useEffect(() => {
    if (document.getElementById('onb-css')) return
    const el = document.createElement('style'); el.id = 'onb-css'; el.textContent = ONB_CSS; document.head.appendChild(el)
    document.documentElement.style.colorScheme = 'light'
    document.body.style.background = C.bg
  }, [])
}
const goTo = (step) => { const u = new URL(window.location.href); u.searchParams.set('onb', step); window.location.href = u.toString() }
const Logo = ({ h = 30 }) => <img src="/insights-logo.png" alt="Insights Software" style={{ height: h, width: 'auto', display: 'inline-block' }} onError={(e) => { e.target.style.display = 'none' }} />
const LogoBar = ({ h = 30 }) => <div style={{ paddingTop: 30, textAlign: 'center', position: 'relative', zIndex: 1 }}><Logo h={h} /></div>

/* ---------- LANDING 1: bienvenida + wizard ---------- */
function Wizard({ supabase, cloudEnabled }) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [f, setF] = useState({ name: '', company: '', email: '', phone: '', address: '', businessDescription: '', goals: '', projectName: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const go = (n) => { setDir(n > step ? 1 : -1); setStep(n); setErr(null) }
  const TOTAL = 4
  const submit = async () => {
    if (!f.projectName.trim()) return
    if (!cloudEnabled) { setErr('No hay conexión con el servidor. Probá de nuevo en un momento.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: res, error } = await supabase.functions.invoke('onboarding-signup', { body: f })
      if (error) throw error
      if (res && res.error) throw new Error(res.error)
      setDone(true)
    } catch (e) { setErr(e.message || 'No se pudo enviar el formulario') } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="onb-wrap" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 22, padding: '60px 22px' }}>
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }} style={{ width: 78, height: 78, borderRadius: 99, background: C.ok, display: 'grid', placeItems: 'center', boxShadow: `0 12px 30px ${C.ok}55` }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease }} className="onb-serif" style={{ fontSize: 'clamp(30px,6vw,44px)', lineHeight: 1.08 }}>¡Listo, {f.name.split(' ')[0] || 'bienvenido'}!</motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease }} style={{ fontSize: 17, color: C.dim, maxWidth: 460, lineHeight: 1.6 }}>Creamos tu proyecto <strong style={{ color: C.ink }}>«{f.projectName}»</strong>. Nuestro equipo ya lo tiene cargado. Ahora mirá el video y agendá tu llamada de arranque.</motion.p>
        <motion.button initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, ease }} className="onb-btn" onClick={() => goTo('presentacion')}>Continuar →</motion.button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LogoBar />
      {step > 0 && <div className="onb-wrap" style={{ marginTop: 18 }}>
        <div className="onb-mono" style={{ fontSize: 11, color: C.faint, textAlign: 'center', marginBottom: 8 }}>Paso {step} de {TOTAL}</div>
        <div style={{ height: 4, borderRadius: 99, background: C.line2, overflow: 'hidden' }}><motion.div animate={{ width: `${(step / TOTAL) * 100}%` }} transition={{ ease }} style={{ height: '100%', background: C.accent, borderRadius: 99 }} /></div>
      </div>}

      <div className="onb-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 22px 60px' }}>
        <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease }}>
          {step === 0 && (
            <motion.div key="0" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.45, ease }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ease }} className="onb-kicker" style={{ marginBottom: 16 }}>Onboarding · Insights Software</motion.div>
              <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, ease }} className="onb-serif" style={{ fontSize: 'clamp(38px,8vw,64px)', lineHeight: 1.04, marginBottom: 18 }}>Bienvenido a<br /><span style={{ color: C.accent }}>Insights</span>.</motion.h1>
              <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, ease }} style={{ fontSize: 18, color: C.dim, lineHeight: 1.6, maxWidth: 500, marginBottom: 30 }}>Vamos a crear tu proyecto en unos pasos rápidos. Contanos de vos y de tu negocio, y en minutos lo tenemos andando de nuestro lado.</motion.p>
              <motion.button initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, ease }} className="onb-btn" onClick={() => go(1)}>Empezar →</motion.button>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="1" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.4, ease }}>
              <h2 className="onb-serif" style={{ fontSize: 'clamp(26px,5vw,36px)', marginBottom: 8 }}>Empecemos por vos</h2>
              <p style={{ color: C.dim, marginBottom: 26, fontSize: 16 }}>Tus datos de contacto.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label className="onb-label">Nombre completo</label><input className="onb-input" value={f.name} onChange={set('name')} placeholder="Ej: Mariano Sabbadin" autoFocus /></div>
                <div><label className="onb-label">Empresa</label><input className="onb-input" value={f.company} onChange={set('company')} placeholder="Ej: Real Deal Exchange" /></div>
              </div>
              <Nav onBack={() => go(0)} onNext={() => go(2)} nextDisabled={!f.name.trim() || !f.company.trim()} />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="2" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.4, ease }}>
              <h2 className="onb-serif" style={{ fontSize: 'clamp(26px,5vw,36px)', marginBottom: 8 }}>¿Cómo te contactamos?</h2>
              <p style={{ color: C.dim, marginBottom: 26, fontSize: 16 }}>Email, teléfono y dirección.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label className="onb-label">Email</label><input className="onb-input" type="email" value={f.email} onChange={set('email')} placeholder="vos@empresa.com" autoFocus /></div>
                <div><label className="onb-label">Teléfono / WhatsApp</label><input className="onb-input" value={f.phone} onChange={set('phone')} placeholder="+1 470 555 0107" /></div>
                <div><label className="onb-label">Dirección completa</label><input className="onb-input" value={f.address} onChange={set('address')} placeholder="Calle, ciudad, estado, país" /></div>
              </div>
              <Nav onBack={() => go(1)} onNext={() => go(3)} nextDisabled={!f.email.trim()} />
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="3" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.4, ease }}>
              <h2 className="onb-serif" style={{ fontSize: 'clamp(26px,5vw,36px)', marginBottom: 8 }}>Contanos de tu negocio</h2>
              <p style={{ color: C.dim, marginBottom: 26, fontSize: 16 }}>Así llegamos preparados a la llamada.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label className="onb-label">¿A qué se dedica tu negocio?</label><textarea className="onb-input" value={f.businessDescription} onChange={set('businessDescription')} placeholder="Describí brevemente qué hacés…" rows={3} autoFocus /></div>
                <div><label className="onb-label">¿Qué querés lograr con el proyecto?</label><textarea className="onb-input" value={f.goals} onChange={set('goals')} placeholder="Tus objetivos principales…" rows={3} /></div>
              </div>
              <Nav onBack={() => go(2)} onNext={() => go(4)} />
            </motion.div>
          )}
          {step === 4 && (
            <motion.div key="4" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.4, ease }}>
              <h2 className="onb-serif" style={{ fontSize: 'clamp(26px,5vw,36px)', marginBottom: 8 }}>Ponele nombre a tu proyecto</h2>
              <p style={{ color: C.dim, marginBottom: 26, fontSize: 16 }}>¿Cómo querés que lo llamemos?</p>
              <div><label className="onb-label">Nombre del proyecto</label><input className="onb-input" value={f.projectName} onChange={set('projectName')} placeholder="Ej: Real Deal Exchange AI" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') submit() }} /></div>
              {err && <div style={{ marginTop: 14, fontSize: 13.5, color: C.red, background: `${C.red}14`, padding: '10px 12px', borderRadius: 10 }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 }}>
                <button className="onb-btn onb-btn-ghost" onClick={() => go(3)}>← Atrás</button>
                <button className="onb-btn" onClick={submit} disabled={busy || !f.projectName.trim()}>{busy ? 'Creando…' : 'Crear mi proyecto ✦'}</button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
function Nav({ onBack, onNext, nextDisabled }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 }}>
      <button className="onb-btn onb-btn-ghost" onClick={onBack}>← Atrás</button>
      <button className="onb-btn" onClick={onNext} disabled={nextDisabled}>Continuar →</button>
    </div>
  )
}

/* ---------- LANDING 2: presentación (video + calendario que se desbloquea a los 4 min) ---------- */
const LOCK_SECS = 240 // 4 minutos
function Presentacion() {
  const [left, setLeft] = useState(LOCK_SECS)
  useEffect(() => { const s = document.createElement('script'); s.src = 'https://link.msgsndr.com/js/form_embed.js'; s.async = true; document.body.appendChild(s); return () => { try { document.body.removeChild(s) } catch (e) {} } }, [])
  useEffect(() => { if (left <= 0) return; const iv = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(iv) }, [left <= 0])
  const unlocked = left <= 0
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0')
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <LogoBar />
      <div className="onb-wrap" style={{ maxWidth: 820, paddingTop: 6 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.5 }} style={{ marginTop: 34, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: C.red, color: '#fff', fontWeight: 800, fontSize: 'clamp(15px,3.4vw,20px)', padding: '8px 16px', borderRadius: 10, letterSpacing: '.02em', boxShadow: `0 8px 24px ${C.red}55`, transform: 'rotate(-1.2deg)' }}>▶ MIRÁ ESTE VIDEO IMPORTANTE</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease, duration: 0.6, delay: 0.1 }} className="onb-card" style={{ marginTop: 22, padding: 'clamp(8px,2vw,12px)', overflow: 'hidden' }}>
          <div style={{ position: 'relative', paddingBottom: '64.7482%', height: 0, borderRadius: 12, overflow: 'hidden' }}>
            <iframe src="https://www.loom.com/embed/20a4804d7a314053beb013ae101425b3" frameBorder="0" allowFullScreen style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} title="Presentación Insights" />
          </div>
        </motion.div>

        {/* alerta timer — distinta a la roja (naranja/branding) */}
        {!unlocked && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.4, delay: 0.2 }}
            style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center', background: `linear-gradient(90deg, ${C.accent}, ${C.accentHi})`, color: '#fff', padding: '14px 20px', borderRadius: 14, boxShadow: `0 10px 30px ${C.accent}44` }}>
            <span style={{ fontSize: 20 }}>⏳</span>
            <span style={{ fontWeight: 700, fontSize: 'clamp(14px,3.4vw,16px)' }}>El siguiente paso se desbloquea en</span>
            <span className="onb-mono" style={{ fontSize: 22, fontWeight: 700, background: 'rgba(255,255,255,.22)', padding: '2px 12px', borderRadius: 8, letterSpacing: '.04em' }}>{mm}:{ss}</span>
            <span style={{ fontSize: 13.5, opacity: .92, width: '100%' }}>Mirá el video completo — al terminar los 4 minutos vas a poder agendar tu llamada.</span>
          </motion.div>
        )}

        <AnimatePresence>
          {unlocked && (
            <motion.div key="cal" initial={{ opacity: 0, y: 20, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} transition={{ ease, duration: 0.6 }} style={{ overflow: 'hidden' }}>
              <div style={{ marginTop: 44, textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: C.ok + '18', color: C.ok, fontWeight: 700, fontSize: 13.5, padding: '6px 14px', borderRadius: 99, marginBottom: 14 }}>✓ Desbloqueado</div>
                <div className="onb-kicker" style={{ marginBottom: 10 }}>Siguiente paso</div>
                <h2 className="onb-serif" style={{ fontSize: 'clamp(26px,5.5vw,40px)', marginBottom: 8 }}>Agendá tu llamada de arranque</h2>
                <p style={{ color: C.dim, fontSize: 'clamp(15px,3.4vw,16px)', maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.6 }}>Elegí un horario para hablar con Nacho, tu Project Manager. En esa llamada definimos el plan de trabajo.</p>
              </div>
              <div className="onb-card" style={{ overflow: 'hidden', padding: 4 }}>
                <iframe src="https://api.leadconnectorhq.com/widget/booking/vsD3uHw8TYyGAH2CMcL2" style={{ width: '100%', border: 'none', overflow: 'hidden', minHeight: 680, borderRadius: 14 }} scrolling="no" title="Agendar llamada" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------- LANDING 3: gracias + qué preparar ---------- */
function Gracias() {
  const prep = [
    { n: 1, title: 'Creá tu cuenta de Supabase', desc: 'Es donde va a vivir la base de datos de tu proyecto. Registrate gratis con tu email o con Google.', href: 'https://supabase.com/dashboard/sign-up', cta: 'Crear cuenta en Supabase', logo: 'https://supabase.com/favicon/favicon-32x32.png' },
    { n: 2, title: 'Creá tu cuenta de GitHub', desc: 'Es donde se guarda el código de tu proyecto. Registrate gratis; con eso alcanza para arrancar.', href: 'https://github.com/signup', cta: 'Crear cuenta en GitHub', logo: 'https://github.githubassets.com/favicons/favicon-dark.png' },
  ]
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 90 }}>
      <LogoBar />
      <div className="onb-wrap" style={{ paddingTop: 6, maxWidth: 720 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.5 }} style={{ marginTop: 34, textAlign: 'center' }}>
          <div className="onb-kicker" style={{ marginBottom: 14 }}>Reunión agendada ✓</div>
          <h1 className="onb-serif" style={{ fontSize: 'clamp(34px,7vw,52px)', lineHeight: 1.06, marginBottom: 14 }}>¡Gracias por agendar!</h1>
          <p style={{ color: C.dim, fontSize: 17, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>Nacho te va a estar esperando en la llamada. Mientras tanto, mirá este mensaje y dejá listo lo de abajo.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease, duration: 0.6, delay: 0.1 }} className="onb-card" style={{ marginTop: 30, padding: 12 }}>
          {/* Video de Nacho — reemplazar el embed cuando lo tengas */}
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', background: 'repeating-linear-gradient(45deg,#f0ece5,#f0ece5 12px,#eae5dd 12px,#eae5dd 24px)', display: 'grid' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: C.dim, padding: 20 }}>
              <div><div style={{ fontSize: 40, marginBottom: 8 }}>🎬</div><div className="onb-mono" style={{ fontSize: 12.5 }}>VIDEO DE NACHO · pendiente<br /><span style={{ color: C.faint }}>(pegá acá el embed de Loom cuando lo tengas)</span></div></div>
            </div>
          </div>
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.5, delay: 0.2 }} className="onb-serif" style={{ fontSize: 'clamp(24px,4.5vw,32px)', marginTop: 48, marginBottom: 6 }}>Lo que tenés que llevar preparado</motion.h2>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.5, delay: 0.24 }} style={{ color: C.dim, fontSize: 16, marginBottom: 24, lineHeight: 1.6 }}>Antes de la llamada, dejá creadas estas dos cuentas (son gratis y toman 2 minutos cada una):</motion.p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {prep.map((s, i) => (
            <motion.div key={s.n} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.5, delay: 0.3 + i * 0.1 }} className="onb-card" style={{ padding: 20, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: C.accent, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18 }}>{s.n}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{s.title}</div>
                <div style={{ color: C.dim, fontSize: 14.5, lineHeight: 1.55 }}>{s.desc}</div>
              </div>
              <a href={s.href} target="_blank" rel="noreferrer" className="onb-btn" style={{ fontSize: 14.5, padding: '11px 20px', flexShrink: 0 }}>{s.cta} ↗</a>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ marginTop: 30, textAlign: 'center', color: C.faint, fontSize: 13.5 }} className="onb-mono">Con eso alcanza. Nos vemos en la llamada. — Insights Software</motion.div>
      </div>
    </div>
  )
}

export default function OnboardingLanding({ step, supabase, cloudEnabled }) {
  useInjectCss()
  return (
    <div className="onb">
      {step === 'presentacion' ? <Presentacion />
        : step === 'gracias' ? <Gracias />
          : <Wizard supabase={supabase} cloudEnabled={cloudEnabled} />}
    </div>
  )
}
