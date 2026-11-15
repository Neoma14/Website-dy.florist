/**
 * Undangan Digital dy.florist: template "Jawa Elegan".
 * Data diambil dari /api/invitations/<slug>. Semua teks dari data ditulis lewat textContent (tanpa innerHTML),
 * sehingga isi undangan tidak bisa menyisipkan kode.
 *
 * Alur halaman: sampul foto → pembuka → kartu ayat → mempelai → save the date + acara → kisah cinta
 * → amplop digital → ucapan & kehadiran → penutup foto → galeri → tanda tangan.
 */

const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const SAFE_MEDIA = /^(\/assets\/[\w./-]+|\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|mp3)|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[\w./-]+)$/;
const SAFE_MAPS = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\//;
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;

const A = '/assets/undangan/foto/';
const IMG = {
  bouquet: `${A}bunga-krem.webp`,
  rose: `${A}mawar-putih.webp`,
  gunungan: `${A}gunungan-emas.webp`,
};

const ICON = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  couple: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s-7-4.4-9.2-9A5 5 0 0112 6a5 5 0 019.2 6c-2.2 4.6-9.2 9-9.2 9z"/></svg>',
  calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  gallery: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  gift: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 9v12M12 9S10.5 4 8 4.5 7 9 12 9zM12 9s1.5-5 4-4.5S17 9 12 9z"/></svg>',
  giftLg: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 9v12M12 9S10.5 4 8 4.5 7 9 12 9zM12 9s1.5-5 4-4.5S17 9 12 9z"/></svg>',
  chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1.1-4.6A8 8 0 1121 12z"/></svg>',
  pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  pinLg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 00-7 7c0 5.3 6.2 11.9 6.5 12.2a.7.7 0 001 0C12.8 20.9 19 14.3 19 9a7 7 0 00-7-7zm0 9.6A2.6 2.6 0 1112 6.4a2.6 2.6 0 010 5.2z"/></svg>',
  cal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
  ig: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>',
};

// ---------- Utilitas DOM aman ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; // hanya untuk ikon konstan di atas
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const safeMedia = (u) => (typeof u === 'string' && SAFE_MEDIA.test(u) ? u : '');
const str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const deco = (src, cls) => h('img', { src, alt: '', class: cls, 'aria-hidden': 'true' });

