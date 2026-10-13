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
  me: { name: 'Rayhan', place: 'Jakarta', icon: '🌙' },
  // Person 2 (your favorite person)
  you: { name: 'Tari', place: 'Makassar', icon: '🌸' },
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
