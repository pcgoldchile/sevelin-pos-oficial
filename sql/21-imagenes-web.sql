-- ============================================================
-- SEVELIN POS — Migración 21
-- E-commerce Fase 0: columnas de imagen y publicación web en `productos`.
-- Archivo: sql/21-imagenes-web.sql
-- Ejecutar después de la 20. Idempotente.
--
-- NOTA DE NUMERACIÓN: el plano maestro del e-commerce (README-ECOMMERCE-
-- SEVELIN.md) fue escrito contra la v16 y llama a este archivo
-- "sql/20-imagenes-web.sql". Para cuando se ejecutó la Fase 0 el repo ya
-- iba en v23 y sql/19 (stock atómico) y sql/20 (fix de esa función) ya
-- existían con otro contenido — ver docs/CHANGELOG-V24.md. Se corrió esta
-- migración como 21 para no pisar historial real ya aplicado en producción.
-- ============================================================
--
-- QUÉ AGREGA
--   `productos` gana las columnas necesarias para que el POS controle qué
--   se ve en la tienda pública (sevelin.cl), sin gestión aparte (ver
--   sección 2.1 del README-ECOMMERCE-SEVELIN.md — todo se administra desde
--   el modal de producto del POS):
--     · imagen_urls     — fotos ya procesadas (Canvas → webp) y subidas al
--                          bucket público `productos-imagenes`.
--     · publicado_web   — un producto puede existir en el POS y NO estar
--                          en la tienda; por defecto FALSE (nada se publica
--                          sin marcarlo a propósito).
--     · descripcion_web — ficha que ve el cliente (puede diferir del
--                          nombre corto usado en la caja).
--     · precio_web      — NULL = usa el precio normal del POS; con valor,
--                          la tienda muestra ese precio sin tocar la caja.
--     · categoria_web    — cómo se agrupa el producto en el catálogo
--                          público. No existía en el snippet SQL original
--                          del README (sección 4.1), pero sí se pide como
--                          control en el modal (punto 0.5 del prompt de
--                          esta fase, y sección 2.1 del README) — se agrega
--                          acá para que ese campo tenga dónde guardarse.
-- ============================================================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS imagen_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS publicado_web BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS descripcion_web TEXT,
  ADD COLUMN IF NOT EXISTS precio_web NUMERIC,
  ADD COLUMN IF NOT EXISTS categoria_web TEXT;

-- ============================================================
-- VERIFICACIÓN
--   Deben aparecer las 5 columnas nuevas.
-- ============================================================
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'productos'
   AND column_name IN ('imagen_urls', 'publicado_web', 'descripcion_web', 'precio_web', 'categoria_web')
 ORDER BY column_name;
