import { create } from 'zustand'
import { partner, presence, useCouple } from './couple'
import { player } from './player'
import { serverNow } from './clock'
import { uid } from './uid'
import { walkable } from './terrain'
import {
  act,
  CANDLE_MARK,
  doStep,
  floorOf,
  floorY,
  furniture,
  has,
  lastAct,
  LANTERNS,
  mateActs,
  MX,
  MZ,
  myActs,
  onRunChange,
  roomAt,
  ROOMS,
  toLocal,
  toWorld,
  useMansion,
} from './mansion'
import { BOSS, LINES } from './mansionStory'
import { useStore } from '../store'
import { audio } from '../audio/engine'

/*
 * THE MANSION'S GHOSTS — who they are, what they do, and how both screens see the same ghosts.
 *
 * One of you runs the ghosts (the "haunt host"): whoever is on the mansion's grounds, or — when you're
 * both there — the one with the smaller account id (both games work that out the same way). The host's
 * game decides where each ghost floats and what it's doing, picks the scares, and runs the boss; all of
 * that travels with the host's character (presence.haunt), and the other game draws exactly that,
 * smoothed. If the host leaves the grounds or the connection drops, the other game simply takes over
 * from the last thing it was shown, so the ghosts never jump back to the start.
 *
 * Without a partner (or offline) you're always the host: the house plays the same, alone.
 *
 * The ghosts (each a little state machine; states are numbers so they travel small):
 *   Mimi (shy)        0 idle · 1 vanishing · 2 appearing · 3 blushing (she'll talk if you came slowly)
 *   Si Buntut (stalker, basement) 0 wander · 1 following · 2 frozen (you looked) · 3 tripped · 4 dizzy (hit a wall) · 5 lost you
 *   Pak Dor (jump scare) 0 away · 1 popping out
 *   Usil (trickster)  0 wander · 1 giggling · 2 doing a trick (k: how many times he's moved the dolls)
 *   Cici (scared)     0 wander · 1 fleeing · 2 calming down · 3 a friend, following · 4 hiding with you
 *   Pak Penjaga (library guard) 0 guarding · 1 dancing to the gramophone · 2 resigned (reading)
 *   Opa Muram (boss, attic)     0 asleep · 1 waking · 2 fighting · 3 weakened · 4 calm
 */

export const GHOST_IDS = ['mimi', 'buntut', 'dor', 'usil', 'cici', 'penjaga', 'opa']
const W = (lx, lz) => toWorld(lx, lz)
const randIn = (a, b) => a + Math.random() * (b - a)
const now = () => serverNow() / 1000

/* ───────── how scary (each person chooses for themselves; the host goes with the gentler one) ───────── */

const PREFS = 'our-little-universe:haunt'
const loadPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(PREFS)) || {}
  } catch {
    return {}
  }
}
export const INTENSITY = ['santai', 'normal', 'seru']
export const INTENSITY_LABEL = { santai: 'Santai (tanpa kejutan)', normal: 'Normal', seru: 'Seru' }
export const useHaunt = create(() => {
  const p = loadPrefs()
  return { intensity: INTENSITY.includes(p.intensity) ? p.intensity : 'normal', volume: typeof p.volume === 'number' ? p.volume : 0.8 }
})
export function setHauntPref(patch) {
  useHaunt.setState(patch)
  try {
    localStorage.setItem(PREFS, JSON.stringify(useHaunt.getState()))
  } catch {
    // private window
  }
  audio.setHauntVolume?.(useHaunt.getState().volume)
}
audio.setHauntVolume?.(useHaunt.getState().volume)
const myLevel = () => INTENSITY.indexOf(useHaunt.getState().intensity)
export const gentle = () => myLevel() === 0

/* ───────── who runs the ghosts ───────── */

const mateIn = () => partner.online && partner.haunt?.in === 1
export function amHost() {
  if (!useMansion.getState().onGrounds) return false
  if (!mateIn()) return true
  const me = useCouple.getState().me?.id || ''
  const mate = useCouple.getState().mate?.id || ''
  return me < mate
}

