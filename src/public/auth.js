// Original mobile menu and password confirmation behavior, compatible with CSP.
const menuButton = document.getElementById('mobile-menu-btn');
menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(expanded));
  document.getElementById('mobile-menu')?.classList.toggle('hidden', !expanded);
  document.getElementById('menu-icon-open')?.classList.toggle('hidden', expanded);
  document.getElementById('menu-icon-close')?.classList.toggle('hidden', !expanded);
});
for (const form of document.querySelectorAll('[data-password-form]')) {
  const password = form.querySelector('[name="password"]');
  const confirmation = form.querySelector('[name="confirmPassword"]');
  if (!password || !confirmation) continue;
  const validate = () => {
    const mismatch = confirmation.value && password.value !== confirmation.value;
    confirmation.setCustomValidity(mismatch ? 'Las contraseñas no coinciden.' : '');
    form.querySelector('#errorContrasena')?.classList.toggle('hidden', !mismatch);
  };
  password.addEventListener('input', validate);
  confirmation.addEventListener('input', validate);
}
