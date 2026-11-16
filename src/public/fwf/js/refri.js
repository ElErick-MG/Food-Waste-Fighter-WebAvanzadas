/*
 * Food Waste Fighter — la refri abierta (/inventory).
 * Dibuja los productos reales (bloque JSON #datos-refri, de solo lectura) en estantes de
 * vidrio con coverflow. Editar, eliminar y agregar son enlaces a las páginas del
 * servidor (formularios POST con CSRF); aquí no se modifica ningún dato.
 * La vista de lista (#lista) es HTML del servidor: búsqueda, paginación y uso sin JS.
 */
import { crearRefri, W, H, D } from './refri3d.js';
import { tw, parar, RM, EASE, clamp, revelar, ocultar, wait } from './fwf-motion.js';
import { fotoLocal } from './fotos.js';

const $ = s => document.querySelector(s);
const DATOS = JSON.parse($('#datos-refri').textContent);
const interior = $('#interior'), hueco = $('#hueco'), lateral = $('#lateral');
const detalle = $('#detalle'), detIn = $('#detalle .det-in'), cerrarBtn = $('#cerrarRefri');
const lista = $('#lista'), verLista = $('#verLista'), cerrarLista = $('#cerrarLista');
let movil = matchMedia('(max-width:760px)').matches;

/* =====================================================================
   Datos y utilidades
   ===================================================================== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PALETA = ['#4A7FD6', '#2F9E5B', '#D2513F', '#E09B2D', '#8A6FC7', '#2BA3A3'];
const CATS = DATOS.categorias.map((c, i) => ({ ...c, color: /^#[0-9A-F]{6}$/i.test(c.color || '') ? c.color : PALETA[i % PALETA.length] }));
const catDe = id => CATS.find(c => c.id === id);
const PRODS = DATOS.productos;
// Fotos locales de respaldo por nombre (si el producto no tiene imagen propia)
const fallidas = new Set();
function fotoDe(p) {
  if (p.imagen && !fallidas.has(p.imagen)) return p.imagen;
  return fotoLocal(p.nombre);
}
const inicial = p => esc((p.nombre.trim()[0] || '?').toUpperCase());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const NUM = new Intl.NumberFormat('es', { maximumFractionDigits: 3 });
const cant = (n, u) => `${NUM.format(Number(n))} ${u}`;
const textoEstado = d => d < 0 ? `Caducado hace ${-d} ${-d === 1 ? 'día' : 'días'}` : d === 0 ? 'Caduca hoy' : d === 1 ? 'Caduca mañana' : `Caduca en ${d} días`;

/* Filtros: los mismos estados que el servidor (?status=) */
const ESTADOS = [
  ['todos', 'Todos', '', () => true],
  ['proximos', 'Próximos (0–5 días)', '#E09B2D', p => p.dias >= 0 && p.dias <= 5],
  ['caducados', 'Caducados', '#A32D2D', p => p.dias < 0],
  ['criticos', 'Críticos (0–2 días)', '#E25B5B', p => p.dias >= 0 && p.dias <= 2],
  ['advertencia', 'Advertencia (3–5 días)', '#EF9F27', p => p.dias >= 3 && p.dias <= 5],
  ['normal', 'Normal (6+ días)', '#9C9A92', p => p.dias >= 6],
  ['stock', 'Stock bajo', '#8A6FC7', p => p.bajo],
];
const filtro = {
  estado: ESTADOS.some(e => e[0] === DATOS.filtro.estado) ? DATOS.filtro.estado : 'todos',
  cats: DATOS.filtro.categoria && catDe(DATOS.filtro.categoria) ? new Set([DATOS.filtro.categoria]) : null,
};
const pasaEstado = p => ESTADOS.find(e => e[0] === filtro.estado)[3](p);
const MAX_ESTANTES = 6;
const visibles = () => CATS.filter(c => !filtro.cats || filtro.cats.has(c.id)).slice(0, MAX_ESTANTES);
const prodsDe = id => PRODS.filter(p => p.categoriaId === id && pasaEstado(p)).sort((a, b) => a.dias - b.dias);

