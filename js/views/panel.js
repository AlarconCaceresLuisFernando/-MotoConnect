/* ============================================================
 MotoConnect — views/panel.js (#/panel)
 Panel operativo por rol: pagos, almacén PDI, despacho y stock
 ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { OPERATIVE_ROLES, ROL_LABELS, METHOD_LABELS } from '../config.js';
import { fmt, fmtBs, esc, toast, statusBadge, genVIN, genPKG } from '../utils.js';

const TABS = [
 { id: 'resumen', label: 'Resumen General', icon: '', roles: OPERATIVE_ROLES },
 { id: 'pagos', label: 'Verificación de Pagos', icon: '', roles: ['VERIFICADOR_PAGOS', 'ADMIN'] },
 { id: 'almacen', label: 'Almacén y Empaque', icon: '', roles: ['ALMACEN_EMPAQUE', 'ADMIN'] },
 { id: 'despacho', label: 'Despacho y Entrega', icon: '', roles: ['DESPACHO_ENTREGA', 'ADMIN'] },
 { id: 'stock', label: 'Control de Inventario', icon: '', roles: ['ALMACEN_EMPAQUE', 'ADMIN'] },
];

const DEFAULT_TAB = {
 VERIFICADOR_PAGOS: 'pagos',
 ALMACEN_EMPAQUE: 'almacen',
 DESPACHO_ENTREGA: 'despacho',
 ADMIN: 'resumen',
 CLIENTE: 'resumen',
};

const PDI_ITEMS = [
 'Aceite, refrigerante y niveles verificados',
 'Batería cargada y diagnóstico OBD sin códigos',
 'Neumáticos, torque de ejes y presión correcta',
 'Embalaje, llaves codificadas y manual entregado',
];

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

function itemsMarkup(order) {
 const items = parseItems(order);
 if (!items.length) return '<span class="text-muted">Sin ítems</span>';
 return `
 <div class="order-items">
 ${items.map(item => `
 <div class="order-item">
 <div class="order-item-name">${esc(item.nombre || 'Producto')}</div>
 <div class="order-item-detail">${esc(item.color || 'Estándar')} · ${Number(item.cantidad) || 1} u. × $${fmt(item.precio_usd)}</div>
 <div class="order-item-price mono">$${fmt(Number(item.precio_usd || 0) * (Number(item.cantidad) || 1))}</div>
 </div>
 `).join('')}
 </div>`;
}

function detailsMarkup(order) {
 return `
 <div class="order-detail-grid">
 <div><label>Cliente</label><span class="value">${esc(order.cliente_nombre || '—')}</span></div>
 <div><label>Email</label><span class="value">${esc(order.cliente_email || '—')}</span></div>
 <div><label>Teléfono</label><span class="value">${esc(order.cliente_telefono || '—')}</span></div>
 <div><label>CI / NIT</label><span class="value">${esc(order.cliente_ci || '—')}</span></div>
 <div><label>Entrega</label><span class="value">${esc(order.ciudad || '—')} · ${esc(order.direccion_entrega || '—')}</span></div>
 <div><label>Fecha</label><span class="value">${formatDate(order.fecha_creacion)}</span></div>
 </div>`;
}

function emptyBlock(icon, title, copy) {
 return `
 <div class="empty-state">
 <span class="empty-icon">${icon}</span>
 <h3>${title}</h3>
 <p>${copy}</p>
 </div>`;
}

function stockPill(stock) {
 const value = Number(stock || 0);
 const className = value === 0 ? 'status-rejected' : value <= 1 ? 'status-pending' : 'status-verified';
 return `<span class="status-badge ${className}">${value} u.</span>`;
}

function setupSignature(canvas) {
 const width = Math.max(320, Math.round(canvas.getBoundingClientRect().width || 560));
 canvas.width = width;
 canvas.height = 160;
 canvas.dataset.signed = 'false';

 const context = canvas.getContext('2d');
 context.lineWidth = 2;
 context.lineCap = 'round';
 context.lineJoin = 'round';
 context.strokeStyle = '#0F172A';

 let drawing = false;
 const pointOf = event => {
 const rect = canvas.getBoundingClientRect();
 return {
 x: (event.clientX - rect.left) * (canvas.width / rect.width),
 y: (event.clientY - rect.top) * (canvas.height / rect.height),
 };
 };

 canvas.addEventListener('pointerdown', event => {
 drawing = true;
 canvas.dataset.signed = 'true';
 canvas.setPointerCapture(event.pointerId);
 const point = pointOf(event);
 context.beginPath();
 context.moveTo(point.x, point.y);
 event.preventDefault();
 });

 canvas.addEventListener('pointermove', event => {
 if (!drawing) return;
 const point = pointOf(event);
 context.lineTo(point.x, point.y);
 context.stroke();
 event.preventDefault();
 });

 const stop = () => { drawing = false; };
 canvas.addEventListener('pointerup', stop);
 canvas.addEventListener('pointercancel', stop);
 canvas.addEventListener('pointerleave', stop);
}

export async function panel(root) {
 if (!state.user || !OPERATIVE_ROLES.includes(state.user.rol)) {
 toast('Acceso restringido al equipo operativo', 'warning');
 location.hash = state.user ? '#/' : '#/login';
 return;
 }

 const user = state.user;
 const allowedTabs = TABS.filter(tab => tab.roles.includes(user.rol));
 let currentTab = allowedTabs.some(tab => tab.id === DEFAULT_TAB[user.rol])
 ? DEFAULT_TAB[user.rol]
 : allowedTabs[0].id;

 root.innerHTML = `
 <div class="page-header">
 <div class="page-header-inner">
 <div class="panel-toolbar" style="margin-bottom:8px">
 <div>
 <h1>Panel Operativo</h1>
 <p>${esc(user.nombre)} · ${esc(user.cargo_etiqueta || ROL_LABELS[user.rol] || user.rol)}</p>
 </div>
 <span class="status-badge status-info">${esc(ROL_LABELS[user.rol] || user.rol)}</span>
 </div>
 </div>
 </div>

 <div class="section">
 <div class="panel-layout">
 <aside class="panel-sidebar" id="panel-sidebar">
 <h4>Operaciones</h4>
 </aside>
 <div class="panel-content" id="panel-content">
 <div class="spinner-wrap"><div class="spinner"></div></div>
 </div>
 </div>
 </div>
 `;

 const sidebar = root.querySelector('#panel-sidebar');
 const content = root.querySelector('#panel-content');

 let orders = [];
 let products = [];

 const pendingCounts = () => ({
 pagos: orders.filter(order => order.estado_pago === 'EN_REVISION').length,
 almacen: orders.filter(order =>
 order.estado_pago === 'VERIFICADO' &&
 ['LISTO_PARA_PREPARAR', 'EN_PREPARACION_PDI'].includes(order.estado_logistico)
 ).length,
 despacho: orders.filter(order =>
 ['EMPACADO_LISTO_DESPACHO', 'EN_RUTA_ENTREGA'].includes(order.estado_logistico)
 ).length,
 stock: products.filter(product => Number(product.stock_disponible) <= 1).length,
 });

 function renderSidebar() {
 const counts = pendingCounts();
 sidebar.innerHTML = `
 <h4>Operaciones</h4>
 ${allowedTabs.map(tab => {
 const count = counts[tab.id];
 return `
 <button type="button" class="panel-sidebar-btn ${tab.id === currentTab ? 'active' : ''}" data-panel-tab="${tab.id}">
 <span>${tab.icon}</span>
 <span style="flex:1">${tab.label}</span>
 ${count !== undefined && count > 0
 ? `<span class="status-badge ${tab.id === 'stock' ? 'status-pending' : 'status-info'}">${count}</span>`
 : ''}
 </button>`;
 }).join('')}
 `;
 }

 async function reload() {
 const [pedidos, productos] = await Promise.all([api('/pedidos'), api('/productos')]);
 orders = pedidos;
 products = productos;
 state.orders = pedidos;
 state.products = productos;
 }

 /* ---------- Resumen ---------- */
 function renderResumen() {
 const pendingPayments = orders.filter(order => order.estado_pago === 'EN_REVISION').length;
 const pendingWarehouse = orders.filter(order =>
 order.estado_pago === 'VERIFICADO' &&
 ['LISTO_PARA_PREPARAR', 'EN_PREPARACION_PDI'].includes(order.estado_logistico)
 ).length;
 const onRoute = orders.filter(order => ['EMPACADO_LISTO_DESPACHO', 'EN_RUTA_ENTREGA'].includes(order.estado_logistico)).length;
 const delivered = orders.filter(order => order.estado_logistico === 'ENTREGADO_FINALIZADO').length;
 const lowStock = products.filter(product => Number(product.stock_disponible) <= 1).length;

 content.innerHTML = `
 <div class="stat-grid">
 <div class="stat-card">
 <span class="stat-label">Pagos por verificar</span>
 <span class="stat-value orange">${pendingPayments}</span>
 <span class="stat-hint">Comprobantes en revisión</span>
 </div>
 <div class="stat-card">
 <span class="stat-label">En almacén / PDI</span>
 <span class="stat-value">${pendingWarehouse}</span>
 <span class="stat-hint">Listos para preparar</span>
 </div>
 <div class="stat-card">
 <span class="stat-label">En despacho</span>
 <span class="stat-value">${onRoute}</span>
 <span class="stat-hint">Empacados o en ruta</span>
 </div>
 <div class="stat-card">
 <span class="stat-label">Entregados</span>
 <span class="stat-value green">${delivered}</span>
 <span class="stat-hint">Con certificado digital</span>
 </div>
 <div class="stat-card">
 <span class="stat-label">Stock crítico</span>
 <span class="stat-value ${lowStock ? 'red' : 'green'}">${lowStock}</span>
 <span class="stat-hint">Productos con 0–1 unidades</span>
 </div>
 </div>

 <div class="panel-card">
 <div class="panel-card-header">
 <div class="panel-card-title"> Últimos pedidos</div>
 <button type="button" class="btn btn-secondary btn-sm" data-refresh> Actualizar</button>
 </div>
 ${orders.length ? `
 <div style="overflow-x:auto">
 <table class="inventory-table">
 <thead>
 <tr>
 <th>Orden</th><th>Cliente</th><th>Pago</th><th>Logística</th><th>Total</th><th>Fecha</th>
 </tr>
 </thead>
 <tbody>
 ${orders.slice(0, 8).map(order => `
 <tr>
 <td class="mono" style="color:var(--accent-primary)">${esc(order.codigo_orden)}</td>
 <td>${esc(order.cliente_nombre)}</td>
 <td>${statusBadge(order.estado_pago)}</td>
 <td>${statusBadge(order.estado_logistico)}</td>
 <td class="mono">${fmtBs(order.total_usd)}</td>
 <td class="text-muted" style="font-size:0.8rem">${formatDate(order.fecha_creacion, false)}</td>
 </tr>`).join('')}
 </tbody>
 </table>
 </div>` : emptyBlock('', 'Sin pedidos registrados', 'Los pedidos aparecerán aquí cuando los clientes realicen una compra.')}
 </div>
 `;

 content.querySelector('[data-refresh]')?.addEventListener('click', async event => {
 const button = event.currentTarget;
 button.disabled = true;
 button.textContent = 'Actualizando...';
 try {
 await reload();
 render();
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = ' Actualizar';
 }
 });
 }

 /* ---------- Pagos ---------- */
 function renderPagos() {
 const pending = orders.filter(order => order.estado_pago === 'EN_REVISION');
 const recent = orders
 .filter(order => order.estado_pago !== 'EN_REVISION')
 .slice(0, 6);

 content.innerHTML = `
 <div class="panel-toolbar">
 <div>
 <div class="panel-card-title"> Comprobantes en revisión</div>
 <span class="text-muted" style="font-size:0.82rem">${pending.length} pago${pending.length === 1 ? '' : 's'} esperando validación</span>
 </div>
 <button type="button" class="btn btn-secondary btn-sm" data-refresh> Actualizar</button>
 </div>

 ${pending.length ? pending.map(order => `
 <article class="panel-card" data-order="${order.id}">
 <div class="panel-card-header">
 <div>
 <div class="panel-card-title mono" style="color:var(--accent-primary)">${esc(order.codigo_orden)}</div>
 <div class="text-muted" style="font-size:0.82rem;margin-top:4px">
 ${esc(order.cliente_nombre)} · ${esc(order.cliente_email)}
 </div>
 </div>
 <div style="text-align:right">
 <div class="order-total" style="font-size:1.15rem">${fmtBs(order.total_usd)}</div>
 <div class="text-muted" style="font-size:0.75rem">${fmtBs(order.total_usd)}</div>
 ${statusBadge(order.estado_pago)}
 </div>
 </div>

 ${detailsMarkup(order)}

 <div class="order-detail-grid">
 <div><label>Método</label><span class="value">${esc(METHOD_LABELS[order.metodo_pago] || order.metodo_pago)}</span></div>
 <div><label>Referencia bancaria</label><span class="value mono">${esc(order.referencia_pago || '—')}</span></div>
 <div><label>Comprobante</label><span class="value">${order.comprobante_url ? 'Adjunto' : 'No adjunto'}</span></div>
 </div>

 <div style="margin:16px 0">
 <label style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Ítems del pedido</label>
 ${itemsMarkup(order)}
 </div>

 ${order.comprobante_url ? `
 <a href="${esc(order.comprobante_url)}" target="_blank" rel="noopener" title="Ampliar comprobante">
 <img class="comprobante-preview" src="${esc(order.comprobante_url)}" alt="Comprobante ${esc(order.codigo_orden)}" />
 </a>
 ` : '<div class="alert alert-warning"><span></span><span>El pedido no tiene comprobante adjunto. Verifica la referencia antes de aprobar.</span></div>'}

 <div class="panel-actions" style="margin-top:20px">
 <button type="button" class="btn btn-success" data-action="aprobar-pago" data-id="${order.id}"> Aprobar pago</button>
 <button type="button" class="btn btn-danger" data-action="rechazar-pago" data-id="${order.id}"> Rechazar pago</button>
 </div>
 </article>
 `).join('') : emptyBlock('', 'No hay pagos pendientes', 'Todos los comprobantes fueron procesados.')}

 <div class="panel-card">
 <div class="panel-card-header">
 <div class="panel-card-title"> Historial reciente</div>
 </div>
 ${recent.length ? `
 <div style="overflow-x:auto">
 <table class="inventory-table">
 <thead><tr><th>Orden</th><th>Cliente</th><th>Método</th><th>Pago</th><th>Total</th><th>Responsable</th></tr></thead>
 <tbody>
 ${recent.map(order => `
 <tr>
 <td class="mono">${esc(order.codigo_orden)}</td>
 <td>${esc(order.cliente_nombre)}</td>
 <td>${esc(METHOD_LABELS[order.metodo_pago] || order.metodo_pago)}</td>
 <td>${statusBadge(order.estado_pago)}</td>
 <td class="mono">$${fmt(order.total_usd)}</td>
 <td class="text-muted" style="font-size:0.8rem">${esc(order.responsable_pagos || '—')}</td>
 </tr>`).join('')}
 </tbody>
 </table>
 </div>` : '<p class="text-muted" style="font-size:0.85rem">Sin movimientos previos.</p>'}
 </div>
 `;

 bindRefresh();
 bindPaymentActions();
 }

 function bindPaymentActions() {
 content.querySelectorAll('[data-action="aprobar-pago"], [data-action="rechazar-pago"]').forEach(button => {
 button.addEventListener('click', async () => {
 const action = button.dataset.action;
 const id = button.dataset.id;
 const original = button.textContent;

 if (action === 'aprobar-pago') {
 if (!window.confirm('¿Aprobar este pago? Se descontará el stock y el pedido pasará a preparación PDI.')) return;
 } else {
 const reason = window.prompt('Motivo del rechazo (visible para el cliente):', 'Comprobante ilegible o monto no coincide');
 if (reason === null) return;
 button.dataset.reason = reason.trim() || 'Comprobante no válido';
 }

 button.disabled = true;
 button.textContent = 'Procesando...';
 try {
 if (action === 'aprobar-pago') {
 await api(`/pedidos/${id}/aprobar-pago`, {
 method: 'PATCH',
 body: { responsable_pagos: user.nombre },
 });
 toast('Pago verificado · Stock reservado y pedido listo para PDI', 'success');
 } else {
 await api(`/pedidos/${id}/rechazar-pago`, {
 method: 'PATCH',
 body: {
 motivo_rechazo: button.dataset.reason,
 responsable_pagos: user.nombre,
 },
 });
 toast('Pago rechazado y pedido cancelado', 'info');
 }
 await reload();
 render();
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = original;
 }
 });
 });
 }

 /* ---------- Almacén / PDI ---------- */
 function renderAlmacen() {
 const pending = orders.filter(order =>
 order.estado_pago === 'VERIFICADO' &&
 ['LISTO_PARA_PREPARAR', 'EN_PREPARACION_PDI'].includes(order.estado_logistico)
 );

 content.innerHTML = `
 <div class="panel-toolbar">
 <div>
 <div class="panel-card-title"> Preparación y empaque PDI</div>
 <span class="text-muted" style="font-size:0.82rem">${pending.length} pedido${pending.length === 1 ? '' : 's'} listo${pending.length === 1 ? '' : 's'} para inspección</span>
 </div>
 <button type="button" class="btn btn-secondary btn-sm" data-refresh> Actualizar</button>
 </div>

 ${pending.length ? pending.map(order => `
 <article class="panel-card" data-order="${order.id}">
 <div class="panel-card-header">
 <div>
 <div class="panel-card-title mono" style="color:var(--accent-primary)">${esc(order.codigo_orden)}</div>
 <div class="text-muted" style="font-size:0.82rem;margin-top:4px">${esc(order.cliente_nombre)} · ${esc(order.ciudad)}</div>
 </div>
 ${statusBadge(order.estado_logistico)}
 </div>

 ${detailsMarkup(order)}
 ${itemsMarkup(order)}

 <div class="form-grid" style="margin-top:20px">
 <div class="form-group">
 <label for="vin-${order.id}">VIN / Número de chasis *</label>
 <input id="vin-${order.id}" data-vin type="text" maxlength="17" class="mono" value="${esc(order.vin_asignado || genVIN())}" />
 </div>
 <div class="form-group">
 <label for="pkg-${order.id}">Código de empaque *</label>
 <input id="pkg-${order.id}" data-pkg type="text" class="mono" value="${esc(order.codigo_empaque || genPKG())}" />
 </div>
 </div>

 <div style="margin-top:20px">
 <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em">
 Checklist PDI de entrega (4 puntos obligatorios)
 </label>
 <div class="pdi-checklist">
 ${PDI_ITEMS.map((item, index) => `
 <div class="pdi-item">
 <input id="pdi-${order.id}-${index}" type="checkbox" data-pdi />
 <label for="pdi-${order.id}-${index}">${esc(item)}</label>
 </div>`).join('')}
 </div>
 </div>

 <div class="form-group" style="margin-top:16px">
 <label for="notes-${order.id}">Notas de almacén (opcional)</label>
 <textarea id="notes-${order.id}" data-notes rows="2" placeholder="Observaciones de inspección, accesorios instalados, etc."></textarea>
 </div>

 <div class="panel-actions" style="margin-top:20px">
 <button type="button" class="btn btn-primary" data-action="preparar-empaque" data-id="${order.id}">
 Registrar empaque y pasar a despacho
 </button>
 </div>
 </article>
 `).join('') : emptyBlock('', 'No hay pedidos pendientes de empaque', 'Los pedidos con pago verificado aparecerán aquí automáticamente.')}
 `;

 bindRefresh();
 bindWarehouseActions();
 }

 function bindWarehouseActions() {
 content.querySelectorAll('[data-action="preparar-empaque"]').forEach(button => {
 button.addEventListener('click', async () => {
 const card = button.closest('[data-order]');
 const original = button.textContent;
 const vin = card.querySelector('[data-vin]').value.trim().toUpperCase();
 const pkg = card.querySelector('[data-pkg]').value.trim().toUpperCase();
 const checks = [...card.querySelectorAll('[data-pdi]')];
 const notes = card.querySelector('[data-notes]').value.trim();

 if (vin.length < 6) { toast('Ingresa un VIN / chasis válido', 'warning'); return; }
 if (!pkg) { toast('El código de empaque es obligatorio', 'warning'); return; }
 if (checks.some(check => !check.checked)) {
 toast('Completa los 4 puntos del checklist PDI', 'warning');
 return;
 }

 button.disabled = true;
 button.textContent = 'Registrando empaque...';
 try {
 await api(`/pedidos/${button.dataset.id}/preparar-empaque`, {
 method: 'PATCH',
 body: {
 vin_asignado: vin,
 codigo_empaque: pkg,
 checklist_pdi: checks.map(check => check.checked),
 notas_almacen: notes || null,
 responsable_empaque: user.nombre,
 },
 });
 toast('Empaque registrado · Pedido listo para despacho', 'success');
 await reload();
 render();
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = original;
 }
 });
 });
 }

 /* ---------- Despacho / Entrega ---------- */
 function renderDespacho() {
 const ready = orders.filter(order => order.estado_logistico === 'EMPACADO_LISTO_DESPACHO');
 const enRoute = orders.filter(order => order.estado_logistico === 'EN_RUTA_ENTREGA');

 content.innerHTML = `
 <div class="panel-toolbar">
 <div>
 <div class="panel-card-title"> Despacho y entrega certificada</div>
 <span class="text-muted" style="font-size:0.82rem">
 ${ready.length} por despachar · ${enRoute.length} en ruta
 </span>
 </div>
 <button type="button" class="btn btn-secondary btn-sm" data-refresh> Actualizar</button>
 </div>

 <h2 style="font-size:1.05rem;margin-top:8px"> Listos para despacho</h2>
 ${ready.length ? ready.map(order => `
 <article class="panel-card" data-order="${order.id}">
 <div class="panel-card-header">
 <div>
 <div class="panel-card-title mono" style="color:var(--accent-primary)">${esc(order.codigo_orden)}</div>
 <div class="text-muted" style="font-size:0.82rem;margin-top:4px">
 ${esc(order.cliente_nombre)} · ${esc(order.ciudad)}
 </div>
 </div>
 ${statusBadge(order.estado_logistico)}
 </div>

 <div class="order-detail-grid">
 <div><label>VIN / Chasis</label><span class="value mono">${esc(order.vin_asignado || '—')}</span></div>
 <div><label>Código de empaque</label><span class="value mono">${esc(order.codigo_empaque || '—')}</span></div>
 <div><label>Responsable de empaque</label><span class="value">${esc(order.responsable_empaque || '—')}</span></div>
 <div><label>Fecha de empaque</label><span class="value">${formatDate(order.fecha_empacado)}</span></div>
 <div><label>Dirección de entrega</label><span class="value">${esc(order.direccion_entrega || '—')}</span></div>
 <div><label>Teléfono</label><span class="value">${esc(order.cliente_telefono || '—')}</span></div>
 </div>

 ${itemsMarkup(order)}

 <div class="panel-actions" style="margin-top:20px">
 <button type="button" class="btn btn-primary" data-action="en-ruta" data-id="${order.id}"> Marcar en ruta de entrega</button>
 </div>
 </article>
 `).join('') : emptyBlock('', 'No hay pedidos listos para despacho', 'Los pedidos empacados aparecerán en esta sección.')}

 <h2 style="font-size:1.05rem;margin-top:24px"> En ruta · confirmar entrega</h2>
 ${enRoute.length ? enRoute.map(order => `
 <article class="panel-card" data-order="${order.id}">
 <div class="panel-card-header">
 <div>
 <div class="panel-card-title mono" style="color:var(--accent-primary)">${esc(order.codigo_orden)}</div>
 <div class="text-muted" style="font-size:0.82rem;margin-top:4px">
 ${esc(order.cliente_nombre)} · ${esc(order.ciudad)} · VIN ${esc(order.vin_asignado || '—')}
 </div>
 </div>
 ${statusBadge(order.estado_logistico)}
 </div>

 <div class="order-detail-grid">
 <div><label>Empaque</label><span class="value mono">${esc(order.codigo_empaque || '—')}</span></div>
 <div><label>Entrega</label><span class="value">${esc(order.direccion_entrega || '—')}</span></div>
 <div><label>Teléfono</label><span class="value">${esc(order.cliente_telefono || '—')}</span></div>
 <div><label>CI del cliente</label><span class="value">${esc(order.cliente_ci || '—')}</span></div>
 </div>

 <div class="form-grid" style="margin-top:16px">
 <div class="form-group">
 <label for="receptor-${order.id}">Nombre del receptor *</label>
 <input id="receptor-${order.id}" data-receptor type="text" value="${esc(order.cliente_nombre)}" required />
 </div>
 <div class="form-group">
 <label for="receptor-ci-${order.id}">CI del receptor *</label>
 <input id="receptor-ci-${order.id}" data-receptor-ci type="text" value="${esc(order.cliente_ci || '')}" required />
 </div>
 </div>

 <div class="signature-wrap">
 <label for="sig-${order.id}">Firma digital del receptor *</label>
 <canvas id="sig-${order.id}" data-sign aria-label="Firma del receptor"></canvas>
 <div class="sig-actions">
 <button type="button" class="btn btn-secondary btn-sm" data-clear-sign> Limpiar firma</button>
 </div>
 </div>

 <div class="pdi-item" style="margin-top:8px">
 <input id="conformity-${order.id}" type="checkbox" data-conformidad />
 <label for="conformity-${order.id}">El receptor confirma la conformidad del vehículo y recibió llaves, manual y documentación.</label>
 </div>

 <div class="panel-actions" style="margin-top:20px">
 <button type="button" class="btn btn-success" data-action="entregar" data-id="${order.id}"> Confirmar entrega y certificar</button>
 </div>
 </article>
 `).join('') : emptyBlock('', 'No hay entregas en ruta', 'Marca un pedido como “en ruta” para habilitar la firma de entrega.')}
 `;

 bindRefresh();
 bindDispatchActions();
 }

 function bindDispatchActions() {
 content.querySelectorAll('canvas[data-sign]').forEach(setupSignature);

 content.querySelectorAll('[data-clear-sign]').forEach(button => {
 button.addEventListener('click', () => {
 const card = button.closest('[data-order]');
 const canvas = card.querySelector('canvas[data-sign]');
 canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
 canvas.dataset.signed = 'false';
 });
 });

 content.querySelectorAll('[data-action="en-ruta"]').forEach(button => {
 button.addEventListener('click', async () => {
 const original = button.textContent;
 button.disabled = true;
 button.textContent = 'Actualizando...';
 try {
 await api(`/pedidos/${button.dataset.id}/en-ruta`, { method: 'PATCH' });
 toast('Pedido en ruta de entrega', 'success');
 await reload();
 render();
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = original;
 }
 });
 });

 content.querySelectorAll('[data-action="entregar"]').forEach(button => {
 button.addEventListener('click', async () => {
 const card = button.closest('[data-order]');
 const canvas = card.querySelector('canvas[data-sign]');
 const receptor = card.querySelector('[data-receptor]').value.trim();
 const receptorCi = card.querySelector('[data-receptor-ci]').value.trim();
 const conformity = card.querySelector('[data-conformidad]').checked;
 const original = button.textContent;

 if (!receptor) { toast('Ingresa el nombre del receptor', 'warning'); return; }
 if (!receptorCi) { toast('Ingresa la CI del receptor', 'warning'); return; }
 if (!conformity) { toast('El receptor debe confirmar la conformidad', 'warning'); return; }
 if (canvas.dataset.signed !== 'true') { toast('Se requiere la firma digital del receptor', 'warning'); return; }

 button.disabled = true;
 button.textContent = 'Registrando entrega...';
 try {
 await api(`/pedidos/${button.dataset.id}/entregar`, {
 method: 'PATCH',
 body: {
 receptor_nombre: receptor,
 receptor_ci: receptorCi,
 firma_entrega_base64: canvas.toDataURL('image/png'),
 responsable_entrega: user.nombre,
 },
 });
 toast('Entrega certificada · Pedido finalizado', 'success');
 await reload();
 render();
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = original;
 }
 });
 });
 }

 /* ---------- Inventario ---------- */
 function renderStock() {
 const totalUnits = products.reduce((total, product) => total + Number(product.stock_disponible || 0), 0);
 const inventoryValue = products.reduce(
 (total, product) => total + Number(product.precio_usd || 0) * Number(product.stock_disponible || 0),
 0
 );

 content.innerHTML = `
 <div class="stat-grid">
 <div class="stat-card">
 <span class="stat-label">SKU activos</span>
 <span class="stat-value">${products.length}</span>
 </div>
 <div class="stat-card">
 <span class="stat-label">Unidades en stock</span>
 <span class="stat-value">${totalUnits}</span>
 </div>
 <div class="stat-card">
 <span class="stat-label">Valor inventario</span>
 <span class="stat-value orange" style="font-size:1.35rem">${fmtBs(inventoryValue)}</span>
 </div>
 <div class="stat-card">
 <span class="stat-label">Stock crítico</span>
 <span class="stat-value red">${products.filter(product => Number(product.stock_disponible) <= 1).length}</span>
 </div>
 </div>

 <div class="panel-card">
 <div class="panel-card-header">
 <div class="panel-card-title"> Control de Inventario</div>
 <button type="button" class="btn btn-secondary btn-sm" data-refresh> Actualizar</button>
 </div>
 <div style="overflow-x:auto">
 <table class="inventory-table">
 <thead>
 <tr>
 <th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Ajuste (+/−)</th><th></th>
 </tr>
 </thead>
 <tbody>
 ${products.map(product => `
 <tr data-stock-row="${product.id}">
 <td>
 <div style="font-weight:600">${esc(product.nombre)}</div>
 <div class="text-muted mono" style="font-size:0.72rem">${esc(product.slug)}</div>
 </td>
 <td class="text-secondary">${esc(product.categoria)}</td>
 <td class="mono">${fmtBs(product.precio_usd)}</td>
 <td>${stockPill(product.stock_disponible)}</td>
 <td>
 <input type="number" data-stock-delta step="1" value="0" aria-label="Ajuste de stock para ${esc(product.nombre)}" />
 </td>
 <td>
 <button type="button" class="btn btn-secondary btn-sm" data-stock-apply data-id="${product.id}">Aplicar</button>
 </td>
 </tr>`).join('')}
 </tbody>
 </table>
 </div>
 <p class="text-muted" style="font-size:0.78rem;margin-top:12px">
 El ajuste se suma o resta al stock actual (usa valores negativos para descontar). No permite stock negativo.
 </p>
 </div>
 `;

 bindRefresh();
 content.querySelectorAll('[data-stock-apply]').forEach(button => {
 button.addEventListener('click', async () => {
 const row = button.closest('[data-stock-row]');
 const delta = Number(row.querySelector('[data-stock-delta]').value);
 if (!Number.isFinite(delta) || delta === 0) {
 toast('Ingresa un ajuste distinto de cero', 'warning');
 return;
 }

 const original = button.textContent;
 button.disabled = true;
 button.textContent = '...';
 try {
 const updated = await api(`/productos/${button.dataset.id}/stock`, {
 method: 'PATCH',
 body: { cantidad: delta },
 });
 toast(`Stock actualizado: ${updated.nombre} → ${updated.stock_disponible} u.`, 'success');
 await reload();
 render();
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = original;
 }
 });
 });
 }

 /* ---------- Utilidades de la vista ---------- */
 function bindRefresh() {
 content.querySelectorAll('[data-refresh]').forEach(button => {
 button.addEventListener('click', async () => {
 const original = button.textContent;
 button.disabled = true;
 button.textContent = 'Actualizando...';
 try {
 await reload();
 render();
 } catch (error) {
 toast(error.message, 'danger');
 button.disabled = false;
 button.textContent = original;
 }
 });
 });
 }

 function render() {
 renderSidebar();
 if (currentTab === 'pagos') renderPagos();
 else if (currentTab === 'almacen') renderAlmacen();
 else if (currentTab === 'despacho') renderDespacho();
 else if (currentTab === 'stock') renderStock();
 else renderResumen();
 }

 sidebar.addEventListener('click', event => {
 const button = event.target.closest('[data-panel-tab]');
 if (!button) return;
 currentTab = button.dataset.panelTab;
 render();
 });

 try {
 await reload();
 render();
 } catch (error) {
 content.innerHTML = `
 <div class="empty-state">
 <span class="empty-icon"></span>
 <h3>No se pudo cargar el panel</h3>
 <p>${esc(error.message)}</p>
 </div>`;
 }
}
