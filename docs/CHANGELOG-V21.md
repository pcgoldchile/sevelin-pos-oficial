# CHANGELOG V21 — 20 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v21.

Protección por inactividad y ventana de gracia del PIN para Finanzas.

---

## 1. El problema

Finanzas (que incluye el sub-panel Balance) pedía el PIN de admin al entrar y lo revocaba de inmediato
al salir, sin más. Eso dejaba dos huecos:

- Si alguien dejaba el navegador abierto en Finanzas y se alejaba, la vista quedaba expuesta
  indefinidamente (montos, costos, ajustes de saldo) sin que nada la cerrara sola.
- Si el admin salía un segundo a otra pestaña del POS y volvía, tenía que teclear el PIN de nuevo
  aunque acabara de autenticarse.

No existe todavía una vista de "Configuración" separada en el frontend (solo `view-finanzas`, admin-only,
con las sub-pestañas Historial/Balance/Gastos/Gastos Fijos); el mecanismo quedó armado de forma genérica
para que, si se agrega una vista sensible más adelante, sea una línea de código sumarla.

## 2. Fix (`js/finanzas-gate.js`)

- **Auto-redirección por inactividad (60s):** mientras `view-finanzas` está activa, un listener de
  `mousemove`/`click`/`keydown`/`touchstart` reinicia un `setTimeout` de 60s. Si se cumple sin ninguna
  interacción, se simula un clic en el botón "POS" del menú (reutiliza la navegación real de
  `config.js`, sin duplicarla) y se avisa con `showToast`.
- **Ventana de gracia del PIN (60s):** se reemplazó el booleano `finanzasDesbloqueada` (permiso de un
  solo uso) por un timestamp, `finanzasUltimaActividad`. Se fija al validar el PIN y en cada interacción
  mientras la vista está activa. El interceptor de clic en "Finanzas" deja pasar sin pedir PIN si
  `Date.now() - finanzasUltimaActividad < 60000`.
- Ambas reglas comparten el mismo timestamp a propósito: si al usuario lo expulsó el timer de
  inactividad, esa misma marca ya tiene ≥60s, así que no hay una "puerta trasera" que le regale acceso
  al reintentar entrar de inmediato — vuelve a pedir PIN. Si en cambio salió por su cuenta con actividad
  reciente, sí entra directo dentro de la ventana de gracia.
- La vigilancia (listeners + timer) se activa/desactiva con el evento `pos:vista-activa` que ya emite
  `config.js` al cambiar de vista, y se apaga también al cerrar sesión.

## 3. Qué NO cambió

- No se tocó `config.js` ni la navegación real entre vistas: el módulo sigue interceptando el clic del
  botón "Finanzas" en fase de captura, igual que antes.
- No se creó una vista "Configuración": no existía en el código: el mecanismo se escribió genérico
  (arranca/para con cualquier vista llamada `view-finanzas`) para poder sumarla después sin rehacer esto.
- Sin cambios de backend, SQL ni Tailwind.

## 4. Pruebas

- `node --check` en `js/finanzas-gate.js` y en el resto de `js/*.js`: sin errores.
- Chequeo de funciones globales duplicadas: vacío.
- Chequeo de ids duplicados en `index.html`: vacío (no se tocó `index.html`).
- jsdom: se concatenaron los 26 `js/*.js` relevantes en el orden real de `index.html` (con timers y
  `Date.now()` mockeados para controlar el paso del tiempo sin esperar 60s reales) y se simuló:
  1. Primer intento a Finanzas → pide PIN; PIN correcto → entra y arranca la vigilancia.
  2. Interacción antes de los 60s reinicia el contador (sigue dentro a los 70s totales).
  3. 60s sin interacción → expulsa al POS.
  4. Reintentar entrar justo después del auto-logout → vuelve a pedir PIN (sin ventana de gracia).
  5. Autenticar, salir voluntariamente con actividad reciente, volver a los 30s → entra sin pedir PIN.
  6. Volver a salir y esperar más de 60s → vuelve a pedir PIN.
  Los 15 checks pasaron.
- No se probó visualmente (sin navegador real en este entorno): el `showToast` al expulsar y el cierre
  del modal del gate se razonan por código, no se vieron renderizados.

## 5. Despliegue

Solo frontend: `js/finanzas-gate.js`. Sin migración SQL, sin cambios de Tailwind, sin cambios de backend.
