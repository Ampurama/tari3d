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

/**
 * How big the house is (house.size, supabase/migrations/010_bigger_home.sql): it grows wider and
 * deeper toward the back, while the front wall, the door, the porch and the garden stay put —
 * so nothing already placed moves. From "Sedang" on there's no built-in partition: you build your
 * own rooms with wall pieces ("Dinding sekat", "Sekat berpintu").
 */
export const HOUSE_SIZES = {
  1: { label: 'Kecil', hw: 3.2, hd: 2.3, price: 0 },
  2: { label: 'Sedang', hw: 3.9, hd: 2.9, price: 120 },
  3: { label: 'Besar', hw: 4.5, hd: 3.4, price: 250 },
}
/** The front wall's line (house-local z): it never moves. */
export const FRONT = 2.3

/*
 * The live shape of the house for its current size (applyHouseSize() updates these in place, so
 * everything that imports them sees the new shape). OUTER is centred on the cottage: its centre is
 * at house-local z = OUTER.cz (0 for the small house, further back as it grows).
 */
export const OUTER = { hw: 3.2, hd: 2.3, cz: 0 }
export const IN = { x0: -3.05, x1: 3.05, z0: -2.15, z1: 2.15 }
export const WALL_H = 1.9
export const WALL_T = 0.15
/** The front door: a gap in the front wall. */
export const DOOR = { x0: -1.6, x1: -0.4, h: 1.5 }
export const DOOR_X = (DOOR.x0 + DOOR.x1) / 2
/** The small house's wall between the living room (left) and the bedroom (right), open toward the front. */
export const PARTITION = { x: 0.9, z0: -2.3, z1: 0.75, on: true }
export const PORCH = { x0: -2.3, x1: 0.5, z0: FRONT, z1: 3.3 }
/** Windows: [wall, centre along the wall (cottage-local: x for front/back, z for the sides), width]. */
export const WINDOWS = []
export const WINDOW_Y = [0.85, 1.45]
/** The memory corner: a shelf against the back wall of the living room, and a frame above it. */
export const MEMORY_CORNER = { x0: -3.05, x1: -1.75, z0: -2.15, z1: -1.65 }
export let houseSize = 1
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
  // ── Struktur: build your own rooms (in the colour of the walls)
  wall_panel: { label: 'Dinding sekat', icon: '🧱', area: 'inside', w: 1.5, d: 0.14, cat: 'struktur', price: 10 },
  wall_arch: { label: 'Sekat berpintu', icon: '🚪', area: 'inside', w: 1.5, d: 0.14, cat: 'struktur', price: 15 },
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
  // ── Desa Kurcaci (011_gnome_village.sql): sold by Tuan Kenop, or rewards for helping in the village
  mushroom_stool: { label: 'Kursi jamur', icon: '🍄', area: 'inside', w: 0.45, d: 0.45, cat: 'desa', price: 15, colors: ['#e8566f', '#f7a8c4', '#b9a5e8', '#ffb347'] },
  toadstool_table: { label: 'Meja jamur', icon: '🍄', area: 'inside', w: 0.9, d: 0.9, cat: 'desa', price: 30, colors: ['#e8566f', '#f7a8c4', '#8fc9b3', '#c8915f'] },
  mushroom_lamp: { label: 'Lampu jamur', icon: '🪔', area: 'inside', w: 0.4, d: 0.4, keepsake: true, hint: 'Antar kopi untuk Nenek Pim di Desa Kurcaci', cat: 'desa' },
  bread_basket: { label: 'Keranjang roti', icon: '🥐', area: 'inside', w: 0.5, d: 0.4, keepsake: true, hint: 'Bantu Bu Remah mengumpulkan bahan roti', cat: 'desa' },
  gnome_lantern: { label: 'Lentera kurcaci', icon: '🏮', area: 'garden', w: 0.4, d: 0.4, cat: 'desa_taman', price: 18 },
  flower_pot: { label: 'Pot bunga kurcaci', icon: '🪴', area: 'garden', w: 0.5, d: 0.5, cat: 'desa_taman', price: 10, colors: ['#e08f6a', '#f4b6cc', '#bfe3d6', '#cbbcf2'] },
  moon_flower: { label: 'Bunga bulan', icon: '🌙', area: 'garden', w: 0.6, d: 0.6, keepsake: true, hint: 'Bantu Gilo menyiram bunga di Desa Kurcaci', cat: 'desa_taman' },
  gnome_statue: { label: 'Patung kurcaci', icon: '🗿', area: 'garden', w: 0.5, d: 0.5, keepsake: true, hint: 'Temukan kacamata Tetua Lumut', cat: 'desa_taman' },
  crystal_shroom: { label: 'Jamur kristal', icon: '💎', area: 'garden', w: 0.6, d: 0.6, keepsake: true, hint: 'Temukan Kebun Rahasia di Desa Kurcaci', cat: 'desa_taman' },
  twin_lantern: { label: 'Lentera kembar', icon: '🏮', area: 'garden', w: 0.9, d: 0.4, keepsake: true, hint: 'Nyalakan lentera berdua di alun-alun Desa Kurcaci', cat: 'desa_taman' },
  // ── Dreamlight Funfair (013_carnival.sql): prizes from the booth games
  gnome_plush: { label: 'Boneka kurcaci', icon: '🧸', area: 'inside', w: 0.4, d: 0.4, keepsake: true, hint: 'Masukkan 3 gelang di Lempar Gelang, Dreamlight Funfair', cat: 'desa' },
  carnival_lantern: { label: 'Lentera karnaval', icon: '🎪', area: 'garden', w: 0.45, d: 0.45, keepsake: true, hint: 'Robohkan keenam kaleng di Dreamlight Funfair', cat: 'desa_taman' },
  balloon_bunch: { label: 'Balon hati', icon: '🎈', area: 'garden', w: 0.5, d: 0.5, keepsake: true, hint: 'Kumpulkan 18 poin di Tembak Sasaran, Dreamlight Funfair', cat: 'desa_taman' },
}
export const KINDS = Object.keys(CATALOG)

