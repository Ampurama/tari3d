import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Hammer, Home, Paintbrush, RotateCw, Trash2, X } from 'lucide-react'
import { coupleAvailable, useCouple } from '../../lib/couple'
import {
  cancelDraft,
  loadHome,
  mateName,
  pickKind,
  placeDraft,
  removeDraft,
  rotateDraft,
  saveMemory,
  startEditing,
  stopEditing,
  upgradeHome,
  useHome,
} from '../../lib/home'
import { CATALOG, KINDS, STAGES } from '../../lib/homeLayout'
import { useStore } from '../../store'
import { useDate } from '../../lib/date'
import { dates } from '../../content/config'
import { audio } from '../../audio/engine'

/*
 * OUR LITTLE HOME — the screens: "Rumah Kita" (stages, building, the memory corner),
 * the two small buttons that appear on the home island, and the decorating bar.
 * Nothing here decides who may build — the server does (lib/home.js, 002_our_home.sql).
 */

function Sheet({ onClose, children }) {
  return (
    <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel couple-panel home-panel" role="dialog" aria-modal="true" aria-label="Rumah Kita" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  )
}

/** The little form for the memory corner. */
function MemoryForm() {
  const memory = useHome((s) => s.memory)
  const saving = useHome((s) => s.saving)
  const isOwner = useCouple((s) => s.me?.role === 'owner')
  const [title, setTitle] = useState(memory.title)
  const [date, setDate] = useState(memory.date || '')
  const [note, setNote] = useState(memory.note)
  const [state, setState] = useState(null)
  // pick up changes the other person saved
  useEffect(() => {
    setTitle(memory.title)
    setDate(memory.date || '')
    setNote(memory.note)
  }, [memory.title, memory.date, memory.note])
  const save = async (e) => {
    e.preventDefault()
    const r = await saveMemory({ title, date, note }, isOwner)
    setState(r.ok ? 'Tersimpan ✓' : r.error)
  }
  return (
    <form className="couple-form home-memory" onSubmit={save}>
      <h3>Pojok kenangan</h3>
      <label>
        Judul
        <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Misalnya: Rumah kecil kita" />
      </label>
      <label>
        Tanggal spesial
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!isOwner} />
        {!isOwner && <small>Tanggal ini dipilih oleh {mateName()}.</small>}
      </label>
      <label>
        Pesan kecil
        <textarea className="bottle-write" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tulis sesuatu untuk dipajang di bingkai…" />
      </label>
      <div className="couple-actions">
        <button type="submit" className="btn-glow" disabled={saving}>
          <Check size={15} /> {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </button>
        {state && <small>{state}</small>}
      </div>
    </form>
  )
}

/** "Rumah Kita": where the house is at, and what's next. */
function HomeSheet({ onClose }) {
  const coupleStatus = useCouple((s) => s.status)
  const { status, stage, items, error, saving } = useHome()
  const [message, setMessage] = useState(null)
  const counts = Object.values(items).reduce((a, it) => ((a[it.area] = (a[it.area] || 0) + 1), a), {})
  const next = STAGES[stage] // the stage after this one (STAGES is 0-based)
  const ready = !next ? false : stage === 1 || (stage === 2 && (counts.inside || 0) >= 3) || (stage === 3 && (counts.garden || 0) >= 2) || stage === 4
  const build = async () => {
    setMessage(null)
    const r = await upgradeHome()
    if (r.ok) audio.sparkle()
    else setMessage(r.error)
  }
  const decorate = () => {
    onClose()
    startEditing()
  }

  let body
  if (coupleStatus !== 'connected') {
    body = (
      <>
        <h2>Rumah ini milik kalian berdua</h2>
        <p className="couple-status">Masuk ke &ldquo;Main berdua&rdquo; dulu, ya. Rumahnya cuma bisa dibangun dan dihias oleh kalian berdua.</p>
        <button type="button" className="btn-glow" onClick={() => useStore.getState().setPanel('couple')}>
          Main berdua ♡
        </button>
      </>
    )
  } else if (status === 'loading' || status === 'off') {
    body = <p className="couple-status">Sebentar, lagi buka pintunya…</p>
  } else if (status === 'error') {
    body = (
      <>
        <p className="couple-error">{error}</p>
        <button type="button" className="btn-ghost" onClick={loadHome}>
          Coba lagi
        </button>
      </>
    )
  } else {
    body = (
      <>
        <h2>{STAGES[stage - 1].title}</h2>
        <p className="couple-status">{STAGES[stage - 1].text}</p>
        <ol className="home-stages">
          {STAGES.map((s) => (
            <li key={s.n} className={s.n < stage ? 'is-done' : s.n === stage ? 'is-now' : ''}>
              <span>{s.n <= stage ? '♥' : s.n}</span>
              {s.title}
            </li>
          ))}
        </ol>
        {next && (
          <div className="home-next">
            <p>
              <strong>Berikutnya: {next.title}.</strong> {next.need || 'Siap dibangun kapan pun kalian mau.'}
              {stage === 2 && ` (${counts.inside || 0}/3)`}
              {stage === 3 && ` (${counts.garden || 0}/2)`}
            </p>
            <button type="button" className="btn-glow" disabled={!ready || saving} onClick={build}>
              <Hammer size={15} /> {stage === 1 ? 'Bangun Rumah' : `Lanjut ke tahap ${stage + 1}`}
            </button>
          </div>
        )}
        {message && <p className="couple-error">{message}</p>}
        {stage >= 2 && (
          <div className="couple-actions">
            <button type="button" className="btn-ghost" onClick={decorate}>
              <Paintbrush size={15} /> Dekorasi
            </button>
          </div>
        )}
        {stage >= 4 && <MemoryForm />}
      </>
    )
  }
  return (
    <Sheet onClose={onClose}>
      <span className="eyebrow">Rumah Kita ♡</span>
      {body}
    </Sheet>
  )
}

/** Two small buttons while she's on the home island. */
function HomeButtons() {
  const near = useHome((s) => s.near)
  const editing = useHome((s) => s.editing)
  const status = useHome((s) => s.status)
  const stage = useHome((s) => s.stage)
  const panel = useStore((s) => s.panel)
  const talking = useStore((s) => Boolean(s.dialog))
  const show = near && !editing && !panel && !talking
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="home-buttons" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
          <button type="button" onClick={() => useStore.getState().setPanel('home')}>
            <Home size={16} /> Rumah Kita
          </button>
          {status === 'ready' && stage >= 2 && (
            <button type="button" onClick={startEditing}>
              <Paintbrush size={16} /> Dekorasi Rumah
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** The decorating bar: the catalog, then Putar / Tempatkan / Batalkan for what she's holding. */
function EditBar() {
  const { editing, draft, saving, notice, stage } = useHome()
  const keepsakes = useDate((s) => s.keepsakes)
  const [tab, setTab] = useState('inside')
  if (!editing) return null
  const kinds = KINDS.filter((k) => CATALOG[k].area === tab)
  const status = draft ? (draft.ok ? (saving ? 'Menyimpan…' : 'Pas! Tekan "Tempatkan".') : draft.reason) : notice?.text || 'Pilih barang, lalu ketuk lantai atau taman. Ketuk barang yang sudah ada untuk memindahkannya.'
  const bad = draft ? !draft.ok : notice?.bad
  return (
    <motion.div className="home-edit" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="home-edit-top">
        <p className={bad ? 'is-bad' : ''} aria-live="polite">
          {status}
        </p>
        <button type="button" className="btn-ghost" onClick={stopEditing}>
          Selesai
        </button>
      </div>
      {draft ? (
        <div className="home-edit-actions">
          <span className="home-edit-holding">
            {CATALOG[draft.kind].icon} {CATALOG[draft.kind].label}
          </span>
          {CATALOG[draft.kind].layer !== 'wall' && (
            <button type="button" onClick={rotateDraft} disabled={saving}>
              <RotateCw size={16} /> Putar
            </button>
          )}
          <button type="button" className="is-main" onClick={placeDraft} disabled={!draft.ok || saving}>
            <Check size={16} /> Tempatkan
          </button>
          {!draft.isNew && (
            <button type="button" onClick={removeDraft} disabled={saving}>
              <Trash2 size={16} /> Hapus
            </button>
          )}
          <button type="button" onClick={cancelDraft} disabled={saving}>
            <X size={16} /> Batalkan
          </button>
        </div>
      ) : (
        <>
          <div className="home-edit-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'inside'} className={tab === 'inside' ? 'is-on' : ''} onClick={() => setTab('inside')}>
              Dalam rumah
            </button>
            <button type="button" role="tab" aria-selected={tab === 'garden'} className={tab === 'garden' ? 'is-on' : ''} onClick={() => setTab('garden')}>
              Taman {stage < 3 && '🔒'}
            </button>
          </div>
          <div className="home-catalog">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                title={CATALOG[k].keepsake && !keepsakes[k] ? `Didapat dari kencan ${dates[CATALOG[k].keepsake]?.title}` : undefined}
                disabled={(tab === 'garden' && stage < 3) || (CATALOG[k].keepsake && !keepsakes[k])}
                onClick={() => {
                  audio.sparkle()
                  pickKind(k)
                }}
              >
                <span aria-hidden="true">{CATALOG[k].icon}</span>
                {CATALOG[k].label}
                {CATALOG[k].keepsake && !keepsakes[k] && ' 🔒'}
              </button>
            ))}
          </div>
          {tab === 'garden' && stage < 3 && <p className="home-edit-note">Dekorasi taman terbuka di tahap 3.</p>}
        </>
      )}
    </motion.div>
  )
}

export default function HomePanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  if (!coupleAvailable) return null
  return (
    <>
      <AnimatePresence>{panel === 'home' && <HomeSheet key="home" onClose={() => setPanel(null)} />}</AnimatePresence>
      <HomeButtons />
      <EditBar />
    </>
  )
}
