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
  X,
} from 'lucide-react'
import { couple, heartReactor, secretEnding, story } from '../../content/config'
import { CHAPTER_COUNT, chapterStatus, completedCount, fillNames } from '../../lib/story'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'

const speakerName = (speaker) =>
  speaker === 'me' ? couple.me.name : speaker === 'you' ? couple.you.name : story.narrator

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

/** Watches real progress: celebrates finished chapters, introduces the next one, hands over to the reactor. */
export function StoryDirector() {
  const phase = useStore((s) => s.phase)
  const doneCount = useStore((s) => completedCount(s))
  const celebrated = useStore((s) => s.celebrated)
  const dialog = useStore((s) => s.dialog)
  const prologueSeen = useStore((s) => s.prologueSeen)
  const introsSeen = useStore((s) => s.introsSeen)
  const view = useStore((s) => s.view)
  const reading = useStore(
    (s) => s.selectedMemory !== null || Boolean(s.capsuleLetter) || Boolean(s.threadMessage) || s.activeStar !== null || s.timeIndex !== null || s.panel !== null,
  )

  // right after the prologue, chapter one introduces itself
  useEffect(() => {
    if (phase !== 'world' || !prologueSeen || dialog || introsSeen.includes(0)) return
    const t = setTimeout(() => {
      const s = useStore.getState()
      if (!s.dialog) s.startDialog(story.chapters[0].intro, 'intro:0')
    }, 600)
    return () => clearTimeout(t)
  }, [phase, prologueSeen, dialog, introsSeen])

  // a chapter just got completed → celebrate it once
  useEffect(() => {
    // never interrupt: wait until no dialog, card, letter or panel is open
    if (phase !== 'world' || dialog || reading || ['cutscene', 'finalRoom', 'finale', 'letter', 'epilogue'].includes(view)) return
    const s = useStore.getState()
    const status = chapterStatus(s)
    const fresh = status.find((c) => c.done && !celebrated.includes(c.index))
    if (!fresh) return
    const t = setTimeout(() => {
      const st = useStore.getState()
      st.markCelebrated(fresh.index)
      audio.sparkle()
      const next = status[fresh.index + 1]
      st.showToast(
        next
          ? `Chapter ${fresh.index + 1} complete ✦ The Heart Reactor glows brighter. Chapter ${fresh.index + 2} unlocked!`
          : 'Every chapter is complete ✦ The Heart Reactor is full.',
        6500,
      )
      const lines = [...(fresh.outro || [])]
      if (!next) lines.push({ speaker: 'narrator', text: 'Open the Heart Reactor whenever you’re ready ♡' })
      st.startDialog(lines, `outro:${fresh.index}`)
    }, 1400)
    return () => clearTimeout(t)
  }, [phase, doneCount, celebrated, dialog, view, reading])

  return null
}

