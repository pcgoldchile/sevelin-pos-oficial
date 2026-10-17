# CONTEXTO — SEVELIN AUTOMOTRIZ

> **Para:** Claude Code del proyecto Sevelin
> **De:** sesión de análisis de negocio (Claude, 17-10-2026)
> **Qué es este archivo:** briefing completo para que valorices, proyectes y prepares una propuesta de inversión para una **nueva unidad de negocio** llamada Sevelin Automotriz.
> **Guárdalo en el repo** y léelo completo antes de empezar.

---

## 0. REGLA FUNDAMENTAL: SEPARACIÓN DE FINANZAS

**Sevelin Tecnología y Sevelin Automotriz son negocios distintos y deben valorizarse por separado.**

- ❌ **NO** mezcles ventas, márgenes, deudas ni créditos de Sevelin Tecnología en la valorización del automotriz.
- ❌ **NO** uses el historial de ventas de electrónica/computación como base de proyección del automotriz.
- ✅ **SÍ** inventaría y valoriza lo que Sevelin Tecnología **aporta** al automotriz: activo fijo traspasable, software, marca, local, base de clientes y know-how.
- ✅ **SÍ** crea un **centro de costo separado** en el sistema para el automotriz desde el día uno, con su propio P&L.

**Sevelin Automotriz se valoriza como emprendimiento nuevo (greenfield)**, no como extensión del negocio actual.

### Advertencia legal que debes dejar escrita en el informe

El dueño decidió operar Sevelin Automotriz **bajo la misma MEF / mismo RUT**, agregando giros al SII. Separar las finanzas contablemente **no separa la responsabilidad patrimonial**: legalmente es la misma persona natural respondiendo por ambos negocios y por los créditos vigentes.

Un inversionista con asesoría lo va a detectar. Opciones a plantear en el informe:
1. **Declararlo abiertamente** en la propuesta y compensarlo con garantías o con una estructura de retorno preferente.
2. **Migrar a SpA** cuando el automotriz tenga números propios (recomendado a 6–12 meses).
3. **Contrato de asociación o cuentas en participación** que delimite expresamente que la participación del socio es sobre el **resultado del negocio automotriz específicamente** (ver sección 8).

---

## 1. QUIÉN ES EL DUEÑO Y QUÉ TIENE

**Carlos Alejandro Silva Jirón** — Arica, Chile.

| Dato | Detalle |
| :--- | :--- |
| Régimen | Microempresa Familiar (MEF), persona natural con inicio de actividades |
| Régimen tributario | Pro Pyme General (14D), contabilidad completa |
| Documentos autorizados | Factura electrónica, **factura no afecta o exenta electrónica**, boleta electrónica, boleta exenta, guía de despacho, notas de débito y crédito |
| Domicilio tributario | Linderos 3736, Arica |
| Local operativo | **San Rafael 896, Arica — ARRENDADO** (no es propiedad) |
| Giros actuales | Venta mayor/menor de computadores y equipos periféricos, venta de juguetes, venta por internet, otras actividades de TI, reparación de computadores |

**Perfil técnico:** reparación de computadores y electrónica, desarrollo de software (construyó el POS Sevelin completo con Claude Code), venta y configuración de equipos.

**Red disponible:** dos amigos con formación técnica automotriz —
- Técnico en **Mecánica y Electromovilidad Automotriz** → el que sirve hoy
- Técnico en **Electromecánica con mención en Electromovilidad** → sirve a futuro (eléctricos/híbridos), hoy no cruza con el segmento

---

## 2. QUÉ ES SEVELIN AUTOMOTRIZ

Nueva unidad de negocio de servicios automotrices en Arica, a desarrollar **por fases**:

