import * as THREE from 'three'
import { create } from 'zustand'
import { blockers, obstacles } from './terrain'
import { CAFE_SITE, meadowHeight } from './meadow'
import { partner, presence } from './couple'
import { player } from './player'
import { uid } from './uid'
import { useStore } from '../store'
import { addMood } from './mood'
import { earnCoins, mateName } from './home'
import { startAct } from './life'

/*
 * THE LITTLE GNOME CAFÉ — a little café on the meadow, south-east of the main meadow, run by two
 * gnomes: a barista behind the counter and a waiter who greets you and brings orders to your table.
 *
 * Everything is in café-local metres (its front, with the door, faces +z) and turned into the world
 * by toWorld(). Ordering: choose a drink → the barista makes it → the waiter brings it to your table
 * (if you're sitting at one) or the barista hands it over → hold it, put it down on a table, and sip
 * it until it's finished. Nothing is stored: what you're doing travels with your character
 * (presence.order and presence.cup), so the other person sees the same café — the barista making
 * your drink, the waiter carrying it, your cup on the table.
 */

/** Where the café stands: on flat meadow ground (lib/meadow.js levels a pad for it). */
export const CAFE = CAFE_SITE
const cos = Math.cos(CAFE.yaw)
const sin = Math.sin(CAFE.yaw)
/** café-local (x across, z toward the front) → world [x, z] */
export const toWorld = (x, z) => [CAFE.x + x * cos + z * sin, CAFE.z - x * sin + z * cos]
/** world → café-local [x, z] */
export const toCafe = (x, z) => {
  const dx = x - CAFE.x
  const dz = z - CAFE.z
  return [dx * cos - dz * sin, dx * sin + dz * cos]
}
/** The floor's height: the ground she walks on (the pad is level; the floor is drawn flush with it). */
let floorY = null
export const cafeFloor = () => (floorY ??= meadowHeight(CAFE.x, CAFE.z))

/* ───────── the building ───────── */

/** The room inside the walls, the walls' height and thickness, and the terrace in front. */
export const ROOM = { hw: 3.0, hd: 2.5 }
export const CAFE_WALL_H = 2.35
export const CAFE_WALL_T = 0.18
export const DOOR_W = 1.25
export const TERRACE = { z0: ROOM.hd, z1: ROOM.hd + 2.6, hw: ROOM.hw + 0.3 }
/** Windows: [wall, centre along it (café-local x for front/back, z for the sides), width]. */
export const CAFE_WINDOWS = [
  ['front', -1.9, 1.1],
  ['front', 1.9, 1.1],
  ['left', -0.9, 1.0],
  ['left', 1.1, 1.0],
  ['right', -0.9, 1.0],
  ['right', 1.1, 1.0],
]

/** The counter along the back, and where the gnomes work. */
export const COUNTER = { x0: -2.3, x1: 1.1, z: -1.45, d: 0.62 }
export const MACHINE_X = -1.5
export const BARISTA_SPOT = { x: -0.6, z: -2.0 }
/** Where she stands to order (in front of the counter). */
export const ORDER_SPOT = { x: -0.6, z: -0.75 }
export const WAITER_HOME = { x: 2.15, z: 1.55 }

/** Tables: café-local centre, and which way its two chairs face each other along (x or z). */
export const TABLES = [
  { id: 't1', x: -1.7, z: 0.75, axis: 'x', out: false },
  { id: 't2', x: 1.2, z: 0.95, axis: 'x', out: false },
  { id: 't3', x: 2.15, z: -0.75, axis: 'z', out: false },
  { id: 't4', x: -1.75, z: 3.75, axis: 'x', out: true },
  { id: 't5', x: 1.75, z: 3.75, axis: 'x', out: true },
]
/** Each table's two chairs: seat id, café-local position, and the yaw (café-local) that faces the table. */
export const CHAIRS = TABLES.flatMap((t) =>
  [-1, 1].map((side, i) => {
    const x = t.axis === 'x' ? t.x + side * 0.62 : t.x
    const z = t.axis === 'z' ? t.z + side * 0.62 : t.z
    // facing the table: from the chair toward its centre
    const yaw = Math.atan2(t.x - x, t.z - z)
    return { id: `cafe:${t.id}:${i}`, table: t.id, x, z, yaw, cup: [t.x + (x - t.x) * 0.3, t.z + (z - t.z) * 0.3] }
  }),
)
export const chairOf = (seatId) => CHAIRS.find((c) => c.id === seatId) || null
export const tableOf = (id) => TABLES.find((t) => t.id === id) || null

