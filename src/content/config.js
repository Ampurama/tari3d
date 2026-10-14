/**
 * ─────────────────────────────────────────────────────────────
 *  OUR LITTLE UNIVERSE — personal content
 *  Everything you'll want to change lives in this folder:
 *    • config.js   → names, places, dates, captions, messages, music
 *    • letter.txt  → the love letter (plain text, edit freely)
 *    • /public/photos → your photos (see README)
 * ─────────────────────────────────────────────────────────────
 */

export const couple = {
  // Person 1 (you — the one who built this universe)
  // `nickname` is what the little messages call you (falls back to `name`).
  me: { name: 'Rayhan', nickname: 'Rayhan', place: 'Jakarta', icon: '🌙' },
  // Person 2 (your favorite person)
  you: { name: 'Tari', nickname: 'Tari', place: 'Makassar', icon: '🌸' },
  // Optional: the day your story started (YYYY-MM-DD). Set to null to hide.
  since: '2026-08-01',
}

export const intro = {
  line1: 'Hey, my favorite person...',
  line2: 'I made a little universe, just for you.',
  button: 'Enter Our World ♡',
}

/**
 * Photos (and short videos) for the floating gallery, in timeline order.
 * Drop files in /public/photos and update `src`.
 *  • Photos: JPG/PNG/WebP — around 1200px on the long side is plenty.
 *  • Videos: add `type: 'video'` (MP4). They play silently in their 3D frame,
 *    and with sound controls when opened.
 * The first 10 also float as frames around the island; any extra ones still appear in the gallery.
 */
export const memories = [
  {
    src: 'photos/2agustus.jpeg',
    title: 'Our first photo booth',
    date: '2 Agustus 2026',
    caption: 'One of my favorite memories with you — the very first page of our story.',
  },
  {
    src: 'photos/2agustus(1).jpg',
    title: 'Little heart, big feelings',
    date: '2 Agustus 2026',
    caption: 'I was trying to look cool. You were just being adorable. You won.',
  },
  {
    src: 'photos/16agustus.jpeg',
    title: 'Backseat adventures',
    date: '16 Agustus 2026',
    caption: 'Even the simplest moments become special with you.',
  },
  {
    src: 'photos/16agustus(1).jpeg',
    title: 'Messy hair, happy heart',
    date: '16 Agustus 2026',
    caption: 'Bad angles, windy hair — still one of my favorite pictures of us.',
  },
  {
    src: 'photos/16agustus(2).jpeg',
    title: 'Just the two of us',
    date: '16 Agustus 2026',
    caption: 'If I could relive one moment, I would choose a moment with you.',
  },
  {
    src: 'photos/16agustus.mp4',
    type: 'video',
    title: 'A moment that moves',
    date: '16 Agustus 2026',
    caption: 'Some memories are too precious to stay still.',
  },
  {
    src: 'photos/16gustus(3).jpeg',
    title: 'That smile',
    date: '16 Agustus 2026',
    caption: 'The way you smile across the table — I could watch it forever.',
  },
  {
    src: 'photos/29agustus.jpeg',
    title: 'Under the blossoms',
    date: '29 Agustus 2026',
    caption: 'Pink flowers, red lanterns, and somehow you were still the prettiest thing there.',
  },
  {
    src: 'photos/30agustus.jpeg',
    title: 'Road trip company',
    date: '30 Agustus 2026',
    caption: 'Any road feels short when you are the one sitting next to me.',
  },
  {
    src: 'photos/26september(1).jpeg',
    title: 'Golden hour with you',
    date: '26 September 2026',
    caption: 'Distance means so little when someone means so much. Sunsets are better with you.',
  },
]

/**
 * MEMORY LANE — floating lanterns leading away from the island, one per milestone.
 * Keep them in order. `photo` is optional (null → a soft glowing placeholder, never a fake photo).
 * `story` is yours to write — a few sentences about that day. Leave '' to show only the title.
 */
