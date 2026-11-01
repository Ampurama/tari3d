import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  chooseEnding,
  closePanel,
  has,
  hasItem,
  isShared,
  itemCount,
  ITEM_IDS,
  ITEMS,
  leaveHide,
  leaveMansion,
  onRunChange,
  openPanel,
  resetRun,
  setWheel,
  SYMBOLS,
  SYMBOL_NAMES,
  tryCode,
  useMansion,
} from '../../lib/mansion'
import { INTENSITY, INTENSITY_LABEL, setHauntPref, skipScare, useHaunt, useScareFx } from '../../lib/mansionGhosts'
import { BOOK, BOSS, CHAPTERS, CHOICE, DIARY, ENDINGS, ITEM_TOASTS, STEP_TOASTS } from '../../lib/mansionStory'
import { coupleAvailable, useCouple } from '../../lib/couple'
import { mateName } from '../../lib/home'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * THE HAUNTED GNOME MANSION — its screens: the quest card (chapter, goals, the four heirlooms, how
 * scary, leaving), the diary and the mysterious book, the symbol wheels, the safe's keypad, the
 * mirror's reflection and the ending's choice; a little "skip" for a scare on screen and a card
 * while she hides in a wardrobe. It also tells the story as the shared run changes (on both screens).
 */

const toast = (t, ms) => useStore.getState().showToast(t, ms)

/** What happens on screen when the run changes (it changes for both of you at once). */
function useStoryBeats() {
  useEffect(
    () =>
      onRunChange(({ steps, items, ending, reset }) => {
        const m = useMansion.getState()
        const here = m.onGrounds
        const s = useStore.getState()
        for (const st of steps) {
          if (STEP_TOASTS[st] && here) toast(STEP_TOASTS[st], 4200)
          if (st === 'enter' || st === 'diary') audio.hauntSfx?.('creak', { gain: 0.6 })
          if (['library_open', 'basement_open', 'bookcase', 'dial_open', 'safe', 'attic_open'].includes(st)) audio.hauntSfx?.('unlock')
          // the boss wakes: his words, for whoever is up there
          if (st === 'boss_seen' && here && m.floor === 'A' && m.inside) s.startDialog(BOSS.intro, 'mansion:boss')
          // the lanterns are lit: he gives up, and the ending is yours to choose
          if (st === 'boss_done' && here) {
            audio.setHauntMusic(false)
            if (m.floor === 'A' && m.inside) {
              s.startDialog(BOSS.weak, 'mansion:weak')
              const off = useStore.subscribe((now) => {
                if (now.dialog) return
                off()
                if (!useMansion.getState().run.ending && useMansion.getState().floor === 'A') openPanel('ending')
              })
            }
          }
          if (!here && ['library_open', 'basement_open', 'attic_open', 'boss_done'].includes(st)) toast(`👻 Di Rumah Kurcaci Berhantu: ${STEP_TOASTS[st]}`, 4200)
        }
        for (const it of items) if (here && ITEM_TOASTS[it]) toast(`${ITEM_TOASTS[it]} (${itemCount()}/4)`, 4200)
        if (ending) {
          const e = ENDINGS[ending]
          closePanel()
          if (here) {
            audio.hauntSfx?.(ending === 'funny' ? 'horn' : 'unlock', { gain: 1 })
            s.throughCurtain(() => {
              s.startDialog(e.lines, 'mansion:ending')
              setTimeout(() => toast(e.toast, 7000), 400)
            }, 1400)
          } else toast(`${e.title}! ${e.toast}`, 7000)
        }
        if (reset && here) toast('🕯️ Rumah Kurcaci Berhantu kembali seperti semula… petualangan baru dimulai.', 4200)
      }),
    [],
  )
}

/* ───────── the quest card ───────── */

