/**
 * ─────────────────────────────────────────────────────────────
 *  OUR LITTLE UNIVERSE — isi personal
 *  Semua yang ingin kamu ubah ada di folder ini:
 *    • config.js   → nama, tempat, tanggal, caption, pesan, dialog, musik
 *    • /public/photos → foto-foto kamu (lihat README)
 *  Di dialog: {me} dan {you} otomatis jadi nama panggilan di `couple`,
 *  {pet} jadi nama teman kecil (Mochi).
 * ─────────────────────────────────────────────────────────────
 */

export const couple = {
  // Orang 1 (kamu — yang membuat dunia kecil ini)
  // `nickname` dipakai di dialog dan pesan (kalau kosong, pakai `name`).
  me: { name: 'Rayhan', nickname: 'Rayhan', place: 'Jakarta', icon: '🌙' },
  // Orang 2 (orang favoritmu) — ganti `nickname` kalau mau dipanggil dengan nama lain
  you: { name: 'Tari', nickname: 'Tari', place: 'Makassar', icon: '🌸' },
  // Opsional: hari pertama cerita kalian (YYYY-MM-DD). Isi null untuk menyembunyikan.
  since: '2026-08-01',
}

export const intro = {
  line1: 'Hey, my favorite person...',
  line2: 'I made a little universe, just for you.',
  button: 'Enter Our World ♡',
}

/**
 * Foto (dan video pendek) untuk galeri, urut sesuai waktu.
 * Taruh file di /public/photos lalu ubah `src`.
 *  • Foto: JPG/PNG/WebP — sekitar 1200px di sisi panjang sudah cukup.
 *  • Video: tambahkan `type: 'video'` (MP4).
 * 12 pertama berdiri di plaza Our Memories; sisanya tetap ada di album.
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
 * MEMORY LANE — lentera yang melayang dari pulau, satu untuk setiap momen.
 * `photo` opsional (null → cahaya lembut, bukan foto palsu).
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
 * LOVE CAPSULE — surat "buka kalau…" untuk berbagai suasana hati.
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
 * HITUNG MUNDUR LDR — kapan kalian ketemu lagi.
 * `date`: 'YYYY-MM-DDTHH:mm' (waktu lokal), atau null kalau belum pasti.
 */
export const nextMeeting = {
  date: null,
  place: '',
  message: 'Every second brings me closer to you.',
  noDateMessage: 'No date yet — but I’m already counting the days until I see you again.',
  arrivedMessage: 'It’s finally the day. See you soon, my love. ♡',
}

/**
 * HATI TERSEMBUNYI — lima hati kecil yang disembunyikan di dunia ini.
 * `reward.media` opsional: { type: 'image' | 'video', src: 'photos/…' }.
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
 * RASI BINTANG KITA — setiap bintang adalah satu hal yang aku suka dari kamu.
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
  heading: 'Beda tempat, langit yang sama',
  line1: 'Dua tempat, satu langit, satu hati.',
  line2: 'Sejauh apa pun kita, kamu selalu punya tempat di duniaku.',
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
 * Musik.
 *  • src: null  → melodi music box lembut dibuat otomatis (nggak perlu file).
 *  • src: 'audio/lagu-kita.mp3' → taruh file yang boleh kamu pakai di /public/audio.
 * Musik nggak akan mulai sebelum ada ketukan/klik.
 */
export const music = {
  src: null,
  volume: 0.55,
  // Musik mulai saat tombol masuk ditekan (tekanan itu dihitung sebagai interaksi).
  startOnEnter: true,
}

/** Catatan kecil yang muncul saat hati melayang disentuh. */
export const sweetNotes = [
  'You make ordinary days feel like a soft song.',
  'I still smile every time your name lights up my phone.',
  'Thank you for being patient with me. ♡',
  'From Jakarta to Makassar — I’m thinking about you right now.',
  'Your laugh is my favorite sound in any universe.',
  'Home isn’t a place. It’s you.',
]

