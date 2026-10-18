-- 103 · Características del producto para los filtros de sevelin.cl (dueño, 18-10-2026)
-- ===============================================================
-- POR QUÉ: el dueño pidió filtros con casillas en la tienda ("si incluye HDMI, VGA,
-- parlantes…"). Sacarlos leyendo el texto de la ficha salió mal en la prueba: el
-- Caixun 24" aparecía sin HDMI (la ficha no lo nombraba) y el Samsung 22" con HDMI
-- (la ficha decía que NO trae). Por eso se guardan marcadas, una por una.
--
--   caracteristicas   { "<grupo>": ["<valor>", …] }  — ej. {"entradas": ["HDMI", "VGA"]}.
--                     Los grupos y valores posibles por categoría están en
--                     CARACTERISTICAS_TIENDA (api/index.js); el servidor descarta lo
--                     que no esté ahí. Se marcan en la ficha (cuadro "Filtros de la
--                     tienda") a mano o con "✨ Rellenar con IA", que lee la descripción.
--
-- Viaja a la tienda solo: el trigger trg_sync_tienda (sql/22) manda la fila completa
-- y /api/sync/producto lo copia a productos_web.caracteristicas (sevelin-tienda,
-- supabase/44). Junto con él viaja ahora también `condicion` (filtro "Estado").
--
-- Idempotente.

alter table productos add column if not exists caracteristicas jsonb not null default '{}'::jsonb;

alter table productos drop constraint if exists productos_caracteristicas_objeto;
alter table productos add constraint productos_caracteristicas_objeto
  check (jsonb_typeof(caracteristicas) = 'object' and pg_column_size(caracteristicas) <= 4000);

select count(*) as productos, count(*) filter (where caracteristicas <> '{}'::jsonb) as con_caracteristicas
from productos;
