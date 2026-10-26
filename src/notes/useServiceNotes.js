import { useCallback, useEffect, useRef, useState } from 'react'
import { noteFromRow, noteToRow, mergeIncoming } from '../lib/serviceNotes.js'

const TABLE = 'project_service_notes'
const CACHE_KEY = 'rc_service_notes_v1'
const SAVE_DEBOUNCE = 500
const RETRY_MS = 5000

const readCache = () => {
  try { const v = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch (e) { return [] }
}
const writeCache = (list) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)) } catch (e) { /* sin cuota: queda en memoria */ } }

/*
 * Mismo contrato que useRowCollection (optimista, guardado por fila con debounce,
 * realtime, resync al reconectar), pero contra columnas propias en vez de `data`.
 * Sin base (modo local) todo queda en localStorage. Un guardado fallido no se pierde:
 * queda pendiente, se reintenta cada 5 s y el error se muestra.
 */
export function useServiceNotes(supabase) {
  const cloud = !!supabase
  const [items, setItems] = useState(readCache)
  const [ready, setReady] = useState(!cloud)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const itemsRef = useRef(items)
  const pending = useRef(new Map())
  const timers = useRef(new Map())
  const retryTimer = useRef(null)

  const apply = useCallback((fn) => {
    const next = fn(itemsRef.current)
    itemsRef.current = next
    setItems(next)
    writeCache(next)
  }, [])

  const syncSaving = () => setSaving(pending.current.size > 0)

  const writeNow = useCallback(async (note) => {
    if (!cloud) return
    const { error: err } = await supabase.from(TABLE).upsert(noteToRow(note), { onConflict: 'id' })
    if (err) {
      setError('No pudimos guardar la última nota. Lo seguimos intentando.')
      clearTimeout(retryTimer.current)
      retryTimer.current = setTimeout(() => { pending.current.forEach((n) => writeNow(n)) }, RETRY_MS)
      return
    }
    const still = pending.current.get(note.id)
    if (still && still.updatedAt === note.updatedAt) pending.current.delete(note.id)
    if (pending.current.size === 0) setError('')
    syncSaving()
  }, [cloud, supabase])

  const flush = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    pending.current.forEach((n) => writeNow(n))
  }, [writeNow])

  const save = useCallback((note, immediate = false) => {
    apply((cur) => {
      const i = cur.findIndex((n) => n.id === note.id)
      if (i === -1) return [note, ...cur]
      const next = cur.slice()
      next[i] = note
      return next
    })
    if (!cloud) return
    pending.current.set(note.id, note)
    syncSaving()
    clearTimeout(timers.current.get(note.id))
    if (immediate) { timers.current.delete(note.id); writeNow(note); return }
    timers.current.set(note.id, setTimeout(() => { timers.current.delete(note.id); writeNow(note) }, SAVE_DEBOUNCE))
  }, [apply, cloud, writeNow])

  const load = useCallback(async () => {
    if (!cloud) return
    const { data, error: err } = await supabase.from(TABLE).select('*').is('deleted_at', null).order('noted_at', { ascending: false })
    if (err) { setError('No pudimos traer las notas. Probá recargar en un rato.'); return }
    const server = (data || []).map(noteFromRow).filter(Boolean)
    apply(() => {
      let list = server
      pending.current.forEach((local) => { list = mergeIncoming(list, local) })
      return list
    })
  }, [apply, cloud, supabase])

  useEffect(() => {
    if (!cloud) return undefined
    let alive = true
    ;(async () => { try { await load() } finally { if (alive) setReady(true) } })()
    let once = false
    const channel = supabase.channel(`${TABLE}_all`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        const incoming = noteFromRow(payload.new)
        if (!incoming || pending.current.has(incoming.id)) return
        apply((cur) => mergeIncoming(cur, incoming))
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (once) load()
        once = true
      })
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      alive = false
      flush()
      clearTimeout(retryTimer.current)
      supabase.removeChannel(channel)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [cloud])

  const retry = useCallback(() => { setError(''); pending.current.forEach((n) => writeNow(n)) }, [writeNow])

  return { items, ready, saving, error, save, retry }
}
