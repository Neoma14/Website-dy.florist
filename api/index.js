var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/lib/mailer.ts
var ALERT_EMAIL = process.env.ALERT_EMAIL || "dyfloristparcel@gmail.com";
var SITE_URL = (process.env.SITE_URL || "https://www.dyflorist.site").replace(/\/+$/, "");
var escHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function recoveryUrl(token) {
  return `${SITE_URL}/admin?pemulihan=${token}`;
}
async function sendBlockedAlert(info) {
  const link = recoveryUrl(info.token);
  const when = (/* @__PURE__ */ new Date()).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short" }) + " WIB";
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error(`[KEAMANAN] Login admin diblokir (${info.ip}). RESEND_API_KEY belum diatur, email tidak terkirim. Link pemulihan (24 jam): ${link}`);
    return false;
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b2227">
  <h2 style="color:#E4007F;margin-bottom:4px">dy.florist</h2>
  <h3 style="margin-top:0">Login admin diblokir</h3>
  <p>Ada percobaan login ke halaman admin dengan password salah berulang kali. Setelah dikunci 5 menit, percobaan itu masih salah, sehingga login dari perangkat tersebut <strong>diblokir</strong>.</p>
  <table style="font-size:14px;margin:12px 0">
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Waktu</td><td>${escHtml(when)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Alamat IP</td><td>${escHtml(info.ip)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Perangkat</td><td>${escHtml(info.userAgent.slice(0, 160))}</td></tr>
  </table>
  <p>Jika itu Anda, buka blokir dengan tombol di bawah (berlaku 24 jam, sekali pakai):</p>
  <p><a href="${link}" style="display:inline-block;background:#E4007F;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Buka Blokir Login Admin</a></p>
  <p style="font-size:13px;color:#6c6267">Jika bukan Anda, jangan klik tombol di atas. Blokir tetap aktif dan password Anda aman. Pertimbangkan mengganti password admin.</p>
</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "dy.florist Keamanan <onboarding@resend.dev>",
        to: [ALERT_EMAIL],
        subject: "Peringatan: login admin dy.florist diblokir",
        html
      })
    });
    if (!res.ok) {
      console.error(`[KEAMANAN] Email pemulihan gagal (${res.status}). Link pemulihan (24 jam): ${link}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[KEAMANAN] Email pemulihan gagal: ${e instanceof Error ? e.message : e}. Link pemulihan (24 jam): ${link}`);
    return false;
  }
}

// server/invitations/demo.ts
var DEMO_INVITATION = {
  slug: "demo",
  template: "jawa-elegan",
  isDemo: true,
  theme: { javanese: true },
  couple: {
    groom: {
      fullName: "Rizky Pratama, S.T.",
      nickname: "Rizky",
      childOrder: "Putra pertama dari",
      father: "Bapak Ahmad Santoso",
      mother: "Ibu Sri Wahyuni",
      photo: "/assets/undangan/contoh/mempelai-pria.jpg",
      instagram: "rizky.contoh"
    },
    bride: {
      fullName: "Nadia Safitri, S.Pd.",
      nickname: "Nadia",
      childOrder: "Putri kedua dari",
      father: "Bapak Hendra Gunawan",
      mother: "Ibu Rina Marlina",
      photo: "/assets/undangan/contoh/mempelai-wanita.jpg",
      instagram: "nadia.contoh"
    }
  },
  dateLabel: "Sabtu, 12 Juni 2027",
  heroLine: "Dua hati, satu niat suci, melangkah bersama dalam ikatan pernikahan.",
  greeting: {
    salam: "Assalamu\u2019alaikum Warahmatullahi Wabarakatuh",
    opening: "Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami. Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir untuk memberikan doa restu.",
    quote: {
      arabic: "\u0648\u064E\u0645\u0650\u0646\u0652 \u0627\u0670\u064A\u0670\u062A\u0650\u0647\u0656\u0653 \u0627\u064E\u0646\u0652 \u062E\u064E\u0644\u064E\u0642\u064E \u0644\u064E\u0643\u064F\u0645\u0652 \u0645\u0650\u0651\u0646\u0652 \u0627\u064E\u0646\u0652\u0641\u064F\u0633\u0650\u0643\u064F\u0645\u0652 \u0627\u064E\u0632\u0652\u0648\u064E\u0627\u062C\u064B\u0627 \u0644\u0650\u0651\u062A\u064E\u0633\u0652\u0643\u064F\u0646\u064F\u0648\u0652\u0653\u0627 \u0627\u0650\u0644\u064E\u064A\u0652\u0647\u064E\u0627 \u0648\u064E\u062C\u064E\u0639\u064E\u0644\u064E \u0628\u064E\u064A\u0652\u0646\u064E\u0643\u064F\u0645\u0652 \u0645\u064E\u0651\u0648\u064E\u062F\u064E\u0651\u0629\u064B \u0648\u064E\u0651\u0631\u064E\u062D\u0652\u0645\u064E\u0629\u064B",
      text: "Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.",
      source: "QS. Ar-Rum: 21"
    }
  },
  events: [
    {
      id: "akad",
      title: "Akad Nikah",
      startIso: "2027-06-12T08:00:00+07:00",
      endIso: "2027-06-12T10:00:00+07:00",
      dateLabel: "Sabtu, 12 Juni 2027",
      timeLabel: "08.00 \u2013 10.00 WIB",
      venueName: "Kediaman Mempelai Wanita",
      address: "Jl. Contoh Melati No. 12, Kota Metro, Lampung",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Kota+Metro+Lampung"
    },
    {
      id: "resepsi",
      title: "Resepsi",
      startIso: "2027-06-12T11:00:00+07:00",
      endIso: "2027-06-12T14:00:00+07:00",
      dateLabel: "Sabtu, 12 Juni 2027",
      timeLabel: "11.00 \u2013 14.00 WIB",
      venueName: "Gedung Serbaguna (contoh)",
      address: "Jl. Contoh Kenanga No. 8, Kota Metro, Lampung",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Kota+Metro+Lampung"
    }
  ],
  story: [
    { title: "Awal Bertemu", period: "2021", body: "Kami pertama kali bertemu dalam sebuah kegiatan kampus. Sapaan sederhana hari itu menjadi awal cerita yang tak pernah kami duga." },
    { title: "Tumbuh Bersama", period: "2023", body: "Hari demi hari kami belajar saling memahami, saling menguatkan, dan menemukan bahwa kebersamaan adalah tempat paling nyaman untuk pulang." },
    { title: "Lamaran", period: "2026", body: "Dengan restu kedua orang tua, kami memantapkan langkah untuk melanjutkan hubungan ini ke jenjang pernikahan." }
  ],
  // Foto contoh (bukan pasangan sungguhan pemesan dy.florist)
  photos: {
    cover: "/assets/undangan/contoh/prewed-berdiri.jpg",
    couple: "/assets/undangan/contoh/prewed-duduk.jpg",
    closing: "/assets/undangan/contoh/prewed-beskap.jpg",
    gallery: ["/assets/undangan/contoh/prewed-duduk.jpg", "/assets/undangan/contoh/prewed-berdiri.jpg", "/assets/undangan/contoh/prewed-beskap.jpg"]
  },
  gifts: {
    note: "Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Namun jika memberi adalah ungkapan tanda kasih, Anda dapat memberi kado secara cashless.",
    accounts: [
      { bank: "BANK CONTOH", number: "1234567890", name: "Rizky Pratama (contoh)" },
      { bank: "E-WALLET CONTOH", number: "081200000000", name: "Nadia Safitri (contoh)" }
    ],
    address: "Jl. Contoh Melati No. 12, Kota Metro, Lampung"
  },
  music: { src: "/assets/undangan/contoh/musik-contoh.mp3", title: "Janji Suci \u2013 Yovie & Nuno (Saxophone Cover by Dori Wirawan)" },
  closing: {
    thanks: "Merupakan kebahagiaan dan kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu. Atas kehadiran dan doa yang diberikan, kami ucapkan terima kasih.",
    prayer: "Semoga Allah SWT menghimpun kami dalam kebaikan dan menjadikan pernikahan ini penuh berkah, ketenangan, dan kasih sayang.",
    salam: "Wassalamu\u2019alaikum Warahmatullahi Wabarakatuh",
    family: "Keluarga Besar Bapak Ahmad Santoso & Keluarga Besar Bapak Hendra Gunawan"
  },
  rsvp: { enabled: true, maxGuests: 5 },
  wishes: {
    enabled: true,
    // minutesAgo diubah menjadi createdAt saat dikirim (lihat demoInvitation), agar "x menit lalu" selalu wajar
    sample: [
      { name: "Contoh Tamu", attendance: "hadir", message: "Selamat menempuh hidup baru! Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.", minutesAgo: 12 },
      { name: "Contoh Sahabat", attendance: "ragu", message: "Barakallahu lakuma wa baraka alaikuma. Bahagia selalu untuk kalian berdua.", minutesAgo: 47 },
      { name: "Contoh Rekan Kerja", attendance: "hadir", message: "Selamat ya Rizky & Nadia, semoga lancar sampai hari H dan langgeng selamanya.", minutesAgo: 95 },
      { name: "Contoh Keluarga", attendance: "hadir", message: "Turut berbahagia. Semoga menjadi keluarga yang penuh berkah dan kasih sayang.", minutesAgo: 180 },
      { name: "Contoh Teman Kuliah", attendance: "tidak", message: "Mohon maaf belum bisa hadir. Doa terbaik dari jauh untuk kalian berdua.", minutesAgo: 320 },
      { name: "Contoh Tetangga", attendance: "hadir", message: "Selamat menempuh hidup baru, semoga samawa.", minutesAgo: 1500 },
      { name: "Contoh Sepupu", attendance: "ragu", message: "Insya Allah hadir. Bahagia selalu ya!", minutesAgo: 2900 }
    ]
  }
};
function demoInvitation() {
  const now = Date.now();
  return {
    ...DEMO_INVITATION,
    wishes: {
      enabled: DEMO_INVITATION.wishes.enabled,
      items: DEMO_INVITATION.wishes.sample.map(({ minutesAgo, ...w }) => ({ ...w, createdAt: new Date(now - minutesAgo * 6e4).toISOString() }))
    }
  };
}

