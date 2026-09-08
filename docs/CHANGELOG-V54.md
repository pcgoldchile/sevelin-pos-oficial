# CHANGELOG v54 — Marca del producto

**Fecha:** 07-09-2026 · **Rama:** `main` · **SQL:** `sql/38-marca-producto.sql` (POS) y
`sevelin-tienda/supabase/23-marca.sql` (tienda) — **ambas aplicadas y verificadas**.

---

## 1. Por qué

El feed de catálogo (v53) exige `brand`, y el catálogo no tenía dónde guardarlo: se mandaba
"Sevelin" en las 99 filas. Funciona, pero rinde bastante peor — **Google Shopping usa la marca para
entender y clasificar el producto**. Un "SSD Kingston A400 960GB" con marca Kingston compite en las
búsquedas de Kingston; el mismo producto con marca "Sevelin", no.

---

## 2. La trampa, escrita en el código y en el SQL

**La marca es de quien FABRICA, no de para qué sirve.** Un "Cargador para notebook HP" no es marca
HP: es un genérico compatible con HP. Rellenar esto mal es **peor que dejarlo vacío**, porque Google
penaliza los datos incorrectos.

Por eso:
- **La columna nace NULL** y la regla para llenarla es una sola: **la marca se carga solo cuando el
  propio nombre del producto declara al fabricante.** No se deduce de ninguna otra fuente ni se
  busca por internet.
- **El patrón "para X" / "compatible con X" queda SIEMPRE vacío**, aunque el nombre traiga una marca
  conocida. "Funda para Samsung Galaxy A25" es un genérico, no un producto Samsung.
- El campo del modal lo dice explícitamente bajo el input.
- Un producto **sin** marca no muestra marca inventada en ningún lado: la ficha de la tienda la
  omite, el JSON-LD la omite, y solo el feed manda "Sevelin" — que para un cable genérico es honesto,
  porque ahí Sevelin sí es el único responsable del producto.

---

## 3. Qué se agregó

### POS
- `productos.marca TEXT` + índice parcial (`sql/38`).
- `CAMPOS_PRODUCTO` y `sanearProducto()`: se recorta el texto y `""`/`"null"` quedan en `NULL`, igual
  que ya hacían `sku` y `descripcion`.
- **Campo "Marca" en el modal de producto**, con un `<datalist>` de las marcas ya usadas en el
  catálogo. **Por qué el desplegable importa**: sin él se termina con "MSI", "msi" y "M.S.I" como
  tres marcas distintas en el feed, y Google las trata como tres fabricantes. La lista se arma del
  propio catálogo (no hay tabla maestra de marcas: con ~130 productos, un maestro aparte se
  desincroniza y no aporta nada), sin repetir, sin distinguir mayúsculas y ordenada alfabéticamente.
- **Feed de catálogo**: `brand` usa la marca real cuando existe; "Sevelin" solo como respaldo.
- **Panel Inteligencia**: chip nuevo "publicados sin marca". Cuenta solo los publicados, que son los
  que viajan al feed. Un genérico legítimo va a estar ahí siempre y está bien — el número sirve para
  encontrar los que **sí** tienen marca conocida y están compitiendo peor de lo que podrían.

### Tienda (`sevelin-tienda`) — **codificado, NO desplegado todavía**
- `productos_web.marca` (`supabase/23-marca.sql`, aplicada).
- El receptor de sincronización (`POST /api/sync/producto`) mapea `marca`.
- La ficha muestra la marca **encima del nombre**, como cualquier ficha de retail: es lo primero que
  busca quien ya sabe qué marca quiere. Solo si el producto la tiene.
- El **JSON-LD `Product` ahora incluye `brand`**, condicionalmente. Ese bloque tenía escrito
  "`brand` queda afuera a propósito… ese dato no existe en el catálogo todavía" — ya existe, así que
  el comentario y el código se actualizaron juntos.
- `tsc --noEmit` limpio.

---

## 3b. Carga inicial: 47 marcas

Aplicada con un script de una sola vez (ya descartado), siguiendo la regla de la sección 2.

- **47 productos** recibieron marca: HP (7), Master-G (6), Kingston (6), Kronos (4), Samsung (3),
  NewGen (2), MSI (2), Caixun (2), AOC (2), y una cada uno de Dblue, Duracell, Sony, Gigabyte, Aigo,
  Crucial, Hiksemi, Urbano Labs, Ekipax, ESGAMING, Snake Gamer, LinkOn y Dell. Más el id 188
  (Kingston) que ya se había cargado al probar el endpoint.
- **3 casos se dejaron vacíos a propósito** — son el patrón "para X": `142` Funda **para** Samsung
  Galaxy A25, `143` Funda **para** Xiaomi Redmi 14C, `193` Control Remoto Universal **compatible
  con** Samsung TV. Ninguno lo fabrica esa marca.
