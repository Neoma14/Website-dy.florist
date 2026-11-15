/**
 * Admin Undangan dy.florist: kelola undangan digital pelanggan.
 * Semua teks ditulis lewat textContent/value (tanpa innerHTML untuk data), tanpa handler inline (CSP).
 */

// ---------- Utilitas ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const $ = (id) => document.getElementById(id);

async function api(path, { method = 'GET', json, form } = {}) {
  const headers = {};
  let body;
  if (method !== 'GET') headers['X-Requested-With'] = 'dyflorist';
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch('/api' + path, { method, headers, body, credentials: 'same-origin' });
  let data = null;
  try { data = await res.json(); } catch { /* bukan JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Terjadi kesalahan, coba lagi.');
    err.status = res.status;
    if (res.status === 401 && path !== '/admin/login') showLogin('Sesi berakhir. Silakan masuk kembali.');
    throw err;
  }
  return data;
}

function toast(msg) {
  const t = $('uaToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3000);
}

async function copyText(text, done = 'Disalin') {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { window.prompt('Salin teks berikut:', text); }
}

const STATUS_LABEL = { draft: 'Draft', terbit: 'Terbit', arsip: 'Arsip' };
const ATTEND_LABEL = { hadir: 'Hadir', tidak: 'Tidak Hadir', ragu: 'Masih Ragu' };
const WISH_LABEL = { tampil: 'Tampil', menunggu: 'Menunggu', sembunyi: 'Disembunyikan' };
const ZONES = { WIB: '+07:00', WITA: '+08:00', WIT: '+09:00' };
const fmtDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); };
const inviteUrl = (slug, guest) => `${location.origin}/undangan/${slug}${guest ? `?to=${encodeURIComponent(guest)}` : ''}`;
const coupleName = (g, b) => (g || b ? `${g || '…'} & ${b || '…'}` : '(nama mempelai belum diisi)');

function confirmBox(title, message, okLabel = 'Ya, lanjutkan', danger = false) {
  return new Promise((resolve) => {
    const close = (v) => { $('uaModal').hidden = true; resolve(v); };
    $('uaModalTitle').textContent = title;
    $('uaModalBody').replaceChildren(
      h('p', { class: 'ua-muted', text: message }),
      h('div', { class: 'ua-row-end' },
        h('button', { type: 'button', class: 'ua-btn ghost', text: 'Batal', onclick: () => close(false) }),
        h('button', { type: 'button', class: `ua-btn${danger ? ' danger' : ''}`, text: okLabel, onclick: () => close(true) })),
    );
    $('uaModal').hidden = false;
  });
}

// ---------- Sesi ----------
let ROLE = null;

function showLogin(message) {
  ROLE = null;
  $('uaTopActions').hidden = true;
  $('uaList').hidden = true;
  $('uaEditor').hidden = true;
  $('uaLogin').hidden = false;
  const alert = $('uaLoginAlert');
  alert.hidden = !message;
  alert.textContent = message || '';
  setTimeout(() => $('uaPassword').focus(), 50);
}

function afterLogin(role) {
  ROLE = role;
  $('uaLogin').hidden = true;
  $('uaTopActions').hidden = false;
  $('uaRole').textContent = role === 'main' ? 'Admin Utama' : 'Admin Undangan';
  $('uaMainAdmin').hidden = role !== 'main';
  route();
}

$('uaLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('uaPassword');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const out = await api('/admin/login', { method: 'POST', json: { password: pw.value } });
    pw.value = '';
    afterLogin(out.role || 'main');
  } catch (err) {
    const alert = $('uaLoginAlert');
    alert.hidden = false;
    alert.textContent = err.message;
    pw.value = '';
    pw.focus();
  } finally {
    btn.disabled = false;
  }
});

$('uaLogout').addEventListener('click', async () => {
  if (dirty && !(await confirmBox('Keluar?', 'Ada perubahan yang belum disimpan.', 'Keluar tanpa menyimpan', true))) return;
  dirty = false;
  try { await api('/admin/logout', { method: 'POST' }); } catch { /* tetap keluar */ }
  history.replaceState(null, '', '/admin/undangan');
  showLogin('Anda sudah keluar.');
});

// ---------- Navigasi (#id = editor) ----------
let dirty = false;
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', () => route());

async function route() {
  if (!ROLE) return;
  const m = /^#(\d+)(?:\/(isi|tamu|ucapan))?$/.exec(location.hash);
  if (m) await openEditor(Number(m[1]), m[2] || 'isi');
  else await renderList();
}

async function goto(hash) {
  if (dirty && !(await confirmBox('Tinggalkan halaman?', 'Ada perubahan yang belum disimpan.', 'Tinggalkan', true))) return;
  dirty = false;
  if (location.hash === hash) route(); else location.hash = hash;
}

// ---------- Daftar undangan ----------
let LIST = [];
let listFilter = { q: '', status: '' };

