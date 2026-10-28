-- 114 — Cerrar el acceso con la llave pública a la base del POS (auditoría del 28-10-2026)
-- ------------------------------------------------------------------------------------------
-- El POS habla con Supabase SOLO desde el servidor, con la llave service_role (CLAUDE.md). La
-- llave pública (anon / publishable) no la usa nadie; aun así tenía permisos de Supabase por
-- defecto. Las tablas estaban a salvo por RLS, pero 3 vistas creadas con SECURITY DEFINER
-- se saltaban el RLS: con la llave pública se leían las 325 ventas (v_balance_ventas,
-- v_ventas_por_medio) y los 170 lotes con su costo (v_producto_lotes_vigentes).
--
-- Qué hace (idempotente, se puede correr dos veces):
--   1. Las 3 vistas pasan a security_invoker: respetan el RLS de quien consulta.
--   2. anon y authenticated pierden todo permiso sobre tablas, vistas, secuencias y funciones
--      del esquema public, y también sobre lo que se cree después (default privileges).
--      service_role (el servidor del POS) no se toca.
--   3. Las 14 funciones sin search_path fijo lo fijan (aviso function_search_path_mutable).
-- Los triggers (ej. notificar_sync_tienda) siguen funcionando: Postgres no revisa EXECUTE al
-- disparar un trigger.

-- 1. Vistas
alter view if exists public.v_balance_ventas set (security_invoker = true);
alter view if exists public.v_ventas_por_medio set (security_invoker = true);
alter view if exists public.v_producto_lotes_vigentes set (security_invoker = true);

-- 2a. Primero, el servidor (service_role) queda con permiso EXPLÍCITO a todo. Algunas funciones
--     podían depender del permiso de PUBLIC, que se quita abajo: sin esto, fifo_consumir o
--     descontar_stock_venta_idem dejarían de responder y no se podría vender.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

-- 2b. Sin permisos para la llave pública ni para usuarios de Supabase Auth (el POS no los usa)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 3. search_path fijo
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('descontar_stock_venta', 'revertir_descuento_venta', 'descontar_stock_venta_idem',
        'limpiar_descuentos_huerfanos', 'piso_margen_mayorista', 'costo_referencia_mayorista',
        'precio_minimo_mayorista', 'clp_texto', 'productos_guardia_mayorista',
        'revisar_piso_mayorista_por_costo', 'resumen_precios_mayoristas', 'costos_referencia_productos',
        'ajustar_stock_web', 'venta_items_poner_propietario')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.firma);
  end loop;
end $$;
