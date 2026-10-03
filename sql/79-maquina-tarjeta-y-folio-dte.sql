-- 79 · Máquina de tarjetas y N° de boleta o factura en la venta (v108, 03-10-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 03-10-2026)
-- 1) Empezó a cobrar con una segunda máquina de tarjetas (Banchile Pagos,
--    contrato del 16-09-2026) y el POS solo conocía la de TUU: toda venta con
--    tarjeta se guardaba con la comisión de TUU (0,79% + $65), que no es la
--    de la máquina nueva (débito 0,6% + 0,0015 UF; crédito 1,53% + 0,0018 UF;
--    más IVA).
-- 2) Poder anotar el N° de la boleta o factura emitida en el SII, opcional al
--    vender, y un lugar para completarlo después en las ventas que no lo
--    tengan (desde el 03-10-2026 en adelante).
--
-- LA REGLA
--   · ventas.maquina_tarjeta: por cuál máquina pasó la tarjeta. NULL en una
--     venta que no se pagó con tarjeta, y en las ventas con tarjeta anteriores
--     a esta migración (todas pasaron por TUU: el POS las sigue leyendo así).
--   · venta_pagos.maquina_tarjeta: lo mismo por cada parte de un pago mixto.
--   · La comisión se sigue calculando SOLO en el servidor y queda guardada en
--     ventas.comision_pos: cambiar la tarifa mañana no mueve las ventas de hoy.
--   · ventas.dte_folio: el N° del documento (boleta, factura o comprobante de
--     la máquina). Texto, porque el SII y las máquinas no numeran igual.
--     Siempre opcional: nunca bloquea un cobro.
--
-- No crea tablas (no hay RLS nuevo que activar). Idempotente.

alter table ventas add column if not exists maquina_tarjeta text null;
alter table ventas drop constraint if exists ventas_maquina_tarjeta_check;
alter table ventas
  add constraint ventas_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE'));

alter table venta_pagos add column if not exists maquina_tarjeta text null;
alter table venta_pagos drop constraint if exists venta_pagos_maquina_tarjeta_check;
alter table venta_pagos
  add constraint venta_pagos_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE'));

alter table ventas add column if not exists dte_folio text null;
alter table ventas drop constraint if exists ventas_dte_folio_check;
alter table ventas
  add constraint ventas_dte_folio_check
  check (dte_folio is null or length(btrim(dte_folio)) between 1 and 30);

comment on column ventas.maquina_tarjeta is
  'Máquina por la que pasó la tarjeta: TUU o BANCHILE. NULL = no fue con tarjeta, o venta anterior a sql/79 (TUU).';
comment on column venta_pagos.maquina_tarjeta is
  'Máquina de la parte pagada con tarjeta en un pago mixto (sql/79).';
comment on column ventas.dte_folio is
  'N° de la boleta, factura o comprobante emitido por esta venta. Opcional (sql/79).';

-- Para la lista "ventas sin N° de documento" del Historial.
create index if not exists ventas_sin_folio_idx on ventas (fecha) where dte_folio is null;
