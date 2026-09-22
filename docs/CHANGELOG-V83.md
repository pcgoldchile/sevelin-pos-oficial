# v83 — Devoluciones, Etapa 3: el panel de Finanzas

**Fecha:** 22-09-2026
**Migración:** `sql/62-nota-credito-emitida.sql`
**Pedido por:** el dueño, al aprobar la Etapa 2: *"Sigue con la etapa 3."*

Cierra la propuesta de tres etapas que salió de *"Me falta una opción en el POS para aplicar
devoluciones y registrar o anular ventas"*.

---

## Lo que hacía falta antes de poder armar el panel

La v81 dejó el aviso *"esta devolución necesita Nota de Crédito"* y el filtro
`solo_nota_credito=true`. Pero **no había forma de decir "ya la emití"**.

Una lista que no se puede cerrar se ignora, y una lista ignorada es peor que no tenerla: da la
sensación de estar controlado sin estarlo. Al tercer mes habría tenido 20 devoluciones viejas
mezcladas con la única que sí falta.

Por eso `sql/62` agrega `nota_credito_emitida_en` y `nota_credito_folio`. El folio es **opcional a
propósito**: obligarlo haría que el dueño no marque nada para no ir a buscar el número. Y
`solo_nota_credito=true` ahora significa **las que faltan**, no "las que alguna vez la necesitaron".

**El POS sigue sin entrar al SII.** Marcar la Nota de Crédito es anotar que él ya la emitió, nada más.

---

## El panel: Finanzas → ↩️ Devoluciones

Responde tres preguntas que no se contestan con un solo total:

| Pregunta | Dato |
|---|---|
| ¿Cuánta plata se fue? | Mercadería devuelta, y cuánto salió realmente del cajón |
| ¿Cuánto se perdió de verdad? | Las mermas de lo que volvió roto, **a costo** |
| ¿Por qué está pasando? | Motivos y productos más devueltos |

La tercera es la única que sirve para **decidir**: si un mismo producto aparece arriba tres meses
seguidos, el problema no es la devolución — es el producto o el proveedor.

### La tasa importa más que el monto

$200.000 devueltos sobre $8.000.000 vendidos es normal. Sobre $600.000 es una alarma. Por eso el
panel muestra siempre el porcentaje junto al monto.

**Y el denominador tiene una trampa que costó un test.** Una devolución parcial **rebaja**
`ventas.total`. Sumar los totales tal cual daría una tasa inflada justo cuando hay más devoluciones:
vender $320.000 y devolver $100.000 daría 100/220 = **45%** en vez del 100/320 = **31%** real.

El resumen le devuelve a cada venta lo que se le rebajó, incluidas las devoluciones de **otro
período** — si no, un mes viejo quedaría corto al devolver algo de él meses después. Las anuladas no
necesitan ajuste: su total nunca se tocó.

### Detalle del período

Una fila por devolución: fecha, venta (con su chip ANULADA o PARCIAL y el cliente), qué volvió — con
un chip rojo **"rota"** en lo que se dio de baja —, motivo con la observación escrita, medio por el
que se devolvió, monto y el estado de la Nota de Crédito.

Tres estados para la NC, y solo uno pide acción: *No necesita* (la venta no emitió documento),
*Emitida* (con su folio y un "deshacer"), o el botón **Marcar emitida**.

El filtro "Solo las que esperan Nota de Crédito" **no vuelve a pedir datos**: el resumen ya trae todo
el período.

---

## Una aclaración sobre el F29

El ajuste del débito de la v81 —que un mes ya declarado no encoja hacia atrás— **no depende** de que
la Nota de Crédito esté emitida. Son dos cosas distintas:

- el ajuste es de **períodos**: la reversa pertenece al mes en que se emite la NC, no al de la venta;
- la lista de pendientes es de **acciones**: lo que falta hacer en el SII para que la realidad calce
  con lo que muestra el POS.

Dicho de otro modo: el POS muestra lo que **debería** declarar, y la lista le dice lo que le falta
hacer para que así sea.

---

## Probado

- **122 comprobaciones de backend** (33 nuevas): totales del resumen, la tasa con su denominador
  corregido, que una venta ANULADA siga contando en lo vendido, la pérdida de las mermas, las
  agrupaciones por motivo y por producto, marcar y desmarcar la Nota de Crédito con su folio
  recortado, el rechazo de una venta SIN DTE y de un id inexistente, rango inválido, período vacío, y
  que el panel sea solo para el administrador.
- **100 comprobaciones de interfaz** (39 nuevas, jsdom): que existan la sub-pestaña y los once
  elementos del panel, cada KPI con su número, la traducción de los motivos, el escapado del nombre
  del producto, las filas del detalle con sus chips, el clic que marca la NC con el folio, y el
  filtro de pendientes sin volver a llamar al servidor.
- **Navegador real** (Browser pane): el panel completo con sus KPIs, las dos tablas de agrupación y
  el detalle.
- Chequeos del proyecto: `node --check`, funciones globales duplicadas, `const/let` globales
  duplicados e `id` duplicados — los cuatro vacíos. Sin clases nuevas de Tailwind.

### Dos cosas que aparecieron al probar

- **La tasa estaba inflada** por el denominador rebajado. Lo encontró el test, no la lectura del
  código: el número "se veía razonable".
- `aplicarRangoDevoluciones()` no devolvía su promesa, así que no se podía esperar desde afuera.
  Ahora la devuelve; quien la llama al cambiar de sub-pestaña sigue sin esperarla, y está bien así.
- Al verificar en el navegador, el camino real (clic en la sub-pestaña) parecía no cargar. Era la
  **caché del navegador** sirviendo un `balance.js` viejo: confirmado trayendo el archivo fresco y
  reevaluándolo. El servidor siempre sirvió la versión correcta.

---

## Con esto se cierra la propuesta

- **v81 (Etapa 1)** — la venta ya no se borra, se anula. Devolución total y parcial, PEPS al revés,
  egreso de caja automático, aviso de Nota de Crédito.
- **v82 (Etapa 2)** — merma automática de lo que no vuelve, garantía preseleccionada, aviso de
  devoluciones en efectivo fuera de caja.
- **v83 (Etapa 3)** — el panel de Finanzas y el cierre del ciclo de la Nota de Crédito.
