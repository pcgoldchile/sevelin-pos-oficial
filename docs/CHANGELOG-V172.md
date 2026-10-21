# v172 — Reel a 60 FPS y texto con enfoque (21-10-2026)

Pedido del dueño: *"siento que los FPS del video son muy bajos, creo que tiene 29,09; necesito mínimo 60 porque es para
redes"* y *"necesito otras formas de publicar el texto de un producto, distinta según contexto o promoción"*.

## 1. Reel en MP4 a 60 FPS exactos

- **Causa:** el reel se grababa en tiempo real con `canvas.captureStream(30)` + `MediaRecorder`: tope de 30 FPS y, si el
  equipo no alcanzaba a dibujar cada cuadro a tiempo, perdía cuadros (de ahí los 29,09).
- **Ahora:** `contenidoRedesGrabarReelCuadroACuadro()` (js/redes-contenido.js) dibuja cada cuadro en su instante exacto
  (cuadro *i* = *i*/60 s) y lo codifica en H.264 con WebCodecs; **Mediabunny 1.61.3** (MPL 2.0, copiada sin cambios en
  `js/vendor/`, ver su README) arma el MP4 con el índice al principio (`fastStart`). Se carga con `import()` solo al
  descargar un reel.
- **Medido con ffprobe** (el que trae Remotion en `sevelin-contenido`): H.264 High 4.2, 1080×1920, yuv420p,
  `avg_frame_rate=60/1`, **720 cuadros contados**, 12,000 s, ~8–11 MB. Se arma en ~6 s (antes esperaba los 12 s del
  video).
- Si el navegador no tiene WebCodecs, sigue la grabación en tiempo real, ahora pidiendo 60 FPS y 16 Mbps, y avisa que
  puede quedar bajo 60.
- Los videos no se guardan en la base: se descargan al equipo como siempre (solo queda la fila de registro en
  `contenido_redes`).

## 2. Texto con enfoque (Crear contenido → "Enfoque del texto" y "Texto para")

`js/redes-texto.js` suma `armarTextoConEnfoqueParaRedes(p, enfoque, red, hoy)` y `enfoquesDisponiblesParaRedes(p, hoy)`.
Misma regla que v139: **nada se inventa**. El cuerpo sigue saliendo de la Descripción; cada enfoque solo se ofrece si el
dato existe y lo que agrega es cierto para cualquier producto.

| Enfoque | Se ofrece si… | Qué agrega arriba |
|---|---|---|
| Normal | siempre | el texto guardado en el producto (el que el dueño pudo corregir) |
| 🔥 Oferta | oferta web vigente y no pausada, con stock | antes → ahora, cuánto ahorra, "válida hasta el DD-MM" si tiene fecha |
| 🆕 Recién llegado | etiqueta NOVEDAD o creado hace ≤ 30 días, con stock | "Recién llegado a Sevelin" + precio |
| ⏳ Últimas unidades | 1 a 3 unidades (no ilimitado ni por llegar) | "¡Últimas unidades!" + precio (sin el número, para que siga siendo cierto) |
| 🏷️ Liquidación | etiqueta LIQUIDACION, con stock | precio + "hasta agotar stock" |
| 🚚 Por llegar | `por_llegar` | fecha estimada (si ya pasó, "llega pronto") + reservar; cambia el bloque de retiro |
| 🎁 Para regalar | no es servicio, con stock | "Idea de regalo" + retiro o envío en Arica |
| 📦 Por mayor | tiene precio mayorista y "desde N", con stock | "precio especial desde N unidades, te cotizamos" — **sin mostrar el precio mayorista** (lo ven solo las cuentas que el dueño activa) |
| 💬 Corto | siempre | nombre, precio, 3 características y contacto: para WhatsApp e historias |

- "Texto para": Instagram (más corto, ≤ 2.200 letras, hashtags con espacio) o Facebook (completo, WhatsApp en emojis).
- Al elegir un enfoque, la **frase grande de la imagen** pasa a la del enfoque ("¡Está en oferta!", "Últimas unidades"…)
  y vuelve a la anterior al regresar a Normal. Se puede escribir encima.
- Los enfoques que no aplican quedan apagados con el motivo corto en el botón y el completo al pasar el mouse.
- De paso: el precio del contenido (`contenidoRedesPrecio`) ahora respeta la **oferta pausada**, igual que la tienda.

## Probado

- Node: los 9 enfoques sobre 4 productos reales (#526, #368, #282, #100) y una oferta simulada (vigente / pausada /
  vencida). La prueba encontró y se corrigió: "Por mayor" en un producto sin stock y una fecha de llegada ya pasada.
- Maqueta del POS (navegador): enfoques, frase de la imagen, Instagram/Facebook, y dos reels medidos con ffprobe.
- Sin probar: Safari y Firefox (el POS se usa en Chrome del computador); subir el MP4 a Instagram desde el celular.
