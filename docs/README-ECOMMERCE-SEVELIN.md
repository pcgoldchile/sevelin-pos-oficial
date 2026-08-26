# Sevelin.cl — E-commerce: Documento Maestro de Arquitectura

> Este documento es la fuente de verdad para construir la tienda online de Sevelin
> y su integración con el sistema `sevelin-pos-oficial` ya en producción.
> Escrito para que **cualquier sesión nueva de Claude** (o cualquier desarrollador)
> pueda retomar el trabajo en cualquier fase sin contexto previo.
>
> Se construye por FASES (ver sección 8), pero este documento contiene el diseño
> COMPLETO desde el día uno: ninguna fase debe "descubrir" arquitectura sobre la
> marcha, solo ejecutar la parte que le corresponde de un plano ya cerrado.
>
> **Versión del POS de referencia: v16** (última migración SQL existente:
> `sql/18-gastos-programados.sql`). Las migraciones nuevas de la Fase 0 son la 19 y la 20.

---

## 1. Qué existe hoy (no tocar sin razón)

`sevelin-pos-oficial` es un POS interno en producción real (https://sevelin-pos-oficial.vercel.app):

- Frontend: HTML5 + JS vanilla (sin build, sin framework) + Tailwind precompilado.
- Backend: **una sola función serverless Express** en `api/index.js` (~3.700 líneas),
  desplegada en Vercel con rewrite `/api/(.*)` → `/api/index`.
- BD: Supabase Postgres ("Supabase POS"), RLS activo, **sin políticas públicas**.
  Solo la `service_role` (usada exclusivamente por el backend) lee y escribe.
- Auth: JWT emitido tras validar un PIN (`ADMIN_PIN`/`WORKER_PIN`).
  Este esquema es para **staff interno**, nunca se reutiliza para clientes públicos.
- Documentación del POS: `docs/README.md` (maestro), `docs/SNAPSHOT.md` (estado actual),
  `CLAUDE.md` (reglas para Claude Code). Los README antiguos están en `docs/archivo/`.
- Convenciones obligatorias:
  - Fechas/horas siempre en `America/Santiago`, nunca `toISOString()` directo.
    El frontend usa `todayISO()`, `horaActualCorta()`, `fechaHoraChile()`, `tsAChile()`
    de `js/config.js`; el backend usa `marcaDeTiempoChile()` en `api/index.js`.
  - Montos en CLP siempre con `fmtCLP()` (separador de miles hecho a mano, nunca
    `toLocaleString('es-CL')` porque el ICU recortado de Android lo rompe en móvil).
  - Escape de todo dato de usuario en el DOM con `escHtml()`.
  - Búsqueda por palabras sueltas con `tokensBusqueda()` / `filtrarPorBusqueda()`
    de `js/config.js`.
  - Idioma: todo el código, comentarios y mensajes en español.
  - Errores: siempre `try/catch` con log explícito, nunca fallos silenciosos.
  - **Dos funciones globales nunca pueden llamarse igual** (todos los `js/*.js` comparten
    scope). Chequeo obligatorio tras editar; ver `CLAUDE.md`.

### 1.1 Riesgo ya identificado y su corrección obligatoria (Fase 0)

`ajustarStock()` en `api/index.js` (alrededor de la **línea 1161** en la v16) hoy hace
**lectura y luego escritura** (SELECT stock → calcula → UPDATE). Ya resuelve productos por
lotes y lanza los UPDATE en paralelo (optimización de rendimiento), pero sigue **sin ser
atómico**. Con un solo canal de venta (la caja) el riesgo era bajo; en cuanto exista un
segundo canal (la web) escribiendo sobre el mismo stock, dos ventas casi simultáneas pueden
leer el mismo stock y ambas descontarlo, dejando stock negativo o vendiendo el mismo ítem dos
veces. **Esto se corrige en la Fase 0, antes de construir cualquier cosa de la tienda.**

> **Nota (agosto 2026, tras ejecutar la Fase 0 real):** este riesgo ya estaba resuelto desde
> v18/v22 del POS, con un diseño distinto al que describe este párrafo — ver
> `docs/CHANGELOG-V24.md`. Se deja el texto original sin editar como registro histórico de la
> decisión que motivó la Fase 0; no re-implementar `ajustar_stock_atomico` sobre lo que ya
> existe (`descontar_stock_venta`, `sql/19-stock-atomico.sql`).

### 1.2 Lo que NO existe hoy y hay que construir desde cero

- No hay columna `imagen_urls` ni bucket de imágenes de producto (solo existe el
  bucket `compras-documentos`, para comprobantes de gastos). El catálogo actual
  se llena pegando texto del panel de Tiendanube (`js/tiendanube.js`), sin fotos.
- `productos` sí tiene `peso_kg`, `alto_cm`, `ancho_cm`, `profundidad_cm`
  (agregadas en `sql/01-actualizaciones.sql`), útiles para cotizar con Shipit,
  pero su completitud en productos antiguos no está garantizada — **auditar
  antes de confiar en ellas para logística** (esto es el punto 0.6 de la Fase 0).

---

## 2. Decisiones de arquitectura ya tomadas (no reabrir la discusión)

| Decisión | Resuelto como |
|---|---|
| Despliegue | **Proyecto Vercel independiente** para la tienda (repo separado del POS). Aísla el blast radius: un bug en el checkout público nunca debe poder tumbar la caja física. |
| Concurrencia de stock | Se migra a **UPDATE atómico vía RPC de Postgres** en el proyecto del POS, **antes** de tocar la tienda. Fuente única de verdad: Supabase POS. |
| Imágenes de producto | El **POS es la fuente canónica**. El bucket y el pipeline de Canvas nacen en el POS; la tienda solo consume las URLs públicas ya generadas (no se duplica el binario). |
| Identidad del cliente | **Checkout como invitado** en esta fase (sin cuentas). Cuentas de cliente quedan fuera de alcance, para una fase futura no incluida en este documento. |
| Sincronización POS → Web | **Database Webhook de Supabase** (basado en `pg_net`, configurable desde el dashboard, sin trigger SQL manual) sobre `productos`, que hace POST a un endpoint de la tienda en cada `INSERT/UPDATE/DELETE`. Push, no polling. |
| Envíos | Nunca gratis ni $0 (`costo_envio` con `CHECK > 0` en el esquema). Local (Haversine, Arica) o Courier (Shipit). |
| **Administración de la tienda** | **Se hace ENTERAMENTE desde el POS existente.** La tienda pública (sevelin.cl) NO tiene back-office propio: es solo el escaparate. No se construye un panel tipo Tiendanube aparte. Un único operador (el dueño) gestiona todo desde el POS. Ver sección 2.1. |

### 2.1 Gestión centralizada desde el POS (no hay panel web aparte)

El POS ya es un back-office completo (productos, categorías, stock, ventas, finanzas, caja).
**No se duplica esa gestión en la tienda web.** La tienda pública solo *muestra* lo que el POS
publica; no tiene pantalla de administración. Todo lo relativo a la web se controla desde el
modal de producto y las pantallas que ya existen en el POS.

**Controles web que se agregan al POS** (en el modal de producto, `js/productos.js` +
`index.html`), todos sobre las columnas creadas en `sql/20-imagenes-web.sql`:

- **Publicar / ocultar en la web** — toggle sobre `publicado_web`. Un producto puede existir en
  el POS y no estar en la tienda. Nada se publica sin marcarlo explícitamente.
- **Precio web** — campo opcional (`precio_web`). Si está vacío, la web usa el precio normal del
  POS. Si tiene valor, la web usa ese (permite promos web sin alterar el precio de la caja).
- **Descripción y fotos web** — `descripcion_web` + el pipeline de imágenes (`imagen_urls`) de
  la Fase 0. Es la ficha que verá el cliente.
- **Categoría / orden para la web** — cómo se agrupa y ordena el producto en el catálogo público.

**Qué NO se construye** (para no agregar peso inútil): no hay gestión de banners/cupones web,
ni segundo login, ni panel de estadísticas web duplicado, ni administración multiusuario. Si en
el futuro se necesita algo de eso, se evalúa como fase aparte; hoy está **fuera de alcance a
propósito**.

**Único añadido de gestión fuera del modal de producto:** el panel "Pedidos Web" dentro del POS
(Fase 5), para ver y despachar las compras que llegan de internet. Es lectura + cambio de estado
de envío, no un back-office nuevo.

> Consecuencia de diseño: como la administración vive en el POS y la tienda es solo lectura
> pública, la web puede ser muy simple y robusta. Menos superficie de ataque, menos que mantener.

---

## 3. Arquitectura general

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   sevelin-pos-oficial    │        │      sevelin-tienda        │
│   (proyecto Vercel A)    │        │      (proyecto Vercel B)   │
│                          │        │                            │
│  api/index.js (Express)  │        │  api/index.js (Express)   │
│      │                   │        │      │                     │
│      ▼                   │        │      ▼                     │
│  Supabase POS            │──DB    │  Supabase Web              │
│  (service_role, RLS on)  │Webhook │  (service_role, RLS on)    │
│  · productos             │──────► │  · productos_web           │
│  · producto_lotes        │ push   │  · pedidos_web              │
│  · ventas / venta_items  │        │                            │
│  · bucket productos-     │◄───────│  (lee imagen_urls públicas) │
│    imagenes (público      │        │                            │
│    lectura)               │  llamada interna con SYNC_SECRET    │
│      ▲                   │◄───────┤  al confirmar pago:         │
│      │ ajustar_stock_    │        │  POST /api/interno/         │
│      │ atomico() (RPC)   │        │       ajustar-stock         │
└─────────────────────────┘        └──────────────────────────┘
        ▲                                        ▲
        │ JWT staff (PIN)                        │ sin auth (público)
        │                                        │ + Flow + OpenFactura + Shipit
   Caja física (index.html POS)          sevelin.cl (tienda pública)
```

Los dos Supabase son proyectos **distintos**: no hay foreign keys reales entre
`productos` (POS) y `productos_web` (Web). La relación es lógica, vía
`producto_pos_id`, y se mantiene sincronizada por el webhook.

---

## 4. Esquema de base de datos

### 4.1 Supabase POS — cambios nuevos (además de lo que ya existe)

> En la v16 la última migración es `sql/18-gastos-programados.sql`. Por eso el stock atómico
> va en **`sql/19-stock-atomico.sql`** y las imágenes en **`sql/20-imagenes-web.sql`**.

```sql
-- sql/19-stock-atomico.sql
-- Función atómica de ajuste de stock (reemplaza el patrón SELECT+UPDATE)
CREATE OR REPLACE FUNCTION ajustar_stock_atomico(
  p_producto_id BIGINT,
  p_cantidad NUMERIC,      -- siempre positivo
  p_signo SMALLINT         -- -1 vender, +1 devolver/anular
) RETURNS NUMERIC AS $$
DECLARE
  v_nuevo NUMERIC;
BEGIN
  UPDATE productos
     SET stock = stock + (p_signo * p_cantidad),
         stock_actualizado_en = NOW()
   WHERE id = p_producto_id
     AND stock_ilimitado = FALSE
     AND (p_signo = 1 OR stock >= p_cantidad)
  RETURNING stock INTO v_nuevo;

  IF v_nuevo IS NULL THEN
    RAISE EXCEPTION 'STOCK_INSUFICIENTE' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_nuevo;
END;
$$ LANGUAGE plpgsql;
```

```sql
-- sql/20-imagenes-web.sql
-- Imágenes de producto y banderas de publicación web
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS imagen_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS publicado_web BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS descripcion_web TEXT,
  ADD COLUMN IF NOT EXISTS precio_web NUMERIC; -- NULL = usa el precio normal
```

> **Nota (tras ejecutar la Fase 0 real):** el repo ya iba en v23 al ejecutar esta fase, con
> `sql/19` y `sql/20` ya ocupados por otro contenido real. La migración de imágenes se aplicó
> como `sql/21-imagenes-web.sql` (con una columna adicional, `categoria_web`, no prevista en
> este snippet) y la de stock atómico no se creó — ya existía. Ver `docs/CHANGELOG-V24.md`.

Bucket nuevo `productos-imagenes`: **lectura pública, escritura solo `service_role`**.
Esto no contradice la regla "RLS sin políticas públicas" del POS: esa regla es sobre
**tablas**, no sobre buckets de Storage. El bucket de imágenes es la única excepción
intencional, porque una foto de catálogo necesita ser servida directo al navegador del
cliente en sevelin.cl sin pasar por el backend.

### 4.2 Supabase Web (proyecto nuevo — se crea en la Fase 1)

```sql
CREATE TABLE productos_web (
  id BIGSERIAL PRIMARY KEY,
  producto_pos_id BIGINT NOT NULL UNIQUE,   -- referencia lógica, no FK real
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion_web TEXT,
  precio_web NUMERIC NOT NULL,
  stock_web NUMERIC NOT NULL DEFAULT 0,     -- espejo de solo lectura
  imagen_urls TEXT[] DEFAULT '{}',
  categoria TEXT,
  publicado_web BOOLEAN NOT NULL DEFAULT FALSE,
  peso_kg NUMERIC, alto_cm NUMERIC, ancho_cm NUMERIC, profundidad_cm NUMERIC,
  sincronizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pedidos_web (
  id BIGSERIAL PRIMARY KEY,
  numero_pedido TEXT UNIQUE NOT NULL,       -- correlativo "WEB-000001"
  estado TEXT NOT NULL DEFAULT 'CREADO',    -- CREADO/PAGADO/PREPARANDO/ENVIADO/ENTREGADO/CANCELADO/FALLIDO
  cliente_nombre TEXT, cliente_email TEXT, cliente_telefono TEXT,
  direccion_envio JSONB NOT NULL,
  items JSONB NOT NULL,                     -- snapshot: nombre/precio al momento de compra
  metodo_envio TEXT NOT NULL,                -- 'LOCAL' | 'COURIER'
  costo_envio NUMERIC NOT NULL CHECK (costo_envio > 0),
  subtotal NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  flow_token TEXT UNIQUE,
  flow_order BIGINT,
  url_boleta_sii TEXT,
  folio_dte TEXT UNIQUE,
  tracking_courier TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE productos_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_web   ENABLE ROW LEVEL SECURITY;
-- Sin políticas públicas: solo la service_role (backend de la tienda) toca estas tablas.
```

> **Nota (Fase 1 ya ejecutada):** este schema se aplicó tal cual en
> `sevelin-tienda/supabase/01-productos-web-pedidos-web.sql`. El proyecto Supabase Web real
> todavía no está creado por el usuario — ver `sevelin-tienda/docs/SNAPSHOT.md` para el estado
> exacto y los pasos pendientes.

`UNIQUE (flow_token)` y `UNIQUE (folio_dte)` son la defensa contra reintentos
duplicados de Flow/OpenFactura: si el webhook llega dos veces, el segundo
INSERT/UPDATE choca contra la constraint y el código responde "ya procesado"
en vez de cobrar o timbrar dos veces.

---

## 5. Backend de la tienda — endpoints

Todos en un nuevo `api/index.js` del proyecto `sevelin-tienda` (mismo patrón
Express monofunción que el POS, pero en un despliegue separado):

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/productos` | Lista `productos_web` donde `publicado_web=true AND stock_web>0` |
| GET | `/api/productos/:sku` | Detalle de un producto |
| POST | `/api/sync/producto` | Receptor del Database Webhook del POS. Body = fila de `productos`. Hace upsert en `productos_web` (mapea solo los campos públicos, respeta `publicado_web`). Protegido con un secreto compartido (`SYNC_SECRET`) en el header, **no** con JWT de staff. |
| POST | `/api/cotizar-envio` | Recibe dirección + items. Si está dentro de 10 km de la tienda en Arica (Haversine): tarifa local. Si no: proxy a la API de Shipit. Nunca retorna $0. |
| POST | `/api/checkout` | Crea `pedidos_web` en estado `CREADO`, valida stock contra `productos_web.stock_web` (validación optimista; la validación real y bloqueante ocurre en el paso 3.3 de la Fase 3), y llama a `/payment/create` de Flow. |
| POST | `/api/flow-webhook` | Ver sección 6. Debe responder HTTP 200 en menos de 15 segundos (límite duro de Flow). |
| GET | `/api/pedido/:numero` | Consulta de estado de un pedido por número (para que el cliente invitado revise su compra sin cuenta). |

> **Nota (Fase 1 ya ejecutada):** `sevelin-tienda` se construyó en Next.js (App Router), no
> Express — decisión del usuario, aceptada porque no afecta el aislamiento ni la seguridad del
> diseño. Los endpoints de catálogo y sincronización ya existen como Route Handlers de Next.js,
> con el mismo contrato descrito arriba. `cotizar-envio`, `checkout`, `flow-webhook` y
> `pedido/:numero` son de las Fases 3/4, todavía no construidos.

Y en el backend del **POS existente** (`sevelin-pos-oficial/api/index.js`), dos
rutas nuevas:

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/interno/ajustar-stock` | Llama a `ajustar_stock_atomico()`. Protegida con `SYNC_SECRET` (mismo secreto que el webhook, en header, **no** JWT de staff: quien llama es el backend de la tienda, no una persona logueada). |
| GET/PUT | `/api/pos/pedidos-web` | Panel "Pedidos Web" del POS (Fase 5). Reutiliza `auth(true)` (admin) ya existente. Lee/actualiza pedidos vía una vista o réplica de solo lectura — **decidir en Fase 5** si se consulta a Supabase Web directamente (requiere sus credenciales en el POS) o si la tienda expone un endpoint de solo lectura para el POS. |

---

## 6. Flujo de pago (Flow) y DTE (OpenFactura) — se implementa en la FASE 3

> Esta sección es el plano de las pasarelas de pago. NO se toca en la Fase 0 ni en la 1–2:
> se construye en la **Fase 3**. Está aquí desde el día uno para que el diseño esté cerrado,
> pero cada fase solo ejecuta su parte.

**Flow** (`https://www.flow.cl/api` / `https://sandbox.flow.cl/api` para pruebas):

1. El backend de la tienda llama a `POST /payment/create` (form-urlencoded,
   firmado con `apiKey` + `secretKey` según el algoritmo de Flow: ordenar
   parámetros alfabéticamente, concatenar `clave=valor` y firmar con HMAC).
   Responde `{ url, token, flowOrder }`.
2. Redirigir al navegador del cliente a `url + "?token=" + token`.
3. Flow hace **POST a `urlConfirmation`** (nuestro `/api/flow-webhook`) cuando
   el pago se resuelve. **Regla dura de Flow: responder HTTP 200 en menos de
   15 segundos**, o Flow lo marca como fallo de integración.
4. **El body del webhook nunca se usa como prueba de pago.** Al recibirlo, el
   backend debe llamar a `GET /payment/getStatus?token=...` con sus propias
   credenciales para confirmar el estado real antes de marcar `pedidos_web`
   como `PAGADO`. Cualquiera puede hacer POST a una URL pública; solo
   `getStatus` (llamado por el propio comercio) es confiable.
5. Solo después de confirmar el pago real: (a) llamar a
   `/api/interno/ajustar-stock` en el POS, (b) emitir el DTE en OpenFactura,
   (c) marcar `pedidos_web.estado = 'PAGADO'`.

**OpenFactura** (Haulmer):

- `POST https://dev-api.haulmer.com/v2/dte/document` (usar el host de
  producción equivalente fuera de pruebas) con header `apikey` y, crucialmente,
  header **`Idempotency-Key`** — usar `numero_pedido` como valor. Esto es la
  defensa nativa de Haulmer contra doble emisión si el flujo se reintenta.
- `TipoDTE` en el body: boleta electrónica o factura electrónica según
  corresponda (confirmar el código exacto vigente en la documentación de
  Haulmer al momento de implementar — no asumirlo de memoria).
- Guardar el folio y el link de la boleta que retorna la API en
  `pedidos_web.folio_dte` y `pedidos_web.url_boleta_sii`.

**Nota de infraestructura:** la cadena completa (verificar pago → ajustar stock
cross-proyecto → emitir DTE → escribir en BD) implica varias llamadas HTTP
secuenciales dentro de la ventana de 15s de Flow. Configurar `maxDuration` en
la función de Vercel de este proyecto (requiere plan Vercel Pro para superar
los 10s por defecto del plan Hobby) para no arriesgar un timeout a mitad de la
cadena.

---

## 7. Referencia de diseño — sevelin.cl

Se revisó **www.sipoonline.cl** (tienda chilena de tecnología, mismo rubro que
Sevelin) como referencia de patrones de e-commerce profesional. No se copia su
contenido ni sus imágenes; se toman los **patrones de UX** que ya están
validados en el mercado chileno:

- **Header:** mega-menú de categorías desplegable (categoría → subcategoría),
  buscador, ícono de carrito que abre un **drawer lateral** (no una página
  aparte) con resumen del pedido, subtotal, envío y total.
- **Hero:** carrusel de banners promocionales a todo ancho.
- **Grillas de producto:** tarjeta con imagen cuadrada, marca/SKU chico arriba
  del nombre, nombre, precio (con precio tachado + badge de % si hay
  descuento), selector de cantidad y botón "Agregar". *(Sevelin no maneja
  cuotas con tarjeta como Sipo, así que se omite esa línea — no inventar un
  sistema de cuotas que no existe en el negocio real.)*
- **Franja de confianza** debajo del contenido principal: 3–4 íconos con texto
  corto (ej. "Pago seguro", "Atención por WhatsApp", "Garantía", "Despacho a
  todo Arica y Chile") — adaptar el copy a lo que Sevelin realmente ofrece,
  no copiar literalmente el de Sipo.
- **Botón flotante de WhatsApp** persistente en toda la tienda.
- **Footer:** navegación secundaria, redes sociales, teléfono/WhatsApp de
  contacto, logos de medios de pago aceptados.

La identidad visual (colores, tipografía, logo) es propia de Sevelin, no de
Sipo — se toma solo la **estructura de la experiencia**, que es un patrón de
industria, no propiedad de nadie en particular.

---

## 8. Plan de fases

> Cada fase es una sesión de trabajo autocontenida. Al empezar una fase nueva,
> pegar este README completo + el PROMPT DEFINITIVO correspondiente a esa fase.
>
> **Actualización (agosto 2026):** ya no es necesario que el usuario escriba un
> PROMPT DEFINITIVO a mano por cada fase — un prompt fijo se desactualiza a medida
> que el código avanza (pasó con el de la Fase 0). Al empezar una fase nueva basta con
> pedirle a Claude que la ejecute: la deriva de esta tabla + el `SNAPSHOT.md` real del
> repo correspondiente en ese momento, y confirma cualquier discrepancia antes de
> escribir código (mismo criterio que se usó en la Fase 0 y la Fase 1).

| Fase | Contenido | Repo/proyecto que toca |
|---|---|---|
| **0** ✅ | Migrar `ajustarStock()` a `ajustar_stock_atomico()` (RPC, `sql/19`). Agregar columnas de imagen a `productos` (`sql/20`). Crear bucket `productos-imagenes`. Construir el pipeline Canvas 1000×1000→webp en el modal de producto del POS. Auditar `peso_kg`/dimensiones del catálogo existente. | `sevelin-pos-oficial` (existente) |
| **1** ✅ | Crear proyecto Supabase Web + tablas `productos_web`/`pedidos_web`. Crear proyecto Vercel `sevelin-tienda` con su `api/index.js` y su propio `CLAUDE.md`. Endpoints de catálogo y `/api/sync/producto`. Configurar el Database Webhook en Supabase POS. Ruta interna `/api/interno/ajustar-stock` en el POS. | Proyecto nuevo + POS |
| **2** | Frontend público: home, listado, ficha de producto, carrito drawer, diseño inspirado en la sección 7. | Proyecto nuevo |
| **3** | Checkout + **Flow (pasarela de pago) + OpenFactura (boletas)**, con la lógica de verificación descrita en la sección 6. | Proyecto nuevo |
| **4** | Cotización de envío: Haversine local + Shipit. | Proyecto nuevo |
| **5** | Panel "Pedidos Web" dentro del POS. | `sevelin-pos-oficial` |
| **6** | QA end-to-end, apuntar el dominio sevelin.cl, checklist de lanzamiento. | Ambos |

> **Estado real de 0 y 1:** ejecutadas con desviaciones respecto al texto original de este
> documento (ver notas en las secciones 1.1, 4.1, 4.2 y 5) — el detalle completo de cada
> desviación y por qué se aprobó está en `docs/CHANGELOG-V24.md` (repo del POS) y
> `sevelin-tienda/docs/CHANGELOG-V01.md`. La Fase 1 dejó **pendiente, bloqueado fuera de
> cualquier sesión de Claude**: crear el proyecto Supabase Web real, el proyecto Vercel, y
> configurar el Database Webhook — ver `sevelin-tienda/docs/SNAPSHOT.md`.

---

## 9. Checklist de variables de entorno nuevas

**Proyecto `sevelin-pos-oficial` (agregar a las ya existentes):**
- `SYNC_SECRET` — secreto compartido para `/api/interno/ajustar-stock`.

**Proyecto `sevelin-tienda` (nuevo, desde la Fase 1):**
- `SUPABASE_WEB_URL`, `SUPABASE_WEB_SERVICE_ROLE_KEY`
- `SYNC_SECRET` — el mismo valor que en el POS.
- `POS_INTERNAL_API_URL` — URL del endpoint `/api/interno/ajustar-stock` del POS.
- `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FLOW_API_BASE` (sandbox o producción). ← Fase 3
- `OPENFACTURA_API_KEY`, `OPENFACTURA_API_BASE`. ← Fase 3
- `SHIPIT_API_KEY` (o equivalente según su documentación vigente). ← Fase 4
- `CORS_ORIGINS=https://sevelin.cl`

---

## 10. Historial de cambios de este documento

- **v16 (versión original):** actualizados los números de migración (stock atómico → `sql/19`,
  imágenes → `sql/20`, porque la última migración del POS es la 18); la URL de producción
  (`sevelin-pos-oficial.vercel.app`); la referencia al README del POS (ahora `docs/README.md`
  + `docs/SNAPSHOT.md` + `CLAUDE.md`); y la ubicación de `ajustarStock()` (línea ~1161). Se
  marcó explícitamente que las pasarelas de pago (Flow/OpenFactura) son de la Fase 3, no de
  la Fase 0. El resto de la arquitectura no cambió.
- **26-08-2026:** archivo copiado desde `Documents` a `docs/README-ECOMMERCE-SEVELIN.md` (este
  repo) para que quede versionado — antes solo existía fuera de cualquier repositorio. Se
  agregaron notas señalando dónde la ejecución real de las Fases 0 y 1 (repo ya en v23, no v16)
  se desvió del texto original, sin borrar el texto original (queda como registro histórico de
  la decisión). Sección 8 actualizada con el estado real de cada fase y una nota explicando que
  ya no hace falta un PROMPT DEFINITIVO escrito a mano por fase.
