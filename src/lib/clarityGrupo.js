/*
 * Grupo de WhatsApp de un proyecto (wa_groups.project_id) y el número que contesta
 * en él (clarity_instancia). Store externo + useSyncExternalStore: pinta al instante
 * con la copia local y se reconcilia con la base y con Realtime, sin useEffect+setState.
 * Sólo se suscribe cuando el panel existe, que es sólo para el mail de Manuel.
 */

import { useCallback, useSyncExternalStore } from 'react'

const COLS = 'group_jid,group_name,active,clarity_instancia,linked_at'
const KEY = (pid) => `ck_grupo_v1:${pid}`
const VACIO = Object.freeze({ grupo: null, listo: false })

const entradas = new Map()   // pid -> { grupo, listo } (objeto nuevo en cada cambio)
const oyentes = new Map()    // pid -> Set<fn>

function leerLocal(pid) {
  try { const g = JSON.parse(localStorage.getItem(KEY(pid)) || 'null'); return g ? { grupo: g, listo: false } : VACIO } catch (e) { return VACIO }
}

function entrada(pid) {
  if (!entradas.has(pid)) entradas.set(pid, leerLocal(pid))
  return entradas.get(pid)
}

function poner(pid, grupo, listo = true) {
  entradas.set(pid, { grupo, listo })
  try { if (grupo) localStorage.setItem(KEY(pid), JSON.stringify(grupo)); else localStorage.removeItem(KEY(pid)) } catch (e) { /* cuota o modo privado */ }
  oyentes.get(pid)?.forEach((fn) => fn())
}

/* Un proyecto puede tener varios grupos: el activo más recién vinculado es el que se atiende. */
export function elegirGrupo(rows) {
  const lista = (rows || []).slice().sort((a, b) =>
    (b.active === true) - (a.active === true) || String(b.linked_at || '').localeCompare(String(a.linked_at || '')))
  return lista[0] || null
}

async function cargar(supabase, pid) {
  const { data, error } = await supabase.from('wa_groups').select(COLS).eq('project_id', pid)
  if (error) return
  poner(pid, elegirGrupo(data))
}

function suscribir(supabase, pid, fn) {
  let set = oyentes.get(pid)
  if (!set) { set = new Set(); oyentes.set(pid, set) }
  set.add(fn)
  const canal = supabase
    .channel(`ck-grupo-${pid}-${set.size}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_groups', filter: `project_id=eq.${pid}` }, () => cargar(supabase, pid))
    .subscribe()
  cargar(supabase, pid)
  return () => { set.delete(fn); supabase.removeChannel(canal) }
}

export function useGrupoClarity(supabase, pid, activo) {
  const on = !!(activo && supabase && pid)
  const subscribe = useCallback((fn) => (on ? suscribir(supabase, pid, fn) : () => {}), [on, supabase, pid])
  const snap = useCallback(() => (on ? entrada(pid) : VACIO), [on, pid])
  return useSyncExternalStore(subscribe, snap, () => VACIO)
}

/* Optimista: refleja ya y vuelve atrás si la base lo rechaza. true = guardado. */
export async function guardarInstancia(supabase, pid, valor) {
  const antes = entrada(pid)
  const g = antes.grupo
  if (!g) return false
  poner(pid, { ...g, clarity_instancia: valor }, antes.listo)
  const { data, error } = await supabase.from('wa_groups')
    .update({ clarity_instancia: valor, updated_at: new Date().toISOString() })
    .eq('group_jid', g.group_jid).select('group_jid')
  if (error || !data || data.length === 0) { poner(pid, g, antes.listo); return false }
  return true
}
