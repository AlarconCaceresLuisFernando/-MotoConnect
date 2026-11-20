// ============================================================
// MotoConnect E-Commerce — Backend Server
// Stack: Node.js + Express + better-sqlite3
// ============================================================

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files — workspace root
app.use(express.static(path.join(__dirname)));

// Serve uploaded files
fs.mkdirSync('./uploads', { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────
// Multer — comprobante upload config
// ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, 'comprobante-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// ─────────────────────────────────────────────
// Database init
// ─────────────────────────────────────────────
fs.mkdirSync('./database', { recursive: true });

const DB_PATH = './database/motoconnect.sqlite';
const dbExists = fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if (!dbExists) {
  console.log('[DB] Database not found — creating schema and seeding data...');

  // ── Create tables ──────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      marca TEXT NOT NULL,
      categoria TEXT NOT NULL CHECK(categoria IN ('Naked','Supersport','Adventure','Sport Touring','Accesorio')),
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
      destacado INTEGER DEFAULT 0
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
      metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('PAYPAL','QR_BANCARIO','DEPOSITO_BANCARIO')),
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

  // ── Seed productos ─────────────────────────
  const insertProducto = db.prepare(`
    INSERT INTO productos (
      slug, nombre, marca, categoria, anio, precio_usd, stock_disponible,
      cilindrada_cc, potencia_hp, torque_nm, transmision, peso_kg, tanque_litros,
      consumo_kml, velocidad_max, frenos, suspension, electronica,
      colores_json, imagenes_json, descripcion, destacado
    ) VALUES (
      @slug, @nombre, @marca, @categoria, @anio, @precio_usd, @stock_disponible,
      @cilindrada_cc, @potencia_hp, @torque_nm, @transmision, @peso_kg, @tanque_litros,
      @consumo_kml, @velocidad_max, @frenos, @suspension, @electronica,
      @colores_json, @imagenes_json, @descripcion, @destacado
    )
  `);

  const productos = [
    {
      slug: 'yamaha-mt07-2026',
      nombre: 'Yamaha MT-07',
      marca: 'Yamaha',
      categoria: 'Naked',
      anio: 2026,
      precio_usd: 7990.00,
      stock_disponible: 4,
      cilindrada_cc: 689,
      potencia_hp: '73.4 HP @ 9,000 rpm',
      torque_nm: '67 Nm @ 6,500 rpm',
      transmision: '6 velocidades',
      peso_kg: 184,
      tanque_litros: 13.2,
      consumo_kml: '22 km/L',
      velocidad_max: '180 km/h',
      frenos: 'Doble disco 298mm delantero, ABS dual-channel',
      suspension: 'Horquilla invertida KYB Ø41mm / Monoamortiguador KYB',
      electronica: 'ABS, TCS (Control de Tracción), 3 modos de conducción, Quick Shifter opcional, instrumentación TFT 5"',
      colores_json: '[{"nombre":"Midnight Cyan","hex":"#007F9F"},{"nombre":"Storm Fluo","hex":"#C8FF00"},{"nombre":"Matte Dark Grey","hex":"#3D3D3D"}]',
      imagenes_json: '[{"url":"/images/productos/yamaha-mt07.jpg","alt":"Yamaha MT-07 2026 oficial"}]',
      descripcion: 'La Yamaha MT-07 2026 define el concepto Hyper Naked con su motor CP2 de 689cc, chasis Deltabox ultraligero y paquete electrónico avanzado. Equilibrio perfecto entre rendimiento y versatilidad urbana.',
      destacado: 1
    },
    {
      slug: 'honda-cbr650r-2026',
      nombre: 'Honda CBR650R E-Clutch',
      marca: 'Honda',
      categoria: 'Supersport',
      anio: 2026,
      precio_usd: 9450.00,
      stock_disponible: 2,
      cilindrada_cc: 649,
      potencia_hp: '95 HP @ 12,000 rpm',
      torque_nm: '63 Nm @ 9,500 rpm',
      transmision: '6 velocidades E-Clutch',
      peso_kg: 202,
      tanque_litros: 15.4,
      consumo_kml: '19 km/L',
      velocidad_max: '210 km/h',
      frenos: 'Doble disco 310mm Nissin + ABS Honda Selectable Torque Control',
      suspension: 'Horquilla telescópica Ø41mm / Pro-Link con amortiguador de precarga ajustable',
      electronica: 'ABS bicanalítico, HSTC (Honda Selectable Torque Control), E-Clutch automático, pantalla TFT 5" con Honda RoadSync',
      colores_json: '[{"nombre":"Winning Red","hex":"#CC0000"},{"nombre":"Matte Gunpowder Black Metallic","hex":"#2B2B2B"},{"nombre":"Tricolor","hex":"#CC0000"}]',
      imagenes_json: '[{"url":"/images/productos/honda-cbr650r.jpg","alt":"Honda CBR650R E-Clutch oficial"}]',
      descripcion: 'La Honda CBR650R 2026 incorpora el revolucionario sistema E-Clutch, permitiendo cambios de marcha sin embrague manual. Motor inline-4 de carácter deportivo con refinamiento de clase mundial.',
      destacado: 1
    },
    {
      slug: 'kawasaki-z900-se-2026',
      nombre: 'Kawasaki Z900 SE',
      marca: 'Kawasaki',
      categoria: 'Naked',
      anio: 2026,
      precio_usd: 10200.00,
      stock_disponible: 3,
      cilindrada_cc: 948,
      potencia_hp: '125 HP @ 9,500 rpm',
      torque_nm: '98.6 Nm @ 7,700 rpm',
      transmision: '6 velocidades con asistencia y antideslizamiento',
      peso_kg: 212,
      tanque_litros: 17.0,
      consumo_kml: '17 km/L',
      velocidad_max: '240 km/h',
      frenos: 'Doble disco radial 300mm Brembo / Disco 250mm trasero, ABS Cornering',
      suspension: 'Horquilla invertida SFF-BP 41mm / Monoamortiguador Öhlins S46 ajustable',
      electronica: 'KIBS (Kawasaki Intelligent anti-lock Brake System) con ABS Cornering, KTRC (Traction Control) 3 modos, IMU 6-ejes, Quick Shifter KQS up/down, Modos de conducción: Sport/Road/Rain/Rider',
      colores_json: '[{"nombre":"Metallic Spark Black / Metallic Flat Spark Black","hex":"#1A1A1A"},{"nombre":"Candy Lime Green","hex":"#B5E853"},{"nombre":"Metallic Matte Carbon Gray","hex":"#5A5A5A"}]',
      imagenes_json: '[{"url":"/images/productos/kawasaki-z900.jpg","alt":"Kawasaki Z900 SE oficial"}]',
      descripcion: 'La Z900 SE eleva el estándar Supernaked con suspensión Öhlins de serie, IMU 6 ejes para ABS cornering y paquete electrónico completo. Dominio absoluto en carretera y circuito.',
      destacado: 1
    },
    {
      slug: 'bmw-f900gs-trophy-2026',
      nombre: 'BMW F 900 GS Trophy',
      marca: 'BMW',
      categoria: 'Adventure',
      anio: 2026,
      precio_usd: 14800.00,
      stock_disponible: 1,
      cilindrada_cc: 895,
      potencia_hp: '105 HP @ 8,500 rpm',
      torque_nm: '93 Nm @ 6,750 rpm',
      transmision: '6 velocidades con Quick Shifter Pro',
      peso_kg: 229,
      tanque_litros: 14.5,
      consumo_kml: '20 km/L',
      velocidad_max: '220 km/h',
      frenos: 'Discos flotantes 320mm + 265mm Brembo, ABS Pro off-road',
      suspension: 'Horquilla telescópica 43mm con precarga/rebote ajustable / Monoamortiguador con ESA electrónico',
      electronica: 'ABS Pro con modo off-road, Riding Modes Pro (Rain/Road/Dynamic/Enduro/Enduro Pro), DTC dinámico, Hill Start Control, Frenada en curva dinámica, pantalla TFT 6.5" con BMW Motorrad Connected App',
      colores_json: '[{"nombre":"Style Trophy Kalamata/Blackstorm Met.","hex":"#4A3728"},{"nombre":"Style Triple Black","hex":"#1C1C1C"},{"nombre":"Style HP Racingred","hex":"#C8102E"}]',
      imagenes_json: '[{"url":"/images/productos/bmw-f900gs.jpg","alt":"BMW F 900 GS Trophy oficial"}]',
      descripcion: 'La BMW F 900 GS Trophy 2026 en edición especial incluye accesorios Trophy de fábrica, ESA electrónica y el completo paquete de asistencias para conquista de cualquier terreno.',
      destacado: 0
    },
    {
      slug: 'ktm-390-duke-gen3-2026',
      nombre: 'KTM 390 Duke Gen-3',
      marca: 'KTM',
      categoria: 'Naked',
      anio: 2026,
      precio_usd: 5290.00,
      stock_disponible: 5,
      cilindrada_cc: 399,
      potencia_hp: '46 HP @ 8,500 rpm',
      torque_nm: '39 Nm @ 6,500 rpm',
      transmision: '6 velocidades con Quick Shifter+',
      peso_kg: 171,
      tanque_litros: 13.5,
      consumo_kml: '25 km/L',
      velocidad_max: '167 km/h',
      frenos: '320mm disco petal delantero / 230mm trasero, ABS cornering',
      suspension: 'WP APEX Ø43mm invertida ajustable / WP APEX monoamortiguador ajustable',
      electronica: 'ABS cornering, TCS (Traction Control), IMU 6-ejes, 3 modos conducción, Quick Shifter+, pantalla TFT 5" con Apple CarPlay/Android Auto, control por crucero adaptativo opcional',
      colores_json: '[{"nombre":"Orange Crush","hex":"#FF6B00"},{"nombre":"Blackbird","hex":"#1A1A1A"},{"nombre":"White Ghost","hex":"#F5F5F5"}]',
      imagenes_json: '[{"url":"/images/productos/ktm-390-duke.jpg","alt":"KTM 390 Duke Gen-3 oficial"}]',
      descripcion: 'La KTM 390 Duke Gen-3 2026 redefine el segmento con IMU 6 ejes, ABS cornering, pantalla TFT con conectividad nativa y ADN de supermoto en un paquete accesible y vertiginoso.',
      destacado: 0
    },
    {
      slug: 'ducati-monster-sp-2026',
      nombre: 'Ducati Monster SP',
      marca: 'Ducati',
      categoria: 'Naked',
      anio: 2026,
      precio_usd: 16900.00,
      stock_disponible: 0,
      cilindrada_cc: 937,
      potencia_hp: '111 HP @ 9,250 rpm',
      torque_nm: '93 Nm @ 6,500 rpm',
      transmision: '6 velocidades con Quick Shift Up/Down',
      peso_kg: 188,
      tanque_litros: 14.5,
      consumo_kml: '18 km/L',
      velocidad_max: '230 km/h',
      frenos: 'Doble disco 320mm Brembo Stylema monobloc / ABS EVO Cornering',
      suspension: 'Horquilla Öhlins 43mm NPX completamente ajustable / Monoamortiguador Öhlins TTX completamente ajustable',
      electronica: 'ABS EVO Cornering, Ducati Traction Control EVO 2 (DTC), Ducati Slide Control, Ducati Power Launch, Modos: Sport/Touring/Urban/Wet, Quickshift DQS Up&Down, pantalla TFT 5"',
      colores_json: '[{"nombre":"Ducati Red","hex":"#CC0000"},{"nombre":"Thrilling Black","hex":"#1A1A1A"}]',
      imagenes_json: '[{"url":"/images/productos/ducati-monster.jpg","alt":"Ducati Monster SP oficial"}]',
      descripcion: 'El Ducati Monster SP 2026 es la versión más deportiva del icónico naked italiano, equipado de serie con suspensiones Öhlins completamente ajustables y el sistema electrónico más sofisticado. PRÓXIMO EMBARQUE: Enero 2027.',
      destacado: 0
    },
    {
      slug: 'casco-agv-k6s-carbon',
      nombre: 'Casco Integral AGV K6 S Carbon',
      marca: 'AGV',
      categoria: 'Accesorio',
      anio: 2026,
      precio_usd: 890.00,
      stock_disponible: 10,
      cilindrada_cc: null,
      potencia_hp: null,
      torque_nm: null,
      transmision: null,
      peso_kg: 1,
      tanque_litros: null,
      consumo_kml: null,
      velocidad_max: null,
      frenos: null,
      suspension: null,
      electronica: null,
      colores_json: '[{"nombre":"Carbon","hex":"#1A1A1A"},{"nombre":"Iridium Silver","hex":"#C0C0C0"},{"nombre":"Mono Matt Carbon","hex":"#2A2A2A"}]',
      imagenes_json: '[{"url":"/images/productos/casco-agv.jpg","alt":"Casco Integral AGV K6 S Carbon oficial"}]',
      descripcion: 'El AGV K6 S Carbon es el casco de competición más ligero de la gama AGV. Calota en fibra de carbono con homologación FIM Racing para circuito. Visera Pinlock 70 antiempañante incluida. Peso: 1,190g ± 50g. Certificación: ECE 22.06 / DOT FMVSS 218.',
      destacado: 0
    },
    {
      slug: 'chaqueta-alpinestars-gpplusr-v4',
      nombre: 'Chaqueta Alpinestars GP Plus R v4',
      marca: 'Alpinestars',
      categoria: 'Accesorio',
      anio: 2026,
      precio_usd: 650.00,
      stock_disponible: 7,
      cilindrada_cc: null,
      potencia_hp: null,
      torque_nm: null,
      transmision: null,
      peso_kg: null,
      tanque_litros: null,
      consumo_kml: null,
      velocidad_max: null,
      frenos: null,
      suspension: null,
      electronica: null,
      colores_json: '[{"nombre":"Black/Bright Red","hex":"#CC0000"},{"nombre":"Black/White","hex":"#F5F5F5"},{"nombre":"Black/Fluo Yellow","hex":"#CCFF00"}]',
      imagenes_json: '[{"url":"/images/productos/chaqueta-alpinestars.jpg","alt":"Chaqueta Alpinestars GP Plus R v4 oficial"}]',
      descripcion: 'La Chaqueta Alpinestars GP Plus R v4 en cuero bovino premium full-grain de 1.0mm con construcción en paneles. Incluye protecciones CE Nivel 2 en hombros y codos, y bolsillo para espalda CE Nivel 1. Homologación EN 17092-2:2020.',
      destacado: 0
    }
  ];

  const seedProductos = db.transaction(() => {
    for (const p of productos) {
      insertProducto.run(p);
    }
  });
  seedProductos();

  // ── Seed usuarios ──────────────────────────
  const insertUsuario = db.prepare(`
    INSERT INTO usuarios (nombre, email, password, rol, cargo_etiqueta)
    VALUES (@nombre, @email, @password, @rol, @cargo_etiqueta)
  `);

  const usuarios = [
    { nombre: 'Carlos Mendoza',  email: 'cliente@motoconnect.com', password: '123456', rol: 'CLIENTE',             cargo_etiqueta: 'Carlos Mendoza — Cliente Verificado' },
    { nombre: 'Laura Rojas',     email: 'pagos@motoconnect.com',   password: '123456', rol: 'VERIFICADOR_PAGOS',   cargo_etiqueta: 'Laura Rojas — Oficial de Cobranzas y Caja' },
    { nombre: 'Marco Quispe',    email: 'almacen@motoconnect.com', password: '123456', rol: 'ALMACEN_EMPAQUE',     cargo_etiqueta: 'Marco Quispe — Jefe de Almacén y Empaque PDI' },
    { nombre: 'Diego Vargas',    email: 'entrega@motoconnect.com', password: '123456', rol: 'DESPACHO_ENTREGA',    cargo_etiqueta: 'Diego Vargas — Coordinador de Despacho y Entrega' },
    { nombre: 'Admin General',   email: 'admin@motoconnect.com',   password: '123456', rol: 'ADMIN',              cargo_etiqueta: 'Administrador General Concesionario' }
  ];

  const seedUsuarios = db.transaction(() => {
    for (const u of usuarios) {
      insertUsuario.run(u);
    }
  });
  seedUsuarios();

  console.log('[DB] Schema created and seed data inserted successfully.');
} else {
  console.log('[DB] Database found — skipping initialization.');
}

// ─────────────────────────────────────────────
// Helper — generate codigo_orden
// ─────────────────────────────────────────────
function generarCodigoOrden() {
  return `MC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ─────────────────────────────────────────────
// Helper — atomic stock decrement (transaction)
// Throws if any item has insufficient stock.
// ─────────────────────────────────────────────
function decrementarStock(items) {
  const checkStock = db.prepare('SELECT stock_disponible, nombre FROM productos WHERE id = ?');
  const updateStock = db.prepare('UPDATE productos SET stock_disponible = stock_disponible - ? WHERE id = ?');

  const doDecrement = db.transaction((items) => {
    for (const item of items) {
      const prodId = item.id || item.productoId;
      const cant = Number(item.cantidad) || 1;
      const producto = checkStock.get(prodId);
      if (!producto) {
        throw new Error(`Producto con id ${prodId} no encontrado`);
      }
      if (producto.stock_disponible < cant) {
        throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock_disponible}, solicitado: ${cant}`);
      }
      updateStock.run(cant, prodId);
    }
  });

  doDecrement(items);
}

