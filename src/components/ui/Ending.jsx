import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DoorOpen, RotateCcw, SkipForward } from 'lucide-react'
import { finalMessage, heartReactor, secretEnding, story } from '../../content/config'
import { CHAPTER_COUNT, chapterStatus, CUTSCENE_SECONDS } from '../../lib/story'
import { useChaptersDone, useStore } from '../../store'
import { audio } from '../../audio/engine'
import Confetti from './Confetti'

/** HEART REACTOR panel: energy per chapter, and the button that starts the ending once it's full. */
export function ReactorOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const done = useChaptersDone()
  const endingSeen = useStore((s) => s.endingSeen)
  const ignite = useStore((s) => s.igniteReactor)
  const setPanel = useStore((s) => s.setPanel)
  const openFinalRoom = useStore((s) => s.openFinalRoom)
  const doneFlags = useStore((s) => chapterStatus(s).map((c) => (c.done ? 1 : 0)).join(''))
  const ready = done >= CHAPTER_COUNT
  const open = view === 'reactor'

  return (
    <AnimatePresence>
      {open && (
        <motion.section className={`reactor-ui${flat ? ' is-flat' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: flat ? 0 : 0.4 }}>
          {flat && (
            <div className="flat-reactor" style={{ '--energy': done / CHAPTER_COUNT }} aria-hidden="true">
              ♥
            </div>
          )}
          <div className="reactor-card">
            <span className="eyebrow">{story.tagline}</span>
            <h2>{heartReactor.title}</h2>
            <div className="reactor-meter big" aria-label={`Energy: ${done} of ${CHAPTER_COUNT} chapters`}>
              {story.chapters.slice(0, CHAPTER_COUNT).map((c, i) => (
                <span key={c.id} className={doneFlags[i] === '1' ? 'is-on' : ''} title={c.title} />
              ))}
            </div>
            <p>{ready ? heartReactor.ready : heartReactor.idle}</p>
            <div className="reactor-actions">
              {ready ? (
                <button
                  type="button"
                  className="btn-glow"
                  onClick={() => {
                    // this tap is the user gesture that lets the music swell
                    if (ignite()) audio.climax(useStore.getState().reducedMotion ? 3 : CUTSCENE_SECONDS)
                  }}
                >
                  {heartReactor.igniteButton}
                </button>
              ) : (
                <button type="button" className="btn-glow small" onClick={() => setPanel('story')}>
                  See what’s left in the story
                </button>
              )}
              {ready && endingSeen && (
                <button type="button" className="btn-ghost" onClick={openFinalRoom}>
                  <DoorOpen size={15} /> Enter the Secret Room
                </button>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

const CAPTIONS = [
  { at: 0.8, text: 'Five chapters.' },
  { at: 3.6, text: 'Every memory. Every word. Every dream.' },
  { at: 7.4, text: 'Every universe…' },
  { at: 9.6, text: '…leads to you.' },
]

/** Cinematic bars, captions and a skip button during the ending cutscene. */
export function CutsceneOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const finish = useStore((s) => s.finishCutscene)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [caption, setCaption] = useState(-1)
  const [burst, setBurst] = useState(0)
  const open = view === 'cutscene'

  useEffect(() => {
    if (!open) {
      setCaption(-1)
      return
    }
    const scale = reducedMotion ? 3 / CUTSCENE_SECONDS : 1
    const timers = CAPTIONS.map((c, i) => setTimeout(() => setCaption(i), c.at * 1000 * scale))
    timers.push(setTimeout(() => setBurst((b) => b + 1), (reducedMotion ? 2 : 6.2) * 1000))
    // the 3D camera ends the cutscene; this is the safety net (and the timer for the 2D version)
    timers.push(setTimeout(() => useStore.getState().finishCutscene(), (reducedMotion ? 3 : CUTSCENE_SECONDS) * 1000 + (flat ? 0 : 1500)))
    return () => timers.forEach(clearTimeout)
  }, [open, reducedMotion, flat])

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div className="cutscene-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.8 } }}>
            <motion.div className="letterbox top" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2 }} />
            <motion.div className="letterbox bottom" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2 }} />
            {flat && (
              <motion.div className="flat-heart cutscene-heart" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1, 1.25, 1.1], opacity: 1 }} transition={{ duration: CUTSCENE_SECONDS * 0.8 }} aria-hidden="true">
                ♥
              </motion.div>
            )}
            <div className="cutscene-caption" aria-live="polite">
              <AnimatePresence mode="popLayout">
                {caption >= 0 && (
                  <motion.p key={caption} initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }} transition={{ duration: 1 }}>
                    {CAPTIONS[caption].text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <button type="button" className="btn-ghost cutscene-skip" onClick={finish}>
              <SkipForward size={15} /> Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <Confetti burstKey={burst} />
    </>
  )
}

function FinalMedia() {
  const [videoFailed, setVideoFailed] = useState(false)
  const [voiceFailed, setVoiceFailed] = useState(false)
  useEffect(() => () => audio.duck(false), [])
  const duck = { onPlay: () => audio.duck(true), onPause: () => audio.duck(false), onEnded: () => audio.duck(false) }
  return (
    <>
      {finalMessage.video && !videoFailed && (
        <video className="final-video" src={finalMessage.video} controls playsInline preload="metadata" onError={() => setVideoFailed(true)} {...duck} />
      )}
      {finalMessage.voice && !voiceFailed && (
        <audio className="final-voice" src={finalMessage.voice} controls preload="none" onError={() => setVoiceFailed(true)} {...duck}>
          <track kind="captions" />
        </audio>
      )}
    </>
  )
}

/** FINAL MESSAGE — the secret room: a personal letter, optional video / voice, and a replay. */
export function FinalRoomOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const replay = useStore((s) => s.replayEnding)
  const startFinale = useStore((s) => s.startFinale)
  const leave = useStore((s) => s.leaveFinalRoom)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const secretStage = useStore((s) => s.secretStage)
  const starAwake = useStore((s) => s.starAwake)
  const secretKnown = useStore((s) => s.secretFound || s.secretSeen)
  const findSecret = useStore((s) => s.findSecret)
  const replaySecret = useStore((s) => s.replaySecret)
  // the room's own card steps aside while the secret ending plays
  const open = view === 'finalRoom' && !secretStage
  const paragraphs = finalMessage.letter.split(/\n\s*\n/)

  // once the final letter has fully appeared, the little star beside the heart wakes up
  useEffect(() => {
    if (view !== 'finalRoom') return
    const ms = reducedMotion ? 300 : (2.4 + paragraphs.length * 0.9 + 2.2) * 1000
    const t = setTimeout(() => useStore.getState().wakeSecretStar(), ms)
    return () => clearTimeout(t)
  }, [view, reducedMotion, paragraphs.length])

  return (
    <AnimatePresence>
      {open && (
        <motion.section className={`final-ui${flat ? ' is-flat' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
          <motion.article
            className="final-card"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reducedMotion ? 0.2 : 1.4, delay: reducedMotion ? 0 : 1.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow">{story.tagline}</span>
            <h2>{finalMessage.title}</h2>
            <FinalMedia />
            <div className="final-letter">
              {paragraphs.map((p, i) => (
                <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : 2.4 + i * 0.9, duration: 1 }}>
                  {p}
                </motion.p>
              ))}
              <motion.p className="final-signature" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reducedMotion ? 0 : 2.4 + paragraphs.length * 0.9, duration: 1.2 }}>
                {finalMessage.signature}
              </motion.p>
            </div>
            <div className="final-actions">
              <button
                type="button"
                className="btn-glow small"
                onClick={() => {
                  if (useStore.getState().curtain) return
                  audio.climax(useStore.getState().reducedMotion ? 3 : CUTSCENE_SECONDS)
                  replay()
                }}
              >
                <RotateCcw size={15} /> Replay the ending
              </button>
              <button type="button" className="btn-glow small alt" onClick={startFinale}>
                One last question ♡
              </button>
              <button type="button" className="btn-ghost" onClick={leave}>
                Back to our island
              </button>
              {secretKnown && (
                <button type="button" className="btn-ghost" onClick={replaySecret}>
                  {secretEnding.replay}
                </button>
              )}
            </div>
            <AnimatePresence>
              {starAwake && (
                <motion.button
                  type="button"
                  className="secret-hint"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.6 }}
                  onClick={() => {
                    if (findSecret()) audio.sparkle()
                  }}
                >
                  <span aria-hidden="true">✦</span> {secretEnding.starHint}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.article>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
