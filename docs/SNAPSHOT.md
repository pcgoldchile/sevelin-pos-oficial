# SNAPSHOT — Sevelin POS
> Léelo (o pégalo) al abrir un chat nuevo o al llevar el proyecto a otra IA.
> Actualiza SOLO este archivo al cerrar una sesión. Para el detalle completo, ver `docs/README.md`.
> Para saber qué otro documento leer según lo que necesites, ver `docs/README-DOCS.md`.
>
> **⚠️ EL DUEÑO TRABAJA EN SONNET.** Si la tarea que te mandó conviene hacerla en Opus, **avísale en
> una línea antes de empezar y espera su respuesta**. El criterio completo está en `CLAUDE.md`,
> sección "Modelo: avísame si esta tarea pide Opus".

**Fecha:** 09-09-2026 · **Versión activa del POS:** v57 (sin cambios hoy) · **Lo de hoy pasó todo en
`sevelin-tienda`:** la tienda cobra **solo por Khipu** (transferencia). **Flow quedó APAGADO** en el
código (`FLOW_HABILITADO = false`), lo que además cerró un riesgo vivo: apuntaba al **sandbox**, así
que la opción "tarjeta" llevaba a un pago de PRUEBA que dejaba el pedido `PAGADO` sin que entrara un
peso. El dueño **postula a Transbank Webpay Plus directo** (2,08% débito / 2,80% crédito con IVA,
contra 3,44% de Flow) y decidió **absorber** la comisión: el **precio diferenciado quedó construido,
probado y apagado** (`RECARGO_CHECKOUT_TARJETA = 0`) porque con Transbank un 3% habría excedido la
comisión del débito, y el TDLC solo lo permite cuando no la excede. También se publicó la página
**`/preguntas-frecuentes`** y se cerró una **alerta crítica de seguridad de Supabase** (RLS faltaba
en `visitas_activas`; los datos de clientes nunca estuvieron expuestos). Detalle completo en el
SNAPSHOT de `sevelin-tienda`.

**Fecha:** 08-09-2026 · **Versión activa:** v57 · **También ese día, en `sevelin-tienda`: Khipu
desplegado pero APAGADO** (transferencia bancaria como segundo medio de pago). Sin `KHIPU_API_KEY` en
Vercel el checkout se comporta exactamente como antes — verificado en producción. Se enciende solo al
agregar la variable, así que el momento riesgoso quedó separado del despliegue. **La `notify_url` NO
se configura en el panel de Khipu**: viaja en cada cobro (`notify_api_version 3.0`); esa casilla del
panel es del formato antiguo 1.3 y llenarla rompería el webhook. Detalle en el SNAPSHOT de
`sevelin-tienda`.

**Versión activa del POS:** v57 (**informe semanal**, ver `docs/CHANGELOG-V57.md`).
Nueva sub-pestaña **Finanzas → 📅 Semanal**: los 5 números del lunes ya comparados con la semana
anterior, alertas, top 3 por margen y botón **📋 Copiar** que deja el informe listo para pegar en
WhatsApp. `GET /api/pos/informe-semanal` — sin parámetro devuelve la última semana CERRADA (lun–dom).
**Refactor previo:** se extrajo `resumenDeVentas()` del endpoint de Inteligencia y ahora los dos
paneles usan la misma función — dos copias de la fórmula del margen son dos números que se
contradicen en pantalla. Verificado que no movió ningún valor. **El texto se redacta en el servidor**
(si se armara en el navegador, pantalla y WhatsApp dirían cosas distintas), **el margen se compara en
PUNTOS y no en %**, y si la semana previa fue 0 dice "sin comparación" en vez de inventar un 100%.
Las visitas de la tienda van en su propio `try/catch`: si el segundo Supabase no responde, el informe
igual sale. **Primer informe real (31-08 al 06-09): 36 ventas ▲80%, facturado ▲17%, pero utilidad
▼7%, ticket ▼35% y margen 6,4 puntos abajo** — se vendió más y se ganó menos, justo lo que un total
mensual esconde. Web: 852 visitas → 2 pedidos (0,2% de conversión, primer dato real).

**Versión anterior:** v56 (**Garantías accesible para el rol trabajador**, ver
`docs/CHANGELOG-V56.md`). Los 4 endpoints del módulo pasaron de `auth(true)` a `auth()`: el módulo
era visible para trabajador desde v48 pero todos sus endpoints eran solo-admin, así que entraba y
recibía errores. **Es seguro porque ninguna respuesta del módulo trae costo, precio, utilidad ni
margen** — y esa condición quedó escrita en el encabezado del módulo: si alguna vez se le agrega una
cifra de plata a estos endpoints, hay que volver a evaluar el permiso. Sin token siguen dando 401.

**Versión anterior:** v55 (**aviso de garantía por vencer**, ver
`docs/CHANGELOG-V55.md`). Nueva sub-pestaña **Garantías → ⏰ Por vencer**: a quién le vence la
garantía pronto y todavía no se le avisó, con botón que abre **WhatsApp con el mensaje ya escrito** y
marca de "avisado" (`sql/39`: `venta_items.aviso_garantia_en` y `ordenes_trabajo.aviso_garantia_en`,
timestamp y no booleano, para poder reavisar sin perder el registro). `GET /api/garantias/por-vencer`
+ `POST /api/garantias/:tipo/:id/aviso`; **el vencimiento NO se recalcula**, reutiliza
`calcularEstadoGarantia()` de v48. Va por WhatsApp manual porque es el canal real de Sevelin y el
correo sigue bloqueado (Resend, B2) — cuando se destrabe, el mismo endpoint sirve para automatizarlo.
**Hoy el panel está vacío a propósito y lo explica**: las ventas parten el 03-08-2026 con garantía de
6 meses, así que la primera vence el **03-02-2027** (149 días); el selector de 6 meses ya muestra las
210 que vienen. **De esas 210, solo 1 tiene WhatsApp registrado** (el campo existe desde v52) — quien
no quede registrado hoy no se le puede avisar en febrero. **Trampa de jsdom anotada**: disparar
`DOMContentLoaded` a mano después del `eval` lo ejecuta DOS veces (jsdom ya lo emite solo) y duplica
los listeners delegados; en las pruebas hay que esperar un tick, no dispararlo.

**Versión anterior:** v54 (**marca del producto**, ver
`docs/CHANGELOG-V54.md`). `productos.marca` (`sql/38`, aplicada) + campo en el modal con `<datalist>`
de las marcas ya usadas (si no, quedan "MSI", "msi" y "M.S.I" como tres marcas distintas en el feed).
El feed de Meta/Google usa la marca real y deja "Sevelin" solo de respaldo. Chip "publicados sin
marca" en la auditoría. **Regla única para llenarla: la marca se carga SOLO cuando el propio NOMBRE
del producto declara al fabricante** — un "Cargador para notebook HP" NO es marca HP, y Google
penaliza el dato incorrecto más de lo que premia el dato presente; el patrón "para X"/"compatible con
X" queda siempre vacío. Con esa regla se cargaron **47 marcas** (HP 7, Master-G 6, Kingston 6,
Kronos 4, Samsung 3, MSI, AOC, Caixun, NewGen 2 c/u, y 13 más de una): el feed pasó de 1 a **37 de 99**
filas con marca real y los publicados sin marca bajaron de **113 a 66** (la mayoría genéricos de
verdad — cables, adaptadores, tornillos — está bien así). Los 3 casos "Funda para Samsung" /
"compatible con Samsung TV" quedaron vacíos a propósito.
**El lado tienda también está desplegado y verificado** (`productos_web.marca`, el receptor de sync
la mapea, la ficha la muestra sobre el nombre y el JSON-LD incluye `brand` solo cuando existe): se
hizo en un **commit separado a pedido del dueño**, porque `sevelin-tienda` tiene cambios sin
commitear de la sesión anterior (Khipu, toca el checkout) que **siguen sin commitear y sin
desplegar**, intactos. Ver `docs/CHANGELOG-V54.md` §4 para cómo se aisló (el único archivo mezclado
era `src/lib/tipos.ts`) y por qué hubo que **re-empujar** los 48 productos con marca después del
despliegue: se habían guardado antes de que el receptor conociera el campo. **Regla para la próxima
vez: primero desplegar el receptor, después cargar los datos.** Verificado en vivo: 4 fichas del
sitio real devuelven el `brand` correcto.

**Versión anterior:** v53 (**feed de catálogo para Meta y Google**, ver
`docs/CHANGELOG-V53.md`). `GET /api/pos/feed-catalogo` + sub-pestaña "Página Web → 📣 Feed de
catálogo": genera el CSV que comen Meta Commerce Manager y Google Merchant Center, para dejar de
escribir cada publicación de Marketplace a mano (ese canal produce casi toda la venta). Los datos
salen de `productos_web` (ahí está el `sku` ya resuelto que forma la URL real), no de `productos`.
**Bug real encontrado al verificar:** la tienda devuelve **404** en la ficha de un producto con
`stock_web = 0` (`obtenerProductoPorSku()` filtra por `stock_web.gt.0`), así que un tercio de los
links del feed estaban rotos — se omiten esos productos, porque un feed con links rotos hace que la
plataforma rechace el catálogo entero. Resultado real: 130 publicados → **99 al feed, 31 fuera**
(13 sin foto, 18 sin stock), con la lista de omitidos y su motivo a la vista antes de subir.