function toast(msg) {
  const t = document.getElementById('invToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Latar foto: hanya alamat yang lolos SAFE_MEDIA (tanpa tanda kutip) yang dipasang
function photoBg(el, src) {
  if (src) el.style.backgroundImage = `url("${src}")`;
  return el;
}

function ornament(src, cls) {
  return h('img', { src: `/assets/undangan/${src}`, alt: '', class: `orn ${cls}`, 'aria-hidden': 'true' });
}

// Bingkai emas: ornamen atas dan bawah mengapit judul (bukan dipasang sebagai garis pemisah)
function titleFrame(content, cls = '') {
  const piece = (pos) => h('img', { src: `${A}bingkai-${pos}.webp`, alt: '', class: `frame-${pos}`, 'aria-hidden': 'true' });
  return h('div', { class: `title-frame ${cls}`.trim() }, piece('atas'), content, piece('bawah'));
}
const scriptTitle = (text, tag = 'h2') => h(tag, { class: 'script-title', text });

// Bagian berbentuk kartu yang "mengapung" di atas latar motif, dengan bunga di sudut
function cardSection({ id, cls = '' }, ...children) {
  return h('section', { class: `inv-section card-wrap kawung ${cls}`.trim(), id },
    ornament('foto/bunga-krem.webp', 'orn-tl'),
    ornament('foto/mawar-putih.webp', 'orn-br'),
    h('div', { class: 'inv-card' }, ...children));
}

function initials(d) {
  const g = str(d.couple?.groom?.nickname, 40).trim().charAt(0).toUpperCase() || 'A';
  const b = str(d.couple?.bride?.nickname, 40).trim().charAt(0).toUpperCase() || 'B';
  return [g, b];
}

// Bingkai lengkung berisi foto, atau monogram inisial di atas foto pendopo bila foto kosong
function archFrame(photo, letters, cls = '') {
  const inner = h('div', { class: 'arch-inner' });
  const src = safeMedia(photo);
  if (src) {
    inner.append(h('img', { src, alt: '', class: 'photo', loading: 'lazy' }));
  } else {
    inner.classList.add('no-photo');
    const mono = h('div', { class: 'monogram', 'aria-hidden': 'true' });
    if (letters.length === 2) mono.append(letters[0], h('span', { class: 'amp', text: '&' }), letters[1]);
    else mono.append(letters[0]);
    inner.append(mono);
  }
  return h('div', { class: `arch ${cls}` }, inner);
}

// Bingkai oval mempelai dengan bunga di dua sudut
function pillFrame(photo, letter) {
  const inner = h('div', { class: 'pill-inner' });
  const src = safeMedia(photo);
  if (src) inner.append(h('img', { src, alt: '', class: 'photo', loading: 'lazy' }));
  else {
    inner.classList.add('no-photo');
    inner.append(h('span', { class: 'monogram', 'aria-hidden': 'true', text: letter }));
  }
  return h('div', { class: 'pill-wrap' },
    h('div', { class: 'pill' }, inner),
    deco(IMG.rose, 'pill-flower pf-tr'),
    deco(IMG.bouquet, 'pill-flower pf-bl'));
}

function namesLine(d, cls) {
  return h(cls === 'cover' ? 'h1' : 'h2', { class: cls === 'cover' ? 'cover-names' : cls },
    str(d.couple?.groom?.nickname, 40), h('span', { class: 'amp', text: '&' }), str(d.couple?.bride?.nickname, 40));
}

function calendarUrl(ev, d) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = Date.parse(ev.startIso);
  if (Number.isNaN(start)) return '';
  const end = Date.parse(ev.endIso) || start + 2 * 3600 * 1000;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${ev.title} ${d.couple.groom.nickname} & ${d.couple.bride.nickname}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: 'Undangan pernikahan',
    location: [ev.venueName, ev.address].filter(Boolean).join(', '),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function firstEventTime(d) {
  return (d.events || []).map((e) => Date.parse(e.startIso)).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b)[0];
}

function timeAgo(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} hari lalu`;
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

// ---------- Bagian-bagian undangan ----------

// Pembuka: foto pendopo (atau foto sampul mempelai) memudar ke ivory, nama di bawahnya
function renderIntro(d) {
  return h('section', { class: 'inv-section intro', id: 'beranda' },
    photoBg(h('div', { class: 'intro-bg', 'aria-hidden': 'true' }), safeMedia(d.photos?.cover)),
    h('div', { class: 'intro-content' },
      deco(IMG.gunungan, 'intro-gunungan jawa-only reveal'),
      h('p', { class: 'script-eyebrow reveal', text: 'The Wedding of' }),
      h('div', { class: 'reveal' }, namesLine(d, 'intro-names')),
      h('p', { class: 'intro-date reveal', text: str(d.dateLabel, 60) }),
      d.heroLine ? h('p', { class: 'hero-line reveal', text: str(d.heroLine, 200) }) : null,
      h('span', { class: 'scroll-hint', 'aria-hidden': 'true', html: ICON.down }),
    ),
  );
}

// Kartu ayat: foto/monogram + inisial + kutipan
function renderQuote(d, letters) {
  const q = d.greeting?.quote || {};
  const photo = safeMedia(d.photos?.couple) || safeMedia(d.photos?.cover);
  return cardSection({ cls: 'quote' },
    photo
      ? h('div', { class: 'card-photo reveal' }, h('img', { src: photo, alt: 'Foto kedua mempelai', loading: 'lazy' }))
      : h('div', { class: 'reveal' }, archFrame('', letters)),
    // Inisial hanya di bawah foto; tanpa foto, monogram di lengkung sudah menampilkannya
    photo ? h('p', { class: 'initials reveal', 'aria-hidden': 'true' }, letters[0], h('span', { class: 'amp', text: '&' }), letters[1]) : null,
    q.arabic ? h('p', { class: 'quote-arabic reveal', lang: 'ar', text: str(q.arabic, 600) }) : null,
    q.text ? h('p', { class: 'quote-text reveal', text: `“${str(q.text, 600)}”` }) : null,
    q.source ? h('p', { class: 'quote-src reveal', text: str(q.source, 60) }) : null,
  );
}

function person(p, letter, d) {
  const ig = str(p.instagram, 40).replace(/^@/, '');
  const igBtn = IG_RE.test(ig)
    ? h('a', {
      class: 'btn-navy btn-sm',
      href: d.isDemo ? '#' : `https://www.instagram.com/${ig}/`,
      target: d.isDemo ? null : '_blank',
      rel: 'noopener noreferrer',
      html: `${ICON.ig}<span>Instagram</span>`,
      onclick: d.isDemo ? (e) => { e.preventDefault(); toast('Di undangan asli, tombol ini membuka Instagram mempelai'); } : null,
    })
    : null;
  return h('div', { class: 'person reveal' },
    pillFrame(p.photo, letter),
    h('p', { class: 'person-nick', text: str(p.nickname, 40) }),
    h('h3', { class: 'person-name', text: str(p.fullName, 80) }),
    h('p', { class: 'person-parents' },
      str(p.childOrder, 40) || 'Putra/Putri dari', h('br'),
      h('strong', { text: `${str(p.father, 80)} & ${str(p.mother, 80)}` })),
    igBtn,
  );
}

