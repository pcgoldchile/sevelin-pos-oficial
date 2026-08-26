# CHANGELOG V24 — 26 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v24.

E-commerce — Fase 0 (cimientos): fotos de producto + controles de tienda web en el POS, y
auditoría de datos de envío. Trabajado en la rama `feature/fase-0-ecommerce`.

---

## 0. Antes de leer el resto: el prompt de esta fase estaba desactualizado

`PROMPT-DEFINITIVO-FASE-0.md` y `README-ECOMMERCE-SEVELIN.md` fueron escritos contra la v16 del
repo (última migración `sql/18`). El repo real iba en **v23** (última migración `sql/20`) al empezar
esta sesión. Dos contradicciones reales, verificadas antes de tocar código:

1. **0.1/0.2 (stock atómico) ya estaban resueltos**, desde v18/v22, con un diseño distinto al que
   describía el README: no existe `ajustar_stock_atomico(producto_id, cantidad, signo)` llamado por
   ítem; existe `descontar_stock_venta(p_items JSONB)` (`sql/19-stock-atomico.sql`, con un fix de bug
   en `sql/20-fix-descontar-stock-ambiguo.sql`), que recibe TODOS los ítems de la venta en una sola
   llamada, bloquea cada fila con `SELECT...FOR UPDATE` y descuenta atómicamente — cubre exactamente
   el mismo caso de carrera ("6+6 contra stock 10") que pedía el prompt. `api/index.js` ya la llama
   desde `POST /api/ventas` vía `descontarStockNoLotes()` (línea ~950). **No se tocó nada de esto.**
2. Los nombres de archivo que pedía el prompt (`sql/19`, `sql/20`, `docs/CHANGELOG-V17.md`) ya
   existían con OTRO contenido real en producción. Se renumeró: la migración nueva de esta fase es
   `sql/21-imagenes-web.sql`, y este changelog es V24 (el siguiente libre), no V17.

Ambos puntos se confirmaron con el usuario antes de escribir código (ver sección 5).

### 0.1 Nota importante para la Fase 1 (no es trabajo de esta fase, solo un aviso)

`descontar_stock_venta` solo protege `productos` desde `POST /api/ventas`. Los **repuestos internos
del taller** (tabla `repuestos`, reservados en una OT) y otros call-sites de `ajustarStock()` (entrega/
cancelación de OT, importación de ventas, devoluciones) siguen con el patrón antiguo
SELECT + UPDATE, no atómico — no se tocan en esta fase porque no son el canal que va a recibir tráfico
del e-commerce. Cuando se construya `/api/interno/ajustar-stock` en la Fase 1 (sección 5 del README),
debe llamar a `descontar_stock_venta` (o una función atómica equivalente), no reusar `ajustarStock()`
tal cual.

---

## 1. `sql/21-imagenes-web.sql` (nueva migración)

Agrega a `productos`: `imagen_urls TEXT[]`, `publicado_web BOOLEAN DEFAULT FALSE`, `descripcion_web
TEXT`, `precio_web NUMERIC`, y **`categoria_web TEXT`** (no estaba en el snippet SQL de la sección 4.1
del README, pero sí se pide como control del modal en el punto 0.5 del prompt y en la sección 2.1 del
README — se agregó para que ese campo tenga dónde guardarse). Idempotente (`ADD COLUMN IF NOT
EXISTS`), verificada con `pglast`.

**Pendiente de aplicar en Supabase → SQL Editor antes de desplegar** (ver orden seguro al final).

## 2. Bucket `productos-imagenes`

`docs/README-BUCKET-IMAGENES.md`: pasos manuales verificados (Storage → New bucket → público) más un
script opcional `scripts/crear-bucket-imagenes.js` (idempotente, sin dependencias nuevas) para quien
tenga las credenciales reales a mano. No se ejecutó desde esta sesión: no hay `.env` real ni acceso de
red al proyecto Supabase de producción en este entorno.

## 3. Backend (`api/index.js`)

- `CAMPOS_PRODUCTO` + `sanearProducto()`: se agregaron `publicado_web`, `precio_web`,
  `descripcion_web`, `categoria_web` al mismo flujo de guardado que ya existía (`POST`/`PUT
  /api/productos`) — no se creó un endpoint aparte. `precio_web` vacío o 0 se guarda como `NULL`
  (usa el precio normal), nunca como `0` literal.
- `POST /api/productos/:id/imagen`: recibe el webp ya procesado en base64, lo sube al bucket
  `productos-imagenes` con `service_role` (ruta no enumerable: `id/uuid.webp`), y hace `append` a
  `imagen_urls`. Tope de 1MB por imagen (el Canvas del front apunta a ~150KB; es margen de sobra).
  `imagen_urls` **no** pasa por `sanearProducto()`: se administra solo por este endpoint, foto por
  foto, para no arriesgar que un guardado normal pise el arreglo completo.
