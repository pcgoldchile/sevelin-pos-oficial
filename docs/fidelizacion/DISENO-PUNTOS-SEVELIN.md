# Diseño — Puntos Sevelin, recordatorio de mantenimiento y Plan Equipo Sano (19-10-2026)

> **Es un diseño, no código.** Lo pidió el dueño el 19-10-2026: *"me gusta la fidelización… revisa que no se pueda
> abusar… si compran presencial debe el mismo cliente avisar a qué RUT o teléfono se van esos puntos… en la página web
> que sea de forma automática… que cada cuenta tenga un identificador único… ajústamelo según tú mejor creas para
> evitar problemas a largo plazo… que nunca salgamos perdiendo, pero sí para captar clientes"*.
> Descartados por él el mismo día: "trae a un amigo" y "ofertas primero". Pedido: plan de mantenimiento anual.
> Construirlo toca las dos bases y datos personales: **Opus · Extra**.

---

## 0. Los números con que se calibró (medidos el 19-10-2026, últimos 90 días, ventas no anuladas)

| Tramo de margen de la línea | Vendido | Utilidad | Lo que costaría el 1% |
|---|---|---|---|
| Servicio técnico | $337.000 | $337.000 (100%) | $3.370 |
| Margen ≥ 35% | $2.247.770 | $1.032.913 | $22.478 |
| Margen 20–35% | $2.412.840 | $617.082 | $24.128 |
| Margen 10–20% | $1.209.950 | $183.946 | $12.100 |
| **Margen < 10%** (monitores) | **$2.320.000** | **$117.663 (5%)** | $23.200 = **20% de su utilidad** |
| Sin costo cargado | $501.050 | ? | ? |
| **Total** | **$9.028.610** | ~$2.29M con costo | |

- Ticket promedio: **$32.552**. Ventas con el teléfono del cliente: **4 de 277** (por eso el registro va en la caja).
- **La lección:** un 1% parejo en todo regala la quinta parte de lo que dejan los monitores. Por eso los puntos
  dependen del margen de cada producto, y el cliente ve el número en cada ficha sin ver el margen.

---

## 1. Las reglas (lo que ve el cliente)

**1 punto = $1.** Se elige así y no "1 punto = $10" porque 300 puntos por una compra se sienten como algo, 30 no.

| Qué | Regla | Por qué |
|---|---|---|
| **Ganar** | Cada producto dice en su ficha **"Suma N puntos"** | Simple para el cliente; el POS hace la cuenta por dentro |
| — servicio técnico | **2%** del precio (ej. mantenimiento $40.000 → 800 puntos) | Margen 100%: es lo que más conviene que vuelva |
| — margen ≥ 20% | **1%** | |
| — margen 10–20% | **0,5%** | |
| — margen < 10%, sin costo, oferta, liquidación o mayorista | **0,25%** (monitor de $85.000 → 212) | Nunca 0: un monitor que no da nada se siente como castigo. Pero no se regala el margen |
| **Bono de bienvenida** | **1.000 puntos**, pero se acreditan **recién con la primera compra de $10.000 o más** | Una cuenta falsa no gana nada |
| **Cumpleaños** | **1.000 puntos** una vez al año, solo con cuenta de 60+ días y al menos 1 compra | Nadie se cambia la fecha para cobrar dos veces |
| **Canjear** | Desde **2.000 puntos**, en compras de **$10.000 o más** | |
| — tope por compra | El canje no puede pasar del **10% del total** **ni del 50% de la utilidad de esa venta** (lo calcula el servidor) | **Esta es la regla que hace imposible perder plata en una venta.** El cliente solo ve "en esta compra puedes usar hasta $X" |
| **Puntos pendientes** | Los ganados quedan "por confirmar" **10 días** | Si se devuelve o se anula, se borran antes de que se puedan usar |
| **Vencimiento** | 12 meses desde que se ganaron (los más viejos primero); aviso por correo 30 días antes | El saldo no crece para siempre |
| **No son plata** | No se cambian por efectivo, no se transfieren, no aplican en mayorista | |

**Lo que cuesta, en el peor caso** (con los números de arriba, si TODOS los clientes estuvieran inscritos y canjearan
todo): unos **$67.000 cada 90 días ≈ $22.000 al mes**, el 2,4% de la utilidad. Con lo normal en programas así (30–50%
inscritos, 60% canjea) son **$5.000 a $7.000 al mes**. Y ninguna venta puede quedar en pérdida por el tope del 50%.

