/* ============================================================
   MotoConnect — api.js
   Cliente HTTP con soporte de token Bearer y cookies HttpOnly
   ============================================================ */

import { API } from './config.js';
import { state, setUser } from './state.js';

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${state.token}`);
  }

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (typeof body !== 'string') {
      body = JSON.stringify(body);
    }
  }

  const timeoutMs = Number(options.timeoutMs || 30000);
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(API + path, {
      ...options,
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal || controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con el servidor.');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && path !== '/auth/login' && state.user) {
    setUser(null);
    window.dispatchEvent(new CustomEvent('mc:auth-expired'));
  }

  if (!response.ok) {
    const err = new Error(data.error || data.message || `Error ${response.status}`);
    err.status = response.status;
    err.code = data.code || null;
    throw err;
  }

  return data;
}