/** Colores por CSSOM: [data-color] → --c (la CSP no permite style="" en el HTML). */
function pintarColores(raiz) {
  for (const el of raiz.querySelectorAll('[data-color]')) el.style.setProperty('--c', el.dataset.color);
}
const ICO = {
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  expired: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  critical: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  warning: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  normal: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.3"/>',
  cursor: '<path d="M5 3l14 7-6 2-2 6z"/>',
};
const ico = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
const medio = p => {
  const src = fotoDe(p), c = catDe(p.categoriaId);
  return src ? `<img alt="" draggable="false" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(src)}">`
    : `<span class="ini-g" data-color="${c?.color || ''}" aria-hidden="true">${inicial(p)}</span>`;
};
/** Si una foto falla, se usa la inicial sobre el color de la categoría. */
function cablearImgs(raiz, p) {
  for (const img of raiz.querySelectorAll('img')) img.addEventListener('error', () => {
    fallidas.add(img.getAttribute('src'));
    const span = document.createElement('span');
    span.className = 'ini-g'; span.setAttribute('aria-hidden', 'true'); span.textContent = (p.nombre.trim()[0] || '?').toUpperCase();
    span.style.setProperty('--c', catDe(p.categoriaId)?.color || '');
    img.replaceWith(span);
  }, { once: true });
}

/* =====================================================================
   Refri 3D, estantes de vidrio y pose en el nicho de la cocina
   ===================================================================== */
let forzarN = 0, renderHasta = 0, firma = '';
const forzar = (n = 2) => { forzarN = Math.max(forzarN, n); };
let R = null;
try { R = crearRefri($('#refri3d'), { alCargar: () => forzar(3) }); }
catch (e) { console.warn('Refri 3D no disponible:', e.message); }
document.documentElement.classList.toggle('sin-3d', !R);
if (!R) interior.classList.add('plano');

const TW = .03, Y0 = .15, YT = 1.70;
const estantes = [];
for (let k = 0; k < MAX_ESTANTES; k++) {
  if (!R) { estantes.push({ y: Y0, yT: Y0, vis: 0, visT: 0 }); continue; }
  const gm = R.MD.glassM.clone();
  const s = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * TW - .01, .008, .56), gm);
  s.position.set(0, Y0, -.06); s.castShadow = s.receiveShadow = true;
  const em = new THREE.LineBasicMaterial({ color: 0x5fd1bf, transparent: true });
  s.add(new THREE.LineSegments(new THREE.EdgesGeometry(s.geometry), em));
  const tm = R.MD.trim.clone(); tm.transparent = true;
  const tr = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * TW - .01, .014, .012), tm); tr.position.set(0, 0, .28); s.add(tr);
  R.MD.fr.add(s);
  estantes.push({ mesh: s, gm, em, tm, y: Y0, yT: Y0, vis: 0, visT: 0 });
}
let S = 4, GAPY = (YT - Y0) / 4;

const pose = { th: 0, ph: Math.PI / 2, hPx: 500, ax: 600, ay: 400, puertas: 0, calidez: 1 };
let vw = 1, vh = 1, estado = 'abriendo';
function measure() {
  vw = innerWidth; vh = innerHeight;
  movil = matchMedia('(max-width:760px)').matches;
  const sc = Math.max(vw / 1672, vh / 941), ox = (vw - 1672 * sc) / 2, oy = (vh - 941 * sc) / 2;
  const gx = ox + .506 * 1672 * sc, gy = oy + .885 * 941 * sc, alto = .74 * 941 * sc;
  Object.assign(pose, { th: 0, ph: Math.PI / 2, hPx: alto, ax: gx, ay: gy - alto / 2 });
  if (movil) { cerrarBtn.style.removeProperty('left'); cerrarBtn.style.removeProperty('top'); cerrarBtn.classList.remove('colocada'); }
  else {
    cerrarBtn.style.left = `${gx - cerrarBtn.offsetWidth / 2}px`;
    cerrarBtn.style.top = `${Math.min(gy + 14, vh - cerrarBtn.offsetHeight - 12)}px`;
    cerrarBtn.classList.add('colocada');
  }
  if (R) R.tamano(vw, vh);
  for (const sec of document.querySelectorAll('.acord')) abrirAcord(sec, sec.dataset.abierto === 'true');
  forzar(4);
}

function asignarEstantes(snap) {
  const vis = visibles();
  S = Math.max(4, vis.length); GAPY = (YT - Y0) / S;
  estantes.forEach((s, k) => {
    s.yT = Y0 + Math.min(k, S - 1) * GAPY;
    const vt = k < S ? 1 : 0;
    if (snap) { s.y = s.yT; s.vis = vt; s.visT = vt; }
    else if (vt !== s.visT) { s.visT = vt; if (vt && s.vis < .01) s.y = s.yT; tw(s, { vis: vt }, { duration: .3, ease: EASE }); }
  });
  return vis;
}

/* =====================================================================
   Filas (un estante por categoría) y coverflow
   ===================================================================== */
