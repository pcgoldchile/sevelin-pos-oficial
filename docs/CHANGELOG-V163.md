# v163 — "¿De dónde vino el cliente?" a la vista en el cobro (19-10-2026)

Pedido del dueño: *"no me sale en el pago el origen del cliente, tipo si vino de fb, de la calle… debería estar para
recolectar información"*.

- El dato existía desde v148 (sql/96), pero solo como lista "¿De dónde vino? (opcional)" en el carrito: en **0 de 26
  ventas** del 15 al 19-10-2026 quedó anotado.
- Ahora el modal **Confirmar Pago** muestra los 10 orígenes como botones de un toque, debajo del total
  (`#pagoVinoBox`, `renderOrigenPago()` / `elegirOrigenPago()` en `js/pago.js`). Escriben en el mismo
  `#posOrigenCliente` del carrito, que es lo que se guarda en `ventas.origen_cliente`; tocar el marcado lo borra.
  Sigue siendo opcional: no bloquea el cobro.
- Solo aparece en el cobro de una venta nueva (`pedirOrigen: true` en `abrirModalPago()`), no al cobrar una orden
  pendiente del historial.
- Ojo con el nombre: el modal ya tenía un `#pagoOrigenBox` que es el **origen del pago** (presencial / transferencia /
  pasarela). Por eso el nuevo se llama `pagoVino*`.

Probado en la maqueta: el recuadro aparece en el cobro, el botón queda marcado y el `<select>` del carrito toma el
valor (`MARKETPLACE`). Chequeos de funciones e ids duplicados vacíos.

También el 19-10-2026, por SQL con el OK del dueño: **Cambio de pantalla (#275)** pasa de "desde $30.000" a
**"desde $25.000"** (precio y meta descripción). La descripción todavía dice "en Samsung, Motorola y Vivo parte en
$30.000": no se tocó porque puede seguir siendo cierto por marca.
