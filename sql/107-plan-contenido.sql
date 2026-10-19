-- 107 · Plan de contenido y robot de contenido (dueño, 19-10-2026)
-- ===============================================================
-- POR QUÉ: "una notificación para saber cuándo dejar encendido el PC, y calendario de cómo vamos
-- con el contenido… con fases… para revisar y aprobar desde el teléfono… que alguien se informe y
-- recolecte esas imágenes… y que después se eliminen para no guardar cosas de sobra".
--
--   contenido_plan   cada pieza del calendario, con su fase:
--                    idea → preparando → para_aprobar → aprobado → programado → publicado
--                    (o descartado). La crea el robot (tarea programada de Claude en el PC de la
--                    tienda, docs/contenido/ROBOT-CONTENIDO.md) o el dueño ("➕ Pedir").
--   contenido_robot  una sola fila: cuándo corre el robot, qué hizo la última vez, el aviso para el
--                    encabezado del POS y el uso de Claude que anotó.
--   bucket contenido-temporal  las imágenes y videos para aprobar. Público (son piezas para
--                    publicar). Se borran solos 3 días después de publicadas o descartadas
--                    (cron diario /api/cron/mas-vendidos).
--
-- Idempotente. RLS encendida sin políticas: solo el backend (service_role) y la CLI.

create table if not exists contenido_plan (
  id bigserial primary key,
  fecha date not null,
  formato text not null check (formato in ('historia', 'post', 'carrusel', 'reel', 'wow')),
  tipo text not null check (tipo in ('producto', 'servicio', 'educativo', 'noticia', 'tienda')),
  tema text not null check (length(tema) between 2 and 160),
  producto_id bigint references productos(id) on delete set null,
  estado text not null default 'idea'
    check (estado in ('idea', 'preparando', 'para_aprobar', 'aprobado', 'programado', 'publicado', 'descartado')),
  texto text check (texto is null or length(texto) <= 2200),
  fuentes jsonb not null default '[]'::jsonb,          -- [{titulo, url}] de la noticia o del dato
  archivos jsonb not null default '[]'::jsonb,         -- [{ruta, url, tipo}] en contenido-temporal
  nota_dueno text check (nota_dueno is null or length(nota_dueno) <= 500),
  pedido_por text not null default 'robot' check (pedido_por in ('robot', 'dueno')),
  aprobado_en timestamptz,
  publicado_en timestamptz,
  archivos_borrados_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists contenido_plan_fecha_idx on contenido_plan (fecha);
create index if not exists contenido_plan_estado_idx on contenido_plan (estado);

create table if not exists contenido_robot (
  id integer primary key default 1 check (id = 1),
  proxima_corrida timestamptz,
  ventana_texto text,                                  -- "Miércoles 22, de 10:00 a 13:00"
  ultima_corrida timestamptz,
  ultimo_resumen text,
  uso_claude text,
  actualizado_en timestamptz not null default now()
);
insert into contenido_robot (id) values (1) on conflict (id) do nothing;

alter table contenido_plan enable row level security;
alter table contenido_robot enable row level security;

insert into storage.buckets (id, name, public)
values ('contenido-temporal', 'contenido-temporal', true)
on conflict (id) do nothing;

select (select count(*) from contenido_plan) as piezas,
       (select count(*) from storage.buckets where id = 'contenido-temporal') as bucket;
