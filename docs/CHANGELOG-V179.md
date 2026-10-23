# v179 — Carga masiva: por qué no se publicaban, fotos, PEPS y combo con foto (23-10-2026)

Preguntó por qué 4 productos cargados por "Carga masiva" como "por llegar" no aparecían en sevelin.cl, y
pidió mejorar esa pantalla: subir fotos a los productos nuevos, buscar los que ya existen con un pop up
que muestre su foto, y que el PEPS/FIFO quede activado siempre — tanto en lo nuevo como en lo que ya
existía.

## Por qué no se publicaban (la causa real)

Un producto nuevo creado por Carga masiva **siempre** nacía con `publicado_web = false`, pasara lo que
pasara con el estado (llegó, por llegar, encargo o de los padres) — línea fija en `api/index.js`. Era
una decisión a propósito (ver el aviso que ya existía: "Les falta foto, descripción... quedaron en 📋 Por
completar"): publicar sin foto deja la ficha mostrando un hueco en la tienda. El problema es que Carga
masiva nunca ofreció cómo ponerle una foto, así que esos productos quedaban invisibles sin que quedara
claro por qué.

## Lo que cambió

### 1. Fotos para un producto nuevo (`api/index.js`, `js/carga-masiva.js`)
Cada fila nueva tiene ahora una columna "Foto": botón 📷+ que abre el mismo selector de archivos de
siempre (comprime a webp con `dibujarYComprimirFoto`, igual que la ficha), hasta 6 fotos, con su ✕ para
quitarlas. Las fotos viajan en el mismo POST de carga masiva y se suben con `subirFotoProducto` (la misma
función que usa la ficha) apenas el producto queda creado.

### 2. Se publica solo si tiene foto
Un producto **nuevo** de esta carga que terminó con al menos una foto subida queda `publicado_web = true`
de inmediato — así "lo que pongo por llegar se sube a la página web", pero nunca sin foto (eso seguiría
mostrando un hueco). Uno que ya existía no cambia su estado de publicación por esta vía.

### 3. PEPS/FIFO siempre activado (`api/index.js`, mismo criterio que `activar_lotes` de una compra
normal)
- Un producto **nuevo** (no encargo) ya nacía con `usa_lotes = true` — eso no cambió.
- Lo nuevo es que un producto que **ya existía** y todavía no tenía lotes activados los activa solo, al
  cargarlo por Carga masiva (crea su capa inicial con el stock que tuviera, antes de sumar la compra).
  Un encargo no lleva stock propio, así que no aplica.

### 4. El combo "¿Ya existe?" con foto (`js/carga-masiva.js`, `css/styles.css`)
El `<select>` + buscador aparte se reemplazaron por un solo campo: escribes y aparece una lista (con la
foto de cada candidato, su stock y si le falta o no el PEPS), siempre con "🆕 Es un producto nuevo"
arriba. Un clic elige. La lista cuelga de `<body>` con `position: fixed` — adentro de la celda quedaba
cortada por el scroll horizontal de la tabla (una fila del CSS: `overflow-x` fuerza `overflow-y` al mismo
valor, así que una lista `absolute` ahí adentro quedaba invisible).

## Probado

- `node --check` en los tres archivos tocados; los dos chequeos de colisión (funciones e ids) vacíos.
- Maqueta del POS: carga de 2 productos "por llegar" — uno nuevo con una foto de prueba, uno existente
  (#104, sin PEPS) elegido por el combo.
  - El nuevo quedó `publicado_web: true`, `usa_lotes: true`, con su foto.
  - El existente quedó con `usa_lotes: true` (lo activó solo) y su stock "por llegar" sumado.
  - El aviso final mostró correctamente "1 con foto quedó publicado" y "Todos quedaron con PEPS".
- La lista desplegable del combo se vio completa, sin cortes, al lado del campo.

## Pendiente del dueño

Los 4 productos de la captura (Base Ventilador, Antena Wifi, Enfriador Notebook, Lubricante Rex 40) se
cargaron ANTES de este cambio: siguen sin foto y sin publicar. Esta corrección no los toca solos — para
que se vean en sevelin.cl hay que agregarles una foto desde su ficha (ahí se publican con el cambio
normal) o volver a cargarlos con el botón 📷 nuevo si se prefiere repetirlos.
