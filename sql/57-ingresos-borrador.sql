-- 57 · Que el POS detecte solo cuándo repusiste, y te lo deje para aprobar
-- ========================================================================
-- EL PROBLEMA (dueño, 16-09-2026, al ver la v66)
-- El informe de "Compras y devoluciones" (sql/56) solo ve lo que se carga a
-- mano. Si compras 50 ventiladores y no los registras, para el informe no
-- existen — y un informe incompleto es PEOR que ninguno: la IA y el panel
-- hablan con toda seguridad de las 3 compras cargadas e ignoran las otras
-- 37. Es el mismo error que ya costó caro con el margen inflado por ítems
-- sin costo (sesión del 07/08-09-2026).
--
-- LO QUE SE PUEDE Y LO QUE NO SE PUEDE AUTOMATIZAR
--   El POS SÍ sabe: cuándo subió el stock, cuánto subió y el costo cargado.
--   El POS NO puede saber: hasta cuándo el proveedor recibe la devolución.
--   Ese dato solo está en la factura o en la cabeza del dueño. Inventarlo
--   sería peor que no tenerlo: una fecha falsa hace perder plata de verdad.
-- Por eso se automatiza la DETECCIÓN, nunca el plazo. El POS arma el
-- borrador con lo que le consta y lo deja esperando aprobación.
--
-- `estado` nace en 'confirmado' con DEFAULT a propósito: todo lo que ya se
-- cargó a mano (y todo lo que se cargue por el formulario) vale tal cual.
-- Solo lo que detecta el POS entra como 'borrador', y un borrador NO cuenta
-- en el informe hasta que el dueño lo aprueba — si contara, el análisis se
-- haría con un costo supuesto y un plazo inexistente.
--
-- `stock_antes` / `stock_despues` quedan guardados como la EVIDENCIA de por
-- qué el POS propuso esa cantidad. Sin eso, un borrador de "20 unidades"
-- es un número sin explicación y no hay cómo auditarlo después.
--
-- QUÉ NO GENERA BORRADOR (a propósito, no es un olvido):
--   · anular una venta (devuelve stock, no es una compra)
--   · corregir las líneas de una venta ya hecha (es un ajuste)
--   · la importación masiva por CSV (100 productos darían 100 borradores de
--     golpe y el aviso se volvería ruido que se ignora)
--
-- Idempotente.

alter table ingresos_mercaderia
  add column if not exists estado text not null default 'confirmado'
  check (estado in ('borrador', 'confirmado'));

alter table ingresos_mercaderia
  add column if not exists origen text not null default 'manual'
  check (origen in ('manual', 'reposicion', 'alta', 'lote'));

alter table ingresos_mercaderia
  add column if not exists stock_antes numeric null;

alter table ingresos_mercaderia
  add column if not exists stock_despues numeric null;

-- El aviso del header pregunta por esto en cada sondeo: sin índice sería un
-- scan completo de la tabla cada vez.
create index if not exists ingresos_mercaderia_borradores_idx
  on ingresos_mercaderia (creado_en desc) where estado = 'borrador';

comment on column ingresos_mercaderia.estado is
  'borrador = lo detectó el POS al subir el stock y espera aprobación del dueño; confirmado = tiene costo y plazo reales. Solo los confirmados entran al informe de rotación (sql/57).';
comment on column ingresos_mercaderia.origen is
  'De dónde salió: manual (formulario), reposicion (subió el stock al editar), alta (producto creado con stock) o lote (capa PEPS de sql/09).';
comment on column ingresos_mercaderia.stock_antes is
  'Stock justo antes del cambio que originó el borrador. Es la evidencia de por qué el POS propuso esa cantidad (sql/57).';
