import { create } from 'zustand'
import { addCollider, blockers, obstacles } from './terrain'
import {
  HIDDEN_GROVE,
  LILY_POND,
  meadowHeight,
  VILLAGE_BRIDGE,
  VILLAGE_BUILDINGS,
  VILLAGE_SQUARE,
  villageDoor,
  villageToLocal,
  villageToWorld,
} from './meadow'
import { coupleAvailable, onRoom, partner, presence, supabase, useCouple } from './couple'
import { player } from './player'
import { serverNow } from './clock'
import { hourAt, partOfDay } from './timeOfDay'
import { useStore } from '../store'
import { addMood } from './mood'
import { mateName, refreshHouse, useHome } from './home'
import { leaveCup, useCafe } from './cafe'
import { useDate } from './date'

/*
 * GNOME VILLAGE — the little village around the square south-west of The Little Gnome Café
 * (its ground — pads, paths, the brook — is laid out in lib/meadow.js; it's drawn by
 * components/three/Village.jsx, its screens are components/ui/VillageUI.jsx).
 *
 * Who's who: Tetua Lumut (the elder), Gilo (the gardener), Bu Remah (the baker), Tuan Kenop (the
 * merchant) and Nenek Pim (who lives by the brook) — plus Bram and Pip at the café.
 *
 * Both of you see the same village: every gnome's day is worked out from the shared clock (the
 * same time in both games, lib/clock.js), so they walk the same routes at the same moments on both
 * screens, with nothing sent at all and no gnome made twice.
 *
 * Little jobs (quests) are each person's own: what you're doing is kept on this device; finishing
 * one is saved on the server (village_quests, supabase/migrations/011_gnome_village.sql) once per
 * person — doing it twice, or both at once, never counts twice. The rewards are decorations for the
 * shared house (the server unlocks them once, for both of you) and a few heart coins.
 * One job needs both of you: lighting the twin lanterns on the square, together.
 */

const B = Object.fromEntries(VILLAGE_BUILDINGS.map((b) => [b.id, b]))
export const VB = B
/** A point inside / around a building (building-local) in world space. */
const at = (id, x, z) => villageToWorld(B[id], x, z)
const SQ = VILLAGE_SQUARE

/* ───────── the buildings you can go into ───────── */

export const SHOP_WALL_H = 2.1
export const SHOP_WALL_T = 0.16
export const SHOP_DOOR_W = 1.05
/** Inside the bakery and the decoration shop (building-local): the counter, and what stands about. */
export const INTERIORS = {
  bakery: {
    counter: { x0: -1.2, x1: 1.5, z: -0.85, d: 0.55 },
    oven: { x: 1.65, z: -1.42, r: 0.42 },
    rack: { x: -1.98, z: 0.45, w: 0.36, d: 1.3 },
    table: { x: 1.35, z: 0.85, r: 0.38 },
    windows: [
      ['left', -0.3, 0.9],
      ['right', 0.4, 0.9],
      ['front', -1.45, 0.8],
      ['front', 1.45, 0.8],
    ],
  },
  shop: {
    counter: { x0: -0.1, x1: 1.6, z: -0.85, d: 0.55 },
    shelfBack: { x: -1.25, z: -1.68, w: 1.7, d: 0.34 },
    shelfLeft: { x: -2.0, z: 0.35, w: 0.32, d: 1.5 },
    display: { x: -0.85, z: 0.55, w: 0.9, d: 0.6 },
    windows: [
      ['left', -0.6, 0.9],
      ['right', 0.2, 0.9],
      ['front', -1.45, 0.8],
      ['front', 1.45, 0.8],
    ],
  },
}
/** Is (x, z) (world) inside one of those? → its id, or null (for the roof and the folding walls). */
export function insideBuilding(x, z) {
  for (const id of ['bakery', 'shop']) {
    const b = B[id]
    const [lx, lz] = villageToLocal(b, x, z)
    if (Math.abs(lx) < b.hw && lz > -b.hd && lz < b.hd) return id
  }
  return null
}

/* ───────── walking: walls (doors open), counters, the little houses, and things on the square ───────── */

const BODY = 0.22
const segDist = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1
const SOLIDS = VILLAGE_BUILDINGS.map((b) => {
  if (!b.enter) {
    // a little house you can't go into: all of it, and its doorstep
    return { b, walls: [], rects: [{ x0: -b.hw - 0.08 - BODY, x1: b.hw + 0.08 + BODY, z0: -b.hd - 0.1 - BODY, z1: b.hd + 0.12 + BODY * 0.5 }] }
  }
  const I = INTERIORS[b.id]
  const { hw, hd } = b
  const walls = [
    [-hw, -hd, hw, -hd],
    [-hw, -hd, -hw, hd],
    [hw, -hd, hw, hd],
    [-hw, hd, -SHOP_DOOR_W / 2, hd],
    [SHOP_DOOR_W / 2, hd, hw, hd],
  ]
  const c = I.counter
  const rects = [
    // the counter, and everything behind it (the shopkeeper's side)
    { x0: -hw, x1: hw, z0: -hd, z1: c.z + c.d / 2 + BODY * 0.6 },
  ]
  if (I.rack) rects.push({ x0: -hw, x1: I.rack.x + I.rack.w / 2 + BODY, z0: I.rack.z - I.rack.d / 2 - BODY, z1: I.rack.z + I.rack.d / 2 + BODY })
  if (I.table) rects.push({ x0: I.table.x - I.table.r - BODY * 0.7, x1: I.table.x + I.table.r + BODY * 0.7, z0: I.table.z - I.table.r - BODY * 0.7, z1: I.table.z + I.table.r + BODY * 0.7 })
  if (I.shelfLeft) rects.push({ x0: -hw, x1: I.shelfLeft.x + I.shelfLeft.w / 2 + BODY, z0: I.shelfLeft.z - I.shelfLeft.d / 2 - BODY, z1: I.shelfLeft.z + I.shelfLeft.d / 2 + BODY })
  if (I.display) rects.push({ x0: I.display.x - I.display.w / 2 - BODY * 0.8, x1: I.display.x + I.display.w / 2 + BODY * 0.8, z0: I.display.z - I.display.d / 2 - BODY * 0.8, z1: I.display.z + I.display.d / 2 + BODY * 0.8 })
  return { b, walls, rects }
})
blockers.push((wx, wz) => {
  if (Math.abs(wx - SQ.x) > 24 || Math.abs(wz - SQ.z) > 22) return false
  for (const { b, walls, rects } of SOLIDS) {
    if (Math.abs(wx - b.x) > b.hw + 1.2 && Math.abs(wz - b.z) > b.hw + 1.2) continue
    if (Math.hypot(wx - b.x, wz - b.z) > Math.hypot(b.hw, b.hd) + 1) continue
    const [x, z] = villageToLocal(b, wx, wz)
    const [px, pz] = villageToLocal(b, player.position.x, player.position.z)
    // never trap her inside something (she can always walk out of it)
    if (walls.some(([ax, az, bx, bz]) => segDist(x, z, ax, az, bx, bz) < BODY) && !walls.some(([ax, az, bx, bz]) => segDist(px, pz, ax, az, bx, bz) < BODY)) return true
    if (rects.some((r) => inRect(x, z, r) && !inRect(px, pz, r))) return true
  }
  return false
})

