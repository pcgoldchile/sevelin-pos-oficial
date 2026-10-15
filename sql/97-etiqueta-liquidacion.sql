-- 97 · Etiqueta "Liquidación" (dueño, 15-10-2026)
-- ===============================================================
-- POR QUÉ: quiere liquidar productos antiguos o fuera de temporada (ej. la
-- funda Njoy Tech #368 de sus padres, a $1.990). Un producto tiene UNA sola
-- categoría (la tienda lee categoria_web), así que "Liquidación" como categoría
-- lo sacaría de la suya. Es una etiqueta más: sigue en su categoría, lleva el
-- sello en la tienda y sevelin.cl/liquidacion los junta.
--
-- Va DESPUÉS de sevelin-tienda/supabase/43 (si no, la sincronización a la
-- tienda rebota por el check de allá). Idempotente.

alter table productos drop constraint if exists productos_etiqueta_web_check;
alter table productos add constraint productos_etiqueta_web_check
  check (etiqueta_web is null or etiqueta_web in ('NOVEDAD', 'TENDENCIA', 'OFERTA', 'LIQUIDACION'));

select etiqueta_web, count(*) from productos group by 1 order by 1;
