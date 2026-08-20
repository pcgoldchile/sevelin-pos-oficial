# Sevelin POS — Documentación Maestra

> **Este es el documento de referencia único del proyecto.** Reemplaza y consolida todos los README
> y LEEME anteriores. Está escrito para que otra persona —o una IA en una sesión nueva— retome el
> trabajo sin contexto previo.
>
> **Estado:** v16 · 19 de agosto de 2026 · en uso operativo real.
>
> **Cómo se versiona la documentación (importante):**
> Este README maestro se mantiene **siempre al día** con el estado actual del sistema. Cada entrega
> nueva se documenta **además** en su propio archivo de cambios `docs/CHANGELOG-Vx.md` (V9, V10, …),
> que describe solo lo que cambió en esa versión y **depende de este documento** para el contexto.
> Así este README no se satura y el detalle histórico queda en los changelog. Ver la sección 12.

---

## 0. Cómo leer este documento

Si vas a retomar el trabajo, empieza por la **sección 10 (lo que falta)** y la **sección 11 (bugs ya
corregidos)**: es lo que más tiempo ahorra. Para desplegar, la **sección 9**.

---

## 1. Qué es este proyecto

Punto de Venta a medida para la tienda **Sevelin** (Arica, Chile), un negocio de venta y reparación
de equipos electrónicos. Nació como práctica profesional de un Técnico de Nivel Superior en
Informática y está en uso operativo real.

Cubre: ventas en caja, inventario con costos FIFO, finanzas y balance por canales de dinero, arqueo
de caja, servicio técnico (órdenes de trabajo), abonos, repuestos de taller, gastos, mermas, reportes
de negocio y control de acceso por roles.

- **Producción:** https://sevelin-pos-oficial.vercel.app
- **Repositorio:** https://github.com/pcgoldchile/sevelin-pos-oficial

Existe una **app Android complementaria** (Sevelin Print) que corre en la máquina de pago TUU Pro 2 y
consume esta misma API.

---

## 2. El stack (y tres reglas que evitan romperlo)

> **No usa React ni Vue.** Es **JavaScript vanilla**: cada módulo es un `.js` plano cargado con
> `<script src>`, y **todos comparten el ámbito global**. Esto tiene una consecuencia crítica de
> mantenimiento — ver la regla de oro en 2.2.

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + JavaScript vanilla |
| Estilos | CSS propio (`styles.css`) + **Tailwind compilado** (no CDN) |
| Backend | Node.js + Express, serverless en Vercel |
| Autenticación | JWT, token en `sessionStorage` |
| Base de datos | Supabase (PostgreSQL), acceso **solo** desde el backend |
| Reportes | SheetJS (Excel), jsPDF + AutoTable (PDF) |

### 2.1 Tailwind está compilado

`css/tailwind.css` es un archivo generado, no viene de CDN. Si agregas clases de Tailwind, **recompila**:

```bash
npm run css          # compila una vez, minificado
npm run css:watch    # recompila al guardar
```

Si no recompilas, la clase no existe en el archivo y no se ve. El orden de las hojas importa:
`styles.css` va **antes** que `tailwind.css`; invertirlos cambia estilos.

### 2.2 ⚠️ LA REGLA DE ORO: cuidado con el ámbito global

Como todos los `.js` comparten el ámbito global, **dos archivos no pueden declarar una función con el
mismo nombre**: la que carga después pisa a la otra **en silencio**, sin error en consola, y rompe algo
en un módulo lejano. Esto ya causó tres bugs graves (ver 11). Y el problema inverso también existe:
**usar una función que no está definida en el frontend** lanza `ReferenceError` y aborta el flujo (el
bug de los botones de Finanzas en la v9 fue exactamente esto: `num()` solo existía en el backend).

**Antes de declarar o usar una función global, verifícalo:**

```bash
# ¿alguien ya declaró esta función? (debe salir a lo sumo una vez)
grep -rn "function nombreDeLaFuncion" js/

# CHEQUEO OBLIGATORIO tras tocar varios archivos: funciones duplicadas
# (este patrón captura también las funciones indentadas y las async —
#  el patrón viejo con '^(async )?function' se saltaba las indentadas y
#  dejó pasar la colisión de confirmarEntrega, ver sección 11)
for f in js/*.js; do grep -oP '^\s*(async\s+)?function\s+\K[A-Za-z_$][\w$]*' "$f"; done \
  | sort | uniq -d
# ↑ debe salir VACÍO. Si sale algo, hay una función pisando a otra.
```

