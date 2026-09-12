# v60 — 12-09-2026 · El día que la tienda dejó de mentir sobre el stock, y las ventas web aparecieron

Sesión larga, con cambios en **los dos repos**. Lo que sigue está ordenado por
importancia real para el negocio, no por orden cronológico.

---

## 1. 🔴 Las ventas web no existían en el POS

**El hallazgo más caro del día, y lo encontró el dueño** al no ver en su Historial
de Ventas una venta que sí se había cobrado.

Un pedido pagado en sevelin.cl llamaba a `/api/interno/ajustar-stock` y ahí
terminaba: **el stock bajaba y la venta no se registraba en ninguna parte.** No
aparecía en el Historial, ni en la utilidad, ni en el margen, ni en el ticket
promedio, ni en el punto de equilibrio, ni en el informe semanal.

No era un problema de pantalla: **los números con los que se toman decisiones
estaban cortos**, el inventario mostraba salidas sin venta que las explicara, y el
descuadre crecía con cada compra online.

**Arreglado** con `POST /api/interno/registrar-venta-web` (sql/41), que el webhook
llama después de ajustar el stock:

- No reusa `POST /api/ventas` porque esa ruta descuenta stock, y acá ya se
  descontó — pasaría dos veces.
- **Idempotente** por el índice único de `ventas.pedido_web_numero`: las pasarelas
  reintentan sus notificaciones y sin candado el pedido entraría dos o tres veces.
- **Nunca lanza:** el pago ya está capturado cuando corre. Hacer fallar el webhook
  por un registro contable haría que la pasarela reintente el flujo entero,
  incluido otro descuento de stock.
- Entra con `origen_pago = 'web'` y la comisión de Khipu (1% + IVA) en
  `comision_pasarela`, sin la cual el margen online se ve mejor de lo que es.

**La venta de la balanza (WEB-000009) se registró retroactivamente.** El día 12-09
pasó de $28.000 a $35.000.

---

## 2. 🔒 La URL del pedido era adivinable

`/pedido/WEB-000009` usaba el número **correlativo**: restando uno se llegaba al
pedido de otra persona.

El 10-09 ya se había tapado lo peor —el endpoint dejó de devolver nombre, correo,
RUT, teléfono y dirección— pero eso blindaba los datos uno por uno dejando la
puerta abierta: cualquier campo nuevo volvía a quedar expuesto, y el link a la
boleta del SII (que lleva nombre y RUT) ya estaba contemplado en la página.

Ahora se entra por `token_publico`: 32 hexadecimales aleatorios por pedido
(supabase/26). Verificado que `/pedido/WEB-000009` y `/api/pedido/WEB-000008`
devuelven 404.

**En el mismo cambio**, dos cosas que hacían perder ventas sin que nadie lo viera:

- **La página no se enteraba del pago.** Khipu devuelve al cliente cuando el pedido
  todavía está en CREADO; como era un Server Component, se quedaba congelada
  pidiéndole recargar a mano. Casi nadie lo hace: se van creyendo que falló. Ahora
  consulta cada 3 segundos y se actualiza sola, con corte a los 3 minutos.
- **La invitación a reseñar en Google nunca se disparaba.** Solo se monta con el
  pago confirmado, momento al que la página no llegaba. Y encima usaba
  `window.open()`, que los navegadores bloquean por no venir de un click. Se
  cambió por un modal que aparece a los 2,5 segundos. El botón permanente queda.

---

## 3. Urgencia de stock, "Por llegar" y lista de espera

Tres funciones que son la misma idea: **capturar al cliente que quiere algo que no
está disponible ahora.**

### Aviso de pocas unidades (sql/40 + supabase/27)

Con 3 o menos en stock, la ficha lo dice y ofrece las tres formas de llevárselo
(retiro, despacho, retiro agendado). **El número lo calcula la tienda con el stock
real, nunca se escribe a mano**: un cartel de "última unidad" sobre algo que tiene
diez es publicidad engañosa y quema la credibilidad del resto del catálogo.

El POS controla en qué productos se permite (`urgencia_stock_web`, nace en `true`).

### "Por llegar" (sql/42, sql/44 + supabase/28, 29)

Productos que vienen en camino. Se reservan **pagando el 100%**, con fecha
**estimada** y **devolución total si no llegan** — las tres reglas van arriba en la
sección, antes de los precios.

Desmarcar "Por llegar" en el POS es lo que significa **"ya llegó"** y dispara los
correos a quienes esperaban. Es manual a propósito: ningún cron puede saber si se
abrió la caja.

**Dos bugs encontrados probando:**

1. **Sin tope de compra:** permitía 99 unidades de algo que tenía una. El pago se
   cobraba y el descuento fallaba después. Ahora solo se compra lo que existe: con
   stock disponible ese es el límite; sin nada, se reserva hasta lo que el dueño
   declaró que viene.
