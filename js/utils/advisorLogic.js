/* ============================================================
   MotoConnect — utils/advisorLogic.js
   Motor de recomendación coherente + construcción de enlace WhatsApp
   ============================================================ */

import { BS_RATE, WHATSAPP_NUMBER_DIGITS } from '../config.js';

export const ADVISOR_QUESTIONS = [
  {
    key: 'uso',
    stepTitle: '¿Dónde y para qué vas a usar tu moto casi todos los días?',
    helper: 'Elegiremos la geometría, suspensión y categoría que mejor rinda en tu rutina.',
    options: [
      {
        key: 'trabajo',
        label: 'Trabajo, reparto o delivery intensivo',
        hint: 'Motos de bajo consumo, repuestos económicos y parrilla/resistencia',
      },
      {
        key: 'ciudad',
        label: 'Transporte diario en ciudad y tráfico',
        hint: 'Ágiles, livianas o automáticas para moverte cómodo entre avenidas',
      },
      {
        key: 'aventura',
        label: 'Viajes, caminos de tierra, ripio o altura',
        hint: 'Suspensión de mayor recorrido y postura erguida para rutas mixtas',
      },
      {
        key: 'deportivo',
        label: 'Carretera, curvas y conducción deportiva',
        hint: 'Mayor cilindrada, frenos ABS, chasis rígido y aceleración contundente',
      },
    ],
  },
  {
    key: 'presupuesto',
    stepTitle: '¿Cuál es el presupuesto máximo que planeas invertir?',
    helper: 'Todos los precios ya muestran la conversión oficial en Bolivianos (Bs) y USD.',
    options: [
      {
        key: 'hasta_15000',
        label: 'Hasta Bs 15.000',
        hint: 'Modelos económicos y rendidores (≈ hasta $2.155 USD)',
        maxBs: 15000,
      },
      {
        key: 'hasta_25000',
        label: 'Entre Bs 15.000 y Bs 25.000',
        hint: 'Gama urbana/doble propósito con inyección o mayor equipamiento',
        maxBs: 25000,
      },
      {
        key: 'hasta_56000',
        label: 'Entre Bs 25.000 y Bs 56.000',
        hint: 'Naked, Adventure o Sport de cilindrada media con ABS',
        maxBs: 56000,
      },
      {
        key: 'sin_limite',
        label: 'Más de Bs 56.000 / Sin límite',
        hint: 'Todas las gamas y modelos de mayor desempeño disponibles',
        maxBs: Infinity,
      },
    ],
  },
  {
    key: 'experiencia',
    stepTitle: '¿Qué nivel de experiencia y comodidad prefieres al conducir?',
    helper: 'Cuidamos que el peso, la altura y la entrega de potencia sean seguros para ti.',
    options: [
      {
        key: 'principiante',
        label: 'Es mi primera moto / prefiero algo fácil y liviano',
        hint: 'Cilindrada dócil (110–150 cc) o automática, fácil de maniobrar y estacionar',
        maxCc: 160,
        maxWeight: 140,
      },
      {
        key: 'intermedio',
        label: 'Ya manejo en ciudad y busco más estabilidad',
        hint: 'Entre 150 y 350 cc, equilibrio entre potencia urbana y ruta corta',
        maxCc: 350,
        maxWeight: 175,
      },
      {
        key: 'experimentado',
        label: 'Tengo experiencia y quiero respuesta fuerte',
        hint: 'Cilindradas medias y altas (300 cc en adelante) sin restricción de peso',
        maxCc: 9999,
        maxWeight: 9999,
      },
    ],
  },
  {
    key: 'prioridad',
    stepTitle: '¿Qué valoras más en tu compra?',
    helper: 'Definirá el desempate entre las motos que cumplen tu uso y presupuesto.',
    options: [
      {
        key: 'ahorro',
        label: 'Mínimo consumo de gasolina y mantenimiento barato',
        hint: 'Prioriza rendimiento ≥ 45 km/L y mecánica simple',
      },
      {
        key: 'seguridad',
        label: 'Frenos ABS, inyección electrónica y tablero moderno',
        hint: 'Prioriza asistencias activas de frenado y estabilidad',
      },
      {
        key: 'potencia',
        label: 'Aceleración, torque y velocidad en carretera',
        hint: 'Prioriza mayor potencia en HP y caja de 6 velocidades',
      },
      {
        key: 'terreno',
        label: 'Resistencia en subidas, baches y rutas largas',
        hint: 'Prioriza torque en bajas, tanque amplio y doble propósito',
      },
    ],
  },
];

