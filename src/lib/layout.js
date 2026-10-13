import * as THREE from 'three'
import { WATER_LEVEL, worldHeight, ZONES } from './terrain'
import { connections, constellation, futureWorlds, littleThings, memories, memoryLane, seeds } from '../content/config'
import { heartPoint } from './heart'

const v = (x, y, z) => new THREE.Vector3(x, y, z)
/** A point on the main island's ground (y from the terrain). */
export const ground = (x, z, lift = 0) => v(x, worldHeight(x, z) + lift, z)

/** The Central Love Tree — the heart of the island. */
export const loveTree = ground(ZONES.tree.x, ZONES.tree.z)

/** Where the older features now live on the expanded island. */
export const spots = {
  gardenTree: ground(-7.3, 1.1), // the blossom tree of the Memory Garden
  bench: ground(-5.7, 3.5),
  table: ground(2.7, 6.3), // the letter table, by the meadow
  telescope: ground(9.3, 2.0), // Starfall Cliff — looks across to the two islands (Chapter 2)
  arch: ground(7.0, 7.7), // the heart arch, in the Secret Cove
  timeMachine: ground(-1.9, -4.3), // at the edge of the Heartwood Forest
  portal: ground(7.7, -2.9), // beside Reflection Lake
}

/** The bench faces the garden path. */
export const benchRotation = Math.PI / 2 - 0.35

/** The Love Capsule jar sits on the right end of the bench seat (seat top is 0.485 above the ground). */
spots.capsule = spots.bench.clone().add(v(0.38, 0.485, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), benchRotation))

export const moonPosition = v(-48, 34, -86)

/* ───────── Chapter 1: five little things ───────── */

const LITTLE_SPOTS = {
  photo: ground(-6.9, 0.7),
  letter: v(4.15, WATER_LEVEL + 0.04, -6.15), // a bottle floating on the lake, reachable from the bridge
  flower: ground(-5.3, -6.7),
  musicbox: ground(8.1, 3.3),
  star: ground(-2.9, 7.3),
}
export const littleSpots = littleThings.map((l, i) => LITTLE_SPOTS[l.id] || ground(-2 + i, 6))

/* ───────── Chapter 3: seeds and the plots around the Love Tree ───────── */

const SEED_SPOTS = {
  honesty: ground(-8.0, 3.5),
  kindness: ground(-4.1, -8.0),
  adventures: ground(9.7, 3.5),
  growth: ground(2.4, -8.1),
  future: ground(2.9, 8.7),
}
const PLOT_ANGLE = { honesty: 55, future: 115, kindness: 185, growth: 274, adventures: 350 }
export const seedSpots = seeds.map((sd, i) => SEED_SPOTS[sd.id] || ground(-3 + i * 1.5, 5))
export const plotSpots = seeds.map((sd, i) => {
  const a = THREE.MathUtils.degToRad(PLOT_ANGLE[sd.id] ?? i * 72)
  return ground(loveTree.x + Math.cos(a) * 2.75, loveTree.z + Math.sin(a) * 2.75)
})
/** Where water can be scooped for the Kindness seed (lake shore near the bridge). */
export const waterSpot = ground(2.55, -3.9)
/** The two guiding stones beside the Shared Adventures plot. */
export const stoneSpots = (() => {
  const i = seeds.findIndex((sd) => sd.id === 'adventures')
  const p = plotSpots[i] || loveTree
  const out = new THREE.Vector3(p.x - loveTree.x, 0, p.z - loveTree.z).normalize()
  const side = new THREE.Vector3(-out.z, 0, out.x)
  return [-1, 1].map((s) => ground(p.x + side.x * 0.85 * s + out.x * 0.3, p.z + side.z * 0.85 * s + out.z * 0.3))
})()

/* ───────── optional discoveries ───────── */

export const noteSpots = {
  'forest-hollow': ground(-7.2, -3.7),
  'lake-stone': ground(6.9, -7.2),
  'cliff-edge': ground(10.1, 1.0),
  'cove-light': ground(8.0, 6.8),
}
/** Reaching this spot on Starfall Cliff plays the view once. */
export const viewpointSpot = { x: 8.7, z: 2.4, r: 1.5 }
/** The little star near the Love Tree that opens the secret ending (after the main ending). */
export const secretStarSpot = v(loveTree.x + 1.7, loveTree.y + 4.3, loveTree.z + 0.8)

