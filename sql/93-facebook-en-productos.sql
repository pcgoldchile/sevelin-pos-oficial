-- 93 · Publicación de Facebook por producto
-- ===============================================================
-- POR QUÉ (dueño, 11 y 13-10-2026): vende sobre todo por Facebook Marketplace
-- y quiere, desde la lista de productos y sin abrir cada ficha: bajar las
-- fotos, ordenar con IA el texto que él escribe, copiarlo, y ver cuáles ya
-- publicó. "Debe estar sí o sí el link de Facebook para que salga ya publicado."
--
--   facebook_texto         el texto listo para pegar (lo ordena la IA a partir
--                          de lo que escribe el dueño; nunca se genera solo)
--   facebook_url           link de la publicación. Con link = publicado.
--   facebook_publicado_en  cuándo se anotó ese link
--
-- Idempotente. No cambia ninguna fila.

alter table productos add column if not exists facebook_texto text null;
alter table productos add column if not exists facebook_url text null;
alter table productos add column if not exists facebook_publicado_en timestamptz null;

alter table productos drop constraint if exists productos_facebook_texto_largo;
alter table productos add constraint productos_facebook_texto_largo
  check (facebook_texto is null or length(facebook_texto) <= 8000);

alter table productos drop constraint if exists productos_facebook_url_valida;
alter table productos add constraint productos_facebook_url_valida
  check (facebook_url is null or (facebook_url ~ '^https://' and length(facebook_url) <= 500));

-- Publicado y link van juntos: no hay "publicado" sin link.
alter table productos drop constraint if exists productos_facebook_publicado_con_link;
alter table productos add constraint productos_facebook_publicado_con_link
  check ((facebook_url is null) = (facebook_publicado_en is null));

select count(*) as productos, count(facebook_url) as publicados_en_facebook, count(facebook_texto) as con_texto
from productos;
