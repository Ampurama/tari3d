import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookHeart, House, LayoutGrid, Lightbulb, Moon, Music, Settings, Sun, Sunrise, Sunset, UserRound, VolumeX, Wind, X, Heart } from 'lucide-react'
import { couple, hints } from '../../content/config'
import { daysSince, isTouch } from '../../lib/device'
import { input } from '../../lib/player'
import { useStore } from '../../store'
import { coupleAvailable } from '../../lib/couple'
import { useHome } from '../../lib/home'
import { audio } from '../../audio/engine'
import { currentHour, partOfDay, TIME_LABELS, TIME_MODES, useTimeOfDay } from '../../lib/timeOfDay'
import { CountdownPanel, CountdownPill } from './Countdown'
import { HeartsPanel, HeartsPill } from './HeartsPanel'
import { DialogBox, ObjectivePill, PlacesSheet, StoryDirector, StoryPanel } from './Story'
import { DiscoveryCard, InteractButton, Joystick } from './TouchControls'
import { GuideChip, HintCard, useHintDirector } from './HintCard'

function useAudioState() {
  const [state, setState] = useState({ musicOn: audio.musicOn, ambientOn: audio.ambientOn, sfxOn: audio.sfxOn, volume: audio.volume })
  useEffect(() => audio.subscribe(setState), [])
  return state
}

