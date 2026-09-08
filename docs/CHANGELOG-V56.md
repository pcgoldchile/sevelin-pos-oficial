# CHANGELOG v56 — Garantías accesible para el rol trabajador

**Fecha:** 07-09-2026 · **Rama:** `main` · Sin migración SQL. Cambio de permisos.

---

## 1. El problema

El módulo Garantías era **visible** para el rol `trabajador` —ni el botón del sidebar ni la sección
tienen `admin-only`— pero **todos sus endpoints eran `auth(true)`**, es decir solo admin. Resultado:
un trabajador entraba, veía la pantalla completa y recibía un error en cada consulta.

Estaba así desde v48. Se detectó al construir el panel "Por vencer" (v55) y se dejó anotado en vez de
corregirlo sobre la marcha, porque abrir un permiso es una decisión del dueño, no una corrección
técnica. **El dueño pidió abrirlo.**

---

## 2. Qué se cambió

Cuatro endpoints pasaron de `auth(true)` a `auth()`:

| Endpoint | Para qué lo necesita el trabajador |
|---|---|
| `GET /api/garantias/productos` | Alguien llega al mostrador con un producto malo |
| `GET /api/garantias/servicios` | Lo mismo con un equipo reparado en el taller |
| `GET /api/garantias/por-vencer` | Es quien manda el aviso por WhatsApp |
| `POST /api/garantias/:tipo/:id/aviso` | Marcar que ya avisó |

Sin token la respuesta sigue siendo **401**: se abrió a los dos roles, no al público.

---

## 3. Por qué es seguro, y la condición para que lo siga siendo

**Ninguna respuesta de este módulo trae costo, precio, utilidad ni margen.** Verificado sobre la
respuesta real: los campos que devuelve son `tipo, id, referencia, fecha_inicio, cliente,
cliente_telefono, detalle, sku, serial_number, condicion, meses_garantia, vence_el, dias_restantes,
aviso_garantia_en`. Ninguno es una cifra de plata.

Eso es lo que hace razonable el permiso, y por eso quedó escrito en el encabezado del módulo en
`api/index.js`:

> **Si alguna vez se le agrega una cifra de plata a estos endpoints, hay que volver a evaluar el
> permiso — no darlo por hecho porque "ya estaba abierto".**

Los datos sensibles del negocio siguen donde estaban: Finanzas (con PIN y expulsión por inactividad)
y el panel Inteligencia dentro de ella.

---

## 4. Cómo se probó

Se firmaron dos JWT reales, uno `admin` y uno `trabajador`, y se llamaron los cuatro endpoints
contra la base de producción:

| Ruta | admin | trabajador |
|---|---|---|
| `/api/garantias/productos` | 200 | **200** |
| `/api/garantias/servicios` | 200 | **200** |
| `/api/garantias/por-vencer` | 200 | **200** |
| `POST .../aviso` | — | **200** (marcado y revertido) |
| sin token | — | **401** |

Además se listaron todas las claves de la respuesta y se comprobó por expresión regular que no
aparezca ninguna con `costo`, `precio`, `utilidad`, `total` ni `margen`: **ninguna**.

`node --check` en el archivo tocado; chequeos de colisión: vacíos.

---

## 5. Archivos tocados

| Archivo | Cambio |
|---|---|
| `api/index.js` | 4 endpoints de `auth(true)` a `auth()` + el criterio del permiso escrito en el encabezado del módulo |
