import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { companion, glowFlowers, littleThings, picnic, story } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * The 2D (no-WebGL) way to play the chapters. Same store actions, same rules:
 * progress only moves when she actually does the thing.
 */

const ICONS = { photo: '🖼️', letter: '🍾', flower: '🌷', musicbox: '🎶', star: '⭐' }
const FLOWER_ICONS = ['🌸', '💠', '🌼']

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

/** Chapter 1 — wake the fluffy heart, then pick the three glowing flowers. */
export function FlatGoofy({ onClose }) {
  const awake = useStore((s) => s.mochiAwake)
  const found = useStore((s) => s.flowersFound)
  const line = useStore((s) => s.mochiLine)
  return (
    <Sheet title={story.chapters[0].title} onClose={onClose}>
      <div className="flat-mochi" aria-hidden="true">
        {awake ? '💗' : '💤'}
      </div>
      <p className="hearts-intro">{line?.text || (awake ? companion.flower[0] : companion.sleeping)}</p>
      {!awake ? (
        <button type="button" className="btn-glow" onClick={() => useStore.getState().wakeMochi() && audio.sfx('squeak')}>
          Wake {companion.name}
        </button>
      ) : (
        <div className="flat-things">
          {glowFlowers.map((f, i) => {
            const isFound = found.includes(f.id)
            return (
              <button key={f.id} type="button" className={`flat-thing${isFound ? ' is-found' : ''}`} disabled={isFound} onClick={() => useStore.getState().findGlowFlower(f.id) && audio.sfx('pickup')}>
                <span className="flat-thing-icon">{FLOWER_ICONS[i % FLOWER_ICONS.length]}</span>
                <strong>{isFound ? 'Udah dipetik ✦' : 'Bunga bercahaya'}</strong>
              </button>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

/** Chapter 2 — the five little things, each revealed by tapping it. */
export function FlatLittleThings({ onClose }) {
  const found = useStore((s) => s.littleFound)
  const find = useStore((s) => s.findLittle)
  return (
    <Sheet title={story.chapters[1].title} onClose={onClose}>
      <p className="hearts-intro">Ada lima hal kecil yang ngumpet di dunia kecil kita. Sentuh satu-satu, ya.</p>
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

/* ───────── Chapter 4 in 2D: the same three mini-games, drawn with buttons ───────── */

function FlatCatch() {
  const [caught, setCaught] = useState([])
  const catchOne = (i) => {
    if (caught.includes(i)) return
    const next = [...caught, i]
    setCaught(next)
    audio.sfx('pickup')
    if (next.length >= 3) useStore.getState().winPicnic('catch')
  }
  return (
    <div className="flat-catch">
      {[0, 1, 2].map((i) => (
        <button key={i} type="button" className={`flat-flyer f${i}${caught.includes(i) ? ' is-caught' : ''}`} onClick={() => catchOne(i)} aria-label="Catch the flower">
          🌸
        </button>
      ))}
    </div>
  )
}

function FlatSave() {
  const [u, setU] = useState(0)
  const [won, setWon] = useState(false)
  const pos = useRef(0)
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      pos.current = (pos.current + ((now - last) / 1000) * 0.32) % 1
      last = now
      setU(pos.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const shoo = () => {
    if (won) return
    if (pos.current > 0.6 && pos.current < 0.94) {
      setWon(true)
      audio.sfx('boing')
      useStore.getState().winPicnic('save')
    } else useStore.getState().showToast(pos.current <= 0.6 ? picnic.games.save.early : picnic.games.save.late, 2400)
  }
  return (
    <div className="flat-save">
      <div className="flat-save-track">
        <span className="flat-save-zone" />
        <span className="flat-save-thief" style={{ left: `${u * 100}%` }}>
          🦝
        </span>
        <span className="flat-save-basket">🧺</span>
      </div>
      <button type="button" className="btn-glow" onClick={shoo}>
        Shoo! 🖐️
      </button>
    </div>
  )
}

const FIX = [
  { id: 'blanket', icon: '🧺', label: 'Blanket' },
  { id: 'basket', icon: '🥪', label: 'Basket' },
  { id: 'vase', icon: '💐', label: 'Vase' },
]
function FlatFix() {
  const [placed, setPlaced] = useState([])
  const [selected, setSelected] = useState(null)
  const drop = (slot) => {
    if (!selected) return useStore.getState().showToast(picnic.games.fix.pick, 2200)
    if (selected !== slot) return useStore.getState().showToast(picnic.games.fix.wrong, 2200)
    const next = [...placed, slot]
    setPlaced(next)
    setSelected(null)
    audio.sfx('plant')
    if (next.length >= FIX.length) useStore.getState().winPicnic('fix')
  }
  return (
    <div className="flat-fix">
      <div className="flat-fix-row">
        {FIX.filter((f) => !placed.includes(f.id)).map((f) => (
          <button key={f.id} type="button" className={`flat-thing${selected === f.id ? ' is-found' : ''}`} onClick={() => setSelected(f.id)}>
            <span className="flat-thing-icon">{f.icon}</span>
            <strong>{f.label}</strong>
          </button>
        ))}
      </div>
      <div className="flat-fix-row">
        {FIX.map((f) => (
          <button key={f.id} type="button" className={`flat-slot${placed.includes(f.id) ? ' is-done' : ''}`} onClick={() => drop(f.id)} disabled={placed.includes(f.id)}>
            {placed.includes(f.id) ? f.icon : `${f.label} goes here`}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The picnic in 2D: the current mini-game (the shared Picnic HUD shows its title and the sunset). */
export function FlatPicnic() {
  const view = useStore((s) => s.view)
  const stage = useStore((s) => s.picnicStage)
  if (view !== 'picnic') return null
  return (
    <div className="flat-picnic">
      {stage === 'catch' && <FlatCatch />}
      {stage === 'save' && <FlatSave />}
      {stage === 'fix' && <FlatFix />}
      {stage === 'sunset' && (
        <div className="flat-sunset" aria-hidden="true">
          🌅 💗
        </div>
      )}
    </div>
  )
}

/** Which chapter sheet is open in the 2D hub. */
export function FlatChapterSheets({ open, onClose }) {
  return (
    <AnimatePresence>
      {open === 'goofy' && <FlatGoofy key="g" onClose={onClose} />}
      {open === 'little' && <FlatLittleThings key="l" onClose={onClose} />}
    </AnimatePresence>
  )
}
