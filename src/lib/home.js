import { create } from 'zustand'
import { onRoom, partner, presence, supabase, useCouple } from './couple'
import { blockers, obstacles } from './terrain'
import { player } from './player'
import { couple } from '../content/config'
import { uid } from './uid'
import { CATALOG, checkPlacement, HOUSE, hitsItem, hitsWall, inHouse, layerOf, snapPlacement, startSpot, toLocal } from './homeLayout'

/*
 * OUR LITTLE HOME — the shared house, kept in Supabase (tables `house` and `house_items`,
 * see supabase/migrations/002_our_home.sql). The server decides who may see or change it;
 * this module keeps a local copy in sync:
 *   - every item has a stable id (made once, here), so retries and repeated events never duplicate it
 *   - a move only lands if nobody changed the item since we picked it up (its `version`)
 *   - whoever is holding an item tells the other person (presence.editing), who can't grab it meanwhile
 * Only real changes travel over the network (one row at a time), never the whole house.
 */

/**
 * status: 'off' (not signed in as one of you) | 'loading' | 'ready' | 'error'
 * draft: the item being placed or moved: { id, isNew, kind, x, z, rot, version, ok, reason }
 */
export const useHome = create(() => ({
  status: 'off',
  stage: 1,
  memory: { title: '', date: null, note: '' },
  /** the house lights and the fairy lights on the roof (shared) */
  lights: { on: true, fairy: true },
  items: {},
  error: null,
  /** decorating mode is on */
  editing: false,
  draft: null,
  saving: false,
  /** a short message in the decorating bar */
  notice: null,
  /** she's on the home island (shows the "Rumah Kita" buttons) */
  near: false,
}))

const set = (patch) => useHome.setState(patch)
const get = () => useHome.getState()
/** ids removed in this session: a late event for them must not bring them back */
const removed = new Set()

const ITEM_COLUMNS = 'id, kind, area, x, z, rot, version, updated_by'
const clean = (row) => ({ id: row.id, kind: row.kind, area: row.area, x: +row.x, z: +row.z, rot: row.rot | 0, version: row.version | 0, updatedBy: row.updated_by })

function applyHouse(row) {
  if (!row) return
  set({
    stage: row.stage | 0,
    memory: { title: row.memory_title || '', date: row.memory_date || null, note: row.memory_note || '' },
    // (older databases without 003_dates.sql have no light switches: they stay on)
    lights: { on: row.lights_on ?? true, fairy: row.fairy_on ?? true },
  })
  obstacles.version++
}

function applyItem(row) {
  if (!row?.id || removed.has(row.id) || !CATALOG[row.kind]) return
  const cur = get().items[row.id]
  if (cur && cur.version > row.version) return // an older event arriving late
  set({ items: { ...get().items, [row.id]: clean(row) } })
  obstacles.version++
}

function dropItem(id) {
  removed.add(id)
  if (!get().items[id]) return
  const items = { ...get().items }
  delete items[id]
  set({ items })
  obstacles.version++
}

/** Load (or re-load, after a reconnect) the whole house once. */
export async function loadHome() {
  if (!supabase || useCouple.getState().status !== 'connected') return
  if (get().status !== 'ready') set({ status: 'loading', error: null })
  const [house, items] = await Promise.all([
    supabase.from('house').select('*').eq('id', 1).maybeSingle(),
    supabase.from('house_items').select(ITEM_COLUMNS).limit(200),
  ])
  if (house.error || items.error || !house.data) {
    set({ status: 'error', error: 'Rumahnya belum bisa dibuka. Mungkin tabel rumah belum dipasang di Supabase, atau koneksinya lagi putus.' })
    return
  }
  applyHouse(house.data)
  set({ items: Object.fromEntries(items.data.filter((r) => CATALOG[r.kind]).map((r) => [r.id, clean(r)])), status: 'ready', error: null })
  obstacles.version++
}

// live changes, on the private room channel (lib/couple.js)
onRoom({
  attach(channel) {
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_items' }, (p) => {
        if (p.eventType === 'DELETE') dropItem(p.old?.id)
        else applyItem(p.new)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'house' }, (p) => applyHouse(p.new))
  },
  subscribed: () => loadHome(),
  left: () => {
    stopEditing()
    set({ status: 'off', items: {}, stage: 1, error: null })
    obstacles.version++
  },
})
useCouple.subscribe((s, prev) => {
  if (s.status === prev.status) return
  if (s.status === 'connected') loadHome()
  else if (get().status !== 'off') {
    stopEditing()
    set({ status: 'off', items: {}, stage: 1, error: null })
    obstacles.version++
  }
})

