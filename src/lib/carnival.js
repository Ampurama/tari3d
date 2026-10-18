import { create } from 'zustand'
import * as THREE from 'three'
import { addCollider, blockers, obstacles, standHeight, walkable } from './terrain'
import { CARNIVAL_BOX, CARNIVAL_GATE, meadowHeight } from './meadow'
import { onRoom, partner, presence, supabase, useCouple } from './couple'
import { player } from './player'
import { serverNow } from './clock'
import { uid } from './uid'
import { hourAt, partOfDay } from './timeOfDay'
import { SEAT_DROP } from './actions'
import { addMood } from './mood'
import { refreshHouse } from './home'
import { useDate } from './date'
import { useStore } from '../store'
import { audio } from '../audio/engine'

/*
 * GNOME CARNIVAL — DREAMLIGHT FUNFAIR: the fairground east of the pond (its ground is a level pad in
 * lib/meadow.js; it's drawn by components/three/Carnival.jsx; its screens are
 * components/ui/CarnivalUI.jsx; the booth games are lib/carnivalGames.js).
 *
 * Every ride runs on the shared clock (lib/clock.js) — the roller coaster leaves the station on the
 * same second on both screens, the big wheel is at the same angle, the teacups spin together — so
 * there is no ride simulation that could disagree between the two games, and nothing about the rides
 * is sent at all. What travels with each character (presence.ride) is only which seat they're in, so
 * the other person sees them sitting in exactly that seat, moving with it.
 *
 * Riding: the ride's own entrance (or its gnome operator) puts her in a seat; while she's aboard the
 * seat carries her (holdRide, called every frame by the player controller); at the end of the ride
 * she's set down at the exit, on solid ground, with her controls back. Anything odd (the ride she's
 * in doesn't exist, the time doesn't fit, a story moment starts) gets her off at once.
 */

