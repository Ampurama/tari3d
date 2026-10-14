import { AnimatePresence, motion } from 'framer-motion'
import { input } from '../../lib/player'
import { isTouch } from '../../lib/device'
import { useCouple } from '../../lib/couple'
import { mateName } from '../../lib/home'
import { iFinished, leaveHop, mateCheckpoint, mateFinished, myCheckpoint, useSky } from '../../lib/sky'
import { GOAL_CP, HOP_STAR_IDS, OBS_IDS, STAR_LAMP_AT } from '../../lib/skyLayout'
import { useStore } from '../../store'

/*
 * SKY ISLAND — the small things on screen: how many hidden stars you've found, the Cloud Hop
 * card (stars, checkpoints, who's at the goal), and a "Lompat" button on touch screens.
 */

const cp = (n) => (n >= GOAL_CP ? 'di tujuan' : n === 0 ? 'di start' : `checkpoint ${n}/${GOAL_CP - 1}`)

/** Cards that stack at the top of the screen (with the date and hand-holding cards). */
export function SkyCards() {
  const { onSky, stars, round, status, error, progress } = useSky()
  const coupleStatus = useCouple((s) => s.status)
  const mateOnline = useCouple((s) => s.mateOnline)
  const view = useStore((s) => s.view)
  if (!onSky || view !== 'explore') return null
  const found = OBS_IDS.filter((id) => stars[id]).length
  return (
    <AnimatePresence>
      {round ? (
        <motion.section key="hop" className="date-float sky-card" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
          <span className="eyebrow">Cloud Hop · berdua</span>
          <p>
            ⭐ {round.stars?.length || 0}/{HOP_STAR_IDS.length} bintang
          </p>
          <ul className="date-who">
            <li className={iFinished(round) ? 'is-ready' : ''}>Kamu: {iFinished(round) ? 'sampai ✓' : cp(myCheckpoint(round))}</li>
            <li className={mateFinished(round) ? 'is-ready' : ''}>
              {mateName()}: {mateFinished(round) ? 'sampai ✓' : mateOnline ? cp(mateCheckpoint(round)) : 'sedang offline (progresnya tetap tersimpan)'}
            </li>
          </ul>
          {iFinished(round) && !mateFinished(round) && <small>Tunggu {mateName()} sampai di tujuan, ya. Rondenya selesai kalau kalian berdua sampai.</small>}
          {error && <p className="couple-error">{error}</p>}
          <div className="couple-actions">
            <button type="button" className="btn-ghost" onClick={leaveHop}>
              Keluar ronde
            </button>
          </div>
        </motion.section>
      ) : (
        <motion.section key="stars" className="date-float sky-card is-small" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
          <p>
            ✦ Bintang tersembunyi {found}/{OBS_IDS.length}
            {coupleStatus === 'connected' && status === 'ready' && found < STAR_LAMP_AT && <small> · {STAR_LAMP_AT - found} lagi untuk hadiah</small>}
            {progress?.hop_completions > 0 && <small> · Cloud Hop selesai {progress.hop_completions}×</small>}
          </p>
          {coupleStatus !== 'connected' && <small>Masuk “Main berdua” supaya bintang dan progresnya tersimpan.</small>}
          {status === 'error' && <small className="couple-error">{error}</small>}
        </motion.section>
      )}
    </AnimatePresence>
  )
}

/** "Lompat", for phones and tablets (keyboards use Space). */
export default function SkyPanel() {
  const onSky = useSky((s) => s.onSky)
  const panel = useStore((s) => s.panel)
  if (!onSky || !isTouch || panel) return null
  return (
    <button
      type="button"
      className="jump-btn"
      onPointerDown={(e) => {
        e.stopPropagation()
        input.jumpPresses++
      }}
      aria-label="Lompat"
    >
      Lompat
    </button>
  )
}
