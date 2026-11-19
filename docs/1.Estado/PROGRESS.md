# Estado del proyecto

## Situación actual

| Área | Estado |
| --- | --- |
| Alcance | Primer bimestre: monolito Node.js/Express/EJS, MySQL y Socket.IO. |
| Funcionalidad | Autenticación, recuperación, roles/equipo, inventario, dashboard, recetas, caducidad, chat y avisos por empresa implementados. |
| Calidad | Tras el rediseño: 115 pruebas independientes, integración MySQL 58/59 en Windows (pendiente Codespaces) y 40 escaneos de navegador sin incidencias; medición reproducible de consultas; alcance y resultados en [VALIDATION.md](../5.Calidad-Y-Validacion/VALIDATION.md). |
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
| 4 · Refri | `/inventory` como refri abierta: estantes, detalle y formularios reales. | DONE |
| 5 · Gestión | Categorías con color, equipo y cuenta. | DONE |
| 6 · Chat | Burbuja conectada a Socket.IO con los contratos existentes. | DONE |
| 7 · Cierre | Recetas, caducidad y errores; accesibilidad, rendimiento y documentación. | DONE |

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

### Etapa 4 — registro

- `/inventory` es la refri abierta en el nicho de la cocina: un estante de vidrio por
  categoría (hasta seis a la vez) con las tarjetas de sus productos en coverflow
  (arrastre, rueda y flechas del teclado). Panel lateral: chip de cuenta, empresa,
  contadores, "Agregar producto", "Agregar categoría" (solo ADMIN), "Ver como lista"
  y filtros por estado y categoría. Panel de detalle: foto (o inicial sobre el color
  de la categoría), estado, vida útil, cantidades y enlaces Editar, Ver ficha y
  Eliminar (solo ADMIN). "Cerrar refri" vuelve al Resumen. En móvil, barra superior
  desplazable y detalle como hoja inferior.
- Datos: `inventory.repository.shelf` es una consulta nueva de solo lectura (todos los
  productos de la empresa, hasta 1000, por caducidad).
  `inventory.shelf.js` calcula estado y días con la fecha del negocio y los
  entrega en `<script type="application/json">` con `<`, `>` y `&` escapados (no se
  ejecuta; la CSP no cambia). El filtro `?status=` y `?categoryId=` de los enlaces del
  Resumen se aplica al abrir la refri.
- La lista del servidor se conserva dentro de la página ("Vista de lista"): búsqueda,
  filtros, tabla paginada con `data-item`, Editar y Eliminar. Se abre sola tras una
  búsqueda o un cambio de página, y es la vista sin JavaScript
  (`refri-sin-js.css` en `<noscript>`). Sin WebGL, los estantes se dibujan planos.
- Agregar, editar y eliminar siguen siendo las páginas y POST del servidor (CSRF,
  validación y mensajes sin cambios). El formulario, la ficha y la confirmación de
  eliminar son ahora tarjetas de vidrio sobre la cocina (`fwf-ficha-*`, `ficha.css`,
  `ficha.js`), con los mismos campos, ids y textos.
- `/expiration` usa todavía la vista anterior (`inventory/list.ejs`); se rediseña en
  la etapa 7.
- Estilos comunes del Resumen y la refri en `fwf-app.css`. `fwf-head` carga Three.js y
  Motion solo en páginas 3D y acepta scripts clásicos existentes (`inventory.js`).
- Pruebas: `tests/frontend-shelf.test.js` (2: datos y escape del JSON) y cuatro nuevas
  en `tests/frontend-pages.test.js` (refri, lista, permisos, formulario, ficha y
  eliminar). El control de CSP admite el bloque `application/json`.
- Verificación: `npm test` 105/105. Integración con MySQL de pruebas: 58/59; solo
  falla el cierre por SIGTERM, propio de Windows. `verify:browser` con Edge: PASS,
  40 escaneos axe sin incidencias, incluido el alta real de un producto y el aviso en
  vivo al otro usuario. Revisión visual con datos ficticios: refri en escritorio y en
  375 px, detalle, filtro, vista de lista y formulario.

### Etapa 5 — registro

