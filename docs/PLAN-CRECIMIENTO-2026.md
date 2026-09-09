# PLAN DE CRECIMIENTO SEVELIN — 2026

> **Qué es este documento.** El plan por fases para los 8 objetivos de negocio que pediste
> (conversión, email marketing, anuncios, oferta, monetización, anuncios con datos, competencia,
> sistema escalable). No es un changelog: es el mapa. Se actualiza al cerrar cada fase.
>
> **Fecha de creación:** 07-09-2026 · **Base:** POS v50 + tienda v38 · **Autor:** sesión de Claude Code.
> **Estado de partida verificado**, no asumido: ver "Verificaciones hechas al escribir este plan".

> ## ⚡ Actualización 07-09-2026 (misma fecha, más tarde)
>
> La **Fase 1 está construida y corriendo** — panel Finanzas → 🧠 Inteligencia, ver
> `docs/CHANGELOG-V51.md`. Con datos reales en la mano, dos cosas del plan original cambiaron:
>
> 1. El dueño confirmó **cómo vende de verdad**: casi todo nace en **Facebook Marketplace publicado
>    desde su cuenta personal**, se coordina por WhatsApp/Instagram y termina en retiro presencial.
>    Los datos lo respaldan: **165 de 167 ventas son retiro presencial**. La **Fase 3 se reescribió
>    entera** por esto (ver §3.F3).
> 2. Apareció un hallazgo que no estaba en ninguna lista y que bloquea por sí solo los objetivos 2 y
>    5: **166 de 167 ventas no tienen cliente identificado**. Es el nuevo bloqueo **B5** (ver §2.1).
>
> Las cifras reales del negocio, medidas contra la base de producción, están en §1.5.

> ## ⚡ Actualización 09-09-2026 — remedición contra producción
>
> Se volvieron a medir todas las cifras contra la base real. **Varias de §1.5 quedaron obsoletas** y
> aparecieron tres hallazgos que cambian el orden de las palancas. Detalle en §1.6.
>
> | Indicador | Decía el plan (07-09) | **Real (09-09)** |
> |---|---|---|
> | Costos en $0 | 21 → 19 | **7** (el dueño avanzó) |
> | Capital dormido | $1.954.370 | **$2.425.541 en 42 productos** (subió al cargarse los costos que faltaban: la foto anterior estaba subestimada) |
> | Ventas con teléfono | campo construido en v52 | **0 de 171** — el campo existe pero no se usa; **B5 sigue abierto de hecho** |
> | Margen | 30,9% global | **ago 31,4% → sep 25,0%** (−6,4 puntos, sin causa investigada) |
> | Ingresos por servicios | no medido | **$70.000 de $6.031.000 = 1,2%**, con margen 100% |
>
> **Corrección de método:** el plan decía que los bundles se deducirían de "qué se compra junto".
> Se midió: solo **4 pares** se repiten dos veces en todo el histórico. Con 1,28 ítems por venta
> **no hay señal estadística para minar combos** — hay que diseñarlos por criterio comercial. La
> única señal real es que el **Pendrive Kingston 128GB aparece en 3 de esos 4 pares**.

---

## 1.6 Los tres hallazgos del 09-09-2026 (y la aritmética de los $20M)

**1. El segundo ítem duplica el ticket, no lo suma.**

| Ítems en la venta | Ventas | Ticket promedio |
|---|---|---|
| 1 ítem | 133 (78%) | $27.165 |
| 2 ítems | 31 (18%) | **$57.484** (+112%) |
| 3 ítems | 6 | $81.500 |

Llevar un cuarto de las ventas de 1 ítem a 2 vale **~$800.000/mes** sin un cliente nuevo. Es la
palanca más barata que existe y no depende de ningún bloqueo externo.

**2. Los servicios son el 1,2% de los ingresos y tienen margen 100%.** Con taller propio y 13
servicios en catálogo. Se vendieron ~15 computadores en el período: uno con formateo cada vez
habrían sido **~$225.000 de margen puro** (+12% de la utilidad total) sin comprar mercadería.
Además se encontraron **"Instalacion SSD 128GB" e "Instalacion SSD 128GB NVME" vendidos como
producto con costo $0** — inflando el margen. Es el bug del checkbox corregido ese mismo día.

**3. El producto que más factura casi no deja plata.** Monitor Gamer MSI MAG 255F: **$600.000
facturados, 7,0% de margen**. El Dell OptiPlex 9020: $390.000 facturados, **40,6%**. Se está
vendiendo volumen del producto equivocado.

### La ruta a $20M/mes: el cuello es capital, no marketing

Con ticket actual ($35.269), $20M son **567 ventas/mes = 19 al día** contra 4,6 de hoy: 4× la
capacidad de atención. Con ticket de $60.000 baja a **11 al día**; con un canal B2B que aporte $6M,
a **8 al día**. Ese es el único camino operativamente realista.

**Pero antes que la demanda está el capital de trabajo.** $20M/mes al 30% de margen exigen **$14M
mensuales en mercadería**. Hoy hay $5.205.888 en stock, de los cuales $2.425.541 no rota → capital
productivo real **$2,8M**. Sostener $20M pide del orden de **$11-12M rotando: 4× lo actual.**

Orden de las fuentes, por facilidad:
1. **Rescatar los $2.425.541 dormidos** — casi duplica el capital productivo y ya está en la bodega.
2. **Crédito de proveedor (30-60 días)** — capital gratis, sin diluir. Es lo que separa una tienda
   de $5M de una de $20M, más que cualquier campaña.
3. **Utilidad reinvertida** — pero primero hay que explicar la caída de margen de 31,4% a 25,0%.

