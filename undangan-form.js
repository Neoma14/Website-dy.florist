/**
 * Formulir data undangan untuk pelanggan (dibuka lewat link rahasia /isi/<token>).
 * Pelanggan mengisi data mempelai, acara, foto, dan rekening; admin dy.florist yang meninjau dan menerapkannya.
 * Semua teks ditulis lewat textContent/value (tanpa innerHTML), tanpa handler inline (CSP).
 */
import { createKit, h, shrinkImage } from './undangan-kit.js';

const $ = (id) => document.getElementById(id);
const token = /^\/isi\/([a-f0-9]{48})\/?$/.exec(location.pathname)?.[1] || '';

function toast(msg) {
  const t = $('uaToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}

async function api(path, { method = 'GET', json, form } = {}) {
  const headers = {};
  let body;
  if (method !== 'GET') headers['X-Requested-With'] = 'dyflorist';
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch('/api' + path, { method, headers, body, credentials: 'omit' });
  let data = null;
  try { data = await res.json(); } catch { /* bukan JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Terjadi kesalahan, coba lagi.');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function uploadImage(file) {
  const f = await shrinkImage(file);
  if (f.size > 4 * 1024 * 1024) throw new Error('Foto terlalu besar (maksimal 4 MB).');
  const form = new FormData();
  form.append('file', f);
  return (await api(`/intake/${token}/upload`, { method: 'POST', form })).url;
}

let D = null;
let dirty = false;
let submitted = false;
const markDirty = () => {
  dirty = true;
  const s = $('ufSaveState');
  if (s) { s.textContent = 'Belum disimpan'; s.className = 'ua-save-state is-dirty'; }
};
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

const { field, photoField, fieldset, repeater, itemInput, eventEditor, galleryField } = createKit({
  getData: () => D, onChange: markDirty, toast, uploadImage,
});

function showMessage(title, text) {
  $('ufForm').hidden = true;
  $('ufState').hidden = false;
  $('ufState').replaceChildren(h('div', { class: 'ua-login' }, h('h1', { text: title }), h('p', { text })));
}

function problems() {
  const p = [];
  if (!D.couple.groom.nickname.trim() || !D.couple.bride.nickname.trim()) p.push('Nama panggilan kedua mempelai');
  if (!D.events.some((e) => e.title.trim() && e.startIso)) p.push('Minimal satu acara lengkap dengan tanggal dan jam');
  return p;
}

async function save(submit) {
  if (submit) {
    const p = problems();
    if (p.length) { toast(`Mohon lengkapi dulu: ${p.join('; ')}`); return; }
  }
  const btns = document.querySelectorAll('.ua-savebar .ua-btn');
  btns.forEach((b) => { b.disabled = true; });
  try {
    await api(`/intake/${token}`, { method: 'PUT', json: { data: D, submit: !!submit } });
    dirty = false;
    if (submit) {
      submitted = true;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Data terkirim ke dy.florist. Terima kasih!');
    } else {
      const s = $('ufSaveState');
      if (s) { s.textContent = 'Tersimpan'; s.className = 'ua-save-state'; }
      toast('Draft tersimpan. Anda bisa melanjutkan nanti lewat link yang sama.');
    }
  } catch (e) {
    toast(e.message);
    if (e.status === 409 || e.status === 404) showMessage('Formulir ditutup', e.message);
  } finally {
    btns.forEach((b) => { b.disabled = false; });
  }
}

function person(who, title) {
  return fieldset(title,
    h('div', { class: 'ua-grid2' },
      field('Nama panggilan *', `couple.${who}.nickname`, { max: 40, placeholder: who === 'groom' ? 'mis. Rizky' : 'mis. Nadia' }),
      field('Nama lengkap & gelar', `couple.${who}.fullName`, { max: 80 })),
    h('div', { class: 'ua-grid2' },
      field('Anak ke berapa', `couple.${who}.childOrder`, { max: 40, placeholder: who === 'groom' ? 'Putra pertama dari' : 'Putri kedua dari' }),
      field('Instagram (tanpa @, boleh dikosongkan)', `couple.${who}.instagram`, { max: 30, placeholder: 'username' })),
    h('div', { class: 'ua-grid2' },
      field('Nama ayah', `couple.${who}.father`, { max: 80, placeholder: 'Bapak …' }),
      field('Nama ibu', `couple.${who}.mother`, { max: 80, placeholder: 'Ibu …' })),
    photoField('Foto (bingkai oval)', `couple.${who}.photo`, 'Foto tegak/potret paling bagus. Kosong = tampil inisial nama.'));
}

function render() {
  const root = $('ufForm');
  $('ufState').hidden = true;
  root.hidden = false;
  root.replaceChildren(...[
    h('div', { class: 'uf-intro' },
      h('h1', { text: 'Isi Data Undangan Anda' }),
      h('p', { class: 'ua-muted', text: 'Lengkapi data di bawah ini. Anda boleh menyimpan draft dan melanjutkannya kapan saja lewat link yang sama. Setelah selesai, tekan "Kirim ke dy.florist". Data hanya dipakai untuk membuat undangan Anda.' })),
    submitted ? h('div', { class: 'ua-note ok' }, h('strong', { text: 'Data sudah terkirim. ' }), 'Tim dy.florist akan memeriksa dan membuatkan undangannya. Anda masih bisa mengubah isian lalu mengirim ulang selama belum kami proses.') : null,
    person('groom', 'Mempelai Pria'),
    person('bride', 'Mempelai Wanita'),
    fieldset('Acara *',
      h('p', { class: 'ua-muted small', text: 'Isi tanggal dan jam tiap acara (akad, resepsi, dll.). Hapus acara yang tidak ada.' }),
      repeater({ path: 'events', max: 4, addLabel: '+ Tambah acara', empty: 'Belum ada acara.', item: () => ({ title: '', startIso: '', endIso: '', venueName: '', address: '', mapsUrl: '' }), render: (ev) => eventEditor(ev) })),
    fieldset('Kisah Cinta (boleh dikosongkan)',
      repeater({
        path: 'story', max: 8, addLabel: '+ Tambah kisah', empty: 'Kosong = bagian Love Story tidak ditampilkan.',
        item: () => ({ period: '', title: '', body: '' }),
        render: (s) => h('div', { class: 'ua-form' },
          h('div', { class: 'ua-grid2' }, itemInput(s, 'period', 'Waktu', { max: 30, placeholder: '2021 / Februari 2023' }), itemInput(s, 'title', 'Judul', { max: 80, placeholder: 'Awal Bertemu' })),
          itemInput(s, 'body', 'Cerita', { type: 'textarea', rows: 3, max: 1200 })),
      })),
    fieldset('Foto',
      h('div', { class: 'ua-grid3' },
        photoField('Foto sampul', 'photos.cover', 'Foto utama, tampil penuh di sampul undangan.'),
        photoField('Foto kartu ayat', 'photos.couple', 'Foto berdua. Kosong = pakai foto sampul.'),
        photoField('Foto penutup', 'photos.closing', 'Kosong = pakai foto sampul.')),
      h('span', { class: 'ua-photo-label', text: 'Galeri (maksimal 12 foto)' }),
      galleryField()),
    fieldset('Amplop Digital (boleh dikosongkan)',
      field('Kalimat pengantar', 'gifts.note', { type: 'textarea', rows: 2, max: 400, placeholder: 'Kosong = kalimat bawaan' }),
      repeater({
        path: 'gifts.accounts', max: 4, addLabel: '+ Tambah rekening / e-wallet', empty: 'Kosong = bagian amplop digital tidak ditampilkan.',
        item: () => ({ bank: '', number: '', name: '' }),
        render: (a) => h('div', { class: 'ua-grid3' }, itemInput(a, 'bank', 'Bank / e-wallet', { max: 40, placeholder: 'BCA / DANA' }), itemInput(a, 'number', 'Nomor', { max: 40, inputmode: 'numeric' }), itemInput(a, 'name', 'Atas nama', { max: 80 })),
      }),
      field('Alamat kirim kado (opsional)', 'gifts.address', { type: 'textarea', rows: 2, max: 200 })),
    fieldset('Penutup',
      field('Keluarga yang berbahagia', 'closing.family', { type: 'textarea', rows: 2, max: 200, placeholder: 'Keluarga Besar Bapak … & Keluarga Besar Bapak …' })),
    h('div', { class: 'ua-savebar' },
      h('span', { class: 'ua-save-state', id: 'ufSaveState', text: dirty ? 'Belum disimpan' : 'Tersimpan' }),
      h('button', { type: 'button', class: 'ua-btn ghost', text: 'Simpan draft', onclick: () => save(false) }),
      h('button', { type: 'button', class: 'ua-btn gold', text: submitted ? 'Kirim ulang' : 'Kirim ke dy.florist', onclick: () => save(true) })),
  ].filter(Boolean));
}

(async () => {
  if (!token) { showMessage('Link tidak valid', 'Mohon buka formulir dari link yang dikirim dy.florist.'); return; }
  try {
    const out = await api(`/intake/${token}`);
    if (!out.editable) {
      showMessage(out.status === 'applied' ? 'Data sudah diterapkan' : 'Formulir sudah ditutup',
        out.status === 'applied'
          ? 'Terima kasih, data Anda sudah kami masukkan ke undangan. Bila ada yang ingin diubah, hubungi dy.florist lewat WhatsApp.'
          : 'Formulir ini tidak menerima isian lagi. Hubungi dy.florist lewat WhatsApp bila ada yang ingin diubah.');
      return;
    }
    D = out.data;
    submitted = out.status === 'submitted';
    render();
  } catch (e) {
    showMessage('Formulir tidak ditemukan', e.status === 429 ? e.message : 'Link formulir tidak valid atau sudah tidak berlaku. Mohon minta link baru ke dy.florist.');
  }
})();
