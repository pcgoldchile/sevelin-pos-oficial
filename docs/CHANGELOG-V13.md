# CHANGELOG V13 — 18 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v13.

Completa el **punto 4 del INSTRUCCIONES.md**: apertura, caja chica y arqueo integrados en el POS.

---

## 1. Ciclo de caja en el POS (punto 4)

Se integró la gestión de caja directamente en la pantalla del POS (`js/caja.js`, ya existente,
conectado y depurado en esta versión):

- **Barra de estado de caja** en la parte superior del POS: muestra si hay un turno abierto, el fondo
  y los movimientos, con botones para abrir / movimiento / cerrar según el estado.
- **Apertura:** modal que pide el fondo inicial en efectivo. Sin caja abierta, **el botón de cobrar se
  bloquea** (visualmente y al hacer clic), y al intentar cobrar se ofrece abrir la caja.
- **Caja chica:** modal de movimiento rápido (ingreso / egreso) con monto y concepto, que afecta el
  efectivo esperado del turno.
- **Cierre con arqueo ciego:** el cajero cuenta el efectivo y lo escribe; el sistema calcula en el
  servidor el esperado (fondo + ventas en efectivo del turno + ingresos − egresos) y revela la
  diferencia (cuadra / falta / sobra) al confirmar. El turno queda cerrado y las cifras congeladas.
- Cada venta se vincula al turno de caja abierto (`caja_id`), para que el arqueo sume solo las ventas
  en efectivo de ese turno.

## 2. Bug corregido: colisión de IDs entre el arqueo de Finanzas y el de caja del POS

El módulo de caja del POS y el arqueo histórico del módulo Finanzas **compartían los mismos ids de
modal** (`modalAbrirCaja`, `modalCerrarCaja`) y de botón (`btnAbrirCaja`, `btnCerrarCaja`). Como los
ids se repetían en el HTML, `getElementById` siempre tomaba el primero (el de Finanzas) y los del POS
quedaban muertos.

**Solución:** los del POS se renombraron a `modalAperturaPos`, `modalCierrePos`, `btnAbrirCajaPos` y
`btnCerrarCajaPos` (en el HTML y en `js/caja.js`). El arqueo de Finanzas conserva sus ids. Se
verificó que no quedan ids duplicados relacionados con caja ni colisiones de funciones globales.

> Pendiente menor no relacionado: el id `kpiUtilidadNeta` aparece duplicado entre dos vistas de KPI
> (balance e historial). Es preexistente, no afecta a caja, y se deja anotado para una limpieza aparte.

## 3. Pruebas

12 comprobaciones (jsdom): bloqueo del cobro sin caja, apertura, habilitación del cobro, movimiento de
caja chica, cierre con arqueo, y re-bloqueo tras cerrar. Todas en verde. Backend de caja ya verificado
en la v12 (16 pruebas). Sin colisiones de funciones. Tailwind recompilado.

## 4. Qué queda del INSTRUCCIONES.md

- **Punto 3 (UI):** selector retiro/despacho en el modal de cobro.
- **Punto 5 (UI):** orden ASC/DESC y filtro de estado de envío en el Historial.

El backend de ambos ya está probado (v12); falta la capa visual.

## 5. Despliegue

Requiere `sql/17-caja-diaria-y-despacho.sql` corrida (de la v12). Solo frontend en esta versión:
`index.html`, `js/caja.js`, `js/pos.js`, `css/styles.css` (Tailwind recompilado).

Prueba: entra al POS sin caja (el cobro debe estar bloqueado), abre caja con un fondo, registra un
egreso, intenta cobrar (ahora sí), y cierra la caja contando el efectivo.
