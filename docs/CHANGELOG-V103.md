# v103 y v104 — Venta mayorista (Fase 1) y despacho cobrado en la web

**Fecha:** 30-09 y 01-10-2026
**Migraciones:** `sql/76-venta-mayorista.sql` y `sql/77-envio-cobrado-en-venta.sql` (POS);
`supabase/39-mayoristas.sql` (tienda). Todas aplicadas con la CLI. Pendiente #28 y #35 de la tabla.

---

## v103 · Venta mayorista, Fase 1

**Decisiones del dueño:** se vende a personas sin giro; la cuenta se aprueba SIEMPRE a mano (WhatsApp o
llamada); pago siempre por adelantado; pedido mínimo sí o sí; piso de margen para no vender nunca a pérdida.

- **Precio por producto, no un porcentaje parejo:** `productos.precio_mayorista` + `mayorista_desde`
  (cantidad mínima del mismo producto). Se cargan en el editor (tarjeta "Precio y stock"), con el margen y
  el mínimo permitido a la vista.
- **Piso de 20% de margen, en un solo lugar** (`piso_margen_mayorista()` en la base). Se mide contra el
  MAYOR costo conocido: el de la ficha, el de la última compra y el de los lotes con unidades. 🔴 Trampa
  que lo motivó: registrar una compra más cara NO actualiza `productos.costo_unitario`. Por qué 20%:
  aunque la mercadería se haya comprado sin factura (IVA sin recuperar), la venta sigue dejando ganancia.
- **Guardia en la base** (`trg_productos_guardia_mayorista` + triggers en `ingresos_mercaderia` y
  `producto_lotes`): si una compra sube el costo o el precio normal baja, el mayorista se desactiva solo y
  queda el motivo en `mayorista_aviso`. La API valida antes para rechazar con un mensaje claro.
- **Pedido mínimo:** $100.000 sin envío, editable en Página Web → Mayoristas (vive en la base de la
  tienda, `ajustes_mayorista`). Si el pedido no llega, todo se cobra a precio normal.
- **Página Web → Mayoristas:** cuentas por aprobar / aprobadas / suspendidas / rechazadas. Aprobar exige
  escribir cómo se verificó (10 a 300 letras). Chip en el encabezado: cuentas por aprobar y precios
  desactivados solos.
- **Caja:** la línea del carrito muestra "Mayorista $X desde N u." y, cuando la cantidad alcanza, un botón
  para aplicarlo. Bajo esa cantidad vuelve sola al precio normal. Queda marcada en
  `venta_items.precio_tipo` (también las ventas web).
- **Salud:** el chequeo de catálogo compara los precios mayoristas del POS con los de la tienda; uno más
  barato en la web cuenta como "de más" y se arregla reenviando.
- **Tienda:** Mi cuenta → pedir precios mayoristas (RUT validado); `/mayorista` (privada, sin caché, sin
  indexar); carrito y checkout con UNA sola función (`resolverPreciosMayoristas`) para mostrar y cobrar.
  🔴 El precio mayorista vive en `precios_mayoristas`, nunca en `productos_web`: el catálogo lee esa tabla
  entera y la manda al navegador. 🔴 La aprobación vive en `cuentas_mayoristas`, nunca en
  `perfiles_clientes`: esa tabla deja que el cliente edite su propia fila.

**Probado:** 17 casos de la migración en un Postgres en memoria (PGlite; encontró un CHECK que dejaba
pasar NULL), 25 del backend con un doble de Supabase, la maqueta del POS, y la tienda de punta a punta en
su maqueta nueva (`scripts/maqueta-tienda.mjs`). Con la llave pública real: lee 0 filas y no escribe.

**No probado:** que el correo de aprobación llegue de verdad (en la maqueta Resend está apagado) y el
rechazo por RUT repetido (lo hace un índice de la base real).

**Falta:** cargar los precios mayoristas. Propuesta en `docs/estudios-precios/2026-10-01-propuesta-precios.md`.

## v104 · El despacho cobrado en la web se ve y se cuenta

El pedido WEB-000012 cobró $41.500 ($37.000 + $4.500 de despacho) y la venta #245 mostraba $37.000: la
tienda no mandaba el monto del envío.

- `ventas.envio_cobrado` (sql/77): aparte de `total`, para no mezclarlo con el margen de lo vendido.
- **Detalle de Venta:** "Despacho cobrado al cliente" y "El cliente pagó". El editor del despacho trae lo
  cobrado ya escrito: solo falta anotar el costo del viaje.
- **Finanzas:** tarjeta "Despachos del período" (cobrado, gastado, resultado). Lo cobrado con la venta
  entra a utilidad neta, medio de pago, flujo, saldos y Utilidades (pantalla, Excel y PDF). Lo anotado a
  mano en un despacho del local sigue siendo una nota, como siempre.
- Probado: 16 casos con el doble de Supabase y el detalle en la maqueta.

## Además (01-10-2026)

- **Tienda:** dentro de Arica ya no se ofrece courier (solo retiro y despacho propio). Encabezado con barra
  de color, pie con redes, tarjetas de reseñas/dudas/garantía, `/quienes-somos` y `/contacto`.
- **Skill `/revisar-precios`** y primera propuesta de precios. Hallazgo: en los productos de marca el
  margen flaco viene del costo de compra (al nivel del precio de venta de las tiendas grandes), no del precio.
- **Azapa y Lluta:** Chilexpress no los distingue de "Arica" en su API (solo Villa Frontera aparece
  aparte), cobra recargo en zonas rurales y puede dejar el paquete en sucursal. No se activó nada.