| Fase | Línea | Estado |
| :--- | :--- | :--- |
| **1** | **Lubricentro** (cambio de aceite, filtros, revisión de niveles) | Prioridad 1 — arranca primero |
| **2** | **Electrónica automotriz** (radios Android, cámaras, sensores, alarmas, GPS) | Prioridad 1 — arranca junto con lubricentro |
| 3 | Mecánica liviana (frenos, batería, suspensión, diagnóstico) | Después |
| 4 | Detailing (pulido, tapiz, faros) | Después |
| 5 | Copia de llaves (incluye llaves con transponder/chip) | Después — **no analizado aún, requiere estudio propio** |
| 6 | Pintado de autos (retoque → parcial → completa) | Después |
| 7 | Compraventa de autos usados | Evaluada en detalle, postergada |

### Ubicación: San Rafael 896, Arica

| Factor | Evaluación |
| :--- | :--- |
| Flujo vehicular | Fuerte — misma avenida de Robinson Rojas |
| Feria sábados y domingos | Fuerte — tráfico concentrado justo los días de mantención |
| Vulcanizaciones vecinas | Fuerte — **red de derivación, no competencia** (servicios complementarios) |
| Espacio para autos | Ya designado en el inmueble |
| **Uso de suelo** | ⚠️ **SIN VERIFICAR — riesgo crítico, ver sección 7** |
| Arriendo | $600.000/mes, ya pagado (compartido vivienda + negocio) |

---

## 3. QUÉ APORTA SEVELIN TECNOLOGÍA AL AUTOMOTRIZ

Esto es lo que **sí** debes inventariar y valorizar. Son los aportes del dueño al nuevo negocio.

### 3.1 Software Sevelin (POS/ERP propio) — **ACTIVO CENTRAL**

El dueño confirmó que el software **entra en la valorización como activo central**.

Módulos ya construidos y operativos:

| Módulo | Qué hace |
| :--- | :--- |
| Ventas y POS | Ventas, items, múltiples medios de pago, devoluciones, cambios de producto |
| Inventario | Productos, lotes, costeo, stock mínimo, ajustes auditados, mermas |
| **Bodega física** | Ubicaciones (estantes/cajas), producto-ubicación, propuestas de ubicación asistidas por IA |
| Compras | Compras, clasificaciones, ingresos de mercadería, plazos de devolución por proveedor |
| **Caja** | Cajas diarias, arqueos, movimientos, traspasos entre efectivo y banco, ajustes de saldo con justificación |
| **Integración SII** | RCV (resumen y documentos), sincronización, auditoría DTE, remanentes IVA (código 77), presentaciones F29 |
| Finanzas | Gastos fijos, gastos programados, inyecciones de capital, punto de equilibrio |
| **Órdenes de trabajo** | OT, repuestos por OT, fases de protocolo, sellos de garantía con S/N |
| Protocolos | Fases e insumos por tipo de trabajo |
| Catálogo técnico | 44 referencias de repuestos, 1.875 precios de reparación de celulares |
| Envíos | Costo real por despacho, km, sector, quién lo llevó |
| Web | Productos publicados, SEO, ofertas, precios mayoristas, textos editables sin tocar código |
| Salud del sistema | Registro de errores, panel de monitoreo |

**Por qué esto es ventaja competitiva real en el rubro automotriz de Arica:**
- Ningún lubricentro o taller pequeño de la región tiene trazabilidad de costo por servicio, control de caja auditado ni integración SII automática.
- El módulo de **OT + protocolos + sellos de garantía** se adapta directamente a órdenes de trabajo automotrices.
- El módulo de **bodega con ubicaciones** resuelve el problema real del lubricentro: dónde está cada filtro.
- Permite ofrecer al cliente un **historial de mantención por vehículo** y recordatorios automáticos — algo que ningún competidor local hace.

**Tarea para ti:** valoriza este activo por costo de reposición (horas de desarrollo equivalentes a precio de mercado chileno) **y** evalúa su potencial como producto licenciable a otros talleres.

### 3.2 Activo fijo

⚠️ La tabla `activos_uso_interno` está **vacía** (0 filas). El activo fijo no está inventariado en el sistema.

**Tarea prioritaria:** levanta el inventario real de activo fijo preguntándole al dueño y registrándolo en esa tabla. Como mínimo:
- Equipos de computación y herramientas de electrónica del taller actual
- Mobiliario, vitrinas, estanterías
- Máquina de pago (arrendada, no es activo — es gasto)
- Cualquier herramienta automotriz ya adquirida
- Vehículo, si aplica

