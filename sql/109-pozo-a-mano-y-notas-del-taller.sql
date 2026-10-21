-- 109 · Sumar al pozo a mano y notas largas en el taller (dueño, 20-10-2026)
-- ===============================================================
-- 1. POZO A MANO. El papá vendió su propio iPhone 14 Pro Max ($450.000, 19-10-2026) y se quedó con
--    la plata; el dueño pidió "que la sumes al pozo". El pozo solo sumaba servicios cobrados en la
--    caja (venta_items.pozo_monto) o en la app del taller (taller_trabajos), y el papá todavía no
--    tiene usuario. Esta tabla guarda lo que se suma a mano, con su motivo:
--      en_su_mano = true  → la plata ya la tiene él: suma a lo juntado Y a lo recibido, así el POS
--                           no sugiere entregarle esa plata otra vez (igual que "lo cobró él" en la app).
--      en_su_mano = false → la tiene Sevelin: suma a lo juntado y queda por entregarle.
--    Nunca se borra: se anula con motivo (anulado_en), y el resumen deja de contarla.
-- 2. NOTAS DEL TALLER. cotizaciones_referencia (sql/90) pasa a guardar también CÓMO se hace un
--    trabajo por marca y modelo (ej. el desbloqueo de cuenta Google, distinto en cada equipo):
--    la nota sube de 300 a 1500 letras.
-- Idempotente.

create table if not exists pozo_aportes_manuales (
  id             bigserial primary key,
  fecha          date not null,
  monto          numeric not null check (monto > 0 and monto <= 100000000),
  descripcion    text not null check (length(btrim(descripcion)) between 3 and 200),
  en_su_mano     boolean not null default true,
  creado_por     text null,
  creado_en      timestamptz not null default now(),
  anulado_en     timestamptz null,
  anulado_motivo text null check (anulado_motivo is null or length(anulado_motivo) <= 200)
);
create index if not exists pozo_aportes_manuales_fecha_idx on pozo_aportes_manuales (fecha) where anulado_en is null;
alter table pozo_aportes_manuales enable row level security;

alter table cotizaciones_referencia drop constraint if exists cotizaciones_referencia_nota_check;
alter table cotizaciones_referencia add constraint cotizaciones_referencia_nota_check
  check (nota is null or length(nota) <= 1500);
