# CHANGELOG V26 — 26 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v26.

E-commerce — Fase 5: panel "Pedidos Web" dentro del POS. Único módulo de gestión que faltaba fuera
del modal de producto (README-ECOMMERCE-SEVELIN.md sección 2.1: *"para ver y despachar las compras
que llegan de internet. Es lectura + cambio de estado de envío, no un back-office nuevo."*). No
toca `sevelin-tienda`.

---

## 0. Decisión de arquitectura, confirmada con el usuario antes de programar

El README maestro (sección 5) dejaba abierto cómo el POS iba a leer `pedidos_web`: consultando
Supabase Web directo, o a través de un endpoint de solo lectura expuesto por la tienda. El usuario
eligió **Supabase Web directo**: el POS guarda sus propias credenciales `service_role` del proyecto
Supabase Web (las mismas que ya usa `sevelin-tienda`). En la práctica esto es lectura Y escritura
acotada (el panel cambia `estado`/`tracking_courier`), no estrictamente "solo lectura" — se deja
así de claro en vez de sobrevender la restricción.

## 1. Segundo cliente Supabase — primera vez en este repo

`api/index.js`: `dbWeb = createClient(SUPABASE_WEB_URL, SUPABASE_WEB_SERVICE_ROLE_KEY, {...})`,
mismo patrón que el `db` ya existente. Nunca se mezcla con `db`: `dbWeb` solo se usa dentro de las
dos rutas nuevas de abajo. `SUPABASE_WEB_URL`/`SUPABASE_WEB_SERVICE_ROLE_KEY` agregadas a
`.env.example` y al bloque de variables documentadas al inicio del archivo, con `console.warn` si
faltan (mismo criterio que `SYNC_SECRET`).

## 2. `GET /api/pos/pedidos-web` y `PUT /api/pos/pedidos-web/:id`

Ambas con `auth(true)` (admin) — el README lo pide explícito para este panel, a diferencia de
`/api/encargos` que usa `auth()` (cualquier trabajador).

- `GET`: lista `pedidos_web` ordenada por `creado_en` descendente, filtro opcional `?estado=`. Sin
  paginación (mismo criterio que `encargos`, volumen bajo).
- `PUT`: body `{ estado?, tracking_courier? }`.
  - `estado` solo acepta `PREPARANDO`/`ENVIADO`/`ENTREGADO`/`CANCELADO` — nunca `CREADO`/`PAGADO`/
    `FALLIDO`: esos son del ciclo de pago, los controla el mutex de `POST /api/flow-webhook` en
    `sevelin-tienda` (Fase 3), no un click de un trabajador.
  - Se rechaza (409) si el pedido sigue en `CREADO`/`FALLIDO` — no hay pago confirmado, nada que
    despachar todavía.

## 3. Frontend

- `index.html`: botón de nav `🌐 Pedidos Web` (`admin-only`), sección `view-pedidos-web` con chips
  de filtro por estado + tabla (mismo estilo `data-table` que Encargos), y el modal
  `#modalPedidoWeb` (molde: el modal de envío de `js/historial.js` — badge de estado + `<select>` +
  input de tracking — más una vista de solo lectura de cliente/dirección/ítems/totales/boleta,
  porque acá el trabajador necesita ver QUÉ despachar, no solo cambiar un estado).
- `js/pedidos-web.js` (nuevo): `cargarPedidosWeb()`, `renderPedidosWebTabla()`,
  `abrirModalPedidoWeb()`, `guardarPedidoWeb()`. Se carga al entrar a la vista escuchando el
  `CustomEvent 'pos:vista-activa'` que `config.js` ya dispara para cualquier vista — mismo patrón
  que usa `finanzas-gate.js`, sin tocar `config.js`.
- `js/api.js`: namespace nuevo `API.pedidosWeb` (`listar`, `actualizar`).

## 4. Pruebas

- `node --check` en `api/index.js`, `js/api.js`, `js/pedidos-web.js`: sin errores.
- Chequeo de funciones globales duplicadas (`js/*.js`) y de `id` duplicados (`index.html`): ambos
  vacíos.
- **Backend**, doble en memoria de Supabase (mock de `createClient` vía `require.cache`,
  `app.listen(0)` contra el `app` real, 4 pedidos simulados en distintos estados): 11
  verificaciones — `GET` sin filtro y con `?estado=`, `PUT` sin token (401), `PUT` con estado no
  permitido (400), `PUT` sobre pedido `CREADO`/`FALLIDO` (409 en ambos), `PUT` válido
  `PAGADO→PREPARANDO` con tracking (200, persiste el cambio). Las 11 pasaron.
- **Frontend**, jsdom concatenando los `js/*.js` en el orden real de `index.html` y evaluando sobre
  el DOM completo: 15 verificaciones — nav/sección admin-only, `cargarPedidosWeb()` renderiza la
  fila con botón "Gestionar", `abrirModalPedidoWeb()` llena cliente/dirección/ítems/boleta,
  `guardarPedidoWeb()` llama a `API.pedidosWeb.actualizar` con el payload correcto y cierra el
  modal. Las 15 pasaron. (Nota técnica encontrada y documentada en `docs/SNAPSHOT.md`: un `const`
  de nivel superior dentro de `window.eval()` no queda como propiedad de `window` — las aserciones
  tuvieron que ir concatenadas dentro del mismo string evaluado.)
- **No se probó contra Supabase Web real** ni con pedidos reales (no existe el proyecto Supabase
  Web real todavía — ver `docs/SNAPSHOT.md`).

## 5. Siguiente sesión

Lee `docs/SNAPSHOT.md` primero. Bloqueante para ver pedidos reales en este panel: que exista el
proyecto Supabase Web real y que `SUPABASE_WEB_URL`/`SUPABASE_WEB_SERVICE_ROLE_KEY` estén
configuradas en Vercel (mismas credenciales que ya usa `sevelin-tienda`). Fase 6 (QA end-to-end +
dominio `sevelin.cl`) es la última fase del plan — ver `README-ECOMMERCE-SEVELIN.md` sección 8.
