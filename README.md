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

### The game — “A Little World Made for You”

After the intro she **chooses a character** (`avatars` in `config.js`: names, outfit, colours, hair —
stylised little souls, not portraits) and walks around a small island with zones: the Starting Meadow,
the Memory Garden, Our Memories (the photo plaza), the Heartwood Forest, Reflection Lake (with a bridge
and a waterfall), Starfall Cliff, the picnic terrace, the Secret Cove, and the **Central Love Tree**,
which grows with her progress. **Mochi**, a small fluffy heart (`companion`), follows her everywhere,
cheers far too hard and gets things funnily wrong. Five short chapters (about 10–15 minutes):

| Chapter | What she does (measured from real actions — never faked) |
|---|---|
| 1 · The Goofy Beginning | wake Mochi (napping next to the start — this is the tutorial), then pick 3 glowing flowers in the meadow; Mochi gives her the first memory (`memories[0]`) |
| 2 · Little Things About You | find 5 objects: a photograph (garden), a letter in a bottle (lake), a sleeping flower (forest), a music box (cliff), a fallen star (meadow) |
| 3 · A Little Far, Never Apart | through the telescope on Starfall Cliff: restore Trust, Communication, Patience, Understanding and Effort to build the bridge between two islands (Mochi "helps") |
| 4 · The Disaster Date | the picnic terrace: catch 3 flying flowers, save the sandwich from a tiny thief, put the picnic back together — then sunset and `picnic.message` |
| 5 · A Letter From the Future | Mochi finds an envelope beneath the Love Tree → the love letter → the finale |

**The finale** (“A Little World Made for You”): the camera glides to the tree, Mochi sits beside her,
the island's lanterns light up one by one, a few fireflies, the tree blooms and a heart of lights
rises, the sky turns into a pink/purple/gold sunset, then `finalMessage.lines` appear one by one.
It can be skipped to the message; afterwards she can replay it, revisit the memories, read the letter
again or stay. Optional extras: a **tiny secret heart** behind the big blossom tree in the Memory Garden
(`secretHeart`), and the older secret ending (the little star by the Love Tree after the finale).
“Start the story over…” in the Story book is the only way to reset (it asks first).

**Look and time of day.** The island is a bright pastel day (blue sky, warm sun, fresh greens, turquoise water), with butterflies, bees, birds, falling leaves, mushrooms, lily pads, benches by the lake and on the cliff, a flower arch into the Memory Garden and a tiny mailbox. It warms toward a peach afternoon as the story goes on, turns golden at the picnic sunset and is a golden dusk for the finale; only the star-gazing places (constellation, the old heart finale, the secret room) are at night. Colours and timing: `src/lib/atmosphere.js`, `src/components/three/Sky.jsx`, `Atmosphere.jsx`.

The island reflects her progress: more path lanterns burn, the sky grows warmer, the Love Tree blooms,
and the three glowing flowers are replanted at its foot.

Controls: **WASD / arrow keys** (Shift to run), drag to turn the island, scroll/pinch to zoom, **E** to
interact, **Escape** to pause (sound settings), or click/tap something to walk to it. On phones: joystick
+ the ✦ button. Stuck? **💡 Hint** in the dock says what to do next, and can walk her there.

**Camera — a miniature you can spin.** By default the whole island is in view (about 40° above the
ground, gentle perspective). Drag to turn it all the way around, scroll / pinch to zoom — the closer
you zoom, the more tightly the camera follows the avatar; the **Island** button flies back to the
whole-island view. Arriving on the island sweeps once around it, and after ~16 s without input the
island slowly turns by itself. Chapter 3 (the bridge) can be turned and zoomed a little too. Tune it in
`src/lib/iso.js` (`ISO.elevation`, `ISO.fov`, `ISO.follow`, `ISO.zoomIn`, `ISO.idleSpin`). Place names
on the map come from `placeNames` in `config.js`. Tapping somewhere (or **Take me there** in a hint)
walks around trees, water and cliffs (`src/lib/path.js`).

