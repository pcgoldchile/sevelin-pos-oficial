-- 89 · Link de pago de Haulmer como tercera forma de pasar una tarjeta (v133, 11-10-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 11-10-2026)
-- El 10-10-2026 un cliente pagó un Power Bank con débito por el link de pago
-- de Haulmer (tuu.cl/sevelin) y esa venta no se podía anotar bien en el POS:
-- al cobrar con tarjeta solo se elegía entre la máquina TUU y la del Banco de
-- Chile. Pidió "una opción de pago con link de pago (Haulmer)".
--
-- LA REGLA
--   · El link no es un medio de pago nuevo: la venta sigue siendo "Tarjeta
--     Débito" o "Tarjeta Crédito". Lo que cambia es POR DÓNDE pasó la tarjeta,
--     igual que con las dos máquinas, así que va en la misma columna
--     (maquina_tarjeta) con el valor LINK_TUU.
--   · La comisión es la misma de la máquina TUU (0,79% + $65, más IVA). Dato
--     real del 10-10-2026: una venta de $19.990 pagó $223 + $42 de IVA = $265.
--     Se sigue calculando SOLO en el servidor y queda guardada en la venta.
--
-- No crea tablas (no hay RLS nuevo que activar). Idempotente.

alter table ventas drop constraint if exists ventas_maquina_tarjeta_check;
alter table ventas
  add constraint ventas_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE', 'LINK_TUU'));

alter table venta_pagos drop constraint if exists venta_pagos_maquina_tarjeta_check;
alter table venta_pagos
  add constraint venta_pagos_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE', 'LINK_TUU'));

alter table encargo_abonos drop constraint if exists encargo_abonos_maquina_tarjeta_check;
alter table encargo_abonos
  add constraint encargo_abonos_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE', 'LINK_TUU'));

comment on column ventas.maquina_tarjeta is
  'Por dónde pasó la tarjeta: TUU, BANCHILE o LINK_TUU (link de pago de Haulmer, sql/89). NULL = no fue con tarjeta, o venta anterior a sql/79 (TUU).';
