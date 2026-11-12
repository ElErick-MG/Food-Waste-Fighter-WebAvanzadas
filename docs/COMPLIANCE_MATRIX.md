# Rúbrica y cumplimiento del primer bimestre

Fuente: **Guía del Proyecto AppWebAv.docx**, sección «Evaluación → Primer
bimestre (sobre 20 puntos)». El proyecto representa el 30 % de cada aporte,
según la guía. Los pesos y máximos siguientes corresponden a la tabla oficial;
se indican evidencias disponibles y pendientes, no calificaciones obtenidas.

| Criterio oficial | Peso | Máximo | Referencia y estado |
| --- | ---: | ---: | --- |
| Planteamiento del problema, objetivos y cronograma | 5 % | 1,0 | [PROJECT_SPEC.md](PROJECT_SPEC.md): problema, objetivos medibles y semanas propuestas. [README](../README.md): roles; nombres y aportes por completar. |
| Requerimientos funcionales o historias de usuario | 7,5 % | 1,5 | [PROJECT_SPEC.md](PROJECT_SPEC.md): HU01–HU12 priorizadas, coherentes con las rutas implementadas. |
| Diagrama de arquitectura | 5 % | 1,0 | [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md): capas del monolito, MySQL, sesiones y servidor Socket.IO compartido. |
| Registro (SignUp) y recuperación de clave (reset/forgot) | 10 % | 2,0 | Registro, validación cliente/servidor, hash de token, caducidad y consumo único. `tests/auth.integration.test.js`. |
| Inicio de sesión (SignIn) y seguridad | 10 % | 2,0 | Argon2id, sesiones MySQL, cookies seguras, rutas/roles/empresas protegidos y CSRF. `tests/auth.integration.test.js`. |
| Pantalla principal con operaciones CRUD | 15 % | 3,0 | Dashboard; alta, búsqueda/categoría, ID, edición, borrado confirmado y paginación. `tests/business.integration.test.js`. |
| Chat que use WebSockets | 12,5 % | 2,5 | Socket.IO propio, autenticación, dos usuarios, historial, presencia y aviso adicional. `tests/chat.integration.test.js` y verificación de navegador. |
| Guarda datos en una base de datos (relacional o NoSQL) | 7,5 % | 1,5 | MySQL/Prisma, esquema y ER, claves compuestas e índices. [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md) y `tests/database.integration.test.js`. |
| Calidad: pruebas, README y rendimiento | 7,5 % | 1,5 | 106 pruebas registradas, ejecución y .env.example; medición de consultas y 40 escaneos. [VALIDATION.md](VALIDATION.md). |
| Link de repositorio público con commits de todos los integrantes | 5 % | 1,0 | Repositorio público en README. Pendientes: aportes/commits reales de todos y etiqueta v1.0-b1; no se publican secretos ni datos personales reales. |
| Presentación en grupo, defensa y evidencias subidas a la plataforma | 15 % | 3,0 | [DELIVERY.md](DELIVERY.md): contenido, demo y participación. Pendientes: exposición de todos, respuestas individuales, presentación y entrega de evidencias. |
| **Total** | **100 %** | **20,0** | La evaluación corresponde al docente. |

## Cobertura funcional y no funcional

| Requisito de la guía | Comprobación disponible |
| --- | --- |
| PYME realista, 4–5 integrantes y entidad principal con al menos 5 atributos | Cafetería/restaurante; estructura del equipo en README; FoodItem con siete atributos de negocio. |
| Vistas, routing, negocio, persistencia y WebSocket en un proyecto desplegable | Express/EJS/Prisma/Socket.IO en el mismo proceso; arquitectura documentada. |
| Validación en cliente/servidor y mensajes claros | HTML5/JavaScript y Zod; casos positivos y negativos de cuentas/inventario/chat. |
| Inyección, XSS, CSRF, secretos y wss | Consultas parametrizadas, escape/textContent, token CSRF, entorno privado y comprobación HTTPS/wss local. La evidencia detallada de Codespaces se adjunta a la entrega. |
| Menú, búsqueda, paginación, índices y chat sin recarga | Rutas protegidas y contratos documentados; suites business/chat y medición real. |
| Persistencia y esquema documentado | Once modelos Prisma, ER, migraciones y pruebas en MySQL independiente. |
| Cinco pruebas automatizadas relevantes como mínimo | Registro/duplicado/login/reset, CRUD/búsqueda/páginas, sockets/aislamiento/historial y seguridad de automatización. |
| README: problema, stack, ejecución, entorno, diagramas, equipo e IA | README y referencias técnicas/académicas enlazadas. |
| Presentación de 15 minutos y 5 de preguntas, demo en vivo y participación individual | Guion y lista de entrega en DELIVERY.md. |
| Repositorio público, commits auténticos, v1.0-b1 y presentación en carpeta del grupo | Pendientes de cierre indicados en DELIVERY.md; el envío no se considera realizado. |

La ejecución en Codespaces es un requisito adicional del proyecto. La evidencia
local HTTP/HTTPS/wss no se presenta como captura del despliegue remoto.