function renderCouple(d, letters) {
  const g = d.greeting || {};
  return cardSection({ id: 'mempelai', cls: 'couple' },
    titleFrame(scriptTitle('We are Getting Married!'), 'reveal'),
    g.salam ? h('p', { class: 'salam reveal', text: str(g.salam, 120) }) : null,
    g.opening ? h('p', { class: 'sec-text reveal', text: str(g.opening, 800) }) : null,
    person(d.couple.groom, letters[0], d),
    h('p', { class: 'couple-amp', 'aria-hidden': 'true', text: '&' }),
    person(d.couple.bride, letters[1], d),
  );
}

function eventCard(ev, d) {
  const date = new Date(ev.startIso);
  const ok = !Number.isNaN(date.getTime());
  const opt = (o) => (ok ? date.toLocaleDateString('id-ID', { ...o, timeZone: 'Asia/Jakarta' }) : '');
  const maps = typeof ev.mapsUrl === 'string' && SAFE_MAPS.test(ev.mapsUrl) ? ev.mapsUrl : '';
  const cal = calendarUrl(ev, d);
  return h('div', { class: 'event-card reveal' },
    deco(IMG.rose, 'event-flower ef-tl'),
    deco(IMG.bouquet, 'event-flower ef-br'),
    h('h3', { class: 'event-title', text: str(ev.title, 40) }),
    ok ? h('p', { class: 'event-day', text: opt({ weekday: 'long' }) }) : null,
    h('p', { class: 'event-date', text: ok ? `${opt({ day: 'numeric' })} ${opt({ month: 'long' })} ${opt({ year: 'numeric' })}` : str(ev.dateLabel, 60) }),
    h('p', { class: 'event-time', text: str(ev.timeLabel, 60) }),
    ev.venueName || ev.address ? h('span', { class: 'event-pin', html: ICON.pinLg }) : null,
    ev.venueName ? h('p', { class: 'event-venue', text: str(ev.venueName, 100) }) : null,
    ev.address ? h('p', { class: 'event-address', text: str(ev.address, 200) }) : null,
    maps || cal ? h('div', { class: 'event-actions' },
      maps ? h('a', { class: 'btn-navy', href: maps, target: '_blank', rel: 'noopener noreferrer', html: `${ICON.pin}<span>Google Maps</span>` }) : null,
      cal ? h('a', { class: 'btn-ghost', href: cal, target: '_blank', rel: 'noopener noreferrer', html: `${ICON.cal}<span>Kalender</span>` }) : null,
    ) : null,
  );
}

// Save the Date: buket, hitung mundur, lalu kartu tiap acara, di atas latar navy-wayang
function renderSaveDate(d) {
  const first = firstEventTime(d);
  const box = (id, lbl) => h('div', { class: 'cd-box' }, h('span', { class: 'cd-num', id, text: '00' }), h('span', { class: 'cd-lbl', text: lbl }));
  const sec = h('section', { class: 'inv-section navy wayang-bg savedate', id: 'acara' },
    deco(IMG.bouquet, 'bouquet reveal'),
    titleFrame(scriptTitle('Save the Date'), 'reveal'),
    h('div', { class: 'countdown reveal' }, box('cdD', 'Hari'), box('cdH', 'Jam'), box('cdM', 'Menit'), box('cdS', 'Detik')),
    h('p', { class: 'sec-text reveal', text: str(d.eventsIntro, 300) || 'Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pernikahan kami pada:' }),
    (d.events || []).slice(0, 4).map((ev) => eventCard(ev, d)),
  );
  if (first) {
    const tick = () => {
      const diff = Math.max(0, first - Date.now());
      const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n).padStart(2, '0'); };
      set('cdD', Math.floor(diff / 864e5));
      set('cdH', Math.floor(diff / 36e5) % 24);
      set('cdM', Math.floor(diff / 6e4) % 60);
      set('cdS', Math.floor(diff / 1e3) % 60);
    };
    tick();
    setInterval(tick, 1000);
  }
  return [h('div', { class: 'parang-band jawa-only', 'aria-hidden': 'true' }), sec, h('div', { class: 'parang-band jawa-only', 'aria-hidden': 'true' })];
}

