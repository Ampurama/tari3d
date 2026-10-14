import { create } from 'zustand'
import { avatars, companion, connections, constellation, futureWorlds, glowFlowers, hints, littleThings, loveCapsule, memories, memoryLane, picnic, secretHeart, story, timeMachine } from './content/config'
import { CHAPTER_COUNT, chapterIndex, chapterStatus, completedCount, PICNIC_GAMES, withNames } from './lib/story'
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
const addOnce = (list, id) => (list.includes(id) ? list : [...list, id])
let toastId = 0
let travelToken = 0

const motionQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

/** Story progress keys — the only things a deliberate "reset progress" clears. */
const STORY_KEYS = {
  mochiAwake: false,
  flowersFound: [],
  littleFound: [],
  connectionsDone: [],
  picnicDone: [],
  envelopeOpened: false,
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
  /** Chapter 1: the companion has been woken up, and the glowing flowers collected */
  mochiAwake: Boolean(saved.mochiAwake),
  /** she asked Mochi to wait where it is (instead of following her) */
  mochiStay: Boolean(saved.mochiStay),
  flowersFound: arr(saved.flowersFound),
  littleFound: arr(saved.littleFound),
  connectionsDone: arr(saved.connectionsDone),
  /** Chapter 4: the picnic mini-games she has won ('catch' | 'save' | 'fix') */
  picnicDone: arr(saved.picnicDone),
  /** Chapter 5: the envelope beneath the Love Tree */
  envelopeOpened: Boolean(saved.envelopeOpened),
  /** the optional secret heart behind the blossom tree */
  bonusFound: Boolean(saved.bonusFound),
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

  /** the companion's speech bubble: { text, id } | null */
  mochiLine: null,
  /** a reaction for the companion to act out: { kind, n } ('celebrate' | 'carry' | 'roll' | 'wake' | 'pet' | 'oops') */
  mochiCue: { kind: null, n: 0 },
  /** bumps every time the finale (re)starts */
  cineRun: 0,
  /** the picnic mini-game being played (view 'picnic'): 'catch' | 'save' | 'fix' | 'sunset' | null */
  picnicStage: null,
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
    // (a speech bubble never survives a scene change)
    set({ mochiLine: null })
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
      picnicStage: null,
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
    set({ toast: null, discovery: { ...discovery, title: withNames(discovery.title), text: withNames(discovery.text), id } })
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
  },

  /* ───────── the companion ───────── */

  /** A speech bubble over the companion's head (never blocks anything). */
  mochiSay: (text, ms = 3600) => {
    if (!text) return
    const id = ++toastId
    set({ mochiLine: { text: withNames(text), id } })
    setTimeout(() => {
      if (get().mochiLine?.id === id) set({ mochiLine: null })
    }, ms)
  },

  /** Ask the companion to act something out. */
  cueMochi: (kind) => set((s) => ({ mochiCue: { kind, n: s.mochiCue.n + 1 } })),

  /** "Tunggu di sini" / "Ayo ikut": Mochi stays put, or follows her again. */
  setMochiStay: (stay) => {
    save({ mochiStay: stay })
    set({ mochiStay: stay })
  },

  /** Chapter 1 begins: the fluffy heart wakes up (after pretending it isn't). */
  wakeMochi: () => {
    if (get().mochiAwake) return false
    save({ mochiAwake: true })
    set({ mochiAwake: true })
    get().cueMochi('wake')
    get().mochiSay(companion.wake[0], 2000)
    setTimeout(() => get().mochiSay(companion.wake[1], 5200), 2100)
    setTimeout(() => get().mochiSay(companion.flower[0], 3600), 7600)
    return true
  },

  /* ───────── Chapter 1 — The Goofy Beginning ───────── */

  /** One of the three glowing flowers. Returns true if it was new. */
  findGlowFlower: (id) => {
    if (!get().mochiAwake || !glowFlowers.some((f) => f.id === id) || get().flowersFound.includes(id)) return false
    const flowersFound = [...get().flowersFound, id]
    save({ flowersFound })
    set({ flowersFound })
    player.cheer = 1.2
    const n = flowersFound.filter((x) => glowFlowers.some((f) => f.id === x)).length
    // each flower brings its own little Mochi disaster
    if (n === 1) {
      get().cueMochi('carry')
      get().mochiSay(companion.carry[0], 2600)
      setTimeout(() => get().mochiSay(companion.carry[1], 1400), 2700)
      setTimeout(() => get().mochiSay(companion.carry[2], 3600), 4200)
    } else if (n === 2) {
      get().cueMochi('roll')
      get().mochiSay(companion.roll[0], 3600)
    } else {
      get().cueMochi('celebrate')
      get().mochiSay(companion.flower[2], 4200)
      // the reward: the first memory of this little world
      const first = memories[0]
      setTimeout(
        () =>
          get().showDiscovery(
            { kind: 'memory', title: companion.reward.title, text: first ? `“${first.caption || first.title}” — ${companion.reward.text}` : companion.reward.text, photo: first?.type === 'video' ? null : first?.src || null },
            9000,
          ),
        1800,
      )
    }
    if (n < glowFlowers.length) get().showToast(`Bunga bercahaya: ${n} / ${glowFlowers.length} ✦`, 2600)
    return true
  },

  markCelebrated: (index) => {
    if (get().celebrated.includes(index)) return
    const celebrated = [...get().celebrated, index]
    save({ celebrated })
    set({ celebrated })
  },

  /* ───────── Chapter 2 — Little Things About You ───────── */

  /** Record one of the five little things. Returns true if it was new. */
  findLittle: (id) => {
    const item = littleThings.find((l) => l.id === id)
    if (!item || get().littleFound.includes(id)) return false
    if (!chapterStatus(get())[chapterIndex('little-things')]?.unlocked) {
      get().mochiSay('Wah, berkilau! Tapi bantuin aku cari bunga yang bercahaya dulu, ya? ♡', 3600)
      return false
    }
    get().cueMochi('celebrate')
    get().mochiSay(companion.found[get().littleFound.length % companion.found.length], 3000)
    const littleFound = [...get().littleFound, id]
    save({ littleFound })
    set({ littleFound })
    player.cheer = 1.4
    get().showDiscovery({ kind: 'little', title: item.title, text: item.message, photo: item.photo || null, count: `${littleFound.filter((x) => littleThings.some((l) => l.id === x)).length} / ${littleThings.length}` })
    return true
  },

  /* ───────── Chapter 3 — A Little Far, Never Apart ───────── */

  /** Travel from the cliff to the two islands. */
  travelToMiles: () => {
    const i = chapterIndex('miles')
    if (!chapterStatus(get())[i]?.unlocked) {
      get().showToast('Dari teropong kelihatan dua pulau yang jauh… selesaiin babak sebelumnya dulu, ya ♡')
      return
    }
    get().throughCurtain(() => get().goTo('distance'), 1500)
    if (!get().introsSeen.includes(i)) setTimeout(() => get().startDialog(story.chapters[i].intro, `intro:${i}`), 3200)
  },

  completeConnection: (id) => {
    const item = connections.find((c) => c.id === id)
    if (!item || get().connectionsDone.includes(id) || !chapterStatus(get())[chapterIndex('miles')]?.unlocked) return false
    const connectionsDone = [...get().connectionsDone, id]
    save({ connectionsDone })
    set({ connectionsDone })
    get().cueMochi('celebrate')
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

  /* ───────── Chapter 4 — The Disaster Date ───────── */

  /** Sit down at the picnic: the first mini-game she hasn't won yet. */
  startPicnic: () => {
    const s = get()
    if (!chapterStatus(s)[chapterIndex('picnic')]?.unlocked) {
      s.mochiSay('Pikniknya belum siap! (Aku masih milih kue.)', 3200)
      return false
    }
    const next = PICNIC_GAMES.find((g) => !s.picnicDone.includes(g)) || 'sunset'
    s.throughCurtain(() => {
      set((st) => ({ view: 'picnic', picnicStage: next, panel: null, dialog: null, prompt: null, camNonce: st.camNonce + 1 }))
      if (!s.introsSeen.includes(chapterIndex('picnic')) && next === PICNIC_GAMES[0]) setTimeout(() => get().startDialog(story.chapters[chapterIndex('picnic')].intro, `intro:${chapterIndex('picnic')}`), 900)
    }, 1100)
    return true
  },

  /** A mini-game was won: on to the next one (the last one ends at sunset). */
  winPicnic: (game) => {
    const s = get()
    if (!PICNIC_GAMES.includes(game) || s.view !== 'picnic') return false
    const picnicDone = addOnce(s.picnicDone, game)
    if (picnicDone !== s.picnicDone) save({ picnicDone })
    set({ picnicDone })
    get().cueMochi('celebrate')
    get().showToast(picnic.games[game].done, 2600)
    const next = PICNIC_GAMES.find((g) => !picnicDone.includes(g)) || 'sunset'
    setTimeout(() => {
      if (get().view === 'picnic') set({ picnicStage: next })
    }, 1600)
    return true
  },

  /** After the sunset message: back to the island. */
  leavePicnic: () => get().throughCurtain(() => set((s) => ({ view: 'explore', picnicStage: null, camNonce: s.camNonce + 1 })), 1100),

  /* ───────── Chapter 5 — A Letter From the Future ───────── */

  /** The envelope beneath the Love Tree: the letter opens (the finale follows from the letter). */
  openEnvelope: () => {
    const s = get()
    if (!chapterStatus(s)[chapterIndex('letter')]?.unlocked) return false
    if (!s.envelopeOpened) {
      save({ envelopeOpened: true })
      set({ envelopeOpened: true })
      // the last chapter is celebrated by the finale itself
      s.markCelebrated(chapterIndex('letter'))
    }
    s.throughCurtain(() => set((st) => ({ view: 'ending', panel: null, dialog: null, prompt: null, discovery: null, camNonce: st.camNonce + 1 })), 1200)
    return true
  },

  /** The optional secret heart behind the blossom tree. */
  findBonusHeart: () => {
    if (!get().bonusFound) {
      save({ bonusFound: true })
      set({ bonusFound: true })
    }
    get().cueMochi('celebrate')
    get().showDiscovery({ kind: 'secret', title: secretHeart.title, text: secretHeart.text }, 9000)
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
    get().throughCurtain(() => set((s) => ({ view: 'cinematic', panel: null, dialog: null, prompt: null, discovery: null, camNonce: s.camNonce + 1, cineRun: s.cineRun + 1 })), 1400)
    return true
  },

  /** Watch the finale again from the start. */
  replayCinematic: () => {
    if (get().view !== 'cinematic') return get().startCinematic()
    get().throughCurtain(() => set((s) => ({ camNonce: s.camNonce + 1, cineRun: s.cineRun + 1 })), 1000)
    return true
  },

  /** The finale is over: remember it, then go where she chose ('explore' | 'memories' | 'ending'). */
  finishCinematic: (next = 'explore') => {
    if (get().view !== 'cinematic') return
    save({ mainEndingSeen: true })
    set({ mainEndingSeen: true })
    get().throughCurtain(() => set((s) => ({ view: next, selectedMemory: null, camNonce: s.camNonce + 1 })), 1000)
  },

  /** Mark the finale as seen without leaving it (its last words are on screen). */
  markEndingSeen: () => {
    if (get().mainEndingSeen) return
    save({ mainEndingSeen: true })
    set({ mainEndingSeen: true })
  },

  openLetterAgain: () => {
    if (!get().envelopeOpened) return
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
    set({ toast: { id, text: withNames(text) } })
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
/** Is a chapter open? `ch`: its index or its id ('goofy' | 'little-things' | 'miles' | 'picnic' | 'letter'). */
export const useChapterUnlocked = (ch) => useStore((s) => Boolean(chapterStatus(s)[typeof ch === 'string' ? chapterIndex(ch) : ch]?.unlocked))
export const useChaptersDone = () => useStore((s) => completedCount(s))

/** Time runs slower in the quiet parts (particles read this every frame). */
export const timeScale = (s) => (s.view === 'finalRoom' && s.secretStage ? 0.3 : s.view === 'epilogue' ? 0.55 : 1)

/** Which avatar config is active. */
export const currentAvatar = (s) => avatars.find((a) => a.id === s.avatarId) || avatars[0]
