# CHANGELOG V25 — 26 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v25.

E-commerce — Fase 3 (checkout + pago), trabajado desde una sesión de Claude en el repo
`sevelin-tienda`. Único cambio en este repo: la ruta interna que la tienda necesita para
descontar stock tras confirmar un pago con Flow.

---

## 1. `POST /api/interno/ajustar-stock` (`api/index.js`)

Pendiente desde la Fase 0 (`docs/CHANGELOG-V24.md`, sección 0.1: "cuando se construya
`/api/interno/ajustar-stock` en la Fase 1, debe llamar a `descontar_stock_venta`"). No se construyó
en la Fase 1 de la tienda; se construye ahora, al empezar la Fase 3, que es cuando realmente se
necesita (el checkout llama a esta ruta justo después de confirmar un pago real con Flow).

- Protegida con `authSync` (nueva, junto a `auth()`): compara el header `x-sync-secret` contra
  `SYNC_SECRET` — **no** es JWT de staff, quien llama es el backend de `sevelin-tienda`, no una
  persona logueada. Mismo patrón que ya usa `POST /api/sync/producto` del lado tienda. Sin
  `SYNC_SECRET` configurado, la ruta rechaza todo por defecto (mismo criterio que `ADMIN_PIN`
  ausente).
- Body: `{ items: [{ producto_id, cantidad }] }`. Reutiliza `descontarStockNoLotes()` tal cual (ya
  existía, la usa `POST /api/ventas`) — llama a la RPC atómica `descontar_stock_venta`
  (`sql/19-stock-atomico.sql`), la misma que protege las ventas de caja contra sobreventa. Si algún
  producto no alcanza, la RPC lanza y no se descuenta nada del lote; se responde 409 con el mensaje
  de la excepción (`STOCK_INSUFICIENTE`).
- `SYNC_SECRET` agregado a `.env.example` y a la lista de variables documentadas al inicio de
  `api/index.js`.

## 2. Pruebas

- `node --check api/index.js`: sin errores.
- No se probó contra un Supabase real ni con una llamada real desde `sevelin-tienda` en esta
  sesión (sin credenciales Flow/OpenFactura ni proyecto Supabase Web real todavía — ver
  `sevelin-tienda/docs/SNAPSHOT.md`). Pendiente de probar de punta a punta una vez que ambos
  proyectos tengan credenciales reales.

## 3. Siguiente sesión

Nada más pendiente de este lado para la Fase 3: el resto del trabajo (checkout, Flow, OpenFactura)
vive enteramente en `sevelin-tienda`. Ver ese repo para el estado real de la Fase 3.
