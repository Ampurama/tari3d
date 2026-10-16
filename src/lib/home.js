import { create } from 'zustand'
import { onRoom, partner, presence, supabase, useCouple } from './couple'
import { blockers, obstacles } from './terrain'
import { player } from './player'
import { couple } from '../content/config'
import { uid } from './uid'
import { serverNow } from './clock'
import { useStore } from '../store'
import { applyHouseSize, CATALOG, checkPlacement, HOUSE, HOUSE_SIZES, hitsItem, hitsWall, IN, inHouse, layerOf, OUTER, priceOf, snapPlacement, startSpot, toLocal } from './homeLayout'

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
  /** shared heart coins, and the walls' and floor's style (009_sims_home.sql); null until installed */
  coins: null,
  style: { wall: 'krem', floor: 'kayu' },
  /** how big the house is: 1 Kecil, 2 Sedang, 3 Besar (010_bigger_home.sql) */
  size: 1,
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

const BASE_COLUMNS = 'id, kind, area, x, z, rot, version, updated_by'
/**
 * What the database has: plant care (008_plant_care.sql) and colours (009_sims_home.sql). The house
 * opens either way; features that need a migration say so when used.
 */
const COLUMN_SETS = [
  { cols: `${BASE_COLUMNS}, watered_at, care, variant`, care: true, sims: true },
  { cols: `${BASE_COLUMNS}, watered_at, care`, care: true, sims: false },
  { cols: BASE_COLUMNS, care: false, sims: false },
]
let columnSet = 0
let ITEM_COLUMNS = COLUMN_SETS[0].cols
let careReady = true
let simsReady = true
const useColumns = (i) => {
  columnSet = i
  ITEM_COLUMNS = COLUMN_SETS[i].cols
  careReady = COLUMN_SETS[i].care
  simsReady = COLUMN_SETS[i].sims
}
export const simsInstalled = () => simsReady
const clean = (row) => ({
  id: row.id,
  kind: row.kind,
  area: row.area,
  x: +row.x,
  z: +row.z,
  rot: row.rot | 0,
  version: row.version | 0,
  updatedBy: row.updated_by,
  wateredAt: row.watered_at ? Date.parse(row.watered_at) : null,
  care: row.care | 0,
  variant: row.variant | 0,
})

function applyHouse(row) {
  if (!row) return
  // a bigger house: its walls, windows and the walking rules are rebuilt (before anything re-draws)
  applyHouseSize(row.size || 1)
  set({
    stage: row.stage | 0,
    memory: { title: row.memory_title || '', date: row.memory_date || null, note: row.memory_note || '' },
    // (older databases without 003_dates.sql have no light switches: they stay on)
    lights: { on: row.lights_on ?? true, fairy: row.fairy_on ?? true },
    coins: typeof row.coins === 'number' ? row.coins : null,
    style: { wall: row.wall_style || 'krem', floor: row.floor_style || 'kayu' },
    size: row.size || 1,
  })
  obstacles.version++
}

