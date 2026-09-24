# v88 — Activos de uso interno: lo que sacas del stock para el taller

**Fecha:** 24-09-2026
**Migración:** `sql/64-activos-uso-interno.sql` (aplicada en producción el 24-09-2026)
**Decisión del dueño:** *"Sí apruebo"* — sacar una unidad a uso interno **no mueve el balance**.

---

## El problema

El dueño abrió una **Fuente de Poder 650W MSI MAG A650BN** (producto id 144) para usarla como
herramienta del taller. El POS seguía contándola como stock vendible:

```
productos.id = 144 · stock = 2 · costo $44.752 · precio $55.000 · publicado_web = true
```

Tenía **1 para vender y 1 abierta en el banco de trabajo**, pero el POS y sevelin.cl ofrecían 2. Se
podía vender por la web algo que ya estaba usado.

---

## Por qué NO se resolvió con lo que ya existía

| Camino | Por qué no |
|---|---|
| **Merma** | Descuenta stock **pero además genera un gasto** en `compras` con la clasificación "Mermas / Pérdidas de Inventario". No se perdió nada: la fuente sigue valiendo $44.752 y puede volver a venderse. Ensuciaría el balance y el F29. |
| **Venderse a sí mismo** | Ingreso falso, utilidad falsa, y un problema con el SII. |
| **Bajar el stock a mano** | No deja rastro de por qué bajó ni de dónde está la unidad. |

---

## ⚠️ La regla de plata que define el módulo (aprobada por el dueño)

> **Sacar una unidad a uso interno NO mueve el balance. Ni un peso.**

El razonamiento: esa plata **ya se gastó** al comprarle la unidad al proveedor, y esa compra **ya
está registrada en `compras`**. Anotarla de nuevo como gasto sería contarla dos veces. Lo único que
cambia es la **categoría** del activo: deja de ser mercadería para vender y pasa a ser herramienta.
El patrimonio es el mismo antes y después.

Lo que sí cambia —y es correcto— es que la **valorización de inventario baja**: ese inventario ya no
se puede vender. El panel lo muestra explícito: *"Inventario apartado (a costo) · No es una pérdida:
tu balance no se movió."*

---

## 🔴 La trampa que se encontró escribiendo el código

El diseño original decía *"al dar de baja, registra la merma a mano en el módulo de Mermas"*. **Eso
habría descontado el stock dos veces.**

La secuencia del error:

1. La fuente pasa a uso interno → `productos.stock` baja de 2 a **1**. Correcto.
2. Meses después se quema y se da de baja.
3. Se registra la merma → el módulo lee `productos.stock` (= 1) y lo baja a **0**.

Pero esa unidad que quedaba **sí estaba para vender**. El inventario quedaría corto en una unidad, en
silencio.

**Cómo quedó:** `DADO_DE_BAJA` solo cierra la ficha y muestra cuánto costo se da por perdido. El
modal lo dice en rojo: *"NO registres además una merma: el stock ya salió al apartarla, y la merma
descontaría una segunda unidad."* Si algún día se quiere que además golpee el balance, tiene que ser
con un gasto que **no toque inventario**, no con una merma.

La migración y el código llevan el comentario para que no se re-descubra.

---

## Qué se construyó

### `sql/64` — tabla `activos_uso_interno`

Campos **congelados** al momento de apartar la unidad (mismo principio que `venta_items`: si mañana
cambia el costo del producto, el registro histórico no se mueve): `nombre`, `sku`, `cantidad`,
`costo_unitario`.

Ciclo de vida en `estado`:

| Estado | Qué hace con el stock |
|---|---|
| `EN_USO` | Ya descontado |
| `DEVUELTO_A_VENTA` | **+1 al stock**, se vende por el POS como cualquier otra |
| `ARMADO_EN_PC` | Consumida. Guarda opcionalmente en qué equipo (`producto_destino_id`) |
| `DADO_DE_BAJA` | Consumida. **No genera merma** (ver arriba) |

**Para venderla no hay un estado aparte a propósito:** primero vuelve a venta y se vende por el POS.
Así la venta queda registrada como cualquier otra, con su utilidad real, y hay un solo camino por
donde se mueve la plata.

RLS habilitada sin políticas, como toda tabla del proyecto.

