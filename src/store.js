import { create } from 'zustand'
import { avatars, connections, constellation, futureWorlds, hints, littleThings, loveCapsule, memoryLane, seeds, story, timeMachine } from './content/config'
import { CHAPTER_COUNT, chapterStatus, completedCount } from './lib/story'
import { player, resetPlayer } from './lib/player'

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
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const addOnce = (list, id) => (list.includes(id) ? list : [...list, id])
let toastId = 0
let travelToken = 0

const motionQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

/** Story progress keys — the only things a deliberate "reset progress" clears. */
const STORY_KEYS = {
  littleFound: [],
  connectionsDone: [],
  seedState: {},
  carrying: null,
  hasWater: false,
  stonesLit: [],
  futureLinks: [],
  prologueSeen: false,
  introsSeen: [],
  celebrated: [],
  mainEndingSeen: false,
  secretFound: false,
  secretSeen: false,
  viewpointSeen: false,
}

export const useStore = create((set, get) => ({
  /** 'loading' → 'intro' → 'world' */
  phase: 'loading',
  /**
   * 'intro' | 'avatar' | 'explore' | 'memories' | 'lane' | 'letter' | 'capsule' | 'distance' | 'constellation'
   * | 'finale' | 'timemachine' | 'future' | 'cinematic' | 'ending' | 'finalRoom' | 'epilogue'
   */
  view: 'intro',
  selectedMemory: null,
  laneIndex: 0,
  capsuleLetter: null,
  capsuleOpened: arr(saved.capsuleOpened),
  foundHearts: arr(saved.foundHearts),
  starsFound: arr(saved.starsFound),
  activeStar: null,
  viewedMemories: arr(saved.viewedMemories),
  laneVisited: arr(saved.laneVisited),
  timeVisited: arr(saved.timeVisited),
  timeIndex: null,
  timeTravelling: false,
  /** 'me' | 'you' | null — the island message that's open (Chapter 2) */
  threadMessage: null,
  threadRead: arr(saved.threadRead),
  futureVisited: arr(saved.futureVisited),
  futureIndex: 0,

  /* ── avatar ── */
  avatarId: avatars.some((a) => a.id === saved.avatarId) ? saved.avatarId : null,

  /* ── story progress: every value comes from something she actually did ── */
  littleFound: arr(saved.littleFound),
  connectionsDone: arr(saved.connectionsDone),
  /** seed id → 'carried' | 'planted' | 'grown' */
  seedState: obj(saved.seedState),
  /** the seed she's holding right now (one at a time) */
  carrying: typeof saved.carrying === 'string' ? saved.carrying : null,
  /** water fetched from the lake for the Kindness seed */
  hasWater: Boolean(saved.hasWater),
  /** guiding stones lit for the Shared Adventures seed */
  stonesLit: arr(saved.stonesLit),
  /** grown seeds already linked to the Future seed */
  futureLinks: arr(saved.futureLinks),
  notesFound: arr(saved.notesFound),
  viewpointSeen: Boolean(saved.viewpointSeen),
  prologueSeen: Boolean(saved.prologueSeen),
  introsSeen: arr(saved.introsSeen),
  celebrated: arr(saved.celebrated),
  mainEndingSeen: Boolean(saved.mainEndingSeen),

  /* ── secret ending ── */
  /** null | 'found' | 'transition' | 'letter' | 'voice' | 'photo' — stages inside the Secret Room */
  secretStage: null,
  secretFound: Boolean(saved.secretFound),
  secretSeen: Boolean(saved.secretSeen),

  /** the interactable the avatar is standing next to: { id, label } | null */
  prompt: null,
  /** the 💡 hint guide: a light beam on the next goal and a trail of light from the avatar */
  guide: false,
  /** a short card shown when something is discovered: { title, text, kind } | null */
  discovery: null,
  /** visual-novel style dialog: { lines, index, key } */
  dialog: null,
  /** floating panels: 'countdown' | 'hearts' | 'story' | 'places' | 'settings' | null */
  panel: null,
  riseCue: 0,
  letterRead: Boolean(saved.letterRead),
  unlockPending: false,
  visited: { memories: false, lane: false, letter: false, capsule: false, distance: false, constellation: false, timemachine: false, future: false },
  toast: null,
  reducedMotion: Boolean(motionQuery?.matches),
  pointer: { x: 0, y: 0 },
  /** bumps whenever the camera should (re)fly to the current view */
  camNonce: 0,
  curtain: false,
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

  /* ───────── avatar selection ───────── */

  /** From the intro (or the HUD): open the character selection. Progress is untouched. */
  openAvatarSelect: () => {
    const fromWorld = get().phase === 'world'
    const go = () => set((s) => ({ view: 'avatar', panel: null, dialog: null, prompt: null, camNonce: s.camNonce + 1 }))
    if (fromWorld) get().throughCurtain(go, 1000)
    else go()
  },

  chooseAvatar: (id) => {
    if (!avatars.some((a) => a.id === id)) return
    save({ avatarId: id })
    set({ avatarId: id })
  },

  /** Confirm the character and step into the world (Starting Meadow on a first visit). */
  enterWorld: () => {
    if (!get().avatarId) get().chooseAvatar(avatars[0]?.id)
    const first = get().phase !== 'world'
    get().throughCurtain(() => {
      if (first) resetPlayer()
      set((s) => ({ phase: 'world', view: 'explore', camNonce: s.camNonce + 1 }))
      setTimeout(() => {
        if (!get().prologueSeen) get().startDialog([...story.prologue, ...story.chapters[0].intro], 'prologue')
        else get().showToast(hints.explore, 6000)
      }, 1600)
    }, 1400)
  },

  /* ───────── navigation ───────── */

  startFinale: () => {
    if (!get().letterRead) {
      get().showToast(hints.secretLocked)
      return
    }
    set((s) => ({ riseCue: s.riseCue + 1, panel: null }))
    get().throughCurtain(() => get().goTo('finale'), 2200)
  },

  leaveFinale: () => get().throughCurtain(() => get().back(), 1300),

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
      prompt: null,
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

  openLane: (index = get().laneIndex) => {
    const n = memoryLane.milestones.length
    if (!n) return
    const i = ((index % n) + n) % n
    const laneVisited = addOnce(get().laneVisited, i)
    save({ laneVisited })
    set((s) => ({ view: 'lane', laneIndex: i, laneVisited, panel: null, prompt: null, camNonce: s.camNonce + 1, visited: { ...s.visited, lane: true } }))
  },

  openCapsuleLetter: (id) => {
    if (id === null) return set({ capsuleLetter: null })
    if (!loveCapsule.letters.some((l) => l.id === id)) return
    const opened = addOnce(get().capsuleOpened, id)
    save({ capsuleOpened: opened })
    set({ capsuleLetter: id, capsuleOpened: opened })
  },

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

  lightStar: (index) => {
    if (index < 0 || index >= constellation.reasons.length) return
    const next = addOnce(get().starsFound, index)
    if (next !== get().starsFound) save({ starsFound: next })
    set({ starsFound: next, activeStar: index })
  },

  closeStar: () => set({ activeStar: null }),

  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),

  setGuide: (guide) => set({ guide: Boolean(guide) }),

  setPrompt: (prompt) => {
    const cur = get().prompt
    if (cur?.id === prompt?.id && cur?.label === prompt?.label) return
    set({ prompt })
  },

  /** A small card announcing a discovery. Closes itself. */
  showDiscovery: (discovery, ms = 6500) => {
    const id = ++toastId
    // a discovery card replaces any toast (they would sit on top of each other)
    set({ toast: null, discovery: { ...discovery, id } })
    setTimeout(() => {
      if (get().discovery?.id === id) set({ discovery: null })
    }, ms)
  },
  closeDiscovery: () => set({ discovery: null }),

  /* ───────── dialog ───────── */

  startDialog: (lines, key = null) => {
    if (!lines?.length) return
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
    if (d.key === 'prologue') {
      patch.prologueSeen = true
      patch.introsSeen = addOnce(get().introsSeen, 0)
    }
    if (d.key?.startsWith('intro:')) patch.introsSeen = addOnce(get().introsSeen, Number(d.key.slice(6)))
    save({ prologueSeen: patch.prologueSeen ?? get().prologueSeen, introsSeen: patch.introsSeen ?? get().introsSeen })
    set(patch)
    // after Chapter 3's last words, the final cinematic begins
    if (d.key === `outro:${CHAPTER_COUNT - 1}` && completedCount(get()) >= CHAPTER_COUNT && !get().mainEndingSeen) {
      setTimeout(() => get().startCinematic(), 900)
    }
  },

  markCelebrated: (index) => {
    if (get().celebrated.includes(index)) return
    const celebrated = [...get().celebrated, index]
    save({ celebrated })
    set({ celebrated })
  },

  /* ───────── Chapter 1 — The Little Things ───────── */

  /** Record one of the five little things. Returns true if it was new. */
  findLittle: (id) => {
    const item = littleThings.find((l) => l.id === id)
    if (!item || get().littleFound.includes(id)) return false
    const littleFound = [...get().littleFound, id]
    save({ littleFound })
    set({ littleFound })
    player.cheer = 1.4
    get().showDiscovery({ kind: 'little', title: item.title, text: item.message, photo: item.photo || null, count: `${littleFound.filter((x) => littleThings.some((l) => l.id === x)).length} / ${littleThings.length}` })
    return true
  },

  /* ───────── Chapter 2 — Miles Between Us ───────── */

  /** Travel from the cliff to the two islands. */
  travelToMiles: () => {
    if (!chapterStatus(get())[1]?.unlocked) {
      get().showToast('The telescope shows two islands far away… finish Chapter One first ♡')
      return
    }
    get().throughCurtain(() => get().goTo('distance'), 1500)
    if (!get().introsSeen.includes(1)) setTimeout(() => get().startDialog(story.chapters[1].intro, 'intro:1'), 3200)
  },

  completeConnection: (id) => {
    const item = connections.find((c) => c.id === id)
    if (!item || get().connectionsDone.includes(id) || !chapterStatus(get())[1]?.unlocked) return false
    const connectionsDone = [...get().connectionsDone, id]
    save({ connectionsDone })
    set({ connectionsDone })
    get().showDiscovery({ kind: 'connection', title: item.title, text: item.message, count: `${connectionsDone.length} / ${connections.length}` }, 5500)
    return true
  },

  openThreadMessage: (side) => {
    if (side !== 'me' && side !== 'you') return
    const threadRead = addOnce(get().threadRead, side)
    save({ threadRead })
    set({ threadMessage: side, threadRead })
  },
  closeThreadMessage: () => set({ threadMessage: null }),

  /* ───────── Chapter 3 — A Future We Grow ───────── */

  pickSeed: (id) => {
    const s = get()
    if (!chapterStatus(s)[2]?.unlocked) return false
    if (!seeds.some((sd) => sd.id === id) || s.seedState[id]) return false
    if (s.carrying) {
      get().showToast('You’re already carrying a seed — plant it first ♡', 3200)
      return false
    }
    const seedState = { ...s.seedState, [id]: 'carried' }
    save({ seedState, carrying: id })
    set({ seedState, carrying: id })
    player.cheer = 0.8
    get().showToast(`You picked up the seed of ${seeds.find((sd) => sd.id === id).title}. Find its place beside the Love Tree ✦`, 5200)
    return true
  },

  /** Plant the carried seed into its plot (each seed has its own plot). */
  plantSeed: (id) => {
    const s = get()
    if (s.carrying !== id || s.seedState[id] !== 'carried') return false
    const seedState = { ...s.seedState, [id]: 'planted' }
    save({ seedState, carrying: null })
    set({ seedState, carrying: null })
    const sd = seeds.find((x) => x.id === id)
    // honesty is planted by hand — that *is* its care, so it grows right away (never left half-done)
    if (id === 'honesty') return get().growSeed('honesty')
    get().showToast(`Planted ${sd.title}. ${sd.care}`, 5600)
    return true
  },

  /** The seed's own care step is done → it grows. */
  growSeed: (id) => {
    const s = get()
    if (s.seedState[id] !== 'planted') return false
    if (id === 'future') {
      const others = seeds.filter((sd) => sd.id !== 'future')
      if (!others.every((sd) => s.seedState[sd.id] === 'grown')) return false
    }
    const seedState = { ...s.seedState, [id]: 'grown' }
    const patch = { seedState }
    if (id === 'kindness') patch.hasWater = false
    save(patch)
    set(patch)
    player.cheer = 1.2
    const sd = seeds.find((x) => x.id === id)
    const grown = seeds.filter((x) => seedState[x.id] === 'grown').length
    get().showDiscovery({ kind: 'seed', title: sd.title, text: sd.message, count: `${grown} / ${seeds.length}` }, 5500)
    return true
  },

  fetchWater: () => {
    if (get().hasWater) return
    save({ hasWater: true })
    set({ hasWater: true })
    get().showToast('You scooped up a little lake water ✦', 3000)
  },

  lightStone: (n) => {
    const stonesLit = addOnce(get().stonesLit, n)
    save({ stonesLit })
    set({ stonesLit })
    // both guiding stones lit → Shared Adventures grows at once
    if (stonesLit.length >= 2 && get().seedState.adventures === 'planted') get().growSeed('adventures')
  },

  linkFuture: (id) => {
    if (get().seedState.future !== 'planted') return
    const futureLinks = addOnce(get().futureLinks, id)
    save({ futureLinks })
    set({ futureLinks })
  },

  /* ───────── optional discoveries ───────── */

  findNote: (note) => {
    if (get().notesFound.includes(note.id)) {
      get().showDiscovery({ kind: 'note', title: note.where, text: note.text }, 6000)
      return false
    }
    const notesFound = [...get().notesFound, note.id]
    save({ notesFound })
    set({ notesFound })
    get().showDiscovery({ kind: 'note', title: note.where, text: note.text }, 7000)
    return true
  },

  markViewpoint: () => {
    if (get().viewpointSeen) return
    save({ viewpointSeen: true })
    set({ viewpointSeen: true })
  },

  /* ───────── final cinematic, letter & secret ───────── */

  startCinematic: () => {
    if (completedCount(get()) < CHAPTER_COUNT || get().view === 'cinematic') return false
    get().throughCurtain(() => set((s) => ({ view: 'cinematic', panel: null, dialog: null, prompt: null, discovery: null, camNonce: s.camNonce + 1 })), 1400)
    return true
  },

  /** After the cinematic (or when skipped): the love letter. */
  finishCinematic: () => {
    if (get().view !== 'cinematic') return
    save({ mainEndingSeen: true })
    get().throughCurtain(() => set((s) => ({ view: 'ending', mainEndingSeen: true, camNonce: s.camNonce + 1 })), 1000)
  },

  openLetterAgain: () => {
    if (!get().mainEndingSeen) return
    set((s) => ({ view: 'ending', panel: null, prompt: null, camNonce: s.camNonce + 1 }))
  },

  /** The secret is only reachable after the main ending. */
  secretAvailable: () => {
    const s = get()
    return s.mainEndingSeen && completedCount(s) >= CHAPTER_COUNT
  },

  /** She touched the little star by the Love Tree: go somewhere quiet, then begin. */
  openSecret: () => {
    const s = get()
    if (!s.secretAvailable() || s.curtain || s.view === 'finalRoom') return false
    save({ secretFound: true })
    get().throughCurtain(
      () => set((st) => ({ view: 'finalRoom', secretFound: true, secretStage: 'found', panel: null, dialog: null, prompt: null, camNonce: st.camNonce + 1 })),
      1800,
    )
    return true
  },

  setSecretStage: (stage) => {
    if (get().view !== 'finalRoom' || !get().secretAvailable()) return
    if (!['found', 'transition', 'letter', 'voice', 'photo'].includes(stage)) return
    set((s) => ({ secretStage: stage, camNonce: s.camNonce + 1 }))
  },

  openEpilogue: () => {
    if (get().view !== 'finalRoom' || !get().secretStage) return
    save({ secretSeen: true })
    get().throughCurtain(() => set((s) => ({ view: 'epilogue', secretStage: null, secretSeen: true, camNonce: s.camNonce + 1 })), 1800)
  },

  stayInUniverse: () => get().throughCurtain(() => get().back(), 1400),

  replaySecret: () => {
    const s = get()
    if (!s.secretAvailable() || !(s.secretFound || s.secretSeen)) return
    get().throughCurtain(
      () => set((st) => ({ view: 'finalRoom', secretStage: 'found', panel: null, dialog: null, prompt: null, camNonce: st.camNonce + 1 })),
      1200,
    )
  },

  /** Deliberate reset of the story (avatar, optional finds and settings are kept). */
  resetStory: () => {
    save(STORY_KEYS)
    set({ ...STORY_KEYS, panel: null, dialog: null, discovery: null })
    get().throughCurtain(() => {
      resetPlayer()
      get().back()
      setTimeout(() => get().startDialog([...story.prologue, ...story.chapters[0].intro], 'prologue'), 1200)
    }, 1000)
  },

  /* ───────── older optional places ───────── */

  travelTo: (index) => {
    if (index < 0 || index >= timeMachine.entries.length || get().timeTravelling) return
    const token = ++travelToken
    const quick = get().reducedMotion
    set({ timeTravelling: true, timeIndex: null })
    setTimeout(() => {
      if (token !== travelToken || get().view !== 'timemachine' || !get().timeTravelling) {
        if (token === travelToken) set({ timeTravelling: false })
        return
      }
      const timeVisited = addOnce(get().timeVisited, index)
      save({ timeVisited })
      set({ timeTravelling: false, timeIndex: index, timeVisited })
    }, quick ? 200 : 2000)
  },

  closeTimeEntry: () => set({ timeIndex: null }),

  openFuture: (index = get().futureIndex) => {
    const n = futureWorlds.worlds.length
    if (!n) return
    const i = ((index % n) + n) % n
    const futureVisited = addOnce(get().futureVisited, i)
    save({ futureVisited })
    set((s) => ({ view: 'future', futureIndex: i, futureVisited, panel: null, prompt: null, camNonce: s.camNonce + 1, visited: { ...s.visited, future: true } }))
  },

  selectMemory: (index) =>
    set((s) => {
      const viewedMemories = index === null ? s.viewedMemories : addOnce(s.viewedMemories, index)
      if (viewedMemories !== s.viewedMemories) save({ viewedMemories })
      return { viewedMemories, view: 'memories', selectedMemory: index, prompt: null, camNonce: s.camNonce + 1, visited: { ...s.visited, memories: true } }
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

// Normalised pointer (-1..1) used for parallax.
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
}

/** Story helpers for components (cheap booleans/numbers, so no re-render storms). */
export const useChapterUnlocked = (i) => useStore((s) => Boolean(chapterStatus(s)[i]?.unlocked))
export const useChaptersDone = () => useStore((s) => completedCount(s))

/** Time runs slower in the quiet parts (particles read this every frame). */
export const timeScale = (s) => (s.view === 'finalRoom' && s.secretStage ? 0.3 : s.view === 'epilogue' ? 0.55 : 1)

/** Which avatar config is active. */
export const currentAvatar = (s) => avatars.find((a) => a.id === s.avatarId) || avatars[0]