Los helpers globales canónicos viven en `js/config.js` (carga primero): `fmtCLP`, `escHtml`, `num`,
fechas de Chile, toast. **Reutilízalos, no los redefinas.**

---

## 3. Arquitectura

```
Navegador (vanilla JS)          App Android (Sevelin Print)
      │                                │
      │  fetch + JWT en Authorization
      ▼                                ▼
Backend Express  (api/index.js, serverless en Vercel)
      │  llave secreta desde variables de entorno
      ▼
Supabase / PostgreSQL
```

Reglas que hay que respetar:

1. El navegador **nunca** conoce las credenciales de Supabase.
2. **`js/api.js` es el único punto de contacto con el backend.**
3. Las validaciones críticas se hacen en el **servidor**, no solo en la interfaz. Un trabajador que
   llame la API directo tampoco ve costos ni puede saltarse un 403.
4. Totales, comisión, desglose de pago, precio/stock válidos y duplicados los valida el backend.
5. El consumo FIFO se resuelve en la base con `plpgsql`, no en JavaScript.
6. El valor esperado del arqueo lo calcula el servidor (arqueo ciego).

---

## 4. Estructura de archivos

```
sevelin-pos/
├── index.html                  ← TODA la interfaz (vistas + modales)
├── tailwind.config.js
├── package.json
├── vercel.json                 ← rewrite /api/(.*) → /api/index  +  cabeceras de seguridad
├── .env.example                ← plantilla. El .env real NO se versiona ni se comparte
│
├── css/
│   ├── styles.css              ← CSS propio (secciones numeradas)
│   ├── tailwind.css            ← COMPILADO. Se sube al repo
│   └── tailwind-input.css      ← Fuente. NO se enlaza
│
├── js/
│   ├── api.js          ← Cliente HTTP único
│   ├── config.js       ← Helpers globales: fmtCLP, escHtml, num, fechas Chile, toast
│   ├── auth.js · pinpad.js     ← Login por PIN (campo de texto, admite letras), roles
│   ├── pos.js · pos-layout.js  ← Carrito, venta, y el redimensionado del POS
│   ├── pago.js         ← Medios de pago, vuelto, pago mixto, paso de DTE
│   ├── balance.js      ← Finanzas: balance, gastos fijos, inyecciones, arqueo,
│   │                      widget de saldos por canal, traspasos, resguardo
│   ├── finanzas-gate.js    ← PIN obligatorio al entrar a Finanzas (req. seguridad)
│   ├── finanzas-ajustes.js ← Ajuste manual de saldos, checklist de fijos, aportes
│   ├── productos.js · lotes.js · tiendanube.js
│   ├── historial.js · compras.js · mermas.js
│   ├── repuestos.js · ot.js · encargos.js
│   ├── reportes.js · escaner.js · etiquetas.js · print.js · atajos.js
│   └── vendor/qrcode.min.js
│
├── api/index.js                ← TODO el backend
│
├── sql/                        ← Migraciones, EN ORDEN (01 … 18)
│
└── docs/                       ← documentación (empezar por README-DOCS.md)
    ├── README-DOCS.md          ← índice: qué leer según lo que necesitas
    ├── SNAPSHOT.md             ← foto del estado actual (punto de retomada)
    ├── README.md               ← el maestro (este archivo)
    ├── README-DESPLIEGUE.md    ← guía de despliegue detallada
    ├── AUDITORIA-SEGURIDAD-SEVELIN-POS.md
    ├── CHANGELOG-V10.md … CHANGELOG-V16.md  ← changelogs recientes
    └── archivo/                ← histórico: READMEs viejos y CHANGELOG-V5…V9
```

> **`api/index.js` debe llamarse exactamente así y estar en `api/`.** Si queda en la raíz, Vercel lo
> sirve como estático y todas las rutas dan "Endpoint no encontrado". En Windows con extensiones
> ocultas, vigila que no quede como `index.js.js`.

### Orden de carga de scripts

`config.js` va **primero** (define los helpers globales que todos usan), luego `api.js`, `auth.js`, y
el resto. `pos-layout.js` va después de `pos.js`.

---

## 5. Roles y control de acceso

