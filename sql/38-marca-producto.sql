-- ============================================================
-- SEVELIN POS — Migración 38
-- Marca del producto
-- ------------------------------------------------------------
-- POR QUÉ
-- El feed de catálogo para Meta Commerce y Google Merchant (v53) exige
-- el campo `brand`, y el catálogo del POS no tenía dónde guardarlo: se
-- estaba mandando "Sevelin" en todas las filas, que es lo que hace un
-- retailer sin datos de marca pero rinde bastante peor. Google Shopping
-- usa la marca para entender y clasificar el producto — un "SSD Kingston
-- A400 960GB" con marca Kingston compite en las búsquedas de Kingston;
-- el mismo producto con marca "Sevelin", no.
--
-- OJO CON LA TRAMPA
-- La marca es de QUIEN FABRICA el producto, no de para qué sirve. Un
-- "Cargador para notebook HP" no es marca HP: es un genérico compatible
-- con HP. Rellenar esto mal es peor que dejarlo vacío, porque Google
-- puede penalizar la cuenta por datos incorrectos. Por eso el campo
-- nace NULL en todo el catálogo y se llena a mano, producto por
-- producto, no con un script que adivine desde el nombre.
--
-- Idempotente. Aplicar con:
--   npx supabase db query --file sql/38-marca-producto.sql --linked
-- ============================================================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS marca TEXT;

COMMENT ON COLUMN productos.marca IS
  'Marca del fabricante (Kingston, MSI, HP…). NULL cuando es genérico o no se sabe. Se usa como `brand` en el feed de Meta/Google. No es "compatible con": un cargador para HP no es marca HP.';

-- Para el desplegable de marcas ya usadas en el modal de producto, y
-- para agrupar el catálogo por marca. Parcial: los genéricos van en NULL
-- y no vale la pena indexarlos.
CREATE INDEX IF NOT EXISTS idx_productos_marca
  ON productos (marca)
  WHERE marca IS NOT NULL;
