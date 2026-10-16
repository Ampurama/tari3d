import { HOME_ISLAND, homeDistance, SKY_BRIDGE } from './terrain'

/*
 * OUR LITTLE HOME — the house's shape, the furniture catalog and the placement rules.
 * Everything here is in metres relative to the house (its front faces +z, toward the bridge).
 * The same bounds are checked again by the database (supabase/migrations/002_our_home.sql).
 */

/** The house stands toward the back of the home island; its garden runs down to the bridge. */
export const HOUSE = { x: 0, z: -35.5, y: HOME_ISLAND.level }
export const toWorld = (x, z) => [HOUSE.x + x, HOUSE.z + z]
export const toLocal = (x, z) => [x - HOUSE.x, z - HOUSE.z]

/** Outer walls (centre lines) and the room inside them. */
export const OUTER = { hw: 3.2, hd: 2.3 }
export const IN = { x0: -3.05, x1: 3.05, z0: -2.15, z1: 2.15 }
export const WALL_H = 1.9
export const WALL_T = 0.15
/** The front door: a gap in the front wall. */
export const DOOR = { x0: -1.6, x1: -0.4, h: 1.5 }
export const DOOR_X = (DOOR.x0 + DOOR.x1) / 2
/** A wall between the living room (left) and the bedroom (right), open toward the front. */
export const PARTITION = { x: 0.9, z0: -OUTER.hd, z1: 0.75 }
export const PORCH = { x0: -2.3, x1: 0.5, z0: OUTER.hd, z1: 3.3 }
/** Windows: [wall, centre along the wall, width]. */
export const WINDOWS = [
  ['front', -2.4, 0.8],
  ['front', 2.0, 0.9],
  ['back', -0.4, 0.9],
  ['back', 2.0, 0.7],
  ['left', 0.2, 0.9],
  ['right', -0.6, 0.8],
]
export const WINDOW_Y = [0.85, 1.45]
/** The memory corner: a shelf against the back wall of the living room, and a frame above it. */
export const MEMORY_CORNER = { x0: -3.05, x1: -1.75, z0: -2.15, z1: -1.65 }
/** The stepping-stone path from the porch down to the bridge. */
export const GARDEN_PATH = [
  [DOOR_X, PORCH.z1 + 0.2],
  [SKY_BRIDGE.x - HOUSE.x, SKY_BRIDGE.z1 - HOUSE.z + 0.4],
]
/** Where you arrive from the bridge (the sign and the garden arch stand here). */
export const LANDING = { x: GARDEN_PATH[1][0], z: GARDEN_PATH[1][1] - 0.6 }

/* ───────── stages ───────── */

export const STAGES = [
  { n: 1, title: 'Lahan kosong', text: 'Sepetak tanah kosong yang menunggu kalian.' },
  { n: 2, title: 'Pondok kecil', text: 'Dinding, atap, jendela dan pintu. Rumahnya sudah bisa dimasuki.', action: 'Bangun Rumah' },
  { n: 3, title: 'Rumah yang terisi', text: 'Lampu-lampu hangat menyala di dalam.', need: 'Taruh minimal 3 perabot di dalam rumah.' },
  { n: 4, title: 'Taman yang cantik', text: 'Bunga di sekeliling rumah, gapura di ujung jalan, dan pojok kenangan.', need: 'Hias taman dengan minimal 2 dekorasi.' },
  { n: 5, title: 'Rumah kita', text: 'Lampu-lampu kecil di atap dan kenang-kenangan di rak.', need: 'Beri judul pojok kenangan.' },
]

/* ───────── the catalog ───────── */

/**
 * `w` × `d`: footprint at rotation 0 (x by z). `layer`: 'floor' things can't overlap each other,
 * 'rug's lie under them, 'wall' things hang on a wall. `area`: inside the house or in the garden.
 */
