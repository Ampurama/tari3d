import { create } from 'zustand'
import { partner, presence, useCouple } from './couple'
import { player } from './player'
import { uid } from './uid'
import { useStore } from '../store'
import { earnCoins, mateName } from './home'
import { addMood, MOODS } from './mood'
import { releaseHand } from './hand'
import { standUp } from './actions'
import { sipDone } from './cafe'
import { standHeight, walkable } from './terrain'

/*
 * LIVING IN THE HOUSE — like The Sims: using the furniture (sleep in the bed, cook at the stove,
 * soak in the bath, read, watch TV, eat, grab a snack) and doing things together (a hug, a chat,
 * a dance, cooking side by side).
 *
 * An activity places her at the piece of furniture, plays its pose for a little while (moving
 * cancels it), and when it's done brings a moodlet (lib/mood.js) and heart coins (the server decides
 * how many and when it counts again: house_reward() in 009_sims_home.sql).
 * What she's doing travels with her character (presence.act), so the other person sees it.
 * Doing things together asks first, the same way holding hands does (presence.together).
 */

export const ACTS = {
  sleep: { label: 'Tidur', icon: '💤', seconds: 9, mood: 'berenergi', reward: 'sleep', done: 'Bangun dengan segar ☀️' },
  eat: { label: 'Makan', icon: '🍽️', seconds: 7, mood: 'kenyang', reward: 'eat', done: 'Kenyang ♡' },
  snack: { label: 'Ambil camilan', icon: '🍓', seconds: 4, mood: 'kenyang', reward: 'snack', done: 'Camilannya enak 🍓' },
  cook: { label: 'Masak', icon: '🍳', seconds: 9, mood: 'jago_masak', reward: 'cook', done: 'Masakannya jadi! 🍲' },
  bath: { label: 'Berendam', icon: '🛁', seconds: 9, mood: 'segar', reward: 'bath', done: 'Segar sekali 🫧' },
  read: { label: 'Baca buku', icon: '📖', seconds: 8, mood: 'terinspirasi', reward: 'read', done: 'Bukunya bagus 📖' },
  tv: { label: 'Nonton TV', icon: '📺', seconds: 10, mood: 'terhibur', reward: 'tv', done: 'Acaranya seru 📺' },
  // together
  hug: { label: 'Peluk', icon: '🤗', seconds: 5, mood: 'romantis', reward: 'together', done: 'Pelukan hangat 💞', together: true },
  talk: { label: 'Ngobrol', icon: '💬', seconds: 8, mood: 'bahagia', reward: 'together', done: 'Ngobrolnya seru 💬', together: true },
  dance: { label: 'Dansa', icon: '💃', seconds: 9, mood: 'romantis', reward: 'together', done: 'Dansa berdua 💃', together: true },
  cook_together: { label: 'Masak bareng', icon: '👩‍🍳', seconds: 10, mood: 'jago_masak', reward: 'together', done: 'Masak bareng jadi! 🍲', together: true, pose: 'cook' },
  // a sip at the café (sitting or standing; lib/cafe.js counts the sips)
  sip: { label: 'Menyeruput', icon: '☕', seconds: 2.6, keepSeat: true, quiet: true },
}
/** The pose an activity plays (most are named after themselves). */
export const poseOf = (kind) => ACTS[kind]?.pose || kind

/**
 * act: what I'm doing { kind, t0, seconds } (for the HUD's progress)
 * busy: what's going on in the house, mine or the other person's, so furniture can react
 *       (the TV switches on, the stove steams, the bath fills with bubbles)
 */
export const useLife = create(() => ({ act: null, busy: {} }))

const now = () => performance.now() / 1000
/** where she was standing before the activity put her somewhere (the bed, the bath): she steps back there */
let from = null
const toast = (text, ms = 3200) => useStore.getState().showToast(text, ms)

