Analyzed PROGRESS.md:L1-22
Analyzed PROJECT_SPEC.md:L1-80
Analyzed TECHNICAL_REFERENCE.md:L1-257
Analyzed package.json:L1-52
Analyzed README.md:L1-128
Analyzing docker-compose.yml:L1
Analyzed .env.example:L1-23
Ran list files in root directory
Analyzed compose.yaml:L1-38
Analyzed setup-env.js:L1-30
Analyzed devcontainer.json:L1-18
Ran check if .env exists
Ran list scripts directory
Ran list prisma directory
Analyzed seed.js:L1-50
Ran list auth module files
Analyzed reset-mail.js:L1-9
Ran check Node and Docker versions
Ran check if Docker daemon is running · Exited with code 1
Ran check if node_modules exists
Analyzed VALIDATION.md:L1-111

He analizado el contexto completo de tu proyecto a partir de la documentación técnica ([PROJECT_SPEC.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/docs/PROJECT_SPEC.md), [TECHNICAL_REFERENCE.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/docs/TECHNICAL_REFERENCE.md), [README.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/README.md) y [PROGRESS.md](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/PROGRESS.md)).

---

### 1. Resumen del Contexto del Proyecto

- **Propósito:** _Food Waste Fighter — Business Edition_ es un sistema web académico para cafeterías y pequeños restaurantes orientado a la reducción de desperdicio de alimentos mediante control de inventario, detección de caducidades, sugerencias de recetas basadas en existencias y coordinación del personal en tiempo real.
- **Arquitectura:** Monolito en **Node.js 24 + Express 5** con vistas server-side en **EJS** y Tailwind CSS.
- **Persistencia y Datos:** **MySQL 8.4** mediante **Prisma ORM** (`@prisma/adapter-mariadb`). Las sesiones de usuario (`express-session`) se guardan directamente en MySQL (`PrismaSessionStore`).
- **Tiempo Real:** **Socket.IO 4** integrado en el mismo proceso para el chat del equipo (sala _General_) y notificaciones automáticas de cambios de inventario sin recargar la página.
- **Seguridad:** Hashing con **Argon2id**, protección CSRF vinculada a sesión, cabeceras seguras con Helmet, validación estricta con **Zod** y aislamiento estricto por empresa (_multi-tenant_ lógico).
- **Entorno principal:** Diseñado para **GitHub Codespaces** o desarrollo local con contenedores Docker para la base de datos ([compose.yaml](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/compose.yaml)).

---

### 2. Requisitos Previos en tu Equipo (Windows)

1. **Node.js 24**: Ya lo tienes instalado (`v24.22.1`).
2. **Docker Desktop**: Está instalado, pero **el servicio/motor de Docker debe estar iniciado** para que el contenedor de MySQL pueda levantarse. (Abre la aplicación _Docker Desktop_ en Windows antes de continuar).

---

### 3. Paso a Paso para Inicializar el Proyecto

Ejecuta los siguientes comandos desde tu terminal (PowerShell) en la raíz del proyecto:

#### Paso 3.1: Generar el archivo de entorno `.env`

Crea el archivo `.env` a partir de [.env.example](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/.env.example) con contraseñas y secretos criptográficos aleatorios generados automáticamente:

```powershell
npm run setup:env
```

#### Paso 3.2: Instalar dependencias

Instala los paquetes fijados en `package-lock.json`:

```powershell
npm ci
```

#### Paso 3.3: Iniciar la base de datos MySQL

Asegúrate de que Docker Desktop esté abierto y corriendo, luego levanta el servicio de base de datos:

```powershell
npm run db:up
```

_(Este comando iniciará el contenedor `mysql:8.4` y esperará a que el healthcheck confirme que está listo para recibir conexiones en el puerto `3306`)._

#### Paso 3.4: Compilar estilos y generar el cliente de Prisma

Genera el cliente Prisma y compila los estilos Tailwind CSS:

```powershell
npm run build
```

#### Paso 3.5: Aplicar migraciones a la base de datos

Aplica el esquema SQL en la base de datos de desarrollo:

```powershell
npm run db:migrate
```

