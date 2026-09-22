-- ============================================================
-- 63 · Qué pasó con el producto devuelto (22-09-2026, pedido del dueño)
-- ------------------------------------------------------------
-- "Me sirve para después actualizar si ese producto lo devolví al
--  proveedor, y hacer seguimiento si me devolvieron la plata, o lo boté.
--  Necesito que sea con seguimiento, y que se vincule a notificaciones
--  según los plazos que yo determine."
--
-- VA POR PRODUCTO Y NO POR DEVOLUCIÓN (decisión del dueño)
--   Si en una misma devolución vuelven dos cosas, una puede irse al
--   proveedor y la otra a la basura. Atarlo a la devolución completa lo
--   obligaría a elegir un solo camino para las dos.
--
-- EL PROVEEDOR Y EL FABRICANTE SON CAMINOS DISTINTOS (decisión del dueño:
-- "Sí, son diferentes"). Cambian a quién le reclamas, los plazos y qué
-- esperas de vuelta: el proveedor devuelve plata, el fabricante casi
-- siempre cambia la unidad.
--
-- ⚠️ EL AJUSTE DEL GASTO NUNCA ES AUTOMÁTICO (decisión del dueño)
--   "Apruebo, pero siempre yo debo vigilar y aprobar si se debe ajustar o
--    no manualmente, para que no se descuente de forma automática del
--    balance."
--   Por eso el ajuste tiene su propio estado: el POS lo PROPONE con el
--   monto calculado, y no toca ni un peso del balance hasta que él lo
--   aprueba. Rechazarlo también es una respuesta válida y queda guardada.
-- ============================================================

create table if not exists devolucion_seguimiento (
  id                 bigserial primary key,
  -- Una fila por línea devuelta. El índice único de más abajo lo garantiza.
  devolucion_item_id bigint not null references devolucion_items(id) on delete cascade,

  destino  text not null default 'SIN_DECIDIR' check (destino in (
             'SIN_DECIDIR',
             'AL_PROVEEDOR',            -- se lo devolví a quien me lo vendió
             'A_GARANTIA_FABRICANTE',   -- lo mandé a la garantía de la marca
             'BOTADO',
             'REPARADO',                -- lo arreglé y volvió al stock
             'ME_LO_QUEDE')),           -- repuestos o uso interno

  -- Solo para los dos caminos que esperan respuesta de un tercero.
  resultado text null check (resultado in (
              'ESPERANDO', 'PLATA_DEVUELTA', 'CAMBIADO', 'RECHAZADO')),

  destinatario     text null,     -- nombre del proveedor o de la marca
  enviado_el       date null,
  -- El plazo lo pone el dueño. Se sugiere con proveedores_plazos (sql/60)
  -- cuando el destinatario coincide con un proveedor que ya usó.
  esperado_para    date null,
  resuelto_el      date null,
  monto_recuperado numeric not null default 0 check (monto_recuperado >= 0),
  -- Si lo cambiaron por otra unidad y esa unidad entró al inventario.
  reemplazo_a_stock boolean not null default false,
  nota             text null,

  -- ---- El ajuste del gasto de la merma, siempre con su visto bueno ----
  ajuste_estado      text not null default 'NO_APLICA' check (ajuste_estado in (
                       'NO_APLICA',   -- no hay merma que ajustar
                       'PROPUESTO',   -- el POS calculó cuánto, esperando al dueño
                       'APLICADO',
                       'RECHAZADO')),
  ajuste_monto       numeric not null default 0,
  ajuste_resuelto_en timestamptz null,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Una sola ficha de seguimiento por línea devuelta.
create unique index if not exists idx_devolucion_seguimiento_item
  on devolucion_seguimiento (devolucion_item_id);

-- Las que esperan respuesta de un tercero: es la consulta del aviso.
create index if not exists idx_devolucion_seguimiento_esperando
  on devolucion_seguimiento (esperado_para)
  where resultado = 'ESPERANDO';

-- Las que todavía no se decidieron: ahí es donde la plata se pierde callada.
create index if not exists idx_devolucion_seguimiento_sin_decidir
  on devolucion_seguimiento (creado_en)
  where destino = 'SIN_DECIDIR';

-- Los ajustes esperando su aprobación.
create index if not exists idx_devolucion_seguimiento_ajuste
  on devolucion_seguimiento (id)
  where ajuste_estado = 'PROPUESTO';

comment on table devolucion_seguimiento is
  'Qué pasó con cada producto devuelto: si se fue al proveedor o a garantía, si volvió la plata, o si se botó.';

comment on column devolucion_seguimiento.esperado_para is
  'Fecha aproximada que puso el dueño para esperar respuesta. Al pasarse, el producto aparece en el aviso del header.';

comment on column devolucion_seguimiento.ajuste_estado is
  'PROPUESTO = el POS calculó cuánto habría que descontarle al gasto de la merma, pero NO tocó el balance. Solo el dueño lo aplica.';


-- ============================================================
-- RLS: habilitada y sin políticas, como toda tabla del proyecto.
-- Solo entra la llave service_role del backend.
-- ============================================================
alter table devolucion_seguimiento enable row level security;


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- select relrowsecurity from pg_class where relname = 'devolucion_seguimiento';  -- true
-- select count(*) from pg_policies where tablename = 'devolucion_seguimiento';   -- 0