Sin este inventario no hay valorización defendible.

### 3.3 Otros aportes intangibles

| Aporte | Nota |
| :--- | :--- |
| **Marca Sevelin** | Ya existe, con sellos de garantía propios y presencia web |
| **Base de clientes** | Clientes de electrónica/computación → mercado cruzado natural para electrónica automotriz |
| **Capacidad técnica en electrónica** | Es la ventaja diferencial: ningún lubricentro de Arica instala radios Android bien |
| **Local con flujo** | Arriendo ya pagado; el costo marginal del automotriz es cero |
| **Canal web y redes** | Tienda en línea operativa, publicación en Facebook/Instagram |
| **Giro y documentos tributarios** | Factura exenta ya autorizada, lo que acelera el arranque |

---

## 4. CAPITAL DISPONIBLE Y RECOMENDACIÓN SOBRE EL SOCIO

### Lo que hay

El dueño declara **$1.000.000 a $2.000.000** de capital propio disponible para esta etapa.

### Recomendación que debes evaluar y respaldar con números

**Recomendación: NO levantar capital de socios todavía. Arrancar con capital propio y levantar después de validar.**

Razones a verificar con los datos del sistema:

1. **El lubricentro cabe en su capital.** El arranque mínimo viable (equipamiento crítico + stock inicial de aceite y filtros) está estimado en **$900.000 – $1.200.000**. Está dentro de lo que tiene.
2. **La posición negociadora hoy es débil.** Sin historial del automotriz y con los compromisos financieros vigentes de Sevelin Tecnología, cualquier socio pedirá una participación desproporcionada. Levantar después de 3 meses de números reales cambia la ecuación a su favor.
3. **Riesgo para el socio.** Si el socio es cercano (lo más probable en este contexto), entrar antes de validar demanda pone en riesgo la relación además del dinero.
4. **La fase 2 se autofinancia.** La electrónica automotriz tiene margen alto y stock bajo: se puede arrancar con 5–10 unidades importadas.

**Cuándo sí levantar capital:** mes 4–6, con 3 meses de P&L del automotriz, para financiar detailing, pintura y copia de llaves simultáneamente. Ahí el monto tiene sentido entre **$4M y $8M** y la valorización es defendible.

**Tarea para ti:** valida o refuta esta recomendación con los números reales. Si los datos dicen otra cosa, dilo.

---

## 5. PLAN POR FASES — DATOS YA LEVANTADOS

### Fase 1 — Lubricentro

**Inversión estimada:** $1.177.000 (mínimo) a $2.557.000 (holgado). Arranque ajustado posible desde ~$900.000.

**Equipamiento crítico (en orden de compra):**
1. Bandeja recolectora + contenedor de aceite usado — $65.000
2. Par de rampas (capacidad 2 ton, ángulo ≤17°) — $60.000
3. Set de llaves de filtro (cadena, correa, pinza 60–120 mm) — $20.000
4. Juego de dados y llaves (100–150 pzs, cromo vanadio) — $60.000
5. Torquímetro 3/8" (5–60 Nm) — $30.000
6. Gata lagarto (2,5–3 ton, entrada ≤135 mm) + burros 3 ton — $100.000
7. Jarra medidora y embudos rotulados — $10.000
8. Lámpara LED de inspección (≥500 lúmenes, magnética) — $12.000
9. Extintores ABC + kit antiderrame — $55.000

Subtotal operativo mínimo: **~$412.000** (ya permite abrir y cobrar).

**Decisión tomada:** rampas + gata + burros. **NO construir fosa** en fase 1 (obra fija, no reversible, riesgo de espacio confinado, y bloqueada hasta tener el CIP).

**Stock de aceite — 6 SKUs cubren ~85% del parque:**

