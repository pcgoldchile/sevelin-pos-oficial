# v120 a v122 — Facturas y notas de crédito, margen en vivo, y el paso a paso para revisar (04-10-2026)

Sesión en Opus · Extra. Continúa `docs/CHANGELOG-V118.md` (misma sesión). Pedido del dueño antes de cerrar: adjuntar
facturas, cuánto espacio ocupan, seguir las notas de crédito de los proveedores, ver el margen en vivo, precios
sugeridos (incluido el segundo mayorista), RUT del proveedor, si el PEPS sigue funcionando, paso a paso para revisar
un producto ya creado, saltar pasos, PEPS a la vista y proponer categoría con IA.

## Publicado

| Versión | Qué cambió | Commit | Migración |
|---|---|---|---|
| **v120** | RUT del proveedor y factura adjunta en la compra; seguimiento de notas de crédito recibidas. | POS `85f3f54` | `sql/85` (aplicada) |
| **v121** | Margen en vivo en la ficha y segundo precio mayorista sugerido. | POS `5935636` | no |
| **v122** | Paso a paso para revisar, saltar pasos, lotes junto a la compra, categoría con IA. | POS `95f478a` | no |

Verificado en producción: los ids nuevos están en `index.html`, `js/notas-credito.js` se sirve y las rutas nuevas
responden 401 sin sesión.

## Respuestas con datos reales (04-10-2026)

- **Espacio en Supabase.** Fotos de productos: 524 archivos, 20,3 MB (40 KB promedio). Documentos de gastos: 2
  archivos, 0,3 MB. Base de datos: 17,8 MB. El plan gratis de Supabase da 1 GB de archivos y 500 MB de base (no se
  comprobó en qué plan está la cuenta). Una factura en PDF del proveedor pesa cerca de 100 a 300 KB: 1.000 facturas son
  unos 200 MB. Una foto de celular sin achicar pesa 2 a 4 MB: conviene el PDF. El tope por archivo es 4 MB.
- **Notas de crédito recibidas.** El robot del SII tiene datos desde agosto de 2026. Hay 3: MercadoLibre Chile LTDA
  (14-09-2026, $35.990, y 14-08-2026, $114.190) y Falabella Retail S.A. (09-08-2026, $117.365). Entre las tres restaron
  $42.717 de crédito fiscal. Quedaron "sin revisar" en el panel nuevo.
- **PEPS.** Sigue funcionando: con la casilla marcada cada compra crea su capa (probado). Está apagado por defecto y solo
  2 productos lo usan, los dos descuadrados (pendiente #68).

## v120 · RUT del proveedor, factura adjunta y notas de crédito

- **RUT del proveedor** en "Más datos de la compra". El servidor valida el dígito verificador y lo guarda en el formato
  del SII (`77398220-1`). Se recuerda por proveedor (`proveedores_plazos.rut`) y se propone al escribir el nombre; la
  lista del campo Proveedor trae los que ya facturaron según el SII.
- **Factura adjunta** (PDF o foto, hasta 4 MB) en la compra: mismo bucket privado de los gastos (`compras-documentos`),
  se guarda la ruta y se firma un enlace al abrirla. En la lista de compras aparece "📎 Ver factura".
- **"Anotar el gasto" lleva la factura ya adjunta**: no se sube dos veces.
- **Aviso al escribir el proveedor:** si ya emitió notas de crédito, cuántas y por cuánto. Con el N° de factura, busca la
  factura en el Registro de Compras y muestra su total y su IVA, o dice que todavía no aparece (el POS se pone al día con
  el SII una vez al día).
- **Notas de crédito recibidas:** chip rojo en el encabezado cuando hay alguna sin revisar, y botón "🧾 Notas de crédito
  recibidas" en Finanzas → Gastos. Cada una se marca "La esperaba" o "No la esperaba" con una nota. Abajo, la tabla de
  quiénes las han hecho: facturas, notas, monto anulado y cuántas no se esperaban.
- Solo lectura del SII: el POS no acepta ni reclama nada. La revisión se guarda en `sii_rcv_documentos` y el robot no la
  pisa (su upsert no manda esas columnas).
- **Límite conocido:** el RCV no dice a qué factura anula cada nota de crédito; el panel muestra proveedor, folio, fecha
  y monto, y el cruce lo hace el dueño.

**Probado:** 22 comprobaciones contra el servidor con una base simulada (RUT válido, inválido y normalizado; rutas de
adjunto maliciosas; notas solo de compras; permisos; revisar y deshacer; factura en el SII). En la maqueta: chip, panel,
revisar, RUT propuesto, aviso, factura encontrada, adjunto, compra y gasto con el documento. **No probado:** subir un PDF
real al bucket de producción ni la respuesta del panel con los datos reales (se verificó por SQL que hay 3 sin revisar).

## v121 · Margen en vivo y precios sugeridos

- **Margen en vivo** bajo costo, precio y stock: al detalle, en la web, los dos escalones mayoristas y la oferta web,
  con la misma cuenta y los mismos colores de la lista de Productos (rojo bajo 15%, ámbar bajo 25%). Usa el mayor costo
  conocido. Si la ficha no tiene costo, usa el de la compra que se está escribiendo.
- **Precios sugeridos:** el recuadro ahora propone precio al detalle, primer mayorista y **segundo mayorista**, cada uno
  con su botón "Usar", más "Usar todo lo sugerido". También aparece en un producto nuevo con el costo de la compra.
- **De dónde salen.** No es un modelo de lenguaje: la tabla de márgenes objetivo aprobada el 03-10-2026 (o la mediana de
  la categoría), el costo real y el piso de margen. El segundo escalón usa la regla aprobada el 03-10-2026: doble de
  unidades, cerca de 7% menos, redondeado a $100 ($50 bajo $1.000), nunca bajo 23% de margen.
- **Probado:** la regla reproduce 13 de los 15 segundos escalones que el dueño aprobó; los otros 2 difieren en un paso
  de redondeo (Parlantes $8.400 en vez de $8.300; Power Bank $24.200 en vez de $24.000). 8 comprobaciones del servidor y
  la pantalla en la maqueta (el caso de la captura del dueño: costo $9.890 y precio $14.990 dan 34%, $5.100).

## v122 · Paso a paso para revisar, lotes y categoría con IA

- **"🪄 Paso a paso" en la ficha de un producto que ya existe.** Mismas 6 secciones. Al revisar, "Siguiente" solo cambia
  de sección: un producto publicado no pasa a borrador ni se despublica. Se guarda con "Terminar y guardar".
- **Saltar pasos:** botón "Saltar" (al crear) y los números de arriba llevan a cualquier paso sin guardar.
- **Lotes (PEPS) a la vista:** la casilla subió al bloque de la compra. Marcada, vale para esa compra aunque la ficha no
  se haya guardado.
- **Capa inicial:** al activar los lotes sobre un producto con stock se crea una capa con ese stock al costo de la ficha.
  Antes quedaba stock sin capas (así estaba el Cable Audio). No arregla los 2 productos ya descuadrados (#68).
- **"✨ Proponer categoría y subcategoría con IA"** en la tarjeta Categoría: la IA elige de la lista real; el servidor
  descarta lo que no esté en ella. Se aplica con "Usar".
- **Probado:** 13 comprobaciones del servidor (capas, no duplicar, sin casilla no activa, categoría con Gemini simulado)
  y la pantalla en la maqueta. **No probado:** lo que elige Gemini de verdad.

## Corrección a este registro

`docs/CHANGELOG-V116.md` decía 16 comprobaciones del interruptor de ofertas; son 15.
