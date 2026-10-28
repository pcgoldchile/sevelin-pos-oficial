-- 115 — Freno escalonado del PIN (auditoría 28-10-2026)
-- La tabla intentos_pin (sql/67) recuerda cuántos bloqueos lleva cada IP en las últimas 24 h,
-- para que cada bloqueo dure más que el anterior (1, 5, 15 y 60 min). Ver registrarFalloPin()
-- en api/index.js. Idempotente.
alter table intentos_pin add column if not exists bloqueos integer not null default 0;
alter table intentos_pin add column if not exists ultimo_bloqueo bigint not null default 0;
