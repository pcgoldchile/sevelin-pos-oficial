# v116 y v117 — Interruptor de ofertas, precio tachado en la tienda, popup de entrega y descripción a la mano (03-10-2026)

Sesión en Opus · Alto. Cuatro pedidos del dueño; los dos más grandes (#66 y #67) se hicieron después, en la misma sesión: `docs/CHANGELOG-V118.md`.

## Publicado

| Versión | Qué cambió | Commit | Migración |
|---|---|---|---|
| **v116** | Chip "Ofertas": encender y apagar cada oferta web desde el POS. | POS `9602208` | `sql/83` (aplicada) |
| **v116** | Tienda: precio normal tachado, precio de oferta en ámbar y "Ahorras $X". Respeta la oferta apagada. | tienda `a0d7667` | no |
| **v117** | Popup "Entrega del pedido" en dos columnas y botón "Ya entregado". | POS `fc2b0c8` | no |
| **v117** | La Descripción pasa a vivir dentro de "Información básica". | POS `b37cbe5` | no |

## v116 · Interruptor de ofertas web

- **El pedido.** "Necesito un botón en el POS para activar las ofertas ... prefiero activar o desactivarlas yo."
- **Cómo quedó.** Chip "Ofertas" en el encabezado (solo admin). Lista los productos con precio de oferta cargado, cada
  uno con su interruptor, más "Encender todas" y "Apagar todas".
- **Apagar no borra nada.** Columna nueva `productos.oferta_pausada` (`sql/83`). La tienda recibe la oferta apagada como
  "sin oferta" (`ofertaDesdePos` en `src/app/api/sync/producto/route.ts`), así el checkout, el feed y la franja no cambian.
- **Decisión del dueño (opción B).** Encendida respeta la fecha de término de la ficha: empieza y termina sola. Una oferta
  terminada pide fecha nueva para encenderse. "Encender todas" se salta las terminadas y avisa cuántas son.
- **"Empezar ahora"** para las que todavía no parten (mueve el inicio a este momento).
- El precio de oferta y las fechas se siguen cargando en la ficha del producto (Tienda web → Oferta web).
- Las 31 ofertas ya cargadas quedaron encendidas: aplicar la migración no cambió nada a la vista.
- **Probado:** 15 comprobaciones contra el servidor real con un doble de la base (permisos, apagar conserva precio y
  fechas, terminada pide fecha, oferta más cara que el normal no se enciende, todas). En la maqueta: apagar, encender con
  fecha, empezar ahora, apagar y encender todas. Verificado en producción que `js/ofertas.js` se sirve y que
  `/api/ofertas` existe (401 sin sesión).
- **No probado:** el viaje real POS → tienda de una oferta apagada (requiere apagar una oferta de verdad).

## v116 · Tienda: que el ahorro se vea

- Tarjeta, ficha y carrito: primero el precio normal tachado con el porcentaje en ámbar, después el precio de oferta en
  ámbar (más grande en la ficha) y abajo "Ahorras $X", la resta exacta.
- El precio "antes" sigue siendo el precio web normal, nunca uno inventado.
- **Probado** en la maqueta de la tienda leyendo la página (`/ofertas` y una ficha) y con `tsc`. **No hay captura**: el
  panel del navegador estaba oculto. En producción no se ve hasta que haya una oferta vigente (las del Cyber parten el 05-10).

## v117 · Popup de entrega

- Con "Envío / Despacho" el popup pasa de 460 a 920 px y se ordena en dos columnas: a la izquierda dirección, sector,
  notas y si ya se entregó; a la derecha quién lo lleva, costos y cómo se paga. En 1366×768 mide 664 px de alto: no se
  desliza. Con "Retiro en tienda" sigue angosto. Bajo 820 px de ancho vuelve a una columna.
- **"Ya entregado".** La venta nace con `estado_envio = 'entregado'` (`ya_entregado` en `construirDatosEnvio`) y no
  aparece en el aviso "por entregar". Por defecto queda en "Todavía no".
- **Probado** en la maqueta leyendo medidas y el dato que se manda. El cambio del servidor es una línea y no se probó
  contra `POST /api/ventas` con una base doble.

## v117 · Descripción dentro de Información básica

- La tarjeta "Descripción" estaba al final de la columna y había que bajar en cada producto. Ahora va dentro de
  "Información básica y descripción", justo bajo nombre y marca (empieza a 521 px del borde superior en 1366×768).
- Conserva `data-seccion="descripcion"`, así el aviso de "le falta algo" la sigue encontrando; `irASeccion` abre también
  la tarjeta que la contiene.
- **Probado** en la maqueta: el editor escribe y sincroniza, los botones de IA siguen ahí.

## Queda anotado en `pendientes`

- **#66** y **#67**: hechos en la misma sesión, ver `docs/CHANGELOG-V118.md`.