function renderStory(d) {
  const items = Array.isArray(d.story) ? d.story.slice(0, 8) : [];
  if (!items.length) return null;
  return cardSection({ cls: 'story' },
    deco(IMG.bouquet, 'bouquet reveal'),
    titleFrame(scriptTitle('Love Story'), 'reveal'),
    h('p', { class: 'sec-eyebrow-sm reveal', text: 'Kisah Cinta Kami' }),
    items.map((s) => h('div', { class: 'story-card reveal' },
      s.period ? h('p', { class: 'story-period', text: str(s.period, 30) }) : null,
      h('h3', { class: 'story-title', text: str(s.title, 80) }),
      h('p', { class: 'story-body', text: str(s.body, 1200) }),
    )),
  );
}

function renderGift(d) {
  const g = d.gifts || {};
  const accounts = Array.isArray(g.accounts) ? g.accounts.slice(0, 4) : [];
  if (!accounts.length && !g.address) return null;
  const first = firstEventTime(d);
  const wedDate = first ? new Date(first).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '';
  return h('section', { class: 'inv-section navy gift', id: 'hadiah' },
    h('span', { class: 'gift-icon reveal', 'aria-hidden': 'true', html: ICON.giftLg }),
    titleFrame(scriptTitle('Amplop Digital'), 'reveal'),
    g.note ? h('p', { class: 'sec-text reveal', text: str(g.note, 400) }) : null,
    accounts.map((a) => h('div', { class: 'gift-card reveal' },
      h('div', { class: 'gift-row' },
        h('span', { class: 'gift-bank', text: str(a.bank, 40) }),
        deco(IMG.gunungan, 'gift-emblem')),
      h('div', { class: 'gift-row' },
        h('div', {}, h('span', { class: 'gift-lbl', text: 'Nomor Rekening' }), h('span', { class: 'gift-number', text: str(a.number, 40) })),
        h('button', {
          type: 'button', class: 'btn-gold gift-copy', html: `${ICON.copy}<span>Salin</span>`,
          onclick: async () => {
            try { await navigator.clipboard.writeText(str(a.number, 40).replace(/\s/g, '')); toast('Nomor berhasil disalin'); } catch { toast('Gagal menyalin, salin manual ya'); }
          },
        })),
      h('div', { class: 'gift-row gift-foot' },
        h('div', {}, h('span', { class: 'gift-lbl', text: 'Atas Nama' }), h('strong', { class: 'gift-name', text: str(a.name, 80) })),
        wedDate ? h('div', { class: 'gift-right' }, h('span', { class: 'gift-lbl', text: 'Pernikahan' }), h('strong', { text: wedDate })) : null),
    )),
    g.address ? h('div', { class: 'gift-address reveal' }, h('strong', { text: 'Kirim Kado' }), h('br'), str(g.address, 200)) : null,
  );
}

const ATTEND_LABEL = { hadir: 'Hadir', tidak: 'Tidak Hadir', ragu: 'Masih Ragu' };
const WISHES_PER_PAGE = 5;

function wishItem(w) {
  const ago = timeAgo(w.createdAt);
  return h('div', { class: 'wish' },
    h('div', { class: 'wish-head' },
      h('span', { class: 'wish-name', text: str(w.name, 60) }),
      ATTEND_LABEL[w.attendance] ? h('span', { class: `wish-badge is-${w.attendance}`, text: ATTEND_LABEL[w.attendance] }) : null,
    ),
    h('p', { class: 'wish-msg', text: str(w.message, 300) }),
    ago ? h('p', { class: 'wish-time', html: ICON.clock }, ago) : null,
  );
}

