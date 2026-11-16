/*
 * Food Waste Fighter — chat del equipo con el diseño nuevo.
 * /assets/realtime.js sigue siendo el único cliente de Socket.IO (contratos sin cambios):
 * pinta los mensajes en #chat-messages y la presencia en #chat-users. Este módulo solo
 * decora: burbuja flotante, mensajes propios a la derecha, no leídos, vista previa,
 * avatares de presencia, Enter para enviar y altura automática del campo.
 */
const ventana = document.getElementById('chatVentana');
if (ventana) iniciar();

function iniciar() {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOJA = 'cubic-bezier(.76,0,.18,1)';
  const burbuja = document.getElementById('chatBurbuja');
  const asoma = document.getElementById('chatAsoma');
  const mensajes = document.getElementById('chat-messages');
  const texto = document.getElementById('chat-content');
  const form = document.getElementById('chat-form');
  const usuarios = document.getElementById('chat-users');
  const contador = document.getElementById('chatCont');
  const flotante = !!burbuja;
  let abierto = !flotante, sinLeer = 0, asomaT = 0;

  const iniciales = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

  /* ---------- Mensajes: propios a la derecha (data-sender-id vs. data-me de chat:ready) ---------- */
  function marcar(li) {
    if (!(li instanceof HTMLElement) || !li.dataset.messageId) return;
    li.className = 'chat-m';
    li.classList.toggle('mio', !!ventana.dataset.me && li.dataset.senderId === ventana.dataset.me);
  }
  const marcarTodo = () => { for (const li of mensajes.children) marcar(li); };
  marcarTodo();
  // Tras chat:ready (realtime.js escribe data-me) llega el historial en una sola tanda:
  // esa primera tanda no son mensajes nuevos.
  let esperandoHistorial = false, esperaT = 0;
  new MutationObserver(() => {
    marcarTodo();
    esperandoHistorial = true;
    clearTimeout(esperaT);
    esperaT = setTimeout(() => { esperandoHistorial = false; }, 3000);
  }).observe(ventana, { attributes: true, attributeFilter: ['data-me'] });

  // Una sincronización (reconexión o historial) reemplaza la lista: quita nodos.
  // Un mensaje nuevo solo añade. Los propios no cuentan como no leídos.
  new MutationObserver(registros => {
    let sincroniza = esperandoHistorial;
    esperandoHistorial = false;
    const nuevos = [];
    for (const r of registros) {
      if (r.removedNodes.length) sincroniza = true;
      for (const n of r.addedNodes) if (n instanceof HTMLElement) { marcar(n); nuevos.push(n); }
    }
    if (sincroniza || abierto || !flotante) return;
    const ajenos = nuevos.filter(n => !n.classList.contains('mio'));
    if (!ajenos.length) return;
    sinLeer += ajenos.length;
    pintarBurbuja();
    asomar(ajenos.at(-1));
  }).observe(mensajes, { childList: true });

  /* ---------- Presencia: avatares a partir de la lista accesible ---------- */
  function pintarPresencia() {
    const nombres = [...usuarios.children].map(li => li.textContent);
    const avs = document.getElementById('chatAvs');
    avs.replaceChildren(...nombres.slice(0, 3).map((n, i) => {
      const s = document.createElement('span');
      s.className = i ? 'av suave' : 'av';
      s.textContent = iniciales(n);
      return s;
    }));
    document.getElementById('chatConectTxt').textContent = nombres.length === 1 ? 'conectado' : 'conectados';
    document.getElementById('chatPresencia').title = nombres.length
      ? `${nombres.join(', ')}. Cada persona se cuenta una vez, aunque tenga varias pestañas abiertas.` : '';
  }
  new MutationObserver(pintarPresencia).observe(usuarios, { childList: true });

  /* ---------- Campo de texto: altura automática, contador y Enter para enviar ---------- */
  function ajustar() {
    texto.style.height = 'auto';
    texto.style.height = `${Math.min(texto.scrollHeight, 120)}px`;
    contador.textContent = `${texto.value.length}/2000`;
    contador.classList.toggle('lleno', texto.value.length >= 1900);
  }
  texto.addEventListener('input', ajustar);
  texto.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  // realtime.js vacía el campo al confirmar el envío (sin evento input). Ese acuse también
  // reactiva el botón de enviar, así que se reajusta cuando cambia su estado.
  new MutationObserver(ajustar).observe(document.getElementById('chat-send'), { attributes: true, attributeFilter: ['disabled'] });

  if (!flotante) {
    // En /chat la lista ya viene del servidor: se baja al último mensaje.
    mensajes.scrollTop = mensajes.scrollHeight;
    // Menú de cuenta de la página: se cierra al hacer clic fuera o con Escape.
    const cuenta = document.querySelector('.cuenta');
    document.addEventListener('click', e => { if (cuenta?.open && !cuenta.contains(e.target)) cuenta.open = false; });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && cuenta?.open) { cuenta.open = false; cuenta.querySelector('summary').focus(); }
    });
    return;
  }

  /* ---------- Burbuja flotante ---------- */
  burbuja.hidden = false;
  const CERRADO = 'inset(calc(100% - 56px) 0 0 calc(100% - 56px) round 28px)', ABIERTO = 'inset(0 0 0 0 round 24px)';
  function pintarBurbuja() {
    const badge = burbuja.querySelector('.chat-badge');
    badge.textContent = sinLeer > 9 ? '9+' : String(sinLeer);
    badge.hidden = !sinLeer;
    burbuja.setAttribute('aria-label', abierto ? 'Cerrar chat del equipo'
      : `Abrir chat del equipo${sinLeer ? `, ${sinLeer} ${sinLeer === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}` : ''}`);
    burbuja.setAttribute('aria-expanded', String(abierto));
    burbuja.classList.toggle('abierto', abierto);
  }
  function abrir() {
    if (abierto) return;
    abierto = true; sinLeer = 0; ocultarAsoma(); pintarBurbuja();
    ventana.hidden = false;
    ventana.getAnimations().forEach(a => a.cancel());
    ventana.animate([{ clipPath: CERRADO }, { clipPath: ABIERTO }], { duration: RM ? 1 : 420, easing: HOJA });
    mensajes.scrollTop = mensajes.scrollHeight;
    setTimeout(() => (texto.disabled ? document.getElementById('chatCerrar') : texto).focus({ preventScroll: true }), 60);
  }
  async function cerrar(foco = true) {
    if (!abierto) return;
    abierto = false; pintarBurbuja();
    ventana.getAnimations().forEach(a => a.cancel());
    const a = ventana.animate([{ clipPath: ABIERTO }, { clipPath: CERRADO }], { duration: RM ? 1 : 260, easing: HOJA, fill: 'forwards' });
    await a.finished.catch(() => {});
    if (!abierto) { ventana.hidden = true; a.cancel(); }
    if (foco) burbuja.focus();
  }
  function asomar(li) {
    const [cab, cuerpo] = li.querySelectorAll('p');
    const autor = cab?.firstChild?.textContent.trim() || 'Equipo';
    const t = cuerpo?.textContent || '';
    const small = document.createElement('small'), span = document.createElement('span');
    small.textContent = autor;
    span.textContent = t.length > 90 ? `${t.slice(0, 90)}…` : t;
    asoma.replaceChildren(small, span);
    asoma.setAttribute('aria-label', `Mensaje nuevo de ${autor}. Abrir chat`);
    asoma.hidden = false;
    asoma.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: RM ? 1 : 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    clearTimeout(asomaT);
    asomaT = setTimeout(ocultarAsoma, 4000);
  }
  function ocultarAsoma() { clearTimeout(asomaT); asoma.hidden = true; }

  burbuja.addEventListener('click', () => (abierto ? cerrar() : abrir()));
  asoma.addEventListener('click', abrir);
  document.getElementById('chatCerrar').addEventListener('click', () => cerrar());
  ventana.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } });
  pintarBurbuja();
}