/** Things standing about the village (circles): kept in step with Village.jsx, which draws them. */
export const FOUNTAIN = { x: SQ.x, z: SQ.z, r: 0.95 }
const BOARD_AT = [SQ.x + 0.9, SQ.z - 2.85]
export const NOTICE_BOARD = { x: BOARD_AT[0], z: BOARD_AT[1], yaw: Math.atan2(SQ.x - BOARD_AT[0], SQ.z - BOARD_AT[1]) }
/** Lamp posts round the square (angles chosen clear of the paths coming in). */
export const LAMP_POSTS = [0.25, 1.95, 3.85, 5.55].map((a) => ({ x: SQ.x + Math.cos(a) * (SQ.r + 0.45), z: SQ.z + Math.sin(a) * (SQ.r + 0.45) }))
/** Trees round the edges of the village (fruit on some). */
export const VILLAGE_TREES = [
  { x: -16.5, z: 29.5, s: 1.1, c: '#7fbf6a', fruit: '#ff8f8f' },
  { x: -16.8, z: 19.5, s: 1.2, c: '#6fae5f' },
  { x: -4.5, z: 20.0, s: 0.95, c: '#8fc97a', fruit: '#ffd27f' },
  { x: 16.8, z: 33.5, s: 1.0, c: '#f4b6cc' },
  { x: 17.5, z: 44.5, s: 1.15, c: '#7fbf6a', fruit: '#ff8f8f' },
  { x: -1.5, z: 43.0, s: 0.9, c: '#f4b6cc' },
  { x: -18.5, z: 47.5, s: 1.2, c: '#6fae5f' },
  { x: 2.0, z: 51.5, s: 1.0, c: '#8fc97a' },
  { x: 11.5, z: 48.5, s: 1.05, c: '#f7c6e0' },
  { x: -15.5, z: 39.5, s: 0.9, c: '#7fbf6a', fruit: '#ffd27f' },
]
/** The twin lanterns: a stone each, to stand on together. */
export const LANTERN_STONES = [
  { id: 'a', x: SQ.x - 2.25, z: SQ.z + 0.9 },
  { id: 'b', x: SQ.x + 2.25, z: SQ.z + 0.9 },
]
export const SQUARE_BENCHES = [
  { id: 'village:bench1', x: SQ.x + 1.9, z: SQ.z - 2.25, yaw: Math.atan2(-1.9, 2.25) },
  { id: 'village:bench2', x: SQ.x - 0.35, z: SQ.z + 2.85, yaw: Math.PI + 0.12 },
]
/** The gardens: three flower beds (Gilo's), the vegetable patch, the berry bushes. */
export const FLOWER_BEDS = [
  { id: 'bed1', x: 4.0, z: 38.8, r: 0.62, color: '#ff8fbf' },
  { id: 'bed2', x: 6.5, z: 40.7, r: 0.62, color: '#ffd27f' },
  { id: 'bed3', x: 9.0, z: 40.25, r: 0.62, color: '#b9a5e8' },
]
export const VEG_PATCH = { x0: 9.8, x1: 12.6, z0: 41.4, z1: 43.2 }
export const BERRIES = { x: 8.0, z: 43.2 }
export const COOP = { x: -14.3, z: 36.6 }
export const WHEAT = { x: -15.8, z: 25.6 }
/** Tetua Lumut's spectacles, lost by the lily pond (under the big toadstool). */
export const GLASSES_SPOT = { x: 8.3, z: 46.1 }
/** The signpost on the café path, pointing the way. */
export const SIGNPOST = { x: 8.75, z: 24.3 }
/** Seats for the gnomes who sit down (a stump each). */
const xz = ([x, z]) => ({ x, z })
export const STUMPS = [
  { id: 'lumut', x: SQ.x + 3.48, z: SQ.z - 0.35 },
  { id: 'pim', ...xz(at('pim', 1.15, B.pim.hd + 0.45)) },
  { id: 'gilo', ...xz(at('gilo', -1.05, B.gilo.hd + 0.45)) },
]

for (const c of [
  { ...FOUNTAIN },
  { x: NOTICE_BOARD.x, z: NOTICE_BOARD.z, r: 0.42 },
  ...LAMP_POSTS.map((p) => ({ x: p.x, z: p.z, r: 0.12 })),
  ...VILLAGE_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.3 * t.s })),
  ...LANTERN_STONES.map((s) => ({ x: s.x + 0.5, z: s.z - 0.1, r: 0.14 })),
  ...SQUARE_BENCHES.map((s) => ({ x: s.x, z: s.z, r: 0.42 })),
  ...FLOWER_BEDS.map((b) => ({ x: b.x, z: b.z, r: b.r })),
  { x: BERRIES.x, z: BERRIES.z, r: 0.55 },
  { x: COOP.x, z: COOP.z, r: 0.6 },
  { x: WHEAT.x, z: WHEAT.z, r: 0.9 },
  { x: GLASSES_SPOT.x + 0.15, z: GLASSES_SPOT.z - 0.3, r: 0.32 },
  { x: SIGNPOST.x, z: SIGNPOST.z, r: 0.12 },
  ...STUMPS.map((s) => ({ x: s.x, z: s.z, r: 0.2 })),
])
  addCollider(c.x, c.z, c.r)