export const hints = {
  /** tombol 💡 Hint — kalau segini detik nggak ada kemajuan, tombolnya menawarkan diri */
  idleNudgeSeconds: 75,
  idleNudge: 'Bingung? Tekan 💡 Hint — nanti aku tunjukin jalannya ♡',
  toTelescope: 'Babak 3 dimulai di Starfall Cliff: ikuti jalan yang bercahaya di kanan Love Tree, naik ke atas, lalu pakai teropongnya.',
  wakeMochi: 'Ada hati kecil berbulu yang lagi tidur di padang, dekat banget sama tempat kamu mulai. Samperin, terus tekan E (atau ✦) buat bangunin dia.',
  toPicnic: 'Tempat pikniknya ada di bukit kecil antara Love Tree dan Secret Cove — cari tikar kotak-kotak. Naik ke situ, terus tekan E (atau ✦).',
  toEnvelope: 'Mochi nemu sesuatu di bawah Love Tree! Jalan ke depan pohon, terus buka amplopnya.',
  allDone: 'Semua babak udah selesai ♡ Ending-nya lagi nungguin kamu.',
  secretStar: 'Setelah ending, ada bintang kecil yang muncul di samping Love Tree. Samperin pohonnya, terus sentuh bintangnya.',
  secretHeart: 'Ada hati kecil yang bercahaya, ngumpet di balik pohon sakura besar di Memory Garden…',
  everything: 'Kamu udah nemuin semuanya di dunia kecil kita ♡ Jalan-jalan aja sepuasnya.',
  explore: 'Jalan pakai WASD atau joystick · geser untuk memutar pulau · E atau ✦ untuk berinteraksi',
  secretLocked: 'Jalan ini masih tidur… baca suratnya dulu, ya ♡',
  secretUnlocked: 'Ada yang baru bangun di ujung jalan yang bercahaya ✦',
}

/* ═══════════════════════════════════════════════════════════════
 *  CERITA — "DUNIA KECIL UNTUK TARI"
 *  Lima babak pendek. Setiap babak terbuka setelah babak sebelumnya selesai.
 *  "Selesai" diukur dari hal yang benar-benar dia lakukan (src/lib/story.js).
 *  speaker: 'narrator' | 'me' | 'you' | 'pet' (teman kecil)
 * ═══════════════════════════════════════════════════════════════ */

export const story = {
  title: 'Dunia Kecil untuk Kamu',
  tagline: 'Dunia kecil yang aku bikin buat kamu',
  narrator: 'Semesta',
  prologue: [
    { speaker: 'narrator', text: 'Selamat datang di dunia kecil yang dibuat dengan sayang — buat satu orang aja.' },
    { speaker: 'me', text: 'Hai, {you}. Jalan pakai WASD atau joystick, geser layar buat memutar pulau, dan tekan E (atau ✦) kalau ada yang bercahaya.' },
  ],
  chapters: [
    {
      id: 'goofy',
      title: 'Awal Petualangan',
      subtitle: 'Setiap petualangan butuh teman yang agak ceroboh',
      intro: [
        { speaker: 'narrator', text: 'Babak Satu — Awal Petualangan.' },
        { speaker: 'narrator', text: 'Ada sesuatu yang kecil dan berbulu lagi tidur di padang. Tidurnya serius banget.' },
      ],
      outro: [{ speaker: 'pet', text: 'Kita tim yang hebat! …ya, aku kebanyakan jatuh sih. Tapi tetap tim yang hebat.' }],
      hint: '',
    },
    {
      id: 'little-things',
      title: 'Hal-Hal Kecil Tentang Kamu',
      subtitle: 'Kenangan kecil yang artinya besar',
      intro: [
        { speaker: 'narrator', text: 'Babak Dua — Hal-Hal Kecil Tentang Kamu.' },
        { speaker: 'me', text: 'Ada lima hal kecil yang disembunyiin di pulau ini: sebuah foto, surat dalam botol, bunga yang tidur, kotak musik, dan bintang jatuh.' },
        { speaker: 'pet', text: 'Aku bantu cari! Aku jago nemuin barang. Aku pernah nemuin ekorku sendiri. (Aku nggak punya ekor.)' },
      ],
      outro: [{ speaker: 'narrator', text: 'Setiap hal kecil ninggalin bekas. Dan entah gimana, semuanya mengarah ke satu tempat.' }],
      hint: 'Ikuti cahaya ke atas Starfall Cliff — teropong di sana bisa lihat sampai ke seberang langit.',
    },
    {
      id: 'miles',
      title: 'Jauh, Tapi Tetap Dekat',
      subtitle: 'Jarak nggak harus bikin kita jauh',
      intro: [
        { speaker: 'narrator', text: 'Babak Tiga — Jauh, Tapi Tetap Dekat.' },
        { speaker: 'narrator', text: 'Dua pulau, dipisahin satu langit. Jembatan di antaranya belum jadi.' },
        { speaker: 'pet', text: 'Kita beda pulau, nih. Tapi tenang, aku jago bikin jembatan!' },
      ],
      outro: [
        { speaker: 'pet', text: 'Lihat! Akhirnya nyambung juga! Ternyata kalau kita sabar dan saling bantu, jalan yang jauh pun bisa jadi lebih dekat.' },
        { speaker: 'narrator', text: 'Percaya, ngobrol, sabar, saling ngerti, dan terus milih satu sama lain — lagi dan lagi.' },
      ],
      hint: 'Balik ke pulau, yuk. Mochi udah nyiapin piknik kecil…',
    },
    {
      id: 'picnic',
      title: 'Kencan yang Berantakan',
      subtitle: 'Nggak harus sempurna, kok',
      intro: [
        { speaker: 'narrator', text: 'Babak Empat — Kencan yang Berantakan.' },
        { speaker: 'pet', text: 'Pikniknya udah siap! Eh... kok kuenya ilang?!' },
      ],
      outro: [{ speaker: 'pet', text: 'Yah, memang nggak sempurna. Tapi kalau bisa ketawa bareng begini, kayaknya udah cukup bahagia, deh.' }],
      hint: 'Langitnya mulai keemasan… Mochi lari ke arah Love Tree.',
    },
    {
      id: 'letter',
      title: 'Surat dari Masa Depan',
      subtitle: 'Ada kata-kata yang memang buat disimpan',
      intro: [
        { speaker: 'narrator', text: 'Babak Lima — Surat dari Masa Depan.' },
        { speaker: 'pet', text: 'Kayaknya ini surat yang dari tadi disembunyiin di bawah pohon, deh. Buka, yuk. Aku jadi penasaran!' },
      ],
      outro: [],
      hint: '',
    },
  ],
}

