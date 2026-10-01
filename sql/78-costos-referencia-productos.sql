-- 78 · Costo de referencia de todos los productos (v105, 01-10-2026) — pendiente #44
-- ======================================================================
-- EL PEDIDO (dueño, 01-10-2026)
-- Ver de forma visual cuánto margina cada producto, al por menor y al por
-- mayor, en la lista de Productos.
--
-- POR QUÉ UNA FUNCIÓN
-- El margen se tiene que calcular con el MAYOR costo conocido (ficha, última
-- compra y capas PEPS con unidades), el mismo que usa el piso mayorista de
-- sql/76: productos.costo_unitario no sube al registrar una compra más cara,
-- y con ese solo el margen saldría inflado. resumen_precios_mayoristas()
-- devuelve ese costo solo para los productos con precio mayorista; esta lo
-- devuelve para todo el catálogo vigente, en una llamada.
--
-- Solo lectura. No crea tablas. Idempotente.

create or replace function costos_referencia_productos()
returns table (producto_id bigint, costo_referencia numeric)
language sql stable as $$
  select p.id, costo_referencia_mayorista(p.id, p.costo_unitario)
    from productos p
   where not coalesce(p.archivado, false)
     and not coalesce(p.es_borrador, false)
$$;

-- Lee costos: solo el backend (service_role) la llama.
revoke execute on function costos_referencia_productos() from public, anon, authenticated;
grant execute on function costos_referencia_productos() to service_role;
