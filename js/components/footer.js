/* ============================================================
   MotoConnect — components/footer.js
   Footer comercial y modales legales informativos
   ============================================================ */

import { esc, icon } from '../utils.js';

const LEGAL_CONTENT = {
  'Garantía Oficial': {
    title: 'Garantía Oficial MotoConnect',
    body: `
      <p>Todas las motocicletas comercializadas por MotoConnect S.R.L. incluyen garantía de fábrica de 24 meses o el kilometraje definido por el fabricante, lo que ocurra primero.</p>
      <ul>
        <li>Cobertura integral de motor, transmisión, chasis y sistema eléctrico.</li>
        <li>Inspección PDI de 40 puntos certificada antes de la entrega.</li>
        <li>Dos llaves codificadas y manual del propietario en español.</li>
        <li>Mantenimientos realizados en talleres autorizados para conservar la vigencia.</li>
      </ul>
      <p>Para activar una garantía presenta tu Certificado Digital de Entrega y el VIN asignado.</p>`,
  },
  'Términos de Compra': {
    title: 'Términos de Compra',
    body: `
      <p>La confirmación del pedido implica la aceptación de las condiciones comerciales de MotoConnect S.R.L.</p>
      <ul>
        <li>Los precios se muestran en Bolivianos (Bs) con referencia en USD (1 USD = 6.96 Bs) y se calculan en el servidor según catálogo vigente.</li>
        <li>El pedido se considera confirmado una vez verificado el pago por el área de cobranzas o capturado en línea mediante PayPal o tarjeta.</li>
        <li>El inventario se descuenta de forma atómica al aprobar el pago o capturar la orden en línea.</li>
        <li>Los pagos mediante código QR quedan en revisión hasta validar el comprobante adjunto.</li>
      </ul>`,
  },
  'Política de Entregas': {
    title: 'Política de Entregas',
    body: `
      <p>La entrega se coordina con el área de despacho una vez completada la inspección y empaque PDI de 40 puntos.</p>
      <ul>
        <li>Preparación y empaque: 24 a 48 horas hábiles desde la verificación del pago.</li>
        <li>Entrega en La Paz, Santa Cruz y Cochabamba: 2 a 5 días hábiles.</li>
        <li>Otras regiones: 5 a 10 días hábiles según disponibilidad logística.</li>
        <li>La entrega requiere nombre y CI del receptor, conformidad y firma digital en pantalla.</li>
      </ul>`,
  },
  'Soporte al Cliente': {
    title: 'Soporte al Cliente',
    body: `
      <p>Nuestro equipo acompaña cada etapa de la compra y la postventa.</p>
      <ul>
        <li>Correo: soporte@motoconnect.com</li>
        <li>Atención comercial: +591 700 00 000</li>
        <li>Horario: lunes a sábado, 08:30 a 19:00</li>
        <li>Consultas sobre pedidos: indica tu código de orden MC-2026.</li>
      </ul>`,
  },
};

function openLegalModal(key) {
  const container = document.querySelector('#modals-container');
  if (!container) return;
  const content = LEGAL_CONTENT[key] || LEGAL_CONTENT['Soporte al Cliente'];

  container.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <section class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(content.title)}">
        <div class="modal-header">
          <h2 class="modal-title">${esc(content.title)}</h2>
          <button type="button" class="modal-close" aria-label="Cerrar" data-modal-close>${icon('x', 16)}</button>
        </div>
        <div class="info-modal-content" style="color:var(--text-secondary);font-size:0.9rem;line-height:1.7">
          ${content.body}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" data-modal-close>Entendido</button>
        </div>
      </section>
    </div>`;

  const close = () => {
    container.innerHTML = '';
  };

  container.querySelectorAll('[data-modal-close]').forEach(button => {
    button.addEventListener('click', close);
  });
  container.querySelector('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) close();
  });
}

export function initFooter() {
  document.querySelectorAll('button.footer-link-btn').forEach(button => {
    button.addEventListener('click', () => openLegalModal(button.textContent.trim()));
  });
}
