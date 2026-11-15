/*
 * Food Waste Fighter — animación compartida.
 * Usa Motion (global `Motion`, servido en /assets/vendor/motion) cuando está
 * disponible y, si no, un tween propio equivalente. Respeta prefers-reduced-motion.
 */

export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const EASE = [.2, .8, .2, 1];
export const HOJA = [.76, 0, .18, 1];
export const CURVA = 'cubic-bezier(.2,.8,.2,1)';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wait = s => new Promise(r => setTimeout(r, s * 1000));
const MO = typeof Motion !== 'undefined' && typeof Motion.animate === 'function' ? Motion : null;

function bezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t;
  return x => {
    let t = x;
    for (let i = 0; i < 8; i++) { const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t = clamp(t - (sx(t) - x) / d, 0, 1); }
    return sy(t);
  };
}
const easeFn = e => e === 'linear' ? (u => u) : Array.isArray(e) ? bezier(...e) : bezier(...EASE);

function opts(o = {}) {
  if (RM) return o.type === 'spring' ? { duration: .2, ease: 'linear', delay: o.delay || 0 } : { ...o, duration: Math.min(o.duration ?? .3, .3) };
  if (o.type === 'spring') return o;
  return { duration: .3, ease: EASE, ...o };
}

function ftween(from, to, o, onUpdate) {
  let parado = false, res;
  const p = new Promise(r => { res = r; });
  const t0 = performance.now() + (o.delay || 0) * 1000;
  if (o.type === 'spring') {
    let x = from, v = 0, last = null;
    const k = o.stiffness || 100, c = o.damping || 10;
    const paso = now => {
      if (parado) return;
      if (now < t0) { requestAnimationFrame(paso); return; }
      const dt = Math.min(.032, (now - (last ?? now)) / 1000) || .016; last = now;
      for (let i = 0; i < 4; i++) { const a = -k * (x - to) - c * v; v += a * dt / 4; x += v * dt / 4; }
      if (Math.abs(x - to) < 1e-4 * (1 + Math.abs(to)) && Math.abs(v) < 1e-3) { onUpdate(to); res(); return; }
      onUpdate(x); requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  } else {
    const d = (o.duration ?? .3) * 1000, ez = easeFn(o.ease);
    const paso = now => {
      if (parado) return;
      if (now < t0) { requestAnimationFrame(paso); return; }
      const u = d > 0 ? clamp((now - t0) / d, 0, 1) : 1;
      onUpdate(from + (to - from) * ez(u));
      if (u < 1) requestAnimationFrame(paso); else res();
    };
    requestAnimationFrame(paso);
  }
  return { stop() { parado = true; }, then: (a, b) => p.then(a, b) };
}

/** Anima un número; devuelve controles con stop() y then(). */
export function num(from, to, o, onUpdate) {
  const op = opts(o);
  if (MO) return MO.animate(from, to, { ...op, onUpdate });
  return ftween(from, to, op, onUpdate);
}

/** Anima propiedades numéricas de un objeto JS (una animación viva por clave). */
const vivos = new WeakMap();
export function tw(obj, props, o = {}) {
  let m = vivos.get(obj);
  if (!m) vivos.set(obj, m = {});
  const ps = [];
  for (const k in props) {
    m[k]?.stop?.();
    let to = props[k];
    if (Array.isArray(to)) { obj[k] = to[0]; to = to[1]; }
    const c = num(obj[k], to, o, v => { obj[k] = v; });
    m[k] = c;
    ps.push(new Promise(r => c.then(r)));
  }
  return Promise.all(ps);
}
export function parar(obj, k) {
  const m = vivos.get(obj);
  m?.[k]?.stop?.();
  if (m) delete m[k];
}

/** Revela elementos de abajo arriba con una máscara (sin fundidos). */
export function revelar(els, base = 0, ms = 900) {
  els.forEach((el, i) => {
    el.getAnimations().forEach(a => a.cancel());
    const a = el.animate(
      [{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(28px)' }, { clipPath: 'inset(0 0 0% 0)', transform: 'none' }],
      { duration: RM ? 1 : ms, delay: RM ? 0 : base + i * 75, easing: CURVA, fill: 'both' },
    );
    a.onfinish = () => a.cancel();
  });
}

/** Oculta elementos de arriba abajo con la curva de "hoja". */
export function ocultar(els, ms = 300) {
  return Promise.all(els.map(el => {
    el.getAnimations().forEach(a => a.cancel());
    return el.animate(
      [{ clipPath: 'inset(0 0 0% 0)', transform: 'none' }, { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-12px)' }],
      { duration: RM ? 1 : ms, easing: 'cubic-bezier(.76,0,.18,1)', fill: 'forwards' },
    ).finished.catch(() => {});
  }));
}