- `/categories`: gestor del diseño en una tarjeta de vidrio sobre la cocina. Lista con
  punto de color, nombre y número de productos. Para ADMIN, cada categoría tiene
  "Editar" (`details/summary`: nombre y muestras de color) y "Eliminar", y hay un
  formulario de "Nueva categoría" con el color sugerido de la paleta. Los mismos POST
  con CSRF, validación, mensajes y respuestas 403/404/409. EMPLOYEE solo ve la lista.
- Paleta con nombres accesibles (`CATEGORY_PALETTE`: Azul, Verde, Rojo, Ámbar,
  Violeta, Turquesa) y clases CSS fijas, así que las muestras se ven sin JavaScript.
  Un color propio fuera de la paleta se conserva como opción "Color actual".
- `/categories/:id/delete`, `/team` y `/account`: tarjetas de vidrio con los mismos
  formularios y campos. Equipo muestra a las personas con su rol y el formulario de
  "Añadir empleado" (con botón para mostrar la contraseña y la validación de
  `auth.js`). Cuenta añade "Cerrar sesión" (POST con CSRF).
- Cambios de servidor: solo se pasa `palette` a la vista de categorías.
- Corrección: los enlaces de "Eliminar" salían en verde (`.enlace` ganaba a
  `.peligro`); ahora son rojos en todas las vistas.
- Pruebas: cuatro nuevas en `tests/frontend-pages.test.js` (categorías para ADMIN y
  EMPLOYEE, valores conservados tras un error, equipo, cuenta y eliminar categoría).
- Verificación: `npm test` 109/109. Integración con MySQL de pruebas: 57/59, con los
  dos fallos ya conocidos en Windows (SIGTERM y el conteo global de empresas en
  paralelo). `verify:browser` con Edge: PASS, 40 escaneos axe sin incidencias.
  Revisión visual con datos ficticios: categorías, cambio de color real con su
  aviso, equipo y cuenta.

### Etapa 6 — registro

- Burbuja de chat en el Resumen y en la refri: botón flotante con contador de no
  leídos y globo de vista previa; la ventana de vidrio se abre con la animación del
  diseño (pantalla completa en móvil), Escape la cierra. `/chat` es la misma ventana
  a pantalla completa con la sala y el historial del servidor, el menú de cuenta y un
  enlace de salto al contenido.
- Mismo cliente y mismos contratos: `/assets/realtime.js` sigue siendo el único cliente
  de Socket.IO (`chat:ready`, `chat:history`, `chat:send`, `chat:message`,
  `chat:presence`, `inventory:changed`) y mueve la burbuja con los mismos ids. El
  servidor no cambia. Cambios mínimos en `realtime.js`: fuera de `/chat` la sala se
  toma de `chat:ready` (en `/chat` se sigue comprobando), cada mensaje lleva
  `data-sender-id` y se guarda el id propio (`data-me`, también de `chat:ready`).
- `fwf/js/chat.js` solo decora: mensajes propios a la derecha, avatares de presencia,
  no leídos (ignora el historial inicial y las reconexiones), vista previa, Enter para
  enviar, altura automática y contador de caracteres. `partials/fwf-chat.ejs` y
  `css/chat.css`.
- Corrección general de estilos: los reinicios `.fwf a, .fwf button` e
  `input/select/textarea` de `fwf-base.css` pasan a `:where(...)`, porque eran más
  específicos que las clases de componente y quitaban fondos (botón de enviar,
  indicadores del Resumen, "+" de los estantes, tarjetas de producto, enlace de
  salto). Los contenedores `.chat-capa` y `.ficha-capa` limitan su columna
  (`minmax(0, 1fr)`) para no desbordar en 320 px.
- `scripts/verify-browser.js`, cambio consciente:
  - El menú hamburguesa `#mobile-menu-btn` ya no existe. En su lugar se prueba con
    el teclado el menú de cuenta (`details/summary`), y el informe registra
    `keyboardAccountMenu` en vez de `keyboardMobileMenu`.
  - Se añade un envío desde la burbuja del Resumen que debe llegar a la otra persona
    y no a otra empresa (`chatBubble`).
  - El color de marca pasa del verde de la navegación anterior, `rgb(22, 163, 74)`,
    al acento nuevo, `rgb(17, 128, 62)`, en el botón de enviar.
  - La evidencia guardada en
    `docs/5.Calidad-Y-Validacion/evidence/browser-quality.json` es de la ejecución
    anterior; se regenerará en la etapa 7.
