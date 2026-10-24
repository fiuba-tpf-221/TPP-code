# Pruebas manuales

Cada fila: **qué hacer** → **qué tiene que pasar**. Si algo no coincide, anotar el número de prueba y qué se vio.
La aplicación tiene dos modos (ver el README): **simulado** (por defecto, no necesita Docker) y **Keycloak** (integración real).
Hacé primero el bloque **S** (simulado); el bloque **K** es para cuando quieras verificar la integración con la infraestructura.

| Bloque | Historia |
|---|---|
| S1 | US-05 Autenticación y sesión |
| S2 | US-06 Control de acceso (menú y permisos) |
| S3 | Panel Sistema (infraestructura; sin historia de Jira) |
| S4 | US-01 Alta, US-02 Modificación, US-03 Baja y reactivación, US-04 Consulta de usuarios |
| S5 | US-08 Generación de contraseña temporal |
| S6 | US-07 Gestión de roles |
| S7 | US-11 Mi perfil |
| S8 | US-05 Timeout de sesión |

---

# Parte 1 — Modo simulado (ambiente controlado)

## S0. Preparación

Elegí una de las dos formas:

- **Sin Docker** (la más rápida): dentro de `frontend/` ejecutar `npm install` y `npm start` → abrir http://localhost:3000
  (si el puerto está ocupado, la consola indica otro).
- **Con Docker**: en la carpeta del proyecto, `docker compose up -d --build` → abrir http://localhost. Sin tocar nada queda en modo simulado.

Usuario de prueba: `demo@tpp.com` / `demo1234` (Administrador).

Para **volver los datos al estado inicial** en cualquier momento: DevTools del navegador (F12) → *Application* → *Storage* → *Clear site data*.

## S1. Acceso

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S1.1 | Abrir la aplicación | Pantalla de acceso con carrusel a la izquierda y ventana a la derecha, con pestañas *Iniciar sesión / Crear cuenta*. Debajo del nombre del proyecto, la pastilla ámbar **"Modo simulado"**, y al pie de la ventana "Demo (Administrador): demo@tpp.com / demo1234". |
| S1.2 | Dejar vacío el email o la contraseña | El botón *Iniciar sesión* está **deshabilitado**; se habilita solo con ambos campos completos y vuelve a deshabilitarse si uno se vacía. |
| S1.3 | Apretar el ojito del campo contraseña | Muestra y oculta el texto. |
| S1.4 | Entrar con una contraseña incorrecta | Caja roja: "No fue posible iniciar sesión. Verificá tus credenciales o contactá a un administrador." (el mismo mensaje con un email inexistente). |
| S1.5 | Tres contraseñas incorrectas seguidas con `demo@tpp.com`, y luego la correcta | Siempre el mismo mensaje; la cuarta, aunque sea la correcta, **sigue sin entrar** (credencial bloqueada). Para desbloquear: *Clear site data* (S0). |
| S1.6 | Entrar con `demo@tpp.com` / `demo1234` | Inicio con "Bienvenido, Usuario Demo". En la barra superior, la pastilla "Modo simulado". |
| S1.7 | Cerrar sesión desde el menú del usuario (arriba a la derecha) | Vuelve al acceso. Con el botón *Atrás* del navegador no se ve ninguna pantalla interna. |
| S1.8 | Sin sesión, escribir a mano `/usuarios` | Lleva al acceso y, al iniciar sesión, **vuelve a /usuarios**. |

## S2. Todas las pestañas

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S2.1 | Mirar el menú lateral | Siete opciones, cada una con su ícono a la izquierda: **Administración** (Usuarios, Roles, Dominios, Auditoría, Sistema), **Modelos** y **Predicción**. |
| S2.2 | Abrir Dominios, Auditoría, Modelos y Predicción | Cada una carga y dice "Este módulo está en construcción". |
| S2.3 | Abrir Usuarios, Roles y Sistema | Son pantallas reales (ver S3, S4 y S6). |
| S2.4 | Menú del usuario → *Mi perfil* | Carga la pantalla de datos personales y cambio de contraseña (ver S7). No muestra roles ni permisos. |

