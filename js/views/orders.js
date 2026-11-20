/* ============================================================
   MotoConnect — views/orders.js (#/mis-pedidos)
   Historial, línea de tiempo y certificado digital imprimible en modal
   ============================================================ */

import { api } from '../api.js';
import { state } from '../state.js';
import { METHOD_LABELS, LOGISTIC_LABELS } from '../config.js';
import { fmt, fmtBs, esc, toast, statusBadge, icon, fetchProtectedReceipt, downloadPdfBlob } from '../utils.js';

const TIMELINE_STEPS = [
  { icon: 'credit-card', label: 'Pago verificado' },
  { icon: 'wrench', label: 'Preparación PDI' },
  { icon: 'package', label: 'Empacado' },
  { icon: 'truck', label: 'En ruta' },
  { icon: 'check', label: 'Entregado' },
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

        const dotIcon = className === 'done'
          ? icon('check', 16)
          : className === 'rejected'
          ? icon('x', 16)
          : icon(step.icon, 16);

        return `
          <div class="timeline-step ${className}">
            <div class="timeline-dot">${dotIcon}</div>
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
  const pdiDone = Number(order.pdi_completados || 0);
  const pdiTotal = Number(order.pdi_total_puntos || 40);

  return `
    <article class="order-card">
      <div class="order-card-header">
        <div>
          <div class="order-code">${esc(order.codigo_orden || order.codigo || '')}</div>
          <div class="order-date" style="display:flex;align-items:center;gap:6px;margin-top:4px">
            ${icon('clock', 13)}
            <span>${formatDate(order.fecha_creacion)}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div class="order-total">${fmtBs(order.total_usd)} <span class="text-muted" style="font-size:0.75rem;font-weight:400">(≈ $${fmt(order.total_usd)} USD)</span></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            ${statusBadge(order.estado_pago)}
            ${statusBadge(order.estado_logistico)}
          </div>
        </div>
      </div>

      ${rejected && order.motivo_rechazo ? `
        <div class="alert alert-danger" style="margin-bottom:16px">
          ${icon('x-circle', 18)}
          <span><strong>Pago rechazado:</strong> ${esc(order.motivo_rechazo)}</span>
        </div>` : ''}

      ${timeline(order)}

      <div class="order-items">${itemsMarkup(items)}</div>

      <div class="order-detail-grid">
        <div><label>Método de pago</label><span class="value">${esc(METHOD_LABELS[order.metodo_pago] || order.metodo_pago || '—')}</span></div>
        <div><label>Referencia</label><span class="value mono">${detailValue(order.referencia_pago)}</span></div>
        <div><label>Ciudad</label><span class="value">${detailValue(order.ciudad)}</span></div>
        <div><label>Dirección</label><span class="value">${detailValue(order.direccion_entrega)}</span></div>
        <div><label>Inspección PDI</label><span class="value mono">${order.estado_pago === 'VERIFICADO' ? `${pdiDone}/${pdiTotal} puntos` : 'Pendiente de pago'}</span></div>
        <div><label>Estado logístico</label><span class="value">${esc(LOGISTIC_LABELS[order.estado_logistico] || order.estado_logistico || '—')}</span></div>
      </div>

      ${delivered ? `
        <div class="alert alert-success" style="align-items:flex-start;margin-top:8px">
          ${icon('award', 20)}
          <div>
            <strong>Entrega certificada</strong><br />
            VIN: <span class="mono">${detailValue(order.vin_asignado)}</span> ·
            Empaque: <span class="mono">${detailValue(order.codigo_empaque)}</span><br />
            Receptor: ${detailValue(order.receptor_nombre)} · CI ${detailValue(order.receptor_ci)} ·
            ${formatDate(order.fecha_entrega)}
          </div>
        </div>
        <div class="panel-actions" style="margin-top:16px">
          <button type="button" class="btn btn-primary" data-cert="${order.id}">
            ${icon('printer', 16)}
            <span>Ver Certificado Digital de Entrega</span>
          </button>
        </div>` : ''}

      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button type="button" class="btn btn-outline btn-sm" data-order-pdf="${order.id}" data-order-code="${esc(order.codigo_orden || '')}">
          ${icon('download', 14)}
          <span>Descargar Papeles Oficiales (PDF)</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-email-pdf="${order.id}">
          ${icon('mail', 14)}
          <span>Enviar PDF a mi correo</span>
        </button>
        ${order.comprobante_url ? `
          <button type="button" class="btn btn-outline btn-sm" data-receipt="${order.id}">
            ${icon('file', 14)}
            <span>Ver comprobante de pago adjunto</span>
          </button>` : ''}
      </div>
      <div data-email-feedback="${order.id}" style="margin-top:10px"></div>
    </article>`;
}

async function openReceiptModal(order) {
  const container = document.querySelector('#modals-container');
  if (!container || !order.comprobante_url) return;

  let blobUrl = null;
  const close = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    container.innerHTML = '';
  };

  container.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <section class="modal-box" role="dialog" aria-modal="true" aria-label="Comprobante de pago" style="max-width:720px">
        <div class="modal-header">
          <h2 class="modal-title">Comprobante · ${esc(order.codigo_orden || '')}</h2>
          <button type="button" class="modal-close" aria-label="Cerrar" data-modal-close>${icon('x', 16)}</button>
        </div>
        <div id="receipt-body" class="spinner-wrap" style="padding:36px"><div class="spinner"></div></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>
        </div>
      </section>
    </div>`;

  container.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', close));
  container.querySelector('[data-modal-overlay]')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) close();
  });

  const body = container.querySelector('#receipt-body');
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
}

