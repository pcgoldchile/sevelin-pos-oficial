# v136 · Facebook desde la lista de productos y fotos sin .zip (13-10-2026)

Publicado. Migración `sql/93` aplicada. POS `4d67b1b`, `4374242`, `5365834`, `d0c717b` y `98c5d77`.

## Qué pidió el dueño
Vende sobre todo por Facebook Marketplace. Quiso dejar de extraer el .zip de fotos, agregar sola la imagen
"¿Dónde estamos?", y publicar sin entrar producto por producto: bajar fotos, tener el texto y saber cuáles ya publicó.

## Qué quedó
- **Fotos sueltas en una carpeta** (`elegirCarpetaDeFotos`, `entregarVariasFotos` en `js/productos.js`): en Chrome y Edge
  de computador se elige una carpeta una vez y cada producto queda en su subcarpeta. Donde el navegador no puede, sigue
  el .zip y el POS dice por qué. Con Mayús se elige otra carpeta.
- **Foto de ubicación:** interruptor "📍 Agregar foto «¿Dónde estamos?»" (vale para todos los productos, se recuerda en el
  navegador, parte encendido). La imagen es `img/donde-estamos.webp`; se cambia reemplazando el archivo.
- **Botón Facebook en cada fila** (`js/facebook-rapido.js`): fotos, texto y marca de publicado.
  - El texto **nunca se genera solo**: el dueño escribe su descripción y la IA la ordena (regla suya). Queda guardado
    en `productos.facebook_texto`.
  - **Publicado solo con link** (`facebook_url`, de facebook.com, fb.com o fb.me). Sin link no hay marca.
  - "📘 Fotos de los marcados": una carpeta por producto, de una vez.
- **Plantilla de Facebook** (`PROMPT_FACEBOOK`): el WhatsApp también en emojis (Facebook oculta los números), y el bloque
  de retiro con "San Rafael 896, Arica. Entrada por Robinson Rojas" y el aviso de consultar disponibilidad.

## Cómo se probó
15 casos de `PUT /api/productos/:id/facebook` en la base simulada; el recorrido completo en `pos-maqueta` con una
carpeta simulada. **No probado en Chrome real:** la ventana de elegir carpeta solo la abre un clic de una persona. El
13-10 el dueño avisó que le seguía saliendo el .zip; quedó el aviso con el motivo para diagnosticarlo.

## Ojo
Guardar el texto o el link hace un `UPDATE` en `productos`, así que dispara la sincronización con la tienda (`trg_sync_tienda`).
No cambia nada de lo que la tienda muestra.
