/* ============================================================
   MotoConnect — views/home.js  (#/)
   Inicio comercial: hero con logo, accesos por categoría, sección de confianza
   ============================================================ */

import { api } from '../api.js';
import { esc } from '../utils.js';
import { productCard, bindProductCards } from '../components/productCard.js';

const QUICK_ACCESS = [
  { label: 'Trabajo y Delivery', copy: 'Economicas, bajo consumo y repuestos accesibles.', cat: 'Trabajo', icon: 'W' },
  { label: 'Ciudad y Diario', copy: 'Agiles, automaticas y eficientes para el trafico.', cat: 'Urbana', icon: 'C' },
  { label: 'Rutas y Adventure', copy: 'Suspension larga y doble proposito para altura.', cat: 'Adventure', icon: 'A' },
  { label: 'Deportivas y Alta Gama', copy: 'Potencia, curvas y estilo premium.', cat: 'Supersport', icon: 'D' },
];

const GUARANTEES = [
  { title: 'Garantia de Fabrica 24 Meses', copy: 'Respaldo oficial del fabricante en todos los modelos.' },
  { title: 'Inspeccion PDI 40 Puntos', copy: 'Revision tecnica certificada antes de cada entrega.' },
  { title: 'Acta de Entrega y Firma Digital', copy: 'Documentacion completa y trazable en cada operacion.' },
  { title: 'Cobertura Total Incluida', copy: 'Proteccion activa desde el dia de la entrega.' },
];

export async function home(root) {
  root.innerHTML = `
    <section class="hero" aria-label="MotoConnect">
      <div class="hero-bg" style="background-image:url('/images/productos/placeholder.svg')"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <img src="/assets/logo-motoconnect.jpg" alt="MotoConnect" style="height:64px;margin-bottom:16px;border-radius:8px" />
        <span class="hero-eyebrow">Concesionario Oficial - Bolivia</span>
        <h1>La Experiencia de<br /><span>Conduccion</span> Definitiva</h1>
        <p>Motocicletas para trabajo, ciudad, rutas y alto desempeno<br />Entrega nacional garantizada - Garantia oficial - Precios en Bs</p>
        <div class="hero-ctas">
          <a href="#/catalogo" class="btn btn-primary btn-lg">Explorar Catalogo Completo</a>
          <a href="#/recomendador" class="btn btn-secondary btn-lg">Asesor por Preguntas</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <span class="section-label">Accesos rapidos</span>
        <h2>Explora por tipo de uso</h2>
        <p>Encuentra la moto ideal para tu necesidad en un clic</p>
      </div>
      <div class="categories-grid">
        ${QUICK_ACCESS.map(item => `
          <a class="category-card" href="#/catalogo?cat=${encodeURIComponent(item.cat)}">
            <div class="category-card-thumb" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;font-weight:700;background:var(--bg-elevated);color:var(--accent-primary)">
              ${item.icon}
            </div>
            <div class="category-card-info">
              <h3>${esc(item.label)}</h3>
              <p>${esc(item.copy)}</p>
              <span class="category-link">Ver modelos</span>
            </div>
          </a>
        `).join('')}
      </div>
    </section>

    <div class="guarantees-section">
      <div class="guarantees-grid">
        ${GUARANTEES.map(item => `
          <div class="guarantee-item">
            <div class="guarantee-icon" style="font-size:1.5rem;font-weight:700;color:var(--accent-primary)">+</div>
            <div class="guarantee-text">
              <h4>${esc(item.title)}</h4>
              <p>${esc(item.copy)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  try {
    const products = await api('/productos');
    const featured = products.filter(p => Number(p.destacado) === 1).slice(0, 3);
    const grid = root.querySelector('.products-grid');
    if (!grid) {
      // Create a featured grid
      const section = document.createElement('section');
      section.className = 'section';
      section.innerHTML = `<div class="section-header"><span class="section-label">Destacados</span><h2>Modelos Destacados</h2><p>Seleccion especial de motocicletas</p></div><div class="products-grid" id="featured-grid"></div>`;
      root.appendChild(section);
    }
    const gridEl = root.querySelector('#featured-grid') || root.querySelector('.products-grid');
    bindProductCards(gridEl);
    gridEl.innerHTML = featured.length ? featured.map(productCard).join('') : '';
  } catch {
    // Features section already has content, skip
  }
}