/** Is (x, z) (world) inside the café's room? (for the roof and the walls that fold down) */
export const inCafe = (x, z) => {
  const [lx, lz] = toCafe(x, z)
  return Math.abs(lx) < ROOM.hw && lz > -ROOM.hd && lz < ROOM.hd
}

/* ───────── walking: walls (with the door), the counter, tables and chairs ───────── */

const segDist = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
const BODY = 0.22
const WALLS = [
  [-ROOM.hw, -ROOM.hd, ROOM.hw, -ROOM.hd],
  [-ROOM.hw, -ROOM.hd, -ROOM.hw, ROOM.hd],
  [ROOM.hw, -ROOM.hd, ROOM.hw, ROOM.hd],
  [-ROOM.hw, ROOM.hd, -DOOR_W / 2, ROOM.hd],
  [DOOR_W / 2, ROOM.hd, ROOM.hw, ROOM.hd],
]
const RECTS = [
  // the counter (and the space behind it, which is the barista's)
  { x0: COUNTER.x0 - BODY, x1: COUNTER.x1 + BODY, z0: -ROOM.hd, z1: COUNTER.z + COUNTER.d / 2 + BODY * 0.6 },
  // the tables
  ...TABLES.map((t) => ({ x0: t.x - 0.42, x1: t.x + 0.42, z0: t.z - 0.42, z1: t.z + 0.42 })),
]
blockers.push((wx, wz) => {
  if (Math.hypot(wx - CAFE.x, wz - CAFE.z) > 7) return false
  const [x, z] = toCafe(wx, wz)
  const [px, pz] = toCafe(player.position.x, player.position.z)
  // never trap her inside a wall (she can always walk out of one)
  if (WALLS.some(([ax, az, bx, bz]) => segDist(x, z, ax, az, bx, bz) < BODY) && !WALLS.some(([ax, az, bx, bz]) => segDist(px, pz, ax, az, bx, bz) < BODY)) return true
  return RECTS.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && !(px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1))
})
obstacles.version++

/* ───────── the menu ───────── */

export const DRINKS = {
  espresso: { label: 'Espresso', icon: '☕', text: 'Kecil, pekat, dan bikin melek.', color: '#4a2c20', foam: '#c9905c', seconds: 5 },
  cappuccino: { label: 'Cappuccino', icon: '☕', text: 'Busa susu yang lembut di atas espresso.', color: '#8a5a3c', foam: '#f6ead8', seconds: 7 },
  latte: { label: 'Latte', icon: '🥛', text: 'Susu hangat dengan latte art berbentuk hati.', color: '#b07f58', foam: '#fbf1e2', seconds: 7 },
  hot_chocolate: { label: 'Hot Chocolate', icon: '🍫', text: 'Cokelat panas dengan marshmallow.', color: '#5b3426', foam: '#ffe9f2', seconds: 6 },
  matcha: { label: 'Matcha Latte', icon: '🍵', text: 'Teh hijau yang lembut dan manis.', color: '#8fbf6a', foam: '#eef7df', seconds: 7 },
  strawberry: { label: 'Susu Stroberi', icon: '🍓', text: 'Pink, manis, dan dingin.', color: '#f7a8c4', foam: '#fff0f6', seconds: 5 },
}
export const SIPS = 4

/* ───────── my order and my cup (the other person's come from their character) ───────── */