> **Conclusión que reordena el plan: $20M no se desbloquea con anuncios, se desbloquea con rotación
> de capital y ticket más alto.** El marketing amplifica un motor que funciona; hoy amplificaría uno
> con el 47% del combustible congelado.

### Por qué los ads pagados todavía no cierran

Margen por venta hoy: $35.269 × 30% = **$10.686**. Un clic en electrónica en Chile cuesta del orden
de $150-400 CLP (estimación de mercado, no medida propia). Con 1% de conversión en tráfico frío,
conseguir una venta cuesta ~$25.000 para ganar $10.686: **se pierde plata en cada venta**. Habría
que convertir al 8% para empatar, y eso no existe en tráfico frío.

Lo que sí rinde hoy, gratis o casi: **listados gratuitos de Google Shopping** (el feed de v53 ya
está listo), **Google Business + reseñas** (0 reseñas contra competidores con 80), **retargeting**
a quien ya visitó (necesita el Pixel, o sea B6), y **Marketplace**, que ya produce $4,9M/mes.
Ads de captación fría: **cuando el ticket supere ~$60.000**, no antes.

---

## 0. Verificaciones hechas al escribir este plan (no de memoria)

| Qué | Resultado real |
|---|---|
| ¿A dónde apunta `sevelin.cl`? | **Ya apunta a la tienda nueva** (Vercel + Next.js, confirmado por cabeceras HTTP el 07-09-2026). El SNAPSHOT de `sevelin-tienda` todavía dice "apunta a Tiendanube" — **está desactualizado, corregir**. |
| ¿Flow cobra plata real? | **NO.** `src/lib/flow.ts` usa `FLOW_API_BASE = process.env.FLOW_API_BASE \|\| 'https://sandbox.flow.cl/api'` y en `.env.local` sigue en `sandbox.flow.cl`. Falta confirmar la variable en Vercel. |
| ¿Cuántos pedidos web reales hay? | El pedido de prueba de la sesión anterior fue **WEB-000004** → el canal web lleva ~4 pedidos en total desde que existe. |
| ¿Hay correo transaccional funcionando? | Código sí (Resend integrado y probado), pero **sin dominio verificado**: los correos a clientes reales fallan **en silencio**. |
| ¿Hay crons disponibles? | Vercel plan **Hobby**: 2 crons ya usados (`recordar-carritos` 15:00 UTC, `expirar-pedidos` 16:00 UTC), **1 ejecución diaria máximo**. |
| ¿Hay consentimiento de marketing? | Sí: `perfiles_clientes.consentimiento_marketing` (opt-in, apagado por defecto) + `solicitudes_arco`. Ley 21.719 cubierta a nivel de datos. |
| ¿Hay medición de embudo? | Parcial: `eventos_web` (visitas, búsquedas, vistas de ficha), `carritos_web` (abandono), `pedidos_web`. **No hay pixel de Meta ni conversión de Google Ads.** |

---

## 1. El diagnóstico honesto (léelo antes que las fases)

**Los 8 objetivos que pediste son correctos, pero no en el orden en que los escribiste.** Tres cosas
cambian el orden:

1. **La tienda no puede cobrar plata real todavía (Flow en sandbox).** Todo lo demás —conversión,
   anuncios, email de recuperación— gasta esfuerzo y plata para llevar gente a una caja que no
   funciona. Esto es el bloqueo número uno y no es negociable.

2. **Con ~4 pedidos web históricos, "mejorar la tasa de conversión" es prematuro.** Con ese volumen
   no hay señal estadística: cualquier cambio "mejora" o "empeora" la conversión por azar. El
   cuello de botella real hoy no es la conversión, es **tráfico + confianza + poder cobrar**. La
   conversión se optimiza después, cuando haya volumen para medirla (regla práctica: a partir de
   ~200 visitas/semana y ~20 pedidos/mes empieza a tener sentido).

