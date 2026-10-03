# v108 a v110 — Máquina del Banco de Chile, N° de boleta, aviso de margen, precio sugerido y Encargos (03-10-2026)

Sesión en Opus · Extra. Pendientes trabajados: #51, #54 (piezas A y B), #53, #55, #58 y un pedido nuevo del dueño
(segunda máquina de tarjetas y N° de boleta o factura).

## Publicado

| Versión | Qué cambió | Commit | Migración |
|---|---|---|---|
| **v108** | La caja pregunta por cuál máquina pasa la tarjeta (TUU o Banco de Chile) y la comisión se calcula según la máquina. N° de boleta o factura, opcional, al vender o después. | `b96715c` | `sql/79` |
| **v109** | Aviso en la caja cuando una línea deja menos de 15% de margen. Precio sugerido en 990, con su mayorista, al escribir el costo de un producto. | `4cce938` | no |
| **v110** | Encargos sale de Servicio Técnico y pasa a ser un módulo del menú, con el proceso con el proveedor. | `c444f47` | `sql/80` |

## v108 · Máquina de tarjetas y N° de documento

- **Dos máquinas.** En "Confirmar Pago" hay un selector "Máquina de tarjetas": TUU o Banco de Chile. Se recuerda la
  última usada en ese equipo. Sirve también para el pago mixto, para cobrar una venta pendiente y para los abonos de un
  encargo.
- **Comisión, siempre en el servidor** (`calcularComisionPos(metodo, total, maquina)`):
  - TUU: 0,79% + $65 (sin cambios).
  - Banco de Chile (contrato Banchile Pagos del 16-09-2026): débito 0,6% + 0,0015 UF; crédito 1,53% + 0,0018 UF; **con
    IVA**, que es lo que descuentan del abono. UF de referencia $41.082 (03-10-2026), constante `UF_REFERENCIA_COMISION`
    en `api/index.js` y en `js/config.js`.
  - Ejemplo con $120.000 en débito: TUU $1.013, Banco de Chile $930. En crédito: TUU $1.013, Banco de Chile $2.273.
- **N° de boleta o factura** (`ventas.dte_folio`), siempre opcional:
  - En la ventana "Venta registrada", con Enter o "Guardar".
  - En Historial → botón "Sin N° de documento": lista de ventas pagadas desde el 03-10-2026 sin número.
  - En el Detalle de Venta, donde además el admin corrige la máquina de una venta ya cobrada (la comisión se recalcula).
  - Avisa si el mismo N° ya está en otra orden. El trabajador solo anota el de una venta de hoy que no lo tenga.
- El POS **no emite nada ni entra al SII**: guarda el número que ya existe.

## v109 · Aviso de margen y precio sugerido (pendiente #54, piezas A y B)

- **Caja (`POST /api/pos/margen-carrito`):**
  - El margen se calcula con el mayor costo conocido (sql/78), sobre el precio que queda después del descuento del carrito.
  - El admin ve el % y el precio mínimo; el trabajador ve solo "bajo el precio mínimo".
  - Al cobrar pide confirmar ("Volver y corregir" o "Cobrar igual"). Es un aviso: si el servidor no responde en 2,5 s, se
    cobra igual.
  - No se evalúan servicios, ítems escritos a mano, líneas a precio mayorista ni productos sin costo.
- **Editor de producto (`POST /api/productos/precio-sugerido`):**
  - Precio = costo ÷ (1 − margen objetivo), al siguiente 990. Tabla aprobada el 03-10: cables y adaptadores 45%, hogar
    40%, power banks 35%, PC reacondicionados 35%, componentes PC 25%, gabinetes 22%, fuentes 20%, monitores nuevos 15%.
  - Una categoría fuera de la tabla usa la mediana de sus productos (nunca bajo 15%); con menos de 3 productos con costo,
    no propone.
  - Mayorista: un tercio del margen con tope de 20%, nunca bajo el piso de 20%, desde 3, 5 o 10 unidades.
  - Solo propone: cada sugerencia tiene su botón "Usar".

## v110 · Encargos (pendiente #53)

- **Módulo "Encargos"** en el menú, para los dos roles. Servicio Técnico queda con Órdenes de Trabajo y Repuestos.
- **Etapas** de un encargo que hay que pedir: Cotizando → Confirmado → Pedido → Llegó → Entregado, más Cancelado. Un
  encargo sin nada que pedir (reserva de algo en stock, servicio con seña) no lleva etapa.
- **Qué se pide** lo calculan el formulario y el servidor: todo si el producto es por encargo o está agotado; solo lo que
  falta si hay stock. Se puede marcar o desmarcar a mano.
- **Al llegar:** aviso por WhatsApp con el mensaje armado, "Ya le avisé", y (admin) "Registrar la compra", que abre el
  producto con la compra escrita. **Nada sube el stock solo.**
- **Permisos:** los dos roles avanzan; volver atrás, cancelar y reabrir, solo el admin. Un encargo con abonos no se
  cancela (devolver esa plata todavía no tiene registro en el POS).
- **Aviso "N encargos en proceso"** en el encabezado; rojo si llegó y falta avisar, si lleva más de 2 días cotizándose o
  si ya pasó la fecha estimada.
- **Entradas nuevas:** "Iniciar encargo" en Productos → Agotados y "Faltan N: crear encargo" en la caja.
- **De paso:** el trabajador ya no recibe el costo de los encargos por la API (antes viajaba y solo se ocultaba en pantalla).

## Datos cargados (con OK del dueño)

- **#51:** Cyber de los 7 monitores de 19" a $34.990; ViewSonic 22" a $44.990; gabinete CG72 a $16.990; HP V214a a
  $49.990 y Samsung 22" VGA/DVI a $54.990 (liquidación). Mayorista de $37.000 desde 2 u. en el HP S1933 y el AOC
  E2070SWN. Quedan **31 ofertas** (24 productos y 7 servicios) y **18 precios mayoristas**, iguales en las dos bases.
- **#58:** "Claude Pro (Anthropic)" en Gastos Fijos, día 30, **$19.700 estimado** (US$20 al dólar del 02-10). Falta el
  monto real de la cartola.
- **#55:** tarea programada "Sevelin · auditoría semanal de precios", lunes 09:38. Solo lee la base.

## Pruebas

- Servidor, con un doble de Supabase en memoria: **154 comprobaciones, 0 fallas** (51 de v108, 49 de v109, 54 de v110).
- Pantallas, en la maqueta (`pos-maqueta`): cobro con las dos máquinas, N° de documento, aviso de margen, precio sugerido
  y Encargos, como admin y como trabajador, y a 375 px sin desborde.

## No probado

- Una venta real con la máquina del Banco de Chile, ni su liquidación (la UF del contrato es la del último día del mes).
- El precio sugerido con el árbol real de categorías (la maqueta tiene una lista corta).
- El WhatsApp del aviso de llegada desde un teléfono.
- La tarea programada: corre por primera vez el lunes 05-10.
- Las capturas del navegador salieron en blanco (panel oculto): se verificó leyendo el DOM.

## Trampas nuevas

- En Express, una ruta fija (`/api/ventas/sin-folio`, `/api/encargos/resumen`) va **antes** de la ruta con `:id`.
- `sanearEncargo` solo incluye los campos del proveedor que el formulario mandó: un navegador con el JavaScript viejo en
  caché no los borra al editar.
- La maqueta responde `/api/me` siempre como admin: los campos `admin-only` se ven aunque se entre como "trabajador".
- Si la tarifa de Banchile cambia, se cambia en `api/index.js` **y** en `js/config.js` (espejo para previsualizar).
