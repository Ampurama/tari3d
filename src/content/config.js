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
    'One hides where the blossom tree casts its shadow…',
    'One is resting among the flowers at the far edge of the island.',
    'One is sitting on a little rock floating in the sky.',
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
  explore: 'Drag to look around · tap the glowing things ✦',
  secretLocked: 'This path is still sleeping… read the letter first ♡',
  secretUnlocked: 'Something just woke up at the end of the glowing path ✦',
}

/* ═══════════════════════════════════════════════════════════════
 *  STORY MODE — "EVERY UNIVERSE LEADS TO YOU"
 *  Five chapters. Each one unlocks after the previous is finished.
 *  What counts as "finished" is measured from what she actually does
 *  (see src/lib/story.js) — progress is never faked.
 *  In dialog lines, {me} and {you} become the nicknames above.
 * ═══════════════════════════════════════════════════════════════ */

export const story = {
  title: 'Our Little Universe',
  tagline: 'Every universe leads to you',
  narrator: 'The Universe',
  prologue: [
    { speaker: 'narrator', text: 'Somewhere between Jakarta and Makassar, a little universe was born.' },
    { speaker: 'narrator', text: 'It is made of moments, words and dreams — and every single one of them leads to one person.' },
    { speaker: 'me', text: 'Hi {you}. I built this place for you. There are five chapters hidden in it.' },
    { speaker: 'me', text: 'Finish them all and the heart above the island will wake up. Something is waiting for you there. ♡' },
  ],
  chapters: [
    {
      id: 'beginning',
      title: 'The First Page',
      subtitle: 'Where our story began',
      intro: [
        { speaker: 'narrator', text: 'Chapter One. Every story has a first page.' },
        { speaker: 'me', text: 'Look around the floating frames, then walk the Memory Lane all the way to the last lantern.' },
      ],
      outro: [{ speaker: 'me', text: 'Every one of those days still feels like yesterday to me.' }],
    },
    {
      id: 'time',
      title: 'Back in Time',
      subtitle: 'The machine that remembers',
      intro: [
        { speaker: 'narrator', text: 'Chapter Two. Somewhere on the island, an old machine keeps every date we shared.' },
        { speaker: 'me', text: 'Find the Time Machine and travel to every day it remembers.' },
      ],
      outro: [{ speaker: 'me', text: 'If I could, I would go back to every one of those days. With you, again.' }],
    },
    {
      id: 'thread',
      title: 'The Red Thread',
      subtitle: 'Two cities, one string of fate',
      intro: [
        { speaker: 'narrator', text: 'Chapter Three. They say an invisible red thread connects those who are meant to meet.' },
        { speaker: 'me', text: 'Go to our two islands. Tie the thread on both sides — then open the messages waiting there.' },
      ],
      outro: [{ speaker: 'me', text: 'It can stretch. It can tangle. But it never breaks.' }],
    },
    {
      id: 'words',
      title: 'Words I Kept for You',
      subtitle: 'Letters, moods and stars',
      intro: [
        { speaker: 'narrator', text: 'Chapter Four. Some things are easier to write than to say.' },
        { speaker: 'me', text: 'Read my letter, open a few envelopes from the Love Capsule, and light up every star of our constellation.' },
      ],
      outro: [{ speaker: 'me', text: 'And I still haven’t run out of things to tell you.' }],
    },
    {
      id: 'future',
      title: 'Every Universe Leads to You',
      subtitle: 'The worlds we haven’t visited yet',
      intro: [
        { speaker: 'narrator', text: 'Chapter Five. A portal has opened at the edge of the island.' },
        { speaker: 'me', text: 'Step through it and visit every world we dream about.' },
      ],
      outro: [
        { speaker: 'me', text: 'In every one of those universes, I end up with you.' },
        { speaker: 'narrator', text: 'The heart above the island is full. It’s time.' },
      ],
    },
  ],
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

/** HEART REACTOR — the core above the island that fills up as chapters are completed. */
export const heartReactor = {
  title: 'Heart Reactor',
  idle: 'Every chapter you finish gives the heart a little more light.',
  ready: 'The heart is full. Are you ready?',
  igniteButton: 'Awaken the heart ♡',
}

/**
 * FINAL MESSAGE — the secret room behind the ending.
 * `letter` stays in Bahasa Indonesia. `video` / `voice`: a path in /public, or null to hide.
 */
export const finalMessage = {
  title: 'The Secret Room',
  letter:
    'Tari,\n\nKalau kamu sampai di sini, berarti kamu sudah menjelajahi seluruh universe kecil ini — semua kenangan, semua surat, semua mimpi kita.\n\nAku bikin tempat ini karena aku pengen kamu tahu satu hal: di semesta mana pun, aku akan tetap menemukan jalan ke kamu.\n\nTerima kasih sudah jadi bagian paling indah dari ceritaku. Ini baru awal, dan aku nggak sabar menulis halaman-halaman berikutnya sama kamu.\n\nI love you, always. ♡',
  signature: '— Rayhan',
  video: null,
  voice: null,
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

  transition: {
    line1: "Out of all the things I could create in this little universe, there's one thing I can never fully put into code...",
    line2: 'How much you mean to me.',
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
