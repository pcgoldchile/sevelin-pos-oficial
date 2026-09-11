# DISEÑO — Sistema de contenido orgánico automatizado

> **Esto es un diseño, no código.** Nada de lo que está acá está construido. Se escribió el
> 10-09-2026 en Opus, a pedido del dueño, para resolver las dudas técnicas que quedaron abiertas en
> `PLAN-CRECIMIENTO-2026.md` (sección "Pendiente para la próxima sesión") **antes** de comprometer
> una arquitectura.
>
> Las tres dudas se resolvieron con evidencia (documentación oficial y el propio repo), no de
> memoria. Las respuestas están en §1 y **una de ellas cambia el diseño entero**.

---

## 1. Las tres dudas técnicas, resueltas

### 1.1 ¿Claude Design genera video? — **No. Solo diseño estático.**

La skill `design` produce un canvas con artboards `.dc.html` que se exportan a **PNG o PDF**. No hay
línea de tiempo, ni audio, ni render de video. Tampoco hay ninguna otra herramienta de video en este
entorno: se verificó en la máquina del dueño y **`ffmpeg` no está instalado** (sí hay Node 24 y
Python 3.14).

**Lo que sí puede hacer Claude Design, y es más de lo que parece:** los **fotogramas** del Reel en
1080×1920 — portada con gancho, tarjeta de precio, tarjeta de comparación (garantía vs. informal),
tarjeta de cierre con la dirección y el WhatsApp. Eso es la parte del Reel que hoy se hace a mano y
sale distinta cada vez.

**Lo que falta y hay que resolver fuera:** movimiento, subtítulos quemados y audio. Tres caminos:

| Camino | Costo | Tiempo por pieza | Veredicto |
|---|---|---|---|
| **CapCut en el teléfono con una plantilla guardada** (subtítulos automáticos en español incluidos) | $0 | 3-5 min | **El correcto hoy** |
| API de render (JSON2Video ~US$17/mes, Shotstack ~US$25, Creatomate ~US$54) | US$17-54/mes | 0 min | Solo si la rutina sobrevive y el volumen sube |
| Grabar 20 segundos con el teléfono, con guion del POS | $0 | 2 min | **El que más vende** |

> **Nota comercial honesta, no técnica:** en este rubro y a esta escala, un video con cara, manos y
> voz real rinde bastante más que una animación de tarjetas. Lo caro no es producir el video: es
> decidir qué decir. Por eso el sistema que se propone abajo **produce el guion y los datos, no el
> archivo .mp4**. Una API de render de US$17/mes cuesta más al mes que el margen de una venta
> promedio ($10.686) — no se paga sola a 8 piezas al mes.

### 1.2 ¿Se puede automatizar TikTok de verdad? — **Técnicamente sí, prácticamente no todavía.**

La **Content Posting API** de TikTok exige app registrada, aprobación del scope `video.publish` y —
esto es lo que mata la idea — una **auditoría de la app**. Textual de la documentación: *todo el
contenido publicado por clientes no auditados queda restringido a modo privado*. O sea: sin
auditoría se puede automatizar la publicación, pero **la publica en privado y no la ve nadie**.
Además, para mandar el video por URL hay que **verificar el dominio**. La auditoría pide política de
privacidad publicada, video demo de cada scope y descripción del manejo de datos; una postulación
limpia toma 1-2 semanas.

Meta no es gratis tampoco: publicar Reels a Instagram por API pide **cuenta Instagram Business
vinculada a la Página**, permisos `instagram_basic` + `instagram_content_publish` y **App Review de
Meta (2-4 semanas)** más verificación de negocio. Sí permite hasta 100 publicaciones por API cada
24 horas — muy por encima de lo que necesitamos.

**La conclusión que reordena todo:** el cuello no es escribir el código de publicación (son ~60
líneas por red). El cuello es **ser dueño de una app aprobada**, y eso son entre 3 y 6 semanas de
trámite para publicar 8 piezas al mes.

**La salida barata: usar la app aprobada de otro.** Las herramientas de publicación ya pasaron esas
auditorías. **Metricool** tiene plan gratuito con 1 marca y **20 publicaciones al mes** —justo
nuestro volumen— y cubre Instagram, Facebook, TikTok, Google Business y más; **Publer** parte en
US$12/mes con más cuentas. Ninguna de las dos exige una sola llave de API nuestra. Publicación
simultánea real en las tres redes, sin App Review, hoy.

