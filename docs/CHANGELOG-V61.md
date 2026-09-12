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
