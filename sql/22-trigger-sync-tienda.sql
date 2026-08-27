-- ============================================================
-- SEVELIN POS — Migración 22
-- Alternativa al Database Webhook de la UI de Supabase, que en este
-- proyecto falla con "schema 'supabase_functions' does not exist" (bug de
-- aprovisionamiento de Supabase, no algo mal configurado acá — se probó
-- desactivar/reactivar pg_net y siguió igual). Este trigger hace EXACTAMENTE
-- lo mismo que el wizard hubiera creado: pg_net directo, sin depender de
-- ese schema.
--
-- Dispara en INSERT/UPDATE/DELETE de `productos` y empuja el mismo
-- envelope { type, table, record, old_record } a
-- POST https://sevelin-tienda.vercel.app/api/sync/producto
-- (ver sevelin-tienda/docs/README-WEBHOOK-POS.md y
-- sevelin-tienda/src/app/api/sync/producto/route.ts — el receptor no
-- necesitó ningún cambio, ya esperaba exactamente este formato).
--
-- v1 de este archivo usaba `ALTER DATABASE ... SET app.*` para guardar la
-- URL/el secreto sin tocar código — falló con "permission denied to set
-- parameter": el rol `postgres` de Supabase administrado NO es superusuario
-- real y no puede crear parámetros custom a nivel de base. Se reemplazó por
-- **Supabase Vault** (su sistema de secretos cifrados, viene habilitado en
-- todo proyecto, pensado exactamente para este caso).
--
-- IMPORTANTE — el secreto y la URL NO van hardcodeados en este archivo (no
-- hay que subir un secreto real a git). Antes de correr este archivo, corre
-- ESTOS DOS COMANDOS APARTE en el SQL Editor (no los guardes en ningún
-- archivo del repo — créalos, cópialos de tu propio historial si hace
-- falta, pero no los commitees):
--
--   select vault.create_secret('https://sevelin-tienda.vercel.app/api/sync/producto', 'tienda_sync_url');
--   select vault.create_secret('PEGA_AQUI_EL_SYNC_SECRET_REAL', 'sync_secret_tienda');
--
-- Ejecutar en el SQL Editor del proyecto Supabase del POS. Idempotente
-- (salvo la creación de los secretos en Vault, que es un paso aparte, una
-- sola vez — si ya existen, `vault.create_secret` con el mismo nombre da
-- error de duplicado; usar vault.update_secret en ese caso).
-- ============================================================

create extension if not exists pg_net;

create or replace function public.notificar_sync_tienda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_payload jsonb;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'tienda_sync_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'sync_secret_tienda';

  if v_url is null or v_secret is null then
    raise warning 'notificar_sync_tienda: falta el secreto tienda_sync_url o sync_secret_tienda en Vault (ver este archivo)';
    return coalesce(NEW, OLD);
  end if;

  v_payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    'old_record', case when TG_OP = 'DELETE' then to_jsonb(OLD) else null end
  );

  -- net.http_post es asíncrono (encola la llamada, no bloquea la
  -- transacción de productos) — mismo comportamiento que el Database
  -- Webhook nativo de Supabase.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
    body := v_payload
  );

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_tienda on productos;
create trigger trg_sync_tienda
after insert or update or delete on productos
for each row execute function public.notificar_sync_tienda();

-- ============================================================
-- VERIFICACIÓN
--   1. Confirma que los dos secretos existen en Vault (debe devolver 2
--      filas, con la URL/el nombre — el valor real no se muestra acá a
--      propósito, esta vista NO desencripta):
--        select name, created_at from vault.secrets
--         where name in ('tienda_sync_url', 'sync_secret_tienda');
--   2. Edita cualquier producto (ej. cambia el nombre) y revisa las
--      llamadas recientes de pg_net:
--        select * from net._http_response order by id desc limit 5;
--      Debe aparecer una fila con status_code 200 (o 401 si el secreto no
--      coincide con el de sevelin-tienda — revisar en ese caso).
-- ============================================================
