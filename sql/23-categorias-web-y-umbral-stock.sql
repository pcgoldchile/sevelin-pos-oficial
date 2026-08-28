-- ============================================================
-- SEVELIN POS — Migración 23
-- Categorías administrables del catálogo web (crear/ordenar) + umbral de
-- stock que se muestra en la tienda por producto (en vez del número exacto).
-- Ver módulo "Página Web → Categorías" en el POS.
--
-- categoria_web (texto libre, ya existía desde la migración 21) se
-- mantiene tal cual: sigue siendo el campo que sincroniza a
-- productos_web.categoria en la tienda, sin cambios ahí. categoria_id es
-- nuevo y es la FUENTE de ese texto en el POS — el modal de producto pasa
-- de un <input> libre a un <select> ligado a esta tabla, pero el nombre
-- elegido se sigue guardando en categoria_web como siempre. categoria_id
-- es interno del POS y NO se sincroniza a la tienda (no tiene contraparte
-- en el Supabase Web — el trigger de sync solo usa categoria_web).
--
-- stock_umbral_web: NULL = usa el default global de la tienda (5). Con
-- valor, la tienda muestra "Más de {umbral-1} disponibles" cuando
-- stock_web >= umbral, y el stock exacto cuando stock_web < umbral (nunca
-- se muestra abundancia falsa ni se oculta un stock realmente bajo).
-- ============================================================

create table if not exists producto_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

-- RLS: solo el backend (service_role, que bypasea RLS) entra a esta tabla
-- — mismo criterio que repuesto_categorias (sql/06-stock-ilimitado-areas-categorias.sql).
-- Sin políticas públicas a propósito: nunca se consulta con anon/authenticated.
alter table producto_categorias enable row level security;

alter table productos
  add column if not exists categoria_id uuid references producto_categorias(id) on delete set null,
  add column if not exists stock_umbral_web integer;

alter table productos
  drop constraint if exists productos_stock_umbral_web_check;
alter table productos
  add constraint productos_stock_umbral_web_check
  check (stock_umbral_web is null or stock_umbral_web >= 1);

create index if not exists idx_productos_categoria_id on productos(categoria_id);

-- ============================================================
-- VERIFICACIÓN
--   select * from producto_categorias;  -- debe existir, vacía al principio
--   select column_name from information_schema.columns
--    where table_name = 'productos' and column_name in ('categoria_id', 'stock_umbral_web');
--   -- debe devolver las 2 filas
-- ============================================================
