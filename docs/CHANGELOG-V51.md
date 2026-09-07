# CHANGELOG v51 — Fase 1 del plan de crecimiento: Inteligencia del negocio

**Fecha:** 07-09-2026 · **Rama:** `main` · **Plan:** `docs/PLAN-CRECIMIENTO-2026.md`, Fase 1.

Esta versión no agrega una función comercial nueva: agrega la capacidad de **saber**. Es la Fase 1
del plan (“la verdad de los datos”), la única que no dependía de conseguir ninguna credencial.

---

## 1. Nuevo panel: Finanzas → 🧠 Inteligencia

Tercera pregunta del módulo Finanzas, distinta de las dos que ya existían:

| Panel | Pregunta que responde |
|---|---|
| Balance | ¿Cómo está la caja? |
| Utilidades | ¿Cuánto gané? |
| **Inteligencia (nuevo)** | **¿En qué me conviene poner la plata, y qué datos tengo mal?** |

Va **dentro de Finanzas**, así que hereda el gate de PIN y la expulsión por inactividad sin código
nuevo: los márgenes y los costos son datos sensibles y no deben quedar a la vista del rol
`trabajador`.

**Contenido del panel:**
- **Alertas**, ordenadas por plata en juego (no por orden de aparición).
- **6 KPIs**: facturado, utilidad bruta y margen, ticket promedio y productos por venta, capital
  dormido, concentración del margen, ventas sin cliente identificado.
- **Los cuatro cajones del catálogo** — cada producto vendido cae en `ancla` / `gancho` / `joya` /
  `lastre` según rotación y margen, y cada cajón trae escrita su política.
- **Ranking por margen generado** (no por monto facturado) con acumulado, para ver dónde se corta
  el 80%.
- **Capital dormido**: stock con existencias que nunca registró una venta.
- **Auditoría del catálogo**: 8 indicadores de calidad de datos + las tablas de los casos concretos.
- **Mes a mes**: facturación, utilidad, margen y ticket.

**Filtro de período**: abre en **“Todo el histórico”** a propósito (no en el mes, como Balance y
Utilidades). Con pocos meses de datos, las señales de rotación y capital dormido no se leen en un
mes suelto.

---

## 2. Backend — `GET /api/pos/inteligencia`

`auth(true)` (solo admin). Acepta `?desde=&hasta=` en `YYYY-MM-DD`, opcionales; sin ellos devuelve
todo el histórico.

Agrupa en JS sobre `ventas`, `venta_items` y `productos`, igual criterio que
`/api/pos/mas-buscados`: el volumen real (cientos de ventas, ~150 productos) no justifica una RPC
nueva. Hay un comentario en el código diciendo cuándo habría que mover el agrupado a SQL.

### Tres trampas de negocio que el endpoint respeta a propósito

1. **Los servicios técnicos tienen costo $0 legítimo** (son mano de obra), así que su margen es
   100% por definición. Mezclarlos con los productos falsea todo ranking. Van marcados con
   `esServicio` y quedan fuera de los cajones y de la alerta de “costo en $0”. Como `productos` no
   tiene columna `es_servicio` (solo `venta_items` la tiene — pendiente conocido del SNAPSHOT), se
   detectan por `categoria_web === 'Servicios Técnicos'` o `stock_ilimitado`.

2. **El margen se calcula sobre el costo guardado EN LA VENTA** (`venta_items.costo_unitario`), no
   sobre el costo actual del producto: si el costo de reposición subió después, la utilidad
   histórica no cambia.

3. **Costo $0 son dos casos distintos que se ven igual en los números**, y se informan por separado:
   - un producto del catálogo (`producto_id` no nulo) vendido con costo 0 → error de datos real,
     infla la utilidad;
   - un ítem escrito a mano en el POS que nunca existió como producto (`producto_id` nulo) → no hay
     costo que cargar porque no hay ficha. No es un error del catálogo, pero deja utilidad sin
     respaldo y no se puede medir su rotación.

   La primera versión del endpoint los mezclaba y reportaba “23 productos con utilidad inflada”
   cuando en realidad **solo 1 era un producto del catálogo** y el resto eran ítems sueltos. Se
   corrigió antes de dar el dato por bueno.

### El margen se publica como RANGO, no como una cifra sola
Un ítem vendido con costo $0 aporta el 100% de su precio a la utilidad. El margen global no
distingue si eso es correcto (mano de obra) o un dato faltante, así que **una sola cifra se lee como
exacta cuando puede estar bastante inflada**. El endpoint calcula `utilidadSinCosto` y
`margenPisoPct`, descontando los servicios que el sistema **puede probar** que lo son (ítem marcado
`es_servicio`, o producto en la categoría de servicios / con stock ilimitado): ahí el costo $0 está
demostrado, no es una duda. Lo que queda son los casos realmente dudosos.

Con los datos reales: margen reportado **30,9%**, piso **24,2%**, y **$386.000 (22% de la utilidad)**
sin costo confirmado. El margen real está entre esos dos y más cerca del alto — al separar a mano los
servicios escritos a mano, solo **$182.000 (10% de la utilidad)** son productos sin costo de verdad,
lo que deja el margen realista en torno al **29%**.

