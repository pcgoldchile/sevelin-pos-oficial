# Sevelin POS — Documentación Técnica del Proyecto

> Documento de traspaso. Resume la arquitectura, el stack, los archivos, el estado
> real de cada módulo y lo que queda pendiente. Escrito para que otra persona (o
> una IA en una sesión nueva) pueda retomar el trabajo sin contexto previo.
>
> **Última actualización:** agosto 2026

---

## 1. Qué es este proyecto

Sistema de Punto de Venta (POS) a medida para la tienda **Sevelin** (Arica, Chile).
Nació como proyecto de práctica profesional de un Técnico de Nivel Superior en
Informática (CFT Estatal Arica y Parinacota) y hoy está en uso operativo real.

Cubre: ventas en caja, inventario, historial con reportes tributarios, servicio
técnico (órdenes de trabajo), abonos y encargos, repuestos internos de taller,
compras/gastos, mermas y control de acceso por roles.

**Producción:** https://sevelin-pos.vercel.app

---

## 2. Advertencia importante sobre el stack

> **Este proyecto NO usa React ni Vue.**
> Es **JavaScript vanilla** (sin framework, sin build, sin bundler). Cada módulo es
> un archivo `.js` plano cargado con `<script src>` en `index.html`, y todos
> comparten el ámbito global del navegador.
>
> Si te piden "actúa como experto en React/Vue" para este repo, la instrucción
> está equivocada: cualquier código React/Vue sería incompatible.

### Stack real

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla | Sin framework ni compilación |
| Backend | Node.js + Express | Función serverless única en Vercel |
| Autenticación | JWT (`jsonwebtoken`) | Token de 12 h en `sessionStorage` |
| Seguridad HTTP | `helmet` + `cors` | Orígenes restringidos por variable de entorno |
| Base de datos | Supabase (PostgreSQL) | Acceso **solo** desde el backend |
| Archivos | Supabase Storage | Bucket `compras-documentos` |
| Reportes | SheetJS (`xlsx`), jsPDF + AutoTable | Excel, CSV y PDF |
| Escáner cámara | `html5-qrcode` (CDN) | Requiere HTTPS |
| Códigos de barras | `JsBarcode` (CDN) | Etiquetas térmicas |
| Códigos QR | `qrcode` **local** en `js/vendor/` | Ver sección 7 |
| Despliegue | Vercel | Estático + serverless en el mismo dominio |

---

## 3. Arquitectura

Arquitectura **cliente-servidor de tres capas**. Originalmente el navegador
consultaba Supabase directamente, lo que exponía las credenciales en el código
descargado. Se migró a este esquema:

```
Navegador (vanilla JS)
      │  fetch + JWT en cabecera Authorization
      ▼
Backend Express  (api/index.js, serverless en Vercel)
      │  service_role key desde variables de entorno
      ▼
Supabase / PostgreSQL  (RLS activo, sin políticas públicas)
```

### Reglas de arquitectura que hay que respetar

1. **El navegador nunca conoce las credenciales de Supabase.** Todo pasa por `/api`.
2. **`js/api.js` es el único punto de contacto con el backend.** Ningún otro
   archivo debe hacer `fetch` a la API directamente.
3. **Las validaciones críticas se hacen en el servidor**, no solo en la interfaz
   (roles, PIN de confirmación, totales de venta, stock).
4. **Los totales de una venta los calcula el backend** a partir de los ítems; el
   cliente no puede alterarlos.
5. **RLS activo en todas las tablas, sin políticas públicas.** Solo la
   `service_role` (backend) puede leer y escribir.

---

## 4. Estructura de archivos

