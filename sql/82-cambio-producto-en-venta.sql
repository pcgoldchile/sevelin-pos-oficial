-- 82 · Cambiar el producto de una venta ya registrada (v114, 03-10-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 03-10-2026)
-- La web vendió un Adaptador USB WiFi 6 que en la tienda no estaba (venta
-- #250). El dueño le entregó otro producto al MISMO precio, ya conversado con
-- el cliente, y necesita dejarlo así en el POS: "necesito que yo pueda
-- cambiar el producto desde la interfaz".
--
-- LA REGLA
--   · El precio y el total de la venta NO cambian (mismo precio). Si el
--     precio es distinto, eso es una devolución y una venta nueva.
--   · Cambia el producto de UNA línea, entera: la línea queda con el producto
--     nuevo (nombre, SKU, costo, condición y garantía), se descuenta su stock
--     y se recalculan el costo y la utilidad de la venta.
--   · El producto original vuelve al stock solo si el dueño lo dice al hacer
--     el cambio (puede no haber existido nunca: un descuadre de conteo).
--   · Solo admin. La línea no cambia de id: garantías y devoluciones siguen
--     apuntando a ella.
--
-- Esta tabla es el REGISTRO del cambio (qué había antes y qué quedó): el
-- detalle de la venta lo muestra, y sin él no habría rastro del producto
-- original. Lo escribe POST /api/ventas/:id/cambiar-producto.
-- RLS activo y sin políticas: solo el backend (service_role). Idempotente.

create table if not exists venta_cambios_producto (
  id bigserial primary key,
  venta_id bigint not null references ventas(id) on delete cascade,
  -- Sin llave foránea: "Editar venta" reemplaza las líneas y les da ids nuevos.
  venta_item_id bigint not null,
  cantidad numeric not null check (cantidad > 0),

  producto_anterior_id bigint null,
  nombre_anterior text not null,
  sku_anterior text null,
  costo_anterior numeric not null default 0,
  serie_anterior text null,
  -- true = la unidad original volvió al stock; false = no volvió (no existía, se perdió).
  original_vuelve_stock boolean not null,

  producto_nuevo_id bigint not null,
  nombre_nuevo text not null,
  sku_nuevo text null,
  costo_nuevo numeric not null default 0,
  serie_nueva text null,

  motivo text null check (motivo is null or length(motivo) <= 300),
  creado_por text not null default 'admin',
  creado_en timestamptz not null default now()
);

create index if not exists venta_cambios_producto_venta on venta_cambios_producto (venta_id, id);

alter table venta_cambios_producto enable row level security;

comment on table venta_cambios_producto is
  'Registro de cada cambio de producto en una venta ya hecha (v114): qué había, qué quedó y si el original volvió al stock. Sin políticas: solo service_role.';
