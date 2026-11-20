/* ============================================================
 MotoConnect — views/detail.js (#/moto/:slug)
 ============================================================ */

import { api } from '../api.js';
import { state, persistComparador, addToCart } from '../state.js';
import { fmt, fmtBs, esc, productImages, productColors, toast } from '../utils.js';
import { refreshNav } from '../components/navbar.js';
import { productCard, bindProductCards } from '../components/productCard.js';

export async function detail(root, slug) {
 root.innerHTML = '<div class="spinner-wrap" style="min-height:60vh"><div class="spinner"></div></div>';

 let product;
 try {
 product = await api(`/productos/${encodeURIComponent(slug)}`);
 } catch (error) {
 root.innerHTML = `
 <div class="empty-state" style="min-height:60vh">
 <span class="empty-icon"></span><h3>Producto no encontrado</h3><p>${esc(error.message)}</p>
 <a href="#/catalogo" class="btn btn-primary">← Volver al Catálogo</a>
 </div>`;
 return;
 }

 const images = productImages(product);
 const colors = productColors(product);
 const stock = Number(product.stock_disponible || 0);
 const inCompare = state.comparador.includes(product.slug);

 let selectedColor = colors[0]?.nombre || 'Estándar';
 let quantity = 1;

 const stockClass = stock === 0 ? 'text-danger' : stock === 1 ? 'text-warning' : 'text-success';
 const stockDot = stock === 0 ? 'out' : stock === 1 ? 'warn' : 'ok';
 const stockText = stock === 0 ? 'Agotado — próximo embarque' : stock === 1 ? '¡Última unidad disponible!' : `${stock} unidades en stock`;

 const specRows = [
 ['Marca', product.marca],
 ['Modelo', product.nombre],
 ['Año', product.anio],
 ['Categoría', product.categoria],
 ['Cilindrada', product.cilindrada_cc ? `${product.cilindrada_cc} cc` : null],
 ['Potencia', product.potencia_hp],
 ['Torque', product.torque_nm],
 ['Transmisión', product.transmision],
 ['Peso', product.peso_kg ? `${product.peso_kg} kg` : null],
 ['Tanque', product.tanque_litros ? `${product.tanque_litros} L` : null],
 ['Consumo', product.consumo_kml],
 ['Velocidad máxima', product.velocidad_max],
 ['Frenos', product.frenos],
 ['Suspensión', product.suspension],
 ].filter(([, value]) => value !== null && value !== undefined && value !== '');

 root.innerHTML = `
 <div class="section" style="padding-top:32px">
 <nav class="breadcrumb" aria-label="Breadcrumb">
 <a href="#/">Inicio</a><span class="breadcrumb-sep">›</span>
 <a href="#/catalogo">Catálogo</a><span class="breadcrumb-sep">›</span>
 <a href="#/catalogo?marca=${encodeURIComponent(product.marca || '')}">${esc(product.marca || '')}</a><span class="breadcrumb-sep">›</span>
 <span style="color:var(--text-primary)">${esc(product.nombre)}</span>
 </nav>

 <div class="product-detail-layout">
 <div class="product-gallery">
 <div class="gallery-main">
 <img id="main-gallery-img" src="${esc(images[0] || '/images/productos/placeholder.svg')}" alt="${esc(product.nombre)}" onerror="this.src='/images/productos/placeholder.svg'" />
 </div>
 <div class="gallery-thumbs" id="gallery-thumbs">
 ${images.map((image, index) => `
 <button type="button" class="gallery-thumb ${index === 0 ? 'active' : ''}" data-gallery="${esc(image)}">
 <img src="${esc(image)}" alt="Vista ${index + 1}" />
 </button>
 `).join('')}
 </div>
 </div>

 <div class="product-detail-info">
 <div>
 <div class="product-detail-brand">${esc(product.marca)} · ${esc(product.categoria)}</div>
 <h1 class="product-detail-name">${esc(product.nombre)}</h1>
 ${product.anio ? `<div class="product-year mono">${product.anio}</div>` : ''}
 </div>

 <div class="stock-indicator ${stockClass}">
 <span class="stock-dot ${stockDot}"></span>${stockText}
 </div>

 <p style="color:var(--text-secondary);font-size:0.92rem;line-height:1.7">${esc(product.descripcion || '')}</p>

 <div class="color-selector">
 <label>Color de fábrica: <strong id="color-label">${esc(selectedColor)}</strong></label>
 <div class="color-swatches">
 ${colors.map((color, index) => `
 <button type="button" class="color-swatch ${index === 0 ? 'active' : ''}"
 style="background:${esc(color.hex || '#888')}" title="${esc(color.nombre)}"
 data-color="${esc(color.nombre)}" aria-label="Color ${esc(color.nombre)}" aria-pressed="${index === 0}"></button>
 `).join('')}
 </div>
 </div>

 <div>
 <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:8px">Cantidad</label>
 <div class="quantity-selector">
 <button type="button" class="qty-btn" data-qty="-1" aria-label="Reducir">−</button>
 <span class="qty-display" id="qty-display">1</span>
 <button type="button" class="qty-btn" data-qty="1" aria-label="Aumentar">+</button>
 </div>
 <span style="font-size:0.75rem;color:var(--text-muted)">Máximo ${stock} unidad${stock === 1 ? '' : 'es'} por pedido</span>
 </div>

 <div class="detail-price">
 <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.08em">Precio</div>
 <div class="price-usd">${fmtBs(product.precio_usd)}</div>
 <div class="price-bs" style="margin-top:4px">≈ $${fmt(product.precio_usd)} USD</div>
 </div>

 <div class="detail-actions">
 <button type="button" class="btn btn-primary btn-lg" id="detail-add" ${stock === 0 ? 'disabled' : ''}>
 ${stock === 0 ? ' Unidad Agotada' : ' Añadir al Carrito'}
 </button>
 <button type="button" class="btn btn-secondary btn-compare ${inCompare ? 'active' : ''}" id="detail-compare">
 ${inCompare ? 'OK En Comparador' : '+ Comparar'}
 </button>
 </div>
 </div>
 </div>

 <div style="margin-top:64px">
 <div class="tabs">
 <button type="button" class="tab-btn active" data-tab="tab-motor"> Motor y Transmisión</button>
 <button type="button" class="tab-btn" data-tab="tab-chasis"> Chasis, Frenos y Peso</button>
 <button type="button" class="tab-btn" data-tab="tab-electronica"> Electrónica</button>
 <button type="button" class="tab-btn" data-tab="tab-garantia"> Garantía</button>
 </div>

 <div class="tab-content active" id="tab-motor">
 <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;overflow:hidden">
 <table class="spec-table"><tbody>
 ${specRows.map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`).join('')}
 </tbody></table>
 </div>
 </div>

 <div class="tab-content" id="tab-chasis">
 <div class="card-dark">
 <h3 style="margin-bottom:16px">Chasis, frenos y peso</h3>
 <p style="color:var(--text-secondary);line-height:1.8"><strong>Frenos:</strong> ${esc(product.frenos || 'No disponible')}</p>
 <p style="color:var(--text-secondary);line-height:1.8"><strong>Suspensión:</strong> ${esc(product.suspension || 'No disponible')}</p>
 <p style="color:var(--text-secondary);line-height:1.8"><strong>Peso en orden de marcha:</strong> ${product.peso_kg ? `${product.peso_kg} kg` : 'No disponible'}</p>
 </div>
 </div>

 <div class="tab-content" id="tab-electronica">
 <div class="card-dark">
 <h3 style="margin-bottom:16px">Electrónica y asistencias</h3>
 <p style="color:var(--text-secondary);line-height:1.8">${esc(product.electronica || 'Información no disponible.')}</p>
 </div>
 </div>

 <div class="tab-content" id="tab-garantia">
 <div class="card-dark">
 <h3 style="margin-bottom:16px">Garantía y documentación oficial</h3>
 <div class="guarantees-grid">
 ${[
 { icon: '', title: 'Inspección PDI 40 puntos', copy: 'Revisión técnica certificada antes de la entrega.' },
 { icon: '', title: '2 llaves codificadas', copy: 'Entregadas en bolsa sellada de fábrica.' },
 { icon: '', title: 'Manual del propietario', copy: 'Manual oficial en español.' },
 { icon: '', title: 'Garantía 24 meses', copy: 'Cobertura de fábrica según kilometraje.' },
 ].map(item => `
 <div class="guarantee-item">
 <div class="guarantee-icon">${item.icon}</div>
 <div class="guarantee-text"><h4>${item.title}</h4><p>${item.copy}</p></div>
 </div>
 `).join('')}
 </div>
 </div>
 </div>
 </div>

 <div style="margin-top:64px">
 <div class="section-header" style="text-align:left;margin-bottom:24px">
 <span class="section-label">Complementa tu compra</span>
 <h2 style="font-size:1.5rem">Accesorios sugeridos</h2>
 </div>
 <div class="products-grid" id="accessories-grid"></div>
 </div>
 </div>
 `;

 /* Galería */
 root.querySelectorAll('[data-gallery]').forEach(button => {
 button.addEventListener('click', () => {
 root.querySelector('#main-gallery-img').src = button.dataset.gallery;
 root.querySelectorAll('.gallery-thumb').forEach(thumb => thumb.classList.remove('active'));
 button.classList.add('active');
 });
 });

 /* Colores */
 root.querySelectorAll('[data-color]').forEach(button => {
 button.addEventListener('click', () => {
 selectedColor = button.dataset.color;
 root.querySelector('#color-label').textContent = selectedColor;
 root.querySelectorAll('[data-color]').forEach(swatch => {
 swatch.classList.toggle('active', swatch === button);
 swatch.setAttribute('aria-pressed', String(swatch === button));
 });
 });
 });

 /* Cantidad limitada al stock */
 root.querySelectorAll('[data-qty]').forEach(button => {
 button.addEventListener('click', () => {
 const delta = Number(button.dataset.qty);
 quantity = Math.min(Math.max(1, quantity + delta), Math.max(1, stock));
 root.querySelector('#qty-display').textContent = quantity;
 });
 });

 /* Añadir al carrito */
 root.querySelector('#detail-add')?.addEventListener('click', () => {
 const result = addToCart(product, { color: selectedColor, cantidad: quantity, imagen: images[0] || '' });
 if (!result.ok) { toast(result.message, 'warning'); return; }
 toast(`${product.nombre} añadido al carrito`, 'success');
 refreshNav();
 document.querySelector('#cart-drawer')?.classList.add('open');
 document.querySelector('#cart-overlay')?.classList.add('open');
 quantity = 1;
 root.querySelector('#qty-display').textContent = '1';
 });

 /* Comparador */
 root.querySelector('#detail-compare')?.addEventListener('click', event => {
 const button = event.currentTarget;
 if (state.comparador.includes(product.slug)) {
 state.comparador = state.comparador.filter(item => item !== product.slug);
 toast('Producto quitado del comparador', 'info');
 } else {
 if (state.comparador.length >= 3) { toast('Máximo 3 productos en el comparador', 'warning'); return; }
 state.comparador.push(product.slug);
 toast('Producto añadido al comparador', 'success');
 }
 persistComparador();
 const active = state.comparador.includes(product.slug);
 button.textContent = active ? 'OK En Comparador' : '+ Comparar';
 button.classList.toggle('active', active);
 refreshNav();
 });

 /* Tabs */
 root.querySelectorAll('.tab-btn').forEach(button => {
 button.addEventListener('click', () => {
 root.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
 root.querySelectorAll('.tab-content').forEach(panel => panel.classList.remove('active'));
 button.classList.add('active');
 root.querySelector(`#${button.dataset.tab}`)?.classList.add('active');
 });
 });

 /* Accesorios sugeridos */
 const accessoriesGrid = root.querySelector('#accessories-grid');
 bindProductCards(accessoriesGrid);
 try {
 const products = await api('/productos');
 state.products = products;
 const accessories = products
 .filter(item => item.categoria === 'Equipamiento' && item.slug !== product.slug)
 .slice(0, 3);
 accessoriesGrid.innerHTML = accessories.length
 ? accessories.map(productCard).join('')
 : '<p class="text-muted">Sin accesorios disponibles.</p>';
 } catch {
 accessoriesGrid.innerHTML = '<p class="text-muted">No se pudieron cargar los accesorios.</p>';
 }
}
