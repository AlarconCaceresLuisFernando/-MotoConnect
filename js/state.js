/* ============================================================
 MotoConnect — state.js
 Estado global persistido en localStorage
 ============================================================ */

function read(key, fallback) {
 try {
 const value = JSON.parse(localStorage.getItem(key));
 return value ?? fallback;
 } catch {
 return fallback;
 }
}

export const state = {
 user: read('mc_user', null),
 cart: read('mc_cart', []),
 comparador: read('mc_comparador', []),
 products: [],
 orders: [],
};

export function setUser(user) {
 state.user = user;
 if (user) localStorage.setItem('mc_user', JSON.stringify(user));
 else localStorage.removeItem('mc_user');
}

export function persistCart() {
 localStorage.setItem('mc_cart', JSON.stringify(state.cart));
}

export function persistComparador() {
 localStorage.setItem('mc_comparador', JSON.stringify(state.comparador));
}

export function cartCount() {
 return state.cart.reduce((total, item) => total + Number(item.cantidad || 0), 0);
}

export function cartSubtotal() {
 return state.cart.reduce(
 (total, item) => total + Number(item.precio_usd || 0) * Number(item.cantidad || 0),
 0
 );
}

export function cartUnitsOf(productoId) {
 return state.cart
 .filter(item => Number(item.productoId) === Number(productoId))
 .reduce((total, item) => total + Number(item.cantidad || 0), 0);
}

export function clearCart() {
 state.cart = [];
 persistCart();
}

/* Normaliza carritos antiguos para que siempre exista una clave estable */
state.cart = state.cart
 .filter(item => item && (item.productoId || item.id))
 .map(item => ({
 ...item,
 productoId: Number(item.productoId || item.id),
 cantidad: Number(item.cantidad || 1),
 key: item.key || `${Number(item.productoId || item.id)}::${item.color || 'Estándar'}`,
 }));

export function addToCart(product, options = {}) {
 const color = options.color || 'Estándar';
 const cantidad = Number(options.cantidad || 1);
 const stock = Number(product.stock_disponible ?? 0);

 if (stock <= 0) return { ok: false, message: 'Producto agotado' };

 const units = cartUnitsOf(product.id);
 if (units + cantidad > stock) {
 return { ok: false, message: `Solo hay ${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'}` };
 }

 const key = `${product.id}::${color}`;
 const existing = state.cart.find(item => item.key === key);
 if (existing) {
 existing.cantidad += cantidad;
 existing.stock = stock;
 } else {
 state.cart.push({
 key,
 productoId: Number(product.id),
 slug: product.slug,
 nombre: product.nombre,
 color,
 cantidad,
 precio_usd: Number(product.precio_usd),
 imagen: options.imagen || '',
 stock,
 });
 }
 persistCart();
 return { ok: true };
}
