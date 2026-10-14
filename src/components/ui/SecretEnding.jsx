import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Captions, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { secretEnding } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

const ease = [0.22, 1, 0.36, 1]
const fade = (delay = 0, duration = 1.4) => ({
  initial: { opacity: 0, y: 10, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay, duration, ease },
})

/** Hook: true once `ms` have passed (immediately with reduced motion). Resets when `key` changes. */
function useAfter(ms, key) {
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDone(false)
    const t = setTimeout(() => setDone(true), reducedMotion ? 0 : ms)
    return () => clearTimeout(t)
  }, [ms, key, reducedMotion])
  return done
}

/* ───────── 1. found ───────── */

function Found() {
  const setStage = useStore((s) => s.setSecretStage)
  const showButton = useAfter(3400, 'found')
  return (
    <motion.div className="secret-center" key="found" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="secret-glass">
        <motion.p className="secret-line" {...fade(0.4)}>
          {secretEnding.found.line1}
        </motion.p>
        <motion.p className="secret-line soft" {...fade(2, 1.6)}>
          {secretEnding.found.line2}
        </motion.p>
        <AnimatePresence>
          {showButton && (
            <motion.div className="secret-actions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
              <button type="button" className="btn-glow" onClick={() => setStage('transition')}>
                {secretEnding.found.button}
              </button>
              <button type="button" className="btn-ghost" onClick={() => useStore.getState().stayInUniverse()}>
                Not now
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ───────── 2. transition ───────── */

function Transition() {
  const setStage = useStore((s) => s.setSecretStage)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const lines = secretEnding.transition.lines || []
  const [shown, setShown] = useState(reducedMotion ? lines.length : 0)
  // one line at a time, with room to breathe; then the letter
  useEffect(() => {
    if (shown >= lines.length) {
      const t = setTimeout(() => useStore.getState().setSecretStage('letter'), reducedMotion ? 2000 : 5200)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 1400 : 3600)
    return () => clearTimeout(t)
  }, [shown, lines.length, reducedMotion])
  return (
    <motion.div className="secret-center veil" key="transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.2 } }}>
      <div className="secret-lines">
        {lines.slice(0, shown).map((line, i) => (
          <motion.p
            key={i}
            className={`secret-quote${i === lines.length - 1 ? ' big' : ''}`}
            initial={{ opacity: 0, y: 8, filter: 'blur(8px)' }}
            animate={{ opacity: i < shown - 2 ? 0.45 : 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 2, ease }}
          >
            {line}
          </motion.p>
        ))}
      </div>
      <button type="button" className="btn-ghost secret-skip" onClick={() => setStage('letter')}>
        {secretEnding.skip}
      </button>
    </motion.div>
  )
}

/* ───────── 3. the letter ───────── */

function Letter() {
  const setStage = useStore((s) => s.setSecretStage)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const paragraphs = useMemo(() => secretEnding.letter.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/), [])
  const [shown, setShown] = useState(reducedMotion ? paragraphs.length : 1)
  const body = useRef()
  const all = shown >= paragraphs.length

  // one paragraph at a time, slow enough to actually read
  useEffect(() => {
    if (all) return
    const words = paragraphs[shown - 1]?.split(/\s+/).length || 10
    const t = setTimeout(() => setShown((n) => n + 1), Math.min(6500, 1600 + words * 190))
    return () => clearTimeout(t)
  }, [shown, all, paragraphs])

  useEffect(() => {
    const el = body.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [shown, reducedMotion])

  return (
    <motion.div className="secret-center" key="letter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.article
        className="secret-letter"
        initial={{ y: 60, opacity: 0, rotateX: 14 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ duration: reducedMotion ? 0.2 : 1.6, ease }}
        aria-label="A letter"
      >
        <div className="secret-letter-body" ref={body}>
          {paragraphs.slice(0, shown).map((p, i) => (
            <motion.p key={i} className={i === 0 ? 'salutation' : ''} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.1 : 1.4 }}>
              {p}
            </motion.p>
          ))}
        </div>
        <footer>
          {!all ? (
            <button type="button" className="btn-ghost" onClick={() => setShown(paragraphs.length)}>
              {secretEnding.readAll}
            </button>
          ) : (
            <motion.button type="button" className="btn-glow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : 1.2, duration: 1 }} onClick={() => setStage('voice')}>
              {secretEnding.voice.button}
            </motion.button>
          )}
        </footer>
      </motion.article>
    </motion.div>
  )
}

/* ───────── 4. a real message from me ───────── */

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/** Minimal heart-shaped player for his own recording. Never autoplays. */
export function HeartPlayer({ src, subtitles = [], onEnded }) {
  const el = useRef()
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [captions, setCaptions] = useState(subtitles.length > 0)
  const [failed, setFailed] = useState(false)
  const [ended, setEnded] = useState(false)

  useEffect(
    () => () => {
      el.current?.pause()
      audio.duck(false)
    },
    [],
  )

  if (failed) return <p className="secret-placeholder">The recording couldn’t be played on this device. ♡</p>

  const toggle = () => {
    const a = el.current
    if (!a) return
    if (a.paused) a.play().catch(() => setFailed(true))
    else a.pause()
  }
  const cue = captions ? subtitles.find((c) => time >= c.start && time < c.end) : null
  const progress = duration ? time / duration : 0

  return (
    <div className="heart-player">
      <audio
        ref={el}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true)
          setEnded(false)
          audio.duck(true)
        }}
        onPause={() => {
          setPlaying(false)
          audio.duck(false)
        }}
        onEnded={() => {
          setPlaying(false)
          setEnded(true)
          audio.duck(false)
          onEnded?.()
        }}
        onError={() => setFailed(true)}
      />
      <button type="button" className={`heart-play${playing ? ' is-playing' : ''}`} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        <svg viewBox="0 0 100 92" aria-hidden="true">
          <defs>
            <linearGradient id="heart-player-fill" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#ff8fc4" />
              <stop offset="1" stopColor="#c9a8ff" />
            </linearGradient>
            <clipPath id="heart-player-clip">
              <path d="M50 88 C20 66 4 50 4 28 C4 13 15 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C85 4 96 13 96 28 C96 50 80 66 50 88 Z" />
            </clipPath>
          </defs>
          <path d="M50 88 C20 66 4 50 4 28 C4 13 15 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C85 4 96 13 96 28 C96 50 80 66 50 88 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,214,234,0.7)" strokeWidth="2" />
          {/* the heart fills up as the recording plays */}
          <g clipPath="url(#heart-player-clip)">
            <rect x="0" y={92 - 92 * progress} width="100" height="92" fill="url(#heart-player-fill)" opacity="0.85" />
          </g>
        </svg>
        <span className="heart-play-icon">{playing ? <Pause size={26} /> : <Play size={26} />}</span>
      </button>

      <div className="heart-progress">
        <span>{fmt(time)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(time, duration || 0)}
          onChange={(e) => {
            if (el.current) el.current.currentTime = Number(e.target.value)
          }}
          aria-label="Seek"
          disabled={!duration}
        />
        <span>{fmt(duration)}</span>
      </div>

      <div className="heart-controls">
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            const a = el.current
            if (!a) return
            a.currentTime = 0
            a.play().catch(() => setFailed(true))
          }}
          aria-label="Replay from the start"
          title="Replay"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            const m = !muted
            setMuted(m)
            if (el.current) el.current.muted = m
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          className="heart-volume"
          min="0"
          max="1"
          step="0.05"
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVolume(v)
            setMuted(v === 0)
            if (el.current) {
              el.current.volume = v
              el.current.muted = v === 0
            }
          }}
          aria-label="Volume"
        />
        {subtitles.length > 0 && (
          <button type="button" className={`icon-btn${captions ? ' is-on' : ''}`} onClick={() => setCaptions((c) => !c)} aria-pressed={captions} aria-label="Subtitles">
            <Captions size={16} />
          </button>
        )}
      </div>

      <p className="heart-caption" aria-live="polite">
        {cue?.text || (ended ? '♡' : ' ')}
      </p>
    </div>
  )
}

