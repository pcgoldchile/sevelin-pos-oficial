# v126 — Reservas de "por llegar" que funcionan, Categorías rehechas y gasto a elección en la carga masiva (06-10-2026, noche)

Sesión en Opus · Extra. El dueño probó el checkout con un producto por llegar y vio que decía "retira hoy". Al
revisarlo apareció algo peor: **reservar un producto por llegar nunca había funcionado de punta a punta**.

## Publicado

| Qué | Commit | Migración |
|---|---|---|
| **v126** POS: reservas (servidor), PEPS en ventas web | POS `314512c` | `sql/87` (aplicada) |
| **v126** POS: Categorías rehechas, gasto a elección en la carga masiva, sin "Carga por Comando" | POS (ver `git log`) | no |
| Tienda: reserva completa, avisos por producto, orden y buscador | tienda `13ee6f3` | no |

## El hallazgo: la reserva estaba rota en tres lugares

1. **Carrito** (`carrito-context.tsx`): el tope era solo `stock_web`. Un producto por llegar (stock 0) entraba con
   cantidad 0 y $0. Es lo que se ve en la captura del dueño.
2. **Checkout** (`POST /api/checkout`): `cantidad > stock_web` rechazaba cualquier reserva por "sin stock".
3. **POS** (`/api/interno/ajustar-stock`): si hubiera pasado, el descuento fallaba después de cobrar.

La ficha decía "Reservar — pago 100%" desde el 12-09-2026, pero nadie pudo pagar una. No se cobró nada mal.

## Cómo funciona ahora

- **Tope único** (`sevelin-tienda/src/lib/por-llegar.ts`): lo que hay en la tienda o, si no queda nada y viene en
  camino, las unidades por llegar. Lo usan ficha, tarjeta, carrito, `/api/carrito/precios` y el checkout.
- **Al pagar**, la línea viaja al POS con `reserva: true`. `ajustar_stock_web()` (**sql/87**) baja `stock_por_llegar`
  y sube `productos.reservado_web`, en la misma transacción que el descuento del resto del pedido. El stock no se toca.
- **El comprador** queda en la lista de espera como `RESERVA` con su número de pedido: recibe "llegó tu reserva"
  cuando el dueño aprieta "Ya llegó". Ese correo ya existía; nadie lo disparaba.
- **"📦 Ya llegó"** (`PUT /api/ingresos/:id/recibida`): las unidades reservadas no entran al stock ni a las capas, y
  el POS avisa "N unidades ya estaban vendidas en sevelin.cl: apártalas".
- **Cancelar** un pedido web libera la reserva que todavía no llega, se marque o no "reponer stock".
- **Pedidos Web** muestra la etiqueta "🚚 Por llegar" en la línea.

## Los textos que pidió el dueño (tienda)

- El checkout ya no dice "retira hoy" ni "sale hoy" por lo que está por llegar. Aparece un recuadro que **nombra el
  producto**, su fecha estimada y que se avisa por correo cuando esté listo para retiro. Si hay otros productos que sí
  están: "mientras tanto puedes pasar a buscar tus otros productos".
- Con todo por llegar no se pregunta el día de retiro.
- **Decisión de Claude, falta que el dueño confirme:** con despacho, el pedido sale completo cuando llega lo que
  falta (un solo viaje). Quien quiera antes lo que ya está, elige retiro o escribe por WhatsApp.
- Carrito, correo de confirmación y página del pedido también dicen qué está por llegar.

## Lo demás de la tienda

- `/por-llegar`: ordenar (llega antes, precio, nombre), filtrar por rubro y por "quedan unidades hoy", y la fecha
  estimada bajo cada tarjeta.
- `/pedidos-por-encargo`: ordenar por precio o nombre.
- **Buscador:** con texto busca en todo lo publicado, también encargos y por llegar (antes solo lo que tenía stock:
  "balanza" no mostraba la de encargo). La tarjeta dice "Por encargo" o "Por llegar". Navegando por categoría sigue
  saliendo solo lo que se puede llevar hoy.

## PEPS en las ventas web (encontrado de paso)

`/api/interno/ajustar-stock` nunca descontó los productos con lotes: una venta web de uno de ellos no bajaba el stock ni
consumía capas. Con 2 productos con lotes no se notaba; desde v125 todo producto nuevo nace con lotes. Ahora
`registrar-venta-web` consume las capas antes de totalizar (costo real, igual que la caja) y guarda el libro de consumo.

## Categorías (Página Web → Categorías), rehecha

- `js/categorias-web.js` (nuevo; salió de `pagina-web.js`). Dos columnas: el árbol con **cuántos productos tiene cada
  categoría**, buscador y los grupos "Todos" y "Sin categoría"; a la derecha, los productos de lo elegido.
- Se ordena arrastrando (o ▲▼ en el celular). Un producto se mueve arrastrándolo sobre una categoría, o marcando
  varios y "Mover a". Doble clic renombra. "Ver en sevelin.cl" abre esa categoría en la tienda.
- **Lo que arregla de fondo:** la tienda lee el *texto* del producto (`categoria_web`, `subcategoria_web`), no la tabla.
  Antes renombrar una categoría dejaba el nombre viejo en la tienda, y eliminarla dejaba los productos apareciendo bajo
  el nombre borrado. Ahora renombrar, eliminar y asignar reescriben ese texto, producto por producto (para que la
  sincronización no pierda ninguno). Eliminar pregunta a dónde van los productos.
- Endpoints nuevos: `PUT /api/productos/categorias/asignar` y `/orden`. `DELETE` acepta `mover_a`.

## Carga masiva: el gasto se elige

Pedido del dueño a mitad de la sesión. Antes de cargar hay que elegir: **"Sí, sumar a gastos de mercadería"** (al
terminar se abre el gasto ya llenado) o **"No registrar gasto por estos productos"**. Nunca se anota solo.

## Se quitó

"Carga por Comando / Tiendanube" completa: el botón, sus dos ventanas y el lector (`js/tiendanube.js`, 564 líneas). El
selector de "Nuevo producto" quedó en `js/alta-producto.js`. La importación por archivo CSV/Excel sigue.

## Cómo se probó

- POS, doble de Supabase: reservas y PEPS web 21/21, categorías 22/22, carga masiva y compra por llegar 32/32.
- `ajustar_stock_web` contra la base real, en una transacción que se deshace: 5 comprobaciones, nada guardado.
- Tienda, maqueta con pago y POS falsos (se agregaron a `scripts/maqueta-tienda.mjs`): reserva de punta a punta 21/21,
  y a mano el carrito, los textos del checkout, `/por-llegar`, encargos y el buscador.
- **No probado:** un pago real con Khipu de una reserva, el correo real de "llegó tu reserva", el celular, y el
  arrastre con el mouse (se probó disparando los eventos).

## Queda

- El dueño confirma la regla de despacho con productos por llegar.
- La auditoría semanal de precios (#65) sigue sin correr.
