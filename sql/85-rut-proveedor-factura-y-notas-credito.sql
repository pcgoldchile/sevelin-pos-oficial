-- 85 · RUT del proveedor y factura adjunta en cada compra; revisión de las notas de crédito recibidas (v120, 04-10-2026)
-- ======================================================================
-- EL PEDIDO (dueño, 04-10-2026)
-- "Necesito un campo para rellenar el RUT de ese proveedor", "¿puedo adjuntar
-- PDF a mis compras?" y "necesito hacer seguimiento a quienes están haciendo
-- notas de crédito ... para evitarme sorpresas de proveedores que dan la
-- factura y luego la nota de crédito silenciosamente".
--
-- QUÉ AGREGA
--   · ingresos_mercaderia.proveedor_rut  → RUT del proveedor de esa compra,
--     en el mismo formato que usa el SII ('77398220-1'). Con el RUT y el N°
--     de factura el POS puede buscar la factura en el RCV (sii_rcv_documentos)
--     y avisar si ese proveedor ya emitió notas de crédito.
--   · ingresos_mercaderia.url_documento  → RUTA del archivo en el bucket
--     privado compras-documentos (la misma de los gastos, ver FILE-01): se
--     guarda la ruta, no un enlace, y se firma al abrirlo.
--   · proveedores_plazos.rut             → el RUT se recuerda por proveedor,
--     para proponerlo la próxima vez que se escriba su nombre.
--   · sii_rcv_documentos.revision / revisado_en / revisado_nota → el dueño
--     marca cada nota de crédito recibida como "la esperaba" o "no la
--     esperaba". El robot del RCV hace upsert sin estas columnas, así que
--     una revisión no se pierde cuando el robot vuelve a traer el documento.
--
-- No crea tablas (el RLS de las tres queda como está). Idempotente.

alter table ingresos_mercaderia add column if not exists proveedor_rut text null;
alter table ingresos_mercaderia add column if not exists url_documento text null;

alter table ingresos_mercaderia drop constraint if exists ingresos_mercaderia_proveedor_rut_check;
alter table ingresos_mercaderia
  add constraint ingresos_mercaderia_proveedor_rut_check
  check (proveedor_rut is null or proveedor_rut ~ '^[0-9]{7,8}-[0-9K]$');

alter table proveedores_plazos add column if not exists rut text null;

alter table sii_rcv_documentos add column if not exists revision text null;
alter table sii_rcv_documentos add column if not exists revisado_en timestamptz null;
alter table sii_rcv_documentos add column if not exists revisado_nota text null;

alter table sii_rcv_documentos drop constraint if exists sii_rcv_documentos_revision_check;
alter table sii_rcv_documentos
  add constraint sii_rcv_documentos_revision_check
  check (revision is null or revision in ('esperada', 'no_esperada'));

comment on column ingresos_mercaderia.proveedor_rut is 'RUT del proveedor de la compra, formato del SII (sin puntos, con guion). Opcional.';
comment on column ingresos_mercaderia.url_documento is 'Ruta de la factura adjunta en el bucket privado compras-documentos. Opcional.';
comment on column proveedores_plazos.rut is 'RUT del proveedor, para proponerlo al escribir su nombre en una compra.';
comment on column sii_rcv_documentos.revision is 'Revisión del dueño sobre una nota de crédito recibida: esperada / no_esperada. NULL = sin revisar.';