/** Start doing something at a spot { x, y, z, yaw } (or right where she is: no spot). `item`: the furniture's id. */
export function startAct(kind, spot, item = null) {
  const a = ACTS[kind]
  if (!a) return false
  releaseHand('sit')
  if (player.seat && kind !== 'tv' && !a.keepSeat) standUp()
  player.walkTarget = null
  player.onArrive = null
  player.speed = 0
  if (spot) {
    from = { x: player.position.x, y: player.position.y, z: player.position.z }
    player.position.set(spot.x, spot.y, spot.z)
    player.yaw = spot.yaw
  } else from = null
  player.act = { kind: poseOf(kind), t0: now() }
  presence.act = { id: uid(), kind: poseOf(kind), at: Date.now() }
  useLife.setState({ act: { kind, item, t0: now(), seconds: a.seconds } })
  return true
}

/** Stop (moving does this). No reward: it wasn't finished. */
/** Step back off the bed / out of the bath to where she came from. */
function stepBack() {
  if (from && walkable(from.x, from.z)) player.position.set(from.x, standHeight(from.x, from.z), from.z)
  from = null
}

export function cancelAct() {
  if (!useLife.getState().act) return
  stepBack()
  player.act = null
  presence.act = null
  useLife.setState({ act: null })
  if (useTogether.getState().state === 'acting') endTogether()
}

async function finishAct() {
  const { act } = useLife.getState()
  if (!act) return
  const a = ACTS[act.kind]
  stepBack()
  player.act = null
  presence.act = null
  useLife.setState({ act: null })
  if (a.together) finishTogether()
  if (act.kind === 'sip') return sipDone()
  addMood(a.mood)
  const coins = await earnCoins(a.reward)
  toast(`${a.done} · ${MOODS[a.mood].icon} ${MOODS[a.mood].label}${coins ? ` · +${coins} koin` : ''}`)
}

/**
 * Every frame (from the player controller): `moving` = she's trying to walk. Moving cancels;
 * time up finishes. Also keeps track of what the other person is doing in the house.
 */
export function tickLife(moving) {
  const { act, busy } = useLife.getState()
  if (act) {
    if (moving) cancelAct()
    else if (now() - act.t0 >= act.seconds) finishAct()
  }
  // what's going on in the house (mine and theirs), for the furniture
  const mine = player.act?.kind || null
  const theirs = partner.online ? partner.act?.kind || null : null
  const next = { tv: mine === 'tv' || theirs === 'tv', cook: mine === 'cook' || theirs === 'cook', bath: mine === 'bath' || theirs === 'bath', eat: mine === 'eat' || theirs === 'eat' }
  if (next.tv !== busy.tv || next.cook !== busy.cook || next.bath !== busy.bath || next.eat !== busy.eat) useLife.setState({ busy: next })
  tickTogether()
}

/* ───────── together: ask first (like holding hands) ───────── */

/**
 * state: 'none' | 'inviting' (I asked) | 'joining' (I said yes, waiting for them to start) | 'acting'
 * incoming: { id, kind } an invitation for me
 */
export const useTogether = create(() => ({ state: 'none', id: null, kind: null, since: 0, incoming: null }))
const tset = (patch) => useTogether.setState(patch)
const tget = () => useTogether.getState()
const INVITE_S = 30
const dismissed = new Set()

/** Is the other person close enough to do something together? */
export function canTogether() {
  const s = useStore.getState()
  if (useCouple.getState().status !== 'connected' || !partner.online || !partner.shown.ok) return false
  if (s.phase !== 'world' || s.view !== 'explore' || player.act || partner.act) return false
  return Math.hypot(partner.shown.x - player.position.x, partner.shown.z - player.position.z) < 2.6
}

/** Ask the other person to do something together. */
export function inviteTogether(kind) {
  if (!ACTS[kind]?.together || tget().state !== 'none' || !canTogether()) return false
  const id = uid()
  presence.together = { id, kind, state: 'invite', at: Date.now() }
  tset({ state: 'inviting', id, kind, since: now(), incoming: null })
  return true
}

export function acceptTogether() {
  const inv = tget().incoming
  if (!inv) return
  presence.together = { id: inv.id, kind: inv.kind, state: 'accept', at: Date.now() }
  tset({ state: 'joining', id: inv.id, kind: inv.kind, since: now(), incoming: null })
}

