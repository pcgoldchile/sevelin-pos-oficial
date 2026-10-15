# v150 + v151 · Borradores que entran a la web y nota interna del producto (15-10-2026)

## v150 · Un borrador terminado entra a la tienda (commit 86d3440)
El dueño publicaba borradores de la Bodega del taller y quedaban fuera de sevelin.cl. Un borrador se guarda siempre
sin publicar (`crearBorradorProducto`), y la ficha lo abría con esa casilla desmarcada. Ahora abre "Publicar en la web"
marcado, igual que un producto nuevo (`abrirModalProducto` en `js/productos.js`); sigue siendo un clic desmarcarlo.
Ese día, con su OK, se publicaron #355, #361, #337, #338, #362, #363, #366 y #367 (las pilas con la categoría
Energía Portátil → Pilas y Energía Solar). La masilla #364 quedó por encargo a $29.990 (costo $23.900).

## v151 · Nota interna (sql/98)
La masilla llevaba "(insumo del taller)" en el nombre y eso salía en la tienda. Columna `productos.nota_interna`
(hasta 500 letras), campo "📝 Nota interna (solo el POS, no sale en la web)" en la ficha bajo "¿De quién es?", y un 📝
con la nota bajo el nombre en la tabla de Productos. La tienda no la recibe: `/api/sync/producto` copia campo por campo.
La migración dejó la nota de la masilla escrita.

## Cómo se probó
- v150: maqueta del POS. Un borrador abre marcado; un producto ocultado a propósito sigue oculto; uno nuevo, marcado.
- v151: servidor real contra el doble de Supabase (conserva la nota si no viaja, recorta espacios, corta en 500,
  vacía = null). Maqueta: la ficha la carga y la manda, un producto nuevo parte vacío, la tabla la muestra escapada.
