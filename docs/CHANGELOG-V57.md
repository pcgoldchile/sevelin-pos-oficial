# CHANGELOG v57 — Informe semanal

**Fecha:** 08-09-2026 · **Rama:** `main` · Sin migración SQL.
Plan: `docs/PLAN-CRECIMIENTO-2026.md`, **Fase 7 (sistema consistente)**.

---

## 1. Para qué

El panel Inteligencia (v51) mide bien, pero hay que **acordarse de abrirlo**. Este es el otro lado:
los 5 números del lunes, ya comparados con la semana anterior, con las alertas que hay que mirar y un
texto listo para copiar.

Es la pieza que convierte lo construido en rutina: sin ella, todo lo medido queda esperando que
alguien tenga la iniciativa de ir a buscarlo.

---

## 2. Refactor previo: una sola fórmula para los números

Antes de escribir el informe se **extrajo `resumenDeVentas()`** del endpoint de Inteligencia. Ahora
los dos paneles llaman a la misma función.

**Por qué no se copió y pegó:** dos copias de la fórmula del margen son dos números que tarde o
temprano se contradicen en pantalla, y quien los mira no tiene cómo saber cuál creer. Si mañana
cambia cómo se calcula el ticket o el margen, se cambia en un solo lugar.

**Verificado que el refactor no movió nada**: el panel Inteligencia sigue devolviendo exactamente los
mismos valores (169 ventas, $5.831.000, margen entre 24,2% y 31,1%, ticket $34.503, 8 alertas,
9 chips de auditoría).

---

## 3. `GET /api/pos/informe-semanal?semana=YYYY-MM-DD`

`auth(true)` (muestra margen). Sin `semana` devuelve **la última semana cerrada** (lunes a domingo):
el informe se lee el lunes, y una semana a medias no se puede comparar con una entera. Con `?semana=`
se puede pedir cualquier otra, incluida la en curso (viene marcada con `esSemanaEnCurso`).

Devuelve el resumen de la semana y el de la anterior, las variaciones, el top 3 por margen, los
números de la tienda web, las alertas, y **el texto ya redactado**.

### Tres decisiones que no son obvias

**El texto se redacta en el servidor.** El informe se lee en pantalla pero también se copia y se
manda por WhatsApp. Si el texto se armara en el navegador, la pantalla y el mensaje terminarían
diciendo cosas distintas.

**El margen se compara en PUNTOS, no en porcentaje.** Pasar de 31,7% a 25,3% no es "bajó 6%" — es
bajó **6,4 puntos** (en porcentaje sería 20%). Es la confusión clásica al leer márgenes y acá está
resuelta de un solo lado.

**Si la semana anterior fue 0, no hay variación.** Se devuelve `null` y la pantalla escribe "sin
comparación (semana anterior en 0)" en vez de un infinito o un 100% inventado.

### La tienda web no puede voltear el informe
Las visitas y pedidos salen del **segundo Supabase** (`dbWeb`). Esa consulta va en su propio
`try/catch`: si la tienda no responde, el informe del POS **igual sale**, con una nota en esa tarjeta.
Perder las visitas no puede dejar sin números al negocio principal.

---

## 4. Panel — Finanzas → 📅 Semanal

Seis tarjetas (facturado, utilidad, margen, ticket, ventas, tienda web), cada una con su variación en
texto claro; alertas de la semana; top 3 por margen; navegación ← / → entre semanas; y **📋 Copiar**,
que deja el informe listo para pegar en WhatsApp.

El botón de copiar usa el portapapeles moderno y, si falla por permisos o contexto no seguro, cae a
`textarea` + `execCommand`. Un botón de copiar que a veces no copia y no avisa es peor que no
tenerlo.

Al entrar a la pestaña **siempre vuelve a la última semana cerrada**: si conservara la semana que se
estaba mirando, se leería una vieja sin notarlo.

---

## 5. Lo que el primer informe real ya dice

Semana del **31-08 al 06-09-2026**, contra la anterior:

| | |
|---|---|
| Ventas | 36 **▲80%** |
| Facturado | $1.060.000 **▲17%** |
| Utilidad | $268.601 **▼7%** |
| Margen | 25,3% — **6,4 puntos menos** |
| Ticket | $29.444 **▼35%** |
| Web | 852 visitas · 2 pedidos |

**Se vendió mucho más y se ganó menos.** 80% más ventas produjeron 7% menos utilidad: el ticket cayó
un tercio y el margen 6,4 puntos. Es exactamente el tipo de cosa que un total mensual esconde y que
esta pestaña muestra sola.

Y en la web: **852 visitas → 2 pedidos** (0,2%). Es el primer dato de conversión real que existe.

Las 3 alertas de esa semana: 2 productos vendidos quedaron en stock 0, 1 ítem se vendió sin costo
cargado, y ninguna venta quedó con cliente registrado.

---

## 6. Cómo se probó

- **Endpoint contra producción**: semana por defecto (la cerrada), semana en curso vía `?semana=`, y
  `?semana=holanda` → 400 con mensaje claro.
- **Panel en jsdom** con el informe REAL: las 6 tarjetas con sus valores y variaciones, 3 alertas,
  3 filas de top, 0 `<script>` inyectados.
- **Navegación**: click en "← Semana anterior" pide `2026-08-24` (la fecha correcta, calculada desde
  la semana mostrada) y repinta.
- **Casos borde**: con la semana previa en 0 muestra "sin comparación" en vez de un porcentaje
  inventado; sin datos de la tienda muestra la nota en vez de romperse; sin ventas, el top dice "no
  hubo ventas".
- **Copiar**: deja en el portapapeles el texto que empieza con `SEVELIN · semana del …` y avisa.
- **El refactor no movió ningún número** del panel Inteligencia (comparado antes y después).
- `node --check` en los 4 archivos JS tocados; chequeos de colisión de funciones, `const`/`let`
  globales e `id`: **todos vacíos**.

---

## 7. Archivos tocados

| Archivo | Cambio |
|---|---|
| `api/index.js` | `resumenDeVentas()` extraído y compartido; `GET /api/pos/informe-semanal`; helpers `lunesDeLaSemana()` y `sumarDias()` |
| `js/api.js` | `API.informeSemanal.obtener()` |
| `js/informe-semanal.js` | **nuevo** — el panel completo |
| `js/balance.js` | rama `semanal` en `mostrarPanelFinanzas()` |
| `index.html` | sub-pestaña, ítem de sidebar, panel y `<script>` |

---

## 8. Lo que sigue

1. **Leerlo cada lunes.** Diez minutos. Es el hábito, no la herramienta, lo que hace la diferencia.
2. **Automatizar el envío** cuando el dominio de Resend esté verificado (B2), o antes con una rutina
   programada en la nube: el texto ya viene armado del servidor, solo falta el canal.
3. El informe **mensual** (margen por categoría, stock muerto, decisiones de precio) es el siguiente
   paso natural, y conviene hacerlo recién cuando estén cargados los costos.
