import { create } from 'zustand'
import { addCollider, blockers, grounds, obstacles, standHeight, walkable } from './terrain'
import { MANSION_BOX, MANSION_GATE, meadowHeight } from './meadow'
import { onRoom, partner, presence, supabase, useCouple } from './couple'
import { player } from './player'
import { straightZones } from './path'
import { serverNow } from './clock'
import { uid } from './uid'
import { addMood } from './mood'
import { refreshHouse } from './home'
import { useDate } from './date'
import { atmosphere } from './atmosphere'
import { useStore } from '../store'
import { audio } from '../audio/engine'

/*
 * THE HAUNTED GNOME MANSION — Rumah Kurcaci Berhantu: an old house behind an iron fence south of the
 * pond (its grounds are a level pad in lib/meadow.js; it's drawn by components/three/Mansion.jsx, its
 * ghosts are lib/mansionGhosts.js + components/three/MansionGhosts.jsx, its screens are
 * components/ui/MansionUI.jsx and its words are lib/mansionStory.js).
 *
 * The house has three storeys on a stone foundation: the basement at the grounds' level, the ground
 * floor up the porch steps, and the attic under the roof. They're stacked, so which floor she's on
 * comes from her height (a `grounds` hook in lib/terrain.js gives the floor under her feet, and the
 * walls below are chosen by the storey she's on).
 *
 * The story is ONE run shared by the two of you (supabase/migrations/014_haunted_mansion.sql): which
 * steps are done, which of the four heirlooms are found, the symbol wheels, the ending. Every door and
 * lock opens from that shared row, never from one screen's guess; the server checks each step's
 * prerequisites (and the codes). Without the server (or before 014 is installed) the very same rules
 * run here and the run is kept on this device.
 *
 * Little things done together that don't need saving (a lever held down, the gramophone playing, the
 * candle on its stand, a cupboard full of chickens) travel with each character as short "actions"
 * (act() below), timed on the shared clock, so both screens see the same moment.
 */

/* ───────── where the house stands ───────── */

/** The house's middle (world). Building-local: lx = x − MX (west −, east +), lz = z − MZ (north −, front +). */
export const MX = 31
export const MZ = 53
/** Half sizes of the house (the outer walls). */
export const HW = 7
export const HD = 5
/** The grounds' level (the pad is flat). */
let levelY = null
export const groundLevel = () => (levelY ??= meadowHeight((MANSION_BOX.x0 + MANSION_BOX.x1) / 2, (MANSION_BOX.z0 + MANSION_BOX.z1) / 2))
/** Each storey's floor, above the grounds. */
export const FL = { B: 0, G: 2.4, A: 5.2 }
/** …and how tall its rooms are. */
export const ROOM_H = { B: 2.2, G: 2.6, A: 2.5 }
export const floorY = (f) => groundLevel() + FL[f]
/** Which storey a height belongs to. */
export const floorOf = (y) => (y < groundLevel() + 1.2 ? 'B' : y < groundLevel() + 3.8 ? 'G' : 'A')

export const toWorld = (lx, lz) => [MX + lx, MZ + lz]
export const toLocal = (x, z) => [x - MX, z - MZ]

export const GATE = MANSION_GATE
export const FENCE = { x0: MANSION_BOX.x0 + 0.3, x1: MANSION_BOX.x1 - 0.3, z0: MANSION_BOX.z0 + 0.3, z1: MANSION_BOX.z1 - 0.3 }
/** Just outside the gate, on the footpath (where "Keluar dari rumah" sets her down). */
export const OUTSIDE = [GATE.x - 1.6, GATE.z]

/** The front porch: a landing at the ground floor, and the steps down to the yard. */
export const LANDING = { x0: -1.5, x1: 1.5, z0: 5, z1: 5.9 }
export const STAIRS = { x0: -1.2, x1: 1.2, z0: 5.9, z1: 9.3 }
/** The cellar stairs (from a little landing in the kitchen down, northward) and the attic stairs (from the corridor up, southward). */
export const CELLAR_STAIRS = { x0: 5.8, x1: 6.8, z0: 0.7, z1: 3.7 }
export const ATTIC_STAIRS = { x0: -1.9, x1: -0.9, z0: -4.2, z1: -0.5 }
/** The attic: smaller, under the roof. */
export const ATTIC = { x0: -5.5, x1: 5.5, z0: -4.8, z1: 3.5 }