```
sevelin-pos/
├── index.html                  ← TODA la interfaz (vistas + ~29 modales)
│
├── css/
│   └── styles.css              ← Estilos, tema claro/oscuro, responsive, impresión
│
├── js/
│   ├── api.js                  ← Cliente HTTP único (JWT, manejo de 401)
│   ├── config.js               ← Utilidades: fechas Chile, toast, PIN, navegación
│   ├── auth.js                 ← Login por PIN, roles, cierre de sesión
│   ├── pago.js                 ← Selector de medio de pago, vuelto, DTE
│   ├── pos.js                  ← Carrito, venta, vínculo con OT
│   ├── productos.js            ← Catálogo, lotes, importación/exportación
│   ├── historial.js            ← Ventas, KPIs, IVA, comisión, reportes
│   ├── compras.js              ← Gastos, clasificaciones dinámicas
│   ├── mermas.js               ← Bajas de inventario con gasto automático
│   ├── repuestos.js            ← Inventario interno de taller
│   ├── ot.js                   ← Órdenes de trabajo (check-in / check-out)
│   ├── encargos.js             ← Abonos y encargos
│   ├── escaner.js              ← Escáner de códigos por cámara
│   ├── etiquetas.js            ← Etiquetas de código de barras 58/80 mm
│   ├── print.js                ← Ticket térmico, OT, ficha, etiquetas, QR
│   └── vendor/
│       └── qrcode.min.js       ← Librería QR servida localmente
│
├── api/
│   └── index.js                ← TODO el backend (Express, ~1.200 líneas)
│
├── sql/                        ← Migraciones, se ejecutan EN ORDEN en Supabase
│   ├── 01-actualizaciones.sql
│   ├── 02-modulos-compras-ot-ventas.sql
│   ├── 03-stock-alertas-importacion.sql
│   ├── 04-abonos-encargos.sql
│   ├── 05-repuestos-ot-pos.sql
│   ├── 06-stock-ilimitado-areas-categorias.sql
│   ├── 07-dte-hora-cascada.sql
│   ├── 08-mermas-clasificaciones.sql
│   └── 09-lotes-fifo-comision.sql
│
├── package.json
├── vercel.json                 ← Rewrite /api/(.*) → /api/index
├── .env.example
├── .gitignore
└── README-DESPLIEGUE.md        ← Guía de despliegue paso a paso
```

### Ubicaciones críticas (errores frecuentes)

- **`api/index.js` debe estar en `api/`**, no en la raíz. Si queda en la raíz,
  Vercel lo ignora como archivo estático y las rutas nuevas devuelven
  `"Endpoint no encontrado"` aunque el código sea correcto. *Este error ya ocurrió.*
- **`index.html` debe estar en la raíz.**
- **`js/vendor/qrcode.min.js`** con esa ruta exacta, en minúsculas.
- Nombres de carpeta siempre en minúscula (Vercel distingue mayúsculas).

### Orden de carga de scripts (importa)

```html
<script src="js/api.js"></script>       <!-- primero: todos dependen de él -->
<script src="js/config.js"></script>    <!-- utilidades globales -->
<script src="js/auth.js"></script>
<script src="js/pago.js"></script>
<script src="js/productos.js"></script>
<script src="js/historial.js"></script>
<script src="js/escaner.js"></script>
<script src="js/etiquetas.js"></script>
<script src="js/compras.js"></script>
<script src="js/mermas.js"></script>    <!-- después de compras/productos -->
<script src="js/encargos.js"></script>
<script src="js/repuestos.js"></script>
<script src="js/ot.js"></script>
<script src="js/pos.js"></script>
<script src="js/print.js"></script>     <!-- último -->
```

---

## 5. Modelo de datos

| Tabla | Contenido |
|---|---|
| `productos` | Catálogo comercial. Campos Tiendanube, stock mínimo/ilimitado, `usa_lotes` |
| `producto_lotes` | Capas de costo FIFO por producto |
| `ventas` | Cabecera: totales, estado, DTE, comisión Tuu, vínculo a OT |
| `venta_items` | Detalle, con `serial_number` y `detalle_lotes` (JSONB) |
| `compras` | Gastos. Incluye los generados por mermas (`origen = 'MERMA'`) |
| `compra_clasificaciones` | Categorías de gasto administrables |
| `mermas` | Bajas de inventario, vinculadas a su gasto |
| `ordenes_trabajo` | Servicio técnico, correlativo `OT-000001` por trigger |
| `ot_repuestos` | Repuestos y mano de obra asignados a una OT |
| `repuestos` | Inventario interno de taller (Área → Categoría → Modelo) |
| `repuesto_areas` / `repuesto_categorias` | Catálogos administrables del taller |
| `encargos` / `encargo_abonos` | Pedidos con seña y su historial de abonos |

### Decisiones de diseño que conviene conocer

- **Los precios son BRUTOS** (IVA incluido). El IVA contenido se calcula como
  `monto / 1,19 × 0,19`.
- **Ventas "Por Pagar"** quedan en estado `PENDIENTE` y **no suman** a ventas,
  costos ni utilidades hasta que se cobran.
- **El stock de una OT se descuenta al marcarla ENTREGADA**, no al asociar el
  repuesto (esto cambió durante el desarrollo; la bandera `stock_descontado`
  evita descuentos dobles).
- **Los repuestos de una OT no entran al carrito del POS.** Al cobrar solo se
  registra el servicio; el desglose de piezas es interno.
- **`stock_ilimitado`** marca servicios sin inventario físico: se excluyen del
  descuento de stock, de las alertas y de la valorización.
- Las capas FIFO agotadas **se eliminan** para que el desglose muestre solo lotes
  vigentes.

---

## 6. Módulos y estado actual

