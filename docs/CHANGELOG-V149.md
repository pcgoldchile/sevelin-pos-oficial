# v149 · Liquidación: una etiqueta, no una categoría (15-10-2026)

Cruza los dos repos. POS: `sql/97-etiqueta-liquidacion.sql`, `api/index.js`, `js/api.js`, `js/config.js`,
`js/productos.js`, `index.html`. Tienda (commit 713d82c): `supabase/43-etiqueta-liquidacion.sql`, página `/liquidacion`,
sello, menú, pie y sitemap. Las dos migraciones se aplicaron con la CLI el 15-10-2026 (primero la de la tienda).

## Qué pidió el dueño
"Quiero crear una categoría liquidación, ¿puede vivir un producto en liquidación y en una categoría aparte?" Ejemplo: la
funda Njoy Tech (#368), de sus padres, muy antigua, a $1.990; y otros productos fuera de temporada.

## Por qué no es una categoría
Cada producto tiene UNA categoría y la tienda lee ese texto (`categoria_web`). Pasarlo a "Liquidación" lo sacaría de la
suya. Se usó la etiqueta destacada que ya existía (Novedad / Tendencia / Oferta) con un cuarto valor: LIQUIDACION.

## Qué quedó
- **POS:** "🏷️ Liquidación" en la etiqueta destacada de la ficha y en la tabla de Productos. En la selección múltiple de
  Productos, botón "🏷️ Liquidación": marca a todos los seleccionados o, si ya estaban todos, se la quita
  (`POST /api/productos/etiqueta-lote`, solo admin). Una etiqueta por producto: marcar Liquidación reemplaza a otra.
- **Tienda:** sello rojo "🏷️ Liquidación" en la tarjeta y la ficha; página sevelin.cl/liquidacion con lo que tiene stock,
  el más barato primero; enlace en el menú (solo si hay alguno), en el pie y en el sitemap.
- No hay precio tachado: el dueño no tiene el precio anterior. Si lo quiere, se combina con la oferta con fechas que ya existe.

## Cómo se probó
- Servidor real del POS contra el doble de Supabase: marcar, quitar, etiqueta inventada (400), trabajador (403), sin ids.
- Maqueta del POS: el botón aparece solo en Productos y manda marcar o quitar según lo seleccionado.
- Maqueta de la tienda: /liquidacion con 2 productos marcados, el sello y los enlaces del menú y del pie. `tsc` y `eslint` limpios.
