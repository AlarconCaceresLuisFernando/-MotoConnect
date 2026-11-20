/* ============================================================
   MotoConnect — utils.js
   Formato, toasts, badges, íconos SVG y helpers de producto
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
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

export function icon(name, size = 18) {
  const s = Number(size) || 18;
  const wrap = path =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0">${path}</svg>`;

  const paths = {
    check: '<path d="M20 6L9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    compare: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3h-1M14 20h7"/>',
    bank: '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 8z"/><path d="M3.3 7l8.7 5 8.7-5"/><path d="M12 22V12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  };

  return wrap(paths[name] || paths.info);
}

const TOAST_ICONS = {
  info: `<span style="color:var(--accent-secondary);display:inline-flex">${icon('info', 18)}</span>`,
  success: `<span style="color:var(--success);display:inline-flex">${icon('check-circle', 18)}</span>`,
  danger: `<span style="color:var(--danger);display:inline-flex">${icon('x-circle', 18)}</span>`,
  warning: `<span style="color:var(--warning);display:inline-flex">${icon('alert', 18)}</span>`,
};

export function clearToasts() {
  document.querySelectorAll('.toast').forEach(el => el.remove());
}

export function toast(message, type = 'info', duration = 3400) {
  clearToasts();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.title = 'Clic para cerrar';
  el.innerHTML = `${TOAST_ICONS[type] || TOAST_ICONS.info}<span>${esc(message)}</span>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export async function fetchProtectedReceipt(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(`No se pudo cargar el comprobante (${res.status})`);
  }
  const blob = await res.blob();
  return { blobUrl: URL.createObjectURL(blob), mime: blob.type || '' };
}

export async function downloadPdfBlob(url, filename, token = null) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `No se pudo descargar el PDF (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || 'MotoConnect-Documento.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
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
