# SNAPSHOT — Sevelin POS
> Léelo (o pégalo) al abrir un chat nuevo o al llevar el proyecto a otra IA.
> Actualiza SOLO este archivo al cerrar una sesión. Para el detalle completo, ver `docs/README.md`.
> Para saber qué otro documento leer según lo que necesites, ver `docs/README-DOCS.md`.
>
> **⚠️ EL DUEÑO TRABAJA EN SONNET.** Si la tarea que te mandó conviene hacerla en Opus, **avísale en
> una línea antes de empezar y espera su respuesta**. El criterio completo está en `CLAUDE.md`,
> sección "Modelo: avísame si esta tarea pide Opus".

## 🔴 PENDIENTES ABIERTOS (al 25-09-2026) — leer esto primero

**Del dueño (Carlos), bloquean cosas ya construidas:**

1. **Cargar el costo de los dos insumos de taller.** `UPSIREN Thermal Putty 100g` y
   `Thermal Paste M12 30g` están en **costo $0**. Mientras sigan así, los mantenimientos aparentan
   100% de margen — justo la mentira que el módulo de protocolos existe para corregir. Se hace en
   POS → Servicio Técnico → Repuestos Taller. El putty está **a 1/4** (≈15 aplicaciones gastadas de
   20). Los rendimientos (20 y 40) son estimaciones de Claude, no medidas.
2. **Crear la app de Meta en modo desarrollo** y agregarse como Instagram Tester. Es el ÚNICO paso
   que falta para publicar en Instagram desde el POS — todo lo demás ya está verificado.
3. **Terminar de registrar las ventas de septiembre.** Dijo que le faltan. Hasta entonces el mes
   marca −$650.000 y no se sabe si es real.
4. **Revisar las 9 fases** del protocolo "Mantenimiento Preventivo PC Gamer": son un borrador
   escrito por Claude, no el procedimiento real del taller.
5. **Probar la lámina PTM7950.** La aplicará cuando alguien pida el servicio, que ya está publicado.

**Anotado, no hecho (decidido, sin construir):**

- **La pantalla para crear y editar protocolos.** Acuerdo explícito: primero un protocolo real
  funcionando en una OT, después el editor. Hoy se cargan por SQL.
- **`repuestos` no tiene `archivado`:** al cambiar de marca de pasta, la vieja queda para siempre.
- **Vincular la entrada de mercadería con su gasto en `compras`** — hoy son dos mundos separados
  (0 de 8 entradas tienen `compra_id`), y por ahí se pierde IVA crédito.

**⚠️ Trampas vivas que NO hay que re-descubrir:**

- **Las 2 pilas CR2032 de OT-000005 y OT-000006 ya están registradas a mano.** Si se aplica el
  protocolo y se tacha la fase "Cambio de pila CR2032", se descuenta una SEGUNDA. No es obligatoria,
  así que no bloquea la entrega.
- **Instagram HOY es `@sevelin_cl`**, no `@sevelin.cl` — todavía no le liberan el nombre. Cuando lo
  consiga: cambiar `INSTAGRAM` en `scripts/generar-imagenes-servicios.js` y regenerar las 40.
- **El norte de Chile es MÁS BARATO que Santiago** en servicios básicos (formateo informal
  $9.000-$14.000 en Antofagasta contra $25.000-$29.990 en Santiago; tarifa base de técnico $20.000).
  No recomendar precios usando referencias de Santiago.
- **`trg_sync_tienda` es "dispara y olvida" con 5 s de tope.** Ya se comió un producto. El chequeo de
  Página Web → Salud lo detecta, pero hay que mirarlo.

---

## 📷 Instagram: verificado en las cuentas reales (25-09-2026, vía Chrome)

Se cumplen **todos** los requisitos de la API de publicación:

| | |
|---|---|
| Cuenta profesional | ✅ `@sevelin_cl`, categoría "Tienda de informática" |
| Página de Facebook conectada | ✅ "Sevelin Arica - Tienda de Tecnología" |
| Portafolio de Meta Business | ✅ |
| **ID de cuenta business** | **`17841423397901970`** |
| Cuenta publicitaria conectada | ✅ |

**No hace falta Metricool pagado** (su API pide el plan Advanced, ~US$53/mes) **ni la revisión de app
de Meta**: publicar en la cuenta propia se hace con la app en modo desarrollo. El token de larga
duración vive 60 días y **no se renueva solo** — construir el aviso de vencimiento junto al
publicador, o se apaga en silencio.

---

## 24 y 25-09-2026 · v88 a v91, servicios, imágenes y chequeos

**Módulos nuevos, todos en producción:**

- **v88 — Activos de uso interno** (`sql/64`, Finanzas → 🛠️ Activos). Unidades que salen del stock
  para usarse como herramienta. **Regla aprobada: NO mueve el balance** (la compra ya está en
  `compras`; anotarla otra vez sería contarla dos veces). 🔴 Trampa evitada: mandar el "dado de baja"
  a Mermas habría descontado el stock por SEGUNDA vez.
- **v89 — Aviso de factura pendiente** (`sql/65`). Casilla en "Compras de este producto" + chip 🧾.
  **Marca explícita, no "referencia vacía"**: las 8 entradas registradas tienen ese campo vacío y un
  aviso automático habría gritado por todas desde el día uno.
- **v90 — Protocolos y fases de servicio** (`sql/66`). 🔴 **Regla del dueño que invierte la anterior:
  el insumo sale del stock AL TACHAR LA FASE**, no al entregar. Conviven porque lo que consume una
  fase se guarda con `stock_descontado = true`. Envases **por rendimiento, no por peso**. Entregar
  con fases obligatorias pendientes: **solo admin y con motivo escrito**.
- **v91 — Chequeo de sincronización con la tienda** (Página Web → Salud). Nació de una falla real: de
  13 sincronizaciones, **una murió por el timeout** y el producto quedó fuera de la web sin que nadie
  se enterara. Separa **faltantes** (no se ven) de **sobrantes** (⚠️ siguen vendibles aunque el POS
  los despublicó). Chip 🌐 que solo aparece si hay descuadre.
- **Rendimiento configurable** (25-09): los campos de `sql/66` no estaban en el formulario de
  Repuestos, y `precio_venta` exigía ser > 0 — un insumo de taller que nunca se vende suelto era
  **imposible de guardar**. Ambas cosas corregidas.

**Catálogo de servicios: de 27 a 41.** 13 nuevos + Visita a Domicilio + Premium con PTM7950 (solo
notebook). Los de precio variable usan `precio_a_consultar`, que bloquea el carrito y deriva a
WhatsApp. **Las 40 fichas ya tienen imagen**, todas de la misma plantilla
(`scripts/generar-imagenes-servicios.js`: SVG + sharp → 800×800 WebP, sin IA, por eso son uniformes).

**Servicio a domicilio:** $10.000 **solo dentro de Arica** (no va a Azapa, Lluta, playas ni
Chacalluta), **mínimo de visita $25.000**, y **pago 100% anticipado** por decisión del dueño.

**Datos de producción corregidos:** pila CR2032 (id 298) de stock 25 → **23**, con categoría nueva
"Pilas"; **las dos primeras OT del sistema** (OT-000005 y OT-000006, PC Gamer del 17-09, con datos de
cliente **por completar**); Diagnóstico Avanzado subió a $15.000.

**Ventas de septiembre — medido, NO es error de datos:** 70 ventas / $1.826.000 contra 113 /
$4.123.000 en el mismo tramo de agosto. **Toda la brecha son las ventas grandes**: de 25 sobre
$100.000 ($2.960.000) a 6 ($688.000). Margen 31,4% → 25,1%. Con $1.109.873 de gastos fijos, el mes va
en **pérdida**. Falta que el dueño termine de registrar.

**Pruebas de la sesión: 299 comprobaciones, 0 fallas**, en 7 suites (dobles de Supabase + jsdom).

---

> **v88, v89 y v90 (24-09-2026)** están resumidas arriba. El detalle completo de cada una, con
> el porqué de cada decisión, está en `docs/CHANGELOG-V88.md`, `V89.md` y `V90.md`.

---

**Fecha:** 23-09-2026 · **v86 y v87 — la alerta de Google, y los agotados vuelven al catálogo.**

Sesión disparada por una alerta de Merchant Center: los artículos activos cayeron de **178 a 134**
(-24%) entre el 22-09 18:20 y el 23-09 00:20.

- ✅ **El feed NO se cayó.** Google lo leyó el 23-09 a las 00:00 y Meta el 22-09 a las 20:17, las dos
  sin errores. La caída era **aritmética**: de 179 publicados, 27 son servicios y **20 estaban sin
  stock**. Quedaban 132, que es lo que ambas leyeron (131).
- 🔴 **v86 — el feed mandaba los 18 productos por encargo a `/productos/<sku>`, que da 404.** Era el
  mismo error del sitemap arreglado el 22-09; el feed tenía su propia copia y quedó fuera. Corregido
  y **Google lo releyó el mismo día a las 16:18**.
- 🟢 **v87 + `sevelin-tienda b18ba67` — las fichas de los agotados ya existen** (decisión del dueño).
  Al hacerlo aparecieron **tres capas del mismo problema**: la ficha daba 404, el endpoint
  `POST /api/avisos` también rechazaba los agotados, y **el botón "Agregar al carrito" nunca estuvo
  bloqueado por stock**. La tabla `avisos_producto` tenía 0 filas: no era falta de interés, no había
  forma de llegar.
- ⚠️ **La trampa que se evitó:** `obtenerProductoPorSku` la usa el **CHECKOUT** (y envío, carrito,
  cotizaciones, recordatorios). Relajarla habría permitido **pagar algo que no hay**, en seis lugares
  de una vez. Se agregó `obtenerProductoPublicado` aparte, solo para mostrar.
- 📈 Los agotados ahora entran al feed como `out of stock` en vez de desaparecer. Sitemap: 165 → 186
  URLs. Verificado en producción.

**Hallazgos de cuentas (no código), todos verificados en los paneles del dueño:**

- 🗑️ **Origen zombi "Tiendanube API"** (15 productos, sin fecha de actualización) seguía vivo en
  Merchant Center pese a haberse eliminado en septiembre. **Lo borró el dueño el 23-09.**
- 🛡️ **"Protección de productos" activada al 40%.** Ojo: es un seguro contra un feed roto entero,
  **NO** habría frenado la caída del 24% de esa noche.
- 🔎 **Google rastrea sevelin.cl por su cuenta** como fuente aparte ("Encontrado por Google", 57→59
  productos, 11 archivados, cada 24 h), en paralelo al feed. Sin tocar, anotado.
- 🚫 **LAS TIENDAS DE META NO EXISTEN EN CHILE.** Verificado entrando al flujo con su mercado: *"Las
  tiendas no están disponibles en tu país"*, botón deshabilitado. **No hay Instagram Shopping ni
  pestaña Tienda en Facebook, y no es cosa de configuración.** El catálogo (131 productos, sin
  errores, diario) sirve solo para **anuncios**. No volver a intentarlo.
- 💬 **WhatsApp tiene su PROPIO catálogo** (`1102236602767558`, "Sin acceso" para el dueño) y estaba
  **vacío**. Se decidió NO llenarlo a mano: 131 productos cargados uno a uno se desactualizan en
  semanas, que es la misma trampa de Tiendanube por tercera vez.
