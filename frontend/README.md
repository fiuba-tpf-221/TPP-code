# Frontend — fiuba-tpf-221

React 18 + Create React App + React Router 6. Sin librería de UI: estilos propios en CSS.

## Dos modos de trabajo (un solo interruptor)

| Modo | Qué es | Cuándo usarlo |
|---|---|---|
| **`mock`** (por defecto) | Ambiente controlado: login, usuarios y panel Sistema **simulados** en el navegador. No necesita Docker ni backend; todas las pestañas funcionan. Se ve una pastilla **"Modo simulado"**. | Trabajar la interfaz día a día, probar las historias, demostrar. |
| **`keycloak`** | Integración real: el login lo hace el Keycloak de la infraestructura y el panel Sistema consulta los servicios reales. Los usuarios siguen simulados hasta que el backend los tenga. | Verificar la integración con la infraestructura del equipo. |

**Cómo cambiarlo** (cualquiera de las tres):

| Quién lo ve | Cómo |
|---|---|
| Solo vos, en desarrollo | `npm run start:mock` o `npm run start:keycloak` (dentro de `frontend/`) |
| Solo vos, con Docker | `REACT_APP_MODE=keycloak` en `frontend/.env` (copiar de `.env.example`) y `docker compose up -d --build frontend` |
| Todo el equipo | cambiar `DEFAULT_MODE` en `src/config/features.js` |

Caso suelto: login simulado pero panel Sistema real (con la infraestructura arriba): `REACT_APP_SIMULATE_INFRA=false`.

## Cómo se ejecuta

| Qué | Cómo |
|---|---|
| Desarrollo con recarga al guardar | dentro de `frontend/`: `npm install` y `npm start` → http://localhost:3000 (si está ocupado, CRA ofrece otro puerto) |
| Todo el stack (como lo levanta el `docker-compose.yml` de la raíz) | `docker compose up -d --build` y abrir http://localhost |
| Tests | `npm test -- --watchAll=false` |
| Build de producción local | `npm run build` |

`package.json` no define `proxy` a propósito: no se usa hoy (los usuarios son simulados) y hace que `npm start` falle en máquinas sin red activa.
Cuando haya endpoints reales para probar con `npm start`, agregar `"proxy": "http://localhost:8000"` (o un `src/setupProxy.js`).

Con Docker la app se compila y se sirve con nginx (`nginx.conf` incluido, necesario para que recargar `/usuarios`, `/sistema`, etc. no dé 404). No hay recarga al
guardar: para eso, `npm start`.

## Modo `mock`

- Usuario de prueba: `demo@tpp.com` / `demo1234` (Administrador). Ve las siete opciones del menú.
- Los datos viven en el `localStorage` del navegador. Para volver al estado inicial: DevTools → *Application* → *Storage* → *Clear site data*.
- **Panel Sistema:** muestra estados simulados y un selector de escenarios (todo en línea, backend degradado, backend caído, Keycloak caído) para ver cómo se
  muestra cada estado sin apagar contenedores.
- Para probar permisos: crear desde *Usuarios* un usuario con rol Analista, Operador o Consulta e ingresar con él (la contraseña temporal se muestra una sola vez).
  También se pueden crear roles propios desde *Roles* y asignarlos.
- Los permisos se calculan al iniciar sesión y se mantienen toda la sesión: un cambio en un rol se ve en el próximo login, no antes.

## Modo `keycloak`

El login lo hace el **Keycloak** de la infraestructura (flujo estándar con PKCE). La app muestra su propia pantalla de acceso (carrusel + ventana) y, al apretar
**Iniciar sesión**, pasa por Keycloak y vuelve.

- Usuario de prueba del realm: `testuser` / `password123`. **No tiene roles**, así que al entrar ve solo Inicio y Mi perfil.
  Para ver el menú completo hay que crear el rol `administrador` y asignárselo (pasos en `docs/pruebas-manuales.md`).
- La sesión se recupera sola al recargar. Se cierra a los 30 minutos sin actividad o desde el menú del usuario; en ambos casos se cierra también en Keycloak,
  así que el siguiente ingreso pide credenciales.
- Los permisos del menú salen de los roles del realm (`src/config/keycloakRoles.js`, provisorio hasta que el backend los entregue).
- Entrar siempre por **http://localhost**: PKCE necesita un contexto seguro y el navegador solo lo da para `localhost` o HTTPS.
- Las pantallas de usuarios y roles muestran un aviso: trabajan con datos de demostración que no existen en Keycloak.
- *Mi perfil* solo muestra los datos y un enlace a la cuenta de Keycloak: ahí se administran el nombre y la contraseña.

## Estructura

```
src/
├── app/          App.js (providers) y AppRouter.js (todas las rutas)
├── config/       interruptor de modo (features.js), rutas y menú, permisos, servicios de infraestructura
├── features/     una carpeta por funcionalidad
│   ├── auth/     acceso (Keycloak o simulado), sesión, permisos
│   ├── users/    consulta, alta y detalle de usuarios (incluye generar contraseña temporal)
│   ├── roles/    consulta, alta y detalle de roles, con sus permisos por módulo
│   ├── system/   panel Sistema (estado de infraestructura y consolas)
│   ├── home/
│   ├── profile/  Mi perfil: datos personales y cambio de contraseña
├── shared/       componentes, layout, cliente HTTP y utilidades reutilizables
├── mock/         "backend" simulado en el navegador: se borra cuando exista el real
└── styles/       estilos globales
docs/contrato-backend.md   endpoints que el front espera del backend
docs/pruebas-manuales.md   lista de pruebas manuales para cada modo
```

Para **agregar una pantalla**: crear la página en su feature, sumar la `<Route>` en `app/AppRouter.js` y, si va en el menú, un ítem en
`config/routes.js` con el permiso que corresponda (que también debe existir en `mock/db.js` y en el backend).

## Usuarios: mock vs. backend real

`USE_MOCK_API: true` en `src/config/features.js` usa `src/mock/` para usuarios (en cualquiera de los dos modos). Cuando el backend implemente los endpoints de
`docs/contrato-backend.md`, se pone en `false` y se borra `src/mock/`.

## Panel Sistema

`src/config/services.js` concentra puertos y URLs (los publicados en el `docker-compose.yml`). Se arman con el host desde el que se abrió la app, así que sirven
igual con `localhost` o con la IP de la máquina. Para otro backend: `REACT_APP_BACKEND_URL`.

## Variables de entorno

Ver `.env.example`. Las `REACT_APP_*` se incorporan **al construir**: si se cambian, hay que reconstruir la imagen (o reiniciar `npm start`).
