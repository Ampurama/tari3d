import { create } from 'zustand'
import { onRoom, supabase, useCouple } from './couple'
import { player } from './player'
import { platformAt, skyDistance } from './terrain'
import { checkpointPos, GOAL_CP } from './skyLayout'
import { useStore } from '../store'
import { uid } from './uid'

/*
 * SKY ISLAND — shared progress, kept in Supabase (supabase/migrations/005_sky_island.sql):
 * whether the island has been opened, the hidden stars found (each once), Cloud Hop rounds
 * (checkpoints only move forward, a round completes when you've BOTH reached the goal) and
 * the rewards. Every change is a server function that checks who's asking; this module only
 * asks, and shows what the server answered (and what arrives live from the other person).
 */

/**
 * status: 'off' | 'loading' | 'ready' | 'error'
 * progress: { unlocked_at, hop_completions, hop_best_stars, moment_unlocked }
 * stars: { obs1: true, … } · round: the active Cloud Hop round, or null
 * area: the place on Sky Island she's in (for the name banner) · onSky: she's up there
 */
export const useSky = create(() => ({
  status: 'off',
  progress: null,
  stars: {},
  round: null,
  busy: false,
  error: null,
  area: null,
  onSky: false,
}))
const set = (patch) => useSky.setState(patch)
const get = () => useSky.getState()
const toast = (text, ms = 4200) => useStore.getState().showToast(text, ms)

export async function loadSky() {
  if (!supabase || useCouple.getState().status !== 'connected') return
  if (get().status !== 'ready') set({ status: 'loading', error: null })
  const [progress, stars, round] = await Promise.all([
    supabase.from('sky_progress').select('*').eq('id', 1).maybeSingle(),
    supabase.from('sky_stars').select('id'),
    supabase.from('hop_rounds').select('*').eq('status', 'active').limit(1),
  ])
  if (progress.error || stars.error || round.error) {
    return set({ status: 'error', error: 'Progres Sky Island belum bisa dimuat. Mungkin tabelnya belum dipasang di Supabase (005_sky_island.sql).' })
  }
  set({
    status: 'ready',
    error: null,
    progress: progress.data,
    stars: Object.fromEntries(stars.data.map((s) => [s.id, true])),
    round: round.data[0] || null,
  })
}

function applyProgress(row) {
  if (!row) return
  const before = get().progress
  set({ progress: row })
  if (before && !before.moment_unlocked && row.moment_unlocked) toast('Our Little Moment terbuka ✦ Ada sudut kecil di barat daya Sky Island.', 6000)
}

function applyRound(row) {
  if (!row?.id) return
  const cur = get().round
  if (row.status === 'active') return set({ round: row })
  if (cur?.id === row.id) {
    set({ round: null })
    if (row.status === 'completed') toast(`Cloud Hop selesai berdua! ✦ ${row.stars?.length || 0}/5 bintang.`, 6000)
    else toast('Ronde Cloud Hop disudahi.')
  }
}

onRoom({
  attach(channel) {
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sky_progress' }, (p) => p.new?.id === 1 && applyProgress(p.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sky_stars' }, (p) => {
        if (p.new?.id && !get().stars[p.new.id]) set({ stars: { ...get().stars, [p.new.id]: true } })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hop_rounds' }, (p) => p.eventType !== 'DELETE' && applyRound(p.new))
  },
  subscribed: () => loadSky(),
  left: () => set({ status: 'off', round: null }),
})
useCouple.subscribe((s, prev) => {
  if (s.status === prev.status) return
  if (s.status === 'connected') loadSky()
  else set({ status: 'off', progress: null, stars: {}, round: null })
})

async function call(fn, args, apply) {
  if (!supabase || get().status !== 'ready') return { ok: false }
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    set({ error: 'Koneksinya lagi putus-putus. Progres belum tersimpan, coba lagi sebentar lagi.' })
    return { ok: false }
  }
  set({ error: null })
  apply?.(data)
  return { ok: true, data }
}

/** The first arrival opens Sky Island for good. */
export const visitSky = () => call('sky_visit', {}, applyProgress)

/** A hidden star: found once, by either of you (finding it twice changes nothing). */
const finding = new Set()
export async function findStar(id) {
  if (get().stars[id] || finding.has(id)) return
  finding.add(id)
  set({ stars: { ...get().stars, [id]: true } }) // shows at once; the server keeps the real count
  const r = await call('sky_find_star', { p_id: id }, applyProgress)
  finding.delete(id)
  if (!r.ok) {
    const stars = { ...get().stars }
    delete stars[id]
    set({ stars })
  }
}

/* ───────── Cloud Hop ───────── */

let startId = null
export async function startHop() {
  if (get().round || get().busy) return
  startId ||= uid() // the same id if the request is repeated: never two rounds
  set({ busy: true })
  const r = await call('hop_start', { p_id: startId }, applyRound)
  set({ busy: false })
  if (r.ok) startId = null
}
const mineKey = (round, k) => (round.player_a === useCouple.getState().me?.id ? `${k}_a` : `${k}_b`)
const mateKey = (round, k) => (round.player_a === useCouple.getState().me?.id ? `${k}_b` : `${k}_a`)
export const myCheckpoint = (round = get().round) => (round ? round[mineKey(round, 'cp')] : 0)
export const mateCheckpoint = (round = get().round) => (round ? round[mateKey(round, 'cp')] : 0)
export const iFinished = (round = get().round) => Boolean(round && round[mineKey(round, 'done')])
export const mateFinished = (round = get().round) => Boolean(round && round[mateKey(round, 'done')])

const pending = new Set()
async function once(key, fn) {
  if (pending.has(key)) return
  pending.add(key)
  await fn()
  pending.delete(key)
}
export function reachCheckpoint(i) {
  const round = get().round
  if (!round || i <= myCheckpoint(round)) return
  once(`cp${i}`, async () => {
    const r = await call('hop_checkpoint', { p_round: round.id, p_index: i }, applyRound)
    if (r.ok && i < GOAL_CP) toast(`Checkpoint ${i} ✦`, 2200)
    // the goal: tell the server we're here (it completes the round once you're both in)
    if (r.ok && i === GOAL_CP) await call('hop_finish', { p_round: round.id }, applyRound)
  })
}
export function grabHopStar(id) {
  const round = get().round
  if (!round || round.stars?.includes(id)) return
  once(`star${id}`, () => call('hop_star', { p_round: round.id, p_star: id }, applyRound))
}
export const leaveHop = () => get().round && call('hop_leave', { p_round: get().round.id }, applyRound)
/** Already at the goal but the finish didn't reach the server (a dropped connection): try again. */
export const retryFinish = () => get().round && myCheckpoint() >= GOAL_CP && !iFinished() && call('hop_finish', { p_round: get().round.id }, applyRound)

/* ───────── falling, and coming back ───────── */

/** Where she comes back to after a fall: her checkpoint during a round, otherwise the last safe ground. */
export function respawnPoint() {
  const round = get().round
  const inHop = round && (platformAt(player.position.x, player.position.z, 1.6) || skyDistance(player.position.x, player.position.z) > 0.75)
  if (inHop) return checkpointPos(myCheckpoint(round))
  return { x: player.safe.x, z: player.safe.z, y: null }
}
