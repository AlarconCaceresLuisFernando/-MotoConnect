/* ============================================================
   MotoConnect — app.js
   Complete SPA implementation with hash-based routing
   ============================================================ */

'use strict';

/* ============================================================
   CONSTANTS & STATE
   ============================================================ */
const API = 'http://localhost:3000/api';
const BS_RATE = 6.96; // 1 USD = 6.96 Bs

const state = {
  currentUser: JSON.parse(localStorage.getItem('mc_user') || 'null'),
  cart: JSON.parse(localStorage.getItem('mc_cart') || '[]'),
  productos: [],
  comparador: JSON.parse(localStorage.getItem('mc_comparador') || '[]'), // max 3 slugs
};

/* ============================================================
   UTILS
   ============================================================ */
function fmt(num, decimals = 2) {
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtBs(usd) {
  return 'Bs ' + fmt(usd * BS_RATE);
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function saveCart() {
  localStorage.setItem('mc_cart', JSON.stringify(state.cart));
}

function saveComparador() {
  localStorage.setItem('mc_comparador', JSON.stringify(state.comparador));
}

function saveUser(user) {
  state.currentUser = user;
  if (user) {
    localStorage.setItem('mc_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('mc_user');
  }
}

function genCode(prefix, len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix + '-';
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function genVIN() {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let vin = 'JYARM';
  for (let i = 0; i < 12; i++) vin += chars[Math.floor(Math.random() * chars.length)];
  return vin;
}

function genPKG() {
  const n = Math.floor(Math.random() * 900) + 100;
  return `PKG-2026-${n}`;
}

function showToast(msg, type = 'info', duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const icons = { info: 'ℹ️', success: '✅', danger: '❌', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

async function apiFetch(path, opts = {}) {
  const url = API + path;
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  } else if (opts.body instanceof FormData) {
    delete defaults.headers['Content-Type'];
  }
  const res = await fetch(url, { ...defaults, ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json();
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

/* ============================================================
   ROUTER
   ============================================================ */
const routes = {
  '/': renderHome,
  '/catalogo': renderCatalogo,
  '/comparador': renderComparador,
  '/checkout': renderCheckout,
  '/mis-pedidos': renderMisPedidos,
  '/panel': renderPanel,
  '/login': renderLogin,
};

function getRoute() {
  const hash = window.location.hash || '#/';
  const path = hash.replace('#', '');
  if (path.startsWith('/moto/')) {
    const slug = path.replace('/moto/', '');
    return { view: renderProductDetail, params: { slug } };
  }
  for (const [route, fn] of Object.entries(routes)) {
    if (path === route) return { view: fn, params: {} };
  }
  return { view: render404, params: {} };
}

function navigate(hash) {
  window.location.hash = hash;
}

function router() {
  const { view, params } = getRoute();
  const container = $('#app-container');
  container.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'instant' });
  view(container, params);
  updateNavActive();
  updateNavUI();
}

function updateNavActive() {
  const hash = window.location.hash || '#/';
  $$('.nav-link').forEach(link => {
    const route = link.dataset.route;
    const active = hash.includes(route) && route;
    link.classList.toggle('active', !!active && hash.includes('/' + route));
  });
  // Special case for home
  if (hash === '#/' || hash === '#') {
    $$('.nav-link').forEach(l => l.classList.remove('active'));
  }
}

function updateNavUI() {
  const user = state.currentUser;
  const panelLi = $('#nav-panel-li');
  if (panelLi) {
    panelLi.style.display = (user && user.rol !== 'CLIENTE') ? '' : 'none';
  }
  updateSessionArea();
  updateCartBadge();
  updateComparadorBadge();
}

const DEMO_USERS = [
  { email: 'cliente@motoconnect.com', password: '123456', rol: 'CLIENTE', nombre: 'Carlos Mendoza', cargo: 'Cliente Verificado' },
  { email: 'pagos@motoconnect.com', password: '123456', rol: 'VERIFICADOR_PAGOS', nombre: 'Laura Rojas', cargo: 'Oficial de Cobranzas y Caja' },
  { email: 'almacen@motoconnect.com', password: '123456', rol: 'ALMACEN_EMPAQUE', nombre: 'Marco Quispe', cargo: 'Jefe de Almacén y Empaque PDI' },
  { email: 'entrega@motoconnect.com', password: '123456', rol: 'DESPACHO_ENTREGA', nombre: 'Diego Vargas', cargo: 'Coordinador de Despacho y Entrega' },
  { email: 'admin@motoconnect.com', password: '123456', rol: 'ADMIN', nombre: 'Administrador General', cargo: 'Administrador General Concesionario' }
];

async function quickLogin(email, password) {
  try {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const user = result.user || result;
    saveUser(user);
    updateNavUI();
    showToast(`Sesión activa: ${user.cargo_etiqueta || user.nombre}`, 'success');
    if (user.rol !== 'CLIENTE') {
      navigate('#/panel');
    } else {
      navigate('#/');
    }
  } catch(e) {
    showToast('Error al iniciar sesión: ' + e.message, 'danger');
  }
}

function updateSessionArea() {
  const area = $('#session-area');
  if (!area) return;
  const user = state.currentUser;
  if (user) {
    const otherUsers = DEMO_USERS.filter(u => u.email !== user.email);
    area.innerHTML = `
      <div class="user-dropdown-wrapper">
        <button class="user-badge" id="user-badge-btn" aria-haspopup="true" aria-expanded="false" title="Cambiar rol o sesión">
          <div class="user-avatar">${getInitials(user.nombre)}</div>
          <div class="user-info">
            <span class="user-name">${user.nombre}</span>
            <span class="user-role">${user.rol} ▾</span>
          </div>
        </button>
        <div class="user-dropdown" id="user-dropdown">
          <div class="user-dropdown-header">
            <div style="font-weight:700;font-size:0.85rem">${user.nombre}</div>
            <div style="font-size:0.75rem;color:var(--accent-primary)">${user.cargo_etiqueta || user.rol}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${user.email}</div>
          </div>
          ${user.rol !== 'CLIENTE' ? `<button onclick="navigate('#/panel')" style="color:var(--accent-primary);font-weight:600">⚡ Ir a Panel Operativo</button>` : ''}
          <div class="user-dropdown-divider"></div>
          <div style="padding:6px 14px;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Cambiar Rol Rápido:</div>
          ${otherUsers.map(u => `
            <button onclick="quickLogin('${u.email}', '${u.password}')" style="font-size:0.8rem;text-align:left;padding:8px 14px;display:flex;flex-direction:column;gap:2px">
              <span style="font-weight:600;color:var(--text-primary)">${u.nombre}</span>
              <span style="font-size:0.72rem;color:var(--accent-secondary)">${u.cargo}</span>
            </button>
          `).join('')}
          <div class="user-dropdown-divider"></div>
          <button onclick="logout()" style="color:var(--danger)">🚪 Cerrar Sesión</button>
        </div>
      </div>
    `;
    const badge = $('#user-badge-btn');
    const dropdown = $('#user-dropdown');
    if (badge && dropdown) {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        badge.setAttribute('aria-expanded', dropdown.classList.contains('open'));
      });
      document.addEventListener('click', () => dropdown.classList.remove('open'), { once: false });
    }
  } else {
    area.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <a href="#/login" class="btn btn-outline btn-sm">Iniciar Sesión</a>
      </div>
    `;
  }
}

function updateCartBadge() {
  const badge = $('#cart-badge');
  if (!badge) return;
  const total = state.cart.reduce((s, i) => s + i.cantidad, 0);
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function updateComparadorBadge() {
  const badge = $('#comparador-badge');
  if (!badge) return;
  const count = state.comparador.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function logout() {
  saveUser(null);
  updateNavUI();
  showToast('Sesión cerrada', 'info');
  navigate('#/');
}

/* ============================================================
   NAVBAR EVENTS
   ============================================================ */
function initNavbar() {
  const cartBtn = $('#cart-btn');
  const cartClose = $('#cart-close-btn');
  const cartOverlay = $('#cart-overlay');
  const hamburger = $('#hamburger-btn');
  const navLinks = $('#nav-links');

  if (cartBtn) cartBtn.addEventListener('click', openCart);
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      closeAllModals();
    }
  });
}

/* ============================================================
   CART SYSTEM
   ============================================================ */
function openCart() {
  const drawer = $('#cart-drawer');
  const overlay = $('#cart-overlay');
  if (drawer) { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
  if (overlay) { overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false'); }
  renderCartDrawer();
}

function closeCart() {
  const drawer = $('#cart-drawer');
  const overlay = $('#cart-overlay');
  if (drawer) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
  if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }
}

function addToCart(item) {
  const existing = state.cart.find(i => i.productoId === item.productoId && i.color === item.color);
  if (existing) {
    existing.cantidad += item.cantidad;
  } else {
    state.cart.push({ ...item });
  }
  saveCart();
  updateCartBadge();
  renderCartDrawer();
  showToast(`${item.nombre} añadido al carrito`, 'success');
  openCart();
}

function removeFromCart(productoId, color) {
  state.cart = state.cart.filter(i => !(i.productoId === productoId && i.color === color));
  saveCart();
  updateCartBadge();
  renderCartDrawer();
}

function updateCartQty(productoId, color, delta) {
  const item = state.cart.find(i => i.productoId === productoId && i.color === color);
  if (!item) return;
  item.cantidad = Math.max(1, item.cantidad + delta);
  saveCart();
  updateCartBadge();
  renderCartDrawer();
}

function getCartTotal() {
  return state.cart.reduce((s, i) => s + i.precio_usd * i.cantidad, 0);
}

function renderCartDrawer() {
  const body = $('#cart-drawer-body');
  const footer = $('#cart-drawer-footer');
  if (!body || !footer) return;

  if (state.cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Tu carrito está vacío</p>
        <a href="#/catalogo" class="btn btn-primary btn-sm" onclick="closeCart()" style="margin-top:16px">Explorar Catálogo</a>
      </div>
    `;
    footer.innerHTML = '';
    return;
  }

  body.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${getProductMainImage(item)}" alt="${item.nombre}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nombre}</div>
        <div class="cart-item-color">${item.color || ''}</div>
        <div class="cart-item-controls">
          <button class="cart-qty-btn" onclick="updateCartQty('${item.productoId}', '${item.color}', -1)">−</button>
          <span class="cart-qty-display">${item.cantidad}</span>
          <button class="cart-qty-btn" onclick="updateCartQty('${item.productoId}', '${item.color}', 1)">+</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span class="cart-item-price">$${fmt(item.precio_usd * item.cantidad)}</span>
        <button class="cart-item-remove" onclick="removeFromCart('${item.productoId}', '${item.color}')" aria-label="Eliminar">✕</button>
      </div>
    </div>
  `).join('');

  const total = getCartTotal();
  footer.innerHTML = `
    <div class="cart-total-row">
      <span class="cart-total-label">Total</span>
      <span class="cart-total-amount mono">$${fmt(total)}</span>
    </div>
    <div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:12px;font-family:'JetBrains Mono',monospace;">
      ≈ ${fmtBs(total)}
    </div>
    <a href="#/checkout" class="btn btn-primary w-full" onclick="closeCart()">🚀 Ir al Checkout</a>
  `;
}

/* ============================================================
   COMPARADOR SYSTEM
   ============================================================ */
function toggleComparador(slug, nombre) {
  if (state.comparador.includes(slug)) {
    state.comparador = state.comparador.filter(s => s !== slug);
    showToast(`${nombre} quitado del comparador`, 'info');
  } else {
    if (state.comparador.length >= 3) {
      showToast('Máximo 3 productos en el comparador', 'warning');
      return;
    }
    state.comparador.push(slug);
    showToast(`${nombre} añadido al comparador`, 'success');
  }
  saveComparador();
  updateComparadorBadge();
  // Update all compare buttons on current page
  $$('[data-compare-slug]').forEach(btn => {
    const s = btn.dataset.compareSlug;
    const inComp = state.comparador.includes(s);
    btn.textContent = inComp ? '✓ En Comparador' : '+ Comparar';
    btn.classList.toggle('active', inComp);
  });
}

/* ============================================================
   IMAGE HELPERS
   ============================================================ */
function getProductMainImage(p) {
  if (!p) return 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80';
  if (typeof p === 'string') return p;
  if (p.imagen && typeof p.imagen === 'string') return p.imagen;
  if (p.imagen && typeof p.imagen === 'object' && p.imagen.url) return p.imagen.url;
  if (p.imagen_url && typeof p.imagen_url === 'string') return p.imagen_url;
  if (p.imagenes_json) {
    try {
      const arr = typeof p.imagenes_json === 'string' ? JSON.parse(p.imagenes_json) : p.imagenes_json;
      if (Array.isArray(arr) && arr.length > 0) {
        const item = arr[0];
        if (typeof item === 'string') return item;
        if (item && item.url) return item.url;
      }
    } catch (e) {}
  }
  return 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80';
}

function getProductImagesList(p) {
  if (!p) return ['https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80'];
  let list = [];
  if (p.imagenes_json) {
    try {
      const arr = typeof p.imagenes_json === 'string' ? JSON.parse(p.imagenes_json) : p.imagenes_json;
      if (Array.isArray(arr)) {
        arr.forEach(it => {
          if (typeof it === 'string' && it) list.push(it);
          else if (it && it.url) list.push(it.url);
        });
      }
    } catch (e) {}
  }
  if (p.imagen_url && !list.includes(p.imagen_url)) {
    list.unshift(p.imagen_url);
  }
  if (list.length === 0) {
    list.push(getProductMainImage(p));
  }
  return list;
}

/* ============================================================
   PRODUCT CARD BUILDER
   ============================================================ */
function buildProductCard(p) {
  let colores = [];
  try { colores = JSON.parse(p.colores_json || '[]'); } catch (e) { colores = []; }
  const imagen = getProductMainImage(p);

  let stockBadge = '';
  if (p.stock_disponible === 0) {
    stockBadge = `<span class="card-badge-tr badge-stock-out">Agotado</span>`;
  } else if (p.stock_disponible === 1) {
    stockBadge = `<span class="card-badge-tr badge-stock-last">¡Última unidad!</span>`;
  } else {
    stockBadge = `<span class="card-badge-tr badge-stock-ok">${p.stock_disponible} en stock</span>`;
  }

  const specs = [];
  if (p.cilindrada_cc) specs.push(`${p.cilindrada_cc}cc`);
  if (p.potencia_hp) specs.push(`${p.potencia_hp}HP`);
  if (p.peso_kg && p.categoria !== 'ACCESORIO') specs.push(`${p.peso_kg}kg`);

  const inComp = state.comparador.includes(p.slug);

  return `
    <article class="product-card" role="article">
      <div class="product-card-image" onclick="navigate('#/moto/${p.slug}')" style="cursor:pointer">
        <img src="${imagen}" alt="${p.nombre}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80'">
        <span class="card-badge-tl">${p.marca || ''}</span>
        ${stockBadge}
      </div>
      <div class="product-card-body">
        <div>
          <div class="product-name">${p.nombre}</div>
          ${p.anio ? `<div class="product-year">${p.anio}</div>` : ''}
        </div>
        ${specs.length > 0 ? `<div class="product-specs">${specs.map(s => `<span class="spec-pill">${s}</span>`).join('')}</div>` : ''}
        <div class="product-price">
          <div class="price-usd mono">$${fmt(p.precio_usd)}</div>
          <div class="price-bs">${fmtBs(p.precio_usd)}</div>
        </div>
      </div>
      <div class="product-card-actions">
        <button class="btn-compare ${inComp ? 'active' : ''}" data-compare-slug="${p.slug}" onclick="event.stopPropagation();toggleComparador('${p.slug}','${p.nombre.replace(/'/g, "\\'")}')">
          ${inComp ? '✓ En Comparador' : '+ Comparar'}
        </button>
        <button class="btn btn-primary" onclick="navigate('#/moto/${p.slug}')">Ver Ficha</button>
      </div>
    </article>
  `;
}

/* ============================================================
   VIEW: HOME (#/)
   ============================================================ */
async function renderHome(container) {
  container.innerHTML = `
    <!-- HERO -->
    <section class="hero" aria-label="Sección principal">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-eyebrow">🏍️ Concesionario Oficial · Bolivia</span>
        <h1>La Experiencia de<br><span>Conducción</span> Definitiva</h1>
        <p>Motocicletas Premium · Equipamiento Certificado<br>Entrega con Garantía Oficial</p>
        <div class="hero-ctas">
          <a href="#/catalogo" class="btn btn-primary btn-lg">🏍️ Explorar Catálogo</a>
          <a href="#/comparador" class="btn btn-secondary btn-lg">⚡ Comparar Modelos</a>
        </div>
      </div>
      <div class="scroll-indicator">
        <span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase">Scroll</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    </section>

    <!-- FEATURED MODELS -->
    <section class="featured-section section" id="featured-section">
      <div class="section-header">
        <span class="section-label">Top Picks</span>
        <h2>Modelos Destacados</h2>
        <p>Selección especial de motocicletas con la mejor relación desempeño-precio</p>
      </div>
      <div class="products-grid" id="featured-grid">
        <div class="spinner-wrap"><div class="spinner"></div></div>
      </div>
      <div style="text-align:center;margin-top:40px">
        <a href="#/catalogo" class="btn btn-outline btn-lg">Ver Catálogo Completo →</a>
      </div>
    </section>

    <!-- CATEGORIES -->
    <section class="categories-section section">
      <div class="section-header">
        <span class="section-label">Categorías</span>
        <h2>Encuentra tu Estilo</h2>
        <p>Desde naked urbanas hasta aventura extrema</p>
      </div>
      <div class="categories-grid">
        <div class="category-card" onclick="navigate('#/catalogo?cat=Naked')">
          <div class="category-card-thumb">
            <img src="https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80" alt="Motos Naked">
          </div>
          <div class="category-card-info">
            <h3>Naked</h3>
            <p>Potencia sin restricciones. Domina la ciudad con estilo urbano y posición agresiva</p>
            <span class="category-link">Ver Modelos Naked →</span>
          </div>
        </div>
        <div class="category-card" onclick="navigate('#/catalogo?cat=Supersport')">
          <div class="category-card-thumb">
            <img src="https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=600&q=80" alt="Motos Supersport">
          </div>
          <div class="category-card-info">
            <h3>Supersport</h3>
            <p>Tecnología de competición en la calle. Carenado aerodinámico, velocidad y precisión</p>
            <span class="category-link">Ver Modelos Supersport →</span>
          </div>
        </div>
        <div class="category-card" onclick="navigate('#/catalogo?cat=Adventure')">
          <div class="category-card-thumb">
            <img src="https://images.unsplash.com/photo-1558980664-2cd663cf8dde?auto=format&fit=crop&w=600&q=80" alt="Motos Adventure">
          </div>
          <div class="category-card-info">
            <h3>Adventure</h3>
            <p>Sin límites de ruta. Conquista asfalto, grava, dunas y largas travesías continentales</p>
            <span class="category-link">Ver Modelos Adventure →</span>
          </div>
        </div>
        <div class="category-card" onclick="navigate('#/catalogo?cat=Accesorio')">
          <div class="category-card-thumb">
            <img src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80" alt="Equipamiento y Accesorios">
          </div>
          <div class="category-card-info">
            <h3>Equipamiento</h3>
            <p>Cascos de competición, chaquetas de cuero y protecciones homologadas CE Nivel 2</p>
            <span class="category-link">Ver Equipamiento Oficial →</span>
          </div>
        </div>
      </div>
    </section>

    <!-- GUARANTEES -->
    <div class="guarantees-section">
      <div class="guarantees-grid">
        <div class="guarantee-item">
          <div class="guarantee-icon">🛡️</div>
          <div class="guarantee-text">
            <h4>Garantía de Fábrica 24 Meses</h4>
            <p>Respaldo oficial del fabricante en todos los modelos</p>
          </div>
        </div>
        <div class="guarantee-item">
          <div class="guarantee-icon">🔧</div>
          <div class="guarantee-text">
            <h4>Inspección PDI 40 Puntos Certificada</h4>
            <p>Revisión técnica exhaustiva antes de cada entrega</p>
          </div>
        </div>
        <div class="guarantee-item">
          <div class="guarantee-icon">📋</div>
          <div class="guarantee-text">
            <h4>Entrega con Acta Oficial y Firma Digital</h4>
            <p>Documentación completa y trazable en cada operación</p>
          </div>
        </div>
        <div class="guarantee-item">
          <div class="guarantee-icon">🔒</div>
          <div class="guarantee-text">
            <h4>Seguro de Cobertura Total Incluido</h4>
            <p>Protección inmediata desde el día de la entrega</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load featured products
  try {
    const data = await apiFetch('/productos?destacado=1&limit=3');
    const products = Array.isArray(data) ? data : (data.productos || data.data || []);
    const grid = $('#featured-grid');
    if (grid) {
      if (products.length === 0) {
        grid.innerHTML = '<p class="text-muted text-center">No hay modelos destacados disponibles.</p>';
      } else {
        grid.innerHTML = products.slice(0, 3).map(buildProductCard).join('');
      }
    }
  } catch (e) {
    const grid = $('#featured-grid');
    if (grid) grid.innerHTML = `<p class="text-muted text-center">No se pudieron cargar los productos: ${e.message}</p>`;
  }
}

/* ============================================================
   VIEW: CATÁLOGO (#/catalogo)
   ============================================================ */
async function renderCatalogo(container) {
  // Parse URL params
  const hash = window.location.hash;
  const qm = hash.indexOf('?');
  let urlParams = {};
  if (qm !== -1) {
    const qs = hash.slice(qm + 1);
    qs.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) urlParams[k] = decodeURIComponent(v || '');
    });
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Catálogo de Motocicletas</h1>
        <p>Encuentra tu moto ideal entre nuestra selección premium</p>
      </div>
    </div>
    <div class="section">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group" style="flex:2;min-width:200px">
          <label>🔍 Buscar</label>
          <input type="text" id="f-search" placeholder="Nombre, marca..." value="${urlParams.q || ''}">
        </div>
        <div class="filter-group">
          <label>Marca</label>
          <select id="f-marca">
            <option value="">Todas las marcas</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Categoría</label>
          <select id="f-categoria">
            <option value="">Todas las categorías</option>
            <option value="Naked" ${(urlParams.cat || '').toLowerCase() === 'naked' ? 'selected' : ''}>Naked</option>
            <option value="Supersport" ${(urlParams.cat || '').toLowerCase() === 'supersport' ? 'selected' : ''}>Supersport</option>
            <option value="Adventure" ${(urlParams.cat || '').toLowerCase() === 'adventure' ? 'selected' : ''}>Adventure</option>
            <option value="Sport Touring" ${(urlParams.cat || '').toLowerCase() === 'sport touring' ? 'selected' : ''}>Sport Touring</option>
            <option value="Accesorio" ${(urlParams.cat || '').toLowerCase() === 'accesorio' ? 'selected' : ''}>Equipamiento y Accesorios</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Precio máx: <span id="f-price-label">$30,000</span></label>
          <input type="range" id="f-price" min="100" max="30000" value="30000" step="100">
        </div>
        <div class="filter-group">
          <label>Ordenar por</label>
          <select id="f-sort">
            <option value="destacados">Destacados</option>
            <option value="precio_asc">Menor precio</option>
            <option value="precio_desc">Mayor precio</option>
            <option value="cc_desc">Mayor cilindrada</option>
          </select>
        </div>
        <div class="filter-group" style="justify-content:flex-end">
          <div class="toggle-wrap" style="margin-top:22px">
            <input type="checkbox" class="toggle" id="f-stock" ${urlParams.stock ? 'checked' : ''}>
            <label class="toggle-label" for="f-stock">Solo con stock</label>
          </div>
        </div>
      </div>

      <!-- Results info -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <span id="results-count" class="text-muted" style="font-size:0.88rem"></span>
      </div>

      <!-- Products Grid -->
      <div class="products-grid" id="catalog-grid">
        <div class="spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  let allProducts = [];

  try {
    const data = await apiFetch('/productos');
    allProducts = Array.isArray(data) ? data : (data.productos || data.data || []);
    state.productos = allProducts;

    // Populate marcas
    const marcas = [...new Set(allProducts.map(p => p.marca).filter(Boolean))].sort();
    const fMarca = $('#f-marca');
    marcas.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (urlParams.marca === m) opt.selected = true;
      fMarca.appendChild(opt);
    });

    // Set max price
    const maxPrice = Math.ceil(Math.max(...allProducts.map(p => p.precio_usd)));
    const fPrice = $('#f-price');
    if (fPrice && maxPrice > 0) {
      fPrice.max = maxPrice;
      fPrice.value = maxPrice;
      $('#f-price-label').textContent = '$' + fmt(maxPrice, 0);
    }

    applyFilters(allProducts);
  } catch (e) {
    const grid = $('#catalog-grid');
    if (grid) grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error al cargar productos</h3><p>${e.message}</p></div>`;
    return;
  }

  // Event listeners
  ['f-search', 'f-marca', 'f-categoria', 'f-sort', 'f-stock'].forEach(id => {
    const el = $('#' + id);
    if (el) el.addEventListener('input', () => applyFilters(allProducts));
    if (el) el.addEventListener('change', () => applyFilters(allProducts));
  });

  const fPrice = $('#f-price');
  if (fPrice) {
    fPrice.addEventListener('input', () => {
      $('#f-price-label').textContent = '$' + fmt(Number(fPrice.value), 0);
      applyFilters(allProducts);
    });
  }
}

function applyFilters(products) {
  const search = ($('#f-search')?.value || '').toLowerCase();
  const marca = $('#f-marca')?.value || '';
  const cat = $('#f-categoria')?.value || '';
  const maxPrice = Number($('#f-price')?.value || 999999);
  const sort = $('#f-sort')?.value || 'destacados';
  const soloStock = $('#f-stock')?.checked || false;

  let filtered = products.filter(p => {
    if (search && !p.nombre.toLowerCase().includes(search) && !p.marca?.toLowerCase().includes(search)) return false;
    if (marca && p.marca !== marca) return false;
    if (cat && p.categoria?.toLowerCase() !== cat.toLowerCase()) return false;
    if (p.precio_usd > maxPrice) return false;
    if (soloStock && p.stock_disponible <= 0) return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sort === 'precio_asc') return a.precio_usd - b.precio_usd;
    if (sort === 'precio_desc') return b.precio_usd - a.precio_usd;
    if (sort === 'cc_desc') return (b.cilindrada_cc || 0) - (a.cilindrada_cc || 0);
    // destacados: featured first
    return (b.destacado || 0) - (a.destacado || 0);
  });

  const grid = $('#catalog-grid');
  const count = $('#results-count');
  if (count) count.textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;

  if (grid) {
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <span class="empty-icon">🔍</span>
          <h3>Sin resultados</h3>
          <p>Intenta con otros filtros de búsqueda</p>
        </div>
      `;
    } else {
      grid.innerHTML = filtered.map(buildProductCard).join('');
    }
  }
}

