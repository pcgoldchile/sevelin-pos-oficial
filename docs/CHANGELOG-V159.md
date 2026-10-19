# v159 — Filtros de la tienda (18-10-2026)

Pedido del dueño, con una captura de sevelin.cl/productos?categoria=Monitores: *"falta un tipo filtro aquí, por
ejemplo marcar la casilla si incluye: HDMI, VGA, parlantes; también deben haber filtros para otros productos"*.
Eligió **todo de una vez**, sumar "Trae cable HDMI" y "VESA", que la IA rellene las casillas con la descripción y
construirlo sin maqueta previa.

## Por qué las casillas se marcan y no se leen del texto

Antes de construir se probó sacar "tiene HDMI / VGA / parlantes" buscando palabras en las descripciones de los 16
monitores. Salió mal: el Caixun 24" de oficina aparecía **sin** HDMI (la ficha no lo nombraba; el dueño ya la
corrigió) y el Samsung 22" VGA/DVI aparecía **con** HDMI y parlantes (la ficha dice que NO los trae). Un filtro que
miente hace más daño que no tener filtro. Por eso cada producto guarda sus casillas marcadas.

## Qué quedó

**Base (las dos, aplicadas el 18-10-2026):**
- POS `sql/103`: `productos.caracteristicas jsonb` (`{"entradas": ["HDMI", "VGA"]}`), objeto y ≤ 4 KB.
- Tienda `supabase/44`: `productos_web.caracteristicas` y `productos_web.condicion` (nuevo/reacondicionado, que antes
  no viajaba). Llegan con el trigger de siempre (`trg_sync_tienda` → `/api/sync/producto`).

**POS:**
- `CARACTERISTICAS_TIENDA` en `api/index.js`: qué grupos y valores tiene cada categoría (los de la categoría valen
  para todas sus subcategorías; las subcategorías suman los suyos). `multiple` dice si un producto puede tener varios
  (puertos) o uno solo (tamaño). Hoy: Monitores, Tarjetas de Video, Fuentes, RAM, Placas, Gabinetes, Coolers, Cables,
  Cargadores, Energía Portátil (+ pilas), Almacenamiento, Periféricos (+ mandos), Audio y Computadores.
- `sanearProducto()` limpia lo que llega: solo grupos y valores del esquema para la categoría que se guarda.
- `GET /api/productos/caracteristicas-esquema` y `POST /api/productos/sugerir-caracteristicas` (Gemini, responde
  números de opción como `sugerir-categoria`; regla: solo lo que el texto dice explícitamente, nunca lo que "suele
  traer", y lo que dice que NO trae no se marca). No guarda.
- Ficha: tarjeta **"🔎 Filtros de la tienda"** (`js/caracteristicas-producto.js`), entre "Tienda web" y
  "Complementa tu compra"; también en el paso "Tienda web" del asistente. Las casillas cambian al cambiar la
  categoría (lo marcado de la otra no se pierde mientras la ficha está abierta). En los grupos "una sola", marcar una
  desmarca las otras. Si el esquema no cargó, el campo no viaja y lo guardado queda como estaba.

**Tienda:** ver `sevelin-tienda/docs/SNAPSHOT.md` (18-10-2026). Panel "Filtrar" en `/productos` con las casillas +
marca + precio (5 tramos) + estado; entre grupos se cumplen todos, dentro de un grupo "de varios" se piden todos los
marcados y en uno "de uno solo" cualquiera. Un grupo que no distingue nada (todos iguales) no se muestra. Sin panel en
Servicios Técnicos, Hogar y en las búsquedas. "Disponible / Por llegar" no se hizo: navegando por categoría la tienda
ya muestra solo lo que tiene stock.

## Cómo se probó

- `node --check`, chequeos de funciones e ids repetidos: vacíos.
- Validación del servidor con un script contra el `api/index.js` real: valores inventados, grupos de otra categoría,
  "una sola" con dos, subcategoría que suma grupos, PUT sin categoría (placa con DDR4 y DDR5) y basura → todo bien.
- Maqueta del POS (`pos-maqueta`, que ahora lee el esquema del `api/index.js` real): tarjeta, IA simulada, "una sola",
  cambio de categoría ida y vuelta, payload que se guarda. Sin errores de consola.
- Motor de la tienda con los 16 monitores reales y la propuesta: "HDMI" da 6 y deja fuera el Samsung 22" VGA/DVI,
  "HDMI y VGA" da 2, parlantes da 3. Maqueta de la tienda (`tienda-maqueta`, con las casillas propuestas de los
  productos de la muestra): computador (columna de 240 px + 3 columnas) y celular (botón "Filtrar (1)"), sin
  desborde horizontal. `tsc` y `eslint` limpios.
- Producción: la tienda nueva quedó publicada (`faf4535`) y el panel aparece en sevelin.cl/productos?categoria=Monitores.
- **No probado:** la IA de verdad (Gemini) sobre una ficha real: en la maqueta es una imitación. Se prueba con el
  primer "✨ Rellenar con IA" del dueño.

## Casillas escritas (mismo día)

El dueño dio el OK ("haz de esto, continúalo"). Se escribieron las casillas de los 144 productos de
`docs/filtros/propuesta-casillas-2026-10-18.json` (solo donde no había nada) y la marca que faltaba en #157 (MSI) y
#232 (ViewSonic), en un solo `UPDATE` para que cada producto viajara una sola vez a la tienda. Verificado:
`productos` y `productos_web` calzan en los 144, y en sevelin.cl/productos?categoria=Monitores el filtro HDMI deja 3 de
12 (el Samsung 22" VGA/DVI queda fuera). Pendiente #109 cerrado.

## Para después

- Si se cambia el esquema, se cambia en los dos repos (ver el comentario de `CARACTERISTICAS_TIENDA`).
- Los productos nuevos parten sin casillas: se marcan en la ficha ("✨ Rellenar con IA" o a mano).
