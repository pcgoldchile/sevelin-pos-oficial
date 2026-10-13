-- 95 · Texto de Instagram por producto
-- ===============================================================
-- POR QUÉ (dueño, 13-10-2026): quiere guardar en cada producto, desde crear o
-- editar, tanto la descripción para Facebook (sql/93) como la de Instagram.
-- Regla suya: "debe existir la descripción, si no, no se debe generar nada
-- inventado". Los dos textos se arman ordenando lo que ya dice la Descripción
-- del producto (js/redes-texto.js), sin IA.
--
--   instagram_texto   el pie de foto listo para pegar. Instagram acepta hasta
--                     2.200 letras.
--
-- Idempotente. No cambia ninguna fila.

alter table productos add column if not exists instagram_texto text null;

alter table productos drop constraint if exists productos_instagram_texto_largo;
alter table productos add constraint productos_instagram_texto_largo
  check (instagram_texto is null or length(instagram_texto) <= 2200);

select count(*) as productos, count(facebook_texto) as con_texto_facebook, count(instagram_texto) as con_texto_instagram
from productos;