export const memoryLane = {
  title: 'Memory Lane',
  subtitle: 'Every lantern is a day I never want to forget.',
  milestones: [
    {
      date: '1 Agustus 2026',
      title: 'The day we became us',
      story: 'The first page of our story. Everything after this started here.',
      photo: null,
    },
    {
      date: '2 Agustus 2026',
      title: 'Our first photo booth',
      story: 'Silly poses, finger hearts, and the first photos of us together.',
      photo: 'photos/2agustus.jpeg',
    },
    {
      date: '16 Agustus 2026',
      title: 'A day full of us',
      story: 'Car selfies, a café, and so many little moments I still replay.',
      photo: 'photos/16agustus(2).jpeg',
    },
    {
      date: '29 Agustus 2026',
      title: 'Under the blossoms',
      story: 'Pink flowers and red lanterns — and you, smiling like that.',
      photo: 'photos/29agustus.jpeg',
    },
    {
      date: '30 Agustus 2026',
      title: 'Road trip company',
      story: 'Another drive, another favorite memory with you beside me.',
      photo: 'photos/30agustus.jpeg',
    },
    {
      date: '26 September 2026',
      title: 'Golden hour',
      story: 'Sand, sea breeze and a sunset I got to share with you.',
      photo: 'photos/26september(1).jpeg',
    },
    {
      date: 'Next chapter',
      title: 'Still being written',
      story: 'This lantern is waiting for the next memory we make together.',
      photo: null,
    },
  ],
}

/**
 * LOVE CAPSULE — "open when…" letters for different moods.
 * Letters stay in Bahasa Indonesia; labels are what shows on each envelope.
 */
export const loveCapsule = {
  title: 'Love Capsule',
  subtitle: 'Open the one that matches how you feel right now.',
  letters: [
    {
      id: 'sad',
      label: 'Open when you’re sad',
      emoji: '🌧️',
      color: '#9fb4ff',
      title: 'Untuk kamu yang lagi sedih',
      message:
        'Sayang, nggak apa-apa kok kalau hari ini rasanya berat. Kamu nggak harus selalu kuat.\n\nKalau mau nangis, nangis aja. Kalau mau cerita, aku di sini — sejauh apa pun kita, telingaku selalu buat kamu.\n\nIngat ya, perasaan sedih ini akan lewat. Dan sampai itu terjadi, aku nggak akan ke mana-mana. ♡',
    },
    {
      id: 'miss',
      label: 'Open when you miss me',
      emoji: '🌙',
      color: '#c9a8ff',
      title: 'Untuk kamu yang lagi kangen',
      message:
        'Coba lihat ke langit malam ini. Bulan yang kamu lihat dari Makassar itu bulan yang sama yang aku lihat dari Jakarta.\n\nKangen itu tandanya ada sesuatu yang berharga di antara kita. Dan percaya deh, aku juga lagi kangen kamu — mungkin lebih.\n\nSebentar lagi ya. Setiap hari yang lewat itu satu hari lebih dekat ke ketemu kamu lagi. ♡',
    },
    {
      id: 'tired',
      label: 'Open when you’re tired',
      emoji: '☁️',
      color: '#ffd9a8',
      title: 'Untuk kamu yang lagi capek',
      message:
        'Hei, kamu udah berusaha keras banget hari ini. Aku bangga sama kamu.\n\nSekarang waktunya istirahat. Minum air, makan yang enak, terus tidur yang cukup ya. Dunia bisa nunggu sebentar.\n\nKalau aku ada di sebelahmu, aku pasti udah pijitin bahu kamu. Anggap aja surat ini pelukan dari jauh. ♡',
    },
    {
      id: 'happy',
      label: 'Open when you’re happy',
      emoji: '☀️',
      color: '#ffb6d5',
      title: 'Untuk kamu yang lagi bahagia',
      message:
        'Yay! Aku ikut senang banget!\n\nSenyum kamu itu salah satu hal favoritku di dunia, jadi tolong simpan perasaan ini baik-baik ya. Ceritain ke aku nanti — aku mau dengar semuanya, detail-detailnya juga.\n\nSemoga hari-hari bahagia kamu makin banyak, dan semoga aku bisa jadi bagian dari banyak di antaranya. ♡',
    },
    {
      id: 'upset',
      label: 'Open when you’re upset with me',
      emoji: '🌱',
      color: '#a8e0c9',
      title: 'Untuk kamu yang lagi kesal sama aku',
      message:
        'Maaf ya, sayang. Mungkin aku salah ngomong, kurang peka, atau bikin kamu kecewa.\n\nKamu boleh kesal. Perasaan kamu valid. Tapi tolong jangan simpan sendiri — ayo kita omongin pelan-pelan, aku mau dengar dan mau belajar.\n\nSatu hal yang nggak pernah berubah walaupun kita lagi nggak akur: aku tetap sayang kamu, dan aku tetap pilih kamu. ♡',
    },
  ],
}

