# v160 — 12 mejoras de la tienda y "Lo que buscan y no tenemos" (18-10-2026)

El dueño pidió analizar qué más facilidades sumar a sevelin.cl y aprobó **las 12** propuestas, con el texto de WhatsApp
propuesto. Casi todo vive en `sevelin-tienda` (ver su `docs/SNAPSHOT.md` del 18-10-2026, commit `9d15cf8`); acá se
anota lo del POS y el porqué.

## Lo que se midió antes

- **59 de 185 búsquedas** en la tienda (31-08 al 18-10) no encontraban nada; muchas veces el producto existía ("pasta
  termica" sin tilde, "teclados", "pendrive 128gb", "funte de poder", "cable iphone").
- **~2.000 vistas de productos al mes y 5 pedidos web**: la venta se cierra por WhatsApp, pero el botón verde abría el
  chat vacío.

## En la tienda (resumen)

Buscador que perdona (de 59 búsquedas sin nada a 17, y esas son cosas que no se venden), sugerencias al escribir,
agotados en la búsqueda con "Avísame", "Te lo conseguimos" por WhatsApp, WhatsApp con el producto escrito ("Hola, me
interesa [producto] ([precio]): [link] ¿Lo puedo retirar hoy en San Rafael 896?"), ficha técnica con las casillas de
v159, comparar hasta 3, `/que-me-sirve` (pantalla/adaptador, monitor, cargador), atajos por categoría, filtros en
búsquedas, Ofertas y Liquidación, y vistos recientemente.

Sinónimos del buscador: `SINONIMOS` en `sevelin-tienda/src/lib/busqueda.ts`. Si el dueño cuenta que piden algo con
otro nombre ("cargador de tablet"), se suma ahí.

## En el POS

- **Página Web → Más buscados → "🛒 Lo que buscan y no tenemos"**: búsquedas que no encontraron nada o solo parecidos,
  con veces y última fecha. `GET /api/pos/mas-buscados` devuelve ahora `buscados_sin_resultado` (lee
  `eventos_web.resultados = 0` de la tienda, `supabase/45`, agrupado sin tildes ni mayúsculas).
- Las 185 búsquedas viejas se recalcularon una vez con el buscador nuevo: 17 sin nada (escurridor, fuentes de 12 V,
  mando de Nintendo, UPS, lentes VR…) y 10 con solo parecidos.
- La maqueta del POS simula el panel con datos de ejemplo.

## Cómo se probó

- Buscador con las 185 búsquedas reales contra el catálogo real (script local): 59 → 17 sin nada; "240gb" ya no
  calza con "2400 DPI"; "pasta termica" pone primero la pasta y no el servicio.
- Maqueta de la tienda: búsquedas con y sin resultado, "parecidos", panel de búsqueda (Categoría/Marca/Precio/Estado),
  atajos en Cables, tarjeta "Agotado · Avísame", ficha (ficha técnica, JSON-LD, WhatsApp con el texto, `#avisame`),
  comparar (botón → barra → `/comparar` con la tabla), vistos recientemente, `/que-me-sirve` (HDMI→VGA da los 2
  adaptadores; VGA→HDMI no ofrece los HDMI→VGA), sugerencias al escribir "funte" → fuentes. `tsc`, `eslint` (sin
  errores nuevos) y `next build` completos.
- Maqueta del POS: la tabla nueva se dibuja. `node --check` y chequeos de colisión vacíos.
- **No probado:** Ofertas con el panel (la maqueta no tiene ofertas vigentes y Liquidación tiene 2, bajo el mínimo de
  5); usa el mismo componente que Liquidación. La consulta real de `GET /api/pos/mas-buscados` contra la base de la
  tienda se prueba al abrir el panel en producción.
