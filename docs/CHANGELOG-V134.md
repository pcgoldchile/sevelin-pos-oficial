# v134 · Por llegar con varias llegadas, ventanas propias y pago con tarjeta (11-10-2026, noche)

> Escrito el 12-10-2026: la sesión del 11 se cortó por límite de uso antes de documentar.

## 1. Por llegar (#97) — PUBLICADO, POS `b0b2e24`
- **Marcar varias de una vez:** casillas en "Mercadería por llegar" y botón "Marcar llegadas"
  (`POST /api/ingresos/llegadas`, hasta 60, una por una).
- **Llegaron menos:** la confirmación pide cuántas llegaron. El resto "sigue por llegar" (queda otra compra por llegar
  con lo que falta) o "no llega". `recibirCompraPorLlegar()` en `api/index.js`.
- **Los trabajadores también marcan**, sin ver costos (`GET /api/productos/en-camino` y la llegada pasaron a `auth()`).
- **Sin ventanas del navegador en todo el POS:** `js/ventanas.js` (`ventanaConfirmar`, `ventanaAviso`,
  `ventanaPreguntar`). Se reemplazaron los 50 `confirm/alert/prompt` de 27 archivos. Toda pantalla nueva usa estas.
- Doble clic o dos personas a la vez: el `update ... .eq('en_camino', true)` es el candado; la segunda recibe 409.
- Probado: 68 casos del servidor y la maqueta. No probado con la base real ni en celular.

## 2. Pago con tarjeta (#96) — CONSTRUIDO, SIN PUBLICAR (POS `ce4f5a5`, tienda `32ce25f`)
- **Tienda:** medio "Tarjeta de débito o crédito". Hoy abre el link de Haulmer (`tuu.cl/sevelin`): el pedido queda
  "Esperando pago". Webpay Plus integrado y probado en el ambiente de pruebas de Transbank, apagado.
- **POS:** en Pedidos Web, "Confirmar pago" (solo admin): el monto escrito debe calzar con el pedido.
  `maquina_tarjeta = 'WEBPAY'` y su tarifa (débito 1,49%, crédito 2,29%, más IVA; sin contrato con que compararla).
- Correo nuevo "tu pedido quedó sin pagar", con fotos. Plazo para pagar: 24 horas.
- **Falta:** aplicar `supabase/42` (tienda) y `sql/91` (POS), probar en pantalla la ventana "Confirmar pago", push de
  los dos repos y una compra real de prueba. Para encender Webpay: código de comercio de Transbank (#93).
- Probado: 34 casos del POS y el recorrido completo en la maqueta de la tienda.
