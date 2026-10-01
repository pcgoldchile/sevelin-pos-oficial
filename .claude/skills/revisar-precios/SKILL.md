---
name: revisar-precios
model: opus
description: Revisión de precios de Sevelin. Lee la base del POS sin modificarla, marca productos con pérdida o margen flaco, compara con el mercado chileno y propone precios normales y mayoristas para que el dueño apruebe. Úsalo cuando el dueño pida "revisa mis precios", "¿estoy vendiendo muy barato?", "propón precios mayoristas", "¿a cuánto vendo esto?" o quiera auditar márgenes. Nunca cambia un precio sin su OK.
---

# Revisar precios (Sevelin)

El dueño de Sevelin (tecnología y servicio técnico, Arica) cree que vende muy barato y quiere precios
**justos**: que le dejen margen sano sin quedar fuera del mercado de Arica, y que el precio normal y el
mayorista convivan. Tu trabajo es **proponer con datos**; él aprueba. Un número mal leído acá cuesta plata.

## Reglas que no se negocian

1. **Solo lectura.** No se cambia ningún precio, costo ni producto sin un "ok" explícito del dueño a esa
   lista concreta. La propuesta se guarda en `docs/estudios-precios/AAAA-MM-DD-*.md`.
2. **El costo que manda es el mayor conocido**: el de la ficha, el de la última compra
   (`ingresos_mercaderia`) y el de los lotes con unidades (`producto_lotes`). Registrar una compra más cara
   NO actualiza `productos.costo_unitario`, así que mirar solo la ficha subestima el costo.
3. **Costos y precios son con IVA.** Margen = (precio − costo) / precio. Si la compra fue sin factura, el
   margen real es menor (ese IVA no se recupera): por eso el piso mayorista es 20%.
4. **Antes de proponer una subida, mira el mercado.** Si las tiendas grandes venden el mismo producto al
   costo del dueño o menos, **el problema es el costo de compra, no el precio**: no se propone subir, se
   propone comprar mejor, no reponer o venderlo por encargo. Esto ya pasó (01-10-2026) con Master-G,
   Sony, Kingston, fuentes y monitores.
5. **Cada referencia lleva su fuente (link) y fecha.** Usa el rango de precios, no la oferta de un día.
   Las tiendas en línea son de Santiago: di siempre que la competencia local de Arica no la mediste.
6. **No inventes.** Sin referencia de mercado se dice "sin referencia" y la subida va "a prueba".
7. Los servicios, encargos y productos "precio a consultar" quedan fuera.

## Pasos

1. **Datos.** Corre `consulta.sql` (de esta carpeta) contra la base del POS:
   `npx supabase db query --linked --file .claude/skills/revisar-precios/consulta.sql --output json`
   Trae cada producto con stock, costo de referencia, precio, unidades y monto vendidos, y última venta.
2. **Panorama.** Margen ponderado sobre lo vendido y cuánto de la venta sale bajo 15% y bajo 25%.
3. **Clasifica cada producto:**
   - **Pérdida** (precio ≤ costo): urgente, va primero.
   - **Margen flaco** (< 15%, o < 25% en productos de menos de $30.000).
   - **Sano**: se deja como está.
   - **Sin costo cargado**: no se puede evaluar; se lista para que el dueño lo cargue.
   - **Costo raro**: cuando el costo cargado no calza con el mercado (posible error de carga).
4. **Mercado**, solo para los de margen flaco y los más vendidos: SoloTodo, tiendas grandes, tienda
   oficial de la marca y Mercado Libre. Anota rango y fuente.
5. **Propuesta de precio normal.** Solo se sube si el mercado lo permite o si el producto ya rota con
   margen bajo y no tiene un precio de referencia claro. Subidas cortas, en números redondos (el dueño
   usa miles cerrados). Di cuánta plata significa si se repite la venta del período.
6. **Propuesta mayorista** (sql/76; el piso lo hace cumplir la base):
   - Rebaja = un tercio del margen, con tope de 20% del precio normal.
   - Nunca bajo `ceil(costo / 0,80)` (20% de margen). Si no cabe una rebaja real, el producto queda fuera.
   - Cantidad mínima: 3 u. desde $8.000 · 5 u. entre $3.000 y $7.999 · 10 u. bajo $3.000.
   - Solo productos con stock para al menos una compra mayorista.
   - Si el mayorista queda más caro que comprar en una tienda de Santiago, no es un mayorista real: fuera.
7. **Entrega.** Tres tablas (problema de costo, subir precio normal, mayorista), los límites del estudio y
   las fuentes. En el chat, un resumen corto con las tablas que requieren decisión.
8. **Si el dueño aprueba**, aplica solo lo aprobado, de a un producto, por la API o con `update` sobre
   `productos` (el trigger sincroniza con la tienda), y verifica después: precio guardado, que
   `precio_mayorista` no quedó desactivado por la guardia (`mayorista_aviso`) y que llegó a la tienda
   (Página Web → Salud). Anota en `pendientes` lo que quedó aplicado.

## Contexto que no hay que redescubrir

- Canal real: Marketplace, WhatsApp y retiro presencial. El comprador mayorista esperado es un técnico o
  un cliente que lleva varias unidades, no un revendedor.
- Decisión del dueño (11-09-2026): crecer por servicio técnico y accesorios, no por monitores.
- El norte es más barato que Santiago en servicios; en productos, el envío a Arica (unos $5.000 a
  $10.000 y varios días) es la ventaja del local frente a una tienda en línea.
- Primera propuesta: `docs/estudios-precios/2026-10-01-propuesta-precios.md`.