function renderRsvpWishes(d, guest) {
  const rsvpOn = !!d.rsvp?.enabled;
  if (!rsvpOn && !d.wishes?.enabled) return null;
  const all = (Array.isArray(d.wishes?.sample) ? d.wishes.sample : []).slice(0, 200);
  let page = 1;

  const total = h('p', { class: 'wish-total' });
  const counts = {};
  const counters = rsvpOn ? h('div', { class: 'attend-stats reveal' }, Object.entries(ATTEND_LABEL).map(([k, l]) => {
    counts[k] = h('strong', { text: '0' });
    return h('div', { class: `stat is-${k}` }, counts[k], h('span', { text: l }));
  })) : null;
  const list = h('div', { class: 'wish-list' });
  const pager = h('nav', { class: 'wish-pager', 'aria-label': 'Halaman ucapan' });

  function draw() {
    total.textContent = `${all.length} Ucapan`;
    for (const k of Object.keys(counts)) counts[k].textContent = String(all.filter((w) => w.attendance === k).length);
    const pages = Math.max(1, Math.ceil(all.length / WISHES_PER_PAGE));
    page = Math.min(Math.max(1, page), pages);
    list.replaceChildren(...all.slice((page - 1) * WISHES_PER_PAGE, page * WISHES_PER_PAGE).map(wishItem));
    pager.hidden = pages <= 1;
    const go = (n) => () => { page = n; draw(); list.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
    pager.replaceChildren(
      h('button', { type: 'button', text: '‹ Sebelumnya', disabled: page === 1, onclick: go(page - 1) }),
      ...Array.from({ length: pages }, (_, i) => h('button', { type: 'button', class: i + 1 === page ? 'active' : null, 'aria-current': i + 1 === page ? 'page' : null, text: String(i + 1), onclick: go(i + 1) })),
      h('button', { type: 'button', text: 'Berikutnya ›', disabled: page === pages, onclick: go(page + 1) }),
    );
  }

  const max = Math.min(10, Math.max(1, Number(d.rsvp?.maxGuests) || 2));
  const guestsRow = h('div', { class: 'guests-row', hidden: true },
    h('label', { for: 'fGuests', text: 'Jumlah Tamu' }),
    h('select', { id: 'fGuests', name: 'guests' }, Array.from({ length: max }, (_, i) => h('option', { value: String(i + 1), text: `${i + 1} orang` }))));
  const attend = rsvpOn ? h('select', { id: 'fAttend', name: 'attendance', 'aria-label': 'Konfirmasi Kehadiran' },
    h('option', { value: '', text: 'Konfirmasi Kehadiran', selected: true, disabled: true }),
    Object.entries(ATTEND_LABEL).map(([v, l]) => h('option', { value: v, text: l }))) : null;
  attend?.addEventListener('change', () => { guestsRow.hidden = attend.value !== 'hadir'; });

  const form = h('form', { class: 'inv-form reveal', novalidate: true },
    h('input', { id: 'fName', name: 'name', maxlength: '60', required: true, value: guest || '', autocomplete: 'name', placeholder: 'Nama', 'aria-label': 'Nama' }),
    h('textarea', { id: 'fMsg', name: 'message', rows: '3', maxlength: '300', placeholder: 'Ucapan & doa untuk kedua mempelai', 'aria-label': 'Ucapan' }),
    attend,
    rsvpOn ? guestsRow : null,
    h('button', { type: 'submit', class: 'btn-navy', text: 'Kirim' }),
    d.isDemo ? h('p', { class: 'form-note', text: 'Ini undangan contoh: ucapan hanya tampil di layar Anda dan tidak disimpan.' }) : null,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim().slice(0, 60);
    const message = String(fd.get('message') || '').trim().slice(0, 300);
    const attendance = String(fd.get('attendance') || '');
    if (!name) { toast('Mohon isi nama Anda'); form.querySelector('#fName').focus(); return; }
    if (!message) { toast('Mohon tulis ucapan Anda'); form.querySelector('#fMsg').focus(); return; }
    if (rsvpOn && !ATTEND_LABEL[attendance]) { toast('Mohon pilih konfirmasi kehadiran'); attend.focus(); return; }
    // Undangan contoh: tampil di layar saja. Undangan pelanggan akan dikirim ke server (tahap berikutnya).
    all.unshift({ name, attendance, message, createdAt: new Date().toISOString() });
    page = 1;
    draw();
    form.querySelector('#fMsg').value = '';
    toast('Terima kasih atas ucapan dan doanya');
  });
  draw();

  return cardSection({ id: 'ucapan', cls: 'wishes' },
    titleFrame(scriptTitle('Ucapan & Doa'), 'reveal'),
    h('p', { class: 'sec-text reveal', text: 'Mohon konfirmasi kehadiran dan kirimkan doa terbaik untuk kedua mempelai.' }),
    total,
    counters,
    form,
    list,
    pager,
  );
}

