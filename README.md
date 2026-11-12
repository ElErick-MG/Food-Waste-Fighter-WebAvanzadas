# Food Waste Fighter — Business Edition

Aplicación para una cafetería o restaurante pequeño: inventario de alimentos,
alertas de caducidad, consulta de recetas y coordinación del personal mediante
chat. Se utilizan datos ficticios y se separa la información de cada empresa.

Se implementa un monolito con Node.js 24, Express 5, EJS, HTML5/Tailwind CSS,
JavaScript, MySQL 8.4, Prisma 7.10.1 y Socket.IO 4. La seguridad utiliza Argon2id,
express-session persistente, Zod y Helmet. Se verifica con Vitest/Supertest y
Playwright/axe.

## Ejecución en GitHub Codespaces

Se abre el repositorio mediante **Code → Codespaces → Create codespace**. El
devcontainer proporciona Node.js 24, Docker-in-Docker y el puerto 3000.

```sh
npm run setup:env
npm ci
npm run build
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

El puerto 3000 se abre desde **Ports**, con visibilidad privada. El servidor
escucha en `0.0.0.0`; `/health` comprueba HTTP y `/ready` consulta MySQL. `npm start`
compila y arranca sin modo de vigilancia. No se requieren instalaciones en el
equipo del estudiante ni reenvío público de los puertos MySQL 3306/3307.

## Configuración

`npm run setup:env` crea `.env` con secretos aleatorios y permisos 0600; conserva
un archivo existente. [.env.example](.env.example) contiene todas las variables.

| Variable | Configuración |
| --- | --- |
| NODE_ENV, HOST, PORT | Modo de ejecución y escucha; puerto 3000 por defecto. |
| APP_ORIGIN | Origen exacto del navegador, sin rutas: `http://localhost:3000` o HTTPS reenviado de Codespaces. |
| TRUST_PROXY | `1` para el proxy de Codespaces; `0` para HTTP directo. |
| DATABASE_URL, MYSQL_* | Conexión y credenciales del MySQL de desarrollo. |
| SESSION_SECRET | Secreto de firma, mínimo 32 caracteres. |
| TEST_DATABASE_URL, TEST_MYSQL_* | MySQL de pruebas independiente; nombre terminado en `_test`. |
| BUSINESS_TIMEZONE | Zona IANA para fechas del negocio; `America/Guayaquil` por defecto. |

En Codespaces se usa su origen HTTPS y TRUST_PROXY=1. Tras modificar `.env`, se
reinicia el servidor. El volumen `mysql_data` conserva desarrollo; `docker compose
stop` mantiene sus datos. Cambiar una contraseña en `.env` no modifica la de un
volumen inicializado. No se ejecuta el SQL del proyecto Java ni se requieren
reinicios destructivos.

## Acceso y funcionamiento

El registro crea una empresa, ADMIN, inventario y sala General. ADMIN incorpora
empleados desde `/team` y administra categorías. ADMIN y EMPLOYEE registran y
editan alimentos; solo ADMIN elimina productos con confirmación.

- `/dashboard`: métricas, alertas y acceso al inventario y chat.
- `/inventory`: búsqueda, filtros, detalle y CRUD con páginas de 10 alimentos.
- `/expiration`: caducados, crítico 0–2 días, advertencia 3–5 y normal desde 6.
- `/recipes`: ingredientes, preparación y coincidencias con existencias útiles.
- `/chat`: mensajes persistidos, presencia y avisos de inventario sin recarga.
- `/account`: datos de la cuenta; cierre de sesión mediante POST protegido.

El seed crea la Cafetería Semilla y las cuentas ficticias `admin@semilla.example`
y `equipo@semilla.example`, con contraseñas aleatorias descartadas. Se establece
el acceso desde `/auth/forgot`: se consulta el JSON de `work/outbox/` en el
editor privado y se abre el enlace para definir una contraseña. El envío es una
simulación de correo. La bandeja no se publica ni se sirve por HTTP; los enlaces
caducan en 30 minutos y admiten un solo uso. El seed es idempotente y conserva
las contraseñas existentes.

## Pruebas y rendimiento

```sh
npm run build
npm run db:validate
docker compose --profile test up -d --wait mysql-test
npm test
npm run test:db
# Instalar el navegador una vez si no está disponible en Codespaces:
npx playwright install --with-deps chromium
npm run verify:browser
# Medir sin otras cargas de pruebas en paralelo:
npm run measure:queries
```

La automatización usa MySQL test independiente y limpia sus datos temporales.
Los resultados nuevos de navegador y rendimiento se guardan en `work/`; las
evidencias de referencia están en [VALIDATION.md](docs/VALIDATION.md). Si existe,
se detecta `/usr/bin/chromium`; BROWSER_EXECUTABLE_PATH permite seleccionar otro
binario del entorno.

## Referencias del proyecto

- [Alcance, objetivos, historias y cronograma](docs/PROJECT_SPEC.md).
- [Arquitectura, modelo, permisos, seguridad y eventos](docs/TECHNICAL_REFERENCE.md).
- [Rúbrica oficial y correspondencia con evidencias](docs/COMPLIANCE_MATRIX.md).
- [Pruebas, accesibilidad y rendimiento](docs/VALIDATION.md).
- [Presentación y entrega](docs/DELIVERY.md).
- [Alcance del segundo bimestre](docs/second-bimester-roadmap.md).
- [Estado actual y pendientes](PROGRESS.md).

## Integrantes y roles

Periodo: `[PERIODO_ACADEMICO]` · docente: `[DOCENTE]` · equipo: `[NOMBRE_EQUIPO]`.

| Integrante | Responsabilidad propuesta | Aporte real y commits |
| --- | --- | --- |
| `[INTEGRANTE_1]` | Coordinación, requisitos y documentación | `[APORTE_1_Y_COMMITS]` |
| `[INTEGRANTE_2]` | Modelo, autenticación y seguridad | `[APORTE_2_Y_COMMITS]` |
| `[INTEGRANTE_3]` | Inventario, recetas e interfaz | `[APORTE_3_Y_COMMITS]` |
| `[INTEGRANTE_4]` | Chat, sesiones y aislamiento | `[APORTE_4_Y_COMMITS]` |
| `[INTEGRANTE_5_OPCIONAL]` | Pruebas, rendimiento y demostración | `[APORTE_5_Y_COMMITS]` |

Repositorio público: https://github.com/A-PerfectStranger/Food-Waste-Fighter-WebAvanzadas

## Uso de IA y atribución

Se utilizó OpenAI Codex como apoyo en auditoría, implementación, adaptación de
plantillas, pruebas y documentación. El equipo debe revisar, probar, comprender
y poder explicar o modificar el contenido durante la defensa.

El HTML/JSP/CSS original procede de `Food_Waste_Fighter-main.zip`, aportado como
base del proyecto. Inter se distribuye mediante `@fontsource/inter` bajo SIL Open
Font License. Los datos personales, secretos, tokens, `.env` y la bandeja privada
quedan fuera del repositorio y de las evidencias públicas.