export const CATALOG = {
  // ── Ruang santai
  sofa: { label: 'Sofa', icon: '🛋️', area: 'inside', w: 1.6, d: 0.75, cat: 'santai', price: 50, colors: ['#b9a5e8', '#f4a9c4', '#a8d5ba', '#f2d6a8'] },
  chair: { label: 'Kursi', icon: '🪑', area: 'inside', w: 0.5, d: 0.5, cat: 'santai', price: 15, colors: ['#ffc2d9', '#c9b6f4', '#bfe3d6', '#ffe08a'] },
  rug: { label: 'Karpet', icon: '🟪', area: 'inside', w: 1.6, d: 1.1, layer: 'rug', cat: 'santai', price: 20, colors: ['#f5a9c6', '#b9a5e8', '#9fd3c7', '#f6c89f'] },
  floor_lamp: { label: 'Lampu berdiri', icon: '💡', area: 'inside', w: 0.4, d: 0.4, cat: 'santai', price: 18, colors: ['#ffe7b8', '#ffd1e3', '#d9ccff', '#c9f0e0'] },
  tv: { label: 'TV', icon: '📺', area: 'inside', w: 1.0, d: 0.45, cat: 'santai', price: 45, colors: ['#a88fe0', '#f29bb3', '#8fc9b3', '#c8915f'] },
  // ── Kamar
  bed: { label: 'Kasur', icon: '🛏️', area: 'inside', w: 1.2, d: 1.9, cat: 'kamar', price: 60, colors: ['#f7a8c4', '#b9a5e8', '#9fd3c7', '#ffd27f'] },
  teddy: { label: 'Boneka beruang', icon: '🧸', area: 'inside', w: 0.45, d: 0.4, cat: 'kamar', price: 15 },
  heart_lamp: { label: 'Lampu hati', icon: '💗', area: 'inside', w: 0.4, d: 0.4, cat: 'kamar', price: 22 },
  // the pet's own bed: wherever it's placed becomes the pet's home (supabase/migrations/004_pet.sql)
  pet_bed: { label: 'Kasur peliharaan', icon: '🐾', area: 'inside', w: 0.7, d: 0.55, layer: 'rug', cat: 'kamar', price: 20 },
  // ── Dapur & makan
  table: { label: 'Meja makan', icon: '🪵', area: 'inside', w: 1.0, d: 0.7, cat: 'dapur', price: 35, colors: ['#c8915f', '#a97955', '#f1e4d3', '#e9b7c6'] },
  stove: { label: 'Kompor', icon: '🍳', area: 'inside', w: 0.7, d: 0.6, cat: 'dapur', price: 55, colors: ['#f6e3c6', '#f4b6cc', '#bfe3d6', '#cbbcf2'] },
  fridge: { label: 'Kulkas', icon: '🧊', area: 'inside', w: 0.66, d: 0.62, cat: 'dapur', price: 50, colors: ['#bfe3d6', '#f7c3d6', '#fff4e4', '#cfe0ff'] },
  // ── Kamar mandi
  bathtub: { label: 'Bak mandi', icon: '🛁', area: 'inside', w: 0.8, d: 1.5, cat: 'mandi', price: 70, colors: ['#ffffff', '#ffd6e6', '#cfeae4', '#e3d9ff'] },
  // ── Dekorasi
  plant: { label: 'Tanaman pot', icon: '🪴', area: 'inside', w: 0.45, d: 0.45, cat: 'dekor', price: 12 },
  vase: { label: 'Vas bunga', icon: '💐', area: 'inside', w: 0.4, d: 0.4, cat: 'dekor', price: 10 },
  bookshelf: { label: 'Rak buku', icon: '📚', area: 'inside', w: 1.0, d: 0.4, cat: 'dekor', price: 40, colors: ['#c8915f', '#a97955', '#f1e4d3', '#b9a5e8'] },
  picture: { label: 'Bingkai di dinding', icon: '🖼️', area: 'inside', w: 0.7, d: 0.06, layer: 'wall', cat: 'dekor', price: 15 },
  // ── Kenangan: unlocked once by finishing a date (003_dates.sql) or on Sky Island (005_sky_island.sql); gifts, no coins
  picnic_basket: { label: 'Keranjang piknik', icon: '🧺', area: 'inside', w: 0.5, d: 0.4, keepsake: 'sunset_picnic', cat: 'kenangan' },
  candles: { label: 'Lilin makan malam', icon: '🕯️', area: 'inside', w: 0.4, d: 0.4, keepsake: 'dinner_home', cat: 'kenangan' },
  camp_lantern: { label: 'Lentera kemah', icon: '🏮', area: 'inside', w: 0.4, d: 0.4, keepsake: 'camping', cat: 'kenangan' },
  postcard: { label: 'Kartu pos danau', icon: '💌', area: 'inside', w: 0.5, d: 0.05, layer: 'wall', keepsake: 'lakeside', cat: 'kenangan' },
  star_lamp: { label: 'Lampu bintang', icon: '🌟', area: 'inside', w: 0.4, d: 0.4, keepsake: true, hint: 'Temukan 4 bintang tersembunyi di Sky Island', cat: 'kenangan' },
  sky_lantern: { label: 'Lentera langit', icon: '🎐', area: 'inside', w: 0.4, d: 0.4, keepsake: true, hint: 'Selesaikan Cloud Hop berdua', cat: 'kenangan' },
  // ── Taman
  flowers: { label: 'Petak bunga', icon: '🌷', area: 'garden', w: 1.0, d: 0.6, cat: 'taman', price: 12 },
  bush: { label: 'Semak bulat', icon: '🌳', area: 'garden', w: 0.8, d: 0.8, cat: 'taman', price: 10 },
  lantern: { label: 'Lentera taman', icon: '🏮', area: 'garden', w: 0.4, d: 0.4, cat: 'taman', price: 12 },
  garden_bench: { label: 'Bangku taman', icon: '🪵', area: 'garden', w: 1.3, d: 0.6, cat: 'taman', price: 25, colors: ['#c8915f', '#f1e4d3', '#b9a5e8', '#8fc9b3'] },
  small_tree: { label: 'Pohon bunga', icon: '🌸', area: 'garden', w: 1.0, d: 1.0, cat: 'taman', price: 30 },
}
export const KINDS = Object.keys(CATALOG)

