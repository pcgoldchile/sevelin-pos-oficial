-- ============================================================
-- SEVELIN POS — Migración 28
-- Etiqueta destacada de producto (NOVEDAD / TENDENCIA / OFERTA) — se marca
-- desde el modal de producto ("Tienda web" → Etiqueta destacada) y viaja al
-- mismo trigger de sincronización (sql/22) sin cambios, porque manda la fila
-- completa. La tienda la usa para mostrar un badge (ver
-- sevelin-tienda/supabase/12-etiqueta-web.sql).
-- ============================================================

alter table productos
  add column if not exists etiqueta_web text;

alter table productos
  drop constraint if exists productos_etiqueta_web_check;

alter table productos
  add constraint productos_etiqueta_web_check
  check (etiqueta_web is null or etiqueta_web in ('NOVEDAD', 'TENDENCIA', 'OFERTA'));

-- ============================================================
-- VERIFICACIÓN
--   select column_name from information_schema.columns
--    where table_name = 'productos' and column_name = 'etiqueta_web';
--   -- debe devolver 1 fila
-- ============================================================
