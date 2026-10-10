# Contrato front–backend

Mientras `FEATURES.USE_MOCK_API` esté en `true`, todo lo de acá lo resuelve
`src/mock/` (una base en el navegador). Cuando el backend esté listo:

1. Poner `USE_MOCK_API: false` en `src/config/features.js`.
2. Borrar la carpeta `src/mock/` (nada de ahí es parte del producto real).
3. Implementar estos endpoints. Todos van con `Authorization: Bearer <token>` salvo login/register/google.

## Autenticación (US-05)

| Endpoint | Body | Respuesta / notas |
|---|---|---|
| `POST /api/auth/login` | `{ email, password }` | `{ token, user }`. Ante cualquier falla: 401 con el mensaje genérico (no revelar el motivo real; auditarlo del lado del servidor). |
| `POST /api/auth/google` | `{ credential }` | Igual que login. El backend **debe verificar la firma** del JWT de Google y que el `aud` sea su Client ID. |
| `POST /api/auth/change-password` | `{ newPassword }` | `{ token, user }` con `mustChangePassword: false`. No pide la contraseña anterior (ya se validó en el login). |
| `POST /api/auth/register` | `{ name, email, password }` | `{ token, user }`. Solo si se mantiene el autoregistro. |
| `POST /api/auth/logout` | — | Invalida solo la sesión actual. |

`user` siempre trae: `{ id, name, email, roles: [{id,name}], permissions: string[], mustChangePassword }`.

## Usuarios (US-01 y US-02)

| Endpoint | Body | Respuesta / notas |
|---|---|---|
| `GET /api/users` | query (ver abajo) | `{ items, total, page, pageSize }`. Requiere permiso `users.manage`. |
| `GET /api/roles` | — | `[{ id, name, active }]`, incluye inactivos (el front filtra según la pantalla). |
| `GET /api/users/:id` | — | Detalle: agrega `blocked`, `failedAttempts`, `mustChangePassword`. |
| `POST /api/users` | `{ firstName, lastName, email, active, roleIds }` | `{ user, temporaryPassword }`. La contraseña se muestra una sola vez: no se vuelve a exponer en ningún GET posterior. |
| `PUT /api/users/:id` | `{ firstName, lastName, roleIds }` | Solo estos 3 campos. Email inmutable. Auditar valor anterior y nuevo por campo modificado. Rechazar si `id` es el propio actor (403). |
| `POST /api/users/:id/deactivate` | — | Rechazar sobre uno mismo (403). |
| `POST /api/users/:id/reactivate` | — | `{ user, temporaryPassword }`, una sola vez. **Siempre** genera contraseña temporal nueva (la anterior queda inválida) y deja `active=true`, `blocked=false`, `failedAttempts=0`, `mustChangePassword=true`. No cierra sesiones abiertas. Rechazar sobre uno mismo (403). |
| `POST /api/users/:id/temporary-password` | — | `{ user, temporaryPassword }`, una sola vez. Rechazar sobre uno mismo (403). |

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
| `models.manage` | Gestión de modelos | Modelos |
| `predictions.use` | Uso de modelos | Predicción |

**Permisos efectivos** = unión de los permisos de los roles **activos** del usuario, siempre que el permiso **y su módulo** estén activos.
El estado del usuario y del dominio **no** entra en este cálculo (se valida solo al autenticar). Inactivar un módulo o un rol no borra
asociaciones: al reactivarlo, los permisos vuelven a ser efectivos.

El login devuelve en `user.permissions` solo los **códigos efectivos**; el front arma el menú con eso. Eso no reemplaza la validación:
cada endpoint debe verificar el permiso efectivo (403 si no lo tiene), aunque el usuario conozca la URL.

`GET /api/health` queda como diagnóstico de conexión (pantalla `/sistema`, fuera del menú porque no es un módulo de la US-06).