> **Regla que no cambia:** Facebook **Marketplace** desde el perfil personal —que es donde ocurren
> los $4,9M/mes— **no es automatizable por ninguna vía legítima**. Sigue a mano. Cualquier diseño
> que prometa lo contrario está prometiendo una suspensión de cuenta.

### 1.3 ¿Cómo encaja Claude Cowork con los dos repos? — **No encaja. Y hay una razón técnica dura.**

Cowork es la tercera pestaña de Claude Desktop, incluida en el plan que ya se paga. Sus proyectos sí
son carpetas locales, **pero sus tareas programadas no**: corren del lado de Claude, con los
archivos de la cuenta y los conectores, y **no se pueden atar a una carpeta del computador**. Esa
sola frase descarta a Cowork como motor de este sistema: lo que hay que leer (Supabase, catálogo,
márgenes) y lo que hay que tocar (`sevelin-pos-oficial`, `sevelin-tienda`) es exactamente lo que una
tarea programada de Cowork **no** alcanza.

Y por el otro lado tampoco publica: la lista de conectores es Google Workspace, Microsoft 365,
Notion, Slack, Stripe, QuickBooks, Zendesk y parecidos. **No hay conector de Meta ni de TikTok.**

**Veredicto: se descarta, igual que sugirió Gemini, pero por la razón técnica, no por "fricción".**
Coincide además con lo que el propio plan ya decía (§4): Cowork rinde cuando hay un proceso
repetible escrito que delegar, y eso es Fase 6-7, después de los SOP.

---

## 2. Dónde este diseño se aparta de la recomendación de Gemini

Gemini acertó en lo grande —descartar Cowork y no meter agentes autónomos a editar producción— y
esa parte se toma tal cual. Dos correcciones:

1. **Meter Make o n8n ahora sería contradecir el plan y no resolvería el cuello.** El §4 del plan
   dice, con razón, que *"los crons de Vercel hacen el trabajo gratis a tu escala"* y que cada
   herramienta nueva es una cuenta más, una llave más y un punto de falla más. Make/n8n **no evita
   el App Review de Meta ni la auditoría de TikTok**: cuando publican, publican con **su** app
   aprobada — que es exactamente lo que Metricool hace gratis y sin flujos que mantener. A 2 piezas
   por semana, el flujo automático ahorra unos 10 minutos semanales y agrega una suscripción, un
   webhook y un secreto más. No se paga.
2. **La aprobación por WhatsApp exige la WhatsApp Business API** — otra revisión de Meta, otro
   número, otro proveedor. El POS **ya tiene** panel, sesión, roles y el patrón de aprobación. La
   aprobación va ahí.

Lo que sí se toma de la propuesta de Gemini, entero: el contenido nace de datos reales del POS, y
**nada se publica sin aprobación humana**.

---

## 3. El punto incómodo que hay que decir antes de diseñar

La Página de Facebook tiene **34 seguidores** y el Instagram es chico. Publicar Reels orgánicos a 34
seguidores **no va a producir ventas medibles en dos o tres meses**. Si el sistema se justifica solo
por "las redes", no se justifica.

**Se justifica por reutilización.** Una pieza aprobada sirve para cuatro destinos, y el segundo es el
que factura:

1. Reel en Instagram / Facebook / TikTok (el que crece lento).
2. **La publicación de Marketplace** — el guion, la foto de portada y los tres argumentos son
   exactamente lo que hoy se escribe a mano, uno por uno, en el canal que produce $4,9M/mes.
3. **La respuesta de WhatsApp** — el mismo texto, ya revisado, en vez de improvisar.
4. **La ficha del producto** en la tienda (19 fichas siguen vacías).

Y por eso el sistema **no elige el producto al azar**: elige contra la aritmética del plan.

| Regla de selección | Por qué |
|---|---|
| **Joyas escondidas**: margen alto + rotación baja | Es problema de visibilidad, no de precio (Fase 2 del plan). Es literalmente para lo que sirve el contenido |
| **Capital dormido**: $2.425.541 en 42 productos que nunca vendieron | Rescatarlo casi duplica el capital productivo — la palanca #1 del plan |
| **Servicios técnicos**: 1 de cada 3 piezas | Son el 1,2% de los ingresos con **margen 100%** y hay taller propio. Nada rinde más por peso invertido |
| **Nunca** un producto sin foto, sin ficha o sin stock | Las mismas tres reglas que ya filtran el feed de v53. Un Reel de un producto agotado manda a una ficha que devuelve 404 |
| **Nunca** el mismo producto dos veces en 60 días | |

---

