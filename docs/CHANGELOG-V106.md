# v106 — Fotos hasta 1600 px y ficha de la IA con nombre y SEO automáticos

**Fecha:** 02-10-2026 · **Migraciones:** ninguna · Pendientes #14, #24, #28, #47 y #48 de la tabla.

## POS

- **Fotos de producto de 1000 a 1600 px** (`js/productos.js`, `ladoLienzoFoto`). El lienzo cuadrado sigue al
  lado mayor de la foto original; una foto chica no se estira (la tienda sirve la foto tal cual). Peso objetivo
  por megapíxel: unos 150 KB a 1000 px, hasta unos 384 KB a 1600 px. Si una imagen con muchísimo detalle supera
  900 KB con la calidad mínima, se rehace a 1000 px. Solo fotos nuevas.
- **La ficha de la IA carga el nombre sola.** El título que propone la IA solo se ofrecía con el Nombre vacío:
  con un nombre de paso, o con el "Borrador sin nombre — fecha" que se crea al subir la primera foto, se
  descartaba y había que copiarlo a mano. Ahora se muestra siempre, con la casilla "Usar como nombre del
  producto": marcada, salvo en un producto ya publicado con su nombre.
- **SEO:** casilla "Generar también el SEO para Google con IA" en la misma ventana de la ficha, y una pregunta
  (una vez por edición) al pegar una descripción de 200 letras o más directo en el editor.
- El "Borrador sin nombre" ya no se le pasa a la IA como nombre actual. Si el SEO llega cuando el editor ya
  está en otro producto, se descarta (`sesionEditorProducto`).
- **Maqueta:** simula la subida de fotos (tope de 1 MB) y los botones de IA sin llamar a Gemini.

**Probado** en la maqueta, en navegador real: lienzo con imágenes generadas de varios tamaños y el flujo
completo de subida; seis casos de la ficha (borrador, nombre de paso, producto publicado, pegar la ficha,
pegar la descripción, SEO que llega tarde). **No probado:** una foto real del celular, y los botones de IA
contra Gemini de verdad (la lógica que cambió es del navegador; el servidor no se tocó).

## Tienda (detalle en su SNAPSHOT)

- Chilexpress no cotizaba a 89 de las 346 comunas (las que llevan tilde, diéresis o ñ). Arreglado.
- `max-image-preview:large` en todo el sitio.
- `/ofertas` separa productos y servicios técnicos, con el recuadro "Cómo tomar la oferta de un servicio".
- "Solicitar factura" fuera del checkout (`FACTURA_HABILITADA = false`).
- `/mayorista`: lista de precios descargable en PDF y Excel. El cotizador del carrito ahora respeta los precios
  mayoristas de una cuenta aprobada (antes cotizaba siempre a precio normal).

## Datos cargados con OK del dueño

- Cyber (05 al 07-10): Power Bank LinkOn a $17.990 y 7 servicios técnicos rebajados. Con las 20 de ayer son 28
  ofertas; la Balanza Bluetooth tiene oferta pero quedó en stock 0 (ajuste de conteo del dueño, no es merma).

## Propuestas sin aplicar

- `docs/estudios-precios/2026-10-02-ajustes-menor-y-mayor.md`: 8 subidas al por menor y 16 mayoristas nuevos.
- `docs/PROPUESTA-MAYORISTA-FASE-2.md`: falta el precio mayorista en la ficha, el informe de margen y los tramos.