export function declineTogether() {
  const inv = tget().incoming
  if (!inv) return
  dismissed.add(inv.id)
  presence.together = { id: inv.id, kind: inv.kind, state: 'decline', at: Date.now() }
  tset({ incoming: null })
  setTimeout(() => {
    if (presence.together?.state === 'decline') presence.together = null
  }, 4000)
}

/** Done together: say so for a moment (so the other one finishes too, rather than stopping), then clear. */
function finishTogether() {
  if (presence.together) presence.together = { ...presence.together, state: 'done', at: Date.now() }
  const id = presence.together?.id
  setTimeout(() => {
    if (presence.together?.id === id && presence.together?.state === 'done') presence.together = null
  }, 3000)
  tset({ state: 'none', id: null, kind: null, since: 0 })
}

function endTogether() {
  if (presence.together?.state !== 'decline') presence.together = null
  tset({ state: 'none', id: null, kind: null, since: 0 })
}
export const cancelTogether = () => {
  if (tget().state === 'acting') cancelAct()
  endTogether()
}

/** Where the one who answers goes: facing the one who asked (or beside them, for cooking). */
function joinSpot(kind) {
  const p = partner.shown
  if (kind === 'cook_together') {
    // beside them at the stove, facing the same way
    return { x: p.x + Math.cos(p.yaw) * 0.62, y: p.y, z: p.z - Math.sin(p.yaw) * 0.62, yaw: p.yaw }
  }
  const gap = kind === 'hug' ? 0.42 : kind === 'dance' ? 0.55 : 0.85
  return { x: p.x + Math.sin(p.yaw) * gap, y: p.y, z: p.z + Math.cos(p.yaw) * gap, yaw: p.yaw + Math.PI }
}

function tickTogether() {
  const s = tget()
  const pt = partner.online ? partner.together : null
  if (!partner.online) {
    if (s.incoming) tset({ incoming: null })
    if (s.state !== 'none') cancelTogether()
    return
  }
  if (s.state === 'none') {
    if (pt?.state === 'invite' && ACTS[pt.kind]?.together && !dismissed.has(pt.id) && s.incoming?.id !== pt.id) tset({ incoming: { id: pt.id, kind: pt.kind, seen: now() } })
    else if (s.incoming && (pt?.id !== s.incoming.id || pt.state !== 'invite' || now() - s.incoming.seen > INVITE_S)) {
      dismissed.add(s.incoming.id)
      tset({ incoming: null })
    }
    return
  }
  if (s.state === 'inviting') {
    if (pt?.id === s.id && pt.state === 'accept') {
      // I asked, so I stay where I am, turned toward them (or toward the stove), and we begin
      const yaw = s.kind === 'cook_together' ? player.yaw : Math.atan2(partner.shown.x - player.position.x, partner.shown.z - player.position.z)
      startAct(s.kind, { x: player.position.x, y: player.position.y, z: player.position.z, yaw })
      presence.together = { id: s.id, kind: s.kind, state: 'go', at: Date.now() }
      tset({ state: 'acting' })
    } else if (pt?.id === s.id && pt.state === 'decline') {
      endTogether()
      toast(`${mateName()} belum mau sekarang. Nggak apa-apa ♡`)
    } else if (now() - s.since > INVITE_S) {
      endTogether()
      toast('Ajakannya belum dijawab.')
    }
    return
  }
  if (s.state === 'joining') {
    if (pt?.id === s.id && pt.state === 'go') {
      startAct(s.kind, joinSpot(s.kind))
      presence.together = { id: s.id, kind: s.kind, state: 'go', at: Date.now() }
      tset({ state: 'acting' })
    } else if (pt?.id !== s.id || now() - s.since > 8) endTogether()
    return
  }
  // acting: if they stopped, we stop too (and it doesn't count)
  if (!(pt?.id === s.id && (pt.state === 'go' || pt.state === 'done')) && now() - (useLife.getState().act?.t0 || 0) > 1) cancelAct()
}
