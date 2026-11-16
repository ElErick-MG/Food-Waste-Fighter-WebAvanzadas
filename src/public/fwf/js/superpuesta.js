/*
 * Food Waste Fighter — tarjetas superpuestas (mejora progresiva).
 * En la refri y el Resumen, los enlaces a las páginas de tarjeta (agregar/editar/eliminar
 * producto, categorías, equipo, cuenta, recetas, caducidad) se abren en un <dialog> encima
 * de la pantalla actual, como en el diseño. Se pide la MISMA página al servidor y se
 * muestra solo su tarjeta; los formularios se envían a los MISMOS POST (con su _csrf), y el
 * servidor sigue validando, autorizando y redirigiendo igual. Sin JavaScript, o si algo
 * falla, el enlace navega a la página completa como siempre.
 * No se usa <iframe>: la CSP (frame-ancestors 'none') lo impide, y así debe ser.
 */
const RUTAS = [
  /^\/inventory\/new$/, /^\/inventory\/(?!new$)[^/]+$/, /^\/inventory\/[^/]+\/(edit|delete)$/,
  /^\/categories$/, /^\/categories\/[^/]+\/delete$/, /^\/team$/, /^\/account$/,
  /^\/recipes$/, /^\/recipes\/[^/]+$/, /^\/expiration$/,
];
const actual = location.pathname;
const esTarjeta = url => url.origin === location.origin && RUTAS.some(r => r.test(url.pathname));
const conModificador = e => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/* Aviso pendiente de una acción hecha en una tarjeta (p. ej. eliminar): se muestra al llegar. */
const CLAVE_AVISO = 'fwf-aviso';
try {
  const pendiente = sessionStorage.getItem(CLAVE_AVISO);
  sessionStorage.removeItem(CLAVE_AVISO);
  if (pendiente) {
    const toast = document.createElement('p');
    toast.className = 'aviso-flotante';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
    requestAnimationFrame(() => { toast.textContent = pendiente; });   // anunciado por lectores de pantalla
    setTimeout(() => toast.remove(), 5000);
  }
} catch { /* sin almacenamiento disponible */ }

const dlg = document.createElement('dialog');
dlg.className = 'superpuesta';
document.body.append(dlg);
let cambios = false, cargando = false;

