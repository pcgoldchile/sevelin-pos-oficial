-- 77 · Despacho cobrado en la web, guardado en la venta (v104, 01-10-2026)
-- ======================================================================
-- EL PROBLEMA (dueño, 01-10-2026, primer pedido web con despacho)
-- El pedido WEB-000012 cobró $41.500: $37.000 de productos + $4.500 de
-- despacho. La tienda le mandaba al POS los productos y la dirección, pero
-- no el monto del envío: la venta #245 quedó en $37.000 y los $4.500 que
-- entraron al banco no aparecían ni en el Detalle de Venta ni en Finanzas.
--
-- LA REGLA (aprobada por el dueño)
--   · ventas.envio_cobrado: lo que el cliente pagó por el despacho JUNTO
--     con esta venta (hoy, las ventas web). NULL = no se cobró despacho con
--     la venta, o no se sabe.
--   · ventas.total NO cambia: sigue siendo productos y servicios. El margen
--     de lo vendido no se mezcla con el despacho.
--   · El despacho es un ingreso APARTE: Finanzas lo suma a la plata recibida
--     y a la utilidad neta (que ya restaba el costo del viaje como gasto
--     "Envíos / Despachos" sin contar lo cobrado), y lo muestra en su propia
--     tarjeta: cobrado, gastado y resultado.
--   · envios.cobrado_cliente (sql/54) sigue siendo la nota del viaje. Al
--     anotar el costo del viaje de una venta web, el POS lo deja prellenado
--     con este monto.
--
-- Idempotente.

alter table ventas
  add column if not exists envio_cobrado numeric null check (envio_cobrado is null or envio_cobrado >= 0);

comment on column ventas.envio_cobrado is
  'Lo que el cliente pagó por el despacho junto con esta venta (ventas web). No forma parte de total: es un ingreso aparte del margen de productos (sql/77). NULL = sin despacho cobrado con la venta.';

-- Único pedido web con despacho anterior a este cambio (verificado contra
-- pedidos_web de la tienda el 01-10-2026: WEB-000012, costo_envio 4500).
update ventas set envio_cobrado = 4500
 where pedido_web_numero = 'WEB-000012' and envio_cobrado is null;
