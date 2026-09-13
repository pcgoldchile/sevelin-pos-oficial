-- 50 · Cobro seguro ante cortes de Supabase + registro de envíos
-- ==============================================================
-- 1) EL PROBLEMA (13-09-2026)
-- Entre el 12-09 23:39 y el 13-09 13:45 Supabase (sa-east-1) respondió
-- "Gateway Timeout" a ratos, en la base del POS y en la de la tienda a la
-- vez. Una venta que se cae a mitad de camino podía:
--   · descontar el stock y no guardar la venta (el stock queda corrido), o
--   · al reintentar, descontar dos veces o duplicar la venta.
-- Un "Gateway Timeout" NO dice si Postgres alcanzó a guardar o no.
--
-- LA REGLA: reintentar un cobro tiene que ser siempre seguro.
--   · Cada cobro trae una `clave_idempotencia` (la genera el POS y la repite
--     en los reintentos del mismo carrito).
--   · `descontar_stock_venta_idem` descuenta UNA sola vez por clave: si la
--     clave ya descontó, devuelve lo mismo sin tocar el stock.
--   · `ventas.clave_idempotencia` es única: un reintento nunca crea otra venta.
--   · Si el cobro falla de verdad (o se abandona), `revertir_descuento_venta`
--     devuelve el stock — solo si NO existe la venta con esa clave.
--   · `limpiar_descuentos_huerfanos` revierte los descuentos de más de 15
--     minutos que nunca llegaron a venta (el cajero cerró sin reintentar).
--
-- LÍMITE CONOCIDO: los productos con lotes (FIFO, hoy 1 de 185) consumen su
-- lote por otro camino que no es idempotente.
--
-- 2) ENVÍOS (dueño, 13-09-2026)
-- Cada despacho registra quién lo llevó (InDrive, el padre del dueño, otro),
-- cuánto costó, cómo se pagó (efectivo de la caja o transferencia), los km y
-- el sector. Sirve para cobrar el envío con datos y para saber si un viaje
-- de InDrive está caro. El costo queda además como gasto en `compras`
-- (clasificación "Envíos / Despachos") y, si salió del cajón, como egreso
-- del turno de caja.
--
-- Idempotente.

-- ---------- 1. Cobro idempotente ----------

alter table ventas add column if not exists clave_idempotencia text;
create unique index if not exists ventas_clave_idempotencia_uk
  on ventas (clave_idempotencia) where clave_idempotencia is not null;

create table if not exists stock_descuentos_venta (
  clave      text primary key,
  items      jsonb not null,          -- lo pedido: [{producto_id, cantidad}] ordenado por id
  resultado  jsonb not null,          -- lo descontado: [{producto_id, stock}]
  creado_en  timestamptz not null default now()
);
alter table stock_descuentos_venta enable row level security;

comment on table stock_descuentos_venta is
  'Un descuento de stock por clave de cobro. Hace seguro reintentar una venta tras un corte de Supabase (sql/50).';

create or replace function revertir_descuento_venta(p_clave text)
returns integer
language plpgsql
as $$
#variable_conflict use_column
declare
  v_row stock_descuentos_venta%rowtype;
  v_n   integer := 0;
begin
  if p_clave is null or p_clave = '' then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('venta:' || p_clave));

  -- Si la venta existe, el descuento es legítimo: no se toca
  if exists (select 1 from ventas v where v.clave_idempotencia = p_clave) then return 0; end if;

  select * into v_row from stock_descuentos_venta s where s.clave = p_clave for update;
  if not found then return 0; end if;

  update productos p
     set stock = p.stock + x.cantidad,
         stock_actualizado_en = now()
    from (
      select (i->>'producto_id')::bigint as pid, sum((i->>'cantidad')::numeric) as cantidad
        from jsonb_array_elements(v_row.items) i
       group by 1
    ) x
   where p.id = x.pid
     and x.pid in (select (r->>'producto_id')::bigint from jsonb_array_elements(v_row.resultado) r);
  get diagnostics v_n = row_count;

  delete from stock_descuentos_venta s where s.clave = p_clave;
  return v_n;
