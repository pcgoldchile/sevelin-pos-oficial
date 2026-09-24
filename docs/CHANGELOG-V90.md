# v90 — Protocolos y fases de servicio

**Fecha:** 24-09-2026
**Migración:** `sql/66-protocolos-y-fases.sql` (aplicada en producción el 24-09-2026)
**Pedido del dueño:** *"Que cada servicio se armen FASES que el admin o trabajador debe ir chequeando
y también ir registrando pilas cr2032, pasta térmica aplicada, thermalpad aplicado. Cosa de ir
tachando las OT y que sea visible siempre las FASES y PROTOCOLO."*

---

## Las cuatro reglas las decidió el dueño

| | Decisión |
|---|---|
| **1. ¿Cuándo sale el insumo del stock?** | **Al tachar la fase**, no al entregar. Se le propuso lo contrario y dijo que no. |
| **2. Envases (masilla, pasta)** | Por **rendimiento**, no por peso. |
| **3. ¿Destachar?** | Sí, pero queda **quién y cuándo** — y puede escribir su nombre. |
| **4. ¿Entregar con fases pendientes?** | **Solo el admin**, y dejando el motivo escrito. |

---

## ⚠️ La regla 1 va contra la regla vieja del módulo, y hubo que hacerlas convivir

`ot_repuestos` descontaba el stock al pasar la OT a ENTREGADO. Ahora las fases descuentan antes. Si
las dos reglas corrieran sin saber una de la otra, **cada insumo se descontaría dos veces**: una al
tachar la fase, otra al entregar.

**Cómo se resolvió:** lo que consume una fase se guarda en `ot_repuestos` con
`stock_descontado = true`. La entrega solo descuenta las filas con `stock_descontado = false`, así
que ya no las toca. Es la misma marca que se usó a mano para las 2 pilas CR2032 de las OT-000005 y
OT-000006.

Hay una prueba dedicada a esto: *"la entrega NO volvió a descontar lo que ya consumieron las fases"*.

---

## El rendimiento, y por qué no se mide por peso

Pesar exigiría una balanza de 0,1 g y pesar el envase antes y después de cada trabajo. Es un paso que
se salta, y **un sistema que depende de un paso que se salta da datos peores que uno que no lo pide**.
Además la plata es chica: la pasta HY410 de 10 g cuesta $1.046 — unos $100 por aplicación.

**Cómo funciona:** el dueño declara una vez cuántas aplicaciones rinde el envase. Cada fase tachada
suma una aplicación. Al llegar al rendimiento se descuenta **un envase entero** del stock y el
contador vuelve a empezar. El stock queda siempre en envases enteros, sin decimales falsos, y la OT
carga el **costo prorrateado** (`costo del envase ÷ rendimiento`), no el envase completo.

**La vuelta atrás es exacta y no guarda nada extra.** Al destachar se restan las aplicaciones y,
mientras el contador quede negativo, se devuelve un envase y se suma el rendimiento. Da igual el
orden en que se destachen las fases. Probado en los dos casos: el envase que no se acaba y el que sí.

**Se autocorrige:** cuando el envase se termina de verdad, se ve cuántas aplicaciones cubrió y se
ajusta el número. El segundo envase ya estima mejor que el primero.

---

## 🔴 El choque de rutas que encontró una prueba

`GET /api/ot/en-curso` **nunca se ejecutaba**: `app.get('/api/ot/:id')` se registra antes en Express y
capturaba `"en-curso"` como si fuera un id. Es la misma trampa que ya estaba anotada para las
clasificaciones de gastos.

Se movió a **`/api/servicios-en-curso`**. La prueba que lo detectó (`el aviso ve el servicio en
curso`) quedó, y hay otra en la interfaz que verifica que la ruta no vuelva a colgar de `/ot`.

---

## Qué se construyó

### `sql/66` — 4 tablas nuevas + 4 columnas

- **`protocolos`** — la plantilla, colgada opcionalmente de uno de los 27 servicios del catálogo.
- **`protocolo_fases`** — pasos ordenados, con `obligatoria` y `pide_nota`.
- **`protocolo_insumos`** — **por FASE**, no por protocolo. Es lo que permite que el stock salga en el
  momento exacto en que se aplica. Acepta un repuesto del taller **o** un producto del catálogo.
