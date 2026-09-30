-- 76 · Venta mayorista, Fase 1 (v103, 01-10-2026) — pendiente #28
-- ======================================================================
-- EL PEDIDO (dueño, 30-09-2026)
-- Precios mayoristas para clientes y técnicos que compran por cantidad, con
-- cuenta aprobada a mano (WhatsApp o llamada) en sevelin.cl. Siempre pago
-- por adelantado, pedido mínimo sí o sí, y un piso de margen para no vender
-- nunca a pérdida.
--
-- LA REGLA
--   · precio_mayorista: precio por unidad para cuentas mayoristas aprobadas.
--   · mayorista_desde: se aplica desde esta cantidad del MISMO producto.
--   · Van los dos o ninguno. NULL = el producto no tiene precio mayorista.
--   · Piso: el precio mayorista deja al menos 20% de margen sobre el MAYOR
--     costo conocido (el de la ficha, el de la última compra y el de las
--     capas PEPS con unidades). Con 20%, aunque la mercadería se haya
--     comprado sin factura (sin recuperar el IVA), la venta sigue dejando
--     ganancia. La API lo valida al guardar (con un mensaje claro) y ADEMÁS
--     esta migración lo hace cumplir en la base: si una compra nueva sube el
--     costo, o el precio normal baja, el precio mayorista se desactiva solo y
--     queda el motivo en mayorista_aviso. Ningún camino (compra, lote,
--     importación, SQL a mano) puede dejar un mayorista bajo el piso.
--   · venta_items.precio_tipo: si la línea se vendió a precio mayorista (en
--     caja o por la web). Sirve para medir cuánto se vende así y con qué
--     margen. Las líneas anteriores quedan en 'NORMAL'.
--
-- El precio mayorista NO es público: la tienda lo guarda en una tabla aparte
-- (supabase/39 del otro repo), nunca en productos_web, porque el catálogo lee
-- todas las columnas de productos_web y las manda al navegador.
-- Viaja a la tienda solo: el trigger trg_sync_tienda (sql/22) manda la fila
-- completa. Idempotente.

alter table productos add column if not exists precio_mayorista numeric null;
alter table productos add column if not exists mayorista_desde integer null;

alter table productos drop constraint if exists productos_mayorista_check;
alter table productos
  add constraint productos_mayorista_check
  check (
    (precio_mayorista is null and mayorista_desde is null)
    or (precio_mayorista > 0 and mayorista_desde is not null and mayorista_desde between 2 and 1000)
  );

comment on column productos.precio_mayorista is
  'Precio por unidad para cuentas mayoristas aprobadas en sevelin.cl, desde mayorista_desde unidades. NULL = sin precio mayorista. No es público.';
comment on column productos.mayorista_desde is
  'Cantidad mínima del mismo producto para que se aplique precio_mayorista.';

-- Por qué se desactivó solo el precio mayorista (lo muestra el POS). La API lo
-- limpia al volver a guardar el precio mayorista.
alter table productos add column if not exists mayorista_aviso text null;
alter table productos add column if not exists mayorista_aviso_en timestamptz null;

-- ----------------------------------------------------------------------
-- EL PISO, EN UN SOLO LUGAR. La API llama a precio_minimo_mayorista() para
-- validar con un mensaje claro; la guardia de abajo usa la misma función.
-- ----------------------------------------------------------------------
create or replace function piso_margen_mayorista() returns numeric
language sql immutable as $$ select 0.20::numeric $$;

-- El mayor costo conocido. productos.costo_unitario NO sube al registrar una
-- compra más cara (solo se carga si estaba en 0), así que se mira también la
-- última compra y las capas PEPS que todavía tienen unidades.
create or replace function costo_referencia_mayorista(p_producto_id bigint, p_costo_ficha numeric)
returns numeric language sql stable as $$
  select greatest(
    coalesce(p_costo_ficha, 0),
    coalesce((select i.costo_unitario from ingresos_mercaderia i
               where i.producto_id = p_producto_id order by i.id desc limit 1), 0),
    coalesce((select max(l.costo_unitario) from producto_lotes l
               where l.producto_id = p_producto_id and l.cantidad > 0), 0)
  )
$$;

-- Precio mayorista mínimo: (precio − costo) / precio ≥ piso. Con costo 0
-- devuelve 0, y la guardia lo trata como "sin costo, no se permite".
create or replace function precio_minimo_mayorista(p_producto_id bigint, p_costo_ficha numeric)
returns numeric language sql stable as $$
  select ceil(costo_referencia_mayorista(p_producto_id, p_costo_ficha) / (1 - piso_margen_mayorista()))
$$;

create or replace function clp_texto(p numeric) returns text
language sql immutable as $$ select '$' || replace(to_char(round(p), 'FM999,999,999,990'), ',', '.') $$;

-- Guardia: antes de guardar un producto, si el precio mayorista no cumple,
-- se desactiva (no se rechaza el guardado: una compra o un cambio de precio
-- no pueden fallar por esto) y queda el motivo.
create or replace function productos_guardia_mayorista() returns trigger
language plpgsql as $$
declare
  v_costo numeric;
  v_minimo numeric;
  v_normal numeric;
  v_motivo text;
