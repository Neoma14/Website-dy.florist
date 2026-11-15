// Model isi undangan digital: nilai bawaan, validasi, dan bentuk data publik.
// Semua isian dari admin dirapikan di sini (field tak dikenal dibuang, panjang dibatasi,
// alamat foto/musik/peta hanya yang aman), sehingga halaman undangan selalu menerima data yang bersih.

export const INVITATION_STATUSES = ['draft', 'terbit', 'arsip'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export const ATTENDANCE = ['hadir', 'tidak', 'ragu'] as const;

// Slug: huruf kecil/angka/strip, 3–60 karakter, tidak diawali/diakhiri strip
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;
const RESERVED_SLUGS = new Set(['demo', 'admin', 'api', 'contoh', 'baru']);
export const isValidSlug = (s: string) => SLUG_RE.test(s) && !s.includes('--') && !RESERVED_SLUGS.has(s);

// Foto & musik yang boleh dipakai di undangan: aset situs, unggahan lokal (pengembangan), atau Vercel Blob milik situs
const MEDIA_RE = /^(\/assets\/[\w./-]{1,200}|\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|mp3)|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(products|invitations)\/[\w.-]{1,120})$/;
const MAPS_RE = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\/[^\s<>"']*$/;
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;

// Teks satu baris: tanpa karakter kontrol; teks panjang boleh berisi baris baru
const line = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const para = (v: unknown, max: number) =>
  (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const media = (v: unknown) => { const s = line(v, 500); return MEDIA_RE.test(s) ? s : ''; };
const img = (v: unknown) => { const s = media(v); return /\.mp3$/.test(s) ? '' : s; };
const bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : dflt);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const iso = (v: unknown) => {
  const s = line(v, 40);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : '';
};

function person(v: unknown) {
  const p = obj(v);
  const ig = line(p.instagram, 40).replace(/^@/, '');
  return {
    fullName: line(p.fullName, 80),
    nickname: line(p.nickname, 40),
    childOrder: line(p.childOrder, 40),
    father: line(p.father, 80),
    mother: line(p.mother, 80),
    photo: img(p.photo),
    instagram: IG_RE.test(ig) ? ig : '',
  };
}

// ---------- Label tanggal & jam dari nilai ISO (tanggal sesuai yang diisi admin, tanpa konversi zona waktu) ----------
const ZONE_BY_OFFSET: Record<string, string> = { '+07:00': 'WIB', '+08:00': 'WITA', '+09:00': 'WIT' };
export function dateLabelOf(isoStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(isoStr);
  if (!m) return '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function timeLabelOf(start: string, end: string): string {
  const m = /T(\d{2}):(\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})$/.exec(start);
  if (!m) return '';
  const zone = m[3] === 'Z' ? 'UTC' : ZONE_BY_OFFSET[m[3]] ?? `UTC${m[3]}`;
  const e = /T(\d{2}):(\d{2})/.exec(end);
  return `${m[1]}.${m[2]} – ${e ? `${e[1]}.${e[2]}` : 'Selesai'} ${zone}`;
}

