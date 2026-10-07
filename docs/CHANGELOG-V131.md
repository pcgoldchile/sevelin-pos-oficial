# v131 — Marketplace aparte del vendedor, marca desde la IA y lo cargado va a "Por completar" (07-10-2026)

Pedido del dueño: al comprar en MercadoLibre anotaba "VENDEDOR / MERCADOLIBRE" en un solo campo. Quiere las dos cosas
separadas, que la marca se llene sola, y que lo cargado aparezca en "📋 Por completar".

## Qué cambió

- **`sql/88` (aplicada):** `ingresos_mercaderia.marketplace` (opcional). `proveedor` sigue siendo el vendedor o la tienda.
- **Carga masiva:** campo "Marketplace (opcional)" junto a "Vendedor o proveedor", con lista de sugerencias. Las
  instrucciones para la IA piden una línea `MARKETPLACE: nombre` y una quinta columna con la **marca**. Un proveedor
  escrito "VENDEDOR / MERCADOLIBRE" se separa solo.
- **Marca:** columna nueva en la tabla de revisión, editable. Solo se usa al crear el producto; la marca de uno que ya
  existe no se toca. "?" o "sin marca" quedan vacíos.
- **Compra de un producto (ficha):** el mismo campo Marketplace en "Más datos de la compra", y el historial muestra
  "vía MercadoLibre".
- **"Por completar":** regla nueva "Ficha sin terminar (sin foto ni descripción)" para productos sin publicar que
  tienen stock, están por llegar o son por encargo. Antes, un producto por llegar con precio puesto no aparecía en
  ninguna regla. Un producto completo que el dueño decidió no publicar NO aparece. El chip se actualiza al cargar.

## Cómo se probó

- Servidor (doble de la base): carga con marketplace y marca; sin marketplace la columna no viaja; "Por completar"
  lista los recién cargados y deja fuera uno completo sin publicar y uno viejo sin stock.
- Maqueta: lectura de `MARKETPLACE`, de la marca, del formato antiguo de 4 columnas y de "XYZ / MERCADOLIBRE".
- Con los datos reales de hoy la regla nueva suma 1 producto (#338 Audífonos Blik SOUL250).
- **No probado:** una respuesta real de una IA con el formato nuevo. **No hecho:** el informe de compras por
  marketplace (el dato ya se guarda; las compras anteriores no lo tienen).
