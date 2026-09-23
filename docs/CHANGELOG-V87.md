# v87 — Los agotados vuelven al feed, porque ahora tienen ficha

**Fecha:** 23-09-2026
**Migración:** ninguna
**Repo hermano:** `sevelin-tienda` commit `b18ba67` (tiene que ir ANTES que este)
**Decisión del dueño:** *"sí, mostremos las fichas de los agotados"*

---

## La cadena completa

La alerta de Google (178 → 134 artículos activos) tenía una causa aritmética: de 179 productos
publicados, 27 son servicios y **20 estaban sin stock**. Los sin stock salían del feed.

Y salían por una razón correcta en su momento: **la ficha de un producto agotado devolvía 404**, así
que mandarlo a Google habría sido publicar un link roto.

El comentario que justificaba esa exclusión terminaba así, escrito el 07-09-2026:

> *"Si algún día la tienda sirve las fichas agotadas (mejor para SEO, pero es una decisión de
> negocio), acá basta con dejar pasar la fila con `availability: out of stock`."*

El dueño tomó esa decisión hoy. La tienda ya sirve la ficha (ver `sevelin-tienda`), así que acá se
hizo exactamente lo que ese comentario anticipaba.

---

## Lo que apareció al tirar del hilo

Al revisar la tienda para hacer el cambio salieron **tres capas del mismo problema**, no una:

1. La ficha del agotado devolvía 404.
2. `POST /api/avisos` —el que registra "avísame cuando llegue"— usaba la función estricta y respondía
   **404 "Producto no encontrado"** justo para los agotados, que son los únicos para los que ese
   aviso existe.
3. El botón **"Agregar al carrito" nunca estuvo bloqueado por stock**. No hacía falta mientras la
   ficha diera 404; al mostrarla, había que esconderlo o se llenaba el carrito con algo que el
   checkout rechaza después.

La tabla `avisos_producto` tenía **0 filas**. No era falta de interés: no había forma de llegar.

---

## El detalle que evitó un bug de plata

`obtenerProductoPorSku` la usan el **checkout**, la cotización de envío, el carrito compartido, los
recordatorios y las cotizaciones. Relajar esa función para que aceptara agotados habría abierto la
puerta a **pagar un producto que no existe**, en seis lugares de una sola vez.

Por eso se agregó `obtenerProductoPublicado` aparte, solo para mostrar. La estricta quedó intacta.

---

## Probado

14 comprobaciones contra el doble de Supabase: que el agotado entre al feed declarado `out of stock`
con su link correcto, que salga de la lista de omitidos, que el servicio siga omitido, que el encargo
siga yendo a `/pedidos-por-encargo` y que el SKU con espacio siga codificado.

En la tienda, contra la base real: la ficha del agotado responde 200 con su cartel y sin botón de
compra, el producto con stock sigue igual, el listado NO muestra agotados, y `POST /api/avisos`
responde ok donde antes daba 404.

---

## Orden de despliegue (importa)

Primero la tienda, después el POS. Al revés, el feed habría entregado a Google 20 links que todavía
daban 404.