const BOX = CARNIVAL_BOX
export const CX = (BOX.x0 + BOX.x1) / 2
export const CZ = (BOX.z0 + BOX.z1) / 2
/** The fairground's level (its pad is flat). */
let levelY = null
export const groundLevel = () => (levelY ??= meadowHeight(CX, CZ))
const now = () => serverNow() / 1000
const toast = (text, ms = 3200) => useStore.getState().showToast(text, ms)
const smooth01 = (t) => {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

/* ───────── where everything stands (world metres; the fairground is laid out along x and z) ───────── */

export const GATE = CARNIVAL_GATE
/** The fence: just inside the box, open at the gate. */
export const FENCE = { x0: BOX.x0 + 0.3, x1: BOX.x1 - 0.3, z0: BOX.z0 + 0.3, z1: BOX.z1 - 0.3 }
export const TICKET_BOOTH = { x: 46.6, z: 24.2, spot: [46.6, 25.6] }
export const BUMPER = { x0: 47, x1: 57, z0: 15.2, z1: 22, gate: [52, 22.85], car: 0.55 }
export const WHEEL = { x: 63.5, z: 17.0, hub: 7.4, r: 6.2, n: 8, period: 72, board: [63.5, 19.3] }
export const CAROUSEL = { x: 56.5, z: 30.2, r: 3.3, n: 8, mountR: 2.35, entry: [56.5, 33.95] }
export const TEACUPS = { x: 49.6, z: 34.8, r: 3.4, n: 4, cupR: 1.85, entry: [53.35, 34.8] }
export const COASTER_ZONE = { x0: 67.0, x1: 74.0, z0: 22.0, z1: 43.7 }
export const STATION = { deck: { x0: 65.3, x1: 67.0, z0: 29.6, z1: 35.4 }, board: [66.2, 32.4] }
/** The game tents, in a row, open to the south (she plays facing them, the camera behind her). */
export const BOOTHS = [
  { id: 'ringtoss', x: 54.4, z: 38.2, title: 'Lempar Gelang', keeper: 'tara' },
  { id: 'cans', x: 58.4, z: 38.2, title: 'Robohkan Kaleng', keeper: 'bumbum' },
  { id: 'shooting', x: 62.4, z: 38.2, title: 'Tembak Sasaran', keeper: 'jepret' },
]
export const BOOTH_HALF = 1.5
/** Where she stands to play (in front of the counter). */
export const boothSpot = (b) => [b.x, b.z + 2.0]
export const KIOSK = { x: 62.0, z: 26.4, spot: [62.0, 27.9] }
export const STAGE = { x: 52.0, z: 25.4, r: 0.85 }
export const OFFICE = { id: 'office', x: 47.2, z: 40.6, hw: 1.6, hd: 1.35, enter: false, yaw: Math.PI / 2 }
export const PHOTO = { x: 51.2, z: 28.9, marks: [[50.65, 29.85], [51.75, 29.85]] }
export const BENCHES = [
  { id: 'carnival:bench1', x: 60.6, z: 33.6, yaw: -Math.PI * 0.75 },
  { id: 'carnival:bench2', x: 50.8, z: 40.8, yaw: Math.PI },
  { id: 'carnival:bench3', x: 59.4, z: 22.2, yaw: Math.PI * 0.2 },
  { id: 'carnival:bench4', x: 65.4, z: 41.0, yaw: -Math.PI / 2 },
]
/** The paved walks (Carnival.jsx lays the pavers along them). */
export const WALKS = [
  [[GATE.x - 0.4, GATE.z], [53.2, 27.6]],
  [[53.2, 27.6], [57.5, 24.4], [63.5, 20.4]],
  [[53.2, 27.6], [52.0, 23.2]],
  [[60.2, 27.2], [62.0, 27.6], [65.3, 31.2], [65.6, 32.4]],
  [[53.2, 27.6], [52.6, 32.0], [53.35, 34.8]],
  [[56.5, 34.2], [56.4, 40.4]],
  [[52.0, 40.4], [64.6, 40.4]],
  [[59.6, 27.0], [60.2, 27.2]],
]

/* ───────── walking: the fence (open at the gate), and everything solid ───────── */

const BODY = 0.22
const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad
const FENCE_SEGS = [
  [FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0],
  [FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1],
  [FENCE.x0, FENCE.z1, FENCE.x1, FENCE.z1],
  [FENCE.x0, FENCE.z0, FENCE.x0, GATE.z - GATE.half],
  [FENCE.x0, GATE.z + GATE.half, FENCE.x0, FENCE.z1],
]
const segDist = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
/** Rectangles nobody walks into (the rides, the booths, the kiosks, the office). */
export const SOLID_RECTS = [
  { x0: BUMPER.x0, x1: BUMPER.x1, z0: BUMPER.z0, z1: BUMPER.z1 },
  { x0: WHEEL.x - 3.4, x1: WHEEL.x + 3.4, z0: WHEEL.z - 1.6, z1: WHEEL.z + 1.4 },
  COASTER_ZONE,
  ...BOOTHS.map((b) => ({ x0: b.x - BOOTH_HALF, x1: b.x + BOOTH_HALF, z0: b.z - 1.2, z1: b.z + 1.15 })),
  { x0: TICKET_BOOTH.x - 1.0, x1: TICKET_BOOTH.x + 1.0, z0: TICKET_BOOTH.z - 0.8, z1: TICKET_BOOTH.z + 0.75 },
  { x0: KIOSK.x - 1.15, x1: KIOSK.x + 1.15, z0: KIOSK.z - 0.75, z1: KIOSK.z + 0.65 },
  { x0: OFFICE.x - OFFICE.hd - 0.1, x1: OFFICE.x + OFFICE.hd + 0.3, z0: OFFICE.z - OFFICE.hw - 0.1, z1: OFFICE.z + OFFICE.hw + 0.1 },
]
export const SOLID_CIRCLES = [
  { x: CAROUSEL.x, z: CAROUSEL.z, r: CAROUSEL.r + 0.15 },
  { x: TEACUPS.x, z: TEACUPS.z, r: TEACUPS.r + 0.15 },
  { x: STAGE.x, z: STAGE.z, r: STAGE.r },
]
blockers.push((x, z) => {
  if (x < BOX.x0 - 1 || x > BOX.x1 + 1 || z < BOX.z0 - 1 || z > BOX.z1 + 1) return false
  const px = player.position.x
  const pz = player.position.z
  // never trap her inside something (she can always walk out of it)
  if (FENCE_SEGS.some(([ax, az, bx, bz]) => segDist(x, z, ax, az, bx, bz) < BODY) && !FENCE_SEGS.some(([ax, az, bx, bz]) => segDist(px, pz, ax, az, bx, bz) < BODY)) return true
  for (const r of SOLID_RECTS) if (inRect(x, z, r, BODY * 0.5) && !inRect(px, pz, r, BODY * 0.5)) return true
  for (const c of SOLID_CIRCLES) if (Math.hypot(x - c.x, z - c.z) < c.r && Math.hypot(px - c.x, pz - c.z) >= c.r) return true
  return false
})
/** Lamp posts and decorations (circles), placed by Carnival.jsx from this list. */
export const LAMPS = [
  [45.6, 25.3], [45.6, 29.7], [49.5, 26.2], [49.5, 29.0], [54.0, 24.4], [58.6, 25.0], [62.4, 22.8], [55.4, 35.6], [52.2, 39.6], [64.6, 39.6], [63.4, 30.8],
]
export const TOADSTOOLS = [
  [45.8, 15.4, 1.3, '#e8566f'], [72.6, 15.4, 1.1, '#c9a5e8'], [45.6, 43.0, 1.0, '#ffb347'], [58.8, 15.2, 0.9, '#5fb3a8'], [64.8, 42.8, 0.8, '#ff8fbf'], [45.4, 35.6, 0.85, '#7fbf6a'],
]
for (const [x, z] of LAMPS) addCollider(x, z, 0.12)
for (const [x, z, s] of TOADSTOOLS) addCollider(x, z, 0.32 * s)
for (const b of BENCHES) addCollider(b.x, b.z, 0.42)
obstacles.version++

/* ───────── the roller coaster: one closed track, a train of two cars ───────── */

/** The track: world x, z and height above the fairground (a lift hill, a big drop, a tunnel, a camel hump). */
const TRACK_POINTS = [
  [67.4, 35.4, 0.9],
  [67.4, 32.0, 0.9],
  [67.4, 29.0, 0.9],
  [67.9, 26.4, 1.25],
  [69.0, 24.3, 2.4],
  [70.6, 23.2, 4.1],
  [72.2, 23.4, 5.4],
  [73.1, 24.9, 5.55],
  [73.2, 27.0, 4.6],
  [72.9, 29.6, 2.2],
  [72.2, 32.2, 1.0],
  [71.4, 34.6, 1.0],
  [70.7, 37.0, 2.3],
  [71.0, 39.6, 2.6],
  [71.9, 41.4, 1.6],
  [70.8, 42.8, 1.15],
  [68.8, 42.9, 1.0],
  [67.6, 41.4, 0.95],
  [67.4, 38.6, 0.9],
]
export const TRACK = new THREE.CatmullRomCurve3(
  TRACK_POINTS.map(([x, z, y]) => new THREE.Vector3(x, y, z)),
  true,
  'centripetal',
)
export const TRACK_LENGTH = TRACK.getLength()
const N = 900
const S_POINTS = TRACK.getSpacedPoints(N)
/** Where the train's front car stops in the station (arc length along the track). */
const STOP_S = (() => {
  let best = 0
  let bd = Infinity
  S_POINTS.forEach((p, i) => {
    const d = Math.hypot(p.x - 67.4, p.z - 31.2)
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return (best / N) * TRACK_LENGTH
})()
const heightAt = (s) => S_POINTS[Math.round((((s % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH) / TRACK_LENGTH * N) % N].y
/**
 * The ride's timetable: s (metres from the station) for each moment of the ride. On the lift hill a
 * chain pulls the train at a steady pace; after the top it rolls with what the drop gives it (and a
 * little friction); the last stretch brakes gently into the station.
 */
const RIDE = (() => {
  let topS = 0
  for (let s = 0; s < TRACK_LENGTH * 0.5; s += 0.25) if (heightAt(STOP_S + s) > heightAt(STOP_S + topS)) topS = s
  const topH = heightAt(STOP_S + topS)
  const CHAIN = 1.7
  const speed = (s) => {
    const launch = Math.min(1, 0.25 + s / 3) // pulling away from the platform
    if (s <= topS) return CHAIN * launch
    const v = Math.sqrt(CHAIN * CHAIN + 2 * 9.8 * Math.max(0, topH - heightAt(STOP_S + s))) * 0.86
    const brake = Math.min(1, (TRACK_LENGTH - s) / 7) // the brakes before the station
    return Math.max(0.35, Math.max(2.4, v) * Math.max(0.12, brake))
  }
  const ds = 0.05
  const times = [0]
  for (let s = ds; s <= TRACK_LENGTH + 1e-6; s += ds) times.push(times[times.length - 1] + ds / ((speed(s - ds) + speed(s)) / 2))
  return { times, ds, seconds: times[times.length - 1], topS }
})()
export const COASTER_RIDE = Math.ceil(RIDE.seconds)
export const COASTER_BOARD = 12
export const COASTER_UNLOAD = 3
export const COASTER_CYCLE = COASTER_BOARD + COASTER_RIDE + COASTER_UNLOAD
const CAR_GAP = 1.55
/** Metres travelled `tau` seconds into the ride. */
function rideDistance(tau) {
  const { times, ds, seconds } = RIDE
  if (tau <= 0) return 0
  if (tau >= seconds) return TRACK_LENGTH
  let lo = 0
  let hi = times.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (times[mid] < tau) lo = mid
    else hi = mid
  }
  const k = (tau - times[lo]) / (times[hi] - times[lo] || 1)
  return (lo + k) * ds
}
/** The coaster now: { cycle, phase: 'board' | 'ride' | 'unload', s (front car), left (seconds to the next change) }. */
export function coasterState(t = now()) {
  const cycle = Math.floor(t / COASTER_CYCLE)
  const tc = t - cycle * COASTER_CYCLE
  if (tc < COASTER_BOARD) return { cycle, phase: 'board', s: STOP_S, left: COASTER_BOARD - tc }
  if (tc < COASTER_BOARD + COASTER_RIDE) return { cycle, phase: 'ride', s: STOP_S + rideDistance(tc - COASTER_BOARD), left: COASTER_BOARD + COASTER_RIDE - tc }
  return { cycle, phase: 'unload', s: STOP_S + TRACK_LENGTH, left: COASTER_CYCLE - tc }
}
const tmpP = new THREE.Vector3()
const tmpT = new THREE.Vector3()
/** A car on the track at arc length s: { x, y, z, yaw, pitch } (y is the rail, world). */
export function trackPose(s, out = {}) {
  const u = (((s % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH) / TRACK_LENGTH
  TRACK.getPointAt(u, tmpP)
  TRACK.getTangentAt(u, tmpT)
  out.x = tmpP.x
  out.y = tmpP.y + groundLevel()
  out.z = tmpP.z
  out.yaw = Math.atan2(tmpT.x, tmpT.z)
  out.pitch = Math.asin(THREE.MathUtils.clamp(tmpT.y, -1, 1))
  return out
}
export const carS = (frontS, car) => frontS - car * CAR_GAP
export const COASTER_SEATS = ['c0', 'c1', 'c2', 'c3'] // car 0 left/right, car 1 left/right

/* ───────── the big wheel, the teacups, the carousel ───────── */

const TAU = Math.PI * 2
/** Each gondola's angle round the hub (0: at the bottom). */
export const gondolaAngle = (k, t = now()) => ((t / WHEEL.period) * TAU + (k / WHEEL.n) * TAU) % TAU
/** Where gondola k hangs (its floor), world. */
export function gondolaPose(k, t = now(), out = {}) {
  const a = gondolaAngle(k, t)
  out.x = WHEEL.x + Math.sin(a) * WHEEL.r
  out.y = groundLevel() + WHEEL.hub - Math.cos(a) * WHEEL.r - 1.0
  out.z = WHEEL.z
  return out
}
/** When gondola k is next at the bottom (shared-clock seconds, after `after`). */
export function nextBottom(k, after = now()) {
  const a = gondolaAngle(k, after)
  return after + (((TAU - a) % TAU) / TAU) * WHEEL.period
}

/** A ride that turns for a while, then stops for people to get on and off. */
const SPINNERS = {
  teacups: { cycle: 36, board: 10, spin: 24, revs: 3, cupRevs: 7 },
  carousel: { cycle: 42, board: 10, spin: 30, revs: 2.5 },
}
/** { cycle, phase: 'board' | 'spin', k (0…1 through the spin), left, turn (revolutions so far, all time) } */
export function spinnerState(kind, t = now()) {
  const S = SPINNERS[kind]
  const cycle = Math.floor(t / S.cycle)
  const tc = t - cycle * S.cycle
  const k = smooth01((tc - S.board) / S.spin)
  const phase = tc < S.board ? 'board' : tc < S.board + S.spin ? 'spin' : 'board'
  const left = phase === 'spin' ? S.board + S.spin - tc : tc < S.board ? S.board - tc : S.cycle - tc + S.board
  return { cycle, phase, k, left, tc, turn: (cycle + k) * S.revs }
}
/** Teacup c's centre and its own spin. */
export function cupPose(c, t = now(), out = {}) {
  const st = spinnerState('teacups', t)
  const a = st.turn * TAU + (c / TEACUPS.n) * TAU
  out.x = TEACUPS.x + Math.sin(a) * TEACUPS.cupR
  out.z = TEACUPS.z + Math.cos(a) * TEACUPS.cupR
  out.y = groundLevel() + 0.3
  out.spin = (st.cycle + st.k) * SPINNERS.teacups.cupRevs * TAU * (c % 2 ? -1 : 1) + c
  out.platform = st.turn * TAU
  return out
}
/** Carousel mount m: where it is, which way it faces, how high it rides. */
export function mountPose(m, t = now(), out = {}) {
  const st = spinnerState('carousel', t)
  const a = st.turn * TAU + (m / CAROUSEL.n) * TAU
  out.x = CAROUSEL.x + Math.sin(a) * CAROUSEL.mountR
  out.z = CAROUSEL.z + Math.cos(a) * CAROUSEL.mountR
  out.bob = st.phase === 'spin' ? Math.sin(st.turn * TAU * 2 + m * 1.7) * 0.16 : 0
  out.y = groundLevel() + 0.35
  // facing the way it goes round (counter-clockwise from above)
  out.yaw = a + Math.PI / 2
  out.angle = st.turn * TAU
  return out
}

/* ───────── seats: where someone in a seat is (world), for her and for the other person ───────── */

const pose = {}
const right = (yaw) => [Math.cos(yaw), -Math.sin(yaw)]
/**
 * The seat a ride gives: { x, y (where the feet go), z, yaw } — or null when she isn't actually
 * sitting in it right now (e.g. waiting on the wheel's platform for her gondola).
 */
export function seatPose(ride, t = now()) {
  if (!ride?.kind) return null
  switch (ride.kind) {
    case 'coaster': {
      const i = COASTER_SEATS.indexOf(ride.seat)
      if (i < 0) return null
      const st = coasterState(t)
      const s = st.cycle === ride.cycle ? st.s : STOP_S
      trackPose(carS(s, i >> 1), pose)
      const [rx, rz] = right(pose.yaw)
      const side = i % 2 ? 0.27 : -0.27
      return { x: pose.x + rx * side, y: pose.y + 0.46 - SEAT_DROP, z: pose.z + rz * side, yaw: pose.yaw, pitch: pose.pitch }
    }
    case 'wheel': {
      const [k, side] = String(ride.seat).split(':').map(Number)
      if (!(k >= 0 && k < WHEEL.n) || t < ride.at) return null
      gondolaPose(k, t, pose)
      return { x: pose.x + (side ? 0.27 : -0.27), y: pose.y + 0.42 - SEAT_DROP, z: pose.z + 0.05, yaw: 0 }
    }
    case 'teacups': {
      const [c, side] = String(ride.seat).split(':').map(Number)
      if (!(c >= 0 && c < TEACUPS.n)) return null
      cupPose(c, t, pose)
      const a = pose.spin + (side ? Math.PI : 0)
      // sitting on the cup's bench, facing its middle
      return { x: pose.x + Math.sin(a) * 0.36, y: pose.y + 0.32 - SEAT_DROP, z: pose.z + Math.cos(a) * 0.36, yaw: a + Math.PI }
    }
    case 'carousel': {
      const m = Number(ride.seat)
      if (!(m >= 0 && m < CAROUSEL.n)) return null
      mountPose(m, t, pose)
      // on the mount's back (its saddle)
      return { x: pose.x, y: pose.y + 0.78 + pose.bob - SEAT_DROP, z: pose.z, yaw: pose.yaw }
    }
    default:
      return null
  }
}

/* ───────── her ride ───────── */

/**
 * player.ride: { id, kind, seat, cycle? (coaster/teacups/carousel: the run she's on), at? (wheel:
 * when her gondola reaches the bottom, shared-clock seconds), until? (wheel: when it's back) }
 * Bumper cars: { kind: 'bumper' } and her car in `car` below.
 */
export const useRide = create(() => ({ ride: null }))
function setRide(ride) {
  player.ride = ride
  useRide.setState({ ride })
  presence.ride = ride ? { id: ride.id, kind: ride.kind, seat: ride.seat != null ? String(ride.seat) : undefined, at: Math.round((ride.at ?? ride.cycle ?? 0) * 1000) } : null
}
/** The other person's ride (from their character), with the same meaning as ours. */
export function mateRide() {
  const r = partner.online ? partner.ride : null
  if (!r?.kind) return null
  const at = (r.at || 0) / 1000
  return { kind: r.kind, seat: r.seat, cycle: r.kind === 'wheel' ? undefined : Math.round(at), at: r.kind === 'wheel' ? at : undefined }
}
/** Where the other person sits right now (or null: they're walking, or waiting). */
export const mateSeatPose = () => seatPose(mateRide())

/** The day pass (a wristband from the ticket booth): one a day, kept on this device. */
const BAND_KEY = 'our-little-universe:carnival-band'
const today = () => new Date(serverNow() + 8 * 3600000).toISOString().slice(0, 10)
export const useBand = create(() => ({ day: (() => {
  try {
    return localStorage.getItem(BAND_KEY)
  } catch {
    return null
  }
})() }))
export const hasBand = () => useBand.getState().day === today()
export function takeBand() {
  useBand.setState({ day: today() })
  try {
    localStorage.setItem(BAND_KEY, today())
  } catch {
    // a private window: the band lasts as long as the tab
  }
}

const RIDE_NAMES = { coaster: 'Roller Coaster', wheel: 'Bianglala', teacups: 'Cangkir Ajaib', carousel: 'Komidi Putar', bumper: 'Bom-bom Car' }
export const rideName = (k) => RIDE_NAMES[k] || k

/** Seats the other person is in (so nobody sits on anybody). */
const takenBy = (kind, run) => {
  const r = mateRide()
  if (!r || r.kind !== kind) return null
  if (kind === 'wheel') return Math.abs((r.at ?? 0) - run) < 1 ? r.seat : null
  return r.cycle === run ? r.seat : null
}
/** The first free seat, next to the other person if they're on this run. */
function pickSeat(seats, taken, near) {
  const free = seats.filter((s) => s !== taken)
  if (taken && near) {
    const n = near(taken)
    if (n && free.includes(n)) return n
  }
  return free[0] ?? null
}

/** Can she get on this ride now? → { ok } or { ok: false, why } */
export function canBoard(kind) {
  if (player.ride) return { ok: false, why: `Kamu sedang di ${rideName(player.ride.kind)}.` }
  if (player.seat || player.act || player.balloon) return { ok: false, why: 'Berdiri dulu, ya.' }
  if (!hasBand()) return { ok: false, why: 'Ambil Gelang Dreamlight dulu di loket dekat gerbang 🎟️' }
  if (kind === 'coaster') {
    const st = coasterState()
    if (st.phase !== 'board' || st.left < 1.5) return { ok: false, why: `Kereta sedang jalan. Kereta berikutnya siap dinaiki dalam ${Math.ceil(st.phase === 'board' ? st.left + COASTER_RIDE + COASTER_UNLOAD : st.left + (st.phase === 'ride' ? COASTER_UNLOAD : 0))} detik.` }
  }
  if (kind === 'teacups' || kind === 'carousel') {
    const st = spinnerState(kind)
    if (st.phase !== 'board' || st.tc >= SPINNERS[kind].board - 1) return { ok: false, why: `${rideName(kind)} sedang berputar. Tunggu ${Math.ceil(st.left)} detik lagi, ya.` }
  }
  return { ok: true }
}

/** Get on a ride (at its entrance). */
export function board(kind) {
  const can = canBoard(kind)
  if (!can.ok) {
    toast(can.why, 3400)
    return false
  }
  const t = now()
  const id = uid()
  let ride = null
  if (kind === 'coaster') {
    const cycle = coasterState(t).cycle
    const seat = pickSeat(COASTER_SEATS, takenBy('coaster', cycle), (s) => COASTER_SEATS[COASTER_SEATS.indexOf(s) ^ 1])
    ride = { id, kind, seat, cycle }
  } else if (kind === 'teacups' || kind === 'carousel') {
    const cycle = spinnerState(kind, t).cycle
    const seats = kind === 'teacups' ? Array.from({ length: TEACUPS.n * 2 }, (_, i) => `${i >> 1}:${i % 2}`) : Array.from({ length: CAROUSEL.n }, (_, i) => String(i))
    const taken = takenBy(kind, cycle)
    // with her: the other side of the same cup, or the mount beside theirs
    const near = kind === 'teacups' ? (s) => `${s.split(':')[0]}:${1 - Number(s.split(':')[1])}` : (s) => String((Number(s) + 1) % CAROUSEL.n)
    ride = { id, kind, seat: pickSeat(seats, taken, near), cycle }
  } else if (kind === 'wheel') {
    // the next gondola to come down (a moment from now): if the other person is waiting for one, the same
    const mate = mateRide()
    let k
    let at
    if (mate?.kind === 'wheel' && mate.at > t + 1) {
      k = Number(String(mate.seat).split(':')[0])
      at = mate.at
    } else {
      at = Infinity
      for (let g = 0; g < WHEEL.n; g++) {
        const b = nextBottom(g, t + 2)
        if (b < at) {
          at = b
          k = g
        }
      }
    }
    const side = mate?.kind === 'wheel' && String(mate.seat).split(':')[0] === String(k) && Math.abs(mate.at - at) < 1 ? 1 - Number(String(mate.seat).split(':')[1]) : 0
    ride = { id, kind, seat: `${k}:${side}`, at, until: at + WHEEL.period }
  } else if (kind === 'bumper') {
    ride = { id, kind }
    car.x = BUMPER.gate[0]
    car.z = BUMPER.z1 - 0.9
    car.vx = 0
    car.vz = 0
    car.yaw = Math.PI
    car.wobble = 0
  }
  if (!ride || ride.seat === null) {
    toast('Semua kursinya penuh. Tunggu putaran berikutnya, ya.')
    return false
  }
  player.walkTarget = null
  player.onArrive = null
  player.speed = 0
  boardFrom = { x: player.position.x, y: player.position.y, z: player.position.z }
  boardT = 0
  setRide(ride)
  audio.sfx('pop', 1)
  if (kind === 'wheel') toast(`Gondola ${Number(ride.seat.split(':')[0]) + 1} segera turun. Tunggu di peron, ya ✨`, 3000)
  return true
}

const EXITS = {
  coaster: [STATION.board, [65.8, 30.2], [65.8, 34.8]],
  wheel: [WHEEL.board, [62.4, 19.6], [64.6, 19.6]],
  teacups: [TEACUPS.entry, [53.3, 33.6], [53.3, 36.0]],
  carousel: [CAROUSEL.entry, [55.4, 33.9], [57.6, 33.9]],
  bumper: [BUMPER.gate, [50.8, 22.9], [53.2, 22.9]],
}
/** Get off: set down at the ride's exit, on solid ground, with her controls back. */
export function getOff(reason) {
  const ride = player.ride
  if (!ride) return
  setRide(null)
  boardFrom = null
  const spots = EXITS[ride.kind] || []
  const spot = spots.find(([x, z]) => walkable(x, z)) || [player.safe.x, player.safe.z]
  player.position.set(spot[0], standHeight(spot[0], spot[1]), spot[1])
  player.speed = 0
  player.walkTarget = null
  player.onArrive = null
  if (reason === 'done') {
    addMood('bahagia')
    toast(`${rideName(ride.kind)} selesai. Seru banget! ✨`, 2600)
  }
}

/** Can she step off now? (only when the ride is standing still) */
export function canGetOff() {
  const r = player.ride
  if (!r) return false
  if (r.kind === 'bumper') return true
  if (r.kind === 'coaster') return coasterState().cycle === r.cycle && coasterState().phase === 'board'
  if (r.kind === 'wheel') return now() < r.at - 0.3
  return spinnerState(r.kind).cycle === r.cycle && spinnerState(r.kind).phase === 'board'
}

let boardFrom = null
let boardT = 0
/**
 * Every frame while she's on a ride (the player controller calls it): the seat carries her; at the
 * end she's set down. Returns true while she's held by the ride.
 */
export function holdRide(delta) {
  const r = player.ride
  if (!r) return false
  if (r.kind === 'bumper') return true // her car moves her (driveBumper)
  const t = now()
  // the ride is over (or her run is long gone, e.g. the tab slept): off she gets
  if (r.kind === 'coaster') {
    const st = coasterState(t)
    if (st.cycle > r.cycle || (st.cycle === r.cycle && st.phase === 'unload')) {
      getOff(st.cycle === r.cycle ? 'done' : null)
      return false
    }
  } else if (r.kind === 'wheel') {
    if (t >= r.until || t > r.at + WHEEL.period + 5) {
      getOff('done')
      return false
    }
  } else if (r.kind === 'teacups' || r.kind === 'carousel') {
    const st = spinnerState(r.kind, t)
    if (st.cycle > r.cycle || (st.cycle === r.cycle && st.tc >= SPINNERS[r.kind].board + SPINNERS[r.kind].spin)) {
      getOff(st.cycle === r.cycle ? 'done' : null)
      return false
    }
  } else {
    getOff()
    return false
  }
  const seat = seatPose(r, t)
  if (!seat) {
    // waiting for her gondola: she stands on the platform
    player.speed = 0
    return true
  }
  if (boardFrom) {
    // a little hop into the seat
    boardT = Math.min(1, boardT + delta / 0.5)
    const k = smooth01(boardT)
    player.position.set(boardFrom.x + (seat.x - boardFrom.x) * k, boardFrom.y + (seat.y - boardFrom.y) * k + Math.sin(Math.PI * boardT) * 0.3, boardFrom.z + (seat.z - boardFrom.z) * k)
    if (boardT >= 1) boardFrom = null
  } else player.position.set(seat.x, seat.y, seat.z)
  player.yaw = seat.yaw
  player.speed = 0
  return true
}
/** Is she sitting (for her pose)? */
export const sittingOnRide = () => Boolean(player.ride && (player.ride.kind === 'bumper' || seatPose(player.ride)))
/** …and the other person. */
export const mateSitting = () => {
  const r = mateRide()
  return Boolean(r && (r.kind === 'bumper' || seatPose(r)))
}

/* ───────── bumper cars ───────── */

/** Her car: position, velocity, heading, and a wobble after a bump. */
export const car = { x: 0, z: 0, vx: 0, vz: 0, yaw: 0, wobble: 0 }
const MAX_SPEED = 3.4
const ACCEL = 7
const INNER = { x0: BUMPER.x0 + 0.35 + BUMPER.car, x1: BUMPER.x1 - 0.35 - BUMPER.car, z0: BUMPER.z0 + 0.35 + BUMPER.car, z1: BUMPER.z1 - 0.35 - BUMPER.car }
/** Two gnome-driven cars, going round on their own loops (the same on both screens). */
export function gnomeCar(i, t = now()) {
  const w = (INNER.x1 - INNER.x0) / 2 - 0.4
  const h = (INNER.z1 - INNER.z0) / 2 - 0.4
  const cx = (INNER.x0 + INNER.x1) / 2
  const cz = (INNER.z0 + INNER.z1) / 2
  const a = t * (i ? 0.31 : 0.23) + i * 2.1
  const x = cx + Math.sin(a) * w * (i ? 0.8 : 1)
  const z = cz + Math.sin(a * 2 + i) * h * (i ? 1 : 0.7)
  const dx = Math.cos(a) * w
  const dz = Math.cos(a * 2 + i) * h * 2
  return { x, z, yaw: Math.atan2(dx, dz) }
}
/** Bumps, for Carnival.jsx's little stars: { at: [x, z], t }. */
export const bumps = []
let lastBump = 0
function bump(x, z, strength) {
  const t = performance.now()
  if (t - lastBump < 220) return
  lastBump = t
  bumps.push({ x, z, t, strength })
  if (bumps.length > 6) bumps.shift()
  car.wobble = Math.min(1, 0.4 + strength * 0.25)
  audio.sfx('boing', 2)
}
/**
 * Drive her car (the player controller calls it with the stick / keys, camera-relative).
 * Walls, the gnome cars and the other person's car all bump back.
 */
export function driveBumper(delta, dirX, dirZ, mag) {
  const d = Math.min(delta, 0.05)
  car.vx += dirX * mag * ACCEL * d
  car.vz += dirZ * mag * ACCEL * d
  // rolling friction (more when she lets go)
  const f = Math.exp(-d * (mag > 0.05 ? 1.2 : 2.6))
  car.vx *= f
  car.vz *= f
  const sp = Math.hypot(car.vx, car.vz)
  if (sp > MAX_SPEED) {
    car.vx *= MAX_SPEED / sp
    car.vz *= MAX_SPEED / sp
  }
  // move in small steps, so nothing is ever passed through
  const steps = Math.max(1, Math.ceil((sp * d) / 0.15))
  for (let i = 0; i < steps; i++) {
    car.x += (car.vx * d) / steps
    car.z += (car.vz * d) / steps
    // the walls: bounce back, a little softer
    if (car.x < INNER.x0 || car.x > INNER.x1) {
      car.x = THREE.MathUtils.clamp(car.x, INNER.x0, INNER.x1)
      if (Math.abs(car.vx) > 0.6) bump(car.x + Math.sign(car.vx) * BUMPER.car, car.z, Math.abs(car.vx))
      car.vx *= -0.55
    }
    if (car.z < INNER.z0 || car.z > INNER.z1) {
      car.z = THREE.MathUtils.clamp(car.z, INNER.z0, INNER.z1)
      if (Math.abs(car.vz) > 0.6) bump(car.x, car.z + Math.sign(car.vz) * BUMPER.car, Math.abs(car.vz))
      car.vz *= -0.55
    }
    // the other cars: push apart, and swap a bit of speed along the line between
    const others = [gnomeCar(0), gnomeCar(1)]
    const mr = mateRide()
    if (mr?.kind === 'bumper' && partner.shown.ok) others.push({ x: partner.shown.x, z: partner.shown.z })
    for (const o of others) {
      const dx = car.x - o.x
      const dz = car.z - o.z
      const dist = Math.hypot(dx, dz)
      const min = BUMPER.car * 2
      if (dist < min && dist > 1e-4) {
        const nx = dx / dist
        const nz = dz / dist
        car.x += nx * (min - dist)
        car.z += nz * (min - dist)
        const vn = car.vx * nx + car.vz * nz
        const push = Math.max(1.6, -vn * 1.4)
        car.vx += nx * (push - Math.min(0, vn))
        car.vz += nz * (push - Math.min(0, vn))
        bump(car.x - nx * BUMPER.car, car.z - nz * BUMPER.car, push)
      }
    }
    car.x = THREE.MathUtils.clamp(car.x, INNER.x0, INNER.x1)
    car.z = THREE.MathUtils.clamp(car.z, INNER.z0, INNER.z1)
  }
  // she turns the way she's going (and wobbles a moment after a bump)
  if (Math.hypot(car.vx, car.vz) > 0.25) {
    let dy = Math.atan2(car.vx, car.vz) - car.yaw
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    car.yaw += dy * Math.min(1, d * 6)
  }
  car.wobble = Math.max(0, car.wobble - d * 2.2)
  player.position.set(car.x, groundLevel() + 0.2 + 0.3 - SEAT_DROP, car.z)
  player.yaw = car.yaw + Math.sin(performance.now() / 50) * car.wobble * 0.25
  player.speed = 0
}

/* ───────── the gnomes who run the fair ───────── */

/**
 * Each gnome: name, job, look, and where they work (they mostly stay at their post; Bu Bulan walks
 * between the big wheel and the carousel, Toto between his stage and the plaza — a simple round on
 * the shared clock, nothing cleverer than that).
 */
export const CREW = {
  pita: { name: 'Pita', role: 'Penjaga loket', at: [TICKET_BOOTH.x, TICKET_BOOTH.z - 0.25], face: [TICKET_BOOTH.x, TICKET_BOOTH.z + 3], look: { shirt: '#ff8fbf', apron: '#fff4e4', apronDark: '#e8566f', hat: '#ffd27f', band: '#e8566f', hair: '#c8794e', beard: null } },
  roda: { name: 'Pak Roda', role: 'Operator roller coaster', at: [66.0, 29.0], face: [67.4, 31.0], look: { shirt: '#5fb3a8', apron: '#ffe9a8', apronDark: '#c47a52', hat: '#e8566f', band: '#ffd27f', beard: '#d9cbb8', hair: '#d9cbb8' } },
  bulan: {
    name: 'Bu Bulan',
    role: 'Operator bianglala & komidi putar',
    route: [
      { at: [61.6, 19.8], face: [WHEEL.x, WHEEL.z + 3], via: [[61.2, 30.5], [60.0, 29.0], [60.0, 24.0]] },
      { at: [58.2, 34.1], face: [CAROUSEL.x, CAROUSEL.z], via: [[60.0, 24.0], [60.0, 29.0], [61.2, 30.5]] },
    ],
    look: { shirt: '#c9b6f4', apron: '#ffe0ec', apronDark: '#9a6b4a', hat: '#7a5fc4', band: '#fff4e4', hair: '#f4f0f6', beard: null, glasses: true },
  },
  kiki: {
    name: 'Kiki',
    role: 'Operator cangkir ajaib & bom-bom car',
    route: [
      { at: [53.6, 33.4], face: [TEACUPS.x, TEACUPS.z], via: [[52.6, 29.5]] },
      { at: [53.4, 23.2], face: [52, 20], via: [[52.6, 29.5]] },
    ],
    look: { shirt: '#ffb347', apron: '#fff6ea', apronDark: '#e08f6a', hat: '#5fb3a8', band: '#ffd27f', hair: '#a0643f', beard: null },
  },
  tara: { name: 'Tara', role: 'Penjaga Lempar Gelang', at: [BOOTHS[0].x + 0.85, BOOTHS[0].z - 0.35], face: [BOOTHS[0].x, BOOTHS[0].z + 3], look: { shirt: '#f7a8c4', apron: '#ffffff', apronDark: '#e8798f', hat: '#e8566f', band: '#ffffff', hair: '#c8794e', beard: null } },
  bumbum: { name: 'Bumbum', role: 'Penjaga Robohkan Kaleng', at: [BOOTHS[1].x + 0.85, BOOTHS[1].z - 0.35], face: [BOOTHS[1].x, BOOTHS[1].z + 3], look: { shirt: '#8fc9b3', apron: '#fff6ea', apronDark: '#5f8f86', hat: '#ffb347', band: '#8fc9b3', beard: '#c8794e', hair: '#c8794e' } },
  jepret: { name: 'Jepret', role: 'Penjaga Tembak Sasaran', at: [BOOTHS[2].x + 0.85, BOOTHS[2].z - 0.35], face: [BOOTHS[2].x, BOOTHS[2].z + 3], look: { shirt: '#b9a5e8', apron: '#ffe9a8', apronDark: '#7a6aae', hat: '#3f8f86', band: '#ffd27f', beard: null, hair: '#3a2a3e' } },
  manis: { name: 'Mbak Manis', role: 'Penjual jajanan', at: [KIOSK.x, KIOSK.z - 0.35], face: [KIOSK.x, KIOSK.z + 3], look: { shirt: '#ffd6ea', apron: '#ffffff', apronDark: '#ff8fbf', hat: '#ff8fbf', band: '#ffffff', hair: '#f4c6a0', beard: null } },
  toto: {
    name: 'Toto',
    role: 'Pembawa pengumuman',
    route: [
      { at: [STAGE.x, STAGE.z], face: [STAGE.x + 3, STAGE.z + 2], via: [[56.4, 40.4], [56.4, 34.4], [52.9, 32.0]] },
      { at: [55.2, 26.4], face: [CAROUSEL.x, CAROUSEL.z] },
      { at: [STAGE.x, STAGE.z], face: [STAGE.x + 3, STAGE.z + 2] },
      { at: [60.4, 40.6], face: [BOOTHS[1].x, BOOTHS[1].z], via: [[52.9, 32.0], [56.4, 34.4], [56.4, 40.4]] },
    ],
    look: { shirt: '#e8566f', apron: '#ffd27f', apronDark: '#c47a52', hat: '#ffd27f', band: '#e8566f', beard: '#fffaf6', hair: '#fffaf6', tallHat: true },
  },
}
const BASE_LOOK = { skin: '#ffd9c4', nose: '#ffae9c', pants: '#6d5a6e' }
for (const g of Object.values(CREW)) g.look = { ...BASE_LOOK, ...g.look, phase: g.name.length * 0.7 }
export const CREW_IDS = Object.keys(CREW)

const ROUND = 30 // seconds at each place of a round
/** Where a gnome of the fair is now: { x, z, yaw, walking } (the same on both screens). */
export function crewAt(id, t = now()) {
  const g = CREW[id]
  if (!g.route) return { x: g.at[0], z: g.at[1], yaw: Math.atan2(g.face[0] - g.at[0], g.face[1] - g.at[1]), walking: false }
  const n = g.route.length
  const slot = Math.floor(t / ROUND)
  const stop = g.route[slot % n]
  const prev = g.route[(slot + n - 1) % n]
  // the way there: from the last stop, by this stop's waypoints (if the stop is reached from there)
  const pts = [prev.at, ...(stop.via || []), stop.at]
  let walked = (t - slot * ROUND) * 1.0
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const l = Math.hypot(bx - ax, bz - az)
    if (walked < l) {
      const k = walked / l
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, yaw: Math.atan2(bx - ax, bz - az), walking: true }
    }
    walked -= l
  }
  const [x, z] = stop.at
  return { x, z, yaw: Math.atan2(stop.face[0] - x, stop.face[1] - z), walking: false }
}

/** Toto's announcements: a new one every 20 seconds (the same on both screens). */
const ANNOUNCEMENTS = {
  pagi: ['Selamat pagi, Dreamlight Funfair sudah buka! 🎪', 'Roller coaster berangkat tiap kurang dari satu menit!', 'Ambil gelang gratis di loket dekat gerbang 🎟️'],
  siang: ['Siang yang cerah! Cocok untuk naik bianglala ☀️', 'Stan Lempar Gelang menunggu juara baru 🎯', 'Jangan lupa permen kapas dari Mbak Manis 🍭'],
  sore: ['Cahaya keemasan paling cantik dilihat dari puncak bianglala ✨', 'Sore begini, komidi putar paling romantis 🎠', 'Spot foto berdua ada di dekat gerbang 📸'],
  malam: ['Lampu karnaval menyala sampai pagi 🌙', 'Malam di bianglala, bintangnya serasa dekat ✦', 'Bom-bom car tetap buka, ayo tabrakan sambil tertawa!'],
}
export function announcement(t = now()) {
  const part = partOfDay(hourAt(t * 1000))
  const list = ANNOUNCEMENTS[part]
  const slot = Math.floor(t / 20)
  const into = t - slot * 20
  return into < 7 ? list[slot % list.length] : null
}

/* ───────── the booth games: scores, best scores (both of you), prizes ───────── */

export const GAMES = {
  ringtoss: { title: 'Lempar Gelang', icon: '🎯', max: 5, prizeAt: 3, prize: 'gnome_plush', prizeName: 'Boneka Kurcaci', how: 'Ketuk sekali untuk mengunci arah, ketuk lagi untuk mengunci kekuatan. Masukkan gelang ke leher botol. 5 gelang.' },
  cans: { title: 'Robohkan Kaleng', icon: '🥫', max: 6, prizeAt: 6, prize: 'carnival_lantern', prizeName: 'Lentera Karnaval', how: 'Bidikan bergerak sendiri. Ketuk saat bidikan tepat di kaleng. Robohkan keenam kaleng dengan 3 bola.' },
  shooting: { title: 'Tembak Sasaran', icon: '⭐', max: 99, prizeAt: 18, prizeName: 'Balon Hati', prize: 'balloon_bunch', how: 'Arahkan bidikan dengan mouse atau jari, ketuk untuk menembak peluru busa. Bintang 3 poin, bebek 2, jamur 1. 25 detik.' },
}
/** best: { [game]: { mine, mate } } (from the server); local bests too when offline. */
export const useScores = create(() => ({ best: {}, status: 'off' }))
const LOCAL_BEST = 'our-little-universe:carnival-best'
const localBest = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_BEST)) || {}
  } catch {
    return {}
  }
}
export async function loadScores() {
  const me = useCouple.getState().me
  const mine = localBest()
  const best = Object.fromEntries(Object.keys(GAMES).map((g) => [g, { mine: mine[g] ?? null, mate: null }]))
  if (!supabase || useCouple.getState().status !== 'connected' || !me) return useScores.setState({ best, status: 'local' })
  const { data, error } = await supabase.from('carnival_scores').select('user_id, game, best')
  if (error) return useScores.setState({ best, status: 'missing' })
  for (const row of data) {
    if (!best[row.game]) continue
    if (row.user_id === me.id) best[row.game].mine = Math.max(best[row.game].mine ?? 0, row.best)
    else best[row.game].mate = row.best
  }
  useScores.setState({ best, status: 'ready' })
}
onRoom({ subscribed: loadScores })