| # | Producto | Especificación | Cubre | Prioridad |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 5W-30 sintético | API SN/SP, ACEA A5/B5 o C3 | Japoneses y coreanos 2010+ — **~45% de ventas** | Crítica |
| 2 | 10W-40 semisintético | API SL/SN | Autos 2000–2012 y alto km | Crítica |
| 3 | 15W-40 mineral | API CI-4/SL | Antiguos, diésel livianos sin DPF | Alta |
| 4 | 5W-40 sintético | API SN, ACEA A3/B4 | Europeos, diésel sin DPF | Alta |
| 5 | 0W-20 sintético | API SN/SP, ILSAC GF-5/GF-6 | Toyota/Honda/Mazda 2016+, híbridos | Media |
| 6 | 5W-30 C3 low SAPS | ACEA C3 + aprobación OEM | **Diésel con DPF — error caro si se equivoca** | Media |

Más: ATF multivehículo, 75W-90 GL-4/GL-5, DOT 4, refrigerante verde y rosado, agua destilada.

**Estrategia de filtros: NO tener stock.** Hay miles de referencias. Se piden por encargo los primeros 3 meses, se registra cada uno usado, y al mes 3 se compra stock solo de las 15–25 referencias que se repitieron. Stock inicial mínimo: filtros de Suzuki Swift/Alto, Hyundai Accent/Grand i10, Kia Rio/Morning, Chevrolet Sail/Spark, Toyota Yaris/Corolla, Nissan V16/March → ~$80.000–$150.000.

**Escáner recomendado: Launch CRP123X.** Motor, transmisión, ABS y SRS, **sin licencias por marca**, con reset de luz de mantención (la función que más se usa). **Descartado el ThinkDiag Mini**: cobra licencia por marca y por año (~US$40 c/u), lo que en un taller multimarca supera $300.000 anuales recurrentes.

### Fase 2 — Electrónica automotriz (arranca junto con fase 1)

| Producto | Costo importado | Precio instalado | Margen |
| :--- | :--- | :--- | :--- |
| Radio Android 2 DIN | $45.000–$75.000 | $130.000–$220.000 | $85.000–$145.000 |
| Cámara de retroceso | $8.000–$18.000 | $35.000–$60.000 | $27.000–$42.000 |
| Sensores de retroceso | $12.000–$25.000 | $45.000–$80.000 | $33.000–$55.000 |
| Alarma con control | $15.000–$30.000 | $55.000–$95.000 | $40.000–$65.000 |
| GPS rastreador | $15.000–$30.000 | $50.000–$90.000 | $35.000–$60.000 |
| Parlantes | $12.000–$35.000 | $45.000–$100.000 | $33.000–$65.000 |
| Kit luces LED | $8.000–$20.000 | $30.000–$55.000 | $22.000–$35.000 |

Stock inicial sugerido: $150.000–$400.000 (5–10 unidades de los más vendidos).
Herramientas específicas: pry tools de tapicería, crimpeadora, pelacables, arneses adaptadores por marca.

**Insight central del modelo de negocio:**
> El lubricentro no es el negocio: es el **generador de tráfico**. Un cambio de aceite deja $12.000–$35.000 en 25 minutos. Una radio Android deja $85.000–$145.000 en 90 minutos. El cliente que entra a cambiar aceite está 25 minutos detenido con el capó abierto — es el mejor momento de venta cruzada que existe. **El aceite trae al cliente; la electrónica paga las cuentas.**

### Fases posteriores — resumen

| Fase | Inversión | Nota |
| :--- | :--- | :--- |
| Mecánica liviana | $406.000–$1.010.000 | Frenos, batería, suspensión, diagnóstico. **No** embragues, cajas, culatas ni distribución (bloquean el taller) |
| Detailing | $400.000–$900.000 | Pulidora DA (no rotativa), extractora de tapiz, hidrolavadora. Insumos ~$45.000/auto |
| Pintura | $290.000–$555.000 (parcial) | Retoque → parcial → completa. Compresor ≥100 L para pintura continua |
| **Copia de llaves** | **Sin analizar** | ⚠️ Requiere estudio propio: máquina duplicadora, programador de transponder, inversión y marco legal |
| Compraventa de autos | $4.174.340 por unidad | Analizada a fondo, postergada. Ver sección 9 |

