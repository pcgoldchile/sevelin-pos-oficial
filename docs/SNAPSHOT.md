# SNAPSHOT — Sevelin POS
> Pegar esto entero al abrir un chat nuevo. Actualizar SOLO esto al cerrar un chat.

**Fecha:** 18-08-2026 · **Versión activa:** v11 (en curso hacia v12) · **Rama/commit:** —

## Stack (fijo, no repetir análisis)
Node/Express (api/index.js, serverless Vercel) · JS vanilla ámbito global (js/*.js) · Supabase/PostgreSQL · JWT sessionStorage · Tailwind compilado (`npm run css`)

## En curso ahora mismo
- [ ] **M4a — Backend: migrar arqueo de caja de "por día" a "por turno" + caja chica.**
  Archivos: `api/index.js` (funciones y endpoints abajo). NO tocar frontend en este chat.

### Contexto obligatorio para M4a (no re-descubrir esto en el chat nuevo)
La migración `sql/17-caja-diaria-y-despacho.sql` **ya está aplicada en producción** y creó:
- `cajas_diarias`: turno de caja — `id, fecha_apertura, fecha_cierre, fondo_inicial, efectivo_esperado, efectivo_contado, diferencia, estado ('abierta'|'cerrada'), notas_cierre, abierta_por, cerrada_por`. Permite **varios turnos por día** (a diferencia del modelo viejo).
- `caja_movimientos`: ingresos/egresos rápidos de caja chica — `id, caja_id (FK), tipo ('INGRESO'|'EGRESO'), monto (>0), concepto, creado_en`.
- `ventas.caja_id` (columna nueva, FK a `cajas_diarias`, nullable) — **hoy nadie la escribe todavía**.
- `compras` e `inyecciones_capital` **NO tienen `caja_id`** (la migración no las tocó); si el turno no coincide con el día calendario habrá que decidir cómo filtrarlas (ver "Decisiones pendientes" abajo).

**El sistema viejo sigue vivo y funcionando** — no borrar sin plan de M4c:
- Tabla `arqueos`: una fila **por fecha** (no por turno). Endpoints actuales: `GET /api/arqueos`, `GET /api/arqueos/hoy`, `POST /api/arqueos/abrir`, `POST /api/arqueos/cerrar` (todos en `api/index.js`, buscar con `grep -n "arqueos" api/index.js`).
- Función clave a **reemplazar/adaptar**: `calcularEfectivoEsperado(fecha, fondoInicial)` en `api/index.js` (línea ~2192 al momento de este snapshot). Hoy suma: fondo inicial + ventas en efectivo del día + inyecciones de capital en efectivo − compras en efectivo (excluye origen MERMA). **Debe pasar a sumar/restar también `caja_movimientos` (INGRESO/EGRESO) del turno**, y a operar por `caja_id` en vez de por `fecha`.
- Frontend actual (`js/balance.js`: `confirmarAbrirCaja`, `abrirModalCerrarCaja`, `confirmarCerrarCaja`, arqueo ciego con denominaciones) consume `/api/arqueos/*` vía `js/api.js` (`API.balance.abrirCaja`, `API.balance.cerrarCaja`). **No tocar en M4a** — es tarea de M4b.

### Qué debe entregar M4a (backend puro, sin UI)
1. Endpoint abrir turno → insert en `cajas_diarias` (fondo_inicial, estado='abierta'). Validar que no haya otro turno 'abierta' ya (regla: solo una caja abierta a la vez, igual que hoy).
2. Endpoint cerrar turno → arqueo ciego (el esperado lo calcula el servidor, nunca el cliente — ver comentario de seguridad ya existente en el código viejo, mantener ese criterio).
3. Endpoint registrar movimiento rápido (ingreso/egreso) → insert en `caja_movimientos`, ligado al turno abierto.
4. Endpoint listar movimientos del turno activo.
5. El endpoint de creación de venta debe grabar `caja_id` = turno abierto actual (buscar el endpoint `POST` de ventas en `api/index.js`).
6. `calcularEfectivoEsperado` adaptado a turno + caja_movimientos.

### Decisiones pendientes a resolver EN el chat de M4a (preguntar al usuario, no asumir)
- ¿`compras` e `inyecciones_capital` se filtran por rango de fecha_apertura/fecha_cierre del turno (aproximado), o se les agrega `caja_id` también (más SQL)?
- ¿Qué pasa si se intenta crear una venta sin turno abierto? (¿bloquear, o permitir con `caja_id = null`?)
- Nombre exacto de las nuevas rutas REST (sugerido: `/api/cajas/abrir`, `/api/cajas/cerrar`, `/api/cajas/movimiento`, `/api/cajas/activa`) — confirmar con el usuario o mantener libertad de nombrarlas.

## Bugs conocidos activos
- (ninguno abierto — el de escáner se cerró en v11-fix, ver changelog)

## Funciones globales nuevas desde el último snapshot
- (ninguna; M3 solo modificó `cerrarEscaner` para ser async, mismo nombre)

## Esquema SQL: última migración aplicada
- `sql/17-caja-diaria-y-despacho.sql` → tablas `cajas_diarias`, `caja_movimientos`; columnas nuevas en `ventas` (`tipo_entrega`, `direccion_envio`, `notas_despacho`, `estado_envio`, `numero_seguimiento`, `origen_pago`, `comision_pasarela`, `caja_id`). Aplicada en producción. **Nota:** este mismo archivo también trae el modelo de despacho/envíos — es la base de M5, revisar cuando toque ese micro-entregable.

## Endpoints tocados en esta versión
- (ninguno aún — M4a los va a crear)

## Pendiente inmediato (orden acordado)
1. **M4a** — Backend turnos + caja chica (arrancar aquí, chat nuevo dedicado)
2. M4b — Frontend: modal de movimiento rápido + adaptar abrir/cerrar caja a turnos
3. M4c — Migrar histórico de `arqueos` a `cajas_diarias` (o archivarla) + limpiar endpoints viejos + actualizar README §10/11
4. M1 — Unificar los 5 helpers de escape en `escHtml` (pendiente, no bloqueante)
5. M5 — Envíos/despacho (comparte la misma migración 17 que M4 — revisar `ventas.tipo_entrega/estado_envio` cuando llegue el turno)
6. M6 — Ventas por pagar / abonos (sin explorar todavía)

## Refactor de archivos grandes (api/index.js, index.html)
Decisión tomada: **NO abordar ahora**, priorizar features. Reevaluar cuando el backlog de features esté más corto — ambos archivos siguen creciendo (api/index.js ya en ~3600 líneas) y en algún punto conviene partir `api/index.js` en routers por dominio.

---
# PROMPT DE ARRANQUE (usar en el chat nuevo de M4a)

"Eres el desarrollador de Sevelin POS (contexto ya cargado arriba en el SNAPSHOT). Hoy solo vamos a
trabajar en M4a: backend de turnos de caja (cajas_diarias) + caja chica (caja_movimientos), tal como
está descrito en la sección 'Qué debe entregar M4a'. No toques frontend. Antes de escribir código,
resuelve conmigo las 'Decisiones pendientes' listadas, y pídeme el fragmento de api/index.js que
necesites ver (dime el nombre de función o rango de líneas exacto) en vez de pedir el archivo completo."
