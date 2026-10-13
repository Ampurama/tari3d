import { create } from 'zustand'
import { constellation, futureWorlds, hints, loveCapsule, memoryLane, story, timeMachine } from './content/config'
import { CHAPTER_COUNT, CHAPTER_PLACES, chapterStatus, completedCount } from './lib/story'

export const HIDDEN_HEART_COUNT = 5

const STORAGE_KEY = 'our-little-universe:v1'

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function save(patch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSaved(), ...patch }))
  } catch {
    /* storage unavailable — progress just won't persist */
  }
}

const saved = loadSaved()
const arr = (v) => (Array.isArray(v) ? v : [])
let toastId = 0
let travelToken = 0

const motionQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

export const useStore = create((set, get) => ({
  /** 'loading' → 'intro' → 'world' */
  phase: 'loading',
  /**
   * 'intro' | 'explore' | 'memories' | 'lane' | 'letter' | 'capsule' | 'distance' | 'constellation' | 'finale'
   * | 'timemachine' | 'future' | 'reactor' | 'cutscene' | 'finalRoom' | 'epilogue'
   */
  view: 'intro',
  selectedMemory: null,
  /** current lantern on the Memory Lane */
  laneIndex: 0,
  /** id of the open Love Capsule letter, or null */
  capsuleLetter: null,
  capsuleOpened: Array.isArray(saved.capsuleOpened) ? saved.capsuleOpened : [],
  /** ids (0..4) of hidden hearts already found */
  foundHearts: Array.isArray(saved.foundHearts) ? saved.foundHearts : [],
  /** indices of constellation stars already lit */
  starsFound: Array.isArray(saved.starsFound) ? saved.starsFound : [],
  /** the star whose reason is showing */
  activeStar: null,
  /* ── story mode progress (all persisted; every value comes from something she actually did) ── */
  viewedMemories: arr(saved.viewedMemories),
  laneVisited: arr(saved.laneVisited),
  timeVisited: arr(saved.timeVisited),
  /** which Time Machine entry is open (null = the dial) */
  timeIndex: null,
  /** true while the time-travel animation plays */
  timeTravelling: false,
  threadTied: { me: Boolean(saved.threadTied?.me), you: Boolean(saved.threadTied?.you) },
  threadConnected: Boolean(saved.threadConnected),
  threadRead: arr(saved.threadRead),
  /** 'me' | 'you' | null — the island message that's open */
  threadMessage: null,
  futureVisited: arr(saved.futureVisited),
  futureIndex: 0,
  prologueSeen: Boolean(saved.prologueSeen),
  introsSeen: arr(saved.introsSeen),
  celebrated: arr(saved.celebrated),
  endingSeen: Boolean(saved.endingSeen),
  /* ── secret ending ("The one thing I could never code") ── */
  /** null | 'found' | 'transition' | 'letter' | 'voice' | 'photo' — stages inside the Secret Room */
  secretStage: null,
  /** the little star in the Secret Room is lit and can be touched */
  starAwake: false,
  secretFound: Boolean(saved.secretFound),
  secretSeen: Boolean(saved.secretSeen),
  /** visual-novel style dialog: { lines, index, key } */
  dialog: null,
  /** small floating panels over any view: 'countdown' | 'hearts' | 'story' | 'places' | null */
  panel: null,
  /** bumps to make the camera rise toward the sky before the finale */
  riseCue: 0,
  letterRead: Boolean(saved.letterRead),
  unlockPending: false,
  visited: { memories: false, lane: false, letter: false, capsule: false, distance: false, constellation: false, timemachine: false, future: false, reactor: false },
  toast: null,
  reducedMotion: Boolean(motionQuery?.matches),
  pointer: { x: 0, y: 0 },
  /** bumps whenever the camera should (re)fly to the current view */
  camNonce: 0,

  /** a soft black curtain used for slow fades between far-apart places */
  curtain: false,
  /** set once the 3D canvas has rendered its first frames */
  sceneReady: false,

  setPhase: (phase) => set({ phase }),

  /** Fade to dark, run `fn` while hidden, then fade back. */
  throughCurtain: (fn, ms = 1600) => {
    if (get().curtain) return
    const quick = get().reducedMotion
    set({ curtain: true })
    setTimeout(
      () => {
        fn()
        setTimeout(() => set({ curtain: false }), quick ? 50 : 350)
      },
      quick ? 300 : ms,
    )
  },

  startFinale: () => {
    if (!get().letterRead) {
      get().showToast(hints.secretLocked)
      return
    }
    // the camera starts drifting up into the sky while the screen slowly dims
    set((s) => ({ riseCue: s.riseCue + 1, panel: null }))
    get().throughCurtain(() => get().goTo('finale'), 2200)
  },

  leaveFinale: () => get().throughCurtain(() => get().back(), 1300),

  enterWorld: () => {
    set({ phase: 'world', view: 'explore' })
    setTimeout(() => {
      // first visit: the prologue tells her what this universe is; afterwards just a gentle hint
      if (!get().prologueSeen) get().startDialog(story.prologue, 'prologue')
      else get().showToast(hints.explore, 6000)
    }, 2800)
  },

  goTo: (view) => {
    const { letterRead, visited } = get()
    if (view === 'finale' && !letterRead) {
      get().showToast(hints.secretLocked)
      return
    }
    set({
      view,
      camNonce: get().camNonce + 1,
      selectedMemory: view === 'memories' ? get().selectedMemory : null,
      capsuleLetter: null,
      activeStar: null,
      panel: null,
      timeIndex: view === 'timemachine' ? get().timeIndex : null,
      timeTravelling: view === 'timemachine' ? get().timeTravelling : false,
      threadMessage: null,
      secretStage: null,
      visited: view in visited ? { ...visited, [view]: true } : visited,
    })
  },

  back: () =>
    set((s) => ({
      view: 'explore',
      selectedMemory: null,
      capsuleLetter: null,
      activeStar: null,
      timeIndex: null,
      timeTravelling: false,
      threadMessage: null,
      secretStage: null,
      camNonce: s.camNonce + 1,
    })),

  /** Fly to a lantern on the Memory Lane. */
  openLane: (index = get().laneIndex) => {
    const n = memoryLane.milestones.length
    if (!n) return
    const i = ((index % n) + n) % n
    const laneVisited = get().laneVisited.includes(i) ? get().laneVisited : [...get().laneVisited, i]
    save({ laneVisited })
    set((s) => ({
      view: 'lane',
      laneIndex: i,
      laneVisited,
      panel: null,
      camNonce: s.camNonce + 1,
      visited: { ...s.visited, lane: true },
    }))
  },

  openCapsuleLetter: (id) => {
    if (id === null) return set({ capsuleLetter: null })
    if (!loveCapsule.letters.some((l) => l.id === id)) return
    const opened = get().capsuleOpened.includes(id) ? get().capsuleOpened : [...get().capsuleOpened, id]
    save({ capsuleOpened: opened })
    set({ capsuleLetter: id, capsuleOpened: opened })
  },

  /** A hidden heart was tapped. Returns true if it was new. */
  findHeart: (id) => {
    const found = get().foundHearts
    if (found.includes(id) || id < 0 || id >= HIDDEN_HEART_COUNT) return false
    const next = [...found, id]
    save({ foundHearts: next })
    set({ foundHearts: next })
    if (next.length === HIDDEN_HEART_COUNT) {
      get().showToast('All five hidden hearts found — a secret gift just unlocked ♡', 5200)
      setTimeout(() => set({ panel: 'hearts' }), 1400)
    } else {
      get().showToast(`You found a hidden heart! ${next.length} / ${HIDDEN_HEART_COUNT} ♡`, 3800)
    }
    return true
  },

  /** A constellation star was tapped. */
  lightStar: (index) => {
    if (index < 0 || index >= constellation.reasons.length) return
    const found = get().starsFound
    const next = found.includes(index) ? found : [...found, index]
    if (next !== found) save({ starsFound: next })
    set({ starsFound: next, activeStar: index })
  },

  closeStar: () => set({ activeStar: null }),

  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),

  /* ───────── story & dialog ───────── */

  /** Show a sequence of dialog lines. `key` lets us remember that it was seen. */
  startDialog: (lines, key = null) => {
    if (!lines?.length) return
    // replacing a dialog still records what was seen (prologue, intros)
    if (get().dialog) get().closeDialog()
    set({ dialog: { lines, index: 0, key } })
  },

  advanceDialog: () => {
    const d = get().dialog
    if (!d) return
    if (d.index < d.lines.length - 1) set({ dialog: { ...d, index: d.index + 1 } })
    else get().closeDialog()
  },

  closeDialog: () => {
    const d = get().dialog
    if (!d) return
    const patch = { dialog: null }
    if (d.key === 'prologue') patch.prologueSeen = true
    if (d.key?.startsWith('intro:')) {
      const i = Number(d.key.slice(6))
      if (!get().introsSeen.includes(i)) patch.introsSeen = [...get().introsSeen, i]
    }
    save({ prologueSeen: patch.prologueSeen ?? get().prologueSeen, introsSeen: patch.introsSeen ?? get().introsSeen })
    set(patch)
  },

  /** Jump to a chapter's place and play its intro. Locked chapters only explain why. */
  startChapter: (index, chapterUnlocked) => {
    if (!chapterUnlocked) {
      get().showToast('Finish the previous chapter to unlock this one ♡')
      return
    }
    const place = CHAPTER_PLACES[index] || 'explore'
    set({ panel: null })
    if (place === 'explore') get().back()
    else if (place === 'future') get().openFuture()
    else get().goTo(place)
    const chapter = story.chapters[index]
    if (chapter?.intro) setTimeout(() => get().startDialog(chapter.intro, `intro:${index}`), 900)
  },

  markCelebrated: (index) => {
    if (get().celebrated.includes(index)) return
    const celebrated = [...get().celebrated, index]
    save({ celebrated })
    set({ celebrated })
  },

  /* ───────── time machine ───────── */

  /** Travel to one date: plays the warp, then shows that day. Counts as visited. */
  travelTo: (index) => {
    if (index < 0 || index >= timeMachine.entries.length || get().timeTravelling) return
    const token = ++travelToken
    const quick = get().reducedMotion
    set({ timeTravelling: true, timeIndex: null })
    setTimeout(() => {
      // she left (or started another trip) during the warp: nothing was shown, so nothing counts
      if (token !== travelToken || get().view !== 'timemachine' || !get().timeTravelling) {
        if (token === travelToken) set({ timeTravelling: false })
        return
      }
      const timeVisited = get().timeVisited.includes(index) ? get().timeVisited : [...get().timeVisited, index]
      save({ timeVisited })
      set({ timeTravelling: false, timeIndex: index, timeVisited })
    }, quick ? 200 : 2000)
  },

  closeTimeEntry: () => set({ timeIndex: null }),

  /* ───────── red thread ───────── */

  tieThread: (side) => {
    if (side !== 'me' && side !== 'you') return
    const s = get()
    if (s.threadConnected) {
      // once connected, tapping an island opens its message
      const threadRead = s.threadRead.includes(side) ? s.threadRead : [...s.threadRead, side]
      save({ threadRead })
      set({ threadMessage: side, threadRead })
      return
    }
    const threadTied = { ...s.threadTied, [side]: true }
    const connected = threadTied.me && threadTied.you
    save({ threadTied, threadConnected: connected })
    set({ threadTied, threadConnected: connected })
    if (connected) get().showToast('The red thread is tied. Tap an island to open its message ♡', 5200)
    else get().showToast('One side tied — now the other island.', 3200)
  },

  closeThreadMessage: () => set({ threadMessage: null }),

  /* ───────── future simulator ───────── */

  openFuture: (index = get().futureIndex) => {
    const n = futureWorlds.worlds.length
    if (!n) return
    const i = ((index % n) + n) % n
    const futureVisited = get().futureVisited.includes(i) ? get().futureVisited : [...get().futureVisited, i]
    save({ futureVisited })
    set((s) => ({
      view: 'future',
      futureIndex: i,
      futureVisited,
      panel: null,
      camNonce: s.camNonce + 1,
      visited: { ...s.visited, future: true },
    }))
  },

  /* ───────── heart reactor & ending ───────── */

  /** Starts the final cutscene — only possible once every chapter is complete. */
  igniteReactor: () => {
    if (get().view === 'cutscene') return false // a double tap must not restart the ending
    if (completedCount(get()) < CHAPTER_COUNT) {
      get().showToast('The heart still needs more light. Finish every chapter first ♡')
      return false
    }
    set((s) => ({ view: 'cutscene', panel: null, dialog: null, camNonce: s.camNonce + 1 }))
    return true
  },

  /** After the cutscene (or when skipped): fade into the secret room. */
  finishCutscene: () => {
    if (get().view !== 'cutscene') return
    save({ endingSeen: true })
    get().throughCurtain(() => set((s) => ({ view: 'finalRoom', endingSeen: true, secretStage: null, starAwake: false, camNonce: s.camNonce + 1 })), 900)
  },

  /** The secret room is only reachable after all chapters are complete. */
  openFinalRoom: () => {
    if (completedCount(get()) < CHAPTER_COUNT) {
      get().showToast('This room only opens when every chapter is complete ♡')
      return
    }
    get().throughCurtain(() => set((s) => ({ view: 'finalRoom', panel: null, secretStage: null, starAwake: false, camNonce: s.camNonce + 1 })), 1200)
  },

  replayEnding: () => get().throughCurtain(() => get().igniteReactor(), 1000),

  leaveFinalRoom: () => get().throughCurtain(() => get().back(), 1200),

  /* ───────── secret ending ───────── */

  /** Only true when the game really is finished: every chapter done and the ending reached. */
  secretAvailable: () => {
    const s = get()
    return s.endingSeen && completedCount(s) >= CHAPTER_COUNT
  },

  /** The star wakes up once the final letter has appeared in the Secret Room. */
  wakeSecretStar: () => {
    if (get().view === 'finalRoom' && get().secretAvailable() && !get().starAwake) set({ starAwake: true })
  },

  /** She touched the star (or its hint). Starts the secret ending inside the existing Secret Room. */
  findSecret: () => {
    const s = get()
    if (s.view !== 'finalRoom' || s.secretStage || !s.secretAvailable() || s.curtain) return false
    save({ secretFound: true })
    set({ secretFound: true, secretStage: 'found', starAwake: true, panel: null, dialog: null })
    return true
  },

  /** Move forward through the secret ending. */
  setSecretStage: (stage) => {
    if (get().view !== 'finalRoom' || !get().secretAvailable()) return
    if (!['found', 'transition', 'letter', 'voice', 'photo'].includes(stage)) return
    set((s) => ({ secretStage: stage, camNonce: s.camNonce + 1 }))
  },

  /** The final moment: back to the whole universe, brighter, seen from afar. */
  openEpilogue: () => {
    if (get().view !== 'finalRoom' || !get().secretStage) return
    save({ secretSeen: true })
    get().throughCurtain(() => set((s) => ({ view: 'epilogue', secretStage: null, secretSeen: true, camNonce: s.camNonce + 1 })), 1800)
  },

  /** "Stay in our universe" — back to the normal island; all progress stays exactly as it was. */
  stayInUniverse: () => get().throughCurtain(() => get().back(), 1400),

  /** Replay only the secret ending (no need to replay the game). */
  replaySecret: () => {
    const s = get()
    if (!s.secretAvailable() || !(s.secretFound || s.secretSeen)) return
    get().throughCurtain(
      () => set((st) => ({ view: 'finalRoom', secretStage: 'found', starAwake: true, panel: null, dialog: null, camNonce: st.camNonce + 1 })),
      1200,
    )
  },

  selectMemory: (index) =>
    set((s) => {
      const viewedMemories =
        index === null || s.viewedMemories.includes(index) ? s.viewedMemories : [...s.viewedMemories, index]
      if (viewedMemories !== s.viewedMemories) save({ viewedMemories })
      return {
      viewedMemories,
      view: 'memories',
      selectedMemory: index,
      camNonce: s.camNonce + 1,
      visited: { ...s.visited, memories: true },
      }
    }),

  markLetterRead: () => {
    if (get().letterRead) return
    save({ letterRead: true })
    set({ letterRead: true, unlockPending: true })
  },

  consumeUnlock: () => set({ unlockPending: false }),

  showToast: (text, duration = 4200) => {
    const id = ++toastId
    set({ toast: { id, text } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, duration)
  },
}))

motionQuery?.addEventListener?.('change', (e) => useStore.setState({ reducedMotion: e.matches }))

// Normalised pointer (-1..1) used for parallax. Touch drags and device tilt both feed it.
if (typeof window !== 'undefined') {
  const setPointer = (x, y) => {
    const p = useStore.getState().pointer
    p.x = Math.max(-1, Math.min(1, x))
    p.y = Math.max(-1, Math.min(1, y))
  }
  window.addEventListener(
    'pointermove',
    (e) => setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)),
    { passive: true },
  )
  window.addEventListener(
    'deviceorientation',
    (e) => {
      if (e.gamma == null || e.beta == null) return
      setPointer(e.gamma / 30, -(e.beta - 45) / 30)
    },
    { passive: true },
  )
}

/** Story helpers for components: is chapter `i` unlocked / done? (cheap booleans, so no re-render storms) */
export const useChapterUnlocked = (i) => useStore((s) => Boolean(chapterStatus(s)[i]?.unlocked))
export const useChaptersDone = () => useStore((s) => completedCount(s))

/** Everything slows down during the secret ending (particles read this every frame). */
export const timeScale = (s) => (s.view === 'finalRoom' && s.secretStage ? 0.3 : s.view === 'epilogue' ? 0.55 : 1)
