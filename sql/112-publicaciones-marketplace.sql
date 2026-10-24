-- 112 · Registro de marketplaces: qué producto está publicado en qué canal (dueño, 24-10-2026)
-- ===================================================================
-- "Lleva un registro en el POS de marketplaces, de cuáles productos llevo
-- registrados o subidos" y "protégeme de las comisiones".
--
-- Una fila por publicación: el producto, el canal (Mercado Libre, Facebook
-- Marketplace, …), su estado, el link, y lo que cobra ESE canal: el precio
-- que se publicó, la comisión y el envío que paga el vendedor. Con eso el POS
-- muestra cuánto queda de verdad en cada canal (precio − comisión − envío −
-- costo) y avisa si una publicación deja poco.
--
-- Facebook sigue usando productos.facebook_url (v136); el panel lo muestra
-- junto, sin duplicarlo. Idempotente. RLS activado: solo el backend
-- (service_role) lee y escribe.

create table if not exists publicaciones_canal (
  id            bigserial primary key,
  producto_id   bigint not null references productos(id) on delete cascade,
  canal         text not null,
  estado        text not null default 'publicado',
  url           text,
  externo_id    text,
  precio_canal  numeric,
  comision      numeric,
  envio         numeric,
  stock_canal   integer,
  notas         text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_canal_canal_ok') then
    alter table publicaciones_canal add constraint publicaciones_canal_canal_ok
      check (canal in ('MERCADOLIBRE','FACEBOOK','INSTAGRAM','TIKTOK','RIPLEY','FALABELLA','PARIS','OTRO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_canal_estado_ok') then
    alter table publicaciones_canal add constraint publicaciones_canal_estado_ok
      check (estado in ('borrador','en_revision','publicado','pausado','agotado','eliminado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_canal_montos_ok') then
    alter table publicaciones_canal add constraint publicaciones_canal_montos_ok
      check ((precio_canal is null or precio_canal >= 0) and (comision is null or comision >= 0)
         and (envio is null or envio >= 0) and (stock_canal is null or stock_canal >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_canal_textos_ok') then
    alter table publicaciones_canal add constraint publicaciones_canal_textos_ok
      check ((url is null or char_length(url) <= 500) and (externo_id is null or char_length(externo_id) <= 60)
         and (notas is null or char_length(notas) <= 500));
  end if;
end $$;

create index if not exists publicaciones_canal_producto_idx on publicaciones_canal (producto_id);
create unique index if not exists publicaciones_canal_externo_uq on publicaciones_canal (canal, externo_id) where externo_id is not null;

alter table publicaciones_canal enable row level security;

comment on table publicaciones_canal is 'Registro de publicaciones en marketplaces por producto, con lo que cobra cada canal. v181, sql/112.';

-- La primera: el monitor HP V214a publicado en Mercado Libre el 24-10-2026
-- (costos medidos en el borrador: Clásica $6.379, envío $5.800 con el 50% que cubre ML)
insert into publicaciones_canal (producto_id, canal, estado, url, externo_id, precio_canal, comision, envio, stock_canal, notas)
select 132, 'MERCADOLIBRE', 'publicado', 'https://articulo.mercadolibre.cl/MLC-2369078865', 'MLC2369078865', 57990, 6379, 5800, 2,
       'Clásica, 6 cuotas. Sincronizada con la de catálogo MLC2369065957. Garantía 3 meses. Retiro en persona.'
where exists (select 1 from productos where id = 132)
  and not exists (select 1 from publicaciones_canal where canal = 'MERCADOLIBRE' and externo_id = 'MLC2369078865');