- **`ot_fases`** — la instancia. El nombre y el orden se **copian**: si mañana se edita el protocolo,
  las OT viejas siguen mostrando lo que de verdad se hizo.
- `ot_repuestos.ot_fase_id`, `repuestos.rinde_aplicaciones`, `repuestos.aplicaciones_usadas`,
  `ordenes_trabajo.entrega_forzada_motivo`.

RLS habilitada y sin políticas en las 4 tablas nuevas.

### Backend — 5 endpoints

`GET /api/protocolos` · `POST /api/ot/:id/protocolo` · `GET /api/ot/:id/fases` ·
`PUT /api/ot/fases/:id` · `GET /api/servicios-en-curso`

Admin y trabajador pueden tachar los dos. El JWT solo lleva el **rol**, así que se guardan los dos
datos: el rol (duro) y el nombre que la persona escriba.

### Frontend — `js/protocolos.js`

- **Botón ✅ Protocolo** en cada fila de Órdenes de Trabajo, y una **insignia `4/9`** al lado del
  estado para que el avance sea "visible siempre" sin abrir nada.
- **Checklist** con las fases tachadas literalmente (`text-decoration: line-through`), quién las tachó,
  los insumos que va a consumir (o los que consumió), y el campo de nota donde corresponde.
- **Chip 🔧 "Servicios en curso"** en el header, ámbar cuando hay un equipo con protocolo aplicado y
  ninguna fase tachada — eso es un equipo parado.
- El nombre de quien trabaja se recuerda en `localStorage` para no preguntarlo en cada fase. Si está
  bloqueado (modo privado), simplemente se pregunta de nuevo; el rol igual queda registrado.

### Carga inicial

Los dos insumos del dueño entraron a **`repuestos`** (inventario del taller, no al catálogo: son los
envases abiertos de trabajo, no lo que vende sellado):

- **UPSIREN Thermal Putty 100 g** — rendimiento estimado 20 aplicaciones
- **Thermal Paste M12 12.4W/m-K 30 g** — rendimiento estimado 40 aplicaciones

Y un protocolo de partida, **"Mantenimiento Preventivo PC Gamer"** (9 fases), colgado del servicio
que ya existía en el catálogo ($40.000).

---

## Pruebas

**94 comprobaciones, 0 fallas** (45 de backend con doble de Supabase + 49 de interfaz en jsdom).

Las que importan:
- El rendimiento suma aplicaciones sin descontar envase, y **descuenta uno al completarlo**.
- Destachar devuelve **las aplicaciones exactas y el envase**.
- La OT carga el costo **prorrateado** ($8.000 / 40 = $200), no el envase entero.
- La entrega **no vuelve a descontar** lo que ya consumieron las fases.
- El trabajador no puede entregar con fases obligatorias pendientes (403); el admin sin motivo
  tampoco (400); con motivo sí, y el motivo queda guardado.
- Sin stock, la fase se tacha igual pero avisa, y **no deja el stock en negativo**.
- Dos pruebas de XSS (nombre de fase y nombre de cliente).

`node --check` en los 8 archivos tocados, los dos chequeos de colisión vacíos, Tailwind sin cambios.

**No verificado:** navegador real ni producción.

---

## ⚠️ Lo que el dueño tiene que corregir

1. **Los dos insumos quedaron con `costo_unitario = 0`** — no dio lo que le costaron. Con costo 0 el
   servicio parece 100% de margen, que es justo la mentira que este módulo existe para corregir.
2. **Los rendimientos (20 y 40) son estimaciones de partida.** Se autocorrigen, pero conviene
   ajustarlos ahora.
3. **Las 9 fases del protocolo son un borrador escrito por Claude**, no el procedimiento real del
   taller. Hay que corregir nombres, orden y cuáles son obligatorias.
4. **El envase de putty "ya tiene uso"** — quedó cargado como envase nuevo (0 aplicaciones usadas).

---

## Anotado, no hecho

- **La pantalla para crear y editar protocolos.** Se dejó fuera a propósito: era el acuerdo con el
  dueño de partir con un protocolo real y construir el editor recién después de verlo funcionar en
  una OT de verdad. Hoy los protocolos se cargan por SQL.
- **Archivar un repuesto.** `repuestos` no tiene `archivado`: cuando cambie de marca de pasta, la
  vieja queda en la lista para siempre.
