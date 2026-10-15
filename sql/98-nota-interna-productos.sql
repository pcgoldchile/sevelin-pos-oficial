-- 98 · Nota interna del producto (dueño, 15-10-2026)
-- ===============================================================
-- POR QUÉ: la masilla térmica (#364) llevaba "(insumo del taller)" en el NOMBRE
-- para que en el POS se supiera, y el nombre sale tal cual en sevelin.cl. El
-- dueño pidió que eso sea "una etiqueta interna o algo interno que no salga en la web".
--
--   nota_interna   texto libre solo para el POS ("insumo del taller", "no
--                  reponer", "el del mostrador está rayado"). La tienda NO la
--                  recibe: /api/sync/producto copia campo por campo y este no
--                  está en la lista.
--
-- Idempotente. Deja escrita la nota de la masilla que antes vivía en el nombre.

alter table productos add column if not exists nota_interna text null;

alter table productos drop constraint if exists productos_nota_interna_largo;
alter table productos add constraint productos_nota_interna_largo
  check (nota_interna is null or length(nota_interna) <= 500);

update productos set nota_interna = 'Insumo del taller: la unidad en stock es para usar en reparaciones. En la web va por encargo.'
where id = 364 and nota_interna is null;

select id, nombre, nota_interna from productos where nota_interna is not null;
