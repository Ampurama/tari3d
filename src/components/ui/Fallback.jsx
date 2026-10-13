import { Component, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Images, Lock, Mail, Sparkles, Telescope } from 'lucide-react'
import { hints } from '../../content/config'
import { useStore } from '../../store'
import IntroOverlay from './IntroOverlay'
import Hud from './Hud'
import MemoriesOverlay from './MemoriesOverlay'
import LetterOverlay from './LetterOverlay'
import DistanceOverlay from './DistanceOverlay'
import FinaleOverlay, { Curtain } from './FinaleOverlay'
import LoadingScreen from './LoadingScreen'

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
  const cards = [
    { key: 'memories', icon: Images, title: 'Our memories', text: 'Little moments I keep close.' },
    { key: 'letter', icon: Mail, title: 'A letter for you', text: 'Words I wanted you to have.' },
    { key: 'distance', icon: Telescope, title: 'Same sky', text: 'Two places, one heart.' },
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
            {cards.map(({ key, icon: Icon, title, text }) => (
              <button
                key={key}
                type="button"
                className={`flat-card${key === 'finale' && !letterRead ? ' is-locked' : ''}`}
                onClick={() => (key === 'finale' ? startFinale() : goTo(key))}
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
      <LetterOverlay flat />
      <DistanceOverlay flat />
      <FinaleOverlay flat />
      <Hud />
      <Curtain />
      <LoadingScreen trackAssets={false} />
    </div>
  )
}
