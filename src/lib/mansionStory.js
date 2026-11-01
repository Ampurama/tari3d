/*
 * THE HAUNTED GNOME MANSION — every word of it: the diary, the mysterious book, the ghosts' lines,
 * the hints, the boss and the two endings (lib/mansion.js decides when each is said).
 *
 * The story: the Kenop family of gnomes lived here, happily and noisily, until Opa Muram, the
 * grumpy great-grandfather, was afraid they'd all move away. He wound the Cuckoo Clock of Gloom
 * (Jam Kukuk Kelam) so nobody would ever leave… and everyone in the house became a ghost. Four
 * family heirlooms, set back into the clock, can wind time forward again.
 */

/** Who's who (for the talk card). */
export const GHOSTS = {
  mimi: { name: 'Mimi', role: 'Hantu pemalu' },
  buntut: { name: 'Si Buntut', role: 'Hantu penguntit' },
  dor: { name: 'Pak Dor', role: 'Hantu pengagetan' },
  usil: { name: 'Usil', role: 'Hantu jahil' },
  cici: { name: 'Cici', role: 'Hantu penakut' },
  penjaga: { name: 'Pak Penjaga', role: 'Penjaga perpustakaan' },
  opa: { name: 'Opa Muram', role: 'Kakek buyut keluarga Kenop' },
  pesta: { name: 'Geng Gudang Anggur', role: 'Hantu-hantu (katanya nggak lagi pesta)' },
}

/** The diary pages, found around the house (page 1 starts the story). */
export const DIARY = [
  {
    title: 'Diari Keluarga Kenop · Halaman 1',
    text: 'Kalau kamu membaca ini, berarti kamu berani masuk. Selamat datang! Maaf berantakan, kami sudah seratus tahun nggak bersih-bersih. Rumah ini dikutuk. Pintu Perpustakaan cuma terbuka kalau tuas perapian dan kenop oven diputar BERSAMAAN. Kunci basement kami patahkan jadi dua dan kami sembunyikan. Satu di tempat yang berisik, satu lagi di tempat yang cuma kelihatan di cermin. — Bu Kenop',
  },
  {
    title: 'Halaman 2 · Ditemukan di dapur',
    text: 'Hari ke-3.211 jadi hantu. Usil memasukkan ayam ke lemari lagi. Ayamnya beranak. Sekarang ada dua puluh empat. Tolong jangan buka lemarinya kalau belum siap mental.',
  },
  {
    title: 'Halaman 3 · Ditemukan di perpustakaan',
    text: 'Pak Penjaga tidak pernah meninggalkan rak buku itu, KECUALI kalau ada musik. Dia nggak tahan godaan dansa. Siapa pun bisa memutar gramofon, tapi butuh orang kedua untuk menarik tuasnya. Kalau sendirian? Putar engkol gramofonnya lebih lama, lalu lari.',
  },
  {
    title: 'Halaman 4 · Ditemukan di basement',
    text: 'Opa menulis kode brankasnya di tembok ruang ketel, pakai simbol, dan dibaca dari KANAN. Artinya ada di buku bersampul ungu di perpustakaan. Opa memang suka bikin susah.',
  },
  {
    title: 'Halaman 5 · Ditemukan di loteng',
    text: 'Opa memutar Jam Kukuk Kelam supaya kami semua nggak pernah pergi dari rumah ini. Berhasil sih. Terlalu berhasil. Kalau empat pusaka keluarga dikembalikan ke dalam jam, waktu akan berjalan lagi. Jangan, JANGAN tekan tombol besar yang berkilau di loteng. Kami juga nggak tahu itu buat apa.',
  },
]
/** Where each extra page lies (building-local, storey). */
export const DIARY_SPOTS = [
  null,
  { f: 'G', x: 4.1, z: 2.0 },
  { f: 'G', x: 4.0, z: -2.1 },
  { f: 'B', x: 0.9, z: -4.3 },
  { f: 'A', x: -2.0, z: 1.8 },
]