- ✅ **Perfil de WhatsApp Business corregido:** correo `sevelin.contacto@gmail.com`, y horarios
  alineados con la web (**lunes a domingo 11:00-13:00 y 14:00-20:00**; antes decía domingo cerrado y
  16:00-19:00 — se contradecía con sevelin.cl).
- ⚡ **Seis respuestas rápidas nuevas** escritas desde su propia FAQ: `/garantia`, `/horario`,
  `/envios`, `/pagos`, `/catalogo` (manda a sevelin.cl) y `/encargo`.

**Decisión pendiente del dueño:** qué repone de los 20 agotados. De los 11 que han vendido, el
**Gabinete ESGAMING HA06** aporta $50.050 de los $127.417 de utilidad del grupo, y el **Control Mando
PS3/PC** es el mejor margen (48%, cuesta $3.610). Los monitores venden pero dejan 7-8%.

---

**Fecha:** 22-09-2026 · **v85 publicada — el buscador del Historial estaba en la pantalla equivocada.**

- 🔍 **No había que construir nada:** el buscador por producto / SKU / N° de serie / código de barras
  ya existía completo (servidor y JavaScript). Su bloque HTML estaba **dentro de Servicio Técnico →
  Abonos y Encargos**, no en Finanzas → Historial de Ventas. Invisible donde hace falta, inútil donde
  estaba. Se movió el bloque; el JavaScript no se tocó.
- 💳 **Nuevo filtro por medio de pago**, como desplegable junto al de envíos: son 5 valores cerrados y
  escribir "tarjeta" nunca acertaría entre Débito y Crédito. **Mira `metodo_pago_final` primero**
  (una venta que nació "Por Pagar" y se cobró en efectivo tiene su medio real ahí), y las mixtas
  tienen su propia opción porque no son "un" medio.
- 🧪 21 comprobaciones en jsdom + navegador real.
- ⚠️ **Trampa repetida:** el navegador cachea los `js/*.js`. Probando a mano el filtro "no
  funcionaba" porque la página usaba un `historial.js` viejo (ya había pasado con `balance.js` en la
  v83). Las pruebas definitivas van en **jsdom, que lee del disco**; y conviene Ctrl+F5 al abrir el
  POS tras una actualización.

**v84 (22-09-2026) — seguimiento del producto devuelto, con el balance bajo su control.**

- 📮 **Qué pasó con el producto DESPUÉS de la devolución** (`sql/63`): al proveedor, a la garantía del
  fabricante, reparado, me lo quedé, o botado. Va **por producto** y no por devolución (decisión del
  dueño): de dos cosas devueltas juntas, una puede ir al proveedor y la otra a la basura.
- 🏭 **Proveedor y fabricante son caminos distintos** (decisión del dueño: *"Sí, son diferentes"*):
  cambian a quién le reclamas, los plazos y qué esperas de vuelta.
- 🔴 **LA REGLA QUE DEFINE TODO EL MÓDULO** (decisión del dueño): *"siempre yo debo vigilar y aprobar
  si se debe ajustar o no manualmente, para que no se descuente de forma automática del balance"*.
  Cuando el proveedor devuelve la plata, la merma de la v82 dejó de ser pérdida real — pero el POS
  **solo PROPONE** el monto. No toca un peso hasta que él aprieta "Aplicar al balance". Rechazarlo
  también se guarda.
- 🔒 `POST /api/devoluciones/seguimiento/:id/ajuste` es **el único punto de todo el módulo de
  devoluciones que modifica un gasto ya registrado**, y pide admin. El trabajador puede anotar el
  seguimiento pero no tocar el balance.
- 💵 **Al aplicarlo:** el gasto se rebaja a lo que de verdad se perdió (si queda en $0 se borra, para
  no ensuciar Gastos), la merma se rebaja igual y guarda "— recuperado $X el DD-MM (proveedor)".
  Nunca se propone más de lo que se había perdido.
- 📦 **El reemplazo SÍ sube el stock al marcarlo** — es un hecho físico y ese clic es su acción
  manual. Lo que no se mueve sin su visto bueno es el BALANCE. Guardar dos veces no duplica.
- 🔔 **Aviso 📮 en el header** con tres cosas: ajustes por aprobar (primero, y pulsa en magenta
  porque es lo único que mueve plata), plazos vencidos con sus días, y lo que lleva **más de una
  semana** sin decisión — una semana y no el mismo día, porque recién devuelto es normal no saber.
- 🧪 175 comprobaciones de backend + 151 de interfaz + navegador real. Detalle en
  `docs/CHANGELOG-V84.md`.
- ⏭️ **Anotado, no hecho:** el plazo se escribe a mano; `proveedores_plazos` (sql/60) podría
  sugerirlo, se dejó fuera para no adivinar antes de ver cómo lo usa.

**v83 (22-09-2026) — devoluciones Etapa 3: el panel de Finanzas.**

- ↩️ **Nueva sub-pestaña Finanzas → Devoluciones.** Responde tres preguntas que un solo total no
  contesta: cuánta plata se fue, cuánto se perdió DE VERDAD (las mermas de lo que volvió roto, a
  costo) y POR QUÉ está pasando (motivos y productos más devueltos). La última es la única que sirve
  para decidir: si un producto aparece arriba tres meses seguidos, el problema es el producto o el
  proveedor, no la devolución.
- 📉 **La tasa de devolución tenía una trampa, y la encontró un test:** una devolución parcial rebaja
  `ventas.total`, así que el denominador venía ya reducido y la tasa salía INFLADA justo cuando hay
  más devoluciones ($100.000 sobre $320.000 daba 45% en vez de 31%). El resumen ahora le devuelve a
  cada venta lo que se le rebajó, incluidas las devoluciones de otro período.
- 🧾 **`sql/62`: `nota_credito_emitida_en` + `nota_credito_folio`.** Sin esto la lista de Notas de
  Crédito pendientes no se vaciaba nunca y dejaba de servir. El folio es OPCIONAL a propósito:
  obligarlo haría que no marque nada por no ir a buscar el número. `solo_nota_credito=true` ahora
  significa **las que faltan**.
- ⚠️ **El POS sigue sin entrar al SII:** marcar la NC es anotar que él ya la emitió.
- 🧠 **El ajuste del débito del F29 (v81) NO depende de que la NC esté emitida.** Son dos cosas: el
  ajuste es de PERÍODOS (la reversa va en el mes de la NC), la lista de pendientes es de ACCIONES. El
  POS muestra lo que debería declarar; la lista dice qué falta para que la realidad calce.
- 🧪 122 comprobaciones de backend + 100 de interfaz + navegador real.
- ✅ **Con esto se cierra la propuesta de devoluciones (v81 + v82 + v83).** Detalle en
  `docs/CHANGELOG-V83.md`.

**v82 (22-09-2026) — devoluciones Etapa 2: la pérdida se registra sola.**

- 💸 **Se cerró el hueco de la v81:** la mercadería que NO vuelve al stock ahora genera **merma
  automática con su costo PEPS real** y su gasto. Antes la venta salía del balance (queda ANULADA)
  pero el costo no aparecía en ninguna parte: el mes se veía mejor de lo que fue.
- 🚫 **Tres casos donde a propósito NO se da de baja:** el stock no se vuelve a descontar (esas
  unidades nunca volvieron, ya estaban descontadas desde la venta); un repuesto usado en una OT no
  genera merma (su costo ya se cargó a la orden, sería doble gasto); un servicio tampoco (no hay
  nada físico). Una merma de $0 se registra pero no crea gasto.
- 🛡️ **Garantía preseleccionada:** `GET /api/ventas/:id` devuelve `vence_el` y `estado_garantia` por
  línea, calculados con la MISMA `calcularEstadoGarantia` del panel de Garantías. El modal muestra un
  chip por línea y arranca en motivo "Garantía" si queda algo vigente.
- 🔴 **Aviso nuevo en el header (`btnDevolucionesCaja`, NO admin-only):** devoluciones en efectivo que
  quedaron fuera de toda caja. Esa plata salió del cajón y el arqueo de ese turno va a dar de menos.
  El trabajador también lo ve, porque es su turno el que queda corto.
- ⚠️ **Solo las de HOY se arreglan de un clic.** Meter en la caja de hoy plata que salió hace tres
  días descuadraría los dos días en vez de uno; el servidor lo rechaza y lo explica.
- 🧪 89 comprobaciones de backend + 61 de interfaz + navegador real. Sin migración nueva: usa la
  columna `devolucion_items.merma_id` que `sql/61` ya había dejado lista.
- ⏭️ **Falta la Etapa 3:** panel de Devoluciones en Finanzas (el endpoint con filtro de Nota de
  Crédito ya existe).

**v81 (22-09-2026) — devoluciones: la venta ya no se borra, se anula.**

- 🔴 **El hallazgo que cambió el diseño:** hasta hoy la única forma de revertir una venta era
  **borrarla** (`DELETE /api/ventas/:id`). Y **60 de las 202 ventas tienen BOLETA declarada al SII**:
  borrar una de esas deja al POS diciendo algo distinto de lo ya declarado, y la diferencia reaparece
  en el F29 sin rastro. Una boleta no se borra: se reversa con Nota de Crédito.
- ✅ **Nuevo estado `ANULADA`** (`sql/61`). La venta se conserva siempre. Como los 8 lugares donde
  Finanzas lee ventas ya filtraban por `estado = 'PAGADA'`, la venta anulada sale de todos ellos sin
  tocar una línea de esos cálculos.
- 🧾 **El F29 es la única excepción, y está resuelta:** el débito de un mes ya declarado **no puede
  encoger hacia atrás**. El cálculo suma de vuelta las devoluciones *posteriores* al período. Por eso
  `devoluciones.monto` guarda SIEMPRE el valor de lo devuelto, aunque no haya salido plata del cajón.
- ↩️ **Devolución parcial:** la venta sigue PAGADA y se le rebajan total, costo y utilidad. El
  descuento de la venta se reparte a prorrata. **`comision_pos` NO se rebaja a propósito:** la
  pasarela no reintegra su comisión, y borrarla inflaría la utilidad del mes.
- 📦 **PEPS al revés** (`devolverLotesDeLinea`): devuelve cantidades parciales de UNA línea,
  recorriendo su consumo en orden inverso. `devolverConsumoLotes` no servía: trabaja por venta
  completa y borra el libro entero.
- 💵 **El egreso de caja se crea solo** si la devolución es en efectivo y hay caja abierta. Si no hay
  caja, la devolución se registra igual y avisa — nunca falla por eso.
- 🔒 **Borrar quedó restringido** a su único caso legítimo: venta de HOY y SIN documento. El resto
  responde 409 y manda a "Devolver / Anular".
- 👤 **El trabajador también puede devolver** (decisión del dueño): es operación de mostrador, no
  edición del historial. Sin PIN. Sigue sin ver costos ni utilidad.
- ⚠️ **Pendiente de la Etapa 2:** la mercadería que NO vuelve al stock queda registrada pero
  **todavía no genera merma ni gasto**. La columna `devolucion_items.merma_id` ya está esperando.
- 🧪 58 comprobaciones de backend + 45 de interfaz (jsdom) + navegador real, escritorio y móvil.
  Detalle en `docs/CHANGELOG-V81.md`.

**v80 (22-09-2026) — SEO cargado a mano en 31 fichas, y el bug del texto "null".**

