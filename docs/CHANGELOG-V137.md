# v137 · La caja obliga a elegir si un servicio escrito a mano va al pozo (13-10-2026)

## Qué pasó
El dueño cobró "Limpieza de Virus Celulares Universal" ($5.000, escrito a mano y marcado como servicio; venta #266) y
dijo que la caja no le preguntó si era para él o para el pozo de C. Patricio. La venta quedó sin pozo.

La pregunta "Antes de cobrar" sí se abría (reproducido en la maqueta), pero para un servicio escrito a mano venía con
**"No va" ya marcado** y, 150 ms después, el foco pasaba solo al botón "Continuar al pago". Un Enter la cerraba sin
que nadie alcanzara a verla. No se pudo confirmar que eso fue exactamente lo que pasó en su caja: es la única forma
encontrada en que la venta sale sin pozo y sin que se vea la ventana.

## Qué cambió (`js/acuerdo-padres.js`)
- Un servicio **escrito a mano** (sin ficha) ya no trae ninguna opción marcada. Sale en rojo "Elige una opción: ¿lo
  hizo C. Patricio (va a su pozo) o es tuyo?" y "Continuar al pago" queda apagado hasta elegir. Ni el botón ni el
  Enter dejan pasar (`lineaPozoObligatoria`, `lineaPozoSinResponder`, `actualizarBotonAntesDeCobrar`).
- El foco va a la primera línea sin responder, no al botón de seguir.
- La opción "No va" ahora dice "No va (es mío)".
- Sin cambios: un servicio del catálogo con la casilla "Lo hace C. Patricio" sigue viniendo en "Todo" y deja seguir
  con Enter; un servicio del catálogo sin esa casilla y un producto normal no preguntan nada. El servidor no cambió.

## Probado
En la maqueta, en pantalla: la venta del dueño repetida (sin opción marcada, botón apagado, Enter no pasa; con "Todo"
muestra "Al pozo: $5.000", abre el pago y la línea viaja con `pozo.modo = TODO`). Y cinco casos por consola en la
misma página: producto normal, servicio del catálogo sin casilla, con casilla, mezcla de uno a mano con uno con
casilla, y un producto "de los dos" después de un cobro con el botón apagado.

## Para el dueño
- La venta #266 se corrige en Finanzas → Mis padres → "Otros servicios del mes que no fueron al pozo" → "Sumar al
  pozo". El Historial de Ventas no edita el pozo.
- "De mis padres" es para la mercadería que entregaron sus padres, no para el pozo.
- Ningún servicio del catálogo tiene la casilla "Lo hace C. Patricio" (43 servicios, 0 marcados) y "Limpieza de
  virus" no existe como producto.