function applyItem(row) {
  if (!row?.id || removed.has(row.id) || !CATALOG[row.kind]) return
  const cur = get().items[row.id]
  if (cur && cur.version > row.version) return // an older event arriving late
  const next = clean(row)
  // the other person just watered a plant: say so (the plant perks up by itself)
  const { mate } = useCouple.getState()
  if (cur && PLANTS.has(next.kind) && next.wateredAt && next.wateredAt !== cur.wateredAt && mate && row.updated_by === mate.id) {
    const who = mate.role === 'owner' ? couple.me.nickname || couple.me.name : couple.you.nickname || couple.you.name
    useStore.getState().showToast(`💧 ${who} menyiram ${CATALOG[next.kind].label.toLowerCase()}`, 3200)
  }
  set({ items: { ...get().items, [row.id]: next } })
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
  let [house, items] = await Promise.all([
    supabase.from('house').select('*').eq('id', 1).maybeSingle(),
    supabase.from('house_items').select(ITEM_COLUMNS).limit(200),
  ])
  // a migration isn't installed yet: step down to what the database has (the house still opens)
  while (items.error && columnSet < COLUMN_SETS.length - 1 && /column|watered_at|care|variant/i.test(items.error.message || '')) {
    useColumns(columnSet + 1)
    items = await supabase.from('house_items').select(ITEM_COLUMNS).limit(200)
  }
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

/* ───────── plants that need watering (like The Sims) ───────── */

/** What can be watered. */
export const PLANTS = new Set(['plant', 'flowers', 'bush', 'small_tree', 'vase'])
const HOUR = 3600000

/**
 * How a plant is doing, from when it was last watered (real time, on the shared clock) and how
 * often it has been cared for:
 *   water: 1 just watered … 0 bone dry (it takes four days)
 *   mood:  'segar' (fresh, < 1 day) | 'haus' (thirsty, 1–2 days) | 'layu' (drooping, 2–4 days) | 'kering' (dry)
 *   growth: 'kecil' (little) | 'sedang' (grown) | 'mekar' (in full bloom) — by how many times it's been
 *           watered (once every 4 hours counts)
 */
export function plantNeeds(item) {
  const hours = item.wateredAt ? Math.max(0, (serverNow() - item.wateredAt) / HOUR) : 0
  const water = Math.max(0, 1 - hours / 96)
  const mood = !careReady || hours < 24 ? 'segar' : hours < 48 ? 'haus' : hours < 96 ? 'layu' : 'kering'
  const care = item.care | 0
  const growth = care >= 7 ? 'mekar' : care >= 3 ? 'sedang' : 'kecil'
  return { hours, water: careReady ? water : 1, mood, growth, care }
}
export const MOOD_LABELS = { segar: 'Segar', haus: 'Haus', layu: 'Layu', kering: 'Kering' }
export const GROWTH_LABELS = { kecil: 'Masih kecil', sedang: 'Tumbuh', mekar: 'Mekar' }

/** Water a plant (either of you). Returns { ok, error }. */
export async function waterPlant(id) {
  if (!supabase || get().status !== 'ready') return { ok: false, error: 'Rumahnya belum tersambung.' }
  if (!careReady) return { ok: false, error: 'Siram tanaman butuh 008_plant_care.sql dijalankan di Supabase dulu.' }
  const { data, error } = await supabase.rpc('water_plant', { item: id })
  if (error || !data) return { ok: false, error: 'Belum bisa menyiram, coba lagi sebentar ya.' }
  applyItem(data)
  if (simsReady) refreshHouse()
  return { ok: true }
}

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
  set({ draft: withCheck({ id: uid(), isNew: true, kind, ...startSpot(kind), version: 0, variant: 0 }), notice: null })
}

/** Pick up an item that's already in the house. */
export function pickItem(id) {
  const it = get().items[id]
  if (!it || get().saving) return
  if (partner.online && partner.editing === id) {
    return set({ notice: { text: `Barang ini lagi dipegang ${mateName()}. Tunggu sebentar, ya.`, bad: true } })
  }
  presence.editing = id
  set({ draft: withCheck({ id, isNew: false, kind: it.kind, x: it.x, z: it.z, rot: it.rot, version: it.version, variant: it.variant | 0 }), notice: null })
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

/** Choose the colour of what she's holding (free; it's saved with "Tempatkan"). */
export function paintDraft(variant) {
  const d = get().draft
  if (!d || get().saving) return
  set({ draft: { ...d, variant } })
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
    const row = { id: d.id, kind: d.kind, area: c.area, x: d.x, z: d.z, rot: d.rot }
    if (simsReady) row.variant = d.variant | 0
    result = await supabase.from('house_items').insert(row).select(ITEM_COLUMNS).maybeSingle()
    // already saved by an earlier attempt: fine, it's the same item
    if (result.error?.code === '23505') {
      removed.delete(d.id)
      await refetchItem(d.id)
      result = { data: null, error: null }
    }
  } else {
    const patch = { x: d.x, z: d.z, rot: d.rot }
    if (simsReady) patch.variant = d.variant | 0
    result = await supabase.from('house_items').update(patch).eq('id', d.id).eq('version', d.version).select(ITEM_COLUMNS).maybeSingle()
    if (!result.error && !result.data) {
      await refetchItem(d.id)
      presence.editing = null
      return set({ saving: false, draft: null, notice: { text: conflict(), bad: true } })
    }
  }
  if (result.error) {
    const msg = result.error.message || ''
    const text = msg.includes('house is full')
      ? 'Rumahnya sudah penuh (80 barang).'
      : msg.includes('not enough coins')
        ? `Koin hatinya belum cukup (butuh ${priceOf(d.kind)}). Kumpulkan dengan masak, tidur, baca, mandi, siram tanaman, atau main berdua ♡`
        : 'Belum tersimpan. Coba lagi, ya.'
    return set({ saving: false, notice: { text, bad: true } })
  }
  if (result.data) applyItem(result.data)
  presence.editing = null
  const bought = d.isNew && simsReady && priceOf(d.kind) > 0
  set({ saving: false, draft: null, notice: { text: bought ? `Tersimpan ✓ (−${priceOf(d.kind)} koin)` : 'Tersimpan ✓' } })
  if (bought) refreshHouse()
}