// Penutup: foto penuh dengan lapisan navy
function renderClosing(d) {
  const c = d.closing || {};
  const names = () => h('p', { class: 'closing-names' }, str(d.couple.groom.nickname, 40), h('span', { class: 'amp', text: '&' }), str(d.couple.bride.nickname, 40));
  return h('section', { class: 'inv-section closing' },
    photoBg(h('div', { class: 'closing-bg', 'aria-hidden': 'true' }), safeMedia(d.photos?.closing) || safeMedia(d.photos?.cover)),
    h('div', { class: 'closing-content' },
      deco(IMG.gunungan, 'gunungan-lg jawa-only reveal'),
      h('div', { class: 'reveal' }, names()),
      c.thanks ? h('p', { class: 'sec-text reveal', text: str(c.thanks, 600) }) : null,
      c.prayer ? h('p', { class: 'hero-line reveal', text: str(c.prayer, 400) }) : null,
      c.salam ? h('p', { class: 'salam reveal', text: str(c.salam, 120) }) : null,
      h('p', { class: 'closing-sign reveal', text: 'Kami yang berbahagia' }),
      h('div', { class: 'reveal' }, names()),
      c.family ? h('p', { class: 'closing-family reveal', text: str(c.family, 200) }) : null,
    ),
  );
}

function renderGallery(d) {
  const photos = (d.photos?.gallery || []).map(safeMedia).filter(Boolean).slice(0, 12);
  if (!photos.length) return null;
  const box = h('div', { class: 'lightbox', hidden: true, onclick: () => { box.hidden = true; } }, h('img', { alt: 'Foto mempelai' }));
  document.body.append(box);
  return h('section', { class: 'inv-section navy gallery-sec', id: 'galeri' },
    titleFrame(scriptTitle('Galeri'), 'reveal'),
    h('div', { class: 'gallery reveal' }, photos.map((src) => h('button', {
      type: 'button', 'aria-label': 'Perbesar foto',
      onclick: () => { box.querySelector('img').src = src; box.hidden = false; },
    }, h('img', { src, alt: '', loading: 'lazy' })))),
  );
}

function renderFooter(d) {
  return h('footer', { class: 'inv-footer' },
    h('div', { class: 'footer-sign' },
      h('span', { class: 'line', 'aria-hidden': 'true' }),
      h('span', { class: 'footer-names' }, str(d.couple.groom.nickname, 40), h('span', { class: 'amp', text: '&' }), str(d.couple.bride.nickname, 40)),
      h('span', { class: 'line', 'aria-hidden': 'true' })),
    d.isDemo ? h('div', { class: 'demo-cta' },
      h('p', { text: 'Ini adalah undangan contoh. Nama, foto, acara, dan rekening dapat disesuaikan dengan data Anda.' }),
      h('a', { class: 'btn-navy', href: 'https://wa.me/6288267108077?text=' + encodeURIComponent('Halo dy.florist, saya tertarik memesan undangan digital tema Jawa Elegan.'), target: '_blank', rel: 'noopener noreferrer', text: 'Pesan Undangan Seperti Ini' })) : null,
    h('p', { class: 'credit' }, 'Undangan digital oleh ', h('a', { href: '/', target: '_blank', rel: 'noopener', text: 'dy.florist' })),
  );
}

function renderSide(d, letters) {
  return h('aside', { class: 'inv-side kawung', 'aria-hidden': 'true' },
    ornament('foto/bunga-krem.webp', 'orn-tl'),
    ornament('foto/mawar-putih.webp', 'orn-br'),
    h('div', { class: 'side-inner' },
      deco(IMG.gunungan, 'cover-gunungan jawa-only'),
      h('p', { class: 'script-eyebrow', text: 'The Wedding of' }),
      archFrame(d.photos?.cover, letters),
      namesLine(d, 'side-names'),
      h('p', { class: 'side-date', text: str(d.dateLabel, 60) }),
    ),
  );
}

