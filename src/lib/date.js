import { create } from 'zustand'
import * as THREE from 'three'
import { onRoom, supabase, useCouple } from './couple'
import { useHome } from './home'
import { player } from './player'
import { ground } from './layout'
import { HOME_ISLAND, ZONES } from './terrain'
import { CAMP, CATALOG, toWorld } from './homeLayout'
import { atmosphere } from './atmosphere'
import { useStore } from '../store'
import { dates } from '../content/config'
import { uid } from './uid'

/*
 * VIRTUAL DATE — invitations and date sessions, kept in Supabase (table `date_sessions`,
 * supabase/migrations/003_dates.sql). Every change of state is a server function that checks
 * who is asking: only the invited person can accept, each person can only say they're ready for
 * themselves, a date only begins when both are ready, and only one date can be open at a time.
 * What happens moment to moment (walking there, sitting, waving) is never stored.
 */

export const DATE_KINDS = ['sunset_picnic', 'dinner_home', 'camping', 'lakeside']
export const OPEN = ['pending', 'accepted', 'preparing', 'active', 'interrupted']
/** How close (metres) she has to be to the meeting place to say "Siap". */
export const READY_RADIUS = 3.2

/* ───────── where each date happens ───────── */

const cove = ground(ZONES.cove.x + 0.3, ZONES.cove.z + 1.7)
const lakeBench = ground(ZONES.lake.x + 0.6, ZONES.lake.z + 3.3)
const campFire = (() => {
  const [x, z] = toWorld(...CAMP.fire)
  return new THREE.Vector3(x, HOME_ISLAND.level, z)
})()

export const PLACES = {
  /** the picnic blanket on the Secret Cove beach, facing out to the sea of clouds */
  sunset_picnic: { at: cove, yaw: Math.atan2(cove.x, cove.z) },
  /** the campfire beside the house on the home island */
  camping: { at: campFire, yaw: 0 },
  /** the old bench on the south shore of Reflection Lake (it faces the water) */
  lakeside: { at: lakeBench, yaw: Math.PI },
}

/** The dining table in the house (the first one placed), in world space, or null. */
export function diningTable() {
  const items = Object.values(useHome.getState().items)
  const table = items.find((it) => it.kind === 'table')
  if (!table) return null
  const [x, z] = toWorld(table.x, table.z)
  return { item: table, at: new THREE.Vector3(x, HOME_ISLAND.level, z) }
}

/** Where a date meets (world space), or null if it can't happen yet. */
export function meetingPoint(kind) {
  if (kind === 'dinner_home') return diningTable()?.at || null
  return PLACES[kind]?.at || null
}

/** Is there a table and two chairs for the dinner? (the server checks this again) */
export function diningReady() {
  const h = useHome.getState()
  if (h.status !== 'ready' || h.stage < 2) return false
  const items = Object.values(h.items)
  return items.some((it) => it.kind === 'table') && items.filter((it) => it.kind === 'chair').length >= 2
}

export const distanceTo = (kind) => {
  const p = meetingPoint(kind)
  return p ? Math.hypot(player.position.x - p.x, player.position.z - p.z) : Infinity
}

/* ───────── state ───────── */

/**
 * status: 'off' | 'loading' | 'ready' | 'error'
 * session: the open invitation / date (or null); history: finished dates, newest first
 * keepsakes: { kind: true } for every keepsake unlocked so far
 */
export const useDate = create(() => ({
  status: 'off',
  session: null,
  history: [],
  keepsakes: {},
  busy: false,
  error: null,
}))
const set = (patch) => useDate.setState(patch)
const get = () => useDate.getState()
const toast = (text, ms = 4800) => useStore.getState().showToast(text, ms)

