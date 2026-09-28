# v97 — Sellos de garantía Sevelin con S/N en las órdenes de trabajo

**Fecha:** 28-09-2026
**Migración:** `sql/69-sellos-garantia-ot.sql` (aplicada con la CLI el 28-09-2026). Tabla nueva
`ot_sellos_garantia` con **RLS activo y 0 políticas** (verificado), índice único del S/N e índice por
orden. La relación embebida de PostgREST (`sellos:ot_sellos_garantia(...)`) se probó con una lectura
real después de aplicarla.
**Pedido del dueño:** *"Mis sellos de garantía traen número de serie. En reparaciones y mantenciones
quiero registrar el S/N del sello (uno o varios) que le pongo al equipo: en la OT, en el comprobante
de entrega, y que se pueda buscar por ese S/N en Garantías. Revisa si ya existe algo parecido antes de
crear columnas."*

---

## 1. ¿Existía algo parecido?

No. El único S/N de una OT era `dispositivo_sn` (el del equipo del cliente, desde sql/02), que es otra
cosa. No había ninguna mención a sellos en el código, las migraciones ni los documentos.

## 2. Por qué una tabla y no una columna `text[]`

Un sello físico va en **un solo equipo**. Con una tabla, el S/N es **único en la base**: no se puede
registrar el mismo sello en dos órdenes (error de tipeo o sello reutilizado) y buscar un sello siempre
devuelve una sola orden. Con una columna de lista eso no se puede garantizar.

## 3. Cómo funciona

- **S/N normalizado:** sin espacios y en mayúsculas (`sv 00123` = `SV00123`). Formato: 1 a 40 de
  A-Z 0-9 . _ / -, igual en el servidor (`normalizarSelloSN`), el frontend (`normalizarSelloOT`) y el
  CHECK de la tabla.
- **Al entregar (Check-Out):** sección "🏷️ Sellos de garantía puestos (opcional)". La pistola lectora
  termina cada lectura con Enter, que agrega el sello y deja el campo listo para el siguiente. Un S/N
  escrito sin Enter también se incluye al confirmar. Hasta 10 por orden.
  **Los sellos se guardan antes de marcar la entrega:** si uno ya está en otra orden, la entrega no
  pasa y el aviso dice en cuál (`El sello SV0001 ya está en OT-000001`).
- **Después (detalle de la orden):** recuadro "🏷️ Sellos de garantía" para agregar uno que se olvidó,
  con la orden pendiente o ya entregada. **Quitar un sello: solo el admin** (el sello es la prueba
  anti-fraude de la garantía). El trabajador no ve la ✕ y el servidor responde 403.
- **Comprobante:** fila "Sellos de garantía" en el bloque Equipo.
- **Garantías → Servicios:** el buscador encuentra por S/N de sello comparando solo letras y números
  (`sv 0002`, `SV0002` y `SV-0002` encuentran lo mismo), y la columna Equipo muestra los sellos.
- `GET /api/ot` trae los sellos embebidos en cada orden (una sola consulta, no una por orden).

Endpoints nuevos: `GET/POST /api/ot/:id/sellos`, `DELETE /api/ot/:id/sellos/:selloId` (admin).
`POST /api/ot/:id/entrega` acepta `sellos: [...]`.

## 4. Cómo se probó

- **Backend (doble de Supabase + `app.listen(0)`), 18 casos:** entrega con 3 sellos, uno repetido →
  guardados 2, normalizados · sello ya usado en otra OT → 409 que nombra la orden, sin entregar y sin
  sellos a medias · S/N inválido → 400 · más de 10 → 400 · entrega sin sellos igual que antes ·
  agregar a una OT entregada (trabajador) → 201 · repetido → 409 · vacío → 400 · OT inexistente → 404
  · trabajador quita → 403 · quitar con otra OT en la ruta → 404 · admin quita → 200 · `GET /api/ot`
  trae los sellos · Garantías encuentra `sv 0002`, `sv-0002` y `sv 0001`. Los 17 casos de v96 siguen
  pasando.
- **Maqueta:** Check-Out con Enter por sello, aviso de repetido, el S/N sin Enter se incluye, el
  comprobante muestra los 3; en el detalle, "USADO" → aviso de otra orden, agregar y quitar (admin)
  actualizan chips y comprobante; como trabajador no aparece la ✕; la tabla de Garantías muestra los
  sellos y el buscador nuevo.
- **No probado:** la pistola lectora real (se razonó: manda el código + Enter, igual que en el POS).
