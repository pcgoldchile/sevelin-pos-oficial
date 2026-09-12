-- 44 · Cuántas unidades vienen en camino
-- ======================================
-- EL PROBLEMA (detectado por el dueño el 12-09-2026)
-- Un producto marcado "por llegar" quedaba sin tope de compra: el carrito
-- permitía hasta 99 unidades aunque en la tienda hubiera una sola. Si
-- alguien compraba cinco, el pago se cobraba y el descuento de stock
-- fallaba, dejando el pedido en ERROR_STOCK_SIN_DESPACHO y al dueño con
-- plata cobrada por mercadería que no tiene.
--
-- LA REGLA QUE PIDIÓ EL DUEÑO
-- El cliente solo puede comprar lo que existe. Si hay stock en tienda, ese
-- es el tope. Si no hay nada todavía, se puede reservar hasta la cantidad
-- que el dueño declara que viene — nunca más.
--
-- Por eso la cantidad que viene la define él a mano y no se deduce de
-- nada: es el único que sabe cuántas pidió al proveedor.
--
-- Idempotente.

alter table productos
  add column if not exists stock_por_llegar integer not null default 0;

comment on column productos.stock_por_llegar is
  'Unidades que vienen en camino, declaradas a mano. Es el tope de lo que se puede RESERVAR cuando el stock real es 0. Con stock disponible manda el stock real: nunca se vende lo que no va a existir.';
