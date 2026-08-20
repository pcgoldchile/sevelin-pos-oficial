# CHANGELOG V9 — 15 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v9.

Esta versión arregla el módulo de Finanzas (botones muertos + estética) y reorganiza la
documentación y las variables de entorno.

---

## 1. Bug: los botones "Traspaso interno" y "Resguardo" no hacían nada

**Diagnóstico** (no era colisión de IDs como se sospechaba, sino una función faltante):

Al hacer clic, `abrirModalTraspaso` y `abrirModalResguardo` llamaban a `num()`, una función que
**solo existía en el backend** (`api/index.js`) y nunca se definió en el frontend. El resultado era
`ReferenceError: num is not defined`, lanzado **antes** de que el modal recibiera la clase `.show`.
Los botones sí tenían su evento enganchado y los modales sí existían en el HTML: simplemente la
función reventaba en silencio a mitad de camino.

Se confirmó reproduciendo el clic con jsdom (mostraba el `ReferenceError` en el stack).

**Solución:** `num()` ahora es un helper global en `js/config.js` (que carga primero), espejando la
del backend: devuelve 0 ante `null`, `undefined`, `''` o texto no numérico, nunca `NaN`. Se verificó
que el nombre no colisionaba con ninguna otra declaración global antes de crearlo.

Verificado: clic en Traspaso y en Resguardo abren su modal; Cancelar los cierra; el modal de
Resguardo precarga el valor configurado.

---

## 2. Estética: el widget de saldos quedaba apretado y feo arriba de las pestañas

**Dos problemas:**

1. **Ubicación.** El bloque de saldos (Efectivo/Banco/Total + botones) estaba en el HTML **antes** de
   las pestañas, así que se apretaba encima de la navegación.
2. **Sin estilos.** Las clases del widget (`widget-saldos`, `saldo-card`, `cobertura-*`) **no existían
   en el CSS**: el widget se renderizaba con estilos por defecto del navegador. Por eso se veía crudo.

**Solución:**

- Se **movió el widget dentro del panel Balance** (donde tiene sentido financiero). Ahora las pestañas
  quedan limpias arriba y el widget aparece bajo ellas, al entrar a Balance.
- Se **escribió el CSS** del widget (sección 26 de `styles.css`), acorde al resto: tarjetas con el
  fondo y bordes del sistema, el total resaltado en verde, saldos negativos en rojo, y el badge de
  cobertura en verde/ámbar/rojo según el estado. Responsive (se apila en móvil).

---

## 3. Reorganización de documentación y entorno

- **`docs/`**: toda la documentación se movió a esta carpeta. Se creó **`docs/README.md`**, el
  documento **maestro** consolidado que reemplaza a todos los README anteriores como fuente de verdad.
  Los README históricos (V5–V8) y la auditoría se conservan en `docs/` como registro.
- **Versionado de aquí en adelante:** el maestro se mantiene al día; cada entrega añade su
  `docs/CHANGELOG-Vx.md` (este archivo es el primero) que depende del maestro. Detalle en la sección
  12 del maestro.
- **`.env` eliminado del proyecto y del índice de git.** Ya no se genera. En su lugar hay
  **`.env.example`** actualizado (con `CORS_ORIGINS`, `NEGOCIO_NOMBRE`, `PORT`, `NODE_ENV` y avisos de
  seguridad). El `.env` real vive solo en la máquina de desarrollo o en las variables de Vercel.

---

## 4. Pruebas de esta entrega

- Botones de Finanzas: 8 comprobaciones (num global, Traspaso abre/cierra, Resguardo abre/precarga/
  cierra, reubicación del widget). Todas en verde.
- Chequeo anti-colisión de funciones globales: sin duplicados.
- Sintaxis de los 22 archivos JS + backend: OK. Tailwind recompilado.

---

## 5. Orden de despliegue

Sin migraciones nuevas de base de datos en esta versión. Solo frontend:

1. Despliega el frontend (`css/tailwind.css` ya recompilado; `index.html`, `js/config.js`,
   `js/balance.js`, `css/styles.css` cambiaron).
2. Prueba: entra a Finanzas → Balance, confirma que el widget se ve ordenado bajo las pestañas, y que
   los botones **Traspaso interno** y **Resguardo** abren sus modales.
