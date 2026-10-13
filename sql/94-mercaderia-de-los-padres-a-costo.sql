-- 94 · Mercadería de los padres: entra sin compra y con costo por confirmar
-- ===============================================================
-- POR QUÉ (dueño, 13-10-2026): la mercadería de sus padres pasó a ser suya y
-- se la entregan A COSTO, a cambio de hasta $3.000.000 en pagos semanales.
-- No es una compra ("es como un intercambio") y sus padres no tienen el costo
-- ni el stock precisos: mientras cuenta, los pone al ojo y los va corrigiendo.
-- Quiere saber, al terminar de contar, si toda esa mercadería a costo vale
-- más o menos que los $3.000.000.
--
--   productos.costo_provisorio   el costo (y el stock) son al ojo, por
--                                confirmar. Mientras esté marcado, cambiar el
--                                costo en la ficha corrige también las capas
--                                PEPS vivas: el costo no queda congelado.
--   ajustes_stock.motivo         admite 'padres': unidades que entregaron los
--                                padres. Suben el stock sin dejar una compra
--                                en ingresos_mercaderia.
--
-- Idempotente. No cambia ninguna fila.

alter table productos add column if not exists costo_provisorio boolean not null default false;

comment on column productos.costo_provisorio is
  'Costo y stock al ojo, por confirmar (mercadería de los padres). Con esto marcado, el costo de la ficha manda también sobre las capas PEPS vivas.';

alter table ajustes_stock drop constraint if exists ajustes_stock_motivo_check;
alter table ajustes_stock add constraint ajustes_stock_motivo_check
  check (motivo in ('danado', 'perdido', 'conteo', 'compra', 'padres'));

select count(*) as productos,
       count(*) filter (where propietario in ('PADRES', 'AMBOS')) as de_los_padres,
       count(*) filter (where costo_provisorio) as con_costo_por_confirmar
from productos;