2. **Ficha en 404:** un producto por llegar con stock 0 no se podía ni ver, porque
   el catálogo exige `stock_web > 0`. O sea que el caso principal de la función no
   funcionaba.

### Lista de espera (supabase/28)

Una sola tabla con dos modos —`AVISO` (gratis) y `RESERVA` (pagado)— porque son el
mismo problema: alguien quiere algo que no está, deja cómo ubicarlo, y cuando
llega se le avisa. El modo sin pago cubre a quien prefiere pagar presencial.

Ley 21.719: consentimiento explícito sin premarcar, finalidad única, versión de
política registrada, y la fila pasa a NOTIFICADO al cumplirse.

**Bug corregido probando:** `enviarCorreo()` **no lanza, devuelve `false`**. La
primera versión lo envolvía en try/catch y daba por enviado todo — habría marcado
como avisada a gente cuyo correo nunca salió.

**Sobre WhatsApp automático:** se descartó. La API oficial exige un número
dedicado (el de Sevelin dejaría de funcionar en el celular, y es donde se cierra
de verdad), verificación de negocio con Meta —que ya restringió un portafolio— y
costo por mensaje de categoría marketing. El botón deja que **el cliente escriba**:
una conversación que inicia el cliente es gratis y no necesita API.

---

## 4. Retiro agendado y horario real

El cliente puede sugerir **cuándo piensa pasar** (opcional, no lo compromete) y
recibe un recordatorio esa mañana a las 8. El panel del POS lo muestra junto al
método de envío — sin eso, el dato no lo vería nadie.

Se pide por **bloques de dos horas**: nadie sabe a qué minuto va a llegar.

### 🔴 El error de horario que se arrastraba

El horario real es **lunes a domingo, 11:00-13:00 y 14:00-20:00**. El código
asumía semana hábil de oficina, así que a quien compraba un **sábado después de
las 18:00 le decía que su despacho salía el lunes** — cuando salía el domingo. Dos
días de espera inventados, justo en el fin de semana que es cuando más se compra.

Los bloques de retiro además ofrecían **las 10:00** (cerrado) y **13:00-14:00**
(colación). Mandar a alguien a una puerta cerrada con un dato de la propia tienda
es peor que no haber ofrecido agendar.

El horario vive ahora en un solo lugar (`TRAMOS_ATENCION`).

---

## 5. Lo demás

- **Crear cuenta desde el checkout**, pegado al campo de correo. Si falla —el
  correo ya existe, la contraseña no pasa— **se sigue comprando como invitado**:
  perder una venta por algo opcional sería el peor resultado.
- **Retomar el pago** de un Khipu que quedó a medias, solo en estado CREADO. Crea
  un cobro nuevo (los links de las pasarelas caducan). Rechaza pagados y expirados.
- **Medidas firmadas y aparte** (sql/43): el formulario mandaba siempre los 4
  campos, así que corregir un precio marcaba el producto como "medido hoy". Ahora
  tienen ruta propia que **exige el nombre de quien midió** — escrito, no el
  usuario de sesión, porque en el mostrador varios comparten la cuenta de admin.
  Tope de cordura de 300 kg/cm: un 18 en vez de 1,8 multiplica por diez el envío.
- **Carrusel controlable**: pausa, anterior y siguiente siempre visibles; se
  detiene al pasar el mouse o al llegar con teclado; respeta
  `prefers-reduced-motion`.
- **Azapa y Lluta apagados** con un interruptor (`VALLES_HABILITADOS`), sin borrar
  las mediciones del dueño.
- **Sección `/por-llegar`** en el menú (a la izquierda de Encargos) y dos
  diapositivas nuevas en el hero. Para eso cada slide lleva ahora su propio
  destino: antes el botón mandaba siempre a `/productos`.
- **Términos y FAQ** al día con todo lo anterior.
- **Aviso de pago con tarjeta**: usaba breakpoints de pantalla y en la columna del
  carrito el texto quedaba aplastado en ~100px con el botón desbordado. Ahora usa
  container queries.

---

## Errores propios de esta sesión (para no repetirlos)

1. **Sobrescribí un producto real** (`Mouse Urbano Labs`) probando el disparador
   con un id inventado contra producción. Reparado, pero la lección es leer el id
   verdadero antes de mandar cualquier prueba.
2. **Un `git add -A` subió la carpeta `design/`** sin que nadie lo pidiera.
3. Las fotos de otro producto se borraron en una segunda prueba. También reparadas.

---

## Migraciones aplicadas

| POS | Tienda |
|---|---|
| `40-urgencia-stock-web.sql` | `26-token-publico-pedido.sql` |
| `41-venta-desde-pedido-web.sql` | `27-urgencia-stock-web.sql` |
| `42-por-llegar.sql` | `28-por-llegar-y-avisos.sql` |
| `43-medidas-por-separado.sql` | `29-stock-por-llegar.sql` |
| `44-stock-por-llegar.sql` | `30-retiro-agendado.sql` |

Todas idempotentes y ya corridas en producción.