/**
 * LDR COUNTDOWN — the next time you'll meet.
 * `date`: 'YYYY-MM-DDTHH:mm' (local time), or null if it isn't decided yet.
 * When it's null the site shows `noDateMessage` instead of inventing a date.
 */
export const nextMeeting = {
  date: null,
  place: '',
  message: 'Every second brings me closer to you.',
  noDateMessage: 'No date yet — but I’m already counting the days until I see you again.',
  arrivedMessage: 'It’s finally the day. See you soon, my love. ♡',
}

/**
 * HIDDEN HEARTS — five tiny hearts hidden around the universe.
 * Hints show up in the collection panel. The reward unlocks when all five are found.
 * `reward.media` is optional: { type: 'image' | 'video', src: 'photos/…' }.
 */
export const hiddenHearts = {
  hints: [
    'One hides behind the trunk of the great Love Tree…',
    'One is resting among the ferns of the Heartwood Forest.',
    'One is sitting on a little rock floating beside Starfall Cliff.',
    'One is waiting on an island under the same sky.',
    'One is shining near our constellation.',
  ],
  reward: {
    title: 'You found every hidden heart!',
    message:
      'Five little hearts, hidden all over this universe — and you found every single one. Just like you found your way into mine. Here’s a small secret: I love you more every time you smile.',
    media: null,
  },
}

/**
 * OUR CONSTELLATION — each star is one thing I love about you.
 * Add or remove lines; the heart reshapes itself (6–16 works best).
 */
export const constellation = {
  title: 'Our Constellation',
  subtitle: 'Tap every star to finish the heart.',
  completeMessage: 'And these are only the first ones. I’ll keep finding new reasons, every day.',
  reasons: [
    'Your smile — it makes everything feel lighter.',
    'The way you laugh at my silly jokes.',
    'How patient you are with me.',
    'How you make ordinary days feel special.',
    'The way you care about the people you love.',
    'How safe I feel talking to you.',
    'Your voice on our late-night calls.',
    'How you never give up on us, even from far away.',
    'The way you look at the little things.',
    'Simply that you are you.',
  ],
}

export const letter = {
  title: 'Untukmu',
  signature: '— yours, always. Rayhan ♡',
}

export const distance = {
  heading: 'Different places, same sky',
  line1: 'Two places, one sky, one heart.',
  line2: 'No matter how far we are, you will always have a place in my universe.',
}

export const finale = {
  message: 'Out of all the people in this universe, my heart keeps finding you.',
  question: 'Will you keep making beautiful memories with me?',
  answers: [
    {
      label: 'Of course, my love! ♡',
      title: 'Then it’s a promise.',
      reply:
        'Every sunrise, every late-night call, every little moment — I can’t wait to collect them all with you.',
    },
    {
      label: 'I have so much love for you 💗',
      title: 'And I love you more.',
      reply:
        'You just made this whole universe glow a little brighter. Thank you for being my favorite place to come home to.',
    },
  ],
  closing: 'This universe will always be here for you. Come back anytime. ♡',
  /**
   * Optional photo or video shown with the final answer.
   * e.g. { type: 'video', src: 'photos/16agustus.mp4' } or { type: 'image', src: 'photos/…' }. null hides it.
   */
  media: null,
}

/**
 * Music.
 *  • src: null  → a soft, generated music-box melody plays (no file needed).
 *  • src: 'audio/our-song.mp3' → put a file you have the rights to in /public/audio.
 * Music never starts until there is a tap/click.
 */
export const music = {
  src: null,
  volume: 0.55,
  // Start the music when "Enter Our World" is pressed (that press counts as interaction).
  startOnEnter: true,
}

