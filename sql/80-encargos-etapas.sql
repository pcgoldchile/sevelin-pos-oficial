-- 80 · Encargos: el proceso con el proveedor (v110, 03-10-2026) — pendiente #53
-- ======================================================================
-- EL PEDIDO (dueño, 02 y 03-10-2026)
-- Cuando un cliente quiere un producto por encargo, uno agotado, o más
-- unidades de las que hay, poder marcar en el POS que empezó el encargo y
-- llevar el control: quién lo pidió, cuántas unidades y en qué va. Decidió
-- ampliar "Abonos y Encargos" (no un módulo paralelo) y sacarlo de Servicio
-- Técnico: pasa a ser el módulo "Encargos" del menú.
--
-- Abonos y Encargos ya llevaba la PLATA del cliente (total, abonos, saldo).
-- Lo que faltaba era el PROCESO con el proveedor.
--
-- LA REGLA
--   · etapa: en qué va un encargo que hay que pedirle al proveedor.
--       COTIZANDO → CONFIRMADO (precio y disponibilidad confirmados con el
--       proveedor) → PEDIDO → LLEGO → ENTREGADO, más CANCELADO.
--     NULL = no hay nada que pedir (una reserva de algo que está en stock, o
--     un servicio con seña): ese encargo sigue como siempre, solo con su pago.
--   · origen: por qué hubo que pedirlo. ENCARGO (producto por encargo),
--     AGOTADO (stock 0) o LOTE (había stock pero faltaban unidades). NULL si
--     no nació de un producto del catálogo o no hay nada que pedir.
--   · unidades_pedir: cuántas hay que traer (en un LOTE, solo las que faltan).
--   · proveedor, costo_cotizado_unitario y fecha_estimada: lo que dijo el
--     proveedor. El costo cotizado NO reemplaza a costo_total (el de la
--     utilidad de la venta): es el dato para registrar la compra al llegar.
--   · cliente_avisado_en: cuándo se le avisó al cliente que llegó.
--   · Nada de esto mueve stock ni plata: al llegar, la compra se registra con
--     el ingreso de mercadería de siempre (regla del dueño: con su clic).
--   · encargo_abonos.maquina_tarjeta: por cuál máquina pasó un abono con
--     tarjeta (sql/79), para que su comisión sea la de esa máquina.
--
-- No crea tablas (no hay RLS nuevo que activar). Idempotente.

alter table encargos add column if not exists etapa text null;
alter table encargos drop constraint if exists encargos_etapa_check;
alter table encargos
  add constraint encargos_etapa_check
  check (etapa is null or etapa in ('COTIZANDO', 'CONFIRMADO', 'PEDIDO', 'LLEGO', 'ENTREGADO', 'CANCELADO'));

alter table encargos add column if not exists etapa_cambiada_en timestamptz null;

alter table encargos add column if not exists origen text null;
alter table encargos drop constraint if exists encargos_origen_check;
alter table encargos
  add constraint encargos_origen_check
  check (origen is null or origen in ('ENCARGO', 'AGOTADO', 'LOTE'));

alter table encargos add column if not exists unidades_pedir integer null;
alter table encargos drop constraint if exists encargos_unidades_pedir_check;
alter table encargos
  add constraint encargos_unidades_pedir_check
  check (unidades_pedir is null or unidades_pedir between 1 and 100000);

alter table encargos add column if not exists proveedor text null;
alter table encargos drop constraint if exists encargos_proveedor_check;
alter table encargos
  add constraint encargos_proveedor_check
  check (proveedor is null or length(proveedor) <= 120);

alter table encargos add column if not exists costo_cotizado_unitario numeric null;
alter table encargos drop constraint if exists encargos_costo_cotizado_check;
alter table encargos
  add constraint encargos_costo_cotizado_check
  check (costo_cotizado_unitario is null or costo_cotizado_unitario >= 0);

alter table encargos add column if not exists fecha_estimada date null;
alter table encargos add column if not exists cliente_avisado_en timestamptz null;

alter table encargos add column if not exists cancelado_motivo text null;
alter table encargos drop constraint if exists encargos_cancelado_motivo_check;
alter table encargos
  add constraint encargos_cancelado_motivo_check
  check (cancelado_motivo is null or length(cancelado_motivo) <= 300);

comment on column encargos.etapa is
  'Proceso con el proveedor: COTIZANDO, CONFIRMADO, PEDIDO, LLEGO, ENTREGADO o CANCELADO. NULL = no hay nada que pedir (sql/80).';
comment on column encargos.origen is
  'Por qué hubo que pedirlo: ENCARGO (producto por encargo), AGOTADO (stock 0) o LOTE (faltaban unidades).';
comment on column encargos.unidades_pedir is 'Unidades que hay que traer del proveedor (en un LOTE, solo las que faltan).';
comment on column encargos.costo_cotizado_unitario is
  'Costo por unidad que cotizó el proveedor. Sirve para registrar la compra al llegar; no es el costo de la venta.';
comment on column encargos.cliente_avisado_en is 'Cuándo se le avisó al cliente que su encargo llegó.';

-- Para el aviso "encargos pendientes" del encabezado.
create index if not exists encargos_etapa_idx on encargos (etapa) where etapa is not null;

alter table encargo_abonos add column if not exists maquina_tarjeta text null;
alter table encargo_abonos drop constraint if exists encargo_abonos_maquina_tarjeta_check;
alter table encargo_abonos
  add constraint encargo_abonos_maquina_tarjeta_check
  check (maquina_tarjeta is null or maquina_tarjeta in ('TUU', 'BANCHILE'));
