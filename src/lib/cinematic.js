import * as THREE from 'three'
import { areas, littleSpots, loveTree, poses, resolvePose } from './layout'
import { ISLAND_LIFT } from './layout'

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

/** Camera position + target at time t (seconds since the cinematic started). */
export function cinematicCamera(t, aspect, fov) {
  const star = littleSpots[4] || v(0, 0.4, 7)
  const photo = littleSpots[0] || v(-6, 0.3, 1)
  if (t < SCENES[1].from) {
    // Scene 1 — the meadow and the garden, where the little things were found
    const k = ease(t / 9)
    const pos = v(0.5, 5.5, 15).lerp(v(-2.4, 3.6, 6.2), k)
    const tgt = star.clone().add(v(0, 1.5, -1)).lerp(photo.clone().add(v(0, 1, 0)), k)
    return { pos, tgt }
  }
  if (t < SCENES[2].from) {
    // Scene 2 — along the restored bridge between the two islands
    const k = ease((t - 9) / 9)
    const pos = D.clone().add(v(-11, ISLAND_LIFT + 3.2, 9).lerp(v(6, ISLAND_LIFT + 3.6, 10), k))
    const tgt = D.clone().add(v(-6, ISLAND_LIFT + 1.2, 0).lerp(v(5, ISLAND_LIFT + 1.4, 0), k))
    return { pos, tgt }
  }
  if (t < SCENES[3].from) {
    // Scene 3 — slowly around the Love Tree as it blooms and the stars rise
    const k = ease((t - 18) / 9)
    const a = 0.4 + k * 1.4
    const r = 7.5 - k * 1.8
    const pos = loveTree.clone().add(v(Math.sin(a) * r, 2.2 + k * 2.4, Math.cos(a) * r))
    const tgt = loveTree.clone().add(v(0, 2.6 + k * 3, 0))
    return { pos, tgt }
  }
  // Scene 4 — pull back until the whole little universe is in view
  const k = ease(Math.min(1, (t - 27) / 8))
  const wide = resolvePose(poses.epilogue, fov, aspect)
  const start = loveTree.clone().add(v(2.5, 6, 7))
  return { pos: start.lerp(wide.position, k), tgt: loveTree.clone().add(v(0, 4, 0)).lerp(wide.target, k) }
}
