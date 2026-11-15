# Alcance del segundo bimestre

Referencia de evolución según la guía oficial; no describe funcionalidades
implementadas en el monolito del primer bimestre. Se conservan registro, login,
recuperación, CRUD y chat durante la transición.

| Requisito obligatorio | Aplicación prevista |
| --- | --- |
| Frontend desacoplado | Aplicación independiente, por ejemplo React, que consuma HTTP/WebSocket; componentes reutilizables, estado, routing cliente, carga/error, validación, responsive y accesibilidad. |
| Modelo de servicios | Capacidades de autenticación/usuarios, inventario y chat; contratos OpenAPI u otro formato, composición de dos o más servicios y al menos tres principios aplicados: bajo acoplamiento, contrato estandarizado y autonomía. |
| Tres microservicios independientes como mínimo | Código, proceso y despliegue propios por servicio. |
| Entrada única | API Gateway o proxy inverso que enrute HTTP y WebSocket. |
| Base por servicio | Instancia o esquema propio, sin consultas a bases ajenas; datos compartidos por API/eventos y análisis del refactoring, duplicación y consistencia. |
| Comunicación síncrona | REST/HTTP entre servicios con contratos y errores definidos. |
| Patrones | Al menos dos patrones; al menos uno distinto de API Gateway y Database per Service. Se documentarán problema y ubicación en código; pueden aplicarse Circuit Breaker y Strangler Fig. |
| Seguridad JWT | Emisión en autenticación, validación en gateway/servicios, dos roles como mínimo y chat autenticado con token; control de firma, audiencia, expiración y revocación. |
| Contenedores | Dockerfile por componente y Compose para levantar el sistema con un comando. |
| Observabilidad | Logs estructurados y health por servicio; herramienta demostrada con al menos dos métricas o consultas de logs/trazas. |
| CI/CD | Pipeline en push/PR a principal que compile, pruebe y construya imágenes; despliegue automático opcional. |
| Rendimiento de frontend | Informe de rendimiento y al menos una optimización aplicada. |

La migración de datos será aditiva y verificable, con contratos de identidad y
empresa entre servicios. Se mantendrán los casos de aislamiento y revocación.
Las operaciones entre bases requieren consistencia explícita; no se sustituye
una transacción local por una supuesta transacción Prisma distribuida.

Son opcionales Kubernetes, OAuth 2.0/OpenID Connect, despliegue continuo a nube
y mensajería asíncrona. La seguridad JWT es obligatoria y no se reemplaza por
la elección opcional de OAuth/OIDC. Presencia/límites compartidos y entrega de
eventos deberán verificarse si se ejecutan varias réplicas.

La presentación incluirá arquitectura anterior/nueva, contratos y composición,
refactoring de datos, patrones, seguridad, contenedores, observabilidad,
pipeline y ejecución extremo a extremo. Se mantendrán el repositorio público,
los aportes auténticos y la declaración de IA; la entrega se etiquetará v2.0-b2.