/** The rooms (building-local), for the lights, the sounds, the quest card and the scares. */
export const ROOMS = {
  foyer: { f: 'G', x0: -2, x1: 2, z0: 0, z1: 5, name: 'Foyer', light: '#ffcf8a' },
  living: { f: 'G', x0: -7, x1: -2, z0: 0, z1: 5, name: 'Ruang Tamu', light: '#ffb36b' },
  kitchen: { f: 'G', x0: 2, x1: 7, z0: 0, z1: 5, name: 'Dapur Misterius', light: '#c8f0a0' },
  dolls: { f: 'G', x0: -7, x1: -2, z0: -5, z1: 0, name: 'Kamar Boneka', light: '#f2a8d8' },
  library: { f: 'G', x0: 2, x1: 7, z0: -5, z1: 0, name: 'Perpustakaan', light: '#9fd0ff' },
  corridor: { f: 'G', x0: -2, x1: 2, z0: -5, z1: 0, name: 'Lorong Rahasia', light: '#b9a5ff' },
  boiler: { f: 'B', x0: 2, x1: 7, z0: -5, z1: 5, name: 'Ruang Ketel', light: '#ff9a6b' },
  hall: { f: 'B', x0: -2, x1: 2, z0: -5, z1: 5, name: 'Lorong Basement', light: '#8fd6c8' },
  cellar: { f: 'B', x0: -7, x1: -2, z0: 0, z1: 5, name: 'Gudang Anggur', light: '#ff8fd0' },
  vault: { f: 'B', x0: -7, x1: -2, z0: -5, z1: 0, name: 'Ruang Brankas', light: '#a8b8ff' },
  attic: { f: 'A', ...ATTIC, name: 'Loteng', light: '#c9a5ff' },
}
const inR = (x, z, r, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad
/** Inside the house's walls (building-local)? */
export const inFootprint = (lx, lz, pad = 0) => Math.abs(lx) < HW + pad && lz > -HD - pad && lz < HD + pad
/** The room at a world point (and height), or null. */
export function roomAt(x, y, z) {
  const [lx, lz] = toLocal(x, z)
  if (!inFootprint(lx, lz)) return null
  const f = floorOf(y)
  for (const [id, r] of Object.entries(ROOMS)) if (r.f === f && inR(lx, lz, r)) return id
  return null
}
/** On the grounds (inside the fence)? */
export const onGrounds = (x, z) => x > FENCE.x0 && x < FENCE.x1 && z > FENCE.z0 && z < FENCE.z1
/** In the house, or on its porch? */
export const inHouse = (x, z) => {
  const [lx, lz] = toLocal(x, z)
  return inFootprint(lx, lz, 0.1) || inR(lx, lz, LANDING) || inR(lx, lz, STAIRS)
}

/* ───────── the furniture (building-local; solid ones block, Mansion.jsx draws each kind) ───────── */

/**
 * { id, f (storey), kind, x, z (centre), w (along x), d (along z), solid? (default true) }
 * Hiding places have `hide: true`; she steps inside and is set down at `out` when she leaves.
 */
export const FURNITURE = [
  // the foyer
  { id: 'diary_table', f: 'G', kind: 'side_table', x: -1.45, z: 0.45, w: 0.7, d: 0.4 },
  { id: 'coat_closet', f: 'G', kind: 'closet', x: 1.45, z: 0.42, w: 0.8, d: 0.45 },
  { id: 'umbrellas', f: 'G', kind: 'umbrellas', x: 1.65, z: 4.45, w: 0.3, d: 0.3 },
  // the living room
  { id: 'fireplace', f: 'G', kind: 'fireplace', x: -6.72, z: 2.5, w: 0.5, d: 1.6 },
  { id: 'sofa', f: 'G', kind: 'sofa', x: -4.4, z: 4.4, w: 1.9, d: 0.7 },
  { id: 'coffee_table', f: 'G', kind: 'coffee_table', x: -4.4, z: 3.0, w: 1.0, d: 0.55 },
  { id: 'armchair', f: 'G', kind: 'armchair', x: -6.25, z: 4.4, w: 0.7, d: 0.7 },
  { id: 'piano', f: 'G', kind: 'piano', x: -3.0, z: 0.42, w: 1.3, d: 0.55 },
  { id: 'living_cabinet', f: 'G', kind: 'wardrobe', x: -6.6, z: 0.55, w: 0.7, d: 0.65, hide: true, out: [-5.9, 1.2] },
  // the kitchen
  { id: 'oven', f: 'G', kind: 'oven', x: 2.75, z: 0.4, w: 1.0, d: 0.6 },
  { id: 'chicken_cupboard', f: 'G', kind: 'cupboard', x: 3.6, z: 4.62, w: 1.3, d: 0.5 },
  { id: 'kitchen_table', f: 'G', kind: 'kitchen_table', x: 4.1, z: 2.6, w: 1.2, d: 0.8 },
  { id: 'icebox', f: 'G', kind: 'icebox', x: 5.15, z: 4.62, w: 0.65, d: 0.5 },
  { id: 'spice_shelf', f: 'G', kind: 'shelf', x: 6.4, z: 0.3, w: 1.0, d: 0.36 },
  // the dolls' room
  { id: 'doll_shelf', f: 'G', kind: 'doll_shelf', x: -6.75, z: -2.6, w: 0.4, d: 3.2 },
  { id: 'mirror', f: 'G', kind: 'mirror', x: -4.4, z: -4.86, w: 1.2, d: 0.18 },
  { id: 'doll_bed', f: 'G', kind: 'doll_bed', x: -5.6, z: -0.55, w: 1.1, d: 0.7 },
  { id: 'doll_house', f: 'G', kind: 'doll_house', x: -2.75, z: -2.6, w: 0.8, d: 0.6 },
  { id: 'dolls_wardrobe', f: 'G', kind: 'wardrobe', x: -2.55, z: -4.5, w: 0.8, d: 0.6, hide: true, out: [-3.3, -3.8] },
  // the library
  { id: 'shelves_n', f: 'G', kind: 'bookshelf', x: 4.6, z: -4.76, w: 4.4, d: 0.45 },
  { id: 'shelves_e', f: 'G', kind: 'bookshelf_side', x: 6.76, z: -2.4, w: 0.45, d: 3.0 },
  { id: 'desk', f: 'G', kind: 'desk', x: 4.6, z: -2.3, w: 1.2, d: 0.7 },
  { id: 'gramophone', f: 'G', kind: 'gramophone', x: 6.4, z: -0.5, w: 0.55, d: 0.55 },
  { id: 'reading_chair', f: 'G', kind: 'armchair', x: 3.2, z: -0.9, w: 0.7, d: 0.7 },
  // the secret corridor
  { id: 'dial', f: 'G', kind: 'dial', x: 0.8, z: -4.86, w: 1.1, d: 0.18 },
  // the basement
  { id: 'boiler', f: 'B', kind: 'boiler', x: 4.4, z: -2.8, w: 1.6, d: 1.3 },
  { id: 'crates', f: 'B', kind: 'crates', x: 3.0, z: 4.25, w: 1.0, d: 0.9 },
  { id: 'boiler_locker', f: 'B', kind: 'locker', x: 2.5, z: -4.55, w: 0.7, d: 0.5, hide: true, out: [2.9, -3.7] },
  { id: 'barrels_a', f: 'B', kind: 'barrels', x: -6.4, z: 4.3, w: 0.9, d: 0.9 },
  { id: 'barrels_b', f: 'B', kind: 'barrels', x: -6.4, z: 0.9, w: 0.9, d: 0.9 },
  { id: 'party_table', f: 'B', kind: 'party_table', x: -4.6, z: 2.6, w: 1.4, d: 0.9 },
  { id: 'safe', f: 'B', kind: 'safe', x: -4.5, z: -4.55, w: 0.8, d: 0.6 },
  { id: 'vault_crates', f: 'B', kind: 'crates', x: -6.35, z: -3.6, w: 0.9, d: 0.9 },
  { id: 'vault_wardrobe', f: 'B', kind: 'wardrobe', x: -6.6, z: -0.65, w: 0.6, d: 0.8, hide: true, out: [-5.8, -1.2] },
  // the attic
  { id: 'cuckoo_clock', f: 'A', kind: 'cuckoo_clock', x: 0.8, z: -4.42, w: 1.2, d: 0.6 },
  { id: 'trunk', f: 'A', kind: 'trunk', x: 4.2, z: 2.75, w: 1.0, d: 0.6 },
  { id: 'rocking_chair', f: 'A', kind: 'rocking_chair', x: -2.9, z: 2.6, w: 0.7, d: 0.8 },
  { id: 'party_button', f: 'A', kind: 'party_button', x: 3.2, z: 0.9, w: 0.5, d: 0.5 },
]
export const furniture = (id) => FURNITURE.find((f) => f.id === id)
export const HIDE_SPOTS = FURNITURE.filter((f) => f.hide)
/** The boss's four lanterns, in the attic's corners (building-local). */
export const LANTERNS = [
  [-4.7, -4.0],
  [4.7, -4.0],
  [-4.7, 2.75],
  [4.7, 1.6],
]
/** The candle mark in the dolls' room (the mirror only shows the truth by candlelight). */
export const CANDLE_MARK = [-4.4, -2.1]
export const MIRROR_SPOT = [-4.4, -3.9]

/* ───────── walls (building-local segments [ax, az, bx, bz, door?, 'rail'?]) for each storey ───────── */

/** The doors that open from the shared run (and what opens them). */
export const LOCKED_DOORS = {
  library: { step: 'library_open', name: 'Pintu Perpustakaan' },
  bookcase: { step: 'bookcase', name: 'Rak buku' },
  cellar: { step: 'basement_open', name: 'Pintu ruang bawah tanah' },
  hatch: { step: 'attic_open', name: 'Palka loteng' },
}
const OUTER_G = [
  [-HW, -HD, HW, -HD],
  [-HW, -HD, -HW, HD],
  [HW, -HD, HW, HD],
  [-HW, HD, -0.7, HD],
  [0.7, HD, HW, HD],
]
const WALLS = {
  B: [
    [-HW, -HD, HW, -HD],
    [-HW, -HD, -HW, HD],
    [HW, -HD, HW, HD],
    [-HW, HD, HW, HD],
    [2, -HD, 2, -0.6],
    [2, 0.6, 2, HD],
    [-2, -HD, -2, -3.1],
    [-2, -1.9, -2, 1.9],
    [-2, 3.1, -2, HD],
    [-HW, 0, -2, 0],
  ],
  G: [
    ...OUTER_G,
    [-2, -HD, -2, 1.9],
    [-2, 3.1, -2, HD],
    [2, -HD, 2, -3.1],
    [2, -3.1, 2, -1.9, 'bookcase'],
    [2, -1.9, 2, 1.9],
    [2, 3.1, 2, HD],
    [-HW, 0, -5.1, 0],
    [-3.9, 0, -2, 0],
    [-2, 0, 2, 0],
    [2, 0, 3.9, 0],
    [3.9, 0, 5.1, 0, 'library'],
    [5.1, 0, HW, 0],
    // the cellar stairs: their door at the top, the rail along them
    [CELLAR_STAIRS.x0, CELLAR_STAIRS.z1, CELLAR_STAIRS.x1, CELLAR_STAIRS.z1, 'cellar'],
    [CELLAR_STAIRS.x0, CELLAR_STAIRS.z0, CELLAR_STAIRS.x0, CELLAR_STAIRS.z1, null, 'rail'],
    [CELLAR_STAIRS.x0, CELLAR_STAIRS.z0, CELLAR_STAIRS.x1, CELLAR_STAIRS.z0, null, 'rail'],
    // the attic stairs: the hatch at the bottom, the rail along them
    [ATTIC_STAIRS.x0, ATTIC_STAIRS.z0, ATTIC_STAIRS.x1, ATTIC_STAIRS.z0, 'hatch'],
    [ATTIC_STAIRS.x1, ATTIC_STAIRS.z0, ATTIC_STAIRS.x1, ATTIC_STAIRS.z1, null, 'rail'],
  ],
  A: [
    [ATTIC.x0, ATTIC.z0, ATTIC.x1, ATTIC.z0],
    [ATTIC.x0, ATTIC.z0, ATTIC.x0, ATTIC.z1],
    [ATTIC.x1, ATTIC.z0, ATTIC.x1, ATTIC.z1],
    [ATTIC.x0, ATTIC.z1, ATTIC.x1, ATTIC.z1],
    // the rail round the stairwell (open at its top, to the south)
    [ATTIC_STAIRS.x0, ATTIC_STAIRS.z0, ATTIC_STAIRS.x1, ATTIC_STAIRS.z0, null, 'rail'],
    [ATTIC_STAIRS.x0, ATTIC_STAIRS.z0, ATTIC_STAIRS.x0, ATTIC_STAIRS.z1, null, 'rail'],
    [ATTIC_STAIRS.x1, ATTIC_STAIRS.z0, ATTIC_STAIRS.x1, ATTIC_STAIRS.z1, null, 'rail'],
  ],
}
/** The porch's rails (outside the house). */
const PORCH_RAILS = [
  [LANDING.x0, LANDING.z0, LANDING.x0, LANDING.z1],
  [LANDING.x1, LANDING.z0, LANDING.x1, LANDING.z1],
  [LANDING.x0, LANDING.z1, STAIRS.x0, LANDING.z1],
  [STAIRS.x1, LANDING.z1, LANDING.x1, LANDING.z1],
  [STAIRS.x0, STAIRS.z0, STAIRS.x0, STAIRS.z0 + 2.4],
  [STAIRS.x1, STAIRS.z0, STAIRS.x1, STAIRS.z0 + 2.4],
]
export const wallsOf = (f) => WALLS[f]
export const PORCH = PORCH_RAILS

/* ───────── the floor under her feet ───────── */

/** The cellar stairs' height at lz (top at the kitchen, bottom in the boiler room). */
const cellarStep = (lz) => FL.G * Math.min(1, Math.max(0, (lz - CELLAR_STAIRS.z0) / (CELLAR_STAIRS.z1 - CELLAR_STAIRS.z0)))
const atticStep = (lz) => FL.G + (FL.A - FL.G) * Math.min(1, Math.max(0, (lz - ATTIC_STAIRS.z0) / (ATTIC_STAIRS.z1 - ATTIC_STAIRS.z0)))
const porchStep = (lz) => FL.G * (1 - Math.min(1, Math.max(0, (lz - STAIRS.z0) / (STAIRS.z1 - STAIRS.z0))))

/**
 * The floor at building-local (lx, lz) for someone at height `rel` (above the grounds): the highest
 * surface she can step onto (no more than 0.6 above her feet), or the lowest one if none (a wall of
 * stairs she can't climb from here — the controller won't let her step there).
 */
function floorAt(lx, lz, rel) {
  if (inR(lx, lz, STAIRS)) return porchStep(lz)
  if (inR(lx, lz, LANDING)) return FL.G
  if (!inFootprint(lx, lz)) return null
  if (inR(lx, lz, CELLAR_STAIRS)) return cellarStep(lz)
  const cands = inR(lx, lz, ATTIC_STAIRS) ? [FL.B, atticStep(lz)] : inR(lx, lz, ATTIC) ? [FL.B, FL.G, FL.A] : [FL.B, FL.G]
  let best = null
  for (const c of cands) if (c <= rel + 0.6 && (best === null || c > best)) best = c
  return best ?? Math.min(...cands)
}
grounds.push((x, z, fromY) => {
  if (fromY === undefined) return null
  const lx = x - MX
  const lz = z - MZ
  if (lx < -HW - 0.3 || lx > HW + 0.3 || lz < -HD - 0.3 || lz > STAIRS.z1 + 0.1) return null
  const L = groundLevel()
  const f = floorAt(lx, lz, fromY - L)
  return f === null ? null : L + f
})

/* ───────── walking: the walls of the storey she's on, the furniture, the porch, the fence ───────── */

const BODY = 0.22
const segDist = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
export const doorOpen = (door) => !LOCKED_DOORS[door] || has(LOCKED_DOORS[door].step)
/** Does a wall (of `segs`) stand between… well, at (lx, lz), when she's at (plx, plz)? Never traps her inside one. */
function segsBlock(segs, lx, lz, plx, plz) {
  for (const s of segs) {
    if (s[4] && doorOpen(s[4])) continue
    if (segDist(lx, lz, s[0], s[1], s[2], s[3]) < BODY && segDist(plx, plz, s[0], s[1], s[2], s[3]) >= BODY) return true
  }
  return false
}
const SOLIDS = { B: [], G: [], A: [] }
for (const f of FURNITURE) if (f.solid !== false) SOLIDS[f.f].push({ x0: f.x - f.w / 2, x1: f.x + f.w / 2, z0: f.z - f.d / 2, z1: f.z + f.d / 2 })
for (const [x, z] of LANTERNS) SOLIDS.A.push({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2 })
const FOOT = { x0: -HW - 0.12, x1: HW + 0.12, z0: -HD - 0.12, z1: HD + 0.12 }
const FENCE_SEGS = [
  [FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0],
  [FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1],
  [FENCE.x0, FENCE.z1, FENCE.x1, FENCE.z1],
  [FENCE.x0, FENCE.z0, FENCE.x0, GATE.z - GATE.half],
  [FENCE.x0, GATE.z + GATE.half, FENCE.x0, FENCE.z1],
]
blockers.push((x, z) => {
  if (x < MANSION_BOX.x0 - 1 || x > MANSION_BOX.x1 + 1 || z < MANSION_BOX.z0 - 1 || z > MANSION_BOX.z1 + 1) return false
  const px = player.position.x
  const pz = player.position.z
  // the iron fence (open at the gate)
  if (segsBlock(FENCE_SEGS, x, z, px, pz)) return true
  const lx = x - MX
  const lz = z - MZ
  const plx = px - MX
  const plz = pz - MZ
  if (!inFootprint(lx, lz, 0.4) && !inR(lx, lz, LANDING, 0.4) && !inR(lx, lz, STAIRS, 0.4)) return false
  const rel = player.position.y - groundLevel()
  if (inFootprint(plx, plz)) {
    // inside: the walls and furniture of her storey
    const f = floorOf(player.position.y)
    if (segsBlock(WALLS[f], lx, lz, plx, plz)) return true
    for (const r of SOLIDS[f]) if (inR(lx, lz, r, BODY * 0.5) && !inR(plx, plz, r, BODY * 0.5)) return true
    return false
  }
  // outside: the porch's rails; up on the porch the front wall (with its door), down here the
  // whole house (its foundation) is solid
  if (segsBlock(PORCH_RAILS, lx, lz, plx, plz)) return true
  if (rel > 1.0) return segsBlock(OUTER_G, lx, lz, plx, plz)
  return inR(lx, lz, FOOT, BODY * 0.5) && !inR(plx, plz, FOOT, BODY * 0.5)
})
/** In the house (or on the porch), tap-to-walk goes straight (the walking grid is flat). */
straightZones.push((sx, sz) => {
  const [lx, lz] = toLocal(sx, sz)
  return inFootprint(lx, lz, 0.3) || inR(lx, lz, LANDING, 0.3) || inR(lx, lz, STAIRS, 0.3)
})

/** The yard: dead trees, pumpkins, crooked lamp posts, gnome-sized gravestones (Mansion.jsx draws them). */
export const YARD_TREES = [
  [23.6, 48.8, 1.15],
  [38.5, 49.2, 1.0],
  [38.6, 63.4, 0.9],
  [23.4, 55.2, 0.8],
]
export const YARD_LAMPS = [
  [26.6, 63.4],
  [35.4, 63.4],
  [23.4, 59.6],
  [38.8, 57.6],
]
export const PUMPKINS = [
  [28.9, 62.0, 0.9],
  [33.1, 62.1, 1.1],
  [24.8, 63.6, 0.8],
  [37.4, 62.4, 1.0],
  [39.0, 53.6, 0.7],
  [23.0, 51.6, 0.75],
]
export const GRAVES = [
  [38.9, 51.0, 0.2],
  [38.9, 52.6, -0.15],
  [38.9, 54.2, 0.1],
]
/** The paved walk from the gate to the porch steps (world). */
export const WALK = [
  [GATE.x + 0.2, GATE.z],
  [26.4, 63.4],
  [MX, MZ + STAIRS.z1 + 0.6],
]
for (const [x, z, s] of YARD_TREES) addCollider(x, z, 0.28 * s)
for (const [x, z] of YARD_LAMPS) addCollider(x, z, 0.12)
for (const [x, z, s] of PUMPKINS) addCollider(x, z, 0.22 * s)
for (const [x, z] of GRAVES) addCollider(x, z, 0.24)
obstacles.version++

/* ───────── the story: the steps of a run, and what each one needs (mirror of 014_haunted_mansion.sql) ───────── */

/**
 * Every step of the run and the steps it needs first. `via`: steps that only their own server
 * function grants (two levers at once, the symbol wheels, the safe's code).
 */
export const STEPS = {
  enter: { needs: [] },
  diary: { needs: ['enter'] },
  cici: { needs: ['enter'] },
  library_open: { needs: ['diary'], via: 'press' },
  mirror: { needs: ['diary'] },
  key_a: { needs: ['diary'] },
  key_b: { needs: ['mirror'] },
  basement_open: { needs: ['key_a', 'key_b'] },
  bookcase: { needs: ['library_open'] },
  dial_open: { needs: ['bookcase'], via: 'dial' },
  safe: { needs: ['basement_open'], via: 'code' },
  attic_open: { needs: ['dial_open', 'safe'] },
  boss_seen: { needs: ['attic_open'] },
  boss_done: { needs: ['boss_seen'] },
}
/** The four heirlooms of the Kenop family (the good ending needs all four). */
export const ITEMS = {
  watch: { needs: ['diary'], name: 'Jam Saku Retak', icon: '⌚' },
  hat: { needs: ['key_a'], name: 'Topi Tambalan', icon: '🎩' },
  musicbox: { needs: ['bookcase'], name: 'Kotak Musik Mungil', icon: '🎶' },
  candle: { needs: ['safe'], name: 'Lilin Biru', icon: '🕯️' },
}
export const ITEM_IDS = Object.keys(ITEMS)
/** The symbol wheels in the secret corridor: 6 symbols each; the right order is told by four paintings. */
export const SYMBOLS = ['🍄', '🌙', '🔑', '🕯️', '🐔', '👻']
export const SYMBOL_NAMES = ['jamur', 'bulan', 'kunci', 'lilin', 'ayam', 'hantu']
export const PAINTINGS = [
  { room: 'living', symbol: 1, order: 'I' },
  { room: 'dolls', symbol: 0, order: 'II' },
  { room: 'kitchen', symbol: 4, order: 'III' },
  { room: 'library', symbol: 3, order: 'IV' },
]
const DIAL_ANSWER = [1, 0, 4, 3]
/** The safe's code: the book's cipher, read off the boiler room wall (🐔 🕯️ 🌙, right to left). */
export const CIPHER = { '🍄': 4, '🌙': 7, '🔑': 1, '🕯️': 9, '🐔': 2, '👻': 5 }
const SAFE_CODE = '297'
const PRESS_TOGETHER = 3 // seconds: two people, one lever each
const PRESS_ALONE = 7 // seconds: one person running between them

const EMPTY_RUN = () => ({ run_id: null, steps: [], items: [], dial: [0, 0, 0, 0], ending: null, endings_seen: [] })
const LOCAL_KEY = 'our-little-universe:mansion'

/**
 * status: 'local' (kept on this device) | 'loading' | 'ready' (shared, from the server) | 'missing'
 *   (014 isn't installed: kept on this device for now)
 * run: { run_id, steps, items, dial, ending, endings_seen }
 * near: near enough to draw the house · onGrounds / inside / floor / room: where she is
 * panel: the screen open in MansionUI: 'diary' | 'book' | 'dial' | 'safe' | 'mirror' | 'ending' | 'quest' | null
 */
export const useMansion = create(() => ({
  status: 'local',
  run: loadLocal(),
  near: false,
  onGrounds: false,
  inside: false,
  floor: 'G',
  room: null,
  panel: null,
  page: 0,
  hiding: null,
  busy: false,
  error: null,
}))
const get = () => useMansion.getState()
const set = (patch) => useMansion.setState(patch)
const toast = (text, ms = 3600) => useStore.getState().showToast(text, ms)

export const has = (step) => get().run.steps.includes(step)
export const hasItem = (item) => get().run.items.includes(item)
/** Are a step's prerequisites done (so it may be done now)? */
export const ready = (step) => {
  const def = STEPS[step] || ITEMS[step]
  return Boolean(def) && def.needs.every(has)
}
export const itemCount = () => ITEM_IDS.filter(hasItem).length

/* ───────── kept on this device (no server, or 014 not installed yet) ───────── */

function loadLocal() {
  try {
    const r = JSON.parse(localStorage.getItem(LOCAL_KEY))
    if (r && Array.isArray(r.steps)) return { ...EMPTY_RUN(), ...r }
  } catch {
    // nothing saved
  }
  return EMPTY_RUN()
}
function saveLocal(run) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(run))
  } catch {
    // a private window: the run lasts as long as the tab
  }
}
const localPresses = {}
/** The rules, here (the same as the server's functions in 014). Returns the new run, or null if nothing changed. */
function localRule(kind, arg, arg2) {
  const run = get().run
  const addStep = (r, s) => (r.steps.includes(s) ? r : { ...r, steps: [...r.steps, s] })
  switch (kind) {
    case 'step': {
      if (STEPS[arg]) {
        if (STEPS[arg].via || has(arg) || !ready(arg)) return null
        return addStep({ ...run, run_id: run.run_id || uid() }, arg)
      }
      if (ITEMS[arg]) {
        if (hasItem(arg) || !ready(arg)) return null
        return { ...run, items: [...run.items, arg] }
      }
      return null
    }
    case 'press': {
      const t = serverNow() / 1000
      localPresses[arg] = t
      const other = arg === 'hearth' ? 'oven' : 'hearth'
      if (has('library_open') || !ready('library_open') || !(t - (localPresses[other] ?? -99) <= PRESS_ALONE)) return null
      return addStep(run, 'library_open')
    }
    case 'dial': {
      if (!has('bookcase') || has('dial_open')) return null
      const dial = run.dial.slice()
      dial[arg] = arg2
      const next = { ...run, dial }
      return dial.every((v, i) => v === DIAL_ANSWER[i]) ? addStep(next, 'dial_open') : next
    }
    case 'code':
      if (!ready('safe') || has('safe') || String(arg) !== SAFE_CODE) return null
      return addStep(run, 'safe')
    case 'end': {
      if (!has('boss_done') || run.ending) return null
      if (arg === 'good' && itemCount() < ITEM_IDS.length) return null
      return { ...run, ending: arg, endings_seen: run.endings_seen.includes(arg) ? run.endings_seen : [...run.endings_seen, arg] }
    }
    case 'reset':
      return { ...EMPTY_RUN(), endings_seen: run.endings_seen }
    default:
      return null
  }
}

