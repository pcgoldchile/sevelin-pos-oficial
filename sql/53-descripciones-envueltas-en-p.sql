-- 53 — Descripciones que quedaron con Markdown crudo a la vista en sevelin.cl
-- ---------------------------------------------------------------------------
-- EL PROBLEMA
-- La tienda (sevelin-tienda, src/lib/sanitizar-html.ts) decide así:
--   · la descripción trae HTML  → se respeta tal cual, no se toca;
--   · la descripción es texto plano → se estructura con
--     formatearDescripcionPlana() (títulos "### ...", viñetas "✅ ...",
--     negritas "**...**").
-- Estas 13 fichas quedaron guardadas como UN SOLO <p> envolviendo todo el
-- Markdown crudo: <p>✨ intro\n\n### Ventajas\n\n✅ **Metal líquido:** ...</p>
-- La tienda ve ese <p>, concluye "esto ya es HTML del editor" y lo imprime
-- literal — por eso el cliente veía "###" y "**" en pantalla.
-- Verificado en vivo el 16-09-2026 en
-- /productos/mantenimiento-de-ps5-limpieza-metal-liquido-y-thermal-pads-utt1b
--
-- EL ARREGLO
-- Quitar SOLO el <p> de apertura y el </p> de cierre. No se toca ni una
-- palabra del texto. Al quedar como texto plano, la tienda vuelve a armar
-- <h3>, <ul>/<li> y <strong> igual que en las 45 fichas que ya se ven bien
-- (comprobado contra el formateador real de la tienda antes de escribir esto).
--
-- POR QUÉ UN UPDATE POR PRODUCTO Y NO UNO SOLO
-- productos tiene el disparador trg_sync_tienda (FOR EACH ROW) que encola un
-- net.http_post por fila hacia la tienda. En la sesión v61 actualizar varios
-- productos en UNA sentencia perdió 2 de 4 sincronizaciones. De a uno, y
-- después se comparan las fichas reales en sevelin.cl.
--
-- IDEMPOTENTE: el WHERE exige que la descripción TODAVÍA esté envuelta en
-- <p>...</p>, así que correr el archivo dos veces no hace nada la segunda vez.


-- Servicios técnicos (10)
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 265 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 266 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 267 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 268 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 269 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 270 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 273 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 275 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 276 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 278 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';

-- Productos físicos (3)
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 160 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 196 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
update productos set descripcion_web = btrim(regexp_replace(btrim(descripcion_web), '^<p>([\s\S]*)</p>$', '\1')) where id = 230 and btrim(descripcion_web) ~ '^<p>' and btrim(descripcion_web) ~ '</p>$';
