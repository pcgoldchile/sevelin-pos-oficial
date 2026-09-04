-- Borradores de producto: se crean solos al agregar la primera foto de un
-- producto nuevo (ver crearBorradorProducto() en js/productos.js), para no
-- perder las fotos si se cierra el navegador antes de terminar de
-- completar la ficha y guardar de verdad.
-- ------------------------------------------------------------
-- `es_borrador` se pone en true SOLO en ese autoguardado; cualquier click
-- real en "Guardar Producto" lo deja en false, sea un producto nuevo o uno
-- ya existente (ver construirPayloadProducto()). GET /api/productos lo
-- excluye del catálogo normal (venta, POS, reportes) por defecto, mismo
-- criterio que `archivado` — no se mezclan borradores a medio llenar con
-- el catálogo real. Se ven aparte en Productos → "📝 Borradores".
ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_borrador boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_productos_es_borrador ON productos(es_borrador);
