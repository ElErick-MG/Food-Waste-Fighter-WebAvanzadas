/* Same-origin Socket.IO client. No client-supplied user or company identity. */
(() => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (!token || typeof window.io !== 'function') return;
  const socket = window.io({ auth: { csrfToken: token }, reconnectionAttempts: 5 });
  const chat = document.querySelector('[data-chat-room]');
  const status = document.getElementById('chat-status');
  const form = document.getElementById('chat-form');
  const content = document.getElementById('chat-content');
  const send = document.getElementById('chat-send');
  const messages = document.getElementById('chat-messages');
  const older = document.getElementById('chat-older');
  const error = document.getElementById('chat-error');
  // The chat bubble (front-end redesign) has no room in its markup: it adopts the
  // company room announced by the server in chat:ready. /chat keeps its own check.
  let roomId = chat?.dataset.chatRoom || null;
  let ready = false;
  let sending = false;
  let syncing = null;

  /* ---------- Campana de avisos: misma conexión y mismos eventos del chat ---------- */
  const avisos = document.getElementById('avisos');
  const avisosBoton = document.getElementById('avisosBoton');
  const avisosBadge = document.getElementById('avisosBadge');
  const avisosLista = document.getElementById('avisosLista');
  const avisosVacio = document.getElementById('avisosVacio');
  const avisosEstado = document.getElementById('avisosEstado');
  const MAX_VISTAS = 5;
  const vistos = new Set();
  let me = null;
  let claveAvisos = null;
  let leido = { createdAt: '', id: '' };
  let ultimo = null;
  let noLeidos = 0;

  // Orden estable del servidor: createdAt y, a igualdad, id.
  const posterior = (a, b) => Boolean(a && b) && (a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.id > b.id));
  function leerAvisos() {
    try {
      const guardado = JSON.parse(localStorage.getItem(claveAvisos) || 'null');
      if (guardado && typeof guardado.createdAt === 'string' && typeof guardado.id === 'string') leido = guardado;
    } catch { /* sin almacenamiento: el contador empieza en cero */ }
  }
  function guardarAvisos(mensaje) {
    if (!claveAvisos || !mensaje) return;
    leido = { createdAt: mensaje.createdAt, id: mensaje.id };
    try { localStorage.setItem(claveAvisos, JSON.stringify(leido)); } catch { /* solo se pierde entre recargas */ }
  }
  function pintarBadge() {
    if (!avisosBadge || !avisosBoton) return;
    avisosBadge.textContent = noLeidos > 9 ? '9+' : String(noLeidos);
    avisosBadge.hidden = noLeidos === 0;
    avisosBoton.setAttribute('aria-label', noLeidos === 0 ? 'Notificaciones del chat del equipo'
      : noLeidos === 1 ? 'Notificaciones: 1 mensaje sin leer'
      : noLeidos > 9 ? 'Notificaciones: más de 9 mensajes sin leer'
      : `Notificaciones: ${noLeidos} mensajes sin leer`);
  }
  function vistaPrevia(mensaje) {
    if (!avisosLista) return;
    const item = document.createElement('li');
    item.className = 'avisos-it';
    const autor = document.createElement('b');
    autor.textContent = mensaje.sender.name;
    const texto = document.createElement('span');
    texto.textContent = mensaje.content;
    item.append(autor, texto);
    avisosLista.prepend(item);
    while (avisosLista.children.length > MAX_VISTAS) avisosLista.lastElementChild.remove();
    if (avisosVacio) avisosVacio.hidden = true;
  }
  function limpiarVistas() {
    avisosLista?.replaceChildren();
    if (avisosVacio) avisosVacio.hidden = false;
  }
  function marcarLeido() {
    if (ultimo) guardarAvisos(ultimo);
    else {
      leido = { createdAt: new Date().toISOString(), id: '' };
      try { if (claveAvisos) localStorage.setItem(claveAvisos, JSON.stringify(leido)); } catch { /* sin almacenamiento */ }
    }
    noLeidos = 0;
    pintarBadge();
  }
  // En /chat la conversación está a la vista; en la burbuja, solo cuando no está oculta.
  function ventanaAbierta() {
    const ventana = document.getElementById('chatVentana');
    if (!ventana) return false;
    return ventana.classList.contains('chat-pagina') || !ventana.hidden;
  }
  // Si el chat o la propia campana están a la vista, el mensaje ya se está leyendo.
  const leyendo = () => ventanaAbierta() || Boolean(avisos?.open);
  function sumarAviso(mensaje) {
    if (!avisos || !me) return;
    if (!ultimo || posterior(mensaje, ultimo)) ultimo = mensaje;
    if (mensaje.sender.id === me) return;
    if (leyendo()) {
      guardarAvisos(ultimo);
      noLeidos = 0;
      pintarBadge();
      if (avisos?.open) vistaPrevia(mensaje);
      return;
    }
    if (!posterior(mensaje, leido) || vistos.has(mensaje.id)) return;
    vistos.add(mensaje.id);
    noLeidos += 1;
    vistaPrevia(mensaje);
    pintarBadge();
    if (avisosEstado) avisosEstado.textContent = `Nuevo mensaje de ${mensaje.sender.name}`;
  }
  function sembrarAvisos(lista) {
    if (!avisos || !me) return;
    for (const mensaje of lista) if (!ultimo || posterior(mensaje, ultimo)) ultimo = mensaje;
    if (leyendo()) { marcarLeido(); return; }
    for (const mensaje of lista) {
      if (mensaje.sender.id === me || !posterior(mensaje, leido) || vistos.has(mensaje.id)) continue;
      vistos.add(mensaje.id);
      noLeidos += 1;
      vistaPrevia(mensaje);
    }
    pintarBadge();
    // La burbuja flotante muestra el mismo total que la campana tras una recarga.
    document.dispatchEvent(new CustomEvent('fwf:avisos-sembrados', { detail: { total: noLeidos } }));
  }
  function pedirAvisos() {
    if (!avisos || !roomId) return;
    socket.timeout(10000).emit('chat:history', { roomId }, (timeout, result) => {
      if (timeout || !result?.ok) return;
      sembrarAvisos(result.messages);
    });
  }
  if (avisos) {
    avisos.addEventListener('toggle', () => {
      if (avisos.open) {
        marcarLeido();
        document.dispatchEvent(new CustomEvent('fwf:leido'));
      } else limpiarVistas();
    });
    // chat.js avisa cuando se abre la burbuja: mismo estado de leído para ambos.
    document.addEventListener('fwf:leido', () => { if (noLeidos) marcarLeido(); });
    window.addEventListener('storage', event => {
      if (!claveAvisos || event.key !== claveAvisos || !event.newValue) return;
      try {
        const valor = JSON.parse(event.newValue);
        if (posterior(valor, leido)) { leido = valor; noLeidos = 0; pintarBadge(); }
      } catch { /* valor ajeno: se ignora */ }
    });
  }
  function controls() {
    if (!chat) return;
    content.disabled = !ready;
    send.disabled = !ready || sending;
    older.disabled = !ready;
  }
  function merge(incoming, scroll = false) {
    if (!chat) return;
    const known = new Set([...messages.children].map(node => node.dataset.messageId));
    for (const message of incoming) {
      if (message.roomId !== roomId || known.has(message.id)) continue;
      known.add(message.id);
      const li = document.createElement('li');
      li.dataset.messageId = message.id;
      li.dataset.createdAt = message.createdAt;
      li.dataset.senderId = message.sender.id;
      li.className = 'bg-gray-50 p-3 rounded-lg break-words';
      const heading = document.createElement('p');
      heading.className = 'font-semibold';
      heading.textContent = `${message.sender.name} `;
      const time = document.createElement('time');
      time.className = 'font-normal text-sm text-gray-600';
      time.dateTime = message.createdAt;
      time.textContent = new Date(message.createdAt).toLocaleString('es');
      heading.append(time);
      const text = document.createElement('p');
      text.className = 'whitespace-pre-wrap break-words';
      text.textContent = message.content;
      li.append(heading, text);
      const next = [...messages.children].find(node => node.dataset.createdAt > message.createdAt ||
        (node.dataset.createdAt === message.createdAt && node.dataset.messageId > message.id));
      messages.insertBefore(li, next || null);
    }
    document.getElementById('chat-empty').hidden = messages.children.length > 0;
    if (scroll) messages.scrollTop = messages.scrollHeight;
  }
  function history(before) {
    older.disabled = true;
    socket.timeout(10000).emit('chat:history', { roomId, ...(before ? { before } : {}) }, (timeout, result) => {
      older.disabled = !ready;
      if (timeout || !result?.ok) { error.textContent = result?.message || 'No se pudo cargar el historial. Vuelve a conectar o recarga la página.'; return; }
      if (!before) {
        // Reconnect starts from the newest page. Keep messages received while
        // that query was in flight, without leaving gaps from an older view.
        messages.replaceChildren();
        merge([...result.messages, ...(syncing || [])], true);
        sembrarAvisos([...(syncing || []), ...result.messages]);
        syncing = null;
      } else merge(result.messages);
      older.hidden = !result.hasMore;
    });
  }
  socket.on('connect', () => { if (status) status.textContent = 'Conectado. Sincronizando conversación…'; });
  socket.on('chat:ready', data => {
    if (!me) {
      me = data.userId;
      claveAvisos = `fwf:avisos:${me}`;
      leerAvisos();
    }
    // Sin ventana de chat (páginas de tarjeta) la campana igualmente se siembra.
    if (!chat) {
      roomId = data.roomId;
      pedirAvisos();
      return;
    }
    if (roomId && data.roomId !== roomId) { socket.disconnect(); return; }
    roomId = data.roomId;
    chat.dataset.chatRoom = roomId;
    chat.dataset.me = data.userId;
    ready = true;
    syncing = [];
    controls();
    status.textContent = 'Conectado al chat del equipo';
    error.textContent = '';
    history();
  });
  socket.on('disconnect', reason => {
    ready = false;
    controls();
    if (status) status.textContent = reason === 'io server disconnect' ? 'Sesión finalizada. Inicia sesión de nuevo.' : 'Sin conexión. Intentando reconectar…';
    if (chat) { document.getElementById('chat-count').textContent = '0'; document.getElementById('chat-users').replaceChildren(); }
  });
  socket.on('connect_error', event => {
    ready = false;
    controls();
    if (status) status.textContent = event.message === 'AUTH_REQUIRED' ? 'La sesión caducó. Inicia sesión de nuevo.' : 'No se pudo conectar al chat. Comprueba tu conexión o recarga la página.';
  });
  socket.on('chat:message', message => { syncing?.push(message); merge([message], true); sumarAviso(message); });
  socket.on('chat:presence', ({ users }) => {
    if (!chat) return;
    document.getElementById('chat-count').textContent = String(users.length);
    document.getElementById('chat-users').replaceChildren(...users.map(user => {
      const li = document.createElement('li'); li.textContent = user.name; return li;
    }));
  });
  socket.on('inventory:changed', event => {
    const box = document.getElementById('inventory-live');
    if (!box) return;
    const action = { created: 'registrado', updated: 'actualizado', deleted: 'eliminado' }[event.action] || 'modificado';
    document.getElementById('inventory-live-text').textContent = `Inventario ${action}${event.name ? `: ${event.name}` : '.'}${event.nearExpiry ? ' Atención: producto próximo a caducar.' : event.expiration === 'expired' ? ' Atención: producto caducado.' : ''}`;
    box.classList.remove('hidden');
  });
  older?.addEventListener('click', () => { if (ready) history(messages.firstElementChild?.dataset.messageId); });
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!ready || sending || !form.reportValidity()) return;
    if (!content.value.trim()) { error.textContent = 'Escribe un mensaje.'; return; }
    sending = true;
    controls();
    error.textContent = '';
    socket.timeout(10000).emit('chat:send', { roomId, content: content.value }, (timeout, result) => {
      sending = false;
      controls();
      if (timeout || !result?.ok) {
        // Never automatically retry a send: an acknowledgement can be lost after
        // persistence. Preserve input so the person can inspect recent history.
        error.textContent = result?.message || 'No se confirmó el envío. Revisa el historial antes de volver a enviar.';
        return;
      }
      merge([result.message], true);
      content.value = '';
      if (ready) content.focus();
    });
  });
})();
