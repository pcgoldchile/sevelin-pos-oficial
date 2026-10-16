-- ============================================================
-- 102 · Cotizador de reparaciones de celulares (v157)
-- ------------------------------------------------------------
-- Pedido del dueño (15 y 16-10-2026): "que tanto en el POS y la app del
-- taller podamos cotizar y tener un precio estimado (que sea estimado, ya que
-- los repuestos pueden variar de precio según fecha) […] para tener una idea
-- de cuánto cobrar + la mano de obra".
--
-- Una fila por equipo + trabajo + calidad, con el costo del repuesto según la
-- lista del proveedor (con IVA), la mano de obra y el precio estimado
-- (repuesto + 15% + mano de obra, redondeado al millar). Se carga desde la
-- lista de Multiphone con scripts/cargar-precios-reparacion.py; cuando llegue
-- una lista nueva se reemplazan las filas de ese proveedor.
--
-- Es SOLO referencia: no crea productos, no toca ventas ni órdenes. El costo y
-- la mano de obra los ve solo el admin; el taller ve el precio.
-- Idempotente. Tabla nueva → RLS activo sin políticas (solo la service_role).
-- ============================================================

create table if not exists reparaciones_precios (
  id              bigserial primary key,
  marca           text not null check (length(btrim(marca)) between 1 and 40),
  equipo          text not null check (length(btrim(equipo)) between 1 and 160),
  trabajo         text not null check (length(btrim(trabajo)) between 1 and 80),
  calidad         text null check (calidad is null or length(calidad) <= 60),
  costo_repuesto  numeric not null check (costo_repuesto >= 0),
  mano_obra       numeric not null check (mano_obra >= 0),
  precio          numeric not null check (precio >= 0),
  proveedor       text not null default 'Multiphone',
  lista_fecha     date not null,
  pagina          integer null,
  detalle_lista   text null check (detalle_lista is null or length(detalle_lista) <= 200),
  activo          boolean not null default true,
  actualizado_en  timestamptz not null default now()
);

alter table reparaciones_precios enable row level security;

create index if not exists reparaciones_precios_equipo_idx on reparaciones_precios (lower(equipo));
create index if not exists reparaciones_precios_marca_trabajo_idx on reparaciones_precios (marca, trabajo);

comment on table reparaciones_precios is
  'Precios estimados de reparación de celulares (repuesto del proveedor + 15% + mano de obra). Solo referencia para cotizar.';