// the vegetable patch
blockers.push((x, z) => x > VEG_PATCH.x0 && x < VEG_PATCH.x1 && z > VEG_PATCH.z0 && z < VEG_PATCH.z1 && !(player.position.x > VEG_PATCH.x0 && player.position.x < VEG_PATCH.x1 && player.position.z > VEG_PATCH.z0 && player.position.z < VEG_PATCH.z1))
/** The hidden grove: a ring of hedges, with one gap (to find). */
export const GROVE_HEDGES = (() => {
  const out = []
  const n = 22
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    let gap = Math.abs(((a - HIDDEN_GROVE.gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
    if (gap < 0.32) continue
    out.push({ x: HIDDEN_GROVE.x + Math.cos(a) * HIDDEN_GROVE.r, z: HIDDEN_GROVE.z + Math.sin(a) * HIDDEN_GROVE.r, r: 0.55 + (i % 3) * 0.08, a })
  }
  return out
})()
for (const h of GROVE_HEDGES) addCollider(h.x, h.z, h.r * 0.85)
obstacles.version++

/* ───────── where the gnomes walk: a little network of village paths ───────── */

const NODES = {
  sqN: [SQ.x, SQ.z - 2.15],
  sqE: [SQ.x + 2.15, SQ.z],
  sqS: [SQ.x, SQ.z + 2.15],
  sqW: [SQ.x - 2.15, SQ.z],
  cafeLink: [9.6, 29.2],
  elderVia1: [-6.8, 23.2],
  elderVia2: [-1.6, 25.6],
  gardenGate: [5.6, 37.0],
  gardenMid: [7.4, 38.6],
  pimPath1: [-3.4, 40.2],
  pimPath2: [-5.2, 42.6],
  bridgeN: [-7.0, 43.6],
  bridgeS: [-8.0, 46.4],
}
for (const id of ['bakery', 'shop', 'elder', 'pip', 'pim', 'gilo']) NODES[id + ':out'] = villageDoor(B[id], 0.55)
for (const id of ['bakery', 'shop']) {
  NODES[id + ':in'] = at(id, 0, B[id].hd - 0.55)
}
NODES.giloSide = at('gilo', 2.5, 1.9)
NODES['bakery:gap'] = at('bakery', -1.45, -0.35)
NODES['bakery:back'] = at('bakery', -1.5, -1.45)
NODES['shop:gap'] = at('shop', -0.45, -0.3)
NODES['shop:back'] = at('shop', -0.45, -1.3)
const EDGES = [
  ['sqN', 'sqE'], ['sqE', 'sqS'], ['sqS', 'sqW'], ['sqW', 'sqN'],
  ['cafeLink', 'sqE'],
  ['bakery:out', 'sqW'], ['bakery:out', 'bakery:in'], ['bakery:in', 'bakery:gap'], ['bakery:gap', 'bakery:back'],
  ['shop:out', 'sqN'], ['shop:out', 'shop:in'], ['shop:in', 'shop:gap'], ['shop:gap', 'shop:back'],
  ['elder:out', 'elderVia1'], ['elderVia1', 'elderVia2'], ['elderVia2', 'sqN'],
  ['pip:out', 'sqW'], ['pim:out', 'sqW'],
  ['pim:out', 'pimPath1'], ['pimPath1', 'pimPath2'], ['pimPath2', 'bridgeN'], ['bridgeN', 'bridgeS'],
  ['gilo:out', 'gardenMid'], ['gilo:out', 'giloSide'], ['gardenMid', 'gardenGate'], ['gardenGate', 'sqS'],
]
const LINKS = {}
for (const [a, b] of EDGES) {
  ;(LINKS[a] ||= []).push(b)
  ;(LINKS[b] ||= []).push(a)
}
const routeCache = new Map()
/** The nodes from one to another (Dijkstra on the little network), including both ends. */
function nodeRoute(a, b) {
  const key = a + '>' + b
  if (routeCache.has(key)) return routeCache.get(key)
  const dist = { [a]: 0 }
  const prev = {}
  const open = new Set([a])
  while (open.size) {
    let u = null
    for (const n of open) if (u === null || dist[n] < dist[u]) u = n
    open.delete(u)
    if (u === b) break
    for (const v of LINKS[u] || []) {
      const d = dist[u] + Math.hypot(NODES[u][0] - NODES[v][0], NODES[u][1] - NODES[v][1])
      if (d < (dist[v] ?? Infinity)) {
        dist[v] = d
        prev[v] = u
        open.add(v)
      }
    }
  }
  const out = [b]
  while (out[0] !== a && prev[out[0]]) out.unshift(prev[out[0]])
  if (out[0] !== a) out.unshift(a)
  routeCache.set(key, out)
  return out
}

/* ───────── the gnomes, and their days ───────── */

/**
 * Each gnome: a name, a job, a look, and a day: for each part of it (pagi, siang, sore, malam), the
 * places they go in turn — { at: [x, z], node (where it joins the paths), act (what they do there),
 * face: [x, z] (what they look at), tool? }.
 */
const st = (atXZ, node, act, face, tool) => ({ at: atXZ, node, act, face, tool })
/** Where Gilo stands to water a bed: on its garden-gate side. */
const bedSpot = (b) => {
  const [gx, gz] = [5.6, 37.0]
  const l = Math.hypot(gx - b.x, gz - b.z)
  return [b.x + ((gx - b.x) / l) * 0.85, b.z + ((gz - b.z) / l) * 0.85]
}
const SHOP_FRONT = at('shop', 0.7, 2.6)
export const NPCS = {
  lumut: {
    name: 'Tetua Lumut',
    role: 'Tetua desa',
    look: { skin: '#ffd9c4', nose: '#ffae9c', shirt: '#9b8ad6', apron: '#e9e1ff', apronDark: '#7a6aae', pants: '#6d5a6e', hat: '#7a5fc4', band: '#ffd27f', beard: '#fffaf6', longBeard: true, tallHat: true, hair: '#fffaf6', phase: 0.3 },
    scale: 1.12,
    day: {
      pagi: [
        st([NOTICE_BOARD.x + Math.sin(NOTICE_BOARD.yaw) * 0.8, NOTICE_BOARD.z + Math.cos(NOTICE_BOARD.yaw) * 0.8], 'sqN', 'read', [NOTICE_BOARD.x, NOTICE_BOARD.z]),
        st([SQ.x + 1.6, SQ.z - 1.3], 'sqE', 'idle', [SQ.x, SQ.z], 'staff'),
        st([5.1, 36.4], 'gardenGate', 'think', [6.5, 40.7]),
      ],
      siang: [
        st([STUMPS[0].x, STUMPS[0].z], 'sqS', 'sit', [SQ.x, SQ.z]),
        st([SQ.x - 1.4, SQ.z - 1.6], 'sqN', 'talk', [SQ.x, SQ.z]),
      ],
      sore: [
        st([-6.4, 43.0], 'bridgeN', 'think', [-7.5, 45.5]),
        st([STUMPS[0].x, STUMPS[0].z], 'sqS', 'sit', [SQ.x, SQ.z]),
      ],
      malam: [
        st([SQ.x - 1.2, SQ.z - 1.5], 'sqN', 'idle', [SQ.x, SQ.z], 'lantern'),
        st(NODES['elder:out'], 'elder:out', 'idle', [SQ.x, SQ.z], 'lantern'),
      ],
    },
  },
  gilo: {
    name: 'Gilo',
    role: 'Tukang kebun',
    look: { skin: '#f6caa8', nose: '#f0a38d', shirt: '#79c27c', apron: '#c8915f', apronDark: '#8a5a3c', pants: '#6b7f5a', hat: '#ffb347', band: '#79c27c', beard: '#c8794e', hair: '#c8794e', flower: '#ff8fbf', phase: 1.7 },
    scale: 1,
    day: {
      pagi: FLOWER_BEDS.map((b) => st(bedSpot(b), 'gardenGate', 'water', [b.x, b.z])),
      siang: [
        st([VEG_PATCH.x0 + 0.8, VEG_PATCH.z0 - 0.35], 'giloSide', 'dig', [VEG_PATCH.x0 + 0.8, VEG_PATCH.z0 + 0.6]),
        st([VEG_PATCH.x1 - 0.8, VEG_PATCH.z0 - 0.35], 'giloSide', 'dig', [VEG_PATCH.x1 - 0.8, VEG_PATCH.z0 + 0.6]),
        st([3.6, 35.6], 'gardenGate', 'plant', [3.0, 36.0]),
      ],
      sore: [
        st(bedSpot(FLOWER_BEDS[1]), 'gardenGate', 'water', [FLOWER_BEDS[1].x, FLOWER_BEDS[1].z]),
        st([BERRIES.x - 0.4, BERRIES.z - 0.75], 'gardenMid', 'plant', [BERRIES.x, BERRIES.z]),
      ],
      malam: [st([STUMPS[2].x, STUMPS[2].z], 'gilo:out', 'sleep', [SQ.x, SQ.z])],
    },
  },
  remah: {
    name: 'Bu Remah',
    role: 'Pembuat roti',
    look: { skin: '#ffe0cc', nose: '#ffb8a6', shirt: '#f7a8c4', apron: '#fffaf2', apronDark: '#e8798f', pants: '#8a6a7e', hat: '#fff4e4', band: '#f7a8c4', beard: null, hair: '#a0643f', phase: 2.4 },
    scale: 1,
    inside: 'bakery',
    day: {
      pagi: [
        st(at('bakery', 0.05, -1.45), 'bakery:back', 'knead', at('bakery', 0.05, 0)),
        st(at('bakery', 1.0, -1.45), 'bakery:back', 'oven', at('bakery', 2.4, -1.45)),
      ],
      siang: [
        st(at('bakery', -0.4, -1.45), 'bakery:back', 'serve', at('bakery', -0.4, 2)),
        st(at('bakery', -1.45, 0.45), 'bakery:gap', 'arrange', at('bakery', -2.6, 0.45), 'bread'),
        st(at('bakery', 1.0, -1.45), 'bakery:back', 'oven', at('bakery', 2.4, -1.45)),
      ],
      sore: [
        st(at('bakery', -0.4, -1.45), 'bakery:back', 'serve', at('bakery', -0.4, 2)),
        st(at('bakery', 0.05, -1.45), 'bakery:back', 'knead', at('bakery', 0.05, 0)),
      ],
      malam: [st(at('bakery', -0.2, -1.45), 'bakery:back', 'wipe', at('bakery', -0.2, 2))],
    },
  },
  kenop: {
    name: 'Tuan Kenop',
    role: 'Pedagang dekorasi',
    look: { skin: '#f3c7a6', nose: '#e8a08a', shirt: '#5fb3a8', apron: '#ffe9a8', apronDark: '#c47a52', pants: '#5d5363', hat: '#3f8f86', band: '#ffd27f', beard: '#d9cbb8', hair: '#d9cbb8', glasses: true, phase: 3.1 },
    scale: 1.04,
    inside: 'shop',
    day: {
      pagi: [
        st(at('shop', -1.2, -1.3), 'shop:back', 'arrange', at('shop', -1.2, -2.5)),
        st(at('shop', 0.7, -1.4), 'shop:back', 'idle', at('shop', 0.7, 2)),
      ],
      siang: [st(at('shop', 0.7, -1.4), 'shop:back', 'talk', at('shop', 0.7, 2)), st(at('shop', 0.2, -1.4), 'shop:back', 'wipe', at('shop', 0.2, 2))],
      sore: [
        st(at('shop', 0.7, -1.4), 'shop:back', 'idle', at('shop', 0.7, 2)),
        st(at('shop', -1.6, 0.05), 'shop:gap', 'arrange', at('shop', -2.6, 0.05)),
      ],
      malam: [st(SHOP_FRONT, 'shop:out', 'idle', [SQ.x, SQ.z], 'lantern')],
    },
  },
  pim: {
    name: 'Nenek Pim',
    role: 'Warga desa',
    look: { skin: '#ffe6d6', nose: '#ffbcaa', shirt: '#f2d6a8', apron: '#ffe0ec', apronDark: '#b9a5e8', pants: '#8a7a9e', hat: '#c9b6f4', band: '#ffffff', beard: null, hair: '#f4f0f6', glasses: true, phase: 4.2 },
    scale: 0.95,
    day: {
      pagi: [st(at('pim', 0.75, B.pim.hd + 0.6), 'pim:out', 'water', at('pim', 0.75, B.pim.hd))],
      siang: [st([STUMPS[1].x, STUMPS[1].z], 'pim:out', 'sit', [SQ.x, SQ.z])],
      sore: [st([STUMPS[1].x, STUMPS[1].z], 'pim:out', 'read', [SQ.x, SQ.z])],
      malam: [st([STUMPS[1].x, STUMPS[1].z], 'pim:out', 'sleep', [SQ.x, SQ.z])],
    },
  },
}
export const NPC_IDS = Object.keys(NPCS)

const SLOT = 26000 // ms at each place before moving on
const SPEED = 0.85 // m/s
const offsetOf = (id) => NPC_IDS.indexOf(id) * 4100
function stationAt(npc, id, ms) {
  const slot = Math.floor((ms + offsetOf(id)) / SLOT)
  const start = slot * SLOT - offsetOf(id)
  const part = partOfDay(hourAt(start))
  const list = npc.day[part]
  return { s: list[(slot * 7 + 3) % list.length], slot, start, part }
}
/** The way from one place to the next: [[x, z], …]. */
function routeBetween(a, b) {
  if (a === b) return [b.at]
  const far = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) > 2.5
  const nodes = a.node === b.node ? (far ? [NODES[a.node]] : []) : nodeRoute(a.node, b.node).map((n) => NODES[n])
  return [a.at, ...nodes, b.at]
}
const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)
/**
 * Where a gnome is and what it's doing at a moment on the shared clock (the same on both screens):
 * { x, z, yaw, mode, tool, part }
 */
