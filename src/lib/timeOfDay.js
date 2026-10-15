import * as THREE from 'three'
import { create } from 'zustand'

/*
 * TIME OF DAY — morning, midday, afternoon and night over the meadow.
 *
 *   'cycle'  the day goes by on its own: one whole day in 24 minutes (a minute an hour), from morning
 *   'real'   the sky follows the clock on her phone (so it's night in the game when it's night outside)
 *   'pagi' | 'siang' | 'sore' | 'malam'   held at that time
 *
 * The chosen mode is remembered on this device. Places with a mood of their own (the night pier,
 * the sunset garden, a date, a cutscene) still bring their own sky while she's there.
 */

const KEY = 'our-little-universe:time'
export const TIME_MODES = ['cycle', 'real', 'pagi', 'siang', 'sore', 'malam']
export const TIME_LABELS = { cycle: 'Otomatis', real: 'Ikut jam', pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam' }
const PRESET_HOURS = { pagi: 7.2, siang: 12.5, sore: 17.6, malam: 22 }
/** How long a whole day takes in 'cycle' mode (seconds). */
export const DAY_SECONDS = 24 * 60
/** The day starts in the morning when the game opens. */
const START_HOUR = 7

const load = () => {
  try {
    const m = localStorage.getItem(KEY)
    return TIME_MODES.includes(m) ? m : 'cycle'
  } catch {
    return 'cycle'
  }
}

export const useTimeOfDay = create((set) => ({
  mode: load(),
  setMode: (mode) => {
    if (!TIME_MODES.includes(mode)) return
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      // private window: it just won't be remembered
    }
    set({ mode })
  },
}))

const started = typeof performance !== 'undefined' ? performance.now() : 0

/** The hour of the day (0–24) right now, for the current mode. */
export function currentHour() {
  const { mode } = useTimeOfDay.getState()
  if (PRESET_HOURS[mode] !== undefined) return PRESET_HOURS[mode]
  if (mode === 'real') {
    const d = new Date()
    return d.getHours() + d.getMinutes() / 60
  }
  const seconds = (performance.now() - started) / 1000
  return (START_HOUR + (seconds / DAY_SECONDS) * 24) % 24
}

/** Which part of the day an hour belongs to. */
export function partOfDay(hour) {
  if (hour >= 5 && hour < 10.5) return 'pagi'
  if (hour >= 10.5 && hour < 15) return 'siang'
  if (hour >= 15 && hour < 19.25) return 'sore'
  return 'malam'
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
const bell = (x, centre, width) => Math.exp(-(((x - centre) / width) ** 2))

/**
 * The sky for an hour: `day` (1 bright … 0.12 night) and `sunset` (warm light low in the sky:
 * a soft peach in the morning, gold and pink late in the afternoon, a hint of violet at night).
 */
export function skyAtHour(hour) {
  const light = Math.min(smooth(5, 7, hour), 1 - smooth(18, 19.6, hour))
  const day = 0.12 + 0.88 * light
  const morning = bell(hour, 6.6, 1.3) * 0.5
  // the afternoon slowly warms, then the evening turns gold and pink
  const evening = Math.max(bell(hour, 17.9, 1.5) * 0.95, 0.28 * smooth(14, 16.8, hour) * (1 - smooth(19, 20, hour)))
  const sunset = Math.max(morning, evening, 0.25 * (1 - light))
  return { day, sunset }
}

/**
 * Where the light comes from at an hour: the sun rises on the right of the island (east), climbs high
 * at midday and sets on the left (west), always a little in front so faces stay lit; at night the
 * moon, high on the left behind the island.
 */
const MOON_DIR = new THREE.Vector3(-0.45, 0.55, -0.7).normalize()
export function lightDirAtHour(hour, out) {
  const t = (hour - 5.6) / (19.2 - 5.6)
  if (t <= 0 || t >= 1) return out.copy(MOON_DIR)
  const a = Math.PI * t
  out.set(Math.cos(a) * 0.9, 0.18 + Math.sin(a) * 0.82, 0.5)
  // just before sunrise / just after sunset, blend toward the moon
  const edge = Math.min(smooth(0, 0.06, t), 1 - smooth(0.94, 1, t))
  return out.normalize().lerp(MOON_DIR, 1 - edge).normalize()
}
