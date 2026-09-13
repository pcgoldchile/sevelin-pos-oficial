-- 49 · Gasto que no mueve el saldo + recordatorio del F29
-- ======================================================
-- 1) EL PROBLEMA DEL CHECKBOX (dueño, 13-09-2026)
-- A veces un gasto fijo se paga y no se registra en el momento. Cuando el
-- dueño cuadra la caja o el banco con un "Reajuste" (ajustes_saldo), esa
-- salida de plata YA quedó descontada del saldo. Si después registra el
-- pago del gasto fijo, el saldo se descuenta dos veces.
--
-- LA REGLA
-- `compras.afecta_saldo = false` significa: "este gasto es real y cuenta en
-- la utilidad y en el checklist del mes, pero NO resta del saldo de caja ni
-- de banco, porque ya estaba descontado". Por defecto es TRUE: todas las
-- compras existentes siguen igual.
--
-- Afecta a: /api/finanzas/saldos, efectivo esperado del arqueo y la caja del
-- /api/balance. NO afecta a utilidades, gastos del período, checklist ni la
-- proyección (que usa los gastos reales para estimar el gasto típico).
--
-- 2) F29 (dueño, 13-09-2026)
-- El POS no sabe desde el SII si el F29 del mes se presentó. El dueño lo marca
-- a mano y hasta entonces el header muestra el recordatorio con los días que
-- faltan para el vencimiento (día 20, corrido al lunes si cae en fin de semana).
-- Una fila por período tributario ('YYYY-MM' = el mes que se declara, no el
-- mes en que se paga).
--
-- Idempotente.

alter table compras
  add column if not exists afecta_saldo boolean not null default true;

comment on column compras.afecta_saldo is
  'FALSE = gasto real que ya estaba descontado del saldo (pagado antes o cubierto por un reajuste). Cuenta en utilidad y checklist, no resta de caja/banco.';

create table if not exists f29_presentaciones (
  periodo       text primary key check (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  presentado_en timestamptz not null default now(),
  monto_pagado  numeric not null default 0 check (monto_pagado >= 0),
  compra_id     bigint null references compras(id) on delete set null,
  notas         text null
);

comment on table f29_presentaciones is
  'Períodos del F29 que el dueño marcó como presentados en el SII. Apaga el recordatorio del header.';

-- Solo el backend (service_role) accede; sin políticas para anon/authenticated.
alter table f29_presentaciones enable row level security;