- 🔴 **BUG ENCONTRADO Y REPARADO, con riesgo real de perder datos:** 26 productos tenían el campo
  `descripcion` con la palabra **"null" escrita como texto** (no vacío). El editor carga
  `producto.descripcion || producto.descripcion_web`, y para JavaScript la cadena `"null"` es un valor
  válido: cargaba "null" y **tapaba la descripción buena**. Como al guardar se escriben LOS DOS
  campos con lo del editor, **abrir uno de esos productos y apretar Guardar borraba la descripción
  real de sevelin.cl**. 25 de los 26 tenían la descripción buena a salvo en `descripcion_web`; se
  restauró desde ahí. El 26º (id 175, Kit de Limpieza para Zapatillas) no tenía ninguna: quedó en
  NULL de verdad.
- 🛡️ **Blindaje en el servidor** (`sanearProducto`): el texto "null"/"undefined"/vacío en
  `descripcion`, `descripcion_web`, `meta_titulo_web` y `meta_descripcion_web` se normaliza a NULL de
  verdad. Va en el servidor y no en el navegador porque protege todos los caminos: el editor, la
  importación masiva y cualquier llamada futura. Una descripción que solo *menciona* la palabra
  ("devuelve null si el disco no responde") NO se toca.
- 🔍 **SEO cargado a mano en 31 fichas publicadas**, porque el botón sigue sin poder generarlo:
  verificado en vivo que los tres modelos de Gemini seguían caídos (dos TimeoutError y un 503).
  Escrito **solo desde la descripción que ya había redactado el dueño**, sin inventar ninguna spec.
  Todos dentro de los límites (título ≤60, meta ≤155), sin emojis ni markdown, sin repetir "Sevelin".
- 🚫 **Los 21 restantes quedaron a propósito sin SEO**: 20 no tienen ninguna descripción escrita y
  1 es el del "null". Sin descripción propia, el SEO solo se podría inventar.
- 🌐 Ya está vivo: el webhook de la base sincronizó las 31 fichas a `productos_web` solo, y la tienda
  usa `meta_titulo_web`/`meta_descripcion_web` en el `<title>` y la descripción que ve Google.

**v79 (22-09-2026) — copiar el prompt en vez de esperar a la API.**

- 💡 **Idea del dueño, y es la correcta para este caso:** "¿y si en vez de usar APIs, que sea un botón
  para copiar el prompt y dárselo a Gemini en una pestaña abierta?". Ahora la tarjeta de Descripción
  muestra **dos caminos rotulados** para lo mismo: *Automático (a veces lento)* con los dos botones de
  siempre, y *A mano (siempre funciona, más rápido)* con **📋 Copiar prompt de la ficha**, **📋 Copiar
  prompt de Facebook** y **📥 Pegar la ficha que te dio la IA**.
- ⚡ **Por qué el camino a mano es mejor, y no por comodidad:** la web de Gemini/ChatGPT/Claude no
  comparte cola con el nivel gratis de la API — responde en segundos y nunca devuelve "high demand".
  El dueño **ya** pegaba la información real y **ya** leía la ficha antes de aceptarla, así que la API
  solo le ahorraba cambiar de pestaña, y a cambio le costaba 35-70 s y fallar seguido.
- 🔒 **El prompt lo sigue armando el SERVIDOR** (son regla de negocio: qué se puede decir de un
  producto y qué no). El botón lo pide armado, no tiene su propia copia. La prueba compara los dos
  caminos **carácter por carácter**: si algún día divergen, falla.
- ✅ **Misma validación en los dos caminos:** sin información real, tampoco entrega el prompt —
  copiarlo sin datos hace que la IA invente exactamente igual que pedirlo por API.
- 🔁 **La vuelta usa la MISMA previsualización**: "📥 Pegar la ficha" abre el modal de siempre, y al
  pegar se separa el título igual que lo hace el servidor con la respuesta de la API
  (`separarTituloDeFicha()`, ahora compartida por los dos caminos). Revisar y aceptar es idéntico.
- 🧹 De paso, el handler de `/generar-texto` quedó en 3 líneas: el armado del prompt y el corte del
  título salieron a `armarPromptTexto()` y `separarTituloDeFicha()`, que usan los dos caminos.
- 💵 **Sobre la API de Claude, que el dueño preguntó:** costaría ~US$0,003 por ficha con Haiku 4.5
  (~300 pesos al mes con 100 fichas) y sería rápida y confiable, pero pide tarjeta y otro proveedor.
  Queda como opción abierta; el camino a mano no cuesta nada y ya funciona.
- Los botones automáticos **siguen estando**: el día que Google no está saturado, un clic sigue siendo
  más cómodo. No se quitó nada.

**v78 (22-09-2026, hotfix ~15 min después de v77) — presupuesto TOTAL para los
reintentos de Gemini, no por modelo.**

- 🔴 **BUG EN PRODUCCIÓN introducido por la propia v77, encontrado en los logs de Vercel:** al agregar
  el tercer modelo de respaldo, no se recalculó el peor caso COMBINADO. `/api/productos/generar-texto`
  (los botones "Generar ficha" y "Generar publicación para Facebook") usa `topeMsExtra=12000`, así que
  el peor caso real quedó en **22 s + 24 s + 24 s = 70 s** — por encima del `maxDuration: 60` de
  `vercel.json`. Vercel mata la función a los 60 s con un **"Vercel Runtime Timeout Error" crudo**, que
  nunca pasa por `responderFalloGemini()`: en vez del mensaje "Google está saturado", al dueño le llegó
  un error genérico. Confirmado en los logs reales: dos intentos suyos a las 12:54 murieron así.
- 🕵️ **Encontrado con los logs de Vercel, no adivinando:** `npx vercel logs <deployment> --since` dejó
  ver el mensaje exacto de cada intento fallido y el timestamp — así se pudo confirmar que el primer
  reporte del dueño (12:45) fue contra la v76 vieja (2 modelos, mismo problema de fondo: Google
  saturado) y que el error crudo (12:54) fue ya con la v77 nueva, con el presupuesto mal calculado.
- ✅ **`pedirAGemini()` ahora reparte un presupuesto TOTAL de 50 s** (`PRESUPUESTO_TOTAL_GEMINI_MS`),
  no un tope fijo por modelo: cada intento recibe como máximo el tiempo que queda del presupuesto, y si
  a un modelo le quedan menos de 3 s, se omite en vez de arrancar un fetch que Vercel va a cortar de
  todos modos. 50 s deja ~10 s de margen bajo los 60 s de Vercel para el resto de la función.
- 🧮 Con `topeMsExtra=12000` (ficha/Facebook): el 1º y 2º modelo siguen usando su tope completo (22 s,
  24 s — suman 46 s), pero el 3º queda con los ~4 s reales que sobran, no los 24 s completos. Con
  `topeMsExtra=0` (SEO): los tres caben enteros (34 s), sin ningún recorte — no cambia nada ahí.
- Probado con un reloj simulado (`Date.now()` avanza lo que tardaría cada modelo, sin esperar los 50 s
  reales): 8 comprobaciones, incluida la aritmética exacta del recorte y que el caso sin recorte (SEO)
  sigue igual que antes.

**v77 (22-09-2026) — un tercer modelo de respaldo para los botones de IA.**

- 🐛 **Reportado por el dueño:** "Generar ficha" y "Generar publicación para Facebook" devolvían
  "Google está saturado en este momento y no respondió". Verificado en vivo contra la API real de
  Gemini (no era un bug del código): un día de saturación general, **los dos modelos de siempre**
  (`gemini-flash-latest` y `gemini-flash-lite-latest`) respondieron 503 "high demand" — Google entero
  con las colas llenas, no algo que este backend pudiera arreglar directamente.
- 🆕 **Tercer modelo de respaldo: `gemini-3-flash-preview`.** Probado 3 de 3 veces en vivo (2-3 s cada
  una) mientras los otros dos seguían saturados: casi nadie lo usa todavía, así que tiene cola vacía
  cuando el resto no da abasto. Se agrega al final de la cadena (`MODELOS_GEMINI` en `api/index.js`),
  después de los dos alias de siempre — esos siguen siendo la primera opción porque responden bien
  fuera de los picos de demanda.
- ⚠️ **Es un nombre fijo, no un alias** (raro en un "preview" de Google): puede dejar de existir sin
  aviso cuando salga la versión estable de la familia Gemini 3. Si este paso empieza a fallar con 404,
  toca revisar qué reemplazo hay publicado en la documentación de modelos de Gemini.
- ⏱️ Peor caso (los tres modelos saturados a la vez) sube de ~22 s a ~34 s antes de mostrar el aviso
  — el botón ya se deshabilita y dice "Generando…" mientras espera, así que no cambia la experiencia,
  solo la probabilidad de que el botón funcione a la primera durante un pico.
- Sin migración ni cambio de contrato: afecta solo el orden de reintento interno que ya usan los tres
  botones de IA (SEO, ficha web y Facebook), todos por la misma función `pedirAGemini()`.

**v76 (22-09-2026) — el peso viene en gramos por defecto.**

- ⚖️ **El selector kg/g del editor de producto ahora preselecciona gramos** en vez de kg. Aplica a un
  producto nuevo y a cualquiera que todavía no tenga peso cargado (0 kg) — la unidad en la que piensa
  la mayoría de lo que se vende acá, para no tener que cambiar el selector a mano cada vez.
- 🧮 **Lo que YA pesa 1 kg o más sigue mostrándose en kg**, sin cambios: un PC Gamer de 9 kg se sigue
  viendo "9", no "9000". Solo cambió el punto de partida cuando el peso está vacío; la conversión
  automática entre unidades (0,045 kg ↔ 45 g) sigue igual que en v66.
- El selector sigue totalmente editable: cambiar a kg a mano sigue disponible en cualquier momento.
- Sin migración ni endpoint nuevo — solo el valor por defecto de `ponerPesoEnFormulario()`
  (`js/productos.js`) y el atributo `selected` del `<option>` en `index.html`.

**v75 (21-09-2026) — dónde está guardado cada producto, aviso de mercadería en camino, y las
cuatro automatizaciones (A, B, C, D).** Migración `sql/60` aplicada y verificada en producción.

- 📍 **"Dónde está guardado"**, tarjeta nueva en el editor: el estante, la caja o el cajón donde lo
  dejaste, con **detalle por producto** ("adentro de la caja azul, junto a las pastas térmicas"),
  cuál es el lugar donde se busca primero (⭐) y **foto del lugar**.
- 🗃️ **Dos tablas y no un campo de texto** (`ubicaciones` + `producto_ubicaciones`), por lo que el
  dueño describió: una caja guarda VARIOS productos (con un texto suelto nunca se podría preguntar
  "¿qué hay en la Caja 3?", que es lo que uno hace cuando busca algo) y un producto puede estar en
  VARIOS lugares (los sueltos en un estante, una caja cerrada en otro).
- 📷 **La foto es del LUGAR, no del producto**: sirve para todo lo que esté guardado ahí. Se comprime
  en el navegador a 1200 px / ~160 KB webp antes de subirla — la foto sale del teléfono y pesa 3-4 MB.
  El nombre del lugar es único ignorando mayúsculas: "Caja 3" y "caja 3" son el mismo lugar.
- 🔄 **Al registrar una compra se propone el lugar de siempre**: "La última vez lo guardaste en
  Caja 3". Se muestra, no se aplica solo: el stock nuevo puede ir a otra parte.
- 📦 **Botón nuevo en el header con la mercadería en camino.** Ámbar mientras solo viaja; **rojo con
  pulso cuando la fecha estimada ya pasó**, que es lo que hay que confirmar o corregir. Cada compra
  se puede confirmar con "📦 Ya llegó" **sin entrar al producto**. Una compra **sin** fecha estimada
  no está atrasada: no se sabe, que es distinto.
