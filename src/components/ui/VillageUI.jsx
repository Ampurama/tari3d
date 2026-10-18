import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { answer, closeTalk, DECOR_QUEST, HAT_AFTER, NPCS, QUESTS, speakerName, speakerRole, useVillage, wearHat } from '../../lib/village'
import { CATALOG, KINDS, priceOf } from '../../lib/homeLayout'
import { deliverItem, simsInstalled, useHome } from '../../lib/home'
import { coupleAvailable, useCouple } from '../../lib/couple'
import { useDate } from '../../lib/date'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import Confetti from './Confetti'

/*
 * GNOME VILLAGE — the screens (lib/village.js): talking with a gnome (with a choice or two), the
 * little card of jobs in progress, and Tuan Kenop's shop of decorations for the house.
 */

/** Talking with a gnome: their words, and what you can say back. Never blocks walking; Esc closes. */
function TalkCard() {
  const talk = useVillage((s) => s.talk)
  useEffect(() => {
    if (!talk) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeTalk()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [talk])
  return (
    <AnimatePresence>
      {talk && (
        <motion.div key={talk.npc + talk.text} className="dialog-wrap village-talk" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          <div className="dialog-box" role="dialog" aria-label={`Ngobrol dengan ${talk.name || speakerName(talk.npc)}`}>
            <span className="dialog-speaker">
              {talk.name || speakerName(talk.npc)} · {talk.role || speakerRole(talk.npc)}
            </span>
            <button type="button" className="icon-btn village-talk-close" onClick={closeTalk} aria-label="Tutup">
              <X size={16} />
            </button>
            <p className="dialog-text">{talk.text}</p>
            <div className="dialog-actions">
              {talk.options.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  className={i === 0 && o.kind !== 'close' ? 'btn-glow' : 'btn-ghost'}
                  onClick={() => {
                    if (o.kind !== 'close') audio.sparkle()
                    answer(o)
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** The jobs in progress (and the gnome hat), while she's in or near the village. */
export function VillageFloat() {
  const near = useVillage((s) => s.near)
  const quests = useVillage((s) => s.quests)
  const hat = useVillage((s) => s.hat)
  const hatOn = useVillage((s) => s.hatOn)
  const view = useStore((s) => s.view)
  const [open, setOpen] = useState(true)
  const active = Object.keys(QUESTS).filter((id) => ['active', 'ready'].includes(quests[id]?.state))
  const done = Object.keys(QUESTS).filter((id) => quests[id]?.state === 'done').length
  if (view !== 'explore' || (!near && !active.length)) return null
  return (
    <section className="date-float village-float">
      <button type="button" className="village-float-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden="true">🍄</span> Desa Kurcaci
        <small>
          {done}/{Object.keys(QUESTS).length} tugas
        </small>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <>
          {active.length ? (
            <ul className="village-quests">
              {active.map((id) => {
                const q = QUESTS[id]
                const st = quests[id]
                return (
                  <li key={id}>
                    <strong>{q.title}</strong>
                    <span>{st.state === 'ready' ? `Kembali ke ${NPCS[q.giver]?.name || speakerName(q.giver)} ✓` : q.goal}</span>
                    {q.steps > 1 && <i className="act-bar" style={{ '--k': st.n / q.steps }} />}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="village-hint">{done < Object.keys(QUESTS).length ? 'Cari gnome dengan tanda ❗ untuk tugas baru.' : 'Semua tugas desa selesai. Terima kasih, warga kehormatan ✦'}</p>
          )}
          {hat ? (
            <label className="village-hat">
              <input type="checkbox" checked={hatOn} onChange={(e) => wearHat(e.target.checked)} /> Pakai topi kurcaci 🎩
            </label>
          ) : (
            done > 0 && done < HAT_AFTER && <p className="village-hint">Selesaikan {HAT_AFTER - done} tugas lagi untuk hadiah dari Tetua Lumut 🎩</p>
          )}
        </>
      )}
    </section>
  )
}

/** Tuan Kenop's shop: the village's decorations, for coins or as rewards; sent straight to the house. */
function ShopSheet({ onClose }) {
  const coins = useHome((s) => s.coins)
  const status = useHome((s) => s.status)
  const keepsakes = useDate((s) => s.keepsakes)
  const connected = useCouple((s) => s.status === 'connected')
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const kinds = KINDS.filter((k) => ['desa', 'desa_taman'].includes(CATALOG[k].cat))
  const sims = simsInstalled()
  const send = async (k) => {
    setBusy(k)
    setMsg(null)
    const r = await deliverItem(k)
    setBusy(null)
    if (r.ok) {
      audio.sparkle()
      setMsg({ text: `${CATALOG[k].label} sudah dikirim ke rumah ✓ Atur letaknya lewat Mode Bangun.` })
    } else setMsg({ text: r.error, bad: true })
  }
  return (
    <motion.div className="panel-backdrop is-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel couple-panel date-panel village-shop" role="dialog" aria-modal="true" aria-label="Toko dekorasi" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        <h2>Pernak-Pernik Kenop</h2>
        <p className="couple-status">
          Dekorasi buatan warga desa. Yang dibeli langsung dikirim ke Rumah Kita.
          {sims && coins !== null && (
            <>
              {' '}
              Koin kalian: <strong>💗 {coins}</strong>
            </>
          )}
        </p>
        {!coupleAvailable || !connected ? (
          <p className="couple-error">Masuk dulu ke ruang berdua untuk mengirim dekorasi ke rumah, ya.</p>
        ) : status !== 'ready' ? (
          <p className="couple-error">Rumah kalian sedang dimuat…</p>
        ) : null}
        <div className="village-shop-list">
          {kinds.map((k) => {
            const c = CATALOG[k]
            const reward = Boolean(c.keepsake)
            const unlocked = !reward || keepsakes[k]
            const price = sims ? priceOf(k) : 0
            const quest = DECOR_QUEST[k]
            return (
              <div key={k} className={`village-item${unlocked ? '' : ' is-locked'}`}>
                <span className="village-item-icon" aria-hidden="true">
                  {c.icon}
                </span>
                <span className="village-item-text">
                  <strong>{c.label}</strong>
                  <small>
                    {c.area === 'garden' ? 'Taman' : 'Dalam rumah'} · {reward ? (unlocked ? 'hadiah, sudah terbuka ✓' : `hadiah: ${quest ? QUESTS[quest].title : c.hint}`) : `💗 ${price}`}
                  </small>
                </span>
                <button type="button" className={unlocked ? 'btn-glow' : 'btn-ghost'} disabled={!unlocked || busy || status !== 'ready' || (price > 0 && (coins ?? 0) < price)} onClick={() => send(k)}>
                  {busy === k ? 'Mengirim…' : unlocked ? (price ? 'Beli' : 'Kirim') : '🔒'}
                </button>
              </div>
            )
          })}
        </div>
        {msg && <p className={msg.bad ? 'couple-error' : 'couple-status'}>{msg.text}</p>}
      </motion.div>
    </motion.div>
  )
}

export default function VillageUI() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const phase = useStore((s) => s.phase)
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    const onDone = () => setBurst((n) => n + 1)
    window.addEventListener('village:done', onDone)
    return () => window.removeEventListener('village:done', onDone)
  }, [])
  if (phase !== 'world') return null
  return (
    <>
      {!coupleAvailable && (
        <div className="top-stack">
          <VillageFloat />
        </div>
      )}
      <TalkCard />
      <AnimatePresence>{panel === 'village-shop' && <ShopSheet key="shop" onClose={() => setPanel(null)} />}</AnimatePresence>
      <Confetti burstKey={burst} />
    </>
  )
}
