-- 92 · Usuarios con RUT y PIN, y la app del taller para el celular
-- ===============================================================
-- POR QUÉ (dueño, 11 y 12-10-2026): cada persona entra con su RUT y su PIN, y
-- en el celular se registra cada servicio técnico "muy simple y rápido": qué
-- equipo, qué repuesto, si estaba en stock o se fue a comprar, cuánto salió el
-- viaje, quién puso la plata, quién desarmó, instaló y probó, y si ya se cobró.
-- "Siempre llevando cuentas claras": con eso el POS saca cuánto hay que
-- devolverle a quien puso plata en un trabajo que no era suyo.
--
-- Las cuentas se calculan en api/index.js (cuentasDeTrabajoTaller); aquí solo
-- se guardan los hechos. Idempotente.

-- ---------- 1. Usuarios ----------
create table if not exists usuarios (
  id                bigserial primary key,
  -- Como se muestra en pantalla: "C. Alejandro Silva", "C. Patricio Silva".
  nombre            text not null check (length(btrim(nombre)) between 2 and 60),
  -- Sin puntos, con guion y dígito verificador: '12345678-5'.
  rut               text not null check (rut ~ '^[0-9]{7,8}-[0-9K]$'),
  -- scrypt$sal$resumen. El PIN nunca se guarda ni se devuelve.
  pin_hash          text null,
  rol               text not null default 'trabajador' check (rol in ('admin', 'trabajador')),
  -- Quién es en las cuentas del taller: DUENO = Sevelin (lo que no es de otro
  -- es suyo), PAPA = el del pozo (sql/90). A lo más uno de cada uno.
  papel_taller      text null check (papel_taller in ('DUENO', 'PAPA')),
  activo            boolean not null default true,
  -- Para los permisos por casillas (pendiente #98). Hoy no se lee.
  permisos          jsonb not null default '{}'::jsonb,
  intentos_fallidos int not null default 0,
  bloqueado_hasta   timestamptz null,
  ultimo_ingreso_en timestamptz null,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create unique index if not exists usuarios_rut_uidx on usuarios (rut);
create unique index if not exists usuarios_papel_taller_uidx on usuarios (papel_taller) where papel_taller is not null;
alter table usuarios enable row level security;

-- ---------- 2. Listas de la app: repuestos, calidades de pantalla y lugares ----------
create table if not exists taller_catalogo (
  id         bigserial primary key,
  tipo       text not null check (tipo in ('REPUESTO', 'CALIDAD_PANTALLA', 'LUGAR')),
  -- Solo en los repuestos: en qué equipo se ofrece. NULL = en todos.
  equipo     text null check (equipo in ('CELULAR', 'COMPUTADOR', 'OTRO')),
  nombre     text not null check (length(btrim(nombre)) between 1 and 60),
  orden      int not null default 500,
  activo     boolean not null default true,
  creado_por bigint null references usuarios (id),
  creado_en  timestamptz not null default now()
);
create unique index if not exists taller_catalogo_uidx
  on taller_catalogo (tipo, coalesce(equipo, ''), lower(btrim(nombre)));
alter table taller_catalogo enable row level security;

insert into taller_catalogo (tipo, equipo, nombre, orden) values
  ('REPUESTO', 'CELULAR', 'Pantalla', 10),
  ('REPUESTO', 'CELULAR', 'Batería', 20),
  ('REPUESTO', 'CELULAR', 'Pin de carga', 30),
  ('REPUESTO', 'CELULAR', 'Parlante', 40),
  ('REPUESTO', 'CELULAR', 'Auricular', 50),
  ('REPUESTO', 'CELULAR', 'Micrófono', 60),
  ('REPUESTO', 'CELULAR', 'Cámara trasera', 70),
  ('REPUESTO', 'CELULAR', 'Cámara frontal', 80),
  ('REPUESTO', 'CELULAR', 'Tapa trasera', 90),
  ('REPUESTO', 'CELULAR', 'Botones', 100),
  ('REPUESTO', 'CELULAR', 'Flex', 110),
  ('REPUESTO', 'CELULAR', 'Lector de huella', 120),
  ('REPUESTO', 'CELULAR', 'Bandeja SIM', 130),
  ('REPUESTO', 'CELULAR', 'Vidrio de cámara', 140),
  ('REPUESTO', 'COMPUTADOR', 'Pantalla', 10),
  ('REPUESTO', 'COMPUTADOR', 'Batería', 20),
  ('REPUESTO', 'COMPUTADOR', 'Teclado', 30),
  ('REPUESTO', 'COMPUTADOR', 'Cargador', 40),
  ('REPUESTO', 'COMPUTADOR', 'Disco SSD', 50),
  ('REPUESTO', 'COMPUTADOR', 'Memoria RAM', 60),
  ('REPUESTO', 'COMPUTADOR', 'Ventilador', 70),
  ('REPUESTO', 'COMPUTADOR', 'Bisagras', 80),
  ('REPUESTO', 'COMPUTADOR', 'Pasta térmica', 90),
  ('REPUESTO', 'COMPUTADOR', 'Conector de carga', 100),
  ('REPUESTO', 'COMPUTADOR', 'Touchpad', 110),
  ('REPUESTO', 'COMPUTADOR', 'Fuente de poder', 120),
  ('REPUESTO', 'COMPUTADOR', 'Placa madre', 130),
  ('REPUESTO', 'COMPUTADOR', 'Pila de BIOS', 140),
  ('REPUESTO', 'COMPUTADOR', 'Tarjeta Wi-Fi', 150),
  ('REPUESTO', 'OTRO', 'Pantalla', 10),
  ('REPUESTO', 'OTRO', 'Táctil', 20),
  ('REPUESTO', 'OTRO', 'Batería', 30),
  ('REPUESTO', 'OTRO', 'Pin de carga', 40),
  ('REPUESTO', 'OTRO', 'Joystick', 50),
  ('REPUESTO', 'OTRO', 'Puerto HDMI', 60),
  ('REPUESTO', 'OTRO', 'Fuente', 70),
  ('REPUESTO', 'OTRO', 'Tiras LED', 80),
  -- De la mejor a la más económica (el dueño pidió que las ordenara Claude).
  ('CALIDAD_PANTALLA', null, 'Original', 10),
  ('CALIDAD_PANTALLA', null, 'Super AMOLED', 20),
  ('CALIDAD_PANTALLA', null, 'AMOLED', 30),
  ('CALIDAD_PANTALLA', null, 'OLED', 40),
  ('CALIDAD_PANTALLA', null, 'Incell', 50),
  ('CALIDAD_PANTALLA', null, 'LCD / TFT', 60),
  ('CALIDAD_PANTALLA', null, 'LED', 70)
on conflict do nothing;

-- ---------- 3. Trabajos del taller ----------
create table if not exists taller_trabajos (
  id               bigserial primary key,
  equipo_tipo      text not null check (equipo_tipo in ('CELULAR', 'COMPUTADOR', 'OTRO')),
  equipo_modelo    text not null check (length(btrim(equipo_modelo)) between 1 and 80),
  cliente          text null check (cliente is null or length(cliente) <= 80),
  nota             text null check (nota is null or length(nota) <= 300),
  -- De quién es el trabajo (quién se queda con la ganancia). Si es del papá,
  -- va_al_pozo = true y lo cobrado en la app suma a su pozo (sql/90).
  dueno_id         bigint not null references usuarios (id),
  va_al_pozo       boolean not null default false,
  viaje_monto      numeric not null default 0 check (viaje_monto >= 0),
  viaje_pagado_por bigint null references usuarios (id),
  desarmo_id       bigint null references usuarios (id),
  instalo_id       bigint null references usuarios (id),
  probo_id         bigint null references usuarios (id),
  estado           text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'COBRADO', 'ANULADO')),
  precio_acordado  numeric null check (precio_acordado is null or precio_acordado >= 0),
  cobrado_monto    numeric null check (cobrado_monto is null or cobrado_monto >= 0),
  cobrado_medio    text null check (cobrado_medio in ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA')),
  -- APP = se cobró y anotó aquí. CAJA_POS = se cobró en la caja del POS: la
  -- venta y el pozo los lleva la caja, y la app no lo vuelve a sumar.
  cobrado_donde    text null check (cobrado_donde in ('APP', 'CAJA_POS')),
  -- Quién se quedó con la plata del cliente.
  cobrado_recibio  bigint null references usuarios (id),
  cobrado_fecha    date null,
  cobrado_en       timestamptz null,
  cobrado_por      bigint null references usuarios (id),
  venta_numero     text null check (venta_numero is null or length(venta_numero) <= 20),
  anulado_motivo   text null check (anulado_motivo is null or length(anulado_motivo) <= 200),
  registrado_por   bigint not null references usuarios (id),
  actualizado_por  bigint null references usuarios (id),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint taller_trabajos_cobro_completo check (
    estado <> 'COBRADO'
    or (cobrado_monto is not null and cobrado_donde is not null and cobrado_recibio is not null and cobrado_fecha is not null)
  )
);
create index if not exists taller_trabajos_estado_idx on taller_trabajos (estado, id desc);
create index if not exists taller_trabajos_cobrado_idx on taller_trabajos (cobrado_fecha) where estado = 'COBRADO';
alter table taller_trabajos enable row level security;

-- Un trabajo puede llevar varios repuestos, cada uno con su origen y su costo.
create table if not exists taller_trabajo_repuestos (
  id         bigserial primary key,
  trabajo_id bigint not null references taller_trabajos (id) on delete cascade,
  nombre     text not null check (length(btrim(nombre)) between 1 and 60),
  calidad    text null check (calidad is null or length(calidad) <= 60),
  -- STOCK = lo teníamos. COMPRA = se fue a comprar.
  origen     text not null default 'COMPRA' check (origen in ('STOCK', 'COMPRA')),
  costo      numeric not null default 0 check (costo >= 0),
  lugar      text null check (lugar is null or length(lugar) <= 60),
  -- Quién puso la plata (en STOCK: de quién era el repuesto).
  pagado_por bigint null references usuarios (id)
);
create index if not exists taller_trabajo_repuestos_trabajo_idx on taller_trabajo_repuestos (trabajo_id);
alter table taller_trabajo_repuestos enable row level security;

-- Plata que una persona le devuelve a otra por las cuentas del taller.
create table if not exists taller_pagos (
  id             bigserial primary key,
  fecha          date not null,
  de_usuario     bigint not null references usuarios (id),
  a_usuario      bigint not null references usuarios (id),
  monto          numeric not null check (monto > 0),
  nota           text null check (nota is null or length(nota) <= 200),
  anulado        boolean not null default false,
  registrado_por bigint null references usuarios (id),
  creado_en      timestamptz not null default now(),
  constraint taller_pagos_distintos check (de_usuario <> a_usuario)
);
alter table taller_pagos enable row level security;

-- Quién hizo cada cambio en un trabajo ("recuerda anotar todo").
create table if not exists taller_historial (
  id             bigserial primary key,
  trabajo_id     bigint not null references taller_trabajos (id) on delete cascade,
  usuario_id     bigint null references usuarios (id),
  usuario_nombre text null,
  accion         text not null check (accion in ('CREADO', 'EDITADO', 'COBRADO', 'ANULADO')),
  detalle        jsonb null,
  creado_en      timestamptz not null default now()
);
create index if not exists taller_historial_trabajo_idx on taller_historial (trabajo_id, id);
alter table taller_historial enable row level security;

-- ---------- 4. El pozo lleva el nombre de él (dueño, 12-10-2026) ----------
-- "Pon esto como nombre de él en el POS también": C. Patricio.
update compra_clasificaciones
set nombre = 'Pozo de C. Patricio (servicios de celulares)',
    descripcion = 'Lo que se le entrega a C. Patricio por sus reparaciones'
where nombre = 'Pozo de mi papá (servicios de celulares)'
  and not exists (select 1 from compra_clasificaciones where nombre = 'Pozo de C. Patricio (servicios de celulares)');
update compras
set clasificacion = 'Pozo de C. Patricio (servicios de celulares)'
where clasificacion = 'Pozo de mi papá (servicios de celulares)';

-- ---------- Comprobación ----------
select 'usuarios' as tabla, count(*) as filas from usuarios
union all select 'taller_catalogo', count(*) from taller_catalogo
union all select 'taller_trabajos', count(*) from taller_trabajos
union all select 'clasificacion del pozo', count(*) from compra_clasificaciones where nombre like 'Pozo de C. Patricio%'
union all select 'tablas nuevas sin RLS', count(*) from pg_tables
  where schemaname = 'public' and rowsecurity = false
    and tablename in ('usuarios', 'taller_catalogo', 'taller_trabajos', 'taller_trabajo_repuestos', 'taller_pagos', 'taller_historial');
