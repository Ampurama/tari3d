import * as THREE from 'three'

/*
 * THE ISLAND CAMERA — a living miniature she can spin around.
 *
 * By default the whole island is in view from the south-ish, about 40° above the ground, with
 * a gentle perspective lens. Drag to turn it all the way around, scroll / pinch to zoom: the
 * closer she zooms, the more tightly the camera follows the avatar. Arriving on the island sweeps
 * around it once, and when she leaves it alone for a while it slowly turns by itself.
 */
export const ISO = {
  /** horizontal angle of the camera around its target (0 = from the south, looking north) */
  azimuth: 0,
  /** degrees above the ground */
  elevation: 40,
  /** vertical field of view (degrees) */
  fov: 40,
  /** lens for the 3D set pieces up in the sky */
  skyFov: 40,
  /** how far the view may be turned either way (radians) — the island spins all the way round */
  turn: Infinity,
  /** tilt range while exploring (degrees above the ground) */
  minElevation: 12,
  maxElevation: 80,
  /** seconds without input before the camera starts turning slowly by itself */
  idleSpin: 16,
  /** how much the default (fully zoomed-out) view leans toward the avatar instead of the island centre */
  follow: 0.3,
  /** closest zoom, as a fraction of the default distance */
  zoomIn: 0.22,
}

/** Live camera distances while exploring (written by the camera director, read by the follow). */
export const rig = { baseDist: 100, minDist: 36 }

/** Views that are set pieces in the sky keep a normal lens; everything else is flat 2D. */
const SKY_VIEWS = new Set(['intro', 'avatar', 'finale', 'finalRoom', 'constellation', 'future'])
export const fovFor = (view) => (SKY_VIEWS.has(view) ? ISO.skyFov : ISO.fov)

/** Distances written for a 30° lens, converted to the flat lens (same framing). */
export const LENS = Math.tan((15 * Math.PI) / 180) / Math.tan(((ISO.fov / 2) * Math.PI) / 180)

const D2R = Math.PI / 180

/** Unit vector from a target to the camera, for an elevation (degrees) and an optional azimuth offset. */
export function isoDir(elevation = ISO.elevation, azimuthOffset = 0) {
  const az = ISO.azimuth + azimuthOffset
  const el = elevation * D2R
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
}

/** Horizontal unit vector pointing from the scene toward the camera. */
export const isoBack = new THREE.Vector3(Math.sin(ISO.azimuth), 0, Math.cos(ISO.azimuth))
/** Horizontal unit vector pointing "into" the screen (away from the camera). */
export const isoForward = isoBack.clone().negate()
/** Horizontal unit vector pointing to the right of the screen. */
export const isoRight = new THREE.Vector3(-isoForward.z, 0, isoForward.x)

/** Polar angle (camera-controls convention, radians from straight up) for an elevation in degrees. */
export const polarFor = (elevation) => (90 - elevation) * D2R

/** Y rotation that makes an object whose front is +z face the camera. */
export const FACE_CAMERA = ISO.azimuth

/**
 * Would something standing at (x, z) hide the point (px, pz) from the camera?
 * `length`: how far in front of the point (toward the camera) it matters; `half`: half-width of the sight line.
 */
export function blocksView(x, z, px, pz, length = 4, half = 1.2) {
  const dx = x - px
  const dz = z - pz
  const along = dx * isoBack.x + dz * isoBack.z
  if (along < -0.4 || along > length) return false
  const side = Math.abs(dx * isoRight.x + dz * isoRight.z)
  return side < half
}