## 4. La arquitectura propuesta — Fase A (lo que se construiría)

**Principio de diseño: el POS produce el paquete, el humano publica.** En la Fase A **no entra al
POS ni un token de Meta ni de TikTok.** Es deliberado: evita App Review, evita la auditoría de
TikTok, evita que una llave filtrada publique en nombre del negocio, y hace imposible por
construcción la autopublicación sin revisión.

```
  Catálogo real (Supabase)
          │
          ▼
  [1] Selector de candidatos ──── reglas de §3 (reusa lo que ya calcula 🧠 Inteligencia)
          │
          ▼
  [2] Generador de guion (Gemini) ── mismo patrón que /api/productos/generar-seo
          │                          (GEMINI_API_KEY ya existe y funciona en producción)
          ▼
  [3] Cola semanal en el POS ─── Página Web → 📣 Contenido
          │                       borrador → [Carlos edita y APRUEBA] → aprobado
          ▼
  [4] Paquete listo: guion + subtítulos + copys por red + hashtags + link con UTM + fotos
          │
          ├──► CapCut (teléfono, plantilla fija) ──► video .mp4 con subtítulos
          │
          └──► Metricool ──► Instagram + Facebook (Página) + TikTok, simultáneo
                    │
                    └──► el mismo texto, copiado a Marketplace y a WhatsApp
```

### 4.1 Base de datos — `sql/NN-contenido-organico.sql`

Tabla `contenido_publicaciones` (idempotente, como todas):

| Campo | Nota |
|---|---|
| `id`, `creado_en` | |
| `tipo` | `producto` · `servicio` · `novedad` · `prueba_social` |
| `producto_id` | FK a `productos`, nullable (una novedad no tiene producto) |
| `fecha_programada` | la rutina fija de §4.4 |
| `estado` | `borrador` · `aprobado` · `publicado` · `descartado` |
| `guion` (jsonb) | `{gancho, cuerpo, cierre, cta, subtitulos:[]}` |
| `copy_ig`, `copy_fb`, `copy_tiktok`, `hashtags` | textos finales, ya editados por el dueño |
| `link_utm` | link único de la ficha, con `utm_source`/`utm_campaign` |
| `snapshot` (jsonb) | **precio, stock, marca y fotos del momento de aprobar** |
| `aprobado_en`, `publicado_en` | |
| `resultado` (jsonb) | vistas y mensajes, anotados a mano al cierre de la semana |

> **El `snapshot` no es un lujo.** Es la misma trampa que la garantía: si el precio cambia entre que
> se aprueba la pieza y se publica, el Reel muestra un precio que ya no existe. El panel avisa
> "el precio cambió de $X a $Y desde que aprobaste esto" y bloquea el copiado hasta reaprobar.

### 4.2 Backend — `api/index.js` (~250 líneas)

- `GET /api/pos/contenido/sugerencias` — aplica las reglas de §3. **Reusa los cálculos del panel
  Inteligencia**, no los reimplementa (misma regla que `construirFeedCatalogo()` y
  `resumenDeVentas()`: dos copias del criterio son dos catálogos distintos).
- `POST /api/pos/contenido/generar` — guion con Gemini, **copiando el patrón exacto de
  `/api/productos/generar-seo`** (línea 1137): `gemini-flash-latest`, `responseSchema` estricto,
  temperatura baja, y la regla anti-invención que ya rige en todo el proyecto — *solo datos que
  estén en el producto real; nunca inventar plazos, garantías ni precios de diagnóstico* (es la
  misma regla de los prompts oficiales de fichas y de servicios técnicos).
- `POST /api/pos/contenido/:id/aprobar` — congela textos y `snapshot`. Solo rol admin.
- `GET /api/pos/contenido/:id/paquete` — devuelve todo listo para copiar y pegar.
- **No existe ningún endpoint que publique.** A propósito.

### 4.3 Frontend — nuevo subtab `📣 Contenido` en Página Web (~300 líneas, `js/contenido.js`)

Cola de la semana · "Sugerir producto" · "Generar guion" · editor de los cuatro textos ·
**Aprobar** · "Copiar paquete" (un botón por red) · anotar resultado.

Reglas del proyecto que aplican sin excepción: todas las funciones con prefijo `contenido*` para no
colisionar en el ámbito global, `escHtml` en todo dato que entre al DOM, y los helpers canónicos de
`config.js` (`fmtCLP`, `num`, `todayISO`, `showToast`). Chequeo de funciones duplicadas y de `id`
duplicados antes de cerrar, y recompilar Tailwind si aparecen clases nuevas.

