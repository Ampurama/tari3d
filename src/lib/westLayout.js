import * as THREE from 'three'
import { HOPE_BRIDGE, isleHeight, ISLE_A, ISLE_B, PIER } from './terrain'

/*
 * THE WESTERN ISLES — where things are (shared by the scene, its cutscenes and the camera).
 */

/** A point along a walkway (0 → 1), `side` metres to its left (+) or right (−). */
export const along = (w, t, side = 0) => [w.ax + w.ux * w.len * t - w.uz * side, w.az + w.uz * w.len * t + w.ux * side]
/** The direction a walkway runs, as a yaw. */
export const yawOf = (w) => Math.atan2(w.ux, w.uz)

/** The bridge lights (lit when you're each at one end; see components/three/WestIsles.jsx). */
export const hopeLight = { litAt: 0 }

/** The sunset garden on island B, and its swing (facing west, out over the sea). */
export const GARDEN = { x: ISLE_B.x - 0.4, z: ISLE_B.z + 0.3 }
export const SWING = { x: ISLE_B.x - 1.4, z: ISLE_B.z + 1.2, yaw: -Math.PI / 2, top: 2.25, rope: 1.75 }
export const swingState = { angle: 0, amp: 0 }
export const swingForward = [Math.sin(SWING.yaw), Math.cos(SWING.yaw)]
export const swingSide = [Math.cos(SWING.yaw), -Math.sin(SWING.yaw)]
export const swingBase = () => isleHeight(ISLE_B, SWING.x, SWING.z)

/** The tip of the pier, where she can close her eyes for a moment (the beach dimension). */
export const PIER_TIP = (() => {
  const [x, z] = along(PIER, 0.97)
  return new THREE.Vector3(x, PIER.height(1), z)
})()
/** The middle of the arched bridge (the little platform). */
export const BRIDGE_MID = (() => {
  const [x, z] = along(HOPE_BRIDGE, 0.5)
  return new THREE.Vector3(x, HOPE_BRIDGE.height(0.5), z)
})()

/** Far away from everything: the moonlit beach she dreams of (only drawn during its cutscene). */
export const BEACH = new THREE.Vector3(300, 0, 300)
/** Where she stands on that beach, looking out at the moon (−z). */
export const BEACH_SPOT = BEACH.clone().add(new THREE.Vector3(0, 0, 2))

export { ISLE_A }
