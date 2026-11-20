import { API } from './config.js';
export async function api(path, options = {}) {
 const headers = new Headers(options.headers || {});
 let body = options.body;
 if (body && !(body instanceof FormData)) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(body); }
 const response = await fetch(API + path, { ...options, headers, body, cache: 'no-store' });
 const data = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
 return data;
}
