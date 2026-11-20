/* ============================================================
 MotoConnect — components/aiAssistant.js
 Widget flotante del Asesor Técnico IA (Groq + inventario)
 ============================================================ */

export function initAiAssistant() {
 if (document.getElementById('ai-assistant-root')) return;

 const root = document.createElement('div');
 root.id = 'ai-assistant-root';
 root.style.position = 'fixed';
 root.style.right = '24px';
 root.style.bottom = '24px';
 root.style.zIndex = '1300';
 root.style.fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";

 const fab = document.createElement('button');
 fab.type = 'button';
 fab.setAttribute('aria-label', 'Abrir asesor técnico IA');
 fab.textContent = '';
  const fabImg = document.createElement('img');
  fabImg.src = '/assets/ai-mascot.jpg';
  fabImg.alt = 'Asesor IA';
  fabImg.style.width = '40px';
  fabImg.style.height = '40px';
  fabImg.style.borderRadius = '50%';
  fabImg.style.objectFit = 'cover';
  fab.appendChild(fabImg);
 fab.style.width = '56px';
 fab.style.height = '56px';
 fab.style.borderRadius = '50%';
 fab.style.border = 'none';
 fab.style.background = '#F95715';
 fab.style.color = '#fff';
 fab.style.fontSize = '1.4rem';
 fab.style.cursor = 'pointer';
 fab.style.boxShadow = '0 8px 24px rgba(249,87,21,0.45)';
 fab.style.display = 'flex';
 fab.style.alignItems = 'center';
 fab.style.justifyContent = 'center';

 const panel = document.createElement('div');
 panel.style.display = 'none';
 panel.style.position = 'absolute';
 panel.style.right = '0';
 panel.style.bottom = '72px';
 panel.style.width = '360px';
 panel.style.maxWidth = 'calc(100vw - 32px)';
 panel.style.height = '520px';
 panel.style.background = '#11161F';
 panel.style.border = '1px solid #1E293B';
 panel.style.borderRadius = '14px';
 panel.style.boxShadow = '0 12px 48px rgba(0,0,0,0.6)';
 panel.style.flexDirection = 'column';
 panel.style.overflow = 'hidden';

 // Header
 const header = document.createElement('div');
 header.style.display = 'flex';
 header.style.alignItems = 'center';
 header.style.justifyContent = 'space-between';
 header.style.padding = '14px 16px';
 header.style.borderBottom = '1px solid #1E293B';
 header.style.gap = '12px';

 const titleWrap = document.createElement('div');
 titleWrap.style.display = 'flex';
 titleWrap.style.alignItems = 'center';
 titleWrap.style.gap = '10px';

 const logoImg = document.createElement('img');
 logoImg.src = '/assets/logo-motoconnect.jpg';
 logoImg.alt = 'MotoConnect';
 logoImg.style.height = '28px';
 logoImg.style.borderRadius = '6px';
 titleWrap.appendChild(logoImg);

 const title = document.createElement('div');
 title.style.fontWeight = '700';
 title.style.fontSize = '0.95rem';
 title.style.color = '#F1F5F9';
 title.textContent = 'Asesor Técnico IA';
 const indicator = document.createElement('div');
 indicator.style.fontSize = '0.72rem';
 indicator.style.color = '#10B981';
 indicator.style.marginTop = '2px';
 indicator.textContent = '● Inventario en vivo · Protegido';
 titleWrap.appendChild(title);
 titleWrap.appendChild(indicator);

 const closeBtn = document.createElement('button');
 closeBtn.type = 'button';
 closeBtn.textContent = '';
 closeBtn.style.background = 'transparent';
 closeBtn.style.border = 'none';
 closeBtn.style.color = '#94A3B8';
 closeBtn.style.fontSize = '1.1rem';
 closeBtn.style.cursor = 'pointer';
 closeBtn.style.padding = '4px 8px';

 header.appendChild(titleWrap);
 header.appendChild(closeBtn);

 // Messages
 const messages = document.createElement('div');
 messages.style.flex = '1';
 messages.style.overflowY = 'auto';
 messages.style.padding = '16px';
 messages.style.display = 'flex';
 messages.style.flexDirection = 'column';
 messages.style.gap = '10px';
 messages.style.background = '#090C10';

 // Chips
 const chips = document.createElement('div');
 chips.style.display = 'flex';
 chips.style.flexWrap = 'wrap';
 chips.style.gap = '8px';
 chips.style.padding = '0 16px 12px';
 chips.style.background = '#090C10';

 const quickQueries = [
 '¿Qué motos tienen en stock hoy?',
 'Recomiéndame una moto por menos de $9,000 USD',
 '¿Cuál es la moto más potente disponible?',
 ];

 // Input
 const form = document.createElement('form');
 form.style.display = 'flex';
 form.style.gap = '8px';
 form.style.padding = '12px 16px';
 form.style.borderTop = '1px solid #1E293B';
 form.style.background = '#11161F';

 const input = document.createElement('input');
 input.type = 'text';
 input.maxLength = 350;
 input.placeholder = 'Escribe tu consulta...';
 input.style.flex = '1';
 input.style.background = '#18202C';
 input.style.border = '1px solid #1E293B';
 input.style.borderRadius = '6px';
 input.style.padding = '10px 12px';
 input.style.color = '#F1F5F9';
 input.style.fontSize = '0.88rem';
 input.style.outline = 'none';

 const sendBtn = document.createElement('button');
 sendBtn.type = 'submit';
 sendBtn.textContent = 'Enviar';
 sendBtn.style.background = '#F95715';
 sendBtn.style.color = '#fff';
 sendBtn.style.border = 'none';
 sendBtn.style.borderRadius = '6px';
 sendBtn.style.padding = '10px 16px';
 sendBtn.style.fontWeight = '600';
 sendBtn.style.cursor = 'pointer';
 sendBtn.style.fontSize = '0.88rem';

 form.appendChild(input);
 form.appendChild(sendBtn);

 panel.appendChild(header);
 panel.appendChild(messages);
 panel.appendChild(chips);
 panel.appendChild(form);

 root.appendChild(panel);
 root.appendChild(fab);
 document.body.appendChild(root);

 const historial = [];

 function appendMessage(role, text) {
 const bubble = document.createElement('div');
 bubble.style.maxWidth = '86%';
 bubble.style.padding = '10px 12px';
 bubble.style.borderRadius = '10px';
 bubble.style.fontSize = '0.88rem';
 bubble.style.lineHeight = '1.5';
 bubble.style.whiteSpace = 'pre-wrap';
 bubble.style.wordBreak = 'break-word';
 if (role === 'user') {
 bubble.style.alignSelf = 'flex-end';
 bubble.style.background = 'rgba(249,87,21,0.15)';
 bubble.style.border = '1px solid rgba(249,87,21,0.3)';
 bubble.style.color = '#F1F5F9';
 } else {
 bubble.style.alignSelf = 'flex-start';
 bubble.style.background = '#18202C';
 bubble.style.border = '1px solid #1E293B';
 bubble.style.color = '#94A3B8';
 }
 bubble.textContent = text;
 messages.appendChild(bubble);
 messages.scrollTop = messages.scrollHeight;
 return bubble;
 }

 appendMessage('assistant', 'Hola, soy tu Asesor Técnico. Pregúntame por disponibilidad, potencia, precio o recomendaciones de motos.');

 async function send() {
 const text = input.value.trim().slice(0, 350);
 if (!text) return;
 input.value = '';
 appendMessage('user', text);
 historial.push({ role: 'user', content: text });

 const placeholder = appendMessage('assistant', 'Consultando inventario...');
 sendBtn.disabled = true;
 sendBtn.style.opacity = '0.6';
 try {
 const response = await fetch('/api/ai/asesor', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ mensaje: text, historial: historial.slice(-6) }),
 });
 const data = await response.json();
 if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
 const reply = data.respuesta || data.reply || data.message || 'Sin respuesta';
 placeholder.textContent = reply;
 historial.push({ role: 'assistant', content: reply });
 if (historial.length > 12) historial.splice(0, historial.length - 12);
 } catch (error) {
 placeholder.textContent = ` ${error.message}`;
 } finally {
 sendBtn.disabled = false;
 sendBtn.style.opacity = '1';
 input.focus();
 messages.scrollTop = messages.scrollHeight;
 }
 }

 form.addEventListener('submit', event => {
 event.preventDefault();
 send();
 });

 quickQueries.forEach(query => {
 const chip = document.createElement('button');
 chip.type = 'button';
 chip.textContent = query;
 chip.style.background = '#18202C';
 chip.style.border = '1px solid #1E293B';
 chip.style.color = '#94A3B8';
 chip.style.borderRadius = '999px';
 chip.style.padding = '6px 10px';
 chip.style.fontSize = '0.75rem';
 chip.style.cursor = 'pointer';
 chip.style.textAlign = 'left';
 chip.addEventListener('click', () => {
 input.value = query;
 send();
 });
 chips.appendChild(chip);
 });

 fab.addEventListener('click', () => {
 panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
 if (panel.style.display === 'flex') input.focus();
 });

 closeBtn.addEventListener('click', () => {
 panel.style.display = 'none';
 });
}
