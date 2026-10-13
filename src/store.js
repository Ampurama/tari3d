import { create } from 'zustand'
import { constellation, hints, loveCapsule, memoryLane } from './content/config'

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
let toastId = 0

const motionQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

export const useStore = create((set, get) => ({
  /** 'loading' → 'intro' → 'world' */
  phase: 'loading',
  /** 'intro' | 'explore' | 'memories' | 'lane' | 'letter' | 'capsule' | 'distance' | 'constellation' | 'finale' */
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
  /** small floating panels over any view: 'countdown' | 'hearts' | null */
  panel: null,
  /** bumps to make the camera rise toward the sky before the finale */
  riseCue: 0,
  letterRead: Boolean(saved.letterRead),
  unlockPending: false,
  visited: { memories: false, lane: false, letter: false, capsule: false, distance: false, constellation: false },
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
    setTimeout(() => get().showToast(hints.explore, 6000), 2600)
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
      visited: view in visited ? { ...visited, [view]: true } : visited,
    })
  },

  back: () =>
    set((s) => ({ view: 'explore', selectedMemory: null, capsuleLetter: null, activeStar: null, camNonce: s.camNonce + 1 })),

  /** Fly to a lantern on the Memory Lane. */
  openLane: (index = get().laneIndex) => {
    const n = memoryLane.milestones.length
    if (!n) return
    const i = ((index % n) + n) % n
    set((s) => ({
      view: 'lane',
      laneIndex: i,
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

  selectMemory: (index) =>
    set((s) => ({
      view: 'memories',
      selectedMemory: index,
      camNonce: s.camNonce + 1,
      visited: { ...s.visited, memories: true },
    })),

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
