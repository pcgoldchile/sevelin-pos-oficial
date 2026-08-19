# Sevelin POS — Cambios de la versión 6

> **Complemento del README v5.** No lo reemplaza: todo lo que dice la v5 sobre
> arquitectura, modelo de datos, roles y despliegue sigue vigente. Aquí va
> solo lo que cambió el 14 de agosto de 2026.
>
> Lo nuevo va marcado con ★. Los bugs corregidos continúan la numeración de la
> sección 7 del README v5 (que terminaba en el 32).

---

## 1. Resumen de la entrega

| # | Cambio | Archivos tocados |
|---|---|---|
| 1 | PIN como campo de texto (admite letras) | `index.html`, `js/pinpad.js`, `js/auth.js`, `css/styles.css` |
| 2 | Bug: "Nuevo Producto" dejaba atrapado | `js/tiendanube.js`, `css/styles.css` |
| 3 | Bug: respaldos JSON con nombre y contenido invertidos | `js/productos.js` |
| 4 | POS redimensionable desde la esquina | `index.html`, `js/pos-layout.js` (nuevo), `css/styles.css` |
| 5 | POS: aprovechamiento del espacio | `index.html`, `css/styles.css` |
| 6 | Pagar un gasto fijo desde su pestaña | `index.html`, `js/balance.js`, `css/styles.css` |
| 7 | Orden de módulos: POS · Productos · Finanzas · Taller | `index.html` |
| 8 | Buscar ventas por producto | `index.html`, `js/historial.js`, `js/api.js`, `api/index.js` |
| 9 | SKU y S/N editables en una venta | `js/historial.js`, `css/styles.css` |
| 10 | Bug: el modal de pago no se iba en el paso de DTE | `js/pago.js` |
| 11 | Rendimiento: caché y lotes en una consulta | `js/productos.js`, `js/lotes.js`, `js/api.js`, `api/index.js` |

**Archivo nuevo:** `js/pos-layout.js` (cargado después de `pos.js`).

---

## 2. ★ El PIN ahora es un campo de texto

Se eliminaron el teclado numérico en pantalla (`#pinPad`) y la fila de puntos
(`#pinPuntos`). En su lugar hay un `<input>` visible con botón de ver/ocultar,
que **admite letras, números y símbolos** hasta 64 caracteres.

`js/pinpad.js` conserva su nombre por costumbre, pero ya no es un teclado.

**Qué se conservó:** el auto-envío por pausa. El sistema no conoce el largo del
PIN (vive en las variables de entorno y difiere entre admin y trabajador), así
que no puede enviar "al llegar a N caracteres" sin adivinar. La pausa subió de
**450 ms a 600 ms**: con letras la clave se teclea más lento y con 450 ms se
disparaban intentos a medio escribir contra el freno anti-fuerza bruta.

**Qué se eliminó:** las clases CSS `.pin-tecla` y `.pin-punto`, y toda la
lógica de escritura manual del teclado físico. Con un campo visible y normal,
el navegador es el único que escribe (esto mata definitivamente el bug 25).

---

## 3. Bugs corregidos (continúa la numeración del v5)

### 33. "Nuevo Producto" dejaba atrapado — COLISIÓN DE NOMBRES GLOBALES

**El más importante de esta entrega, y el que más fácil vuelve.**

`js/tiendanube.js` declaraba `function cerrarModal(modal)` que recibe un
**elemento**. `js/balance.js` declara `function cerrarModal(id)` que recibe un
**string** con el id. Como todos los archivos comparten el ámbito global y
`balance.js` se carga después, su versión pisaba a la otra.

**No da error en consola.** Las declaraciones de función se sobrescriben en
silencio. Por eso costó tanto encontrarlo.

Síntomas exactos:

- **"Cancelar" no hacía nada.** Ejecutaba `document.getElementById(<HTMLElement>)`,
  que devuelve `null`, y el `?.` se tragaba la operación.
- **El formulario de producto "no salía".** Sí se abría, pero `#modalMetodoAlta`
  no se cerraba y quedaba **encima**: ambos tenían `z-index: 200` y, con empate,
  pinta encima el que va después en el DOM (`#modalProducto` está en la línea
  1789 e `#modalMetodoAlta` en la 1943).

