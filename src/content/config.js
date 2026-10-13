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