#### Paso 3.6: Cargar datos iniciales de prueba (Seed)

Ejecuta el script [seed.js](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/prisma/seed.js), que crea la empresa ficticia _Cafetería Semilla_, categorías, alimentos, recetas y usuarios de prueba:

```powershell
npm run db:seed
```

#### Paso 3.7: Iniciar el servidor

Inicia la aplicación en modo desarrollo con recarga automática:

```powershell
npm run dev
```

El servidor escuchará en `http://localhost:3000` (puedes verificar su estado en `http://localhost:3000/health` y `http://localhost:3000/ready`).

---

### 4. Guía para Probar el Sistema

Abre tu navegador en `http://localhost:3000`. Tienes dos formas de comenzar:

#### Opción A: Registrar una nueva empresa desde cero

1. Ve a `/auth/register` (o haz clic en _Registrarse_).
2. Completa los datos de la empresa y del usuario administrador.
3. El sistema creará de forma atómica: la empresa, el usuario con rol `ADMIN`, el inventario principal y la sala de chat `General`.

#### Opción B: Usar los usuarios creados por el Seed

El seed crea dos cuentas en _Cafetería Semilla_:

- **Administrador:** `admin@semilla.example`
- **Empleado:** `equipo@semilla.example`

> [!NOTE]
> Por políticas de seguridad, el seed genera contraseñas aleatorias desechadas. Para ingresar con estos usuarios:
>
> 1. Ve a `/auth/forgot` (o _¿Olvidaste tu contraseña?_).
> 2. Ingresa `admin@semilla.example` y envía el formulario.
> 3. La aplicación simula el envío guardando un archivo JSON en la carpeta local `work/outbox/<uuid>.json`.
> 4. Abre ese archivo, copia el enlace de restablecimiento (ej. `http://localhost:3000/auth/reset?token=...`), ábrelo en el navegador y define tu contraseña.

#### Flujos funcionales a verificar:

1. **Dashboard (`/dashboard`):** Observa los 4 indicadores clave (Total de alimentos, Próximos a caducar, Caducados, Stock bajo).
2. **Inventario (`/inventory`):**
   - Agrega un nuevo alimento (`/inventory/new`) especificando nombre, cantidad (admite 3 decimales), unidad (`kg`, `g`, `l`, `ml`, `unidad`), categoría y fechas de ingreso/caducidad.
   - Filtra por nombre, categoría y prueba la paginación (10 registros por página).
   - Edita o elimina un producto (la eliminación exige rol `ADMIN` y confirmación explícita con checkbox y token CSRF).
3. **Alertas de caducidad (`/expiration`):** Verifica la clasificación por semáforo según la zona horaria (`America/Guayaquil`): Caducados, Críticos (0–2 días), Advertencia (3–5 días) y Normal (6+ días).
4. **Recetas y aprovechamiento (`/recipes`):** Revisa las recetas sugeridas que cruzan automáticamente ingredientes con los alimentos utilizables en stock.
5. **Gestión de equipo (`/team`):** Si estás con el usuario `ADMIN`, crea un usuario con rol `EMPLOYEE` para la misma empresa.
6. **Coordinación en tiempo real (`/chat`):**
   - Abre dos ventanas del navegador (una normal y otra en incógnito o con otro navegador).
   - Inicia sesión con el administrador en una y con el empleado en la otra.
   - Entra a `/chat`: comprueba la lista de presencia en vivo, el envío y persistencia de mensajes en la sala _General_.
   - Modifica o crea un alimento en una ventana y observa cómo en la otra ventana aparece de inmediato el aviso visual de cambio de inventario (`inventory:changed`) sin recargar la página.

---

### 5. Ejecución de Pruebas Automatizadas

Si deseas ejecutar la suite completa de pruebas unitarias y de integración:

```powershell
# Levantar el contenedor aislado de base de datos de pruebas (puerto 3307)
docker compose --profile test up -d --wait mysql-test

# Ejecutar pruebas unitarias y de integración
npm test
npm run test:db

# Medición de rendimiento de consultas SQL (con 1000 registros ficticios)
npm run measure:queries
```

---

