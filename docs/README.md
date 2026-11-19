# Índice General de Documentación — Food Waste Fighter Business Edition

Este directorio centraliza toda la documentación académica, técnica y operativa del proyecto, organizada de forma temática y secuencial.

---

## Estructura de Carpetas

```text
docs/
├── 1.Estado/                 # Visión integral, progreso y reglas para agentes
│   ├── contextoProyecto.md
│   ├── PROGRESS.md
│   └── AGENTS.md
├── 2.Guias/                  # Guías prácticas paso a paso para desarrolladores
│   ├── ejecucionPrimeraVez.md
│   └── comandos.md
├── 3.Especificaciones/       # Requisitos de negocio, historias de usuario y roadmap
│   ├── PROJECT_SPEC.md
│   └── second-bimester-roadmap.md
├── 4.Arquitectura/           # Diseño técnico, modelo ER, seguridad y Socket.IO
│   └── TECHNICAL_REFERENCE.md
├── 5.Calidad-Y-Validacion/   # Pruebas automatizadas, accesibilidad y evidencias
│   ├── VALIDATION.md
│   └── evidence/
│       ├── browser-quality.json
│       └── query-performance.json
└── 6.Evaluacion-Y-Entrega/   # Rúbrica oficial de calificación y protocolo de entrega
    ├── COMPLIANCE_MATRIX.md
    └── DELIVERY.md
```

---

## Contenido Detallado por Área

### 1. Estado y Visión General
* **[1.Estado/contextoProyecto.md](1.Estado/contextoProyecto.md):** Documento maestro de transferencia de contexto. Resume el propósito del sistema, restricciones técnicas estrictas (primer bimestre), estado de avance real, comandos operativos y reglas para agentes de IA.
* **[1.Estado/PROGRESS.md](1.Estado/PROGRESS.md):** Registro vivo del estado actual del proyecto, tareas completadas, métricas de calidad y pendientes de cierre académico.
* **[1.Estado/AGENTS.md](1.Estado/AGENTS.md):** Reglas operativas y restricciones de desarrollo obligatorias para agentes de IA.

### 2. Guías de Inicialización y Base de Datos
* **[2.Guias/ejecucionPrimeraVez.md](2.Guias/ejecucionPrimeraVez.md):** Guía práctica para levantar el proyecto desde cero en local (Windows) o en Codespaces. Incluye cómo inicializar Docker/MySQL, ejecutar migraciones, acceder con los datos del seed vía recuperación de correo en `work/outbox/`, interactuar con la base de datos (Prisma Studio y CLI) y explorar la nueva interfaz interactiva (portada 3D, refrigeradora con estantes, modales y chat).
* **[2.Guias/comandos.md](2.Guias/comandos.md):** Comandos esenciales para inspeccionar la estructura de la base de datos MySQL, métodos de acceso (Prisma Studio, Docker CLI), consultas SQL clave de negocio (usuarios con hash Argon2id, alertas de caducidad, inventario, recetas, chat) y reglas de aislamiento multi-tenant.

### 3. Especificaciones y Requisitos
* **[3.Especificaciones/PROJECT_SPEC.md](3.Especificaciones/PROJECT_SPEC.md):** Alcance funcional, objetivos específicos medibles, cronograma de trabajo e historias de usuario priorizadas (**HU01 a HU12**) con criterios de aceptación.
* **[3.Especificaciones/second-bimester-roadmap.md](3.Especificaciones/second-bimester-roadmap.md):** Hoja de ruta para el segundo bimestre (desacoplamiento frontend/backend y microservicios; meramente referencial durante el primer bimestre).

### 4. Arquitectura y Referencia Técnica
* **[4.Arquitectura/TECHNICAL_REFERENCE.md](4.Arquitectura/TECHNICAL_REFERENCE.md):** Diagrama de bloques del monolito Node.js/Express/EJS/MySQL/Socket.IO, modelo de datos ER con las 11 entidades y restricciones SQL, rutas/permisos, arquitectura del nuevo front-end (Three.js 3D, Motion, tarjetas modales nativas, assets locales y fotos predictivas), seguridad (Argon2id, CSRF, CSP, sesiones persistentes) y contratos de eventos en tiempo real.

### 5. Calidad y Validación
* **[5.Calidad-Y-Validacion/VALIDATION.md](5.Calidad-Y-Validacion/VALIDATION.md):** Cobertura y resultados tras el rediseño del front-end (115 pruebas independientes aprobadas al 100 %, 58 de integración en MySQL), 40 escaneos de accesibilidad con `axe-core`, contrastes WCAG y mediciones de rendimiento de consultas SQL con 1000 registros sintéticos.
* **[5.Calidad-Y-Validacion/evidence/](5.Calidad-Y-Validacion/evidence/):** Archivos JSON versionados con las evidencias de ejecución de navegadores (`browser-quality.json`) y tiempos de respuesta de base de datos (`query-performance.json`).

### 6. Evaluación y Entrega Académica
* **[6.Evaluacion-Y-Entrega/COMPLIANCE_MATRIX.md](6.Evaluacion-Y-Entrega/COMPLIANCE_MATRIX.md):** Matriz detallada de cumplimiento contra los 11 criterios oficiales de la guía de la asignatura (100 % / 20 puntos).
* **[6.Evaluacion-Y-Entrega/DELIVERY.md](6.Evaluacion-Y-Entrega/DELIVERY.md):** Guion de exposición de 15 minutos + 5 minutos de preguntas por integrante, guion de demostración en vivo, requisitos de evidencia del despliegue en Codespaces y lista de verificación final.
