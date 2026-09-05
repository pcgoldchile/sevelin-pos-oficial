-- 35-descuento-venta.sql
-- ------------------------------------------------------------
-- Descuento aplicado al TOTAL de una venta (no a ítems individuales), ya
-- sea un monto fijo o un porcentaje. Ver api/index.js (calcularDescuentoMonto,
-- totalizar) y js/pos.js.
--
-- `descuento_tipo` / `descuento_valor` guardan lo que el cajero eligió tal
-- cual (para poder mostrarlo de nuevo, ej. "10%" en vez de solo el monto).
-- `descuento_monto` es el monto real en pesos ya descontado, SIEMPRE
-- calculado en el servidor a partir del subtotal de los ítems (nunca se
-- confía en un monto que mande el navegador) — es lo que se resta de
-- `total`, y por lo tanto lo que se resta de `utilidad` (total - costo_total):
-- un descuento sale directo del margen, nunca del costo.
--
-- Los pedidos ya existentes quedan con descuento_monto/valor=0 y
-- descuento_tipo=NULL vía los DEFAULT — no hace falta backfill.
--
-- Idempotente: se puede correr más de una vez sin romper nada.

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS descuento_tipo TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS descuento_valor NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS descuento_monto NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ventas_descuento_tipo_check'
  ) THEN
    ALTER TABLE ventas
      ADD CONSTRAINT ventas_descuento_tipo_check
      CHECK (descuento_tipo IS NULL OR descuento_tipo IN ('MONTO', 'PORCENTAJE'));
  END IF;
END $$;

COMMENT ON COLUMN ventas.descuento_tipo IS
  'NULL si la venta no tuvo descuento. "MONTO" (pesos) o "PORCENTAJE" — lo '
  'que eligió el cajero en el carrito. Ver js/pos.js.';
COMMENT ON COLUMN ventas.descuento_valor IS
  'El número que escribió el cajero tal cual (ej. 10 para "10%", o 5000 '
  'para "$5.000") — solo para volver a mostrarlo. El monto real descontado '
  'es descuento_monto.';
COMMENT ON COLUMN ventas.descuento_monto IS
  'Monto real en pesos descontado del subtotal de los ítems para llegar a '
  '`total` — calculado SIEMPRE en el servidor (api/index.js::calcularDescuentoMonto), '
  'nunca confiado del navegador. Se resta también de la utilidad (un '
  'descuento sale del margen, no del costo).';

-- ============================================================
-- VERIFICACIÓN
--   Deben aparecer las tres columnas.
-- ============================================================
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'ventas' AND column_name LIKE 'descuento_%';