const filas = new Map(), salientes = new Set();
const filasEnOrden = () => [...filas.values()].sort((a, b) => a.i - b.i);

function crearFila(cat) {
  const el = document.createElement('div');
  el.className = 'fila'; el.setAttribute('role', 'group');
  el.innerHTML = `<div class="flow"></div>
    <div class="vacio"><span>No hay productos aquí con este filtro</span></div>
    <a class="mas" href="/inventory/new"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></a>
    <span class="etq"></span>`;
  hueco.appendChild(el);
  const f = { cat, el, flow: el.querySelector('.flow'), etq: el.querySelector('.etq'), mas: el.querySelector('.mas'),
    tarjetas: [], fuera: [], pos: 0, st: { o: 0, dy: 12 }, i: 0, k: 0, cw: 0, ch: 0 };
  cablearFlow(f);
  return f;
}

function crearTarjeta(f, p) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'prod'; b.dataset.id = p.id;
  b.innerHTML = medio(p);
  pintarColores(b); cablearImgs(b, p);
  const c = { p, el: b, st: { k: 1, o: 1 } };
  b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !f.arr) hover(c, true); });
  b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hover(c, false); });
  b.addEventListener('focus', () => { hover(c, true); if (!movil) mostrarDetalle(c.p); });
  b.addEventListener('blur', () => hover(c, false));
  b.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = f.tarjetas.indexOf(c) + (e.key === 'ArrowRight' ? 1 : -1);
    if (i >= 0 && i < f.tarjetas.length) { irA(f, i); f.tarjetas[i].el.focus({ preventScroll: true }); }
  });
  b.addEventListener('click', e => { if (e.detail === 0) tocarTarjeta(f, c); });   // teclado (Enter/Espacio)
  return c;
}
function hover(c, on) {
  c.el.classList.toggle('hov', on);
  if (on && !movil) mostrarDetalle(c.p);
}
function tocarTarjeta(f, c) {
  const i = f.tarjetas.indexOf(c);
  if (i < 0) return;
  if (i !== Math.round(f.pos)) irA(f, i);
  mostrarDetalle(c.p);
  if (movil) abrirHoja();
}
function irA(f, i) {
  if (!f.tarjetas.length) return;
  tw(f, { pos: clamp(i, 0, f.tarjetas.length - 1) }, RM ? { duration: .2, ease: 'linear' } : { type: 'spring', stiffness: 300, damping: 32 });
}
function cablearFlow(f) {
  const fl = f.flow;
  fl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    parar(f, 'pos');
    f.arr = { id: e.pointerId, x: e.clientX, mov: 0, t: performance.now(), v: 0, tarjeta: e.target.closest('.prod') };
    fl.setPointerCapture(e.pointerId);
  });
  fl.addEventListener('pointermove', e => {
    const a = f.arr;
    if (!a || a.id !== e.pointerId) return;
    const dx = e.clientX - a.x, now = performance.now(), dt = Math.max(1, now - a.t);
    a.x = e.clientX; a.t = now; a.mov += Math.abs(dx);
    if (a.mov < 6) return;
    fl.classList.add('arrastre');
    const dpos = dx / (f.paso || f.cw * .62 || 100);
    f.pos = clamp(f.pos - dpos, -.5, Math.max(0, f.tarjetas.length - 1) + .5);
    a.v = a.v * .7 + (dpos / (dt / 1000)) * .3;
  });
  const fin = e => {
    const a = f.arr;
    if (!a || a.id !== e.pointerId) return;
    f.arr = null; fl.classList.remove('arrastre');
    if (a.mov < 6) {
      const c = a.tarjeta && f.tarjetas.find(t => t.el === a.tarjeta);
      if (c) tocarTarjeta(f, c); else irA(f, Math.round(f.pos));
      return;
    }
    irA(f, Math.round(f.pos - a.v * .15));
  };
  fl.addEventListener('pointerup', fin);
  fl.addEventListener('pointercancel', fin);
  // Rueda: un paso por gesto (los trackpads suman muchos deltas pequeños)
  let acumulado = 0, ultimoPaso = 0, destino = null, tRueda = 0;
  f.rueda = delta => {
    const n = f.tarjetas.length;
    if (!n) return;
    acumulado += delta;
    const ahora = performance.now();
    if (Math.abs(acumulado) >= 28 && ahora - ultimoPaso > 110) {
      const dir = Math.sign(acumulado); acumulado = 0; ultimoPaso = ahora;
      destino = clamp((destino ?? Math.round(f.pos)) + dir, 0, n - 1);
      irA(f, destino);
    }
    clearTimeout(tRueda);
    tRueda = setTimeout(() => { acumulado = 0; destino = null; }, 220);
  };
}

