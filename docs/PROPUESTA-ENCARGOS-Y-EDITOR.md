# Propuestas de alcance: control de encargos (#53) y automatizaciones del editor (#54) — 02-10-2026

> Hechas por Claude a pedido del dueño. **Nada de esto está construido**: es para que elijas el alcance.
> Datos medidos en la base del POS (solo lectura) el 02-10-2026.

---

## #53 · Control de encargos en el POS

### Lo que ya existe

| Módulo | Qué hace | Uso real hoy |
|---|---|---|
| **Servicio Técnico → Abonos y Encargos** (`js/encargos.js`, sql/46) | Cliente, teléfono, descripción, producto del catálogo (opcional) y cantidad, monto total, **abonos** que entran a Finanzas, estado de **pago** (PENDIENTE / PARCIAL / PAGADO), "Entregar", y la venta que se crea sola al completar el pago. | **1 encargo** (el PC Gamer, PARCIAL) |
| **Productos → Agotados** (sql/55, v102) | Cada producto en stock 0 pide una decisión: "por llegar", "pasar a encargo", "archivar" o "dejar". | **27 agotados y ninguno decidido** |
| **Productos por encargo** (`es_pedido_encargo`) | Desde hoy (#52) se cotizan por WhatsApp en sevelin.cl. | 18 productos (tarjetas de video) |

**Lo que falta:** Abonos y Encargos lleva la **plata** del cliente, pero no el **proceso con el proveedor**.
No dice si ya confirmaste el precio, si ya lo pediste, si viene en camino o si llegó y hay que avisarle al
cliente. Y nada te recuerda los encargos que están esperando un paso tuyo.

### Lo que propongo: ampliar Abonos y Encargos, no un módulo nuevo

Un módulo aparte repetiría cliente, producto, cantidad y abonos, que ya funcionan y ya cuadran con Finanzas.

1. **La etapa del encargo**, aparte del estado de pago:
   `Cotizando → Confirmado con el proveedor → Pedido al proveedor → Llegó (avisar al cliente) → Entregado`,
   más `Cancelado` (el proveedor no lo tiene o el cliente desiste). Un botón por fila avanza a la etapa siguiente.
2. **De dónde nace**, que se calcula solo al crearlo con un producto del catálogo:
   - **Producto por encargo:** se piden todas las unidades.
   - **Agotado:** stock 0, se piden todas.
   - **Faltan unidades (lote):** hay 3 y el cliente quiere 10, se piden 7. Queda guardado "unidades a pedir".
3. **Datos del proveedor:** proveedor (texto), costo que te cotizó y fecha estimada de llegada.
4. **Por dónde se inicia:**
   - "Nuevo encargo" (el de siempre, con los campos nuevos).
   - Botón **"📦 Iniciar encargo"** en Productos → Agotados y en la ficha de un producto por encargo.
   - En la caja, cuando la cantidad pasa el stock: "Faltan 7 unidades: ¿crear encargo?".
5. **Aviso "N encargos pendientes"** en el encabezado, como los otros chips:
   - En rojo, si alguno llegó y el cliente no sabe, o si lleva más de 2 días en "Cotizando".
   - Lo ven tú y el trabajador, como Abonos y Encargos hoy.
6. **Cuando llega:**
   - Un botón **"Registrar la compra"** abre el ingreso de mercadería ya lleno. No suma stock solo: es tu regla de
     que nada mueva stock o plata sin tu clic.
   - Un botón **"Avisar por WhatsApp"** con el mensaje armado.

**Tamaño:** una migración nueva (columnas en `encargos`, idempotente), el servidor, la pantalla de Abonos y
Encargos, el chip y los dos botones de entrada. Una sesión, **Opus · Alto**.

**Fuera, por ahora:** que la consulta de WhatsApp de la tienda cree el encargo sola. Se puede después, cuando
veas cuántas llegan.

### Decide tú

1. ¿Amplío Abonos y Encargos como está arriba (recomendado), o prefieres un módulo aparte?
2. Al llegar el producto: ¿botón que abre el ingreso ya lleno (recomendado) o que sume el stock solo?
3. ¿El trabajador también puede avanzar etapas? Recomiendo que sí; borrar sigue siendo solo tuyo.

---

## #54 · Automatizaciones del editor de producto y aviso de margen en la caja

### Lo que ya existe

- **Ficha con IA** (botón o copiar el prompt): propone el **nombre** y ofrece el **SEO** en la misma ventana (v106).
  La publicación de Facebook es un botón aparte.
- **Margen a la vista** en Productos y en Mayoristas, con el mayor costo conocido (v105).
- **Complementos** ("Complementa tu compra"), que hoy se eligen a mano (v102).
- **Caja:** el admin ve la utilidad estimada de la línea; el trabajador no ve costos. **No hay ningún aviso
  cuando un precio deja poco margen.** Es justo por donde se va la plata: en los últimos 60 días, el 41% de la
  venta dejó menos de 15% (estudio del 02-10).

### Las cuatro piezas, en el orden que recomiendo

**A. Aviso en la caja bajo 15% de margen: primero, porque es la que mueve plata.** Solo POS, sin migración.
- **Cómo se calcula:** el margen sale en el servidor, con el mayor costo conocido.
  - El admin ve el % y el precio mínimo que llega a 15%.
  - El trabajador ve solo "este precio queda bajo el mínimo". Mostrarle el precio mínimo le diría el costo.
- **Al cobrar:** si hay líneas bajo 15%, pide confirmación.
- **Quedan fuera:** servicios, ítems escritos a mano sin producto (no tienen costo) y líneas a precio mayorista
  (tienen su propio piso de 20%).
- Diez monitores MSI a $110.000 en vez de $102.000 de promedio habrían sido $80.000 más.

**B. Precio sugerido en 990 al escribir el costo, con su mayorista.** Solo POS.
- **El precio:** costo ÷ (1 − margen objetivo de la familia), subido al siguiente 990.
- **El mayorista:** la misma regla de `/revisar-precios`:
  - se rebaja un tercio del margen, con tope de 20%;
  - nunca bajo el piso de 20%;
  - desde 3, 5 o 10 unidades según el precio.
- **Se sugiere con un botón "Usar", nunca se aplica solo.**
- Necesita una tabla de márgenes objetivo. Propuesta para que la corrijas, con el margen real de los últimos
  60 días al lado:

| Familia | Margen real 60 días | Objetivo propuesto |
|---|---:|---:|
| Adaptadores, cables y accesorios chicos | 36% a 61% | 45% |
| Hogar y estilo de vida | 37% | 40% |
| Power banks | 40% | 35% |
| Reacondicionados (PC) | 37% | 35% |
| Componentes PC | 25% | 25% |
| Gabinetes | 20% | 22% |
| Fuentes de poder | 15% | 20% |
| Monitores nuevos | 9% | 15% |

**C. Complementos sugeridos según la categoría.** Solo POS, chico, sin IA.
- Al crear un producto, propone los complementos que ya usan los productos de su misma categoría (por ejemplo,
  un monitor nuevo: adaptador HDMI a VGA, cable de poder y cable HDMI).
- Tú marcas cuáles van.

**D. IA: marca, categoría, condición, garantía y Facebook en la misma pasada.** Servidor y editor, el más grande.
- **Marca y categoría:**
  - El prompt pide, al final de la ficha, una línea con marca y categoría.
  - La categoría se elige de **tu lista real** de categorías.
  - La marca, **solo si aparece en la información que pegaste**, con la misma regla de no inventar de los
    prompts oficiales.
  - Funciona igual por los dos caminos (botón y copiar el prompt).
- **Condición y garantía:**
  - La condición sale del texto ("reacondicionado").
  - La garantía, de tu regla (6 meses), no de la IA.
- **Facebook en la misma pasada:** un solo prompt que devuelve la ficha y la publicación separadas.
  - **Riesgo:** la respuesta por API es más larga y puede rozar el tope de 60 s de Vercel (la trampa de la v78).
  - Por eso lo dejaría en el camino de copiar el prompt y, por API, como una segunda llamada después de aceptar
    la ficha.
- Todo llega como sugerencia con su casilla, como el nombre en la v106.
- **Peso y medidas no se tocan:** los cargas tú.

**Tamaño:** A y B, una sesión (**Opus · Alto**: es plata). C es chica. D, otra sesión.

### Decide tú

1. **Caja:** ¿solo aviso con confirmación (recomendado), o el trabajador necesita tu clave para vender bajo 15%,
   como en la entrega forzada de OT (v96)?
2. **La tabla de márgenes objetivo:** ¿la apruebas o la corriges?
3. **Facebook:** ¿en la misma pasada como está arriba, o lo dejas en su botón aparte?
