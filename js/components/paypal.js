/* ============================================================
   MotoConnect — components/paypal.js
   Integración PayPal REST API v2 (PayPal + Tarjeta Débito/Crédito)
   ============================================================ */

import { api } from '../api.js';
import { state, clearCart } from '../state.js';
import { esc, fmt, fmtBs, toast, icon } from '../utils.js';

let loadedClientId = null;
let sdkPromise = null;
let sdkPromiseClientId = null;

function loadPayPalSdk(clientId) {
  if (window.paypal && loadedClientId === clientId) {
    return Promise.resolve(window.paypal);
  }
  if (sdkPromise && sdkPromiseClientId === clientId) {
    return sdkPromise;
  }
  sdkPromiseClientId = clientId;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-paypal-sdk]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&enable-funding=card&locale=es_ES`;
    script.dataset.paypalSdk = 'true';
    script.async = true;
    script.onload = () => {
      loadedClientId = clientId;
      if (window.paypal) resolve(window.paypal);
      else {
        sdkPromise = null;
        reject(new Error('No se pudo inicializar el SDK de PayPal.'));
      }
    };
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('No se pudo cargar PayPal desde paypal.com.'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function unconfiguredNotice(paypalConfig, isCard, onSwitchToQr) {
  const modeLabel = paypalConfig?.mode === 'live' ? 'Producción (Live)' : 'Pruebas (Sandbox)';
  const title = isCard
    ? 'Pago con tarjeta (Visa / Mastercard)'
    : 'Pasarela PayPal en línea';

  const detail = paypalConfig?.hasSecret && !paypalConfig?.hasClientId
    ? `La clave secreta de PayPal en modo <strong>${esc(modeLabel)}</strong> ya está registrada en el servidor. Solo falta agregar <code class="mono">PAYPAL_CLIENT_ID</code> en <code class="mono">.env</code> para habilitar el cobro real con ${isCard ? 'tarjeta de débito/crédito' : 'PayPal'}.`
    : `Configura <code class="mono">PAYPAL_CLIENT_ID</code>, <code class="mono">PAYPAL_CLIENT_SECRET</code> y <code class="mono">PAYPAL_MODE</code> en <code class="mono">.env</code> para activar los cobros verificados con ${isCard ? 'tarjeta' : 'PayPal'}.`;

  const html = `
    <div class="alert alert-warning" style="width:100%;flex-direction:column;gap:10px;align-items:flex-start">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700">
        ${icon('lock', 18)}
        <span>${title} · Falta ID de cliente</span>
      </div>
      <p style="margin:0;color:var(--text-secondary);font-size:0.84rem;line-height:1.6">${detail}</p>
      ${typeof onSwitchToQr === 'function' ? `
        <button type="button" class="btn btn-secondary btn-sm" data-switch-qr>
          ${icon('qr', 15)}
          <span>Usar Pago con QR mientras tanto</span>
        </button>` : ''}
    </div>`;

  return html;
}

async function renderPayPalButtons({
  container,
  totalUsd,
  getBuyer,
  reference,
  paypalConfig,
  fundingType,
  onSuccess,
  onSwitchToQr,
}) {
  if (!container) return;

  if (!paypalConfig?.serverConfigured || !paypalConfig?.clientId) {
    container.innerHTML = unconfiguredNotice(paypalConfig, fundingType === 'TARJETA', onSwitchToQr);
    container.querySelector('[data-switch-qr]')?.addEventListener('click', () => {
      if (typeof onSwitchToQr === 'function') onSwitchToQr();
    });
    return;
  }

  container.innerHTML = '<div class="spinner-wrap" style="padding:20px"><div class="spinner" style="width:32px;height:32px"></div></div>';

  let paypalSdk;
  try {
    paypalSdk = await loadPayPalSdk(paypalConfig.clientId);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger" style="width:100%">${icon('alert', 18)}<span>${esc(err.message)}</span></div>`;
    return;
  }

  const requiredFields = [
    ['nombre', 'Nombre completo'],
    ['email', 'Correo electrónico'],
    ['telefono', 'Teléfono'],
    ['ci', 'CI / NIT'],
    ['ciudad', 'Ciudad'],
    ['direccion', 'Dirección'],
  ];

  const fundingSource = fundingType === 'TARJETA'
    ? paypalSdk.FUNDING?.CARD
    : paypalSdk.FUNDING?.PAYPAL;

  const buttonConfig = {
    ...(fundingSource ? { fundingSource } : {}),
    style: fundingType === 'TARJETA'
      ? { layout: 'vertical', color: 'black', shape: 'rect', label: 'pay', height: 44 }
      : { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 44 },

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
        const firstMissing = requiredFields.find(([key]) => !buyer[key]);
        if (firstMissing) document.querySelector(`[name="${firstMissing[0]}"]`)?.focus();
        return actions.reject();
      }
      return actions.resolve();
    },

    async createOrder() {
      const buyer = getBuyer();
      const created = await api('/payments/paypal/create-order', {
        method: 'POST',
        body: {
          buyer,
          items: state.cart,
          refCode: reference,
        },
      });
      return created.orderID;
    },

    async onApprove(data) {
      try {
        const order = await api('/payments/paypal/capture-order', {
          method: 'POST',
          body: {
            orderID: data.orderID,
            paymentSource: fundingType,
          },
        });

        clearCart();
        if (typeof onSuccess === 'function') {
          onSuccess(order);
        } else {
          toast(`Pago verificado (${fmtBs(totalUsd)} / $${fmt(totalUsd)} USD) · Pedido ${order.codigo_orden}`, 'success');
          location.hash = '#/mis-pedidos';
        }
      } catch (error) {
        toast(error.message || 'No se pudo capturar el pago en el servidor', 'danger');
      }
    },

    onError(error) {
      toast(`Error en pasarela de pago: ${error?.message || 'operación cancelada'}`, 'danger');
    },
  };

  container.innerHTML = '';
  try {
    const buttons = paypalSdk.Buttons(buttonConfig);
    if (typeof buttons.isEligible === 'function' && !buttons.isEligible()) {
      container.innerHTML = `
        <div class="alert alert-warning" style="width:100%">
          ${icon('info', 18)}
          <span>Esta opción de pago no está habilitada para la región o navegador actual. Puedes utilizar PayPal o Pago con QR.</span>
        </div>`;
      return;
    }
    await buttons.render(container);
  } catch (err) {
    if (container.isConnected) {
      container.innerHTML = `<div class="alert alert-warning" style="width:100%">${icon('info', 18)}<span>No se pudo renderizar el botón de pago (${esc(err?.message || 'reintenta o usa QR')}).</span></div>`;
    }
  }
}

export async function mountPayPal(totalUsd, getBuyer, reference, paypalConfig, onSuccess, onSwitchToQr) {
  const container = document.querySelector('#paypal-button-container');
  return renderPayPalButtons({
    container,
    totalUsd,
    getBuyer,
    reference,
    paypalConfig,
    fundingType: 'PAYPAL',
    onSuccess,
    onSwitchToQr,
  });
}

export async function mountCardPayment(totalUsd, getBuyer, reference, paypalConfig, onSuccess, onSwitchToQr) {
  const container = document.querySelector('#card-button-container');
  return renderPayPalButtons({
    container,
    totalUsd,
    getBuyer,
    reference,
    paypalConfig,
    fundingType: 'TARJETA',
    onSuccess,
    onSwitchToQr,
  });
}
