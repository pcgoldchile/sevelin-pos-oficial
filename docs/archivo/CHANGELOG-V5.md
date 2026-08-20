# Sevelin POS — Documentación Técnica del Proyecto

> **Punto de guardado.** Reemplaza a todas las versiones y LEEME anteriores.
> Escrito para que otra persona o una IA en sesión nueva retome el trabajo sin
> contexto previo.
>
> **Última actualización:** 13 de agosto de 2026 · **Versión:** 5.0

---

## 0. Cómo leer este documento

Si vas a retomar, lee primero la **sección 8** (lo que falta) y la **sección 7**
(bugs corregidos): ahí está lo que más tiempo ahorra.

Lo nuevo desde la v4 va marcado con ★. Las correcciones a documentación previa,
con ⚠️.

---

## 1. Qué es este proyecto

Sistema de Punto de Venta a medida para la tienda **Sevelin** (Arica, Chile).
Nació como práctica profesional de un Técnico de Nivel Superior en Informática
(CFT Estatal Arica y Parinacota) y está en uso operativo real.

Cubre: ventas en caja, inventario, finanzas y balance, arqueo de caja, servicio
técnico, abonos, repuestos de taller, gastos, mermas, reportes de negocio y
control de acceso por roles.

**Producción:** https://sevelin-pos-oficial.vercel.app
**Repositorio:** https://github.com/pcgoldchile/sevelin-pos-oficial

Existe una **app Android complementaria** (Sevelin Print) que corre en la máquina
de pago TUU Pro 2 y consume esta misma API. Ver sección 12.

---

## 2. Advertencia sobre el stack

> **No usa React ni Vue.** Es **JavaScript vanilla**: cada módulo es un `.js`
> plano cargado con `<script src>`, y todos comparten el ámbito global.
>
> **Sí usa Tailwind**, pero solo como hoja precompilada. No hay PostCSS ni JSX.

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + JavaScript vanilla |
| Estilos | CSS propio (`styles.css`, 22 secciones) + **Tailwind compilado** |
| Tipografía | Plus Jakarta Sans (Google Fonts) |
| Backend | Node.js + Express, serverless en Vercel |
| Autenticación | JWT, token de 12 h en `sessionStorage` |
| Base de datos | Supabase (PostgreSQL), acceso **solo** desde el backend |
| Reportes | SheetJS (Excel), jsPDF + AutoTable (PDF) |
| Escáner / códigos | html5-qrcode, JsBarcode (CDN) · qrcode local |

### 2.1 Tailwind: tres reglas que respetar

**1. Está compilado, no viene de CDN.** El CDN descargaba el compilador
(~400 KB) y generaba el CSS en el navegador en cada carga, con parpadeo.
`css/tailwind.css` pesa ~14 KB.

**2. El orden de las hojas es a propósito:**

```html
<link rel="stylesheet" href="css/styles.css">    <!-- primero -->
<link rel="stylesheet" href="css/tailwind.css">  <!-- después -->
```

El CDN inyectaba su `<style>` al final del `<head>`. Con este orden, ante empate
de especificidad gana el mismo lado que antes. **Invertirlos cambia estilos.**

**3. Si agregas clases de Tailwind, recompila:**

```bash
npm run css          # compila una vez, minificado
npm run css:watch    # recompila al guardar
```

Si no, la clase **no existe en el archivo y no se ve**. `tailwind.config.js`
escanea `./index.html` y `./js/**/*.js` (el JS entra porque `pago.js`,
`atajos.js`, `balance.js` y `reportes.js` generan HTML con clases).

El `safelist` cubre clases armadas por concatenación: `hidden`, `show`, `activa`,
`active`, `admin-only`, `role-admin`, `role-trabajador`, `theme-light`, `dark`.

---

## 3. Arquitectura

```
Navegador (vanilla JS)          App Android (Sevelin Print)
      │                                │
      │  fetch + JWT en Authorization
      ▼                                ▼
Backend Express  (api/index.js, serverless en Vercel)
      │  service_role key desde variables de entorno
      ▼
Supabase / PostgreSQL
```

**Reglas que hay que respetar:**

1. El navegador nunca conoce las credenciales de Supabase.
2. **`js/api.js` es el único punto de contacto con el backend.**
3. Las validaciones críticas se hacen en el servidor, no solo en la interfaz.
4. Totales, comisión, desglose de pago y duplicados los valida el backend.
5. El consumo FIFO se resuelve en la base con `plpgsql`, no en JavaScript.
6. **El valor esperado del arqueo lo calcula el servidor**, nunca el cliente
   (arqueo ciego, ver 6.7).

