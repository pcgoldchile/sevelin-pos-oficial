-- 81 · Precio mayorista con un segundo escalón (v111, 03-10-2026) — pendiente #28
-- ======================================================================
-- EL PEDIDO (dueño, 03-10-2026): "de 3 a 9 unidades un precio y de 10 en
-- adelante otro más bajo".
--
-- LA REGLA
--   · precio_mayorista_2 / mayorista_desde_2: un segundo precio por unidad,
--     más bajo, desde una cantidad mayor del MISMO producto. Opcional: van los
--     dos o ninguno, y solo si el producto ya tiene su primer precio mayorista.
--   · mayorista_desde_2 > mayorista_desde y precio_mayorista_2 < precio_mayorista.
--   · Mismo piso que el primero: 20% de margen sobre el mayor costo conocido
--     (precio_minimo_mayorista, sql/76). Si una compra sube el costo o el
--     primer escalón cambia y el segundo deja de cumplir, la base desactiva
--     SOLO el segundo y deja el motivo en mayorista_aviso. Si se desactiva el
--     primero, el segundo se va con él.
--
-- Viaja a la tienda solo (trg_sync_tienda manda la fila completa); la tienda
-- lo guarda en precios_mayoristas (supabase/40 del otro repo). Idempotente.

alter table productos add column if not exists precio_mayorista_2 numeric null;
alter table productos add column if not exists mayorista_desde_2 integer null;

alter table productos drop constraint if exists productos_mayorista_2_check;
alter table productos
  add constraint productos_mayorista_2_check
  check (
    (precio_mayorista_2 is null and mayorista_desde_2 is null)
    or (precio_mayorista is not null
        and precio_mayorista_2 > 0 and precio_mayorista_2 < precio_mayorista
        and mayorista_desde_2 is not null and mayorista_desde_2 > mayorista_desde
        and mayorista_desde_2 <= 1000)
  );

comment on column productos.precio_mayorista_2 is
  'Segundo escalón mayorista: precio por unidad desde mayorista_desde_2 unidades. Menor que precio_mayorista. NULL = un solo escalón. No es público.';
comment on column productos.mayorista_desde_2 is
  'Cantidad mínima del mismo producto para precio_mayorista_2. Mayor que mayorista_desde.';

-- La guardia de sql/76, ahora con los dos escalones.
create or replace function productos_guardia_mayorista() returns trigger
language plpgsql as $$
declare
  v_costo numeric;
  v_minimo numeric;
  v_normal numeric;
  v_motivo text;
begin
  if new.precio_mayorista is null then
    -- Sin primer escalón no hay segundo.
    new.precio_mayorista_2 := null;
    new.mayorista_desde_2 := null;
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
    new.precio_mayorista_2 := null;
    new.mayorista_desde_2 := null;
    return new;
  end if;

  -- Segundo escalón: el primero sigue en pie aunque este no cumpla.
  if new.precio_mayorista_2 is not null or new.mayorista_desde_2 is not null then
    v_motivo := case
      when new.precio_mayorista_2 is null or new.mayorista_desde_2 is null
        then 'Le falta el precio o la cantidad'
      when new.mayorista_desde_2 <= new.mayorista_desde
        then format('Su cantidad (%s u.) tiene que ser mayor que la del primer escalón (%s u.)',
                    new.mayorista_desde_2, new.mayorista_desde)
      when new.precio_mayorista_2 >= new.precio_mayorista
        then format('Su precio (%s) tiene que ser menor que el del primer escalón (%s)',
                    clp_texto(new.precio_mayorista_2), clp_texto(new.precio_mayorista))
      when new.precio_mayorista_2 < v_minimo
        then format('Con el costo de %s, el mayorista mínimo es %s (piso de %s%% de margen)',
                    clp_texto(v_costo), clp_texto(v_minimo), round(piso_margen_mayorista() * 100))
      else null
    end;
    if v_motivo is not null then
      new.mayorista_aviso := format('Se desactivó el segundo escalón mayorista (%s desde %s u.): %s',
                                    coalesce(clp_texto(new.precio_mayorista_2), 'sin precio'),
                                    coalesce(new.mayorista_desde_2::text, '?'), v_motivo);
      new.mayorista_aviso_en := now();
      new.precio_mayorista_2 := null;
      new.mayorista_desde_2 := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_productos_guardia_mayorista on productos;
create trigger trg_productos_guardia_mayorista
  before insert or update of precio_mayorista, mayorista_desde, precio_mayorista_2, mayorista_desde_2,
    costo_unitario, precio_unitario, precio_web, es_servicio, stock_ilimitado, es_pedido_encargo,
    precio_a_consultar
  on productos for each row execute function productos_guardia_mayorista();

-- Una compra o una capa PEPS más cara: se vuelve a pasar el producto por la
-- guardia si CUALQUIERA de los dos escalones quedó bajo el piso.
create or replace function revisar_piso_mayorista_por_costo() returns trigger
language plpgsql as $$
begin
  update productos p set precio_mayorista = p.precio_mayorista
   where p.id = new.producto_id
     and p.precio_mayorista is not null
     and least(p.precio_mayorista, coalesce(p.precio_mayorista_2, p.precio_mayorista))
         < precio_minimo_mayorista(p.id, p.costo_unitario);
  return new;
end $$;