export const MAX_FRAMES = 10

/** Floating photo frames in an arc around the far side of the Memory Garden. */
const GARDEN = ground(ZONES.garden.x, ZONES.garden.z)
export const framePositions = (() => {
  const n = Math.min(memories.length, MAX_FRAMES)
  if (n === 0) return []
  const spread = THREE.MathUtils.degToRad(Math.min(110, 25 + n * 8.5))
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const a = Math.PI - spread + t * spread * 2 // centred on the west (away from the island centre)
    const r = 3.7
    const y = GARDEN.y + 2.3 + 0.8 * Math.cos(a - Math.PI) ** 2 + (i % 2 ? -0.25 : 0.25)
    return v(GARDEN.x + Math.cos(a) * r, y, GARDEN.z + Math.sin(a) * r)
  })
})()
export const frameLookAt = v(GARDEN.x + 1.2, GARDEN.y + 2.4, GARDEN.z)

export const areas = {
  intro: v(0, 70, 60),
  distance: v(72, 14, -34),
  finale: v(0, 230, 0),
  constellation: v(34, 40, -62),
  future: v(-84, 22, -36),
  finalRoom: v(0, 140, -170),
}

/** The avatar selection platform floats just below the intro heart. */
export const avatarStage = areas.intro.clone().add(v(0, -4.2, -1))

/** Dream worlds behind the portal, in a gentle arc (local to areas.future). */
export const futureWorldPositions = futureWorlds.worlds.map((_, i, all) => {
  const t = all.length === 1 ? 0 : i / (all.length - 1) - 0.5
  return v(t * 16, Math.sin((i / Math.max(1, all.length - 1)) * Math.PI) * 0.8, -Math.abs(t) * 5)
})

/** Memory Lane: floating lanterns drifting away from the island's west coast. */
const LANE_SHIFT = v(-4.7, 0, 1.4)
export const laneCurve = new THREE.CatmullRomCurve3(
  [v(-6.9, 0.25, 2.6), v(-9.6, 0.8, 5.4), v(-13.0, 1.6, 7.2), v(-16.8, 2.4, 7.0), v(-20.2, 3.2, 4.8), v(-22.6, 4.0, 1.4), v(-23.8, 4.8, -2.6)].map((p) =>
    p.add(LANE_SHIFT),
  ),
)

export const lanePoints = (() => {
  const n = memoryLane.milestones.length
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => laneCurve.getPointAt(n === 1 ? 0 : i / (n - 1)))
})()

/** Constellation stars sit on a heart outline (local to areas.constellation). */
export const starPositions = (() => {
  const n = constellation.reasons.length
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = heartPoint((i / n) * Math.PI * 2)
    const wobble = ((i * 37) % 7) / 7 - 0.5
    return v(x * 5.2, y * 5.2, wobble * 0.8)
  })
})()

/** Hidden hearts. `group` says which part of the scene they belong to; positions are local to it. */
export const hiddenHeartSpots = [
  { group: 'island', position: ground(0.45, -1.85, 0.13) }, // behind the Love Tree
  { group: 'island', position: ground(-6.9, -4.6, 0.1) }, // among the ferns of the forest
  { group: 'sky', position: v(12.9, 2.2, 1.2) }, // on a tiny floating rock beside the cliff
  { group: 'distance', position: v(10.35, 1.0, 0.95) }, // on her island under the same sky
  { group: 'constellation', position: v(6.8, -4.6, 0.6) }, // just beside the heart of stars
]

/* ───────── Chapter 2: the bridge between two islands (local to areas.distance) ───────── */

export const ISLAND_SPREAD = 9
export const ISLAND_LIFT = 0.75
const CONNECTION_SPOTS = {
  trust: v(-9.9, ISLAND_LIFT + 0.05, 0.9),
  communication: v(-8.2, ISLAND_LIFT + 0.05, 1.3), // the answering one sits on her island (mirrored)
  patience: v(0, ISLAND_LIFT + 0.9, 0.5),
  understanding: v(0, ISLAND_LIFT + 4.2, -0.6),
  effort: v(-7.7, ISLAND_LIFT + 0.05, -0.9),
}
export const connectionSpots = connections.map((c, i) => CONNECTION_SPOTS[c.id] || v(-8 + i, ISLAND_LIFT, 1))

