import { constellation, futureWorlds, loveCapsule, memories, memoryLane, story, timeMachine } from '../content/config'

/**
 * Chapter objectives, measured from real activity stored in the app state.
 * Each task returns [have, need]. A task with need === 0 (e.g. empty config) counts as done.
 */
const TASKS = [
  // 1 — The First Page
  [
    {
      label: 'Open memories in the floating frames',
      measure: (s) => [s.viewedMemories.length, Math.min(3, memories.length)],
    },
    {
      label: 'Visit every lantern on Memory Lane',
      measure: (s) => [s.laneVisited.length, memoryLane.milestones.length],
    },
  ],
  // 2 — Back in Time
  [
    {
      label: 'Travel to every date in the Time Machine',
      measure: (s) => [s.timeVisited.length, timeMachine.entries.length],
    },
  ],
  // 3 — The Red Thread
  [
    { label: 'Tie the red thread on both islands', measure: (s) => [s.threadConnected ? 1 : 0, 1] },
    { label: 'Open the message on each island', measure: (s) => [s.threadRead.length, 2] },
  ],
  // 4 — Words I Kept for You
  [
    { label: 'Read the letter on the little table', measure: (s) => [s.letterRead ? 1 : 0, 1] },
    {
      label: 'Open envelopes from the Love Capsule',
      measure: (s) => [s.capsuleOpened.length, Math.min(3, loveCapsule.letters.length)],
    },
    {
      label: 'Light every star of our constellation',
      measure: (s) => [s.starsFound.length, constellation.reasons.length],
    },
  ],
  // 5 — Every Universe Leads to You
  [
    {
      label: 'Visit every world in the Future Simulator',
      measure: (s) => [s.futureVisited.length, futureWorlds.worlds.length],
    },
  ],
]

/** Length of the ending cutscene in seconds (camera, overlay and music share it). */
export const CUTSCENE_SECONDS = 12

/** Where "Start chapter" takes you. */
export const CHAPTER_PLACES = ['memories', 'timemachine', 'distance', 'explore', 'future']

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

/** Replace {me}/{you} placeholders in dialog lines. */
export function fillNames(text, couple) {
  return text
    .replaceAll('{me}', couple.me.nickname || couple.me.name)
    .replaceAll('{you}', couple.you.nickname || couple.you.name)
}