### Precios de venta de referencia (Arica, oct-2026)

| Servicio | Precio | Costo insumo | Margen | Tiempo |
| :--- | :--- | :--- | :--- | :--- |
| Aceite mineral + filtro | $28.000–$38.000 | $14.000–$20.000 | $12.000–$18.000 | 25 min |
| Aceite semisintético + filtro | $38.000–$52.000 | $20.000–$28.000 | $16.000–$24.000 | 25 min |
| Aceite sintético + filtro | $55.000–$80.000 | $30.000–$45.000 | $22.000–$35.000 | 25 min |
| Pastillas delanteras | $45.000–$75.000 | $18.000–$35.000 | $27.000–$40.000 | 45 min |
| Pastillas + discos | $90.000–$160.000 | $45.000–$90.000 | $45.000–$70.000 | 70 min |
| Batería (con venta) | $75.000–$140.000 | $50.000–$95.000 | $25.000–$45.000 | 15 min |
| Diagnóstico con escáner | $15.000–$25.000 | $0 | $15.000–$25.000 | 20 min |
| Detailing completo | $70.000–$140.000 | $45.000 | $25.000–$95.000 | 4–6 h |
| Restauración de faros | $25.000–$40.000 | $6.000 | $19.000–$34.000 | 60 min |
| Radio Android instalada | $130.000–$220.000 | $45.000–$75.000 | $85.000–$145.000 | 90 min |

### Proyección orientativa de arranque

| Período | Servicios/mes | Margen bruto |
| :--- | :--- | :--- |
| Mes 1 | 15–30 | $300.000–$600.000 |
| Mes 2–3 | 40–70 | $800.000–$1.400.000 |
| Mes 4–6 | 70–120 | $1.400.000–$2.800.000 |

**Tarea para ti:** reconstruye esta proyección con supuestos explícitos y escenarios (pesimista/base/optimista), y calcula punto de equilibrio con los costos fijos **prorrateados** que correspondan al automotriz.

---

## 6. MARCO NORMATIVO (ya investigado, verificado a oct-2026)

### 6.1 Aceite usado = residuo peligroso

- Rige el **DS 148/2003 del Ministerio de Salud**.
- **Plan de Manejo formal** solo se exige sobre **12 toneladas/año** de residuo peligroso no tóxico agudo → un lubricentro que parte queda **por debajo del umbral**, no necesita plan formal.
- Obligaciones básicas que **sí** aplican y se fiscalizan:
  - Piso impermeable y **contención del 110%** del envase mayor
  - Rotulación: nombre del residuo, código de peligrosidad, fecha de inicio de acumulación, generador
  - Almacenamiento máximo **6 meses** (extensible a 12 con autorización)
  - Entrega **solo a gestor con autorización sanitaria vigente** — guardar certificado de disposición
  - Registro interno de entradas y salidas
  - Declaración anual en **SIDREP antes del 31 de marzo**
  - Separación por incompatibilidad (aceite ≠ refrigerante ≠ líquido de frenos)

### 6.2 Ley REP de aceites lubricantes — **oportunidad con fecha**

- Decreto de metas publicado en el Diario Oficial el **19-11-2024**, con dos años de gracia.
- **Obligaciones rigen desde el 11 de noviembre de 2026** (en semanas).
- Los obligados son fabricantes e importadores, con metas de recolección desde 50% hasta 90% en 12 años.
- **Talleres y lubricentros son puntos de recolección, y el retiro del aceite usado es SIN COSTO para ellos.**
- **Acción:** preguntar al distribuidor de aceite a qué sistema de gestión está adherido y cómo se coordina el retiro en Arica.

### 6.3 Permisos

| Trámite | Dónde | Prioridad |
| :--- | :--- | :--- |
| **Certificado de Informaciones Previas (CIP)** | DOM, Municipalidad de Arica | 🔴 **PRIMERO — define viabilidad** |
| Ampliación de giro (F4415) | SII, en línea, gratis | Semana 1 |
| Patente comercial | Rentas y Patentes, Arica | Tras CIP |
| Autorización sanitaria | SEREMI de Salud Arica y Parinacota | Tras CIP — el más lento |
| Calificación de actividad | SEREMI de Salud | Si lo pide la DOM |
| Informe de bomberos | Bomberos de Arica | Según exija el municipio |

