# v168 — Plan de contenido: calendario con fases, aprobación desde el celular y aviso de cuándo dejar el PC encendido (19-10-2026)

Pedido del dueño: *"dame una notificación para saber cuándo dejar encendido el PC, y calendario de cómo vamos con el
contenido… con fases… que resalte de las demás… revisar y aprobar desde el teléfono… que después se eliminen las
imágenes para no guardar cosas de sobra"*.

- **Aviso del encabezado "📅 Contenido"** (azul a morado, el primero de la fila; late cuando hay algo para aprobar o el
  robot corre hoy): cuántas piezas esperan aprobación y cuándo dejar el PC encendido. Lleva a Redes sociales → Plan.
- **Redes sociales → 📅 Plan de contenido:** la ventana del PC ("Miércoles 22, de 10:00 a 13:00"), la próxima corrida
  del robot, qué hizo la última vez y el uso de Claude que anotó; las **fases** con su cuenta
  (Idea → Preparando → Para aprobar → Aprobado → Programado → Publicado) y el **calendario por día** con cada pieza
  (fotos o video, texto, fuentes) y sus botones: Aprobar, Pedir cambios (con nota: vuelve a Idea), Descartar, Ya está
  programado, Ya se publicó. Funciona en el celular (el POS es web).
- **"➕ Pedir una pieza":** video wow, reel, carrusel, post o historia; de producto, servicio, educativo, noticia o la
  tienda; para qué día y con una nota para el robot.
- `sql/107`: `contenido_plan` (las piezas), `contenido_robot` (la ventana, la última corrida y el uso) y el bucket
  público `contenido-temporal`. El robot escribe con la CLI de Supabase (ya logueada en el PC de la tienda): sin llaves
  nuevas. Los archivos se borran solos 3 días después de publicados o descartados (dentro del cron diario
  `/api/cron/mas-vendidos`, porque el plan Hobby de Vercel no admite un tercero).
- Endpoints: `GET /api/contenido/plan`, `GET /api/contenido/aviso`, `POST /api/contenido/plan`,
  `PUT /api/contenido/plan/:id` (todos admin).

Probado: servidor real con el doble de Supabase (pedir, formato inválido 400, aviso, cambios sin nota 400, cambios,
aprobar, publicado, plan, borrado de archivos en el cron, trabajador 403); maqueta con piezas de ejemplo (captura del
plan y del aviso). Subida con `supabase storage cp … ss:///contenido-temporal/… --experimental --linked` probada contra
el bucket real (el archivo se ve público).
