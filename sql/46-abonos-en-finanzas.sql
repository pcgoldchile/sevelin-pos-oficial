-- 46 · Los abonos entran a Finanzas, y un encargo puede ser un producto
-- ====================================================================
-- EL HALLAZGO (12-09-2026, revisando el abono del PC Gamer)
-- Un abono se guardaba en encargo_abonos y ahí moría: no sumaba al saldo de
-- Efectivo ni de Banco, no aparecía en el cierre de caja ni en la
-- proyección, y cuando el encargo se terminaba de pagar tampoco se
-- registraba ninguna venta. Los $150.000 por transferencia del PC Gamer no
-- existían para Finanzas.
--
-- LA REGLA QUE DECIDIÓ EL DUEÑO
--   · Cada abono suma al saldo (Efectivo o Banco) el día que se recibe.
--   · Al completar el 100% se registra UNA venta en el historial, con su
--     costo, para que la utilidad sea real. Esa venta NO vuelve a sumar
--     plata al saldo: la plata ya entró abono por abono. Por eso lleva
--     encargo_id, y las vistas de caja la excluyen.
--   · La entrega es independiente del pago ("depende del caso"): se puede
--     entregar antes de terminar de pagar, como el PC Gamer.
--   · Si el encargo es un producto del catálogo con stock propio, el stock
--     baja al entregarlo o al completar el pago, lo que pase primero. Un
--     producto por encargo o de stock ilimitado no descuenta nada.
--
-- Idempotente.

-- 1. El encargo puede apuntar a un producto del catálogo
alter table encargos add column if not exists producto_id bigint null references productos(id) on delete set null;
alter table encargos add column if not exists cantidad integer not null default 1;
-- Costo total para la utilidad. Si hay producto, se toma su costo al crear;
-- si es algo suelto (el PC Gamer), lo escribe el dueño.
alter table encargos add column if not exists costo_total numeric not null default 0;
alter table encargos add column if not exists entregado_en timestamptz null;
alter table encargos add column if not exists entregado_nota text null;
alter table encargos add column if not exists stock_descontado boolean not null default false;
alter table encargos add column if not exists venta_id bigint null references ventas(id) on delete set null;

-- 2. Cada abono sabe en qué turno de caja entró y cuánto se llevó la máquina
alter table encargo_abonos add column if not exists caja_id bigint null references cajas_diarias(id) on delete set null;
alter table encargo_abonos add column if not exists comision_pos numeric not null default 0;

-- 3. La venta que nace de un encargo pagado
alter table ventas add column if not exists encargo_id bigint null references encargos(id) on delete set null;

-- Una sola venta por encargo: si dos abonos llegan juntos, el segundo no
-- puede crear otra.
create unique index if not exists ventas_encargo_id_unico
  on ventas (encargo_id) where encargo_id is not null;

create index if not exists idx_encargo_abonos_fecha on encargo_abonos (fecha);
create index if not exists idx_encargo_abonos_caja on encargo_abonos (caja_id) where caja_id is not null;

comment on column ventas.encargo_id is
  'Venta generada al completar el pago de un encargo. Cuenta para utilidades, pero NO para saldos ni cajas: esa plata ya entró abono por abono (encargo_abonos).';
comment on column encargos.costo_total is
  'Costo total del encargo para calcular la utilidad de la venta que se genera al completar el pago.';
comment on column encargo_abonos.caja_id is
  'Turno de caja abierto cuando se recibió el abono. El cierre de caja suma los abonos en efectivo de su turno.';
