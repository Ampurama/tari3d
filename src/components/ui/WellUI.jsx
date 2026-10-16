import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookHeart, Lock, PenLine, X } from 'lucide-react'
import {
  addDays,
  answerWish,
  canWithdraw,
  checkWish,
  closeWish,
  daysUntil,
  dayText,
  isMine,
  makeWish,
  nameOf,
  newDraft,
  readWish,
  STATE_LABELS,
  timeText,
  todayWita,
  useWishes,
  WISH_KINDS,
  WISH_MAX,
  wishState,
  withdrawWish,
  withMate,
} from '../../lib/wishes'
import { coupleAvailable, useCouple } from '../../lib/couple'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * THE WELL OF WISHES — the screens (lib/wishes.js): write a wish (its kind, the day it may be
 * opened again), and the Book of Wishes (all you may see, a filter, each one's state, reading it
 * when its day has come, saying yes to a dream together).
 */

const kindLabel = (k) => withMate(WISH_KINDS[k].label)

/** Writing a wish. */
function WriteTab({ onDone }) {
  const busy = useWishes((s) => s.busy === 'make')
  const mate = useCouple((s) => s.mate)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('pribadi')
  const [dated, setDated] = useState(false)
  const [openOn, setOpenOn] = useState(() => addDays(todayWita(), 30))
  const [error, setError] = useState(null)
  const min = addDays(todayWita(), 1)
  const max = addDays(todayWita(), 3650)
  const problem = checkWish({ text, category, openOn: dated ? openOn : null })
  const submit = async (e) => {
    e.preventDefault()
    if (problem) return setError(problem)
    setError(null)
    const r = await makeWish({ text, category, openOn: dated ? openOn : null })
    if (!r.ok) return setError(r.error)
    audio.sparkle()
    setText('')
    newDraft()
    onDone(r.wish)
  }
  return (
    <form className="well-form" onSubmit={submit}>
      <fieldset className="well-kinds">
        <legend>Jenis harapan</legend>
        {Object.entries(WISH_KINDS).map(([k, v]) => {
          const needsMate = k !== 'pribadi' && !mate
          return (
            <label key={k} className={`well-kind${category === k ? ' is-on' : ''}${needsMate ? ' is-off' : ''}`} style={{ '--kind': v.color }}>
              <input type="radio" name="kind" value={k} checked={category === k} disabled={needsMate} onChange={() => setCategory(k)} />
              <span aria-hidden="true">{v.icon}</span>
              <strong>{withMate(v.label)}</strong>
              <small>{withMate(v.hint)}</small>
            </label>
          )
        })}
      </fieldset>
      <label className="well-text">
        <span>Tulis harapan atau pesanmu</span>
        <textarea value={text} maxLength={WISH_MAX + 50} rows={5} onChange={(e) => setText(e.target.value)} placeholder={category === 'pasangan' ? 'Untukmu di masa depan…' : 'Aku berharap…'} />
        <small className={text.trim().length > WISH_MAX ? 'is-bad' : ''} aria-live="polite">
          {text.trim().length}/{WISH_MAX}
        </small>
      </label>
      <label className="well-date-toggle">
        <input type="checkbox" checked={dated} onChange={(e) => setDated(e.target.checked)} /> Kunci sampai tanggal tertentu
      </label>
      {dated && (
        <label className="well-date">
          <span>Boleh dibuka kembali mulai</span>
          <input type="date" value={openOn} min={min} max={max} onChange={(e) => setOpenOn(e.target.value)} required />
          <small>Tanggal mengikuti waktu server (WITA). Sebelum hari itu, harapan ini tidak bisa dibuka, bahkan olehmu.</small>
        </label>
      )}
      {error && (
        <p className="couple-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-glow" disabled={busy || Boolean(problem)}>
        {busy ? 'Menyimpan…' : category === 'bersama' ? `Ajak ${withMate('{mate}')} menyimpannya 💞` : 'Masukkan ke sumur ✨'}
      </button>
      <p className="well-note">Sumur ini menyimpan harapan kalian dengan aman, untuk dibaca dan dikenang lagi nanti ♡</p>
    </form>
  )
}

const FILTERS = [
  ['semua', 'Semua'],
  ['pribadi', 'Pribadi'],
  ['bersama', 'Bersama'],
  ['pasangan', 'Pesan'],
]

/** One wish, opened from the book. */
function Detail({ w, onBack }) {
  const open = useWishes((s) => (s.open?.id === w.id ? s.open : null))
  const busy = useWishes((s) => s.busy === w.id)
  const [msg, setMsg] = useState(null)
  const state = wishState(w)
  const mine = isMine(w)
  const locked = state === 'terkunci'
  const waitingForMe = state === 'menunggu' && !mine
  useEffect(() => () => closeWish(), [])
  const answer = async (yes) => {
    const r = await answerWish(w.id, yes)
    if (!r.ok) setMsg(r.error)
    else if (yes) audio.sparkle()
  }
  const withdraw = async () => {
    if (!window.confirm('Ambil kembali harapan ini dari sumur? Ini tidak bisa dibatalkan.')) return
    const r = await withdrawWish(w.id)
    if (r.ok) onBack()
    else setMsg(r.error)
  }
  return (
    <div className="well-detail">
      <button type="button" className="btn-ghost well-back" onClick={onBack}>
        <ArrowLeft size={15} /> Kembali ke buku
      </button>
      <p className="well-detail-meta">
        <span aria-hidden="true">{WISH_KINDS[w.category].icon}</span> {kindLabel(w.category)} · dari <strong>{mine ? 'kamu' : nameOf(w.author)}</strong> · {timeText(w.created_at)}
      </p>
      <p className={`well-badge is-${state}`}>{STATE_LABELS[state]}</p>
      {w.open_on && (
        <p className="well-detail-date">
          {locked ? (
            <>
              <Lock size={14} /> Terkunci sampai {dayText(w.open_on)} · {daysUntil(w.open_on)} hari lagi
            </>
          ) : (
            <>Boleh dibuka sejak {dayText(w.open_on)}{w.opened_at ? ` · dibuka kembali ${timeText(w.opened_at)}` : ''}</>
          )}
        </p>
      )}
      {open?.body ? (
        <motion.blockquote className="well-paper" initial={{ opacity: 0, y: 10, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}>
          {open.body}
        </motion.blockquote>
      ) : locked ? (
        <p className="well-locked">Kertasnya masih terlipat rapi di dasar sumur. Sampai jumpa pada {dayText(w.open_on)} ✦</p>
      ) : (
        <button type="button" className="btn-glow" disabled={busy} onClick={() => readWish(w.id)}>
          {busy ? 'Membuka…' : 'Buka & baca'}
        </button>
      )}
      {open?.error && <p className="couple-error">{open.error}</p>}
      {waitingForMe && (
        <div className="couple-actions">
          <button type="button" className="btn-glow" disabled={busy} onClick={() => answer(true)}>
            Setuju, simpan bersama 💞
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => answer(false)}>
            Belum setuju
          </button>
        </div>
      )}
      {state === 'menunggu' && mine && <p className="well-note">Menunggu {nameOf(useCouple.getState().mate?.id)} setuju ♡</p>}
      {canWithdraw(w) && (
        <button type="button" className="btn-ghost well-withdraw" disabled={busy} onClick={withdraw}>
          Ambil kembali
        </button>
      )}
      {msg && <p className="couple-error">{msg}</p>}
    </div>
  )
}

/** The Book of Wishes. */
function BookTab({ focus }) {
  const list = useWishes((s) => s.list)
  const [filter, setFilter] = useState('semua')
  const [openId, setOpenId] = useState(focus || null)
  const shown = useMemo(() => list.filter((w) => filter === 'semua' || w.category === filter), [list, filter])
  const current = openId && list.find((w) => w.id === openId)
  return (
    <motion.div className="well-book" initial={{ rotateY: -70, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}>
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div key="detail" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <Detail w={current} onBack={() => setOpenId(null)} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
            <div className="well-filters" role="tablist" aria-label="Saring harapan">
              {FILTERS.map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>
                  {label}
                </button>
              ))}
            </div>
            {shown.length ? (
              <ul className="well-list">
                {shown.map((w) => {
                  const state = wishState(w)
                  return (
                    <li key={w.id}>
                      <button type="button" onClick={() => setOpenId(w.id)} style={{ '--kind': WISH_KINDS[w.category].color }}>
                        <span className="well-list-icon" aria-hidden="true">
                          {state === 'terkunci' ? '🔒' : WISH_KINDS[w.category].icon}
                        </span>
                        <span className="well-list-text">
                          <strong>{kindLabel(w.category)}</strong>
                          <small>
                            {isMine(w) ? 'Kamu' : nameOf(w.author)} · {timeText(w.created_at)}
                            {w.open_on ? ` · dibuka ${dayText(w.open_on)}` : ''}
                          </small>
                        </span>
                        <span className={`well-badge is-${state}`}>{state === 'menunggu' && !isMine(w) ? 'Menunggumu' : STATE_LABELS[state]}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="well-empty">{list.length ? 'Belum ada harapan jenis ini.' : 'Bukunya masih kosong. Tulis harapan pertamamu ✨'}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function WellSheet({ onClose }) {
  const status = useWishes((s) => s.status)
  const list = useWishes((s) => s.list)
  const connected = useCouple((s) => s.status === 'connected')
  const myId = useCouple((s) => s.me?.id)
  const waiting = list.filter((w) => w.status === 'menunggu' && w.author !== myId).length
  const [tab, setTab] = useState(waiting ? 'book' : 'write')
  const [focus, setFocus] = useState(null)
  let body
  if (!coupleAvailable || !connected) body = <p className="couple-status">Masuk dulu ke ruang berdua, ya. Harapan disimpan dengan aman di server, jadi tetap ada saat kamu kembali di hari lain.</p>
  else if (status === 'missing') body = <p className="couple-error">Sumur Harapan butuh <code>012_wishing_well.sql</code> dijalankan di Supabase dulu.</p>
  else if (status === 'error') body = <p className="couple-error">Buku harapan belum bisa dimuat. Periksa koneksi, lalu buka lagi.</p>
  else if (status !== 'ready') body = <p className="couple-status">Membuka sumur…</p>
  else if (tab === 'write')
    body = (
      <WriteTab
        onDone={(w) => {
          if (w.status === 'menunggu') {
            useStore.getState().showToast(`💞 Impian bersama menunggu persetujuan ${nameOf(useCouple.getState().mate?.id)}.`, 4200)
            setFocus(w.id)
            setTab('book')
          } else {
            useStore.getState().showToast('✨ Harapanmu sudah masuk ke sumur.', 3600)
            onClose() // so the paper can be seen flying in
          }
        }}
      />
    )
  else body = <BookTab focus={focus} />
  return (
    <motion.div className="panel-backdrop is-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel couple-panel date-panel is-wide well-panel" role="dialog" aria-modal="true" aria-label="Sumur Harapan" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        <h2>Sumur Harapan</h2>
        <p className="couple-status">Tulis harapan, impian, atau pesan untuk masa depan, lalu biarkan sumur menyimpannya.</p>
        {status === 'ready' && connected && (
          <div className="well-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>
              <PenLine size={15} /> Tulis harapan
            </button>
            <button type="button" role="tab" aria-selected={tab === 'book'} className={tab === 'book' ? 'is-on' : ''} onClick={() => (setFocus(null), setTab('book'))}>
              <BookHeart size={15} /> Buku Harapan {waiting > 0 && <span className="well-count">{waiting}</span>}
            </button>
          </div>
        )}
        {body}
      </motion.div>
    </motion.div>
  )
}

export default function WellUI() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  return <AnimatePresence>{panel === 'well' && <WellSheet key="well" onClose={() => setPanel(null)} />}</AnimatePresence>
}
