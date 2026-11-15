// Data undangan contoh (fiktif) untuk template "Jawa Elegan".
// Nama, orang tua, tempat, dan rekening di bawah ini bukan data orang sungguhan.
export const DEMO_INVITATION = {
  slug: 'demo',
  template: 'jawa-elegan',
  isDemo: true,
  theme: { javanese: true },
  couple: {
    groom: {
      fullName: 'Rizky Pratama, S.T.',
      nickname: 'Rizky',
      childOrder: 'Putra pertama dari',
      father: 'Bapak Ahmad Santoso',
      mother: 'Ibu Sri Wahyuni',
      photo: '',
      instagram: 'rizky.contoh',
    },
    bride: {
      fullName: 'Nadia Safitri, S.Pd.',
      nickname: 'Nadia',
      childOrder: 'Putri kedua dari',
      father: 'Bapak Hendra Gunawan',
      mother: 'Ibu Rina Marlina',
      photo: '',
      instagram: 'nadia.contoh',
    },
  },
  dateLabel: 'Sabtu, 12 Juni 2027',
  heroLine: 'Dua hati, satu niat suci, melangkah bersama dalam ikatan pernikahan.',
  greeting: {
    salam: 'Assalamu’alaikum Warahmatullahi Wabarakatuh',
    opening: 'Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami. Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir untuk memberikan doa restu.',
    quote: {
      arabic: 'وَمِنْ اٰيٰتِهٖٓ اَنْ خَلَقَ لَكُمْ مِّنْ اَنْفُسِكُمْ اَزْوَاجًا لِّتَسْكُنُوْٓا اِلَيْهَا وَجَعَلَ بَيْنَكُمْ مَّوَدَّةً وَّرَحْمَةً',
      text: 'Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.',
      source: 'QS. Ar-Rum: 21',
    },
  },
  events: [
    {
      id: 'akad',
      title: 'Akad Nikah',
      startIso: '2027-06-12T08:00:00+07:00',
      endIso: '2027-06-12T10:00:00+07:00',
      dateLabel: 'Sabtu, 12 Juni 2027',
      timeLabel: '08.00 – 10.00 WIB',
      venueName: 'Kediaman Mempelai Wanita',
      address: 'Jl. Contoh Melati No. 12, Kota Metro, Lampung',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kota+Metro+Lampung',
    },
    {
      id: 'resepsi',
      title: 'Resepsi',
      startIso: '2027-06-12T11:00:00+07:00',
      endIso: '2027-06-12T14:00:00+07:00',
      dateLabel: 'Sabtu, 12 Juni 2027',
      timeLabel: '11.00 – 14.00 WIB',
      venueName: 'Gedung Serbaguna (contoh)',
      address: 'Jl. Contoh Kenanga No. 8, Kota Metro, Lampung',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kota+Metro+Lampung',
    },
  ],
  story: [
    { title: 'Awal Bertemu', period: '2021', body: 'Kami pertama kali bertemu dalam sebuah kegiatan kampus. Sapaan sederhana hari itu menjadi awal cerita yang tak pernah kami duga.' },
    { title: 'Tumbuh Bersama', period: '2023', body: 'Hari demi hari kami belajar saling memahami, saling menguatkan, dan menemukan bahwa kebersamaan adalah tempat paling nyaman untuk pulang.' },
    { title: 'Lamaran', period: '2026', body: 'Dengan restu kedua orang tua, kami memantapkan langkah untuk melanjutkan hubungan ini ke jenjang pernikahan.' },
  ],
  photos: { cover: '', couple: '', closing: '', gallery: [] as string[] },
  gifts: {
    note: 'Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Namun jika memberi adalah ungkapan tanda kasih, Anda dapat memberi kado secara cashless.',
    accounts: [
      { bank: 'BANK CONTOH', number: '1234567890', name: 'Rizky Pratama (contoh)' },
      { bank: 'E-WALLET CONTOH', number: '081200000000', name: 'Nadia Safitri (contoh)' },
    ],
    address: 'Jl. Contoh Melati No. 12, Kota Metro, Lampung',
  },
  music: { src: '', title: '' },
  closing: {
    thanks: 'Merupakan kebahagiaan dan kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu. Atas kehadiran dan doa yang diberikan, kami ucapkan terima kasih.',
    prayer: 'Semoga Allah SWT menghimpun kami dalam kebaikan dan menjadikan pernikahan ini penuh berkah, ketenangan, dan kasih sayang.',
    salam: 'Wassalamu’alaikum Warahmatullahi Wabarakatuh',
    family: 'Keluarga Besar Bapak Ahmad Santoso & Keluarga Besar Bapak Hendra Gunawan',
  },
  rsvp: { enabled: true, maxGuests: 5 },
  wishes: {
    enabled: true,
    // minutesAgo diubah menjadi createdAt saat dikirim (lihat demoInvitation), agar "x menit lalu" selalu wajar
    sample: [
      { name: 'Contoh Tamu', attendance: 'hadir', message: 'Selamat menempuh hidup baru! Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.', minutesAgo: 12 },
      { name: 'Contoh Sahabat', attendance: 'ragu', message: 'Barakallahu lakuma wa baraka alaikuma. Bahagia selalu untuk kalian berdua.', minutesAgo: 47 },
      { name: 'Contoh Rekan Kerja', attendance: 'hadir', message: 'Selamat ya Rizky & Nadia, semoga lancar sampai hari H dan langgeng selamanya.', minutesAgo: 95 },
      { name: 'Contoh Keluarga', attendance: 'hadir', message: 'Turut berbahagia. Semoga menjadi keluarga yang penuh berkah dan kasih sayang.', minutesAgo: 180 },
      { name: 'Contoh Teman Kuliah', attendance: 'tidak', message: 'Mohon maaf belum bisa hadir. Doa terbaik dari jauh untuk kalian berdua.', minutesAgo: 320 },
      { name: 'Contoh Tetangga', attendance: 'hadir', message: 'Selamat menempuh hidup baru, semoga samawa.', minutesAgo: 1500 },
      { name: 'Contoh Sepupu', attendance: 'ragu', message: 'Insya Allah hadir. Bahagia selalu ya!', minutesAgo: 2900 },
    ],
  },
};

// Data contoh dengan waktu ucapan relatif terhadap sekarang
export function demoInvitation() {
  const now = Date.now();
  return {
    ...DEMO_INVITATION,
    wishes: {
      enabled: DEMO_INVITATION.wishes.enabled,
      items: DEMO_INVITATION.wishes.sample.map(({ minutesAgo, ...w }) => ({ ...w, createdAt: new Date(now - minutesAgo * 60_000).toISOString() })),
    },
  };
}