/** A free spot for a new item (searching out from where new things usually go), or null. */
function freeSpot(kind) {
  const c = CATALOG[kind]
  const start = startSpot(kind)
  const box = c.area === 'inside' ? { x0: IN.x0, x1: IN.x1, z0: IN.z0, z1: IN.z1 } : { x0: -7.5, x1: 7.5, z0: -6, z1: 9.5 }
  const spots = []
  for (let x = box.x0; x <= box.x1; x += 0.25) for (let z = box.z0; z <= box.z1; z += 0.25) spots.push([x, z, Math.hypot(x - start.x, z - start.z)])
  spots.sort((a, b) => a[2] - b[2])
  for (const [x, z] of spots) {
    const p = snapPlacement(kind, x, z, 0)
    if (checkPlacement(kind, p.x, p.z, 0, get().items).ok) return p
  }
  return null
}

/**
 * From Gnome Village's shop (and its rewards): put a new thing in the house on a free spot (it can
 * be moved later in Mode Bangun). The server charges its price, and checks a reward is unlocked.
 * Returns { ok, error }.
 */
export async function deliverItem(kind) {
  const c = CATALOG[kind]
  const s = get()
  if (!c || !supabase || s.status !== 'ready') return { ok: false, error: 'Rumah kalian belum termuat. Masuk dulu, ya.' }
  if (c.area === 'inside' && s.stage < 2) return { ok: false, error: 'Bangun pondoknya dulu, ya.' }
  if (c.area === 'garden' && s.stage < 3) return { ok: false, error: 'Taman rumah terbuka di tahap 3.' }
  const spot = freeSpot(kind)
  if (!spot) return { ok: false, error: c.area === 'inside' ? 'Di dalam rumah sudah tidak ada tempat kosong.' : 'Di taman sudah tidak ada tempat kosong.' }
  const row = { id: uid(), kind, area: c.area, x: spot.x, z: spot.z, rot: spot.rot }
  if (simsReady) row.variant = 0
  const { data, error } = await supabase.from('house_items').insert(row).select(ITEM_COLUMNS).maybeSingle()
  if (error) {
    const msg = error.message || ''
    if (msg.includes('not enough coins')) return { ok: false, error: `Koin hatinya belum cukup (butuh ${priceOf(kind)}).` }
    if (msg.includes('not unlocked')) return { ok: false, error: 'Hadiah ini belum terbuka.' }
    if (msg.includes('house is full')) return { ok: false, error: 'Rumahnya sudah penuh (80 barang).' }
    if (msg.includes('house_items_kind')) return { ok: false, error: 'Dekorasi desa butuh 011_gnome_village.sql dijalankan di Supabase dulu.' }
    return { ok: false, error: 'Belum terkirim. Coba lagi, ya.' }
  }
  if (data) applyItem(data)
  if (simsReady && priceOf(kind) > 0) refreshHouse()
  return { ok: true }
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
  const back = simsReady ? priceOf(d.kind) : 0
  set({ saving: false, draft: null, notice: { text: back ? `Dihapus (+${back} koin kembali).` : 'Dihapus.' } })
  if (back) refreshHouse()
}

