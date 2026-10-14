import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Home, PawPrint, X } from 'lucide-react'
import { coupleAvailable, useCouple } from '../../lib/couple'
import { mateName } from '../../lib/home'
import { ACCESSORIES, adopt, command, PET_KINDS, petAct, rename, setAccessory, usePet } from '../../lib/pet'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * ADOPT A PET — the screens: "Adopsi Peliharaan" (choose, name, adopt), the pet's little card
 * (name, accessory, who it's following), and the buttons that appear when you're near it.
 */

function Sheet({ onClose, children }) {
  return (
    <motion.div className="panel-backdrop is-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel couple-panel date-panel" role="dialog" aria-modal="true" aria-label="Peliharaan" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  )
}

function AdoptForm() {
  const busy = usePet((s) => s.busy)
  const error = usePet((s) => s.error)
  const [kind, setKind] = useState('cat')
  const [name, setName] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    const r = await adopt(kind, name)
    if (r.ok) audio.sparkle()
  }
  return (
    <form className="couple-form" onSubmit={submit}>
      <h2>Adopsi Peliharaan</h2>
      <p className="couple-status">Satu teman kecil untuk rumah kalian berdua. Dia akan tinggal di dekat rumah dan bisa diajak jalan-jalan.</p>
      <fieldset className="pet-kinds">
        <legend>Pilih Hewan</legend>
        {Object.entries(PET_KINDS).map(([k, v]) => (
          <button key={k} type="button" className={kind === k ? 'is-on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
            <span aria-hidden="true">{v.icon}</span> {v.label}
          </button>
        ))}
      </fieldset>
      <label>
        Nama Peliharaan
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Misalnya: Kopi" required />
      </label>
      {error && <p className="couple-error">{error}</p>}
      <button type="submit" className="btn-glow" disabled={busy || !name.trim()}>
        <Heart size={15} /> {busy ? 'Menyimpan…' : 'Adopsi'}
      </button>
    </form>
  )
}

function PetCard() {
  const pet = usePet((s) => s.pet)
  const busy = usePet((s) => s.busy)
  const error = usePet((s) => s.error)
  const me = useCouple((s) => s.me?.id)
  const [name, setName] = useState(pet.name)
  const [saved, setSaved] = useState(null)
  useEffect(() => setName(pet.name), [pet.name])
  const following = pet.mode === 'follow' ? (pet.follow_target === me ? 'kamu' : mateName()) : null
  return (
    <>
      <h2>
        {PET_KINDS[pet.kind]?.icon} {pet.name}
      </h2>
      <p className="couple-status">
        {PET_KINDS[pet.kind]?.label} kalian, diadopsi {new Date(pet.adopted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.{' '}
        {following ? `Sekarang lagi ikut ${following}.` : 'Sekarang lagi santai di dekat rumah.'}
      </p>
      <form
        className="couple-form"
        onSubmit={async (e) => {
          e.preventDefault()
          const r = await rename(name)
          setSaved(r.ok ? 'Tersimpan ✓' : null)
        }}
      >
        <label>
          Nama Peliharaan
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="couple-actions">
          <button type="submit" className="btn-ghost" disabled={busy || !name.trim() || name.trim() === pet.name}>
            Simpan nama
          </button>
          {saved && <small>{saved}</small>}
        </div>
      </form>
      <fieldset className="pet-kinds">
        <legend>Aksesori</legend>
        {Object.entries(ACCESSORIES).map(([k, label]) => (
          <button key={k} type="button" className={pet.accessory === k ? 'is-on' : ''} aria-pressed={pet.accessory === k} disabled={busy} onClick={() => setAccessory(k)}>
            {label}
          </button>
        ))}
      </fieldset>
      <p className="date-hint">Mau tempat tidur khusus? Tambahkan “Kasur peliharaan” lewat Dekorasi Rumah. Di mana pun kasurnya ditaruh, di situ rumahnya.</p>
      {error && <p className="couple-error">{error}</p>}
    </>
  )
}

function PetSheet({ onClose }) {
  const status = usePet((s) => s.status)
  const pet = usePet((s) => s.pet)
  const error = usePet((s) => s.error)
  const coupleStatus = useCouple((s) => s.status)
  return (
    <Sheet onClose={onClose}>
      <span className="eyebrow">Peliharaan</span>
      {coupleStatus !== 'connected' ? (
        <p className="couple-status">Peliharaan kalian berdua tinggal di “Main berdua”. Masuk dulu, ya.</p>
      ) : status === 'error' ? (
        <p className="couple-error">{error}</p>
      ) : status !== 'ready' ? (
        <p className="couple-status">Sebentar…</p>
      ) : pet ? (
        <PetCard />
      ) : (
        <AdoptForm />
      )}
    </Sheet>
  )
}

/** Buttons that appear while she's next to the pet. */
function PetBar() {
  const near = usePet((s) => s.near)
  const pet = usePet((s) => s.pet)
  const busy = usePet((s) => s.busy)
  const me = useCouple((s) => s.me?.id)
  const panel = useStore((s) => s.panel)
  const view = useStore((s) => s.view)
  if (!near || !pet || panel || view !== 'explore') return null
  const followingMe = pet.mode === 'follow' && pet.follow_target === me
  return (
    <div className="pet-bar" onPointerDown={(e) => e.stopPropagation()}>
      <span className="pet-bar-name">
        {PET_KINDS[pet.kind]?.icon} {pet.name}
      </span>
      <button
        type="button"
        onClick={() => {
          audio.sfx('squeak', 1)
          petAct('pet')
        }}
      >
        <Heart size={14} /> Elus
      </button>
      {!followingMe && (
        <button type="button" disabled={busy} onClick={() => command('follow')}>
          <PawPrint size={14} /> Ajak Ikut
        </button>
      )}
      <button type="button" onClick={() => petAct('sit')}>
        Duduk
      </button>
      {pet.mode === 'follow' && (
        <button type="button" disabled={busy} onClick={() => command('home')}>
          <Home size={14} /> Kembali ke Rumah
        </button>
      )}
      <button type="button" onClick={() => useStore.getState().setPanel('pet')}>
        Info
      </button>
    </div>
  )
}

export default function PetPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  if (!coupleAvailable) return null
  return (
    <>
      <PetBar />
      <AnimatePresence>{panel === 'pet' && <PetSheet key="pet" onClose={() => setPanel(null)} />}</AnimatePresence>
    </>
  )
}
