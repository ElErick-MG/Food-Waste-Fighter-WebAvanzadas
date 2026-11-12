import express from 'express';
import session from 'express-session';
import { PrismaSessionStore } from './config/session-store.js';
import { authentication, csrfProtection, requireUser } from './middleware/security.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { categoriesRoutes } from './modules/categories/categories.routes.js';
import { recipesRoutes } from './modules/recipes/recipes.routes.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { systemRoutes } from './modules/system/system.routes.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp({ config, checkDatabase, database, sendResetMail }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views/', import.meta.url)));
  const https = new URL(config.APP_ORIGIN).protocol === 'https:';
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: https ? [] : null,
    } },
    strictTransportSecurity: https ? undefined : false,
  }));
  app.use('/assets/fonts', express.static(fileURLToPath(new URL('../node_modules/@fontsource/inter/files/', import.meta.url)), { index: false }));
  app.use('/assets', express.static(fileURLToPath(new URL('./public/', import.meta.url))));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.use(systemRoutes({ checkDatabase }));
  if (database) {
    const sessionMiddleware = session({
      name: 'fwf.sid', secret: config.SESSION_SECRET,
      store: new PrismaSessionStore(database), resave: false, saveUninitialized: false, rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', secure: https, maxAge: 8 * 60 * 60 * 1000 },
    });
    app.locals.sessionMiddleware = sessionMiddleware;
    app.use(sessionMiddleware);
    app.use(csrfProtection(config));
    app.use(authentication(database));
    app.use((req, res, next) => { res.locals.currentPath = req.path; next(); });
    app.use('/auth', authRoutes({ database, config, sendResetMail }));
    app.use('/dashboard', dashboardRoutes({ database, config }));
    app.get('/account', requireUser, (_req, res) => res.render('account'));
    app.use('/inventory', inventoryRoutes({ database, config }));
    app.use('/expiration', inventoryRoutes({ database, config, expirationPage: true }));
    app.use('/categories', categoriesRoutes({ database, config }));
    app.use('/recipes', recipesRoutes({ database, config }));
    app.use('/team', usersRoutes({ database, config }));
    app.use('/chat', chatRoutes({ database, config }));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
