import * as THREE from 'three'
import { WATER_LEVEL, worldHeight, ZONES } from './terrain'
import { connections, constellation, futureWorlds, glowFlowers, littleThings, memories, memoryLane } from '../content/config'
import { heartPoint } from './heart'
import { FACE_CAMERA, isoBack, isoDir } from './iso'

const v = (x, y, z) => new THREE.Vector3(x, y, z)
/** A point on the main island's ground (y from the terrain). */
export const ground = (x, z, lift = 0) => v(x, worldHeight(x, z) + lift, z)

/** The Central Love Tree — the heart of the island. */
export const loveTree = ground(ZONES.tree.x, ZONES.tree.z)

/** Where the older features now live on the expanded island. */
export const spots = {
  gardenTree: ground(-9.2, 2.4), // the blossom tree of the Memory Garden (off to the side: never in front of the photo or the gallery)
  bench: ground(-5.7, 3.5),
  table: ground(2.7, 6.3), // the letter table, by the meadow
  telescope: ground(9.3, 2.0), // Starfall Cliff — looks across to the two islands (Chapter 2)
  arch: ground(7.0, 7.7), // the heart arch, in the Secret Cove
  timeMachine: ground(-1.9, -4.3), // at the edge of the Heartwood Forest
  portal: ground(7.7, -2.9), // beside Reflection Lake
}

/** The bench turns (almost) toward the 2.5D camera so the Love Capsule on it is never hidden by its backrest. */
export const benchRotation = FACE_CAMERA + 0.3

/** The Love Capsule jar sits on the right end of the bench seat (seat top is 0.485 above the ground). */
spots.capsule = spots.bench.clone().add(v(0.38, 0.485, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), benchRotation))

export const moonPosition = v(-48, 34, -86)

/* ───────── Chapter 2: five little things ───────── */

const LITTLE_SPOTS = {
  photo: ground(-6.9, 0.7),
  letter: v(4.15, WATER_LEVEL + 0.04, -6.15), // a bottle floating on the lake, reachable from the bridge
  flower: ground(-5.3, -6.7),
  musicbox: ground(8.1, 3.3),
  star: ground(-2.2, 8.9),
}
export const littleSpots = littleThings.map((l, i) => LITTLE_SPOTS[l.id] || ground(-2 + i, 6))

/* ───────── Chapter 1: the companion and three glowing flowers in the meadow ───────── */

/** Where the fluffy heart naps until she wakes it (a few steps from where she starts). */
export const mochiHome = ground(1.1, 7.5)
const GLOW_SPOTS = { rose: ground(-1.6, 6.0), sky: ground(1.6, 4.7), sun: ground(-1.0, 4.0) }
export const glowFlowerSpots = glowFlowers.map((f, i) => GLOW_SPOTS[f.id] || ground(-1.5 + i * 1.5, 5.2))

/* ───────── Chapter 4: the picnic on the soft hill between the Love Tree and the cove ───────── */

export const picnicSpot = ground(ZONES.picnic.x, ZONES.picnic.z)
const at = (dx, dz, lift = 0) => ground(picnicSpot.x + dx, picnicSpot.z + dz, lift)
export const PICNIC = {
  /** where each item belongs (the glowing slots of "Fix the Picnic") */
  slots: { blanket: at(0, 0), basket: at(0.55, -0.35), vase: at(-0.6, -0.4) },
  /** where the wind left them */
  scattered: { blanket: at(1.7, 0.9), basket: at(-1.6, 0.8), vase: at(0.4, 1.7) },
  /** the snack thief sneaks from the bushes to the basket */
  thiefFrom: at(2.8, -1.4),
  /** she and the companion sit on the blanket for the sunset */
  seatHer: at(-0.3, 0.35),
  seatPet: at(0.35, 0.45),
}

/* ───────── Chapter 5 + the secret ───────── */

/** The envelope lies at the foot of the Love Tree, on the side the camera starts on. */
export const envelopeSpot = ground(loveTree.x + 0.5, loveTree.z + 1.7)
/** A tiny glowing heart hidden behind the big blossom tree of the Memory Garden. */
export const bonusHeartSpot = ground(-9.3, 1.2, 0.35)

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

/** How many photos stand in the plaza (all of them are in the album at its centre). */
export const MAX_FRAMES = 12
/** Gallery frames are drawn at this scale. */
export const FRAME_SCALE = 0.6

/*
 * OUR MEMORIES — a round stone plaza in the south-west. The photos stand on slim golden posts in
 * a ring, all facing the middle; the ring opens toward the path so she walks in between them.
 * With more than 12 memories, the rest live in the album on the pedestal in the centre.
 */