const USAGE_RULES = {
  trabajo: { primaryCats: ['Trabajo'], secondaryCats: ['Urbana'] },
  ciudad: { primaryCats: ['Urbana', 'Trabajo'], secondaryCats: ['Naked'] },
  aventura: { primaryCats: ['Adventure'], secondaryCats: ['Trabajo'] },
  deportivo: { primaryCats: ['Naked', 'Supersport'], secondaryCats: ['Adventure'] },
};

const BUDGET_LIMITS = {
  hasta_15000: 15000,
  hasta_25000: 25000,
  hasta_56000: 56000,
  sin_limite: Infinity,
};

const EXP_LIMITS = {
  principiante: { maxCc: 160, maxWeight: 140 },
  intermedio: { maxCc: 350, maxWeight: 175 },
  experimentado: { maxCc: 9999, maxWeight: 9999 },
};

function parseNumeric(val) {
  const match = String(val || '').replace(',', '.').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function optionLabelFor(questionKey, answerKey) {
  const q = ADVISOR_QUESTIONS.find(item => item.key === questionKey);
  const opt = q?.options.find(item => item.key === answerKey);
  return opt ? opt.label : String(answerKey || 'No especificado');
}

export function scoreAndExplainMotorcycle(product, answers = {}) {
  const usageKey = answers.uso || 'ciudad';
  const budgetKey = answers.presupuesto || 'sin_limite';
  const expKey = answers.experiencia || 'intermedio';
  const prioKey = answers.prioridad || 'ahorro';

  const usage = USAGE_RULES[usageKey] || USAGE_RULES.ciudad;
  const maxBs = BUDGET_LIMITS[budgetKey] ?? Infinity;
  const exp = EXP_LIMITS[expKey] || EXP_LIMITS.intermedio;

  const cat = product.categoria || '';
  const priceBs = Number(product.precio_usd || 0) * BS_RATE;
  const cc = Number(product.cilindrada_cc || 0);
  const weight = Number(product.peso_kg || 0);
  const hp = parseNumeric(product.potencia_hp);
  const consumo = parseNumeric(product.consumo_kml);
  const tanque = Number(product.tanque_litros || 0);
  const techText = `${product.frenos || ''} ${product.electronica || ''} ${product.transmision || ''}`.toLowerCase();

  let score = 0;
  const reasons = [];
  const warnings = [];

  // 1. Uso
  if (usage.primaryCats.includes(cat)) {
    score += 42;
    reasons.push(`Categoría ${cat} ideal para ${optionLabelFor('uso', usageKey).toLowerCase()}.`);
  } else if (usage.secondaryCats.includes(cat)) {
    score += 20;
    reasons.push(`Categoría ${cat} adaptable a tu uso diario.`);
  }

  // 2. Presupuesto
  if (priceBs <= maxBs) {
    score += 26;
    if (Number.isFinite(maxBs)) {
      reasons.push(`Dentro de tu presupuesto (Bs ${Math.round(priceBs).toLocaleString('en-US')}).`);
    }
  } else if (Number.isFinite(maxBs)) {
    const excessRatio = (priceBs - maxBs) / maxBs;
    score -= Math.min(24, Math.round(excessRatio * 35));
    warnings.push(`Supera tu tope en Bs ${Math.round(priceBs - maxBs).toLocaleString('en-US')}.`);
  }

  // 3. Experiencia / manejo
  if (cc > 0 && cc <= exp.maxCc) {
    score += 18;
    if (expKey === 'principiante') {
      reasons.push(`Motor maniobrable (${cc} cc${weight ? `, ${weight} kg` : ''}) apto para empezar con confianza.`);
    } else if (expKey === 'experimentado' && cc >= 240) {
      reasons.push(`Cilindrada de ${cc} cc con respuesta acorde a piloto con experiencia.`);
    }
  } else if (cc > exp.maxCc) {
    score -= 18;
    warnings.push(`Cilindrada (${cc} cc) más exigente para el nivel elegido.`);
  }

  if (weight > 0 && weight <= exp.maxWeight) {
    score += 6;
  }

  // 4. Prioridad
  if (prioKey === 'ahorro') {
    if (consumo >= 45) {
      score += 16;
      reasons.push(`Excelente rendimiento de combustible (${product.consumo_kml}).`);
    } else if (consumo >= 35) {
      score += 8;
    }
  } else if (prioKey === 'seguridad') {
    if (techText.includes('abs') || techText.includes('inyecci') || techText.includes('tracci')) {
      score += 18;
      reasons.push(`Incluye tecnología de seguridad (${product.frenos || product.electronica}).`);
    } else if (techText.includes('disco')) {
      score += 7;
    }
  } else if (prioKey === 'potencia') {
    if (hp >= 25) {
      score += 18;
      reasons.push(`Entrega destacada de ${product.potencia_hp}${product.velocidad_max ? ` y ${product.velocidad_max}` : ''}.`);
    } else if (hp >= 14) {
      score += 9;
    }
  } else if (prioKey === 'terreno') {
    if (cat === 'Adventure' || tanque >= 12 || techText.includes('largo recorrido')) {
      score += 17;
      reasons.push(`Preparada para rutas y subidas${tanque ? ` con tanque de ${tanque} L` : ''}.`);
    }
  }

  if (Number(product.stock_disponible) > 0) {
    score += 10;
  }

  if (!reasons.length) {
    reasons.push(`Disponible para entrega inmediata (${product.stock_disponible} u. en inventario).`);
  }

  const normalizedScore = Math.min(99, Math.max(52, Math.round((score / 118) * 100)));
  return {
    product,
    rawScore: score,
    matchPercent: normalizedScore,
    reasons: reasons.slice(0, 3),
    warnings,
  };
}

export function rankAdvisorRecommendations(products = [], answers = {}, limit = 3) {
  const motos = products.filter(
    p =>
      Number(p.stock_disponible) > 0 &&
      p.categoria !== 'Equipamiento' &&
      p.categoria !== 'Accesorio'
  );

  return motos
    .map(p => scoreAndExplainMotorcycle(p, answers))
    .sort((a, b) => b.rawScore - a.rawScore || Number(a.product.precio_usd) - Number(b.product.precio_usd))
    .slice(0, limit);
}

export function buildAdvisorSummaryText(answers = {}) {
  return [
    `• Uso principal: ${optionLabelFor('uso', answers.uso)}`,
    `• Presupuesto: ${optionLabelFor('presupuesto', answers.presupuesto)}`,
    `• Experiencia: ${optionLabelFor('experiencia', answers.experiencia)}`,
    `• Prioridad: ${optionLabelFor('prioridad', answers.prioridad)}`,
  ].join('\n');
}

export function buildWhatsAppAdvisorUrl({
  phoneDigits = WHATSAPP_NUMBER_DIGITS,
  answers = {},
  product = null,
  extraNote = '',
} = {}) {
  const lines = [
    'Hola MotoConnect, completé el Asesor por Preguntas y quiero consultar sobre esta motocicleta:',
    '',
  ];

  if (product) {
    const bs = Math.round(Number(product.precio_usd || 0) * BS_RATE).toLocaleString('en-US');
    const usd = Number(product.precio_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    lines.push(`*Moto consultada:* ${product.nombre} (${product.marca}, ${product.anio || 2026})`);
    lines.push(`*Precio:* Bs ${bs} (≈ $${usd} USD) · ${product.cilindrada_cc ? `${product.cilindrada_cc} cc · ` : ''}${product.potencia_hp || ''}`);
    lines.push('');
  }

  lines.push('*Mis respuestas del Asesor:*');
  lines.push(buildAdvisorSummaryText(answers));

  if (extraNote && extraNote.trim()) {
    lines.push('');
    lines.push(`*Consulta adicional:* ${extraNote.trim()}`);
  }

  lines.push('');
  lines.push('¿Me confirman disponibilidad, envío y papeles oficiales (Factura/DUA/RUAT)?');

  const cleanPhone = String(phoneDigits || '59167671435').replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
}
