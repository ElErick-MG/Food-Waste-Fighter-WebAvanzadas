# Presentación y entrega

## Material requerido

La guía establece una exposición de **15 minutos y 5 minutos de preguntas**, con
participación de todos los integrantes y demostración en vivo. La presentación
se prepara en PowerPoint, Canva u otra herramienta e incluye problema de la PYME, objetivos, cronograma/roles, requisitos o historias,
arquitectura, modelo de datos, repositorio público, pantallas, seguridad,
pruebas/resultados, uso de IA y conclusiones.

Fecha: `[FECHA_HORA_EXPOSICION]` · presentación: `[URL_PRESENTACION]` · carpeta del
grupo: `[URL_ENTREGA_CURSO]`. Los integrantes, roles y aportes se completan en
el [README](../README.md); no se sustituyen por contribuciones ficticias.

| Tiempo | Responsable | Contenido |
| --- | --- | --- |
| 0:00–3:00 | `[INTEGRANTE_1]` | Problema, objetivos, alcance, cronograma y arquitectura. |
| 3:00–6:00 | `[INTEGRANTE_2]` | Modelo, registro, login, recuperación, hash y sesiones. |
| 6:00–9:00 | `[INTEGRANTE_3]` | Dashboard, CRUD, validación, búsqueda/paginación y recetas. |
| 9:00–12:00 | `[INTEGRANTE_4]` | Chat entre dos personas, presencia, historial y notificación. |
| 12:00–15:00 | `[INTEGRANTE_5_OPCIONAL]` | Pruebas, rendimiento, límites, conclusiones e IA. |
| 15:00–20:00 | Todos | Preguntas y explicación individual del trabajo realizado. |

Con cuatro integrantes se distribuyen 3, 3,5, 4 y 3,5 minutos respectivamente,
más un minuto de conclusiones repartido entre el grupo. Todas las personas
exponen y pueden explicar y modificar su contribución.

## Demostración

1. Se inicia la aplicación según README y se comprueba `/ready`. Se utilizan
   datos ficticios, un ADMIN, su EMPLOYEE y una segunda empresa.
2. Se muestran registro/login, validación de datos y recuperación. Se explica
   Argon2id y el token de un uso con caducidad sin proyectar valores de secretos.
3. Se crea un alimento con 2.125 kg y fecha próxima; se verifica el rechazo de
   fechas invertidas, búsqueda, detalle, siguiente página, edición y borrado
   confirmado. Se muestran métricas, caducidad e ingredientes/preparación.
4. ADMIN y EMPLOYEE entran desde perfiles de navegador independientes y abren
   `/chat`. Se intercambian mensajes, se observa presencia y se recarga para
   comprobar historial. Otra empresa no recibe sus mensajes.
5. Un usuario mantiene el chat abierto mientras otro registra o edita un
   alimento próximo a caducar; aparece un aviso sin recarga.
6. Se identifica polling, upgrade 101 y wss en Network. Se muestran únicamente
   atributos Secure/HttpOnly/SameSite de la cookie, con sus valores ocultos.
   Se explica la sesión en el handshake, General, eventos y respaldo polling.
7. Se cierra sesión y se comprueba revocación/presencia. Se presentan los
   resultados de pruebas y la medición con sus condiciones y límites.

Los accesos ficticios del seed se preparan con el procedimiento de recuperación
del README. Dos pestañas con la misma cookie representan una sola identidad;
la demostración de dos personas utiliza sesiones independientes.

## Evidencia del despliegue

| Comprobación | Registro por completar |
| --- | --- |
| Fecha, revisión y origen HTTPS de Codespaces | `[FECHA_SHA_ORIGEN]` |
| Registro/login/logout y formularios protegidos | `[RESULTADO_Y_CAPTURA]` |
| Atributos de cookie, sin sus valores | `[ATRIBUTOS_OBSERVADOS]` |
| Dos usuarios, historial, presencia y aislamiento | `[RESULTADO_CHAT]` |
| Upgrade wss o transporte alternativo observado | `[TRANSPORTE]` |
| Aviso de inventario sin recarga y revocación | `[RESULTADO_AVISO_LOGOUT]` |

Las capturas públicas contienen datos ficticios y excluyen cookies, tokens,
.env, bandeja de recuperación y claves privadas. No se adjunta un HAR sin
revisarlo: puede incluir credenciales de sesión. Los informes locales de
[VALIDATION.md](VALIDATION.md) no se presentan como capturas remotas.

## Cierre y envío

- [ ] Completar nombres, roles, aportes y commits auténticos de todos los integrantes.
- [ ] Preparar la presentación y comprobar la cobertura de la [rúbrica](COMPLIANCE_MATRIX.md).
- [ ] Adjuntar la evidencia del despliegue y ensayar demo y respuestas individuales.
- [ ] Ejecutar las verificaciones de VALIDATION.md sobre la revisión final.
- [ ] Confirmar repositorio público sin secretos ni datos personales reales.
- [ ] Crear la etiqueta anotada **v1.0-b1** sobre la revisión validada y publicar esa etiqueta.
- [ ] Entregar en la carpeta del grupo el enlace al repositorio o ZIP y la presentación o su enlace público.
- [ ] Conservar `[COMPROBANTE_ENTREGA]` y `[SHA_FINAL_Y_URL_VERSION]`.

No se considera realizada la entrega hasta completar estos elementos. La
versión del segundo bimestre corresponde a v2.0-b2.

## Conclusiones y aprendizajes

El monolito integra control de existencias y coordinación con datos persistidos
y acceso por empresa. Las pruebas comprueban reglas de autenticación, fechas,
CRUD y mensajes; las mediciones permiten discutir rendimiento con condiciones
explícitas. La validación automatizada se complementa con revisión de interfaz,
seguridad y explicación individual. Persistencia y entrega en vivo son aspectos
distintos; una confirmación perdida no prueba que el mensaje no se haya guardado.
No se atribuyen ahorros económicos a los datos sintéticos.