/** Sincroniza filas, tarjetas, estantes, chips y contadores con los datos y el filtro. */
function sincronizar({ animar = true, snap = false } = {}) {
  const vis = asignarEstantes(snap);
  const ids = new Set(vis.map(c => c.id));
  for (const [id, f] of filas) if (!ids.has(id)) { filas.delete(id); salirFila(f, animar); }
  vis.forEach((cat, i) => {
    let f = filas.get(cat.id), nueva = false;
    if (!f) { f = crearFila(cat); filas.set(cat.id, f); nueva = true; }
    f.cat = cat; f.i = i; f.k = S - 1 - i;
    f.el.setAttribute('aria-label', `Estante ${cat.nombre}`);
    f.mas.setAttribute('aria-label', `Agregar producto (${cat.nombre})`);
    actualizarTarjetas(f, animar && !nueva);
    if (nueva) {
      f.pos = Math.floor(Math.max(0, f.tarjetas.length - 1) / 2);
      if (estado === 'dentro') { if (animar) entrarFila(f, 0); else { f.st.o = 1; f.st.dy = 0; } }
    }
  });
  vis.forEach(c => hueco.appendChild(filas.get(c.id).el));   // orden del DOM = orden visual
  hueco.querySelector('.refri-vacia')?.remove();
  if (!CATS.length) {
    const v = document.createElement('div');
    v.className = 'refri-vacia';
    v.innerHTML = DATOS.puedeCategorias
      ? '<p>Tu refri aún no tiene estantes.</p><a class="btn btn-pri" href="/categories">Crear una categoría</a>'
      : '<p>Tu refri aún no tiene estantes. Pide a administración que cree una categoría.</p>';
    hueco.appendChild(v);
  }
  pintarChips(); contadores();
}
function actualizarTarjetas(f, animar) {
  const prods = prodsDe(f.cat.id), ids = new Set(prods.map(p => p.id));
  const quedan = [];
  for (const c of f.tarjetas) {
    if (ids.has(c.p.id)) { quedan.push(c); continue; }
    f.fuera.push(c);
    const fin = () => { c.el.remove(); f.fuera = f.fuera.filter(x => x !== c); };
    if (animar) tw(c.st, { k: .8, o: 0 }, { duration: .25, ease: EASE }).then(fin); else fin();
  }
  const porId = new Map(quedan.map(c => [c.p.id, c]));
  f.tarjetas = prods.map(p => {
    let c = porId.get(p.id);
    if (!c) { c = crearTarjeta(f, p); f.flow.appendChild(c.el); if (animar) { c.st.k = .6; c.st.o = 0; } }
    c.p = p;
    c.el.setAttribute('aria-label', `${p.nombre}, ${f.cat.nombre}, ${textoEstado(p.dias).toLowerCase()}${p.bajo ? ', stock bajo' : ''}`);
    return c;
  });
  f.tarjetas.forEach((c, i) => { if (animar && c.st.o === 0) tw(c.st, { k: 1, o: 1 }, { duration: .3, ease: EASE, delay: i * .03 }); });
  f.pos = clamp(f.pos, 0, Math.max(0, f.tarjetas.length - 1));
  f.el.classList.toggle('sin', f.tarjetas.length === 0);
  f.etq.innerHTML = `<i class="pc" data-color="${f.cat.color}" aria-hidden="true"></i><span>${esc(f.cat.nombre)} · ${f.tarjetas.length}</span>`;
  pintarColores(f.etq);
}
function entrarFila(f, idx) {
  f.st.o = 1; f.st.dy = 16;
  tw(f.st, { dy: 0 }, { duration: .6, ease: EASE, delay: idx * .08 });
  const act = Math.round(f.pos);
  f.tarjetas.forEach((c, i) => { c.st.k = .85; c.st.o = 1; tw(c.st, { k: 1 }, { duration: .45, ease: EASE, delay: idx * .08 + Math.abs(i - act) * .04 }); });
}
function salirFila(f, animar) {
  salientes.add(f);
  const fin = () => { f.el.remove(); salientes.delete(f); };
  if (!animar) { fin(); return; }
  f.tarjetas.forEach((c, i) => tw(c.st, { k: .8, o: 0 }, { duration: .25, ease: EASE, delay: i * .03 }));
  tw(f.st, { o: 0 }, { duration: .25, delay: Math.min(.3, f.tarjetas.length * .03) }).then(fin);
}

