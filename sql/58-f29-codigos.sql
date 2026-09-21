-- ============================================================
-- 58 · Los códigos del F29 dentro del POS (21-09-2026)
-- ------------------------------------------------------------
-- Hasta ahora `f29_presentaciones` solo guardaba "este período lo
-- presenté y pagué $X": servía para apagar el recordatorio del header y
-- nada más. Para saber cómo se está consumiendo el remanente, o si la
-- venta declarada se parece a la del POS, había que abrir el PDF del
-- Formulario Compacto de cada mes a mano.
--
-- Esta migración guarda los códigos que trae ese PDF, que son los mismos
-- todos los meses. El dueño los copia al marcar el F29 (2 minutos), y a
-- partir del segundo mes el cowork de finanzas puede comparar períodos
-- leyendo la base, sin que nadie le pase un archivo.
--
-- TODAS LAS COLUMNAS SON NULL A PROPÓSITO. Un período viejo marcado
-- antes de hoy no tiene estos datos, y 0 no es lo mismo que "no anotado":
-- un débito 0 dice "no vendí", y eso sería inventar un dato. Misma regla
-- que `envios.cobrado_cliente` (sql/54).
--
-- El código 77 (remanente que pasa al mes siguiente) NO se agrega acá:
-- ya vive en `iva_remanentes` (sql/51) porque se conoce desde la
-- propuesta, antes de presentar. La vista de abajo los junta.
-- ============================================================

alter table f29_presentaciones
  add column if not exists folio                  text    null,
  add column if not exists fecha_presentacion     date    null,
  add column if not exists base_imponible         numeric null check (base_imponible         >= 0),
  add column if not exists debito_total           numeric null check (debito_total           >= 0),
  add column if not exists credito_total          numeric null check (credito_total          >= 0),
  add column if not exists iva_determinado        numeric null check (iva_determinado        >= 0),
  add column if not exists ppm_pagado             numeric null check (ppm_pagado             >= 0),
  add column if not exists remanente_anterior     numeric null check (remanente_anterior     >= 0),
  add column if not exists cant_boletas           integer null check (cant_boletas           >= 0),
  add column if not exists cant_facturas_recibidas integer null check (cant_facturas_recibidas >= 0);

comment on column f29_presentaciones.folio               is 'Folio de la declaración en el SII (ej: 9317313976). Sirve para buscarla de nuevo.';
comment on column f29_presentaciones.fecha_presentacion  is 'Fecha en que el SII la recibió. Distinta de presentado_en, que es cuándo se marcó en el POS.';
comment on column f29_presentaciones.base_imponible      is 'Código 563: ventas netas declaradas del período.';
comment on column f29_presentaciones.debito_total        is 'Código 538: IVA de las ventas.';
comment on column f29_presentaciones.credito_total       is 'Código 537: IVA de las compras + remanente arrastrado.';
comment on column f29_presentaciones.iva_determinado     is 'Código 089: IVA a pagar. 0 cuando el crédito alcanzó.';
comment on column f29_presentaciones.ppm_pagado          is 'Código 062: PPM del mes (tasa 0,125% Pro Pyme sobre el 563).';
comment on column f29_presentaciones.remanente_anterior  is 'Código 504: remanente que venía del mes anterior. Con el 77 se ve si se está consumiendo.';
comment on column f29_presentaciones.cant_boletas        is 'Código 110: cuántas boletas recibió el SII. Comparado con el POS delata la brecha SIN DTE.';
comment on column f29_presentaciones.cant_facturas_recibidas is 'Código 519: facturas de compra del giro usadas como crédito.';

-- ------------------------------------------------------------
-- Vista para leer el historial de una sola vez: junta la declaración con
-- el código 77 de `iva_remanentes` y deja calculada la variación del
-- remanente, que es la pregunta real ("¿cuánto me queda y hasta cuándo?").
--
-- `variacion_remanente` negativo = el remanente se está consumiendo.
-- Se calcula al leer, nunca se guarda: si mañana se corrige el 77 de un
-- mes, la vista lo refleja sola (misma regla que la vigencia de las
-- cotizaciones).
-- ------------------------------------------------------------
create or replace view v_f29_historial as
select
  f.periodo,
  f.folio,
  f.fecha_presentacion,
  f.presentado_en,
  f.monto_pagado,
  f.base_imponible,
  -- La venta declarada CON IVA, que es como se ve en el POS
  case when f.base_imponible is null then null
       else round(f.base_imponible * 1.19) end          as venta_declarada_bruta,
  f.debito_total,
  f.credito_total,
  f.iva_determinado,
  f.ppm_pagado,
  f.remanente_anterior,
  r.monto                                               as remanente_siguiente,
  case when f.remanente_anterior is null or r.monto is null then null
       else r.monto - f.remanente_anterior end          as variacion_remanente,
  f.cant_boletas,
  f.cant_facturas_recibidas,
  f.notas
from f29_presentaciones f
left join iva_remanentes r on r.periodo = f.periodo;

comment on view v_f29_historial is
  'Historial del F29 mes a mes (declaración + código 77 + variación del remanente). La lee el backend del POS y el cowork de finanzas.';

-- Una vista NO hereda la RLS de la tabla: sin esto quedaría legible por
-- anon. El acceso es solo del backend (service_role), igual que todo lo
-- demás. Ya pasó dos veces olvidar esto en una tabla nueva.
revoke all on v_f29_historial from anon, authenticated;
