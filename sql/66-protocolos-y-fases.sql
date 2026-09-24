-- ============================================================
-- 66 · Protocolos y fases de servicio (24-09-2026, pedido del dueño)
-- ------------------------------------------------------------
-- "Que cada servicio se armen FASES que el admin o trabajador debe ir
--  chequeando y también ir registrando pilas cr2032, pasta térmica aplicada,
--  thermalpad aplicado. Cosa de ir tachando las OT y que sea visible siempre
--  las FASES y PROTOCOLO."
--
-- LAS CUATRO REGLAS LAS DECIDIÓ EL DUEÑO (24-09-2026):
--
--   1. ⚠️ EL INSUMO SALE DEL STOCK AL TACHAR LA FASE, no al entregar la OT.
--      "El insumo debe salir al momento de chequear la fase en el protocolo
--       o nivel de fase de ese servicio."
--      Va contra la regla vieja del módulo (ot_repuestos descuenta al pasar a
--      ENTREGADO) y es a propósito: la pasta térmica se gasta el día que se
--      aplica, no el día que el cliente pasa a buscar el equipo.
--      CÓMO CONVIVEN LAS DOS: lo que consume una fase se guarda en
--      ot_repuestos con `stock_descontado = true`. Al entregar, el backend
--      solo descuenta las filas con `stock_descontado = false`, así que no
--      hay doble descuento. Misma marca que se usó para las 2 CR2032 de las
--      OT-000005 y OT-000006.
--
--   2. Los envases (frasco de masilla, jeringa de pasta) van POR RENDIMIENTO,
--      no por peso. Ver el bloque de `repuestos` más abajo.
--
--   3. El trabajador PUEDE destachar una fase, pero queda registrado quién y
--      cuándo — y puede escribir su nombre, porque el JWT solo lleva el rol
--      (`admin` / `trabajador`), no identidad individual.
--
--   4. Si faltan fases obligatorias, SOLO EL ADMIN puede entregar la OT.
--      El trabajador no puede forzarla.
-- ============================================================


-- ============================================================
-- LA PLANTILLA
-- ============================================================

