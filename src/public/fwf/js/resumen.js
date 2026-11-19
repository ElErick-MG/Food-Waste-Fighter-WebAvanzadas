/*
 * Food Waste Fighter — Resumen (/dashboard).
 * La refri cerrada vive en el nicho de la foto de la cocina. Al llegar desde la portada
 * (?desde=portada) una hoja crece desde la silueta de la refri, la cocina se descubre
 * en manchas de tinta y la refri aterriza en el nicho. Todo es decorativo: los datos y
 * los enlaces son HTML del servidor y funcionan sin JavaScript ni WebGL.
 */
import { crearRefri } from './refri3d.js';
import { tw, RM, EASE, HOJA, revelar, wait } from './fwf-motion.js';
import { completarFotos } from './fotos.js';

const $ = s => document.querySelector(s);
const escena = $('#escena'), capa = $('#cocinaCapa'), velo = $('#cocinaVelo');
const gotas = $('#gotas'), cocinaImg = $('#cocinaImg'), cv = $('#refri3d');
const resumen = $('#resumen'), abrirBtn = $('#abrirRefri');
const llegando = document.body.hasAttribute('data-transicion');

/* ---------- Detalles sin JS en el HTML: colores de categoría e imágenes rotas ---------- */
for (const mini of document.querySelectorAll('.mini[data-color]')) {
  if (/^#[0-9A-F]{6}$/i.test(mini.dataset.color)) mini.style.setProperty('--c', mini.dataset.color);
}
// Foto propia del producto o, si no tiene, la foto local que corresponde a su nombre.
for (const img of document.querySelectorAll('.mini img')) if (img.complete && !img.naturalWidth) img.remove();
completarFotos(document, '.mini[data-nombre]');

/* ---------- Menú de cuenta: se cierra al hacer clic fuera o con Escape ---------- */
const cuenta = $('.cuenta');
document.addEventListener('click', e => { if (cuenta?.open && !cuenta.contains(e.target)) cuenta.open = false; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && cuenta?.open) { cuenta.open = false; cuenta.querySelector('summary').focus(); }
});

/* ---------- Refri 3D ---------- */
let forzarN = 0, renderHasta = 0, firma = '';
const forzar = (n = 2) => { forzarN = Math.max(forzarN, n); };
let R = null;
try { R = crearRefri(cv, { alCargar: () => forzar(3) }); }
catch (e) { console.warn('Refri 3D no disponible:', e.message); }
document.documentElement.classList.toggle('sin-3d', !R);

const pose = { th: 0, ph: Math.PI / 2, hPx: 500, ax: 600, ay: 400, puertas: 0, calidez: 1 };
let HERO, NICHO, vw = 1, vh = 1, movil = false, estado = llegando ? 'llegando' : 'resumen';

function measure() {
  vw = innerWidth; vh = innerHeight;
  movil = matchMedia('(max-width:760px)').matches;
  HERO = { th: .42, ph: 1.40, hPx: (movil ? .42 : .68) * vh, ax: .5 * vw, ay: .52 * vh };
  // Mapeo "cover" de la foto (1672×941): el nicho está en (50,6 %, 88,5 %) de la imagen.
  const sc = Math.max(vw / 1672, vh / 941), ox = (vw - 1672 * sc) / 2, oy = (vh - 941 * sc) / 2;
  const gx = ox + .506 * 1672 * sc, gy = oy + .885 * 941 * sc, alto = .74 * 941 * sc;
  NICHO = { th: 0, ph: Math.PI / 2, hPx: alto, ax: gx, ay: gy - alto / 2 };
  if (movil) { abrirBtn.style.removeProperty('left'); abrirBtn.style.removeProperty('top'); abrirBtn.classList.remove('colocada'); }
  else {
    abrirBtn.style.left = `${gx - abrirBtn.offsetWidth / 2}px`;
    abrirBtn.style.top = `${Math.min(gy + 12, vh - abrirBtn.offsetHeight - 12)}px`;
    abrirBtn.classList.add('colocada');
  }
  if (!R) return;
  R.tamano(vw, vh);
  if (estado === 'resumen') Object.assign(pose, { th: NICHO.th, ph: NICHO.ph, hPx: NICHO.hPx, ax: NICHO.ax, ay: NICHO.ay });
  forzar(4);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden || !R) return;
  R.aplicar(pose);
  const sg = [pose.th, pose.ph, pose.hPx, pose.ax, pose.ay, pose.puertas, pose.calidez, vw, vh].map(v => v.toFixed(3)).join('|');
  if (sg !== firma || forzarN > 0 || now < renderHasta) {
    R.render(); firma = sg;
    if (forzarN > 0) forzarN--;
  }
}

/* ---------- Interacción con la refri: se asoma al pasar el puntero; clic abre el inventario ---------- */
let espiando = false;
function espiar(on) {
  if (on === espiando) return;
  espiando = on;
  document.body.classList.toggle('sobre-refri', on);
  tw(pose, { puertas: on ? .06 : 0 }, { type: 'spring', stiffness: 200, damping: 18 });
}
/*
 * La refri solo responde cuando el puntero está directamente sobre el fondo de la escena.
 * Antes se usaba una lista de exclusiones (enlaces, columnas…) y cualquier capa nueva encima
 * —tarjetas superpuestas, chat, avisos— dejaba pasar el clic y abría la refri. Ahora:
 *  - si hay una tarjeta (<dialog>) abierta, la refri no reacciona;
 *  - el destino del evento debe ser el fondo: #resumen (la capa transparente), la escena
 *    de la cocina, <body> o <html>. Cualquier otro elemento es interfaz y tiene prioridad.
 */
