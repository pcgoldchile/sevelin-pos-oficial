# CHANGELOG v41 — Fichas de producto reescritas (60 productos)

**Fecha:** 30-08-2026

---

## 1. Qué se hizo

El usuario pidió que las descripciones del catálogo (`descripcion_web`) siguieran una plantilla fija
de ficha de producto (título comercial + introducción + 8-12 características + advertencia opcional +
pie fijo de envíos/garantía/contacto), aplicada **solo a productos, nunca a servicios** — los servicios
quedan para otra sesión.

## 2. Alcance real (no "casi todos" a ciegas — se auditó primero)

De 116 productos en el catálogo:
- **10** son servicios (`categoria_web = 'Servicios Técnicos'`) → excluidos.
- **1** más es un servicio **mal clasificado** bajo "Componentes PC" (`id 91`, "Servicio de
  Actualización de BIOS / Firmware para Placa Madre") → detectado por nombre y excluido también.
- De los 105 productos reales: **5 ya cumplían** el formato nuevo, **40 no tenían ninguna descripción**
  guardada (ni texto plano) — el prompt del usuario prohíbe inventar specs, así que quedaron
  **pendientes** (decisión del usuario: "hazme los 61 primero"), y **60 tenían una descripción vieja
  que sí se pudo reescribir con información real ya existente**.

**Se actualizaron los 60.** Los 40 sin descripción y los 10 servicios (+1 mal clasificado) NO se
tocaron — quedan para cuando el usuario aporte specs/fotos de los 40, y para la sesión de servicios.

## 3. Qué cambió por producto
- **`productos.nombre`**: limpieza de título (tildes, mayúsculas inconsistentes, typos como "VGAA",
  espacios dobles, guiones) — nunca un renombre que cambie qué es el producto. Comparado uno por uno
  contra el nombre anterior antes de aplicar, para no romper la búsqueda del día a día en el POS.
- **`productos.descripcion_web`**: reescrita completa, con la información YA presente en la
  descripción anterior (nunca specs inventadas) reorganizada en:
  1. Introducción (✨, repite el título, explica beneficio y para quién es).
  2. "✨ Características principales:" + 8-12 viñetas ✅.
  3. "⚠️ Importante:" — SOLO cuando la fuente ya traía una advertencia real (ej. "funciona solo de
     HDMI → VGA", "no incluye ventiladores preinstalados", "REACONDICIONADO" en el monitor Master-G).
     Se sacaron esas advertencias de la lista de características (donde estaban mezcladas como una
     viñeta más) a su propia sección, que es donde corresponden.
  4. Pie fijo idéntico en los 60 (envíos a todo Chile, WhatsApp +56935750828, Instagram @sevelin.cl,
     garantía 6 meses, medios de pago, boleta, link a www.sevelin.cl) — dato fijo, no se inventó ni
     varió entre productos.

## 4. Cambio de código que hizo falta (sevelin-tienda)
El pie fijo usa `**negrita**` y `[texto](url)` (así lo pidió el prompt del usuario). El formateador de
texto plano de la tienda no interpretaba ninguno de los dos — se habría visto literal
`**Envíos a todo Chile.**` con los asteriscos a la vista. Se agregó soporte mínimo para esos dos
marcadores en `src/lib/formatear-descripcion.ts` (`conEnfasis()`), sin abrir un parser de markdown
genérico. Ver `sevelin-tienda/docs/CHANGELOG-V18.md`.

## 5. Cómo se aplicó
Un script de una sola vez (no versionado, se descartó tras usarlo) actualizó `productos.nombre` y
`productos.descripcion_web` de los 60 productos directo en Supabase vía `service_role`. El trigger de
sincronización ya existente (`sql/22-trigger-sync-tienda.sql`) empujó el cambio a `productos_web` en
`sevelin-tienda` solo — no hizo falta tocar la tienda para que el contenido llegara.

## 6. Cómo se probó
- **60/60 fichas verificadas** contra el pipeline real de renderizado de la tienda
  (`sanitizarDescripcionHtml`) antes de tocar la base: intro con ✨, un solo `<ul>` de características
  (sin fusionar mal ni partirse), pie completo (WhatsApp/Instagram/garantía/link), sin entidades HTML
  rotas, sin asteriscos de markdown sin procesar, sin contenido sospechoso de inyección.
- **Vista previa visual real** en el navegador (inyectando el HTML ya sanitizado sobre la página real
  de un producto) antes de aplicar nada — confirmó el diseño de tarjetas con ícono check, el bloque
  "⚠️ Importante" con su propio color, y el link real a www.sevelin.cl.
- **Aplicado a la base real**: 60/60 sin errores.
- **Verificado en producción** después del despliegue del cambio de `formatear-descripcion.ts`: 5
  productos de muestra (repartidos a lo largo del lote) con `<h3>`/`<ul>` correctos, WhatsApp presente,
  y advertencia solo en los que correspondía (ej. el cable DisplayPort con su "no bidireccional").

## 7. Pendiente (decisión ya tomada por el usuario, no es un olvido)
- **40 productos sin ninguna descripción**: quedan para cuando el usuario aporte información real
  (specs, fotos) — no se les inventó contenido.
- **10 servicios** (+ el `id 91` mal clasificado): el usuario hará su propio prompt para servicios en
  otra sesión.
- El `id 91` sigue categorizado como "Componentes PC" en vez de "Servicios Técnicos" — vale la pena
  corregir esa categoría en algún momento (no se tocó en esta sesión, fuera de alcance).
