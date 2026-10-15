import * as THREE from 'three'
import { edgeRadius, HOME_ISLAND, homeDistance, SEA, SKY, skyDistance, worldHeight } from './terrain'

/*
 * DREAMCORE MEADOW — the land everything stands on.
 *
 * One continuous landscape under and around all the places: wide rolling meadows, a valley with a
 * small river, a lake in the west, a pond in the south-east, a knoll with a giant tree, and soft
 * hills rising all the way to the horizon. The places she walks on (the main meadow, Our Little
 * Home, Sky Island, the western isles and every bridge) rise out of it as grassy plateaus and a
 * high bluff, so nothing floats any more.
 *
 * This is scenery: where she can walk (and fall) is still decided by lib/terrain.js, unchanged.
 * The valley floor lies below every plateau, the river runs where the bridges cross, and the
 * lake's water is the western isles' own sea.
 */

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** The valley floor between the plateaus. */
export const FLOOR = -1.7

/**
 * The river: from the western lake's east shore, down a few little rapids, along the valley under
 * the bridge to Our Little Home, past the foot of the main meadow's waterfall, and out into a pond
 * in the south-east. [x, z, water level]
 */
export const RIVER = [
  [-19.8, -16.6, -0.62],
  [-14.5, -19.8, -1.55],
  [-8.0, -21.5, -1.92],
  [0.0, -21.0, -1.97],
  [7.0, -19.0, -2.0],
  [14.0, -13.6, -2.03],
  [19.0, -8.0, -2.06],
  [23.0, 2.0, -2.09],
  [27.0, 14.0, -2.12],
  [31.0, 25.0, -2.15],
]
export const RIVER_HALF_WIDTH = 1.05
/** Where the main meadow's waterfall lands: in the river, just past the foot of the slope. */
export const WATERFALL_FOOT = [14.0, -13.6]
/** Where the river ends: a round pond among flowers. */
export const POND = { x: 34, z: 31, r: 6.5, level: -2.15 }

/**
 * Chapter 2, "Miles Between Us": two hilltops facing each other across a deep ravine, far out in the
 * east meadow. Each little island of the chapter stands on top of one; its bridge is built across
 * the ravine. (`spread`: each hilltop's distance from the middle; `lift`: how high the islands'
 * grass sits above `y` — see lib/layout.js.)
 */
export const DISTANCE_SITE = { x: 72, y: 1.2, z: -34, spread: 9, lift: 0.75 }

/** A knoll in the north-east meadow, crowned by the giant tree. */
export const KNOLL = { x: 26, z: -30, h: 2.6, r: 8 }
export const GIANT_TREE = { x: KNOLL.x, z: KNOLL.z }

/**
 * Ways across the river: two little wooden footbridges and two lines of stepping stones, so the
 * whole meadow joins up. [x, z, half-length along the crossing, half-width, kind]
 * (each one runs straight across the river at that point).
 */
export const CROSSINGS = [
  { x: -11.2, z: -20.6, half: 2.4, width: 0.62, kind: 'bridge' },
  { x: 10.6, z: -16.4, half: 2.2, width: 0.5, kind: 'stones' },
  { x: 21.0, z: -3.0, half: 2.4, width: 0.62, kind: 'bridge' },
  { x: 29.0, z: 19.5, half: 2.2, width: 0.5, kind: 'stones' },
].map((c) => {
  // the river's direction there; the crossing runs across it
  let best = Infinity
  let dir = [1, 0]
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i]
    const [bx, bz] = RIVER[i + 1]
    const mx = (ax + bx) / 2
    const mz = (az + bz) / 2
    const d = Math.hypot(c.x - mx, c.z - mz)
    if (d < best) {
      best = d
      const l = Math.hypot(bx - ax, bz - az)
      dir = [(bx - ax) / l, (bz - az) / l]
    }
  }
  return { ...c, ux: -dir[1], uz: dir[0] }
})
/** The crossing at (x, z) and how far along it (-1..1), or null. */
export function crossingAt(x, z) {
  for (const c of CROSSINGS) {
    const dx = x - c.x
    const dz = z - c.z
    const along = dx * c.ux + dz * c.uz
    const side = -dx * c.uz + dz * c.ux
    if (Math.abs(along) <= c.half && Math.abs(side) <= c.width) return { c, t: along / c.half }
  }
  return null
}