- Pruebas: dos nuevas en `tests/frontend-pages.test.js` (ids que usa `realtime.js`,
  sala e historial de `/chat`, escape del contenido y burbuja con sala vacía).
- Verificación: `npm test` 111/111. Integración con MySQL de pruebas: 57/59, con los
  dos fallos conocidos de Windows. `verify:browser` con Edge: PASS, 40 escaneos axe
  sin incidencias y todas las comprobaciones funcionales, incluida la burbuja. Revisión
  visual: burbuja y envío en el Resumen y la refri, `/chat` en 1280 y 320 px, no
  leídos y vista previa (simulando un mensaje ajeno) y ventana en móvil.

### Etapa 7 — registro

- Recetas (`/recipes`, `/recipes/:id`), caducidad (`/expiration`) y páginas de error
  pasan a tarjetas de vidrio sobre la cocina, con los mismos datos, filtros,
  paginación, `data-item`, `data-ingredient`/`data-available` y textos. La página de
  error no depende de la sesión (sirve también para el 404 de la portada) y muestra la
  referencia `FWF_*` cuando existe.
- `/expiration` usa la vista nueva `inventory/caducidad.ejs`. Se retiran las vistas que
  ya nadie usaba: `inventory/list.ejs` y los parciales `head`, `navigation`, `logo` y
  `pagination`. `/assets/styles.css` (Tailwind) se sigue compilando y sirviendo porque
  `tests/database.integration.test.js` lo comprueba, pero ninguna vista lo carga.
- Texto: "Crítico: 1 días" pasa a "Crítico: 1 día" en `expiration.js` (solo la
  etiqueta; umbrales y códigos sin cambios).
- Rendimiento: `cocina.png` (1,7 MB) se sustituye por `cocina.webp` (63 KB, mismas
  dimensiones y sin transparencia), y `lechuga.jpg` (249 → 155 KB) y `leche.jpg`
  (124 → 93 KB) se recomprimen. Se hizo con el Edge instalado (canvas) sin añadir
  dependencias. Las texturas de la refri ya eran ligeras (30–118 KB).
- Estilos de tabla y filtros compartidos entre la refri y caducidad, movidos a
  `fwf-app.css`.
- Documentación: stack del front actualizado en README, `contextoProyecto.md`,
  `ejecucionPrimeraVez.md` y `PROJECT_SPEC.md`. Nuevos resultados en `VALIDATION.md`
  (se conserva el registro anterior), y evidencia de navegador regenerada en
  `docs/5.Calidad-Y-Validacion/evidence/browser-quality.json`.
- Pruebas: cuatro nuevas en `tests/frontend-pages.test.js` (etiqueta en singular,
  recetas, caducidad y página de error con y sin sesión).
- Verificación: `npm test` 115/115. Integración con MySQL de pruebas: 58/59 (solo
  SIGTERM, propio de Windows). `verify:browser` con Edge: PASS, 40 escaneos axe sin
  incidencias y todas las comprobaciones funcionales. Revisión visual de caducidad,
  detalle de receta y 404.

### Cierre del rediseño

Las siete etapas están completas: todas las vistas usan el diseño nuevo con la CSP
de mismo origen (solo `img-src` admite `https:` para las imágenes de producto),
formularios POST con CSRF y la lógica de negocio original. Pendiente antes de la
entrega: repetir `npm run test:db` y `npm run verify:browser` en Codespaces sobre la
revisión final, y los puntos académicos de "Pendientes de cierre".

### Ajustes tras la revisión del diseño

- Panel de detalle de la refri: se quita el enlace "Ver ficha" (el propio panel ya es
  la ficha). La página `/inventory/:id` se mantiene: a ella redirige el servidor tras
  guardar un producto.