| Acción | Admin | Trabajador |
|---|---|---|
| Registrar ventas e imprimir tickets | ✅ | ✅ |
| Ver historial y reimprimir | ✅ | ✅ |
| Ver costos, utilidades y KPIs de ganancia | ✅ | ❌ (el servidor ni los envía) |
| Módulo Productos y Finanzas | ✅ | ❌ oculto y bloqueado |
| Crear / editar / eliminar productos | ✅ | ❌ 403 |
| Editar o eliminar ventas | ✅ | ❌ 403 |
| Cambiar el tipo de DTE de una venta | ✅ | ❌ 403 (y queda auditado) |
| Mover fondos entre canales (traspaso) | ✅ | ❌ |

El bloqueo **no es solo visual**: los endpoints devuelven 403 y las respuestas para trabajador salen
sin `costo_total`, `utilidad` ni `costo_unitario`.

---

## 6. Módulos principales

### 6.1 POS (caja)
Carrito, búsqueda por nombre/SKU/código, escáner, modo edición, dividir venta, pago mixto, y el paso
de selección de DTE. El área es **redimensionable**: se arrastra la esquina y las dos tarjetas
(Ingresar producto / Carrito) crecen juntas; el tamaño se guarda por equipo en `localStorage`.

### 6.2 Finanzas
**Acceso protegido:** al entrar a Finanzas se pide el **PIN de administrador cada vez** (aunque la
sesión esté abierta), y se vuelve a pedir al salir y regresar. Lo maneja `js/finanzas-gate.js`,
validando contra `POST /api/verificar-pin`.

Sub-pestañas, en orden: **Historial de Ventas** (por defecto) · Balance · Gastos · Gastos Fijos.

**Widget de 4 tarjetas** (Efectivo · Banco · Total · Resguardo). Efectivo y Banco tienen un lápiz que
abre un modal de **ajuste manual con justificación obligatoria e historial** (los ajustes guardan un
delta, no reescriben el saldo). El Total no se edita: se calcula. La tarjeta Resguardo muestra la suma
de **gastos fijos pendientes del mes** y abre un **checklist** con el cuadre saldo-vs-pendiente.
Botones: traspaso interno y **gestión de aportes de capital** (historial, agregar, borrar con aviso de
efecto en el saldo). En el Balance, el gasto en **mercadería** se resalta como bloque destacado.

**Widget de saldos por canal** (vive dentro del panel Balance): calcula en tiempo real cuánto hay en
**Efectivo (caja chica)** y en **Banco (cuentas)**, más el total. El canal de cada movimiento lo
deriva el backend del método de pago (`esEfectivo()`), sin una columna redundante que pueda
desincronizarse. Se refresca tras cada venta/gasto/OT vía el evento `pos:movimiento-dinero`.

- **Traspaso interno:** mueve dinero entre efectivo y banco (ir al banco a depositar la recaudación).
  No es ingreso ni gasto: deja el total intacto y solo reparte.
- **Resguardo:** define un mínimo de caja y una ventana de días. El **badge de cobertura** avisa si el
  saldo no alcanza para los próximos vencimientos de Gastos Fijos, y sugiere un traspaso si la plata
  está en el canal equivocado.
- **Gastos Fijos:** plantilla de compromisos recurrentes. No se registran solos (si lo hicieran, un
  mes impago aparecería como gasto y el balance mentiría); el botón 💸 los convierte en un gasto real
  preguntando si el monto o la fecha cambiaron.

### 6.3 Servicio Técnico
Órdenes de trabajo con Check-In (recepción) y Check-Out (entrega con firma). El **número de OT
(`OT-000001`) lo asigna un trigger de la base**, no la app, para que dos check-in simultáneos no
choquen. Incluye repuestos por OT, notas y abonos.

### 6.4 Productos e inventario
Catálogo con paginación, importación desde Tiendanube, alertas de bajo stock, y **costos FIFO por
lotes** (capas de costo resueltas en la base). Caché de 90 s que se invalida en toda mutación.

---

## 7. Seguridad (estado tras la auditoría de agosto 2026)

Se hizo una auditoría ofensiva completa. **Todas las prioridades están cerradas.** Resumen:

| Área | Estado |
|---|---|
| Credenciales rotadas (service_role, JWT, PINs) + RLS activa | ✅ |
| Escape de HTML en todo dato de usuario (`escHtml`) — anti-XSS | ✅ |
| Precio/costo negativo y stock insuficiente rechazados en el servidor | ✅ |
| Documentos de compra en bucket privado con URLs firmadas | ✅ |
| CSP en el front (vercel.json) y en la API (helmet) | ✅ |
| Cambio de DTE solo admin + tabla de auditoría (`auditoria_dte`) | ✅ |
| CORS sin fallback a `*`, PINs de fábrica rechazados al arrancar | ✅ |

Detalle completo en `docs/AUDITORIA-SEGURIDAD-SEVELIN-POS.md`.

**Reglas de seguridad permanentes:**
- El `.env` real **nunca** se sube a git ni se comparte por chat. Solo existe `.env.example`.
- Los PINs admiten letras/símbolos: usa claves de verdad, no 4 dígitos.
- Todo dato de usuario que se interpole en `innerHTML` pasa por `escHtml`.

---

## 8. Modelo de datos

22 tablas en el esquema `public`. Las principales: `productos`, `ventas`, `venta_items`,
`producto_lotes` (FIFO), `compras` (gastos), `inyecciones_capital`, `arqueos`, `ordenes_trabajo`,
`ot_repuestos`, `encargos`, `gastos_fijos`, `traspasos`, `config_finanzas`, `auditoria_dte`.

El SQL vive en `sql/`, en migraciones numeradas **que deben correrse en orden**. La última es la 15.

> **Nunca recrees la base desde el "schema for context only" de Supabase:** ese export lista tablas
> pero **no incluye triggers, funciones ni secuencias**. Recrear desde ahí rompe el número de OT
> (falta el trigger) y los costos FIFO (faltan las funciones). Corre siempre los archivos `sql/`.

---

## 9. Despliegue (resumen)

Guía completa en `docs/README-DESPLIEGUE.md`. Resumen del flujo:

1. **Base de datos:** en Supabase → SQL Editor, corre las migraciones `sql/` que falten, **en orden**.
   Todas son idempotentes.
2. **Bucket privado:** pon `compras-documentos` en privado (Storage → Buckets).
3. **Variables de entorno** en Vercel (nunca en un archivo): `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_PIN`, `WORKER_PIN`, `CORS_ORIGINS`,
   `NEGOCIO_NOMBRE`. Ver `.env.example`.
4. **Despliega el backend**, verifica `curl .../api/health`.
5. **Despliega el frontend** (`css/tailwind.css` ya viene compilado).

---

## 10. Lo que falta (backlog)

Estado a v16. Lo que ya se completó (caja por turnos, despacho/envíos, escáner, ventas por pagar,
gastos programados, buscador de ventas) está en los changelogs V12–V16 y en las secciones de este
maestro.

**Pendientes técnicos (no bloqueantes):**
- **BIZ-02 atómico:** la validación de stock y el descuento no son una sola transacción para productos
  sin lotes. Ventana muy estrecha en un mostrador; la solución es `SELECT ... FOR UPDATE` en Postgres.
- **Migrar a Supabase Auth + RLS por rol:** hoy la autorización vive en el backend (`service_role`
  omite RLS). Es un refactor grande, opcional para un negocio de un solo local.
- **Unificar los 5 helpers de escape** (`escaparHTML`, `escaparTexto`, etc.) en el único `escHtml`.
- **`id` duplicado `kpiUtilidadNeta`:** aparece en dos vistas de KPI (Balance e Historial). Preexistente,
  no rompe nada visible, pero conviene renombrar uno para que ambos se actualicen siempre.
- **Refactor de archivos grandes:** `api/index.js` (~3800 líneas) e `index.html` siguen creciendo. En
  algún punto conviene partir el backend en routers por dominio. Decisión tomada: no ahora, priorizar
  features.

**Integración e-commerce (sevelin.cl), preparada pero no conectada:**
- Las columnas de despacho (`tipo_entrega`, `estado_envio`, `numero_seguimiento`…) y de comisión de
  pasarela (`origen_pago`, `comision_pasarela`) ya existen y el POS las usa. Falta el sitio web que
  cree ventas por la API con `origen_pago = 'pago_web'`.

---

## 10.1 Migraciones SQL aplicadas (referencia rápida)

Corren en orden, todas idempotentes. Las más recientes:

- `16-ajustes-saldo-y-gasto-fijo.sql` — ajustes manuales de saldo; vínculo gasto fijo ↔ compra.
- `17-caja-diaria-y-despacho.sql` — `cajas_diarias`, `caja_movimientos`; columnas de despacho y
  comisión en `ventas`.
