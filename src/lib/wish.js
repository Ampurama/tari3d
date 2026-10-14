import { create } from 'zustand'
import { useStore } from '../store'
import { audio } from '../audio/engine'

/*
 * A letter shown in the western isles (the pier, the middle of the bridge). Only on the screen of the
 * person who opened it: nothing here is sent to the other person. It's an ordinary panel ('wish'),
 * so the avatar waits while it's open and Escape closes it like every other panel.
 */
export const useWish = create(() => ({ letter: null }))

/** Open a letter: { title, text, place }. */
export function openWish(letter) {
  useWish.setState({ letter })
  audio.sparkle()
  const s = useStore.getState()
  if (s.panel !== 'wish') s.setPanel('wish')
}
