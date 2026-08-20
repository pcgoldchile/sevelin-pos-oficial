# CHANGELOG V18 — 20 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v18.

BIZ-02 atómico: el chequeo de stock y el descuento de stock, para productos sin lotes, ahora pasan en
una sola transacción en la base (bloqueo con `SELECT ... FOR UPDATE`), cerrando la condición de carrera
que permitía sobrevender.

---

## 1. El problema

`verificarStockDisponible()` leía el stock y lo comparaba con lo pedido; más abajo, ya con la venta
insertada, `ajustarStock()` volvía a leer y a escribir el mismo stock. Eran dos pasos separados en el
tiempo, sin nada que los uniera: dos cajas vendiendo el mismo producto al mismo tiempo podían pasar
**ambas** la validación (cada una ve stock=3, pide 2) y las dos descontar — el stock terminaba en -1
aunque el chequeo había "aprobado" las dos ventas. Este era el ítem 1 del backlog (`docs/SNAPSHOT.md`).

Los productos con lotes (`usa_lotes = true`) no tenían este problema: `fifo_consumir()` ya resolvía
chequeo + descuento en una función SQL con `FOR UPDATE` (ver `sql/09-lotes-fifo-comision.sql`). V18
lleva el mismo enfoque a los productos sin lotes.

## 2. La solución

- `sql/19-stock-atomico.sql` (nueva): función `descontar_stock_venta(p_items JSONB)`. Recibe la lista de
  productos y cantidades de la venta, y por cada uno:
  - bloquea la fila con `SELECT ... FOR UPDATE` (una segunda venta concurrente del mismo producto espera
    a que la primera termine, no lee un stock ya obsoleto),
  - compara el stock real contra lo pedido,
  - si alcanza, descuenta ahí mismo; si no, `RAISE EXCEPTION` — y Postgres deshace TODO lo que esa misma
    llamada ya había descontado a otros productos de la venta (la venta se acepta o se rechaza como un
    bloque, nunca a medias).
  - Procesa los productos ordenados por `id` para que dos ventas concurrentes con varios productos en
    común los bloqueen siempre en el mismo orden y no se hagan deadlock entre sí.
  - Omite (sin tocar) productos `stock_ilimitado` (servicios) y `usa_lotes` (los sigue manejando
    `fifo_consumir`).

- `api/index.js`: `verificarStockDisponible()` se reemplazó por `descontarStockNoLotes()`, que llama a
  `descontar_stock_venta` por RPC en vez de hacer un `SELECT` de solo lectura. El endpoint
  `POST /api/ventas` la invoca ANTES de insertar la venta (mismo punto donde antes iba el chequeo); si
  la base rechaza el descuento, la venta se corta ahí con 400 y no queda nada escrito.

  Los ítems que `descontar_stock_venta` ya descontó se marcan con `item._stockAtomico = true` (mismo
  patrón que la marca `_fifo` de `aplicarCostosFifo`), para que el `ajustarStock()` que corre más abajo
  — y que sigue existiendo para repuestos de OT, ítems importados por SKU/código de barras y la
  reversión de ventas anuladas — no vuelva a descontarlos por segunda vez. Esa marca interna se quita
  antes de guardar `venta_items` (no es una columna real).

## 3. Qué NO cambió

- `ajustarStock()` sigue igual para repuestos, importación por SKU/código de barras y reversión de
  ventas anuladas (`revertirEfectosDeVentas`): esos caminos no tienen el mismo riesgo de sobreventa en
  caliente y tocarlos ampliaba el alcance de esta tarea sin necesidad.
- Los productos con lotes siguen exactamente igual (`fifo_consumir` / `fifo_devolver`), no se tocaron.
- El endpoint de importación de ventas (`POST /api/ventas/importar`) no valida stock (ya era así antes:
  es solo-admin, para respaldos históricos) — fuera de alcance de este ítem del backlog.

## 4. Pruebas

- `node --check api/index.js`: sin errores.
- SQL: `python -c "import pglast; pglast.parse_sql(open('sql/19-stock-atomico.sql').read())"` → sin
  errores de sintaxis.
- Chequeo de funciones globales duplicadas en `js/*.js`: vacío (no se tocó ningún `.js` de frontend).
- Chequeo de ids duplicados en `index.html`: vacío (no se tocó `index.html`).
- Doble en memoria de Supabase (mock de `createClient` vía `require.cache`, RPC `descontar_stock_venta`
  implementada en memoria con la misma semántica de "todo o nada" que la función SQL) + `app.listen(0)`,
  con 4 casos contra `POST /api/ventas`:
  1. Stock suficiente → 201, se descuenta una sola vez.
  2. Pedido mayor al stock → 400, stock intacto, ninguna venta queda insertada.
  3. Dos ventas seguidas del mismo producto que en conjunto superan el stock (simula la carrera) → la
     primera pasa, la segunda se rechaza; el stock final nunca queda negativo.
  4. Carrito con dos líneas del mismo producto que juntas superan el stock (2+2 contra 3, el caso que ya
     cubría `verificarStockDisponible`) → se sigue rechazando.
  Los 4 casos (12 aserciones) pasaron. El bloqueo `FOR UPDATE` en sí — que solo importa con dos conexiones
  concurrentes reales — no se pudo probar en este entorno (sin Postgres disponible); se razonó a partir
  del mismo patrón ya en producción para `fifo_consumir`.
- No se probó visualmente: el cambio es 100% backend, el flujo de cobro en el POS no cambió de forma
  observable para el usuario (mismo mensaje de "stock insuficiente" que ya mostraba antes).

## 5. Despliegue

1. Ejecutar `sql/19-stock-atomico.sql` en Supabase → SQL Editor (después de 01 a 18; es idempotente).
2. Desplegar `api/index.js`. Sin cambios de Tailwind ni de frontend.

Si por algún motivo la migración 19 todavía no corrió en producción, `db.rpc('descontar_stock_venta', ...)`
devuelve un error de "función no existe" y la venta se rechaza con 400 en vez de vender sin chequeo —
falla cerrado, no abierto.