> ⚠️ Documentación previa afirmaba "RLS activo en todas las tablas". **No está
> verificado.** El backend usa `service_role`, que omite RLS. Solo `venta_pagos`
> y las tablas de las migraciones 11–12 lo tienen confirmado. Ver 8.3.

---

## 4. Estructura de archivos

```
sevelin-pos/
├── index.html                  ← TODA la interfaz (vistas + modales)
├── tailwind.config.js
├── package.json                ← deps del backend + scripts de CSS
├── vercel.json                 ← rewrite /api/(.*) → /api/index
│
├── css/
│   ├── styles.css              ← CSS propio (22 secciones numeradas)
│   ├── tailwind.css            ← COMPILADO. Se sube al repo
│   └── tailwind-input.css      ← Fuente. NO se enlaza
│
├── js/
│   ├── api.js          ← Cliente HTTP único
│   ├── config.js       ← Fechas Chile, toast, PIN, comisión, búsqueda, fmtCLP
│   ├── auth.js         ← Login, roles
│   ├── pinpad.js       ← Teclado numérico de acceso
│   ├── atajos.js       ← Atajos configurables + sub-pestañas del taller
│   ├── pago.js         ← Medios de pago, vuelto, pago mixto, paso de DTE
│   ├── pos.js          ← Carrito, venta, modo edición, dividir venta
│   ├── balance.js      ← Finanzas, gastos fijos, inyecciones, arqueo
│   ├── reportes.js     ← Rankings, horas pico, reposición, contador
│   ├── productos.js    ← Catálogo, paginación, importación, bajo stock
│   ├── lotes.js        ← Capas de costo FIFO
│   ├── tiendanube.js   ← Alta pegando la ficha de Tiendanube
│   ├── historial.js    ← Ventas, KPIs, IVA, reportes
│   ├── compras.js      ← Gastos, clasificaciones, medio de pago
│   ├── mermas.js · repuestos.js · ot.js · encargos.js
│   ├── escaner.js · etiquetas.js · print.js
│   └── vendor/qrcode.min.js
│
├── api/index.js                ← TODO el backend
│
└── sql/                        ← Migraciones, EN ORDEN
    ├── 01 … 08                 (base del sistema)
    ├── 09-lotes-fifo-comision.sql
    ├── 10-pago-mixto.sql
    ├── 11-finanzas-balance.sql
    └── 12-arqueo-medios-gasto.sql
```

### Ubicaciones críticas (errores que ya ocurrieron dos veces)

**`api/index.js` debe llamarse exactamente así y estar en `api/`.**

1. Quedó en la raíz → Vercel lo trató como estático, todas las rutas daban
   `"Endpoint no encontrado"`.
2. Windows con extensiones ocultas lo dejó como **`index.js.js`** → el login no
   funcionaba y `/api/health` daba `NOT_FOUND`.

**Verificación:** `curl https://sevelin-pos-oficial.vercel.app/api/health` debe
devolver la lista de módulos.

### Orden de carga de scripts

```html
<script src="js/config.js"></script>      <!-- primero -->
<script src="js/api.js"></script>
<script src="js/auth.js"></script>
<script src="js/pinpad.js"></script>
...
<script src="js/tiendanube.js"></script>  <!-- antes que productos.js -->
<script src="js/lotes.js"></script>       <!-- antes que productos.js -->
<script src="js/productos.js"></script>
<script src="js/pos.js"></script>
<script src="js/atajos.js"></script>      <!-- después de pos.js: usa cart -->
<script src="js/balance.js"></script>
<script src="js/reportes.js"></script>
```

---

## 5. Modelo de datos

| Tabla | Contenido |
|---|---|
| `productos` | Catálogo. Campos Tiendanube, stock mínimo/ilimitado, `usa_lotes` |
| `producto_lotes` | Capas de costo FIFO |
| `venta_item_lotes` | Libro de consumo: qué capa pagó cada unidad |
| `ventas` | Cabecera: totales, `comision_pos`, `pago_mixto` |
| `venta_items` | Detalle, con `serial_number` |
| `venta_pagos` | Desglose de pago mixto: método, monto y comisión por parte |
| `compras` | Gastos. `metodo_pago` define si sale del cajón |
| `compra_clasificaciones` | Categorías. `grupo` agrupa para el balance |
| `gastos_fijos` | Plantilla de gastos recurrentes |
| `inyecciones_capital` | Aportes de dinero propio |
| `arqueos` | Apertura y cierre de caja con fondo inicial |
| `mermas` | Bajas de inventario, vinculadas a su gasto |
| `ordenes_trabajo` · `ot_repuestos` · `repuestos` | Servicio técnico |
| `encargos` · `encargo_abonos` | Pedidos con seña |