/* ───────── shared (the server's row) ───────── */

const shared = () => supabase && useCouple.getState().status === 'connected' && get().status === 'ready'
export const isShared = () => Boolean(shared())

export async function loadMansion() {
  if (!supabase || useCouple.getState().status !== 'connected') return
  if (get().status !== 'ready') set({ status: 'loading' })
  const { data, error } = await supabase.from('mansion_progress').select('*').eq('id', 1).maybeSingle()
  if (error || !data) {
    // 014 isn't installed yet: the run stays on this device
    set({ status: 'missing', run: loadLocal() })
    return
  }
  applyRow(data)
  set({ status: 'ready' })
}
function applyRow(row) {
  if (!row) return
  const run = {
    run_id: row.run_id || null,
    steps: Array.isArray(row.steps) ? row.steps : [],
    items: Array.isArray(row.items) ? row.items : [],
    dial: Array.isArray(row.dial) && row.dial.length === 4 ? row.dial.map(Number) : [0, 0, 0, 0],
    ending: row.ending || null,
    endings_seen: Array.isArray(row.endings_seen) ? row.endings_seen : [],
  }
  changed(get().run, run)
  set({ run })
}
onRoom({
  attach(channel) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'mansion_progress' }, (p) => p.new?.id === 1 && get().status === 'ready' && applyRow(p.new))
  },
  subscribed: () => loadMansion(),
  left: () => get().status !== 'local' && set({ status: 'local', run: loadLocal() }),
})
useCouple.subscribe((s, prev) => {
  if (s.status === prev.status) return
  if (s.status === 'connected') loadMansion()
  else if (get().status !== 'local') set({ status: 'local', run: loadLocal() })
})

