import React from 'react'
import { alertLevel, laneMeta, upsellState, upsellLine, upsellBadges } from '../lib/journey.js'

export const initials = (s) => {
  const w = String(s || '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!w.length) return '·'
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase()
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export function dayCell(entry) {
  if (entry.lane === 'prueba' && entry.remaining != null) {
    if (entry.remaining < 0) return { n: `+${-entry.remaining}`, cap: 'vencida', lv: 'crit' }
    return { n: entry.remaining, cap: entry.remaining === 1 ? 'queda' : 'quedan', lv: entry.remaining <= 3 ? 'warn' : null }
  }
  if (entry.days == null) return { n: '—', cap: 'sin fecha', lv: null }
  const devAlert = entry.alerts.find((a) => a.key === 'dev' || a.key === 'standby')
  return { n: entry.days, cap: entry.days === 1 ? 'día' : 'días', lv: devAlert ? devAlert.level : null }
}

export function meterOf(entry) {
  if (entry.days == null || !entry.limit) return null
  return Math.max(0.04, Math.min(1, entry.days / entry.limit))
}

export function daysText(entry) {
  if (entry.lane === 'prueba' && entry.remaining != null) {
    return entry.remaining < 0 ? `prueba vencida hace ${plural(-entry.remaining, 'día', 'días')}` : `quedan ${plural(entry.remaining, 'día', 'días')} de prueba`
  }
  return entry.days != null ? `${plural(entry.days, 'día', 'días')} en este tramo` : 'sin fecha de entrada'
}

export function ClientMark({ text, level, size = 30 }) {
  return (
    <span className="jr-mk" data-lv={level || undefined} style={size !== 30 ? { width: size, height: size } : undefined} aria-hidden="true">
      {initials(text)}
    </span>
  )
}

export function Point({ item, client, onOpen, active, dim, className = '' }) {
  const { project: p, entry } = item
  const lv = alertLevel(entry.alerts)
  const up = upsellState(p)
  const badges = upsellBadges(p, entry.lane)
  const lastUp = [up.plan, up.fase2].filter(Boolean).sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0] || null
  const cell = dayCell(entry)
  const m = meterOf(entry)
  const company = client?.company || client?.name || ''
  const lastUpShown = lastUp && !badges.some((b) => b.offer === lastUp.offer)
  const sub = entry.alerts[0]
    ? { text: entry.alerts[0].short || entry.alerts[0].text, lv: entry.alerts[0].level }
    : lastUpShown ? { text: upsellLine(lastUp), up: true } : { text: company || laneMeta(entry.lane).label }
  const label = [
    p.name, company && `cliente ${company}`, laneMeta(entry.lane).label, daysText(entry),
    ...entry.alerts.map((a) => a.text),
    ...badges.map((b) => upsellLine(b.entry)),
    lastUpShown && upsellLine(lastUp),
  ].filter(Boolean).join('. ')
  return (
    <button type="button" className={`jr-pt ${className}`} data-active={active ? '1' : undefined} data-dim={dim ? '1' : undefined}
      onClick={(e) => onOpen(p.id, e.currentTarget)} aria-label={`${label}. Ver detalle`} aria-current={active ? 'true' : undefined} title={label}>
      <ClientMark text={company || p.name} level={lv} />
      <span className="tx">
        <span className="nm">
          <span className="t">{p.name}</span>
          {badges.map((b) => <span key={b.offer} className="jr-chip" data-o={b.offer} data-s={b.status} aria-hidden="true">{b.label}</span>)}
        </span>
        <span className="jr-sub" data-lv={sub.lv || undefined} data-up={sub.up ? '1' : undefined}>{sub.text}</span>
      </span>
      <span className="jr-d">
        <b data-lv={cell.lv || undefined}>{cell.n}</b>
        <span>{cell.cap}</span>
      </span>
      {m != null && (
        <span className="jr-meter" aria-hidden="true">
          <i data-lv={cell.lv || undefined} style={{ transform: `scaleX(${m})` }} />
        </span>
      )}
    </button>
  )
}
