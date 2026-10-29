-- 117 · Bodega v3: mueble J, piso apilado y vitrina del local (29-10-2026)
-- ===============================================================
-- Pedido del dueño: los armables de hogar (percheros, zapateros, tendederos, estantes) y
-- los gabinetes van apilados en el piso, no en estantes; compró otro estante (J) y tiene
-- una vitrina en el local (V1..V5, mismas medidas que los estantes) y una mini vitrina de
-- 6 espacios (M1..M6) para una unidad de muestra de cada cosa.
--
--   lugar    ahora acepta J1..J5 y P1..P3 (piso, apilado junto al mueble G)
--   vitrina  segundo lugar opcional: la unidad de muestra en V1..V5 o M1..M6. Al aceptar
--            la propuesta se agregan los dos lugares al producto.
--
-- Idempotente. No cambia el estado de ninguna propuesta.

alter table bodega_propuestas drop constraint if exists bodega_propuestas_lugar_check;
alter table bodega_propuestas add constraint bodega_propuestas_lugar_check
  check (lugar ~ '^([A-J][1-5]|P[1-3])$');

alter table bodega_propuestas add column if not exists vitrina text null;
alter table bodega_propuestas drop constraint if exists bodega_propuestas_vitrina_check;
alter table bodega_propuestas add constraint bodega_propuestas_vitrina_check
  check (vitrina is null or vitrina ~ '^(V[1-5]|M[1-6])$');

comment on column bodega_propuestas.vitrina is
  'Unidad de muestra en la vitrina del local (V1..V5) o en la mini vitrina (M1..M6). Segundo lugar del producto.';