/** Ask (the server, or the local rules). Returns true if the run changed. */
async function ask(kind, rpc, args, arg, arg2) {
  if (shared()) {
    set({ busy: true })
    const { data, error } = await supabase.rpc(rpc, args)
    set({ busy: false })
    if (error) {
      set({ error: 'Koneksinya lagi putus-putus. Coba lagi sebentar, ya.' })
      return false
    }
    set({ error: null })
    const before = get().run
    applyRow(data)
    return get().run !== before && JSON.stringify(get().run) !== JSON.stringify(before)
  }
  const next = localRule(kind, arg, arg2)
  if (!next) return false
  changed(get().run, next)
  set({ run: next })
  saveLocal(next)
  return true
}

/** Mark a step (or an heirloom) done. */
export const doStep = (step) => ask('step', 'mansion_step', { p_step: step }, step)
/** One of the two levers (the hearth in the living room, the oven in the kitchen). */
export const pressLever = (button) => ask('press', 'mansion_press', { p_button: button }, button)
/** Turn a symbol wheel in the secret corridor. */
export const setWheel = (wheel, symbol) => ask('dial', 'mansion_dial', { p_wheel: wheel, p_symbol: symbol }, wheel, symbol)
/** The safe's three digits. */
export const tryCode = (code) => ask('code', 'mansion_code', { p_code: String(code) }, String(code))
/** How the story ends ('good' | 'funny'): once a run, for both of you. */
export const chooseEnding = (ending) => ask('end', 'mansion_end', { p_ending: ending }, ending)
/** Play again from the start (the endings you've seen are kept). */
export const resetRun = () => ask('reset', 'mansion_reset', {}, null)

