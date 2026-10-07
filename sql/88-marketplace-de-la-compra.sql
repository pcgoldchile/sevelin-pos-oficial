-- ============================================================
-- 88 · Por dónde se compró: marketplace aparte del vendedor (07-10-2026)
-- ------------------------------------------------------------
-- Pedido del dueño: cuando compra en MercadoLibre anota el proveedor como
-- "VENDEDOR / MERCADOLIBRE", todo en un campo. Quiere las dos cosas
-- separadas para poder ver cuánto compra en cada marketplace y a cada
-- vendedor.
--
-- `proveedor` sigue siendo a quién se le compró (el vendedor o la tienda).
-- `marketplace` es la plataforma por la que se compró (MercadoLibre,
-- Falabella, AliExpress…). NULL = compra directa o no anotado: es opcional
-- y las compras anteriores quedan como están.
--
-- Columna nueva en una tabla que ya tiene RLS. Idempotente.
-- ============================================================

alter table ingresos_mercaderia
  add column if not exists marketplace text null;

comment on column ingresos_mercaderia.marketplace is
  'Plataforma por la que se hizo la compra (MercadoLibre, Falabella…). NULL = compra directa o sin anotar. El vendedor va en proveedor.';

create index if not exists ingresos_mercaderia_marketplace_idx
  on ingresos_mercaderia (marketplace) where marketplace is not null;
