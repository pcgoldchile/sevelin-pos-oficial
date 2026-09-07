-- 36-medidas-actualizado-en.sql
-- ------------------------------------------------------------
-- Mismo criterio que stock_actualizado_en (ver api/index.js::sanearProducto):
-- un solo timestamp para peso_kg/alto_cm/ancho_cm/profundidad_cm juntos,
-- porque en el formulario ("Medidas y envío") se editan como grupo. Se
-- actualiza cada vez que se guarda el producto y CUALQUIERA de esos cuatro
-- campos viene en el body — no compara contra el valor anterior, igual que
-- stock_actualizado_en (documentado en el propio formulario: "se
-- registrará al guardar").
--
-- Los productos ya existentes quedan con NULL ("sin registro previo") —
-- no hace falta backfill.
--
-- Idempotente: se puede correr más de una vez sin romper nada.

ALTER TABLE productos ADD COLUMN IF NOT EXISTS medidas_actualizado_en TIMESTAMPTZ;

COMMENT ON COLUMN productos.medidas_actualizado_en IS
  'Fecha y hora del último guardado que tocó peso_kg/alto_cm/ancho_cm/'
  'profundidad_cm — ver api/index.js::sanearProducto. Un solo timestamp '
  'para las 4 medidas juntas, mismo criterio que stock_actualizado_en.';

-- ============================================================
-- VERIFICACIÓN
--   Debe aparecer la columna medidas_actualizado_en.
-- ============================================================
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'productos' AND column_name = 'medidas_actualizado_en';
