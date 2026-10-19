# v167 — Puntos Sevelin en la caja (19-10-2026)

Pedido del dueño: *"construir los puntos primero"*, con el diseño auditado de
`docs/fidelizacion/DISENO-PUNTOS-SEVELIN.md` ("ajústamelo según tú mejor creas… que nunca salgamos perdiendo") y su
pedido de que el cliente se identifique con celular, RUT o su código único, y que el código de canje le llegue por
WhatsApp.

**Dónde vive:** cuentas y libro de movimientos en la base de la tienda (`sevelin-tienda/supabase/47`); el POS las lee y
escribe desde el servidor (`dbWeb`). En las ventas del POS queda `puntos_cuenta_id`, `puntos_ganados` y
`puntos_canjeados` (`sql/106`). Las reglas están duplicadas a propósito en `api/index.js` (bloque PUNTOS) y en
`sevelin-tienda/src/lib/puntos-reglas.ts`: si cambia una, se cambia en las dos.

**En el cobro** (`js/puntos-caja.js`, recuadro "⭐ Puntos Sevelin" del modal Confirmar Pago, solo en venta nueva):
- Buscar por celular, RUT o código SEV-XXXXX (con dígito verificador). Se ve el nombre y el celular a medias para
  confirmar que es la persona, su saldo disponible, por confirmar y lo que vence este mes.
- Sin cuenta: "Crear cuenta" en 10 segundos (nombre, celular, correo opcional y "el cliente acepta"). Con el correo,
  cuando el cliente entra a sevelin.cl con ese mismo correo, sus puntos se unen solos.
- **Usar puntos:** el servidor dice cuánto se puede en este carrito; "📲 Mandar el código a su WhatsApp" abre WhatsApp al
  celular DE LA CUENTA con un código de 6 números (10 minutos, 5 intentos); el cajero lo escribe y el total baja.

**Reglas (todas en el servidor):**
- Suma: servicio técnico 2%, margen ≥ 20% 1%, 10–20% 0,5%, menos o sin costo 0,25%, mayorista 0. Sobre lo pagado.
  Pendiente 10 días, vence a los 12 meses. Tope 20.000 por compra y 50.000 por mes. Cuentas del personal no suman.
- Bono de bienvenida 1.000 con la primera compra de $10.000 o más (una vez).
- Canje: desde 2.000 disponibles, en compras de $10.000 o más, un canje por día, tope = lo menor entre 10% del total y
  50% de la utilidad de la venta (sin costo cargado, 5%). Va como descuento (baja la base del IVA).
- El canje se reserva antes de guardar la venta y se anula si la venta falla. Devolución total anula lo ganado y el
  canje; parcial descuenta en proporción; borrar la venta anula todo.
- `GET /api/puntos/resumen` (admin): cuentas, puntos por canjear (la deuda) y alertas (más de 3 compras en un día o
  10 en un mes en la misma cuenta).

**Probado:** `node scripts/prueba-puntos.js` (servidor real + doble de Supabase): inscripción, celular repetido 409, sin
consentimiento 400; venta de $60.000 (mouse al 1% + mantenimiento al 2%) suma 1.000 + bono 1.000 pendientes; tope de
un monitor de margen bajo = $2.500 (50% de su utilidad); compra chica sin canje; código por WhatsApp; código malo
rechazado; canje de $2.500 con el total y lo ganado correctos; segundo canje el mismo día rechazado; devolución total
anula. En la maqueta: buscar, usar puntos, código malo no aplica, código bueno baja el total de $55.000 a $50.500 y la
venta lleva `{cuenta_id, canjear, codigo}`.

**No probado:** una venta real en producción (falta la prueba del dueño con su celular). Lo público en sevelin.cl
("Suma N puntos" en la ficha, cierres de redes y bases oficiales) queda apagado hasta esa prueba.