/* ───────── what a change means (the same on both screens: both see the row change) ───────── */

const listeners = new Set()
/** fn({ steps: [new steps], items: [new heirlooms], ending: new ending | null, reset: bool }) */
export const onRunChange = (fn) => (listeners.add(fn), () => listeners.delete(fn))
function changed(before, after) {
  const steps = after.steps.filter((s) => !before.steps.includes(s))
  const items = after.items.filter((s) => !before.items.includes(s))
  const ending = after.ending && after.ending !== before.ending ? after.ending : null
  const reset = before.steps.length > 0 && after.steps.length === 0
  if (!steps.length && !items.length && !ending && !reset) return
  // (later, once the new state is in place)
  setTimeout(() => listeners.forEach((fn) => fn({ steps, items, ending, reset })), 0)
}

/* ───────── little things done together, timed on the shared clock (sent with my character) ───────── */

/** My latest actions (newest first): { id, kind, seat?, n?, at (shared-clock ms) }. */
export const myActs = []
export function act(kind, seat, n) {
  const a = { id: uid().slice(0, 12), kind, at: Math.round(serverNow()) }
  if (seat != null) a.seat = String(seat)
  if (n != null) a.n = n
  myActs.unshift(a)
  if (myActs.length > 4) myActs.length = 4
  return a
}
/** Their latest actions (from their character). */
export const mateActs = () => (partner.online && partner.haunt?.a) || []
/** The newest action of a kind (and seat) by either of us, within `withinMs`: { ...action, mine } or null. */
export function lastAct(kind, seat, withinMs = Infinity) {
  let best = null
  const t = serverNow()
  for (const [list, mine] of [
    [myActs, true],
    [mateActs(), false],
  ])
    for (const a of list)
      if (a.kind === kind && (seat == null || a.seat === String(seat)) && t - a.at <= withinMs && (!best || a.at > best.at)) best = { ...a, mine }
  return best
}

