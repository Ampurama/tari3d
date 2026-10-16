import * as THREE from 'three'
import { couple } from '../content/config'
import { serverNow } from './clock'

/*
 * TIME OF DAY — morning, midday, afternoon and night over the meadow, following the real clock.
 *
 * The hour is the real time in one shared time zone (couple.worldClock in content/config.js, WITA by
 * default), read from the shared clock (lib/clock.js) — so both of you always see the same sky at
 * the same moment: when it's evening in Makassar, it's evening in your little universe for both.
 * Places with a mood of their own (the night pier, the sunset garden, a date, a cutscene) still
 * bring their own sky while you're there.
 */

const UTC_OFFSET = couple.worldClock?.utcOffset ?? 8
export const CLOCK_LABEL = couple.worldClock?.label ?? 'WITA'
export const PART_LABELS = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam' }

/** The hour of the day (0–24) right now, on the world clock. */
export function currentHour() {
  const hours = serverNow() / 3600000 + UTC_OFFSET
  return ((hours % 24) + 24) % 24
}

/** The hour of the day (0–24) at a moment (ms on the shared clock). */
export const hourAt = (ms) => (((ms / 3600000 + UTC_OFFSET) % 24) + 24) % 24

/** The world clock as text, e.g. "17:42 WITA". */
export function clockText() {
  const h = currentHour()
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${CLOCK_LABEL}`
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
