/**
 * dy.florist — Modern Boutique Web Application
 * Florist • Gift • Craft • Dekorasi
 */

// ==========================================
// 0. UTILITIES: escaping, API client, URL gambar aman
// ==========================================
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Hanya gambar dari aset situs, upload lokal (dev), atau Vercel Blob yang boleh tampil
const SAFE_IMAGE = /^(\/assets\/[\w.-]+|\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/products\/[\w.-]+)$/;
function safeImg(url) {
  return SAFE_IMAGE.test(String(url)) ? url : '/assets/bouquet.jpg';
}

async function api(path, { method = 'GET', json, form } = {}) {
  const headers = {};
  let body;
  if (method !== 'GET') headers['X-Requested-With'] = 'dyflorist';
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (form) body = form;
  const res = await fetch('/api' + path, { method, headers, body, credentials: 'same-origin' });
  let data = null;
  try { data = await res.json(); } catch (e) { /* bukan JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Terjadi kesalahan, coba lagi.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ==========================================
// 1. PRODUK (diambil dari server)
// ==========================================
let PRODUCTS = [];
let productsError = false;
let CATEGORIES = []; // { key, name, emoji } dari server

async function loadCategories() {
  try {
    CATEGORIES = await api('/categories');
  } catch (e) {
    CATEGORIES = [];
  }
}

const categoryLabel = (c) => (c.emoji ? c.emoji + ' ' : '') + c.name;

// Tab katalog dibangun dari daftar kategori di server
function renderCategoryTabs() {
  const wrap = document.getElementById('filterTabs');
  if (!wrap) return;
  const tabs = [{ key: 'all', label: 'Semua Produk' }, ...CATEGORIES.map(c => ({ key: c.key, label: categoryLabel(c) }))];
  if (!tabs.some(t => t.key === activeFilter)) activeFilter = 'all';
  wrap.innerHTML = tabs.map(t => `
    <button class="tab-btn${t.key === activeFilter ? ' active' : ''}" data-filter="${esc(t.key)}" data-click="selectCategory('${esc(t.key)}')">${esc(t.label)}</button>
  `).join('');
}

// Isi pilihan kategori di form produk dan filter admin
function populateCategorySelects() {
  const form = document.getElementById('prodCategory');
  if (form) {
    const current = form.value;
    form.innerHTML = CATEGORIES.map(c => `<option value="${esc(c.key)}">${esc(categoryLabel(c))}</option>`).join('');
    if (CATEGORIES.some(c => c.key === current)) form.value = current;
  }
  const filter = document.getElementById('adminCategoryFilter');
  if (filter) {
    const current = filter.value;
    filter.innerHTML = '<option value="all">Semua Kategori</option>' +
      CATEGORIES.map(c => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('');
    filter.value = CATEGORIES.some(c => c.key === current) ? current : 'all';
  }
}

window.selectCategory = function(key) {
  activeFilter = key;
  document.querySelectorAll('.tab-btn').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-filter') === key);
  });
  renderCatalog();
};

async function loadProducts() {
  try {
    PRODUCTS = await api('/products');
    productsError = false;
  } catch (e) {
    productsError = true;
  }
  syncCartWithProducts();
}

// Samakan nama/harga/foto isi keranjang dengan data terbaru; buang produk yang sudah tidak ada
function syncCartWithProducts() {
  if (productsError) return;
  const byId = new Map(PRODUCTS.map(p => [p.id, p]));
  cart = cart.filter(i => byId.has(i.id)).map(i => {
    const p = byId.get(i.id);
    return { ...i, name: p.name, price: p.price, image: p.image };
  });
  saveCart();
}

// Baca keranjang dari localStorage dengan validasi bentuk data
function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem('dy_florist_cart'));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(i => i && typeof i.id === 'string' && Number.isInteger(i.quantity) && i.quantity > 0)
      .map(i => ({
        id: i.id.slice(0, 40),
        name: String(i.name ?? '').slice(0, 120),
        price: Number.isFinite(i.price) ? i.price : 0,
        image: String(i.image ?? ''),
        quantity: Math.min(i.quantity, 50)
      }));
  } catch (e) {
    return [];
  }
}

// ==========================================
// Pengganti atribut onclick/onchange inline (agar CSP bisa memblokir skrip inline)
// ==========================================
const ALLOWED_ACTIONS = new Set([
  'filterCatalog', 'resetFilters', 'switchAdminTab', 'startEditProduct', 'deleteProduct', 'removeFromCart',
  'changeCartQty', 'openQuickView', 'openAdminModal', 'handleAdminLogout', 'clearOrdersLog', 'cancelEditProduct',
  'addToCart', 'closeQuickView', 'closeCart', 'goCatalog', 'handleProductImageUpload', 'filterAdminProducts',
  'saveAdminProduct', 'handleAdminLogin', 'selectCategory', 'saveAdminCategory', 'startEditCategory',
  'cancelEditCategory', 'deleteCategory'
]);

function runActions(spec, el) {
  spec.split(';').map(s => s.trim()).filter(Boolean).forEach(stmt => {
    const m = /^([A-Za-z_]\w*)\((.*)\)$/.exec(stmt);
    if (!m || !ALLOWED_ACTIONS.has(m[1]) || typeof window[m[1]] !== 'function') return;
    const args = m[2].trim() === '' ? [] : m[2].split(',').map(a => {
      a = a.trim();
      if (a === 'this') return el;
      if (/^'.*'$/.test(a)) return a.slice(1, -1);
      const n = Number(a);
      return Number.isNaN(n) ? a : n;
    });
    window[m[1]](...args);
  });
}

['click', 'submit', 'input', 'change'].forEach(type => {
  document.addEventListener(type, ev => {
    const el = ev.target && ev.target.closest ? ev.target.closest(`[data-${type}]`) : null;
    if (!el) return;
    if (type === 'submit') ev.preventDefault();
    runActions(el.getAttribute(`data-${type}`), el);
  });
});

// Foto gagal dimuat -> pakai foto cadangan
document.addEventListener('error', ev => {
  const el = ev.target;
  if (el && el.tagName === 'IMG' && el.dataset.fallback && !el.dataset.fallbackUsed) {
    el.dataset.fallbackUsed = '1';
    el.src = el.dataset.fallback;
  }
}, true);

window.goCatalog = function() {
  location.href = '#catalog';
};

// WhatsApp Official Numbers
const WA_PHONE_NUMBER = '6288267108077'; // Pesan via WhatsApp
const WA_CS_NUMBER = '6287871897450';    // Layanan Pelanggan

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
let cart = loadCart();
let activeFilter = 'all';
let searchQuery = '';


// ==========================================
// 3. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const gridEl = document.getElementById('productsGrid');
  if (gridEl) gridEl.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--color-text-muted);">Memuat produk...</p>';
  Promise.all([loadCategories(), loadProducts()]).then(() => {
    renderCategoryTabs();
    populateCategorySelects();
    if (productsError && gridEl) {
      gridEl.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--color-text-muted);">Produk gagal dimuat. Silakan muat ulang halaman.</p>';
    } else {
      renderCatalog();
    }
    // Jika admin sudah terbuka (alamat /admin) sebelum produk selesai dimuat, segarkan tabelnya
    if (isAdminLoggedIn) {
      renderAdminProductsTable();
      renderAdminCategories();
      updateAdminBadges();
    }
  });
  setupSearch();
  setupCustomizer();
  setupCartDrawer();
  setupModals();
  setupFAQ();
  setupHeaderScroll();
  setupMobileMenu();
  setupAdmin();
  updateCartBadge();
});

// Format Currency Utility
function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

// ==========================================
// 4. CATALOG RENDERING & FILTERING
// ==========================================
// Pesan untuk kategori yang masih kosong (teks tetap, bukan data pengguna)
const CATEGORY_EMPTY_INFO = {
  dekorasi: {
    icon: '🎊',
    text: 'Dekorasi lamaran, wedding car, ulang tahun, dan acara lainnya. Konsultasikan konsep Anda bersama kami.',
    wa: 'Halo dy.florist, saya ingin konsultasi dekorasi acara',
    btn: 'Konsultasi Dekorasi via WhatsApp'
  },
  undangan: {
    icon: '💌',
    text: 'Undangan digital untuk pernikahan, ulang tahun, dan acara spesial lainnya. Konsultasikan desainnya bersama kami.',
    wa: 'Halo dy.florist, saya ingin konsultasi undangan digital',
    btn: 'Konsultasi Undangan Digital via WhatsApp'
  },
  lainnya: {
    icon: '✨',
    text: 'Butuh layanan lain? Ceritakan kebutuhan Anda, kami bantu wujudkan.',
    wa: 'Halo dy.florist, saya ingin menanyakan layanan lainnya',
    btn: 'Tanya Layanan via WhatsApp'
  }
};

function renderCatalog() {
  const grid = document.getElementById('productsGrid');
  const emptyState = document.getElementById('catalogEmpty');
  if (!grid) return;

  // Kategori yang belum punya produk: ajak pengunjung berkonsultasi lewat WhatsApp
  if (activeFilter !== 'all' && !PRODUCTS.some(p => p.category === activeFilter)) {
    const catName = (CATEGORIES.find(c => c.key === activeFilter) || {}).name || 'ini';
    const info = CATEGORY_EMPTY_INFO[activeFilter] || {
      icon: '🌸',
      text: 'Produk kategori ' + esc(catName) + ' segera hadir. Hubungi kami untuk pemesanan custom.',
      wa: 'Halo dy.florist, saya ingin menanyakan produk yang tersedia',
      btn: 'Tanya via WhatsApp'
    };
    if (emptyState) emptyState.style.display = 'none';
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px;">
      <p style="color: var(--color-text-muted); margin-bottom: 16px;">${info.icon} ${info.text}</p>
      <a class="btn btn-primary" href="https://wa.me/${WA_PHONE_NUMBER}?text=${encodeURIComponent(info.wa)}" target="_blank" rel="noopener noreferrer">${info.btn}</a>
    </div>`;
    return;
  }

  const filtered = PRODUCTS.filter(p => {
    const matchesCategory = activeFilter === 'all' || p.category === activeFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  grid.innerHTML = filtered.map(item => `
    <article class="product-card" data-id="${esc(item.id)}">
      <span class="product-badge-tag">${esc(item.badge)}</span>
      <div class="product-img-wrap">
        <img src="${esc(safeImg(item.image))}" alt="${esc(item.name)}" loading="lazy">
        <button class="product-quick-view-btn" data-click="openQuickView('${esc(item.id)}')">
          Detail Produk 👁️
        </button>
      </div>
      <div class="product-info">
        <div class="product-category-meta">${esc(item.categoryName)}</div>
        <h3 class="product-title">${esc(item.name)}</h3>
        <div class="product-rating">
          ★★★★★ <span>(${item.reviews})</span>
        </div>
        <div class="product-price-row">
          <span class="product-price">${formatIDR(item.price)}</span>
          <button class="add-cart-icon-btn" data-click="addToCart('${esc(item.id)}')" title="Tambah ke Keranjang" aria-label="Tambah ${esc(item.name)} ke Keranjang">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderCatalog();
  });
}

// Global filter helper for header/pillar cards
window.filterCatalog = function(categoryKey) {
  activeFilter = categoryKey;
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    if (tab.getAttribute('data-filter') === categoryKey) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const catalogElem = document.getElementById('catalog');
  if (catalogElem) {
    catalogElem.scrollIntoView({ behavior: 'smooth' });
  }
  renderCatalog();
};

window.resetFilters = function() {
  activeFilter = 'all';
  searchQuery = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  filterCatalog('all');
};

// ==========================================
// 5. BESPOKE STUDIO (CUSTOMIZER)
// ==========================================
// Harga dasar hanya ada untuk jenis yang sudah punya harga; jenis lain ditentukan lewat konsultasi.
const CUSTOM_TYPES = [
  { id: 'hand_bouquet', name: 'Hand Bouquet (Buket)', emoji: '💐', price: 280000 },
  { id: 'table', name: 'Table Arrangement', emoji: '🌼', price: null },
  { id: 'standing', name: 'Standing Flower', emoji: '🌺', price: null },
  { id: 'board', name: 'Bunga Papan (Flower Board)', emoji: '🖼️', price: null },
  { id: 'parcel', name: 'Parcel', emoji: '🧺', price: null },
  { id: 'gift_craft', name: 'Gift Craft & Hampers', emoji: '🎁', price: 490000 },
  { id: 'dekorasi', name: 'Dekorasi', emoji: '🎊', price: null },
  { id: 'undangan', name: 'Undangan Digital', emoji: '💌', price: null },
  { id: 'seserahan', name: 'Seserahan', emoji: '🎀', price: null },
  { id: 'lainnya', name: 'Lainnya (Request Khusus)', emoji: '✨', price: null }
];

const CUSTOM_COLORS = [
  { name: 'Magenta Rose', hex: '#E4007F' },
  { name: 'Pink Blush', hex: '#F8B4C8' },
  { name: 'Soft Pink', hex: '#FFD6E0' },
  { name: 'Merah Cherry', hex: '#D7263D' },
  { name: 'Burgundy', hex: '#7B1E3A' },
  { name: 'Peach', hex: '#FFB38A' },
  { name: 'Orange Sunset', hex: '#FF8C42' },
  { name: 'Kuning Butter', hex: '#FFD93D' },
  { name: 'Cream Ivory', hex: '#FFF1D6' },
  { name: 'Putih Pearl', hex: '#FFFFFF' },
  { name: 'Mint Fresh', hex: '#A8E6CF' },
  { name: 'Hijau Sage', hex: '#8FB996' },
  { name: 'Sky Blue', hex: '#8EC9FF' },
  { name: 'Royal Blue', hex: '#3F6FD8' },
  { name: 'Lilac Purple', hex: '#C8A2C8' },
  { name: 'Deep Purple', hex: '#7B2CBF' },
  { name: 'Champagne Gold', hex: '#D4AF37' },
  { name: 'Hitam Elegan', hex: '#2B2B2B' }
];

const customizerState = {
  type: CUSTOM_TYPES[0],
  color: CUSTOM_COLORS[0],
  addons: [],
  recipient: '',
  cardMessage: ''
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function mixHex(hex, other, ratio) {
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const a = rgb(hex);
  const b = rgb(other);
  return '#' + a.map((v, i) => Math.round(v * (1 - ratio) + b[i] * ratio).toString(16).padStart(2, '0')).join('');
}

// ---------- Ilustrasi pratinjau (SVG; warna mengikuti CSS variable) ----------
const SV = {
  bloom(cx, cy, r) {
    const petals = [0, 72, 144, 216, 288].map((a) => {
      const rad = (a - 90) * Math.PI / 180;
      const x = (cx + Math.cos(rad) * r * 0.62).toFixed(1);
      const y = (cy + Math.sin(rad) * r * 0.62).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="${(r * 0.52).toFixed(1)}" fill="var(--c)" stroke="var(--c-ln)" stroke-width="1.6"/>`;
    }).join('');
    return `<g>${petals}<circle cx="${cx}" cy="${cy}" r="${(r * 0.36).toFixed(1)}" fill="var(--c-l)" stroke="var(--c-ln)" stroke-width="1.6"/></g>`;
  },
  leaf(x, y, rot, len = 44) {
    return `<ellipse cx="${x}" cy="${y}" rx="${(len * 0.26).toFixed(1)}" ry="${(len / 2).toFixed(1)}" transform="rotate(${rot} ${x} ${y})" fill="#86BD84" stroke="#4F8F55" stroke-width="1.4"/>`;
  },
  bow(cx, cy, s = 1, fill = 'var(--c)') {
    const w = 34 * s;
    const h = 20 * s;
    return `<g><ellipse cx="${cx - w * 0.85}" cy="${cy}" rx="${w}" ry="${h}" transform="rotate(-22 ${cx - w * 0.85} ${cy})" fill="${fill}" stroke="var(--c-ln)" stroke-width="1.8"/>` +
      `<ellipse cx="${cx + w * 0.85}" cy="${cy}" rx="${w}" ry="${h}" transform="rotate(22 ${cx + w * 0.85} ${cy})" fill="${fill}" stroke="var(--c-ln)" stroke-width="1.8"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${(11 * s).toFixed(1)}" fill="var(--c-d)" stroke="var(--c-ln)" stroke-width="1.8"/></g>`;
  },
  star(cx, cy, R, r, fill = 'var(--c)') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = (i * 36 - 90) * Math.PI / 180;
      const rr = i % 2 === 0 ? R : r;
      pts.push(`${(cx + Math.cos(rad) * rr).toFixed(1)},${(cy + Math.sin(rad) * rr).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="var(--c-ln)" stroke-width="1.8" stroke-linejoin="round"/>`;
  },
  shadow(cx = 200, cy = 362, rx = 125) {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="11" fill="rgba(0,0,0,0.09)"/>`;
  }
};

const SCENES = {
  hand_bouquet: () => SV.shadow() +
    SV.leaf(135, 175, -55, 70) + SV.leaf(265, 175, 55, 70) + SV.leaf(200, 120, 0, 78) +
    '<polygon points="105,200 295,200 228,352 172,352" fill="#F7E9DC" stroke="#C9AE98" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M150 205 L190 350 M250 205 L210 350" stroke="#E2CFBE" stroke-width="3" fill="none"/>' +
    SV.bloom(200, 130, 36) + SV.bloom(150, 165, 33) + SV.bloom(250, 165, 33) +
    SV.bloom(170, 110, 28) + SV.bloom(230, 110, 28) + SV.bloom(200, 190, 31) +
    '<polygon points="200,300 178,356 200,342 222,356" fill="var(--c-d)" stroke="var(--c-ln)" stroke-width="1.8" stroke-linejoin="round"/>' +
    SV.bow(200, 292, 0.95),

  table: () => SV.shadow(200, 352, 150) +
    '<rect x="40" y="330" width="320" height="16" rx="6" fill="#EAD9C8" stroke="#C9AE98" stroke-width="2.5"/>' +
    SV.leaf(120, 232, -75, 54) + SV.leaf(280, 232, 75, 54) + SV.leaf(155, 215, -35, 60) + SV.leaf(245, 215, 35, 60) +
    SV.bloom(200, 140, 31) +
    SV.bloom(165, 172, 33) + SV.bloom(235, 172, 33) +
    SV.bloom(128, 208, 30) + SV.bloom(200, 205, 35) + SV.bloom(272, 208, 30) +
    '<path d="M108 252 Q108 330 200 330 Q292 330 292 252 Z" fill="#FFFFFF" stroke="#CFC4BE" stroke-width="3"/>' +
    '<ellipse cx="200" cy="252" rx="92" ry="14" fill="#F3ECE8" stroke="#CFC4BE" stroke-width="3"/>' +
    '<path d="M130 285 Q200 312 270 285" stroke="var(--c)" stroke-width="6" fill="none" stroke-linecap="round"/>',

  standing: () => SV.shadow(200, 360, 130) +
    '<g stroke="#9B7B63" stroke-width="7" stroke-linecap="round" fill="none"><path d="M200 130 L138 352"/><path d="M200 130 L262 352"/><path d="M200 130 L200 352"/><path d="M165 262 L235 262"/></g>' +
    SV.leaf(100, 125, -60, 62) + SV.leaf(300, 125, 60, 62) + SV.leaf(200, 48, 0, 52) + SV.leaf(150, 190, -35, 52) + SV.leaf(250, 190, 35, 52) +
    SV.bloom(200, 92, 36) + SV.bloom(155, 108, 34) + SV.bloom(245, 108, 34) +
    SV.bloom(122, 142, 31) + SV.bloom(278, 142, 31) + SV.bloom(165, 152, 36) + SV.bloom(235, 152, 36) +
    SV.bloom(200, 128, 38) + SV.bloom(200, 186, 30) +
    '<path d="M118 210 Q200 246 282 210" stroke="var(--c-d)" stroke-width="9" fill="none" stroke-linecap="round"/>',

  board: () => SV.shadow(200, 358, 140) +
    '<g stroke="#9B7B63" stroke-width="7" stroke-linecap="round" fill="none"><path d="M110 250 L88 350"/><path d="M290 250 L312 350"/><path d="M104 300 L296 300"/></g>' +
    '<rect x="62" y="78" width="276" height="176" rx="10" fill="#FFFFFF" stroke="var(--c-ln)" stroke-width="3.5"/>' +
    '<rect x="76" y="92" width="248" height="148" rx="6" fill="none" stroke="var(--c)" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>' +
    '<text x="200" y="158" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="var(--c-d)">Selamat &amp; Sukses</text>' +
    '<text x="200" y="190" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="var(--c-ln)">Semoga bahagia selalu</text>' +
    SV.leaf(72, 100, -40, 50) + SV.leaf(330, 100, 40, 50) + SV.leaf(60, 244, 30, 44) + SV.leaf(340, 244, -30, 44) +
    SV.bloom(92, 96, 28) + SV.bloom(128, 84, 22) + SV.bloom(308, 96, 28) + SV.bloom(272, 84, 22) +
    SV.bloom(78, 236, 24) + SV.bloom(322, 236, 24) +
    SV.bloom(130, 252, 20) + SV.bloom(165, 258, 22) + SV.bloom(200, 262, 24) + SV.bloom(235, 258, 22) + SV.bloom(270, 252, 20),

  parcel: () => SV.shadow(200, 358, 130) +
    '<path d="M128 245 Q200 70 272 245" fill="none" stroke="#A98259" stroke-width="9" stroke-linecap="round"/>' +
    '<rect x="122" y="150" width="30" height="100" rx="12" fill="var(--c-l)" stroke="var(--c-ln)" stroke-width="2.5"/>' +
    '<rect x="246" y="168" width="38" height="82" rx="9" fill="var(--c-d)" stroke="var(--c-ln)" stroke-width="2.5"/>' +
    '<rect x="166" y="188" width="70" height="62" rx="6" fill="#FFFFFF" stroke="var(--c-ln)" stroke-width="2.5"/>' +
    '<rect x="194" y="188" width="14" height="62" fill="var(--c)"/><rect x="166" y="212" width="70" height="12" fill="var(--c)"/>' +
    SV.leaf(160, 175, -30, 50) + SV.leaf(244, 168, 30, 50) + SV.bloom(200, 160, 26) +
    '<path d="M92 240 Q200 66 308 240" fill="rgba(255,255,255,0.32)" stroke="rgba(255,255,255,0.9)" stroke-width="3"/>' +
    '<path d="M95 240 L305 240 L285 345 L115 345 Z" fill="#D9B88F" stroke="#A98259" stroke-width="3" stroke-linejoin="round"/>' +
    '<g stroke="#B99468" stroke-width="2.5" fill="none"><path d="M99 264 H301"/><path d="M104 290 H296"/><path d="M109 316 H291"/><path d="M135 242 L128 344 M175 242 L172 344 M215 242 L214 344 M255 242 L258 344"/></g>' +
    SV.bow(200, 105, 0.8),

  gift_craft: () => SV.shadow(200, 358, 135) +
    '<rect x="98" y="192" width="204" height="150" rx="9" fill="var(--c-l)" stroke="var(--c-ln)" stroke-width="3.5"/>' +
    '<rect x="186" y="192" width="28" height="150" fill="var(--c-d)" opacity="0.92"/>' +
    '<rect x="98" y="262" width="204" height="22" fill="var(--c-d)" opacity="0.92"/>' +
    '<rect x="86" y="158" width="228" height="46" rx="9" fill="var(--c)" stroke="var(--c-ln)" stroke-width="3.5"/>' +
    '<rect x="186" y="158" width="28" height="46" fill="var(--c-d)" opacity="0.92"/>' +
    SV.bow(200, 138, 1.05) +
    '<text x="82" y="116" font-size="26" fill="var(--c)">✦</text><text x="304" y="124" font-size="22" fill="var(--c-d)">✦</text><text x="318" y="92" font-size="14" fill="var(--c)">✦</text>',

  dekorasi: () => SV.shadow(200, 360, 150) +
    '<path d="M108 345 L108 190 Q108 66 200 66 Q292 66 292 190 L292 345" fill="none" stroke="#CDB8A5" stroke-width="11" stroke-linecap="round"/>' +
    '<g fill="#FFE9A8" stroke="#E2C25C" stroke-width="1.5"><circle cx="150" cy="118" r="4"/><circle cx="178" cy="104" r="4"/><circle cx="206" cy="100" r="4"/><circle cx="234" cy="106" r="4"/><circle cx="260" cy="122" r="4"/></g>' +
    [[112, 318], [112, 262], [112, 206], [128, 150], [158, 104], [200, 84], [242, 104], [272, 150], [288, 206], [288, 262], [288, 318]]
      .map((p, i) => SV.leaf(p[0] + (i % 2 ? 14 : -14), p[1] + 6, i % 2 ? 40 : -40, 40)).join('') +
    [[112, 318, 20], [112, 262, 18], [112, 206, 22], [128, 150, 18], [158, 104, 21], [200, 84, 24], [242, 104, 21], [272, 150, 18], [288, 206, 22], [288, 262, 18], [288, 318, 20]]
      .map((p) => SV.bloom(p[0], p[1], p[2])).join('') +
    SV.bloom(60, 330, 20) + SV.bloom(340, 330, 20) + SV.leaf(76, 322, 50, 36) + SV.leaf(324, 322, -50, 36),

  undangan: () => SV.shadow(200, 366, 100) +
    '<rect x="116" y="42" width="168" height="318" rx="28" fill="#FFFFFF" stroke="#4A4A4A" stroke-width="6"/>' +
    '<rect x="176" y="52" width="48" height="8" rx="4" fill="#4A4A4A"/>' +
    '<rect x="130" y="72" width="140" height="272" rx="14" fill="var(--c-l)"/>' +
    '<rect x="144" y="92" width="112" height="206" rx="10" fill="#FFFFFF" stroke="var(--c-ln)" stroke-width="2.5"/>' +
    '<path d="M200 178 C200 178 168 158 168 140 C168 126 187 122 200 140 C213 122 232 126 232 140 C232 158 200 178 200 178 Z" fill="var(--c)" stroke="var(--c-ln)" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<text x="200" y="208" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-weight="700" fill="var(--c-ln)">The Wedding</text>' +
    '<rect x="166" y="222" width="68" height="6" rx="3" fill="var(--c-ln)" opacity="0.55"/><rect x="176" y="238" width="48" height="6" rx="3" fill="var(--c-ln)" opacity="0.4"/><rect x="170" y="254" width="60" height="6" rx="3" fill="var(--c-ln)" opacity="0.4"/>' +
    SV.leaf(156, 106, -50, 30) + SV.bloom(160, 106, 15) + SV.leaf(244, 106, 50, 30) + SV.bloom(240, 106, 15) +
    '<rect x="162" y="308" width="76" height="24" rx="12" fill="var(--c-ln)" stroke="var(--c-ln)" stroke-width="2"/>' +
    '<text x="200" y="325" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF">RSVP</text>',

  seserahan: () => SV.shadow(200, 352, 150) +
    '<rect x="52" y="268" width="296" height="44" rx="14" fill="#EAD7AA" stroke="#B9975B" stroke-width="3.5"/>' +
    '<path d="M64 282 H336" stroke="#C9AE70" stroke-width="2.5"/>' +
    '<rect x="78" y="186" width="84" height="84" rx="7" fill="var(--c)" stroke="var(--c-ln)" stroke-width="3"/>' +
    '<rect x="112" y="186" width="16" height="84" fill="var(--c-l)"/><rect x="78" y="220" width="84" height="16" fill="var(--c-l)"/>' +
    SV.bow(120, 178, 0.55, 'var(--c-l)') +
    '<rect x="172" y="152" width="96" height="118" rx="7" fill="var(--c-l)" stroke="var(--c-ln)" stroke-width="3"/>' +
    '<rect x="212" y="152" width="16" height="118" fill="var(--c)"/><rect x="172" y="200" width="96" height="16" fill="var(--c)"/>' +
    SV.leaf(190, 142, -35, 36) + SV.leaf(250, 142, 35, 36) + SV.bow(220, 144, 0.62) +
    '<rect x="276" y="198" width="68" height="72" rx="7" fill="var(--c-d)" stroke="var(--c-ln)" stroke-width="3"/>' +
    '<rect x="302" y="198" width="14" height="72" fill="var(--c-l)"/><rect x="276" y="226" width="68" height="14" fill="var(--c-l)"/>' +
    SV.bloom(310, 190, 17) + SV.leaf(292, 186, -40, 28),

  lainnya: () => SV.shadow(200, 366, 100) +
    SV.star(200, 194, 96, 42) + SV.star(104, 98, 34, 15, 'var(--c-l)') + SV.star(302, 118, 28, 12, 'var(--c-l)') +
    SV.star(104, 306, 24, 10, 'var(--c-d)') + SV.star(298, 300, 32, 14, 'var(--c-l)') +
    '<g fill="var(--c)" stroke="var(--c-ln)" stroke-width="1.5"><circle cx="150" cy="52" r="6"/><circle cx="262" cy="46" r="5"/><circle cx="352" cy="200" r="6"/><circle cx="48" cy="210" r="5"/><circle cx="200" cy="350" r="6"/></g>'
};

function renderCustomIllustration() {
  const box = document.getElementById('customVisualPreview');
  const art = document.getElementById('customIllustration');
  if (!box || !art) return;
  const hex = HEX_RE.test(customizerState.color.hex) ? customizerState.color.hex : '#E4007F';
  box.style.setProperty('--c', hex);
  box.style.setProperty('--c-l', mixHex(hex, '#FFFFFF', 0.5));
  box.style.setProperty('--c-d', mixHex(hex, '#000000', 0.22));
  box.style.setProperty('--c-ln', mixHex(hex, '#000000', 0.5));
  box.style.setProperty('--c-bg', mixHex(hex, '#FFFFFF', 0.86));
  const scene = SCENES[customizerState.type.id] || SCENES.lainnya;
  art.innerHTML = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${scene()}</svg>`;
  art.setAttribute('aria-label', `Ilustrasi ${customizerState.type.name} warna ${customizerState.color.name}`);
}

// ---------- Kontrol ----------
function typePriceText(t) {
  return t.price ? 'Mulai dari ' + formatIDR(t.price) : 'Harga via konsultasi';
}

function renderCustomTypes() {
  const wrap = document.getElementById('customBaseOptions');
  if (!wrap) return;
  wrap.innerHTML = CUSTOM_TYPES.map(t => `
    <button type="button" class="option-pill${t.id === customizerState.type.id ? ' active' : ''}" data-type-id="${esc(t.id)}" aria-pressed="${t.id === customizerState.type.id}">
      <span class="opt-name">${t.emoji} ${esc(t.name)}</span>
      <span class="opt-price">${esc(typePriceText(t))}</span>
    </button>
  `).join('');
}

function renderCustomColors() {
  const wrap = document.getElementById('customColorOptions');
  if (!wrap) return;
  wrap.innerHTML = CUSTOM_COLORS.map(c => `
    <button type="button" class="color-circle-btn${c.hex === customizerState.color.hex ? ' active' : ''}" data-hex="${esc(c.hex)}" title="${esc(c.name)}" aria-label="${esc(c.name)}" style="--c1: ${esc(c.hex)}; --c2: ${esc(mixHex(c.hex, '#FFFFFF', 0.35))};">
      <span></span>
    </button>
  `).join('');
}

function setCustomColor(color, fromPicker) {
  customizerState.color = color;
  document.querySelectorAll('#customColorOptions .color-circle-btn').forEach(b => {
    b.classList.toggle('active', !fromPicker && b.dataset.hex === color.hex);
  });
  const picker = document.getElementById('customColorPicker');
  const hexLabel = document.getElementById('customColorHex');
  if (picker && picker.value.toLowerCase() !== color.hex.toLowerCase()) picker.value = color.hex.toLowerCase();
  if (hexLabel) hexLabel.textContent = color.hex.toUpperCase();
  const label = document.getElementById('selectedColorLabel');
  if (label) label.innerHTML = `Warna Terpilih: <strong>${esc(color.name)}</strong>`;
  updateCustomizerSummary();
}

function setupCustomizer() {
  renderCustomTypes();
  renderCustomColors();

  // Jenis produk
  const typeWrap = document.getElementById('customBaseOptions');
  if (typeWrap) {
    typeWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type-id]');
      if (!btn) return;
      const found = CUSTOM_TYPES.find(t => t.id === btn.dataset.typeId);
      if (!found) return;
      customizerState.type = found;
      typeWrap.querySelectorAll('.option-pill').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      updateCustomizerSummary();
    });
  }

  // Palet warna
  const colorWrap = document.getElementById('customColorOptions');
  if (colorWrap) {
    colorWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-hex]');
      if (!btn) return;
      const found = CUSTOM_COLORS.find(c => c.hex === btn.dataset.hex);
      if (found) setCustomColor(found, false);
    });
  }

  // Warna pilihan sendiri
  const picker = document.getElementById('customColorPicker');
  if (picker) {
    picker.addEventListener('input', () => {
      if (!HEX_RE.test(picker.value)) return;
      setCustomColor({ name: `Warna pilihan sendiri (${picker.value.toUpperCase()})`, hex: picker.value }, true);
    });
  }

  // Add-ons
  const addonCheckboxes = document.querySelectorAll('#customAddonsOptions input[type="checkbox"]');
  addonCheckboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      const selected = [];
      addonCheckboxes.forEach(c => {
        if (c.checked) {
          selected.push({ id: c.value, name: c.dataset.name, price: parseInt(c.dataset.price, 10) });
        }
      });
      customizerState.addons = selected;
      updateCustomizerSummary();
    });
  });

  // Nama penerima dan ucapan
  const recipientInput = document.getElementById('customRecipientName');
  const messageInput = document.getElementById('customCardMsg');
  if (recipientInput) {
    recipientInput.addEventListener('input', (e) => {
      customizerState.recipient = e.target.value.trim();
      updateCustomizerSummary();
    });
  }
  if (messageInput) {
    messageInput.addEventListener('input', (e) => {
      customizerState.cardMessage = e.target.value.trim();
    });
  }

  // Tombol WhatsApp: pesan & konsultasi
  const btnOrderCustom = document.getElementById('btnOrderCustomWA');
  if (btnOrderCustom) btnOrderCustom.addEventListener('click', () => sendCustomOrderToWhatsApp(false));
  const btnConsult = document.getElementById('btnConsultCustomWA');
  if (btnConsult) btnConsult.addEventListener('click', () => sendCustomOrderToWhatsApp(true));

  setCustomColor(customizerState.color, false);
}

function customizerTotal() {
  if (!customizerState.type.price) return null; // harga ditentukan lewat konsultasi
  return customizerState.addons.reduce((sum, a) => sum + a.price, customizerState.type.price);
}

function updateCustomizerSummary() {
  const baseNameEl = document.getElementById('previewBaseName');
  const colorEl = document.getElementById('previewColor');
  const chipEl = document.getElementById('previewColorChip');
  const addonsEl = document.getElementById('previewAddons');
  const recipientEl = document.getElementById('previewRecipient');
  const priceEl = document.getElementById('customTotalPrice');

  renderCustomIllustration();
  if (baseNameEl) baseNameEl.textContent = `${customizerState.type.emoji} ${customizerState.type.name}`;
  if (colorEl) colorEl.textContent = customizerState.color.name;
  if (chipEl && HEX_RE.test(customizerState.color.hex)) chipEl.style.background = customizerState.color.hex;
  if (addonsEl) {
    addonsEl.textContent = customizerState.addons.length === 0
      ? 'Tidak ada'
      : customizerState.addons.map(a => a.name).join(', ');
  }
  if (recipientEl) recipientEl.textContent = customizerState.recipient || '-';

  const total = customizerTotal();
  if (priceEl) priceEl.textContent = total === null ? 'Via konsultasi' : formatIDR(total);
}

function sendCustomOrderToWhatsApp(consultOnly) {
  const total = customizerTotal();
  const addonsText = customizerState.addons.length > 0
    ? customizerState.addons.map(a => `- ${a.name} (${formatIDR(a.price)})`).join('\n')
    : '- Tidak ada';
  const recipient = customizerState.recipient || '(Belum diisi)';
  const message = customizerState.cardMessage || '(Kosong / Ditulis tangan sendiri)';
  const priceLine = total === null ? 'Harga menyesuaikan, mohon info setelah konsultasi' : formatIDR(total);

  const detail = `*Jenis:* ${customizerState.type.name}\n` +
                 `*Warna:* ${customizerState.color.name}\n` +
                 `*Tambahan Spesial:*\n${addonsText}\n\n` +
                 `*Penerima:* ${recipient}\n` +
                 `*Ucapan Kartu:*\n"${message}"\n` +
                 `---------------------------------------------\n` +
                 `*Estimasi:* ${priceLine}\n\n`;

  const text = consultOnly
    ? `💬 *KONSULTASI CUSTOM — DY.FLORIST* 💬\n---------------------------------------------\n` +
      detail +
      `Halo dy.florist, saya sudah mencoba Bespoke Studio tetapi ingin berkonsultasi dulu soal ide, warna, atau budget. Mohon bantuannya. Terima kasih! ✨`
    : `🌸 *PESANAN BESPOKE CUSTOM — DY.FLORIST* 🌸\n---------------------------------------------\n` +
      detail +
      `Halo Florist dy.florist, saya ingin memesan pesanan custom di atas. Mohon konfirmasi ketersediaan dan detail pengirimannya. Terima kasih! ✨`;

  const waUrl = `https://wa.me/${WA_PHONE_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}

// ==========================================
// 6. SHOPPING CART & DRAWER
// ==========================================
function saveCart() {
  localStorage.setItem('dy_florist_cart', JSON.stringify(cart));
  updateCartBadge();
  renderCartDrawer();
}

function updateCartBadge() {
  const badge = document.getElementById('cartCountBadge');
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) {
    badge.innerText = totalCount;
    badge.style.transform = 'scale(1.25)';
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 200);
  }
}

window.addToCart = function(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const existingIndex = cart.findIndex(i => i.id === productId);
  if (existingIndex > -1) {
    cart[existingIndex].quantity = Math.min(50, cart[existingIndex].quantity + 1);
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1
    });
  }

  saveCart();
  showToast(`"${product.name}" ditambahkan ke keranjang! 💐`);
  openCart();
};

window.changeCartQty = function(productId, delta) {
  const itemIndex = cart.findIndex(i => i.id === productId);
  if (itemIndex > -1) {
    cart[itemIndex].quantity = Math.min(50, cart[itemIndex].quantity + delta);
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
    }
    saveCart();
  }
};

window.removeFromCart = function(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
  showToast('Item dihapus dari keranjang.');
};

function setupCartDrawer() {
  const openBtn = document.getElementById('openCartBtn');
  const closeBtn = document.getElementById('closeCartBtn');
  const overlay = document.getElementById('cartOverlay');
  const checkoutBtn = document.getElementById('btnCheckoutWA');

  if (openBtn) openBtn.addEventListener('click', openCart);
  if (closeBtn) closeBtn.addEventListener('click', closeCart);
  if (overlay) overlay.addEventListener('click', closeCart);

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', checkoutCartWhatsApp);
  }
}

window.openCart = function() {
  renderCartDrawer();
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer && overlay) {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeCart = function() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer && overlay) {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
};

function renderCartDrawer() {
  const list = document.getElementById('cartItemsList');
  const emptyState = document.getElementById('emptyCartState');
  const drawerFooter = document.getElementById('drawerFooter');
  const itemCountEl = document.getElementById('drawerItemCount');
  const subtotalEl = document.getElementById('drawerSubtotal');

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (itemCountEl) itemCountEl.innerText = `${totalCount} Item`;

  if (cart.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (list) list.innerHTML = '';
    if (drawerFooter) drawerFooter.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (drawerFooter) drawerFooter.style.display = 'block';

  if (list) {
    list.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${esc(safeImg(item.image))}" alt="${esc(item.name)}" class="cart-item-img">
        <div class="cart-item-info">
          <div class="cart-item-title">${esc(item.name)}</div>
          <div class="cart-item-price">${formatIDR(item.price)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-click="changeCartQty('${esc(item.id)}', -1)">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" data-click="changeCartQty('${esc(item.id)}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-click="removeFromCart('${esc(item.id)}')" title="Hapus">✕</button>
      </div>
    `).join('');
  }

  if (subtotalEl) subtotalEl.innerText = formatIDR(subtotal);
}

function checkoutCartWhatsApp() {
  if (cart.length === 0) return;

  const recipient = document.getElementById('drawerRecipient')?.value.trim() || '(Belum diisi)';
  const date = document.getElementById('drawerDate')?.value.trim() || '(Segera / Hari Ini)';
  const note = document.getElementById('drawerNote')?.value.trim() || '(Tanpa ucapan)';

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  let itemsText = cart.map((item, index) => {
    return `${index + 1}. *${item.name}* x${item.quantity} = ${formatIDR(item.price * item.quantity)}`;
  }).join('\n');

  const text = `🛍️ *ORDER BARU — DY.FLORIST* 🛍️\n` +
               `---------------------------------------------\n` +
               `*Daftar Produk:*\n${itemsText}\n\n` +
               `---------------------------------------------\n` +
               `*Total Harga:* ${formatIDR(subtotal)}\n` +
               `---------------------------------------------\n` +
               `*Nama Pemesan / Penerima:* ${recipient}\n` +
               `*Waktu Pengiriman / Ambil:* ${date}\n` +
               `*Pesan Kartu Ucapan:*\n"${note}"\n\n` +
               `Halo Florist dy.florist, saya ingin konfirmasi pesanan ini. Mohon info nomor rekening & ketersediaan. Terima kasih! ✨`;

  // Simpan pesanan di server (total dihitung ulang server). Gagal pun WhatsApp tetap dibuka.
  api('/orders', {
    method: 'POST',
    json: {
      recipient: recipient.slice(0, 120),
      scheduled: date.slice(0, 120),
      note: note.slice(0, 500),
      items: cart.map(i => ({ id: i.id, qty: i.quantity }))
    }
  }).catch(() => {});

  const waUrl = `https://wa.me/${WA_PHONE_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}

// ==========================================
// 7. PRODUCT QUICK VIEW MODAL
// ==========================================
function setupModals() {
  const overlay = document.getElementById('quickViewOverlay');
  const closeBtn = document.getElementById('closeQuickViewBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeQuickView);
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeQuickView();
    });
  }
}

window.openQuickView = function(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const body = document.getElementById('quickViewBody');
  const overlay = document.getElementById('quickViewOverlay');

  if (body) {
    body.innerHTML = `
      <div class="modal-product-layout">
        <div class="modal-img-col">
          <img src="${esc(safeImg(product.image))}" alt="${esc(product.name)}">
        </div>
        <div class="modal-details-col">
          <span class="modal-category">${esc(product.categoryName)} • ${esc(product.badge)}</span>
          <h2 class="modal-title">${esc(product.name)}</h2>
          <div class="product-rating" style="margin-bottom: 12px;">
            ★★★★★ <span>(${product.reviews} ulasan pembeli)</span>
          </div>
          <div class="modal-price">${formatIDR(product.price)}</div>
          <p class="modal-desc">${esc(product.description)}</p>
          
          <div class="modal-meta-box">
            <div>🌿 <strong>Kualitas:</strong> Bunga segar pilihan premium atau preserved grade A</div>
            <div style="margin-top: 4px;">🎁 <strong>Bonus:</strong> Free Custom Greeting Card & Satin Ribbon</div>
          </div>

          <div style="display: flex; gap: 12px; margin-top: auto;">
            <button class="btn btn-primary" style="flex: 1;" data-click="addToCart('${esc(product.id)}'); closeQuickView();">
              Tambah ke Keranjang
            </button>
            <a href="https://wa.me/${WA_PHONE_NUMBER}?text=Halo%20dy.florist,%20saya%20tertarik%20dengan%20${encodeURIComponent(product.name)}" target="_blank" class="btn btn-glass" style="flex: 1;">
              Tanya via WA
            </a>
          </div>
        </div>
      </div>
    `;
  }

  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeQuickView = function() {
  const overlay = document.getElementById('quickViewOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
};

// ==========================================
// 8. FAQ ACCORDION
// ==========================================
function setupFAQ() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      items.forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

// ==========================================
// 9. HEADER & MOBILE NAVIGATION
// ==========================================
function setupHeaderScroll() {
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });
}

function setupMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (toggle && navMenu) {
    toggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }
}

// ==========================================
// 10. TOAST SYSTEM
// ==========================================
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==========================================
// 11. ADMIN PORTAL (login & data lewat API server)
// ==========================================
let isAdminLoggedIn = false;
let ADMIN_ORDERS = [];

function setupAdmin() {
  // Admin tidak punya tombol di halaman publik: dibuka lewat alamat khusus /admin
  if (location.pathname.replace(/\/+$/, '') === '/admin') {
    openAdminModal();
  }
  const openBtn = document.getElementById('openAdminBtn');
  const closeBtn = document.getElementById('closeAdminBtn');
  const overlay = document.getElementById('adminModalOverlay');

  if (openBtn) {
    openBtn.addEventListener('click', openAdminModal);
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAdminModal);
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAdminModal();
    });
  }
}

// Panggilan API admin: jika sesi habis (401) kembali ke layar login
async function adminApi(path, opts) {
  try {
    return await api(path, opts);
  } catch (e) {
    if (e.status === 401) {
      isAdminLoggedIn = false;
      showAdminLogin();
      showToast('Sesi berakhir. Silakan login kembali.');
    }
    throw e;
  }
}

window.openAdminModal = async function() {
  const overlay = document.getElementById('adminModalOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  showAdminLogin();
  try {
    await api('/admin/session');
    isAdminLoggedIn = true;
    await showAdminDashboard();
  } catch (e) {
    isAdminLoggedIn = false;
  }
};

window.closeAdminModal = function() {
  const overlay = document.getElementById('adminModalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  // Tutup admin = kembali ke beranda biasa
  if (location.pathname.replace(/\/+$/, '') === '/admin') {
    history.replaceState(null, '', '/');
  }
};

function showAdminLogin() {
  const loginView = document.getElementById('adminLoginView');
  const dashView = document.getElementById('adminDashboardView');
  const headerTitle = document.getElementById('adminHeaderTitle');

  if (loginView) loginView.style.display = 'block';
  if (dashView) dashView.style.display = 'none';
  if (headerTitle) headerTitle.textContent = 'Admin Authentication';

  const pwInput = document.getElementById('adminPasswordInput');
  if (pwInput) {
    pwInput.value = '';
    setTimeout(() => pwInput.focus(), 150);
  }
}

async function showAdminDashboard() {
  const loginView = document.getElementById('adminLoginView');
  const dashView = document.getElementById('adminDashboardView');
  const headerTitle = document.getElementById('adminHeaderTitle');

  if (loginView) loginView.style.display = 'none';
  if (dashView) dashView.style.display = 'block';
  if (headerTitle) headerTitle.textContent = 'Admin Control Center';

  populateCategorySelects();
  renderAdminProductsTable();
  renderAdminCategories();
  try {
    ADMIN_ORDERS = await adminApi('/admin/orders');
  } catch (e) {
    ADMIN_ORDERS = [];
  }
  renderAdminOrdersTable();
  updateAdminBadges();
}

window.handleAdminLogin = async function() {
  const pwInput = document.getElementById('adminPasswordInput');
  const password = pwInput?.value ?? '';
  if (!password) return;

  const submitBtn = document.querySelector('#adminLoginForm button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    await api('/admin/login', { method: 'POST', json: { password } });
    isAdminLoggedIn = true;
    if (pwInput) pwInput.value = '';
    showToast('Berhasil masuk sebagai Admin! 🌸');
    await showAdminDashboard();
  } catch (e) {
    showToast(e.message || 'Login gagal.');
    if (pwInput) {
      pwInput.value = '';
      pwInput.focus();
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

window.handleAdminLogout = async function() {
  try {
    await api('/admin/logout', { method: 'POST' });
  } catch (e) {
    /* tetap keluar di sisi tampilan */
  }
  isAdminLoggedIn = false;
  ADMIN_ORDERS = [];
  showToast('Anda telah keluar dari mode Admin.');
  showAdminLogin();
};

