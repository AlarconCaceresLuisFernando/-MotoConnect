/* ============================================================
   MotoConnect — views/checkout.js (#/checkout)
   Finalización de compra: PayPal, Tarjeta (Visa/Mastercard) y Pago con QR
   ============================================================ */

import { api } from '../api.js';
import { state, clearCart } from '../state.js';
import { CITY_LIST } from '../config.js';
import { fmt, fmtBs, esc, toast, statusBadge, icon, downloadPdfBlob } from '../utils.js';
import { mountPayPal, mountCardPayment } from '../components/paypal.js';
import { refreshNav } from '../components/navbar.js';

function referenceCode() {
  return `MC-2026-${String(Date.now()).slice(-4)}`;
}

function paypalBrandLogo() {
  return `
    <span class="pay-brand-badges">
      <span class="pay-brand-pill" aria-hidden="true" style="padding:4px 10px">
        <svg width="76" height="20" viewBox="0 0 92 24" fill="none">
          <path d="M13.6 3.5H7.7c-.4 0-.8.3-.9.7L4.4 19.6c-.1.3.2.6.5.6h2.8c.4 0 .8-.3.9-.7l.6-4c.1-.4.4-.7.9-.7h2c4.2 0 6.6-2 7.2-6 .3-1.8 0-3.1-.8-4-.9-1-2.6-1.3-4.9-1.3zm.7 5.6c-.3 2.2-2 2.2-3.6 2.2h-.9l.7-4.1c0-.2.2-.4.5-.4h.4c1.1 0 2.1 0 2.7.6.3.4.4 1 .2 1.7z" fill="#003087"/>
          <path d="M22.2 8.7c-.3 2.1-2 3.3-4.6 3.3h-1.1l-.8 4.9c-.1.3-.3.5-.6.5h-2.1c-.3 0-.5-.3-.4-.6l2.3-14.2c.1-.4.4-.7.9-.7h4.2c1.7 0 2.8.5 3.4 1.4.4.7.5 1.7.2 2.9l-.4 2.5z" fill="#0070BA" opacity="0.9"/>
          <text x="27" y="16.8" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="800" font-size="13" fill="#003087">Pay</text>
          <text x="51" y="16.8" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="800" font-size="13" fill="#0079C1">Pal</text>
        </svg>
      </span>
    </span>`;
}

function cardBrandLogos() {
  return `
    <span class="pay-brand-badges">
      <span class="pay-brand-pill" aria-label="Visa">
        <svg width="42" height="16" viewBox="0 0 54 18" fill="none">
          <text x="3" y="14" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="800" font-style="italic" font-size="15" letter-spacing="0.5" fill="#1A1F71">VISA</text>
        </svg>
      </span>
      <span class="pay-brand-pill" aria-label="Mastercard" style="gap:4px">
        <svg width="26" height="16" viewBox="0 0 32 20" fill="none">
          <circle cx="12" cy="10" r="8" fill="#EB001B"/>
          <circle cx="20" cy="10" r="8" fill="#F79E1B" fill-opacity="0.9"/>
        </svg>
        <span style="font-size:10px;font-weight:800;color:#0F172A;letter-spacing:-0.02em">MC</span>
      </span>
    </span>`;
}

function qrBrandLogo() {
  return `
    <span class="pay-brand-badges">
      <span class="pay-brand-pill" aria-hidden="true" style="background:#0F172A;border-color:rgba(14,165,233,0.45);color:#38BDF8;padding:4px 10px;gap:6px">
        ${icon('qr', 18)}
        <span style="font-size:11px;font-weight:800;letter-spacing:0.04em;color:#F1F5F9">QR</span>
      </span>
    </span>`;
}