/* ---------- Proyección por frame: hueco, filas y tarjetas ---------- */
let hR = { x: 0, y: 0, w: 0, h: 0 };
function layoutInterior() {
  if (R) {
    const a = R.proyectar(-(W / 2 - TW), TW + .03, D / 2), b = R.proyectar(W / 2 - TW, H - TW + .03, D / 2);
    hR = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
  } else if (movil) {
    hR = { x: 12, y: 76, w: vw - 24, h: vh - 160 };
  } else {
    const izq = 330, der = Math.min(vw - 420, vw - 24);
    hR = { x: izq, y: 32, w: Math.max(240, der - izq), h: vh - 128 };
  }
  hueco.style.transform = `translate(${hR.x.toFixed(1)}px,${hR.y.toFixed(1)}px)`;
  hueco.style.width = `${hR.w.toFixed(1)}px`; hueco.style.height = `${hR.h.toFixed(1)}px`;
  for (const f of filas.values()) colocarFila(f);
  for (const f of salientes) colocarFila(f);
}
function colocarFila(f) {
  let x, y, w, h;
  if (R) {
    const s = estantes[f.k] || estantes[0];
    const piso = s.y, techo = f.k + 1 < S ? estantes[f.k + 1].y : YT;
    const p1 = R.proyectar(-.425, piso + .03, .22), p2 = R.proyectar(.425, piso + .03, .22), p3 = R.proyectar(-.425, techo + .03, .22);
    x = p1[0] - hR.x; w = p2[0] - p1[0]; y = p3[1] - hR.y; h = p1[1] - p3[1];
  } else {
    const zh = hR.h / S; x = 16; w = hR.w - 32; y = f.i * zh + 12; h = zh - 26;
  }
  const oculta = h < 4;
  if (oculta !== f.oculta) { f.el.style.visibility = oculta ? 'hidden' : ''; f.oculta = oculta; }
  if (oculta) return;
  const geo = `${x.toFixed(1)}|${(y + f.st.dy).toFixed(1)}|${w.toFixed(1)}|${h.toFixed(1)}|${f.st.o}`;
  if (geo !== f.geo) {
    f.geo = geo;
    f.el.style.transform = `translate(${x.toFixed(1)}px,${(y + f.st.dy).toFixed(1)}px)`;
    f.el.style.width = `${w.toFixed(1)}px`; f.el.style.height = `${h.toFixed(1)}px`;
    f.el.style.opacity = f.st.o;
  }
  f.w = w;
  const ch = Math.round(.82 * (h - 8)), cw = Math.round(.78 * ch);
  if (ch !== f.ch) { f.ch = ch; f.cw = cw; f.el.style.setProperty('--ch', `${ch}px`); f.el.style.setProperty('--cw', `${cw}px`); }
  coverflow(f);
}
function coverflow(f) {
  const cw = f.cw || 100;
  const mitad = Math.max(cw, (f.w || cw * 4) / 2 - cw / 2 - 6);
  const paso = Math.min(cw * 1.05, mitad * .5), resto = (mitad - paso) / 2;
  f.paso = paso;
  f.tarjetas.forEach((c, i) => {
    const d = i - f.pos, a = Math.abs(d), sg = Math.sign(d);
    let x, rot, z;
    if (RM) { x = d * (cw + 12); rot = 0; z = 0; }
    else { x = a <= 1 ? d * paso : sg * (paso + (a - 1) * resto); rot = -clamp(d, -1, 1) * 32; z = -Math.min(a, 3) * 70; }
    const s = 1 - Math.min(a, 3) * .08;
    const op = RM ? (a > 3.5 ? 0 : 1) : (a > 3.5 ? 0 : a > 2.5 ? (3.5 - a) : 1);
    c.last = { x, rot, z, s };
    const tf = `translate3d(${x.toFixed(2)}px,0,${z.toFixed(1)}px) rotateY(${rot.toFixed(2)}deg) scale(${(s * c.st.k).toFixed(4)})`;
    if (tf !== c.tf) { c.el.style.transform = tf; c.tf = tf; }
    const o = Math.round(op * c.st.o * 1000) / 1000;
    if (o !== c.o) { c.el.style.opacity = o; c.o = o; }
    const zi = 100 - Math.round(a * 10);
    if (zi !== c.zi) { c.el.style.zIndex = zi; c.zi = zi; }
    const sp = o < .05;
    if (sp !== c.sp) { c.el.style.pointerEvents = sp ? 'none' : ''; c.sp = sp; }
    const ti = op > .05 ? 0 : -1;
    if (ti !== c.ti) { c.el.tabIndex = ti; c.ti = ti; }
  });
  for (const c of f.fuera) {
    const l = c.last || { x: 0, rot: 0, z: 0, s: 1 };
    c.el.style.transform = `translateX(${l.x}px) translateZ(${l.z}px) rotateY(${l.rot}deg) scale(${l.s * c.st.k})`;
    c.el.style.opacity = c.st.o; c.el.style.pointerEvents = 'none';
  }
}

