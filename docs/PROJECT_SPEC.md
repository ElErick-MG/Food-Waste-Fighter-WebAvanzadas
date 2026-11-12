# Alcance y requisitos del proyecto

## Contexto y objetivos

Food Waste Fighter — Business Edition se dirige a una cafetería o restaurante
pequeño. El desconocimiento del inventario, la caducidad de alimentos y la falta
de coordinación dificultan el aprovechamiento de existencias. Se utilizan datos
ficticios; no se han medido pérdidas ni ahorros económicos reales.

**Objetivo general:** proporcionar una aplicación web que permita gestionar
alimentos, identificar su caducidad, consultar recetas y coordinar al personal
con persistencia y separación de datos entre empresas.

| Objetivo específico | Criterio de comprobación |
| --- | --- |
| Proteger el acceso | Registro, login y logout contra MySQL; Argon2id; recuperación con token de un uso y 30 minutos; rutas y roles protegidos. |
| Gestionar alimentos con precisión | Crear, consultar, editar y eliminar con confirmación; cantidades de tres decimales y fechas válidas. |
| Facilitar la consulta | Búsqueda por nombre/categoría, páginas de 10 registros y medición de consultas con 1000 alimentos ficticios. |
| Priorizar existencias | Cuatro métricas: total, próximos a caducar, caducados y stock bajo; límites de días comprobados. |
| Coordinar al equipo | Dos usuarios simultáneos, historial persistido, presencia y aviso de inventario sin recarga. |
| Aislar empresas | Rechazo de identificadores, categorías, salas, cursores e identidad ajenos en HTTP y Socket.IO. |

## Alcance del primer bimestre

Se implementa un monolito: vistas EJS, enrutamiento, lógica, persistencia y
Socket.IO forman un único proyecto y proceso Node.js. MySQL se ejecuta como
dependencia de base de datos en Docker Compose. El entorno de desarrollo es
GitHub Codespaces; el equipo local solo requiere navegador.

Stack: Node.js 24, Express 5, EJS, HTML5, Tailwind CSS, JavaScript, MySQL 8.4,
Prisma 7.10.1, Socket.IO 4, express-session con almacén MySQL, Argon2id, Zod,
Helmet, Vitest/Supertest y Playwright/axe para verificación.

La entidad principal es FoodItem y contiene siete atributos de negocio: nombre,
cantidad, unidad, categoría, fecha de ingreso, fecha de caducidad y stock mínimo.
Los modelos, permisos y contratos se describen en [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md).

## Historias de usuario priorizadas

| ID | Prioridad | Historia y aceptación |
| --- | --- | --- |
| HU01 | Obligatoria | Como responsable, se requiere registrar el negocio: se crean ADMIN, inventario y sala General de forma atómica; correo único y datos validados. |
| HU02 | Obligatoria | Como usuario, se requiere iniciar/cerrar sesión: se verifica el hash, se rota la sesión y se protegen las rutas. |
| HU03 | Obligatoria | Como usuario sin acceso, se requiere recuperar la clave: enlace privado, token con caducidad, consumo único y revocación de sesiones. |
| HU04 | Obligatoria | Como ADMIN, se requiere incorporar empleados: altas solo dentro de la empresa autenticada. |
| HU05 | Obligatoria | Como empleado, se requiere registrar y actualizar alimentos: categoría autorizada, decimales exactos y fechas ordenadas. |
| HU06 | Obligatoria | Como ADMIN, se requiere eliminar un alimento: confirmación explícita, POST y CSRF; GET no elimina. |
| HU07 | Obligatoria | Como empleado, se requiere buscar y consultar alimentos: filtros por nombre/categoría, detalle por ID y paginación SQL. |
| HU08 | Obligatoria | Como responsable, se requiere consultar alertas: dashboard, caducidad y stock bajo limitados a la empresa. |
| HU09 | Obligatoria | Como empleado, se requiere consultar recetas: ingredientes, pasos y coincidencias con existencias utilizables. |
| HU10 | Obligatoria | Como empleado, se requiere coordinar con otra persona: chat autenticado, General, historial, presencia y mensajes en vivo. |
| HU11 | Obligatoria | Como usuario conectado, se requiere conocer cambios de inventario: aviso sin recarga y aislamiento entre empresas. |
| HU12 | Obligatoria | Como equipo, se requiere ejecutar, probar y demostrar la aplicación desde Codespaces con instrucciones reproducibles. |

Se incluyen validación HTML5/JavaScript y Zod, errores claros, navegación
coherente, consultas parametrizadas, escape de contenido, CSRF, cookies seguras,
índices, paginación y al menos cinco pruebas automatizadas relevantes. El chat
utiliza un servidor propio y conexión wss en el despliegue HTTPS.

No se incluyen editor de recetas, contabilidad de movimientos, nutrición
verificada ni cálculo de ahorro real. Frontend desacoplado y microservicios
corresponden al [segundo bimestre](second-bimester-roadmap.md).

## Plan de actividades y equipo

Cronograma propuesto en semanas relativas; las fechas se completan según el
calendario académico.

| Semana | Actividad | Entregable |
| --- | --- | --- |
| S1 | Alcance y entorno | Requisitos, estructura del monolito y MySQL operativo. |
| S2 | Modelo y seguridad | Esquema, registro, sesión y recuperación. |
| S3 | Funcionalidad de negocio | Inventario, dashboard, categorías, recetas y alertas. |
| S4 | Comunicación | Chat, historial, presencia y notificaciones. |
| S5 | Calidad y documentación | Regresión, accesibilidad, rendimiento y referencias. |
| S6 | Preparación de entrega | Datos reales del equipo, evidencias, ensayo y exposición. |

Las responsabilidades y aportes por completar se mantienen en el [README](../README.md).
La presentación y los requisitos de entrega se describen en [DELIVERY.md](DELIVERY.md).
La correspondencia con la guía oficial se encuentra en [COMPLIANCE_MATRIX.md](COMPLIANCE_MATRIX.md).