async function renderList() {
  $('uaEditor').hidden = true;
  const sec = $('uaList');
  sec.hidden = false;
  sec.replaceChildren(h('p', { class: 'ua-muted', text: 'Memuat daftar undangan…' }));
  try {
    LIST = await api('/admin/invitations');
  } catch (e) {
    sec.replaceChildren(h('p', { class: 'ua-alert', text: e.message }));
    return;
  }
  const grid = h('div', { class: 'ua-cards' });
  const search = h('input', { type: 'search', placeholder: 'Cari nama mempelai, pemesan, atau alamat…', value: listFilter.q, 'aria-label': 'Cari undangan' });
  const status = h('select', { 'aria-label': 'Filter status' },
    h('option', { value: '', text: 'Semua status' }),
    Object.entries(STATUS_LABEL).map(([v, l]) => h('option', { value: v, text: l, selected: listFilter.status === v })));
  const draw = () => {
    const q = listFilter.q.toLowerCase();
    const rows = LIST.filter((r) => (!listFilter.status || r.status === listFilter.status) &&
      (!q || [r.groom, r.bride, r.customerName, r.slug, r.customerPhone].join(' ').toLowerCase().includes(q)));
    grid.replaceChildren(...(rows.length ? rows.map(card) : [h('p', { class: 'ua-empty', text: LIST.length ? 'Tidak ada undangan yang cocok.' : 'Belum ada undangan. Klik "Undangan Baru" untuk membuat yang pertama.' })]));
  };
  search.addEventListener('input', () => { listFilter.q = search.value; draw(); });
  status.addEventListener('change', () => { listFilter.status = status.value; draw(); });

  const counts = LIST.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  sec.replaceChildren(
    h('div', { class: 'ua-head' },
      h('div', {}, h('h1', { text: 'Undangan Digital' }),
        h('p', { class: 'ua-muted', text: `${LIST.length} undangan · ${counts.terbit || 0} terbit · ${counts.draft || 0} draft · ${counts.arsip || 0} arsip` })),
      h('div', { class: 'ua-row' },
        h('a', { class: 'ua-btn ghost', href: '/undangan/demo', target: '_blank', rel: 'noopener', text: 'Lihat Contoh' }),
        h('button', { type: 'button', class: 'ua-btn', text: '+ Undangan Baru', onclick: newInvitationDialog }))),
    h('div', { class: 'ua-toolbar' }, search, status),
    grid,
  );
  draw();
}

function card(r) {
  const date = r.firstEvent ? new Date(r.firstEvent).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '';
  return h('article', { class: 'ua-card' },
    h('div', { class: 'ua-card-top' },
      h('span', { class: `ua-chip is-${r.status}`, text: STATUS_LABEL[r.status] || r.status }),
      r.waiting ? h('span', { class: 'ua-chip is-wait', text: `${r.waiting} ucapan menunggu` }) : null),
    h('h2', { text: coupleName(r.groom, r.bride) }),
    h('p', { class: 'ua-slug', text: `/undangan/${r.slug}` }),
    h('dl', {},
      h('dt', { text: 'Pemesan' }), h('dd', { text: [r.customerName, r.customerPhone].filter(Boolean).join(' · ') || '-' }),
      h('dt', { text: 'Acara' }), h('dd', { text: date || r.dateLabel || '-' }),
      h('dt', { text: 'Ucapan' }), h('dd', { text: String(r.wishes) }),
      h('dt', { text: 'Diubah' }), h('dd', { text: fmtDate(r.updatedAt) })),
    h('div', { class: 'ua-row' },
      h('button', { type: 'button', class: 'ua-btn', text: 'Kelola', onclick: () => goto(`#${r.id}`) }),
      h('a', { class: 'ua-btn ghost', href: `/undangan/${r.slug}`, target: '_blank', rel: 'noopener', text: r.status === 'terbit' ? 'Lihat' : 'Pratinjau' }),
      h('button', { type: 'button', class: 'ua-btn ghost', text: 'Link Tamu', onclick: () => goto(`#${r.id}/tamu`) })),
  );
}

function slugSuggest(g, b) {
  const s = `${g}-${b}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.length >= 3 ? s.slice(0, 60) : '';
}

function newInvitationDialog() {
  const groom = h('input', { maxlength: '40', placeholder: 'mis. Rizky' });
  const bride = h('input', { maxlength: '40', placeholder: 'mis. Nadia' });
  const slug = h('input', { maxlength: '60', placeholder: 'rizky-nadia', pattern: '[a-z0-9-]{3,60}' });
  const cust = h('input', { maxlength: '120', placeholder: 'Nama pemesan' });
  const phone = h('input', { maxlength: '30', placeholder: '08…', inputmode: 'tel' });
  const err = h('p', { class: 'ua-alert', hidden: true });
  let slugTouched = false;
  const sync = () => { if (!slugTouched) slug.value = slugSuggest(groom.value, bride.value); preview.textContent = inviteUrl(slug.value || '…'); };
  const preview = h('span', { class: 'ua-slug' });
  groom.addEventListener('input', sync);
  bride.addEventListener('input', sync);
  slug.addEventListener('input', () => { slugTouched = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); sync(); });
  sync();
  const close = () => { $('uaModal').hidden = true; };
  const create = async (e) => {
    e.preventDefault();
    err.hidden = true;
    try {
      const out = await api('/admin/invitations', { method: 'POST', json: { slug: slug.value.trim(), groom: groom.value.trim(), bride: bride.value.trim(), customerName: cust.value.trim(), customerPhone: phone.value.trim() } });
      close();
      toast('Undangan dibuat sebagai draft');
      location.hash = `#${out.id}`;
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message;
    }
  };
  $('uaModalTitle').textContent = 'Undangan Baru';
  $('uaModalBody').replaceChildren(h('form', { class: 'ua-form', onsubmit: create },
    h('div', { class: 'ua-grid2' },
      h('label', {}, 'Panggilan mempelai pria', groom),
      h('label', {}, 'Panggilan mempelai wanita', bride)),
    h('label', {}, 'Alamat undangan', slug, h('small', {}, 'Link: ', preview)),
    h('div', { class: 'ua-grid2' },
      h('label', {}, 'Nama pemesan', cust),
      h('label', {}, 'No. WhatsApp pemesan', phone)),
    h('p', { class: 'ua-muted small', text: 'Data pemesan hanya terlihat di admin, tidak tampil di undangan.' }),
    err,
    h('div', { class: 'ua-row-end' },
      h('button', { type: 'button', class: 'ua-btn ghost', text: 'Batal', onclick: close }),
      h('button', { type: 'submit', class: 'ua-btn', text: 'Buat Undangan' }))));
  $('uaModal').hidden = false;
  setTimeout(() => groom.focus(), 50);
}

