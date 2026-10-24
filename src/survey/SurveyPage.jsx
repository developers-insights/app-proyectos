import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BLOCKS, COPY } from './questions.js'
import {
  OTHER, visibleQuestions, canAdvance, isAnswered, otherKey, pruneAnswers, toggleMulti,
  minutesLeft, totalMinutes, firstUnanswered, blockProgress,
} from './model.js'
import { SURVEY_CSS } from './surveyCss.js'

const EASE = [0.22, 1, 0.36, 1]
const localKey = (token) => `encuesta_${token}`

function readLocal(token) {
  try { return JSON.parse(localStorage.getItem(localKey(token)) || 'null') } catch (e) { return null }
}
function writeLocal(token, value) {
  try { value ? localStorage.setItem(localKey(token), JSON.stringify(value)) : localStorage.removeItem(localKey(token)) } catch (e) { /* modo privado */ }
}

function useSurveyCss() {
  useEffect(() => {
    if (!document.getElementById('sv-font')) {
      const l = document.createElement('link')
      l.id = 'sv-font'
      l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap'
      document.head.appendChild(l)
    }
    if (document.getElementById('sv-css')) return
    const el = document.createElement('style')
    el.id = 'sv-css'
    el.textContent = SURVEY_CSS
    document.head.appendChild(el)
  }, [])
}

const Check = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12.5l4.2 4.2L19 7" /></svg>
)
const Arrow = ({ dir = 'right', ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === 'left' ? 'scaleX(-1)' : 'none' }} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

function Wordmark() {
  return <span className="sv-mark" aria-label="Insights">insights<i>.</i></span>
}

function Shell({ lang, setLang, status, children }) {
  const t = COPY[lang]
  return (
    <div className="sv" lang={lang}>
      <div className="sv-wash" aria-hidden="true" />
      <div className="sv-grain" aria-hidden="true" />
      <header className="sv-top">
        <Wordmark />
        <div className="sv-top-r">
          {status && <span className="sv-save" data-s={status} role="status">{status === 'saving' ? t.saving : status === 'offline' ? t.offline : t.saved}</span>}
          {setLang && (
            <button type="button" className="sv-lang" onClick={() => setLang(lang === 'es' ? 'en' : 'es')} lang={lang === 'es' ? 'en' : 'es'}>
              {t.lang}
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  )
}

function Message({ lang, setLang, title, body, foot, tone }) {
  const reduce = useReducedMotion()
  return (
    <Shell lang={lang} setLang={setLang}>
      <main className="sv-center">
        <motion.div className="sv-msg" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          {tone === 'done' && (
            <motion.span className="sv-seal" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}>
              <Check width={30} height={30} />
            </motion.span>
          )}
          <h1 className="sv-h1">{title}</h1>
          <p className="sv-lead">{body}</p>
          {foot && <p className="sv-foot">{foot}</p>}
        </motion.div>
      </main>
    </Shell>
  )
}

function Options({ q, lang, answers, setAnswer, onAutoAdvance }) {
  const t = COPY[lang]
  const value = answers[q.id]
  const multi = q.type === 'multi'
  const [warn, setWarn] = useState(false)
  const opts = [...q.options, ...(q.other ? [{ id: OTHER, es: COPY.es.otherLabel, en: COPY.en.otherLabel }] : [])]
  const picked = (id) => (multi ? Array.isArray(value) && value.includes(id) : value === id)
  const otherOpen = picked(OTHER)

  const choose = (id) => {
    if (multi) {
      const r = toggleMulti(value, id, q.max)
      setWarn(r.blocked)
      if (!r.blocked) setAnswer(q.id, r.value)
      return
    }
    setAnswer(q.id, id)
    if (id !== OTHER) onAutoAdvance()
  }

  return (
    <>
      <div className="sv-opts" role={multi ? 'group' : 'radiogroup'} aria-labelledby={`q-${q.id}`}>
        {opts.map((op) => (
          <button key={op.id} type="button" className="sv-opt" data-on={picked(op.id) ? '1' : '0'} data-multi={multi ? '1' : '0'}
            role={multi ? 'checkbox' : 'radio'} aria-checked={picked(op.id)} onClick={() => choose(op.id)}>
            <span className="sv-tick" aria-hidden="true"><Check width={14} height={14} /></span>
            <span>{op[lang]}</span>
          </button>
        ))}
      </div>
      {otherOpen && (
        <input className="sv-input sv-other" autoFocus value={answers[otherKey(q)] || ''} maxLength={300}
          placeholder={t.otherPlaceholder} aria-label={t.otherPlaceholder}
          onChange={(e) => setAnswer(otherKey(q), e.target.value)} />
      )}
      <p className="sv-warn" aria-live="polite">{warn ? t.maxReached(q.max) : ''}</p>
    </>
  )
}

function Scale({ q, lang, value, setAnswer, onAutoAdvance }) {
  const steps = []
  for (let v = q.min; v <= q.max; v++) steps.push(v)
  return (
    <div className="sv-scale-wrap">
      <div className="sv-scale" data-n={steps.length} role="radiogroup" aria-labelledby={`q-${q.id}`}>
        {steps.map((v) => (
          <button key={v} type="button" className="sv-step" role="radio" aria-checked={value === v} data-on={value === v ? '1' : '0'}
            onClick={() => { setAnswer(q.id, v); onAutoAdvance() }}>
            {v}
          </button>
        ))}
      </div>
      <div className="sv-scale-ends" aria-hidden="true"><span>{q[lang].low}</span><span>{q[lang].high}</span></div>
    </div>
  )
}

function TextAnswer({ q, lang, value, setAnswer }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [value])
  return (
    <textarea ref={ref} className="sv-input sv-text" rows={4} maxLength={2000} value={value || ''}
      placeholder={q[lang].placeholder || ''} aria-labelledby={`q-${q.id}`}
      onChange={(e) => setAnswer(q.id, e.target.value)} />
  )
}

