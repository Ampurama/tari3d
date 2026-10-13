import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { memoryLane } from '../../content/config'
import { useStore } from '../../store'

function LanePhoto({ src, alt }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) {
    // no photo for this milestone (or it's missing): a soft glow instead of a fake picture
    return (
      <div className="lane-photo is-empty" aria-hidden="true">
        <span>♡</span>
      </div>
    )
  }
  return (
    <div className="lane-photo">
      <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} draggable={false} />
    </div>
  )
}

/** MEMORY LANE card — date, title, story and photo, with a cinematic reveal for every lantern. */
export default function LaneOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const laneIndex = useStore((s) => s.laneIndex)
  const openLane = useStore((s) => s.openLane)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [shownIndex, setShownIndex] = useState(null)
  const [dir, setDir] = useState(1)
  const milestones = memoryLane.milestones
  const open = view === 'lane' && milestones.length > 0

  // let the camera glide to the lantern before the card blooms open
  useEffect(() => {
    if (!open) {
      setShownIndex(null)
      return
    }
    const t = setTimeout(() => setShownIndex(laneIndex), flat || reducedMotion ? 0 : 750)
    return () => clearTimeout(t)
  }, [open, laneIndex, flat, reducedMotion])

  const step = (delta) => {
    setDir(delta)
    openLane(laneIndex + delta)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const m = shownIndex !== null ? milestones[shownIndex] : null
  const ease = [0.22, 1, 0.36, 1]

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className={`lane-ui${flat ? ' is-flat' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
        >
          <div className="section-heading">
            <h2>{memoryLane.title}</h2>
            <p>{memoryLane.subtitle}</p>
          </div>

          <div className="lane-progress" aria-hidden="true">
            {milestones.map((_, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                className={`lane-dot${i === laneIndex ? ' is-current' : ''}${i < laneIndex ? ' is-past' : ''}`}
                onClick={() => {
                  setDir(i > laneIndex ? 1 : -1)
                  openLane(i)
                }}
              />
            ))}
          </div>

          <AnimatePresence mode="wait" custom={dir}>
            {m && (
              <motion.article
                key={shownIndex}
                className="lane-card"
                custom={dir}
                initial={{ opacity: 0, y: 40, x: dir * 30, scale: 0.94, filter: 'blur(12px)' }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: dir * -30, filter: 'blur(8px)', transition: { duration: 0.3 } }}
                transition={{ duration: reducedMotion ? 0.2 : 0.9, ease }}
                drag={milestones.length > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) step(1)
                  else if (info.offset.x > 60) step(-1)
                }}
              >
                <motion.div
                  className="lane-photo-wrap"
                  initial={{ scale: 1.12 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: reducedMotion ? 0.2 : 2.4, ease: 'easeOut' }}
                >
                  <LanePhoto src={m.photo} alt={m.title} />
                </motion.div>
                <div className="lane-text">
                  <motion.span className="memory-date" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}>
                    {m.date} · {shownIndex + 1}/{milestones.length}
                  </motion.span>
                  <motion.h3 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8 }}>
                    {m.title}
                  </motion.h3>
                  {m.story && (
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.9 }}>
                      {m.story}
                    </motion.p>
                  )}
                </div>
              </motion.article>
            )}
          </AnimatePresence>

          {milestones.length > 1 && (
            <div className="lane-nav">
              <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous memory on the lane">
                <ChevronLeft size={20} />
              </button>
              <button type="button" className="btn-ghost" onClick={() => step(1)}>
                {laneIndex === milestones.length - 1 ? 'Back to the beginning' : 'Walk to the next lantern'}
              </button>
              <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next memory on the lane">
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
