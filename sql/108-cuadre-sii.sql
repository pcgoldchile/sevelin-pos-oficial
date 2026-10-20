-- 108 · Cuadrar con el SII (dueño, 20-10-2026)
-- ===============================================================
-- POR QUÉ: al cruzar el RCV de ventas de septiembre con el POS, ninguna venta tenía el N° de
-- boleta y 16 boletas ($955.000, entre ellas una RTX 5060 de $440.000) no estaban en el POS.
-- Pidió: "que cuadrar con el SII me permita registrar las compras y ventas, y queden como
-- pendientes… para yo rellenarlas, y que me salgan en notis… para llevar un registro completo".
--
-- Cada documento del RCV (sii_rcv_documentos, sql/51: las facturas de compra las baja el robot
-- todos los días; las boletas de venta se suben con el CSV o las baja el robot si el SII lo
-- permite) queda con su estado de cuadre:
--   pendiente  → todavía no se sabe a qué venta o gasto corresponde (sale en el aviso)
--   asociado   → ligado a una venta (venta_id) o a un gasto (compra_id)
--   ignorado   → no corresponde (ej. boleta anulada, compra personal), con su nota
--   comision   → factura de la máquina de pago (TUU/Haulmer, Banchile, Khipu…): su comisión ya
--                se descuenta venta por venta (comision_pos), no se carga como gasto
-- Solo se asocia solo lo que el dueño ya anotó (el N° de boleta en la venta) y las comisiones;
-- lo que calza por monto y fecha se PROPONE y el dueño lo confirma con un clic.
-- Un gasto puede juntar varias facturas (ej. 3 facturas del mismo proveedor y día = 1 gasto):
-- por eso compra_id no es único. Una boleta, en cambio, es de una sola venta.
--
-- Idempotente.

alter table sii_rcv_documentos add column if not exists cuadre_estado text not null default 'pendiente';
alter table sii_rcv_documentos drop constraint if exists sii_rcv_documentos_cuadre_estado_valido;
alter table sii_rcv_documentos add constraint sii_rcv_documentos_cuadre_estado_valido
  check (cuadre_estado in ('pendiente', 'asociado', 'ignorado', 'comision'));
alter table sii_rcv_documentos add column if not exists venta_id bigint references ventas(id) on delete set null;
alter table sii_rcv_documentos add column if not exists compra_id bigint references compras(id) on delete set null;
alter table sii_rcv_documentos add column if not exists cuadre_nota text check (cuadre_nota is null or length(cuadre_nota) <= 300);
alter table sii_rcv_documentos add column if not exists cuadrado_en timestamptz;
alter table sii_rcv_documentos add column if not exists cuadrado_por text;

create index if not exists sii_rcv_documentos_cuadre_idx on sii_rcv_documentos (operacion, periodo, cuadre_estado);
create unique index if not exists sii_rcv_documentos_venta_unica on sii_rcv_documentos (venta_id) where venta_id is not null;
drop index if exists sii_rcv_documentos_compra_unica;
create index if not exists sii_rcv_documentos_compra_idx on sii_rcv_documentos (compra_id) where compra_id is not null;

select operacion, cuadre_estado, count(*) from sii_rcv_documentos group by 1, 2 order by 1, 2;
