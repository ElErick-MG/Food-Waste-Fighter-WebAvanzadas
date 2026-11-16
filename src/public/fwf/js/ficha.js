import { completarFotos } from './fotos.js';

/*
 * Food Waste Fighter — tarjetas de producto. Mejora progresiva: aplica el color de la
 * categoría (la CSP no permite style="" en el HTML) y, si la imagen remota falla,
 * deja la inicial del producto.
 */
for (const el of document.querySelectorAll('[data-color]')) {
  if (/^#[0-9A-F]{6}$/i.test(el.dataset.color)) el.style.setProperty('--c', el.dataset.color);
}
for (const img of document.querySelectorAll('.ficha-img img')) if (img.complete && !img.naturalWidth) img.remove();
// Sin imagen propia: la foto local que corresponde al nombre (como en la refri).
completarFotos(document, '.ficha-img[data-nombre]');
// "Cancelar" del editor de categorías: cierra el details (sin JavaScript se usa el lápiz).
for (const b of document.querySelectorAll('[data-cerrar-detalles]')) {
  b.hidden = false;
  b.addEventListener('click', () => { const d = b.closest('details'); d.open = false; d.querySelector('summary').focus(); });
}
