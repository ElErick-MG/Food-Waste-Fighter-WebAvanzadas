# Estado del proyecto

## Situación actual

| Área | Estado |
| --- | --- |
| Alcance | Primer bimestre: monolito Node.js/Express/EJS, MySQL y Socket.IO. |
| Funcionalidad | Autenticación, recuperación, roles/equipo, inventario, dashboard, recetas, caducidad, chat y avisos por empresa implementados. |
| Calidad | 106 pruebas registradas, 40 escaneos de navegador y medición reproducible de consultas; alcance y resultados en [VALIDATION.md](../5.Calidad-Y-Validacion/VALIDATION.md). |
| Documentación | Consolidada y cotejada con la guía oficial; enlaces, once modelos del ER y rúbrica de 11 criterios verificados. |
| Rúbrica | Pesos y máximos oficiales completos: 100 % y 20 puntos. Evidencias y pendientes en [COMPLIANCE_MATRIX.md](../6.Evaluacion-Y-Entrega/COMPLIANCE_MATRIX.md). |
| Entrega | Preparación técnica/documental disponible; cierre académico pendiente. |

## Pendientes de cierre

- Completar integrantes, roles, aportes y commits reales, fecha, presentación y datos del curso.
- Adjuntar evidencias detalladas de HTTPS/wss y dos usuarios en Codespaces.
- Completar la revisión de accesibilidad con lector de pantalla y personas usuarias.
- Ejecutar las verificaciones sobre la revisión final y realizar la defensa de todos los integrantes.
- Publicar la etiqueta v1.0-b1 y entregar repositorio/presentación con comprobante.

El alcance del segundo bimestre permanece como referencia futura, sin implementación.

## Rediseño del front-end (rama `feature/nuevo-front`)

Se sustituye la plantilla visual por el diseño nuevo (portada con refrigeradora 3D,
resumen y refri como vista principal del inventario) sin modificar la lógica de
negocio. Se integra por etapas verificables; cada etapa conserva la CSP de mismo
origen, los formularios POST con CSRF y las pruebas existentes.

| Etapa | Alcance | Estado |
| --- | --- | --- |
| 0 · Preparación | Librerías, fuente, texturas e imágenes servidas desde el mismo origen; hoja de estilos del sistema de diseño. Sin cambios visibles. | DONE |
| 1 · Portada y acceso | `home.ejs` y vistas `/auth/*` con el diseño nuevo y formularios reales. | DONE |
| 2 · Datos | Migración aditiva: `FoodItem.imageUrl` (HTTPS opcional) y `Category.color`; validación, servicio, seed y pruebas. | DONE |
| 3 · Resumen | `/dashboard` con la refri cerrada y datos reales. | DONE |
| 4 · Refri | `/inventory` como refri abierta: estantes, detalle y formularios reales. | PENDIENTE |
| 5 · Gestión | Categorías con color, equipo y cuenta. | PENDIENTE |
| 6 · Chat | Burbuja conectada a Socket.IO con los contratos existentes. | PENDIENTE |
| 7 · Cierre | Recetas, caducidad y errores; accesibilidad, rendimiento y documentación. | PENDIENTE |

Decisiones: la imagen de producto es una URL HTTPS opcional, por lo que la etapa 2
ampliará únicamente `img-src` con `https:`; scripts, estilos y fuentes siguen en
`'self'`. Se elimina el campo "consejo" del diseño. Se conservan las unidades del
backend (kg, g, l, ml, unidad).

### Etapa 0 — registro

- Dependencias nuevas: `three@0.128.0` (modelo 3D), `motion@11` (animaciones) y
  `@fontsource/plus-jakarta-sans` (tipografía), servidas en `/assets/vendor/three`,
  `/assets/vendor/motion` y `/assets/fonts/plus-jakarta-sans` desde `src/app.js`.
- Las ocho texturas de la refrigeradora, antes en base64, se extrajeron a
  `src/public/fwf/refri/*.jpg`; la cocina y las fotos de producto están en
  `src/public/fwf/img/`.
- `src/public/fwf/css/fwf-base.css` define los tokens y componentes compartidos,
  limitados a la clase `.fwf` para no afectar a las vistas actuales.
