import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import 'react-phone-number-input/style.css'

/* ============================================================================
   ONBOARDING · REDISEÑO (v2) — estilo SaaS premium (Typeform / Linear / Vercel)
   Ruta: ?onbx=1   ·  No toca el onboarding actual (?onb=)
   Esta tanda: shell + S0 (bienvenida) + S1–S4 (inputs). El resto (S5–S8) sigue después.
============================================================================ */

const ONBX_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
.ob2, .ob2 *{box-sizing:border-box}
.ob2{
  --bg:#0f0f0d; --surface:#18160f; --surface-2:#1c1a13; --border:rgba(255,255,255,.08);
  --text:#f0ede8; --text-2:#9a9289; --orange:#e57300; --orange-2:#f08c1f; --gold:#f5d080;
  font-family:'Inter',system-ui,-apple-system,sans-serif; color:var(--text); background:var(--bg);
  min-height:100vh; min-height:100dvh; position:relative; overflow-x:hidden;
}
.ob2-blob{position:fixed;border-radius:50%;filter:blur(100px);opacity:.5;pointer-events:none;z-index:0;will-change:transform}
.ob2-grain{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.04;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.ob2-vignette{position:fixed;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse 90% 70% at 50% 42%, transparent 46%, rgba(0,0,0,.55) 100%)}
.ob2-mono{font-family:'DM Mono',monospace}
.ob2-eyebrow{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--orange-2)}
.ob2-h{font-weight:700;letter-spacing:-.035em;line-height:1.04;font-size:clamp(30px,6.6vw,52px);margin:0}
.ob2-sub{color:var(--text-2);font-size:clamp(15px,2.4vw,18px);line-height:1.6;margin:0}
.ob2-label{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.08em;color:var(--text-2);margin-bottom:9px;display:block;text-transform:uppercase}
.ob2-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;font-size:17px;color:var(--text);font-family:inherit;outline:none;transition:border-color .18s, box-shadow .18s}
.ob2-input::placeholder{color:#6b655c}
.ob2-input:focus{border-color:var(--orange);box-shadow:0 0 0 4px rgba(229,115,0,.18)}
.ob2-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:15px 30px;border-radius:999px;border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:16px;background:linear-gradient(180deg,var(--orange-2),var(--orange));color:#fff;transition:transform .16s, box-shadow .16s, filter .16s;box-shadow:0 8px 26px rgba(229,115,0,.34)}
.ob2-btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(229,115,0,.5)}
.ob2-btn:active{transform:translateY(0)}
.ob2-btn:disabled{opacity:.4;cursor:not-allowed;box-shadow:none;transform:none;filter:grayscale(.35)}
.ob2-btn-ghost{background:transparent;color:var(--text-2);border:1px solid var(--border);box-shadow:none;font-weight:500}
.ob2-btn-ghost:hover{background:var(--surface);color:var(--text);transform:none;box-shadow:none}
.ob2-err{color:#ff8a6b;font-size:13px;margin-top:9px;font-family:'DM Mono',monospace}
.ob2-steplink{cursor:default}
.ob2-steplink.done{cursor:pointer}
/* selector de teléfono con país — dark */
.ob2 .PhoneInput{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:5px 14px;transition:border-color .18s, box-shadow .18s}
.ob2 .PhoneInput--focus{border-color:var(--orange);box-shadow:0 0 0 4px rgba(229,115,0,.18)}
.ob2 .PhoneInputInput{background:transparent;border:none;outline:none;color:var(--text);font-size:17px;font-family:inherit;padding:11px 0}
.ob2 .PhoneInputInput::placeholder{color:#6b655c}
.ob2 .PhoneInputCountry{margin-right:2px}
.ob2 .PhoneInputCountryIcon{box-shadow:none;border-radius:3px;overflow:hidden}
.ob2 .PhoneInputCountryIcon--border{background:transparent;box-shadow:none}
.ob2 .PhoneInputCountrySelectArrow{color:var(--text-2);opacity:.8;border-color:currentColor}
.ob2 .PhoneInputCountrySelect{color:#111}
/* en desktop reservamos el ancho del rail para que no tape el contenido */
@media(min-width:1024px){ .ob2-main{padding-right:312px!important} }
@media (prefers-reduced-motion: reduce){ .ob2 *{animation-duration:.001ms!important} }
`

const STEPS = [
  { key: 'name', label: 'Tu nombre' },
  { key: 'company', label: 'Tu empresa' },
  { key: 'contact', label: 'Contacto' },
  { key: 'project', label: 'Tu proyecto' },
]
const STORE_KEY = 'onbx_state_v1'
const ease = [0.16, 1, 0.3, 1]
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim())

function useInjectCss() {
  useEffect(() => {
    if (!document.getElementById('onbx-css')) {
      const el = document.createElement('style'); el.id = 'onbx-css'; el.textContent = ONBX_CSS; document.head.appendChild(el)
    }
    document.documentElement.style.colorScheme = 'dark'
    document.body.style.background = '#0f0f0d'
    const prevTitle = document.title
    document.title = 'Insights Apps — Onboarding'
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta) }
    meta.setAttribute('content', 'Onboarding de Insights Apps — creá tu proyecto y agendá tu llamada de arranque.')
    return () => { document.title = prevTitle }
  }, [])
}

const Logo = ({ h = 32 }) => (
  <img src="/insights-logo-white.png" alt="Insights Apps" style={{ height: h, width: 'auto', display: 'inline-block', opacity: 1 }}
    onError={(e) => { e.target.style.display = 'none' }} />
)

/* ---------- fondo premium: blobs naranjas que respiran + grano + viñeta ---------- */
function Blobs() {
  const reduce = useReducedMotion()
  const drift = (dur, xk, yk, sk) => reduce ? {} : { animate: { x: xk, y: yk, scale: sk }, transition: { duration: dur, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' } }
  return (
    <>
      <motion.div className="ob2-blob" style={{ width: 560, height: 560, top: -180, left: -140, background: 'radial-gradient(circle, rgba(229,115,0,.32), transparent 70%)' }} {...drift(26, [0, 60, 0], [0, 40, 0], [1, 1.14, 1])} />
      <motion.div className="ob2-blob" style={{ width: 440, height: 440, bottom: -150, right: -110, background: 'radial-gradient(circle, rgba(240,140,31,.24), transparent 70%)' }} {...drift(32, [0, -50, 0], [0, -30, 0], [1, 1.18, 1])} />
      <motion.div className="ob2-blob" style={{ width: 380, height: 380, top: '42%', left: '54%', background: 'radial-gradient(circle, rgba(245,208,128,.12), transparent 70%)' }} {...drift(38, [0, 40, 0], [0, -50, 0], [1.08, 1, 1.08])} />
      <div className="ob2-grain" />
      <div className="ob2-vignette" />
    </>
  )
}

/* ---------- stepper vertical (desktop, derecha) ---------- */
function DesktopRail({ current, onGo }) {
  const activeIdx = current - 1 // step 1..4 → 0..3
  return (
    <div className="ob2-rail-desktop" style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 288, padding: '0 44px', display: 'none', flexDirection: 'column', justifyContent: 'center', zIndex: 3 }}>
      <div className="ob2-eyebrow" style={{ marginBottom: 22, opacity: .8 }}>Tu progreso</div>
      <div style={{ position: 'relative' }}>
        {/* línea base + relleno */}
        <div style={{ position: 'absolute', left: 15, top: 14, bottom: 14, width: 2, background: 'var(--border)' }} />
        <motion.div style={{ position: 'absolute', left: 15, top: 14, width: 2, background: 'linear-gradient(var(--orange-2),var(--orange))', transformOrigin: 'top' }}
          animate={{ height: `calc(${Math.max(0, activeIdx) / (STEPS.length - 1) * 100}% - 0px)` }} transition={{ ease, duration: 0.5 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, position: 'relative' }}>
          {STEPS.map((s, i) => {
            const done = i < activeIdx, active = i === activeIdx
            return (
              <button key={s.key} onClick={() => done && onGo(i + 1)} className={`ob2-steplink ${done ? 'done' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'transparent', border: 'none', padding: 0, textAlign: 'left' }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
                  background: active ? 'var(--orange)' : done ? 'rgba(229,115,0,.15)' : 'var(--surface)',
                  border: `1.5px solid ${active ? 'var(--orange)' : done ? 'var(--orange)' : 'var(--border)'}`,
                  color: active ? '#fff' : done ? 'var(--orange-2)' : 'var(--text-2)', transition: 'all .2s' }}>
                  {done ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg> : i + 1}
                </span>
                <span style={{ fontSize: 14.5, fontWeight: active ? 600 : 500, color: active ? 'var(--text)' : done ? 'var(--text-2)' : 'var(--text-2)' }}>{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <style>{`@media(min-width:1024px){.ob2-rail-desktop{display:flex!important}}`}</style>
    </div>
  )
}