/**
 * Footpaths through the meadow (soil worn into the grass, lanterns along them): from the main meadow
 * down to the pond, over the stepping stones to the giant tree, over the east footbridge toward
 * Chapter 2's hills, over the west footbridge up to the home garden, and from the garden to the tree.
 */
export const MEADOW_PATHS = [
  [[10.8, 12.4], [16, 17], [22, 21], [27.5, 27]],
  [[8.8, -14.2], [10.6, -16.4], [12.6, -18.8], [17, -23], [22.6, -27.4]],
  [[15.5, -2.5], [21, -3], [27, -4.5], [36, -9], [46, -16], [56, -26], [60.5, -30]],
  [[-9, -12], [-10.2, -16.5], [-11.2, -20.6], [-10.5, -25], [-8.5, -29]],
  [[9.2, -33], [15, -31.5], [21.6, -30.4]],
]
const segDistance = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
/** Distance to the nearest meadow footpath. */
export function meadowPathDistance(x, z) {
  let best = Infinity
  for (const p of MEADOW_PATHS) for (let i = 0; i < p.length - 1; i++) best = Math.min(best, segDistance(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]))
  return best
}

/** Distance to the river and its water level there. */
const riverOut = { d: Infinity, level: 0, t: 0 }
export function riverAt(x, z) {
  let best = Infinity
  let level = 0
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az, al] = RIVER[i]
    const [bx, bz, bl] = RIVER[i + 1]
    const vx = bx - ax
    const vz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)))
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t))
    if (d < best) {
      best = d
      level = al + (bl - al) * t
    }
  }
  riverOut.d = best
  riverOut.level = level
  return riverOut
}

/** The grassy shoulder that carries a place: its own height at the coast, sloping down to the floor. */
const shoulder = (edgeTop, u, width, steep = 0, inset = 0) => {
  if (u < 0) return edgeTop - inset - 6 * smooth(0, 1.5, -u) // tucked away under the place itself
  const drop = edgeTop - inset - FLOOR + 0.25
  const k = steep ? steep * smooth(0, 3, u) + (1 - steep) * smooth(1.5, width, u) : smooth(0, width, u)
  return edgeTop - inset - drop * k
}

/** The main meadow (the old main island): a broad plateau with long gentle slopes. */
function mainShoulder(x, z) {
  const theta = Math.atan2(z, x)
  const R = edgeRadius(x, z)
  const u = Math.hypot(x, z) - R
  if (u > 7.5) return -Infinity
  return shoulder(worldHeight(Math.cos(theta) * R, Math.sin(theta) * R), u, 7)
}
/** Our Little Home's garden plateau. */
function homeShoulder(x, z) {
  const u = (homeDistance(x, z) - 1) * HOME_ISLAND.r
  if (u > 6.5) return -Infinity
  return shoulder(HOME_ISLAND.level, u, 6)
}
/**
 * Cloud Hop leaves Sky Island to the south-east: on that side the island ends in a sheer stone cliff
 * (built by buildSkyCliffGeometry) straight down to the valley, so a fall from a cloud drops clear
 * past it into the catch below. Angles around Sky Island's centre.
 */
export const SKY_CLIFF = { from: 0.28, to: 1.58 }
const inCliff = (a) => a > SKY_CLIFF.from && a < SKY_CLIFF.to
/** Sky Island: a high bluff, rocky near the top, then long grassy slopes (and the cliff above). */
function skyShoulder(x, z) {
  const u = (skyDistance(x, z) - 1) * SKY.r
  if (u > 13) return -Infinity
  if (u > 0 && inCliff(Math.atan2(z - SKY.z, x - SKY.x))) return -Infinity
  return shoulder(SKY.level - 0.5, u, 12, 0.6, 0.35)
}