/**
 * Prices are in heart coins (koin hati) and must match public.item_price() in
 * supabase/migrations/009_sims_home.sql, 010 and 011 (the server is the one that charges).
 */
export const priceOf = (kind) => CATALOG[kind]?.price || 0

/** The catalog's shelves, like the buy mode in The Sims. */
export const CATEGORIES = [
  { id: 'santai', label: 'Santai', icon: '🛋️', area: 'inside' },
  { id: 'kamar', label: 'Kamar', icon: '🛏️', area: 'inside' },
  { id: 'dapur', label: 'Dapur', icon: '🍳', area: 'inside' },
  { id: 'mandi', label: 'Mandi', icon: '🛁', area: 'inside' },
  { id: 'dekor', label: 'Dekor', icon: '🪴', area: 'inside' },
  { id: 'struktur', label: 'Struktur', icon: '🧱', area: 'inside' },
  { id: 'kenangan', label: 'Kenangan', icon: '💌', area: 'inside' },
  { id: 'desa', label: 'Desa Kurcaci', icon: '🍄', area: 'inside' },
  { id: 'taman', label: 'Taman', icon: '🌷', area: 'garden' },
  { id: 'desa_taman', label: 'Taman Kurcaci', icon: '🍄', area: 'garden' },
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
const KEEP_FREE = []
const PARTITION_RECT = { x0: 0, x1: 0, z0: 0, z1: 0 }
/** The campsite for "Kemah di Bawah Bintang", west of the house (kept free of garden things). */
export const CAMP = { fire: [-5.0, 1.7], tent: [-5.3, 0.15], zone: { x0: -6.6, x1: -3.75, z0: -0.75, z1: 2.85 } }
/** The pet's cushion in the garden (its home until a pet bed is placed in the house). */
export const PET_SPOT = { at: [4.6, 4.4], radius: 2.2, zone: { x0: 4.0, x1: 5.2, z0: 3.8, z1: 5.0 } }
/** The house, its porch and a little margin: no garden things here. */
const HOUSE_ZONE = { x0: 0, x1: 0, z0: 0, z1: 0 }

/* ───────── wall things (picture frames) ───────── */

const WALL_SPANS = { back: {}, left: {}, right: {} }
/** Stretches of each wall that are taken: windows, where the partition meets it, the memory frame. */
const WALL_TAKEN = { back: [], left: [], right: [] }
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
    if (PARTITION.on && overlaps(r, PARTITION_RECT)) return { ok: false, reason: 'Kena dinding kamar.' }
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
  if (layerOf(kind) === 'wall') return snapToWall(IN.x0, IN.z0 + 1.2)
  return c.area === 'inside' ? snapPlacement(kind, -1.0, (IN.z0 + IN.z1) / 2 - 0.4, 0) : snapPlacement(kind, 2.75, 6.0, 0)
}

/* ───────── walking: walls and furniture block the avatar ───────── */

/** Wall centre lines (house-local) once the cottage stands; the door is a gap. */
export const WALL_SEGMENTS = []
const BODY = 0.22

/** Is (x, z) (house-local) inside a wall for someone walking? */
export const hitsWall = (x, z) => WALL_SEGMENTS.some(([a, b]) => segDist(x, z, a, b) < BODY)
/** Is (x, z) (house-local) inside a piece of furniture someone can't walk through? */
export function hitsItem(item, x, z, pad = BODY * 0.7) {
  const layer = layerOf(item.kind)
  if (layer !== 'floor') return false
  const r = rectOf(item.kind, item.x, item.z, item.rot)
  if (!(x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad)) return false
  // a wall piece with a doorway: only its two ends are solid, the middle is the way through
  if (item.kind === 'wall_arch') {
    const along = item.rot % 2 === 1 ? z - item.z : x - item.x
    return Math.abs(along) > 0.42
  }
  return true
}
/** Is (x, z) (house-local) within the house's walls? */
export const inHouse = (x, z) => Math.abs(x) < OUTER.hw && z > OUTER.cz - OUTER.hd && z < FRONT