- `tests/frontend-assets.test.js` verifica tipos de contenido, ausencia de
  listados de directorio, la ruta previa de Inter y la CSP sin cambios.
- Verificación: `npm test` 63/63 (50 previas + 13 nuevas). Las pruebas de
  integración con MySQL no se ejecutaron en esta etapa porque no hay cambios de
  datos; se ejecutarán en la etapa 2.

### Etapa 1 — registro

- Portada (`home.ejs`): refrigeradora 3D con titular, marca, grano y cursor propio.
  "Iniciar sesión" y "Comenzar gratis" son enlaces a `/auth/login` y
  `/auth/register`, porque la portada se monta antes de la sesión y no tiene token
  CSRF. "Toca la refri" (o el clic sobre la refri) entreabre las puertas y navega a
  `/dashboard`; sin sesión, `requireUser` redirige al inicio de sesión. La
  transición hoja/tinta hacia el resumen se incorporará en la etapa 3.
- Acceso (`/auth/login`, `/auth/register`, `/auth/forgot`, `/auth/reset`): tarjeta de
  vidrio sobre la portada quieta (`aria-hidden` e `inert`). Se mantienen los
  formularios POST, `_csrf`, nombres de campos, `#email`, `name="password"`, el
  botón "Iniciar Sesión", `data-password-form` y `#errorContrasena` (lógica de
  `/assets/auth.js` sin cambios). El botón para mostrar la contraseña es mejora
  progresiva (`acceso.js`).
- Archivos nuevos: `src/public/fwf/js/refri3d.js` (modelo 3D reutilizable, generado
  del modelo original con las texturas como archivos), `fwf-motion.js` (Motion con
  respaldo propio), `portada.js`, `acceso.js`, `css/portada.css`, `img/grano.svg` y
  los parciales `fwf-head`, `fwf-hero`, `fwf-acceso-inicio`, `fwf-acceso-fin` y
  `fwf-clave`. Sin `<style>`, `style=""`, scripts en línea ni URI `data:`; la
  entrada de la portada es CSS puro y respeta `prefers-reduced-motion`.
- Contenido retirado de la portada anterior (por el diseño a pantalla completa): la
  sección de características, la franja de propósito y el pie con enlaces a redes y
  a `/ready`. `/ready` y `/health` siguen disponibles.
- Prueba ajustada conscientemente: `tests/system.test.js` esperaba
  `/assets/styles.css` en la portada; ahora espera `/assets/fwf/css/fwf-base.css`.
  El resto de vistas sigue usando `styles.css`.
- `tests/frontend-pages.test.js` (13 pruebas): portada y vistas de acceso sin código
  en línea, ganchos de las pruebas de navegador, CSRF, alertas y escape de datos.
- Verificación: `npm test` 76/76. En el navegador (servidor de desarrollo local):
  sin errores de consola ni bloqueos de CSP, refri 3D visible a 1280 y 320 px sin
  desbordamiento horizontal, inicio de sesión fallido devuelve 401 con alerta y
  conserva el correo, la confirmación de contraseña sigue validando. No se ejecutó
  `npm run verify:browser` (axe) ni las pruebas de integración con MySQL: requieren
  la base de pruebas, que no estaba levantada; quedan pendientes para la etapa 2.

### Etapa 2 — registro

- Migración `20261115000300_product_image_category_color`: solo añade dos columnas
  NULL (`Category.color` VARCHAR(7) y `FoodItem.imageUrl` VARCHAR(500)). No
  reescribe ni borra datos; las filas existentes quedan con NULL.
- Validación (Zod): `imageUrl` opcional, solo `https://` absoluta, sin usuario ni
  contraseña en la URL y hasta 500 caracteres; vacía la quita y omitida la
  conserva. `color` opcional en formato `#RRGGBB` (se guarda en mayúsculas);
  omitido o vacío conserva el actual.
- Servicio: una categoría nueva sin color recibe uno de la paleta
  (`src/modules/categories/category-colors.js`, seis colores en ciclo). El color es
  decorativo: el nombre sigue identificando la categoría.
- Vistas actuales (temporales hasta las etapas 4 y 5): campo de imagen en el
  formulario de producto, imagen en el detalle y selector de color al crear y
  editar categorías. El seed asigna color a la categoría de ejemplo solo al crearla.
