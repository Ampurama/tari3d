import * as THREE from 'three'

const cache = new Map()

function canvasTexture(key, size, draw, { srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  cache.set(key, texture)
  return texture
}

/** Classic parametric heart, centred, fitted inside `size`. */
export function traceHeart(ctx, cx, cy, size) {
  const s = size / 34
  ctx.beginPath()
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    const px = cx + x * s
    const py = cy - (y + 2) * s
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export const heartTexture = () =>
  canvasTexture('heart', 128, (ctx, size) => {
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = size * 0.08
    ctx.fillStyle = '#ffffff'
    traceHeart(ctx, size / 2, size / 2, size * 0.72)
    ctx.fill()
  })

export const glowTexture = () =>
  canvasTexture('glow', 128, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.18, 'rgba(255,255,255,0.75)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  })

/**
 * A soft round contact shadow, as an alpha map (alpha maps read brightness, so it's drawn as an
 * opaque white-to-black gradient): dark right in the middle, fading smoothly to nothing.
 */
export const shadowTexture = () =>
  canvasTexture(
    'contact-shadow',
    64,
    (ctx, size) => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, size, size)
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      g.addColorStop(0, 'rgb(255,255,255)')
      g.addColorStop(0.35, 'rgb(204,204,204)')
      g.addColorStop(0.7, 'rgb(72,72,72)')
      g.addColorStop(1, 'rgb(0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    },
    { srgb: false },
  )

export const petalTexture = () =>
  canvasTexture('petal', 64, (ctx, size) => {
    ctx.translate(size / 2, size / 2)
    ctx.rotate(-0.5)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.42)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0.55)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.42, size * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
  })

export const cloudTexture = (seed = 1) =>
  canvasTexture(`cloud-${seed}`, 256, (ctx, size) => {
    let s = seed * 9301 + 17
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    for (let i = 0; i < 14; i++) {
      const x = size * (0.22 + rand() * 0.56)
      const y = size * (0.4 + rand() * 0.22)
      const r = size * (0.12 + rand() * 0.16)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.42)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }
  })

export const moonTexture = () =>
  canvasTexture('moon', 512, (ctx, size) => {
    ctx.fillStyle = '#fff6e8'
    ctx.fillRect(0, 0, size, size)
    let s = 4242
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    // soft maria
    for (let i = 0; i < 9; i++) {
      const x = rand() * size
      const y = size * (0.25 + rand() * 0.5)
      const r = size * (0.06 + rand() * 0.12)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(214,190,214,0.45)')
      g.addColorStop(1, 'rgba(214,190,214,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }
    // tiny craters
    for (let i = 0; i < 60; i++) {
      const x = rand() * size
      const y = size * (0.15 + rand() * 0.7)
      const r = 2 + rand() * size * 0.018
      ctx.fillStyle = `rgba(200,180,205,${0.15 + rand() * 0.25})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  })

/** Used when a photo can't be loaded, so the gallery never shows a broken image. */
export const photoFallbackTexture = () =>
  canvasTexture('photo-fallback', 512, (ctx, size) => {
    const g = ctx.createLinearGradient(0, 0, size * 0.4, size)
    g.addColorStop(0, '#2a2350')
    g.addColorStop(0.6, '#b9a3e3')
    g.addColorStop(1, '#f9c6d9')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = size * 0.02
    traceHeart(ctx, size / 2, size / 2, size * 0.32)
    ctx.stroke()
  })
