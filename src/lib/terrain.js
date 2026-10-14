import * as THREE from 'three'

/*
 * The expanded main island: one continuous terrain with distinct zones.
 * Everything that needs to know "how high is the ground here" or "can I walk here"
 * uses this module — rendering, placement, the player controller and the camera.
 */

export const MAIN_RADIUS = 12.8
export const WATER_LEVEL = -0.22

/** Zone centres (x, z) and sizes. The start is in the south (+z), the cliff in the east (+x). */
export const ZONES = {
  meadow: { x: 0, z: 7.6, r: 3.6 },
  tree: { x: 0, z: 0, r: 2.6 },
  garden: { x: -6.2, z: 2.2, r: 3.2 },
  forest: { x: -5.4, z: -6.1, r: 3.8 },
  lake: { x: 5, z: -5, r: 2.7 },
  cliff: { x: 8.3, z: 2.3, r: 2.3 },
  cove: { x: 6.6, z: 7.6, r: 2.1 },
  /** Our Memories: a round, flat gallery plaza with the photos standing in a ring */
  gallery: { x: -5.8, z: 6.9, r: 2.5 },
  /** The Disaster Date: a soft, level hill for the picnic */
  picnic: { x: 4.4, z: 4.6, r: 1.9 },
}

/** Where the player starts after choosing an avatar. */
export const SPAWN = { x: 0, z: 9.2, yaw: Math.PI }

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
const dist = (x, z, c) => Math.hypot(x - c.x, z - c.z)
const bump = (x, z, c, r) => 1 - smooth(0, r, dist(x, z, c))

/** Irregular coastline: radius multiplier for an angle. */
export function outline(theta) {
  return (
    1 +
    0.07 * Math.sin(3 * theta + 0.6) +
    0.05 * Math.sin(5 * theta - 1.3) +
    0.03 * Math.sin(9 * theta + 2.1) +
    // a little peninsula toward the cove, and a broad bay on the north-west
    0.06 * Math.exp(-((theta - 0.86) ** 2) * 9) -
    0.04 * Math.exp(-((theta + 2.2) ** 2) * 6)
  )
}

export const edgeRadius = (x, z) => MAIN_RADIUS * outline(Math.atan2(z, x))

/** Ground height of the main island. */
/** The picnic terrace sits at whatever height the hillside naturally has at its centre. */
let picnicLevel = null

export function worldHeight(x, z, skipPicnic = false) {
  const r = Math.hypot(x, z)
  const t = r / edgeRadius(x, z)
  let h = 0.55 * (1 - Math.min(1.2, t) ** 2)
  // rolling hills
  h += 0.22 * Math.sin(x * 0.42 + 1.1) * Math.cos(z * 0.37 - 0.4) + 0.12 * Math.sin(x * 0.9 - z * 0.7 + 2.0) + 0.05 * Math.sin(x * 1.9 + z * 1.6)
  // the meadow is gentle and open
  const m = bump(x, z, ZONES.meadow, 4)
  h = h * (1 - m * 0.75) + 0.32 * m * 0.75
  // the memories plaza is flat and level, like a little stone courtyard
  const g = 1 - smooth(ZONES.gallery.r + 0.1, ZONES.gallery.r + 1.4, dist(x, z, ZONES.gallery))
  h = h * (1 - g * 0.9) + 0.26 * g * 0.9
  // a soft hill under the Love Tree
  h += 0.4 * bump(x, z, ZONES.tree, 3.4)
  // the forest floor rolls a bit more
  h += 0.18 * bump(x, z, ZONES.forest, 4.2) * Math.sin(x * 1.3 + z * 0.8)
  // lake basin
  h -= 1.55 * bump(x, z, ZONES.lake, 3.9)
  // the cove dips toward the sea of clouds
  h -= 0.3 * bump(x, z, ZONES.cove, 2.6)
  // Starfall Cliff: a plateau with a gentle ramp on its west side
  const c = ZONES.cliff
  const dx = x - c.x
  const dz = z - c.z
  const d = Math.hypot(dx, dz)
  const ramp = Math.max(0, (-dx * 0.96 + dz * 0.28) / (d || 1))
  const outer = c.r + 1.3 + 3.4 * ramp ** 2
  h += 2.3 * smooth(outer, c.r, d)
  // the picnic: a small level terrace on the slope below the cliff
  if (!skipPicnic) {
    const pq = 1 - smooth(ZONES.picnic.r, ZONES.picnic.r + 1.2, dist(x, z, ZONES.picnic))
    if (pq > 0) {
      picnicLevel ??= worldHeight(ZONES.picnic.x, ZONES.picnic.z, true)
      h = h * (1 - pq) + picnicLevel * pq
    }
  }
  // edges roll off before the rock face
  h -= 0.55 * smooth(0.86, 1.0, t)
  return h
}