3. **No se puede decidir precio, oferta ni presupuesto de anuncios sin margen real.** Hoy hay al
   menos un producto con `costo_unitario = 0` (Ventilador Industrial 18", id 192) y un catálogo con
   condición nuevo/reacondicionado que se puso por `DEFAULT`, no por revisión. Anunciar un producto
   cuyo costo no conoces es anunciar a ciegas: puedes estar pagando por vender a pérdida.

**Reformulación del orden real:**

> **Cobrar → medir de verdad → tener oferta con margen conocido → traer tráfico → recién ahí
> convertir mejor y automatizar la recompra.**

Eso es lo que ordenan las fases de abajo.

---

## 1.5 Las cifras reales del negocio (medidas el 07-09-2026 contra producción)

Todo esto salió de la Fase 1, no de estimaciones. Período completo del sistema: **03-08-2026 al
06-09-2026, 167 ventas.**

| Indicador | Valor real | Lectura |
|---|---|---|
| Facturado | **$5.811.000** (ago $4.909.000 · sep parcial $902.000) | La meta de $20M/mes es **≈4× lo actual** |
| Margen bruto | **30,9%** ($1.794.063) | Sano para retail de electrónica, pero está inflado (ver abajo) |
| Ticket promedio | **$34.796** | |
| Productos por venta | **1,28** | Casi nadie compra dos cosas. Es la palanca más barata que existe |
| Capital en stock | $4.800.779 al costo | Casi un mes de facturación inmovilizado |
| **Capital dormido** | **$1.954.370 (41%) en 43 productos que nunca vendieron nada** | El hallazgo más grande |
| Concentración | 10 productos hacen el **44%** del margen | El negocio es más chico de lo que parece |
| **Ventas sin cliente** | **166 de 167** | Ver bloqueo B5 |
| Ventas sin DTE | 117 de 167 | |
| Entrega / pago | 165 de 167 retiro presencial y pago presencial | Confirma que el canal es Marketplace + WhatsApp |

**Calidad de datos del catálogo (132 productos activos):** 21 sin costo, 10 con margen bajo 15%,
50 sin SKU, 13 sin foto, 19 sin ficha, 47 sin peso ni medidas.

**Tres conclusiones que cambian decisiones:**

1. **Para llegar a $20M no hace falta 4× más clientes.** Con 1,28 productos por venta, subir el
   ticket es más barato que multiplicar el tráfico: mismo esfuerzo de venta, más plata por cliente.
   Combos, accesorio que acompaña, garantía extendida.
2. **Hay casi $2 millones dormidos** — un 41% del capital en stock — en 43 productos que jamás
   vendieron una unidad. Esa plata rescatada y reinvertida en los productos "ancla" es crecimiento
   sin pedirle un peso a nadie.
3. **El margen del 30,9% está inflado**, aunque poco: hay ítems que se cobran escribiéndolos a mano
   en el POS (sin producto ni costo asociado) y su utilidad figura al 100%. El panel ahora los
   separa de los errores reales del catálogo.

---

## 2. Pendientes reales al 07-09-2026 (lista completa y consolidada)

Consolida los pendientes del SNAPSHOT del POS, del SNAPSHOT de la tienda y de la sesión v50. Marcados
con **[B]** los que bloquean el plan de crecimiento.

### 2.1 Bloqueantes de negocio (sin esto, el plan no arranca)
| # | Pendiente | Quién | Bloquea |
|---|---|---|---|
| B1 | **Flow en producción**: credenciales productivas + `FLOW_API_BASE=https://www.flow.cl/api` en Vercel. Además, `obtenerEstadoPagoFlow()` nunca se probó con un pago real completado. | Dueño (cuenta) + Claude (código/verificación) | Fases 2-6 completas |
| B2 | **Verificar dominio propio en Resend** (2-3 registros DNS en `sevelin.cl`). Sin esto, cero email marketing y los correos de pedido a clientes reales fallan en silencio. | Dueño | Fase 3 completa |
| B3 | **Meta Pixel ID** (Events Manager) + **Catálogo de Meta Commerce** (no existe) + **ID y label de conversión de Google Ads**. | Dueño (cuentas) + Claude (integración) | Fases 5 y 6 |
| B4 | **Costos reales faltantes** — 21 productos activos del catálogo en $0 (auditoría de la Fase 1, ya listados en el panel Inteligencia). | ~~Claude audita~~ (hecho), dueño llena | Fases 4, 5, 6 |
| **B5** | ~~**No se registra quién compra.**~~ — **CAPTURA CONSTRUIDA 07-09-2026 (v52)**: campo "WhatsApp del cliente" en el POS y en editar venta, teléfono normalizado, link a `wa.me` en el detalle y recompra real en el panel. **Lo que falta ahora es usarlo**: cargar el teléfono en cada venta. Sin datos cargados, la herramienta no sirve. | ~~Claude construye~~ (hecho) · **dueño lo usa en cada venta** | **Objetivos 2 y 5 completos** |
| **B6** | **Todo el negocio cuelga de una cuenta PERSONAL de Facebook.** Si Meta la restringe, las ventas caen a cero de un día para otro. Migrar a Página + Business Manager es además lo que desbloquea B3 (Pixel y catálogo de Commerce). | Dueño | Continuidad del negocio + fases 3, 5, 6 |

### 2.2 Del dueño, de la sesión v50 (los 5 que ya tenías anotados)
1. **+1 de stock al Adaptador HDMI a VGA (id 104)** — lo descontó el pago sandbox. Lo haces tú en el POS.
2. **`costo_unitario` real del Ventilador Industrial Metálico 18" (id 192)** — hoy en $0. → es B4.
3. **Google Merchant Center**: confirmar que `sevelin.contacto@gmail.com` está "Verificada" como
   Administrador antes de sacar a `pcgoldchile@gmail.com`.
4. **~10-09-2026**: revisar si la fuente "sevelin.cl" ya se pobló; si sí, borrar "Tiendanube API".
5. **Khipu**: falta el `KHIPU_API_KEY` (código listo y apagado solo).
6. **HP ProDesk 400 G1 (id 181)**: ¿nuevo o reacondicionado? Sin confirmar.

### 2.3 Operativos / cuentas (arrastrados de v49)
- Confirmar `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` en Vercel **del POS**.
- **Tope de gasto en Google Cloud** (Geocoding / Distance Matrix / Places son APIs pagadas, sin tope).
- **Starken**: seguimiento del correo a `asistenciaplugin@starken.cl` por credenciales de producción.
- `NEXT_PUBLIC_PRIVACIDAD_EMAIL` en Vercel: confirmar que no siga en `pcgoldchile@gmail.com`.

### 2.4 Catálogo (curación, no técnico)
- **40 productos sin descripción** (lista congelada 30-08-2026).
- **28 productos sin SKU** — ya no bloquean el sync, falta clasificarlos y publicarlos.
- **10 productos con SKU sin foto**.
- **Clasificar nuevo/reacondicionado** de verdad (hoy todo quedó "nuevo" por `DEFAULT`; ya se
  encontraron 3 casos mal marcados).
- **Decisión sobre subcategorizar Monitores** (12 productos, sin criterio elegido).
- **9 servicios técnicos ofrecen courier como opción de envío** y no deberían (no existe un flag
  "es servicio, no se despacha" en `productos`). Cambio mediano, no hecho.

### 2.5 Pruebas de negocio nunca hechas en vivo
- Snapshot de garantía en una venta nueva; entrega de OT con `meses_garantia` editado.
- `/pedidos-por-encargo` nunca se compró de punta a punta.

### 2.6 Legal (Ley 21.719) — operativo, no de código
- Prueba de restauración de respaldo, documentada (único requisito técnico abierto).
- Antes del 01-12-2026: canal de reportes de la Agencia (Art. 14 sexies).
- Validación jurídica externa de `/privacidad` y `/terminos`.

### 2.7 Opcionales grandes (no bloquean nada)
- Migrar a Supabase Auth + RLS por rol; partir `api/index.js` en routers.
- Plan Vercel Pro (recuperaría el recordatorio de carrito a ~1h en vez de 1 vez al día).

---

## 3. El plan por fases

Cada fase tiene: **objetivo**, **qué hace el dueño**, **qué hago yo (código/datos)**, **cómo se sabe
que funcionó**. Ninguna fase empieza sin cerrar la anterior — ese es justamente el "sistema
consistente" del objetivo 8: no se avanza por entusiasmo, se avanza por indicador.

---

### FASE 0 — Destrabar la caja (1 semana) · *habilita todo*

**Objetivo:** que la tienda pueda cobrar plata real y que los correos lleguen.

**Dueño:**
- Solicitar credenciales de producción de Flow y entregarlas.
- Verificar el dominio en Resend (2-3 registros DNS en donde administras `sevelin.cl`).
- Confirmar el admin de Merchant Center y sacar la cuenta vieja.
- Poner el tope de gasto en Google Cloud.
- Conseguir `KHIPU_API_KEY` (opcional en esta fase, ideal para la 2).

**Yo:**
- Pasar `FLOW_API_BASE` a producción en Vercel y verificar `obtenerEstadoPagoFlow()` con un pago
  real chico (ej. $1.000 de un producto real, hecho por ti).
- Separar sandbox de producción para que **un pago de prueba nunca vuelva a descontar stock real**
  (el hallazgo de v50). Guardia en el ajuste de stock cuando el pago viene de sandbox.
- Verificar `UPSTASH_*` en el POS y `NEXT_PUBLIC_PRIVACIDAD_EMAIL`.

**Se sabe que funcionó cuando:** una compra real tuya de punta a punta deja el pedido PAGADO, el
correo de confirmación llega a una casilla externa (no la tuya de Resend), y el stock queda correcto.

---

### FASE 1 — La verdad de los datos (1-2 semanas) · *objetivos 4, 5, 6, 7, 8*

**Objetivo:** que cada número que vas a usar para decidir sea real. Sin esto, todo lo demás es
opinión con planilla.

**Yo (código real en el POS):**
1. **Auditoría de catálogo automatizada** — un endpoint + panel que lista, sin que tengas que
   buscar: productos con `costo_unitario` en 0 o mayor al precio, sin SKU, sin foto, sin
   descripción, sin categoría, sin medidas, con margen negativo, con stock muerto.
2. **Panel "Inteligencia de Negocio"** (nuevo subtab, junto a Métricas):
   - **Margen real por producto y por categoría** (con IVA correcto: `total − total/1,19`, la trampa
     ya documentada).
   - **Rotación**: qué se vende rápido, qué lleva 90+ días sin moverse.
   - **Capital parado**: cuánta plata tienes dormida en stock que no rota (esto suele ser el hallazgo
     más grande en una tienda chica).
   - **Ticket promedio, unidades por venta, recompra** (cuántos clientes compran 2+ veces).
   - **Productos ancla**: los 10 que hacen el 80% del margen (no de la venta — del margen).
3. **Embudo web real**: visitas → ficha → carrito → checkout → pagado, con la tasa de caída en cada
   paso. Ya existen los datos crudos (`eventos_web`, `carritos_web`, `pedidos_web`), falta armarlo.

**Dueño:** llenar los costos que la auditoría marque en rojo, y confirmar nuevo/reacondicionado.

**Se sabe que funcionó cuando:** puedes responder en 30 segundos, mirando el POS: *¿cuál es mi
producto más rentable?*, *¿cuánta plata tengo dormida?*, *¿dónde se me cae la gente en la web?*

---

### FASE 2 — Oferta y precio con criterio (1-2 semanas) · *objetivos 4 y 7 (parcial)*

**Objetivo:** decidir **qué** vendes y **a cuánto**, antes de gastar un peso en anunciarlo.

**Análisis (yo, con los datos de Fase 1):**
- Clasificar el catálogo en 4 cajones: **ancla** (alto margen + alta rotación → aquí va la plata de
  publicidad), **gancho** (bajo margen, alta rotación → traen gente, se anuncian pero no se vive de
  ellos), **joya escondida** (alto margen, baja rotación → problema de visibilidad, no de precio) y
  **lastre** (bajo margen, baja rotación → liquidar y no reponer).
- **Precio vs. competencia** por SKU comparable (ver Fase 5).
- **Bundles**: qué se compra junto con qué (lo dicen tus propias ventas). Monitor + cable, PC +
  formateo, fuente + ventilador.

**Producto nuevo a construir (código):**
- **Combos/packs** en la tienda: un producto compuesto con precio de pack. Hoy no existe.
- **Garantía extendida pagada** como upsell — la infraestructura ya está (`meses_garantia` es
  editable por producto y se guarda snapshot en la venta). Vender 12 meses en vez de 6 por $X es
  margen casi puro y es un diferenciador real frente a los informales.
- **Servicio técnico como upsell del producto**: al comprar un PC, ofrecer instalación/formateo en el
  checkout. Ya tienes el módulo de OT; falta el enganche comercial.

**Se sabe que funcionó cuando:** existe una lista escrita de "estos 10 productos son el negocio,
estos 15 se liquidan" y el ticket promedio empieza a subir.

---

### FASE 3 (§3.F3) — Blindar y profesionalizar el canal que YA vende (2-4 semanas) · *objetivos 1, 3, 6*

> **Reescrita el 07-09-2026.** La versión original de esta fase decía "traer tráfico a la tienda
> web". Estaba mal enfocada: el dueño confirmó, y los datos lo respaldan (165 de 167 ventas son
> retiro presencial), que **el canal que vende ya existe y funciona — es Facebook Marketplace desde
> su cuenta personal, coordinado por WhatsApp**. No hay que inventar un canal: hay que blindar,
> profesionalizar y medir el que ya produce $4,9 millones al mes.