/** Little notes that pop up when one of the floating hearts is tapped. */
export const sweetNotes = [
  'You make ordinary days feel like a soft song.',
  'I still smile every time your name lights up my phone.',
  'Thank you for being patient with me. ♡',
  'From Jakarta to Makassar — I’m thinking about you right now.',
  'Your laugh is my favorite sound in any universe.',
  'Home isn’t a place. It’s you.',
]

export const hints = {
  /** the 💡 hint button — after this many seconds without progress it offers itself */
  idleNudgeSeconds: 75,
  idleNudge: 'Stuck? Tap 💡 Hint — I’ll show you the way ♡',
  toTelescope: 'Chapter 2 starts on Starfall Cliff: take the glowing path to the right of the Love Tree, walk up the ramp and use the telescope.',
  allDone: 'Every chapter is complete ♡ The ending is waiting for you.',
  secretStar: 'After the ending, a tiny star appears beside the Love Tree. Walk to the tree and reach for it.',
  everything: 'You’ve found everything in our little universe ♡ Walk around as long as you like.',
  explore: 'Walk with WASD or the joystick · drag to turn the island · E or ✦ to interact',
  secretLocked: 'This path is still sleeping… read the letter first ♡',
  secretUnlocked: 'Something just woke up at the end of the glowing path ✦',
}

/* ═══════════════════════════════════════════════════════════════
 *  STORY — "EVERY LITTLE THING LEADS TO YOU"
 *  Three chapters. Each one unlocks after the previous is finished.
 *  What counts as "finished" is measured from what she actually does
 *  (see src/lib/story.js) — progress is never faked.
 *  In dialog lines, {me} and {you} become the nicknames above.
 * ═══════════════════════════════════════════════════════════════ */

export const story = {
  title: 'Every Little Thing Leads to You',
  tagline: 'Every little thing leads to you',
  narrator: 'The Universe',
  prologue: [
    { speaker: 'narrator', text: 'Welcome to a little universe that was made with love — for one person.' },
    { speaker: 'me', text: 'Hi {you}. Walk around, look closely, touch whatever glows. Nothing here is in a hurry.' },
  ],
  chapters: [
    {
      id: 'little-things',
      title: 'The Little Things',
      subtitle: 'Small memories that mean everything',
      intro: [
        { speaker: 'narrator', text: 'Chapter One — The Little Things.' },
        { speaker: 'me', text: 'Five little things are hidden around the island: a photograph, a letter, a flower, a music box and a fallen star.' },
        { speaker: 'narrator', text: 'Sometimes, it isn’t the biggest moments that stay with us. It’s the little things we never knew we would miss.' },
      ],
      outro: [{ speaker: 'narrator', text: 'Every little thing leaves a mark. And somehow, they all lead somewhere.' }],
      hint: 'Follow the light up to Starfall Cliff — the telescope there looks across the sky.',
    },
    {
      id: 'miles',
      title: 'Miles Between Us',
      subtitle: 'Distance does not have to mean disconnection',
      intro: [
        { speaker: 'narrator', text: 'Chapter Two — Miles Between Us.' },
        { speaker: 'narrator', text: 'Two islands, a whole sky apart. The bridge between them is unfinished.' },
        { speaker: 'me', text: 'Five things hold a bridge like this together. Find them, and wake each one up.' },
      ],
      outro: [{ speaker: 'narrator', text: 'Maybe love isn’t about never being far apart. Maybe it’s about continuing to find our way back to each other.' }],
      hint: 'Return to the island and visit the glowing garden around the Love Tree.',
    },
    {
      id: 'future',
      title: 'A Future We Grow',
      subtitle: 'Love is something we keep building',
      intro: [
        { speaker: 'narrator', text: 'Chapter Three — A Future We Grow.' },
        { speaker: 'me', text: 'Five glowing seeds are hidden around the island. Each one needs a home in the soil around the Love Tree.' },
        { speaker: 'narrator', text: 'Not everything beautiful happens overnight.' },
      ],
      outro: [{ speaker: 'narrator', text: 'Maybe the future isn’t something we find. Maybe it’s something we build, one little thing at a time.' }],
      hint: '',
    },
  ],
}

