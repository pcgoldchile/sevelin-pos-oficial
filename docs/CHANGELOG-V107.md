# v107 — Encargos solo por cotización, Fase 2 mayorista y carruseles (02-10-2026, noche)

Sesión en Opus · Extra. Pendientes trabajados: #51, #52, #28, #53, #54, #56 y #57.

## Publicado

| Pendiente | Qué cambió | Commits |
|---|---|---|
| **#52** | Un producto por encargo ya no se paga en sevelin.cl: "Precio referencial", botón "Cotizar por encargo por WhatsApp", no entra al carrito, y el checkout y el cotizador lo rechazan en el servidor. Los 18 encargos salieron del feed de Google y Meta. | tienda `bac4692`, POS `d276b64` |
| **#28** (2a) | "Tu precio mayorista" en la ficha, solo para una cuenta aprobada. | tienda `66fe854` |
| **#28** (2b) | Página Web → Mayoristas → "Ventas a precio mayorista": vendido, margen real, rebaja frente al normal de hoy, por producto y últimas ventas. `GET /api/pos/mayoristas/informe` (solo admin). | POS `a971ab5` |
| **#56** | Lámina "Servicio técnico en Arica" en el carrusel de la portada, con la foto de un servicio real. | tienda `cf6509a` |
| **#57** | "Complementa tu compra" y "También te puede interesar" con flechas; el segundo muestra hasta 12 productos (antes 4). | tienda `cf6509a` |

## Propuestas entregadas, sin aplicar

- **#51** `docs/estudios-precios/2026-10-02-reacondicionados-mayor-y-cyber.md`:
  - Cyber de los monitores de 19" a $34.990.
  - ViewSonic a $44.990 y gabinete CG72 a $16.990.
  - Liquidación del HP V214a ($49.990) y del Samsung VGA/DVI ($54.990).
  - Mayorista de $37.000 desde 2 unidades para el HP S1933 y el AOC E2070SWN.
  - Espera el OK del dueño antes del lunes 05-10.
- **#53 y #54** `docs/PROPUESTA-ENCARGOS-Y-EDITOR.md`:
  - Encargos: ampliar Abonos y Encargos con las etapas del proceso con el proveedor.
  - Editor y caja: aviso bajo 15%, precio sugerido en 990, complementos e IA. Esperan decisiones.

## Detalles que importan

- **Encargos, el servidor manda:**
  - `POST /api/checkout` responde 409 a un encargo antes de crear nada; un carrito viejo que lo traiga lo deja
    sin seleccionar.
  - Verificado en producción con un encargo real: 409 y 10 pedidos antes y después.
  - `tipo_pedido` queda siempre en NORMAL.
- **Feed:** los encargos van a "omitidos" con su motivo. Merchant puede avisar la baja de 18 artículos: es esto.
- **Precio mayorista en la ficha:**
  - Lo pide el navegador a `POST /api/carrito/precios` con la sesión.
  - La página pública (ISR) nunca lo lleva, y sin sesión no se hace la consulta.
  - Probado con cinco sesiones de la maqueta: sin sesión, cliente, sin aprobar, suspendida y aprobada.
- **Informe mayorista:**
  - Solo ventas PAGADAS.
  - Descuenta las unidades de `devolucion_items`, porque una devolución parcial no toca `venta_items`.
  - Usa el costo guardado en la línea.
  - La rebaja se compara con el precio normal de HOY, y la pantalla lo dice.
  - 22 comprobaciones con un doble de la base. Hoy sale vacío: 0 ventas mayoristas.
- **Carrusel:**
  - `scroll-padding` para que el snap no deje la fila corrida 16 px.
  - La primera revisión de las flechas va con `setTimeout`: en una pestaña que no se dibuja, ni
    `requestAnimationFrame` ni `ResizeObserver` se disparan.

## No probado

- El WhatsApp de "Cotizar por encargo" abierto desde un teléfono.
- El informe mayorista con tu sesión real en producción.
- El desplazamiento animado del carrusel al hacer clic en una pantalla real: el panel del navegador estuvo oculto.

## Trampas nuevas

- La tabla `pendientes` tiene tope: `detalle` hasta 2000 letras y `nota_cierre` hasta 1000. Un `detalle || '…'`
  largo falla con `pendientes_detalle_check`: hay que resumirlo.
- Con el panel del navegador oculto, una pestaña no dibuja: no corren `requestAnimationFrame`,
  `ResizeObserver`, el evento `scroll` ni las animaciones de framer-motion. Para probar se leen los valores del
  DOM o se dispara el evento a mano.