export default function SurveyPage({ supabase, token }) {
  useSurveyCss()
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState('loading')
  const [meta, setMeta] = useState({ project: '', contact: '' })
  const [lang, setLangState] = useState(() => (typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '') ? 'en' : 'es'))
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [saveState, setSaveState] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const timer = useRef(null)
  const advanceTimer = useRef(null)
  const latest = useRef({ answers: {}, lang: 'es' })
  const headRef = useRef(null)

  useEffect(() => {
    let alive = true
    if (!supabase) { setPhase('invalid'); return undefined }
    supabase.rpc('survey_public_get', { p_token: token }).then(({ data, error }) => {
      if (!alive) return
      if (error || !data?.ok) { setPhase('invalid'); return }
      if (data.lang) setLangState(data.lang)
      setMeta({ project: data.project || '', contact: data.contact || '' })
      if (data.completed) { writeLocal(token, null); setPhase('closed'); return }
      const local = readLocal(token)
      const merged = { ...(data.answers || {}), ...(local?.answers || {}) }
      setAnswers(merged)
      setPhase('intro')
    })
    return () => { alive = false }
  }, [supabase, token])

  useEffect(() => { latest.current = { answers, lang } }, [answers, lang])

  const persist = useCallback(async (complete = false) => {
    const { answers: a, lang: l } = latest.current
    if (!supabase) return false
    setSaveState('saving')
    const { data, error } = await supabase.rpc('survey_public_save', {
      p_token: token, p_answers: pruneAnswers(a), p_lang: l, p_complete: complete,
    })
    if (error || !data?.ok) { setSaveState('offline'); return false }
    setSaveState('saved')
    return true
  }, [supabase, token])

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; persist(false) }, 900)
  }, [persist])

  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden' && timer.current) { clearTimeout(timer.current); timer.current = null; persist(false) } }
    document.addEventListener('visibilitychange', flush)
    const retry = () => { if (saveState === 'offline') persist(false) }
    window.addEventListener('online', retry)
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('online', retry) }
  }, [persist, saveState])

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(advanceTimer.current) }, [])

  const setAnswer = useCallback((key, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value }
      writeLocal(token, { answers: next, at: Date.now() })
      return next
    })
    schedule()
  }, [schedule, token])

  const setLang = (l) => { setLangState(l); schedule() }

  const qs = useMemo(() => visibleQuestions(answers), [answers])
  const q = qs[Math.min(index, qs.length - 1)]
  const isLast = index >= qs.length - 1
  const t = COPY[lang]

  useEffect(() => {
    if (phase === 'q' && headRef.current) headRef.current.focus({ preventScroll: true })
  }, [index, phase])

  const go = useCallback((delta) => {
    clearTimeout(advanceTimer.current)
    setDir(delta)
    setIndex((i) => Math.max(0, Math.min(i + delta, visibleQuestions(latest.current.answers).length - 1)))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [reduce])

  const finish = useCallback(async () => {
    clearTimeout(timer.current)
    timer.current = null
    setSending(true); setSendError(false)
    const ok = await persist(true)
    setSending(false)
    if (!ok) { setSendError(true); return }
    writeLocal(token, null)
    setPhase('done')
  }, [persist, token])

  const autoAdvance = useCallback(() => {
    if (isLast) return
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => go(1), reduce ? 120 : 340)
  }, [go, isLast, reduce])

  const next = () => (isLast ? finish() : go(1))

  const onKey = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return
    if (q && canAdvance(q, answers)) { e.preventDefault(); next() }
  }

  if (phase === 'loading') {
    return <Shell lang={lang}><main className="sv-center"><span className="sv-loader" aria-label="Cargando" /></main></Shell>
  }
  if (phase === 'invalid') return <Message lang={lang} setLang={setLangState} title={t.invalidTitle} body={t.invalidBody} />
  if (phase === 'closed') return <Message lang={lang} setLang={setLangState} title={t.closedTitle} body={t.closedBody} tone="done" />
  if (phase === 'done') return <Message lang={lang} setLang={setLangState} title={t.doneTitle} body={t.doneBody} foot={t.doneFoot} tone="done" />

  if (phase === 'intro') {
    const hasProgress = Object.keys(pruneAnswers(answers)).length > 0
    const startAt = hasProgress ? firstUnanswered(answers) : 0
    return (
      <Shell lang={lang} setLang={setLang}>
        <main className="sv-center">
          <motion.div className="sv-intro" initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            <p className="sv-eyebrow">{t.hello(meta.contact)}</p>
            <h1 className="sv-h1">{t.introTitle}</h1>
            <p className="sv-lead">{t.introBody(meta.project)}</p>
            <ul className="sv-facts">
              <li>{t.introMeta(totalMinutes())}</li>
              <li>{t.introFoot}</li>
            </ul>
            <button type="button" className="sv-cta" onClick={() => { setDir(1); setIndex(startAt); setPhase('q') }}>
              {hasProgress ? t.resume : t.start}<Arrow width={18} height={18} />
            </button>
          </motion.div>
        </main>
      </Shell>
    )
  }

  const block = BLOCKS.find((b) => b.id === q.block)
  const progress = blockProgress(index, answers)
  const ready = canAdvance(q, answers)
  const answered = isAnswered(q, answers)
  const showNext = q.type === 'multi' || q.type === 'text' || answers[q.id] === OTHER || isLast || answered

  return (
    <Shell lang={lang} setLang={setLang} status={saveState}>
      <div className="sv-progress" aria-label={t.left(minutesLeft(index, answers))}>
        <div className="sv-bars">
          {progress.map((p) => (
            <span key={p.id} className="sv-bar"><motion.i initial={false} animate={{ scaleX: p.fill }} transition={{ duration: reduce ? 0 : 0.5, ease: EASE }} /></span>
          ))}
        </div>
        <div className="sv-progress-meta">
          <span>{block[lang]}</span>
          <span>{t.left(minutesLeft(index, answers))}</span>
        </div>
      </div>

      <main className="sv-main" onKeyDown={onKey}>
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section key={q.id} className="sv-q" custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: dir > 0 ? 22 : -22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: dir > 0 ? -14 : 14 }}
            transition={{ duration: reduce ? 0.12 : 0.32, ease: EASE }}>
            <h2 id={`q-${q.id}`} className="sv-qt" tabIndex={-1} ref={headRef}>{q[lang].q}</h2>
            {(q[lang].hint || q.optional) && (
              <p className="sv-hint">
                {q.optional && <span className="sv-tag">{t.optional}</span>}
                {q[lang].hint}
              </p>
            )}
            {(q.type === 'single' || q.type === 'multi') && <Options q={q} lang={lang} answers={answers} setAnswer={setAnswer} onAutoAdvance={autoAdvance} />}
            {q.type === 'scale' && <Scale q={q} lang={lang} value={answers[q.id]} setAnswer={setAnswer} onAutoAdvance={autoAdvance} />}
            {q.type === 'text' && <TextAnswer q={q} lang={lang} value={answers[q.id]} setAnswer={setAnswer} />}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="sv-nav">
        <div className="sv-nav-in">
          <button type="button" className="sv-back" onClick={() => (index === 0 ? setPhase('intro') : go(-1))}>
            <Arrow dir="left" width={18} height={18} />{t.back}
          </button>
          {sendError && <span className="sv-err" role="alert">{t.errorSend}</span>}
          {showNext && (
            <button type="button" className="sv-cta sv-cta-sm" disabled={!ready || sending} onClick={next}>
              {sending ? t.sending : isLast ? t.finish : (q.optional && !answered ? t.skip : t.next)}
              {!sending && <Arrow width={18} height={18} />}
            </button>
          )}
        </div>
      </footer>
    </Shell>
  )
}