/**
 * AVATARS — the little souls she can play as. Names, outfits and colours are all editable.
 * They are stylised characters, not portraits of anyone real.
 * outfit: 'pants' | 'dress'   hairStyle: 'short' | 'long'   accessory: 'scarf' | 'bow' | null
 */
export const avatars = [
  {
    id: 'girl',
    label: 'Girl',
    name: 'Little Moon',
    look: { skin: '#f6d2bf', hair: '#5a3a4a', top: '#ffb6d5', bottom: '#c9a8ff', shoes: '#fff3ea', accent: '#ff8fc4', outfit: 'dress', hairStyle: 'long', accessory: 'bow' },
  },
  {
    id: 'boy',
    label: 'Boy',
    name: 'Little Star',
    look: { skin: '#f0c9b0', hair: '#3b2d3f', top: '#a7c4ff', bottom: '#5f4b98', shoes: '#fff3ea', accent: '#ffd98a', outfit: 'pants', hairStyle: 'short', accessory: 'scarf' },
  },
]

export const avatarSelect = {
  heading: 'Every little adventure starts with a choice.',
  subheading: 'Choose the little soul who will carry your story into our universe.',
  button: 'Enter Our Little Universe ♡',
  confirmed: 'Your little adventure begins now. And somehow, every little thing will lead you back to us.',
  rotateHint: 'Drag to turn around',
}

/**
 * CHAPTER 1 — THE LITTLE THINGS. Five objects around the island, each with its own interaction.
 * `photo` must be one of your real photos (or null for a soft placeholder).
 */
/** Names of the island's places, written on the map (rename freely). */
export const placeNames = {
  meadow: 'Starting Meadow',
  garden: 'Memory Garden',
  forest: 'Heartwood Forest',
  lake: 'Reflection Lake',
  cliff: 'Starfall Cliff',
  cove: 'Secret Cove',
  gallery: 'Our Memories',
  tree: 'The Love Tree',
}

export const littleThings = [
  {
    id: 'photo',
    title: 'A Photograph',
    zone: 'Memory Garden',
    hint: 'Go left from the Love Tree into the Memory Garden. A small photo covered by a cloth stands among the pink flowers — walk up to it and lift the cloth.',
    message: 'One of my favorite photos of us — proof that ordinary days with you turn into something I want to keep.',
    photo: 'photos/2agustus.jpeg',
  },
  {
    id: 'letter',
    title: 'A Letter in a Bottle',
    zone: 'Reflection Lake',
    hint: 'Head to Reflection Lake (top right) and walk onto the wooden bridge. A glass bottle is floating right beside it — reach for it from the bridge.',
    message: 'Some of my favorite words are the small ones — the ones I get to share with you on ordinary days.',
  },
  {
    id: 'flower',
    title: 'A Sleeping Flower',
    zone: 'Heartwood Forest',
    hint: 'Follow the path into the Heartwood Forest (top left). Between the tall trees a glowing flower is sleeping — walk close and touch it.',
    message: 'Some things only bloom when someone is gentle with them. Thank you for being gentle with me.',
  },
  {
    id: 'musicbox',
    title: 'A Music Box',
    zone: 'Starfall Cliff',
    hint: 'Take the glowing path to the right of the Love Tree and walk up the ramp onto Starfall Cliff. The music box waits near the top.',
    message: 'If our little moments had a sound, I think it would be this — soft, simple, and worth replaying.',
  },
  {
    id: 'star',
    title: 'A Fallen Star',
    zone: 'The Starting Meadow',
    hint: 'It’s close to where you started: in the Starting Meadow (bottom), a little to the left of the path — look for a tiny star glowing in the grass.',
    message: 'Even the smallest light changes what you can see. You did that for me.',
  },
]

/**
 * CHAPTER 2 — MILES BETWEEN US. Five elements that rebuild the bridge between two islands.
 * The interactions are fixed; titles, instructions and messages are yours to edit.
 */
