-- 72 · Pendientes: la lista de cosas por hacer del dueño y de Claude
-- ===================================================================
-- POR QUÉ (dueño, 30-09-2026): "necesito una interfaz o revisar algún lugar
-- donde se pueda ir marcando checklist o tú mismo los marques, para ver qué
-- está pendiente y qué cosas ya fueron chequeadas y hechas ... siempre digo
-- postergo, postergo, deja pendiente eso".
--
-- Hasta ahora los pendientes vivían en la memoria de Claude y en
-- docs/SNAPSHOT.md: el dueño no los veía salvo que preguntara. Esta tabla es
-- la fuente única: el POS la muestra (chip "Pendientes" del encabezado) y
-- Claude la lee al empezar cada sesión y la actualiza al cerrarla.
--
-- estado:
--   pendiente   → hay que hacerlo.
--   postergado  → el dueño dijo "déjalo pendiente". Vuelve a molestar el día
--                 `revisar_el`; `veces_postergado` cuenta cuántas veces se
--                 pateó (a propósito: que se vea).
--   hecho       → terminado. `hecho_por` dice quién lo marcó y `nota_cierre`
--                 cómo se verificó.
--   descartado  → ya no se hace (nunca se borra: queda el historial).
--
-- Idempotente.

create table if not exists pendientes (
  id bigserial primary key,
  titulo text not null check (length(btrim(titulo)) between 3 and 200),
  detalle text check (detalle is null or length(detalle) <= 2000),
  responsable text not null default 'dueno' check (responsable in ('dueno', 'claude')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'postergado', 'hecho', 'descartado')),
  prioridad text not null default 'normal' check (prioridad in ('alta', 'normal')),
  fecha_limite date,
  revisar_el date,
  veces_postergado integer not null default 0 check (veces_postergado >= 0),
  categoria text check (categoria is null or length(categoria) <= 40),
  creado_por text not null default 'dueno' check (creado_por in ('dueno', 'claude')),
  hecho_por text check (hecho_por is null or hecho_por in ('dueno', 'claude')),
  nota_cierre text check (nota_cierre is null or length(nota_cierre) <= 1000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cerrado_en timestamptz
);

create index if not exists pendientes_abiertos_idx
  on pendientes (estado, fecha_limite) where estado in ('pendiente', 'postergado');

-- Sin políticas: solo la service_role del servidor la toca.
alter table pendientes enable row level security;
