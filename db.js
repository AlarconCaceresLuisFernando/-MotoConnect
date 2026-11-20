// ============================================================
// MotoConnect — db.js
// Real SQLite persistence (node:sqlite) + safe idempotent migrations
// ============================================================

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_DIR = path.resolve(__dirname, 'database');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const DB_PATH = path.join(DB_DIR, 'motoconnect.sqlite');

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const dbAlreadyExists = fs.existsSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// ─────────────────────────────────────────────
// Password hashing (Node built-in crypto.scrypt)
// ─────────────────────────────────────────────
function hashPassword(plainText) {
  if (typeof plainText === 'string' && plainText.startsWith('scrypt$')) {
    return plainText;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plainText), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(plainText, stored) {
  if (!stored || typeof plainText !== 'string') return false;
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    const derived = crypto.scryptSync(plainText, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }
  return plainText === stored;
}

// ─────────────────────────────────────────────
// Transaction helper
// ─────────────────────────────────────────────
function runTransaction(fn) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {
      /* ignore rollback error */
    }
    throw err;
  }
}

// ─────────────────────────────────────────────
// Base Schema (non-destructive)
// ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    marca TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK(categoria IN ('Naked','Supersport','Adventure','Sport Touring','Accesorio','Trabajo','Urbana','Equipamiento')),
    anio INTEGER NOT NULL,
    precio_usd REAL NOT NULL,
    stock_disponible INTEGER NOT NULL DEFAULT 0 CHECK(stock_disponible >= 0),
    cilindrada_cc INTEGER,
    potencia_hp TEXT,
    torque_nm TEXT,
    transmision TEXT,
    peso_kg INTEGER,
    tanque_litros REAL,
    consumo_kml TEXT,
    velocidad_max TEXT,
    frenos TEXT,
    suspension TEXT,
    electronica TEXT,
    colores_json TEXT,
    imagenes_json TEXT,
    descripcion TEXT,
    destacado INTEGER DEFAULT 0,
    documento_papeles_url TEXT,
    documento_papeles_nombre TEXT,
    homologacion_notas TEXT
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL CHECK(rol IN ('CLIENTE','VERIFICADOR_PAGOS','ALMACEN_EMPAQUE','DESPACHO_ENTREGA','ADMIN')),
    cargo_etiqueta TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_orden TEXT UNIQUE NOT NULL,
    cliente_nombre TEXT NOT NULL,
    cliente_email TEXT NOT NULL,
    cliente_telefono TEXT NOT NULL,
    cliente_ci TEXT NOT NULL,
    direccion_entrega TEXT NOT NULL,
    ciudad TEXT NOT NULL,
    items_json TEXT NOT NULL,
    subtotal_usd REAL NOT NULL,
    impuestos_tramite_usd REAL NOT NULL,
    total_usd REAL NOT NULL,
    metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('PAYPAL','TARJETA','QR_BANCARIO','DEPOSITO_BANCARIO')),
    estado_pago TEXT NOT NULL CHECK(estado_pago IN ('EN_REVISION','VERIFICADO','RECHAZADO')),
    referencia_pago TEXT,
    comprobante_url TEXT,
    motivo_rechazo TEXT,
    estado_logistico TEXT NOT NULL CHECK(estado_logistico IN ('ESPERANDO_PAGO','LISTO_PARA_PREPARAR','EN_PREPARACION_PDI','EMPACADO_LISTO_DESPACHO','EN_RUTA_ENTREGA','ENTREGADO_FINALIZADO','CANCELADO')),
    vin_asignado TEXT,
    checklist_pdi_json TEXT,
    codigo_empaque TEXT,
    notas_almacen TEXT,
    responsable_pagos TEXT,
    responsable_empaque TEXT,
    receptor_nombre TEXT,
    receptor_ci TEXT,
    firma_entrega_base64 TEXT,
    responsable_entrega TEXT,
    fecha_creacion TEXT NOT NULL,
    fecha_pago_verificado TEXT,
    fecha_empacado TEXT,
    fecha_entrega TEXT
  );