export const connections = [
  {
    id: 'trust',
    hint: 'Find the lantern on your island (the left one). Press and keep holding it — don’t let go — until its light stays on.',
    title: 'Trust',
    how: 'Press and hold the lantern until its light stays on.',
    message: 'Trust is a light you keep on, even when you can’t see the other side.',
  },
  {
    id: 'communication',
    hint: 'Tap the glowing pink shell on your island (left). Wait while the light flies across, then tap the purple shell on the other island (right) to answer.',
    title: 'Communication',
    how: 'Send a light from your island, then answer it from the other one.',
    message: 'Distance can make things difficult, but it doesn’t erase what matters.',
  },
  {
    id: 'patience',
    hint: 'A small light drifts back and forth over the middle of the bridge. Wait until it is inside the glowing ring (the ring gets brighter), then tap.',
    title: 'Patience',
    how: 'Wait for the drifting light to reach the gap — then tap.',
    message: 'Some days, love means waiting a little longer for the right moment.',
  },
  {
    id: 'understanding',
    hint: 'Tap one of the stars above the bridge to begin. Watch the order they light up in, then tap them in exactly that order. Wrong? Tap a star again to see the order once more.',
    title: 'Understanding',
    how: 'Watch the stars, then light them in the same order.',
    message: 'Some days, love means understanding. Other days, it means trying again.',
  },
  {
    id: 'effort',
    hint: 'Tap (or click) the wheel again and again — about ten turns — until the last piece of the bridge slides into place.',
    title: 'Effort',
    how: 'Turn the wheel until the last part of the bridge appears.',
    message: 'Even when we’re far apart, we can still choose to show up for each other.',
  },
]

/** CHAPTER 3 — A FUTURE WE GROW. Five seeds, each grown in its own way around the Love Tree. */
export const seeds = [
  { id: 'honesty', where: 'Far left edge of the Memory Garden, past the bench.', title: 'Honesty', care: 'Clear the soil by hand — hold to plant it.', message: 'Honesty — so that we always know where we stand.' },
  { id: 'kindness', where: 'At the top edge of the Heartwood Forest, behind the tall trees.', title: 'Kindness', care: 'Bring it water from Reflection Lake.', message: 'Kindness — especially on the days that are hard.' },
  { id: 'adventures', where: 'Up on Starfall Cliff (right side), near the telescope.', title: 'Shared Adventures', care: 'Light the two guiding stones beside it.', message: 'Shared adventures — big trips and tiny walks alike.' },
  { id: 'growth', where: 'On the far (top) shore of Reflection Lake.', title: 'Growth Together', care: 'Stay with it a while — hold until it grows.', message: 'Some things are worth taking care of, even when the future is uncertain.' },
  { id: 'future', where: 'In the Starting Meadow, on the path toward the Secret Cove (bottom right).', title: 'A Future Built Together', care: 'Connect it to the light of the other four.', message: 'I hope we keep learning, growing, and becoming better together.' },
]

/** Optional notes hidden around the island. They never block the story. */
export const hiddenNotes = [
  { id: 'forest-hollow', where: 'Heartwood Forest', text: 'If you found this, you were curious enough to look. I love that about you.' },
  { id: 'lake-stone', where: 'Reflection Lake', text: 'Still water reflects the sky. I hope I can be that calm place for you sometimes.' },
  { id: 'cliff-edge', where: 'Starfall Cliff', text: 'From up here everything looks small — except how much you mean to me.' },
  { id: 'cove-light', where: 'Secret Cove', text: 'You found the secret cove. Some of the best things are a little hidden.' },
]

/** The view from Starfall Cliff (plays once, the first time she reaches it). */
export const viewpoint = {
  title: 'Starfall Cliff',
  text: 'Look how far you’ve come.',
}

/** FINAL CINEMATIC — "You were the meaning all along". Timings are handled by the game. */
export const finalCinematic = {
  scenes: [
    ['Remember all those little things you found?', 'None of them seemed extraordinary on their own.'],
    ['But every little effort, every conversation, every moment of understanding…', 'Was another way of saying that this matters.'],
    ['And every little thing we choose to nurture…', 'Can become something beautiful.'],
  ],
  title: 'YOU WERE THE MEANING ALL ALONG.',
  skip: 'Skip',
}

