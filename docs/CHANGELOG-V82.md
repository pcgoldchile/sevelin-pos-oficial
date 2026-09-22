# v82 — Devoluciones, Etapa 2: la pérdida se registra sola

**Fecha:** 22-09-2026
**Migración:** ninguna nueva — usa lo que ya creó `sql/61` (la columna
`devolucion_items.merma_id` quedó esperando desde la v81)
**Pedido por:** el dueño, al aprobar la Etapa 1: *"Sigue con la etapa 2."*

---

## 1. La mercadería que no vuelve se da de baja sola

Era el hueco que quedó a la vista en la v81. Cuando en una devolución se desmarca "Vuelve al stock"
—el producto vino quemado—, hasta ayer eso quedaba **registrado pero sin efecto contable**:

- la venta salía del balance (queda `ANULADA`),
- pero el costo de esa mercadería **no aparecía en ninguna parte**,
- así que el mes se veía mejor de lo que realmente fue.

Ahora esa línea genera automáticamente una **merma** con su **costo PEPS real** (el mismo que se
aplicó al vender, guardado en `venta_items.costo_unitario`) y su gasto en la clasificación
*Mermas / Pérdidas de Inventario* — exactamente igual que una baja hecha a mano.

### Los tres casos donde NO se da de baja, y por qué

| Caso | Por qué no |
|---|---|
| **El stock no se descuenta** | Estas unidades nunca volvieron al inventario: ya estaban descontadas desde la venta. Descontarlas otra vez dejaría el stock en negativo. |
| **Repuesto usado en una OT** | Su costo ya se cargó a la orden de trabajo. Contarlo acá sería el mismo gasto dos veces. |
| **Servicio** | No hay mercadería física que perder. |

Y una decisión menor: si el costo es $0, **la merma sí se registra** (es el rastro de inventario)
pero **no se crea el gasto**, para no llenar la lista de Gastos de líneas de $0.

Si la baja falla, la devolución **no se cae**: la plata ya se devolvió y el stock ya se movió. Queda
el aviso en el log y la línea sin `merma_id`.

---

## 2. La garantía viene preseleccionada

`GET /api/ventas/:id` ahora devuelve, por cada línea, `vence_el` y `estado_garantia`. Se calcula con
la **misma** `calcularEstadoGarantia` que usa el panel de Garantías: la regla vive en un solo lugar y
las dos pantallas no pueden discrepar.

En el modal de devolución eso se traduce en dos cosas:

- un chip por línea — *🛡️ En garantía hasta 2027-03-01* o *⌛ Garantía vencida el …*, para que el
  dueño sepa si le corresponde cubrirlo **antes** de decidir;
- si queda algo en garantía vigente, el motivo arranca en **"Garantía"** en vez de "Vino fallado".

---

## 3. Aviso: plata devuelta en efectivo que no quedó en ninguna caja

Si se devuelve efectivo **sin caja abierta**, la plata sale del cajón igual, y al cerrar el turno el
arqueo da de menos sin explicación. Antes eso solo aparecía como un aviso puntual al confirmar la
devolución, que se perdía apenas cerrabas la ventana.

Ahora hay un botón rojo en el header — **💸 N devoluciones sin caja** — que:

- **no es `admin-only`**: el trabajador también devuelve, y es el arqueo de su turno el que va a
  quedar corto;
- se revisa solo cada 5 minutos y al terminar cada devolución;
- abre un listado con la venta, el monto, el motivo y la observación.

### Lo que sí y lo que no se puede arreglar de un clic

Solo las devoluciones **de hoy** ofrecen el botón "Registrar en la caja de hoy". Las de días
anteriores muestran *"Es de otro día: ajústalo a mano en la caja del …"*.

**El motivo importa:** meter en la caja de hoy una plata que salió del cajón hace tres días
descuadraría **los dos días** en vez de uno. El servidor lo rechaza aunque alguien fuerce la
llamada, y lo explica en el mensaje de error.

---

## Probado

- **89 comprobaciones de backend** (31 nuevas): merma con el costo PEPS correcto, gasto enlazado,
  `merma_id` en la línea devuelta, que el stock NO se descuente otra vez, servicio sin merma,
  repuesto de OT sin doble gasto, merma de $0 sin gasto, el estado de garantía en el detalle, el
  listado de pendientes de caja, registrar el egreso, rechazo del segundo intento y rechazo por
  fecha distinta, y que una transferencia no aparezca en el aviso de efectivo.
- **61 comprobaciones de interfaz** (16 nuevas, jsdom): los chips de garantía, la preselección del
  motivo en los dos sentidos, el botón del header apareciendo y ocultándose, el modal con su listado,
  que la de otro día no ofrezca el botón, y que la observación vaya escapada.
- **Navegador real** (Browser pane): el modal con los chips de garantía y el aviso del header en rojo
  con su animación.
- Chequeos del proyecto: `node --check`, funciones globales duplicadas, `const/let` globales
  duplicados e `id` duplicados — los cuatro vacíos. Sin clases nuevas de Tailwind.

### Dos tropiezos de la prueba, anotados para no repetirlos

- El doble de Supabase no tenía `mermas` en su lista de tablas: se creaba sola al insertar, pero
  `reiniciar()` la borraba. Un test pasó por casualidad y el siguiente explotó.
- El jsdom guardaba la sesión en `sessionStorage` con la clave `token`, y las reales son `pos_token`
  y `pos_rol`. Con la clave mala, `tokenActual()` devuelve null y la función sale antes de hacer
  nada: la comprobación "sin pendientes queda oculto" pasaba sin ejecutar una sola línea útil.

---

## Lo que queda (Etapa 3)

Panel de Devoluciones en Finanzas: verlas por período, el total devuelto del mes, cuánto se perdió en
mermas por devolución y el filtro de las que esperan Nota de Crédito (el endpoint
`GET /api/devoluciones?solo_nota_credito=true` ya existe desde la v81).
