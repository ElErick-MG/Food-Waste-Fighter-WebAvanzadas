/*
 * Food Waste Fighter — portada con la refrigeradora 3D.
 * Modos (data-modo en #escena):
 *   inicio  portada: refri viva (vaivén, paralaje, puertas que se asoman al pasar el puntero,
 *           cursor propio) y clic en la refri para entrar.
 *   fondo   detrás de las tarjetas de acceso: la misma composición, quieta y sin interacción.
 * Sin WebGL o sin JavaScript la página sigue siendo usable: los textos y enlaces son HTML.
 */
import { crearRefri } from './refri3d.js';
import { tw, parar, RM, clamp, ocultar, wait } from './fwf-motion.js';

const escena = document.getElementById('escena');
if (escena) iniciar(escena);

function iniciar(escena) {
  const inicio = escena.dataset.modo === 'inicio';
  const cv = document.getElementById('refri3d');
  const pista = document.getElementById('pista');
  const cursor = document.getElementById('cursor');
  const titular = escena.querySelector('.titular');

  let forzarN = 0, renderHasta = 0, firma = '';
  const forzar = (n = 2) => { forzarN = Math.max(forzarN, n); };
  let R = null;
  try { R = crearRefri(cv, { alCargar: () => forzar(3) }); }
  catch (e) { console.warn('Refri 3D no disponible:', e.message); }
  document.documentElement.classList.toggle('sin-3d', !R);

  const pose = { th: .42, ph: 1.40, hPx: 500, ax: 600, ay: 400, puertas: 0, calidez: 0 };
  const idle = { k: RM || !inicio ? 0 : 1 };
  let HERO = null, vw = 1, vh = 1, movil = false, estado = 'hero';
  let mx = 0, my = 0, mxT = 0, myT = 0;

  function measure() {
    const E = escena.getBoundingClientRect();
    vw = E.width; vh = E.height;
    movil = matchMedia('(max-width:760px)').matches;
    HERO = { th: .42, ph: 1.40, hPx: (movil ? .42 : .68) * vh, ax: .5 * vw, ay: .52 * vh };
    if (!R) return;
    R.tamano(vw, vh);
    parar(pose, 'ay');
    Object.assign(pose, { th: HERO.th, ph: HERO.ph, hPx: HERO.hPx, ax: HERO.ax, ay: HERO.ay });
    if (pista) {
      const fondo = R.caja(HERO).b;
      pista.style.left = `${HERO.ax - pista.offsetWidth / 2}px`;
      pista.style.top = `${Math.min(fondo + innerHeight * .022, vh - 48)}px`;
      pista.classList.add('colocada');
    }
    ajustarTitular();
    forzar(4);
  }

  /** El titular ocupa el lado izquierdo lo más grande posible sin meterse bajo la refri. */
  function ajustarTitular() {
    titular.style.fontSize = '';
    if (movil || !R) return;
    const fs0 = parseFloat(getComputedStyle(titular).fontSize);
    const ancho = Math.max(...[...titular.querySelectorAll('.m>span')].map(sp => {
      const r = document.createRange(); r.selectNodeContents(sp); return r.getBoundingClientRect().width;
    }));
    const limite = R.caja(HERO).l - titular.offsetLeft - vw * .025;
    if (ancho > limite && limite > 0) titular.style.fontSize = `${(fs0 * limite / ancho).toFixed(1)}px`;
  }

  /* ---------- Bucle de dibujo: solo se renderiza cuando algo cambió ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !R || !HERO) return;
    const t = now / 1000;
    mx += (mxT - mx) * .06; my += (myT - my) * .06;
    const k = idle.k;
    const th = pose.th + k * (Math.sin(.6 * t) * .05 + mx * .12);
    const ph = pose.ph + k * my * .035;
    const ay = pose.ay + k * Math.sin(1.4 * t) * 4;
    R.aplicar(pose, th, ph, ay);
    const sg = [th, ph, ay, pose.hPx, pose.ax, pose.puertas, vw, vh].map(v => v.toFixed(3)).join('|');
    if (sg !== firma || forzarN > 0 || now < renderHasta) {
      R.render(); firma = sg;
      if (forzarN > 0) forzarN--;
    }
  }

  /* ---------- Interacción (solo en la portada) ---------- */
  let espiando = false;
  function espiar(on) {
    if (on === espiando) return;
    espiando = on;
    cursor?.classList.toggle('open', on);
    escena.classList.toggle('sobre-refri', on);
    tw(pose, { puertas: on ? .06 : 0 }, { type: 'spring', stiffness: 200, damping: 18 });
  }

  /** Entrar: las puertas se entreabren y se navega al resumen (el servidor pide sesión si hace falta). */
  async function abrir() {
    if (estado !== 'hero') return;
    estado = 'saliendo';
    espiar(false);
    tw(idle, { k: 0 }, { duration: .3 });
    tw(pose, { puertas: .5 }, { type: 'spring', stiffness: 120, damping: 14 });
    if (pista) ocultar([pista], 220);
    await wait(RM ? 0 : .45);
    location.assign(pista?.href || '/dashboard');
  }

  if (inicio) {
    addEventListener('pointermove', e => {
      const r = escena.getBoundingClientRect();
      mxT = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
      myT = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
    });
    escena.addEventListener('pointermove', e => {
      if (!R || estado !== 'hero' || e.pointerType === 'touch') return;
      espiar(!e.target.closest('a,button') && R.toca(e));
    });
    escena.addEventListener('pointerleave', () => espiar(false));
    escena.addEventListener('click', e => {
      if (R && !e.target.closest('a,button') && R.toca(e)) abrir();
    });
    pista?.addEventListener('click', e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      abrir();
    });
    // Al volver con el botón Atrás (bfcache), la portada vuelve a su estado inicial.
    addEventListener('pageshow', e => {
      if (!e.persisted) return;
      estado = 'hero';
      pista?.getAnimations().forEach(a => a.cancel());
      tw(pose, { puertas: 0 }, { duration: .3 });
      if (!RM) tw(idle, { k: 1 }, { duration: .6 });
    });
    cursorPropio();
  }

  /* ---------- Cursor propio (puntero fino): sigue con suavizado 1 − e^(−16·dt) ---------- */
  function cursorPropio() {
    if (!cursor || !matchMedia('(pointer:fine)').matches) return;
    document.documentElement.classList.add('cursor-on');
    let cx = -100, cy = -100, tx = -100, ty = -100, ult = performance.now();
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      cursor.classList.toggle('btn', !!e.target.closest?.('a,button'));
    });
    const mover = now => {
      const dt = Math.min(.05, (now - ult) / 1000); ult = now;
      const k = RM ? 1 : 1 - Math.exp(-16 * dt);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      cursor.style.transform = `translate(${cx}px,${cy}px)`;
      requestAnimationFrame(mover);
    };
    requestAnimationFrame(mover);
  }

  /* ---------- Arranque ---------- */
  (document.fonts?.ready ?? Promise.resolve()).catch(() => {}).then(() => {
    measure();
    addEventListener('resize', measure);
    if (!R) return;
    renderHasta = performance.now() + 3000;
    if (inicio && !RM) {
      pose.ay = HERO.ay - 40;
      tw(pose, { ay: HERO.ay }, { type: 'spring', stiffness: 120, damping: 14 });
    }
    requestAnimationFrame(frame);
  });
}
