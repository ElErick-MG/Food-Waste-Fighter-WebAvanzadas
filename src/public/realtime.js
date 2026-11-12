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
  const roomId = chat?.dataset.chatRoom;
  let ready = false;
  let sending = false;
  let syncing = null;
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
        syncing = null;
      } else merge(result.messages);
      older.hidden = !result.hasMore;
    });
  }
  socket.on('connect', () => { if (status) status.textContent = 'Conectado. Sincronizando conversación…'; });
  socket.on('chat:ready', data => {
    if (!chat) return;
    if (data.roomId !== roomId) { socket.disconnect(); return; }
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
  socket.on('chat:message', message => { syncing?.push(message); merge([message], true); });
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