export function gnomeAt(id, ms = serverNow()) {
  const npc = NPCS[id]
  const cur = stationAt(npc, id, ms)
  const prev = stationAt(npc, id, cur.start - 1).s
  const pts = routeBetween(prev, cur.s)
  const len = lengthOf(pts)
  const speed = Math.max(SPEED, len / ((SLOT / 1000) * 0.7))
  let d = ((ms - cur.start) / 1000) * speed
  if (d < len) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]
      const [bx, bz] = pts[i]
      const l = Math.hypot(bx - ax, bz - az)
      if (d <= l || i === pts.length - 1) {
        const k = l ? Math.min(1, d / l) : 1
        return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, yaw: Math.atan2(bx - ax, bz - az), mode: id === 'lumut' ? 'stroll' : 'walk', tool: cur.s.tool, part: cur.part, walking: true }
      }
      d -= l
    }
  }
  const [x, z] = cur.s.at
  const [fx, fz] = cur.s.face
  return { x, z, yaw: Math.atan2(fx - x, fz - z), mode: cur.s.act, tool: cur.s.tool, part: cur.part, walking: false }
}
/** Where each gnome is drawn right now (written by Village.jsx; used for talking to them). */
export const gnomeShown = Object.fromEntries(NPC_IDS.map((id) => [id, { x: 0, z: 0, y: 0, ok: false }]))

