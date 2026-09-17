# v67 — El POS detecta solo cuándo repusiste

**Fecha:** 17-09-2026
**Migración:** `sql/57`
**Pedido por:** el dueño, al ver la v66: *"¿cómo es que funciona esto? al crear un producto, o cómo así? para hacerlo de forma automatizada"*.

---

## El problema que resuelve

El informe de "Compras y devoluciones" (v66, `sql/56`) **solo ve lo que se carga a mano**. Si compras
50 ventiladores y no los registras, para el informe no existen.

Y eso no es un problema de comodidad, es un problema de confianza: **un informe incompleto es peor
que ninguno**. El panel —y cualquier IA que lo lea— va a hablar con toda seguridad de las 3 compras
cargadas e ignorar las otras 37. Es exactamente el error que ya costó caro en la sesión del
07/08-09-2026 con el margen inflado por ítems sin costo.

## Lo que se puede automatizar y lo que no

| El POS **sí** sabe solo | El POS **no puede** saber |
|---|---|
| Cuándo subió el stock y cuánto subió | Hasta cuándo el proveedor recibe la devolución |
| El costo unitario cargado del producto | Si esta compra tuvo un costo distinto al anterior |
| A quién le compró la vez pasada | A quién le compró **esta** vez |

Por eso se automatiza la **detección**, nunca el plazo. Ese dato solo está en la factura o en la
cabeza del dueño, y **inventarlo sería peor que no tenerlo**: una fecha de devolución falsa hace
perder plata de verdad.

---

## Cómo funciona ahora

1. Subes el stock de un producto (de 0 a 20, por ejemplo).
2. El POS arma solo un **borrador**: fecha de hoy, 20 unidades, el costo cargado, y guarda de cuánto
   a cuánto subió como evidencia.
3. Aparece el botón **📥 Compras (N)** en el header, junto al del F29 y el de agotados.
4. En el modal revisas lo que el POS supuso —todo editable— y pones **hasta cuándo se puede
   devolver**. Si le compraste al mismo proveedor de la vez pasada, ese campo viene sugerido, y el
   plazo viene propuesto con **la misma cantidad de días que duró la ventana anterior**.
5. **Confirmar compra** → recién ahí entra al informe.
6. **No fue una compra** → se descarta el aviso. No toca el stock.

### Un borrador NO cuenta en el informe

`GET /api/pos/rotacion-compras` filtra `estado = 'confirmado'`. Un borrador todavía no tiene costo
revisado ni plazo de devolución: contarlo sería analizar con datos supuestos, que es justo lo que se
quiere evitar.

### "No fue una compra" existe por una razón

El stock también sube por cosas que no son compras (un ajuste de inventario a mano, por ejemplo).
Sin esa salida, la única forma de sacarse el aviso de encima sería inventar un costo — y eso
ensuciaría el informe justamente donde más duele.

---

## Qué dispara un borrador y qué NO

**Sí** (los tres caminos donde el stock sube porque compraste):

| Camino | `origen` |
|---|---|
| `PUT /api/productos/:id` con el stock más alto que antes | `reposicion` |
| `POST /api/productos` con stock inicial > 0 | `alta` |
| `POST /api/productos/:id/lotes` (capa PEPS) — ahí el costo ya es el real | `lote` |

**No** (decisión explícita, no es un olvido):

- **Anular una venta.** Devuelve stock, no es una compra.
- **Corregir las líneas de una venta ya hecha.** Es un ajuste.
- **La importación masiva por CSV.** 100 productos darían 100 borradores de golpe y el aviso se
  volvería ruido que se ignora. *Queda pendiente decidir si se quiere con un resumen agrupado.*
- **Productos de stock ilimitado** (servicios, rollos térmicos). No tiene sentido.

---

## Migración

`sql/57-ingresos-borrador.sql` — agrega a `ingresos_mercaderia`: `estado` (con DEFAULT
`'confirmado'`, así todo lo cargado a mano sigue valiendo tal cual), `origen`, `stock_antes`,
`stock_despues`, y un índice parcial para los borradores (el aviso del header pregunta por esto en
cada sondeo). Idempotente. **Ya aplicada y verificada en producción.**

---

## Qué se probó

- **32 comprobaciones de backend** con el doble en memoria de Supabase (Express real levantado con
  `app.listen(0)`): que detecte la subida de stock; que **no invente nada** cuando el stock baja,
  queda igual o el producto es de stock ilimitado; que el borrador **no entre al informe** hasta
  confirmarse; que confirmar guarde el costo **corregido por el dueño** y no el supuesto; que
  confirmar dos veces se rechace con 409; que la segunda reposición sugiera proveedor y plazo de la
  primera; que descartar **no toque el stock**; y las validaciones (cantidad 0, producto inexistente).
- **23 comprobaciones de frontend** en jsdom: el botón y su conteo, los campos precargados, que **sin
  compra anterior no se invente un plazo**, el escapado del nombre del producto, y que el contador
  baje y el modal se cierre solo al terminar.
- **10 de regresión de v66** (los números de rotación y el flujo de agotados) más el humo de los 35
  `js/*.js` cargados juntos en el orden del `index.html`.

### Un bug del arnés de pruebas que vale anotar

El doble de Supabase devolvía **referencias** a las filas en vez de copias. Eso hacía que un
`const antes = await db.from('productos').select(...)` seguido de un `update` mostrara el valor de
**después**: la comprobación "¿subió el stock?" daba siempre 0 y la prueba fallaba con el código
correcto. Supabase devuelve copias. El doble ahora también.

## Lo que no se pudo probar

Lo visual (no hay navegador en el entorno de dev, ver CLAUDE.md): cómo se ven los cuatro botones del
header juntos cuando coinciden, y cómo cae la rejilla de campos del modal en el teléfono.

---

## Lo que sigue (propuesto, sin construir)

- **Pieza 2 — alarma de plazo por vencer:** cron diario (ya existe la infraestructura, el robot del
  SII corre así desde v64) y un botón en el header con color que sube según urgencia, igual que el
  del F29. **El dueño decidió que el aviso se queda dentro del POS**, sin correo al teléfono — eso
  obligaría a tocar `sevelin-tienda`, que es el que manda los correos.
- **Pieza 3 — revisión semanal con IA:** sección "Compras y devoluciones" en el informe semanal
  (v57) redactada por Gemini, que ya está integrado. Y/o un cowork "Sevelin Inventario" para
  preguntarle en lenguaje natural. **Conviene esperar** a tener 10 o 15 compras confirmadas: antes de
  eso daría respuestas con cara de seguridad sobre casi nada.