/* ───────── paths (soil colour, flower/grass avoidance, guidance) ───────── */

export const PATHS = [
  // spawn → Love Tree
  [[0, 9.6], [0.3, 7.4], [-0.2, 5.2], [0.1, 3.1]],
  // tree → Memory Garden
  [[-1.8, 1.4], [-3.6, 2.3], [-5.0, 2.4]],
  // tree → Heartwood Forest
  [[-1.4, -1.6], [-2.8, -3.6], [-4.4, -5.2], [-5.6, -6.4]],
  // tree → lake bridge (west end)
  [[1.6, -1.4], [2.4, -3.4], [2.2, -5.0]],
  // tree → cliff ramp → viewpoint
  [[2.2, 0.8], [4.0, 1.5], [5.7, 2.0], [7.3, 2.3], [8.8, 2.5]],
  // meadow → the Secret Cove
  [[1.6, 8.4], [3.4, 8.9], [5.0, 8.3], [6.4, 7.7]],
  // meadow → Our Memories (the gallery plaza)
  [[-0.3, 7.6], [-1.9, 7.5], [-3.1, 7.2]],
]

const segDist = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}

/** Distance from a point to the nearest path. */
export function pathDistance(x, z) {
  let best = Infinity
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) best = Math.min(best, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]))
  return best
}

/* ───────── the lake bridge ───────── */

export const BRIDGE = { z: -5.0, x0: 2.0, x1: 8.0, halfWidth: 0.55, deck: WATER_LEVEL + 0.32 }

export const onBridge = (x, z) => x > BRIDGE.x0 && x < BRIDGE.x1 && Math.abs(z - BRIDGE.z) < BRIDGE.halfWidth

/** Height the player stands at (terrain, or the bridge deck over the lake). */
export function standHeight(x, z) {
  const h = worldHeight(x, z)
  return onBridge(x, z) ? Math.max(h, BRIDGE.deck) : h
}

export const isWater = (x, z) => worldHeight(x, z) < WATER_LEVEL - 0.02 && !onBridge(x, z)

/* ───────── colliders ───────── */

/** Circle obstacles (trees, rocks, props). Filled in by the world once things are placed. */
export const colliders = []
export function addCollider(x, z, r) {
  colliders.push({ x, z, r })
}

/**
 * Can the player stand at (x, z), coming from height `fromY`?
 * Blocks the island edge, deep water, steep cliff faces and solid objects.
 */
export function walkable(x, z, fromY) {
  if (Math.hypot(x, z) > edgeRadius(x, z) * 0.9) return false
  if (isWater(x, z)) return false
  if (fromY !== undefined && standHeight(x, z) - fromY > 0.32) return false // too steep to climb
  for (const c of colliders) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return false
  return true
}

/* ───────── deterministic placement helpers ───────── */

export function seeded(seed = 1) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Ground slope (rise per unit) — used to keep grass and trees off cliff faces. */
export function slope(x, z) {
  const e = 0.25
  return Math.hypot(worldHeight(x + e, z) - worldHeight(x - e, z), worldHeight(x, z + e) - worldHeight(x, z - e)) / (2 * e)
}

export const inZone = (x, z, name, extra = 0) => dist(x, z, ZONES[name]) < ZONES[name].r + extra
export const zoneDistance = (x, z, name) => dist(x, z, ZONES[name])

/* ───────── ground colour ───────── */

const C = {
  grass: new THREE.Color('#78b955'),
  grassLight: new THREE.Color('#a6d264'),
  lilac: new THREE.Color('#8fc06c'), // a soft sage, for variety
  pink: new THREE.Color('#f6b3cc'),
  moss: new THREE.Color('#4c9250'),
  soil: new THREE.Color('#d9bf8f'),
  sand: new THREE.Color('#ecdcb2'),
  stone: new THREE.Color('#c9bfae'),
  lakebed: new THREE.Color('#62cfc8'),
}