/**
 * TEMAN KECIL — hati kecil berbulu yang ngikutin dia ke mana-mana dan heboh sama semuanya.
 * Semua kalimat bisa diubah. Dia nggak pernah menghalangi apa pun; kalimatnya muncul sebagai gelembung kecil.
 */
export const companion = {
  name: 'Mochi',
  sleeping: 'Zzz… (beneran nggak ngintip)',
  wake: ['…Aku belum bangun. Nggak ada buktinya.', 'Iya, iya, aku bangun!! Hai, aku Mochi! Aku udah nungguin kamu dari lama banget. (Sepuluh menit.)'],
  follow: 'Eh, tungguin aku dong! Kakiku pendek, tau!',
  pet: ['Hehe, geli!', '*goyang-goyang senang*', 'Aku mau ngikutin kamu ke mana aja. Soalnya aku nggak tahu jalan.', 'Lagi! Lagi!', 'Kamu wangi bunga. Eh, itu bunganya ding.'],
  flower: ['Bunga yang bercahaya! Petik, petik!', 'Yeay! Satu bunga ketemu! Tinggal dua lagi. Semangat, {you}!', 'Udah tiga semuanya!! Aku mau nangis. Nangis bahagia. Nangis berbulu.'],
  carry: ['Biar aku yang bawa yang ini!', '…', 'Lho, bunganya kok lebih tinggi dari aku?!'],
  roll: ['Wiiii— aku sengaja kok!'],
  butterfly: ['Kupu-kupu! Balik dong! Aku cuma mau temenan!', 'Ke mana dia? Tadi beneran ada, kan?'],
  found: ['Ketemu!!', 'Keren! Kamu keren banget!', 'Aku tahu kamu pasti bisa! (Aku berharap, sih.)', '*muter-muter heboh*'],
  bridge: ['Ups! Kayaknya aku tadi sok tahu. Coba kita pikirin lagi, ya!', 'Aku percaya sama kamu! Aku juga percaya sama camilan.', 'Dikit lagi! Jembatannya malu-malu. Coba lagi, yuk!'],
  picnic: ['Oke, ada masalah kecil…', 'JANGAN KUENYA!', 'Sempurna! Ya — sempurna versi berantakan.'],
  saved: 'Hampir aja makan siang kita berubah jadi makan angin!',
  envelope: 'Psst! Ada sesuatu yang nungguin di bawah Love Tree!',
  reward: {
    title: 'Kenangan kecil pertama',
    text: 'Mochi nemu ini buat kamu. Ini salah satu kenangan pertama di dunia kecil ini — dan salah satu favoritku.',
  },
}

