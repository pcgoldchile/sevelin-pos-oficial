-- 113 — Calendario compartido de Sevelin Tecnología y Sevelin Automotriz (27-10-2026)
-- Pedido del dueño: ver metas, reuniones, capacitaciones y recordatorios en el POS
-- (ventana "Metas de hoy") y en la app del taller (/taller/, pestaña "Metas").
-- Lo escribe el admin desde el POS; la app del taller solo lo lee. Idempotente.

create table if not exists calendario_eventos (
  id bigserial primary key,
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  titulo text not null check (length(btrim(titulo)) between 3 and 140),
  detalle text check (detalle is null or length(detalle) <= 1000),
  negocio text not null default 'TECNOLOGIA' check (negocio in ('TECNOLOGIA', 'AUTOMOTRIZ', 'PERSONAL')),
  lugar text check (lugar is null or length(lugar) <= 120),
  visible_taller boolean not null default true,
  creado_en timestamptz not null default now()
);

create index if not exists calendario_eventos_fecha_idx on calendario_eventos (fecha);

-- El acceso es solo desde el backend con service_role; RLS cerrado al resto.
alter table calendario_eventos enable row level security;

comment on table calendario_eventos is
  'Calendario de Sevelin Tecnología y Automotriz. PERSONAL nunca se muestra en la app del taller.';