`);

// ─────────────────────────────────────────────
// Seed ONLY when tables are empty (preserves existing data)
// ─────────────────────────────────────────────
function seedIfEmpty() {
  const prodCount = db.prepare('SELECT COUNT(*) AS count FROM productos').get().count;
  if (prodCount === 0) {
    const insertProducto = db.prepare(`
      INSERT INTO productos (
        slug, nombre, marca, categoria, anio, precio_usd, stock_disponible,
        cilindrada_cc, potencia_hp, torque_nm, transmision, peso_kg, tanque_litros,
        consumo_kml, velocidad_max, frenos, suspension, electronica,
        colores_json, imagenes_json, descripcion, destacado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedProductos = [
      ["bajaj-boxer-bm150-2026","Bajaj Boxer BM 150","Bajaj","Trabajo",2026,1552,12,144.8,"12 HP","12.26 Nm","4 velocidades",123,11,"55 km/L","90 km/h","Tambor delantero y trasero","Horquilla telescópica / Doble amortiguador","Arranque eléctrico y pedal, tablero analógico",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/bajaj-boxer-bm150-2026.jpg","alt":"bajaj-boxer-bm150-2026"}]',"Moto de trabajo pesado ideal para delivery, mensajería y uso diario en Bolivia. Bajo consumo, repuestos accesibles y gran durabilidad.",1],
      ["haojue-ka150-2026","Haojue KA 150","Haojue","Trabajo",2026,1710,10,149,"11.4 HP","11.5 Nm","5 velocidades",126,12.5,"50 km/L","95 km/h","Disco delantero, tambor trasero","Horquilla telescópica / Doble amortiguador","Arranque eléctrico, tablero digital",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/haojue-ka150-2026.jpg","alt":"haojue-ka150-2026"}]',"Moto de trabajo confiable para reparto y ciudad, con disco delantero y buen consumo de combustible.",0],
      ["kingo-cg150-titan-2026","Kingo CG 150 Titan","Kingo","Trabajo",2026,1286,15,150,"11.8 HP","11.0 Nm","5 velocidades",115,12,"48 km/L","90 km/h","Tambor delantero y trasero","Horquilla telescópica / Doble amortiguador","Arranque pedal, tablero analógico",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/kingo-cg150-titan-2026.jpg","alt":"kingo-cg150-titan-2026"}]',"Opción económica de trabajo con repuestos accesibles y mantenimiento sencillo para Bolivia.",0],
      ["suzuki-gn125h-2026","Suzuki GN 125H","Suzuki","Trabajo",2026,1983,8,124,"12.5 HP","10.5 Nm","5 velocidades",107,10.3,"46 km/L","95 km/h","Tambor delantero y trasero","Horquilla telescópica / Doble amortiguador","Arranque pedal, tablero analógico",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/suzuki-gn125h-2026.jpg","alt":"suzuki-gn125h-2026"}]',"Clásica indestructible de ciudad y reparto, ideal para uso intensivo diario.",0],
      ["yamaha-ybr125z-2026","Yamaha YBR 125Z","Yamaha","Trabajo",2026,2184,7,124,"10.2 HP","9.9 Nm","5 velocidades",119,13,"52 km/L","95 km/h","Tambor delantero y trasero","Horquilla telescópica / Doble amortiguador","Arranque eléctrico y pedal",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/yamaha-ybr125z-2026.jpg","alt":"yamaha-ybr125z-2026"}]',"Bajo mantenimiento y alto rendimiento, perfecta para delivery y ciudad.",0],
      ["honda-gl150-cargo-2026","Honda GL 150 Cargo","Honda","Trabajo",2026,2284,6,149.2,"11.7 HP","12.1 Nm","5 velocidades",128,12.6,"47 km/L","95 km/h","Tambor delantero y trasero","Horquilla telescópica / Doble amortiguador","Arranque eléctrico y pedal, parrilla reforzada",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/honda-gl150-cargo-2026.jpg","alt":"honda-gl150-cargo-2026"}]',"Parrilla reforzada de carga para trabajo pesado y reparto diario.",0],
      ["honda-navi-110-2026","Honda Navi 110","Honda","Urbana",2026,1782,9,109.2,"8 HP","8.9 Nm","CVT automática",101,3.8,"54 km/L","85 km/h","Tambor delantero y trasero","Horquilla telescópica / Monoamortiguador","Arranque eléctrico, tablero digital",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/honda-navi-110-2026.jpg","alt":"honda-navi-110-2026"}]',"Scooter automática ideal para principiantes y tráfico urbano intenso.",1],
      ["bajaj-pulsar-ns160-fi-abs-2026","Bajaj Pulsar NS 160 FI ABS","Bajaj","Urbana",2026,2845,6,160.3,"17.2 HP","14.6 Nm","5 velocidades",151,12,"40 km/L","118 km/h","Disco delantero ABS, disco trasero","Horquilla telescópica / Monoamortiguador","Inyección electrónica, ABS, tablero digital",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/bajaj-pulsar-ns160-fi-abs-2026.jpg","alt":"bajaj-pulsar-ns160-fi-abs-2026"}]',"Naked urbana con inyección y ABS para ciudad y carretera.",0],
      ["yamaha-fzs-fi-v3-2026","Yamaha FZ-S FI V3.0","Yamaha","Urbana",2026,3089,5,149,"12.4 HP","13.3 Nm","5 velocidades",135,12.8,"45 km/L","110 km/h","Disco delantero ABS, disco trasero","Horquilla telescópica / Monoamortiguador","Blue Core, inyección, ABS",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/yamaha-fzs-fi-v3-2026.jpg","alt":"yamaha-fzs-fi-v3-2026"}]',"Street ágil con tecnología Blue Core y ABS para el día a día.",0],
      ["ktm-duke-250-abs-2026","KTM Duke 250 ABS","KTM","Naked",2026,5589,4,248.8,"30 HP","24 Nm","6 velocidades",162,13.4,"32 km/L","142 km/h","Disco delantero ABS, disco trasero","Horquilla invertida WP / Monoamortiguador WP","ABS doble canal, tablero TFT",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/ktm-duke-250-abs-2026.jpg","alt":"ktm-duke-250-abs-2026"}]',"Naked deportiva de gama media con ABS doble canal y gran agilidad.",1],
      ["yamaha-mt03-abs-2026","Yamaha MT-03 ABS","Yamaha","Naked",2026,6796,3,321,"42 HP","29.6 Nm","6 velocidades",169,14,"26 km/L","165 km/h","Disco delantero ABS, disco trasero","Horquilla invertida / Monoamortiguador","ABS, tablero LCD",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/yamaha-mt03-abs-2026.jpg","alt":"yamaha-mt03-abs-2026"}]',"Bicilíndrica naked con gran respuesta para ciudad y carretera.",0],
      ["honda-xr150l-2026","Honda XR 150L","Honda","Adventure",2026,3147,7,149.1,"12.1 HP","12.5 Nm","5 velocidades",129,12,"42 km/L","100 km/h","Tambor delantero y trasero","Horquilla largo recorrido / Doble amortiguador","Arranque eléctrico y pedal",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/honda-xr150l-2026.jpg","alt":"honda-xr150l-2026"}]',"Doble propósito ideal para rutas, altura y caminos de tierra en Bolivia.",1],
      ["yamaha-xtz150-fi-2026","Yamaha XTZ 150 FI","Yamaha","Adventure",2026,3563,5,149,"12.3 HP","13.1 Nm","5 velocidades",131,12.5,"43 km/L","105 km/h","Disco delantero, tambor trasero","Horquilla largo recorrido / Monoamortiguador","Inyección electrónica",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/yamaha-xtz150-fi-2026.jpg","alt":"yamaha-xtz150-fi-2026"}]',"Adventure con inyección electrónica para rutas y altura.",0],
      ["cfmoto-450mt-adventure-2026","CFMoto 450MT Adventure","CFMoto","Adventure",2026,7888,2,449,"44 HP","44 Nm","6 velocidades",175,17.5,"24 km/L","160 km/h","Disco delantero ABS desconectable, disco trasero","Horquilla invertida / Monoamortiguador","ABS desconectable, control de tracción",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/cfmoto-450mt-adventure-2026.jpg","alt":"cfmoto-450mt-adventure-2026"}]',"Adventure de gama media-alta con ABS desconectable y control de tracción.",1],
      ["kawasaki-ninja-400-abs-2026","Kawasaki Ninja 400 ABS","Kawasaki","Supersport",2026,7989,3,399,"45 HP","38 Nm","6 velocidades",168,14,"25 km/L","185 km/h","Doble disco delantero ABS, disco trasero","Horquilla telescópica / Monoamortiguador","Embrague antirrebote, ABS",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/kawasaki-ninja-400-abs-2026.jpg","alt":"kawasaki-ninja-400-abs-2026"}]',"Supersport ligera con embrague antirrebote y ABS para curvas.",1],
      ["yamaha-yzf-r7-2026","Yamaha YZF-R7","Yamaha","Supersport",2026,11466,0,689,"73.4 HP","67 Nm","6 velocidades",188,13,"20 km/L","230 km/h","Doble disco delantero ABS, disco trasero","Horquilla invertida / Monoamortiguador","Quickshifter, ABS, tablero TFT",'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/yamaha-yzf-r7-2026.jpg","alt":"yamaha-yzf-r7-2026"}]',"Supersport de alta gama con quickshifter, actualmente agotada.",0],
      ["casco-integral-ece2206-carbon-2026","Casco Integral Certificado ECE 22.06 Carbon","LS2","Equipamiento",2026,208,14,null,null,null,null,1.4,null,null,null,null,null,null,'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/casco-agv.jpg","alt":"casco-integral-ece2206-carbon-2026"}]',"Casco integral certificado ECE 22.06 con visor solar y Pinlock incluido.",0],
      ["chaqueta-touring-ce-nivel2-2026","Chaqueta Touring Protecciones CE Nivel 2","Alpinestars","Equipamiento",2026,272,0,null,null,null,null,null,null,null,null,null,null,null,'[{"nombre":"Estándar","hex":"#475569"}]','[{"url":"/images/productos/chaqueta-alpinestars.jpg","alt":"chaqueta-touring-ce-nivel2-2026"}]',"Chaqueta touring impermeable con protecciones CE nivel 2, actualmente agotada.",0],
    ];

    runTransaction(() => {
      for (const p of seedProductos) {
        insertProducto.run(...p);
      }
    });
    console.log('[DB] Seeded initial productos:', seedProductos.length);
  }

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM usuarios').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO usuarios (nombre, email, password, rol, cargo_etiqueta) VALUES (?, ?, ?, ?, ?)'
    );
    const seedUsers = [
      ['Carlos Mendoza', 'cliente@motoconnect.com', hashPassword('123456'), 'CLIENTE', 'Carlos Mendoza — Cliente Verificado'],
      ['Laura Rojas', 'pagos@motoconnect.com', hashPassword('123456'), 'VERIFICADOR_PAGOS', 'Laura Rojas — Oficial de Cobranzas y Caja'],
      ['Marco Quispe', 'almacen@motoconnect.com', hashPassword('123456'), 'ALMACEN_EMPAQUE', 'Marco Quispe — Jefe de Almacén y Empaque PDI'],
      ['Diego Vargas', 'entrega@motoconnect.com', hashPassword('123456'), 'DESPACHO_ENTREGA', 'Diego Vargas — Coordinador de Despacho y Entrega'],
      ['Admin General', 'admin@motoconnect.com', hashPassword('123456'), 'ADMIN', 'Administrador General Concesionario'],
    ];

    runTransaction(() => {
      for (const u of seedUsers) {
        insertUser.run(...u);
      }
    });
    console.log('[DB] Seeded initial usuarios:', seedUsers.length);
  }
}

// ─────────────────────────────────────────────
// Backup + Idempotent Migrations
// ─────────────────────────────────────────────
function createBackupIfNeeded() {
  if (!dbAlreadyExists) return null;
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `motoconnect-pre-migration-${stamp}.sqlite`);
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('[DB] Backup creado antes de migración:', backupPath);
    return backupPath;
  } catch (err) {
    console.warn('[DB] No se pudo crear respaldo previo:', err.message);
    return null;
  }
}

function getTableColumns(tableName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return new Set(rows.map(r => r.name));
}

const MIGRATIONS = [
  {
    id: '001_security_sessions_audit_payments',
    up() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sesiones (
          token TEXT PRIMARY KEY,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          creado_en TEXT NOT NULL,
          expira_en TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones(expira_en);

        CREATE TABLE IF NOT EXISTS auditoria_operaciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pedido_id INTEGER,
          usuario_id INTEGER,
          usuario_nombre TEXT,
          usuario_rol TEXT,
          accion TEXT NOT NULL,
          detalle TEXT,
          fecha TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS paypal_intents (
          order_id TEXT PRIMARY KEY,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          buyer_json TEXT NOT NULL,
          items_json TEXT NOT NULL,
          subtotal_usd REAL NOT NULL,
          impuestos_tramite_usd REAL NOT NULL,
          total_usd REAL NOT NULL,
          ref_code TEXT NOT NULL,
          status TEXT NOT NULL,
          creado_en TEXT NOT NULL
        );
      `);

      const cols = getTableColumns('pedidos');
      const additions = [
        ['usuario_id', 'INTEGER'],
        ['pdi_total_puntos', 'INTEGER DEFAULT 40'],
        ['pdi_completados', 'INTEGER DEFAULT 0'],
        ['pdi_observaciones', 'TEXT'],
        ['paypal_order_id', 'TEXT'],
        ['paypal_capture_id', 'TEXT'],
        ['paypal_payer_email', 'TEXT'],
        ['comprobante_mime', 'TEXT'],
        ['comprobante_original', 'TEXT'],
      ];

      for (const [col, def] of additions) {
        if (!cols.has(col)) {
          db.exec(`ALTER TABLE pedidos ADD COLUMN ${col} ${def};`);
        }
      }

      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_vin_unique
          ON pedidos(vin_asignado) WHERE vin_asignado IS NOT NULL AND vin_asignado != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_pkg_unique
          ON pedidos(codigo_empaque) WHERE codigo_empaque IS NOT NULL AND codigo_empaque != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_paypal_unique
          ON pedidos(paypal_order_id) WHERE paypal_order_id IS NOT NULL AND paypal_order_id != '';
      `);
    },
  },
  {
    id: '002_hash_legacy_passwords',
    up() {
      const users = db.prepare('SELECT id, password FROM usuarios').all();
      const updateStmt = db.prepare('UPDATE usuarios SET password = ? WHERE id = ?');
      for (const u of users) {
        if (u.password && !String(u.password).startsWith('scrypt$')) {
          updateStmt.run(hashPassword(u.password), u.id);
        }
      }
    },
  },
  {
    id: '003_tarjeta_payment_method',
    up() {
      const tbl = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pedidos'")
        .get();
      if (tbl && tbl.sql && tbl.sql.includes("'TARJETA'")) {
        return;
      }

      db.exec(`
        CREATE TABLE pedidos_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo_orden TEXT UNIQUE NOT NULL,
          cliente_nombre TEXT NOT NULL,
          cliente_email TEXT NOT NULL,
          cliente_telefono TEXT NOT NULL,
          cliente_ci TEXT NOT NULL,
          direccion_entrega TEXT NOT NULL,
          ciudad TEXT NOT NULL,
          items_json TEXT NOT NULL,
          subtotal_usd REAL NOT NULL,
          impuestos_tramite_usd REAL NOT NULL,
          total_usd REAL NOT NULL,
          metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('PAYPAL','TARJETA','QR_BANCARIO','DEPOSITO_BANCARIO')),
          estado_pago TEXT NOT NULL CHECK(estado_pago IN ('EN_REVISION','VERIFICADO','RECHAZADO')),
          referencia_pago TEXT,
          comprobante_url TEXT,
          motivo_rechazo TEXT,
          estado_logistico TEXT NOT NULL CHECK(estado_logistico IN ('ESPERANDO_PAGO','LISTO_PARA_PREPARAR','EN_PREPARACION_PDI','EMPACADO_LISTO_DESPACHO','EN_RUTA_ENTREGA','ENTREGADO_FINALIZADO','CANCELADO')),
          vin_asignado TEXT,
          checklist_pdi_json TEXT,
          codigo_empaque TEXT,
          notas_almacen TEXT,
          responsable_pagos TEXT,
          responsable_empaque TEXT,
          receptor_nombre TEXT,
          receptor_ci TEXT,
          firma_entrega_base64 TEXT,
          responsable_entrega TEXT,
          fecha_creacion TEXT NOT NULL,
          fecha_pago_verificado TEXT,
          fecha_empacado TEXT,
          fecha_entrega TEXT,
          usuario_id INTEGER,
          pdi_total_puntos INTEGER DEFAULT 40,
          pdi_completados INTEGER DEFAULT 0,
          pdi_observaciones TEXT,
          paypal_order_id TEXT,
          paypal_capture_id TEXT,
          paypal_payer_email TEXT,
          comprobante_mime TEXT,
          comprobante_original TEXT
        );

        INSERT INTO pedidos_new (
          id, codigo_orden, cliente_nombre, cliente_email, cliente_telefono, cliente_ci,
          direccion_entrega, ciudad, items_json, subtotal_usd, impuestos_tramite_usd,
          total_usd, metodo_pago, estado_pago, referencia_pago, comprobante_url,
          motivo_rechazo, estado_logistico, vin_asignado, checklist_pdi_json,
          codigo_empaque, notas_almacen, responsable_pagos, responsable_empaque,
          receptor_nombre, receptor_ci, firma_entrega_base64, responsable_entrega,
          fecha_creacion, fecha_pago_verificado, fecha_empacado, fecha_entrega,
          usuario_id, pdi_total_puntos, pdi_completados, pdi_observaciones,
          paypal_order_id, paypal_capture_id, paypal_payer_email, comprobante_mime,
          comprobante_original
        )
        SELECT
          id, codigo_orden, cliente_nombre, cliente_email, cliente_telefono, cliente_ci,
          direccion_entrega, ciudad, items_json, subtotal_usd, impuestos_tramite_usd,
          total_usd, metodo_pago, estado_pago, referencia_pago, comprobante_url,
          motivo_rechazo, estado_logistico, vin_asignado, checklist_pdi_json,
          codigo_empaque, notas_almacen, responsable_pagos, responsable_empaque,
          receptor_nombre, receptor_ci, firma_entrega_base64, responsable_entrega,
          fecha_creacion, fecha_pago_verificado, fecha_empacado, fecha_entrega,
          usuario_id, pdi_total_puntos, pdi_completados, pdi_observaciones,
          paypal_order_id, paypal_capture_id, paypal_payer_email, comprobante_mime,
          comprobante_original
        FROM pedidos;

        DROP TABLE pedidos;
        ALTER TABLE pedidos_new RENAME TO pedidos;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_vin_unique
          ON pedidos(vin_asignado) WHERE vin_asignado IS NOT NULL AND vin_asignado != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_pkg_unique
          ON pedidos(codigo_empaque) WHERE codigo_empaque IS NOT NULL AND codigo_empaque != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_paypal_unique
          ON pedidos(paypal_order_id) WHERE paypal_order_id IS NOT NULL AND paypal_order_id != '';
      `);
    },
  },
  {
    id: '004_product_documents',
    up() {
      const cols = getTableColumns('productos');
      const additions = [
        ['documento_papeles_url', 'TEXT'],
        ['documento_papeles_nombre', 'TEXT'],
        ['homologacion_notas', 'TEXT'],
      ];
      for (const [col, def] of additions) {
        if (!cols.has(col)) {
          db.exec(`ALTER TABLE productos ADD COLUMN ${col} ${def};`);
        }
      }
    },
  },
  {
    id: '005_local_product_images',
    up() {
      const rows = db.prepare('SELECT id, slug, nombre, imagenes_json FROM productos').all();
      const updateStmt = db.prepare('UPDATE productos SET imagenes_json = ? WHERE id = ?');
      for (const row of rows) {
        const localFile = path.resolve(__dirname, 'images', 'productos', `${row.slug}.jpg`);
        if (fs.existsSync(localFile)) {
          const nextJson = JSON.stringify([
            { url: `/images/productos/${row.slug}.jpg`, alt: row.nombre || row.slug },
          ]);
          updateStmt.run(nextJson, row.id);
        }
      }
    },
  },
];

function runMigrations() {
  seedIfEmpty();

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all();
  const applied = new Set(appliedRows.map(r => r.id));
  const pending = MIGRATIONS.filter(m => !applied.has(m.id));

  if (!pending.length) {
    return;
  }

  createBackupIfNeeded();

  const insertMigration = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');
  for (const migration of pending) {
    runTransaction(() => {
      migration.up();
      insertMigration.run(migration.id, new Date().toISOString());
    });
    console.log('[DB] Migración aplicada:', migration.id);
  }
}

runMigrations();

module.exports = {
  db,
  DB_PATH,
  runTransaction,
  hashPassword,
  verifyPassword,
};
