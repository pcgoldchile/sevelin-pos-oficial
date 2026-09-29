-- 71 · Precio de oferta web con fecha de inicio y fin (v100, 29-09-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 29-09-2026, preparando el Cyber del 05-10-2026)
-- La tienda no sabía mostrar ofertas: cada producto tenía un solo precio.
-- La etiqueta "OFERTA" (sql/28) es solo un letrero, no cambia lo que se cobra.
--
-- LA REGLA
--   · precio_oferta_web: el precio rebajado en sevelin.cl. El precio "antes"
--     que ve el cliente es el precio web normal (precio_web, o precio_unitario
--     si no hay uno web): el que se cobra hoy. Nunca uno inventado (SERNAC
--     fiscaliza justamente eso en los Cyber).
--   · oferta_desde / oferta_hasta: la oferta empieza y termina SOLA a esa
--     hora. No hay que acordarse de apagarla. La tienda decide en cada visita
--     si está vigente, así que no depende de ningún cron.
--   · Solo aplica a la tienda web. La venta en el local sigue con su precio.
--   · Las validaciones de negocio (menor que el precio normal, fin después del
--     inicio, que no haya terminado ya, que no sea "precio a consultar") las
--     hace la API; acá va la forma mínima para que un dato roto nunca quede
--     guardado aunque alguien escriba directo en la base.
--
-- Viaja a la tienda solo: el trigger trg_sync_tienda (sql/22) manda la fila
-- completa. La tienda lo recibe en productos_web (supabase/37 del otro repo).
-- Idempotente.

alter table productos add column if not exists precio_oferta_web numeric null;
alter table productos add column if not exists oferta_desde timestamptz null;
alter table productos add column if not exists oferta_hasta timestamptz null;

alter table productos drop constraint if exists productos_oferta_web_check;
alter table productos
  add constraint productos_oferta_web_check
  check (
    (precio_oferta_web is null and oferta_desde is null and oferta_hasta is null)
    or (precio_oferta_web > 0 and oferta_desde is not null and oferta_hasta is not null and oferta_hasta > oferta_desde)
  );

comment on column productos.precio_oferta_web is
  'Precio rebajado en la tienda web entre oferta_desde y oferta_hasta. NULL = sin oferta. No afecta la venta en el local.';
comment on column productos.oferta_desde is 'Inicio de la oferta web (la tienda la aplica sola desde esta hora).';
comment on column productos.oferta_hasta is 'Fin de la oferta web (la tienda la quita sola a esta hora).';
