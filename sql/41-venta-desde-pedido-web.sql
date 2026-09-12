-- 41 · Las ventas de la tienda web entran al historial del POS
-- ============================================================
-- EL PROBLEMA (encontrado el 12-09-2026 por el dueño)
-- Un pedido pagado en sevelin.cl descontaba stock —vía
-- POST /api/interno/ajustar-stock— pero NUNCA creaba una venta. El
-- resultado: el inventario bajaba y el ingreso no aparecía en ninguna
-- parte.
--
-- Eso no es un detalle de presentación, descuadra el negocio entero:
-- Historial de Ventas, utilidad, margen, ticket promedio, punto de
-- equilibrio y el informe semanal quedaban todos cortos, y el inventario
-- mostraba salidas sin venta que las explicara. El dueño lo notó porque la
-- venta de la balanza del 12-09 no aparecía en su historial del día.
--
-- LA SOLUCIÓN
-- El webhook de la tienda, además de ajustar stock, registra la venta en
-- el POS (POST /api/interno/registrar-venta-web). Esta columna guarda el
-- número del pedido que la originó y es lo que hace la operación
-- IDEMPOTENTE: las pasarelas reintentan sus notificaciones, y sin un
-- candado el mismo pedido entraría dos o tres veces al historial.
--
-- El UNIQUE es parcial (solo donde no es null) para no estorbar a las
-- ventas presenciales, que son la enorme mayoría y nunca tienen pedido.
--
-- origen_pago ya existía con 'presencial'/'transferencia' y estaba
-- pensado justo para esto ("cuando llegue el e-commerce"): las ventas web
-- entran como 'web'.
--
-- Idempotente.

alter table ventas
  add column if not exists pedido_web_numero text;

create unique index if not exists ventas_pedido_web_numero_key
  on ventas (pedido_web_numero)
  where pedido_web_numero is not null;

comment on column ventas.pedido_web_numero is
  'Número del pedido de sevelin.cl que originó esta venta (WEB-000009). NULL en las ventas presenciales. El índice único evita que un reintento del webhook de la pasarela duplique la venta.';
