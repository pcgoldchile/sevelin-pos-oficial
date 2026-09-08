-- ============================================================
-- SEVELIN POS — Migración 39
-- Aviso de garantía por vencer
-- ------------------------------------------------------------
-- POR QUÉ
-- El módulo Garantías (sql/31) ya sabe cuándo vence cada garantía, pero
-- ese dato solo servía para responder un reclamo: alguien llegaba con un
-- equipo malo y se consultaba si estaba cubierto. Nadie avisaba ANTES.
--
-- Avisar a los 30 días de que venza convierte un dato pasivo en atención
-- postventa: el cliente revisa su equipo mientras todavía está cubierto,
-- y de paso se entera de que existimos otra vez. Ningún competidor de
-- Arica lo hace — y para hacerlo solo hacía falta saber a quién ya se le
-- avisó, que es lo que agregan estas dos columnas.
--
-- POR QUÉ UN TIMESTAMP Y NO UN BOOLEANO
-- "¿Ya le avisé?" y "¿cuándo?" son la misma pregunta a distinta
-- profundidad. Con la fecha se puede volver a avisar meses después sin
-- perder el registro anterior, y se sabe si el aviso salió a tiempo o
-- encima de la fecha de vencimiento. Un booleano habría que resetearlo
-- a mano y no cuenta nada.
--
-- Idempotente. Aplicar con:
--   npx supabase db query --file sql/39-aviso-garantia.sql --linked
-- ============================================================

ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS aviso_garantia_en TIMESTAMPTZ;

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS aviso_garantia_en TIMESTAMPTZ;

COMMENT ON COLUMN venta_items.aviso_garantia_en IS
  'Cuándo se le avisó al cliente que la garantía de ESTE producto estaba por vencer. NULL = todavía no se le avisa.';

COMMENT ON COLUMN ordenes_trabajo.aviso_garantia_en IS
  'Cuándo se le avisó al cliente que la garantía de esta reparación estaba por vencer. NULL = todavía no se le avisa.';

-- La consulta real del panel es "lo que vence pronto y NO tiene aviso".
-- Índice parcial sobre las filas sin avisar: son las únicas que importan,
-- y con el tiempo van a ser la minoría.
CREATE INDEX IF NOT EXISTS idx_venta_items_sin_aviso_garantia
  ON venta_items (venta_id)
  WHERE aviso_garantia_en IS NULL;
