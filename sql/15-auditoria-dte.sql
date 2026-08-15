-- ============================================================
-- SEVELIN POS — Migración 15
-- Auditoría del cambio de tipo de DTE (Prioridad 7 de la auditoría)
-- Archivo: sql/15-auditoria-dte.sql · Ejecutar después del 14. Idempotente.
-- ============================================================
--
-- QUÉ RESUELVE
--   Cambiar el tipo de documento (BOLETA/FACTURA/SIN DTE) de una venta ya
--   registrada es una operación sensible tributariamente. Ya se restringió
--   a admin (auth(true) en el endpoint), pero faltaba la TRAZA: quién lo
--   cambió, cuándo, y de qué valor a qué valor. Sin registro, un cambio
--   masivo a fin de mes para cuadrar no deja rastro.
--
--   Esta tabla guarda cada cambio. El backend inserta una fila por cada
--   modificación de tipo_dte. Es solo-append: nunca se edita ni se borra.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auditoria_dte (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_id     BIGINT NOT NULL REFERENCES public.ventas(id),
  tipo_anterior TEXT,
  tipo_nuevo    TEXT NOT NULL,
  -- Rol de quien hizo el cambio. Hoy solo 'admin' llega al endpoint, pero
  -- se guarda igual: si mañana cambia la regla, el histórico sigue siendo fiel.
  rol           TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_dte_venta ON public.auditoria_dte (venta_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_dte_fecha ON public.auditoria_dte (creado_en DESC);

-- RLS: coherente con el resto del sistema (el backend usa service_role,
-- que la omite; con RLS activa y sin políticas, la llave anon no entra).
ALTER TABLE public.auditoria_dte ENABLE ROW LEVEL SECURITY;