// ---------- Editor ----------
let CUR = null; // { id, slug, status, customerName, customerPhone, note, data, problems, stats }

async function openEditor(id, tab) {
  $('uaList').hidden = true;
  const sec = $('uaEditor');
  sec.hidden = false;
  if (!CUR || CUR.id !== id || !dirty) {
    sec.replaceChildren(h('p', { class: 'ua-muted', text: 'Memuat undangan…' }));
    try {
      CUR = await api(`/admin/invitations/${id}`);
      dirty = false;
    } catch (e) {
      sec.replaceChildren(h('p', { class: 'ua-alert', text: e.message }), h('button', { type: 'button', class: 'ua-btn ghost', text: '← Kembali', onclick: () => goto('') }));
      return;
    }
  }
  renderEditor(tab);
}

function setDirty() {
  dirty = true;
  const s = $('uaSaveState');
  if (s) { s.textContent = 'Belum disimpan'; s.className = 'ua-save-state is-dirty'; }
}

// Ambil/ubah nilai bertingkat, mis. get(d, 'couple.groom.nickname')
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.');
  const last = ks.pop();
  const target = ks.reduce((a, k) => (a[k] ??= {}), o);
  target[last] = v;
}

function field(label, path, { type = 'text', max, rows, placeholder, help, inputmode } = {}) {
  const d = CUR.data;
  const val = getPath(d, path) ?? '';
  const input = type === 'textarea'
    ? h('textarea', { rows: String(rows || 3), maxlength: max ? String(max) : null, placeholder })
    : h('input', { type, maxlength: max ? String(max) : null, placeholder, inputmode });
  input.value = val;
  input.addEventListener('input', () => { setPath(d, path, input.value); setDirty(); });
  return h('label', {}, label, input, help ? h('small', { text: help }) : null);
}

function toggle(label, path, help) {
  const input = h('input', { type: 'checkbox', checked: !!getPath(CUR.data, path) });
  input.addEventListener('change', () => { setPath(CUR.data, path, input.checked); setDirty(); });
  return h('label', { class: 'ua-check' }, input, h('span', {}, label, help ? h('small', { text: help }) : null));
}

// Perkecil foto besar di browser sebelum diunggah (batas server 4 MB)
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 1800;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

async function uploadFile(file, kind) {
  const f = kind === 'image' ? await shrinkImage(file) : file;
  if (f.size > 4 * 1024 * 1024) throw new Error(kind === 'audio' ? 'Musik maksimal 4 MB. Kompres dulu (mis. 128 kbps) lalu unggah lagi.' : 'Foto maksimal 4 MB.');
  const form = new FormData();
  form.append('file', f);
  const out = await api('/admin/invitations/upload', { method: 'POST', form });
  if (out.kind !== kind) throw new Error(kind === 'audio' ? 'Berkas harus MP3' : 'Berkas harus foto JPG/PNG/WebP');
  return out.url;
}

function photoField(label, path, help) {
  const wrap = h('div', { class: 'ua-photo' });
  const draw = () => {
    const url = getPath(CUR.data, path) || '';
    const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    const pick = h('button', { type: 'button', class: 'ua-btn ghost small', text: url ? 'Ganti foto' : 'Unggah foto', onclick: () => input.click() });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      pick.disabled = true;
      pick.textContent = 'Mengunggah…';
      try {
        setPath(CUR.data, path, await uploadFile(file, 'image'));
        setDirty();
        toast('Foto terunggah. Jangan lupa Simpan.');
      } catch (e) { toast(e.message); }
      draw();
    });
    wrap.replaceChildren(
      h('span', { class: 'ua-photo-label', text: label }),
      h('div', { class: 'ua-photo-box' }, url ? h('img', { src: url, alt: '' }) : h('span', { text: 'Belum ada foto' })),
      h('div', { class: 'ua-row' }, pick,
        url ? h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Hapus', onclick: () => { setPath(CUR.data, path, ''); setDirty(); draw(); } }) : null),
      help ? h('small', { text: help }) : null,
      input);
  };
  draw();
  return wrap;
}

function fieldset(title, ...children) {
  return h('details', { class: 'ua-fieldset', open: true }, h('summary', { text: title }), h('div', { class: 'ua-fieldset-body' }, ...children));
}

// Daftar berulang (acara, kisah, rekening, galeri)
function repeater({ path, max, addLabel, empty, item, render }) {
  const box = h('div', { class: 'ua-repeat' });
  const draw = () => {
    const list = getPath(CUR.data, path) || [];
    const rows = list.map((it, i) => h('div', { class: 'ua-repeat-item' },
      h('div', { class: 'ua-repeat-head' },
        h('strong', { text: `#${i + 1}` }),
        h('div', { class: 'ua-row' },
          i > 0 ? h('button', { type: 'button', class: 'ua-icon', title: 'Naikkan', 'aria-label': 'Naikkan', text: '↑', onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; setDirty(); draw(); } }) : null,
          h('button', { type: 'button', class: 'ua-icon danger', title: 'Hapus', 'aria-label': 'Hapus', text: '✕', onclick: () => { list.splice(i, 1); setDirty(); draw(); } }))),
      render(it, i, draw)));
    box.replaceChildren(
      ...(rows.length ? rows : [h('p', { class: 'ua-muted small', text: empty })]),
      list.length < max ? h('button', { type: 'button', class: 'ua-btn ghost small', text: addLabel, onclick: () => { setPath(CUR.data, path, [...list, item()]); setDirty(); draw(); } }) : null);
  };
  draw();
  return box;
}