> ⚠️ **Correcciones al modelo:** no existe `venta_items.detalle_lotes`; el
> consumo FIFO vive en `venta_item_lotes`. La columna de comisión es
> `ventas.comision_pos`, no `comision_tuu`. Las capas agotadas **no se eliminan**,
> se cierran con `agotado_en`.

### Vistas de apoyo

| Vista | Para qué |
|---|---|
| `v_producto_lotes_vigentes` | Capas, stock y costo promedio por producto |
| `v_ventas_por_medio` | Cuadratura por medio: unifica ventas simples y mixtas |
| `v_balance_ventas` | Normaliza medio de pago para el dashboard |

### Decisiones de diseño que conviene conocer

- **Los precios son BRUTOS** (IVA incluido). El neto es `total / 1,19`; calcular
  el IVA como `total × 0,19` da de más.
- **Ventas "Por Pagar"** quedan `PENDIENTE` y no suman hasta cobrarse.
- **"Por Pagar" queda fuera del pago mixto:** una parte impaga no es un medio de
  pago y dejaría la venta a medio cobrar sin saber cuánto falta.
- **El stock de una OT se descuenta al marcarla ENTREGADA**, no al asociar el
  repuesto (`stock_descontado` evita descuentos dobles).
- **Las capas FIFO agotadas se cierran, no se borran.** Si se borraran, una venta
  anulada no tendría a dónde devolver el stock.
- **Vender más de lo cargado en lotes no bloquea la venta:** consume lo
  disponible y valoriza el faltante al costo del catálogo. Una caja no debe
  trabarse por un descuadre.
- **La comisión se guarda persistida en cada venta.** Si Tuu cambia la tarifa,
  los informes históricos siguen mostrando lo que se pagó ese día.
- **Las inyecciones de capital van en tabla propia**, no como venta: suman a la
  caja pero no a los ingresos ni a la utilidad.
- **Los gastos fijos NO se auto-registran.** Son una plantilla que alimenta el
  punto de equilibrio. Si se generaran solos, un mes que no pagaste aparecería
  como gasto igual y el balance mentiría.
- **Las mermas no descuentan de la caja física**: son stock perdido, no dinero
  que salió del cajón (`metodo_pago = 'No aplica (merma)'`).
- **El `esperado` del arqueo se congela al cerrar**: si mañana se corrige una
  venta antigua, el arqueo de ayer debe seguir mostrando lo que se vio ese día.
- **`ventas.ot_id` sigue existiendo** aunque el POS ya no vincule ventas a OT.
  Las ventas antiguas conservan su referencia.
- ★ **El código de barras es solo numérico.** Se limpia al escribir, al guardar y
  hay un endpoint de limpieza masiva. `"null"`, `"-"` y las letras se guardan
  como **NULL de verdad**.

---

## 6. Módulos y estado

Los 4 botones del menú: **POS · Servicio Técnico · Productos · Finanzas.**

| Módulo | Sub-secciones |
|---|---|
| POS | — |
| Servicio Técnico | Órdenes de Trabajo · Abonos y Encargos · Repuestos Taller |
| Productos | — |
| Finanzas | Balance · Historial de Ventas · Gastos · Gastos Fijos |

Todo lo listado está implementado y en uso.

### 6.1 Comisión Tuu Haulmer Pro 2

`monto × 0,0079 + 65`, redondeado, solo en `Tarjeta Débito` y `Tarjeta Crédito`.

Calculada **siempre en el servidor**. Se recalcula al cobrar una venta pendiente,
al editarla y al importar. **En pago mixto se suma la de cada parte con tarjeta
por separado**, no sobre el total. Se oculta al rol Trabajador.

> **Si cambias la tarifa, hazlo en los DOS lados:** `api/index.js`
> (`COMISION_POS_TASA` / `COMISION_POS_FIJO`) y `js/config.js`, que tiene una
> copia espejo para previsualizar y recalcular ventas antiguas.

### 6.2 FIFO por lotes

`usa_lotes` nace en `FALSE`: ningún producto cambia de comportamiento solo, y
`sanearProducto()` solo escribe la columna si viene explícita, así que **una
importación masiva no puede encenderla**.

El costo se aplica **antes de totalizar** para que la utilidad guardada sea real.
Si una línea cruza dos capas, el costo es el promedio ponderado.

### 6.3 Pago mixto y división de venta

**Pago mixto:** reparte el total entre hasta 4 medios, con botón "= resto". No
deja confirmar hasta que cuadre, y el servidor lo revalida (tolerancia $1).

**Dividir venta:** marca qué productos van en la parte 1, se cobra con el flujo
normal, y la parte 2 vuelve sola al carrito para cobrarse aparte con su propio
documento.

