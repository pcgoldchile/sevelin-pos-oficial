# v174 — Precio editable en la caja (nunca bajo el costo) y servicios de software (22-10-2026)

## 1. Cambiar el precio de una línea en la caja, sin clave

Dueño: *"algunos servicios que el precio es desde $10.000, por ejemplo desbloqueos de cuenta Google, si le cobro 15 mil o
20 mil a un cliente no me deja cobrar a ese precio… y que no pida pin, los precios de venta pueden ser modificables a
excepción que nunca se puedan vender bajo el precio costo"*.

- **Causa:** la caja no tenía cómo cambiar el precio de una línea. Solo existía el "total a cobrar", que hacia arriba
  redondea hasta $1.000 (v123) y decía "para cobrar más, cambia el precio del producto".
- **Ahora:** cada línea del carrito muestra su precio como botón (`$10.000 c/u ✏️`). Al tocarlo se escribe otro precio,
  más alto o más bajo, **solo para esa venta** (la ficha no cambia). La línea muestra "(lista $X)" tachado.
- **Freno único: nunca bajo el costo, para todos (también el admin).** `POST /api/ventas` rechaza la venta (400) si una
  línea queda bajo su costo, ya con el descuento del carrito repartido. Costo = el mayor conocido (sql/78) para productos
  del catálogo; el anotado para ítems escritos a mano. Un producto con costo a $0 (regalo) también se rechaza. La caja lo
  avisa antes: "⛔ Bajo el costo: no se puede cobrar así" en la línea, y no deja abrir el cobro.
- **Sin clave del dueño:** el aviso de "menos de 15% de margen" (v109) queda como aviso para todos con "Cobrar igual". Se
  quitó el freno v112 (el trabajador necesitaba la clave). `/api/pos/autorizar-margen` queda sin uso.
- El tope de $1.000 del redondeo sigue igual; su mensaje ahora dice "toca el precio ✏️ del producto en el carrito".
- **No cambia:** "Editar Venta" (corrige ventas ya hechas, con clave) y el canje de Puntos.

## 2. Servicios de software (datos, `docs/servicios-software-2026-10-22.sql`)

- **Mantenimiento Preventivo PC (#89) y Notebook (#88), Traspaso y Ensamblado (#178):** se acaba el "hasta $10.000 como
  tope". Instalar Windows desde cero, si el cliente lo pide: **+$15.000**. Dejar listo un disco nuevo (inicializar y dar
  formato) o instalar drivers de un componente nuevo: **+$5.000**; si no hay que hacerle nada, no se cobra. En ficha,
  descripción de la tienda, Facebook e Instagram.
- **Formateo (#136 y #93):** "❌ Eliminación de virus u optimización sin formatear: no la hacemos por separado" (regla del
  dueño: el virus se resuelve con formateo; lo lento sin formatear, con diagnóstico o cotización).
- **#307 y #373:** "el traspaso de archivos se cobra aparte" ahora nombra el servicio nuevo y su precio.
- **Nuevos (Servicios Técnicos → Formateo y Respaldo de Datos, publicados, sin foto todavía):**

| # | Servicio | Precio |
|---|---|---|
| 535 | Formateo e Inicialización de Disco (sin Instalar Windows) | $5.000 por disco; gratis si el disco se compra en Sevelin |
| 536 | Borrado Seguro de Disco para Vender o Regalar (hasta 1 TB) | $10.000; más de 1 TB $15.000 (con el ✏️ de la caja) |
| 537 | Instalación de Drivers y Programas (sin Formatear) | $10.000 |
| 538 | Traspaso de Archivos a Otro Equipo o Disco (hasta 100 GB) | $10.000; más de 100 GB $15.000 |

Descartados por el dueño: eliminación de virus y optimización sin formatear, y recuperar el acceso a Windows ("solamente
formateo").

## Probado

- Servidor real contra el doble de Supabase: 11 casos (servicio a $20.000 pasa; bajo el 15% pasa sin clave; bajo el costo
  se rechaza para admin y trabajador; con descuento; ítem a mano; regalo a $0).
- Maqueta del POS: subir un servicio de $25.000 a $35.000, bajar el adaptador a $3.000 (pasa) y a $2.000 (frenado: "cuesta
  $2.201"); sin errores en consola.
- Fichas: los 7 textos sin "$10.000 como tope"; Instagram bajo 2.200 letras; los 4 nuevos sincronizados en la tienda.
