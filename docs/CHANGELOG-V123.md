# v123 — Total a cobrar, redondeo y utilidad en vivo en la caja (04-10-2026, noche)

Sesión en Sonnet · Medio para los iconos y en Opus para la caja. Pedido del dueño: ampliar la foto del producto en la
lista, un acceso directo a la ficha en la web y un ícono de archivar que se entienda; y en la caja, redondear la compra
("de $19.990 a $20.000 si pagan en efectivo"), escribir el total a cobrar para negociar rápido, y ver en vivo la utilidad
de la venta y el costo y margen de cada producto del carrito.

## Publicado

| Qué | Commit | Migración |
|---|---|---|
| Lista de Productos: foto ampliable, globo "ver en sevelin.cl", archivar con ojo tachado | POS `67f6a2d` | no |
| **v123** Total a cobrar, redondeo y utilidad en vivo | POS `65d9899` | `sql/86` (aplicada) |

## Lista de Productos (`67f6a2d`)

- La miniatura abre el visor grande (el mismo de la caja), con flechas si hay varias fotos.
- Globo azul: abre `sevelin.cl/productos/<SKU>` en otra pestaña. Solo en productos publicados y no archivados. Sin SKU
  usa el mismo nombre + id que arma la tienda (`slugDeRespaldo` en `sevelin-tienda/src/app/api/sync/producto/route.ts`):
  si esa regla cambia allá, cambia en `urlProductoWeb()` de `js/productos.js`.
- Archivar es un ojo tachado en ámbar; desarchivar, un ojo abierto.

## v123 · La caja

- **Total a cobrar** (campo nuevo junto al descuento). Es otra forma de escribir lo mismo: bajo la suma del carrito
  calcula el descuento en pesos; sobre la suma es redondeo hacia arriba. Se aplica mientras se escribe.
- **Redondear a:** botones con la centena y el mil más cercanos, hacia abajo y hacia arriba, cada uno con su diferencia
  ("$19.900 −$90", "$20.000 +$10"). "✕ Sin ajuste" vuelve a la suma de los productos.
- **Redondeo hacia arriba** (`sql/86`, `ventas.ajuste_redondeo`): lo cobrado sobre la suma de los ítems. Suma al total y
  a la utilidad. Tope de **$1.000**, validado en el servidor antes de tocar el stock: para cobrar más se cambia el precio
  o se agrega el servicio. No convive con un descuento. Si el carrito cambia, se quita solo.
- **Redondeo hacia abajo** = descuento en pesos de siempre, con las mismas reglas de margen: el trabajador sigue
  necesitando la clave del dueño para cobrar bajo el precio mínimo.
- **Utilidad en vivo** (solo admin): costo, utilidad y margen de la venta sobre el total a cobrar, con los colores de la
  lista de Productos (rojo bajo 15%, ámbar bajo 25%). Avisa si hay productos sin costo cargado.
- **Por producto** (solo admin): "Costo $5.000 · Margen 75% · Deja $14.990" bajo cada línea, sobre el precio que queda
  después de repartir el descuento.
- Los dos usan el **mayor costo conocido** (ficha, última compra o lotes), igual que la lista de Productos y el aviso de
  margen. La utilidad que queda guardada en la venta usa el costo de la ficha o el de los lotes: puede ser algo mayor que
  la que muestra la caja.
- El ticket, el detalle de la venta, las devoluciones y la edición de una venta entienden el redondeo ("Redondeo +$10").

## Arreglo encontrado de paso

La ventana de pago recibía la suma del carrito **sin el descuento**. Con un descuento de $2.000 sobre $4.000, el carrito
decía $2.000 y la ventana de pago pedía $4.000: el vuelto salía calculado de más y un pago mixto no cuadraba con el
total que guarda el servidor. La venta sí se guardaba con el total correcto. En la base hay 2 ventas con descuento de
232. Ahora el carrito, la ventana de pago y el registro usan un solo cálculo (`totalesCarrito()` en `js/pos.js`).

## Probado

- **Servidor, con una base simulada:** 42 comprobaciones. Venta normal, redondeo, tope, descuento y redondeo juntos
  (rechazado), valores raros, pago mixto, comisión de tarjeta sobre el total redondeado, "Por Pagar", trabajador con y
  sin clave, reintento del mismo cobro, devolución de una venta redondeada (devuelve lo cobrado), edición de venta, y el
  caso de que el código llegara antes que la migración (solo fallaría la venta con redondeo).
- **Maqueta:** el carrito como admin y como trabajador, el cobro completo en efectivo con redondeo y en mixto con
  descuento, el ticket, el detalle de la venta y la vista previa de la devolución.
- **Base real:** `sql/86` aplicada; 232 ventas, todas con redondeo 0.

**No probado:** una venta real con redondeo en producción, la pistola lectora con el cursor en el campo del total (si
se escanea ahí, el código se escribe como total; el tope y el aviso de margen lo frenan en casi todos los casos, y Enter
devuelve el cursor al buscador), ni el ticket impreso en la impresora de 58 mm.

## Decisiones tomadas por Claude (el dueño puede cambiarlas)

- Se permite redondear hacia arriba porque su ejemplo era $19.990 → $20.000. Tope de $1.000.
- El total escrito a mano hacia abajo queda como descuento en pesos, no como un dato aparte.
- La caja muestra la utilidad con el mayor costo conocido (más prudente), no con el de la ficha.