const sobreFondo = e => !document.querySelector('dialog[open]') && (
  e.target === resumen || e.target === document.body || e.target === document.documentElement || escena.contains(e.target));
addEventListener('pointermove', e => {
  if (!R || estado !== 'resumen' || movil || e.pointerType === 'touch') return;
  espiar(sobreFondo(e) && R.toca(e));
});
addEventListener('click', e => {
  if (!R || estado !== 'resumen' || movil || !sobreFondo(e) || !R.toca(e)) return;
  entrar();
});
abrirBtn.addEventListener('click', e => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !R) return;
  e.preventDefault();
  entrar();
});
async function entrar(destino = abrirBtn.href) {
  if (estado !== 'resumen') return;
  estado = 'saliendo';
  espiar(false);
  tw(pose, { puertas: 1 }, RM ? { duration: .2, ease: 'linear' } : { type: 'spring', stiffness: 90, damping: 13 });
  await wait(RM ? 0 : .45);
  location.assign(destino);
}
// Una alerta abre la refri con ese producto seleccionado (#producto-ID, lo lee refri.js).
for (const a of document.querySelectorAll('.alerta-it')) {
  a.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !R) return;
    e.preventDefault();
    entrar(a.href);
  });
}
addEventListener('pageshow', e => {
  if (!e.persisted) return;
  estado = 'resumen';
  tw(pose, { puertas: 0 }, { duration: .3 });
});

/* ---------- Llegada desde la portada: hoja + tinta ---------- */
const GOTAS = [[846, 520, 0], [420, 300, 120], [1250, 640, 220], [180, 780, 300], [1480, 220, 360], [860, 140, 420], [640, 860, 180]];
const insetDe = r => `inset(${r.t.toFixed(1)}px ${(vw - r.r).toFixed(1)}px ${(vh - r.b).toFixed(1)}px ${r.l.toFixed(1)}px round 3px)`;
const LLENO = 'inset(0px 0px 0px 0px round 0px)';

function tinta(retraso) {
  gotas.replaceChildren(...GOTAS.map(([x, y]) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 0);
    return c;
  }));
  cocinaImg.setAttribute('mask', 'url(#mTinta)');
  return new Promise(res => {
    const t0 = performance.now() + retraso, cs = [...gotas.children];
    const paso = now => {
      let fin = true;
      cs.forEach((c, i) => {
        const u = Math.max(0, Math.min(1, (now - t0 - GOTAS[i][2]) / 1250));
        c.setAttribute('r', (1250 * (1 - Math.pow(1 - u, 3))).toFixed(1));
        if (u < 1) fin = false;
      });
      if (fin) { cocinaImg.removeAttribute('mask'); res(); } else requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}

const piezas = () => [...document.querySelectorAll('.res-izq > *, .res-der > *'), abrirBtn];

async function llegar() {
  history.replaceState(null, '', location.pathname);   // quita ?desde=portada de la barra
  // Al quitar data-transicion vuelven la cocina completa, el velo y el resumen (CSS).
  const mostrar = () => { document.body.removeAttribute('data-transicion'); estado = 'resumen'; };
  if (RM || !R) { mostrar(); measure(); revelar(piezas(), 0, 1); return; }
  // Empieza donde la dejó la portada: refri grande al centro con las puertas entreabiertas.
  Object.assign(pose, { th: HERO.th, ph: HERO.ph, hPx: HERO.hPx, ax: HERO.ax, ay: HERO.ay, calidez: 0, puertas: .5 });
  const desde = insetDe(R.caja(HERO));
  const hoja = capa.animate([{ clipPath: desde }, { clipPath: LLENO }], { duration: 1050, easing: 'cubic-bezier(.76,0,.18,1)', fill: 'forwards' });
  tw(pose, { th: NICHO.th, ph: NICHO.ph, hPx: NICHO.hPx, ax: NICHO.ax, ay: NICHO.ay }, { duration: 1.05, ease: HOJA });
  tw(pose, { calidez: 1 }, { duration: 1.05, ease: EASE });
  tw(pose, { puertas: 0 }, { duration: .5, ease: EASE });
  const manchas = tinta(520);
  await hoja.finished.catch(() => {});
  revelar(piezas(), 60);          // con fill "both" quedan ocultas hasta su turno
  velo.animate([{ opacity: 0 }, { opacity: .12 }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
  mostrar();
  hoja.cancel();
  await manchas;
}

/* ---------- Arranque ---------- */
(document.fonts?.ready ?? Promise.resolve()).catch(() => {}).then(() => {
  measure();
  addEventListener('resize', measure);
  if (R) { renderHasta = performance.now() + 3000; requestAnimationFrame(frame); }
  if (llegando) llegar();
  else revelar(piezas(), 60);
});
