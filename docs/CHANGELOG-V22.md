# CHANGELOG V22 — 20 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v22.

Fix crítico: toda venta con al menos un producto sin lotes fallaba al confirmarse.

---

## 1. El problema

Al confirmar una venta en el POS o en la web salía el error de Supabase:

```
column reference "stock" is ambiguous
```

Rompía **cualquier** venta que incluyera un producto sin lotes (`usa_lotes = FALSE`, la mayoría del
catálogo) — solo se salvaban las ventas 100% de productos con lotes o con `stock_ilimitado`.

## 2. Causa

`descontar_stock_venta()` (`sql/19-stock-atomico.sql`, v18) se declara:

```sql
RETURNS TABLE (producto_id BIGINT, stock NUMERIC)
```

En PL/pgSQL, los nombres de columna de un `RETURNS TABLE` quedan disponibles dentro del cuerpo de la
función como variables normales. Eso significa que, dentro de la función, `stock` es a la vez:

- la columna `productos.stock`, y
- la variable de salida `stock` (la que se llena con `RETURN NEXT`).

El `UPDATE` hacía:

```sql
UPDATE productos SET stock = stock - v_cantidad ...
```

El `stock` del lado derecho es ambiguo entre esas dos cosas, y con `#variable_conflict` en su valor por
defecto (`error`), Postgres aborta la llamada en vez de adivinar cuál de las dos quiso decir. Como
`descontar_stock_venta` se llama en **toda** venta con productos sin lotes (`api/index.js`,
`descontarStockNoLotes`), el bug estaba en el camino crítico desde que se desplegó BIZ-02 en v18: nunca
funcionó en producción para ese caso.

## 3. Fix (`sql/20-fix-descontar-stock-ambiguo.sql`)

`CREATE OR REPLACE FUNCTION descontar_stock_venta(...)` con el mismo comportamiento, salvo que el nuevo
stock se calcula una vez en una variable (`v_nuevo := v_prod.stock - v_cantidad`, usando el valor ya
leído bajo el `SELECT ... FOR UPDATE`) y el `UPDATE` y el valor de retorno usan esa variable en vez de
releer/reescribir la columna ambigua:

```sql
v_nuevo := v_prod.stock - v_cantidad;
UPDATE productos SET stock = v_nuevo, stock_actualizado_en = NOW() WHERE id = v_prod.id;
producto_id := v_prod.id;
stock        := v_nuevo;
```

Se dejó `sql/19-stock-atomico.sql` sin tocar como registro histórico, con una nota al inicio que remite
a esta migración — igual que cualquier otra migración numerada, en una base nueva basta con correr 19 y
luego 20 en orden.

## 4. Qué NO cambió

- `api/index.js` no se tocó: `descontarStockNoLotes()` ya llamaba correctamente a la función vía
  `db.rpc('descontar_stock_venta', { p_items })` y ya envolvía la ruta `POST /api/ventas` en `try/catch`
  (v19) para devolver el error como 400 en vez de colgar la petición. El bug era 100% de la función SQL.
- La lógica de negocio (chequeo + descuento atómico con `FOR UPDATE`, reglas de `stock_ilimitado` /
  `usa_lotes`, rollback si algún producto no alcanza): igual que en v18, sin cambios.

## 5. Pruebas

- `python -c "import pglast; pglast.parse_sql(...)"` sobre `sql/19-stock-atomico.sql` y
  `sql/20-fix-descontar-stock-ambiguo.sql`: ambos parsean sin errores.
- La propia migración 20 incluye un bloque `DO $$ ... $$` de verificación: crea un producto de prueba
  con stock=5, descuenta 2 vía `descontar_stock_venta`, confirma que quedó en 3, y lo borra — antes del
  fix ese bloque fallaba con el mismo "column reference is ambiguous" reportado en producción.
- No se pudo ejecutar contra una base Supabase real desde este entorno (sin credenciales/red): la
  verificación de arriba corre dentro de la migración misma, así que se ejecuta como parte de aplicarla.
- Sin cambios en `.js`: no aplica `node --check` ni el chequeo de colisiones de funciones/ids.

## 6. Despliegue — ACCIÓN REQUERIDA

Este fix **no se aplica solo**: hay que correr manualmente `sql/20-fix-descontar-stock-ambiguo.sql`
completo en Supabase → SQL Editor. Hasta que se corra, las ventas con productos sin lotes van a seguir
fallando en producción con el mismo error. Sin cambios de Tailwind ni de backend (`api/index.js`).
