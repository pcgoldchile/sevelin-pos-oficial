# v66 — Envíos de tu bolsillo, peso en gramos, agotados y rotación de compras

**Fecha:** 16-09-2026
**Migraciones:** `sql/54`, `sql/55`, `sql/56`
**Pedido por:** el dueño, en una sola tanda de cinco cosas.

---

## 1. El envío que salió de tu bolsillo (`sql/54`)

**El caso real:** «le dije $3.000 al cliente, pero a la final la app me hizo pagar $3.500».
Esos $500 los ponía el dueño y **no se veían en ninguna parte**.

Lo que ya existía (v63, `sql/50`): la tabla `envios` guardaba **un solo monto**, el costo real,
que se registra entero como gasto "Envíos / Despachos" y, si salió del cajón, como egreso del
turno. O sea: la plata que salió ya estaba bien contada. Lo que faltaba era **la otra mitad**.

**Lo que se agregó:**

- Campo **"Le cobré al cliente"** en el paso de entrega. Vacío se guarda `NULL`, **nunca 0**: un 0
  querría decir "envío regalado" e inventaría una pérdida que quizás no hubo.
- Aviso en vivo, antes de registrar la venta:
  > ⚠️ Este envío lo pusiste tú: $500 de tu bolsillo (cobraste $3.000, pagaste $3.500).
  > · Este mes llevas $2.300 de tu bolsillo en 4 envíos.
- Campo **"Demoró (min)"** — el tiempo real del viaje (el dueño eligió el real, no el prometido).
  Con los km que ya se guardaban, permite ver qué sectores salen caros en tiempo y no solo en plata.
- El label del campo viejo pasó a decir **"Costo real (lo que pagas tú)"**, que es lo que siempre fue.

### ⚠️ La diferencia NO se registra como merma ni como gasto aparte

Decisión explícita y documentada en el propio SQL. Los $3.500 **ya están contados** como gasto.
Si además se anotaran $500 de merma, esos $500 quedarían **contados dos veces** y el resultado del
mes saldría peor de lo que es. La pérdida del despacho es un dato **derivado** (`costo − cobrado`):
se calcula, se muestra y se suma en el resumen del mes, pero no se asienta.

`GET /api/envios/resumen` devuelve ahora `bolsillo: { envios, total, mes }` y `duracionPromedio`.

---

## 2. Ver la foto del producto en grande (POS)

Una miniatura de 48px no alcanza para confirmar que el producto que se está cobrando es el que el
cliente tiene en la mano. Ahora **se hace clic en la foto y se abre en grande**: en la foto del
artículo que se está agregando (con todas sus fotos y flechas para pasarlas) y en cada fila del
carrito.

- Visor nuevo y **compartido** en `js/config.js` (`abrirVisorImagen`). Se arma en el momento y se
  destruye al cerrar: **no agrega ids fijos a `index.html`** (regla 2 del CLAUDE.md).
- Flechas ← →, Escape, clic fuera para cerrar. `z-index: 10100`, por encima de todos los modales.
- `miniaturaProducto(p, tam, { ampliable: true })` — **opt-in a propósito**: en las tablas donde la
  fila entera ya hace algo al hacer clic, robarle el clic a la miniatura confundiría.

---

## 3. Peso en gramos, con lectura en vivo

**El error que evita:** escribir `45` pensando en gramos y guardar **45 kilos**. No se nota nunca en
pantalla, pero ensucia el costo de despacho de ese producto para siempre y viaja tal cual al CSV de
Tiendanube.