## S3. Panel Sistema (simulado)

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S3.1 | Abrir *Administración → Sistema* | Aviso azul "Modo simulado: estos estados no vienen de los servicios reales…" y un selector **Escenario simulado**. Seis tarjetas (Keycloak Auth, MinIO S3, FastAPI Backend, PostgreSQL, RabbitMQ, Redis Cache) en **En línea**, y "6 de 6 servicios en línea". |
| S3.2 | Elegir *Backend degradado (RabbitMQ caído)* | Se actualiza solo: FastAPI Backend **Degradado**, RabbitMQ **Desconectado**, las otras cuatro En línea. |
| S3.3 | Elegir *Backend caído* | FastAPI Backend **Desconectado**; PostgreSQL, RabbitMQ y Redis en **Sin datos**; "2 de 6". |
| S3.4 | Elegir *Keycloak caído* | Keycloak Auth **Desconectado**; el resto En línea. |
| S3.5 | *Actualizar* | Vuelve a consultar y actualiza la hora de "Última verificación". |
| S3.6 | Mirar las seis consolas (Grafana, RabbitMQ, MinIO, Jaeger, Prometheus, SonarQube) | Seis tarjetas con ícono; abren en otra pestaña. Cargan solo si la infraestructura está levantada. |

## S4. Usuarios

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S4.1 | Abrir *Usuarios* | Tabla con `demo@tpp.com`. Sin aviso de "datos de demostración" (en este modo todo es simulado). |
| S4.2 | *Nuevo usuario* con nombre `  Ana   María ` (espacios de más), apellido, email `ana@tpp.com` y rol *Consulta* | Al salir de cada campo se ve el valor normalizado. El botón *Crear usuario* está deshabilitado mientras falte nombre, apellido, email o un rol. |
| S4.3 | Crear con un email de dominio no habilitado (`x@viejo.com`) | Rechaza e informa el error en el campo del email. |
| S4.4 | Crear con datos válidos | Muestra la **contraseña temporal una sola vez** con botón *Copiar* y aviso; *Continuar* vuelve a la lista. |
| S4.5 | Cerrar sesión y entrar con `ana@tpp.com` y la contraseña temporal | Lleva a **Cambiar contraseña** (sin menús). La nueva debe coincidir, tener 8–64 caracteres y no tener espacios; no puede ser igual a la anterior. Al guardar, entra al Inicio. |
| S4.6 | Con ese usuario (rol *Consulta*) mirar el Inicio | Sin menú lateral; "Todavía no tenés permisos asignados. Contactá a un administrador." |
| S4.7 | Con ese usuario, escribir a mano `/usuarios` y `/sistema` | "Sin acceso — No tenés permiso para ver esta pantalla." |
| S4.8 | Crear usuarios con rol *Analista* y con rol *Operador*, e ingresar con cada uno | Analista ve **Modelos** y **Predicción**; Operador ve solo **Predicción**. |
| S4.9 | Como administrador, en la lista: filtrar por email (en mayúsculas), por apellido, por Activo y por uno o más roles; ordenar una columna; pasar de página | Los filtros se combinan; los roles inactivos se marcan con `(*)`; el orden y los filtros se mantienen al paginar y al recargar (F5). Sin coincidencias: "No se encontraron resultados." |
| S4.10 | Entrar al detalle de otro usuario, cambiar el apellido y guardar | *Guardar cambios* está deshabilitado mientras no haya cambios; no se puede quitar el último rol; el email es de solo lectura. |
| S4.11 | Entrar al detalle de **tu propio** usuario | Campos deshabilitados y sin acciones administrativas ("No se habilitan acciones administrativas sobre tu propio usuario"). |
| S4.12 | Dar de baja a otro usuario (confirmando) y luego reactivarlo | Cada acción pide confirmación con su texto; la baja informa el resultado; al reactivar se muestra una **contraseña temporal nueva** y la anterior deja de servir. |

## S5. Contraseña temporal (US-08)

