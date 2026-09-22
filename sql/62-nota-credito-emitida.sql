-- ============================================================
-- 62 · Marcar la Nota de Crédito ya emitida (22-09-2026)
-- ------------------------------------------------------------
-- La v81 dejó el aviso "esta devolución necesita Nota de Crédito" y el
-- filtro `solo_nota_credito=true`. Pero sin forma de decir "ya la emití",
-- esa lista NUNCA se vacía: al tercer mes tendría 20 devoluciones viejas
-- mezcladas con la que sí falta, y dejaría de servir para revisar el F29.
--
-- Una lista que no se puede cerrar se ignora, y una lista ignorada es peor
-- que no tenerla: da la sensación de estar controlado sin estarlo.
--
-- POR QUÉ SE GUARDA EL FOLIO
--   Es el único dato que permite cruzar la devolución del POS con el
--   documento real del SII cuando algo no cuadre en el F29. Es opcional:
--   obligarlo haría que el dueño no marque nada para no buscar el número.
-- ============================================================

alter table devoluciones add column if not exists nota_credito_emitida_en timestamptz null;
alter table devoluciones add column if not exists nota_credito_folio text null;

comment on column devoluciones.nota_credito_emitida_en is
  'Cuándo el dueño marcó que ya emitió la Nota de Crédito en el SII. NULL = todavía pendiente. El POS nunca entra al SII: esto lo marca él a mano.';

comment on column devoluciones.nota_credito_folio is
  'Folio de la Nota de Crédito, opcional. Sirve para cruzar con el SII cuando el F29 no cuadre.';

-- Índice parcial para el aviso: solo las que FALTAN.
create index if not exists idx_devoluciones_nc_pendiente
  on devoluciones (fecha)
  where requiere_nota_credito and nota_credito_emitida_en is null;


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- select column_name from information_schema.columns
--  where table_name = 'devoluciones' and column_name like 'nota_credito%';
--
-- Y que la tabla siga sin políticas públicas (debe devolver 0 filas):
-- select policyname from pg_policies where tablename = 'devoluciones';
