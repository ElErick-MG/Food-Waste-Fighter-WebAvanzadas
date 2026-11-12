for (const form of document.querySelectorAll('[data-inventory-form]')) {
  const received = form.elements.receivedDate;
  const expires = form.elements.expiresDate;
  const validate = () => {
    expires.setCustomValidity(received.value && expires.value && expires.value < received.value
      ? 'La caducidad no puede ser anterior al ingreso.' : '');
  };
  received.addEventListener('input', validate);
  expires.addEventListener('input', validate);
  validate();
}
