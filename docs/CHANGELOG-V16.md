# CHANGELOG V16 — 19 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v16.

Buscador universal de ventas en el Historial: un solo campo que busca por producto, SKU, código de
barras, fecha, fecha y hora, o total, con sugerencias en vivo.

---

## 1. Buscador universal de ventas

El campo de búsqueda del Historial (antes solo por producto) ahora entiende varios tipos de búsqueda y
**detecta el tipo automáticamente** por el formato de lo escrito:

- **Producto / SKU / código de barras** → texto libre. Busca en el detalle de las ventas
  (`venta_items`) por nombre, SKU y número de serie. Si lo escrito calza con el **código de barras** de
  un producto del catálogo, se traduce a su SKU/nombre para encontrar sus ventas (el barcode no se
  guarda en el ítem de venta, pero sí en el catálogo). Muestra las ventas asociadas a ese producto.
- **Fecha exacta** → `2026-08-18`. Filtra las ventas de ese día.
- **Fecha y hora** → `2026-08-18 19:56`. Filtra la venta de ese minuto.
- **Total** → `100000` o `$100.000`. Filtra las ventas por ese monto.

**Sugerencias en vivo:** al escribir una fecha, hora o total, aparece un panel con hasta 6 ventas que
calzan (orden, fecha/hora, total). Al hacer clic en una, se abre su detalle.

La detección evita mezclar criterios: fecha/hora/total se filtran localmente sobre lo ya cargado
(instantáneo); el texto de producto va al servidor (donde vive el detalle). El botón "Buscar en todo el
historial" sigue funcionando para ampliar el rango de fechas al buscar un producto.

---

## 2. Detalles técnicos

- Frontend: `detectarTipoBusqueda`, `ventasQueCoinciden`, `mostrarSugerenciasVenta`,
  `buscarVentaUniversal` en `js/historial.js`. El input del buscador ahora llama a
  `buscarVentaUniversal`. El buscador por producto anterior (`aplicarBusquedaProducto`) se conserva y
  se usa para el caso de texto.
- Backend: `GET /api/ventas?producto=` ahora resuelve también el **código de barras** contra el
  catálogo, además de nombre/SKU/serial en `venta_items`.

---

## 3. Pruebas

- Frontend (jsdom): detección de tipo (5 formatos), búsqueda por fecha, fecha+hora y total,
  sugerencias en vivo, aviso de resultados, y limpieza. 14 comprobaciones.
- Backend: búsqueda por barcode, SKU y nombre, y barcode inexistente. 5 comprobaciones.
- Sin colisiones de funciones. Sin ids duplicados nuevos. Tailwind recompilado.

---

## 4. Despliegue

Solo frontend + backend (sin migración nueva): `index.html`, `js/historial.js`, `api/index.js`,
`css/styles.css` (Tailwind recompilado).

Prueba: en el Historial, escribe una fecha (`2026-08-18`), un total (`100000`), o un código de barras
de un producto y confirma que aparecen las ventas y las sugerencias.