/** A game played to the end: saved (best score, prize, a few coins). Returns { best, coins, prize }. */
export async function saveScore(game, score) {
  const g = GAMES[game]
  if (!g) return { best: 0, coins: 0, prize: false }
  const s = Math.max(0, Math.min(g.max, Math.round(score)))
  const lb = localBest()
  lb[game] = Math.max(lb[game] ?? 0, s)
  try {
    localStorage.setItem(LOCAL_BEST, JSON.stringify(lb))
  } catch {
    // a private window
  }
  shareGame(game, 'done', s)
  let result = { best: lb[game], coins: 0, prize: s >= g.prizeAt, saved: false }
  if (supabase && useCouple.getState().status === 'connected') {
    const { data, error } = await supabase.rpc('carnival_score', { game, score: s })
    if (!error && data) {
      result = { best: data.best, coins: data.coins | 0, prize: Boolean(data.prize), saved: true }
      if (result.prize) useDate.setState((d) => ({ keepsakes: { ...d.keepsakes, [g.prize]: true } }))
      if (result.coins) refreshHouse()
    }
  }
  loadScores()
  return result
}
/** What she's playing travels with her character (so the other person sees the score at the booth). */
let gameClear = null
export function shareGame(game, state, score) {
  presence.game = { id: uid(), kind: game, state, n: score, at: Date.now() }
  clearTimeout(gameClear)
  gameClear = setTimeout(() => (presence.game = null), state === 'done' ? 9000 : 60000)
}
export const stopSharingGame = () => {
  clearTimeout(gameClear)
  presence.game = null
}