// ─────────────────────────────────────────────
// Helper — verify stock availability (no decrement)
// ─────────────────────────────────────────────
function verificarStock(items) {
  const checkStock = db.prepare('SELECT stock_disponible, nombre FROM productos WHERE id = ?');
  for (const item of items) {
    const prodId = item.id || item.productoId;
    const cant = Number(item.cantidad) || 1;
    const producto = checkStock.get(prodId);
    if (!producto) {
      throw new Error(`Producto con id ${prodId} no encontrado`);
    }
    if (producto.stock_disponible < cant) {
      throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock_disponible}, solicitado: ${cant}`);
    }
  }
}

// ═════════════════════════════════════════════
// ROUTES — Productos
// ═════════════════════════════════════════════

// GET /api/productos
app.get('/api/productos', (req, res) => {
  try {
    const { marca, categoria, q, soloStock } = req.query;

    let sql = 'SELECT * FROM productos WHERE 1=1';
    const params = [];

    if (marca) {
      sql += ' AND LOWER(marca) = LOWER(?)';
      params.push(marca);
    }
    if (categoria) {
      sql += ' AND LOWER(categoria) = LOWER(?)';
      params.push(categoria);
    }
    if (q) {
      sql += ' AND LOWER(nombre) LIKE LOWER(?)';
      params.push(`%${q}%`);
    }
    if (soloStock === 'true') {
      sql += ' AND stock_disponible > 0';
    }

    sql += ' ORDER BY id ASC';

    const productos = db.prepare(sql).all(...params);
    res.json(productos);
  } catch (err) {
    console.error('[GET /api/productos]', err);
    res.status(500).json({ error: 'Error al obtener productos', detail: err.message });
  }
});

// GET /api/productos/:slug
app.get('/api/productos/:slug', (req, res) => {
  try {
    const producto = db.prepare('SELECT * FROM productos WHERE slug = ?').get(req.params.slug);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(producto);
  } catch (err) {
    console.error('[GET /api/productos/:slug]', err);
    res.status(500).json({ error: 'Error al obtener producto', detail: err.message });
  }
});

// POST /api/productos
app.post('/api/productos', (req, res) => {
  try {
    const {
      slug, nombre, marca, categoria, anio, precio_usd, stock_disponible,
      cilindrada_cc, potencia_hp, torque_nm, transmision, peso_kg, tanque_litros,
      consumo_kml, velocidad_max, frenos, suspension, electronica,
      colores_json, imagenes_json, descripcion, destacado
    } = req.body;

    if (!slug || !nombre || !marca || !categoria || !anio || precio_usd === undefined) {
      return res.status(400).json({ error: 'Faltan campos requeridos: slug, nombre, marca, categoria, anio, precio_usd' });
    }

    const stmt = db.prepare(`
      INSERT INTO productos (
        slug, nombre, marca, categoria, anio, precio_usd, stock_disponible,
        cilindrada_cc, potencia_hp, torque_nm, transmision, peso_kg, tanque_litros,
        consumo_kml, velocidad_max, frenos, suspension, electronica,
        colores_json, imagenes_json, descripcion, destacado
      ) VALUES (
        @slug, @nombre, @marca, @categoria, @anio, @precio_usd, @stock_disponible,
        @cilindrada_cc, @potencia_hp, @torque_nm, @transmision, @peso_kg, @tanque_litros,
        @consumo_kml, @velocidad_max, @frenos, @suspension, @electronica,
        @colores_json, @imagenes_json, @descripcion, @destacado
      )
    `);

    const info = stmt.run({
      slug, nombre, marca, categoria, anio, precio_usd,
      stock_disponible: stock_disponible ?? 0,
      cilindrada_cc: cilindrada_cc ?? null,
      potencia_hp: potencia_hp ?? null,
      torque_nm: torque_nm ?? null,
      transmision: transmision ?? null,
      peso_kg: peso_kg ?? null,
      tanque_litros: tanque_litros ?? null,
      consumo_kml: consumo_kml ?? null,
      velocidad_max: velocidad_max ?? null,
      frenos: frenos ?? null,
      suspension: suspension ?? null,
      electronica: electronica ?? null,
      colores_json: colores_json ?? null,
      imagenes_json: imagenes_json ?? null,
      descripcion: descripcion ?? null,
      destacado: destacado ?? 0
    });

    const nuevo = db.prepare('SELECT * FROM productos WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(nuevo);
  } catch (err) {
    console.error('[POST /api/productos]', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Ya existe un producto con ese slug' });
    }
    res.status(500).json({ error: 'Error al crear producto', detail: err.message });
  }
});

// PATCH /api/productos/:id/stock
app.patch('/api/productos/:id/stock', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { cantidad } = req.body;

    if (cantidad === undefined || typeof cantidad !== 'number') {
      return res.status(400).json({ error: 'Se requiere el campo "cantidad" (número)' });
    }

    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const nuevoStock = producto.stock_disponible + cantidad;
    if (nuevoStock < 0) {
      return res.status(400).json({ error: `Stock insuficiente. Stock actual: ${producto.stock_disponible}` });
    }

    db.prepare('UPDATE productos SET stock_disponible = ? WHERE id = ?').run(nuevoStock, id);
    const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    res.json(actualizado);
  } catch (err) {
    console.error('[PATCH /api/productos/:id/stock]', err);
    res.status(500).json({ error: 'Error al actualizar stock', detail: err.message });
  }
});

// ═════════════════════════════════════════════
// ROUTES — Auth
// ═════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Se requieren email y password' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

    if (!usuario || usuario.password !== password) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Return user without password
    const { password: _pw, ...usuarioPublico } = usuario;
    res.json(usuarioPublico);
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ error: 'Error en autenticación', detail: err.message });
  }
});

// ═════════════════════════════════════════════
// ROUTES — Pedidos
// ═════════════════════════════════════════════

// GET /api/pedidos
app.get('/api/pedidos', (req, res) => {
  try {
    const { email, estado } = req.query;

    let sql = 'SELECT * FROM pedidos WHERE 1=1';
    const params = [];

    if (email) {
      sql += ' AND cliente_email = ?';
      params.push(email);
    }
    if (estado) {
      sql += ' AND estado_logistico = ?';
      params.push(estado);
    }

    sql += ' ORDER BY fecha_creacion DESC';

    const pedidos = db.prepare(sql).all(...params);
    const result = pedidos.map(p => ({ ...p, codigo: p.codigo_orden }));
    res.json(result);
  } catch (err) {
    console.error('[GET /api/pedidos]', err);
    res.status(500).json({ error: 'Error al obtener pedidos', detail: err.message });
  }
});

// POST /api/pedidos/paypal
app.post('/api/pedidos/paypal', (req, res) => {
  try {
    let buyer = req.body.buyer;
    if (typeof buyer === 'string') {
      try { buyer = JSON.parse(buyer); } catch(e) {}
    }

    const orderID = req.body.orderID || req.body.referencia_pago;
    const cliente_nombre = req.body.cliente_nombre || buyer?.nombre;
    const cliente_email = req.body.cliente_email || buyer?.email;
    const cliente_telefono = req.body.cliente_telefono || buyer?.telefono;
    const cliente_ci = req.body.cliente_ci || buyer?.ci;
    const direccion_entrega = req.body.direccion_entrega || buyer?.direccion;
    const ciudad = req.body.ciudad || buyer?.ciudad;

    let items = req.body.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) {}
    }

    if (!orderID || !cliente_nombre || !cliente_email || !items || !items.length) {
      return res.status(400).json({ error: 'Faltan campos requeridos para el pedido PayPal' });
    }

    // Calcular montos si no vienen
    let subtotal_usd = parseFloat(req.body.subtotal_usd);
    if (isNaN(subtotal_usd)) {
      subtotal_usd = items.reduce((acc, it) => acc + (parseFloat(it.precio_usd || 0) * (it.cantidad || 1)), 0);
    }
    let impuestos_tramite_usd = parseFloat(req.body.impuestos_tramite_usd);
    if (isNaN(impuestos_tramite_usd)) {
      impuestos_tramite_usd = subtotal_usd * 0.05;
    }
    let total_usd = parseFloat(req.body.total_usd || req.body.total);
    if (isNaN(total_usd)) {
      total_usd = subtotal_usd + impuestos_tramite_usd;
    }

    // Validate & atomically decrement stock
    try {
      decrementarStock(items);
    } catch (stockErr) {
      return res.status(409).json({ error: stockErr.message });
    }

    const codigo_orden = req.body.refCode || generarCodigoOrden();
    const fecha_creacion = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO pedidos (
        codigo_orden, cliente_nombre, cliente_email, cliente_telefono, cliente_ci,
        direccion_entrega, ciudad, items_json, subtotal_usd, impuestos_tramite_usd,
        total_usd, metodo_pago, estado_pago, referencia_pago, estado_logistico, fecha_creacion
      ) VALUES (
        @codigo_orden, @cliente_nombre, @cliente_email, @cliente_telefono, @cliente_ci,
        @direccion_entrega, @ciudad, @items_json, @subtotal_usd, @impuestos_tramite_usd,
        @total_usd, @metodo_pago, @estado_pago, @referencia_pago, @estado_logistico, @fecha_creacion
      )
    `);

    const info = stmt.run({
      codigo_orden,
      cliente_nombre,
      cliente_email,
      cliente_telefono: cliente_telefono || 'S/T',
      cliente_ci: cliente_ci || 'S/CI',
      direccion_entrega: direccion_entrega || 'Concesionario MotoConnect',
      ciudad: ciudad || 'La Paz',
      items_json: JSON.stringify(items),
      subtotal_usd,
      impuestos_tramite_usd,
      total_usd,
      metodo_pago: 'PAYPAL',
      estado_pago: 'VERIFICADO',
      referencia_pago: orderID,
      estado_logistico: 'LISTO_PARA_PREPARAR',
      fecha_creacion
    });

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(info.lastInsertRowid);
    pedido.codigo = pedido.codigo_orden;
    res.status(201).json(pedido);
  } catch (err) {
    console.error('[POST /api/pedidos/paypal]', err);
    res.status(500).json({ error: 'Error al crear pedido PayPal', detail: err.message });
  }
});

