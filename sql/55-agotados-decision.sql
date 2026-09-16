-- 55 · Qué hacer con un producto cuando se agota (lo decide el dueño)
-- ===================================================================
-- EL PROBLEMA (dueño, 16-09-2026)
-- Un producto que llega a stock 0 hoy se queda ahí, callado. No se repone,
-- no se archiva, no pasa a encargo: simplemente deja de venderse y nadie
-- se entera. Los caminos ya existen todos —`por_llegar` (sql/42),
-- `es_pedido_encargo` (sql/30) y `archivado` (sql/32)— pero no hay nada
-- que PREGUNTE cuál de los tres corresponde.
--
-- LA REGLA QUE PIDIÓ EL DUEÑO: nada se mueve solo. El POS detecta, avisa y
-- ofrece las cuatro salidas (por llegar / encargo / archivar / dejarlo como
-- está); él aprueba una, siempre. Por eso esta tabla guarda la DECISIÓN,
-- no la ejecuta: el cambio sobre `productos` lo hace el endpoint recién
-- cuando hay una decisión escrita.
--
-- "Dejarlo como está" también es una decisión y se guarda: sin eso, el
-- aviso volvería a aparecer cada vez y se volvería ruido que se ignora.
--
-- SI EL PRODUCTO VUELVE A TENER STOCK, la fila se borra sola (lo hace el
-- endpoint GET /api/productos/agotados). Así, cuando se agote de nuevo,
-- vuelve a preguntar: la decisión de septiembre no tiene por qué servir
-- para la de diciembre.
--
-- Idempotente.

create table if not exists agotados_decisiones (
  producto_id        bigint primary key references productos(id) on delete cascade,
  detectado_en       timestamptz not null default now(),
  decision           text null check (decision in ('por_llegar', 'encargo', 'archivar', 'dejar')),
  decidido_en        timestamptz null,
  decidido_por       text null,
  nota               text null
);

create index if not exists agotados_pendientes_idx
  on agotados_decisiones (detectado_en desc) where decision is null;

-- RLS: el frontend nunca habla con Supabase directo (solo el backend con
-- service_role, que la omite). Sin esto la tabla quedaría abierta a la
-- llave anónima — el olvido que ya costó dos alertas críticas en la tienda.
alter table agotados_decisiones enable row level security;

comment on table agotados_decisiones is
  'Un producto que llegó a stock 0 y qué decidió el dueño: por_llegar, encargo, archivar o dejar. La fila se borra cuando el producto vuelve a tener stock, para volver a preguntar la próxima vez (sql/55).';
comment on column agotados_decisiones.decision is
  'NULL = pendiente de aprobación. Nada se mueve solo: el cambio sobre productos se aplica recién cuando hay decisión.';
