import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, LogOut, Mail, Send, X } from 'lucide-react'
import { coupleAvailable, openLetter, sendLetter, signIn, signOut, useCouple } from '../../lib/couple'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { nameFor } from '../three/CoupleWorld'

/*
 * PLAYING TOGETHER — the screens: sign in, the friendly "this world is private" screen,
 * and the letters in a bottle (write one, read the ones that washed up).
 * Nothing here decides who may enter — the server does (lib/couple.js).
 */

function Sheet({ label, onClose, children }) {
  return (
    <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel couple-panel" role="dialog" aria-modal="true" aria-label={label} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  )
}

/** Sign in, or see who's here. */
function CoupleSheet({ onClose }) {
  const { status, me, mate, mateOnline, error } = useCouple()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    await signIn(email, password)
    setBusy(false)
  }
  return (
    <Sheet label="Main berdua" onClose={onClose}>
      <span className="eyebrow">Main berdua ♡</span>
      {status === 'connected' ? (
        <>
          <h2>Halo, {nameFor(me.role)} ♡</h2>
          <p className="couple-status">
            {!mate ? 'Pasanganmu belum terdaftar di ruang ini.' : mateOnline ? `${nameFor(mate.role)} lagi ada di pulau sekarang ✦` : `${nameFor(mate.role)} sedang nggak online. Kamu tetap bisa kirim surat dalam botol.`}
          </p>
          <div className="couple-actions">
            {mate && (
              <button type="button" className="btn-glow" onClick={() => useStore.getState().setPanel('letters')}>
                <Mail size={16} /> Surat dalam botol
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={signOut}>
              <LogOut size={15} /> Keluar
            </button>
          </div>
        </>
      ) : status === 'denied' ? (
        <>
          <h2>Dunia kecil ini privat 🤍</h2>
          <p className="couple-status">Ruang main berdua ini cuma untuk dua orang, dan akun ini nggak termasuk. Kamu tetap bisa jalan-jalan sendiri di pulau, kok.</p>
          <button type="button" className="btn-ghost" onClick={signOut}>
            <LogOut size={15} /> Keluar
          </button>
        </>
      ) : status === 'checking' ? (
        <p className="couple-status">Sebentar, lagi ngecek…</p>
      ) : (
        <form className="couple-form" onSubmit={submit}>
          <h2>Masuk ke ruang kita</h2>
          <p className="couple-status">Ruang ini privat, cuma untuk kita berdua. Masuk pakai akunmu sendiri.</p>
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="couple-error">{error}</p>}
          <button type="submit" className="btn-glow" disabled={busy}>
            <Heart size={15} /> {busy ? 'Masuk…' : 'Masuk'}
          </button>
        </form>
      )}
    </Sheet>
  )
}

const when = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

/** Write a letter, or read one. */
function LettersSheet({ onClose }) {
  const { me, mate, letters, reading } = useCouple()
  const [text, setText] = useState('')
  const [state, setState] = useState(null)
  const open = useMemo(() => letters.find((l) => l.id === reading) || null, [letters, reading])
  useEffect(() => {
    if (open && open.recipient === me?.id && !open.opened_at) openLetter(open.id)
  }, [open, me])
  const send = async () => {
    setState('sending')
    const r = await sendLetter(text)
    if (r.ok) {
      setText('')
      setState('sent')
      audio.sfx('water')
      window.dispatchEvent(new Event('couple:sent'))
    } else setState(r.error || 'Botolnya belum bisa dikirim.')
  }
  const close = () => {
    useCouple.setState({ reading: null })
    onClose()
  }
  if (!me) return null
  const mateName = mate ? nameFor(mate.role) : 'dia'
  return (
    <Sheet label="Surat dalam botol" onClose={close}>
      {open ? (
        <article className="bottle-letter">
          <span className="eyebrow">{open.sender === me.id ? `Suratmu untuk ${mateName}` : `Surat dari ${mateName}`}</span>
          <p className="bottle-date">{when(open.created_at)}</p>
          <p className="bottle-body">{open.body}</p>
          <button type="button" className="btn-ghost" onClick={() => useCouple.setState({ reading: null })}>
            Kembali
          </button>
        </article>
      ) : (
        <>
          <span className="eyebrow">Surat dalam botol</span>
          <h2>Untuk {mateName}</h2>
          <textarea className="bottle-write" maxLength={1000} rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Tulis sesuatu buat ${mateName}… botolnya bakal hanyut lewat sungai sampai ke danaunya.`} />
          <div className="couple-actions">
            <button type="button" className="btn-glow" disabled={!text.trim() || state === 'sending'} onClick={send}>
              <Send size={15} /> {state === 'sending' ? 'Mengirim…' : 'Hanyutkan botolnya'}
            </button>
            <small>{text.length}/1000</small>
          </div>
          {state === 'sent' && <p className="couple-status">Botolnya udah hanyut ✦ {mateName} bakal nemu di danau.</p>}
          {state && !['sending', 'sent'].includes(state) && <p className="couple-error">{state}</p>}
          {letters.length > 0 && (
            <>
              <h3 className="bottle-list-title">Surat-surat kita</h3>
              <ul className="bottle-list">
                {letters.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => useCouple.setState({ reading: l.id })}>
                      <span>{l.sender === me.id ? `Untuk ${mateName}` : `Dari ${mateName}`}</span>
                      <small>
                        {when(l.created_at)}
                        {l.recipient === me.id && !l.opened_at ? ' · belum dibuka' : ''}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}

/** The two panels, plus a little toast when a new bottle washes up. */
export default function CouplePanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  useEffect(() => {
    const onBottle = () => useStore.getState().showToast('Ada botol surat baru yang hanyut ke danau… 🍾', 5000)
    window.addEventListener('couple:bottle', onBottle)
    return () => window.removeEventListener('couple:bottle', onBottle)
  }, [])
  if (!coupleAvailable) return null
  return (
    <AnimatePresence>
      {panel === 'couple' && <CoupleSheet key="c" onClose={() => setPanel(null)} />}
      {panel === 'letters' && <LettersSheet key="l" onClose={() => setPanel(null)} />}
    </AnimatePresence>
  )
}
