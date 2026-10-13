import { useEffect, useRef } from 'react'
import { useStore } from '../../store'

const COLORS = ['#ff8fc4', '#ffb6d5', '#c9a8ff', '#f3cf8a', '#ffffff', '#a985ff']

function drawHeart(ctx, size) {
  const s = size / 2
  ctx.beginPath()
  ctx.moveTo(0, s * 0.35)
  ctx.bezierCurveTo(-s * 1.1, -s * 0.4, -s * 0.45, -s * 1.15, 0, -s * 0.45)
  ctx.bezierCurveTo(s * 0.45, -s * 1.15, s * 1.1, -s * 0.4, 0, s * 0.35)
  ctx.fill()
}

/** Canvas confetti of hearts and ribbons. Fire by changing `burstKey`. */
export default function Confetti({ burstKey }) {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)

  useEffect(() => {
    if (!burstKey) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.width / dpr
    const H = () => canvas.height / dpr
    const n = reducedMotion ? 40 : window.innerWidth < 600 ? 110 : 180
    const pieces = Array.from({ length: n }, (_, i) => {
      const fromLeft = i % 2 === 0
      const angle = (fromLeft ? -1 : 1) * (0.35 + Math.random() * 0.55) - Math.PI / 2
      const speed = (reducedMotion ? 4 : 9) + Math.random() * 8
      return {
        x: fromLeft ? W() * 0.12 : W() * 0.88,
        y: H() * 0.85,
        vx: Math.cos(angle) * speed * -1 * (fromLeft ? -1 : 1) * (fromLeft ? 1 : -1),
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 9,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        heart: Math.random() < 0.55,
        color: COLORS[i % COLORS.length],
        life: 0,
      }
    })
    pieces.forEach((p, i) => {
      // aim pieces inward from both corners
      p.vx = Math.abs(p.vx) * (i % 2 === 0 ? 1 : -1)
    })

    let raf
    const start = performance.now()
    const frame = (now) => {
      const t = now - start
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W(), H())
      pieces.forEach((p) => {
        p.vy += 0.22
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx + Math.sin((t / 400) + p.size) * 0.4
        p.y += p.vy
        p.rot += p.vr
        const alpha = Math.max(0, 1 - Math.max(0, t - 3200) / 1300)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.heart) drawHeart(ctx, p.size * 1.3)
        else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      })
      if (t < 4600) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, W(), H())
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [burstKey, reducedMotion])

  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}
