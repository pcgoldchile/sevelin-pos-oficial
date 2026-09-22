-- ============================================================
-- 61 · Devoluciones y anulación de ventas (22-09-2026, pedido del dueño)
-- ------------------------------------------------------------
-- "Me falta una opción en el POS para aplicar devoluciones y registrar o
--  anular ventas […] yo poner una observación, medio de pago por el cual
--  se le devolverá, y entre otras facilidades y automatizaciones."
--
-- POR QUÉ LA VENTA YA NO SE BORRA
--   Hasta hoy la única forma de revertir una venta era DELETE /api/ventas/:id:
--   la venta desaparecía de la base. Al revisar los datos reales, 60 de las
--   202 ventas tienen BOLETA emitida — o sea, ya declaradas al SII. Borrar
--   una de esas deja al POS diciendo algo distinto de lo ya declarado, y la
--   diferencia reaparece meses después en el F29 sin rastro de dónde salió.
--   Una boleta no se borra: se reversa con Nota de Crédito.
--
--   Desde ahora la venta se marca ANULADA y queda para siempre, con el
--   registro de quién, cuándo, por qué, cuánto y por qué medio salió la plata.
--
-- POR QUÉ `ANULADA` ALCANZA PARA QUE FINANZAS QUEDE BIEN SOLA
--   Los 8 lugares donde Finanzas lee ventas (balance, utilidades, saldos,
--   dashboard, contador, proyección, arqueo e IVA) filtran todos por
--   `estado = 'PAGADA'`. Una venta ANULADA sale de todos ellos sin tocar
--   una línea de esos cálculos. La única excepción es el débito del F29,
--   que NO puede encoger hacia atrás: ese caso se resuelve en api/index.js
--   sumando de vuelta las devoluciones posteriores al período (ver
--   `debitoBoletasDelPeriodo`).
--
-- DEVOLUCIÓN PARCIAL
--   La venta sigue PAGADA y se le rebajan total, costo_total y utilidad por
--   las líneas devueltas. Así los mismos 8 lugares quedan correctos sin
--   cambiarlos. El monto original nunca se pierde: se reconstruye sumando
--   `devoluciones.monto`, que es justo lo que necesita el F29.
--
-- LA COMISIÓN DE TARJETA NO SE DEVUELVE A PROPÓSITO
--   Al revertir una venta con tarjeta, la pasarela no reintegra su comisión.
--   Por eso `ventas.comision_pos` queda intacta: ese costo ya se pagó y
--   borrarlo inflaría la utilidad del mes.
-- ============================================================


-- ============================================================
-- 1. NUEVO ESTADO: ANULADA
--    El CHECK de sql/02 solo permitía PAGADA y PENDIENTE.
-- ============================================================
alter table ventas drop constraint if exists ventas_estado_check;

alter table ventas
  add constraint ventas_estado_check check (estado in ('PAGADA', 'PENDIENTE', 'ANULADA'));

alter table ventas add column if not exists devuelta_en timestamptz null;

alter table ventas add column if not exists devolucion_estado text null;

alter table ventas drop constraint if exists ventas_devolucion_estado_check;
alter table ventas
  add constraint ventas_devolucion_estado_check
  check (devolucion_estado is null or devolucion_estado in ('PARCIAL', 'TOTAL'));

comment on column ventas.devuelta_en is
  'Cuándo se registró la última devolución de esta venta. NULL = nunca se devolvió nada.';

comment on column ventas.devolucion_estado is
  'PARCIAL = volvieron algunas líneas y la venta sigue viva. TOTAL = se anuló entera.';


-- ============================================================
-- 2. LA DEVOLUCIÓN
--    `fecha` es el día en que se devolvió (hora de Chile), NO el día de la
--    venta: es el dato que usa el F29 para saber en qué período va la Nota
--    de Crédito.
-- ============================================================
create table if not exists devoluciones (
  id                    bigserial primary key,
  venta_id              bigint not null references ventas(id) on delete cascade,
  tipo                  text not null check (tipo in ('TOTAL', 'PARCIAL')),
  fecha                 date not null,
  motivo                text not null check (motivo in (
                          'FALLA', 'GARANTIA', 'ARREPENTIMIENTO',
                          'PRODUCTO_EQUIVOCADO', 'ERROR_DE_VENTA', 'OTRO')),
  observacion           text null,
  -- 'Sin devolución de dinero' cubre el cambio por otro producto: la
  -- mercadería vuelve pero no sale plata del cajón.
  metodo_devolucion     text not null check (metodo_devolucion in (
                          'Efectivo', 'Transferencia', 'Tarjeta Débito',
                          'Tarjeta Crédito', 'Sin devolución de dinero')),
  monto                 numeric not null default 0 check (monto >= 0),
  costo_devuelto        numeric not null default 0,
  reingresa_stock       boolean not null default true,
  -- Se congela el DTE que tenía la venta: si mañana se corrige el campo en
  -- `ventas`, el aviso de Nota de Crédito que ya se dio sigue explicándose.
  tipo_dte_original     text null,
  requiere_nota_credito boolean not null default false,
  caja_id               bigint null references cajas_diarias(id) on delete set null,
  caja_movimiento_id    bigint null references caja_movimientos(id) on delete set null,
  usuario               text null,
  creado_en             timestamptz not null default now()
);

