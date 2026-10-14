import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarHeart, Check, Heart, MapPin, Sparkles, X } from 'lucide-react'
import { coupleAvailable, useCouple } from '../../lib/couple'
import { mateName } from '../../lib/home'
import { EMOTES, emote, freeSibling, standUp } from '../../lib/actions'
import { player, walkTo } from '../../lib/player'
import {
  DATE_KINDS,
  diningReady,
  distanceTo,
  finish,
  iAmReady,
  invite,
  isExpired,
  mateReady,
  meetingPoint,
  nextPrompt,
  READY_RADIUS,
  respond,
  resume,
  saveNote,
  setReady,
  useDate,
  watchDate,
} from '../../lib/date'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { dates } from '../../content/config'
import { acceptHand, declineHand, releaseHand, useHand } from '../../lib/hand'
import { SkyCards } from './SkyPanel'

/*
 * LIFE TOGETHER + VIRTUAL DATE — the screens: two small buttons ("Aktivitas", "Virtual Date"),
 * the gestures, choosing a date, the invitation card, the card that follows a date from
 * "on the way" to "together", and "Kenangan Kita" (the dates you've had).
 * Nothing here decides anything on its own: lib/date.js asks the server.
 */

const title = (kind) => dates[kind]?.title || 'Kencan'
const when = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