- `DELETE /api/productos/:id/imagen`: borra la foto del bucket (si la URL es de nuestro bucket) y la
  quita de `imagen_urls`.
- `GET /api/productos/auditoria-envio` (punto 0.6): cuenta productos con `peso_kg`, `alto_cm`,
  `ancho_cm` o `profundidad_cm` en 0, excluyendo `stock_ilimitado` (servicios no se despachan).
  `productos` no tiene columna `activo` (no hay soft-delete, se borra la fila), así que "activo" se
  interpretó como "existe en el catálogo". Solo diagnostica, no corrige nada.

## 4. Frontend (`js/productos.js`, `js/api.js`, `index.html`)

- Modal de producto: sección nueva "Tienda web" — toggle **Publicar en la web**, campos **Precio
  web** / **Categoría web** / **Descripción web**, y un bloque de fotos (input de archivo + grilla de
  miniaturas con botón de quitar). Todo dentro del modal ya existente, no un flujo aparte.
- Pipeline de imagen: lienzo `1000×1000`, fondo blanco, la foto se dibuja centrada manteniendo
  proporción ("contain", sin recortar ni deformar), se exporta a `.webp` y si supera ~150KB baja la
  calidad en pasos de 0.1 (mínimo 0.5) hasta acercarse al objetivo.
- Las fotos solo se pueden subir con el producto ya guardado (el endpoint cuelga de su `id`): sin
  guardar, el campo de fotos se oculta y se muestra un aviso — no se intentó soportar "subir foto antes
  de crear el producto".
- `API.productos`: `subirImagen`, `quitarImagen`, `auditoriaEnvio`.

## 5. Decisiones confirmadas con el usuario antes de implementar

1. 0.1/0.2 → dar por satisfechas (no crear `ajustar_stock_atomico`, no tocar `ajustarStock()`).
2. Numeración → seguir la secuencia real del repo (`sql/21`, `docs/CHANGELOG-V24.md`), no la que
   asumía el prompt desactualizado.
3. Bug crítico activo en producción (`sql/20-fix-descontar-stock-ambiguo.sql` sin aplicar en Supabase,
   ver v22/v23 en `docs/SNAPSHOT.md`) — el usuario no estaba al tanto; ver recordatorio en la sección 7.

## 6. Pruebas

- `node --check` en `api/index.js`, `js/api.js`, `js/productos.js`, `scripts/crear-bucket-imagenes.js`:
  sin errores.
- Chequeo de funciones globales duplicadas (`js/*.js`) y de `id` duplicados (`index.html`): ambos
  vacíos.
- SQL validado con `pglast`.
- **Backend**, doble en memoria de Supabase (mock de `createClient` vía `require.cache` + `app.listen(0)`
  contra el `app` real): 17 verificaciones — campos web persistidos por `PUT /api/productos/:id`,
  `precio_web=0` guardado como `NULL`, subir/quitar imagen actualiza `imagen_urls` y devuelve 404 si el
  producto no existe, y la auditoría de envío cuenta y filtra bien (excluye `stock_ilimitado`, detecta
  el producto sin medidas). Las 17 pasaron.
- **Frontend**, jsdom concatenando los 26 `js/*.js` en el orden real de `index.html` y evaluándolos
  sobre el DOM completo de `index.html`: 32 verificaciones — todos los campos nuevos existen y quedan
  bien cableados en `abrirModalProducto()` (mostrar/ocultar fotos según haya id, precarga de los 4
  campos web, `precio_web` NULL se ve vacío, grilla de fotos existentes), `guardarProducto()` manda los
  campos web y NO manda `imagen_urls`, y `manejarSeleccionFotoProducto()`/`quitarFotoProducto()` llaman
  a la API correcta. Las 32 pasaron. **No se probó el dibujo real del Canvas** (este entorno no tiene el
  paquete `canvas` que jsdom necesita para `getContext('2d')`/`toBlob` reales, y no hay Chromium): la
  lógica de compresión por pasos se revisó por lectura, no se ejecutó pixel a pixel.
- No se probó contra un Supabase ni un bucket real (sin credenciales ni red en este entorno): ver
  orden seguro de aplicación abajo.

## 7. Orden seguro para llevar esto a producción

1. **Aplicar `sql/20-fix-descontar-stock-ambiguo.sql`** en Supabase → SQL Editor si todavía no se hizo
   — es el bug crítico ya activo (ventas con productos sin lotes fallando), independiente de esta fase
   pero más urgente.
2. Aplicar `sql/21-imagenes-web.sql` en Supabase → SQL Editor.
3. Crear el bucket `productos-imagenes` (`docs/README-BUCKET-IMAGENES.md`).
4. Probar en la URL de Preview de Vercel de esta rama (`feature/fase-0-ecommerce`) antes de mezclar a
   `main`: crear un producto, subirle una foto, marcarlo "Publicar en la web", revisar
   `GET /api/productos/auditoria-envio`.
5. Recién ahí, mergear `feature/fase-0-ecommerce` a `main`.
