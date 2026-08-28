# v28 — módulo "Página Web" (Categorías) + backfill de imágenes 1:1

## 1. Módulo "Página Web" reorganizado con sub-pestañas
"Pedidos Web" (nivel superior, Fase 5) pasa a ser la primera sub-pestaña de un módulo nuevo
"🌐 Página Web" (mismo patrón de `<nav class="subtabs">` que Finanzas/Servicio Técnico —
`js/pagina-web.js::mostrarPanelPaginaWeb()`). La lógica de `js/pedidos-web.js` no cambió, solo cómo
se dispara su carga (antes escuchaba `pos:vista-activa` directo, ahora la llama
`mostrarPanelPaginaWeb('pedidos')`).

## 2. Categorías del catálogo web (nuevo)
Segunda sub-pestaña. Tabla nueva `producto_categorias` (`sql/23-categorias-web-y-umbral-stock.sql`):
`id, nombre, orden`. CRUD completo con reordenamiento por botones ▲▼ (intercambia `orden` con la
fila vecina, `PUT /api/productos/categorias/:id/mover`) — más simple que un batch de reordenamiento
para solo dos flechas. UI reutiliza el patrón visual ya existente de "Administrar Categorías" de
repuestos (`admin-cat-row`, edición in-place con Enter/Escape), pero como panel embebido en vez de
modal.

`productos.categoria_id` (FK nueva) es la fuente del `<select>` del modal de producto, mismo campo
`categoria_web` (texto) sigue siendo lo que sincroniza a la tienda — `categoria_id` es interno del
POS, el trigger de sync no lo necesita tocar (usa `to_jsonb(NEW)` automático, y el endpoint receptor
de la tienda solo lee `categoria_web`).

## 3. Umbral de stock por producto
`productos.stock_umbral_web` (nullable, `sql/23-categorias-web-y-umbral-stock.sql`). `NULL` = la
tienda usa su default (+5). Con valor, la tienda muestra "Más de {umbral-1} disponibles" en vez del
stock exacto cuando el stock alcanza el umbral. Nuevo campo en el modal de producto
(`prodStockUmbralWeb`). Viaja a la tienda vía el trigger de sync existente sin cambios de código ahí
(columna nueva en `productos`, `to_jsonb(NEW)` la incluye sola) — sí requirió agregar la columna
homónima en `productos_web` (`sevelin-tienda/supabase/04-stock-umbral-web.sql`, correr ANTES de
activar el guardado del umbral en el modal, para que el trigger no falle).

## 4. Backfill de imágenes de producto a 1:1
Nuevo `scripts/procesar-imagenes-1-1.js` (requiere `sharp`, agregado a `package.json`): recorre el
bucket `productos-imagenes`, deja en 800×800 con fondo blanco (letterbox, nunca recorta) y WebP
calidad 82 las fotos que no sean ya cuadradas — idempotente (una foto ya 1:1, incluida una ya
procesada por este script, se salta). Actualiza `imagen_urls` si cambia la extensión del archivo.
Al tocar `imagen_urls` el trigger de sync ya existente re-sincroniza el producto solo, sin pasos
extra. Las fotos NUEVAS ya salían así desde antes (`dibujarYComprimirFoto()` en `js/productos.js`,
Canvas 1000×1000 con fondo blanco) — este script es solo para el catálogo viejo. Corrido contra el
catálogo real: 0 productos con fotos todavía (nada que procesar por ahora, se re-ejecuta cuando
haya catálogo real cargado).

## Verificación
- `for f in js/*.js; do grep -oP '^\s*(async\s+)?function\s+\K[A-Za-z_$][\w$]*' "$f"; done | sort | uniq -d`
  y `grep -oP 'id="\K[^"]+' index.html | sort | uniq -d` — ambos vacíos.
- `node --check` en todos los `.js` tocados.
- `node scripts/procesar-imagenes-1-1.js` corrido contra Supabase real, sin errores.
- Endpoint `GET /api/productos/categorias` verificado en caliente (401 sin token, no 404 — la ruta
  está registrada).

## Pendiente
- Correr `sql/23-categorias-web-y-umbral-stock.sql` en el Supabase del POS.
- Correr `sevelin-tienda/supabase/04-stock-umbral-web.sql` en el Supabase Web ANTES de guardar
  cualquier umbral desde el modal de producto.
- Falta verificación visual en navegador del módulo "Página Web" completo (subtabs, alta/edición/
  borrado de categorías, select del modal) — no se pudo levantar el frontend estático del POS desde
  esta sesión (Express solo sirve `/api/*` en local; el HTML se sirve por hosting estático aparte).
