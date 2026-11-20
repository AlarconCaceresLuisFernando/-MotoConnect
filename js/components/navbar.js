/* ============================================================
 MotoConnect — components/navbar.js
 Barra de navegación, selector de rol y carrito lateral
 ============================================================ */

import { api } from '../api.js';
import { DEMO_USERS, OPERATIVE_ROLES, ROL_LABELS } from '../config.js';
import { state, setUser, persistCart, cartCount, cartSubtotal, cartUnitsOf } from '../state.js';
import { esc, fmt, fmtBs, toast, syncBadge } from '../utils.js';

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
 .map(word => word[0])
 .slice(0, 2)
 .join('')
 .toUpperCase();

 const others = DEMO_USERS.filter(user => user.email !== state.user.email);

 area.innerHTML = `
 <div class="user-dropdown-wrapper">
 <button class="user-badge" id="user-badge-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Cambiar de rol o cerrar sesión">
 <span class="user-avatar">${esc(initials)}</span>
 <span class="user-info">
 <span class="user-name">${esc(state.user.nombre)}</span>
 <span class="user-role">${esc(state.user.rol)} ▾</span>
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
 <div class="user-dropdown-divider"></div>
 <div style="padding:6px 14px;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Cambiar rol en 1 clic</div>
 ${others.map(user => `
 <button type="button" data-switch-role="${esc(user.email)}">
 <span style="display:flex;flex-direction:column;gap:2px">
 <span style="font-weight:600;color:var(--text-primary);font-size:0.82rem">${esc(user.nombre)}</span>
 <span style="font-size:0.72rem;color:var(--accent-secondary)">${esc(user.cargo)}</span>
 </span>
 </button>
 `).join('')}
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
 const user = await api('/auth/login', { method: 'POST', body: { email: demo.email, password: demo.password } });
 setUser(user);
 refreshNav();
 toast(`Sesión activa: ${user.cargo_etiqueta || user.nombre}`, 'success');
 location.hash = OPERATIVE_ROLES.includes(user.rol) ? '#/panel' : '#/catalogo';
 } catch (error) {
 toast(error.message, 'danger');
 }
 });
 });

 area.querySelector('[data-go-panel]')?.addEventListener('click', () => { location.hash = '#/panel'; });
 area.querySelector('[data-logout]')?.addEventListener('click', () => {
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
 link.innerHTML = 'Panel Operativo';
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
 <div class="cart-empty-icon"></div>
 <p>Tu carrito está vacío</p>
 <a href="#/catalogo" class="btn btn-primary btn-sm" style="margin-top:16px" data-close-cart>Explorar Catálogo</a>
 </div>`;
 footer.innerHTML = '';
 return;
 }

 body.innerHTML = state.cart.map(item => `
 <div class="cart-item">
 <img class="cart-item-img" src="${esc(item.imagen || '')}" alt="${esc(item.nombre)}">
 <div class="cart-item-info">
 <div class="cart-item-name">${esc(item.nombre)}</div>
 <div class="cart-item-color">${esc(item.color || 'Estándar')}</div>
 <div class="cart-item-controls">
 <button type="button" class="cart-qty-btn" data-cart-minus="${esc(item.key)}">−</button>
 <span class="cart-qty-display">${item.cantidad}</span>
 <button type="button" class="cart-qty-btn" data-cart-plus="${esc(item.key)}">+</button>
 </div>
 </div>
 <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
 <span class="cart-item-price">$${fmt(item.precio_usd * item.cantidad)}</span>
 <button type="button" class="cart-item-remove" data-cart-remove="${esc(item.key)}" aria-label="Eliminar"></button>
 </div>
 </div>
 `).join('');

 const subtotal = cartSubtotal();
 footer.innerHTML = `
 <div class="cart-total-row">
 <span class="cart-total-label">Total</span>
 <span class="cart-total-amount mono">$${fmt(subtotal)}</span>
 </div>
 <div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:12px;font-family:'JetBrains Mono',monospace">≈ ${fmtBs(subtotal)}</div>
 <a href="#/checkout" class="btn btn-primary w-full" data-close-cart>Ir al Checkout</a>
 `;
}

function openCart() {
 document.querySelector('#cart-drawer')?.classList.add('open');
 document.querySelector('#cart-overlay')?.classList.add('open');
 renderCartDrawer();
}

function closeCart() {
 document.querySelector('#cart-drawer')?.classList.remove('open');
 document.querySelector('#cart-overlay')?.classList.remove('open');
}

function bindCart() {
 const drawer = document.querySelector('#cart-drawer');
 if (!drawer) return;

 document.querySelector('#cart-btn')?.addEventListener('click', openCart);
 document.querySelector('#cart-close-btn')?.addEventListener('click', closeCart);
 document.querySelector('#cart-overlay')?.addEventListener('click', closeCart);
 drawer.addEventListener('click', event => {
 if (event.target.closest('[data-close-cart]')) { closeCart(); return; }

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
 if (units >= max) { toast(`Solo hay ${max} unidad${max === 1 ? '' : 'es'} disponible${max === 1 ? '' : 's'}`, 'warning'); return; }
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
 document.querySelectorAll('.nav-link').forEach(link => {
 const route = link.dataset.route;
 link.classList.toggle('active', Boolean(route && hash.includes(`/${route}`)));
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
