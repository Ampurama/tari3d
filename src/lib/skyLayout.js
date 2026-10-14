import * as THREE from 'three'
import { EAST_BRIDGE, HOP_PLATFORMS, SKY, skyIslandHeight } from './terrain'

/*
 * SKY ISLAND — where everything is. Positions are written relative to the island's centre
 * (x east, z south) and turned into world space here.
 */

export const sky = (x, z) => [SKY.x + x, SKY.z + z]
/** A point on Sky Island's ground (world space). */
export const skyPoint = (x, z, lift = 0) => {
  const [wx, wz] = sky(x, z)
  return new THREE.Vector3(wx, skyIslandHeight(wx, wz) + lift, wz)
}

/** The five places on the island (for the area name that appears when you walk in). */
export const AREAS = [
  { id: 'dock', name: 'Sky Dock', at: [-6.8, 0], r: 2.4 },
  { id: 'garden', name: 'Cloud Garden', at: [-1.8, -5.4], r: 3.4 },
  { id: 'observatory', name: 'Star Observatory', at: [5.8, -1.6], r: 2.6 },
  { id: 'hop', name: 'Cloud Hop', at: [2.6, 7.4], r: 2.4 },
  { id: 'moment', name: 'Our Little Moment', at: [-5.6, 5.4], r: 2.0 },
]

/** The dock where the east bridge arrives. */
export const DOCK = { at: [EAST_BRIDGE.bx - SKY.x + 0.9, EAST_BRIDGE.bz - SKY.z] }

/** The gazebo in the Cloud Garden, and the bench at the sunset spot (looking west to the main island). */
export const GAZEBO = { at: [-1.8, -6.0], r: 1.7 }
export const SUNSET_BENCH = { at: [-5.6, -5.4], yaw: -Math.PI / 2 - 0.35 }

/** The telescope on the observatory platform. */
export const OBSERVATORY = { at: [6.0, -1.6], scope: [6.7, -2.3] }

/** The eight hidden stars (id → where; y is how high above the ground, or above a cloud). */
export const OBS_STARS = {
  obs1: { at: [-8.0, 1.7], lift: 0.5 },
  obs2: { at: [-1.8, -6.0], lift: 1.3 },
  obs3: { at: [-6.6, -6.4], lift: 0.4 },
  obs4: { at: [7.2, -3.6], lift: 0.6 },
  obs5: { at: [7.3, 2.9], lift: 0.4 },
  obs6: { at: [-6.1, 6.4], lift: 0.5 },
  obs7: { at: [0.9, 2.6], lift: 0.4 },
  obs8: { cloud: 2, lift: 0.5 },
}
export const OBS_IDS = Object.keys(OBS_STARS)
/** World position of a hidden star. */
export function obsStarPos(id) {
  const s = OBS_STARS[id]
  if (s.cloud !== undefined) {
    const p = HOP_PLATFORMS[s.cloud]
    return new THREE.Vector3(p.x + 0.35, p.y + s.lift, p.z - 0.2)
  }
  return skyPoint(s.at[0], s.at[1], s.lift)
}
/** Stars needed for the star lamp, and for Our Little Moment. */
export const STAR_LAMP_AT = 4

/* ───────── Cloud Hop ───────── */

/** Where a round starts (on the island), and the checkpoints: 0 start, 1–2 on the way, 3 the goal. */
export const HOP_START = [2.4, 7.6]
export const CHECKPOINTS = [
  { kind: 'start' },
  { kind: 'cloud', index: 2 },
  { kind: 'cloud', index: 5 },
  { kind: 'cloud', index: HOP_PLATFORMS.length - 1 },
]
export const GOAL_CP = CHECKPOINTS.length - 1
/** Where to stand at a checkpoint (and where you come back to after a fall). */
export function checkpointPos(i) {
  const c = CHECKPOINTS[Math.max(0, Math.min(GOAL_CP, i))]
  if (c.kind === 'start') return skyPoint(...HOP_START)
  const p = HOP_PLATFORMS[c.index]
  return new THREE.Vector3(p.x, p.y, p.z)
}
/** Which checkpoint is at (x, z), if any. */
export function checkpointAt(x, z) {
  for (let i = 1; i < CHECKPOINTS.length; i++) {
    const p = HOP_PLATFORMS[CHECKPOINTS[i].index]
    if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r * 0.9) ** 2) return i
  }
  return -1
}

/** The five Cloud Hop stars (shared in a round): on clouds, and one in the air between two. */
export const HOP_STARS = {
  h1: { cloud: 1, lift: 0.55 },
  h2: { cloud: 3, lift: 0.55 },
  h3: { cloud: 4, lift: 0.55 },
  h4: { between: [5, 6], lift: 1.05 },
  h5: { cloud: 6, lift: 0.55 },
}
export const HOP_STAR_IDS = Object.keys(HOP_STARS)
export function hopStarPos(id) {
  const s = HOP_STARS[id]
  if (s.between) {
    const a = HOP_PLATFORMS[s.between[0]]
    const b = HOP_PLATFORMS[s.between[1]]
    return new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + s.lift, (a.z + b.z) / 2)
  }
  const p = HOP_PLATFORMS[s.cloud]
  return new THREE.Vector3(p.x, p.y + s.lift, p.z)
}

/* ───────── Our Little Moment ───────── */

/** A quiet corner in the south-west, behind a ring of hedges with one small gap. */
export const MOMENT = { at: [-5.6, 5.4], bench: [-6.5, 5.6], benchYaw: -Math.PI / 2 + 0.25, photo: [-5.0, 4.8], board: [-4.6, 6.5] }

/** The waterfall off the north-east edge. */
export const WATERFALL = { at: [5.4, -7.5], dir: Math.atan2(5.4, -7.5) }
