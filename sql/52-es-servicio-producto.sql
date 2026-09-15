-- 52 · Marca "Es un servicio" propia del producto
-- ==============================================
-- EL PROBLEMA (dueño, 15-09-2026)
-- El POS marcaba un ítem como servicio al venderlo SOLO si el producto estaba
-- en la categoría web "Servicios Técnicos". Un servicio que no se publica en
-- la tienda (ej. "Desbloqueo de Cuenta Google Samsung A02s") no tiene
-- categoría web, así que se vendía como producto y falseaba el resumen
-- "Ventas: productos vs. servicios" de Finanzas.
--
-- LA REGLA
-- `productos.es_servicio` se marca en la ficha del producto, sin depender de la
-- tienda. El POS considera servicio: es_servicio = true O categoría web
-- "Servicios Técnicos" (se mantiene por compatibilidad).
-- No se deriva de stock_ilimitado: ese campo también lo usan productos físicos
-- sin control de stock exacto (Rollos Térmicos, Disipador CPU).
--
-- Se marcan de una vez los que ya están en "Servicios Técnicos".
--
-- Idempotente.

alter table productos
  add column if not exists es_servicio boolean not null default false;

comment on column productos.es_servicio is
  'TRUE = es un servicio (mano de obra), aunque no esté publicado en la tienda. El POS lo marca como servicio al venderlo. Independiente de stock_ilimitado.';

update productos
   set es_servicio = true
 where categoria_web = 'Servicios Técnicos'
   and es_servicio = false;