/** The western lake (the isles' sea): a basin with a low grassy rim. */
function lakeRim(x, z) {
  const d = Math.hypot(x - SEA.x, z - SEA.z)
  return -0.45 - (-0.45 - FLOOR + 0.2) * smooth(SEA.r * 1.04, SEA.r * 1.04 + 9, d)
}

/** How far from the middle of things she may wander (the hills at the horizon rise beyond it). */
export const MEADOW_LIMIT = 88
const LIMIT_CENTRE = { x: 8, z: -12 }

/** Is (x, z) water in the meadow (the river, the western lake or the pond)? Crossings aren't. */
export function meadowWater(x, z) {
  if (crossingAt(x, z)) return false
  if (riverAt(x, z).d < RIVER_HALF_WIDTH + 0.15) return true
  if (Math.hypot(x - SEA.x, z - SEA.z) < SEA.r * 1.01) return true
  return Math.hypot(x - POND.x, z - POND.z) < POND.r * 1.02
}
/** Is (x, z) beyond where she may wander? */
export const beyondMeadow = (x, z) => Math.hypot(x - LIMIT_CENTRE.x, z - LIMIT_CENTRE.z) > MEADOW_LIMIT

/** Where she stands in the meadow: the ground, or the deck of a crossing over the river. */
export function meadowStand(x, z) {
  const cross = crossingAt(x, z)
  if (cross) {
    const level = riverAt(cross.c.x, cross.c.z).level
    // a footbridge arches a little; stepping stones sit just above the water
    const deck = cross.c.kind === 'bridge' ? level + 0.42 + 0.22 * (1 - cross.t * cross.t) : level + 0.18
    return Math.max(deck, meadowHeight(x, z))
  }
  return meadowHeight(x, z)
}

/** Height of the meadow at (x, z). */
export function meadowHeight(x, z) {
  const river = riverAt(x, z)
  const riverD = river.d
  const riverLevel = river.level
  // the valley floor: rolling gently, calmer near the river
  const calm = smooth(RIVER_HALF_WIDTH + 1, RIVER_HALF_WIDTH + 9, riverD)
  let h = FLOOR + calm * (0.5 * Math.sin(x * 0.05 + 1) * Math.cos(z * 0.045 - 0.5) + 0.28 * Math.sin(x * 0.11 - z * 0.09 + 2) + 0.12 * Math.sin(x * 0.23 + z * 0.19))
  // the giant tree's knoll
  h += KNOLL.h * (1 - smooth(0, KNOLL.r, Math.hypot(x - KNOLL.x, z - KNOLL.z)))
  // hills all the way to the horizon
  const dc = Math.hypot(x - 8, z + 12)
  if (dc > 80) {
    const a = Math.atan2(z + 12, x - 8)
    h += smooth(85, 230, dc) * (11 + 6 * Math.sin(a * 3 + 0.7) + 4 * Math.sin(a * 7 - 1.2) + 2 * Math.sin(a * 13 + 2.0))
  }
  // the places rise out of it
  h = Math.max(h, mainShoulder(x, z), homeShoulder(x, z), skyShoulder(x, z), lakeRim(x, z))
  // Chapter 2's two hilltops and the ravine between them
  const sx = x - DISTANCE_SITE.x
  const sz = z - DISTANCE_SITE.z
  if (Math.abs(sx) < 24 && Math.abs(sz) < 16) {
    const top = DISTANCE_SITE.y + DISTANCE_SITE.lift - 0.12
    for (const side of [-1, 1]) h = Math.max(h, top - (top - FLOOR) * smooth(2.7, 7.5, Math.hypot(sx - side * DISTANCE_SITE.spread, sz)))
    const k = (1 - smooth(4.6, 6.4, Math.abs(sx))) * (1 - smooth(6, 11, Math.abs(sz)))
    if (k > 0) h += (DISTANCE_SITE.y - 5 - h) * k
  }
  // the western lake's bed
  const dl = Math.hypot(x - SEA.x, z - SEA.z) / SEA.r
  if (dl < 1) h = SEA.level - 0.25 - 1.1 * smooth(1, 0.7, dl)
  // the pond
  const dp = Math.hypot(x - POND.x, z - POND.z) / POND.r
  if (dp < 1.6) {
    const rim = POND.level + 0.18
    if (dp < 1) h = POND.level - 0.25 - 0.8 * smooth(1, 0.6, dp)
    else h = Math.min(h, rim + (h - rim) * smooth(1, 1.6, dp))
  }
  // the river's channel and its low banks
  if (riverD < RIVER_HALF_WIDTH) h = riverLevel - 0.35 - 0.3 * (1 - riverD / RIVER_HALF_WIDTH)
  else if (riverD < RIVER_HALF_WIDTH + 2.5) {
    const bank = riverLevel + 0.12
    h = Math.min(h, bank + (h - bank) * smooth(RIVER_HALF_WIDTH, RIVER_HALF_WIDTH + 2.5, riverD))
  }
  return h
}