/* ───────── building ───────── */

const NEEDS = {
  'need: 3 furniture inside': 'Taruh minimal 3 perabot di dalam rumah dulu, ya.',
  'need: 2 garden decorations': 'Hias taman dengan minimal 2 dekorasi dulu, ya.',
  'need: a title for the memory corner': 'Beri judul pojok kenangan dulu, ya.',
}

/** Build the next stage. Returns { ok, error }. */
export async function upgradeHome() {
  const { stage } = get()
  set({ saving: true })
  const { data, error } = await supabase.rpc('house_upgrade', { expected: stage })
  set({ saving: false })
  if (error) {
    const key = Object.keys(NEEDS).find((k) => error.message?.includes(k))
    return { ok: false, error: key ? NEEDS[key] : 'Belum bisa membangun sekarang. Coba lagi, ya.' }
  }
  applyHouse(data)
  return { ok: true }
}

/** Save the memory corner. Only the owner sends the date (the server checks that too). */
export async function saveMemory({ title, date, note }, isOwner) {
  const patch = { memory_title: title.trim().slice(0, 60) || null, memory_note: note.trim().slice(0, 200) || null }
  if (isOwner) patch.memory_date = date || null
  set({ saving: true })
  const { data, error } = await supabase.from('house').update(patch).eq('id', 1).select('*').maybeSingle()
  set({ saving: false })
  if (error || !data) return { ok: false, error: 'Belum tersimpan. Coba lagi, ya.' }
  applyHouse(data)
  return { ok: true }
}

/** Flip the house lights ('on') or the fairy lights ('fairy') for both of you. */
export async function toggleLights(which) {
  const cur = get().lights
  const column = which === 'fairy' ? 'fairy_on' : 'lights_on'
  const next = !(which === 'fairy' ? cur.fairy : cur.on)
  set({ lights: { ...cur, [which === 'fairy' ? 'fairy' : 'on']: next } }) // feels instant; the server has the last word
  const { data, error } = await supabase.from('house').update({ [column]: next }).eq('id', 1).select('*').maybeSingle()
  if (error || !data) set({ lights: cur })
  else applyHouse(data)
}

/* ───────── decorating ───────── */

export function startEditing() {
  if (get().status !== 'ready' || get().stage < 2) return
  player.frozen = true
  player.walkTarget = null
  set({ editing: true, draft: null, notice: null })
}

export function stopEditing() {
  if (get().editing) player.frozen = false
  presence.editing = null
  set({ editing: false, draft: null, notice: null, saving: false })
}

const withCheck = (d) => ({ ...d, ...checkPlacement(d.kind, d.x, d.z, d.rot, get().items, d.id) })

/** Pick a new item from the catalog. */
export function pickKind(kind) {
  const c = CATALOG[kind]
  if (!c) return
  if (c.area === 'garden' && get().stage < 3) return set({ notice: { text: 'Dekorasi taman terbuka di tahap 3.', bad: true } })
  presence.editing = null
  // the id is made now and kept, so pressing "Tempatkan" twice (or a retry) can never place two
  set({ draft: withCheck({ id: uid(), isNew: true, kind, ...startSpot(kind), version: 0 }), notice: null })
}

/** Pick up an item that's already in the house. */
export function pickItem(id) {
  const it = get().items[id]
  if (!it || get().saving) return
  if (partner.online && partner.editing === id) {
    return set({ notice: { text: `Barang ini lagi dipegang ${mateName()}. Tunggu sebentar, ya.`, bad: true } })
  }
  presence.editing = id
  set({ draft: withCheck({ id, isNew: false, kind: it.kind, x: it.x, z: it.z, rot: it.rot, version: it.version }), notice: null })
}

/** Move the draft to a pointer position (house-local). */
export function moveDraft(x, z) {
  const d = get().draft
  if (!d || get().saving) return
  const p = snapPlacement(d.kind, x, z, d.rot)
  if (p.x === d.x && p.z === d.z && p.rot === d.rot) return
  set({ draft: withCheck({ ...d, ...p }) })
}

