# MotoConnect — Plataforma E-commerce Automotriz Full-Stack 🏍️⚡

> **Concesionario Oficial Digital de Motocicletas Premium y Equipamiento Certificado**  
> Aplicación web comercial de nivel de producción con arquitectura SPA multi-página, backend en Node.js + Express y base de datos relacional SQLite real con inicialización automática, gestión de inventario atómica y ciclo logístico completo por roles con firma digital en canvas.

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
- **Node.js**: v18.0.0 o superior (compatible y probado en Node v24 LTS).
- **NPM**: v9.0.0 o superior.

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Ejecución del Servidor
```bash
npm start
```
o bien:
```bash
node server.js
```

El servidor iniciará automáticamente en:
👉 **`http://localhost:3000`**

Al arrancar por primera vez, el servidor crea automáticamente el directorio `./database/`, inicializa la base de datos relacional `./database/motoconnect.sqlite`, aplica las tablas con claves foráneas y restricciones `CHECK`, y puebla el catálogo inicial con 8 productos reales y 5 usuarios oficiales.

---

## 👥 Credenciales de Acceso y Roles Oficiales

Puedes iniciar sesión manualmente en `#/login` o usar el selector rápido de usuario en la barra superior:

| Rol | Correo Electrónico | Contraseña | Cargo / Descripción |
| :--- | :--- | :--- | :--- |
| **CLIENTE** | `cliente@motoconnect.com` | `123456` | Carlos Mendoza — Cliente Verificado |
| **VERIFICADOR_PAGOS** | `pagos@motoconnect.com` | `123456` | Laura Rojas — Oficial de Cobranzas y Caja |
| **ALMACEN_EMPAQUE** | `almacen@motoconnect.com` | `123456` | Marco Quispe — Jefe de Almacén y Empaque PDI |
| **DESPACHO_ENTREGA** | `entrega@motoconnect.com` | `123456` | Diego Vargas — Coordinador de Despacho y Entrega |
| **ADMIN** | `admin@motoconnect.com` | `123456` | Administrador General Concesionario |

---

## 🏗️ Arquitectura Técnica

