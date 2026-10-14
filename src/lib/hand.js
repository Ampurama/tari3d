import { create } from 'zustand'
import { partner, presence, useCouple } from './couple'
import { player } from './player'
import { walkable } from './terrain'
import { uid } from './uid'
import { useStore } from '../store'
import { mateName } from './home'

/*
 * HAND IN HAND — holding hands while you walk.
 *
 * It travels with your characters on the private Realtime channel (lib/couple.js), the only place
 * the other person's game can hear from you, and where each of you can only speak for yourself:
 *   presence.hand = { id, state: 'invite' | 'accept' | 'decline' | 'hold', at }
 * The one who asks leads; the other walks beside them (on their right), steered by her own
 * character controller with the same collision rules as always. Nothing is stored.
 *
 * It ends by itself, on both sides, when either lets go, goes offline, or you drift too far apart
 * (or the follower can't get through). An unanswered invitation runs out after 30 seconds.
 */

export const HAND_OFFSET = 0.55
const INVITE_MS = 30000
const MAX_GAP = 5

/**
 * state: 'none' | 'inviting' (I asked) | 'joining' (I said yes, waiting for them) | 'holding'
 * incoming: an invitation for me { id, at } · leader: I lead while holding
 */
export const useHand = create(() => ({ state: 'none', id: null, leader: false, since: 0, incoming: null }))
const set = (patch) => useHand.setState(patch)
const get = () => useHand.getState()
const toast = (text) => useStore.getState().showToast(text, 3800)

const dismissed = new Set()
let farFor = 0
let blockedFor = 0
let declineTimer = null

export const holding = () => get().state === 'holding'

/** Can we start holding hands right now? (both on the island, close, nobody sitting) */
export function canAskHand() {
  const s = useStore.getState()
  if (useCouple.getState().status !== 'connected' || !partner.online || !partner.shown.ok) return false
  if (s.phase !== 'world' || s.view !== 'explore' || player.seat || partner.seat) return false
  return Math.hypot(partner.shown.x - player.position.x, partner.shown.z - player.position.z) < 2.2
}

/** "Ajak Gandengan" */
export function inviteHand() {
  if (get().state !== 'none' || !canAskHand()) return
  const id = uid()
  presence.hand = { id, state: 'invite', at: Date.now() }
  set({ state: 'inviting', id, leader: true, since: performance.now(), incoming: null })
}

/** "Terima" */
export function acceptHand() {
  const inv = get().incoming
  if (!inv) return
  presence.hand = { id: inv.id, state: 'accept', at: Date.now() }
  set({ state: 'joining', id: inv.id, leader: false, since: performance.now(), incoming: null })
}

/** "Tolak" (it shows on their side for a moment, then it's gone) */
export function declineHand() {
  const inv = get().incoming
  if (!inv) return
  dismissed.add(inv.id)
  presence.hand = { id: inv.id, state: 'decline', at: Date.now() }
  set({ incoming: null })
  clearTimeout(declineTimer)
  declineTimer = setTimeout(() => {
    if (presence.hand?.state === 'decline') presence.hand = null
  }, 4000)
}

const MESSAGES = {
  self: null,
  them: () => `${mateName()} melepas gandengan.`,
  offline: () => `Gandengan terlepas: ${mateName()} terputus.`,
  far: () => 'Gandengan terlepas karena kalian terlalu jauh.',
  blocked: () => 'Gandengan terlepas: jalannya terhalang.',
  sit: null,
}

/** "Lepas Gandengan" (or it ends by itself, with a reason). */
export function releaseHand(reason = 'self') {
  if (get().state === 'none' && !presence.hand) return
  if (presence.hand?.state !== 'decline') presence.hand = null
  const wasHolding = get().state === 'holding'
  set({ state: 'none', id: null, leader: false, since: 0 })
  farFor = 0
  blockedFor = 0
  const msg = MESSAGES[reason]
  if (wasHolding && msg) toast(msg())
}

