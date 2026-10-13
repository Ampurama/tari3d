import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { intro, music } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

const fadeUp = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1.6, ease: [0.22, 1, 0.36, 1] } },
}

/** "Hey, my favorite person..." — the opening scene's words and the button that starts the journey. */
export default function IntroOverlay({ onEnter }) {
  const phase = useStore((s) => s.phase)
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const enterWorld = useStore((s) => s.enterWorld)
  const [step, setStep] = useState(0)
  const [flash, setFlash] = useState(false)
  const visible = phase === 'intro' && view === 'intro'

  useEffect(() => {
    if (phase !== 'intro') return
    const times = reducedMotion ? [100, 300, 500] : [2800, 4900, 6900]
    const timers = times.map((t, i) => setTimeout(() => setStep(i + 1), t))
    return () => timers.forEach(clearTimeout)
  }, [phase, reducedMotion])

  const enter = () => {
    if (music.startOnEnter) audio.setMusic(true)
    setFlash(true)
    setTimeout(() => setFlash(false), 1600)
    if (onEnter) onEnter()
    else enterWorld()
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.section
            className="intro"
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)', transition: { duration: 0.9 } }}
            aria-live="polite"
          >
            <motion.p className="intro-line1" variants={fadeUp} initial="hidden" animate={step >= 1 ? 'show' : 'hidden'}>
              {intro.line1}
            </motion.p>
            <motion.h1 className="intro-line2" variants={fadeUp} initial="hidden" animate={step >= 2 ? 'show' : 'hidden'}>
              {intro.line2}
            </motion.h1>
            <motion.div variants={fadeUp} initial="hidden" animate={step >= 3 ? 'show' : 'hidden'} className="intro-cta">
              <button type="button" className="btn-glow" onClick={enter} disabled={step < 3} tabIndex={step < 3 ? -1 : 0}>
                {intro.button}
              </button>
              <small>♪ best with sound on</small>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flash && !reducedMotion && (
          <motion.div
            className="enter-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.75, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, times: [0, 0.25, 1], ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
