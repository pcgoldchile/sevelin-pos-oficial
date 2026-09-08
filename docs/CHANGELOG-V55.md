# CHANGELOG v55 — Aviso de garantía por vencer

**Fecha:** 07-09-2026 · **Rama:** `main` · **SQL:** `sql/39-aviso-garantia.sql` (**aplicada y
verificada**). Plan: `docs/PLAN-CRECIMIENTO-2026.md`, Fase 4.

---

## 1. Qué cambia

El módulo Garantías (v48) sabía cuándo vence cada garantía, pero ese dato solo servía **para
responder**: alguien llegaba con un equipo malo y se consultaba si estaba cubierto. Nadie avisaba
antes.

Esta versión da vuelta la pregunta: **¿a quién le vence pronto y todavía no le avisamos?**

Avisar a los 30 días convierte un dato pasivo en atención postventa. El cliente revisa su equipo
mientras todavía está cubierto, y de paso se entera de que Sevelin sigue ahí. **Ningún competidor de
Arica lo hace** — y la infraestructura ya estaba, solo faltaba saber a quién ya se le avisó.

---

## 2. Por qué WhatsApp manual y no correo automático

Dos razones, ninguna técnica:
1. **El canal real de Sevelin es WhatsApp.** Casi toda la venta se coordina por ahí.
2. **El correo está bloqueado** hasta verificar el dominio en Resend (bloqueo B2 del plan).

Así que el panel arma la lista y **redacta el mensaje**; el click lo da el dueño en `wa.me`. Cuando
haya correo, el mismo endpoint sirve para automatizarlo: la lista ya viene calculada del servidor.

### El mensaje es postventa, no publicidad
Le recuerda al cliente algo que compró y un derecho que tiene, con fecha concreta. **No lleva
ofertas ni links de catálogo** — meter promoción ahí convierte un servicio en spam y quema el canal.

> Hola Juan, te escribimos de Sevelin 👋
>
> La garantía de tu Monitor HP 22" V223 vence en 5 días (el 2027-02-10).
>
> Si notaste algo raro —que se apague solo, que caliente, que ande lento, lo que sea— tráelo antes de
> esa fecha y lo revisamos sin costo. Si anda todo bien, no tienes que hacer nada.
>
> Cualquier duda, respóndenos por acá.

Del nombre se usa **solo el primer nombre y solo letras**: `ventas.cliente` es texto libre y suele
traer cosas que no van en un saludo ("Juan (debe 5000)", "María - vecina"). Si no queda un nombre
usable, saluda sin nombre.

---

## 3. Lo que se agregó

### Base de datos — `sql/39-aviso-garantia.sql`
`venta_items.aviso_garantia_en` y `ordenes_trabajo.aviso_garantia_en` (TIMESTAMPTZ) + índice parcial
sobre las filas sin avisar, que son las únicas que consulta el panel.

**Por qué un timestamp y no un booleano:** "¿ya le avisé?" y "¿cuándo?" son la misma pregunta a
distinta profundidad. Con la fecha se puede volver a avisar meses después sin perder el registro, y
se sabe si el aviso salió a tiempo o encima del vencimiento. Un booleano habría que resetearlo a
mano y no cuenta nada.

### Backend
- **`GET /api/garantias/por-vencer?dias=30&avisados=0`** — productos (desde `venta_items` + su venta)
  y servicios (OT entregadas) juntos, solo los **VIGENTES** que vencen dentro de la ventana, sin
  avisar, **ordenados por urgencia**: es una lista para actuar, no para leer.
  **No recalcula el vencimiento**: reutiliza `calcularEstadoGarantia()` del módulo Garantías, que ya
  usa el snapshot de meses de cada ítem. Dos fórmulas del mismo dato es como se desincronizan los
  sistemas.
- **`POST /api/garantias/:tipo/:id/aviso`** — marca o desmarca el aviso. `tipo` decide la tabla:
  productos en `venta_items`, servicios en `ordenes_trabajo` — son dos garantías con dos fechas de
  inicio distintas, no una tabla común. `{avisado:false}` deshace un click equivocado.

### Frontend — Garantías → ⏰ Por vencer
Ventana de 30 / 60 / 90 días o 6 meses, casilla para ver también los ya avisados, tabla con badge de
urgencia por color (rojo ≤7 días, dorado ≤15, azul el resto), botón **📲 Avisar** que abre WhatsApp
con el mensaje ya escrito, y botón para marcar/deshacer el aviso.