/* ============================================================
   VIEW: PRODUCT DETAIL (#/moto/:slug)
   ============================================================ */
async function renderProductDetail(container, { slug }) {
  container.innerHTML = `<div class="spinner-wrap" style="min-height:60vh"><div class="spinner"></div></div>`;

  let p;
  try {
    p = await apiFetch(`/productos/${slug}`);
  } catch (e) {
    container.innerHTML = `
      <div class="empty-state" style="min-height:60vh">
        <span class="empty-icon">😕</span>
        <h3>Producto no encontrado</h3>
        <p>${e.message}</p>
        <a href="#/catalogo" class="btn btn-primary">← Volver al Catálogo</a>
      </div>
    `;
    return;
  }

  let imagenes = getProductImagesList(p);

  let colores = [];
  try { colores = JSON.parse(p.colores_json || '[]'); } catch (e) { colores = []; }
  if (colores.length === 0) colores = [{ nombre: 'Estándar', hex: '#475569' }];

  const inComp = state.comparador.includes(p.slug);

  let stockLabel = '';
  let stockClass = '';
  let stockDotClass = '';
  if (p.stock_disponible === 0) {
    stockLabel = 'Agotado — Próximo Embarque';
    stockClass = 'text-danger';
    stockDotClass = 'out';
  } else if (p.stock_disponible === 1) {
    stockLabel = '¡Última unidad disponible!';
    stockClass = 'text-warning';
    stockDotClass = 'warn';
  } else {
    stockLabel = `${p.stock_disponible} unidades en stock`;
    stockClass = 'text-success';
    stockDotClass = 'ok';
  }

  container.innerHTML = `
    <div class="section" style="padding-top:32px">
      <!-- Breadcrumb -->
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Inicio</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/catalogo">Catálogo</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/catalogo?marca=${encodeURIComponent(p.marca || '')}">${p.marca || ''}</a>
        <span class="breadcrumb-sep">›</span>
        <span style="color:var(--text-primary)">${p.nombre}</span>
      </nav>

      <!-- Main layout -->
      <div class="product-detail-layout">
        <!-- Gallery -->
        <div class="product-gallery">
          <div class="gallery-main">
            <img id="main-gallery-img" src="${imagenes[0]}" alt="${p.nombre}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80'">
          </div>
          <div class="gallery-thumbs" id="gallery-thumbs">
            ${imagenes.map((img, i) => `
              <div class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="swapGalleryImage('${img}', this)">
                <img src="${img}" alt="Vista ${i + 1}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=300&q=80'">
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Info -->
        <div class="product-detail-info">
          <div>
            <div class="product-detail-brand">${p.marca || ''} · ${p.categoria || ''}</div>
            <h1 class="product-detail-name">${p.nombre}</h1>
            ${p.anio ? `<div class="product-year mono" style="margin-top:4px">${p.anio}</div>` : ''}
          </div>

          <div class="stock-indicator ${stockClass}">
            <span class="stock-dot ${stockDotClass}"></span>
            ${stockLabel}
          </div>

          <!-- Color selector -->
          ${colores.length > 0 ? `
          <div class="color-selector">
            <label id="color-label">Color: <strong>${colores[0].nombre}</strong></label>
            <div class="color-swatches">
              ${colores.map((c, i) => `
                <div class="color-swatch ${i === 0 ? 'active' : ''}"
                  style="background:${c.hex || c.color || '#888'}"
                  title="${c.nombre}"
                  onclick="selectColor(this, '${c.nombre.replace(/'/g, "\\'")}')"
                  data-color="${c.nombre}"
                  role="radio" aria-checked="${i === 0}"
                  aria-label="Color ${c.nombre}">
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- Quantity -->
          <div>
            <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:8px">Cantidad</label>
            <div class="quantity-selector">
              <button class="qty-btn" id="qty-minus" onclick="changeQty(-1)" aria-label="Reducir cantidad">−</button>
              <span class="qty-display" id="qty-display">1</span>
              <button class="qty-btn" id="qty-plus" onclick="changeQty(1)" aria-label="Aumentar cantidad">+</button>
            </div>
          </div>

          <!-- Price -->
          <div class="detail-price">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.08em">Precio</div>
            <div class="price-usd">$${fmt(p.precio_usd)}</div>
            <div class="price-bs" style="margin-top:4px">${fmtBs(p.precio_usd)}</div>
          </div>

          <!-- Actions -->
          <div class="detail-actions">
            ${p.stock_disponible > 0 ? `
              <button class="btn btn-primary btn-lg" onclick="handleAddToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                🛒 Añadir al Carrito
              </button>
            ` : `
              <button class="btn btn-primary btn-lg" disabled style="opacity:0.4;cursor:not-allowed">
                🚫 Unidad Agotada — Próximo Embarque
              </button>
            `}
            <button class="btn btn-secondary btn-compare ${inComp ? 'active' : ''}" data-compare-slug="${p.slug}"
              onclick="toggleComparador('${p.slug}', '${p.nombre.replace(/'/g, "\\'")}')">
              ${inComp ? '✓ En Comparador' : '+ Comparar'}
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div style="margin-top:64px">
        <div class="tabs">
          <button class="tab-btn active" onclick="switchTab(this,'tab-ficha')">📋 Ficha Técnica</button>
          <button class="tab-btn" onclick="switchTab(this,'tab-equip')">⚡ Equipamiento y Seguridad</button>
          <button class="tab-btn" onclick="switchTab(this,'tab-garantia')">🛡️ Garantía y Documentación</button>
        </div>

        <!-- Ficha Técnica -->
        <div class="tab-content active" id="tab-ficha">
          <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden">
            <table class="spec-table">
              <tbody>
                ${buildSpecRows(p)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Equipamiento -->
        <div class="tab-content" id="tab-equip">
          <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:24px">
            <h3 style="margin-bottom:16px">Electrónica y Equipamiento</h3>
            ${renderEquipamiento(p)}
          </div>
        </div>

        <!-- Garantía -->
        <div class="tab-content" id="tab-garantia">
          <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:32px">
            <h3 style="margin-bottom:24px">Garantía y Documentación Oficial</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px">
              ${[
                { icon: '🔧', title: 'Inspección PDI 40 Puntos', desc: 'Revisión técnica exhaustiva certificada por nuestros técnicos especializados antes de cada entrega.' },
                { icon: '🔑', title: '2 Llaves Codificadas Selladas', desc: 'Entregamos 2 llaves originales codificadas en bolsa sellada de fábrica con número de serie.' },
                { icon: '📖', title: 'Manual del Propietario', desc: 'Manual oficial en español con todas las especificaciones y programa de mantenimiento.' },
                { icon: '🛡️', title: 'Garantía 24 Meses', desc: 'Garantía completa de fábrica por 24 meses o según el kilometraje definido por el fabricante.' },
              ].map(g => `
                <div style="display:flex;gap:16px;align-items:flex-start;padding:20px;background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:var(--radius-md)">
                  <span style="font-size:1.8rem;flex-shrink:0">${g.icon}</span>
                  <div>
                    <h4 style="font-size:0.95rem;margin-bottom:6px">${g.title}</h4>
                    <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6">${g.desc}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Store current product state for cart
  window._detailProduct = p;
  window._detailQty = 1;
  window._detailColor = colores[0]?.nombre || 'Estándar';
  window._detailStock = p.stock_disponible;
}

function buildSpecRows(p) {
  const specs = [
    ['Marca', p.marca],
    ['Modelo', p.nombre],
    ['Año', p.anio],
    ['Categoría', p.categoria],
    ['Cilindrada', p.cilindrada_cc ? `${p.cilindrada_cc} cc` : null],
    ['Potencia', p.potencia_hp ? `${p.potencia_hp} HP` : null],
    ['Torque', p.torque_nm ? `${p.torque_nm} Nm` : null],
    ['Peso', p.peso_kg ? `${p.peso_kg} kg` : null],
    ['Tanque', p.tanque_litros ? `${p.tanque_litros} L` : null],
    ['Consumo', p.consumo_kmpl ? `${p.consumo_kmpl} km/L` : null],
    ['Velocidad Máx.', p.velocidad_max_kmh ? `${p.velocidad_max_kmh} km/h` : null],
    ['Frenos Delantero', p.frenos_delantero],
    ['Frenos Trasero', p.frenos_trasero],
    ['Suspensión Delantera', p.suspension_delantera],
    ['Suspensión Trasera', p.suspension_trasera],
    ['Stock Disponible', p.stock_disponible !== undefined ? `${p.stock_disponible} unidades` : null],
  ];

  return specs
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `
      <tr>
        <th>${k}</th>
        <td>${v}</td>
      </tr>
    `).join('');
}

function renderEquipamiento(p) {
  if (!p.electronica) {
    return '<p style="color:var(--text-muted)">Información de equipamiento no disponible.</p>';
  }

  const items = p.electronica.split(',').map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return `<p style="color:var(--text-secondary)">${p.electronica}</p>`;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${items.map(item => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:var(--radius-sm)">
          <span style="color:var(--success);font-size:1rem">✓</span>
          <span style="font-size:0.85rem;color:var(--text-secondary)">${item}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function swapGalleryImage(src, thumbEl) {
  const main = $('#main-gallery-img');
  if (main) main.src = src;
  $$('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumbEl.classList.add('active');
}

function selectColor(el, colorName) {
  $$('.color-swatch').forEach(s => { s.classList.remove('active'); s.setAttribute('aria-checked', 'false'); });
  el.classList.add('active');
  el.setAttribute('aria-checked', 'true');
  window._detailColor = colorName;
  const label = $('#color-label');
  if (label) label.innerHTML = `Color: <strong>${colorName}</strong>`;
}

function changeQty(delta) {
  const max = window._detailStock || 1;
  window._detailQty = Math.max(1, Math.min(max, (window._detailQty || 1) + delta));
  const display = $('#qty-display');
  if (display) display.textContent = window._detailQty;
}

function handleAddToCart(p) {
  const imagen = getProductMainImage(p);
  addToCart({
    productoId: p.id || p.slug,
    slug: p.slug,
    nombre: p.nombre,
    color: window._detailColor || 'Estándar',
    cantidad: window._detailQty || 1,
    precio_usd: p.precio_usd,
    imagen,
  });
}

function switchTab(btn, tabId) {
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  $$('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
}

/* ============================================================
   VIEW: COMPARADOR (#/comparador)
   ============================================================ */
async function renderComparador(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Comparador de Modelos</h1>
        <p>Compara hasta 3 motocicletas lado a lado</p>
      </div>
    </div>
    <div class="section">
      <div id="comparador-content">
        <div class="spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  const content = $('#comparador-content');

  if (state.comparador.length < 2) {
    content.innerHTML = `
      <div class="comparador-empty">
        <span style="font-size:4rem;display:block;margin-bottom:20px">⚖️</span>
        <h3>Agrega productos desde el catálogo para comparar</h3>
        <p style="color:var(--text-muted);margin:12px 0 24px">Selecciona entre 2 y 3 motocicletas usando el botón "+ Comparar"</p>
        <a href="#/catalogo" class="btn btn-primary">🏍️ Ir al Catálogo</a>
      </div>
    `;
    return;
  }

  // Fetch all selected products
  let products = [];
  try {
    const promises = state.comparador.map(slug => apiFetch(`/productos/${slug}`));
    products = await Promise.all(promises);
  } catch (e) {
    content.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>${e.message}</p></div>`;
    return;
  }

  // Determine best values
  const getNum = (p, field) => parseFloat(p[field]) || 0;
  const best = {
    precio_usd: products.reduce((a, b) => getNum(a, 'precio_usd') <= getNum(b, 'precio_usd') ? a : b).slug,
    cilindrada_cc: products.reduce((a, b) => getNum(a, 'cilindrada_cc') >= getNum(b, 'cilindrada_cc') ? a : b).slug,
    potencia_hp: products.reduce((a, b) => getNum(a, 'potencia_hp') >= getNum(b, 'potencia_hp') ? a : b).slug,
    peso_kg: products.reduce((a, b) => getNum(a, 'peso_kg') <= getNum(b, 'peso_kg') ? a : b).slug,
    torque_nm: products.reduce((a, b) => getNum(a, 'torque_nm') >= getNum(b, 'torque_nm') ? a : b).slug,
    velocidad_max_kmh: products.reduce((a, b) => getNum(a, 'velocidad_max_kmh') >= getNum(b, 'velocidad_max_kmh') ? a : b).slug,
    consumo_kmpl: products.reduce((a, b) => getNum(a, 'consumo_kmpl') >= getNum(b, 'consumo_kmpl') ? a : b).slug,
    tanque_litros: products.reduce((a, b) => getNum(a, 'tanque_litros') >= getNum(b, 'tanque_litros') ? a : b).slug,
  };

  function td(p, field, format) {
    const val = p[field];
    const isBest = best[field] === p.slug && products.filter(pr => pr[field]).length > 1;
    const display = val !== null && val !== undefined && val !== '' ? (format ? format(val) : val) : '—';
    return `<td class="${isBest ? 'best' : ''}">${display}</td>`;
  }

  const rows = [
    { label: 'Precio', field: 'precio_usd', fmt: v => `$${fmt(v)}` },
    { label: 'Marca', field: 'marca' },
    { label: 'Categoría', field: 'categoria' },
    { label: 'Cilindrada', field: 'cilindrada_cc', fmt: v => `${v} cc` },
    { label: 'Potencia', field: 'potencia_hp', fmt: v => `${v} HP` },
    { label: 'Torque', field: 'torque_nm', fmt: v => `${v} Nm` },
    { label: 'Peso', field: 'peso_kg', fmt: v => `${v} kg` },
    { label: 'Tanque', field: 'tanque_litros', fmt: v => `${v} L` },
    { label: 'Consumo', field: 'consumo_kmpl', fmt: v => `${v} km/L` },
    { label: 'Vel. Máxima', field: 'velocidad_max_kmh', fmt: v => `${v} km/h` },
    { label: 'Frenos Del.', field: 'frenos_delantero' },
    { label: 'Frenos Tras.', field: 'frenos_trasero' },
    { label: 'Suspensión Del.', field: 'suspension_delantera' },
    { label: 'Suspensión Tras.', field: 'suspension_trasera' },
  ];

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <button class="btn btn-secondary" onclick="clearComparador()">🗑️ Limpiar Comparador</button>
    </div>
    <div class="comparador-table-wrap">
      <table class="comparador-table">
        <thead>
          <tr>
            <th style="background:var(--bg-elevated)"></th>
            ${products.map(p => {
              const img = getProductMainImage(p);
              return `
                <th class="product-header-cell">
                  <div class="comparador-product-header">
                    <img src="${img}" alt="${p.nombre}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=300&q=80'">
                    <strong style="font-size:0.9rem;line-height:1.3">${p.nombre}</strong>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${p.anio || ''}</div>
                    <button class="btn btn-secondary btn-sm" onclick="toggleComparador('${p.slug}','${p.nombre.replace(/'/g, "\\'")}');renderComparador($('#app-container'))">Quitar</button>
                  </div>
                </th>
              `;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <th>${row.label}</th>
              ${products.map(p => td(p, row.field, row.fmt)).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function clearComparador() {
  state.comparador = [];
  saveComparador();
  updateComparadorBadge();
  renderComparador($('#app-container'));
}

/* ============================================================
   VIEW: CHECKOUT (#/checkout)
   ============================================================ */
async function renderCheckout(container) {
  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="min-height:70vh">
        <span class="empty-icon">🛒</span>
        <h3>Tu carrito está vacío</h3>
        <p>Agrega productos antes de proceder al checkout</p>
        <a href="#/catalogo" class="btn btn-primary">🏍️ Explorar Catálogo</a>
      </div>
    `;
    return;
  }

  const subtotal = getCartTotal();
  const soat = subtotal * 0.05;
  const total = subtotal + soat;
  const refCode = genCode('MC-2026', 4);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Checkout</h1>
        <p>Completa tu pedido de forma segura</p>
      </div>
    </div>
    <div class="section">
      <div class="checkout-layout">
        <!-- Left: Forms -->
        <div>
          <!-- Buyer Form -->
          <div class="checkout-section">
            <h3>👤 Datos del Comprador</h3>
            <div class="form-grid" id="buyer-form">
              <div class="form-group">
                <label for="b-nombre">Nombre Completo *</label>
                <input type="text" id="b-nombre" placeholder="Ej: Juan Carlos Flores" required value="${state.currentUser?.nombre || ''}">
              </div>
              <div class="form-group">
                <label for="b-email">Email *</label>
                <input type="email" id="b-email" placeholder="correo@ejemplo.com" required value="${state.currentUser?.email || ''}">
              </div>
              <div class="form-group">
                <label for="b-telefono">Teléfono *</label>
                <input type="tel" id="b-telefono" placeholder="+591 70000000">
              </div>
              <div class="form-group">
                <label for="b-ci">CI / NIT *</label>
                <input type="text" id="b-ci" placeholder="12345678">
              </div>
              <div class="form-group">
                <label for="b-ciudad">Ciudad *</label>
                <select id="b-ciudad">
                  <option value="">Seleccionar ciudad</option>
                  ${['La Paz','Santa Cruz','Cochabamba','Sucre','Oruro','Potosí','Tarija','Beni','Pando'].map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              <div class="form-group full">
                <label for="b-direccion">Dirección de Entrega *</label>
                <input type="text" id="b-direccion" placeholder="Calle, número, zona, referencias">
              </div>
            </div>
          </div>

          <!-- Payment Method -->
          <div class="checkout-section">
            <h3>💳 Método de Pago</h3>
            <div class="payment-tabs">
              <button class="payment-tab-btn active" onclick="switchPayment(this,'pay-paypal')">
                <span class="pay-icon">🅿️</span>PayPal
              </button>
              <button class="payment-tab-btn" onclick="switchPayment(this,'pay-qr')">
                <span class="pay-icon">📱</span>QR Bancario
              </button>
              <button class="payment-tab-btn" onclick="switchPayment(this,'pay-deposito')">
                <span class="pay-icon">🏦</span>Depósito Bancario
              </button>
            </div>

            <!-- PayPal Panel -->
            <div class="payment-panel active" id="pay-paypal">
              <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px">
                Pago seguro procesado por PayPal. Total a pagar: <strong class="mono">$${fmt(total)}</strong>
              </p>
              <div id="paypal-button-container"></div>
            </div>

            <!-- QR Panel -->
            <div class="payment-panel" id="pay-qr">
              <div class="qr-section">
                <div id="qrcode"></div>
                <div class="qr-info">
                  Banco BISA S.A. | MotoConnect S.R.L.<br>
                  Monto: <strong>$${fmt(total)} USD</strong> (${(total * BS_RATE).toFixed(2)} Bs)<br>
                  Ref: <strong>${refCode}</strong>
                  <div style="margin-top:10px">
                    <button type="button" class="btn btn-outline btn-sm" onclick="downloadQR('${refCode}')">
                      📥 Descargar Código QR
                    </button>
                  </div>
                </div>
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <label for="qr-ref">Número de Referencia / Transacción *</label>
                <input type="text" id="qr-ref" placeholder="Ej: TXN-20260101-123456">
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <label for="qr-comp">Comprobante de Pago (imagen) *</label>
                <input type="file" id="qr-comp" accept="image/*">
              </div>
              <button class="btn btn-primary w-full" onclick="submitBancario('qr','${refCode}')">
                📤 Enviar Comprobante QR
              </button>
            </div>

            <!-- Depósito Panel -->
            <div class="payment-panel" id="pay-deposito">
              <div class="bank-details">
                <div class="bank-item">
                  <div class="bank-name">Banco BISA S.A.</div>
                  <div class="bank-detail-row"><span>Cta Cte:</span><strong>1-2345678-01</strong></div>
                  <div class="bank-detail-row"><span>NIT:</span><strong>123456789</strong></div>
                  <div class="bank-detail-row"><span>A nombre de:</span><strong>MotoConnect S.R.L.</strong></div>
                </div>
                <div class="bank-item">
                  <div class="bank-name">Banco Unión S.A.</div>
                  <div class="bank-detail-row"><span>Cta Cte:</span><strong>9-8765432-01</strong></div>
                  <div class="bank-detail-row"><span>NIT:</span><strong>123456789</strong></div>
                  <div class="bank-detail-row"><span>A nombre de:</span><strong>MotoConnect S.R.L.</strong></div>
                </div>
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <label for="dep-ref">Número de Referencia del Depósito *</label>
                <input type="text" id="dep-ref" placeholder="Ej: DEP-20260101-789">
              </div>
              <div class="form-group" style="margin-bottom:16px">
                <label for="dep-comp">Boleta/Comprobante de Depósito (imagen) *</label>
                <input type="file" id="dep-comp" accept="image/*">
              </div>
              <button class="btn btn-primary w-full" onclick="submitBancario('deposito','${refCode}')">
                📤 Enviar Comprobante de Depósito
              </button>
            </div>
          </div>
        </div>

        <!-- Right: Order Summary -->
        <div class="order-summary">
          <div class="checkout-section">
            <h3>🛒 Resumen del Pedido</h3>
            <div class="summary-items">
              ${state.cart.map(item => `
                <div class="summary-item">
                  <img class="summary-item-img" src="${getProductMainImage(item)}" alt="${item.nombre}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80'">
                  <div class="summary-item-info">
                    <div class="summary-item-name">${item.nombre}</div>
                    <div class="summary-item-detail">${item.color} · x${item.cantidad}</div>
                  </div>
                  <span class="summary-item-price">$${fmt(item.precio_usd * item.cantidad)}</span>
                </div>
              `).join('')}
            </div>
            <div class="summary-totals">
              <div class="summary-row">
                <span>Subtotal</span>
                <span class="mono">$${fmt(subtotal)}</span>
              </div>
              <div class="summary-row">
                <span>Gestión Documental y SOAT (5%)</span>
                <span class="mono">$${fmt(soat)}</span>
              </div>
              <div class="summary-row total">
                <span>Total</span>
                <span class="mono">$${fmt(total)}</span>
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);font-family:'JetBrains Mono',monospace">${fmtBs(total)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Init PayPal
  setTimeout(() => initPayPal(total, refCode), 300);
  setTimeout(() => renderQRCode(total, refCode), 400);
}

function renderQRCode(total, refCode) {
  const qrEl = document.getElementById('qrcode');
  if (!qrEl) return;
  qrEl.innerHTML = '';
  const qrText = `Banco BISA S.A. | MotoConnect S.R.L. | Monto: $${fmt(total)} USD | Ref: ${refCode}`;
  if (window.QRCode) {
    new QRCode(qrEl, {
      text: qrText,
      width: 180,
      height: 180,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  } else {
    qrEl.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrText)}" alt="Código QR Banco BISA" width="180" height="180" style="border-radius:8px">`;
  }
}

function downloadQR(refCode) {
  const qrEl = document.getElementById('qrcode');
  if (!qrEl) return;
  const canvas = qrEl.querySelector('canvas');
  const img = qrEl.querySelector('img');
  let dataUrl = null;
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else if (img && img.src.startsWith('data:')) {
    dataUrl = img.src;
  } else if (img) {
    window.open(img.src, '_blank');
    return;
  }
  if (dataUrl) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR-Pago-MotoConnect-${refCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Código QR descargado', 'success');
  } else {
    showToast('Generando imagen de QR...', 'info');
  }
}

function switchPayment(btn, panelId) {
  $$('.payment-tab-btn').forEach(b => b.classList.remove('active'));
  $$('.payment-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');

  // Init QR if switching to QR tab
  if (panelId === 'pay-qr') {
    const qrEl = document.getElementById('qrcode');
    if (qrEl && !qrEl.hasChildNodes()) {
      const total = getCartTotal() * 1.05;
      const refCode = $('#summary-ref')?.textContent?.replace('Ref: ', '') || 'MC-2026-QR';
      renderQRCode(total, refCode);
    }
  }
}

function getBuyerData() {
  return {
    nombre: $('#b-nombre')?.value?.trim() || '',
    email: $('#b-email')?.value?.trim() || '',
    telefono: $('#b-telefono')?.value?.trim() || '',
    ci_nit: $('#b-ci')?.value?.trim() || '',
    ciudad: $('#b-ciudad')?.value || '',
    direccion: $('#b-direccion')?.value?.trim() || '',
  };
}

function validateBuyer(data) {
  for (const [k, v] of Object.entries(data)) {
    if (!v) {
      showToast(`El campo "${k}" es requerido`, 'warning');
      return false;
    }
  }
  return true;
}

function initPayPal(total, refCode) {
  if (!window.paypal) return;
  const container = document.getElementById('paypal-button-container');
  if (!container) return;

  window.paypal.Buttons({
    createOrder(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: fmt(total),
            currency_code: 'USD',
          },
          description: `MotoConnect Pedido ${refCode}`,
        }],
      });
    },
    async onApprove(data, actions) {
      try {
        const details = await actions.order.capture();
        const buyer = getBuyerData();
        if (!validateBuyer(buyer)) return;

        const payload = {
          orderID: details.id,
          buyer,
          items: state.cart,
          total,
          refCode,
        };

        let pedidoCode = refCode;
        try {
          const result = await apiFetch('/pedidos/paypal', {
            method: 'POST',
            body: payload,
          });
          pedidoCode = result.codigo || refCode;
        } catch (e) {
          console.warn('API not available, proceeding with local confirmation');
        }

        showOrderConfirmation(pedidoCode, 'PayPal', total);
      } catch (err) {
        showToast('Error al procesar el pago: ' + err.message, 'danger');
      }
    },
    onError(err) {
      showToast('Error PayPal: ' + err.message, 'danger');
    },
  }).render('#paypal-button-container');
}

