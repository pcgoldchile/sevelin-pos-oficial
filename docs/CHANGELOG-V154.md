# v154 · Ver las fotos de la ficha en grande y eliminarlas desde ahí (16-10-2026)

Sin migración. Cambia `js/config.js`, `js/productos.js` y `css/styles.css`.

## Qué pidió el dueño
"Necesito una opción para agrandar o expandir, para ver los detalles bien de cada imagen, y tener la opción allí para
eliminar las fotos si deseo."

## Qué quedó
- **Clic en cualquier foto de la galería de la ficha** (Productos → editar → Fotos): se abre en grande, con flechas
  y ← → para pasar a las otras, el contador (2/7) y Esc o clic afuera para cerrar.
- Bajo la foto ampliada: **"⬇ Descargar"** y **"🗑️ Eliminar esta foto"**. Eliminar pide la misma confirmación de
  siempre (`quitarFotoProducto`, que la saca del producto y la borra del almacenamiento) y el visor sigue abierto en
  la foto siguiente. Si era la última, se cierra.
- La casilla, la ✕, ⬇ y las flechas ◀ ▶ de cada miniatura siguen igual. El arrastre para reordenar también.

## Cómo se hizo
Se reusó el visor que ya existía (`abrirVisorImagen` en `js/config.js`, el del carrito). Ahora acepta un 4º parámetro
opcional, `{ acciones: [{ texto, clase, alHacer(indice) }] }`. Si `alHacer` devuelve un arreglo, esa pasa a ser la
lista de fotos del visor. Con botones, la foto se achica para que quepan (`.visor-con-acciones`). Con una ventana de
confirmación abierta encima, el visor no toma las teclas.

## Probado
En la maqueta (`pos-maqueta`): ficha con 3 fotos → clic en la 2ª → visor "(2/3)" con los dos botones → Eliminar →
confirmación encima del visor (z-index 10200 sobre 10100) → `DELETE /api/productos/294/imagen` 200 → visor "(2/2)",
galería con 2 y aviso "Foto eliminada". Sin errores nuevos en la consola. Hechos `node --check` y los dos chequeos de
colisión. No se agregaron clases de Tailwind.
