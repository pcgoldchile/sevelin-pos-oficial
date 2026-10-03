# v111 a v114 — Escalones mayoristas, clave del dueño en la caja, IA del editor y cambio de producto en una venta (03-10-2026)

Sesión en Opus · Extra. Pendientes trabajados: #48, #28, #54 y #60, más dos pedidos nuevos del dueño (cambiar el producto
de una venta y un mensaje en el pedido pagado de la tienda). El #49 (Cyber) no tocaba: era sábado 03-10.

## Publicado

| Versión | Qué cambió | Commit | Migración |
|---|---|---|---|
| **v111** | Segundo escalón del precio por mayor ("desde 3 u. un precio y desde 10 u. otro más bajo"). | POS `87a71b8`, tienda `e0a57b5` | `sql/81` + `supabase/40` |
| **v112** | El trabajador necesita la clave del dueño para cobrar bajo el precio mínimo. | POS `3f80bde` | no |
| **v113** | Complementos sugeridos por categoría, y la ficha con IA propone marca, categoría y condición. | POS `ae1bb68` | no |
| **v114** | Cambiar el producto de una venta ya registrada, al mismo precio. | POS `ac18890` | `sql/82` |
| tienda | Recuadro "Coordinemos tu entrega" en la página del pedido pagado. | tienda `6971741` | no |

Los cinco despliegues terminaron en verde y se revisaron en producción (archivos servidos, rutas nuevas con 401 sin sesión,
precios nuevos en sevelin.cl y el recuadro en el pedido WEB-000014).

## v111 · Segundo escalón mayorista (pendiente #28)

- **La regla.** `productos.precio_mayorista_2` y `mayorista_desde_2`, opcionales: más barato y desde más unidades que el
  primero, con el mismo piso de 20% de margen sobre el mayor costo conocido.
- **La base lo hace cumplir** (guardia de sql/76, reescrita en sql/81): si una compra sube el costo o el primer escalón
  cambia y el segundo deja de cumplir, se desactiva **solo el segundo** y queda el motivo en `mayorista_aviso`. Si cae el
  primero, se van los dos.
- **Servidor:** `validarPrecioMayorista` rechaza con mensaje (cantidad no mayor, precio no menor, bajo el piso). El aviso de
  margen de la caja reconoce el precio del escalón que toca a la cantidad. Salud compara el segundo escalón con la tienda.
- **POS:** dos campos en el editor con su resumen; en la caja, el precio de una línea mayorista sigue al escalón al sumar o
  restar unidades; el panel de Mayoristas y la columna de margen muestran los dos.
- **Tienda:** la regla sigue en un solo lugar (`lib/mayorista-precios.ts`: `precioMayoristaPara`). Carrito, checkout y
  cotizador cobran el escalón de la cantidad. Se ve en `/mayorista`, "Tu precio mayorista" de la ficha, la pista del
  carrito y la lista PDF/Excel. Solo cuenta aprobada; sin sesión no viaja nada.
- **Hoy no hay ningún segundo escalón cargado:** los 34 productos con precio por mayor tienen uno solo. Falta que el dueño
  diga a cuáles (Claude puede proponer la lista).

## v112 · Clave del dueño para cobrar bajo el mínimo (pendiente #54)

- **El freno vive en el servidor.** `POST /api/ventas` rechaza con 403 (`requiere_clave_margen`) la venta de un trabajador
  con una línea bajo 15% de margen (después del descuento) si no trae un permiso.
- **El permiso:** `POST /api/pos/autorizar-margen` comprueba el PIN de admin (mismo freno de intentos del login) y entrega
  un token firmado que vale 15 minutos y **solo para ese carrito** (huella de productos, cantidades, precios y descuento).
  No abre sesión de admin ni devuelve costos.
- **Caja:** al trabajador, la ventana "Precio bajo el mínimo" le pide "🔑 Clave del dueño" ("Autorizar y cobrar"). El admin
  sigue con "Cobrar igual". Si el aviso de fondo no alcanzó a llegar, la clave se pide al registrar la venta.
- Si la base no deja calcular el margen, la venta pasa: el freno no traba la caja.

## v113 · Complementos sugeridos e IA del editor (pendiente #54, piezas C y D)

- **C. Complementos sugeridos:** en "Complementa tu compra", lo que ya usan los demás productos de la misma categoría
  (primero los de su subcategoría), con cuántos lo usan. Sin IA ni servidor (`js/complementos.js`).
- **D. La IA propone marca, categoría y condición:** la ficha de un producto termina con un bloque `---DATOS---`. El
  servidor lo separa (`separarDatosDeFicha`) y valida las tres cosas antes de proponerlas:
  - la marca tiene que estar escrita en lo que entregó el dueño (nombre, datos pegados o descripción);
  - la categoría tiene que ser de `producto_categorias`, copiada tal cual ("Padre > Hija");
  - "reacondicionado" solo si el dueño lo dijo.
- Llegan como casillas en la ventana de la ficha, por los dos caminos (botón y copiar el prompt), y solo lo que cambia
  algo: marcadas si el campo está vacío, sin marcar si reemplazan un valor. Garantía, peso y medidas no se tocan.
- **Facebook:** el botón "📣 Generar publicación para Facebook" ya existía; no se cambió.

## v114 · Cambiar el producto de una venta (pedido nuevo)