async function submitBancario(tipo, refCode) {
  const buyer = getBuyerData();
  if (!validateBuyer(buyer)) return;

  const isQR = tipo === 'qr';
  const ref = isQR ? $('#qr-ref')?.value?.trim() : $('#dep-ref')?.value?.trim();
  const fileInput = isQR ? $('#qr-comp') : $('#dep-comp');
  const file = fileInput?.files?.[0];

  if (!ref) { showToast('Ingresa el número de referencia', 'warning'); return; }
  if (!file) { showToast('Adjunta el comprobante de pago', 'warning'); return; }

  const formData = new FormData();
  formData.append('tipo', tipo);
  formData.append('referencia_pago', ref);
  formData.append('comprobante', file);
  formData.append('buyer', JSON.stringify(buyer));
  formData.append('items', JSON.stringify(state.cart));
  formData.append('total', getCartTotal() * 1.05);
  formData.append('refCode', refCode);

  let pedidoCode = refCode;
  try {
    const result = await apiFetch('/pedidos/bancario', {
      method: 'POST',
      body: formData,
    });
    pedidoCode = result.codigo || refCode;
  } catch (e) {
    console.warn('API not available, proceeding with local confirmation:', e.message);
  }

  showOrderConfirmation(pedidoCode, tipo === 'qr' ? 'QR Bancario' : 'Depósito Bancario', getCartTotal() * 1.05);
}

