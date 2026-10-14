import { create } from 'zustand'
import * as THREE from 'three'
import { player } from './player'
import { atmosphere } from './atmosphere'
import { HOPE_BRIDGE, PIER } from './terrain'
import { along, BEACH_SPOT, BRIDGE_MID, hopeLight, SWING, swingBase, swingForward, swingSide } from './westLayout'
import { openWish } from './wish'
import { useStore } from '../store'
import { audio } from '../audio/engine'
import { cutscenes, wishes } from '../content/config'

/*
 * CUTSCENES — short, quiet scenes in the western isles. One clock drives everything: the camera
 * (CameraDirector reads cutsceneCamera()), the words on screen (CutsceneOverlay), the sky, the
 * music, and whatever the scene itself does (the beach, the bridge lights).
 *
 * While one plays, the view is 'cutscene': the avatar waits where she is (sitting stays sitting),
 * the other person still sees her there, and it can be skipped any time ("Lewati", or Escape).
 * Each person's cutscene plays on their own screen only.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const UP = V(0, 1, 0)
const ease = (t) => t * t * (3 - 2 * t)

/** Camera keys → a function of time. Two keys a hair apart make a cut. */
function track(keys) {
  return (t) => {
    if (t <= keys[0].t) return keys[0]
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i]
      const b = keys[i + 1]
      if (t <= b.t) {
        const k = b.t - a.t < 0.05 ? 1 : ease((t - a.t) / (b.t - a.t))
        return { pos: a.pos.clone().lerp(b.pos, k), tgt: a.tgt.clone().lerp(b.tgt, k) }
      }
    }
    return keys[keys.length - 1]
  }
}

/* ───────── the scenes ───────── */

