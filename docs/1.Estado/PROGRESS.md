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
| 1 · Portada y acceso | `home.ejs` y vistas `/auth/*` con el diseño nuevo y formularios reales. | PENDIENTE |
| 2 · Datos | Migración aditiva: `FoodItem.imageUrl` (HTTPS opcional) y `Category.color`; validación, servicio, seed y pruebas. | PENDIENTE |
| 3 · Resumen | `/dashboard` con la refri cerrada y datos reales. | PENDIENTE |
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
