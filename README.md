# MotoConnect — Plataforma E-commerce Automotriz Full-Stack

> **Concesionario Digital de Motocicletas y Equipamiento Certificado**
> SPA multi-vista en HTML, CSS y JavaScript ES Modules con backend Node.js + Express y persistencia real en SQLite (`node:sqlite` / `DatabaseSync`) con migraciones idempotentes, seguridad RBAC por roles, pagos verificables, inspección PDI de 40 puntos y acta de entrega con firma digital.

---

## Inicio Rápido

### 1. Requisitos Previos
- **Node.js**: v22.0.0 o superior (utiliza `node:sqlite` integrado sin compilación nativa C++).
- **NPM**: v9.0.0 o superior.

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Variables de Entorno
Copia `.env.example` a `.env` si deseas configurar integraciones externas:
```bash
cp .env.example .env
```
- `PORT`: Puerto del servidor (por defecto `3000`).
- `DEMO_MODE`: `true` en desarrollo/presentación académica (habilita selector rápido en login) o `false` en producción.
- `PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: Credenciales para captura verificada PayPal REST API v2 y Pago con Tarjeta (Visa/Mastercard).
- `WHATSAPP_NUMBER`: Número de contacto WhatsApp para atención comercial (`+59167671435`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Credenciales SMTP opcionales (`nodemailer`) para envío automático por correo del expediente PDF de papeles oficiales al comprador.
- `GROQ_API_KEY`: Opcional para el Soporte al Cliente y Asesor IA (si no se define, opera con soporte inteligente sobre inventario real en SQLite).

### 4. Ejecución del Servidor
```bash
npm start
```
El servidor inicia en **`http://localhost:3000`** y crea/migra automáticamente `./database/motoconnect.sqlite` preservando todos los registros existentes (y generando respaldo previo en `./database/backups/` antes de cada migración pendiente).

---

## Credenciales y Roles del Sistema

Las contraseñas se almacenan con hash seguro `crypto.scrypt`. En entorno inicial (`seed`), los usuarios de demostración utilizan contraseña `123456`:

| Rol | Correo Electrónico | Cargo / Descripción |
| :--- | :--- | :--- |
| **CLIENTE** | `cliente@motoconnect.com` | Carlos Mendoza — Cliente Verificado |
| **VERIFICADOR_PAGOS** | `pagos@motoconnect.com` | Laura Rojas — Oficial de Cobranzas y Caja |
| **ALMACEN_EMPAQUE** | `almacen@motoconnect.com` | Marco Quispe — Jefe de Almacén y Empaque PDI |
| **DESPACHO_ENTREGA** | `entrega@motoconnect.com` | Diego Vargas — Coordinador de Despacho y Entrega |
| **ADMIN** | `admin@motoconnect.com` | Administrador General Concesionario |

---

## Arquitectura Técnica

- **Frontend (`/index.html`, `/styles.css`, `/js/*`)**: SPA con Hash Router (`#/`, `#/catalogo`, `#/moto/:slug`, `#/recomendador`, `#/comparador`, `#/checkout`, `#/mis-pedidos`, `#/panel`, `#/login`).
- **Backend (`/server.js`, `/db.js`, `/lib/*`)**: Express REST API con autenticación por token/cookie `HttpOnly` (`sesiones`), autorización estricta por rol (RBAC), cálculo autoritativo de precios/totales en servidor, generación de expedientes PDF (`pdfkit`), envío SMTP (`nodemailer`), carga de archivos (`multer`) y auditoría (`auditoria_operaciones`).
- **Base de datos (`./database/motoconnect.sqlite`)**: Tablas `productos`, `usuarios`, `pedidos`, `sesiones`, `auditoria_operaciones`, `paypal_intents` y `schema_migrations`.

---

## Flujo Operativo de Pedidos, Papeles y Catálogo

1. **Registro de Orden y Pago**:
   - **PayPal / Tarjeta (Visa / Mastercard)**: `POST /api/payments/paypal/create-order` + `POST /api/payments/paypal/capture-order` verifican monto/moneda/estado en PayPal, previenen repetición y descuentan inventario atómicamente (`VERIFICADO` / `LISTO_PARA_PREPARAR`).
   - **Pago con QR**: Registra el pedido con comprobante en `./private_uploads` en estado `EN_REVISION` / `ESPERANDO_PAGO` (sin descontar stock hasta aprobación).
2. **Papeles Oficiales en PDF y Envío al Correo**:
   - Cada motocicleta dispone de su expediente oficial en PDF (`GET /api/productos/:slug/papeles-pdf`) con ficha técnica, Factura, DUA/Póliza de Importación, RUAT, SOAT, PDI y Garantía, además del documento oficial adjunto por administración (`GET /api/productos/:slug/documento-oficial`).
   - Cada compra genera el expediente completo de orden + papeles (`GET /api/pedidos/:id/documentos-pdf`) y permite enviarlo por correo (`POST /api/pedidos/:id/enviar-documentos`).
3. **Gestor de Catálogo Sin Código (`ADMIN` / `ALMACEN_EMPAQUE`)**:
   - Pestaña **Catálogo y Papeles** en `#/panel` (`POST /api/productos` y `PUT /api/productos/:id`) para crear y editar motocicletas con imagen y documento PDF oficial sin tocar código.
4. **Verificación, PDI 40 pts y Entrega Certificada**:
   - Cobranzas aprueba/rechaza (`PATCH /api/pedidos/:id/aprobar-pago` / `rechazar-pago`), Almacén ejecuta el checklist PDI de 40 puntos con VIN y `PKG-` únicos, y Despacho cierra con firma digital PNG y Certificado Digital imprimible.