create table if not exists protocolos (
  id          bigserial primary key,
  nombre      text not null,
  -- El servicio del catálogo al que corresponde (los 27 de "Servicios
  -- Técnicos"). Opcional: puede haber un protocolo interno sin servicio.
  producto_id bigint null references productos(id) on delete set null,
  descripcion text null,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_protocolos_producto on protocolos (producto_id);

create table if not exists protocolo_fases (
  id           bigserial primary key,
  protocolo_id bigint not null references protocolos(id) on delete cascade,
  nombre       text not null,
  orden        integer not null default 0,
  -- Si es obligatoria, la OT no se entrega sin tacharla (salvo que el admin
  -- la fuerce dejando el motivo escrito).
  obligatoria  boolean not null default true,
  -- Fases donde la nota es el entregable ("temperatura de prueba: 62°C").
  pide_nota    boolean not null default false,
  creado_en    timestamptz not null default now()
);

create index if not exists idx_protocolo_fases_protocolo
  on protocolo_fases (protocolo_id, orden);

-- Los insumos van POR FASE, no por protocolo: es lo que pidió el dueño
-- ("a nivel de fase de ese servicio") y es lo que permite que el stock salga
-- en el momento exacto en que se aplica.
create table if not exists protocolo_insumos (
  id                bigserial primary key,
  protocolo_fase_id bigint not null references protocolo_fases(id) on delete cascade,

  -- Uno de los dos. `repuestos` es el inventario del taller (lo que nunca se
  -- vende); `productos` es el catálogo (la CR2032, que sí se vende).
  repuesto_id bigint null references repuestos(id) on delete cascade,
  producto_id bigint null references productos(id) on delete cascade,

  nombre   text not null,                  -- para mostrar sin ir a buscarlo
  cantidad numeric not null default 1 check (cantidad > 0),

  -- true  → es un envase: suma UNA aplicación, no descuenta una unidad.
  -- false → unidad discreta (una CR2032 = una unidad de stock).
  por_rendimiento boolean not null default false,

  creado_en timestamptz not null default now(),

  constraint protocolo_insumos_origen
    check (repuesto_id is not null or producto_id is not null)
);

create index if not exists idx_protocolo_insumos_fase
  on protocolo_insumos (protocolo_fase_id);


-- ============================================================
-- LA INSTANCIA EN UNA OT
-- ============================================================
-- El nombre y el orden se COPIAN, no se enlazan: si en diciembre se edita el
-- protocolo, las OT de septiembre tienen que seguir mostrando lo que de
-- verdad se hizo. Mismo principio que congelar el costo en venta_items.
--
-- `protocolo_fase_id` se conserva solo para leer los insumos planificados
-- mientras la plantilla exista. Si se borra, queda en null y la fase sigue
-- viva con su nombre congelado.
create table if not exists ot_fases (
  id     bigserial primary key,
  ot_id  bigint not null references ordenes_trabajo(id) on delete cascade,

  protocolo_id      bigint null references protocolos(id) on delete set null,
  protocolo_fase_id bigint null references protocolo_fases(id) on delete set null,
  protocolo_nombre  text not null,          -- congelado
  nombre            text not null,          -- congelado
  orden             integer not null default 0,
  obligatoria       boolean not null default true,
  pide_nota         boolean not null default false,

  -- ---- El tachado ----
  completada_en     timestamptz null,
  -- El JWT solo lleva el rol, así que se guardan los dos: el rol (que es
  -- dato duro) y el nombre que la persona escriba (decisión del dueño:
  -- "que pueda llenar con su nombre en caso de").
  completada_por_rol    text null,
  completada_por_nombre text null,
  nota                  text null,

  -- ---- El destachado, que también se registra (regla 3) ----
  destachada_en         timestamptz null,
  destachada_por_rol    text null,
  destachada_por_nombre text null,

  creado_en timestamptz not null default now()
);

create index if not exists idx_ot_fases_ot on ot_fases (ot_id, orden);

-- Las OT con fases sin tachar: es la consulta del aviso "servicios en curso".
create index if not exists idx_ot_fases_pendientes
  on ot_fases (ot_id)
  where completada_en is null;


-- ============================================================
-- QUÉ CONSUMIÓ CADA FASE
-- ============================================================
-- No se creó una tabla nueva: lo consumido va a `ot_repuestos`, que ya existe,
-- ya suma a los totales de la OT y ya sabe devolver stock al borrarse. Solo
-- le falta saber QUÉ FASE lo consumió, para poder deshacerlo al destachar.
alter table ot_repuestos
  add column if not exists ot_fase_id bigint null references ot_fases(id) on delete set null;

create index if not exists idx_ot_repuestos_fase on ot_repuestos (ot_fase_id);

comment on column ot_repuestos.ot_fase_id is
  'La fase del protocolo que consumió este insumo (sql/66). Al destachar la fase, estas filas devuelven su stock y se borran.';


-- ============================================================
-- RENDIMIENTO DE ENVASES  (regla 2)
-- ============================================================
-- POR QUÉ NO SE MIDE POR PESO
--   Pesar exigiría una balanza de 0,1 g y pesar el frasco antes y después de
--   cada trabajo. Es un paso que se salta, y un sistema que depende de un
--   paso que se salta da datos peores que uno que no lo pide. Además la plata
--   es chica: la pasta HY410 de 10 g cuesta $1.046 — unos $100 por aplicación.
--
-- CÓMO FUNCIONA
--   El dueño declara UNA vez cuántas aplicaciones le rinde el envase. Cada
--   fase tachada suma aplicaciones. Cuando se llega al rendimiento, se
--   descuenta UN envase del stock y el contador vuelve a empezar. El stock
--   queda siempre en envases enteros, sin decimales falsos.
--
--   Costo real por aplicación = costo_unitario / rinde_aplicaciones.
--
--   SE AUTOCORRIGE: cuando el envase se acaba de verdad, se ve cuántas
--   aplicaciones cubrió y se ajusta el número. El segundo envase ya estima
--   mejor que el primero, solo.
alter table repuestos
  add column if not exists rinde_aplicaciones  numeric null check (rinde_aplicaciones is null or rinde_aplicaciones > 0),
  add column if not exists aplicaciones_usadas numeric not null default 0 check (aplicaciones_usadas >= 0);

comment on column repuestos.rinde_aplicaciones is
  'Cuántas aplicaciones rinde un envase. NULL = insumo de unidad discreta, se descuenta de a uno.';

comment on column repuestos.aplicaciones_usadas is
  'Aplicaciones gastadas del envase abierto. Al llegar a rinde_aplicaciones se descuenta un envase del stock y vuelve a cero.';


-- ============================================================
-- LA ENTREGA CON FASES PENDIENTES  (regla 4)
-- ============================================================
-- Solo el admin puede entregar una OT con fases obligatorias sin tachar, y
-- tiene que dejar escrito por qué. El trabajador no puede forzarla.
alter table ordenes_trabajo
  add column if not exists entrega_forzada_motivo text null;

comment on column ordenes_trabajo.entrega_forzada_motivo is
  'Por qué se entregó con fases obligatorias sin tachar. Solo lo puede escribir el admin (sql/66).';


-- ============================================================
-- RLS: habilitada y sin políticas en las tablas nuevas, como todo el
-- proyecto. Solo entra la llave service_role del backend.
-- ============================================================
alter table protocolos        enable row level security;
alter table protocolo_fases   enable row level security;
alter table protocolo_insumos enable row level security;
alter table ot_fases          enable row level security;


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- select relname, relrowsecurity from pg_class
--   where relname in ('protocolos','protocolo_fases','protocolo_insumos','ot_fases');  -- todas true
-- select count(*) from pg_policies
--   where tablename in ('protocolos','protocolo_fases','protocolo_insumos','ot_fases');  -- 0
