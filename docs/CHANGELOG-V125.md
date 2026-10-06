# v125 — Carga masiva por copiar y pegar, "por llegar" y PEPS encendido de fábrica (06-10-2026, tarde)

Sesión en Opus. Pedido del dueño después de ver v124: que los productos nuevos se vean en sevelin.cl/por-llegar, que
diga "por llegar" y no "en camino", que el costo por lotes (PEPS) venga activado, y una carga masiva donde pega lo que
le respondió una IA a partir de la captura de su carrito.

## Publicado

| Qué | Commit | Migración |
|---|---|---|
| **v125** Carga masiva, textos "por llegar", PEPS encendido en productos nuevos | POS (ver `git log`) | no |
| Tarjeta de producto: "Reservar" en lo que está por llegar | tienda (ver `git log`) | no |

## Carga masiva (`js/carga-masiva.js`, `POST /api/productos/carga-masiva`)

- Productos → **"📋 Carga masiva (pegar)"**. Tres pasos en una ventana:
  1. **Copiar las instrucciones para la IA** (texto fijo, `CARGA_MASIVA_INSTRUCCIONES`). Se las da a cualquier IA con la
     captura del carrito. La IA responde una línea por producto: `Nombre | Cantidad | Costo por unidad | Enlace`.
  2. **Pegar la respuesta.** El lector acepta barras o tabuladores, tablas de Markdown, `$9.990`, `6.446,50` y una
     línea `PROVEEDOR: …`. Un `?` deja el campo vacío para llenarlo a mano.
  3. **Revisar.** Tres botones obligatorios: "Ya llegó", "Está por llegar" (con fecha estimada) o "Son por encargo".
     Si un nombre se parece a un producto del catálogo (comparte 2 palabras o más, y eso es la mitad del nombre más
     corto), la fila pide elegir: "Es un producto nuevo" o "Sumar a: …". No se puede cargar sin responder.
- El servidor valida todo antes de escribir, crea los productos nuevos (sin publicar, con PEPS) y registra cada compra
  con `registrarCompraDeProducto()`, lo mismo que el formulario de una compra. Hasta 60 filas. Solo admin.
- "Por encargo" crea el producto con `es_pedido_encargo`, sin stock ni compra.
- El precio de un producto que ya existe no se toca. El precio de venta de los nuevos puede quedar para después.
- Al terminar ofrece "Anotar el gasto" con el total, igual que una compra suelta.

## Lo demás

- **"Por llegar" en vez de "en camino"** en todo lo que se lee en pantalla (chip del encabezado, ventana, botones,
  avisos). En el código la columna sigue siendo `en_camino`.
- **PEPS encendido en productos nuevos.** Los que ya existían no cambian. El "Costo Unit." de la ficha ahora solo se
  bloquea cuando el producto ya tiene lotes; antes se bloqueaba apenas se marcaba la casilla.
- **CLAUDE.md:** sección "🚚 Por llegar" con el camino correcto para una IA.
- **Tienda:** en `/por-llegar` la tarjeta decía "Sin stock" apagado; ahora dice "Reservar" y lleva a la ficha.

## Datos

- Los 11 productos nuevos (#325 a #336, sin el #331 archivado) quedaron publicados, con PEPS y con categoría:
  4 subcategorías nuevas dentro de "Hogar y Estilo de Vida" (Organización del Hogar, Ventiladores, Balanzas, Oficina y
  Embalaje). sevelin.cl/por-llegar muestra 12 productos. Pendiente de revisar las categorías en la tabla.

## Cómo se probó

- Servidor: doble de Supabase en memoria, 32 de 32 (carga por llegar, ya llegó y encargo; rechazos por nombre repetido,
  cantidad, archivado, producto repetido, tope de filas, sin sesión y trabajador).
- Pantalla: maqueta. Texto pegado con tabla de Markdown y montos con `$`, parecidos detectados, bloqueo hasta responder,
  carga y resultado. Producto nuevo nace con PEPS marcado y costo editable.
- Tienda: solo revisión de tipos (`tsc`) y la página publicada. **No probado:** el clic de reserva en el celular, ni la
  carga masiva con una respuesta real de una IA sobre una captura (la respuesta puede venir con otro formato).