**Corregido en dos frentes:**

1. La función de `tiendanube.js` se renombró a `cerrarModalAlta`.
2. Capas explícitas en `styles.css`:
   ```css
   #modalMetodoAlta, #modalPegarTiendanube, #modalRevisarTiendanube { z-index: 10000; }
   #modalProducto { z-index: 10005; }
   ```

> **Cuarta repetición del bug de apilado** (junto al 21, 26 y 29). Y **primera
> vez documentada del bug de nombres globales**, que es más peligroso porque no
> deja rastro en consola.
>
> **Antes de declarar una función en el ámbito global, haz `grep` del nombre en
> todo `js/`.** Comando en la sección 6 de este documento.

### 34. Respaldos JSON con el nombre y el contenido invertidos

Misma familia que el 33. `descargarArchivo` estaba declarada dos veces con los
parámetros **al revés**:

```js
config.js    → descargarArchivo(nombre, contenido, tipo)
productos.js → descargarArchivo(contenido, nombre, tipoMime)
```

Gana `productos.js` por orden de carga. Resultado: los respaldos de **compras**
(`compras.js:284`), **ventas** (`historial.js:1099`) y **productos**
(`productos.js:397`) se descargaban con todo el JSON metido en el nombre del
archivo.

Renombrada a `descargarArchivoMime`.

### 35. El círculo fantasma del PIN

`refrescar()` pintaba `n + 1` puntos **a propósito**: los caracteres escritos
más uno vacío de guía, para no delatar el largo real del PIN. Al completar un
PIN de 4, aparecía un quinto círculo por unos instantes, justo antes de que el
auto-envío entrara.

No era un fallo de la validación: era la guía haciendo su trabajo en el peor
momento posible. Desapareció al quitar los puntos.

### 36. Los puntos sobrevivían al cierre de sesión

`cerrarSesion()` borraba el token y volvía a mostrar el modal, pero **nadie
limpiaba `#pinInput`**. El valor seguía dentro del campo y los puntos seguían
pintados: parecía que el PIN anterior seguía escrito.

Corregido con `limpiarCampoPin()` en `pinpad.js`, **un único punto de limpieza**
al que llaman los tres flujos: `manejarLogin()` al entrar, `cerrarSesion()` y
`manejarSesionExpirada()`. Antes cada flujo limpiaba por su cuenta y el de
logout simplemente se olvidaba.

### 37. El modal de pago no se iba al elegir el documento

`pedirTipoDte()` solo **atenuaba** el modal de cobro detrás (clase `hay-encima`,
que le baja el brillo). En pantalla quedaban dos ventanas de cobro superpuestas
y no se entendía cuál estaba activa ni si la venta ya se había registrado.

Ahora se oculta de verdad y se marca con `dataset.reabrirTrasDte`:

- **Se elige el documento** → el flujo sigue al registro, el cobro **no vuelve**.
- **Se cancela el DTE** → el cobro **vuelve** con el medio de pago ya elegido.
  Sin esto, retroceder desde el DTE dejaba la pantalla en blanco.

### 38. Editar una venta borraba el número de serie

**Silencioso y con pérdida de datos.** El modal de edición no mostraba `sku` ni
`serial_number`, así que `itemsEditando` los llevaba pero el formulario nunca
los reponía. Al guardar, el backend **reemplaza el detalle completo**
(`api/index.js`, `PUT /api/ventas/:id` borra e inserta `venta_items`), y los
campos ausentes quedaban en `null`.

Es decir: corregir el precio de una venta borraba el S/N con el que se había
vendido el equipo, que es justo el dato que se necesita para una garantía.

Ahora ambos campos se muestran, se editan y sobreviven a la edición. Detalle
importante en el manejador de `input`:

```js
const CAMPOS_TEXTO = ['nombre', 'sku', 'serial_number'];
```

Sin esa lista, `Number(input.value)` habría convertido los códigos en `0`.

---

## 4. ★ Funciones nuevas

### 4.1 POS redimensionable (`js/pos-layout.js`)

