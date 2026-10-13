import { Component, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, BookHeart, Footprints, Heart, Hourglass, Images, Lock, Mail, Orbit, Sparkles, Star, Telescope } from 'lucide-react'
import { hints } from '../../content/config'
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
import { CutsceneOverlay, FinalRoomOverlay, ReactorOverlay } from './Ending'
import SecretEnding from './SecretEnding'
import { useChapterUnlocked, useChaptersDone } from '../../store'
import { CHAPTER_COUNT } from '../../lib/story'
import { loveCapsule, memoryLane, constellation } from '../../content/config'

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

function FlatWorld() {
  const view = useStore((s) => s.view)
  const goTo = useStore((s) => s.goTo)
  const startFinale = useStore((s) => s.startFinale)
  const letterRead = useStore((s) => s.letterRead)
  const openLane = useStore((s) => s.openLane)
  const openFuture = useStore((s) => s.openFuture)
  const setPanel = useStore((s) => s.setPanel)
  const timeUnlocked = useChapterUnlocked(1)
  const futureUnlocked = useChapterUnlocked(4)
  const done = useChaptersDone()
  const cards = [
    { key: 'story', icon: BookHeart, title: 'Story', text: `${done}/${CHAPTER_COUNT} chapters complete` },
    { key: 'memories', icon: Images, title: 'Our memories', text: 'Little moments I keep close.' },
    { key: 'lane', icon: Footprints, title: memoryLane.title, text: memoryLane.subtitle },
    { key: 'letter', icon: Mail, title: 'A letter for you', text: 'Words I wanted you to have.' },
    { key: 'capsule', icon: Archive, title: loveCapsule.title, text: loveCapsule.subtitle },
    { key: 'distance', icon: Telescope, title: 'Same sky', text: 'Two places, one heart.' },
    { key: 'constellation', icon: Star, title: constellation.title, text: constellation.subtitle },
    { key: 'timemachine', icon: timeUnlocked ? Hourglass : Lock, title: 'Time Machine', text: timeUnlocked ? 'Travel back to our dates.' : 'Wakes up in Chapter Two.', locked: !timeUnlocked },
    { key: 'future', icon: futureUnlocked ? Orbit : Lock, title: 'Future Simulator', text: futureUnlocked ? 'Worlds we will visit.' : 'Opens in Chapter Five.', locked: !futureUnlocked },
    { key: 'reactor', icon: Heart, title: 'Heart Reactor', text: `${done}/${CHAPTER_COUNT} energy` },
    {
      key: 'finale',
      icon: letterRead ? Sparkles : Lock,
      title: letterRead ? 'One last thing…' : 'Still sleeping',
      text: letterRead ? 'Come closer.' : hints.secretLocked,
    },
  ]
  return (
    <AnimatePresence>
      {view === 'explore' && (
        <motion.div className="flat-world" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <h1>Our Little Universe</h1>
          <p className="flat-note">A world made just for us ♡</p>
          <div className="flat-cards">
            {cards.map(({ key, icon: Icon, title, text, locked }) => (
              <button
                key={key}
                type="button"
                className={`flat-card${(key === 'finale' && !letterRead) || locked ? ' is-locked' : ''}`}
                onClick={() => {
                  if (locked) return useStore.getState().showToast('Still asleep — keep following the story ♡')
                  if (key === 'finale') return startFinale()
                  if (key === 'lane') return openLane()
                  if (key === 'future') return openFuture(0)
                  if (key === 'story') return setPanel('story')
                  goTo(key)
                }}
              >
                <Icon size={22} strokeWidth={1.6} />
                <strong>{title}</strong>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Full 2D version of the experience for browsers/devices without WebGL.
 * Same content, same order, just drawn with CSS instead of 3D.
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
    <div className="fallback">
      <div className="css-stars" aria-hidden="true" />
      {phase !== 'loading' && view === 'intro' && (
        <div className="flat-heart intro-heart" aria-hidden="true">
          ♥
        </div>
      )}
      <FlatWorld />
      <IntroOverlay />
      <MemoriesOverlay flat />
      <LaneOverlay flat />
      <CapsuleOverlay flat />
      <ConstellationOverlay flat />
      <TimeMachineOverlay />
      <FutureOverlay flat />
      <ReactorOverlay flat />
      <CutsceneOverlay flat />
      <FinalRoomOverlay flat />
      <SecretEnding flat />
      <LetterOverlay flat />
      <DistanceOverlay flat />
      <FinaleOverlay flat />
      <FlatHiddenHearts />
      <Hud />
      <Curtain />
      <LoadingScreen trackAssets={false} />
    </div>
  )
}
