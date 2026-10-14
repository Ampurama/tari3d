import { Component, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, BookHeart, Footprints, Hourglass, Images, Lock, Mail, Orbit, Sparkles, Sprout, Star, Telescope } from 'lucide-react'
import { constellation, hints, loveCapsule, memoryLane, story } from '../../content/config'
import { CHAPTER_COUNT, chapterStatus } from '../../lib/story'
import { useStore } from '../../store'
import IntroOverlay from './IntroOverlay'
import Hud from './Hud'
import MemoriesOverlay from './MemoriesOverlay'
import LetterOverlay from './LetterOverlay'
import DistanceOverlay from './DistanceOverlay'
import FinaleOverlay, { Curtain } from './FinaleOverlay'
import LoadingScreen from './LoadingScreen'
import LaneOverlay from './LaneOverlay'
import CapsuleOverlay from './CapsuleOverlay'
import ConstellationOverlay from './ConstellationOverlay'
import { FlatHiddenHearts } from './HeartsPanel'
import TimeMachineOverlay from './TimeMachineOverlay'
import FutureOverlay from './FutureOverlay'
import { CinematicOverlay, EndingLetter } from './Ending'
import SecretEnding from './SecretEnding'
import AvatarSelect from './AvatarSelect'
import { FlatChapterSheets } from './FlatStory'

export class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('[our-little-universe] 3D unavailable, switching to the 2D version.', error?.message)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The 2D hub: the three chapters first, then the little extras. */
function FlatWorld() {
  const view = useStore((s) => s.view)
  const goTo = useStore((s) => s.goTo)
  const startFinale = useStore((s) => s.startFinale)
  const letterRead = useStore((s) => s.letterRead)
  const openLane = useStore((s) => s.openLane)
  const openFuture = useStore((s) => s.openFuture)
  const ended = useStore((s) => s.mainEndingSeen)
  const sig = useStore((s) => chapterStatus(s).map((c) => `${c.done}${c.unlocked}${c.tasks[0].have}`).join('|'))
  const [sheet, setSheet] = useState(null)
  const chapters = chapterStatus(useStore.getState())
  void sig
  const all = chapters.every((c) => c.done)

  const chapterCards = chapters.map((c) => ({
    key: `ch${c.index}`,
    icon: c.done ? Sparkles : !c.unlocked ? Lock : [Star, Telescope, Sprout][c.index],
    title: `Chapter ${c.index + 1} · ${c.title}`,
    text: !c.unlocked ? 'Finish the chapter before ✦' : `${c.tasks[0].have}/${c.tasks[0].need} · ${c.subtitle}`,
    locked: !c.unlocked,
    go: () => (c.index === 0 ? setSheet('little') : c.index === 1 ? useStore.getState().travelToMiles() : setSheet('seeds')),
  }))
  const extras = [
    { key: 'memories', icon: Images, title: 'Our memories', text: 'Little moments I keep close.', go: () => goTo('memories') },
    { key: 'lane', icon: Footprints, title: memoryLane.title, text: memoryLane.subtitle, go: () => openLane() },
    { key: 'letter', icon: Mail, title: 'A letter for you', text: 'Words I wanted you to have.', go: () => goTo('letter') },
    { key: 'capsule', icon: Archive, title: loveCapsule.title, text: loveCapsule.subtitle, go: () => goTo('capsule') },
    { key: 'constellation', icon: Star, title: constellation.title, text: constellation.subtitle, go: () => goTo('constellation') },
    { key: 'timemachine', icon: Hourglass, title: 'Time Machine', text: 'Travel back to our dates.', go: () => goTo('timemachine') },
    { key: 'future', icon: Orbit, title: 'Future Simulator', text: 'Worlds we will visit.', go: () => openFuture(0) },
    { key: 'finale', icon: letterRead ? Sparkles : Lock, title: letterRead ? 'One last thing…' : 'Still sleeping', text: letterRead ? 'Come closer.' : hints.secretLocked, go: startFinale, locked: !letterRead },
  ]

  const Card = ({ c }) => (
    <button
      type="button"
      className={`flat-card${c.locked ? ' is-locked' : ''}`}
      onClick={() => (c.locked ? useStore.getState().showToast('Still asleep — keep following the story ♡') : c.go())}
    >
      <c.icon size={22} strokeWidth={1.6} />
      <strong>{c.title}</strong>
      <span>{c.text}</span>
    </button>
  )

  return (
    <>
      <AnimatePresence>
        {view === 'explore' && (
          <motion.div className="flat-world" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h1>{story.title}</h1>
            <p className="flat-note">A little universe made just for you ♡</p>
            <div className="flat-cards chapters">
              {chapterCards.map((c) => (
                <Card key={c.key} c={c} />
              ))}
            </div>
            {all && (
              <div className="flat-ending-actions">
                <button type="button" className="btn-glow" onClick={() => useStore.getState().startCinematic()}>
                  <BookHeart size={16} /> {ended ? 'Replay the ending' : 'Watch the ending'}
                </button>
                {ended && (
                  <button type="button" className="btn-ghost secret-hint" onClick={() => useStore.getState().openSecret()}>
                    ✦ A little star you haven’t noticed before…
                  </button>
                )}
              </div>
            )}
            <h2 className="flat-subtitle">Little extras</h2>
            <div className="flat-cards">
              {extras.map((c) => (
                <Card key={c.key} c={c} />
              ))}
            </div>
            <p className="flat-note small">
              {chapters.filter((c) => c.done).length}/{CHAPTER_COUNT} chapters complete
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <FlatChapterSheets open={view === 'explore' ? sheet : null} onClose={() => setSheet(null)} />
    </>
  )
}

/**
 * Full 2D version of the experience for browsers/devices without WebGL.
 * Same content, same order, same progress — drawn with CSS instead of 3D.
 */
export default function Fallback() {
  const phase = useStore((s) => s.phase)
  const view = useStore((s) => s.view)
  const setPhase = useStore((s) => s.setPhase)
  useEffect(() => {
    if (phase === 'loading') {
      const t = setTimeout(() => setPhase('intro'), 900)
      return () => clearTimeout(t)
    }
  }, [phase, setPhase])
  return (
    <div className={`fallback${view === 'epilogue' ? ' is-bright' : ''}`}>
      <div className="css-stars" aria-hidden="true" />
      {phase !== 'loading' && view === 'intro' && (
        <div className="flat-heart intro-heart" aria-hidden="true">
          ♥
        </div>
      )}
      <FlatWorld />
      <IntroOverlay />
      <AvatarSelect flat />
      <MemoriesOverlay flat />
      <LaneOverlay flat />
      <CapsuleOverlay flat />
      <ConstellationOverlay flat />
      <TimeMachineOverlay />
      <FutureOverlay flat />
      <CinematicOverlay flat />
      <EndingLetter />
      <SecretEnding flat />
      <LetterOverlay flat />
      <DistanceOverlay flat />
      <FinaleOverlay flat />
      <FlatHiddenHearts />
      <Hud flat />
      <Curtain />
      <LoadingScreen trackAssets={false} />
    </div>
  )
}
