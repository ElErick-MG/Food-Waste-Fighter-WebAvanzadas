export function notFound(_req, res) {
  res.status(404).render('error', { title: 'Página no encontrada', message: 'La página solicitada no existe.' });
}

// Express identifies error middleware by its four arguments.
export function errorHandler(_error, _req, res, _next) {
  res.status(500).render('error', { title: 'Error del servidor', message: 'No se pudo completar la solicitud. Inténtalo de nuevo.' });
}
