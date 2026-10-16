-- ============================================================
-- 101 · Propuestas de dónde guardar cada producto (v156)
-- ------------------------------------------------------------
-- Pedido del dueño (16-10-2026): "una opción en el POS para ver los productos
-- que más stock tienen, y una sugerencia para ir guardando las cosas en los
-- cajones y qué cosas pueden ir en caja […] solamente propuesta, yo tengo la
-- palabra final".
--
-- Una fila por producto con la repisa propuesta (A1..I5: letra = mueble,
-- número = repisa de abajo hacia arriba) y, si es chico o suelto, la caja
-- rotulada donde iría dentro de esa repisa. NO mueve nada: el producto queda
-- guardado (producto_ubicaciones) recién cuando el dueño aprieta "Guardar
-- ahí" en POS → Productos → "📦 Más stock y bodega". "No" la deja descartada.
--
-- Idempotente. Tabla nueva → RLS activo sin políticas (solo la service_role).
-- ============================================================

create table if not exists bodega_propuestas (
  producto_id bigint primary key references productos(id) on delete cascade,
  lugar       text not null check (lugar ~ '^[A-I][1-5]$'),
  caja        text null check (caja is null or length(btrim(caja)) between 1 and 60),
  motivo      text null check (motivo is null or length(motivo) <= 200),
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'descartada')),
  creado_en   timestamptz not null default now(),
  decidido_en timestamptz null
);

alter table bodega_propuestas enable row level security;

comment on table bodega_propuestas is
  'Propuesta de Claude de dónde guardar cada producto en la bodega (A1..I5 y caja). Solo se aplica con el clic del dueño.';