### Los cortes no son números inventados
`ancla`/`gancho`/`joya`/`lastre` se deciden comparando cada producto contra la **mediana de
rotación y la mediana de margen del propio catálogo vendido en el período**, no contra un umbral
fijo. Así el corte se mueve solo cuando cambia la mezcla de productos. Los cortes usados van en la
respuesta (`cortes`) y se muestran en pantalla.

---

## 3. Hallazgos reales contra la base de producción

Corridos contra la base real, no contra datos de prueba. **167 ventas, 03-08-2026 → 06-09-2026.**

| Dato | Valor real |
|---|---|
| Facturado histórico | **$5.811.000** (ago: $4.909.000 · sep parcial: $902.000) |
| Utilidad bruta | $1.794.063 → **margen 30,9%** |
| Ticket promedio | $34.796 |
| Productos por venta | **1,28** |
| Capital en stock (al costo) | $4.800.779 |
| **Capital dormido** | **$1.954.370 — 41%, en 43 productos que nunca vendieron nada** |
| Concentración | 10 productos hacen el **44%** del margen; 20 hacen el 62% |
| **Ventas sin cliente identificado** | **166 de 167** |
| Ventas sin DTE | 117 de 167 |
| Entrega | 165 de 167 retiro presencial · 165 de 167 pago presencial |

**Auditoría del catálogo (132 productos activos):** 21 sin costo cargado, 10 con margen bajo 15%,
0 vendiendo bajo el costo, 50 sin SKU, 13 sin foto, 19 sin ficha, 47 sin peso ni medidas.

**Dato que cambia el plan:** el dueño confirmó que casi todas las ventas nacen en **Facebook
Marketplace publicado desde su cuenta personal**, se coordinan por WhatsApp y terminan en retiro
presencial. Los datos lo respaldan (165/167 retiro presencial, tienda web con ~4 pedidos). Ver la
sección revisada de la Fase 3 en `docs/PLAN-CRECIMIENTO-2026.md`.

---

## 4. Corrección de datos aplicada

**HP ProDesk 400 G1 (id 181)** — el dueño confirmó que es **reacondicionado** (estaba como
“nuevo”, puesto por el `DEFAULT` de la columna, nunca revisado). Tercer HP con el mismo problema.
Se corrigió `condicion`, se movió de subcategoría `Nuevos` → `Reacondicionados` y se agregó
“Reacondicionado” al nombre, porque su ficha está vacía y el nombre era el único lugar donde el
cliente podía enterarse. **Verificado que el trigger de sincronización lo empujó solo a
`productos_web` de la tienda** (nombre y subcategoría ya actualizados ahí).

---

## 5. Archivos tocados

| Archivo | Cambio |
|---|---|
| `api/index.js` | `GET /api/pos/inteligencia` + helpers `intelTraerTodo`, `intelEsServicio`, `intelMediana` |
| `js/api.js` | bloque `API.inteligencia.obtener()` |
| `js/inteligencia.js` | **nuevo** — todo el pintado del panel |
| `js/balance.js` | rama `inteligencia` en `mostrarPanelFinanzas()` (carga perezosa, abre en “todo”) |
| `index.html` | subtab + ítem de sidebar + panel `data-panel-finanzas="inteligencia"` + `<script>` |
| `css/styles.css` | `.intel-alerta*`, `.intel-chip*`, `#intelContenido.cargando` |

---

## 6. Cómo se probó

- **Endpoint contra producción real**: se levantó el `app` de Express con las credenciales reales y
  `app.listen(0)`, se firmó un JWT de admin y se llamó al endpoint. HTTP 200 y las cifras de la
  sección 3. Solo lecturas.
- **Panel en jsdom**: `index.html` real + `api.js`/`config.js`/`balance.js`/`inteligencia.js`
  reales, con `API.inteligencia.obtener` devolviendo el informe REAL del endpoint. Se verificó:
  período, 7 alertas, los 6 KPIs con sus valores, 4 pestañas de cajón, cambio de cajón al hacer
  click (`ancla` → `lastre` repinta), 20 filas de ranking, 20 de capital dormido, 8 chips y 2 tablas
  de auditoría, 2 filas de meses, **0 toasts de error y 0 `<script>` inyectados** (todo nombre de
  producto pasa por `escHtml`).
  *Nota para la próxima vez:* concatenar **todos** los `js/*.js` en jsdom cuelga la prueba (módulos
  con `setInterval`/polling que nunca terminan). Cargar solo los archivos que el panel necesita.
- `node --check` en los 4 archivos JS tocados.
- Los dos chequeos obligatorios (colisión de funciones globales y de `id` en `index.html`): **ambos
  vacíos**.
- Tailwind **no** se recompiló: el panel no usa ninguna clase de utilidad nueva, solo clases propias
  agregadas a `css/styles.css` y las que ya existían.

---

## 7. Qué NO se hizo (a propósito)

- **No se tocó el stock del Adaptador HDMI a VGA (id 104)** — el dueño lo hace él desde el POS.
- **No se cargó ningún costo faltante**: el panel los lista, pero los montos reales los sabe el
  dueño. Inventarlos sería peor que dejarlos en $0.
- **No se exporta a Excel/PDF todavía** — Utilidades y Métricas sí lo tienen; acá se dejó para
  cuando el informe automático de la Fase 7 defina qué formato conviene.