- Tarjetas superpuestas (`fwf/js/superpuesta.js`), como en el diseño original: en la
  refri y en el Resumen, agregar/editar/eliminar producto, categorías, equipo, cuenta,
  recetas y caducidad se abren en un `<dialog>` modal encima de la pantalla actual, en
  vez de cambiar a una página con solo la cocina de fondo.
  - Se pide la misma página al servidor y se muestra su tarjeta; los formularios se
    envían a los mismos POST con su `_csrf`. Servidor, rutas, validación y permisos no
    cambian.
  - Errores de validación y avisos del servidor se ven dentro de la tarjeta. Si hubo
    un cambio, al cerrar se recarga la vista de debajo. Tras eliminar, el aviso
    ("Producto eliminado.") se conserva en `sessionStorage` y se muestra al volver.
  - Los ids de la tarjeta se prefijan (`dlg-`) para no repetir los de la página;
    Escape, la X o un clic fuera cierran. No se usa `<iframe>` (la CSP
    `frame-ancestors 'none'` lo impide).
  - Mejora progresiva: sin JavaScript o ante cualquier fallo, el enlace navega a la
    página completa como antes.
- `verify:browser` comprueba que "Agregar producto" se abre sobre `/inventory` sin
  cambiar de página y que Escape la cierra (`overlayCards`).
- Verificación: `npm test` 115/115 y `verify:browser` con Edge: PASS (40 escaneos axe
  sin incidencias). Revisión con datos ficticios: alta de producto, categoría
  repetida (error) y nueva, eliminación con aviso, "Mi cuenta" y receta sobre el
  Resumen, cierre con Escape y con la X, y móvil a 375 px.
- Categorías: las acciones son iconos como en el diseño original (lápiz y papelera a
  la derecha de cada fila). El lápiz despliega debajo el editor (nombre, color,
  Cancelar y Guardar) con `details/summary`, que funciona sin JavaScript; la papelera
  abre la confirmación de eliminar. Mismos POST.
- Alertas del Resumen:
  - Muestran la foto local de respaldo según el nombre (leche, yogur, tomate…), igual
    que la refri. La lógica está ahora en un módulo común, `fwf/js/fotos.js`, que
    usan la refri, el Resumen y la ficha del producto.
  - Al pulsar una alerta se abren las puertas y se llega a la refri con ese producto
    seleccionado (`/inventory#producto-ID`; el `#` no llega al servidor, así que la
    consulta y su validación no cambian), en lugar de abrirse su tarjeta.
- Verificación: `npm test` 115/115 y `verify:browser` con Edge: PASS (40 escaneos axe
  sin incidencias). Revisión: editor de categoría con iconos, Cancelar, fotos en las
  alertas y alerta → refri con el producto seleccionado.
- Tras registrar o editar un producto desde la tarjeta superpuesta ya no se muestra su
  ficha: se vuelve a la refri con ese producto seleccionado y el aviso del servidor
  ("Producto registrado." / "Producto actualizado.") arriba. El servidor sigue
  redirigiendo a `/inventory/:id`, así que sin JavaScript el flujo es el de antes.
- Vista de lista de la refri centrada; "Volver a la refri" es ahora una X (con nombre
  accesible "Volver a la refri").
- Verificación: `verify:browser` con Edge: PASS (40 escaneos). `npm test` 115/115 en
  tres ejecuciones seguidas. Hubo un fallo intermitente aislado en
  `tests/frontend-assets.test.js` al servir `cocina.webp` (antes también con
  `motion.js`, los archivos estáticos más grandes); no se reproduce y apunta al
  tiempo límite de la prueba con el disco ocupado en Windows.

### Campana de avisos del chat (rama `feature/campana-notificacion`) — IN_PROGRESS

Objetivo: avisar de los mensajes del equipo sin cambiar la arquitectura ni el modelo
de datos (sin tabla, evento Socket.IO ni ruta nuevos).

- Parcial nuevo `src/views/partials/fwf-avisos.ejs`: `<details class="avisos">` con la
  campana, el badge y un panel de vistas previas. Sin JavaScript sigue siendo un
  desplegable con el enlace a `/chat`.
- Se incluye junto al chip de cuenta en `/dashboard`, `/inventory` y `/chat`
  (`barra-cuenta` en `fwf-app.css`; `chat-barra-acc` en `chat.css`). No se añade en las
  páginas tipo tarjeta.
