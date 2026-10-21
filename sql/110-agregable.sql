-- 110 · "➕ Agregable": un accesorio opcional por producto (pedido del dueño, 21-10-2026)
-- ===================================================================
-- "Quiero una opción (opcional y que me pregunte con la IA) de agregar un
-- adaptador HDMI a VGA en los monitores que no tengan HDMI nativo… tanto en
-- el texto de la tienda, Facebook, y un botón de agregar en la misma página
-- del monitor, tipo agregable."
--
-- Distinto de "Complementa tu compra" (relacionados_ids, sql/75, un carrusel
-- al final de la ficha): es UNO solo y va en el cuadro de compra de
-- sevelin.cl, con una casilla. También sale como bloque "➕ OPCIONAL" en el
-- texto de Facebook e Instagram (js/redes-texto.js), con el precio del día.
--
-- Se guarda SOLO por PUT /api/productos/:id/agregable, no por el guardado
-- general del producto. Viaja a la tienda solo: el trigger trg_sync_tienda
-- manda la fila completa y el receptor la copia a productos_web
-- (supabase/48 de sevelin-tienda, que se aplicó ANTES que esta).
--
-- Si el producto agregado se borra, el campo queda vacío (on delete set null).
-- No crea tablas. Idempotente.

alter table productos add column if not exists agregable_id bigint references productos(id) on delete set null;
alter table productos add column if not exists agregable_motivo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_agregable_no_mismo') then
    alter table productos add constraint productos_agregable_no_mismo
      check (agregable_id is null or agregable_id <> id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'productos_agregable_motivo_largo') then
    alter table productos add constraint productos_agregable_motivo_largo
      check (agregable_motivo is null or char_length(agregable_motivo) <= 140);
  end if;
end $$;

comment on column productos.agregable_id is
  'Accesorio opcional del cuadro de compra en sevelin.cl y del bloque "➕ OPCIONAL" en redes (ej. adaptador HDMI a VGA).';
comment on column productos.agregable_motivo is
  'Para qué sirve el agregable, en una frase corta (máx. 140 letras).';