end;
$$;

create or replace function descontar_stock_venta_idem(p_items jsonb, p_clave text)
returns table (producto_id bigint, stock numeric)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_prev stock_descuentos_venta%rowtype;
begin
  -- Sin clave: comportamiento de siempre
  if p_clave is null or p_clave = '' then
    return query select d.producto_id, d.stock from descontar_stock_venta(p_items) d;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('venta:' || p_clave));

  select * into v_prev from stock_descuentos_venta s where s.clave = p_clave;
  if found then
    if v_prev.items = coalesce(p_items, '[]'::jsonb) then
      -- Reintento del mismo cobro: ya se descontó, se devuelve lo mismo
      return query
        select (e->>'producto_id')::bigint, (e->>'stock')::numeric
          from jsonb_array_elements(v_prev.resultado) e;
      return;
    end if;
    -- El carrito cambió entre el intento fallido y este: se devuelve lo del
    -- intento anterior (si no llegó a venta) y se descuenta lo nuevo.
    perform revertir_descuento_venta(p_clave);
    if exists (select 1 from ventas v where v.clave_idempotencia = p_clave) then
      raise exception 'Esta venta ya estaba registrada con otros productos. Recarga el POS antes de cobrar de nuevo.'
        using errcode = 'P0001';
    end if;
  end if;

  insert into stock_descuentos_venta (clave, items, resultado)
  select p_clave,
         coalesce(p_items, '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('producto_id', d.producto_id, 'stock', d.stock)), '[]'::jsonb)
    from descontar_stock_venta(p_items) d;

  return query
    select (e->>'producto_id')::bigint, (e->>'stock')::numeric
      from stock_descuentos_venta s, jsonb_array_elements(s.resultado) e
     where s.clave = p_clave;
end;
$$;

create or replace function limpiar_descuentos_huerfanos()
returns integer
language plpgsql
as $$
declare
  v_clave text;
  v_n     integer := 0;
begin
  -- Descuentos que nunca llegaron a venta: se devuelve el stock
  for v_clave in
    select s.clave from stock_descuentos_venta s
     where s.creado_en < now() - interval '15 minutes'
       and not exists (select 1 from ventas v where v.clave_idempotencia = s.clave)
  loop
    v_n := v_n + revertir_descuento_venta(v_clave);
  end loop;

  -- Los que sí llegaron a venta ya no se necesitan pasado un día
  delete from stock_descuentos_venta s
   where s.creado_en < now() - interval '1 day'
     and exists (select 1 from ventas v where v.clave_idempotencia = s.clave);

  return v_n;
end;
$$;

-- ---------- 2. Envíos ----------

create table if not exists envios (
  id                  bigint generated by default as identity primary key,
  venta_id            bigint not null unique references ventas(id) on delete cascade,
  creado_en           timestamptz not null default now(),
  repartidor          text not null check (repartidor in ('indrive', 'padre', 'otro', 'sin_costo')),
  repartidor_detalle  text null,
  costo               numeric not null default 0 check (costo >= 0),
  metodo_pago         text null,                 -- 'Efectivo' o 'Transferencia'
  desde_caja          boolean not null default false,
  km                  numeric null check (km is null or km >= 0),
  sector              text null,
  direccion           text null,
  compra_id           bigint null references compras(id) on delete set null,
  caja_movimiento_id  bigint null
);
create index if not exists envios_creado_idx on envios (creado_en desc);
alter table envios enable row level security;

comment on table envios is
  'Costo real de cada despacho: quién lo llevó, cuánto, cómo se pagó, km y sector (sql/50).';

insert into compra_clasificaciones (nombre, descripcion, grupo)
select 'Envíos / Despachos', 'Viajes de InDrive, flete o traslado de pedidos a clientes', 'OPERATIVO'
 where not exists (select 1 from compra_clasificaciones where nombre = 'Envíos / Despachos');
