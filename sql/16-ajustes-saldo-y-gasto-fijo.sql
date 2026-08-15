-- ============================================================
-- SEVELIN POS — Migración 16
-- Ajustes manuales de saldo (con justificación e historial) y
-- soporte para el checklist de gastos fijos del mes.
-- Archivo: sql/16-ajustes-saldo-y-gasto-fijo.sql
-- Ejecutar después de la 15. Idempotente.
-- ============================================================
--
-- QUÉ RESUELVE
--   1. Editar a mano el saldo de un canal (Efectivo o Banco) cuando la
--      realidad no cuadra con lo calculado: se contó el cajón y sobran
--      $3.000, o el banco muestra un cargo que el sistema no registró.
--      Cada ajuste EXIGE una justificación y queda en un historial.
--
--   2. Vincular un gasto fijo pagado con la compra que lo registró, para
--      que el checklist del mes sepa cuáles ya se pagaron.
--
--   Un ajuste NO reescribe el saldo: guarda un DELTA (diferencia) que el
--   cálculo de saldos suma al canal. Así el saldo sigue siendo la suma de
--   movimientos reales + ajustes, nunca un número mágico que tape errores.
-- ============================================================


-- ============================================================
-- 1. Ajustes manuales de saldo por canal
--    canal: 'EFECTIVO' o 'BANCO' (el total NO se ajusta: se calcula).
--    delta: cuánto se sumó (o restó, si es negativo) al canal.
--    saldo_anterior / saldo_nuevo: se guardan para el historial legible.
--    motivo: OBLIGATORIO (lo valida también el backend).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ajustes_saldo (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canal          TEXT NOT NULL CHECK (canal IN ('EFECTIVO', 'BANCO')),
  delta          NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL DEFAULT 0,
  saldo_nuevo    NUMERIC NOT NULL DEFAULT 0,
  motivo         TEXT NOT NULL,
  rol            TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_saldo_canal ON public.ajustes_saldo (canal);
CREATE INDEX IF NOT EXISTS idx_ajustes_saldo_fecha ON public.ajustes_saldo (creado_en DESC);

COMMENT ON TABLE public.ajustes_saldo IS
  'Correcciones manuales de saldo por canal, con justificación obligatoria. Suma deltas, no reescribe.';


-- ============================================================
-- 2. Vínculo gasto fijo → compra que lo pagó
--    Cuando se paga un gasto fijo desde su pestaña, se crea una compra.
--    Guardar el id del gasto fijo en esa compra permite al checklist
--    marcar "pagado este mes" sin depender de comparar textos.
--    Es opcional (NULL): las compras normales no lo llevan.
-- ============================================================
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS gasto_fijo_id BIGINT NULL REFERENCES public.gastos_fijos(id);

CREATE INDEX IF NOT EXISTS idx_compras_gasto_fijo ON public.compras (gasto_fijo_id);


-- ============================================================
-- 3. RLS coherente con el resto (el backend usa service_role, que la omite;
--    con RLS activa y sin políticas, la llave anon no entra).
-- ============================================================
ALTER TABLE public.ajustes_saldo ENABLE ROW LEVEL SECURITY;
