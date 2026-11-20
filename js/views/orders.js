/* ============================================================
 MotoConnect — views/orders.js (#/mis-pedidos)
 Historial, línea de tiempo y certificado digital de entrega
 ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { METHOD_LABELS, LOGISTIC_LABELS } from '../config.js';
import { fmt, fmtBs, esc, toast, statusBadge } from '../utils.js';

const TIMELINE_STEPS = [
 { icon: '', label: 'Pago verificado' },
 { icon: '', label: 'Preparación PDI' },
 { icon: '', label: 'Empacado' },
 { icon: '', label: 'En ruta' },
 { icon: '', label: 'Entregado' },
];

const LOGISTIC_STEP = {
 ESPERANDO_PAGO: 0,
 LISTO_PARA_PREPARAR: 1,
 EN_PREPARACION_PDI: 1,
 EMPACADO_LISTO_DESPACHO: 2,
 EN_RUTA_ENTREGA: 3,
 ENTREGADO_FINALIZADO: 4,
 CANCELADO: 0,
};

function formatDate(value, withTime = true) {
 if (!value) return '—';
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return '—';
 return date.toLocaleString('es-BO', {
 day: '2-digit',
 month: 'short',
 year: 'numeric',
 ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
 });
}

function parseItems(order) {
 try {
 const items = JSON.parse(order.items_json || '[]');
 return Array.isArray(items) ? items : [];
 } catch {
 return [];
 }
}

function itemsMarkup(items) {
 if (!items.length) return '<span class="text-muted">Sin detalle de ítems</span>';
 return items.map(item => `
 <div class="order-item">
 <div class="order-item-name">${esc(item.nombre || 'Producto')}</div>
 <div class="order-item-detail">${esc(item.color || 'Estándar')} · ${Number(item.cantidad) || 1} u. × $${fmt(item.precio_usd)}</div>
 <div class="order-item-price mono">$${fmt(Number(item.precio_usd || 0) * (Number(item.cantidad) || 1))}</div>
 </div>
 `).join('');
}

function timeline(order) {
 const cancelled = order.estado_logistico === 'CANCELADO';
 const current = LOGISTIC_STEP[order.estado_logistico] ?? 0;
 const delivered = order.estado_logistico === 'ENTREGADO_FINALIZADO';

 return `
 <div class="timeline">
 ${TIMELINE_STEPS.map((step, index) => {
 let className = '';
 if (cancelled) className = index === 0 ? 'rejected' : '';
 else if (index < current || (delivered && index === current)) className = 'done';
 else if (index === current) className = 'current';

 const symbol = className === 'done' ? '' : className === 'rejected' ? '' : step.icon;
 return `
 <div class="timeline-step ${className}">
 <div class="timeline-dot">${symbol}</div>
 <div class="timeline-label">${step.label}</div>
 </div>`;
 }).join('')}
 </div>`;
}

function detailValue(value) {
 return value === null || value === undefined || value === '' ? '—' : esc(value);
}

function orderMarkup(order) {
 const items = parseItems(order);
 const delivered = order.estado_logistico === 'ENTREGADO_FINALIZADO';
 const rejected = order.estado_pago === 'RECHAZADO';

 return `
 <article class="order-card">
 <div class="order-card-header">
 <div>
 <div class="order-code">${esc(order.codigo_orden || order.codigo || '')}</div>
 <div class="order-date"> ${formatDate(order.fecha_creacion)}</div>
 </div>
 <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
 <div class="order-total">${fmtBs(order.total_usd)} <span class="text-muted" style="font-size:0.75rem;font-weight:400">(≈ ${fmt(order.total_usd)} USD)</span></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
 ${statusBadge(order.estado_pago)}
 ${statusBadge(order.estado_logistico)}
 </div>
 </div>
 </div>

 ${rejected && order.motivo_rechazo ? `
 <div class="alert alert-danger" style="margin-bottom:16px">
 <span></span><span><strong>Pago rechazado:</strong> ${esc(order.motivo_rechazo)}</span>
 </div>` : ''}

 ${timeline(order)}

 <div class="order-items">${itemsMarkup(items)}</div>

 <div class="order-detail-grid">
 <div><label>Método de pago</label><span class="value">${esc(METHOD_LABELS[order.metodo_pago] || order.metodo_pago || '—')}</span></div>
 <div><label>Referencia</label><span class="value mono">${detailValue(order.referencia_pago)}</span></div>
 <div><label>Ciudad</label><span class="value">${detailValue(order.ciudad)}</span></div>
 <div><label>Dirección</label><span class="value">${detailValue(order.direccion_entrega)}</span></div>
 <div><label>Total</label><span class="value mono">${fmtBs(order.total_usd)} (≈ ${fmt(order.total_usd)} USD)</span></div>
 <div><label>Estado logístico</label><span class="value">${esc(LOGISTIC_LABELS[order.estado_logistico] || order.estado_logistico || '—')}</span></div>
 </div>

 ${delivered ? `
 <div class="alert alert-success" style="align-items:flex-start;margin-top:8px">
 <span></span>
 <div>
 <strong>Entrega certificada</strong><br />
 VIN: <span class="mono">${detailValue(order.vin_asignado)}</span> ·
 Empaque: <span class="mono">${detailValue(order.codigo_empaque)}</span><br />
 Receptor: ${detailValue(order.receptor_nombre)} · CI ${detailValue(order.receptor_ci)} ·
 ${formatDate(order.fecha_entrega)}
 </div>
 </div>
 <div class="panel-actions" style="margin-top:16px">
 <button type="button" class="btn btn-primary" data-cert="${order.id}"> Certificado de Entrega</button>
 </div>` : ''}

 ${order.comprobante_url ? `
 <div style="margin-top:16px">
 <a href="${esc(order.comprobante_url)}" target="_blank" rel="noopener" class="text-accent" style="font-size:0.82rem">
 Ver comprobante de pago adjunto
 </a>
 </div>` : ''}
 </article>`;
}

function certificateHtml(order) {
 const items = parseItems(order);
 const signature = order.firma_entrega_base64
 ? `<img class="cert-sig-img" src="${order.firma_entrega_base64}" alt="Firma del receptor" />`
 : '<span>Sin firma registrada</span>';

 return `<!DOCTYPE html>
 <html lang="es">
 <head>
 <meta charset="UTF-8" />
 <title>Certificado ${esc(order.codigo_orden || '')}</title>
 <link rel="stylesheet" href="${window.location.origin}/styles.css" />
 </head>
 <body style="background:#fff;padding:24px">
 <div class="certificate">
 <div class="certificate-header">
 <div class="certificate-logo">MOTO<span>CONNECT</span></div>
 <div class="certificate-title">Certificado Digital de Entrega y Garantía</div>
 </div>

 <div class="certificate-section">
 <h4>Datos de la orden</h4>
 <div class="certificate-grid">
 <div class="certificate-field"><label>Código de orden</label><strong>${esc(order.codigo_orden || '')}</strong></div>
 <div class="certificate-field"><label>Fecha de pedido</label>${formatDate(order.fecha_creacion)}</div>
 <div class="certificate-field"><label>Cliente</label>${esc(order.cliente_nombre || '')}</div>
 <div class="certificate-field"><label>CI / NIT</label>${esc(order.cliente_ci || '')}</div>
 <div class="certificate-field"><label>Email</label>${esc(order.cliente_email || '')}</div>
 <div class="certificate-field"><label>Teléfono</label>${esc(order.cliente_telefono || '')}</div>
 <div class="certificate-field"><label>Ciudad</label>${esc(order.ciudad || '')}</div>
 <div class="certificate-field"><label>Dirección</label>${esc(order.direccion_entrega || '')}</div>
 </div>
 </div>

 <div class="certificate-section">
 <h4>Vehículo entregado</h4>
 <div class="certificate-grid">
 <div class="certificate-field"><label>VIN / Chasis</label><strong>${esc(order.vin_asignado || '—')}</strong></div>
 <div class="certificate-field"><label>Código de empaque</label>${esc(order.codigo_empaque || '—')}</div>
 <div class="certificate-field"><label>Responsable de empaque</label>${esc(order.responsable_empaque || '—')}</div>
 <div class="certificate-field"><label>Fecha de empaque</label>${formatDate(order.fecha_empacado)}</div>
 </div>
 </div>

 <div class="certificate-section">
 <h4>Detalle de ítems</h4>
 <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
 <thead>
 <tr style="background:#f5f5f5">
 <th style="text-align:left;padding:8px;border:1px solid #eee">Producto</th>
 <th style="text-align:left;padding:8px;border:1px solid #eee">Color</th>
 <th style="text-align:right;padding:8px;border:1px solid #eee">Cant.</th>
 <th style="text-align:right;padding:8px;border:1px solid #eee">Precio</th>
 </tr>
 </thead>
 <tbody>
 ${items.map(item => `
 <tr>
 <td style="padding:8px;border:1px solid #eee">${esc(item.nombre || 'Producto')}</td>
 <td style="padding:8px;border:1px solid #eee">${esc(item.color || 'Estándar')}</td>
 <td style="padding:8px;border:1px solid #eee;text-align:right">${Number(item.cantidad) || 1}</td>
 <td style="padding:8px;border:1px solid #eee;text-align:right">$${fmt(item.precio_usd)}</td>
 </tr>`).join('')}
 </tbody>
 </table>
 <div style="text-align:right;margin-top:12px;font-weight:700">Total: ${fmtBs(order.total_usd)} (≈ ${fmt(order.total_usd)} USD)</div>
 </div>

 <div class="certificate-section">
 <h4>Recepción y conformidad</h4>
 <div class="certificate-grid">
 <div class="certificate-field"><label>Receptor</label>${esc(order.receptor_nombre || '')}</div>
 <div class="certificate-field"><label>CI del receptor</label>${esc(order.receptor_ci || '')}</div>
 <div class="certificate-field"><label>Fecha de entrega</label>${formatDate(order.fecha_entrega)}</div>
 <div class="certificate-field"><label>Responsable de entrega</label>${esc(order.responsable_entrega || '')}</div>
 </div>
 <div style="margin-top:16px">
 <label style="font-size:0.75rem;color:#666;display:block;margin-bottom:6px">Firma digital del receptor</label>
 ${signature}
 </div>
 </div>

 <div class="certificate-section" style="border-top:2px solid #eee;padding-top:16px;font-size:0.8rem;color:#666">
 <p>Garantía oficial de fábrica: 24 meses o el kilometraje definido por el fabricante, lo que ocurra primero.</p>
 <p>Inspección PDI de 40 puntos completada · Documentación oficial entregada · MotoConnect S.R.L.</p>
 </div>

 <div style="text-align:center;margin-top:24px">
 <button type="button" id="cert-print" class="btn btn-primary"> Imprimir certificado</button>
 </div>
 </div>
 </body>
 </html>`;
}

function openCertificate(order) {
 const printWindow = window.open('', '_blank', 'width=900,height=1000');
 if (!printWindow) {
 toast('Habilita las ventanas emergentes para imprimir el certificado', 'warning');
 return;
 }
 printWindow.document.open();
 printWindow.document.write(certificateHtml(order));
 printWindow.document.close();
 printWindow.document.querySelector('#cert-print')?.addEventListener('click', () => printWindow.print());
 printWindow.focus();
}

export async function orders(root) {
 if (!state.user) {
 root.innerHTML = `
 <section class="section">
 <div class="login-prompt">
 <div style="font-size:3.5rem;margin-bottom:16px"></div>
 <h2>Inicia sesión para consultar tus pedidos</h2>
 <p>Accede con tu cuenta para ver el estado de tus compras y tus certificados de entrega.</p>
 <a href="#/login" class="btn btn-primary">Iniciar Sesión</a>
 </div>
 </section>`;
 return;
 }

 root.innerHTML = `
 <div class="page-header">
 <div class="page-header-inner">
 <h1>Mis Pedidos</h1>
 <p>Seguimiento de compras, pagos y entrega certificada</p>
 </div>
 </div>
 <div class="section">
 <div class="panel-toolbar">
 <span class="text-muted" id="orders-count">Cargando pedidos...</span>
 <button type="button" class="btn btn-secondary btn-sm" id="orders-refresh"> Actualizar</button>
 </div>
 <div class="orders-list" id="orders-list">
 <div class="spinner-wrap"><div class="spinner"></div></div>
 </div>
 </div>`;

 const list = root.querySelector('#orders-list');
 const counter = root.querySelector('#orders-count');

 async function load() {
 list.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
 try {
 const rows = await api(`/pedidos?email=${encodeURIComponent(state.user.email)}`);
 state.orders = rows;
 counter.textContent = `${rows.length} pedido${rows.length === 1 ? '' : 's'} registrado${rows.length === 1 ? '' : 's'}`;

 if (!rows.length) {
 list.innerHTML = `
 <div class="empty-state">
 <span class="empty-icon"></span>
 <h3>Aún no tienes pedidos</h3>
 <p>Explora el catálogo y arma tu primera motocicleta.</p>
 <a href="#/catalogo" class="btn btn-primary"> Ir al Catálogo</a>
 </div>`;
 return;
 }

 list.innerHTML = rows.map(orderMarkup).join('');
 list.querySelectorAll('[data-cert]').forEach(button => {
 button.addEventListener('click', () => {
 const order = rows.find(row => Number(row.id) === Number(button.dataset.cert));
 if (order) openCertificate(order);
 });
 });
 } catch (error) {
 counter.textContent = '';
 list.innerHTML = `
 <div class="empty-state">
 <span class="empty-icon"></span>
 <h3>No se pudieron cargar tus pedidos</h3>
 <p>${esc(error.message)}</p>
 <button type="button" class="btn btn-primary" id="orders-retry">Reintentar</button>
 </div>`;
 list.querySelector('#orders-retry')?.addEventListener('click', load);
 }
 }

 root.querySelector('#orders-refresh')?.addEventListener('click', load);
 await load();
}