/** Colour of the ground at a point (written into vertex colours). */
export function groundColor(out, x, z, h) {
  const n = 0.5 + 0.5 * Math.sin(x * 1.3) * Math.cos(z * 1.1)
  out.copy(C.grass).lerp(C.grassLight, bump(x, z, ZONES.meadow, 4.5) * 0.6)
  out.lerp(C.lilac, n * 0.18)
  out.lerp(C.pink, bump(x, z, ZONES.garden, 4) * 0.25 * n)
  out.lerp(C.moss, bump(x, z, ZONES.forest, 4.4) * 0.55)
  // paths
  const p = pathDistance(x, z)
  out.lerp(C.soil, (1 - smooth(0.32, 0.62, p)) * 0.85)
  // the memories plaza: pale paving stones in rings
  const gd = dist(x, z, ZONES.gallery)
  const paving = 1 - smooth(ZONES.gallery.r - 0.1, ZONES.gallery.r + 0.2, gd)
  if (paving > 0) {
    const ring = 0.5 + 0.5 * Math.cos(gd * 7.5)
    out.lerp(C.stone, paving * 0.35).lerp(C.sand, paving * (0.45 + ring * 0.2))
  }
  // shore and cove sand
  const shore = 1 - smooth(WATER_LEVEL + 0.05, WATER_LEVEL + 0.45, h)
  out.lerp(C.sand, Math.max(shore * 0.9, bump(x, z, ZONES.cove, 2.4) * 0.6))
  out.lerp(C.lakebed, 1 - smooth(WATER_LEVEL - 0.5, WATER_LEVEL - 0.05, h))
  // steep faces are bare stone
  out.lerp(C.stone, smooth(0.9, 1.5, slope(x, z)))
  return out
}

/** Terrain mesh for the main island (top surface), built ring by ring with irregular coast. */
export function buildTerrainGeometry({ rows = 56, segments = 220 } = {}) {
  const positions = []
  const colors = []
  const indices = []
  const color = new THREE.Color()
  const rowFactors = []
  for (let i = 0; i <= rows; i++) rowFactors.push(Math.max(0.0001, (i / rows) ** 0.85))
  rowFactors.push(1.02) // lip that tucks over the rock below
  rowFactors.forEach((rf, row) => {
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2
      const R = MAIN_RADIUS * outline(theta) * rf
      const x = Math.cos(theta) * R
      const z = Math.sin(theta) * R
      let y = worldHeight(x, z)
      if (row === rowFactors.length - 1) y -= 0.25
      positions.push(x, y, z)
      groundColor(color, x, z, y)
      colors.push(color.r, color.g, color.b)
    }
  })
  const stride = segments + 1
  for (let row = 0; row < rowFactors.length - 1; row++) {
    for (let s = 0; s < segments; s++) {
      const a = row * stride + s
      const b = a + stride
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** The faceted rock underside of the main island, following the same coastline. */
export function buildUndersideGeometry({ segments = 64 } = {}) {
  const profile = [
    [1.02, -0.3],
    [0.97, -1.2],
    [0.88, -2.4],
    [0.74, -3.8],
    [0.57, -5.4],
    [0.4, -7.0],
    [0.24, -8.6],
    [0.1, -10.2],
    [0.0001, -11.2],
  ]
  // layered earth under the miniature island: a grassy lip, warm soil, then darker stone
  const top = new THREE.Color('#c99b6c')
  const mid = new THREE.Color('#a77856')
  const bottom = new THREE.Color('#7a5c4b')
  const positions = []
  const colors = []
  const indices = []
  const color = new THREE.Color()
  profile.forEach(([rf, y], row) => {
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2
      const jitter = row === 0 || row === profile.length - 1 ? 0 : 0.08 * Math.sin(theta * 5 + row * 1.7) + 0.05 * Math.sin(theta * 13 - row * 2.3)
      const R = MAIN_RADIUS * outline(theta) * rf * (1 + jitter)
      const x = Math.cos(theta) * R
      const z = Math.sin(theta) * R
      positions.push(x, row === 0 ? worldHeight(x, z) - 0.3 : y, z)
      const t = row / (profile.length - 1)
      if (t < 0.4) color.copy(top).lerp(mid, t / 0.4)
      else color.copy(mid).lerp(bottom, (t - 0.4) / 0.6)
      colors.push(color.r, color.g, color.b)
    }
  })
  const stride = segments + 1
  for (let row = 0; row < profile.length - 1; row++) {
    for (let s = 0; s < segments; s++) {
      const a = row * stride + s
      const b = a + stride
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}