- 🔧 **(A) "Es un servicio" enciende solo el stock ilimitado.** Antes había que marcar las dos y un
  servicio al que se le olvidaba la segunda se quedaba sin stock. Desmarcarlo no apaga la otra.
- 📚 **(B) Con PEPS activo, el "Costo Unit." queda de solo lectura** y muestra el costo real que
  calculan las capas — **promedio ponderado por unidades vivas**, no promedio simple: 10 a $2.000 y
  1 a $9.000 son $2.636, no $5.500.
- 💡 **(C) Precio sugerido al registrar una compra**, con el margen que ya usa ese producto o la
  **mediana** de su categoría (mediana y no promedio: un margen extremo no arrastra al resto). Es un
  botón: nada cambia solo. Si el precio actual ya respeta el margen, no molesta.
- 📅 **(D) Plazo de devolución por proveedor.** Guardado una vez, la fecha se calcula sola desde la
  fecha de compra. Con un proveedor nuevo, ofrece recordar el plazo para la próxima.
- `sql/60`: `ubicaciones`, `producto_ubicaciones` y `proveedores_plazos`, las tres con RLS y sin
  políticas públicas (verificado con `pg_policies`: 0 políticas).

**v74 (21-09-2026) — el falso "sin categoría", y "por llegar" pasa a ser una compra en camino.**
Migración `sql/59` aplicada y verificada en producción.

- 🐛 **BUG del aviso, reportado por el dueño:** un producto CON categoría salía como "Publicado sin
  categoría". Era una carrera: el desplegable de categorías se llena con **dos llamadas encadenadas**
  a la API y el chequeo corría 120 ms después de abrir, cuando todavía estaba vacío. Ahora se lee
  también `#prodCategoriaWeb` (el estado real que ya usaba `guardarProducto`) y el aviso se recalcula
  cuando las categorías terminan de cargar y cuando él elige una. Lo de "sin peso ni medidas" del
  mismo producto **sí era correcto**: los cuatro campos estaban en 0 con 7 unidades en stock.
- 📦 **"Por llegar" se fusionó con las compras.** Eran tres campos sueltos en la tarjeta de Tienda web
  (casilla + unidades + fecha) que había que acordarse de llenar y después de vaciar. Es lo mismo que
  una compra que todavía no tienes, así que vive dentro de **Compras de este producto**.
- 🚚 **Al marcar "todavía no llega"**, la compra **no suma stock** (lo que no tienes no puede sumar) y
  **no crea capa PEPS** — una capa con unidades que viajan haría que una venta tomara el costo de algo
  que no está. El producto queda "por llegar" en sevelin.cl, reservable con tope.
- ✅ **Botón "📦 Ya llegó"** en cada compra en camino: ahí recién sube el stock, se crea la capa PEPS y
  el producto deja de estar "por llegar" — que es lo que **dispara el correo** a quienes lo
  reservaron. Por eso no pasa solo al cumplirse la fecha estimada: una fecha no es una caja sobre el
  mostrador. Y si quedan OTRAS compras en camino del mismo producto, `por_llegar` **no se apaga**.
- 🧪 El bug que atrapó la prueba: la capa PEPS se creaba **dos veces** (al comprar y al recibir).
- `sql/59`: `ingresos_mercaderia.en_camino` + `recibido_en`, con índice parcial. No duplica el estado
  del producto — `productos.por_llegar` sigue siendo el que manda en la tienda.

**v73 (21-09-2026) — el editor de producto: una sola compra, secciones plegables y avisos de lo que
falta.**

- 🔗 **"Costos por lote" y "Compras de este producto" eran la misma cosa dos veces.** Las dos pedían
  "compré N unidades a $X", pero hacían cosas distintas: cargar un lote subía el stock y creaba la
  capa PEPS; registrar una compra solo dejaba el historial. Ahora hay **un formulario**
  (`POST /api/productos/:id/compras`) que hace las tres cosas: historial con plazo de devolución,
  stock, y capa PEPS **solo si el producto la usa**. El interruptor de PEPS quedó dentro de esa misma
  tarjeta, al final y apagado como siempre.
- 🧮 **Si el producto no tenía costo, la compra se lo carga.** Es justo el origen de las dos ventas
  con utilidad inflada que encontró la auditoría. **No pisa un costo ya cargado**: reescribirlo con
  el de la última compra cambiaría el margen de todo el catálogo sin que nadie lo pida.
- 🗂️ **Las 9 tarjetas del editor se pliegan** (clic en la cabecera, o "Abrir todo" / "Plegar todo").
  Al abrir un producto queda **abierto lo que necesita atención y plegado lo que está bien**. Se
  pliega ocultando los hijos y no con `<details>`: así el único cambio en el HTML es una clase.
- ⚠️ **Arriba del editor, qué le falta a ESE producto**, y cada línea dice **qué cuesta** que falte
  ("Cada venta se anota con utilidad del 100%"), no solo que falta. Un clic abre su sección y pone
  el foco en el campo. Cada tarjeta lleva además su chapita: ✔️, "falta algo" o "⚠️ falta algo".
- 📋 **Botón nuevo en el header con los productos incompletos del catálogo**, con filtros por tipo de
  falta y "✏️ Completar ahora" que abre ese producto. Ámbar normalmente; **rojo con pulso solo si hay
  algo crítico** (sin costo con stock, sin precio, o publicado sin ninguna foto).
- 🎯 **Las reglas viven SOLO en el servidor** (`REGLAS_PRODUCTO` en `api/index.js`, expuestas por
  `GET /api/productos/reglas`). El editor pide ese mismo catálogo y lo evalúa sobre el formulario
  abierto: escritas en los dos lados, el día que cambie una dirían cosas distintas.
- 🚫 **Lo que es una decisión legítima NO es un aviso:** un genérico sin marca, un servicio sin peso,
  un "precio a consultar" sin precio o un producto sin SKU (el slug lo genera la tienda) no aparecen.
  Los archivados y los borradores tampoco. Medido hoy contra producción: **20 publicados sin
  descripción, 19 sin categoría, 3 sin foto y 49 con stock sin medidas**; ninguno sin costo ni sin
  precio, que es lo crítico.
- 🖥️ Verificado en un navegador real (`preview_start` → `pos-estatico` en `.claude/launch.json`):
  los 36 scripts cargan, el plegado se ve bien y la chapita queda en línea con el título.
- Sin migración: no hace falta ninguna tabla nueva.

**v72 (21-09-2026) — auditoría de la contabilidad del POS: tres arreglos y el código 77 automático.**

- 🔴 **BUG EN PRODUCCIÓN, encontrado y corregido:** el checklist de **Gastos Fijos del mes** armaba la
  fecha de cierre como `AAAA-MM-31` a mano. Postgres **rechaza** `2026-09-31` (error 22008), así que
  la consulta no devolvía nada y **todos los gastos fijos aparecían como NO pagados** — y el
  resguardo dinámico guardaba plata para cuentas ya pagadas. Rompía en **abril, junio, septiembre,
  noviembre y febrero**; estaba roto ese mismo día. Ahora usa `ultimoDiaDelMes()`.
- 🔴 **El mismo `-31`** estaba en el semáforo de IVA (`calcularIvaMes`), en la rama que estima el
  débito con las boletas del POS cuando el SII todavía no tiene las ventas del mes. Corregido igual.
- 🕐 **Zona horaria al LEER los gastos.** `compras.fecha` y `mermas.creado_en` son TIMESTAMPTZ y la
  base corre en UTC; se filtraban con textos sueltos (`'2026-09-30T23:59:59'`) que Postgres lee como
  UTC, o sea las 20:59 de Chile. Un gasto anotado a las 22:00 caía en el día siguiente — y el último
  día del mes, en el **mes** siguiente. **Medido en producción: 3 de 17 gastos estaban en el día
  equivocado.** La escritura ya estaba bien (`fechaHoraDeGasto`); el error era solo al leer. Nuevas
  `inicioDiaChile()` / `finDiaChile()` sobre `marcaDeTiempoChile`, que calcula el desfase **del día**
  (Chile cambia entre UTC-3 y UTC-4). La prueba lo comprueba con septiembre, que dura **719 h**.
- 🧮 **El código 77 ya no hay que copiarlo:** sale de restar 537 − 538. Si se copian esos dos códigos,
  el campo se llena solo y explica la resta. Sigue editable, y **desde que se escribe a mano el POS
  no lo vuelve a pisar**. Se propone y no se impone porque el 77 también se carga desde la
  *propuesta*, antes de que existan el 537 y el 538.

**Lo que la auditoría revisó y encontró BIEN:**
- Las **202 ventas** cuadran al peso: `total`, `costo_total` y `utilidad` reconcilian exactamente
  contra sus `venta_items` (0 descuadres).
- El IVA se extrae siempre hacia atrás (`total / 1,19`), nunca `total × 0,19`. Un solo helper
  (`ivaContenidoEn`) y una sola función de período para las dos vistas, que por diseño no pueden
  discrepar.
- La mercadería (grupo INVENTARIO) queda fuera de la utilidad neta porque ya se descuenta como costo
  FIFO al vender: no hay doble conteo.
- El certificado del SII: se lee con node-forge (los .pfx chilenos usan cifrado que OpenSSL 3
  rechaza), vive solo en variables de Vercel, nunca se escribe en la base ni en un log, y el robot
  **solo lee**. Las notas de crédito (60/61) restan, como en el F29.

**Dato de negocio, no de código:** 2 ventas quedaron con utilidad inflada porque el producto no tenía
costo cargado al venderse — orden **#32** (Power Bank Master-G, costo real $14.510) y **#186** (Barra
de Sonido Master-G, $13.104). Suman **$27.614** de costo no registrado. Corregir el costo del
producto **no** reescribe la venta ya cerrada.

**Riesgo anotado, sin tocar:** las consultas de finanzas no llevan `.limit()` y PostgREST corta en
1.000 filas por defecto. Con 202 ventas no molesta; a ~135 ventas/mes, un informe anual empieza a
truncar en unos 7 meses.

**v71 (21-09-2026) — el F29 guarda sus códigos y el POS lleva el historial del
remanente.** Migración `sql/58` aplicada y verificada en producción.

- 🧾 **El modal del botón 🧾 ahora guarda los códigos del Formulario Compacto** del SII (563, 538,
  537, 089, 062, 504, 110, 519) más el folio y la fecha real de presentación. Van en un bloque
  **plegado**: marcar un F29 sigue siendo de dos clics para quien no los quiera copiar.
- 📄 **Cuál de los dos PDF del SII sirve:** el **Formulario Compacto** (trae los ~20 códigos). El
  *Certificado Solemne* solo trae 5 y es el comprobante de que se presentó. El modal lo dice.
- 📊 **"Ver historial del F29 mes a mes"** en Finanzas → Utilidades, dentro de la tarjeta del IVA:
  venta declarada, débito, crédito, IVA pagado, remanente y folio por período. Con **dos meses o más**
  estima a qué ritmo se consume el remanente y cuántos meses alcanza — y **dice que es una
  estimación**, porque con dos puntos no hay tendencia.
- 🧮 **Chequeo de cuadratura que avisa pero NO bloquea**, en el navegador y otra vez en el servidor:
  si el 538 no es el 19% del 563, o el 089 no es débito − crédito, se avisa y **se guarda igual**. El
  F29 se anota como el SII lo recibió; quien decide es el dueño.
