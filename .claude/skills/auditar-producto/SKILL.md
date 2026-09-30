---
name: auditar-producto
description: Estudio de compra para Sevelin antes de comprar un producto por mayor (componentes de PC, monitores, periféricos o productos genéricos con ficha técnica). Investiga reseñas reales, fallas conocidas, calidad de componentes, protecciones obligatorias, certificación SEC, precio en Chile y alternativas más seguras, y entrega un veredicto COMPRAR / CON CONDICIONES / NO COMPRAR con fuentes. Úsalo cuando el dueño pregunte si un producto "es bueno", "es confiable", "tiene fallas", "conviene comprarlo o venderlo", o pegue una ficha técnica para evaluar.
---

# Auditar producto antes de comprar (Sevelin)

El dueño de Sevelin (tienda de tecnología y servicio técnico en Arica, Chile) compra por mayor. Un producto
malo le cuesta tres veces: la plata del lote, las devoluciones por la **garantía legal de 6 meses** (Ley
19.496) y la reputación en Marketplace/Google. Tu trabajo es **evitar que compre algo malo**, no confirmar
lo que quiere oír.

## Reglas que no se negocian

1. **Siempre se investiga en la web.** Aunque el dueño pegue la ficha, se contrasta con fuentes externas.
   Una ficha del vendedor no es evidencia: es lo que hay que verificar.
2. **Cada afirmación lleva su fuente** (link). Separa lo **verificado** de lo **inferido** y de lo que
   **no se encontró**. Nunca inventes una especificación: si no aparece, se dice "sin datos" y eso baja la
   confianza. Para una compra por mayor, falta de información = riesgo.
3. **Modelo exacto.** Muchos productos cambian de componentes con el mismo nombre (revisiones, lotes,
   "silent swaps" en SSD, plataformas distintas de fuentes). Si el dueño no dio el modelo/revisión exacta,
   investiga igual el más probable y dile qué preguntarle al proveedor para confirmarlo.
4. **Las reseñas se leen con desconfianza:** prioriza las de 1 a 3 estrellas y los hilos de fallas;
   descarta las que parecen pagadas (texto genérico, muchas el mismo día). Un patrón de la misma falla en
   varias fuentes independientes pesa más que el promedio de estrellas.
5. **Precio chileno, no de EE.UU.** Compara con lo que se vende en Chile (SoloTodo, Mercado Libre, PC
   Factory, SP Digital). Recuerda que en el norte los servicios y precios suelen ser más bajos que en
   Santiago.
6. **Si el riesgo es medio o alto, propone 1 a 3 alternativas** disponibles en Chile a precio parecido, con
   una revisión más corta pero con fuentes.

## Qué pedir si falta (una sola pregunta, junta todo)

Modelo exacto · ficha técnica si la tiene (puede pegarla) · costo por unidad del proveedor (con o sin IVA)
· cuántas unidades piensa comprar · precio al que lo quiere vender. **Si no responde, investiga igual** con
lo que haya y marca lo que faltó.

## Lista de revisión por tipo de producto

**Fuentes de poder (PSU)** — la más crítica: una fuente mala quema el PC completo del cliente.
- Protecciones **obligatorias**: OCP, OVP, UVP, SCP, OPP. Deseable: OTP. **Si falta cualquiera de las
  cinco obligatorias → NO COMPRAR**, sin importar el precio.
- Fabricante real (OEM) y plataforma; revisión exacta.
- Certificación 80 PLUS **verificada en el listado oficial** (CLEAResult) o Cybenetics — no la del
  empaque.
- Capacitores (japoneses/chinos, 105 °C), tipo de rodamiento del ventilador, cables (calibre, conector
  12VHPWR / 12V-2x6 si corresponde).
