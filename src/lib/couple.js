import { createClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { player } from './player'
import { useStore } from '../store'

/*
 * PLAYING TOGETHER — the private room for the two of you (Supabase).
 *
 * Who you are is decided by Supabase Auth (email + password), never by a name or URL.
 * Whether you may enter is decided on the server: the `couple_members` table and its
 * Row Level Security / Realtime policies (supabase/migrations/001_private_couple.sql).
 * The browser only ever holds the public "anon" key, which grants nothing by itself.
 *
 * Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the feature simply stays off and
 * the game is the same single-player game as always.
 */

const URL = import.meta.env.VITE_SUPABASE_URL
// the public key: the legacy "anon" key or the newer "publishable" key (sb_publishable_…)
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const coupleAvailable = Boolean(URL && ANON)
export const supabase = coupleAvailable ? createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } }) : null

/** The partner's character, written by incoming broadcasts and read every frame by the 3D scene. */
export const partner = {
  online: false,
  lastSeen: 0,
  target: { x: 0, y: 0, z: 0, yaw: 0, speed: 0 },
  avatarId: null,
  view: null,
  session: null,
  /** the house item they're moving right now (so nobody grabs it at the same time) */
  editing: null,
  /** where they're sitting { id, seat, at } and the gesture they're making { id, kind, at } */
  seat: null,
  emote: null,
  /** holding hands: { id, state: 'invite' | 'accept' | 'decline' | 'hold', at } */
  hand: null,
  /** something they just did with the pet: { id, kind: 'pet' | 'sit', at } */
  pet: null,
  /** in the house (lib/life.js): what they're doing { id, kind (a pose), at }, how they feel
   *  (lib/mood.js) { id, kind, at }, and doing something together { id, kind, state, at } */
  act: null,
  mood: null,
  together: null,
  /** where their character is drawn right now (smoothed), written by the 3D scene */
  shown: { x: 0, y: 0, z: 0, yaw: 0, speed: 0, ok: false },
}

/** What I'm doing that the other person should know about (sent with my character). */
export const presence = { editing: null, seat: null, emote: null, hand: null, pet: null, act: null, mood: null, together: null }

const ID = /^[\w:-]{1,80}$/
/** Only well-formed little objects get through: { id, seat?, kind?, at } (strings and a number). */
function cleanAct(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !ID.test(a.id)) return null
  const out = { id: a.id, at: Number.isFinite(a.at) ? a.at : 0 }
  if (typeof a.seat === 'string' && ID.test(a.seat)) out.seat = a.seat
  if (typeof a.kind === 'string' && /^[a-z_]{1,20}$/.test(a.kind)) out.kind = a.kind
  if (typeof a.state === 'string' && /^[a-z]{1,12}$/.test(a.state)) out.state = a.state
  return out
}

/**
 * Other features (Our Little Home) listen on the same private room channel.
 * `attach(channel)` adds their listeners before it's joined; `subscribed()` runs on every (re)join,
 * so they can catch up on anything missed while offline; `left()` when the room closes.
 */
const roomHooks = []
export const onRoom = (hook) => roomHooks.push(hook)

/**
 * status: 'off' (not configured) | 'signed-out' | 'checking' | 'denied' | 'connected' | 'error'
 * me / mate: { id, role } — `role` is 'owner' or 'tari' (from the server, not the browser)
 */
export const useCouple = create(() => ({
  status: coupleAvailable ? 'checking' : 'off',
  me: null,
  mate: null,
  mateOnline: false,
  error: null,
  letters: [],
  /** the letter open in the letters panel (id) */
  reading: null,
}))

const set = (patch) => useCouple.setState(patch)
let channels = []
let sendTimer = null
let watchTimer = null
const SESSION = Math.random().toString(36).slice(2)

/* ───────── sign in / out ───────── */

export async function signIn(email, password) {
  if (!supabase) return
  set({ status: 'checking', error: null })
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) set({ status: 'signed-out', error: 'Email atau password-nya belum cocok.' })
  // onAuthStateChange takes it from here
}

export async function signOut() {
  if (!supabase) return
  await leaveRoom()
  await supabase.auth.signOut()
  set({ status: 'signed-out', me: null, mate: null, letters: [], error: null })
}

/** Ask the server who we are in this room. Non-members get nothing back (RLS) → denied. */
async function enter(session) {
  if (!session) {
    await leaveRoom()
    return set({ status: 'signed-out', me: null, mate: null, letters: [] })
  }
  set({ status: 'checking' })
  const { data, error } = await supabase.from('couple_members').select('user_id, role')
  if (error) return set({ status: 'error', error: 'Belum bisa terhubung. Coba lagi sebentar lagi, ya.' })
  const mine = data?.find((m) => m.user_id === session.user.id)
  if (!mine) {
    await leaveRoom()
    return set({ status: 'denied', me: null, mate: null, letters: [] })
  }
  const other = data.find((m) => m.user_id !== session.user.id) || null
  set({ status: 'connected', me: { id: mine.user_id, role: mine.role }, mate: other ? { id: other.user_id, role: other.role } : null, error: null })
  await joinRoom(mine.user_id, other?.user_id)
  await loadLetters()
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => enter(data.session))
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') enter(session)
    if (event === 'TOKEN_REFRESHED' && session) supabase.realtime.setAuth(session.access_token)
  })
}

/* ───────── the room: each person sends on their own topic, listens to the other's ───────── */

