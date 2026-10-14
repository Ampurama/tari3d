import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { littleThings, seeds } from '../../content/config'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * The 2D (no-WebGL) way to play the three chapters. Same store actions, same rules:
 * progress only moves when she actually does the thing.
 */

const ICONS = { photo: '🖼️', letter: '🍾', flower: '🌷', musicbox: '🎶', star: '⭐' }

function Sheet({ title, onClose, children }) {
  return (
    <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel flat-chapter" role="dialog" aria-modal="true" aria-label={title} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  )
}

/** Chapter 1 — the five little things, each revealed by tapping it. */
export function FlatLittleThings({ onClose }) {
  const found = useStore((s) => s.littleFound)
  const find = useStore((s) => s.findLittle)
  return (
    <Sheet title="The Little Things" onClose={onClose}>
      <p className="hearts-intro">Five little things are hiding in our universe. Tap each one.</p>
      <div className="flat-things">
        {littleThings.map((l) => {
          const isFound = found.includes(l.id)
          return (
            <button
              key={l.id}
              type="button"
              className={`flat-thing${isFound ? ' is-found' : ''}`}
              onClick={() => {
                if (l.id === 'musicbox') audio.musicBox()
                if (!isFound && find(l.id)) audio.sfx('reveal')
                else useStore.getState().showDiscovery({ kind: 'little', title: l.title, text: l.message, photo: l.photo || null })
              }}
            >
              <span className="flat-thing-icon">{isFound ? ICONS[l.id] || '✦' : '❔'}</span>
              <strong>{isFound ? l.title : l.zone}</strong>
              {isFound && <Check size={14} />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

function HoldButton({ seconds, label, onDone }) {
  const [p, setP] = useState(0)
  const held = useRef(false)
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = (now - last) / 1000
      last = now
      setP((v) => {
        const next = held.current ? Math.min(1, v + dt / seconds) : Math.max(0, v - dt)
        if (next >= 1 && v < 1) {
          held.current = false
          setTimeout(onDone, 0)
          return 0
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seconds, onDone])
  const set = (v) => () => (held.current = v)
  return (
    <button type="button" className="flat-mech hold" style={{ '--p': p }} onPointerDown={set(true)} onPointerUp={set(false)} onPointerLeave={set(false)}>
      {label}
    </button>
  )
}

/** Chapter 3 — pick, plant and care for each seed. */
export function FlatSeeds({ onClose }) {
  const state = useStore((s) => s.seedState)
  const carrying = useStore((s) => s.carrying)
  const hasWater = useStore((s) => s.hasWater)
  const stones = useStore((s) => s.stonesLit)
  const st = () => useStore.getState()
  const others = seeds.filter((x) => x.id !== 'future')
  const allOthers = others.every((x) => state[x.id] === 'grown')
  return (
    <Sheet title="A Future We Grow" onClose={onClose}>
      <p className="hearts-intro">Find each seed, plant it beside the Love Tree, and care for it in its own way.</p>
      <ul className="flat-seeds">
        {seeds.map((sd) => {
          const s = state[sd.id]
          let action
          if (!s)
            action = (
              <button type="button" className="btn-ghost" disabled={Boolean(carrying)} onClick={() => st().pickSeed(sd.id) && audio.sfx('pickup')}>
                Find the seed
              </button>
            )
          else if (s === 'carried')
            action =
              sd.id === 'honesty' ? (
                <HoldButton seconds={1.3} label="Hold to plant" onDone={() => st().plantSeed('honesty') && audio.sfx('bloom')} />
              ) : (
                <button type="button" className="btn-glow small" onClick={() => st().plantSeed(sd.id) && audio.sfx('plant')}>
                  Plant it
                </button>
              )
          else if (s === 'planted') {
            if (sd.id === 'kindness')
              action = hasWater ? (
                <button type="button" className="btn-glow small" onClick={() => st().growSeed('kindness')}>
                  Give it water
                </button>
              ) : (
                <button type="button" className="btn-ghost" onClick={() => st().fetchWater()}>
                  Fetch lake water
                </button>
              )
            else if (sd.id === 'adventures')
              action = (
                <span className="flat-mech-row">
                  {[0, 1].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`flat-star-btn${stones.includes(n) ? ' is-lit' : ''}`}
                      onClick={() => {
                        st().lightStone(n)
                      }}
                      aria-label={`Guiding stone ${n + 1}`}
                    >
                      ◆
                    </button>
                  ))}
                </span>
              )
            else if (sd.id === 'growth') action = <HoldButton seconds={3} label="Hold to stay with it" onDone={() => st().growSeed('growth')} />
            else if (sd.id === 'future')
              action = (
                <button
                  type="button"
                  className="btn-glow small"
                  disabled={!allOthers}
                  onClick={() => {
                    others.forEach((o) => st().linkFuture(o.id))
                    st().growSeed('future')
                  }}
                >
                  {allOthers ? 'Connect the four lights' : 'Grow the others first'}
                </button>
              )
          } else action = <Check size={16} />
          return (
            <li key={sd.id} className={s === 'grown' ? 'is-done' : ''}>
              <div>
                <strong>{sd.title}</strong>
                <small>{s === 'grown' ? sd.message : sd.care}</small>
              </div>
              {action}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

/** Which chapter sheet is open in the 2D hub. */
export function FlatChapterSheets({ open, onClose }) {
  const ch3 = useChapterUnlocked(2)
  return (
    <AnimatePresence>
      {open === 'little' && <FlatLittleThings key="l" onClose={onClose} />}
      {open === 'seeds' && ch3 && <FlatSeeds key="s" onClose={onClose} />}
    </AnimatePresence>
  )
}
