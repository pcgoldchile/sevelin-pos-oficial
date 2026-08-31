# CHANGELOG v45 — Medidas y peso de 40 productos (búsqueda real en internet, 01-09-2026)

## Qué se hizo

Pedido del dueño: cargar peso/dimensiones reales de los productos publicados que tienen foto, para
que Chilexpress pueda cotizar el envío (sin `peso_kg`/`alto_cm`/`ancho_cm`/`profundidad_cm`, el
checkout de la tienda rechaza el producto con "contáctanos por WhatsApp para coordinar el envío" — ver
`src/lib/envio.ts::agregarPaquete()` en `sevelin-tienda`).

- **Alcance real, no asumido**: de 81 productos publicados con foto, 49 tenían peso o alguna dimensión
  en 0 (el valor por defecto de la columna, que la validación de despacho trata igual que "falta el
  dato"). De esos 49, **9 son servicios técnicos** (formateo, clonación de disco, mantenimiento
  preventivo, reprogramación de BIOS, limpieza de puerto de carga) — no se les cargó nada: un servicio
  no tiene peso ni se despacha por courier, cargarle una medida física habría sido un dato falso.
  Quedan documentados como pendiente de decisión (ver abajo).
- **40 productos físicos reales, con medidas de embalaje** (no el producto desnudo — lo que importa
  para cotizar es lo que se despacha) buscadas por internet y cruzadas contra 2 o más listados
  reales por producto (Amazon, StarTech, sitios oficiales de marca, etc.) — la mayoría del catálogo de
  Sevelin son productos genéricos/sin marca exacta, así que se usó el rango típico de la categoría
  (ej. "mouse gamer RGB" genérico → dimensiones típicas de mouse gamer con caja, no un modelo
  específico inexistente en el mercado).
- Aplicado directo a la base real con `npx supabase db query`, no vía el modal del POS — mismo
  mecanismo que las migraciones SQL, en 6 tandas (ver los `UPDATE` en el historial de esta sesión).
  Sincroniza sola a `sevelin-tienda` por el trigger de siempre.

## Cómo se probó

- Consulta SQL antes/después: 49 → 0 productos físicos publicados con foto sin medidas reales
  (verificado con `coalesce(..,0)=0`, no solo `IS NULL` — la columna tiene `DEFAULT 0`, que la
  validación de despacho trata igual que "falta el dato").
- Se confirmó que los 9 restantes son exactamente los 9 servicios identificados (ninguno físico quedó
  sin medidas).

## Pendiente — decisión del dueño, no de código

**Los 9 servicios técnicos quedaron con peso/dimensiones en 0** (sin cambiar) — eso significa que si
alguna vez alguien intenta "comprarlos" desde la tienda con envío por Chilexpress, el checkout los va
a rechazar con el mismo error de "contáctanos por WhatsApp". Esto es correcto para Chilexpress (un
servicio no se despacha), pero probablemente estos 9 no deberían ofrecer courier como opción de envío
en absoluto — solo "Retiro en tienda" tendría sentido para un servicio técnico. Hoy no hay una forma
de marcar un producto como "servicio, no se despacha" a nivel de catálogo (`es_servicio` existe en
`venta_items`, la venta ya hecha, pero no en `productos`, el catálogo). Si se quiere resolver de raíz,
haría falta agregar ese campo a `productos` y que el checkout de la tienda lo respete — cambio
mediano, no se hizo en esta sesión porque no se pidió explícitamente.