### 6.4 Giros a agregar en el SII

| Código | Actividad | Prioridad |
| :--- | :--- | :--- |
| **452002** | Mantenimiento y reparación de vehículos automotores | Esencial |
| **453000** | Venta de partes, piezas y accesorios para vehículos | Esencial |
| **452001** | Servicio de lavado de vehículos (cubre detailing) | Alta |
| 451002 | Venta al por menor de vehículos (incluye compraventa) | Solo si retoma autos |

### 6.5 Distribución de lubricantes en Chile

No se compra directo a la marca. Cadena: marca → macrodistribuidor → distribuidor regional → taller.

| Marca | Macrodistribuidor | Vía de contacto |
| :--- | :--- | :--- |
| Mobil | **Copec** | Canal lubricantes Copec, pedir distribuidor de Arica y Parinacota |
| Shell | **Enex** | hablemos@enex.cl · 600 350 2000 |
| Liqui Moly | **Liqui Moly Chile SpA** | Portal B2B `b2b.liquimoly.cl` · WhatsApp +56 9 3864 4605 — **la vía más directa** |
| Castrol, Total, Valvoline, Petrobras | Distribuidores independientes | Representante zona norte, varios operan desde Iquique |
| Mannol, Wolver, Ravenol | Importadores directos | Gama económica con buena calidad |

**Sobre el material POP (displays de marca):** no requiere ser "distribuidor autorizado". Se obtiene mediante acuerdo comercial con el distribuidor —compromiso de compra mensual o visibilidad preferente— a cambio de señalética, exhibidores, pendones, uniformes y a veces bomba dosificadora en comodato. La pregunta que abre esa puerta: *"¿qué apoyo de marca entregan a un punto de venta nuevo con buena visibilidad en avenida?"*

---

## 7. ⚠️ RIESGO CRÍTICO SIN RESOLVER

**El uso de suelo de San Rafael 896 NO está verificado.**

Un lubricentro es actividad de impacto similar al industrial. Si el Plan Regulador no la admite en esa dirección, el proyecto no es viable ahí. El **CIP** lo resuelve en días y por bajo costo.

**Esto debe aparecer en la propuesta a socios como riesgo declarado, o resolverse antes de presentarla.** Presentar una propuesta de inversión con el uso de suelo sin verificar es un problema de transparencia con el socio.

Escenarios si el CIP sale desfavorable:
1. Arrendar local pequeño con uso de suelo compatible en la misma zona
2. Servicio a domicilio (menos requisitos de instalación; el manejo del residuo sigue siendo responsabilidad propia)
3. Asociarse con una vulcanización vecina que ya tenga patente y espacio, operando dentro de su local a cambio de un porcentaje

---

## 8. ESTRUCTURA PARA EL SOCIO — FIGURA RECOMENDADA

Dado que el dueño opera como **MEF (persona natural)**, no puede emitir acciones. Una MEF no tiene participación societaria que ceder.

### Figura recomendada: Asociación o Cuentas en Participación

Regulada en el **Código de Comercio chileno (Arts. 507–511)**. Características:

- Es un **contrato**, no una sociedad: sin personalidad jurídica, sin razón social, sin patrimonio propio
- El **gestor** (Carlos) opera a su nombre y es el único que aparece frente a terceros
- El **partícipe** (socio) aporta capital y participa de utilidades y pérdidas según lo pactado
- Permite delimitar expresamente que la participación es **sobre el resultado del negocio automotriz**, lo que resuelve el requerimiento de separación de finanzas