---

## 2. La cuenta y el identificador único

- Cada cliente tiene una **cuenta Sevelin** con un código **SEV-XXXXX** (5 letras y números sin 0/O ni 1/I, más un
  dígito verificador: un error de tipeo no cae en la cuenta de otro).
- La cuenta guarda **teléfono** (obligatorio, normalizado a +569…, **único**), **RUT** (opcional, con dígito
  verificador validado, **único**), nombre, correo y fecha de nacimiento (opcional, para el cumpleaños).
- **En la web es automático:** se crea al registrarse en sevelin.cl (la tabla `perfiles_clientes` ya existe, con
  consentimiento de privacidad y de marketing). Cada compra con la sesión iniciada suma sola.
- **En el local:** el cliente dice **su teléfono o su RUT**. El POS muestra la cuenta con el nombre a medias
  ("Carlos S.", "+569 ••• 0828") para confirmar que es él, y los puntos van ahí. Si no tiene cuenta, la caja la crea en
  10 segundos (teléfono + nombre + "el cliente aceptó"), y le queda el SEV-XXXXX.

---

## 3. Auditoría: cómo se podría abusar y cómo se cierra

| # | Abuso posible | Qué pasa si no se cierra | Cómo se cierra |
|---|---|---|---|
| 1 | **Robar puntos dictando el teléfono de otro** | Cualquiera que sepa tu número gasta tus puntos | **Sumar** pide solo teléfono/RUT (regalarle puntos a otro no le quita nada a nadie). **Canjear** pide además el **código de canje**: 6 números que el cliente ve en su cuenta de sevelin.cl, que duran 10 minutos. Sin cuenta web, se canjea con un **PIN de 4 números** que el cliente elige al inscribirse en la caja |
| 2 | **Un trabajador carga a su propia cuenta las ventas de clientes que no dieron su teléfono** | Es el abuso más probable en un negocio chico, y el más silencioso | (a) Las cuentas del personal se marcan y **no suman**. (b) Los puntos se asignan **solo al cobrar**, no después (el admin puede corregir dentro de 24 horas, y queda registrado quién). (c) **Alerta** al dueño si una cuenta suma en más de 3 ventas en un día o más de 10 en un mes |
| 3 | **Cuentas falsas para el bono de bienvenida** | Mil cuentas = mil bonos | El bono se paga solo con la **primera compra de $10.000 o más**, y un teléfono/RUT = una cuenta |
| 4 | **Comprar, canjear y devolver** | Se queda con el descuento | Al anular o devolver, se revierten los puntos ganados **y** se devuelven los canjeados descontados del reembolso. Los ganados quedan 10 días pendientes |
| 5 | **Partir una compra grande en muchas chicas** para canjear varias veces | Pasar el tope del 10% | El tope es por compra y además hay **un canje por día por cuenta** |
| 6 | **Acumular a lo loco** (un revendedor que compra mucho) | Saldo enorme que un día se cobra junto | Tope de **20.000 puntos ganados por compra** y **50.000 por mes**; mayorista **no suma**; vencen a los 12 meses |
| 7 | **Canjear en productos sin margen** | Perder plata en esa venta | El tope del **50% de la utilidad de la venta** lo calcula el servidor con los costos reales. Productos sin costo cargado: el canje no pasa del 5% |
| 8 | **Que cambien las reglas y alguien reclame** | Conflicto con un cliente o el SERNAC | **Bases publicadas** en sevelin.cl/puntos (Ley 19.496: las condiciones de una promoción tienen que estar informadas). Si cambian, se avisa con 30 días y los puntos ya ganados se respetan |
| 9 | **Datos personales** (RUT, teléfono, cumpleaños) | Multas de la Ley 21.719 | Consentimiento explícito al inscribirse, el RUT es opcional, y las solicitudes de acceso o borrado van por el formulario ARCO que ya existe (`solicitudes_arco`). Borrar la cuenta borra el saldo |
| 10 | **Que el dueño no sepa cuánto debe en puntos** | Una deuda que no se ve | Finanzas muestra **"Puntos por canjear: $X"** como deuda, y cuántos vencen este mes |
| 11 | **El canje y el IVA** | Boleta mal hecha | El canje es un **descuento** en la venta (baja la base del IVA), no un medio de pago. Se anota como descuento con motivo "Puntos" |
| 12 | **Un error de la caja suma de más** | Puntos regalados | Todo movimiento queda en un registro (quién, cuándo, venta) que no se borra; el ajuste es otro movimiento, nunca una edición |

