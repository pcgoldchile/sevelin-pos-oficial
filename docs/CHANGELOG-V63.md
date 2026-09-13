# CHANGELOG v63 — Cobro seguro ante cortes de Supabase + registro de envíos (13-09-2026)

## Qué pasó
El dueño no pudo registrar una venta: `POST /api/ventas → 400 "Gateway Timeout"`. En Salud había 48
errores del mismo tipo entre el 12-09 23:39 y el 13-09 13:45, **en el POS y en la tienda a la vez**.

**Diagnóstico:** las dos bases (`sevelin-pos-oficial` y `sevelin-web`) están en Supabase `sa-east-1`
y fallaron en las mismas ventanas. La base del POS está sana (15 MB, sin consultas lentas, 100% de
aciertos de caché). La causa fue la plataforma, no el código. **La venta del kit de limpieza no dejó
daño:** falló antes de descontar (stock 10, sin ventas sin detalle).

**El riesgo real que apareció:** un "Gateway Timeout" no dice si Postgres alcanzó a guardar. El cobro
podía (a) descontar el stock y no guardar la venta, o (b) al reintentar, descontar dos veces o
duplicar la venta. Además el error llegaba como 400 con el texto crudo.

## Qué se hizo

### `sql/50-venta-idempotente-y-envios.sql` (aplicada en producción el 13-09-2026)
- `ventas.clave_idempotencia` con índice único.
- `stock_descuentos_venta` + `descontar_stock_venta_idem(p_items, p_clave)`: descuenta **una vez por
  clave**; si el carrito cambió entre intentos, devuelve lo anterior y descuenta lo nuevo.
- `revertir_descuento_venta(p_clave)`: devuelve el stock solo si **no** existe la venta.
- `limpiar_descuentos_huerfanos()`: devuelve el stock de cobros abandonados hace más de 15 minutos.
- Tabla `envios` (una fila por venta) y clasificación de gastos **"Envíos / Despachos"**.
- Probada en producción **dentro de una transacción con ROLLBACK** (producto de prueba): descuento,
  reintento, carrito cambiado, revertir, venta existente, huérfanos y sin stock. No dejó rastro.

### Backend — `POST /api/ventas`
- Con clave: busca la venta primero (si ya está completa responde `200 ya_registrada`), descuenta de
  forma idempotente con reintento, inserta la cabecera con reintento (un duplicado = "ya se guardó") y
  completa el detalle si había quedado solo la cabecera.
- Corte de Supabase → **503**: *"Vuelve a apretar 'Registrar venta': no se va a cobrar ni descontar
  stock dos veces"*. Error definitivo → 400 y se devuelve el stock.
- Sin clave (llamadas antiguas) funciona como antes, pero ya **no reintenta** el insert de la venta (podía
  duplicarla).
- `registrarEnvioDeVenta()`: guarda el envío, crea el gasto ("Envíos / Despachos") y, si salió del
  cajón con caja abierta, un **egreso del turno** para que el cierre cuadre. Nunca anula la venta: si
  algo falla, responde `envio_aviso`.
- `GET /api/envios/resumen`: sectores ya usados y promedio de InDrive por km.

### Frontend
- `js/pos.js`: clave de cobro (`crypto.randomUUID`) que se repite en los reintentos y se renueva al
  registrar la venta.
- Paso **"Entrega del pedido"** (`index.html`, `js/pago.js`):
  - Envío/Despacho deja **Origen del pago = Transferencia** por defecto; Retiro, Presencial.
  - **¿Quién lo lleva?** InDrive · Mi padre · Otro (con nombre) · Sin costo.
  - **Costo**, **km** (opcional) y **¿Cómo lo pagas?** Efectivo de la caja · Transferencia.
  - **Sector / población** con autocompletar de los sectores ya usados.
  - Aviso en vivo: *"InDrive promedio: $800/km (4 viajes) · este viaje: $1.000/km · 25% más caro"*.
  - Sin costo anotado, la venta se registra igual y ese envío no se guarda (no ensucia el promedio).
- **Salud → Errores recientes: botón 📋 Copiar** (todos los errores con el detalle completo, en texto).
- Favicon en línea: se va el 404 de `/favicon.ico` de la consola.

## Cómo se probó
- Backend con el doble en memoria (29 comprobaciones): venta normal; corte después de guardar la
  cabecera; corte en el detalle con reintento (1 venta, 1 detalle, stock descontado 1 vez, tercer
  intento `ya_registrada`); 3 cortes seguidos en el descuento; error definitivo devuelve el stock y no
  deja venta; envío InDrive desde caja (gasto en efectivo + egreso del turno, reintento sin duplicar);
  envío del padre por transferencia; retiro ignora datos de envío; resumen ($833/km); venta sin clave.
- Frontend con jsdom (13): valores por defecto, autocompletar, aviso contra el promedio, datos enviados,
  reseteo al reabrir, "Sin costo", misma clave en el reintento y nueva en la venta siguiente, Copiar.
- Pruebas de v62 vueltas a correr: todo OK. `node --check`, funciones e ids duplicados: vacíos.
- **No verificado:** cómo se ve el paso de entrega con los campos nuevos en la pantalla real, y el
  comportamiento contra un corte real de Supabase (se simuló).

## Límites conocidos
- Productos con lotes (FIFO, hoy 1 de 185): su consumo de lote no es idempotente ante un corte.
- El costo de un envío se anota al cobrar. Si todavía no se conoce, hoy no hay pantalla para agregarlo
  después (queda para cuando haya datos).
- Los 14 errores "eval() is not supported" de la tienda vienen del servidor de desarrollo local
  (modo dev de Next), no de clientes.
