# v61 — 12-09-2026 · Servicios técnicos: fichas reales, precio a consultar y "trae tu equipo"

Sesión en Opus, con cambios en **los dos repos** y en **las dos bases**. Sigue a la decisión del
11-09 de crecer por servicio técnico (margen 100%).

---

## 1. Fichas de los 27 servicios técnicos (datos, sin código)

- **Prompt v3** de fichas de servicio: ventajas / incluye / no incluye (con ❌, nunca ✅) /
  importante / servicio recomendado. Texto completo en la memoria del proyecto
  (`project_prompt_descripcion_servicios_tecnicos`).
- **13 fichas existentes reescritas** (ids 86, 88-93, 112, 117, 118, 136, 178, 227). Tres (#112, #178,
  #227) se veían como un bloque plano porque estaban guardadas con `<p>` y la tienda no las
  formateaba. #117 y #118 mostraban texto de relleno al cliente (`[X horas]`) y voseo.
- **14 servicios nuevos** (ids 265-278): consolas PS3/PS4/PS5, mandos, celulares, bisagras,
  impresora, tarjeta de video. Precios y plazos dictados por el dueño.
  - Publicados: 265-269.
  - **Ocultos** 270-273: el "incluye" lo propuso Claude, falta validación del dueño.
  - **Ocultos** 274-278: precio variable. Se publican con `precio_a_consultar` después del deploy.
- `meta_titulo_web` / `meta_descripcion_web` escritos a mano para los 27 (el botón "Generar con IA"
  sigue sin funcionar).

## 2. Precio a consultar

- `sql/45-precio-a-consultar.sql` (POS) + `sevelin-tienda/supabase/31-precio-a-consultar.sql` (web).
- Casilla nueva en el modal de producto: **💬 Precio a consultar (no se vende en línea)**.
- Tienda: el precio sale con **"Desde"**, la ficha cambia "Agregar al carrito" por **"Cotizar por
  WhatsApp"** con el nombre del servicio ya escrito, y la tarjeta del catálogo muestra "Cotizar".
- **La barrera real está en el servidor:** `POST /api/checkout` rechaza el ítem aunque llegue por un
  carrito compartido o recuperado.

## 3. Carrito solo de servicios: "trae tu equipo"

- `sevelin-tienda/supabase/32-entrega-equipo-servicio.sql`: `pedidos_web.agenda_tipo`
  (`RETIRO` | `ENTREGA_EQUIPO`). Reusa `retiro_fecha`/`retiro_bloque`.
- Si **todo** el carrito es de "Servicios Técnicos", la única opción de entrega es **"Traes tu equipo
  al local"** (sin Chilexpress/Starken, y sin gastar llamadas a Google ni a couriers), y el **día es
  obligatorio** — en el formulario y en el servidor.
- Recordatorio por correo **el día anterior** (el del retiro sigue saliendo la misma mañana), en el
  mismo cron `recordar-retiros`.
- Panel Pedidos Web del POS: **"🔧 Trae su equipo el vie 26 · 16:00-18:00"**.
- Carrito **mixto** (servicio + producto): sin cambios, sigue como antes, a la espera de la propuesta
  aprobada por el dueño.

## 4. Garantía en fichas de servicio

La tarjeta "Garantía: 6 meses en todos nuestros productos" ya no aparece en servicios. Dice que la
garantía de mano de obra depende del servicio y del estado del equipo, y que se consulta con el técnico
(regla del dueño).

## Cómo se probó

- `next build` + `next start` local contra la base web real:
  - cotizar solo servicios → una sola opción;
  - checkout con CHILEXPRESS → 409;
  - sin fecha o con fecha pasada → 400;
  - precio a consultar → 409;
  - fichas y tarjeta renderizadas;
  - correos renderizados con tsx.
  - Se marcó un servicio publicado solo en `productos_web` para la prueba y se revirtió; 0 pedidos
    de prueba creados.
- Formulario de checkout recorrido en el navegador del entorno (lectura de accesibilidad, sin
  captura): opción única + campo de fecha obligatorio. **No se completó un pago real.**
- POS: `node --check`, chequeos de funciones e ids duplicados vacíos.
- **No verificado:** el correo de recordatorio llegando de verdad (depende del cron en Vercel) ni el
  diseño visual final (sin capturas en este entorno).

---

## 5. 🔴 Los abonos no existían para Finanzas (sql/46)

**Hallazgo al revisar el abono del PC Gamer** ($400.000; se abonaron $150.000 por transferencia).
Un abono se guardaba en `encargo_abonos` y no llegaba a ninguna parte: ni al saldo de
Efectivo/Banco, ni al cierre de caja, ni a la proyección. Además, al completar el pago no se
registraba ninguna venta.

Regla que decidió el dueño:
- Cada abono suma a su canal **el día que llega**. Esto aplica a saldos, arqueo, cierre de turno, proyección y Balance por medio de pago. Los abonos con tarjeta descuentan su comisión.
- Al llegar al 100% se registra **una sola venta** con su costo (`ventas.encargo_id`, índice único), que cuenta en Utilidades.
- Las vistas de caja excluyen esa venta para **no contar dos veces la misma plata**.
- El encargo puede ser un **producto del catálogo** (con cantidad y costo). Si es algo suelto, el costo se escribe a mano.
- La **entrega es independiente del pago** ("depende del caso"). El stock de un producto con stock propio baja al entregar o al pagar, lo que pase primero, una sola vez.
- Un encargo con abonos ya no se puede eliminar: al borrarlo se perdía plata ya registrada.

⚠️ **El PC Gamer (encargo #2) quedó con costo $0 y su abono inicial sin turno de caja.** Cuando se
complete el pago, la utilidad saldrá inflada si no se le carga el costo antes (editar el encargo).

## 6. Carrito mixto: un pedido, un pago, dos entregas

- **Envío:** con productos y servicios juntos, se cotiza solo con los productos. Los servicios siempre se traen al local.
- **Fecha:** el día en que el cliente trae el equipo es obligatorio con cualquier servicio. Si retira sus productos, es la misma visita.
- **Datos del pedido:** `ItemPedido.es_servicio` separa los bloques en el checkout, en el correo de confirmación, en el recordatorio y en Pedidos Web.
- **Balance:** `registrar-venta-web` ahora marca los servicios, que antes se contaban como productos.

## 7. QR de retiro seguro en las Órdenes de Trabajo (sql/47)

- **Código:** cada OT recibe un código aleatorio de 32 caracteres hexadecimales (`token_retiro`).
- **Correo:** al crear la OT, la tienda envía el QR por correo (`/api/pos/notificar-qr-retiro`).
- **Comprobante:** el cliente lo puede reenviar desde `/retiro/<código>` (página sin indexar, que consulta al POS en cada visita).
- **En la orden hay tres botones:**
  - 💬 Enviar por WhatsApp: botón manual, gratis.
  - ✉️ Reenviar correo.
  - ♻️ Generar QR nuevo: el anterior deja de servir.
- **Retirar con QR:** escanea el código y abre la entrega. El escáner ahora lee QR.
- **Entrega:** exige el **QR vigente** o el **carnet del titular con el RUT registrado**, y siempre nombre y RUT de quien retira. El código se usa una vez. Sin RUT registrado solo sirve el QR.
- **Probado:** doble de Supabase (23 verificaciones) y jsdom (13). En producción, la tienda consulta al POS y responde bien a un código inexistente.
- **No verificado:** que el correo con el QR llegue de verdad. Hay que crear la primera OT real con un correo propio.
