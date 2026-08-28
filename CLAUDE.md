# CLAUDE.md — Sevelin POS

> Este archivo lo lee Claude Code al inicio de cada sesión. Contiene las reglas del proyecto para no
> repetirlas cada vez. Si algo aquí ya no coincide con el código, avísame y lo actualizamos.
>
> **Para el estado detallado (qué está hecho, qué falta), lee `docs/SNAPSHOT.md`.**

Proyecto: POS para tienda de electrónica en Arica, Chile. En producción y en uso real.
Producción: https://sevelin-pos-oficial.vercel.app

---

## Stack (fijo, no re-analizar)

- **Backend:** Node/Express en `api/index.js` (archivo único, serverless en Vercel). Debe llamarse así
  y estar en `api/`, o Vercel lo sirve como estático y todo da 404.
- **Frontend:** JavaScript **vanilla** en `js/*.js`. **Todos los archivos comparten el mismo ámbito
  global** (son `<script src>` planos, sin módulos ni bundler).
- **Base de datos:** Supabase / PostgreSQL. El acceso es **solo desde el backend** con la llave
  `service_role` (omite RLS). El frontend nunca habla con Supabase directo: todo pasa por `js/api.js`.
- **Auth:** JWT en `sessionStorage`. Roles `admin` y `trabajador`.
- **Estilos:** Tailwind **compilado** a `css/tailwind.css` (NO se usa el CDN). Más `css/styles.css`.

---

## ⚠️ Reglas críticas para no romper el código (LEER SIEMPRE)

### 1. Nunca dos funciones globales con el mismo nombre
Como todos los `js/*.js` comparten scope, si dos archivos declaran una función con el mismo nombre, la
segunda **pisa a la primera en silencio**. Esto ya causó varios bugs (`confirmarEntrega`, `num`,
`cerrarModal`). **Después de editar cualquier `.js`, corre este chequeo — debe salir VACÍO:**

```bash
for f in js/*.js; do grep -oP '^\s*(async\s+)?function\s+\K[A-Za-z_$][\w$]*' "$f"; done | sort | uniq -d
```

El problema inverso también existe: usar en el frontend una función que **solo existe en el backend**
da `ReferenceError` silencioso. Ejemplo real: `fechaHoyChile` es de backend; en el frontend el helper
equivalente es `todayISO()`.

### 2. Nunca dos elementos con el mismo `id` en `index.html`
`getElementById` toma el primero y el otro queda muerto. Ya pasó con los modales de caja. Chequeo:

```bash
grep -oP 'id="\K[^"]+' index.html | sort | uniq -d
```

### 3. Recompilar Tailwind si agregas clases nuevas
```bash
npx tailwindcss -c tailwind.config.js -i css/tailwind-input.css -o css/tailwind.css --minify
```

### 4. Reutiliza los helpers canónicos (están en `js/config.js`, que carga primero)
`fmtCLP`, `escHtml`, `num`, `todayISO`, `showToast`. No crees duplicados. **Todo dato de usuario que se
inserte en el DOM pasa por `escHtml`** (regla de seguridad).

---

## Cómo probar (NO hay navegador real en este entorno)

- **Backend:** doble en memoria de Supabase — se mockea `createClient` vía `require.cache` y se
  levanta el `app` de Express con `app.listen(0)`.
- **Frontend:** **jsdom** — se concatenan los `js/*.js` en orden y se evalúan en un `window`.
- **Validar SQL:** `python3 -c "import pglast; pglast.parse_sql(open('sql/NN.sql').read())"`.
- **Sintaxis:** `node --check` en cada `.js` tocado.
- No hay Chromium (sin red para descargarlo), así que lo visual (CSS, capas, cámara) se razona, no se
  renderiza. jsdom se borra al instalar playwright; reinstalar con `npm install jsdom --no-save`.

---

## Convenciones del proyecto

- **SQL:** migraciones numeradas en `sql/` que corren EN ORDEN (01 … 24+). Todas idempotentes. Nunca
  recrear la base desde cero: se perderían triggers, funciones y secuencias (numero_ot, FIFO).
  **Aplicarlas con la Supabase CLI, no a mano en el SQL Editor:**
  `npx supabase db query --file sql/NN-nombre.sql --linked` (la CLI ya está logueada y el repo
  vinculado — sin `DATABASE_URL` guardada en ningún archivo, decisión explícita del usuario).
- **Idioma:** todo en español (código, comentarios, mensajes al usuario, commits).
- **Validaciones críticas** (precios, stock, montos) van SIEMPRE en el servidor, no solo en el front.
- **Documentación:** al cerrar una tarea grande, escribe `docs/CHANGELOG-VNN.md` y actualiza
  `docs/SNAPSHOT.md`. Ver `docs/README-DOCS.md` para la estructura.

---

## Estilo de trabajo que espero

- **Una tarea a la vez.** No toques módulos que no te pedí.
- **Prueba antes de decir que está listo.** Si no lo probaste (jsdom o doble de Supabase), dilo.
- **Sé honesto sobre lo que no se puede verificar** (lo visual, la cámara, el entorno real).
- Antes de empaquetar o dar por terminado: `node --check` en lo tocado, los dos chequeos de colisión
  (funciones e ids), y recompilar Tailwind si tocaste clases.
- No reimplementes código que ya existe y funciona; primero revisa si ya está hecho.

---

## Backlog (pendientes, ninguno bloqueante — ver `docs/SNAPSHOT.md` para el detalle)

1. **E-commerce: YA conectado y en producción** (`sevelin-tienda`, repo aparte) — catálogo real
   (114 productos, 86 publicados y categorizados, 75 con fotos), checkout, Flow (sandbox), panel
   "Pedidos Web". Pendiente real: confirmar en Vercel que `SYNC_SECRET`/`SUPABASE_WEB_URL`/
   `SUPABASE_WEB_SERVICE_ROLE_KEY` están configurados, cargar SKU a 28 productos que no lo tienen,
   subir foto a 10 productos sin coincidencia en Tiendanube.
2. **(Opcional, grande)** Migrar a Supabase Auth + RLS por rol; partir `api/index.js` en routers.

> BIZ-02 atómico y la unificación de helpers de escape ya están hechos (v18 y v20, ver
> `docs/SNAPSHOT.md`).

---

## Trampas ya descubiertas (no repetir)

- `confirmarEntrega` existía en `ot.js` y `pago.js`. Las de venta ahora son `confirmarEntregaVenta` /
  `cancelarEntregaVenta`.
- Modales de caja: Finanzas usa `modalAbrirCaja` / `modalCerrarCaja`; el POS usa `modalAperturaPos` /
  `modalCierrePos` (renombrados para no colisionar).
- El POS descarta `codigo_barras` al guardar `venta_items`. Por eso el buscador resuelve el barcode
  contra el catálogo (`productos`), no contra el ítem de venta.
