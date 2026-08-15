-- ============================================================
-- SEVELIN POS · Migración 13
-- Repara numero_ot (Check-In roto tras la Fase 1) + cierra las
-- dos advertencias "Function Search Path Mutable" del Advisor.
-- ------------------------------------------------------------
-- SEGURO DE CORRER: es idempotente. Usa CREATE OR REPLACE, IF NOT
-- EXISTS y DROP ... IF EXISTS, así que no duplica nada aunque el
-- trigger ya estuviera. Córrelo entero en Supabase → SQL Editor.
--
-- Por qué falló el Check-In: el INSERT de OT no manda numero_ot a
-- propósito, para que lo asigne el trigger trg_asignar_numero_ot.
-- Si la base se recreó desde el diagrama (que NO exporta triggers)
-- o el trigger se perdió, la columna NOT NULL queda sin quien la
-- rellene y el INSERT revienta. Esto lo vuelve a dejar en su lugar.
-- ============================================================

-- 1. La secuencia del correlativo (no se pierde si ya existe)
CREATE SEQUENCE IF NOT EXISTS ordenes_trabajo_numero_seq START WITH 1 INCREMENT BY 1;

-- 2. La función que arma "OT-000001".
--    SET search_path = public, pg_temp cierra la advertencia
--    "Function Search Path Mutable" del Advisor para esta función:
--    fija el esquema, evitando que alguien la engañe cambiando el
--    search_path de su sesión.
CREATE OR REPLACE FUNCTION asignar_numero_ot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.numero_ot IS NULL OR NEW.numero_ot = '' THEN
    NEW.numero_ot := 'OT-' || LPAD(nextval('ordenes_trabajo_numero_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 3. El trigger. Se recrea para asegurar que quede enganchado.
DROP TRIGGER IF EXISTS trg_asignar_numero_ot ON ordenes_trabajo;
CREATE TRIGGER trg_asignar_numero_ot
  BEFORE INSERT ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION asignar_numero_ot();

-- 4. Reposiciona la secuencia después de la última OT existente,
--    para no chocar con números ya usados (UNIQUE) si tenías datos.
SELECT setval(
  'ordenes_trabajo_numero_seq',
  GREATEST(
    COALESCE((SELECT MAX(NULLIF(regexp_replace(numero_ot, '\D', '', 'g'), ''))::BIGINT
              FROM ordenes_trabajo), 0),
    1
  )
);

-- ============================================================
-- 5. Advisor: "Function Search Path Mutable" en fifo_consumir y
--    fifo_devolver. Se les fija el search_path sin reescribir la
--    lógica (ALTER, no CREATE), así que es inofensivo.
-- ============================================================
ALTER FUNCTION fifo_consumir(BIGINT, NUMERIC) SET search_path = public, pg_temp;
ALTER FUNCTION fifo_devolver(BIGINT, NUMERIC) SET search_path = public, pg_temp;

-- ============================================================
-- 6. VERIFICACIÓN. Inserta una OT de prueba, confirma que recibió
--    numero_ot automático, y la borra. No deja rastro.
-- ============================================================
DO $$
DECLARE v_id BIGINT; v_num TEXT;
BEGIN
  INSERT INTO ordenes_trabajo (cliente_nombre, dispositivo_modelo, falla_reportada, estado)
  VALUES ('__PRUEBA__', '__PRUEBA__', '__PRUEBA__', 'PENDIENTE')
  RETURNING id, numero_ot INTO v_id, v_num;

  IF v_num IS NULL THEN
    RAISE EXCEPTION 'FALLÓ: el trigger no asignó numero_ot';
  END IF;

  RAISE NOTICE 'OK: la OT de prueba recibió el número %', v_num;
  DELETE FROM ordenes_trabajo WHERE id = v_id;
END $$;
