import * as THREE from 'three'
import { PATHS, SPREAD, WATER_LEVEL, worldHeight, ZONES } from './terrain'
import { connections, constellation, futureWorlds, glowFlowers, littleThings, memories, memoryLane } from '../content/config'
import { heartPoint } from './heart'
import { FACE_CAMERA, isoBack, isoDir } from './iso'

const v = (x, y, z) => new THREE.Vector3(x, y, z)
/** A point on the main island's ground (y from the terrain). */
export const ground = (x, z, lift = 0) => v(x, worldHeight(x, z) + lift, z)
/** A point on the base map (spread out with the island). */
const spot = (x, z, lift = 0) => ground(x * SPREAD, z * SPREAD, lift)
/** A point relative to a zone's centre (stays put inside that zone however big the island gets). */
const near = (zone, dx, dz, lift = 0) => ground(ZONES[zone].x + dx, ZONES[zone].z + dz, lift)

/** The Central Love Tree — the heart of the island. */
export const loveTree = ground(ZONES.tree.x, ZONES.tree.z)

/** Where the older features now live on the expanded island. */
export const spots = {
  gardenTree: near('garden', -3.0, 0.2), // the blossom tree of the Memory Garden (off to the side: never in front of the photo or the gallery)
  bench: near('garden', 0.5, 1.3),
  table: spot(2.7, 6.3), // the letter table, by the meadow
  telescope: near('cliff', 1.0, -0.3), // Starfall Cliff — looks across to the two islands (Chapter 3)
  arch: near('cove', 0.4, 0.1), // the heart arch, in the Secret Cove
  timeMachine: spot(-1.9, -4.3), // at the edge of the Heartwood Forest
  portal: near('lake', 2.7, 2.1), // beside Reflection Lake
}

/** The bench turns (almost) toward the 2.5D camera so the Love Capsule on it is never hidden by its backrest. */
export const benchRotation = FACE_CAMERA + 0.3

/** The Love Capsule jar sits on the right end of the bench seat (seat top is 0.485 above the ground). */
spots.capsule = spots.bench.clone().add(v(0.38, 0.485, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), benchRotation))

export const moonPosition = v(-48, 34, -86)

/* ───────── Chapter 2: five little things ───────── */

const LITTLE_SPOTS = {
  photo: near('garden', -0.7, -1.5),
  letter: v(ZONES.lake.x - 0.85, WATER_LEVEL + 0.04, ZONES.lake.z - 1.15), // a bottle floating on the lake, reachable from the bridge
  flower: near('forest', 0.1, -0.6),
  musicbox: near('cliff', -0.2, 1.0),
  star: spot(-2.2, 8.9),
}
export const littleSpots = littleThings.map((l, i) => LITTLE_SPOTS[l.id] || ground(-2 + i, 6))

/* ───────── Chapter 1: the companion and three glowing flowers in the meadow ───────── */

/** Where the fluffy heart naps until she wakes it (a few steps from where she starts). */
export const mochiHome = spot(1.1, 7.5)
const GLOW_SPOTS = { rose: spot(-1.6, 6.0), sky: spot(1.6, 4.7), sun: spot(-1.0, 4.0) }
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

/* ───────── letters in a bottle (playing together) ───────── */

/** The little river from Reflection Lake to the waterfall. */
export const RIVER_DIR = new THREE.Vector3(0.72, 0, -0.69).normalize()
const riverSide = new THREE.Vector3(-RIVER_DIR.z, 0, RIVER_DIR.x)
/** Where the river starts (a sent bottle floats from here to the waterfall). */
export const riverStart = v(ZONES.lake.x + RIVER_DIR.x * 2.9, WATER_LEVEL + 0.06, ZONES.lake.z + RIVER_DIR.z * 2.9)
/** The little dock on the riverbank where letters are put into bottles. */
export const bottleDock = ground(ZONES.lake.x + RIVER_DIR.x * 3.6 + riverSide.x * 0.8, ZONES.lake.z + RIVER_DIR.z * 3.6 + riverSide.z * 0.8)
/** Where letters for her float in the lake, close to the south shore. */
export const bottleHarbour = (i) => v(ZONES.lake.x - 0.9 + (i % 4) * 0.6, WATER_LEVEL + 0.05, ZONES.lake.z + 1.95 + Math.floor(i / 4) * 0.25)

/* ───────── Chapter 5 + the secret ───────── */

