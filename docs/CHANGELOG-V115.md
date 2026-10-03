# v115 — La comisión de TUU con IVA, correcciones con OK del dueño y dos investigaciones (03-10-2026, noche)

Sesión en Opus · Extra. Pendientes trabajados: #60, #61, #58 y #28, más dos preguntas del dueño (por qué "sevelin" no
muestra sus productos en Google Shopping, y cuánto pagan Caja Vecina, Loto y los puntos de retiro).

## Publicado

| Versión | Qué cambió | Commit | Migración |
|---|---|---|---|
| **v115** | La comisión de TUU se guarda con IVA, de aquí en adelante. | POS `108a386` | no |

Verificado en producción: `js/config.js` servido trae `IVA_COMISION`.

## v115 · Comisión de TUU con IVA (pendiente #60)

- **El problema.** TUU publica 0,79% + $65 "sin IVA" y descuenta la comisión más su IVA. En una venta de $120.000 el POS
  anotaba $1.013 y TUU descuenta $1.205.
- **El cambio.** `calcularComisionPos` (servidor y espejo de `js/config.js`) multiplica por `IVA_COMISION = 1.19` también
  en TUU. La máquina del Banco de Chile ya lo hacía y no cambia ($930 en $120.000 con débito).
- **Decisión del dueño: solo de aquí en adelante.** Las ventas ya anotadas conservan los pesos guardados en
  `ventas.comision_pos`. Las 8 ventas con tarjeta de agosto que tienen la comisión guardada en 0 se siguen mostrando en
  el Historial con la fórmula de entonces, sin IVA (`comisionDeVenta` de `js/config.js`).
- ⚠️ Editar el total o el medio de pago de una venta antigua con tarjeta sí recalcula su comisión con la fórmula nueva
  (`PUT /api/ventas/:id` ya lo hacía con la tarifa vigente).
- El dueño escribió "(recuerda no llevan iva las comisiones)". Se entendió como "la tarifa publicada no trae el IVA
  incluido", que es lo que calza con su "sí". Si quiso decir otra cosa, se revierte cambiando una constante.
- **Probado:** 30 comprobaciones sobre el código real (el bloque del servidor y `js/config.js` evaluados con `vm`): TUU,
  Banco de Chile, pago mixto, venta en $0, ventas ya guardadas y las de agosto. En la maqueta, la ventana de cobro muestra
  TUU $124 y Banco de Chile $109 en una venta de $5.000. No se probó contra el endpoint `POST /api/ventas` con una base
  doble: el cambio es una línea de la fórmula.

## Datos corregidos con OK del dueño (base real)

- **#60:** las órdenes #235 (26-09, $120.000) y #249 (03-10, $119.990) quedaron cobradas con la máquina del Banco de
  Chile: `maquina_tarjeta = 'BANCHILE'` y comisión $930 cada una (antes $1.013).
- **#58:** Claude Pro en Gastos Fijos pasó de $19.700 (estimado) a **$20.207**, el cargo real de su cartola.
- **#61:** el Adaptador USB WiFi 6 seguía en stock 2 y el dueño no tiene ninguno: quedó en **0** en el POS y en la tienda
  (`stock_web = 0`, sincronizado a las 21:02 UTC). La venta #250 sigue con el producto original: falta que él lo cambie.
- **#60 (arriendo):** el Banco de Chile todavía no le cobra el arriendo de la máquina. El gasto fijo sigue en $19.555
  estimado hasta que consulte.

## Propuesta que espera OK (pendiente #28)

`docs/estudios-precios/2026-10-03-segundo-escalon-mayorista.md`: segundo precio por mayor para 15 de los 34 productos
(el doble de unidades, cerca de 7% más bajo, ninguno bajo 23% de margen). Los otros 19 no tienen stock para una compra
de ese tamaño o no tienen espacio sobre el piso de 20%.

## Google Shopping: por qué "sevelin" no muestra los productos

Revisado en Merchant Center (cuenta 5836999734) y en Google Shopping desde el Chrome del dueño.

- **No hay nada roto.** 158 productos, los 158 aprobados, 0 rechazados. 104 clics en 28 días (el doble del período
  anterior). Calidad de la tienda: aceptable; plazo de devolución: bueno.
- **Los productos sí aparecen cuando se busca un producto.** "monitor 19 reacondicionado" muestra 5 monitores de
  Sevelin; "transmisor fm bluetooth auto carg7" muestra el de Sevelin.
- **Google Shopping busca productos, no tiendas.** Con "sevelin" entiende "selenio" y muestra suplementos.
- **Tecno Más aparece con su nombre porque paga:** la fila de la captura dice "Productos Patrocinados". Sevelin tiene
  0 campañas y $0 de gasto en anuncios.
- Quien busca "sevelin" en el Google normal sí encuentra la ficha del negocio y sevelin.cl. La ficha tiene 408 vistas al
  mes y la última foto se subió hace 242 días.
- ⚠️ Google mostraba el Transmisor FM a $4.990 y el POS lo tiene en $5.990 (subió el 03-10): Google relee el catálogo
  una vez al día, así que un precio nuevo tarda hasta 24 horas en verse.
- La nota "1,0 (1)" que sale en el Monitor HP S1933 es una opinión del producto que junta Google, no de Sevelin.

## Caja Vecina, Loto y puntos de retiro: cuánto pagan

Ninguno publica su tarifa. Lo que sí se pudo medir o leer en fuentes oficiales:

- **Caja Vecina:** pagó $20.604 millones a sus comercios entre enero y septiembre de 2024 (estados financieros, nota 19).
  Con 40.000 puntos y más de 460 millones de transacciones al año, da cerca de **$60 por transacción** y unos **$57.000
  al mes por local** en promedio (cálculo de Claude con esas cifras, no una tarifa oficial).
- **Loto y Kino:** la comisión por venta es un acuerdo comercial que no se publica. La ley da al agente el 2% de los
  premios mayores. Esas comisiones están exentas de IVA (SII, Ord. 330 de 2013).
- **Punto Blue Express:** "gana comisión", sin costo y sin manejar plata; el monto no está publicado. Se postula en
  blue.cl/hazte-punto-blue.
- **Chilexpress:** está convirtiendo sus puntos en sucursales con Western Union (La Tercera, 04-11-2024): vuelve el
  manejo de efectivo. Monto no publicado.
- **Agencia de Mercado Libre:** la empresa dijo en 2022 que cada comercio gana en promedio **$200.000 más al mes**. Pide
  empresa con facturación, 8 horas de lunes a viernes, espacio seguro, una persona disponible e internet.

Fuentes: estados financieros de CajaVecina a septiembre de 2024 (CMF), The Clinic 29-12-2023, Chócale 11-2022 y
05-2024, La Tercera 04-11-2024, blue.cl, SII Ord. 330 (2013), Ley 18.851.

## Trampas nuevas

- La comisión de TUU guardada en ventas anteriores al 03-10-2026 está sin IVA: al comparar meses, las de antes pesan 19%
  menos por la misma venta.
- `productos.stock_actualizado_en` lo pone la API, no un trigger: un ajuste de stock por SQL tiene que fijarlo a mano
  (es el "agotado desde" de Productos → Agotados).
- La pregunta de un precio se confirma con la lista concreta a la vista: "pon un segundo precio" no reemplaza el OK a
  los números.
