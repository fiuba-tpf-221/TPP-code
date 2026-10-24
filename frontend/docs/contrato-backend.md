# Contrato front–backend

> **Estado actual (octubre 2026):** el backend real (`backend/app/main.py`) solo expone `GET /health`, `GET /files` y
> `POST /files/test-upload`. **Ninguno de los endpoints de abajo existe todavía**: por eso `USE_MOCK_API` sigue en `true`.
> El único contrato que el front ya consume del backend real es `GET /health` (ver al final).

Mientras `FEATURES.USE_MOCK_API` esté en `true`, todo lo de acá lo resuelve
`src/mock/` (una base en el navegador). Cuando el backend esté listo:

1. Poner `USE_MOCK_API: false` en `src/config/features.js`.
2. Borrar la carpeta `src/mock/` (nada de ahí es parte del producto real).
3. Implementar estos endpoints. Todos van con `Authorization: Bearer <token>`.

## Autenticación

El front tiene dos modos (interruptor único en `src/config/features.js`, o `REACT_APP_MODE` en `.env`; ver el README):

- **`keycloak`**: autentica el Keycloak de la infraestructura (realm `tpp-realm`, cliente público `frontend-client`, flujo estándar
  con PKCE). El front manda `Authorization: Bearer <access token>` en cada llamada a `/api` y **renueva el token** antes de enviarla.
  Lo que debe hacer el backend: **validar ese JWT** (firma con las claves públicas del realm, `iss`, expiración) y responder **401** si no sirve.
  Hoy no lo hace (`core/security.py` y `api/endpoints/auth.py` están vacíos).
- **`mock` (por defecto)**: login simulado en el navegador; sirve para trabajar la interfaz sin levantar la infraestructura. Es lo que describe la tabla siguiente.

### Permisos con Keycloak

El token de Keycloak trae **roles** (`realm_access.roles`), no los permisos de la US-06. Mientras el backend no los entregue, el front los deriva con la tabla
provisoria `src/config/keycloakRoles.js` (rol del realm → permisos). Los roles deben existir en Keycloak con esos nombres: `administrador`, `analista`,
`operador`, `consulta`. **Recomendado:** que el login (o un endpoint propio) devuelva los permisos *efectivos* (US-06) y borrar esa tabla. Los permisos se calculan **al iniciar sesión** y se mantienen durante toda la sesión (US-07): el backend debe autorizar con ese conjunto, no recalcularlo en cada llamada.

### Qué cubre Keycloak y qué queda del lado de la infraestructura (US-05)

Con Keycloak, estas reglas de la US-05 ya no las implementa el front sino la **configuración del realm** (consola de Keycloak → Realm settings):
bloqueo tras 3 intentos fallidos (*Brute force detection*), política de contraseña (8–64 caracteres), contraseña temporal con cambio obligatorio
(*Required action: Update Password*), vencimiento por inactividad (*SSO Session Idle*, 30 minutos), y mensaje genérico ante fallas.
El realm actual (`keycloak/realm-export.json`) **no tiene ninguna** de esas reglas configurada y tiene `registrationAllowed: true`
(cualquiera puede crear una cuenta desde la pantalla de Keycloak). La regla de "dominio activo" y la auditoría de logins no existen en Keycloak: requieren
backend (o un evento/SPI de Keycloak).

### Modo `mock` (US-05)

| Endpoint | Body | Respuesta / notas |
|---|---|---|
| `POST /api/auth/login` | `{ email, password }` | `{ token, user }`. Ante cualquier falla: 401 con el mensaje genérico (no revelar el motivo real; auditarlo del lado del servidor). |
| `POST /api/auth/google` | `{ credential }` | Igual que login. El backend **debe verificar la firma** del JWT de Google y que el `aud` sea su Client ID. |
| `POST /api/auth/change-password` | `{ newPassword }` | `{ token, user }` con `mustChangePassword: false`. No pide la contraseña anterior (ya se validó en el login). |
| `POST /api/auth/register` | `{ name, email, password }` | `{ token, user }`. Solo si se mantiene el autoregistro. |
| `POST /api/auth/logout` | — | Invalida solo la sesión actual. |

Solo modo `mock`. `user` siempre trae: `{ id, name, email, roles: [{id,name}], permissions: string[], mustChangePassword }`.

## Usuarios (US-01 y US-02)

