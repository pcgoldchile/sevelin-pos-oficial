# CHANGELOG v50 — 04→07-09-2026

Sesión larga (varios días de conversación continua). Cubre: descuento en el POS, notificaciones de
pedidos web, seguimiento de medidas de producto, un lote grande de catálogo (fichas, categorías,
13 monitores nuevos), la base de una integración con Khipu, y la migración de Google Merchant Center
fuera de Tiendanube. Detalle completo en el historial de chat — este changelog es el resumen.

## POS — descuento sobre el total de la venta

- Nuevo bloque "Descuento (opcional)" en el carrito del POS: monto fijo o porcentaje, aplicado
  **solo al total**, nunca prorrateado por ítem al guardar. El monto real **siempre lo calcula el
  servidor** (`api/index.js::calcularDescuentoMonto`) a partir del subtotal de los ítems — nunca se
  confía en un monto que mande el navegador, mismo criterio que el resto del proyecto (BIZ-01: "una
  línea de venta jamás resta").
- El descuento sale del margen, no del costo: `utilidad = total - costo_total`, y como `total` ya
  viene descontado, la utilidad guardada refleja el golpe real. El admin ve "Utilidad estimada" y
  "Utilidad tras descuento" en el carrito; el trabajador no ve ninguna (mismo criterio de siempre).
- `sql/35-descuento-venta.sql` (aplicada): `ventas` gana `descuento_tipo` (`MONTO`/`PORCENTAJE`/
  NULL), `descuento_valor` (lo que escribió el cajero) y `descuento_monto` (el real, calculado).
- El detalle de venta en el Historial (`js/historial.js`) ahora **prorratea el descuento por
  producto solo para mostrarlo** (según el peso de cada ítem en el subtotal, el último ítem absorbe
  el redondeo para que la suma cuadre exacto) — `venta_items` en la base nunca cambia. Muestra
  Subtotal/Descuento/Total y, para admin, utilidad por línea y utilidad bruta vs. neta. Sin
  descuento se ve exactamente igual que antes.
- Probado con jsdom sobre el código real (no reescrito): 15 casos de `calcularDescuentoMonto`/
  `totalizar` (monto fijo, porcentaje, descuento mayor al subtotal, porcentaje >100%, valores
  negativos/inválidos) y 16 casos del detalle de venta con prorrateo — todos correctos.

## Fix: log de errores 500 sin detalle

`api/index.js`, el manejador final de errores solo guardaba `err.message` — para un error como
`"object is not a function"` eso no dice nada útil. Ahora también guarda `err.stack`. Motivado por
un error 500 real e intermitente en `/api/login`/`/api/verificar-pin` que se dio esa sesión y se
resolvió solo (instancia serverless recuperada) sin poder diagnosticarlo — la próxima vez que pase,
el log va a tener el detalle real.

## Notificaciones de pedidos web (header del POS)

- Campana 🔔 nueva en el header (`js/notificaciones.js`, nuevo — admin-only): cuenta pedidos web en
  `PAGADO` (por preparar) + `ERROR_STOCK_SIN_DESPACHO`, sondea cada 60s, lleva directo al panel
  "Pedidos Web" al hacer clic. Se pone roja y pulsa si hay algo pendiente.
- `GET /api/pos/pedidos-web` ahora acepta varios `?estado=` separados por coma en una sola consulta
  (antes solo uno) — lo usa la campana para pedir PAGADO+ERROR_STOCK_SIN_DESPACHO de una vez.
- Probado con jsdom sobre el código real: 9 casos (contador en 0/3, clase visual, que un trabajador
  no gaste llamadas a la API, que sin sesión tampoco llame, navegación al hacer clic).

## Seguimiento de última actualización de medidas/peso

- `sql/36-medidas-actualizado-en.sql` (aplicada): `productos.medidas_actualizado_en`, mismo
  criterio que `stock_actualizado_en` ya existente — se registra al guardar si CUALQUIERA de
  `peso_kg`/`alto_cm`/`ancho_cm`/`profundidad_cm` viene en el body (no compara valor anterior).
- Visible en "Editar Producto" (debajo de Peso/Alto/Ancho/Profundidad) y en la exportación del
  catálogo ("Última Act. Medidas").
- Probado extrayendo `sanearProducto()` real del archivo: 7 casos (se registra al tocar cualquiera
  de las 4 medidas, no se registra si no se tocan, no se pisa con el timestamp de stock).

## Flow (sandbox) — verificación de punta a punta + hallazgo real

- Se comparó la API key/secret de Flow que el dueño tenía anotadas contra `sevelin-tienda/
  .env.local` — coinciden, y `FLOW_API_BASE` sigue en `sandbox.flow.cl` (no producción).
- Se hizo una compra de prueba real de punta a punta en sevelin.cl con la tarjeta de prueba de Flow
  (Adaptador HDMI a VGA, pedido WEB-000004) para confirmar que el webhook de pago quedó funcionando
  después del fix de `NEXT_PUBLIC_SITE_URL` de la sesión anterior — **confirmado: el pedido quedó
  PAGADO automáticamente**, sandbox de punta a punta funcionando.
- **Hallazgo importante**: un pago sandbox (dinero falso) SÍ descuenta stock real — el sistema no
  distingue sandbox de producción a la hora de mover inventario. El Adaptador HDMI a VGA (id 104 en
  el POS) quedó con 1 unidad menos de la real. **Pendiente: sumarle +1 al stock** (el dueño prefirió
  hacerlo él mismo desde el POS en vez de por script directo a la base).

## Catálogo — fichas con marca/modelo real (investigadas por internet)

- 8 productos con marca+modelo identificable (a diferencia de los genéricos, donde no hay specs
  reales que buscar) recibieron ficha completa con datos verificados por búsqueda web (no
  inventados): Crucial E100 480GB, Fuente Aigo AT650, Parlante Master-G MGGLADIATOR y MGLUXOR,
  Memoria Hiksemi Armor 8GB, HP ProDesk 600 G1 SFF, MSI A520M-A PRO (modelo confirmado por el dueño
  — ojo, no "A520M PRO" a secas, son placas distintas), Mouse Urbano Labs Gamer Pro (confirmado
  "con cable" por el dueño).
- **HP ProDesk 600 G1 SFF**: el dueño confirmó que es reacondicionado — se corrigió `condicion` (el
  sistema decía "nuevo") y se agregó la advertencia correspondiente a la ficha.
- 2 servicios técnicos mal clasificados como "producto genérico" (id 178 "Traspaso y Ensamblado de
  Componentes PC", id 227 "Instalación y upgrade de memoria RAM") recibieron ficha con el prompt de
  servicios (conservadora — sin inventar plazos ni si el precio incluye repuestos).
- Nuevo prompt permanente para fichas de Servicio Técnico, espejo del de producto — ver memoria
  `project_prompt_descripcion_servicios_tecnicos`.

## Catálogo — categorización masiva (27 productos sin categoría)

- Los 27 productos activos que no tenían `categoria_web` quedaron categorizados siguiendo el mismo
  criterio que ya usa el resto del catálogo. Se crearon 3 subcategorías nuevas: **Computadores →
  Nuevos** y **Computadores → Reacondicionados** (la categoría raíz "Computadores" ya existía pero
  estaba vacía) y **Cables y Adaptadores → Cables de Poder**.
- Los 27 se publicaron en la web (`publicado_web=true`) — verificado directo en la base de
  `sevelin-tienda` (`productos_web`), no solo en el POS: el Database Webhook de sync sigue activo y
  funcionando en tiempo real.
- Segundo caso del mismo bug de "nombre dice reacondicionado, `condicion` dice nuevo": id 174 ("PC
  HP ProDesk SFF... Reacondicionado") — corregido igual que el 600 G1 de arriba.
- 3 de los 27 no tienen costo unitario registrado: los 2 servicios (178, 227, normal — es mano de
  obra) y **el Ventilador Industrial Metálico 18" (id 192), que SÍ es un producto físico real y
  queda pendiente de que el dueño aporte el costo de compra** — hoy muestra utilidad falsa (el
  precio completo) en los reportes.

## Catálogo — 13 monitores reacondicionados nuevos (9 modelos únicos)

- El dueño pasó specs y precios de 13 unidades (varias del mismo modelo: 4× HP S1933, 2× AOC
  E2070SWN) — se cargaron como **9 productos únicos con stock acumulado** (mismo criterio que el
  resto del catálogo: nunca fichas duplicadas idénticas en la tienda), confirmado con el dueño antes
  de crearlos.
- Modelos: AOC 931SWL, HP V223, ViewSonic VA2231wm, Samsung SyncMaster B1930, HP S1933 (x4), AOC
  E2070SWN (x2), HP V190, Dell E1916H, HP V193b. Todos **Reacondicionado** (confirmado por el
  dueño), costo unitario $29.000 c/u (dado por el dueño), 6 meses de garantía, categoría Monitores,
  publicados en la web.
- Fotos reales de cada modelo descargadas de listados públicos (eBay/Newegg/B&H) — se detectaron y
  corrigieron 3 fotos malas antes de dejarlas: una era de un monitor equivocado (Compaq en vez de
  HP V223), una no tenía fondo blanco (foto real de escritorio), y una era literalmente el logo de
  eBay (el listado de origen no tenía foto real). Las 9 fotos finales se reprocesaron con margen
  blanco uniforme (lienzo 1000×1000, `sharp`) para que se vean parejas en la grilla de la tienda.

## Khipu — integración base (sin credenciales todavía)

El dueño pidió ir dejando la integración lista mientras consigue las credenciales de la cuenta de
cobro. Queda **apagada hasta que se configure `KHIPU_API_KEY`** (no rompe nada mientras tanto —
`khipuHabilitado()` en `src/lib/khipu.ts`, mismo criterio que `openFacturaHabilitada()`).

- `src/lib/khipu.ts` (sevelin-tienda, nuevo): crear pago, consultar estado, verificar firma HMAC del
  webhook. **Ojo real, distinto de Flow**: Khipu NO tiene sandbox separado — es la misma API
  (`payment-api.khipu.com`) para pruebas y producción, la diferencia la da la cuenta de cobro
  ("modo desarrollador" con bancos ficticios, vs. cuenta regular).
- `supabase/22-khipu.sql` (aplicada en sevelin-tienda): `pedidos_web.metodo_pago`
  (`FLOW`/`KHIPU`) y `khipu_payment_id`.
- `POST /api/khipu-webhook` (nuevo): mismo criterio que `flow-webhook` — el body de la notificación
  nunca se usa solo como prueba de pago (aunque venga firmado), siempre se re-consulta el estado con
  credenciales propias. Reutiliza toda la lógica de negocio existente (stock, boleta, correos).
- `POST /api/checkout` acepta `metodoPago: 'FLOW'|'KHIPU'`; el checkout muestra el selector de
  pasarela solo si `khipuHabilitado()`.
- **Sin verificar contra la API real** — implementado desde la documentación oficial. Antes del
  primer pago real hay que probar de punta a punta con la cuenta en modo desarrollador.

## Google Merchant Center / Shopping — migración fuera de Tiendanube

Contexto: la cuenta Merchant Center "Sevelin" (ID 5836999734) ya existía, vinculada a
`pcgoldchile@gmail.com`, con `www.sevelin.cl` verificado y reclamado, 107 productos (104
aprobados) — pero esos 107 productos venían de una **fuente activa "Tiendanube API"**, no de
"Encontrado por Google" como se pensó al principio.

- **Nuvemshop (Tiendanube) desvinculada** de Merchant Center (Acceso y servicios → Aplicaciones y
  servicios) — verificado con recarga completa de la página. Efecto secundario real: esto cortó la
  fuente de datos que alimentaba los 107 productos existentes, que quedaron "requiere actualización"
  (no desaparecen, pero dejan de refrescarse).
- Se activó **"Encontrado por Google" → sevelin.cl** como fuente de reemplazo (Fuentes de datos →
  "Añadir todos los productos encontrados") — Google pasa a leer precio/stock/disponibilidad reales
  directo de la tienda, actualizándose cada 24h. Tardará horas/días en poblarse.
- **`sevelin.contacto@gmail.com` agregado como Administrador** en Merchant Center (antes solo tenía
  acceso en Search Console, no ahí) — queda en estado **"Pendiente"** hasta que el dueño acepte la
  invitación por correo. **No se debe quitar el acceso de `pcgoldchile@gmail.com` hasta confirmar
  que `sevelin.contacto@gmail.com` quedó "Verificada"** — sacarlo antes dejaría la cuenta sin ningún
  administrador directo.
- Confirmado que **no hace falta ninguna etiqueta `<meta name="google-site-verification">`** en el
  código: la verificación de `sevelin.cl` en Search Console/Merchant Center se hizo por DNS
  (dominio raíz), no por meta tag ni archivo HTML — no hay nada pendiente de ese lado.
- **Recordatorio programado** (rutina en la nube, dispara ~10-09-2026): revisar si la fuente
  "sevelin.cl" ya se pobló con una cantidad de productos similar a los 107 viejos, y si los datos
  coinciden, eliminar la fuente vieja "Tiendanube API" para no tener dos fuentes compitiendo.

## Pendiente real que deja esta sesión

1. **Sumar +1 al stock del Adaptador HDMI a VGA (id 104, POS)** — lo descontó una compra de prueba
   en sandbox de Flow. El dueño prefirió hacerlo él mismo desde el POS.
2. **Costo real del Ventilador Industrial Metálico 18" (id 192, POS)** — hoy en $0, utilidad falsa
   en los reportes mientras no se cargue.
3. **Confirmar `sevelin.contacto@gmail.com` como "Verificada" en Merchant Center** (aceptar la
   invitación por correo) antes de quitarle el acceso a `pcgoldchile@gmail.com`.
4. **En ~3 días, revisar la fuente "sevelin.cl" en Merchant Center** (hay un recordatorio
   programado) y, si ya se pobló bien, eliminar la fuente vieja "Tiendanube API".
5. **Khipu**: sigue sin `KHIPU_API_KEY` — el dueño la creará cuando tenga la cuenta de cobro lista.
6. **HP ProDesk 400 G1 (id 181, POS)**: quedó categorizado en "Computadores → Nuevos" según su
   `condicion` actual, pero nunca se confirmó con el dueño si es realmente nuevo o reacondicionado
   (a diferencia de los otros 2 HP de esta sesión, que sí se confirmaron) — mismo bug potencial,
   sin confirmar.
7. Los pendientes de sesiones anteriores (ver `docs/SNAPSHOT.md`, sección "Pendiente") siguen
   igual de vigentes — no se tocaron esta sesión: Resend con dominio propio, WhatsApp/Meta Business,
   Upstash Redis en el POS, `TIENDA_SYNC_URL`, Google Ads/Meta Ads, 40 productos sin descripción
   restantes (genéricos, sin marca real que investigar), Starken en espera de credenciales de
   producción.