/** BABAK 1 — tiga bunga bercahaya di padang, dekat tempat petualangannya dimulai. */
export const glowFlowers = [
  { id: 'rose', color: '#ff8fc4' },
  { id: 'sky', color: '#a8d8ff' },
  { id: 'sun', color: '#ffd98a' },
]

/** BABAK 4 — KENCAN YANG BERANTAKAN. Tiga mini-game singkat yang nggak bisa gagal; semua kalimat bisa diubah. */
export const picnic = {
  title: 'Kencan yang Berantakan',
  games: {
    catch: { title: 'Tangkap Bunga Terbang', how: 'Bunganya diterbangin angin! Sentuh (atau klik) tiga bunga yang lagi melayang. Bisa juga tekan E.', done: 'Tiga bunga ketangkap ✦' },
    save: { title: 'Selamatkan Piknik', how: 'Ada maling kecil yang ngincer kue kita! Sentuh dia pas dia masuk ke lingkaran yang bercahaya. (Atau tekan E.)', done: 'Kuenya selamat ✦', early: 'Kecepetan — sekarang dia malah ngeliatin kamu. Canggung.', late: 'Kuenya diambil! …terus jatuh. Coba lagi, yuk.' },
    fix: { title: 'Rapikan Piknik', how: 'Sentuh satu barang, terus sentuh tempat bercahaya yang cocok buat barang itu. (Atau tekan E buat naruh barang berikutnya.)', done: 'Pikniknya siap ✦', wrong: 'Hmm, bukan di situ tempatnya 🙈', pick: 'Sentuh dulu salah satu barang yang berantakan ✦' },
  },
  wind: 'Wusss! Anginnya bikin piknik kita berantakan… 🙈',
  /** muncul saat mereka duduk berdua waktu senja */
  message: 'Yah, memang nggak sempurna. Tapi kalau bisa ketawa bareng begini, kayaknya udah cukup bahagia, deh.',
}

/** BABAK 5 — amplop di bawah Love Tree (membuka surat cinta di bawah). */
export const envelope = {
  label: 'Buka amplop di bawah Love Tree',
}

/** Kata-kata terakhir ending. Muncul satu per satu; baris kosong dilewati. */
export const finalMessage = {
  lines: [
    'Perjalanannya sudah selesai...',
    'Semua bunga, jembatan, hadiah, dan tempat kecil yang kamu temukan tadi...',
    'Sebenarnya cuma caraku untuk menyampaikan satu hal.',
    'Di antara banyak hal yang bisa aku buat...',
    'Aku paling bersyukur karena bisa mengenal kamu.',
    'Makasih, ya, {you}, udah jadi bagian dari dunia aku. 🤍',
  ],
  replay: 'Ulangi ending',
  memories: 'Lihat lagi kenangan kita',
  letter: 'Baca suratnya lagi',
  stay: 'Tetap di dunia kecil kita',
}

/** RAHASIA KECIL — hati kecil bercahaya di balik pohon sakura besar di Memory Garden. */
export const secretHeart = {
  title: 'Rahasia kecil',
  text: 'Ada satu hal di dunia kecil ini yang nggak pernah bisa aku jelasin pakai kode: seberapa berartinya kamu buat aku.',
}

/**
 * AVATAR — tokoh kecil yang bisa dia pilih. Nama, baju, dan warna bisa diubah.
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

/** Nama-nama tempat di pulau, tertulis di peta (bebas diganti). */
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

/**
 * BABAK 2 — HAL-HAL KECIL TENTANG KAMU. Lima benda di pulau, masing-masing dengan pesannya.
 * `photo` harus salah satu foto asli kamu (atau null).
 */
