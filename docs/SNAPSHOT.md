# SNAPSHOT — Sevelin POS
> Léelo (o pégalo) al abrir un chat nuevo o al llevar el proyecto a otra IA.
> Actualiza SOLO este archivo al cerrar una sesión. Para el detalle completo, ver `docs/README.md`.
> Para saber qué otro documento leer según lo que necesites, ver `docs/README-DOCS.md`.

**Fecha:** 31-08-2026 · **Versión activa:** v42 (**etiqueta destacada de producto** — NOVEDAD/
TENDENCIA/OFERTA IRRESISTIBLE, marcada desde el modal de producto y visible en la tabla del POS y en
la tienda web; ver "v42" abajo) · **En producción:** https://sevelin-pos-oficial.vercel.app ·
**Rama:** `main`.

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

## Pendiente (real, verificado al 29-08-2026)
1. **Verificar un dominio propio en Resend** (dashboard.resend.com, cuenta creada con
   `sevelin.contacto@gmail.com`) — mientras se use el dominio de prueba (`onboarding@resend.dev`),
   los correos de confirmación/cancelación a clientes reales **fallan en silencio** (ese dominio
   solo entrega a la cuenta que creó la API key). Agregar 2-3 registros DNS donde esté administrado
   `sevelin.cl` — no requiere mover el dominio ni tocar que hoy apunte a Tiendanube.
2. **Decisión sobre WhatsApp**: para notificar por WhatsApp (además del correo) hace falta pasar
   por la verificación de Meta Business Manager (API oficial) — no hay atajo gratis y rápido, y las
   automatizaciones "no oficiales" (WhatsApp Web controlado por script) violan los términos de
   servicio y arriesgan que baneen el número del negocio. Sin decisión tomada todavía.
3. **`SUPABASE_WEB_URL`/`SUPABASE_WEB_SERVICE_ROLE_KEY` en Vercel**: el usuario confirmó haberlas
   agregado el 29-08-2026 (después de un episodio real de "fetch failed" en Pedidos Web) — pendiente
   real: confirmar que el panel efectivamente funciona en producción tras el redeploy.
4. **28 productos sin SKU**: YA NO están bloqueados para sincronizar (`sevelin-tienda` genera un
   slug de respaldo desde el nombre + id cuando no hay SKU, ver su propio SNAPSHOT.md). Sigue
   pendiente clasificarlos/marcarlos `publicado_web=true` desde el modal de producto si se quiere
   que aparezcan en la tienda — ya no es un bloqueo técnico, es curación de catálogo.
5. **10 productos con SKU sin foto** — no tenían coincidencia confiable contra `sevelin.cl`, subir
   foto a mano.
6. (Opcional, grande) Migrar a Supabase Auth + RLS por rol. Partir `api/index.js` en routers.

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
