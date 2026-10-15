-- 96 · ¿De dónde vino el cliente? en cada venta
-- ===============================================================
-- POR QUÉ (dueño, 15-10-2026): casi nadie compra pasando por la calle; vende por
-- Facebook Marketplace, Instagram, WhatsApp y la página. Quiere juntar el dato
-- en cada venta para medir qué canal trae a los clientes y predecir.
--
--   origen_cliente   de dónde llegó quien compró. Opcional: null = no se anotó.
--                    Las ventas de sevelin.cl llegan solas como WEB.
--
-- Idempotente. No cambia ninguna fila: las ventas viejas quedan sin dato.

alter table ventas add column if not exists origen_cliente text null;

alter table ventas drop constraint if exists ventas_origen_cliente_valido;
alter table ventas add constraint ventas_origen_cliente_valido
  check (origen_cliente is null or origen_cliente in (
    'MARKETPLACE', 'INSTAGRAM', 'WEB', 'WHATSAPP', 'GOOGLE',
    'RECOMENDACION', 'VUELVE', 'TIENDA', 'OTRO', 'NO_SE'
  ));

select count(*) as ventas, count(origen_cliente) as con_origen from ventas;
