/* ============================================================
 MotoConnect — views/login.js (#/login)
 Formulario elegante + acceso rápido por rol en 1 clic
 ============================================================ */

import { api } from '../api.js';
import { DEMO_USERS, OPERATIVE_ROLES, ROL_LABELS } from '../config.js';
import { setUser } from '../state.js';
import { esc, toast } from '../utils.js';
import { refreshNav } from '../components/navbar.js';

export async function login(root) {
 root.innerHTML = `
 <section class="login-wrap">
 <div class="login-card" style="max-width:480px;margin:3rem auto;padding:2.5rem;border-radius:14px">
 <div class="login-logo">
 <span class="nav-logo">MOTO<span>CONNECT</span></span>
 </div>
 <h1 class="login-title">Acceso al Sistema</h1>
 <p class="login-subtitle">Ingresa con tus credenciales o usa el acceso rápido por rol</p>

 <form class="login-form" id="login-form" autocomplete="on">
 <div class="form-group">
 <label for="login-email">Correo Electrónico *</label>
 <input type="email" id="login-email" name="email" placeholder="usuario@motoconnect.com" required autocomplete="username" />
 </div>
 <div class="form-group">
 <label for="login-password">Contraseña *</label>
 <input type="password" id="login-password" name="password" placeholder="••••••" value="123456" required autocomplete="current-password" />
 </div>
 <div class="login-error" id="login-error" role="alert"></div>
 <button type="submit" class="btn btn-primary w-full" id="login-submit">Ingresar</button>
 </form>

 <div class="demo-creds">
 <h4>Acceso rápido por rol · 1 clic</h4>
 <div class="role-quick-grid">
 ${DEMO_USERS.map(user => `
 <button type="button" class="role-quick-card" data-quick-login="${esc(user.email)}">
 <span style="display:flex;flex-direction:column;gap:2px;min-width:0">
 <span style="font-weight:700;font-size:0.88rem;color:var(--text-primary)">${esc(user.nombre)}</span>
 <span style="font-size:0.75rem;color:var(--text-muted)">${esc(user.cargo)}</span>
 </span>
 <span class="role-badge">${esc(ROL_LABELS[user.rol] || user.rol)}</span>
 </button>
 `).join('')}
 </div>
 </div>
 </div>
 </section>
 `;

 const errorBox = root.querySelector('#login-error');
 const submitButton = root.querySelector('#login-submit');

 function showError(message) {
 if (!errorBox) return;
 errorBox.textContent = message;
 errorBox.classList.add('show');
 }

 async function signIn(email, password) {
 const user = await api('/auth/login', { method: 'POST', body: { email, password } });
 setUser(user);
 refreshNav();
 toast(`Bienvenido, ${user.nombre}`, 'success');
 location.hash = OPERATIVE_ROLES.includes(user.rol) ? '#/panel' : '#/catalogo';
 }

 root.querySelector('#login-form')?.addEventListener('submit', async event => {
 event.preventDefault();
 errorBox.classList.remove('show');
 const email = root.querySelector('#login-email').value.trim();
 const password = root.querySelector('#login-password').value;

 if (!email || !password) {
 showError('Ingresa tu correo y contraseña.');
 return;
 }

 submitButton.disabled = true;
 submitButton.textContent = 'Verificando...';
 try {
 await signIn(email, password);
 } catch (error) {
 showError(error.message);
 submitButton.disabled = false;
 submitButton.textContent = 'Ingresar';
 }
 });

 root.querySelectorAll('[data-quick-login]').forEach(button => {
 button.addEventListener('click', async () => {
 const demo = DEMO_USERS.find(user => user.email === button.dataset.quickLogin);
 if (!demo) return;
 button.disabled = true;
 button.style.opacity = '0.6';
 try {
 await signIn(demo.email, demo.password);
 } catch (error) {
 showError(error.message);
 button.disabled = false;
 button.style.opacity = '';
 }
 });
 });
}
