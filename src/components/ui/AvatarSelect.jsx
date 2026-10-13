import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { avatarSelect, avatars, music } from '../../content/config'
import { currentAvatar, useStore } from '../../store'
import { audio } from '../../audio/engine'
import { previewSpin } from '../three/AvatarStage'

/**
 * Character selection — after the intro, before the island.
 * Switch with the arrows (or swipe), drag the stage to turn the little soul around, confirm to enter.
 */
export default function AvatarSelect({ flat = false }) {
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  const avatar = useStore(currentAvatar)
  const choose = useStore((s) => s.chooseAvatar)
  const enterWorld = useStore((s) => s.enterWorld)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [confirmed, setConfirmed] = useState(false)
  const drag = useRef(null)
  const open = view === 'avatar'
  const index = avatars.findIndex((a) => a.id === avatar.id)

  useEffect(() => {
    if (open) setConfirmed(false)
  }, [open])

  const step = (d) => {
    const next = avatars[(index + d + avatars.length) % avatars.length]
    choose(next.id)
    audio.sfx('pickup')
  }

  const confirm = () => {
    if (confirmed) return
    choose(avatar.id)
    setConfirmed(true)
    // this tap is the user gesture that's allowed to start the music (unless she turned it off before)
    if (phase !== 'world' && music.startOnEnter && audio.musicWanted) audio.setMusic(true)
    audio.setMood('little')
    setTimeout(() => enterWorld(), reducedMotion ? 400 : 2600)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (confirmed) return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.section className={`avatar-ui${flat ? ' is-flat' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.8 } }}>
          <AnimatePresence mode="wait">
            {!confirmed ? (
              <motion.div key="choose" className="avatar-top" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, delay: 0.4 }}>
                <h1>{avatarSelect.heading}</h1>
                <p>{avatarSelect.subheading}</p>
              </motion.div>
            ) : (
              <motion.p key="go" className="avatar-confirmed" initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.2 }}>
                {avatarSelect.confirmed}
              </motion.p>
            )}
          </AnimatePresence>

          {/* the stage itself is 3D; this transparent layer turns it by dragging */}
          {!confirmed && (
            <div
              className="avatar-drag"
              aria-hidden="true"
              onPointerDown={(e) => {
                drag.current = { x: e.clientX, t: performance.now() }
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (!drag.current) return
                const dx = e.clientX - drag.current.x
                drag.current.x = e.clientX
                previewSpin.y += dx * 0.012
                previewSpin.velocity = dx * 0.6
              }}
              onPointerUp={(e) => {
                // a quick horizontal swipe switches character
                drag.current = null
                e.currentTarget.releasePointerCapture?.(e.pointerId)
              }}
            >
              {flat && (
                <div className="flat-avatar" style={{ '--a': avatar.look.top, '--b': avatar.look.bottom, '--h': avatar.look.hair }}>
                  <span className="flat-avatar-head" />
                  <span className="flat-avatar-body" />
                </div>
              )}
            </div>
          )}

          {!confirmed && (
            <motion.div className="avatar-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }}>
              <div className="avatar-switch">
                <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous character">
                  <ChevronLeft size={22} />
                </button>
                <AnimatePresence mode="popLayout">
                  <motion.div key={avatar.id} className="avatar-name" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
                    <strong>{avatar.name}</strong>
                    <span>{avatar.label}</span>
                  </motion.div>
                </AnimatePresence>
                <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next character">
                  <ChevronRight size={22} />
                </button>
              </div>
              <div className="avatar-dots" aria-hidden="true">
                {avatars.map((a) => (
                  <span key={a.id} className={a.id === avatar.id ? 'is-on' : ''} />
                ))}
              </div>
              {!flat && <small className="avatar-hint">{avatarSelect.rotateHint}</small>}
              <button type="button" className="btn-glow" onClick={confirm}>
                {avatarSelect.button}
              </button>
            </motion.div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
