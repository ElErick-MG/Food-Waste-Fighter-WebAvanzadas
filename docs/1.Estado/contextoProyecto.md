# Contexto General del Proyecto — Food Waste Fighter Business Edition

> **Documento de transferencia de contexto para agentes de IA y desarrolladores.**
> Si estás iniciando una nueva sesión de trabajo en este repositorio, este archivo resume todo lo que necesitas saber sobre el propósito, la arquitectura, el estado actual, las restricciones obligatorias y la forma de operar en el proyecto.

---

## 1. Identificación y Propósito del Proyecto

* **Nombre:** Food Waste Fighter — Business Edition
* **Contexto Académico:** Proyecto práctico de la asignatura **Desarrollo Web Avanzado** (Primer Bimestre).
* **Naturaleza:** Es la migración, rediseño y endurecimiento de una aplicación académica previa basada en Java/JSP hacia un **monolito moderno en Node.js**.
* **Objetivo de Negocio:** Aplicación web para cafeterías y pequeños restaurantes orientada a reducir el desperdicio de alimentos mediante:
  1. **Control estricto de inventario:** Gestión de existencias con decimales exactos (3 decimales) y fechas de caducidad.
  2. **Alertas de caducidad:** Semáforo por fechas civiles (caducado, crítico 0-2 días, advertencia 3-5 días, normal 6+ días) en la zona horaria del negocio (`America/Guayaquil`).
  3. **Aprovechamiento mediante recetas:** Cruce automático de recetas con alimentos disponibles y no caducados en inventario.
  4. **Coordinación del equipo en tiempo real:** Chat persistido para el personal y notificaciones en vivo de altas/bajas/cambios en inventario sin recargar la página.
  5. **Aislamiento Multi-inquilino (Multi-tenant):** Cada empresa registrada tiene sus propios datos aislados (usuarios, inventario, categorías, recetas, chat).

---

## 2. Restricciones Tecnológicas Obligatorias (Reglas del Primer Bimestre)

De acuerdo con la guía académica oficial y [AGENTS.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/AGENTS.md), rigen las siguientes restricciones técnicas inquebrantables:

* **Arquitectura:** **Monolito en un único proceso Node.js 24 + Express 5.**
  * ❌ **PROHIBIDO:** No introducir React, Vue, Angular, arquitecturas SPA ni microservicios durante el primer bimestre.
  * ✔️ **Frontend:** Server-Side Rendering (SSR) con plantillas **EJS**, HTML5 semántico, CSS propio (sistema de diseño en `src/public/fwf/css`) y JavaScript nativo en módulos (`src/public/fwf/js`); la refri 3D usa Three.js r128 y las animaciones Motion, ambos servidos desde el mismo origen. Tailwind CSS v4 queda solo como compilación heredada (`/assets/styles.css`), sin uso en las vistas.
* **Persistencia:** **MySQL 8.4** mediante **Prisma ORM 7.10.1** (usando el adaptador `@prisma/adapter-mariadb`).
* **Sesiones de Usuario:** `express-session` con almacén persistente en MySQL (`PrismaSessionStore`). Las sesiones duran 8 horas, usan cookies `HttpOnly`, `SameSite=Lax` y `Secure` en HTTPS.
* **Tiempo Real:** **Socket.IO 4** integrado en el mismo servidor HTTP, compartiendo la sesión de Express y validando tokens CSRF y origen.
* **Seguridad:**
  * Hashing de contraseñas con **Argon2id** (19 MiB memoria, 2 iteraciones, 1 hilo paralelo — estándar OWASP).
  * Validación exhaustiva de entradas con **Zod** y rechazo de campos desconocidos.
  * Tokens CSRF sincronizados con la sesión en todos los formularios mutating (`POST`).
  * Cabeceras de seguridad con **Helmet** y Content Security Policy (CSP) restringida al mismo origen.
  * Límites de peticiones con `express-rate-limit` (10 intentos / 15 min por IP en autenticación).
  * **Recuperación de contraseñas:** Token criptográfico de un solo uso con expiración de 30 minutos. El envío de correos se simula escribiendo archivos JSON locales en `work/outbox/` (nunca expuestos por HTTP).
* **Entorno Oficial:** **GitHub Codespaces** con Docker Compose (`compose.yaml`). El código debe ejecutarse sin requerir dependencias locales instaladas en la máquina host.

---

## 3. Estructura y Mapeo del Repositorio