> **Por qué dividir y no "un DTE por medio de pago".** Una boleta documenta el
> **total de la operación**, no una fracción. Emitir boleta solo por lo pagado
> con tarjeta dejaría el resto como venta sin documentar. Esto se conversó
> explícitamente y se decidió **no** implementar el DTE parcial.

### 6.4 Flujo de cobro

```
F9  →  elegir medio (↑ ↓ + Enter)  →  [si Efectivo: vuelto]  →  DTE  →  registrada
```

- **Ningún medio viene preseleccionado.** El primero queda *resaltado* para el
  teclado, que no es lo mismo que elegido. (Preseleccionar Efectivo hacía que su
  sub-modal se abriera solo al abrir el cobro.)
- **Efectivo abre su propio sub-modal** de monto recibido y vuelto.
- **El DTE es un paso aparte**, navegable con ↑ ↓ y Enter.
- **El modal de pago se cierra al confirmar**, no después de registrar. Si el
  registro falla, se reabre con lo que había.

### 6.5 Alta de productos pegando la ficha de Tiendanube

`js/tiendanube.js`. Tres problemas que resolvió el parser (los detectaron las
pruebas, no la inspección visual):

1. **El menú lateral colisiona.** Anclar en "Inventario" enganchaba con el ítem
   del menú del admin y devolvía `"Categorías"` como stock. Se descarta todo lo
   anterior a `Más opciones`.
2. **El punto es ambiguo.** En `0.181` es decimal; en `19.990` separa miles.
   Adivinar mal da 0,181 kg leído como **181 kg**, o $19.990 como **$19,99**.
3. **Los campos vacíos traen texto de ayuda.** Sin filtrarlo, *"El SKU es un
   código que creas internamente…"* se guardaba **como el SKU**.

### 6.6 Atajos de teclado configurables

Ventana con **F1**. Solo actúan dentro del POS.

**7 atajos reasignables** (cobrar, buscador, cantidad, precio, agregar, limpiar,
merma): cada uno con un botón **✏️ Cambiar** *siempre visible*; los fijos llevan
🔒 con su explicación. El editor **captura la siguiente tecla** y la valida contra
una lista de teclas reservadas (`F5`, `F11`, `F12`, `Tab`, `Enter`, `Esc`,
flechas, `Espacio`, modificadores) y contra los atajos ya asignados. Se guardan en
el equipo.

> **El atajo de cobro es la coma `,`.** Se descartó el doble Enter: Enter es la
> tecla de confirmar en toda la app y un segundo pulso accidental disparaba el
> cobro mientras el usuario encadenaba confirmaciones.

**La ventana de ayuda se genera desde el mismo arreglo `ATAJOS[]`** que define el
comportamiento, así que no puede quedar desfasada.

### 6.7 Finanzas, balance y arqueo

**Dashboard:** ingresos, utilidad bruta, gastos y **utilidad neta** (esta última
en tarjeta que cambia a verde o rojo según el signo). Desglose por medio de pago
y por categoría. Filtros: Hoy · 7 días · Este mes · Mes anterior · Personalizado.

> La **comisión Tuu se resta dentro de la utilidad neta**. No estaba en el
> requerimiento original, pero es plata que sale todos los meses y omitirla daría
> una utilidad optimista.

**Caja física vs Flujo líquido** — dos cifras distintas, explicadas en pantalla:

- **Caja física** = `fondo inicial + ventas en efectivo + aportes en efectivo −
  gastos en efectivo`. Lo que debería haber en billetes.
- **Flujo líquido** = todas las ventas + aportes − gastos − comisiones.

Un día puede cerrar con caja física baja y flujo alto (se vendió con tarjeta) sin
ningún problema. Confundirlas es lo que hace que un arqueo "no cuadre" estando
bien.

**Arqueo CIEGO.** El cajero cuenta sin ver lo esperado, con desglose opcional por
denominación que suma solo. **El esperado lo calcula el servidor al cerrar**: si
lo enviara el navegador, se podría leer en las herramientas del desarrollador
antes de contar, y el arqueo dejaría de detectar diferencias — que es justo lo
que se quiere medir. El resultado se revela después, imprimible.

Un arqueo por fecha (índice único) y **un día cerrado no se reabre**.

**Gastos fijos** con pausa (para gastos de temporada) y **punto de equilibrio**.

### 6.8 Reportes de negocio

**Cuatro rankings**, cada uno con PDF descargable:

| Ranking | Qué muestra |
|---|---|
| 🏆 Más vendidos | Los que más unidades salieron |
| 💎 Más utilidad | Los que más dejaron |
| 🐌 Menos rotan | Capital detenido |
| 📉 Menos utilidad | Los que menos dejaron (negativos en rojo) |

El panel muestra el **Top 5**; el resto va al PDF o al modal, donde tocar un
producto abre su ficha.

