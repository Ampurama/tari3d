import * as THREE from 'three'
import { CINE, cineTime, windowAt } from './cinematic'
import { journeyProgress } from './story'
import { currentHour, lightDirAtHour, skyAtHour } from './timeOfDay'

/*
 * TIME OF DAY — one shared state for the sky, the sun, the lanterns and the fog of distance.
 *   day:    1 = bright daytime, 0 = night (0.12 is a moonlit night in the meadow)
 *   sunset: 0 = midday, 1 = golden sunset
 *   sunDir: where the light comes from (the sun crossing the sky, or the moon)
 * Out in the world the hour comes from lib/timeOfDay.js (morning, midday, afternoon, night — on its
 * own, following the clock, or held). The story's own moments keep their skies: the star-gazing
 * places are at night, the final cinematic and the ending are golden, and a cutscene, a date or a
 * place (the night pier, the sunset garden, Sky Island) can bring its own.
 * The sky writes these every frame (eased); everything else reads them.
 */
const DEFAULT_SUN = new THREE.Vector3(0.55, 0.62, 0.56).normalize()
export const atmosphere = { day: 1, sunset: 0, mood: null, place: null, travel: null, scene: null, hour: 12, sunDir: DEFAULT_SUN.clone() }

/** Places that are meant to be seen at night: the constellation, the old heart finale, the secret room. */
const NIGHT_VIEWS = new Set(['constellation', 'finale', 'finalRoom'])
/** The story's golden moments: always in warm daylight, whatever the hour. */
const STORY_VIEWS = new Set(['cinematic', 'ending', 'epilogue'])

/** Where the time of day wants to be, for the current state. */
export function atmosphereTarget(s, clockSeconds) {
  const hour = currentHour()
  atmosphere.hour = hour
  const tod = skyAtHour(hour)
  const day = NIGHT_VIEWS.has(s.view) ? 0 : s.view === 'intro' || s.view === 'avatar' ? 0.4 : STORY_VIEWS.has(s.view) ? 1 : tod.day
  let sunset
  if (s.view === 'cinematic') sunset = 0.15 + 0.85 * windowAt(CINE.sunset, cineTime(clockSeconds))
  else if (s.view === 'ending' || s.view === 'epilogue') sunset = 0.9
  else if (s.view === 'picnic' && s.picnicStage === 'sunset') sunset = 0.85
  // the hour's own warmth, a little warmer by day as the journey goes on
  else sunset = Math.max(tod.sunset, (s.mainEndingSeen ? 0.35 : journeyProgress(s) * 0.3) * tod.day)
  // a cutscene paints its own sky
  if (s.view === 'cutscene' && atmosphere.scene) return { day: atmosphere.scene.day ?? day, sunset: atmosphere.scene.sunset ?? sunset }
  // a date can ask for its own sky while it's on (a sunset picnic, a night of camping),
  // and so can a place (golden hour up on Sky Island, a starry sky at its telescope)
  const m = s.view === 'explore' && (atmosphere.mood || atmosphere.travel || atmosphere.place)
  if (m) return { day: m.day ?? day, sunset: m.sunset ?? sunset }
  return { day, sunset }
}

/** Where the light should come from now (the sky eases toward it, the sun reads it). */
export function targetLightDir(s, out) {
  const own = STORY_VIEWS.has(s.view) || NIGHT_VIEWS.has(s.view) || s.view === 'intro' || s.view === 'avatar' || s.view === 'cutscene'
  const m = s.view === 'explore' && (atmosphere.mood || atmosphere.travel || atmosphere.place)
  // the story's moments and places with a mood keep the classic three-quarter light (lower toward sunset)
  if (own || m) return out.set(DEFAULT_SUN.x, DEFAULT_SUN.y * (1 - 0.45 * atmosphere.sunset * atmosphere.day), DEFAULT_SUN.z).normalize()
  return lightDirAtHour(atmosphere.hour, out)
}
