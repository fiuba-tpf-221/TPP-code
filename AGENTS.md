# Directivas de ingeniería — Trabajo Final

Versión: 1.0 · Fecha: 16 de octubre de 2026

## 1. Propósito y alcance

Este documento establece la base de trabajo para personas y asistentes que analicen, implementen, revisen o documenten el proyecto. El objetivo es producir software comprensible, correcto, verificable y mantenible, con decisiones que puedan justificarse en la defensa del Trabajo Final.

Ubicar este archivo en la raíz del repositorio. Leerlo al comenzar cada tarea y consultar las instrucciones específicas de los directorios afectados. Si ya existe un AGENTS.md, integrar estas directivas sin sobrescribir reglas útiles ni cambios ajenos. La lectura automática depende de la herramienta utilizada; cuando corresponda, solicitar expresamente su lectura.

Estas directivas no afirman que una funcionalidad esté implementada. El estado real debe verificarse en el código y, cuando sea posible, en ejecución. Las instrucciones explícitas del responsable del proyecto prevalecen; las excepciones técnicas deben documentarse con su motivo y alcance.

## 2. Principios de trabajo

- Comprender el problema antes de elegir una solución.
- Preferir la solución más simple que satisfaga los requisitos actuales y permita probarlos.
- Mantener los cambios enfocados: no mezclar una corrección con refactorizaciones no relacionadas.
- Aplicar KISS y YAGNI: evitar complejidad y funcionalidades especulativas.
- Aplicar DRY cuando exista conocimiento realmente duplicado; no abstraer solo porque dos bloques se parecen.
- Usar SOLID como guía para responsabilidades y dependencias, no como obligación de crear clases o interfaces.
- Preservar contratos y datos salvo que el cambio solicitado requiera modificarlos.
- Fundamentar las decisiones con código, pruebas, mediciones y documentación compatible con las versiones usadas.
- Diferenciar hechos comprobados, hipótesis y propuestas. Nunca inventar archivos, resultados ni pruebas ejecutadas.
- Priorizar corrección, claridad y facilidad de mantenimiento antes que ingenio o cantidad de patrones.

## 3. Analizar antes de modificar

Antes de implementar:

1. Precisar el problema, comportamiento esperado, alcance y criterios de aceptación.
2. Inspeccionar rama, commit, estado de Git y cambios locales existentes. No sobrescribir trabajo ajeno.
3. Leer README, instrucciones aplicables, dependencias, configuración, pruebas y archivos afectados.
4. Localizar el punto de entrada efectivo y seguir el recorrido completo de la operación.
5. Distinguir código ejecutado de ejemplos, módulos sin integrar y configuraciones que no se montan o cargan.
6. Revisar contratos HTTP, mensajes, esquemas de datos, recursos externos y efectos secundarios.
7. Identificar riesgos de compatibilidad, concurrencia, seguridad, datos y despliegue.
8. Consultar documentación oficial cuando haya dudas de APIs, versiones o comportamiento.
9. Definir un plan proporcional al cambio, incluyendo cómo verificarlo y revertirlo cuando corresponda.

Avanzar con decisiones rutinarias reversibles dentro del alcance acordado. Pedir aclaraciones cuando una ambigüedad cambie el comportamiento de negocio, el contrato o implique una acción destructiva. No convertir cada elección técnica en una aprobación adicional.

## 4. Arquitectura y responsabilidades

- Mantener separadas, cuando el tamaño lo justifique, la entrada HTTP, los casos de uso y las integraciones de infraestructura.
- Evitar lógica de negocio extensa dentro de endpoints y detalles de transporte dispersos en el dominio.
- Hacer explícitas las dependencias. Inyectar clientes, configuración o repositorios cuando facilite sustitución, pruebas o control del ciclo de vida.
- Crear clientes y conexiones en el ciclo de vida apropiado; cerrarlos y liberar recursos.
- Centralizar configuración y validarla al inicio. Evitar valores contradictorios entre código, variables y Compose.
- No introducir microservicios, colas, cachés o nuevas capas sin una necesidad concreta.
- No llamar integración a una mera dependencia de arranque ni afirmar que un contenedor desplegado ya participa del negocio.
- Documentar límites transaccionales y consistencia cuando una operación involucre base de datos, objetos y mensajes.

