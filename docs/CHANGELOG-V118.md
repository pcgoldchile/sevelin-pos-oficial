# v118 y v119 — El stock se carga con compras y se corrige con clave; asistente para crear productos (04-10-2026)

Sesión en Opus · Extra. Cierra los pendientes #66 y #67. Continúa `docs/CHANGELOG-V116.md` (misma sesión).

## Publicado

| Versión | Qué cambió | Commit | Migración |
|---|---|---|---|
| **v118** | "Precio, stock y compras" en una sola tarjeta. El stock ya no se escribe: sube con una compra y se corrige con la clave del dueño. | POS `d6c59c2` | `sql/84` (aplicada, RLS activo) |
| **v119** | Asistente paso a paso para crear productos y complementos sugeridos por IA. | POS `b563c4f` | no |

Verificado en producción: `js/stock-ajuste.js` y `js/asistente-producto.js` servidos, los ids nuevos en `index.html`, y
las rutas `ajuste-stock` y `sugerir-complementos` responden 401 sin sesión (existen).

## v118 · Precio, stock y compras

**El pedido (dueño, 03-10-2026).** Unir "Compras de este producto" con el stock; que el stock se cargue con fecha de
compra, unidades, costo y precio de venta; y que cambiar el stock actual pida permiso de admin y pregunte por qué.

**Lo que cambió**

- **La ficha ya no cambia el stock.** `PUT /api/productos/:id` ignora el campo. Antes el formulario mandaba el stock que
  tenía a la vista al abrirse: una venta hecha con la ficha abierta se deshacía al guardar. El campo "Stock actual" es de
  solo lectura.
- **Una compra carga el stock.** Fecha, unidades, costo por unidad y **precio de venta**. El precio de venta parte del
  precio actual; si se cambia, el servidor actualiza el producto con las mismas reglas de la ficha (tiene que quedar
  sobre la oferta web y sobre el precio mayorista) y lo valida antes de registrar nada. El costo de la ficha se sigue
  rellenando solo si estaba en $0 (regla anterior, sin cambios).
- **"Guardar Producto" registra la compra escrita.** Si hay unidades escritas, el botón dice "Guardar y registrar
  compra". Sirve igual en un producto nuevo: se crea y se registra la compra de una vez.
- **Lo que no hace falta en cada compra queda plegado** en "Más datos de la compra": proveedor, factura, devolución,
  mercadería en camino.
- **"Corregir" pide la clave del dueño, cada vez** (`POST /api/productos/:id/ajuste-stock`, la clave se valida en el
  servidor con el mismo freno de intentos del login). Se escribe cuántas hay de verdad y se elige qué pasó:

  | Hay menos | Qué hace |
  |---|---|
  | Se dañó | Merma: pérdida al costo en Finanzas (no sale de la caja) |
  | Se perdió o lo robaron | Merma: pérdida al costo en Finanzas |
  | Estaba mal contado | Solo corrige el número |

  | Hay más | Qué hace |
  |---|---|
  | Las compré | Queda como compra (fecha y costo) y ofrece anotar el gasto |
  | Estaba mal contado | Solo corrige el número |

- **Si el stock cambió mientras se corregía** (una venta), el servidor rechaza y dice el número actual.
- **Cada corrección queda registrada** en la tabla nueva `ajustes_stock` (`sql/84`) y se ve en la ficha.
- **El gasto no se anota solo.** Un gasto lleva factura, IVA y medio de pago: después de una compra aparece "¿Ya anotaste
  el gasto en Finanzas?" con un botón que abre "Registrar Gasto" ya llenado (monto, descripción, clasificación
  "Mercadería").
- **Un solo núcleo.** `registrarMerma` y `registrarCompraDeProducto` los comparten el módulo de mermas, el formulario de
  compras y la corrección. Con costo por lotes (PEPS) la merma ahora consume las capas más antiguas; antes bajaba el
  stock sin tocarlas.
- **Arreglo encontrado al leer el código:** una oferta web ya terminada impedía guardar la ficha del producto (el
  formulario la manda siempre). Ahora una oferta terminada y sin tocar no bloquea. Encender una sigue pidiendo fecha.
- Los avisos del chip "Ofertas" (v116) usaban tipos de aviso sin color; corregido.

**Caminos que siguen cambiando stock sin esta clave** (ya existían y no se tocaron): registrar una compra, "Ya llegó",
Finanzas → Mermas (solo admin), la importación masiva (ya pide la clave) y las ventas.

**Probado**

- 38 comprobaciones contra el servidor real con una base simulada: la ficha no cambia el stock, compra con precio de
  venta (y sus rechazos), permisos (sin clave, clave equivocada, trabajador), los cinco motivos, stock cambiado mientras
  tanto, números inválidos, stock ilimitado, costo por lotes y el módulo de mermas.
- En la maqueta: compra con precio de venta, "Anotar el gasto" abre el formulario llenado, corrección con clave
  equivocada y correcta, producto nuevo con compra, "Guardar y registrar compra".
- **No probado:** una corrección real en producción (pide la clave del dueño). Sin capturas: el panel estaba oculto.

**Dato para revisar (pendiente #68).** Los 2 productos con costo por lotes tienen el stock descuadrado con sus capas:
Balanza Bluetooth (stock 0, 20 unidades en capas; el 0 fue un conteo del dueño) y Cable Audio Auxiliar 2 m (stock 8, sin
capas). No se tocó ningún dato.

## v119 · Asistente para crear productos

**El pedido.** "Me cansa mucho ver todas las opciones a la vez": un proceso paso a paso para crear, manteniendo la ficha
completa para editar.

- **Entrada:** el popup "Nuevo producto" suma "🪄 Paso a paso con IA (recomendado)".
- **Es la misma ficha, una sección a la vez** (clase `modo-guiado`, `js/asistente-producto.js`). No hay campos
  duplicados y todo lo que ya funcionaba es el mismo código.
- **Seis pasos:** 1) ¿Qué producto es? (pegar la información y generar la ficha con IA: nombre, descripción, marca,
  categoría, condición y SEO, que ya existían); 2) Precio y stock; 3) Fotos; 4) Categoría, condición y garantía;
  5) Tienda web y complementos; 6) Medidas, envío y dónde está guardado.
- **Guarda mientras avanza.** Al pasar del paso 1 el producto queda como borrador sin publicar; cada "Siguiente" guarda
  y registra la compra escrita. Si se abandona, queda en Borradores con lo avanzado.
- **"Terminar y guardar"** es el guardado normal: deja de ser borrador y se publica si la casilla está marcada.
- **"Ver la ficha completa"** sale del asistente sin perder nada. Editar un producto abre siempre la ficha completa.
- **Complementos con IA** (`POST /api/productos/:id/sugerir-complementos`): la IA elige hasta 6 entre los productos
  publicados y con stock. El servidor descarta cualquier id que no estuviera en la lista. Propone; cada uno se agrega
  con su clic. Los sugeridos por categoría (v113) siguen ahí.

**Probado**

- En la maqueta, de punta a punta: los 6 pasos, la ficha con IA, la compra (stock 6, precio $19.990), complementos,
  volver atrás, terminar (producto publicado, ya no borrador), salir a la ficha completa y abandonar (queda borrador).
- Servidor de complementos con Gemini simulado: 7 comprobaciones (ids inventados descartados, solo publicados con stock,
  el prompt no manda costos, permisos, Google caído).
- **No probado:** la respuesta real de Gemini eligiendo complementos (calidad de lo que sugiere), ni el rechazo por
  nombre duplicado dentro del asistente (la maqueta no lo simula; usa el mismo aviso del guardado normal).