function QuestCard() {
  const onGrounds = useMansion((s) => s.onGrounds)
  const run = useMansion((s) => s.run)
  const status = useMansion((s) => s.status)
  const busy = useMansion((s) => s.busy)
  const room = useMansion((s) => s.room)
  const view = useStore((s) => s.view)
  const mateOnline = useCouple((s) => s.mateOnline)
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 720)
  const [settings, setSettings] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const pref = useHaunt()
  if (!onGrounds || view !== 'explore') return null
  void run
  const chapter = CHAPTERS.find((c) => c.goals.some((g) => !has(g.step))) || null
  return (
    <section className={`mansion-quest${open ? '' : ' is-closed'}`} aria-label="Rumah Kurcaci Berhantu">
      <button type="button" className="mansion-quest-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>👻 Rumah Kurcaci Berhantu</span>
        <span className="mansion-quest-items">
          {ITEM_IDS.map((id) => (
            <span key={id} className={hasItem(id) ? 'is-found' : ''} title={ITEMS[id].name}>
              {ITEMS[id].icon}
            </span>
          ))}
        </span>
      </button>
      {open && (
        <div className="mansion-quest-body">
          {room && <p className="mansion-room">📍 {ROOM_LABEL[room] || ''}</p>}
          {run.ending ? (
            <p>
              <strong>{ENDINGS[run.ending].title}</strong>
              <br />
              Ending yang sudah dilihat: {run.endings_seen.map((e) => (e === 'good' ? 'Good' : 'Funny')).join(', ')} ({run.endings_seen.length}/2)
            </p>
          ) : chapter ? (
            <>
              <h3>{chapter.title}</h3>
              <ul>
                {chapter.goals.map((g) => (
                  <li key={g.step} className={has(g.step) ? 'is-done' : ''}>
                    {has(g.step) ? '✓' : '○'} {g.text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              <strong>Pilih akhir ceritanya</strong> di loteng, di depan Jam Kukuk.
            </p>
          )}
          <p className="mansion-meta">
            Pusaka {itemCount()}/4 · {isShared() ? (mateOnline ? `Progres berdua · ${mateName()} online` : 'Progres tersimpan berdua') : status === 'missing' ? 'Disimpan di perangkat ini (014 belum dipasang)' : coupleAvailable ? 'Disimpan di perangkat ini' : 'Main sendiri · disimpan di perangkat ini'}
            {busy ? ' · …' : ''}
          </p>
          <div className="couple-actions">
            <button type="button" className="btn-ghost small" onClick={() => leaveMansion()}>
              🚪 Keluar dari rumah
            </button>
            <button type="button" className="btn-ghost small" onClick={() => setSettings((v) => !v)} aria-expanded={settings}>
              ⚙️ Seram & suara
            </button>
            {run.ending && !confirmReset && (
              <button type="button" className="btn-ghost small" onClick={() => setConfirmReset(true)}>
                🔁 Main lagi
              </button>
            )}
            {confirmReset && (
              <button
                type="button"
                className="btn-glow small"
                onClick={() => {
                  setConfirmReset(false)
                  resetRun()
                }}
              >
                Yakin, ulang dari awal (berdua)
              </button>
            )}
          </div>
          {settings && (
            <div className="mansion-settings">
              <label>
                Kejutan
                <select value={pref.intensity} onChange={(e) => setHauntPref({ intensity: e.target.value })}>
                  {INTENSITY.map((k) => (
                    <option key={k} value={k}>
                      {INTENSITY_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Suara rumah hantu
                <input type="range" min="0" max="1" step="0.05" value={pref.volume} onChange={(e) => setHauntPref({ volume: Number(e.target.value) })} />
              </label>
              <p className="settings-help">Santai: tanpa kejutan mendadak dan kedip lampu yang lembut. Pengaturan ini hanya untukmu; rumah memakai yang paling lembut dari kalian berdua.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
const ROOM_LABEL = {
  foyer: 'Foyer',
  living: 'Ruang Tamu',
  kitchen: 'Dapur Misterius',
  dolls: 'Kamar Boneka',
  library: 'Perpustakaan',
  corridor: 'Lorong Rahasia',
  boiler: 'Basement · Ruang Ketel',
  hall: 'Basement · Lorong',
  cellar: 'Basement · Gudang Anggur',
  vault: 'Basement · Ruang Brankas',
  attic: 'Loteng',
}

/* ───────── the floating cards (a scare to skip, hiding) ───────── */

export function MansionFloat() {
  const active = useScareFx((s) => s.active)
  const hiding = useMansion((s) => s.hiding)
  const view = useStore((s) => s.view)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      tick((n) => n + 1)
      if (performance.now() / 1000 > active.until) useScareFx.setState({ active: null })
    }, 200)
    return () => clearInterval(id)
  }, [active])
  if (view !== 'explore') return null
  if (hiding)
    return (
      <section className="date-float">
        <p>🚪 Kamu bersembunyi di lemari. Hantu-hantu nggak bisa melihatmu. (Gerak untuk keluar.)</p>
        <div className="couple-actions">
          <button type="button" className="btn-ghost" onClick={() => leaveHide()}>
            Keluar dari lemari
          </button>
        </div>
      </section>
    )
  if (active && performance.now() / 1000 < active.until)
    return (
      <section className="date-float mansion-skip">
        <button type="button" className="btn-ghost small" onClick={() => skipScare()}>
          Lewati ✕
        </button>
      </section>
    )
  return null
}

/* ───────── the screens ───────── */

function Sheet({ title, children, wide }) {
  return (
    <motion.div className="panel-backdrop is-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePanel}>
      <motion.div className={`panel couple-panel date-panel mansion-panel${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={closePanel} aria-label="Tutup">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  )
}

function DiarySheet() {
  const page = useMansion((s) => s.page)
  const d = DIARY[page] || DIARY[0]
  return (
    <Sheet title="📖 Diari Keluarga Kenop">
      <h3 className="mansion-page-title">{d.title}</h3>
      <p className="mansion-paper">{d.text}</p>
    </Sheet>
  )
}

function BookSheet() {
  const [page, setPage] = useState(0)
  return (
    <Sheet title={`📕 ${BOOK.title}`}>
      <p className="mansion-paper">{BOOK.pages[page]}</p>
      <div className="couple-actions">
        <button type="button" className="btn-ghost small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          ◀ Sebelumnya
        </button>
        <span className="mansion-meta">
          {page + 1}/{BOOK.pages.length}
        </span>
        <button type="button" className="btn-ghost small" disabled={page === BOOK.pages.length - 1} onClick={() => setPage((p) => p + 1)}>
          Berikutnya ▶
        </button>
      </div>
    </Sheet>
  )
}

function DialSheet() {
  const dial = useMansion((s) => s.run.dial)
  const busy = useMansion((s) => s.busy)
  useMansion((s) => s.run.steps)
  const open = has('dial_open')
  const turn = (i, by) => {
    audio.hauntSfx?.('lever', { gain: 0.5 })
    setWheel(i, (dial[i] + by + SYMBOLS.length) % SYMBOLS.length)
  }
  return (
    <Sheet title="🔮 Roda Simbol">
      <p className="couple-status">{open ? 'Keempat simbol menyala. Gembok pertama terbuka!' : 'Empat roda, enam simbol. Urutannya ada di empat lukisan di empat ruangan (I sampai IV). Roda ini sama untuk kalian berdua.'}</p>
      <div className="mansion-wheels">
        {dial.map((v, i) => (
          <div key={i} className="mansion-wheel">
            <span className="mansion-roman">{['I', 'II', 'III', 'IV'][i]}</span>
            <button type="button" className="btn-ghost small" disabled={open || busy} onClick={() => turn(i, -1)} aria-label={`Roda ${i + 1} ke atas`}>
              ▲
            </button>
            <span className={`mansion-symbol${open ? ' is-lit' : ''}`} aria-label={SYMBOL_NAMES[v]}>
              {SYMBOLS[v]}
            </span>
            <button type="button" className="btn-ghost small" disabled={open || busy} onClick={() => turn(i, 1)} aria-label={`Roda ${i + 1} ke bawah`}>
              ▼
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function SafeSheet() {
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const busy = useMansion((s) => s.busy)
  const press = (d) => {
    audio.sfx('tick', d)
    setWrong(false)
    setCode((c) => (c.length >= 3 ? d : c + d))
  }
  const submit = async () => {
    const ok = await tryCode(code)
    if (has('safe')) closePanel()
    else if (!ok) {
      setWrong(true)
      audio.hauntSfx?.('buzz', { gain: 0.6 })
      setCode('')
    }
  }
  return (
    <Sheet title="🔐 Brankas Opa">
      <p className="couple-status">Tiga angka. Kata diari: simbol di tembok ruang ketel, dan artinya ada di buku ungu di perpustakaan.</p>
      <p className={`mansion-code${wrong ? ' is-wrong' : ''}`} aria-live="polite">
        {(code + '___').slice(0, 3).split('').join(' ')}
      </p>
      {wrong && <p className="couple-error">Klik… salah. Brankasnya mendengus.</p>}
      <div className="mansion-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
          <button key={d} type="button" className="btn-ghost" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="btn-glow" disabled={code.length !== 3 || busy} onClick={submit}>
          Buka
        </button>
      </div>
    </Sheet>
  )
}

function MirrorSheet() {
  return (
    <Sheet title="🪞 Pantulan di cermin">
      <p className="mansion-paper">
        Dalam cahaya lilin, kamar di dalam cermin sedikit berbeda dari kamar yang asli. Boneka-bonekanya sama… kecuali satu: boneka <strong>berpita ungu</strong> di pantulan memegang <strong>sepotong kunci</strong> dan melambai pelan ke arahmu.
      </p>
      <p className="couple-status">Di kamar yang asli tangannya kelihatan kosong. Cari boneka berpita ungu itu (Usil suka memindahkan boneka saat tidak ada yang melihat).</p>
    </Sheet>
  )
}

function EndingSheet() {
  useMansion((s) => s.run)
  const n = itemCount()
  const busy = useMansion((s) => s.busy)
  const allFour = n >= ITEM_IDS.length
  return (
    <Sheet title="⏳ Jam Kukuk Kelam">
      <p className="mansion-paper">{CHOICE.ask}</p>
      <div className="mansion-choices">
        <button type="button" className="btn-glow" disabled={!allFour || busy} onClick={() => chooseEnding('good')}>
          ✨ {CHOICE.good}
        </button>
        {!allFour && <p className="couple-status">{CHOICE.goodMissing(n)}</p>}
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => chooseEnding('funny')}>
          🔴 {CHOICE.funny}
        </button>
        <button type="button" className="btn-ghost small" onClick={closePanel}>
          {CHOICE.later}
        </button>
      </div>
      <p className="mansion-meta">Pilihan ini untuk kalian berdua: siapa pun yang memilih duluan, ceritanya berakhir begitu.</p>
    </Sheet>
  )
}

export default function MansionUI() {
  const phase = useStore((s) => s.phase)
  const panel = useMansion((s) => s.panel)
  useStoryBeats()
  if (phase !== 'world') return null
  return (
    <>
      <QuestCard />
      {!coupleAvailable && (
        <div className="top-stack">
          <MansionFloat />
        </div>
      )}
      <AnimatePresence>
        {panel === 'diary' && <DiarySheet key="diary" />}
        {panel === 'book' && <BookSheet key="book" />}
        {panel === 'dial' && <DialSheet key="dial" />}
        {panel === 'safe' && <SafeSheet key="safe" />}
        {panel === 'mirror' && <MirrorSheet key="mirror" />}
        {panel === 'ending' && <EndingSheet key="ending" />}
      </AnimatePresence>
    </>
  )
}