| Edit in `config.js` | Key |
|---|---|
| Characters | `avatars`, `avatarSelect` |
| Chapter titles and dialog (`{me}` / `{you}` become nicknames) | `story` |
| The five little things (titles, messages, the photo) | `littleThings` |
| The five connections (instructions, messages) | `connections` |
| The island messages + optional voice notes | `redThread.messages` |
| Mochi's name and every line it says | `companion` |
| The three glowing flowers (colours) | `glowFlowers` |
| The picnic mini-games (titles, instructions, funny lines) and its message | `picnic` |
| The envelope label | `envelope` |
| The finale's last words and its buttons | `finalMessage` |
| The tiny secret heart | `secretHeart` |
| Hidden notes, Starfall Cliff text | `hiddenNotes`, `viewpoint` |
| Finale captions and title | `finalCinematic` |
| The love letter | `loveLetter` |
| Secret ending (message, letter, voice, photo) | `secretEnding` |

Older features are still there as optional extras (Places menu, or found while exploring): the photo
frames, Memory Lane, Love Capsule (on the garden bench), Time Machine, Future Simulator portal,
constellation, hidden hearts, the letter on the meadow table and the heart arch in the cove.

### Days counter
`couple.since: 'YYYY-MM-DD'` shows “day N of …” in the corner. Set it to `null` to hide it.

---

## Playing together (private, for exactly two people)

**Main berdua ♡** (in the pause menu) lets you and Tari see each other's characters on the island in
real time, and send **letters in a bottle**: write one at the little dock on the river by Reflection
Lake, and it washes up in the other person's lake. It is invite-only and enforced on the server
(Supabase Auth + Row Level Security + Realtime authorization) — see
`supabase/migrations/001_private_couple.sql`. Without the two environment variables below the
feature stays off and the game is single-player as always.

**Setup (once):**
1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email**: keep it on, and turn **off** "Allow new users to sign up".
   **Authentication → Users → Add user**: create your account and Tari's (email + password, auto-confirm).
   Optionally, for step 6, also create a third throw-away "outsider" account.
3. **SQL Editor**: paste and run `supabase/migrations/001_private_couple.sql`, then run the two
   `insert into public.couple_members …` lines at the bottom of that file with your two emails.
4. **Realtime → Settings**: turn **off** "Allow public access" (private channels only).
5. Copy `.env.example` to `.env.local` and fill in the Project URL and the **publishable** key
   (`sb_publishable_…`, or the legacy **anon** key as `VITE_SUPABASE_ANON_KEY`) from
   Project Settings → API. Add the same two variables in Vercel → Project → Settings → Environment
   Variables and redeploy. Never use the `service_role` / secret key in the website.
6. Verify it's really private (signs in as both of you, and as the outsider if you made one, and
   tries to get in): create `scripts/verify.env` (see the top of `scripts/verify-private-room.mjs`)
   and run `node --env-file=scripts/verify.env scripts/verify-private-room.mjs`. Every line must say
   PASS (outsider lines say SKIP without that account). It leaves a `[test]` letter you can delete
   in Table Editor → `bottles`.

### Our Little Home (Rumah Kita)

A small island of its own north of the main island, reached by a rope bridge across the sky (follow
the path north from the Love Tree). The two of you build and decorate **one shared house** there:

1. **Lahan kosong**: an empty plot. Press **Bangun Rumah** at the sign.
2. **Pondok kecil**: walls, a roof, windows and a door. You can walk in; the roof lifts away and the walls
   facing the camera fold down so the rooms can be seen. **Dekorasi Rumah** opens the catalog
   (bed, sofa, table, chair, rug, lamps, plant, bookshelf, wall frame, heart lamp, teddy, vase).
