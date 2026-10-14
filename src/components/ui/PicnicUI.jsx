import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { picnic } from '../../content/config'
import { PICNIC_GAMES, withNames } from '../../lib/story'
import { useStore } from '../../store'

/**
 * The Disaster Date's HUD: which mini-game, how to play it, how far along she is — and at the
 * end, the two of them sitting together at sunset with the chapter's message.
 */
export default function PicnicUI() {
  const view = useStore((s) => s.view)
  const stage = useStore((s) => s.picnicStage)
  const count = useStore((s) => s.picnicCount)
  const open = view === 'picnic'
  const game = stage && stage !== 'sunset' ? picnic.games[stage] : null
  const step = PICNIC_GAMES.indexOf(stage) + 1
  const prev = useRef(stage)

  // the wind scatters the picnic right after the thief is chased away
  useEffect(() => {
    if (open && stage === 'fix' && prev.current === 'save') useStore.getState().showToast(picnic.wind, 3600)
    prev.current = stage
  }, [open, stage])

  return (
    <AnimatePresence>
      {open && (
        <motion.section className="picnic-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <AnimatePresence mode="wait">
            {game ? (
              <motion.div key={stage} className="picnic-card" initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
                <span className="eyebrow">
                  {picnic.title} · {step} / {PICNIC_GAMES.length}
                </span>
                <h2>{game.title}</h2>
                <p>{game.how}</p>
                {count && <strong className="picnic-count">{count}</strong>}
              </motion.div>
            ) : stage === 'sunset' ? (
              <motion.div key="sunset" className="picnic-card is-sunset" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.2, duration: 1.4 }}>
                <p className="picnic-message">“{withNames(picnic.message)}”</p>
                <button type="button" className="btn-glow" onClick={() => useStore.getState().leavePicnic()}>
                  Continue ♡
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {stage !== 'sunset' && (
            <button type="button" className="btn-ghost picnic-leave" onClick={() => useStore.getState().leavePicnic()}>
              <X size={14} /> Leave for now
            </button>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