Agarre en la esquina inferior derecha. **Se redimensiona el contenedor, no cada
tarjeta:** las dos columnas viven en un grid con `align-items: stretch`, así que
estirar el lienzo las estira a ambas por igual y mantiene la proporción 7/5.
Con un agarre por tarjeta habrían quedado desparejas.

- Ratón, lápiz y táctil con `pointer` events + `setPointerCapture` (sin esto, al
  soltar fuera de la ventana el arrastre se quedaba pegado).
- El ancho crece **al doble** del desplazamiento, porque el lienzo está centrado
  con `margin: 0 auto`: al arrastrar 100 px a la derecha, el borde izquierdo se
  corre otros 100 px. Sin ese factor el agarre "se escapa" del puntero.
- Teclado: flechas ajustan de a 40 px (120 con Shift).
- Topes: ancho 900–4200 px, alto 480–2400 px.
- Se guarda en `localStorage` (`pos_layout_v1`), **no en la base**: es una
  preferencia de esa pantalla. El notebook del taller no hereda el tamaño del
  monitor del mostrador.
- Botones **"Ancho completo"** y **"Restablecer tamaño"**.

**Por defecto el POS ahora llena el alto de la ventana**
(`clamp(30rem, calc(100vh - 190px), 60rem)`) en vez de terminar a media
pantalla. La clase `pos-alto-manual` desactiva ese cálculo cuando el usuario
arrastra.

### 4.2 Pagar un gasto fijo desde su propia pestaña

Botón 💸 en cada fila. Abre un modal que crea el gasto real en `compras`.

**La decisión de fondo no cambia:** los gastos fijos siguen siendo una
plantilla y **no se auto-registran**. Si se generaran solos, un mes que no
pagaste aparecería como gasto igual y el balance mentiría. Lo que faltaba era
el puente: pagar uno y tener que ir a Gastos a escribirlo todo de nuevo.

El modal pregunta lo que de verdad varía:

- **Monto** — "¿el mismo o cambió?", con la diferencia en vivo contra la
  plantilla ("este mes salió $63.058 MÁS caro"). Una tarjeta de crédito no se
  paga igual dos meses seguidos. Si se edita el monto a mano, el chip salta solo
  a "cambió": marcar "el mismo" con otra cifra sería mentirle al que revise
  después.
- **Fecha** — "¿hoy u otra?", avisando si el pago va adelantado o atrasado
  respecto del día de la plantilla. No bloquea: solo confirma que fue a propósito.
- **Medio de pago** — porque solo el efectivo descuenta de la caja física
  (migración 12).
- **Clasificación** — reutiliza `clasificacionesList` de `compras.js` y
  preselecciona la del gasto fijo si coincide.

La descripción queda como `Gasto fijo: <nombre> · <extra>`, para poder
reconocer el origen dentro de tres meses.

**Casilla "Actualizar también el monto de la plantilla"**, apagada por defecto.
Solo para cambios permanentes (te subieron el arriendo). Para la variación de un
mes se deja sin marcar: el punto de equilibrio debe seguir usando el valor
habitual.

### 4.3 Buscar ventas por producto

Campo en el Historial que busca por **nombre, SKU o número de serie**.

Se resuelve en el **servidor** (`GET /api/ventas?producto=`) porque el dato vive
en `venta_items` y el navegador solo tiene la cabecera de cada venta. Filtrar en
el cliente habría obligado a pedir el detalle de las 200 ventas del período.

Son dos pasos: primero se buscan los ítems que coinciden y se sacan sus
`venta_id`, después se filtra `ventas` por esos ids. **Si no hay coincidencias
se corta ahí**: un `IN` con lista vacía devuelve la tabla entera en algunos
clientes.

- El filtro **se combina** con el rango de fechas. Por eso existe el botón
  **"Buscar en todo el historial"**: sin él, buscar con el filtro en "Hoy" daba
  cero resultados y parecía que el buscador no funcionaba.
- Retardo de 350 ms al escribir (Enter busca al instante). Sin él, "cargador"
  serían 8 consultas con su cruce contra `venta_items`.
- Cada fila muestra chips con lo que salió en esa venta, y un resumen con
  unidades y dinero del producto en el período.
