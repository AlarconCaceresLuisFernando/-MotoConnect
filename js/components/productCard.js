/* ============================================================
 MotoConnect — components/productCard.js
 Tarjeta de producto reutilizable + binding de eventos
 ============================================================ */

import { state, persistComparador, addToCart } from '../state.js';
import { fmt, fmtBs, esc, productImages, stockBadge, toast } from '../utils.js';
import { refreshNav } from './navbar.js';

export function productCard(product) {
 const images = productImages(product);
 const image = images[0] || '';
 const inCompare = state.comparador.includes(product.slug);
 const specs = [];
 if (product.cilindrada_cc) specs.push(`${product.cilindrada_cc} cc`);
 if (product.potencia_hp) specs.push(`${String(product.potencia_hp).replace(/\s*@.*$/, '')} HP`);
 if (product.peso_kg && product.categoria !== 'Accesorio') specs.push(`${product.peso_kg} kg`);

 return `
 <article class="product-card" data-product="${esc(product.slug)}">
 <div class="product-card-image" data-open-product="${esc(product.slug)}" style="cursor:pointer">
 <img src="${esc(image)}" alt="${esc(product.nombre)}" loading="lazy" onerror="this.src='/images/productos/placeholder.svg'" />
 <span class="card-badge-tl">${esc(product.marca || '')}</span>
 ${stockBadge(product.stock_disponible)}
 </div>
 <div class="product-card-body">
 <div>
 <div class="product-name">${esc(product.nombre)}</div>
 ${product.anio ? `<div class="product-year">${product.anio}</div>` : ''}
 </div>
 ${specs.length ? `<div class="product-specs">${specs.map(spec => `<span class="spec-pill">${esc(spec)}</span>`).join('')}</div>` : ''}
 <div class="product-price">
 <div class="price-usd mono">${fmtBs(product.precio_usd)}</div>
 <div class="price-bs">≈ $${fmt(product.precio_usd)} USD</div>
 </div>
 </div>
 <div class="product-card-actions">
 <button type="button" class="btn-compare ${inCompare ? 'active' : ''}" data-compare="${esc(product.slug)}">
 ${inCompare ? 'OK En Comparador' : '+ Comparar'}
 </button>
 <button type="button" class="btn btn-primary" data-open-product="${esc(product.slug)}">Ver Ficha</button>
 </div>
 </article>`;
}

export function bindProductCards(root) {
 root.addEventListener('click', event => {
 const open = event.target.closest('[data-open-product]');
 if (open) {
 location.hash = `#/moto/${open.dataset.openProduct}`;
 return;
 }

 const compare = event.target.closest('[data-compare]');
 if (compare) {
 const slug = compare.dataset.compare;
 if (state.comparador.includes(slug)) {
 state.comparador = state.comparador.filter(item => item !== slug);
 toast('Producto quitado del comparador', 'info');
 } else {
 if (state.comparador.length >= 3) { toast('Máximo 3 productos en el comparador', 'warning'); return; }
 state.comparador.push(slug);
 toast('Producto añadido al comparador', 'success');
 }
 persistComparador();
 compare.textContent = state.comparador.includes(slug) ? 'OK En Comparador' : '+ Comparar';
 compare.classList.toggle('active', state.comparador.includes(slug));
 refreshNav();
 }
 });
}

export function bindAddToCart(root, getProduct, defaultColor = 'Estándar') {
 root.addEventListener('click', event => {
 const button = event.target.closest('[data-add-cart]');
 if (!button) return;
 const product = getProduct(button.dataset.addCart);
 if (!product) return;
 const result = addToCart(product, {
 color: button.dataset.color || defaultColor,
 cantidad: Number(button.dataset.qty || 1),
 imagen: productImages(product)[0] || '',
 });
 if (!result.ok) { toast(result.message, 'warning'); return; }
 toast(`${product.nombre} añadido al carrito`, 'success');
 refreshNav();
 document.querySelector('#cart-drawer')?.classList.add('open');
 document.querySelector('#cart-overlay')?.classList.add('open');
 });
}
