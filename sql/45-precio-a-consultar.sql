-- 45 · Precio a consultar
-- =======================
-- EL PROBLEMA (dueño, 12-09-2026)
-- Hay servicios técnicos cuyo precio depende del equipo: cambio de pantalla
-- de celular, bisagras de notebook, HDMI de consola, puerto USB-C/Micro USB,
-- mantenimiento de tarjeta de video. El valor publicado es solo un precio
-- base, pero la tienda dejaba agregarlos al carrito y pagarlos en línea a ese
-- precio: el cliente pagaba $25.000 por una pantalla que después cuesta más.
--
-- LA REGLA
-- Un producto con precio a consultar se muestra en la tienda, pero no se
-- puede comprar en línea: en vez de "Agregar al carrito" aparece "Cotizar por
-- WhatsApp", y el checkout de la tienda lo rechaza aunque alguien lo meta al
-- carrito por otro camino. En el POS se sigue cobrando normal, con el precio
-- que se pacte en el mostrador.
--
-- Se sincroniza a productos_web (sevelin-tienda/supabase/31-precio-a-consultar.sql)
-- por el Database Webhook de siempre.
--
-- Idempotente.

alter table productos
  add column if not exists precio_a_consultar boolean not null default false;

comment on column productos.precio_a_consultar is
  'El precio publicado es solo una base y depende del equipo: la tienda no permite comprarlo en línea, solo cotizar por WhatsApp. El POS lo cobra normal.';
