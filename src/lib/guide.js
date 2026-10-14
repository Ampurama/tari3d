import { connections, glowFlowers, hiddenNotes, hints, littleThings, picnic } from '../content/config'
import { chapterStatus } from './story'
import { interactables } from './interactions'
import { player } from './player'

/*
 * THE HINT GUIDE — "what should I do next, and where is it?"
 * Reads only the real progress in the store. Returns a goal with a short text and, when the
 * thing is on the island, the id of the interactable to point at / walk to.
 */

const dist = (id) => {
  const it = interactables.get(id)
  if (!it) return Infinity
  return Math.hypot(it.position.x - player.position.x, it.position.z - player.position.z)
}
const nearest = (ids) => ids.reduce((best, id) => (dist(id) < dist(best) ? id : best), ids[0])

/**
 * The next goal: { title, text, target?: interactable id, action?: 'ending' }.
 * `target` is only set when that object is on the island and can be pointed at.
 */
export function nextGoal(s) {
  const chapters = chapterStatus(s)
  const current = chapters.find((c) => !c.done)

  switch (current?.id) {
    // ── 1: wake the fluffy heart, then the three glowing flowers
    case 'goofy': {
      if (!s.mochiAwake) return { title: current.title, text: hints.wakeMochi, target: 'mochi' }
      const left = glowFlowers.filter((f) => !s.flowersFound.includes(f.id))
      const id = nearest(left.map((f) => `glow:${f.id}`))
      return { title: `Bunga bercahaya · ${glowFlowers.length - left.length} / ${glowFlowers.length}`, text: 'Tiga bunga bercahaya ngumpet di padang, dekat tempat kamu mulai. Samperin salah satunya, terus tekan E (atau ✦) — atau sentuh bunganya.', target: id }
    }
    // ── 2: the nearest little thing she hasn't found yet
    case 'little-things': {
      const left = littleThings.filter((l) => !s.littleFound.includes(l.id))
      const id = nearest(left.map((l) => `little:${l.id}`))
      const l = left.find((x) => `little:${x.id}` === id) || left[0]
      return { title: `${l.title} · ${l.zone}`, text: l.hint || `Coba cari di sekitar ${l.zone}.`, target: `little:${l.id}` }
    }
    // ── 3: the telescope on the island, then each connection in the distance view
    case 'miles': {
      if (s.view !== 'distance') return { title: current.title, text: hints.toTelescope, target: 'telescope' }
      const c = connections.find((x) => !s.connectionsDone.includes(x.id))
      return c ? { title: c.title, text: c.hint || c.how } : { title: current.title, text: 'Jembatannya udah utuh ♡ Balik ke pulau, yuk.' }
    }
    // ── 4: the picnic (and, during it, the current mini-game)
    case 'picnic': {
      if (s.view === 'picnic' && s.picnicStage && picnic.games[s.picnicStage]) {
        const g = picnic.games[s.picnicStage]
        return { title: g.title, text: g.how }
      }
      return { title: current.title, text: hints.toPicnic, target: 'picnic' }
    }
    // ── 5: the envelope beneath the Love Tree
    case 'letter':
      return { title: current.title, text: hints.toEnvelope, target: 'envelope' }
    default:
      break
  }

  // ── everything played: the ending, then the little secrets
  if (!s.mainEndingSeen) return { title: 'Ending', text: hints.allDone, action: 'ending' }
  if (!s.bonusFound) return { title: 'Rahasia kecil', text: hints.secretHeart, target: 'bonus-heart' }
  if (!s.secretSeen && !s.secretFound) return { title: 'Satu bintang kecil lagi', text: hints.secretStar, target: 'secret-star' }
  const note = hiddenNotes.find((n) => !s.notesFound.includes(n.id))
  if (note) return { title: 'Catatan tersembunyi', text: `Masih ada catatan kecil yang disembunyiin di ${note.where}.`, target: `note:${note.id}` }
  return { title: 'Semua beres ♡', text: hints.everything }
}

/** A short signature of real progress (used to notice when she's been stuck for a while). */
export const progressKey = (s) =>
  [s.mochiAwake, s.flowersFound.length, s.littleFound.length, s.connectionsDone.length, s.picnicDone.length, s.envelopeOpened, s.mainEndingSeen, s.bonusFound, s.secretSeen].join('|')
