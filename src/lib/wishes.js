import { create } from 'zustand'
import { onRoom, presence, supabase, useCouple } from './couple'
import { serverNow } from './clock'
import { uid } from './uid'
import { couple } from '../content/config'
import { useStore } from '../store'

/*
 * THE WELL OF WISHES — wishes and messages for the future, kept in Supabase
 * (supabase/migrations/012_wishing_well.sql). What a wish says is never sent with the list: it's
 * read one at a time through wish_read(), which checks on the server who's asking and — with the
 * server's own clock — whether the day it may be opened has come. Writing goes through wish_make()
 * with an id made here, so a retry or a double tap (or both of you at once) never saves it twice.
 *
 * Kinds: 'pribadi' (yours alone), 'bersama' (a dream for both of you: kept once the other person
 * says yes), 'pasangan' (a message for the other person).
 */

export const WISH_MAX = 500
export const WISH_KINDS = {
  pribadi: { label: 'Harapan pribadi', icon: '🌙', color: '#c9b6f4', hint: 'Hanya kamu yang bisa membacanya.' },
  bersama: { label: 'Impian bersama', icon: '💞', color: '#ff9cc6', hint: 'Disimpan setelah {mate} setuju, lalu bisa dibaca kalian berdua.' },
  pasangan: { label: 'Pesan untuk {mate}', icon: '💌', color: '#ffd27f', hint: '{mate} bisa membacanya (pada tanggalnya, kalau kamu memilih tanggal).' },
}

/**
 * status: 'off' (not signed in) | 'loading' | 'ready' | 'missing' (012 not run yet) | 'error'
 * list: the wishes she may see (newest first), without their words
 * open: the one being read { id, body } (or { id, error })
 */
export const useWishes = create(() => ({ status: 'off', list: [], busy: null, open: null }))
const get = () => useWishes.getState()
const set = (patch) => useWishes.setState(patch)
const toast = (text, ms = 3600) => useStore.getState().showToast(text, ms)
const COLUMNS = 'id, author, category, status, open_on, created_at, answered_by, answered_at, opened_at'

/* ───────── names and days ───────── */

/** A person's name (from the role the server gave them). */
export function nameOf(userId) {
  const { me, mate } = useCouple.getState()
  // (nobody signed in yet, or no other person: no name to give)
  const role = !userId ? null : userId === me?.id ? me.role : userId === mate?.id ? mate.role : null
  const who = role === 'owner' ? couple.me : role === 'tari' ? couple.you : null
  return who ? who.nickname || who.name : 'Seseorang'
}
export const mateLabel = () => {
  const mate = useCouple.getState().mate
  return mate ? nameOf(mate.id) : 'pasanganmu'
}
/** Put the other person's name into a kind's label or hint. */
export const withMate = (text) => text.replaceAll('{mate}', mateLabel())
export const isMine = (w) => w.author === useCouple.getState().me?.id

