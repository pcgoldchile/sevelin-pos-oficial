-- ============================================================
-- 87 · Reservas de productos "por llegar" pagadas en sevelin.cl (06-10-2026)
-- ------------------------------------------------------------
-- EL PROBLEMA (lo vio el dueño al probar el checkout)
--   La tienda ofrece "Reservar — pago 100%" en lo que está por llegar
--   (sql/42 y sql/44), pero la reserva nunca funcionó de punta a punta:
--     · el carrito agregaba el producto con cantidad 0;
--     · el checkout lo rechazaba por "sin stock";
--     · y si hubiera pasado, el descuento de stock fallaba después de
--       cobrar, porque no hay unidades que descontar.
--
-- LA REGLA
--   Una reserva pagada NO toca `stock` (no hay nada en la tienda). Baja
--   `stock_por_llegar` (para que nadie más reserve esa unidad) y sube
--   `reservado_web`: unidades ya vendidas que todavía no llegan.
--   Cuando el dueño aprieta "📦 Ya llegó" (PUT /api/ingresos/:id/recibida),
--   esas unidades NO entran al stock para la venta: ya tienen dueño.
--
-- POR QUÉ UNA FUNCIÓN
--   La reserva y el descuento del resto del pedido (productos que sí están)
--   pasan en UNA transacción: si algo no alcanza, Postgres deshace todo y
--   la tienda marca el pedido para revisión, igual que hoy. Además
--   supabase-js no sabe escribir "columna = columna - n".
--
-- Idempotente.
-- ============================================================

alter table productos
  add column if not exists reservado_web integer not null default 0;

alter table productos drop constraint if exists productos_reservado_web_check;
alter table productos add constraint productos_reservado_web_check check (reservado_web >= 0);

comment on column productos.reservado_web is
  'Unidades "por llegar" ya pagadas en sevelin.cl que todavía no llegan. Suben con cada reserva pagada y bajan al marcar la compra como recibida: esas unidades no entran al stock para la venta (sql/87).';

create or replace function ajustar_stock_web(p_items jsonb, p_reservas jsonb)
returns table (producto_id bigint)
language plpgsql
as $$
declare
  v_res  record;
  v_prod record;
begin
  -- 1) Reservas: unidades de productos por llegar, sin stock en tienda
  for v_res in
    select (elem->>'producto_id')::bigint as producto_id,
           sum((elem->>'cantidad')::numeric) as cantidad
    from jsonb_array_elements(coalesce(p_reservas, '[]'::jsonb)) as elem
    where (elem->>'producto_id') is not null
    group by 1
    order by 1
  loop
    if coalesce(v_res.cantidad, 0) <= 0 then continue; end if;

    select p.id, p.nombre, p.por_llegar, p.stock_por_llegar
      into v_prod
      from productos p
     where p.id = v_res.producto_id
     for update;

    if not found then
      raise exception 'Reserva de un producto que ya no existe (#%)', v_res.producto_id using errcode = 'P0001';
    end if;
    if not v_prod.por_llegar or v_prod.stock_por_llegar < v_res.cantidad then
      raise exception 'No se puede reservar "%": pides %, vienen % por llegar',
        coalesce(v_prod.nombre, 'producto'), v_res.cantidad,
        case when v_prod.por_llegar then v_prod.stock_por_llegar else 0 end
        using errcode = 'P0001';
    end if;

    update productos
       set stock_por_llegar = stock_por_llegar - v_res.cantidad::integer,
           reservado_web    = reservado_web + v_res.cantidad::integer
     where id = v_prod.id;
  end loop;

  -- 2) Lo que sí está en la tienda: la misma función de siempre (sql/19)
  return query
    select d.producto_id from descontar_stock_venta(coalesce(p_items, '[]'::jsonb)) d;
end;
$$;

-- Solo el backend (service_role) la llama.
revoke execute on function ajustar_stock_web(jsonb, jsonb) from public, anon, authenticated;
grant execute on function ajustar_stock_web(jsonb, jsonb) to service_role;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
select 'columna reservado_web' as objeto, count(*)::text as existe
  from information_schema.columns where table_name = 'productos' and column_name = 'reservado_web'
union all
select 'function ajustar_stock_web', count(*)::text from pg_proc where proname = 'ajustar_stock_web';
