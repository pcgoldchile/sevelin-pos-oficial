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

## Cómo probar

- **Diseño y pantallas (app de escritorio de Claude):** sí hay navegador real, el panel integrado.
  Se abre la **maqueta** con la config `pos-maqueta` de `.claude/launch.json`
  (`scripts/maqueta-pos.js`, puerto 4180): el frontend real con una API simulada y 10 productos
  reales. No toca Supabase ni producción, y cualquier PIN entra (como admin; `trabajador` entra
  como trabajador). Nunca se prueba con el PIN real ni contra la base real.
- **Tienda (sevelin-tienda):** config `tienda-maqueta` (`scripts/maqueta-tienda.mjs` de ese repo, puerto
  3100): la tienda real contra un Supabase simulado con 40 productos, sesiones de prueba
  (`http://localhost:54399/maqueta/entrar?quien=mayorista|pendiente|cliente|salir`) y un Khipu falso.
  No toca la base real, no manda correos y no cobra.
- **Backend:** supabase-js real con un `fetch` falso que imita a PostgREST, o doble en memoria de
  Supabase (mock de `createClient` vía `require.cache`), y el `app` de Express con `app.listen(0)`.
- **Frontend sin navegador:** **jsdom** — se concatenan los `js/*.js` en orden y se evalúan en un
  `window`. jsdom se borra al instalar playwright; reinstalar con `npm install jsdom --no-save`.
- **Validar SQL:** `python3 -c "import pglast; pglast.parse_sql(open('sql/NN.sql').read())"`.
- **Sintaxis:** `node --check` en cada `.js` tocado.
- **Lo que igual no se puede probar aquí:** la cámara real, la pistola lectora USB real y el
  celular: se razonan y se dicen como no probados.

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

## ⚠️ Modelo y esfuerzo: avísame ANTES de cada tarea (regla del dueño, 08-09 y 30-09-2026)

**El dueño trabaja en Sonnet por defecto** para ahorrar. Pidió expresamente que **le avises ANTES de
empezar** si la tarea que acaba de mandar es de las que conviene hacer en Opus. **Desde el 30-09-2026
también el ESFUERZO** (control "Esfuerzo" de la app, de más rápido a más inteligente):

| En la app | Interno | Qué hace |
|---|---|---|
| Bajo | `low` | Lo mínimo: pocas herramientas, pocos tokens. |
| Medio | `medium` | Barato, cambia algo de inteligencia por costo. |
| **Alto** | `high` | El equilibrado; la app lo marca "Recomendado". |
| Extra | `xhigh` | Razona más a fondo, gasta más tokens. |
| Máximo | `max` | El razonamiento más profundo, sin tope de tokens. Solo dura la sesión. |
| Ultracode | `xhigh` + agentes | **No es un nivel**: corre en Extra y, en tareas grandes, reparte el trabajo entre VARIOS agentes en paralelo. Solo dura la sesión. El más caro. |

Fuente oficial (Claude Academy, verificado 30-09-2026): *"Ultracode is not an effort level. It is a
session-only Claude Code setting that runs the model at xhigh and... fans work out to multiple agents"*,
y el consejo es **partir del recomendado y subir de a un nivel**, no saltar al máximo.
`get_session("self")` dice qué esfuerzo corre de verdad (con Ultracode marcado, reporta `xhigh`).

**Cómo avisar:** una sola línea al principio de tu respuesta, antes de tocar nada, SIEMPRE que la tarea
sea más que trivial — aunque ya esté en el modelo correcto (así sabe que lo pensaste). Por ejemplo:
> ⚙️ Recomendado: **Opus · Extra** — toca precios y cruza los dos repos. Hoy estás en Sonnet · Alto.
> ¿Cambias o sigo?

Y después **espera su respuesta** si hay que cambiar algo. Si ya está bien configurado, dilo en esa
línea y sigue. Si dice que sigas igual, sigues — es su decisión, no la discutas dos veces.

**Guía de esfuerzo** (combínala con la de modelo de abajo):
- **Bajo / Medio:** textos, CSS, un campo o chip siguiendo un patrón que ya existe, cargar datos con
  regla clara, arreglar algo ya diagnosticado.
- **Alto:** una función nueva mediana en un repo, varios archivos, con pruebas (lo normal).
- **Extra:** cruza los dos repos o las dos bases, migración + sincronización, plata (precios, márgenes,
  IVA), permisos o datos personales, legal.
