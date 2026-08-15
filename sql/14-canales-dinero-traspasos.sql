-- ============================================================
-- SEVELIN POS — Canales de dinero (Efectivo / Banco), traspasos
--               y monto de resguardo de caja
-- Archivo: sql/14-canales-dinero-traspasos.sql
-- Ejecutar después del 13. Idempotente.
-- ============================================================
--
-- QUÉ RESUELVE
--   El negocio maneja dos "cajas": el efectivo físico del cajón y el
--   dinero en cuentas bancarias/digitales. Hasta ahora el balance ya
--   separaba "efectivo" del resto (esEfectivo en el backend), pero:
--     1. No se guardaba A QUÉ BANCO fue cada gasto/ingreso bancario.
--     2. No había forma de mover plata de un canal al otro (ir al banco
--        a depositar el efectivo del día) sin que pareciera un ingreso
--        o un gasto falso.
--     3. No se podía fijar un "mínimo de caja" para las alertas.
--
--   El CANAL de cada movimiento se DERIVA del método de pago que ya se
--   guarda (Efectivo → caja chica; cualquier otro → banco), así que NO
--   se agrega una columna redundante de canal. Solo se añade el nombre
--   del banco donde hoy no existe, y una tabla nueva para los traspasos.
-- ============================================================


-- ============================================================
-- 1. Nombre del banco / cuenta en los movimientos bancarios
--    Texto libre y opcional: solo se llena cuando el método NO es
--    efectivo. Sirve para desglosar "cuánto tengo en BancoEstado vs
--    Santander" a futuro; hoy el saldo total no lo necesita, pero se
--    guarda para no perder el dato.
-- ============================================================
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS banco TEXT NULL;

ALTER TABLE public.inyecciones_capital
  ADD COLUMN IF NOT EXISTS banco TEXT NULL;


-- ============================================================
-- 2. Traspasos internos entre canales
--    Mover $X de Efectivo a Banco (o al revés) NO es un ingreso ni un
--    gasto: es la misma plata cambiando de bolsillo. Por eso va en su
--    propia tabla y NO en `compras` ni en `ventas`, que alimentan la
--    utilidad. Un traspaso deja el saldo total intacto y solo reparte
--    entre los dos canales.
--
--    origen/destino: 'EFECTIVO' o 'BANCO'. Se validan con CHECK para que
--    no entre basura, y se exige que sean distintos (no tiene sentido
--    traspasar de un canal a sí mismo).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.traspasos (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  origen      TEXT NOT NULL CHECK (origen  IN ('EFECTIVO', 'BANCO')),
  destino     TEXT NOT NULL CHECK (destino IN ('EFECTIVO', 'BANCO')),
  monto       NUMERIC NOT NULL CHECK (monto > 0),
  banco       TEXT NULL,          -- a qué cuenta, cuando aplica
  nota        TEXT NULL,          -- justificación del movimiento
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT traspasos_distinto CHECK (origen <> destino)
);

COMMENT ON TABLE public.traspasos IS
  'Movimientos internos de dinero entre Efectivo y Banco. No son ingresos ni gastos: no afectan la utilidad, solo el reparto del saldo entre canales.';

CREATE INDEX IF NOT EXISTS idx_traspasos_fecha ON public.traspasos (fecha DESC);

-- Como la Fase 1 activó RLS en todo el esquema, la tabla nueva también
-- debe quedar con RLS activa (sin política: solo el service_role del
-- backend entra, la llave anon queda fuera). Coherente con SEC-01.
ALTER TABLE public.traspasos ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. Configuración de Finanzas: monto mínimo de resguardo de caja
--    Un solo registro (id = 1) con los ajustes del módulo. Se usa una
--    tabla en vez de una variable de entorno para que el usuario pueda
--    cambiarlo desde la interfaz sin redeploy.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.config_finanzas (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  resguardo_caja      NUMERIC NOT NULL DEFAULT 0,   -- mínimo a mantener disponible
  dias_alerta         INTEGER NOT NULL DEFAULT 15,  -- ventana de vencimientos a vigilar
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT config_finanzas_unico CHECK (id = 1)
);

ALTER TABLE public.config_finanzas ENABLE ROW LEVEL SECURITY;

-- Fila por defecto (no pisa la existente si ya se corrió antes)
INSERT INTO public.config_finanzas (id, resguardo_caja, dias_alerta)
VALUES (1, 0, 15)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 4. Día de vencimiento en los gastos fijos
--    Ya existe gastos_fijos.dia_mes (1..31), así que el calendario de
--    vencimientos para las alertas se arma con lo que ya hay. No se
--    agrega nada; se deja constancia de que las alertas se apoyan en
--    esa columna.
-- ============================================================
-- (sin cambios de esquema aquí)


-- ============================================================
-- 5. Verificación rápida (no deja rastro)
-- ============================================================
DO $$
DECLARE v_id BIGINT;
BEGIN
  -- Traspaso de prueba válido
  INSERT INTO traspasos (origen, destino, monto, nota)
  VALUES ('EFECTIVO', 'BANCO', 1000, '__PRUEBA__')
  RETURNING id INTO v_id;
  DELETE FROM traspasos WHERE id = v_id;

  -- La config debe existir
  IF NOT EXISTS (SELECT 1 FROM config_finanzas WHERE id = 1) THEN
    RAISE EXCEPTION 'FALLÓ: no se creó config_finanzas';
  END IF;

  RAISE NOTICE 'OK: traspasos y config_finanzas listos; columnas banco agregadas.';
END $$;