Hacerlo como administrador, sobre **otro** usuario (crear uno si hace falta).

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S5.1 | Abrir el detalle de otro usuario → *Generar nueva contraseña temporal* | Ventana de confirmación que dice que **la contraseña actual quedará invalidada para nuevos inicios de sesión**, que **las sesiones abiertas no se ven afectadas** y que, si estaba bloqueada, se desbloquea. |
| S5.2 | Confirmar con *Generar contraseña* | Se abre un **modal** con la contraseña de **16 caracteres** (mezcla de mayúsculas, minúsculas, números y símbolos), el botón *Copiar*, el aviso "se muestra una sola vez" y que deberá cambiarla en su próximo inicio de sesión. |
| S5.3 | Apretar *Copiar* y pegar en cualquier lado | El botón pasa a "Copiada" y la contraseña pegada coincide. |
| S5.4 | Intentar cerrar el modal con **Esc** o haciendo clic afuera | No se cierra. Solo se sale con *Continuar*. |
| S5.5 | *Continuar* | Vuelve al detalle del usuario; la contraseña **ya no se puede ver** en ningún lado. |
| S5.6 | Mirar los estados de solo lectura del usuario | Credencial bloqueada **No**, Intentos fallidos **0**, Cambio de contraseña requerido **Sí**. |
| S5.7 | Bloquear a un usuario (tres contraseñas incorrectas en el login), cerrar sesión, entrar como administrador y generarle la contraseña | Su credencial figura bloqueada antes y **desbloqueada** después. |
| S5.8 | Entrar con ese usuario usando la contraseña **anterior** | Se rechaza (mensaje genérico). |
| S5.9 | Entrar con la contraseña **nueva** | Entra, y lo lleva obligatoriamente a *Cambiar contraseña* (sin menús). |
| S5.10 | En el detalle de **tu propio** usuario | El botón está deshabilitado: nadie puede generarse una contraseña a sí mismo. |
| S5.11 | Reactivar a un usuario dado de baja | También muestra la contraseña en el modal, con las mismas reglas. |

> No se puede probar a mano que las sesiones ya abiertas sigan vigentes: en modo simulado las pestañas del mismo navegador comparten la sesión. Está cubierto por tests automáticos.

## S6. Roles (US-07)

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S6.1 | Menú → *Administración → Roles* | Grilla con **Nombre, Descripción, Activo, Usuarios asignados, Permisos asignados y Acciones**. Cinco roles; *Administrador* con la etiqueta **Protegido**. Botón *Nuevo rol* y *Ver / Editar* en cada fila. |
| S6.2 | Filtrar por Nombre escribiendo `  ANALI ` (con espacios y mayúsculas) y *Buscar* | Muestra solo *Analista*. *Limpiar filtros* vuelve a mostrar todos. |
| S6.3 | Filtrar por Descripción (`predicciones`) y por Activo (Todos / Sí / No) | Cada filtro funciona; combinados, se cumplen ambos. Sin coincidencias: "No se encontraron resultados." |
| S6.4 | Ordenar cada columna (menos Acciones) en ambos sentidos, cambiar las filas por página y recargar (F5) | Orden y filtros se conservan. |
| S6.5 | *Nuevo rol* | *Crear rol* deshabilitado hasta completar nombre y descripción. **Activo = Sí** por defecto. Permisos agrupados en **Administración, Modelos y Predicción**, ninguno marcado. |
| S6.6 | Crear un rol **sin permisos** | Se crea, vuelve a la lista con el aviso verde "El rol … se creó correctamente." y figura con 0 permisos. |
| S6.7 | Crear otro con un nombre que ya existe, cambiando mayúsculas o espacios (`  analista `) | Error "Ya existe un rol con ese nombre." en el campo; no se crea. |
| S6.8 | Escribir `   Jefe    de   Pozo ` en el nombre y salir del campo | Queda `Jefe de Pozo`. |
| S6.9 | Crear un rol con *Activo = No* y luego abrir *Usuarios → Nuevo usuario* | Ese rol **no aparece**: solo se pueden asignar roles activos. |
| S6.10 | *Ver / Editar* un rol | Nombre en solo lectura (no es un campo), Estado, cantidad de usuarios y de permisos; descripción editable; permisos con sus casillas. *Guardar cambios* deshabilitado hasta haber un cambio. |
| S6.11 | Cambiar la descripción y sumar un permiso → *Guardar cambios* | Aviso verde de guardado y la cantidad de permisos se actualiza. |
| S6.12 | Vaciar la descripción | "La descripción es obligatoria." y no se puede guardar. |
| S6.13 | *Inactivar rol* | Confirmación con **cuatro avisos**: deja temporalmente de otorgar permisos; los usuarios conservan la asociación; deja de estar disponible para nuevas asignaciones; las sesiones existentes no se ven afectadas y el cambio aplica en el próximo login. Al confirmar: Estado *Inactivo*; usuarios y permisos **se conservan**; el botón pasa a *Reactivar rol*. |
| S6.14 | Con un usuario de rol *Analista* (crearlo, entrar y cambiar la contraseña: ve Modelos y Predicción): como administrador inactivar *Analista*; ese usuario cierra sesión y vuelve a entrar | Ya **no ve Modelos ni Predicción** (el rol inactivo no otorga permisos), aunque conserva el rol. |
| S6.15 | Reactivar *Analista* (confirmación con sus cuatro avisos) y ese usuario vuelve a entrar | Vuelve a ver Modelos y Predicción. |
| S6.16 | Abrir un rol **con usuarios asignados** (por ejemplo *Analista*) | No hay botón *Eliminar rol*; un texto explica que primero deben quitarse todas las asignaciones de usuarios. |
| S6.17 | Crear un rol sin usuarios → *Eliminar rol* | Confirmación que dice que la eliminación es **definitiva** y borra sus relaciones con permisos. Al confirmar vuelve a la lista con aviso y el rol ya no está. |
| S6.18 | Abrir el rol **Administrador** | Aviso "Rol protegido del sistema"; descripción deshabilitada; las 7 casillas marcadas y deshabilitadas; *Guardar cambios* deshabilitado; **sin** *Inactivar* ni *Eliminar*. |
| S6.19 | Con un usuario *Analista* (sin "Gestión de roles") | *Roles* no está en el menú y escribir `/roles` a mano da "Sin acceso". |

