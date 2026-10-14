import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cut, cutTime, endCutscene, useCutscene } from '../../lib/cutscene'
import { cutscenes } from '../../content/config'
import { useStore } from '../../store'

/*
 * CUTSCENES — what's on screen while one plays: cinematic bars, the words appearing one line at a
 * time, soft white (a change of world) or black (a cut) flashes, a title at the very end, and
 * "Lewati" to skip. Escape skips too.
 */

const flashAt = (t) => {
  for (const f of cut.script?.flashes || []) {
    const d = Math.abs(t - f.at)
    if (d < f.len / 2) return { color: f.color, a: 1 - d / (f.len / 2) }
  }
  return null
}

export default function CutsceneOverlay() {
  const id = useCutscene((s) => s.id)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [t, setT] = useState(0)

  // the words and the flashes follow the cutscene's own clock (ten times a second is plenty)
  useEffect(() => {
    if (!id) return
    const timer = setInterval(() => setT(cutTime()), 100)
    return () => clearInterval(timer)
  }, [id])

  // Escape skips (before anything else hears it)
  useEffect(() => {
    if (!id) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      endCutscene()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [id])

  const lines = (id && cut.script?.lines) || []
  const current = lines.findIndex((l) => t >= l.at && t < l.to)
  const flash = id ? flashAt(t) : null
  const title = id && cut.script?.title && t >= cut.script.title[0] ? cutscenes[id]?.title : null

  return (
    <AnimatePresence>
      {id && (
        <motion.div key={id} className="cutscene" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
          <motion.div className="cutscene-bar is-top" initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
          <motion.div className="cutscene-bar is-bottom" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
          <div className="cutscene-flash" style={{ background: flash?.color === 'white' ? '#fffaf4' : '#05040c', opacity: flash ? (reducedMotion ? Math.min(1, flash.a) * 0.6 : flash.a) : 0 }} />
          <div className="cutscene-words" aria-live="polite">
            <AnimatePresence mode="wait">
              {current >= 0 && (
                <motion.p
                  key={current}
                  initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
                  transition={{ duration: reducedMotion ? 0.2 : 1.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  {lines[current].text}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {title && (
              <motion.h2 key="title" className="cutscene-title" initial={{ opacity: 0, letterSpacing: '0.3em' }} animate={{ opacity: 1, letterSpacing: '0.12em' }} transition={{ duration: 2.4 }}>
                {title}
              </motion.h2>
            )}
          </AnimatePresence>
          <button type="button" className="cutscene-skip" onClick={endCutscene}>
            Lewati
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
