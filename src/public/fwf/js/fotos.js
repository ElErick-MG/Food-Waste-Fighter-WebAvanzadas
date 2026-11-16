/*
 * Food Waste Fighter — fotos locales de respaldo por nombre de producto.
 * Si un producto no tiene imagen propia (imageUrl), se usa una de las fotos incluidas en
 * /assets/fwf/img/productos cuando el nombre lo indica (leche, yogur, tomate…). Si tampoco
 * hay, cada vista muestra la inicial sobre el color de la categoría.
 */
const FOTOS = { leche: 'leche', yogur: 'yogur', lechuga: 'lechuga', espinaca: 'lechuga', tomate: 'tomate', carne: 'carne', res: 'carne', pescado: 'pescado', salmon: 'pescado', pollo: 'pollo', pechuga: 'pollo' };
const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Ruta de la foto local que corresponde al nombre, o '' si no hay ninguna. */
export function fotoLocal(nombre) {
  const n = normalizar(nombre);
  const clave = Object.keys(FOTOS).find(k => new RegExp(`(^|[^a-z])${k}`).test(n));
  return clave ? `/assets/fwf/img/productos/${FOTOS[clave]}.jpg` : '';
}

/**
 * Completa los contenedores [data-nombre] que no traen <img>: añade la foto local
 * (si existe) y la retira si no carga, dejando visible la inicial.
 */
export function completarFotos(raiz, selector) {
  for (const caja of raiz.querySelectorAll(selector)) {
    const actual = caja.querySelector('img');
    if (actual) { actual.addEventListener('error', () => actual.remove(), { once: true }); continue; }
    const src = fotoLocal(caja.dataset.nombre);
    if (!src) continue;
    const img = document.createElement('img');
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = src;
    img.addEventListener('error', () => img.remove(), { once: true });
    caja.prepend(img);
  }
}
