-- ============================================================
-- Módulo Garantías (productos + servicios técnicos)
-- ------------------------------------------------------------
-- Productos: condición (nuevo/reacondicionado) + meses de garantía
-- configurables, default 6 en ambos casos.
-- venta_items: snapshot de condición/meses al momento de vender — si el
-- producto cambia después, las ventas ya hechas no se mueven (mismo
-- criterio que el snapshot de nombre/sku que ya tiene esta tabla).
-- ordenes_trabajo: mismo campo de meses de garantía, se completa recién
-- al entregar el equipo (POST /api/ot/:id/entrega).
-- Idempotente: seguro de correr más de una vez.
-- ============================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS condicion TEXT NOT NULL DEFAULT 'nuevo';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productos_condicion_check') THEN
    ALTER TABLE productos ADD CONSTRAINT productos_condicion_check
      CHECK (condicion IN ('nuevo', 'reacondicionado'));
  END IF;
END $$;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS meses_garantia INTEGER NOT NULL DEFAULT 6;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productos_meses_garantia_check') THEN
    ALTER TABLE productos ADD CONSTRAINT productos_meses_garantia_check CHECK (meses_garantia >= 0);
  END IF;
END $$;

ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS condicion TEXT;
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS meses_garantia INTEGER NOT NULL DEFAULT 6;

ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS meses_garantia INTEGER NOT NULL DEFAULT 6;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_trabajo_meses_garantia_check') THEN
    ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_meses_garantia_check
      CHECK (meses_garantia >= 0);
  END IF;
END $$;
