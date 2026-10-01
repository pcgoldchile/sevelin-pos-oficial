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

## Propuesta sin aplicar

`docs/estudios-precios/2026-10-01-terminacion-990-y-cyber.md`: todo el catálogo a 990 bajando $10, 2 subidas,
3 bajas, 9 mayoristas nuevos y el Cyber del 05 al 07-10 (15 ofertas, servicios con cupos y ganchos sin
rebaja). Espera el OK del dueño.

---

## Tienda (repo sevelin-tienda)

- **`/venta-mayorista` (pendiente #45):** guía pública de cómo crear la cuenta y cómo funciona. Enlaces en la
  barra superior, el menú del celular y el pie. Nunca muestra un precio mayorista.
- **Arreglo:** en `/mayorista` el enlace de cada producto daba 404.
- **Facebook (pendiente #40):** `NEXT_PUBLIC_FACEBOOK_URL` configurada en Vercel; los dos enlaces que dio el
  dueño llegan a la misma página (el corto redirige al largo).

---

## Trampas nuevas

- **Bajar un precio normal bajo su mayorista desactiva el mayorista** (la guardia de sql/76). Al bajar un
  precio, primero se baja el mayorista. La guardia no mira el precio de oferta: una oferta bajo el
  mayorista no desactiva nada, y la tienda le cobra al mayorista el menor de los dos.
- **Los precios se cargan de a un producto**, no en un solo UPDATE: `trg_sync_tienda` tiene 5 s de tope.
- **La maqueta del POS no tiene `/api/ventas/envios-pendientes`** y lo confunde con una venta (404 en la
  consola). Es de la maqueta, no del POS.
