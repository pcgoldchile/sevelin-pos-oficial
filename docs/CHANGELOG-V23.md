# CHANGELOG V23 — 21 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v23.

Fix: "JWT issued at future" en Servicio Técnico → Órdenes de Trabajo (`GET /api/ot`).

---

## 1. El problema

Al abrir el panel de Órdenes de Trabajo, a veces fallaba con `HTTP 500` y el toast mostraba
literalmente el texto de Supabase: **"JWT issued at future"**. En consola:

```
Error al cargar las órdenes: JWT issued at future
    at cargarOrdenes (ot.js:335)
```

En v22 se agregó un log de diagnóstico en `auth()` (nuestro propio JWT de sesión) para este mismo
síntoma reportado antes, asumiendo que venía de ahí. Con el screenshot de DevTools que trajo el reporte
quedó claro que **no** era así: la petición a `/api/login` sí fallaba con 401 normal (sesión vencida,
comportamiento esperado), pero el 500 con "JWT issued at future" salía de una petición aparte,
`/api/ot`, y el mensaje coincide exactamente con el texto que devuelve **PostgREST** (la API REST de
Supabase) cuando rechaza un token — no con ningún mensaje que produzca la librería `jsonwebtoken` que
usa este backend para su propio JWT de sesión.

## 2. Causa real

`GET /api/ot` (y cualquier otro endpoint) llama a Supabase con la llave `service_role` vía
`db.from('ordenes_trabajo')...`. Esa llave es en sí misma un JWT, generado por Supabase. PostgREST la
valida en cada request, y "issued at future" ocurre cuando el `iat` de ese token es más nuevo que el
reloj del nodo que lo está validando en ese momento.

Como el `service_role` normal se genera una sola vez (su `iat` queda fijo, muy en el pasado), esto no
debería pasar en operación normal. Coincide con la recomendación de `docs/AUDITORIA-SEGURIDAD-SEVELIN-POS.md`
de **rotar la llave `service_role`** (Supabase → Settings → API → Reset): justo después de rotarla, el
nuevo token (con `iat` = ahora) tarda unos segundos en propagarse a todos los nodos de Supabase que lo
validan, y durante esa ventana algunos pueden rechazarlo como "todavía no válido". Es transitorio y
ajeno a nuestro código — se resuelve solo en segundos, pero mientras tanto tumbaba la petición con un
500.

## 3. Fix (`api/index.js`)

- Nuevo helper `consultarConReintento(construirQuery, intentos=3, esperaMs=400)`: ejecuta la consulta y,
  si el error de Supabase matchea el patrón de este problema (`esErrorJwtTransitorio`: contiene "jwt" y
  además "future"/"iat"/"clock"), espera 400ms y reintenta — hasta 3 intentos en total. Cualquier otro
  tipo de error (una columna que no existe, una tabla borrada, etc.) se propaga de inmediato, **sin**
  reintentar: el reintento es específico a este patrón, no un manejo genérico de fallos.
- `GET /api/ot` ahora usa ese helper. Si el error persiste tras los 3 intentos, responde **503** (no
  500) con un mensaje claro para el usuario ("La base de datos no respondió a tiempo. Intenta de nuevo
  en unos segundos.") en vez del texto crudo de PostgREST, y deja el detalle real
  (`console.warn('[OT] ...')`) en los logs del servidor para diagnosticarlo si se repite seguido.
- Se acotó a `GET /api/ot`, que es el endpoint donde se reportó el síntoma — el resto de los endpoints
  que usan `db.from(...)` no se tocaron.

## 4. Qué NO cambió

- `auth()` y el JWT de sesión propio del POS (v19, v22): no tienen relación con este bug. Se confirmó
  que son dos cosas distintas.
- No se rotó ninguna llave ni se tocó configuración de Supabase: el fix es puramente defensivo
  (reintentar + no reventar la vista) para cuando la rotación de `service_role` cause este roce
  transitorio, sea ahora o en el futuro.

## 5. Pruebas

- `node --check api/index.js`: sin errores.
- Chequeo de funciones globales duplicadas en `js/*.js`: vacío (no se tocó frontend).
- Doble en memoria de `@supabase/supabase-js` (mock de `createClient` vía `require.cache`) +
  `app.listen(0)`, contra `GET /api/ot` real:
  1. Sin error → 200, una sola llamada a Supabase (no reintenta innecesariamente).
  2. Falla la primera vez con "JWT issued at future" y la segunda funciona → 200 con los datos del
     reintento exitoso, exactamente 2 llamadas.
  3. Falla las 3 veces con el mismo error → 503, el mensaje al cliente **no** expone el texto crudo de
     Supabase, y el detalle real queda logueado en el servidor.
  4. Un error no relacionado (ej. columna inexistente) → 500 inmediato, sin reintentar, con el mensaje
     original preservado.
  Los 13 checks pasaron.
- No se probó contra una Supabase real (sin forma de forzar el rechazo transitorio real desde este
  entorno): la verificación fue con el doble en memoria, simulando la secuencia de respuestas de error
  que reportaría PostgREST.

## 6. Despliegue

Solo backend: `api/index.js`. Sin migración SQL, sin cambios de Tailwind ni de frontend. Se aplica solo
con el próximo deploy de Vercel.