- 🕳️ **Vacío queda NULL, no 0** (misma regla que `envios.cobrado_cliente`): un débito en 0 diría "no
  vendí ese mes" e inventaría un dato. Los períodos marcados antes de hoy quedan sin códigos.
- 🔒 El código 77 **no se duplicó**: sigue en `iva_remanentes` (sql/51), porque se conoce desde la
  propuesta. La vista `v_f29_historial` los junta y calcula la variación al leer.
- ⚠️ **Una vista NO hereda la RLS de su tabla.** `revoke all ... from anon, authenticated` en la
  migración; verificado en producción con `has_table_privilege` (anon false, service_role true).
- 🤖 **Para qué sirve de verdad:** el cowork "Sevelin Finanzas" ya lee esta base. Con el historial
  cargado puede responder solo cómo viene el remanente, sin que nadie le pase un PDF cada mes.

**Versión anterior: v70 — despachos por entregar, despacho en el detalle de venta, y
PIN para editar una venta.**

- 🚚 **Aviso "por entregar" en el header.** "A veces me olvido que dejé un pedido en pendiente, y al
  llegar no le pongo entregado ya que requiere que entre a historial de ventas" (dueño). Ahora hay
  botón con los despachos sin entregar y **"✅ Entregado" de un clic** en cada uno. Muestra hace
  cuántos días espera cada pedido, y **se pone rojo con pulso a los 2 días**. Se consulta cada 5
  minutos, no cada 30 como el F29: un pedido se entrega dentro del día.
- 👷 **NO es admin-only y NO pide PIN**, a propósito: entregar lo hace quien atiende, con el cliente
  delante. Por eso el endpoint tampoco devuelve costo ni utilidad (verificado en la prueba, con el
  doble respetando ahora las columnas del `select`).
- 📦 **El detalle de venta muestra el despacho completo:** dirección, notas, quién lo llevó, costo
  real, cobrado al cliente, sector, km y duración — más el aviso de **"este envío lo pusiste tú"**
  cuando cobraste menos de lo que pagaste. Antes nada de eso se veía: vive en la tabla `envios`.
- 🔒 **Editar una venta exige PIN de administrador** (pedido del dueño). Cambia total, costo y
  utilidad de algo ya cerrado, y con eso el resultado del día. Editar la **dirección o el costo del
  despacho** también lo pide; cambiar el **estado de envío**, no.
- 💸 **Se puede cargar el costo de un envío DESPUÉS de la venta** (estaba pendiente desde v63): si la
  venta no tenía fila en `envios`, el editor la crea.
- ⚠️ **Lo que NO hace, y lo dice en pantalla:** corregir el costo del viaje **no reescribe** el gasto
  ya asentado en Gastos ni el egreso del turno de caja. Eso se corrige en Gastos, donde queda rastro.
- Sin migración: usa `ventas.estado_envio` y las tablas `envios` de sql/50 y 54.

**Versión anterior: v69 — botón "📷 Para Instagram"** en las fotos del producto.
Baja las fotos en **JPG de 1080×1350 (4:5 exacto)** con la imagen completa centrada sobre blanco.

- 🐛 **Los dos problemas que arregla, reportados por el dueño:** Instagram **no acepta webp** (el
  formato en que se guardan), y una foto **1:1 en un feed 4:5 sale recortada** por los lados.
- 🚫 **NO se cambió cómo se guardan las fotos**, a propósito: el catálogo sigue en 1000×1000 webp.
  Guardarlas en 4:5 cambiaría la proporción de todas las imágenes de sevelin.cl (grillas, ficha de
  producto, feed de Google Merchant) para arreglar algo que es de la **descarga**.
- 📐 **"contain", nunca "cover":** la foto entra entera y se rellena arriba y abajo. **No se pierde
  un pixel.** Verificado en un navegador real con marcas en las 4 esquinas: las cuatro sobreviven.
- ⚪ **El relleno es blanco**, elegido por el dueño sabiendo que en sus diseños con fondo de color
  (los flyers hechos con IA) van a quedar dos franjas blancas. En una foto de producto sobre blanco
  es invisible. Cambiarlo a "color del borde" es un cambio chico si algún día molesta.
- ⚠️ **Trampa del canvas resuelta:** las fotos viven en el bucket de Supabase, otro dominio. Dibujar
  una `<img>` de ahí **contamina el canvas** y `toBlob()` lanza SecurityError. Por eso se baja con
  `fetch()` primero y se dibuja desde un blob LOCAL. Probado contra una foto real del bucket.
- "⬇️ Descargar todas" se queda igual (webp 1:1) — sirve de respaldo y para la tienda.

**Versión anterior: v68 — panel "Cotizaciones"** (Página Web). Lo que los clientes
se cotizaron solos en sevelin.cl: quién, cuánto, si sigue vigente y cuánta plata hay en cotizaciones
vigentes sin revisar. Solo lectura + marcar como revisada — un documento emitido no se edita desde
acá. El cotizador en sí vive en `sevelin-tienda` (`supabase/35`), ver su `docs/SNAPSHOT.md`.

- 🔒 Lee `dbWeb` (Supabase de la TIENDA), nunca `db`. La prueba lo verifica a propósito con una
  tabla del mismo nombre y datos distintos en la base del POS: si el endpoint leyera de la
  equivocada, la prueba lo delata.
- 🧾 La vigencia se calcula al leer, nunca se guarda: una cotización vence sola con el paso del
  tiempo, y un campo "vigente" guardado quedaría mintiendo al día siguiente.
- 🛡️ Mandar montos en el body NO cambia el documento emitido (probado). Solo administrador.
- 🎨 **La tienda cambió de diseño el mismo día**: negro plano + un solo acento azul, sin la capa
  cyberpunk. Nada de eso toca al POS, pero conviene saberlo antes de mirar sevelin.cl y creer que
  algo se rompió.

**Versión anterior: v67** — el POS ahora **detecta solo cuándo repusiste**. Al subir
el stock de un producto arma un borrador de compra (fecha, cuántas entraron, el costo cargado) y lo
deja en el botón 📥 del header esperando aprobación. El dueño confirma el costo y pone el plazo de
devolución — el único dato que el POS no puede saber y que **nunca se inventa**. Detalle en
`docs/CHANGELOG-V67.md`. Migración `sql/57` ya aplicada.

- 🎯 **Por qué:** el informe de v66 solo veía lo cargado a mano, y un informe incompleto es PEOR que
  ninguno — habla con seguridad de las 3 compras cargadas e ignora las otras 37. Mismo error que el
  margen inflado por ítems sin costo (07/08-09-2026).
- 🚫 **Un borrador NO cuenta en el informe** hasta confirmarlo: sin costo revisado ni plazo, contarlo
  sería analizar con datos supuestos.
- ✅ **Dispara en tres caminos:** subir el stock al editar (`reposicion`), crear el producto con stock
  (`alta`) y cargar una capa PEPS (`lote`). **NO dispara** al anular una venta, al corregir sus
  líneas, en la importación por CSV ni en productos de stock ilimitado — todas decisiones explícitas.
- 💡 **"No fue una compra"** existe para el stock que sube por un ajuste: sin esa salida, la única
  forma de sacarse el aviso sería inventar un costo.
- 📱 **El aviso se queda dentro del POS** (decisión del dueño): mandar correo obligaría a tocar
  `sevelin-tienda`, que es el repo que manda los correos.
- ⏭️ **Propuesto y sin construir:** alarma de plazo por vencer (cron diario + botón como el del F29) y
  la revisión semanal con IA (Gemini en el informe semanal, o un cowork "Sevelin Inventario").
  Conviene esperar a tener 10-15 compras confirmadas antes de la parte de IA.

**Versión anterior: v66** — cinco pedidos del
dueño en una tanda: el envío que salió de su bolsillo + duración del viaje, ver la foto del producto
en grande desde el POS, peso con unidad kg/g y lectura en vivo, cola de agotados que pregunta antes
de mover nada, y compras de mercadería con fecha de devolución + informe de rotación. Detalle en
`docs/CHANGELOG-V66.md`.

- 🚚 **Envío de tu bolsillo (`sql/54`):** campo "Le cobré al cliente" + "Demoró (min)". El aviso en
  vivo dice "lo pusiste tú: $500" y cuánto lleva del mes. **La diferencia NO se anota como merma:**
  el costo completo ya está en `compras` desde v63, y anotarla otra vez la contaría dos veces.
  Vacío se guarda `NULL`, nunca 0 (un 0 diría "envío regalado" e inventaría una pérdida).
- 🔍 **Visor de foto compartido** (`abrirVisorImagen` en `js/config.js`): se arma y se destruye en el
  momento, así no agrega ids fijos a `index.html`. Se usa en el POS (artículo y carrito), en los
  agotados y en el informe de rotación.
- ⚖️ **Peso con unidad kg/g:** evita el error de escribir 45 pensando en gramos y guardar 45 KILOS.
  Cambiar de unidad **reinterpreta**, no convierte. La base sigue guardando `peso_kg` en kilos.
- 📦 **Agotados (`sql/55`, tabla `agotados_decisiones` + RLS):** botón en el header, cuatro salidas
  (por llegar / encargo / archivar / dejarlo). **Nada se mueve solo** — regla explícita del dueño. Si
  el producto vuelve a tener stock, la decisión se borra y vuelve a preguntar la próxima vez.
- 📥 **Compras de mercadería (`sql/56`, tabla `ingresos_mercaderia` + RLS):** fecha de compra,
  cantidad, costo y **hasta cuándo el proveedor las recibe de vuelta**. Informe en Finanzas →
  Inteligencia → "Compras y devoluciones": ritmo, plata atrapada y cuántas conviene devolver antes de
  que venza el plazo. **Tabla aparte de `producto_lotes` a propósito:** los lotes PEPS cambian de
  dónde sale el costo de cada venta, y anotar una fecha de compra no puede tener ese efecto.
- ✅ `sql/54`, `sql/55` y `sql/56` aplicadas y verificadas en producción el 16-09-2026 (las dos tablas
  nuevas con RLS activado).

**Versión anterior: v65** — 13 fichas que mostraban el Markdown crudo (`###`, `**`) al
cliente en sevelin.cl, arregladas y verificadas en vivo; y dos botones nuevos en el modal de producto
para generar con IA la ficha de la tienda y la publicación de Facebook. Detalle en
`docs/CHANGELOG-V65.md`. Migración de datos `sql/53` ya aplicada.

- 🐛 **La causa NO era el checkbox de Markdown** (ese conversor funciona). Las 13 descripciones
  estaban guardadas envueltas en un solo `<p>`, y la tienda no formatea nada que "ya traiga HTML".
  El arreglo quitó solo ese `<p>`, sin cambiar una palabra del texto. 10 de las 13 eran **servicios
  técnicos** — justo la línea de 100% de margen.
- 🤖 **Botones "🛒 Generar ficha para la tienda" y "📣 Generar publicación para Facebook".** Los tres
  prompts oficiales viven ahora en el servidor. Exigen información real: el endpoint devuelve 400 si
  no hay ni specs pegadas ni Descripción escrita, porque un modelo con solo el nombre del producto
  inventa características. Nada se guarda ni se publica solo.
- ✅ **Los dos botones YA se probaron contra Gemini de verdad** (llave real, datos reales del Cable
  de Fibra Óptica): devuelve la ficha completa con sus 12 viñetas. Lo que fallaba era el editor, no
  la IA — ver el bug de Quill más abajo.