window.switchAdminTab = function(tabName) {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tabName));

  const contentProducts = document.getElementById('adminTabProducts');
  const contentAdd = document.getElementById('adminTabAdd');
  const contentOrders = document.getElementById('adminTabOrders');
  const contentCategories = document.getElementById('adminTabCategories');

  if (contentCategories) contentCategories.style.display = (tabName === 'categories') ? 'block' : 'none';
  if (contentProducts) contentProducts.style.display = (tabName === 'products') ? 'block' : 'none';
  if (contentAdd) contentAdd.style.display = (tabName === 'add') ? 'block' : 'none';
  if (contentOrders) contentOrders.style.display = (tabName === 'orders') ? 'block' : 'none';

  if (tabName === 'products') {
    renderAdminProductsTable();
  } else if (tabName === 'orders') {
    renderAdminOrdersTable();
  } else if (tabName === 'categories') {
    renderAdminCategories();
  }
};

function updateAdminBadges() {
  const catCountEl = document.getElementById('adminCategoriesCount');
  if (catCountEl) catCountEl.textContent = CATEGORIES.length;
  const totalCountEl = document.getElementById('adminTotalCount');
  const ordersCountEl = document.getElementById('adminOrdersCount');

  if (totalCountEl) totalCountEl.textContent = PRODUCTS.length;
  if (ordersCountEl) ordersCountEl.textContent = ADMIN_ORDERS.length;
}

