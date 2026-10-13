import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { loveCapsule } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/** LOVE CAPSULE — pick the envelope that matches your mood; it opens into its own letter. */
export default function CapsuleOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const current = useStore((s) => s.capsuleLetter)
  const opened = useStore((s) => s.capsuleOpened)
  const openLetter = useStore((s) => s.openCapsuleLetter)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [paperUp, setPaperUp] = useState(false)
  const open = view === 'capsule'
  const letter = loveCapsule.letters.find((l) => l.id === current)

  // envelope opens first, then the letter slides out
  useEffect(() => {
    setPaperUp(false)
    if (!letter) return
    const t = setTimeout(() => setPaperUp(true), reducedMotion ? 0 : 900)
    return () => clearTimeout(t)
  }, [letter, reducedMotion])

  useEffect(() => {
    if (!letter) return
    const onKey = (e) => e.key === 'Escape' && openLetter(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [letter, openLetter])

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className={`capsule-ui${flat ? ' is-flat' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {!letter ? (
              <motion.div
                key="choices"
                className="capsule-choices"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reducedMotion ? 0.15 : 0.6, delay: flat || reducedMotion ? 0 : 0.5 }}
              >
                <div className="section-heading">
                  <h2>{loveCapsule.title}</h2>
                  <p>{loveCapsule.subtitle}</p>
                </div>
                <div className="capsule-grid">
                  {loveCapsule.letters.map((l, i) => (
                    <motion.button
                      key={l.id}
                      type="button"
                      className="mood-envelope"
                      style={{ '--mood': l.color }}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (flat || reducedMotion ? 0 : 0.6) + i * 0.08, duration: 0.5 }}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        audio.sparkle()
                        openLetter(l.id)
                      }}
                    >
                      <span className="mood-emoji" aria-hidden="true">
                        {l.emoji}
                      </span>
                      <span className="mood-label">{l.label}</span>
                      {opened.includes(l.id) && (
                        <span className="mood-opened" aria-label="already opened">
                          <Check size={13} />
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={letter.id}
                className="capsule-reading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className={`css-envelope${paperUp ? ' is-open' : ''}`} style={{ '--mood': letter.color }} aria-hidden="true">
                  <div className="css-envelope-back" />
                  <div className="css-envelope-flap" />
                  <div className="css-envelope-front">
                    <span>{letter.emoji}</span>
                  </div>
                </div>
                <AnimatePresence>
                  {paperUp && (
                    <motion.article
                      className="capsule-paper"
                      role="dialog"
                      aria-label={letter.title}
                      initial={{ y: 80, opacity: 0, scale: 0.92 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: 40, opacity: 0 }}
                      transition={{ duration: reducedMotion ? 0.2 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span className="capsule-tag" style={{ '--mood': letter.color }}>
                        {letter.emoji} {letter.label}
                      </span>
                      <h3>{letter.title}</h3>
                      <div className="capsule-body">
                        {letter.message.split(/\n\s*\n/).map((p, i) => (
                          <motion.p
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: reducedMotion ? 0 : 0.4 + i * 0.35, duration: 0.7 }}
                          >
                            {p}
                          </motion.p>
                        ))}
                      </div>
                      <button type="button" className="btn-glow small" onClick={() => openLetter(null)}>
                        Choose another envelope
                      </button>
                    </motion.article>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
