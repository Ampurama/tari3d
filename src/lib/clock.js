/*
 * SHARED CLOCK — the same "now" in both games.
 * Local time plus the offset to the server's clock (measured by the hot air balloon when you're
 * connected, see lib/balloon.js). Until then the phone's own clock is used, which is network time.
 */
let offset = 0

/** server time − local time (ms) */
export const setClockOffset = (ms) => {
  offset = ms
}

/** Now, in ms, on the shared clock. */
export const serverNow = () => Date.now() + offset
