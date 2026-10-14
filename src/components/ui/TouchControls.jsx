import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Hand, X } from 'lucide-react'
import { isTouch } from '../../lib/device'
import { input } from '../../lib/player'
import { holdState } from '../../lib/interactions'
import { useStore } from '../../store'

/** On-screen joystick (touch devices). Pushing it all the way makes the avatar run. */
export function Joystick() {
  const base = useRef()
  const knob = useRef()
  const active = useRef(null)
  const R = 46

  const set = (x, y) => {
    input.joyX = x
    input.joyY = y
    if (knob.current) knob.current.style.transform = `translate(${x * R}px, ${-y * R}px)`
  }
  const move = (e) => {
    if (active.current !== e.pointerId) return
    const rect = base.current.getBoundingClientRect()
    let x = (e.clientX - (rect.left + rect.width / 2)) / R
    let y = -(e.clientY - (rect.top + rect.height / 2)) / R
    const l = Math.hypot(x, y)
    if (l > 1) {
      x /= l
      y /= l
    }
    set(x, y)
  }
  const end = (e) => {
    if (active.current !== e.pointerId) return
    active.current = null
    set(0, 0)
  }
  useEffect(() => () => set(0, 0), [])

  return (
    <div
      ref={base}
      className="joystick"
      role="application"
      aria-label="Move your character"
      onPointerDown={(e) => {
        active.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span ref={knob} className="joystick-knob" />
    </div>
  )
}

/** "E / ✦ <what you can do here>". Supports "hold to…" interactions with a filling ring. */
export function InteractButton() {
  const prompt = useStore((s) => s.prompt)
  const ring = useRef()

  // a hold never carries over to something else, or survives the button going away
  useEffect(() => {
    if (!prompt) input.interactHeld = false
  }, [prompt])
  useEffect(
    () => () => {
      input.interactHeld = false
    },
    [],
  )

  useEffect(() => {
    if (!prompt?.hold) return
    let raf
    const tick = () => {
      if (ring.current) {
        const p = holdState.id === prompt.id && holdState.need ? Math.min(1, holdState.t / holdState.need) : 0
        ring.current.style.strokeDasharray = `${p * 138} 138`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [prompt])

  const down = (e) => {
    e.preventDefault()
    input.interactPresses++
    input.interactHeld = true
  }
  const up = () => (input.interactHeld = false)

  return (
    <AnimatePresence>
      {prompt && (
        <motion.div className="interact" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.25 }}>
          <button
            type="button"
            className={`interact-btn${prompt.hold ? ' is-hold' : ''}`}
            onPointerDown={down}
            onPointerUp={up}
            onPointerLeave={up}
            onPointerCancel={up}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') down(e)
            }}
            onKeyUp={up}
            aria-label={prompt.label}
          >
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="22" />
              <circle ref={ring} cx="24" cy="24" r="22" className="interact-ring" />
            </svg>
            <Hand size={20} />
          </button>
          <span className="interact-label">
            {!isTouch && <kbd>E</kbd>}
            {prompt.hold ? `Hold · ${prompt.label}` : prompt.label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** A gentle card when something is discovered (a memory, a connection, a seed, a note). */
export function DiscoveryCard() {
  const discovery = useStore((s) => s.discovery)
  const close = useStore((s) => s.closeDiscovery)
  const [photoOk, setPhotoOk] = useState(true)
  useEffect(() => setPhotoOk(true), [discovery?.photo])
  return (
    <AnimatePresence>
      {discovery && (
        <motion.aside
          key={discovery.id}
          className={`discovery kind-${discovery.kind}`}
          role="status"
          initial={{ opacity: 0, y: -16, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {discovery.photo && photoOk && <img src={discovery.photo} alt="" onError={() => setPhotoOk(false)} />}
          <div>
            {discovery.count && <span className="discovery-count">{discovery.count}</span>}
            <strong>{discovery.title}</strong>
            <p>{discovery.text}</p>
          </div>
          <button type="button" className="icon-btn discovery-close" onClick={close} aria-label="Close">
            <X size={14} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
