# v81 — Devoluciones: la venta ya no se borra, se anula

**Fecha:** 22-09-2026
**Migración:** `sql/61-devoluciones.sql`
**Pedido por:** el dueño: *"Me falta una opción en el POS para aplicar devoluciones y registrar o
anular ventas […] lo ideal es que yo pueda buscar a través de la fecha, o por el producto, o por el
servicio que se adquirió, y yo poner una observación, medio de pago por el cual se le devolverá"*.

Esta es la **Etapa 1** de una propuesta de tres. Las etapas 2 y 3 están al final.

---

## El hallazgo que cambió el diseño

La propuesta original era "agregar un botón de devolución". Al revisar el código apareció algo más
grave: **la única forma de revertir una venta era borrarla**. `DELETE /api/ventas/:id` devolvía el
stock y las capas PEPS correctamente, pero la venta desaparecía de la base.

Y los datos reales dicen esto:

```
SIN DTE   142 ventas
BOLETA     60 ventas   ← ya declaradas al SII
```

**60 de 202 ventas tienen boleta emitida.** Borrar una de esas deja al POS diciendo algo distinto de
lo ya declarado, y la diferencia reaparece meses después en el F29 sin rastro de dónde salió. En
Chile una boleta no se borra: se reversa con **Nota de Crédito**.

Por eso la v81 no agrega un botón: **cambia la forma de revertir una venta**.

---

## Lo que ya existía y no se reconstruyó

De lo que pidió el dueño, la mitad ya estaba hecha:

| Lo pedido | Dónde ya estaba |
|---|---|
| Buscar por fecha | Historial de Ventas |
| Buscar por producto / servicio | `GET /api/ventas?producto=` — busca por nombre, SKU, N° de serie y código de barras |
| Devolver stock y capas PEPS | `devolverConsumoLotes` + `fifo_devolver` |
| Que el egreso llegue al arqueo | La caja ya resta los `EGRESO` sola |
| Que salga del balance | Los 8 lugares de Finanzas filtran por `estado = 'PAGADA'` |

Lo que faltaba era el **registro**: quién, cuándo, por qué, cuánto y por qué medio salió la plata.

---

## Cómo quedó

### El estado `ANULADA`

`ventas.estado` acepta un tercer valor. Como los 8 lugares donde Finanzas lee ventas (balance,
utilidades, saldos, dashboard, contador, proyección, arqueo e IVA) ya filtraban por `PAGADA`, una
venta anulada sale de todos ellos **sin tocar una línea de esos cálculos**.

### Por qué el F29 es la excepción

Si una boleta de agosto se devuelve en septiembre, el débito de **agosto tiene que seguir siendo el
que se declaró**: la reversa va en septiembre, con su Nota de Crédito. Sin esto, devolver una boleta
vieja haría encoger hacia atrás un mes ya presentado.

Por eso el cálculo del débito suma de vuelta las devoluciones **posteriores** al período consultado.
Las de dentro del período no, porque ahí la Nota de Crédito cae en el mismo mes y ya está descontada.

Consecuencia de diseño: `devoluciones.monto` guarda **siempre** el valor de la mercadería que volvió,
aunque no haya salido plata del cajón. Si guardara 0 en los cambios por otro producto, el débito de
un mes declarado encogería. Que el dinero saliera o no lo dicen `metodo_devolucion` y
`caja_movimiento_id`.

### Devolución parcial

La venta sigue `PAGADA` y se le rebajan `total`, `costo_total` y `utilidad` por las líneas devueltas.
Así los mismos 8 lugares quedan correctos sin cambiarlos.

**`comision_pos` NO se rebaja, a propósito:** al revertir una venta con tarjeta la pasarela no
reintegra su comisión. Ese costo ya se pagó y borrarlo inflaría la utilidad del mes.

**El descuento de la venta se reparte a prorrata.** Sin eso, devolver una línea de una venta con 10%
de descuento devolvería $100.000 por algo que el cliente pagó $90.000.

### PEPS al revés

