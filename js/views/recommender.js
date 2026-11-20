/* ============================================================
   MotoConnect — views/recommender.js (#/recomendador)
   Asesor de compra coherente en 4 pasos + WhatsApp directo (+591 67671435)
   ============================================================ */

import { api } from '../api.js';
import { WHATSAPP_NUMBER_DISPLAY, WHATSAPP_NUMBER_DIGITS } from '../config.js';
import { esc, fmt, fmtBs, toast, icon, productImages, downloadPdfBlob } from '../utils.js';
import {
  ADVISOR_QUESTIONS,
  rankAdvisorRecommendations,
  optionLabelFor,
  buildAdvisorSummaryText,
  buildWhatsAppAdvisorUrl,
} from '../utils/advisorLogic.js';
import { addToCart } from '../state.js';
import { bindProductCards } from '../components/productCard.js';
import { refreshNav } from '../components/navbar.js';

const FALLBACK_IMAGE = '/images/productos/placeholder.svg';

export async function recommender(root) {
  root.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Asesor de Compra Personalizado</h1>
        <p>Responde 4 preguntas clave y recibe modelos con justificación técnica y contacto directo por WhatsApp (${esc(WHATSAPP_NUMBER_DISPLAY)})</p>
      </div>
    </div>
    <div class="section">
      <div class="card-dark" style="max-width:1180px;margin:0 auto">
        <div id="step-info" style="margin-bottom:24px;text-align:center">
          <span class="section-label">Paso 1 de ${ADVISOR_QUESTIONS.length}</span>
        </div>
        <div id="question-container" style="min-height:260px"></div>
        <div id="recommender-results" style="margin-top:20px"></div>
        <div class="panel-actions" style="margin-top:24px;justify-content:center">
          <button type="button" class="btn btn-secondary" id="btn-back" style="display:none">Volver a pregunta anterior</button>
          <button type="button" class="btn btn-outline" id="btn-restart" style="display:none">${icon('refresh', 15)} <span>Reiniciar cuestionario</span></button>
        </div>
      </div>
    </div>
  `;

  const recState = {
    answers: { uso: null, presupuesto: null, experiencia: null, prioridad: null },
    step: 0,
    extraNote: '',
    products: [],
  };

  async function loadProducts() {
    if (recState.products.length) return;
    recState.products = await api('/productos');
  }

  function renderStepBar() {
    const stepInfo = root.querySelector('#step-info');
    const backBtn = root.querySelector('#btn-back');
    const restartBtn = root.querySelector('#btn-restart');
    const totalSteps = ADVISOR_QUESTIONS.length;

    const label = recState.step < totalSteps
      ? `Pregunta ${recState.step + 1} de ${totalSteps}`
      : 'Diagnóstico y recomendación listos';

    let dotsHtml = '';
    for (let i = 0; i < totalSteps; i += 1) {
      const filled = i <= recState.step;
      dotsHtml += `<span style="width:42px;height:6px;border-radius:3px;background:${filled ? 'var(--accent-primary)' : 'var(--border-color)'};transition:background 0.25s"></span>`;
    }

    stepInfo.innerHTML = `
      <span class="section-label">${label}</span>
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:center">${dotsHtml}</div>
    `;

    if (backBtn) backBtn.style.display = recState.step > 0 && recState.step < totalSteps ? 'inline-flex' : 'none';
    if (restartBtn) restartBtn.style.display = recState.step > 0 ? 'inline-flex' : 'none';
  }

  function renderQuestion(animate) {
    renderStepBar();
    const container = root.querySelector('#question-container');
    const totalSteps = ADVISOR_QUESTIONS.length;

    if (recState.step >= totalSteps) {
      container.style.display = 'none';
      renderResults();
      return;
    }

    container.style.display = 'block';
    root.querySelector('#recommender-results').innerHTML = '';

    const q = ADVISOR_QUESTIONS[recState.step];
    const renderContent = () => {
      const currentAnswer = recState.answers[q.key];
      const optsHtml = q.options.map(opt => {
        const isActive = currentAnswer === opt.key;
        return `
          <button type="button" class="role-quick-card" data-answer="${esc(opt.key)}"
            style="border-color:${isActive ? 'var(--accent-primary)' : 'var(--border-color)'};background:${isActive ? 'rgba(249,87,21,0.12)' : 'var(--bg-elevated)'};transition:all 0.2s">
            <span style="display:flex;flex-direction:column;gap:4px;min-width:0;text-align:left">
              <span style="font-weight:700;font-size:0.95rem;color:var(--text-primary)">${esc(opt.label)}</span>
              ${opt.hint ? `<span style="font-size:0.8rem;color:var(--text-muted)">${esc(opt.hint)}</span>` : ''}
            </span>
            <span style="color:${isActive ? 'var(--accent-primary)' : 'var(--text-muted)'};display:inline-flex">
              ${isActive ? icon('check-circle', 20) : icon('compass', 18)}
            </span>
          </button>`;
      }).join('');

      container.innerHTML = `
        <div style="margin-bottom:20px">
          <h2 style="font-size:1.18rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">${esc(q.stepTitle)}</h2>
          <p class="text-muted" style="font-size:0.86rem">${esc(q.helper)}</p>
        </div>
        <div class="role-quick-grid">${optsHtml}</div>
      `;

      container.querySelectorAll('[data-answer]').forEach(button => {
        button.addEventListener('click', () => {
          recState.answers[q.key] = button.getAttribute('data-answer');
          if (recState.step < ADVISOR_QUESTIONS.length) {
            recState.step += 1;
            renderQuestion(true);
          }
        });
      });
    };

    if (animate) {
      container.style.opacity = '0.35';
      setTimeout(() => {
        container.style.opacity = '1';
        renderContent();
      }, 110);
    } else {
      renderContent();
    }
  }

  async function renderResults() {
    const resultsBox = root.querySelector('#recommender-results');
    resultsBox.innerHTML = '<div class="spinner-wrap" style="padding:32px"><div class="spinner"></div></div>';

    try {
      await loadProducts();
    } catch (error) {
      resultsBox.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('alert', 44)}</span><h3>Error al consultar inventario</h3><p>${esc(error.message)}</p></div>`;
      return;
    }

    const ranked = rankAdvisorRecommendations(recState.products, recState.answers, 3);
    if (!ranked.length) {
      resultsBox.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${icon('search', 44)}</span>
          <h3>Sin resultados disponibles</h3>
          <p>Actualmente no hay motocicletas con stock disponibles para recomendar.</p>
          <a href="#/catalogo" class="btn btn-primary">Ver Catálogo Completo</a>
        </div>`;
      return;
    }

    const topProduct = ranked[0].product;
    const initialGeneralWa = buildWhatsAppAdvisorUrl({
      phoneDigits: WHATSAPP_NUMBER_DIGITS,
      answers: recState.answers,
      product: topProduct,
      extraNote: recState.extraNote,
    });

    resultsBox.innerHTML = `
      <div class="advisor-summary-box">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
          <div>
            <span class="section-label">Tu perfil de compra</span>
            <h2 style="font-size:1.2rem;margin:4px 0 10px">Resumen de tus 4 respuestas</h2>
            <div class="advisor-answer-chips">
              <span class="advisor-answer-chip"><strong>Uso:</strong> ${esc(optionLabelFor('uso', recState.answers.uso))}</span>
              <span class="advisor-answer-chip"><strong>Presupuesto:</strong> ${esc(optionLabelFor('presupuesto', recState.answers.presupuesto))}</span>
              <span class="advisor-answer-chip"><strong>Experiencia:</strong> ${esc(optionLabelFor('experiencia', recState.answers.experiencia))}</span>
              <span class="advisor-answer-chip"><strong>Prioridad:</strong> ${esc(optionLabelFor('prioridad', recState.answers.prioridad))}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-secondary btn-sm" id="copy-advisor-summary">
              ${icon('clipboard', 14)} <span>Copiar resumen</span>
            </button>
            <a id="wa-general-link" href="${esc(initialGeneralWa)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-sm">
              ${icon('whatsapp', 15)} <span>Enviar por WhatsApp (${esc(WHATSAPP_NUMBER_DISPLAY)})</span>
            </a>
          </div>
        </div>
        <div class="form-group" style="margin-top:14px">
          <label for="advisor-extra-note">¿Quieres añadir una duda puntual antes de escribirnos por WhatsApp? (opcional)</label>
          <input id="advisor-extra-note" type="text" maxlength="200" value="${esc(recState.extraNote)}" placeholder="Ej. ¿Tienen entrega inmediata en Cochabamba o financiamiento?" />
        </div>
      </div>

      <div class="section-header" style="text-align:left;margin:24px 0 18px">
        <span class="section-label">Resultados personalizados en stock</span>
        <h2 style="font-size:1.4rem">Tus ${ranked.length} mejores opciones explicadas</h2>
      </div>

      <div class="products-grid advisor-results-grid">
        ${ranked.map(({ product, matchPercent, reasons, warnings }) => {
          const image = productImages(product)[0] || FALLBACK_IMAGE;
          const waUrl = buildWhatsAppAdvisorUrl({
            phoneDigits: WHATSAPP_NUMBER_DIGITS,
            answers: recState.answers,
            product,
            extraNote: recState.extraNote,
          });
          return `
            <article class="product-card" data-product="${esc(product.slug)}">
              <div class="product-card-image" data-open-product="${esc(product.slug)}" style="cursor:pointer">
                <img src="${esc(image)}" alt="${esc(product.nombre)}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'" />
                <span class="card-badge-tl">${esc(product.marca || '')}</span>
                <span class="card-badge-tr badge-stock-ok">${matchPercent}% compatible</span>
              </div>
              <div class="product-card-body">
                <div>
                  <div class="product-name">${esc(product.nombre)}</div>
                  ${product.anio ? `<div class="product-year">${product.anio} · ${esc(product.categoria)}</div>` : ''}
                </div>
                <div class="product-specs">
                  ${product.cilindrada_cc ? `<span class="spec-pill">${product.cilindrada_cc} cc</span>` : ''}
                  ${product.consumo_kml ? `<span class="spec-pill">${esc(product.consumo_kml)}</span>` : ''}
                  ${product.peso_kg ? `<span class="spec-pill">${product.peso_kg} kg</span>` : ''}
                </div>
                <div class="advisor-why-box">
                  <strong>Por qué encaja contigo:</strong>
                  <ul>
                    ${reasons.map(r => `<li>${esc(r)}</li>`).join('')}
                  </ul>
                  ${warnings.length ? `<div class="advisor-warn">${icon('alert', 13)} <span>${esc(warnings[0])}</span></div>` : ''}
                </div>
                <div class="product-price">
                  <div class="price-usd mono" style="font-size:1.25rem">${fmtBs(product.precio_usd)}</div>
                  <div class="price-bs">≈ $${fmt(product.precio_usd)} USD · Stock: ${product.stock_disponible} u.</div>
                </div>
              </div>
              <div class="product-card-actions" style="flex-direction:column;gap:8px">
                <div style="display:flex;gap:8px;width:100%">
                  <button type="button" class="btn-compare" style="flex:1" data-open-product="${esc(product.slug)}">Ver Ficha</button>
                  <button type="button" class="btn btn-primary" style="flex:1" data-add-cart="${esc(product.slug)}">${icon('cart', 14)} <span>Añadir</span></button>
                </div>
                <div style="display:flex;gap:8px;width:100%">
                  <button type="button" class="btn btn-outline btn-sm" style="flex:1" data-download-papers="${esc(product.slug)}">
                    ${icon('download', 14)} <span>Papeles PDF</span>
                  </button>
                  <a class="btn btn-whatsapp btn-sm" style="flex:1" data-wa-bike="${esc(product.slug)}" href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer">
                    ${icon('whatsapp', 14)} <span>Consultar WhatsApp</span>
                  </a>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
      <div style="text-align:center;margin-top:24px">
        <a href="#/catalogo" class="btn btn-outline">Ver todo el catálogo</a>
      </div>
    `;

    bindProductCards(resultsBox);

    const extraInput = resultsBox.querySelector('#advisor-extra-note');
    const syncWhatsAppLinks = () => {
      recState.extraNote = extraInput?.value || '';
      const generalLink = resultsBox.querySelector('#wa-general-link');
      if (generalLink) {
        generalLink.href = buildWhatsAppAdvisorUrl({
          phoneDigits: WHATSAPP_NUMBER_DIGITS,
          answers: recState.answers,
          product: topProduct,
          extraNote: recState.extraNote,
        });
      }
      resultsBox.querySelectorAll('[data-wa-bike]').forEach(anchor => {
        const prod = ranked.find(r => r.product.slug === anchor.dataset.waBike)?.product;
        if (prod) {
          anchor.href = buildWhatsAppAdvisorUrl({
            phoneDigits: WHATSAPP_NUMBER_DIGITS,
            answers: recState.answers,
            product: prod,
            extraNote: recState.extraNote,
          });
        }
      });
    };
    extraInput?.addEventListener('input', syncWhatsAppLinks);

    resultsBox.querySelector('#copy-advisor-summary')?.addEventListener('click', async () => {
      const txt = `Consulta MotoConnect (${WHATSAPP_NUMBER_DISPLAY})\n${buildAdvisorSummaryText(recState.answers)}\nMoto destacada: ${topProduct.nombre} (${fmtBs(topProduct.precio_usd)})`;
      try {
        await navigator.clipboard.writeText(txt);
        toast('Resumen copiado al portapapeles', 'success');
      } catch {
        toast('Usa el botón de WhatsApp para enviar tus respuestas directamente', 'info');
      }
    });

    resultsBox.querySelectorAll('[data-download-papers]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.dataset.downloadPapers;
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Generando...';
        try {
          await downloadPdfBlob(`/api/productos/${encodeURIComponent(slug)}/papeles-pdf`, `MotoConnect-Papeles-${slug}.pdf`);
          toast('Expediente PDF de papeles descargado', 'success');
        } catch (err) {
          toast(err.message, 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });

    resultsBox.querySelectorAll('[data-add-cart]').forEach(button => {
      button.addEventListener('click', () => {
        const product = recState.products.find(p => p.slug === button.dataset.addCart);
        if (!product) return;
        const result = addToCart(product, {
          color: 'Estándar',
          cantidad: 1,
          imagen: productImages(product)[0] || FALLBACK_IMAGE,
        });
        if (!result.ok) {
          toast(result.message, 'warning');
          return;
        }
        toast(`${product.nombre} añadido al carrito`, 'success');
        refreshNav();
        button.innerHTML = `${icon('check', 14)} <span>Añadido</span>`;
      });
    });
  }

  root.querySelector('#btn-back')?.addEventListener('click', () => {
    if (recState.step > 0) {
      recState.step -= 1;
      renderQuestion(false);
    }
  });

  root.querySelector('#btn-restart')?.addEventListener('click', () => {
    recState.answers = { uso: null, presupuesto: null, experiencia: null, prioridad: null };
    recState.extraNote = '';
    recState.step = 0;
    root.querySelector('#recommender-results').innerHTML = '';
    renderQuestion(false);
  });

  renderQuestion(false);
}