// server/invitations/model.ts
var INVITATION_STATUSES = ["draft", "terbit", "arsip"];
var ATTENDANCE = ["hadir", "tidak", "ragu"];
var SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;
var RESERVED_SLUGS = /* @__PURE__ */ new Set(["demo", "admin", "api", "contoh", "baru"]);
var isValidSlug = (s) => SLUG_RE.test(s) && !s.includes("--") && !RESERVED_SLUGS.has(s);
var MEDIA_RE = /^(\/assets\/[\w./-]{1,200}|\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|mp3)|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(products|invitations)\/[\w.-]{1,120})$/;
var MAPS_RE = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\/[^\s<>"']*$/;
var IG_RE = /^[A-Za-z0-9._]{1,30}$/;
var line = (v, max) => typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
var para = (v, max) => typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
var media = (v) => {
  const s = line(v, 500);
  return MEDIA_RE.test(s) ? s : "";
};
var img = (v) => {
  const s = media(v);
  return /\.mp3$/.test(s) ? "" : s;
};
var bool = (v, dflt) => typeof v === "boolean" ? v : dflt;
var obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
var arr = (v, max) => Array.isArray(v) ? v.slice(0, max) : [];
var iso = (v) => {
  const s = line(v, 40);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : "";
};
function person(v) {
  const p = obj(v);
  const ig = line(p.instagram, 40).replace(/^@/, "");
  return {
    fullName: line(p.fullName, 80),
    nickname: line(p.nickname, 40),
    childOrder: line(p.childOrder, 40),
    father: line(p.father, 80),
    mother: line(p.mother, 80),
    photo: img(p.photo),
    instagram: IG_RE.test(ig) ? ig : ""
  };
}
function normalizeInvitationData(input) {
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
  return {
    couple: { groom: person(couple.groom), bride: person(couple.bride) },
    dateLabel: line(d.dateLabel, 60),
    heroLine: para(d.heroLine, 200),
    greeting: {
      salam: line(greeting.salam, 120),
      opening: para(greeting.opening, 800),
      quote: { arabic: para(quote.arabic, 600), text: para(quote.text, 600), source: line(quote.source, 60) }
    },
    eventsIntro: para(d.eventsIntro, 300),
    events: arr(d.events, 4).map((v, i) => {
      const e = obj(v);
      const maps = line(e.mapsUrl, 300);
      return {
        id: `acara${i + 1}`,
        title: line(e.title, 40),
        startIso: iso(e.startIso),
        endIso: iso(e.endIso),
        dateLabel: line(e.dateLabel, 60),
        timeLabel: line(e.timeLabel, 60),
        venueName: line(e.venueName, 100),
        address: para(e.address, 200),
        mapsUrl: MAPS_RE.test(maps) ? maps : ""
      };
    }).filter((e) => e.title),
    story: arr(d.story, 8).map((v) => {
      const s = obj(v);
      return { title: line(s.title, 80), period: line(s.period, 30), body: para(s.body, 1200) };
    }).filter((s) => s.title || s.body),
    photos: {
      cover: img(photos.cover),
      couple: img(photos.couple),
      closing: img(photos.closing),
      gallery: arr(photos.gallery, 12).map(img).filter(Boolean)
    },
    gifts: {
      note: para(gifts.note, 400),
      accounts: arr(gifts.accounts, 4).map((v) => {
        const a = obj(v);
        return { bank: line(a.bank, 40), number: line(a.number, 40), name: line(a.name, 80) };
      }).filter((a) => a.bank && a.number),
      address: para(gifts.address, 200)
    },
    music: { src: /\.mp3$/.test(media(music.src)) ? media(music.src) : "", title: line(music.title, 80) },
    closing: {
      thanks: para(closing.thanks, 600),
      prayer: para(closing.prayer, 400),
      salam: line(closing.salam, 120),
      family: para(closing.family, 200)
    },
    rsvp: {
      enabled: bool(rsvp.enabled, true),
      maxGuests: Number.isInteger(maxGuests) ? Math.min(10, Math.max(1, maxGuests)) : 2
    },
    wishes: { enabled: bool(wishes.enabled, true), requireApproval: bool(wishes.requireApproval, false) },
    theme: { javanese: bool(theme.javanese, true) }
  };
}
function newInvitationData() {
  return normalizeInvitationData({
    greeting: {
      salam: "Assalamu\u2019alaikum Warahmatullahi Wabarakatuh",
      opening: "Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami. Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir untuk memberikan doa restu.",
      quote: {
        arabic: "\u0648\u064E\u0645\u0650\u0646\u0652 \u0627\u0670\u064A\u0670\u062A\u0650\u0647\u0656\u0653 \u0627\u064E\u0646\u0652 \u062E\u064E\u0644\u064E\u0642\u064E \u0644\u064E\u0643\u064F\u0645\u0652 \u0645\u0650\u0651\u0646\u0652 \u0627\u064E\u0646\u0652\u0641\u064F\u0633\u0650\u0643\u064F\u0645\u0652 \u0627\u064E\u0632\u0652\u0648\u064E\u0627\u062C\u064B\u0627 \u0644\u0650\u0651\u062A\u064E\u0633\u0652\u0643\u064F\u0646\u064F\u0648\u0652\u0653\u0627 \u0627\u0650\u0644\u064E\u064A\u0652\u0647\u064E\u0627 \u0648\u064E\u062C\u064E\u0639\u064E\u0644\u064E \u0628\u064E\u064A\u0652\u0646\u064E\u0643\u064F\u0645\u0652 \u0645\u064E\u0651\u0648\u064E\u062F\u064E\u0651\u0629\u064B \u0648\u064E\u0651\u0631\u064E\u062D\u0652\u0645\u064E\u0629\u064B",
        text: "Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.",
        source: "QS. Ar-Rum: 21"
      }
    },
    couple: {
      groom: { childOrder: "Putra pertama dari" },
      bride: { childOrder: "Putri pertama dari" }
    },
    events: [
      { title: "Akad Nikah" },
      { title: "Resepsi" }
    ],
    gifts: {
      note: "Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Namun jika memberi adalah ungkapan tanda kasih, Anda dapat memberi kado secara cashless."
    },
    closing: {
      thanks: "Merupakan kebahagiaan dan kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu. Atas kehadiran dan doa yang diberikan, kami ucapkan terima kasih.",
      salam: "Wassalamu\u2019alaikum Warahmatullahi Wabarakatuh"
    },
    rsvp: { enabled: true, maxGuests: 2 },
    wishes: { enabled: true, requireApproval: false },
    theme: { javanese: true }
  });
}
function mediaUrls(d) {
  return [d.couple.groom.photo, d.couple.bride.photo, d.photos.cover, d.photos.couple, d.photos.closing, ...d.photos.gallery, d.music.src].filter(Boolean);
}
function publishProblems(d) {
  const p = [];
  if (!d.couple.groom.nickname || !d.couple.bride.nickname) p.push("Nama panggilan kedua mempelai wajib diisi");
  if (!d.events.length) p.push("Minimal satu acara wajib diisi");
  else if (!d.events.some((e) => e.startIso)) p.push("Tanggal & jam acara wajib diisi");
  return p;
}
function parseStoredData(raw) {
  try {
    return normalizeInvitationData(JSON.parse(raw));
  } catch {
    return newInvitationData();
  }
}

// server/invitations/service.ts
import { and, desc, eq, inArray, sql } from "drizzle-orm";

// server/db/index.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bespokePrices: () => bespokePrices,
  categories: () => categories,
  invitationWishes: () => invitationWishes,
  invitations: () => invitations,
  loginAttempts: () => loginAttempts,
  loginBlocks: () => loginBlocks,
  orderItems: () => orderItems,
  orders: () => orders,
  products: () => products,
  rateEvents: () => rateEvents,
  recoveryTokens: () => recoveryTokens,
  sessions: () => sessions
});
import { mysqlTable, varchar, int, text, mediumtext, timestamp, datetime, index } from "drizzle-orm/mysql-core";
var categories = mysqlTable("categories", {
  key: varchar("key", { length: 30 }).primaryKey(),
  name: varchar("name", { length: 40 }).notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull().default(""),
  sort: int("sort").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var bespokePrices = mysqlTable("bespoke_prices", {
  key: varchar("key", { length: 40 }).primaryKey(),
  kind: varchar("kind", { length: 10 }).notNull(),
  // 'type' | 'addon'
  label: varchar("label", { length: 60 }).notNull(),
  price: int("price"),
  // null = harga via konsultasi (khusus jenis produk)
  sort: int("sort").notNull().default(0)
});
var products = mysqlTable("products", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(),
  categoryName: varchar("category_name", { length: 40 }).notNull(),
  price: int("price").notNull(),
  // Harga coret (harga normal sebelum diskon); null = tidak ada diskon
  originalPrice: int("original_price"),
  // Link contoh untuk produk undangan digital (mis. /undangan/demo); null = tidak ada
  demoUrl: varchar("demo_url", { length: 200 }),
  badge: varchar("badge", { length: 40 }).notNull().default(""),
  description: text("description").notNull(),
  image: varchar("image", { length: 500 }).notNull(),
  rating: int("rating_x10").notNull().default(50),
  reviews: int("reviews").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  recipient: varchar("recipient", { length: 120 }).notNull(),
  scheduled: varchar("scheduled", { length: 120 }).notNull(),
  note: varchar("note", { length: 500 }).notNull().default(""),
  total: int("total").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  productId: varchar("product_id", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  price: int("price").notNull(),
  qty: int("qty").notNull()
}, (t2) => [index("order_items_order_idx").on(t2.orderId)]);
var sessions = mysqlTable("sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  expiresAt: datetime("expires_at").notNull(),
  // 'main' = admin utama (semua menu), 'undangan' = Admin Undangan (hanya undangan digital)
  role: varchar("role", { length: 10 }).notNull().default("main")
});
var invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  status: varchar("status", { length: 10 }).notNull().default("draft"),
  // draft | terbit | arsip
  template: varchar("template", { length: 30 }).notNull().default("jawa-elegan"),
  customerName: varchar("customer_name", { length: 120 }).notNull().default(""),
  customerPhone: varchar("customer_phone", { length: 30 }).notNull().default(""),
  note: varchar("note", { length: 500 }).notNull().default(""),
  data: mediumtext("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: datetime("published_at")
});
var invitationWishes = mysqlTable("invitation_wishes", {
  id: int("id").autoincrement().primaryKey(),
  invitationId: int("invitation_id").notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  message: varchar("message", { length: 300 }).notNull(),
  attendance: varchar("attendance", { length: 10 }),
  // hadir | tidak | ragu | null
  guests: int("guests").notNull().default(1),
  status: varchar("status", { length: 10 }).notNull().default("tampil"),
  // tampil | menunggu | sembunyi
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (t2) => [index("invitation_wishes_inv_idx").on(t2.invitationId, t2.createdAt)]);
var loginAttempts = mysqlTable("login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (t2) => [index("login_attempts_ip_idx").on(t2.ipHash, t2.createdAt)]);
var loginBlocks = mysqlTable("login_blocks", {
  ipHash: varchar("ip_hash", { length: 64 }).primaryKey(),
  level: int("level").notNull(),
  lockedUntil: datetime("locked_until"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var recoveryTokens = mysqlTable("recovery_tokens", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  expiresAt: datetime("expires_at").notNull(),
  usedAt: datetime("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var rateEvents = mysqlTable("rate_events", {
  id: int("id").autoincrement().primaryKey(),
  bucket: varchar("bucket", { length: 40 }).notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (t2) => [index("rate_events_idx").on(t2.bucket, t2.ipHash, t2.createdAt)]);

// server/db/index.ts
var pool;
function getDb() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum diatur");
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 3,
      charset: "utf8mb4",
      // agar emoji (mis. pada kategori) tersimpan dengan benar
      ssl: process.env.DATABASE_SSL === "false" ? void 0 : { minVersion: "TLSv1.2", rejectUnauthorized: true }
    });
  }
  return drizzle(pool, { schema: schema_exports, mode: "default" });
}

// server/invitations/service.ts
async function findInvitationBySlug(slug) {
  const [row] = await getDb().select().from(schema_exports.invitations).where(eq(schema_exports.invitations.slug, slug)).limit(1);
  return row;
}
async function findInvitationById(id) {
  const [row] = await getDb().select().from(schema_exports.invitations).where(eq(schema_exports.invitations.id, id)).limit(1);
  return row;
}
async function attendanceStats(invitationId) {
  const rows = await getDb().select({
    attendance: schema_exports.invitationWishes.attendance,
    n: sql`count(*)`,
    guests: sql`coalesce(sum(${schema_exports.invitationWishes.guests}), 0)`
  }).from(schema_exports.invitationWishes).where(and(eq(schema_exports.invitationWishes.invitationId, invitationId), inArray(schema_exports.invitationWishes.status, ["tampil", "menunggu"]))).groupBy(schema_exports.invitationWishes.attendance);
  const stats = { hadir: 0, tidak: 0, ragu: 0, tamuHadir: 0 };
  for (const r of rows) {
    if (r.attendance === "hadir") {
      stats.hadir = Number(r.n);
      stats.tamuHadir = Number(r.guests);
    }
    if (r.attendance === "tidak") stats.tidak = Number(r.n);
    if (r.attendance === "ragu") stats.ragu = Number(r.n);
  }
  return stats;
}
async function visibleWishes(invitationId) {
  const rows = await getDb().select().from(schema_exports.invitationWishes).where(and(eq(schema_exports.invitationWishes.invitationId, invitationId), eq(schema_exports.invitationWishes.status, "tampil"))).orderBy(desc(schema_exports.invitationWishes.createdAt), desc(schema_exports.invitationWishes.id)).limit(200);
  return rows.map(publicWish);
}
var publicWish = (w) => ({
  name: w.name,
  message: w.message,
  attendance: w.attendance,
  createdAt: new Date(w.createdAt).toISOString()
});
async function publicInvitation(row, preview) {
  const d = parseStoredData(row.data);
  const [stats, items] = await Promise.all([attendanceStats(row.id), visibleWishes(row.id)]);
  return {
    slug: row.slug,
    template: row.template,
    isDemo: false,
    isPreview: preview,
    ...d,
    rsvp: { ...d.rsvp, stats: { hadir: stats.hadir, tidak: stats.tidak, ragu: stats.ragu } },
    wishes: { ...d.wishes, items: d.wishes.enabled ? items : [] }
  };
}
var esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var absolute = (u) => u.startsWith("/") ? SITE_URL + u : u;
async function invitationShareHtml(slug, guest) {
  let d = null;
  if (slug === "demo") d = demoInvitation();
  else if (/^[a-z0-9-]{3,60}$/.test(slug)) {
    const row = await findInvitationBySlug(slug);
    if (row?.status === "terbit") d = parseStoredData(row.data);
  }
  const url = `${SITE_URL}/undangan/${encodeURIComponent(slug)}${guest ? `?to=${encodeURIComponent(guest)}` : ""}`;
  if (!d) {
    return { status: 404, html: page("Undangan Digital \u2014 dy.florist", "Undangan pernikahan digital oleh dy.florist.", `${SITE_URL}/assets/undangan/og-undangan.jpg`, url) };
  }
  const names = [d.couple.groom.nickname, d.couple.bride.nickname].filter(Boolean).join(" & ");
  const title = `The Wedding of ${names}`;
  const desc3 = [d.dateLabel, guest ? `Kepada Yth. ${guest}` : "Kami mengundang Anda untuk hadir dan memberikan doa restu."].filter(Boolean).join(" \xB7 ");
  const photo = d.photos.cover || d.photos.couple;
  return { status: 200, html: page(title, desc3, photo ? absolute(photo) : `${SITE_URL}/assets/undangan/og-undangan.jpg`, url) };
}
function page(title, desc3, image, url) {
  return `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc3)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="dy.florist">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc3)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
</head><body><p><a href="${esc(url)}">${esc(title)}</a></p></body></html>`;
}

// server/app.ts
import { Elysia, t } from "elysia";
import { randomBytes as randomBytes3, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and as and3, asc, desc as desc2, eq as eq3, inArray as inArray2, ne, sql as sql3 } from "drizzle-orm";

// server/lib/password.ts
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
var N = 2 ** 15;
var KEYLEN = 64;
function derive(password, salt, n, r, p) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => err ? reject(err) : resolve(key));
  });
}
function describeHash(stored) {
  if (!stored) return "kosong/tidak diatur";
  const parts = stored.trim().split(/[:$]/);
  if (parts.length !== 6 || parts[0] !== "scrypt") return `format salah (${parts.length} bagian, harus 6)`;
  return "format benar";
}
async function verifyPassword(password, stored) {
  const parts = stored.trim().split(/[:$]/);
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await derive(password, Buffer.from(saltHex, "hex"), +n, +r, +p);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// server/lib/security.ts
import { createHash, randomBytes as randomBytes2 } from "node:crypto";
import { and as and2, eq as eq2, gt, lt, sql as sql2 } from "drizzle-orm";
var SESSION_COOKIE = "dyf_session";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var sha256 = (s) => createHash("sha256").update(s).digest("hex");
function hashIp(ip) {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_SECRET belum diatur (min 32 karakter)");
  return sha256(secret + ":" + ip);
}
function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}
async function createSession(role = "main") {
  const db = getDb();
  const token = randomBytes2(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema_exports.sessions).values({ tokenHash: sha256(token), expiresAt: expires, role });
  await db.delete(schema_exports.sessions).where(lt(schema_exports.sessions.expiresAt, /* @__PURE__ */ new Date()));
  return { token, expires };
}
async function sessionRole(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await getDb().select({ role: schema_exports.sessions.role }).from(schema_exports.sessions).where(and2(eq2(schema_exports.sessions.tokenHash, sha256(token)), gt(schema_exports.sessions.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
  if (!row) return null;
  return row.role === "undangan" ? "undangan" : "main";
}
async function destroySession(token) {
  if (!token) return;
  await getDb().delete(schema_exports.sessions).where(eq2(schema_exports.sessions.tokenHash, sha256(token)));
}
var LOGIN_WINDOW_MS = 15 * 60 * 1e3;
var LOGIN_MAX_PER_IP = 3;
var LOCK_MS = 5 * 60 * 1e3;
var LOGIN_MAX_GLOBAL = 100;
var LEVEL1_FORGET_MS = 24 * 60 * 60 * 1e3;
async function loginGate(ipHash) {
  const db = getDb();
  const [row] = await db.select().from(schema_exports.loginBlocks).where(eq2(schema_exports.loginBlocks.ipHash, ipHash)).limit(1);
  if (row?.level === 2) return { state: "blocked" };
  if (row?.level === 1 && row.lockedUntil) {
    const until = new Date(row.lockedUntil).getTime();
    if (until > Date.now()) return { state: "locked", retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1e3)) };
    if (until < Date.now() - LEVEL1_FORGET_MS) await db.delete(schema_exports.loginBlocks).where(eq2(schema_exports.loginBlocks.ipHash, ipHash));
  }
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [global] = await db.select({ n: sql2`count(*)`, first: sql2`min(created_at)` }).from(schema_exports.loginAttempts).where(gt(schema_exports.loginAttempts.createdAt, since));
  if (Number(global.n) >= LOGIN_MAX_GLOBAL) {
    const until = new Date(global.first).getTime() + LOGIN_WINDOW_MS;
    return { state: "locked", retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1e3)) };
  }
  return { state: "ok" };
}
async function registerFailedLogin(ipHash) {
  const db = getDb();
  await db.insert(schema_exports.loginAttempts).values({ ipHash });
  await db.delete(schema_exports.loginAttempts).where(lt(schema_exports.loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1e3)));
  const [row] = await db.select().from(schema_exports.loginBlocks).where(eq2(schema_exports.loginBlocks.ipHash, ipHash)).limit(1);
  if (row?.level === 1) {
    await db.update(schema_exports.loginBlocks).set({ level: 2, lockedUntil: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema_exports.loginBlocks.ipHash, ipHash));
    return { state: "blocked" };
  }
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [perIp] = await db.select({ n: sql2`count(*)` }).from(schema_exports.loginAttempts).where(and2(eq2(schema_exports.loginAttempts.ipHash, ipHash), gt(schema_exports.loginAttempts.createdAt, since)));
  const n = Number(perIp.n);
  if (n >= LOGIN_MAX_PER_IP) {
    const lockedUntil = new Date(Date.now() + LOCK_MS);
    await db.insert(schema_exports.loginBlocks).values({ ipHash, level: 1, lockedUntil }).onDuplicateKeyUpdate({ set: { level: 1, lockedUntil, updatedAt: /* @__PURE__ */ new Date() } });
    return { state: "locked", retryAfter: Math.ceil(LOCK_MS / 1e3) };
  }
  return { state: "wrong", remaining: LOGIN_MAX_PER_IP - n };
}
async function clearFailedLogins(ipHash) {
  const db = getDb();
  await db.delete(schema_exports.loginAttempts).where(eq2(schema_exports.loginAttempts.ipHash, ipHash));
  await db.delete(schema_exports.loginBlocks).where(eq2(schema_exports.loginBlocks.ipHash, ipHash));
}
var RECOVERY_TTL_MS = 24 * 60 * 60 * 1e3;
async function createRecoveryToken() {
  const token = randomBytes2(32).toString("hex");
  const db = getDb();
  await db.insert(schema_exports.recoveryTokens).values({ tokenHash: sha256(token), expiresAt: new Date(Date.now() + RECOVERY_TTL_MS) });
  await db.delete(schema_exports.recoveryTokens).where(lt(schema_exports.recoveryTokens.expiresAt, new Date(Date.now() - RECOVERY_TTL_MS)));
  return token;
}
async function useRecoveryToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const db = getDb();
  const hash = sha256(token);
  const [row] = await db.select().from(schema_exports.recoveryTokens).where(eq2(schema_exports.recoveryTokens.tokenHash, hash)).limit(1);
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) return false;
  await db.update(schema_exports.recoveryTokens).set({ usedAt: /* @__PURE__ */ new Date() }).where(eq2(schema_exports.recoveryTokens.tokenHash, hash));
  await db.delete(schema_exports.loginBlocks);
  await db.delete(schema_exports.loginAttempts);
  return true;
}
async function rateLimited(bucket, ipHash, max, windowMs) {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);
  const [row] = await db.select({ n: sql2`count(*)` }).from(schema_exports.rateEvents).where(and2(
    eq2(schema_exports.rateEvents.bucket, bucket),
    eq2(schema_exports.rateEvents.ipHash, ipHash),
    gt(schema_exports.rateEvents.createdAt, since)
  ));
  if (Number(row.n) >= max) return true;
  await db.insert(schema_exports.rateEvents).values({ bucket, ipHash });
  await db.delete(schema_exports.rateEvents).where(lt(schema_exports.rateEvents.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1e3)));
  return false;
}
function detectImageType(buf) {
  if (buf.length > 12) {
    if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return "jpg";
    if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) return "png";
    if (buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80) return "webp";
  }
  return null;
}
function isMp3(buf) {
  if (buf.length < 4) return false;
  if (buf[0] === 73 && buf[1] === 68 && buf[2] === 51) return true;
  return buf[0] === 255 && (buf[1] & 224) === 224 && (buf[1] & 6) !== 0;
}