**Objetivo:** que el canal que vende deje de ser frágil, deje de ser invisible para la medición, y
empiece a cerrar más rápido.

#### Lo primero, porque es riesgo puro: sacar el negocio de una cuenta personal

Hoy el 100% de las ventas depende de un perfil personal de Facebook. Meta restringe perfiles
personales usados con fines comerciales, sin aviso y sin apelación real. Si eso pasa un martes, el
miércoles no hay ventas. **No es una mejora de marketing, es continuidad del negocio.**

El camino, en orden:
1. **Página de Facebook de Sevelin** (si no existe) + **Business Manager** con la Página, el
   Instagram y el dominio adentro.
2. Marketplace se sigue usando — pero publicando también desde la Página, y con el perfil personal
   dejando de ser el único activo del negocio.
3. Ese mismo Business Manager es lo que entrega el **Pixel** y el **catálogo de Commerce**, o sea
   resuelve el bloqueo **B3** de paso.

#### Segundo: dejar de publicar a mano

Hoy cada publicación de Marketplace se escribe una por una. Ya existe un catálogo real de 132
productos activos con nombre, precio, foto y ficha en el POS. **Construible:** una exportación del
catálogo en el formato que come el catálogo de Meta, para que Marketplace/Instagram Shopping se
alimenten solos desde el POS en vez de a mano. Es el mismo trabajo de sincronización que ya
funciona hacia la tienda web.