**Versión anterior:** v52 (**contacto del cliente en la venta — bloqueo B5 del
plan**, ver `docs/CHANGELOG-V52.md`). `ventas.cliente_telefono`/`cliente_correo` (`sql/37`, aplicada),
campo "WhatsApp del cliente" en el POS y en el modal de editar venta (se puede rellenar DESPUÉS: el
cliente da el número al coordinar la entrega), teléfono como link directo a `wa.me` en el detalle de
la venta, columna en la exportación, y métrica de recompra real en el panel Inteligencia. El número
se guarda **normalizado a puros dígitos con código de país** (`+56 9 8765 4321` y `987654321` quedan
iguales) — si no, el mismo cliente cuenta como dos y la recompra miente. **Todo opcional: una venta
nunca se cae por el teléfono.** Motivo: 168 de 169 ventas eran anónimas, y eso bloquea completos los
objetivos de fidelización y recompra. Probado de punta a punta contra producción (PUT real, revertido)
+ prueba de inyección en el link de WhatsApp.

**Versión anterior:** v51 (**Fase 1 del plan de crecimiento — panel Finanzas →
🧠 Inteligencia**, ver `docs/CHANGELOG-V51.md` y `docs/PLAN-CRECIMIENTO-2026.md`). Nuevo
`GET /api/pos/inteligencia` + `js/inteligencia.js`: margen real por producto, los cuatro cajones del
catálogo (ancla/gancho/joya/lastre con cortes por mediana, no por umbral inventado), capital dormido,
auditoría de calidad de datos del catálogo y alertas ordenadas por plata en juego. Va dentro de
Finanzas, así que hereda el PIN y la expulsión por inactividad.
**Cifras reales medidas contra producción (167 ventas, 03-08 al 06-09-2026):** $5.811.000 facturado ·
margen 30,9% · ticket $34.796 · **1,28 productos por venta** · **$1.954.370 de capital dormido (41%
del stock, 43 productos que nunca vendieron)** · 10 productos hacen el 44% del margen ·
**166 de 167 ventas SIN cliente identificado** · 165 de 167 retiro y pago presencial.
**Dato de negocio que cambió el plan:** el dueño confirmó que casi todas las ventas nacen en
**Facebook Marketplace desde su cuenta PERSONAL**, se coordinan por WhatsApp y terminan presenciales
— la tienda web es herramienta de cierre, no canal de captación (~4 pedidos históricos). Eso agregó
dos bloqueos nuevos al plan: **B5** (no se registra quién compra) y **B6** (todo el negocio cuelga de
una cuenta personal de Facebook). También se corrigió el **HP ProDesk 400 G1 (id 181) a
reacondicionado** (confirmado por el dueño; tercer HP con el mismo problema) y se verificó que el
trigger lo sincronizó solo a la tienda.

**Fecha:** 07-09-2026 · **Versión activa:** v50 (**descuento en el POS, notificaciones, catálogo
grande, Khipu base, migración de Google Merchant Center fuera de Tiendanube** — ver
`docs/CHANGELOG-V50.md` para el detalle completo. Resumen: descuento monto/porcentaje sobre el total
de la venta [nunca por ítem, `sql/35`], detalle de venta con descuento prorrateado por producto solo
para mostrar, campana de notificaciones de pedidos web en el header, seguimiento de última
actualización de medidas/peso [`sql/36`], compra de prueba real en sandbox de Flow verificada de
punta a punta [hallazgo: un pago sandbox SÍ descuenta stock real], 8 fichas de producto con
marca/modelo investigadas por internet + 2 servicios mal clasificados corregidos, 27 productos sin
categoría categorizados y publicados [3 subcategorías nuevas: Computadores→Nuevos/Reacondicionados,
Cables y Adaptadores→Cables de Poder], 13 monitores reacondicionados nuevos [9 modelos únicos, fotos
reales corregidas], base de integración con Khipu en `sevelin-tienda` [sin credenciales todavía,
apagada sola], y la cuenta de Google Merchant Center desvinculada de Tiendanube + fuente
"Encontrado por Google" activada como reemplazo + `sevelin.contacto@gmail.com` agregado como admin
[pendiente de verificar]. **Pendiente real que deja esta sesión, ver `docs/CHANGELOG-V50.md`.**)

