/*
 * Food Waste Fighter — tarjetas de acceso.
 * Mejora progresiva: el botón para mostrar la contraseña solo aparece con JavaScript.
 * La confirmación de contraseña la sigue haciendo /assets/auth.js (comportamiento original).
 */
for (const boton of document.querySelectorAll('.clave .ver')) {
  const campo = document.getElementById(boton.getAttribute('aria-controls'));
  if (!campo) continue;
  boton.hidden = false;
  boton.addEventListener('click', () => {
    const ver = campo.type === 'password';
    campo.type = ver ? 'text' : 'password';
    boton.setAttribute('aria-pressed', String(ver));
    boton.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
    campo.focus({ preventScroll: true });
  });
}

// Antes de enviar, la contraseña vuelve a ocultarse (evita que el navegador la guarde como texto).
for (const form of document.querySelectorAll('form')) {
  if (!form.querySelector('.ver')) continue;
  form.addEventListener('submit', () => {
    for (const boton of form.querySelectorAll('.ver[aria-pressed="true"]')) boton.click();
  });
}
