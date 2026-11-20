/* ============================================================
 MotoConnect — components/paypal.js
 Integración aislada de PayPal Smart Buttons
 ============================================================ */

import { api } from '../api.js';
import { BS_RATE } from '../config.js';
import { state, clearCart } from '../state.js';
import { toast } from '../utils.js';

/**
 * Monta los botones de PayPal.
 * @param {number} total total a cobrar en USD
 * @param {() => object} getBuyer devuelve los datos del comprador
 * @param {string} reference código de referencia local
 */
export function mountPayPal(total, getBuyer, reference) {
 const container = document.querySelector('#paypal-button-container');
 if (!container) return;

 if (!window.paypal) {
 container.innerHTML = '<div class="alert alert-warning"> PayPal no está disponible en este momento. Usa QR o depósito bancario.</div>';
 return;
 }

 const totalUsd = (Number(total) / BS_RATE).toFixed(2);
 const subtotalUsd = (Number(totalUsd) / 1.05);

 const requiredFields = [
 ['nombre', 'Nombre completo'],
 ['email', 'Email'],
 ['telefono', 'Teléfono'],
 ['ci', 'CI / NIT'],
 ['ciudad', 'Ciudad'],
 ['direccion', 'Dirección'],
 ];

 container.innerHTML = '';
 window.paypal.Buttons({
 style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 44 },

 onClick(_data, actions) {
 const buyer = getBuyer();
 const missing = [];

 requiredFields.forEach(([key, label]) => {
 const input = document.querySelector(`[name="${key}"]`);
 if (!buyer[key]) {
 missing.push(label);
 if (input) input.style.borderColor = 'var(--danger)';
 } else if (input) {
 input.style.borderColor = '';
 }
 });

 if (missing.length) {
 toast(`Completa los Datos del Comprador: ${missing.join(', ')}`, 'warning');
 document.querySelector(`[name="${requiredFields.find(([key]) => !buyer[key])[0]}"]`)?.focus();
 return actions.reject();
 }
 return actions.resolve();
 },

 createOrder(_data, actions) {
 return actions.order.create({
 intent: 'CAPTURE',
 purchase_units: [{
 reference_id: `MC${Date.now()}`,
 description: `MotoConnect · Pedido ${reference}`,
 amount: {
 currency_code: 'USD',
 value: totalUsd,
 },
 }],
 });
 },

 async onApprove(_data, actions) {
 try {
 const details = await actions.order.capture();
 const buyer = getBuyer();

 const order = await api('/pedidos/paypal', {
 method: 'POST',
 body: {
 orderID: details.id,
 buyer,
 items: state.cart,
 subtotal_usd: subtotalUsd,
 total: Number(totalUsd),
 refCode: reference,
 },
 });

 clearCart();
 toast(`Pago capturado · Pedido ${order.codigo_orden}`, 'success');
 location.hash = '#/mis-pedidos';
 } catch (error) {
 toast(error.message || 'No se pudo registrar el pago', 'danger');
 }
 },

 onError(error) {
 toast(`Error PayPal: ${error.message || 'operación cancelada'}`, 'danger');
 },
 }).render(container);
}