/** Merapikan isi undangan dari admin. Tidak pernah melempar error: nilai yang tidak sah dikosongkan. */
export function normalizeInvitationData(input: unknown) {
  const d = obj(input);
  const couple = obj(d.couple);
  const greeting = obj(d.greeting);
  const quote = obj(greeting.quote);
  const photos = obj(d.photos);
  const gifts = obj(d.gifts);
  const music = obj(d.music);
  const closing = obj(d.closing);
  const rsvp = obj(d.rsvp);
  const wishes = obj(d.wishes);
  const theme = obj(d.theme);
  const maxGuests = Number(rsvp.maxGuests);
  const events = arr(d.events, 4).map((v, i) => {
    const e = obj(v);
    const maps = line(e.mapsUrl, 300);
    const startIso = iso(e.startIso);
    const endIso = iso(e.endIso);
    return {
      id: `acara${i + 1}`,
      title: line(e.title, 40),
      startIso,
      endIso,
      // Tanggal & jam selalu dihitung dari startIso/endIso, jadi tidak pernah berbeda dengan tanggal yang dipilih
      dateLabel: dateLabelOf(startIso) || line(e.dateLabel, 60),
      timeLabel: timeLabelOf(startIso, endIso) || line(e.timeLabel, 60),
      venueName: line(e.venueName, 100),
      address: para(e.address, 200),
      mapsUrl: MAPS_RE.test(maps) ? maps : '',
    };
  }).filter((e) => e.title);
  // Tanggal di sampul = tanggal acara paling awal (isian manual hanya dipakai bila belum ada acara bertanggal)
  const dated = events.filter((e) => e.startIso).sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso));
  return {
    couple: { groom: person(couple.groom), bride: person(couple.bride) },
    dateLabel: dated[0]?.dateLabel || line(d.dateLabel, 60),
    heroLine: para(d.heroLine, 200),
    greeting: {
      salam: line(greeting.salam, 120),
      opening: para(greeting.opening, 800),
      quote: { arabic: para(quote.arabic, 600), text: para(quote.text, 600), source: line(quote.source, 60) },
    },
    eventsIntro: para(d.eventsIntro, 300),
    events,
    story: arr(d.story, 8).map((v) => {
      const s = obj(v);
      return { title: line(s.title, 80), period: line(s.period, 30), body: para(s.body, 1200) };
    }).filter((s) => s.title || s.body),
    photos: {
      cover: img(photos.cover),
      couple: img(photos.couple),
      closing: img(photos.closing),
      gallery: arr(photos.gallery, 12).map(img).filter(Boolean),
    },
    gifts: {
      note: para(gifts.note, 400),
      accounts: arr(gifts.accounts, 4).map((v) => {
        const a = obj(v);
        return { bank: line(a.bank, 40), number: line(a.number, 40), name: line(a.name, 80) };
      }).filter((a) => a.bank && a.number),
      address: para(gifts.address, 200),
    },
    music: { src: /\.mp3$/.test(media(music.src)) ? media(music.src) : '', title: line(music.title, 80) },
    closing: {
      thanks: para(closing.thanks, 600),
      prayer: para(closing.prayer, 400),
      salam: line(closing.salam, 120),
      family: para(closing.family, 200),
    },
    rsvp: {
      enabled: bool(rsvp.enabled, true),
      maxGuests: Number.isInteger(maxGuests) ? Math.min(10, Math.max(1, maxGuests)) : 2,
    },
    wishes: { enabled: bool(wishes.enabled, true), requireApproval: bool(wishes.requireApproval, false) },
    theme: { javanese: bool(theme.javanese, true) },
  };
}

export type InvitationData = ReturnType<typeof normalizeInvitationData>;

/** Isi bawaan untuk undangan baru: teks pembuka/penutup sudah terisi, data mempelai & acara kosong. */
export function newInvitationData(): InvitationData {
  return normalizeInvitationData({
    greeting: {
      salam: 'Assalamu’alaikum Warahmatullahi Wabarakatuh',
      opening: 'Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami. Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir untuk memberikan doa restu.',
      quote: {
        arabic: 'وَمِنْ اٰيٰتِهٖٓ اَنْ خَلَقَ لَكُمْ مِّنْ اَنْفُسِكُمْ اَزْوَاجًا لِّتَسْكُنُوْٓا اِلَيْهَا وَجَعَلَ بَيْنَكُمْ مَّوَدَّةً وَّرَحْمَةً',
        text: 'Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.',
        source: 'QS. Ar-Rum: 21',
      },
    },
    couple: {
      groom: { childOrder: 'Putra pertama dari' },
      bride: { childOrder: 'Putri pertama dari' },
    },
    events: [
      { title: 'Akad Nikah' },
      { title: 'Resepsi' },
    ],
    gifts: {
      note: 'Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Namun jika memberi adalah ungkapan tanda kasih, Anda dapat memberi kado secara cashless.',
    },
    closing: {
      thanks: 'Merupakan kebahagiaan dan kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu. Atas kehadiran dan doa yang diberikan, kami ucapkan terima kasih.',
      salam: 'Wassalamu’alaikum Warahmatullahi Wabarakatuh',
    },
    rsvp: { enabled: true, maxGuests: 2 },
    wishes: { enabled: true, requireApproval: false },
    theme: { javanese: true },
  });
}

/** Semua alamat media dalam isi undangan (untuk dibersihkan dari penyimpanan saat undangan dihapus). */
export function mediaUrls(d: InvitationData): string[] {
  return [d.couple.groom.photo, d.couple.bride.photo, d.photos.cover, d.photos.couple, d.photos.closing, ...d.photos.gallery, d.music.src]
    .filter(Boolean);
}

