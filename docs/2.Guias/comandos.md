# 🗄️ Guía de Comandos y Consultas de Base de Datos (MySQL + Prisma)

### **Food Waste Fighter — Business Edition**

Esta guía reúne los comandos esenciales para conectarse a la base de datos MySQL, explorar su estructura, ejecutar consultas SQL clave del negocio y entender el almacenamiento de datos sensibles (como contraseñas con Argon2id).

---

## 1. 🚀 Métodos de Acceso a la Base de Datos

### Opción A: Prisma Studio (Recomendado — Interfaz Visual)

Prisma incluye un explorador gráfico web interactivo donde puedes ver tablas, relaciones, editar registros y aplicar filtros sin escribir SQL:

```sh
npx prisma studio
```

> Se abrirá automáticamente en tu navegador en `http://localhost:5555`.

---

### Opción B: Consola interactiva MySQL (Recomendado para evitar problemas de comillas)

La forma más cómoda es entrar a la consola interactiva de MySQL dentro del contenedor. De esa manera puedes escribir comandos SQL normalmente con punto y coma:

```powershell
# En PowerShell o Bash:
docker compose exec mysql bash -c 'mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE'
```

## Siguiente

docker compose exec mysql bash

# Y adentro ejecutas:

mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE

---

O si prefieres primero entrar al contenedor:

```powershell
docker compose exec mysql bash

# Y una vez dentro del contenedor (en Linux bash):
mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE
```

Para salir de la consola MySQL escribe `exit;`.

---

### Opción C: Ejecutar una consulta directa en una sola línea

> ⚠️ **Atención con PowerShell (Windows):** PowerShell elimina las comillas dobles internas a menos que las escapes con barra invertida `\"`.

**En PowerShell (Windows):**

```powershell
docker compose exec mysql bash -c 'mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE -e \"SHOW TABLES;\"'
```

**En Linux / Bash / Codespaces:**

```sh
docker compose exec mysql bash -c 'mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE -e "SHOW TABLES;"'
```

---

## 2. 🔍 Inspección de la Estructura de la Base de Datos

Una vez dentro de la consola de MySQL (o pasando el comando con `-e`):

### Ver todas las tablas existentes

```sql
SHOW TABLES;
```

_Tablas del sistema:_

- `Company` — Empresas (aislamiento multi-tenant).
- `User` — Usuarios, roles (`ADMIN`, `EMPLOYEE`) y credenciales.
- `Inventory` — Contenedor del inventario por empresa.
- `Category` — Categorías de alimentos (con color HEX para estantes).
- `FoodItem` — Alimentos/productos (fechas, stock, imagen HTTPS).
- `Recipe` — Recetas del restaurante.
- `RecipeIngredient` — Ingredientes de cada receta.
- `ChatRoom` — Salas de chat por empresa.
- `ChatMessage` — Mensajes enviados en el chat.
- `Session` — Sesiones activas almacenadas en BD.
- `PasswordResetToken` — Tokens de recuperación de contraseña.
- `_prisma_migrations` — Historial de migraciones aplicadas.

---

### Ver columnas y tipos de datos de una tabla

```sql
-- Estructura de usuarios
DESCRIBE User;

-- Estructura de productos / alimentos
DESCRIBE FoodItem;

-- Estructura de categorías
DESCRIBE Category;

-- Estructura de recetas
DESCRIBE Recipe;
```

---

### Ver llaves foráneas, restricciones e índices creados

```sql
-- Muestra el SQL exacto con índices y FKs
SHOW CREATE TABLE User\G
SHOW CREATE TABLE FoodItem\G
SHOW CREATE TABLE Category\G
```

---

## 3. 📊 Consultas SQL Útiles y de Negocio

### 🔑 3.1. Usuarios y Contraseñas Hasheadas (Argon2id)

Verifica cómo se almacenan las cuentas y el hash criptográfico seguro:

```sql
SELECT
    id,
    companyId,
    name,
    email,
    role,
    passwordHash,
    createdAt
FROM User;
```

> **Nota de seguridad:** Las contraseñas comienzan con `$argon2id$v=19$m=65536,t=3,p=4$...`. Nunca se guardan en texto plano; incluyen salt y parámetros de memoria resistentes a ataques de fuerza bruta.

---

### 🏢 3.2. Empresas registradas (Multi-tenant)

```sql
SELECT id, name, description, createdAt FROM Company;
```

---

### 📦 3.3. Inventario general con categoría y colores

```sql
SELECT
    f.id,
    f.name AS producto,
    f.quantity AS cantidad,
    f.unit AS unidad,
    c.name AS categoria,
    c.color AS color_hex,
    f.receivedDate AS recibido,
    f.expiresDate AS caducidad,
    f.imageUrl
FROM FoodItem f
JOIN Category c ON f.categoryId = c.id
ORDER BY f.expiresDate ASC;
```