/** Today in the game's world time zone (WITA), on the shared clock: 'YYYY-MM-DD'. */
export function todayWita() {
  return new Date(serverNow() + 8 * 3600000).toISOString().slice(0, 10)
}
export const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
export const daysUntil = (day) => Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(todayWita() + 'T00:00:00Z')) / 86400000)
export const dayText = (day) => new Date(day + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export const timeText = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Where a wish is: 'menunggu' (waiting for the other person's yes), 'ditolak', 'terkunci' (waiting
 * for its day), 'siap' (its day has come), 'dibuka' (opened again), or 'tersimpan'.
 * (Only for showing; the server decides what may be read.)
 */
export function wishState(w) {
  if (w.status === 'menunggu') return 'menunggu'
  if (w.status === 'ditolak') return 'ditolak'
  if (w.open_on) {
    if (w.opened_at) return 'dibuka'
    return daysUntil(w.open_on) > 0 ? 'terkunci' : 'siap'
  }
  return 'tersimpan'
}
export const STATE_LABELS = {
  menunggu: 'Menunggu persetujuan',
  ditolak: 'Tidak disetujui',
  terkunci: 'Menunggu tanggal',
  siap: 'Sudah boleh dibuka',
  dibuka: 'Sudah dibuka kembali',
  tersimpan: 'Tersimpan',
}

/* ───────── loading, and hearing about changes ───────── */

let channel = null
let loadedOnce = false

/** Load the wishes she may see. */
export async function loadWishes() {
  const me = useCouple.getState().me
  if (!supabase || useCouple.getState().status !== 'connected' || !me) return set({ status: 'off', list: [] })
  if (get().status !== 'ready') set({ status: 'loading' })
  const { data, error } = await supabase.from('wishes').select(COLUMNS).order('created_at', { ascending: false }).limit(400)
  if (error) {
    // the table isn't there yet: 012_wishing_well.sql hasn't been run
    return set({ status: error.code === '42P01' || /wishes/.test(error.message || '') ? 'missing' : 'error', list: [] })
  }
  const before = new Map(get().list.map((w) => [w.id, w]))
  set({ status: 'ready', list: data })
  if (loadedOnce) announce(before, data, me.id)
  loadedOnce = true
  listen(me.id)
}

/** Say what the other person just did (a dream to agree on; an answer to mine). */
function announce(before, list, myId) {
  for (const w of list) {
    const old = before.get(w.id)
    if (!old && w.author !== myId && w.category === 'bersama' && w.status === 'menunggu') toast(`💞 ${nameOf(w.author)} menulis impian bersama dan menunggu persetujuanmu. Buka Buku Harapan di sumur.`, 6000)
    else if (!old && w.author !== myId && w.category === 'pasangan') toast(`💌 ${nameOf(w.author)} menitipkan pesan untukmu di Sumur Harapan.`, 5000)
    else if (old && old.status === 'menunggu' && w.author === myId && w.status !== 'menunggu')
      toast(w.status === 'tersimpan' ? `💞 ${nameOf(w.answered_by)} setuju! Impian bersama kalian tersimpan di sumur.` : `${nameOf(w.answered_by)} belum setuju dengan impian itu.`, 5000)
  }
}

let reloadTimer = null
function listen(myId) {
  if (channel || !supabase) return
  channel = supabase
    .channel(`couple-wishes:${myId}`, { config: { private: true } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, () => {
      // a few changes at once (a wish and its answer): one reload
      clearTimeout(reloadTimer)
      reloadTimer = setTimeout(loadWishes, 250)
    })
    .subscribe()
}
async function stopListening() {
  const c = channel
  channel = null
  loadedOnce = false
  if (c) await supabase?.removeChannel(c)
}
onRoom({ subscribed: loadWishes, left: () => (stopListening(), set({ status: 'off', list: [], open: null })) })

/* ───────── writing, answering, reading, taking back ───────── */

const errorText = (error) => {
  const m = error?.message || ''
  if (m.includes('1 to 500')) return `Tulis 1 sampai ${WISH_MAX} karakter, ya.`
  if (m.includes('after today')) return 'Tanggal bukanya harus setelah hari ini (dan paling lama sepuluh tahun lagi).'
  if (m.includes('full of your wishes')) return 'Sumurnya sudah penuh dengan harapanmu.'
  if (m.includes('locked until')) return 'Belum waktunya dibuka.'
  if (m.includes('not allowed')) return 'Harapan ini bukan untuk dibuka olehmu.'
  if (m.includes('function') && m.includes('does not exist')) return 'Sumur Harapan butuh 012_wishing_well.sql dijalankan di Supabase dulu.'
  return 'Belum tersimpan. Periksa koneksi, lalu coba lagi.'
}

/** Check a wish before it's sent. Returns an error to show, or null. */
export function checkWish({ text, category, openOn }) {
  const words = (text || '').trim()
  if (!words) return 'Tulis harapanmu dulu, ya.'
  if (words.length > WISH_MAX) return `Paling banyak ${WISH_MAX} karakter.`
  if (!WISH_KINDS[category]) return 'Pilih jenis harapannya.'
  if (openOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(openOn)) return 'Tanggalnya belum benar.'
    if (openOn <= todayWita()) return 'Tanggal bukanya harus setelah hari ini.'
    if (openOn > addDays(todayWita(), 3650)) return 'Paling lama sepuluh tahun lagi, ya.'
  }
  if (category !== 'pribadi' && !useCouple.getState().mate) return 'Pasanganmu belum bergabung di ruang ini.'
  return null
}

/** The draft being written keeps its id until it's saved, so a retry is the same wish. */
let draftId = null
/** Drop a wish into the well. Returns { ok, wish, error }. */
export async function makeWish({ text, category, openOn }) {
  const bad = checkWish({ text, category, openOn })
  if (bad) return { ok: false, error: bad }
  if (!supabase || useCouple.getState().status !== 'connected') return { ok: false, error: 'Masuk dulu ke ruang berdua, ya.' }
  if (get().busy) return { ok: false, error: 'Sebentar, masih menyimpan…' }
  draftId ||= uid()
  set({ busy: 'make' })
  const { data, error } = await supabase.rpc('wish_make', { wish_id: draftId, category, body: text.trim(), open_on: openOn || null })
  set({ busy: null })
  if (error || !data) return { ok: false, error: errorText(error) }
  draftId = null
  set({ list: [data, ...get().list.filter((w) => w.id !== data.id)] })
  // the paper flies into the well (on the other person's screen too, if it's not a secret)
  if (data.status !== 'menunggu') dropWish(category)
  return { ok: true, wish: data }
}
/** Start a fresh draft (after a saved one, or when the form is cleared). */
export const newDraft = () => (draftId = null)

/** Say yes (or no) to a dream together. */
export async function answerWish(id, accept) {
  if (get().busy) return { ok: false }
  set({ busy: id })
  const { data, error } = await supabase.rpc('wish_answer', { wish_id: id, accept })
  set({ busy: null })
  if (error || !data) return { ok: false, error: errorText(error) }
  set({ list: get().list.map((w) => (w.id === id ? data : w)) })
  if (accept && data.status === 'tersimpan') dropWish('bersama')
  return { ok: true, wish: data }
}

/** Read a wish (the server says whether its day has come). */
export async function readWish(id) {
  set({ busy: id, open: { id, body: null } })
  const { data, error } = await supabase.rpc('wish_read', { wish_id: id })
  set({ busy: null })
  if (error) return set({ open: { id, error: errorText(error) } })
  set({ open: { id, body: data } })
  // the first opening of a dated wish is marked on the server: show it
  const w = get().list.find((x) => x.id === id)
  if (w?.open_on && !w.opened_at && w.status === 'tersimpan') set({ list: get().list.map((x) => (x.id === id ? { ...x, opened_at: new Date().toISOString() } : x)) })
}
export const closeWish = () => set({ open: null })

/** Take back a wish of her own. */
export async function withdrawWish(id) {
  if (get().busy) return { ok: false }
  set({ busy: id })
  const { error } = await supabase.rpc('wish_withdraw', { wish_id: id })
  set({ busy: null })
  if (error) return { ok: false, error: errorText(error) }
  set({ list: get().list.filter((w) => w.id !== id), open: null })
  return { ok: true }
}
export const canWithdraw = (w) => isMine(w) && !(w.category === 'bersama' && w.status === 'tersimpan')

/* ───────── the paper flying into the well (seen by both of you) ───────── */

/** Wishes dropped just now, for the well to animate: { id, from: 'me' | 'mate', kind, at }. */
export const useDrops = create(() => ({ list: [] }))
let clearTimer = null
function dropWish(kind) {
  const id = uid()
  useDrops.setState({ list: [...useDrops.getState().list, { id, from: 'me', kind, at: performance.now() }] })
  // with the character, so the other person sees a paper fly too (never its words)
  presence.wish = { id, kind, at: Date.now() }
  clearTimeout(clearTimer)
  clearTimer = setTimeout(() => (presence.wish = null), 5000)
}
/** The other person dropped one (from lib/couple's partner.wish, seen by the well). */
const seenDrops = new Set()
export function partnerDropped(w) {
  if (!w?.id || seenDrops.has(w.id)) return
  seenDrops.add(w.id)
  useDrops.setState({ list: [...useDrops.getState().list, { id: w.id, from: 'mate', kind: w.kind || 'pribadi', at: performance.now() }] })
}
export const finishDrop = (id) => useDrops.setState({ list: useDrops.getState().list.filter((d) => d.id !== id) })
