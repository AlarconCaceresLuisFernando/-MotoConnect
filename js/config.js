/* ============================================================
 MotoConnect — config.js
 Constantes compartidas, roles y usuarios de demostración
 ============================================================ */

export const API = '/api';
export const BS_RATE = 6.96;

export const ROL_LABELS = {
 CLIENTE: 'Cliente',
 VERIFICADOR_PAGOS: 'Verificador de Pagos',
 ALMACEN_EMPAQUE: 'Almacén y Empaque',
 DESPACHO_ENTREGA: 'Despacho y Entrega',
 ADMIN: 'Administrador',
};

export const OPERATIVE_ROLES = [
 'VERIFICADOR_PAGOS',
 'ALMACEN_EMPAQUE',
 'DESPACHO_ENTREGA',
 'ADMIN',
];

export const DEMO_USERS = [
 {
 email: 'cliente@motoconnect.com',
 password: '123456',
 rol: 'CLIENTE',
 nombre: 'Carlos Mendoza',
 cargo: 'Cliente Verificado',
 },
 {
 email: 'pagos@motoconnect.com',
 password: '123456',
 rol: 'VERIFICADOR_PAGOS',
 nombre: 'Laura Rojas',
 cargo: 'Oficial de Cobranzas y Caja',
 },
 {
 email: 'almacen@motoconnect.com',
 password: '123456',
 rol: 'ALMACEN_EMPAQUE',
 nombre: 'Marco Quispe',
 cargo: 'Jefe de Almacén y Empaque PDI',
 },
 {
 email: 'entrega@motoconnect.com',
 password: '123456',
 rol: 'DESPACHO_ENTREGA',
 nombre: 'Diego Vargas',
 cargo: 'Coordinador de Despacho y Entrega',
 },
 {
 email: 'admin@motoconnect.com',
 password: '123456',
 rol: 'ADMIN',
 nombre: 'Administrador General',
 cargo: 'Administrador General Concesionario',
 },
];

export const PAYMENT_LABELS = {
 EN_REVISION: 'En revisión',
 VERIFICADO: 'Verificado',
 RECHAZADO: 'Rechazado',
};

export const LOGISTIC_LABELS = {
 ESPERANDO_PAGO: 'Esperando pago',
 LISTO_PARA_PREPARAR: 'Listo para preparar',
 EN_PREPARACION_PDI: 'En preparación PDI',
 EMPACADO_LISTO_DESPACHO: 'Empacado · listo para despacho',
 EN_RUTA_ENTREGA: 'En ruta de entrega',
 ENTREGADO_FINALIZADO: 'Entregado y finalizado',
 CANCELADO: 'Cancelado',
};

export const METHOD_LABELS = {
 PAYPAL: 'PayPal',
 QR_BANCARIO: 'QR Bancario',
 DEPOSITO_BANCARIO: 'Depósito Bancario',
};

export const CITY_LIST = [
 'La Paz', 'Santa Cruz', 'Cochabamba', 'Sucre', 'Oruro',
 'Potosí', 'Tarija', 'Beni', 'Pando',
];