const SCRIPTS = {
  /** From the tip of the pier: she closes her eyes, and is on a moonlit beach where the two of you are together. */
  beach() {
    const P = player.position.clone()
    const f = V(PIER.ux, 0, PIER.uz)
    const side = V(-PIER.uz, 0, PIER.ux)
    const H = BEACH_SPOT
    const at = (x, y, z) => H.clone().add(V(x, y, z))
    return {
      duration: 49,
      music: 'quiet',
      climaxAt: 21,
      scene: [3.0, 45.5],
      flashes: [
        { at: 3.0, len: 1.6, color: 'white' },
        { at: 12.0, len: 0.5, color: 'black' },
        { at: 20.0, len: 0.5, color: 'black' },
        { at: 28.0, len: 0.5, color: 'black' },
        { at: 45.5, len: 1.8, color: 'white' },
      ],
      sky: () => ({ day: 0.08, sunset: 0.14 }),
      camera: track([
        { t: 0, pos: P.clone().addScaledVector(f, -3.2).addScaledVector(UP, 1.7), tgt: P.clone().addScaledVector(f, 6).addScaledVector(UP, 1.3) },
        { t: 3.0, pos: P.clone().addScaledVector(f, -2.4).addScaledVector(UP, 1.6), tgt: P.clone().addScaledVector(f, 8).addScaledVector(UP, 1.8) },
        { t: 3.01, pos: at(-6, 4.2, 8), tgt: at(0, 1.2, -6) },
        { t: 12, pos: at(-3, 2.2, 6), tgt: at(0, 1.2, -8) },
        { t: 12.01, pos: at(1.3, 1.6, 3.0), tgt: at(0, 1.3, -10) },
        { t: 20, pos: at(0.6, 1.5, 2.4), tgt: at(0, 1.3, -10) },
        { t: 20.01, pos: at(-2.8, 1.3, -3.2), tgt: at(-0.28, 1.0, 0) },
        { t: 28, pos: at(-1.7, 1.2, -2.7), tgt: at(-0.28, 1.0, 0) },
        { t: 28.01, pos: at(0.4, 1.9, 4.5), tgt: at(0, 1.5, -8) },
        { t: 41, pos: at(0, 7, 14), tgt: at(0, 5, -40) },
        { t: 45.5, pos: at(0, 7.4, 15), tgt: at(0, 5.4, -42) },
        { t: 45.51, pos: P.clone().addScaledVector(f, 2.6).addScaledVector(side, 0.9).addScaledVector(UP, 1.5), tgt: P.clone().addScaledVector(UP, 1.0) },
        { t: 49, pos: P.clone().addScaledVector(f, 2.0).addScaledVector(side, 0.6).addScaledVector(UP, 1.35), tgt: P.clone().addScaledVector(UP, 1.0) },
      ]),
      lines: cutscenes.beach.lines,
      // back on the pier, her letter is waiting
      onEnd: () => setTimeout(() => openWish(wishes.pier), 400),
    }
  },

  /** You're each at one end of the arched bridge: its lights come on, end to end. */
  bridge() {
    const u = V(HOPE_BRIDGE.ux, 0, HOPE_BRIDGE.uz)
    const south = V(-HOPE_BRIDGE.uz, 0, HOPE_BRIDGE.ux).multiplyScalar(-1) // the camera's usual side
    const [ax, az] = along(HOPE_BRIDGE, 0)
    const [bx, bz] = along(HOPE_BRIDGE, 1)
    const A = V(ax, HOPE_BRIDGE.height(0), az)
    const B = V(bx, HOPE_BRIDGE.height(1), bz)
    const M = BRIDGE_MID
    const p = (base, s, up, a = 0) => base.clone().addScaledVector(south, s).addScaledVector(UP, up).addScaledVector(u, a)
    let lit = false
    return {
      duration: 21,
      music: 'miles',
      climaxAt: 11,
      flashes: [
        { at: 9.6, len: 0.45, color: 'black' },
        { at: 15.4, len: 0.45, color: 'black' },
      ],
      sky: (t) => ({ day: 0.22 + 0.6 * (t / 21), sunset: 0.3 + 0.55 * (t / 21) }),
      camera: track([
        { t: 0, pos: p(M, 15, 5.5), tgt: M.clone().addScaledVector(UP, 0.5) },
        { t: 9.6, pos: p(M, 10, 3.5, -2), tgt: M.clone() },
        { t: 9.61, pos: p(A, 2.8, 1.4, -1), tgt: A.clone().addScaledVector(u, 2).addScaledVector(UP, 1) },
        { t: 15.4, pos: p(B, 2.8, 1.4, -1.5), tgt: B.clone().addScaledVector(u, 1).addScaledVector(UP, 1) },
        { t: 15.41, pos: p(M, 5, 9), tgt: M.clone() },
        { t: 21, pos: p(M, 4, 7.5), tgt: M.clone() },
      ]),
      lines: cutscenes.bridge.lines,
      tick: (t) => {
        // the lights come on while the camera runs along the bridge
        if (!lit && t >= 10.2) {
          lit = true
          if (!hopeLight.litAt) hopeLight.litAt = performance.now()
        }
      },
      onEnd: () => {
        if (!hopeLight.litAt) hopeLight.litAt = performance.now()
        useStore.getState().showToast('✦ Jalan ke tengah jembatan…', 4000)
      },
    }
  },

  /** You met in the middle of the bridge. */
  meet() {
    const M = BRIDGE_MID
    const keys = []
    for (let i = 0; i <= 6; i++) {
      const a = -0.6 + (i / 6) * 1.6
      keys.push({ t: (i / 6) * 13, pos: M.clone().add(V(Math.sin(a) * 4.4, 2.0 + i * 0.12, Math.cos(a) * 4.4)), tgt: M.clone().addScaledVector(UP, 1.0) })
    }
    return {
      duration: 13,
      music: 'finale',
      sky: () => ({ day: 0.6, sunset: 0.75 }),
      camera: track(keys),
      lines: cutscenes.meet.lines,
    }
  },

  /** On the swing at sunset (the two of you, or her with the glowing one beside her). */
  sunset() {
    const S = V(SWING.x, swingBase(), SWING.z)
    const f = V(swingForward[0], 0, swingForward[1])
    const side = V(swingSide[0], 0, swingSide[1])
    const p = (fw, s, up) => S.clone().addScaledVector(f, fw).addScaledVector(side, s).addScaledVector(UP, up)
    return {
      duration: 31,
      music: 'finale',
      climaxAt: 14.5,
      title: [27.6, 31],
      flashes: [
        { at: 7.0, len: 0.45, color: 'black' },
        { at: 14.4, len: 0.45, color: 'black' },
        { at: 21.0, len: 0.45, color: 'black' },
      ],
      sky: (t) => ({ day: 0.8 - 0.25 * (t / 31), sunset: 1 }),
      camera: track([
        { t: 0, pos: p(-3.4, 0.2, 1.5), tgt: p(12, 0, 1.6) },
        { t: 7, pos: p(-2.6, 0, 1.3), tgt: p(14, 0, 1.8) },
        { t: 7.01, pos: p(0.6, 3.6, 1.4), tgt: p(0, 0, 0.9) },
        { t: 14.4, pos: p(2.4, 2.8, 1.2), tgt: p(0, 0, 0.9) },
        { t: 14.41, pos: p(4.2, 0, 1.5), tgt: p(0, 0, 1.0) },
        { t: 21, pos: p(3.6, 0, 1.3), tgt: p(0, 0, 1.0) },
        { t: 21.01, pos: p(-6, 3, 7), tgt: p(10, 0, 1) },
        { t: 31, pos: p(-12, 5, 13), tgt: p(14, 0, 0.5) },
      ]),
      lines: cutscenes.sunset.lines,
    }
  },
}

