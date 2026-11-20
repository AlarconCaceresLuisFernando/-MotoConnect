/* ============================================================
   MotoConnect — components/navbar.js
   Barra de navegación, selector de rol (solo modo demo) y carrito lateral
   ============================================================ */

import { api } from '../api.js';
import { DEMO_USERS, OPERATIVE_ROLES, ROL_LABELS } from '../config.js';
import { state, setUser, persistCart, cartCount, cartSubtotal, cartUnitsOf } from '../state.js';
import { esc, fmt, fmtBs, toast, clearToasts, syncBadge, icon } from '../utils.js';

export async function loadAuthConfig() {
  if (state.authConfig.loaded) return state.authConfig;
  try {
    const cfg = await api('/auth/config');
    state.authConfig = { loaded: true, demoMode: Boolean(cfg.demoMode) };
  } catch {
    state.authConfig = { loaded: true, demoMode: false };
  }
  return state.authConfig;
}

/* ---------- Selector de sesión / rol ---------- */
function renderSessionArea() {
  const area = document.querySelector('#session-area');
  if (!area) return;

  if (!state.user) {
    area.innerHTML = '<a href="#/login" class="btn btn-outline btn-sm" id="login-btn">Iniciar Sesión</a>';
    return;
  }

  const initials = (state.user.nombre || '?')
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const demoSwitchEnabled = Boolean(state.authConfig.demoMode);
  const others = demoSwitchEnabled
    ? DEMO_USERS.filter(user => user.email !== state.user.email)
    : [];

  area.innerHTML = `
    <div class="user-dropdown-wrapper">
      <button class="user-badge" id="user-badge-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Opciones de cuenta">
        <span class="user-avatar">${esc(initials)}</span>
        <span class="user-info">
          <span class="user-name">${esc(state.user.nombre)}</span>
          <span class="user-role">${esc(ROL_LABELS[state.user.rol] || state.user.rol)} ▾</span>
        </span>
      </button>
      <div class="user-dropdown" id="user-dropdown">
        <div class="user-dropdown-header">
          <div style="font-weight:700;font-size:0.85rem">${esc(state.user.nombre)}</div>
          <div style="font-size:0.75rem;color:var(--accent-primary)">${esc(state.user.cargo_etiqueta || ROL_LABELS[state.user.rol] || state.user.rol)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${esc(state.user.email)}</div>
        </div>
        ${OPERATIVE_ROLES.includes(state.user.rol)
          ? '<button type="button" data-go-panel style="color:var(--accent-primary);font-weight:600">Ir al Panel Operativo</button>'
          : ''}
        <button type="button" data-go-orders>Mis Pedidos</button>
        ${others.length ? `
          <div class="user-dropdown-divider"></div>
          <div style="padding:6px 12px;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Modo demostración · Cambiar rol</div>
          ${others.map(user => `
            <button type="button" data-switch-role="${esc(user.email)}">
              <span style="display:flex;flex-direction:column;gap:2px">
                <span style="font-weight:600;color:var(--text-primary);font-size:0.82rem">${esc(user.nombre)}</span>
                <span style="font-size:0.72rem;color:var(--accent-secondary)">${esc(user.cargo)}</span>
              </span>
            </button>
          `).join('')}
        ` : ''}
        <div class="user-dropdown-divider"></div>
        <button type="button" data-logout style="color:var(--danger)">Cerrar Sesión</button>
      </div>
    </div>
  `;

  const badge = area.querySelector('#user-badge-btn');
  const dropdown = area.querySelector('#user-dropdown');

  badge.addEventListener('click', event => {
    event.stopPropagation();
    dropdown.classList.toggle('open');
    badge.setAttribute('aria-expanded', String(dropdown.classList.contains('open')));
  });

  area.querySelectorAll('[data-switch-role]').forEach(button => {
    button.addEventListener('click', async () => {
      const demo = DEMO_USERS.find(user => user.email === button.dataset.switchRole);
      if (!demo) return;
      try {
        const user = await api('/auth/login', {
          method: 'POST',
          body: { email: demo.email, password: demo.password },
        });
        setUser(user, user.token);
        refreshNav();
        toast(`Sesión activa: ${user.cargo_etiqueta || user.nombre}`, 'success');
        location.hash = OPERATIVE_ROLES.includes(user.rol) ? '#/panel' : '#/catalogo';
      } catch (error) {
        toast(error.message, 'danger');
      }
    });
  });

  area.querySelector('[data-go-panel]')?.addEventListener('click', () => {
    location.hash = '#/panel';
  });
  area.querySelector('[data-go-orders]')?.addEventListener('click', () => {
    location.hash = '#/mis-pedidos';
  });
  area.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setUser(null);
    refreshNav();
    toast('Sesión cerrada', 'info');
    location.hash = '#/login';
  });
}

/* ---------- Enlace Panel Operativo ---------- */
function renderPanelLink() {
  const li = document.querySelector('#nav-panel-li');
  if (!li) return;
  const visible = Boolean(state.user && OPERATIVE_ROLES.includes(state.user.rol));
  li.style.display = visible ? '' : 'none';
  const link = li.querySelector('a');
  if (link) {
    link.className = 'nav-link nav-link-panel';
    link.textContent = 'Panel Operativo';
    link.hidden = !visible;
  }
}

