# Sevelin POS — Cambios de la versión 7 (parches de seguridad Fase 2)

> **Complemento de los README v5 y v6.** Aquí va solo lo que cambió el 15 de agosto de 2026:
> los parches de código de la auditoría de seguridad (prioridades 3, 4 y 5) y el arreglo del
> Check-In de OT que apareció tras la Fase 1.
>
> La Fase 1 (rotar credenciales, activar RLS, cambiar PINs) se hizo en el panel de Supabase/Vercel,
> no en el código, así que no aparece aquí salvo por su efecto secundario: el bug del `numero_ot`.

---

## 1. Resumen

| # | Cambio | Tipo | Archivos |
|---|---|---|---|
| A | Check-In de OT roto: `numero_ot` null | **Base de datos** | `sql/13-...` (nuevo) |
| B | XSS-01 · escape de HTML en datos de usuario | Frontend | `config.js` + 8 módulos |
| C | BIZ-01 · precio y costo negativos rechazados | Backend | `api/index.js` |
| D | BIZ-02 · verificación de stock antes de vender | Backend | `api/index.js` |
| E | FILE-01 · documentos de compra privados y firmados | Backend + Frontend | `api/index.js`, `api.js`, `compras.js` |

Todo verificado: 8 pruebas de XSS (jsdom) + 8 de BIZ (doble de Supabase) + SQL validado con el
parser real de PostgreSQL. Chequeo anti-colisión del README v6 en verde (sin funciones globales
duplicadas). Cero IDs huérfanos nuevos.

---

## 2. A · El Check-In de OT dejó de funcionar tras la Fase 1

**Síntoma:** al crear una OT, `null value in column "numero_ot" violates not-null constraint`.

**Diagnóstico correcto** (la primera hipótesis —"el backend no genera el número"— era falsa):

El backend **nunca** generó el `numero_ot`, y está bien que así sea. Lo asigna un **trigger de la
base de datos** (`trg_asignar_numero_ot`), a propósito, para que dos check-in simultáneos no puedan
recibir el mismo número (un correlativo en la app tendría carrera). El INSERT omite `numero_ot`
deliberadamente para que el trigger lo rellene con `OT-000001`, `OT-000002`…

El trigger dejó de estar activo en la base. Causa más probable: la base se recreó desde el "schema
for context only" (ese export de Supabase lista tablas pero **nunca incluye triggers ni funciones**),
o el trigger se perdió al migrar las llaves en la Fase 1.

**Solución:** `sql/13-fix-numero-ot-y-search-path.sql`. Es **idempotente** (seguro de correr aunque
el trigger ya exista): recrea secuencia + función + trigger, reposiciona el correlativo tras las OT
existentes, y trae un bloque de auto-verificación que inserta una OT de prueba, comprueba que recibió
número y la borra. De paso fija el `search_path` de `asignar_numero_ot`, `fifo_consumir` y
`fifo_devolver`, cerrando las 2 advertencias *Function Search Path Mutable* del Advisor.

> **Regla para el futuro:** nunca recrear la base desde el diagrama de "schema for context".
> Correr los archivos `sql/` en orden, que sí traen triggers, funciones, secuencias y buckets.

---

## 3. B · XSS-01 — escape de HTML (el hallazgo de mayor impacto)

**El problema.** Varios módulos interpolaban datos escritos por el usuario (nombre de producto,
cliente, falla, SKU, S/N, descripción…) directamente en `innerHTML` sin escapar. Un trabajador podía
crear una OT con `cliente_nombre` = `<img src=x onerror="...roba el token...">`; cuando el admin abría
Servicio Técnico, el navegador del admin ejecutaba el payload. Como el token vive en `sessionStorage`,
era una escalada trabajador → admin por XSS persistente.

**La solución.** Un helper global canónico `escHtml()` en `js/config.js` (carga primero). Escapa
`& < > " '`. Se aplicó en todos los puntos donde un dato de usuario entra a `innerHTML`:

| Módulo | Qué se escapó |
|---|---|
| `pos.js` | nombre y S/N en carrito, sugerencias del buscador, dividir venta |
| `ot.js` | numero_ot, cliente_nombre, teléfono, modelo, S/N, falla; los 3 resúmenes |
| `encargos.js` | cliente, descripción, teléfono, observaciones, OT vinculada |
| `productos.js` | nombre y SKU en la tabla y en el panel de bajo stock |
| `repuestos.js` | área, categoría, modelo, descripción, ubicación |
| `compras.js` | proveedor, descripción, clasificación |
| `historial.js` | cliente e ítems en la tabla y el detalle de venta |

**Ya estaban bien (no se tocaron):** `print.js` (usa su propio `escaparHTML` de forma consistente),
y los chips del buscador del historial (usaban `escaparHtmlHist`).

