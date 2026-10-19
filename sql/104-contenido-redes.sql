-- 104 · Registro del contenido para redes (dueño, 19-10-2026)
-- ===============================================================
-- POR QUÉ: el dueño pidió "crear contenido a partir de un producto con un botón… en un
-- módulo de redes sociales en el POS… y que haya un registro de qué se ha promocionado
-- últimamente, en los últimos días o en el mes, para saber qué tanto estoy repitiendo".
--
-- Cada pieza que se arma en Redes sociales (js/redes-contenido.js) deja una fila:
--   formato     historia | post | carrusel | reel
--   estilo      dinamico | minimalista | precio | beneficios | confianza
--   gancho      la frase grande que llevó (para no repetirla)
--   estado      generado (se descargó) → publicado (él marca dónde y cuándo)
--   redes       en qué red se publicó: {instagram, facebook}
-- Las piezas se arman en el navegador con los datos del producto: aquí solo queda
-- el registro, no la imagen.
--
-- Idempotente. RLS encendida sin políticas: solo el backend (service_role) la usa.

create table if not exists contenido_redes (
  id bigserial primary key,
  producto_id bigint references productos(id) on delete set null,
  producto_nombre text not null,
  formato text not null check (formato in ('historia', 'post', 'carrusel', 'reel')),
  estilo text not null check (estilo in ('dinamico', 'minimalista', 'precio', 'beneficios', 'confianza')),
  gancho text check (gancho is null or length(gancho) <= 120),
  estado text not null default 'generado' check (estado in ('generado', 'publicado')),
  redes text[] not null default '{}' check (redes <@ array['instagram', 'facebook']::text[]),
  publicado_en date,
  nota text check (nota is null or length(nota) <= 300),
  creado_por text,
  creado_en timestamptz not null default now()
);

create index if not exists contenido_redes_producto_idx on contenido_redes (producto_id, creado_en desc);
create index if not exists contenido_redes_fecha_idx on contenido_redes (creado_en desc);

alter table contenido_redes enable row level security;

select count(*) as filas from contenido_redes;
