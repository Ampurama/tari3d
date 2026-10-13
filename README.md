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

### The game — “Every Little Thing Leads to You”

After the intro she **chooses a character** (`avatars` in `config.js`: names, outfit, colours, hair —
stylised little souls, not portraits) and walks around a large island with zones: the Starting Meadow,
the Memory Garden, the Heartwood Forest, Reflection Lake (with a bridge and a waterfall), Starfall Cliff,
a Secret Cove behind a rock arch, and the **Central Love Tree**, which grows with her progress.

| Chapter | What she does (measured from real actions — never faked) |
|---|---|
| 1 · The Little Things | find 5 objects: a photograph (garden), a letter in a bottle (lake), a sleeping flower (forest), a music box (cliff), a fallen star (meadow) |
| 2 · Miles Between Us | through the telescope on Starfall Cliff: restore Trust, Communication, Patience, Understanding and Effort to build the bridge between two islands |
| 3 · A Future We Grow | find 5 glowing seeds and grow each in its own plot by the Love Tree (hold to plant, fetch lake water, light two stones, stay with it, connect the four lights) |

Then the **final cinematic** (“You were the meaning all along”), the **love letter** (`loveLetter`:
greeting, body, `personalNote`, photo, optional `voice`), and — touching the little star by the Love
Tree afterwards — the optional **secret ending** (`secretEnding`). Both can be replayed from the Story
book; “Start the story over…” there is the only way to reset (it asks first).

Controls: **WASD / arrow keys** (Shift to run), drag to look, scroll/pinch to zoom, **E** to interact,
or click/tap something to walk to it. On phones: joystick + the ✦ button.

| Edit in `config.js` | Key |
|---|---|
| Characters | `avatars`, `avatarSelect` |
| Chapter titles and dialog (`{me}` / `{you}` become nicknames) | `story` |
| The five little things (titles, messages, the photo) | `littleThings` |
| The five connections (instructions, messages) | `connections` |
| The island messages + optional voice notes | `redThread.messages` |
| The five seeds | `seeds` |
| Hidden notes, Starfall Cliff text | `hiddenNotes`, `viewpoint` |
| Cinematic captions and title | `finalCinematic` |
| The love letter | `loveLetter` |
| Secret ending (message, letter, voice, photo) | `secretEnding` |

Older features are still there as optional extras (Places menu, or found while exploring): the photo
frames, Memory Lane, Love Capsule (on the garden bench), Time Machine, Future Simulator portal,
constellation, hidden hearts, the letter on the meadow table and the heart arch in the cove.

### Days counter
`couple.since: 'YYYY-MM-DD'` shows “day N of …” in the corner. Set it to `null` to hide it.

---

## How the experience flows

1. **Loading**: a heart fills up while textures and fonts load.
2. **Intro**: stars fade in, a glowing heart appears, the words, then “Enter Our World ♡”.
3. **Character selection** → the Starting Meadow.
4. **Three chapters** (see above), with dialog, discoveries and a story book (📖) showing real progress.
5. **Final cinematic → love letter → (optional) secret ending.**

Progress, the chosen character and sound settings are remembered in the browser.

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
- **No WebGL?** A complete 2D version is shown automatically — the three chapters can be played with buttons and the ending and secret ending still work.
- No API keys, trackers or external requests. Fonts are bundled, and all 3D assets are generated in code.

## Project structure

```
src/
  content/        ← your words, photos list, music settings, letter.txt
  components/
    three/        ← 3D: terrain, vegetation, Love Tree, avatar + controller, chapters, camera…
    ui/           ← overlays: avatar select, HUD & touch controls, story, chapters, ending, 2D fallback
  audio/engine.js ← generated music + ambient sound (Web Audio)
  lib/            ← terrain, layout & camera poses, player/input, interactions, story, cinematic
  store.js        ← app state (zustand)
```