`devolverConsumoLotes` trabaja por venta completa y borra el libro de consumo entero, así que no
servía para devolver 1 de 3. `devolverLotesDeLinea()` recorre el consumo de la línea en orden
**inverso** (lo último que se consumió es lo primero que vuelve) y rebaja o borra cada fila del libro
según cuánto se tome.

### El cajón

Si la devolución es en efectivo y hay caja abierta, se crea el `EGRESO` solo y queda enlazado a la
devolución. El arqueo cuadra sin que el dueño haga nada. Si no hay caja abierta, la devolución **se
registra igual** y avisa — nunca falla por eso.

### Borrar quedó restringido

`DELETE /api/ventas/:id` ahora solo acepta su único caso legítimo: una venta **de hoy** y **sin
documento tributario** (un error de tipeo recién cometido). Todo lo demás responde 409 y manda a
"Devolver / Anular".

### Permisos

**El trabajador también puede devolver** (decisión del dueño): es una operación de mostrador, no una
edición del historial. Por eso `auth()` y sin PIN, a diferencia de editar o borrar una venta.
`limpiarParaRol` sigue ocultándole costos y utilidad; el precio y el descuento sí los recibe, así que
el monto que ve antes de confirmar es el correcto.

---

## En pantalla

Desde el Historial, botón **↩️** en cada fila (no `admin-only`). El modal pide cuatro cosas:

1. **Qué vuelve** — cada línea con su cantidad, descontando lo ya devuelto antes. Botón "Devolver
   todo" para el caso más común.
2. **Por qué** — falla, garantía, se arrepintió, producto equivocado, error de venta u otro (este
   último exige observación).
3. **Por dónde se devuelve la plata** — puede ser distinto al medio de la venta. "Sin devolución de
   dinero" cubre el cambio por otro producto.
4. **¿Vuelve al stock?** — por línea, porque de dos productos devueltos uno puede volver a la repisa
   y el otro estar quemado. Una pieza usada en una OT nunca vuelve: ya se gastó en el taller.

Si la venta tiene BOLETA o FACTURA, el modal avisa **antes** y vuelve a avisar después con un diálogo
que no se desvanece. **El POS nunca entra al SII**: solo deja el registro listo y avisa; la Nota de
Crédito la emite el dueño.

Las ventas anuladas se quedan en el historial, apagadas y con el número tachado.

---

## Probado

- **58 comprobaciones de backend** (doble de Supabase en memoria + Express real): anulación total,
  doble anulación bloqueada, parcial, tope de unidades, PEPS al revés, egreso de caja, sin caja
  abierta, transferencia, cambio sin dinero, aviso de boleta, prorrateo del descuento, rol
  trabajador, mercadería que no vuelve, validaciones, venta "Por Pagar", borrado restringido.
- **45 comprobaciones de interfaz** (jsdom, los `js/*.js` concatenados en orden real): que el modal
  exista y arranque cerrado, que descuente lo ya devuelto, que escape el nombre del producto, que el
  monto mostrado coincida con el del servidor, y que envíe exactamente lo elegido.
- **Navegador real** (Browser pane, escritorio y móvil 375px). Ahí apareció un hueco en móvil por el
  `flex: 1 1 220px` de la ficha del producto; corregido en el media query.
- Chequeos del proyecto: `node --check`, funciones globales duplicadas y `id` duplicados, los tres
  vacíos. No se agregaron clases de Tailwind, así que no hubo que recompilar.

---

## Lo que NO entra en esta etapa

- **Merma automática.** Si una línea no vuelve al stock, queda registrada (`reingresa_stock = false`)
  pero todavía **no genera la merma ni el gasto**. La columna `devolucion_items.merma_id` ya existe
  esperando la Etapa 2. Mientras tanto, esa mercadería perdida no aparece como costo.
- **Etapa 2:** merma automática, motivo "Garantía" preseleccionado cuando el ítem está en garantía,
  y notificación en la pestaña principal si una devolución en efectivo quedó sin movimiento de caja.
- **Etapa 3:** panel de Devoluciones en Finanzas y su reflejo en la utilidad del mes.
