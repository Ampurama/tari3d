import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarHeart, X } from 'lucide-react'
import { couple, nextMeeting } from '../../content/config'
import { useStore } from '../../store'

/** Parses the configured meeting date. Returns null when it isn't set or can't be read. */
function meetingTime() {
  if (!nextMeeting.date) return null
  const t = new Date(nextMeeting.date).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Live countdown state.
 * status: 'none' (no date configured) | 'counting' | 'arrived'
 */
export function useCountdown() {
  const target = meetingTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (target === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  if (target === null) return { status: 'none' }
  const diff = target - now
  if (diff <= 0) return { status: 'arrived' }
  const s = Math.floor(diff / 1000)
  return {
    status: 'counting',
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

const nick = (p) => p.nickname || p.name

function Units({ c }) {
  const units = [
    ['days', c.days],
    ['hours', c.hours],
    ['min', c.minutes],
    ['sec', c.seconds],
  ]
  return (
    <div className="countdown-units" role="timer" aria-live="off">
      {units.map(([label, value]) => (
        <div key={label} className="countdown-unit">
          <strong>{String(value).padStart(2, '0')}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

/** Body shared by the panel and the "Same sky" scene. */
export function CountdownBody({ compact = false }) {
  const c = useCountdown()
  const dateLabel =
    c.status !== 'none'
      ? new Date(nextMeeting.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : null
  return (
    <div className={`countdown-body${compact ? ' is-compact' : ''}`}>
      <span className="eyebrow">
        {nick(couple.me)} &amp; {nick(couple.you)} · next time we meet
      </span>
      {c.status === 'counting' && (
        <>
          <Units c={c} />
          <p className="countdown-message">{nextMeeting.message}</p>
          <small className="countdown-when">
            {dateLabel}
            {nextMeeting.place ? ` · ${nextMeeting.place}` : ''}
          </small>
        </>
      )}
      {c.status === 'arrived' && <p className="countdown-message is-big">{nextMeeting.arrivedMessage}</p>}
      {c.status === 'none' && <p className="countdown-message is-big">{nextMeeting.noDateMessage}</p>}
    </div>
  )
}

/** Small pill in the HUD. */
export function CountdownPill() {
  const c = useCountdown()
  const setPanel = useStore((s) => s.setPanel)
  const label =
    c.status === 'counting'
      ? c.days > 0
        ? `${c.days} day${c.days === 1 ? '' : 's'} to go`
        : `${c.hours}h ${c.minutes}m to go`
      : c.status === 'arrived'
        ? 'It’s the day ♡'
        : 'Missing you'
  return (
    <button type="button" className="hud-pill" onClick={() => setPanel('countdown')} aria-label={`Countdown: ${label}`}>
      <CalendarHeart size={14} />
      <span>{label}</span>
    </button>
  )
}

export function CountdownPanel() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  return (
    <AnimatePresence>
      {panel === 'countdown' && (
        <motion.div
          className="panel-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setPanel(null)}
        >
          <motion.div
            className="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Countdown to our next meeting"
            initial={{ y: 30, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-btn panel-close" onClick={() => setPanel(null)} aria-label="Close countdown">
              <X size={18} />
            </button>
            <h2>Until I see you again</h2>
            <CountdownBody />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
