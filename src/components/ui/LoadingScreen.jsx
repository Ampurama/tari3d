import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import { useStore } from '../../store'

const MIN_TIME = 1600

/** Quiet loading screen with a real progress indicator (textures, fonts) and a heart that fills up. */
export default function LoadingScreen({ trackAssets = true }) {
  const { progress, active } = useProgress()
  const phase = useStore((s) => s.phase)
  const setPhase = useStore((s) => s.setPhase)
  const sceneReady = useStore((s) => s.sceneReady)
  const [shown, setShown] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)
  const start = useRef(performance.now())

  useEffect(() => {
    let alive = true
    const done = () => alive && setFontsReady(true)
    if (document.fonts?.ready) document.fonts.ready.then(done, done)
    else done()
    const t = setTimeout(done, 4000) // never wait forever on fonts
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'loading') return
    let raf
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.5, (now - last) / 1000) // time-based, so slow devices don't load slower
      last = now
      const elapsed = now - start.current
      const assetsDone = !trackAssets || (sceneReady && !active && (progress === 100 || progress === 0))
      const real = trackAssets ? (assetsDone ? 100 : progress) : 100
      const ready = assetsDone && fontsReady
      // never jump ahead of time, never stall at 100 before everything is ready
      const timeCap = Math.min(100, (elapsed / MIN_TIME) * 100)
      const target = Math.min(ready ? 100 : 96, real * 0.85 + (fontsReady ? 15 : 0), timeCap)
      setShown((s) => {
        const next = s + (target - s) * (1 - Math.exp(-dt * 5)) + (target > s ? dt * 9 : 0)
        return Math.min(target, next)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, progress, active, fontsReady, trackAssets, sceneReady])

  useEffect(() => {
    if (phase === 'loading' && shown >= 99.5) {
      const t = setTimeout(() => setPhase('intro'), 450)
      return () => clearTimeout(t)
    }
  }, [shown, phase, setPhase])

  const pct = Math.round(shown)

  return (
    <AnimatePresence>
      {phase === 'loading' && (
        <motion.div
          className="loading"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.2, ease: 'easeInOut' } }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Loading our little universe"
        >
          <svg className="loading-heart" viewBox="0 0 100 92" aria-hidden="true">
            <defs>
              <clipPath id="heart-clip">
                <path d="M50 88 C20 66 4 50 4 28 C4 13 15 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C85 4 96 13 96 28 C96 50 80 66 50 88 Z" />
              </clipPath>
              <linearGradient id="heart-fill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#ff8fc4" />
                <stop offset="1" stopColor="#c9a8ff" />
              </linearGradient>
            </defs>
            <path
              d="M50 88 C20 66 4 50 4 28 C4 13 15 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C85 4 96 13 96 28 C96 50 80 66 50 88 Z"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="2"
            />
            <g clipPath="url(#heart-clip)">
              <rect x="0" y={92 - (92 * shown) / 100} width="100" height="92" fill="url(#heart-fill)" opacity="0.9" />
            </g>
          </svg>
          <p className="loading-text">Gathering stardust…</p>
          <div className="loading-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${shown / 100})` }} />
          </div>
          <p className="loading-pct">{pct}%</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
