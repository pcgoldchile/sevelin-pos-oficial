# v105 — Margen a la vista, precios aprobados cargados y guía pública de mayoristas

**Fecha:** 01-10-2026 (tarde)
**Migración:** `sql/78-costos-referencia-productos.sql` (POS), aplicada con la CLI. Solo crea una función de
lectura; no toca tablas. Pendientes #38, #40, #43, #44 y #45 de la tabla.

---

## Margen por menor y por mayor en la lista de Productos (pendiente #44)

**Pedido del dueño:** "ver de forma visual cuánto le margino a cada producto, al por menor y al por mayor".

- **Columna "Margen"** (solo admin): una barra con el porcentaje y los pesos que deja cada unidad, al por
  menor y, si el producto tiene precio mayorista, también al por mayor ("Mayor ×5"). Rojo bajo 15%, ámbar
  bajo 25%, verde desde 25%. El número va siempre escrito; el color solo acompaña.
- **Resumen sobre la tabla:** cuántos productos con stock caen en cada tramo.
- **Dos opciones nuevas en el orden:** "Margen: Menor a Mayor" y "Ver: Margen bajo 25%".
- **Página Web → Mayoristas:** la columna de margen ahora muestra las dos barras juntas.
- 🔴 **El costo es el MAYOR conocido**, no el de la ficha: `costos_referencia_productos()` (sql/78) usa la
  misma `costo_referencia_mayorista()` del piso mayorista (ficha, última compra y capas PEPS con unidades).
  Con el de la ficha solo, el margen sale inflado cada vez que una compra llegó más cara. Al 01-10 pasa en 2
  productos (Balanza Bluetooth y la RTX 5060).
- **Sin costo cargado no se inventa un 100%:** dice "sin costo".
- Si el endpoint falla, la tabla se pinta con el costo de la ficha y lo avisa en el resumen.
- Endpoint nuevo: `GET /api/productos/costos-referencia` (solo admin).

**Probado:** 8 comprobaciones del endpoint con supabase-js real y un PostgREST falso (admin 200 con el mapa,
trabajador 403 sin costos, sin sesión 401, función ausente 500 con mensaje genérico). En la maqueta
(`pos-maqueta`): porcentajes y pesos de los 10 productos, los dos órdenes nuevos, la tabla de Mayoristas y
el rol trabajador (columna, resumen y opciones ocultos, sin pedir costos). En producción: la función
devuelve 200 filas, `anon` y `authenticated` no pueden ejecutarla, el endpoint responde 401 sin sesión y los
archivos publicados traen el cambio. **No probado:** la pantalla real con el PIN real (nunca se usa).

> A 1366 px de ancho la columna le quita espacio al nombre: los nombres largos pasan a dos líneas y la fila
> crece unos 10 px.

---

## Datos cargados con el OK del dueño

- **Venta #245 (pendiente #43):** viaje anotado (costo $3.000, cobrado $4.500, repartidor "otro") y
  `estado_envio = entregado`; pedido WEB-000012 a ENTREGADO en la base de la tienda. **No** se registró el
  gasto de $3.000 en Gastos ni salió el correo de entrega con la reseña: quedan por decidir.
- **8 precios normales en 990 y 16 mayoristas (pendiente #38):** aplicados de a un producto. Verificado: los
  24 guardados, 0 avisos de la guardia, 24 sincronizaciones con 200 y la tienda con los mismos valores.
  El Caixun 24" IPS era el único con `precio_web` propio: se cambiaron los dos campos.

## Propuesta del 990 y del Cyber: qué aprobó el dueño y qué se aplicó (01-10, noche)

Propuesta completa en `docs/estudios-precios/2026-10-01-terminacion-990-y-cyber.md`.

- **990 general, aplicado:** 129 productos pasaron de miles cerrados a 990 ($10 menos), de a uno. Con las
  correcciones del dueño: pasta HY410 a **$4.990** (no $2.990), cable de red 5 m a **$4.990** (no $3.990: "sí
  lo compran, solo que de olvidadizo no le pongo las ventas") y mouse 707775 a **$4.990**. El Samsung 22"
  VGA/DVI queda en $59.990: su costo de $51.615 es real ("una compra que no me salió bien"). Los servicios y
  el tornillo de $500 no se tocaron. Verificado: POS y tienda iguales en los 195 publicados, 0 avisos de la
  guardia, 108 de 151 productos visibles en la tienda terminan en 990 (el resto son servicios).
- **Ofertas del Cyber, cargadas:** 20 productos con `precio_oferta_web` del lunes 05-10 00:00 al miércoles
  07-10 23:59 (hora de Chile; el fin se guarda como jueves 08 00:00). Empiezan y terminan solas.
- **Sin decidir, NO aplicado:** las 2 subidas (Control Mando USB y Monitor HP V214a, que quedaron en $4.990
  y $54.990 por la regla general), los 9 mayoristas nuevos (el dueño preguntó a qué se refieren), el Power
  Bank LinkOn a $17.990 (deja 9,8%) y las rebajas de servicios con cupos.
- **Descartado por ahora:** despacho gratis.
- **Venta #245:** el viaje se pagó con efectivo de la caja. Quedó como lo deja el POS: gasto #26 en "Envíos /
  Despachos" ($3.000, Efectivo), egreso #8 de la caja 11 (abierta desde el 28-09) y el viaje enlazado a los
  dos. El correo de "pedido entregado" con la reseña salió (la tienda respondió `enviado: true`).

> 🔴 **Las ventas registradas no están completas** (dicho por el dueño el 01-10): hay productos que se venden
> y no se anotan. Un "sin ventas" de `consulta.sql` no prueba que un producto esté dormido; antes de proponer
> bajar un precio por eso, preguntarle.

---

## Tienda (repo sevelin-tienda)

- **`/venta-mayorista` (pendiente #45):** guía pública de cómo crear la cuenta y cómo funciona. Enlaces en la
  barra superior, el menú del celular y el pie. Nunca muestra un precio mayorista.
- **Arreglo:** en `/mayorista` el enlace de cada producto daba 404.
- **Facebook (pendiente #40):** `NEXT_PUBLIC_FACEBOOK_URL` configurada en Vercel; los dos enlaces que dio el
  dueño llegan a la misma página (el corto redirige al largo).
- **`/ofertas` y su franja** (commit `536c7c4`): la página lista lo que tiene oferta vigente; antes de que
  empiecen anuncia la fecha y los productos al precio de hoy. La franja va arriba del encabezado y se enciende
  y apaga sola: estado inicial desde el servidor y confirmación con `GET /api/ofertas/estado`. Probado en la
  maqueta en sus cuatro estados (sin ofertas, por empezar, vigentes, terminadas) y en producción en "por
  empezar". **No probado todavía: el estado "vigente" en producción**, que recién ocurre el lunes 05-10.
- **Guía de mayoristas:** dice "Por ahora, solo boleta". El checkout sigue ofreciendo "Solicitar factura".

---

## Trampas nuevas

- **Bajar un precio normal bajo su mayorista desactiva el mayorista** (la guardia de sql/76). Al bajar un
  precio, primero se baja el mayorista. La guardia no mira el precio de oferta: una oferta bajo el
  mayorista no desactiva nada, y la tienda le cobra al mayorista el menor de los dos.
- **Los precios se cargan de a un producto**, no en un solo UPDATE: `trg_sync_tienda` tiene 5 s de tope.
- **La maqueta del POS no tiene `/api/ventas/envios-pendientes`** y lo confunde con una venta (404 en la
  consola). Es de la maqueta, no del POS.
