/* ============================================================
   MotoConnect — views/home.js (#/)
   Portada institucional y comercial de MotoConnect (sin inventario ni precios)
   ============================================================ */

import { esc, icon } from '../utils.js';

const VALUE_PROPOSITIONS = [
  {
    icon: 'clipboard',
    title: 'Inspección PDI de 40 Puntos',
    copy: 'Cada motocicleta atraviesa una lista técnica de 40 verificaciones certificadas antes de salir de almacén, con asignación única de VIN y precinto de empaque.',
  },
  {
    icon: 'shield',
    title: 'Pagos Auditados y Trazables',
    copy: 'Validación en servidor para pagos en línea con PayPal o tarjeta (Visa y Mastercard) y revisión documental rigurosa para pagos mediante código QR.',
  },
  {
    icon: 'truck',
    title: 'Despacho y Entrega Certificada',
    copy: 'Seguimiento en tiempo real desde la confirmación de pago hasta la recepción física con firma digital en pantalla y emisión de certificado de garantía.',
  },
  {
    icon: 'compass',
    title: 'Asesoría Técnica Especializada',
    copy: 'Recomendador guiado de 3 preguntas, comparador técnico lado a lado y asistente técnico conectado al inventario real para ayudarte a elegir sin conjeturas.',
  },
];

const PURCHASE_STEPS = [
  {
    step: '01',
    icon: 'search',
    title: 'Elige o déjate asesorar',
    copy: 'Explora el catálogo por tipo de uso o responde 3 preguntas en el asesor para descubrir las opciones compatibles con tu ruta y experiencia.',
  },
  {
    step: '02',
    icon: 'lock',
    title: 'Compra y pago verificable',
    copy: 'Registra tu orden con cálculo transparente en servidor. Elige PayPal, tarjeta de débito/crédito o sube tu comprobante de pago por QR para validación.',
  },
  {
    step: '03',
    icon: 'wrench',
    title: 'Preparación PDI y asignación VIN',
    copy: 'Almacén verifica 40 puntos técnicos, asigna el número de chasis único (VIN) y sella el código de empaque antes del despacho.',
  },
  {
    step: '04',
    icon: 'award',
    title: 'Recepción y certificado digital',
    copy: 'Sigue cada cambio de estado en Mis Pedidos, firma la conformidad al recibir tu unidad y descarga tu Certificado Digital de Entrega y Garantía.',
  },
];

const SECURITY_HIGHLIGHTS = [
  {
    icon: 'lock',
    title: 'Integridad financiera en servidor',
    copy: 'Los importes, impuestos de trámite (5%) y reserva atómica de inventario se calculan exclusivamente en el backend sobre el catálogo vigente.',
  },
  {
    icon: 'check-circle',
    title: 'Control anti-duplicidad',
    copy: 'Ninguna transacción PayPal puede reutilizarse ni aprobarse dos veces, y el stock se descuenta una única vez dentro de transacciones SQLite seguras.',
  },
  {
    icon: 'file',
    title: 'Comprobantes bajo acceso controlado',
    copy: 'Los comprobantes de pago por QR se almacenan en un directorio privado protegido por sesión y permisos por rol.',
  },
];

const DELIVERY_HIGHLIGHTS = [
  {
    icon: 'clock',
    title: 'Estados logísticos auditables',
    copy: 'Visualiza exactamente si tu pedido está en revisión, listo para preparar, en inspección PDI, empacado, en ruta o entregado.',
  },
  {
    icon: 'package',
    title: 'Trazabilidad de chasis y empaque',
    copy: 'Cada entrega registra el VIN único de la unidad, el código de empaque, el responsable de almacén y el historial operativo completo.',
  },
  {
    icon: 'printer',
    title: 'Acta y garantía oficial de 24 meses',
    copy: 'Al completar la entrega con firma digital en pantalla se habilita el Certificado Digital imprimible con respaldo oficial de MotoConnect S.R.L.',
  },
];

