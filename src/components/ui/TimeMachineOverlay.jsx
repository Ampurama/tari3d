import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { timeMachine } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

function Media({ src, alt }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (failed) return <div className="tm-media photo-fallback">♡</div>
  return /\.(mp4|webm|mov)$/i.test(src) ? (
    <video className="tm-media" src={src} autoPlay muted loop playsInline controls preload="metadata" onError={() => setFailed(true)} />
  ) : (
    <img className="tm-media" src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} draggable={false} />
  )
}

/** The "time travel" moment: streaks of light and the date spinning into place. */
function Warp({ label }) {
  return (
    <motion.div className="tm-warp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} aria-live="assertive">
      <div className="tm-warp-rings" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
      <motion.p className="tm-warp-text" initial={{ scale: 0.6, opacity: 0, filter: 'blur(10px)' }} animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}>
        <span>travelling to</span>
        {label}
      </motion.p>
    </motion.div>
  )
}

/** TIME MACHINE — choose a date, travel back, see that day. */
export default function TimeMachineOverlay() {
  const view = useStore((s) => s.view)
  const timeIndex = useStore((s) => s.timeIndex)
  const travelling = useStore((s) => s.timeTravelling)
  const visited = useStore((s) => s.timeVisited)
  const travelTo = useStore((s) => s.travelTo)
  const closeEntry = useStore((s) => s.closeTimeEntry)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [target, setTarget] = useState(null)
  const [photo, setPhoto] = useState(0)
  const entries = timeMachine.entries
  const open = view === 'timemachine'
  const entry = timeIndex !== null ? entries[timeIndex] : null

  useEffect(() => setPhoto(0), [timeIndex])

  const go = (i) => {
    setTarget(i)
    audio.sparkle()
    travelTo(i)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.section className="tm-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <AnimatePresence>{travelling && target !== null && <Warp key="warp" label={entries[target]?.label} />}</AnimatePresence>

          {!travelling && !entry && (
            <motion.div className="tm-dial" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.15 : 0.6, delay: reducedMotion ? 0 : 0.5 }}>
              <div className="section-heading">
                <h2>{timeMachine.title}</h2>
                <p>
                  {timeMachine.subtitle} · {visited.length}/{entries.length} visited
                </p>
              </div>
              <div className="tm-dates" role="list">
                {entries.map((e, i) => (
                  <button key={e.date} type="button" role="listitem" className={`tm-date${visited.includes(i) ? ' is-visited' : ''}`} onClick={() => go(i)}>
                    <span className="tm-date-label">{e.label}</span>
                    <span className="tm-date-title">{e.title}</span>
                    {visited.includes(i) && (
                      <span className="tm-date-check" aria-label="visited">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {!travelling && entry && (
            <motion.article
              key={timeIndex}
              className="tm-entry"
              initial={{ opacity: 0, scale: 0.94, filter: 'blur(12px) sepia(0.6)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px) sepia(0)' }}
              transition={{ duration: reducedMotion ? 0.2 : 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="tm-photo-area">
                {entry.photos.length ? (
                  <>
                    <Media src={entry.photos[photo]} alt={entry.title} />
                    {entry.photos.length > 1 && (
                      <div className="tm-photo-nav">
                        <button type="button" className="icon-btn" onClick={() => setPhoto((p) => (p - 1 + entry.photos.length) % entry.photos.length)} aria-label="Previous photo">
                          <ChevronLeft size={18} />
                        </button>
                        <span>
                          {photo + 1} / {entry.photos.length}
                        </span>
                        <button type="button" className="icon-btn" onClick={() => setPhoto((p) => (p + 1) % entry.photos.length)} aria-label="Next photo">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="tm-media photo-fallback">♡</div>
                )}
              </div>
              <div className="tm-text">
                <span className="memory-date">{entry.label}</span>
                <h3>{entry.title}</h3>
                {entry.narration && <p>{entry.narration}</p>}
                <div className="tm-actions">
                  {timeIndex > 0 && (
                    <button type="button" className="btn-ghost" onClick={() => go(timeIndex - 1)}>
                      ← Earlier
                    </button>
                  )}
                  {timeIndex < entries.length - 1 && (
                    <button type="button" className="btn-ghost" onClick={() => go(timeIndex + 1)}>
                      Later →
                    </button>
                  )}
                  <button type="button" className="btn-glow small" onClick={closeEntry}>
                    Choose another date
                  </button>
                </div>
              </div>
            </motion.article>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
