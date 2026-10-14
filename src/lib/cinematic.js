import * as THREE from 'three'
import { areas, littleSpots, loveTree, poses, resolvePose } from './layout'
import { ISLAND_LIFT } from './layout'
import { isoBack, isoDir, LENS } from './iso'

/*
 * FINAL CINEMATIC — "You were the meaning all along".
 * Four scenes; the camera, the captions and the effects all read the same timeline.
 */
export const SCENES = [
  { from: 0, to: 9 }, // the little things
  { from: 9, to: 18 }, // the connections (the bridge between the islands)
  { from: 18, to: 27 }, // the future (the Love Tree)
  { from: 27, to: 37 }, // the whole universe + title
]
export const CINE_LENGTH = 37
export const TITLE_AT = 29.5

/** Shared clock: set when the cinematic starts (r3f clock seconds). */
export const cine = { t0: null }
export const cineTime = (clockSeconds) => (cine.t0 === null ? 0 : clockSeconds - cine.t0)

const v = (x, y, z) => new THREE.Vector3(x, y, z)
const ease = (t) => t * t * (3 - 2 * t)
const D = areas.distance

/** Camera at `dist` (as framed through a 30° lens) from `target` along the flat 2D direction (elevation in degrees, small azimuth drift). */
const isoShot = (target, dist, elevation, drift = 0) => ({ pos: target.clone().addScaledVector(isoDir(elevation, drift), dist * LENS), tgt: target })

/**
 * Camera position + target at time t (seconds since the cinematic started).
 * The whole cinematic keeps the island's flat 2D angle: it only pans, zooms and lowers a little.
 */
export function cinematicCamera(t, aspect, fov) {
  const star = littleSpots[4] || v(0, 0.4, 7)
  const photo = littleSpots[0] || v(-6, 0.3, 1)
  const portrait = aspect < 0.8 ? 1.45 : 1
  if (t < SCENES[1].from) {
    // Scene 1 — a slow pan from the meadow to the garden, where the little things were found
    const k = ease(t / 9)
    const tgt = star.clone().add(v(0, 0.8, 0)).lerp(photo.clone().add(v(0, 0.9, 0)), k)
    return isoShot(tgt, (17 - k * 5) * portrait, 48 - k * 8)
  }
  if (t < SCENES[2].from) {
    // Scene 2 — along the restored bridge between the two islands
    const k = ease((t - 9) / 9)
    const tgt = D.clone().add(v(-6, ISLAND_LIFT + 1.0, 0).lerp(v(5, ISLAND_LIFT + 1.2, 0), k))
    return isoShot(tgt, (19 - k * 3) * portrait, 36)
  }
  if (t < SCENES[3].from) {
    // Scene 3 — closer and lower toward the Love Tree as it blooms and the stars rise; she stands at its foot
    const k = ease((t - 18) / 9)
    const tgt = loveTree.clone().addScaledVector(isoBack, 1.4 * (1 - k)).add(v(0, 1.6 + k * 4.6, 0))
    return isoShot(tgt, (15 + k * 6) * portrait, 40 - k * 22)
  }
  // Scene 4 — pull back until the whole little universe is in view (same angle, just further away)
  const k = ease(Math.min(1, (t - 27) / 8))
  const wide = resolvePose(poses.epilogue, fov, aspect)
  const startTgt = loveTree.clone().add(v(0, 6.2, 0))
  const start = isoShot(startTgt, 21 * portrait, 18)
  return { pos: start.pos.lerp(wide.position, k), tgt: startTgt.lerp(wide.target, k) }
}