- 🖼️ **`sevelin-tienda`, dos arreglos en la ficha de producto** (commits `a21f59a` y `06c777c`):
  la foto ahora **crece con la pantalla** (antes quedaba clavada en 524px en cualquier monitor,
  porque el tope lo ponía el ancho de la columna y no el alto), y "Envíos/Atención y garantía" sube
  junto a la foto en pantallas de 940px o más para llenar el hueco que quedaba al hacer scroll
  (era de 280 a 460px, y crecía mientras más grande el monitor). Además, **el visor ampliado quedaba
  tapado por el header**: el `sticky z-10` del nuevo contenedor creaba una burbuja de apilado que
  dejaba el `z-70` del visor compitiendo solo contra sus hermanos. Se sacó con `createPortal` a
  `<body>`. **Ojo: el portal envuelve el `<AnimatePresence>` entero, no el `<div>` de adentro** —
  framer-motion v13 no puede clonar un Portal y fallaba en silencio (el estado cambiaba pero no se
  montaba nada en el DOM, sin ningún error en consola).
- 🧾 **Cowork "Sevelin Finanzas" probado y verificado:** respondió $274.204 de crédito de IVA y cuadra
  al peso contra `sii_rcv_resumen` + `iva_remanentes`. Lo que le faltó decir: que el mes no ha
  terminado, que el PPM se paga igual aunque el IVA dé cero, y que el RCV solo ve la venta con
  documento (en septiembre, 66% de la venta es SIN DTE).

**Sesión anterior — 13-09-2026, sin versión nueva del POS** — costo de un encargo cargado, un bug de
categoría corregido en `sevelin-tienda`, la ficha de producto de la tienda reordenada varias veces a
pedido del dueño (terminó: foto + botón fijos al hacer scroll, aviso de stock baja normal, visor
ampliado con carrusel al hacer clic en la foto), y un badge de contraste corregido en el POS.

- 💰 **Costo del PC Gamer cargado** (encargo #2, Nicolás Reyes): `$315.000` (el dueño lo confirmó
  distinto al estimado de $400.000 de la sesión anterior). Con la venta en $400.000, la utilidad de
  ese encargo queda en $85.000 en vez de salir inflada.
- 🐛 **"Periféricos" duplicado en la tienda, corregido:** un producto (`Mouse RGB - 307812 Cinco
  Tech`) tenía la categoría guardada con codificación rota (`Perif�ricos`) en `productos_web` — eso
  generaba un segundo filtro fantasma en `/productos`. Corregido con un `UPDATE` de una fila. Se creó
  además la subcategoría **"Otros Periféricos"** para el presentador láser, que no calzaba en
  Mouse/Teclados/Mandos/Combos.
- 🎨 **Badge de "stock bajo" en la tabla de productos del POS, contraste corregido dos veces:**
  usaba fondo rojo translúcido que sobre el tema oscuro quedaba casi negro sobre negro con el número
  ilegible; el primer arreglo (ámbar) chocaba con el amarillo propio del emoji ⚠️. Quedó en **fondo
  azul sólido + texto blanco** (`css/styles.css`).
- 🛒 **Ficha de producto de `sevelin-tienda`, varias vueltas hasta el diseño final** (todo en
  `src/app/productos/[sku]/page.tsx` + `src/components/galeria-producto.tsx` y los avisos de
  stock/pago): terminó en que **la foto y "Agregar al carrito" quedan fijos** (`sticky`) mientras se
  hace scroll, y **"Última unidad"/"Quedan X unidades" baja normal** con el resto de la ficha — es lo
  opuesto de como quedó primero (se probaron 4 combinaciones distintas antes de la que el dueño
  confirmó). El punto de corte para el diseño de escritorio bajó de `lg` (1024px) a `md` (768px): con
  1024px, cualquier ventana de escritorio no maximizada caía al diseño de una sola columna sin nada
  fijo. Se corrigió además que 3 avisos (stock crítico, "viene en camino", "avísame cuando llegue")
  tenían fondo semitransparente que dejaba ver el contenido de atrás cuando quedaban fijos sobre él.
  **Nuevo: visor ampliado con carrusel** al hacer clic en la foto (flechas, miniaturas, teclado,
  Escape) — antes solo se podía cambiar de foto con las miniaturas, sin verla más grande. La foto
  además tiene tope de altura (max-h 420px): sin eso, en pantallas anchas era tan alta que el botón
  de compra quedaba fuera de la pantalla al entrar a la ficha.
- ✅ **Las dos preguntas abiertas se resolvieron en la sesión siguiente (Opus, 13-09-2026):** sueldos
  movidos al **día 15** (el día 1 se comía toda la utilidad de los días 21-31) y el checkbox quedó
  construido en **v62**.

## ⏭️ Pendientes al 16-09-2026 (histórico — los vigentes están ARRIBA)

> ⚠️ Esta lista es del 16-09. **La lista viva es la de "PENDIENTES ABIERTOS" al principio del
> archivo.** Lo de abajo se conserva porque varios siguen sin cerrarse (sobre todo lo tributario),
> pero hay que contrastarlo con el estado de hoy antes de actuar.

**Del dueño:**
1. **F29 de agosto — PRESENTADO el 21-09-2026**, folio 9317313976, $3.625 de PPM por ESTADO PEL.
   Se presentó exactamente la propuesta (IVA determinado $0, remanente 77 $219.227). **Falta marcarlo
   en el botón 🧾 del POS**: `f29_presentaciones` sigue vacía. Con v71 conviene aprovechar y copiar
   ahí los códigos del Formulario Compacto — 563 $2.899.984 · 538 $550.997 · 537 $770.224 · 089 $0 ·
   062 $3.625 · 504 $329.199 · 110 77 boletas · 519 40 facturas.
2. **Aceptar la factura pendiente en el SII** ($169.990, IVA $27.141). Sigue en estado PENDIENTE.
3. **Acreditar actividades en el SII** (anotación del 02-09-2026): destraba facturas y notas de
   crédito. Es la que sostiene todo lo demás — hoy el 66% de la venta de septiembre es SIN DTE.
4. **Anotar el WhatsApp del cliente en cada venta (B5).** El campo existe desde v52 y **no se está
   usando**: agosto 0 de 135 ventas, septiembre 1 de 60. Sin esto no hay recompra, ni lista de
   WhatsApp, ni Fase 3, aunque el código esté listo. Es gratis y toma 5 segundos por venta.
5. **Stock dormido: 62 productos con $2.723.930 adentro** — el 54% de todo el inventario
   ($5.064.377). Los tres mayores: Power Bank LinkOn (20 u., $324.500, comprado el 04-09 y cero
   ventas), HP ProDesk 600 G1 (3 u., $226.200), RAM Hiksemi 8GB (3 u., $176.370).
6. **Probar los dos botones nuevos de IA** (ficha y Facebook) contra Gemini de verdad — en las
   pruebas estaba simulado.

**Cerrados el 16-09-2026 (no volver a proponerlos):**
- ✅ Cowork "Sevelin Finanzas": creado, probado y **verificado contra la base** (dio $274.204, cuadra
  al peso). Corregir sus instrucciones para que mencione el PPM, que el mes no ha cerrado y que el
  RCV solo ve la venta con documento.
- ✅ Los 4 productos "sin SKU" (microSD 128GB, pasta Kronos, kit Opula, Air Duster): ya están
  publicados, con foto y con costo. `productos.sku` en null es normal — el slug lo genera la tienda.
- ✅ "19 costos en $0": quedan **2** productos físicos sin costo (Pilas Duracell AAA id 102 y Pendrive
  Kingston DT70 id 134), **los dos con stock 0**. El resto que aparecía en $0 son servicios, donde el
  costo $0 es correcto.

**De construcción, cuando se pida:**
- Cowork "Sevelin Contenido" + conector Metricool (ver `docs/RUTA-COWORK-METRICOOL.md`). **Siguiente
  en la fila** — el dueño lo pidió el 16-09.
- Semáforo de IVA dentro del informe semanal (v57).
- Cargar el costo de un envío después de la venta (hoy solo al cobrar).
- Lista de "stock dormido con capital atrapado" dentro de Inteligencia: hoy ese dato hay que sacarlo
  a mano con SQL.

**Descartado, no reintentar:** detectar automáticamente si un F29 está presentado (el SII lo entrega
por GWT, protocolo binario que se rompe en cada despliegue; probado y revertido en `5df314c`).

---

**Versión activa del POS: v65 — fichas sin Markdown crudo + generar texto con IA (ficha web y
Facebook).** Detalle en `docs/CHANGELOG-V65.md`. Migración de datos `sql/53` ya aplicada en
producción. Commits `2e97651`, `3be7a33`, `ac6519e`, `f1cae24`.

- 🐛 13 fichas mostraban `###` y `**` al cliente: estaban envueltas en un solo `<p>`, y la tienda no
  formatea nada que "ya traiga HTML". Se quitó solo ese `<p>`. Verificado en las 13 fichas reales.
- 🤖 Dos botones en el modal de producto. Los prompts viven en el servidor y **exigen información
  real**: sin specs pegadas ni Descripción escrita, el endpoint devuelve 400 (un modelo con solo el
  nombre inventa características). Nada se guarda ni se publica solo.
- 👁️ **La ficha generada pasa por una previsualización** (`modalFichaGenerada`) antes de reemplazar
  la Descripción, igual que la de Facebook: Markdown editable + el nombre propuesto si el producto
  todavía no tiene. Si se descarta, el formulario queda intacto. **El nombre NO es obligatorio para
  generar** — la IA lo propone a partir de la info real.
- 🔴 **EL BUG QUE MÁS COSTÓ ENCONTRAR (16-09-2026):** "Generar ficha" dejaba la intro y el título
  "✨ Características principales" SIN NINGUNA VIÑETA. No era Gemini (se verificó llamándolo de
  verdad: devuelve las 12 viñetas, `finishReason: STOP`). Era que `establecerDescripcion()` escribía
  `editorDescripcion.root.innerHTML = html`, pisando el DOM de Quill por debajo. **Quill 2 vigila su
  propio DOM con un MutationObserver y BORRA todo lo que no reconoce como formato suyo** — y `<ul>`
  no lo es (usa `<ol><li data-list="bullet">`). Medido en un navegador real: entraban 12 `<li>`,
  quedaban 0. Facebook no sufría nada porque su texto va a un `<textarea>`, nunca toca Quill.
  **Regla: nunca escribir `root.innerHTML` de Quill — usar `clipboard.convert()` + `setContents()`.**
- 🎨 Quill guarda las viñetas como `<ol data-list="bullet">`; la tienda borra ese atributo al
  sanitizar, así que en sevelin.cl salían **numeradas** en vez del diseño de tarjetas con ✓ que le da
  a los `<ul>` (verificado en `/productos/adaptador-hdmi-a-vga-43wbg`; las 37 descripciones con lista
  de la base están así). `normalizarListasQuill()` lo traduce a `<ul>` al guardar.
- ⚠️ **Trampa de Postgres:** en sus expresiones regulares `\b` **no es borde de palabra, es
  backspace** (el borde es `\y`). Una auditoría dio 58 fichas rotas cuando eran 13, por esto.

**Versión anterior: v64 — RCV del SII automático + semáforo de IVA del mes.** Detalle en
`docs/CHANGELOG-V64.md`. Migración `sql/51` ya aplicada en producción.

- 🧾 Robot diario (cron) que entra al SII con el certificado del dueño y trae el RCV; tarjeta en
  Finanzas → Utilidades con cuánto crédito queda y si se acaba antes de fin de mes. Respaldo: subir CSV.
