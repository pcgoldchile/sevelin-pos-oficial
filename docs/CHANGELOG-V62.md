# CHANGELOG v62 — Gasto que no mueve el saldo + recordatorio del F29 (13-09-2026)

## Qué pidió el dueño
1. Al pagar un gasto fijo que **ya había pagado sin registrar** (y que ya cuadró con un reajuste de
   caja o banco), poder registrarlo **sin que vuelva a restar del saldo**.
2. Un **recordatorio del F29** en el POS.

## Qué se hizo

### `sql/49-gasto-sin-saldo-y-f29.sql` (aplicada en producción el 13-09-2026)
- `compras.afecta_saldo boolean not null default true`. Todas las compras existentes quedan igual.
- Tabla `f29_presentaciones` (una fila por período `AAAA-MM` que el dueño marca como presentado),
  con RLS activo y sin políticas (solo el backend).

### Backend (`api/index.js`)
- `sanearCompra`: acepta `afecta_saldo` **solo si viene en el body**. El modal normal de Gastos no lo
  manda, así que editar un gasto desde ahí no le devuelve el descuento.
- Dejan de restar los gastos con `afecta_saldo = false`: `/api/finanzas/saldos`, el efectivo esperado
  del arqueo y `cajaFisica` / `flujoLiquido` de `/api/balance`.
- **Siguen contando**: `totalGastos`, utilidad neta, Utilidades, el checklist del mes y la proyección
  (que usa los gastos reales para estimar el gasto típico).
- `GET /api/finanzas/f29-estado`: períodos desde `2026-08` sin marcar, con vencimiento el día 20 del
  mes siguiente (sábado → lunes 22, domingo → lunes 21; **no considera feriados**) y nivel
  `normal` / `pronto` (≤7 días) / `urgente` (≤2) / `atrasado`.
- `POST /api/finanzas/f29-presentado`: marca el período y, si hay monto y `registrar_gasto`, crea el
  gasto en la clasificación "Impuestos…" (proveedor SII). Marcar dos veces no duplica el gasto.
- `DELETE /api/finanzas/f29-presentado/:periodo`: desmarca (el gasto creado se queda; se borra en Gastos).

### Frontend
- Modal "Registrar pago" de gasto fijo: casilla **"Ya estaba descontado: no mover el saldo"**
  (arranca desmarcada cada vez).
- Listado de Gastos: marca **"⚖️ no mueve el saldo"** en esas filas.
- Header: botón **🧾 F29 …** al lado de la campana, solo si hay un período pendiente. Gris, ámbar a
  7 días, rojo con pulso a 2 días o atrasado. Abre un modal para marcarlo como presentado y registrar
  el pago. Se consulta al iniciar sesión y cada 30 minutos.

## Datos corregidos en producción (misma sesión, sin código)
- Sueldos Alejandro y Carlos: `gastos_fijos.dia_mes` 1 → **15**.
- Sueldo de Alejandro de septiembre (compras id 15): 08-09 Transferencia → **12-09 Efectivo**,
  vinculado al gasto fijo id 2. Mueve $100.000 de banco a efectivo en los saldos.
- Productos nuevos "por llegar" con llegada estimada **21-09-2026**: id 282 Cinta tapagoteras
  ($1.941 / $5.000, 2 u.) e id 283 Lámpara astronauta sentado ($4.921 / $10.000, 3 u.). Sin publicar.

## Cómo se probó
- Backend con el doble en memoria de Supabase: saldos antes/después, compra normal vs. sin saldo,
  PUT sin el campo conserva `false`, balance (`totalGastos` sí, `flujoLiquido` no), checklist,
  F29 (vencimiento 21-09 por domingo, gasto en Impuestos, sin duplicar, período inválido 400,
  desmarcar). **Todo OK.**
- Frontend con jsdom (scripts concatenados en orden): botón visible con clase urgente, modal, POST
  correcto, se oculta al marcar; pago de gasto fijo envía `afecta_saldo:false` y la casilla se
  resetea; marca en el listado. **Todo OK.**
- `node --check` en lo tocado, chequeo de funciones e ids duplicados: vacíos. No se agregaron clases
  de Tailwind (los estilos nuevos están en `css/styles.css`).
- **No verificado:** cómo se ve el botón en el header real (colores y espacio en pantallas chicas).
