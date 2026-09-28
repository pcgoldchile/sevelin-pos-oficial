-- 68 · Entregar una OT con la clave de administrador (v96, 28-09-2026)
-- ====================================================================
-- EL PROBLEMA (dueño, 28-09-2026)
-- Desde sql/47 la entrega exige el QR vigente o el carnet del titular con
-- el RUT registrado. Hay casos reales sin ninguna de las dos: el cliente
-- perdió el QR y no tiene correo a mano, o la OT no tiene RUT registrado y
-- el titular no puede venir. Hoy esa orden queda imposible de entregar.
--
-- LA REGLA
--   · Tercera verificación: ADMIN. El servidor exige el PIN de
--     administrador (con el freno de intentos de sql/67) aunque la sesión
--     sea de trabajador, y un motivo escrito de 10 a 300 letras.
--   · El motivo queda en la orden y sale en el comprobante de entrega.
--   · Se sigue anotando nombre y RUT de quien retira, y el QR queda usado.
--
-- No crea tablas (RLS de ordenes_trabajo sin cambios). Idempotente.

alter table ordenes_trabajo add column if not exists retiro_verificacion_motivo text null;

alter table ordenes_trabajo drop constraint if exists ordenes_trabajo_retiro_verificacion_check;
alter table ordenes_trabajo
  add constraint ordenes_trabajo_retiro_verificacion_check
  check (retiro_verificacion is null or retiro_verificacion in ('QR', 'CARNET', 'ADMIN'));

-- Solo ADMIN lleva motivo, y ADMIN siempre lo lleva.
alter table ordenes_trabajo drop constraint if exists ordenes_trabajo_retiro_verificacion_motivo_check;
alter table ordenes_trabajo
  add constraint ordenes_trabajo_retiro_verificacion_motivo_check
  check (
    (retiro_verificacion = 'ADMIN' and char_length(btrim(retiro_verificacion_motivo)) between 10 and 300)
    or (retiro_verificacion is distinct from 'ADMIN' and retiro_verificacion_motivo is null)
  );

comment on column ordenes_trabajo.retiro_verificacion is
  'Cómo se verificó a quien retiró: QR (código vigente), CARNET (titular con el RUT registrado en la OT) o ADMIN (sin ninguna de las dos, autorizado con el PIN de administrador; ver retiro_verificacion_motivo).';
comment on column ordenes_trabajo.retiro_verificacion_motivo is
  'Solo si retiro_verificacion = ADMIN: por qué se entregó sin QR ni carnet. Sale en el comprobante de entrega.';