/* ───────── little jobs ───────── */

/**
 * giver: who asks; steps: how many things to do; turnIn: go back to the giver when done (else it's
 * finished on the spot); reward: { keepsake (a decoration for the house), coins }.
 */
export const QUESTS = {
  siram: {
    title: 'Bunga yang Kehausan',
    giver: 'gilo',
    steps: 3,
    turnIn: true,
    goal: 'Siram 3 bedeng bunga di kebun Gilo',
    reward: { keepsake: 'moon_flower', coins: 10 },
  },
  bahan: {
    title: 'Bahan Roti Bu Remah',
    giver: 'remah',
    steps: 3,
    turnIn: true,
    goal: 'Cari telur (kandang ayam), gandum (ladang dekat rumah Tetua), dan stroberi (semak di timur kebun)',
    reward: { keepsake: 'bread_basket', coins: 10 },
  },
  antar: {
    title: 'Kopi untuk Nenek Pim',
    giver: 'pip',
    steps: 1,
    turnIn: false,
    goal: 'Pesan minuman di kafe, lalu antar ke pintu rumah Nenek Pim (dekat sungai kecil)',
    reward: { keepsake: 'mushroom_lamp', coins: 10 },
  },
  kacamata: {
    title: 'Kacamata Tetua',
    giver: 'lumut',
    steps: 1,
    turnIn: true,
    goal: 'Temukan kacamata Tetua Lumut. Terakhir dia memakainya waktu melihat bunga teratai…',
    reward: { keepsake: 'gnome_statue', coins: 15 },
  },
  rahasia: {
    title: 'Kebun Rahasia',
    giver: 'lumut',
    steps: 1,
    turnIn: false,
    after: 'kacamata',
    goal: 'Konon ada kebun tersembunyi di seberang sungai kecil, di balik pagar semak…',
    reward: { keepsake: 'crystal_shroom', coins: 15 },
  },
  lentera: {
    title: 'Lentera Berdua',
    giver: 'lumut',
    steps: 1,
    turnIn: false,
    coop: true,
    goal: 'Berdiri di dua batu lentera di alun-alun bersama pasanganmu, bersamaan',
    reward: { keepsake: 'twin_lantern', coins: 10 },
  },
}
export const QUEST_IDS = Object.keys(QUESTS)
/** The honour the elder gives after three jobs: a gnome hat of your own. */
export const HAT_AFTER = 3
const INGREDIENTS = { telur: 'Telur', gandum: 'Gandum', stroberi: 'Stroberi' }
export const INGREDIENT_SPOTS = {
  telur: { x: COOP.x + 0.9, z: COOP.z + 0.4 },
  gandum: { x: WHEAT.x + 1.15, z: WHEAT.z + 0.55 },
  stroberi: { x: BERRIES.x - 0.75, z: BERRIES.z + 0.35 },
}

/* ───────── what's kept: on this device (jobs in progress) and on the server (jobs finished) ───────── */

const KEY = 'our-little-universe:village'
const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY)) || {}
    return { quests: v.quests || {}, met: Boolean(v.met), hat: Boolean(v.hat), hatOn: v.hatOn !== false }
  } catch {
    return { quests: {}, met: false, hat: false, hatOn: true }
  }
}
/**
 * quests: { id: { state: 'active' | 'ready' | 'done', n, got: [] } } (not there: not started)
 * talk: the conversation on screen: { npc, text, options: [{ label, kind }] }
 * inside: the building she's in (for the roof); near: she's in the village
 */
export const useVillage = create(() => ({ ...load(), talk: null, inside: null, near: false, lanterns: { a: false, b: false }, serverOk: null }))
const get = () => useVillage.getState()
const set = (patch) => {
  useVillage.setState(patch)
  const { quests, met, hat, hatOn } = get()
  try {
    localStorage.setItem(KEY, JSON.stringify({ quests, met, hat, hatOn }))
  } catch {
    // a private window: progress lasts as long as the tab
  }
  shareHat()
}
const toast = (text, ms = 3400) => useStore.getState().showToast(text, ms)
const questState = (id) => get().quests[id]?.state || null
export const doneCount = () => QUEST_IDS.filter((id) => questState(id) === 'done').length

/** The gnome hat travels with her character (so the other person sees it too). */
function shareHat() {
  const { hat, hatOn } = get()
  presence.hat = hat && hatOn ? { id: 'gnome-hat', kind: 'gnome', at: 0 } : null
}
shareHat()

/** Finished jobs from the server (once per person; they last across devices). */
async function syncDone() {
  const me = useCouple.getState().me
  if (!supabase || !me) return
  const { data, error } = await supabase.from('village_quests').select('quest').eq('user_id', me.id)
  if (error) return useVillage.setState({ serverOk: false })
  const quests = { ...get().quests }
  let hat = get().hat
  for (const { quest } of data) {
    if (quest === 'topi') hat = true
    else if (QUESTS[quest]) quests[quest] = { state: 'done', n: QUESTS[quest].steps, got: [] }
  }
  useVillage.setState({ serverOk: true })
  set({ quests, hat })
}
onRoom({ subscribed: syncDone })

/** Tell the server (once per person). Returns the coins it added. */
async function saveDone(quest) {
  if (!supabase || useCouple.getState().status !== 'connected') return 0
  const { data, error } = await supabase.rpc('village_complete', { quest })
  if (error) {
    useVillage.setState({ serverOk: false })
    return 0
  }
  useVillage.setState({ serverOk: true })
  if (data > 0) refreshHouse()
  return data | 0
}

