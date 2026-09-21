-- ============================================================
-- 60 · Dónde está guardado cada producto, y el plazo de cada proveedor
--      (21-09-2026, pedido del dueño)
-- ------------------------------------------------------------
-- "Agregar la ubicación del hueco/espacio/cajón donde se encuentra ese
--  objeto […] pasa que en una caja se guarda más de un producto […] poder
--  agregar otro espacio adicional por si en un lugar guardé los sueltos y
--  en otro dejé otra caja del mismo producto."
--
-- DOS TABLAS Y NO UN CAMPO DE TEXTO, por lo que él mismo describe:
--   · Una caja guarda VARIOS productos. Con un texto suelto en `productos`
--     nunca se podría preguntar "¿qué hay en la Caja 3?".
--   · Un producto puede estar en VARIOS lugares a la vez (los sueltos en un
--     estante, una caja cerrada en otro). Un campo único obligaría a elegir.
--
-- La foto vive en la UBICACIÓN, no en el par producto-ubicación: es la foto
-- del estante o de la caja, y sirve para todos los productos que estén ahí.
-- La nota sí es del par ("adentro de la caja azul, junto a las pastas").
-- ============================================================

create table if not exists ubicaciones (
  id          bigserial primary key,
  nombre      text not null,
  tipo        text null check (tipo in ('estante', 'caja', 'cajon', 'vitrina', 'bodega', 'otro')),
  descripcion text null,
  foto_url    text null,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- Nombres únicos sin importar mayúsculas ni espacios de más: evita terminar
-- con "Caja 3", "caja 3" y "CAJA 3" como tres lugares distintos (mismo
-- problema que ya hubo con las marcas).
create unique index if not exists idx_ubicaciones_nombre
  on ubicaciones (lower(trim(nombre)));

comment on table ubicaciones is
  'Lugares físicos donde se guarda mercadería: estantes, cajas, cajones. Una caja puede tener varios productos.';

create table if not exists producto_ubicaciones (
  id           bigserial primary key,
  producto_id  bigint not null references productos(id) on delete cascade,
  ubicacion_id bigint not null references ubicaciones(id) on delete cascade,
  nota         text null,
  principal    boolean not null default false,
  creado_en    timestamptz not null default now(),
  unique (producto_id, ubicacion_id)
);

create index if not exists idx_producto_ubicaciones_producto on producto_ubicaciones (producto_id);
create index if not exists idx_producto_ubicaciones_ubicacion on producto_ubicaciones (ubicacion_id);

comment on table producto_ubicaciones is
  'En qué lugar(es) está guardado un producto. `nota` es el detalle de ESE producto en ESE lugar.';
comment on column producto_ubicaciones.principal is
  'El lugar donde se busca primero. Es el que se propone al reponer stock.';

-- ------------------------------------------------------------
-- Plazo de devolución por proveedor
-- ------------------------------------------------------------
-- La fecha "se puede devolver hasta" es el campo que más queda vacío,
-- porque hay que calcularla a mano en cada compra. El plazo casi nunca
-- cambia: es del proveedor, no de la compra. Guardándolo una vez, la fecha
-- se propone sola (y se puede corregir: es una propuesta, no una regla).
create table if not exists proveedores_plazos (
  proveedor        text primary key,
  dias_devolucion  integer null check (dias_devolucion >= 0),
  nota             text null,
  actualizado_en   timestamptz not null default now()
);

comment on table proveedores_plazos is
  'Días que cada proveedor acepta devoluciones. Se usa para proponer la fecha al registrar una compra.';

-- Solo el backend (service_role). Ninguna política para anon/authenticated.
alter table ubicaciones           enable row level security;
alter table producto_ubicaciones  enable row level security;
alter table proveedores_plazos    enable row level security;
