# CHANGELOG V15 — 19 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v15.

Dos frentes: se corrigió el bug de "cargar lote" y se agregó la función de gastos programados
(pendientes / cuotas).

---

## 1. Bug de lotes: "doy a cargar lote y no pasa nada"

**Síntoma.** En el modal de producto, al pulsar "Cargar lote" no ocurría nada: ni el lote se creaba
ni aparecía un aviso de error.

**Diagnóstico.** En las pruebas el flujo funcionaba, así que el fallo era del entorno real y, sobre
todo, **no había feedback**: si algo fallaba, la función se quedaba muda. La causa más probable es
registrar un lote sobre un producto cuyo `usa_lotes` está activado en la interfaz pero **no guardado**
en la base (se marcó la casilla y no se pulsó "Guardar Producto"); el backend entonces rechaza la
carga, pero el error no se mostraba.

**Solución** (`js/lotes.js`, `agregarLoteDesdeModal`):
- Se envolvió todo en un try/catch amplio: ante **cualquier** fallo, esperado o no, ahora **siempre**
  se muestra un toast con el motivo y se registra el error en consola.
- Se detecta el caso "producto con lotes activados pero sin guardar" y se avisa claro:
  *"Activa los lotes y pulsa Guardar Producto antes de cargar capas"*.
- Defensa ante helpers ausentes (`fmtCLP`, `cargarProductos`, `productsList`).

---

## 2. Gastos programados / cuotas (tarjeta de crédito)

Nueva función en la pestaña **Gastos**, botón **"🗓️ Gastos pendientes"**. Registra hoy una compra que
se pagará en el futuro; al llegar su fecha se carga sola a Gastos.

- **Caso simple:** una compra con tarjeta de crédito que se paga el mes siguiente. Queda pendiente con
  su fecha de vencimiento.
- **Cuotas:** se indica el monto total y el número de cuotas, y el sistema crea N gastos programados,
  uno por mes desde la primera fecha. El reparto cuadra al peso (el último ajusta el redondeo).
- **Materialización automática:** al abrir Finanzas, los programados cuya fecha ya venció se convierten
  en compras reales (`estado: aplicado`, vinculadas a la compra creada). No usa cron: con revisar al
  entrar basta para este negocio.
- Los pendientes se listan ordenados por fecha; cada uno se puede cancelar.

**Backend:** migración `sql/18-gastos-programados.sql` (tabla `gastos_programados`). Endpoints:
`GET /api/gastos-programados`, `POST /api/gastos-programados` (soporta cuotas),
`DELETE /api/gastos-programados/:id` (cancelar), `POST /api/gastos-programados/procesar-vencidos`.
Helper `sumarMeses` para repartir las cuotas.

**Frontend:** `js/gastos-programados.js` (reutiliza `clasificacionesList` de compras.js y `escHtml`).
Se corrigió un `ReferenceError`: el módulo usaba `fechaHoyChile` (que solo existe en el backend); en el
frontend el helper es `todayISO()`.

---

## 3. Pruebas

- Lotes: detección de producto sin guardar y feedback garantizado ante error del backend.
- Gastos programados (backend): alta simple, cuotas que suman el total exacto y se reparten mes a mes,
  validaciones, materialización de vencidos, cancelar. (Un caso de doble-cancelación falla solo en el
  mock, no en el código real: el endpoint filtra por `estado='pendiente'`.)
- Gastos programados (frontend): abrir, aviso de cuotas en vivo, alta en cuotas, listado ordenado.
- Sin colisiones de funciones. Tailwind recompilado.

---

## 4. Despliegue

Requiere `sql/18-gastos-programados.sql` corrida en Supabase. Frontend: `index.html`, `js/lotes.js`,
`js/gastos-programados.js`, `js/api.js`, `css/styles.css` (Tailwind recompilado). Backend: `api/index.js`.
