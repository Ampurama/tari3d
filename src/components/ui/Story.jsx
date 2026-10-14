import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Check,
  Footprints,
  Hourglass,
  Images,
  Lock,
  Mail,
  Orbit,
  Star,
  Telescope,
  Utensils,
  X,
} from 'lucide-react'
import { companion, couple, secretEnding, story } from '../../content/config'
import { CHAPTER_COUNT, chapterStatus, completedCount, currentChapter, fillNames } from '../../lib/story'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'

const speakerName = (speaker) =>
  speaker === 'me' ? couple.me.name : speaker === 'you' ? couple.you.name : speaker === 'pet' ? companion.name : story.narrator

/** Visual-novel dialog box. Tap / Enter / Space continues; it never blocks the rest of the page. */
export function DialogBox() {
  const dialog = useStore((s) => s.dialog)
  const advance = useStore((s) => s.advanceDialog)
  const close = useStore((s) => s.closeDialog)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const line = dialog ? dialog.lines[dialog.index] : null
  const text = line ? fillNames(line.text, couple) : ''
  const [shown, setShown] = useState(0)
  const pos = useRef(0)

  useLayoutEffect(() => {
    pos.current = 0
    setShown(reducedMotion ? text.length : 0)
    if (!text || reducedMotion) {
      pos.current = text.length
      return
    }
    const id = setInterval(() => {
      pos.current = Math.min(text.length, pos.current + 1)
      setShown(pos.current)
      if (pos.current >= text.length) clearInterval(id)
    }, 26)
    return () => clearInterval(id)
  }, [text, reducedMotion])

  const next = () => {
    if (pos.current < text.length) {
      pos.current = text.length
      setShown(text.length)
    } else advance()
  }

  useEffect(() => {
    if (!dialog) return
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        // don't steal Enter/Space from buttons and inputs
        if (e.target instanceof HTMLElement && e.target.closest('button, input, textarea, a, [role="button"]')) return
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <AnimatePresence>
      {line && (
        <motion.div
          className="dialog-wrap"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={`dialog-box speaker-${line.speaker}`} role="dialog" aria-live="polite" aria-label={speakerName(line.speaker)} onClick={next}>
            <span className="dialog-speaker">{speakerName(line.speaker)}</span>
            <p className="dialog-text">
              <span className="sr-only">{text}</span>
              <span aria-hidden="true">{text.slice(0, shown)}</span>
            </p>
            <div className="dialog-actions">
              <span className="dialog-count" aria-hidden="true">
                {dialog.index + 1}/{dialog.lines.length}
              </span>
              <button
                type="button"
                className="btn-ghost dialog-skip"
                onClick={(e) => {
                  e.stopPropagation()
                  close()
                }}
              >
                Skip
              </button>
              <button
                type="button"
                className="btn-glow small"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
              >
                {dialog.index === dialog.lines.length - 1 && shown >= text.length ? 'Okay ♡' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Watches real progress: celebrates finished chapters (once), introduces Chapter 3 when she's back
 * on the island, and keeps the music in tune with where she is.
 */
export function StoryDirector() {
  const phase = useStore((s) => s.phase)
  const doneCount = useStore((s) => completedCount(s))
  const celebrated = useStore((s) => s.celebrated)
  const dialog = useStore((s) => s.dialog)
  const introsSeen = useStore((s) => s.introsSeen)
  const view = useStore((s) => s.view)
  const connections = useStore((s) => s.connectionsDone.length)
  const reading = useStore(
    (s) =>
      s.selectedMemory !== null ||
      Boolean(s.capsuleLetter) ||
      Boolean(s.threadMessage) ||
      s.activeStar !== null ||
      s.timeIndex !== null ||
      s.panel !== null ||
      Boolean(s.discovery) ||
      s.curtain,
  )
  // a chapter just got completed → celebrate it once (never interrupting something she's reading),
  // and let the next chapter introduce itself right away (the bridge and the picnic introduce themselves on arrival)
  useEffect(() => {
    if (phase !== 'world' || dialog || reading || !['explore', 'distance'].includes(view)) return
    const status = chapterStatus(useStore.getState())
    const fresh = status.find((c) => c.done && !celebrated.includes(c.index))
    if (!fresh) return
    const t = setTimeout(() => {
      const st = useStore.getState()
      st.markCelebrated(fresh.index)
      audio.sfx('complete')
      const next = status[fresh.index + 1]
      if (next) st.showToast(`Chapter ${fresh.index + 1} complete ✦ Chapter ${fresh.index + 2} — ${next.title} — is open.`, 6500)
      const lines = [...(fresh.outro || [])]
      if (fresh.hint) lines.push({ speaker: 'narrator', text: fresh.hint })
      const introduce = next && !['miles', 'picnic'].includes(next.id) && !introsSeen.includes(next.index)
      if (introduce) lines.push(...next.intro)
      if (next?.id === 'letter') st.cueMochi('envelope')
      if (lines.length) st.startDialog(lines, introduce ? `intro:${next.index}` : `outro:${fresh.index}`)
    }, 1600)
    return () => clearTimeout(t)
  }, [phase, doneCount, celebrated, dialog, view, reading, introsSeen])

  // music follows the journey
  useEffect(() => {
    if (view === 'avatar' || view === 'intro') audio.setMood('select')
    else if (view === 'cinematic' || view === 'ending') audio.setMood('finale')
    else if (view === 'finalRoom' || view === 'epilogue') audio.setMood('quiet')
    else if (view === 'distance') audio.setMood('miles')
    else if (view === 'picnic') audio.setMood('future')
    else audio.setMood(doneCount >= 3 ? 'future' : 'little')
  }, [view, doneCount])
  useEffect(() => audio.setWarmth(connections / 5), [connections])

  return null
}

/** HUD: what to do now — chapter, objective and real progress. Opens the story book. */
export function ObjectivePill() {
  const sig = useStore((s) => {
    const c = currentChapter(s)
    return c ? `${c.index}|${c.tasks.map((t) => `${t.have}/${t.need}`).join(',')}` : 'done'
  })
  const ended = useStore((s) => s.mainEndingSeen)
  const setPanel = useStore((s) => s.setPanel)
  const c = useMemo(() => currentChapter(useStore.getState()), [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const task = c?.tasks.find((t) => !t.done) || c?.tasks[0]
  const ratio = c ? c.ratio : 1
  return (
    <button type="button" className="objective" onClick={() => setPanel('story')} aria-label="Open the story book">
      <svg viewBox="0 0 20 20" className="pill-ring" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <circle cx="10" cy="10" r="8" style={{ strokeDasharray: `${ratio * 50.3} 50.3` }} />
      </svg>
      <span className="objective-text">
        <strong>{c ? `Chapter ${c.index + 1} · ${c.title}` : ended ? 'Every chapter complete ♡' : 'The ending is waiting ♡'}</strong>
        {task && (
          <small>
            {task.label} {task.need > 1 && `(${task.have}/${task.need})`}
          </small>
        )}
      </span>
    </button>
  )
}

/** The story book: the five chapters, real progress, replays and a deliberate reset. */
/** What a chapter's button does in the story book: [while playing, once done]. */
const ACTIONS = {
  miles: ['Go to the two islands', 'Visit the islands again'],
  picnic: ['Go to the picnic', 'Have the picnic again'],
  letter: ['Open the envelope', 'Read the letter again'],
}

export function StoryPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const ended = useStore((s) => s.mainEndingSeen)
  const secretKnown = useStore((s) => s.secretFound || s.secretSeen)
  const signature = useStore((s) => JSON.stringify(chapterStatus(s).map((c) => [c.done, c.unlocked, c.tasks.map((t) => t.have)])))
  const chapters = useMemo(() => chapterStatus(useStore.getState()), [signature]) // eslint-disable-line react-hooks/exhaustive-deps
  const [confirmReset, setConfirmReset] = useState(false)
  const done = chapters.filter((c) => c.done).length
  const all = done >= CHAPTER_COUNT
  useEffect(() => {
    if (panel !== 'story') setConfirmReset(false)
  }, [panel])

  const go = (c) => {
    const st = useStore.getState()
    setPanel(null)
    if (!c.unlocked) return st.showToast('Finish the previous chapter to unlock this one ♡')
    if (c.id === 'miles') return st.travelToMiles()
    if (c.id === 'picnic') return st.startPicnic()
    if (c.id === 'letter') return c.done ? st.openLetterAgain() : st.openEnvelope()
    if (st.view !== 'explore') st.back()
    st.startDialog(c.intro, `intro:${c.index}`)
  }

  return (
    <AnimatePresence>
      {panel === 'story' && (
        <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanel(null)}>
          <motion.div
            className="panel story-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Story chapters"
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-btn panel-close" onClick={() => setPanel(null)} aria-label="Close">
              <X size={18} />
            </button>
            <span className="eyebrow">{story.tagline}</span>
            <h2>{story.title}</h2>
            <div className="reactor-meter" aria-label={`${done} of ${CHAPTER_COUNT} chapters complete`}>
              {chapters.map((c) => (
                <span key={c.index} className={c.done ? 'is-on' : ''} />
              ))}
            </div>
            <p className="story-meter-label">
              {done}/{CHAPTER_COUNT} chapters · the Love Tree grows with every step
            </p>

            <ol className="chapter-list">
              {chapters.map((c) => (
                <li key={c.id} className={`chapter-card${c.done ? ' is-done' : ''}${!c.unlocked ? ' is-locked' : ''}`}>
                  <div className="chapter-head">
                    <span className="chapter-num">{c.done ? <Check size={14} /> : !c.unlocked ? <Lock size={13} /> : c.index + 1}</span>
                    <div>
                      <strong>{c.title}</strong>
                      <small>{c.subtitle}</small>
                    </div>
                  </div>
                  {c.unlocked && (
                    <ul className="task-list">
                      {c.tasks.map((t) => (
                        <li key={t.label} className={t.done ? 'is-done' : ''}>
                          <span aria-hidden="true">{t.done ? '✦' : '○'}</span>
                          {t.label}
                          {t.need > 1 && (
                            <em>
                              {t.have}/{t.need}
                            </em>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" className={c.unlocked && !c.done ? 'btn-glow small' : 'btn-ghost'} disabled={!c.unlocked} onClick={() => go(c)}>
                    {!c.unlocked ? 'Locked — finish the chapter before' : ACTIONS[c.id]?.[c.done ? 1 : 0] || (c.done ? 'Hear the beginning again' : 'Remind me what to do')}
                  </button>
                </li>
              ))}
            </ol>

            {all && (
              <div className="story-ending-actions">
                <button
                  type="button"
                  className="btn-glow small"
                  onClick={() => {
                    setPanel(null)
                    useStore.getState().startCinematic()
                  }}
                >
                  {ended ? 'Replay the ending' : 'Watch the ending'}
                </button>
                {ended && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setPanel(null)
                      useStore.getState().openLetterAgain()
                    }}
                  >
                    Read the letter again
                  </button>
                )}
                {secretKnown && (
                  <button type="button" className="btn-ghost" onClick={() => useStore.getState().replaySecret()}>
                    {secretEnding.replay}
                  </button>
                )}
              </div>
            )}

            <div className="story-reset">
              {!confirmReset ? (
                <button type="button" className="link-btn" onClick={() => setConfirmReset(true)}>
                  Start the story over…
                </button>
              ) : (
                <div className="reset-confirm" role="alert">
                  <p>This clears the three chapters and the endings (your character and optional finds stay). Are you sure?</p>
                  <div>
                    <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>
                      Keep my progress
                    </button>
                    <button
                      type="button"
                      className="btn-ghost danger"
                      onClick={() => {
                        setConfirmReset(false)
                        useStore.getState().resetStory()
                      }}
                    >
                      Yes, start over
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Every optional place, one tap away (the story places are found by exploring). */
export function PlacesSheet() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const goTo = useStore((s) => s.goTo)
  const openLane = useStore((s) => s.openLane)
  const openFuture = useStore((s) => s.openFuture)
  const travelToMiles = useStore((s) => s.travelToMiles)
  const visited = useStore((s) => s.visited)
  const milesOpen = useChapterUnlocked('miles')
  const picnicOpen = useChapterUnlocked('picnic')
  const places = [
    { key: 'memories', label: 'Memories', icon: Images, go: () => goTo('memories') },
    { key: 'lane', label: 'Memory Lane', icon: Footprints, go: () => openLane() },
    { key: 'letter', label: 'Letter', icon: Mail, go: () => goTo('letter') },
    { key: 'capsule', label: 'Love Capsule', icon: Archive, go: () => goTo('capsule') },
    { key: 'timemachine', label: 'Time Machine', icon: Hourglass, go: () => goTo('timemachine') },
    { key: 'constellation', label: 'Our Stars', icon: Star, go: () => goTo('constellation') },
    { key: 'future', label: 'Future', icon: Orbit, go: () => openFuture(0) },
    { key: 'distance', label: 'Two Islands', icon: Telescope, go: () => travelToMiles(), locked: !milesOpen, why: 'Opens after Chapter Two' },
    { key: 'picnic', label: 'The Picnic', icon: Utensils, go: () => useStore.getState().startPicnic(), locked: !picnicOpen, why: 'Opens after Chapter Three' },
  ]
  return (
    <AnimatePresence>
      {panel === 'places' && (
        <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanel(null)}>
          <motion.div
            className="panel places-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Places"
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-btn panel-close" onClick={() => setPanel(null)} aria-label="Close">
              <X size={18} />
            </button>
            <h2>Places</h2>
            <p className="places-note">Little extras around our universe — they never block the story.</p>
            <div className="places-grid">
              {places.map(({ key, label, icon: Icon, go, locked, why }) => (
                <button
                  key={key}
                  type="button"
                  className={`place-btn${locked ? ' is-locked' : ''}`}
                  onClick={() => {
                    if (locked) {
                      useStore.getState().showToast(`${label} — ${why} ♡`)
                      return
                    }
                    audio.sparkle()
                    setPanel(null)
                    go()
                  }}
                  aria-label={locked ? `${label} (locked: ${why})` : label}
                >
                  {locked ? <Lock size={20} strokeWidth={1.6} /> : <Icon size={20} strokeWidth={1.6} />}
                  <span>{label}</span>
                  {visited[key] && !locked && <i className="dock-dot" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