/* ---------- Carrito lateral ---------- */
export function renderCartDrawer() {
  const body = document.querySelector('#cart-drawer-body');
  const footer = document.querySelector('#cart-drawer-footer');
  if (!body || !footer) return;

  if (!state.cart.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon" style="display:flex;justify-content:center;color:var(--text-muted)">${icon('cart', 44)}</div>
        <p>Tu carrito está vacío</p>
        <a href="#/catalogo" class="btn btn-primary btn-sm" style="margin-top:16px" data-close-cart>Explorar Catálogo</a>
      </div>`;
    footer.innerHTML = '';
    return;
  }

  body.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${esc(item.imagen || '/images/productos/placeholder.svg')}" alt="${esc(item.nombre)}" onerror="this.src='/images/productos/placeholder.svg'">
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.nombre)}</div>
        <div class="cart-item-color">${esc(item.color || 'Estándar')}</div>
        <div class="cart-item-controls">
          <button type="button" class="cart-qty-btn" data-cart-minus="${esc(item.key)}" aria-label="Reducir cantidad">−</button>
          <span class="cart-qty-display">${item.cantidad}</span>
          <button type="button" class="cart-qty-btn" data-cart-plus="${esc(item.key)}" aria-label="Aumentar cantidad">+</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span class="cart-item-price">$${fmt(item.precio_usd * item.cantidad)}</span>
        <button type="button" class="cart-item-remove" data-cart-remove="${esc(item.key)}" aria-label="Eliminar producto">
          ${icon('x', 14)}
        </button>
      </div>
    </div>
  `).join('');

  const subtotal = cartSubtotal();
  footer.innerHTML = `
    <div class="cart-total-row">
      <span class="cart-total-label">Total estimado</span>
      <span class="cart-total-amount mono">${fmtBs(subtotal)}</span>
    </div>
    <div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:12px;font-family:'JetBrains Mono',monospace">≈ $${fmt(subtotal)} USD (+ 5% por gestión y trámite)</div>
    <a href="#/checkout" class="btn btn-primary w-full" data-close-cart>Finalizar Compra</a>
  `;
}

function openCart() {
  const drawer = document.querySelector('#cart-drawer');
  const overlay = document.querySelector('#cart-overlay');
  drawer?.classList.add('open');
  drawer?.setAttribute('aria-hidden', 'false');
  overlay?.classList.add('open');
  overlay?.setAttribute('aria-hidden', 'false');
  renderCartDrawer();
}

function closeCart() {
  const drawer = document.querySelector('#cart-drawer');
  const overlay = document.querySelector('#cart-overlay');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
  overlay?.classList.remove('open');
  overlay?.setAttribute('aria-hidden', 'true');
}

function bindCart() {
  const drawer = document.querySelector('#cart-drawer');
  if (!drawer) return;

  document.querySelector('#cart-btn')?.addEventListener('click', openCart);
  document.querySelector('#cart-close-btn')?.addEventListener('click', closeCart);
  document.querySelector('#cart-overlay')?.addEventListener('click', closeCart);
  drawer.addEventListener('click', event => {
    if (event.target.closest('[data-close-cart]')) {
      clearToasts();
      closeCart();
      return;
    }

    const control = event.target.closest('[data-cart-plus],[data-cart-minus],[data-cart-remove]');
    if (!control || !drawer.contains(control)) return;

    const isPlus = control.hasAttribute('data-cart-plus');
    const isMinus = control.hasAttribute('data-cart-minus');
    const key = isPlus
      ? control.dataset.cartPlus
      : isMinus
      ? control.dataset.cartMinus
      : control.dataset.cartRemove;

    const item = state.cart.find(entry => entry.key === key);
    if (!item) return;

    if (isPlus) {
      const max = Number(item.stock || 99);
      const units = cartUnitsOf(item.productoId);
      if (units >= max) {
        toast(`Solo hay ${max} unidad${max === 1 ? '' : 'es'} disponible${max === 1 ? '' : 's'}`, 'warning');
        return;
      }
      item.cantidad += 1;
    } else if (isMinus) {
      item.cantidad = Math.max(1, item.cantidad - 1);
    } else {
      state.cart = state.cart.filter(entry => entry.key !== key);
    }
    persistCart();
    refreshNav();
    renderCartDrawer();
  });
}

/* ---------- Badges y link activo ---------- */
function renderBadges() {
  syncBadge('cart-badge', cartCount());
  syncBadge('comparador-badge', state.comparador.length);
}

function highlightActive() {
  const hash = window.location.hash || '#/';
  const path = hash.slice(1).split('?')[0] || '/';
  document.querySelectorAll('.nav-link').forEach(link => {
    const route = link.dataset.route;
    link.classList.toggle('active', Boolean(route && path.startsWith(`/${route}`)));
  });
}

/* ---------- API pública ---------- */
export function initNavbar() {
  bindCart();
  document.addEventListener('click', event => {
    if (!event.target.closest('.user-dropdown-wrapper')) {
      document.querySelectorAll('.user-dropdown.open').forEach(el => el.classList.remove('open'));
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCart();
  });
  const hamburger = document.querySelector('#hamburger-btn');
  const links = document.querySelector('#nav-links');
  hamburger?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
  });
  links?.addEventListener('click', event => {
    if (event.target.closest('a')) {
      links.classList.remove('open');
      hamburger?.classList.remove('open');
    }
  });
}

export function refreshNav() {
  renderPanelLink();
  renderSessionArea();
  renderBadges();
  highlightActive();
  renderCartDrawer();
}
