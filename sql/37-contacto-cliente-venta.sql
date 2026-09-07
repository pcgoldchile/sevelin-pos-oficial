-- ============================================================
-- SEVELIN POS — Migración 37
-- Contacto del cliente en la venta (bloqueo B5 del plan de crecimiento)
-- ------------------------------------------------------------
-- POR QUÉ
-- La auditoría de la Fase 1 (07-09-2026) encontró que 166 de 167 ventas
-- no tienen ni el nombre del cliente. El dato existe en la vida real —
-- casi toda venta se coordina por WhatsApp antes de entregar — pero se
-- queda en el teléfono del dueño y nunca entra al sistema.
--
-- Sin esto no hay forma de:
--   · avisarle a alguien que su garantía está por vencer,
--   · ofrecerle el accesorio que le falta a lo que ya compró,
--   · medir cuántos clientes vuelven (hoy la recompra es incalculable),
--   · recuperar a quien no compra hace 90 días.
--
-- `ventas.cliente` (texto libre) ya existía. Se agrega el contacto, con
-- el MISMO nombre de columna que ya usa `ordenes_trabajo`
-- (`cliente_telefono`), para no inventar una convención nueva.
--
-- TODO OPCIONAL, SIEMPRE. Una venta jamás debe bloquearse porque el
-- cliente no quiso dar su teléfono: el POS atiende con el cliente
-- esperando al otro lado del mostrador.
--
-- Idempotente. Aplicar con:
--   npx supabase db query --file sql/37-contacto-cliente-venta.sql --linked
-- ============================================================

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS cliente_telefono TEXT,
  ADD COLUMN IF NOT EXISTS cliente_correo   TEXT;

COMMENT ON COLUMN ventas.cliente_telefono IS
  'Teléfono/WhatsApp del cliente, normalizado a solo dígitos con código de país (ej. 56912345678). Opcional: nunca bloquea la venta.';

COMMENT ON COLUMN ventas.cliente_correo IS
  'Correo del cliente. Opcional. Solo se usa para marketing si además existe consentimiento explícito (Ley 21.719).';

-- Buscar "todas las ventas de este cliente" es la consulta que habilita
-- recompra, postventa y garantías. Índice parcial: la enorme mayoría de
-- las filas históricas tiene NULL y no vale la pena indexarlas.
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_telefono
  ON ventas (cliente_telefono)
  WHERE cliente_telefono IS NOT NULL;