| # | Módulo | Estado | Detalle |
|---|---|---|---|
| 1 | Login por PIN y roles | ✅ | Admin / Trabajador, JWT, sesión por pestaña |
| 2 | POS / Ventas | ✅ | Carrito, vuelto, DTE, hora editable, foco para lector |
| 3 | Historial | ✅ | KPIs, filtros, IVA, comisión, edición de ítems, selección múltiple |
| 4 | Productos | ✅ | CRUD, Tiendanube, alertas, valorización, etiquetas |
| 5 | Gastos (ex Compras) | ✅ | Clasificaciones dinámicas, documentos, exportación |
| 6 | Servicio Técnico | ✅ | Wizard 3 pasos, firma digital, notas privadas, repuestos |
| 7 | Abonos y Encargos | ✅ | Estados, abonos parciales, comprobante |
| 8 | Repuestos de Taller | ✅ | Jerarquía administrable, valorización |
| 9 | Mermas | ✅ | Descuento de stock + gasto automático |
| 10 | Impresión | ✅ | Ticket 58 mm, OT dos copias, etiquetas, ficha, QR |
| 11 | Comisión Tuu | ✅ | `total × 0,0079 + 65` solo en tarjeta |
| 12 | FIFO por lotes | ✅ backend / ⚠️ frontend | Ver sección 8 |
| 13 | Escáner por cámara | ✅ backend / ⚠️ frontend | Ver sección 8 |
| 14 | Importación masiva | ✅ | Modo omitir/actualizar + PIN |
| 15 | Exportación individual | ⚠️ | Ver sección 8 |
| 16 | Responsive móvil | ✅ | Verificado con navegador real a 390 px |
| 17 | PIN en borrados masivos | ✅ | Validado en servidor |

### Roles

| Acción | Admin | Trabajador |
|---|---|---|
| Registrar ventas, imprimir tickets | ✅ | ✅ |
| Ver historial, reimprimir, cobrar pendientes | ✅ | ✅ |
| Servicio técnico | ✅ | ✅ |
| Ver costos, utilidades, KPIs de ganancia | ✅ | ❌ *(el servidor no los envía)* |
| Productos, Gastos, Repuestos | ✅ | ❌ |
| Editar/eliminar ventas, mermas, importar | ✅ | ❌ (403) |

---

## 7. Historial de bugs corregidos

Documentados porque varios pueden reaparecer al tocar código relacionado:

1. **Credenciales expuestas** — Supabase se consultaba desde el navegador. Se
   migró a backend propio. *Pendiente: rotar la llave pública antigua.*
2. **Fechas en UTC** — `toISOString()` guardaba el día siguiente después de las
   20:00 en Chile. Todo el sistema usa ahora `America/Santiago`.
3. **Fecha de gastos desplazada** — `new Date('2026-08-04')` se interpretaba como
   medianoche UTC. Corregido con conversión explícita.
4. **Segunda hoja en blanco al imprimir** — se ocultaba con `visibility: hidden`,
   que conserva el espacio. Se cambió a `display: none`.
5. **QR no aparecía** — el CDN se llamaba `qrcode.min.js` y los bloqueadores de
   anuncios lo filtraban. Se sirve local desde `js/vendor/`.
6. **PIN incorrecto cerraba la sesión** — el backend devolvía 401 y el frontend lo
   leía como "sesión expirada". Ahora devuelve **403**.
7. **Toast bloqueaba clics** — se le agregó `pointer-events: none`.
8. **Header recortado en móvil** — faltaba `min-width: 0` en los hijos flex.
9. **Huecos verticales en el POS móvil** — `flex-basis` pensado para ancho se
   aplicaba a la altura en `flex-direction: column`.
10. **FK sin CASCADE** — `venta_items_venta_id_fkey` bloqueaba borrar ventas.
    Corregido en SQL 07 + borrado explícito de ítems como respaldo.
11. **Rutas de áreas/categorías rotas** — se usaba el segmento de URL (`areas`)
    como nombre de tabla en vez de `repuesto_areas`.
12. **Renombrado en cascada no se aplicaba** — se leía el nombre anterior después
    de actualizar la fila.
13. **`api/index.js` en la raíz** — Vercel lo ignoraba; las rutas nuevas daban 404.

---

## 8. Lo que falta por hacer

### 8.1 Verificación pendiente (prioridad alta)

Los puntos 12, 13 y 15 tienen el **backend probado y funcionando**, pero su
integración en el frontend **no alcanzó a verificarse end-to-end**:

- **FIFO por lotes (frontend).** Existe el checkbox `#prodUsaLotes`, el modal de
  producto y `agregarLoteProducto()`. Falta confirmar:
  - que las capas se carguen y listen al abrir un producto existente;
  - que la **tabla de productos muestre el desglose** ("Lote 1: 5 un. a $2.000 /
    Lote 2: 10 un. a $2.200"), que era un requisito explícito;
  - que el checkbox quede desactivado por defecto en productos nuevos y existentes.
- **Escáner → carrito.** `pos.js:482` llama a `API.productos.buscarPorCodigo()`.
  Falta probar en navegador con HTTPS que al escanear se agregue el producto
  automáticamente al carrito, y que la búsqueda por `serial_number` funcione.
- **Exportación individual JSON/CSV.** Existen `#btnExportarProducto` y el modal
  `#modalExportarProducto` con botones JSON/CSV. Falta verificar que los handlers
  generen y descarguen realmente los archivos.

**Backend ya verificado** (pruebas automatizadas, todas pasando):
- Comisión: `$0` en efectivo/transferencia, `$144` sobre $10.000 con tarjeta.
- FIFO: venta de 3 u. costó $6.000 (capa a $2.000); venta de 4 u. cruzando capas
  costó $8.400 (2×$2.000 + 2×$2.200); la capa agotada se elimina.
- Búsqueda por `codigo_barras`, `sku` y `serial_number`.
- Importación: modo `omitir` conserva datos y stock; `actualizar` los reemplaza;
  sin PIN devuelve 403.

### 8.2 Mejoras sugeridas (no solicitadas aún)

- **Rotar la llave pública de Supabase** — estuvo expuesta en el navegador.
- Reportes de mermas y de comisión Tuu en su propia vista.
- Cierre de caja diario (arqueo).
- Backup automático programado.
- Multi-usuario con tabla `usuarios` y PIN hasheado (bcrypt), en vez de dos PIN en
  variables de entorno.

---

## 9. Cómo desplegar

Ver `README-DESPLIEGUE.md` para el detalle. Resumen:

1. Ejecutar los scripts de `sql/` **en orden numérico** en Supabase → SQL Editor.
2. Subir el proyecto a GitHub e importarlo en Vercel (Framework: **Other**, sin
   build command).
3. Configurar variables de entorno:

| Variable | Ejemplo |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(secreta)* |
| `JWT_SECRET` | cadena aleatoria de 64+ caracteres |
| `ADMIN_PIN` | `9067` |
| `WORKER_PIN` | `0495` |
| `CORS_ORIGINS` | `https://tu-proyecto.vercel.app` |
| `NEGOCIO_NOMBRE` | `Sevelin` |

4. Verificar el despliegue:

```bash
curl https://tu-dominio.vercel.app/api/health
```

Debe devolver la lista de módulos activos. **Si falta alguno, el deploy quedó
desactualizado** — es la forma más rápida de detectarlo.

---

## 10. Cómo probar sin base de datos real

Existe un doble en memoria de Supabase que permite ejercitar el backend real
(rutas, validaciones, lógica de stock) sin conexión:

```js
// Se inyecta ANTES de cargar api/index.js
const { crearFakeSupabase } = require('./fake-supabase.js');
const fake = crearFakeSupabase({ productos: [...], ventas: [], ... });

const ruta = require.resolve('@supabase/supabase-js', { paths: ['./sevelin'] });
require.cache[ruta] = { id: ruta, filename: ruta, loaded: true,
  exports: { createClient: () => fake.cliente } };

const app = require('./sevelin/api/index.js');
```

Para el frontend se usan **jsdom** (lógica) y **Playwright + Chromium** (visual y
responsive), interceptando `/api/**` con datos de ejemplo.

> Nota: en el entorno de pruebas los CDN externos están bloqueados, así que
> XLSX, jsPDF y el escáner no cargan. Eso **no** indica un fallo del código.

---

## 11. Convenciones del código

- **Idioma:** todo en español (variables, funciones, comentarios, mensajes).
- **Nomenclatura DOM:** `el` + nombre del elemento (`elBtnGuardarProducto`).
- **Comentarios:** explican *por qué*, no *qué*. Se documenta la razón de las
  decisiones no obvias y de los bugs corregidos.
- **Errores:** siempre `try/catch` con `showToast()` y `console.error()`.
- **Confirmaciones destructivas:** `pedirPinAdmin()` de `config.js`; el backend
  revalida con el middleware `exigirPinAdmin`.
- **Fechas:** nunca `new Date().toISOString()` para fechas locales. Usar
  `todayISO()`, `horaActualCorta()`, `fechaHoraChile()`, `tsAChile()` de
  `config.js`, o `marcaDeTiempoChile()` en el backend.
- **Migraciones SQL:** siempre idempotentes (`IF NOT EXISTS`, `DO $$` con
  comprobación previa), para poder reejecutarlas sin romper datos.