> Los permisos o módulos inactivos no se pueden provocar desde la pantalla (el catálogo lo define el sistema). Ese comportamiento —se siguen mostrando marcados como inactivos en el detalle, se pueden quitar y no volver a asignar— está cubierto por tests automáticos.

## S7. Mi perfil (US-11)

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S7.1 | Menú del usuario → *Mi perfil* | Migas **Inicio / Mi perfil** y dos tarjetas independientes: *Datos personales* y *Cambiar contraseña*. **No** se ve nada de roles, permisos, estado activo, credencial bloqueada, intentos fallidos ni cambio requerido. |
| S7.2 | Mirar *Datos personales* | Email en gris y solo lectura con "El email no puede modificarse."; Nombre y Apellido editables (con *); *Guardar cambios* deshabilitado y el aviso azul "No hay cambios para guardar." |
| S7.3 | Agregar solo espacios de más a un nombre (`Usuario   `) | Sigue deshabilitado: no es un cambio real. Cambiar una letra lo habilita. |
| S7.4 | Vaciar el Nombre y salir del campo (y lo mismo con Apellido) | Error "El nombre es obligatorio." / "El apellido es obligatorio." y *Guardar cambios* deshabilitado. |
| S7.5 | Cambiar nombre y apellido (con espacios de más) → *Guardar cambios* | Aviso verde "Los datos se actualizaron correctamente."; **permanece en Mi perfil**; los valores quedan normalizados; el nombre de arriba a la derecha se actualiza solo. |
| S7.6 | Mirar *Cambiar contraseña* | Tres campos enmascarados, cada ojito muestra u oculta **solo su campo**, y el cuadro "Tu nueva contraseña debe:" con los requisitos. El botón está deshabilitado hasta completar los tres. |
| S7.7 | Nueva y confirmación distintas | "Las contraseñas no coinciden." |
| S7.8 | Nueva igual a la actual; y otra con espacios o muy corta | "La nueva contraseña debe ser distinta de la actual."; y el error de política correspondiente. |
| S7.9 | Contraseña **actual** incorrecta, repetido más de cinco veces | "La contraseña actual no es correcta." en ese campo; los campos se conservan. **No se bloquea la cuenta**: al cerrar sesión se entra normalmente con la contraseña correcta. |
| S7.10 | Cambio correcto | Aviso verde "La contraseña se modificó correctamente."; los tres campos quedan vacíos; **permanece en Mi perfil**. Al cerrar sesión, la contraseña anterior ya no entra y la nueva sí. |
| S7.11 | Editar el nombre sin guardar y luego cambiar la contraseña | El nombre editado sigue ahí, sin guardar: son operaciones independientes. |
| S7.12 | Entrar con un usuario sin permisos (rol *Consulta*) y abrir *Mi perfil* | Funciona: no requiere permiso. |
| S7.13 | Con un usuario que tiene el cambio de contraseña obligatorio pendiente, escribir `/perfil` a mano | Lo lleva a *Cambiar contraseña* (obligatorio); no accede a Mi perfil hasta completarlo. |

