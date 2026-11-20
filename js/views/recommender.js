/* ============================================================
   MotoConnect — views/recommender.js  (#/recomendador)
   Recomendador interactivo: 3 preguntas con avance automático
   ============================================================ */

import { api } from '../api.js';
import { esc } from '../utils.js';
import { addToCart } from '../state.js';
import { productCard, bindProductCards } from '../components/productCard.js';
import { refreshNav } from '../components/navbar.js';
import { toast } from '../utils.js';

const QUESTIONS = [
  {
    key: 'q1',
    title: '¿Para qué usarás principalmente la moto?',
    options: [
      { key: 'trabajo', label: 'Trabajo, delivery o reparto diario', hint: 'Prioriza motos de trabajo y bajo consumo' },
      { key: 'ciudad', label: 'Movilidad diaria en ciudad y tráfico', hint: 'Prioriza urbanas y trabajo ágiles' },
      { key: 'aventura', label: 'Viajes, carreteras y caminos de tierra', hint: 'Prioriza Adventure y doble propósito' },
      { key: 'deportivo', label: 'Velocidad, curvas y estilo deportivo', hint: 'Prioriza Naked y Supersport' },
    ],
  },
  {
    key: 'q2',
    title: '¿Cuál es tu presupuesto aproximado en Bolivianos?',
    options: [
      { key: 'econ', label: 'Económica (Hasta Bs 14.000)', maxBs: 14000 },
      { key: 'intermedia', label: 'Intermedia (Hasta Bs 26.000)', maxBs: 26000 },
      { key: 'media_alta', label: 'Gama Media-Alta (Hasta Bs 56.000)', maxBs: 56000 },
      { key: 'sin_limite', label: 'Sin límite de presupuesto', maxBs: Infinity },
    ],
  },
  {
    key: 'q3',
    title: '¿Cuál es tu experiencia manejando moto?',
    options: [
      { key: 'principiante', label: 'Principiante / Primera moto', maxCc: 160 },
      { key: 'intermedio', label: 'Intermedio (Manejo en ciudad)', maxCc: 320 },
      { key: 'experimentado', label: 'Experimentado (Busco mayor potencia)', maxCc: 9999 },
    ],
  },
];

// Usage definitions for scoring
const USAGE_DEFS = {
  trabajo: { categories: ['Trabajo'], maxCc: 160, maxWeight: 140, minConsumo: 40 },
  ciudad: { categories: ['Urbana', 'Trabajo'], maxCc: 200, maxWeight: 180 },
  aventura: { categories: ['Adventure'], maxCc: 500, maxWeight: 9999 },
  deportivo: { categories: ['Naked', 'Supersport'], maxCc: 9999, maxWeight: 9999 },
};

const BUDGET_DEFS = {
  econ: { maxBs: 14000 },
  intermedia: { maxBs: 26000 },
  media_alta: { maxBs: 56000 },
  sin_limite: { maxBs: Infinity },
};

const EXP_DEFS = {
  principiante: { maxCc: 160, maxWeight: 140 },
  intermedio: { maxCc: 320, maxWeight: 180 },
  experimentado: { maxCc: 9999, maxWeight: 9999 },
};

const FALLBACK_IMAGE = '/images/productos/placeholder.svg';

function scoreProduct(product, usage, budget, experience) {
  let score = 0;
  const cat = product.categoria || '';

  if (usage.categories.includes(cat)) score += 40;
  const priceBs = Number(product.precio_usd) * 6.96;
  if (priceBs <= budget.maxBs) score += 25;
  const cc = Number(product.cilindrada_cc || 0);
  if (cc > 0 && cc <= experience.maxCc) score += 20;
  if (Number(product.peso_kg || 0) <= experience.maxWeight) score += 10;
  if (Number(product.stock_disponible) > 0) score += 15;
  if (usage.minConsumo && Number(String(product.consumo_kml || '').replace(/\D/g, '')) >= usage.minConsumo) score += 10;

  return score;
}

