import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { constellation } from '../../content/config'
import { heartPoint } from '../../lib/heart'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/** 2D constellation for the no-WebGL version — the same stars, drawn in SVG. */
function FlatStars() {
  const found = useStore((s) => s.starsFound)
  const active = useStore((s) => s.activeStar)
  const lightStar = useStore((s) => s.lightStar)
  const n = constellation.reasons.length
  const pts = Array.from({ length: n }, (_, i) => {
    const [x, y] = heartPoint((i / n) * Math.PI * 2)
    return [100 + x * 80, 95 - y * 80]
  })
  return (
    <svg className="flat-stars" viewBox="0 0 200 190" role="group" aria-label="Constellation">
      {pts.map(([x, y], i) => {
        const j = (i + 1) % n
        const on = found.includes(i) && found.includes(j)
        return <line key={`l${i}`} x1={x} y1={y} x2={pts[j][0]} y2={pts[j][1]} className={`flat-star-line${on ? ' is-on' : ''}`} />
      })}
      {pts.map(([x, y], i) => (
        <g key={i} className={`flat-star${found.includes(i) ? ' is-lit' : ''}${active === i ? ' is-active' : ''}`}>
          <circle cx={x} cy={y} r="11" fill="transparent" />
          <circle cx={x} cy={y} r={found.includes(i) ? 4.5 : 3} />
          <title>{`Star ${i + 1}`}</title>
          <rect
            x={x - 11}
            y={y - 11}
            width="22"
            height="22"
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`Star ${i + 1}`}
            onClick={() => {
              audio.sparkle()
              lightStar(i)
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && lightStar(i)}
          />
        </g>
      ))}
    </svg>
  )
}

/** OUR CONSTELLATION — progress, the reason behind each star, and a message once the heart is complete. */
export default function ConstellationOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const found = useStore((s) => s.starsFound)
  const active = useStore((s) => s.activeStar)
  const closeStar = useStore((s) => s.closeStar)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const n = constellation.reasons.length
  const complete = n > 0 && found.length >= n
  const open = view === 'constellation'

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className={`constellation-ui${flat ? ' is-flat' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: flat ? 0 : 0.6 }}
        >
          <div className="section-heading">
            <h2>{constellation.title}</h2>
            <p>
              {complete ? 'Every star is shining ♡' : constellation.subtitle} · {found.length}/{n}
            </p>
          </div>

          {flat && <FlatStars />}

          <div className="constellation-bottom">
            <AnimatePresence mode="wait">
              {active !== null ? (
                <motion.div
                  key={active}
                  className="reason-card"
                  initial={{ opacity: 0, y: 16, scale: 0.96, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: reducedMotion ? 0.15 : 0.6 }}
                >
                  <span className="memory-date">Star {active + 1} · one thing I love about you</span>
                  <p>{constellation.reasons[active]}</p>
                  <button type="button" className="icon-btn reason-close" onClick={closeStar} aria-label="Close">
                    <X size={16} />
                  </button>
                </motion.div>
              ) : complete ? (
                <motion.p key="done" className="constellation-complete" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {constellation.completeMessage}
                </motion.p>
              ) : (
                <motion.p key="hint" className="constellation-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  ✦ Tap a star
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