**Requisitos que el SII exige para reconocerlo** (Oficio N° 1709 de 2017, Circular N° 29 de 1999):
- **Pacto expreso en el contrato** sobre cómo se distribuyen resultados y pérdidas — un borrador sin esa distribución no basta
- **Razonabilidad**: la distribución debe ser coherente con actividades, riesgos y activos comprometidos por cada parte
- **Acreditación**: se prueba con los registros contables del gestor más escritura pública que fije aportes y reparto
- Tanto gestor como partícipe son contribuyentes de Primera Categoría y Global Complementario según corresponda

**Recomendación:** escritura pública, no documento privado. El costo es menor y es lo que el SII exige para acreditar.

### Alternativas a evaluar en el informe

| Figura | Cuándo conviene |
| :--- | :--- |
| **Préstamo privado con retorno pactado** | Si el socio no quiere riesgo operacional. Es deuda, no sociedad. Más simple, menos upside para el socio |
| **Cuentas en participación** | **Recomendada.** Socio capitalista con participación en resultados, sin constituir sociedad |
| **SpA con el socio** | A 6–12 meses, cuando el automotriz tenga P&L propio. Más limpio para escalar y para vender participación |
| **Aporte en especie** | Si el socio aporta local, herramientas o vehículo en vez de efectivo. Requiere valorizar el aporte |

---

## 9. LO QUE YA SE ANALIZÓ Y SE POSTERGÓ: COMPRAVENTA DE AUTOS

Se estudió a fondo y se postergó a favor del lubricentro. Conclusiones que siguen siendo válidas y que pueden reactivarse en fase 7:

- **La venta de vehículos usados está EXENTA de IVA** (DL 825, Art. 12 letra A N°1). El SII lo confirmó para autos adquiridos para reventa. El dueño ya tiene factura exenta autorizada.
- **No usar poder notarial ni contrato abierto** para evitar poner el auto a su nombre: no ahorra impuesto (el SII grava la operación real), quita deducciones, y tiene riesgos civiles (mandato revocable, se extingue con la muerte del mandante, el auto sigue embargable por deudas del titular). Además castiga el precio de venta.
- **Régimen ZOFRI:** comprar solo vehículos **liberados**. Los de zona franca solo circulan en Arica y Parinacota, Tarapacá y Magallanes, y además pueden quedar **fuera de la exención de IVA** si no pagaron impuesto al internarse.
- Números por unidad: inversión $4.174.340 → venta objetivo $4.700.000 → utilidad bruta ~$525.660, ciclo 30–40 días.
- **Por qué se postergó:** inmoviliza $3,5–4M en un solo activo por 30–45 días, sin recurrencia de cliente, mientras el lubricentro genera flujo diario con capital de trabajo bajo.

---

## 10. LO QUE DEBES PRODUCIR

### 10.1 Inventario y valorización de aportes

1. **Levanta el activo fijo real** (la tabla `activos_uso_interno` está vacía) y regístralo.
2. **Valoriza el software Sevelin**: costo de reposición por horas de desarrollo a precio de mercado chileno, módulo por módulo. Evalúa además su potencial como producto licenciable a otros talleres.
3. **Valoriza los intangibles**: marca, base de clientes, canal web, know-how técnico.
4. **Prorratea el local**: qué fracción del arriendo de $600.000 corresponde razonablemente al automotriz.

### 10.2 Modelo financiero del automotriz (separado)

5. **P&L proyectado a 24 meses**, con escenarios pesimista / base / optimista y **supuestos explícitos**.
6. **Flujo de caja mensual**, mostrando el peor mes de caja y cuánto capital de trabajo se necesita para atravesarlo.
7. **Punto de equilibrio** en número de servicios/mes, con costos fijos prorrateados del automotriz únicamente.
8. **Inversión por fase** y qué dispara el paso a la siguiente (regla: 3 meses seguidos cubriendo costos propios).
9. **Retorno sobre inversión** y período de recuperación por fase.

### 10.3 Valorización de Sevelin Automotriz