export const gallery = ground(ZONES.gallery.x, ZONES.gallery.z)
export const GALLERY_RING = 2.25
/** direction (angle in the x/z plane) of the plaza's entrance, toward the end of its path */
const ENTRANCE = Math.atan2(7.2 - ZONES.gallery.z, -3.1 - ZONES.gallery.x)
export const framePositions = (() => {
  const n = Math.min(memories.length, MAX_FRAMES)
  if (n === 0) return []
  const step = n === 1 ? 0 : Math.min(0.52, (Math.PI * 2 - 1.3) / (n - 1))
  return Array.from({ length: n }, (_, i) => {
    // centred opposite the entrance, so the first thing she sees walking in is the whole ring
    const a = ENTRANCE + Math.PI + (i - (n - 1) / 2) * step
    const x = gallery.x + Math.cos(a) * GALLERY_RING
    const z = gallery.z + Math.sin(a) * GALLERY_RING
    return v(x, gallery.y + 1.05, z)
  })
})()
/** Every frame faces the middle of the plaza. */
export const frameFacing = (p) => v(gallery.x, p.y, gallery.z)

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
const LANE_SHIFT = v(-6.4, 0, 1.6)
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
  { group: 'sky', position: v(14.6, 2.4, 1.4) }, // on a tiny floating rock beside the cliff
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

/*
 * Everything that happens on the island is seen from the same flat 2D direction (see lib/iso.js):
 * focused moments only zoom, pan and lower the camera a little — they never swing it around.
 */
export const poses = {
  intro: pose(areas.intro.clone().add(v(0, -1.5, 0)), v(0, 0, 1), 4.6, 8.4, 12),
  avatar: pose(avatarStage.clone().add(v(0, 0.8, 0)), v(0, 0.2, 1), 3.4, 4.0, 4.2),
  enterMid: pose(v(0, 1.5, 3), isoDir(52), 30, 22, 30),
  explore: pose(v(0, 1.6, 0), isoDir(), 16, 12, 22),
  memories: pose(gallery.clone().add(v(0, 0.9, 0)), isoDir(46), 6.6, 5.4, 0),
  letter: pose(spots.table.clone().add(v(0, 0.95, 0)), isoDir(60), 1.9, 1.7, 2.6),
  distance: pose(areas.distance.clone().add(v(0, 2.3, 0)), isoDir(22), 23, 8.5, 0),
  finale: pose(areas.finale.clone(), v(0, 0, 1), 10.5, 10, 16),
  capsule: pose(spots.capsule.clone().add(v(0, 0.3, 0)), isoDir(45), 1.7, 1.4, 2.4),
  constellation: pose(areas.constellation.clone(), v(0, -0.16, 1), 14, 12.5, 19),
  timemachine: pose(spots.timeMachine.clone().add(v(0, 1.0, 0)), isoDir(34), 2.6, 2.4, 3.6),
  finalRoom: pose(areas.finalRoom.clone().add(v(0, 1.6, 0)), v(0, 0.12, 1), 9, 6.5, 9),
  future: pose(areas.future.clone(), v(0, 0.2, 1), 22, 8, 16),
  /** the love letter: the avatar at the foot of the Love Tree in full bloom */
  ending: pose(loveTree.clone().addScaledVector(isoBack, 0.9).add(v(0, 2.5, 0)), isoDir(28), 8.5, 8, 12),
  /** the Disaster Date: the picnic hill, a little closer */
  picnic: pose(picnicSpot.clone().add(v(0.2, 0.5, -0.4)), isoDir(50, -0.35), 8, 6, 0),
  /** secret ending: drift in close to the big heart in the Secret Room */
  secretClose: pose(areas.finalRoom.clone().add(v(0, 2.9, -1.5)), v(0, 0.08, 1), 3.6, 3.4, 5.2),
  /** the final moment: pull far back to see the whole little universe at once */
  epilogue: pose(v(-3, 1.5, 0), isoDir(46), 52, 34, 44),
}

export function futurePose(index) {
  const p = futureWorldPositions[index]
  if (!p) return poses.future
  return pose(p.clone().add(areas.future).add(v(0, 0.3, 0)), v(0, 0.22, 1), 4.6, 4.6, 6)
}

export function lanePose(index) {
  const p = lanePoints[index]
  if (!p) return poses.explore
  return pose(p.clone().add(v(0, 0.2, 0)), isoDir(30), 3.6, 3.6, 4.4)
}

export function framePose(index) {
  const p = framePositions[index]
  if (!p) return poses.memories
  // seen from the middle of the plaza, a little above eye level
  const dir = v(gallery.x - p.x, 0, gallery.z - p.z).normalize().add(v(0, 0.28, 0))
  return pose(p.clone(), dir, 1.5, 1.35, 2.2)
}

/** Resolve a pose into camera position + target for a given vertical fov (degrees) and aspect. */
export function resolvePose(p, fov, aspect) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2)
  const dist = Math.max(p.minDist, p.fitH / (2 * tanV), p.fitW / (2 * tanV * aspect))
  const position = p.target.clone().addScaledVector(p.dir, dist)
  return { position, target: p.target.clone(), dist }
}