function Voice() {
  const setStage = useStore((s) => s.setSecretStage)
  const { voice } = secretEnding
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <motion.div className="secret-center" key="voice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="secret-glass voice" {...fade(0.2, 1.2)}>
        <p className="secret-line soft">{voice.button}</p>
        {voice.src ? (
          <HeartPlayer
            src={voice.src}
            subtitles={Array.isArray(voice.subtitles) ? voice.subtitles : []}
            onEnded={() => {
              // when the recording finishes, gently move on
              timer.current = setTimeout(() => useStore.getState().setSecretStage('photo'), 2500)
            }}
          />
        ) : (
          <div className="secret-placeholder" role="note">
            <span aria-hidden="true">♡</span>
            {voice.placeholder}
          </div>
        )}
        <button type="button" className="btn-ghost" onClick={() => setStage('photo')}>
          {voice.continue}
        </button>
      </motion.div>
    </motion.div>
  )
}

/* ───────── 5. one last memory ───────── */

function Photo() {
  const openEpilogue = useStore((s) => s.openEpilogue)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [failed, setFailed] = useState(false)
  const { photo } = secretEnding
  return (
    <motion.div className="secret-center" key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.figure
        className="secret-photo"
        initial={{ opacity: 0, scale: 0.9, filter: 'blur(14px) brightness(1.6)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)' }}
        transition={{ duration: reducedMotion ? 0.2 : 3, ease }}
      >
        {photo.src && !failed ? (
          <img src={photo.src} alt="Us" onError={() => setFailed(true)} draggable={false} />
        ) : (
          <div className="secret-photo-empty" aria-hidden="true">
            ♡
          </div>
        )}
        <motion.figcaption {...fade(reducedMotion ? 0 : 2.6, 1.6)}>{photo.caption}</motion.figcaption>
      </motion.figure>
      <motion.button type="button" className="btn-glow" {...fade(reducedMotion ? 0 : 4.5, 1)} onClick={openEpilogue}>
        {photo.continue}
      </motion.button>
    </motion.div>
  )
}