/* ───────── every frame ───────── */

/** Is she at the fair (for drawing it, and for the talk card)? */
export const useFair = create(() => ({ near: false }))
let photoAt = 0
export function tickCarnival() {
  const p = player.position
  const near = p.x > BOX.x0 - 30 && p.x < BOX.x1 + 25 && p.z > BOX.z0 - 25 && p.z < BOX.z1 + 25
  if (near !== useFair.getState().near) useFair.setState({ near })
  // a story moment (or leaving the world): off the ride at once
  const view = useStore.getState().view
  if (player.ride && view !== 'explore') getOff()
  // the other person can't sit in my seat: whoever has the bigger id moves over (both screens agree)
  const r = player.ride
  const m = mateRide()
  if (r && m && r.kind === m.kind && r.seat === m.seat && r.kind !== 'bumper' && (r.cycle === m.cycle || Math.abs((r.at ?? 0) - (m.at ?? 0)) < 1)) {
    const me = useCouple.getState().me?.id || ''
    const mate = useCouple.getState().mate?.id || ''
    if (me > mate) {
      const all = r.kind === 'coaster' ? COASTER_SEATS : r.kind === 'teacups' ? Array.from({ length: TEACUPS.n * 2 }, (_, i) => `${i >> 1}:${i % 2}`) : r.kind === 'carousel' ? Array.from({ length: CAROUSEL.n }, (_, i) => String(i)) : [`${r.seat.split(':')[0]}:0`, `${r.seat.split(':')[0]}:1`]
      const free = all.find((s) => s !== m.seat)
      if (free) setRide({ ...r, seat: free })
    }
  }
  return near
}
/** The photo spot: both of you on the marks at once is a photo together. */
export function photoPose(both) {
  const t = performance.now()
  if (t - photoAt < 1500) return
  photoAt = t
  if (both) {
    addMood('romantis')
    toast('📸 Klik! Foto berdua di Dreamlight Funfair ♡', 3400)
  } else toast('📸 Klik! Ajak pasanganmu berdiri di tanda sebelahnya untuk foto berdua.', 3400)
}
export const onPhotoMark = (x, z) => PHOTO.marks.findIndex(([mx, mz]) => Math.hypot(x - mx, z - mz) < 0.5)