/** The mysterious book on the library desk (its cipher opens the safe). */
export const BOOK = {
  title: 'Buku Misterius bersampul ungu',
  pages: [
    'Bab 1: Cara Menjadi Hantu yang Baik. 1. Jangan menembus tembok sambil makan. 2. Bilang "Buu" dengan sopan. 3. Jangan iri pada hantu yang lebih tembus pandang.',
    'Bab 7: Sandi Keluarga Kenop.\n🍄 = 4   🌙 = 7   🔑 = 1\n🕯️ = 9   🐔 = 2   👻 = 5\n"Simbol di tembok dibaca dari kanan ke kiri, seperti Opa yang suka melawan arus."',
    'Catatan pinggir (tulisan anak kecil): Opa sebenarnya nggak jahat, dia cuma takut ditinggal. Kayak aku waktu disuruh tidur sendiri.',
  ],
}
/** The scrawl on the boiler room wall (written left to right as it appears; read it right to left). */
export const WALL_SCRAWL = '🌙  🕯️  🐔'

/** Each painting: what it shows (and the symbol with its Roman numeral in a corner). */
export const PAINTING_TEXT = {
  living: 'Lukisan Bu Kenop memandangi bulan. Di pojok bawahnya ada tulisan kecil: 🌙 · I. Matanya… barusan bergerak?',
  dolls: 'Lukisan si kembar Kenop memeluk jamur raksasa. Di pojoknya: 🍄 · II.',
  kitchen: 'Lukisan ayam yang memakai topi koki, gagah sekali. Di pojoknya: 🐔 · III.',
  library: 'Lukisan Opa Muram memegang lilin, cemberut. Di pojoknya: 🕯️ · IV.',
}

/** The ghosts' little lines (one is picked each time; the house also chooses by what's going on). */
export const LINES = {
  mimi: ['E-eh… halo. Jangan lihat aku terlalu lama, ya, nanti aku tembus pandang beneran.', 'Aku nggak takut, kok. Aku cuma… malu. Bedanya tipis.', 'Kamu jalannya pelan. Aku suka orang yang jalannya pelan.'],
  mimiRun: ['KYAA! Jangan lari-lari!', 'Terlalu cepat! Aku pergi dulu!'],
  buntut: ['…', 'Aku nggak ngikutin kamu. Kita cuma kebetulan jalan ke arah yang sama terus.', 'Jangan noleh! …Yah, noleh.'],
  buntutTrip: ['ADUH. Siapa yang taruh lantai di sini?!', 'Aku sengaja jatuh. Itu strategi.'],
  buntutBonk: ['Lho, kok tembok. Tadi kayaknya kamu.', 'Aku hantu. Harusnya aku bisa nembus tembok. HARUSNYA.'],
  dor: ['DOR! …Kaget, kan? Bilang kaget, dong.', 'Aku latihan ngagetin tiga ratus tahun, lho.', 'Eh, ini lemariku. Cari lemari lain, sana.'],
  usil: ['Hihihi. Bonekanya pindah sendiri? Masa sih?', 'Aku nggak ngapa-ngapain. Aku cuma lewat. Sambil mindahin barang.', 'Kamu tahu siapa yang masukin ayam ke lemari? Bukan aku. Mungkin aku.'],
  cici: ['JANGAN DEKAT-DEKAT! Aku… aku takut sama manusia!', 'Kamu nggak gigit, kan? Janji?', 'Aku hantu, tapi aku takut gelap. Jangan bilang siapa-siapa.'],
  ciciFriend: ['Ternyata kalian baik. Aku ikut, ya? Aku jaga belakang. Dari jauh.', 'Kalau ada apa-apa, kita sembunyi di lemari bareng. Aku jago sembunyi.'],
  ciciHide: ['Ssst! Aku ikut sembunyi, ya… aku juga takut.', 'Sempit, ya. Tapi lebih aman berdua. Eh, bertiga.'],
  penjaga: ['Buku-buku ini tidak untuk dipinjam. Tidak untuk dibaca. Tidak untuk dilihat terlalu lama.', 'Rak ini kujaga siang dan malam. Kecuali kalau ada lagu bagus.'],
  penjagaDance: ['Ahh, lagu ini! Satu, dua, cha-cha-cha!', 'Jangan lihat aku! Aku lagi khusyuk berdansa!'],
  penjagaCaught: ['Eits! Tuas itu bukan mainan, Nak.', 'Ketahuan! Mau menarik tuas, ya? Tidak semudah itu.'],
  pesta: ['Pesta? Pesta apa? Nggak ada pesta di sini.', 'Kami cuma… rapat. Rapat sambil pakai topi kerucut.', 'Ssst, musiknya kecilin! Ada manusia!'],
  opa: ['Pergi dari rumahku!', 'Kalian mau mengambil keluargaku, ya?!'],
}
/** "Tiga ayam terakhir" and friends: what the kitchen cupboard says. */
export const CHICKENS = {
  open: 'Lemari dibuka… dan DUA PULUH EMPAT AYAM menghambur keluar! Petok petok petok!',
  last: 'Satu ayam tertinggal di dalam lemari. Dia memakai topi tambalan kecil, dan… menggigit sepotong kunci?',
  took: 'Ayam itu dengan sopan menyerahkan potongan kunci dan topinya. Lalu pergi tanpa pamit.',
}