export const littleThings = [
  {
    id: 'photo',
    title: 'Sebuah Foto',
    zone: 'Memory Garden',
    hint: 'Ke kiri dari Love Tree, masuk ke Memory Garden. Ada foto kecil yang ditutup kain di antara bunga-bunga pink — samperin, terus buka kainnya.',
    message: 'Salah satu foto favoritku tentang kita — bukti kalau hari biasa sama kamu bisa jadi sesuatu yang pengin aku simpan.',
    photo: 'photos/2agustus.jpeg',
  },
  {
    id: 'letter',
    title: 'Surat dalam Botol',
    zone: 'Reflection Lake',
    hint: 'Ke Reflection Lake (kanan atas), terus naik ke jembatan kayu. Ada botol kaca yang ngambang di sebelahnya — ambil dari atas jembatan.',
    message: 'Ada banyak hal kecil tentang kamu yang mungkin kamu anggap biasa aja. Tapi buat aku, justru hal-hal itu yang bikin kamu istimewa.',
  },
  {
    id: 'flower',
    title: 'Bunga yang Tidur',
    zone: 'Heartwood Forest',
    hint: 'Ikuti jalan setapak ke Heartwood Forest (kiri atas). Di antara pohon-pohon tinggi ada bunga bercahaya yang lagi tidur — samperin dan sentuh.',
    message: 'Ada hal-hal yang cuma mekar kalau diperlakukan dengan lembut. Makasih udah lembut sama aku.',
  },
  {
    id: 'musicbox',
    title: 'Kotak Musik',
    zone: 'Starfall Cliff',
    hint: 'Ikuti jalan bercahaya di kanan Love Tree, terus naik ke Starfall Cliff. Kotak musiknya nunggu di dekat puncak.',
    message: 'Kalau disuruh memilih satu hal yang bikin hari aku lebih baik, kayaknya jawabannya bakal tetap kamu.',
  },
  {
    id: 'star',
    title: 'Bintang Jatuh',
    zone: 'Starting Meadow',
    hint: 'Dekat banget sama tempat kamu mulai: di Starting Meadow (bawah), agak ke kiri — cari bintang kecil yang bersinar di rumput.',
    message: 'Cahaya sekecil apa pun bisa bikin semuanya kelihatan beda. Kamu ngelakuin itu buat aku.',
  },
]

/**
 * BABAK 3 — JAUH, TAPI TETAP DEKAT. Lima hal yang menyambung jembatan di antara dua pulau.
 */
export const connections = [
  {
    id: 'trust',
    hint: 'Cari lentera di pulau kamu (yang kiri). Tekan dan tahan terus — jangan dilepas — sampai lampunya nyala sendiri.',
    title: 'Percaya',
    how: 'Tekan dan tahan lenteranya sampai lampunya tetap menyala.',
    message: 'Percaya itu kayak lampu yang tetap dinyalain, walaupun kita belum bisa lihat ujung satunya.',
  },
  {
    id: 'communication',
    hint: 'Sentuh kerang pink yang bercahaya di pulau kamu (kiri). Tunggu cahayanya terbang ke seberang, terus sentuh kerang ungu di pulau satunya (kanan) buat membalas.',
    title: 'Komunikasi',
    how: 'Kirim cahaya dari pulau kamu, terus balas dari pulau satunya.',
    message: 'Jarak bisa bikin semuanya lebih susah, tapi nggak bisa menghapus hal yang penting.',
  },
  {
    id: 'patience',
    hint: 'Ada cahaya kecil yang bolak-balik di tengah jembatan. Tunggu sampai dia masuk ke lingkaran bercahaya (lingkarannya jadi lebih terang), baru sentuh.',
    title: 'Sabar',
    how: 'Tunggu cahayanya sampai di celah — baru sentuh.',
    message: 'Kadang sayang itu artinya mau nunggu sedikit lebih lama buat momen yang tepat.',
  },
  {
    id: 'understanding',
    hint: 'Sentuh salah satu bintang di atas jembatan buat mulai. Perhatiin urutan nyalanya, terus sentuh dengan urutan yang sama persis. Salah? Sentuh bintangnya lagi buat lihat urutannya sekali lagi.',
    title: 'Saling Mengerti',
    how: 'Perhatiin bintangnya, terus nyalain dengan urutan yang sama.',
    message: 'Ada hari-hari di mana sayang itu artinya mengerti. Ada juga hari di mana artinya mau coba lagi.',
  },
  {
    id: 'effort',
    hint: 'Sentuh (atau klik) rodanya berkali-kali — kira-kira sepuluh putaran — sampai potongan terakhir jembatannya terpasang.',
    title: 'Usaha',
    how: 'Putar rodanya sampai bagian terakhir jembatan muncul.',
    message: 'Walaupun jauh, kita tetap bisa milih buat hadir buat satu sama lain.',
  },
]

