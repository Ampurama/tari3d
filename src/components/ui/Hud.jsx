import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookHeart, Heart, House, LayoutGrid, Lock, Music, Sparkles, VolumeX, Wind } from 'lucide-react'
import { couple, hints } from '../../content/config'
import { daysSince } from '../../lib/device'
import { useChaptersDone, useStore } from '../../store'
import { CHAPTER_COUNT } from '../../lib/story'
import { audio } from '../../audio/engine'
import { CountdownPanel, CountdownPill } from './Countdown'
import { HeartsPanel, HeartsPill } from './HeartsPanel'
import { ChapterPill, DialogBox, PlacesSheet, StoryDirector, StoryPanel } from './Story'

export function AudioControls() {
  const [state, setState] = useState({ musicOn: audio.musicOn, ambientOn: audio.ambientOn })
  useEffect(() => audio.subscribe(setState), [])
  return (
    <div className="audio-controls">
      <button
        type="button"
        className={`icon-btn${state.musicOn ? ' is-on' : ''}`}
        onClick={() => audio.setMusic(!state.musicOn, { user: true })}
        aria-pressed={state.musicOn}
        aria-label={state.musicOn ? 'Turn music off' : 'Turn music on'}
        title={state.musicOn ? 'Music on' : 'Music off'}
      >
        {state.musicOn ? <Music size={18} /> : <VolumeX size={18} />}
        {state.musicOn && (
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      <button
        type="button"
        className={`icon-btn${state.ambientOn ? ' is-on' : ''}`}
        onClick={() => audio.setAmbient(!state.ambientOn)}
        aria-pressed={state.ambientOn}
        aria-label={state.ambientOn ? 'Turn ambient wind off' : 'Turn ambient wind and chimes on'}
        title="Ambient wind & chimes"
      >
        <Wind size={18} />
      </button>
    </div>
  )
}

const VIEW_TITLES = {
  memories: 'Our memories',
  letter: 'A letter for you',
  distance: 'Red Thread',
  lane: 'Memory Lane',
  timemachine: 'Time Machine',
  future: 'Future Simulator',
  reactor: 'Heart Reactor',
  capsule: 'Love Capsule',
  constellation: 'Our Constellation',
}

function Brand() {
  const days = daysSince(couple.since)
  return (
    <div className="brand">
      <span className="brand-title">Our Little Universe</span>
      {days && (
        <span className="brand-sub">
          day {days.toLocaleString()} of {couple.me.name} &amp; {couple.you.name}
        </span>
      )}
      <div className="brand-pills">
        <ChapterPill />
        <CountdownPill />
      </div>
    </div>
  )
}

function Dock() {
  const goTo = useStore((s) => s.goTo)
  const startFinale = useStore((s) => s.startFinale)
  const letterRead = useStore((s) => s.letterRead)
  const visited = useStore((s) => s.visited)
  const setPanel = useStore((s) => s.setPanel)
  const done = useChaptersDone()
  const items = [
    { key: 'explore', label: 'Island', icon: House, action: () => goTo('explore') },
    { key: 'story', label: 'Story', icon: BookHeart, action: () => setPanel('story'), badge: `${done}/${CHAPTER_COUNT}` },
    { key: 'places', label: 'Places', icon: LayoutGrid, action: () => setPanel('places') },
    { key: 'reactor', label: 'Reactor', icon: Heart, action: () => goTo('reactor'), glow: done >= CHAPTER_COUNT },
    {
      key: 'finale',
      label: letterRead ? 'Secret' : 'Locked',
      icon: letterRead ? Sparkles : Lock,
      action: startFinale,
      locked: !letterRead,
    },
  ]
  return (
    <motion.nav
      className="dock"
      aria-label="Places in our universe"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {items.map(({ key, label, icon: Icon, action, locked, badge, glow }) => (
        <button
          key={key}
          type="button"
          className={`dock-item${locked ? ' is-locked' : ''}${(key === 'finale' && !locked) || glow ? ' is-secret' : ''}`}
          onClick={() => {
            audio.sparkle()
            action()
          }}
          aria-label={locked ? `${label}: ${hints.secretLocked}` : label}
        >
          <Icon size={19} strokeWidth={1.7} />
          <span>{label}</span>
          {badge && <b className="dock-badge">{badge}</b>}
          {visited[key] && <i className="dock-dot" aria-hidden="true" />}
        </button>
      ))}
    </motion.nav>
  )
}

export function Toast() {
  const toast = useStore((s) => s.toast)
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.45 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Everything 2D that floats over the world: brand, back button, dock, sound, toasts. */
export default function Hud() {
  const phase = useStore((s) => s.phase)
  const view = useStore((s) => s.view)
  const back = useStore((s) => s.back)
  const unlockPending = useStore((s) => s.unlockPending)
  const consumeUnlock = useStore((s) => s.consumeUnlock)
  const showToast = useStore((s) => s.showToast)
  const inWorld = phase === 'world'
  const secretStage = useStore((s) => s.secretStage)

  // tell her when the secret path wakes up — once she's back on the island
  useEffect(() => {
    if (view === 'explore' && unlockPending) {
      const t = setTimeout(() => {
        showToast(hints.secretUnlocked, 6000)
        consumeUnlock()
      }, 1300)
      return () => clearTimeout(t)
    }
  }, [view, unlockPending, showToast, consumeUnlock])

  // Escape always brings you home
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const st = useStore.getState()
      const { view: v, selectedMemory, panel, capsuleLetter, activeStar, setPanel, closeStar } = st
      if (panel) return setPanel(null)
      if (st.dialog) return st.closeDialog()
      if (['explore', 'intro', 'finale', 'cutscene', 'finalRoom', 'epilogue'].includes(v)) return
      if (v === 'timemachine' && st.timeIndex !== null) return st.closeTimeEntry()
      if (v === 'distance' && st.threadMessage) return // the message card closes itself
      if (v === 'memories' && selectedMemory !== null) return // the lightbox handles its own Escape
      if (v === 'capsule' && capsuleLetter) return // the capsule closes its letter first
      if (v === 'constellation' && activeStar !== null) return closeStar()
      back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  if (phase === 'loading') return null
  // only the cutscene hides the whole HUD; during the secret ending just the music controls stay (so sound is always in her hands)
  const cinematic = view === 'cutscene'
  const secretActive = view === 'epilogue' || (view === 'finalRoom' && Boolean(secretStage))
  const focused = inWorld && view !== 'explore' && view !== 'finale' && view !== 'finalRoom' && view !== 'epilogue' && !cinematic

  return (
    <>
      <StoryDirector />
      <header className={`hud-top${cinematic ? ' is-hidden' : ''}`}>
        <AnimatePresence mode="wait">
          {focused ? (
            <motion.button
              key="back"
              type="button"
              className="back-btn"
              onClick={back}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <ArrowLeft size={17} />
              <span>
                Back to our island
                {VIEW_TITLES[view] && <em> · {VIEW_TITLES[view]}</em>}
              </span>
            </motion.button>
          ) : inWorld && view === 'explore' ? (
            <motion.div key="brand" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Brand />
            </motion.div>
          ) : (
            <span key="empty" />
          )}
        </AnimatePresence>
        <div className="hud-right">
          {inWorld && view !== 'finale' && view !== 'finalRoom' && view !== 'epilogue' && !cinematic && <HeartsPill />}
          <AudioControls />
        </div>
      </header>
      <AnimatePresence>{inWorld && view === 'explore' && <Dock key="dock" />}</AnimatePresence>
      <Toast />
      <CountdownPanel />
      <HeartsPanel />
      <StoryPanel />
      <PlacesSheet />
      {inWorld && !cinematic && !secretActive && <DialogBox />}
    </>
  )
}
