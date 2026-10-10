# v132 — IVA real en Utilidades, informe de compras, editar y eliminar lo por llegar, Mercado Pago (10-10-2026)

Sesión del sábado 10-10-2026 (Opus · Extra). El dueño respondió sus pendientes y, a mitad de la sesión, pidió dos cosas
más con pantallazos: un medio de pago "Mercado Pago" y "Otro" en los gastos, y poder editar o eliminar una compra por
llegar (el soplador #242 quedó cargado dos veces).

## Qué cambió en el POS

- **Finanzas → Utilidades usa el IVA real del SII (#76, commit `a398d23`).** Antes restaba "débito del POS − crédito de
  las compras marcadas con factura", y ninguna compra del POS está marcada así: restaba el IVA de todas las boletas
  (septiembre: $226.882 que nunca se pagaron). `ivaRealDelRango()` calcula mes por mes: un mes con su F29 a favor paga
  $0; si no, `calcularIvaMes` (crédito de facturas + remanente − débito). Un rango parcial se lleva la parte que le toca
  según sus boletas. Sin datos del SII ni F29, el informe sigue con la cuenta del POS y la pantalla lo dice
  (`iva.fuente`: `sii` o `pos`). El débito y el crédito que se muestran son de los meses completos.
- **Informe de compras por marketplace, vendedor y marca (#80).** `GET /api/finanzas/compras-informe` y
  `js/informe-compras.js`: una ventana con botón "🛒 Compras por origen" en Finanzas → Gastos y en Productos. Suma las
  compras confirmadas de `ingresos_mercaderia` (llegadas y por llegar), con período. Avisa las compras sin costo y las
  fechas imposibles.
- **Por llegar: "✏️ Editar" y "🗑️ Eliminar", solo admin.** `PUT /api/ingresos/:id/por-llegar` corrige unidades, costo,
  vendedor, marketplace y fechas; mueve `stock_por_llegar` en la misma diferencia y no deja bajar de lo ya pagado en la
  web. `DELETE /api/ingresos/:id` ahora ajusta el producto cuando la compra estaba por llegar (antes borraba la fila y
  la tienda seguía ofreciendo las unidades) y **se bloquea** si hay reservas pagadas o clientes en lista de espera.
- **Gastos: medio de pago "Mercado Pago" y "Otro" con texto libre.** El servidor ya guardaba el medio como texto y solo
  "Efectivo" sale del cajón, así que no hubo migración. De paso: al editar un gasto el campo banco no se cargaba y se
  guardaba el banco del último gasto abierto.

## Qué cambió en la tienda

- **Dirección nueva (#5, commit `c36b683`):** `DIRECCION_TIENDA` = "San Rafael 896, Arica, entrada por calle Robinson
  Rojas". Es el único lugar donde vive la dirección (checkout, correos, aviso "listo para retiro", QR de retiro).
- **Enlaces (#78, commit `7c292d1`):** el enlace viejo de un producto renombrado redirige (308) al nuevo, usando el
  número del final (`skuVigenteDeEnlaceViejo`). El dueño quiere que el enlace siga al nombre: ahora puede renombrar.

## Datos (con OK del dueño)

- Monitores de 19" reacondicionados (#230, #233 a #238): precio normal de $44.990 a $34.990. No se vendió ninguno en
  el Cyber. Se quitó el mayorista de $37.000 de #234 y #235 (quedaba sobre el precio normal).
- RAM ADATA #317 a $69.990. Categoría principal "Celulares y Smartphones" con el Moto E15 (#337).
- Compras antiguas "VENDEDOR / MERCADOLIBRE" separadas (ingresos #20, #21, #24) y marketplace puesto en las que decían
  solo MercadoLibre.
- Soplador #242: eliminada la compra repetida (#39); queda la #40, ligada al gasto #33.
- Servicio #339 publicado con su imagen (`scripts/generar-imagenes-servicios.js`).

## Cómo se probó

- **Servidor, doble de Supabase con datos reales:** IVA de Utilidades 18 casos (septiembre $0 contra $226.882 del POS,
  agosto con F29 a favor, octubre en curso, mes que sí paga partido en dos mitades que suman el mes). Compras: 33 casos
  (total igual a la suma de las compras, el trabajador recibe 403, eliminar el duplicado, los dos bloqueos, editar con
  reservas, fechas inválidas).
- **Maqueta del POS:** bloque de IVA, informe con sus tres vistas, Editar y Eliminar en Por llegar (el trabajador no ve
  los botones), y el formulario de gasto con Mercado Pago y Otro.
- **Maqueta de la tienda:** enlace vigente 200, nombre viejo 308, ajeno y sin dueño 404.
- **Producción:** `sevelin.cl/api/cotizar-envio` devuelve la dirección nueva; `/productos/nombre-antiguo-339` redirige;
  la ficha del servicio #339 responde 200 con imagen; el POS desplegado trae los archivos nuevos.

## Lo que no se probó o quedó a medias

- **`TIENDA_LAT` y `TIENDA_LON` siguen en Vercel** apuntando al local de Linderos (la sesión no tuvo permiso para
  quitarlas): el despacho en Arica se sigue midiendo desde el local viejo, unos 650 m. Pendiente #83.
- El informe de compras solo ve lo cargado con el stock: las compras anteriores al 04-10-2026 están como gasto. Suma
  $1.647.916 en 31 compras contra $2.020.770 de gastos de mercadería.
- Un correo real con la dirección nueva, y los PDF/Excel de Utilidades con el IVA nuevo (solo se revisó el código).
- Merchant Center sigue viendo un producto renombrado como uno nuevo: la redirección es solo para personas y Google.

## Trampas

- `producto_categorias.nombre` es único en toda la tabla: "Celulares" ya era una subcategoría de Servicios Técnicos.
- `stock_por_llegar` se **pisa**, no se suma, al registrar una segunda compra por llegar del mismo producto. Por eso el
  soplador repetido decía 5 y no 10.
- Apagar `por_llegar` hace que la tienda mande el correo "ya llegó". Cualquier ruta nueva que lo apague tiene que
  revisar antes `avisos_producto` (estado `PENDIENTE`) y `reservado_web`.
- Un heredoc de Bash volvió a comerse una barra invertida (`/\s+/` quedó `/s+/`): los parches con expresiones
  regulares se escriben con la herramienta de archivos.