La web vendió un Adaptador USB WiFi 6 que en la tienda no estaba (venta #250) y el dueño entregó otro al mismo precio.

- **Detalle de Venta → "🔁 Cambiar"** en cada producto (solo admin, `js/cambio-producto.js`). Se elige el producto que se
  entregó y se marca, obligatorio, si el original vuelve al stock o no (puede no haber existido: un descuadre de conteo).
- **`POST /api/ventas/:id/cambiar-producto`:** el precio, el subtotal y el total no cambian (no toca caja, comisión ni
  documento). Sale el producto nuevo del stock (por capas PEPS si las usa), la línea conserva su id y pasa a llevar nombre,
  SKU, costo, condición y garantía del nuevo, y el costo y la utilidad de la venta se ajustan por la diferencia.
- **Orden pensado para no dejar nada a medias** (no hay transacción): sin stock del nuevo no se toca nada; si la línea no se
  puede escribir, el stock vuelve; lo que falle después se avisa.
- **Registro:** `venta_cambios_producto` (sql/82, RLS activo, sin políticas). El detalle de la venta lo muestra.
- **No se cambia:** un servicio, una línea escrita a mano, un repuesto de taller, una línea con devolución ni una venta
  anulada. Con otro precio, es devolución y venta nueva.

## Tienda · Mensaje en el pedido pagado

Con el pago confirmado y antes de despacharlo (PAGADO o PREPARANDO), la página del pedido muestra "Coordinemos tu retiro"
o "Coordinemos tu entrega", con un botón de WhatsApp que ya lleva escrito el número de pedido y otro para llamar al mismo
número. No se agregó al correo de confirmación.

## Datos cargados (con OK del dueño)

- **#48 precios al público:** Hub USB-C $11.990, Adaptador HDMI a VGA $4.990, Antena TV $4.990, Transmisor FM $5.990,
  Control Mando USB $5.990, Adaptador WiFi 6 $8.990, Fuente MSI A650BN $59.990 y Fuente Clio $34.990.
- **#48 precio por mayor:** 16 productos nuevos (son 34); HDMI a VGA y Antena a $4.000 desde 5 u.; Transmisor FM a $4.800.
  Verificado: los 26 cambios calzaron con su valor anterior, iguales en las dos bases, 0 avisos de la guardia.
- **#60:** "Arriendo máquina Banco de Chile (Banchile Pagos)" en Gastos Fijos, $19.555 **estimado** (0,4 UF × $41.082 ×
  1,19), día 1 por confirmar.

## Hallazgos

- **La comisión de TUU lleva IVA aparte.** Su sitio dice "Valores no incluyen IVA". El POS anota 0,79% + $65 sin IVA: en
  $120.000 son $1.013 anotados contra $1.205 reales. **No se corrigió:** espera el OK del dueño (pendiente #60).
- **La máquina del Banco de Chile no se paga sola** con el volumen actual: ahorra 0,23% en débito frente a TUU (las dos con
  IVA) y su arriendo es de $19.555, así que necesita unos $8.000.000 al mes en débito. En crédito cuesta casi el doble.
- **Stock fantasma:** el POS dice 2 Adaptadores WiFi 6 y el dueño dice que no tiene; sevelin.cl los sigue vendiendo
  (pendiente #61).

## Pruebas

- Servidor, con un doble de Supabase en memoria: **106 comprobaciones, 0 fallas** (17 de v111, 25 de v112, 20 de v113 y 44
  de v114). Regla de cobro de la tienda: 18 comprobaciones (`scripts/probar-escalones-mayorista.mts`).
- La guardia de sql/81, en la base real, con un bloque que termina en error a propósito (no deja nada escrito): 5 casos.
- Pantallas en las maquetas: caja, editor y panel de Mayoristas con dos escalones; la clave como trabajador; complementos
  sugeridos y casillas de la IA; el cambio de producto; y en la tienda, `/mayorista`, la ficha, el carrito, el precio que
  cobra el checkout (sin crear pedido) y la página del pedido en sus estados y a 375 px.

## No probado

- La ficha con Gemini de verdad: si el modelo no manda el bloque `---DATOS---`, la ficha sale igual, sin sugerencias.
- El cambio de producto sobre una venta real (la #250 la cambia el dueño cuando cree el producto).
- Un pedido mayorista real con segundo escalón (no hay cuentas aprobadas ni escalones cargados).
- La lista PDF con el segundo escalón: se generó, pero no se pudo abrir para mirarla (falta el visor en este PC).
- Las capturas del navegador salieron en blanco (panel oculto): se verificó leyendo el DOM.

## Trampas nuevas

- **Un heredoc de Bash borra las barras invertidas** (`/\D/g` quedó `/D/g` en un archivo de la tienda; se vio en la revisión).
  Para editar con expresiones regulares: la herramienta de edición o un script escrito a archivo.
- **`sinTildes()` ya existe en `api/index.js`** (junto al precio sugerido). No redeclararla.
- **El orden de las migraciones del escalón:** primero `supabase/40` (tienda), después el código de la tienda, y recién
  entonces `sql/81`. Al revés, las lecturas de `precios_mayoristas` fallan y todo cae a precio normal.
- **`venta_cambios_producto.venta_item_id` no tiene llave foránea** a propósito: "Editar venta" reemplaza las líneas y les
  da ids nuevos.
- **La maqueta del POS responde 200 a rutas que no conoce:** al probar una ruta nueva hay que reiniciarla, o parece que el
  botón "no hace nada".
