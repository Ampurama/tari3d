import * as THREE from 'three'
import { SPAWN, standHeight } from './terrain'

/*
 * Mutable, per-frame player state shared between the controller, the camera and the
 * interaction system. It deliberately lives outside React/zustand: it changes 60 times a
 * second and nothing should re-render because the avatar took a step.
 */
export const player = {
  position: new THREE.Vector3(SPAWN.x, standHeight(SPAWN.x, SPAWN.z), SPAWN.z),
  yaw: SPAWN.yaw,
  speed: 0, // current horizontal speed (units / second)
  /** where tap-to-walk is heading, or null */
  walkTarget: null,
  /** called when tap-to-walk arrives (used to interact with what was tapped) */
  onArrive: null,
  /** a short reaction pose (e.g. when something is found): seconds remaining */
  cheer: 0,
  /** set while a cinematic or a focused view has control */
  frozen: false,
}

export function resetPlayer() {
  player.position.set(SPAWN.x, standHeight(SPAWN.x, SPAWN.z), SPAWN.z)
  player.yaw = SPAWN.yaw
  player.speed = 0
  player.walkTarget = null
  player.onArrive = null
}

/* ───────── input ───────── */

/** Movement input from keyboard + on-screen joystick, in screen space (x right, y forward), 0..1. */
export const input = {
  keys: new Set(),
  joyX: 0,
  joyY: 0,
  run: false,
  /** increments whenever the interact key/button is pressed */
  interactPresses: 0,
  /** true while the interact key/button is held down (for "hold to…" interactions) */
  interactHeld: false,
}

const MOVE_KEYS = {
  KeyW: 'f',
  ArrowUp: 'f',
  KeyS: 'b',
  ArrowDown: 'b',
  KeyA: 'l',
  ArrowLeft: 'l',
  KeyD: 'r',
  ArrowRight: 'r',
}

const typing = (e) => e.target instanceof HTMLElement && (e.target.closest('input, textarea, select') || e.target.isContentEditable)

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return
    const k = MOVE_KEYS[e.code]
    if (k) {
      input.keys.add(k)
      // keep arrow keys from scrolling anything
      if (e.code.startsWith('Arrow')) e.preventDefault()
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true
    if ((e.code === 'KeyE' || e.code === 'KeyF') && !e.repeat) {
      input.interactPresses++
      input.interactHeld = true
    }
  })
  window.addEventListener('keyup', (e) => {
    const k = MOVE_KEYS[e.code]
    if (k) input.keys.delete(k)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false
    if (e.code === 'KeyE' || e.code === 'KeyF') input.interactHeld = false
  })
  // never keep walking after the window loses focus
  window.addEventListener('blur', () => {
    input.keys.clear()
    input.run = false
    input.interactHeld = false
  })
}

/** Combined movement vector (x: right, y: forward) with magnitude 0..1, and whether to run. */
export function readMove() {
  let x = input.joyX
  let y = input.joyY
  if (input.keys.has('f')) y += 1
  if (input.keys.has('b')) y -= 1
  if (input.keys.has('r')) x += 1
  if (input.keys.has('l')) x -= 1
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  const joyLen = Math.hypot(input.joyX, input.joyY)
  return { x, y, mag: Math.min(1, len), run: input.run || joyLen > 0.92 }
}