/* ---------- Abrir enlaces de tarjeta encima de la pantalla ---------- */
document.addEventListener('click', e => {
  if (e.defaultPrevented || conModificador(e)) return;
  const a = e.target.closest?.('a[href]');
  if (!a || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (dlg.open) {
    if (!dlg.contains(a)) return;
    // La X, "Cancelar" o "Volver a la refri" vuelven a la pantalla de debajo: se cierra la tarjeta.
    if (a.classList.contains('ficha-x') || (url.origin === location.origin && url.pathname === actual)) { e.preventDefault(); dlg.close(); return; }
    if (esTarjeta(url)) { e.preventDefault(); abrir(url); }
    return;   // cualquier otro enlace navega con normalidad
  }
  if (!esTarjeta(url)) return;
  e.preventDefault();
  document.querySelector('details.cuenta[open]')?.removeAttribute('open');
  abrir(url);
});

async function abrir(url, init = {}) {
  if (cargando) return;
  cargando = true;
  dlg.setAttribute('aria-busy', 'true');
  try {
    const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/html' }, ...init });
    if (init.method === 'POST' && res.redirected) cambios = true;   // el servidor confirmó el cambio
    const final = new URL(res.url);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const ficha = doc.querySelector('main .ficha');
    // Sin tarjeta (inicio de sesión, la refri tras eliminar, cierre de sesión…): navegar.
    // El aviso del servidor ("Producto eliminado.") ya vino en esta respuesta: se conserva
    // para mostrarlo al llegar, porque la sesión solo lo entrega una vez.
    if (!ficha) {
      const aviso = doc.querySelector('main [role="status"]')?.textContent.trim();
      if (aviso) try { sessionStorage.setItem(CLAVE_AVISO, aviso); } catch { /* sin almacenamiento: solo se pierde el aviso */ }
      location.assign(final.href);
      return;
    }
    mostrar(ficha, final);
  } catch {
    location.assign(url.href);
  } finally {
    cargando = false;
    dlg.removeAttribute('aria-busy');
  }
}

/* ---------- Mostrar la tarjeta: ids propios, mejoras y formularios ---------- */
function mostrar(ficha, final) {
  const tarjeta = document.importNode(ficha, true);
  prefijarIds(tarjeta);
  const int = document.createElement('div');
  int.className = 'superpuesta-int';
  int.append(tarjeta);
  dlg.replaceChildren(int);
  const titulo = dlg.querySelector('#dlg-ficha-titulo');
  if (titulo) { dlg.setAttribute('aria-labelledby', titulo.id); titulo.tabIndex = -1; }
  mejorar(tarjeta);
  for (const form of tarjeta.querySelectorAll('form')) form.addEventListener('submit', e => enviar(e, form, final));
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  (titulo || tarjeta).focus({ preventScroll: true });
}

/** Los ids de la tarjeta podrían repetir los de la página (p. ej. #categoryId): se prefijan. */
function prefijarIds(raiz) {
  const ids = new Set([...raiz.querySelectorAll('[id]')].map(el => el.id));
  const ref = v => v.split(/\s+/).map(t => (ids.has(t) ? `dlg-${t}` : t)).join(' ');
  for (const el of raiz.querySelectorAll('[id]')) el.id = `dlg-${el.id}`;
  for (const atr of ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls']) {
    for (const el of raiz.querySelectorAll(`[${atr}]`)) el.setAttribute(atr, ref(el.getAttribute(atr)));
  }
}

function enviar(e, form, final) {
  e.preventDefault();
  if (!form.reportValidity()) return;
  for (const b of form.querySelectorAll('.ver[aria-pressed="true"]')) b.click();   // ocultar contraseñas
  const accion = new URL(form.getAttribute('action') || final.href, final.href);
  const datos = new URLSearchParams(new FormData(form, e.submitter));
  if ((form.getAttribute('method') || 'get').toLowerCase() === 'get') {
    accion.search = datos.toString();
    abrir(accion);
  } else {
    abrir(accion, { method: 'POST', body: datos, headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' } });
  }
}

/* Mismas mejoras que en las páginas completas (sus scripts no se ejecutan aquí). */
function mejorar(raiz) {
  for (const el of raiz.querySelectorAll('[data-color]')) {
    if (/^#[0-9A-F]{6}$/i.test(el.dataset.color)) el.style.setProperty('--c', el.dataset.color);
  }
  for (const img of raiz.querySelectorAll('.ficha-img img')) img.addEventListener('error', () => img.remove(), { once: true });
  // Fechas del producto (como /assets/inventory.js)
  for (const form of raiz.querySelectorAll('[data-inventory-form]')) {
    const { receivedDate: ingreso, expiresDate: caduca } = form.elements;
    const validar = () => caduca.setCustomValidity(ingreso.value && caduca.value && caduca.value < ingreso.value ? 'La caducidad no puede ser anterior al ingreso.' : '');
    ingreso.addEventListener('input', validar); caduca.addEventListener('input', validar); validar();
  }
  // Confirmación de contraseña (como /assets/auth.js)
  for (const form of raiz.querySelectorAll('[data-password-form]')) {
    const clave = form.querySelector('[name="password"]'), otra = form.querySelector('[name="confirmPassword"]');
    if (!clave || !otra) continue;
    const aviso = form.querySelector('[id$="errorContrasena"]');
    const validar = () => {
      const distinta = otra.value && clave.value !== otra.value;
      otra.setCustomValidity(distinta ? 'Las contraseñas no coinciden.' : '');
      aviso?.classList.toggle('hidden', !distinta);
    };
    clave.addEventListener('input', validar); otra.addEventListener('input', validar);
  }
  // Mostrar contraseña (como acceso.js)
  for (const boton of raiz.querySelectorAll('.clave .ver')) {
    const campo = raiz.querySelector(`#${CSS.escape(boton.getAttribute('aria-controls'))}`);
    if (!campo) continue;
    boton.hidden = false;
    boton.addEventListener('click', () => {
      const ver = campo.type === 'password';
      campo.type = ver ? 'text' : 'password';
      boton.setAttribute('aria-pressed', String(ver));
      boton.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }
}

/* ---------- Cerrar: clic fuera, X o Escape. Si hubo cambios, se refresca la vista ---------- */
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => {
  dlg.replaceChildren();
  if (cambios) location.reload();
});
