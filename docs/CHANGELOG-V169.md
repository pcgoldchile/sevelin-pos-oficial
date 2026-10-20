# v169 — Cuadrar con el SII: cada boleta y factura del RCV contra las ventas y los gastos del POS (20-10-2026)

Pedido del dueño: *"ojalá que cuadrar con el SII me permita registrar las compras y ventas, y queden como pendientes que
fueron esas compras y ventas, para yo rellenarlas, y que me salgan en notis también para llevar un registro completo de
qué pasó"*. Venía de cruzar a mano el RCV de ventas de septiembre: 38 boletas, ninguna con su N° anotado en el POS, y 16
($955.000) sin venta, entre ellas una RTX 5060 de $440.000 que nunca se subió.

## Qué hace

- **Finanzas → 🧾 Cuadrar con el SII**, por mes:
  - **"Calzan por monto y fecha"**: propuestas con casilla. Las *seguras* vienen marcadas; las de *revisar* tienen otra
    del mismo monto cerca. **"Confirmar las marcadas"** le anota a la venta su N° de boleta (y la marca con boleta, con
    registro en `auditoria_dte`), liga la factura a su gasto o la deja anulada por su nota de crédito. El servidor
    recalcula la propuesta al confirmar: si algo cambió, la omite.
  - **Boletas que no están en el POS** → "🛒 Registrar la venta": abre la caja con la fecha de la boleta y un aviso;
    agrega lo vendido y cobra como siempre. La venta **no entra en la caja de hoy** (`caja_id` vacío, así el arqueo no
    espera esa plata), la ventana "Venta registrada" ya trae el N° de boleta y la boleta queda asociada sola.
    También "🔗 Es de otra venta" (elige o escribe el N° de orden) y "No corresponde" (con nota).
  - **Facturas sin su gasto** → "💸 Crear el gasto", de una o de varias del mismo proveedor y día ("Un solo gasto con las
    marcadas"): proveedor, total, IVA crédito, fecha y folios ya puestos (`origen = 'SII'`).
  - **Gastos sin la factura marcada** → "🧾 Marcar la factura" con el IVA de sus facturas.
  - Plegados: ventas marcadas con boleta que el SII no tiene ("Fue sin boleta"), comisiones de las máquinas (facturado
    contra lo que calculó el POS), ya cuadradas y no corresponden, todas con "Deshacer".
  - **"📤 Subir boletas (CSV)"**: el CSV de VENTAS del RCV. Rechaza el de compras y el de otro mes.
- **Chip "🧾 SII: N por cuadrar"** en el encabezado (solo admin, cada 30 min): lo pendiente de los últimos 3 meses, y
  avisa si faltan las boletas del mes cerrado. Entra por el menú, así pasa por la clave de Finanzas.
- **El robot del RCV** (cron diario) ahora también intenta bajar el detalle de las boletas de venta
  (`getDetalleVentaExport`) y, al terminar, hace la parte automática del cuadre.

## Reglas (decididas en esta versión)

- **Solo se asocia sin clic lo que no cambia nada del POS:** la boleta cuyo N° el dueño ya anotó en la venta, y las
  facturas de las máquinas y pasarelas de pago (TUU es Haulmer, Banchile, Khipu, Flow, Transbank…), que quedan como
  `comision`. Esas no se cargan como gasto porque el POS ya descuenta la comisión venta por venta: crearlas como gasto
  operativo la restaría dos veces de la utilidad neta. Su IVA sí es crédito y ya está en el RCV.
- **El cruce de ventas** (`cuadreProponer`): mismo monto (o monto + despacho cobrado), la venta hasta 3 días antes o 1
  después de la boleta. Puntaje: mismo día y venta marcada con boleta primero. Dos boletas o ventas "gemelas" (mismo
  día y monto) no restan confianza: intercambiarlas no cambia nada.
- **El cruce de compras:** un gasto puede juntar varias facturas (por eso `compra_id` no es único). Tolerancia de
  $10 o 0,1 % (los gastos se escriben a mano: $280.940 por una factura de $280.942), ±10 días. Factura con nota de
  crédito del mismo proveedor y monto en 45 días = anulada.
- **El último "Reajuste" del saldo** (`ajustes_saldo`, el último fue el 12-09-2026) manda: un gasto de antes de esa fecha
  se propone *sin* descontar del saldo (ya quedó dentro del reajuste); una venta atrasada de antes de esa fecha avisa
  que el saldo de Finanzas va a quedar más alto que lo real y hay que corregirlo con un Reajuste.

## Probado con septiembre real

Con los datos reales copiados a memoria (sin tocar la base): de las 38 boletas, **16 seguras y 6 para revisar**; las
otras 16 sin una venta clara (12 sin ninguna venta de ese monto esos días), entre ellas la RTX de $440.000 y la de
$170.000. De las facturas: 3 de Computación e Ingeniería = el gasto de $499.950 del 13-08, SIPO $280.942 = gasto de
$280.940, Qiangsheng $602.396 = gasto del 06-10, 3 anuladas por nota de crédito y 8 comisiones (Haulmer, Banchile,
Khipu). Las otras 56 facturas de agosto a octubre no tienen gasto en Finanzas: es lo que el dueño tiene que crear o
descartar.

- `scripts/prueba-cuadre-sii.js`: 42 pruebas del servidor real con el doble de Supabase (CSV, mes equivocado, sin
  duplicar, propuestas, gemelas, grupo de 3 facturas, NC, comisiones, confirmar dos veces, asociar con monto distinto,
  ignorar sin nota 400, crear gasto de dos proveedores 400, marcar factura, aviso, trabajador 403).
- El doble ahora respeta claves compuestas en `upsert` y valores por defecto (`base.__defaults`).
- Maqueta (`pos-maqueta`): panel, ventana de gasto, aviso de la caja, cobro por `confirmarVenta` real (fecha 17-09,
  `caja_id` vacío, N° en la ventana de éxito, boleta asociada), una venta normal sigue en la caja de hoy, confirmar, y
  la vista en 390 px.

**No probado:** si el SII entrega las boletas por `getDetalleVentaExport` (se ve en el próximo cron; si falla queda
como aviso y se sube el CSV a mano).

`sql/108-cuadre-sii.sql` (aplicada): `cuadre_estado` (pendiente / asociado / ignorado / comision), `venta_id` (única),
`compra_id`, `cuadre_nota`, `cuadrado_en`, `cuadrado_por`. Endpoints (admin): `GET /api/finanzas/sii/cuadre`,
`GET …/cuadre-aviso`, `POST …/cuadre/ventas-csv`, `…/cuadre/confirmar`, `…/cuadre/crear-gasto`, `…/cuadre/:id/asociar`,
`…/:id/ignorar`, `…/:id/reabrir`, `…/:id/marcar-factura`.