function Sheet({ label, onClose, children, wide }) {
  return (
    <motion.div className="panel-backdrop is-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={`panel couple-panel date-panel${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  )
}

/* ───────── gestures ───────── */

function ActionsSheet({ onClose }) {
  const mateOnline = useCouple((s) => s.mateOnline)
  const seated = Boolean(player.seat)
  const spare = seated ? freeSibling(player.seat) : null
  const doIt = (kind, extra) => {
    audio.sparkle()
    emote(kind, extra)
    onClose()
  }
  return (
    <Sheet label="Aktivitas" onClose={onClose}>
      <span className="eyebrow">Aktivitas</span>
      <h2>Mau ngapain?</h2>
      <div className="date-emotes">
        {['wave', 'heart', 'happy', 'photo'].map((k) => (
          <button key={k} type="button" onClick={() => doIt(k)}>
            <span aria-hidden="true">{EMOTES[k].icon}</span>
            {EMOTES[k].label}
          </button>
        ))}
        <button type="button" onClick={() => doIt('call')} disabled={!mateOnline}>
          <span aria-hidden="true">{EMOTES.call.icon}</span>
          Panggil {mateName()}
        </button>
        {seated && spare && (
          <button type="button" onClick={() => doIt('call', { seat: spare })} disabled={!mateOnline}>
            <span aria-hidden="true">💺</span>
            Ajak {mateName()} duduk di sebelahmu
          </button>
        )}
        {seated && (
          <button
            type="button"
            onClick={() => {
              standUp()
              onClose()
            }}
          >
            <span aria-hidden="true">🚶</span>
            Berdiri
          </button>
        )}
      </div>
      {!mateOnline && <p className="couple-status">{mateName()} sedang nggak online, tapi gesturnya tetap bisa kamu lakukan.</p>}
      <p className="date-hint">Mau duduk? Dekati sofa, kursi, kasur, bangku, atau tepi teras, lalu tekan E / tombol ✦.</p>
    </Sheet>
  )
}

/* ───────── choosing a date ───────── */

function DateSheet({ onClose }) {
  const { status, session, error, busy } = useDate()
  const mate = useCouple((s) => s.mate)
  const setPanel = useStore((s) => s.setPanel)
  const [sent, setSent] = useState(null)
  const open = session && !isExpired(session)
  const ask = async (kind) => {
    const r = await invite(kind)
    if (r.ok) {
      audio.sparkle()
      setSent(kind)
    }
  }
  return (
    <Sheet label="Virtual Date" onClose={onClose} wide>
      <span className="eyebrow">Virtual Date</span>
      {status === 'error' ? (
        <p className="couple-error">{error}</p>
      ) : status !== 'ready' ? (
        <p className="couple-status">Sebentar, lagi disiapkan…</p>
      ) : open ? (
        <>
          <h2>{title(session.kind)}</h2>
          <p className="couple-status">
            {session.status === 'pending'
              ? session.initiator === useCouple.getState().me?.id
                ? `Menunggu jawaban ${mateName()}…`
                : `${mateName()} mengajakmu kencan. Jawab lewat kartu undangan di atas, ya.`
              : 'Kencan ini sedang berjalan. Lihat kartunya di bagian atas layar.'}
          </p>
          {sent && <p className="couple-status">Ajakan terkirim ♡</p>}
        </>
      ) : (
        <>
          <h2>Ajak {mate ? mateName() : 'pasanganmu'} kencan</h2>
          <div className="date-cards">
            {DATE_KINDS.map((kind) => {
              const d = dates[kind]
              const blocked = kind === 'dinner_home' && !diningReady()
              return (
                <article key={kind} className="date-card">
                  <h3>{d.title}</h3>
                  <p className="date-place">
                    <MapPin size={13} /> {d.place}
                  </p>
                  <p>{d.text}</p>
                  {blocked && <p className="date-needs">{d.needs}</p>}
                  <button type="button" className="btn-glow" disabled={busy || blocked || !mate} onClick={() => ask(kind)}>
                    <Heart size={14} /> Ajak Kencan
                  </button>
                </article>
              )
            })}
          </div>
          {error && <p className="couple-error">{error}</p>}
        </>
      )}
      <div className="couple-actions">
        <button type="button" className="btn-ghost" onClick={() => setPanel('date-memories')}>
          <CalendarHeart size={15} /> Kenangan Kita
        </button>
      </div>
    </Sheet>
  )
}

/* ───────── the cards at the top ───────── */

/** Re-render once a second (distances, the clock) and keep an eye on the date. */
function useTick() {
  const [, setT] = useState(0)
  useEffect(() => {
    const t = setInterval(() => {
      watchDate()
      setT((n) => n + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [])
}

function InviteCard({ session }) {
  const busy = useDate((s) => s.busy)
  const d = dates[session.kind]
  return (
    <motion.section className="date-float is-invite" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} aria-live="polite">
      <span className="eyebrow">Undangan Kencan</span>
      <h3>
        {mateName()} mengajakmu: {d.title}
      </h3>
      <p className="date-place">
        <MapPin size={13} /> {d.place}
      </p>
      <p>{d.text}</p>
      <div className="couple-actions">
        <button type="button" className="btn-glow" disabled={busy} onClick={() => respond(true)}>
          <Check size={15} /> Terima
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => respond(false)}>
          Tolak
        </button>
      </div>
    </motion.section>
  )
}

function WaitingCard({ session }) {
  const busy = useDate((s) => s.busy)
  return (
    <motion.section className="date-float" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
      <p>
        <strong>{title(session.kind)}</strong> · menunggu jawaban {mateName()}…
      </p>
      <div className="couple-actions">
        <button type="button" className="btn-ghost" disabled={busy} onClick={finish}>
          Batalkan
        </button>
      </div>
    </motion.section>
  )
}

function SessionCard({ session }) {
  const busy = useDate((s) => s.busy)
  const error = useDate((s) => s.error)
  const mateOnline = useCouple((s) => s.mateOnline)
  const [confirm, setConfirm] = useState(false)
  const d = dates[session.kind]
  const dist = distanceTo(session.kind)
  const here = dist <= READY_RADIUS
  const me = iAmReady(session)
  const them = mateReady(session)
  const goThere = () => {
    const p = meetingPoint(session.kind)
    if (p) walkTo(p.x, p.z, 1.2)
  }

  if (session.status === 'interrupted') {
    return (
      <motion.section className="date-float" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
        <p>
          <strong>{d.title}</strong> terhenti karena salah satu dari kalian terputus. Mau lanjut lagi?
        </p>
        <div className="couple-actions">
          <button type="button" className="btn-glow" disabled={busy || !mateOnline} onClick={resume}>
            Lanjutkan
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={finish}>
            Batalkan
          </button>
        </div>
        {!mateOnline && <small>Bisa dilanjutkan saat {mateName()} online lagi.</small>}
      </motion.section>
    )
  }

  if (session.status === 'active') {
    const prompts = d.prompts || []
    const prompt = prompts.length ? prompts[session.step % prompts.length] : null
    const young = Date.now() - new Date(session.started_at).getTime() < 60000
    return (
      <motion.section className="date-float is-active" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
        <span className="eyebrow">
          <Sparkles size={12} /> {d.title}
        </span>
        {prompt && <p className="date-prompt">“{prompt}”</p>}
        {confirm ? (
          <>
            <p className="date-hint">Kencannya baru sebentar, jadi kalau diakhiri sekarang belum tercatat sebagai kenangan. Tetap akhiri?</p>
            <div className="couple-actions">
              <button type="button" className="btn-ghost" disabled={busy} onClick={finish}>
                Ya, akhiri
              </button>
              <button type="button" className="btn-glow" onClick={() => setConfirm(false)}>
                Lanjut kencan
              </button>
            </div>
          </>
        ) : (
          <div className="couple-actions">
            {prompt && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={nextPrompt}>
                Pertanyaan berikutnya
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={() => useStore.getState().setPanel('actions')}>
              <Sparkles size={14} /> Aktivitas
            </button>
            <button type="button" className="btn-glow" disabled={busy} onClick={() => (young ? setConfirm(true) : finish())}>
              Akhiri Kencan
            </button>
          </div>
        )}
      </motion.section>
    )
  }

  // accepted / preparing: on the way, then "Siap"
  return (
    <motion.section className="date-float" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
      <span className="eyebrow">{d.title}</span>
      <p className="date-place">
        <MapPin size={13} /> {d.place}
      </p>
      <ul className="date-who">
        <li className={me ? 'is-ready' : ''}>Kamu: {me ? 'siap ✓' : here ? 'sudah sampai' : Number.isFinite(dist) ? `menuju lokasi (${Math.round(dist)} m)` : 'menuju lokasi'}</li>
        <li className={them ? 'is-ready' : ''}>
          {mateName()}: {them ? 'siap ✓' : mateOnline ? 'belum siap' : 'sedang offline'}
        </li>
      </ul>
      <div className="couple-actions">
        {!here && !me && (
          <button type="button" className="btn-ghost" onClick={goThere}>
            <MapPin size={14} /> Antar ke sana
          </button>
        )}
        {here && !me && (
          <button type="button" className="btn-glow" disabled={busy} onClick={() => setReady(true)}>
            <Check size={15} /> Siap
          </button>
        )}
        {me && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => setReady(false)}>
            Belum siap
          </button>
        )}
        <button type="button" className="btn-ghost" disabled={busy} onClick={finish}>
          Batalkan
        </button>
      </div>
      {error && <p className="couple-error">{error}</p>}
    </motion.section>
  )
}

/** The card for whatever date is open right now (or nothing). */
function DateFloat() {
  useTick()
  const session = useDate((s) => s.session)
  const me = useCouple((s) => s.me?.id)
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  let card = null
  if (session && !isExpired(session) && phase === 'world' && view === 'explore') {
    if (session.status === 'pending') card = session.invitee === me ? <InviteCard key="i" session={session} /> : <WaitingCard key="w" session={session} />
    else card = <SessionCard key="s" session={session} />
  }
  return <AnimatePresence>{card}</AnimatePresence>
}

/* ───────── holding hands ───────── */

function HandFloat() {
  const { state, incoming, leader } = useHand()
  const view = useStore((s) => s.view)
  if (view !== 'explore') return null
  let card = null
  if (incoming && state === 'none') {
    card = (
      <motion.section key="in" className="date-float is-invite hand-float" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} aria-live="polite">
        <p>
          <strong>{mateName()}</strong> ngajak gandengan ♡
        </p>
        <div className="couple-actions">
          <button type="button" className="btn-glow" onClick={acceptHand}>
            <Check size={15} /> Terima
          </button>
          <button type="button" className="btn-ghost" onClick={declineHand}>
            Tolak
          </button>
        </div>
      </motion.section>
    )
  } else if (state === 'inviting' || state === 'joining') {
    card = (
      <motion.section key="wait" className="date-float hand-float" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
        <p>{state === 'inviting' ? `Menunggu ${mateName()} menyambut tanganmu…` : 'Menggandeng…'}</p>
        <div className="couple-actions">
          <button type="button" className="btn-ghost" onClick={() => releaseHand('self')}>
            Batalkan
          </button>
        </div>
      </motion.section>
    )
  } else if (state === 'holding') {
    card = (
      <motion.section key="hold" className="date-float hand-float is-holding" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
        <p>
          🤝 Bergandengan dengan {mateName()}
          {!leader && <small> · kamu ikut langkahnya</small>}
        </p>
        <button type="button" className="btn-ghost" onClick={() => releaseHand('self')}>
          Lepas Gandengan
        </button>
      </motion.section>
    )
  }
  return <AnimatePresence>{card}</AnimatePresence>
}

/* ───────── Kenangan Kita ───────── */

function MemoryRow({ row }) {
  const [note, setNote] = useState(row.note || '')
  const [state, setState] = useState(null)
  useEffect(() => setNote(row.note || ''), [row.note])
  return (
    <li className="date-memory">
      <div>
        <strong>{title(row.kind)}</strong>
        <small>{when(row.completed_at)}</small>
      </div>
      {row.keepsake && <p className="date-keepsake">🎁 {dates.keepsakes?.[row.keepsake] || row.keepsake}</p>}
      <textarea className="bottle-write" rows={2} maxLength={300} value={note} placeholder="Tulis catatan kecil tentang kencan ini…" onChange={(e) => setNote(e.target.value)} />
      <div className="couple-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={note === (row.note || '')}
          onClick={async () => {
            const r = await saveNote(row.id, note)
            setState(r.ok ? 'Tersimpan ✓' : 'Belum tersimpan.')
          }}
        >
          Simpan catatan
        </button>
        {state && <small>{state}</small>}
      </div>
    </li>
  )
}

function MemoriesSheet({ onClose }) {
  const { status, history, error } = useDate()
  return (
    <Sheet label="Kenangan Kita" onClose={onClose} wide>
      <span className="eyebrow">Kenangan Kita</span>
      <h2>Kencan-kencan kita</h2>
      {status === 'error' ? (
        <p className="couple-error">{error}</p>
      ) : status !== 'ready' ? (
        <p className="couple-status">Sebentar…</p>
      ) : history.length === 0 ? (
        <p className="couple-status">Belum ada kencan yang selesai. Kencan pertama kalian nanti tersimpan di sini ♡</p>
      ) : (
        <ul className="date-memories">
          {history.map((row) => (
            <MemoryRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Sheet>
  )
}

function LetterSheet({ onClose }) {
  return (
    <Sheet label="Surat" onClose={onClose}>
      <span className="eyebrow">Untukmu</span>
      <p className="bottle-body">{dates.lakeLetter}</p>
    </Sheet>
  )
}

/* ───────── the two buttons ───────── */

function CoupleBar() {
  const status = useCouple((s) => s.status)
  const session = useDate((s) => s.session)
  const panel = useStore((s) => s.panel)
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  const setPanel = useStore((s) => s.setPanel)
  const card = session && !isExpired(session)
  if (status !== 'connected' || phase !== 'world' || view !== 'explore' || panel || card) return null
  return (
    <div className="couple-bar">
      <button type="button" onClick={() => setPanel('actions')}>
        <Sparkles size={15} /> Aktivitas
      </button>
      <button type="button" onClick={() => setPanel('date')}>
        <Heart size={15} /> Virtual Date
      </button>
    </div>
  )
}

export default function DatePanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  // a call from the other person: a gentle toast, once
  useEffect(() => {
    const onCall = (e) => useStore.getState().showToast(e.detail?.seat ? `${mateName()} mengajakmu duduk bareng ♡` : `${mateName()} memanggilmu ♡`, 4500)
    window.addEventListener('couple:call', onCall)
    return () => window.removeEventListener('couple:call', onCall)
  }, [])
  if (!coupleAvailable) return null
  const close = () => setPanel(null)
  return (
    <>
      <CoupleBar />
      <div className="top-stack">
        <DateFloat />
        <HandFloat />
        <SkyCards />
      </div>
      <AnimatePresence>
        {panel === 'actions' && <ActionsSheet key="a" onClose={close} />}
        {panel === 'date' && <DateSheet key="d" onClose={close} />}
        {panel === 'date-memories' && <MemoriesSheet key="m" onClose={close} />}
        {panel === 'date-letter' && <LetterSheet key="l" onClose={close} />}
      </AnimatePresence>
    </>
  )
}
