/**
 * ClientIntake.jsx — el cuestionario de despliegue, del lado del cliente.
 *
 * Vive dentro de la vista compartida del proyecto (`?share=…`), o sea que el
 * cliente ya entró con su contraseña: la puerta es la misma y no le pedimos
 * nada de nuevo.
 *
 * DECISIÓN DE FORMA. Un documento con veinte preguntas no se contesta: se
 * archiva. Así que esto muestra UNA pregunta por pantalla, con la respuesta
 * recomendada ya elegida, y un botón grande para aceptarla. El caso feliz —el
 * cliente está de acuerdo con lo que sugerimos— es un toque por pregunta.
 *
 * Guarda solo, pregunta por pregunta. No hay "Enviar" al final, porque el
 * formulario que se pierde a mitad es el que no se vuelve a empezar. Se puede
 * cerrar la pestaña en la pregunta 7 y volver mañana.
 *
 * `action` no es una pregunta sino algo que el cliente tiene que ir a hacer
 * afuera; se responde con "ya lo hice" y por eso arranca primero: mientras eso
 * no esté, lo demás no mueve la aguja.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { I2 } from './ui/icons2.jsx'
import { intakeFor, isAnswered, intakeProgress, pendingUrgent } from './lib/intake.js'

/* ── utilidades de presentación ─────────────────────────────────────────── */

/** Negritas y `código` en los textos del cuestionario. Nada más: no es Markdown. */
function RichText({ children }) {
  const parts = String(children || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} style={{ color: 'var(--text)' }}>{p.slice(2, -2)}</strong>
        if (p.startsWith('`') && p.endsWith('`'))
          return (
            <code key={i} className="mono" style={{ fontSize: '0.92em', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 5px' }}>
              {p.slice(1, -1)}
            </code>
          )
        return <React.Fragment key={i}>{p}</React.Fragment>
      })}
    </>
  )
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim())

/** El resorte que usa todo el flujo. Un solo lugar para que el movimiento sea uno solo. */
const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }

/**
 * La salida NO usa el resorte. Con `AnimatePresence mode="wait"` la pregunta
 * siguiente no monta hasta que la anterior terminó de irse, y un resorte tarda en
 * asentarse: medido en pantalla, pasar de una pregunta a otra se sentía casi dos
 * segundos, con el contador ya en la siguiente y el texto todavía en la anterior.
 * Un tween corto saca la vieja de encima y deja que el resorte se luzca donde se
 * nota, que es en la entrada.
 */
const EXIT = { duration: 0.12, ease: 'easeIn' }

/* ── el cuestionario ────────────────────────────────────────────────────── */

