-- ============================================================
-- SEVELIN POS · Migración 20
-- Fix: descontar_stock_venta() fallaba con
-- "column reference 'stock' is ambiguous" al confirmar una venta.
-- ------------------------------------------------------------
-- SEGURO DE CORRER: usa CREATE OR REPLACE FUNCTION, así que no
-- duplica nada. Ejecutar en Supabase → SQL Editor, después de 01-19.
--
-- CAUSA
--   La función se declara RETURNS TABLE (producto_id BIGINT, stock
--   NUMERIC): esos nombres de columna de salida quedan disponibles
--   dentro del cuerpo como variables PL/pgSQL. Al hacer
--     UPDATE productos SET stock = stock - v_cantidad ...
--   el "stock" del lado derecho es ambiguo para Postgres: puede ser
--   la columna productos.stock o la variable de salida `stock` — con
--   #variable_conflict en su valor por defecto ('error'), aborta la
--   llamada. Por eso CADA venta fallaba al intentar descontar stock.
--
-- FIX
--   El nuevo stock ya se conoce (viene de v_prod.stock, leído con
--   SELECT ... FOR UPDATE unas líneas antes bajo el mismo lock), así
--   que el UPDATE lo usa directamente en vez de releer la columna:
--   sin ambigüedad y sin una lectura de más.
-- ============================================================

CREATE OR REPLACE FUNCTION descontar_stock_venta(p_items JSONB)
RETURNS TABLE (producto_id BIGINT, stock NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_item      RECORD;
  v_prod      RECORD;
  v_cantidad  NUMERIC;
  v_nuevo     NUMERIC;
BEGIN
  FOR v_item IN
    SELECT (elem->>'producto_id')::BIGINT AS producto_id,
           (elem->>'cantidad')::NUMERIC   AS cantidad
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS elem
    ORDER BY (elem->>'producto_id')::BIGINT ASC
  LOOP
    v_cantidad := COALESCE(v_item.cantidad, 0);
    IF v_item.producto_id IS NULL OR v_cantidad <= 0 THEN
      CONTINUE;
    END IF;

    SELECT p.id, p.nombre, p.stock, p.stock_ilimitado, p.usa_lotes
      INTO v_prod
      FROM productos p
     WHERE p.id = v_item.producto_id
     FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF;              -- ítem manual sin ficha
    IF v_prod.stock_ilimitado THEN CONTINUE; END IF;  -- servicio: nunca falta
    IF v_prod.usa_lotes THEN CONTINUE; END IF;        -- lo valida fifo_consumir

    IF v_prod.stock < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente de "%": pides %, hay %',
        COALESCE(v_prod.nombre, 'producto'), v_cantidad, v_prod.stock
        USING ERRCODE = 'P0001';
    END IF;

    v_nuevo := v_prod.stock - v_cantidad;

    UPDATE productos
       SET stock = v_nuevo,
           stock_actualizado_en = NOW()
     WHERE id = v_prod.id;

    producto_id := v_prod.id;
    stock        := v_nuevo;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================
-- VERIFICACIÓN
--   Crea un producto de prueba con stock=5, descuenta 2 vía la
--   función, confirma que quedó en 3, y borra el producto. No deja
--   rastro. Antes del fix, este bloque fallaba con "column
--   reference 'stock' is ambiguous".
-- ============================================================
DO $$
DECLARE
  v_id BIGINT;
  v_resultado NUMERIC;
BEGIN
  INSERT INTO productos (nombre, precio_unitario, stock, stock_ilimitado, usa_lotes)
  VALUES ('__PRUEBA_STOCK__', 1000, 5, FALSE, FALSE)
  RETURNING id INTO v_id;

  SELECT stock INTO v_resultado
    FROM descontar_stock_venta(
      jsonb_build_array(jsonb_build_object('producto_id', v_id, 'cantidad', 2))
    );

  IF v_resultado IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'FALLÓ: se esperaba stock=3 tras descontar 2 de 5, quedó en %', v_resultado;
  END IF;

  RAISE NOTICE 'OK: descontar_stock_venta funciona sin ambigüedad (stock final = %)', v_resultado;
  DELETE FROM productos WHERE id = v_id;
END $$;
