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
  'saveAdminProduct', 'handleAdminLogin'
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

// Bespoke Customizer State
const customizerState = {
  base: {
    type: 'bouquet',
    name: 'Hand Bouquet Korean',
    price: 280000,
    image: '/assets/bouquet.jpg'
  },
  color: 'Signature Rose Magenta',
  wrap: 'Matte Blush Pink + Ivory Silk',
  addons: [], // array of { id, name, price }
  recipient: '',
  cardMessage: ''
};

// ==========================================
// 3. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const gridEl = document.getElementById('productsGrid');
  if (gridEl) gridEl.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--color-text-muted);">Memuat produk...</p>';
  loadProducts().then(() => {
    if (productsError && gridEl) {
      gridEl.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--color-text-muted);">Produk gagal dimuat. Silakan muat ulang halaman.</p>';
    } else {
      renderCatalog();
    }
    // Jika admin sudah terbuka (alamat /admin) sebelum produk selesai dimuat, segarkan tabelnya
    if (isAdminLoggedIn) {
      renderAdminProductsTable();
      updateAdminBadges();
    }
  });
  setupFilterTabs();
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
function renderCatalog() {
  const grid = document.getElementById('productsGrid');
  const emptyState = document.getElementById('catalogEmpty');
  if (!grid) return;

  // Belum ada produk dekorasi: arahkan pengunjung konsultasi lewat WhatsApp
  if (activeFilter === 'dekorasi' && !PRODUCTS.some(p => p.category === 'dekorasi')) {
    if (emptyState) emptyState.style.display = 'none';
    const waText = encodeURIComponent('Halo dy.florist, saya ingin konsultasi dekorasi acara');
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px;">
      <p style="color: var(--color-text-muted); margin-bottom: 16px;">🎊 Dekorasi lamaran, wedding car, ulang tahun, dan acara lainnya. Konsultasikan konsep Anda bersama kami.</p>
      <a class="btn btn-primary" href="https://wa.me/${WA_PHONE_NUMBER}?text=${waText}" target="_blank" rel="noopener noreferrer">Konsultasi Dekorasi via WhatsApp</a>
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

function setupFilterTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter');
      renderCatalog();
    });
  });
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
function setupCustomizer() {
  // Base Type Selection
  const baseButtons = document.querySelectorAll('#customBaseOptions .option-pill');
  const baseImages = {
    bouquet: '/assets/bouquet.jpg',
    bloombox: '/assets/bloom_box.jpg',
    dome: '/assets/dome.jpg',
    hamper: '/assets/gift.jpg'
  };

  baseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      baseButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const val = btn.dataset.value;
      const name = btn.querySelector('.opt-name').innerText;
      const price = parseInt(btn.dataset.price, 10);

      customizerState.base = {
        type: val,
        name: name,
        price: price,
        image: baseImages[val] || '/assets/bouquet.jpg'
      };

      updateCustomizerSummary();
    });
  });

  // Color Palette Selection
  const colorButtons = document.querySelectorAll('#customColorOptions .color-circle-btn');
  const colorLabel = document.getElementById('selectedColorLabel');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      colorButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.dataset.color;
      customizerState.color = color;
      if (colorLabel) {
        colorLabel.innerHTML = `Warna Terpilih: <strong>${esc(color)}</strong>`;
      }
      updateCustomizerSummary();
    });
  });

  // Wrapping Paper
  const wrapButtons = document.querySelectorAll('#customWrapOptions .option-pill');
  wrapButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      wrapButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      customizerState.wrap = btn.dataset.wrap;
      updateCustomizerSummary();
    });
  });

  // Addons Checkboxes
  const addonCheckboxes = document.querySelectorAll('#customAddonsOptions input[type="checkbox"]');
  addonCheckboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      const selected = [];
      addonCheckboxes.forEach(c => {
        if (c.checked) {
          selected.push({
            id: c.value,
            name: c.dataset.name,
            price: parseInt(c.dataset.price, 10)
          });
        }
      });
      customizerState.addons = selected;
      updateCustomizerSummary();
    });
  });

  // Recipient and Message Input
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

  // WA Order Button
  const btnOrderCustom = document.getElementById('btnOrderCustomWA');
  if (btnOrderCustom) {
    btnOrderCustom.addEventListener('click', () => {
      sendCustomOrderToWhatsApp();
    });
  }

  updateCustomizerSummary();
}

function updateCustomizerSummary() {
  const previewImg = document.getElementById('customPreviewImg');
  const baseNameEl = document.getElementById('previewBaseName');
  const colorEl = document.getElementById('previewColor');
  const wrapEl = document.getElementById('previewWrap');
  const addonsEl = document.getElementById('previewAddons');
  const recipientEl = document.getElementById('previewRecipient');
  const priceEl = document.getElementById('customTotalPrice');

  if (previewImg) previewImg.src = customizerState.base.image;
  if (baseNameEl) baseNameEl.innerText = customizerState.base.name;
  if (colorEl) colorEl.innerText = customizerState.color;
  if (wrapEl) wrapEl.innerText = customizerState.wrap;

  if (addonsEl) {
    if (customizerState.addons.length === 0) {
      addonsEl.innerText = 'Tidak ada';
    } else {
      addonsEl.innerText = customizerState.addons.map(a => a.name).join(', ');
    }
  }

  if (recipientEl) {
    recipientEl.innerText = customizerState.recipient || '-';
  }

  // Calculate Total
  let total = customizerState.base.price;
  customizerState.addons.forEach(a => { total += a.price; });

  if (priceEl) {
    priceEl.innerText = formatIDR(total);
  }
}

function sendCustomOrderToWhatsApp() {
  let total = customizerState.base.price;
  customizerState.addons.forEach(a => { total += a.price; });

  const addonsText = customizerState.addons.length > 0
    ? customizerState.addons.map(a => `- ${a.name} (${formatIDR(a.price)})`).join('\n')
    : '- Tidak ada';

  const recipient = customizerState.recipient || '(Belum diisi)';
  const message = customizerState.cardMessage || '(Kosong / Ditulis tangan sendiri)';

  const text = `🌸 *PESANAN BESPOKE CUSTOM — DY.FLORIST* 🌸\n` +
               `---------------------------------------------\n` +
               `*Tipe Rangkaian:* ${customizerState.base.name}\n` +
               `*Nuansa Warna:* ${customizerState.color}\n` +
               `*Wrapping & Pita:* ${customizerState.wrap}\n` +
               `*Add-ons Spesial:*\n${addonsText}\n\n` +
               `*Penerima:* ${recipient}\n` +
               `*Ucapan Kartu:*\n"${message}"\n` +
               `---------------------------------------------\n` +
               `*Estimasi Total:* ${formatIDR(total)}\n\n` +
               `Halo Florist dy.florist, saya ingin memesan rangkaian custom di atas. Mohon konfirmasi ketersediaan dan detail pengirimannya. Terima kasih! ✨`;

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

  renderAdminProductsTable();
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

  if (contentProducts) contentProducts.style.display = (tabName === 'products') ? 'block' : 'none';
  if (contentAdd) contentAdd.style.display = (tabName === 'add') ? 'block' : 'none';
  if (contentOrders) contentOrders.style.display = (tabName === 'orders') ? 'block' : 'none';

  if (tabName === 'products') {
    renderAdminProductsTable();
  } else if (tabName === 'orders') {
    renderAdminOrdersTable();
  }
};

function updateAdminBadges() {
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
