import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Images, Mail, RotateCcw, SkipForward, X } from 'lucide-react'
import { finalCinematic, finalMessage, loveLetter } from '../../content/config'
import { CINE, CINE_LENGTH } from '../../lib/cinematic'
import { withNames } from '../../lib/story'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { HeartPlayer } from './SecretEnding'

/**
 * FINAL CINEMATIC overlay — cinematic bars, two quiet captions, the title, and then the final
 * message one line at a time. It can be skipped straight to the message; at the end she chooses:
 * replay it, revisit the memories, read the letter again, or stay in the little world.
 */
export function CinematicOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const run = useStore((s) => s.cineRun)
  const finish = useStore((s) => s.finishCinematic)
  const [t, setT] = useState(0)
  const start = useRef(0)
  const open = view === 'cinematic'
  const lines = useMemo(() => finalMessage.lines.filter(Boolean).map(withNames), [])

  useEffect(() => {
    if (!open) {
      setT(0)
      return
    }
    start.current = performance.now()
    setT(0)
    const id = setInterval(() => setT((performance.now() - start.current) / 1000), 100)
    return () => clearInterval(id)
  }, [open, run])

  // the 2D version has no 3D camera to mark the ending as seen
  useEffect(() => {
    if (open && t >= CINE_LENGTH) useStore.getState().markEndingSeen()
  }, [open, t])

  const skip = () => {
    start.current = performance.now() - CINE.message * 1000
    setT(CINE.message)
  }
  const caption = t >= CINE.captions[0] && t < CINE.captions[0] + 6 ? finalCinematic.captions[0] : t >= CINE.captions[1] && t < CINE.captions[1] + 5 ? finalCinematic.captions[1] : null
  const titleOn = t >= CINE.title && t < CINE.message - 0.5
  const shown = t >= CINE.message ? Math.min(lines.length, Math.floor((t - CINE.message) / CINE.line) + 1) : 0
  const choices = t >= CINE_LENGTH + 0.6
  const scene = t < CINE.lanterns[0] ? 0 : t < CINE.message ? 1 : 2

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={`cutscene-ui${flat ? ' is-flat' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.8 } }}>
          {flat && <div className={`flat-cine scene-${scene}`} aria-hidden="true" />}
          <motion.div className="letterbox top" initial={{ scaleY: 0 }} animate={{ scaleY: shown ? 0.6 : 1 }} transition={{ duration: 1.2 }} />
          <motion.div className="letterbox bottom" initial={{ scaleY: 0 }} animate={{ scaleY: shown ? 0.6 : 1 }} transition={{ duration: 1.2 }} />
          <div className="cutscene-caption" aria-live="polite">
            <AnimatePresence mode="popLayout">
              {caption && !shown && (
                <motion.p key={caption} initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 1.2 }}>
                  {caption}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {titleOn && (
              <motion.h1 className="cine-title" initial={{ opacity: 0, letterSpacing: '0.5em', filter: 'blur(10px)' }} animate={{ opacity: 1, letterSpacing: '0.16em', filter: 'blur(0px)' }} exit={{ opacity: 0, transition: { duration: 1.2 } }} transition={{ duration: 3, ease: [0.22, 1, 0.36, 1] }}>
                {withNames(finalCinematic.title)}
              </motion.h1>
            )}
          </AnimatePresence>
          {shown > 0 && (
            <div className="final-message" aria-live="polite">
              {lines.slice(0, shown).map((line, i) => (
                <motion.p key={i} className={i === lines.length - 2 ? 'is-name' : ''} initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.6 }}>
                  {line}
                </motion.p>
              ))}
              <AnimatePresence>
                {choices && (
                  <motion.div className="final-choices" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
                    <button type="button" className="btn-glow" onClick={() => finish('explore')}>
                      {finalMessage.stay}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => finish('memories')}>
                      <Images size={15} /> {finalMessage.memories}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => finish('ending')}>
                      <Mail size={15} /> {finalMessage.letter}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        audio.sparkle()
                        useStore.getState().replayCinematic()
                      }}
                    >
                      <RotateCcw size={15} /> {finalMessage.replay}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {t > 2 && t < CINE.message && (
            <button type="button" className="btn-ghost cutscene-skip" onClick={skip}>
              <SkipForward size={15} /> {finalCinematic.skip}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * THE LOVE LETTER — from the envelope beneath the Love Tree (Chapter 5); the finale follows it. It can be closed (and opened again), the photo can be
 * looked at properly, the voice note plays only when she presses play, and she can always go back
 * into the world or replay the ending.
 */
export function EndingLetter() {
  const view = useStore((s) => s.view)
  const back = useStore((s) => s.back)
  const startCinematic = useStore((s) => s.startCinematic)
  const ended = useStore((s) => s.mainEndingSeen)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [folded, setFolded] = useState(false)
  const [shown, setShown] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [photoOk, setPhotoOk] = useState(true)
  const open = view === 'ending'
  // Escape closes the enlarged photo
  useEffect(() => {
    if (!zoom) return
    const onKey = (e) => e.key === 'Escape' && setZoom(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])
  const paragraphs = useMemo(
    () => [loveLetter.opening, ...loveLetter.body, ...(loveLetter.personalNote ? [loveLetter.personalNote] : []), ...loveLetter.ending].filter(Boolean).map(withNames),
    [],
  )
  const all = shown >= paragraphs.length

  useEffect(() => {
    if (!open) return
    setFolded(false)
    setZoom(false)
    setShown(reducedMotion ? paragraphs.length : 0)
  }, [open, reducedMotion, paragraphs.length])

  useEffect(() => {
    if (!open || folded || all) return
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 1600 : 2300)
    return () => clearTimeout(t)
  }, [open, folded, shown, all])

  return (
    <AnimatePresence>
      {open && (
        <motion.section className="ending-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
          <AnimatePresence mode="wait">
            {!folded ? (
              <motion.article
                key="letter"
                className="love-letter"
                aria-label="A love letter"
                initial={{ opacity: 0, y: 50, rotateX: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.94 }}
                transition={{ duration: reducedMotion ? 0.2 : 1.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <button type="button" className="icon-btn letter-close" onClick={() => setFolded(true)} aria-label="Close the letter">
                  <X size={16} />
                </button>
                <div className="love-letter-body">
                  <h2>{withNames(loveLetter.greeting)}</h2>
                  {paragraphs.slice(0, shown).map((p, i) => (
                    <motion.p key={i} className={i === 0 ? 'opening' : ''} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2 }}>
                      {p}
                    </motion.p>
                  ))}
                  {all && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
                      {loveLetter.photo && photoOk && (
                        <button type="button" className="letter-photo" onClick={() => setZoom(true)} aria-label="Look at the photo">
                          <img src={loveLetter.photo} alt="Us" onError={() => setPhotoOk(false)} />
                        </button>
                      )}
                      {loveLetter.voice && (
                        <div className="letter-voice">
                          <HeartPlayer src={loveLetter.voice} />
                        </div>
                      )}
                      <p className="letter-signature">{loveLetter.signature}</p>
                    </motion.div>
                  )}
                </div>
                <footer>
                  {!all ? (
                    <button type="button" className="btn-ghost" onClick={() => setShown(paragraphs.length)}>
                      {loveLetter.readAll}
                    </button>
                  ) : (
                    <>
                      {/* the first time, the letter leads into the finale */}
                      {!ended ? (
                        <button
                          type="button"
                          className="btn-glow small"
                          onClick={() => {
                            audio.sparkle()
                            startCinematic()
                          }}
                        >
                          {loveLetter.continue}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                              audio.sparkle()
                              startCinematic()
                            }}
                          >
                            <RotateCcw size={14} /> {loveLetter.replay}
                          </button>
                          <button type="button" className="btn-glow small" onClick={back}>
                            {loveLetter.back}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </footer>
              </motion.article>
            ) : (
              <motion.div key="folded" className="letter-folded" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <button type="button" className="btn-glow" onClick={() => setFolded(false)}>
                  <Mail size={16} /> {loveLetter.open}
                </button>
                <button type="button" className="btn-ghost" onClick={back}>
                  {loveLetter.back}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {zoom && (
              <motion.div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(false)}>
                <button type="button" className="icon-btn lightbox-close" autoFocus onClick={() => setZoom(false)} aria-label="Close photo">
                  <X size={16} />
                </button>
                <motion.img className="letter-photo-big" src={loveLetter.photo} alt="Us" initial={{ scale: 0.9 }} animate={{ scale: 1 }} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
