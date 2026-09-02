-- Archivar productos: retirarlos del POS/venta/tienda sin borrarlos.
-- ------------------------------------------------------------
-- Un producto con ventas reales (venta_items.producto_id) no se puede
-- eliminar: la base bloquea el borrado a propósito (integridad
-- referencial, ver api/index.js DELETE /api/productos/:id). Hasta ahora
-- la única forma de "retirarlo" era stock=0 + publicado_web=false, pero
-- seguía apareciendo en el buscador del POS/venta — un trabajador podía
-- agregarlo a una venta igual (fallaría por stock, pero es confuso).
--
-- `archivado` lo saca de raíz: GET /api/productos (usado por TODA la app —
-- venta, OT, mermas, lotes, reportes, no solo el módulo Productos, ver
-- productsList en productos.js) deja de devolverlo por defecto. Sigue
-- entero en la base, con su historial de ventas intacto, visible solo en
-- la vista "Ver: Archivados" del módulo Productos.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS archivado boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_productos_archivado ON productos(archivado);