function showOrderConfirmation(code, paymentMethod, total) {
  // Clear cart
  state.cart = [];
  saveCart();
  updateCartBadge();

  const container = $('#app-container');
  container.innerHTML = `
    <div class="section" style="min-height:70vh;display:flex;align-items:center;justify-content:center">
      <div class="order-confirmation">
        <div class="confirmation-icon">🎉</div>
        <h1 style="font-size:2rem;margin-bottom:12px">¡Pedido Registrado!</h1>
        <p style="color:var(--text-secondary);margin-bottom:16px">Tu pedido ha sido recibido y está siendo procesado</p>
        <div class="confirmation-code">${code}</div>
        <div style="margin:16px 0;padding:16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);text-align:left">
          <div class="summary-row" style="margin-bottom:8px">
            <span style="color:var(--text-secondary)">Método de pago:</span>
            <strong>${paymentMethod}</strong>
          </div>
          <div class="summary-row">
            <span style="color:var(--text-secondary)">Total:</span>
            <span class="mono" style="font-size:1.1rem;font-weight:700">$${fmt(total)}</span>
          </div>
        </div>
        <div class="alert alert-warning" style="margin:16px 0;text-align:left">
          ⏳ Tu pago está en revisión. Recibirás una confirmación una vez verificado.
        </div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px">
          <a href="#/mis-pedidos" class="btn btn-primary">📦 Ver Mis Pedidos</a>
          <a href="#/catalogo" class="btn btn-secondary">🏍️ Seguir Comprando</a>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   VIEW: MIS PEDIDOS (#/mis-pedidos)
   ============================================================ */
async function renderMisPedidos(container) {
  if (!state.currentUser) {
    container.innerHTML = `
      <div class="login-prompt" style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <span style="font-size:4rem;margin-bottom:24px">🔐</span>
        <h2>Inicia sesión para ver tus pedidos</h2>
        <p>Necesitas una cuenta para acceder al historial de pedidos</p>
        <a href="#/login" class="btn btn-primary btn-lg">Iniciar Sesión</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Mis Pedidos</h1>
        <p>Historial y seguimiento de tus pedidos</p>
      </div>
    </div>
    <div class="section">
      <div id="orders-content">
        <div class="spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  try {
    const data = await apiFetch(`/pedidos?email=${encodeURIComponent(state.currentUser.email)}`);
    const orders = Array.isArray(data) ? data : (data.pedidos || data.data || []);
    renderOrdersList(orders);
  } catch (e) {
    const content = $('#orders-content');
    if (content) content.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <h3>No se pudieron cargar los pedidos</h3>
        <p>${e.message}</p>
        <p style="margin-top:8px;font-size:0.82rem;color:var(--text-muted)">Si el servidor no está disponible, intenta más tarde.</p>
      </div>
    `;
  }
}

function renderOrdersList(orders) {
  const content = $('#orders-content');
  if (!content) return;

  if (orders.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📦</span>
        <h3>Sin pedidos aún</h3>
        <p>Cuando realices tu primera compra, aparecerá aquí</p>
        <a href="#/catalogo" class="btn btn-primary" style="margin-top:16px">🏍️ Explorar Catálogo</a>
      </div>
    `;
    return;
  }

  const TIMELINE_STEPS = [
    { key: 'EN_REVISION', label: 'Pago\nRegistrado', icon: '📋' },
    { key: 'LISTO_PARA_PREPARAR', label: 'Pago\nVerificado', icon: '✅' },
    { key: 'EMPACADO_LISTO_DESPACHO', label: 'Preparación\nPDI', icon: '📦' },
    { key: 'EN_RUTA_ENTREGA', label: 'En Ruta\nEntrega', icon: '🚚' },
    { key: 'ENTREGADO_FINALIZADO', label: 'Entregado\ny Finalizado', icon: '🏁' },
  ];

  const stepOrder = ['EN_REVISION', 'LISTO_PARA_PREPARAR', 'EMPACADO_LISTO_DESPACHO', 'EN_RUTA_ENTREGA', 'ENTREGADO_FINALIZADO'];

  content.innerHTML = `<div class="orders-list">${orders.map(order => {
    const currentStepIdx = stepOrder.indexOf(order.estado_logistico);
    let items = [];
    try { items = JSON.parse(order.items_json || '[]'); } catch(e) { items = []; }

    const timelineHTML = TIMELINE_STEPS.map((step, idx) => {
      let cls = '';
      if (order.estado_pago === 'RECHAZADO' && idx === 0) {
        cls = 'rejected';
      } else if (currentStepIdx > idx) {
        cls = 'done';
      } else if (currentStepIdx === idx) {
        cls = 'current';
      }
      return `
        <div class="timeline-step ${cls}">
          <div class="timeline-dot">${step.icon}</div>
          <div class="timeline-label">${step.label.replace('\n','<br>')}</div>
        </div>
      `;
    }).join('');

    const statusBadge = (() => {
      if (order.estado_pago === 'RECHAZADO') return `<span class="status-badge status-rejected">❌ Rechazado</span>`;
      if (order.estado_pago === 'VERIFICADO') return `<span class="status-badge status-verified">✅ Pago Verificado</span>`;
      return `<span class="status-badge status-pending">⏳ En Revisión</span>`;
    })();

    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <div class="order-code">${order.codigo || order.id}</div>
            <div class="order-date">${order.fecha_pedido ? new Date(order.fecha_pedido).toLocaleDateString('es-BO', { year:'numeric',month:'long',day:'numeric' }) : 'Fecha no disponible'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            ${statusBadge}
            <div class="order-total mono">$${fmt(order.total_usd || 0)}</div>
          </div>
        </div>

        <!-- Items -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          ${items.slice(0, 4).map(item => `
            <div style="display:flex;gap:8px;align-items:center;padding:8px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border-color)">
              <span style="font-size:0.82rem;font-weight:600">${item.nombre || item.nombre_producto}</span>
              <span style="font-size:0.75rem;color:var(--text-muted)">x${item.cantidad}</span>
            </div>
          `).join('')}
          ${items.length > 4 ? `<span style="font-size:0.8rem;color:var(--text-muted);padding:8px">+${items.length - 4} más</span>` : ''}
        </div>

        <!-- Timeline -->
        <div class="timeline">${timelineHTML}</div>

        <!-- VIN -->
        ${order.vin ? `
          <div style="margin-top:12px">
            <span class="vin-badge">🏷️ VIN: ${order.vin}</span>
          </div>
        ` : ''}

        <!-- Rejection reason -->
        ${order.estado_pago === 'RECHAZADO' && order.motivo_rechazo ? `
          <div class="alert alert-danger" style="margin-top:12px">
            <span>❌</span>
            <div>
              <strong>Pago rechazado:</strong> ${order.motivo_rechazo}
              <br><small style="opacity:0.8">Contacta soporte para más información.</small>
            </div>
          </div>
        ` : ''}

        <!-- Certificate Button -->
        ${order.estado_logistico === 'ENTREGADO_FINALIZADO' ? `
          <div style="margin-top:16px">
            <button class="btn btn-secondary btn-sm" onclick="openCertificate(${JSON.stringify(order).replace(/"/g, '&quot;')})">
              📄 Ver Certificado de Entrega
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('')}</div>`;
}

function openCertificate(order) {
  let items = [];
  try { items = JSON.parse(order.items_json || '[]'); } catch(e) {}

  const sigHTML = order.firma_entrega_base64
    ? `<img class="cert-sig-img" src="${order.firma_entrega_base64}" alt="Firma digital">`
    : '<span style="color:#999">No disponible</span>';

  const certHTML = `
    <div class="certificate" id="cert-print">
      <div class="certificate-header">
        <div class="certificate-logo">MOTO<span>CONNECT</span></div>
        <div class="certificate-title">Certificado Oficial de Entrega y Garantía</div>
        <div style="font-size:0.8rem;color:#666;margin-top:6px">Documento válido como acta de recepción</div>
      </div>

      <div class="certificate-section">
        <h4>Información del Pedido</h4>
        <div class="certificate-grid">
          <div class="certificate-field"><label>Código de Pedido</label><strong>${order.codigo || order.id}</strong></div>
          <div class="certificate-field"><label>Fecha de Entrega</label><strong>${order.fecha_entrega ? new Date(order.fecha_entrega).toLocaleDateString('es-BO') : new Date().toLocaleDateString('es-BO')}</strong></div>
          <div class="certificate-field"><label>Total Pagado</label><strong>$${fmt(order.total_usd || 0)} USD</strong></div>
          <div class="certificate-field"><label>Método de Pago</label><strong>${order.metodo_pago || 'N/D'}</strong></div>
        </div>
      </div>

      <div class="certificate-section">
        <h4>Datos del Cliente</h4>
        <div class="certificate-grid">
          <div class="certificate-field"><label>Nombre</label><strong>${order.nombre_comprador || order.buyer?.nombre || 'N/D'}</strong></div>
          <div class="certificate-field"><label>Email</label><strong>${order.email_comprador || order.buyer?.email || 'N/D'}</strong></div>
          <div class="certificate-field"><label>CI/NIT</label><strong>${order.ci_nit || 'N/D'}</strong></div>
          <div class="certificate-field"><label>Ciudad</label><strong>${order.ciudad || 'N/D'}</strong></div>
        </div>
      </div>

      <div class="certificate-section">
        <h4>Productos Entregados</h4>
        ${items.map(item => `
          <div style="padding:8px;border-bottom:1px solid #eee;font-size:0.88rem">
            <strong>${item.nombre || item.nombre_producto}</strong> — ${item.color || ''} × ${item.cantidad} — $${fmt((item.precio_usd || 0) * item.cantidad)}
          </div>
        `).join('')}
      </div>

      ${order.vin ? `
        <div class="certificate-section">
          <h4>VIN del Vehículo</h4>
          <div style="font-family:monospace;font-size:1.1rem;padding:8px;background:#f5f5f5;border-radius:4px;letter-spacing:0.1em">${order.vin}</div>
        </div>
      ` : ''}

      <div class="certificate-section">
        <h4>Inspección PDI — 40 Puntos</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.82rem">
          <div>✅ Nivel de aceite sintético verificado</div>
          <div>✅ Carga de batería y escaneo OBD</div>
          <div>✅ Presión de neumáticos y cadena</div>
          <div>✅ Embalaje y kit de herramientas</div>
        </div>
      </div>

      <div class="certificate-section">
        <h4>Receptor</h4>
        <div class="certificate-grid">
          <div class="certificate-field"><label>Nombre del Receptor</label><strong>${order.receptor_nombre || 'N/D'}</strong></div>
          <div class="certificate-field"><label>CI del Receptor</label><strong>${order.receptor_ci || 'N/D'}</strong></div>
        </div>
      </div>

      <div class="certificate-section">
        <h4>Firma Digital</h4>
        ${sigHTML}
      </div>

      <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:0.75rem;color:#999">
        MotoConnect S.R.L. — Certificado emitido electrónicamente el ${new Date().toLocaleDateString('es-BO')}
      </div>
    </div>
  `;

  openModal(
    '📄 Certificado de Entrega',
    certHTML,
    [{ label: '🖨️ Imprimir', cls: 'btn-primary', action: () => { window.print(); } }]
  );
}

/* ============================================================
   VIEW: PANEL OPERATIVO (#/panel)
   ============================================================ */
async function renderPanel(container) {
  if (!state.currentUser) {
    navigate('#/login');
    return;
  }
  if (state.currentUser.rol === 'CLIENTE') {
    navigate('#/');
    return;
  }

  const rol = state.currentUser.rol;
  const tabs = [];
  if (['ADMIN', 'VERIFICADOR_PAGOS'].includes(rol)) tabs.push({ id: 'verificacion', label: '💳 Verificación de Pagos', icon: '💳' });
  if (['ADMIN', 'ALMACEN_EMPAQUE'].includes(rol)) tabs.push({ id: 'empaque', label: '📦 Preparación y Empaque', icon: '📦' });
  if (['ADMIN', 'DESPACHO_ENTREGA'].includes(rol)) tabs.push({ id: 'despacho', label: '🚚 Despacho y Entrega', icon: '🚚' });
  if (rol === 'ADMIN') tabs.push({ id: 'inventario', label: '📊 Gestión de Inventario', icon: '📊' });

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Panel Operativo</h1>
        <p>Bienvenido, ${state.currentUser.nombre} · <span class="mono" style="color:var(--accent-primary)">${rol}</span></p>
      </div>
    </div>
    <div class="section">
      <div class="panel-layout">
        <aside class="panel-sidebar">
          <h4>Gestión Operativa</h4>
          ${tabs.map((t, i) => `
            <button class="panel-sidebar-btn ${i === 0 ? 'active' : ''}" onclick="switchPanelTab('${t.id}', this)">
              ${t.icon} ${t.label.replace(t.icon + ' ', '')}
            </button>
          `).join('')}
        </aside>
        <div class="panel-content" id="panel-content">
          <div class="spinner-wrap"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  // Load first tab
  if (tabs.length > 0) {
    await loadPanelTab(tabs[0].id);
  }
}

function switchPanelTab(tabId, btn) {
  $$('.panel-sidebar-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPanelTab(tabId);
}

async function loadPanelTab(tabId) {
  const content = $('#panel-content');
  if (!content) return;
  content.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;

  try {
    if (tabId === 'verificacion') await renderVerificacion(content);
    else if (tabId === 'empaque') await renderEmpaque(content);
    else if (tabId === 'despacho') await renderDespacho(content);
    else if (tabId === 'inventario') await renderInventario(content);
  } catch(e) {
    content.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>${e.message}</p></div>`;
  }
}

