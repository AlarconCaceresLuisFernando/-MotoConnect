/* ============================================================
   MotoConnect — views/panel.js (#/panel)
   Panel operativo por rol: pagos, almacén PDI 40 pts, despacho y stock
   ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { OPERATIVE_ROLES, ROL_LABELS, METHOD_LABELS, PRODUCT_CATEGORIES, BS_RATE } from '../config.js';
import { fmt, fmtBs, esc, toast, statusBadge, genVIN, genPKG, icon, fetchProtectedReceipt, productImages, downloadPdfBlob } from '../utils.js';

const TABS = [
  { id: 'resumen', label: 'Resumen General', icon: 'chart', roles: OPERATIVE_ROLES },
  { id: 'pagos', label: 'Verificación de Pagos', icon: 'credit-card', roles: ['VERIFICADOR_PAGOS', 'ADMIN'] },
  { id: 'almacen', label: 'Almacén y Empaque PDI', icon: 'wrench', roles: ['ALMACEN_EMPAQUE', 'ADMIN'] },
  { id: 'despacho', label: 'Despacho y Entrega', icon: 'truck', roles: ['DESPACHO_ENTREGA', 'ADMIN'] },
  { id: 'stock', label: 'Control de Inventario', icon: 'box', roles: ['ALMACEN_EMPAQUE', 'ADMIN'] },
  { id: 'catalogo', label: 'Catálogo y Papeles', icon: 'plus', roles: ['ALMACEN_EMPAQUE', 'ADMIN'] },
];

const DEFAULT_TAB = {
  VERIFICADOR_PAGOS: 'pagos',
  ALMACEN_EMPAQUE: 'almacen',
  DESPACHO_ENTREGA: 'despacho',
  ADMIN: 'resumen',
  CLIENTE: 'resumen',
};

const PDI_GROUPS = [
  {
    title: '1. Motor, Fluidos y Transmisión (8 puntos)',
    items: [
      'Nivel y estado del aceite de motor verificado en frío',
      'Nivel de líquido refrigerante y ausencia de fugas en mangueras',
      'Nivel de líquido de frenos delantero y trasero dentro de rango',
      'Tensión y lubricación de cadena / inspección de correa o cardán',
      'Respuesta suave de embrague y holgura de palanca dentro de especificación',
      'Ralentí estable y respuesta limpia de acelerador sin tirones',
      'Cambio secuencial de todas las marchas y neutral verificado',
      'Ausencia de ruidos anómalos, vibraciones excesivas o fugas de escape',
    ],
  },
  {
    title: '2. Sistema Eléctrico y Diagnóstico OBD (8 puntos)',
    items: [
      'Carga de batería medida (>= 12.6V) y bornes ajustados sin sulfatación',
      'Escaneo OBD-II / ECU ejecutado sin códigos de falla activos',
      'Arranque eléctrico (y pedal si aplica) probado en frío y caliente',
      'Sistema de carga / alternador verificando 13.8V–14.5V en marcha',
      'Tablero LCD/TFT/analógico, odómetro y testigos operativos',
      'Sistema ABS / control de tracción validado en autodiagnóstico',
      'Interruptor de corte de emergencia (kill switch) y sensor de pata lateral',
      'Claxon, puerto USB/accesorios y bloqueo de encendido funcionales',
    ],
  },
  {
    title: '3. Chasis, Suspensión, Frenos y Neumáticos (8 puntos)',
    items: [
      'Torque verificado en eje delantero y eje trasero según manual',
      'Presión de neumáticos delantero y trasero calibrada según fabricante',
      'Integridad de llantas, válvulas y alineación de aros/rayos',
      'Recorrido limpio de horquilla delantera sin pérdida en retenes',
      'Amortiguador(es) trasero(s) con precarga calibrada y sin fugas',
      'Freno delantero con mordida firme y disco sin alabeo',
      'Freno trasero (disco o tambor) calibrado sin roce continuo',
      'Juego libre de dirección y fijación de manillar comprobados',
    ],
  },
  {
    title: '4. Carrocería, Iluminación y Ergonomía (8 puntos)',
    items: [
      'Luz baja, luz alta y ráfaga de faro principal operativas y alineadas',
      'Luz de posición, freno (maneta y pedal) e iluminación de placa',
      'Direccionales delanteras, traseras y luces de parqueo funcionando',
      'Espejos retrovisores instalados, limpios y con fijación firme',
      'Carenados, guardabarros y tapas laterales sin rayaduras ni fisuras',
      'Asiento, cerradura de asiento y estribos (piloto/pasajero) firmes',
      'Parrilla, soportes o protecciones adicionales ajustados correctamente',
      'Limpieza integral y detallado final de entrega completado',
    ],
  },
  {
    title: '5. Documentación, Llaves, Herramientas y Embalaje (8 puntos)',
    items: [
      'Número de chasis (VIN) físico verificado vs. registro del pedido',
      'Número de motor verificado y registrado en ficha operativa',
      'Juego completo de 2 llaves codificadas en bolsa sellada',
      'Manual del propietario en español y cartilla de garantía incluidos',
      'Kit básico de herramientas de fábrica bajo el asiento verificado',
      'Accesorios adicionales del pedido empacados e inventariados',
      'Protección de partes sensibles y precinto de empaque colocado',
      'Etiquetado logístico con código PKG y destino confirmado',
    ],
  },
];

const TOTAL_PDI_POINTS = PDI_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

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

function parseChecklist(order) {
  try {
    const parsed = JSON.parse(order.checklist_pdi_json || '[]');
    if (Array.isArray(parsed)) {
      return Array.from({ length: TOTAL_PDI_POINTS }, (_, i) => Boolean(parsed[i]));
    }
  } catch {
    /* ignore */
  }
  return Array.from({ length: TOTAL_PDI_POINTS }, () => false);
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
      <div><label>Correo electrónico</label><span class="value">${esc(order.cliente_email || '—')}</span></div>
      <div><label>Teléfono</label><span class="value">${esc(order.cliente_telefono || '—')}</span></div>
      <div><label>CI / NIT</label><span class="value">${esc(order.cliente_ci || '—')}</span></div>
      <div><label>Entrega</label><span class="value">${esc(order.ciudad || '—')} · ${esc(order.direccion_entrega || '—')}</span></div>
      <div><label>Fecha</label><span class="value">${formatDate(order.fecha_creacion)}</span></div>
    </div>`;
}

function emptyBlock(iconName, title, copy) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon(iconName, 44)}</span>
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
  context.lineWidth = 2.2;
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

  const stop = () => {
    drawing = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', stop);
}

function openDecisionModal({
  title,
  bodyHtml,
  confirmLabel,
  confirmClass = 'btn-primary',
  requireInput = false,
  defaultInput = '',
  inputLabel = 'Motivo (visible para el cliente) *',
  inputType = 'text',
  inputPlaceholder = 'Ej. Comprobante ilegible o monto incorrecto',
}) {
  return new Promise(resolve => {
    const container = document.querySelector('#modals-container');
    if (!container) {
      resolve(null);
      return;
    }

    container.innerHTML = `
      <div class="modal-overlay" data-modal-overlay>
        <section class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="max-width:480px">
          <div class="modal-header">
            <h2 class="modal-title">${esc(title)}</h2>
            <button type="button" class="modal-close" aria-label="Cerrar" data-modal-cancel>${icon('x', 16)}</button>
          </div>
          <div style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6">
            ${bodyHtml}
            ${requireInput ? `
              <div class="form-group" style="margin-top:14px">
                <label for="modal-reason-input">${esc(inputLabel)}</label>
                <input id="modal-reason-input" type="${esc(inputType)}" value="${esc(defaultInput)}" placeholder="${esc(inputPlaceholder)}" />
              </div>` : ''}
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-cancel>Cancelar</button>
            <button type="button" class="btn ${confirmClass}" data-modal-confirm>${esc(confirmLabel)}</button>
          </div>
        </section>
      </div>`;

    const finish = result => {
      container.innerHTML = '';
      resolve(result);
    };

    container.querySelectorAll('[data-modal-cancel]').forEach(btn => btn.addEventListener('click', () => finish(null)));
    container.querySelector('[data-modal-overlay]')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) finish(null);
    });
    container.querySelector('[data-modal-confirm]')?.addEventListener('click', () => {
      if (requireInput) {
        const val = container.querySelector('#modal-reason-input')?.value.trim() || '';
        if (!val) {
          toast('Completa el campo requerido antes de continuar.', 'warning');
          return;
        }
        finish(val);
      } else {
        finish(true);
      }
    });
  });
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
    almacen: orders.filter(
      order =>
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
            <span style="display:inline-flex">${icon(tab.icon, 16)}</span>
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
    const pendingWarehouse = orders.filter(
      order =>
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
          <span class="stat-hint">Listos o en inspección 40 pts</span>
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
          <div class="panel-card-title">Últimos pedidos</div>
          <button type="button" class="btn btn-secondary btn-sm" data-refresh>${icon('refresh', 14)} <span>Actualizar</span></button>
        </div>
        ${orders.length ? `
          <div style="overflow-x:auto">
            <table class="inventory-table">
              <thead>
                <tr>
                  <th>Orden</th><th>Cliente</th><th>Pago</th><th>Logística</th><th>Total</th><th>Fecha</th><th>Papeles</th>
                </tr>
              </thead>
              <tbody>
                ${orders.slice(0, 10).map(order => `
                  <tr>
                    <td class="mono" style="color:var(--accent-primary)">${esc(order.codigo_orden)}</td>
                    <td>${esc(order.cliente_nombre)}</td>
                    <td>${statusBadge(order.estado_pago)}</td>
                    <td>${statusBadge(order.estado_logistico)}</td>
                    <td class="mono">${fmtBs(order.total_usd)}</td>
                    <td class="text-muted" style="font-size:0.8rem">${formatDate(order.fecha_creacion, false)}</td>
                    <td>
                      <button type="button" class="btn btn-outline btn-sm" data-panel-send-pdf="${order.id}" data-code="${esc(order.codigo_orden)}" data-email="${esc(order.cliente_email || '')}">
                        ${icon('mail', 13)} <span>Enviar PDF</span>
                      </button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : emptyBlock('package', 'Sin pedidos registrados', 'Los pedidos aparecerán aquí cuando los clientes realicen una compra.')}
      </div>
    `;

    bindRefresh();
    content.querySelectorAll('[data-panel-send-pdf]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.panelSendPdf;
        const code = btn.dataset.code || '';
        const targetEmail = await openDecisionModal({
          title: `Enviar papeles PDF · ${code}`,
          bodyHtml: '<p>Escribe el correo electrónico de la persona a quien deseas enviar la carpeta oficial en PDF (Factura, DUA/Póliza, RUAT, SOAT y Garantía):</p>',
          confirmLabel: 'Enviar PDF por correo',
          confirmClass: 'btn-primary',
          requireInput: true,
          defaultInput: btn.dataset.email || '',
          inputLabel: 'Correo electrónico del destinatario *',
          inputType: 'email',
          inputPlaceholder: 'cliente@gmail.com',
        });
        if (!targetEmail) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
          toast('Ingresa un correo electrónico válido.', 'warning');
          return;
        }
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        try {
          const res = await api(`/pedidos/${orderId}/enviar-documentos`, {
            method: 'POST',
            body: { email: targetEmail },
          });
          if (res.sent) {
            toast(res.message, 'success');
          } else {
            toast('Falta configurar SMTP en el servidor; descargando respaldo...', 'info');
            await downloadPdfBlob(`/api/pedidos/${orderId}/documentos-pdf`, `MotoConnect-Papeles-${code}.pdf`, state.token);
          }
        } catch (err) {
          toast(err.message, 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });
  }

  /* ---------- Pagos ---------- */
  function renderPagos() {
    const pending = orders.filter(order => order.estado_pago === 'EN_REVISION');
    const recent = orders
      .filter(order => order.estado_pago !== 'EN_REVISION')
      .slice(0, 8);

    content.innerHTML = `
      <div class="panel-toolbar">
        <div>
          <div class="panel-card-title">Comprobantes en revisión</div>
          <span class="text-muted" style="font-size:0.82rem">${pending.length} pago${pending.length === 1 ? '' : 's'} esperando validación</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-refresh>${icon('refresh', 14)} <span>Actualizar</span></button>
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
              <div class="text-muted mono" style="font-size:0.75rem;margin-bottom:6px">≈ $${fmt(order.total_usd)} USD</div>
              ${statusBadge(order.estado_pago)}
            </div>
          </div>

          ${detailsMarkup(order)}

          <div class="order-detail-grid">
            <div><label>Método</label><span class="value">${esc(METHOD_LABELS[order.metodo_pago] || order.metodo_pago)}</span></div>
            <div><label>Referencia bancaria</label><span class="value mono">${esc(order.referencia_pago || '—')}</span></div>
            <div><label>Comprobante</label><span class="value">${order.comprobante_url ? 'Adjunto privado' : 'No adjunto'}</span></div>
          </div>

          <div style="margin:16px 0">
            <label style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Ítems del pedido</label>
            ${itemsMarkup(order)}
          </div>

          ${order.comprobante_url ? `
            <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
              ${!String(order.comprobante_mime || '').includes('pdf')
                ? `<img class="comprobante-preview" data-protected-img="${esc(order.comprobante_url)}" alt="Comprobante ${esc(order.codigo_orden)}" style="display:none" />`
                : ''}
              <button type="button" class="btn btn-outline btn-sm" data-open-receipt="${order.id}">
                ${icon('file', 14)} <span>${String(order.comprobante_mime || '').includes('pdf') ? 'Ver comprobante PDF' : 'Ampliar comprobante'}</span>
              </button>
            </div>`
          : `<div class="alert alert-warning">${icon('alert', 16)}<span>El pedido no tiene comprobante adjunto.</span></div>`}

          <div class="panel-actions" style="margin-top:20px">
            <button type="button" class="btn btn-success" data-action="aprobar-pago" data-id="${order.id}" data-code="${esc(order.codigo_orden)}">
              ${icon('check', 15)} <span>Aprobar pago</span>
            </button>
            <button type="button" class="btn btn-danger" data-action="rechazar-pago" data-id="${order.id}" data-code="${esc(order.codigo_orden)}">
              ${icon('x', 15)} <span>Rechazar pago</span>
            </button>
          </div>
        </article>
      `).join('') : emptyBlock('credit-card', 'No hay pagos pendientes', 'Todos los comprobantes fueron procesados.')}

      <div class="panel-card">
        <div class="panel-card-header">
          <div class="panel-card-title">Historial reciente de cobranzas</div>
        </div>
        ${recent.length ? `
          <div style="overflow-x:auto">
            <table class="inventory-table">
              <thead><tr><th>Orden</th><th>Cliente</th><th>Método</th><th>Pago</th><th>Total Bs (USD)</th><th>Responsable</th></tr></thead>
              <tbody>
                ${recent.map(order => `
                  <tr>
                    <td class="mono">${esc(order.codigo_orden)}</td>
                    <td>${esc(order.cliente_nombre)}</td>
                    <td>${esc(METHOD_LABELS[order.metodo_pago] || order.metodo_pago)}</td>
                    <td>${statusBadge(order.estado_pago)}</td>
                    <td class="mono">${fmtBs(order.total_usd)} <span class="text-muted" style="font-size:0.75rem">($${fmt(order.total_usd)})</span></td>
                    <td class="text-muted" style="font-size:0.8rem">${esc(order.responsable_pagos || '—')}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<p class="text-muted" style="font-size:0.85rem">Sin movimientos previos.</p>'}
      </div>
    `;

    bindRefresh();
    bindPaymentActions();
    hydrateProtectedReceipts();
  }

  async function hydrateProtectedReceipts() {
    content.querySelectorAll('[data-protected-img]').forEach(async img => {
      try {
        const res = await fetchProtectedReceipt(img.dataset.protectedImg, state.token);
        img.src = res.blobUrl;
        img.style.display = 'block';
      } catch {
        /* keep hidden if unavailable */
      }
    });

    content.querySelectorAll('[data-open-receipt]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const order = orders.find(o => Number(o.id) === Number(btn.dataset.openReceipt));
        if (!order?.comprobante_url) return;
        const container = document.querySelector('#modals-container');
        if (!container) return;
        let blobUrl = null;
        const close = () => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          container.innerHTML = '';
        };
        container.innerHTML = `
          <div class="modal-overlay" data-modal-overlay>
            <section class="modal-box" role="dialog" aria-modal="true" aria-label="Comprobante de pago" style="max-width:720px">
              <div class="modal-header">
                <h2 class="modal-title">Comprobante · ${esc(order.codigo_orden)}</h2>
                <button type="button" class="modal-close" aria-label="Cerrar" data-modal-close>${icon('x', 16)}</button>
              </div>
              <div id="panel-receipt-body" class="spinner-wrap" style="padding:36px"><div class="spinner"></div></div>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>
              </div>
            </section>
          </div>`;
        container.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', close));
        container.querySelector('[data-modal-overlay]')?.addEventListener('click', e => {
          if (e.target === e.currentTarget) close();
        });
        const body = container.querySelector('#panel-receipt-body');
        try {
          const res = await fetchProtectedReceipt(order.comprobante_url, state.token);
          blobUrl = res.blobUrl;
          const isPdf = res.mime.includes('pdf') || String(order.comprobante_mime || '').includes('pdf');
          body.className = '';
          body.style.padding = '0';
          body.innerHTML = isPdf
            ? `<iframe src="${blobUrl}" title="Comprobante PDF" style="width:100%;height:460px;border:1px solid var(--border-color);border-radius:8px;background:#fff"></iframe>`
            : `<img src="${blobUrl}" alt="Comprobante ${esc(order.codigo_orden)}" style="max-width:100%;max-height:520px;margin:0 auto;border-radius:8px;border:1px solid var(--border-color)" />`;
        } catch (err) {
          body.className = '';
          body.innerHTML = `<div class="alert alert-danger">${icon('alert', 16)}<span>${esc(err.message)}</span></div>`;
        }
      });
    });
  }

  function bindPaymentActions() {
    content.querySelectorAll('[data-action="aprobar-pago"], [data-action="rechazar-pago"]').forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        const id = button.dataset.id;
        const code = button.dataset.code || '';
        const originalHtml = button.innerHTML;

        let reason = null;
        if (action === 'aprobar-pago') {
          const confirmed = await openDecisionModal({
            title: `Aprobar pago · ${code}`,
            bodyHtml: '<p>¿Confirmas la verificación del comprobante? El stock se descontará de forma atómica en SQLite y la orden pasará a Almacén para inspección PDI de 40 puntos.</p>',
            confirmLabel: 'Sí, aprobar pago',
            confirmClass: 'btn-success',
          });
          if (!confirmed) return;
        } else {
          reason = await openDecisionModal({
            title: `Rechazar pago · ${code}`,
            bodyHtml: '<p>La orden pasará a estado <strong>RECHAZADO / CANCELADO</strong> sin descontar inventario.</p>',
            confirmLabel: 'Confirmar rechazo',
            confirmClass: 'btn-danger',
            requireInput: true,
            defaultInput: 'Comprobante ilegible o monto no coincide',
          });
          if (!reason) return;
        }

        button.disabled = true;
        button.textContent = 'Procesando...';
        try {
          if (action === 'aprobar-pago') {
            await api(`/pedidos/${id}/aprobar-pago`, { method: 'PATCH', body: {} });
            toast('Pago verificado · Stock descontado y pedido listo para PDI', 'success');
          } else {
            await api(`/pedidos/${id}/rechazar-pago`, {
              method: 'PATCH',
              body: { motivo_rechazo: reason },
            });
            toast('Pago rechazado y pedido cancelado', 'info');
          }
          await reload();
          render();
        } catch (error) {
          toast(error.message, 'danger');
          button.disabled = false;
          button.innerHTML = originalHtml;
        }
      });
    });
  }

  /* ---------- Almacén / PDI 40 puntos ---------- */
  function renderAlmacen() {
    const pending = orders.filter(
      order =>
        order.estado_pago === 'VERIFICADO' &&
        ['LISTO_PARA_PREPARAR', 'EN_PREPARACION_PDI'].includes(order.estado_logistico)
    );

    content.innerHTML = `
      <div class="panel-toolbar">
        <div>
          <div class="panel-card-title">Preparación e Inspección PDI (40 puntos obligatorios)</div>
          <span class="text-muted" style="font-size:0.82rem">${pending.length} pedido${pending.length === 1 ? '' : 's'} en preparación</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-refresh>${icon('refresh', 14)} <span>Actualizar</span></button>
      </div>

      ${pending.length ? pending.map(order => {
        const checksState = parseChecklist(order);
        const completedCount = checksState.filter(Boolean).length;
        let globalIdx = 0;

        return `
          <article class="panel-card" data-order="${order.id}">
            <div class="panel-card-header">
              <div>
                <div class="panel-card-title mono" style="color:var(--accent-primary)">${esc(order.codigo_orden)}</div>
                <div class="text-muted" style="font-size:0.82rem;margin-top:4px">${esc(order.cliente_nombre)} · ${esc(order.ciudad)}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="status-badge status-info mono" data-pdi-badge="${order.id}">${completedCount} / ${TOTAL_PDI_POINTS} PDI</span>
                ${statusBadge(order.estado_logistico)}
              </div>
            </div>

            ${detailsMarkup(order)}
            ${itemsMarkup(order)}

            <div class="form-grid" style="margin-top:20px">
              <div class="form-group">
                <label for="vin-${order.id}">VIN / Número de chasis único (11–17 caracteres) *</label>
                <div style="display:flex;gap:8px">
                  <input id="vin-${order.id}" data-vin type="text" maxlength="17" class="mono" value="${esc(order.vin_asignado || genVIN())}" />
                  <button type="button" class="btn btn-secondary btn-sm" data-gen-vin title="Generar nuevo VIN">${icon('refresh', 14)}</button>
                </div>
              </div>
              <div class="form-group">
                <label for="pkg-${order.id}">Código de empaque único *</label>
                <div style="display:flex;gap:8px">
                  <input id="pkg-${order.id}" data-pkg type="text" class="mono" value="${esc(order.codigo_empaque || genPKG())}" />
                  <button type="button" class="btn btn-secondary btn-sm" data-gen-pkg title="Generar código PKG">${icon('refresh', 14)}</button>
                </div>
              </div>
            </div>

            <div class="pdi-progress-wrap" style="margin-top:20px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
                <label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em">
                  Checklist PDI de entrega (${TOTAL_PDI_POINTS} puntos técnicos)
                </label>
                <span class="mono" style="font-size:0.8rem;color:var(--accent-primary)" data-pdi-counter>${completedCount} / ${TOTAL_PDI_POINTS} verificados</span>
              </div>
              <div class="pdi-progress-bar">
                <div class="pdi-progress-fill" data-pdi-fill style="width:${Math.round((completedCount / TOTAL_PDI_POINTS) * 100)}%"></div>
              </div>
            </div>

            <div class="pdi-groups">
              ${PDI_GROUPS.map((group, gIdx) => {
                const startIdx = globalIdx;
                const itemsHtml = group.items.map((label, iIdx) => {
                  const idx = globalIdx;
                  globalIdx += 1;
                  const checked = checksState[idx];
                  return `
                    <div class="pdi-item">
                      <input id="pdi-${order.id}-${idx}" type="checkbox" data-pdi data-pdi-idx="${idx}" ${checked ? 'checked' : ''} />
                      <label for="pdi-${order.id}-${idx}"><span class="mono" style="color:var(--text-muted);margin-right:6px">#${String(idx + 1).padStart(2, '0')}</span>${esc(label)}</label>
                    </div>`;
                }).join('');
                return `
                  <details class="pdi-group" ${gIdx === 0 ? 'open' : ''} data-pdi-group>
                    <summary class="pdi-group-header">
                      <span>${esc(group.title)}</span>
                      <span class="pdi-group-actions">
                        <button type="button" class="btn btn-outline btn-sm" data-mark-group="${startIdx}:${group.items.length}">Marcar grupo (8)</button>
                      </span>
                    </summary>
                    <div class="pdi-checklist" style="margin:12px 0 4px">
                      ${itemsHtml}
                    </div>
                  </details>`;
              }).join('')}
            </div>

            <div class="form-group" style="margin-top:16px">
              <label for="notes-${order.id}">Notas técnicas de almacén (opcional)</label>
              <textarea id="notes-${order.id}" data-notes rows="2" placeholder="Observaciones de inspección, torque, accesorios instalados...">${esc(order.notas_almacen || '')}</textarea>
            </div>

            <div class="panel-actions" style="margin-top:20px">
              <button type="button" class="btn btn-secondary" data-action="guardar-pdi" data-id="${order.id}">
                ${icon('clipboard', 15)} <span>Guardar progreso PDI</span>
              </button>
              <button type="button" class="btn btn-primary" data-action="preparar-empaque" data-id="${order.id}" ${completedCount < TOTAL_PDI_POINTS ? 'disabled' : ''}>
                ${icon('package', 15)} <span>Registrar empaque y pasar a despacho</span>
              </button>
            </div>
          </article>`;
      }).join('') : emptyBlock('wrench', 'No hay pedidos pendientes de empaque', 'Los pedidos con pago verificado aparecerán aquí automáticamente.')}
    `;

    bindRefresh();
    bindWarehouseActions();
  }

  function bindWarehouseActions() {
    function syncCardProgress(card) {
      const checks = [...card.querySelectorAll('[data-pdi]')];
      const done = checks.filter(c => c.checked).length;
      const pct = Math.round((done / TOTAL_PDI_POINTS) * 100);
      const counter = card.querySelector('[data-pdi-counter]');
      const fill = card.querySelector('[data-pdi-fill]');
      const badge = card.querySelector(`[data-pdi-badge="${card.dataset.order}"]`);
      const finishBtn = card.querySelector('[data-action="preparar-empaque"]');
      if (counter) counter.textContent = `${done} / ${TOTAL_PDI_POINTS} verificados`;
      if (fill) fill.style.width = `${pct}%`;
      if (badge) badge.textContent = `${done} / ${TOTAL_PDI_POINTS} PDI`;
      if (finishBtn) finishBtn.disabled = done < TOTAL_PDI_POINTS;
    }

    content.querySelectorAll('[data-order]').forEach(card => {
      card.querySelector('[data-gen-vin]')?.addEventListener('click', () => {
        card.querySelector('[data-vin]').value = genVIN();
      });
      card.querySelector('[data-gen-pkg]')?.addEventListener('click', () => {
        card.querySelector('[data-pkg]').value = genPKG();
      });
      card.querySelectorAll('[data-pdi]').forEach(cb => {
        cb.addEventListener('change', () => syncCardProgress(card));
      });
      card.querySelectorAll('[data-mark-group]').forEach(btn => {
        btn.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          const groupEl = btn.closest('[data-pdi-group]');
          if (!groupEl) return;
          groupEl.open = true;
          const checkboxes = [...groupEl.querySelectorAll('[data-pdi]')];
          const allChecked = checkboxes.every(c => c.checked);
          checkboxes.forEach(c => {
            c.checked = !allChecked;
          });
          syncCardProgress(card);
        });
      });
    });

    content.querySelectorAll('[data-action="guardar-pdi"]').forEach(button => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-order]');
        const vin = card.querySelector('[data-vin]').value.trim().toUpperCase();
        const pkg = card.querySelector('[data-pkg]').value.trim().toUpperCase();
        const checks = [...card.querySelectorAll('[data-pdi]')].map(c => c.checked);
        const notes = card.querySelector('[data-notes]').value.trim();

        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.textContent = 'Guardando...';
        try {
          await api(`/pedidos/${button.dataset.id}/iniciar-pdi`, {
            method: 'PATCH',
            body: {
              vin_asignado: vin || null,
              codigo_empaque: pkg || null,
              checklist_pdi: checks,
              notas_almacen: notes || null,
            },
          });
          toast(`Progreso PDI guardado (${checks.filter(Boolean).length}/${TOTAL_PDI_POINTS})`, 'success');
          await reload();
          render();
        } catch (error) {
          toast(error.message, 'danger');
          button.disabled = false;
          button.innerHTML = originalHtml;
        }
      });
    });

    content.querySelectorAll('[data-action="preparar-empaque"]').forEach(button => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-order]');
        const originalHtml = button.innerHTML;
        const vin = card.querySelector('[data-vin]').value.trim().toUpperCase();
        const pkg = card.querySelector('[data-pkg]').value.trim().toUpperCase();
        const checks = [...card.querySelectorAll('[data-pdi]')];
        const notes = card.querySelector('[data-notes]').value.trim();

        if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) {
          toast('El VIN debe tener 11 a 17 caracteres alfanuméricos válidos (sin I, O, Q).', 'warning');
          return;
        }
        if (!/^PKG-[A-Z0-9-]{4,24}$/.test(pkg)) {
          toast('El código de empaque debe iniciar con PKG- (ej. PKG-2026-101).', 'warning');
          return;
        }
        if (checks.length !== TOTAL_PDI_POINTS || checks.some(check => !check.checked)) {
          toast(`Debes completar los ${TOTAL_PDI_POINTS} puntos del checklist PDI`, 'warning');
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
            },
          });
          toast('Empaque registrado · Pedido listo para despacho', 'success');
          await reload();
          render();
        } catch (error) {
          toast(error.message, 'danger');
          button.disabled = false;
          button.innerHTML = originalHtml;
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
          <div class="panel-card-title">Despacho y entrega certificada</div>
          <span class="text-muted" style="font-size:0.82rem">
            ${ready.length} por despachar · ${enRoute.length} en ruta
          </span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-refresh>${icon('refresh', 14)} <span>Actualizar</span></button>
      </div>

      <h2 style="font-size:1.05rem;margin-top:8px">Listos para despacho</h2>
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
            <div><label>PDI completado</label><span class="value mono">${Number(order.pdi_completados || 40)}/${Number(order.pdi_total_puntos || 40)} pts</span></div>
            <div><label>Responsable empaque</label><span class="value">${esc(order.responsable_empaque || '—')}</span></div>
            <div><label>Dirección de entrega</label><span class="value">${esc(order.direccion_entrega || '—')}</span></div>
            <div><label>Teléfono</label><span class="value">${esc(order.cliente_telefono || '—')}</span></div>
          </div>

          ${itemsMarkup(order)}

          <div class="panel-actions" style="margin-top:20px">
            <button type="button" class="btn btn-primary" data-action="en-ruta" data-id="${order.id}">
              ${icon('truck', 15)} <span>Marcar en ruta de entrega</span>
            </button>
          </div>
        </article>
      `).join('') : emptyBlock('package', 'No hay pedidos listos para despacho', 'Los pedidos empacados aparecerán en esta sección.')}

      <h2 style="font-size:1.05rem;margin-top:24px">En ruta · confirmar entrega</h2>
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
              <button type="button" class="btn btn-secondary btn-sm" data-clear-sign>${icon('x', 13)} <span>Limpiar firma</span></button>
            </div>
          </div>

          <div class="pdi-item" style="margin-top:8px">
            <input id="conformity-${order.id}" type="checkbox" data-conformidad />
            <label for="conformity-${order.id}">El receptor confirma la conformidad del vehículo y recibió 2 llaves, manual y documentación.</label>
          </div>

          <div class="panel-actions" style="margin-top:20px">
            <button type="button" class="btn btn-success" data-action="entregar" data-id="${order.id}">
              ${icon('award', 15)} <span>Confirmar entrega y certificar</span>
            </button>
          </div>
        </article>
      `).join('') : emptyBlock('truck', 'No hay entregas en ruta', 'Marca un pedido empacado como “en ruta” para habilitar la firma de entrega.')}
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
        const originalHtml = button.innerHTML;
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
          button.innerHTML = originalHtml;
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
        const originalHtml = button.innerHTML;

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
              conformidad: true,
              firma_entrega_base64: canvas.toDataURL('image/png'),
            },
          });
          toast('Entrega certificada · Pedido finalizado', 'success');
          await reload();
          render();
        } catch (error) {
          toast(error.message, 'danger');
          button.disabled = false;
          button.innerHTML = originalHtml;
        }
      });
    });
  }

  /* ---------- Inventario ---------- */
  function renderStock() {
    const totalUnits = products.reduce((sum, product) => sum + Number(product.stock_disponible || 0), 0);
    const inventoryValue = products.reduce(
      (sum, product) => sum + Number(product.precio_usd || 0) * Number(product.stock_disponible || 0),
      0
    );

    content.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-label">Modelos activos</span>
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
          <div class="panel-card-title">Control de Inventario</div>
          <button type="button" class="btn btn-secondary btn-sm" data-refresh>${icon('refresh', 14)} <span>Actualizar</span></button>
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
        if (!Number.isInteger(delta) || delta === 0) {
          toast('Ingresa un número entero distinto de cero', 'warning');
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

  /* ---------- Catálogo y Papeles (No-Code Admin) ---------- */
  let editingProductId = null;

  function renderCatalogoAdmin() {
    const editing = editingProductId
      ? products.find(p => Number(p.id) === Number(editingProductId)) || null
      : null;

    const previewBs = editing ? Math.round(Number(editing.precio_usd || 0) * BS_RATE) : '';

    content.innerHTML = `
      <div class="panel-toolbar">
        <div>
          <div class="panel-card-title">${editing ? `Editando: ${esc(editing.nombre)}` : 'Agregar Nueva Motocicleta al Catálogo'}</div>
          <span class="text-muted" style="font-size:0.82rem">Sube imagen, especificaciones y documento oficial de papeles sin tocar código</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${editing ? `<button type="button" class="btn btn-outline btn-sm" id="cat-cancel-edit">${icon('x', 14)} <span>Cancelar edición</span></button>` : ''}
          <button type="button" class="btn btn-secondary btn-sm" data-refresh>${icon('refresh', 14)} <span>Actualizar</span></button>
        </div>
      </div>

      <form id="admin-product-form" class="panel-card" enctype="multipart/form-data">
        <div class="form-grid">
          <div class="form-group">
            <label for="prod-nombre">Nombre del modelo *</label>
            <input id="prod-nombre" name="nombre" type="text" required value="${esc(editing?.nombre || '')}" placeholder="Ej. Yamaha MT-07 ABS" />
          </div>
          <div class="form-group">
            <label for="prod-marca">Marca *</label>
            <input id="prod-marca" name="marca" type="text" required value="${esc(editing?.marca || '')}" placeholder="Ej. Yamaha, Honda, KTM, Bajaj..." />
          </div>
          <div class="form-group">
            <label for="prod-categoria">Categoría *</label>
            <select id="prod-categoria" name="categoria" required>
              ${PRODUCT_CATEGORIES.map(cat => `<option value="${esc(cat)}" ${editing?.categoria === cat ? 'selected' : ''}>${esc(cat)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="prod-anio">Año modelo *</label>
            <input id="prod-anio" name="anio" type="number" min="2015" max="2030" required value="${esc(editing?.anio || 2026)}" />
          </div>
          <div class="form-group">
            <label for="prod-precio">Precio base (USD) * <small id="prod-bs-preview" class="mono text-muted" style="text-transform:none">${previewBs ? `≈ Bs ${Number(previewBs).toLocaleString('en-US')}` : ''}</small></label>
            <input id="prod-precio" name="precio_usd" type="number" step="0.01" min="1" required value="${esc(editing?.precio_usd || '')}" placeholder="Ej. 3500" />
          </div>
          <div class="form-group">
            <label for="prod-stock">Stock inicial / disponible *</label>
            <input id="prod-stock" name="stock_disponible" type="number" min="0" step="1" required value="${esc(editing ? editing.stock_disponible : 3)}" />
          </div>
          <div class="form-group">
            <label for="prod-cc">Cilindrada (cc)</label>
            <input id="prod-cc" name="cilindrada_cc" type="number" min="0" value="${esc(editing?.cilindrada_cc || '')}" placeholder="Ej. 250" />
          </div>
          <div class="form-group">
            <label for="prod-hp">Potencia</label>
            <input id="prod-hp" name="potencia_hp" type="text" value="${esc(editing?.potencia_hp || '')}" placeholder="Ej. 30 HP" />
          </div>
          <div class="form-group">
            <label for="prod-torque">Torque</label>
            <input id="prod-torque" name="torque_nm" type="text" value="${esc(editing?.torque_nm || '')}" placeholder="Ej. 24 Nm" />
          </div>
          <div class="form-group">
            <label for="prod-trans">Transmisión</label>
            <input id="prod-trans" name="transmision" type="text" value="${esc(editing?.transmision || '')}" placeholder="Ej. 6 velocidades" />
          </div>
          <div class="form-group">
            <label for="prod-peso">Peso (kg)</label>
            <input id="prod-peso" name="peso_kg" type="number" step="0.1" value="${esc(editing?.peso_kg || '')}" placeholder="Ej. 162" />
          </div>
          <div class="form-group">
            <label for="prod-tanque">Tanque (Litros)</label>
            <input id="prod-tanque" name="tanque_litros" type="number" step="0.1" value="${esc(editing?.tanque_litros || '')}" placeholder="Ej. 13.5" />
          </div>
          <div class="form-group">
            <label for="prod-consumo">Consumo referencial</label>
            <input id="prod-consumo" name="consumo_kml" type="text" value="${esc(editing?.consumo_kml || '')}" placeholder="Ej. 35 km/L" />
          </div>
          <div class="form-group">
            <label for="prod-vel">Velocidad máxima</label>
            <input id="prod-vel" name="velocidad_max" type="text" value="${esc(editing?.velocidad_max || '')}" placeholder="Ej. 145 km/h" />
          </div>
          <div class="form-group">
            <label for="prod-frenos">Frenos</label>
            <input id="prod-frenos" name="frenos" type="text" value="${esc(editing?.frenos || '')}" placeholder="Ej. Disco delantero ABS, disco trasero" />
          </div>
          <div class="form-group">
            <label for="prod-susp">Suspensión</label>
            <input id="prod-susp" name="suspension" type="text" value="${esc(editing?.suspension || '')}" placeholder="Ej. Horquilla invertida / Monoamortiguador" />
          </div>
          <div class="form-group full">
            <label for="prod-elec">Electrónica y asistencias</label>
            <input id="prod-elec" name="electronica" type="text" value="${esc(editing?.electronica || '')}" placeholder="Ej. Inyección electrónica, ABS doble canal, tablero TFT" />
          </div>
          <div class="form-group full">
            <label for="prod-desc">Descripción comercial</label>
            <textarea id="prod-desc" name="descripcion" rows="2" placeholder="Ventajas clave, tipo de ruta recomendada y respaldo en Bolivia...">${esc(editing?.descripcion || '')}</textarea>
          </div>
          <div class="form-group full">
            <label for="prod-homolog">Notas de papeles oficiales y homologación (opcional)</label>
            <input id="prod-homolog" name="homologacion_notas" type="text" value="${esc(editing?.homologacion_notas || '')}" placeholder="Ej. Incluye Póliza DUA Aduana Nacional, Factura, carpeta RUAT y SOAT 2026" />
          </div>
          <div class="form-group">
            <label for="prod-img">Foto de la motocicleta (JPG, PNG, WEBP)</label>
            <input id="prod-img" name="imagen" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" />
            <small class="text-muted">${editing ? 'Opcional al editar: conserva la foto actual si no subes una nueva.' : 'Si no subes foto se usará imagen estándar.'}</small>
          </div>
          <div class="form-group">
            <label for="prod-doc">Documento oficial de papeles (PDF o imagen)</label>
            <input id="prod-doc" name="documento_papeles" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" />
            <small class="text-muted">${editing?.documento_papeles_nombre ? `Actual: ${esc(editing.documento_papeles_nombre)}` : 'Opcional: adjunta ficha/homologación oficial adicional al PDF automático.'}</small>
          </div>
        </div>

        <div class="pdi-item" style="margin-top:14px">
          <input id="prod-destacado" name="destacado" type="checkbox" ${editing?.destacado ? 'checked' : ''} />
          <label for="prod-destacado">Destacar este modelo en la página principal</label>
        </div>

        <div class="panel-actions" style="margin-top:20px">
          <button type="submit" class="btn btn-primary" id="admin-prod-submit">
            ${icon(editing ? 'check' : 'plus', 16)}
            <span>${editing ? 'Guardar cambios del modelo' : 'Publicar motocicleta en catálogo'}</span>
          </button>
        </div>
      </form>

      <div class="panel-card">
        <div class="panel-card-header">
          <div class="panel-card-title">Modelos registrados (${products.length}) y Papeles Oficiales</div>
        </div>
        <div style="overflow-x:auto">
          <table class="inventory-table">
            <thead>
              <tr>
                <th>Modelo</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Papeles PDF</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => {
                const thumb = productImages(p)[0] || '/images/productos/placeholder.svg';
                return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        <img src="${esc(thumb)}" alt="${esc(p.nombre)}" style="width:48px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color)" onerror="this.src='/images/productos/placeholder.svg'" />
                        <div>
                          <div style="font-weight:600">${esc(p.nombre)}</div>
                          <div class="text-muted mono" style="font-size:0.72rem">${esc(p.marca)} · ${p.anio}</div>
                        </div>
                      </div>
                    </td>
                    <td class="text-secondary">${esc(p.categoria)}</td>
                    <td class="mono">${fmtBs(p.precio_usd)}</td>
                    <td>${stockPill(p.stock_disponible)}</td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button type="button" class="btn btn-outline btn-sm" data-admin-pdf="${esc(p.slug)}">
                          ${icon('download', 13)} <span>PDF</span>
                        </button>
                        ${p.documento_papeles_url ? `<a href="/api/productos/${encodeURIComponent(p.slug)}/documento-oficial" class="btn btn-secondary btn-sm" download>${icon('file', 13)} <span>Adjunto</span></a>` : ''}
                      </div>
                    </td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button type="button" class="btn btn-secondary btn-sm" data-admin-edit="${p.id}">
                          ${icon('edit', 13)} <span>Editar</span>
                        </button>
                        ${['ALMACEN_EMPAQUE', 'ADMIN'].includes(user.rol) ? `
                          <button type="button" class="btn btn-danger btn-sm" data-admin-delete="${p.id}" data-name="${esc(p.nombre)}">
                            ${icon('trash', 13)} <span>Eliminar</span>
                          </button>` : ''}
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindRefresh();

    const priceInput = content.querySelector('#prod-precio');
    const bsPreview = content.querySelector('#prod-bs-preview');
    priceInput?.addEventListener('input', () => {
      const val = Number(priceInput.value);
      if (bsPreview) {
        bsPreview.textContent = Number.isFinite(val) && val > 0 ? `≈ Bs ${Math.round(val * BS_RATE).toLocaleString('en-US')}` : '';
      }
    });

    content.querySelector('#cat-cancel-edit')?.addEventListener('click', () => {
      editingProductId = null;
      renderCatalogoAdmin();
    });

    content.querySelectorAll('[data-admin-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        editingProductId = Number(btn.dataset.adminEdit);
        renderCatalogoAdmin();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    content.querySelectorAll('[data-admin-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.adminDelete);
        const nombre = btn.dataset.name || 'este modelo';
        const confirmed = await openDecisionModal({
          title: `Eliminar · ${nombre}`,
          bodyHtml: `<p>¿Seguro que deseas eliminar <strong>${esc(nombre)}</strong> del catálogo? Esta acción lo quitará de la tienda. Si el modelo ya tiene pedidos registrados, el sistema lo protegerá automáticamente y podrás dejar su stock en 0.</p>`,
          confirmLabel: 'Sí, eliminar del catálogo',
          confirmClass: 'btn-danger',
        });
        if (!confirmed) return;

        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await api(`/productos/${id}`, { method: 'DELETE' });
          if (editingProductId === id) editingProductId = null;
          toast(`Producto eliminado: ${nombre}`, 'success');
          await reload();
          render();
        } catch (err) {
          toast(err.message, 'danger');
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });

    content.querySelectorAll('[data-admin-pdf]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.dataset.adminPdf;
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await downloadPdfBlob(`/api/productos/${encodeURIComponent(slug)}/papeles-pdf`, `MotoConnect-Papeles-${slug}.pdf`);
          toast('PDF oficial de papeles generado', 'success');
        } catch (err) {
          toast(err.message, 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });

    const form = content.querySelector('#admin-product-form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const submitBtn = form.querySelector('#admin-prod-submit');
      const formData = new FormData(form);
      formData.set('destacado', form.querySelector('#prod-destacado')?.checked ? '1' : '0');

      const imgInput = form.querySelector('#prod-img');
      if (!imgInput?.files?.length) formData.delete('imagen');
      const docInput = form.querySelector('#prod-doc');
      if (!docInput?.files?.length) formData.delete('documento_papeles');

      const origHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.textContent = editing ? 'Guardando cambios...' : 'Publicando...';
      try {
        if (editing) {
          await api(`/productos/${editing.id}`, { method: 'PUT', body: formData });
          toast(`Modelo actualizado: ${formData.get('nombre')}`, 'success');
          editingProductId = null;
        } else {
          await api('/productos', { method: 'POST', body: formData });
          toast(`Motocicleta publicada en catálogo: ${formData.get('nombre')}`, 'success');
        }
        await reload();
        render();
      } catch (err) {
        toast(err.message, 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    });
  }

  function bindRefresh() {
    content.querySelectorAll('[data-refresh]').forEach(button => {
      button.addEventListener('click', async () => {
        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.textContent = 'Actualizando...';
        try {
          await reload();
          render();
        } catch (error) {
          toast(error.message, 'danger');
          button.disabled = false;
          button.innerHTML = originalHtml;
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
    else if (currentTab === 'catalogo') renderCatalogoAdmin();
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
        <span class="empty-icon">${icon('alert', 44)}</span>
        <h3>No se pudo cargar el panel</h3>
        <p>${esc(error.message)}</p>
      </div>`;
  }
}