/* ───────── coins, walls and floors, and living in the house ───────── */

/** Re-read the house row (its coins change on the server when buying or earning). */
export async function refreshHouse() {
  const { data } = await supabase.from('house').select('*').eq('id', 1).maybeSingle()
  if (data) applyHouse(data)
}

/** Redo the walls and/or the floor (15 coins for each part that changes). Returns { ok, error }. */
export async function setHouseStyle(wall, floor) {
  if (!simsReady) return { ok: false, error: 'Ganti dinding & lantai butuh 009_sims_home.sql dijalankan di Supabase dulu.' }
  set({ saving: true })
  const { data, error } = await supabase.rpc('house_style', { new_wall: wall, new_floor: floor })
  set({ saving: false })
  if (error || !data) return { ok: false, error: error?.message?.includes('not enough coins') ? 'Koin hatinya belum cukup.' : 'Belum tersimpan. Coba lagi, ya.' }
  applyHouse(data)
  return { ok: true }
}

/**
 * Living in the house earns coins (the server decides how many and when it counts again).
 * Returns the coins added (0 when it's too soon, or before 009_sims_home.sql is installed).
 */
export async function earnCoins(act) {
  if (!supabase || !simsReady || get().status !== 'ready') return 0
  const { data, error } = await supabase.rpc('house_reward', { act })
  if (error) return 0
  if (data > 0) refreshHouse()
  return data | 0
}

/**
 * Make the house bigger (120 coins to "Sedang", 250 to "Besar"). Returns { ok, error }.
 * It can't grow over garden things: the error names them, so she knows what to move.
 */
export async function growHome() {
  const { size, items } = get()
  const next = HOUSE_SIZES[size + 1]
  if (!next) return { ok: false, error: 'Rumahnya sudah paling besar ♡' }
  // say which garden things are in the way before even asking
  const back = 2.3 - 2 * next.hd - 0.6
  const blocking = Object.values(items).filter((it) => it.area === 'garden' && Math.abs(it.x) <= next.hw + 0.6 && it.z >= back && it.z <= 2.3)
  if (blocking.length) {
    const names = [...new Set(blocking.map((it) => CATALOG[it.kind].label.toLowerCase()))].join(', ')
    return { ok: false, error: `Pindahkan dulu ${names} di taman: tempatnya akan jadi bagian rumah.` }
  }
  set({ saving: true })
  const { data, error } = await supabase.rpc('house_grow', { expected: size })
  set({ saving: false })
  if (error) {
    const m = error.message || ''
    if (m.includes('not enough coins')) return { ok: false, error: `Koin hatinya belum cukup (butuh ${next.price}).` }
    if (m.includes('clear the garden')) return { ok: false, error: 'Ada barang taman di tempat rumah yang baru. Pindahkan dulu, ya.' }
    if (m.includes('function') || m.includes('house_grow')) return { ok: false, error: 'Memperbesar rumah butuh 010_bigger_home.sql dijalankan di Supabase dulu.' }
    return { ok: false, error: 'Belum bisa memperbesar sekarang. Coba lagi, ya.' }
  }
  applyHouse(data)
  return { ok: true }
}

/* ───────── walls and furniture block the avatar ───────── */

blockers.push((wx, wz) => {
  const s = get()
  if (s.status !== 'ready' || s.stage < 2) return false
  const [x, z] = toLocal(wx, wz)
  if (Math.abs(x) > 9 || z < -7 || z > 11) return false
  const [px, pz] = toLocal(player.position.x, player.position.z)
  if (Math.abs(x) < OUTER.hw + 0.4 && z > OUTER.cz - OUTER.hd - 0.4 && z < OUTER.cz + OUTER.hd + 0.4 && hitsWall(x, z) && !hitsWall(px, pz)) return true
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