## S8. Sesión

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S8.1 | Copiar `frontend/.env.example` como `frontend/.env`, poner `REACT_APP_SESSION_TIMEOUT_SECONDS=20` y reiniciar `npm start` (con Docker: reconstruir). Entrar y **no hacer clic en el menú** | A los 20–30 s vuelve al acceso con el aviso azul "Tu sesión expiró por inactividad. Iniciá sesión nuevamente." Mover el mouse o escribir no cuenta como actividad. |
| S8.2 | Con el mismo timeout, entrar y a los ~15 s abrir *Usuarios* | Ese uso cuenta como actividad: el contador se reinicia y no cierra a los 30 s. |
| S8.3 | Al terminar, vaciar la variable | Vuelve a 30 minutos. |

## S9. Despliegue (solo con Docker)

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| S9.1 | Con sesión iniciada, abrir `/usuarios/nuevo` y recargar (F5) | Sigue en esa pantalla; no hay 404. |
| S9.2 | `npm test -- --watchAll=false` (dentro de `frontend/`) | Todos los tests en verde. |

---

# Parte 2 — Modo Keycloak (integración real)

Entrar siempre por **http://localhost** (no por la IP de la máquina: el login con Keycloak necesita `localhost` o HTTPS).

## K0. Preparación (una sola vez)