- **Máximo:** auditorías y decisiones de negocio donde un número mal leído cuesta plata, seguridad,
  diseñar algo grande desde cero (ej. venta mayorista).
- **Ultracode:** casi nunca en este proyecto. Sirve para trabajo grande que se puede partir en piezas
  independientes (ej. revisar 150 fichas, auditar dos repos a la vez). **No** para construir funciones:
  aquí todos los `js/*.js` comparten el mismo ámbito global (regla crítica 1) y las migraciones van en
  orden, así que varios agentes editando en paralelo multiplican el costo y el riesgo de pisarse. Si el
  dueño lo tiene puesto para una tarea que no lo necesita, díselo.

**Avisa cuando la tarea:**
- toca **plata**: costos, precios, márgenes, utilidad, comisiones, IVA;
- toca **permisos, autenticación o datos personales** de clientes;
- **cruza los dos repos** (`sevelin-pos-oficial` + `sevelin-tienda`) o toca las dos bases de datos;
- **despliega a producción algo que cobra**, o toca el checkout de la tienda en vivo;
- implica **decidir** en vez de ejecutar: "revisa", "analiza", "¿por qué…?", "¿conviene…?";
- pide una **migración SQL nueva** o cambia un contrato de sincronización;
- exige **dudar de los datos** (auditorías, informes, cualquier cosa donde un número mal leído lleve
  a una decisión de negocio equivocada).

**NO avises (hazlo en Sonnet y punto)** cuando es: un campo más en un modal siguiendo un patrón que
ya existe, un chip o columna en un panel, cargar/corregir datos con una regla clara, textos,
documentación de rutina, CSS o recompilar Tailwind, o arreglar algo que ya está diagnosticado.

**Por qué existe esta regla:** en la sesión del 07/08-09-2026 los hallazgos que evitaron daño real no
salieron de escribir código, sino de desconfiar de lo que los datos parecían decir — el feed con 1 de
cada 3 links en 404, el margen inflado por ítems sin costo, separar el commit de marca sin arrastrar
Khipu al checkout de una tienda en vivo. Ese es el tipo de tarea que justifica el modelo caro.

---

## 📋 Pendientes: la tabla `pendientes` es la lista única (regla del dueño, 30-09-2026)

El dueño lo pidió así: *"siempre digo postergo, postergo, deja pendiente eso"*. Los pendientes ya no viven
solo en la memoria de Claude ni en SNAPSHOT: viven en la tabla `pendientes` (sql/72) y el dueño los ve en
el POS (chip **"Pendientes"** del encabezado, v101). **Autorización permanente del dueño para que Claude
escriba en esa tabla** ("o tú mismo los marques") — solo en esa tabla; el resto de la base sigue igual.

- **Al empezar la sesión:** leer los abiertos (`estado in ('pendiente','postergado')`) con la CLI de
  Supabase y tenerlos en cuenta. Si alguno postergado ya llegó a su `revisar_el`, recordárselo.
- **Cuando el dueño dice "déjalo pendiente", "después", "te aviso":** insertar una fila (`creado_por =
  'claude'`, `responsable` = quien lo tiene que hacer). Si él da fecha o dice "te aviso", `estado =
  'postergado'` con `revisar_el`.
- **Cuando Claude termina algo de la lista:** `estado = 'hecho'`, `hecho_por = 'claude'`, `cerrado_en =
  now()` y **`nota_cierre` con cómo se verificó** (commit, deploy, prueba). Nunca marcar como hecho algo
  del dueño sin que él lo diga o sin evidencia real.
- **Al cerrar la sesión:** la tabla tiene que calzar con lo conversado. SNAPSHOT puede resumir, pero la
  lista buena es la tabla.
- Nunca borrar filas: lo que ya no se hace va a `descartado`.

**Estudio antes de comprar por mayor:** skill `/auditar-producto` (`.claude/skills/auditar-producto/`).
**Revisión de precios:** skill `/revisar-precios` (`.claude/skills/revisar-precios/`): márgenes, mercado y
propuesta de precios normales y mayoristas en `docs/estudios-precios/`. Nunca cambia un precio sin OK.
Informe con veredicto y fuentes; se guarda en `docs/estudios-producto/`.

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