window.renderAdminProductsTable = function() {
  const tbody = document.getElementById('adminProductsTableBody');
  if (!tbody) return;

  const searchQuery = document.getElementById('adminSearchInput')?.value.toLowerCase().trim() || '';
  const filterCat = document.getElementById('adminCategoryFilter')?.value || 'all';

  const filtered = PRODUCTS.filter(p => {
    const matchName = p.name.toLowerCase().includes(searchQuery);
    const matchCat = (filterCat === 'all' || p.category === filterCat);
    return matchName && matchCat;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--color-text-muted);">Tidak ada produk ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td>
        <img src="${esc(safeImg(item.image))}" alt="${esc(item.name)}" data-fallback="/assets/bouquet.jpg">
      </td>
      <td>
        <strong>${esc(item.name)}</strong>
        <div style="font-size: 0.75rem; color: var(--color-text-muted); max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${esc(item.description || '')}
        </div>
      </td>
      <td><span class="category-tag" style="text-transform: capitalize;">${esc(item.categoryName || item.category)}</span></td>
      <td style="font-weight: 600; color: var(--color-primary);">${formatIDR(item.price)}</td>
      <td>
        ${item.badge ? `<span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600;">${esc(item.badge)}</span>` : '-'}
      </td>
      <td>
        <button class="btn-action-edit" data-click="startEditProduct('${esc(item.id)}')">Edit</button>
        <button class="btn-action-delete" data-click="deleteProduct('${esc(item.id)}')">Hapus</button>
      </td>
    </tr>
  `).join('');
};

window.filterAdminProducts = function() {
  renderAdminProductsTable();
};

function setProductImagePreview(src) {
  const img = document.getElementById('prodImagePreview');
  if (!img) return;
  if (src && SAFE_IMAGE.test(src)) {
    img.src = src;
    img.style.display = 'block';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
  }
}

window.startEditProduct = function(id) {
  const item = PRODUCTS.find(p => p.id === id);
  if (!item) return;

  document.getElementById('editProductId').value = item.id;
  document.getElementById('prodName').value = item.name;
  document.getElementById('prodCategory').value = item.category;
  document.getElementById('prodPrice').value = item.price;
  document.getElementById('prodBadge').value = item.badge || '';
  document.getElementById('prodImage').value = item.image;
  document.getElementById('prodDescription').value = item.description || '';
  setProductImagePreview(item.image);

  document.getElementById('saveBtnText').textContent = 'Simpan Perubahan';
  switchAdminTab('add');
};

window.cancelEditProduct = function() {
  document.getElementById('adminProductForm')?.reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('prodImage').value = '';
  setProductImagePreview('');
  document.getElementById('saveBtnText').textContent = 'Simpan Produk';
  switchAdminTab('products');
};

// Perkecil foto di browser (maks 1200px, JPEG) lalu upload ke server
function resizeImageToBlob(file, maxSide = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Gagal memproses gambar'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak bisa dibaca'));
    };
    img.src = url;
  });
}

window.handleProductImageUpload = async function(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar.');
    input.value = '';
    return;
  }
  const saveBtn = document.getElementById('btnSaveProduct');
  if (saveBtn) saveBtn.disabled = true;
  showToast('Mengunggah foto...');
  try {
    const blob = await resizeImageToBlob(file);
    const form = new FormData();
    form.set('file', blob, 'foto.jpg');
    const { url } = await adminApi('/admin/upload', { method: 'POST', form });
    document.getElementById('prodImage').value = url;
    setProductImagePreview(url);
    showToast('Foto berhasil diunggah.');
  } catch (e) {
    showToast(e.message || 'Upload foto gagal.');
    input.value = '';
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
};

window.saveAdminProduct = async function() {
  const id = document.getElementById('editProductId').value;
  const payload = {
    name: document.getElementById('prodName').value.trim(),
    category: document.getElementById('prodCategory').value,
    price: parseInt(document.getElementById('prodPrice').value, 10),
    badge: document.getElementById('prodBadge').value.trim(),
    image: document.getElementById('prodImage').value.trim(),
    description: document.getElementById('prodDescription').value.trim()
  };

  if (!payload.image) {
    showToast('Silakan upload foto produk terlebih dahulu.');
    return;
  }
  if (!Number.isInteger(payload.price) || payload.price < 0) {
    showToast('Harga tidak valid.');
    return;
  }

  const saveBtn = document.getElementById('btnSaveProduct');
  if (saveBtn) saveBtn.disabled = true;
  try {
    if (id) {
      await adminApi('/admin/products/' + encodeURIComponent(id), { method: 'PUT', json: payload });
      showToast(`Produk "${payload.name}" berhasil diperbarui! ✨`);
    } else {
      await adminApi('/admin/products', { method: 'POST', json: payload });
      showToast(`Produk baru "${payload.name}" berhasil ditambahkan! 🌸`);
    }
    await loadProducts();
    renderCatalog();
    updateAdminBadges();
    cancelEditProduct();
  } catch (e) {
    showToast(e.message || 'Gagal menyimpan produk.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
};

window.deleteProduct = async function(id) {
  const item = PRODUCTS.find(p => p.id === id);
  if (!item) return;

  if (confirm(`Yakin ingin menghapus produk "${item.name}" dari katalog?`)) {
    try {
      await adminApi('/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
      await loadProducts();
      renderAdminProductsTable();
      renderCatalog();
      updateAdminBadges();
      showToast(`Produk "${item.name}" telah dihapus.`);
    } catch (e) {
      showToast(e.message || 'Gagal menghapus produk.');
    }
  }
};

window.renderAdminCategories = function() {
  const tbody = document.getElementById('adminCategoriesTableBody');
  if (!tbody) return;
  if (CATEGORIES.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 24px; color: var(--color-text-muted);">Belum ada kategori.</td></tr>';
    return;
  }
  tbody.innerHTML = CATEGORIES.map(c => {
    const count = PRODUCTS.filter(p => p.category === c.key).length;
    return `
    <tr>
      <td><strong>${esc(categoryLabel(c))}</strong></td>
      <td>${count}</td>
      <td>
        <button class="btn-action-edit" data-click="startEditCategory('${esc(c.key)}')">Ubah</button>
        <button class="btn-action-delete" data-click="deleteCategory('${esc(c.key)}')">Hapus</button>
      </td>
    </tr>`;
  }).join('');
};

// Muat ulang kategori & produk lalu segarkan semua tampilan yang memakainya
async function refreshAfterCategoryChange() {
  await Promise.all([loadCategories(), loadProducts()]);
  renderCategoryTabs();
  populateCategorySelects();
  renderCatalog();
  renderAdminCategories();
  renderAdminProductsTable();
  updateAdminBadges();
}

window.startEditCategory = function(key) {
  const c = CATEGORIES.find(x => x.key === key);
  if (!c) return;
  document.getElementById('editCategoryKey').value = c.key;
  document.getElementById('catName').value = c.name;
  document.getElementById('catEmoji').value = c.emoji || '';
  document.getElementById('saveCatText').textContent = 'Simpan Perubahan';
  document.getElementById('catName').focus();
};

window.cancelEditCategory = function() {
  document.getElementById('adminCategoryForm')?.reset();
  document.getElementById('editCategoryKey').value = '';
  document.getElementById('saveCatText').textContent = 'Tambah Kategori';
};

window.saveAdminCategory = async function() {
  const key = document.getElementById('editCategoryKey').value;
  const payload = {
    name: document.getElementById('catName').value.trim(),
    emoji: document.getElementById('catEmoji').value.trim()
  };
  if (!payload.name) {
    showToast('Nama kategori wajib diisi.');
    return;
  }
  const btn = document.getElementById('btnSaveCategory');
  if (btn) btn.disabled = true;
  try {
    if (key) {
      await adminApi('/admin/categories/' + encodeURIComponent(key), { method: 'PUT', json: payload });
      showToast(`Kategori "${payload.name}" diperbarui.`);
    } else {
      await adminApi('/admin/categories', { method: 'POST', json: payload });
      showToast(`Kategori "${payload.name}" ditambahkan.`);
    }
    cancelEditCategory();
    await refreshAfterCategoryChange();
  } catch (e) {
    showToast(e.message || 'Gagal menyimpan kategori.');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.deleteCategory = async function(key) {
  const c = CATEGORIES.find(x => x.key === key);
  if (!c) return;
  if (!confirm(`Hapus kategori "${c.name}"?`)) return;
  try {
    await adminApi('/admin/categories/' + encodeURIComponent(key), { method: 'DELETE' });
    showToast(`Kategori "${c.name}" dihapus.`);
    await refreshAfterCategoryChange();
  } catch (e) {
    showToast(e.message || 'Gagal menghapus kategori.');
  }
};

window.renderAdminOrdersTable = function() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  if (ADMIN_ORDERS.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--color-text-muted);">Belum ada pesanan yang masuk.</td></tr>`;
    return;
  }

  tbody.innerHTML = ADMIN_ORDERS.map(ord => `
    <tr>
      <td style="white-space: nowrap; font-size: 0.78rem;">${esc(new Date(ord.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }))}</td>
      <td><strong>${esc(ord.recipient)}</strong></td>
      <td style="font-size: 0.8rem;">${esc(ord.scheduled)}</td>
      <td style="font-weight: 700; color: var(--color-primary);">${formatIDR(ord.total)}</td>
      <td style="font-size: 0.8rem;">
        <ul style="padding-left: 16px; margin: 0;">
          ${ord.items.map(it => `<li>${esc(it.name)} (x${esc(it.qty)})</li>`).join('')}
        </ul>
      </td>
      <td style="font-size: 0.78rem; max-width: 160px; font-style: italic; color: var(--color-text-muted);">${esc(ord.note || '-')}</td>
    </tr>
  `).join('');
};

window.clearOrdersLog = async function() {
  if (confirm('Hapus seluruh riwayat pesanan?')) {
    try {
      await adminApi('/admin/orders', { method: 'DELETE' });
      ADMIN_ORDERS = [];
      renderAdminOrdersTable();
      updateAdminBadges();
      showToast('Riwayat pesanan berhasil dibersihkan.');
    } catch (e) {
      showToast(e.message || 'Gagal menghapus riwayat.');
    }
  }
};
