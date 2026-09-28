# v96 — Entregar una OT con la clave de administrador (sin QR ni carnet)

**Fecha:** 28-09-2026
**Migración:** `sql/68-entrega-ot-clave-admin.sql` (aplicada con la CLI el 28-09-2026, verificada:
columna `retiro_verificacion_motivo` + los dos CHECK). No crea tablas; RLS sin cambios.
**Pedido del dueño:** *"Agregar una tercera verificación 'Forzar con clave de admin' para cuando no hay
ninguna de las dos: pide el PIN de administrador (validado en el servidor, con el freno de intentos)
aunque la sesión sea de trabajador, y un motivo obligatorio que queda guardado en la OT y se ve en el
comprobante."*

> v95 fue el freno de PIN compartido (sql/67). No tiene CHANGELOG propio: está en el SNAPSHOT.

---

## 1. La regla

Desde sql/47 (v61) la entrega exigía una de dos pruebas: el **QR vigente** de esa orden, o el **carnet
del titular** con el mismo RUT registrado. Si el cliente perdió el QR y la orden no tenía RUT, el equipo
era imposible de entregar. Ahora hay una tercera:

| Verificación | Qué exige el servidor |
|---|---|
| `QR` | El código escaneado es el vigente de esa OT y no se usó (sin cambios) |
| `CARNET` | La OT tiene RUT del titular y coincide con el de quien retira (sin cambios) |
| `ADMIN` (nuevo) | **Motivo** de 10 a 300 letras + **PIN de administrador** correcto |

- El PIN se pide **siempre**, también con sesión de admin (es una reconfirmación, igual que Finanzas).
- Se valida en el servidor con `validarPinAdmin()`, el mismo freno por IP del login y de
  `/api/verificar-pin`: 5 fallos → 1 minuto bloqueado, compartido entre instancias (sql/67).
- **El motivo se valida antes que el PIN**, así un formulario incompleto no gasta intentos del freno.
- Nombre y RUT de quien retira **siguen siendo obligatorios**, y el QR queda usado igual que siempre.
- El PIN **no se guarda** en ninguna parte (no va a la orden ni a ningún log).
- **Las fases obligatorias pendientes (sql/66) no cambian:** si faltan, el trabajador sigue sin poder
  entregar aunque traiga el PIN de admin. Son dos reglas distintas.

## 2. Código

- `api/index.js`: `exigirPinAdmin` se partió en `validarPinAdmin(req, pin)` (reutilizable, devuelve
  `null` o `{status, mensaje}`) + el middleware de siempre. `POST /api/ot/:id/entrega` acepta
  `verificacion: 'ADMIN'` con `pin_admin` y `verificacion_motivo`; guarda
  `retiro_verificacion_motivo` (espacios normalizados). El largo se cuenta en caracteres reales
  (`Array.from`), igual que `char_length` en la base: con `.length` un emoji contaba 2.
- `index.html`: tercera opción "🔑 Forzar con clave de admin" en el modal de entrega, con PIN
  (campo de contraseña) y motivo.
- `js/ot.js`: muestra/oculta los campos, valida antes de enviar, borra el PIN al cerrar el modal y
  tras un rechazo.
- `js/print.js`: `textoVerificacionRetiro(ot)` nuevo. El comprobante entregado trae un bloque
  **"Retiro"** (quién retiró y cómo se verificó; con ADMIN, el motivo). El detalle de la orden usa el
  mismo texto.
- `css/styles.css`: los **radio** de `.check-item` no tenían tamaño (solo los checkbox) y heredaban el
  alto de 44 px de los campos de texto: "Trae el QR" y "Carnet" ya se veían deformes antes de este
  cambio. Corregido en la misma regla.
- `scripts/maqueta-pos.js`: una OT pendiente de ejemplo y una entrega simulada (el PIN `mal` se
  rechaza), para probar el Check-Out en la maqueta.

## 3. Cómo se probó

- **Backend (doble de Supabase en memoria + `app.listen(0)`), 17 casos:** sin motivo → 400 sin gastar
  intentos · motivo corto → 400 · sin PIN → 403 · PIN de trabajador → 403 y la OT sigue pendiente ·
  PIN de admin desde sesión de **trabajador** → 200, OT `ENTREGADO`/`ADMIN`, motivo guardado, QR usado,
  PIN no guardado · 5 PIN malos → el 6.º da 429 aunque sea el bueno · QR y CARNET siguen igual (CARNET
  no guarda motivo) · verificación desconocida → 400 · fases pendientes siguen bloqueando al
  trabajador · `/api/verificar-pin` sigue dando 200/403. El doble replica los CHECK de sql/68.
- **Maqueta (sesión de trabajador):** modal con las tres opciones, PIN malo → aviso "PIN de
  administrador incorrecto", la sesión NO se cierra y el PIN se borra; PIN bueno → entregada; el
  comprobante y el detalle muestran el motivo.
- **Base real:** solo la migración (columna + CHECK verificados con una consulta). **No se hizo una
  entrega real**: la primera OT que se fuerce en el local es la prueba de verdad.

## 4. Visto de paso, NO tocado

- **Forzar la entrega con fases obligatorias pendientes no tiene pantalla.** El servidor pide
  `entrega_forzada_motivo` (sql/66) pero el modal nunca lo envía: el admin recibe "Para entregar
  igual, escribe por qué" y no hay dónde escribirlo. Pendiente de decidir con el dueño.
- En el detalle de una OT entregada, el recuadro del QR queda como una barra blanca vacía.
