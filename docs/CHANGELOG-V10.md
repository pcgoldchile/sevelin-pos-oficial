# CHANGELOG V10 — 15 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v10.

Esta versión implementa seis mejoras al módulo de Finanzas: seguridad de acceso, edición manual de
saldos, resguardo dinámico con checklist, métrica de mercadería, recálculo de canales al editar
compras, y gestión de aportes de capital.

**Migración de base de datos:** `sql/16-ajustes-saldo-y-gasto-fijo.sql` (idempotente).

---

## 1. Gate de PIN al entrar a Finanzas (req. 1)

Finanzas ahora pide el **PIN de administrador cada vez que se entra**, aunque la sesión ya esté
abierta y aunque se acabe de salir y volver. Si el usuario navega a otro módulo y regresa, se pide de
nuevo.

- **Backend:** `POST /api/verificar-pin` (reutiliza `exigirPinAdmin`, con freno anti-fuerza-bruta).
  El PIN se valida en el servidor, nunca en el navegador.
- **Frontend:** `js/finanzas-gate.js` intercepta el clic en "Finanzas" en fase de captura (antes del
  listener de navegación de config.js). Sin permiso, muestra el gate y bloquea la vista. El permiso es
  de un solo uso: se revoca al salir de Finanzas y al cerrar sesión.

---

## 2. Grid de 4 tarjetas (req. 2)

La franja superior se reorganizó en 4 tarjetas de igual tamaño, responsivas:

`💵 Efectivo · Caja chica` | `🏦 Banco · Cuentas` | `💰 Saldo total disponible` | `🛡️ Resguardo de caja`

Los botones de acción rápida (`🔄 Traspaso interno`, `💼 Aportes de capital`) van en una fila limpia
bajo las tarjetas.

---

## 3. Edición manual de saldos con justificación e historial (req. 3)

- **Lápiz de edición** en las tarjetas Efectivo y Banco. La tarjeta **Total NO lo lleva**: se calcula
  como efectivo + banco.
- Al presionarlo, abre un modal con dos pestañas: **Ajustar** e **Historial de ajustes**.
- La **justificación es obligatoria** (validada en frontend y backend; mínimo 3 caracteres).
- El ajuste guarda un **delta**, no reescribe el saldo: el saldo sigue siendo suma de movimientos
  reales + ajustes. El delta se suma al canal en `/finanzas/saldos`.
- **Backend:** `POST /api/finanzas/ajuste-saldo`, `GET /api/finanzas/ajustes-saldo`. Tabla
  `ajustes_saldo` (migración 16).

---

## 4. Resguardo dinámico, checklist y mercadería (req. 4)

- **Resguardo dinámico:** la tarjeta de Resguardo muestra la suma de los **gastos fijos pendientes del
  mes** (los que aún no se han pagado), no un número fijo.
- **Checklist de gastos fijos:** botón `📋 Gastos fijos del mes` que abre un modal con cada gasto fijo
  marcado como ✅ pagado o ⬜ pendiente, y un **cuadre en tiempo real** que compara el saldo total
  disponible contra lo pendiente, mostrando holgura o déficit.
  - **Backend:** `GET /api/finanzas/gastos-fijos-mes`. "Pagado" = existe una compra del mes vinculada
    al gasto fijo (`gasto_fijo_id`, migración 16) o cuya descripción empieza con "Gasto fijo: <nombre>".
- **Métrica de mercadería:** en el Balance, el gasto en mercadería (grupo INVENTARIO) se resalta como
  bloque destacado 📦, en tiempo real según el período seleccionado.

---

## 5. Recálculo de canales al editar/eliminar compras (req. 5)

Los saldos por canal se **derivan** del método de pago de cada compra: no hay un saldo almacenado que
ajustar, se recalcula solo. Por eso, al editar una compra que **cambia el método de pago o el monto**,
o al eliminarla, ahora aparece un pop-up que **explica el efecto en los saldos** y pide confirmación
antes de guardar. Así el movimiento de dinero entre Efectivo y Banco es una decisión consciente.

---

## 6. Gestión de aportes de capital (req. 6)

- Botón `💼 Aportes de capital` que abre un modal con el **historial completo** de aportes, un
  formulario para **agregar** uno nuevo, y un botón para **borrar** cada uno.
- Al borrar, un pop-up explica que el monto **se descontará del saldo** del canal correspondiente (el
  aporte deja de contar), y pide el PIN de administrador (el endpoint lo exige).
- Reutiliza los endpoints existentes de inyecciones (`GET/POST/DELETE /api/inyecciones`).

---

## 7. Seguridad

Todo el código nuevo respeta las reglas v7: cada dato de usuario (motivo del ajuste, descripción del
aporte, nombre del gasto fijo) se interpola con `escHtml`. Las operaciones sensibles pasan por el
backend con `auth(true)` y, donde corresponde, PIN de admin.

---

## 8. Pruebas de esta entrega

- Backend (doble de Supabase): gate de PIN, ajuste con justificación obligatoria, checklist de fijos.
- Frontend (jsdom): gate completo (bloquea/rechaza/permite/re-pide), grid de 4 tarjetas, modal de
  ajuste con historial, checklist con cuadre, aportes (listar/agregar/borrar).
- SQL 16 validado con el parser real de PostgreSQL.
- Chequeo anti-colisión de funciones globales: sin duplicados. Sin IDs huérfanos nuevos.

Total: 30+ comprobaciones, todas en verde.

---

## 9. Orden de despliegue

1. **Corre `sql/16-ajustes-saldo-y-gasto-fijo.sql`** en Supabase → SQL Editor (idempotente).
2. Despliega el backend (`api/index.js`) y verifica `GET /api/health`.
3. Despliega el frontend (`css/tailwind.css` recompilado; nuevos: `js/finanzas-gate.js`,
   `js/finanzas-ajustes.js`).
4. Prueba: entra a Finanzas (debe pedir PIN), ajusta un saldo con justificación, abre el checklist de
   fijos, registra y borra un aporte, y edita una compra cambiando su método de pago.
