-- 90 · Acuerdo con los padres: mercadería de ellos, pozo del papá y cotizaciones aproximadas (v133, 11-10-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 10 y 11-10-2026, pendiente #87)
-- 1) MERCADERÍA: sus padres le entregan toda su mercadería a costo y a
--    crédito. Les paga $1.000.000 por semana hasta $3.000.000 y con eso queda
--    pagada. Quiere marcar qué productos son de ellos y un aviso cuando lleve
--    $3.000.000 VENDIDOS de ellos, contados al precio de venta ("los $20.000").
--    Casi todos sus productos son distintos de los suyos, con "una opción por
--    si acaso" alguno se repite.
-- 2) POZO DEL PAPÁ: lo que se cobra por sus reparaciones de celulares se junta
--    en un pozo que es de él. Mínimo $1.000.000 al mes: si no se junta, el
--    dueño pone la diferencia; si se pasa, todo es del papá. Al cobrar se
--    decide cuánto va: todo, menos el repuesto que puso el dueño, otro monto o
--    nada; y si el IVA de la boleta lo pone el dueño o el papá ("a veces lo
--    pondré yo, u otras veces él").
-- 3) COTIZACIONES APROXIMADAS: una lista de precios de referencia por equipo
--    y trabajo ("Samsung A07, cambio de parlante, $15.000") para ir cargando.
--
-- LA REGLA
--   · productos.propietario: MIO (lo de siempre), PADRES o AMBOS (el mismo
--     producto lo tienen los dos; la caja pregunta de quién es la unidad).
--   · venta_items.propietario: foto al vender (MIO o PADRES). Lo pone el
--     servidor; el trigger de abajo cubre los caminos que no pasan por la caja
--     (venta web, encargos, importación). NULL = venta anterior a esto (mía).
--   · productos.va_al_pozo: servicio que hace el papá; la caja pregunta por el
--     pozo cuando se vende. venta_items.pozo_monto: cuánto de esa línea es del
--     pozo (NULL = no va). Lo calcula el servidor.
--   · Los PAGOS a los padres y las ENTREGAS al papá son gastos normales de
--     Finanzas, con clasificación propia: no hay otra tabla de plata que
--     pueda desincronizarse del saldo de caja.
--   · ordenes_trabajo.de_padres: marca de que el trabajo lo hace el papá. Es
--     solo un recordatorio en la orden: la plata se cuenta al cobrar en caja.
--
-- Idempotente. Dos tablas nuevas, las dos con RLS.

-- ---------- 1. Productos y líneas de venta ----------
alter table productos add column if not exists propietario text not null default 'MIO';
alter table productos drop constraint if exists productos_propietario_check;
alter table productos
  add constraint productos_propietario_check check (propietario in ('MIO', 'PADRES', 'AMBOS'));
alter table productos add column if not exists va_al_pozo boolean not null default false;

alter table venta_items add column if not exists propietario text null;
alter table venta_items drop constraint if exists venta_items_propietario_check;
alter table venta_items
  add constraint venta_items_propietario_check check (propietario is null or propietario in ('MIO', 'PADRES'));
alter table venta_items add column if not exists pozo_monto numeric null;
alter table venta_items drop constraint if exists venta_items_pozo_monto_check;
alter table venta_items
  add constraint venta_items_pozo_monto_check check (pozo_monto is null or pozo_monto >= 0);
alter table venta_items add column if not exists pozo_nota text null;

alter table ordenes_trabajo add column if not exists de_padres boolean not null default false;

comment on column productos.propietario is
  'De quién es la mercadería: MIO, PADRES o AMBOS (sql/90). AMBOS = la caja pregunta de quién es la unidad vendida.';
comment on column productos.va_al_pozo is
  'Servicio que hace el papá del dueño: al venderlo la caja pregunta cuánto va a su pozo (sql/90).';
comment on column venta_items.propietario is
  'Foto al vender: MIO o PADRES. NULL = venta anterior a sql/90 (del dueño).';
comment on column venta_items.pozo_monto is
  'Pesos de esta línea que son del pozo del papá. NULL = no va al pozo (sql/90).';

-- Red de seguridad: una línea que llega sin dueño toma el de la ficha. La
-- caja ya lo manda puesto; esto cubre la venta web, los encargos y la
-- importación, que insertan por su cuenta. Un producto de los dos (AMBOS)
-- vendido por esos caminos se cuenta como del dueño.
create or replace function venta_items_poner_propietario()
returns trigger
language plpgsql
as $$
declare
  v_propietario text;
begin
  if new.propietario is null then
    if new.producto_id is not null then
      select p.propietario into v_propietario from productos p where p.id = new.producto_id;
    end if;
    new.propietario := case when v_propietario = 'PADRES' then 'PADRES' else 'MIO' end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_venta_items_propietario on venta_items;
create trigger trg_venta_items_propietario
  before insert on venta_items
  for each row execute function venta_items_poner_propietario();

create index if not exists venta_items_propietario_padres_idx on venta_items (venta_id) where propietario = 'PADRES';
create index if not exists venta_items_pozo_idx on venta_items (venta_id) where pozo_monto is not null;

-- ---------- 2. Clasificaciones de gasto del acuerdo ----------
-- INVENTARIO: el pago a los padres es compra de mercadería (Utilidades no lo
-- resta: el costo se reconoce al vender cada producto). OPERATIVO: lo que se
-- le entrega al papá sí es un gasto del mes.
insert into compra_clasificaciones (nombre, grupo, descripcion, activo) values
  ('Mercadería de mis padres', 'INVENTARIO', 'Pagos del acuerdo: $1.000.000 por semana hasta $3.000.000', true),
  ('Pozo de mi papá (servicios de celulares)', 'OPERATIVO', 'Lo que se le entrega a mi papá por sus reparaciones', true)
on conflict (nombre) do nothing;

-- ---------- 3. Los números del acuerdo (una sola fila) ----------
create table if not exists acuerdo_padres (
  id                  int primary key default 1 check (id = 1),
  tope_mercaderia     numeric not null default 3000000 check (tope_mercaderia >= 0),
  cuota_semanal       numeric not null default 1000000 check (cuota_semanal >= 0),
  pozo_minimo_mensual numeric not null default 1000000 check (pozo_minimo_mensual >= 0),
  -- Desde cuándo corre el pozo. NULL = todavía no parte (no se sugiere entregar nada).
  pozo_desde          date null,
  actualizado_en      timestamptz not null default now()
);
alter table acuerdo_padres enable row level security;
insert into acuerdo_padres (id) values (1) on conflict (id) do nothing;

-- ---------- 4. Cotizaciones aproximadas del taller ----------
create table if not exists cotizaciones_referencia (
  id              bigserial primary key,
  equipo          text not null check (length(btrim(equipo)) between 1 and 80),
  trabajo         text not null check (length(btrim(trabajo)) between 1 and 80),
  precio          numeric not null check (precio >= 0),
  -- Lo que cuesta el repuesto (solo lo ve el admin). NULL = sin dato.
  costo_repuesto  numeric null check (costo_repuesto is null or costo_repuesto >= 0),
  nota            text null check (nota is null or length(nota) <= 300),
  actualizado_por text null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
alter table cotizaciones_referencia enable row level security;
create index if not exists cotizaciones_referencia_equipo_idx on cotizaciones_referencia (lower(equipo));
