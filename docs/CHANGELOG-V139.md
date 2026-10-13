# v139 · Textos para Facebook e Instagram guardados en el producto, armados desde la descripción (13-10-2026)

Migración `sql/95` aplicada. Publicado.

## Qué pidió el dueño
Que las descripciones para Facebook se generen **solo si el producto tiene descripción** ("si no, no se debe generar
nada inventado"), que queden guardadas, que al crear o editar un producto se puedan guardar la de Facebook y la de
Instagram, y que se carguen las que faltan. Ese día la IA (Gemini) andaba lenta.

## Qué quedó
- **`js/redes-texto.js`: arma los dos textos sin IA.** Lee la Descripción del producto (introducción, características
  ✅, "no incluye" ❌ e "importante" ⚠️) y la ordena en el formato de cada red. No redacta nada: cada línea sale como
  está en la ficha. Sin descripción devuelve vacío. El encabezado dice NUEVO / NUEVA / NUEVOS / NUEVAS según la primera
  palabra del nombre, y nunca "NUEVO" si el producto es reacondicionado (ahí agrega "♻️ Condición: reacondicionado").
  Los servicios llevan su propio bloque (sin envíos ni garantía de producto). Los hashtags salen de la marca, el nombre,
  la categoría y la ciudad. El bloque de retiro, WhatsApp y pagos es el mismo de `PROMPT_FACEBOOK`: si cambia allá, se
  cambia en este archivo.
- **Ficha del producto** (crear y editar): bloque plegado "📣 Textos para Facebook e Instagram" con un cuadro para cada
  red, "🧩 Armar desde la descripción" y "📋 Copiar". Se guardan con Guardar Producto (`facebook_texto`,
  `instagram_texto`). El botón de la IA para Facebook sigue; su resultado ahora también queda en ese cuadro.
- **Botón Facebook de la lista:** "🧩 Armar desde la ficha (sin IA)". Guarda el texto y, si el producto no tenía, el
  de Instagram.
- **Instagram:** pie de foto más corto (introducción recortada a una oración completa, hasta 6 características, 12
  hashtags separados por espacios), con tope de 2.200 letras.

## Decidido por Claude (por confirmar)
- El formato de Instagram: no había plantilla del dueño.
- No hay botón de IA para Instagram: se arma siempre desde la descripción.
- El texto no lleva precio (cambia y quedaría viejo).

## Probado
- 7 casos del servidor contra la base en memoria (`prueba-v139.js`) y las 41 de la v138.
- El generador contra las 136 descripciones reales del catálogo: las 136 producen texto; se revisaron a mano los 136
  encabezados y varios textos completos.
- Maqueta: sin descripción no arma nada; con descripción arma los dos y se guardan con el producto.
- **No probado:** pegar el texto en Facebook o Instagram de verdad.