/** My id, and which side of the date I'm on. */
const myId = () => useCouple.getState().me?.id
export const mine = (s) => (s && myId() === s.initiator ? 'initiator' : 'invitee')
export const iAmReady = (s) => Boolean(s && (mine(s) === 'initiator' ? s.initiator_ready : s.invitee_ready))
export const mateReady = (s) => Boolean(s && (mine(s) === 'initiator' ? s.invitee_ready : s.initiator_ready))
export const isExpired = (s) => Boolean(s && ['pending', 'accepted', 'preparing'].includes(s.status) && new Date(s.expires_at).getTime() < Date.now())

const COLUMNS = '*'

function remember(row) {
  if (row.status !== 'completed') return
  const history = [row, ...get().history.filter((h) => h.id !== row.id)].sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
  set({ history })
}

/** A date changed (from the server's answer or a live event). */
function applySession(row) {
  if (!row?.id || !DATE_KINDS.includes(row.kind)) return
  const cur = get().session
  if (OPEN.includes(row.status)) {
    if (!cur || cur.id === row.id || new Date(row.created_at) >= new Date(cur.created_at)) set({ session: row })
    return
  }
  remember(row)
  if (cur?.id === row.id) {
    set({ session: null })
    announceEnd(row)
  } else if (row.status === 'completed') set({ history: get().history.map((h) => (h.id === row.id ? row : h)) })
}

function announceEnd(row) {
  const title = dates[row.kind]?.title || 'Kencan'
  if (row.status === 'completed') toast(`${title} selesai ♡ Tersimpan di Kenangan Kita.`, 6000)
  else if (row.end_reason === 'declined') toast(row.initiator === myId() ? `Ajakan ${title} belum bisa diterima kali ini. Nggak apa-apa ♡` : 'Ajakannya ditolak.')
  else if (row.end_reason === 'expired') toast(`Ajakan ${title} sudah kedaluwarsa.`)
  else if (row.end_reason === 'ended_early') toast(`${title} diakhiri sebelum sempat dicatat.`)
  else toast(`${title} dibatalkan.`)
}

export async function loadDates() {
  if (!supabase || useCouple.getState().status !== 'connected') return
  if (get().status !== 'ready') set({ status: 'loading', error: null })
  const [open, done, gifts] = await Promise.all([
    supabase.from('date_sessions').select(COLUMNS).in('status', OPEN).order('created_at', { ascending: false }).limit(1),
    supabase.from('date_sessions').select(COLUMNS).eq('status', 'completed').order('completed_at', { ascending: false }).limit(60),
    supabase.from('keepsakes').select('kind'),
  ])
  if (open.error || done.error || gifts.error) {
    set({ status: 'error', error: 'Fitur kencan belum siap. Mungkin tabelnya belum dipasang di Supabase (003_dates.sql).' })
    return
  }
  set({
    status: 'ready',
    error: null,
    session: open.data[0] || null,
    history: done.data,
    keepsakes: Object.fromEntries(gifts.data.map((g) => [g.kind, true])),
  })
}

onRoom({
  attach(channel) {
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_sessions' }, (p) => {
        if (p.eventType !== 'DELETE') applySession(p.new)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'keepsakes' }, (p) => {
        if (p.new?.kind && !get().keepsakes[p.new.kind]) {
          set({ keepsakes: { ...get().keepsakes, [p.new.kind]: true } })
          toast(`🎁 Hadiah baru untuk rumah: ${CATALOG[p.new.kind]?.label || p.new.kind}. Ada di Dekorasi Rumah.`, 6000)
        }
      })
  },
  subscribed: () => loadDates(),
  left: () => set({ status: 'off', session: null }),
})
useCouple.subscribe((s, prev) => {
  if (s.status === prev.status) return
  if (s.status === 'connected') loadDates()
  else set({ status: 'off', session: null, history: [], keepsakes: {} })
})

/* ───────── the steps of a date ───────── */

