-- ============================================================
-- 65 · La factura que el proveedor todavía no manda (24-09-2026, pedido del dueño)
-- ------------------------------------------------------------
-- "Poner una opción para que salga en alguna notificación si la factura aún
--  no está disponible o aún no llega, para estar alerta y meterle presión al
--  proveedor."
--
-- POR QUÉ UNA MARCA EXPLÍCITA Y NO "referencia IS NULL"
--   Hoy las 8 entradas de mercadería registradas tienen `referencia` vacía.
--   Si "sin número de factura" disparara el aviso solo, el POS estaría
--   gritando por las 8 desde el primer día, incluidas las compras donde ni
--   siquiera pidió factura (una compra a un particular, un repuesto suelto).
--   Un aviso que suena siempre se aprende a ignorar en una semana.
--
--   La marca es él diciendo "esta sí la estoy esperando". Mismo criterio que
--   `devolucion_hasta` en ese formulario: dejarla vacía significa "no aplica",
--   que es distinto de "se venció".
--
-- SE APAGA SOLA
--   Al escribir el N° de factura, la marca se apaga: no se puede estar
--   esperando un número que ya está escrito. No hay que acordarse de
--   desmarcar nada.
--
-- POR QUÉ IMPORTA MÁS QUE EL ORDEN
--   La factura es CRÉDITO FISCAL IVA. Sin el documento no hay crédito, y el
--   dueño está en Pro Pyme 14D con remanente. Una factura que nunca llegó es
--   plata que se paga de más en el F29, no solo un papel que falta.
--
--   OJO, no es automático: este formulario NO crea el gasto en `compras`
--   (0 de 8 entradas tienen `compra_id`). El gasto y su IVA se registran
--   aparte en Finanzas → Gastos. El aviso sirve para perseguir el documento;
--   cargarlo al F29 sigue siendo un paso suyo.
-- ============================================================

alter table ingresos_mercaderia
  add column if not exists factura_pendiente   boolean not null default false,
  add column if not exists factura_esperada_para date    null;

-- La consulta del aviso del header: solo las que están esperando.
create index if not exists idx_ingresos_factura_pendiente
  on ingresos_mercaderia (fecha_compra)
  where factura_pendiente = true;

comment on column ingresos_mercaderia.factura_pendiente is
  'El dueño marcó que espera la factura de esta compra. Se apaga solo al escribir la referencia.';

comment on column ingresos_mercaderia.factura_esperada_para is
  'Fecha que el proveedor prometió, si la dio. Opcional: sin fecha el aviso igual cuenta los días esperando.';


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- select count(*) from information_schema.columns
--   where table_name='ingresos_mercaderia' and column_name like 'factura%';   -- 2
-- RLS: ingresos_mercaderia ya la tiene habilitada desde sql/56, no se toca.