### Backend — 5 endpoints, todos `auth(true)` (solo admin)

`GET /api/activos` · `POST /api/activos` · `PATCH /api/activos/:id` ·
`POST /api/activos/:id/cerrar` · `DELETE /api/activos/:id`

- **Compare-and-swap al descontar:** el `update` compara contra el stock que se acaba de leer
  (`.eq('stock', prod.stock)`). Si alguien vendió esa unidad entre la lectura y la escritura, no
  afecta ninguna fila y responde 409 en vez de dejar el stock en negativo.
- **Rollback:** si falla el insert del registro, el stock se devuelve. No puede quedar descontado sin
  su ficha.
- Rechaza productos con `stock_ilimitado` (servicios): no hay unidad física que apartar.
- `DELETE` solo funciona con un activo `EN_USO` — deshacer un tipeo. Uno ya cerrado no se borra, su
  stock siguió otro camino.

### Respaldo documental (pedido del dueño)

> *"En lo posible que cuando añada algo a activo fijo, pueda adjuntar el archivo o N° de factura o
> boleta de ese activo fijo."*

Se guardan los dos y **ambos son opcionales**: el número suelto sirve aunque no tenga el PDF a mano, y
el archivo se puede subir después (es normal encontrar la boleta una semana más tarde — por eso el
`PATCH` permite agregarlo sin tocar cantidad ni costo).

**No se creó ningún endpoint ni bucket nuevo:** reutiliza `POST /api/compras/archivo` y
`POST /api/compras/firmar`, y el bucket privado `compras-documentos`. Hereda la protección FILE-01:
ruta con UUID (no enumerable) y **URL firmada que caduca en 1 hora**. Por eso se guarda la `ruta`
(estable) y no la URL, y se re-firma al abrir.

### Frontend — `js/activos.js` + **Finanzas → 🛠️ Activos**

Vive en Finanzas, que ya está detrás del PIN de admin y del cierre por inactividad. Chips *En uso* /
*Todos*, dos KPI (unidades y valor apartado a costo), tabla con el respaldo documental, y dos modales
(apartar / cerrar). Todo dato de usuario pasa por `escHtml`.

---

## Pruebas

- **Backend — 38 comprobaciones, 0 fallas.** Doble de Supabase en memoria (`createClient` mockeado vía
  `require.cache`, `app.listen(0)`). Cubre permisos, validaciones, el descuento y la devolución de
  stock, el congelado de costo y nombre, los cuatro cierres, el doble cierre (409) y —explícitamente—
  que **no se crea ningún gasto ni ninguna merma**.
- **Interfaz — 71 comprobaciones, 0 fallas.** jsdom con el `index.html` real y los 41 `js/*.js` en el
  mismo orden que el navegador. Incluye una prueba de XSS en el nombre del producto.
- `node --check` en los 4 archivos tocados · los dos chequeos de colisión (funciones e ids) vacíos.
- **Tailwind no necesitó recompilarse:** no se agregó ninguna clase nueva, todo el panel reutiliza el
  CSS que ya existía (`kpi-card`, `doc-estado`, `data-table`, `chip`…). Se corrió igual para
  confirmarlo y el compilado salió idéntico.

### Lo que NO se pudo verificar

El módulo **no se probó en el navegador real ni en producción**: el código está en el working tree,
sin commit ni deploy. La tabla sí está creada en la base de producción (es aditiva e inofensiva sin
el código). Hasta que se despliegue, la sub-pestaña no existe para el usuario.

---

## Pendiente del dueño

Registrar la fuente MSI real desde **Finanzas → 🛠️ Activos → "Pasar producto a uso interno"**. Hasta
que lo haga, `productos.id = 144` sigue con `stock = 2` en producción y sevelin.cl la sigue ofreciendo
como si hubiera dos.

---

## Anotado, no hecho

- **Vincular el activo a su fila de `compras`** (la compra original con su factura) en vez de escribir
  el número a mano. Se dejó fuera para no meter un selector más en el modal antes de ver cómo lo usa.
- **Sumar automáticamente el costo al equipo** cuando se cierra como `ARMADO_EN_PC`. Hoy el modal solo
  se lo recuerda: *"acuérdate de sumarle su costo al equipo cuando lo crees en el catálogo."*
