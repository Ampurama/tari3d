import { create } from 'zustand'
import { presence } from './couple'
import { uid } from './uid'

/*
 * MOODLETS — like The Sims: little feelings that come from what you do in the house (a good sleep,
 * a warm bath, cooking, a hug) and fade after a while. The happiest one travels with your character
 * (presence.mood), so the other person sees it over your head. Kept on this device; nothing stored.
 */

export const MOODS = {
  berenergi: { label: 'Berenergi', icon: '☀️', minutes: 180, text: 'Tidur nyenyak' },
  kenyang: { label: 'Kenyang', icon: '🍰', minutes: 120, text: 'Makan enak' },
  segar: { label: 'Segar', icon: '🫧', minutes: 120, text: 'Habis berendam' },
  terinspirasi: { label: 'Terinspirasi', icon: '📖', minutes: 60, text: 'Baca buku bagus' },
  terhibur: { label: 'Terhibur', icon: '📺', minutes: 60, text: 'Nonton acara seru' },
  jago_masak: { label: 'Jago masak', icon: '🍳', minutes: 120, text: 'Masakannya enak' },
  romantis: { label: 'Romantis', icon: '💞', minutes: 120, text: 'Momen manis berdua' },
  bahagia: { label: 'Bahagia', icon: '😊', minutes: 60, text: 'Hal kecil yang menyenangkan' },
}

const KEY = 'our-little-universe:mood'
const load = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY)) || []
    return list.filter((m) => MOODS[m.kind] && m.until > Date.now())
  } catch {
    return []
  }
}
const save = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // private window: moods just won't outlive the tab
  }
}

/** list: [{ kind, until }] newest first */
export const useMood = create(() => ({ list: load() }))

/** The most recent feeling, sent with the character so it shows over your head on her screen. */
function broadcast(list) {
  presence.mood = list[0] ? { id: uid(), kind: list[0].kind, at: Date.now() } : null
}
broadcast(useMood.getState().list)

/** Feel something (or feel it again: it lasts longer). */
export function addMood(kind) {
  const m = MOODS[kind]
  if (!m) return
  const list = [{ kind, until: Date.now() + m.minutes * 60000 }, ...useMood.getState().list.filter((x) => x.kind !== kind)]
  useMood.setState({ list })
  save(list)
  broadcast(list)
}

/** Drop the feelings that have faded (called now and then by the HUD). */
export function pruneMoods() {
  const list = useMood.getState().list
  const live = list.filter((m) => m.until > Date.now())
  if (live.length !== list.length) {
    useMood.setState({ list: live })
    save(live)
    broadcast(live)
  }
}

/** How you're feeling overall, from how many good feelings you have right now. */
export function overallMood(list) {
  const n = list.length
  if (n >= 4) return { label: 'Bahagia sekali', icon: '💖' }
  if (n >= 2) return { label: 'Sangat senang', icon: '😊' }
  if (n === 1) return { label: 'Senang', icon: '🙂' }
  return { label: 'Biasa saja', icon: '😌' }
}
