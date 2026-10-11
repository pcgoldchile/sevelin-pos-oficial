-- 91 · Webpay como medio por el que entra una venta con tarjeta
-- ===============================================================
-- POR QUÉ (dueño, 11-10-2026): la tienda va a cobrar con tarjeta por Webpay
-- Plus de Transbank (sevelin-tienda/supabase/42). Esas ventas se anotan en el
-- POS como "Tarjeta Débito" o "Tarjeta Crédito", y maquina_tarjeta dice por
-- dónde entró la plata para calcular la comisión que corresponde:
--
--   TUU       máquina de Haulmer (0,79% + $65, más IVA)
--   BANCHILE  máquina del Banco de Chile (sql/79)
--   LINK_TUU  link de pago de Haulmer (sql/89), misma tarifa que TUU
--   WEBPAY    Webpay Plus en sevelin.cl (débito 1,49%, crédito 2,29%, más IVA)
--
-- WEBPAY no es una máquina del local y no se ofrece en la caja: solo lo
-- escribe /api/interno/registrar-venta-web cuando la tienda avisa una venta.
--
-- Idempotente. No cambia ninguna fila: solo amplía los valores permitidos.

alter table ventas drop constraint if exists ventas_maquina_tarjeta_check;
alter table ventas
  add constraint ventas_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE', 'LINK_TUU', 'WEBPAY'));

alter table venta_pagos drop constraint if exists venta_pagos_maquina_tarjeta_check;
alter table venta_pagos
  add constraint venta_pagos_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE', 'LINK_TUU', 'WEBPAY'));

alter table encargo_abonos drop constraint if exists encargo_abonos_maquina_tarjeta_check;
alter table encargo_abonos
  add constraint encargo_abonos_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE', 'LINK_TUU', 'WEBPAY'));

comment on column ventas.maquina_tarjeta is
  'Por dónde pasó la tarjeta: TUU, BANCHILE, LINK_TUU (link de pago de Haulmer, sql/89) o WEBPAY (Webpay Plus en sevelin.cl, sql/91). NULL = no fue con tarjeta, o venta anterior a sql/79 (TUU).';

select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conname in ('ventas_maquina_tarjeta_check', 'venta_pagos_maquina_tarjeta_check', 'encargo_abonos_maquina_tarjeta_check');
