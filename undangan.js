/**
 * Undangan Digital dy.florist: template "Jawa Elegan".
 * Data diambil dari /api/invitations/<slug>. Semua teks dari data ditulis lewat textContent (tanpa innerHTML),
 * sehingga isi undangan tidak bisa menyisipkan kode.
 */

const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const SAFE_MEDIA = /^(\/assets\/[\w./-]+|\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|mp3)|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[\w./-]+)$/;
const SAFE_MAPS = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\//;

const ICON = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  couple: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s-7-4.4-9.2-9A5 5 0 0112 6a5 5 0 019.2 6c-2.2 4.6-9.2 9-9.2 9z"/></svg>',
  calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  gallery: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  gift: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 9v12M12 9S10.5 4 8 4.5 7 9 12 9zM12 9s1.5-5 4-4.5S17 9 12 9z"/></svg>',
  chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1.1-4.6A8 8 0 1121 12z"/></svg>',
  ring: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="14" r="6"/><circle cx="15" cy="14" r="6"/><path d="M10 4h4l-2 3z"/></svg>',
  party: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20l5-14 9 9z"/><path d="M14 4l1 2M19 6l-2 1M18 11l2 1"/></svg>',
  pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  cal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
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

function toast(msg) {
  const t = document.getElementById('invToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function ornament(src, cls) {
  return h('img', { src: `/assets/undangan/${src}`, alt: '', class: `orn ${cls}`, 'aria-hidden': 'true' });
}
// Bingkai emas: ornamen atas dan bawah mengapit judul (bukan dipasang sebagai garis pemisah)
function titleFrame(content, cls = '') {
  const piece = (pos) => h('img', { src: `/assets/undangan/foto/bingkai-${pos}.webp`, alt: '', class: `frame-${pos}`, 'aria-hidden': 'true' });
  return h('div', { class: `title-frame ${cls}`.trim() }, piece('atas'), content, piece('bawah'));
}
function sectionHead(eyebrow, title) {
  return [h('p', { class: 'sec-eyebrow', text: eyebrow }), titleFrame(h('h2', { class: 'sec-title', text: title }))];
}

function initials(d) {
  const g = str(d.couple?.groom?.nickname, 40).trim().charAt(0).toUpperCase() || 'A';
  const b = str(d.couple?.bride?.nickname, 40).trim().charAt(0).toUpperCase() || 'B';
  return [g, b];
}

// Bingkai lengkung berisi foto, atau monogram inisial + siluet candi bila foto kosong
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

// ---------- Bagian-bagian undangan ----------
function renderHero(d, letters) {
  return h('section', { class: 'inv-section hero wash kawung-soft', id: 'beranda' },
    ornament('foto/bunga-krem.webp', 'orn-tr'),
    ornament('foto/mawar-putih.webp', 'orn-bl'),
    h('p', { class: 'sec-eyebrow reveal', text: 'The Wedding of' }),
    h('div', { class: 'reveal' }, archFrame(d.photos?.cover, letters)),
    h('div', { class: 'reveal' }, namesLine(d, 'hero-names')),
    h('p', { class: 'hero-date reveal', text: str(d.dateLabel, 60) }),
    d.heroLine ? h('p', { class: 'hero-line reveal', text: str(d.heroLine, 200) }) : null,
  );
}

function renderGreeting(d) {
  const g = d.greeting || {};
  const q = g.quote;
  return h('section', { class: 'inv-section' },
    ornament('foto/bunga-krem.webp', 'orn-tr'),
    g.salam ? titleFrame(h('p', { class: 'salam', text: str(g.salam, 120) }), 'reveal') : null,
    g.opening ? h('p', { class: 'sec-text reveal', text: str(g.opening, 800) }) : null,
    q && (q.text || q.arabic) ? h('div', { class: 'quote-card reveal' },
      q.arabic ? h('p', { class: 'quote-arabic', lang: 'ar', text: str(q.arabic, 600) }) : null,
      q.text ? h('p', { class: 'quote-text', text: `“${str(q.text, 600)}”` }) : null,
      q.source ? h('p', { class: 'quote-src', text: str(q.source, 60) }) : null,
    ) : null,
  );
}

function person(p, letter) {
  return h('div', { class: 'person reveal' },
    archFrame(p.photo, [letter]),
    h('p', { class: 'person-nick', text: str(p.nickname, 40) }),
    h('h3', { class: 'person-name', text: str(p.fullName, 80) }),
    h('p', { class: 'person-parents' },
      str(p.childOrder, 40) || 'Putra/Putri dari', h('br'),
      h('strong', { text: `${str(p.father, 80)} & ${str(p.mother, 80)}` })),
  );
}

function renderCouple(d, letters) {
  return h('section', { class: 'inv-section wash-bottom', id: 'mempelai' },
    ornament('foto/mawar-putih.webp', 'orn-tr'),
    ...sectionHead('Mempelai', 'Kedua Mempelai'),
    person(d.couple.groom, letters[0]),
    h('p', { class: 'couple-amp', 'aria-hidden': 'true', text: '&' }),
    person(d.couple.bride, letters[1]),
  );
}

function renderStory(d) {
  const items = Array.isArray(d.story) ? d.story.slice(0, 8) : [];
  if (!items.length) return null;
  return h('section', { class: 'inv-section' },
    ...sectionHead('Perjalanan Kami', 'Kisah Cinta'),
    h('div', { class: 'timeline' }, items.map((s) => h('div', { class: 'story-item reveal' },
      s.period ? h('p', { class: 'story-period', text: str(s.period, 30) }) : null,
      h('h3', { class: 'story-title', text: str(s.title, 80) }),
      h('p', { class: 'story-body', text: str(s.body, 600) }),
    ))),
  );
}

function renderCountdown(d) {
  const first = (d.events || []).map((e) => Date.parse(e.startIso)).filter((n) => !Number.isNaN(n)).sort()[0];
  const box = (id, lbl) => h('div', { class: 'cd-box' }, h('span', { class: 'cd-num', id, text: '00' }), h('span', { class: 'cd-lbl', text: lbl }));
  const sec = h('section', { class: 'inv-section navy wayang-bg' },
    h('p', { class: 'sec-eyebrow reveal', text: 'Menghitung Hari' }),
    titleFrame(h('h2', { class: 'sec-title', text: 'Save the Date' }), 'reveal'),
    h('div', { class: 'countdown reveal' }, box('cdD', 'Hari'), box('cdH', 'Jam'), box('cdM', 'Menit'), box('cdS', 'Detik')),
    d.events?.[0] && calendarUrl(d.events[0], d)
      ? h('a', { class: 'btn-gold reveal', href: calendarUrl(d.events[0], d), target: '_blank', rel: 'noopener noreferrer', html: `${ICON.cal}<span>Simpan ke Kalender</span>` })
      : null,
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

function eventCard(ev, d, i) {
  const date = new Date(ev.startIso);
  const ok = !Number.isNaN(date.getTime());
  const opt = (o) => (ok ? date.toLocaleDateString('id-ID', { ...o, timeZone: 'Asia/Jakarta' }) : '');
  const maps = typeof ev.mapsUrl === 'string' && SAFE_MAPS.test(ev.mapsUrl) ? ev.mapsUrl : '';
  return h('div', { class: 'event-card reveal' },
    h('div', { class: 'event-icon', html: i === 0 ? ICON.ring : ICON.party }),
    h('h3', { class: 'event-title', text: str(ev.title, 40) }),
    ok ? h('div', { class: 'event-date' },
      h('span', { class: 'day', text: opt({ weekday: 'long' }) }),
      h('span', { class: 'num', text: opt({ day: '2-digit' }) }),
      h('span', { class: 'month', text: `${opt({ month: 'long' })} ${opt({ year: 'numeric' })}` }),
    ) : h('p', { class: 'event-time', text: str(ev.dateLabel, 60) }),
    h('p', { class: 'event-time', text: str(ev.timeLabel, 60) }),
    ev.venueName ? h('p', { class: 'event-venue', text: str(ev.venueName, 100) }) : null,
    ev.address ? h('p', { class: 'event-address', text: str(ev.address, 200) }) : null,
    h('div', { class: 'event-actions' },
      maps ? h('a', { class: 'btn-navy', href: maps, target: '_blank', rel: 'noopener noreferrer', html: `${ICON.pin}<span>Buka Peta</span>` }) : null,
      calendarUrl(ev, d) ? h('a', { class: 'btn-ghost', href: calendarUrl(ev, d), target: '_blank', rel: 'noopener noreferrer', html: `${ICON.cal}<span>Kalender</span>` }) : null,
    ),
  );
}

function renderEvents(d) {
  return h('section', { class: 'inv-section wash', id: 'acara' },
    ornament('foto/mawar-putih.webp', 'orn-tl'),
    ...sectionHead('Waktu & Tempat', 'Rangkaian Acara'),
    (d.events || []).slice(0, 4).map((ev, i) => eventCard(ev, d, i)),
  );
}

function renderGallery(d) {
  const photos = (d.photos?.gallery || []).map(safeMedia).filter(Boolean).slice(0, 12);
  if (!photos.length) return null;
  const box = h('div', { class: 'lightbox', hidden: true, onclick: () => { box.hidden = true; } }, h('img', { alt: 'Foto mempelai' }));
  document.body.append(box);
  return h('section', { class: 'inv-section', id: 'galeri' },
    ...sectionHead('Momen Bahagia', 'Galeri'),
    h('div', { class: 'gallery reveal' }, photos.map((src) => h('button', {
      type: 'button', 'aria-label': 'Perbesar foto',
      onclick: () => { box.querySelector('img').src = src; box.hidden = false; },
    }, h('img', { src, alt: '', loading: 'lazy' })))),
  );
}

function renderGift(d) {
  const g = d.gifts || {};
  const accounts = Array.isArray(g.accounts) ? g.accounts.slice(0, 4) : [];
  if (!accounts.length && !g.address) return null;
  return h('section', { class: 'inv-section wash-bottom', id: 'hadiah' },
    ...sectionHead('Tanda Kasih', 'Amplop Digital'),
    g.note ? h('p', { class: 'sec-text reveal', text: str(g.note, 400) }) : null,
    accounts.map((a) => h('div', { class: 'gift-card reveal' },
      h('p', { class: 'gift-bank', text: str(a.bank, 40) }),
      h('p', { class: 'gift-number', text: str(a.number, 40) }),
      h('p', { class: 'gift-name', text: `a.n. ${str(a.name, 80)}` }),
      h('button', {
        type: 'button', class: 'btn-gold gift-copy', html: `${ICON.copy}<span>Salin Nomor</span>`,
        onclick: async () => {
          try { await navigator.clipboard.writeText(str(a.number, 40).replace(/\s/g, '')); toast('Nomor berhasil disalin'); } catch { toast('Gagal menyalin, salin manual ya'); }
        },
      }),
    )),
    g.address ? h('div', { class: 'gift-address reveal' }, h('strong', { text: 'Kirim Kado' }), h('br'), str(g.address, 200)) : null,
  );
}

const ATTEND_LABEL = { hadir: 'Hadir', tidak: 'Tidak Hadir', ragu: 'Masih Ragu' };

function wishItem(w) {
  return h('div', { class: 'wish' },
    h('div', { class: 'wish-head' },
      h('span', { class: 'wish-name', text: str(w.name, 60) }),
      ATTEND_LABEL[w.attendance] ? h('span', { class: 'wish-badge', text: ATTEND_LABEL[w.attendance] }) : null,
    ),
    h('p', { class: 'wish-msg', text: str(w.message, 300) }),
  );
}

function renderRsvpWishes(d, guest) {
  if (!d.rsvp?.enabled && !d.wishes?.enabled) return null;
  const list = h('div', { class: 'wish-list' }, (d.wishes?.sample || []).map(wishItem));
  const max = Math.min(10, Math.max(1, Number(d.rsvp?.maxGuests) || 2));
  const form = h('form', { class: 'inv-form reveal', novalidate: true },
    h('label', { for: 'fName', text: 'Nama' }),
    h('input', { id: 'fName', name: 'name', maxlength: '60', required: true, value: guest || '', autocomplete: 'name' }),
    h('label', { text: 'Konfirmasi Kehadiran' }),
    h('div', { class: 'attend-group', role: 'radiogroup' },
      Object.entries(ATTEND_LABEL).map(([v, l], i) => h('label', {},
        h('input', { type: 'radio', name: 'attendance', value: v, checked: i === 0 }), l))),
    h('label', { for: 'fGuests', text: 'Jumlah Tamu' }),
    h('select', { id: 'fGuests', name: 'guests' }, Array.from({ length: max }, (_, i) => h('option', { value: String(i + 1), text: `${i + 1} orang` }))),
    h('label', { for: 'fMsg', text: 'Ucapan & Doa' }),
    h('textarea', { id: 'fMsg', name: 'message', rows: '3', maxlength: '300', placeholder: 'Tulis ucapan dan doa untuk kedua mempelai' }),
    h('button', { type: 'submit', class: 'btn-navy', text: 'Kirim Ucapan' }),
    d.isDemo ? h('p', { class: 'form-note', text: 'Ini undangan contoh: ucapan hanya tampil di layar Anda dan tidak disimpan.' }) : null,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim().slice(0, 60);
    const message = String(fd.get('message') || '').trim().slice(0, 300);
    if (!name) { toast('Mohon isi nama Anda'); form.querySelector('#fName').focus(); return; }
    if (!message) { toast('Mohon tulis ucapan Anda'); form.querySelector('#fMsg').focus(); return; }
    // Undangan contoh: tampil di layar saja. Undangan pelanggan akan dikirim ke server (tahap berikutnya).
    list.prepend(wishItem({ name, attendance: String(fd.get('attendance')), message }));
    form.querySelector('#fMsg').value = '';
    toast('Terima kasih atas ucapan dan doanya');
  });
  return h('section', { class: 'inv-section', id: 'ucapan' },
    ornament('foto/bunga-krem.webp', 'orn-bl'),
    ...sectionHead('Doa & Restu', 'Kehadiran & Ucapan'),
    h('p', { class: 'sec-text reveal', text: 'Mohon konfirmasi kehadiran dan kirimkan doa terbaik untuk kedua mempelai.' }),
    form,
    list,
  );
}

function renderClosing(d) {
  const c = d.closing || {};
  return h('section', { class: 'inv-section closing wash' },
    ornament('foto/mawar-putih.webp', 'orn-tl'),
    h('img', { src: '/assets/undangan/foto/gunungan-emas.webp', alt: '', class: 'gunungan-lg jawa-only', 'aria-hidden': 'true' }),
    c.thanks ? h('p', { class: 'sec-text reveal', text: str(c.thanks, 600) }) : null,
    c.prayer ? h('p', { class: 'hero-line reveal', text: str(c.prayer, 400) }) : null,
    c.salam ? h('p', { class: 'salam reveal', style: 'margin-top:22px', text: str(c.salam, 120) }) : null,
    h('p', { class: 'sec-text reveal', style: 'margin-top:24px', text: 'Kami yang berbahagia,' }),
    h('p', { class: 'closing-names reveal' }, str(d.couple.groom.nickname, 40), h('span', { class: 'amp', text: ' & ' }), str(d.couple.bride.nickname, 40)),
    c.family ? h('p', { class: 'closing-family reveal', text: str(c.family, 200) }) : null,
    h('div', { class: 'closing-photo jawa-only', 'aria-hidden': 'true' }),
    h('p', { class: 'credit' }, 'Undangan digital oleh ', h('a', { href: '/', target: '_blank', rel: 'noopener', text: 'dy.florist' })),
  );
}

function renderSide(d, letters) {
  return h('aside', { class: 'inv-side kawung', 'aria-hidden': 'true' },
    ornament('foto/bunga-krem.webp', 'orn-tl'),
    ornament('foto/mawar-putih.webp', 'orn-br'),
    h('div', { class: 'side-inner' },
      h('img', { src: '/assets/undangan/foto/gunungan-emas.webp', alt: '', class: 'cover-gunungan jawa-only' }),
      h('p', { class: 'script-eyebrow', text: 'The Wedding of' }),
      archFrame(d.photos?.cover, letters),
      namesLine(d, 'side-names'),
      h('p', { class: 'side-date', text: str(d.dateLabel, 60) }),
    ),
  );
}

function renderNav(sections) {
  const nav = document.getElementById('invNav');
  const items = [['beranda', 'home', 'Beranda'], ['mempelai', 'couple', 'Mempelai'], ['acara', 'calendar', 'Acara'], ['galeri', 'gallery', 'Galeri'], ['hadiah', 'gift', 'Hadiah'], ['ucapan', 'chat', 'Ucapan']]
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
  document.getElementById('coverArch').replaceWith(archFrame(d.photos?.cover, letters, 'arch-cover'));
  document.getElementById('coverNames').replaceWith(namesLine(d, 'cover'));
  document.getElementById('coverDate').textContent = str(d.dateLabel, 60);

  // Isi
  const main = document.getElementById('invMain');
  const col = h('div', { class: 'inv-col' },
    renderHero(d, letters), renderGreeting(d), renderCouple(d, letters), renderStory(d), renderCountdown(d),
    renderEvents(d), renderGallery(d), renderGift(d), renderRsvpWishes(d, guest), renderClosing(d));
  main.classList.add('has-side');
  main.replaceChildren(renderSide(d, letters), col);
  renderNav([...col.querySelectorAll('section[id]')].map((s) => s.id));

  if (d.isDemo) {
    // Pita "contoh" hanya di sampul; di akhir undangan ada ajakan memesan
    document.getElementById('invCover').append(h('div', { class: 'demo-ribbon' }, 'Undangan contoh · ', h('a', { href: '/katalog?kategori=undangan', text: 'Pesan di dy.florist' })));
    col.querySelector('.closing .credit').before(h('div', { class: 'demo-cta' },
      h('p', { text: 'Ini adalah undangan contoh. Nama, foto, acara, dan rekening dapat disesuaikan dengan data Anda.' }),
      h('a', { class: 'btn-navy', href: 'https://wa.me/6288267108077?text=' + encodeURIComponent('Halo dy.florist, saya tertarik memesan undangan digital tema Jawa Elegan.'), target: '_blank', rel: 'noopener noreferrer', text: 'Pesan Undangan Seperti Ini' })));
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