function renderNav(sections) {
  const nav = document.getElementById('invNav');
  const items = [['beranda', 'home', 'Beranda'], ['mempelai', 'couple', 'Mempelai'], ['acara', 'calendar', 'Acara'], ['hadiah', 'gift', 'Hadiah'], ['ucapan', 'chat', 'Ucapan'], ['galeri', 'gallery', 'Galeri']]
    .filter(([id]) => sections.includes(id));
  nav.replaceChildren(...items.map(([id, icon, label]) => h('a', { href: `#${id}`, 'aria-label': label, title: label, html: ICON[icon] })));
  const links = [...nav.querySelectorAll('a')];
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${en.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  items.forEach(([id]) => { const el = document.getElementById(id); if (el) obs.observe(el); });
}

function setupReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); } });
  }, { threshold: 0.12 });
  els.forEach((e) => obs.observe(e));
}

function addPetals(cover) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    p.className = 'petal';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${9 + Math.random() * 9}s`;
    p.style.animationDelay = `${-Math.random() * 15}s`;
    p.style.transform = `scale(${0.6 + Math.random() * 0.7})`;
    cover.append(p);
  }
}

// ---------- Mulai ----------
async function start() {
  const cover = document.getElementById('invCover');
  addPetals(cover);
  const m = /^\/undangan\/([^/]+)\/?$/.exec(location.pathname);
  const slug = m ? decodeURIComponent(m[1]).toLowerCase() : 'demo';
  const guest = (new URLSearchParams(location.search).get('to') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (guest) document.getElementById('guestName').textContent = guest;

  const showError = (msg) => {
    const el = document.getElementById('coverError');
    el.textContent = msg;
    el.hidden = false;
  };
  if (!SLUG_RE.test(slug)) { showError('Alamat undangan tidak valid.'); return; }

  let d;
  try {
    const res = await fetch(`/api/invitations/${encodeURIComponent(slug)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(res.status === 404 ? 'Undangan tidak ditemukan.' : 'Undangan gagal dimuat.');
    d = await res.json();
  } catch (e) {
    showError(e.message && e.message.startsWith('Undangan') ? e.message : 'Undangan gagal dimuat. Periksa koneksi Anda lalu muat ulang.');
    return;
  }

  if (d.theme?.javanese) document.body.classList.add('jawa');
  const letters = initials(d);
  const names = `${str(d.couple.groom.nickname, 40)} & ${str(d.couple.bride.nickname, 40)}`;
  document.title = `Undangan Pernikahan ${names}`;

  // Sampul
  photoBg(document.getElementById('coverBg'), safeMedia(d.photos?.cover));
  document.getElementById('coverNames').replaceWith(namesLine(d, 'cover'));
  document.getElementById('coverDate').textContent = str(d.dateLabel, 60);

  // Isi
  const main = document.getElementById('invMain');
  const col = h('div', { class: 'inv-col' },
    renderIntro(d), renderQuote(d, letters), renderCouple(d, letters), renderSaveDate(d), renderStory(d),
    renderGift(d), renderRsvpWishes(d, guest), renderClosing(d), renderGallery(d), renderFooter(d));
  main.classList.add('has-side');
  main.replaceChildren(renderSide(d, letters), col);
  renderNav([...col.querySelectorAll('section[id]')].map((s) => s.id));

  if (d.isDemo) {
    document.getElementById('invCover').append(h('div', { class: 'demo-ribbon' }, 'Undangan contoh · ', h('a', { href: '/katalog?kategori=undangan', text: 'Pesan di dy.florist' })));
  }

  // Musik (hanya jika ada berkas musik yang aman)
  const audio = document.getElementById('invAudio');
  const musicBtn = document.getElementById('invMusic');
  const music = safeMedia(d.music?.src);
  if (music) {
    audio.src = music;
    musicBtn.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    });
    audio.addEventListener('play', () => musicBtn.classList.add('playing'));
    audio.addEventListener('pause', () => musicBtn.classList.remove('playing'));
  }

  const btn = document.getElementById('btnOpen');
  btn.disabled = false;
  btn.addEventListener('click', () => {
    cover.classList.add('is-open');
    document.body.classList.remove('is-locked');
    main.removeAttribute('aria-hidden');
    document.getElementById('invNav').hidden = false;
    if (music) { musicBtn.hidden = false; audio.play().catch(() => {}); }
    setTimeout(() => cover.remove(), 1200);
    setupReveal();
  });
}

start();