| Endpoint | Body | Respuesta / notas |
|---|---|---|
| `GET /api/users` | query (ver abajo) | `{ items, total, page, pageSize }`. Requiere permiso `users.manage`. |
| `GET /api/roles/options` | — | `[{ id, name, active }]`, incluye inactivos (el front filtra según la pantalla). Es la lista simple para asignar roles a usuarios; `GET /api/roles` pasó a ser la consulta paginada de la US-07. |
| `GET /api/users/:id` | — | Detalle: agrega `blocked`, `failedAttempts`, `mustChangePassword`. |
| `POST /api/users` | `{ firstName, lastName, email, active, roleIds }` | `{ user, temporaryPassword }`. La contraseña se muestra una sola vez: no se vuelve a exponer en ningún GET posterior. |
| `PUT /api/users/:id` | `{ firstName, lastName, roleIds }` | Solo estos 3 campos. Email inmutable. Auditar valor anterior y nuevo por campo modificado. Rechazar si `id` es el propio actor (403). |
| `POST /api/users/:id/deactivate` | — | Rechazar sobre uno mismo (403). |
| `POST /api/users/:id/reactivate` | — | `{ user, temporaryPassword }`, una sola vez. **Siempre** genera contraseña temporal nueva (la anterior queda inválida) y deja `active=true`, `blocked=false`, `failedAttempts=0`, `mustChangePassword=true`. No cierra sesiones abiertas. Rechazar sobre uno mismo (403). |
| `POST /api/users/:id/temporary-password` | — | US-08. `{ user, temporaryPassword }`, una sola vez. Invalida la contraseña anterior, deja `blocked=false`, `failedAttempts=0` y `mustChangePassword=true`. **No cierra sesiones abiertas.** Rechazar sobre uno mismo (403). La contraseña **nunca** va a auditoría, logs, outbox ni tracing. |

**Generación de contraseñas temporales (EDH-53).** Un único componente, reutilizado por el alta (US-01), la reactivación (US-03) y la nueva contraseña temporal (US-08): 16 caracteres, fuente criptográficamente segura (nunca `random`), solo caracteres de la política de contraseñas (US-05) con al menos una mayúscula, una minúscula, un número y un especial; se guarda solo su hash.

### Consulta de usuarios (US-04)

`GET /api/users?email=&firstName=&lastName=&active=&blocked=&roleIds=a,b&sort=email&order=asc&page=1&pageSize=10`

- `email`, `firstName`, `lastName`: coincidencia parcial, sin distinguir mayúsculas.
- `active`, `blocked`: `true` / `false`; si se omiten, no filtran.
- `roleIds`: lista separada por comas; un usuario cumple si tiene **al menos uno** (OR). Vacío = no filtra. Se aceptan roles inactivos.
- Los distintos filtros se combinan con **AND**.
- `sort`: `email | firstName | lastName | active | blocked` (Roles no se ordena); `order`: `asc | desc`. Ante empate, desempatar por email.
- Cada ítem: `{ id, firstName, lastName, email, active, blocked, roles: [{ id, name }] }`.
- Si `page` excede el total, devolver la última página existente.

Errores de validación: `4xx` con `{ detail, field? }`; `field` es el nombre del campo del formulario (`email`, `firstName`, `roleIds`, etc.) para que el front lo marque en el lugar correcto.

## Roles (US-07)

Requiere el permiso `roles.manage` en todos los endpoints.

| Endpoint | Body | Respuesta / notas |
|---|---|---|
| `GET /api/roles` | query (ver abajo) | `{ items, total, page, pageSize }`. |
| `GET /api/roles/:id` | — | `{ id, name, description, active, protected, usersCount, permissionsCount, permissions: [códigos] }`. `permissions` incluye los permisos que hoy están inactivos. |
| `GET /api/permissions` | — | `[{ code, name, active, permissions: [{ code, description, active }] }]`: módulos con sus permisos, **con el estado de cada uno**. |
| `POST /api/roles` | `{ name, description, active, permissionCodes }` | Rol creado. Errores `409` (nombre repetido) y `422` con `field`. |
| `PUT /api/roles/:id` | `{ description, permissionCodes }` | Rol actualizado. El nombre **no** se modifica. |
| `POST /api/roles/:id/deactivate` | — | Rol actualizado. |
| `POST /api/roles/:id/reactivate` | — | Rol actualizado. |
| `DELETE /api/roles/:id` | — | `204`. Con usuarios asignados: `409` informando que primero deben quitarse las asignaciones. |

`GET /api/roles?name=&description=&active=&sort=name&order=asc&page=1&pageSize=10`: `name` y `description` por coincidencia parcial sin distinguir
mayúsculas y **sin espacios en los bordes**; `active` `true`/`false`; `sort`: `name | description | active | usersCount | permissionsCount`.
Cada ítem: `{ id, name, description, active, protected, usersCount, permissionsCount }`. `permissionsCount` es la cantidad total de relaciones
rol-permiso, **incluidas las de permisos hoy inactivos**.

Reglas que deben aplicarse en el servidor:

