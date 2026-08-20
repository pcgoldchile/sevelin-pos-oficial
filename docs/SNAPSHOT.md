# SNAPSHOT — Sevelin POS
> Léelo (o pégalo) al abrir un chat nuevo o al llevar el proyecto a otra IA.
> Actualiza SOLO este archivo al cerrar una sesión. Para el detalle completo, ver `docs/README.md`.
> Para saber qué otro documento leer según lo que necesites, ver `docs/README-DOCS.md`.

**Fecha:** 19-08-2026 · **Versión activa:** v16 · **En producción:** https://sevelin-pos-oficial.vercel.app

---

## Stack (fijo, no re-analizar)
Node/Express (`api/index.js`, serverless en Vercel) · JavaScript **vanilla** de ámbito global
(`js/*.js`, todos comparten scope) · Supabase/PostgreSQL (acceso solo desde el backend con
`service_role`) · JWT en `sessionStorage` · Tailwind **compilado** (`css/tailwind.css`, no CDN).

## Tres reglas que evitan romperlo (críticas)
1. **No dos funciones globales con el mismo nombre** en distintos `js/*.js`: la segunda pisa a la
   primera en silencio. Chequeo obligatorio tras editar (captura indentadas y async):
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

## Estado: qué está HECHO (v10 → v16)
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

## Esquema SQL: última migración
`sql/18-gastos-programados.sql` (tabla `gastos_programados`). Antes: 17 (caja + despacho), 16 (ajustes
de saldo). Todas idempotentes, corren en orden. Aplicar en Supabase → SQL Editor.

## Bugs conocidos ACTIVOS
(ninguno pendiente relacionado a ids duplicados; ver Pendiente para el resto del backlog)

## Pendiente (backlog, no bloqueante)
1. BIZ-02 atómico: stock check + descuento en una transacción (`SELECT ... FOR UPDATE`) para productos
   sin lotes.
2. Unificar los ~5 helpers de escape en `escHtml`.
3. Conectar el e-commerce (sevelin.cl): las columnas de despacho y comisión ya existen; falta el sitio
   que cree ventas por la API con `origen_pago='pago_web'`.
4. (Opcional, grande) Migrar a Supabase Auth + RLS por rol. Partir `api/index.js` en routers.

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