3. **Rumah yang terisi** (after 3 pieces of furniture): warm lights inside, and garden decorations open up.
4. **Taman yang cantik** (after 2 garden decorations): flowers around the house, an arch by the bridge, and
   the **memory corner**: a frame with a title, a special date (picked by the owner) and a short message.
5. **Rumah kita** (once the memory corner has a title): fairy lights and keepsakes.

Decorating: pick something, tap the floor (or move the mouse) to place it, **Putar** turns it, **Tempatkan**
saves it, **Batalkan** cancels. Tap something already placed to move or remove it. On a keyboard: arrows / WASD
move it, R turns, Enter places, Esc backs out.

Everything is stored in Supabase and shared live: run `supabase/migrations/002_our_home.sql` once in the SQL
Editor (after 001). The database checks membership, the allowed furniture types and the placement bounds,
lets the stage go up only one step at a time (and only once if you both press it), and refuses a move made on
an outdated copy of an item, so simultaneous edits never overwrite each other silently. While one of you is
holding an item, the other can't pick it up. Run the verify script again afterwards; it now checks the house too.

### Life together and Virtual Date

Needs `supabase/migrations/003_dates.sql` (run it once, after 002), then the verify script again.

- **Sitting down**: walk up to a sofa, chair, bed, garden bench, the edge of the porch, or the benches by the
  lake and on Starfall Cliff, and press E / ✦ (**Duduk**, **Bersantai**). Moving (or E again) stands you up.
  If you both pick the same seat at the same moment, whoever sat a little later slides to the seat next to it.
  Sitting side by side, a few hearts float up.
- **Aktivitas** (top right): wave, send a heart, a happy jump, a photo pose, or call the other person
  (they get a gentle toast). Seats and gestures travel with your character over the private channel and are
  never stored.
- **House lights**: a switch by the door (from stage 3) and one for the fairy lights on the porch (stage 5),
  shared between you.
- **Virtual Date**: pick *Piknik Senja* (on the Secret Cove beach), *Makan Malam di Rumah* (needs a table and
  two chairs in the house), *Kemah di Bawah Bintang* (beside the house) or *Kencan di Tepi Danau* (the bench at
  Reflection Lake), and send **Ajak Kencan**. The other person gets an **Undangan Kencan** card
  (**Terima** / **Tolak**). After accepting, each of you walks there (**Antar ke sana** finds the way), and says
  **Siap** inside the glowing ring; the date begins when both are ready. Conversation prompts (editable in
  `dates` in `config.js`) can be stepped through together. **Akhiri Kencan** ends it: a date of at least a minute
  is kept in **Kenangan Kita** (with a note you can both write) and unlocks a keepsake for the house catalog,
  once. If one of you drops offline for 20 seconds, the date pauses and can be picked up again (**Lanjutkan**).
  Invitations expire after 15 minutes, accepted dates after 3 hours.
- `dates.lakeLetter` in `config.js`: a short letter that appears on the lake bench during the lakeside date
  (empty until you write one).

Every step of a date is a database function that checks who is asking (only the invited person can accept,
each person can only mark themselves ready, one open date at a time, the same invitation can't be sent twice,
the reward can't be claimed twice). One limitation: whether someone is *at* the meeting place is checked by
their own game (positions aren't stored on the server), so "Siap" means "I say I'm here" — but nobody can
say it for the other person.

Not included yet: **photo frames with your own pictures**. That needs private image uploads (a Supabase Storage
bucket with policies for the two members, size/type limits, and a `photo_path` column on `house_items`), so the
frames and the memory corner are text-only for now.

---

## How the experience flows

1. **Loading**: a heart fills up while textures and fonts load.
2. **Intro**: stars fade in, a glowing heart appears, the words, then “Enter Our World ♡”.
3. **Character selection** → the Starting Meadow, where Mochi is napping.
4. **Five chapters** (see above), with dialog, discoveries and a story book (📖) showing real progress.
5. **The envelope → love letter → finale → (optional) secrets.**

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