/** The quest card: chapters and objectives (each is done when its step / heirloom is). */
export const CHAPTERS = [
  { title: 'Rumah di Ujung Jalan', goals: [{ step: 'enter', text: 'Masuk lewat pintu depan' }, { step: 'diary', text: 'Temukan petunjuk pertama di Foyer' }] },
  {
    title: 'Dua Tombol, Satu Hati',
    goals: [
      { step: 'library_open', text: 'Putar tuas perapian & kenop oven bersamaan' },
      { step: 'key_a', text: 'Cari potongan kunci di tempat yang berisik' },
      { step: 'mirror', text: 'Nyalakan cermin di Kamar Boneka dengan cahaya lilin' },
      { step: 'key_b', text: 'Ambil potongan kunci dari boneka yang tepat' },
      { step: 'basement_open', text: 'Satukan kunci, buka pintu ruang bawah tanah' },
    ],
  },
  { title: 'Penjaga Perpustakaan', goals: [{ step: 'bookcase', text: 'Alihkan Pak Penjaga, tarik tuas rak buku' }, { step: 'dial_open', text: 'Susun simbol di Lorong Rahasia (lihat lukisan)' }] },
  { title: 'Di Bawah Lantai', goals: [{ step: 'safe', text: 'Pecahkan kode brankas (buku + tembok ketel)' }] },
  { title: 'Loteng', goals: [{ step: 'attic_open', text: 'Buka palka loteng (dua gembok)' }, { step: 'boss_seen', text: 'Naik ke loteng' }, { step: 'boss_done', text: 'Nyalakan keempat lentera' }] },
]