/**
 * Camera poses. Each one has a target, a viewing direction and the width/height of what must fit.
 * The final distance adapts to the screen's aspect ratio so phones in portrait see the whole subject.
 */
const pose = (target, dir, fitW, fitH, minDist = 0) => ({ target, dir: dir.normalize(), fitW, fitH, minDist })

export const poses = {
  intro: pose(areas.intro.clone().add(v(0, -1.5, 0)), v(0, 0, 1), 4.6, 8.4, 12),
  avatar: pose(avatarStage.clone().add(v(0, 0.75, 0)), v(0, 0.16, 1), 2.6, 2.4, 4.2),
  enterMid: pose(v(0, 1.5, 4), v(0.1, 0.8, 1), 30, 22, 30),
  explore: pose(v(0, 1.6, 0), v(0, 0.36, 1), 16, 12, 22),
  memories: pose(frameLookAt.clone().add(v(-1.6, 0.2, 0)), v(1, 0.15, 0.08), 9.5, 5, 8),
  letter: pose(spots.table.clone().add(v(0, 1.0, 0)), v(0.35, 0.8, 1), 1.9, 1.7, 2.6),
  distance: pose(areas.distance.clone().add(v(0, 0.8, 0)), v(0, 0.18, 1), 24, 11, 20),
  finale: pose(areas.finale.clone(), v(0, 0, 1), 10.5, 10, 16),
  capsule: pose(spots.capsule.clone().add(v(0, 0.3, 0)), v(1, 0.6, 0.35), 1.7, 1.4, 2.4),
  constellation: pose(areas.constellation.clone(), v(0, -0.16, 1), 14, 12.5, 19),
  timemachine: pose(spots.timeMachine.clone().add(v(0, 1.0, 0)), v(0.4, 0.42, 1), 2.6, 2.4, 3.6),
  finalRoom: pose(areas.finalRoom.clone().add(v(0, 1.6, 0)), v(0, 0.12, 1), 9, 6.5, 9),
  future: pose(areas.future.clone(), v(0, 0.2, 1), 22, 8, 16),
  /** the love letter: the Love Tree in full bloom behind it */
  ending: pose(loveTree.clone().add(v(0, 2.6, 0)), v(0.25, 0.22, 1), 9, 8, 12),
  /** secret ending: drift in close to the big heart in the Secret Room */
  secretClose: pose(areas.finalRoom.clone().add(v(0, 2.9, -1.5)), v(0, 0.08, 1), 3.6, 3.4, 5.2),
  /** the final moment: pull far back to see the whole little universe at once */
  epilogue: pose(v(-4, 2.5, 0), v(0.18, 0.5, 1), 52, 34, 44),
}

export function futurePose(index) {
  const p = futureWorldPositions[index]
  if (!p) return poses.future
  return pose(p.clone().add(areas.future).add(v(0, 0.3, 0)), v(0, 0.22, 1), 4.6, 4.6, 6)
}

export function lanePose(index) {
  const p = lanePoints[index]
  if (!p) return poses.explore
  const dir = v(p.x, 0, p.z).normalize().add(v(0, 0.42, 0))
  return pose(p.clone().add(v(0, 0.2, 0)), dir, 3.6, 3.6, 4.4)
}

export function framePose(index) {
  const p = framePositions[index]
  if (!p) return poses.memories
  const dir = frameLookAt.clone().sub(p).setY(0.1)
  return pose(p.clone(), dir, 2.4, 2.2, 3)
}

/** Resolve a pose into camera position + target for a given vertical fov (degrees) and aspect. */
export function resolvePose(p, fov, aspect) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2)
  const dist = Math.max(p.minDist, p.fitH / (2 * tanV), p.fitW / (2 * tanV * aspect))
  const position = p.target.clone().addScaledVector(p.dir, dist)
  return { position, target: p.target.clone(), dist }
}