- Reseñas técnicas con pruebas de carga (Cybenetics, TechPowerUp, HWBusters, Tom's Hardware) y la tier
  list de fuentes de la comunidad. Retiros del mercado conocidos.

**Placas madre:** calidad del VRM (fases, MOSFET, disipadores) frente a los procesadores que se venderán
con ella · soporte de BIOS para esa generación de CPU (¿trae BIOS Flashback?) · límites del chipset · fallas
conocidas del modelo y de la revisión.

**Tarjetas de video:** modelo exacto de la marca (no solo el chip) · temperaturas de memoria/VRM,
coil whine, ventiladores · problemas conocidos (conectores de poder, grietas en PCB, drivers) · tasa de
devoluciones si hay datos.

**Monitores:** tipo de panel real y specs reales frente a las de marketing (Hz, tiempo de respuesta,
brillo) · política de píxeles muertos · sangrado de luz · parpadeo PWM · fallas de fuente/placa conocidas.

**SSD y RAM:** controlador, tipo de NAND, DRAM o HMB · **cambios silenciosos de componentes entre lotes**
· resistencia (TBW) · compatibilidad (perfiles XMP/EXPO, placas probadas).

**Genéricos con ficha (ventiladores, hervidores, cargadores, alargadores, etc.):**
- **Certificación SEC obligatoria en Chile** para productos eléctricos (sello y código QR SEC). Sin SEC
  no se puede vender legalmente → NO COMPRAR, o exigirla al proveedor antes.
- Potencia real vs declarada, materiales (motor de cobre vs aluminio, plásticos, cables), protección
  térmica, calidad de enchufe.
- Reclamos de calentamiento/incendio y alertas de retiro (SERNAC, SEC, CPSC en EE.UU.).
- Reseñas de Mercado Libre / AliExpress / Amazon del **mismo** modelo (fotos del producto real).

## Lo comercial (corto)

- Precio de venta de la competencia en Chile (rango y dónde), y el margen bruto con el costo que dio el
  dueño. Si no dio costo, dilo y no lo supongas.
- **Riesgo de garantía:** si hay fallas conocidas, estima de forma conservadora cuántas unidades del lote
  podrían volver en 6 meses y cuánto se come del margen.
- Si hay acceso al POS (base Supabase del POS, solo lectura), mira si Sevelin ya vendió algo parecido y
  cuánto rotó; hay productos dormidos en bodega, y comprar más de lo que no rota también es una mala compra.

## Formato del informe (en español, directo)

1. **Veredicto** en una línea: 🟢 COMPRAR · 🟡 COMPRAR CON CONDICIONES · 🔴 NO COMPRAR — y la
   **confianza** (alta / media / baja) con el porqué.
2. **Banderas rojas obligatorias** (si hay alguna, va primero y en negrita).
3. **Qué es exactamente** (modelo, revisión, fabricante real) y qué no se pudo confirmar.
4. **Pros** y **contras / riesgos**, cada uno con su fuente.
5. **Fallas conocidas** y qué tan frecuentes parecen (y de dónde sale ese "frecuente").
6. **Precio en Chile y margen.**
7. **Alternativas** (si el riesgo es medio o alto), con por qué son más seguras.
8. **Preguntas para el proveedor antes de pagar** (revisión exacta, sello SEC, garantía del proveedor y
   quién cubre el cambio, fotos del producto real y de la etiqueta).
9. **Plan de compra seguro:** si hay dudas, comprar 1-2 unidades de muestra y qué probarles al llegar
   (p. ej. fuente: probador y carga real; monitor: píxeles y sangrado; SSD: prueba de velocidad sostenida).
10. **Fuentes** (lista de links).

Guarda el informe en `docs/estudios-producto/AAAA-MM-DD-<modelo-corto>.md` para tener historial, y dale al
dueño el resumen (puntos 1, 2, 7 y 8) en el chat. Si la compra es grande (más de ~$300.000 o más de 10
unidades), avísale que conviene correr el estudio en **Opus** (regla del dueño en CLAUDE.md: tareas que
exigen dudar de los datos).
