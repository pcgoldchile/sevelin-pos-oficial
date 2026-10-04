-- 86 · Redondeo hacia arriba en la venta (v123, 04-10-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 04-10-2026)
-- "Redondear la compra: si pagaron con efectivo y redondeamos, por ejemplo,
-- de $19.990 a $20.000", y un campo para escribir el total a cobrar.
--
-- QUÉ GUARDA
-- Cuando el total cobrado queda POR ENCIMA de la suma de los productos (los
-- $10 del ejemplo), la diferencia se guarda acá. Hasta hoy esos pesos
-- quedaban en el cajón sin venta que los explicara, y el arqueo salía con
-- sobrante.
--
--   total = suma de los ítems − descuento_monto + ajuste_redondeo
--
-- · Redondear hacia ABAJO no usa esta columna: es un descuento en pesos
--   (sql/35), con las mismas reglas de margen de siempre.
-- · Nunca conviven descuento y redondeo hacia arriba: si hay descuento,
--   ajuste_redondeo es 0.
-- · El tope ($1.000) y la validación viven en el servidor
--   (api/index.js::ajusteRedondeoValido). Para cobrar más que eso se cambia
--   el precio del producto o se agrega el servicio: no es un redondeo.
-- · Es ingreso de la venta: suma a `total` y a `utilidad`.
--
-- Las ventas existentes quedan en 0 por el DEFAULT: no hace falta backfill.
-- No crea tablas (no hay RLS que revisar). Idempotente.

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS ajuste_redondeo NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ventas_ajuste_redondeo_check'
  ) THEN
    ALTER TABLE ventas
      ADD CONSTRAINT ventas_ajuste_redondeo_check CHECK (ajuste_redondeo >= 0);
  END IF;
END $$;

COMMENT ON COLUMN ventas.ajuste_redondeo IS
  'Pesos que el total cobrado quedó por ENCIMA de la suma de los ítems al '
  'redondear en la caja (ej. $19.990 → $20.000 = 10). 0 si no hubo. Nunca '
  'convive con descuento_monto. total = ítems − descuento_monto + ajuste_redondeo. '
  'Lo valida el servidor (api/index.js::ajusteRedondeoValido), con tope de $1.000.';

-- ============================================================
-- VERIFICACIÓN
--   Debe aparecer la columna, y ninguna venta con redondeo todavía.
-- ============================================================
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'ventas' AND column_name = 'ajuste_redondeo';

SELECT count(*) AS ventas, count(*) FILTER (WHERE ajuste_redondeo > 0) AS con_redondeo
  FROM ventas;