/* ───────── colour ───────── */

const COL = {
  grass: new THREE.Color('#78c072'),
  sunny: new THREE.Color('#b2df8c'),
  deep: new THREE.Color('#4f9a6a'),
  lilac: new THREE.Color('#b3b4e6'),
  sand: new THREE.Color('#ecd9bf'),
  soil: new THREE.Color('#dcc29f'),
  rock: new THREE.Color('#b9aecb'),
  far: new THREE.Color('#9fb3d6'),
}

/** Colour of the meadow at a point (written into vertex colours). */
export function meadowColor(out, x, z, h, steep) {
  const n = 0.5 + 0.5 * Math.sin(x * 0.21 + 0.4) * Math.cos(z * 0.17 - 0.2)
  const m = 0.5 + 0.5 * Math.sin(x * 0.07 - z * 0.06 + 1.3)
  out.copy(COL.grass).lerp(COL.sunny, n * 0.55).lerp(COL.deep, (1 - m) * 0.3)
  // soft drifts of lilac through the green
  out.lerp(COL.lilac, smooth(0.72, 0.95, m) * 0.35)
  // valleys a little deeper, slopes in the sun a little brighter
  out.lerp(COL.deep, smooth(-1.4, -2.2, h) * 0.25)
  // pale sand along the river, the pond and the lake
  const river = riverAt(x, z)
  out.lerp(COL.sand, (1 - smooth(RIVER_HALF_WIDTH * 0.8, RIVER_HALF_WIDTH + 1.4, river.d)) * 0.85)
  const dl = Math.hypot(x - SEA.x, z - SEA.z) / SEA.r
  out.lerp(COL.sand, (1 - smooth(1.0, 1.1, dl)) * 0.8)
  const dp = Math.hypot(x - POND.x, z - POND.z) / POND.r
  out.lerp(COL.sand, (1 - smooth(1.0, 1.22, dp)) * 0.8)
  // the footpaths, worn soft into the grass
  out.lerp(COL.soil, (1 - smooth(0.4, 0.95, meadowPathDistance(x, z))) * 0.8)
  // bare lavender stone on the steepest faces (Sky Island's bluff)
  out.lerp(COL.rock, smooth(0.9, 1.5, steep))
  // far hills take on the blue of distance
  out.lerp(COL.far, smooth(110, 260, Math.hypot(x - 8, z + 12)) * 0.55)
  return out
}

/** The meadow mesh is a polar grid around this point (between the main meadow and Sky Island). */
const GRID = { x: 32, z: -8 }