/* =====================================================================
   Panel lateral: filtros (acordeón), contadores
   ===================================================================== */
const estadosEl = $('#estados'), catsEl = $('#cats');
// Los chips se crean una vez y luego solo cambian de estado: así el foco del teclado no se pierde.
estadosEl.innerHTML = ESTADOS.map(([id, nombre, color, cond]) =>
  `<button type="button" class="chip" data-e="${id}" aria-pressed="false"><span class="ok" hidden>${ICO.check}</span>${color ? `<i class="pc" data-color="${color}" aria-hidden="true"></i>` : ''}${esc(nombre)} <span class="n">${PRODS.filter(cond).length}</span></button>`).join('');
catsEl.innerHTML = `<button type="button" class="chip" data-c="*" aria-pressed="false"><span class="ok" hidden>${ICO.check}</span>Todas</button>` +
  CATS.map(c => `<button type="button" class="chip" data-c="${esc(c.id)}" aria-pressed="false"><span class="ok" hidden>${ICO.check}</span><i class="pc" data-color="${c.color}" aria-hidden="true"></i>${esc(c.nombre)} <span class="n">${PRODS.filter(p => p.categoriaId === c.id).length}</span></button>`).join('');
pintarColores(estadosEl); pintarColores(catsEl);
const marcar = (b, on) => { b.setAttribute('aria-pressed', String(on)); b.querySelector('.ok').hidden = !on; };
function pintarChips() {
  for (const b of estadosEl.children) marcar(b, b.dataset.e === filtro.estado);
  $('#vEst').textContent = ESTADOS.find(e => e[0] === filtro.estado)[1].split(' (')[0];
  const todas = !filtro.cats;
  for (const b of catsEl.children) marcar(b, b.dataset.c === '*' ? todas : !todas && filtro.cats.has(b.dataset.c));
  const sel = todas ? [] : CATS.filter(c => filtro.cats.has(c.id));
  $('#vCats').textContent = todas ? 'Todas' : sel.length === 1 ? sel[0].nombre : `${sel.length} categorías`;
  const nota = $('#limiteNota'), mensajes = [];
  if (CATS.length > MAX_ESTANTES && visibles().length === MAX_ESTANTES && (!filtro.cats || filtro.cats.size > MAX_ESTANTES)) mensajes.push(`La refri muestra ${MAX_ESTANTES} estantes a la vez: elige categorías para ver las demás.`);
  if (DATOS.limite) mensajes.push(`Se muestran los ${DATOS.limite} productos que caducan antes; la vista de lista incluye todos.`);
  nota.textContent = mensajes.join(' ');
  nota.hidden = !mensajes.length;
}
estadosEl.addEventListener('click', e => {
  const b = e.target.closest('[data-e]');
  if (!b) return;
  filtro.estado = b.dataset.e;
  sincronizar({ animar: true });
});
catsEl.addEventListener('click', e => {
  const b = e.target.closest('[data-c]');
  if (!b) return;
  const id = b.dataset.c;
  if (id === '*') filtro.cats = null;
  else if (!filtro.cats) filtro.cats = new Set([id]);
  else { if (filtro.cats.has(id)) filtro.cats.delete(id); else filtro.cats.add(id); if (!filtro.cats.size) filtro.cats = null; }
  sincronizar({ animar: true });
});
function contadores() {
  $('#cTot').textContent = PRODS.length;
  $('#cPor').textContent = PRODS.filter(p => p.dias <= 2).length;
}
/* Acordeón: cerrado, su contenido sale del orden de foco (en móvil siempre está abierto) */
function abrirAcord(sec, on) {
  sec.dataset.abierto = on;
  sec.querySelector('.acord-cab').setAttribute('aria-expanded', on);
  sec.querySelector('.acord-cuerpo').inert = !on && !movil;
}
for (const sec of document.querySelectorAll('.acord')) {
  sec.querySelector('.acord-cab').addEventListener('click', () => abrirAcord(sec, sec.dataset.abierto !== 'true'));
}
if (filtro.estado !== 'todos') document.querySelector('#hEst').closest('.acord').dataset.abierto = 'true';
if (filtro.cats) document.querySelector('#hCats').closest('.acord').dataset.abierto = 'true';

