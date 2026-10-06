# v127 — Sin la palabra "Genérica" en las fichas, y categoría y complementos con IA desde la ficha (06-10-2026)

Pedido del dueño al generar la ficha del Zapatero: la IA lo tituló "Genérica Perchero Colgador…" y la descripción
partía con "El Genérica Perchero…". "Queda re mal y poco estético."

## Qué cambió

- **"Genérica" es solo un dato del campo Marca.** No va en el nombre, la descripción, el texto de Facebook ni el SEO.
  - El prompt ya no le manda "Marca: Genérica" a la IA y trae una regla que lo prohíbe (`REGLA_SIN_GENERICA`).
  - Además el servidor la quita de lo que la IA devuelve (`sinPalabraGenerica()` en `api/index.js`), porque los modelos
    livianos la repiten igual. Vale por los dos caminos: generar por API y pegar la respuesta a mano.
  - Una viñeta que era solo "Marca: Genérica" desaparece entera.
- **Ventana "Ficha generada": dos casillas nuevas**, junto a la del SEO:
  - "Elegir también la categoría y subcategoría con IA": viene marcada si el producto no tiene categoría. La deja
    puesta en la ficha; se guarda con el producto.
  - "Agregar también Complementa tu compra con IA": viene marcada si el producto no tiene complementos. Los agrega de
    una vez a la tarjeta (se guardan por su ruta, como siempre) y se pueden quitar. Necesita un producto ya guardado.

## Cómo se probó

- `sinPalabraGenerica`: 13 de 13 casos (al inicio, en medio, "de marca genérica", plural, sin tilde, viñetas).
- Maqueta: estado de las casillas con y sin categoría, producto nuevo, y al aplicar se llama a la IA de categoría y de
  complementos y quedan puestos.
- **No probado:** una ficha real generada por Gemini después del cambio. Las fichas que ya están guardadas con la
  palabra "Genérica" no se tocaron.
