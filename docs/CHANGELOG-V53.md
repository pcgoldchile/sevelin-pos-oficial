# CHANGELOG v53 — Feed de catálogo para Meta y Google

**Fecha:** 07-09-2026 · **Rama:** `main` · **Plan:** `docs/PLAN-CRECIMIENTO-2026.md`, Fase 3
("dejar de publicar a mano"). Sin migración SQL.

---

## 1. Qué resuelve

Casi toda la venta de Sevelin nace en **Facebook Marketplace, publicado a mano, una por una**. El
catálogo real ya vive en el POS y ya está sincronizado a la tienda. Este cambio lo entrega en el
formato que comen **Meta Commerce Manager** (catálogo de Facebook/Instagram) y **Google Merchant
Center**, para dejar de tipear lo mismo dos veces.

Es además el paso previo del bloqueo **B6**: el catálogo de Commerce vive dentro del Business
Manager, y tenerlo cargado es lo que hace que valga la pena migrar el negocio fuera de la cuenta
personal de Facebook.

---

## 2. `GET /api/pos/feed-catalogo`

`auth(true)`. Devuelve `{ nombre, csv, total, publicados, omitidos[] }`.

**El CSV se arma en el servidor** y viaja como texto dentro del JSON: el formato del feed tiene una
sola fuente de verdad y el navegador solo lo descarga (con `descargarArchivo()`, que ya existía).
Lleva BOM, porque sin él Excel abre el archivo con los acentos rotos.

Columnas: `id, title, description, availability, condition, price, link, image_link,
additional_image_link, brand, product_type, quantity_to_sell_on_facebook, identifier_exists` — un
único archivo que sirve para las dos plataformas.

### De dónde salen los datos
De **`productos_web`** (Supabase Web, cliente `dbWeb`), **no** de `productos`: ahí está el `sku` ya
resuelto que forma la URL real de la ficha, incluido el slug de respaldo que la tienda genera para
los productos sin SKU. Recalcular esa URL en el POS habría creado una segunda fuente de verdad que
tarde o temprano se desincroniza. Lo único que se busca en el POS es `condicion`
(nuevo/reacondicionado), que el trigger de sincronización no manda a la tienda.

### Decisiones que no son obvias
- **La descripción se convierte a texto plano.** Las fichas se guardan como HTML (editor Quill) y
  ninguna de las dos plataformas acepta marcado.
- **No se inventa descripción cuando falta.** El campo es obligatorio y dejarlo vacío hace que la
  plataforma rechace el producto entero, así que se arma una línea mínima con datos que ya existen
  (nombre y categoría). No se agregan specs que nadie verificó.
- **Un pedido por encargo no está agotado**: no tiene stock propio por diseño, así que va como
  disponible y sin cantidad declarada.
- **`brand` va como "Sevelin"** porque el catálogo del POS no tiene campo de marca y las dos
  plataformas la exigen; se declara `identifier_exists=no` (no hay GTIN ni MPN) para que Google no
  rechace por identificador faltante. **Pendiente real anotado en el código**: agregar `marca` a
  `productos` — con la marca verdadera estos productos compiten bastante mejor en Google Shopping.

---

## 3. Bug real encontrado al verificar (el más importante de esta versión)

Al probar los links generados contra el sitio real, **uno de cada tres devolvía 404**.

Causa: la tienda **no sirve la ficha de un producto con `stock_web = 0`** que no sea pedido por
encargo — `obtenerProductoPorSku()` en `sevelin-tienda/src/lib/catalogo.ts` filtra por
`stock_web.gt.0`. Un feed con links rotos no es "un producto que no se vende": es **un catálogo que
la plataforma rechaza entero** y que baja la calidad de la cuenta publicitaria.

Se corrigió omitiendo del feed los productos sin stock, con ese motivo escrito explícitamente. Si
algún día la tienda sirve las fichas agotadas (mejor para SEO, pero es una decisión de negocio, no
técnica), basta con dejar pasar la fila con `availability: out of stock` — está anotado en el
código.

**Sin haber verificado los links contra el sitio real, este bug se habría descubierto recién cuando
Meta rechazara la subida completa, sin decir por qué.**

---

## 4. Lo que el panel informa (y por qué importa)

Nueva sub-pestaña **Página Web → 📣 Feed de catálogo**: un botón que genera y descarga, y debajo el
resumen con **la lista de todo lo que quedó fuera, agrupado por motivo y con nombre y SKU**.

Eso es la mitad del valor: una subida rechazada por Meta no dice qué producto falló de forma útil.
Acá se ve antes de subir.

Resultado real hoy: **130 publicados → 99 al feed, 31 fuera** (13 sin foto, 18 sin stock).

---

## 5. Cómo se probó

- **Endpoint contra producción**: 130 publicados → 99 filas, 31 omitidos con motivo.
- **Links verificados contra el sitio real**: se pidieron 5 fichas del feed final, las 5 respondieron
  **200**. Antes de la corrección, una muestra devolvía 404 — así se encontró el bug de la sección 3.
- **Imagen verificada**: la primera `image_link` responde 200 desde el bucket público.
- **Panel en jsdom** con el feed REAL: descarga con nombre y tipo correctos (145 KB, encabezado con
  BOM), los 2 KPIs (99 / 31), las 2 tablas de omitidos con sus 31 filas y sus títulos por motivo, el
  botón se restaura al terminar, 0 `<script>` inyectados y el toast correcto.
- `node --check` en los 3 archivos tocados; chequeos de colisión de funciones, `const`/`let` globales
  e `id`: **todos vacíos**.
- Tailwind no se recompiló: no se usó ninguna clase de utilidad nueva.

---

## 6. Archivos tocados

| Archivo | Cambio |
|---|---|
| `api/index.js` | `GET /api/pos/feed-catalogo` + helpers `celdaCsv()` y `descripcionParaFeed()` |
| `js/api.js` | `API.feedCatalogo.generar()` |
| `js/pagina-web.js` | `descargarFeedCatalogo()` y el render del resumen |
| `index.html` | sub-pestaña y panel "Feed de catálogo" |

---

## 7. Lo que sigue

1. **Subir el archivo** a Meta Commerce Manager → Catálogo → Fuentes de datos. Requiere tener el
   Business Manager creado (bloqueo B6).
2. **Sacar del limbo a los 31 omitidos**: 13 necesitan foto, 18 necesitan reposición de stock (o que
   la tienda sirva fichas agotadas).
3. **Agregar `marca` al catálogo** para que `brand` deje de ser el nombre de la tienda.
4. Cuando el feed esté cargado y estable, evaluar publicarlo en una URL fija para que Meta y Google
   lo lean solos cada día, en vez de subirlo a mano.