/* Panel: Verificación */
async function renderVerificacion(container) {
  let orders = [];
  try {
    const data = await apiFetch('/pedidos?estado_logistico=EN_REVISION');
    orders = Array.isArray(data) ? data : (data.pedidos || data.data || []);
  } catch(e) {
    orders = [];
  }

  if (orders.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span><h3>Sin pedidos pendientes</h3><p>Todos los pagos han sido procesados</p></div>`;
    return;
  }

  container.innerHTML = orders.map(order => {
    const rawComp = order.comprobante_url || order.comprobante_path;
    const comprobanteSrc = rawComp ? (rawComp.startsWith('http') ? rawComp : (rawComp.startsWith('/') ? rawComp : '/' + rawComp)) : null;
    const clienteNombre = order.cliente_nombre || order.nombre_comprador || 'Cliente';
    const clienteEmail = order.cliente_email || order.email_comprador || '';

    return `
      <div class="panel-card">
        <div class="panel-card-header">
          <div>
            <div class="panel-card-title">${order.codigo_orden || order.codigo || order.id}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
              ${clienteNombre} · ${clienteEmail} · <strong style="color:var(--accent-secondary)">${order.metodo_pago || 'N/D'}</strong>
            </div>
            <div style="margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:0.9rem;color:var(--accent-primary)">
              $${fmt(order.total_usd || 0)} USD
            </div>
            ${order.referencia_pago ? `<div style="font-size:0.78rem;color:var(--text-muted)">Ref: ${order.referencia_pago}</div>` : ''}
          </div>
          ${comprobanteSrc ? `
            <div style="text-align:right">
              <img src="${comprobanteSrc}" class="comprobante-preview" alt="Comprobante de Pago" title="Clic para ampliar"
                style="max-width:110px;max-height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);cursor:pointer"
                onclick="openModal('Comprobante de Pago','<div style=\\'text-align:center\\'><img src=\\'${comprobanteSrc}\\' style=\\'max-width:100%;max-height:80vh;border-radius:8px\\'></div>',[])">
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">Clic para ampliar</div>
            </div>
          ` : '<span style="font-size:0.8rem;color:var(--text-muted)">Sin comprobante adjunto</span>'}
        </div>
        <div class="panel-actions">
          <button class="btn btn-success btn-sm" onclick="aprobarPago('${order.id}')">✅ Aprobar Pago</button>
          <button class="btn btn-danger btn-sm" onclick="rechazarPago('${order.id}')">❌ Rechazar Pago</button>
        </div>
      </div>
    `;
  }).join('');
}

async function aprobarPago(orderId) {
  try {
    await apiFetch(`/pedidos/${orderId}/aprobar-pago`, { method: 'PATCH', body: {} });
    showToast('Pago aprobado exitosamente', 'success');
    await loadPanelTab('verificacion');
  } catch(e) {
    showToast('Error: ' + e.message, 'danger');
  }
}

function rechazarPago(orderId) {
  let reason = '';
  const content = `
    <div class="form-group">
      <label for="reject-reason">Motivo del Rechazo *</label>
      <textarea id="reject-reason" rows="3" placeholder="Ej: Monto incorrecto, comprobante ilegible..." style="resize:vertical"></textarea>
    </div>
  `;
  openModal('❌ Rechazar Pago', content, [
    {
      label: 'Confirmar Rechazo',
      cls: 'btn-danger',
      action: async () => {
        reason = $('#reject-reason')?.value?.trim();
        if (!reason) { showToast('Ingresa el motivo del rechazo', 'warning'); return; }
        try {
          await apiFetch(`/pedidos/${orderId}/rechazar-pago`, {
            method: 'PATCH',
            body: { motivo: reason },
          });
          closeAllModals();
          showToast('Pago rechazado', 'info');
          await loadPanelTab('verificacion');
        } catch(e) {
          showToast('Error: ' + e.message, 'danger');
        }
      },
    },
  ]);
}

/* Panel: Empaque */
async function renderEmpaque(container) {
  let orders = [];
  try {
    const data = await apiFetch('/pedidos?estado_pago=VERIFICADO');
    const all = Array.isArray(data) ? data : (data.pedidos || data.data || []);
    const exclude = ['EMPACADO_LISTO_DESPACHO', 'EN_RUTA_ENTREGA', 'ENTREGADO_FINALIZADO'];
    orders = all.filter(o => !exclude.includes(o.estado_logistico));
  } catch(e) {
    orders = [];
  }

  if (orders.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">📦</span><h3>Sin pedidos para empacar</h3><p>Todos los pedidos verificados han sido preparados</p></div>`;
    return;
  }

  container.innerHTML = orders.map(order => {
    let items = [];
    try { items = JSON.parse(order.items_json || '[]'); } catch(e) {}
    return `
      <div class="panel-card">
        <div class="panel-card-header">
          <div>
            <div class="panel-card-title">${order.codigo || order.id}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${order.nombre_comprador || 'Cliente'}</div>
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
              ${items.map(i => `<span class="spec-pill">${i.nombre || i.nombre_producto} x${i.cantidad}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary btn-sm" onclick="openEmpaqueModal('${order.id}','${order.codigo || order.id}')">
            📦 Preparar Envío
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openEmpaqueModal(orderId, orderCode) {
  const vinGen = genVIN();
  const pkgGen = genPKG();
  const content = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label for="emp-vin">VIN del Vehículo *</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="emp-vin" placeholder="JYARM..." value="${vinGen}" style="font-family:'JetBrains Mono',monospace">
          <button class="btn btn-secondary btn-sm" onclick="$('#emp-vin').value='${genVIN()}'">🔄 Generar</button>
        </div>
      </div>

      <div>
        <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:10px">Lista PDI — 40 Puntos *</label>
        <div class="pdi-checklist">
          <div class="pdi-item"><input type="checkbox" id="pdi-1"><label for="pdi-1">Nivel de aceite sintético, líquido de frenos y refrigerante verificados</label></div>
          <div class="pdi-item"><input type="checkbox" id="pdi-2"><label for="pdi-2">Carga de batería, voltaje y escaneo electrónico OBD sin fallos</label></div>
          <div class="pdi-item"><input type="checkbox" id="pdi-3"><label for="pdi-3">Presión de neumáticos, tensión de cadena y torque de ejes correctos</label></div>
          <div class="pdi-item"><input type="checkbox" id="pdi-4"><label for="pdi-4">Embalaje de protección, kit de herramientas, manual y 2 llaves selladas</label></div>
        </div>
      </div>

      <div class="form-group">
        <label for="emp-pkg">Código de Empaque *</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="emp-pkg" value="${pkgGen}" style="font-family:'JetBrains Mono',monospace">
          <button class="btn btn-secondary btn-sm" onclick="$('#emp-pkg').value='${genPKG()}'">🔄 Generar</button>
        </div>
      </div>

      <div class="form-group">
        <label for="emp-notas">Notas adicionales</label>
        <textarea id="emp-notas" rows="3" placeholder="Observaciones del proceso de empaque..."></textarea>
      </div>
    </div>
  `;

  openModal('📦 Preparar Empaque — ' + orderCode, content, [
    {
      label: '✅ Confirmar Empaque',
      cls: 'btn-primary',
      action: async () => {
        const vin = $('#emp-vin')?.value?.trim();
        const pkg = $('#emp-pkg')?.value?.trim();
        const notas = $('#emp-notas')?.value?.trim();
        const pdi = ['pdi-1','pdi-2','pdi-3','pdi-4'].map(id => document.getElementById(id)?.checked);

        if (!vin) { showToast('Ingresa el VIN', 'warning'); return; }
        if (!pkg) { showToast('Ingresa el código de empaque', 'warning'); return; }
        if (!pdi.every(Boolean)) { showToast('Debes completar todos los puntos PDI', 'warning'); return; }

        try {
          await apiFetch(`/pedidos/${orderId}/preparar-empaque`, {
            method: 'PATCH',
            body: { vin, codigo_empaque: pkg, notas, pdi_completado: true },
          });
          closeAllModals();
          showToast('Empaque confirmado', 'success');
          await loadPanelTab('empaque');
        } catch(e) {
          showToast('Error: ' + e.message, 'danger');
        }
      },
    },
  ]);
}

/* Panel: Despacho */
async function renderDespacho(container) {
  let orders = [];
  try {
    const data = await apiFetch('/pedidos?estado_logistico=EMPACADO_LISTO_DESPACHO,EN_RUTA_ENTREGA');
    orders = Array.isArray(data) ? data : (data.pedidos || data.data || []);
  } catch(e) {
    orders = [];
  }

  if (orders.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">🚚</span><h3>Sin pedidos para despachar</h3><p>No hay pedidos en tránsito actualmente</p></div>`;
    return;
  }

  container.innerHTML = orders.map(order => `
    <div class="panel-card">
      <div class="panel-card-header">
        <div>
          <div class="panel-card-title">${order.codigo || order.id}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${order.nombre_comprador || 'Cliente'} · ${order.ciudad || ''}</div>
          <div style="margin-top:8px">
            ${order.estado_logistico === 'EMPACADO_LISTO_DESPACHO'
              ? '<span class="status-badge status-info">📦 Listo para Despacho</span>'
              : '<span class="status-badge status-warning">🚚 En Ruta</span>'}
          </div>
        </div>
      </div>
      <div class="panel-actions">
        ${order.estado_logistico === 'EMPACADO_LISTO_DESPACHO' ? `
          <button class="btn btn-blue btn-sm" onclick="despacharPedido('${order.id}')">🚚 Despachar a Ruta</button>
        ` : `
          <button class="btn btn-success btn-sm" onclick="openEntregaModal('${order.id}','${order.codigo || order.id}')">🏁 Registrar Entrega</button>
        `}
      </div>
    </div>
  `).join('');
}

async function despacharPedido(orderId) {
  try {
    await apiFetch(`/pedidos/${orderId}/despachar`, { method: 'PATCH', body: {} });
    showToast('Pedido despachado a ruta', 'success');
    await loadPanelTab('despacho');
  } catch(e) {
    showToast('Error: ' + e.message, 'danger');
  }
}

function openEntregaModal(orderId, orderCode) {
  const content = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label for="ent-nombre">Nombre del Receptor *</label>
        <input type="text" id="ent-nombre" placeholder="Nombre completo de quien recibe">
      </div>
      <div class="form-group">
        <label for="ent-ci">CI del Receptor *</label>
        <input type="text" id="ent-ci" placeholder="Número de carnet de identidad">
      </div>
      <div class="signature-wrap">
        <label>Firma Digital *</label>
        <canvas id="sig-canvas" width="500" height="160"></canvas>
        <div class="sig-actions">
          <button class="btn btn-secondary btn-sm" onclick="clearSignature()">🗑️ Limpiar Firma</button>
          <span style="font-size:0.78rem;color:var(--text-muted);padding:8px">Dibuja con el mouse o toca la pantalla</span>
        </div>
      </div>
    </div>
  `;

  openModal('🏁 Registrar Entrega — ' + orderCode, content, [
    {
      label: '✅ Confirmar Entrega',
      cls: 'btn-success',
      action: async () => {
        const nombre = $('#ent-nombre')?.value?.trim();
        const ci = $('#ent-ci')?.value?.trim();
        if (!nombre) { showToast('Ingresa el nombre del receptor', 'warning'); return; }
        if (!ci) { showToast('Ingresa el CI del receptor', 'warning'); return; }

        const canvas = document.getElementById('sig-canvas');
        const sigData = canvas ? canvas.toDataURL('image/png') : '';
        if (!sigData || sigData === 'data:,') { showToast('Se requiere la firma digital', 'warning'); return; }

        try {
          await apiFetch(`/pedidos/${orderId}/entregar`, {
            method: 'PATCH',
            body: {
              receptor_nombre: nombre,
              receptor_ci: ci,
              firma_entrega_base64: sigData,
            },
          });
          closeAllModals();
          showToast('Entrega registrada exitosamente', 'success');
          await loadPanelTab('despacho');
        } catch(e) {
          showToast('Error: ' + e.message, 'danger');
        }
      },
    },
  ]);

  setTimeout(() => initSignatureCanvas(), 200);
}

function initSignatureCanvas() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    drawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
    e.preventDefault();
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastX = pos.x;
    lastY = pos.y;
  }

  function stopDraw() { drawing = false; }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw);
}

function clearSignature() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* Panel: Inventario */
async function renderInventario(container) {
  let products = [];
  try {
    const data = await apiFetch('/productos');
    products = Array.isArray(data) ? data : (data.productos || data.data || []);
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error</h3><p>${e.message}</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="panel-card">
      <h3 style="margin-bottom:20px">Gestión de Inventario</h3>
      <div style="overflow-x:auto">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Marca</th>
              <th>Stock Actual</th>
              <th>Ajuste</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td>
                  <strong style="font-size:0.88rem">${p.nombre}</strong>
                  <div style="font-size:0.75rem;color:var(--text-muted);font-family:'JetBrains Mono',monospace">${p.slug}</div>
                </td>
                <td><span class="spec-pill">${p.marca || '—'}</span></td>
                <td>
                  <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${p.stock_disponible === 0 ? 'var(--danger)' : p.stock_disponible <= 3 ? 'var(--warning)' : 'var(--success)'}">
                    ${p.stock_disponible}
                  </span>
                </td>
                <td>
                  <input type="number" id="stock-${p.id}" value="0" min="-${p.stock_disponible}" step="1"
                    style="width:80px;text-align:center" placeholder="±">
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="updateStock('${p.id}','${p.nombre}')">
                    💾 Actualizar
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function updateStock(productId, nombre) {
  const input = document.getElementById(`stock-${productId}`);
  if (!input) return;
  const delta = parseInt(input.value);
  if (isNaN(delta) || delta === 0) { showToast('Ingresa un ajuste válido (distinto de 0)', 'warning'); return; }

  try {
    await apiFetch(`/productos/${productId}/stock`, {
      method: 'PATCH',
      body: { delta },
    });
    showToast(`Stock de "${nombre}" actualizado`, 'success');
    input.value = 0;
    await loadPanelTab('inventario');
  } catch(e) {
    showToast('Error: ' + e.message, 'danger');
  }
}

/* ============================================================
   VIEW: LOGIN (#/login)
   ============================================================ */
function renderLogin(container) {
  if (state.currentUser) {
    navigate(state.currentUser.rol !== 'CLIENTE' ? '#/panel' : '#/');
    return;
  }

  container.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">
          <span class="nav-logo">MOTO<span>CONNECT</span></span>
        </div>
        <h2 class="login-title">Acceso Oficial Concesionario</h2>
        <p class="login-subtitle">Ingresa tus credenciales o selecciona un perfil operativo</p>

        <div id="login-error" class="login-error"></div>

        <div class="login-form">
          <div class="form-group">
            <label for="login-email">Correo Electrónico</label>
            <input type="email" id="login-email" placeholder="correo@motoconnect.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label for="login-password">Contraseña</label>
            <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password">
          </div>
          <button class="btn btn-primary w-full" id="login-submit" onclick="submitLogin()">
            🔐 Iniciar Sesión
          </button>
        </div>

        <!-- Demo credentials -->
        <div class="demo-creds">
          <h4>Perfiles y Roles Oficiales Disponibles</h4>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px">Haz clic en <strong>⚡ Entrar</strong> para iniciar sesión de inmediato con cualquier rol:</p>
          ${DEMO_USERS.map(u => `
            <div class="demo-user">
              <div class="demo-user-info">
                <div class="demo-user-email">${u.email} <span style="color:var(--text-muted);font-size:0.75rem">(pass: ${u.password})</span></div>
                <div class="demo-user-role" style="color:var(--accent-primary);font-weight:600">${u.rol}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary)">${u.cargo}</div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn-copy" onclick="quickLogin('${u.email}','${u.password}')" title="Iniciar sesión directo">
                  ⚡ Entrar
                </button>
                <button class="btn-copy" onclick="copyCredentials('${u.email}','${u.password}')" title="Copiar datos al formulario">
                  📋
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Allow Enter key
  const inputs = $$('#login-email, #login-password');
  inputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitLogin();
    });
  });
}