function openCertificateModal(order) {
  const container = document.querySelector('#modals-container');
  if (!container) return;

  const items = parseItems(order);
  const signature = order.firma_entrega_base64
    ? `<img class="cert-sig-img" src="${esc(order.firma_entrega_base64)}" alt="Firma digital del receptor" />`
    : '<span>Sin firma registrada</span>';

  container.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <section class="modal-box certificate-modal-box" role="dialog" aria-modal="true" aria-label="Certificado Digital de Entrega" style="max-width:860px;background:#fff;color:#111">
        <div class="modal-header" style="border-bottom:1px solid #e5e7eb;padding-bottom:16px;margin-bottom:20px">
          <h2 class="modal-title" style="color:#111">Certificado Digital de Entrega y Garantía</h2>
          <button type="button" class="modal-close" aria-label="Cerrar certificado" data-modal-close style="background:#f3f4f6;border-color:#d1d5db;color:#111">
            ${icon('x', 16)}
          </button>
        </div>

        <div class="certificate" style="padding:12px 8px">
          <div class="certificate-header">
            <div class="certificate-logo">MOTO<span>CONNECT</span></div>
            <div class="certificate-title">Acta Oficial de Entrega y Garantía de Fábrica</div>
          </div>

          <div class="certificate-section">
            <h4>Datos de la orden</h4>
            <div class="certificate-grid">
              <div class="certificate-field"><label>Código de orden</label><strong class="mono">${esc(order.codigo_orden || '')}</strong></div>
              <div class="certificate-field"><label>Fecha de pedido</label>${formatDate(order.fecha_creacion)}</div>
              <div class="certificate-field"><label>Cliente</label>${esc(order.cliente_nombre || '')}</div>
              <div class="certificate-field"><label>CI / NIT</label>${esc(order.cliente_ci || '')}</div>
              <div class="certificate-field"><label>Correo electrónico</label>${esc(order.cliente_email || '')}</div>
              <div class="certificate-field"><label>Teléfono</label>${esc(order.cliente_telefono || '')}</div>
              <div class="certificate-field"><label>Ciudad</label>${esc(order.ciudad || '')}</div>
              <div class="certificate-field"><label>Dirección de entrega</label>${esc(order.direccion_entrega || '')}</div>
            </div>
          </div>

          <div class="certificate-section">
            <h4>Vehículo y verificación PDI</h4>
            <div class="certificate-grid">
              <div class="certificate-field"><label>VIN / Chasis asignado</label><strong class="mono">${esc(order.vin_asignado || '—')}</strong></div>
              <div class="certificate-field"><label>Código de empaque</label><span class="mono">${esc(order.codigo_empaque || '—')}</span></div>
              <div class="certificate-field"><label>Checklist PDI completado</label>${Number(order.pdi_completados || 40)} / ${Number(order.pdi_total_puntos || 40)} puntos</div>
              <div class="certificate-field"><label>Responsable de empaque</label>${esc(order.responsable_empaque || '—')}</div>
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
                  <th style="text-align:right;padding:8px;border:1px solid #eee">Precio Unit.</th>
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
            <div style="text-align:right;margin-top:12px;font-weight:700">
              Total verificado: ${fmtBs(order.total_usd)} (≈ $${fmt(order.total_usd)} USD)
            </div>
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
        </div>

        <div class="modal-actions" style="border-top-color:#e5e7eb">
          <button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>
          <button type="button" id="cert-print-btn" class="btn btn-primary">${icon('printer', 16)} <span>Imprimir / Guardar PDF</span></button>
        </div>
      </section>
    </div>`;

  const close = () => {
    container.innerHTML = '';
  };
  container.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', close));
  container.querySelector('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) close();
  });
  container.querySelector('#cert-print-btn')?.addEventListener('click', () => window.print());
}

export async function orders(root) {
  if (!state.user) {
    root.innerHTML = `
      <section class="section">
        <div class="login-prompt">
          <div style="display:flex;justify-content:center;color:var(--accent-primary);margin-bottom:16px">${icon('lock', 48)}</div>
          <h2>Inicia sesión para consultar tus pedidos</h2>
          <p>Accede con tu cuenta para ver el estado de tus compras, inspección PDI y certificados digitales de entrega.</p>
          <a href="#/login" class="btn btn-primary">Iniciar Sesión</a>
        </div>
      </section>`;
    return;
  }

  root.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Mis Pedidos</h1>
        <p>Seguimiento de compras, verificación de pago, inspección PDI y entrega certificada</p>
      </div>
    </div>
    <div class="section">
      <div class="panel-toolbar">
        <span class="text-muted" id="orders-count">Cargando pedidos...</span>
        <button type="button" class="btn btn-secondary btn-sm" id="orders-refresh">${icon('refresh', 14)} <span>Actualizar</span></button>
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
      const rows = await api('/pedidos');
      state.orders = rows;
      counter.textContent = `${rows.length} pedido${rows.length === 1 ? '' : 's'} registrado${rows.length === 1 ? '' : 's'}`;

      if (!rows.length) {
        list.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">${icon('package', 48)}</span>
            <h3>Aún no tienes pedidos</h3>
            <p>Explora el catálogo y registra tu primera compra.</p>
            <a href="#/catalogo" class="btn btn-primary">Ir al Catálogo</a>
          </div>`;
        return;
      }

      list.innerHTML = rows.map(orderMarkup).join('');
      list.querySelectorAll('[data-cert]').forEach(button => {
        button.addEventListener('click', () => {
          const order = rows.find(row => Number(row.id) === Number(button.dataset.cert));
          if (order) openCertificateModal(order);
        });
      });
      list.querySelectorAll('[data-receipt]').forEach(button => {
        button.addEventListener('click', () => {
          const order = rows.find(row => Number(row.id) === Number(button.dataset.receipt));
          if (order) openReceiptModal(order);
        });
      });
      list.querySelectorAll('[data-order-pdf]').forEach(button => {
        button.addEventListener('click', async () => {
          const id = button.dataset.orderPdf;
          const code = button.dataset.orderCode || id;
          const orig = button.innerHTML;
          button.disabled = true;
          button.textContent = 'Generando PDF...';
          try {
            await downloadPdfBlob(`/api/pedidos/${id}/documentos-pdf`, `MotoConnect-Papeles-${code}.pdf`, state.token);
            toast('Documentación oficial en PDF descargada', 'success');
          } catch (err) {
            toast(err.message, 'danger');
          } finally {
            button.disabled = false;
            button.innerHTML = orig;
          }
        });
      });
      list.querySelectorAll('[data-email-pdf]').forEach(button => {
        button.addEventListener('click', async () => {
          const id = button.dataset.emailPdf;
          const feedback = list.querySelector(`[data-email-feedback="${id}"]`);
          const orig = button.innerHTML;
          button.disabled = true;
          button.textContent = 'Enviando...';
          try {
            const res = await api(`/pedidos/${id}/enviar-documentos`, { method: 'POST', body: {} });
            if (res.sent) {
              toast(res.message, 'success');
              if (feedback) {
                feedback.innerHTML = `<div class="alert alert-success" style="font-size:0.82rem;padding:10px 12px">${icon('check-circle', 15)}<span>${esc(res.message)}</span></div>`;
              }
            } else {
              toast('PDF listo para descargar (SMTP pendiente en servidor)', 'info');
              const mailto = `mailto:${encodeURIComponent(res.recipient || '')}?subject=${encodeURIComponent(res.mailtoSubject || '')}&body=${encodeURIComponent(res.mailtoBody || '')}`;
              if (feedback) {
                feedback.innerHTML = `
                  <div class="alert alert-info" style="font-size:0.82rem;padding:10px 12px;flex-direction:column;align-items:flex-start;gap:6px">
                    <span>${esc(res.message)}</span>
                    <a href="${esc(mailto)}" class="btn btn-outline btn-sm">${icon('mail', 13)} <span>Abrir correo hacia ${esc(res.recipient || '')}</span></a>
                  </div>`;
              }
            }
          } catch (err) {
            toast(err.message, 'danger');
          } finally {
            button.disabled = false;
            button.innerHTML = orig;
          }
        });
      });
    } catch (error) {
      counter.textContent = '';
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${icon('alert', 44)}</span>
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
