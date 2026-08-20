# CHANGELOG V17 — 20 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v17.

Fix menor: `id` duplicado `kpiUtilidadNeta` entre las vistas de Balance e Historial (backlog conocido
desde V13).

---

## 1. Fix: id duplicado `kpiUtilidadNeta`

El KPI "Utilidad Neta" de Balance y el KPI "✅ Utilidad Neta POS" de Historial compartían el mismo
`id="kpiUtilidadNeta"` en `index.html`. `getElementById` siempre toma el primero (Balance), así que el
de Historial quedaba huérfano en el DOM aunque `historial.js` lo actualizaba en memoria sin error
visible.

Se renombró el `id` del KPI de Historial a `kpiUtilidadNetaPos` (coincide con su etiqueta visual). El de
Balance no se tocó.

---

## 2. Detalles técnicos

- `index.html`: `id="kpiUtilidadNeta"` → `id="kpiUtilidadNetaPos"` en la tarjeta "✅ Utilidad Neta POS"
  del Historial (la de Balance mantiene `kpiUtilidadNeta`).
- `js/historial.js`: `elKpiUtilidadNeta` ahora apunta a `getElementById('kpiUtilidadNetaPos')`.
- `js/balance.js` no requirió cambios (usa `kpiUtilidadNeta`, que sigue siendo único).

---

## 3. Pruebas

- Chequeo de ids duplicados en `index.html`: vacío.
- Chequeo de funciones globales duplicadas en `js/*.js`: vacío.
- `node --check` en `js/historial.js` y `js/balance.js`: sin errores.
- No se probó visualmente (sin navegador real en este entorno); el cambio es solo de `id`/selector, sin
  lógica nueva.

---

## 4. Despliegue

Solo frontend: `index.html`, `js/historial.js`. Sin migración, sin cambios de Tailwind.