/**
 * Prices are in heart coins (koin hati) and must match public.item_price() in
 * supabase/migrations/009_sims_home.sql (the server is the one that charges).
 */
export const priceOf = (kind) => CATALOG[kind]?.price || 0

/** The catalog's shelves, like the buy mode in The Sims. */
export const CATEGORIES = [
  { id: 'santai', label: 'Santai', icon: '🛋️', area: 'inside' },
  { id: 'kamar', label: 'Kamar', icon: '🛏️', area: 'inside' },
  { id: 'dapur', label: 'Dapur', icon: '🍳', area: 'inside' },
  { id: 'mandi', label: 'Mandi', icon: '🛁', area: 'inside' },
  { id: 'dekor', label: 'Dekor', icon: '🪴', area: 'inside' },
  { id: 'kenangan', label: 'Kenangan', icon: '💌', area: 'inside' },
  { id: 'taman', label: 'Taman', icon: '🌷', area: 'garden' },
]

/** Walls and floors (15 coins for each part that changes; checked by public.house_style()). */
export const WALL_STYLES = {
  krem: { label: 'Krem', color: '#fff1dc' },
  blush: { label: 'Blush', color: '#ffe0ea' },
  sage: { label: 'Sage', color: '#e2efdc' },
  lavender: { label: 'Lavender', color: '#ece3ff' },
  langit: { label: 'Langit', color: '#e0eeff' },
  bintik: { label: 'Peach', color: '#ffe6d6' },
}
export const FLOOR_STYLES = {
  kayu: { label: 'Kayu', color: '#e2b98a' },
  walnut: { label: 'Walnut', color: '#a97955' },
  putih: { label: 'Kayu putih', color: '#f1e9df' },
  pink: { label: 'Pink', color: '#f3c9d6' },
  kotak: { label: 'Ubin krem', color: '#efe0cc' },
}
export const STYLE_PRICE = 15
export const layerOf = (kind) => CATALOG[kind]?.layer || 'floor'

/** Footprint rectangle of an item: { x0, x1, z0, z1 } (house-local). */
export function rectOf(kind, x, z, rot = 0) {
  const c = CATALOG[kind]
  const swap = rot % 2 === 1
  const hw = (swap ? c.d : c.w) / 2
  const hd = (swap ? c.w : c.d) / 2
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd }
}

const overlaps = (a, b, gap = 0) => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.z0 < b.z1 + gap && a.z1 > b.z0 - gap
const inside = (r, box) => r.x0 >= box.x0 - 1e-6 && r.x1 <= box.x1 + 1e-6 && r.z0 >= box.z0 - 1e-6 && r.z1 <= box.z1 + 1e-6
const segDist = (px, pz, [ax, az], [bx, bz]) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}

