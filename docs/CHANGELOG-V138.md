# v138 · La mercadería de los padres entra sin compra, con costo por confirmar, y se cuenta a costo (13-10-2026)

Migración `sql/94` aplicada. Publicado.

## Qué pidió el dueño
La mercadería de sus padres pasó a ser suya: se la entregan **a costo** y él les paga hasta $3.000.000 (la idea es
$1.000.000 por semana, pero cada semana mira en Finanzas si puede o les da menos). Tres problemas:
- Al cargarla quedaba como **compra**, y no lo es ("es como un intercambio").
- Sus padres no tienen el costo ni el stock precisos: los pone **al ojo** y los va corrigiendo, pero el costo se le
  **congelaba**. Causa: los productos nuevos nacen con el costo por lotes (PEPS) y, con capas vivas, la ficha bloquea
  el campo Costo.
- Quiere saber, al terminar de contar, si toda esa mercadería **a costo** vale más o menos que los $3.000.000.

Y una duda: vender un producto de sus padres, ¿va al pozo de C. Patricio? **No.** El pozo es solo de servicios; un
producto "De mis padres" es ganancia suya (precio menos costo), como cualquier otro. Ya era así; no cambió.

## Qué quedó
- **Ficha del producto.** Si "¿De quién es?" dice de mis padres o de los dos, aparecen dos casillas:
  - "⏳ El costo y el stock son al ojo, por confirmar" (`productos.costo_provisorio`). Con eso marcado el campo Costo
    no se bloquea, y al guardar el costo se copia a las capas vivas (`ponerCostoEnCapasVivas`): lo que queda en stock
    pasa a costar lo nuevo. Al desmarcarla (costo confirmado) queda ese costo y vuelve el PEPS normal.
  - En "Cargar stock": "🤝 Me la entregaron mis padres: no es una compra". Sube el stock y crea su capa, pero **no deja
    fila en `ingresos_mercaderia`** (no sale en el informe de compras ni pide gasto). Queda en `ajustes_stock` con el
    motivo nuevo `padres`. Sin costo escrito entra al costo de la ficha; con otro costo y la marca "al ojo", ese pasa
    a ser el costo del producto.
- **Carga masiva.** Cuarta opción, "🤝 Me los entregaron mis padres": los nuevos nacen marcados "De mis padres" y con
  el costo por confirmar; sin compra ni gasto. Un producto "mío" con stock que recibe unidades de ellos pasa a "de los
  dos" (la caja pregunta de quién es cada unidad).
- **Finanzas → Mis padres.** La cuenta va **a costo** (`mercaderia.a_costo` en `GET /api/padres/resumen`):
  recibido = lo que queda en stock + lo ya vendido, las dos cosas al costo que la ficha tiene **hoy** (corregir un
  costo arregla la cuenta completa). Tarjetas: recibido a costo, diferencia contra el tope, pagado y vendido al precio
  de venta. Tabla producto por producto, con la marca "⏳ al ojo". El aviso viejo (vendido al precio de venta contra
  los $3.000.000) se reemplazó por este; el dato de lo vendido se sigue mostrando.

## Lo que no hace (decidido por Claude, por confirmar)
- **Lo ya vendido con un costo al ojo no se recalcula en Utilidades.** Si vendió 5 a costo $3.000 y después confirma
  $2.000, Utilidades sigue con $3.000 en esas 5. La cuenta de Mis padres sí usa el costo corregido.
- De un producto "de los dos" solo se cuentan las unidades vendidas como de ellos: de su stock no se sabe cuántas son
  de quién.
- Lo dañado o perdido no se cuenta como recibido (salió del stock sin venderse).
- Corregir el stock a mano sigue pidiendo la clave ("✏️ Corregir"), regla suya del 03-10-2026.

## Probado
- Servidor real contra la base en memoria: 41 casos (`prueba-v138.js`): entrega sin compra, costo al ojo que cambia
  ficha y capas, confirmar el costo, PEPS normal después, producto "mío" que pasa a "de los dos", rechazos, compra
  normal intacta, carga masiva y el resumen a costo con una devolución.
- Maqueta en el navegador: la ficha (casillas, botón, stock 15 → 20 sin compra, lista de correcciones), la carga
  masiva y el panel Mis padres. Leído del DOM: las capturas de pantalla no salieron porque la ventana estaba oculta.
- **No probado:** en la caja real ni en el celular.
