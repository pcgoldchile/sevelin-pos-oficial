-- 111 · Servicios y productos "por equipo": marca y modelo al venderlos (dueño, 22-10-2026)
-- ===================================================================
-- "Servicios que abarquen muchas marcas y modelos, para no crear un servicio
-- de cada modelo y marca, y que al momento de agregar ese servicio se me
-- permita clasificar de qué marca y modelo era, y aparte que el costo igual
-- varía mucho… lo mismo para otros servicios y productos del mismo estilo,
-- láminas y centros de carga, etc."
--
--   productos.pide_equipo      la ficha marca "al venderlo, pregunta marca y
--                              modelo" (ej. Cambio de Pantalla, Desbloqueo FRP,
--                              láminas, centros de carga). Un solo producto para
--                              todos los modelos.
--   venta_items.equipo_marca   lo que se eligió en la caja para ESA venta
--   venta_items.equipo_modelo  (el precio y el costo de esa línea ya se guardaban
--                              aparte: costo_unitario / precio_unitario).
--
-- El nombre de la línea además lleva " · Marca Modelo" (así lo ven el ticket,
-- el historial y las garantías sin cambiar nada más); las columnas sirven para
-- contar y sugerir. No crea tablas. Idempotente.

alter table productos add column if not exists pide_equipo boolean not null default false;
alter table venta_items add column if not exists equipo_marca text;
alter table venta_items add column if not exists equipo_modelo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venta_items_equipo_marca_largo') then
    alter table venta_items add constraint venta_items_equipo_marca_largo
      check (equipo_marca is null or char_length(equipo_marca) between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venta_items_equipo_modelo_largo') then
    alter table venta_items add constraint venta_items_equipo_modelo_largo
      check (equipo_modelo is null or char_length(equipo_modelo) between 1 and 60);
  end if;
end $$;

-- Para sugerir las marcas y modelos más usados sin recorrer todas las ventas
create index if not exists venta_items_equipo_idx on venta_items (equipo_marca, equipo_modelo) where equipo_marca is not null;

comment on column productos.pide_equipo is 'Al venderlo, la caja pregunta marca y modelo del equipo (y deja cambiar precio y costo). v176.';
comment on column venta_items.equipo_marca is 'Marca del equipo del cliente para un servicio o producto "por equipo" (sql/111).';
comment on column venta_items.equipo_modelo is 'Modelo del equipo del cliente (sql/111).';
