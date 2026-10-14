import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useWish } from '../../lib/wish'
import { useStore } from '../../store'

/**
 * A letter from the western isles: a soft paper card over a dimmed (still visible) world.
 * It fades in, can be read at any pace, and closes with the button, a tap outside, or Escape.
 */
export default function WishLetter() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const letter = useWish((s) => s.letter)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const open = panel === 'wish' && letter
  const close = () => setPanel(null)
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="wish" className="wish-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.15 : 0.7 }} onClick={close}>
          <motion.article
            className="wish-letter"
            role="dialog"
            aria-modal="true"
            aria-label={letter.title}
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: reducedMotion ? 0.2 : 1.1, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-btn wish-close" onClick={close} aria-label="Tutup surat">
              <X size={18} />
            </button>
            {letter.place && <span className="wish-place">{letter.place}</span>}
            <h2>{letter.title}</h2>
            <div className="wish-body">
              {letter.text.split(/\n\s*\n/).map((para, i) => (
                <p key={i}>{para.trim()}</p>
              ))}
            </div>
            <button type="button" className="btn-ghost wish-done" onClick={close}>
              Tutup ♡
            </button>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