/**
 * order: { id, drink, state: 'brewing' | 'serving' | 'carrying', t0, seat } (one at a time)
 *   brewing: the barista makes it · serving: the barista hands it over · carrying: the waiter brings it
 * cup: { id, drink, where: 'hand' | 'table', seat (chair id, when on a table), sips }
 */
export const useCafe = create(() => ({ order: null, cup: null, near: false, inside: false }))
const get = () => useCafe.getState()
const set = (patch) => useCafe.setState(patch)
const toast = (text, ms = 3200) => useStore.getState().showToast(text, ms)
const now = () => performance.now() / 1000

/** Send what I'm doing at the café with my character (so her café looks the same). */
function share() {
  const { order, cup } = get()
  presence.order = order ? { id: order.id, kind: order.drink, state: order.state, at: Math.round(order.t0 * 1000), ...(order.seat ? { seat: order.seat } : {}) } : null
  presence.cup = cup ? { id: cup.id, kind: cup.drink, state: cup.where, ...(cup.seat ? { seat: cup.seat } : {}) } : null
}

/** "Pesan": start an order (one at a time; not while holding a full cup). */
export function orderDrink(drink) {
  if (!DRINKS[drink] || get().order) return false
  if (get().cup) {
    toast('Habiskan dulu minumanmu, ya ☕')
    return false
  }
  // sitting at a café table? the waiter will bring it there
  const seat = player.seat && chairOf(player.seat) ? player.seat : null
  set({ order: { id: uid(), drink, state: 'brewing', t0: now(), seat } })
  share()
  toast(`${DRINKS[drink].label} sedang diracik barista ☕`, 2600)
  return true
}

/** How long the waiter takes to walk to a table and back (café-local metres → seconds). */
export const WAITER_SPEED = 1.1
export const waiterLeg = (seat) => {
  const c = chairOf(seat)
  if (!c) return 0
  // (out on the terrace: the long way, through the door)
  const out = tableOf(c.table)?.out
  const d = out ? Math.hypot(BARISTA_SPOT.x, ROOM.hd - (COUNTER.z + 0.7)) + Math.hypot(c.cup[0], c.cup[1] - ROOM.hd) : Math.hypot(c.cup[0] - BARISTA_SPOT.x, c.cup[1] - (COUNTER.z + 0.7))
  return d / WAITER_SPEED + 1.2
}

/** Put my cup down on the table in front of the chair `seat`. */
export function putCup(seat) {
  const { cup } = get()
  if (!cup || cup.where !== 'hand' || !chairOf(seat) || cupAt(seat)) return false
  set({ cup: { ...cup, where: 'table', seat } })
  share()
  return true
}
/** Pick my cup up from its table. */
export function takeCup() {
  const { cup } = get()
  if (!cup || cup.where !== 'table') return false
  set({ cup: { ...cup, where: 'hand', seat: null } })
  share()
  return true
}
/** Is there a cup (mine or hers) on the table in front of a chair? */
export function cupAt(seat) {
  const mine = get().cup
  if (mine?.where === 'table' && mine.seat === seat) return 'mine'
  const theirs = partner.online ? partner.cup : null
  if (theirs?.state === 'table' && theirs.seat === seat) return 'theirs'
  return null
}

/**
 * Drink: a sip (lib/life.js plays it). If the cup is on the table in front of her chair, she lifts
 * it, sips, and sets it back down.
 */
export function drinkCup() {
  const { cup } = get()
  if (!cup || player.act) return false
  if (cup.where === 'table') {
    if (!(player.seat && player.seat === cup.seat)) return false
    set({ cup: { ...cup, where: 'hand', seat: null, back: cup.seat } })
    share()
  }
  return startAct('sip')
}