export function AudioControls() {
  const state = useAudioState()
  const setPanel = useStore((s) => s.setPanel)
  return (
    <div className="audio-controls">
      <button
        type="button"
        className={`icon-btn${state.musicOn ? ' is-on' : ''}`}
        onClick={() => audio.setMusic(!state.musicOn, { user: true })}
        aria-pressed={state.musicOn}
        aria-label={state.musicOn ? 'Turn music off' : 'Turn music on'}
        title={state.musicOn ? 'Music on' : 'Music off'}
      >
        {state.musicOn ? <Music size={18} /> : <VolumeX size={18} />}
        {state.musicOn && (
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      <button type="button" className="icon-btn" onClick={() => setPanel('settings')} aria-label="Sound and settings" title="Sound & settings">
        <Settings size={18} />
      </button>
    </div>
  )
}

/** Sound settings + "change character". */
const PART_ICONS = { pagi: Sunrise, siang: Sun, sore: Sunset, malam: Moon }

/** Morning, midday, afternoon, night: let the day go by, follow the clock, or hold one. */
function TimeSettings() {
  const mode = useTimeOfDay((s) => s.mode)
  const setMode = useTimeOfDay((s) => s.setMode)
  const [now, setNow] = useState(() => partOfDay(currentHour()))
  useEffect(() => {
    const id = setInterval(() => setNow(partOfDay(currentHour())), 2000)
    return () => clearInterval(id)
  }, [])
  const Icon = PART_ICONS[now]
  return (
    <>
      <h2>Waktu</h2>
      <p className="time-now">
        <Icon size={15} /> Sekarang {TIME_LABELS[now].toLowerCase()}
        {mode === 'cycle' ? ' · hari berjalan sendiri' : mode === 'real' ? ' · ikut jam HP-mu' : ''}
      </p>
      <div className="time-chips" role="radiogroup" aria-label="Waktu">
        {TIME_MODES.map((m) => {
          const ChipIcon = PART_ICONS[m]
          return (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={`time-chip${mode === m ? ' is-on' : ''}`} onClick={() => setMode(m)}>
              {ChipIcon && <ChipIcon size={14} />}
              {TIME_LABELS[m]}
            </button>
          )
        })}
      </div>
    </>
  )
}

function SettingsPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const phase = useStore((s) => s.phase)
  const openAvatarSelect = useStore((s) => s.openAvatarSelect)
  const state = useAudioState()
  return (
    <AnimatePresence>
      {panel === 'settings' && (
        <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanel(null)}>
          <motion.div
            className="panel settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-btn panel-close" onClick={() => setPanel(null)} aria-label="Close">
              <X size={18} />
            </button>
            <span className="eyebrow">Paused</span>
            <button type="button" className="btn-glow small settings-resume" onClick={() => setPanel(null)}>
              Resume ♡
            </button>
            {coupleAvailable && (
              <button type="button" className="btn-ghost settings-couple" onClick={() => setPanel('couple')}>
                <Heart size={15} /> Main berdua ♡
              </button>
            )}
            <TimeSettings />
            <h2>Sound</h2>
            <div className="setting-row">
              <span>
                <Music size={16} /> Music
              </span>
              <button type="button" className={`toggle${state.musicOn ? ' is-on' : ''}`} role="switch" aria-checked={state.musicOn} aria-label="Music" onClick={() => audio.setMusic(!state.musicOn, { user: true })}>
                <i />
              </button>
            </div>
            <div className="setting-row">
              <span>
                <Wind size={16} /> Wind &amp; chimes
              </span>
              <button type="button" className={`toggle${state.ambientOn ? ' is-on' : ''}`} role="switch" aria-checked={state.ambientOn} aria-label="Wind and chimes" onClick={() => audio.setAmbient(!state.ambientOn)}>
                <i />
              </button>
            </div>
            <div className="setting-row">
              <span>✦ Little sound effects</span>
              <button type="button" className={`toggle${state.sfxOn ? ' is-on' : ''}`} role="switch" aria-checked={state.sfxOn} aria-label="Sound effects" onClick={() => audio.setSfx(!state.sfxOn)}>
                <i />
              </button>
            </div>
            <label className="setting-row volume">
              <span>Volume</span>
              <input type="range" min="0" max="1" step="0.05" value={state.volume} onChange={(e) => audio.setVolume(Number(e.target.value))} aria-label="Volume" />
            </label>
            {phase === 'world' && (
              <button
                type="button"
                className="btn-ghost settings-avatar"
                onClick={() => {
                  setPanel(null)
                  openAvatarSelect()
                }}
              >
                <UserRound size={16} /> Change character (your progress stays)
              </button>
            )}
            <p className="settings-help">
              {isTouch
                ? 'Move with the joystick or tap where you want to go. Drag the island with one finger to turn it, pinch to zoom.'
                : 'Move with WASD / arrow keys (Shift to run), E to interact — or just click where you want to go. Drag to turn the island, scroll to zoom.'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const VIEW_TITLES = {
  memories: 'Our memories',
  letter: 'A letter for you',
  distance: 'A Little Far, Never Apart',
  picnic: 'The Disaster Date',
  lane: 'Memory Lane',
  timemachine: 'Time Machine',
  future: 'Future Simulator',
  capsule: 'Love Capsule',
  constellation: 'Our Constellation',
}

function Brand() {
  const days = daysSince(couple.since)
  return (
    <div className="brand">
      <span className="brand-title">Our Little Universe</span>
      {days && (
        <span className="brand-sub">
          day {days.toLocaleString()} of {couple.me.name} &amp; {couple.you.name}
        </span>
      )}
      <ObjectivePill />
      <div className="brand-pills">
        <CountdownPill />
      </div>
    </div>
  )
}

function Dock({ flat }) {
  const setPanel = useStore((s) => s.setPanel)
  const openAvatarSelect = useStore((s) => s.openAvatarSelect)
  const nudge = useStore((s) => Boolean(s.hintNudge))
  const recenter = () => useStore.setState((s) => ({ camNonce: s.camNonce + 1 }))
  const items = [
    !flat && {
      key: 'hint',
      label: 'Hint',
      icon: Lightbulb,
      action: () => {
        useStore.setState({ hintNudge: false })
        setPanel('hint')
      },
      aria: 'Get a hint: what to do next and where',
    },
    !flat && { key: 'explore', label: 'Island', icon: House, action: recenter, aria: 'Bring the camera back to your character' },
    { key: 'story', label: 'Story', icon: BookHeart, action: () => setPanel('story') },
    { key: 'places', label: 'Places', icon: LayoutGrid, action: () => setPanel('places') },
    { key: 'avatar', label: 'Character', icon: UserRound, action: openAvatarSelect },
  ].filter(Boolean)
  return (
    <motion.nav
      className="dock"
      aria-label="Menu"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {items.map(({ key, label, icon: Icon, action, aria }) => (
        <button
          key={key}
          type="button"
          className={`dock-item${key === 'hint' ? ' is-hint' : ''}${key === 'hint' && nudge ? ' is-nudging' : ''}`}
          onClick={() => {
            audio.sparkle()
            action()
          }}
          aria-label={aria || label}
        >
          <Icon size={19} strokeWidth={1.7} />
          <span>{label}</span>
        </button>
      ))}
    </motion.nav>
  )
}

export function Toast() {
  const toast = useStore((s) => s.toast)
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div key={toast.id} className="toast" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.45 }}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Everything 2D that floats over the world. */
/** `flat`: the 2D (no-WebGL) version, where there is no avatar to steer. */
export default function Hud({ flat = false }) {
  const phase = useStore((s) => s.phase)
  const talking = useStore((s) => Boolean(s.dialog))
  useHintDirector(!flat)
  const view = useStore((s) => s.view)
  const back = useStore((s) => s.back)
  const unlockPending = useStore((s) => s.unlockPending)
  const consumeUnlock = useStore((s) => s.consumeUnlock)
  const showToast = useStore((s) => s.showToast)
  const secretStage = useStore((s) => s.secretStage)
  const decorating = useHome((s) => s.editing)
  const inWorld = phase === 'world'

  // a dialog covers the bottom of the screen: let go of anything held under it
  useEffect(() => {
    if (talking) input.interactHeld = false
  }, [talking])

  // the old heart arch wakes up once the letter on the table has been read
  useEffect(() => {
    if (view === 'explore' && unlockPending) {
      const t = setTimeout(() => {
        showToast(hints.secretUnlocked, 6000)
        consumeUnlock()
      }, 1300)
      return () => clearTimeout(t)
    }
  }, [view, unlockPending, showToast, consumeUnlock])

  // Escape: close the top-most thing, or go back to the island
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const st = useStore.getState()
      if (st.panel) return st.setPanel(null)
      if (st.discovery) return st.closeDiscovery()
      if (st.dialog) return st.closeDialog()
      const v = st.view
      // on the island, Escape pauses: the settings (sound, help) open and the avatar waits
      if (v === 'explore' && st.phase === 'world') return st.setPanel('settings')
      if (['explore', 'intro', 'avatar', 'finale', 'cinematic', 'ending', 'finalRoom', 'epilogue', 'cutscene'].includes(v)) return
      if (v === 'memories' && st.selectedMemory !== null) return
      if (v === 'capsule' && st.capsuleLetter) return
      if (v === 'constellation' && st.activeStar !== null) return st.closeStar()
      if (v === 'timemachine' && st.timeIndex !== null) return st.closeTimeEntry()
      if (v === 'distance' && st.threadMessage) return
      back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  if (phase === 'loading') return null
  const cinematic = view === 'cinematic'
  const quiet = cinematic || view === 'cutscene' || view === 'epilogue' || view === 'ending' || (view === 'finalRoom' && Boolean(secretStage)) || view === 'avatar'
  const focused = inWorld && !['explore', 'finale', 'finalRoom', 'epilogue', 'cinematic', 'ending', 'avatar', 'cutscene'].includes(view)
  // while decorating the house, its own bar takes the bottom of the screen
  const exploring = inWorld && view === 'explore' && !decorating

  return (
    <>
      <StoryDirector />
      <header className={`hud-top${cinematic ? ' is-hidden' : quiet ? ' is-raised' : ''}`}>
        <AnimatePresence mode="wait">
          {focused ? (
            <motion.button key="back" type="button" className="back-btn" onClick={back} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <ArrowLeft size={17} />
              <span>
                Back to our island
                {VIEW_TITLES[view] && <em> · {VIEW_TITLES[view]}</em>}
              </span>
            </motion.button>
          ) : exploring ? (
            <motion.div key="brand" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Brand />
            </motion.div>
          ) : (
            <span key="empty" />
          )}
        </AnimatePresence>
        <div className="hud-right">
          {inWorld && !quiet && view !== 'finale' && view !== 'finalRoom' && <HeartsPill />}
          <AudioControls />
        </div>
      </header>
      <AnimatePresence>{exploring && <Dock key="dock" flat={flat} />}</AnimatePresence>
      {/* the touch controls step aside while a dialog is open (it sits right where they are) */}
      {exploring && !flat && !talking && isTouch && <Joystick />}
      {exploring && !flat && !talking && <InteractButton />}
      <DiscoveryCard />
      <Toast />
      <CountdownPanel />
      <HeartsPanel />
      <StoryPanel />
      <PlacesSheet />
      <SettingsPanel />
      {!flat && <HintCard />}
      {!flat && <GuideChip />}
      {inWorld && !quiet && <DialogBox />}
    </>
  )
}
