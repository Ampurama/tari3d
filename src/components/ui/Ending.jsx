import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, RotateCcw, SkipForward, X } from 'lucide-react'
import { finalCinematic, loveLetter } from '../../content/config'
import { CINE_LENGTH, SCENES, TITLE_AT } from '../../lib/cinematic'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { HeartPlayer } from './SecretEnding'

/**
 * FINAL CINEMATIC overlay — cinematic bars, captions for each scene, soft cuts between them,
 * the title, and a skip button (after a brief moment). The camera is driven in 3D.
 */
export function CinematicOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const finish = useStore((s) => s.finishCinematic)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [t, setT] = useState(0)
  const open = view === 'cinematic'
  const speed = reducedMotion ? 4 : 1

  useEffect(() => {
    if (!open) {
      setT(0)
      return
    }
    const start = performance.now()
    const id = setInterval(() => setT(((performance.now() - start) / 1000) * speed), 100)
    // the 3D camera ends the cinematic; this is the safety net (and the clock for the 2D version)
    const end = setTimeout(() => useStore.getState().finishCinematic(), ((CINE_LENGTH + (flat ? 0 : 2)) * 1000) / speed)
    return () => {
      clearInterval(id)
      clearTimeout(end)
    }
  }, [open, speed, flat])

  const scene = SCENES.findIndex((s) => t >= s.from && t < s.to)
  const lines = finalCinematic.scenes[scene] || []
  const inScene = scene >= 0 ? t - SCENES[scene].from : 0
  // a soft dip to black at the first two scene changes (they jump far across the universe)
  const cut = [SCENES[1].from, SCENES[2].from].some((c) => Math.abs(t - c) < 0.7)
  const titleOn = t >= TITLE_AT

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={`cutscene-ui${flat ? ' is-flat' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.8 } }}>
          {flat && <div className={`flat-cine scene-${Math.max(0, scene)}`} aria-hidden="true" />}
          <motion.div className="letterbox top" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2 }} />
          <motion.div className="letterbox bottom" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2 }} />
          <div className={`cine-cut${cut ? ' is-on' : ''}`} aria-hidden="true" />
          <div className="cutscene-caption" aria-live="polite">
            <AnimatePresence mode="popLayout">
              {!titleOn && lines[0] && inScene > 1 && (
                <motion.p key={`${scene}-a`} initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 1.2 }}>
                  {lines[0]}
                </motion.p>
              )}
              {!titleOn && lines[1] && inScene > 4.4 && (
                <motion.p key={`${scene}-b`} className="soft" initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 1.2 }}>
                  {lines[1]}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {titleOn && (
              <motion.h1 className="cine-title" initial={{ opacity: 0, letterSpacing: '0.6em', filter: 'blur(10px)' }} animate={{ opacity: 1, letterSpacing: '0.18em', filter: 'blur(0px)' }} transition={{ duration: 3, ease: [0.22, 1, 0.36, 1] }}>
                {finalCinematic.title}
              </motion.h1>
            )}
          </AnimatePresence>
          {t > 2 && (
            <button type="button" className="btn-ghost cutscene-skip" onClick={finish}>
              <SkipForward size={15} /> {finalCinematic.skip}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * THE LOVE LETTER — after the cinematic. It can be closed (and opened again), the photo can be
 * looked at properly, the voice note plays only when she presses play, and she can always go back
 * into the world or replay the ending.
 */
export function EndingLetter() {
  const view = useStore((s) => s.view)
  const back = useStore((s) => s.back)
  const startCinematic = useStore((s) => s.startCinematic)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [folded, setFolded] = useState(false)
  const [shown, setShown] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [photoOk, setPhotoOk] = useState(true)
  const open = view === 'ending'
  const paragraphs = useMemo(
    () => [loveLetter.opening, ...loveLetter.body, ...(loveLetter.personalNote ? [loveLetter.personalNote] : []), ...loveLetter.ending].filter(Boolean),
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
                  <h2>{loveLetter.greeting}</h2>
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
                      Read it all
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
                        <RotateCcw size={14} /> Replay the ending
                      </button>
                      <button type="button" className="btn-glow small" onClick={back}>
                        Return to our world
                      </button>
                    </>
                  )}
                </footer>
              </motion.article>
            ) : (
              <motion.div key="folded" className="letter-folded" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <button type="button" className="btn-glow" onClick={() => setFolded(false)}>
                  <Mail size={16} /> Open the letter
                </button>
                <button type="button" className="btn-ghost" onClick={back}>
                  Return to our world
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {zoom && (
              <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(false)}>
                <motion.img className="letter-photo-big" src={loveLetter.photo} alt="Us" initial={{ scale: 0.9 }} animate={{ scale: 1 }} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
