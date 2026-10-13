import * as THREE from 'three'
import { heightAt } from './island'
import { constellation, futureWorlds, memories, memoryLane } from '../content/config'
import { heartPoint } from './heart'

const v = (x, y, z) => new THREE.Vector3(x, y, z)
const ground = (x, z, lift = 0) => v(x, heightAt(x, z) + lift, z)

/** Where everything lives on the main island (y is filled in from the terrain). */
export const spots = {
  tree: ground(-0.7, -1.7),
  bench: ground(-0.45, -0.35),
  table: ground(2.4, 1.2),
  telescope: ground(-3.0, 1.9),
  arch: ground(3.5, -3.55),
  timeMachine: ground(-4.05, -1.85),
  portal: ground(4.75, -0.55),
}

/** The Heart Reactor floats high above the meadow, behind the blossom tree. */
export const reactorPosition = v(0, 6.1, -1.4)

/** The bench is turned slightly toward the front of the island. */
export const benchRotation = 0.15

/** The Love Capsule jar sits on the right end of the bench seat (seat top is 0.485 above the ground). */
spots.capsule = spots.bench.clone().add(v(0.38, 0.485, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), benchRotation))

export const moonPosition = v(-48, 34, -86)

/** Glowing paths, as XZ control points. */
export const paths = [
  // main path: front edge → past the letter table → secret arch
  [
    [0.3, 5.6],
    [0.55, 3.6],
    [1.5, 2.5],
    [2.75, 0.55],
    [3.3, -1.6],
    [3.45, -3.1],
  ],
  // to the telescope
  [
    [0.4, 4.3],
    [-0.9, 3.5],
    [-2.3, 2.6],
  ],
  // to the bench under the tree
  [
    [0.55, 3.4],
    [0.2, 1.9],
    [-0.25, 0.5],
  ],
]

export const MAX_FRAMES = 10

/**
 * Floating photo frames, arranged in an arc around the back of the island,
 * timeline running left → right. Frames near the middle float higher to clear the tree.
 */
export const framePositions = (() => {
  const n = Math.min(memories.length, MAX_FRAMES)
  if (n === 0) return []
  const spread = THREE.MathUtils.degToRad(Math.min(105, 25 + n * 8))
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const a = -spread + t * spread * 2 // 0 = straight behind the tree
    const r = 6.7
    const y = 3.2 + 1.9 * Math.cos(a) ** 2 + (i % 2 ? -0.3 : 0.3)
    return v(Math.sin(a) * r, y, -Math.cos(a) * r)
  })
})()
export const frameLookAt = v(0, 3.4, 2.5)

export const areas = {
  intro: v(0, 70, 60),
  distance: v(72, 14, -34),
  finale: v(0, 230, 0),
  constellation: v(34, 40, -62),
  future: v(-84, 22, -36),
  finalRoom: v(0, 140, -170),
}

/** Dream worlds behind the portal, in a gentle arc (local to areas.future). */
export const futureWorldPositions = futureWorlds.worlds.map((_, i, all) => {
  const t = all.length === 1 ? 0 : i / (all.length - 1) - 0.5
  return v(t * 16, Math.sin((i / Math.max(1, all.length - 1)) * Math.PI) * 0.8, -Math.abs(t) * 5)
})

/** Memory Lane: a gentle curve of floating lanterns drifting away from the island's left side. */
export const laneCurve = new THREE.CatmullRomCurve3([
  v(-6.9, 0.25, 2.6),
  v(-9.6, 0.8, 5.4),
  v(-13.0, 1.6, 7.2),
  v(-16.8, 2.4, 7.0),
  v(-20.2, 3.2, 4.8),
  v(-22.6, 4.0, 1.4),
  v(-23.8, 4.8, -2.6),
])

export const lanePoints = (() => {
  const n = memoryLane.milestones.length
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => laneCurve.getPointAt(n === 1 ? 0 : i / (n - 1)))
})()

