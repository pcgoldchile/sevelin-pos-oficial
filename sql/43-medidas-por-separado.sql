-- 43 · Las medidas se guardan aparte, y con firma
-- ===============================================
-- EL PROBLEMA (detectado por el dueño el 12-09-2026)
-- El formulario del producto manda SIEMPRE peso y medidas, aunque nadie
-- las haya tocado. Como sanearProducto() marcaba medidas_actualizado_en
-- apenas cualquiera de los cuatro campos venía en el guardado, corregir un
-- precio o una descripción "actualizaba" también las medidas. El timestamp
-- terminaba diciendo que alguien midió el producto un día en que solo se
-- editó el nombre — o sea, no servía para lo único que existía.
--
-- Y hay un costo real detrás: el peso y el volumen deciden cuánto cuesta
-- un despacho. Una medida mal puesta se paga en cada envío, y sin saber
-- quién la puso ni cuándo, no hay forma de auditarla.
--
-- QUÉ CAMBIA
-- Las medidas dejan de viajar en el guardado normal del producto y pasan a
-- tener su propia ruta (PUT /api/productos/:id/medidas), que EXIGE el
-- nombre de quien las midió. Así el registro responde las tres preguntas
-- que importan: qué se midió, cuándo y quién.
--
-- Se pide el nombre escrito y no el usuario de la sesión a propósito: en
-- el mostrador varias personas usan la misma cuenta de administrador, así
-- que el usuario logueado no dice quién tomó la huincha.
--
-- Idempotente.

alter table productos
  add column if not exists medidas_actualizado_por text;

comment on column productos.medidas_actualizado_por is
  'Nombre de quien midió el producto, escrito a mano al guardar las medidas. No es el usuario de la sesión: en el mostrador varias personas comparten la cuenta de admin.';

comment on column productos.medidas_actualizado_en is
  'Fecha y hora de la última medición real, registrada solo por PUT /api/productos/:id/medidas. Ya NO se toca al guardar el producto: antes cualquier edición la marcaba y el dato no servía.';