export default function ClientIntake({ supabase, shareId, password, projectName }) {
  const intake = useMemo(() => intakeFor(projectName), [projectName])

  const [answers, setAnswers] = useState(null)   // null = todavía cargando
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState(null)
  const savedTimer = useRef(null)

  const call = async (payload) => {
    const { data, error: e } = await supabase.functions.invoke('project-intake', {
      body: { shareId, password, ...payload },
    })
    if (e) throw e
    if (data && data.error) throw new Error(data.error)
    return data
  }

  useEffect(() => {
    let alive = true
    if (!intake || !supabase) { setAnswers({}); return }
    call({ action: 'get' })
      .then((d) => { if (alive) setAnswers((d && d.answers) || {}) })
      .catch(() => { if (alive) setAnswers({}) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intake, shareId])

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  if (!intake || answers === null) return null

  const questions = intake.questions
  const progress = intakeProgress(intake, answers)
  const urgent = pendingUrgent(intake, answers)
  const q = questions[Math.min(idx, questions.length - 1)]

  /* Guardar: optimista en pantalla, y si el servidor rechaza lo revertimos. Que
     el cliente vea su respuesta puesta al instante es lo que hace que el
     cuestionario se sienta rápido; que se revierta cuando falla es lo que evita
     que crea que guardó algo que no guardó. */
  const save = async (questionId, value) => {
    const previo = answers[questionId]
    setAnswers((a) => ({ ...a, [questionId]: value }))
    setSaving(true); setError(null)
    try {
      await call({ action: 'save', questionId, value })
      setJustSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setJustSaved(false), 1800)
    } catch (e) {
      setAnswers((a) => ({ ...a, [questionId]: previo }))
      setError('No se pudo guardar. Revisá la conexión y probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const answerAndAdvance = async (questionId, value) => {
    await save(questionId, value)
    setTimeout(() => setIdx((i) => Math.min(i + 1, questions.length - 1)), 110)
  }

  const firstUnanswered = () => {
    const i = questions.findIndex((x) => !isAnswered(answers[x.id]))
    return i === -1 ? 0 : i
  }

  /* ── la tarjeta de entrada, en la vista del proyecto ───────────────────── */
  if (!open) {
    const done = progress.done === progress.total
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="surface"
        style={{
          padding: 0, marginBottom: 26, overflow: 'hidden',
          borderColor: done ? 'var(--green-soft)' : urgent.length ? 'var(--accent-line)' : 'var(--border)',
          boxShadow: urgent.length ? '0 8px 30px -18px var(--accent)' : 'var(--shadow)',
        }}
      >
        <div style={{ height: 3, background: 'var(--border)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.pct}%` }}
            transition={{ ...SPRING, damping: 40 }}
            style={{ height: '100%', background: done ? 'var(--green)' : 'var(--accent)' }}
          />
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="label" style={{ marginBottom: 7, color: done ? 'var(--green)' : 'var(--accent)' }}>
                {done ? 'Listo' : urgent.length ? 'Te necesitamos 10 minutos' : 'Nos falta que decidas'}
              </div>
              <h2 style={{ fontFamily: 'Bricolage Grotesque', fontSize: 20, lineHeight: 1.25, marginBottom: 8 }}>
                {done
                  ? 'Contestaste todo. Gracias.'
                  : urgent.length
                    ? urgent[0].title
                    : `Quedan ${progress.total - progress.done} decisiones para publicar la app`}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0, maxWidth: 620 }}>
                {done
                  ? 'Seguimos nosotros. Si algo cambia, podés volver a entrar y corregirlo cuando quieras.'
                  : urgent.length
                    ? <RichText>{urgent[0].why}</RichText>
                    : <RichText>{intake.intro}</RichText>}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <button
                className={done ? 'btn' : 'btn btn-accent'}
                onClick={() => { setIdx(firstUnanswered()); setOpen(true) }}
                style={{ padding: '11px 18px', fontSize: 14.5, fontWeight: 600 }}
              >
                {done ? 'Revisar respuestas' : progress.done ? 'Seguir donde quedé' : 'Empezar'}
                <I2.arrowRight width={16} height={16} />
              </button>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {progress.done} de {progress.total}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  /* ── el flujo, una pregunta por pantalla ───────────────────────────────── */
  const sectionOf = (key) => (intake.sections || []).find((s) => s.key === key)
  const section = sectionOf(q.section)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        // Un halo del color de marca arriba, no un fondo plano: la pregunta cae
        // dentro de la luz y el espacio de abajo deja de leerse como pantalla a
        // medio hacer.
        background:
          'radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, var(--accent) 13%, transparent) 0%, transparent 60%), var(--bg)',
        display: 'flex', flexDirection: 'column', overflow: 'auto',
      }}
    >
      {/* barra fija: progreso, dónde estoy, salir */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ height: 3, background: 'var(--border)' }}>
          <motion.div
            animate={{ width: `${Math.round(((idx + 1) / questions.length) * 100)}%` }}
            transition={{ ...SPRING, damping: 40 }}
            style={{ height: '100%', background: 'var(--accent)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {idx + 1} / {questions.length}
          </span>
          {/* En un teléfono el título de la sección parte la barra en dos
              renglones y desalinea todo. Se recorta: el contexto lo da la
              pregunta, no el chip. */}
          {section && (
            <span
              className="tag"
              style={{
                borderColor: 'var(--border)', color: 'var(--text-dim)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 150, display: 'inline-block',
              }}
            >
              {section.title}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AnimatePresence>
              {(saving || justSaved) && (
                <motion.span
                  initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="mono"
                  style={{ fontSize: 11, color: justSaved ? 'var(--green)' : 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {justSaved ? <><I2.check width={12} height={12} /> Guardado</> : 'Guardando…'}
                </motion.span>
              )}
            </AnimatePresence>
            <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
              <I2.x width={14} height={14} /> Salir
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', maxWidth: 760, margin: '0 auto', padding: '38px 20px 120px' }}>
        {section && section.owner === 'abogado' && (
          <div
            className="surface"
            style={{ padding: '11px 14px', marginBottom: 20, borderColor: 'var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}
          >
            <I2.alert width={15} height={15} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Esta parte necesita un abogado. No hace falta que la resuelvas ahora: contestanos
              qué tenés y seguimos.
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: EXIT }}
            transition={SPRING}
          >
            <QuestionBody
              q={q}
              value={answers[q.id]}
              onAnswer={(v) => answerAndAdvance(q.id, v)}
              onSaveOnly={(v) => save(q.id, v)}
            />
          </motion.div>
        </AnimatePresence>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-soft)', padding: '9px 12px', borderRadius: 8, marginTop: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 30 }}>
          <button
            className="btn btn-ghost"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            style={{ opacity: idx === 0 ? 0.4 : 1 }}
          >
            Anterior
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
            style={{ marginLeft: 'auto' }}
          >
            {isAnswered(answers[q.id]) ? 'Siguiente' : 'Después'}
            <I2.chevR width={15} height={15} />
          </button>
        </div>

        {progress.done === progress.total && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
            className="surface"
            style={{ padding: 22, marginTop: 26, borderColor: 'var(--green-soft)', textAlign: 'center' }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 999, margin: '0 auto 12px', background: 'var(--green-soft)', display: 'grid', placeItems: 'center', color: 'var(--green)' }}>
              <I2.check width={22} height={22} />
            </div>
            <h3 style={{ fontFamily: 'Bricolage Grotesque', fontSize: 18, marginBottom: 7 }}>Contestaste todo</h3>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, margin: '0 auto', maxWidth: 420 }}>
              Nos llega al instante y seguimos nosotros. Si algo cambia, entrás con este mismo
              link y lo corregís.
            </p>
            <button className="btn btn-accent" onClick={() => setOpen(false)} style={{ marginTop: 16, justifyContent: 'center' }}>
              Volver al proyecto
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}

/* ── el cuerpo de cada pregunta, por tipo ───────────────────────────────── */

function QuestionBody({ q, value, onAnswer, onSaveOnly }) {
  const answered = isAnswered(value)

  const head = (
    <>
      {q.urgent && (
        <span className="tag" style={{ marginBottom: 12, display: 'inline-flex', color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-line)' }}>
          Urgente
        </span>
      )}
      <h1 style={{ fontFamily: 'Bricolage Grotesque', fontSize: 27, lineHeight: 1.22, marginBottom: q.body || q.why ? 14 : 22 }}>
        {q.title}
      </h1>
      {q.body && (
        <p style={{ fontSize: 15.5, color: 'var(--text)', lineHeight: 1.65, marginBottom: q.why ? 12 : 22 }}>
          <RichText>{q.body}</RichText>
        </p>
      )}
      {q.why && (
        <p style={{ fontSize: 14.5, color: 'var(--text-dim)', lineHeight: 1.65, marginBottom: 22 }}>
          <RichText>{q.why}</RichText>
        </p>
      )}
    </>
  )

  const footNote = q.note && (
    <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, marginTop: 14 }}>
      <RichText>{q.note}</RichText>
    </p>
  )

  if (q.kind === 'action')
    return (
      <div>
        {head}
        <button
          className={answered ? 'btn' : 'btn btn-accent'}
          onClick={() => onAnswer(answered ? null : { done: true, at: new Date().toISOString() })}
          style={{ padding: '13px 20px', fontSize: 15, fontWeight: 600 }}
        >
          {answered ? <><I2.check width={16} height={16} /> Hecho</> : (q.doneLabel || 'Ya lo hice')}
        </button>
        {answered && (
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 10 }}>
            Tocá de nuevo si lo marcaste por error.
          </p>
        )}
        {footNote}
      </div>
    )

  if (q.kind === 'confirm') {
    const state = value && value.ok === true ? 'ok' : value && value.correction ? 'fix' : null
    return (
      <div>
        {head}
        <div className="surface" style={{ padding: '4px 0', marginBottom: 20 }}>
          {(q.prefill || []).map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', gap: 14, padding: '11px 16px', borderTop: i ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
              <span className="label" style={{ minWidth: 92, marginBottom: 0 }}>{k}</span>
              <span style={{ fontSize: 14, flex: 1, minWidth: 180 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={state === 'ok' ? 'btn btn-accent' : 'btn'}
            onClick={() => onAnswer({ ok: true })}
            style={{ padding: '12px 18px', fontSize: 14.5, fontWeight: 600 }}
          >
            <I2.check width={16} height={16} /> {q.confirmLabel || 'Confirmar'}
          </button>
          <button
            className="btn"
            onClick={() => onSaveOnly({ ok: false, correction: (value && value.correction) || '' })}
            style={{ padding: '12px 18px', fontSize: 14.5 }}
          >
            {q.correctLabel || 'Corregir'}
          </button>
        </div>
        {state === 'fix' && (
          <textarea
            className="input"
            autoFocus
            rows={3}
            value={value.correction || ''}
            placeholder={q.correctionPlaceholder || '¿Qué habría que cambiar?'}
            onChange={(e) => onSaveOnly({ ok: false, correction: e.target.value })}
            style={{ marginTop: 14, resize: 'vertical' }}
          />
        )}
        {footNote}
      </div>
    )
  }

  if (q.kind === 'choice') {
    const chosen = value && value.value
    const follow = q.followUp && chosen === q.followUp.when
    return (
      <div>
        {head}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((o) => {
            const on = chosen === o.value
            return (
              <motion.button
                key={o.value}
                whileTap={{ scale: 0.985 }}
                transition={SPRING}
                onClick={() =>
                  q.followUp && o.value === q.followUp.when
                    ? onSaveOnly({ value: o.value, extra: (value && value.extra) || '' })
                    : onAnswer({ value: o.value })
                }
                className="surface"
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: '14px 16px', display: 'flex',
                  alignItems: 'flex-start', gap: 12, background: on ? 'var(--accent-soft)' : undefined,
                  borderColor: on ? 'var(--accent-line)' : 'var(--border)',
                }}
              >
                <span
                  style={{
                    width: 19, height: 19, borderRadius: 999, flexShrink: 0, marginTop: 1,
                    border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
                    background: on ? 'var(--accent)' : 'transparent',
                    display: 'grid', placeItems: 'center',
                  }}
                >
                  {on && <I2.check width={12} height={12} style={{ color: '#fff' }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{o.label}</span>
                    {o.recommended && (
                      <span className="tag" style={{ color: 'var(--green)', background: 'var(--green-soft)', borderColor: 'transparent' }}>
                        Recomendada
                      </span>
                    )}
                  </span>
                  {o.hint && (
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4 }}>
                      {o.hint}
                    </span>
                  )}
                </span>
              </motion.button>
            )
          })}
        </div>
        {follow && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={SPRING} style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: 14 }}>
              <div className="label" style={{ marginBottom: 6 }}>{q.followUp.label}</div>
              <input
                className="input"
                autoFocus
                value={(value && value.extra) || ''}
                onChange={(e) => onSaveOnly({ value: chosen, extra: e.target.value })}
              />
            </div>
          </motion.div>
        )}
        {footNote}
      </div>
    )
  }

  if (q.kind === 'text' || q.kind === 'email' || q.kind === 'longtext') {
    const v = typeof value === 'string' ? value : ''
    const bad = q.kind === 'email' && v.trim() !== '' && !isEmail(v)
    return (
      <div>
        {head}
        {q.kind === 'longtext' ? (
          <textarea className="input" rows={4} value={v} placeholder={q.placeholder} onChange={(e) => onSaveOnly(e.target.value)} style={{ resize: 'vertical' }} />
        ) : (
          <input
            className="input"
            type={q.kind === 'email' ? 'email' : 'text'}
            value={v}
            placeholder={q.placeholder}
            onChange={(e) => onSaveOnly(e.target.value)}
            style={{ fontSize: 15.5, padding: '12px 14px', borderColor: bad ? 'var(--red)' : undefined }}
          />
        )}
        {bad && <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 7 }}>Eso no parece un correo válido.</div>}
        {q.hint && <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, marginTop: 10 }}><RichText>{q.hint}</RichText></p>}
        {footNote}
      </div>
    )
  }

  if (q.kind === 'fields') {
    const v = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {}
    const skipped = v.__skip === true
    return (
      <div>
        {head}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: skipped ? 0.45 : 1 }}>
          {q.fields.map((f) => (
            <div key={f.key}>
              <div className="label" style={{ marginBottom: 6 }}>
                {f.label}{f.required && <span style={{ color: 'var(--accent)' }}> ·</span>}
              </div>
              <input
                className="input"
                disabled={skipped}
                value={v[f.key] || ''}
                placeholder={f.placeholder}
                onChange={(e) => onSaveOnly({ ...v, __skip: false, [f.key]: e.target.value })}
                style={{ fontSize: 15, padding: '11px 13px' }}
              />
            </div>
          ))}
        </div>
        {q.allowSkip && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onSaveOnly(skipped ? { ...v, __skip: false } : { __skip: true })}
            style={{ marginTop: 14 }}
          >
            {skipped ? 'Mejor lo completo' : q.allowSkip}
          </button>
        )}
        {footNote}
      </div>
    )
  }

  if (q.kind === 'emails') {
    const list = Array.isArray(value) ? value : []
    const min = q.min || 0
    const falta = Math.max(0, min - list.length)
    const setList = (next) => onSaveOnly(next)
    return (
      <div>
        {head}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${Math.min(100, (list.length / Math.max(min, 1)) * 100)}%` }}
              transition={SPRING}
              style={{ height: '100%', background: falta ? 'var(--accent)' : 'var(--green)' }}
            />
          </div>
          <span className="mono" style={{ fontSize: 12, color: falta ? 'var(--text-dim)' : 'var(--green)', whiteSpace: 'nowrap' }}>
            {list.length} / {min}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((mail, i) => {
            const bad = mail.trim() !== '' && !isEmail(mail)
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', width: 20, textAlign: 'right', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <input
                  className="input"
                  type="email"
                  value={mail}
                  placeholder={q.placeholder}
                  onChange={(e) => setList(list.map((m, j) => (j === i ? e.target.value : m)))}
                  style={{ flex: 1, borderColor: bad ? 'var(--red)' : undefined }}
                />
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setList(list.filter((_, j) => j !== i))}
                  aria-label={`Quitar el correo ${i + 1}`}
                >
                  <I2.x width={14} height={14} />
                </button>
              </div>
            )
          })}
        </div>

        <button className="btn" onClick={() => setList([...list, ''])} style={{ marginTop: 12 }}>
          <I2.plus width={15} height={15} /> Agregar correo
        </button>

        {q.hint && (
          <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, marginTop: 14 }}>
            <RichText>{q.hint}</RichText>
          </p>
        )}
        {falta > 0 && list.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
            {falta === 1 ? 'Falta uno más.' : `Faltan ${falta} más.`}
          </p>
        )}
        {footNote}
      </div>
    )
  }

  return null
}