- Los comodines `%` y `_` se escapan: un `%` escrito por el usuario busca un
  `%`, no "todo".

**Endpoint de apoyo:** `GET /api/ventas/items/por-ventas?ids=1,2,3` trae los
ítems de hasta 300 ventas en una llamada. Va **antes** de `/api/ventas/:id` en
el archivo; si se moviera después, Express la capturaría como un id.

---

## 5. ★ Rendimiento

Continúa el trabajo del bug 32 (que arregló `ajustarStock()`).

### 5.1 Los lotes se piden en UNA consulta

`precargarLotesVisibles()` llamaba a `/productos/:id/lotes` **una vez por cada
producto con `usa_lotes = true`**. Con 30 productos así, entrar a Productos
disparaba 30 peticiones HTTP. Era el cuello de botella real del módulo.

Nuevo endpoint `GET /api/productos/lotes-resumen`: una consulta que trae todas
las capas vigentes y las agrupa por producto. Descarta las agotadas —que no se
borran nunca, para poder devolver stock al anular una venta, así que con el
tiempo son la mayoría de las filas.

`js/lotes.js` **conserva el camino antiguo como respaldo**: si el backend no
está actualizado, la tabla sigue funcionando en vez de quedarse en "…".

### 5.2 Caché del catálogo (90 segundos)

`cargarProductos()` se ejecutaba **en cada entrada al módulo Productos**
(`config.js` lo dispara en la navegación), más al iniciar sesión, más después de
cada venta. Cada vez traía las 108 filas completas aunque no hubiera cambiado
nada, arrastrando consigo la carga de lotes.

Ahora el catálogo se considera fresco por 90 s y se repinta desde memoria.

**Esto no puede desactualizar el stock**, porque `cargarProductos(true)` ignora
la caché y se llama en **todo** lo que muta el catálogo:

| Archivo | Momento |
|---|---|
| `pos.js:694` | después de registrar una venta |
| `productos.js` | guardar, borrar, importar, eliminar en lote |
| `lotes.js` | mover o crear capas |
| `mermas.js:235` | registrar una merma |
| `historial.js` | eliminar ventas (repone stock) |
| `tiendanube.js:552` | alta por ficha pegada |

Además, si ya hay una carga en vuelo se devuelve **esa** promesa en vez de
lanzar otra: al iniciar sesión, `config.js` y `pos.js` pedían el catálogo casi
al mismo tiempo y salían dos peticiones idénticas.

### 5.3 ★ Dónde mirar si sigue lento

En orden de impacto esperado:

1. **`aplicarCostosFifo()`** — sigue siendo el sospechoso número uno al
   finalizar una venta. Llama a `fifo_consumir` **una vez por producto con
   lotes**, en serie. Se resuelve con una función `plpgsql` que reciba el
   arreglo completo de ítems. Ya estaba señalado en la sección 8.2 del v5 y
   **sigue pendiente**.

2. **Índices que faltan.** Ninguno de estos existe hoy y los tres se usan en
   cada carga:

   ```sql
   CREATE INDEX IF NOT EXISTS idx_venta_items_venta   ON venta_items (venta_id);
   CREATE INDEX IF NOT EXISTS idx_venta_items_nombre  ON venta_items (lower(nombre));
   CREATE INDEX IF NOT EXISTS idx_lotes_vigentes      ON producto_lotes (producto_id)
     WHERE agotado_en IS NULL;
   CREATE INDEX IF NOT EXISTS idx_ventas_fecha        ON ventas (fecha DESC);
   ```

   El de `venta_items(venta_id)` importa más ahora, con el buscador por producto.

3. **Región de Vercel.** Si el proyecto quedó en `iad1` (Washington, el valor
   por defecto) y Supabase está en Sudamérica, **cada consulta cruza el
   continente dos veces**. Con 4 consultas por venta son 8 travesías. Mover la
   función a `gru1` (São Paulo) o `scl1` si está disponible, y verificar que la
   región de Supabase coincida. Es probablemente la mejora más grande por menos
   trabajo de toda esta lista, y no requiere tocar código:

   ```json
   { "regions": ["gru1"] }
   ```