**Sobre los 4 helpers duplicados** (`escaparHTML`, `escaparTexto`, `escaparHtmlHist`, `escaparRep`):
se dejaron donde estaban para no romper sus llamadas, pero **el código nuevo usa solo `escHtml`**.
A futuro conviene unificar todo en `escHtml` y borrar los otros cuatro.

> **Nota:** esto reduce el riesgo de XSS-02 (token en sessionStorage) al quitar la vía de entrada,
> pero no lo cierra del todo. La CSP (prioridad 6) sigue pendiente y es el siguiente paso lógico:
> aunque se colara un XSS nuevo, una CSP con `connect-src` restringido corta la exfiltración.

---

## 4. C · BIZ-01 — precio y costo negativos

**El problema.** `num = v => Number(v) || 0` no rechazaba negativos. Una línea con
`precio_unitario: -9000` bajaba el total: se podía cobrar de menos y cuadrar un arqueo con un
"descuento" falso. Fraude interno encubierto.

**La solución.** `normalizarItems()` ahora lanza error (→ 400) si `precio_unitario < 0` o
`costo_unitario < 0`, con el nombre del ítem en el mensaje. Los descuentos legítimos, si se necesitan,
deben modelarse como un campo aparte, nunca como una línea negativa.

---

## 5. D · BIZ-02 — verificación de stock

**El problema.** `POST /api/ventas` descontaba stock sin comprobar que alcanzara: se podía vender 100
de un producto con 3, dejando inventario inconsistente.

**La solución.** Nueva función `verificarStockDisponible()`, que corre **antes** de escribir nada:

- **Agrupa por producto**, así dos líneas del mismo ítem (2 + 2) se validan juntas contra el stock (3).
- **Omite** `stock_ilimitado` (servicios), productos con lotes (los valida `fifo_consumir` de forma
  atómica) y repuestos ya reservados en una OT.
- Si algo no alcanza, la venta se rechaza con 400 y la base queda intacta.

**Pendiente conocido (no bloqueante):** la validación y el descuento no son una sola transacción
atómica para productos sin lotes. Dos ventas del último ítem casi simultáneas podrían pasar ambas.
Es una ventana muy estrecha en un POS de un mostrador. La solución definitiva es una función Postgres
con `SELECT ... FOR UPDATE`, como ya se hace con lotes. Anotado para más adelante.

---

## 6. E · FILE-01 — documentos de compra privados

**El problema.** Los comprobantes se subían con nombre `AÑO/<Date.now()>_archivo` y se servían con
`getPublicUrl()` (bucket público). El timestamp es predecible: un anónimo podía tantear URLs y bajar
facturas de proveedores sin autenticarse.

**La solución.**

1. **Path con `crypto.randomUUID()`** en vez de timestamp: imposible de adivinar.
2. **URL firmada** (`createSignedUrl`, caduca en 1h) en vez de pública.
3. Como las URLs firmadas caducan, la compra ahora guarda la **ruta** (estable), no un enlace muerto.
   Al abrir un documento, el front pide una URL fresca al nuevo endpoint `POST /api/compras/firmar`
   (solo admin). Compatibilidad: si en la base quedó una URL `http` antigua, se abre directo.

> **⚠️ REQUISITO DE CONFIGURACIÓN MANUAL.** Este parche entrega URLs firmadas, pero para cerrar el
> hallazgo hay que poner el bucket **`compras-documentos` en PRIVADO** en Supabase → Storage →
> Buckets → (el bucket) → *Make private*. Si sigue público, el archivo también seguirá accesible por
> su URL pública directa, aunque la ruta ya no sea adivinable. **Este es el único paso de esta entrega
> que debes hacer tú a mano.**

---

## 7. Qué falta (continúa el plan de la auditoría)

- **Prioridad 6 · CSP** — sigue pendiente. Es el complemento natural de XSS-01.
- **Prioridad 7 · DTE post-venta solo admin + auditoría** — pendiente.
- **Prioridad 8 · quitar fallback CORS `*` y defaults de PIN del código** — pendiente.
- **BIZ-02 atómico** — la transacción con `FOR UPDATE` mencionada arriba.
- **Bucket a privado** — paso manual del punto 6.
- Unificar los 5 helpers de escape en `escHtml`.

---

## 8. Orden de despliegue

1. **Primero el SQL.** Corre `sql/13-...` en Supabase → SQL Editor. Debe imprimir
   `OK: la OT de prueba recibió el número OT-...`. Esto desatasca el Check-In.
2. **Pon el bucket `compras-documentos` en privado** (punto 6).
3. **Despliega el backend** (`api/index.js`) y verifica `GET /api/health`.
4. **Despliega el frontend.** `css/tailwind.css` ya viene compilado.
5. **Prueba en el equipo:** crear una OT (debe darle número), una venta normal, intentar una venta
   con más stock del disponible (debe rechazarla), y abrir un comprobante de compra ya subido.