/** Is this job one she can be offered now? */
export function canOffer(id) {
  const q = QUESTS[id]
  if (questState(id)) return false
  if (q.after && questState(q.after) !== 'done') return false
  if (id === 'kacamata' && !get().met) return false
  return true
}
export function startQuest(id) {
  if (!canOffer(id)) return
  set({ quests: { ...get().quests, [id]: { state: 'active', n: 0, got: [] } } })
  toast(`📜 Tugas baru: ${QUESTS[id].title}`, 3000)
}
/** One step of a job done (`what` names it, so the same thing never counts twice). */
export function questStep(id, what) {
  const q = get().quests[id]
  if (!q || q.state !== 'active' || q.got.includes(what)) return false
  const n = q.n + 1
  const def = QUESTS[id]
  const ready = n >= def.steps
  set({ quests: { ...get().quests, [id]: { ...q, n, got: [...q.got, what], state: ready ? (def.turnIn ? 'ready' : 'active') : 'active' } } })
  if (ready && def.turnIn) toast(`✓ ${def.title}: kembali ke ${NPCS[def.giver].name}`, 3200)
  else if (!ready) toast(`${def.title}: ${n}/${def.steps}`, 2200)
  if (ready && !def.turnIn) finishQuest(id)
  return true
}
/** A job finished: rewards, said and saved. */
export async function finishQuest(id) {
  const def = QUESTS[id]
  const cur = get().quests[id]
  if (cur?.state === 'done') return
  set({ quests: { ...get().quests, [id]: { state: 'done', n: def.steps, got: cur?.got || [] } } })
  addMood('bahagia')
  window.dispatchEvent(new CustomEvent('village:done', { detail: id }))
  const coins = await saveDone(id)
  // saved: the decoration is unlocked for the house (the realtime event says so too, a moment later)
  if (get().serverOk) useDate.setState((d) => ({ keepsakes: { ...d.keepsakes, [def.reward.keepsake]: true } }))
  const reward = DECOR_NAMES[def.reward.keepsake]
  toast(`🎉 ${def.title} selesai! Hadiah: ${reward}${coins ? ` · +${coins} koin` : ''}`, 4200)
}

/* ───────── talking ───────── */

/** What each gnome likes to say, by the part of the day (never the same line twice in a row). */
const CHATTER = {
  lumut: {
    pagi: ['Selamat pagi! Embun di desa kami paling segar jam segini.', 'Lihat papan pengumuman itu: selalu ada saja kabar baru tiap pagi.', 'Dulu desa ini cuma tiga rumah jamur. Sekarang, lihat betapa ramainya!'],
    siang: ['Siang-siang begini, enaknya duduk sambil mendengar air mancur.', 'Bram di kafe itu dulu muridku. Sekarang kopinya lebih enak dari buatanku, hmm.', 'Kalian berdua kelihatan serasi sekali, kalau Tetua boleh bilang ♡'],
    sore: ['Sore hari, sungai kecil itu berkilau keemasan. Indah, ya?', 'Kalau sore, Nenek Pim suka bercerita. Mampirlah ke rumahnya.', 'Angin sore membawa wangi roti dari toko Bu Remah…'],
    malam: ['Malam begini, kunang-kunang suka berkumpul di dekat sungai kecil.', 'Lentera-lentera desa menyala sampai pagi. Tidak perlu takut gelap.', 'Lihat bintang itu? Kata orang dulu, bintang yang paling terang itu milik dua orang yang saling sayang.'],
  },
  gilo: {
    pagi: ['Bunga-bunga ini tumbuh lebih cantik setelah disiram.', 'Pagi itu waktunya menyiram. Matahari belum terlalu galak!', 'Psst, bedeng kuning itu favoritku. Jangan bilang yang lain.'],
    siang: ['Wortelnya sebentar lagi siap dipanen!', 'Tanah di desa ini gembur sekali. Tanam apa saja pasti tumbuh.', 'Kalau mau bunga di rumah kalian, Tuan Kenop menjual pot yang lucu-lucu.'],
    sore: ['Sore-sore aku menanam bibit baru. Besok pagi sudah bertunas!', 'Stroberi di semak sana manis sekali tahun ini.', 'Kebun ini tiap hari sedikit berubah. Coba perhatikan.'],
    malam: ['Hoaam… tukang kebun juga perlu tidur…', 'Zzz… bunga bulan… mekar… zzz…', 'Hm? Oh, maaf, aku ketiduran. Selamat malam, ya.'],
  },
  remah: {
    pagi: ['Roti hangat baru saja keluar dari oven!', 'Adonan pagi ini mengembang sempurna. Pertanda hari yang baik!', 'Pagi! Mau mencium wangi roti kayu manis?'],
    siang: ['Roti jamur keju laku keras siang ini.', 'Pastry stroberi itu resep nenekku. Rahasianya sedikit madu.', 'Ambil satu roti, gratis untuk pengunjung yang manis ♡'],
    sore: ['Sore begini enaknya teh dan roti mentega.', 'Sisa roti hari ini biasanya kubagikan ke tetangga.', 'Kalau kalian ke kafe, bilang ke Bram: croissant-nya dari aku!'],
    malam: ['Tokonya sudah mau tutup, tapi untukmu masih ada satu roti.', 'Besok pagi aku bangun sebelum ayam berkokok.', 'Hari yang panjang… tapi menyenangkan.'],
  },
  kenop: {
    pagi: ['Ada beberapa dekorasi baru untuk rumahmu hari ini.', 'Pagi! Barang-barang baru masih kubersihkan satu-satu.', 'Lentera kurcaci ini kubuat sendiri, lho. Lihat ukirannya.'],
    siang: ['Mau lihat-lihat? Semua barang di sini dibuat warga desa.', 'Lampu jamur itu cocok sekali di kamar tidur.', 'Harga teman, untuk kalian berdua.'],
    sore: ['Sore hari, dekorasi yang bercahaya kelihatan paling cantik.', 'Ada yang menitipkan patung kurcaci kecil. Lucu, kan?', 'Rumah yang nyaman itu yang diisi barang-barang penuh cerita.'],
    malam: ['Tokonya masih buka sebentar. Lenteraku menemaniku jaga.', 'Malam yang tenang. Cocok untuk memilih hiasan baru.', 'Kalau kalian butuh sesuatu, ketuk saja pintunya.'],
  },
  pim: {
    pagi: ['Oh, tamu! Selamat pagi, Nak.', 'Nenek sedang menyiram bunga di jendela. Cantik, ya?', 'Pagi-pagi begini Nenek suka mendengar burung bernyanyi.'],
    siang: ['Duduk sini, Nenek ceritakan soal kunang-kunang di sungai kecil.', 'Dulu Tetua Lumut itu pemalu sekali, lho. Hihi.', 'Kalian ini pasangan yang manis sekali.'],
    sore: ['Buku ini sudah Nenek baca lima kali. Masih saja bikin menangis.', 'Sore yang hangat. Seperti secangkir kopi dari kafe.', 'Kalau lewat jembatan kecil itu, lihat ke bawah. Kadang ada ikan kecil.'],
    malam: ['Zzz… oh! Nenek ketiduran di luar lagi…', 'Selamat malam, Nak. Hati-hati di jalan.', 'Bintangnya banyak sekali malam ini…'],
  },
}
const QUEST_LINES = {
  siram: {
    offer: ['Aduh, tiga bedeng bungaku kelihatan layu. Bisa bantu menyiramnya?', 'Bunga-bunga ini tumbuh lebih cantik setelah disiram… tapi tanganku cuma dua. Mau bantu?'],
    active: 'Bedeng yang layu itu ada di kebun dekat sini. Tahan tombol interaksi untuk menyiram, ya.',
    ready: 'Wah, lihat! Bunganya segar lagi. Terima kasih banyak! Ini, bibit bunga bulan untuk kebun kalian.',
  },
  bahan: {
    offer: ['Aduh, bahan rotiku habis! Aku butuh telur, gandum, dan stroberi. Mau bantu mencarinya?'],
    active: 'Telur di kandang ayam dekat rumah Pip, gandum di ladang dekat rumah Tetua, stroberi di semak timur kebun.',
    ready: 'Lengkap semua! Sebentar… nah, ini keranjang roti hangat untuk rumah kalian ♡',
  },
  antar: {
    offer: ['Nenek Pim minta kopi, tapi kafe lagi ramai sekali. Bisa tolong pesan satu, lalu antar ke rumahnya?'],
    active: 'Pesan minuman apa saja di Bram, lalu bawa ke pintu rumah Nenek Pim di dekat sungai kecil.',
  },
  kacamata: {
    offer: ['Hmm… di mana ya kacamataku? Tanpa itu, papan pengumuman jadi kabur semua. Maukah kau mencarinya?'],
    active: 'Terakhir aku memakainya waktu melihat bunga teratai… di dekat kolam kecil, mungkin?',
    ready: 'Kacamataku! Akhirnya aku bisa membaca lagi. Ini, patung kurcaci kecil sebagai tanda terima kasih.',
  },
  rahasia: {
    offer: ['Karena kau sudah menolongku, akan kuberi tahu satu rahasia: di seberang sungai kecil ada kebun tersembunyi. Coba temukan pintu masuknya.'],
    active: 'Kebun itu dikelilingi pagar semak. Pintu masuknya tidak menghadap jembatan…',
  },
  lentera: {
    offer: ['Di alun-alun ada dua batu lentera. Konon lenteranya hanya menyala kalau dua orang yang saling sayang berdiri di atasnya bersamaan.'],
    active: 'Berdirilah di batu lentera bersama pasanganmu. Satu orang satu batu, ya.',
  },
}
const lastLine = {}
function pick(npc, list) {
  let i = Math.floor(Math.random() * list.length)
  if (list.length > 1 && i === lastLine[npc]) i = (i + 1) % list.length
  lastLine[npc] = i
  return list[i]
}

