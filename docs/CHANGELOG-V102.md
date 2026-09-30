# v102 — Complementa tu compra, Agotados y editar activos

**Fecha:** 30-09-2026
**Migraciones:** `sql/75-complementarios.sql` (POS) y `supabase/38-complementarios.sql` (tienda), las dos
aplicadas con la CLI el 30-09-2026 — primero la de la tienda, porque el receptor solo copia columnas que
conoce. También en esta sesión: `sql/73` y `sql/74` (servicios por equipo) y `sql/72` (pendientes, v101).

---

## 1. "Complementa tu compra" (pedido del dueño)

- **Editor de producto → tarjeta "🧩 Complementa tu compra":** buscar y agregar hasta 12 productos,
  ordenarlos (▲▼) y quitarlos. Se guarda al instante por `PUT /api/productos/:id/relacionados` (ruta
  propia, como fotos y medidas: el botón Guardar del producto no la toca). Avisa cuáles no van a salir en la
  tienda (no publicado / sin stock).
- **Tienda:** carrusel deslizable en la ficha, antes de "También te puede interesar" (que sigue siendo
  "parecidos de la misma categoría" y ya no repite los complementos). Solo publicados con stock, en el orden
  elegido. Sin lista → la sección no aparece (no se inventan complementos automáticos).
- **Carga inicial hecha por Claude** (pedido del dueño): 57 productos con complementos evidentes —pasta
  térmica y limpieza para mantenciones, cables de video para monitores, RAM y pasta para la placa madre,
  cables de carga para power banks, etc.—. Solo en productos sin lista. Verificado: 57/57 llegaron a la
  tienda y la ficha de la MSI A520M lo muestra en producción.

## 2. Agotados

- **Tienda:** la ficha de un agotado ofrece "Pídelo por encargo o cotízalo" (WhatsApp con el producto
  escrito) además del aviso por correo; "También te puede interesar" pasa a "Alternativas disponibles".
  Página nueva **/agotados** (pie de página y sitemap) con las tres salidas.
- **POS → Productos → Agotados:** vista completa (el chip del encabezado solo muestra los que esperan
  decisión): todos los agotados físicos, ventas de 90 días, cuántos clientes esperan aviso o reservaron en
  sevelin.cl, decisión tomada. Decidir usa la misma ruta que el chip; "Editar" abre el editor y al cerrarlo
  vuelve al panel. `GET /api/agotados/panel` (solo lectura, admin).

## 3. Editar activos de uso interno

Botón ✏️ en cada fila (también cerradas): motivo, N° de factura o boleta y archivo de respaldo (adjuntar,
cambiar o quitar). El backend ya lo permitía; faltaba la pantalla. Cantidad y costo no se editan (movieron
stock): se deshace con ✖ y se vuelve a apartar.

## 4. Cómo se probó

- Backend con doble de Supabase: relacionados (9 casos: permisos, a sí mismo, archivado, inexistente,
  más de 12, no-lista, orden sin repetidos, vaciar, 404) y panel de agotados (5 casos: permisos, qué cuenta
  como agotado, avisos solo PENDIENTE y reservas aparte, decisión/por llegar, orden por clientes esperando).
- Maqueta: agregar/subir/quitar complementos; panel de agotados (filtros, por llegar con fecha y unidades,
  editar y volver); edición de activos (guardar, motivo vacío no guarda).
- Producción: sincronización 57/57 y la ficha con el carrusel.
- **No probado en vivo:** la página /agotados y el botón de WhatsApp del agotado con datos reales (se
  revisaron con tsc/eslint; se verán apenas despliegue).