/** Masalah yang membuat undangan belum layak diterbitkan. */
export function publishProblems(d: InvitationData): string[] {
  const p: string[] = [];
  if (!d.couple.groom.nickname || !d.couple.bride.nickname) p.push('Nama panggilan kedua mempelai wajib diisi');
  if (!d.events.length) p.push('Minimal satu acara wajib diisi');
  else if (!d.events.some((e) => e.startIso)) p.push('Tanggal & jam acara wajib diisi');
  return p;
}

// ---------- Masa aktif ----------
export const RETENTION_OPTIONS = [0, 30, 90, 180, 365] as const;
export const DEFAULT_RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Waktu acara terakhir (akhir acara, atau mulai bila akhir kosong), atau null bila belum ada tanggal. */
export function lastEventTime(d: Pick<InvitationData, 'events'>): number | null {
  const times = d.events.map((e) => Date.parse(e.endIso) || Date.parse(e.startIso)).filter((n) => !Number.isNaN(n));
  return times.length ? Math.max(...times) : null;
}

/** Kapan undangan berakhir (diarsipkan otomatis); null = tidak otomatis atau belum ada tanggal acara. */
export function expiryOf(d: Pick<InvitationData, 'events'>, days: number): Date | null {
  if (!days || days < 1) return null;
  const last = lastEventTime(d);
  return last === null ? null : new Date(last + days * DAY_MS);
}

// ---------- Formulir data pelanggan ----------
// Pelanggan hanya boleh mengisi data pribadi/acara. Salam, ayat, musik, dan pengaturan tetap dikelola admin.
export const INTAKE_STATUSES = ['none', 'open', 'submitted', 'applied', 'closed'] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export function pickIntake(d: InvitationData) {
  return {
    couple: d.couple,
    events: d.events,
    story: d.story,
    photos: d.photos,
    gifts: d.gifts,
    closing: { family: d.closing.family },
  };
}
export type IntakeData = ReturnType<typeof pickIntake>;

/** Data formulir pelanggan dari JSON tersimpan, sudah divalidasi ulang; null bila kosong/rusak. */
export function parseIntake(raw: string | null): IntakeData | null {
  if (!raw) return null;
  try { return pickIntake(normalizeInvitationData(JSON.parse(raw))); } catch { return null; }
}

/** Terapkan isian pelanggan ke data undangan: isian yang terisi menimpa, yang kosong tidak menghapus data admin. */
export function mergeIntake(base: InvitationData, intake: IntakeData): InvitationData {
  const out = structuredClone(base);
  const s = (a: string, b: string) => (b ? b : a);
  for (const who of ['groom', 'bride'] as const) {
    const o = out.couple[who];
    const i = intake.couple[who];
    for (const k of Object.keys(o) as (keyof typeof o)[]) o[k] = s(o[k], i[k]);
  }
  if (intake.events.length) out.events = intake.events;
  if (intake.story.length) out.story = intake.story;
  out.photos.cover = s(out.photos.cover, intake.photos.cover);
  out.photos.couple = s(out.photos.couple, intake.photos.couple);
  out.photos.closing = s(out.photos.closing, intake.photos.closing);
  if (intake.photos.gallery.length) out.photos.gallery = intake.photos.gallery;
  out.gifts.note = s(out.gifts.note, intake.gifts.note);
  out.gifts.address = s(out.gifts.address, intake.gifts.address);
  if (intake.gifts.accounts.length) out.gifts.accounts = intake.gifts.accounts;
  out.closing.family = s(out.closing.family, intake.closing.family);
  return out;
}

/** Ringkasan isian pelanggan untuk admin (tanpa menampilkan seluruh data). */
export function intakeSummary(i: IntakeData) {
  const person = (p: IntakeData['couple']['groom']) => !!(p.nickname || p.fullName);
  return {
    mempelai: [i.couple.groom, i.couple.bride].filter(person).length,
    acara: i.events.length,
    kisah: i.story.length,
    foto: [i.couple.groom.photo, i.couple.bride.photo, i.photos.cover, i.photos.couple, i.photos.closing].filter(Boolean).length + i.photos.gallery.length,
    rekening: i.gifts.accounts.length,
  };
}

export function parseStoredData(raw: string): InvitationData {
  try { return normalizeInvitationData(JSON.parse(raw)); } catch { return newInvitationData(); }
}