Para inspeccionar la base de datos, ver las tablas, las relaciones y cómo se almacenan las contraseñas hasheadas y las sesiones, tienes **tres formas principales**:

---

### Opción 1: Con Prisma Studio (La más rápida y visual)

Prisma incluye un visor web interactivo que se conecta directamente a tu base de datos y te permite explorar todas las tablas sin instalar ningún programa adicional:

1. Asegúrate de tener el contenedor de MySQL corriendo (`npm run db:up`).
2. En tu terminal ejecuta:
   ```powershell
   npx prisma studio
   ```
3. Se abrirá automáticamente en tu navegador en `http://localhost:5555`.
4. Verás las 11 entidades del sistema: `Company`, `User`, `Inventory`, `FoodItem`, `Category`, `Recipe`, `RecipeIngredient`, `ChatRoom`, `ChatMessage`, `PasswordResetToken` y `Session`.
5. Si haces clic en la tabla **User**, podrás ver las columnas `id`, `email`, `role`, `sessionVersion` y el campo **`passwordHash`**.

---

### Opción 2: Desde la terminal con el cliente MySQL en Docker

Dado que MySQL se ejecuta dentro de un contenedor Docker ([compose.yaml](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/compose.yaml)), puedes interactuar directamente con la consola de MySQL:

1. **Entrar al cliente interactivo de MySQL:**

   ```powershell
   docker compose exec -it mysql mysql -u root -p
   ```

   _(Te pedirá la contraseña; ingresa el valor de `MYSQL_ROOT_PASSWORD` que se generó en tu archivo `.env`)._

2. **Comandos SQL útiles para inspeccionar:**

   ```sql
   -- Seleccionar la base de datos
   USE food_waste_fighter;

   -- Listar todas las tablas
   SHOW TABLES;

   -- Ver la estructura de la tabla User
   DESCRIBE User;

   -- Ver los usuarios y cómo se almacenan sus contraseñas hasheadas
   SELECT id, name, email, role, passwordHash FROM User;

   -- Ver las sesiones activas en la BD
   SELECT id, userId, expiresAt, data FROM Session;

   -- Salir
   EXIT;
   ```

---

### Opción 3: Con un cliente gráfico externo (DBeaver, MySQL Workbench, TablePlus)

Si prefieres usar tu gestor de base de datos favorito, puedes conectarte con los siguientes parámetros expuestos en tu máquina local:

- **Host:** `127.0.0.1` o `localhost`
- **Puerto:** `3306`
- **Base de datos:** `food_waste_fighter`
- **Usuario:** `fwf_app` (o `root`)
- **Contraseña:** Abre tu archivo `.env` y copia el valor de `MYSQL_PASSWORD` (o `MYSQL_ROOT_PASSWORD`).

---

### ¿Cómo se guardan las contraseñas y tokens en la BD?

En este proyecto se aplican las recomendaciones de OWASP implementadas en [src/modules/auth/passwords.js](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/src/modules/auth/passwords.js) y [schema.prisma](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/prisma/schema.prisma):

1. **Contraseñas de usuario (`User.passwordHash`):**
   - Se utiliza **Argon2id** (diseñado contra ataques con GPUs/ASICs).
   - Parámetros: costo de memoria de 19 MiB (`m=19456`), 2 iteraciones (`t=2`) y 1 hilo de paralelismo (`p=1`).
   - En la base de datos no verás texto plano, sino una cadena con esta estructura:
     ```text
     $argon2id$v=19$m=19456,t=2,p=1$SALT_ALEATORIO_BASE64$HASH_RESULTANTE_BASE64
     ```
2. **Tokens de recuperación de clave (`PasswordResetToken.tokenHash`):**
   - El token que viaja en el enlace al usuario no se almacena en plano.
   - En la columna `tokenHash` (`CHAR(64)`) solo se almacena su hash criptográfico **SHA-256** de 64 caracteres hexadecimales.
3. **Sesiones (`Session.data`):**
   - Las sesiones web se almacenan en la columna `data` en formato **JSON** nativo de MySQL, conteniendo la información de autenticación (`userId`, `companyId`, `role` y token CSRF).