> **"Los que menos rotan" se obtiene invirtiendo la lista COMPLETA**, no la ya
> recortada a 100. Si se recortara primero saldrían los que menos rotan *dentro
> del top 100* — o sea, los que más rotan. Cambia por completo el resultado.

**Horas pico** por hora y por día de la semana. La hora sale del campo `hora` y,
si falta, de `vendida_en` convertido a hora de Chile: usar la hora UTC correría
todo 3 o 4 horas.

**Lista de reposición** con cantidad sugerida y Excel para el proveedor.
La sugerencia repone hasta el **doble del mínimo**: llegar justo al umbral deja
el producto en alerta otra vez con la primera venta.

**Exportación para el contador** en dos pasos: período (Hoy · Esta semana · Este
mes · Este año · Personalizado) y formato (Excel de 4 hojas o PDF).

### 6.9 Roles

| Acción | Admin | Trabajador |
|---|---|---|
| Vender, imprimir, servicio técnico | ✅ | ✅ |
| Ver costos, utilidades, comisión | ✅ | ❌ *(el servidor no los envía)* |
| Productos, Finanzas, Gastos, Lotes | ✅ | ❌ |
| Editar/eliminar ventas, importar | ✅ | ❌ (403) |

La clase **`admin-only`** es la que oculta elementos al trabajador. **No la
quites al refactorizar.**

---

## 7. Historial de bugs corregidos

Documentados porque varios pueden reaparecer al tocar código relacionado.

### 7.1 Anteriores

1. Credenciales de Supabase expuestas en el navegador → backend propio.
2. Fechas en UTC guardaban el día siguiente después de las 20:00 en Chile.
3. `new Date('2026-08-04')` se interpretaba como medianoche UTC.
4. Segunda hoja en blanco al imprimir: `visibility: hidden` conserva el espacio.
5. QR bloqueado por adblockers: el CDN se llamaba `qrcode.min.js`. Ahora local.
6. PIN incorrecto cerraba la sesión: el backend devolvía 401 en vez de 403.
7. Toast bloqueaba clics: faltaba `pointer-events: none`.
8-9. Problemas de flex en móvil (`min-width: 0`, `flex-basis` en columna).
10. FK sin CASCADE bloqueaba borrar ventas.
11. Se usaba el segmento de URL (`areas`) como nombre de tabla.
12. Renombrado en cascada leía el nombre después de actualizar.
13. `api/index.js` en la raíz → Vercel lo ignoraba.
14. **Doble movimiento de stock con FIFO:** `aplicarCostosFifo()` y
    `ajustarStock()` descontaban ambos. Resuelto con la bandera `item._fifo`.
15. Venta huérfana si fallaba el insert de `venta_items`.
16-18. Parser de Tiendanube (ver 6.5).
19. **Cadena `"null"` en el catálogo.** Productos con la **cadena de texto**
    `"null"` en `sku` o `codigo_barras`. `if (producto.codigo_barras)` la da por
    buena (es *truthy*) y se imprimió un código de barras que codificaba la
    palabra "null".

    ```sql
    UPDATE productos SET codigo_barras = NULL
    WHERE codigo_barras IN ('null','undefined','NULL','-','')
       OR codigo_barras !~ '^[0-9]+$';

    UPDATE productos SET sku = NULL WHERE sku IN ('null','undefined','NULL');
    ```

20. **`fmtCLP()` no agrupaba miles en 4 dígitos.** `toLocaleString('es-CL')`
    aplica `minimumGroupingDigits = 2` del español: los números de cuatro cifras
    van **sin separador**. El ICU de un PC lo matiza; el de Android lo aplica
    literal. Síntoma: `$20.000` bien pero `$7000` mal. Se formatea a mano.
21. **CSS que rompió la maquetación del POS** (`.pos-cart-meta` con `grid`
    peleando contra `.pos-cart-head`).
22. **`desvincularOT()` llamado pero inexistente**: `ReferenceError` justo
    después de registrar la venta; se guardaba bien pero el carrito no se
    limpiaba y el modal de éxito no aparecía.
23. `index.js.js` por extensiones ocultas de Windows.
24. **Desalineación de "Editar hora":** el checkbox metía un `.sn-toggle` con
    altura propia donde los otros campos tenían una `<label>` simple.
25. **Dígitos duplicados en el PIN.** El input oculto con `sr-only` **sigue
    siendo un `<input>` real y enfocable**: al teclear un `9` el navegador lo
    escribía **y además** el manejador lo agregaba a mano.
26. **El modal de DTE no aparecía — pero sí se abría.** Empate de `z-index` con
    `modalPago`: con empate, el que va después en el DOM pinta encima.