export async function recommender(root) {
  root.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Asesor por Preguntas</h1>
        <p>3 preguntas rápidas para encontrar tu moto ideal</p>
      </div>
    </div>
    <div class="section">
      <div class="card-dark" style="max-width:820px;margin:0 auto">
        <div id="step-info" style="margin-bottom:24px">
          <span class="section-label">Pregunta 1 de 3</span>
        </div>
        <div id="question-container" style="min-height:260px"></div>
        <div id="recommender-results" style="margin-top:28px"></div>
        <div class="panel-actions" style="margin-top:24px;justify-content:center">
          <button type="button" class="btn btn-secondary" id="btn-restart" style="display:none">Cambiar respuestas</button>
        </div>
      </div>
    </div>
  `;

  const state = { q1: null, q2: null, q3: null, step: 0, products: [] };

  async function loadProducts() {
    if (state.products.length) return;
    try {
      state.products = await api('/productos');
    } catch {
      state.products = [];
    }
  }

  function renderQuestion(animate) {
    const q = QUESTIONS[state.step];
    const container = root.querySelector('#question-container');
    const stepInfo = root.querySelector('#step-info');

    // Update step info
    stepInfo.innerHTML = `<span class="section-label">Pregunta ${state.step + 1} de 3</span>`;

    // Show step indicator dots
    let dotsHtml = '';
    for (let i = 0; i < 3; i++) {
      const active = i < state.step;
      dotsHtml += `<span style="width:32px;height:6px;border-radius:3px;background:${active ? 'var(--accent-primary)' : 'var(--border-color)'};transition:background 0.3s"></span>`;
    }
    stepInfo.innerHTML += `<div style="display:flex;gap:8px;margin-top:8px;justify-content:center">${dotsHtml}</div>`;

    // Check if this is the last question (show results)
    if (state.step === 3) {
      renderResults();
      return;
    }

    const answers = [state.q1, state.q2, state.q3];
    const previousAnswered = answers.slice(0, state.step).every(a => a !== null);

    if (animate && previousAnswered) {
      container.classList.add('recommender-fade-out');
      container.innerHTML = '';
      setTimeout(() => {
        container.classList.remove('recommender-fade-out');
        renderQuestionContent(container, q, state);
      }, 200);
    } else {
      renderQuestionContent(container, q, state);
    }
  }

  function renderQuestionContent(container, q, state) {
    const currentAnswer = state[q.key];
    const optsHtml = q.options.map(opt => {
      const isActive = currentAnswer === opt.key;
      return `
        <button type="button" class="role-quick-card" data-answer="${esc(opt.key)}" style="border-color:${isActive ? 'var(--accent-primary)' : 'var(--border-color)'};background:${isActive ? 'rgba(249,87,21,0.12)' : 'var(--bg-elevated)'};transition:all 0.3s">
          <span style="display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left">
            <span style="font-weight:700;font-size:0.88rem;color:var(--text-primary)">${esc(opt.label)}</span>
            ${opt.hint ? `<span style="font-size:0.75rem;color:var(--text-muted)">${esc(opt.hint)}</span>` : ''}
            ${opt.maxBs ? `<span style="font-size:0.7rem;color:var(--accent-primary)">Económica (Hasta Bs 14.000)</span>` : ''}
            ${opt.maxCc ? `<span style="font-size:0.7rem;color:var(--accent-secondary)">A céulas ${opt.maxCc}cc</span>` : ''}
            ${opt.maxWeight ? `<span style="font-size:0.7rem;color:var(--text-muted)">Hasta ${opt.maxWeight}kg</span>` : ''}
          </span>
          ${isActive ? '<span style="font-size:1.2rem;color:var(--accent-primary);font-weight:700">●</span>' : ''}
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:24px">
        <label style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${esc(q.title)}</label>
      </div>
      <div class="role-quick-grid">${optsHtml}</div>
    `;

    // Auto-advance on selection
    container.querySelectorAll('[data-answer]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-answer');
        state[q.key] = key;
        // Auto-advance to next question
        const nextStep = state.step + 1;
        if (nextStep <= 3) {
          state.step = nextStep;
          renderQuestion(true);
        }
      });
    });
  }

  function renderResults() {
    const usage = USAGE_DEFS[state.q1] || USAGE_DEFS.trabajo;
    const budget = BUDGET_DEFS[state.q2] || BUDGET_DEFS.sin_limite;
    const experience = EXP_DEFS[state.q3] || EXP_DEFS.intermedio;

    const resultsBox = root.querySelector('#recommender-results');

    loadProducts().then(() => {
      const candidates = state.products
        .filter(p => Number(p.stock_disponible) > 0)
        .map(p => ({ product: p, score: scoreProduct(p, usage, budget, experience) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (!candidates.length) {
        resultsBox.innerHTML = '<div class="empty-state"><span class="empty-icon">Sin resultados</span><h3>Sin resultados</h3><p>No hay motos disponibles con esos criterios.</p></div>';
        return;
      }

      const maxScore = Math.max(...candidates.map(c => c.score), 1);
      resultsBox.innerHTML = `
        <div class="section-header" style="text-align:left;margin-bottom:16px">
          <span class="section-label">Resultados</span>
          <h2 style="font-size:1.4rem">Tus 3 mejores opciones</h2>
        </div>
        <div class="products-grid">
          ${candidates.map(({ product, score }) => {
            const match = Math.min(99, Math.max(60, Math.round((score / (maxScore + 10)) * 100)));
            const image = (JSON.parse(product.imagenes_json || '[]')[0] || {}).url || FALLBACK_IMAGE;
            return `
              <article class="product-card" data-product="${esc(product.slug)}">
                <div class="product-card-image" data-open-product="${esc(product.slug)}" style="cursor:pointer">
                  <img src="${esc(image)}" alt="${esc(product.nombre)}" loading="lazy" style="height:210px;object-fit:cover" onerror="this.src='${FALLBACK_IMAGE}'" />
                  <span class="card-badge-tl">${esc(product.marca || '')}</span>
                  <span class="card-badge-tr badge-stock-ok">${match}% compatible</span>
                </div>
                <div class="product-card-body">
                  <div>
                    <div class="product-name">${esc(product.nombre)}</div>
                    ${product.anio ? `<div class="product-year">${product.anio}</div>` : ''}
                  </div>
                  <div class="product-specs">
                    ${product.cilindrada_cc ? `<span class="spec-pill">${product.cilindrada_cc} cc</span>` : ''}
                    ${product.consumo_kml ? `<span class="spec-pill">${esc(product.consumo_kml)}</span>` : ''}
                    ${product.peso_kg ? `<span class="spec-pill">${product.peso_kg} kg</span>` : ''}
                  </div>
                  <div class="product-price">
                    <div class="price-usd mono" style="font-size:1.1rem">${esc(String(product.precio_usd))} Bs</div>
                    <div class="price-bs">Stock: ${product.stock_disponible}</div>
                  </div>
                </div>
                <div class="product-card-actions">
                  <button type="button" class="btn-compare" data-open-product="${esc(product.slug)}">Ver Detalle</button>
                  <button type="button" class="btn btn-primary" data-add-cart="${esc(product.slug)}">Añadir al Carrito</button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
        <div style="text-align:center;margin-top:24px">
          <a href="#/catalogo" class="btn btn-outline">Ver todo el catalogo</a>
        </div>
      `;

      bindProductCards(resultsBox);
      resultsBox.querySelectorAll('[data-add-cart]').forEach(button => {
        button.addEventListener('click', () => {
          const product = state.products.find(p => p.slug === button.dataset.addCart);
          if (!product) return;
          const result = addToCart(product, { color: 'Estándar', cantidad: 1, imagen: (JSON.parse(product.imagenes_json || '[]')[0] || {}).url || '' });
          if (!result.ok) { toast(result.message, 'warning'); return; }
          refreshNav();
          button.textContent = 'Añadido';
        });
      });
    });

    // Enable restart button
    root.querySelector('#btn-restart')?.addEventListener('click', () => {
      state.q1 = null; state.q2 = null; state.q3 = null; state.step = 0;
      root.querySelector('#recommender-results').innerHTML = '';
      renderQuestion(false);
    });
    const restartBtn = root.querySelector('#btn-restart');
    if (restartBtn) restartBtn.style.display = 'inline-block';
  }

  renderQuestion(false);
}