- **Nombre**: obligatorio, normalizado (bordes y espacios internos múltiples), único sin distinguir mayúsculas, inmutable. **Descripción**: obligatoria.
- Un rol puede existir **sin permisos**. Se crea activo por defecto, o inactivo.
- Solo pueden **asignarse** permisos activos de módulos activos (`422` con `field: "permissionCodes"`). Los ya asociados que quedaron inactivos se conservan o se quitan, pero no pueden volver a agregarse.
- **Inactivar** no borra las relaciones con permisos: al reactivar, el rol vuelve a otorgarlos. Mientras esté inactivo, los usuarios conservan el rol pero este no otorga permisos. Un rol inactivo no se asigna a nuevos usuarios.
- Los cambios en roles **no afectan sesiones abiertas**: se reflejan en el próximo login.
- **Rol protegido Administrador** (`protected: true`): se consulta, pero `PUT`, `deactivate` y `DELETE` responden `403`.
- **Eliminar** (activo o inactivo) solo si no tiene usuarios; elimina también sus relaciones con permisos.
- **Auditoría**: alta (valores iniciales), cambios de descripción y de permisos (valor anterior y nuevo), activación, inactivación y eliminación (se conservan los valores previos y sus permisos).

## Mi perfil (US-11)

Cualquier usuario autenticado, sin permiso específico. El actor y el afectado son siempre el propio usuario.

| Endpoint | Body | Respuesta / notas |
|---|---|---|
| `GET /api/me` | — | `{ id, email, firstName, lastName }`. No devuelve roles, permisos ni datos internos de seguridad. |
| `PUT /api/me` | `{ firstName, lastName }` | Perfil actualizado. Normaliza ambos campos; si no hay cambio real, **no modifica ni audita**. Audita valor anterior y nuevo. |
| `POST /api/me/password` | `{ currentPassword, newPassword }` | `204`. Audita el cambio **sin ningún valor de contraseña**. |

Contraseña actual incorrecta: **`422` con `field: "currentPassword"`, nunca `401`** (el front interpreta un 401 con token como sesión vencida y la cierra).
Ese error **no incrementa** `failedAttempts`, **no bloquea** la credencial y **no genera** evento de auditoría. Si el usuario o su dominio pasan a inactivos con la sesión abierta, el endpoint
sigue disponible. Un cambio exitoso invalida de inmediato la contraseña anterior para futuros logins, pero **no cierra ninguna sesión** (ni esta ni las demás).
Si un administrador generó una contraseña temporal con la sesión abierta, la contraseña "actual" válida es esa contraseña temporal.

## Seguridad (no delegable al front)

- Las contraseñas se hashean con un algoritmo lento y con sal (bcrypt, argon2, scrypt). El mock usa SHA-256 con sal solo para simular la forma del dato; **no es apto para producción**.
- El permiso `users.manage` (y el resto) se valida en cada endpoint, no solo se oculta en el menú.
- El JWT de Google se verifica del lado del servidor.

## Módulos y permisos (US-06)

Catálogo **definido por el sistema** (sin ABM en la aplicación):

- Módulo: `{ code, name, description, active, order }`. Iniciales: Administración, Modelos, Predicción.
- Permiso: `{ code, description, active, module }` (pertenece a exactamente un módulo).

| Código | Descripción | Módulo |
|---|---|---|
| `users.manage` | Gestión de usuarios | Administración |
| `roles.manage` | Gestión de roles | Administración |
| `domains.manage` | Gestión de dominios | Administración |
| `audit.view` | Consulta de auditoría | Administración |
| `system.view` | Consulta del sistema | Administración |
| `models.manage` | Gestión de modelos | Modelos |
| `predictions.use` | Uso de modelos | Predicción |

**Permisos efectivos** = unión de los permisos de los roles **activos** del usuario, siempre que el permiso **y su módulo** estén activos.
El estado del usuario y del dominio **no** entra en este cálculo (se valida solo al autenticar). Inactivar un módulo o un rol no borra
asociaciones: al reactivarlo, los permisos vuelven a ser efectivos.

El login devuelve en `user.permissions` solo los **códigos efectivos**; el front arma el menú con eso. Eso no reemplaza la validación:
cada endpoint debe verificar el permiso efectivo (403 si no lo tiene), aunque el usuario conozca la URL.

`system.view` (panel **Sistema**) **no figura en la US-06**: se agregó para poder mostrar el panel de infraestructura. Falta confirmar con
el equipo si queda así o si se define una historia para ese módulo.

## Panel Sistema (ya conectado al backend real)

Lo consume `src/features/system/`. No usa el cliente `/api` ni envía token: el backend aún no tiene autenticación. En modo `mock` el panel muestra estados
simulados y no consulta nada de esto.

`GET http://<host>:8000/health` →
```json
{ "status": "ONLINE | DEGRADED", "service": "backend-api",
  "dependencies": { "postgres": "ONLINE|OFFLINE", "rabbitmq": "...", "redis": "...", "minio": "...", "otel": "..." } }
```
El front lee `status`, `postgres`, `rabbitmq` y `redis`. Keycloak (`/realms/tpp-realm`) y MinIO (`:9002/minio/health/live`) se consultan
directo desde el navegador, solo para saber si responden (`no-cors`).

El navegador llama al puerto 8000 directamente porque `nginx/default.conf` no publica `/health` (solo `/api/`, que va a `backend:8000/api/`).
Si se publica por nginx, alcanza con definir `REACT_APP_BACKEND_URL` (ver `.env.example`) y reconstruir.