// server/app.ts
var UNDANGAN_ADMIN_PATHS = /^\/api\/admin\/(session|logout|invitations(\/.*)?)$/;
var MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
var UPLOAD_DIR = join(process.cwd(), ".uploads");
var blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
var isProd = () => process.env.NODE_ENV === "production" || !!process.env.VERCEL;
var IMAGE_PATTERNS = [
  /^\/assets\/[\w.-]+$/,
  /^\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/,
  /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/products\/[\w.-]+$/
];
async function getCategoryName(key) {
  const [row] = await getDb().select({ name: schema_exports.categories.name }).from(schema_exports.categories).where(eq3(schema_exports.categories.key, key)).limit(1);
  return row?.name ?? null;
}
function slugify(name) {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return slug || "kategori";
}
var cleanText = (v) => v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
var isAllowedImage = (s) => IMAGE_PATTERNS.some((re) => re.test(s));
var normalizeOriginalPrice = (price, original) => original && original > price ? original : null;
var text2 = (min, max) => t.String({ minLength: min, maxLength: max });
var productBody = t.Object({
  name: text2(1, 120),
  category: t.String({ minLength: 1, maxLength: 30, pattern: "^[a-z0-9_]+$" }),
  price: t.Integer({ minimum: 0, maximum: 1e8 }),
  originalPrice: t.Optional(t.Union([t.Integer({ minimum: 0, maximum: 1e8 }), t.Null()])),
  // Link contoh undangan digital (hanya halaman undangan di situs ini); kosong = tidak ada
  demoUrl: t.Optional(t.Union([t.String({ maxLength: 70, pattern: "^(/undangan/[a-z0-9-]{1,60})?$" }), t.Null()])),
  badge: text2(0, 40),
  description: text2(1, 1e3),
  image: text2(1, 500)
});
function getCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return void 0;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return void 0;
}
function allowedOrigins() {
  const list = (process.env.ALLOWED_ORIGIN ?? "").split(",").map((s) => s.replace(/[^\x21-\x7e]/g, "").replace(/\/+$/, "")).filter(Boolean);
  if (process.env.VERCEL_ENV === "preview") {
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
      if (host) list.push(`https://${host}`);
    }
  }
  return list;
}
function csrfOk(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("x-requested-with") !== "dyflorist") return false;
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].replace(/[^\x21-\x7e]/g, "");
  const sameOrigin = !!origin && !!host && origin === `https://${host}`;
  const ok = !!origin && (sameOrigin || allowed.includes(origin));
  if (!ok) {
    console.error(
      `CSRF ditolak: origin="${origin ?? ""}" tidak ada di ALLOWED_ORIGIN (terdaftar: ${allowed.length}, panjang: [${allowed.map((a) => a.length).join(",")}], mentah: ${(process.env.ALLOWED_ORIGIN ?? "").length} karakter, env: ${process.env.VERCEL_ENV ?? "lokal"})`
    );
  }
  return ok;
}
function sessionCookie(value, expires) {
  const attrs = [`${SESSION_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict"];
  if (isProd()) attrs.push("Secure");
  if (expires) {
    attrs.push(`Expires=${expires.toUTCString()}`, `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`);
  } else {
    attrs.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Max-Age=0");
  }
  return attrs.join("; ");
}
async function storeImage(buf, ext, contentType, folder = "products") {
  const name = randomBytes3(16).toString("hex");
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${folder}/${name}.${ext}`, Buffer.from(buf), {
      access: "public",
      contentType,
      addRandomSuffix: false
    });
    return blob.url;
  }
  if (isProd()) throw new Error("Penyimpanan foto belum dikonfigurasi");
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, `${name}.${ext}`), buf);
  return `/api/uploads/${name}.${ext}`;
}
async function removeImage(url) {
  if (!url.includes(".public.blob.vercel-storage.com/") || !blobConfigured()) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch {
  }
}
var toPublic = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  categoryName: p.categoryName,
  price: p.price,
  originalPrice: p.originalPrice ?? null,
  demoUrl: p.demoUrl ?? null,
  badge: p.badge,
  description: p.description,
  image: p.image,
  rating: p.rating / 10,
  reviews: p.reviews
});
var BLOCKED_MSG = "Login dari perangkat ini diblokir karena password salah berulang kali. Link pemulihan sudah dikirim ke email dy.florist.";
var denied = (status, error) => new Response(JSON.stringify({ error }), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
var app = new Elysia({ prefix: "/api" }).onRequest(async ({ request }) => {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/admin")) return;
  if (!csrfOk(request)) return denied(403, "Permintaan ditolak");
  if (path === "/api/admin/login" || path === "/api/admin/recover") return;
  const role = await sessionRole(getCookie(request, SESSION_COOKIE));
  if (!role) return denied(401, "Belum login");
  if (role === "undangan" && !UNDANGAN_ADMIN_PATHS.test(path)) return denied(403, "Akun Admin Undangan hanya bisa membuka menu undangan digital");
}).onAfterHandle({ as: "global" }, ({ set }) => {
  set.headers["x-content-type-options"] = "nosniff";
  set.headers["x-frame-options"] = "DENY";
  set.headers["referrer-policy"] = "no-referrer";
  set.headers["cache-control"] ??= "no-store";
}).onError({ as: "global" }, ({ code, set, error }) => {
  set.headers["x-content-type-options"] = "nosniff";
  set.headers["cache-control"] = "no-store";
  if (code === "VALIDATION" || code === "PARSE") {
    set.status = 422;
    return { error: "Data tidak valid" };
  }
  if (code === "NOT_FOUND") {
    set.status = 404;
    return { error: "Tidak ditemukan" };
  }
  console.error("API error:", error instanceof Error ? error.message : error);
  set.status = 500;
  return { error: "Terjadi kesalahan server" };
}).get("/health", () => ({ ok: true })).get("/products", async () => {
  const rows = await getDb().select().from(schema_exports.products).orderBy(desc2(schema_exports.products.createdAt), desc2(schema_exports.products.id));
  return rows.map(toPublic);
}).get("/categories", async () => {
  const rows = await getDb().select().from(schema_exports.categories).orderBy(asc(schema_exports.categories.sort), asc(schema_exports.categories.key));
  return rows.map((c) => ({ key: c.key, name: c.name, emoji: c.emoji }));
}).get("/share/:id", async ({ params }) => {
  const html = (body, status = 200) => new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff"
    }
  });
  const id = params.id;
  const [p] = /^[\w-]{1,40}$/.test(id) ? await getDb().select().from(schema_exports.products).where(eq3(schema_exports.products.id, id)).limit(1) : [];
  if (!p) {
    return html('<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/katalog"><title>dy.florist</title></head><body><a href="/katalog">Lihat katalog dy.florist</a></body></html>', 404);
  }
  const e = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const image = p.image.startsWith("/") ? SITE_URL + p.image : p.image;
  const price = "Rp " + p.price.toLocaleString("id-ID");
  const target = `/katalog?produk=${encodeURIComponent(p.id)}`;
  const title = `${p.name} \u2014 ${price}`;
  return html(`<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8">
<title>${e(title)} | dy.florist</title>
<meta name="description" content="${e(p.description.slice(0, 200))}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="dy.florist">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(p.description.slice(0, 200))}">
<meta property="og:image" content="${e(image)}">
<meta property="og:url" content="${e(SITE_URL + "/produk/" + p.id)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${e(SITE_URL + target)}">
<meta http-equiv="refresh" content="0; url=${e(target)}">
</head><body><p><a href="${e(target)}">${e(p.name)}</a></p></body></html>`);
}).get("/invitations/:slug", async ({ params, request, set }) => {
  if (params.slug === "demo") {
    set.headers["cache-control"] = "public, max-age=60";
    return demoInvitation();
  }
  const row = /^[a-z0-9-]{3,60}$/.test(params.slug) ? await findInvitationBySlug(params.slug) : void 0;
  if (row?.status === "arsip") {
    set.status = 410;
    return { error: "Undangan ini sudah tidak aktif." };
  }
  const preview = row?.status === "draft" && !!await sessionRole(getCookie(request, SESSION_COOKIE));
  if (!row || row.status !== "terbit" && !preview) {
    set.status = 404;
    return { error: "Undangan tidak ditemukan" };
  }
  set.headers["cache-control"] = "no-store";
  return publicInvitation(row, preview);
}).post("/invitations/:slug/wishes", async ({ params, body, request, set }) => {
  if (request.headers.get("x-requested-with") !== "dyflorist") {
    set.status = 403;
    return { error: "Permintaan ditolak" };
  }
  const row = /^[a-z0-9-]{3,60}$/.test(params.slug) ? await findInvitationBySlug(params.slug) : void 0;
  if (!row || row.status !== "terbit") {
    set.status = 404;
    return { error: "Undangan tidak ditemukan" };
  }
  const d = parseStoredData(row.data);
  if (!d.wishes.enabled && !d.rsvp.enabled) {
    set.status = 403;
    return { error: "Ucapan untuk undangan ini ditutup" };
  }
  const ipHash = hashIp(clientIp(request));
  if (await rateLimited(`wish:${row.id}`, ipHash, 5, 10 * 60 * 1e3)) {
    set.status = 429;
    return { error: "Terlalu banyak ucapan dalam waktu singkat. Coba lagi nanti." };
  }
  if (await rateLimited(`wish-all:${row.id}`, "all", 300, 60 * 60 * 1e3)) {
    set.status = 429;
    return { error: "Sedang banyak ucapan masuk. Coba lagi beberapa menit lagi." };
  }
  const clean = (s, max) => s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
  const name = clean(body.name, 60).replace(/\n/g, " ");
  const message = clean(body.message, 300);
  const attendance = d.rsvp.enabled && body.attendance ? body.attendance : null;
  if (!name || !message) {
    set.status = 422;
    return { error: "Nama dan ucapan wajib diisi" };
  }
  if (d.rsvp.enabled && !attendance) {
    set.status = 422;
    return { error: "Mohon pilih konfirmasi kehadiran" };
  }
  const guests = attendance === "hadir" ? Math.min(d.rsvp.maxGuests, Math.max(1, body.guests ?? 1)) : 0;
  const status = d.wishes.requireApproval ? "menunggu" : "tampil";
  const [res] = await getDb().insert(schema_exports.invitationWishes).values({
    invitationId: row.id,
    name,
    message,
    attendance,
    guests,
    status,
    ipHash
  });
  return {
    ok: true,
    status,
    item: publicWish({ id: Number(res.insertId), invitationId: row.id, name, message, attendance, guests, status, ipHash, createdAt: /* @__PURE__ */ new Date() })
  };
}, {
  body: t.Object({
    name: text2(1, 60),
    message: text2(1, 300),
    attendance: t.Optional(t.Union([...ATTENDANCE.map((a) => t.Literal(a)), t.Null()])),
    guests: t.Optional(t.Integer({ minimum: 1, maximum: 10 }))
  })
}).get("/invitation-share/:slug", async ({ params, query }) => {
  const guest = typeof query.to === "string" ? query.to.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "";
  const { status, html } = await invitationShareHtml(params.slug.toLowerCase(), guest);
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" }
  });
}).get("/bespoke-prices", async () => {
  const rows = await getDb().select().from(schema_exports.bespokePrices).orderBy(asc(schema_exports.bespokePrices.sort));
  return rows.map((r) => ({ key: r.key, kind: r.kind, label: r.label, price: r.price }));
}).get("/uploads/:name", async ({ params, set }) => {
  if (isProd() || !/^[a-f0-9]{32}\.(jpg|png|webp|mp3)$/.test(params.name)) {
    set.status = 404;
    return { error: "Tidak ditemukan" };
  }
  try {
    const data = await readFile(join(UPLOAD_DIR, params.name));
    const ext = params.name.split(".")[1];
    set.headers["content-type"] = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "mp3" ? "audio/mpeg" : "image/jpeg";
    set.headers["cache-control"] = "public, max-age=31536000, immutable";
    return new Response(data, { headers: set.headers });
  } catch {
    set.status = 404;
    return { error: "Tidak ditemukan" };
  }
}).post("/orders", async ({ body, request, set }) => {
  const ipHash = hashIp(clientIp(request));
  if (await rateLimited("order", ipHash, 5, 10 * 60 * 1e3)) {
    set.status = 429;
    set.headers["retry-after"] = "600";
    return { error: "Terlalu banyak pesanan. Coba lagi nanti." };
  }
  if (await rateLimited("order-global", "all", 200, 60 * 60 * 1e3)) {
    set.status = 429;
    set.headers["retry-after"] = "600";
    return { error: "Layanan sedang sibuk. Silakan hubungi kami lewat WhatsApp." };
  }
  const db = getDb();
  const ids = [...new Set(body.items.map((i) => i.id))];
  const found = await db.select().from(schema_exports.products).where(inArray2(schema_exports.products.id, ids));
  if (found.length !== ids.length) {
    set.status = 400;
    return { error: "Ada produk yang tidak tersedia" };
  }
  const byId = new Map(found.map((p) => [p.id, p]));
  const lines = body.items.map((i) => {
    const p = byId.get(i.id);
    return { productId: p.id, name: p.name, price: p.price, qty: i.qty };
  });
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const orderId = await db.transaction(async (tx) => {
    const [res] = await tx.insert(schema_exports.orders).values({
      recipient: body.recipient,
      scheduled: body.scheduled,
      note: body.note,
      total
    });
    const id = Number(res.insertId);
    await tx.insert(schema_exports.orderItems).values(lines.map((l) => ({ ...l, orderId: id })));
    return id;
  });
  return { id: orderId, total };
}, {
  body: t.Object({
    recipient: text2(1, 120),
    scheduled: text2(1, 120),
    note: text2(0, 500),
    items: t.Array(
      t.Object({ id: text2(1, 40), qty: t.Integer({ minimum: 1, maximum: 50 }) }),
      { minItems: 1, maxItems: 30 }
    )
  })
}).post("/admin/login", async ({ body, request, set }) => {
  const ip = clientIp(request);
  const ipHash = hashIp(ip);
  const gate = await loginGate(ipHash);
  if (gate.state === "blocked") {
    set.status = 403;
    return { error: BLOCKED_MSG, blocked: true };
  }
  if (gate.state === "locked") {
    set.status = 429;
    set.headers["retry-after"] = String(gate.retryAfter);
    return { error: `Login dikunci. Coba lagi dalam ${Math.ceil(gate.retryAfter / 60)} menit.` };
  }
  const stored = process.env.ADMIN_PASSWORD_HASH ?? "";
  const storedUndangan = process.env.INVITATION_ADMIN_PASSWORD_HASH ?? "";
  let role = null;
  if (stored && await verifyPassword(body.password, stored)) role = "main";
  else if (storedUndangan && await verifyPassword(body.password, storedUndangan)) role = "undangan";
  if (!role) {
    if (describeHash(stored) !== "format benar") {
      console.error("Login admin gagal: ADMIN_PASSWORD_HASH " + describeHash(stored));
    }
    const fail = await registerFailedLogin(ipHash);
    if (fail.state === "blocked") {
      if (!await rateLimited("recovery_email", "global", 3, 60 * 60 * 1e3)) {
        const token2 = await createRecoveryToken();
        await sendBlockedAlert({ token: token2, ip, userAgent: request.headers.get("user-agent") ?? "-" });
      }
      set.status = 403;
      return { error: BLOCKED_MSG, blocked: true };
    }
    if (fail.state === "locked") {
      set.status = 429;
      set.headers["retry-after"] = String(fail.retryAfter);
      return { error: `3x password salah. Login dikunci ${LOCK_MS / 6e4} menit.` };
    }
    set.status = 401;
    return { error: `Password salah. Sisa ${fail.remaining} percobaan sebelum dikunci ${LOCK_MS / 6e4} menit.` };
  }
  await clearFailedLogins(ipHash);
  const { token, expires } = await createSession(role);
  set.headers["set-cookie"] = sessionCookie(token, expires);
  return { ok: true, role };
}, { body: t.Object({ password: text2(1, 200) }) }).post("/admin/recover", async ({ body, request, set }) => {
  const ipHash = hashIp(clientIp(request));
  if (await rateLimited("recover", ipHash, 10, 15 * 60 * 1e3)) {
    set.status = 429;
    return { error: "Terlalu banyak percobaan. Coba lagi nanti." };
  }
  if (!await useRecoveryToken(body.token)) {
    set.status = 400;
    return { error: "Link pemulihan tidak valid, sudah dipakai, atau kedaluwarsa." };
  }
  return { ok: true };
}, { body: t.Object({ token: text2(1, 100) }) }).group(
  "/admin",
  (admin) => admin.get("/session", async ({ request }) => ({ ok: true, role: await sessionRole(getCookie(request, SESSION_COOKIE)) })).post("/logout", async ({ request, set }) => {
    await destroySession(getCookie(request, SESSION_COOKIE));
    set.headers["set-cookie"] = sessionCookie("", null);
    return { ok: true };
  }).post("/categories", async ({ body, set }) => {
    const db = getDb();
    const name = cleanText(body.name);
    const emoji = cleanText(body.emoji);
    if (!name) {
      set.status = 422;
      return { error: "Nama kategori wajib diisi" };
    }
    const all = await db.select().from(schema_exports.categories);
    if (all.length >= 30) {
      set.status = 409;
      return { error: "Jumlah kategori sudah mencapai batas (30)" };
    }
    if (all.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      set.status = 409;
      return { error: "Nama kategori sudah ada" };
    }
    const base = slugify(name);
    let key = base;
    for (let i = 2; all.some((c) => c.key === key); i++) key = `${base.slice(0, 26)}_${i}`;
    const sort = all.reduce((m, c) => Math.max(m, c.sort), 0) + 1;
    await db.insert(schema_exports.categories).values({ key, name, emoji, sort });
    return { key };
  }, { body: t.Object({ name: text2(1, 40), emoji: text2(0, 16) }) }).put("/categories/:key", async ({ params, body, set }) => {
    const db = getDb();
    const name = cleanText(body.name);
    const emoji = cleanText(body.emoji);
    if (!name) {
      set.status = 422;
      return { error: "Nama kategori wajib diisi" };
    }
    const [row] = await db.select().from(schema_exports.categories).where(eq3(schema_exports.categories.key, params.key)).limit(1);
    if (!row) {
      set.status = 404;
      return { error: "Kategori tidak ditemukan" };
    }
    const dupe = await db.select({ key: schema_exports.categories.key }).from(schema_exports.categories).where(and3(sql3`lower(${schema_exports.categories.name}) = ${name.toLowerCase()}`, ne(schema_exports.categories.key, params.key)));
    if (dupe.length > 0) {
      set.status = 409;
      return { error: "Nama kategori sudah ada" };
    }
    await db.update(schema_exports.categories).set({ name, emoji }).where(eq3(schema_exports.categories.key, params.key));
    await db.update(schema_exports.products).set({ categoryName: name }).where(eq3(schema_exports.products.category, params.key));
    return { ok: true };
  }, { body: t.Object({ name: text2(1, 40), emoji: text2(0, 16) }) }).delete("/categories/:key", async ({ params, set }) => {
    const db = getDb();
    const [row] = await db.select().from(schema_exports.categories).where(eq3(schema_exports.categories.key, params.key)).limit(1);
    if (!row) {
      set.status = 404;
      return { error: "Kategori tidak ditemukan" };
    }
    const [used] = await db.select({ n: sql3`count(*)` }).from(schema_exports.products).where(eq3(schema_exports.products.category, params.key));
    if (Number(used.n) > 0) {
      set.status = 409;
      return { error: `Masih ada ${Number(used.n)} produk di kategori ini. Pindahkan atau hapus produknya dulu.` };
    }
    await db.delete(schema_exports.categories).where(eq3(schema_exports.categories.key, params.key));
    return { ok: true };
  }).post("/products", async ({ body, set }) => {
    if (!isAllowedImage(body.image)) {
      set.status = 422;
      return { error: "Foto tidak valid" };
    }
    const categoryName = await getCategoryName(body.category);
    if (!categoryName) {
      set.status = 422;
      return { error: "Kategori tidak ditemukan" };
    }
    const id = "prod_" + randomUUID().replace(/-/g, "").slice(0, 16);
    await getDb().insert(schema_exports.products).values({
      id,
      ...body,
      originalPrice: normalizeOriginalPrice(body.price, body.originalPrice),
      demoUrl: body.demoUrl || null,
      categoryName,
      rating: 50,
      reviews: 1,
      badge: body.badge || "New Arrival"
    });
    return { id };
  }, { body: productBody }).put("/products/:id", async ({ params, body, set }) => {
    if (!isAllowedImage(body.image)) {
      set.status = 422;
      return { error: "Foto tidak valid" };
    }
    const db = getDb();
    const [old] = await db.select().from(schema_exports.products).where(eq3(schema_exports.products.id, params.id)).limit(1);
    if (!old) {
      set.status = 404;
      return { error: "Produk tidak ditemukan" };
    }
    const categoryName = await getCategoryName(body.category);
    if (!categoryName) {
      set.status = 422;
      return { error: "Kategori tidak ditemukan" };
    }
    await db.update(schema_exports.products).set({ ...body, originalPrice: normalizeOriginalPrice(body.price, body.originalPrice), demoUrl: body.demoUrl || null, categoryName }).where(eq3(schema_exports.products.id, params.id));
    if (old.image !== body.image) await removeImage(old.image);
    return { ok: true };
  }, { body: productBody }).delete("/products/:id", async ({ params, set }) => {
    const db = getDb();
    const [old] = await db.select().from(schema_exports.products).where(eq3(schema_exports.products.id, params.id)).limit(1);
    if (!old) {
      set.status = 404;
      return { error: "Produk tidak ditemukan" };
    }
    await db.delete(schema_exports.products).where(eq3(schema_exports.products.id, params.id));
    await removeImage(old.image);
    return { ok: true };
  }).post("/upload", async ({ body, set }) => {
    const file = body.file;
    if (file.size > MAX_UPLOAD_BYTES) {
      set.status = 413;
      return { error: "Foto terlalu besar (maks 4 MB)" };
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(buf);
    if (!type) {
      set.status = 415;
      return { error: "Hanya JPG, PNG, atau WebP" };
    }
    const contentType = type === "png" ? "image/png" : type === "webp" ? "image/webp" : "image/jpeg";
    return { url: await storeImage(buf, type, contentType) };
  }, { body: t.Object({ file: t.File() }) }).put("/bespoke-prices", async ({ body, set }) => {
    const db = getDb();
    const rows = await db.select().from(schema_exports.bespokePrices);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const item of body.items) {
      const row = byKey.get(item.key);
      if (!row) {
        set.status = 422;
        return { error: "Data harga tidak dikenal" };
      }
      if (row.kind === "addon" && item.price === null) {
        set.status = 422;
        return { error: `Harga ${row.label} wajib diisi` };
      }
    }
    for (const item of body.items) {
      await db.update(schema_exports.bespokePrices).set({ price: item.price }).where(eq3(schema_exports.bespokePrices.key, item.key));
    }
    return { ok: true };
  }, {
    body: t.Object({
      items: t.Array(t.Object({
        key: t.String({ minLength: 1, maxLength: 40, pattern: "^[a-z0-9_]+$" }),
        price: t.Union([t.Integer({ minimum: 0, maximum: 1e8 }), t.Null()])
      }), { minItems: 1, maxItems: 50 })
    })
  }).get("/invitations", async () => {
    const db = getDb();
    const rows = await db.select().from(schema_exports.invitations).orderBy(desc2(schema_exports.invitations.updatedAt)).limit(500);
    const counts = rows.length ? await db.select({
      id: schema_exports.invitationWishes.invitationId,
      n: sql3`count(*)`,
      waiting: sql3`sum(case when ${schema_exports.invitationWishes.status} = 'menunggu' then 1 else 0 end)`
    }).from(schema_exports.invitationWishes).where(inArray2(schema_exports.invitationWishes.invitationId, rows.map((r) => r.id))).groupBy(schema_exports.invitationWishes.invitationId) : [];
    const byId = new Map(counts.map((c) => [c.id, c]));
    return rows.map((r) => {
      const d = parseStoredData(r.data);
      const c = byId.get(r.id);
      return {
        id: r.id,
        slug: r.slug,
        status: r.status,
        template: r.template,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        groom: d.couple.groom.nickname,
        bride: d.couple.bride.nickname,
        dateLabel: d.dateLabel,
        firstEvent: d.events.find((e) => e.startIso)?.startIso ?? "",
        wishes: Number(c?.n ?? 0),
        waiting: Number(c?.waiting ?? 0),
        updatedAt: r.updatedAt,
        publishedAt: r.publishedAt
      };
    });
  }).post("/invitations", async ({ body, set }) => {
    const slug = body.slug.trim().toLowerCase();
    if (!isValidSlug(slug)) {
      set.status = 422;
      return { error: "Alamat undangan hanya boleh huruf kecil, angka, dan strip (3\u201360 karakter)" };
    }
    if (await findInvitationBySlug(slug)) {
      set.status = 409;
      return { error: "Alamat undangan sudah dipakai. Pilih alamat lain." };
    }
    const data = newInvitationData();
    data.couple.groom.nickname = cleanText(body.groom ?? "").slice(0, 40);
    data.couple.bride.nickname = cleanText(body.bride ?? "").slice(0, 40);
    const [res] = await getDb().insert(schema_exports.invitations).values({
      slug,
      status: "draft",
      template: "jawa-elegan",
      customerName: cleanText(body.customerName),
      customerPhone: cleanText(body.customerPhone),
      note: cleanText(body.note ?? ""),
      data: JSON.stringify(data)
    });
    return { id: Number(res.insertId), slug };
  }, {
    body: t.Object({
      slug: text2(3, 60),
      customerName: text2(0, 120),
      customerPhone: text2(0, 30),
      note: t.Optional(text2(0, 500)),
      groom: t.Optional(text2(0, 40)),
      bride: t.Optional(text2(0, 40))
    })
  }).get("/invitations/:id", async ({ params, set }) => {
    const row = await findInvitationById(Number(params.id));
    if (!row) {
      set.status = 404;
      return { error: "Undangan tidak ditemukan" };
    }
    const data = parseStoredData(row.data);
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      template: row.template,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      note: row.note,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
      data,
      problems: publishProblems(data),
      stats: await attendanceStats(row.id)
    };
  }, { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) }).put("/invitations/:id", async ({ params, body, set }) => {
    const db = getDb();
    const row = await findInvitationById(Number(params.id));
    if (!row) {
      set.status = 404;
      return { error: "Undangan tidak ditemukan" };
    }
    const slug = body.slug.trim().toLowerCase();
    if (slug !== row.slug) {
      if (!isValidSlug(slug)) {
        set.status = 422;
        return { error: "Alamat undangan hanya boleh huruf kecil, angka, dan strip (3\u201360 karakter)" };
      }
      if (await findInvitationBySlug(slug)) {
        set.status = 409;
        return { error: "Alamat undangan sudah dipakai. Pilih alamat lain." };
      }
    }
    const data = normalizeInvitationData(body.data);
    if (row.status === "terbit") {
      const problems = publishProblems(data);
      if (problems.length) {
        set.status = 422;
        return { error: `Undangan sudah terbit, data wajib tidak boleh kosong: ${problems.join("; ")}` };
      }
    }
    const json = JSON.stringify(data);
    if (json.length > 2e5) {
      set.status = 413;
      return { error: "Isi undangan terlalu panjang" };
    }
    const before = mediaUrls(parseStoredData(row.data));
    const after = new Set(mediaUrls(data));
    await db.update(schema_exports.invitations).set({
      slug,
      data: json,
      updatedAt: /* @__PURE__ */ new Date(),
      customerName: cleanText(body.customerName),
      customerPhone: cleanText(body.customerPhone),
      note: cleanText(body.note)
    }).where(eq3(schema_exports.invitations.id, row.id));
    for (const url of before) if (!after.has(url)) await removeImage(url);
    return { ok: true, slug, data, problems: publishProblems(data) };
  }, {
    params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
    body: t.Object({
      slug: text2(3, 60),
      customerName: text2(0, 120),
      customerPhone: text2(0, 30),
      note: text2(0, 500),
      data: t.Record(t.String(), t.Unknown())
    })
  }).post("/invitations/:id/status", async ({ params, body, set }) => {
    const row = await findInvitationById(Number(params.id));
    if (!row) {
      set.status = 404;
      return { error: "Undangan tidak ditemukan" };
    }
    if (body.status === "terbit") {
      const problems = publishProblems(parseStoredData(row.data));
      if (problems.length) {
        set.status = 422;
        return { error: `Belum bisa diterbitkan: ${problems.join("; ")}` };
      }
    }
    await getDb().update(schema_exports.invitations).set({
      status: body.status,
      updatedAt: /* @__PURE__ */ new Date(),
      publishedAt: body.status === "terbit" ? row.publishedAt ?? /* @__PURE__ */ new Date() : row.publishedAt
    }).where(eq3(schema_exports.invitations.id, row.id));
    return { ok: true, status: body.status };
  }, {
    params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
    body: t.Object({ status: t.Union(INVITATION_STATUSES.map((s) => t.Literal(s))) })
  }).delete("/invitations/:id", async ({ params, set }) => {
    const db = getDb();
    const row = await findInvitationById(Number(params.id));
    if (!row) {
      set.status = 404;
      return { error: "Undangan tidak ditemukan" };
    }
    if (row.status === "terbit") {
      set.status = 409;
      return { error: "Undangan yang sedang terbit tidak bisa dihapus. Arsipkan dulu." };
    }
    await db.delete(schema_exports.invitationWishes).where(eq3(schema_exports.invitationWishes.invitationId, row.id));
    await db.delete(schema_exports.invitations).where(eq3(schema_exports.invitations.id, row.id));
    for (const url of mediaUrls(parseStoredData(row.data))) await removeImage(url);
    return { ok: true };
  }, { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) }).post("/invitations/upload", async ({ body, set }) => {
    const file = body.file;
    if (file.size > MAX_UPLOAD_BYTES) {
      set.status = 413;
      return { error: "Berkas terlalu besar (maks 4 MB)" };
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(buf);
    if (type) {
      const contentType = type === "png" ? "image/png" : type === "webp" ? "image/webp" : "image/jpeg";
      return { url: await storeImage(buf, type, contentType, "invitations"), kind: "image" };
    }
    if (isMp3(buf)) return { url: await storeImage(buf, "mp3", "audio/mpeg", "invitations"), kind: "audio" };
    set.status = 415;
    return { error: "Hanya foto JPG, PNG, WebP, atau musik MP3" };
  }, { body: t.Object({ file: t.File() }) }).get("/invitations/:id/wishes", async ({ params }) => {
    const rows = await getDb().select().from(schema_exports.invitationWishes).where(eq3(schema_exports.invitationWishes.invitationId, Number(params.id))).orderBy(desc2(schema_exports.invitationWishes.createdAt), desc2(schema_exports.invitationWishes.id)).limit(2e3);
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      message: w.message,
      attendance: w.attendance,
      guests: w.guests,
      status: w.status,
      createdAt: w.createdAt
    }));
  }, { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) }).patch("/invitations/:id/wishes/:wid", async ({ params, body }) => {
    await getDb().update(schema_exports.invitationWishes).set({ status: body.status }).where(and3(eq3(schema_exports.invitationWishes.id, Number(params.wid)), eq3(schema_exports.invitationWishes.invitationId, Number(params.id))));
    return { ok: true };
  }, {
    params: t.Object({ id: t.Numeric({ minimum: 1 }), wid: t.Numeric({ minimum: 1 }) }),
    body: t.Object({ status: t.Union([t.Literal("tampil"), t.Literal("sembunyi")]) })
  }).delete("/invitations/:id/wishes/:wid", async ({ params }) => {
    await getDb().delete(schema_exports.invitationWishes).where(and3(eq3(schema_exports.invitationWishes.id, Number(params.wid)), eq3(schema_exports.invitationWishes.invitationId, Number(params.id))));
    return { ok: true };
  }, { params: t.Object({ id: t.Numeric({ minimum: 1 }), wid: t.Numeric({ minimum: 1 }) }) }).get("/orders", async () => {
    const db = getDb();
    const orders2 = await db.select().from(schema_exports.orders).orderBy(desc2(schema_exports.orders.createdAt)).limit(500);
    const items = orders2.length ? await db.select().from(schema_exports.orderItems).where(inArray2(schema_exports.orderItems.orderId, orders2.map((o) => o.id))) : [];
    return orders2.map((o) => ({
      id: o.id,
      recipient: o.recipient,
      scheduled: o.scheduled,
      note: o.note,
      total: o.total,
      createdAt: o.createdAt,
      items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.name, qty: i.qty, price: i.price }))
    }));
  }).delete("/orders", async () => {
    const db = getDb();
    await db.delete(schema_exports.orderItems);
    await db.delete(schema_exports.orders);
    return { ok: true };
  })
);
var app_default = app;

// server/handler.ts
var handler_default = {
  fetch: (request) => {
    const url = new URL(request.url);
    const forward = (path) => app_default.fetch(new Request(`${url.origin}${path}`, { method: request.method, headers: request.headers }));
    const product = /^\/produk\/([\w-]{1,40})\/?$/.exec(url.pathname);
    if (product) return forward(`/api/share/${product[1]}`);
    const invitation = /^\/undangan\/([a-z0-9-]{1,60})\/?$/i.exec(url.pathname);
    if (invitation) return forward(`/api/invitation-share/${invitation[1]}${url.search}`);
    return app_default.fetch(request);
  }
};
export {
  handler_default as default
};