- Selector de unidad **kg / g** junto al campo de peso.
- Lectura en vivo debajo: `✔️ El peso está siendo 0,045 kg = 45 gramos`.
- Dos avisos en rojo: más de **20 kg** ("¿Seguro? Si eran gramos, cambia la unidad a «g»: quedaría
  0,045 kg") y menos de **1 gramo** (el error al revés).
- **Cambiar de unidad reinterpreta, no convierte.** Escribiste 45, te das cuenta de que eran gramos,
  aprietas «g» y queda 45 g. Convertirlo daría 45.000 g, que no le sirve a nadie.
- La base sigue guardando siempre `peso_kg` en kilos. Al abrir un producto, se muestra en la unidad
  que se lee mejor (menos de 1 kg → gramos).

---

## 4. Agotados: encargo, por llegar o archivar — **con tu aprobación** (`sql/55`)

Un producto que llegaba a stock 0 se quedaba callado: no se reponía, no se archivaba, no pasaba a
encargo. Los tres caminos ya existían (`por_llegar` sql/42, `es_pedido_encargo` sql/30, `archivado`
sql/32); lo que faltaba era algo que **preguntara** cuál corresponde.

- Botón **📦 Agotados (N)** en el header, al lado del F29. Solo aparece si hay alguno sin decidir.
- El modal muestra, por producto: foto ampliable, **cuánto vendía** (unidades en 90 días y ritmo
  mensual), la fecha de la última venta y **el margen por unidad**. Sin eso la decisión se tomaría a
  ciegas: no es lo mismo que se agote algo que vendía 8 al mes que algo que vendió 1 en todo el año.
- Cuatro salidas: **🚚 Por llegar** (pide cuántas vienen y cuándo), **📝 Por encargo**,
  **🗄️ Archivar** (también lo despublica de la tienda) y **Dejarlo como está**.

**REGLA DEL DUEÑO: nada se mueve solo.** El POS detecta y pregunta; el cambio sobre `productos` lo
aplica el servidor **recién** cuando hay una decisión aprobada. "Dejarlo como está" también se
guarda — si no, el aviso volvería cada vez y se volvería ruido que se ignora.

**Si el producto vuelve a tener stock, la fila se borra sola.** Cuando se agote de nuevo, vuelve a
preguntar: la decisión de septiembre no tiene por qué valer para la de diciembre.

---

## 5. Compras de mercadería: fechas, devoluciones y rotación (`sql/56`)

Las dos preguntas textuales del dueño:

> «Compré 50 ventiladores: ¿se están vendiendo en una fecha esperada o mejor devolverlos y
> comprarlos en otra fecha?»
> «Compré 20 monitores para navidad, pero al llegar el 1 de enero todavía me sobran 10.»

Hasta ahora el POS no sabía nada de eso: `productos.stock` es un número sin historia.

**Dónde se carga:** modal del producto → **"Compras de este producto"**. Fecha de compra, cuántas,
costo por unidad, proveedor, N° de factura y **hasta cuándo el proveedor las recibe de vuelta**.

**Dónde se lee:** Finanzas → Inteligencia → **"Compras y devoluciones"**. Una tarjeta por compra
abierta con: vendidas, restantes, ritmo mensual, plata adentro, meses para agotarse y **el consejo
con su razón a la vista**:

| Consejo | Cuándo |
|---|---|
| 🔴 Devolver YA | va a sobrar y el plazo vence en 7 días o menos |
| 🟠 Conviene devolver | va a sobrar y el plazo todavía corre |
| ⏰ Se cerró el plazo | ya no se puede devolver: solo queda venderlas |
| 🪨 Liquidar | 60+ días sin una sola venta y sin ventana de devolución |
| 👀 Rota lento | tarda más de 6 meses en venderse |
| ✅ Va bien | se vende antes de que venza el plazo |

Ejemplo real que devuelve el servidor:
> Al ritmo de ahora (5/mes) te van a sobrar 37 cuando se cierre el plazo. Se pueden devolver hasta
> 37 unidades, y el plazo vence en 20 días. Son $74.000 que vuelven a tu bolsillo.

### Decisiones que importan

- **Tabla nueva, no `producto_lotes`.** Los lotes de `sql/09` existen para el **costo por PEPS** y
  solo funcionan con `usa_lotes` encendido (hoy: 1 producto de 185). Encenderlo cambia de dónde sale
  el costo de cada venta — o sea, cambia la utilidad de ese producto. **Anotar una fecha de compra
  no puede tener ese efecto secundario.** `ingresos_mercaderia` no toca el costeo de nada.
- **Nada del análisis se guarda.** Un "te sobran 10" guardado envejece mal y después se lee como si
  fuera de hoy. Se calcula entero en el servidor, en cada consulta.
- **Reparto por orden de llegada.** Si compró 50 en agosto y 20 en noviembre, las ventas de
  septiembre se descuentan de las de agosto. Es una **atribución, no un hecho**: el POS no sabe de
  qué caja física salió cada unidad.
- **Tope contra el stock real.** Si las cuentas dicen que quedan 12 y en la estantería hay 8, manda
  el 8. La diferencia es merma, robo o un ajuste, y suponer 12 llevaría a ofrecerle al proveedor una
  devolución que no se puede cumplir.
- **`devolucion_hasta` en NULL ≠ fecha vencida.** NULL = el proveedor no acepta devoluciones;
  vencida = la ventana se cerró. El informe los trata distinto y lo dice con palabras distintas.
- Una entrada **se cierra, no se borra** (devuelta / vendida / liquidada): el historial de compras es
  justamente lo que hace útil la tabla. Borrar queda para un registro mal cargado.

---

## Migraciones

| Archivo | Qué hace |
|---|---|
| `sql/54-envio-cobrado-y-duracion.sql` | `envios.cobrado_cliente`, `envios.duracion_min` |
| `sql/55-agotados-decision.sql` | tabla `agotados_decisiones` (+ RLS) |
| `sql/56-ingresos-mercaderia.sql` | tabla `ingresos_mercaderia` (+ RLS) |

Las tres son idempotentes. Las dos tablas nuevas nacen con **RLS activado** — el frontend nunca habla
con Supabase directo, y sin RLS quedarían abiertas a la llave anónima (el olvido que ya costó dos
alertas críticas en la tienda).

```bash
npx supabase db query --file sql/54-envio-cobrado-y-duracion.sql --linked
npx supabase db query --file sql/55-agotados-decision.sql --linked
npx supabase db query --file sql/56-ingresos-mercaderia.sql --linked
```

---

## Qué se probó (y qué no)

**Probado de verdad**, con el doble en memoria de Supabase (Express real levantado con `app.listen(0)`)
y con jsdom para el frontend:

- **Envíos (16):** que se guarden `cobrado_cliente` y `duracion_min`; que un cobro vacío quede `NULL`
  y no 0; que **el gasto siga siendo el costo completo y uno solo** (que los $500 no se cuenten dos
  veces); que el egreso del turno sea el costo real; el aviso del bolsillo en sus cinco casos.
- **Visor de imagen (18):** clic, flechas, teclado, Escape, una sola foto, no apilar dos visores,
  escapado del nombre del producto.
- **Peso (16):** los dos errores de unidad, la ida y vuelta 0,045 kg ↔ 45 g sin pérdida, y que
  cambiar de unidad reinterprete en vez de convertir.
- **Agotados (24 backend + 21 frontend):** qué entra y qué no a la cola (servicios, stock ilimitado,
  encargos y archivados quedan fuera); que **nada se mueva sin decisión**; que consultar dos veces no
  duplique filas; que al reponerse vuelva a preguntar; las cuatro salidas; decisiones inválidas.
- **Rotación (37 backend + 25 frontend):** los dos casos del dueño con números exactos, el tope
  contra el stock real, el reparto entre dos compras del mismo producto, plazo vencido, plazo
  urgente, y las validaciones de alta (fecha futura, cantidad 0, devolución anterior a la compra).
- **Humo:** los 35 `js/*.js` cargados juntos en el orden del `index.html`, con `DOMContentLoaded`
  disparado, sin un solo error.

**No se pudo probar** (no hay navegador real en este entorno, ver CLAUDE.md): lo visual — cómo se ve
el visor sobre el tema oscuro, cómo caen las tarjetas de "Compras y devoluciones" en el teléfono, y
los colores del aviso de peso. Eso se razonó, no se renderizó.