- **66 publicados siguen sin marca**, y la mayoría está bien así: cables, adaptadores, tornillos y
  productos sin fabricante identificable en el nombre. Los que sí tengan marca conocida (ej. `97`
  Mouse Gamer **Reptilex** RX0047, que el detector no conocía) los puede cargar el dueño desde el
  modal, ahora con el desplegable de marcas ya usadas.
- **Freno de seguridad en el script**: no pisaba ninguna marca ya cargada a mano. No hizo falta, pero
  quedó anotado por si se repite la operación.

**Efecto en el feed**: pasó de 1 fila con marca real a **37 de 99**. El resto sigue con "Sevelin",
que en un cable genérico es correcto.

**Cómo revertir si algo quedó mal**: es una sola columna, se limpia con
`UPDATE productos SET marca = NULL WHERE id IN (…)`. Nada más depende de ella.

---

## 4. ⚠️ Estado del despliegue

| Parte | Estado |
|---|---|
| POS (campo, feed, panel, SQL) | **Desplegado** |
| Tienda (sync, ficha, JSON-LD, SQL) | **SQL aplicada; el código NO está desplegado** |

**Por qué no se desplegó la tienda:** el repo `sevelin-tienda` tiene cambios **sin commitear de la
sesión anterior** (la integración de Khipu, que toca el checkout). Desplegar la marca arrastraría
ese trabajo ajeno a producción sin que nadie lo haya pedido, en la pasarela de pago de una tienda en
vivo. **Se dejó para que el dueño decida.**

**Consecuencia concreta mientras tanto:** guardar una marca en el POS **sí** la usa el feed (que lee
`productos.marca` directo del POS), pero **no** llega a `productos_web` — el receptor desplegado
todavía no conoce el campo. Verificado: al guardar "Kingston" en el id 188, `sincronizado_en` se
actualizó pero `marca` quedó en `null` del lado tienda. **Es exactamente lo esperado, no un bug**, y
se arregla solo con el despliegue.

---

## 5. Cómo se probó

- **Ida y vuelta real contra producción**: `PUT /api/productos/188` con `"  Kingston  "` → guardado
  como `"Kingston"` (recortado). Se dejó puesto: es la marca correcta de ese SSD, no un dato de
  prueba.
- **Feed**: 99 filas. Antes de la carga inicial, `brand` = `{Sevelin: 98, Kingston: 1}`; después,
  **37 filas con marca real** y 62 con "Sevelin".
- **Auditoría**: "publicados sin marca" bajó de **113 a 66** tras la carga.
- **`refrescarListaMarcas()`**: "MSI" y "msi" colapsan en una sola opción, `" Kingston "` se recorta,
  los vacíos y nulos se ignoran, y un valor con HTML (`<img src=x onerror=…>`) sale **escapado** —
  5 opciones para 8 entradas, como corresponde.
- **Panel en jsdom** con el informe real: 9 chips de auditoría (antes 8), 0 errores, 0 `<script>`
  inyectados.
- `tsc --noEmit` en la tienda: limpio.
- `node --check` en los 3 archivos JS tocados; chequeos de colisión de funciones, `const`/`let`
  globales e `id`: **todos vacíos**.

---

## 6. Archivos tocados

| Repo | Archivo | Cambio |
|---|---|---|
| POS | `sql/38-marca-producto.sql` | **nuevo**, aplicado |
| POS | `api/index.js` | `marca` en `CAMPOS_PRODUCTO` y `sanearProducto()`; `brand` real en el feed; `sinMarca` en la auditoría |
| POS | `index.html` | campo Marca + `<datalist>` en el modal de producto |
| POS | `js/productos.js` | leer/guardar/limpiar el campo + `refrescarListaMarcas()` |
| POS | `js/inteligencia.js` | chip "publicados sin marca" |
| Tienda | `supabase/23-marca.sql` | **nuevo**, aplicado |
| Tienda | `src/app/api/sync/producto/route.ts` | mapea `marca` |
| Tienda | `src/lib/tipos.ts` | `marca` en `ProductoWeb` y `ProductoPOS` |
| Tienda | `src/app/productos/[sku]/page.tsx` | marca sobre el nombre + `brand` en JSON-LD |

---

## 7. Lo que sigue

1. **Decidir el despliegue de `sevelin-tienda`** (ver sección 4).
2. **Revisar las 47 marcas cargadas** (sección 3b) y completar las que falten: quedan 66 publicados
   sin marca, y la mayoría está bien así. Solo vale la pena los que tengan fabricante real en el
   nombre. Los cables, tornillos y genéricos se quedan vacíos a propósito.
3. Cuando haya marcas cargadas, **el feed rinde mejor sin ningún cambio de código**.
