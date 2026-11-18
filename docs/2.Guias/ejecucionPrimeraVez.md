# Guía de Inicialización y Primera Ejecución

Esta guía detalla los pasos para configurar, inicializar y probar *Food Waste Fighter — Business Edition* en tu entorno local (Windows) o en GitHub Codespaces, incluyendo la arquitectura del nuevo front-end.

---

## 1. Resumen del Contexto del Proyecto

* **Propósito:** Sistema web para cafeterías y pequeños restaurantes para gestionar inventario con precisión, prevenir el desperdicio con alertas de caducidad, aprovechar existencias con recetas y coordinar al personal en tiempo real.
* **Arquitectura:** Monolito en **Node.js 24 + Express 5** con vistas server-side en **EJS** y un sistema de diseño propio (CSS modular y JavaScript nativo en `src/public/fwf/`, con Three.js r128 y Motion 11 servidos localmente).
* **Persistencia:** **MySQL 8.4** mediante **Prisma ORM** (`@prisma/adapter-mariadb`). Las sesiones de usuario (`express-session`) se guardan directamente en MySQL (`PrismaSessionStore`).
* **Tiempo Real:** **Socket.IO 4** integrado en el mismo proceso para el chat del equipo (burbuja flotante y sala *General*) y avisos de inventario en vivo sin recargar la página.
* **Seguridad:** Hashing con **Argon2id**, protección CSRF vinculada a sesión, cabeceras seguras con Helmet (CSP estricta en `'self'`, ampliando solo `img-src` con `https:` para fotos opcionales de producto), validación estricta con **Zod** y aislamiento estricto por empresa (*multi-tenant* lógico).
* **Entorno principal:** Diseñado para **GitHub Codespaces** o desarrollo local con Docker Compose ([compose.yaml](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/compose.yaml)).

---

## 2. Requisitos Previos en tu Equipo (Windows)

1. **Node.js 24**: Requiere Node.js 24.x (`node -v`).
2. **Docker Desktop**: Debe estar abierto y con el motor de Docker iniciado para que el contenedor de MySQL pueda ejecutarse.

---

## 3. Paso a Paso para Inicializar el Proyecto

Ejecuta los siguientes comandos desde tu terminal (PowerShell) en la raíz del proyecto:

### Paso 3.1: Generar el archivo de entorno `.env`
Crea el archivo `.env` a partir de [.env.example](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/.env.example) con contraseñas y secretos criptográficos aleatorios generados automáticamente:
```powershell
npm run setup:env
```

### Paso 3.2: Instalar dependencias
Instala los paquetes fijados en `package-lock.json` (incluyendo Three.js, Motion y tipografías):
```powershell
npm install
# o en despliegues automatizados: npm ci
```

### Paso 3.3: Iniciar la base de datos MySQL
Asegúrate de que Docker Desktop esté corriendo, luego levanta el servicio de base de datos:
```powershell
npm run db:up
```
*(Inicia el contenedor `mysql:8.4` y espera con `--wait` a que el healthcheck confirme que está listo para recibir conexiones en el puerto `3306`).*

### Paso 3.4: Compilar estilos y generar el cliente de Prisma
Genera el cliente Prisma actualizado y compila los estilos base:
```powershell
npm run build
```

### Paso 3.5: Aplicar migraciones a la base de datos
Aplica todas las migraciones SQL acumuladas a la base de datos de desarrollo (incluida la migración `20261115000300_product_image_category_color` que añade `Category.color` y `FoodItem.imageUrl`):
```powershell
npm run db:migrate
```
> [!IMPORTANT]
> Si cambias de rama o incorporas cambios al front-end, ejecutar `npm run db:migrate` es indispensable para evitar errores 500 por columnas faltantes al iniciar sesión o acceder al dashboard.