/** Places inside that always stay free: in front of the door, the way into the bedroom, the memory corner. */
const KEEP_FREE = [
  { x0: DOOR.x0 - 0.05, x1: DOOR.x1 + 0.05, z0: 1.25, z1: IN.z1 },
  { x0: PARTITION.x - 0.45, x1: PARTITION.x + 0.45, z0: PARTITION.z1, z1: IN.z1 },
  MEMORY_CORNER,
]
const PARTITION_RECT = { x0: PARTITION.x - 0.09, x1: PARTITION.x + 0.09, z0: IN.z0, z1: PARTITION.z1 }
/** The campsite for "Kemah di Bawah Bintang", west of the house (kept free of garden things). */
export const CAMP = { fire: [-5.0, 1.7], tent: [-5.3, 0.15], zone: { x0: -6.6, x1: -3.75, z0: -0.75, z1: 2.85 } }
/** The pet's cushion in the garden (its home until a pet bed is placed in the house). */
export const PET_SPOT = { at: [4.6, 4.4], radius: 2.2, zone: { x0: 4.0, x1: 5.2, z0: 3.8, z1: 5.0 } }
/** The house, its porch and a little margin: no garden things here. */
const HOUSE_ZONE = { x0: -OUTER.hw - 0.45, x1: OUTER.hw + 0.45, z0: -OUTER.hd - 0.45, z1: PORCH.z1 + 0.3 }

/* ───────── wall things (picture frames) ───────── */

const WALL_SPANS = {
  back: { axis: 'x', fixed: IN.z0 + 0.04, rot: 0, min: IN.x0, max: IN.x1 },
  left: { axis: 'z', fixed: IN.x0 + 0.04, rot: 1, min: IN.z0, max: IN.z1 },
  right: { axis: 'z', fixed: IN.x1 - 0.04, rot: 3, min: IN.z0, max: IN.z1 },
}
/** Stretches of each wall that are taken: windows, where the partition meets it, the memory frame. */
const WALL_TAKEN = {
  back: [...WINDOWS.filter((w) => w[0] === 'back').map(([, c, w]) => [c - w / 2, c + w / 2]), [PARTITION.x - 0.1, PARTITION.x + 0.1], [MEMORY_CORNER.x0, MEMORY_CORNER.x1 + 0.1]],
  left: WINDOWS.filter((w) => w[0] === 'left').map(([, c, w]) => [c - w / 2, c + w / 2]),
  right: WINDOWS.filter((w) => w[0] === 'right').map(([, c, w]) => [c - w / 2, c + w / 2]),
}
const wallOf = (x, z, rot) => (rot === 1 ? 'left' : rot === 3 ? 'right' : 'back')

/** Snap a pointer position onto the nearest wall a frame can hang on. */
function snapToWall(x, z) {
  const d = { back: Math.abs(z - IN.z0), left: Math.abs(x - IN.x0), right: Math.abs(x - IN.x1) }
  const wall = Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b))
  const s = WALL_SPANS[wall]
  const along = Math.round((s.axis === 'x' ? x : z) / 0.25) * 0.25
  return s.axis === 'x' ? { x: along, z: s.fixed, rot: s.rot } : { x: s.fixed, z: along, rot: s.rot }
}

/* ───────── snapping and validation ───────── */

const GRID = 0.25
const snap = (v) => Math.round(v / GRID) * GRID

/** Where an item would go for a pointer at (x, z) (house-local): snapped to the grid or onto a wall. */
export function snapPlacement(kind, x, z, rot) {
  if (layerOf(kind) === 'wall') return snapToWall(x, z)
  const r = rectOf(kind, 0, 0, rot)
  // even-sized footprints sit between grid lines, odd ones on them, so edges line up neatly
  const offX = ((r.x1 - r.x0) / GRID) % 2 >= 1 ? GRID / 2 : 0
  const offZ = ((r.z1 - r.z0) / GRID) % 2 >= 1 ? GRID / 2 : 0
  return { x: snap(x - offX) + offX, z: snap(z - offZ) + offZ, rot }
}

/**
 * Can `kind` stand at (x, z, rot) given the other items (a map/array of { id, kind, x, z, rot })?
 * Returns { ok: true } or { ok: false, reason } (shown to her as is).
 */
