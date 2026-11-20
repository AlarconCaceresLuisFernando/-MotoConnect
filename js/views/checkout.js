/* ============================================================
 MotoConnect — views/checkout.js (#/checkout)
 Datos del comprador, 3 medios de pago y resumen fijo
 ============================================================ */

import { api } from '../api.js';
import { state, clearCart } from '../state.js';
import { CITY_LIST, BS_RATE } from '../config.js';
import { fmt, fmtBs, esc, toast } from '../utils.js';
import { mountPayPal } from '../components/paypal.js';
import { refreshNav } from '../components/navbar.js';

const BANK_ACCOUNTS = [
 { banco: 'Banco BISA', cuenta: '1234567890', tipo: 'Cuenta Corriente USD', titular: 'MotoConnect S.R.L.', nit: 'NIT 1029384756' },
 { banco: 'Banco Mercantil Santa Cruz', cuenta: '9876543210', tipo: 'Cuenta de Ahorros USD', titular: 'MotoConnect S.R.L.', nit: 'NIT 1029384756' },
];

function referenceCode() {
 return `MC-2026-${String(Date.now()).slice(-4)}`;
}

function summaryItem(item) {
 const image = item.imagen
 ? `<img class="summary-item-img" src="${esc(item.imagen)}" alt="${esc(item.nombre)}" />`
 : '<div class="summary-item-img" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem"></div>';

 return `
 <div class="summary-item">
 ${image}
 <div class="summary-item-info">
 <div class="summary-item-name">${esc(item.nombre)}</div>
 <div class="summary-item-detail">${esc(item.color || 'Estándar')} · ${item.cantidad} u.</div>
 </div>
 <div class="summary-item-price">$${fmt(Number(item.precio_usd) * Number(item.cantidad))}</div>
 </div>`;
}

function bankForm(kind) {
 const isQr = kind === 'qr';
 return `
 <form data-bank-form="${kind}" novalidate>
 <div class="form-grid">
 <div class="form-group full">
 <label for="ref-${kind}">Número de referencia / operación *</label>
 <input id="ref-${kind}" data-field="referencia" type="text" placeholder="Ej. 6757575" required />
 </div>
 <div class="form-group full">
 <label for="file-${kind}">Comprobante de ${isQr ? 'pago QR' : 'depósito'} *</label>
 <input id="file-${kind}" data-field="comprobante" type="file" accept="image/*,.pdf" required />
 <small class="text-muted">JPG, PNG o PDF · máximo 10 MB</small>
 </div>
 </div>
 <button type="submit" class="btn btn-primary w-full" style="margin-top:16px">
 Enviar comprobante a revisión
 </button>
 </form>`;
}

function finishOrder(root, order, message) {
 clearCart();
 refreshNav();
 toast(message, 'success');
 root.innerHTML = `
 <section class="section">
 <div class="order-confirmation">
 <div class="confirmation-icon"></div>
 <h1 style="font-size:1.8rem;margin-bottom:8px">¡Pedido registrado!</h1>
 <p class="text-secondary">${esc(message)}</p>
 <div class="confirmation-code">${esc(order.codigo_orden || order.codigo || '')}</div>
 <p class="text-secondary" style="max-width:480px;margin:0 auto 24px;font-size:0.9rem">
 Estado de pago: <strong>${esc(order.estado_pago || 'EN_REVISION')}</strong> ·
 Estado logístico: <strong>${esc(order.estado_logistico || 'ESPERANDO_PAGO')}</strong>
 </p>
 <div class="panel-actions" style="justify-content:center">
 <a href="#/mis-pedidos" class="btn btn-primary"> Ver Mis Pedidos</a>
 <a href="#/catalogo" class="btn btn-secondary"> Seguir Explorando</a>
 </div>
 </div>
 </section>`;
 window.scrollTo(0, 0);
}

