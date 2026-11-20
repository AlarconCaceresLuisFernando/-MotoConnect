/* ============================================================
 MotoConnect — utils.js
 Formato, toasts, badges y helpers de producto
 ============================================================ */

import { BS_RATE, PAYMENT_LABELS, LOGISTIC_LABELS } from './config.js';

export function fmt(value, decimals = 2) {
 return Number(value || 0).toLocaleString('en-US', {
 minimumFractionDigits: decimals,
 maximumFractionDigits: decimals,
 });
}

export function fmtBs(usd) {
 return `Bs ${fmt(Number(usd || 0) * BS_RATE)}`;
}

export function esc(value) {
 return String(value ?? '').replace(/[&<>"']/g, char => ({
 '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
 }[char]));
}

const TOAST_ICONS = { info: 'ℹ', success: '', danger: '', warning: '' };

export function toast(message, type = 'info', duration = 3600) {
 document.querySelectorAll('.toast').forEach(el => el.remove());
 const el = document.createElement('div');
 el.className = `toast ${type}`;
 el.innerHTML = `<span>${TOAST_ICONS[type] || TOAST_ICONS.info}</span><span>${esc(message)}</span>`;
 document.body.appendChild(el);
 setTimeout(() => el.remove(), duration);
}

export function statusBadge(estado) {
 const map = {
 EN_REVISION: 'status-pending',
 VERIFICADO: 'status-verified',
 RECHAZADO: 'status-rejected',
 ESPERANDO_PAGO: 'status-pending',
 LISTO_PARA_PREPARAR: 'status-info',
 EN_PREPARACION_PDI: 'status-info',
 EMPACADO_LISTO_DESPACHO: 'status-info',
 EN_RUTA_ENTREGA: 'status-pending',
 ENTREGADO_FINALIZADO: 'status-verified',
 CANCELADO: 'status-rejected',
 };
 const label = PAYMENT_LABELS[estado] || LOGISTIC_LABELS[estado] || estado;
 return `<span class="status-badge ${map[estado] || 'status-info'}">${esc(label)}</span>`;
}

export function stockBadge(stock) {
 const n = Number(stock || 0);
 if (n === 0) return '<span class="card-badge-tr badge-stock-out">Agotado</span>';
 if (n === 1) return '<span class="card-badge-tr badge-stock-last">¡Última unidad!</span>';
 return `<span class="card-badge-tr badge-stock-ok">${n} disponibles</span>`;
}

export function productImages(product) {
 if (!product) return [];
 try {
 const list = JSON.parse(product.imagenes_json || '[]');
 if (Array.isArray(list) && list.length) {
 return list.map(item => (typeof item === 'string' ? item : item.url)).filter(Boolean);
 }
 } catch {
 /* ignore */
 }
 return [];
}

export function productColors(product) {
 try {
 const list = JSON.parse(product.colores_json || '[]');
 if (Array.isArray(list) && list.length) return list;
 } catch {
 /* ignore */
 }
 return [{ nombre: 'Estándar', hex: '#475569' }];
}

export function genVIN() {
 const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
 let vin = 'JYARM';
 for (let i = 0; i < 12; i += 1) vin += chars[Math.floor(Math.random() * chars.length)];
 return vin;
}

export function genPKG() {
 return `PKG-2026-${Math.floor(100 + Math.random() * 900)}`;
}

export function syncBadge(id, value) {
 const badge = document.querySelector(`#${id}`);
 if (!badge) return;
 badge.textContent = value;
 badge.style.display = value > 0 ? 'inline-flex' : 'none';
}