/**
 * THE LOVE LETTER — shown after the final cinematic.
 * `personalNote`: an extra paragraph only you can write (leave '' to hide it).
 * `photo` / `voice`: a path in /public, or null to hide.
 */
export const loveLetter = {
  greeting: 'Untuk Tari,',
  opening: 'To the person who makes even the smallest things feel meaningful…',
  body: [
    'I made this little universe because I wanted to give you something you could walk through — not just read.',
    'Every memory, every light and every flower here is a small way of saying the same thing: you matter to me, in the little things and in the big ones.',
  ],
  personalNote: '',
  ending: [
    'If there’s one thing I hope you remember after this little adventure, it’s that none of these worlds, stars, or flowers were really the point.',
    'The point was always you.',
    'And if I could build a thousand little universes, I think I’d still find my way back to you.',
  ],
  signature: '— Rayhan',
  photo: 'photos/26september(1).jpeg',
  voice: null,
}

/**
 * TIME MACHINE — one entry per date. Uses your real photos; `narration` is yours to edit.
 * `photos` can list several files (photo or .mp4). Leave it [] for a soft placeholder.
 */
export const timeMachine = {
  title: 'Time Machine',
  subtitle: 'Choose a date. The universe will take you back.',
  entries: [
    {
      date: '2026-08-01',
      label: '1 Agustus 2026',
      title: 'The day we became us',
      narration: 'The first day of our story.',
      photos: [],
    },
    {
      date: '2026-08-02',
      label: '2 Agustus 2026',
      title: 'Our first photo booth',
      narration: 'Silly poses and our very first photos together.',
      photos: ['photos/2agustus.jpeg', 'photos/2agustus(1).jpg'],
    },
    {
      date: '2026-08-16',
      label: '16 Agustus 2026',
      title: 'A day full of us',
      narration: 'Car selfies, a café, and so many little moments.',
      photos: ['photos/16agustus(2).jpeg', 'photos/16agustus.jpeg', 'photos/16agustus(1).jpeg', 'photos/16gustus(3).jpeg', 'photos/16agustus.mp4'],
    },
    {
      date: '2026-08-29',
      label: '29 Agustus 2026',
      title: 'Under the blossoms',
      narration: 'Pink flowers and red lanterns.',
      photos: ['photos/29agustus.jpeg'],
    },
    {
      date: '2026-08-30',
      label: '30 Agustus 2026',
      title: 'Road trip company',
      narration: 'Another drive side by side.',
      photos: ['photos/30agustus.jpeg'],
    },
    {
      date: '2026-09-26',
      label: '26 September 2026',
      title: 'Golden hour',
      narration: 'Sand, sea breeze and a sunset together.',
      photos: ['photos/26september(1).jpeg'],
    },
  ],
}

/**
 * RED THREAD — the two islands under the same sky.
 * `audio`: put a voice note in /public/audio (e.g. 'audio/voice-1.m4a') to show a play button.
 * When audio is null, only the written message is shown (no fake play button).
 */
export const redThread = {
  prompt: 'Tap both islands to tie the red thread.',
  connected: 'Connected. No distance can untie this.',
  messages: {
    me: {
      title: 'A message from Jakarta',
      text: 'Every night I look at the same sky you’re under, and I feel a little closer to you.',
      audio: null,
    },
    you: {
      title: 'A message waiting in Makassar',
      text: 'Wherever you are, this thread finds you. Pull it whenever you miss me — I’ll feel it.',
      audio: null,
    },
  },
}

/** FUTURE SIMULATOR — the worlds behind the portal. Edit titles and messages freely. */
export const futureWorlds = {
  title: 'Future Simulator',
  subtitle: 'Worlds we haven’t visited yet — but will.',
  worlds: [
    {
      id: 'home',
      title: 'Our Home',
      message: 'A small house with warm lights, a messy kitchen, and you as the first thing I see every morning.',
    },
    {
      id: 'travel',
      title: 'Our Adventures',
      message: 'New cities, long flights, wrong turns — every place becomes my favorite place when you’re there.',
    },
    {
      id: 'simple',
      title: 'Simple Moments',
      message: 'Two cups of tea, a quiet night, no screens between us. Just us, and that’s enough.',
    },
    {
      id: 'wedding',
      title: 'Our Dream Wedding',
      message: 'One day, under flowers and soft lights, I hope to say forever — and mean every letter of it.',
    },
  ],
}

