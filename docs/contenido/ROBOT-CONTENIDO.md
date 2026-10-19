# Robot de contenido de Sevelin — procedimiento

> Lo sigue la **tarea programada de Claude** en el PC de la tienda (Claude Desktop → tareas programadas), y también
> Claude cuando el dueño dice "corre el robot". Pedido del dueño (19-10-2026): contenido de calidad y premium, de
> productos, servicios, educativo y noticias, sin bombardear; él revisa y aprueba desde el celular; las imágenes las
> busca y arma el robot, y después se borran.
>
> **Regla de oro: calidad antes que cantidad.** Si una pieza no está buena, no se sube a aprobar: se deja en "idea"
> con la razón.

## 0. Cuándo corre y qué ventana avisa

| Corrida | Cuándo | Qué hace |
|---|---|---|
| **Principal** | **Miércoles 10:30** (el límite de Claude del dueño se reinicia el martes) | Arma la semana siguiente (jueves → miércoles) |
| Cola | **Viernes 11:00** | Solo lo que el dueño pidió con "➕ Pedir" o devolvió con "Pedir cambios". Si no hay nada, termina al tiro |

Al terminar, deja en `contenido_robot` la próxima corrida y la **ventana** que el POS muestra en el aviso
"📅 Contenido": `Miércoles 29, de 10:00 a 13:00` (o `Viernes 24, de 11:00 a 12:00`).

## 1. Cuánto por semana ("Equilibrado", elegido por el dueño el 19-10-2026)

| Día | Feed (post o carrusel) | Historia | Otro |
|---|---|---|---|
| Jueves | Producto | ✔ | |
| Viernes | | ✔ | **1 video wow** (Dreamina) |
| Sábado | Educativo **o** noticia (se alternan) | ✔ | |
| Lunes | Servicio técnico | ✔ | |
| Martes | Producto | | |

Total: **4 publicaciones de feed, 4 historias y 1 video wow por semana.** Nunca dos publicaciones de feed el mismo día.

## 2. Pasos de la corrida principal

Todo con la CLI de Supabase ya logueada (`npx supabase db query --file <ruta> --linked`, desde la carpeta del repo que
corresponde; rutas de Windows). **Nunca** se guarda una llave nueva en ningún archivo.

1. **Leer el estado** (base del POS):
   - `contenido_plan` de los próximos 10 días y lo que está en `idea` (pedidos del dueño y cambios con `nota_dueno`).
   - `contenido_redes` de 30 días: qué productos, estilos y frases ya se usaron (no repetir un producto antes de 14 días).
   - Productos con stock y foto, ordenados por el puntaje de Destacados (`productos_web.puntaje_destacado` en la tienda).
2. **Armar el plan de la semana**: una fila por pieza en `contenido_plan` (`estado = 'preparando'`, `pedido_por = 'robot'`),
   respetando la tabla de arriba. Primero lo que pidió el dueño.
3. **Producir cada pieza** (detalle en §3). Cada archivo final se sube al bucket:
   `npx supabase --workdir <repo POS> storage cp <archivo relativo> ss:///contenido-temporal/<AAAA-MM-DD>/<nombre> --experimental --linked`
   (la ruta de origen tiene que ser RELATIVA a la carpeta actual; con ruta absoluta de Windows falla). La URL pública es
   `https://wlqzxvcyynvblhyllzmh.supabase.co/storage/v1/object/public/contenido-temporal/<AAAA-MM-DD>/<nombre>`.
4. **Dejar cada pieza para aprobar**: `archivos` (`[{ruta, url, tipo}]`), `texto` (el pie de foto completo, listo para
   pegar), `fuentes` (`[{titulo, url}]`, obligatorio en educativo y noticia) y `estado = 'para_aprobar'`.
5. **Anotar la corrida** en `contenido_robot`: `ultima_corrida`, `ultimo_resumen` ("7 piezas, 1 video wow"),
   `proxima_corrida`, `ventana_texto` y `uso_claude` (el uso de la semana si la app lo deja leer; si no, "no disponible").
6. **Avisar al celular** del dueño (notificación de la app de Claude): "Hay N piezas para aprobar en POS → Redes sociales."
7. **Limpiar** `sevelin-contenido/salida` de más de 7 días. (Los archivos del bucket los borra solo el POS, 3 días después
   de publicados o descartados.)

## 3. Cómo se hace cada tipo

**Producto y servicio** — carpeta `Desktop/sevelin-contenido`:
- Datos reales: `npx tsx --env-file=.env.local scripts/exportar-contenido.mts ../sevelin-contenido/datos.json` (desde la
  tienda). El precio y el stock salen de ahí: **nunca se escriben a mano**.
- `node render.mjs <producto_pos_id>` → post, historia y reel. El texto del pie: el `instagram_texto` del producto (v139) o,
  si no tiene, el de `textos.md`. Variar estilo y frase según lo que diga el registro.

**Educativo** — `node render-tema.mjs guiones/<tema>.json` (plantilla `src/Tema.tsx`):
- Tema del banco (§5) que no se haya usado en 60 días.
- **Cada dato se comprueba en 2 fuentes serias** (fabricante, documentación técnica, medio especializado) y la principal
  va en `fuente`. Nada de cifras al ojo. Si no se puede comprobar, el dato no va.
