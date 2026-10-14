import { create } from 'zustand'
import * as THREE from 'three'
import { onRoom, supabase, useCouple } from './couple'
import { player } from './player'
import { blockers, obstacles, standHeight, walkable } from './terrain'
import { skyPoint } from './skyLayout'
import { useStore } from '../store'

/*
 * HOT AIR BALLOON — one shared balloon between the main island and Sky Island.
 *
 * The single source of truth is the `balloon` row in Supabase (supabase/migrations/006_balloon.sql):
 * where it's docked, who's in its two seats, who's ready, and when it took off. Every change is a
 * server function that checks who's asking. Its position in the air is never sent anywhere: both
 * games compute it from `departed_at` + the fixed route below, on the server's clock, so both of
 * you see the same balloon at the same place. The two characters ride in fixed spots in the basket.
 */

export const FLIGHT_MS = 40000

/* ───────── the docks and the route ───────── */

const mainPad = (() => {
  const x = 5.0
  const z = -1.0
  return new THREE.Vector3(x, standHeight(x, z), z)
})()
const skyPad = skyPoint(-3.2, -1.4)
export const PADS = { main: mainPad, sky: skyPad }
export const PLACE_NAMES = { main: 'Pulau Utama', sky: 'Sky Island' }

/** Up from the meadow by the Love Tree, east over the clouds (well above the rope bridge), down onto Sky Island. */
const ROUTE = new THREE.CatmullRomCurve3(
  [
    mainPad.clone(),
    mainPad.clone().add(new THREE.Vector3(0, 2.6, 0)),
    mainPad.clone().add(new THREE.Vector3(2.4, 6.4, -0.3)),
    new THREE.Vector3(14, 9.4, -1.8),
    new THREE.Vector3(23, 10.4, -3.4),
    new THREE.Vector3(skyPad.x - 4.5, skyPad.y + 7.2, skyPad.z - 0.6),
    skyPad.clone().add(new THREE.Vector3(0, 3.2, 0)),
    skyPad.clone(),
  ],
  false,
  'centripetal',
)
/** The basket always faces the way the trip goes (steady: nobody gets dizzy). */
const YAW_TO_SKY = Math.atan2(skyPad.x - mainPad.x, skyPad.z - mainPad.z)

/* ───────── state ───────── */

/** status: 'off' | 'loading' | 'ready' | 'error'; row: the balloon row from the server */
export const useBalloon = create(() => ({ status: 'off', row: null, busy: false, error: null }))
const set = (patch) => useBalloon.setState(patch)
const get = () => useBalloon.getState()
const toast = (text, ms = 3600) => useStore.getState().showToast(text, ms)

/** server time − local time (ms), measured when we load */
let clockOffset = 0
const serverNow = () => Date.now() + clockOffset

async function syncClock() {
  const t0 = Date.now()
  const { data, error } = await supabase.rpc('balloon_clock')
  if (error || !data) return
  const t1 = Date.now()
  clockOffset = new Date(data).getTime() - (t0 + t1) / 2
}

export async function loadBalloon() {
  if (!supabase || useCouple.getState().status !== 'connected') return
  if (get().status !== 'ready') set({ status: 'loading', error: null })
  const [{ data, error }] = await Promise.all([supabase.from('balloon').select('*').eq('id', 1).maybeSingle(), syncClock()])
  if (error || !data) return set({ status: 'error', error: 'Balon udara belum siap. Mungkin tabelnya belum dipasang di Supabase (006_balloon.sql).' })
  set({ status: 'ready', row: data, error: null })
}

onRoom({
  attach(channel) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'balloon' }, (p) => {
      if (p.eventType !== 'DELETE' && p.new?.id === 1) set({ row: p.new })
    })
  },
  subscribed: () => loadBalloon(),
  left: () => set({ status: 'off', row: null }),
})
useCouple.subscribe((s, prev) => {
  if (s.status === prev.status) return
  if (s.status === 'connected') loadBalloon()
  else set({ status: 'off', row: null })
})

const ERRORS = [
  ['busy', 'Balonnya sedang terbang. Tunggu sampai mendarat, ya.'],
  ['full', 'Kedua kursi di keranjang sudah terisi.'],
  ['flying', 'Masih di udara. Tunggu sampai balon mendarat untuk turun.'],
  ['not aboard', 'Kamu belum naik balon.'],
]
async function call(fn, args) {
  if (!supabase || get().busy) return { ok: false }
  set({ busy: true, error: null })
  const { data, error } = await supabase.rpc(fn, args)
  set({ busy: false })
  if (error) {
    const msg = ERRORS.find(([k]) => error.message?.includes(k))?.[1] || 'Belum berhasil. Coba lagi sebentar lagi, ya.'
    set({ error: msg })
    toast(msg)
    return { ok: false }
  }
  set({ row: data })
  return { ok: true }
}
export const board = () => call('balloon_board')
export const leaveBalloon = () => call('balloon_leave')
export const setBalloonReady = (ready) => call('balloon_ready', { p_ready: ready })
export const callBalloon = (to) => call('balloon_call', { p_to: to })

