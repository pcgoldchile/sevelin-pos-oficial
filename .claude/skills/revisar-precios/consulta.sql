with ult as (
  select distinct on (producto_id) producto_id, costo_unitario
  from ingresos_mercaderia order by producto_id, id desc
), lot as (
  select producto_id, max(costo_unitario) costo from producto_lotes where cantidad > 0 group by producto_id
), vend as (
  select vi.producto_id,
         sum(vi.cantidad) unidades,
         sum(vi.subtotal) vendido,
         count(distinct vi.venta_id) ventas,
         max(v.fecha) ultima_venta,
         min(vi.precio_unitario) precio_min_vendido,
         max(vi.precio_unitario) precio_max_vendido
  from venta_items vi join ventas v on v.id = vi.venta_id
  where v.estado = 'PAGADA' and vi.producto_id is not null
  group by vi.producto_id
)
select coalesce(json_agg(t order by t.categoria, t.nombre), '[]'::json) from (
  select p.id, p.nombre, coalesce(pc.nombre, p.categoria_web, '(sin)') categoria, p.marca, p.condicion,
         p.stock, p.costo_unitario costo_ficha,
         greatest(p.costo_unitario, coalesce(ult.costo_unitario, 0), coalesce(lot.costo, 0)) costo_ref,
         p.precio_unitario precio, p.precio_web, p.publicado_web, p.created_at::date creado,
         coalesce(vend.unidades, 0) unidades, coalesce(vend.vendido, 0) vendido, coalesce(vend.ventas, 0) ventas,
         vend.ultima_venta, vend.precio_min_vendido, vend.precio_max_vendido
  from productos p
  left join producto_categorias pc on pc.id = p.categoria_id
  left join ult on ult.producto_id = p.id
  left join lot on lot.producto_id = p.id
  left join vend on vend.producto_id = p.id
  where not coalesce(p.archivado, false) and not coalesce(p.es_borrador, false)
    and not coalesce(p.es_servicio, false) and not coalesce(p.stock_ilimitado, false)
    and not coalesce(p.es_pedido_encargo, false) and not coalesce(p.precio_a_consultar, false)
) t;
