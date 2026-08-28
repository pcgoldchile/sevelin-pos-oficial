-- ============================================================
-- SEVELIN POS — Migración 24
-- Subcategorías del catálogo web: una categoría puede tener un padre
-- (parent_id). Se limita a 2 niveles a propósito (categoría → subcategoría,
-- sin nietos) — la validación de esa regla vive en el backend
-- (POST /api/productos/categorias rechaza parent_id que ya tenga padre).
--
-- ON DELETE CASCADE en parent_id: borrar una categoría padre borra sus
-- subcategorías con ella (no tiene sentido que queden huérfanas sin
-- contexto). Los productos que usaban esas subcategorías quedan con
-- categoria_id = NULL (el FK productos.categoria_id ya es ON DELETE SET
-- NULL desde la migración 23, se aplica igual venga la baja de un cascade
-- o de un DELETE directo).
-- ============================================================

alter table producto_categorias
  add column if not exists parent_id uuid references producto_categorias(id) on delete cascade;

create index if not exists idx_producto_categorias_parent_id on producto_categorias(parent_id);

-- ============================================================
-- VERIFICACIÓN
--   select column_name from information_schema.columns
--    where table_name = 'producto_categorias' and column_name = 'parent_id';
--   -- debe devolver 1 fila
-- ============================================================