27. **Doble confirmación encadenada**, mismo origen: el modal de pago seguía
    capturando teclas detrás del DTE.
28. **Caja física negativa.** El balance asumía que todos los gastos salían en
    efectivo porque `compras` no guardaba el medio de pago.

### 7.2 ★ De las últimas entregas

29. **El sub-modal de efectivo aparecía cortado.** Tercera vez del mismo bug de
    apilado: `modalEfectivo` está antes que `modalPago` en el HTML y sin
    `z-index` propio.

    **Capas asignadas:**
    ```css
    #modalDividir { z-index: 10010; }  #modalEfectivo { z-index: 10015; }
    #modalDte     { z-index: 10020; }  #modalReposicion, #modalResultadoArqueo, #modalRanking { 10025 }
    #modalPeriodoContador { 10026; }   #modalFormatoContador { 10027; }
    #modalAtajos  { z-index: 10030; }
    ```

30. **El badge de stock era ilegible.** Una regla nueva al final de `styles.css`
    redefinió `.stock-agotado` como color de texto rojo, pisando el badge que ya
    existía con fondo rojo: **texto rojo sobre fondo rojo**. Solo se leía al
    seleccionarlo con el mouse.

    > **Tercer bug de este tipo** (junto al 21 y al 26): reglas nuevas al final
    > de una hoja larga que pisan clases existentes. **Antes de agregar una clase
    > al final de `styles.css`, haz `grep` del nombre.**

31. **Cambios que nunca llegaron al archivo.** Un script de edición falló a mitad
    y abortó antes de reemplazar la tabla de atajos: el HTML recibió la nota de
    teclas prohibidas pero `atajos.js` se quedó con la versión vieja, sin
    lápices. **Lección: verificar el resultado, no solo que el script "corrió".**

32. **Finalizar venta era lento.** `ajustarStock()` hacía **2 consultas por
    producto en serie** (buscar + actualizar). Con 5 productos eran 10 viajes de
    ida y vuelta secuenciales a Supabase.

    Corregido: 3 consultas agrupadas (`in(...)` por id, sku y código de barras) y
    los updates en paralelo. **De paso se arregló que dos líneas del mismo
    producto se pisaban**, perdiéndose uno de los dos descuentos.

    > No era Tailwind, como se sospechaba. El CSS afecta la carga inicial de la
    > página, nunca la velocidad de una venta.

---

## 8. Lo que falta por hacer

### 8.1 Verificación pendiente en uso real

| Prueba | Esperado |
|---|---|
| Venta de $10.000 con Tarjeta Débito | Comisión **$144** |
| Venta mixta: $12.000 efectivo + $8.000 débito | Comisión **$128** (sobre los $8.000) |
| Lote 1 = 5 u. a $2.000, Lote 2 = 10 u. a $2.200; vender 7 | Costo unitario $2.057 |
| Anular esa venta | Las capas se reabren correctamente |
| Abrir caja $50.000 → vender → cerrar | La diferencia queda registrada |
| Gasto por transferencia | **No** descuenta de la caja física |
| Buscar en el POS un producto de la página 3 | **Lo encuentra igual** |
| Finalizar una venta de 4-5 productos | Notablemente más rápido |

### 8.2 Rendimiento: dónde mirar si sigue lento

Ya corregido: `ajustarStock()` (bug 32) y la paginación del render de productos.

**Si finalizar venta sigue lento, el siguiente sospechoso es
`aplicarCostosFifo()`**, que llama a `fifo_consumir` una vez por producto con
lotes. Con muchos productos con `usa_lotes = true` vuelven las llamadas en serie.
Se resolvería con una función `plpgsql` que reciba el arreglo completo de ítems.

**Límites vigentes:**

| Módulo | Límite |
|---|---|
| Productos | Sin límite en la consulta · **50 por página** en el render |
| Historial, Gastos, Mermas | **200** por defecto, `?limite=` hasta 2.000 |

> **Por qué Productos no tiene `LIMIT` en la consulta:** siete módulos dependen
> de `productsList` como catálogo **completo** en memoria (el buscador del POS,
> mermas, OT, lotes, tiendanube, reportes). Con `LIMIT 50` el POS no encontraría
> el producto 51 al escribir ni al escanear. El cuello de botella real no era
> traer las filas sino **pintarlas**, y eso lo resuelve la paginación del render.

### 8.3 Mejoras sugeridas

- **Rotar las llaves de Supabase.** La `service_role` estuvo en archivos
  compartidos por chat; resetearla junto con `JWT_SECRET` y ambos PIN.
  **Pendiente desde hace varias entregas.**
