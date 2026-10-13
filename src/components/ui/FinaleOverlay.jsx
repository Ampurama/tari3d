import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { finale } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import Confetti from './Confetti'

/** Optional photo/video from config, only mounted once she has answered (so nothing heavy loads early). */
function FinaleMedia() {
  const [failed, setFailed] = useState(false)
  const media = finale.media
  if (!media?.src || failed) return null
  return (
    <motion.div className="finale-media" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, duration: 1 }}>
      {media.type === 'video' ? (
        <video src={media.src} autoPlay muted loop playsInline controls onError={() => setFailed(true)} />
      ) : (
        <img src={media.src} alt="" onError={() => setFailed(true)} />
      )}
    </motion.div>
  )
}

const soft = (delay = 0) => ({
  initial: { opacity: 0, y: 14, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, filter: 'blur(6px)' },
  transition: { duration: 1.5, delay, ease: [0.22, 1, 0.36, 1] },
})

/** "Will you keep making beautiful memories with me?" — two buttons, both of them yes. */
export default function FinaleOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const leaveFinale = useStore((s) => s.leaveFinale)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState(null)
  const [burst, setBurst] = useState(0)
  const open = view === 'finale'

  useEffect(() => {
    if (!open) {
      setStep(0)
      setAnswer(null)
      return
    }
    const times = reducedMotion ? [200, 600, 1000] : flat ? [800, 2600, 4200] : [4600, 7600, 9600]
    const timers = times.map((t, i) => setTimeout(() => setStep(i + 1), t))
    return () => timers.forEach(clearTimeout)
  }, [open, reducedMotion, flat])

  const choose = (i) => {
    setAnswer(i)
    setBurst((b) => b + 1)
    window.dispatchEvent(new Event('universe:burst'))
    audio.sparkle()
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section className={`finale-ui${flat ? ' is-flat' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.8 } }}>
            {flat && (
              <div className="flat-heart" aria-hidden="true">
                ♥
              </div>
            )}
            <div className="finale-top">
              <AnimatePresence>
                {step >= 1 && (
                  <motion.p className="finale-message" {...soft()}>
                    {finale.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="finale-bottom">
              <AnimatePresence mode="wait">
                {answer === null ? (
                  step >= 2 && (
                    <motion.div key="question" className="finale-question" {...soft()}>
                      <h2>{finale.question}</h2>
                      {step >= 3 && (
                        <motion.div className="finale-buttons" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
                          {finale.answers.map((a, i) => (
                            <button key={i} type="button" className={`btn-glow${i ? ' alt' : ''}`} onClick={() => choose(i)}>
                              {a.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  )
                ) : (
                  <motion.div key={`answer-${answer}`} className="finale-answer" {...soft()} transition={{ duration: 1.1 }}>
                    <motion.span
                      className="answer-heart"
                      aria-hidden="true"
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.35, 1] }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                    >
                      {answer === 0 ? '♡' : '💗'}
                    </motion.span>
                    <h2>{finale.answers[answer].title}</h2>
                    <p>{finale.answers[answer].reply}</p>
                    <FinaleMedia />
                    <motion.p className="finale-closing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 1.4 }}>
                      {finale.closing}
                    </motion.p>
                    <motion.div className="finale-buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3, duration: 1 }}>
                      <button type="button" className="btn-ghost" onClick={() => choose(answer === 0 ? 1 : 0)}>
                        {answer === 0 ? 'And also… 💗' : 'And also… ♡'}
                      </button>
                      <button type="button" className="btn-glow small" onClick={leaveFinale}>
                        Back to our world
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <Confetti burstKey={burst} />
    </>
  )
}

/** Slow fade to dark used when travelling to and from the finale. */
export function Curtain() {
  const curtain = useStore((s) => s.curtain)
  const reducedMotion = useStore((s) => s.reducedMotion)
  return (
    <motion.div
      className="curtain"
      aria-hidden="true"
      initial={false}
      animate={{ opacity: curtain ? 1 : 0 }}
      transition={{ duration: reducedMotion ? 0.2 : curtain ? 1.7 : 2.2, ease: 'easeInOut' }}
      style={{ pointerEvents: curtain ? 'auto' : 'none' }}
    />
  )
}
