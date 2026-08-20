# CHANGELOG V20 — 20 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v20.

Unificación de los 5 helpers de escape de HTML dispersos en el frontend en uno solo: `escHtml`
(`js/config.js`). Es limpieza de deuda técnica del backlog — sin cambio de comportamiento visible.

---

## 1. El problema

Existían 5 funciones que hacían lo mismo (escapar HTML antes de insertar texto de usuario en el DOM),
declaradas por separado en distintos archivos:

| Función | Archivo |
|---|---|
| `escHtml` | `js/config.js` (la canónica, documentada como "usar esta") |
| `escaparTexto` | `js/balance.js` |
| `escaparHtmlHist` | `js/historial.js` |
| `escaparHTML` | `js/print.js` |
| `escaparRep` | `js/reportes.js` |

Las 4 duplicadas eran funcionalmente casi idénticas a `escHtml`, salvo que **no escapaban la comilla
simple (`'`)** — un descuido menor pero real: si alguno de esos valores terminaba dentro de un atributo
HTML delimitado por comillas simples, quedaba una vía de inyección que `escHtml` sí cierra.

Además `js/etiquetas.js` (que carga *antes* que `print.js` en `index.html`) llamaba a `escaparHTML` sin
definirla él mismo — dependía de que `print.js` la declarara más tarde en el mismo scope global. Al
eliminar `escaparHTML` de `print.js` había que migrar también esas 3 llamadas en `etiquetas.js`, aunque
no estaba en la lista original de archivos a tocar.

## 2. Fix

- Se eliminaron las 4 definiciones duplicadas (`balance.js:769`, `historial.js:1158`, `print.js:68`,
  `reportes.js:741`).
- Se reemplazaron todas las llamadas por `escHtml`:
  - `balance.js`: 8 llamadas (`escaparTexto` → `escHtml`).
  - `historial.js`: 8 llamadas (`escaparHtmlHist` → `escHtml`).
  - `print.js`: 21 llamadas (`escaparHTML` → `escHtml`).
  - `reportes.js`: 10 llamadas (`escaparRep` → `escHtml`).
  - `etiquetas.js`: 3 llamadas (`escaparHTML` → `escHtml`) — no listado en el pedido original, pero
    necesario para no dejarlo roto (dependía de la función que se borró de `print.js`).
- Se actualizó el comentario de cabecera de `escHtml` en `js/config.js`, que documentaba los 4 helpers
  duplicados como "se dejan para no romper sus llamadas" — ya no aplica.

## 3. Qué NO cambió

- El comportamiento de escape en sí: `escHtml` es un superset de las 4 funciones que reemplaza (mismo
  escape de `&<>"`, más el de `'` que las duplicadas no hacían). Ningún llamador dependía de que la
  comilla simple *no* se escapara.
- No se tocó `api/index.js`, SQL, ni Tailwind.

## 4. Pruebas

- `node --check` en los 6 archivos tocados (`balance.js`, `config.js`, `etiquetas.js`, `historial.js`,
  `print.js`, `reportes.js`): sin errores.
- Chequeo de funciones globales duplicadas (`for f in js/*.js; do grep ...; done | sort | uniq -d`):
  vacío.
- Chequeo de ids duplicados en `index.html`: vacío (no se tocó `index.html`).
- `grep` de los 4 nombres viejos (`escaparTexto`, `escaparHtmlHist`, `escaparHTML`, `escaparRep`) en
  `js/` e `index.html`: sin resultados en código (solo queda la mención histórica en el comentario de
  `config.js`).
- jsdom: se concatenaron los 27 `js/*.js` en el orden real de `index.html` y se evaluaron en un
  `window` sin lanzar excepciones. Sobre ese `window` se verificó que:
  - `escaparTexto`, `escaparHtmlHist`, `escaparHTML`, `escaparRep` ya no existen como globales.
  - `escHtml` existe y escapa correctamente `<img src=x onerror=...>`, `&`, `"`, `'`, y devuelve `''`
    para `null`/`undefined`.
- No se probó visualmente (sin navegador real en este entorno): el cambio es un alias 1:1 de nombre de
  función sobre el mismo tipo de operación (escape de texto → string), sin cambio de firma ni de sitios
  de llamada más allá del nombre.

## 5. Despliegue

Solo frontend: `js/balance.js`, `js/config.js`, `js/etiquetas.js`, `js/historial.js`, `js/print.js`,
`js/reportes.js`. Sin migración SQL, sin cambios de Tailwind, sin cambios de backend.