- ✅ **Conectado al SII real el 15-09-2026**: certificado cargado por el dueño en Vercel; el RCV de
  agosto cuadra al peso con la propuesta del F29 (ver `CHANGELOG-V64.md`).

- 🔧 **15-09-2026 · marca "Es un servicio" en la ficha del producto** (`sql/52`, `productos.es_servicio`):
  el POS lo vende como servicio aunque no esté en la tienda (servicios de uso interno, ej. desbloqueos
  por modelo). Se marcaron los 27 de "Servicios Técnicos" + el desbloqueo Samsung A02s (id 290).
  Nunca se deriva de `stock_ilimitado` (Rollos Térmicos y Disipador CPU son físicos).

**Versión anterior: v63 — cobro seguro ante cortes de Supabase + registro de envíos.** Detalle
en `docs/CHANGELOG-V63.md`. Migración `sql/50` ya aplicada en producción.

- 🛡️ Reintentar un cobro ya no duplica la venta ni descuenta stock dos veces (`clave_idempotencia`).
  Los "Gateway Timeout" del 12/13-09 fueron de Supabase sa-east-1 (POS y tienda a la vez), no del código.
- 🚚 Paso de entrega: quién lleva el pedido (InDrive / padre / otro), costo, km, cómo se pagó (caja o
  transferencia) y sector → tabla `envios` + gasto "Envíos / Despachos" + egreso del turno si sale del
  cajón. Aviso en vivo del costo por km contra el promedio de InDrive.
- 📋 Botón Copiar en Salud → Errores recientes.

**Versión anterior: v62 — gasto que no mueve el saldo + recordatorio del F29.** Detalle en
`docs/CHANGELOG-V62.md`. Migración `sql/49` ya aplicada en producción.

- ⚖️ Pagar un gasto fijo con **"Ya estaba descontado: no mover el saldo"**: cuenta en utilidad y
  checklist, no resta de caja/banco (`compras.afecta_saldo`).
- 🧾 Botón **F29** en el header mientras haya un período sin marcar como presentado; al marcarlo
  registra el pago en Gastos (Impuestos). **F29 de agosto 2026 aún sin presentar** (vence 21-09).
- 📄 `docs/RUTA-COWORK-METRICOOL.md`: Cowork sí sirve para contenido — Metricool tiene conector oficial.

**Versión anterior: v61 — servicios técnicos: fichas reales, precio a
consultar y "trae tu equipo".** Detalle en `docs/CHANGELOG-V61.md`.

- 🛠️ **27 servicios técnicos con ficha real** (13 reescritas + 14 nuevos). 9 nuevos siguen **ocultos**:
  270-273 esperan que el dueño valide el "incluye" propuesto; 274-278 son de precio variable y se
  publican marcados como precio a consultar.
- 💬 **Precio a consultar** (sql/45 + web 31): "Desde" + "Cotizar por WhatsApp", y el checkout lo
  rechaza en el servidor.
- 🔧 **Carrito solo de servicios**: única opción "Traes tu equipo al local", día obligatorio,
  recordatorio el día antes, y el panel Pedidos Web lo muestra (web 32, `agenda_tipo`).
- 🛡️ Fichas de servicio ya no prometen "6 meses de garantía": la de mano de obra se consulta.
- 💵 **Los abonos ahora entran a Finanzas** (sql/46): al saldo el día que llegan, venta única al 100%, sin doble conteo. Encargos pueden ser productos; entrega independiente del pago.
- 🛒 **Carrito mixto**: un pedido, un pago, dos entregas.
- 🔐 **QR de retiro seguro en las OT** (sql/47): QR por correo/WhatsApp, entrega solo con QR vigente o carnet del titular.
- 🩺 **Salud → "Errores recientes"** (sql/48 + web 33): errores reales del POS y la tienda, agrupados. **Primer lugar donde mirar ante un error.**
- ✨ **Generar con IA arreglado:** usa `gemini-flash-lite-latest` con respaldo (el flash normal vive saturado).
- 🚫 **Una OT nunca se cobra desde el POS** (se quitó "Cobrar en POS" a propósito, decisión del dueño).

**⏳ PENDIENTES PARA LA PRÓXIMA SESIÓN (en orden):**
1. **Decidir el día de pago de Carlos y Alejandro.** El dueño preguntó si el día 1 está bien o si
   conviene otro día, y pidió revisar el estado financiero real (balance, ingresos, gastos) antes de
   responder. **Esto avisa Opus antes de empezar** (es análisis + decisión de negocio, no ejecución).
   Quedó sin responder al cerrar esta sesión — el dueño solo dijo que quería cerrar el chat.
2. **Definir el caso de uso del checkbox de Gastos Fijos** ("que un gasto no actualice el balance"):
   antes de construirlo hace falta saber para qué exactamente lo necesita (¿gastos pagados fuera de
   la caja del POS, con plata que no pasa por ahí? ¿otro caso?). Hoy el balance se recalcula siempre
   sumando `compras` por `método_pago` — no existe ninguna bandera para excluir una fila, así que
   implementarlo es una columna nueva + tocar varios puntos donde se suma el balance.
3. **Probar el correo del QR** creando la primera OT real con un correo propio (no se ha visto llegar uno de verdad). Revisar Salud si no llega.
4. **Revisar el "incluye" de los servicios 270-273** (PS3, mandos PS3/PS4, impresora): ya están publicados, pero el contenido lo propuso Claude.
5. **Fotos:** los 14 servicios nuevos (265-278) y #86/#118 no tienen foto (el dueño dijo que sigue subiéndolas).
6. **Mirar Salud** los primeros días: confirmar que la tienda registra sus errores en producción (no se forzó un error real).
7. Pendientes anteriores que siguen abiertos: SKU faltante en productos, costos en $0 y stock dormido (ver memoria del dueño).

**Trampa descubierta:** actualizar varios productos en una sola sentencia SQL perdió 2 de 4 sincronizaciones a la tienda. Por SQL, de a uno, y comparar después contra `productos_web`.

**Versión anterior: v60 — el stock deja de mentir y las ventas web aparecen en el historial.**
Detalle en `docs/CHANGELOG-V60.md`.

- 🔴 **LO MÁS IMPORTANTE: las ventas de sevelin.cl no llegaban al POS.** Un pedido pagado descontaba
  stock y nada más — la venta no existía en el Historial, ni en la utilidad, ni en el margen, ni en
  el punto de equilibrio, ni en el informe semanal. **Los números con los que se decide estaban
  cortos** y el descuadre crecía con cada venta online. Lo notó el dueño. Arreglado con
  `POST /api/interno/registrar-venta-web` (sql/41), idempotente por `ventas.pedido_web_numero`, que
  el webhook llama tras ajustar stock. La venta de la balanza se registró retroactivamente.
- 🔒 **La URL del pedido era adivinable** (`/pedido/WEB-000009`, correlativo). Ahora es
  `token_publico`, 32 hex aleatorios (supabase/26). Además la página **se actualiza sola** mientras
  el pago se confirma (antes se quedaba congelada pidiendo recargar, y el cliente se iba creyendo
  que falló) y la invitación a reseñar pasó de un `window.open()` que los navegadores bloqueaban a
  un modal que sí aparece.
- 🚚 **"Por llegar"**: productos en camino, con sección propia (`/por-llegar`), reserva pagando el
  100%, fecha **estimada**, **devolución total si no llega**, y lista de espera para quien prefiere
  solo que le avisen. Se marca en el POS y **desmarcarlo dispara los correos**.
- ⚡ **Aviso de pocas unidades** calculado con el stock real, con interruptor por producto en el POS.
- 📅 **Retiro agendado** opcional + recordatorio automático a las 8 AM, y el **horario real entró al
  sistema** (lunes a domingo, 11-13 y 14-20). Antes el código asumía semana hábil y mandaba al lunes
  los despachos del sábado.
- 📏 **Las medidas se guardan aparte y firmadas** (sql/43): antes cualquier edición de precio las
  marcaba como "medidas hoy". **Hay 54 productos con peso sin firma que el dueño debe revisar** — la
  lista priorizada quedó en el chat de la sesión.
- 📸 **El Instagram vuelve a llamarse `@sevelin.cl`.** El dueño decidió el 12-09-2026 renombrar la
  cuenta restringida a otro nombre y pasar la nueva (`@sevelin_cl`, creada el 11-09) a `@sevelin.cl`.
  **En el sitio y en todo texto nuevo se escribe siempre `@sevelin.cl`**; las menciones a
  `@sevelin_cl` en el bloque de v59 más abajo son historia de cómo se llegó acá, no el nombre actual.
- Otros: crear cuenta desde el checkout, retomar un pago de Khipu a medias, carrusel controlable,
  Azapa y Lluta apagados con interruptor, términos y FAQ al día.
- **Tarjetas gráficas: no se tocaron los precios, a propósito.** SIPOONLINE vende al público al
  mismo precio que le cuesta a Sevelin (y más barato en la RTX 5060). Bajar el margen sería vender a
  pérdida. La salida no es precio: es otro proveedor, o vender servicio junto al producto.

---

**Fecha:** 11-09-2026 · **Versión activa: v59 — el catálogo de Meta deja de mentir, y el Instagram
vuelve a existir.** Sesión en Opus, **sin código**: toda la configuración se hizo en las cuentas de
Meta desde el navegador real del dueño. Detalle completo en `docs/CHANGELOG-V59.md`.

- **El Instagram viejo `@sevelin.cl` quedó irrecuperable, y se reemplazó.** La causa se encontró tras
  descartar tres hipótesis falsas: existe un **tercer portafolio comercial llamado solo "Sevelin"
  (ID `2169115863901758`)**, creado por el dueño el **3-feb-2026 y restringido ese mismo día** por
  *"automatización que no cumple nuestras normas"*. Ese portafolio tenía enganchado `@sevelin.cl`, y
  cada intento de conectarlo a la Página obligaba a mover su cuenta publicitaria vieja → chocaba con
  la restricción → revertía todo. **No hay botón de apelación**: la restricción bloquea hasta las
  pantallas para arreglarla ("Cuentas de Instagram" y "Solicitudes" salen con candado). El caso de
  soporte 1612723069938270 (abierto 8-mar-2026) figuraba como **chat inactivo con aviso de cierre**.
- **Cuenta nueva `@sevelin_cl` configurada y limpia** (ID `17841423397901970`): cuenta profesional
  tipo Empresa, categoría "Tienda de aparatos electrónicos", correo `sevelin.contacto@gmail.com`,
  WhatsApp/teléfono +56 9 3575 0828, biografía escrita. **Propiedad de "Sevelin Arica - Tienda de
  Tecnología"** (`854365921098873`), sin restricciones, con la cuenta publicitaria conectada y los
  permisos (Contenido, Comunidad, Anuncios, Estadísticas) asignados al dueño.
- **🚨 Hallazgo grande: el catálogo de Meta llevaba un mes mintiendo.** El "Sevelin Catálogo"
  (`1458948679099643`) lo alimentaba el origen **"Tiendanube"** —la plataforma que el negocio ya no
  usa— con **107 productos congelados desde el 26 de agosto**, apuntando a fichas de una tienda
  muerta. Además el dueño **ni siquiera tenía acceso al catálogo** (decía "Sin acceso"), y había un
  origen fantasma vacío con 365 días sin uso. Anunciar sobre eso era pagar por llevar clientes a
  links rotos: la misma trampa de v58, repetida en Meta.
