# Venta mayorista, Fase 2 — propuesta de alcance (02-10-2026)

> Hecha por Claude a pedido del dueño (pendiente #28). La Fase 1 está en `docs/CHANGELOG-V103.md`.
>
> **Estado al 02-10-2026 (tarde):** la pieza **B (lista de precios) está hecha** a pedido del dueño: PDF y
> Excel en `/mayorista`, con todo el catálogo por categoría, y de paso el cotizador del carrito ya cotiza a
> precio mayorista. Siguen **sin construir** y esperando su OK: A (precio en la ficha), C (informe de margen)
> y D (tramos por cantidad).

## De dónde se parte (medido el 02-10-2026 en las dos bases)

| | |
|---|---:|
| Productos con precio mayorista | 16 |
| Cuentas mayoristas (pedidas, aprobadas o rechazadas) | **0** |
| Ventas con alguna línea a precio mayorista (caja o web) | **0** |
| Pedido mínimo | $100.000 |

Todavía no hay ningún mayorista. Eso ordena la fase: primero lo que ayuda a conseguir y atender al
primero, y al final lo que necesita datos de ventas que hoy no existen.

## Paso 0 (no es código): cerrar lo que la Fase 1 dejó sin probar

Que el correo de aprobación llegue de verdad nunca se probó (en la maqueta el correo está apagado).
Propuesta: creas una cuenta en sevelin.cl con otro correo tuyo, pides ser mayorista y la apruebas desde
el POS. Con eso se ve el camino completo antes de que lo recorra un cliente.

## Las cuatro piezas, en el orden que recomiendo

### A. Precio mayorista en la ficha del producto — chico, solo tienda, sin migración

Hoy la cuenta aprobada ve sus precios en `/mayorista` y en el carrito, pero la ficha muestra solo el precio
normal. Se agrega un recuadro "Tu precio mayorista: $X desde N unidades".

- La ficha es una página pública guardada en caché: el precio mayorista **no puede ir en esa página**. Lo
  pide el navegador aparte, con la sesión, y el servidor responde solo si la cuenta está APROBADA.
- Prueba obligatoria: sin sesión, con sesión sin aprobar y con cuenta suspendida, la respuesta va vacía.
- El precio que se cobra sigue saliendo de la misma función de siempre (`resolverPreciosMayoristas`).

### B. Lista de precios en PDF — chico a mediano, solo tienda, sin migración

Botón "Descargar lista de precios" dentro de `/mayorista` (solo cuenta aprobada). El PDF lleva nombre y RUT
de la cuenta, fecha, pedido mínimo, "precios sujetos a stock" y la cantidad mínima de cada producto.

- **La decisión es tuya:** un PDF se puede reenviar, y tu regla es que los precios mayoristas los ve solo
  quien tú apruebas. Con el nombre de la cuenta estampado se sabe de quién salió, pero no se puede impedir
  que circule. Alternativa: que el PDF lo generes solo tú desde el POS y se lo mandes a quien quieras.
- Usa la misma librería del cotizador del carrito (ya está instalada).

### C. Informe del margen mayorista — chico a mediano, solo POS, sin migración

En Página Web → Mayoristas: unidades y plata vendidas a precio mayorista, margen real, y cuánto se dejó de
ganar frente al precio normal, por producto y por período. Los datos ya se guardan desde la Fase 1
(`venta_items.precio_tipo`).

- Hoy saldría vacío (0 ventas). Se puede construir y probar con datos simulados, pero no contra ventas reales.
- Por cliente no se puede todavía en las ventas de caja: la venta no guarda a qué cuenta mayorista se le vendió.

### D. Tramos por cantidad — grande, los dos repos y las dos bases

Varios precios por producto (por ejemplo 5 u. a $4.000 y 20 u. a $3.600) en vez de uno solo.

- Migración en el POS y en la tienda, cambio en lo que viaja por la sincronización, el piso de 20% por cada
  tramo, el editor del POS, la caja, el carrito y el checkout de la tienda, y el chequeo de Salud.
- Además hay que proponerte y que apruebes un precio por cada tramo de cada producto.
- **Recomiendo dejarlo para después de las primeras ventas mayoristas.** Hoy no hay ningún dato de cuántas
  unidades pide un mayorista, y de los 16 productos con precio mayorista solo 7 tienen 20 o más unidades
  en stock (el que más tiene, 29; la balanza Bluetooth está en 0): un segundo tramo de 20 o más unidades
  se podría surtir una sola vez por producto, o ninguna.

## Lo que propongo

1. **Fase 2a (una sesión, Opus · Alto):** Paso 0 + A + B.
2. **Fase 2b:** C, cuando haya al menos una venta mayorista real que mirar (o antes, sabiendo que saldrá vacío).
3. **Fase 2c:** D, postergado hasta tener 3 a 5 pedidos mayoristas.

## Lo que necesito que decidas

1. ¿Parto con la Fase 2a (A + B)?
2. El PDF: ¿lo descarga la cuenta aprobada con su nombre estampado, o lo generas solo tú desde el POS?
3. ¿De acuerdo en postergar los tramos por cantidad?
