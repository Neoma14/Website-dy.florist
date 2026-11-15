/**
 * Komponen isian undangan yang dipakai bersama oleh dasbor Admin Undangan dan formulir pelanggan.
 * Semua teks ditulis lewat textContent/value (tanpa innerHTML), tanpa handler inline (CSP).
 */

export function h(tag, attrs = {}, ...children) {
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
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ZONES = { WIB: '+07:00', WITA: '+08:00', WIT: '+09:00' };

// Ambil/ubah nilai bertingkat, mis. getPath(d, 'couple.groom.nickname')
export const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o, p, v) {
  const ks = p.split('.');
  const last = ks.pop();
  const target = ks.reduce((a, k) => (a[k] ??= {}), o);
  target[last] = v;
}

// Perkecil foto besar di browser sebelum diunggah (batas server 4 MB)
export async function shrinkImage(file) {
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

// Acara: tanggal + jam + zona waktu -> startIso/endIso + label otomatis
export function parseIso(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2})$/.exec(iso || '');
  if (!m) return { date: '', time: '', zone: 'WIB' };
  return { date: m[1], time: m[2], zone: Object.entries(ZONES).find(([, o]) => o === m[3])?.[0] || 'WIB' };
}

/**
 * Membuat komponen isian untuk satu objek data.
 * @param getData      fungsi yang mengembalikan objek data yang sedang diedit
 * @param onChange     dipanggil tiap ada perubahan (menandai "belum disimpan")
 * @param toast        fungsi menampilkan pesan singkat
 * @param uploadImage  async (File) => url foto yang tersimpan di server
 */
export function createKit({ getData, onChange, toast, uploadImage }) {
  function field(label, path, { type = 'text', max, rows, placeholder, help, inputmode } = {}) {
    const input = type === 'textarea'
      ? h('textarea', { rows: String(rows || 3), maxlength: max ? String(max) : null, placeholder })
      : h('input', { type, maxlength: max ? String(max) : null, placeholder, inputmode });
    input.value = getPath(getData(), path) ?? '';
    input.addEventListener('input', () => { setPath(getData(), path, input.value); onChange(); });
    return h('label', {}, label, input, help ? h('small', { text: help }) : null);
  }

  function photoField(label, path, help) {
    const wrap = h('div', { class: 'ua-photo' });
    const draw = () => {
      const url = getPath(getData(), path) || '';
      const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
      const pick = h('button', { type: 'button', class: 'ua-btn ghost small', text: url ? 'Ganti foto' : 'Unggah foto', onclick: () => input.click() });
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        pick.disabled = true;
        pick.textContent = 'Mengunggah…';
        try {
          setPath(getData(), path, await uploadImage(file));
          onChange();
          toast('Foto terunggah');
        } catch (e) { toast(e.message); }
        draw();
      });
      wrap.replaceChildren(
        h('span', { class: 'ua-photo-label', text: label }),
        h('div', { class: 'ua-photo-box' }, url ? h('img', { src: url, alt: '' }) : h('span', { text: 'Belum ada foto' })),
        h('div', { class: 'ua-row' }, pick,
          url ? h('button', { type: 'button', class: 'ua-btn ghost small', text: 'Hapus', onclick: () => { setPath(getData(), path, ''); onChange(); draw(); } }) : null),
        help ? h('small', { text: help }) : null,
        input);
    };
    draw();
    return wrap;
  }

  function fieldset(title, ...children) {
    return h('details', { class: 'ua-fieldset', open: true }, h('summary', { text: title }), h('div', { class: 'ua-fieldset-body' }, ...children));
  }

  // Daftar berulang (acara, kisah, rekening)
  function repeater({ path, max, addLabel, empty, item, render }) {
    const box = h('div', { class: 'ua-repeat' });
    const draw = () => {
      const list = getPath(getData(), path) || [];
      const rows = list.map((it, i) => h('div', { class: 'ua-repeat-item' },
        h('div', { class: 'ua-repeat-head' },
          h('strong', { text: `#${i + 1}` }),
          h('div', { class: 'ua-row' },
            i > 0 ? h('button', { type: 'button', class: 'ua-icon', title: 'Naikkan', 'aria-label': 'Naikkan', text: '↑', onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; onChange(); draw(); } }) : null,
            h('button', { type: 'button', class: 'ua-icon danger', title: 'Hapus', 'aria-label': 'Hapus', text: '✕', onclick: () => { list.splice(i, 1); onChange(); draw(); } }))),
        render(it, i, draw)));
      box.replaceChildren(
        ...(rows.length ? rows : [h('p', { class: 'ua-muted small', text: empty })]),
        list.length < max ? h('button', { type: 'button', class: 'ua-btn ghost small', text: addLabel, onclick: () => { setPath(getData(), path, [...list, item()]); onChange(); draw(); } }) : null);
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
    input.addEventListener('input', () => { obj[key] = input.value; onChange(); opts.onchange?.(); });
    return h('label', {}, label, input, opts.help ? h('small', { text: opts.help }) : null);
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
    for (const el of [date, start, end, zone]) el.addEventListener('change', () => { apply(); onChange(); });
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

  function galleryField() {
    const box = h('div', { class: 'ua-gallery' });
    const draw = () => {
      const list = getData().photos.gallery;
      const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true });
      input.addEventListener('change', async () => {
        const files = [...(input.files || [])].slice(0, 12 - list.length);
        for (const f of files) {
          try { list.push(await uploadImage(f)); onChange(); } catch (e) { toast(e.message); }
        }
        if (files.length) toast('Foto galeri terunggah');
        draw();
      });
      box.replaceChildren(
        ...list.map((url, i) => h('div', { class: 'ua-thumb' }, h('img', { src: url, alt: '' }),
          h('button', { type: 'button', class: 'ua-icon danger', 'aria-label': 'Hapus foto', text: '✕', onclick: () => { list.splice(i, 1); onChange(); draw(); } }))),
        list.length < 12 ? h('button', { type: 'button', class: 'ua-thumb add', text: `+ Tambah foto (${list.length}/12)`, onclick: () => input.click() }) : null,
        input);
    };
    draw();
    return box;
  }

  return { field, photoField, fieldset, repeater, itemInput, eventEditor, galleryField };
}
