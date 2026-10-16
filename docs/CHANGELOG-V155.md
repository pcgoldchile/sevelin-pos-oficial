# v155 · El dueño cambia la foto «¿Dónde estamos?» desde el POS (16-10-2026)

Migración `sql/100-foto-ubicacion.sql` (aplicada con la CLI el 16-10-2026). Cambia `api/index.js`, `js/api.js`,
`js/productos.js`, `index.html` e `img/donde-estamos.webp`.

## Qué pidió el dueño
"Esta será la nueva foto universal para Facebook, reemplázala por la que ya estaba." Y enseguida: "Dame una opción en
el POS para yo mismo reemplazar manualmente la imagen de Facebook."

## Qué quedó
- **`img/donde-estamos.webp` reemplazada** por la imagen nueva (1254×1254, letrero con celulares, computadores,
  WhatsApp, Instagram, mapa y San Rafael 896). Es la que se usa mientras no se cambie desde el POS.
- **Ficha de producto → Fotos**, junto al interruptor «📍 Agregar foto ¿Dónde estamos?»:
  - **👁️ Ver:** abre en grande la foto que se está agregando hoy.
  - **🔄 Cambiar** (solo admin): se elige una imagen del computador. Se pasa a webp, se achica si pasa de 1600 px o
    de ~900 KB y **no se cuadra ni se le pone fondo** (sale tal cual). Vale para todos los productos y todos los
    equipos desde la próxima descarga. Un trabajador ve el aviso "Solo el administrador puede cambiar esta foto".
- La usan "⬇️ Descargar todas" y el armado rápido de Facebook (`js/facebook-rapido.js`), los dos con
  `traerFotoUbicacion()`.

## Cómo se guarda
- `POST /api/foto-ubicacion` (admin): sube a `productos-imagenes/sitio/donde-estamos-<uuid>.webp`, guarda la URL en
  `textos_editables` (clave `foto_ubicacion`, `{ url }`) y borra la anterior del bucket. `GET /api/foto-ubicacion`
  (cualquier usuario) devuelve `{ url }` o `null`. Si es `null`, el POS usa `img/donde-estamos.webp`.
- La clave no está en `TEXTOS_EDITABLES`: `PUT /api/textos/foto_ubicacion` responde 404, así nadie la apunta a otra URL.
- **sql/100:** `fotos_sueltas_productos()` cuenta esa foto como usada. Sin esto, "🧹 Fotos sin usar" (v153) la habría
  borrado.

## Probado
- **Servidor real con el doble de Supabase:** 12 de 12. Sin foto → `null`. El trabajador → 403. El admin sube → 201 y
  el archivo queda en `sitio/`. GET devuelve la nueva. La segunda reemplaza y borra la primera del bucket. Una sola
  fila. Más de 1 MB → 413, sin imagen → 400, y por `/api/textos` → 404.
- **Maqueta del POS:** los dos botones se ven, "Ver" abre la imagen nueva (1254 px) y la conversión a webp de la
  imagen deja 309 KB.
- **No probado en vivo:** subir una foto real al bucket de producción. Se prueba con el primer "🔄 Cambiar".
- Hechos `node --check` y los dos chequeos de colisión. Ojo: `elegirFotoUbicacion` ya existía en `js/ubicaciones.js`,
  por eso la nueva se llama `elegirFotoDondeEstamos`.