/** The people in the house, for the ghosts: { x, y, z, yaw, speed, hidden, me } */
function people() {
  const out = [{ x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, speed: player.speed, hidden: Boolean(player.hide), me: true }]
  if (mateIn() && partner.shown.ok)
    out.push({ x: partner.shown.x, y: partner.shown.y, z: partner.shown.z, yaw: partner.shown.yaw, speed: partner.shown.speed, hidden: partner.hide?.kind === 'hide', me: false })
  return out
}
const onFloor = (ps, f) => ps.filter((p) => !p.hidden && floorOf(p.y) === f && roomAt(p.x, p.y, p.z))
const nearest = (ps, x, z) => {
  let best = null
  let bd = Infinity
  for (const p of ps) {
    const d = Math.hypot(p.x - x, p.z - z)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best ? { p: best, d: bd } : null
}
/** Is p looking toward (x, z)? */
const looking = (p, x, z, cos = 0.72) => {
  const d = Math.hypot(x - p.x, z - p.z) || 1
  return (Math.sin(p.yaw) * (x - p.x) + Math.cos(p.yaw) * (z - p.z)) / d > cos
}

/* ───────── the ghosts' own state (the host simulates it; everyone draws `shown`) ───────── */

const MIMI_SPOTS = [
  [-0.9, 3.9],
  [-5.6, 1.5],
  [-3.6, -1.7],
  [1.0, 1.6],
  [-5.2, 3.5],
  [-3.4, -3.9],
]
const BUNTUT_PATROL = [
  [0, 4.2],
  [0, -4.2],
  [4.6, -0.6],
  [5.6, 3.6],
  [0, 0],
  [-4.4, -2.4],
  [-4.4, 1.4],
]
const USIL_SPOTS = [
  [-4.6, -2.2],
  [4.2, 1.4],
  [-4.4, 1.8],
  [0.2, 2.6],
  [-5.8, -2.6],
  [3.8, 3.8],
]
const CICI_ROOMS = ['living', 'kitchen', 'foyer']
const GUARD_SPOT = [2.75, -2.5]
const GRAMO_SPOT = [5.9, -0.95]
const OPA_HOME = [0.8, -3.5]

const ghost = (id, f, [lx, lz], extra = {}) => {
  const [x, z] = W(lx, lz)
  return { id, f, x, z, y: floorY(f), yaw: 0, st: 0, op: id === 'dor' ? 0 : 1, k: 0, t: 0, tx: x, tz: z, ...extra }
}
const sim = {
  mimi: ghost('mimi', 'G', MIMI_SPOTS[0], { spot: 0 }),
  buntut: ghost('buntut', 'B', BUNTUT_PATROL[0], { leg: 0, bonkAt: 0, tripAt: 0 }),
  dor: ghost('dor', 'G', [1.45, 0.9]),
  usil: ghost('usil', 'G', USIL_SPOTS[0], { spot: 0, trickAt: 0 }),
  cici: ghost('cici', 'G', [-4.0, 2.0], { still: 0 }),
  penjaga: ghost('penjaga', 'G', GUARD_SPOT),
  opa: ghost('opa', 'A', OPA_HOME),
}
/** Where each ghost is drawn (smoothed; on the host it is the simulation itself). */
export const shown = Object.fromEntries(GHOST_IDS.map((id) => [id, { ...sim[id] }]))
/** The boss's fight: phase (0…4 as above), lit (bit per lantern), aim (the lantern he's going for, −1), wind (0…1, his huff) */
export const boss = { phase: 0, lit: 0, aim: -1, wind: 0, blowAt: 0, roarAt: 0 }

const toward = (g, tx, tz, speed, dt) => {
  const dx = tx - g.x
  const dz = tz - g.z
  const d = Math.hypot(dx, dz)
  if (d < 1e-3) return 0
  const s = Math.min(d, speed * dt)
  g.x += (dx / d) * s
  g.z += (dz / d) * s
  turn(g, Math.atan2(dx, dz), dt * 6)
  return d - s
}
const turn = (g, yaw, k) => {
  let dy = yaw - g.yaw
  dy = Math.atan2(Math.sin(dy), Math.cos(dy))
  g.yaw += dy * Math.min(1, k)
}
const fade = (g, to, dt, speed = 2) => {
  g.op += Math.sign(to - g.op) * Math.min(Math.abs(to - g.op), dt * speed)
}
/** Keep a ghost inside the rooms it haunts (building-local rectangles). */
function keepIn(g, rooms) {
  const [lx, lz] = toLocal(g.x, g.z)
  let best = null
  let bd = Infinity
  for (const id of rooms) {
    const r = ROOMS[id]
    const cx = Math.min(r.x1 - 0.4, Math.max(r.x0 + 0.4, lx))
    const cz = Math.min(r.z1 - 0.4, Math.max(r.z0 + 0.4, lz))
    const d = Math.hypot(cx - lx, cz - lz)
    if (d < bd) {
      bd = d
      best = [cx, cz]
    }
  }
  if (best && bd > 0) [g.x, g.z] = W(best[0], best[1])
}

/** Ask for a step once at a time (the host's ghosts may ask every frame otherwise). */
const asking = new Set()
function once(step) {
  if (asking.has(step) || has(step)) return
  asking.add(step)
  Promise.resolve(doStep(step)).finally(() => setTimeout(() => asking.delete(step), 1500))
}
const pick = (list) => list[Math.floor(Math.random() * list.length)]
/** A short line said by a ghost near me (a speech bubble, MansionGhosts draws it). */
export const bubbles = {}
export function bubble(id, text, ms = 2600) {
  bubbles[id] = { text, until: performance.now() + ms }
}

function stepMimi(g, ps, dt) {
  g.t += dt
  g.y = floorY('G') + 0.25 + Math.sin(g.t * 1.6) * 0.06
  const n = nearest(onFloor(ps, 'G'), g.x, g.z)
  if (g.st === 1) {
    fade(g, 0, dt, 1.8)
    if (g.op <= 0) {
      // reappear somewhere far from everyone
      let best = g.spot
      let bd = -1
      MIMI_SPOTS.forEach(([lx, lz], i) => {
        const [x, z] = W(lx, lz)
        const d = Math.min(...ps.map((p) => Math.hypot(p.x - x, p.z - z)))
        if (i !== g.spot && d > bd) {
          bd = d
          best = i
        }
      })
      g.spot = best
      ;[g.x, g.z] = W(...MIMI_SPOTS[best])
      g.st = 2
      g.t = 0
    }
    return
  }
  if (g.st === 2) {
    fade(g, 1, dt, 1.2)
    if (g.op >= 1 && g.t > 2.5) g.st = 0
    return
  }
  fade(g, 1, dt)
  if (n) {
    turn(g, Math.atan2(n.p.x - g.x, n.p.z - g.z) + (g.st === 3 ? Math.sin(g.t * 2) * 0.6 : 0), dt * 3)
    // running at her, or coming right up close: gone
    if ((n.d < 4.2 && n.p.speed > 2.6) || n.d < 1.0) {
      g.st = 1
      g.t = 0
      if (n.p.me) bubble('mimi', pick(LINES.mimiRun), 1800)
      audio.hauntSfx?.('whoosh', { at: [g.x, g.z], gain: 0.5 })
      return
    }
    g.st = n.d < 2.9 && n.p.speed < 1.3 ? 3 : 0
  } else g.st = 0
}

function stepBuntut(g, ps, dt) {
  g.t += dt
  const here = onFloor(ps, 'B')
  const n = nearest(here, g.x, g.z)
  const t = now()
  g.y = floorY('B') + 0.25
  fade(g, g.st === 2 ? 0.75 : 1, dt)
  if (g.st === 3 || g.st === 4 || g.st === 5) {
    // tripped, dizzy, or lost: a moment to get over it
    if (g.t > (g.st === 3 ? 1.4 : g.st === 4 ? 2.4 : 2.0)) {
      g.st = n ? 1 : 0
      g.t = 0
    }
    if (g.st === 4) g.yaw += dt * 9
    return
  }
  if (g.charge) {
    // the wrong way, at full speed, into the wall
    if (toward(g, g.charge[0], g.charge[1], 3.4, dt) < 0.05) {
      g.charge = null
      g.st = 4
      g.t = 0
      bubble('buntut', pick(LINES.buntutBonk), 2400)
      audio.hauntSfx?.('bonk', { at: [g.x, g.z] })
    }
    return
  }
  if (!n) {
    if (g.st === 1) {
      g.st = 5 // where did they go?
      g.t = 0
      return
    }
    g.st = 0
    const [px, pz] = W(...BUNTUT_PATROL[g.leg])
    if (toward(g, px, pz, 0.9, dt) < 0.1) g.leg = (g.leg + 1) % BUNTUT_PATROL.length
    return
  }
  // looked at: freeze (and pretend to be a coat rack)
  if (looking(n.p, g.x, g.z) && n.d < 9) {
    if (g.st !== 2) g.t = 0
    g.st = 2
    return
  }
  g.st = 1
  if (n.d > 4.6) toward(g, n.p.x, n.p.z, 1.7, dt)
  else if (n.d < 3.2) toward(g, g.x + (g.x - n.p.x), g.z + (g.z - n.p.z), 1.2, dt)
  else turn(g, Math.atan2(n.p.x - g.x, n.p.z - g.z), dt * 5)
  keepIn(g, ['hall', 'boiler', 'cellar', 'vault'])
  // now and then: a trip over nothing, or a charge at the wrong thing
  if (t > g.tripAt) {
    g.tripAt = t + randIn(18, 34)
    if (g.t > 4) {
      g.st = 3
      g.t = 0
      bubble('buntut', pick(LINES.buntutTrip), 2200)
      audio.hauntSfx?.('trip', { at: [g.x, g.z] })
      return
    }
  }
  if (t > g.bonkAt) {
    g.bonkAt = t + randIn(30, 50)
    if (g.t > 6) {
      const [lx, lz] = toLocal(g.x, g.z)
      // the wall away from her
      const wx = lx > 0 ? 6.8 : -6.8
      g.charge = W(Math.abs(lx) > 2 ? wx : lx, lz > 0 ? 4.8 : -4.8)
    }
  }
}

function stepDor(g, dt) {
  g.t += dt
  if (g.st === 1) {
    fade(g, 1, dt, 9)
    if (g.t > 1.3) g.st = 0
  } else fade(g, 0, dt, 2.5)
}
/** Pak Dor pops out at world (x, z) on storey f. */
function popDor(x, z, f, yaw = 0) {
  const g = sim.dor
  g.x = x
  g.z = z
  g.f = f
  g.y = floorY(f) + 0.15
  g.yaw = yaw
  g.st = 1
  g.t = 0
}

function stepUsil(g, ps, dt) {
  g.t += dt
  const t = now()
  g.y = floorY('G') + 0.3 + Math.sin(g.t * 2.3) * 0.08
  fade(g, g.st === 2 ? 0.55 : 1, dt)
  const n = nearest(onFloor(ps, 'G'), g.x, g.z)
  if (g.st === 2) {
    // moving the dolls (only while nobody's watching them)
    if (g.t > 1.6) {
      g.st = 0
      g.t = 0
    }
    return
  }
  if (n && n.d < 2.4) {
    if (g.st !== 1) {
      g.st = 1
      g.t = 0
      if (n.p.me) bubble('usil', pick(LINES.usil), 2600)
      audio.hauntSfx?.('giggle', { at: [g.x, g.z], gain: 0.7 })
    }
    toward(g, g.x + (g.x - n.p.x), g.z + (g.z - n.p.z), 1.4, dt)
    keepIn(g, ['living', 'kitchen', 'dolls', 'foyer'])
    return
  }
  if (g.st === 1 && g.t < 2) return
  g.st = 0
  const [sx, sz] = W(...USIL_SPOTS[g.spot])
  if (toward(g, sx, sz, 0.8, dt) < 0.1 && g.t > 6) {
    g.spot = (g.spot + 1 + Math.floor(Math.random() * 3)) % USIL_SPOTS.length
    g.t = 0
  }
  // a trick: the dolls get rearranged, but only when nobody's looking at them
  if (t > g.trickAt) {
    const shelf = W(-6.6, -2.6)
    const watched = ps.some((p) => roomAt(p.x, p.y, p.z) === 'dolls' && !p.hidden && looking(p, shelf[0], shelf[1], 0.1))
    if (!watched) {
      g.trickAt = t + randIn(25, 45)
      g.k = (g.k + 1) % 97
      g.st = 2
      g.t = 0
    } else g.trickAt = t + 3
  }
}

function stepCici(g, ps, dt) {
  g.t += dt
  const friend = has('cici')
  g.y = floorY('G') + 0.2 + Math.sin(g.t * (g.st === 1 ? 9 : 2)) * (g.st === 1 ? 0.04 : 0.07)
  if (friend) {
    // hiding with whoever is in a wardrobe on the ground floor
    const hider = ps.find((p) => p.hidden && floorOf(p.y) === 'G')
    if (hider) {
      if (g.st !== 4) bubble('cici', pick(LINES.ciciHide), 3000)
      g.st = 4
      toward(g, hider.x, hider.z, 3, dt)
      fade(g, 0.3, dt)
      return
    }
    fade(g, 1, dt)
    const n = nearest(onFloor(ps, 'G'), g.x, g.z)
    g.st = 3
    if (n && n.d > 1.7) {
      const back = n.p.yaw + Math.PI
      toward(g, n.p.x + Math.sin(back) * 1.3, n.p.z + Math.cos(back) * 1.3, Math.min(3.2, 0.8 + n.d), dt)
    } else if (n) turn(g, Math.atan2(n.p.x - g.x, n.p.z - g.z), dt * 3)
    return
  }
  fade(g, 1, dt)
  const n = nearest(onFloor(ps, 'G'), g.x, g.z)
  if (n && n.d < 3.2) {
    if (n.p.speed < 0.1) {
      // standing still: she slowly dares to stay
      g.still += dt
      g.st = 2
      turn(g, Math.atan2(n.p.x - g.x, n.p.z - g.z), dt * 2)
      if (g.still > 3) {
        g.still = 0
        once('cici')
      }
      return
    }
    g.still = 0
    if (g.st !== 1) audio.hauntSfx?.('squeal', { at: [g.x, g.z], gain: 0.6 })
    g.st = 1
    toward(g, g.x + (g.x - n.p.x) * 2, g.z + (g.z - n.p.z) * 2, 2.4, dt)
    keepIn(g, CICI_ROOMS)
    return
  }
  g.still = 0
  g.st = 0
  if (toward(g, g.tx, g.tz, 0.7, dt) < 0.1 || g.t > 9) {
    const r = ROOMS[pick(CICI_ROOMS)]
    ;[g.tx, g.tz] = W(randIn(r.x0 + 0.6, r.x1 - 0.6), randIn(r.z0 + 0.6, r.z1 - 0.6))
    g.t = 0
  }
  keepIn(g, CICI_ROOMS)
}

/** The gramophone: { at (seconds), until } while it plays (anyone's), from the shared actions. */
export function gramophone() {
  const a = lastAct('gramo', null, 60000)
  if (!a) return null
  const at = a.at / 1000
  return now() < at + (a.n || 8) ? { at, until: at + (a.n || 8) } : null
}
/** Is Pak Penjaga away from his bookcase (dancing)? The same answer on both screens: it's the clock's. */
export const guardAway = () => {
  const gm = gramophone()
  return Boolean(gm && now() > gm.at + 1.6 && now() < gm.until - 0.4)
}
function stepPenjaga(g, dt) {
  g.t += dt
  g.y = floorY('G') + 0.25 + Math.sin(g.t * 1.3) * 0.05
  fade(g, 1, dt)
  const gm = gramophone()
  if (has('bookcase') && !gm) {
    g.st = 2
    const [x, z] = W(4.6, -1.5)
    toward(g, x, z, 0.8, dt)
    turn(g, Math.PI, dt * 2)
    return
  }
  if (gm) {
    g.st = 1
    const [x, z] = W(...GRAMO_SPOT)
    if (toward(g, x, z, 3.0, dt) < 0.1) g.yaw += dt * 4
    return
  }
  g.st = 0
  const [x, z] = W(...GUARD_SPOT)
  toward(g, x, z, 2.2, dt)
  if (Math.hypot(g.x - x, g.z - z) < 0.2) turn(g, Math.PI / 2, dt * 3)
}

/* ───────── the boss ───────── */

const lanternWorld = (i) => W(...LANTERNS[i])
const guarded = (ps, i) => {
  const [x, z] = lanternWorld(i)
  return ps.some((p) => Math.hypot(p.x - x, p.z - z) < 1.3)
}
function stepOpa(g, ps, dt) {
  g.t += dt
  const t = now()
  const attic = onFloor(ps, 'A')
  g.y = floorY('A') + 0.35 + Math.sin(g.t * 1.1) * 0.08
  if (has('boss_done')) {
    boss.phase = 4
    boss.lit = 15
    boss.aim = -1
    const [x, z] = W(...OPA_HOME)
    toward(g, x, z, 1, dt)
    fade(g, 1, dt)
    return
  }
  if (!has('boss_seen') || !attic.length) {
    // nobody up there: he dozes off by his clock, and the lanterns go out
    boss.phase = 0
    boss.lit = 0
    boss.aim = -1
    boss.wind = 0
    const [x, z] = W(...OPA_HOME)
    toward(g, x, z, 1, dt)
    fade(g, 0.6, dt)
    return
  }
  fade(g, 1, dt)
  if (boss.phase === 0) {
    boss.phase = 1
    g.t = 0
    boss.blowAt = t + 7
    boss.roarAt = t + 16
  }
  if (boss.phase === 1 && g.t > 4) boss.phase = 2
  if (boss.phase === 3) {
    boss.aim = -1
    boss.wind = 0
    if (g.t > 2.5) once('boss_done')
    return
  }
  // the lanterns lit by the other person (their actions)
  for (const a of mateActs()) if (a.kind === 'lantern' && !seenLantern.has(a.id) && t * 1000 - a.at < 6000) {
    seenLantern.add(a.id)
    lightLantern(Number(a.seat))
  }
  if (boss.lit === 15) {
    boss.phase = 3
    g.t = 0
    bubble('opa', BOSS.weak[0].text, 3000)
    return
  }
  if (boss.phase !== 2) return
  const two = attic.length > 1
  if (boss.aim < 0) {
    // drift about the middle, muttering
    const a = g.t * 0.4
    const [dx, dz] = W(0.4 + Math.sin(a) * 2.4, -0.6 + Math.cos(a * 1.3) * 1.6)
    toward(g, dx, dz, 1.2, dt)
    if (t > boss.blowAt && boss.lit) {
      const lit = [0, 1, 2, 3].filter((i) => boss.lit & (1 << i))
      boss.aim = pick(lit)
      boss.wind = 0
    }
  } else {
    // going for a lantern: a big breath in, then FUUUH
    const [x, z] = lanternWorld(boss.aim)
    const left = toward(g, x + (x > MX ? -1.2 : 1.2), z + (z > MZ - 1 ? -0.8 : 0.8), 2.0, dt)
    if (left < 0.2) {
      boss.wind = Math.min(1, boss.wind + dt / 2)
      turn(g, Math.atan2(x - g.x, z - g.z), dt * 6)
      if (boss.wind >= 1) {
        if (!(boss.lit & (1 << boss.aim))) {
          // someone saved it already
        } else if (guarded(ps, boss.aim)) {
          bubble('opa', pick(BOSS.blocked), 2400)
          audio.hauntSfx?.('grumble', { at: [g.x, g.z] })
        } else {
          boss.lit &= ~(1 << boss.aim)
          bubble('opa', pick(BOSS.taunts), 2200)
          audio.hauntSfx?.('blow', { at: [x, z] })
        }
        boss.aim = -1
        boss.wind = 0
        boss.blowAt = t + (two ? randIn(7, 10) : randIn(12, 16))
      }
    }
  }
  if (t > boss.roarAt) {
    boss.roarAt = t + randIn(18, 26)
    fire('roar', 'attic', 0, true)
  }
}
const seenLantern = new Set()
/** Light lantern i (the host's game keeps the count; the other person's game asks it). */
export function lightLantern(i) {
  if (!(i >= 0 && i < 4) || boss.phase !== 2) return
  if (amHost()) {
    if (!(boss.lit & (1 << i))) {
      boss.lit |= 1 << i
      audio.hauntSfx?.('ignite', { at: lanternWorld(i) })
    }
  } else {
    act('lantern', i)
    pendingLit[i] = performance.now()
    audio.hauntSfx?.('ignite', { at: lanternWorld(i) })
  }
}
const pendingLit = {}
/** Is lantern i lit (as I see it: the host's word, or my own match struck a moment ago)? */
export const lanternLit = (i) => Boolean(boss.lit & (1 << i)) || performance.now() - (pendingLit[i] || -1e9) < 1500

/* ───────── the scares (picked by the host; played by both) ───────── */

/**
 * kinds: flicker (lights flicker) · dark (the lights go out a moment) · door (a door swings by itself) ·
 * shadow (a shadow crosses the end of a corridor) · closet (Pak Dor jumps out of a cupboard) ·
 * window (a face at a window) · steps / whisper (from one side) · float (things lift and settle) ·
 * fall (something drops) · roar (the boss) · dolls (the dolls moved)
 */
const ROOM_SCARES = {
  foyer: ['door', 'window', 'steps', 'flicker'],
  living: ['flicker', 'door', 'whisper', 'window'],
  kitchen: ['float', 'fall', 'flicker', 'steps'],
  dolls: ['whisper', 'flicker', 'window', 'fall'],
  library: ['float', 'fall', 'shadow', 'whisper'],
  corridor: ['shadow', 'steps', 'whisper', 'flicker'],
  boiler: ['dark', 'steps', 'fall'],
  hall: ['shadow', 'dark', 'steps'],
  cellar: ['whisper', 'flicker'],
  vault: ['dark', 'whisper', 'steps'],
  attic: ['flicker'],
}
/** Windows a face can appear at (building-local x, z, storey, yaw it faces). */
export const SCARE_WINDOWS = [
  [-4.4, 5.02, 'G', 0],
  [4.4, 5.02, 'G', 0],
  [-7.02, -2.4, 'G', -Math.PI / 2],
  [7.02, -2.6, 'G', Math.PI / 2],
  [-7.02, 2.6, 'G', -Math.PI / 2],
]
/** The room inside each window (a step in from it). */
const WINDOW_ROOMS = SCARE_WINDOWS.map(([lx, lz, f]) => {
  const ix = Math.abs(lx) > 6.9 ? lx - Math.sign(lx) * 0.6 : lx
  const iz = Math.abs(lz) > 4.9 ? lz - Math.sign(lz) * 0.6 : lz
  const [x, z] = toWorld(ix, iz)
  return roomAt(x, floorY(f) + 0.1, z)
})
/** The doors that may swing on their own (cosmetic, never in the way). */
export const SWING_DOORS = { living: [-2, 2.5, 'G', 'x'], kitchen: [2, 2.5, 'G', 'x'], dolls: [-4.5, 0, 'G', 'z'], vault: [-2, -2.5, 'B', 'x'], cellar: [-2, 2.5, 'B', 'x'], boiler: [2, 0, 'B', 'x'] }
const DOOR_OF_ROOM = { living: 'living', foyer: 'living', kitchen: 'kitchen', dolls: 'dolls', vault: 'vault', cellar: 'cellar', hall: 'cellar', boiler: 'boiler' }

let lastEvent = null
let eventAt = 0
let roomFirst = new Set()
let groundsSince = 0
const COOLDOWN = [80, 50, 32]

/** Fire a scare (host): it goes into my character for the other person, and plays here. */
function fire(kind, seat, n = 0, force = false) {
  const t = now()
  if (!force && t - eventAt < 12) return
  eventAt = t
  lastEvent = { id: uid().slice(0, 12), kind, seat: seat || undefined, n, at: Math.round(serverNow()) }
  play(lastEvent)
}
function directorTick(ps) {
  const t = now()
  const s = useStore.getState()
  if (t - groundsSince < 20 || s.dialog || useMansion.getState().run.ending) return
  const level = Math.min(myLevel(), mateIn() ? partner.haunt?.p ?? 2 : 2)
  // a room seen for the first time this run: something happens there, soon
  for (const p of ps) {
    const room = roomAt(p.x, p.y, p.z)
    if (!room || p.hidden || roomFirst.has(room)) continue
    roomFirst.add(room)
    if (room === 'attic') continue
    pendingFirst = { room, at: t + randIn(2.5, 6) }
  }
  if (pendingFirst && t > pendingFirst.at) {
    const room = pendingFirst.room
    pendingFirst = null
    if (t - eventAt > 15) return scareIn(room)
  }
  // otherwise now and then, in a room someone's in
  if (t - eventAt > COOLDOWN[level] + randIn(-6, 10)) {
    const occupied = ps.filter((p) => !p.hidden).map((p) => roomAt(p.x, p.y, p.z)).filter((r) => r && r !== 'attic')
    if (occupied.length) scareIn(pick(occupied))
    else eventAt = t - COOLDOWN[level] + 5
  }
}
let pendingFirst = null
function scareIn(room) {
  const kind = pick(ROOM_SCARES[room] || ['flicker'])
  if (kind === 'window') {
    const ws = SCARE_WINDOWS.map((_, i) => i).filter((i) => WINDOW_ROOMS[i] === room)
    if (ws.length) return fire('window', room, pick(ws))
    return fire('whisper', room, Math.floor(Math.random() * 8))
  }
  if (kind === 'door') return fire('door', DOOR_OF_ROOM[room] || 'living')
  return fire(kind, room, Math.floor(Math.random() * 8))
}
/** A cupboard opened by someone (an action), the host decides if Pak Dor is in it. */
export function openedCloset(id) {
  const chance = [0, 0.45, 0.7][Math.min(myLevel(), mateIn() ? partner.haunt?.p ?? 2 : 2)]
  if (amHost() && Math.random() < chance) {
    const f = furniture(id)
    const [x, z] = W(f.x, f.z + 0.55)
    popDor(x, z, f.f, 0)
    fire('closet', id, 0, true)
    return true
  }
  if (!amHost()) act('open', id)
  return false
}

/* ───────── playing a scare (both screens; each as gentle as its player likes) ───────── */

/** What's going on, for Mansion.jsx: { [kind]: { seat, n, t0, until } } */
export const fx = {}
const seenEvents = new Set()
const FX_LEN = { flicker: 1.8, dark: 3.2, door: 3.0, shadow: 1.6, closet: 1.6, window: 0.7, float: 3.0, fall: 1.0, roar: 1.6, steps: 2.2, whisper: 2.4 }
export const useScareFx = create(() => ({ active: null }))
function play(e) {
  if (!e?.id || seenEvents.has(e.id)) return
  seenEvents.add(e.id)
  // too old (the tab slept, or it's the last scare before I arrived): skip it
  if (serverNow() - e.at > 4000) return
  const soft = gentle() || useStore.getState().reducedMotion
  const len = (FX_LEN[e.kind] || 1.5) * (soft && (e.kind === 'dark' || e.kind === 'flicker') ? 0.6 : 1)
  const t0 = performance.now() / 1000
  fx[e.kind] = { seat: e.seat, n: e.n || 0, t0, until: t0 + len, soft }
  if (['dark', 'flicker', 'closet', 'roar', 'window'].includes(e.kind)) useScareFx.setState({ active: { kind: e.kind, until: t0 + len } })
  const at = scareSpot(e)
  const muffled = Boolean(player.hide)
  const g = (soft ? 0.45 : 1) * (muffled ? 0.5 : 1)
  switch (e.kind) {
    case 'flicker':
      audio.hauntSfx?.('buzz', { at, gain: g })
      break
    case 'dark':
      audio.hauntSfx?.('lightsout', { at, gain: g })
      setTimeout(() => audio.hauntSfx?.('whisper', { at, gain: g * 0.8 }), 900)
      break
    case 'door':
      audio.hauntSfx?.('creak', { at, gain: g })
      setTimeout(() => audio.hauntSfx?.('slam', { at, gain: soft ? 0.25 : g }), 1300)
      break
    case 'shadow':
      audio.hauntSfx?.('whoosh', { at, gain: g })
      break
    case 'closet':
      if (!soft) audio.hauntSfx?.('stinger', { at, gain: g })
      audio.hauntSfx?.('boo', { at, gain: g })
      if (Math.hypot(player.position.x - at[0], player.position.z - at[1]) < 4) bubble('dor', pick(LINES.dor), 2400)
      break
    case 'window':
      if (!soft) audio.hauntSfx?.('stinger', { at, gain: g * 0.7 })
      break
    case 'steps':
      audio.hauntSfx?.('steps', { at, gain: g })
      break
    case 'whisper':
      audio.hauntSfx?.('whisper', { at, gain: g })
      break
    case 'float':
      audio.hauntSfx?.('hum', { at, gain: g })
      setTimeout(() => audio.hauntSfx?.('thud', { at, gain: g * 0.6 }), 2600)
      break
    case 'fall':
      audio.hauntSfx?.('thud', { at, gain: g })
      break
    case 'roar': {
      audio.hauntSfx?.('roar', { at, gain: g })
      bubble('opa', BOSS.roar, 1600)
      // a gust from the boss: anyone close is pushed back a step (on solid ground only)
      const o = shown.opa
      const dx = player.position.x - o.x
      const dz = player.position.z - o.z
      const d = Math.hypot(dx, dz)
      if (d < 3 && floorOf(player.position.y) === 'A' && !player.hide) {
        for (let k = 1.0; k > 0.1; k -= 0.15) {
          const nx = player.position.x + (dx / (d || 1)) * k
          const nz = player.position.z + (dz / (d || 1)) * k
          if (walkable(nx, nz)) {
            player.position.x = nx
            player.position.z = nz
            break
          }
        }
      }
      break
    }
    default:
  }
}
/** Where a scare happens (world x, z), for its sound's direction. */
function scareSpot(e) {
  if (e.kind === 'window') {
    const w = SCARE_WINDOWS[e.n] || SCARE_WINDOWS[0]
    return W(w[0], w[1])
  }
  if (e.kind === 'door') {
    const d = SWING_DOORS[e.seat] || SWING_DOORS.living
    return W(d[0], d[1])
  }
  if (e.kind === 'closet') {
    const f = furniture(e.seat)
    return f ? W(f.x, f.z) : [MX, MZ]
  }
  const r = ROOMS[e.seat]
  if (!r) return [MX, MZ]
  // a corner of the room (the sound comes from somewhere, not everywhere)
  const corner = (e.n || 0) % 4
  return W(corner % 2 ? r.x1 - 0.5 : r.x0 + 0.5, corner < 2 ? r.z0 + 0.5 : r.z1 - 0.5)
}
/** Skip what's on screen right now. */
export function skipScare() {
  const t = performance.now() / 1000
  for (const k of Object.keys(fx)) fx[k].until = Math.min(fx[k].until, t)
  useScareFx.setState({ active: null })
}
/** How bright a room's lamps are now (0…1; flickers only ever dim, ≤ 3 times a second). */
export function roomLight(room) {
  const t = performance.now() / 1000
  let k = 1
  const f = fx.flicker
  if (f && t < f.until && f.seat === room) k = Math.min(k, f.soft ? 0.75 + 0.15 * Math.sin(t * 6) : Math.sin(t * Math.PI * 2 * 2.6) > 0.2 ? 1 : 0.35)
  const d = fx.dark
  if (d && t < d.until && d.seat === room) {
    const into = (t - d.t0) / (d.until - d.t0)
    k = Math.min(k, d.soft ? 0.55 : into < 0.85 ? 0.12 : 0.12 + (into - 0.85) / 0.15)
  }
  const r = fx.roar
  if (r && t < r.until && room === 'attic') k = Math.min(k, 0.6)
  return k
}

/* ───────── every frame ───────── */

let sendAt = 0
let wasHost = false
let wasGrounds = false
export function tickGhosts(rawDt) {
  const dt = Math.min(rawDt, 0.05)
  const m = useMansion.getState()
  const t = now()
  if (m.onGrounds && !wasGrounds) groundsSince = t
  wasGrounds = m.onGrounds
  const host = amHost()
  const ending = m.run.ending
  if (host && !ending) {
    if (!wasHost) adopt() // taking over: carry on from what was shown
    const ps = people()
    stepMimi(sim.mimi, ps, dt)
    stepBuntut(sim.buntut, ps, dt)
    stepDor(sim.dor, dt)
    stepUsil(sim.usil, ps, dt)
    stepCici(sim.cici, ps, dt)
    stepPenjaga(sim.penjaga, dt)
    stepOpa(sim.opa, ps, dt)
    // cupboards the other person opened
    for (const a of mateActs()) if (a.kind === 'open' && !seenOpen.has(a.id)) {
      seenOpen.add(a.id)
      if (serverNow() - a.at < 3000) openedCloset(a.seat)
    }
    directorTick(ps)
    for (const id of GHOST_IDS) Object.assign(shown[id], sim[id])
  } else if (!host) {
    // the host's ghosts, smoothly
    const h = partner.online ? partner.haunt : null
    const k = 1 - Math.exp(-dt * 8)
    if (h?.g?.length === GHOST_IDS.length) {
      GHOST_IDS.forEach((id, i) => {
        const [x, y, z, yaw, st, op, kk] = h.g[i]
        const s = shown[id]
        const jump = Math.hypot(x - s.x, z - s.z) > 3
        s.x = jump ? x : s.x + (x - s.x) * k
        s.z = jump ? z : s.z + (z - s.z) * k
        s.y += (y - s.y) * k
        let dy = yaw - s.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        s.yaw += dy * k
        s.st = st
        s.op += (op - s.op) * Math.min(1, k * 1.5)
        s.k = kk
      })
    }
    if (h?.b) {
      boss.phase = h.b[0]
      boss.lit = h.b[1]
      boss.aim = h.b[2]
      boss.wind = h.b[3]
    }
    if (h?.e) play(h.e)
  }
  wasHost = host
  // the dolls' room: when the dolls were moved, a little creak (for whoever is near)
  if (shown.usil.k !== lastDolls) {
    if (lastDolls !== null && roomAt(player.position.x, player.position.y, player.position.z) === 'dolls') audio.hauntSfx?.('creak', { at: W(-6.6, -2.6), gain: 0.5 })
    lastDolls = shown.usil.k
  }
  // what travels with my character (~8 times a second is plenty)
  if (performance.now() - sendAt > 120) {
    sendAt = performance.now()
    presence.haunt = m.onGrounds
      ? {
          in: 1,
          p: myLevel(),
          a: myActs.filter((a) => serverNow() - a.at < 8000),
          ...(host && !ending
            ? {
                g: GHOST_IDS.map((id) => {
                  const s = sim[id]
                  return [s.x, s.y, s.z, s.yaw, s.st, s.op, s.k]
                }),
                b: [boss.phase, boss.lit, boss.aim, boss.wind],
                e: lastEvent && serverNow() - lastEvent.at < 4000 ? lastEvent : null,
              }
            : {}),
        }
      : null
  }
}
const seenOpen = new Set()
let lastDolls = null
/** Becoming the host: start from what I was shown (so nothing jumps). */
function adopt() {
  for (const id of GHOST_IDS) {
    const s = shown[id]
    Object.assign(sim[id], { x: s.x, y: s.y, z: s.z, yaw: s.yaw, st: s.st, op: s.op, k: s.k, t: 0 })
    if (id === 'dor' && s.st === 1) sim.dor.st = 0
  }
  const t = now()
  boss.blowAt = t + 6
  boss.roarAt = t + 15
  sim.buntut.tripAt = t + 15
  sim.buntut.bonkAt = t + 30
  sim.usil.trickAt = t + 20
}

/* ───────── the story, as the ghosts take it ───────── */

onRunChange(({ steps, reset }) => {
  if (reset) {
    roomFirst = new Set()
    boss.phase = 0
    boss.lit = 0
    Object.assign(sim.cici, { st: 0 })
  }
  // the basement opening: the lights in the kitchen go out a moment, and something whispers below
  if (steps.includes('basement_open') && useMansion.getState().onGrounds) {
    const e = { id: 'basement-' + (useMansion.getState().run.run_id || 'local'), kind: 'dark', seat: 'kitchen', n: 1, at: Math.round(serverNow()) }
    play(e)
  }
})

/** Is someone (me, or the other person) standing on the candle mark, or is the candle on its stand? */
export function mirrorLit() {
  const [x, z] = W(...CANDLE_MARK)
  const on = (px, py, pz) => Math.hypot(px - x, pz - z) < 0.55 && floorOf(py) === 'G'
  if (on(player.position.x, player.position.y, player.position.z)) return 'me'
  if (partner.online && partner.shown.ok && on(partner.shown.x, partner.shown.y, partner.shown.z)) return 'mate'
  if (lastAct('candle', null, 15000)) return 'stand'
  return null
}
/** The party in the wine cellar: they freeze (pretending it's a meeting) while anyone is in there. */
export function partyFrozen() {
  const ps = people()
  return ps.some((p) => roomAt(p.x, p.y, p.z) === 'cellar')
}
