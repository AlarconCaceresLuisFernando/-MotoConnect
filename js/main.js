/* ============================================================
   MotoConnect — main.js
   Router de hash + arranque de la aplicación
   ============================================================ */

import { home } from './views/home.js';
import { catalog } from './views/catalog.js';
import { detail } from './views/detail.js';
import { comparator } from './views/comparator.js';
import { checkout } from './views/checkout.js';
import { orders } from './views/orders.js';
import { panel } from './views/panel.js';
import { login } from './views/login.js';
import { recommender } from './views/recommender.js';
import { initNavbar, refreshNav } from './components/navbar.js';
import { initFooter } from './components/footer.js';
import { initAiAssistant } from './components/aiAssistant.js';

const root = document.querySelector('#app-container');

function currentPath() {
  const raw = (window.location.hash || '#/').slice(1);
  const [path] = raw.split('?');
  return path || '/';
}

async function route() {
  const path = currentPath();
  root.innerHTML = '';
  window.scrollTo(0, 0);
  refreshNav();

  try {
    if (path === '/') await home(root);
    else if (path === '/catalogo') await catalog(root);
    else if (path === '/recomendador') await recommender(root);
    else if (path.startsWith('/moto/')) await detail(root, path.slice(6));
    else if (path === '/comparador') await comparator(root);
    else if (path === '/checkout') await checkout(root);
    else if (path === '/mis-pedidos') await orders(root);
    else if (path === '/panel') await panel(root);
    else if (path === '/login') await login(root);
    else {
      root.innerHTML = `
        <section class="section">
          <div class="empty-state">
            <span class="empty-icon">Pagina no encontrada</span>
            <h3>Página no encontrada</h3>
            <p>La ruta solicitada no existe o fue movida.</p>
            <a href="#/" class="btn btn-primary">Volver al Inicio</a>
          </div>
        </section>`;
    }
  } catch (error) {
    root.innerHTML = `
      <section class="section">
        <div class="empty-state">
          <span class="empty-icon">No se pudo cargar</span>
          <h3>No se pudo cargar la página</h3>
          <p>${error.message}</p>
          <a href="#/" class="btn btn-primary">Volver al Inicio</a>
        </div>
      </section>`;
  }

  refreshNav();
}

initNavbar();
initFooter();
initAiAssistant();
refreshNav();
window.addEventListener('hashchange', route);
route();