1. Activar el modo: en `frontend/.env` poner `REACT_APP_MODE=keycloak` y ejecutar `docker compose up -d --build frontend`.
   (Alternativa sin reconstruir: `npm run start:keycloak` dentro de `frontend/`, abriendo http://localhost:3000.)
2. Con la infraestructura levantada (`docker compose ps -a` con todo en `Up`; Keycloak tarda 1–2 minutos más en estar listo), **crear los roles en Keycloak**
   (el realm no trae ninguno):
   - Abrir http://localhost:8080 → *Administration Console* → usuario `admin`, contraseña `admin`.
   - Arriba a la izquierda, cambiar el realm `master` por **`tpp-realm`**.
   - *Realm roles* → *Create role* → crear `administrador`, `analista`, `operador` y `consulta` (el nombre exacto, en minúsculas).
   - *Users* → `testuser` → pestaña *Role mapping* → *Assign role* → marcar `administrador` → *Assign*.
   - *Users* → *Add user* → usuario `operador1` → *Create* → pestaña *Credentials* → *Set password* `Test1234!` con *Temporary* en **Off** →
     pestaña *Role mapping* → asignar `operador`.

   Los roles quedan en la base de datos de Keycloak: se pierden con `docker compose down -v`.

Credenciales: **la app** usa `testuser` / `password123` (administrador) y `operador1` / `Test1234!`. La **consola de Keycloak** usa `admin` / `admin`
(es otra cuenta: no sirve para entrar a la app).

## K-A. Arranque y rutas

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| KA1 | Abrir http://localhost | Se ve **nuestra** pantalla (carrusel y ventana con pestañas), **sin** la pastilla "Modo simulado". Un instante antes puede verse "Conectando con el servicio de autenticación…". |
| KA2 | Sin sesión, abrir http://localhost/usuarios | Lleva al acceso; al iniciar sesión, **vuelve a /usuarios**. |
| KA3 | Con sesión, ir a *Usuarios → Nuevo usuario* y recargar (F5) | Sigue en esa pantalla; no hay 404. |

## K-B. Inicio de sesión

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| KB1 | *Iniciar sesión* | Te lleva a la pantalla de Keycloak (URL `localhost:8080/realms/tpp-realm/...`). |
| KB2 | Poner una contraseña incorrecta | Keycloak lo informa y te deja ahí. |
| KB3 | Entrar con `testuser` / `password123` | Vuelve a la app, en Inicio, con **testuser** arriba a la derecha. |
| KB4 | Menú del usuario → *Mi perfil* | Email `—` y Nombre `testuser`, solo lectura, con el aviso "se administran en Keycloak" y el botón *Administrar mi cuenta en Keycloak* (abre su cuenta en otra pestaña). No hay formularios ni roles. |
| KB5 | Recargar (F5) en cualquier pantalla | Sigue con la sesión iniciada, sin pedir credenciales. Otra pestaña con http://localhost también entra directo. |
| KB6 | Cerrar sesión, pestaña *Crear cuenta* → botón *Crear cuenta* | Abre el registro de Keycloak; al completarlo vuelve a la app con la sesión iniciada y el nombre real. Sin menú lateral y con "Todavía no tenés permisos asignados". |

## K-C. Permisos y menú

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| KC1 | Entrar con `testuser` (administrador) | Menú lateral completo: Administración (Usuarios, Roles, Dominios, Auditoría, Sistema), Modelos y Predicción. |
| KC2 | Cerrar sesión y entrar con `operador1` | Solo **Predicción**. Escribiendo `/usuarios` a mano: "Sin acceso". |
| KC3 | En Keycloak, asignarle también `analista` a `operador1`; cerrar sesión y **volver a entrar** | Ahora aparecen **Modelos** y **Predicción** (los roles se leen al iniciar sesión). |

## K-D. Cierre de sesión y timeout

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| KD1 | Menú del usuario → *Cerrar sesión*, y luego *Iniciar sesión* | **Keycloak pide credenciales** (no entra solo). |
| KD2 | Con `REACT_APP_SESSION_TIMEOUT_SECONDS=20` (y reconstruir), entrar y no hacer clic en el menú | A los 20–30 s vuelve al acceso con el aviso de sesión expirada; al volver a entrar, Keycloak pide credenciales. |

## K-E. Sistema (real)

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| KE1 | *Administración → Sistema* | Sin aviso de modo simulado ni selector. Seis tarjetas **En línea** y "6 de 6 servicios en línea · Última verificación: hh:mm:ss". |
| KE2 | `docker compose stop rabbitmq` → *Actualizar* | RabbitMQ **Desconectado** y FastAPI Backend **Degradado**. `docker compose start rabbitmq` → *Actualizar* → vuelve a 6 de 6. |
| KE3 | `docker compose stop minio` → *Actualizar* | MinIO **Desconectado** y el backend **Degradado**. Volver a iniciarlo. |
| KE4 | `docker compose stop backend` → *Actualizar* | FastAPI Backend **Desconectado**; PostgreSQL, RabbitMQ y Redis en **Sin datos**; "2 de 6". Volver a iniciarlo. |
| KE5 | `docker compose stop keycloak` → *Actualizar* | Keycloak **Desconectado**; la sesión abierta sigue. |
| KE6 | Con Keycloak detenido, recargar (F5) | Tras unos 15 s: "No se pudo conectar con el servicio de autenticación…" con botón **Reintentar**. Iniciar Keycloak, esperar ~1 min y *Reintentar*. |
| KE7 | Las seis consolas | Abren en otra pestaña y cargan: Grafana (3001), RabbitMQ (15672), MinIO (9001), Jaeger (16686), Prometheus (9090), SonarQube (9000, tarda en iniciar). |

## K-F. Usuarios en modo Keycloak

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| KF1 | Abrir *Usuarios*, *Nuevo usuario*, el detalle de un usuario y *Roles* | En todas aparece el aviso azul "Datos de demostración: lo que ves en esta pantalla es simulado y no existe en Keycloak…". |
| KF2 | Crear un usuario, filtrar, ordenar, editar, dar de baja | Funciona igual que en S4. Esos usuarios **no existen en Keycloak** y no pueden iniciar sesión en él. |

---

## Si algo falla

- **Se queda en "Conectando…" o aparece el error de autenticación (modo Keycloak)**: Keycloak todavía no está listo (esperar 1–2 minutos) o está caído → `docker compose logs keycloak`.
- **En modo Keycloak entré pero no veo el menú**: el usuario no tiene roles en Keycloak → K0, paso 2.
- **Cambié algo y no se ve**: con Docker, `docker compose up -d --build frontend` y recargar con Ctrl+F5; con `npm start`, reiniciarlo. Las variables `REACT_APP_*` solo se aplican al construir o iniciar.
- **No sé en qué modo estoy**: si ves la pastilla ámbar "Modo simulado" (en el acceso y en la barra superior), es el simulado. Si no la ves, es Keycloak.
