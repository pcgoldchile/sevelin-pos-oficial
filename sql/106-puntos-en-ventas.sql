-- 106 · Puntos Sevelin en las ventas del POS (dueño, 19-10-2026: "construir los puntos primero")
-- Las cuentas y movimientos viven en la base de la tienda (sevelin-tienda/supabase/47); aquí
-- solo queda qué cuenta sumó en cada venta, cuánto ganó y cuánto canjeó (el canje ya está
-- incluido en descuento_monto). Lo usan la devolución y el borrado para revertir los puntos.
-- Idempotente.

alter table ventas add column if not exists puntos_cuenta_id uuid;
alter table ventas add column if not exists puntos_ganados integer not null default 0;
alter table ventas add column if not exists puntos_canjeados integer not null default 0;

alter table ventas drop constraint if exists ventas_puntos_no_negativos;
alter table ventas add constraint ventas_puntos_no_negativos check (puntos_ganados >= 0 and puntos_canjeados >= 0);

select count(*) as ventas, count(puntos_cuenta_id) as con_puntos from ventas;