/** Runs every frame: follows what the other person's game says, and ends things that should end. */
export function tickHand(delta) {
  const s = get()
  const ph = partner.online ? partner.hand : null

  if (!partner.online) {
    if (s.incoming) set({ incoming: null })
    if (s.state !== 'none') releaseHand(s.state === 'holding' ? 'offline' : 'self')
    return
  }

  // an invitation for me (shown until answered, withdrawn, or 30 s old)
  if (s.state === 'none') {
    if (ph?.state === 'invite' && !dismissed.has(ph.id) && s.incoming?.id !== ph.id) set({ incoming: { id: ph.id, seen: performance.now() } })
    else if (s.incoming && (ph?.id !== s.incoming.id || ph.state !== 'invite' || performance.now() - s.incoming.seen > INVITE_MS)) {
      dismissed.add(s.incoming.id)
      set({ incoming: null })
    }
    return
  }

  if (s.state === 'inviting') {
    if (ph?.id === s.id && ph.state === 'accept') {
      presence.hand = { id: s.id, state: 'hold', at: Date.now() }
      set({ state: 'holding', since: performance.now() })
    } else if (ph?.id === s.id && ph.state === 'decline') {
      releaseHand('self')
      toast(`${mateName()} belum mau gandengan sekarang. Nggak apa-apa ♡`)
    } else if (ph?.state === 'invite' && ph.id !== s.id) {
      // we both asked at once: the earlier invitation wins, the other one just says yes to it
      const mine = presence.hand?.at || 0
      const myId = useCouple.getState().me?.id || ''
      const mateId = useCouple.getState().mate?.id || ''
      if (ph.at < mine || (ph.at === mine && mateId < myId)) {
        set({ state: 'none', incoming: { id: ph.id, seen: performance.now() } })
        acceptHand()
      }
    } else if (performance.now() - s.since > INVITE_MS) {
      releaseHand('self')
      toast('Ajakan gandengannya belum dijawab.')
    }
    return
  }

  if (s.state === 'joining') {
    if (ph?.id === s.id && ph.state === 'hold') {
      presence.hand = { id: s.id, state: 'hold', at: Date.now() }
      set({ state: 'holding', since: performance.now() })
    } else if (ph?.id !== s.id || performance.now() - s.since > 8000) releaseHand('self')
    return
  }

  // holding: still holding on their side? still close enough?
  if (!(ph?.id === s.id && (ph.state === 'hold' || ph.state === 'accept'))) return releaseHand('them')
  const gap = Math.hypot(partner.shown.x - player.position.x, partner.shown.z - player.position.z)
  farFor = gap > MAX_GAP ? farFor + delta : 0
  if (farFor > 1.5) releaseHand('far')
}

/** For the follower's controller: where to walk (beside the leader), or null. */
export function handFollow() {
  const s = get()
  if (s.state !== 'holding' || s.leader || !partner.shown.ok) return null
  const l = partner.shown
  const side = { x: l.x + Math.cos(l.yaw) * HAND_OFFSET, z: l.z - Math.sin(l.yaw) * HAND_OFFSET }
  // no room beside them (the sky bridge, a doorway): fall in just behind instead
  const spot = walkable(side.x, side.z) ? side : { x: l.x - Math.sin(l.yaw) * 0.6, z: l.z - Math.cos(l.yaw) * 0.6 }
  return { ...spot, yaw: l.yaw, speed: l.speed }
}

/** The follower couldn't take a step toward the leader (a wall, the edge…). */
export function followBlocked(delta, far) {
  blockedFor = far ? blockedFor + delta : 0
  if (blockedFor > 2.5) releaseHand('blocked')
}

/** Which hand reaches out: the leader's right, the follower's left. */
export const myHand = () => (get().state === 'holding' ? (get().leader ? 'right' : 'left') : null)
export const mateHand = () => (get().state === 'holding' ? (get().leader ? 'left' : 'right') : null)
