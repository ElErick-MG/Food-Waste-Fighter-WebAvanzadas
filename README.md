# 🥦 Food Waste Fighter — Business Edition

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7.10-2D3748?logo=prisma&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-115_pruebas-6E9F18?logo=vitest&logoColor=white)

**Plataforma web para restaurantes y cafeterías pequeñas: reduce el desperdicio alimentario con inventario inteligente, alertas de caducidad y coordinación del equipo en tiempo real.**

[📖 Documentación](#-documentación) · [🚀 Inicio rápido](#-inicio-rápido-codespaces) · [🗂️ Vistas](#️-vistas-principales) · [🧪 Pruebas](#-pruebas-y-verificación)

</div>

---

## ✨ Características principales

- 🧊 **Frigorífico 3D interactivo** — landing page con WebGL (Three.js r128) y animaciones fluidas (Motion 11)
- ⚠️ **Alertas de caducidad en tiempo real** — dashboard con KPIs, fotos predictivas y semáforo de criticidad
- 📦 **Inventario visual por estantes** — vista de nevera abierta, categorías con color, panel de detalle lateral
- 💬 **Chat de equipo con Socket.IO** — mensajes persistentes, presencia y avisos de inventario sin recarga
- 🍽️ **Consulta de recetas** — coincidencias automáticas con el stock disponible
- 🔒 **Multi-tenant seguro** — cada empresa aislada, Argon2id, sesiones persistentes, Helmet/CSP

---

## 🏗️ Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Servidor** | Node.js 24 · Express 5 · EJS (SSR, sin SPA) |
| **Base de datos** | MySQL 8.4 · Prisma 7.10.1 |
| **Tiempo real** | Socket.IO 4 |
| **Front-end** | CSS propio (`src/public/fwf/css/`) · Three.js r128 · Motion 11 · JS nativo |
| **Seguridad** | Argon2id · express-session (MySQL store) · Zod · Helmet |
| **Pruebas** | Vitest + Supertest (115 pruebas) · Playwright + axe-core |
| **Infraestructura** | GitHub Codespaces · Docker Compose · devcontainer |

---

## 🚀 Inicio rápido (Codespaces)

Abre el repositorio con **Code → Codespaces → Create codespace**. El devcontainer incluye Node.js 24 y Docker-in-Docker.

```sh
npm run setup:env   # genera .env con secretos aleatorios
npm ci              # instala dependencias
npm run build       # compila assets
npm run db:up       # levanta MySQL en Docker
npm run db:migrate  # aplica migraciones
npm run db:seed     # datos de ejemplo
npm run dev         # servidor en http://localhost:3000
```

> El puerto 3000 se expone desde la pestaña **Ports** (visibilidad privada).  
> `/health` → estado HTTP · `/ready` → estado MySQL

---

## 🗂️ Vistas principales

| Ruta | Vista | Descripción |
|------|-------|-------------|
| `/` | Portada 3D | Frigorífico WebGL · modales de login/registro |
| `/dashboard` | Panel cerrado | 4 KPIs · alertas · fotos de productos próximos a caducar |
| `/inventory` | Frigorífico abierto | Estantes por categoría · panel lateral de detalle · CRUD |
| `/inventory/caducidad` | Tabla de caducidad | Vista tabular con semáforo de criticidad |
| `/recipes` | Recetas | Ingredientes, preparación y coincidencias con el stock |
| `/chat` | Chat del equipo | Mensajes en tiempo real con Socket.IO |

---

## 🔑 Acceso y seed

Al **registrarse** se crea automáticamente una nueva empresa, una cuenta ADMIN, un inventario y la sala de chat General.

Para usar las **cuentas del seed** (`admin@semilla.example` / `equipo@semilla.example`):
1. Ve a `/auth/forgot` y solicita el enlace de restablecimiento.
2. Abre `work/outbox/` en el editor — ahí está el "correo" simulado.
3. Sigue el enlace para definir tu contraseña (caduca en 30 min, un solo uso).

> El seed es idempotente y conserva las contraseñas existentes. `work/outbox/` no se publica ni se sirve por HTTP.

---

## 🧪 Pruebas y verificación

```sh
npm run build
npm run db:validate
docker compose --profile test up -d --wait mysql-test
npm test                      # 115 pruebas unitarias/integración
npm run test:db               # pruebas de base de datos
npx playwright install --with-deps chromium   # solo la primera vez
npm run verify:browser        # pruebas E2E + accesibilidad axe
npm run measure:queries       # métricas de rendimiento
```

Resultados de referencia y evidencias → [VALIDATION.md](docs/5.Calidad-Y-Validacion/VALIDATION.md)

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [📋 Índice general](docs/README.md) | Mapa de toda la carpeta `docs/` |
| [🌍 Contexto del proyecto](docs/1.Estado/contextoProyecto.md) | Qué es, cómo funciona, estado actual |
| [📈 Estado y pendientes](docs/1.Estado/PROGRESS.md) | Avance detallado por tarea |
| [🛠️ Guía de ejecución](docs/2.Guias/ejecucionPrimeraVez.md) | Paso a paso para levantar el proyecto |
| [🗄️ Guía de BD y comandos](docs/2.Guias/comandos.md) | Métodos de acceso, consultas SQL y estructura |
| [📝 Especificaciones](docs/3.Especificaciones/PROJECT_SPEC.md) | Objetivos, historias de usuario y cronograma |
| [🏛️ Referencia técnica](docs/4.Arquitectura/TECHNICAL_REFERENCE.md) | Arquitectura, modelo, permisos, seguridad, eventos |
| [✅ Validación y calidad](docs/5.Calidad-Y-Validacion/VALIDATION.md) | Pruebas, accesibilidad y rendimiento |
| [📊 Matriz de rúbrica](docs/6.Evaluacion-Y-Entrega/COMPLIANCE_MATRIX.md) | Requisitos académicos y evidencias |
| [🎓 Guía de entrega](docs/6.Evaluacion-Y-Entrega/DELIVERY.md) | Presentación y entrega final |
| [🗺️ Roadmap 2.º bimestre](docs/3.Especificaciones/second-bimester-roadmap.md) | Funcionalidades planificadas |

---

## 👥 Integrantes y roles

Periodo: `2026B` · Docente: `Velepucha Victor ` · Equipo: `1`

| Integrante | Responsabilidad |
|------------|-----------------|
| Kevin Llugcha | Coordinación, requisitos y documentación |
| Eduardo Arcos | Modelo, autenticación y seguridad |
| Jhonathan Pulig | Inventario, recetas e interfaz |
| Claudio Peñaherrera | Chat, sesiones y aislamiento |
| Erick Alpusig | Pruebas, rendimiento y demostración |

---

## 🤖 Uso de IA y atribución

Se utilizó Google Antigravity (Gemini) y OpenAI Codex como apoyo en auditoría, implementación, adaptación de plantillas, pruebas y documentación. El equipo revisa, prueba, comprende y puede explicar o modificar el contenido durante la defensa.

El HTML/JSP/CSS original procede de `Food_Waste_Fighter-main.zip`, aportado como base del proyecto. La tipografía Plus Jakarta Sans se distribuye mediante `@fontsource/plus-jakarta-sans` bajo SIL Open Font License.

> Los datos personales, secretos, tokens, `.env` y la bandeja privada (`work/outbox/`) quedan fuera del repositorio y de las evidencias públicas.
