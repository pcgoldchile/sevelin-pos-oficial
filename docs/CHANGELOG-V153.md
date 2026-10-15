# v153 · Quitar varias fotos de una vez y limpiar las fotos sueltas (15-10-2026)

Migración `sql/99-fotos-sueltas.sql` (aplicada con la CLI el 15-10-2026). Cambia `api/index.js`, `js/api.js`,
`js/productos.js` e `index.html`.

## Qué pidió el dueño
"Falta una opción que cuando agrego varias imágenes de golpe, una que diga no usar, y borrar. Me preocupa que se estén
guardando imágenes sueltas, o que no se usen."

## Qué había
Cada foto ya tenía su ✕ (desde v142 la quita del producto y la borra del almacenamiento), pero solo de a una. Revisión
del bucket `productos-imagenes` el 15-10-2026: 641 archivos (27 MB), 35 sueltos (834 kB), todos del 28-08 al 28-09-2026,
de fotos cambiadas o productos borrados antes de la v142. Desde la v142 no se generó ninguno. Ninguna tabla del POS ni
de la tienda los usa (revisados productos, ubicaciones y productos_web).

## Qué quedó
- **Galería de la ficha:** con 2 fotos o más, una casilla en cada foto, "Seleccionar todas" y el botón
  "🗑️ No usar: quitar y borrar N fotos". En un producto guardado salen del producto y se borran del almacenamiento si
  ningún otro producto las usa (`DELETE /api/productos/:id/imagenes`); en uno nuevo solo se sacan de la memoria.
- **Productos → "🧹 Fotos sin usar"** (solo admin): cuenta lo suelto y, con la clave del dueño, lo borra
  (`GET /api/productos/fotos-sueltas`, `POST /api/productos/fotos-sueltas/borrar`). La lista la arma
  `fotos_sueltas_productos()` (sql/99) en el momento de borrar; ignora lo subido en la última hora.
- Claude NO borró las 35: es un borrado sin vuelta atrás y lo hace el dueño con el botón.

## Cómo se probó
- Servidor real contra el doble: quitar varias (una que usa otro producto se quita pero no se borra del almacenamiento),
  lista vacía (400), contar, borrar sin clave (403), trabajador (403), borrar con clave.
- Maqueta del POS: casillas, barra, botón con el número, borrado y limpieza de la selección; el botón 🧹 con su ventana.