#### Tercero: que la web sirva de lo que sirve hoy

La tienda web **no es todavía un canal de captación** — es la herramienta de cierre. El flujo real
es: el cliente pregunta por Marketplace o WhatsApp → hay que mandarle algo. Que ese "algo" sea el
link de la ficha del producto (con foto, ficha, garantía, precio y botón de pago) en vez de una
foto suelta, cambia dos cosas: sube el ticket (el cliente ve accesorios y combos) y permite cobrar
antes de la entrega. **Para eso Flow tiene que estar en producción (B1).**

#### Cuarto: los canales nuevos, en orden de costo

1. **Google Shopping / Merchant Center** — ya migrado. Máxima intención de compra: alguien que
   busca "adaptador HDMI VGA Arica" ya quiere comprar. Necesita catálogo limpio (Fase 1, hecho) +
   conversión de Google Ads (B3).
2. **Google Business local** — "computación Arica". La ficha ya existe. Las reseñas se piden mejor
   en la entrega presencial, que es donde está el volumen real de clientes.
3. **Instagram/Meta con catálogo conectado** — descubrimiento y retargeting local.
4. **SEO propio** — 19 fichas vacías son 19 páginas que Google no puede posicionar.

#### Sobre "anuncios disruptivos que vendan y no solo se vean bonitos" (objetivo 3)

Un anuncio vende por el **ángulo**, no por el diseño; el diseño solo evita que lo descarten. Y en
este negocio los ángulos ya están escritos en los datos y en la operación:

- **La objeción real en Arica** es "¿y si sale malo?". Sevelin tiene garantía de 6 meses rastreada
  en sistema, boleta o factura y taller propio. Un vendedor informal de Marketplace no puede decir
  ninguna de las tres. **Ese es el anuncio**, y es especialmente potente porque se publica en el
  mismo Marketplace donde está la competencia informal.
- **La comparación honesta**: precio + garantía + retiro hoy, contra "más barato pero sin nadie a
  quién reclamarle".
- **La prueba**: reseñas reales de Google en la pieza, no adjetivos.
- **La urgencia real**: stock verdadero, nunca una cuenta regresiva falsa.

Las piezas se producen en serie con el canvas de diseño y el dueño las ajusta sin tocar código.

**Se sabe que funcionó cuando:** el negocio ya no depende de una cuenta personal, el catálogo de
Meta se alimenta solo desde el POS, y una parte medible de las ventas se cierra mandando el link de
la ficha en vez de una foto por WhatsApp.

---


### FASE 4 — Conversión y recuperación (2-4 semanas) · *objetivos 1 y 2*

**Ahora sí**, con tráfico y con el embudo de Fase 1 midiendo, se optimiza donde de verdad se cae la
gente. No antes.

**Conversión (objetivo 1)** — se ataca el paso que el embudo muestre peor, en este orden probable:
- **Medios de pago**: Flow producción (B1) + Khipu (transferencia, comisión bajísima) + webpay. En
  Chile, la falta de medios de pago mata más ventas que el precio.
- **Prueba social**: reseñas de Google visibles en la ficha de producto. Hoy no hay ninguna.
- **Fotos**: 10 productos sin foto no se venden. Punto.
- **Fichas**: 40 productos sin descripción no se venden ni se posicionan.
- **Costo de envío visible temprano** (ya está bien resuelto con Google Maps) y **envío gratis sobre
  un umbral** (la columna ya existe) — sube conversión y ticket a la vez.
- **Velocidad y móvil**: medir Core Web Vitals reales.

**Email marketing y recuperación (objetivo 2)** — todo sobre lo que ya tienes (Resend + Supabase +
crons), sin contratar una plataforma aparte. Tus datos ya están en la base: la segmentación va a ser
mejor que la de cualquier herramienta externa.

