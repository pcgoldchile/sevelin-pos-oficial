# CHANGELOG V19 — 20 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v19.

Dos fixes de sesión/backend: tolerancia de reloj en la verificación del JWT, y el endpoint de
compras/gastos ahora responde siempre (antes podía quedarse colgado sin avisar nada ante un error
inesperado).

---

## 1. Tolerancia de reloj (leeway) en el JWT

**Síntoma reportado:** a veces el login/sesión fallaba con un error de tipo "JWT issued in the future".

**Causa:** `jwt.verify()` compara los campos `exp` (vencimiento) y `nbf` del token contra el reloj del
propio proceso Node que verifica. Si ese reloj y el del proceso que firmó el token (otra instancia
serverless de Vercel, no siempre perfectamente sincronizada) difieren aunque sea unos segundos, un
token recién emitido puede aparecer "ya vencido" y la sesión se corta con 401 sin que el usuario haya
hecho nada malo.

**Fix:** se agregó `clockTolerance: 120` a la única llamada `jwt.verify()` del backend
(`auth()` en `api/index.js`). Con esto, jsonwebtoken perdona hasta 120 segundos de diferencia de reloj
al comparar `exp`/`nbf` — sigue expirando el token cuando corresponde, solo corre el margen de
comparación.

```js
req.usuario = jwt.verify(token, JWT_SECRET || 'dev-secret-cambiar', { clockTolerance: 120 });
```

**Nota técnica:** `jwt.verify()` de la librería `jsonwebtoken` no valida el claim `iat` contra el reloj
a menos que se use la opción `maxAge` (que este backend no usa) — el mensaje "issued in the future" no
sale de esta línea tal cual. Lo que sí resuelve `clockTolerance` es la causa raíz real de ese tipo de
error de sesión: el desfase de reloj entre dos instancias, que se manifiesta como un `exp`/`nbf` que
parece inválido por unos segundos. Si el mensaje exacto viniera de otra parte (por ejemplo, de un log
de Supabase ajeno a este JWT propio del POS), este cambio no lo toca — pero es la corrección correcta
para el síntoma descrito (sesión rechazada por una diferencia de reloj) dentro de este backend.

## 2. El gasto/compra "no se guarda y no avisa nada" (Finanzas → Gastos)

**Síntoma reportado:** al registrar una compra/gasto, la petición a veces no se guardaba y no aparecía
ningún error.

**Causa:** `POST /api/compras` y `PUT /api/compras/:id` (los endpoints detrás del botón "Guardar" del
módulo de Gastos, `js/api.js` → `compras.crear/actualizar`) no tenían `try/catch`. En Express 4, si un
handler `async` lanza una excepción que nadie captura, Express **no** la convierte en una respuesta de
error: la promesa rechazada queda sin manejar y la petición se queda colgada — el navegador nunca recibe
ni éxito ni error. Desde la interfaz eso se ve exactamente como "no pasa nada": el fallo silencioso
reportado.

Además, `clasificacionValida()` (usada para validar la clasificación del gasto) ignoraba el `error` de
la consulta a `compra_clasificaciones`: si esa consulta fallaba por cualquier motivo (ej. un problema
transitorio de conexión con Supabase), el código lo confundía con "la clasificación no existe" — un 400
engañoso en vez de reportar el problema real.

**Fix:**
- `clasificacionValida()` ahora distingue un error real de la base (lo sube como excepción con mensaje
  claro) de "la clasificación no existe o está desactivada" (que sigue siendo un 400 normal).
- `POST /api/compras` y `PUT /api/compras/:id` ahora envuelven todo el handler en `try/catch`: cualquier
  error inesperado —el nuevo throw de `clasificacionValida`, o cualquier otra excepción futura— siempre
  termina en una respuesta JSON con un mensaje claro (500) y queda registrado en el log del servidor
  (`console.error('[COMPRAS] ...')`), en vez de dejar la petición colgada sin respuesta.

## 3. Qué NO cambió

- Los demás endpoints de "Gastos" (`gastos-fijos`, `gastos-programados`) no se tocaron: el reporte del
  usuario apuntaba específicamente a "registrar una compra/gasto", que es `POST /api/compras`. Tienen el
  mismo patrón sin `try/catch`; si se repite el síntoma ahí, es la misma clase de fix.
- El flujo de login/PIN (`firmarToken`, `/api/login`) no cambió: solo se ajustó la tolerancia con la que
  se **verifica** el token ya emitido.

## 4. Pruebas

- `node --check api/index.js`: sin errores.
- Chequeo de funciones globales duplicadas en `js/*.js`: vacío (no se tocó ningún `.js` de frontend).
- Chequeo de ids duplicados en `index.html`: vacío (no se tocó `index.html`).
- Doble en memoria de Supabase (mock de `createClient` vía `require.cache`) + `app.listen(0)`:
  - Token con `exp` vencido por 60s (desfase de reloj simulado, dentro de los 120s de tolerancia) → se
    acepta (antes se habría rechazado con 401).
  - Token con `exp` vencido por 300s (vencimiento real, fuera de tolerancia) → se sigue rechazando con
    401, la tolerancia no vuelve el login eterno.
  - Token normal, sin desfase → sigue funcionando igual que antes.
  - `POST /api/compras` con datos válidos → 201, el gasto queda insertado.
  - `POST /api/compras` con una clasificación inexistente → 400 con mensaje claro (comportamiento sin
    cambios).
  - `POST /api/compras` con un fallo simulado en la consulta de clasificaciones (conexión rechazada) →
    **antes se habría colgado sin respuesta**; ahora responde 500 con un mensaje claro
    ("No se pudo validar la clasificación: ...") y queda logueado en el servidor.
  Los 8 casos pasaron.
- No se probó visualmente: ambos cambios son de backend puro; el flujo de login y el formulario de
  Gastos no cambiaron de forma observable para el usuario salvo que ahora, ante un error real, se ve un
  mensaje en vez de quedar la pantalla esperando indefinidamente.

## 5. Despliegue

Solo backend: `api/index.js`. Sin migración SQL, sin cambios de Tailwind ni de frontend.