/* ───────── where it is, worked out from the row ───────── */

const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)))

/**
 * The balloon right now: { pos, yaw, phase, at (dock name or null), progress, from, to }.
 * phase: 'docked' | 'takeoff' | 'flying' | 'landing'. Works without a row too (docked by the Love Tree).
 */
const pos = new THREE.Vector3()
export function balloonPose(row = get().row) {
  if (row?.state === 'flying' && row.departed_at) {
    const t = (serverNow() - new Date(row.departed_at).getTime()) / FLIGHT_MS
    if (t < 1) {
      const toSky = row.dest === 'sky'
      const s = ease(t)
      pos.copy(ROUTE.getPointAt(toSky ? s : 1 - s))
      const phase = t < 0.15 ? 'takeoff' : t > 0.85 ? 'landing' : 'flying'
      return { pos, yaw: toSky ? YAW_TO_SKY : YAW_TO_SKY + Math.PI, phase, at: null, progress: t, from: toSky ? 'main' : 'sky', to: row.dest }
    }
    // its time is up: it has landed (the server agrees as soon as anyone asks it anything)
    return docked(row.dest)
  }
  return docked(row?.location || 'main')
}
function docked(at) {
  pos.copy(PADS[at])
  return { pos, yaw: at === 'sky' ? YAW_TO_SKY + Math.PI : YAW_TO_SKY, phase: 'docked', at, progress: 0, from: at, to: null }
}

/** Which seat ('a' / 'b') a person has, from the server's row. */
export const seatOf = (id, row = get().row) => (!id || !row ? null : row.seat_a === id ? 'a' : row.seat_b === id ? 'b' : null)
export const mySeat = (row) => seatOf(useCouple.getState().me?.id, row)
export const mateSeat = (row) => seatOf(useCouple.getState().mate?.id, row)

/** Where someone in seat 'a' or 'b' stands inside the basket (world space). */
const slot = new THREE.Vector3()
export function seatPosition(which, pose = balloonPose()) {
  const side = which === 'a' ? -0.27 : 0.27
  return slot.set(pose.pos.x + Math.cos(pose.yaw) * side, pose.pos.y + 0.06, pose.pos.z - Math.sin(pose.yaw) * side)
}

/* ───────── riding along ───────── */

let boardFrom = null
let boardT = 0
/** Called every frame while she's aboard: glide into her spot, then ride with the basket. */
export function holdBalloon(delta) {
  const pose = balloonPose()
  const target = seatPosition(player.balloon, pose)
  if (boardFrom) {
    boardT = Math.min(1, boardT + delta / 0.6)
    player.position.lerpVectors(boardFrom, target, ease(boardT))
    player.position.y += Math.sin(Math.PI * boardT) * 0.35 // a little hop over the rim
    if (boardT >= 1) boardFrom = null
  } else player.position.copy(target)
  player.yaw = pose.yaw
  player.speed = 0
}

/** Get into the basket (the server already gave her the seat). */
export function attach(which) {
  player.balloon = which
  player.air = false
  player.vy = 0
  player.walkTarget = null
  player.onArrive = null
  boardFrom = player.position.clone()
  boardT = 0
}

/** Step out beside the basket, somewhere solid (never mid-air, never inside anything). */
export function detach() {
  const pose = balloonPose()
  player.balloon = null
  boardFrom = null
  if (pose.phase !== 'docked') {
    // the server says she's not aboard while it flies (shouldn't happen): back to the last safe ground
    player.position.set(player.safe.x, standHeight(player.safe.x, player.safe.z), player.safe.z)
    return
  }
  const p = pose.pos
  const r = { x: Math.cos(pose.yaw), z: -Math.sin(pose.yaw) }
  const f = { x: Math.sin(pose.yaw), z: Math.cos(pose.yaw) }
  const tries = [
    [r.x * 1.3, r.z * 1.3],
    [-r.x * 1.3, -r.z * 1.3],
    [f.x * 1.4, f.z * 1.4],
    [-f.x * 1.4, -f.z * 1.4],
  ].map(([dx, dz]) => [p.x + dx, p.z + dz])
  const spot = tries.find(([x, z]) => walkable(x, z)) || [player.safe.x, player.safe.z]
  player.position.set(spot[0], standHeight(spot[0], spot[1]), spot[1])
}

/** Is this person (by id) riding in the balloon right now? */
export const aboard = (id) => Boolean(seatOf(id))

// nobody walks through the basket while it's on the ground
let blockedAt = null
blockers.push((x, z) => {
  const pose = balloonPose()
  if (pose.phase !== 'docked' || player.balloon) return false
  return (x - pose.pos.x) ** 2 + (z - pose.pos.z) ** 2 < 0.85 * 0.85
})
/** Keep the walking grid up to date when the balloon lands somewhere else. */
export function trackDock() {
  const pose = balloonPose()
  const at = pose.phase === 'docked' ? pose.at : 'air'
  if (at !== blockedAt) {
    blockedAt = at
    obstacles.version++
  }
}