// POST /api/pedidos/bancario  (multipart)
app.post('/api/pedidos/bancario', upload.single('comprobante'), (req, res) => {
  try {
    let buyer = req.body.buyer;
    if (typeof buyer === 'string') {
      try { buyer = JSON.parse(buyer); } catch(e) {}
    }

    const cliente_nombre = req.body.cliente_nombre || buyer?.nombre;
    const cliente_email = req.body.cliente_email || buyer?.email;
    const cliente_telefono = req.body.cliente_telefono || buyer?.telefono;
    const cliente_ci = req.body.cliente_ci || buyer?.ci;
    const direccion_entrega = req.body.direccion_entrega || buyer?.direccion;
    const ciudad = req.body.ciudad || buyer?.ciudad;
    const referencia_pago = req.body.referencia_pago || req.body.ref;
    const tipo = (req.body.tipo || '').toLowerCase();
    const metodo_pago = req.body.metodo_pago || (tipo === 'qr' ? 'QR_BANCARIO' : 'DEPOSITO_BANCARIO');

    let items = req.body.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) {}
    }

    if (!cliente_nombre || !cliente_email || !items || !items.length) {
      return res.status(400).json({ error: 'Faltan campos requeridos para el pedido bancario' });
    }

    // Calcular montos
    let subtotal_usd = parseFloat(req.body.subtotal_usd);
    if (isNaN(subtotal_usd)) {
      subtotal_usd = items.reduce((acc, it) => acc + (parseFloat(it.precio_usd || 0) * (it.cantidad || 1)), 0);
    }
    let impuestos_tramite_usd = parseFloat(req.body.impuestos_tramite_usd);
    if (isNaN(impuestos_tramite_usd)) {
      impuestos_tramite_usd = subtotal_usd * 0.05;
    }
    let total_usd = parseFloat(req.body.total_usd || req.body.total);
    if (isNaN(total_usd)) {
      total_usd = subtotal_usd + impuestos_tramite_usd;
    }

    // Validate stock availability (do NOT decrement yet)
    try {
      verificarStock(items);
    } catch (stockErr) {
      return res.status(409).json({ error: stockErr.message });
    }

    // Comprobante URL
    const comprobante_url = req.file ? `/uploads/${req.file.filename}` : null;

    const codigo_orden = req.body.refCode || generarCodigoOrden();
    const fecha_creacion = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO pedidos (
        codigo_orden, cliente_nombre, cliente_email, cliente_telefono, cliente_ci,
        direccion_entrega, ciudad, items_json, subtotal_usd, impuestos_tramite_usd,
        total_usd, metodo_pago, estado_pago, referencia_pago, comprobante_url,
        estado_logistico, fecha_creacion
      ) VALUES (
        @codigo_orden, @cliente_nombre, @cliente_email, @cliente_telefono, @cliente_ci,
        @direccion_entrega, @ciudad, @items_json, @subtotal_usd, @impuestos_tramite_usd,
        @total_usd, @metodo_pago, @estado_pago, @referencia_pago, @comprobante_url,
        @estado_logistico, @fecha_creacion
      )
    `);

    const info = stmt.run({
      codigo_orden,
      cliente_nombre,
      cliente_email,
      cliente_telefono: cliente_telefono || 'S/T',
      cliente_ci: cliente_ci || 'S/CI',
      direccion_entrega: direccion_entrega || 'Concesionario MotoConnect',
      ciudad: ciudad || 'La Paz',
      items_json: JSON.stringify(items),
      subtotal_usd,
      impuestos_tramite_usd,
      total_usd,
      metodo_pago,
      estado_pago: 'EN_REVISION',
      referencia_pago: referencia_pago || null,
      comprobante_url,
      estado_logistico: 'ESPERANDO_PAGO',
      fecha_creacion
    });

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(info.lastInsertRowid);
    pedido.codigo = pedido.codigo_orden;
    res.status(201).json(pedido);
  } catch (err) {
    console.error('[POST /api/pedidos/bancario]', err);
    res.status(500).json({ error: 'Error al crear pedido bancario', detail: err.message });
  }
});

// PATCH /api/pedidos/:id/aprobar-pago
app.patch('/api/pedidos/:id/aprobar-pago', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { responsable_pagos } = req.body;

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Parse items from pedido
    let items;
    try {
      items = JSON.parse(pedido.items_json);
    } catch (e) {
      return res.status(500).json({ error: 'Error al parsear items del pedido' });
    }

    // Verify stock and atomically decrement
    try {
      decrementarStock(items);
    } catch (stockErr) {
      return res.status(409).json({ error: stockErr.message });
    }

    const fecha_pago_verificado = new Date().toISOString();

    db.prepare(`
      UPDATE pedidos SET
        estado_pago = 'VERIFICADO',
        estado_logistico = 'LISTO_PARA_PREPARAR',
        responsable_pagos = @responsable_pagos,
        fecha_pago_verificado = @fecha_pago_verificado
      WHERE id = @id
    `).run({ responsable_pagos: responsable_pagos || null, fecha_pago_verificado, id });

    const actualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    actualizado.codigo = actualizado.codigo_orden;
    res.json(actualizado);
  } catch (err) {
    console.error('[PATCH /api/pedidos/:id/aprobar-pago]', err);
    res.status(500).json({ error: 'Error al aprobar pago', detail: err.message });
  }
});

// PATCH /api/pedidos/:id/rechazar-pago
app.patch('/api/pedidos/:id/rechazar-pago', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { motivo_rechazo, responsable_pagos } = req.body;

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    db.prepare(`
      UPDATE pedidos SET
        estado_pago = 'RECHAZADO',
        estado_logistico = 'CANCELADO',
        motivo_rechazo = @motivo_rechazo,
        responsable_pagos = @responsable_pagos
      WHERE id = @id
    `).run({
      motivo_rechazo: motivo_rechazo || null,
      responsable_pagos: responsable_pagos || null,
      id
    });

    const actualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    actualizado.codigo = actualizado.codigo_orden;
    res.json(actualizado);
  } catch (err) {
    console.error('[PATCH /api/pedidos/:id/rechazar-pago]', err);
    res.status(500).json({ error: 'Error al rechazar pago', detail: err.message });
  }
});

// PATCH /api/pedidos/:id/preparar-empaque
app.patch('/api/pedidos/:id/preparar-empaque', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vin_asignado = req.body.vin_asignado || req.body.vin;
    const checklist_pdi = req.body.checklist_pdi || (req.body.pdi_completado ? [true, true, true, true] : null);
    const codigo_empaque = req.body.codigo_empaque || req.body.pkg;
    const notas_almacen = req.body.notas_almacen || req.body.notas;
    const responsable_empaque = req.body.responsable_empaque || req.body.responsable || 'Jefe de Almacén PDI';

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const fecha_empacado = new Date().toISOString();
    const checklist_pdi_json = checklist_pdi ? JSON.stringify(checklist_pdi) : null;

    db.prepare(`
      UPDATE pedidos SET
        estado_logistico = 'EMPACADO_LISTO_DESPACHO',
        vin_asignado = @vin_asignado,
        checklist_pdi_json = @checklist_pdi_json,
        codigo_empaque = @codigo_empaque,
        notas_almacen = @notas_almacen,
        responsable_empaque = @responsable_empaque,
        fecha_empacado = @fecha_empacado
      WHERE id = @id
    `).run({
      vin_asignado: vin_asignado || null,
      checklist_pdi_json,
      codigo_empaque: codigo_empaque || null,
      notas_almacen: notas_almacen || null,
      responsable_empaque: responsable_empaque || null,
      fecha_empacado,
      id
    });

    const actualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    actualizado.codigo = actualizado.codigo_orden;
    res.json(actualizado);
  } catch (err) {
    console.error('[PATCH /api/pedidos/:id/preparar-empaque]', err);
    res.status(500).json({ error: 'Error al actualizar empaque', detail: err.message });
  }
});

// PATCH /api/pedidos/:id/en-ruta y alias /despachar
const handleEnRuta = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    db.prepare(`
      UPDATE pedidos SET estado_logistico = 'EN_RUTA_ENTREGA' WHERE id = ?
    `).run(id);

    const actualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    actualizado.codigo = actualizado.codigo_orden;
    res.json(actualizado);
  } catch (err) {
    console.error('[PATCH /api/pedidos/:id/en-ruta]', err);
    res.status(500).json({ error: 'Error al actualizar estado a en-ruta', detail: err.message });
  }
};

app.patch('/api/pedidos/:id/en-ruta', handleEnRuta);
app.patch('/api/pedidos/:id/despachar', handleEnRuta);

// PATCH /api/pedidos/:id/entregar
app.patch('/api/pedidos/:id/entregar', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      receptor_nombre,
      receptor_ci,
      firma_entrega_base64,
      responsable_entrega
    } = req.body;

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const fecha_entrega = new Date().toISOString();

    db.prepare(`
      UPDATE pedidos SET
        estado_logistico = 'ENTREGADO_FINALIZADO',
        receptor_nombre = @receptor_nombre,
        receptor_ci = @receptor_ci,
        firma_entrega_base64 = @firma_entrega_base64,
        responsable_entrega = @responsable_entrega,
        fecha_entrega = @fecha_entrega
      WHERE id = @id
    `).run({
      receptor_nombre: receptor_nombre || null,
      receptor_ci: receptor_ci || null,
      firma_entrega_base64: firma_entrega_base64 || null,
      responsable_entrega: responsable_entrega || null,
      fecha_entrega,
      id
    });

    const actualizado = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
    actualizado.codigo = actualizado.codigo_orden;
    res.json(actualizado);
  } catch (err) {
    console.error('[PATCH /api/pedidos/:id/entregar]', err);
    res.status(500).json({ error: 'Error al registrar entrega', detail: err.message });
  }
});

// ─────────────────────────────────────────────
// 404 handler for API routes
// ─────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Endpoint no encontrado: ${req.method} ${req.originalUrl}` });
});

// ─────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
});

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏍️  MotoConnect Server running on http://localhost:${PORT}`);
  console.log(`📦  Static files served from: ${__dirname}`);
  console.log(`🗄️  Database: ${path.resolve(DB_PATH)}\n`);
});