```
┌────────────────────────────────────────────────────────┐
│             FRONTEND: SPA Multi-Página                │
│  Hash Router: #/ · #/catalogo · #/moto/:slug          │
│  #/comparador · #/checkout · #/mis-pedidos            │
│  #/panel · #/login                                    │
│  Librerías: PayPal JS SDK, QRCode.js, Canvas Firma     │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / FormData)
┌───────────────────────────▼────────────────────────────┐
│             BACKEND: Node.js + Express                 │
│  Puerto 3000 · CORS · Multer (Upload Comprobantes)     │
│  Control de transacciones atómicas de stock            │
└───────────────────────────┬────────────────────────────┘
                            │ better-sqlite3 (WAL Mode)
┌───────────────────────────▼────────────────────────────┐
│      BASE DE DATOS: ./database/motoconnect.sqlite      │
│  Tablas: productos · usuarios · pedidos               │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Inventario Inicial de Fábrica (SQLite)

1. **Yamaha MT-07 2026** — *Naked (689 cc / 73.4 HP)* — Stock: **4 unidades** — `$7,990 USD`
2. **Honda CBR650R E-Clutch 2026** — *Supersport (649 cc / 95 HP)* — Stock: **2 unidades** — `$9,450 USD`
3. **Kawasaki Z900 SE 2026** — *Naked (948 cc / 125 HP / Öhlins)* — Stock: **3 unidades** — `$10,200 USD`
4. **BMW F 900 GS Trophy 2026** — *Adventure (895 cc / 105 HP)* — Stock: **1 unidad** — `$14,800 USD`
5. **KTM 390 Duke Gen-3 2026** — *Naked (399 cc / 46 HP)* — Stock: **5 unidades** — `$5,290 USD`
6. **Ducati Monster SP 2026** — *Naked (937 cc / 111 HP)* — Stock: **0 unidades** (Agotada — Demostración de bloqueo de compra) — `$16,900 USD`
7. **Casco Integral AGV K6 S Carbon** — *Accesorio FIM Racing* — Stock: **10 unidades** — `$890 USD`
8. **Chaqueta Alpinestars GP Plus R v4** — *Accesorio Cuero CE Nivel 2* — Stock: **7 unidades** — `$650 USD`

---

## 🔄 Flujo Logístico de Pedidos de Extremo a Extremo

1. **Compra / Registro del Pedido**:
   - **PayPal**: Valida stock en SQLite, descuenta unidades de forma atómica y pasa inmediatamente a `LISTO_PARA_PREPARAR` con estado de pago `VERIFICADO`.
   - **QR Bancario / Depósito**: Genera QR oficial descargable con datos del Banco BISA S.A., recibe imagen del comprobante y registra el pedido en `EN_REVISION` / `ESPERANDO_PAGO`.
2. **Verificación de Cobranzas (`VERIFICADOR_PAGOS`)**:
   - Inspecciona el comprobante subido en alta resolución.
   - Al aprobar, verifica stock disponible en tiempo real, descuenta el inventario en SQLite y envía la orden a Almacén.
3. **Inspección PDI y Empaque (`ALMACEN_EMPAQUE`)**:
   - Asigna número de chasis / VIN único homologado.
   - Valida el checklist obligatorio PDI de 40 puntos (fluidos, electrónica OBD, torque de ejes, embalaje y llaves).
   - Asigna código de precinto de empaque (`PKG-2026-XXX`) y avanza a `EMPACADO_LISTO_DESPACHO`.
4. **Despacho y Entrega Final (`DESPACHO_ENTREGA`)**:
   - Despacha a ruta de entrega (`EN_RUTA_ENTREGA`).
   - Registra el acta de entrega final con nombre y carnet del receptor, capturando la **firma digital interactiva en `<canvas>`**.
   - Cierra el ciclo en `ENTREGADO_FINALIZADO` y genera el **Certificado Oficial de Entrega y Garantía** imprimible.
5. **Gestión Administrativa (`ADMIN`)**:
   - Acceso unificado a todas las áreas operativas.
   - Pestaña de reabastecimiento de inventario en vivo (`PATCH /api/productos/:id/stock`).

---

## 📡 Endpoints de la API REST

- `GET /api/productos` — Catálogo con soporte de filtros query (`marca`, `categoria`, `q`, `soloStock`).
- `GET /api/productos/:slug` — Ficha técnica individual de producto.
- `POST /api/productos` — Creación de nuevo producto en catálogo.
- `PATCH /api/productos/:id/stock` — Actualización o reabastecimiento de stock en SQLite.
- `POST /api/auth/login` — Autenticación de usuarios por correo y contraseña.
- `GET /api/pedidos` — Listado de pedidos (filtrable por `email` o `estado`).
- `POST /api/pedidos/paypal` — Registro con captura de PayPal y descuento atómico de inventario.
- `POST /api/pedidos/bancario` — Registro con comprobante de pago (`multipart/form-data`).
- `PATCH /api/pedidos/:id/aprobar-pago` — Aprobación y descuento de stock en SQLite.
- `PATCH /api/pedidos/:id/rechazar-pago` — Rechazo con motivo registrado.
- `PATCH /api/pedidos/:id/preparar-empaque` — Asignación de VIN, checklist PDI y código de empaque.
- `PATCH /api/pedidos/:id/en-ruta` — Cambio de estado a en ruta de distribución.
- `PATCH /api/pedidos/:id/entregar` — Cierre de entrega con firma digital base64 y receptor.

---

## 🎨 Paleta de Colores (Motorsport Luxury)
- **Fondo Principal**: `#090C10` (Obsidian Carbon)
- **Superficie de Tarjetas**: `#11161F` (Borde `#1E293B`)
- **Superficie Elevada**: `#18202C`
- **Primario / Acción**: `#F95715` (Racing Tangerine) / Hover: `#E0480B`
- **Técnico / Telemetría**: `#0EA5E9` (Telemetry Blue)
- **Semánticos**: `#10B981` (Éxito), `#F59E0B` (Atención), `#EF4444` (Alerta)
- **Tipografías**: *Plus Jakarta Sans* y *JetBrains Mono*