/* ───────── playing ───────── */

/** What's playing: { id, script, start (ms) } */
export const cut = { id: null, script: null, start: 0, climaxed: false }
/** For the UI: which cutscene is on (re-renders only when it starts or ends). */
export const useCutscene = create(() => ({ id: null }))
/** Seconds since the cutscene began. */
export const cutTime = () => (cut.id ? (performance.now() - cut.start) / 1000 : 0)

/** Play a cutscene (only from free exploring; returns whether it started). */
export function playCutscene(id) {
  const s = useStore.getState()
  if (cut.id || s.phase !== 'world' || s.view !== 'explore' || s.curtain || s.panel || !SCRIPTS[id]) return false
  cut.id = id
  cut.script = SCRIPTS[id]()
  cut.start = performance.now()
  cut.climaxed = false
  useStore.setState({ view: 'cutscene', prompt: null, dialog: null, camNonce: s.camNonce + 1 })
  useCutscene.setState({ id })
  return true
}

/** End (or skip) the cutscene: back to exploring right where she is. */
export function endCutscene() {
  if (!cut.id) return
  const script = cut.script
  cut.id = null
  cut.script = null
  atmosphere.scene = null
  useCutscene.setState({ id: null })
  const s = useStore.getState()
  if (s.view === 'cutscene') useStore.setState({ view: 'explore', camNonce: s.camNonce + 1 })
  script?.onEnd?.()
}

/** Every frame while one plays (components/three/CutsceneDirector): sky, music, the scene's own beats, the end. */
export function tickCutscene() {
  if (!cut.id) return
  const t = cutTime()
  const sc = cut.script
  atmosphere.scene = sc.sky ? sc.sky(t) : null
  sc.tick?.(t)
  if (sc.climaxAt !== undefined && !cut.climaxed && t >= sc.climaxAt) {
    cut.climaxed = true
    audio.climax(10)
  }
  if (t >= sc.duration) endCutscene()
}

/** The camera for this moment (null when nothing plays). A portrait phone sees it from a little further back. */
export function cutsceneCamera(aspect) {
  if (!cut.id) return null
  const shot = cut.script.camera(cutTime())
  if (aspect >= 0.8) return shot
  const pos = shot.tgt.clone().add(shot.pos.clone().sub(shot.tgt).multiplyScalar(1.35))
  return { pos, tgt: shot.tgt }
}

/** Which music mood the playing cutscene wants. */
export const cutsceneMusic = () => cut.script?.music || 'quiet'