```text
.
├── .devcontainer/           # Configuración oficial de GitHub Codespaces (Docker-in-Docker)
├── docs/                    # Documentación formal organizada por áreas
│   ├── 1.Estado/            # Estado actual, progreso y reglas (contextoProyecto.md, PROGRESS.md, AGENTS.md)
│   ├── 2.Guias/             # Guías paso a paso de ejecución e inicialización
│   ├── 3.Especificaciones/  # Alcance, requisitos, historias (PROJECT_SPEC.md) y roadmap
│   ├── 4.Arquitectura/      # Arquitectura, modelo ER y contratos (TECHNICAL_REFERENCE.md)
│   ├── 5.Calidad-Y-Validacion/# Evidencias de pruebas (VALIDATION.md) y JSONs de métricas
│   └── 6.Evaluacion-Y-Entrega/# Matriz de rúbrica (COMPLIANCE_MATRIX.md) y entrega (DELIVERY.md)
├── prisma/
│   ├── schema.prisma        # Definición de las 11 entidades y restricciones de MySQL
│   ├── seed.js              # Carga inicial idempotente de la empresa demo "Cafetería Semilla"
│   └── migrations/          # Historial de migraciones SQL versionadas
├── src/
│   ├── server.js            # Punto de entrada: validación de entorno, base de datos y arranque
│   ├── app.js               # Configuración de Express, middlewares, Helmet, sesiones y rutas
│   ├── config/              # Configuración de base de datos, entorno y sesión
│   ├── middleware/          # Middlewares de autenticación, autorización por rol, CSRF y errores
│   ├── modules/
│   │   ├── auth/            # Registro de empresa/admin, login, logout, recuperación y outbox
│   │   ├── users/           # Administración de equipo (/team) para agregar EMPLOYEE
│   │   ├── inventory/       # CRUD de alimentos, validación con Zod, filtros y paginación
│   │   ├── categories/      # Administración de categorías (solo ADMIN)
│   │   ├── dashboard/       # Métricas de existencias y contadores de alertas
│   │   ├── expiration/      # Lógica de cálculo de semáforo de fechas de caducidad
│   │   ├── recipes/         # Recetas, ingredientes y coincidencias con stock disponible
│   │   └── chat/            # Socket.IO, sala General, historial, presencia y eventos
│   ├── views/               # Vistas EJS (diseño inmersivo: portada 3D, refri, caducidad, modales)
│   ├── public/              # Sistema de diseño fwf (CSS, módulos JS, texturas refri e imágenes)
│   └── styles/              # Fuente de Tailwind CSS heredada (app.css)
├── tests/                   # 115 pruebas independientes (unitarias, páginas, assets) + integración MySQL
├── scripts/                 # Herramientas auxiliares (setup-env, measure-queries, verify-browser)
├── compose.yaml             # Servicios Docker: MySQL desarrollo (3306) y MySQL pruebas (3307)
└── README.md                # Entrada pública principal del repositorio en GitHub
```

---

## 4. Modelo de Datos (11 Entidades)

El modelo está definido en [prisma/schema.prisma](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/prisma/schema.prisma):

1. **Company:** Empresa/negocio independiente (Tenant).
2. **User:** Usuarios (`ADMIN` o `EMPLOYEE`), vinculados a una empresa con `passwordHash` (Argon2id) y `sessionVersion`.
3. **Inventory:** Inventario de alimentos de la empresa.
4. **Category:** Categorías de alimentos (únicas por empresa), con `color` opcional (`#RRGGBB`).
5. **FoodItem:** Alimento con `quantity` (DECIMAL 12,3), `unit`, `receivedDate`, `expiresDate`, `minimumStock` e `imageUrl` opcional (HTTPS).
6. **Recipe:** Receta para aprovechamiento de alimentos.
7. **RecipeIngredient:** Ingredientes requeridos por cada receta.
8. **ChatRoom:** Sala de coordinación (sala predeterminada: `General`).
9. **ChatMessage:** Mensajes de texto persistidos (máx. 2000 caracteres).
10. **PasswordResetToken:** Tokens de un solo uso hasheados en SHA-256 (`tokenHash`).
11. **Session:** Almacén de sesiones HTTP de Express con datos en JSON.

---

## 5. Estado Actual del Proyecto y Avance

Consulte siempre [PROGRESS.md](PROGRESS.md) para el detalle más reciente:

* **Funcionalidad del 1er Bimestre:** **100 % implementada.**
  * Registro de empresa y administrador (`/auth/register`).
  * Autenticación, cierre de sesión y rotación de sesión (`/auth/login`, `/auth/logout`).
  * Recuperación de contraseña con token temporal y revocación de sesiones previas.
  * Gestión de equipo por parte del administrador (`/team`).
  * Inventario completo con validación Zod, búsqueda, paginación y eliminación segura con CSRF (`/inventory`).
  * Semáforo de caducidades y dashboard con contadores de métricas (`/expiration`, `/dashboard`).
  * Catálogo de recetas con motor de coincidencias según alimentos utilizables (`/recipes`).
  * «Recetas sugeridas» en el Resumen y «Con lo que tienes en tu refri» en Recetas muestran hasta dos sugerencias según los productos vigentes y con stock de la empresa. Se recalculan al abrir o recargar cada pantalla.
  * Cada empresa nueva recibe seis recetas de ejemplo con cantidades, unidades y pasos. Para cargar el mismo catálogo en empresas existentes, ejecuta `npm run db:seed` después de aplicar las migraciones. Repetir la carga conserva las recetas existentes y evita duplicar las de ejemplo.
  * Chat en tiempo real con presencia en vivo, historial persistido y avisos automáticos de inventario (`/chat`).
