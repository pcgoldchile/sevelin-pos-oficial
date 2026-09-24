-- ============================================================
-- 64 · Activos de uso interno (24-09-2026, pedido del dueño)
-- ------------------------------------------------------------
-- "Abrí una Fuente de Poder 650W MSI MAG A650BN para usarla como servicio
--  técnico, después al tiempo veré si la vendo o la armo en un PC, pero me
--  gustaría registrar eso."
--
-- EL PROBLEMA QUE RESUELVE
--   Una unidad que sale del inventario para usarse como herramienta del
--   taller seguía contada como stock vendible. El POS y sevelin.cl ofrecían
--   2 fuentes cuando quedaba 1: se podía vender por la web algo ya abierto.
--
-- ⚠️ POR QUÉ NO ES UNA MERMA (decisión del dueño, aprobada el 24-09-2026)
--   La merma descuenta stock PERO ADEMÁS genera un gasto en `compras` con
--   la clasificación "Mermas / Pérdidas de Inventario". Acá no se perdió
--   nada: la fuente sigue valiendo su costo y puede volver a venderse.
--   Registrarla como pérdida ensuciaría el balance y el F29.
--
-- ⚠️ LA REGLA DE PLATA QUE DEFINE ESTA TABLA (aprobada por el dueño)
--   "Sacar una unidad a uso interno NO mueve el balance. Ni un peso."
--   El razonamiento: esa plata ya se gastó al comprarle la unidad al
--   proveedor, y esa compra YA está registrada en `compras`. Anotarla de
--   nuevo como gasto sería contarla dos veces. Lo único que cambia es la
--   CATEGORÍA del activo: deja de ser mercadería para vender y pasa a ser
--   herramienta. El patrimonio es el mismo antes y después.
--   Consecuencia buscada: la valorización de inventario SÍ baja, y eso es
--   correcto — ese inventario ya no se puede vender.
--
-- ESTA TABLA NUNCA MUEVE PLATA POR SÍ SOLA
--   · Venderla → primero "Devolver a venta" (+stock) y se vende por el POS.
--     Los dos movimientos se cancelan y la venta queda registrada como
--     cualquier otra, con su utilidad real.
--
--   ⚠️ · Darla de baja NO manda al módulo de Mermas, y es a propósito.
--     La merma descuenta stock leyendo `productos.stock` — pero la unidad
--     YA se descontó al pasar a uso interno. Registrarla ahí descontaría
--     una segunda unidad que sí está para vender: un producto con 1 en
--     bodega quedaría en 0. DADO_DE_BAJA solo cierra la ficha y muestra
--     cuánto costo se está dando por perdido, para que quede a la vista.
--     Si más adelante se quiere que además golpee el balance, hay que
--     hacerlo con un gasto que NO toque inventario, no con una merma.
--
-- DOCUMENTO DE RESPALDO (pedido del dueño)
--   "En lo posible que cuando añada algo a activo fijo, pueda adjuntar el
--    archivo o N° de factura o boleta de ese activo fijo."
--   Se guardan los dos y ambos son opcionales: el número suelto sirve
--   aunque no tenga el PDF a mano. El archivo REUTILIZA el bucket privado
--   `compras-documentos` y sus endpoints (/api/compras/archivo y
--   /api/compras/firmar), así que no hay bucket nuevo que configurar y
--   hereda la protección FILE-01: ruta con UUID y URL firmada que caduca.
--   Por eso se guarda la RUTA y no la URL — la URL vence, la ruta no.
-- ============================================================

create table if not exists activos_uso_interno (
  id bigserial primary key,

  producto_id bigint not null references productos(id),

  -- Congelados al momento de sacar la unidad, mismo principio que
  -- `venta_items`: si mañana cambia el costo o el nombre del producto, este
  -- registro histórico no se mueve.
  nombre         text    not null,
  sku            text    null,
  cantidad       numeric not null default 1 check (cantidad > 0),
  costo_unitario numeric not null default 0 check (costo_unitario >= 0),

  motivo text not null,          -- "banco de pruebas del taller"

  estado text not null default 'EN_USO' check (estado in (
           'EN_USO',
           'DEVUELTO_A_VENTA',   -- volvió al stock vendible
           'ARMADO_EN_PC',       -- se consumió dentro de un equipo armado
           'DADO_DE_BAJA')),     -- se perdió de verdad: ahí sí corresponde merma

  -- ---- Respaldo documental (ambos opcionales) ----
  documento_numero text null,    -- N° de factura o boleta, escrito a mano
  documento_ruta   text null,    -- ruta dentro del bucket privado compras-documentos

  -- ---- Cierre ----
  cerrado_en          timestamptz null,
  cierre_nota         text null,
  -- Si se armó dentro de un equipo, a cuál. Opcional: puede ser un PC que
  -- todavía no existe como producto del catálogo.
  producto_destino_id bigint null references productos(id),

  rol            text null,      -- el JWT solo lleva rol, no identidad individual
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- La consulta por defecto del panel: lo que está en uso ahora mismo.
create index if not exists idx_activos_uso_interno_en_uso
  on activos_uso_interno (creado_en desc)
  where estado = 'EN_USO';

-- Para responder "¿este producto tiene unidades fuera del stock?" desde la
-- ficha del producto sin recorrer la tabla entera.
create index if not exists idx_activos_uso_interno_producto
  on activos_uso_interno (producto_id);

comment on table activos_uso_interno is
  'Unidades que salieron del stock vendible para usarse como herramienta o activo del taller. NO genera gasto ni ingreso: la compra ya estaba registrada en `compras`.';

comment on column activos_uso_interno.costo_unitario is
  'Costo congelado al momento de sacar la unidad. No se recalcula si después cambia el costo del producto.';

comment on column activos_uso_interno.documento_ruta is
  'Ruta dentro del bucket privado compras-documentos (no una URL: las firmadas caducan). Se re-firma con POST /api/compras/firmar.';

comment on column activos_uso_interno.estado is
  'DADO_DE_BAJA NO debe registrarse ademas como merma: el stock ya se descuento al pasar a uso interno y la merma lo descontaria por segunda vez.';


-- ============================================================
-- RLS: habilitada y sin políticas, como toda tabla del proyecto.
-- Solo entra la llave service_role del backend.
-- ============================================================
alter table activos_uso_interno enable row level security;


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- select relrowsecurity from pg_class where relname = 'activos_uso_interno';  -- true
-- select count(*) from pg_policies where tablename = 'activos_uso_interno';   -- 0