---

## 4. Dos cosas que el panel dice en voz alta

**a) Hoy está vacío, y explica por qué.** Las ventas empezaron el 03-08-2026 con garantías de 6
meses, así que la primera vence el **03-02-2027**. En vez de un "no hay resultados" que parece un
error, el estado vacío dice: *"Nadie por avisar en los próximos 30 días. La garantía vigente más
próxima vence el 2027-02-03, en 149 días. Esta lista se va a llenar sola cuando falten menos de 30."*
El selector de 6 meses permite ver desde ya las 210 garantías que vienen.

**b) Casi nadie tiene WhatsApp registrado.** El teléfono existe desde v52, así que las ventas
anteriores no lo tienen: **de 211 garantías, 1 tiene teléfono**. El resumen lo dice tal cual, en vez
de mostrar una lista de botones que no se pueden apretar. Es el argumento más concreto para registrar
el WhatsApp en cada venta desde ahora: **quien no quede registrado hoy, no se le puede avisar en
febrero.**

---

## 5. Cómo se probó

- **Endpoint contra producción**: ventanas de 30 / 90 / 180 días. A 30 y 90 días: 0 (correcto). A
  180: **210 garantías**, con el próximo vencimiento en 149 días.
- **Ida y vuelta del aviso, sobre una fila real**: marcar → la fila **desaparece** de la lista
  (210 → 209); deshacer → **vuelve** (209 → 210). Revertido, la base quedó como estaba.
- **Errores**: tipo inválido → 400 con mensaje claro; id inexistente → 404.
- **Panel en jsdom** con los datos reales + una fila sintética con teléfono (ninguna venta real tiene
  todavía): 211 filas, el link `wa.me` con el mensaje completo dentro, badge rojo en la más urgente,
  el click en "Marcar avisado" llama **una sola vez** al endpoint con el tipo e id correctos, y el
  estado vacío muestra la fecha del próximo vencimiento.
- **Prueba de inyección**: un nombre de cliente con `<img src=x onerror=…>` no inserta ningún nodo en
  el DOM y queda reducido a letras en el saludo.
- `node --check` en los 3 archivos JS tocados; chequeos de colisión de funciones, `const`/`let`
  globales e `id`: **todos vacíos**.

### Trampa de jsdom descubierta acá (anotar para la próxima)
Los scripts de prueba disparaban `DOMContentLoaded` **a mano** después del `eval`. jsdom lo emite
**solo, y después** del eval — así que el callback corría **dos veces** y los listeners delegados
quedaban duplicados: un click contaba doble. No es un bug del producto (en el navegador el evento
ocurre una sola vez), pero falsea cualquier prueba de interacción.
**Regla: en jsdom, esperar un tick en vez de disparar `DOMContentLoaded`.**

---

## 6. Archivos tocados

| Archivo | Cambio |
|---|---|
| `sql/39-aviso-garantia.sql` | **nuevo**, aplicado |
| `api/index.js` | `GET /api/garantias/por-vencer`, `POST /api/garantias/:tipo/:id/aviso`, helper `diasHastaFecha()` |
| `js/api.js` | `API.garantias.porVencer()` y `.marcarAviso()` |
| `js/garantias.js` | rama `por-vencer` + panel completo y redacción del mensaje |
| `index.html` | sub-pestaña, ítem de sidebar y panel |

---

## 7. Observación que NO se tocó

El módulo Garantías es visible para el rol `trabajador` (ni el botón del sidebar ni la sección tienen
`admin-only`), pero **todos** sus endpoints —los de v48 y estos dos nuevos— son `auth(true)`, es
decir solo admin. Un trabajador que entre ahí ve la pantalla y recibe errores.

Es **anterior a esta versión** y no se cambió: decidir si el taller debe poder consultar garantías es
una decisión del dueño, no una corrección técnica. Queda anotado.

---

## 8. Lo que sigue

1. **Registrar el WhatsApp en cada venta.** Sin eso, en febrero habrá una lista de 200 personas a las
   que no se les puede escribir.
2. En enero conviene revisar el panel una vez por semana: ahí empieza a llenarse.
3. Cuando el dominio de Resend esté verificado (B2), este mismo endpoint permite mandar el aviso por
   correo además de WhatsApp, sin recalcular nada.