// Satu input yang terikat ke properti objek dalam daftar
function itemInput(obj, key, label, opts = {}) {
  const input = opts.type === 'textarea'
    ? h('textarea', { rows: String(opts.rows || 3), maxlength: opts.max ? String(opts.max) : null, placeholder: opts.placeholder })
    : h('input', { type: opts.type || 'text', maxlength: opts.max ? String(opts.max) : null, placeholder: opts.placeholder, inputmode: opts.inputmode });
  input.value = obj[key] ?? '';
  input.addEventListener('input', () => { obj[key] = input.value; setDirty(); opts.onchange?.(); });
  return h('label', {}, label, input, opts.help ? h('small', { text: opts.help }) : null);
}

// Acara: tanggal + jam + zona waktu -> startIso/endIso + label otomatis
function parseIso(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2})$/.exec(iso || '');
  if (!m) return { date: '', time: '', zone: 'WIB' };
  return { date: m[1], time: m[2], zone: Object.entries(ZONES).find(([, o]) => o === m[3])?.[0] || 'WIB' };
}
function eventEditor(ev) {
  const s = parseIso(ev.startIso);
  const e = parseIso(ev.endIso);
  const date = h('input', { type: 'date', value: s.date });
  const start = h('input', { type: 'time', value: s.time });
  const end = h('input', { type: 'time', value: e.time });
  const zone = h('select', {}, Object.keys(ZONES).map((z) => h('option', { value: z, text: z, selected: s.zone === z })));
  const info = h('small');
  const apply = () => {
    const off = ZONES[zone.value];
    ev.startIso = date.value && start.value ? `${date.value}T${start.value}:00${off}` : '';
    ev.endIso = date.value && end.value ? `${date.value}T${end.value}:00${off}` : '';
    const dot = (t) => t.replace(':', '.');
    ev.timeLabel = start.value ? `${dot(start.value)} – ${end.value ? dot(end.value) : 'Selesai'} ${zone.value}` : '';
    ev.dateLabel = date.value ? new Date(`${date.value}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    info.textContent = ev.startIso ? `Tampil: ${ev.dateLabel}, ${ev.timeLabel}` : 'Isi tanggal dan jam mulai.';
  };
  apply();
  for (const el of [date, start, end, zone]) el.addEventListener('change', () => { apply(); setDirty(); });
  return h('div', { class: 'ua-form' },
    itemInput(ev, 'title', 'Nama acara', { max: 40, placeholder: 'Akad Nikah / Resepsi / Ngunduh Mantu' }),
    h('div', { class: 'ua-grid4' },
      h('label', {}, 'Tanggal', date),
      h('label', {}, 'Jam mulai', start),
      h('label', {}, 'Jam selesai', end, h('small', { text: 'Kosongkan = "Selesai"' })),
      h('label', {}, 'Zona', zone)),
    info,
    itemInput(ev, 'venueName', 'Nama tempat', { max: 100, placeholder: 'Gedung / Kediaman Mempelai Wanita' }),
    itemInput(ev, 'address', 'Alamat', { type: 'textarea', rows: 2, max: 200 }),
    itemInput(ev, 'mapsUrl', 'Link Google Maps', { max: 300, placeholder: 'https://maps.app.goo.gl/…', help: 'Buka Google Maps → Bagikan → Salin link. Link selain Google Maps diabaikan.' }));
}

function musicField() {
  const wrap = h('div', { class: 'ua-photo' });
  const draw = () => {
    const url = CUR.data.music?.src || '';
    const input = h('input', { type: 'file', accept: 'audio/mpeg,.mp3', hidden: true });
    const pick = h('button', { type: 'button', class: 'ua-btn ghost small', text: url ? 'Ganti musik' : 'Unggah MP3', onclick: () => input.click() });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      pick.disabled = true;
      pick.textContent = 'Mengunggah…';
      try {
        CUR.data.music = { ...(CUR.data.music || {}), src: await uploadFile(file, 'audio') };
        if (!CUR.data.music.title) CUR.data.music.title = file.name.replace(/\.mp3$/i, '').slice(0, 80);
        setDirty();
        toast('Musik terunggah. Jangan lupa Simpan.');
      } catch (e) { toast(e.message); }
      draw();
    });
    wrap.replaceChildren(
      h('span', { class: 'ua-photo-label', text: 'Musik latar' }),
      url ? h('audio', { src: url, controls: true, preload: 'none' }) : h('span', { class: 'ua-muted small', text: 'Belum ada musik (tombol musik tidak tampil).' }),
      h('div', { class: 'ua-row' }, pick,
        url ? h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Hapus', onclick: () => { CUR.data.music = { src: '', title: '' }; setDirty(); draw(); } }) : null),
      h('small', { text: 'Format MP3, maks 4 MB. Pastikan pemesan memiliki izin memakai lagu tersebut.' }),
      input);
  };
  draw();
  return wrap;
}

function galleryField() {
  const box = h('div', { class: 'ua-gallery' });
  const draw = () => {
    const list = CUR.data.photos.gallery;
    const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true });
    input.addEventListener('change', async () => {
      const files = [...(input.files || [])].slice(0, 12 - list.length);
      for (const f of files) {
        try { list.push(await uploadFile(f, 'image')); setDirty(); } catch (e) { toast(e.message); }
      }
      if (files.length) toast('Foto galeri terunggah. Jangan lupa Simpan.');
      draw();
    });
    box.replaceChildren(
      ...list.map((url, i) => h('div', { class: 'ua-thumb' }, h('img', { src: url, alt: '' }),
        h('button', { type: 'button', class: 'ua-icon danger', 'aria-label': 'Hapus foto', text: '✕', onclick: () => { list.splice(i, 1); setDirty(); draw(); } }))),
      list.length < 12 ? h('button', { type: 'button', class: 'ua-thumb add', text: `+ Tambah foto (${list.length}/12)`, onclick: () => input.click() }) : null,
      input);
  };
  draw();
  return box;
}

function renderEditor(tab) {
  const c = CUR;
  const d = c.data;
  const sec = $('uaEditor');
  const statusBtns = h('div', { class: 'ua-row' },
    c.status !== 'terbit' ? h('button', { type: 'button', class: 'ua-btn gold', text: 'Terbitkan', onclick: () => changeStatus('terbit') }) : null,
    c.status === 'terbit' ? h('button', { type: 'button', class: 'ua-btn ghost', text: 'Jadikan Draft', onclick: () => changeStatus('draft') }) : null,
    c.status !== 'arsip' ? h('button', { type: 'button', class: 'ua-btn ghost', text: 'Arsipkan', onclick: () => changeStatus('arsip') }) : null,
    c.status !== 'terbit' ? h('button', { type: 'button', class: 'ua-btn ghost danger', text: 'Hapus', onclick: deleteInvitation }) : null);
  const tabs = [['isi', 'Isi Undangan'], ['tamu', 'Link Tamu'], ['ucapan', `Ucapan & Kehadiran (${(c.stats?.hadir || 0) + (c.stats?.tidak || 0) + (c.stats?.ragu || 0)})`]];
  sec.replaceChildren(...[
    h('div', { class: 'ua-head' },
      h('div', {},
        h('button', { type: 'button', class: 'ua-link', text: '← Semua undangan', onclick: () => goto('') }),
        h('h1', { text: coupleName(d.couple.groom.nickname, d.couple.bride.nickname) }),
        h('p', { class: 'ua-row' },
          h('span', { class: `ua-chip is-${c.status}`, text: STATUS_LABEL[c.status] }),
          h('a', { class: 'ua-slug', href: `/undangan/${c.slug}`, target: '_blank', rel: 'noopener', text: inviteUrl(c.slug) }),
          h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Salin link', onclick: () => copyText(inviteUrl(c.slug), 'Link undangan disalin') }))),
      statusBtns),
    c.problems?.length && c.status !== 'terbit' ? h('div', { class: 'ua-note' }, h('strong', { text: 'Sebelum terbit: ' }), c.problems.join(' · ')) : null,
    h('nav', { class: 'ua-tabs' }, tabs.map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'active' : '', text: l, onclick: () => goto(`#${c.id}${k === 'isi' ? '' : `/${k}`}`) }))),
    tab === 'tamu' ? guestLinks() : tab === 'ucapan' ? wishesPanel() : contentForm(),
  ].filter(Boolean));
}

