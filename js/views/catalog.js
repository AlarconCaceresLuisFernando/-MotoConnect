/* ============================================================
   MotoConnect — views/catalog.js (#/catalogo)
   Catálogo filtrable conectado al inventario SQLite
   ============================================================ */

import { api } from '../api.js';
import { BS_RATE } from '../config.js';
import { state } from '../state.js';
import { esc, icon } from '../utils.js';
import { productCard, bindProductCards, bindAddToCart } from '../components/productCard.js';

function queryParams() {
  const hash = window.location.hash || '';
  const index = hash.indexOf('?');
  return new URLSearchParams(index >= 0 ? hash.slice(index + 1) : '');
}

export async function catalog(root) {
  const params = queryParams();

  root.innerHTML = `
    <div class="page-header">
      <div class="page-header-inner">
        <h1>Catálogo de Motocicletas y Equipamiento</h1>
        <p>Disponibilidad en tiempo real, precios en Bolivianos (Bs) y referencia en USD</p>
      </div>
    </div>
    <div class="section">
      <div class="filter-bar">
        <div class="filter-group" style="flex:2;min-width:220px">
          <label for="f-search" style="display:inline-flex;align-items:center;gap:6px">${icon('search', 14)} Buscar</label>
          <input type="search" id="f-search" placeholder="Nombre o marca..." value="${esc(params.get('q') || '')}" />
        </div>
        <div class="filter-group">
          <label for="f-marca">Marca</label>
          <select id="f-marca"><option value="">Todas las marcas</option></select>
        </div>
        <div class="filter-group">
          <label for="f-categoria">Categoría</label>
          <select id="f-categoria">
            <option value="">Todas las categorías</option>
            ${['Trabajo', 'Urbana', 'Naked', 'Adventure', 'Supersport', 'Equipamiento'].map(cat => `<option value="${cat}" ${(params.get('cat') || '').toLowerCase() === cat.toLowerCase() ? 'selected' : ''}>${cat}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="f-price-range">Precio (Bs)</label>
          <select id="f-price-range">
            <option value="all">Todos los precios</option>
            <option value="0-15000">Hasta Bs 15.000</option>
            <option value="15000-30000">Bs 15.000 - Bs 30.000</option>
            <option value="30000-999999">Más de Bs 30.000</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="f-sort">Ordenar por</label>
          <select id="f-sort">
            <option value="destacados">Destacados</option>
            <option value="precio_asc">Menor precio</option>
            <option value="precio_desc">Mayor precio</option>
            <option value="cc_desc">Mayor cilindrada</option>
          </select>
        </div>
        <div class="filter-group" style="justify-content:flex-end">
          <div class="toggle-wrap" style="margin-top:22px">
            <input type="checkbox" class="toggle" id="f-stock" ${params.get('stock') ? 'checked' : ''} />
            <label class="toggle-label" for="f-stock">Solo con stock</label>
          </div>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <span id="results-count" class="text-muted" style="font-size:0.88rem"></span>
        <a href="#/comparador" class="btn btn-outline btn-sm">${icon('compare', 15)} <span>Ir al Comparador</span></a>
      </div>

      <div class="products-grid" id="catalog-grid">
        <div class="spinner-wrap" style="grid-column:1/-1"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  const grid = root.querySelector('#catalog-grid');
  bindProductCards(grid);
  bindAddToCart(grid, id => state.products.find(product => String(product.id) === String(id)));

  let products = [];
  try {
    products = await api('/productos');
    state.products = products;
  } catch (error) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">${icon('alert', 44)}</span><h3>Error al cargar productos</h3><p>${esc(error.message)}</p></div>`;
    return;
  }

  const marcas = [...new Set(products.map(product => product.marca).filter(Boolean))].sort();
  const marcaSelect = root.querySelector('#f-marca');
  marcas.forEach(marca => {
    const option = document.createElement('option');
    option.value = marca;
    option.textContent = marca;
    if ((params.get('marca') || '').toLowerCase() === marca.toLowerCase()) option.selected = true;
    marcaSelect.appendChild(option);
  });

  function resetFilters() {
    root.querySelector('#f-search').value = '';
    root.querySelector('#f-marca').value = '';
    root.querySelector('#f-categoria').value = '';
    root.querySelector('#f-price-range').value = 'all';
    root.querySelector('#f-sort').value = 'destacados';
    root.querySelector('#f-stock').checked = false;
    applyFilters();
  }

  function applyFilters() {
    const search = root.querySelector('#f-search').value.trim().toLowerCase();
    const marca = root.querySelector('#f-marca').value;
    const categoria = root.querySelector('#f-categoria').value;
    const range = root.querySelector('#f-price-range').value;
    const sort = root.querySelector('#f-sort').value;
    const onlyStock = root.querySelector('#f-stock').checked;

    let filtered = products.filter(product => {
      if (search && !`${product.nombre} ${product.marca} ${product.categoria}`.toLowerCase().includes(search)) return false;
      if (marca && product.marca !== marca) return false;
      if (categoria && String(product.categoria).toLowerCase() !== categoria.toLowerCase()) return false;
      const priceBs = Number(product.precio_usd) * BS_RATE;
      if (range !== 'all') {
        const [min, max] = range.split('-').map(Number);
        if (priceBs < min || priceBs > max) return false;
      }
      if (onlyStock && Number(product.stock_disponible) <= 0) return false;
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sort === 'precio_asc') return Number(a.precio_usd) - Number(b.precio_usd);
      if (sort === 'precio_desc') return Number(b.precio_usd) - Number(a.precio_usd);
      if (sort === 'cc_desc') return Number(b.cilindrada_cc || 0) - Number(a.cilindrada_cc || 0);
      return Number(b.destacado || 0) - Number(a.destacado || 0);
    });

    root.querySelector('#results-count').textContent =
      `${filtered.length} producto${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length) {
      grid.innerHTML = filtered.map(productCard).join('');
    } else {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <span class="empty-icon">${icon('search', 44)}</span>
          <h3>Sin resultados</h3>
          <p>No encontramos productos que coincidan con los filtros actuales.</p>
          <button type="button" class="btn btn-primary" id="btn-reset-filters">Restablecer filtros</button>
        </div>`;
      grid.querySelector('#btn-reset-filters')?.addEventListener('click', resetFilters);
    }
  }

  ['f-search', 'f-marca', 'f-categoria', 'f-sort', 'f-stock', 'f-price-range'].forEach(id => {
    const element = root.querySelector(`#${id}`);
    element.addEventListener('input', applyFilters);
    element.addEventListener('change', applyFilters);
  });

  applyFilters();
}
