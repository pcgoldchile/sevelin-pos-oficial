# v86 — El feed mandaba 18 productos a una página que no existe

**Fecha:** 23-09-2026
**Migración:** ninguna
**Encontrado:** investigando la alerta de Google Merchant Center por la caída de artículos activos
(178 → 134 entre el 22-09 18:20 y el 23-09 00:20).

---

## Lo que pasó

El 22-09 (v83 de la tienda) se arregló que los productos **por encargo** aparecieran en el sitemap
bajo `/productos/<sku>`, una ruta que su propia ficha rechaza (`notFound`) porque viven en
`/pedidos-por-encargo/<sku>`.

**El feed del catálogo tenía su propia copia de ese error y quedó fuera de aquel arreglo.** Los 18
productos por encargo se le entregaban a Google y a Meta con un link que responde **404**.

Un feed con links rotos no es un producto que no se vende: la plataforma desaprueba esos artículos y
las desaprobaciones acumuladas bajan la calidad de toda la cuenta.

```js
// antes — una sola ruta para todos
link: `${sitio}/productos/${encodeURIComponent(p.sku)}`

// ahora — cada uno a la suya
link: `${sitio}${p.es_pedido_encargo ? '/pedidos-por-encargo' : '/productos'}/${encodeURIComponent(p.sku)}`
```

Los `por_llegar` **siguen yendo a `/productos`**: esa ficha sí los muestra. Solo los de encargo cambian.

---

## Lo que NO era el problema

Conviene dejarlo escrito, porque era la sospecha obvia y estaba equivocada:

- **El feed no se cayó.** Google lo leyó el 23-09 a las 00:00 y Meta el 22-09 a las 20:17, las dos
  sin errores.
- **La caída es real y es aritmética:** de 179 productos publicados, 27 son servicios (se excluyen a
  propósito) y **20 están sin stock**. Quedan 132, que es lo que ambas plataformas leyeron (131).
  Los 20 sin stock son la única causa que está en manos del dueño.

---

## Probado

9 comprobaciones contra el doble de Supabase, con un catálogo que mezcla un producto normal, uno por
encargo, uno con espacio en el SKU y un servicio: que cada uno vaya a su ruta, que ningún encargo
quede en `/productos`, que el SKU con espacio siga codificado, que el servicio siga fuera del feed y
que un encargo con stock 0 siga declarándose `in stock`.

---

## Hallazgos de la misma revisión que NO son código

- **Origen zombi en Merchant Center:** la fuente "Tiendanube API" (15 productos, sin fecha de última
  actualización) seguía viva pese a haberse eliminado en septiembre. Borrada el 23-09 con
  aprobación del dueño.
- **"Protección de productos" estaba apagada** en Merchant Center. Es la casilla que bloquea una
  caída masiva de artículos en vez de aplicarla en silencio — exactamente lo que ocurrió esa noche.
  Activada el 23-09.
- **Google rastrea sevelin.cl por su cuenta** como fuente aparte ("Encontrado por Google", 57
  productos, 11 archivados, cada 24 h), en paralelo al feed. Queda anotado, sin tocar.
- **Meta: el catálogo está sano** (131 productos, sin errores, se reemplaza a diario), pero **no hay
  Tienda creada**, así que el catálogo hoy solo sirve para anuncios: no aparece en Instagram
  Shopping, ni en la pestaña Tienda de Facebook, ni en el catálogo de WhatsApp.
