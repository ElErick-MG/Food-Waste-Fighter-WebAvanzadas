# Validación y rendimiento

## Comandos de verificación

Con `.env` configurada y MySQL disponible:

```sh
npm ci
npm run build
npm run db:validate
docker compose --profile test up -d --wait mysql-test
npm test
npm run test:db
# Si no hay navegador disponible en Codespaces:
npx playwright install --with-deps chromium
npm run verify:browser
# Ejecutar por separado de otras cargas:
npm run measure:queries
npm audit --omit=dev --audit-level=high
```

`test:db` despliega migraciones únicamente en la base de pruebas. El guard
compartido exige TEST_DATABASE_URL MySQL con nombre terminado en `_test` y
distinto del de desarrollo; no utiliza DATABASE_URL como alternativa. Las pruebas
limpian sus propios registros, sin reiniciar datos de desarrollo.

`verify:browser` crea app y Socket.IO reales en un servidor efímero y MySQL test.
Utiliza Chromium instalado o descargado por Playwright; BROWSER_EXECUTABLE_PATH
permite seleccionar el binario. Las capturas y nuevos JSON se guardan en `work/`.
Los informes versionados en `docs/evidence/` se conservan como referencia y no
se sobrescriben automáticamente al ejecutar los comandos.

## Cobertura y resultados disponibles

Resultados registrados el 7 de noviembre de 2026:

| Comprobación | Resultado registrado |
| --- | --- |
| Pruebas independientes | 50 satisfactorias. Configuración, HTTP, fechas civiles, validación y protección de automatización. |
| Integración con MySQL separado | 56 satisfactorias. Persistencia, arranque/apagado, cuentas, sesiones, recuperación, negocio y sockets. |
| Total automatizado | **106 pruebas satisfactorias**. |
| Navegador y axe | **40 combinaciones** de 20 rutas a 1280×900 y 320×740; cero infracciones detectadas, overflow horizontal, errores JavaScript y peticiones HTTP externas. |
| Interacción en navegador | Login nativo, teclado/salto/menú móvil, dos usuarios, historial tras recarga, aislamiento y aviso de inventario sin navegación. |
| HTTPS local | Cookie Secure/HttpOnly y upgrade wss observados mediante proxy con Origin reescrito; flujos y separación de empresas correctos. |
| Dependencias de producción | Cero vulnerabilidades reportadas por npm audit en la comprobación registrada. |

Evidencia: [browser-quality.json](evidence/browser-quality.json). Las pruebas
utilizan identidades ficticias y no publican cookies, tokens, contraseñas ni
URLs de conexión.

| Casos esenciales | Archivo |
| --- | --- |
| Registro válido/duplicado, contraseña incorrecta, sesión protegida y roles | tests/auth.integration.test.js |
| Recuperación: caducidad, reutilización, consumo concurrente y revocación | tests/auth.integration.test.js |
| CRUD, validación, CSRF, permisos por empresa, búsqueda y paginación | tests/business.integration.test.js |
| Métricas, recetas y límites de caducidad | tests/business.test.js, tests/business.integration.test.js |
| Socket anónimo rechazado, dos clientes, sala/cursor ajenos e identidad inyectada | tests/chat.integration.test.js |
| Historial persistido, presencia, polling, límites y revocación | tests/chat.integration.test.js |
| Avisos de inventario y cierre de conexiones activas | tests/chat.integration.test.js |
| Seed, restricciones, startup/SIGTERM y base inaccesible | tests/database.integration.test.js |
| Rechazo de bases inseguras y errores sin credenciales | tests/tooling.test.js |

## Accesibilidad y alcance de la revisión

Los textos y acciones normales usan verde700 (#15803d), con contraste de 5,02:1
frente a blanco. La marca grande conserva verde600. Los formularios de acceso
tienen región main, el logo móvil dispone de nombre accesible y el foco de
teclado es visible. Las tablas incluyen encabezados, caption y región desplazable;
las alertas contienen texto y no dependen únicamente del color.

Se ejecutan reglas axe A/AA de WCAG 2/2.1 y best-practice después de completar
las animaciones. Dos escaneos de detalle de receta conservan comprobaciones
incompletas de contraste en símbolos/números decorativos aria-hidden. La
disponibilidad también se expresa en texto; los pasos forman una lista ordenada
y sus números usan blanco/verde700. Se verifican el salto al contenido y la
apertura/cierre del menú con teclado.

Los resultados automatizados no constituyen certificación WCAG ni una auditoría
externa de seguridad. Queda pendiente una evaluación completa con lector de
pantalla y personas usuarias. Las pruebas del proxy HTTPS son locales; el acta
del despliegue real se adjunta según [DELIVERY.md](DELIVERY.md).

## Medición de consultas

Se mide el repositorio real del inventario: transacción de count, lista paginada
y categoría. La medición incluye Node/Prisma/adaptador y MySQL; excluye render,
HTTP, navegador y proxy de Codespaces.

Condiciones: 1000 alimentos ficticios, una categoría, 5 calentamientos excluidos,
30 muestras por caso, concurrencia 1 y caché caliente. Node v24.22.1, Prisma
7.10.1 y MySQL 8.4.13; el entorno informa 3 CPUs lógicas y 9,73 GiB de RAM.
Percentiles por rango más próximo. Medición: 7 de noviembre de 2026, 15:11 en
America/Bogota. Informe: [query-performance.json](evidence/query-performance.json).

| Operación | Coincidencias / devueltos | p50 ms | p95 ms | Máximo ms |
| --- | --- | ---: | ---: | ---: |
| Primera página | 1000 / 10 | 4.801 | 5.923 | 6.020 |
| Página 50, offset 490 | 1000 / 10 | 4.965 | 6.384 | 6.615 |
| Subcadena «Alimento 00» | 100 / 10 | 7.595 | 12.123 | 17.628 |

El JSON incluye índices reales y EXPLAIN de SQL representativo parametrizado.
El listado ordenado elige `FoodItem_companyId_expiresDate_idx` y `Using index`.
La subcadena elige ALL, sin key, con `Using where; Using filesort`. Una búsqueda
`%texto%` no equivale a un prefijo indexable; el repositorio también busca por
categoría, por lo que el plan simplificado no representa todo su OR.

Son resultados locales con datos sintéticos y consultas en serie, no una prueba
de carga ni un SLA. No se compara una versión sin índices ni se atribuye un
porcentaje de aceleración. Los avisos y el chat se verifican por separado de
la latencia SQL. La presencia y los límites de uso permanecen en memoria del
monolito; mensajes y sesiones persisten en MySQL.