/* ───────── a ginger biscuit from the kitchen (for a scared little ghost) ───────── */

let cookie = false
export const hasCookie = () => cookie
export function takeCookie() {
  if (cookie) return false
  cookie = true
  return true
}
/** Hand it to Cici: she isn't scared any more (for both of you). */
export function giveCookie() {
  if (!cookie) return false
  cookie = false
  doStep('cici')
  return true
}

/* ───────── hiding in a wardrobe ───────── */

export function hideIn(id) {
  const spot = furniture(id)
  if (!spot?.hide) return
  player.walkTarget = null
  player.onArrive = null
  player.speed = 0
  player.hide = id
  const [x, z] = toWorld(spot.x, spot.z)
  player.position.set(x, floorY(spot.f), z)
  presence.hide = { id: uid().slice(0, 12), kind: 'hide', seat: id, at: Date.now() }
  audio.hauntSfx?.('door', { gain: 0.6 })
  set({ hiding: id })
}
export function leaveHide() {
  const id = player.hide
  if (!id) return
  const spot = furniture(id)
  player.hide = null
  presence.hide = null
  if (spot) {
    const [x, z] = toWorld(spot.out[0], spot.out[1])
    player.position.set(x, floorY(spot.f), z)
  }
  audio.hauntSfx?.('door', { gain: 0.5 })
  set({ hiding: null })
}
/** The other person is hiding in…? */
export const mateHiding = () => (partner.online && partner.hide?.kind === 'hide' ? partner.hide.seat : null)
const STOREY = { B: 0, G: 1, A: 2 }
/**
 * Is someone at (x, y, z) out of sight for me: on a storey above mine while I'm inside (those floors
 * are lifted away so I can see my own)?
 */
