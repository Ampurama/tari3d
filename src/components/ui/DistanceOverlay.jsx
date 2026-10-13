import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { couple, distance } from '../../content/config'
import { useStore } from '../../store'
import { CountdownBody } from './Countdown'
import RedThreadUI from './RedThreadUI'

/** 2D version of the two islands, used when 3D isn't available. */
function FlatIllustration() {
  return (
    <div className="flat-distance">
      <svg viewBox="0 0 400 180" role="img" aria-label={`${couple.me.name} in ${couple.me.place} and ${couple.you.name} in ${couple.you.place}, connected by light`}>
        <defs>
          <linearGradient id="beam" x1="0" x2="1">
            <stop offset="0" stopColor="#ff8fc4" />
            <stop offset="1" stopColor="#a985ff" />
          </linearGradient>
        </defs>
        <path id="arc" d="M70 110 Q200 -10 330 110" fill="none" stroke="url(#beam)" strokeWidth="3" strokeLinecap="round" className="flat-beam" />
        <circle r="5" fill="#fff">
          <animateMotion dur="3.2s" repeatCount="indefinite">
            <mpath href="#arc" />
          </animateMotion>
        </circle>
        {[70, 330].map((x, i) => (
          <g key={x}>
            <ellipse cx={x} cy="128" rx="42" ry="10" fill={i ? '#b7a4ea' : '#f3bdd6'} />
            <path d={`M${x - 40} 128 Q${x} 175 ${x + 40} 128 Z`} fill="#6e5aa8" />
            <circle cx={x} cy="110" r="9" fill={i ? '#d9c2ff' : '#ffc4dc'} />
          </g>
        ))}
      </svg>
      <div className="flat-names">
        <span>
          {couple.me.icon} <strong>{couple.me.name}</strong> <small>{couple.me.place}</small>
        </span>
        <span>
          {couple.you.icon} <strong>{couple.you.name}</strong> <small>{couple.you.place}</small>
        </span>
      </div>
    </div>
  )
}

export default function DistanceOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [step, setStep] = useState(0)
  const open = view === 'distance'

  useEffect(() => {
    if (!open) {
      setStep(0)
      return
    }
    const times = reducedMotion || flat ? [100, 500, 1100] : [1300, 2600, 5200]
    const timers = times.map((t, i) => setTimeout(() => setStep(i + 1), t))
    return () => timers.forEach(clearTimeout)
  }, [open, reducedMotion, flat])

  const show = (n) => ({
    initial: { opacity: 0, y: 10, filter: 'blur(6px)' },
    animate: step >= n ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 10, filter: 'blur(6px)' },
    transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.section className="distance-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.span className="eyebrow" {...show(1)}>
            {distance.heading}
          </motion.span>
          <motion.h2 {...show(2)}>{distance.line1}</motion.h2>
          {flat && <FlatIllustration />}
          <RedThreadUI flat={flat} />
          <motion.p {...show(3)}>{distance.line2}</motion.p>
          <motion.div className="distance-countdown" {...show(3)}>
            <CountdownBody compact />
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
