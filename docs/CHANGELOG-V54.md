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
- **La columna nace NULL en todo el catálogo.** No se corrió ningún script que adivine la marca desde
  el nombre. Se llena a mano, producto por producto.
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
- **Feed**: 99 filas, `brand` = `{Sevelin: 98, Kingston: 1}`. La fila de Kingston sale con su marca
  real.
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
2. **Cargar las marcas**: 113 productos publicados no la tienen. No hace falta llenarlos todos —
   solo los que tienen marca conocida de verdad (Kingston, MSI, HP, Samsung, Master-G…). Los cables,
   tornillos y genéricos se quedan vacíos a propósito.
3. Cuando haya marcas cargadas, **el feed rinde mejor sin ningún cambio de código**.