/** Open a conversation with a gnome (what they say depends on the jobs and the time of day). */
export function talkTo(npc) {
  const part = partOfDay(hourAt(serverNow()))
  const options = []
  let text = null
  // the elder's welcome, the first time
  if (npc === 'lumut' && !get().met) {
    set({ met: true })
    text = 'Selamat datang di desa kecil kami! Sudah lama tidak ada pengunjung baru. Aku Tetua Lumut. Kalau butuh apa-apa, cari saja aku di sekitar alun-alun.'
    return useVillage.setState({ talk: { npc, text, options: [{ label: 'Senang bertemu, Tetua!', kind: 'close' }] } })
  }
  const mine = QUEST_IDS.filter((id) => QUESTS[id].giver === npc)
  const ready = mine.find((id) => questState(id) === 'ready')
  const active = mine.find((id) => questState(id) === 'active')
  const offer = mine.find((id) => canOffer(id))
  if (ready) {
    text = QUEST_LINES[ready].ready
    options.push({ label: 'Serahkan ✓', kind: 'turnIn', quest: ready })
  } else if (npc === 'lumut' && doneCount() >= HAT_AFTER && !get().hat) {
    text = 'Kau sudah banyak membantu desa ini. Mulai hari ini, kau warga kehormatan! Terimalah topi kurcaci ini.'
    options.push({ label: 'Terima topi 🎩', kind: 'hat' })
  } else if (offer && (!active || Math.random() < 0.5)) {
    const coopNeedsMate = QUESTS[offer].coop && !(coupleAvailable && partner.online)
    text = pick(npc + offer, QUEST_LINES[offer].offer)
    if (coopNeedsMate) {
      text += ' Ajak pasanganmu ke desa dulu, ya.'
      options.push({ label: 'Nanti, ya', kind: 'close' })
    } else {
      options.push({ label: 'Mau, aku bantu!', kind: 'accept', quest: offer })
      options.push({ label: 'Nanti dulu', kind: 'close' })
    }
  } else if (active) {
    const q = get().quests[active]
    text = QUEST_LINES[active].active + (QUESTS[active].steps > 1 ? ` (${q.n}/${QUESTS[active].steps})` : '')
    options.push({ label: 'Siap!', kind: 'close' })
  } else {
    text = pick(npc, CHATTER[npc]?.[part] || ['Selamat menikmati harimu ♡'])
  }
  if (npc === 'kenop') options.unshift({ label: 'Lihat dagangan 🛍️', kind: 'shop' })
  if (npc === 'remah' && !ready) options.unshift({ label: 'Minta roti 🥐', kind: 'bread' })
  if (!options.some((o) => o.kind === 'close')) options.push({ label: 'Dah!', kind: 'close' })
  useVillage.setState({ talk: { npc, text, options } })
}
let breadAt = 0
/** A choice in the conversation. */
export function answer(option) {
  const talk = get().talk
  if (!talk) return
  switch (option.kind) {
    case 'accept':
      startQuest(option.quest)
      return useVillage.setState({ talk: { npc: talk.npc, text: QUEST_LINES[option.quest].active, options: [{ label: 'Siap!', kind: 'close' }] } })
    case 'turnIn':
      finishQuest(option.quest)
      break
    case 'hat':
      set({ hat: true, hatOn: true })
      saveDone('topi')
      toast('🎩 Topi kurcaci! Bisa dilepas-pasang di kartu Desa Kurcaci.', 4000)
      break
    case 'shop':
      useVillage.setState({ talk: null })
      return useStore.getState().setPanel('village-shop')
    case 'bread':
      if (performance.now() - breadAt < 60000) return useVillage.setState({ talk: { npc: talk.npc, text: 'Satu dulu, ya. Nanti kalau sudah habis, minta lagi ♡', options: [{ label: 'Hehe, oke', kind: 'close' }] } })
      breadAt = performance.now()
      addMood('kenyang')
      return useVillage.setState({ talk: { npc: talk.npc, text: 'Ini, roti kayu manis hangat. Selamat makan ♡', options: [{ label: 'Terima kasih!', kind: 'close' }] } })
    default:
  }
  useVillage.setState({ talk: null })
}
export const closeTalk = () => useVillage.setState({ talk: null })
/** Wear the gnome hat, or take it off (saved, and shown to the other person). */
export const wearHat = (on) => set({ hatOn: Boolean(on) })
/** Who's talking (for the card). */
export const speakerName = (id) => (id === 'pip' ? 'Pip' : NPCS[id]?.name || '')
export const speakerRole = (id) => (id === 'pip' ? 'Pelayan kafe' : NPCS[id]?.role || '')
/** Pip at the café asks too (lib/cafe's waiter): his line, if he has a job for her. */
export const pipHasJob = () => canOffer('antar') || questState('antar') === 'active'