### Paso 3.6: Cargar datos iniciales de prueba (Seed)
Ejecuta el script [seed.js](file:///d:/levantamientoProyectos/Food-Waste-Fighter-WebAvanzadas/prisma/seed.js), que crea de forma idempotente la empresa ficticia *Cafetería Semilla*, categorías con color, alimentos en inventario, recetas y usuarios de prueba:
```powershell
npm run db:seed
```

El seed también incorpora el catálogo inicial a las empresas existentes. Puedes
volver a ejecutarlo y consultar las recetas en `/recipes` tras iniciar sesión.
Las empresas nuevas reciben el catálogo al registrarse.

### Paso 3.7: Iniciar el servidor de desarrollo
Inicia la aplicación en modo desarrollo con recarga automática:
```powershell
npm run dev
```
El servidor escuchará en `http://localhost:3000` (`/health` comprueba HTTP y `/ready` comprueba MySQL).

---

## 4. Guía para Probar el Sistema y la Nueva Interfaz

Abre tu navegador en `http://localhost:3000`.

### Acceso Inicial:
* **Opción A (Empresa Nueva):** Haz clic en *Comenzar gratis* o ve a `/auth/register` para registrar una nueva empresa y administrador.
* **Opción B (Usuarios del Seed):**
  * Administrador: `admin@semilla.example`
  * Empleado: `equipo@semilla.example`
  * Si necesitas definir una contraseña para las cuentas semilla:
    1. Ve a `/auth/forgot`.
    2. Ingresa `admin@semilla.example`.
    3. Abre el archivo JSON generado en la carpeta local `work/outbox/<uuid>.json`.
    4. Copia el enlace de recuperación y ábrelo en el navegador para establecer tu clave.

### Flujos y Componentes de la Nueva Interfaz:
1. **Portada (`/`):**
   * Cuenta con un modelo 3D interactivo de una refrigeradora renderizado con **Three.js**.
   * Al hacer clic en la refrigeradora o en "Toca la refri", se abren las puertas con una animación fluida (**Motion**) y navega hacia el resumen del negocio.
2. **Acceso Centrado (`/auth/login`, `/auth/register`):**
   * Las vistas de acceso se presentan como una tarjeta de vidrio centrada sobre la portada quieta, preservando el formulario nativo con validación y CSRF.
3. **Resumen / Dashboard (`/dashboard`):**
   * Muestra la refrigeradora cerrada con los 4 indicadores clave (Total, Próximos a caducar, Caducados y Stock bajo).
   * Alertas de caducidad con fotos predictivas de respaldo (leche, yogur, carne, vegetales) y recetas sugeridas basadas en stock útil.
   * Al hacer clic en una alerta, navega a la refrigeradora con ese producto seleccionado automáticamente.
4. **Refrigeradora Interactiva (`/inventory`):**
   * Representa el inventario como estantes físicos donde los productos se ubican ordenados por fecha de vencimiento más próxima.
   * Filtros dinámicos por categorías con pastillas de color asignadas (`Category.color`).
   * Al seleccionar un producto se abre el panel lateral con su ficha técnica, fechas e imagen (si tiene `imageUrl` o foto local).
   * Botón para alternar a la vista tabular de caducidades (`/inventory/caducidad`).
5. **Tarjetas Superpuestas (`<dialog>`):**
   * Registrar alimento (`/inventory/new`), editar (`/inventory/:id/edit`), eliminar (`/inventory/:id/delete`), administrar categorías (`/categories`), gestionar equipo (`/team`) y cuenta (`/account`) se abren en tarjetas modales nativas superpuestas sin perder el contexto visual.
   * Tienen foco atrapado, se cierran con la tecla `Escape` o la `X`, y refrescan automáticamente la vista inferior si hubo cambios.
   * *Degradación elegante:* Si un usuario navega sin JavaScript, las acciones cargan como páginas completas tradicionales.
6. **Burbuja de Chat en Tiempo Real:**
   * Botón flotante siempre disponible en la esquina inferior para abrir el chat del personal conectado a Socket.IO.
   * Permite probar presencia en vivo entre dos usuarios simultáneos y muestra alertas de cambios de inventario sin recargar.

---

## 5. Ejecución de Pruebas Automatizadas

Si deseas ejecutar la suite completa de pruebas:

```powershell
# 1. Pruebas unitarias, de integración ligera, páginas del front y assets (115 pruebas)
npm test

# 2. Pruebas de integración con base de datos MySQL separada
docker compose --profile test up -d --wait mysql-test
npm run test:db

# 3. Medición de rendimiento en consultas SQL con 1000 registros
npm run measure:queries

# 4. Verificación de accesibilidad con axe-core y navegador (40 escaneos)
npm run verify:browser
```

---

## 6. Inspección de la Base de Datos

* **Prisma Studio (visor web):**
  ```powershell
  npx prisma studio
  ```
  Disponible en `http://localhost:5555`. Permite explorar las tablas `Category` (incluyendo `color`) y `FoodItem` (incluyendo `imageUrl`), contraseñas hasheadas en Argon2id y sesiones activas.
* **Línea de comandos de MySQL en Docker:**
  ```powershell
  docker compose exec -it mysql mysql -u root -p food_waste_fighter
  # Ingresar la contraseña MYSQL_ROOT_PASSWORD del archivo .env
  ```
