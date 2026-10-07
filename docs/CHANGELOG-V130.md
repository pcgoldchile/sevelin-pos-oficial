# v130 — Carga masiva: encuentra los archivados, buscador por fila, fecha de llegada y ventana ancha (07-10-2026)

Pedido del dueño al cargar un aire comprimido: la IA leyó bien la captura, pero el POS no avisó que el producto ya
existía.

## La causa

El producto que ya tenía (#263 "Limpiador de Aire Comprimido Air Duster 400ML") está **archivado**. La carga masiva
solo comparaba contra los productos activos, y además el servidor rechazaba sumar una compra a un archivado. El
resultado era un duplicado.

## Qué cambió

- **Los archivados también se comparan.** Aparecen en la lista como "archivado: se desarchiva". Al cargar, el producto
  vuelve del archivo (sigue sin publicarse solo) y el resultado lo dice.
- **Buscador en cada fila:** "¿No aparece? Búscalo en tu catálogo…". Busca por nombre, SKU, código de barras o número
  de producto, y lo encontrado se suma a la lista de esa fila. Sin parecidos, la fila parte como "producto nuevo".
- **Fecha de llegada desde la IA (opcional):** las instrucciones piden una línea `LLEGA: AAAA-MM-DD` si en la captura
  se ve cuándo llega, y llevan la fecha de hoy para que la IA pueda convertir "llega el sábado". Si viene, queda puesta
  la fecha y marcado "Está por llegar"; se puede cambiar. También acepta `10-10-2026` y `10/10/2026`.
- **Los datos de una compra normal:** "Puedes devolver hasta" y "N° de pedido o boleta", una vez para toda la carga.
- **Ventana ancha** (hasta 1380 px): pasos 1 y 2 lado a lado, y "¿ya la tienes?" junto a "¿anoto el gasto?".

## Cómo se probó

- Servidor (doble de la base): un archivado con compra por llegar queda desarchivado, con 5 por llegar, fecha, plazo
  de devolución y referencia; una devolución anterior a la compra se rechaza.
- Maqueta: el texto real de Gemini propone el aire comprimido archivado; el buscador agrega opciones sin perder lo
  escrito; `LLEGA` marca "por llegar" y la fecha; la carga completa deja el producto activo y por llegar.
- **No probado:** una captura de pantalla del diseño (el panel estaba oculto: se midió por posiciones) y una respuesta
  real de una IA con la línea `LLEGA`.
