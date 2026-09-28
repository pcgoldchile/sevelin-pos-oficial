-- 67 · Freno de intentos de PIN compartido, sin Redis
-- ===================================================
-- POR QUÉ (dueño, 27-09-2026: "sobre el redis usa la opción b")
-- El freno de PIN (5 intentos fallidos → 1 minuto bloqueado) contaba en la
-- memoria de cada instancia de Vercel cuando no había Upstash Redis: con
-- varias instancias el conteo se repartía y se reiniciaba. Esta tabla es la
-- memoria compartida, en la misma base del POS: sin cuentas ni variables nuevas.
--
-- Una fila por IP: n = fallos seguidos, hasta = bloqueado hasta (ms epoch),
-- ts = último intento (ms epoch). La API borra solas las filas de más de un día.
--
-- Idempotente.

create table if not exists intentos_pin (
  ip text primary key,
  n integer not null default 0,
  hasta bigint not null default 0,
  ts bigint not null default 0,
  actualizado_en timestamptz not null default now()
);

-- Sin políticas: solo la service_role del servidor la toca.
alter table intentos_pin enable row level security;