/* ───────── the house's shape for its size ───────── */

const setRect = (target, x0, x1, z0, z1) => Object.assign(target, { x0, x1, z0, z1 })

/**
 * Re-shape the house for a size (1 small, 2 medium, 3 large). Everything above is updated in place;
 * returns true if anything changed (so the walls and the walking rules can be rebuilt).
 */
export function applyHouseSize(size) {
  const def = HOUSE_SIZES[size] || HOUSE_SIZES[1]
  const n = HOUSE_SIZES[size] ? size : 1
  if (n === houseSize && WINDOWS.length) return false
  houseSize = n
  const { hw, hd } = def
  const cz = FRONT - hd // the cottage's centre: the front stays, the back grows
  Object.assign(OUTER, { hw, hd, cz })
  setRect(IN, -hw + 0.15, hw - 0.15, cz - hd + 0.15, FRONT - 0.15)
  // the small house keeps its built-in partition; bigger ones are open (build your own rooms)
  Object.assign(PARTITION, { x: 0.9, z0: cz - hd, z1: 0.75, on: n === 1 })
  setRect(MEMORY_CORNER, IN.x0, IN.x0 + 1.3, IN.z0, IN.z0 + 0.5)
  // windows spread along the walls (front ones keep clear of the door)
  WINDOWS.length = 0
  WINDOWS.push(['front', -(hw - 0.8), 0.8], ['front', hw - 1.2, 0.9])
  if (n === 3) WINDOWS.push(['front', 1.0, 0.8])
  WINDOWS.push(['back', -0.4, 0.9], ['back', hw - 1.2, 0.7])
  if (n === 3) WINDOWS.push(['back', 1.4, 0.8])
  if (n === 1) WINDOWS.push(['left', 0.2, 0.9], ['right', -0.6, 0.8])
  else WINDOWS.push(['left', -hd * 0.42, 0.9], ['left', hd * 0.42, 0.9], ['right', -hd * 0.42, 0.8], ['right', hd * 0.42, 0.8])
  // what has to stay free, and where wall frames can hang
  KEEP_FREE.length = 0
  KEEP_FREE.push({ x0: DOOR.x0 - 0.05, x1: DOOR.x1 + 0.05, z0: FRONT - 1.05, z1: IN.z1 })
  if (PARTITION.on) KEEP_FREE.push({ x0: PARTITION.x - 0.45, x1: PARTITION.x + 0.45, z0: PARTITION.z1, z1: IN.z1 })
  KEEP_FREE.push(MEMORY_CORNER)
  if (PARTITION.on) setRect(PARTITION_RECT, PARTITION.x - 0.09, PARTITION.x + 0.09, IN.z0, PARTITION.z1)
  else setRect(PARTITION_RECT, 99, 99, 99, 99)
  setRect(HOUSE_ZONE, -hw - 0.45, hw + 0.45, cz - hd - 0.45, PORCH.z1 + 0.3)
  // the campsite moves west as the house widens
  const dx = hw - 3.2
  CAMP.fire = [-5.0 - dx, 1.7]
  CAMP.tent = [-5.3 - dx, 0.15]
  setRect(CAMP.zone, -6.6 - dx, -3.75 - dx, -0.75, 2.85)
  Object.assign(WALL_SPANS.back, { axis: 'x', fixed: IN.z0 + 0.04, rot: 0, min: IN.x0, max: IN.x1 })
  Object.assign(WALL_SPANS.left, { axis: 'z', fixed: IN.x0 + 0.04, rot: 1, min: IN.z0, max: IN.z1 })
  Object.assign(WALL_SPANS.right, { axis: 'z', fixed: IN.x1 - 0.04, rot: 3, min: IN.z0, max: IN.z1 })
  const span = (side, shift = 0) => WINDOWS.filter((w) => w[0] === side).map(([, c, w]) => [c + shift - w / 2, c + shift + w / 2])
  WALL_TAKEN.back = [...span('back'), ...(PARTITION.on ? [[PARTITION.x - 0.1, PARTITION.x + 0.1]] : []), [MEMORY_CORNER.x0, MEMORY_CORNER.x1 + 0.1]]
  WALL_TAKEN.left = span('left', cz)
  WALL_TAKEN.right = span('right', cz)
  // walls for walking: back, sides, the front with its door gap, and the partition
  const back = cz - hd
  WALL_SEGMENTS.length = 0
  WALL_SEGMENTS.push(
    [[-hw, back], [hw, back]],
    [[-hw, back], [-hw, FRONT]],
    [[hw, back], [hw, FRONT]],
    [[-hw, FRONT], [DOOR.x0, FRONT]],
    [[DOOR.x1, FRONT], [hw, FRONT]],
  )
  if (PARTITION.on) WALL_SEGMENTS.push([[PARTITION.x, PARTITION.z0], [PARTITION.x, PARTITION.z1]])
  return true
}
applyHouseSize(1)
