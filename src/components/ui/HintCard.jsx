import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Footprints, Lightbulb, Navigation, Play, X } from 'lucide-react'
import { hints } from '../../content/config'
import { nextGoal, progressKey } from '../../lib/guide'
import { approach, interactables } from '../../lib/interactions'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * 💡 HINTS — "where is it, and what do I do?"
 * The card says what to do next (from her real progress), can light a beam + trail to it,
 * or simply walk her there. If she makes no progress for a while, the Hint button offers itself.
 */
export function HintCard() {
  const open = useStore((s) => s.panel === 'hint')
  const sig = useStore((s) => `${progressKey(s)}|${s.view}`)
  const goal = useMemo(() => nextGoal(useStore.getState()), [sig, open]) // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => useStore.getState().setPanel(null)
  const canPoint = Boolean(goal.target && interactables.get(goal.target)?.enabled())

  const showWay = () => {
    const st = useStore.getState()
    st.setGuide(true)
    st.setPanel(null)
    st.showToast('Follow the trail of light ✦', 3500)
    audio.sparkle()
  }
  const takeMe = () => {
    const st = useStore.getState()
    st.setGuide(true)
    st.setPanel(null)
    approach(goal.target)
    audio.sparkle()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="panel-backdrop hint-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            className="panel hint-card"
            role="dialog"
            aria-modal="true"
            aria-label="Hint"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-btn panel-close" onClick={close} aria-label="Close">
              <X size={18} />
            </button>
            <span className="hint-kicker">
              <Lightbulb size={15} /> Hint
            </span>
            <h2>{goal.title}</h2>
            <p className="hint-text">{goal.text}</p>
            <div className="hint-actions">
              {canPoint && (
                <>
                  <button type="button" className="btn-glow" onClick={takeMe}>
                    <Footprints size={16} /> Take me there
                  </button>
                  <button type="button" className="btn-ghost" onClick={showWay}>
                    <Navigation size={16} /> Show me the way
                  </button>
                </>
              )}
              {goal.action === 'ending' && (
                <button
                  type="button"
                  className="btn-glow"
                  onClick={() => {
                    close()
                    useStore.getState().startCinematic()
                  }}
                >
                  <Play size={16} /> Watch the ending
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** While the guide is on: a small chip to turn it off. */
export function GuideChip() {
  const on = useStore((s) => s.guide && s.view === 'explore' && s.phase === 'world')
  return (
    <AnimatePresence>
      {on && (
        <motion.button
          type="button"
          className="guide-chip"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          onClick={() => useStore.getState().setGuide(false)}
          aria-label="Turn off the guide"
        >
          <Navigation size={14} /> Following the light <X size={14} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/**
 * Turns the guide off once she reaches the goal (any real progress), and nudges the Hint button
 * when she has been exploring for a while without any progress.
 */
export function useHintDirector(enabled = true) {
  const key = useStore(progressKey)
  const exploring = useStore((s) => enabled && s.phase === 'world' && s.view === 'explore' && !s.dialog && !s.panel)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const st = useStore.getState()
    if (st.guide) st.setGuide(false)
    if (st.hintNudge) useStore.setState({ hintNudge: false })
  }, [key])

  useEffect(() => {
    if (!exploring) return
    const t = setTimeout(() => {
      const st = useStore.getState()
      if (st.guide || st.view !== 'explore') return
      useStore.setState({ hintNudge: true })
      st.showToast(hints.idleNudge, 6000)
    }, (hints.idleNudgeSeconds || 75) * 1000)
    return () => clearTimeout(t)
  }, [key, exploring])
}