### Patrones de diseño

Antes de introducir un patrón, explicar el problema, una alternativa simple, el beneficio y el costo. Usar composición antes que jerarquías complejas cuando resuelva el caso con mayor claridad.

| Patrón o técnica | Cuándo considerarlo | Evitar |
| --- | --- | --- |
| Adapter | Aislar una API externa, como almacenamiento S3, de los casos de uso | Envolver cada método sin beneficio |
| Decorator | Agregar observabilidad o comportamiento transversal preservando el contrato | Ocultar efectos o duplicar instrumentación |
| Strategy | Seleccionar entre algoritmos o políticas que ya varían | Crear variantes hipotéticas |
| Repository | Aislar persistencia cuando simplifique el dominio y las pruebas | Una abstracción genérica que esconda capacidades necesarias del ORM |
| Inyección de dependencias | Sustituir integraciones y controlar recursos | Introducir un contenedor complejo para pocos objetos |
| Middleware | Resolver aspectos transversales de HTTP | Colocar reglas de negocio específicas |

Las decisiones significativas deben registrarse en un ADR breve: contexto, alternativas, decisión, consecuencias y criterio para revisarla. Los cambios triviales no requieren ADR.

## 5. Código legible y mantenible

- Respetar el estilo y las herramientas existentes; adoptar cambios de convención de manera deliberada.
- Usar nombres que expresen intención y un vocabulario consistente con el dominio.
- Preferir funciones cohesionadas, flujo explícito y anidamiento limitado. No imponer límites arbitrarios de líneas.
- Evitar números mágicos, código muerto, duplicación de reglas y excepciones silenciosas.
- Escribir comentarios sobre motivos, restricciones o decisiones difíciles; no repetir lo obvio.
- Documentar contratos públicos y comportamientos inesperados con docstrings o documentación adecuada.
- Usar anotaciones de tipos en Python donde mejoren los contratos y su verificación.
- Evitar defaults mutables, estado global mutable innecesario e importaciones con efectos secundarios difíciles de controlar.
- No capturar Exception indiscriminadamente. Si se requiere una frontera general de error, preservar contexto y definir su respuesta.
- No bloquear el event loop con clientes síncronos dentro de async def. Elegir un cliente asíncrono o ejecutar el trabajo bloqueante de forma apropiada.
- No agregar dependencias sin revisar necesidad, mantenimiento, compatibilidad y costo operativo.

## 6. APIs, errores y seguridad

- Validar entradas y definir respuestas y códigos HTTP coherentes.
- Separar autenticación de autorización: iniciar sesión en el frontend no protege por sí solo al backend.
- Verificar tokens y permisos en las operaciones protegidas según el proveedor y las versiones utilizadas.
- No guardar secretos en código, imágenes, documentación, URLs, logs o trazas. Proveer ejemplos de configuración sin credenciales reales.
- Aplicar mínimo privilegio y publicar únicamente los servicios necesarios para el entorno.
- Establecer límites razonables de tamaño, duración y recursos para entradas y operaciones externas.
- Distinguir errores esperados de validación, fallos de dependencias y errores inesperados.
- Devolver errores útiles sin exponer detalles internos o datos sensibles al cliente.
- Utilizar consultas parametrizadas y validar nombres, rutas y claves de archivos según el contrato.
- Mantener separadas las configuraciones de desarrollo y despliegue expuesto, incluyendo TLS, CORS y redirects.

## 7. Datos y procesamiento asíncrono

- Gestionar cambios de esquema mediante migraciones y evaluar compatibilidad y recuperación de datos.
- Definir transacciones explícitas donde varias escrituras deban ser atómicas.
- Considerar índices y paginación según consultas reales; medir antes de optimizar.
- Evitar cargar archivos o colecciones grandes enteros en memoria sin necesidad.
- Definir timeouts para llamadas externas y reintentos acotados solo cuando la operación sea segura para repetir.
- En mensajería, definir contrato y versión del mensaje, validación, acknowledgements y tratamiento de fallos.
- Diseñar consumidores idempotentes cuando puedan recibir mensajes duplicados.
- Evitar bucles infinitos de reintento; considerar backoff y tratamiento de mensajes fallidos.
- Distinguir persistencia del broker, durabilidad de colas y persistencia de mensajes. No asumir entrega exactamente una vez.
- Diferenciar job_id, request_id y trace_id: representan conceptos distintos.