/** Hints (Cici and Mimi give the one for the first goal not done yet). */
export const HINTS = {
  enter: 'Pintunya di atas tangga beranda. Nggak dikunci, kok. Kami nggak punya kunci… eh, punya, tapi patah.',
  diary: 'Ada buku harian di meja kecil dekat pintu masuk. Bu Kenop suka nulis.',
  library_open: 'Tuas di perapian ruang tamu, kenop di oven dapur. Harus diputar barengan! Kalau sendirian, lari secepat kilat.',
  key_a: 'Tempat paling berisik di rumah ini? Lemari dapur. Siapkan telinga.',
  mirror: 'Cermin di kamar boneka cuma jujur kalau ada cahaya lilin di lingkaran lantai. Satu pegang lilin, satu lihat cermin.',
  key_b: 'Di cermin, boneka yang pegang kunci pakai pita ungu. Usil suka mindahin bonekanya, jadi cari pitanya!',
  basement_open: 'Pintu ruang bawah tanah ada di pojok dapur, dekat tangga kecil.',
  bookcase: 'Putar gramofon di pojok perpustakaan. Pak Penjaga pasti dansa. Yang satunya tarik tuas di samping rak buku!',
  dial_open: 'Empat lukisan di empat ruangan. Lihat simbol dan angka romawinya. I, II, III, IV.',
  safe: 'Buku ungu di perpustakaan punya sandi. Tembok ruang ketel punya simbolnya. Dibaca dari kanan! Kalian harus saling bilang.',
  attic_open: 'Palka loteng punya dua gembok: roda simbol, dan kunci dari brankas.',
  boss_seen: 'Loteng… Opa ada di sana. Aku ikut doa dari bawah, ya.',
  boss_done: 'Nyalakan keempat lenteranya! Jaga lentera supaya Opa nggak bisa meniupnya.',
  items: 'Kalau mau kutukannya patah beneran, kumpulkan empat pusaka: jam saku, topi tambalan, kotak musik, lilin biru.',
  done: 'Kalian sudah sampai ujung cerita. Mau main lagi? Ada tombol di kartu quest.',
}

/** What the house says when a step is done (both screens). */
export const STEP_TOASTS = {
  enter: '🕯️ Pintu berderit terbuka… Selamat datang di Rumah Kurcaci Berhantu.',
  diary: '📖 Diari Keluarga Kenop ditemukan. Ada petunjuk pertama!',
  cici: '👻 Cici tidak takut lagi. Dia sekarang temanmu (dan bisa kasih petunjuk).',
  library_open: '🔓 Klik! Pintu Perpustakaan terbuka.',
  mirror: '🪞 Di cermin, salah satu boneka memegang potongan kunci… boneka berpita ungu!',
  key_a: '🗝️ Potongan kunci pertama!',
  key_b: '🗝️ Potongan kunci kedua!',
  basement_open: '🔓 Dua potongan kunci menyatu. Pintu ruang bawah tanah terbuka… hawanya dingin.',
  bookcase: '📚 Rak buku bergeser. Ada lorong rahasia di baliknya!',
  dial_open: '✨ Keempat simbol menyala. Gembok pertama palka loteng terbuka.',
  safe: '🔓 Brankas terbuka! Ada lilin biru dan sebuah kunci kecil.',
  attic_open: '🔓 Palka loteng terbuka. Ada suara jam berdetak dari atas…',
  boss_seen: '⏳ Opa Muram terbangun.',
  boss_done: '🏮 Keempat lentera menyala! Opa Muram tidak bisa melawan lagi.',
}
export const ITEM_TOASTS = {
  watch: '⌚ Pusaka: Jam Saku Retak. Jarumnya berhenti di pukul tiga lewat sedikit.',
  hat: '🎩 Pusaka: Topi Tambalan. Agak bau ayam.',
  musicbox: '🎶 Pusaka: Kotak Musik Mungil. Lagunya sedih tapi manis.',
  candle: '🕯️ Pusaka: Lilin Biru. Nyalanya dingin.',
}

/** The boss, Opa Muram. */
export const BOSS = {
  intro: [
    { speaker: 'Opa Muram', text: 'SIAPA YANG BERANI NAIK KE LOTENGKU?!' },
    { speaker: 'Opa Muram', text: 'Kalian mau membawa pergi keluargaku, ya? Seperti semua orang yang akhirnya pergi?' },
    { speaker: 'Opa Muram', text: 'Tidak akan! Selama lentera-lentera ini padam, waktu tidak akan berjalan. Tidak ada yang pergi. Tidak ada yang berubah!' },
    { speaker: 'Cici (dari bawah tangga)', text: 'Nyalakan keempat lenteranya! Jaga supaya Opa nggak bisa meniupnya!' },
  ],
  taunts: ['Fuuuh! Padam!', 'Lentera itu milikku!', 'Kalian tidak mengerti!', 'Aku cuma ingin semua tetap di sini!'],
  blocked: ['Minggir dari lenteraku!', 'Hmph. Kalian curang, berdiri di situ.'],
  roar: 'HUAAAAAH!',
  weak: [
    { speaker: 'Opa Muram', text: '…Terang sekali. Sudah lama aku nggak lihat loteng ini terang.' },
    { speaker: 'Opa Muram', text: 'Aku cuma takut ditinggal. Anak-anak tumbuh besar, cucu-cucu pindah rumah… aku pikir kalau waktu berhenti, semua akan tetap tinggal.' },
    { speaker: 'Opa Muram', text: 'Tapi rumah yang waktunya berhenti itu bukan rumah. Itu cuma… lemari besar berdebu.' },
    { speaker: 'Opa Muram', text: 'Jam itu bisa diputar lagi. Kalau kalian punya keempat pusaka keluarga, kembalikan ke dalamnya.' },
  ],
}

