import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { ACTS, acceptTogether, cancelAct, cancelTogether, canTogether, declineTogether, inviteTogether, useLife, useTogether } from '../../lib/life'
import { MOODS, overallMood, pruneMoods, useMood } from '../../lib/mood'
import { mateName } from '../../lib/home'
import { coupleAvailable } from '../../lib/couple'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * LIVING IN THE HOUSE — the screens (lib/life.js, lib/mood.js): what she's doing right now (with a
 * progress bar and "Berhenti"), invitations to do something together, and her moodlets, like The Sims.
 */

/** "Lagi masak… ▰▰▰▱▱  Berhenti" */
export function ActFloat() {
  const act = useLife((s) => s.act)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!act) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [act])
  // quiet acts (a sip at the café) have their own card
  const a = act && !ACTS[act.kind]?.quiet && ACTS[act.kind]
  const k = act ? Math.min(1, (performance.now() / 1000 - act.t0) / act.seconds) : 0
  return (
    <AnimatePresence>
      {a && (
        <motion.section key="act" className="date-float act-float" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
          <p>
            <span aria-hidden="true">{a.icon}</span> Lagi {a.label.toLowerCase()}…
          </p>
          <i className="act-bar" style={{ '--k': k }} />
          <div className="couple-actions">
            <button type="button" className="btn-ghost" onClick={a.together ? cancelTogether : cancelAct}>
              Berhenti
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

/** An invitation to do something together (or: waiting for an answer). */
export function TogetherFloat() {
  const { state, kind, incoming } = useTogether()
  const view = useStore((s) => s.view)
  if (!coupleAvailable || view !== 'explore') return null
  let card = null
  if (incoming && state === 'none') {
    const a = ACTS[incoming.kind]
    card = (
      <motion.section key="in" className="date-float is-invite" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} aria-live="polite">
        <p>
          <strong>{mateName()}</strong> ngajak {a.label.toLowerCase()} {a.icon}
        </p>
        <div className="couple-actions">
          <button
            type="button"
            className="btn-glow"
            onClick={() => {
              audio.sparkle()
              acceptTogether()
            }}
          >
            <Check size={15} /> Ayo!
          </button>
          <button type="button" className="btn-ghost" onClick={declineTogether}>
            Nanti dulu
          </button>
        </div>
      </motion.section>
    )
  } else if (state === 'inviting' || state === 'joining') {
    card = (
      <motion.section key="wait" className="date-float" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
        <p>{state === 'inviting' ? `Menunggu ${mateName()} menjawab ajakan ${ACTS[kind]?.label.toLowerCase()}…` : 'Sebentar…'}</p>
        <div className="couple-actions">
          <button type="button" className="btn-ghost" onClick={cancelTogether}>
            Batalkan
          </button>
        </div>
      </motion.section>
    )
  }
  return <AnimatePresence>{card}</AnimatePresence>
}

/** The buttons for doing something together (in the Aktivitas sheet). */
export function TogetherButtons({ onDone }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 700)
    return () => clearInterval(id)
  }, [])
  const near = canTogether()
  const ask = (kind) => {
    if (inviteTogether(kind)) {
      audio.sparkle()
      onDone?.()
    }
  }
  return (
    <>
      <h3 className="together-title">Berdua</h3>
      <div className="date-emotes">
        {['hug', 'talk', 'dance', 'cook_together'].map((k) => (
          <button key={k} type="button" disabled={!near} onClick={() => ask(k)}>
            <span aria-hidden="true">{ACTS[k].icon}</span>
            {ACTS[k].label}
          </button>
        ))}
      </div>
      {!near && <p className="date-hint">Berdiri dekat {mateName()} dulu untuk melakukan sesuatu berdua ♡</p>}
    </>
  )
}

/** "Sekarang: Sangat senang 😊" and her moodlets, each with how long it has left. */
export function MoodStrip() {
  const list = useMood((s) => s.list)
  const phase = useStore((s) => s.phase)
  const view = useStore((s) => s.view)
  const [open, setOpen] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      pruneMoods()
      tick((n) => n + 1)
    }, 15000)
    return () => clearInterval(id)
  }, [])
  if (phase !== 'world' || view !== 'explore' || !list.length) return null
  const overall = overallMood(list)
  return (
    <div className="mood-strip">
      <button type="button" className="mood-overall" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Mood">
        <span aria-hidden="true">{overall.icon}</span>
        {open && <em>{overall.label}</em>}
      </button>
      {list.map((m) => {
        const def = MOODS[m.kind]
        const mins = Math.max(1, Math.round((m.until - Date.now()) / 60000))
        return (
          <span key={m.kind} className="moodlet" title={`${def.label} · ${def.text} · ${mins} menit lagi`}>
            <span aria-hidden="true">{def.icon}</span>
            {open && (
              <em>
                {def.label} <small>{mins >= 60 ? `${Math.round(mins / 60)} jam` : `${mins} mnt`}</small>
              </em>
            )}
          </span>
        )
      })}
    </div>
  )
}
