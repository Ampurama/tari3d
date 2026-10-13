import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import letterText from '../../content/letter.txt?raw'
import { letter } from '../../content/config'
import { useStore } from '../../store'

const text = letterText.replace(/\r\n/g, '\n').trim()

/** Types the letter out like it's being written right now. Tap to reveal everything at once. */
function useTypewriter(full, running, instant) {
  const [count, setCount] = useState(instant ? full.length : 0)
  const position = useRef(0)
  useEffect(() => {
    position.current = 0
    if (!running) {
      setCount(0)
      return
    }
    if (instant) {
      position.current = full.length
      setCount(full.length)
      return
    }
    let timer
    const tick = () => {
      if (position.current >= full.length) return // finished, or skipped
      const i = ++position.current
      setCount(i)
      if (i >= full.length) return
      const ch = full[i - 1]
      const delay = ch === '\n' ? 260 : /[.,!?…]/.test(ch) ? 190 : 24 + Math.random() * 22
      timer = setTimeout(tick, delay)
    }
    timer = setTimeout(tick, 400)
    return () => clearTimeout(timer)
  }, [full, running, instant])
  const finish = () => {
    position.current = full.length
    setCount(full.length)
  }
  return [count, finish]
}

function FloatingHearts() {
  const hearts = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: (i * 0.7) % 6,
        duration: 7 + (i % 5),
        size: 10 + (i % 4) * 5,
        hue: i % 3,
      })),
    [],
  )
  return (
    <div className="letter-hearts" aria-hidden="true">
      {hearts.map((h, i) => (
        <span
          key={i}
          className={`float-heart hue-${h.hue}`}
          style={{ left: h.left, animationDelay: `${h.delay}s`, animationDuration: `${h.duration}s`, fontSize: h.size }}
        >
          ♥
        </span>
      ))}
    </div>
  )
}

export default function LetterOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const back = useStore((s) => s.back)
  const markLetterRead = useStore((s) => s.markLetterRead)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [paperOpen, setPaperOpen] = useState(false)
  const scroller = useRef()
  const open = view === 'letter'

  // envelope opens in 3D first; the paper appears once it has slid out
  useEffect(() => {
    if (!open) {
      setPaperOpen(false)
      return
    }
    const t = setTimeout(() => {
      setPaperOpen(true)
      markLetterRead()
    }, flat || reducedMotion ? 150 : 2300)
    return () => clearTimeout(t)
  }, [open, flat, reducedMotion, markLetterRead])

  const [count, finish] = useTypewriter(text, paperOpen, reducedMotion)
  const done = count >= text.length

  useEffect(() => {
    const el = scroller.current
    if (el && !done) el.scrollTop = el.scrollHeight
  }, [count, done])

  return (
    <AnimatePresence>
      {open && paperOpen && (
        <motion.div
          className="letter-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <FloatingHearts />
          <motion.article
            className="letter-paper"
            role="dialog"
            aria-modal="true"
            aria-label={letter.title}
            initial={{ y: 60, opacity: 0, rotateX: 18, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ duration: reducedMotion ? 0.2 : 1.1, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => !done && finish()}
          >
            <header>
              <span className="letter-seal" aria-hidden="true">
                ♥
              </span>
              <h2>{letter.title}</h2>
            </header>
            <div className="letter-body" ref={scroller}>
              {/* screen readers get the whole letter at once */}
              <p className="sr-only">{text}</p>
              <div aria-hidden="true" className="letter-typed">
                {text.slice(0, count)}
                {!done && <span className="caret" />}
              </div>
              <AnimatePresence>
                {done && (
                  <motion.p className="letter-signature" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
                    {letter.signature}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <footer>
              {!done ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    finish()
                  }}
                >
                  Show the whole letter
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-glow small"
                  onClick={(e) => {
                    e.stopPropagation()
                    back()
                  }}
                >
                  Fold it back ♡
                </button>
              )}
            </footer>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