Automatizaciones a construir, por orden de plata que recuperan:
| # | Automatización | Base de datos que usa | Estado |
|---|---|---|---|
| 1 | **Carrito abandonado** | `carritos_web` | **Ya existe** (1×/día por plan Hobby) |
| 2 | **Post-compra / cross-sell**: "compraste un monitor, te falta el cable" | `pedidos_web`, ventas POS | Por hacer |
| 3 | **Pedir reseña de Google** tras la entrega | `pedidos_web` | Ya existe en el correo de entrega — falta insistir |
| 4 | **Garantía por vencer**: "revisa tu equipo antes de que venza" | módulo Garantías (v48) + `sql/39` | **HECHO (v55)** — panel con WhatsApp listo. Empieza a llenarse en enero 2027; la primera garantía vence el 03-02-2027 |
| 5 | **Win-back** a 60/90 días sin comprar | `perfiles_clientes` + ventas | Por hacer |
| 6 | **Volvió el stock** de un producto que miraron | `eventos_web` + `productos.stock` | Por hacer |
| 7 | **Bienvenida** a cuenta nueva, con el diferencial (garantía, taller propio) | `perfiles_clientes` | Por hacer |

**Restricción técnica importante:** plan Hobby de Vercel = 1 ejecución diaria por cron y 2 crons ya
ocupados. Solución sin pagar: **un solo cron "despachador"** que cada día evalúa todas las
automatizaciones y manda lo que corresponda. Si más adelante quieres el carrito abandonado a la hora
(que convierte bastante mejor que a las 24h), ahí sí conviene Vercel Pro.

**Restricción legal (no opcional):** solo se manda marketing a quien marcó
`consentimiento_marketing`. Los correos transaccionales (confirmación, envío, garantía) no necesitan
opt-in; los promocionales sí, y todos llevan link de baja.

**Se sabe que funcionó cuando:** la tasa de pedidos pagados sobre visitas sube, y hay ventas
atribuibles a correos (pedidos que llegan con el link del correo).

---

### FASE 5 — Competencia y valor agregado (continuo) · *objetivo 7*

**Objetivo:** saber dónde estás parado frente a Waliex, Basurto y los informales, y competir sin
regalar margen.

**Método (yo construyo, tú validas):**
1. **Lista de SKUs comparables** (~30): los productos donde de verdad te comparan.
2. **Registro de precios de competencia** en el POS: una tabla + panel donde queda el precio de cada
   competidor por SKU y la fecha. La captura se hace de forma semiautomática y a bajo volumen
   (consulta de páginas públicas, sin herramientas agresivas ni saltarse términos de uso) o manual
   cuando el competidor no publica precios en línea — los informales de Marketplace, por ejemplo,
   solo se pueden registrar a mano.
3. **Panel "Precio vs. competencia"**: por SKU, tu precio, el más barato del mercado, tu margen a ese
   precio, y una recomendación (mantener / igualar / no competir).

**La parte estratégica — no bajar el precio:**
Contra un informal nunca vas a ganar por precio: él no paga IVA, ni local, ni garantía. Ganas por lo
que él no puede ofrecer, y hay que **cobrarlo explícitamente**:
- Garantía real de 6 meses, escrita, con módulo que la rastrea (ya lo tienes — casi nadie lo tiene).
- Boleta y factura (clave para el cliente empresa, que además compra más y repite).
- Taller propio: si falla, se arregla; no se desaparece.
- Retiro hoy en Arica / despacho local propio.
- Asesoría: decirle qué necesita de verdad, no venderle de más.

**Cuándo sí bajar:** solo en los productos "gancho" de la Fase 2, y hasta un piso de margen definido
por escrito. Nunca en los "ancla".

**Se sabe que funcionó cuando:** existe el panel con datos de al menos 3 competidores y una política
de precios escrita, con piso de margen por cajón de producto.

---

### FASE 6 — Monetizar cada cliente (continuo) · *objetivo 5, incluye redes*

**Objetivo:** subir el valor de vida del cliente, que es más barato que conseguir clientes nuevos.

**Palancas, por facilidad de implementación:**
1. **Ticket más alto**: bundles (Fase 2), "completa tu compra" en el carrito, envío gratis sobre
   umbral.
2. **Garantía extendida pagada** (Fase 2) — margen casi puro.
3. **Servicios como recurrencia**: mantención de PC, limpieza, respaldo. Un cliente de producto es
   una venta; un cliente de servicio es una relación.
4. **Canal B2B / empresas**: es el camino más corto a los $20M. Una pyme de Arica que compra
   insumos, monitores y mantención factura en un mes lo que 30 clientes de mostrador. Requiere:
   cuenta empresa con precio propio, factura (ya tienes `openfactura`), y cotización rápida.
   **Construible:** generador de cotizaciones en PDF desde el POS.
5. **Redes sociales monetizadas** — orden correcto: primero **catálogo de Instagram conectado a Meta
   Commerce** (tus productos comprables desde el perfil), después contenido que resuelva dudas
   reales de clientes (las que ya te llegan por WhatsApp), y recién ahí anuncios de retargeting a
   quien vio pero no compró. Monetizar redes sin catálogo conectado es publicar bonito.

---

### FASE 7 — Sistema consistente (permanente) · *objetivo 8*

**Objetivo:** que el negocio funcione por proceso, no por memoria tuya. Esto es lo que permite pasar
de unos pocos millones a $20M sin que todo dependa de que tú estés.

**Los tres componentes:**

1. **Ritmo fijo de revisión.**
   - **Lunes (10 min):** 5 números de la semana — ventas, margen, ticket promedio, visitas,
     pedidos web. Un solo panel.
   - **Día 1 de cada mes (1 hora):** margen por categoría, stock muerto, ranking de productos,
     resultado de anuncios, decisiones de precio.
   - **Trimestral:** revisar el plan, cerrar fases, abrir las siguientes.

