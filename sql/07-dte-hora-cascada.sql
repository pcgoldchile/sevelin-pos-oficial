-- ============================================================
-- SEVELIN POS — DTE, hora editable, descuento de stock al entregar
-- y corrección de eliminación en cascada
-- Archivo: sql/07-dte-hora-cascada.sql
-- Ejecutar en Supabase → SQL Editor, después de los scripts 01 a 06.
-- Es idempotente: puede correrse varias veces sin efectos secundarios.
-- ============================================================

-- ============================================================
-- 1. FIX CRÍTICO: eliminación en cascada de venta_items
--    Este es el error "venta_items_venta_id_fkey" al borrar ventas:
--    la restricción existía SIN "ON DELETE CASCADE", así que Postgres
--    bloqueaba el borrado de una venta que aún tuviera ítems.
-- ============================================================
ALTER TABLE venta_items DROP CONSTRAINT IF EXISTS venta_items_venta_id_fkey;
ALTER TABLE venta_items
  ADD CONSTRAINT venta_items_venta_id_fkey
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;

-- Mismo criterio para las demás relaciones que cuelgan de una venta o de una OT
ALTER TABLE ot_repuestos DROP CONSTRAINT IF EXISTS ot_repuestos_ot_id_fkey;
ALTER TABLE ot_repuestos
  ADD CONSTRAINT ot_repuestos_ot_id_fkey
  FOREIGN KEY (ot_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE;

ALTER TABLE encargo_abonos DROP CONSTRAINT IF EXISTS encargo_abonos_encargo_id_fkey;
ALTER TABLE encargo_abonos
  ADD CONSTRAINT encargo_abonos_encargo_id_fkey
  FOREIGN KEY (encargo_id) REFERENCES encargos(id) ON DELETE CASCADE;

-- Limpieza de ítems huérfanos que hayan quedado de intentos fallidos previos
DELETE FROM venta_items
 WHERE venta_id IS NOT NULL
   AND venta_id NOT IN (SELECT id FROM ventas);

-- ============================================================
-- 2. DTE: Boleta / Factura / Sin DTE
-- ============================================================
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS tipo_dte TEXT DEFAULT 'SIN DTE';

UPDATE ventas SET tipo_dte = 'SIN DTE' WHERE tipo_dte IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ventas_tipo_dte_check') THEN
    ALTER TABLE ventas
      ADD CONSTRAINT ventas_tipo_dte_check CHECK (tipo_dte IN ('BOLETA', 'FACTURA', 'SIN DTE'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ventas_tipo_dte ON ventas (tipo_dte);

-- ============================================================
-- 3. Marca de tiempo real de la venta (fecha + hora en un solo campo).
--    Permite ordenar y auditar correctamente cuando se edita la hora.
-- ============================================================
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS vendida_en TIMESTAMP WITH TIME ZONE NULL;

-- Se rellena con lo ya registrado (fecha + hora en texto), interpretado
-- como hora de Chile.
UPDATE ventas
   SET vendida_en = (fecha::text || ' ' || COALESCE(NULLIF(hora, ''), '12:00') || ':00')::timestamp
                    AT TIME ZONE 'America/Santiago'
 WHERE vendida_en IS NULL
   AND fecha IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_vendida_en ON ventas (vendida_en DESC);

-- ============================================================
-- 4. Descuento de stock al ENTREGAR la orden de trabajo
--    (antes se reservaba al asociar el repuesto). Esta bandera evita
--    descontar dos veces el mismo ítem.
-- ============================================================
ALTER TABLE ot_repuestos
  ADD COLUMN IF NOT EXISTS stock_descontado BOOLEAN DEFAULT FALSE;

UPDATE ot_repuestos SET stock_descontado = FALSE WHERE stock_descontado IS NULL;

-- Las órdenes YA entregadas se marcan como descontadas, para que una
-- futura corrección no vuelva a descontarles stock.
UPDATE ot_repuestos r
   SET stock_descontado = TRUE
  FROM ordenes_trabajo o
 WHERE o.id = r.ot_id
   AND o.estado = 'ENTREGADO'
   AND r.stock_descontado = FALSE;

-- ============================================================
-- 5. Comprobaciones rápidas (descomenta para revisar)
-- ============================================================
-- SELECT tipo_dte, COUNT(*), SUM(total) FROM ventas GROUP BY tipo_dte;
-- SELECT numero_orden, fecha, hora, vendida_en FROM ventas ORDER BY id DESC LIMIT 10;
-- SELECT conname, confdeltype FROM pg_constraint WHERE conname = 'venta_items_venta_id_fkey';
--   (confdeltype debe ser 'c' = CASCADE)
