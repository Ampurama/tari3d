import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, X } from 'lucide-react'
import { couple, redThread } from '../../content/config'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'

/** Play button for a voice note. Only rendered when a real audio file is configured. */
function VoiceNote({ src }) {
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => () => audio.stopVoice(), [])
  if (failed) return <p className="voice-missing">The voice note couldn’t be played on this device.</p>
  return (
    <button
      type="button"
      className="btn-glow small voice-btn"
      onClick={() => {
        if (playing) {
          audio.stopVoice()
          setPlaying(false)
          return
        }
        const el = audio.playVoice(src, () => setPlaying(false))
        if (!el) return setFailed(true)
        el.addEventListener('error', () => setFailed(true), { once: true })
        setPlaying(true)
      }}
      aria-pressed={playing}
    >
      {playing ? <Pause size={15} /> : <Play size={15} />}
      {playing ? 'Pause voice note' : 'Play voice note'}
    </button>
  )
}

/** 2D islands for the no-WebGL version: tap each to tie the thread. */
function FlatThread() {
  const tied = useStore((s) => s.threadTied)
  const connected = useStore((s) => s.threadConnected)
  const tieThread = useStore((s) => s.tieThread)
  return (
    <div className="flat-thread">
      {['me', 'you'].map((side) => (
        <button key={side} type="button" className={`flat-island${tied[side] ? ' is-tied' : ''}`} onClick={() => tieThread(side)}>
          <span aria-hidden="true">{couple[side].icon}</span>
          <strong>{couple[side].name}</strong>
          <small>{connected ? 'open message' : tied[side] ? 'tied ✓' : 'tap to tie'}</small>
        </button>
      ))}
      <svg className={`flat-thread-line${connected ? ' is-on' : ''}`} viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 10 Q 50 22 98 10" />
      </svg>
    </div>
  )
}

/** Prompt + the message card for the RED THREAD scene (lives inside the Same sky overlay). */
export default function RedThreadUI({ flat = false }) {
  const unlocked = useChapterUnlocked(2)
  const connected = useStore((s) => s.threadConnected)
  const message = useStore((s) => s.threadMessage)
  const read = useStore((s) => s.threadRead)
  const close = useStore((s) => s.closeThreadMessage)
  const m = message ? redThread.messages[message] : null

  useEffect(() => {
    if (!m) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [m, close])

  return (
    <>
      {flat && unlocked && <FlatThread />}
      {unlocked && (
        <motion.p className={`thread-prompt${connected ? ' is-connected' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          {connected ? `${redThread.connected} · ${read.length}/2 messages` : redThread.prompt}
        </motion.p>
      )}
      <AnimatePresence>
        {m && (
          <motion.div
            className="thread-message"
            role="dialog"
            aria-label={m.title}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <button type="button" className="icon-btn panel-close" onClick={close} aria-label="Close message">
              <X size={16} />
            </button>
            <span className="eyebrow">{message === 'me' ? couple.me.place : couple.you.place}</span>
            <h3>{m.title}</h3>
            <p>{m.text}</p>
            {m.audio && <VoiceNote src={m.audio} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
