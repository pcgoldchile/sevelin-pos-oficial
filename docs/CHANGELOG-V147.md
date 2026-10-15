# v147 · Editar Venta pregunta de quién es cada servicio (15-10-2026)

Sin migración. Cambia `js/historial.js` (modal Editar Venta) y `PUT /api/ventas/:id` en `api/index.js`.

## Qué pidió el dueño
"Falta una opción para vincular si el servicio era de Sevelin o para mis padres, ya que esto fue antes de la
actualización en el POS." Caso real: venta #272, Formateo de Celular $10.000, cobrada antes de la v143.

## Qué pasaba
- Finanzas → Mis padres solo deja corregir los servicios que **ya** están en el pozo. Uno cobrado antes de la v143
  nunca aparece ahí, así que no había cómo sumarlo.
- Falla escondida: Editar Venta no mandaba `es_servicio`. Al guardar cualquier venta, sus servicios quedaban como
  producto y **perdían el pozo** en silencio.

## Qué quedó
- Cada servicio en Editar Venta tiene una tercera línea: "¿Quién hizo el servicio?" con **Es mío (Sevelin)** o
  **De C. Patricio: va a su pozo**, y "Cuánto va a su pozo" (parte en lo cobrado; si hubo repuesto o IVA, se resta a mano).
- Solo viaja la elección que se tocó: editar otra cosa de la venta conserva el pozo como estaba.
- El servidor valida que vaya entre $1 y lo cobrado (con el descuento repartido) y deja la nota "Marcado al editar la venta".
- Un servicio se reconoce por la marca de la línea o por la ficha del producto: las 6 líneas viejas sin la marca se
  arreglan solas al editarlas.

## Cómo se probó
- Servidor real contra el doble de Supabase: marcar Patricio, editar sin tocar (conserva), monto mayor a lo cobrado
  (rechazo sin escribir nada), volver a "mío", y venta vieja sin `es_servicio` (ya no pierde el pozo).
- Maqueta del POS: el selector aparece solo en el servicio, el monto se muestra al elegir C. Patricio y al guardar
  viaja `pozo_de`/`pozo_monto`.
