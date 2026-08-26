# SNAPSHOT — Sevelin POS
> Léelo (o pégalo) al abrir un chat nuevo o al llevar el proyecto a otra IA.
> Actualiza SOLO este archivo al cerrar una sesión. Para el detalle completo, ver `docs/README.md`.
> Para saber qué otro documento leer según lo que necesites, ver `docs/README-DOCS.md`.

**Fecha:** 26-08-2026 · **Versión activa:** v24 · **En producción:** https://sevelin-pos-oficial.vercel.app
**Rama en curso:** `feature/fase-0-ecommerce` (v24 todavía no está en `main`).

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

## Esquema SQL: última migración
`sql/21-imagenes-web.sql` (e-commerce Fase 0, columnas de imagen/web en `productos` — **pendiente de
aplicar en Supabase**, y en la rama `feature/fase-0-ecommerce`, no en `main` todavía). Antes:
`sql/20-fix-descontar-stock-ambiguo.sql` (fix de `descontar_stock_venta`, ver v22 — **también
pendiente de aplicar en Supabase**), 19 (stock atómico, con el bug), 18 (gastos programados). Todas
idempotentes, corren en orden. Aplicar en Supabase → SQL Editor.

## Bugs conocidos ACTIVOS
- **Crítico, en producción hasta que se corra `sql/20-fix-descontar-stock-ambiguo.sql` en Supabase:**
  toda venta con al menos un producto sin lotes falla al confirmarse ("column reference 'stock' is
  ambiguous"). Ver v22 arriba. El fix ya está en el repo (`sql/20-fix-descontar-stock-ambiguo.sql`);
  falta aplicarlo en la base real. `api/index.js` no necesitó cambios: el bug era solo de la función SQL.
  **Este bug es anterior y ajeno a la Fase 0 del e-commerce, pero sigue sin aplicarse.**

## Pendiente (backlog, no bloqueante)
1. E-commerce: Fase 0 (cimientos, ver v24 arriba) hecha en rama, falta aplicar SQL/bucket y mergear a
   `main`. Fases 1-6 (sitio público, checkout, pagos, envíos, panel de pedidos) sin empezar — ver
   `README-ECOMMERCE-SEVELIN.md` sección 8.
2. (Opcional, grande) Migrar a Supabase Auth + RLS por rol. Partir `api/index.js` en routers.

## Trampas específicas ya descubiertas (no repetir)
- `confirmarEntrega` existía en `ot.js` y `pago.js` → las de venta ahora son `confirmarEntregaVenta`/
  `cancelarEntregaVenta`.
- Modales de caja: Finanzas usa `modalAbrirCaja`/`modalCerrarCaja`; el POS usa `modalAperturaPos`/
  `modalCierrePos` (renombrados para no colisionar).
- El POS descarta `codigo_barras` al guardar `venta_items`; por eso el buscador resuelve el barcode
  contra el catálogo (`productos`), no contra el ítem de venta.

---

## Empaquetado del entregable (estándar)
```
cd /home/claude/proj && rm -rf sevelin-pos-oficial/node_modules
zip -qr /mnt/user-data/outputs/sevelin-pos-oficial-vXX.zip sevelin-pos-oficial \
  -x "*.DS_Store" "*/.git/*" "*/pw-browsers/*"
```
Antes de empaquetar: `node --check` en lo tocado, chequeo de colisiones de funciones e `id`,
recompilar Tailwind, y verificar en jsdom / doble de Supabase.