## 8. Observabilidad: logs, métricas y tracing

La observabilidad debe permitir diagnosticar operaciones reales sin alterar indebidamente su comportamiento ni exponer información sensible.

### Conceptos compartidos

| Concepto | Significado |
| --- | --- |
| Log | Registro de un evento con contexto |
| Métrica | Medición agregable a lo largo del tiempo |
| Traza | Conjunto de spans relacionados que describe una operación |
| Span | Operación con inicio, fin, atributos y contexto |
| trace_id | Identificador compartido por los spans de una traza |
| span_id | Identificador de un span |
| Propagación | Transferencia de contexto entre procesos o servicios |
| OpenTelemetry | APIs, SDKs y componentes para instrumentar y transportar telemetría |
| Collector | Recibe, procesa y exporta telemetría |
| Jaeger | Backend para almacenar, consultar y visualizar trazas |

### Directivas de tracing

- Inicializar OpenTelemetry una vez por proceso y evitar instrumentación duplicada.
- Mantener service.name consistente y agregar versión y entorno de despliegue.
- Usar instrumentación automática para operaciones técnicas soportadas y spans manuales para operaciones relevantes que falten.
- Crear nombres estables; ubicar identificadores variables en atributos cuando sean necesarios y seguros.
- Respetar convenciones semánticas y distinguir atributos personalizados.
- Medir el trabajo efectivo: considerar iteradores, streaming, tareas diferidas y operaciones asíncronas.
- Conservar contexto padre-hijo y propagarlo en HTTP y mensajes cuando corresponda. Usar Span Links cuando el modelo causal lo requiera.
- Registrar errores en el span adecuado, incluso si una excepción se convierte en una respuesta controlada. Evitar duplicados innecesarios.
- Diferenciar el tiempo de la llamada cliente del procesamiento interno del servidor remoto.
- Verificar aislamiento de contexto entre peticiones concurrentes y mensajes sucesivos.
- Recordar que las duraciones de spans anidados no se suman directamente.
- Elegir muestreo explícito y proporcional al volumen. El tail sampling no recupera spans descartados previamente por el SDK.
- Evaluar filtros de health checks sin perder la posibilidad de diagnosticar conectividad.
- Verificar buffers, reintentos y cierre ordenado. No garantizar cero pérdida de telemetría sin evidencia.

### Logs y métricas

- Emitir logs estructurados a stdout, con niveles apropiados y trace_id/span_id cuando exista contexto activo.
- No confundir ConsoleSpanExporter con logging centralizado.
- Usar métricas para tasas, errores, latencias y recursos cuando aporten valor; evitar identificadores de alta cardinalidad en etiquetas de métricas.
- Mantener diferenciados el envío de trazas y la recolección de métricas. Un Collector desplegado no implica que la aplicación produzca todas las señales.

## 9. Docker y configuración operativa

- Verificar qué archivos de configuración carga cada contenedor realmente.
- Distinguir puerto interno y puerto publicado. Entre contenedores, usar nombres de servicio y puertos internos.
- Recordar que localhost se refiere al proceso o entorno que hace la llamada, incluido el navegador del usuario.
- Usar versiones reproducibles y lockfiles cuando correspondan. Actualizar con verificación de compatibilidad.
- Distinguir orden de arranque, readiness y finalización de inicializadores; usar health checks y condiciones compatibles con el despliegue.
- Diseñar inicializadores idempotentes, con espera acotada y salida no exitosa cuando fallen.
- Definir persistencia y retención de cada dato importante. Un volumen no sustituye una estrategia de respaldo.
- No ejecutar limpiezas destructivas, eliminar volúmenes ni modificar datos compartidos sin autorización específica.
- No trasladar automáticamente supuestos de Docker Compose a Swarm u otro orquestador: verificar diferencias de soporte y operación.

## 10. Pruebas y evidencia

Elegir pruebas por riesgo y comportamiento, no por cantidad o por repetir la implementación.

