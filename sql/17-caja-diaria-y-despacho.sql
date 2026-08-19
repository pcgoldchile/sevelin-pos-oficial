-- ============================================================
-- SEVELIN POS — Migración 17
-- Apertura/arqueo de caja diaria + despacho/logística en ventas.
-- Archivo: sql/17-caja-diaria-y-despacho.sql
-- Ejecutar después de la 16. Idempotente.
-- ============================================================
--
-- QUÉ RESUELVE
--   1. Turnos de caja: apertura con fondo inicial, movimientos rápidos
--      (ingresos/egresos de caja chica) y cierre con arqueo.
--   2. Despacho: cada venta puede ser retiro en tienda o envío, con
--      dirección, notas, estado de envío y número de seguimiento.
--   3. Comisión de pasarela web y origen del pago, para el margen neto
--      cuando llegue el e-commerce.
-- ============================================================


-- ============================================================
-- 1. Turnos de caja
--    Una fila por apertura. estado 'abierta' | 'cerrada'.
--    Solo puede haber UNA caja abierta a la vez (lo valida el backend).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cajas_diarias (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha_apertura   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre     TIMESTAMPTZ NULL,
  fondo_inicial    NUMERIC NOT NULL DEFAULT 0,
  -- Cifras del arqueo, se llenan al cerrar:
  efectivo_esperado NUMERIC NULL,   -- fondo + ventas efectivo + ingresos - egresos
  efectivo_contado  NUMERIC NULL,   -- lo que el cajero cuenta físicamente
  diferencia        NUMERIC NULL,   -- contado - esperado (sobra + / falta -)
  estado           TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  notas_cierre     TEXT NULL,
  abierta_por      TEXT NULL,       -- rol que abrió
  cerrada_por      TEXT NULL,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cajas_estado ON public.cajas_diarias (estado);
CREATE INDEX IF NOT EXISTS idx_cajas_fecha  ON public.cajas_diarias (fecha_apertura DESC);

COMMENT ON TABLE public.cajas_diarias IS
  'Turnos de caja: apertura con fondo, cierre con arqueo. Solo una abierta a la vez.';


-- ============================================================
-- 2. Movimientos de caja chica (ingresos/egresos rápidos)
--    Afectan el efectivo esperado del turno abierto.
--    tipo: 'INGRESO' (entra plata) | 'EGRESO' (sale: flete, insumos…)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.caja_movimientos (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caja_id     BIGINT NOT NULL REFERENCES public.cajas_diarias(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
  monto       NUMERIC NOT NULL CHECK (monto > 0),
  concepto    TEXT NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caja_mov_caja ON public.caja_movimientos (caja_id);


-- ============================================================
-- 3. Despacho / logística / comisión en ventas
--    Columnas nuevas, todas opcionales (NULL) para no romper ventas viejas.
-- ============================================================
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS tipo_entrega       TEXT NULL DEFAULT 'retiro'
    CHECK (tipo_entrega IN ('retiro','despacho')),
  ADD COLUMN IF NOT EXISTS direccion_envio    TEXT NULL,
  ADD COLUMN IF NOT EXISTS notas_despacho     TEXT NULL,
  ADD COLUMN IF NOT EXISTS estado_envio       TEXT NULL
    CHECK (estado_envio IN ('pendiente','preparacion','enviado','entregado')),
  ADD COLUMN IF NOT EXISTS numero_seguimiento TEXT NULL,
  ADD COLUMN IF NOT EXISTS origen_pago        TEXT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS comision_pasarela  NUMERIC NULL DEFAULT 0,
  -- Vínculo con el turno de caja en que se registró (para el arqueo)
  ADD COLUMN IF NOT EXISTS caja_id            BIGINT NULL REFERENCES public.cajas_diarias(id);

CREATE INDEX IF NOT EXISTS idx_ventas_estado_envio ON public.ventas (estado_envio);
CREATE INDEX IF NOT EXISTS idx_ventas_caja ON public.ventas (caja_id);


-- ============================================================
-- 4. RLS coherente con el resto (backend usa service_role, que la omite)
-- ============================================================
ALTER TABLE public.cajas_diarias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_movimientos ENABLE ROW LEVEL SECURITY;
