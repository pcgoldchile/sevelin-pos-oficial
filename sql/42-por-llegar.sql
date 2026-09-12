-- 42 · "Por llegar": productos que todavía no están en la tienda
-- ==============================================================
-- QUÉ RESUELVE
-- Dos situaciones que hoy terminan igual —el cliente se va— y no deberían:
--   (a) algo se agotó y va a reponerse,
--   (b) algo nuevo viene en camino y aún no llega.
-- En ambas el cliente ya quería comprar. Sin un lugar donde dejarlo
-- anotado o reservarlo, esa intención se pierde sin dejar rastro.
--
-- Un producto marcado `por_llegar` se puede RESERVAR pagando el 100%
-- (decisión del dueño, 12-09-2026), igual que un Pedido por Encargo —
-- reutiliza el mismo mecanismo de "comprar sin stock" que ya existía. La
-- diferencia con un Encargo es que esto es transitorio: viene en camino,
-- tiene fecha, y cuando llega deja de estar "por llegar".
--
-- SOBRE LA FECHA
-- `fecha_llegada_estimada` es ESTIMADA y así se muestra siempre, en la
-- ficha y en las Preguntas Frecuentes. No se le suma ningún margen
-- automático: el dueño pone la fecha que ya considera prudente, y sumarle
-- días por detrás lo haría quedar mal por una corrección que él no pidió.
--
-- SI NO LLEGA: devolución total. Es la regla del negocio y está escrita en
-- la tienda, no solo acá.
--
-- Apagar `por_llegar` es lo que marca "ya llegó" y dispara los avisos a
-- quienes estaban esperando (ver avisos_producto en la tienda).
--
-- Idempotente.

alter table productos
  add column if not exists por_llegar boolean not null default false;

alter table productos
  add column if not exists fecha_llegada_estimada date;

comment on column productos.por_llegar is
  'El producto viene en camino y todavía no está en tienda. Permite reservarlo pagando el 100% aunque el stock sea 0. Apagarlo = "ya llegó" y dispara los avisos pendientes.';

comment on column productos.fecha_llegada_estimada is
  'Fecha ESTIMADA de llegada, puesta a mano por el dueño. Se muestra siempre como estimada; no se le aplica ningún margen automático.';