/* ═══════════════════════════════════════════════════════════════
 *  SECRET ENDING — "THE ONE THING I COULD NEVER CODE ♡"
 *  Hidden in the Secret Room after the game is finished: a small star
 *  beside the big heart lights up once the final letter has appeared.
 *  Touching it opens this ending. Everything below is editable.
 * ═══════════════════════════════════════════════════════════════ */

export const secretEnding = {
  title: 'The One Thing I Could Never Code ♡',
  /** small hint shown in the Secret Room once the star is awake (also a tappable button) */
  starHint: 'A tiny star just lit up beside the heart…',

  found: {
    line1: 'You found everything I prepared for you...',
    line2: "But there's one little thing I haven't told you yet.",
    button: 'Open my heart ♡',
  },

  /** shown one line at a time, while everything goes quiet */
  transition: {
    lines: [
      'I can build a world out of code.',
      'I can make stars appear, flowers bloom, and little universes come to life.',
      'But there is one thing I could never truly put into code.',
      'What it feels like to have you in my life.',
      'So I made this little world instead.',
      'Not because it could ever explain everything I feel, but because I wanted to make something that could remind you how much you mean to me.',
    ],
  },

  /** The letter. A blank line starts a new paragraph. */
  letter: `Sayangku, 🤍

Kalau kamu sudah sampai di sini, berarti kamu sudah melihat dunia kecil yang aku buat khusus buat kamu.

Tapi di balik semua bintang, animasi, permainan, dan hal-hal kecil yang kamu temukan di sini, sebenarnya ada satu alasan sederhana kenapa aku membuat semuanya.

Aku ingin membuat sesuatu yang bisa mengingatkan kamu betapa berartinya kamu buat aku.

Aku tahu aku bukan orang yang selalu benar. Aku masih belajar memahami kamu, belajar mendengarkan kamu, dan belajar mencintai kamu dengan cara yang juga membuat kamu merasa dicintai.

Aku nggak bisa menjanjikan bahwa setiap hari kita akan selalu mudah. Tapi aku berharap, saat ada hari yang sulit, kita tetap bisa saling mendengarkan dan belajar memahami satu sama lain.

Aku senang bisa mengenal kamu. Aku senang bisa berbagi cerita sama kamu, bahkan untuk hal-hal kecil yang mungkin terlihat sederhana.

Dan kalau suatu hari nanti kamu membuka website ini lagi, aku harap kamu bukan cuma ingat permainan yang kamu selesaikan.

Aku harap kamu juga ingat bahwa ada seseorang yang meluangkan waktu untuk membuat semua ini, karena kamu memang sepenting itu buat dia.

Someone who wanted to give you something more meaningful than a simple 'I love you'.

Someone who is still learning, still growing, and still grateful to have you in his life.

That someone is me, sayang. ♡

I love you, not because our story is perfect, but because our story is ours.

And if you let me, I hope we get to write many more pages together.`,
  readAll: 'Read it all',

  /**
   * Your own voice recording. Put the file in /public/audio and set `src`, e.g. 'audio/for-tari.m4a'
   * (mp3 / m4a / ogg / wav). While `src` is null an elegant placeholder is shown instead of a player.
   * `subtitles` are optional: [{ start: 0, end: 4.5, text: '…' }, …] in seconds.
   */
  voice: {
    button: "There's something I want you to hear...",
    src: null,
    subtitles: [],
    placeholder: 'My voice message will live here very soon ♡',
    continue: 'Continue',
  },

  /** One real photo of the two of you (from /public/photos) and its caption. */
  photo: {
    src: 'photos/26september(1).jpeg',
    caption: "Of all the little moments life could give me, I'm grateful that some of them brought me to you.",
    continue: 'Continue ♡',
  },

  final: {
    line1: 'If I had to find you in every universe, I would.',
    line2: 'Thank you for being part of my little universe, sayang. ♡',
    stay: 'Stay in our universe ♡',
  },

  replay: 'Replay the secret ending ♡',
  skip: 'Skip',
}