export function aboveMe(x, y, z) {
  const s = get()
  if (!s.inside) return false
  const [lx, lz] = toLocal(x, z)
  return inFootprint(lx, lz, 0.2) && STOREY[floorOf(y)] > STOREY[s.floor]
}

/* ───────── the mansion's screens (MansionUI): the avatar waits while one is open ───────── */

export function openPanel(panel, page = 0) {
  set({ panel, page })
  useStore.setState({ panel: 'mansion', prompt: null })
}
export function closePanel() {
  set({ panel: null })
  if (useStore.getState().panel === 'mansion') useStore.setState({ panel: null })
}
// another panel (settings, the house…) took over: the mansion's screen goes
useStore.subscribe((st, prev) => {
  if (prev.panel === 'mansion' && st.panel !== 'mansion' && get().panel) set({ panel: null })
})

/* ───────── leaving (always possible) ───────── */

export function leaveMansion() {
  const s = useStore.getState()
  s.throughCurtain(() => {
    leaveHide()
    closePanel()
    const [x, z] = OUTSIDE
    const ok = walkable(x, z)
    player.position.set(ok ? x : GATE.x - 0.8, standHeight(ok ? x : GATE.x - 0.8, z), z)
    player.walkTarget = null
    player.onArrive = null
    player.speed = 0
    player.yaw = -Math.PI / 2
    useStore.setState((st) => ({ camNonce: st.camNonce + 1 }))
  }, 1000)
}