- **Correr el SQL de limpieza de códigos `null`** (bug 19).
- **Activar RLS en el resto de las tablas.** No rompe nada (el backend usa
  `service_role`):

  ```sql
  ALTER TABLE productos        ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ventas           ENABLE ROW LEVEL SECURITY;
  ALTER TABLE venta_items      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE producto_lotes   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE venta_item_lotes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ordenes_trabajo  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ot_repuestos     ENABLE ROW LEVEL SECURITY;
  ALTER TABLE repuestos        ENABLE ROW LEVEL SECURITY;
  ALTER TABLE encargos         ENABLE ROW LEVEL SECURITY;
  ALTER TABLE encargo_abonos   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE compras          ENABLE ROW LEVEL SECURITY;
  ALTER TABLE mermas           ENABLE ROW LEVEL SECURITY;
  ```

- **Refactor de maquetación** de Historial, Productos y Gastos. Hoy tienen el
  acabado del POS por CSS (sección 18 de `styles.css`) pero no el layout de dos
  columnas. **Se hace módulo por módulo, con prueba después de cada uno**: son
  miles de líneas de marcado con IDs de los que dependen varios archivos JS.
  Orden sugerido: Historial → Productos → Gastos → Servicio Técnico.
- **Grilla de catálogo navegable en el POS**, para tocar el producto en vez de
  escribirlo.
- **División por cantidad** dentro de un mismo producto al dividir la venta.
- **Índice único parcial** sobre `sku` y `codigo_barras` (ignorando nulos).
- **Historial de arqueos** con gráfico de diferencias por día.
- Multi-usuario con tabla `usuarios` y PIN hasheado (bcrypt).
- Galería de imágenes de producto: `js/tiendanube.js` ya tiene
  `nombreSecuencialImagen()` listo, pero **no la llama nadie** porque no hay
  columnas de imagen ni bucket.
- Empaquetar como `.exe` con Tauri o Electron, si se quiere acceso directo a
  impresoras USB. Seguiría necesitando internet.

---

## 9. Cómo desplegar

1. Ejecutar los scripts de `sql/` **en orden numérico**. Las migraciones 09 a 12
   son idempotentes y terminan con una consulta de verificación. Si Supabase
   avisa sobre RLS, elegir **"Run and enable RLS"**.
2. Subir a GitHub e importar en Vercel (Framework: **Other**, **sin build
   command**: el CSS ya viene compilado en el repositorio).
3. Variables de entorno:

| Variable | Ejemplo |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(secreta)* |
| `JWT_SECRET` | cadena aleatoria de 64+ caracteres |
| `ADMIN_PIN` / `WORKER_PIN` | *(secretos)* |
| `CORS_ORIGINS` | `https://sevelin-pos-oficial.vercel.app,https://localhost` |
| `NEGOCIO_NOMBRE` | `Sevelin` |

> **`https://localhost` no es opcional** si se usa la app Android: es el origen
> del WebView de Cordova. Las variables **no se aplican solas**: hay que hacer
> Redeploy.

4. Verificar: `curl .../api/health` debe devolver la lista de módulos.

**El SQL va primero.** Sin la 09 no se guarda la comisión; sin la 10 el pago
mixto pierde el desglose; sin la 11 no existe Finanzas; sin la 12 la caja física
vuelve a asumir que todo sale en efectivo.

### 9.1 Flujo de trabajo local

```bash
npm install          # una sola vez
npm run css:watch    # mientras trabajas en el diseño
npm run css          # antes de cada git push
```

---

## 10. Cómo probar sin base de datos real

Doble en memoria de Supabase para ejercitar el backend real sin conexión:

```js
const { crearFakeSupabase } = require('./fake-supabase.js');
const fake = crearFakeSupabase({ productos: [...], ventas: [], ... });

const ruta = require.resolve('@supabase/supabase-js', { paths: ['./sevelin'] });
require.cache[ruta] = { id: ruta, filename: ruta, loaded: true,
  exports: { createClient: () => fake.cliente } };

const app = require('./sevelin/api/index.js');
```

> **Ojo con el FIFO:** `fifo_consumir` y `fifo_devolver` son funciones `plpgsql`
> invocadas con `db.rpc()`. Hay que simularlas explícitamente.

Para el frontend, **jsdom** funciona bien para lógica y eventos. Ejemplo de lo
que sí detecta: paginación, apertura de modales, validación de teclas, generación
de PDF (con `jsPDF` simulado).

> **Dos límites conocidos de jsdom:**
>
> 1. **No implementa motor CSS.** Los bugs 21, 26, 29 y 30 pasaron todas las
>    pruebas. Para cualquier cosa que dependa de estilos o apilado, usar
>    Playwright o probar en el equipo.
> 2. **Las variables `let` de módulo no se pueden sobrescribir desde fuera.**
>    `w.datosDashboard = {...}` crea una propiedad distinta de la que ve la
>    función. Hay que alimentar el estado por su vía normal (llamando a la
>    función que lo carga).
>
> Tampoco existen `scrollIntoView` con opciones ni `offsetTop` real: el código
> debe comprobar antes de usarlos.

