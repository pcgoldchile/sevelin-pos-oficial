# v145 · Corregir un registro de compra ya recibido, con la clave del dueño (15-10-2026)

Sin migración. Publicado. (v144: hashtags de Facebook siempre separados por comas, ver el commit.)

## Qué pidió el dueño
"Necesito que de un registro de compra, con la clave de ADMIN, se puedan editar datos." Hasta ahora una compra ya
recibida solo se podía marcar Devuelta/Vendida o borrar; corregir el costo obligaba a borrar y volver a cargar (lo hizo
el 15-10-2026 con la capturadora HDMI, después de que Claude cargara mal el costo de la compra del 10-10).

## Qué quedó
- Ficha del producto → lista de compras: botón **✏️ Editar** en cada compra ya recibida (no en las por llegar, que
  tienen su propio editor, ni en las sin confirmar). Solo admin.
- Ventana "Corregir registro de compra": unidades, costo por unidad, fecha, devolución, proveedor, RUT, marketplace,
  N° de documento y nota. Al guardar pide la **clave del dueño** mostrando qué cambia.
- Servidor `PUT /api/ingresos/:id/corregir` (admin + `exigirPinAdmin`). Manda solo lo que cambia:
  - **Costo** → el registro, la capa PEPS de esa compra (lo que queda en stock sale al costo nuevo; lo ya vendido
    conserva su costo, y se avisa cuántas unidades eran) y la ficha si su costo era el de esa compra.
  - **Unidades** → el stock y la capa suben o bajan en la diferencia, nunca bajo lo ya vendido de esa capa ni con stock
    negativo, y queda en `ajustes_stock` con motivo `compra`.
  - La capa se reconoce por producto, unidades iniciales, costo y hora de creación (nacen juntas). Si no aparece, el
    costo se corrige solo en el registro (con aviso) y las unidades no se dejan cambiar (se usa "✏️ Corregir").
  - El gasto de Finanzas ligado no se toca: se avisa para revisarlo.

## Cómo se probó
22 pruebas del servidor (sin clave, clave mala, trabajador, costo con y sin unidades vendidas, subir y bajar unidades,
no bajar de lo vendido, sin capa, por llegar, fechas) y la ventana en la maqueta del POS. No probado en producción.