/* ───────── every frame: where she is ───────── */

const GRAND_DUSK = { day: 0.3, sunset: 0.2 }
const INDOORS = { day: 0.14, sunset: 0.08 }
const WARM_INSIDE = { day: 0.5, sunset: 0.6 }
let placeSet = null
export function tickMansion() {
  const p = player.position
  const s = get()
  const b = MANSION_BOX
  const near = p.x > b.x0 - 30 && p.x < b.x1 + 30 && p.z > b.z0 - 30 && p.z < b.z1 + 25
  const grounds = onGrounds(p.x, p.z) || inHouse(p.x, p.z)
  const [lx, lz] = toLocal(p.x, p.z)
  const inside = inFootprint(lx, lz)
  const floor = inside ? floorOf(p.y) : 'G'
  const room = inside ? roomAt(p.x, p.y, p.z) : null
  if (near !== s.near || grounds !== s.onGrounds || inside !== s.inside || floor !== s.floor || room !== s.room) set({ near, onGrounds: grounds, inside, floor, room })
  // the light: dusk over the grounds, dim inside (lamps do the rest); only ever undone by us
  const view = useStore.getState().view
  const ended = s.run.ending === 'good'
  const want = view === 'explore' && grounds ? (inside ? (ended ? WARM_INSIDE : INDOORS) : ended ? null : GRAND_DUSK) : null
  if (want !== placeSet) {
    if (want || atmosphere.place === placeSet) atmosphere.place = want
    placeSet = want
  }
  // a story moment (or leaving the world): out of the wardrobe at once
  if (player.hide && view !== 'explore') leaveHide()
  if (s.panel && !grounds) closePanel()
}

/* ───────── rewards (the server gives them with the ending; here, the house finds out) ───────── */

onRunChange(({ ending }) => {
  if (!ending) return
  addMood('berani')
  if (shared()) {
    const kind = ending === 'good' ? 'mansion_clock' : 'ghost_disco'
    useDate.setState((d) => ({ keepsakes: { ...d.keepsakes, [kind]: true } }))
    refreshHouse()
  }
})
