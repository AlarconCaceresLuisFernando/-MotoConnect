import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  ADVISOR_QUESTIONS,
  rankAdvisorRecommendations,
  buildWhatsAppAdvisorUrl,
} from '../js/utils/advisorLogic.js';

const require = createRequire(import.meta.url);
const { buildSmartSupportReply, extractBudgetBs } = require('../lib/supportLogic.js');
const { buildProductPapersPdfBuffer, buildOrderDocumentsPdfBuffer } = require('../lib/pdfService.js');

const SAMPLE_PRODUCTS = [
  {
    id: 1,
    slug: 'bajaj-boxer-bm150-2026',
    nombre: 'Bajaj Boxer BM 150',
    marca: 'Bajaj',
    categoria: 'Trabajo',
    anio: 2026,
    precio_usd: 1552,
    stock_disponible: 12,
    cilindrada_cc: 144.8,
    potencia_hp: '12 HP',
    consumo_kml: '55 km/L',
    peso_kg: 123,
    tanque_litros: 11,
    frenos: 'Tambor delantero y trasero',
    electronica: 'Arranque eléctrico y pedal',
  },
  {
    id: 2,
    slug: 'ktm-duke-250-abs-2026',
    nombre: 'KTM Duke 250 ABS',
    marca: 'KTM',
    categoria: 'Naked',
    anio: 2026,
    precio_usd: 5589,
    stock_disponible: 4,
    cilindrada_cc: 248.8,
    potencia_hp: '30 HP',
    consumo_kml: '32 km/L',
    peso_kg: 162,
    tanque_litros: 13.4,
    frenos: 'Disco delantero ABS, disco trasero',
    electronica: 'ABS doble canal, tablero TFT',
  },
  {
    id: 3,
    slug: 'honda-xr150l-2026',
    nombre: 'Honda XR 150L',
    marca: 'Honda',
    categoria: 'Adventure',
    anio: 2026,
    precio_usd: 3147,
    stock_disponible: 7,
    cilindrada_cc: 149.1,
    potencia_hp: '12.1 HP',
    consumo_kml: '42 km/L',
    peso_kg: 129,
    tanque_litros: 12,
    frenos: 'Tambor delantero y trasero',
    suspension: 'Horquilla largo recorrido',
  },
  {
    id: 4,
    slug: 'casco-ece-2026',
    nombre: 'Casco ECE',
    marca: 'LS2',
    categoria: 'Equipamiento',
    anio: 2026,
    precio_usd: 208,
    stock_disponible: 10,
  },
];

test('Advisor has 4 coherent steps and ranks work + savings accurately', () => {
  assert.equal(ADVISOR_QUESTIONS.length, 4);
  const ranked = rankAdvisorRecommendations(SAMPLE_PRODUCTS, {
    uso: 'trabajo',
    presupuesto: 'hasta_15000',
    experiencia: 'principiante',
    prioridad: 'ahorro',
  });
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].product.slug, 'bajaj-boxer-bm150-2026');
  assert.ok(ranked[0].reasons.length >= 2);
  assert.ok(!ranked.some(r => r.product.categoria === 'Equipamiento'));
});

test('WhatsApp Advisor URL targets +59167671435 and includes answers and selected motorcycle', () => {
  const url = buildWhatsAppAdvisorUrl({
    answers: {
      uso: 'aventura',
      presupuesto: 'hasta_25000',
      experiencia: 'intermedio',
      prioridad: 'terreno',
    },
    product: SAMPLE_PRODUCTS[2],
    extraNote: 'Envío a La Paz',
  });
  assert.ok(url.startsWith('https://wa.me/59167671435?text='));
  const decoded = decodeURIComponent(url.split('text=')[1]);
  assert.match(decoded, /Honda XR 150L/);
  assert.match(decoded, /Viajes, caminos de tierra/);
  assert.match(decoded, /Envío a La Paz/);
});

test('Support AI logic answers undecided buyers, paperwork questions, and budget parsing', () => {
  assert.equal(extractBudgetBs('tengo 22000 bs'), 22000);
  const paperReply = buildSmartSupportReply('¿Qué papeles entregan con la moto?', SAMPLE_PRODUCTS);
  assert.match(paperReply, /Factura Comercial/);
  assert.match(paperReply, /RUAT/);
  assert.match(paperReply, /\+591 67671435/);

  const helpReply = buildSmartSupportReply('No sé qué moto elegir para trabajo', SAMPLE_PRODUCTS);
  assert.match(helpReply, /Bajaj Boxer BM 150/);
});

test('PDF service builds valid %PDF buffers for products and orders', async () => {
  const prodPdf = await buildProductPapersPdfBuffer(SAMPLE_PRODUCTS[1], { hasCustomDoc: false });
  assert.ok(Buffer.isBuffer(prodPdf));
  assert.equal(prodPdf.subarray(0, 5).toString('utf8'), '%PDF-');

  const orderPdf = await buildOrderDocumentsPdfBuffer(
    {
      codigo_orden: 'MC-2026-9999',
      cliente_nombre: 'Carlos Mendoza',
      cliente_email: 'cliente@motoconnect.com',
      cliente_ci: '7654321',
      cliente_telefono: '+591 70000000',
      ciudad: 'La Paz',
      direccion_entrega: 'Av. Arce 123',
      metodo_pago: 'TARJETA',
      estado_pago: 'VERIFICADO',
      estado_logistico: 'LISTO_PARA_PREPARAR',
      total_usd: 5868.45,
      items_json: JSON.stringify([{ productoId: 2, slug: 'ktm-duke-250-abs-2026', nombre: 'KTM Duke 250 ABS', cantidad: 1, precio_usd: 5589, color: 'Estándar' }]),
      fecha_creacion: new Date().toISOString(),
    },
    SAMPLE_PRODUCTS
  );
  assert.ok(Buffer.isBuffer(orderPdf));
  assert.equal(orderPdf.subarray(0, 5).toString('utf8'), '%PDF-');
});