async function joinRoom(myId, mateId) {
  await leaveRoom()
  const { data } = await supabase.auth.getSession()
  await supabase.realtime.setAuth(data.session?.access_token)

  // my character — the server only lets me send on my own topic
  const mine = supabase.channel(`couple-player:${myId}`, { config: { private: true, broadcast: { self: false, ack: false } } })
  mine.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') set({ status: 'error', error: 'Ruang pribadinya menolak koneksi ini.' })
  })
  channels.push(mine)

  // their character
  if (mateId) {
    const theirs = supabase.channel(`couple-player:${mateId}`, { config: { private: true } })
    theirs.on('broadcast', { event: 'pose' }, ({ payload }) => {
      if (!payload) return
      // the newest session wins if they have the game open twice
      if (partner.session && payload.session !== partner.session && performance.now() - partner.lastSeen < 1500) return
      partner.session = payload.session
      partner.target = { x: +payload.x || 0, y: +payload.y || 0, z: +payload.z || 0, yaw: +payload.yaw || 0, speed: +payload.speed || 0 }
      partner.avatarId = typeof payload.avatarId === 'string' ? payload.avatarId : null
      partner.view = typeof payload.view === 'string' ? payload.view : null
      partner.editing = typeof payload.editing === 'string' ? payload.editing : null
      partner.seat = cleanAct(payload.seat)
      const emote = cleanAct(payload.emote)
      // a new call or invitation to sit: tell the UI once
      if (emote && emote.id !== partner.emote?.id && emote.kind === 'call') window.dispatchEvent(new CustomEvent('couple:call', { detail: emote }))
      partner.emote = emote
      partner.hand = cleanAct(payload.hand)
      partner.pet = cleanAct(payload.pet)
      partner.act = cleanAct(payload.act)
      partner.mood = cleanAct(payload.mood)
      partner.together = cleanAct(payload.together)
      partner.lastSeen = performance.now()
    })
    theirs.subscribe()
    channels.push(theirs)
  }

  // letters that arrive for me (the server only shows me my own), and changes to our home
  const letters = supabase
    .channel(`couple-letters:${myId}`, { config: { private: true } })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bottles', filter: `recipient=eq.${myId}` }, () => loadLetters(true))
  roomHooks.forEach((h) => h.attach?.(letters))
  letters.subscribe((status) => {
    if (status === 'SUBSCRIBED') roomHooks.forEach((h) => h.subscribed?.())
  })
  channels.push(letters)

  // send my character ~8 times a second while it changes (and a heartbeat otherwise)
  let last = ''
  let lastSent = 0
  sendTimer = setInterval(() => {
    const s = useStore.getState()
    const pose = {
      x: +player.position.x.toFixed(2),
      y: +player.position.y.toFixed(2),
      z: +player.position.z.toFixed(2),
      yaw: +player.yaw.toFixed(2),
      speed: +player.speed.toFixed(2),
      avatarId: s.avatarId || null,
      view: s.phase === 'world' ? s.view : null,
      editing: presence.editing,
      seat: presence.seat,
      emote: presence.emote,
      hand: presence.hand,
      pet: presence.pet,
      act: presence.act,
      mood: presence.mood,
      together: presence.together,
      session: SESSION,
    }
    const key = JSON.stringify(pose)
    const now = performance.now()
    if (key === last && now - lastSent < 2000) return
    last = key
    lastSent = now
    mine.send({ type: 'broadcast', event: 'pose', payload: pose })
  }, 125)

  // online / offline
  watchTimer = setInterval(() => {
    const online = performance.now() - partner.lastSeen < 5000
    if (online !== partner.online) {
      partner.online = online
      set({ mateOnline: online })
    }
  }, 1000)
}

async function leaveRoom() {
  clearInterval(sendTimer)
  clearInterval(watchTimer)
  sendTimer = watchTimer = null
  partner.online = false
  partner.lastSeen = 0
  partner.session = null
  partner.editing = null
  partner.seat = null
  partner.emote = null
  partner.hand = null
  partner.pet = null
  partner.act = null
  partner.mood = null
  partner.together = null
  set({ mateOnline: false })
  roomHooks.forEach((h) => h.left?.())
  const old = channels
  channels = []
  await Promise.all(old.map((c) => supabase?.removeChannel(c)))
}

/* ───────── letters in a bottle ───────── */

export async function loadLetters(announce = false) {
  if (!supabase || useCouple.getState().status !== 'connected') return
  const before = new Set(useCouple.getState().letters.map((l) => l.id))
  const { data, error } = await supabase.from('bottles').select('id, sender, recipient, body, created_at, opened_at').order('created_at', { ascending: false }).limit(100)
  if (error) return
  set({ letters: data })
  if (announce) {
    const me = useCouple.getState().me
    const fresh = data.filter((l) => l.recipient === me?.id && !before.has(l.id))
    if (fresh.length) window.dispatchEvent(new CustomEvent('couple:bottle', { detail: fresh.length }))
  }
}

/** Send a letter. The server decides who it's from and who it's for. */
export async function sendLetter(body) {
  const text = body.trim().slice(0, 1000)
  if (!text) return { ok: false }
  const { error } = await supabase.from('bottles').insert({ body: text })
  if (error) return { ok: false, error: 'Botolnya belum bisa dikirim. Coba lagi, ya.' }
  await loadLetters()
  return { ok: true }
}

export async function openLetter(id) {
  await supabase.from('bottles').update({ opened_at: new Date().toISOString() }).eq('id', id).is('opened_at', null)
  await loadLetters()
}
