# v84 — Qué pasó con el producto devuelto

**Fecha:** 22-09-2026
**Migración:** `sql/63-seguimiento-devoluciones.sql`
**Pedido por:** el dueño: *"me sirve para después actualizar si ese producto lo devolví al proveedor,
y hacer seguimiento si me devolvieron la plata, o lo boté. Necesito que sea con seguimiento, y que se
vincule a notificaciones según los plazos que yo determine."*

---

## Las tres decisiones que tomó él

1. **El proveedor y el fabricante son caminos distintos** (*"Sí, son diferentes"*). Cambian a quién
   le reclamas, los plazos y qué esperas de vuelta: el proveedor devuelve plata, el fabricante casi
   siempre cambia la unidad.

2. **El ajuste del gasto nunca es automático:** *"Apruebo, pero siempre yo debo vigilar y aprobar si
   se debe ajustar o no manualmente, para que no se descuente de forma automática del balance."*

3. **El seguimiento va por producto**, no por devolución.

La segunda es la que define la arquitectura de todo este cambio.

---

## El problema de plata que resuelve

En la v82, cuando un producto no vuelve al stock se crea una **merma** con su costo: el mes anota esa
pérdida. Correcto… **hasta que el proveedor te devuelve la plata**. Ahí esa pérdida nunca ocurrió, y
el balance queda mostrando un gasto que no fue real.

Pero corregirlo solo sería peor: un gasto que cambia de monto por su cuenta, en un mes que el dueño
ya miró, es exactamente el tipo de cosa que hace desconfiar de todo el sistema.

Por eso el POS **calcula el ajuste y lo propone**, con el monto ya sacado, y **no toca un peso** hasta
que él aprieta *"Aplicar al balance"*. *"Dejarlo como está"* también es una respuesta válida y queda
guardada.

`POST /api/devoluciones/seguimiento/:id/ajuste` es **el único lugar de todo el módulo de devoluciones
donde se modifica un gasto ya registrado**, y pide `auth(true)`: el trabajador puede anotar el
seguimiento, pero no tocar el balance.

### Qué hace exactamente el ajuste al aplicarse

- El **gasto** (`compras`) se rebaja a lo que de verdad se perdió. Si no se perdió nada, se borra —
  una línea de $0 en Gastos es ruido; la merma conserva la historia.
- La **merma** se rebaja igual y se le agrega al texto *"— recuperado $X el DD-MM-AAAA (proveedor)"*.
- Nunca se propone devolver más de lo que se había perdido, aunque el proveedor pague de más.

---

## Los caminos

| Destino | Qué pasa después |
|---|---|
| 📮 Se lo devolví al proveedor | Espera respuesta, con el plazo que él ponga |
| 🏭 Lo mandé a la garantía del fabricante | Igual, pero es otro interlocutor y otros plazos |
| 🔧 Lo reparé | Se cierra |
| 📦 Me lo quedé | Se cierra |
| 🗑️ Lo boté | Se cierra. La pérdida queda |

Y para los dos primeros, en qué quedó: **esperando**, *me devolvieron la plata*, *me lo cambiaron por
otro* o *me lo rechazaron*.

El modal muestra **solo lo que corresponde** al camino elegido: preguntarle cuánta plata le
devolvieron a quien botó el producto es ruido.

### El reemplazo sí sube el stock

Si marca *"me lo cambiaron"* y que la unidad de reemplazo entró al inventario, el stock sube en el
momento. Eso **no** contradice la regla de arriba: ese clic es su acción manual y es un hecho físico
(la unidad está en la repisa). Lo que no se mueve sin su visto bueno es el **balance**. Guardar dos
veces no duplica el stock.

---

## Los avisos

Un botón en el header, **📮**, con tres cosas que esperan una acción suya:

1. **Ajustes por aprobar** — van primero y el botón se pinta en magenta y pulsa, porque es lo único
   que mueve plata.
2. **Se pasó el plazo que pusiste** — lo que sigue en "esperando" después de la fecha que él eligió,
   con cuántos días lleva.
3. **Llevan más de una semana sin decisión** — ahí es donde la plata se pierde callada. Una semana y
   no el mismo día, porque recién devuelto es normal no saber todavía qué vas a hacer.

En el panel de Finanzas → Devoluciones, cada producto de cada devolución muestra su estado en un chip
y se abre con un clic. Si hay un ajuste esperando, el chip lo dice en vez del destino: es lo único
que pide una decisión.

---

## Probado

- **175 comprobaciones de backend** (53 nuevas). Las dos que importan de verdad: al marcar que el
  proveedor pagó, **el gasto no se tocó** y **la merma tampoco**. Además: los dos caminos separados,
  ajuste parcial, tope en el costo perdido, rechazo del ajuste, cambio con reemplazo al stock sin
  duplicar, doble aplicación bloqueada, el trabajador anotando pero sin poder tocar el balance, y los
  tres tipos de aviso.
- **151 comprobaciones de interfaz** (51 nuevas, jsdom): el modal adaptándose a cada camino, la
  pregunta que cambia entre "proveedor" y "marca", que no se envíe sin el monto, el aviso que dice
  explícitamente que no se descontó nada, y los dos botones de aprobar/rechazar.
- **Navegador real**: el modal de seguimiento y el modal de avisos con sus tres secciones.
- Chequeos del proyecto: `node --check`, funciones globales duplicadas, `const/let` globales
  duplicados e `id` duplicados — los cuatro vacíos.

---

## Lo que queda anotado para más adelante

- El plazo se escribe a mano. `proveedores_plazos` (sql/60) ya guarda los días de cada proveedor y
  podría sugerirlo; se dejó fuera para no adivinar antes de ver cómo lo usa.
- No hay recordatorio por WhatsApp ni correo: el aviso vive en el POS.