- Para una corrección, reproducir el fallo y verificar que el cambio lo resuelve.
- Probar reglas de negocio y límites mediante pruebas unitarias cuando corresponda.
- Probar contratos con bases, almacenamiento o mensajería mediante integración cuando el cambio dependa de ellos.
- Validar recorridos críticos completos cuando sea posible y necesario.
- Considerar errores, límites, concurrencia e idempotencia según el comportamiento afectado.
- Usar dobles para aislar dependencias, sin confundirlos con evidencia de integración real.
- Ejecutar formatter, lint, chequeo de tipos y pruebas disponibles apropiados al alcance.
- No debilitar pruebas, eliminar aserciones o silenciar errores únicamente para obtener resultados exitosos.
- Informar comandos ejecutados, resultados y comprobaciones pendientes. Nunca afirmar que algo funciona en ejecución si solo se inspeccionó el código.
- Evitar pruebas nuevas para cambios puramente editoriales o de bajo impacto que no las justifiquen.

## 11. Git, revisión y documentación

- Trabajar en una rama o checkout aislado cuando corresponda, preservando cambios locales existentes.
- Mantener diffs enfocados y commits comprensibles. Revisar el diff antes de entregar.
- No reescribir historia compartida, hacer push forzado, publicar, fusionar o desplegar sin autorización aplicable.
- Actualizar documentación cuando cambien comandos, variables, contratos, rutas o arquitectura.
- Documentar el sistema ejecutable, no solamente la arquitectura deseada.
- En diagramas, distinguir conexiones activas, configuradas y futuras; indicar qué representan las flechas.
- Escribir descripciones de cambios que expliquen problema, solución, validación y riesgos relevantes.
- Explicar las decisiones en español claro, conservando vocabulario técnico y convenciones del código.

## 12. Flujo esperado de una tarea

1. Entender: resumir objetivo y criterios de aceptación.
2. Investigar: inspeccionar código activo, configuración, dependencias y pruebas.
3. Diseñar: proponer la solución proporcional y justificar alternativas relevantes.
4. Implementar: aplicar cambios coherentes y limitados al alcance.
5. Verificar: ejecutar comprobaciones apropiadas e inspeccionar el diff.
6. Documentar: actualizar instrucciones y decisiones que hayan cambiado.
7. Entregar: explicar qué cambió, por qué, cómo se comprobó y qué limitaciones quedan.

Para cambios pequeños, estos pasos pueden resolverse brevemente. Para cambios de arquitectura, persistencia o contratos, deben quedar explícitos.

## 13. Definición de terminado

- [ ] El comportamiento solicitado cumple los criterios de aceptación.
- [ ] El código es legible, consistente y no incorpora complejidad injustificada.
- [ ] Las dependencias, errores y recursos tienen tratamiento adecuado.
- [ ] Los contratos existentes se conservan o sus cambios están documentados.
- [ ] No se incorporaron secretos ni exposición de datos sensibles.
- [ ] La observabilidad permite diagnosticar el flujo afectado cuando corresponde.
- [ ] Se ejecutaron las verificaciones disponibles y pertinentes.
- [ ] Las limitaciones y verificaciones pendientes están declaradas.
- [ ] Se revisó el diff y se preservó el trabajo ajeno.
- [ ] La documentación necesaria está actualizada.
- [ ] La entrega permite reproducir la validación y entender los riesgos relevantes.

## 14. Formato de entrega

Al finalizar una tarea, informar de forma proporcional a su tamaño:

1. Resultado: qué problema se resolvió y comportamiento obtenido.
2. Cambios: archivos o componentes relevantes y su propósito.
3. Justificación: decisiones y alternativas cuando aporten contexto.
4. Verificación: pruebas y comandos ejecutados con resultados.
5. Uso: cómo ejecutar o comprobar el cambio.
6. Pendientes: limitaciones y próximos pasos necesarios, sin presentar propuestas como implementadas.

## 15. Mantenimiento de estas directivas

Este documento es una base de trabajo, no una lista de funcionalidades a implementar en cada tarea. Aplicar cada criterio según el riesgo y el alcance. Actualizarlo cuando el equipo acuerde nuevas prácticas, conservando el motivo del cambio. No modificar las reglas únicamente para justificar una implementación que las incumple.
