import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Pause, Play, X } from 'lucide-react'
import { connections, couple, redThread } from '../../content/config'
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

/* ───────── 2D versions of the five mechanics (no-WebGL) ───────── */

function FlatTrust({ onDone }) {
  const [p, setP] = useState(0)
  const held = useRef(false)
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = (now - last) / 1000
      last = now
      setP((v) => {
        const next = held.current ? Math.min(1, v + dt / 1.6) : Math.max(0, v - dt * 0.8)
        if (next >= 1 && v < 1) setTimeout(onDone, 0)
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])
  const set = (v) => () => (held.current = v)
  return (
    <button type="button" className="flat-mech hold" style={{ '--p': p }} onPointerDown={set(true)} onPointerUp={set(false)} onPointerLeave={set(false)}>
      🏮 Press and hold
    </button>
  )
}

function FlatCommunication({ onDone }) {
  const [stage, setStage] = useState('idle')
  const send = () => {
    setStage('sending')
    setTimeout(() => setStage('waiting'), 1600)
  }
  const answer = () => {
    setStage('answering')
    setTimeout(onDone, 1600)
  }
  return (
    <div className="flat-mech-row">
      <button type="button" className="flat-mech" disabled={stage !== 'idle'} onClick={send}>
        {couple.me.icon} Send a light
      </button>
      <span className={`flat-pulse ${stage}`} aria-hidden="true">
        ✦
      </span>
      <button type="button" className="flat-mech" disabled={stage !== 'waiting'} onClick={answer}>
        {couple.you.icon} Answer it
      </button>
    </div>
  )
}

function FlatPatience({ onDone }) {
  const [x, setX] = useState(0)
  useEffect(() => {
    let raf
    const tick = (now) => {
      setX(Math.sin(now / 1000 * 0.35 * 2) * 0.5 + 0.5)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const inGap = Math.abs(x - 0.5) < 0.08
  return (
    <button
      type="button"
      className={`flat-mech track${inGap ? ' in-gap' : ''}`}
      onClick={() => (inGap ? onDone() : useStore.getState().showToast('Patience… wait for the light to reach the gap ✦', 2400))}
    >
      <span className="track-gap" />
      <span className="track-dot" style={{ left: `${x * 100}%` }} />
    </button>
  )
}

const ORDER = [2, 0, 3, 1]
function FlatUnderstanding({ onDone }) {
  const [lit, setLit] = useState(-1)
  const [phase, setPhase] = useState('idle')
  const [entered, setEntered] = useState([])
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const show = () => {
    timers.current.forEach(clearTimeout)
    setEntered([])
    setPhase('showing')
    ORDER.forEach((s, k) => {
      timers.current.push(setTimeout(() => setLit(s), 500 + k * 800))
      timers.current.push(setTimeout(() => setLit(-1), 500 + k * 800 + 500))
    })
    timers.current.push(setTimeout(() => setPhase('input'), 500 + ORDER.length * 800))
  }
  const tap = (i) => {
    if (phase !== 'input') return
    const next = [...entered, i]
    if (ORDER[next.length - 1] !== i) {
      useStore.getState().showToast('Almost — watch once more ♡', 2200)
      setEntered([])
      timers.current.push(setTimeout(show, 700))
      return
    }
    setEntered(next)
    if (next.length === ORDER.length) onDone()
  }
  return (
    <div className="flat-mech-row">
      {[0, 1, 2, 3].map((i) => (
        <button key={i} type="button" className={`flat-star-btn${lit === i || entered.includes(i) ? ' is-lit' : ''}`} onClick={() => tap(i)} aria-label={`Star ${i + 1}`}>
          ✦
        </button>
      ))}
      <button type="button" className="btn-ghost" disabled={phase === 'showing'} onClick={show}>
        {phase === 'idle' ? 'Watch' : 'Watch again'}
      </button>
    </div>
  )
}

function FlatEffort({ onDone }) {
  const [n, setN] = useState(0)
  return (
    <button
      type="button"
      className="flat-mech hold"
      style={{ '--p': n / 10 }}
      onClick={() => {
        const next = n + 1
        setN(next)
        if (next >= 10) onDone()
      }}
    >
      ☸ Turn the wheel ({n}/10)
    </button>
  )
}

const FLAT = { trust: FlatTrust, communication: FlatCommunication, patience: FlatPatience, understanding: FlatUnderstanding, effort: FlatEffort }

/** Chapter 2 status + instructions, the island messages, and (2D) the mechanics themselves. */
export default function ConnectionsUI({ flat = false }) {
  const unlocked = useChapterUnlocked(1)
  const done = useStore((s) => s.connectionsDone)
  const message = useStore((s) => s.threadMessage)
  const close = useStore((s) => s.closeThreadMessage)
  const [open, setOpen] = useState(null)
  const m = message ? redThread.messages[message] : null
  const next = connections.find((c) => !done.includes(c.id))

  useEffect(() => {
    if (!m) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [m, close])

  if (!unlocked) return null
  const complete = (id) => () => {
    if (useStore.getState().completeConnection(id)) audio.sfx('complete')
    setOpen(null)
  }

  return (
    <>
      <div className="connections" role="list" aria-label="Connections">
        {connections.map((c) => {
          const isDone = done.includes(c.id)
          const Flat = FLAT[c.id]
          return (
            <div key={c.id} role="listitem" className={`connection${isDone ? ' is-done' : ''}${next?.id === c.id ? ' is-next' : ''}`}>
              <button type="button" className="connection-head" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                <span className="connection-dot">{isDone ? <Check size={12} /> : '✦'}</span>
                {c.title}
              </button>
              <AnimatePresence>
                {open === c.id && !isDone && (
                  <motion.div className="connection-how" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <p>{c.how}</p>
                    {flat && Flat && <Flat onDone={complete(c.id)} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      <p className="thread-prompt">
        {done.length >= connections.length ? 'The bridge is whole. Tap an island to open its message ♡' : next ? `Next: ${next.title} — ${next.how}` : ''}
      </p>
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
            {m.audio && <VoiceNote key={message} src={m.audio} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
