# v152 · Gastos de meses pasados: en su mes y sin descontar dos veces del saldo (15-10-2026)

Sin migración (usa `compras.afecta_saldo` de sql/49). Cambia `api/index.js` (POST /api/compras), `js/compras.js`,
`js/productos.js`, `js/stock-ajuste.js` e `index.html`.

## Qué pasaba
El dueño cargó la compra de una Carcasa M.2 de abril (9 × $3.479) y apretó "Anotar el gasto". El gasto (#39) se abrió
con la fecha de HOY y moviendo el saldo: restaba en la utilidad de octubre y otra vez del banco, aunque esa plata salió
en abril y el saldo ya estaba cuadrado con reajustes. La casilla "no mueve el saldo" solo existía al pagar un gasto fijo.
El saldo de caja y banco no mira fechas: suma todo desde el principio más los reajustes.

## Qué quedó
- "Anotar el gasto" (después de una compra en la ficha o de una corrección de stock "Las compré") abre el gasto con la
  **fecha de la compra** y lo **vincula** a ella (`ingresos_mercaderia.compra_id`, solo si no tenía gasto).
- Formulario de Gastos: casilla **"⚖️ Ya lo pagué antes: no mueve el saldo"**. Se marca sola si la fecha es de un mes
  anterior al actual y sigue a la fecha hasta que el dueño la toque; al editar muestra lo guardado.
- Corregido a pedido del dueño: gasto #39 con fecha 05-04-2026, `afecta_saldo = false`, vinculado al registro #53.

## Regla conversada para cargar compras antiguas
- Antes del 03-08-2026 (sin ventas en el POS): solo el registro de compra en el producto, sin gasto (salvo que él lo
  quiera en su mes, como el #39).
- Desde agosto: gasto con la fecha real y "no mueve el saldo".
- Si el stock no calza con lo comprado: registrar las unidades que hay hoy, con el costo real y la factura adjunta, y
  anotar en la nota lo que se vendió antes. No desmarcar "sumar al stock" para esto (crearía una capa sin unidades).
- Factura con IVA de un mes ya declarado en el F29: no marcar "tiene factura" sin revisarlo.

## Cómo se probó
- Servidor real contra el doble: gasto de abril sin mover saldo y vinculado; una compra con gasto no se re-vincula.
- Maqueta del POS: fecha de la compra, casilla marcada en abril y desmarcada hoy, sigue a la fecha, respeta lo que
  el usuario eligió, al editar carga lo guardado; viajan `afecta_saldo` e `ingreso_id`.