/** The envelope lies at the foot of the Love Tree, on the side the camera starts on. */
export const envelopeSpot = ground(loveTree.x + 0.5, loveTree.z + 1.7)
/** A tiny glowing heart hidden behind the big blossom tree of the Memory Garden. */
export const bonusHeartSpot = near('garden', -3.1, -1.0, 0.35)

/* ───────── optional discoveries ───────── */

export const noteSpots = {
  'forest-hollow': near('forest', -1.8, 2.4),
  'lake-stone': near('lake', 1.9, -2.2),
  'cliff-edge': near('cliff', 1.8, -1.3),
  'cove-light': near('cove', 1.4, -0.8),
}
/** Reaching this spot on Starfall Cliff plays the view once. */
export const viewpointSpot = { x: ZONES.cliff.x + 0.4, z: ZONES.cliff.z + 0.1, r: 1.5 }
/** The little star near the Love Tree that opens the secret ending (after the main ending). */
export const secretStarSpot = v(loveTree.x + 1.7, loveTree.y + 4.3, loveTree.z + 0.8)

/** How many photos hang in the plaza (two under each arch; all of them are in the album). */
export const MAX_FRAMES = 12
/** Polaroids are drawn at this scale. */
export const FRAME_SCALE = 1

/*
 * OUR MEMORIES — a round garden plaza in the south-west. A heart fountain in the middle; around it a
 * ring of flowering arches, each with two polaroids hanging on ribbons, all facing the fountain.
 * The ring opens toward the path (a flower gate), so she walks in between the arches.
 * With more than 12 memories, the rest live in the album on the stand by the fountain.
 */
export const gallery = ground(ZONES.gallery.x, ZONES.gallery.z)
/** Radius of the ring of arches. */
export const GALLERY_RING = 2.55
/** direction (angle in the x/z plane) of the plaza's entrance, toward the end of its path */
export const GALLERY_ENTRANCE = (() => {
  const end = PATHS[6][PATHS[6].length - 1]
  return Math.atan2(end[1] - ZONES.gallery.z, end[0] - ZONES.gallery.x)
})()
/** The arches: angle around the plaza (spread over the ring, leaving the entrance open). */
export const galleryArches = (() => {
  const n = Math.max(3, Math.ceil(Math.min(memories.length, MAX_FRAMES) / 2))
  const span = Math.PI * 2 - 1.6 // the gap at the entrance
  return Array.from({ length: n }, (_, i) => GALLERY_ENTRANCE + 0.8 + (n === 1 ? span / 2 : (i * span) / (n - 1)))
})()
/** Half the width of an arch (posts at ± this along the ring), and where the two photos hang. */
export const ARCH_HALF = 0.95
export const HANG = 0.46
/** Height of the centre of a hanging polaroid above the plaza. */
export const PHOTO_Y = 1.62
export const framePositions = (() => {
  const n = Math.min(memories.length, MAX_FRAMES)
  return Array.from({ length: n }, (_, i) => {
    const a = galleryArches[Math.floor(i / 2)]
    const side = i % 2 ? 1 : -1
    // along the ring's tangent, so each pair hangs side by side under its arch
    const x = gallery.x + Math.cos(a) * GALLERY_RING - Math.sin(a) * side * HANG
    const z = gallery.z + Math.sin(a) * GALLERY_RING + Math.cos(a) * side * HANG
    return v(x, gallery.y + PHOTO_Y, z)
  })
})()
/** Every photo faces the fountain in the middle. */
export const frameFacing = (p) => v(gallery.x, p.y, gallery.z)
/** The album's stand: between the fountain and the gate. */
export const albumSpot = ground(gallery.x + Math.cos(GALLERY_ENTRANCE) * 1.55, gallery.z + Math.sin(GALLERY_ENTRANCE) * 1.55)

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
    p.add(LANE_SHIFT).multiply(v(SPREAD, 1, SPREAD)),
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
  { group: 'island', position: near('forest', -1.5, 1.5, 0.1) }, // among the ferns of the forest
  { group: 'sky', position: v(14.6 * SPREAD, 2.4, 1.4 * SPREAD) }, // on a tiny floating rock beside the cliff
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
  memories: pose(gallery.clone().add(v(0, 1.1, 0)), isoDir(46), 7.6, 6.2, 0),
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
  epilogue: pose(v(-3, 1.5, 0), isoDir(46), 52 * SPREAD, 34 * SPREAD, 44),
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
