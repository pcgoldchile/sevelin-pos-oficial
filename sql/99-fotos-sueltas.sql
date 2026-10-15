-- 99 · Fotos sueltas del almacenamiento de productos (dueño, 15-10-2026)
-- ===============================================================
-- POR QUÉ: "me preocupa que se estén guardando imágenes sueltas, o que no se
-- usen". Al 15-10-2026 había 35 de 641 (834 kB), todas de antes de la v142
-- (desde entonces, quitar una foto o borrar un producto ya la borra).
--
-- fotos_sueltas_productos() lista los archivos del bucket 'productos-imagenes'
-- que no nombra ningún producto (imagen_urls) ni ningún lugar de la Bodega
-- (ubicaciones.foto_url, mismo bucket). Lo usa el botón "🧹 Fotos sin usar" de
-- Productos (GET/POST /api/productos/fotos-sueltas). Ignora lo subido en la
-- última hora: una foto recién subida puede estar a segundos de quedar
-- anotada en su producto.
--
-- Solo la llama el servidor (service_role): storage.objects no es público.
-- Idempotente.

create or replace function public.fotos_sueltas_productos()
returns table (ruta text, bytes bigint, creado timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with usadas as (
    select substring(u from '/productos-imagenes/(.*)$') as ruta
    from public.productos p, unnest(p.imagen_urls) as u
    where u like '%/productos-imagenes/%'
    union
    select substring(foto_url from '/productos-imagenes/(.*)$')
    from public.ubicaciones
    where foto_url like '%/productos-imagenes/%'
  )
  select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.created_at
  from storage.objects o
  where o.bucket_id = 'productos-imagenes'
    and o.created_at < now() - interval '1 hour'
    and not exists (select 1 from usadas x where x.ruta = o.name)
  order by o.created_at;
$$;

revoke all on function public.fotos_sueltas_productos() from public, anon, authenticated;
grant execute on function public.fotos_sueltas_productos() to service_role;

select count(*) as sueltas, pg_size_pretty(coalesce(sum(bytes), 0)) as peso from public.fotos_sueltas_productos();