/** Constellation stars sit on a heart outline (local to areas.constellation). */
export const starPositions = (() => {
  const n = constellation.reasons.length
  return Array.from({ length: n }, (_, i) => {
    // start at the dip of the heart and walk around it
    const [x, y] = heartPoint((i / n) * Math.PI * 2)
    const wobble = ((i * 37) % 7) / 7 - 0.5
    return v(x * 5.2, y * 5.2, wobble * 0.8)
  })
})()

/**
 * Hidden hearts. `group` says which part of the scene they belong to (so they move with it);
 * positions are local to that group.
 */
export const hiddenHeartSpots = [
  { group: 'island', position: ground(-0.72, -2.42, 0.13) }, // behind the blossom tree
  { group: 'island', position: ground(-2.6, -3.9, 0.1) }, // among the far flowers
  { group: 'sky', position: v(8.4, -0.25, -2.6) }, // on a tiny floating rock
  { group: 'distance', position: v(10.35, 1.0, 0.95) }, // on her island under the same sky
  { group: 'constellation', position: v(6.8, -4.6, 0.6) }, // just beside the heart of stars
]

/**
 * Camera poses. Each one has a target, a viewing direction and the width/height of what must fit.
 * The final distance adapts to the screen's aspect ratio so phones in portrait see the whole subject.
 */
const pose = (target, dir, fitW, fitH, minDist = 0) => ({ target, dir: dir.normalize(), fitW, fitH, minDist })

export const poses = {
  intro: pose(areas.intro.clone().add(v(0, -1.5, 0)), v(0, 0, 1), 4.6, 8.4, 12),
  enterMid: pose(v(0, 1.5, 0), v(0.15, 0.85, 1), 26, 20, 26),
  explore: pose(v(0, 1.6, 0), v(0, 0.36, 1), 11.5, 9.5, 15),
  memories: pose(v(0, 4.0, -1.6), v(0, 0.05, 1), 20, 6.5, 11),
  letter: pose(
    spots.table.clone().add(v(0, 1.0, 0)),
    v(spots.table.x, Math.hypot(spots.table.x, spots.table.z) * 0.8, spots.table.z),
    1.9,
    1.7,
    2.6,
  ),
  distance: pose(areas.distance.clone().add(v(0, 0.8, 0)), v(0, 0.18, 1), 24, 11, 20),
  finale: pose(areas.finale.clone(), v(0, 0, 1), 10.5, 10, 16),
  capsule: pose(spots.capsule.clone().add(v(0, 0.3, 0)), v(-0.35, 0.55, 1), 1.7, 1.4, 2.4),
  constellation: pose(areas.constellation.clone(), v(0, -0.16, 1), 14, 12.5, 19),
  timemachine: pose(spots.timeMachine.clone().add(v(0, 1.0, 0)), v(-0.2, 0.42, 1), 2.6, 2.4, 3.6),
  reactor: pose(reactorPosition.clone().add(v(0, -0.6, 0)), v(0, 0.12, 1), 6, 6.5, 8),
  finalRoom: pose(areas.finalRoom.clone().add(v(0, 1.6, 0)), v(0, 0.12, 1), 9, 6.5, 9),
  future: pose(areas.future.clone(), v(0, 0.2, 1), 22, 8, 16),
}

/** Camera for one dream world. */
export function futurePose(index) {
  const p = futureWorldPositions[index]
  if (!p) return poses.future
  return pose(p.clone().add(areas.future).add(v(0, 0.3, 0)), v(0, 0.22, 1), 4.6, 4.6, 6)
}

/** Camera for one lantern on the Memory Lane: outside the lane, looking back toward the island. */
export function lanePose(index) {
  const p = lanePoints[index]
  if (!p) return poses.explore
  const dir = v(p.x, 0, p.z).normalize().add(v(0, 0.42, 0))
  return pose(p.clone().add(v(0, 0.2, 0)), dir, 3.6, 3.6, 4.4)
}

export function framePose(index) {
  const p = framePositions[index]
  if (!p) return poses.memories // more photos than floating frames: stay on the overview
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
