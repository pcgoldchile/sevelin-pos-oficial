-- ============================================================
-- SEVELIN POS — Migración 26
-- "Es servicio" por ítem de venta — para separar en Finanzas cuánto se
-- vendió en productos vs. en servicios, por fecha.
--
-- Va en venta_items (no en productos): un mismo producto del catálogo
-- podría venderse como servicio en un caso puntual, y sobre todo, el
-- pedido explícito es que funcione IGUAL con un ítem que no está
-- registrado en productos (nombre escrito a mano en el POS) — ahí no hay
-- ninguna fila de `productos` a la que engancharse.
-- ============================================================

alter table venta_items
  add column if not exists es_servicio boolean not null default false;

create index if not exists idx_venta_items_es_servicio on venta_items(es_servicio);

-- ============================================================
-- VERIFICACIÓN
--   select column_name from information_schema.columns
--    where table_name = 'venta_items' and column_name = 'es_servicio';
--   -- debe devolver 1 fila
-- ============================================================
