# v128 — IVA a favor al día: chip en el encabezado y detalle día a día (06-10-2026)

Pedido del dueño (pendiente #75): cargar el F29 de septiembre y ver en el POS, sin entrar a Finanzas, cuánto IVA
crédito va acumulando día a día.

## El F29 de septiembre

Propuesta entregada por el dueño el 06-10-2026 (texto y pantallazo, iguales en los 12 códigos). No está presentada
todavía (vence el 20-10).

| Código | Qué es | Monto |
|---|---|---|
| 538 | Débito (boletas) | $251.952 |
| 520 − 528 = 511 | Facturas recibidas − notas de crédito | $369.747 − $5.746 = $364.001 |
| 504 | Remanente del mes anterior | $220.782 |
| 537 | Total créditos | $584.783 |
| **77** | **Remanente para octubre** | **$332.831** |
| 089 | IVA a pagar | $0 |
| 062 / 91 | PPM y total a pagar | $1.658 |

Cuadra al peso con lo que el robot del SII ya tenía guardado (17 facturas $369.747, 1 nota de crédito $5.746, 38
boletas $251.952). Se cargó `iva_remanentes('2026-09') = 332831`, fuente "propuesta F29".

El 504 trae $220.782 y el POS tenía $219.227 de agosto: la diferencia ($1.555) es el reajuste por UTM que aplica el
SII al remanente. El POS no lo calcula; por eso cada mes el número exacto sale del F29.

## Lo que estaba mal

1. **Del 1 al 6 de octubre el POS mostraba casi $0 de crédito**, con $332.831 reales a favor. El semáforo buscaba el
   remanente del mes anterior y, si nadie había cargado el F29, quedaba en "Sin dato".
2. **El débito del mes en curso salía inflado a favor.** Apenas el SII informaba una boleta, el POS dejaba de mirar
   sus propias ventas. El 06-10 el SII llevaba 1 boleta de octubre ($2.395 de IVA) y el POS tenía 4 ($36.719).

## Qué cambió

- **Chip "IVA a favor $X" en el encabezado** (solo admin). Verde si alcanza, ámbar si al ritmo del mes se acaba antes
  de fin de mes, rojo si ya hay IVA por pagar. Se recalcula al entrar, cada 10 minutos y apenas se cobra una venta o
  se cambia el documento de una (evento `pos:iva-cambio`).
- **Ventana "IVA a favor al día"** (clic en el chip): la cuenta en cuatro líneas (venía del mes anterior + facturas
  − boletas = te queda) y el **día a día**, con cada factura que suma, cada día de boletas que resta y el saldo que
  va quedando. Botón para traer las facturas del SII en el momento.
- **`calcularIvaMes()` (api/index.js):**
  - En el mes en curso el débito es **el mayor entre el SII y el POS**. Los dos se quedan cortos (el SII llega
    atrasado; el POS no ve las boletas que la máquina emite sola), así que se usa el más alto. En un mes cerrado
    manda el SII.
  - **Remanente encadenado** (`remanenteDeIvaAl`): si falta el F29 del mes anterior se estima desde el último
    conocido con lo que el robot guardó del RCV (máximo 6 meses). Queda marcado "estimado" y un poco bajo el real.
  - Devuelve `movimientos` (el día a día, que siempre termina en el titular) y `brechaMesAnterior`.
- **Aviso de la brecha:** en septiembre el SII cerró con 38 boletas y el POS tenía anotadas 20 ($25.070 de IVA). La
  ventana lo dice, porque este mes puede pasar lo mismo.
- La tarjeta de Finanzas → Utilidades usa el mismo cálculo: el chip, la ventana y la tarjeta no pueden discrepar.

## Qué tan "al día" es

- **Boletas:** al instante, apenas se cobra en la caja.
- **Facturas de compra:** cuando corre el robot del SII (una vez al día) o con el botón. La única fuente es el SII.

## Cómo se probó

- Servidor: 38 de 38 con un doble de Supabase cargado con los datos reales de IVA (solo lectura). Hoy da $298.668
  ($332.831 + $2.556 − $36.719); septiembre cuadra con el F29; sin F29 estima $331.276 (real $332.831); con un hueco
  en el RCV dice "sin dato" en vez de inventar; una boleta nueva baja el número; el trabajador recibe 403.
- Maqueta: el chip, la ventana, el texto con `<b>` escapado, y una venta con boleta hecha por `confirmarVenta()`
  baja el chip sola ($370.992 → $354.387).
- **No probado:** el robot del SII corriendo con este cambio (no se tocó el robot, solo la lectura).

## Encontrado y sin tocar (espera decisión del dueño)

En Finanzas → Utilidades, el bloque "IVA" de más abajo calcula por su cuenta, con las compras del POS marcadas "con
factura". **Ninguna compra del POS tiene esa marca** (0 en todo el historial), así que ese bloque muestra crédito $0,
"IVA a pagar" igual a todo el IVA de las boletas ($226.882 en septiembre, cuando lo real fue $0) y remanente $0. La
casilla "IVA (19%)" viene marcada y resta ese monto de la utilidad.
