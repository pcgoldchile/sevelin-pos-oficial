# v178 — Carga rápida de fotos y filtro de Fundas por modelo (23-10-2026)

Pedido del dueño: va a subir muchas fundas de celular (una foto = un producto) y no quiere escribir
"iPhone 15 Pro Max" en cada una. Antes recomendó cómo organizarlas (nombre, categoría) y preguntó si
valía la pena ponerles fondo blanco a las fotos — sí valía, y ya se procesaron las 22 de prueba con un
script aparte (`rembg`, corre en su computador, no sube fotos a ningún lado).

## Filtro de "Fundas" en la tienda (`api/index.js`, `sevelin-tienda/src/lib/filtros.ts`)

`CARACTERISTICAS_TIENDA` / `GRUPOS_FILTRO` no tenían ninguna entrada para Accesorios Móviles → Fundas:
un cliente que entraba ahí veía todo mezclado. Se agregó, pareja exacta en los dos repos:
- **Modelo** (`modelo_celular`): iPhone 11 a 16, varios Samsung y Xiaomi comunes. Un modelo que no esté
  en la lista igual se guarda y se muestra, al final del filtro (mismo comportamiento que el resto de
  los grupos).
- **Tipo** (`tipo_funda`): Transparente, Antigolpe con Anillo, Tipo Billetera (Librito), Silicona,
  Rígida, MagSafe.

Sin migración SQL: usa la columna `productos.caracteristicas` que ya existía (sql/103).

## "📸 Carga rápida de fotos" (`js/carga-rapida-fotos.js`)

Botón nuevo en Productos, junto a "📋 Carga masiva (pegar)". Para cuando cada foto es un producto
distinto:
1. Se eligen varias fotos de una vez y la categoría (queda "Fundas" preseleccionada si existe).
2. Después se va una foto a la vez: modelo, tipo (las casillas de arriba, según la categoría), color,
   precio, costo y stock. El nombre se arma solo: `Funda para {modelo} — {tipo} {color}`.
3. "💾 Guardar y seguir" crea el producto, le sube esa foto y pasa a la próxima. Precio, costo, stock y
   modelo quedan puestos para la siguiente foto (una tanda suele repetirlos); el color se limpia
   siempre. "⏭️ Saltar esta foto" la descarta sin crear nada.
4. Al terminar la cola, avisa cuántos quedaron creados y refresca el catálogo.

No duplica nada: reusa `cargarBitmapDeArchivo` / `dibujarYComprimirFoto` (fondo blanco cuadrado +
compresión a webp, igual que la ficha normal) y `API.productos.crear` / `subirImagen`.

## Probado

- `node --check` en `js/carga-rapida-fotos.js` y `api/index.js`; los dos chequeos de colisión (funciones
  e ids) salieron vacíos; `tsc --noEmit` sin errores en `filtros.ts`.
- Maqueta del POS: abrí el modal, elegí una foto de prueba (un cuadrado rojo generado en el momento,
  sin cámara real), lo completé (iPhone 15 Pro Max, color, precio, costo) y "Guardar y seguir" creó el
  producto — verificado con `API.productos.listar()`: nombre, categoría, `caracteristicas.modelo_celular`
  y la foto en webp quedaron bien. La maqueta no tiene cargada la categoría "Fundas" (catálogo de
  prueba reducido), así que se probó con otra categoría sin "Tipo": el selector de Tipo mostró
  correctamente "(esta categoría no tiene tipos)", sin romperse.
- Confirmado en la base real: "Fundas" existe como subcategoría de "Accesorios Móviles" (no hay que
  crear nada).
- Sin probar: elegir archivos de verdad desde el selector del sistema operativo (la maqueta no permite
  simular esa parte desde aquí) — es un `<input type="file" multiple>` estándar, mismo que ya usa el
  resto de la ficha de producto.
