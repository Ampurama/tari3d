import { connections, littleThings, seeds, story } from '../content/config'

/*
 * Three chapters, measured only from what she has actually done (saved in the store).
 * A task returns [have, need]; need === 0 (empty config) counts as done.
 * Ids that no longer exist in the config are ignored, so nothing is ever double-counted.
 */

const countIds = (list, items) => items.filter((it) => list.includes(it.id)).length

const TASKS = [
  // 1 — The Little Things
  [{ label: 'Find the five little things hidden around the island', measure: (s) => [countIds(s.littleFound, littleThings), littleThings.length] }],
  // 2 — Miles Between Us
  [{ label: 'Restore the five connections between the two islands', measure: (s) => [countIds(s.connectionsDone, connections), connections.length] }],
  // 3 — A Future We Grow
  [
    {
      label: 'Plant and grow the five glowing seeds around the Love Tree',
      measure: (s) => [seeds.filter((sd) => s.seedState[sd.id] === 'grown').length, seeds.length],
    },
  ],
]

export const CHAPTER_COUNT = Math.min(story.chapters.length, TASKS.length)

/** Full status of every chapter for the given state. */
export function chapterStatus(state) {
  const out = []
  for (let i = 0; i < CHAPTER_COUNT; i++) {
    const tasks = TASKS[i].map((t) => {
      const [rawHave, need] = t.measure(state)
      const have = Math.min(rawHave, need)
      return { label: t.label, have, need, done: have >= need }
    })
    const unlocked = i === 0 || out[i - 1].done
    const done = unlocked && tasks.every((t) => t.done)
    const have = tasks.reduce((a, t) => a + t.have, 0)
    const need = tasks.reduce((a, t) => a + t.need, 0)
    out.push({ index: i, ...story.chapters[i], tasks, unlocked, done, ratio: need ? have / need : 1 })
  }
  return out
}

export const completedCount = (state) => chapterStatus(state).filter((c) => c.done).length

/** The chapter currently being played (first unfinished), or null when everything is done. */
export const currentChapter = (state) => chapterStatus(state).find((c) => !c.done) || null

/** 0..1 — how much of the whole journey is done (the Love Tree grows with it). */
export function journeyProgress(state) {
  const total = littleThings.length + connections.length + seeds.length
  if (!total) return 1
  const grown = seeds.filter((sd) => state.seedState[sd.id] === 'grown').length
  return (countIds(state.littleFound, littleThings) + countIds(state.connectionsDone, connections) + grown) / total
}

/** Replace {me}/{you} placeholders in dialog lines. */
export function fillNames(text, couple) {
  return text
    .replaceAll('{me}', couple.me.nickname || couple.me.name)
    .replaceAll('{you}', couple.you.nickname || couple.you.name)
}
