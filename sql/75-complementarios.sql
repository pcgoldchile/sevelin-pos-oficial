-- 75 · "Complementa tu compra": productos complementarios de cada producto
-- ===================================================================
-- Pedido del dueño (30-09-2026): en la ficha de sevelin.cl, un carrusel con
-- productos relacionados (pasta térmica, limpieza, cables...) que él pueda
-- elegir desde el POS: cuáles y cuántos.
--
-- Lista ordenada de ids de `productos`. Se guarda SOLO por
-- PUT /api/productos/:id/relacionados (valida que existan y no estén
-- archivados), no por el guardado general del producto. Viaja a la tienda
-- sola: el trigger trg_sync_tienda (sql/22) manda la fila completa y el
-- receptor la copia a productos_web.relacionados_pos_ids (supabase/38 de
-- sevelin-tienda, que se aplicó ANTES que esta).
--
-- Sin FK por elemento (Postgres no las tiene en arreglos): si un producto
-- de la lista se borra, la tienda simplemente no lo encuentra y no lo
-- muestra. No crea tablas. Idempotente.

alter table productos add column if not exists relacionados_ids bigint[] not null default '{}';

comment on column productos.relacionados_ids is
  'Complementarios para "Complementa tu compra" en la tienda, en orden (máx. 12).';