function summaryItem(item) {
  const image = item.imagen
    ? `<img class="summary-item-img" src="${esc(item.imagen)}" alt="${esc(item.nombre)}" onerror="this.src='/images/productos/placeholder.svg'" />`
    : `<div class="summary-item-img" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted)">${icon('package', 18)}</div>`;

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

function qrFormMarkup() {
  return `
    <form data-qr-form novalidate>
      <div class="form-grid">
        <div class="form-group full">
          <label for="ref-qr">Número de referencia u operación QR *</label>
          <input id="ref-qr" data-field="referencia" type="text" placeholder="Ej. QR-2026-00481" required />
        </div>
        <div class="form-group full">
          <label for="file-qr">Comprobante de pago por QR *</label>
          <input id="file-qr" data-field="comprobante" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" required />
          <small class="text-muted">JPG, PNG, WEBP o PDF · máximo 10 MB · almacenamiento privado protegido por rol</small>
        </div>
      </div>
      <button type="submit" class="btn btn-primary w-full" style="margin-top:16px">
        ${icon('check-circle', 16)}
        <span>Enviar comprobante QR a revisión</span>
      </button>
    </form>`;
}

function finishOrder(root, order, message) {
  clearCart();
  refreshNav();
  toast(message, 'success');
  const orderId = order.id;
  const orderCode = order.codigo_orden || order.codigo || '';
  root.innerHTML = `
    <section class="section">
      <div class="order-confirmation">
        <div class="confirmation-icon" style="color:var(--success);display:flex;justify-content:center">${icon('check-circle', 64)}</div>
        <h1 style="font-size:1.8rem;margin-bottom:8px">¡Pedido registrado!</h1>
        <p class="text-secondary">${esc(message)}</p>
        <div class="confirmation-code">${esc(orderCode)}</div>
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:12px 0 20px">
          ${statusBadge(order.estado_pago || 'EN_REVISION')}
          ${statusBadge(order.estado_logistico || 'ESPERANDO_PAGO')}
        </div>
        <div style="background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:12px;padding:16px;margin:0 auto 24px;max-width:540px;text-align:left">
          <div style="font-weight:700;font-size:0.92rem;margin-bottom:6px;display:flex;align-items:center;gap:8px">
            ${icon('file', 16)} <span>Papeles oficiales y carpeta de compra (PDF)</span>
          </div>
          <p class="text-muted" style="font-size:0.82rem;margin-bottom:12px;line-height:1.5">
            Descarga ahora tu expediente PDF con ficha técnica, Factura, DUA/Póliza de Importación, carpeta RUAT, SOAT y Garantía, o escribe el correo de destino para enviarlo:
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
            <input type="email" id="confirm-email-target" value="${esc(order.cliente_email || state.user?.email || '')}" placeholder="Correo destino (ej. cliente@gmail.com)" aria-label="Correo destino para enviar PDF" style="flex:1;min-width:210px;padding:8px 12px;font-size:0.85rem" />
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-outline btn-sm" id="confirm-download-pdf">
              ${icon('download', 14)} <span>Descargar Papeles PDF</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="confirm-email-pdf">
              ${icon('mail', 14)} <span>Enviar PDF por correo</span>
            </button>
          </div>
          <div id="confirm-email-status" style="margin-top:10px;font-size:0.8rem"></div>
        </div>
        <div class="panel-actions" style="justify-content:center">
          <a href="#/mis-pedidos" class="btn btn-primary">Ver Mis Pedidos</a>
          <a href="#/catalogo" class="btn btn-secondary">Seguir Explorando</a>
        </div>
      </div>
    </section>`;

  root.querySelector('#confirm-download-pdf')?.addEventListener('click', async event => {
    const btn = event.currentTarget;
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Generando PDF...';
    try {
      await downloadPdfBlob(
        `/api/pedidos/${orderId}/documentos-pdf`,
        `MotoConnect-Papeles-${orderCode}.pdf`,
        state.token
      );
      toast('Carpeta oficial en PDF descargada', 'success');
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  root.querySelector('#confirm-email-pdf')?.addEventListener('click', async event => {
    const btn = event.currentTarget;
    const statusBox = root.querySelector('#confirm-email-status');
    const targetInput = root.querySelector('#confirm-email-target');
    const targetEmail = targetInput?.value.trim() || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      toast('Ingresa un correo destino válido para enviar el PDF.', 'warning');
      targetInput?.focus();
      return;
    }
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Procesando envío...';
    try {
      const res = await api(`/pedidos/${orderId}/enviar-documentos`, {
        method: 'POST',
        body: { email: targetEmail },
      });
      if (res.sent) {
        toast(res.message, 'success');
        if (statusBox) {
          statusBox.innerHTML = `<div class="alert alert-success" style="padding:10px 12px">${icon('check-circle', 15)}<span>${esc(res.message)}</span></div>`;
        }
      } else {
        toast(
          res.smtpBlocked
            ? 'Servidor nube bloquea SMTP (puertos 465/587); usa BREVO_API_KEY o descarga el PDF'
            : 'PDF listo para descarga (SMTP pendiente en servidor)',
          'info'
        );
        const mailto = `mailto:${encodeURIComponent(res.recipient || '')}?subject=${encodeURIComponent(res.mailtoSubject || '')}&body=${encodeURIComponent(res.mailtoBody || '')}`;
        if (statusBox) {
          statusBox.innerHTML = `
            <div class="alert alert-info" style="padding:10px 12px;flex-direction:column;align-items:flex-start;gap:6px">
              <span>${esc(res.message)}</span>
              <a href="${esc(mailto)}" class="btn btn-outline btn-sm">${icon('mail', 13)} <span>Abrir en mi correo (${esc(res.recipient || '')})</span></a>
            </div>`;
        }
      }
    } catch (err) {
      toast(err.message, 'danger');
      if (statusBox) {
        statusBox.innerHTML = `<div class="alert alert-danger" style="padding:10px 12px">${esc(err.message)}</div>`;
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  window.scrollTo(0, 0);
}

export async function checkout(root) {
  if (!state.cart.length) {
    root.innerHTML = `
      <section class="section">
        <div class="empty-state" style="min-height:50vh">
          <span class="empty-icon">${icon('cart', 48)}</span>
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
          <div style="display:flex;justify-content:center;color:var(--accent-primary);margin-bottom:16px">${icon('lock', 48)}</div>
          <h2>Inicia sesión para finalizar tu compra</h2>
          <p>Necesitamos autenticar tu cuenta para calcular la orden, validar disponibilidad y emitir el certificado de entrega.</p>
          <div class="panel-actions" style="justify-content:center">
            <a href="#/login" class="btn btn-primary">Iniciar Sesión</a>
            <a href="#/catalogo" class="btn btn-secondary">Seguir Comprando</a>
          </div>
        </div>
      </section>`;
    return;
  }

  let payConfig = {
    paypal: { serverConfigured: false, hasSecret: false, hasClientId: false, clientId: null, mode: 'live' },
    bank: { configured: false, qrApiConfigured: false },
  };
  try {
    payConfig = await api('/payments/config');
  } catch {
    /* keep safe fallback */
  }

  const subtotal = state.cart.reduce(
    (sum, item) => sum + Number(item.precio_usd || 0) * Number(item.cantidad || 0),
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
        <h1>Finalizar Compra</h1>
        <p>Completa tus datos y elige tu método de pago · Referencia preliminar ${esc(reference)}</p>
      </div>
    </div>

    <div class="section">
      <div class="checkout-layout">
        <div>
          <section class="checkout-section">
            <h3>Datos del Comprador</h3>
            <div class="form-grid">
              ${buyerFields.map(field => `
                <div class="form-group ${field.full ? 'full' : ''}">
                  <label for="buyer-${field.name}">${field.label}</label>
                  <input id="buyer-${field.name}" name="${field.name}" type="${field.type || 'text'}"
                    value="${esc(field.value)}" placeholder="${esc(field.placeholder || '')}"
                    ${field.name === 'email' ? 'readonly title="El pedido quedará asociado a tu cuenta autenticada"' : ''} required />
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
            <h3>Método de Pago</h3>

            <div class="payment-tabs" role="tablist">
              <button type="button" class="payment-tab-btn active" data-payment-tab="paypal" role="tab" aria-selected="true">
                <span class="pay-icon">${paypalBrandLogo()}</span>
                <span>PayPal</span>
                <small style="font-weight:400;opacity:0.8">${payConfig.paypal?.serverConfigured ? 'Pago inmediato' : 'Pendiente ID cliente'}</small>
              </button>
              <button type="button" class="payment-tab-btn" data-payment-tab="tarjeta" role="tab" aria-selected="false">
                <span class="pay-icon">${cardBrandLogos()}</span>
                <span>Pago con Tarjeta</span>
                <small style="font-weight:400;opacity:0.8">Visa / Mastercard</small>
              </button>
              <button type="button" class="payment-tab-btn" data-payment-tab="qr" role="tab" aria-selected="false">
                <span class="pay-icon">${qrBrandLogo()}</span>
                <span>Pago con QR</span>
                <small style="font-weight:400;opacity:0.8">Revisión de comprobante</small>
              </button>
            </div>

            <div class="payment-panel active" id="panel-paypal" role="tabpanel">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
                <span class="text-secondary" style="font-size:0.86rem">Paga con tu cuenta PayPal de forma segura</span>
                ${paypalBrandLogo()}
              </div>
              <div id="paypal-button-container"></div>
              <p class="text-muted" style="font-size:0.8rem;text-align:center;margin-top:12px">
                Importe calculado por catálogo: $${fmt(total)} USD (equivalente a ${fmtBs(total)}).
              </p>
            </div>

            <div class="payment-panel" id="panel-tarjeta" role="tabpanel">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
                <span class="text-secondary" style="font-size:0.86rem">Tarjetas de débito o crédito aceptadas</span>
                ${cardBrandLogos()}
              </div>
              <div id="card-button-container"></div>
              <p class="text-muted" style="font-size:0.8rem;text-align:center;margin-top:12px">
                Procesamiento cifrado sin almacenar números de tarjeta en MotoConnect · Total: $${fmt(total)} USD (${fmtBs(total)}).
              </p>
            </div>

            <div class="payment-panel" id="panel-qr" role="tabpanel">
              <div class="qr-section">
                <div style="display:flex;align-items:center;gap:10px">
                  ${qrBrandLogo()}
                  <strong style="font-size:0.95rem">Código QR de Referencia de Orden</strong>
                </div>
                <div id="qrcode-bancario"></div>
                <div class="qr-info">
                  Monto: ${fmtBs(total)} (≈ $${fmt(total)} USD)<br />
                  Referencia: ${esc(reference)}
                </div>
                <small class="text-muted" style="text-align:center;max-width:440px;line-height:1.5">
                  Escanea o usa esta referencia para tu pago QR y adjunta el comprobante emitido por tu aplicación bancaria para validación de cobranzas.
                </small>
              </div>
              ${qrFormMarkup()}
            </div>
          </section>
        </div>

        <aside class="order-summary">
          <div class="checkout-section" style="margin-bottom:0">
            <h3>Resumen del Pedido</h3>
            <div class="summary-items">
              ${state.cart.map(summaryItem).join('')}
            </div>
            <div class="summary-totals">
              <div class="summary-row"><span>Subtotal</span><span class="mono">${fmtBs(subtotal)}</span></div>
              <div class="summary-row"><span>Impuestos y trámite (5%)</span><span class="mono">${fmtBs(impuestos)}</span></div>
              <div class="summary-row total"><span>Total Bs</span><span class="mono">${fmtBs(total)}</span></div>
              <div class="summary-row"><span>Referencia USD</span><span class="mono">$${fmt(total)} USD</span></div>
            </div>
            <div class="alert alert-success" style="margin-top:16px;font-size:0.78rem">
              ${icon('shield', 16)}
              <span>Precios y disponibilidad validados directamente en el servidor al registrar la orden.</span>
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

  function activatePaymentTab(tabName) {
    root.querySelectorAll('[data-payment-tab]').forEach(tab => {
      const selected = tab.dataset.paymentTab === tabName;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    root.querySelectorAll('.payment-panel').forEach(panel => panel.classList.remove('active'));
    root.querySelector(`#panel-${tabName}`)?.classList.add('active');
  }

  /* ---- Tabs de pago ---- */
  root.querySelectorAll('[data-payment-tab]').forEach(button => {
    button.addEventListener('click', () => {
      activatePaymentTab(button.dataset.paymentTab);
    });
  });

  /* ---- QR de referencia ---- */
  const qrContainer = root.querySelector('#qrcode-bancario');
  if (window.QRCode && qrContainer) {
    new window.QRCode(qrContainer, {
      text: `MotoConnect|REF:${reference}|USD:${total.toFixed(2)}|CLIENTE:${state.user.email}`,
      width: 170,
      height: 170,
      colorDark: '#090C10',
      colorLight: '#FFFFFF',
    });
  }

  /* ---- PayPal & Tarjeta (Visa / Mastercard) ---- */
  const switchToQr = () => activatePaymentTab('qr');

  mountPayPal(
    total,
    getBuyer,
    reference,
    payConfig.paypal,
    order => finishOrder(root, order, 'Pago PayPal verificado en el servidor. Tu pedido pasó a preparación técnica.'),
    switchToQr
  );

  mountCardPayment(
    total,
    getBuyer,
    reference,
    payConfig.paypal,
    order => finishOrder(root, order, 'Pago con tarjeta verificado en el servidor. Tu pedido pasó a preparación técnica.'),
    switchToQr
  );

  /* ---- Pago con QR (comprobante) ---- */
  const qrForm = root.querySelector('[data-qr-form]');
  qrForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = qrForm.querySelector('button[type="submit"]');
    const buyer = getBuyer();
    const referencia = qrForm.querySelector('[data-field="referencia"]').value.trim();
    const file = qrForm.querySelector('[data-field="comprobante"]').files[0];

    const missing = [];
    if (!buyer.nombre) missing.push('nombre');
    if (!buyer.email) missing.push('correo electrónico');
    if (!buyer.telefono) missing.push('teléfono');
    if (!buyer.ci) missing.push('CI / NIT');
    if (!buyer.ciudad) missing.push('ciudad');
    if (!buyer.direccion) missing.push('dirección');
    if (!referencia) missing.push('referencia QR');
    if (!file) missing.push('comprobante');

    if (missing.length) {
      toast(`Completa los campos requeridos: ${missing.join(', ')}`, 'warning');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast('El archivo supera el límite máximo de 10 MB.', 'warning');
      return;
    }

    const data = new FormData();
    data.append('tipo', 'qr');
    data.append('referencia_pago', referencia);
    data.append('comprobante', file);
    data.append('buyer', JSON.stringify(buyer));
    data.append('items', JSON.stringify(state.cart.map(i => ({
      productoId: i.productoId,
      cantidad: i.cantidad,
      color: i.color,
    }))));
    data.append('refCode', reference);

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Enviando comprobante...';
    try {
      const order = await api('/pedidos/bancario', { method: 'POST', body: data });
      finishOrder(root, order, 'Comprobante QR recibido. El pago queda en revisión por el área de cobranzas.');
    } catch (error) {
      toast(error.message, 'danger');
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  });
}