/** Nudge the draft by whole grid steps. */
export const nudgeDraft = (dx, dz) => {
  const d = get().draft
  if (d) moveDraft(d.x + dx, d.z + dz)
}

export function rotateDraft() {
  const d = get().draft
  if (!d || get().saving || layerOf(d.kind) === 'wall') return
  const rot = (d.rot + 1) % 4
  set({ draft: withCheck({ ...d, ...snapPlacement(d.kind, d.x, d.z, rot) }) })
}

export function cancelDraft() {
  presence.editing = null
  set({ draft: null, notice: null })
}

/** The other person's name, from the role the server gave them. */
export const mateName = () => {
  const role = useCouple.getState().mate?.role
  const who = role === 'owner' ? couple.me : role === 'tari' ? couple.you : null
  return who ? who.nickname || who.name : 'pasanganmu'
}
const conflict = () => `Barusan diubah ${mateName()}, jadi yang tampil sekarang versinya. Coba lagi, ya.`

async function refetchItem(id) {
  const { data } = await supabase.from('house_items').select(ITEM_COLUMNS).eq('id', id).maybeSingle()
  if (data) applyItem(data)
  else dropItem(id)
}

/** "Tempatkan": save the draft. */
export async function placeDraft() {
  const d = get().draft
  if (!d || !d.ok || get().saving) return
  set({ saving: true, notice: { text: 'Menyimpan…' } })
  const c = CATALOG[d.kind]
  let result
  if (d.isNew) {
    result = await supabase.from('house_items').insert({ id: d.id, kind: d.kind, area: c.area, x: d.x, z: d.z, rot: d.rot }).select(ITEM_COLUMNS).maybeSingle()
    // already saved by an earlier attempt: fine, it's the same item
    if (result.error?.code === '23505') {
      removed.delete(d.id)
      await refetchItem(d.id)
      result = { data: null, error: null }
    }
  } else {
    result = await supabase.from('house_items').update({ x: d.x, z: d.z, rot: d.rot }).eq('id', d.id).eq('version', d.version).select(ITEM_COLUMNS).maybeSingle()
    if (!result.error && !result.data) {
      await refetchItem(d.id)
      presence.editing = null
      return set({ saving: false, draft: null, notice: { text: conflict(), bad: true } })
    }
  }
  if (result.error) {
    const full = result.error.message?.includes('house is full')
    return set({ saving: false, notice: { text: full ? 'Rumahnya sudah penuh (80 barang).' : 'Belum tersimpan. Coba lagi, ya.', bad: true } })
  }
  if (result.data) applyItem(result.data)
  presence.editing = null
  set({ saving: false, draft: null, notice: { text: 'Tersimpan ✓' } })
}

/** "Hapus": remove the item being moved. */
export async function removeDraft() {
  const d = get().draft
  if (!d || d.isNew || get().saving) return
  set({ saving: true, notice: { text: 'Menyimpan…' } })
  const { data, error } = await supabase.from('house_items').delete().eq('id', d.id).eq('version', d.version).select('id')
  presence.editing = null
  if (error) return set({ saving: false, notice: { text: 'Belum terhapus. Coba lagi, ya.', bad: true } })
  if (!data?.length) {
    await refetchItem(d.id)
    return set({ saving: false, draft: null, notice: { text: conflict(), bad: true } })
  }
  dropItem(d.id)
  set({ saving: false, draft: null, notice: { text: 'Dihapus.' } })
}

/* ───────── walls and furniture block the avatar ───────── */

blockers.push((wx, wz) => {
  const s = get()
  if (s.status !== 'ready' || s.stage < 2) return false
  const [x, z] = toLocal(wx, wz)
  if (Math.abs(x) > 9 || z < -7 || z > 11) return false
  const [px, pz] = toLocal(player.position.x, player.position.z)
  if (Math.abs(x) < 3.6 && Math.abs(z) < 2.7 && hitsWall(x, z) && !hitsWall(px, pz)) return true
  for (const id in s.items) {
    const it = s.items[id]
    // never trap her: furniture placed right where she stands lets her walk out
    if (hitsItem(it, x, z) && !hitsItem(it, px, pz)) return true
  }
  return false
})

/** Is the local avatar inside the house right now? */
export const playerInHouse = () => inHouse(...toLocal(player.position.x, player.position.z))
export { HOUSE }