- **Corregido: el catálogo ahora se alimenta solo desde el POS.** Se creó el origen **"POS Sevelin -
  feed automático"** apuntando a `/api/feed/catalogo.csv?token=<FEED_TOKEN>`, en **CLP** (el viejo
  estaba en USD) y con frecuencia **diaria a las 20:17**, *no* cada hora — respetando la regla de no
  golpear ese endpoint en ráfaga, y separándolo de la lectura de Google (00:00). Primera carga:
  **115 agregados · 0 no subidos · 0 problemas**. Verificado por fuera: HTTP 200, 115 productos,
  **los 115 links a www.sevelin.cl**. Se eliminaron los orígenes "Tiendanube" y el fantasma vacío:
  **queda un solo origen**.
- **Pendiente de confirmar (queda abierto):** al cerrar la sesión el contador del catálogo **seguía
  en 220 productos** — Meta purga el índice de un origen borrado en diferido, no al instante. Hay que
  verificar que **bajó a 115** y que la **actualización automática de las 20:17 corrió sola**.
- **Trampa nueva que vale para todo Meta:** *ser dueño de un activo ≠ tener acceso a él*. Le pasó al
  catálogo y al Instagram. Se arregla en Configuración → Personas → [usuario] → **Asignar activos**.
- **Sigue sin completarse:** la conexión Página ↔ Instagram del **buzón de mensajes** (se atasca en
  "Continuar" sin dar error). Es un handshake aparte de la propiedad del activo y **no bloquea
  anuncios**.
- **Lo que falta para empezar a anunciar (del dueño):** publicar **6-9 posts** en `@sevelin_cl` (hoy
  tiene **0**), foto de perfil y link a sevelin.cl en la bio (solo desde el celular), **reseñas de
  Google** (Sevelin 0 vs Player One 80), método de pago en la cuenta publicitaria.
- **Criterio de anuncios que salió de los datos:** con margen de **$10.686** por venta y clics de
  $150-400, la captación fría pierde plata. Lo que rinde hoy es **click-to-WhatsApp local**,
  **catálogo dinámico + retargeting** y **tráfico a la tienda física**, con prueba de
  **$3.000-5.000 diarios por 2 semanas**. **No hace falta n8n ni Make**: la automatización de Meta es
  Advantage+, y lo único que había que automatizar era el catálogo — ya hecho.

---

**Fecha:** 10-09-2026 · **Esta sesión fue de postulación, no de código: Meta Pixel en
`sevelin-tienda` y La Brújula del Emprendedor completa al 100% para Impulso Chileno 2026.**

**Contexto:** el dueño postula al fondo **Impulso Chileno 2026** de Fundación Luksic
(postulaciones cierran 15-sept-2026, preselección/respaldo 23-30 sept). Dos cosas fortalecen el
perfil de la postulación: tener píxel de Meta funcionando en la tienda (para anuncios/remarketing)
y completar el diagnóstico "La Brújula del Emprendedor" de la misma fundación
(labrujuladelemprendedor.cl). Ninguna de las dos toca el POS.

- **Meta Pixel desplegado en `sevelin-tienda`** (commit `872abe6`, 10-09-2026): `PageView` en cada
  navegación (`src/components/meta-pixel.tsx`, vía `next/script`), `ViewContent` al entrar a una
  ficha de producto y `AddToCart` al agregar al carrito (`src/components/acciones-producto.tsx`).
  Helper único `trackearEventoPixel()` (`src/lib/meta-pixel.ts`) que nunca lanza — si `fbq` no
  cargó (bloqueador de anuncios, falta la env var) la compra sigue funcionando igual. El
  `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` ya está puesto en Vercel (prod y preview); sin esa variable el
  componente simplemente no se monta.
- **La Brújula del Emprendedor: 8/8 áreas completas** (Estrategia, Ventas, Legal, Gestión de
  personas, Digitalización, Finanzas y contabilidad, Funcionamiento del Negocio, Propuesta de valor
  y modelo de negocios), cada una con sus 5 niveles (4 en Digitalización) aprobados — recorrido
  hecho en el navegador real del dueño (Claude in Chrome), leyendo cada lección y respondiendo la
  evaluación final de cada nivel con el contenido real de la lección, nunca al azar.
- **Postulación enviada — "Postulación enviada satisfactoriamente."** (10-09-2026, ID 1719418). El
  dueño creó la cuenta en impulsochileno.vform.cl, completó "Datos personales", "Perfil
  emprendedor/a" y "Bienestar" (personalidad/bienestar, no las llena Claude — pesan 50% de la
  preselección) y dio el clic final de aceptar términos y enviar — eso siempre fue suyo. Claude
  completó con datos reales del negocio (verificados contra el SII: Registro de Compras y Ventas
  de junio/julio/agosto) las secciones "Datos del negocio", "Perfil del negocio" y "Proyecto": nunca
  se tocó el RUT (personal ni del negocio — dato de identificación, prohibido para Claude) ni los
  checkboxes de consentimiento. **Próximo hito real: preselección de 2.500 el 23-09-2026** — si
  Sevelin queda ahí, hay 7 días para adjuntar la carpeta tributaria y responder preguntas
  adicionales; ganadores se anuncian la semana del 16-11-2026.
- **Verificado en vivo, misma sesión: Google Shopping y la Página de Facebook SÍ funcionan.**
  Merchant Center real: 124/135 productos aprobados, 62 clics en 28 días (+785,7%), sin
  correcciones prioritarias pendientes — el dueño no lo veía porque buscaba el nombre de la marca
  (eso muestra el Perfil de Negocio, no Shopping) o términos genéricos que dominan los anuncios
  pagados de Ripley/Falabella/Paris. Página de Facebook "Sevelin Arica - Tienda de Tecnología"
  confirmada bien configurada (dirección, horario, sitio, Instagram, WhatsApp, categoría, 34
  seguidores) — con esto **B6 del plan de crecimiento queda resuelto** (ver
  `docs/PLAN-CRECIMIENTO-2026.md`).
- **Pendiente para la próxima sesión (dueño ya dijo que la abre en Opus): contenido orgánico
  automatizado** — reels/posts destacando un producto o servicio técnico real del catálogo, con
  guion + video + subtítulos, rutina fija, aprobación del dueño antes de publicar, y publicación
  simultánea en Facebook/Instagram/TikTok usando Claude Cowork + un conector de automatización.
  **Solo quedó como idea, nada construido todavía** — hay puntos abiertos (Claude Design no genera
  video, TikTok tiene una API de publicación muy restrictiva, cómo Cowork toma los repos). Detalle
  completo en `docs/PLAN-CRECIMIENTO-2026.md`, sección "Pendiente para la próxima sesión".

**Fecha:** 09-09-2026 (sesión de la tarde) · **Versión activa del POS: v58 — el catálogo real llega
por fin a Google.**

**El hallazgo que motivó todo:** al revisar Merchant Center se descubrió que los 19 productos que
quedaban ahí venían **TODOS de la integración vieja de Tiendanube**, que se está apagando (habían
caído de ~107 a 19 en una semana). El catálogo real de `sevelin.cl` **nunca había llegado a Google**:
el feed existía desde v53 pero detrás de auth de admin, o sea para bajar un CSV a mano — y no se
subía desde el 26 de agosto.

**Lo entregado (v58):**
- **`GET /api/feed/catalogo.csv?token=…`** — el mismo feed, público con token, para que Merchant
  Center lo lea **solo cada 24 h**. La generación se extrajo a `construirFeedCatalogo()`, compartida
  con el endpoint del panel (mismo criterio que `resumenDeVentas()` en v57).
- **Conectado y funcionando en Merchant Center**: leyó **96 productos, 47 nuevos**. Configurado para
  Chile / español / fichas gratuitas + Shopping.
- **Dos trampas encontradas verificando contra Google, ninguna cosmética:** (1) el **BOM** va SOLO en
  la descarga del panel (Excel lo necesita); en el feed un robot lo lee como parte del nombre de la
  primera columna (`﻿id`) y **rechaza el catálogo entero**. (2) Google limita el atributo `id` a **50
  caracteres** y los SKU de respaldo (slugs del nombre) se pasan: **49 de 96 productos quedaban
  fuera**. Se acorta a `sev-<id del POS>` **solo cuando hace falta**, porque cambiarle el id a un
  producto ya aceptado lo duplica hasta que expira.
- **Los servicios técnicos quedan fuera del feed**: Merchant Center solo acepta productos físicos y
  las desaprobaciones bajan la calidad de la cuenta. Se filtra por categoría, no por
  `stock_ilimitado` (ese campo también lo usan productos físicos sin control de stock exacto).
- **SEO de 107 productos generado y guardado** (109/109 con ficha quedaron completos, 106 ya
  sincronizados a la tienda). **NO se usó IA**: el plan gratuito de Gemini permite **20 peticiones al
  día** (verificado), lo que habría tomado ~6 días. Se generó desde el texto que el dueño ya escribió
  en cada ficha —el párrafo `✨` de introducción es exactamente lo que Google quiere—, así que no
  inventa nada. Los **21 productos sin ficha quedaron sin SEO a propósito**: cuando se escriban sus
  fichas, se vuelve a correr el generador.
- **Search Console: propiedad `https://www.sevelin.cl/` verificada** (Google la validó sola por
  etiqueta HTML) y **sitemap enviado — 118 páginas descubiertas**. Antes no existía ninguna
  propiedad. **Google Analytics sigue sin existir** y no es urgente: `eventos_web` ya mide el embudo.
- **Modelo de Gemini**: `gemini-2.0-flash` fue retirado por Google. Ahora se usa el alias
  **`gemini-flash-latest`** en vez de una versión fija, para que no vuelva a romperse solo.

> **Susto del día, ya resuelto — pero deja una regla:** mientras se probaba el feed a repetición con
> `curl` (incluido un bucle que consultaba cada 15 s), Vercel activó sus **mitigaciones automáticas**
> y el dominio del POS pasó a responder **403 "Security Checkpoint"** a clientes sin navegador. El
> POS nunca dejó de funcionar para personas (verificado en un navegador real) y la tienda no se vio
> afectada. **Al bajar el tráfico se desactivaron solas y el feed volvió a responder 200 con el CSV
> completo** — verificado.
> **La regla que queda: no golpear `/api/feed/catalogo.csv` en ráfaga.** Es un endpoint pesado
> (consulta las dos bases) y Vercel lo interpreta como ataque. Para probarlo, una petición y listo;
> tiene `Cache-Control` de 30 min justamente para eso. El plan Hobby **no permite reglas de bypass**,
> así que si algún día el fetcher de Google fallara de verdad, la salida sería servir el feed desde
> `sevelin.cl` (sin checkpoint), lo que exige sincronizar `condicion` a `productos_web`.
>
> **Sí queda por mirar mañana** (normal, no es problema): que la lectura automática de las 0:00 haya
> subido los productos de Merchant Center de 47 hacia ~96, ahora que los `id` largos están corregidos.

**Fecha:** 09-09-2026 (más temprano) · **Lo de ese tramo pasó todo en
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
| ~~4~~ | ~~Verificar dominio en Resend~~ — **RESUELTO**: los registros DNS están puestos y verificados contra el DNS real el 22-09-2026 (`resend._domainkey.sevelin.cl` con su llave pública, y `send.sevelin.cl` apuntando a la infraestructura de Resend). El correo a clientes sale de verdad — de eso depende, entre otras cosas, el aviso de "ya llegó" a quienes reservaron un producto por llegar (v75) | — | ✅ Bloqueo B2 cerrado |
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