- CSP: `img-src 'self' https:`. Es la única directiva ampliada; scripts, estilos y
  fuentes siguen en `'self'`. Helmet mantiene `Referrer-Policy: no-referrer`, así
  que las imágenes externas no reciben la URL de la página.
- Documentación: ER y notas de datos en `TECHNICAL_REFERENCE.md` y
  `contextoProyecto.md`.
- Pruebas: `tests/frontend-data.test.js` (19: validación, paleta y CSP) y tres
  pruebas nuevas en `tests/business.integration.test.js` (guardar, conservar y
  quitar la imagen; rechazar URLs no HTTPS sin escribir; color por defecto, elegido
  y conservado).
- Verificación: `npm test` 95/95. Integración con MySQL de pruebas (puerto 3307):
  `npm run test:db` no arranca en Windows porque `scripts/test-db.js` llama a
  `spawnSync('npx')` sin shell (ENOENT). Se ejecutaron los mismos dos pasos con
  `shell: true` desde un script temporal: migraciones aplicadas y 57/59 pruebas en
  verde, incluidas todas las de negocio. Fallaron dos, ajenas a esta etapa: el
  cierre por SIGTERM (Windows no entrega SIGTERM a procesos de Node) y el conteo
  global de empresas en `auth.integration.test.js`, que choca con otros archivos que
  crean empresas en paralelo (ese archivo solo pasa 21/21). Deben confirmarse en
  Linux/Codespaces.
- La base de desarrollo necesita `npm run db:migrate` antes de usar el servidor con
  este cambio.

### Etapa 3 — registro

- `/dashboard` es el Resumen del diseño: foto de la cocina a pantalla completa, la
  refri 3D cerrada en su nicho y dos columnas de vidrio. Izquierda: chip de cuenta,
  saludo, empresa y los cuatro indicadores (mismos enlaces y `data-metric`).
  Derecha: alertas de caducidad (miniatura con la imagen del producto o su inicial
  sobre el color de la categoría, estado, fecha y stock bajo) y recetas sugeridas.
  "Abrir mi refri" (y el clic sobre la refri) lleva a `/inventory`.
- Datos: las mismas consultas de antes. Solo se añadió `include` del nombre y color
  de la categoría en las tres alertas, y `transicion` (`?desde=portada`), que no lee
  datos: solo activa la animación de llegada.
- Menú de cuenta (`partials/fwf-cuenta.ejs`, `details/summary`, funciona sin JS):
  correo, rol, enlaces a todas las secciones (Equipo solo para ADMIN) y cierre de
  sesión como POST con `_csrf`. Escape y el clic fuera lo cierran.
- Llegada desde la portada: la hoja crece desde la silueta de la refri, la cocina se
  descubre con manchas de tinta y la refri aterriza en el nicho; luego se quita
  `?desde=portada` de la barra. Con `prefers-reduced-motion` o sin WebGL se muestra
  directamente.
- Tiempo real: el Resumen carga Socket.IO y `realtime.js`; el aviso
  `#inventory-live` se muestra como píldora flotante.
- Archivos: `css/resumen.css`, `js/resumen.js`, `partials/fwf-cuenta.ejs`;
  `fwf-head.ejs` acepta hojas y módulos por página e incluye Socket.IO con sesión.
- Pruebas: cuatro nuevas en `tests/frontend-pages.test.js` (datos, enlaces, menú,
  POST de cierre, estados vacíos, transición y escape). El control de URL externas
  ahora se limita a scripts y hojas de estilo, porque las imágenes de producto
  pueden ser HTTPS remotas desde la etapa 2.
- Verificación: `npm test` 99/99. Integración con MySQL de pruebas: 57/59, con los
  mismos dos fallos propios de Windows de la etapa 2; todas las pruebas del
  dashboard pasan. `npm run verify:browser` con Microsoft Edge instalado
  (`BROWSER_EXECUTABLE_PATH`, sin descargar navegadores de Playwright): PASS,
  40 escaneos axe sin incidencias, sin errores de JS ni orígenes externos.
  Revisión visual con datos ficticios en la base de pruebas: escritorio, 320 px,
  menú de cuenta y transición desde la portada.