/** Catatan opsional yang disembunyikan di pulau. Nggak pernah menghalangi cerita. */
export const hiddenNotes = [
  { id: 'forest-hollow', where: 'Heartwood Forest', text: 'If you found this, you were curious enough to look. I love that about you.' },
  { id: 'lake-stone', where: 'Reflection Lake', text: 'Still water reflects the sky. I hope I can be that calm place for you sometimes.' },
  { id: 'cliff-edge', where: 'Starfall Cliff', text: 'From up here everything looks small — except how much you mean to me.' },
  { id: 'cove-light', where: 'Secret Cove', text: 'You found the secret cove. Some of the best things are a little hidden.' },
]

/** Pemandangan dari Starfall Cliff (muncul sekali, saat pertama sampai). */
export const viewpoint = {
  title: 'Starfall Cliff',
  text: 'Look how far you’ve come.',
}

/** ENDING — dua keterangan pelan, lalu pesan terakhir di atas. */
export const finalCinematic = {
  captions: ['Setiap lampu kecil di sini dinyalain buat kamu.', 'Dan semuanya masih menyala sampai sekarang.'],
  title: 'DUNIA KECIL UNTUK KAMU',
  skip: 'Lewati',
}

/**
 * SURAT CINTA — Babak 5: ditemukan di amplop di bawah Love Tree, sebelum ending.
 * `personalNote`: paragraf tambahan yang cuma kamu yang bisa tulis (kosongkan untuk menyembunyikan).
 * `photo` / `voice`: path di /public, atau null untuk menyembunyikan.
 */
export const loveLetter = {
  greeting: '{you}, makasih, ya, udah hadir di hidup aku.',
  opening: 'Aku tahu, aku nggak selalu sempurna. Kadang aku bikin kamu kesal, kadang aku terlalu banyak mikir, dan kadang aku nggak pandai menjelaskan apa yang aku rasakan.',
  body: [
    'Tapi ada satu hal yang pengin selalu kamu tahu: aku senang bisa kenal kamu, bisa dekat sama kamu, dan bisa punya kesempatan buat menyayangi kamu.',
    'Aku nggak tahu semua hal yang bakal kita hadapi nanti. Tapi aku berharap kita bisa terus belajar memahami satu sama lain, saling menguatkan, dan tetap memilih untuk berjalan bersama.',
  ],
  personalNote: '',
  ending: ['Dunia kecil ini mungkin cuma game sederhana. Tapi aku bikin semuanya karena ada satu orang yang ingin aku buat tersenyum.', 'Orang itu kamu, {you}. 🤍'],
  signature: '— Rayhan',
  photo: 'photos/26september(1).jpeg',
  voice: null,
  /** tombol-tombol di surat */
  readAll: 'Baca semuanya',
  continue: 'Lanjut ♡',
  replay: 'Ulangi ending',
  back: 'Kembali ke dunia kita',
  open: 'Buka suratnya',
}

/**
 * MESIN WAKTU — satu entri per tanggal. Pakai foto asli kamu; `narration` bebas diubah.
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
 * BENANG MERAH — dua pulau di bawah langit yang sama.
 * `audio`: taruh pesan suara di /public/audio (misal 'audio/suara-1.m4a') supaya tombol putar muncul.
 */
export const redThread = {
  prompt: 'Sentuh kedua pulau buat mengikat benang merahnya.',
  connected: 'Tersambung. Nggak ada jarak yang bisa melepasnya.',
  messages: {
    me: {
      title: 'Pesan dari Jakarta',
      text: 'Setiap malam aku lihat langit yang sama kayak yang ada di atas kamu, dan rasanya aku jadi sedikit lebih dekat.',
      audio: null,
    },
    you: {
      title: 'Pesan yang nunggu di Makassar',
      text: 'Di mana pun kamu, benang ini bakal nemuin kamu. Tarik aja kalau lagi kangen — aku pasti kerasa.',
      audio: null,
    },
  },
}

/** SIMULATOR MASA DEPAN — dunia-dunia di balik portal. Judul dan pesan bebas diubah. */
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
 *  ENDING RAHASIA — "SATU HAL YANG NGGAK PERNAH BISA AKU KODEKAN ♡"
 *  Tersembunyi di Ruang Rahasia setelah game selesai.
 *  Semua di bawah ini bisa diubah.
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