export function checkPlacement(kind, x, z, rot, others, ignoreId = null) {
  const c = CATALOG[kind]
  if (!c) return { ok: false, reason: 'Perabot ini tidak dikenal.' }
  const list = (Array.isArray(others) ? others : Object.values(others)).filter((o) => o.id !== ignoreId && CATALOG[o.kind])
  const layer = layerOf(kind)

  if (layer === 'wall') {
    const wall = wallOf(x, z, rot)
    const s = WALL_SPANS[wall]
    const along = s.axis === 'x' ? x : z
    const lo = along - c.w / 2
    const hi = along + c.w / 2
    if (lo < s.min + 0.05 || hi > s.max - 0.05) return { ok: false, reason: 'Terlalu mepet ke sudut.' }
    if (WALL_TAKEN[wall].some(([a, b]) => lo < b + 0.05 && hi > a - 0.05)) return { ok: false, reason: 'Bagian dinding ini sudah terpakai (jendela atau pojok kenangan).' }
    const clash = list.some((o) => layerOf(o.kind) === 'wall' && wallOf(o.x, o.z, o.rot) === wall && Math.abs((s.axis === 'x' ? o.x : o.z) - along) < (c.w + CATALOG[o.kind].w) / 2 + 0.05)
    return clash ? { ok: false, reason: 'Bertabrakan dengan bingkai lain.' } : { ok: true }
  }

  const r = rectOf(kind, x, z, rot)
  if (c.area === 'inside') {
    if (!inside(r, IN)) return { ok: false, reason: 'Harus di dalam rumah.' }
    if (overlaps(r, PARTITION_RECT)) return { ok: false, reason: 'Kena dinding kamar.' }
    if (layer === 'floor' && KEEP_FREE.some((k) => overlaps(r, k))) return { ok: false, reason: 'Jangan halangi pintu, jalan ke kamar, atau pojok kenangan.' }
    if (layer === 'rug' && overlaps(r, MEMORY_CORNER)) return { ok: false, reason: 'Pojok kenangan biarkan kosong, ya.' }
  } else {
    const corners = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]
    if (corners.some(([cx, cz]) => homeDistance(...toWorld(cx, cz)) > 0.78)) return { ok: false, reason: 'Terlalu dekat tepi pulau.' }
    if (overlaps(r, HOUSE_ZONE)) return { ok: false, reason: 'Terlalu dekat rumah.' }
    if (overlaps(r, CAMP.zone)) return { ok: false, reason: 'Tempat ini disimpan untuk kemah, ya.' }
    if (overlaps(r, PET_SPOT.zone)) return { ok: false, reason: 'Ini bantal tidur peliharaan kalian.' }
    if ([[x, z], ...corners].some(([px, pz]) => segDist(px, pz, GARDEN_PATH[0], GARDEN_PATH[1]) < 0.6)) return { ok: false, reason: 'Jangan halangi jalan setapak.' }
    if (Math.hypot(x - LANDING.x, z - LANDING.z) < 1.8) return { ok: false, reason: 'Ujung jembatan biarkan lega, ya.' }
  }
  const clash = list.some((o) => CATALOG[o.kind].area === c.area && layerOf(o.kind) === layer && overlaps(r, rectOf(o.kind, o.x, o.z, o.rot), 0.02))
  return clash ? { ok: false, reason: layer === 'rug' ? 'Sudah ada karpet di situ.' : 'Bertabrakan dengan perabot lain.' } : { ok: true }
}

/** A good first spot for a new item (in the living room, or the front garden). */
export function startSpot(kind) {
  const c = CATALOG[kind]
  if (layerOf(kind) === 'wall') return snapToWall(IN.x0, -1.0)
  return c.area === 'inside' ? snapPlacement(kind, -1.0, -0.4, 0) : snapPlacement(kind, 2.75, 6.0, 0)
}

/* ───────── walking: walls and furniture block the avatar ───────── */

/** Wall centre lines (house-local) once the cottage stands; the door is a gap. */
export const WALL_SEGMENTS = [
  [[-OUTER.hw, -OUTER.hd], [OUTER.hw, -OUTER.hd]],
  [[-OUTER.hw, -OUTER.hd], [-OUTER.hw, OUTER.hd]],
  [[OUTER.hw, -OUTER.hd], [OUTER.hw, OUTER.hd]],
  [[-OUTER.hw, OUTER.hd], [DOOR.x0, OUTER.hd]],
  [[DOOR.x1, OUTER.hd], [OUTER.hw, OUTER.hd]],
  [[PARTITION.x, PARTITION.z0], [PARTITION.x, PARTITION.z1]],
]
const BODY = 0.22

/** Is (x, z) (house-local) inside a wall for someone walking? */
export const hitsWall = (x, z) => WALL_SEGMENTS.some(([a, b]) => segDist(x, z, a, b) < BODY)
/** Is (x, z) (house-local) inside a piece of furniture someone can't walk through? */
export function hitsItem(item, x, z, pad = BODY * 0.7) {
  const layer = layerOf(item.kind)
  if (layer !== 'floor') return false
  const r = rectOf(item.kind, item.x, item.z, item.rot)
  return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad
}
/** Is (x, z) (house-local) within the house's walls? */
export const inHouse = (x, z) => Math.abs(x) < OUTER.hw && Math.abs(z) < OUTER.hd