- 3 a 5 láminas, una idea por lámina, frases cortas. La última lleva al servicio o producto de Sevelin que corresponde.

**Noticia** — `render-tema.mjs` con `"tipo": "noticia"`:
- De los últimos 7 días: hardware, PC, celulares, consolas, ciberseguridad. Que le sirva a alguien de Arica, o que lo
  haga decir "wow". Nada de política ni rumores sin confirmar.
- **Imágenes: solo de fuentes que lo permiten** (§4). La fuente de la noticia siempre visible en la pieza y en el texto.
- El texto lo escribe el robot con sus palabras: nunca se copia el artículo.

**Video wow** — Dreamina (`dreamina.capcut.com`) por Claude in Chrome, con la cuenta que ya está abierta:
- Imagen a video a partir de la foto real del producto (de `datos.json`). Instrucción en inglés, corta y concreta:
  `Product showcase of the {producto}, slow cinematic orbit, soft studio light, dark blue background, subtle reflections, 5 seconds, no text`.
  Para el ventilador: el viento moviendo algo liviano; para un monitor: la pantalla encendiéndose, etc.
- Antes de generar, mirar los créditos que quedan. **Un video por semana**: si no alcanzan, esa pieza se hace con
  `render.mjs` (reel de plantilla) y se avisa en `ultimo_resumen`.
- Revisar el resultado: si el producto se deforma o aparece texto raro, se descarta y se intenta una vez más.
- **Bajar el archivo pide el OK del dueño** (regla de Claude: toda descarga se pregunta). Si corre solo, el video queda en
  Dreamina → Assets y la pieza va a "para aprobar" con la nota "El video está en Dreamina → Assets: dime y lo bajo".
- Solo la cuenta que está abierta: el robot nunca cambia de cuenta para usar créditos de otra.

## 4. Imágenes: qué se puede y qué no (Ley 17.336)

Investigado el 19-10-2026. La ley chilena **no tiene un "uso justo" general**: las excepciones son una lista cerrada.
- **Art. 71 B (cita):** solo **fragmentos breves**, dentro de una obra propia, para cita, crítica, ilustración o enseñanza,
  **citando fuente, título y autor**. Una foto entera de un diario no es un fragmento.
- **Art. 71 Q (uso incidental):** solo incidental y excepcional, para crítica, comentario o enseñanza, y **sin ser una
  explotación encubierta**. Una tienda que la usa para atraer clientes no calza.
- **Art. 34:** el derecho de publicar una foto es del fotógrafo (o de quien la encargó).
- Los noticieros de TV pagan agencias (EFE, AFP, Reuters) o tienen convenios; que lo hagan no lo vuelve libre para
  Sevelin. Y el riesgo práctico es otro: **Meta borra la publicación con un reclamo de derechos, y varios reclamos pueden
  cerrar la Página**, que hoy es parte del canal que vende.

**Se usan, en este orden:**
1. **Fotos de prensa oficiales** de la marca (salas de prensa de NVIDIA, AMD, Intel, Samsung, Apple, Xiaomi, Sony,
   Nintendo…), que se publican para que los medios las usen, con el crédito "Imagen: <marca>".
2. Fotos **propias** (productos del catálogo, la tienda, el taller).
3. Bancos con licencia comercial: **Pexels** y **Unsplash** (crédito al autor cuando se pueda).
4. **Imágenes hechas con IA** (Dreamina) de la idea, sin logos ni personas reales.
5. Una **captura breve** del anuncio oficial (por ejemplo, el post de la marca), comentada y con la fuente (art. 71 B).

**Nunca:** fotos de diarios o sitios de noticias, de bancos con marca de agua (Getty, Shutterstock), de otras tiendas, ni
videos de YouTube de terceros.

## 5. Banco de temas educativos (se rotan)

Qué es un SSD · HDD vs SSD · Cada cuánto hacer mantenimiento al PC · Qué es la pasta térmica · Por qué se calienta el
notebook · Qué es formatear y cuándo conviene · Cómo cuidar la batería del celular · Qué cargador sirve para mi celular ·
Qué significa W en un cargador · HDMI vs DisplayPort · 60 Hz vs 144 Hz · Qué es la RAM y cuánta necesito · Qué es una
fuente certificada 80 Plus · Cómo saber si un cable es de carga rápida · Qué es un power bank y cuántas cargas da ·
Señales de que tu disco va a fallar · Cómo proteger tus archivos (respaldo) · Virus y programas basura: cómo
reconocerlos · Qué hacer si se moja el celular · Qué es un periférico inalámbrico vs Bluetooth.

## 6. Estilo (vale para todo)

- Tú, cercano, de Arica. Frases cortas. Un emoji por idea como mucho.
- **Nada inventado**: precios, stock y características salen de los datos; plazos, garantías y promociones solo si
  están escritos en el POS. Sin "el más vendido" si el dato no lo dice. Los Puntos Sevelin se nombran solo cuando estén
  encendidos en lo público.
- Siempre: WhatsApp +56 9 3575 0828 y "entrada por Av. Robinson Rojas". Hashtags: máximo 5 (#Arica #AricaChile + 3 del tema).
- **Publicar** no lo hace el robot solo: el dueño aprueba en el POS y después programa en Meta Business Suite, o le dice a
  Claude en el chat "programa lo aprobado" (con el sticker de enlace en las historias).
