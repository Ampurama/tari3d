import * as THREE from 'three'
import { finalMessage } from '../content/config'
import { loveTree } from './layout'

/*
 * FINAL CINEMATIC — "A little world made for you".
 * One quiet place (the Love Tree), one timeline: the camera, the lanterns, the bloom, the sky,
 * the captions and the final message all read the same clock.
 */
const LINE = 3.6
const lines = finalMessage.lines.filter(Boolean)

export const CINE = {
  /** the camera glides in toward the tree */
  approach: [0, 7],
  /** the island's lanterns light up one by one */
  lanterns: [7.5, 14],
  /** the tree blooms; the heart of lights rises above it */
  bloom: [13, 20],
  /** the sky turns pink, purple and gold */
  sunset: [11, 20],
  /** two quiet captions */
  captions: [2.5, 15],
  /** the title */
  title: 20.5,
  /** the final message, one line at a time */
  message: 25,
  line: LINE,
}
/** When the last line of the message is on screen (the choices appear just after). */
export const CINE_LENGTH = CINE.message + lines.length * LINE

/** Shared clock: set when the cinematic starts (r3f clock seconds). */
export const cine = { t0: null }
export const cineTime = (clockSeconds) => (cine.t0 === null ? 0 : clockSeconds - cine.t0)
/** 0..1 progress of a [from, to] window at time t. */
export const windowAt = ([from, to], t) => THREE.MathUtils.clamp((t - from) / (to - from), 0, 1)

const v = (x, y, z) => new THREE.Vector3(x, y, z)
const ease = (t) => t * t * (3 - 2 * t)
const D2R = Math.PI / 180

/** Camera at `dist` from `target`, `elevation` degrees up, `azimuth` radians around (0 = from the south). */
const shot = (target, dist, elevation, azimuth) => {
  const el = elevation * D2R
  return { pos: target.clone().add(v(Math.sin(azimuth) * Math.cos(el), Math.sin(el), Math.cos(azimuth) * Math.cos(el)).multiplyScalar(dist)), tgt: target }
}

/** Camera position + target at time t (seconds since the cinematic started). */
export function cinematicCamera(t, aspect) {
  const portrait = aspect < 0.8 ? 1.5 : 1
  if (t < CINE.approach[1]) {
    // gently in toward the tree, from the whole island to the two of them at its foot
    const k = ease(t / CINE.approach[1])
    const tgt = loveTree.clone().add(v(0, 1.4 + k * 0.6, 1.2 * k))
    return shot(tgt, (30 - k * 17) * portrait, 42 - k * 18, 0.25 * k)
  }
  // a slow half-turn around the tree while it blooms, rising to see the heart of lights above it
  const k = ease(Math.min(1, (t - CINE.approach[1]) / (CINE.title - CINE.approach[1])))
  const drift = Math.max(0, t - CINE.title) * 0.012
  const tgt = loveTree.clone().add(v(0, 2 + k * 4, 1.2 * (1 - k)))
  return shot(tgt, (13 + k * 9) * portrait, 24 - k * 10, 0.25 - k * 0.6 - drift)
}