/** The whole meadow as one mesh: a polar grid, fine near the places and coarse toward the horizon. */
export function buildMeadowGeometry({ segments = 400, step = 0.7, growth = 0.014, radius = 330 } = {}) {
  const radii = [0]
  while (radii[radii.length - 1] < radius) radii.push(radii[radii.length - 1] + step + radii[radii.length - 1] * growth)
  const stride = segments + 1
  const count = radii.length * stride
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const indices = []
  const color = new THREE.Color()
  // heights first (one evaluation per vertex) …
  radii.forEach((r, row) => {
    for (let s = 0; s <= segments; s++) {
      const a = (s / segments) * Math.PI * 2
      const x = GRID.x + Math.cos(a) * r
      const z = GRID.z + Math.sin(a) * r
      positions.set([x, meadowHeight(x, z), z], (row * stride + s) * 3)
    }
  })
  // … then colour, with the steepness read off the neighbouring grid points
  const hAt = (row, s) => positions[(row * stride + s) * 3 + 1]
  radii.forEach((r, row) => {
    const up = Math.min(radii.length - 1, row + 1)
    const down = Math.max(0, row - 1)
    const dr = radii[up] - radii[down] || 1
    const ds = Math.max(1e-3, ((Math.PI * 2) / segments) * r * 2)
    for (let s = 0; s <= segments; s++) {
      const i = (row * stride + s) * 3
      const sl = (s - 1 + segments) % segments
      const sr = (s + 1) % segments
      const steep = Math.hypot((hAt(up, s) - hAt(down, s)) / dr, r > 0 ? (hAt(row, sr) - hAt(row, sl)) / ds : 0)
      meadowColor(color, positions[i], positions[i + 2], positions[i + 1], steep)
      colors.set([color.r, color.g, color.b], i)
    }
  })
  for (let row = 0; row < radii.length - 1; row++)
    for (let s = 0; s < segments; s++) {
      const a = row * stride + s
      const b = a + stride
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** The river's water: a ribbon along its course, following its level. */
export function buildRiverGeometry() {
  const curve = new THREE.CatmullRomCurve3(RIVER.map(([x, z, l]) => new THREE.Vector3(x, l, z)))
  const n = 160
  const pts = curve.getSpacedPoints(n)
  const positions = []
  const uvs = []
  const indices = []
  const len = curve.getLength()
  pts.forEach((p, i) => {
    const q = pts[Math.min(n, i + 1)]
    const o = pts[Math.max(0, i - 1)]
    const dx = q.x - o.x
    const dz = q.z - o.z
    const l = Math.hypot(dx, dz) || 1
    const sx = -dz / l
    const sz = dx / l
    // a touch wider than the channel, so the water meets the banks
    const w = RIVER_HALF_WIDTH + 0.35
    const y = riverAt(p.x, p.z).level
    positions.push(p.x - sx * w, y, p.z - sz * w, p.x + sx * w, y, p.z + sz * w)
    const v = (i / n) * len
    uvs.push(0, v, 1, v)
    if (i < n) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** The sheer stone cliff on Sky Island's Cloud Hop side: from just under its grass down into the valley. */
export function buildSkyCliffGeometry() {
  const segs = 48
  const rows = 9
  const a0 = SKY_CLIFF.from - 0.08
  const a1 = SKY_CLIFF.to + 0.08
  const positions = []
  const colors = []
  const indices = []
  const color = new THREE.Color()
  const bands = ['#cdb8c4', '#b9aecb', '#a99cc0', '#9a8fb6'].map((c) => new THREE.Color(c))
  const top = SKY.level - 0.75
  const bottom = FLOOR - 0.8
  for (let row = 0; row <= rows; row++) {
    const k = row / rows
    for (let sIdx = 0; sIdx <= segs; sIdx++) {
      const a = a0 + (a1 - a0) * (sIdx / segs)
      // the coast at this angle, a touch inside it so the island's grass lip overhangs the top
      const R0 = SKY.r / skyDistance(SKY.x + Math.cos(a) * SKY.r, SKY.z + Math.sin(a) * SKY.r)
      // rough, layered stone: ledges every couple of metres, never leaning out past the coast
      const rough = 0.25 * Math.sin(a * 23 + row * 1.9) + 0.18 * Math.sin(a * 51 - row * 2.7) + (row % 2 ? -0.2 : 0)
      const R = R0 * 0.985 + Math.min(0, rough) - k * 0.6
      positions.push(SKY.x + Math.cos(a) * R, top + (bottom - top) * k, SKY.z + Math.sin(a) * R)
      color.copy(bands[row % bands.length]).multiplyScalar(0.92 + 0.12 * Math.sin(a * 37 + row))
      colors.push(color.r, color.g, color.b)
    }
  }
  const stride = segs + 1
  for (let row = 0; row < rows; row++)
    for (let sIdx = 0; sIdx < segs; sIdx++) {
      const a = row * stride + sIdx
      const b = a + stride
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}
