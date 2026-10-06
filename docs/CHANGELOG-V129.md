# v129 — Por llegar: el cliente elige cómo recibe, y aviso "listo para retiro" (06-10-2026)

Pendiente #73. Cruza los dos repos: POS (`sevelin-pos-oficial`) y tienda (`sevelin-tienda`, commit `8ea0b56`,
`supabase/41` aplicada).

## La regla (dueño, 06-10-2026)

- **Retiro en tienda: gratis.** El cliente no viene hasta que le llega el correo "listo para retiro": encontrar los
  productos, revisarlos y dejarlos listos toma tiempo.
- **Despacho a domicilio: se cobra y queda pagado por adelantado**, también por lo que está por llegar.
- Si el pedido mezcla productos que ya están con productos por llegar, **elige el cliente**.

## Qué ve el cliente en sevelin.cl

| Carrito | Retiro | Despacho |
|---|---|---|
| Todo en stock | Gratis. "Espera el correo antes de venir." | Como siempre. |
| Todo por llegar | Gratis. Se le avisa cuando llegue y esté listo. | Un despacho, pagado ahora. Sale cuando llegue. |
| Mezcla | Gratis las dos veces. Un correo por lo que está, otro por lo que llegue. | Elige: **un envío cuando llegue todo** (paga 1) o **dos envíos** (paga los 2 ahora). |

Ejemplo real de la maqueta, productos por $21.990 a Iquique: un envío $6.500 (total $28.490); dos envíos $13.000
(total $34.990); retiro gratis (total $21.990).

Cómo se cobran los dos envíos: el despacho propio dentro de Arica es por distancia, así que son dos viajes (el
doble); con courier cada envío se cotiza con sus propios productos y se suman. El costo lo recalcula el servidor
(`POST /api/checkout`): pedir "dos envíos" en un carrito que no mezcla, o con retiro, no cobra nada extra.

## Qué cambió en el POS

- **Página Web → Pedidos Web, botón "📣 Listo para retiro"** en los pedidos de retiro pagados. Abre una lista de los
  productos con casillas: lo que estaba viene marcado, lo por llegar viene sin marcar ("márcalo solo si ya llegó") y
  lo ya avisado queda bloqueado. Al mandar, el cliente recibe el correo con lo marcado, la dirección y el horario; lo
  que no se marcó se le dice que **todavía no está listo**.
- Un pedido con algo por llegar tiene dos avisos: se aprieta el botón otra vez cuando llega lo que faltaba.
- Bajo el método de envío, cada pedido dice cómo va: "⏳ Sin avisar: el cliente espera tu correo", "📣 Avisado en
  parte (1 de 2)", "📣 Listo para retiro · avisado …", "📦📦 2 envíos, los dos pagados" o "📦 1 envío, cuando llegue
  todo".
- `POST /api/pos/pedidos-web/:id/listo-retiro` (solo admin). **Solo queda anotado si el correo salió**; si la tienda
  no confirma, responde error y no marca nada. Un pedido "Por preparar" pasa a "Preparando".
- Con dos envíos, "Gestionar" recuerda marcar Entregado recién al entregar el segundo (ese clic manda el correo final
  con la reseña).

## Qué cambió en la tienda

- `supabase/41`: `pedidos_web.entrega_por_llegar` (`JUNTO` / `DOS_ENVIOS` / null) y `pedidos_web.retiro_avisos`.
- `src/lib/envio.ts`: `costoDeDosEnvios` y `costoDosEnvios` en cada opción con despacho.
- `POST /api/pos/notificar-listo-retiro` y `correoListoParaRetiro`.
- Textos de retiro: la opción del checkout, el correo de confirmación y el de "llegó tu reserva" ya no dicen "pasa
  a buscarlo"; dicen que espere el correo. La página del pedido muestra "listo para retiro".

## Decidido por Claude, falta que el dueño confirme

- Con despacho se dejó también **"un solo envío cuando llegue todo"** (paga un despacho), además de los dos envíos
  que pidió. Sin esa opción, quien quiere despacho estaría obligado a pagar dos.
- El aviso de retiro vale para **todos** los pedidos de retiro, no solo los que traen algo por llegar.
- Si el pedido no tiene correo, el botón no anota nada y dice que se avise por WhatsApp.

## Cómo se probó

- Tienda, contra la maqueta (Next real y base simulada): 19 de 19. Cotización con uno y dos envíos, compras con
  cada opción (cobro y columna guardada), el intento de cobrar doble donde no corresponde, y el aviso con secreto,
  sin secreto, sin productos, con producto ajeno, en un pedido con despacho y en uno inexistente.
- Tienda, en el navegador: el checkout muestra la pregunta, cambia el total al elegir y la quita con retiro.
- Correos: leídos los ocho textos (aviso completo y parcial, confirmaciones y "llegó tu reserva").
- POS, servidor: 19 de 19 con un doble de la base y una tienda falsa (aviso parcial, segundo aviso, reglas, y los
  tres casos en que el correo no sale: no queda anotado).
- POS, maqueta: aviso parcial, segundo aviso y pedido sin correo.
- **No probado:** un correo real, una compra real, y el despacho propio dentro de Arica en dos envíos (la maqueta
  no mide distancias; la regla es "el doble").