comment on table devoluciones is
  'Una devolución de venta. La venta NUNCA se borra; acá queda por qué, cuándo y por dónde salió la plata.';

comment on column devoluciones.fecha is
  'Día en que se devolvió (hora de Chile). Es el período que le corresponde a la Nota de Crédito, no el de la venta.';

comment on column devoluciones.requiere_nota_credito is
  'TRUE si la venta tenía BOLETA o FACTURA. El POS solo avisa: emitir la NC en el SII es cosa del dueño.';

create index if not exists idx_devoluciones_venta on devoluciones (venta_id);

-- Una venta se puede anular UNA sola vez. El servidor ya lo valida, pero si
-- dos clicks entran a la vez ambos pasarían la validación y la venta se
-- devolvería dos veces: este índice lo corta en la base, que es el único
-- lugar donde dos peticiones simultáneas no se pueden colar.
create unique index if not exists idx_devoluciones_una_total
  on devoluciones (venta_id) where tipo = 'TOTAL';

create index if not exists idx_devoluciones_fecha on devoluciones (fecha);
create index if not exists idx_devoluciones_nc
  on devoluciones (fecha) where requiere_nota_credito;


-- ============================================================
-- 3. QUÉ VOLVIÓ
--    Una fila por línea devuelta. `reingresa_stock` va por línea y no por
--    devolución completa: de dos productos devueltos, uno puede volver a la
--    repisa y el otro estar quemado y salir como merma.
-- ============================================================
create table if not exists devolucion_items (
  id              bigserial primary key,
  devolucion_id   bigint not null references devoluciones(id) on delete cascade,
  venta_item_id   bigint null references venta_items(id) on delete set null,
  producto_id     bigint null references productos(id) on delete set null,
  -- El nombre se copia por si el producto se borra del catálogo después.
  nombre          text not null,
  cantidad        numeric not null check (cantidad > 0),
  precio_unitario numeric not null default 0,
  costo_unitario  numeric not null default 0,
  monto           numeric not null default 0,
  reingresa_stock boolean not null default true,
  merma_id        bigint null references mermas(id) on delete set null,
  creado_en       timestamptz not null default now()
);

comment on table devolucion_items is
  'Líneas devueltas. Sumar `cantidad` por venta_item_id dice cuánto de esa línea ya volvió.';

comment on column devolucion_items.merma_id is
  'Si la unidad no volvió al stock, la merma que se creó con su costo PEPS real.';

create index if not exists idx_devolucion_items_devolucion on devolucion_items (devolucion_id);
create index if not exists idx_devolucion_items_venta_item on devolucion_items (venta_item_id);
create index if not exists idx_devolucion_items_producto on devolucion_items (producto_id);


-- ============================================================
-- 4. RLS
--    Igual que toda tabla nueva del proyecto: se habilita SIN políticas.
--    Solo la llave service_role del backend entra; anon y authenticated
--    quedan fuera aunque alguien consiga la URL de Supabase.
-- ============================================================
alter table devoluciones     enable row level security;
alter table devolucion_items enable row level security;


-- ============================================================
-- 5. VERIFICACIÓN (debe devolver 3 filas en TRUE)
-- ============================================================
-- select 'ANULADA permitido' as chequeo,
--        pg_get_constraintdef(oid) like '%ANULADA%' as ok
--   from pg_constraint where conname = 'ventas_estado_check'
-- union all
-- select 'devoluciones con RLS', relrowsecurity from pg_class where relname = 'devoluciones'
-- union all
-- select 'devolucion_items con RLS', relrowsecurity from pg_class where relname = 'devolucion_items';
--
-- Y que no haya políticas públicas (debe devolver 0 filas):
-- select tablename, policyname from pg_policies
--  where tablename in ('devoluciones', 'devolucion_items');
