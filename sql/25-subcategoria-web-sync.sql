-- ============================================================
-- SEVELIN POS — Migración 25
-- Subcategoría web sincronizable a la tienda.
--
-- producto_categorias.parent_id (migración 24) y productos.categoria_id
-- (migración 23) ya permiten armar un árbol de 2 niveles categoría →
-- subcategoría, y el módulo "Página Web → Categorías" del POS ya lo usa
-- para crear/editar subcategorías. Pero esa relación es 100% interna del
-- POS: el trigger de sincronización (sql/22) manda la fila de `productos`
-- tal cual a la tienda, y la tienda solo lee productos_web.categoria
-- (texto plano) — no tiene ninguna noción de categoria_id ni de árbol.
--
-- En vez de resolver el árbol dentro del trigger SQL (JOIN dentro de la
-- función de pg_net, más frágil de mantener), se resuelve en el momento
-- de guardar el producto en el POS (js/productos.js::guardarProducto):
-- categoria_web queda SIEMPRE con el nombre de la categoría de nivel
-- superior (para que el filtro plano de categorías de la tienda no se
-- rompa), y esta columna nueva guarda el nombre de la subcategoría
-- elegida, si la hay. El trigger de sync no necesita ningún cambio: ya
-- manda la fila completa, incluida esta columna nueva.
-- ============================================================

alter table productos
  add column if not exists subcategoria_web text;

-- ============================================================
-- VERIFICACIÓN
--   select column_name from information_schema.columns
--    where table_name = 'productos' and column_name = 'subcategoria_web';
--   -- debe devolver 1 fila
-- ============================================================
