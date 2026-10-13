import * as THREE from 'three'
import { heightAt } from './island'
import { memories } from '../content/config'

const v = (x, y, z) => new THREE.Vector3(x, y, z)
const ground = (x, z, lift = 0) => v(x, heightAt(x, z) + lift, z)

/** Where everything lives on the main island (y is filled in from the terrain). */
export const spots = {
  tree: ground(-0.7, -1.7),
  bench: ground(-0.45, -0.35),
  table: ground(2.4, 1.2),
  telescope: ground(-3.0, 1.9),
  arch: ground(3.5, -3.55),
}

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
}

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
