# CHANGELOG v42 — Etiqueta destacada de producto (31-08-2026)

## Qué se hizo

Primer ítem del roadmap pedido por el usuario (métricas, cupones, newsletter, etiquetas, más
buscados) — "una opción para yo mismo ver y marcar los productos de NOVEDAD o TENDENCIA, u OFERTAS
IRRESISTIBLES, que puedan aparecer tanto en el POS como en la página web".

- **`sql/28-etiqueta-web.sql`** (aplicada): columna `productos.etiqueta_web` (texto, nullable, check
  `NULL | 'NOVEDAD' | 'TENDENCIA' | 'OFERTA'`). Una sola etiqueta por producto — no es multi-select, el
  pedido decía "o" entre las tres opciones.
- **Modal de producto** (`index.html`, tarjeta "Tienda web"): select nuevo "Etiqueta destacada" con
  las 3 opciones + "Sin etiqueta", junto al resto de controles de la tienda web (publicar, precio web,
  umbral de stock).
- **`js/productos.js`**: `elProdEtiquetaWeb` se carga/limpia igual que el resto de campos del editor,
  viaja en el payload de `guardarProducto()`, y se muestra como texto corto (`etiquetaWebTexto()`) en
  la fila de la tabla de productos, junto a SKU/S/N/Repuesto.
- **`api/index.js`**: `etiqueta_web` agregado a `CAMPOS_PRODUCTO` y a `sanearProducto()` — solo acepta
  los 3 valores válidos o NULL, cualquier otra cosa se descarta en vez de dejar que el check
  constraint rechace todo el guardado.
- **Sincronización a la tienda**: no hizo falta tocar el trigger (`sql/22`, manda `to_jsonb(NEW)`
  completo) — con la columna nueva ya viaja sola. Del lado de `sevelin-tienda` se agregó
  `productos_web.etiqueta_web` (misma migración numerada, `supabase/12-etiqueta-web.sql`), el mapeo en
  `POST /api/sync/producto`, y un badge (`EtiquetaProductoBadge`) en la tarjeta de producto y en la
  ficha — ver el changelog de ese repo.

## Cómo se probó

- `node --check api/index.js`, `node --check js/productos.js` — limpios.
- Los dos chequeos de colisión del CLAUDE.md (funciones duplicadas entre `js/*.js`, ids duplicados en
  `index.html`) — ambos vacíos.
- **Prueba real de punta a punta contra producción**: se puso `etiqueta_web = 'OFERTA'` directo en un
  producto real (`UPDATE productos ... WHERE id = 99`) y se confirmó que el trigger de sincronización
  disparó hacia `sevelin-tienda` en menos de 30 segundos (`productos_web.sincronizado_en` se actualizó)
  — el pipeline sigue sano. La columna `etiqueta_web` llegó vacía del otro lado porque el código nuevo
  del receptor (`POST /api/sync/producto`) todavía no está desplegado en Vercel — comportamiento
  esperado, no un bug: en cuanto se despliegue la tienda, la sincronización ya no necesita ningún
  cambio más. Se revirtió el dato de prueba al terminar.
- El badge visual en la tienda se probó poniendo el valor directo en `productos_web` (server local +
  Browser pane) — aparece tanto en la tarjeta de la grilla como en la ficha de producto. Dato de prueba
  revertido al terminar.

## Pendiente

1. **Desplegar `sevelin-tienda`** para que el mapeo de `etiqueta_web` en `POST /api/sync/producto`
   quede activo — hasta entonces, marcar la etiqueta en el POS la guarda pero no la muestra en la
   tienda real.
