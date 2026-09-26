# v92 — Auditoría de los errores de Salud

**Fecha:** 26-09-2026
**Migración:** ninguna
**Pedido del dueño:** revisar a fondo los 20 errores de los últimos 7 días que mostraba Página Web →
Salud, y arreglar lo que hiciera falta. También toca `sevelin-tienda` (ver su `docs/SNAPSHOT.md`).

---

## Resumen: de dónde salía cada error

| Error en Salud | Veces | Origen real | Qué se hizo |
|---|---|---|---|
| POS · "JWT issued at future" | 8 | Supabase: su gateway y la base con relojes desfasados | Reintento en el `fetch` de `db` (todas las consultas) |
| POS · Gemini 502 | 10 | Google saturado el 22-09 | Nada: el presupuesto de 50 s ya se agregó ese día y no volvió a fallar |
| Tienda · `eval() is not supported` | 4 | `next dev` en el PC del dueño | La tienda ya no registra errores fuera de producción |
| Tienda · Home, `522` | 1 | `next dev` en el PC del dueño | Ídem, y la Home ya no cachea una versión rota |
| Tienda · `useCarrito … <CarritoProvider>` | 2 | Casi seguro `next dev` (no demostrable) | Ídem |
| Salud · "Sincronización de catálogo ⚠️ Falta" | — | Falsa alarma | Fila quitada |
| Salud · "Redis ⚠️ Falta" | — | Real | Pendiente del dueño (Vercel) |

---

## 1. "JWT issued at future": la causa no era la que decía el código

v23 lo atribuía a la rotación de la llave (el JWT nuevo tardando en propagarse). **No es eso.** La
llave del POS es del formato nuevo, `sb_secret_…`, que **no es un JWT**. Según la documentación de
Supabase ("How are publishable and secret keys implemented"), el gateway verifica esa llave y
**acuña un JWT de vida corta en cada petición**, con `iat` = la hora de su reloj. Si el reloj del
servidor de la base va un poco atrás, PostgREST responde **401 PGRST303 "JWT issued at future"**.

- **Datos reales** (logs de Supabase, fuente `edge_logs`, 24 h): 2 rechazos entre ~1.790 peticiones
  con la llave del POS (≈0,1 %). Uno es exactamente el `/api/repuestos` de las 17:29 del 26-09.
- **La tienda no lo sufre** porque su llave (Supabase Web) es un JWT clásico con `iat` fijo del 27-08.
- **No depende de nosotros ni se arregla rotando la llave.** El 401 llega antes de ejecutar nada, así
  que repetir la consulta es seguro, incluso en escrituras.

**Arreglo:** `fetchSupabase()` como `global.fetch` del cliente `db`. Si la respuesta es un 401 cuyo
cuerpo es este error de reloj (`esErrorJwtTransitorio`), espera 250/500 ms y repite, hasta 3 veces.
Cualquier otro 401 (llave mala) pasa intacto al primer intento. Solo repite si el cuerpo es
reenviable (texto o vacío). Antes solo 17 de ~500 consultas tenían reintento
(`consultarConReintento`); ahora lo tienen todas.

## 2. Lo peor no eran los 500: eran las lecturas que fallaban en silencio

164 consultas hacen `const { data } = await db…` sin mirar `error`. Cuando llega el rechazo, no hay
500: hay **datos vacíos** y el código sigue como si nada. Ejemplo visto hoy: `devolucion_seguimiento`
fue rechazada a las 17:46, pero no aparece en Salud porque `GET /api/devoluciones/seguimiento/avisos`
respondió "sin avisos".

**Esto ya dañó una venta real.** La **venta 201 (12-09-2026, Balanza Digital Inteligente
Bluetooth)** quedó con `condicion = NULL` en su línea de venta. Ese producto se vendió 23 veces, y
todas las ventas desde el 02-09 guardaron `nuevo`, incluidas la 200 y la 202 del mismo día. Ese día
hubo un incidente de Supabase. La lectura del catálogo en `normalizarItems()` falló y la venta se
guardó igual. El costo salió bien solo porque el navegador mandó el correcto.

