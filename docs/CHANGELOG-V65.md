# v65 — Las fichas dejan de mostrar el Markdown crudo, y dos botones para generarlas con IA

**Fecha:** 16-09-2026 · Commits `2e97651` (arreglo) y `3be7a33` (botones). Migración de datos:
`sql/53-descripciones-envueltas-en-p.sql`, **ya aplicada en producción**.

---

## 1. El bug: 13 fichas mostraban "###" y "**" al cliente en sevelin.cl

El dueño lo reportó con un caso real:
`sevelin.cl/productos/mantenimiento-de-ps5-limpieza-metal-liquido-y-thermal-pads-utt1b`.

### Qué parecía y qué era

La sospecha era el checkbox "Convertir Markdown al pegar" del POS. **No era eso** — el conversor
funciona. La causa real:

La tienda decide en `sevelin-tienda/src/lib/sanitizar-html.ts`:

- descripción **con HTML** → se respeta tal cual, no se toca;
- descripción de **texto plano** → se estructura con `formatearDescripcionPlana()` (títulos `###`,
  viñetas `✅`, negritas `**`).

Esas 13 descripciones estaban guardadas como **UN SOLO `<p>` envolviendo todo el Markdown crudo**:

```
<p>✨ ¿Tu PS5 se calienta...\n\n### 💪 Ventajas\n\n✅ **Metal líquido nuevo:** ...</p>
```

La tienda veía ese `<p>`, concluía "esto ya es HTML del editor" y lo imprimía literal.

**La prueba que lo confirmó:** la Memoria RAM Hiksemi (id 161) tiene el mismo `###` pero **sin** el
`<p>` — y su ficha real sale perfecta (2 `<h3>`, `<ul>` de 10 `<li>`, cero asteriscos).

### El arreglo

Quitar **solo** el `<p>` de apertura y el `</p>` de cierre. **No se cambió ni una palabra del texto.**
Al volver a ser texto plano, la tienda arma `<h3>`, `<ul>/<li>` y `<strong>` sola.

Se probó antes de aplicarlo, corriendo el texto real del PS5 a través del `formatearDescripcionPlana()`
**de la tienda**, no de una imitación.

**Los 13:** servicios 265, 266, 267, 268, 269, 270, 273, 275, 276, 278 · productos 160, 196, 230.

**Un `UPDATE` por producto, nunca en una sola sentencia.** `trg_sync_tienda` es `FOR EACH ROW` y encola
un `net.http_post` por fila; en v61 actualizar varios de una vez perdió 2 de 4 sincronizaciones.
Esta vez **las 13 sincronizaron**: verificado abriendo las 13 fichas reales (200, sin `###` ni `**`,
con sus títulos y listas).

### Estado del resto del catálogo (auditado, no estimado)

| Caso | Cuántos | Cómo se ve |
|---|---|---|
| HTML + Markdown crudo | **13** | roto — **arreglado acá** |
| HTML real del editor | 62 | bien |
| Texto plano con Markdown | 45 | bien (la tienda lo formatea) |
| Texto plano simple | 35 | bien |

> **Trampa de Postgres encontrada al auditar:** en las expresiones regulares de Postgres `\b` **no es
> borde de palabra, es backspace** (el borde es `\y`). El primer conteo salió mal por eso: daba 58
> "rotas" cuando eran 13. Si una regex con `\b` da un resultado raro en Postgres, es esto.

---

## 2. Dos botones para generar el texto con IA

En el modal de producto, bajo la Descripción.

- **🛒 Generar ficha para la tienda** — elige el prompt **solo** según `es_servicio` (la marca de
  `sql/52`): el de servicios técnicos si está marcado, el de productos si no. El resultado entra al
  editor **ya convertido a HTML** con `convertirMarkdownAHtml()` (la misma función del pegado desde
  Gemini), así que **esta vía no puede volver a producir el bug del punto 1**.
- **📣 Generar publicación para Facebook** — abre un cuadro editable con botón Copiar. No toca la
  base ni publica nada.

### Las tres decisiones de diseño

1. **Los prompts viven en el servidor** (`api/index.js`: `PROMPT_FICHA_PRODUCTO`,
   `PROMPT_FICHA_SERVICIO`, `PROMPT_FACEBOOK`), no en el navegador. Son regla de negocio — qué se
   puede decir de un producto y qué no — y así se corrigen en un solo lugar.
2. **Hay un campo obligatorio de "información real"** (`#prodDatosReales`, no se guarda en la base).
   Los tres prompts prohíben inventar specs, así que el servidor **devuelve 400** si no hay ni datos
   pegados ni Descripción ya escrita. Un modelo al que solo se le da el nombre del producto rellena
   con características plausibles que nadie verificó, y eso termina publicado en sevelin.cl y en
   Facebook. **Es la validación que de verdad protege al negocio acá.**
3. **Nada se guarda ni se publica solo.** La ficha queda en el editor hasta "Guardar producto";
   reemplazar una Descripción que ya existe pide confirmación. La de Facebook solo se copia.

Detalle chico pero pensado: el **título comercial** que los prompts ponen en la primera línea se
separa en el servidor y solo se propone **si el campo Nombre está vacío**. Si el dueño ya le puso
nombre, ese nombre manda — puede ser el que está publicado en Marketplace o el que conoce el cliente.

### Refactor

Se extrajo `pedirAGemini()` / `responderFalloGemini()`. El reintento entre modelos
(`gemini-flash-lite-latest` → `gemini-flash-latest`) y el manejo de errores ahora los comparten los
**tres** botones de IA en vez de estar copiados. El botón de SEO conserva su comportamiento exacto,
incluida la limpieza de `| Sevelin` del título y su mensaje "El SEO se puede escribir a mano".

---

## 3. Cómo se probó

| Prueba | Resultado |
|---|---|
| Endpoint nuevo (doble de Supabase + Gemini simulado) | **18/18** |
| Botón de SEO viejo, tras el refactor | **6/6** — incluido el reintento entre modelos y los dos mensajes de error |
| Frontend en jsdom | **16/16** — carga sin `ReferenceError`, funciones e ids presentes |
| `node --check` en los 3 archivos tocados | OK |
| Funciones globales duplicadas · ids duplicados | vacío · vacío |
| Tailwind | no hace falta recompilar: todas las clases usadas ya existían en `css/styles.css` |
| Producción | `/api/productos/generar-texto` responde **401** (existe, exige token), `/generar-seo` sigue **401**, `index.html` trae el botón nuevo |

**Lo que NO se pudo verificar y le toca al dueño:** la respuesta real de Gemini (en las pruebas está
simulada) y cómo se ven los botones en pantalla — no hay navegador contra el POS en este entorno.
**El primer uso real de cada botón es la prueba que falta.**