4. **Arranque en frío.** El plan gratuito de Vercel duerme la función; la
   primera venta del día siempre será más lenta. Un `GET /api/health` al abrir
   la caja la despierta antes de que llegue el primer cliente.

5. **Columna `descripcion` en el listado.** `GET /api/productos` hace
   `select('*')` y arrastra la descripción larga de Tiendanube de los 108
   productos en cada carga. Se puede excluir del listado y pedirla solo al abrir
   la ficha, pero **hay que revisar antes las exportaciones**, que sí la usan.

> **Lo que NO conviene hacer:** poner `LIMIT` a `/api/productos`. Siete módulos
> dependen de `productsList` como catálogo completo en memoria (buscador del
> POS, mermas, OT, lotes, tiendanube, reportes). Con `LIMIT 50` el POS no
> encontraría el producto 51 al escanear. Sigue vigente lo dicho en el v5.

---

## 6. Chequeo rápido tras cualquier refactor

Al bloque de la sección 11.1 del v5 hay que **agregarle este tercer comando**,
que es el que habría cazado los bugs 33 y 34 antes de llegar a producción:

```bash
# 1. IDs referenciados en JS que ya no existen en el HTML
grep -o "getElementById('[^']*'" js/*.js | sed "s/.*('//;s/'//" | sort -u \
  | while read id; do grep -q "id=\"$id\"" index.html || echo "FALTA: $id"; done

# 2. Sintaxis de todos los archivos
for f in js/*.js api/index.js; do node --check $f || echo "FALLO $f"; done

# 3. ★ FUNCIONES GLOBALES DECLARADAS DOS VECES (bugs 33 y 34)
for f in js/*.js; do
  grep -oP '^(async )?function \K[A-Za-z_$][\w$]*' $f | sed "s|\$| $f|"
done | sort > /tmp/fn.txt
awk '{print $1}' /tmp/fn.txt | uniq -d | while read n; do
  echo "DUPLICADA: $n"; grep "^$n " /tmp/fn.txt
done
```

El tercero **debe salir vacío**. Si sale algo, hay una función pisando a otra en
silencio y va a fallar de forma incomprensible en algún módulo lejano.

---

## 7. Pruebas de esta entrega

Se ejercitaron **41 comprobaciones de frontend** (jsdom) y **18 de backend**
(doble en memoria de Supabase), todas en verde.

> **Truco necesario para jsdom.** El límite 2 de la sección 10 del v5 —"las
> `let` de módulo no se pueden alimentar desde fuera"— tiene una salida: en vez
> de un `w.eval()` por archivo, **concatenar los 22 archivos y las pruebas en un
> solo `eval`**. El navegador comparte el ámbito léxico entre `<script>`, así
> que concatenar reproduce el comportamiento real. Con evaluaciones separadas,
> `gastosFijosLista = [...]` crea una variable distinta de la que ve la función
> y las pruebas fallan sin que haya nada roto.

Sigue vigente que jsdom **no implementa motor CSS**: los bugs 21, 26, 29, 30 y
la mitad del 33 (el apilado) no los detecta ninguna prueba automática. **El
tamaño del POS, las capas de los modales y el modal de DTE hay que verlos en el
equipo.**

---

## 8. Pendiente

- **Rotar las llaves de Supabase, `JWT_SECRET` y los PIN.** Sigue abierto desde
  varias entregas. El archivo `.env` viajó dentro del ZIP compartido por chat.
  Ahora que el PIN admite letras, conviene cambiarlo por una clave de verdad.
- Índices y región de Vercel (sección 5.3).
- `aplicarCostosFifo()` por lotes en `plpgsql`.
- Correr el SQL de limpieza de códigos `null` (bug 19 del v5).
- Activar RLS en el resto de las tablas.
- Refactor de maquetación de Historial, Productos y Gastos. **El POS ya tiene su
  lienzo redimensionable**; se puede usar el mismo patrón (`.pos-lienzo` /
  `.pos-grid`) como base para los demás módulos.
- Verificación en uso real de Finanzas y arqueo (sección 8.1 del v5).
