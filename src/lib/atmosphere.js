import { CINE, cineTime, windowAt } from './cinematic'
import { journeyProgress } from './story'

/*
 * TIME OF DAY — one shared state for the sky, the sun, the lanterns and the fog of distance.
 *   day:    1 = bright daytime, 0 = night (only the star-gazing set pieces are at night)
 *   sunset: 0 = midday, 1 = golden sunset
 * The island is a bright day by default; it warms toward afternoon as the story goes on,
 * turns golden at the picnic's sunset, and is a pastel golden dusk for the finale.
 * The sky writes these every frame (eased); everything else reads them.
 */
export const atmosphere = { day: 1, sunset: 0, mood: null, place: null, travel: null, scene: null }

/** Places that are meant to be seen at night: the constellation, the old heart finale, the secret room. */
const NIGHT_VIEWS = new Set(['constellation', 'finale', 'finalRoom'])

/** Where the time of day wants to be, for the current state. */
export function atmosphereTarget(s, clockSeconds) {
  const day = NIGHT_VIEWS.has(s.view) ? 0 : s.view === 'intro' || s.view === 'avatar' ? 0.4 : 1
  let sunset
  if (s.view === 'cinematic') sunset = 0.15 + 0.85 * windowAt(CINE.sunset, cineTime(clockSeconds))
  else if (s.view === 'ending' || s.view === 'epilogue') sunset = 0.9
  else if (s.view === 'picnic' && s.picnicStage === 'sunset') sunset = 0.85
  else if (s.mainEndingSeen) sunset = 0.5
  // morning → warm afternoon over the journey (never darker, only warmer)
  else sunset = journeyProgress(s) * 0.4
  // a cutscene paints its own sky
  if (s.view === 'cutscene' && atmosphere.scene) return { day: atmosphere.scene.day ?? day, sunset: atmosphere.scene.sunset ?? sunset }
  // a date can ask for its own sky while it's on (a sunset picnic, a night of camping),
  // and so can a place (golden hour up on Sky Island, a starry sky at its telescope)
  const m = s.view === 'explore' && (atmosphere.mood || atmosphere.travel || atmosphere.place)
  if (m) return { day: m.day ?? day, sunset: m.sunset ?? sunset }
  return { day, sunset }
}
