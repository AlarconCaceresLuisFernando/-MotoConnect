// ============================================================
// MotoConnect — lib/pdfService.js
// Generación real de expedientes y papeles oficiales en PDF (pdfkit)
// ============================================================

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BS_RATE = 6.96;

function fmtUsd(val) {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtBs(val) {
  return `Bs ${Math.round(Number(val || 0) * BS_RATE).toLocaleString('en-US')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createPdfBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      info: {
        Title: 'MotoConnect — Documentación Oficial',
        Author: 'MotoConnect S.R.L.',
        Creator: 'MotoConnect Bolivia',
      },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      buildFn(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawHeader(doc, title, subtitle) {
  const logoPath = path.resolve(__dirname, '..', 'assets', 'logo-motoconnect.jpg');
  const startY = doc.y;

  doc.save();
  doc.rect(44, startY, 507, 68).fill('#0F172A');
  doc.rect(44, startY + 64, 507, 4).fill('#F95715');

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, 56, startY + 12, { width: 42, height: 42 });
    } catch {
      /* ignore logo render error */
    }
  }

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(15)
    .text('MOTOCONNECT BOLIVIA S.R.L.', 108, startY + 14);
  doc
    .fillColor('#F95715')
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .text(title, 108, startY + 34);
  doc
    .fillColor('#CBD5E1')
    .font('Helvetica')
    .fontSize(8.5)
    .text(subtitle, 108, startY + 49);
  doc.restore();

  doc.y = startY + 82;
}

function drawSectionTitle(doc, label) {
  if (doc.y > 720) doc.addPage();
  doc.moveDown(0.35);
  const y = doc.y;
  doc.save();
  doc.rect(44, y, 4, 15).fill('#F95715');
  doc
    .fillColor('#0F172A')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(label, 54, y + 1);
  doc.restore();
  doc.y = y + 20;
}

function drawKeyValueGrid(doc, pairs) {
  const filtered = pairs.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
  for (let i = 0; i < filtered.length; i += 2) {
    if (doc.y > 735) doc.addPage();
    const y = doc.y;
    const left = filtered[i];
    const right = filtered[i + 1];

    doc.save();
    doc.rect(44, y, 248, 30).fill('#F8FAFC').stroke('#E2E8F0');
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5).text(String(left[0]).toUpperCase(), 50, y + 5, { width: 236 });
    doc.fillColor('#0F172A').font('Helvetica').fontSize(9).text(String(left[1]), 50, y + 15, { width: 236, ellipsis: true });

    if (right) {
      doc.rect(303, y, 248, 30).fill('#F8FAFC').stroke('#E2E8F0');
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.5).text(String(right[0]).toUpperCase(), 309, y + 5, { width: 236 });
      doc.fillColor('#0F172A').font('Helvetica').fontSize(9).text(String(right[1]), 309, y + 15, { width: 236, ellipsis: true });
    }
    doc.restore();
    doc.y = y + 34;
  }
}

function officialPaperworkItems(isEquipment = false) {
  if (isEquipment) {
    return [
      ['1. Factura Comercial / Nota Fiscal', 'Emitida a nombre completo y CI/NIT del comprador registrado en Bolivia.'],
      ['2. Certificación de Seguridad', 'Validación de norma técnica internacional (ECE 22.06 / CE Nivel 2 según producto).'],
      ['3. Garantía Oficial MotoConnect', 'Cobertura de 12 meses contra defectos de fabricación o ajuste de fábrica.'],
      ['4. Control de Empaque Sellado', 'Verificación de talla, integridad de protecciones y sellado logístico previo a envío.'],
    ];
  }
  return [
    ['1. Factura Comercial de Venta', 'Documento tributario oficial a nombre del titular y CI/NIT para respaldo de propiedad.'],
    ['2. Póliza de Importación / DUA', 'Declaración Única de Importación ante Aduana Nacional de Bolivia y certificación de origen.'],
    ['3. Carpeta RUAT y Placa Tránsito', 'Formulario de registro vehicular municipal (RUAT), verificación de motor/chasis y gestión de placa.'],
    ['4. Seguro Obligatorio SOAT', 'Cobertura obligatoria de accidentes de tránsito habilitada para circulación legal inmediata.'],
    ['5. Certificado PDI 40 Puntos', 'Acta técnica de pre-entrega firmada + 2 llaves codificadas + kit de herramientas + manual en español.'],
    ['6. Póliza de Garantía Oficial', 'Cobertura de fábrica de 24 meses o kilometraje especificado por la marca en red autorizada.'],
  ];
}

function drawFooter(doc) {
  const bottom = 776;
  doc.save();
  doc.moveTo(44, bottom).lineTo(551, bottom).strokeColor('#CBD5E1').lineWidth(0.75).stroke();
  doc
    .fillColor('#475569')
    .font('Helvetica')
    .fontSize(8)
    .text(
      `MotoConnect Bolivia S.R.L. · Soporte y Asesoría WhatsApp: +591 67671435 · Generado: ${fmtDate(new Date().toISOString())}`,
      44,
      bottom + 7,
      { width: 507, align: 'center' }
    );
  doc.restore();
}

async function buildProductPapersPdfBuffer(product, opts = {}) {
  const isEquipment = ['Equipamiento', 'Accesorio'].includes(product.categoria);
  return createPdfBuffer(doc => {
    drawHeader(
      doc,
      isEquipment ? 'EXPEDIENTE OFICIAL DE EQUIPAMIENTO CERTIFICADO' : 'EXPEDIENTE OFICIAL DE PAPELES Y FICHA TÉCNICA',
      `Modelo: ${product.nombre} · Marca: ${product.marca} · Año: ${product.anio} · SKU: ${product.slug}`
    );

    drawSectionTitle(doc, 'Identificación Comercial y Disponibilidad');
    drawKeyValueGrid(doc, [
      ['Modelo', product.nombre],
      ['Marca / Categoría', `${product.marca} · ${product.categoria}`],
      ['Año Modelo', String(product.anio || '2026')],
      ['Código / SKU', product.slug],
      ['Precio Oficial (Bs)', fmtBs(product.precio_usd)],
      ['Precio Referencial (USD)', `$${fmtUsd(product.precio_usd)} USD`],
      ['Stock Actual en Concesionario', Number(product.stock_disponible) > 0 ? `${product.stock_disponible} unidad(es) disponible(s)` : 'Agotado (próximo embarque)'],
      ['Documento Oficial Admin', product.documento_papeles_nombre ? `Adjunto: ${product.documento_papeles_nombre}` : 'Dossier estándar MotoConnect'],
    ]);

    drawSectionTitle(doc, 'Especificaciones Técnicas Registradas');
    drawKeyValueGrid(doc, [
      ['Cilindrada', product.cilindrada_cc ? `${product.cilindrada_cc} cc` : 'No aplica'],
      ['Potencia Máxima', product.potencia_hp || 'No aplica'],
      ['Torque Máximo', product.torque_nm || 'No aplica'],
      ['Transmisión', product.transmision || 'No aplica'],
      ['Peso en Orden de Marcha', product.peso_kg ? `${product.peso_kg} kg` : 'No aplica'],
      ['Capacidad de Tanque', product.tanque_litros ? `${product.tanque_litros} L` : 'No aplica'],
      ['Consumo Referencial', product.consumo_kml || 'No aplica'],
      ['Velocidad Máxima', product.velocidad_max || 'No aplica'],
      ['Sistema de Frenos', product.frenos || 'No aplica'],
      ['Suspensión', product.suspension || 'No aplica'],
      ['Electrónica / Asistencias', product.electronica || 'Estándar de fábrica'],
    ]);

    if (product.descripcion || product.homologacion_notas) {
      drawSectionTitle(doc, 'Descripción y Notas de Homologación');
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(9.5)
        .text(product.descripcion || '', 44, doc.y, { width: 507, align: 'left' });
      if (product.homologacion_notas) {
        doc.moveDown(0.4);
        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(`Notas legales / homologación: ${product.homologacion_notas}`, 44, doc.y, { width: 507 });
      }
      doc.moveDown(0.5);
    }

    drawSectionTitle(doc, isEquipment ? 'Documentación de Compra Incluida' : 'Paquete de Papeles Oficiales Incluidos en la Compra (Bolivia)');
    for (const [docTitle, docDesc] of officialPaperworkItems(isEquipment)) {
      if (doc.y > 720) doc.addPage();
      const y = doc.y;
      doc.save();
      doc.rect(44, y, 507, 34).fill('#FFFFFF').stroke('#CBD5E1');
      doc.fillColor('#F95715').font('Helvetica-Bold').fontSize(9).text(docTitle, 52, y + 5, { width: 491 });
      doc.fillColor('#334155').font('Helvetica').fontSize(8.3).text(docDesc, 52, y + 17, { width: 491 });
      doc.restore();
      doc.y = y + 38;
    }

    if (opts.hasCustomDoc) {
      doc.moveDown(0.3);
      doc
        .fillColor('#0369A1')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(
          `Nota: Este modelo cuenta además con un documento oficial adjunto por administración (${product.documento_papeles_nombre || 'archivo oficial'}) descargable desde la ficha técnica.`,
          44,
          doc.y,
          { width: 507 }
        );
    }

    drawFooter(doc);
  });
}

async function buildOrderDocumentsPdfBuffer(order, productsList = []) {
  let items = [];
  try {
    items = JSON.parse(order.items_json || '[]');
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }

  const byId = new Map((productsList || []).map(p => [Number(p.id), p]));
  const bySlug = new Map((productsList || []).map(p => [String(p.slug), p]));

  return createPdfBuffer(doc => {
    drawHeader(
      doc,
      `CARPETA DE COMPRA Y PAPELES OFICIALES · ORDEN ${order.codigo_orden || ''}`,
      `Emitido para: ${order.cliente_nombre || ''} · CI/NIT: ${order.cliente_ci || '—'} · Estado Pago: ${order.estado_pago || ''}`
    );

    drawSectionTitle(doc, 'Datos del Comprador y Orden');
    drawKeyValueGrid(doc, [
      ['Código de Orden', order.codigo_orden || order.codigo || '—'],
      ['Fecha de Registro', fmtDate(order.fecha_creacion)],
      ['Cliente / Titular', order.cliente_nombre || '—'],
      ['CI / NIT', order.cliente_ci || '—'],
      ['Correo Electrónico', order.cliente_email || '—'],
      ['Teléfono de Contacto', order.cliente_telefono || '—'],
      ['Ciudad y Dirección', `${order.ciudad || '—'} · ${order.direccion_entrega || '—'}`],
      ['Método y Estado de Pago', `${order.metodo_pago || '—'} (${order.estado_pago || '—'})`],
      ['Referencia de Pago', order.referencia_pago || '—'],
      ['Total Facturado', `${fmtBs(order.total_usd)} (≈ $${fmtUsd(order.total_usd)} USD)`],
    ]);

    drawSectionTitle(doc, 'Trazabilidad Vehicular e Inspección PDI');
    drawKeyValueGrid(doc, [
      ['Estado Logístico', order.estado_logistico || '—'],
      ['VIN / Chasis Asignado', order.vin_asignado || 'Por asignar en almacén PDI'],
      ['Código de Empaque', order.codigo_empaque || 'Pendiente de empaque'],
      ['Inspección PDI', `${Number(order.pdi_completados || 0)} / ${Number(order.pdi_total_puntos || 40)} puntos técnicos`],
      ['Receptor en Entrega', order.receptor_nombre ? `${order.receptor_nombre} (CI ${order.receptor_ci || '—'})` : 'Entrega pendiente'],
      ['Fecha de Entrega', order.fecha_entrega ? fmtDate(order.fecha_entrega) : 'En proceso'],
    ]);

    drawSectionTitle(doc, 'Unidades Adquiridas y Especificaciones');
    for (const item of items) {
      if (doc.y > 685) doc.addPage();
      const prod = byId.get(Number(item.productoId)) || bySlug.get(String(item.slug || '')) || {};
      const y = doc.y;
      const lineTotal = Number(item.precio_usd || 0) * Number(item.cantidad || 1);
      doc.save();
      doc.rect(44, y, 507, 48).fill('#F8FAFC').stroke('#CBD5E1');
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(`${item.nombre || prod.nombre || 'Producto'} (${prod.marca || 'MotoConnect'})`, 52, y + 7, { width: 340 });
      doc
        .fillColor('#F95715')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(`${fmtBs(lineTotal)} ($${fmtUsd(lineTotal)})`, 392, y + 7, { width: 150, align: 'right' });
      doc
        .fillColor('#475569')
        .font('Helvetica')
        .fontSize(8.2)
        .text(
          `Color: ${item.color || 'Estándar'} · Cantidad: ${item.cantidad || 1} · Categoría: ${prod.categoria || 'Motocicleta'} · ${prod.cilindrada_cc ? `${prod.cilindrada_cc} cc · ` : ''}${prod.potencia_hp || ''}`,
          52,
          y + 22,
          { width: 490 }
        );
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(7.8)
        .text(
          `Documentación asociada: Factura comercial, Póliza/DUA, RUAT, SOAT y Garantía oficial.`,
          52,
          y + 34,
          { width: 490 }
        );
      doc.restore();
      doc.y = y + 54;
    }

    drawSectionTitle(doc, 'Detalle de Papeles Oficiales y Legalización');
    for (const [docTitle, docDesc] of officialPaperworkItems(false)) {
      if (doc.y > 720) doc.addPage();
      const y = doc.y;
      doc.save();
      doc.rect(44, y, 507, 32).fill('#FFFFFF').stroke('#CBD5E1');
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.8).text(docTitle, 52, y + 5, { width: 491 });
      doc.fillColor('#475569').font('Helvetica').fontSize(8).text(docDesc, 52, y + 16, { width: 491 });
      doc.restore();
      doc.y = y + 36;
    }

    drawFooter(doc);
  });
}

module.exports = {
  buildProductPapersPdfBuffer,
  buildOrderDocumentsPdfBuffer,
};
