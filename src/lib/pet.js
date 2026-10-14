import { create } from 'zustand'
import * as THREE from 'three'
import { onRoom, presence, supabase, useCouple } from './couple'
import { useHome } from './home'
import { PET_SPOT, toWorld } from './homeLayout'
import { HOME_ISLAND } from './terrain'
import { uid } from './uid'

/*
 * ADOPT A PET — one shared pet, kept in Supabase (table `pets`, supabase/migrations/004_pet.sql).
 * Stored: its kind, name, accessory, and whether it's at home or following one of you (and whom —
 * the server only lets you ask it to follow yourself). Not stored: where it is and what it's doing
 * moment to moment. Each game works that out from the stored state (components/three/Pet.jsx), and
 * a pat or "Duduk" travels with your character on the private channel ({ pet: { id, kind, at } }).
 */

export const PET_KINDS = {
  cat: { label: 'Kucing', icon: '🐱' },
  dog: { label: 'Anjing', icon: '🐶' },
}
export const ACCESSORIES = {
  none: 'Tanpa aksesori',
  ribbon: 'Pita',
  bell: 'Lonceng',
  scarf: 'Syal',
}

/** status: 'off' | 'loading' | 'ready' | 'error'; pet: the row, or null before adoption */
export const usePet = create(() => ({ status: 'off', pet: null, busy: false, error: null, near: false }))
const set = (patch) => usePet.setState(patch)
const get = () => usePet.getState()

export async function loadPet() {
  if (!supabase || useCouple.getState().status !== 'connected') return
  if (get().status !== 'ready') set({ status: 'loading', error: null })
  const { data, error } = await supabase.from('pets').select('*').eq('id', 1).maybeSingle()
  if (error) return set({ status: 'error', error: 'Fitur peliharaan belum siap. Mungkin tabelnya belum dipasang di Supabase (004_pet.sql).' })
  set({ status: 'ready', pet: data || null, error: null })
}

onRoom({
  attach(channel) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, (p) => {
      if (p.eventType !== 'DELETE' && p.new?.id === 1) set({ pet: p.new })
    })
  },
  subscribed: () => loadPet(),
  left: () => set({ status: 'off', pet: null }),
})
useCouple.subscribe((s, prev) => {
  if (s.status === prev.status) return
  if (s.status === 'connected') loadPet()
  else set({ status: 'off', pet: null })
})

async function run(promise) {
  if (get().busy) return { ok: false }
  set({ busy: true, error: null })
  const { data, error } = await promise
  set({ busy: false })
  if (error || !data) {
    const msg = 'Belum berhasil. Coba lagi sebentar lagi, ya.'
    set({ error: msg })
    return { ok: false, error: msg }
  }
  set({ pet: Array.isArray(data) ? data[0] : data })
  return { ok: true }
}

/** "Adopsi": the server keeps exactly one pet; asking twice just returns it. */
export const adopt = (kind, name) => run(supabase.rpc('pet_adopt', { p_kind: kind, p_name: name.trim().slice(0, 24) }))
/** "Ajak Ikut" (follow me) / "Kembali ke Rumah" */
export const command = (mode) => run(supabase.rpc('pet_command', { p_mode: mode }))
export const rename = (name) => run(supabase.from('pets').update({ name: name.trim().slice(0, 24) }).eq('id', 1).select('*').maybeSingle())
export const setAccessory = (accessory) => run(supabase.from('pets').update({ accessory }).eq('id', 1).select('*').maybeSingle())

/* ───────── a pat, or "sit" (seen by both of you, never stored) ───────── */

let actTimer = null
export function petAct(kind) {
  clearTimeout(actTimer)
  presence.pet = { id: uid(), kind, at: Date.now() }
  actTimer = setTimeout(() => (presence.pet = null), kind === 'sit' ? 7000 : 3000)
}

/* ───────── where it lives ───────── */

/** Its home: the pet bed if one is placed in the house, otherwise its cushion in the garden. */
export function petHome() {
  const bed = Object.values(useHome.getState().items).find((it) => it.kind === 'pet_bed')
  const [x, z] = bed ? toWorld(bed.x, bed.z) : toWorld(...PET_SPOT.at)
  return { at: new THREE.Vector3(x, HOME_ISLAND.level, z), radius: bed ? 1.3 : PET_SPOT.radius, bed: Boolean(bed) }
}