/* ───────── 6. the final moment ───────── */

function Epilogue() {
  const stay = useStore((s) => s.stayInUniverse)
  const replay = useStore((s) => s.replaySecret)
  const second = useAfter(6500, 'epilogue')
  const button = useAfter(9500, 'epilogue-btn')
  return (
    <motion.div className="secret-epilogue" key="epilogue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.p className="secret-quote big" {...fade(2.4, 2.4)}>
        {secretEnding.final.line1}
      </motion.p>
      <AnimatePresence>
        {second && (
          <motion.p className="secret-quote" {...fade(0, 2)}>
            {secretEnding.final.line2}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {button && (
          <motion.div className="secret-actions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
            <button type="button" className="btn-glow" onClick={stay}>
              {secretEnding.final.stay}
            </button>
            <button type="button" className="btn-ghost" onClick={replay}>
              {secretEnding.replay}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * SECRET ENDING — "The one thing I could never code ♡".
 * Plays inside the existing Secret Room (and then over the existing island), stage by stage.
 */
export default function SecretEnding({ flat = false }) {
  const view = useStore((s) => s.view)
  const stage = useStore((s) => s.secretStage)
  const active = view === 'finalRoom' && Boolean(stage)

  // music: slowly softer during the secret, back to normal for the final moment / afterwards
  useEffect(() => {
    if (active && stage !== 'found') audio.soften(true, 6)
    else if (view === 'epilogue') audio.soften(false, 8)
    else if (!active) audio.soften(false, 3)
  }, [active, stage, view])

  return (
    <div className={`secret-ui${flat ? ' is-flat' : ''}${active || view === 'epilogue' ? ' is-active' : ''}`}>
      <AnimatePresence mode="popLayout">
        {active && stage === 'found' && <Found key="found" />}
        {active && stage === 'transition' && <Transition key="transition" />}
        {active && stage === 'letter' && <Letter key="letter" />}
        {active && stage === 'voice' && <Voice key="voice" />}
        {active && stage === 'photo' && <Photo key="photo" />}
        {view === 'epilogue' && <Epilogue key="epilogue" />}
      </AnimatePresence>
    </div>
  )
}