---

## 4. Recordatorio de mantenimiento por correo

- **Cuándo:** **6 meses** después de un mantenimiento y **12 meses** después de un formateo, a las cuentas que dieron
  correo y aceptaron recibirlos (`consentimiento_marketing`). Un solo correo por servicio, más uno de repaso a los 30
  días si no respondió. Nunca más que eso.
- **Qué dice:** "Hace 6 meses le hicimos mantenimiento a tu notebook. ¿Cómo anda? Haz el test de 1 minuto" → enlace a
  **/diagnostico** (ya está publicado, ver abajo) con el test que corresponde, y "Agendar por WhatsApp".
- **No es** el aviso de garantía vencida que se descartó: ofrece un servicio, no habla de la garantía.
- **Necesita:** saber quién se hizo qué servicio y su correo. Por eso va **junto con los puntos**: la misma cuenta lo
  sabe.
- Los correos ya salen por Resend desde la tienda (confirmación de pedido, carrito abandonado, por llegar), así que es
  un cron más, como el de Destacados.

### El test "¿Tu equipo necesita servicio técnico?" — **ya está hecho y publicado (19-10-2026)**

sevelin.cl/diagnostico tiene cuatro tests: **mantenimiento** (7 preguntas), **lento o con virus / formateo** (6),
**pantalla de celular** (3 y el modelo) y **no carga bien / puerto** (4 y el modelo). Una pregunta a la vez. El
resultado da la **probabilidad** (orientativa, de 5% a 95%), **por qué**, el **servicio que corresponde con su
precio**, y **"Agendar por WhatsApp"** con el día, el horario y todas las respuestas ya escritas. Si en el test de carga
dice que con otro cable sí carga, le avisa que probablemente es el cable y lo manda a buscar un cargador. Se llega
desde una lámina de la vitrina del inicio, el bloque de servicios ("¿Lo necesito? Haz el test") y la ficha de cada
servicio con test.

---

## 5. Plan Equipo Sano (mantenimiento anual)

| | Propuesta |
|---|---|
| **Qué incluye** | **2 mantenimientos preventivos en 12 meses** (uno al comprar, otro a los 6 meses) + **10% de descuento en formateo** mientras dure + el recordatorio del segundo |
| **Precio** | **$70.000** (dos sueltos son $80.000: ahorra $10.000) — **falta tu OK en el precio** |
| **Margen** | 100% igual que el servicio suelto. Y si el cliente no viene al segundo, el servicio igual se le debe hasta el día 12 |
| **Puntos** | Suma como servicio (2% = 1.400 puntos) |
| **Cómo se lleva** | Un producto de servicio "Plan Equipo Sano" en el POS. Al venderlo, la cuenta del cliente queda con **1 mantenimiento a favor**, que vence a los 12 meses y que la caja descuenta al usarlo (como un abono). Finanzas lo muestra como servicio por entregar |
| **En la tienda** | Una tarjeta en el bloque de servicios del inicio y en el resultado del test de mantenimiento ("Con el plan te sale $35.000 cada uno") |

---

## 6. Orden de construcción propuesto (Opus · Extra)

1. **Cuentas y código SEV** en la base de la tienda (migración con RLS, el chequeo de siempre), y la búsqueda por
   teléfono/RUT desde el POS (el POS ya lee la tienda con `dbWeb`).
2. **"Suma N puntos"**: el POS calcula la tasa de cada producto con su costo y la manda en el sync; la ficha la muestra.
3. **Sumar en la caja** (teléfono o RUT al cobrar, al lado del "¿De dónde vino?") y **sumar solo en la web**.
4. **Canjear** con el código de la cuenta o el PIN, con los dos topes en el servidor.
5. **Mi cuenta → Mis puntos** (saldo, pendientes, vencen pronto, historial), las **bases en /puntos** y el cartel con QR
   para el mesón.
6. **Alertas y deuda** en el POS (trabajador que carga mucho a una cuenta, puntos por canjear en Finanzas).
7. **Recordatorio de mantenimiento** y **Plan Equipo Sano**.

Antes de empezar, del dueño: **OK al precio del plan ($70.000)**, y si los números de la tabla 1 le parecen bien.