/** Deliver the coffee to Nenek Pim's door. */
export function deliverCoffee() {
  const cup = useCafe.getState().cup
  if (questState('antar') !== 'active' || cup?.where !== 'hand') return false
  leaveCup()
  questStep('antar', 'kopi')
  useVillage.setState({ talk: { npc: 'pim', text: 'Wah, kopi hangat! Kamu baik sekali, Nak. Ini, lampu jamur kecil buatan Nenek untuk rumahmu.', options: [{ label: 'Sama-sama, Nek ♡', kind: 'close' }] } })
  return true
}
export const canDeliver = () => questState('antar') === 'active' && useCafe.getState().cup?.where === 'hand'

/** An ingredient for Bu Remah. */
export function pickIngredient(what) {
  if (questState('bahan') !== 'active') return false
  if (questStep('bahan', what)) toast(`🧺 ${INGREDIENTS[what]} didapat!`, 2000)
  return true
}
export const wantsIngredient = (what) => questState('bahan') === 'active' && !get().quests.bahan.got.includes(what)
export const wantsWater = (bed) => questState('siram') === 'active' && !get().quests.siram.got.includes(bed)
export const waterBed = (bed) => questStep('siram', bed)
export const wantsGlasses = () => questState('kacamata') === 'active' && get().quests.kacamata.n === 0
export const findGlasses = () => {
  if (questStep('kacamata', 'kacamata')) toast('👓 Ketemu! Kacamata Tetua Lumut.', 2600)
}
/** Has she found the elder's glasses (so he wears them again, on her screen)? */
export const elderHasGlasses = () => ['ready', 'done'].includes(questState('kacamata'))

/* ───────── every frame: where she is, the grove, the twin lanterns ───────── */

let lanternHold = 0
let lanternLit = false
const onStone = (x, z) => LANTERN_STONES.find((s) => Math.hypot(x - s.x, z - s.z) < 0.55)?.id || null
export function tickVillage(delta) {
  const p = player.position
  const near = Math.hypot(p.x - SQ.x, p.z - SQ.z) < 34
  const inside = near ? insideBuilding(p.x, p.z) : null
  const s = get()
  if (near !== s.near || inside !== s.inside) useVillage.setState({ near, inside })
  if (!near) return
  // the talk ends when she walks away
  if (s.talk) {
    const g = gnomeShown[s.talk.npc] || (s.talk.npc === 'pip' ? null : null)
    if (g?.ok && Math.hypot(p.x - g.x, p.z - g.z) > 3.6) closeTalk()
  }
  // the hidden grove: found!
  if (Math.hypot(p.x - HIDDEN_GROVE.x, p.z - HIDDEN_GROVE.z) < HIDDEN_GROVE.r - 0.9 && questState('rahasia') !== 'done') {
    if (!questState('rahasia')) set({ quests: { ...get().quests, rahasia: { state: 'active', n: 0, got: [] } } })
    toast('✨ Kamu menemukan Kebun Rahasia!', 3200)
    questStep('rahasia', 'kebun')
  }
  // the twin lanterns: someone on each stone (her, and the other person, from their character)
  const mine = onStone(p.x, p.z)
  const theirs = partner.online && partner.shown.ok ? onStone(partner.shown.x, partner.shown.z) : null
  const lit = { a: mine === 'a' || theirs === 'a', b: mine === 'b' || theirs === 'b' }
  if (lit.a !== s.lanterns.a || lit.b !== s.lanterns.b) useVillage.setState({ lanterns: lit })
  if (mine && theirs && mine !== theirs) {
    lanternHold += delta
    if (lanternHold > 1.5 && !lanternLit) {
      lanternLit = true
      if (questState('lentera') === 'active') questStep('lentera', 'nyala')
      else toast(questState('lentera') === 'done' ? 'Lentera kembar menyala lagi untuk kalian berdua ✨' : 'Lenteranya menyala untuk kalian berdua ✨ (Tetua Lumut punya cerita soal ini)', 3600)
    }
  } else {
    lanternHold = 0
    lanternLit = false
  }
}

/* ───────── the village's decorations for the house (lib/homeLayout.js has them in the catalog) ───────── */

export const DECOR_NAMES = {
  moon_flower: 'Bunga Bulan',
  bread_basket: 'Keranjang Roti',
  mushroom_lamp: 'Lampu Jamur',
  gnome_statue: 'Patung Kurcaci',
  crystal_shroom: 'Jamur Kristal',
  twin_lantern: 'Lentera Kembar',
}
/** Which job gives which decoration (for the shop's "how to get it"). */
export const DECOR_QUEST = Object.fromEntries(QUEST_IDS.map((id) => [QUESTS[id].reward.keepsake, id]))
/** For the shop's "ditaruh di rumah" message. */
export const houseReady = () => useHome.getState().status === 'ready'
export const villageMate = mateName
/** A point on the village ground. */
export const villageY = (x, z) => meadowHeight(x, z)
export { HIDDEN_GROVE, LILY_POND, VILLAGE_BRIDGE, SQ as VILLAGE_SQUARE }