---

### ⚠️ 3.4. Alertas de caducidad (Semáforo de criticidad)

Calcula cuántos días faltan para que caduque cada producto:

```sql
SELECT
    name AS producto,
    quantity AS cantidad,
    unit AS unidad,
    expiresDate AS fecha_caducidad,
    DATEDIFF(expiresDate, CURDATE()) AS dias_restantes,
    CASE
        WHEN DATEDIFF(expiresDate, CURDATE()) < 0 THEN '🔴 CADUCADO'
        WHEN DATEDIFF(expiresDate, CURDATE()) BETWEEN 0 AND 2 THEN '🚨 CRÍTICO (0-2 días)'
        WHEN DATEDIFF(expiresDate, CURDATE()) BETWEEN 3 AND 5 THEN '⚠️ ADVERTENCIA (3-5 días)'
        ELSE '🟢 NORMAL (>=6 días)'
    END AS estado_caducidad
FROM FoodItem
ORDER BY dias_restantes ASC;
```

---

### 🍽️ 3.5. Recetas y sus ingredientes

```sql
SELECT
    r.name AS receta,
    r.description AS descripcion,
    ri.name AS ingrediente,
    ri.quantity AS cantidad_requerida,
    ri.unit AS unidad
FROM Recipe r
JOIN RecipeIngredient ri ON r.id = ri.recipeId
ORDER BY r.name, ri.name;
```

---

### 💬 3.6. Mensajes de Chat en tiempo real

```sql
SELECT
    cr.name AS sala,
    u.name AS autor,
    u.role AS rol,
    cm.content AS mensaje,
    cm.createdAt AS fecha_envio
FROM ChatMessage cm
JOIN User u ON cm.userId = u.id
JOIN ChatRoom cr ON cm.roomId = cr.id
ORDER BY cm.createdAt DESC
LIMIT 20;
```

---

### 🛡️ 3.7. Sesiones activas y tokens de recuperación

```sql
-- Sesiones activas de usuarios
SELECT id, userId, expiresAt FROM Session ORDER BY expiresAt DESC;

-- Tokens de recuperación de contraseña generados
SELECT id, userId, tokenHash, expiresAt, consumedAt FROM PasswordResetToken;
```

---

## 4. ⚙️ Comandos de Mantenimiento y Ciclo de Vida (NPM / Prisma)

| Comando                  | Función                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `npm run db:up`          | Levanta el contenedor de MySQL en Docker con su volumen persistente.                                       |
| `npm run db:migrate`     | Aplica todas las migraciones SQL pendientes sin borrar datos (`prisma migrate deploy`).                    |
| `npm run db:migrate:dev` | Crea una nueva migración en desarrollo si modificas `schema.prisma`.                                       |
| `npm run db:seed`        | Inserta los datos iniciales de prueba (Cafetería Semilla, categorías, alimentos, recetas). Es idempotente. |
| `npm run db:validate`    | Valida que el archivo `schema.prisma` no tenga errores de sintaxis o relaciones rotas.                     |
| `npm run test:db`        | Ejecuta las pruebas automatizadas de base de datos en el contenedor de pruebas aislado.                    |

---

## 5. ⚠️ Aspectos Críticos a Tener en Cuenta (Reglas de Oro)

1. **Aislamiento Multi-tenant:**
   - La base de datos alberga múltiples empresas en una misma instancia.
   - Cada consulta de modificación (`UPDATE`, `DELETE`) en el backend **debe incluir siempre `companyId`** mediante las claves compuestas `@@unique([id, companyId])`.
2. **Volumen Docker persistente (`mysql_data`):**
   - Los datos se guardan en el volumen de Docker. Si detienes los contenedores con `docker compose down`, los datos **se conservan**.
   - Solo se eliminan si usas la bandera destructiva `docker compose down -v` (con volumen).
3. **Cuentas Semilla (`Seed`):**
   - El seed crea `admin@semilla.example` y `equipo@semilla.example`.
   - Por seguridad, sus contraseñas aleatorias se descartan. Para ingresar, se solicita restablecimiento en `/auth/forgot` y se lee el enlace en los archivos JSON de `work/outbox/`.
4. **Columnas añadidas en el rediseño:**
   - `Category.color`: Cadena `VARCHAR(7)` con formato Hexadecimal (`#RRGGBB`) para colorear los estantes del frigorífico.
   - `FoodItem.imageUrl`: Cadena `VARCHAR(500)` opcional con URL HTTPS de la fotografía predictiva del alimento.