const ERRORS = [
  ['busy', 'Masih ada ajakan atau kencan yang belum selesai.'],
  ['need: a table and two chairs', dates.dinner_home?.needs || 'Butuh satu meja dan dua kursi di rumah.'],
  ['has not joined', 'Pasanganmu belum terdaftar di ruang ini.'],
  ['only the invited', 'Hanya yang diajak yang bisa menjawab.'],
]
const explain = (error) => ERRORS.find(([k]) => error?.message?.includes(k))?.[1] || 'Belum berhasil. Coba lagi sebentar lagi, ya.'

async function call(fn, args) {
  if (get().busy) return { ok: false }
  set({ busy: true, error: null })
  const { data, error } = await supabase.rpc(fn, args)
  set({ busy: false })
  if (error) {
    const msg = explain(error)
    set({ error: msg })
    return { ok: false, error: msg }
  }
  applySession(data)
  return { ok: true, data }
}

/** "Ajak Kencan": the id is made once here, so pressing twice never sends two invitations. */
let pendingInvite = null
export async function invite(kind) {
  if (kind === 'dinner_home' && !diningReady()) {
    const msg = dates.dinner_home?.needs || 'Butuh satu meja dan dua kursi di rumah.'
    set({ error: msg })
    return { ok: false, error: msg }
  }
  pendingInvite = pendingInvite?.kind === kind ? pendingInvite : { kind, id: uid() }
  const r = await call('date_invite', { p_id: pendingInvite.id, p_kind: kind })
  if (r.ok) pendingInvite = null
  return r
}
export const respond = (accept) => get().session && call('date_respond', { p_id: get().session.id, p_accept: accept })
export const setReady = (ready) => get().session && call('date_ready', { p_id: get().session.id, p_ready: ready })
export const nextPrompt = () => get().session && call('date_step', { p_id: get().session.id, p_expected: get().session.step })
/** "Akhiri Kencan" / "Batalkan": the server decides whether it counts as a finished date. */
export const finish = () => get().session && call('date_finish', { p_id: get().session.id })
export const resume = () => get().session && call('date_resume', { p_id: get().session.id })
const interrupt = (id) => supabase.rpc('date_interrupt', { p_id: id }).then(({ data }) => data && applySession(data))

/** A note on a finished date (both of you can write it). */
export async function saveNote(id, note) {
  const { data, error } = await supabase.from('date_sessions').update({ note: note.trim().slice(0, 300) || null }).eq('id', id).select(COLUMNS).maybeSingle()
  if (error || !data) return { ok: false }
  remember(data)
  return { ok: true }
}

/* ───────── watching over a date ───────── */

let offlineSince = 0
let lastMood = null
/**
 * Runs once a second while a date is open:
 *  - if the other person has been offline for 20 s during a date, it pauses ("terhenti")
 *  - if she said "Siap" and then walked far away, she's not ready any more
 *  - the sky follows the date (a golden sunset for the picnic, a starry night for camping)
 */
export function watchDate() {
  const s = get().session
  const couple = useCouple.getState()
  const live = s && ['accepted', 'preparing', 'active'].includes(s.status)
  if (live && couple.status === 'connected' && !couple.mateOnline) {
    offlineSince ||= Date.now()
    if (Date.now() - offlineSince > 20000) {
      offlineSince = 0
      interrupt(s.id)
    }
  } else offlineSince = 0

  if (s && s.status === 'preparing' && iAmReady(s) && distanceTo(s.kind) > READY_RADIUS * 1.8 && !get().busy) setReady(false)

  // the sky: only around the meeting place, only while the date is on
  const near = s && s.status === 'active' && distanceTo(s.kind) < 14
  const mood = near && s.kind === 'sunset_picnic' ? 'sunset' : near && s.kind === 'camping' ? 'night' : null
  if (mood !== lastMood) {
    lastMood = mood
    atmosphere.mood = mood === 'sunset' ? { sunset: 0.9 } : mood === 'night' ? { day: 0.12, sunset: 0.3 } : null
  }
}