function copyCredentials(email, password) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = email;
  if (passInput) passInput.value = password;
  showToast('Credenciales ingresadas', 'success');
}

async function submitLogin() {
  const email = $('#login-email')?.value?.trim();
  const password = $('#login-password')?.value?.trim();
  const errorEl = $('#login-error');
  const submitBtn = $('#login-submit');

  if (!email || !password) {
    if (errorEl) { errorEl.textContent = 'Por favor ingresa email y contraseña'; errorEl.classList.add('show'); }
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Iniciando sesión...'; }

  try {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const user = result.user || result;
    saveUser(user);
    updateNavUI();
    showToast(`Bienvenido, ${user.nombre}`, 'success');
    navigate('#/');
  } catch(e) {
    if (errorEl) {
      errorEl.textContent = e.message || 'Credenciales incorrectas';
      errorEl.classList.add('show');
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🔐 Iniciar Sesión'; }
  }
}

/* ============================================================
   VIEW: 404
   ============================================================ */
function render404(container) {
  container.innerHTML = `
    <div class="empty-state" style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <span class="empty-icon" style="font-size:5rem">🏍️</span>
      <h1 style="font-size:4rem;font-weight:800;color:var(--accent-primary)">404</h1>
      <h3>Página no encontrada</h3>
      <p>La ruta que buscas no existe en MotoConnect</p>
      <a href="#/" class="btn btn-primary btn-lg" style="margin-top:24px">← Volver al Inicio</a>
    </div>
  `;
}

/* ============================================================
   MODALS SYSTEM
   ============================================================ */
function openModal(title, content, actions = []) {
  const container = $('#modals-container');
  if (!container) return;

  const id = 'modal-' + Date.now();
  const actionsHTML = actions.map((a, i) => `
    <button class="btn ${a.cls || 'btn-primary'}" id="modal-action-${id}-${i}">${a.label}</button>
  `).join('');

  container.innerHTML = `
    <div class="modal-overlay" id="${id}" onclick="handleModalOverlayClick(event,'${id}')">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-${id}">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title-${id}">${title}</h3>
          <button class="modal-close" onclick="closeModal('${id}')" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">${content}</div>
        ${actions.length > 0 ? `<div class="modal-actions">${actionsHTML}</div>` : ''}
      </div>
    </div>
  `;

  // Bind action callbacks
  actions.forEach((a, i) => {
    const btn = document.getElementById(`modal-action-${id}-${i}`);
    if (btn && a.action) btn.addEventListener('click', a.action);
  });
}

function handleModalOverlayClick(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function closeAllModals() {
  const container = $('#modals-container');
  if (container) container.innerHTML = '';
}

/* ============================================================
   INFO MODALS (Footer)
   ============================================================ */
function openInfoModal(type) {
  const data = {
    garantia: {
      title: '🛡️ Garantía Oficial MotoConnect',
      content: `
        <div class="info-modal-content">
          <h3>Cobertura de Garantía</h3>
          <p>Todos nuestros vehículos cuentan con garantía oficial de fábrica por <strong>24 meses</strong> desde la fecha de entrega.</p>
          <ul>
            <li>Motor y transmisión: 24 meses sin límite de kilometraje</li>
            <li>Sistema eléctrico: 12 meses</li>
            <li>Accesorios de equipamiento: 6 meses</li>
            <li>Corrosión estructural: 36 meses</li>
          </ul>
          <p>La garantía no cubre daños por accidente, mal uso o modificaciones no autorizadas.</p>
        </div>
      `,
    },
    terminos: {
      title: '📋 Términos y Condiciones',
      content: `
        <div class="info-modal-content">
          <h3>Términos de Uso y Venta</h3>
          <p>Al realizar una compra en MotoConnect S.R.L., aceptas los siguientes términos:</p>
          <ul>
            <li>Los precios están expresados en dólares americanos (USD)</li>
            <li>Los pagos son procesados de forma segura mediante PayPal o transferencia bancaria</li>
            <li>La entrega se realiza únicamente en territorio boliviano</li>
            <li>MotoConnect S.R.L. se reserva el derecho de cancelar pedidos en caso de fraude</li>
            <li>Toda la documentación legal requerida debe ser presentada al momento de la entrega</li>
          </ul>
          <p>© 2026 MotoConnect S.R.L. NIT: 123456789. Registrada en Bolivia.</p>
        </div>
      `,
    },
    entregas: {
      title: '🚚 Política de Entregas',
      content: `
        <div class="info-modal-content">
          <h3>Proceso de Entrega</h3>
          <ul>
            <li><strong>Verificación:</strong> Revisamos tu pago en 24-48 horas hábiles</li>
            <li><strong>Preparación PDI:</strong> Inspección técnica de 40 puntos (1-3 días)</li>
            <li><strong>Despacho:</strong> Coordinaremos el envío a tu dirección registrada</li>
            <li><strong>Entrega:</strong> Con acta oficial, firma digital y certificado</li>
          </ul>
          <p>Tiempo total estimado: <strong>5-10 días hábiles</strong> según disponibilidad.</p>
          <p>Las entregas se realizan en las principales ciudades de Bolivia.</p>
        </div>
      `,
    },
    soporte: {
      title: '📞 Soporte al Cliente',
      content: `
        <div class="info-modal-content">
          <h3>Canales de Atención</h3>
          <p>Estamos disponibles para ayudarte:</p>
          <ul>
            <li>📧 Email: soporte@motoconnect.bo</li>
            <li>📱 WhatsApp: +591 70000000</li>
            <li>☎️ Teléfono: +591 2-2000000</li>
            <li>🕐 Horario: Lunes a Viernes 8:00 - 18:00, Sábados 9:00 - 13:00</li>
          </ul>
          <p>Tiempo de respuesta promedio: <strong>2-4 horas hábiles</strong></p>
        </div>
      `,
    },
  };

  const info = data[type];
  if (!info) return;
  openModal(info.title, info.content, []);
}

/* ============================================================
   INITIALIZATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  updateNavUI();
  router();
});

window.addEventListener('hashchange', router);

// Make global functions accessible
window.navigate = navigate;
window.toggleComparador = toggleComparador;
window.openInfoModal = openInfoModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.logout = logout;
window.quickLogin = quickLogin;
window.submitLogin = submitLogin;
window.copyCredentials = copyCredentials;
window.openCart = openCart;
window.closeCart = closeCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQty = updateCartQty;
window.swapGalleryImage = swapGalleryImage;
window.selectColor = selectColor;
window.changeQty = changeQty;
window.handleAddToCart = handleAddToCart;
window.switchTab = switchTab;
window.switchPayment = switchPayment;
window.downloadQR = downloadQR;
window.renderQRCode = renderQRCode;
window.submitBancario = submitBancario;
window.clearComparador = clearComparador;
window.switchPanelTab = switchPanelTab;
window.aprobarPago = aprobarPago;
window.rechazarPago = rechazarPago;
window.openEmpaqueModal = openEmpaqueModal;
window.despacharPedido = despacharPedido;
window.openEntregaModal = openEntregaModal;
window.clearSignature = clearSignature;
window.updateStock = updateStock;
window.openCertificate = openCertificate;
window.handleModalOverlayClick = handleModalOverlayClick;
window.applyFilters = applyFilters;
window.renderComparador = renderComparador;
window.loadPanelTab = loadPanelTab;
window.$ = $;
window.$$ = $$;
