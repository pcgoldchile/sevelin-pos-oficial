# CHANGELOG v44 — Panel "Métricas" (31-08-2026)

## Qué se hizo

Tercer ítem del roadmap pedido por el usuario — "total de visitas en la página web", "total de
carritos compartidos", "cantidad de usuarios creados" (dejó newsletter y cupones para después).

- **`GET /api/pos/metricas`** (nuevo, `auth(true)`): 6 consultas `count` (con `head: true`, PostgREST
  cuenta sin traer filas) en paralelo contra `dbWeb`:
  - `eventos_web` tipo `visita` → total histórico + últimos 30 días.
  - `carritos_web` `origen='compartido'` → total de carritos compartidos.
  - `carritos_web` `origen='checkout' AND numero_pedido IS NULL` → carritos abandonados.
  - `carritos_web` `origen='checkout' AND numero_pedido IS NOT NULL` → carritos que sí terminaron en
    compra (dato extra, no pedido explícito, pero se desprende gratis de la misma tabla).
  - `perfiles_clientes` → cuentas de cliente reales (no invitados).
- **Subtab nuevo "📊 Métricas"** dentro de "Página Web": 4 tarjetas KPI reutilizando `.kpi-card` (mismo
  componente visual que Encargos/Finanzas). `js/pagina-web.js::cargarMetricasWeb()` /
  `renderMetricasWeb()`.
- **`API.metricasWeb.obtener()`** en `js/api.js`.

## Por qué "visitas" es nuevo en `sevelin-tienda` (no existía nada parecido)

El contador de "visitas" necesitó tracking nuevo del lado de la tienda que no existía: un componente
cliente (`VisitTracker`, montado en el layout raíz) que reacciona a `usePathname()` — el layout raíz de
Next (Server Component) NO se vuelve a ejecutar en cada navegación del App Router (persiste entre
rutas), así que solo un componente cliente puede contar cada cambio de página real. Ver
`sevelin-tienda/docs/CHANGELOG-V23.md` para el detalle completo.

## Cómo se probó

- `node --check api/index.js`, `node --check js/pagina-web.js`, `node --check js/api.js` — limpios.
- Los dos chequeos de colisión del CLAUDE.md — ambos vacíos.
- **Las 6 consultas se probaron equivalentes con SQL directo** contra la base real (mismo criterio que
  "Más buscados": no se pudo levantar el backend local completo por las variables de entorno de
  Vercel) — los números coincidieron con lo esperado. Se encontró y limpió un dato de prueba que había
  quedado de una sesión anterior (1 carrito compartido de prueba nunca borrado) para que la métrica
  arranque en cero de verdad.
- **No probado**: el endpoint HTTP real con autenticación de punta a punta (mismo aviso que
  `mas-buscados`, ver `docs/CHANGELOG-V43.md`).

## Pendiente

1. **Desplegar `sevelin-tienda`** para que `VisitTracker` empiece a contar visitas reales — hasta
   entonces esa tarjeta va a mostrar 0.