/** The two endings. */
export const ENDINGS = {
  good: {
    title: 'Good Ending · Waktu Berjalan Lagi',
    lines: [
      { speaker: '', text: 'Jam saku, topi tambalan, kotak musik, dan lilin biru masuk ke dalam Jam Kukuk Kelam satu per satu…' },
      { speaker: '', text: 'Tik. Tok. Burung kukuknya keluar, batuk sedikit karena debu, lalu bernyanyi: KUKUK!' },
      { speaker: 'Opa Muram', text: 'Tanganku… hangat? Aku punya tangan lagi!' },
      { speaker: 'Bu Kenop', text: 'Anak-anak! Kita jadi kurcaci lagi! Mimi, jangan sembunyi, kamu sudah nggak tembus pandang!' },
      { speaker: 'Cici', text: 'Aku… aku nggak takut lagi! Eh, masih takut gelap sih. Tapi sedikit!' },
      { speaker: 'Opa Muram', text: 'Terima kasih, kalian berdua. Mampirlah kapan-kapan. Pintu rumah ini sekarang terbuka, dan waktunya berjalan.' },
    ],
    toast: '✨ Kutukan patah! Keluarga Kenop kembali jadi kurcaci. Hadiah: Jam Kukuk untuk rumah kalian.',
  },
  funny: {
    title: 'Funny Ending · Rumah Pesta Hantu',
    lines: [
      { speaker: '', text: 'Tombolnya berkilau. Tulisannya "JANGAN DITEKAN". Tentu saja tombolnya ditekan.' },
      { speaker: '', text: 'KLIK. Lantai bergetar. Bola disko raksasa turun dari langit-langit. Dua puluh empat ayam berbaris dan mulai berdansa.' },
      { speaker: 'Opa Muram', text: 'APA ITU?! …Lho, lagunya enak juga.' },
      { speaker: 'Geng Gudang Anggur', text: 'AKHIRNYA! PESTANYA RESMI! KAMI NGGAK PERLU PURA-PURA RAPAT LAGI!' },
      { speaker: 'Usil', text: 'Ternyata tombol itu mekanisme pesta otomatis peninggalan Kakek Buyut Opa. Keluarga ini memang aneh.' },
      { speaker: 'Opa Muram', text: 'Ya sudah. Kalau rumah ini jadi tempat pesta, mungkin nggak akan ada yang mau pergi. Mampir lagi, ya! Bawa camilan!' },
    ],
    toast: '🪩 Rumah Kurcaci Berhantu sekarang jadi Rumah Pesta Hantu! Hadiah: Bola Disko Hantu untuk rumah kalian.',
  },
}
export const CHOICE = {
  ask: 'Opa Muram terduduk lesu di depan jam. Di sudut loteng, sebuah tombol besar berkilau-kilau menggoda. Apa yang kalian lakukan?',
  good: 'Kembalikan empat pusaka ke Jam Kukuk',
  goodMissing: (n) => `Pusakanya baru ${n}/4. Cari sisanya dulu (jam saku, topi tambalan, kotak musik, lilin biru).`,
  funny: 'Tekan tombol besar yang berkilau (penasaran…)',
  later: 'Nanti dulu',
}