/** HUD pill: current chapter + progress; opens the story book. */
export function ChapterPill() {
  const status = useStore((s) => chapterStatus(s).map((c) => `${c.done ? 1 : 0}${c.unlocked ? 1 : 0}${c.ratio.toFixed(2)}`).join('|'))
  const setPanel = useStore((s) => s.setPanel)
  const chapters = useMemo(() => chapterStatus(useStore.getState()), [status]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = chapters.find((c) => !c.done)
  const done = chapters.filter((c) => c.done).length
  const label = current ? `Ch. ${current.index + 1} · ${current.title}` : 'All chapters complete ♡'
  const ratio = current ? current.ratio : 1
  return (
    <button type="button" className="hud-pill chapter-pill" onClick={() => setPanel('story')} aria-label={`Story: ${label}. ${done} of ${CHAPTER_COUNT} chapters complete.`}>
      <svg viewBox="0 0 20 20" className="pill-ring" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <circle cx="10" cy="10" r="8" style={{ strokeDasharray: `${ratio * 50.3} 50.3` }} />
      </svg>
      <span>{label}</span>
    </button>
  )
}

/** The story book: every chapter, its objectives and real progress. */
export function StoryPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const startChapter = useStore((s) => s.startChapter)
  const goTo = useStore((s) => s.goTo)
  const openFinalRoom = useStore((s) => s.openFinalRoom)
  const endingSeen = useStore((s) => s.endingSeen)
  const secretKnown = useStore((s) => s.secretFound || s.secretSeen)
  const replaySecret = useStore((s) => s.replaySecret)
  // re-render whenever any measured progress changes
  const signature = useStore((s) => JSON.stringify(chapterStatus(s).map((c) => [c.done, c.unlocked, c.tasks.map((t) => t.have)])))
  const chapters = useMemo(() => chapterStatus(useStore.getState()), [signature]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = chapters.filter((c) => c.done).length
  const all = done >= CHAPTER_COUNT

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
            <div className="reactor-meter" aria-label={`Heart Reactor energy: ${done} of ${CHAPTER_COUNT}`}>
              {chapters.map((c) => (
                <span key={c.index} className={c.done ? 'is-on' : ''} />
              ))}
            </div>
            <p className="story-meter-label">
              {heartReactor.title} · {done}/{CHAPTER_COUNT}
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
                  <button
                    type="button"
                    className={c.unlocked && !c.done ? 'btn-glow small' : 'btn-ghost'}
                    disabled={!c.unlocked}
                    onClick={() => startChapter(c.index, c.unlocked)}
                  >
                    {!c.unlocked ? 'Locked — finish the chapter before' : c.done ? 'Revisit' : c.tasks.some((t) => t.have > 0) ? 'Continue' : 'Start chapter'}
                  </button>
                </li>
              ))}
            </ol>

            {all && (
              <div className="story-ending-actions">
                <button
                  type="button"
                  className="btn-glow"
                  onClick={() => {
                    setPanel(null)
                    goTo('reactor')
                  }}
                >
                  Go to the Heart Reactor
                </button>
                {endingSeen && (
                  <button type="button" className="btn-ghost" onClick={openFinalRoom}>
                    Enter the Secret Room
                  </button>
                )}
                {secretKnown && (
                  <button type="button" className="btn-ghost" onClick={replaySecret}>
                    {secretEnding.replay}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Every place in the universe, one tap away. New devices show when they're still asleep. */
export function PlacesSheet() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const goTo = useStore((s) => s.goTo)
  const openLane = useStore((s) => s.openLane)
  const openFuture = useStore((s) => s.openFuture)
  const visited = useStore((s) => s.visited)
  const timeUnlocked = useChapterUnlocked(1)
  const futureUnlocked = useChapterUnlocked(4)
  const showToast = useStore((s) => s.showToast)
  const places = [
    { key: 'memories', label: 'Memories', icon: Images, go: () => goTo('memories') },
    { key: 'lane', label: 'Memory Lane', icon: Footprints, go: () => openLane() },
    { key: 'timemachine', label: 'Time Machine', icon: Hourglass, go: () => goTo('timemachine'), locked: !timeUnlocked, why: 'Wakes up in Chapter Two' },
    { key: 'letter', label: 'Letter', icon: Mail, go: () => goTo('letter') },
    { key: 'capsule', label: 'Love Capsule', icon: Archive, go: () => goTo('capsule') },
    { key: 'distance', label: 'Red Thread', icon: Telescope, go: () => goTo('distance') },
    { key: 'constellation', label: 'Our Stars', icon: Star, go: () => goTo('constellation') },
    { key: 'future', label: 'Future', icon: Orbit, go: () => openFuture(0), locked: !futureUnlocked, why: 'Opens in Chapter Five' },
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
            <div className="places-grid">
              {places.map(({ key, label, icon: Icon, go, locked, why }) => (
                <button
                  key={key}
                  type="button"
                  className={`place-btn${locked ? ' is-locked' : ''}`}
                  onClick={() => {
                    if (locked) {
                      showToast(`${label} is still asleep — ${why} ♡`)
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

