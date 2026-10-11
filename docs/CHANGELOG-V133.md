# v133 — Link de pago de Haulmer, acuerdo con los padres y cotizaciones aproximadas (11-10-2026)

Sesión del domingo 11-10-2026 (Opus · Extra). El dueño respondió el prompt de apertura: pago con tarjeta en la tienda
(investigar antes de construir), OK al diseño del acuerdo con sus padres, y varias respuestas sueltas.

## Qué cambió en el POS

- **"Link de pago" al cobrar con tarjeta (`sql/89`, commit `fcca6f1`).** Al lado de las máquinas TUU y Banco de Chile
  hay un tercer botón. Guarda `maquina_tarjeta = LINK_TUU` y usa la tarifa de TUU (0,79% + $65 + IVA: $19.990 da $265,
  lo mismo que cobró Haulmer). No se recuerda para el cobro siguiente, a diferencia de las dos máquinas. También está
  en los abonos de encargos y en el detalle de la venta.
- **Acuerdo con los padres (`sql/90`, commit `8fbd6f3`, pendiente #87).**
  - Ficha de producto: **"¿De quién es?"** (mía / de mis padres / de los dos) y, en los servicios, **"Lo hace mi papá"**.
  - Cada línea de venta guarda de quién era la unidad (`venta_items.propietario`). La ficha manda; solo en un producto
    "de los dos" o en lo escrito a mano vale lo que diga la caja. Un trigger (`trg_venta_items_propietario`) cubre la
    venta web, los encargos y la importación, que insertan por su cuenta.
  - Caja: casilla **"De mis padres"** y, antes de elegir el medio de pago, la ventana **"Antes de cobrar"**: cuánto de
    cada servicio va al pozo (todo / menos el repuesto / otro monto / no va) y si el IVA lo pone el papá. Aparece solo
    si el carrito trae un servicio marcado "Lo hace mi papá", un servicio escrito a mano o un producto "de los dos".
    El servidor recalcula el monto (`calcularPozoLinea`) con el descuento de la venta repartido.
  - **Finanzas → Mis padres** (solo admin, `GET /api/padres/resumen`): lo vendido de ellos **al precio de venta**
    contra el aviso de los $3.000.000, lo pagado, el pozo del mes con su mínimo, lo entregado y la entrega sugerida
    del día. Se puede corregir el pozo de una línea, sumar un servicio que no se marcó y cambiar los números del
    acuerdo. No guarda saldos: todo sale de las ventas y de los gastos.
  - Los **pagos a los padres** y las **entregas al papá** son gastos normales con clasificación propia ("Mercadería de
    mis padres", grupo INVENTARIO; "Pozo de mi papá (servicios de celulares)", grupo OPERATIVO). Los botones del panel
    abren "Registrar gasto" ya llenado; nada se anota solo.
  - Editar una venta (que borra y reescribe sus líneas) y cambiarle un producto conservan dueño y pozo.
  - Orden de trabajo: casilla "Este trabajo lo hace mi papá". Es un recordatorio: la plata se cuenta al cobrar en caja.
- **Taller → Cotizaciones aproximadas** (`cotizaciones_referencia`, `js/cotizaciones-ref.js`): lista de precios de
  referencia por equipo y trabajo, con buscador. La leen y la llenan todos; el costo del repuesto y borrar, solo admin.

## Reglas decididas (no volver a preguntar)

- El aviso de los $3.000.000 cuenta lo vendido de los padres **al precio de venta**.
- El IVA del pozo se decide **en cada cobro** ("a veces lo pondré yo, u otras veces él").
- La entrega al papá la sugiere el POS día a día: lo mayor entre lo juntado y el mínimo a la fecha, menos lo entregado.
  El mes en que parte el pozo, el mínimo se prorratea desde ese día (`acuerdo_padres.pozo_desde`).

## Datos

- **Venta #264:** el Power Bank LinkOn del 10-10 (22:03, Tarjeta Débito por Link de pago, $19.990, comisión $265,
  boleta). La anotó Claude por SQL a pedido del dueño, con los mismos pasos que `POST /api/ventas`. Stock 20 → 19.
- **Cuentas mayoristas:** las 2 solicitudes pendientes quedaron APROBADAS a pedido del dueño, sin verificación por
  WhatsApp (queda dicho en `nota_verificacion`). La tienda les mandó el correo de siempre.

## Pago con tarjeta en sevelin.cl (#93): investigado, sin construir

Recomendación: **integrar el Pago Online de TUU**, no Webpay. TUU publica una API para tiendas a medida
(`developers.tuu.cl/docs/payment-intent`, con credenciales y ambiente de prueba); un intento de pago de prueba respondió
bien. Transbank bajó desde el 01-09-2026 a 1,49% débito y 2,29% crédito más IVA. En $19.990, con IVA: Khipu $238,
TUU $265, Webpay débito $354, Webpay crédito $545. Sobre $31.000 TUU sale más barato que Khipu. Falta el OK del dueño
y que TUU le entregue su `account_id` y su `secret`. Sin verificar: que TUU acepte tiendas a medida (su página comercial
dice solo WooCommerce y Jumpseller) y que la firma de la documentación calce con la real (el ejemplo publicado no dio
el resultado que ellos mismos anotan, aunque el ambiente de prueba aceptó la firma calculada).

## Pruebas

- Servidor real contra un doble de Supabase en memoria: 66 casos (dueño de cada línea, pozo en sus cuatro modos, con
  descuento y sin IVA, devoluciones, venta anulada, mes anterior, corregir el pozo, editar una venta, permisos del
  trabajador, cotizaciones). Todos pasan.
- Maqueta en el navegador integrado, como admin y como trabajador: ventana "Antes de cobrar", panel Mis padres,
  cotizaciones, ficha de producto y orden de trabajo. La maqueta trae datos de ejemplo del acuerdo.
- **No probado:** el foco y la tecla Enter de "Antes de cobrar" con la ventana visible (el panel estaba oculto y el
  navegador no dibuja), la pistola lectora con esa ventana abierta, y nada en el celular.

## Qué queda en manos del dueño

Marcar los productos de sus padres y los servicios del papá, apretar "Partir hoy" en el pozo, decidir el precio del
cambio de batería (se le dio una aproximación), y la respuesta de TUU.
