-- 83 · Interruptor de la oferta web (v116, 03-10-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 03-10-2026)
-- "Necesito un botón en el POS para activar las ofertas ... prefiero activar
-- o desactivarlas yo desde el POS."
--
-- Hasta acá la oferta web (sql/71) solo se apagaba borrando el precio de
-- oferta o moviendo la fecha de fin: apagarla un rato significaba perder lo
-- cargado.
--
-- LA REGLA
--   · oferta_pausada = true: la oferta queda guardada (precio y fechas) pero
--     la tienda NO la muestra ni la cobra. La tienda la recibe como "sin
--     oferta" (ver ofertaDesdePos en src/app/api/sync/producto/route.ts del
--     otro repo), así el checkout, el feed y la franja no necesitan saber
--     que existe una pausa.
--   · Encendida (false, el valor por defecto) sigue mandando la fecha: la
--     oferta empieza y termina sola igual que antes (decisión del dueño,
--     opción B: se respeta la fecha de término de la ficha).
--   · Las ofertas ya cargadas quedan encendidas: nada cambia al aplicar esto.
--
-- Viaja a la tienda con el trigger trg_sync_tienda (sql/22), que manda la
-- fila completa. No crea tablas. Idempotente.

alter table productos add column if not exists oferta_pausada boolean not null default false;

comment on column productos.oferta_pausada is
  'true = la oferta web está cargada pero apagada desde el chip "Ofertas" del POS: la tienda no la muestra ni la cobra.';
