# OUR LITTLE UNIVERSE — A World Made Just for Us ♡

An interactive 3D love letter: a floating island in space, a blossom tree, a bench, floating photo
frames, a letter in a pink envelope, two little islands under the same sky, and one last question
at the end of the glowing path.

Built with **React + Vite + React Three Fiber + Drei + Framer Motion**. There's no backend; it's
just static files.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (add --host to open it from your phone on the same Wi-Fi)
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

Requires Node 20+.

---

## Make it yours (no code changes needed)

Everything personal lives in **`src/content/`** and **`public/`**:

| What | Where |
|---|---|
| Names, cities, icons, the date you started | `src/content/config.js` → `couple` |
| Intro lines and button text | `src/content/config.js` → `intro` |
| Photos, titles, dates and captions | `src/content/config.js` → `memories` + files in `public/photos/` |
| **The love letter** | `src/content/letter.txt` (plain text, blank line = new paragraph) |
| Letter title and signature | `src/content/config.js` → `letter` |
| “Same sky” texts | `src/content/config.js` → `distance` |
| Final message, question, both answers | `src/content/config.js` → `finale` |
| Notes that pop up when you tap a floating heart | `src/content/config.js` → `sweetNotes` |
| Music | `src/content/config.js` → `music` + a file in `public/audio/` |

### Photos
1. Put your pictures in `public/photos/` (JPG/PNG/WebP, about 1200 px on the long side is plenty).
2. Point `src` at them in `memories`, e.g. `src: 'photos/first-date.jpg'`.
3. The first 5 photos also float as 3D frames on the island. Any extra photos still show up in the gallery strip.

If a file is missing, a soft placeholder appears instead of a broken image (and a hint is logged in the console).

### Music
By default a gentle music-box melody is **generated live in the browser**, so no audio file is needed
and there are no licensing questions. To use your own song:

1. Put an audio file you have the rights to use at `public/audio/our-song.mp3`.
2. Set `music.src: 'audio/our-song.mp3'` in `config.js`.

Music never autoplays. It only starts when "Enter Our World ♡" is pressed (turn that off with
`startOnEnter: false`), and the 🎵 button in the top-right corner always toggles it. The 🌬 button
next to it adds soft wind and wind-chimes.

### More places to personalise (all in `config.js`)

| Feature | Config key | Notes |
|---|---|---|
| Memory Lane | `memoryLane.milestones` | `date`, `title`, `story`, `photo` (or `null` for a glowing placeholder) |
| Love Capsule | `loveCapsule.letters` | one “open when…” letter per mood (letters in Bahasa Indonesia) |
| LDR countdown | `nextMeeting` | `date: 'YYYY-MM-DDTHH:mm'` or `null` (shows a miss-you message, never a made-up date) |
| Nicknames | `couple.me.nickname`, `couple.you.nickname` | used in the countdown |
| Hidden hearts | `hiddenHearts.hints`, `hiddenHearts.reward` | reward can include `media: { type: 'image' \| 'video', src }` |
| Our Constellation | `constellation.reasons` | one star per reason, 6–16 works best |
| Finale media | `finale.media` | optional photo/video shown after the answer |

Progress (hearts found, stars lit, envelopes opened, letter read) is saved in the browser.

### Story Mode — “Every Universe Leads to You”

Five chapters, unlocked one after another. Progress is measured from what she actually does
(see `src/lib/story.js`), so nothing is ever marked complete just by opening a panel.

| Chapter | What completes it |
|---|---|
| 1 · The First Page | open 3 memories in the floating frames + visit every Memory Lane lantern |
| 2 · Back in Time | travel to every date in the **Time Machine** |
| 3 · The Red Thread | tie the thread on both islands + open both island messages |
| 4 · Words I Kept for You | read the letter + open 3 Love Capsule envelopes + light every star |
| 5 · Every Universe Leads to You | visit every world in the **Future Simulator** portal |

Each finished chapter lights one ring of the **Heart Reactor** above the island. At 5/5, the reactor
starts the final cutscene (camera spiral, particles, shockwave, music climax), which ends in the
**Secret Room** with your final letter, optional video/voice note, a *Replay the ending* button and
the original “One last question” finale.

Edit in `config.js`:

| What | Key |
|---|---|
| Chapter titles, intro/outro dialog (`{me}` / `{you}` become nicknames) | `story` |
| Dates, titles, narration, photos per date | `timeMachine.entries` |
| Island messages + optional voice notes (`audio: 'audio/…'`) | `redThread.messages` |
| Dream worlds (home, travel, simple moments, wedding) | `futureWorlds.worlds` |
| Reactor texts | `heartReactor` |
| Final letter, signature, optional `video` / `voice` | `finalMessage` |

A voice-note play button only appears when a file is configured, so there are no buttons that don’t do anything.

### Days counter
`couple.since: 'YYYY-MM-DD'` shows “day N of …” in the corner. Set it to `null` to hide it.

---

## How the experience flows

1. **Loading**: a heart fills up while textures and fonts load.
2. **Intro**: stars fade in, a glowing heart appears, the words, then “Enter Our World ♡”.
3. **The island**: drag to look around, pinch or scroll to zoom. Glowing sparkles mark things you can tap:
   - **floating frames** → the memory gallery (swipe or use the arrows; Esc closes)
   - **the envelope on the little table** → the flap opens, the letter rises, and the text types itself out (tap to show it all)
   - **the telescope** → *Same sky*: two islands joined by a ribbon of light
   - **floating hearts** → a small sweet note
   - **the heart arch at the end of the glowing path** → wakes up only after the letter has been opened
4. **Finale**: the screen fades to dark, thousands of tiny hearts gather into one, then the question.
   Both buttons are a yes, and each gets its own reply, confetti and burst of hearts.

The dock at the bottom gives direct access to every place. Progress (whether the letter was read) is
remembered in the browser.

---

## Publish it

The build uses relative paths, so `dist/` works on any static host, even in a sub-folder.

**Vercel**: import the repo, set *Root Directory* to `web3d`, framework preset **Vite**. Done.

**Netlify**: drag-and-drop the `dist/` folder onto <https://app.netlify.com/drop>, or connect the repo
with base directory `web3d`, build command `npm run build` and publish directory `web3d/dist`.

**GitHub Pages**: run `npm run build` and publish the contents of `dist/` (for example with the
`gh-pages` branch or a Pages workflow).

> Photos placed in `public/` become publicly reachable at their URL once deployed. Only add pictures
> you're both comfortable having online, or keep the link private.

---

## Quality and accessibility notes

- **Phones & tablets**: lower particle counts, smaller shadow maps and adaptive resolution. The camera
  re-frames every scene for portrait screens.
- **Reduced motion**: with the OS setting “reduce motion” on, camera moves are short, nothing spins,
  text appears instantly and confetti is minimal.
- **No WebGL?** A complete 2D version (same content, same order) is shown automatically.
- No API keys, trackers or external requests. Fonts are bundled, and all 3D assets are generated in code.

## Project structure

```
src/
  content/        ← your words, photos list, music settings, letter.txt
  components/
    three/        ← 3D scene: island, tree, letter table, frames, distance, finale…
    ui/           ← overlays: loading, intro, HUD, gallery, letter, finale, 2D fallback
  audio/engine.js ← generated music + ambient sound (Web Audio)
  lib/            ← layout & camera poses, geometry helpers, textures, device tiers
  store.js        ← app state (zustand)
```
