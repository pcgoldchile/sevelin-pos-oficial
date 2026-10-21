# v173 — "➕ Agregable": un accesorio opcional en la compra (21-10-2026)

Pedido del dueño: *"quiero una opción (opcional y que me pregunte con la IA) de agregar un adaptador HDMI a VGA en los
monitores que no tengan HDMI nativo… tanto en el texto de la tienda, Facebook, y un botón de agregar en la misma página
del monitor, tipo agregable"*.

## Qué es

UN accesorio opcional por producto (`productos.agregable_id` + `agregable_motivo`, sql/110). Distinto de "Complementa tu
compra" (carrusel al final de la ficha, hasta 12): el agregable va **en el cuadro de compra** y se suma con una casilla.

| Dónde | Cómo se ve |
|---|---|
| sevelin.cl, cuadro de compra | Casilla "➕ Agrégale (opcional)" con foto, nombre, +precio y la frase. Marcada: "Agregar al carrito con el accesorio" mete los dos (uno por unidad, hasta su stock) y muestra el total. No sale si el accesorio no tiene stock, no está publicado, es a consultar o por encargo, ni en una reserva. |
| sevelin.cl, descripción | Una línea "➕ Opcional: … agrégale el [accesorio] por $X", armada al mostrar la página (el precio siempre es el de hoy). |
| Facebook e Instagram | Bloque `➕ OPCIONAL` antes de "📌 RETIRO" / "📍", con el precio del día. Se rehace cada vez que el texto se arma, se abre en "📘 Facebook" o "Crear contenido", o se copia desde la ficha: un precio cambiado nunca queda escrito. Sin stock del accesorio, el bloque se quita. |
| POS, ficha → tarjeta "➕ Agregable" | Elegir, cambiar o quitar el accesorio y su frase. Se guarda al instante (`PUT /api/productos/:id/agregable`), y de paso actualiza el texto de Facebook/Instagram guardado. |

## La pregunta automática

Si el producto es de **Monitores** y sus "Entradas de video" (Filtros de la tienda, marcadas a mano o con "✨ Rellenar con
IA") **no tienen HDMI**, la tarjeta pregunta: *"Este monitor no tiene entrada HDMI. ¿Ofrecer Adaptador HDMI a VGA ($4.990 ·
12 en stock) como agregable?"* → **Sí, agregarlo** / **No, gracias**. Nunca lo pone sola. El "No" se recuerda en ese
navegador para ese producto. Si no hay entradas marcadas, mira el nombre y la descripción.

- Solo VGA (o VGA + DVI/DisplayPort) → el adaptador **HDMI a VGA** (prefiere "adaptador" sobre "cable", publicado y con
  más stock). Nunca el "VGA a HDMI" (#190), que va al revés.
- Solo DVI → el adaptador DVI a HDMI.
- El accesorio se reconoce por el nombre en el catálogo, no por un id fijo.

## Datos (con OK del dueño)

- Los 11 monitores sin HDMI (#172, #230–#238, #533) quedan con el #104 "Adaptador HDMI a VGA" como agregable.
- El #190 "Adaptador VGA a HDMI" sale de "Complementa tu compra" de los 9 monitores VGA que lo tenían (iba al revés).

## Probado

- Node, `js/redes-texto.js`: 14 casos (bloque en Facebook e Instagram, posición, precio que cambia, sin stock, quitar
  deja el texto escrito a mano exacto, lote en Node, enfoques).
- Servidor real (`api/index.js`) contra el doble de Supabase: 11 casos de la ruta (guardar, quitar, él mismo, archivado,
  servicio, inexistente, frase larga, trabajador → 403).
- Maqueta del POS: pregunta → Sí → texto de Facebook con el bloque → quitar → No, gracias; sin errores en consola.
- Maqueta de la tienda (sevelin-tienda `94b803b`): casilla, total, los dos al carrito, la casilla se desmarca; en celular
  (375 px) sin desborde; un monitor sin agregable no muestra nada.
- Sin probar: el pago de un pedido con el accesorio en la tienda real (es un producto más del carrito, por el mismo camino).
