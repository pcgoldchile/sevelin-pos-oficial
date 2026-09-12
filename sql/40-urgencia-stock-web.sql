-- 40 · Aviso de "última unidad" en la tienda web
-- =============================================
-- POR QUÉ
-- Cuando queda poco stock de algo, decirlo vende: el cliente que estaba
-- "pensándolo" decide. Pero eso solo funciona si es VERDAD — un cartel de
-- "última unidad" en un producto que en realidad tiene diez es publicidad
-- engañosa, y además el cliente lo nota y deja de creerle a todos los
-- demás.
--
-- Por eso el aviso no se escribe a mano: lo arma la tienda con el stock
-- real (`stock_web`), y esta columna es solo el INTERRUPTOR de en qué
-- productos se permite mostrarlo. Sirve para apagarlo donde el stock no es
-- confiable, donde el producto se repone todos los días, o donde el dueño
-- simplemente no quiere apurar a nadie.
--
-- Nace en `true` a propósito: el aviso es útil en la mayoría del catálogo y
-- arrancar en `false` obligaría a encender 116 productos a mano para que
-- sirviera de algo. Apagar las excepciones es mucho menos trabajo.
--
-- Se sincroniza a productos_web por el Database Webhook de siempre (ver
-- sevelin-tienda/src/app/api/sync/producto/route.ts) — no hay que tocar
-- nada más en el pipeline, solo agregarlo al payload.
--
-- Idempotente.

alter table productos
  add column if not exists urgencia_stock_web boolean not null default true;

comment on column productos.urgencia_stock_web is
  'Permite que la tienda muestre el aviso de pocas unidades en este producto. El texto y el número los calcula la tienda con stock_web real; esto solo habilita o silencia. Apagarlo donde el stock no sea confiable.';