**Fecha:** 01-09-2026 · **Versión activa anterior:** v49 (**sesión de seguridad + catálogo** — auditoría SAST
propia + contra-auditoría red-team, remediación de los hallazgos reales: freno de login ahora lee la
IP real de `X-Forwarded-For` [antes spoofeable], throttle de intentos movido a Redis (Upstash,
persistente entre instancias serverless, con respaldo en memoria si faltan las variables — **falta
confirmar que están puestas en Vercel del POS, ver Pendiente**), comparación del secreto de sync con
`timingSafeEqual`, helper único `patronIlike()` para escapar filtros PostgREST (reemplazó 2 copias),
~102 respuestas de error saneadas (`enviarErrorBD`) para no filtrar mensajes crudos de Postgres al
cliente. **Fix real de bug de datos**: `subcategoria_web` faltaba en `CAMPOS_PRODUCTO` — se guardaba
la subcategoría en el modal pero el backend la descartaba en silencio; corregido y reverificado con un
PUT de prueba antes de reasignar el catálogo. **Fix del editor de Descripción (Quill)**: pegar texto
de Gemini con Markdown (`**negrita**`, links) quedaba sin convertir — el listener propio corría
DESPUÉS del de Quill (bubble phase); movido a capture phase + `stopPropagation()` en el contenedor.
**Catálogo**: 4 subcategorías nuevas creadas y 13 productos reasignados (ver
`docs/CHANGELOG-V49.md` si existe, o el historial de chat), 2 productos recategorizados, 1 producto
con descripción corrupta (Adaptador HDMI a VGA) reescrito, 44 productos con el pie fijo
"Envíos/WhatsApp/Instagram/Garantía/Pago" duplicado limpiados en lote (ese pie ahora es un
componente real en la tienda, `InfoEnvioProducto`, no texto que escribe la IA — el prompt de Gemini
ya no debe pedirlo). Integración con Starken como SEGUNDA opción de courier (nunca reemplaza
Chilexpress) armada en `sevelin-tienda`, verificada contra el ambiente QA real de Starken — en espera
de credenciales de producción (correo enviado a Starken, respuesta pendiente). Fix del bug real donde
el buscador de direcciones de la tienda solo mostraba sugerencias de Arica en cualquier región — se
quitó la restricción geográfica dura, ahora es nacional. SEO real por producto agregado en la tienda
(`generateMetadata`, JSON-LD `Product`) como base para conectar Google Ads/Merchant Center y Meta más
adelante (cuentas creadas, faltan IDs — ver Pendiente). · **También v48**: **módulo 🛡️ Garantías** —
submódulos Productos y
Servicios, buscador en vivo con debounce por N° de venta/OT, cliente, producto/SKU/S-N o equipo;
productos ganan `condicion` [nuevo/reacondicionado] y `meses_garantia` editables en el modal
[siempre parten en 6], con snapshot en `venta_items` al vender; las Órdenes de Trabajo fijan su
`meses_garantia` recién al entregar el equipo — ver `sql/31-garantias.sql`, aplicada en producción;
también v47: **módulo Pedidos por Encargo** (dropshipping/retiro en tienda) — checkbox
`es_pedido_encargo` en el modal de producto, sincroniza a `sevelin-tienda` vía el trigger
existente, panel "Pedidos Web" con filtro y badge para distinguirlos — ver `sql/30-pedidos-por-
encargo.sql`; también un fix de diseño del modal de producto: la barra superior ("Editar
Producto") pasó de un negro plano a vidrio esmerilado translúcido, las fotos ahora aceptan
selección/arrastre MÚLTIPLE de una vez (antes una por una) y se pueden reordenar arrastrando con
el mouse además de las flechas de siempre — nuevo endpoint que guarda el arreglo completo de fotos
validando que sea el mismo conjunto) · **En producción:**
https://sevelin-pos-oficial.vercel.app · **Rama:** `main`.

**Estado real (verificado en producción, no de memoria):** `sql/23` a `sql/26` (categorías +
subcategorías + umbral de stock + `es_servicio` en `venta_items`) **aplicados** vía Supabase CLI. El
bug crítico de `descontar_stock_venta` (columna ambigua) **verificado como corregido**. 114
productos en el catálogo, 86 con SKU publicados y clasificados en 12 categorías, 75 con fotos
reales. **Rediseño visual completo a paleta gamer cian/magenta** (Fase 1, coherente con
`sevelin-tienda`) — incluyó corregir un bug de build que llevaba tiempo activo sin que nadie lo
notara: `css/tailwind-input.css` tenía CSS ya compilado adentro en vez de las directivas
`@tailwind`, así que `npm run css` no recompilaba nada de verdad desde hacía un tiempo (ver v32).
**Editor de Descripción con texto enriquecido** (Quill: negrita, listas, links). **Separación
productos/servicios** por ítem de venta, visible en Balance. **Fotos de producto** en la tabla, en
"Ingresar producto" y en el Carrito. **Fix de seguridad real**: el PIN de Finanzas no cubría los
sub-ítems nuevos del sidebar (cualquiera entraba a Gastos Fijos sin PIN) — corregido y verificado.
Cierre de sesión automático a los 60s de inactividad, en toda la app. **Cancelar pedidos web** con
reposición de stock opcional y **correo de cancelación al cliente** (vía `sevelin-tienda` + Resend
— cuenta creada, pero sin dominio verificado: los correos a clientes reales fallan en silencio
hasta verificar un dominio en Resend, ver "Pendiente" #1).

---

## Stack (fijo, no re-analizar)
Node/Express (`api/index.js`, serverless en Vercel) · JavaScript **vanilla** de ámbito global
(`js/*.js`, todos comparten scope) · Supabase/PostgreSQL (acceso solo desde el backend con
`service_role`) · JWT en `sessionStorage` · Tailwind **compilado** (`css/tailwind.css`, no CDN).

## Tres reglas que evitan romperlo (críticas)
1. **No dos funciones globales con el mismo nombre** en distintos `js/*.js`: la segunda pisa a la
   primera en silencio. El único helper de escape es `escHtml` (`js/config.js`) — no crear otro.
   Chequeo obligatorio tras editar (captura indentadas y async):
   ```
   for f in js/*.js; do grep -oP '^\s*(async\s+)?function\s+\K[A-Za-z_$][\w$]*' "$f"; done | sort | uniq -d
   ```
   Debe salir VACÍO. Igual de peligroso: usar en el frontend una función que solo existe en el backend
   (ej. `fechaHoyChile` → en el front es `todayISO()`), da `ReferenceError` silencioso.
2. **No dos elementos con el mismo `id`** en `index.html`: `getElementById` toma el primero y el otro
   queda muerto. Chequeo: `grep -oP 'id="\K[^"]+' index.html | sort | uniq -d`.
3. **Recompilar Tailwind** si agregas clases: `npx tailwindcss -c tailwind.config.js -i css/tailwind-input.css -o css/tailwind.css --minify`.
   Helpers canónicos en `js/config.js` (carga primero): `fmtCLP`, `escHtml`, `num`, `todayISO`, `showToast`. Reutilízalos.

## Cómo probar (no hay navegador real en el entorno de dev)
- Backend: doble en memoria de Supabase (mock de `createClient` vía `require.cache`).
- Frontend: **jsdom** concatenando los `js/*.js` en orden y evaluando en un `window`.
- Validar SQL: `python3 -c "import pglast; pglast.parse_sql(open('sql/NN.sql').read())"`.
- `node --check` en cada `.js` tocado. jsdom se borra al instalar playwright; reinstalar con
  `npm install jsdom --no-save`. **No** hay Chromium (sin red para descargarlo).

---

## Estado: qué está HECHO (v10 → v19)
- **Finanzas (v10):** gate de PIN al entrar, grid de 4 tarjetas (efectivo/banco/total/resguardo),
  ajuste manual de saldos con justificación e historial, checklist de gastos fijos del mes con cuadre,
  aportes de capital, recálculo de canales al editar compras.
- **v11:** fix casilla "Editar hora de la venta" (z-index + campo disabled).
- **Escáner (v12):** captura manual por botón + carga de foto en memoria (no se sube) + linterna +
  responsive móvil. Emite el CustomEvent `escaner:codigo`.
- **Caja en el POS (v13):** apertura con fondo, movimientos de caja chica (ingreso/egreso), cierre con
  arqueo ciego. Sin caja abierta, el cobro se bloquea. Módulo `js/caja.js`.
- **Despacho + envíos (v14):** tras el DTE, retiro/despacho con dirección, notas, origen de pago y
  comisión de pasarela (2.9%+IVA auto). En el Historial: orden ASC/DESC, filtro por estado de envío, y
  columna Envío editable (estado + n° de seguimiento).
- **Gastos programados (v15):** compras a futuro (tarjeta de crédito, cuotas). Se registran pendientes
  con su fecha y al vencer se materializan solas como compras. Botón "🗓️ Gastos pendientes" en Gastos.
- **Buscador universal de ventas (v16):** un campo en el Historial que busca por producto/SKU/código de
  barras/fecha/fecha+hora/total, con sugerencias en vivo. El barcode se resuelve contra el catálogo.
- **Ventas por pagar:** estado PENDIENTE, filtro con badge, botón cobrar por fila, modal de cobro. (Ya
  existía desde antes; confirmado funcionando.)
- **v17:** fix `id` duplicado `kpiUtilidadNeta` entre Balance e Historial → el de Historial pasó a
  `kpiUtilidadNetaPos`.
- **BIZ-02 atómico (v18):** el chequeo de stock y el descuento, para productos sin lotes, ahora pasan en
  una sola transacción SQL con `SELECT ... FOR UPDATE` (función `descontar_stock_venta`, igual enfoque
  que `fifo_consumir` para productos con lotes). Cierra la condición de carrera donde dos ventas
  concurrentes del mismo producto podían pasar ambas la validación y sobrevender. Ver
  `docs/CHANGELOG-V18.md`.
- **v19:** dos fixes de sesión/backend — (1) tolerancia de reloj (`clockTolerance: 120`) en
  `jwt.verify()` (`auth()` en `api/index.js`), para que un pequeño desfase de reloj entre instancias
  serverless no rechace sesiones válidas; (2) `POST /api/compras` y `PUT /api/compras/:id` (guardar un
  gasto en Finanzas → Gastos) ahora envuelven el handler en `try/catch` y `clasificacionValida()` ya no
  confunde un error real de conexión con "clasificación inexistente": antes, un fallo inesperado dejaba
  la petición colgada sin ninguna respuesta (fallo silencioso); ahora siempre responde con un mensaje
  claro. Ver `docs/CHANGELOG-V19.md`.
- **v20:** unificados los 5 helpers de escape de HTML en uno solo, `escHtml` (`js/config.js`). Se
  eliminaron las definiciones duplicadas `escaparTexto` (balance.js), `escaparHtmlHist` (historial.js),
  `escaparHTML` (print.js) y `escaparRep` (reportes.js), y se migraron todas sus llamadas —incluida
  `etiquetas.js`, que usaba la de print.js— a `escHtml`. Sin cambio de comportamiento visible: `escHtml`
  es un superset (también escapa la comilla simple `'`). Ver `docs/CHANGELOG-V20.md`.
- **v21:** protección por inactividad + ventana de gracia del PIN en Finanzas (`js/finanzas-gate.js`).
  Con la vista Finanzas activa, 60s sin interacción (`mousemove`/`click`/`keydown`/`touchstart`)
  redirigen solos al POS. El permiso de un solo uso (`finanzasDesbloqueada`) se reemplazó por un
  timestamp (`finanzasUltimaActividad`): reentrar dentro de los 60s desde la última actividad o el
  último PIN válido no vuelve a pedirlo; pasado ese tiempo (incluido el caso de haber sido expulsado
  por inactividad, que no da ventana de gracia) sí lo exige. No existe aún una vista "Configuración"
  en el frontend, así que el mecanismo solo cubre Finanzas (que incluye el sub-panel Balance) pero
  quedó escrito genérico para sumar otra vista sensible sin rehacerlo. Ver `docs/CHANGELOG-V21.md`.
- **v22 (fix crítico):** `descontar_stock_venta` (v18/v19) fallaba con "column reference 'stock' is
  ambiguous" en **toda** venta que no fuera 100% de productos con lotes — el nombre de columna de salida
  de la función (`stock`, de `RETURNS TABLE`) chocaba con `productos.stock` dentro del `UPDATE`. Corregido
  en `sql/20-fix-descontar-stock-ambiguo.sql` (usa el valor ya leído bajo el lock en vez de releer la
  columna). **Hay que correr `sql/20-...sql` en Supabase → SQL Editor** para que el fix llegue a
  producción (no se aplica solo, las migraciones SQL son manuales). Ver `docs/CHANGELOG-V22.md`.
- **v22 (chore):** el `catch` de `auth()` (`api/index.js`) devolvía siempre el mismo mensaje genérico
  al cliente sin importar la causa real del rechazo del JWT (vencido, firma inválida, malformado).
  Se agregó un `console.warn` que distingue el tipo de error real en los logs del servidor (Vercel),
  sin cambiar la respuesta al cliente. Esto fue lo que permitió encontrar la causa real de v23 (abajo).
- **v23 (fix):** "JWT issued at future" en Servicio Técnico → Órdenes de Trabajo (`GET /api/ot`) no era
  el JWT propio del POS (ver v22 arriba) sino PostgREST rechazando transitoriamente la llave
  `service_role` — se ve sobre todo justo después de rotarla en Supabase (Settings → API → Reset), unos
  segundos mientras el nuevo token se propaga a todos los nodos que lo validan. `GET /api/ot` ahora
  reintenta (`consultarConReintento`, hasta 3 intentos con 400ms de pausa) cuando el mensaje de error de
  Supabase matchea ese patrón; si persiste tras los 3 intentos, responde 503 con un mensaje claro en vez
  del texto crudo de Supabase, y loguea el detalle real en el servidor. Un error de Supabase que NO sea
  de este tipo (ej. una columna inexistente) sigue respondiendo 500 de inmediato, sin reintentar. Ver
  `docs/CHANGELOG-V23.md`.
- **v24 (e-commerce Fase 0, cimientos):** en la rama `feature/fase-0-ecommerce`. El stock atómico
  (0.1/0.2 del plan de Fase 0) ya estaba resuelto desde v18/v22 (`descontar_stock_venta`, no se tocó).
  Se agregó: `sql/21-imagenes-web.sql` (columnas `imagen_urls`, `publicado_web`, `descripcion_web`,
  `precio_web`, `categoria_web` en `productos`); bucket `productos-imagenes` documentado
  (`docs/README-BUCKET-IMAGENES.md`, no creado todavía — falta hacerlo a mano en Supabase); pipeline de
  fotos (Canvas 1000×1000 → webp) + controles de tienda web en el modal de producto (`js/productos.js`,
  `index.html`); endpoints `POST`/`DELETE /api/productos/:id/imagen` y
  `GET /api/productos/auditoria-envio` (diagnóstico, no corrige nada). Ver `docs/CHANGELOG-V24.md` para
  el detalle completo y el orden seguro de despliegue. **Ojo:** `ajustarStock()` sigue sin ser atómico
  para repuestos internos y otros call-sites fuera de `POST /api/ventas` — no se tocó en esta fase (ver
  nota para la Fase 1 en el changelog).
- **v25 (e-commerce Fase 3, una sola ruta):** `POST /api/interno/ajustar-stock` — la ruta que
  quedó pendiente desde la nota de v24 de arriba ("cuando se construya... en la Fase 1"). Se
  construyó recién ahora porque la Fase 1 de `sevelin-tienda` no la necesitó y la Fase 3 (checkout)
  sí. Protegida con `authSync` (secreto compartido `SYNC_SECRET`, no JWT), reutiliza
  `descontarStockNoLotes()` tal cual. Único cambio de esta versión — el resto de la Fase 3 vive en
  `sevelin-tienda`. Ver `docs/CHANGELOG-V25.md`.
- **v27 (carga masiva del catálogo web):** `scripts/sincronizar-catalogo-web.js` — utilidad de una
  sola vez que empuja todos los productos ya marcados `publicado_web=true` a `sevelin-tienda`,
  reutilizando el mismo contrato del Database Webhook (`POST /api/sync/producto`). Resuelve el
  "primera carga del catálogo" que quedaba pendiente desde la Fase 1 (el webhook solo cubre
  cambios futuros). Nueva variable `TIENDA_SYNC_URL` en `.env.example`. No toca `api/index.js`.
- **v26 (e-commerce Fase 5, panel "Pedidos Web"):** `GET`/`PUT /api/pos/pedidos-web` — primera vez
  que el POS habla con un SEGUNDO Supabase (`dbWeb`, el proyecto Supabase Web de `sevelin-tienda`,
  nunca mezclado con `db`). `GET` lista `pedidos_web` (filtro opcional `?estado=`); `PUT` solo
  acepta transicionar a `PREPARANDO`/`ENVIADO`/`ENTREGADO`/`CANCELADO`, y rechaza pedidos que
  sigan en `CREADO`/`FALLIDO` (nada que despachar sin pago confirmado — esos estados los controla
  el webhook de Flow en `sevelin-tienda`, no este panel). Ambas rutas con `auth(true)`, tal como
  pide el README maestro. Nueva sección `view-pedidos-web` en `index.html` + `js/pedidos-web.js`
  (nuevo), siguiendo el patrón de navegación (`data-view`/`admin-only`) y el molde del modal de
  envío de `js/historial.js` (badge de estado + modal con `<select>` + tracking). Ver
  `docs/CHANGELOG-V26.md`.

## Esquema SQL: última migración
`sql/27-utilidades-iva-credito.sql` (v40 — `compras.tiene_factura` / `compras.iva_credito` y la
tabla `iva_ajustes`), **aplicada y verificada en la base real**. Antes: `sql/26` (`es_servicio` en
`venta_items`), 25/24/23 (subcategorías y umbral de stock web), 22 (trigger de sync a la tienda),
21 (imágenes web), 20 (fix de `descontar_stock_venta`). Todas idempotentes y corren en orden.
**Aplicarlas con la CLI** (ver la sección de abajo), no a mano en el SQL Editor.

## Estado: qué está HECHO (v28-v31 — catálogo real, categorías, fotos)
- **v28:** módulo "Página Web" reorganizado con sub-pestañas (Pedidos Web + Categorías nuevo),
  `producto_categorias` (CRUD + reordenar), `stock_umbral_web` por producto, backfill de imágenes
  1:1 (`scripts/procesar-imagenes-1-1.js`).
- **v29:** `scripts/clasificar-y-publicar-catalogo.js` — clasifica los 114 productos reales por
  palabras clave del nombre y publica los 86 con SKU. v1 usaba "Accesorios de PC" como cajón de
  sastre; **v2 (misma sesión, corregido a pedido del usuario)** lo separó en categorías finas
  (Periféricos/Audio/Cables y Adaptadores/Energía Portátil/Accesorios Móviles/Hogar y Estilo de
  Vida), inspirado en las categorías reales de `sevelin.cl` (Tiendanube) sin copiarlas 1:1. El
  script es re-ejecutable y borra categorías que quedan vacías.
- **v30:** `scripts/importar-imagenes-tiendanube.js` — descarga fotos ya publicadas en `sevelin.cl`
  (Tiendanube, propiedad del mismo negocio), las procesa con el mismo pipeline que el resto del
  catálogo y las sube al Storage propio (nunca enlaza la URL externa directo). 75 de 86 productos
  quedaron con fotos reales.
- **v31:** reordenar fotos de producto (`PUT /api/productos/:id/imagen/orden`, flechas ◀▶ en el
  modal) + etiqueta "Principal" en la primera foto (la que usa la tienda como imagen de catálogo).
- Además, en esta misma sesión: pasada de pulido visual (motion) con criterio "Modo Operate" —
  tokens de easing, toast/modal con curvas centralizadas, entrada escalonada en listas de
  administración — ver commit `style: pasada de pulido visual`.

## Estado: qué está HECHO (v32-v39 — rediseño gamer, UX, seguridad, notificaciones — 29-08-2026)
- **v32 (fix crítico de build + Fase 1 gamer):** `css/tailwind-input.css` tenía el CSS YA COMPILADO
  adentro en vez de las directivas `@tailwind base/components/utilities` — probablemente un `-i`/`-o`
  invertido en algún commit viejo. Efecto real: `npm run css` llevaba tiempo sin recompilar nada de
  verdad, sin importar qué clases nuevas se agregaran. Restaurado el archivo de entrada correcto y
  recompilado desde cero. Con el pipeline funcionando: acento de marca azul/dorado → cian/magenta
  (`--blue`→`#00f0ff`, `--gold`→`#ff2ec4`), coherente con `sevelin-tienda`. Verde/rojo/violeta
  (semánticos: éxito, error, OT) sin tocar a propósito.
- **v33 (fix):** costo y precio unitario del producto nacían con el valor literal `"0"` puesto (no
  un placeholder) — pegar un monto con el cursor al final de ese "0" daba `039990` en vez de
  `39990`. Ahora nacen vacíos (`placeholder="0"`) y seleccionan su contenido al enfocar (mismo
  idioma que ya usaban `elPagoMontoRecibido`/`elItemCantidad`).
- **v34:** "Descripción" y "Descripción web" eran dos campos separados — se unifican en uno solo
  (se manda a las dos columnas del backend). El campo pasa de `<textarea>` plano a un editor de
  texto enriquecido (Quill, CDN — única dependencia externa no vendorizada del proyecto, sin
  alternativa vanilla razonable): negrita, cursiva, listas, links. Texto más chico que el resto del
  formulario a propósito (para editar viendo más líneas), el tamaño publicado lo define
  `sevelin-tienda`, no esto. La tienda sanitiza el HTML antes de renderizarlo (`isomorphic-dompurify`,
  whitelist mínima: exactamente los tags del editor).
- **v35:** checkbox "Es un servicio" al agregar cualquier ítem al carrito (venga del catálogo o
  escrito a mano) — `venta_items.es_servicio` (`sql/26`). `GET /api/balance` agrega
  `ventasProductos`/`ventasServicios` (suma de `subtotal` agrupada, ventas PAGADAS del período).
  Tarjeta nueva en Balance ("Ventas: productos vs. servicios"), mismo patrón visual que "Ingresos
  por medio de pago".
- **v36:** miniatura de foto de producto (`miniaturaProducto()` en `config.js`, con cuadro 📦 si no
  hay foto) en la tabla de Productos (reemplaza la columna "Capas (PEPS)", que casi no se usaba ahí
  y sigue disponible en el modal del producto), en "Ingresar producto" y en el Carrito de venta.
  Fix: Edge (y algunos Chromium con guardado de contraseñas) inyecta su propio ícono de
  mostrar/ocultar sobre CUALQUIER `type="password"` — se veía superpuesto con el 👁️ propio del PIN,
  tanto en el login como en el gate de Finanzas. `::-ms-reveal`/`::-ms-clear` en `display:none`.
- **v37 (fix de seguridad + UX):** el sidebar ganó sub-ítems siempre visibles bajo Finanzas/Servicio
  Técnico/Página Web (atajo directo a cada sub-pestaña, sin acordeón) — pero el interceptor del PIN
  de Finanzas (`finanzas-gate.js`) solo escuchaba clicks en el `.nav-btn` padre, así que esos
  sub-ítems nuevos (ej. "Gastos Fijos") entraban a Finanzas **sin pedir el PIN**, con la sesión de
  cualquiera. Corregido: interceptor delegado en `.nav-links` que cubre cualquier elemento con
  `data-view="view-finanzas"`, guarda cuál disparó el gate y reenvía el click a ESE elemento tras el
  PIN correcto (antes siempre volvía a la sub-pestaña por defecto). Además: tabla de Productos y
  Carrito con letra más grande (`.tabla-grande`, selector doble por una pelea de especificidad con
  un bloque CSS posterior), login más grande, "POS" pasa de magenta a cian (color característico de
  marca consistente), Valorización de Inventario con un ámbar propio (`--valor`, ya no comparte el
  magenta con los íconos de editar), Balance se refresca solo a "Hoy" al entrar (antes mostraba lo
  último cargado hasta apretar "Hoy" a mano), y cierre de sesión automático a los 60s de
  inactividad en TODA la app (`js/inactividad-global.js`, nuevo — distinto del timer de Finanzas,
  que solo expulsa al POS sin cerrar sesión).
- **v38:** botón "Cancelar" de un clic en Pedidos Web (ya era posible por dentro de "Gestionar",
  quedaba escondido). Mini-modal con checkbox "el producto sigue en la tienda" — si se marca,
  `PUT /api/pos/pedidos-web/:id` con `reponer_stock:true` repone stock (`ajustarStock(items, +1)`,
  misma función que ya usa el resto del POS, con signo opuesto); si no se marca, no se toca — el
  servidor nunca lo decide solo, un pedido puede cancelarse recién pagado o ya despachado y son
  casos opuestos para el inventario.
- **v39:** al cancelar, el POS le pide a `sevelin-tienda` que le mande el correo de cancelación al
  cliente (`POST /api/pos/notificar-cancelacion`, nueva variable `TIENDA_NOTIFICAR_CANCELACION_URL`,
  mismo `SYNC_SECRET` de siempre — el POS no tiene la API key de Resend ni la plantilla del correo).
  Mejor esfuerzo: si falla, el pedido queda cancelado igual y el toast avisa que no se pudo notificar.

## Estado: qué está HECHO (v40 — submódulo Utilidades, IVA crédito, proyección — 29-08-2026)
> Detalle completo en `docs/CHANGELOG-V40.md`. Migración `sql/27-utilidades-iva-credito.sql`
> **ya aplicada** en la base real.
- **Finanzas → 💎 Utilidades** (`js/utilidades.js`, nuevo): responde "cuánto gané", que NO es lo
  mismo que "cómo está la caja" (eso sigue siendo Balance). Períodos Hoy / Ayer / Esta semana /
  Este mes / Mes anterior / personalizado, y tres casillas para descontar **comisiones**, **IVA** y
  **gastos**. El informe llega del servidor con todas las capas por separado, así que marcar y
  desmarcar recalcula al instante sin volver a consultar. `utilidadNeta` de `/api/balance` **no
  cambió de significado** a propósito, para no romper los KPI existentes.
- **IVA neto de verdad (débito − crédito fiscal):** `compras` ganó `tiene_factura` e `iva_credito`
  (en pesos, no derivado: no toda factura trae 19% exacto). El **remanente** de crédito fiscal se
  reconstruye mes a mes al estilo F29 y **no se guarda** — se recalcula del histórico, más ajustes
  manuales con motivo obligatorio (`iva_ajustes`), pensados para cargar el remanente anterior al
  sistema. Recordar: los precios son BRUTOS, el IVA contenido es `total − total/1,19`, **nunca**
  `total × 0,19`.
- **El IVA de las ventas SIN DTE se registra como utilidad** (decisión del dueño), y se expone
  siempre como cifra aparte con la advertencia de que es una vista de gestión, no una declaración:
  ante el SII una venta sin documento igualmente genera débito fiscal. También se agregó el desglose
  de IVA (informativo) a `/api/balance`.
- **Gastos fijos sin doble conteo:** un gasto fijo pagado ya se guarda como compra normal, así que
  hay UNA casilla "Gastos" y el desglose fijos/variables **reparte** ese total en vez de sumarlo.
  La compra de mercadería (INVENTARIO) se informa pero no se descuenta: ya está en el costo FIFO.
- **Proyección de flujo de caja por escenarios** (`GET /api/finanzas/proyeccion`): usa la serie
  DIARIA real con los días cerrados contando como $0, y **percentiles** en vez de promedios (un día
  excepcional no debe inflar la proyección). Cada escenario cruza **dos percentiles opuestos** —
  conservador = ventas p25 contra gastos p75; excelente al revés — porque ser conservador es esperar
  poco ingreso Y bastante gasto. Cada tarjeta cierra con "podrías gastar hasta" = saldo + proyección
  − resguardo.
- **Borrado contable por período** (`DELETE /api/finanzas/balance`): ventas / gastos / aportes /
  arqueos-ajustes-traspasos, a elección. Exige PIN de admin verificado en el servidor, rango de
  fechas obligatorio (no hay "borrar todo" sin fechas) y escribir "BORRAR" en la interfaz. Las
  ventas se borran reponiendo el stock (`revertirEfectosDeVentas`).
- **Exportación**: Excel de 4 hojas (Resumen con notas metodológicas, Ventas, Gastos, IVA mes a mes,
  con formato de peso chileno) y PDF de 2 páginas con la cascada, los desgloses y las notas. Ojo:
  SheetJS community no permite colores en Excel — ahí el diseño es estructura y formato numérico.

## Estado: qué está HECHO (v48 — módulo Garantías — 01-09-2026)
> Detalle completo en `sql/31-garantias.sql`.
- **🛡️ Garantías**, vista propia del sidebar (no admin-only — el trabajador también puede
  consultarla), con dos sub-pestañas:
  - **Productos**: busca en `venta_items` (join a `ventas`) por N° de venta (`numero_orden`, ojo:
    es `integer`, no texto — el filtro usa `eq` cuando lo escrito es un número entero, `ilike` solo
    contra `cliente`), nombre, SKU o N° de serie. Muestra condición, meses de garantía, fecha de
    vencimiento (`sumarMeses`) y estado (Vigente/Vencida, comparado con `fechaHoyChile()`).
  - **Servicios**: mismo criterio sobre `ordenes_trabajo` con `estado='ENTREGADO'` — busca por N°
    de OT, cliente, categoría/modelo/S-N del equipo.
- `productos` gana `condicion` (`nuevo`/`reacondicionado`, default `'nuevo'`) y `meses_garantia`
  (default `6`, siempre) — tarjeta nueva "Condición y garantía" en el modal de crear/editar
  producto, entre "Categoría" y "Tienda web".
- `venta_items` gana el mismo par de columnas como **snapshot** al vender (`normalizarItems()` ya
  consultaba `productos` para el costo — se aprovechó esa misma consulta): si el producto cambia de
  condición o garantía después, las ventas ya hechas no se mueven.
- `ordenes_trabajo.meses_garantia` se fija recién en `POST /api/ot/:id/entrega` (default 6,
  editable en el modal de entrega) — es el momento real en que arranca la garantía del servicio.
- Endpoints nuevos: `GET /api/garantias/productos` y `GET /api/garantias/servicios` (ambos con
  `?q=` y `?estado=VIGENTE|VENCIDA`), calculan `vence_el`/`estado_garantia` siempre en el
  servidor, reusando `fechaHoyChile()`/`sumarMeses()` ya existentes.
- **Probado en vivo contra producción real**: guardar/recargar condición y meses de garantía en un
  producto, y el buscador filtrando ventas reales por texto/número/estado — se encontró y corrigió
  un bug real en el camino (el filtro `ilike` sobre `numero_orden` fallaba con 500 porque esa
  columna es `integer`).
- **No probado en vivo** (habría requerido una venta o entrega de OT real de verdad, con efectos
  irreversibles en stock/caja — se evitó a propósito): el snapshot de garantía al crear una venta
  nueva, y el flujo completo de entregar una OT con meses de garantía editado. El código sigue el
  mismo patrón ya verificado en las otras partes (`node --check` limpio, sin colisiones).

## Estado: qué está HECHO (v47 — módulo Pedidos por Encargo — 01-09-2026)
- `productos.es_pedido_encargo` (default `false`) — checkbox "Es un producto de Pedidos por
  Encargo" en el modal, entre "Categoría" y "Tienda web". Sincroniza a `sevelin-tienda` gratis vía
  el trigger existente (`to_jsonb(NEW)`, sql/22), sin tocarlo.
- Panel "Pedidos Web" (`js/pedidos-web.js`): filtro `?tipo=ENCARGO` + badge "📦 Encargo" en la
  tabla, para distinguir los pedidos de Encargo de las ventas normales.
- Ver `sevelin-tienda` v33 (su propio SNAPSHOT.md) para el lado de la tienda — sección
  `/pedidos-por-encargo`, checkout que no mezcla ítems normales y de Encargo.

## Estado: qué está HECHO (v46b — modal de producto: diseño y fotos múltiples — 01-09-2026)
- **Barra superior del modal de producto** ("← Volver al catálogo" / "Guardar Producto"): tenía un
  fondo `var(--app-bg-2)` sólido casi negro que cortaba feo contra el degradé del fondo apenas se
  entraba a la pantalla — reemplazado por un token nuevo `--topbar-bg` translúcido +
  `backdrop-filter: blur()`, mismo criterio "vidrio esmerilado" que ya usan los overlays de
  modales. Ajustado en ambos temas (oscuro y claro).
- **Fotos: selección/arrastre múltiple.** El input de archivo y el dropzone antes solo aceptaban
  una foto a la vez — ahora aceptan varias de una sola vez, procesadas en orden con un indicador
  "Procesando foto N de M...".
- **Fotos: reordenar arrastrando.** Drag & drop nativo (HTML5) sobre las miniaturas, además de las
  flechas ◀▶ que ya existían. Requirió extender `PUT /api/productos/:id/imagen/orden` para aceptar
  el arreglo completo de fotos en el orden nuevo (antes solo intercambiaba con el vecino
  inmediato), validando que sea exactamente el mismo conjunto de fotos que ya tiene el producto.
  Probado en vivo contra un producto real con 4 fotos — el arrastre funcionó y quedó guardado en
  la base; el producto se dejó en su orden original al terminar la prueba.

## Estado: qué está HECHO (v45 — medidas reales de 40 productos — 01-09-2026)
> Detalle completo en `docs/CHANGELOG-V45.md`.
- De 81 productos publicados con foto, 49 tenían peso/dimensiones en 0 (bloqueaba la cotización de
  Chilexpress). Se buscaron por internet y se cargaron las 40 que son productos físicos reales — 9
  quedaron sin cargar a propósito porque son servicios técnicos (no tienen peso ni se despachan).
- **Pendiente de decisión del dueño**: esos 9 servicios no deberían ofrecer courier como opción de
  envío en absoluto (solo Retiro tendría sentido) — hoy no hay forma de marcar un producto del
  catálogo como "servicio, no se despacha" (existe `es_servicio` en `venta_items`, la venta ya hecha,
  pero no en `productos`). Resolverlo de raíz es un cambio mediano, no incluido en esta sesión.

## Estado: qué está HECHO (v44 — panel "Métricas" — 31-08-2026)
> Detalle completo en `docs/CHANGELOG-V44.md`.
- Nuevo subtab "📊 Métricas" dentro de "Página Web": 4 tarjetas KPI — visitas totales (+ últimos 30
  días), cuentas de cliente creadas, carritos compartidos, carritos abandonados (+ cuántos terminaron
  en compra).
- `GET /api/pos/metricas` (nuevo) — 6 `count` en paralelo contra `dbWeb` (mismo cliente que Pedidos
  Web y Más buscados): `eventos_web` (tipo `visita`), `carritos_web` (por `origen`/`numero_pedido`) y
  `perfiles_clientes`. Todos son totales acumulados, no por período (salvo "últimos 30 días" de
  visitas, que es contexto extra) — no se pueden reconstruir hacia atrás, arrancan a contar desde que
  se activó cada tracking.
- **"Visitas" depende de que `sevelin-tienda` esté desplegada** (mismo caso que etiquetas y más
  buscados) — el contador vive en un componente cliente nuevo (`VisitTracker`) que no existía antes de
  esta sesión.

## Estado: qué está HECHO (v43 — panel "Más buscados" — 31-08-2026)
> Detalle completo en `docs/CHANGELOG-V43.md`.
- Nuevo subtab "🔍 Más buscados" dentro de "Página Web": dos tablas, términos de búsqueda más
  frecuentes y productos con más vistas de ficha, con selector de período (7/30/90 días).
- `GET /api/pos/mas-buscados` (nuevo) lee `eventos_web` de Supabase Web con `dbWeb` (mismo cliente que
  Pedidos Web) y agrega en JS (Map, sin RPC nueva) — el volumen de una tienda chica no justifica una
  función SQL aparte. Los eventos los registra `sevelin-tienda` cada vez que alguien busca algo o abre
  una ficha de producto (`src/lib/eventos-web.ts`, con `after()` de Next.js para no retrasar la
  página).
- **Igual que la etiqueta destacada (v42)**: el código de registro está en el repo de la tienda pero
  no desplegado en Vercel todavía — hasta que se despliegue, el panel del POS va a mostrar "todavía no
  hay búsquedas/vistas registradas".

## Estado: qué está HECHO (v42 — etiqueta destacada de producto — 31-08-2026)
> Detalle completo en `docs/CHANGELOG-V42.md`.
- Nuevo campo `productos.etiqueta_web` (`sql/28-etiqueta-web.sql`, aplicada) — NULL o una de
  `NOVEDAD`/`TENDENCIA`/`OFERTA`. Select nuevo en el modal de producto ("Tienda web" → Etiqueta
  destacada), visible como texto corto en la fila de la tabla de productos (junto a SKU/S/N/Repuesto).
- Sincroniza a `sevelin-tienda` por el mismo trigger de siempre (manda la fila completa) — la tienda
  la muestra como badge en la tarjeta de producto y en la ficha (`productos_web.etiqueta_web`, ver
  `sevelin-tienda/supabase/12-etiqueta-web.sql` y `docs/CHANGELOG-V21.md` de ese repo). **El mapeo del
  lado tienda (`POST /api/sync/producto`) está en el código local pero no desplegado en Vercel
  todavía** — hasta que se despliegue, marcar la etiqueta en el POS no la va a mostrar en la tienda
  real (sí queda guardada en `productos.etiqueta_web`, se sincroniza sola en cuanto se despliegue).

## Estado: qué está HECHO (v41 — 60 fichas de producto reescritas — 30-08-2026)
> Detalle completo en `docs/CHANGELOG-V41.md`.
- El usuario pidió que las descripciones (`productos.descripcion_web`) siguieran una plantilla fija:
  título comercial + introducción + 8-12 características + advertencia opcional + pie fijo de envíos
  (WhatsApp +56935750828, Instagram @sevelin.cl, garantía 6 meses, medios de pago, link a la tienda),
  **solo para productos, los servicios quedan para otra sesión**.
- **Alcance auditado, no asumido**: de 116 productos, 10 son servicios (categoría "Servicios
  Técnicos") + **1 servicio mal clasificado bajo "Componentes PC"** (`id 91`, actualización de BIOS —
  detectado por nombre, excluido igual, su categoría sigue sin corregir). De los 105 restantes: 5 ya
  cumplían el formato, **40 no tenían ninguna descripción guardada** (quedaron pendientes por decisión
  del usuario — el prompt prohíbe inventar specs), y **60 sí tenían descripción vieja reescribible con
  información real**. Se actualizaron esos 60 (nombre limpio + descripción completa).
- Las advertencias reales que estaban mezcladas como una viñeta más dentro de "Características" (ej.
  "⚠️ Funciona solo de HDMI → VGA", "REACONDICIONADO" en un monitor) se movieron a su propia sección
  "⚠️ Importante" — no se inventó ninguna advertencia nueva, solo se reubicaron las que ya existían.
- Requirió un cambio de código en `sevelin-tienda` (`formatear-descripcion.ts`): el pie fijo usa
  `**negrita**` y `[texto](url)`, que el formateador de texto plano de la tienda no interpretaba
  todavía — ver `sevelin-tienda/docs/CHANGELOG-V18.md`.
- Aplicado directo a Supabase (`service_role`) con un script de una sola vez, ya descartado. El
  trigger de sincronización existente empujó el cambio a la tienda solo, sin tocarla — verificado
  60/60 contra el pipeline real de renderizado antes de aplicar, y con una muestra en producción
  después.
- **Pendiente real**: los 40 productos sin descripción (esperando specs/fotos del usuario) y los
  servicios (prompt aparte, otra sesión).

## Automatización Supabase CLI (nuevo — usar de acá en adelante)
La CLI de Supabase (`npx supabase`) está logueada y ambos proyectos vinculados (`supabase link`) —
para correr una migración SQL nueva, ya no hace falta pegarla a mano en el SQL Editor:
```bash
npx supabase db query --file sql/NN-nombre.sql --linked
```
Esto usa la API de gestión de Supabase con el token de sesión de la CLI, **no** una `DATABASE_URL`
guardada en ningún archivo (decisión explícita del usuario: nada de contraseñas maestras de
Postgres en el repo). Si en una sesión nueva el comando falla con error de permisos, es porque el
login de la CLI quedó en la cuenta equivocada — ver el fix aplicado esta sesión: correr
`npx supabase logout` y volver a loguear pegando el link manualmente en el navegador correcto (no
dejar que abra el navegador por defecto solo).

## Bugs conocidos ACTIVOS
Ninguno confirmado. El bug crítico histórico de `descontar_stock_venta` (columna ambigua, v22) se
verificó esta sesión como **corregido** en la base real (`sql/20` sí se aplicó en algún momento —
la función usa la variable local, no la columna ambigua).

## ⭐ PENDIENTE AL 08-09-2026 — TODO ES DEL DUEÑO, NADA ES DE CÓDIGO

> Empieza por acá. Nada de esto lo puede resolver una sesión de Claude: son cuentas, credenciales y
> decisiones comerciales. Mientras estos no se muevan, las Fases 0, 2, 4 y 6 del plan de crecimiento
> están detenidas — no por falta de código.

| # | Qué | Dónde | Qué desbloquea |
|---|---|---|---|
| ~~1~~ | ~~`KHIPU_API_KEY` y `KHIPU_SECRET` en Vercel~~ — **RESUELTO 08-09-2026**: ambas puestas y **verificadas vivas en producción** (el log del webhook prueba las dos llaves, así que las dos están cargadas). `NEXT_PUBLIC_SITE_URL` confirmada indirectamente: la notificación del pago real llegó, y esa URL sale de ahí. **Los logs de Vercel del pago ya rotaron**, así que no se puede saber cuál llave firmó — dejar las dos puestas es seguro y es lo recomendado | — | ✅ Khipu operativo |
| ~~2~~ | ~~Correo a `soporte@khipu.com` para subir el límite de $5.000~~ — **RESUELTO 08-09-2026**: el dueño levantó la restricción, ya recibe monto ilimitado. **No requirió ningún cambio de código** (nunca hubo tope escrito en la tienda). Falta solo que confirme el nuevo límite en el panel | Khipu | ✅ Khipu sirve para vender de verdad |
| 3 | **Postular a Transbank Webpay Plus directo** (2,08% débito / 2,80% crédito con IVA, contra el 3,44% de Flow) — decisión del 09-09-2026: se reemplaza a Flow y **no** se traspasa la comisión al cliente. Requiere contrato y evaluación comercial; su tasa es **dinámica** (los 2 primeros meses el promedio del rubro, después según ventas del mes anterior). **Cuando respondan, avisar**: hay que construir la integración de Webpay Plus y **verificarla con un pago real chico antes de encenderla** | Transbank | Tarjetas en la web. Hoy solo se cobra por transferencia |
| ~~3b~~ | ~~Configurar los medios de pago en el panel de Flow~~ — **YA NO APLICA**: Flow quedó apagado en el código (`FLOW_HABILITADO = false`). Si algún día se retoma, la regla medida sigue en pie: **nunca activar cuotas sin interés** (+1,99% / +3,49% / **+6,99%** sobre el 2,89% — a 12 cuotas la comisión real es **11,76% con IVA**, más de un tercio del margen de 30,9%). Las *cuotas emisor*, las del banco del cliente, no cuestan nada y funcionan solas | — | — |
| 4 | **Verificar dominio en Resend** (2-3 registros DNS en `sevelin.cl`) | DNS | **Bloqueo B2**: hoy TODO correo a clientes falla en silencio |
| 5 | **Página de Facebook + Business Manager** | Meta | **Bloqueo B6** (el negocio cuelga de una cuenta personal) y **B3** (Pixel + catálogo). El feed de 99 productos ya está listo para subir |
| 6 | **Cargar los costos en $0 — hoy son 19, no 21** (medido contra producción el 08-09-2026; el panel Finanzas → Inteligencia los lista). **10 tienen stock y son los urgentes**: id 172 Monitor Samsung 22" (2u), 148 Fuente Kronos 750W (2u), 116 Batería MagSafe 10.000 (3u), 149 Fuente Kronos 700W (1u), 114 Power Bank Master-G 20.000 (1u), 214 Inflador de Globos (2u), 165 Teclado Gamer RGB (1u), 143 Funda Xiaomi Redmi 14C (2u), 168 Mouse Gamer Cinco Tech (1u), 167 Mouse RGB Cinco Tech (1u). Los otros 9 están sin stock: 154, 153, 240, 94, 134, 169, 166, 142, 102 | POS | **Bloqueo B4**: sin esto no hay decisión de precio ni de publicidad posible — y ahora tampoco se puede fijar bien el recargo del precio diferenciado |
| 7 | **Decidir qué hacer con los 43 productos dormidos** ($1.954.370, 41% del stock, nunca vendieron nada) | Decisión comercial | Libera casi 2 millones para reinvertir |
| 8 | **Registrar el WhatsApp en cada venta nueva** (el campo existe desde v52) | Hábito diario | Sin esto, en febrero habrá 200 garantías por vencer y nadie a quién avisarle |
| 9 | **+1 al stock del Adaptador HDMI a VGA (id 104)** — lo descontó el pago de prueba de Flow | POS | Corrige el stock real |
| 10 | Confirmar `UPSTASH_REDIS_REST_URL`/`TOKEN` en el Vercel **del POS**; tope de gasto en Google Cloud; seguimiento a Starken; `NEXT_PUBLIC_PRIVACIDAD_EMAIL` | Vercel / Google / correo | Arrastrados de v49, ninguno bloqueante |
| 11 | **Dos datos que faltan para la FAQ** (ya construida y en producción, `/preguntas-frecuentes`): (a) **el plazo de gestión de una garantía** — cuántos días desde que recibe un equipo fallado hasta que lo resuelve; hoy no se publica ninguno a propósito, porque prometer un plazo que no se cumple hace más daño que no publicarlo (recomendado: diagnóstico 24-48h hábiles, resolución hasta 10 días hábiles); (b) una **5ª respuesta** que quedó sin escribir | Dueño | Completar la FAQ |
| ~~12~~ | ~~Cerrar las 4 decisiones del precio diferenciado~~ — **RESUELTO 08/09-09-2026**: las cuatro se cerraron y el precio diferenciado se construyó entero… y después quedó **APAGADO** (`RECARGO_CHECKOUT_TARJETA = 0`) al decidir pasar a Transbank y absorber la comisión. Sigue probado y listo por si algún día hay que encenderlo | — | — |
| 13 | **En el panel de TUU**: confirmar que "Tipo de transacción por defecto" esté en **Comprobante Afecto** (no Exento) — se le informa obligatoriamente al SII. Y dejar **"Cuotas comercio" APAGADO**: con esa opción TUU abona la venta parcializada en tantos meses como cuotas elija el cliente. Apagarlo **no impide** que el cliente pague en cuotas con su banco (cuotas emisor: el comercio cobra todo a las 48h hábiles) | TUU | Evita un problema tributario y protege la caja |
| 14 | **Preguntar a TUU si entregan documentación de API para una tienda propia** (no WooCommerce/Jumpseller). Hoy su Checkout solo integra por plugin con esas dos plataformas, y la API de `developers.tuu.cl` es para disparar cobros en el POS físico, no para web. Si dieran API, el link de pago de TUU (**0,98%-1,49% + IVA**) reemplazaría a Flow (**2,89% + IVA**) a un tercio del costo | Correo a TUU | Podría hacer innecesario Flow |

**Riesgo de seguridad abierto:** las credenciales de Khipu (llave de cobrador y API key) se pegaron en
un chat el 08-09-2026. Conviene expirarlas y crear nuevas desde el panel de Khipu una vez que la
integración esté funcionando. De aquí en adelante: pegar las credenciales directo en `.env.local` y
en Vercel, y decirle a Claude "ya la puse" — no necesita verlas.

---

## Pendiente (real, verificado al 07-09-2026)

> **Plan de crecimiento por fases:** `docs/PLAN-CRECIMIENTO-2026.md` (07-09-2026) consolida TODOS los
> pendientes de abajo + los de `sevelin-tienda`, y los ordena en 8 fases para los objetivos de
> negocio del dueño. Dos bloqueos de negocio que esa auditoría encontró y que no estaban listados
> acá: **Flow sigue en sandbox** (`FLOW_API_BASE` cae a `sandbox.flow.cl` — la tienda no cobra plata
> real) y **`sevelin.cl` YA apunta a la tienda nueva** (el SNAPSHOT de `sevelin-tienda` decía lo
> contrario, corregido).

**Lo más reciente, v50 (fuera de código, del dueño) — ver `docs/CHANGELOG-V50.md` para el contexto:**
-1. **Sumar +1 al stock del Adaptador HDMI a VGA (id 104)** — una compra de prueba en sandbox de
    Flow lo descontó de verdad (hallazgo real: sandbox de pago SÍ mueve stock real). El dueño
    prefirió hacerlo él mismo desde el POS, no por script directo.
-2. **Costo real del Ventilador Industrial Metálico 18" (id 192)** — quedó en $0 al categorizar el
    lote de 27 productos, utilidad falsa en reportes hasta que se cargue.
-3. **Confirmar que `sevelin.contacto@gmail.com` quedó "Verificada" en Google Merchant Center**
    (aceptar la invitación por correo) — **recién ahí** quitar el acceso de `pcgoldchile@gmail.com`,
    nunca antes (hoy es el único admin con acceso directo confirmado).
-4. **En ~3 días (recordatorio programado), revisar la fuente "sevelin.cl" en Merchant Center**
    (`https://merchants.google.com/mc/products/sources?a=5836999734`) — si ya se pobló con una
    cantidad similar a los 107 productos viejos y los datos coinciden, eliminar la fuente vieja
    "Tiendanube API" para no tener dos fuentes compitiendo.
-5. **Khipu sin `KHIPU_API_KEY`** — el dueño la crea cuando tenga lista la cuenta de cobro; sin eso
    el checkout sigue funcionando igual (solo Flow), no es bloqueante.
-6. ~~**HP ProDesk 400 G1 (id 181)**: ¿nuevo o reacondicionado?~~ — **RESUELTO 07-09-2026 (v51)**:
    el dueño confirmó que es **reacondicionado**. Se corrigió `condicion`, se movió a
    "Computadores → Reacondicionados" y se agregó "Reacondicionado" al nombre (su ficha está vacía,
    el nombre era el único lugar donde el cliente podía enterarse). Sincronizado a la tienda por el
    trigger, verificado en `productos_web`.
-7. **Los 21 costos en $0 del catálogo** (incluye el id 192 del punto -2): el panel Finanzas →
    Inteligencia los lista con ID y nombre. Los montos reales los sabe el dueño.
-8. **43 productos con $1.954.370 de stock que nunca vendieron nada** — decisión comercial pendiente
    (liquidar / mantener). Listados en el mismo panel.

**Seguridad / catálogo / Starken / SEO — v49 (fuera de código, del dueño):**
0. **Confirmar `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` en Vercel del POS** (dashboard de
   Vercel del proyecto `sevelin-pos-oficial` → Settings → Environment Variables). En `sevelin-tienda`
   ya quedaron puestas esta sesión; en el POS nunca se confirmó — sin ellas el freno de login cae al
   respaldo en memoria (funciona, pero no persiste entre instancias serverless).
0b. **Tope de gasto en Google Cloud** (Geocoding/Distance Matrix/Places API) — revisar facturación y
    considerar una alerta de presupuesto en `console.cloud.google.com/billing/budgets`. Se explicó
    cómo hacerlo pero nunca se confirmó que quedó puesto.
0c. **Starken**: revisar si ya se envió/respondió el correo de seguimiento a Belén Carreño
    (`asistenciaplugin@starken.cl`) pidiendo credenciales de producción, cuenta corriente y URL base
    productiva — sin eso, Starken sigue solo en QA en `sevelin-tienda`, no se puede activar en
    producción como segunda opción de courier.
0d. **Google Ads / Meta Ads** (opcional, no bloqueante): falta el ID+label de conversión de Google
    Ads (Herramientas → Conversiones) y crear el Catálogo de Meta Commerce Manager + conseguir el
    Pixel ID (Events Manager) — el SEO por producto (`generateMetadata`, JSON-LD) ya quedó listo como
    base en `sevelin-tienda`, falta la parte de cuentas para conectarlo de verdad.
0e. **Decisión pendiente: subcategorizar Monitores** (12 productos, salvo 1 cable mezclado ahí) —
    se dejó explícitamente sin decidir el 01-09-2026, falta elegir un criterio (marca/tamaño/uso) si
    se quiere partir esa categoría.

**Garantías / Pedidos por Encargo — v47-v48:**
0a. **El snapshot de garantía en una venta nueva y la entrega de una OT con meses de garantía
    editado nunca se probaron en vivo** — se evitó a propósito porque son acciones de negocio
    reales (mueven stock, caja, marcan un equipo como entregado). El código sigue el mismo patrón
    ya verificado en otras partes (misma consulta que ya traía `costo_unitario`, mismo endpoint que
    ya guardaba `fecha_entrega`), pero conviene hacer una venta/entrega de prueba real y confirmar
    que `venta_items.meses_garantia`/`condicion` y `ordenes_trabajo.meses_garantia` quedan bien.
0b. **`/pedidos-por-encargo` (tienda) nunca se probó con una compra real de punta a punta** — falta
    marcar un producto real como `es_pedido_encargo=true` desde el modal y comprarlo de verdad.
0c. **Clasificar productos existentes** como Nuevo/Reacondicionado y ajustar meses de garantía si
    alguno debería tener más/menos de 6 — hoy todos los productos ya vendidos quedaron con
    `condicion='nuevo'`/`meses_garantia=6` por el `DEFAULT` de la columna (backfill automático), no
    porque se haya revisado cada uno.

1. **Verificar un dominio propio en Resend** (dashboard.resend.com, cuenta creada con
   `sevelin.contacto@gmail.com`) — mientras se use el dominio de prueba (`onboarding@resend.dev`),
   los correos de confirmación/cancelación a clientes reales **fallan en silencio** (ese dominio
   solo entrega a la cuenta que creó la API key). Agregar 2-3 registros DNS donde esté administrado
   `sevelin.cl` — no requiere mover el dominio ni tocar que hoy apunte a Tiendanube.
2. **Decisión sobre WhatsApp**: para notificar por WhatsApp (además del correo) hace falta pasar
   por la verificación de Meta Business Manager (API oficial) — no hay atajo gratis y rápido, y las
   automatizaciones "no oficiales" (WhatsApp Web controlado por script) violan los términos de
   servicio y arriesgan que baneen el número del negocio. Sin decisión tomada todavía.
3. ~~`SUPABASE_WEB_URL`/`SUPABASE_WEB_SERVICE_ROLE_KEY` en Vercel~~ — **RESUELTO Y CONFIRMADO
   31-08-2026**: el catálogo, la sincronización POS→tienda y el trigger de subcategorías (v46) se
   verificaron funcionando de punta a punta contra producción real esta sesión.
4. **28 productos sin SKU**: YA NO están bloqueados para sincronizar (`sevelin-tienda` genera un
   slug de respaldo desde el nombre + id cuando no hay SKU, ver su propio SNAPSHOT.md). Sigue
   pendiente clasificarlos/marcarlos `publicado_web=true` desde el modal de producto si se quiere
   que aparezcan en la tienda — ya no es un bloqueo técnico, es curación de catálogo.
5. **10 productos con SKU sin foto** — no tenían coincidencia confiable contra `sevelin.cl`, subir
   foto a mano.
6. (Opcional, grande) Migrar a Supabase Auth + RLS por rol. Partir `api/index.js` en routers.
7. ~~Revisión de subcategorías (v46) fue conservadora~~ — **PARCIALMENTE RESUELTO en v49**: se
   crearon 4 subcategorías nuevas y se reasignaron 13 productos donde sí había un grupo homogéneo
   2+. Queda sin resolver a propósito **Monitores** (12 productos, ver pendiente 0e arriba) por falta
   de un criterio claro de división. Si el catálogo crece en Herramientas/Hogar y Estilo de Vida,
   vale la pena revisar de nuevo.

## Trampas específicas ya descubiertas (no repetir)
- `confirmarEntrega` existía en `ot.js` y `pago.js` → las de venta ahora son `confirmarEntregaVenta`/
  `cancelarEntregaVenta`.
- Modales de caja: Finanzas usa `modalAbrirCaja`/`modalCerrarCaja`; el POS usa `modalAperturaPos`/
  `modalCierrePos` (renombrados para no colisionar).
- Al probar con jsdom concatenando `js/*.js` en un solo `window.eval(codigo)`: un `const API = {...}`
  (o cualquier `const`/`let` de nivel superior) queda en el scope léxico DE ESE eval, no como
  propiedad de `window` — un script de prueba que haga `window.eval(codigo)` y LUEGO intente leer
  `window.API` desde fuera lo encuentra `undefined`. Hay que concatenar las aserciones de prueba
  DENTRO del mismo string que se evalúa (o comunicarse hacia afuera con asignaciones planas tipo
  `window.__resultado = x` sin `const`/`let`, que sí crean una propiedad real).
- Segundo cliente Supabase en el mismo proceso (`dbWeb`, v26): nunca reutilizar el nombre `db` para
  el segundo cliente ni mezclar sus queries — son dos proyectos distintos (POS vs. Web de la
  tienda). Si se agrega un tercer Supabase alguna vez, seguir el mismo patrón de nombre explícito.
- El POS descarta `codigo_barras` al guardar `venta_items`; por eso el buscador resuelve el barcode
  contra el catálogo (`productos`), no contra el ítem de venta.
- **`css/tailwind-input.css` DEBE tener solo las 3 directivas `@tailwind` — nunca CSS compilado.**
  Si `npm run css` deja de reflejar clases nuevas sin ningún error visible, lo primero a revisar es
  `head -c 200 css/tailwind-input.css`: si empieza con `*,:after,:before{...}` (CSS ya compilado) en
  vez de `@tailwind base;`, alguien corrió la CLI con `-i`/`-o` invertidos en algún momento — se
  arregla restaurando las 3 directivas desde cualquier commit viejo (`git show <hash>:css/tailwind-
  input.css`) y recompilando. Pasó una vez (v32) y no dio ningún error, solo clases "fantasma" que
  nunca aparecían.
- **`ajustes_saldo` NO tiene columna `fecha`, solo `creado_en`** (ver `sql/16`), a diferencia de
  `arqueos` y `traspasos` que sí tienen `fecha`. Filtrar `ajustes_saldo` por `fecha` devuelve un
  error de Postgres, no cero filas — cualquier consulta por rango sobre esas tres tablas tiene que
  declarar la columna correcta por tabla (ver el borrado por período en v40).
- **El resguardo de caja es `config_finanzas.resguardo_caja`**, no `resguardo_minimo`, y la fila de
  configuración es siempre `id = 1`.
- **Los precios del sistema son BRUTOS (IVA incluido).** El IVA contenido es `total − total/1,19`;
  calcularlo como `total × 0,19` da de más (~18% de más) y es el error clásico. Vale para ventas y
  para el crédito fiscal de las compras.
- **Cualquier atajo NUEVO de navegación a una vista protegida por PIN (Finanzas) tiene que pasar por
  el interceptor delegado de `finanzas-gate.js`** (`.nav-links` en captura, cualquier elemento con
  `data-view="view-finanzas"`) — NO alcanza con que la vista tenga la clase `admin-only` sola, eso
  solo oculta el botón para el rol trabajador, no pide el PIN. Pasó real: los `.nav-subitem` nuevos
  del sidebar (v37) tenían su propio listener en `config.js` que abría Finanzas directo, saltándose
  el PIN por completo, porque el interceptor de esa época solo escuchaba el `.nav-btn` padre.

---

## Empaquetado del entregable (estándar)
```
cd /home/claude/proj && rm -rf sevelin-pos-oficial/node_modules
zip -qr /mnt/user-data/outputs/sevelin-pos-oficial-vXX.zip sevelin-pos-oficial \
  -x "*.DS_Store" "*/.git/*" "*/pw-browsers/*"
```
Antes de empaquetar: `node --check` en lo tocado, chequeo de colisiones de funciones e `id`,
recompilar Tailwind, y verificar en jsdom / doble de Supabase.
