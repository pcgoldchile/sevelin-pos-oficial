-- 47 · QR de retiro seguro para las Órdenes de Trabajo
-- ====================================================
-- EL PROBLEMA (dueño, 12-09-2026)
-- No siempre quien trae el equipo es quien lo retira. Sin una forma de
-- verificarlo, el equipo de un cliente se le puede entregar a cualquiera
-- que diga "vengo a buscar el PC de Juan".
--
-- LA REGLA
--   · Al crear la OT se genera un código de retiro aleatorio (32 hex, no
--     adivinable), y con él un QR que le llega al dueño del equipo por
--     correo y/o WhatsApp. Él decide a quién reenviárselo.
--   · Al entregar se exige UNA de dos pruebas:
--       QR      → el código escaneado es el vigente de esa OT y no se usó.
--       CARNET  → quien retira es el titular y su RUT coincide con el
--                 registrado en la OT (solo si la OT tiene RUT).
--   · Se registra quién retiró y cómo se verificó. El código queda usado.
--   · Si el QR se pierde, se genera uno nuevo y el anterior deja de servir.
--
-- Idempotente.

alter table ordenes_trabajo add column if not exists token_retiro text null;
alter table ordenes_trabajo add column if not exists token_retiro_generado_en timestamptz null;
alter table ordenes_trabajo add column if not exists token_retiro_usado_en timestamptz null;
alter table ordenes_trabajo add column if not exists retiro_verificacion text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ordenes_trabajo_retiro_verificacion_check') then
    alter table ordenes_trabajo
      add constraint ordenes_trabajo_retiro_verificacion_check
      check (retiro_verificacion is null or retiro_verificacion in ('QR', 'CARNET'));
  end if;
end $$;

-- Un código vigente identifica a una sola OT.
create unique index if not exists ordenes_trabajo_token_retiro_unico
  on ordenes_trabajo (token_retiro) where token_retiro is not null;

comment on column ordenes_trabajo.token_retiro is
  'Código de retiro (32 hex aleatorios) del QR que se envía al dueño del equipo. Se reemplaza si se pierde; el anterior deja de servir.';
comment on column ordenes_trabajo.retiro_verificacion is
  'Cómo se verificó a quien retiró: QR (código vigente) o CARNET (titular con el RUT registrado en la OT).';
