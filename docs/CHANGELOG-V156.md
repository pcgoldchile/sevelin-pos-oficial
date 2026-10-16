# v156 · Más stock y bodega: dónde está cada producto y dónde guardarlo (16-10-2026)

Migración `sql/101-bodega-propuestas.sql` (aplicada con la CLI el 16-10-2026, RLS activo) y 149 propuestas cargadas.
Cambia `api/index.js`, `js/api.js`, `js/bodega.js` (nuevo), `index.html`, `css/styles.css` y `scripts/maqueta-pos.js`.

## Qué pidió el dueño
"Necesito una opción en el POS para ver los productos que más stock tienen, y una sugerencia para ir guardando las cosas
en los cajones y qué cosas pueden ir en caja […] un producto puede guardarse en más de un cajón a la vez […] solamente
propuesta, para yo guiarme, pero yo tengo la palabra final."

## Qué quedó
- **Productos → "📦 Más stock y bodega"** (solo admin). Muestra cada producto con stock, ordenado por stock, con:
  - lo vendido en 90 días;
  - la plata guardada (stock × costo);
  - dónde está hoy, con todos sus lugares y el principal en azul;
  - **la propuesta de Claude**: repisa (A1–I5), caja rotulada si es chico o suelto, y el motivo.
- **Filtros:** "Más unidades", "Más plata guardada", "Sin lugar" y "Propuestas por decidir". El buscador busca por
  nombre o por lugar (por ejemplo "C3").
- **"✅ Guardar ahí"** agrega ese lugar al producto y nunca le saca uno que ya tenía. Con caja, la crea la primera vez
  como lugar tipo caja ("Caja Pilas · E3") con la descripción "Dentro de la repisa E3". **"✕ No"** la deja descartada.
- **"Cómo está pensada la propuesta"** explica qué va en cada mueble, qué va en cada repisa y lo de las cajas.
- **Varios lugares por producto:** ya existía desde `sql/60` y la v140, en la ficha del POS y en la app del taller. No
  hubo que cambiar nada para eso.

## La propuesta
`docs/bodega-propuesta-2026-10-16.md` (mueble por mueble y repisa por repisa). La generó `scripts/propuesta-bodega.py`
con los datos del 16-10-2026: 149 productos, 38 en 11 cajas. Un mueble por familia (A cargadores … I hogar voluminoso).
En cada mueble, la repisa 1 es para lo pesado, la 3 para lo que más se vende y la 5 para lo liviano y voluminoso.
**Supuesto a confirmar:** los muebles van de la A a la I de izquierda a derecha y el A es el más cercano al mesón.

## Probado
- **Servidor real con el doble de Supabase:** 17 de 17.
  - Solo entran los productos con stock: ni servicios ni archivados, y ordenados por stock.
  - Lo vendido en 90 días no cuenta ventas viejas, y la plata guardada sale bien.
  - Aceptar con caja crea la caja y deja el producto ahí como principal.
  - Aceptar una repisa que ya existe no la duplica, y si el producto ya estaba ahí no se repite.
  - Un producto con lugar queda en dos sin perder su principal.
  - No se descarta una propuesta ya aceptada, aceptar sin propuesta da 404 y el trabajador recibe 403.
- **Maqueta del POS:** la ventana abre con 10 productos. Probados "Guardar ahí" (agrega "Caja Adaptadores de video ·
  B3"), "No", los cuatro filtros y el buscador por lugar. No hay errores nuevos en la consola.
- **No probado en vivo:** apretar "Guardar ahí" contra la base real. Se prueba con el primer clic del dueño.
- Hechos `node --check`, los dos chequeos de colisión y el de variables globales. No se usó Tailwind: todo está en
  `css/styles.css`.

## Versión 2 de la propuesta (16-10-2026, más tarde)
El dueño dijo: H e I son solo para monitores ("aún falta monitores por cargar"), y la bodega parte desde la derecha (A a
la derecha, I a la izquierda). Los estantes miden 180 × 90 × 40 cm, con 5 repisas regulables y 140 kg. Cambios:
- **Lo que estaba en H e I se movió:**
  - computación (PCs, gabinetes, fuentes, placas, ventiladores) a C1, C2 y C5;
  - hogar voluminoso a G;
  - aros de luz y kits de streaming a D1.
- **Los monitores:** nuevos en H1 y H2, reacondicionados en I1 e I2. H3 e I3 quedan libres para los que faltan.
- **Libres:** E1 queda "por ordenar", y F1, F2 y F5 para repuestos de celular.
- **Alturas sugeridas por mueble** en la guía y en `docs/bodega-propuesta-2026-10-16.md`: monitores parados como libros
  en tres niveles de ~60 cm.
- **149 propuestas actualizadas en la base.** Todas seguían pendientes, así que no se pisó ninguna decisión.
