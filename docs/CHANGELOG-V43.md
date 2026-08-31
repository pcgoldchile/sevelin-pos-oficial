# CHANGELOG v43 — Panel "Más buscados" (31-08-2026)

## Qué se hizo

Segundo ítem del roadmap pedido por el usuario (métricas, cupones, newsletter, etiquetas, más
buscados) — "productos mas buscados, o productos mas cotizados, (que han clickeado)".

- **`GET /api/pos/mas-buscados`** (nuevo, `auth(true)`): lee `eventos_web` de Supabase Web con `dbWeb`
  (mismo cliente que ya usa Pedidos Web) filtrando por `?dias=N` (7/30/90, default 30), y agrega en JS:
  términos de búsqueda más frecuentes (normalizados a minúsculas/trim para agrupar variantes de
  mayúsculas, mostrando la primera forma tal cual se escribió) y productos con más vistas de ficha
  (cruzados contra `productos` del propio POS para traer nombre/SKU/precio — un producto puede haberse
  borrado desde que se vio, en ese caso se muestra "(producto eliminado)" en vez de romper la lista).
- **Subtab nuevo "🔍 Más buscados"** dentro de "Página Web" (junto a Pedidos Web y Categorías): dos
  tablas lado a lado, con un selector de período. `js/pagina-web.js::cargarMasBuscados()` /
  `renderMasBuscados()`.
- **`API.masBuscados.obtener(dias)`** en `js/api.js`, mismo patrón que `pedidosWeb`.
- Los eventos los registra `sevelin-tienda`, no este repo — ver
  `sevelin-tienda/docs/CHANGELOG-V22.md`.

## Cómo se probó

- `node --check api/index.js`, `node --check js/pagina-web.js`, `node --check js/api.js` — limpios.
- Los dos chequeos de colisión del CLAUDE.md (funciones e ids duplicados) — ambos vacíos.
- **La lógica de agregación se probó aislada** (Map de términos/vistas, normalización de mayúsculas,
  descarte de eventos vacíos/nulos) contra datos simulados en un script Node aparte — no se pudo
  probar el endpoint completo con `curl` porque el backend real necesita variables de entorno que solo
  carga Vercel (`node api/index.js` local no las lee, no hay `dotenv` — mismo criterio que siempre en
  este repo, ver "Cómo probar" del CLAUDE.md). Se avisa explícitamente: **no se probó el endpoint
  HTTP real de punta a punta**, solo su lógica de agregación.

## Pendiente

1. **Desplegar `sevelin-tienda`** para que empiece a registrar eventos reales — hasta entonces el
   panel va a mostrar "todavía no hay búsquedas/vistas registradas" (comportamiento correcto, no un
   bug).
