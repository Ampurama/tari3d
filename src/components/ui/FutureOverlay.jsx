import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { futureWorlds } from '../../content/config'
import { useStore } from '../../store'

const ICONS = { home: '🏡', travel: '✈️', simple: '☕', wedding: '💍' }

/** FUTURE SIMULATOR — one card per dream world, walk between them with the arrows or by tapping a bubble. */
export default function FutureOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const index = useStore((s) => s.futureIndex)
  const visited = useStore((s) => s.futureVisited)
  const openFuture = useStore((s) => s.openFuture)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const worlds = futureWorlds.worlds
  const world = worlds[index]
  const open = view === 'future' && Boolean(world)

  return (
    <AnimatePresence>
      {open && (
        <motion.section className={`future-ui${flat ? ' is-flat' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
          <div className="section-heading">
            <h2>{futureWorlds.title}</h2>
            <p>
              {futureWorlds.subtitle} · {visited.length}/{worlds.length} visited
            </p>
          </div>
          <div className="future-tabs" role="tablist">
            {worlds.map((w, i) => (
              <button key={w.id} type="button" role="tab" aria-selected={i === index} className={`future-tab${i === index ? ' is-current' : ''}${visited.includes(i) ? ' is-visited' : ''}`} onClick={() => openFuture(i)}>
                <span aria-hidden="true">{ICONS[w.id] || '✦'}</span>
                <span className="future-tab-label">{w.title}</span>
              </button>
            ))}
          </div>
          <motion.article
            key={index}
            className="future-card"
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: reducedMotion ? 0.2 : 0.9, delay: flat || reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {flat && (
              <div className="future-flat-art" aria-hidden="true">
                {ICONS[world.id] || '✦'}
              </div>
            )}
            <span className="memory-date">
              World {index + 1} of {worlds.length}
            </span>
            <h3>{world.title}</h3>
            <p>{world.message}</p>
            <div className="lane-nav">
              <button type="button" className="icon-btn" onClick={() => openFuture(index - 1)} aria-label="Previous world">
                <ChevronLeft size={20} />
              </button>
              <button type="button" className="btn-ghost" onClick={() => openFuture(index + 1)}>
                {index === worlds.length - 1 ? 'Back to the first world' : 'Next world'}
              </button>
              <button type="button" className="icon-btn" onClick={() => openFuture(index + 1)} aria-label="Next world">
                <ChevronRight size={20} />
              </button>
            </div>
          </motion.article>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