function contentForm() {
  const c = CUR;
  const d = c.data;
  const meta = (label, key, opts = {}) => {
    const input = h('input', { maxlength: String(opts.max || 120), placeholder: opts.placeholder, inputmode: opts.inputmode });
    input.value = c[key] ?? '';
    input.addEventListener('input', () => { c[key] = key === 'slug' ? input.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') : input.value; if (key === 'slug') input.value = c.slug; setDirty(); });
    return h('label', {}, label, input, opts.help ? h('small', { text: opts.help }) : null);
  };
  const person = (who, title) => fieldset(title,
    h('div', { class: 'ua-grid2' },
      field('Nama panggilan *', `couple.${who}.nickname`, { max: 40 }),
      field('Nama lengkap & gelar', `couple.${who}.fullName`, { max: 80 })),
    h('div', { class: 'ua-grid2' },
      field('Keterangan anak', `couple.${who}.childOrder`, { max: 40, placeholder: who === 'groom' ? 'Putra pertama dari' : 'Putri kedua dari' }),
      field('Instagram (tanpa @)', `couple.${who}.instagram`, { max: 30, placeholder: 'username' })),
    h('div', { class: 'ua-grid2' },
      field('Nama ayah', `couple.${who}.father`, { max: 80, placeholder: 'Bapak …' }),
      field('Nama ibu', `couple.${who}.mother`, { max: 80, placeholder: 'Ibu …' })),
    photoField('Foto (bingkai oval)', `couple.${who}.photo`, 'Foto potret/tegak paling bagus. Kosong = monogram inisial.'));

  const save = h('button', { type: 'button', class: 'ua-btn', text: 'Simpan', onclick: saveInvitation });
  return h('div', { class: 'ua-editor' },
    fieldset('Data pesanan (hanya admin)',
      h('div', { class: 'ua-grid2' },
        meta('Nama pemesan', 'customerName'),
        meta('No. WhatsApp pemesan', 'customerPhone', { max: 30, inputmode: 'tel' })),
      meta('Alamat undangan', 'slug', { max: 60, help: 'Huruf kecil, angka, strip. Mengubah alamat membuat link lama tidak berlaku.' }),
      (() => { const t = h('textarea', { rows: '2', maxlength: '500' }); t.value = c.note || ''; t.addEventListener('input', () => { c.note = t.value; setDirty(); }); return h('label', {}, 'Catatan internal', t); })()),
    person('groom', 'Mempelai Pria'),
    person('bride', 'Mempelai Wanita'),
    fieldset('Pembuka & Ayat',
      field('Tanggal di sampul', 'dateLabel', { max: 60, placeholder: 'Otomatis dari acara pertama bila dikosongkan' }),
      field('Kalimat pembuka (di bawah nama)', 'heroLine', { type: 'textarea', rows: 2, max: 200 }),
      field('Salam', 'greeting.salam', { max: 120 }),
      field('Paragraf pembuka', 'greeting.opening', { type: 'textarea', rows: 4, max: 800 }),
      field('Ayat (teks Arab)', 'greeting.quote.arabic', { type: 'textarea', rows: 2, max: 600 }),
      field('Terjemahan ayat / kutipan', 'greeting.quote.text', { type: 'textarea', rows: 3, max: 600 }),
      field('Sumber', 'greeting.quote.source', { max: 60, placeholder: 'QS. Ar-Rum: 21' })),
    fieldset('Acara *',
      field('Kalimat pengantar acara', 'eventsIntro', { type: 'textarea', rows: 2, max: 300, placeholder: 'Kosong = kalimat bawaan' }),
      repeater({ path: 'events', max: 4, addLabel: '+ Tambah acara', empty: 'Belum ada acara.', item: () => ({ title: '', startIso: '', endIso: '', venueName: '', address: '', mapsUrl: '' }), render: (ev) => eventEditor(ev) })),
    fieldset('Kisah Cinta (opsional)',
      repeater({
        path: 'story', max: 8, addLabel: '+ Tambah kisah', empty: 'Kosong = bagian Love Story tidak tampil.',
        item: () => ({ period: '', title: '', body: '' }),
        render: (s) => h('div', { class: 'ua-form' },
          h('div', { class: 'ua-grid2' }, itemInput(s, 'period', 'Waktu', { max: 30, placeholder: '2021 / Februari 2023' }), itemInput(s, 'title', 'Judul', { max: 80 })),
          itemInput(s, 'body', 'Cerita', { type: 'textarea', rows: 3, max: 1200 })),
      })),
    fieldset('Foto',
      h('div', { class: 'ua-grid3' },
        photoField('Sampul & pembuka', 'photos.cover', 'Tampil penuh di sampul. Kosong = foto pendopo.'),
        photoField('Kartu ayat', 'photos.couple', 'Kosong = pakai foto sampul / monogram.'),
        photoField('Penutup', 'photos.closing', 'Kosong = pakai foto sampul / pendopo.')),
      h('span', { class: 'ua-photo-label', text: 'Galeri (maks 12)' }),
      galleryField()),
    fieldset('Amplop Digital (opsional)',
      field('Kalimat pengantar', 'gifts.note', { type: 'textarea', rows: 2, max: 400 }),
      repeater({
        path: 'gifts.accounts', max: 4, addLabel: '+ Tambah rekening / e-wallet', empty: 'Kosong = bagian amplop tidak tampil (kecuali ada alamat kado).',
        item: () => ({ bank: '', number: '', name: '' }),
        render: (a) => h('div', { class: 'ua-grid3' }, itemInput(a, 'bank', 'Bank / e-wallet', { max: 40, placeholder: 'BCA / DANA' }), itemInput(a, 'number', 'Nomor', { max: 40, inputmode: 'numeric' }), itemInput(a, 'name', 'Atas nama', { max: 80 })),
      }),
      field('Alamat kirim kado', 'gifts.address', { type: 'textarea', rows: 2, max: 200 })),
    fieldset('Musik', musicField()),
    fieldset('Penutup',
      field('Ucapan terima kasih', 'closing.thanks', { type: 'textarea', rows: 3, max: 600 }),
      field('Doa', 'closing.prayer', { type: 'textarea', rows: 2, max: 400 }),
      field('Salam penutup', 'closing.salam', { max: 120 }),
      field('Keluarga yang berbahagia', 'closing.family', { type: 'textarea', rows: 2, max: 200, placeholder: 'Keluarga Besar Bapak … & Keluarga Besar Bapak …' })),
    fieldset('Pengaturan',
      toggle('Konfirmasi kehadiran (RSVP)', 'rsvp.enabled'),
      (() => {
        const sel = h('select', {}, Array.from({ length: 10 }, (_, i) => h('option', { value: String(i + 1), text: `${i + 1} orang`, selected: (d.rsvp?.maxGuests || 2) === i + 1 })));
        sel.addEventListener('change', () => { d.rsvp.maxGuests = Number(sel.value); setDirty(); });
        return h('label', {}, 'Maksimal tamu per undangan', sel);
      })(),
      toggle('Ucapan & doa dari tamu', 'wishes.enabled'),
      toggle('Ucapan perlu disetujui dulu', 'wishes.requireApproval', 'Ucapan baru tidak langsung tampil sampai disetujui di tab Ucapan.'),
      toggle('Aksen Jawa (gunungan, parang, wayang)', 'theme.javanese')),
    h('div', { class: 'ua-savebar' },
      h('span', { class: 'ua-save-state', id: 'uaSaveState', text: dirty ? 'Belum disimpan' : 'Tersimpan' }),
      h('a', { class: 'ua-btn ghost', href: `/undangan/${c.slug}`, target: '_blank', rel: 'noopener', text: 'Pratinjau' }),
      save),
  );
}

async function saveInvitation() {
  const c = CUR;
  const d = c.data;
  // Tanggal sampul otomatis dari acara pertama bila kosong
  if (!d.dateLabel?.trim()) {
    const first = (d.events || []).find((e) => e.dateLabel);
    if (first) d.dateLabel = first.dateLabel;
  }
  const btn = document.querySelector('.ua-savebar .ua-btn:last-child');
  if (btn) btn.disabled = true;
  try {
    const out = await api(`/admin/invitations/${c.id}`, {
      method: 'PUT',
      json: { slug: c.slug.trim(), customerName: c.customerName || '', customerPhone: c.customerPhone || '', note: c.note || '', data: d },
    });
    c.slug = out.slug;
    c.data = out.data;
    c.problems = out.problems;
    dirty = false;
    toast('Undangan tersimpan');
    renderEditor('isi');
  } catch (e) {
    toast(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function changeStatus(status) {
  if (dirty) { toast('Simpan perubahan dulu sebelum mengubah status'); return; }
  const msg = {
    terbit: 'Undangan akan bisa dibuka siapa saja yang memiliki link-nya.',
    draft: 'Undangan tidak bisa dibuka tamu sampai diterbitkan lagi.',
    arsip: 'Tamu akan melihat pesan "undangan sudah tidak aktif". Ucapan tetap tersimpan.',
  }[status];
  if (!(await confirmBox(`${{ terbit: 'Terbitkan', draft: 'Jadikan draft', arsip: 'Arsipkan' }[status]} undangan?`, msg))) return;
  try {
    await api(`/admin/invitations/${CUR.id}/status`, { method: 'POST', json: { status } });
    CUR.status = status;
    toast({ terbit: 'Undangan terbit! Bagikan link ke tamu.', draft: 'Undangan menjadi draft', arsip: 'Undangan diarsipkan' }[status]);
    renderEditor(status === 'terbit' ? 'tamu' : 'isi');
    if (status === 'terbit') history.replaceState(null, '', `#${CUR.id}/tamu`);
  } catch (e) {
    toast(e.message);
  }
}

async function deleteInvitation() {
  if (!(await confirmBox('Hapus undangan?', 'Undangan, semua ucapan, dan foto/musiknya akan dihapus permanen.', 'Hapus permanen', true))) return;
  try {
    await api(`/admin/invitations/${CUR.id}`, { method: 'DELETE' });
    dirty = false;
    CUR = null;
    toast('Undangan dihapus');
    goto('');
  } catch (e) {
    toast(e.message);
  }
}

// ---------- Link tamu ----------
const DEFAULT_MESSAGE = `Assalamu'alaikum Warahmatullahi Wabarakatuh

Kepada Yth. Bapak/Ibu/Saudara/i
*{nama}*

Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pernikahan kami.

Informasi lengkap acara dapat dilihat melalui link berikut:
{link}

Merupakan suatu kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.

Terima kasih.
Wassalamu'alaikum Warahmatullahi Wabarakatuh

{mempelai}`;

function guestLinks() {
  const c = CUR;
  const key = `ua-guests-${c.id}`;
  const msgKey = `ua-message-${c.id}`;
  const names = h('textarea', { rows: '8', placeholder: 'Satu nama per baris, mis.\nBapak Budi Santoso & Keluarga\nIbu Sri Wahyuni\nTeman-teman Kantor', 'aria-label': 'Daftar nama tamu' });
  names.value = localStorage.getItem(key) || '';
  const msg = h('textarea', { rows: '10', 'aria-label': 'Template pesan' });
  msg.value = localStorage.getItem(msgKey) || DEFAULT_MESSAGE;
  const list = h('div', { class: 'ua-guest-list' });
  const couple = coupleName(c.data.couple.groom.nickname, c.data.couple.bride.nickname);
  const build = (guest) => msg.value.replaceAll('{nama}', guest).replaceAll('{link}', inviteUrl(c.slug, guest)).replaceAll('{mempelai}', couple);
  const draw = () => {
    localStorage.setItem(key, names.value);
    localStorage.setItem(msgKey, msg.value);
    const guests = [...new Set(names.value.split('\n').map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean))].slice(0, 500);
    list.replaceChildren(
      h('p', { class: 'ua-muted small', text: guests.length ? `${guests.length} tamu` : 'Tulis nama tamu di kolom kiri untuk membuat link.' }),
      ...guests.map((g) => h('div', { class: 'ua-guest' },
        h('div', {}, h('strong', { text: g }), h('span', { class: 'ua-slug', text: inviteUrl(c.slug, g) })),
        h('div', { class: 'ua-row' },
          h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Salin link', onclick: () => copyText(inviteUrl(c.slug, g), 'Link disalin') }),
          h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Salin pesan', onclick: () => copyText(build(g), 'Pesan undangan disalin') }),
          h('a', { class: 'ua-btn small wa', href: `https://wa.me/?text=${encodeURIComponent(build(g))}`, target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp' })))));
  };
  names.addEventListener('input', draw);
  msg.addEventListener('input', draw);
  draw();
  return h('div', { class: 'ua-editor' },
    c.status !== 'terbit' ? h('div', { class: 'ua-note' }, 'Undangan masih ', h('strong', { text: STATUS_LABEL[c.status] }), '. Tamu baru bisa membuka link setelah undangan diterbitkan.') : null,
    h('div', { class: 'ua-grid2 top' },
      h('div', { class: 'ua-form' },
        h('label', {}, 'Nama tamu', names, h('small', { text: 'Daftar ini hanya tersimpan di perangkat ini.' })),
        h('label', {}, 'Template pesan WhatsApp', msg, h('small', { text: 'Kode: {nama} = nama tamu, {link} = link undangan, {mempelai} = nama mempelai.' })),
        h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Kembalikan template bawaan', onclick: () => { msg.value = DEFAULT_MESSAGE; draw(); } })),
      list));
}

// ---------- Ucapan & kehadiran ----------
function wishesPanel() {
  const c = CUR;
  const box = h('div', { class: 'ua-editor' }, h('p', { class: 'ua-muted', text: 'Memuat ucapan…' }));
  let rows = [];
  let filter = '';
  const statsBox = h('div', { class: 'ua-stats' });
  const list = h('div', { class: 'ua-wishes' });
  const drawStats = () => {
    const visible = rows.filter((w) => w.status !== 'sembunyi');
    const n = (k) => visible.filter((w) => w.attendance === k).length;
    const guests = visible.filter((w) => w.attendance === 'hadir').reduce((s, w) => s + (w.guests || 0), 0);
    statsBox.replaceChildren(
      ...[['Hadir', n('hadir'), 'hadir'], ['Tidak Hadir', n('tidak'), 'tidak'], ['Masih Ragu', n('ragu'), 'ragu'], ['Perkiraan tamu', guests, 'total'], ['Menunggu', rows.filter((w) => w.status === 'menunggu').length, 'wait']]
        .map(([l, v, k]) => h('div', { class: `ua-stat is-${k}` }, h('strong', { text: String(v) }), h('span', { text: l }))));
  };
  const setStatus = async (w, status) => {
    try {
      await api(`/admin/invitations/${c.id}/wishes/${w.id}`, { method: 'PATCH', json: { status } });
      w.status = status;
      drawStats(); drawList();
    } catch (e) { toast(e.message); }
  };
  const remove = async (w) => {
    if (!(await confirmBox('Hapus ucapan?', `Ucapan dari "${w.name}" akan dihapus permanen.`, 'Hapus', true))) return;
    try {
      await api(`/admin/invitations/${c.id}/wishes/${w.id}`, { method: 'DELETE' });
      rows = rows.filter((x) => x !== w);
      drawStats(); drawList();
    } catch (e) { toast(e.message); }
  };
  const drawList = () => {
    const shown = rows.filter((w) => !filter || w.status === filter || w.attendance === filter);
    list.replaceChildren(...(shown.length ? shown.map((w) => h('div', { class: `ua-wish is-${w.status}` },
      h('div', { class: 'ua-wish-head' },
        h('strong', { text: w.name }),
        w.attendance ? h('span', { class: `ua-chip att-${w.attendance}`, text: ATTEND_LABEL[w.attendance] + (w.attendance === 'hadir' ? ` · ${w.guests} orang` : '') }) : null,
        h('span', { class: `ua-chip wish-${w.status}`, text: WISH_LABEL[w.status] }),
        h('small', { text: fmtDate(w.createdAt) })),
      h('p', { text: w.message }),
      h('div', { class: 'ua-row' },
        w.status !== 'tampil' ? h('button', { type: 'button', class: 'ua-btn small', text: w.status === 'menunggu' ? 'Setujui' : 'Tampilkan', onclick: () => setStatus(w, 'tampil') }) : null,
        w.status !== 'sembunyi' ? h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Sembunyikan', onclick: () => setStatus(w, 'sembunyi') }) : null,
        h('button', { type: 'button', class: 'ua-btn ghost small danger', text: 'Hapus', onclick: () => remove(w) })))) : [h('p', { class: 'ua-empty', text: rows.length ? 'Tidak ada ucapan dengan filter ini.' : 'Belum ada ucapan dari tamu.' })]));
  };
  const sel = h('select', { 'aria-label': 'Filter ucapan' },
    [['', 'Semua'], ['menunggu', 'Menunggu persetujuan'], ['tampil', 'Tampil'], ['sembunyi', 'Disembunyikan'], ['hadir', 'Hadir'], ['tidak', 'Tidak hadir'], ['ragu', 'Masih ragu']]
      .map(([v, l]) => h('option', { value: v, text: l })));
  sel.addEventListener('change', () => { filter = sel.value; drawList(); });
  const csv = () => {
    // Awali sel yang bisa dibaca sebagai rumus Excel dengan tanda kutip tunggal
    const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
    const lines = [['Nama', 'Kehadiran', 'Jumlah Tamu', 'Ucapan', 'Status', 'Waktu']]
      .concat(rows.map((w) => [w.name, ATTEND_LABEL[w.attendance] || '-', w.attendance === 'hadir' ? w.guests : '', w.message, WISH_LABEL[w.status], fmtDate(w.createdAt)]));
    const blob = new Blob(['﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `ucapan-${c.slug}.csv` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  api(`/admin/invitations/${c.id}/wishes`).then((data) => {
    rows = data;
    box.replaceChildren(
      statsBox,
      h('div', { class: 'ua-toolbar' }, sel,
        h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Unduh CSV (Excel)', onclick: csv })),
      list);
    drawStats(); drawList();
  }).catch((e) => box.replaceChildren(h('p', { class: 'ua-alert', text: e.message })));
  return box;
}

// ---------- Mulai ----------
(async () => {
  try {
    const s = await api('/admin/session');
    afterLogin(s.role || 'main');
  } catch {
    showLogin();
  }
})();
