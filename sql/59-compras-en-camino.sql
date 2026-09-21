-- ============================================================
-- 59 · Compras que todavía no llegaron (21-09-2026)
-- ------------------------------------------------------------
-- "Por llegar" vivía solo en `productos` (sql/42): tres campos sueltos en
-- la tarjeta de Tienda web que había que acordarse de llenar, y otra vez
-- de vaciar cuando la mercadería llegaba. Pero es exactamente lo mismo
-- que una COMPRA que todavía no tienes en la mano.
--
-- Estas dos columnas dejan esa compra marcada como en camino, para poder
-- cerrarla con un botón cuando llega: ahí recién sube el stock y el
-- producto deja de estar "por llegar" en la tienda (lo que dispara el
-- correo a quienes lo estaban esperando).
--
-- NO se duplica el estado del producto: `productos.por_llegar` sigue
-- siendo el que manda en sevelin.cl. Acá solo se sabe QUÉ compra está en
-- camino, que es lo que faltaba para poder cerrarla de a una.
-- ============================================================

alter table ingresos_mercaderia
  add column if not exists en_camino   boolean not null default false,
  add column if not exists recibido_en timestamptz null;

comment on column ingresos_mercaderia.en_camino is
  'TRUE = comprada pero todavía no llega. No sumó stock al registrarse.';
comment on column ingresos_mercaderia.recibido_en is
  'Cuándo se marcó como recibida. Al ponerse, sube el stock del producto.';

-- Las que están en camino son las que hay que mirar: índice parcial.
create index if not exists idx_ingresos_en_camino
  on ingresos_mercaderia (producto_id) where en_camino = true;