- `18-gastos-programados.sql` — `gastos_programados` (pendientes / cuotas de tarjeta de crédito).

---

## 11. Bugs corregidos memorables (para no repetirlos)

- **Colisión de funciones globales** (`cerrarModal`, `descargarArchivo`): dos archivos con el mismo
  nombre de función, la segunda pisa a la primera en silencio. Dejó "Nuevo Producto" atrapado y bajó
  respaldos con nombre y contenido invertidos. → Regla de oro (2.2).
- **`num()` no definida en el frontend:** el widget de saldos y los botones de Traspaso/Resguardo la
  usaban, pero solo existía en el backend. `ReferenceError` abortaba la apertura del modal: los
  botones "no hacían nada". → `num` ahora es helper global en `config.js`.
- **Check-In de OT roto:** el trigger que asigna `numero_ot` se perdió (base recreada desde el
  diagrama). → migración 13, y la regla de no recrear desde el "schema for context" (sección 8).
- **XSS persistente vía nombre de producto/cliente:** datos de usuario a `innerHTML` sin escapar. →
  `escHtml` en todos los módulos.
- **Precio negativo:** una línea de venta con precio `-9000` cuadraba arqueos con un descuento falso.
  → rechazado en el servidor.
- **Casilla "Editar hora" bloqueada tras agregar producto (v11):** la cabecera sticky del carrito
  (z-index) tapaba el clic, y el campo quedaba `disabled` tras una venta. → bloque de controles elevado
  con `z-index` y el checkbox re-habilita el campo siempre.
- **Colisión `confirmarEntrega` (v14):** una en `ot.js` (entrega de OT) pisaba a la de `pago.js`
  (entrega de venta), y el cobro se colgaba tras el DTE. → las de venta se renombraron a
  `confirmarEntregaVenta` / `cancelarEntregaVenta`. **Reveló que el chequeo anti-colisión viejo no
  capturaba funciones indentadas** — ver el patrón corregido en 2.2.
- **Colisión de `id` de modal caja Finanzas vs POS (v13):** `modalAbrirCaja`/`modalCerrarCaja` existían
  en dos vistas; `getElementById` tomaba siempre el primero y los del POS quedaban muertos. → los del
  POS se renombraron a `modalAperturaPos`/`modalCierrePos`.
- **`fechaHoyChile` no existe en el frontend (v15):** un módulo la referenció (solo está en el backend);
  al no estar definida, lanzaba `ReferenceError` silencioso. → usar `todayISO()` (el helper real del
  frontend, en `config.js`) y proteger con `typeof`.
- **Lotes "no pasaba nada" al cargar (v15):** si se activaba la casilla de lotes pero no se guardaba el
  producto, el backend rechazaba y el error no se mostraba. → feedback garantizado con try/catch amplio
  y detección explícita del producto sin guardar.

---

## 12. Cómo versionar la documentación de aquí en adelante

El sistema de documentación tiene **tres piezas**, cada una con un rol distinto:

1. **`docs/README.md` (este archivo) — el maestro.** Refleja siempre el estado actual completo:
   arquitectura, reglas, módulos, modelo de datos, despliegue, backlog y bugs memorables. Es la fuente
   de verdad. Se actualiza cuando un cambio altera algo estructural.

2. **`docs/CHANGELOG-Vx.md` — el detalle por versión.** Cada entrega añade el suyo. Describe solo lo
   que cambió en esa versión y **depende del maestro** para el contexto (no repite la arquitectura).

3. **`docs/SNAPSHOT.md` — el punto de retomada.** Un resumen corto y accionable del estado *ahora
   mismo*: en qué se está trabajando, qué se acaba de terminar, qué falta, y las trampas activas. Es lo
   que se pega o se lee **al abrir un chat nuevo o llevar el proyecto a otra IA**. Se actualiza al
   cerrar cada sesión de trabajo. A diferencia del maestro (exhaustivo), el snapshot es breve y va
   directo a "por dónde sigo".

**Regla de actualización al cerrar una sesión:** actualiza el `SNAPSHOT.md` (siempre) y, si el cambio
fue estructural, la sección correspondiente del maestro. Crea el `CHANGELOG-Vx.md` de la versión.

Los README históricos (V5–V8) viven en `docs/archivo/` como registro; **este maestro los reemplaza**
como fuente de verdad.