begin
  if new.precio_mayorista is null then
    return new;
  end if;
  v_costo := costo_referencia_mayorista(new.id, new.costo_unitario);
  v_minimo := ceil(v_costo / (1 - piso_margen_mayorista()));
  v_normal := least(new.precio_unitario, coalesce(new.precio_web, new.precio_unitario));
  v_motivo := case
    when coalesce(new.es_servicio, false) or coalesce(new.stock_ilimitado, false)
      or coalesce(new.es_pedido_encargo, false) or coalesce(new.precio_a_consultar, false)
      then 'Este producto no admite precio mayorista (servicio, encargo o precio a consultar)'
    when v_costo <= 0
      then 'Sin costo cargado: no se puede asegurar que no se venda a pérdida'
    when new.precio_mayorista >= v_normal
      then format('El precio normal (%s) quedó igual o por debajo del mayorista (%s)',
                  clp_texto(v_normal), clp_texto(new.precio_mayorista))
    when new.precio_mayorista < v_minimo
      then format('Con el costo de %s, el mayorista mínimo es %s (piso de %s%% de margen)',
                  clp_texto(v_costo), clp_texto(v_minimo), round(piso_margen_mayorista() * 100))
    else null
  end;
  if v_motivo is not null then
    new.mayorista_aviso := format('Se desactivó el mayorista de %s (%s u.): %s',
                                  clp_texto(new.precio_mayorista), new.mayorista_desde, v_motivo);
    new.mayorista_aviso_en := now();
    new.precio_mayorista := null;
    new.mayorista_desde := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_productos_guardia_mayorista on productos;
create trigger trg_productos_guardia_mayorista
  before insert or update of precio_mayorista, mayorista_desde, costo_unitario, precio_unitario,
    precio_web, es_servicio, stock_ilimitado, es_pedido_encargo, precio_a_consultar
  on productos for each row execute function productos_guardia_mayorista();

-- Una compra nueva o una capa PEPS más cara: se vuelve a pasar el producto
-- por la guardia (solo si ya quedó bajo el piso, para no disparar la
-- sincronización con la tienda en cada compra).
create or replace function revisar_piso_mayorista_por_costo() returns trigger
language plpgsql as $$
begin
  update productos p set precio_mayorista = p.precio_mayorista
   where p.id = new.producto_id
     and p.precio_mayorista is not null
     and p.precio_mayorista < precio_minimo_mayorista(p.id, p.costo_unitario);
  return new;
end $$;

drop trigger if exists trg_piso_mayorista_ingresos on ingresos_mercaderia;
create trigger trg_piso_mayorista_ingresos
  after insert or update of costo_unitario on ingresos_mercaderia
  for each row execute function revisar_piso_mayorista_por_costo();

drop trigger if exists trg_piso_mayorista_lotes on producto_lotes;
create trigger trg_piso_mayorista_lotes
  after insert or update of costo_unitario on producto_lotes
  for each row execute function revisar_piso_mayorista_por_costo();

alter table venta_items add column if not exists precio_tipo text not null default 'NORMAL';

alter table venta_items drop constraint if exists venta_items_precio_tipo_check;
alter table venta_items
  add constraint venta_items_precio_tipo_check
  check (precio_tipo in ('NORMAL', 'MAYORISTA'));

comment on column venta_items.precio_tipo is
  'NORMAL o MAYORISTA: a qué precio se vendió la línea (sql/76).';

-- Para el panel "Página Web → Mayoristas" del POS: costo de referencia y
-- mínimo de cada producto con precio mayorista (o con aviso), en una llamada.
create or replace function resumen_precios_mayoristas()
returns table (producto_id bigint, costo_referencia numeric, precio_minimo numeric)
language sql stable as $$
  select p.id,
         costo_referencia_mayorista(p.id, p.costo_unitario),
         precio_minimo_mayorista(p.id, p.costo_unitario)
    from productos p
   where p.precio_mayorista is not null or p.mayorista_aviso is not null
$$;

-- Estas funciones leen costos: solo el backend (service_role) las llama.
revoke execute on function piso_margen_mayorista() from public, anon, authenticated;
revoke execute on function costo_referencia_mayorista(bigint, numeric) from public, anon, authenticated;
revoke execute on function precio_minimo_mayorista(bigint, numeric) from public, anon, authenticated;
revoke execute on function resumen_precios_mayoristas() from public, anon, authenticated;
revoke execute on function clp_texto(numeric) from public, anon, authenticated;
grant execute on function piso_margen_mayorista() to service_role;
grant execute on function costo_referencia_mayorista(bigint, numeric) to service_role;
grant execute on function precio_minimo_mayorista(bigint, numeric) to service_role;
grant execute on function resumen_precios_mayoristas() to service_role;
grant execute on function clp_texto(numeric) to service_role;
