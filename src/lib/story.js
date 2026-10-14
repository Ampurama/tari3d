import { companion, connections, couple, glowFlowers, littleThings, story } from '../content/config'

/*
 * Five chapters, measured only from what she has actually done (saved in the store).
 * A task returns [have, need]; need === 0 (empty config) counts as done.
 * Ids that no longer exist in the config are ignored, so nothing is ever double-counted.
 */

const countIds = (list, items) => items.filter((it) => list.includes(it.id)).length

/** The three Disaster Date mini-games, in the order they are played. */
export const PICNIC_GAMES = ['catch', 'save', 'fix']

const TASKS = [
  // 1 — The Goofy Beginning
  [{ label: 'Bangunin si hati berbulu, terus kumpulin tiga bunga bercahaya', measure: (s) => [countIds(s.flowersFound, glowFlowers), glowFlowers.length] }],
  // 2 — Little Things About You
  [{ label: 'Temukan lima hal kecil yang disembunyiin di pulau', measure: (s) => [countIds(s.littleFound, littleThings), littleThings.length] }],
  // 3 — A Little Far, Never Apart
  [{ label: 'Sambungin lagi lima hal di antara dua pulau', measure: (s) => [countIds(s.connectionsDone, connections), connections.length] }],
  // 4 — The Disaster Date
  [{ label: 'Selamatkan piknik: tiga mini-game kecil', measure: (s) => [PICNIC_GAMES.filter((g) => s.picnicDone.includes(g)).length, PICNIC_GAMES.length] }],
  // 5 — A Letter From the Future
  [{ label: 'Buka amplop di bawah Love Tree', measure: (s) => [s.envelopeOpened ? 1 : 0, 1] }],
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

/** Index of a chapter by its id ('goofy' | 'little-things' | 'miles' | 'picnic' | 'letter'). */
export const chapterIndex = (id) => story.chapters.findIndex((c) => c.id === id)

export const completedCount = (state) => chapterStatus(state).filter((c) => c.done).length

/** The chapter currently being played (first unfinished), or null when everything is done. */
export const currentChapter = (state) => chapterStatus(state).find((c) => !c.done) || null

/** 0..1 — how much of the whole journey is done (the Love Tree, the lanterns and the sky follow it). */
export function journeyProgress(state) {
  const total = glowFlowers.length + littleThings.length + connections.length + PICNIC_GAMES.length + 1
  return (
    (countIds(state.flowersFound, glowFlowers) +
      countIds(state.littleFound, littleThings) +
      countIds(state.connectionsDone, connections) +
      PICNIC_GAMES.filter((g) => state.picnicDone.includes(g)).length +
      (state.envelopeOpened ? 1 : 0)) /
    total
  )
}

/** Any game line with {me}/{you}/{pet} filled in (nicknames come from `couple` in config.js). */
export const withNames = (text) => (typeof text === 'string' ? fillNames(text, couple) : text)

/** Replace {me}/{you}/{pet} placeholders in dialog lines. */
export function fillNames(text, couple) {
  return text
    .replaceAll('{me}', couple.me.nickname || couple.me.name)
    .replaceAll('{you}', couple.you.nickname || couple.you.name)
    .replaceAll('{pet}', companion.name)
}