> En el entorno de pruebas los CDN están bloqueados: XLSX, jsPDF y el escáner no
> cargan. Eso **no** indica un fallo del código.

---

## 11. Convenciones del código

- **Idioma:** todo en español (variables, funciones, comentarios, mensajes).
- **Nomenclatura DOM:** `el` + nombre del elemento (`elBtnGuardarProducto`).
- **Comentarios:** explican *por qué*, no *qué*. Cada bug corregido deja su
  explicación en el código, para que nadie lo "simplifique" de vuelta.
- **Errores:** `try/catch` con `showToast()` y `console.error()`.
- **Nada de `confirm()`/`alert()` del navegador** para flujos normales: no se
  pueden cerrar con Esc ni estilizar. Usar modales propios.
- **Confirmaciones destructivas:** `pedirPinAdmin()`; el backend revalida con
  `exigirPinAdmin`.
- **Fechas:** nunca `new Date().toISOString()` para fechas locales. Usar
  `todayISO()`, `fechaHoraChile()`, `tsAChile()`, o `fechaHoyChile()` /
  `marcaDeTiempoChile()` en el backend.
- **Moneda:** siempre `fmtCLP()`. **Nunca `toLocaleString`** (ver bug 20).
- **Migraciones SQL:** idempotentes (`IF NOT EXISTS`, `DO $$` con comprobación).
- **Degradación elegante:** comprobar con `typeof fn === 'function'`, y los
  métodos del DOM con `if (el && el.scrollIntoView)`.
- **Modales apilados:** el que se abre encima necesita su propio `z-index`
  (ver bugs 26 y 29).
- **Antes de agregar una clase al final de `styles.css`, haz `grep` del nombre**
  (ver bug 30).
- **Clases intocables:** `admin-only`, `suggestions-box`, `suggestion-item`,
  `show`, `activa`, `active`, `view-section`, `panel-taller`, `panel-finanzas`,
  `pago-metodo-btn`, `rank-clicable`, y el atributo `data-scan`.
- **Tailwind:** recompilar con `npm run css`; clases dinámicas al `safelist`.

### 11.1 Chequeo rápido tras cualquier refactor

```bash
# IDs referenciados en JS que ya no existen en el HTML
grep -o "getElementById('[^']*'" js/*.js | sed "s/.*('//;s/'//" | sort -u \
  | while read id; do grep -q "id=\"$id\"" index.html || echo "FALTA: $id"; done

# Sintaxis de todos los archivos
for f in js/*.js api/index.js; do node --check $f || echo "FALLO $f"; done
```

Detecta el bug 22 (`desvincularOT`) y cualquier elemento huérfano.

---

## 12. App Android complementaria (Sevelin Print)

Proyecto separado con su propia documentación
(`README-SEVELIN-PRINT-APK.md`). **Consume esta API**, así que cualquier cambio
en los endpoints la afecta.

- Terminal de impresión para la **TUU Pro 2** (Kozen P8). Solo lee e imprime; lo
  único que escribe es la marca `impreso` de una venta.
- Cordova + JavaScript vanilla **ES5**, plugin `cordova-plugin-kozen-p8-printer`.
- Origen CORS: `https://localhost`.
- Endpoints: `POST /api/login`, `GET /api/me`, `GET /api/ventas`,
  `GET /api/ventas/:id`, `PUT /api/ventas/:id`, `GET /api/ot`,
  `GET /api/encargos`, `GET /api/productos`.

**Dos decisiones que conviene conocer:**

- **Los tickets se renderizan como imagen** en un `<canvas>` de 384 px, porque la
  fuente interna del Kozen **no es monoespaciada** y alinear con espacios nunca
  cuadra.
- **El WebView es antiguo.** `inset:0` (Chrome 87+) dejaba los modales
  invisibles. No usar CSS posterior a ~Chrome 80 sin verificar.

> ⚠️ **El límite de 200 filas** que ahora tiene `GET /api/ventas` afecta al APK:
> el listado de reimpresión mostrará las 200 más recientes. Si hace falta más,
> el APK debe pedir `?limite=`.

---

## 13. Estado del proyecto

**En producción y en uso operativo real.** Todos los módulos de la sección 6 están
implementados.

Pendiente: verificación en uso real de Finanzas y arqueo (8.1), refactor de
maquetación de los módulos restantes (8.3) y **rotación de credenciales**, que
sigue abierta desde hace varias entregas.