/* =====================================================================
   Detalle del producto (enlaces a las páginas del servidor)
   ===================================================================== */
let detId = null;
const htmlVacio = () => `<div class="det-vacio">${ico('cursor', 28)}<p>${movil ? 'Toca' : 'Pasa el cursor sobre'} un producto para ver sus detalles</p></div>`;
function htmlDetalle(p) {
  const c = catDe(p.categoriaId), id = encodeURIComponent(p.id);
  const ingreso = parse(p.ingreso), caduca = parse(p.caducidad), hoy = parse(DATOS.hoy);
  const vida = caduca > ingreso ? clamp((hoy - ingreso) / (caduca - ingreso), 0, 1) : 1;
  const COLOR = { expired: '#A32D2D', critical: '#E25B5B', warning: '#EF9F27', normal: '#9C9A92' };
  return `<div class="d-img">${medio(p)}</div>
    <div class="d-tit"><h2>${esc(p.nombre)}</h2><span class="d-cat"><i class="pc" data-color="${c?.color || ''}" aria-hidden="true"></i>${esc(c?.nombre || '')}</span></div>
    <div class="badge b-${p.estado}">${ico(p.estado)}<span>${textoEstado(p.dias)}</span></div>
    <div class="vida"><div class="vida-bar" role="img" aria-label="Vida útil consumida: ${Math.round(vida * 100)} %"><i data-color="${COLOR[p.estado]}" data-ancho="${(vida * 100).toFixed(1)}"></i></div>
      <div class="vida-f"><span>Ingresó el ${FECHA.format(ingreso)}</span><span>Caduca el ${FECHA.format(caduca)}</span></div></div>
    <dl class="d-dl"><dt>Cantidad</dt><dd>${esc(cant(p.cantidad, p.unidad))}${p.bajo ? '<span class="bajo">Stock bajo</span>' : ''}</dd>
      <dt>Stock mínimo</dt><dd>${esc(cant(p.stockMin, p.unidad))}</dd><dt>Estante</dt><dd>${esc(c?.nombre || '')}</dd></dl>
    <div class="d-acc"><a class="btn-cons" href="/inventory/${id}/edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>Editar<span class="sr-only"> ${esc(p.nombre)}</span></a>
      ${DATOS.puedeEliminar ? `<a class="enlace peligro" href="/inventory/${id}/delete">Eliminar<span class="sr-only"> ${esc(p.nombre)}</span></a>` : ''}</div>`;
}
async function mostrarDetalle(p) {
  if ((p?.id ?? null) === detId) return;
  detId = p ? p.id : null;
  detIn.innerHTML = p ? htmlDetalle(p) : htmlVacio();
  pintarColores(detIn);
  const barra = detIn.querySelector('[data-ancho]');
  if (barra) barra.style.width = `${barra.dataset.ancho}%`;
  if (p) cablearImgs(detIn, p);
  detIn.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: RM ? 1 : 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
function abrirHoja() { if (movil) detalle.classList.add('abierta'); }
function cerrarHoja() { detalle.classList.remove('abierta'); }
{
  const asa = detalle.querySelector('.asa');
  let y0 = null;
  asa.addEventListener('pointerdown', e => { y0 = e.clientY; asa.setPointerCapture(e.pointerId); });
  asa.addEventListener('pointerup', e => { if (y0 !== null && e.clientY - y0 > 30) cerrarHoja(); y0 = null; });
  asa.addEventListener('click', cerrarHoja);
}

/* =====================================================================
   Vista de lista y cuenta
   ===================================================================== */
cerrarLista.hidden = false;
function mostrarLista(on) {
  if (on) document.body.setAttribute('data-lista', ''); else document.body.removeAttribute('data-lista');
  verLista.setAttribute('aria-expanded', String(on));
  if (on) lista.focus({ preventScroll: true }); else verLista.focus({ preventScroll: true });
}
verLista.addEventListener('click', () => mostrarLista(true));
cerrarLista.addEventListener('click', () => mostrarLista(false));
$('.salto').addEventListener('click', e => { e.preventDefault(); mostrarLista(true); });

const cuenta = $('.cuenta');
document.addEventListener('click', e => { if (cuenta?.open && !cuenta.contains(e.target)) cuenta.open = false; });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (cuenta?.open) { cuenta.open = false; cuenta.querySelector('summary').focus(); return; }
  if (detalle.classList.contains('abierta')) { cerrarHoja(); return; }
  if (document.body.hasAttribute('data-lista') && lista.contains(document.activeElement)) mostrarLista(false);
});