* **Calidad y Pruebas:**
  * **115 pruebas independientes exitosas** (`npm test`, 100 % aprobadas), incluyendo pruebas del nuevo frontend (assets locales, renderizado sin JS inline, datos de la refri y validación de `imageUrl` y `color`).
  * **58 pruebas de integración** contra MySQL (`test:db`).
  * **40 escaneos de navegador** con `Playwright` y `axe-core` sin violaciones de accesibilidad ni errores de consola.
  * Medición de rendimiento en consultas SQL con 1000 registros sintéticos documentada en [docs/5.Calidad-Y-Validacion/VALIDATION.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/docs/5.Calidad-Y-Validacion/VALIDATION.md).
* **Pendientes de Cierre Académico (No funcionales):**
  * Completar nombres y datos reales de integrantes y docente en [README.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/README.md).
  * Generar evidencias finales de ejecución en Codespaces con HTTPS/wss y dos usuarios simultáneos.
  * Realizar pruebas manuales de accesibilidad con lector de pantalla.
  * Publicar la etiqueta Git `v1.0-b1` para la entrega.

---

## 6. Comandos Operativos y de Inicialización

### Puesta en marcha desde cero:
```powershell
# 1. Generar variables de entorno con secretos únicos
npm run setup:env

# 2. Instalar dependencias exactas
npm ci

# 3. Levantar contenedor de MySQL en Docker (puerto 3306)
npm run db:up

# 4. Generar cliente Prisma y compilar Tailwind CSS
npm run build

# 5. Aplicar migraciones SQL a la base de datos
npm run db:migrate

# 6. Cargar datos semilla de la empresa de prueba "Cafetería Semilla"
npm run db:seed

# 7. Iniciar en modo desarrollo con recarga automática
npm run dev
```

### Inspección de la Base de Datos:
* **Prisma Studio (interfaz gráfica web):**
  ```powershell
  npx prisma studio
  ```
  Disponible en `http://localhost:5555`.
* **Consola de MySQL en Docker:**
  ```powershell
  docker compose exec -it mysql mysql -u root -p
  # Utilizar el valor de MYSQL_ROOT_PASSWORD del archivo .env
  ```

### Acceso a la aplicación (`http://localhost:3000`):
* **Registrar empresa nueva:** Ir a `/auth/register`.
* **Usar usuario del Seed:**
  * Cuenta admin: `admin@semilla.example`
  * Como la contraseña generada en el seed se descarta por seguridad, ir a `/auth/forgot`, solicitar reseteo para ese correo, abrir el archivo JSON creado en `work/outbox/` y navegar al enlace generado para definir una contraseña.

### Suite de Pruebas:
```powershell
# Levantar base de datos aislada de pruebas (puerto 3307)
docker compose --profile test up -d --wait mysql-test

# Correr pruebas unitarias y de integración
npm test
npm run test:db

# Medición de rendimiento de consultas
npm run measure:queries
```

---

## 7. Reglas de Trabajo para Agentes de IA (`AGENTS.md`)

Cualquier agente que trabaje en este proyecto **DEBE** respetar las directrices definidas en [AGENTS.md](AGENTS.md):

1. **Lectura Previa Obligatoria:** Antes de escribir o modificar código, leer [docs/3.Especificaciones/PROJECT_SPEC.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/docs/3.Especificaciones/PROJECT_SPEC.md), [docs/4.Arquitectura/TECHNICAL_REFERENCE.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/docs/4.Arquitectura/TECHNICAL_REFERENCE.md) y [PROGRESS.md](PROGRESS.md).
2. **Flujo Incremental:** Elegir una única tarea a la vez, marcarla como `IN_PROGRESS` en `PROGRESS.md`, implementarla, verificarla con pruebas automatizadas y marcarla `DONE` únicamente cuando la verificación sea exitosa.
3. **Veracidad Absoluta:** Jamás inventar resultados de pruebas ni asumir que algo funciona sin haberlo ejecutado.
4. **No Destrucción:** No eliminar funcionalidad existente ni simplificar reglas de negocio sin documentar la justificación técnica.
5. **Compatibilidad:** Mantener siempre el soporte para ejecución dentro de **GitHub Codespaces** con Docker Compose. No añadir dependencias innecesarias.
