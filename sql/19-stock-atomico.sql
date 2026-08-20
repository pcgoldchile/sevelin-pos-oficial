-- ============================================================
-- SEVELIN POS — BIZ-02: chequeo + descuento de stock atómicos
-- Archivo: sql/19-stock-atomico.sql
-- Ejecutar en Supabase → SQL Editor, después de los scripts 01 a 18.
-- Es idempotente: puede correrse varias veces sin efectos secundarios.
-- ============================================================
--
-- PROBLEMA QUE RESUELVE
--   verificarStockDisponible() (api/index.js) lee el stock y lo compara
--   con lo pedido, y más abajo ajustarStock() vuelve a leer y a escribir.
--   Entre esos dos pasos hay una ventana: dos cajas vendiendo el mismo
--   producto al mismo tiempo pueden pasar AMBAS la validación (cada una
--   ve stock=3, pide 2) y las dos descontar — el stock termina en -1
--   aunque el chequeo "aprobó" las dos ventas. Es la misma clase de
--   condición de carrera que ya se resolvió para productos con lotes en
--   fifo_consumir() (sql/09-lotes-fifo-comision.sql); esto hace lo mismo
--   para productos SIN lotes.
--
-- CÓMO LO RESUELVE
--   descontar_stock_venta() hace el chequeo y el descuento en la MISMA
--   llamada, adentro de la base:
--     · SELECT ... FOR UPDATE bloquea la fila del producto mientras se
--       decide, así una segunda venta concurrente del mismo producto
--       espera a que la primera termine (no lee un stock ya obsoleto).
--     · Si algún producto no alcanza, RAISE EXCEPTION aborta TODA la
--       llamada: Postgres deshace los descuentos que esa misma llamada
--       ya había hecho a otros productos de la venta. La venta se acepta
--       o se rechaza como un bloque, nunca a medias.
--     · Se procesan los productos en orden de id (ORDER BY producto_id)
--       para que dos ventas concurrentes con varios productos en común
--       los bloqueen siempre en el mismo orden y no se hagan deadlock
--       entre sí.
--
--   Los productos con usa_lotes = TRUE o stock_ilimitado = TRUE se
--   omiten (los primeros los maneja fifo_consumir, los segundos nunca
--   se validan): no se tocan ni cuentan como descontados.
-- ============================================================


CREATE OR REPLACE FUNCTION descontar_stock_venta(p_items JSONB)
RETURNS TABLE (producto_id BIGINT, stock NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_item      RECORD;
  v_prod      RECORD;
  v_cantidad  NUMERIC;
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

    UPDATE productos
       SET stock = stock - v_cantidad,
           stock_actualizado_en = NOW()
     WHERE id = v_prod.id;

    producto_id := v_prod.id;
    stock        := v_prod.stock - v_cantidad;
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ============================================================
-- VERIFICACIÓN
--   Debe devolver 1 fila.
-- ============================================================
SELECT 'function descontar_stock_venta' AS objeto, COUNT(*)::TEXT AS existe
  FROM pg_proc WHERE proname = 'descontar_stock_venta';