2. **Informe automático.** Una rutina programada en la nube genera el informe del lunes y del día 1
   y te lo deja listo, con las alertas ya detectadas (producto que se quedó sin stock y se vende
   bien, producto con margen negativo, caída del embudo). Ya usaste una rutina programada para el
   recordatorio de Merchant Center — es el mismo mecanismo.

3. **Procesos escritos (SOP).** Un documento corto por proceso, con el criterio, no solo los pasos:
   cómo se ingresa un producto nuevo (foto, SKU, costo, condición, ficha, publicar), cómo se despacha,
   cómo se responde una consulta, cómo se cierra caja, cómo se atiende una garantía. Esto es lo que
   permite que un trabajador haga lo mismo que harías tú. **Aquí es donde una "skill" propia rinde
   de verdad:** cada SOP repetible se puede convertir en una skill de Claude que lo ejecute igual
   siempre.

**Cálculo de capacidad para $20M/mes** (a hacer con datos reales en Fase 1): con tu ticket promedio
actual, $20M implica N ventas al mes → M al día. Los cuellos que aparecen a ese volumen son
predecibles: preparación de pedidos, quiebres de stock, y atención. Es mejor saberlo antes de
llegar.

---

## 4. Herramientas: qué usar y qué no

**Sí, y ya disponibles aquí:**
| Herramienta | Para qué en este plan | Cuándo |
|---|---|---|
| **Claude Code** (esto) | Todo el código: paneles, SQL, automatizaciones de correo, análisis de datos, auditorías de catálogo | Todas las fases |
| **Claude Design** (skill `design`) | Piezas de anuncios, banners de categoría, landings de campaña — canvas visual que tú ajustas sin tocar código | Fase 3 |
| **Skill `dataviz`** | Los paneles de Fase 1 y el informe semanal, con criterio de visualización serio | Fases 1 y 7 |
| **Skill `xlsx`** | Análisis de catálogo/márgenes en planilla, cargas masivas de costos | Fases 1 y 2 |
| **Skill `docx` / `pdf`** | Cotizaciones B2B, SOPs imprimibles, informe mensual | Fases 6 y 7 |
| **Skill `schedule`** / rutinas programadas | El informe automático del lunes, recordatorios | Fase 7 |
| **Skill `skill-creator`** | Convertir cada proceso repetible de Sevelin en una skill propia (ficha de producto, informe semanal, creativo de anuncio, ingreso de producto nuevo) | Fase 7 |
| **Artifacts** | Paneles y documentos compartibles con link, sin desplegar nada | Todas |

**Claude Cowork:** ~~existe una skill de setup (`setup-cowork`)~~ — **CORREGIDO 09-09-2026: eso era
falso.** No existe ninguna skill `setup-cowork`, y no hace falta: **Cowork ya está disponible**, es
una pestaña dentro de la misma app de Claude Desktop que se usa para esto (junto a Chat y Code),
incluida en el plan que el dueño ya paga. No hay nada que instalar ni conectar.
Sirve para el trabajo recurrente que **no es código** (documentos, planillas, investigación).
**Sigue sin usarse todavía, y por una razón distinta a la que decía antes:** Cowork rinde cuando hay
un proceso repetible que delegar, y los procesos de Sevelin todavía no están escritos. Encaja en las
Fases 6-7, después de los SOP.

**Conectores MCP** (Google Ads, Meta, Analytics, Supabase): se pueden buscar en el registro de
conectores cuando lleguemos a la Fase 5-6, para que los números de anuncios entren solos al informe.
No antes: conectar cuentas sin datos que leer no aporta.

**Repos de internet — mi recomendación honesta: casi ninguno.**
Ya tienes Supabase + Next.js + Resend + Vercel. Cada herramienta nueva que sumes es una cuenta más,
una llave más, un punto de falla más y una cosa más que se rompe cuando no estás. Las que a veces se
recomiendan y **por qué no las necesitas hoy**:
- *Plataformas de email marketing* (Mailchimp, Brevo, Klaviyo): tus datos están en Supabase; con
  Resend + un cron tienes mejor segmentación y sin costo por contacto. Reconsiderar sobre ~2.000
  suscriptores.
- *Analytics de producto* (PostHog, Plausible): útiles, pero `eventos_web` ya te da el embudo. Suma
  uno solo si en Fase 4 el embudo propio se queda corto.
- *Automatización tipo n8n/Zapier*: los crons de Vercel hacen el trabajo gratis a tu escala.

La ventaja competitiva acá no está en el software que instales — está en que **tienes tu propia base
de datos con el POS y la tienda unidos**, algo que Waliex y Basurto probablemente no tienen. El plan
explota eso.

---

## 5. Preguntas hechas y respondidas (07-09-2026)

| # | Pregunta | Respuesta del dueño | Qué cambió |
|---|---|---|---|
| 1 | Credenciales de producción de Flow | **Aún no** | Fase 0 queda esperando; se arrancó por Fase 1 |
| 2 | Dominio verificado en Resend | **Aún no** | Fase 4 (correos) queda esperando |
| 3 | HP ProDesk 400 G1 (id 181) | **Reacondicionado** | Corregido en la base y sincronizado a la tienda (v51) |
| 4 | ¿La venta es física o web? | **Totalmente física — pero casi toda nace en Facebook Marketplace desde su cuenta personal, coordinada por WhatsApp/Instagram** | **Fase 3 reescrita entera**; nuevos bloqueos B5 y B6 |
| 5 | Competencia a monitorear | Waliex, Basurto, **Dagatech (Dagach Gaming Arica)**, **Player One** (`playerone.cl`, Juan Waidele 820), **Lutech**, más ~12 servicios técnicos locales listados en §5.1 | Fase 5 pasa a tener una lista concreta |