export async function checkout(root) {
 if (!state.cart.length) {
 root.innerHTML = `
 <section class="section">
 <div class="empty-state" style="min-height:50vh">
 <span class="empty-icon"></span>
 <h3>Tu carrito está vacío</h3>
 <p>Agrega una motocicleta o equipamiento para iniciar tu compra.</p>
 <a href="#/catalogo" class="btn btn-primary">Explorar Catálogo</a>
 </div>
 </section>`;
 return;
 }

 if (!state.user) {
 root.innerHTML = `
 <section class="section">
 <div class="login-prompt">
 <div style="font-size:3.5rem;margin-bottom:16px"></div>
 <h2>Inicia sesión para finalizar tu compra</h2>
 <p>Necesitamos identificar al comprador para emitir la orden y el certificado de entrega.</p>
 <div class="panel-actions" style="justify-content:center">
 <a href="#/login" class="btn btn-primary">Iniciar Sesión</a>
 <a href="#/catalogo" class="btn btn-secondary">Seguir Comprando</a>
 </div>
 </div>
 </section>`;
 return;
 }

 const subtotal = state.cart.reduce(
 (total, item) => total + Number(item.precio_usd || 0) * Number(item.cantidad || 0),
 0
 );
 const impuestos = subtotal * 0.05;
 const total = subtotal + impuestos;
 const reference = referenceCode();

 const buyerFields = [
 { name: 'nombre', label: 'Nombre completo *', value: state.user.nombre || '', full: true },
 { name: 'email', label: 'Correo electrónico *', value: state.user.email || '', type: 'email' },
 { name: 'telefono', label: 'Teléfono *', value: '', type: 'tel', placeholder: '+591 700 00000' },
 { name: 'ci', label: 'CI / NIT *', value: '', placeholder: 'Ej. 7654321' },
 { name: 'direccion', label: 'Dirección de entrega *', value: '', full: true, placeholder: 'Calle, número, zona' },
 ];

 root.innerHTML = `
 <div class="page-header">
 <div class="page-header-inner">
 <h1>Checkout Seguro</h1>
 <p>Completa tus datos y elige el medio de pago · Orden ${esc(reference)}</p>
 </div>
 </div>

 <div class="section">
 <div class="checkout-layout">
 <div>
 <section class="checkout-section">
 <h3> Datos del Comprador</h3>
 <div class="form-grid">
 ${buyerFields.map(field => `
 <div class="form-group ${field.full ? 'full' : ''}">
 <label for="buyer-${field.name}">${field.label}</label>
 <input id="buyer-${field.name}" name="${field.name}" type="${field.type || 'text'}"
 value="${esc(field.value)}" placeholder="${esc(field.placeholder || '')}"
 ${field.name === 'email' ? 'readonly title="El pedido quedará asociado a tu cuenta"' : ''} required />
 </div>
 `).join('')}
 <div class="form-group">
 <label for="buyer-ciudad">Ciudad *</label>
 <select id="buyer-ciudad" name="ciudad" required>
 <option value="">Selecciona tu ciudad</option>
 ${CITY_LIST.map(city => `<option value="${esc(city)}">${esc(city)}</option>`).join('')}
 </select>
 </div>
 </div>
 </section>

 <section class="checkout-section">
 <h3> Método de Pago</h3>

 <div class="payment-tabs" role="tablist">
 <button type="button" class="payment-tab-btn active" data-payment-tab="paypal" role="tab" aria-selected="true">
 <span class="pay-icon">🅿</span>
 <span>PayPal</span>
 <small style="font-weight:400;opacity:0.8">Pago inmediato</small>
 </button>
 <button type="button" class="payment-tab-btn" data-payment-tab="qr" role="tab" aria-selected="false">
 <span class="pay-icon"></span>
 <span>QR Bancario</span>
 <small style="font-weight:400;opacity:0.8">Revisión manual</small>
 </button>
 <button type="button" class="payment-tab-btn" data-payment-tab="deposito" role="tab" aria-selected="false">
 <span class="pay-icon"></span>
 <span>Depósito</span>
 <small style="font-weight:400;opacity:0.8">Revisión manual</small>
 </button>
 </div>

 <div class="payment-panel active" id="panel-paypal" role="tabpanel">
 <div class="alert alert-success" style="margin-bottom:20px">
 Pago protegido con PayPal. El stock se reserva automáticamente al confirmar la transacción.
 </div>
 <div id="paypal-button-container"></div>
 <p class="text-muted" style="font-size:0.8rem;text-align:center;margin-top:12px">
 Serás redirigido a PayPal para autorizar el cobro de ${fmt(total)} USD (equivalente a ${fmtBs(total)}).
 </p>
 </div>

 <div class="payment-panel" id="panel-qr" role="tabpanel">
 <div class="qr-section">
 <div id="qrcode-bancario"></div>
 <div class="qr-info">
 Escanea con tu app bancaria<br />
 Monto: ${fmtBs(total)} (≈ ${fmt(total)} USD)<br />
 Referencia: ${esc(reference)}
 </div>
 </div>

 <div class="bank-details">
 ${BANK_ACCOUNTS.map(account => `
 <div class="bank-item">
 <div class="bank-name">${esc(account.banco)}</div>
 <div class="bank-detail-row">${esc(account.tipo)}</div>
 <div class="bank-detail-row">Nº ${esc(account.cuenta)}</div>
 <div class="bank-detail-row">${esc(account.titular)} · ${esc(account.nit)}</div>
 </div>
 `).join('')}
 </div>

 ${bankForm('qr')}
 </div>

 <div class="payment-panel" id="panel-deposito" role="tabpanel">
 <div class="bank-details">
 ${BANK_ACCOUNTS.map(account => `
 <div class="bank-item">
 <div class="bank-name">${esc(account.banco)}</div>
 <div class="bank-detail-row">${esc(account.tipo)}</div>
 <div class="bank-detail-row">Nº ${esc(account.cuenta)}</div>
 <div class="bank-detail-row">${esc(account.titular)} · ${esc(account.nit)}</div>
 </div>
 `).join('')}
 </div>
 <div class="alert alert-warning" style="margin-bottom:16px">
 Depósito o transferencia por ${fmtBs(total)} (≈ ${fmt(total)} USD) · Referencia ${esc(reference)}. Adjunta el comprobante para validación.
 </div>
 ${bankForm('deposito')}
 </div>
 </section>
 </div>

 <aside class="order-summary">
 <div class="checkout-section" style="margin-bottom:0">
 <h3> Resumen del Pedido</h3>
 <div class="summary-items">
 ${state.cart.map(summaryItem).join('')}
 </div>
 <div class="summary-totals">
 <div class="summary-row"><span>Subtotal</span><span class="mono">${fmtBs(subtotal)}</span></div>
 <div class="summary-row"><span>Impuestos y trámite (5%)</span><span class="mono">${fmtBs(impuestos)}</span></div>
 <div class="summary-row total"><span>Total Bs</span><span class="mono">${fmtBs(total)}</span></div>
 <div class="summary-row"><span>Referencia USD</span><span class="mono">${fmt(total)} USD</span></div>
 </div>
 <div class="alert alert-warning" style="margin-top:16px;font-size:0.78rem">
 Compra protegida · Datos cifrados · Factura y certificado digital incluidos.
 </div>
 <p class="text-muted" style="font-size:0.75rem;margin-top:12px;line-height:1.6">
 Al confirmar aceptas los Términos de Compra y la Política de Entregas de MotoConnect S.R.L.
 </p>
 </div>
 </aside>
 </div>
 </div>
 `;

 const getBuyer = () => {
 const read = name => root.querySelector(`[name="${name}"]`)?.value.trim() || '';
 return {
 nombre: read('nombre'),
 email: read('email'),
 telefono: read('telefono'),
 ci: read('ci'),
 ciudad: read('ciudad'),
 direccion: read('direccion'),
 };
 };

 /* ---- Tabs de pago ---- */
 root.querySelectorAll('[data-payment-tab]').forEach(button => {
 button.addEventListener('click', () => {
 root.querySelectorAll('[data-payment-tab]').forEach(tab => {
 tab.classList.toggle('active', tab === button);
 tab.setAttribute('aria-selected', String(tab === button));
 });
 root.querySelectorAll('.payment-panel').forEach(panel => panel.classList.remove('active'));
 root.querySelector(`#panel-${button.dataset.paymentTab}`)?.classList.add('active');
 });
 });

 /* ---- QR ---- */
 const qrContainer = root.querySelector('#qrcode-bancario');
 if (window.QRCode && qrContainer) {
 new window.QRCode(qrContainer, {
 text: `MotoConnect|${reference}|USD ${total.toFixed(2)}|${state.user.email}`,
 width: 180,
 height: 180,
 colorDark: '#090C10',
 colorLight: '#FFFFFF',
 });
 }

 /* ---- Botones PayPal ---- */
 const totalBs = total * BS_RATE;
 mountPayPal(totalBs, getBuyer, reference);

 /* ---- Pago bancario (QR y depósito) ---- */
 root.querySelectorAll('[data-bank-form]').forEach(form => {
 form.addEventListener('submit', async event => {
 event.preventDefault();
 const button = form.querySelector('button[type="submit"]');
 const buyer = getBuyer();
 const referencia = form.querySelector('[data-field="referencia"]').value.trim();
 const file = form.querySelector('[data-field="comprobante"]').files[0];

 const missing = [];
 if (!buyer.nombre) missing.push('nombre');
 if (!buyer.email) missing.push('email');
 if (!buyer.telefono) missing.push('teléfono');
 if (!buyer.ci) missing.push('CI');
 if (!buyer.ciudad) missing.push('ciudad');
 if (!buyer.direccion) missing.push('dirección');
 if (!referencia) missing.push('referencia bancaria');
 if (!file) missing.push('comprobante');

 if (missing.length) {
 toast(`Completa los datos del comprador: ${missing.join(', ')}`, 'warning');
 return;
 }

 const data = new FormData();
 data.append('tipo', form.dataset.bankForm === 'qr' ? 'qr' : 'deposito');
 data.append('referencia_pago', referencia);
 data.append('comprobante', file);
 data.append('buyer', JSON.stringify(buyer));
 data.append('items', JSON.stringify(state.cart));
 data.append('subtotal_usd', String(subtotal));
 data.append('impuestos_tramite_usd', String(impuestos));
 data.append('total_usd', String(total));
 data.append('refCode', reference);

 button.disabled = true;
 button.textContent = 'Enviando comprobante...';
 try {
 const order = await api('/pedidos/bancario', { method: 'POST', body: data });
 finishOrder(root, order, 'Comprobante recibido. El pago queda en revisión por el área de cobranzas.');
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = ' Enviar comprobante a revisión';
 }
 });
 });
}