/* =====================================================================
   Rueda sobre los estantes y cierre de la refri
   ===================================================================== */
addEventListener('wheel', e => {
  if (estado !== 'dentro' || document.body.hasAttribute('data-lista')) return;
  const fila = e.target.closest?.('.fila');
  if (!fila) return;
  e.preventDefault();
  const f = [...filas.values()].find(x => x.el === fila);
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  f?.rueda(d * (e.deltaMode === 1 ? 40 : 1));
}, { passive: false });

cerrarBtn.addEventListener('click', async e => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !R || estado !== 'dentro') return;
  e.preventDefault();
  estado = 'cerrando';
  await ocultar([interior, lateral, detalle], RM ? 1 : 260);
  tw(pose, { puertas: 0 }, RM ? { duration: .2, ease: 'linear' } : { duration: .4, ease: EASE });
  await wait(RM ? 0 : .38);
  location.assign(cerrarBtn.href);
});
addEventListener('pageshow', e => {
  if (!e.persisted) return;
  for (const el of [interior, lateral, detalle]) el.getAnimations().forEach(a => a.cancel());
  pose.puertas = 1; estado = 'dentro';
});

/* =====================================================================
   Bucle (un solo rAF) y arranque
   ===================================================================== */
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  if (R) {
    let cambio = false;
    for (const s of estantes) {
      const dy = s.yT - s.y;
      if (Math.abs(dy) > 1e-4) { s.y += dy * .14; cambio = true; } else s.y = s.yT;
      s.mesh.position.y = s.y; s.mesh.scale.x = .6 + .4 * s.vis;
      s.gm.opacity = .38 * s.vis; s.em.opacity = s.vis; s.tm.opacity = s.vis; s.mesh.visible = s.vis > .01;
    }
    R.aplicar(pose);
    const sg = [pose.hPx, pose.ax, pose.ay, pose.puertas, vw, vh].map(v => v.toFixed(3)).join('|') + estantes.map(s => s.y.toFixed(4) + s.vis.toFixed(3)).join('');
    if (sg !== firma || forzarN > 0 || now < renderHasta || cambio) {
      R.render(); firma = sg;
      if (forzarN > 0) forzarN--;
    }
  }
  layoutInterior();
}

/* Enlace a un producto concreto (#producto-ID, p. ej. desde una alerta del Resumen):
   se ajusta el filtro para que su estante esté visible y, al abrir, se selecciona. */
const seleccionado = (() => {
  const m = location.hash.match(/^#producto-(.+)$/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  const p = PRODS.find(x => x.id === decodeURIComponent(m[1]));
  if (!p) return null;
  if (!pasaEstado(p)) filtro.estado = 'todos';
  if (!visibles().some(c => c.id === p.categoriaId)) filtro.cats = new Set([p.categoriaId]);
  if (filtro.cats) document.querySelector('#hCats').closest('.acord').dataset.abierto = 'true';
  return p;
})();
function seleccionar(p) {
  const f = filas.get(p.categoriaId), c = f?.tarjetas.find(t => t.p.id === p.id);
  if (f && c) { f.pos = f.tarjetas.indexOf(c); c.el.focus({ preventScroll: true }); }
  mostrarDetalle(p);
  if (movil) abrirHoja();
}

detIn.innerHTML = htmlVacio();
sincronizar({ animar: false, snap: true });
interior.style.opacity = 0;
(document.fonts?.ready ?? Promise.resolve()).catch(() => {}).then(async () => {
  measure();
  addEventListener('resize', measure);
  renderHasta = performance.now() + 3000;
  requestAnimationFrame(frame);
  revelar([...lateral.children, detalle, cerrarBtn], 60);
  if (R) {
    tw(pose, { puertas: 1 }, RM ? { duration: .2, ease: 'linear' } : { type: 'spring', stiffness: 90, damping: 13 });
    await wait(RM ? 0 : .3);
  }
  interior.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 300, fill: 'forwards' }).finished.then(() => {
    interior.style.opacity = 1;
    interior.getAnimations().forEach(a => a.cancel());
  });
  estado = 'dentro';
  if (seleccionado) {
    const f = filas.get(seleccionado.categoriaId), c = f?.tarjetas.find(t => t.p.id === seleccionado.id);
    if (f && c) f.pos = f.tarjetas.indexOf(c);   // la fila entra ya centrada en el producto
  }
  filasEnOrden().forEach((f, i) => entrarFila(f, i));
  if (seleccionado) seleccionar(seleccionado);
});
