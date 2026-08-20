-- ============================================================
-- SEVELIN POS — Migración 18
-- Gastos programados: compras que se registran hoy pero se pagan (y se
-- cargan a gastos) en una fecha futura. Cubre dos casos reales:
--   · Compra con tarjeta de crédito que se paga meses después.
--   · Pago en cuotas: una compra genera N gastos programados, uno por mes.
-- Archivo: sql/18-gastos-programados.sql
-- Ejecutar después de la 17. Idempotente.
-- ============================================================
--
-- CÓMO FUNCIONA
--   Un gasto programado queda PENDIENTE con su fecha de vencimiento. Al
--   llegar esa fecha (o pasarla), se materializa: se crea una fila real en
--   `compras` y el programado pasa a 'aplicado'. Así el balance del mes solo
--   ve el gasto cuando de verdad corresponde pagarlo.
--
--   La materialización la dispara el backend (endpoint de "procesar
--   vencidos"), que el frontend llama al abrir Finanzas. No se usa cron:
--   con revisar al entrar basta para este negocio.
--
--   Las cuotas se modelan como N programados hermanos, unidos por
--   `grupo_cuotas` (un UUID de texto) y numerados en `cuota_numero` /
--   `cuota_total`. No hay tabla aparte: una cuota ES un gasto programado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gastos_programados (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Datos del gasto (los mismos que una compra, para poder materializarlo)
  proveedor      TEXT,
  clasificacion  TEXT NOT NULL,
  monto          NUMERIC NOT NULL CHECK (monto >= 0),
  descripcion    TEXT NULL,
  metodo_pago    TEXT NULL,        -- normalmente 'Tarjeta Crédito'

  -- Programación
  fecha_vencimiento DATE NOT NULL, -- cuándo se debe pagar / cargar a gastos
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','aplicado','cancelado')),

  -- Cuotas (opcional): varios programados hermanos comparten grupo_cuotas
  grupo_cuotas   TEXT NULL,
  cuota_numero   INTEGER NULL,     -- 1, 2, 3…
  cuota_total    INTEGER NULL,     -- total de cuotas del grupo

  -- Trazabilidad de la materialización
  compra_id      BIGINT NULL REFERENCES public.compras(id),
  aplicado_en    TIMESTAMPTZ NULL,

  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gastos_prog_estado ON public.gastos_programados (estado);
CREATE INDEX IF NOT EXISTS idx_gastos_prog_venc   ON public.gastos_programados (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_gastos_prog_grupo  ON public.gastos_programados (grupo_cuotas);

COMMENT ON TABLE public.gastos_programados IS
  'Gastos futuros (tarjeta de crédito, cuotas). Al vencer se materializan como compras reales.';

ALTER TABLE public.gastos_programados ENABLE ROW LEVEL SECURITY;
