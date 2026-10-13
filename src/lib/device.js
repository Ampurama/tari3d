const hasWindow = typeof window !== 'undefined'

export const isTouch = hasWindow && window.matchMedia?.('(pointer: coarse)').matches

const smallScreen = hasWindow && Math.min(window.innerWidth, window.innerHeight) < 700
const fewCores = hasWindow && (navigator.hardwareConcurrency || 4) <= 4

/** 'high' on laptops/desktops, 'low' on phones and modest hardware. */
export const tier = isTouch || smallScreen || fewCores ? 'low' : 'high'

/** Scale a particle count for the current device. */
export const count = (high, low = Math.round(high * 0.45)) => (tier === 'high' ? high : low)

export function hasWebGL() {
  if (!hasWindow) return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
}

/** Days since a YYYY-MM-DD date (inclusive of today), or null. */
export function daysSince(dateString) {
  if (!dateString) return null
  const start = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const diff = Math.floor((Date.now() - start.getTime()) / 86400000) + 1
  return diff > 0 ? diff : null
}