10. **Valor actual** del emprendimiento (pre-operación): hoy es principalmente el valor de los aportes, no de un negocio en marcha. **Sé honesto: un negocio sin operar vale poco.**
11. **Valor proyectado** a 12 y 24 meses bajo cada escenario, con método explícito (múltiplo de EBITDA, flujo descontado, o valor de activos + goodwill proyectado — justifica cuál usas y por qué).
12. **Plusvalía del sector**: investiga el mercado de servicios automotrices en Arica — número de lubricentros y talleres, parque vehicular regional, crecimiento, y qué múltiplos se pagan por este tipo de negocio en Chile.

### 10.4 Propuesta de inversión

13. **Documento para el socio**, que incluya:
    - Qué es el negocio y por qué esta ubicación
    - Qué aporta el dueño (valorizado) y qué se pide al socio
    - Estructura legal propuesta (cuentas en participación)
    - Uso específico de los fondos
    - Proyecciones con supuestos visibles
    - **Riesgos declarados**, incluyendo el uso de suelo sin verificar y la responsabilidad patrimonial compartida de la MEF
    - Condiciones de retorno y de salida
14. **Define el reparto**: qué porcentaje de utilidades por qué monto, justificado con la valorización. No un número al azar.

### 10.5 Implementación en el sistema

15. **Centro de costo separado** para el automotriz en el POS, con su propio P&L desde el día uno.
16. **Adaptación del módulo OT** a órdenes de trabajo automotrices: vehículo (patente, marca, modelo, año, motor), kilometraje, servicios realizados, repuestos, próxima mantención.
17. **Historial por vehículo** y recordatorio automático de próximo cambio según km — es la función que construye recurrencia y que ningún competidor local tiene.
18. **Catálogo de servicios automotrices** con precio, tiempo estimado e insumos, siguiendo el modelo de `protocolos` y `protocolo_fases` que ya existe.
19. **Registro de aceite usado** para cumplir DS 148: entradas, salidas, gestor, certificados.

---

## 11. RESTRICCIONES Y ADVERTENCIAS

🔴 **No mezcles las finanzas de Sevelin Tecnología con las del automotriz.** Es la regla número uno de este encargo.

🔴 **No presentes proyecciones sin supuestos explícitos.** Cada número debe poder rastrearse a un supuesto declarado y discutible.

🔴 **No infles la valorización.** Un emprendimiento sin operar vale poco, y presentarlo de otra forma destruye la credibilidad frente al socio y la relación personal si el socio es cercano. Si la conclusión honesta es "todavía no conviene levantar capital", dilo.

🟡 **Marca claramente qué es dato real del sistema y qué es estimación tuya.** El dueño va a tomar decisiones con esto.

🟡 **El uso de suelo está sin verificar.** Toda proyección es condicional a eso. Dilo en cada documento.

🟡 **Verifica con contador** antes de dar por cerrada cualquier recomendación tributaria o de estructura societaria. Este briefing orienta, no reemplaza asesoría.

🟢 **Los precios de este documento son referenciales a octubre de 2026** y se mueven. Valida antes de usarlos como base de un compromiso.

---

## 12. PREGUNTAS ABIERTAS QUE DEBES RESOLVER

1. ¿Cuál es el inventario real de activo fijo? (no está en el sistema)
2. ¿Quién es el socio potencial y qué relación tiene con el dueño? (cambia la estructura recomendada)
3. ¿El socio aportaría solo capital, o también trabajo o activos?
4. ¿Cuál es el estado del CIP?
5. ¿Qué parte del inmueble de San Rafael 896 se destina al automotriz? (define el prorrateo del arriendo)
6. ¿Copia de llaves requiere estudio propio? (no analizado: máquina duplicadora, programador de transponder, inversión, marco legal)
7. ¿Hay capacidad de atención real? El dueño opera con apoyo limitado — ¿quién atiende el lubricentro mientras él hace electrónica?

---

*Documento generado el 17 de octubre de 2026. Fuentes normativas: DS 148/2003 MINSAL; Decreto de metas Ley REP aceites lubricantes (D.O. 19-11-2024, vigencia 11-11-2026); DL 825 Art. 12 letra A N°1; Código de Comercio Arts. 507-511; Oficio SII N° 1709 de 2017 y Circular N° 29 de 1999; códigos de actividad económica SII.*
