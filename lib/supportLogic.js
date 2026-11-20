// ============================================================
// MotoConnect — lib/supportLogic.js
// Lógica de soporte al cliente y respuestas IA basadas en inventario SQLite
// ============================================================

const BS_RATE = 6.96;
const WHATSAPP_DISPLAY = '+591 67671435';

function fmtBsLocal(usd) {
  return `Bs ${Math.round(Number(usd || 0) * BS_RATE).toLocaleString('en-US')}`;
}

function fmtUsdLocal(usd) {
  return `$${Number(usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractBudgetBs(normalized) {
  const matchBs = normalized.match(/(?:bs|bolivianos?)\s*\.?\s*(\d[\d.,]*)/i) ||
    normalized.match(/(\d[\d.,]*)\s*(?:bs|bolivianos?)/i);
  if (matchBs) {
    const num = Number(matchBs[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (Number.isFinite(num) && num > 100) return num;
  }
  const matchUsd = normalized.match(/(?:\$|usd|dolares?)\s*(\d[\d.,]*)/i) ||
    normalized.match(/(\d[\d.,]*)\s*(?:usd|dolares?)/i);
  if (matchUsd) {
    const num = Number(matchUsd[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (Number.isFinite(num) && num > 10) return num * BS_RATE;
  }
  return null;
}

function buildSmartSupportReply(mensaje, productos = []) {
  const norm = normalizeText(mensaje);
  const motos = productos.filter(p => p.categoria !== 'Equipamiento' && p.categoria !== 'Accesorio');
  const disponibles = motos.filter(p => Number(p.stock_disponible) > 0);
  const equip = productos.filter(p => (p.categoria === 'Equipamiento' || p.categoria === 'Accesorio') && Number(p.stock_disponible) > 0);

  // 1. Papeles / documentos / garantía / PDF / correo
  if (/(papel|documento|ruat|dua|poliza|factura|soat|placa|transito|garantia|pdf|correo|email)/.test(norm)) {
    return [
      'En MotoConnect todas nuestras motocicletas se entregan con documentación oficial completa para circular legalmente en Bolivia:',
      '1. Factura Comercial a nombre del titular y CI/NIT.',
      '2. Póliza de Importación / DUA (Aduana Nacional).',
      '3. Carpeta de registro RUAT / Tránsito para placa y CRPVA.',
      '4. Seguro SOAT + Inspección PDI de 40 puntos + 2 llaves codificadas + Garantía oficial de 24 meses.',
      '',
      'Puedes descargar el PDF oficial de papeles en la ficha de cada motocicleta o desde "Mis Pedidos" al comprar (y enviarlo a tu correo). Si necesitas revisar un trámite puntual, escríbenos por WhatsApp al ' + WHATSAPP_DISPLAY + '.'
    ].join('\n');
  }

  // 2. Pagos (PayPal, Tarjeta, QR)
  if (/(pago|pagar|paypal|tarjeta|visa|mastercard|qr|cuota|precio|transferencia)/.test(norm)) {
    return [
      'Aceptamos 3 métodos de pago verificados en Checkout:',
      '• PayPal (confirmación inmediata en servidor).',
      '• Pago con Tarjeta Visa o Mastercard (procesamiento cifrado sin guardar datos de tarjeta).',
      '• Pago con QR (adjuntas el comprobante y nuestro equipo de cobranzas lo valida).',
      '',
      'Los precios en catálogo están en Bolivianos (Bs) con referencia en USD (1 USD = 6.96 Bs). ¿Te ayudo a cotizar algún modelo o prefieres hablar por WhatsApp al ' + WHATSAPP_DISPLAY + '?'
    ].join('\n');
  }

  // 3. Envíos / entregas / WhatsApp / contacto
  if (/(envio|entrega|ciudad|llegar|tiempo|demora|whatsapp|telefono|numero|humano|asesor|contacto|sucursal)/.test(norm)) {
    return [
      'Realizamos entregas certificadas en las 9 ciudades principales de Bolivia (La Paz, Santa Cruz, Cochabamba, Sucre, Oruro, Potosí, Tarija, Beni y Pando).',
      'Cada moto pasa por una revisión técnica PDI de 40 puntos, asignación única de VIN y firma digital de conformidad al recibir.',
      `Para atención humana inmediata, cotización o envío de ficha técnica por WhatsApp escríbenos al ${WHATSAPP_DISPLAY} o usa el botón de WhatsApp en el Asesor por Preguntas.`
    ].join('\n');
  }

  // 4. Búsqueda directa de un modelo o marca
  const directMatches = productos.filter(p => {
    const hay = normalizeText(`${p.nombre} ${p.marca} ${p.categoria}`);
    return norm.split(/\s+/).some(word => word.length >= 3 && hay.includes(word));
  });
  if (directMatches.length && directMatches.length <= 4) {
    const lines = directMatches.map(p => {
      const stockTxt = Number(p.stock_disponible) > 0
        ? `${p.stock_disponible} en stock`
        : 'AGOTADA actualmente';
      return `• ${p.nombre} (${p.marca}, ${p.categoria}): ${fmtBsLocal(p.precio_usd)} (≈ ${fmtUsdLocal(p.precio_usd)} USD) — ${stockTxt}. ${p.cilindrada_cc ? `${p.cilindrada_cc} cc, ${p.potencia_hp || ''}, consumo ${p.consumo_kml || '—'}.` : p.descripcion || ''}`;
    });
    return `Encontré estos modelos en nuestro inventario actual:\n${lines.join('\n')}\n\nTodos incluyen expediente PDF de papeles oficiales en su ficha. ¿Quieres que te ayude a elegir o prefieres consultar por WhatsApp al ${WHATSAPP_DISPLAY}?`;
  }

  // 5. Potencia / velocidad
  if (/(potente|rapida|velocidad|mayor cilindrada|cc)/.test(norm)) {
    const topPower = [...disponibles]
      .sort((a, b) => Number(b.cilindrada_cc || 0) - Number(a.cilindrada_cc || 0))
      .slice(0, 3);
    if (topPower.length) {
      const list = topPower.map(
        p => `• ${p.nombre} (${p.marca}): ${p.cilindrada_cc} cc, ${p.potencia_hp}, vel. máx ${p.velocidad_max || '—'} — ${fmtBsLocal(p.precio_usd)} (${p.stock_disponible} en stock)`
      );
      return `Nuestras motos disponibles con mayor potencia y cilindrada hoy:\n${list.join('\n')}\n\n(Nota: los modelos con stock 0 figuran agotados hasta próximo embarque). ¿Te gustaría compararlas o consultar por WhatsApp (${WHATSAPP_DISPLAY})?`;
    }
  }

  // 6. Presupuesto o recomendación / cliente indeciso
  const budgetBs = extractBudgetBs(norm);
  let pool = disponibles;
  if (budgetBs) {
    const inBudget = disponibles.filter(p => Number(p.precio_usd) * BS_RATE <= budgetBs);
    if (inBudget.length) pool = inBudget;
  }

  if (/(trabajo|delivery|reparto|economica|barata|ahorro)/.test(norm)) {
    const work = pool.filter(p => p.categoria === 'Trabajo').slice(0, 3);
    if (work.length) {
      return `Para trabajo diario y bajo consumo en Bolivia te recomiendo:\n${work.map(p => `• ${p.nombre}: ${fmtBsLocal(p.precio_usd)} — ${p.consumo_kml || 'bajo consumo'}, ${p.stock_disponible} u. en stock`).join('\n')}\n\nTodas incluyen factura, DUA/Póliza y carpeta RUAT. Puedes completar el Asesor por Preguntas (#/recomendador) o escribirnos al ${WHATSAPP_DISPLAY}.`;
    }
  }

  if (/(aventura|viaje|tierra|ruta|campo|altura)/.test(norm)) {
    const adv = pool.filter(p => p.categoria === 'Adventure').slice(0, 3);
    if (adv.length) {
      return `Para rutas mixtas, viajes y altura te recomiendo:\n${adv.map(p => `• ${p.nombre}: ${fmtBsLocal(p.precio_usd)} — ${p.cilindrada_cc} cc, ${p.potencia_hp}, ${p.stock_disponible} u. en stock`).join('\n')}\n\nSi quieres asesoría personalizada con tu presupuesto, prueba el Asesor por Preguntas o escríbenos por WhatsApp al ${WHATSAPP_DISPLAY}.`;
    }
  }

  if (/(no se|ayuda|recomienda|elegir|principiante|primera moto|ciudad|urbana|quiero una moto|hola|buenas)/.test(norm) || budgetBs) {
    const picks = [
      pool.find(p => p.categoria === 'Trabajo'),
      pool.find(p => p.categoria === 'Urbana'),
      pool.find(p => p.categoria === 'Adventure' || p.categoria === 'Naked'),
    ].filter(Boolean);
    const shown = (picks.length ? picks : pool).slice(0, 3);
    return [
      budgetBs
        ? `Con un presupuesto de hasta Bs ${Math.round(budgetBs).toLocaleString('en-US')}, estas opciones están disponibles hoy:`
        : '¡Con gusto te ayudo a elegir! Para orientarte rápido, dime para qué la usarás (trabajo, ciudad, viajes o deportivo) y tu presupuesto en Bs. Mientras tanto, estas son 3 opciones destacadas en stock:',
      ...shown.map(p => `• ${p.nombre} (${p.categoria}): ${fmtBsLocal(p.precio_usd)} — ${p.cilindrada_cc || '—'} cc, ${p.stock_disponible} u. disponibles.`),
      '',
      `También puedes responder 4 preguntas rápidas en "Asesor por Preguntas" o enviarnos tu consulta directa por WhatsApp al ${WHATSAPP_DISPLAY}.`,
    ].join('\n');
  }

  // Fallback general útil
  const topGeneral = disponibles.slice(0, 4).map(
    p => `• ${p.nombre} (${p.categoria}): ${fmtBsLocal(p.precio_usd)} — ${p.stock_disponible} u.`
  );
  const equipInfo = equip.length ? `\nEquipamiento en stock: ${equip.map(e => `${e.nombre} (${fmtBsLocal(e.precio_usd)})`).join(', ')}.` : '';
  return [
    'Soy el Soporte y Asesor de MotoConnect. Tenemos estas unidades disponibles en inventario hoy:',
    ...topGeneral,
    equipInfo,
    '',
    `Puedo ayudarte con: dudas sobre qué moto elegir, papeles oficiales (Factura/DUA/RUAT/SOAT), pagos (PayPal, Tarjeta, QR) o envíos en Bolivia. Para hablar directo con un asesor humano escríbenos por WhatsApp al ${WHATSAPP_DISPLAY}.`,
  ].filter(Boolean).join('\n');
}

module.exports = {
  BS_RATE,
  WHATSAPP_DISPLAY,
  extractBudgetBs,
  buildSmartSupportReply,
};
