/* ============================================================
   MotoConnect — views/comparator.js (#/comparador)
   Comparación técnica lado a lado de hasta 3 modelos
   ============================================================ */

import { api } from '../api.js';
import { BS_RATE } from '../config.js';
import { state, persistComparador } from '../state.js';
import { fmt, esc, productImages, toast, icon } from '../utils.js';
import { refreshNav } from '../components/navbar.js';

const ROWS = [
  { label: 'Precio (Bs)', field: 'precio_usd', format: value => `Bs ${fmt(Number(value) * BS_RATE)}`, numeric: true, best: 'min' },
  { label: 'Referencia USD', field: 'precio_usd', format: value => `$${fmt(value)} USD` },
  { label: 'Marca', field: 'marca' },
  { label: 'Categoría', field: 'categoria' },
  { label: 'Año', field: 'anio', numeric: true },
  { label: 'Cilindrada', field: 'cilindrada_cc', format: value => `${value} cc`, numeric: true, best: 'max' },
  { label: 'Potencia', field: 'potencia_hp', numeric: true, best: 'max' },
  { label: 'Torque', field: 'torque_nm', numeric: true, best: 'max' },
  { label: 'Peso', field: 'peso_kg', format: value => `${value} kg`, numeric: true, best: 'min' },
  { label: 'Tanque', field: 'tanque_litros', format: value => `${value} L`, numeric: true },
  { label: 'Consumo', field: 'consumo_kml', numeric: true, best: 'max' },
  { label: 'Velocidad máxima', field: 'velocidad_max', numeric: true, best: 'max' },
  { label: 'Frenos', field: 'frenos' },
  { label: 'Suspensión', field: 'suspension' },
];

function numericValue(product, field) {
  const parsed = parseFloat(String(product[field] ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyMarkup() {
  return `
    <div class="comparador-empty">
      <span class="empty-icon" style="display:flex;justify-content:center;color:var(--text-muted)">${icon('compare', 48)}</span>
      <h3>Aún no hay modelos en el comparador</h3>
      <p style="color:var(--text-muted);margin:12px 0 24px">Agrega entre 2 y 3 motocicletas desde el catálogo con el botón “Comparar”.</p>
      <a href="#/catalogo" class="btn btn-primary">${icon('layers', 16)} <span>Ir al Catálogo</span></a>
    </div>`;
}

export async function comparator(root) {
  root.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner"><h1>Comparador de Modelos</h1><p>Compara hasta 3 motocicletas lado a lado</p></div>
    </div>
    <div class="section"><div id="comparador-content"><div class="spinner-wrap"><div class="spinner"></div></div></div></div>
  `;

  const content = root.querySelector('#comparador-content');

  if (state.comparador.length === 0) {
    content.innerHTML = emptyMarkup();
    return;
  }

  let products = [];
  try {
    const all = await api('/productos');
    products = state.comparador
      .map(slug => all.find(product => product.slug === slug))
      .filter(Boolean);
  } catch (error) {
    content.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('alert', 44)}</span><h3>Error</h3><p>${esc(error.message)}</p></div>`;
    return;
  }

  if (products.length === 0) {
    state.comparador = [];
    persistComparador();
    refreshNav();
    content.innerHTML = emptyMarkup();
    return;
  }

  function render() {
    if (!products.length) {
      content.innerHTML = emptyMarkup();
      return;
    }

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap">
        <span class="text-muted" style="font-size:0.88rem">${products.length} de 3 espacios ocupados</span>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${products.length < 3 ? `<a href="#/catalogo" class="btn btn-outline btn-sm">${icon('layers', 14)} <span>Agregar otro modelo</span></a>` : ''}
          <button type="button" class="btn btn-secondary btn-sm" id="clear-compare">${icon('x', 14)} <span>Limpiar Comparador</span></button>
        </div>
      </div>
      <div class="comparador-table-wrap">
        <table class="comparador-table">
          <thead>
            <tr>
              <th style="background:var(--bg-elevated)">Especificación</th>
              ${products.map(product => {
                const image = productImages(product)[0] || '/images/productos/placeholder.svg';
                return `
                  <th class="product-header-cell">
                    <div class="comparador-product-header">
                      <img src="${esc(image)}" alt="${esc(product.nombre)}" onerror="this.src='/images/productos/placeholder.svg'" />
                      <strong style="font-size:0.9rem;line-height:1.3">${esc(product.nombre)}</strong>
                      <div style="font-size:0.75rem;color:var(--text-muted)">${esc(product.marca)} · ${product.anio || ''}</div>
                      <div style="display:flex;gap:6px">
                        <a href="#/moto/${esc(product.slug)}" class="btn btn-primary btn-sm">Ver Ficha</a>
                        <button type="button" class="btn btn-secondary btn-sm" data-remove="${esc(product.slug)}">Quitar</button>
                      </div>
                    </div>
                  </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${ROWS.map(row => {
              let bestValue = null;
              if (row.best) {
                const values = products.map(product => numericValue(product, row.field)).filter(value => value !== null);
                if (values.length > 1) bestValue = row.best === 'max' ? Math.max(...values) : Math.min(...values);
              }
              return `
                <tr>
                  <th>${row.label}</th>
                  ${products.map(product => {
                    const value = product[row.field];
                    const display = value === null || value === undefined || value === ''
                      ? '—'
                      : row.format ? row.format(value) : value;
                    const isBest = bestValue !== null && numericValue(product, row.field) === bestValue;
                    return `<td class="${isBest ? 'best' : ''}">${esc(display)}</td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    content.querySelector('#clear-compare')?.addEventListener('click', () => {
      state.comparador = [];
      products = [];
      persistComparador();
      refreshNav();
      render();
    });

    content.querySelectorAll('[data-remove]').forEach(button => {
      button.addEventListener('click', () => {
        state.comparador = state.comparador.filter(slug => slug !== button.dataset.remove);
        products = products.filter(product => product.slug !== button.dataset.remove);
        persistComparador();
        refreshNav();
        toast('Modelo quitado del comparador', 'info');
        render();
      });
    });
  }

  render();
}