### 5.1 Competencia declarada (a cargar en el panel de la Fase 5)

**Con sitio web o presencia comparable en producto:** Waliex · Basurto · Dagatech / Dagach Gaming
Arica (Facebook) · Player One (`playerone.cl`) · Lutech.

**Servicio técnico local (competencia del taller, no del catálogo)** — de la búsqueda de Google que
entregó el dueño, con sus reseñas donde las hay: Player One 5,0 (80) · Servicio Técnico de
Computadoras/Notebooks (Los Ciruelos 2781) · Web-sion Arica (Providencia 976) · RPC & ZU 4,7 (29) ·
Norte Informático Local 10 4,7 (40) · CELCOM Arica 5,0 (11) · Tecnicomp 7AM 5,0 (1) · CEPCOMP EIRL
4,4 (17) · Servicio Técnico Arica · MacTech · ibytes store spa 4,5 (15) · Computron Arica ·
SERVITEC ARICA 3,6 (92).

> **Observación que vale para la Fase 5:** varios de esos competidores tienen 20+ años de actividad
> y **decenas de reseñas de Google**. Sevelin todavía no tiene reseñas visibles en su ficha. En un
> mercado donde el cliente elige por confianza, esa es una brecha concreta y barata de cerrar —
> pedirle la reseña a cada cliente en la entrega presencial, que es donde está el volumen real.

### 5.1b Lo entregado el 07-09-2026, en producción

| Versión | Qué | Estado |
|---|---|---|
| v51 | Panel **Finanzas → 🧠 Inteligencia** (Fase 1 completa) | En producción |
| v52 | **Contacto del cliente en la venta** (bloqueo B5: captura construida) | En producción |
| v53 | **Feed de catálogo** para Meta Commerce y Google Merchant (Fase 3, "dejar de publicar a mano") | En producción |
| v54 | **Marca del producto** en el catálogo, el feed, la ficha y el JSON-LD (47 marcas cargadas) | En producción |
| v55 | **Aviso de garantía por vencer** (Fase 4, automatización #4 de la tabla) | En producción |
| v56 | **Garantías abierto al rol trabajador** | En producción |
| v57 | **Informe semanal** (Fase 7, el ritmo del lunes) | En producción |

### 5.2 Lo que sigue necesitando de ti

1. **Flow productivo** y **DNS de Resend** (siguen abiertos, desbloquean Fases 0 y 4).
2. **Los 21 costos faltantes** — el panel Inteligencia ya te los lista con ID y nombre. *En curso.*
3. **Decisión sobre los 43 productos dormidos** ($1.954.370): cuáles se liquidan y cuáles se
   mantienen. Yo puedo proponer, la decisión comercial es tuya.
4. **Página de Facebook + Business Manager** (bloqueo B6) — es riesgo de continuidad, no marketing.
   Ahora además tiene premio inmediato: el feed de 99 productos está listo para subir apenas exista.
5. **Cargar el WhatsApp en cada venta** (v52 ya construyó el campo). Sin datos, la herramienta no
   sirve — y es lo que habilita el aviso de garantía por vencer, que ningún competidor de Arica hace.
6. **13 productos sin foto y 18 sin stock** quedaron fuera del feed. Los 13 son foto; los 18 son
   reposición, o bien decidir que la tienda muestre las fichas agotadas (hoy devuelven 404).

---

## 6. Bitácora de fases

| Fase | Estado | Abierta | Cerrada | Nota |
|---|---|---|---|---|
| 0 — Destrabar la caja | **A medio destrabar** | 07-09-2026 | — | **La tienda cobra plata real por Khipu** (transferencia, sin límite de monto). **09-09-2026: Flow apagado** — apuntaba al sandbox, así que "tarjeta" era un pago de prueba que dejaba el pedido PAGADO sin plata. El dueño **postula a Transbank directo** (2,08%/2,80% vs 3,44% de Flow). Falta eso y el DNS de Resend: se puede vender, pero solo por transferencia y sin que llegue ningún correo |
| 1 — Verdad de los datos | **Construida** | 07-09-2026 | 07-09-2026 (panel) | Panel Finanzas → Inteligencia en producción, ver `CHANGELOG-V51.md`. Queda que el dueño llene los 21 costos |
| 2 — Oferta y precio | **Empezada** | 08-09-2026 | — | Ya hay datos: cajones, capital dormido y concentración medidos. **Precio diferenciado por medio de pago: construido, probado y APAGADO** (`sevelin-tienda/docs/PLAN-PRECIOS-DIFERENCIADOS.md`) — se decidió absorber la comisión con Transbank en vez de traspasarla. Sigue bloqueada de fondo por B4 (**19 costos en $0**, 10 de ellos con stock): sin costo real no hay decisión de precio que valga |
| 3 — Blindar el canal que vende | **Empezada** | 07-09-2026 | — | **Reescrita.** "Dejar de publicar a mano" **hecho** (v53: feed de catálogo para Meta y Google, 99 productos listos). Lo demás depende de B6 (Página + Business Manager) y B3 |
| 4 — Conversión y recuperación | **Empezada, parcialmente bloqueada** | 07-09-2026 | — | Hecho: captura de cliente (v52) y **aviso de garantía por vencer** (v55, la única automatización que no dependía de correo). El resto espera B1 (Flow) y B2 (Resend) |
| 5 — Competencia | Lista para empezar | — | — | Lista de competidores ya cargada en §5.1 |
| 6 — Monetización | Por empezar | — | — | Depende de Fase 2 |
| 7 — Sistema consistente | **Empezada** | 08-09-2026 | — | **Informe semanal en producción (v57)**. Falta el informe mensual y los procesos escritos (SOP) |