/* ───────── talking with the fair's gnomes (through the village's talk card) ───────── */

/** The booth game on screen: { game } (components/ui/CarnivalUI.jsx). */
export const useBooth = create(() => ({ game: null }))
export function openGame(game) {
  if (!GAMES[game]) return
  useBooth.setState({ game })
  useStore.getState().setPanel('carnival-game')
}

const lastLines = {}
const pickLine = (id, list) => {
  let i = Math.floor(Math.random() * list.length)
  if (list.length > 1 && i === lastLines[id]) i = (i + 1) % list.length
  lastLines[id] = i
  return list[i]
}
const CREW_LINES = {
  pita: ['Selamat datang di Dreamlight Funfair! 🎪', 'Gelangnya gratis, satu untuk seharian penuh ✦', 'Semua wahana dan stan menunggu kalian!'],
  roda: ['Pegangan yang erat, ya! Turunannya bikin jantung berdebar 🎢', 'Terowongan jamur di lintasan itu favoritku.', 'Dua kereta, empat kursi. Duduk berdua di depan paling seru!'],
  bulan: ['Dari puncak bianglala, seluruh padang kelihatan ✨', 'Gondolanya muat berdua. Cocok untuk kalian ♡', 'Komidi putarnya diiringi lagu kotak musik, dengar deh 🎠'],
  kiki: ['Cangkirnya berputar sendiri, jangan sampai pusing, hihi ☕', 'Bom-bom car boleh ditabrak, kok. Itu justru serunya!', 'Pegang setirnya, lalu tabrak gnome yang lewat!'],
  tara: ['Masukkan gelang ke leher botol. Tiga gelang, dapat boneka kurcaci!'],
  bumbum: ['Robohkan keenam kalengnya dengan tiga bola, hadiahnya lentera karnaval!'],
  jepret: ['Bintang tiga poin, bebek dua, jamur satu. Delapan belas poin, dapat balon hati!'],
  manis: ['Permen kapas baru saja diputar, masih hangat 🍭', 'Jus stroberinya segar sekali sore ini 🍓', 'Mau jajan apa, Sayang?'],
  toto: ['Halo, halo! Selamat bersenang-senang di Dreamlight Funfair!', 'Malam hari, semua lampu karnaval menyala. Jangan sampai ketinggalan!', 'Spot foto berdua ada di dekat gerbang, lho 📸'],
}
/** What a gnome of the fair says, and what she can do then. Returns { text, options } for say(). */
export function crewTalk(id) {
  const options = []
  let text = pickLine(id, CREW_LINES[id] || ['Halo!'])
  const rideOption = (kind) => {
    const can = canBoard(kind)
    if (can.ok) options.push({ label: `Naik ${rideName(kind)} ✨`, kind: 'run', run: () => board(kind) })
    else if (!player.ride) text += ' ' + can.why
  }
  switch (id) {
    case 'pita':
      if (!hasBand()) {
        text = 'Selamat datang di Dreamlight Funfair! Ini gelang gratis untuk naik semua wahana hari ini 🎟️'
        options.push({ label: 'Pakai gelang 🎟️', kind: 'run', run: () => (takeBand(), audio.sfx('complete', 1), toast('🎟️ Gelang Dreamlight terpasang. Semua wahana terbuka hari ini!', 3400)) })
      } else text = 'Gelangmu sudah terpasang. Selamat bersenang-senang! ✦'
      break
    case 'roda': {
      const st = coasterState()
      text = st.phase === 'board' ? `Kereta berangkat dalam ${Math.ceil(st.left)} detik. Ayo naik!` : `${text} Kereta berikutnya siap dalam ${Math.ceil(st.phase === 'ride' ? st.left + COASTER_UNLOAD : st.left)} detik.`
      rideOption('coaster')
      break
    }
    case 'bulan':
      rideOption('wheel')
      rideOption('carousel')
      break
    case 'kiki':
      rideOption('teacups')
      rideOption('bumper')
      break
    case 'tara':
    case 'bumbum':
    case 'jepret': {
      const game = { tara: 'ringtoss', bumbum: 'cans', jepret: 'shooting' }[id]
      const best = useScores.getState().best[game]
      if (best?.mine != null) text += ` Skor terbaikmu: ${best.mine}.`
      options.push({ label: `Main ${GAMES[game].title} ${GAMES[game].icon}`, kind: 'run', run: () => openGame(game) })
      break
    }
    case 'manis':
      options.push({ label: 'Permen kapas 🍭', kind: 'run', run: () => (addMood('kenyang'), audio.sfx('pop', 1), toast('🍭 Permen kapas yang lembut dan manis. Kenyang ♡', 3000)) })
      options.push({ label: 'Jus stroberi 🍓', kind: 'run', run: () => (addMood('segar'), audio.sfx('pop', 2), toast('🍓 Jus stroberi dingin. Segar!', 3000)) })
      break
    case 'toto':
      text = announcement() || text
      break
    default:
  }
  options.push({ label: 'Dah!', kind: 'close' })
  return { text, options }
}