Con el código viejo, la prueba de "catálogo caído" guardó la venta de un trabajador **con el costo
que mandó el navegador ($1): utilidad 99,99 %**, sin garantía. Y borrar una venta con la lectura de
sus ítems caída respondió `{"ok":true}`: **borraba la venta y el stock nunca volvía**.

**Arreglos:**
- `normalizarItems()` (crear y editar venta): si no puede leer `productos` o `repuestos`, lanza. El
  `catch` de `POST /api/ventas` ya convertía eso en "Supabase no respondió a tiempo. Vuelve a apretar
  Registrar venta", sin cobrar ni descontar dos veces. Todavía no se tocó nada en ese punto.
- `revertirEfectosDeVentas()` y `devolverConsumoLotes()`: si no pueden leer los ítems o los lotes,
  lanzan **antes de mover nada**. Las dos rutas que las llamaban sin `try`
  (`DELETE /api/ventas/:id` y `DELETE /api/ventas` por período) ahora responden 500 con "la venta no
  se borró". Con Express 4, una excepción ahí dejaba la petición colgada.
- Las otras ~160 lecturas silenciosas quedan cubiertas por el reintento del punto 1 ante este error.
  Ante una caída real de Supabase siguen leyendo vacío. **No se tocaron:** son muchas y casi todas de
  pantallas, no de plata.

## 3. supabase-js ya reintenta solo (dato nuevo)

`@supabase/postgrest-js` 2.112 reintenta **por su cuenta** los GET con 503/520 y los errores de red:
4 intentos, esperando 1 + 2 + 4 s. Envolver eso en `consultarConReintento` (3 × 400 ms) **multiplica
las esperas**: hasta ~22 s por lectura. Por eso las lecturas nuevas de `normalizarItems` van
directas. El reintento propio (`fetchSupabase`) solo cubre el 401 de reloj, que la librería no toca.

## 4. Salud: una falsa alarma menos

"Sincronización de catálogo a la tienda ⚠️ Falta" miraba `TIENDA_SYNC_URL`, que **solo usa el script
local** `scripts/sincronizar-catalogo-web.js`: el `.env` del PC ya la tiene y el servidor nunca la
lee. La sincronización real es el trigger `trg_sync_tienda` (pg_net), y está sana: **12 de 12 envíos
con HTTP 200** en la ventana de `net._http_response` del 26-09. Se quitó la fila. Una alarma que
nunca se apaga enseña a ignorar las demás.

## 5. Lo que queda (del dueño)

- **Redis (Upstash) en el Vercel del POS:** sigue "⚠️ Falta" y es real. El freno de login funciona
  en memoria, más débil entre instancias.
- **Corregir la venta 201:** poner `condicion = 'nuevo'` en `venta_items.id = 280`. Hay que
  confirmarlo con el dueño antes de escribir en producción.
- **Fotos adicionales del feed de Merchant:** Googlebot-Image pide dos URLs unidas por coma (HTTP
  400), por el `additional_image_link` del feed CSV. Quedó como tarea aparte.

## Pruebas

- **POS** (`supabase-js` real + fetch falso que imita a PostgREST, `app.listen(0)`): 11 de 11 OK.
  Casos: GET normal (1 consulta); 1 rechazo de reloj → 200; 3 rechazos → 500 genérico y registro en
  Salud; 401 de llave mala → sin reintento; POST reenviado con el mismo cuerpo; venta con 1 rechazo →
  201 con `condicion = 'nuevo'` y costo del catálogo (no el del navegador); catálogo caído → 400 sin
  tocar stock ni guardar; corte pasajero → 503 en 7,1 s; borrar venta con lectura caída → 500 sin
  borrar ni mover stock; borrar con 1 rechazo → repone stock y borra; Salud con 7 filas.
- **Las mismas 11 contra el código anterior:** fallan 9 (solo pasan los dos controles). Así se sabe
  que las pruebas detectan los bugs.
- `node --check`, chequeo de funciones duplicadas y de ids: vacíos. Sin cambios de Tailwind.
- **Lo que no se pudo probar:** forzar el desfase de reloj real de Supabase. Se verá en producción
  con los logs (`edge_logs` con 401 seguidos de 200 en la misma ruta) y con que Salud deje de mostrar
  "JWT issued at future".