### 4.4 La rutina fija (esto es lo que decide si el sistema vive o muere)

| Día | Pieza | Origen |
|---|---|---|
| **Martes** | Producto de la semana | joya escondida o capital dormido |
| **Viernes** | Servicio técnico, o prueba social (una garantía cumplida, una reparación) | catálogo de servicios / taller |

Y un solo **día de producción: domingo, 30-40 minutos**. Se aprueban las dos piezas de la semana y
se graban los dos videos seguidos, uno detrás del otro. Lo que hace fracasar estas rutinas no es la
falta de automatización: es producir de a una, cada vez, cuando toca.

### 4.5 Medición — sin métricas de vanidad

Cada pieza lleva su **link único con UTM** a la ficha. `eventos_web` **ya registra las visitas**, así
que el panel puede mostrar, por pieza: visitas a la ficha, y mensajes anotados a mano. Seguidores y
"me gusta" se ignoran para decidir. Si en 8 semanas ninguna pieza mueve visitas ni conversaciones,
el sistema se apaga sin drama — y esa decisión también es parte del diseño.

---

## 5. Fase B — solo si la Fase A sobrevive 8 semanas seguidas

No antes, y con estos números sobre la mesa:

| Paso | Requisito real | Costo | Cuándo tiene sentido |
|---|---|---|---|
| Render automático del video | Plantilla 9:16 en JSON2Video / Creatomate / Shotstack | US$17-54/mes | Sobre ~20 piezas al mes |
| Publicar por API a Instagram + Página | IG Business + App Review de Meta (2-4 sem) + verificación de negocio | $0 | Cuando el Business Manager de B6 esté completo |
| Publicar por API a TikTok | Auditoría de la app (1-2 sem, política de privacidad + demo + manejo de datos) | $0 | Último. Sin auditoría publica en privado: no sirve |

---

## 6. Riesgos y límites, dichos antes y no después

- **Nunca autopublicar.** Es regla del dueño y en la Fase A está garantizada por arquitectura, no
  por disciplina: el POS no tiene con qué publicar.
- **Marketplace sigue a mano.** No hay forma legítima de automatizarlo desde un perfil personal.
- **13 productos sin foto** no pueden ser pieza de contenido. Es el mismo bloqueo que ya sacó
  productos del feed.
- **Gemini puede inventar.** El prompt lleva la regla anti-invención y el dueño aprueba cada texto;
  aun así, todo lo que diga plazos, garantías o precios se revisa con los ojos, no se confía.
- **El App Review de Meta no se empieza hasta cerrar B6** (Business Manager armado). Postular con
  la casa a medio ordenar es como se pierden 4 semanas.
- **Lo visual no se puede verificar en este entorno** (no hay navegador real): los fotogramas se
  razonan, los revisa el dueño en pantalla.

---

## 7. Qué haría falta para construir la Fase A

**De Carlos (antes de construir):** confirmar la rutina martes/viernes y el día de producción; crear
la cuenta de Metricool y conectar Página + Instagram Business + TikTok; decidir si el formato es
"tarjetas animadas" o "él hablando 20 segundos" (recomendación: lo segundo, con las tarjetas de
Claude Design como apoyo).

**De mí (una sesión):** `sql/NN-contenido-organico.sql`, los cuatro endpoints, el subtab `📣
Contenido`, y las plantillas de fotogramas 9:16 en Claude Design.

**Se sabe que funcionó cuando:** se publicaron 8 semanas sin saltarse una, y hay al menos una
conversación de WhatsApp o una visita a ficha que llegó por una pieza — no cuando suben los
seguidores.

---

## 8. Fuentes de las verificaciones de §1

- TikTok, *Content Posting API — Get Started*: https://developers.tiktok.com/doc/content-posting-api-get-started/
- TikTok Content Posting API en 2026 (auditoría y alternativas): https://www.postpeer.dev/blog/best-tiktok-posting-api
- Instagram Reels API, guía 2026 (Phyllo): https://www.getphyllo.com/post/a-complete-guide-to-the-instagram-reels-api
- Programar tareas recurrentes en Claude Cowork (Centro de ayuda de Claude): https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork
- Conectores de Cowork en 2026: https://www.usecarly.com/blog/claude-cowork-connectors/
- Comparación Metricool vs Publer 2026: https://publer.com/blog/metricool-vs-publer/
- Precios de APIs de render de video 2026: https://json2video.com/how-to/creatomate-alternative/
