import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useCouple } from '../../lib/couple'
import { mateName } from '../../lib/home'
import { balloonPose, leaveBalloon, mateSeat, mySeat, PLACE_NAMES, setBalloonReady, useBalloon } from '../../lib/balloon'
import { useStore } from '../../store'

/*
 * HOT AIR BALLOON — the small card while you're in (or waiting for) the balloon:
 * "Siap Terbang" → "Terbang ke Sky Island" / "Kembali ke Pulau Utama", "Turun dari Balon",
 * "Menunggu pasangan…", "Perjalanan sedang berlangsung".
 */

export function BalloonCard() {
  const row = useBalloon((s) => s.row)
  const busy = useBalloon((s) => s.busy)
  const mateOnline = useCouple((s) => s.mateOnline)
  const view = useStore((s) => s.view)
  const [, tick] = useState(0)
  // the trip's progress changes every second
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const me = mySeat(row)
  const mate = mateSeat(row)
  if (!row || view !== 'explore' || (!me && !mate)) return null
  const pose = balloonPose(row)
  const flying = pose.phase !== 'docked'
  const myReady = me === 'a' ? row.ready_a : me === 'b' ? row.ready_b : false
  const mateReady = mate === 'a' ? row.ready_a : mate === 'b' ? row.ready_b : false
  const dest = pose.at === 'main' ? 'sky' : 'main'

  let body
  if (!me) {
    // only the other person is in the balloon
    body = (
      <p>
        🎈 {mateName()} {flying ? `sedang terbang ke ${PLACE_NAMES[pose.to]}` : `ada di balon, di ${PLACE_NAMES[pose.at]}`}.
      </p>
    )
  } else if (flying) {
    body = (
      <>
        <p>
          🎈 Perjalanan sedang berlangsung · menuju {PLACE_NAMES[pose.to]} ({Math.round(pose.progress * 100)}%)
        </p>
        <small>Tunggu sampai balon mendarat untuk turun.</small>
        <div className="couple-actions">
          <button type="button" className="btn-ghost" onClick={() => useStore.getState().setPanel('actions')}>
            <Sparkles size={14} /> Aktivitas
          </button>
        </div>
      </>
    )
  } else {
    body = (
      <>
        <p>
          🎈 Balon udara · di {PLACE_NAMES[pose.at]}
          {mate ? ` · bersama ${mateName()}` : ''}
        </p>
        {myReady && mate && !mateReady && <small>Menunggu pasangan{mateOnline ? '…' : ` (${mateName()} sedang offline)`}</small>}
        {!mate && mateOnline && <small>{mateName()} belum naik. Tunggu dia, atau berangkat sendiri.</small>}
        <div className="couple-actions">
          <button type="button" className={myReady ? 'btn-ghost' : 'btn-glow'} disabled={busy} onClick={() => setBalloonReady(!myReady)}>
            {myReady ? 'Belum siap' : dest === 'sky' ? 'Siap Terbang · ke Sky Island' : 'Siap Terbang · Kembali ke Pulau Utama'}
          </button>
          <button type="button" className="btn-ghost" disabled={busy || myReady} onClick={leaveBalloon}>
            Turun dari Balon
          </button>
        </div>
      </>
    )
  }
  return (
    <AnimatePresence>
      <motion.section key="balloon" className="date-float sky-card" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
        {body}
      </motion.section>
    </AnimatePresence>
  )
}
