import { create } from 'zustand'
import { hints } from './content/config'

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
  /** 'intro' | 'explore' | 'memories' | 'letter' | 'distance' | 'finale' */
  view: 'intro',
  selectedMemory: null,
  letterRead: Boolean(saved.letterRead),
  unlockPending: false,
  visited: { memories: false, letter: false, distance: false },
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
    get().throughCurtain(() => get().goTo('finale'), 1900)
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
      visited: view in visited ? { ...visited, [view]: true } : visited,
    })
  },

  back: () => set((s) => ({ view: 'explore', selectedMemory: null, camNonce: s.camNonce + 1 })),

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
