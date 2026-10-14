import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { player } from './player'
import { standHeight, walkable } from './terrain'
import { useInteractable } from './interactions'
import { partner, presence } from './couple'
import { mateName } from './home'
import { releaseHand } from './hand'

/*
 * LIFE TOGETHER — sitting down and little gestures, shared with the other person.
 *
 * Seats come from things in the world (the sofa, chairs, benches, a picnic blanket…) and register
 * themselves here. Sitting and gestures are sent with the character (lib/couple.js, a few times a
 * second, only while something changes): { seat: { id, seat, at } } and { emote: { id, kind, at } }.
 * Each has its own id, starts when it's set and ends when it's cleared; if the other person goes
 * offline their character simply disappears, so nobody can get stuck sitting or waving.
 * Nothing here is stored in the database.
 */

/** How far below the seat surface the avatar's feet go when she sits (her hips are 0.38 up). */
export const SEAT_DROP = 0.33

export const EMOTES = {
  wave: { label: 'Lambaikan tangan', icon: '👋', seconds: 2.4 },
  heart: { label: 'Kirim hati', icon: '💗', seconds: 2.6 },
  happy: { label: 'Senang', icon: '✨', seconds: 2.0 },
  photo: { label: 'Pose foto', icon: '📸', seconds: 4.0 },
  call: { label: 'Panggil', icon: '📣', seconds: 2.4 },
}

const uid = () => crypto.randomUUID()

/* ───────── seats ───────── */

/** Every seat in the world right now: id → { x, z, y (seat surface), yaw, exit: [x, z], group, label }. */
export const seats = new Map()

/**
 * Register a seat while the component is mounted. `def`: { x, z, y, yaw, exit, group, label, enabled? }
 * (world space). It also becomes an interaction ("Duduk" / "Berdiri").
 */
export function useSeat(id, def) {
  const ref = useRef(def)
  ref.current = def
  const pos = useRef(new THREE.Vector3())
  useEffect(() => {
    seats.set(id, {
      get def() {
        return ref.current
      },
    })
    return () => seats.delete(id)
  }, [id])
  useInteractable(`seat:${id}`, {
    get position() {
      return pos.current.set(ref.current.x, ref.current.y, ref.current.z)
    },
    radius: 1.15,
    priority: 0.15,
    label: () => (player.seat === id ? 'Berdiri' : seatTaken(id) ? `${mateName()} duduk di sini` : ref.current.label || 'Duduk'),
    enabled: () => (ref.current.enabled ? ref.current.enabled() : true) && (player.seat === id || !seatTaken(id)),
    onInteract: () => (player.seat === id ? standUp() : sitAt(id)),
  })
}

const seatDef = (id) => seats.get(id)?.def
/** Is the other person sitting there? */
export const seatTaken = (id) => partner.online && partner.seat?.seat === id

/** Sit down on a seat (walks nowhere: she has to be near it, like any interaction). */
export function sitAt(id) {
  const s = seatDef(id)
  if (!s || seatTaken(id)) return false
  releaseHand('sit') // let go of hands to sit down
  if (!player.seat) player.sitFrom = [player.position.x, player.position.z]
  player.seat = id
  player.walkTarget = null
  player.onArrive = null
  player.speed = 0
  player.position.set(s.x, s.y - SEAT_DROP, s.z)
  player.yaw = s.yaw
  presence.seat = { id: uid(), seat: id, at: Date.now() }
  return true
}

/** Stand up beside the seat (or back where she came from, if that's blocked). */
export function standUp() {
  if (!player.seat) return
  const s = seatDef(player.seat)
  const options = [s?.exit, player.sitFrom].filter(Boolean)
  const spot = options.find(([x, z]) => walkable(x, z)) || options[options.length - 1]
  if (spot) player.position.set(spot[0], standHeight(spot[0], spot[1]), spot[1])
  player.seat = null
  player.sitFrom = null
  presence.seat = null
}

/** Keep her on her seat while it lasts (the seat may move, or disappear when furniture is moved). */
export function holdSeat() {
  const s = seatDef(player.seat)
  if (!s) return standUp()
  player.position.set(s.x, s.y - SEAT_DROP, s.z)
  player.yaw = s.yaw
  player.speed = 0
}

/** Another free seat on the same piece of furniture, if there is one. */
export function freeSibling(id) {
  const g = seatDef(id)?.group
  if (!g) return null
  for (const [other, s] of seats) if (other !== id && s.def.group === g && !seatTaken(other)) return other
  return null
}

/* ───────── gestures ───────── */

let emoteTimer = null
/** Do a gesture (the other person sees it too). `extra`: e.g. { seat } when inviting her to sit. */
export function emote(kind, extra = {}) {
  const e = EMOTES[kind]
  if (!e) return
  clearTimeout(emoteTimer)
  player.emote = { kind, t0: performance.now() / 1000 }
  presence.emote = { id: uid(), kind, at: Date.now(), ...extra }
  emoteTimer = setTimeout(() => {
    player.emote = null
    presence.emote = null
  }, e.seconds * 1000)
}

/** The other person's current gesture, timed from when it reached us. */
const remote = { id: null, kind: null, t0: 0 }
export function partnerEmote() {
  const e = partner.online ? partner.emote : null
  if (!e) {
    remote.id = null
    return null
  }
  if (e.id !== remote.id) {
    remote.id = e.id
    remote.kind = e.kind
    remote.t0 = performance.now() / 1000
  }
  return EMOTES[remote.kind] && performance.now() / 1000 - remote.t0 < EMOTES[remote.kind].seconds ? remote : null
}
