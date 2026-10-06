# v124 — "¿Ya llegó o viene en camino?" a la vista en la compra (06-10-2026)

Sesión en Opus. Partió por un error: el 05-10 el dueño pidió (en Haiku 4.5) agregar 10 productos comprados en
MercadoLibre y dejarlos "por llegar". Esa sesión escribió directo en la base: les cargó el stock como si ya estuvieran,
dejó el costo en $0, puso el costo como precio de venta y no registró ninguna compra. El gasto sí quedó anotado (#29).
El dueño pidió corregirlo y que la opción "por llegar" sea más intuitiva en el POS.

## Publicado

| Qué | Commit | Migración |
|---|---|---|
| **v124** Dos botones "ya llegó / viene en camino" en la compra, aviso de publicación y "llegan N" en la lista | POS `84377c5` | no |

## La pantalla (v124)

- **Antes:** "🚚 Todavía no llega" era una casilla dentro del plegable "Más datos de la compra". No se veía.
- **Ahora:** bajo los cuatro campos de la compra, la pregunta **"¿Ya tienes esta mercadería en la tienda?"** con dos
  botones: "✅ Sí, ya llegó" (suma stock) y "🚚 No, viene en camino" (no suma). La casilla `#prodPorLlegar` sigue siendo
  el dato, oculta: la mueven los botones, y el resto del código la lee igual que antes.
- **En camino:** pide la fecha estimada y cuántas vienen (el número sigue a "Unidades" mientras no se escriba a mano), y
  dice ahí mismo si el producto **se verá en sevelin.cl**. Si no está publicado, botón "🌐 Publicarlo en la web".
- **El servidor** (`POST /api/productos/:id/compras`) acepta `publicar_web: true`: una compra en camino deja el producto
  publicado en el mismo guardado. No publica un archivado ni una compra que ya llegó.
- El botón dice "🚚 Registrar compra en camino".
- **Lista de Productos:** bajo el stock, "🚚 llegan 30 · 08-10" (`badgeEnCamino()`).
- El aviso "stock en 0: no va a aparecer en sevelin.cl" ya no sale en productos por llegar o por encargo (era falso:
  la tienda sí los muestra).
- La ficha ya no apaga "por llegar" mientras quede una compra en camino de ese producto (`tieneCompraEnCamino()`):
  apagarlo hacía que la tienda avisara "ya llegó" por correo. Se apaga con "📦 Ya llegó".

## Datos corregidos en la base (con OK del dueño, por SQL)

- Productos **#325 a #334**: stock 0, costo de la compra en la ficha, precio de venta que dio el dueño, y 12 compras
  en `ingresos_mercaderia` con `en_camino = true`, `compra_id = 29`, llegada estimada 08-10-2026.
- Productos nuevos por unidad: **#335** Cinta de embalaje (Unidad), 6 u., $2.990, y **#336** Rollo térmico (Unidad),
  10 u., $1.490. Un pack de cada uno se abre; en los packs (#328 y #326) quedan 2. Los precios por unidad los puso
  Claude y el dueño todavía no los confirma.
- **Raqueta:** la Dropmaxi #331 era la misma que la #95. La compra en camino (10 u.) pasó a la #95 y la #331 se archivó.
  La #95 decía stock 3: 2 malas (merma "POR DEVOLVER", $4.638, gasto #30) y 1 regalada (merma, $2.319, gasto #31).
  Son las dos primeras filas de la tabla `mermas`.
- Las unidades suman 99 (el resumen de MercadoLibre decía 101; el dueño confirmó la lista de 99).

## Cómo se probó

- Servidor: doble de Supabase en memoria + `app.listen(0)`, 13 de 13 casos (no suma stock, queda por llegar, publica solo
  si se pide, no publica un archivado ni una compra que ya llegó, rechaza sin sesión).
- Pantalla: maqueta (`pos-maqueta`): los dos botones, el aviso de publicación, el envío al servidor y el "llegan N" de
  la lista. Sin errores de consola.
- Producción: los tres archivos nuevos ya se sirven en `sevelin-pos-oficial.vercel.app`; la raqueta #95 se ve "Por
  llegar" con "Reservar" en sevelin.cl.
- **No probado:** el flujo en el celular y el clic real del dueño en producción.

## Trampas encontradas

- **El webhook de la tienda puede llegar en desorden.** Tres `UPDATE` seguidos al mismo producto dejaron la tienda con
  un estado intermedio (la raqueta quedó sin "por llegar"). Se arregla tocando la fila otra vez. Después de varios
  cambios seguidos a un producto por SQL, revisar `productos_web` en la base de la tienda.
- **Cualquier `UPDATE` a `productos` por SQL sincroniza con la tienda** (`trg_sync_tienda`): no hace falta pasar por la API.
- **La auditoría semanal de precios no corrió sola:** partió el lunes a las 21:07 y se quedó detenida en su primer
  comando de consola, esperando un permiso. No dejó informe.
