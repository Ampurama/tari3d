import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gift, Heart, X } from 'lucide-react'
import { hiddenHearts } from '../../content/config'
import { HIDDEN_HEART_COUNT, useStore } from '../../store'
import { audio } from '../../audio/engine'

/** Progress pill in the HUD: ♡ 2/5 */
export function HeartsPill() {
  const found = useStore((s) => s.foundHearts.length)
  const setPanel = useStore((s) => s.setPanel)
  const complete = found >= HIDDEN_HEART_COUNT
  return (
    <button
      type="button"
      className={`hud-pill${complete ? ' is-complete' : ''}`}
      onClick={() => setPanel('hearts')}
      aria-label={`Hidden hearts found: ${found} of ${HIDDEN_HEART_COUNT}`}
    >
      {complete ? <Gift size={14} /> : <Heart size={14} />}
      <span>
        {found}/{HIDDEN_HEART_COUNT}
      </span>
    </button>
  )
}

function RewardMedia({ media }) {
  const [failed, setFailed] = useState(false)
  if (!media?.src || failed) return null
  return media.type === 'video' ? (
    <video className="reward-media" src={media.src} controls playsInline preload="metadata" onError={() => setFailed(true)} />
  ) : (
    <img className="reward-media" src={media.src} alt="" loading="lazy" onError={() => setFailed(true)} />
  )
}

/** Collection panel: which hearts are found, hints for the rest, and the secret gift at 5/5. */
export function HeartsPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const found = useStore((s) => s.foundHearts)
  const complete = found.length >= HIDDEN_HEART_COUNT
  const { reward, hints } = hiddenHearts

  return (
    <AnimatePresence>
      {panel === 'hearts' && (
        <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanel(null)}>
          <motion.div
            className="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Hidden hearts"
            initial={{ y: 30, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-btn panel-close" onClick={() => setPanel(null)} aria-label="Close">
              <X size={18} />
            </button>
            <h2>{complete ? 'A secret gift ♡' : 'Hidden hearts'}</h2>
            <div className="heart-slots" aria-hidden="true">
              {Array.from({ length: HIDDEN_HEART_COUNT }, (_, i) => (
                <motion.span
                  key={i}
                  className={`heart-slot${found.includes(i) ? ' is-found' : ''}`}
                  initial={false}
                  animate={found.includes(i) ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  ♥
                </motion.span>
              ))}
            </div>
            <div className="hearts-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${found.length / HIDDEN_HEART_COUNT})` }} />
            </div>
            <p className="hearts-count">
              {found.length} of {HIDDEN_HEART_COUNT} found
            </p>

            {complete ? (
              <motion.div className="reward" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}>
                <h3>{reward.title}</h3>
                <p>{reward.message}</p>
                <RewardMedia media={reward.media} />
              </motion.div>
            ) : (
              <>
                <p className="hearts-intro">Five tiny hearts are hiding around our universe. Look closely, turn the island around, visit every place.</p>
                <ul className="hint-list">
                  {Array.from({ length: HIDDEN_HEART_COUNT }, (_, i) => (
                    <li key={i} className={found.includes(i) ? 'is-found' : ''}>
                      <span aria-hidden="true">{found.includes(i) ? '♥' : '♡'}</span>
                      {found.includes(i) ? 'Found!' : hints[i] || 'Somewhere out there…'}
                    </li>
                  ))}
                </ul>
                <p className="hearts-reward-teaser">
                  <Gift size={14} /> Find all five to unlock a secret gift.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 2D version (no WebGL): five tiny heart buttons tucked into different screens.
 * `where` maps each heart to the view it hides in.
 */
const FLAT_SPOTS = [
  { view: 'explore', style: { left: '6%', bottom: '18%' } },
  { view: 'memories', style: { right: '5%', top: '22%' } },
  { view: 'lane', style: { left: '4%', top: '40%' } },
  { view: 'distance', style: { right: '8%', bottom: '24%' } },
  { view: 'constellation', style: { left: '10%', top: '26%' } },
]

export function FlatHiddenHearts() {
  const view = useStore((s) => s.view)
  const found = useStore((s) => s.foundHearts)
  const findHeart = useStore((s) => s.findHeart)
  return FLAT_SPOTS.map((spot, i) =>
    spot.view === view && !found.includes(i) ? (
      <button
        key={i}
        type="button"
        className="flat-hidden-heart"
        style={spot.style}
        aria-label="A tiny hidden heart"
        onClick={() => {
          if (findHeart(i)) audio.sparkle()
        }}
      >
        ♥
      </button>
    ) : null,
  )
}