/* ---------- progress flotante (mobile, abajo) ---------- */
function MobileProgress({ current }) {
  const pct = (current / STEPS.length) * 100
  return (
    <div className="ob2-progress-mobile" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 4, display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderRadius: 999, background: 'rgba(24,22,15,.78)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,.5)' }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
        <motion.div animate={{ width: `${pct}%` }} transition={{ ease, duration: 0.5 }} style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,var(--orange-2),var(--orange))', boxShadow: '0 0 12px rgba(229,115,0,.6)' }} />
      </div>
      <span className="ob2-mono" style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Paso {current} de {STEPS.length}</span>
      <style>{`@media(min-width:1024px){.ob2-progress-mobile{display:none!important}}`}</style>
    </div>
  )
}

/* ---------- ícono IA (sparkles) ---------- */
const Sparkles = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" /><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
  </svg>
)

/* ---------- botones de navegación ---------- */
function NavRow({ onBack, onNext, nextLabel = 'Continuar', nextDisabled, nextIcon, back = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
      {back && <button className="ob2-btn ob2-btn-ghost" onClick={onBack} type="button">← Atrás</button>}
      <button className="ob2-btn" onClick={onNext} disabled={nextDisabled} type="button" style={nextIcon ? { boxShadow: '0 8px 26px rgba(229,115,0,.34), 0 0 0 0 rgba(229,115,0,.4)' } : undefined}>
        {nextIcon && (
          <motion.span animate={{ scale: [1, 1.18, 1], opacity: [.85, 1, .85] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-flex', color: '#fff' }}>
            <Sparkles size={17} />
          </motion.span>
        )}
        {nextLabel} {!nextIcon && '→'}
      </button>
    </div>
  )
}

export default function OnboardingV2({ supabase, cloudEnabled }) {
  useInjectCss()
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [f, setF] = useState({ name: '', company: '', phone: '', email: '', projectName: '' })
  const [err, setErr] = useState('')
  const hydrated = useRef(false)

  // hidratar desde localStorage (retomar donde quedó)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (raw) { const s = JSON.parse(raw); if (s && s.f) { setF((p) => ({ ...p, ...s.f })); if (typeof s.step === 'number') setStep(Math.min(s.step, 4)) } }
    } catch (e) { /* ignore */ }
    hydrated.current = true
  }, [])
  // persistir
  useEffect(() => { if (!hydrated.current) return; try { localStorage.setItem(STORE_KEY, JSON.stringify({ step, f })) } catch (e) { /* ignore */ } }, [step, f])

  const set = useCallback((k, v) => setF((s) => ({ ...s, [k]: v })), [])

  const validFor = useCallback((n) => {
    if (n === 1) return f.name.trim().length > 0
    if (n === 2) return f.company.trim().length > 0
    if (n === 3) return !!f.phone && isValidPhoneNumber(f.phone) && emailOk(f.email)
    if (n === 4) return f.projectName.trim().length > 0
    return true
  }, [f])

  const go = useCallback((n) => { setDir(n > step ? 1 : -1); setErr(''); setStep(n) }, [step])
  const next = useCallback(() => {
    if (step >= 1 && step <= 4 && !validFor(step)) {
      setErr(step === 3 ? 'Revisá el teléfono y el email — ambos son obligatorios y deben ser válidos.' : 'Este campo es obligatorio para continuar.')
      return
    }
    if (step === 4) { /* S5+ (construcción) llega en la próxima tanda */ setStep(5); return }
    go(step + 1)
  }, [step, validFor, go])
  const back = useCallback(() => go(Math.max(0, step - 1)), [go, step])

  const onEnter = useCallback((e) => { if (e.key === 'Enter') { e.preventDefault(); next() } }, [next])

  const anim = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, x: dir * 44 }, animate: { opacity: 1, x: 0 }, transition: { ease, duration: 0.45 } }

  const showProgress = step >= 1 && step <= 4

  return (
    <div className="ob2">
      <Blobs />
      {/* logo centrado arriba */}
      <div style={{ position: 'absolute', top: 26, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5, pointerEvents: 'none' }}><Logo /></div>

      {showProgress && <DesktopRail current={step} onGo={go} />}
      {showProgress && <MobileProgress current={step} />}

      <main className={showProgress ? 'ob2-main' : undefined} style={{ position: 'relative', zIndex: 2, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 22px 120px' }}>
        <div className="ob2-main-inner" style={{ width: '100%', maxWidth: 540 }}>
          <motion.div key={step} initial={anim.initial} animate={anim.animate} transition={anim.transition}>

            {step === 0 && (
              <div style={{ textAlign: 'center' }}>
                <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, ease }} className="ob2-h" style={{ fontSize: 'clamp(40px,9vw,66px)', marginBottom: 18 }}>Bienvenido a<br /><span style={{ color: 'var(--orange)' }}>Insights</span></motion.h1>
                <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, ease }} className="ob2-sub" style={{ maxWidth: 460, margin: '0 auto 34px' }}>Comenzá acá el proceso para hacer realidad tu aplicación.</motion.p>
                <motion.button initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, ease }} className="ob2-btn" onClick={() => go(1)} style={{ padding: '16px 40px', fontSize: 17 }}>Comenzar →</motion.button>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="ob2-eyebrow" style={{ marginBottom: 14 }}>Paso 1 de 4</div>
                <h1 className="ob2-h" style={{ marginBottom: 26 }}>Empecemos por tu nombre</h1>
                <label className="ob2-label">Nombre completo</label>
                <input className="ob2-input" value={f.name} onChange={(e) => set('name', e.target.value)} onKeyDown={onEnter} placeholder="(Tu nombre acá)" autoFocus />
                {err && <div className="ob2-err">{err}</div>}
                <NavRow onBack={back} onNext={next} nextDisabled={!validFor(1)} />
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="ob2-eyebrow" style={{ marginBottom: 14 }}>Paso 2 de 4</div>
                <h1 className="ob2-h" style={{ marginBottom: 26 }}>¿Cómo se llama tu empresa?</h1>
                <label className="ob2-label">Nombre de tu empresa</label>
                <input className="ob2-input" value={f.company} onChange={(e) => set('company', e.target.value)} onKeyDown={onEnter} placeholder="(Tu empresa acá)" autoFocus />
                {err && <div className="ob2-err">{err}</div>}
                <NavRow onBack={back} onNext={next} nextDisabled={!validFor(2)} />
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="ob2-eyebrow" style={{ marginBottom: 14 }}>Paso 3 de 4</div>
                <h1 className="ob2-h" style={{ marginBottom: 26 }}>Tus lugares principales de contacto</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label className="ob2-label">Teléfono</label>
                    <PhoneInput international defaultCountry="US" flags={flags} value={f.phone} onChange={(v) => set('phone', v || '')} placeholder="Número de teléfono" />
                    {f.phone && !isValidPhoneNumber(f.phone) && <div className="ob2-err">Número de teléfono inválido para el país elegido.</div>}
                  </div>
                  <div>
                    <label className="ob2-label">Email</label>
                    <input className="ob2-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} onKeyDown={onEnter} placeholder="vos@empresa.com" />
                    {f.email && !emailOk(f.email) && <div className="ob2-err">Email con formato inválido.</div>}
                  </div>
                </div>
                {err && <div className="ob2-err">{err}</div>}
                <NavRow onBack={back} onNext={next} nextDisabled={!validFor(3)} />
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="ob2-eyebrow" style={{ marginBottom: 14 }}>Paso 4 de 4</div>
                <h1 className="ob2-h" style={{ marginBottom: 12 }}>¿Qué nombre le ponemos a tu proyecto?</h1>
                <p className="ob2-sub" style={{ marginBottom: 24, fontSize: 15 }}>Si todavía no lo tenés claro, podés poner el nombre de tu empresa.</p>
                <label className="ob2-label">Nombre del proyecto</label>
                <input className="ob2-input" value={f.projectName} onChange={(e) => set('projectName', e.target.value)} onKeyDown={onEnter} placeholder="Ej: Real Deal Exchange" autoFocus />
                {err && <div className="ob2-err">{err}</div>}
                <NavRow onBack={back} onNext={next} nextDisabled={!validFor(4)} nextLabel="Crear mi proyecto" nextIcon />
              </div>
            )}

            {step === 5 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', color: 'var(--orange)', marginBottom: 18 }}><Sparkles size={34} /></div>
                <h1 className="ob2-h" style={{ fontSize: 'clamp(24px,5vw,34px)', marginBottom: 14 }}>Vista previa lista ✦</h1>
                <p className="ob2-sub" style={{ maxWidth: 440, margin: '0 auto 26px' }}>Terminaste los 4 pasos de datos. Las próximas pantallas (construcción del proyecto, tu equipo, agenda y gracias) llegan en la siguiente etapa del rediseño.</p>
                <button className="ob2-btn ob2-btn-ghost" onClick={() => go(1)} type="button">← Volver a revisar</button>
              </div>
            )}

          </motion.div>
        </div>
      </main>
    </div>
  )
}
