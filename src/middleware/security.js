import { randomBytes, timingSafeEqual } from 'node:crypto';

export function csrfProtection(config) {
  const origin = new URL(config.APP_ORIGIN).origin;
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const hadSessionToken = typeof req.session.csrfToken === 'string';
    if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const provided = req.body?._csrf;
    const expected = req.session.csrfToken;
    const requestOrigin = req.get('Origin');
    const fetchSite = req.get('Sec-Fetch-Site');
    // With Helmet's no-referrer policy Chromium uses Origin: null on native form
    // navigations. Fetch Metadata is optional and may be removed by a proxy.
    // A trusted HTTPS proxy can also rewrite Origin. Sec-Fetch-Site is browser
    // controlled (scripts cannot set Sec-* headers) and describes the public
    // browser request before forwarding. Only its exact same-origin value is
    // accepted as an alternative to the configured Origin, never same-site.
    // The session-bound synchronizer token remains mandatory in every case.
    const sameOriginViaProxy = config.trustProxy === 1 && req.secure && fetchSite === 'same-origin';
    const sameOrigin = fetchSite !== 'cross-site' && (sameOriginViaProxy || !requestOrigin || requestOrigin === origin ||
      (requestOrigin === 'null' && (!fetchSite || fetchSite === 'same-origin')));
    const validToken = typeof provided === 'string' && provided.length === expected.length &&
      Buffer.byteLength(provided) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!sameOrigin || !validToken) {
      const cookiePresent = /(?:^|;\s*)fwf\.sid=/.test(req.get('Cookie') || '');
      const errorCode = !cookiePresent ? 'FWF_SESSION_COOKIE_MISSING'
        : !hadSessionToken && !req.session.auth ? 'FWF_SESSION_UNAVAILABLE'
        : !sameOrigin ? 'FWF_FORM_ORIGIN_REJECTED'
        : typeof provided !== 'string' ? 'FWF_FORM_TOKEN_MISSING'
        : 'FWF_FORM_TOKEN_CHANGED';
      const messages = {
        FWF_SESSION_COOKIE_MISSING: 'El navegador no envió la cookie de sesión. Abre la aplicación en una pestaña independiente y comprueba que permita las cookies de este sitio.',
        FWF_SESSION_UNAVAILABLE: 'No se pudo recuperar la sesión del formulario. Vuelve a abrir la página e inténtalo de nuevo.',
        FWF_FORM_ORIGIN_REJECTED: 'La dirección de acceso del formulario no coincide con la configuración del servicio. Abre la aplicación desde su dirección habitual en una pestaña independiente.',
        FWF_FORM_TOKEN_MISSING: 'El formulario está incompleto. Vuelve a abrir la página e inténtalo de nuevo.',
        FWF_FORM_TOKEN_CHANGED: 'La sesión del formulario cambió o caducó. Vuelve a abrir la página e inténtalo de nuevo.',
      };
      // Deliberately exclude body, query string, cookie/session identifiers and
      // credential/token values. The reference is safe to share for diagnosis.
      if (config.NODE_ENV !== 'test') console.warn(JSON.stringify({
        event: 'form_rejected', code: errorCode, secureRequest: req.secure,
        trustedProxyEnabled: Boolean(config.trustProxy),
        forwardedHttps: req.get('X-Forwarded-Proto')?.split(',')[0].trim() === 'https',
        originMatches: requestOrigin === origin, opaqueOrigin: requestOrigin === 'null',
        sameOriginViaProxy,
        fetchSite: ['same-origin', 'same-site', 'cross-site', 'none'].includes(fetchSite) ? fetchSite : 'absent-or-other',
      }));
      return res.status(403).render('error', { title: 'Solicitud rechazada', message: messages[errorCode], errorCode });
    }
    next();
  };
}

export function authentication(database) {
  return async (req, res, next) => {
    res.locals.currentUser = null;
    if (req.session.auth) {
      const user = await database.user.findUnique({
        where: { id: req.session.auth.userId },
        select: { id: true, name: true, email: true, role: true, companyId: true, sessionVersion: true, company: { select: { name: true } } },
      });
      if (user && user.sessionVersion === req.session.auth.version) {
        req.user = user;
        res.locals.currentUser = user;
      } else {
        delete req.session.auth;
      }
    }
    next();
  };
}
export function requireUser(req, res, next) {
  if (!req.user) return res.redirect(303, '/auth/login');
  next();
}
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).render('error', { title: 'Acceso restringido', message: 'Se requiere autorización de administración.' });
  next();
}
