-- ============================================================
-- 100 · Foto "¿Dónde estamos?" que el dueño cambia desde el POS (v155)
-- ------------------------------------------------------------
-- Pedido del dueño (16-10-2026): "dame una opción en el POS para yo mismo
-- reemplazar manualmente la imagen de Facebook". Hasta ahora era el archivo
-- img/donde-estamos.webp del repositorio (solo se cambiaba con un deploy).
--
-- La foto nueva se sube al bucket 'productos-imagenes' (carpeta sitio/) y su
-- URL queda en textos_editables, clave 'foto_ubicacion' ({ "url": ... }).
-- Esa clave NO está en TEXTOS_EDITABLES de la API: solo la escribe
-- POST /api/foto-ubicacion, así nadie puede apuntarla a cualquier URL.
--
-- Lo único que cambia acá es fotos_sueltas_productos() (sql/99): ahora cuenta
-- también esa foto como "usada", para que "🧹 Fotos sin usar" no la borre.
-- Idempotente (create or replace).
-- ============================================================

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
    union
    select substring(t.contenido->>'url' from '/productos-imagenes/(.*)$')
    from public.textos_editables t
    where t.clave = 'foto_ubicacion' and t.contenido->>'url' like '%/productos-imagenes/%'
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