- Estilos en `fwf-app.css` con los tokens existentes (`--vidrio`, `--r-pill`, `--e1`,
  `--e2`, `--acento`, `--t1`); badge `9+` y etiqueta accesible con el total. En la refri
  el panel se ajusta al ancho de `#lateral` y en móvil se abre fijo, como el menú de
  cuenta.
- `src/public/realtime.js` sigue siendo el único cliente Socket.IO: al recibir
  `chat:ready` guarda el usuario, siembra el contador con `chat:history` y escucha
  `chat:message`. El último mensaje leído se guarda en `localStorage`
  (`fwf:avisos:<userId>`), por lo que el badge sobrevive a la navegación. Un mensaje
  propio o con el chat/campana abiertos no suma.
- `fwf/js/chat.js` solo comparte el estado con dos eventos internos (`fwf:leido` y
  `fwf:avisos-sembrados`): la burbuja y la campana no muestran totales distintos.
- Pruebas: se añaden comprobaciones en `tests/frontend-pages.test.js` (campana única,
  etiqueta accesible, sin `data-chat-room` adicional y CSP sin cambios).
- Verificación pendiente: `npm test` y `verify:browser` (40 escaneos axe) en esta rama.


### Alta de recetas (rama `feature/agregar-recetas`) — DONE

- ADMIN puede agregar recetas con descripción, preparación e ingredientes
  desde el catálogo y desde el botón «Agregar recetas» debajo de «Agregar
  producto» en la refri. Express comprueba el rol y el token CSRF, Zod valida la
  entrada y Prisma guarda la receta y los ingredientes juntos.
- ADMIN y EMPLOYEE consultan las recetas de su empresa. El Resumen usa el
  motor existente para sugerir recetas que coinciden con productos próximos
  a caducar y con stock disponible.
- Verificación con asistencia de IA: `npm test` 115/115 y
  `tests/business.integration.test.js` 19/19 en MySQL aislado. Se comprobó
  el alta, el rechazo de formularios inválidos, CSRF, los permisos,
  las sugerencias y el aislamiento entre empresas.
- Siguiente paso de la rama: revisión de los cambios para el pull request.

## Rendimiento y correcciones (rama `feature/rendimiento-y-bugs`)

### Clic que atravesaba las tarjetas sobre la refri cerrada

- Problema: en el Resumen, con una tarjeta superpuesta abierta (recetas, agregar
  receta, cuenta, categorías…) o con la ventana del chat, un clic en el centro de la
  pantalla —donde está la refri detrás— abría la refri (`/inventory`).
- Causa: `resumen.js` escucha el clic en toda la ventana y solo descartaba una lista
  fija de elementos (enlaces, botones y las dos columnas). Los clics dentro de las
  tarjetas, el chat o el fondo oscuro del diálogo no estaban en esa lista y llegaban
  a `R.toca()`, que detecta la refri 3D detrás.
- Corrección (solo `src/public/fwf/js/resumen.js`): la refri reacciona únicamente si
  el evento cae sobre el fondo de la escena (`#resumen`, `#escena`, `<body>` o
  `<html>`) y nunca mientras haya un `<dialog>` abierto. Se aplica también al efecto
  de entreabrir las puertas al pasar el puntero. La refri abierta y la portada no
  tienen este comportamiento global, así que no requieren cambios.
- `verify:browser` añade la comprobación `overlayBlocksFridgeClick`: con la tarjeta de
  recetas abierta sobre el Resumen (1280 px), un clic real en el centro debe dejar la
  página en `/dashboard` con la tarjeta abierta. Se comprobó que la prueba falla con
  el código anterior (`actual: '/inventory'`) y pasa con la corrección.
- Verificación: `npm test` 115/115; integración con MySQL 58/60 (los dos fallos
  conocidos de Windows); `verify:browser` con Edge: PASS (40 escaneos). Revisión en
  `localhost:3000`: lista de recetas, agregar receta, fondo del diálogo, Mi cuenta y
  chat sin abrir la refri; sin nada encima, el clic sigue abriéndola.
