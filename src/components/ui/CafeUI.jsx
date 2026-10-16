import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { DRINKS, drinkCup, leaveCup, mySeat, orderDrink, putCup, cupAt, SIPS, takeCup, useCafe, waiterLeg } from '../../lib/cafe'
import { coupleAvailable } from '../../lib/couple'
import { useLife } from '../../lib/life'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * THE LITTLE GNOME CAFÉ — the screens (lib/cafe.js): the menu at the counter, the card that follows
 * your order (being made → on its way), and your cup (drink, put it down, pick it up, finish).
 */

/** The menu: Bram the barista's drinks. */
function MenuSheet({ onClose }) {
  const seated = Boolean(mySeat())
  const order = (k) => {
    if (orderDrink(k)) {
      audio.sparkle()
      onClose()
    }
  }
  return (
    <motion.div className="panel-backdrop is-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel couple-panel date-panel cafe-panel" role="dialog" aria-modal="true" aria-label="Menu kafe" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        <h2>The Little Gnome Café</h2>
        <p className="couple-status">{seated ? 'Pilih minumanmu. Pip si pelayan akan mengantarnya ke mejamu ♡' : 'Pilih minumanmu, Bram akan meraciknya. Duduk dulu kalau mau diantar ke meja ♡'}</p>
        <div className="cafe-menu">
          {Object.entries(DRINKS).map(([k, d]) => (
            <button key={k} type="button" onClick={() => order(k)} style={{ '--drink': d.color, '--foam': d.foam }}>
              <i className="cafe-cup" aria-hidden="true" />
              <span>
                <strong>
                  {d.label} <span aria-hidden="true">{d.icon}</span>
                </strong>
                <small>{d.text}</small>
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

/** My order (being made / on its way), then my cup. */
export function CafeFloat() {
  const order = useCafe((s) => s.order)
  const cup = useCafe((s) => s.cup)
  const act = useLife((s) => s.act)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!order && !cup) return
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [order, cup])
  let card = null
  if (order) {
    const d = DRINKS[order.drink]
    const span = order.state === 'brewing' ? d.seconds : order.state === 'carrying' ? waiterLeg(order.seat) : 1.4
    const k = Math.min(1, (performance.now() / 1000 - order.t0) / span)
    const text = order.state === 'brewing' ? `Bram lagi meracik ${d.label}…` : order.state === 'carrying' ? `Pip mengantar ${d.label} ke mejamu…` : `${d.label} siap!`
    card = (
      <motion.section key="order" className="date-float act-float" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
        <p>
          <span aria-hidden="true">{d.icon}</span> {text}
        </p>
        <i className="act-bar" style={{ '--k': k }} />
      </motion.section>
    )
  } else if (cup) {
    const d = DRINKS[cup.drink]
    const seat = mySeat()
    const sipping = act?.kind === 'sip'
    const onTable = cup.where === 'table'
    const canDrink = !sipping && (!onTable || seat === cup.seat)
    const canPut = !onTable && seat && !cupAt(seat)
    const canTake = onTable && !sipping && seat === cup.seat
    card = (
      <motion.section key="cup" className="date-float cafe-float" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
        <p>
          <span aria-hidden="true">{d.icon}</span> {sipping ? `Menyeruput ${d.label}…` : onTable ? `${d.label}-mu ada di meja` : `Memegang ${d.label}`}
          <small className="cafe-sips" aria-label={`${SIPS - cup.sips} tegukan lagi`}>
            {Array.from({ length: SIPS }, (_, i) => (
              <i key={i} className={i < SIPS - cup.sips ? 'is-full' : ''} />
            ))}
          </small>
        </p>
        <div className="couple-actions">
          <button
            type="button"
            className="btn-glow"
            disabled={!canDrink}
            onClick={() => {
              if (drinkCup()) audio.sparkle()
            }}
          >
            Minum
          </button>
          {canPut && (
            <button type="button" className="btn-ghost" onClick={() => putCup(seat)}>
              Taruh di meja
            </button>
          )}
          {canTake && (
            <button type="button" className="btn-ghost" onClick={takeCup}>
              Ambil
            </button>
          )}
          <button type="button" className="btn-ghost" disabled={sipping} onClick={leaveCup}>
            Selesai
          </button>
        </div>
      </motion.section>
    )
  }
  return <AnimatePresence>{card}</AnimatePresence>
}

export default function CafeUI() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const phase = useStore((s) => s.phase)
  if (phase !== 'world') return null
  return (
    <>
      {/* with the couple features on, the card sits in their top stack (DatePanel); otherwise here */}
      {!coupleAvailable && (
        <div className="top-stack">
          <CafeFloat />
        </div>
      )}
      <AnimatePresence>{panel === 'cafe' && <MenuSheet key="cafe" onClose={() => setPanel(null)} />}</AnimatePresence>
    </>
  )
}