/** A sip is done. After the last one the cup is finished. */
export function sipDone() {
  const { cup } = get()
  if (!cup) return
  const sips = cup.sips + 1
  if (sips >= SIPS) {
    set({ cup: null })
    share()
    addMood('ngopi')
    toast(`${DRINKS[cup.drink].label}-nya habis. Enak banget ☕ · Ngopi santai`, 3400)
    return
  }
  // lifted from the table: back down it goes
  const back = cup.back && player.seat === cup.back && !cupAt(cup.back) ? cup.back : null
  set({ cup: back ? { ...cup, sips, where: 'table', seat: back, back: null } : { ...cup, sips, back: null } })
  share()
}

/** The colour of the drink she's holding (for her avatar), or null. */
export const heldDrink = () => {
  const c = get().cup
  return c?.where === 'hand' ? DRINKS[c.drink].color : null
}
/** …and the other person's. */
export const partnerDrink = () => (partner.online && partner.cup?.state === 'hand' ? DRINKS[partner.cup.kind]?.color || null : null)

/** Hand back an unfinished cup (it's cleared away). */
export function leaveCup() {
  if (!get().cup) return
  set({ cup: null })
  share()
}

/** Every frame: the order moves along; drinking together is noticed. */
let together = 0
export function tickCafe() {
  const { order, near, inside } = get()
  const d = Math.hypot(player.position.x - CAFE.x, player.position.z - CAFE.z)
  const isNear = d < 9
  const isInside = inCafe(player.position.x, player.position.z)
  if (isNear !== near || isInside !== inside) set({ near: isNear, inside: isInside })
  if (order) {
    const def = DRINKS[order.drink]
    const t = now() - order.t0
    if (order.state === 'brewing' && t >= def.seconds) {
      // made: the waiter takes it to her table, or the barista hands it to her
      const seat = order.seat && player.seat === order.seat ? order.seat : null
      set({ order: { ...order, state: seat ? 'carrying' : 'serving', t0: now(), seat } })
      share()
      if (!seat) toast(`${def.label}-mu siap! Barista menyerahkannya ☕`, 2600)
    } else if (order.state === 'serving' && t >= 1.4) {
      set({ order: null, cup: { id: order.id, drink: order.drink, where: 'hand', seat: null, sips: 0 } })
      share()
    } else if (order.state === 'carrying' && t >= waiterLeg(order.seat)) {
      // the waiter set it down in front of her (if that place is still free; otherwise into her hands)
      const free = !cupAt(order.seat)
      set({ order: null, cup: { id: order.id, drink: order.drink, where: free ? 'table' : 'hand', seat: free ? order.seat : null, sips: 0 } })
      share()
      toast(`Pelayan mengantar ${def.label}-mu. Selamat menikmati ☕`, 2800)
    }
  }
  // coffee together: both at the same table, both with a cup
  const mine = player.seat && chairOf(player.seat)
  const theirs = partner.online && partner.seat?.seat && chairOf(partner.seat.seat)
  const both = mine && theirs && mine.table === theirs.table && get().cup && partner.cup
  together = both ? together + 1 : 0
  if (together === 120) {
    addMood('romantis')
    earnCoins('together').then((n) => toast(`Ngopi bareng ${mateName()} ☕💕${n ? ` · +${n} koin` : ''}`, 3600))
  }
}

/** A chair's world position and yaw, for useSeat. */
export function chairWorld(c) {
  const [x, z] = toWorld(c.x, c.z)
  const y = cafeFloor() + 0.45
  const [ex, ez] = toWorld(c.x - Math.sin(c.yaw) * 0.55, c.z - Math.cos(c.yaw) * 0.55)
  return { x, z, y, yaw: c.yaw + CAFE.yaw, exit: [ex, ez] }
}

/** A world point for a café-local one (at floor height + `lift`). */
export const cafePoint = (x, z, lift = 0) => {
  const [wx, wz] = toWorld(x, z)
  return new THREE.Vector3(wx, cafeFloor() + lift, wz)
}

/** Is she sitting at a café chair, and which one? */
export const mySeat = () => (player.seat && chairOf(player.seat) ? player.seat : null)
