import { connections, hiddenNotes, hints, littleThings, seeds, story } from '../content/config'
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
 * The next goal: { title, text, target?: interactable id, action?: 'telescope' | 'ending' | 'secret' }.
 * `target` is only set when that object is on the island and can be pointed at.
 */
export function nextGoal(s) {
  const chapters = chapterStatus(s)
  const current = chapters.find((c) => !c.done)

  // ── Chapter 1: the nearest little thing she hasn't found yet
  if (current?.index === 0) {
    const left = littleThings.filter((l) => !s.littleFound.includes(l.id))
    const id = nearest(left.map((l) => `little:${l.id}`))
    const l = left.find((x) => `little:${x.id}` === id) || left[0]
    return { title: `${l.title} · ${l.zone}`, text: l.hint || `Look around ${l.zone}.`, target: `little:${l.id}` }
  }

  // ── Chapter 2: the telescope on the island, then each connection in the distance view
  if (current?.index === 1) {
    if (s.view !== 'distance') return { title: story.chapters[1].title, text: hints.toTelescope, target: 'telescope', action: 'telescope' }
    const c = connections.find((x) => !s.connectionsDone.includes(x.id))
    return c ? { title: c.title, text: c.hint || c.how } : { title: story.chapters[1].title, text: 'The bridge is whole ♡ Go back to the island.' }
  }

  // ── Chapter 3: whatever seed needs her next
  if (current?.index === 2) {
    const st = s.seedState
    const byId = Object.fromEntries(seeds.map((sd) => [sd.id, sd]))
    if (s.carrying && byId[s.carrying]) {
      const sd = byId[s.carrying]
      const how = sd.id === 'honesty' ? ' Hold E (or ✦) at the plot to plant it by hand.' : ''
      return { title: sd.title, text: `Carry the seed of ${sd.title} to its glowing plot in front of the Love Tree.${how}`, target: `plot:${sd.id}` }
    }
    const others = seeds.filter((sd) => sd.id !== 'future')
    for (const sd of seeds) {
      if (st[sd.id] !== 'planted') continue
      if (sd.id === 'kindness')
        return s.hasWater
          ? { title: sd.title, text: 'You have the water ✦ Bring it back to the Kindness plot by the Love Tree.', target: 'plot:kindness' }
          : { title: sd.title, text: 'Scoop some water at the edge of Reflection Lake, right where the bridge starts. Then bring it back to the plot.', target: 'water' }
      if (sd.id === 'adventures') {
        const n = [0, 1].find((k) => !s.stonesLit.includes(k))
        if (n !== undefined) return { title: sd.title, text: 'Light the two little guiding stones beside the Shared Adventures plot (right of the Love Tree).', target: `stone:${n}` }
      }
      if (sd.id === 'growth') return { title: sd.title, text: 'Stand at the Growth plot and hold E (or keep pressing ✦) for about 3 seconds.', target: 'plot:growth' }
      if (sd.id === 'future' && others.every((o) => st[o.id] === 'grown'))
        return { title: sd.title, text: 'All four are grown ✦ Go to the last plot and connect it to their light.', target: 'plot:future' }
    }
    const waiting = seeds.filter((sd) => !st[sd.id])
    if (waiting.length) {
      const id = nearest(waiting.map((sd) => `seed:${sd.id}`))
      const sd = waiting.find((x) => `seed:${x.id}` === id) || waiting[0]
      return { title: `Seed of ${sd.title}`, text: `${sd.where || 'Somewhere on the island.'} Walk to the glowing seed and pick it up.`, target: `seed:${sd.id}` }
    }
    return { title: story.chapters[2].title, text: 'Grow the other seeds first — the last one needs their light.', target: 'plot:future' }
  }

  // ── everything played: the ending, then the secret, then the little optional notes
  if (!s.mainEndingSeen) return { title: 'The ending', text: hints.allDone, action: 'ending' }
  if (!s.secretSeen && !s.secretFound) return { title: 'One more little star', text: hints.secretStar, target: 'secret-star' }
  const note = hiddenNotes.find((n) => !s.notesFound.includes(n.id))
  if (note) return { title: 'A hidden note', text: `There is still a little note hidden in ${note.where}.`, target: `note:${note.id}` }
  return { title: 'All done ♡', text: hints.everything }
}

/** A short signature of real progress (used to notice when she's been stuck for a while). */
export const progressKey = (s) =>
  [s.littleFound.length, s.connectionsDone.length, JSON.stringify(s.seedState), s.carrying, s.hasWater, s.stonesLit.length, s.mainEndingSeen, s.secretSeen].join('|')