export async function home(root) {
  root.innerHTML = `
    <section class="hero home-hero" aria-label="Presentación MotoConnect">
      <div class="home-hero-grid-bg" aria-hidden="true"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content home-hero-content">
        <div class="home-brand-frame">
          <img src="/assets/logo-motoconnect.jpg" alt="Logo oficial MotoConnect" class="home-brand-logo" />
        </div>
        <span class="hero-eyebrow">Concesionario Digital Certificado · Bolivia</span>
        <h1>Compra tu motocicleta con <span>trazabilidad total</span> de principio a fin</h1>
        <p>
          MotoConnect integra asesoramiento técnico inteligente, validación segura de pagos,
          inspección PDI de 40 puntos y entrega certificada con firma digital en una sola plataforma.
        </p>
        <div class="hero-ctas">
          <a href="#/catalogo" class="btn btn-primary btn-lg">
            ${icon('layers', 20)}
            <span>Explorar Catálogo</span>
          </a>
          <a href="#/recomendador" class="btn btn-secondary btn-lg">
            ${icon('compass', 20)}
            <span>Asesor por Preguntas</span>
          </a>
        </div>
        <div class="home-hero-metrics" aria-label="Pilares de servicio">
          <div class="home-metric-pill">${icon('clipboard', 16)} <span>Inspección PDI 40 puntos</span></div>
          <div class="home-metric-pill">${icon('shield', 16)} <span>Garantía oficial 24 meses</span></div>
          <div class="home-metric-pill">${icon('truck', 16)} <span>Entrega nacional certificada</span></div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="home-value-title">
      <div class="section-header">
        <span class="section-label">Propuesta de valor</span>
        <h2 id="home-value-title">Por qué elegir MotoConnect</h2>
        <p>Un concesionario digital diseñado para brindar transparencia operativa, seguridad documental y respaldo técnico real.</p>
      </div>
      <div class="home-cards-grid">
        ${VALUE_PROPOSITIONS.map(item => `
          <article class="home-feature-card">
            <div class="home-feature-icon">${icon(item.icon, 22)}</div>
            <h3>${esc(item.title)}</h3>
            <p>${esc(item.copy)}</p>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="home-band-surface" aria-labelledby="home-process-title">
      <div class="section">
        <div class="section-header">
          <span class="section-label">Proceso de compra</span>
          <h2 id="home-process-title">Cómo funciona de extremo a extremo</h2>
          <p>Cuatro etapas claras y verificables desde la elección de tu unidad hasta la recepción con garantía oficial.</p>
        </div>
        <div class="home-process-grid">
          ${PURCHASE_STEPS.map(step => `
            <article class="home-step-card">
              <div class="home-step-top">
                <span class="home-step-num mono">${esc(step.step)}</span>
                <span class="home-step-icon">${icon(step.icon, 20)}</span>
              </div>
              <h3>${esc(step.title)}</h3>
              <p>${esc(step.copy)}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="home-trust-title">
      <div class="section-header">
        <span class="section-label">Seguridad y logística</span>
        <h2 id="home-trust-title">Pagos verificables y seguimiento transparente</h2>
        <p>Cada operación queda auditada por área responsable para proteger tanto al comprador como al inventario.</p>
      </div>
      <div class="home-trust-split">
        <article class="card-dark home-trust-card">
          <div class="home-trust-head">
            <span class="home-trust-badge">${icon('shield', 20)}</span>
            <div>
              <span class="section-label" style="margin-bottom:2px">Seguridad de pagos</span>
              <h3>Protección en cada transacción</h3>
            </div>
          </div>
          <div class="home-trust-list">
            ${SECURITY_HIGHLIGHTS.map(item => `
              <div class="home-trust-item">
                <div class="home-trust-item-icon">${icon(item.icon, 18)}</div>
                <div>
                  <h4>${esc(item.title)}</h4>
                  <p>${esc(item.copy)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </article>

        <article class="card-dark home-trust-card">
          <div class="home-trust-head">
            <span class="home-trust-badge secondary">${icon('truck', 20)}</span>
            <div>
              <span class="section-label" style="margin-bottom:2px">Seguimiento y entrega</span>
              <h3>Control logístico hasta tu puerta</h3>
            </div>
          </div>
          <div class="home-trust-list">
            ${DELIVERY_HIGHLIGHTS.map(item => `
              <div class="home-trust-item">
                <div class="home-trust-item-icon secondary">${icon(item.icon, 18)}</div>
                <div>
                  <h4>${esc(item.title)}</h4>
                  <p>${esc(item.copy)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </article>
      </div>
    </section>

    <section class="home-cta-band">
      <div class="section" style="padding-top:56px;padding-bottom:56px">
        <div class="home-cta-card">
          <div>
            <span class="section-label">Comienza ahora</span>
            <h2>Encuentra la motocicleta adecuada para tu camino</h2>
            <p>Consulta el catálogo completo con disponibilidad actualizada en vivo o utiliza el asesor guiado de 3 preguntas.</p>
          </div>
          <div class="home-cta-actions">
            <a href="#/catalogo" class="btn btn-primary btn-lg">Ir al Catálogo</a>
            <a href="#/recomendador" class="btn btn-secondary btn-lg">Usar Asesor</a>
          </div>
        </div>
      </div>
    </section>
  `;
}
